import { createReadStream } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAbsolute, relative, resolve, sep } from 'node:path';
const run = promisify(execFile);
export const normalize = value => String(value).normalize('NFC').replace(/[\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, '').toLowerCase();
const digest = value => createHash('sha256').update(value).digest('hex');
const versions = text => [...new Set([...text.matchAll(/(?:version|ver\.?|v)\s*[:.]?\s*(\d+\.\d+\.\d+)/gi)].map(m => m[1]))];

export async function inspectPdf(root, localFile) {
  if (typeof localFile !== 'string' || isAbsolute(localFile) || localFile.includes('\\') || localFile.split('/').some(p => !p || p === '.' || p === '..') || !/^[a-z0-9/.-]+\.pdf$/.test(localFile)) throw new Error('unsafe-local-file');
  const base = await realpath(root), path = await realpath(resolve(base, localFile));
  if (relative(base, path).startsWith('..' + sep) || relative(base, path) === '..' || isAbsolute(relative(base, path))) throw new Error('file-outside-private-root');
  const size = (await stat(path)).size;
  if (size < 8 || size > 64 * 1024 * 1024) throw new Error('pdf-size-out-of-range');
  const handle = await open(path, 'r');
  try {
    const header = Buffer.alloc(8); await handle.read(header, 0, 8, 0);
    if (!header.toString('ascii').startsWith('%PDF-')) throw new Error('not-a-pdf');
  } finally { await handle.close(); }
  const hash = createHash('sha256');
  for await (const part of createReadStream(path)) hash.update(part);
  const opts = { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } };
  const info = await run('pdfinfo', [path], opts);
  const fields = Object.fromEntries(info.stdout.split('\n').filter(l => l.includes(':')).map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  const pages = Number(fields.Pages);
  if (!Number.isSafeInteger(pages) || pages < 1) throw new Error('invalid-page-count');
  const encrypted = fields.Encrypted !== 'no';
  if (encrypted) return { sha256: hash.digest('hex'), bytes: size, pages, encrypted, text: '', firstPage: '', bodyVersions: [] };
  const full = await run('pdftotext', ['-enc', 'UTF-8', '-layout', path, '-'], opts);
  const first = await run('pdftotext', ['-f', '1', '-l', '1', '-enc', 'UTF-8', '-layout', path, '-'], opts);
  return {
    sha256: hash.digest('hex'), bytes: size, pages, encrypted,
    text: full.stdout, firstPage: first.stdout,
    bodyTextSha256: digest(normalize(full.stdout)), firstPageSha256: digest(normalize(first.stdout)),
    bodyVersions: versions(full.stdout), pdfVersion: fields['PDF version'],
  };
}

// Offline only. Private policy pins exact source identities and explicit chapter IDs.
// A successful candidate check never approves a release or modifies any source file.
export function validateCandidate(candidate, policy, inspections, { strict = false } = {}) {
  const errors = [], warnings = [], records = [];
  const problem = (slot, code) => errors.push({ slot, code });
  if (candidate?.schemaVersion !== 1 || candidate.classification !== 'private-release-candidate' || candidate.approved !== false) problem(null, 'not-an-unapproved-candidate');
  if (!policy || candidate?.courseId !== policy.courseId || candidate?.audience !== policy.audience || candidate?.distribution !== policy.distribution || candidate?.sourceRootId !== policy.sourceRootId) problem(null, 'candidate-policy-mismatch');
  if (!/^\d+\.\d+\.\d+$/.test(candidate?.declaredSourceVersion || '') || candidate.declaredSourceVersion !== policy?.sourceVersion) problem(null, 'candidate-version-mismatch');
  if (!Array.isArray(candidate?.entries) || !Array.isArray(policy?.slots) || !candidate.entries.length || !policy.slots.length || candidate.entries.length > 200 || policy.slots.length > 200) return { valid: false, approved: false, releaseReady: false, errors: [...errors, { slot: null, code: 'invalid-entry-list' }], warnings, records };
  const expected = new Map(policy.slots.map(s => [s.logicalId, s]));
  if (expected.size !== policy.slots.length) problem(null, 'duplicate-policy-slot');
  const seen = new Set(), seenSources = new Set(), seenHashes = new Set(), seenPaths = new Set();
  for (const entry of candidate.entries) {
    const id = entry.logicalId, slot = expected.get(id), observed = inspections.get(id);
    if (seen.has(id)) problem(id, 'duplicate-slot');
    seen.add(id);
    if (!slot) { problem(id, 'unexpected-slot'); continue; }
    if (entry.kind !== slot.kind || entry.chapterId !== slot.chapterId) problem(id, 'chapter-role-mismatch');
    if (entry.courseId !== policy.courseId || entry.audience !== policy.audience || entry.distribution !== policy.distribution) problem(id, 'entry-policy-mismatch');
    const source = entry.source || {};
    if (!source.fileId || source.fileId !== slot.sourceFileId || source.folderId !== slot.sourceFolderId || !source.parentIds?.includes(slot.sourceFolderId) || source.rootId !== policy.sourceRootId) problem(id, 'source-provenance-mismatch');
    if (seenSources.has(source.fileId)) problem(id, 'duplicate-source');
    seenSources.add(source.fileId);
    if (seenPaths.has(entry.localFile)) problem(id, 'duplicate-local-file');
    seenPaths.add(entry.localFile);
    if (source.mimeType !== 'application/pdf' || !/\.pdf$/i.test(source.filename || '')) problem(id, 'source-not-pdf');
    const filenameVersion = /ver[.]?(\d+\.\d+\.\d+)[.]pdf$/i.exec(source.filename || '')?.[1];
    if (filenameVersion !== policy.sourceVersion || source.declaredVersion !== policy.sourceVersion) problem(id, 'source-version-mismatch');
    const filenameExercise = /問題|exercise|problem/i.test(source.filename || '');
    if ((slot.kind === 'exercise') !== filenameExercise) problem(id, 'filename-role-mismatch');
    if (!observed) { problem(id, 'inspection-unavailable'); continue; }
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 || '') || observed.sha256 !== entry.sha256) problem(id, 'sha256-mismatch');
    if (seenHashes.has(observed.sha256)) problem(id, 'duplicate-content');
    seenHashes.add(observed.sha256);
    if (observed.bytes !== entry.bytes || observed.bytes !== source.bytes) problem(id, 'byte-size-mismatch');
    if (observed.pages !== entry.pages || observed.pages < 1) problem(id, 'page-count-mismatch');
    if (observed.encrypted !== policy.expectedEncryption || entry.encrypted !== observed.encrypted) problem(id, 'encryption-mismatch');
    const text = normalize(observed.text), first = normalize(observed.firstPage);
    if (!text) problem(id, 'body-unreadable');
    const foreign = ['taskapp', 'skyway', ...(policy.forbiddenMarkers || [])].some(marker => normalize(marker) && normalize(source.filename + '\n' + observed.text).includes(normalize(marker)));
    if (foreign) problem(id, 'foreign-course-content');
    const topicMatched = Array.isArray(slot.bodyAnchors) && slot.bodyAnchors.length > 0 && slot.bodyAnchors.some(anchor => text.includes(normalize(anchor)));
    if (!topicMatched) problem(id, 'body-topic-mismatch');
    const firstHeading = (observed.firstPage || '').replace(/[\u202a-\u202e\u2066-\u2069]/g, '').split('\n').map(s => s.trim()).find(Boolean) || '';
    const bodyExercise = /^(?:問題|演習|exercise|problem)/i.test(firstHeading);
    if ((slot.kind === 'exercise') !== bodyExercise) problem(id, 'body-role-mismatch');
    const explicitChapters = [...new Set([...first.matchAll(/(?:第|chapter)(\d{1,2})(?:章|[:.-])/gi)].map(m => m[1].padStart(2, '0')))];
    if (slot.chapterId && explicitChapters.some(n => n !== slot.chapterId)) problem(id, 'body-chapter-mismatch');
    const bodyVersions = observed.bodyVersions || [];
    if (!bodyVersions.length) {
      warnings.push({ slot: id, code: 'body-version-unavailable' });
      if (strict) problem(id, 'body-version-required');
    } else if (bodyVersions.length !== 1 || bodyVersions[0] !== policy.sourceVersion) problem(id, 'body-version-mismatch');
    records.push({ logicalId: id, chapterId: slot.chapterId, kind: slot.kind, sha256: observed.sha256, bytes: observed.bytes, pages: observed.pages, encrypted: observed.encrypted, topicMatched, explicitBodyChapterIds: explicitChapters, bodyVersions, firstPageSha256: observed.firstPageSha256, bodyTextSha256: observed.bodyTextSha256 });
  }
  for (const id of expected.keys()) if (!seen.has(id)) problem(id, 'missing-slot');
  return { valid: errors.length === 0, approved: false, releaseReady: false, errors, warnings, records };
}
