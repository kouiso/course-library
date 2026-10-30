import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm, readdir, stat, link as link_ } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectPdf, validateCandidate } from '../scripts/candidate-validation.mjs';
import { fixtures, pdf } from '../scripts/fixtures.mjs';
const ver = '0.0.1';
function syntheticCandidate() {
  const expected = ['learning-flow', ...Array.from({ length: 10 }, (_, i) => `chapter-${String(i + 1).padStart(2, '0')}`), ...['01', '02', '03', '04', '05', '06', '07', '08', '10'].map(n => `exercise-${n}`)];
  const policy = { courseId: 'fixture-course', distribution: 'survey-gift', audience: 'fixture-respondents', sourceRootId: 'fixture-root', sourceVersion: ver, expectedEncryption: false, slots: [] };
  const candidate = { schemaVersion: 1, classification: 'private-release-candidate', approved: false, courseId: policy.courseId, distribution: policy.distribution, audience: policy.audience, sourceRootId: policy.sourceRootId, declaredSourceVersion: ver, entries: [] };
  const inspections = new Map();
  for (const logicalId of expected) {
    const kind = logicalId === 'learning-flow' ? logicalId : logicalId.split('-')[0], chapterId = kind === 'learning-flow' ? null : logicalId.split('-')[1];
    const topic = chapterId ? `fixture-topic-${chapterId}` : 'fixture-flow';
    const sourceFileId = `fixture-source-${logicalId}`, sourceFolderId = `fixture-folder-${chapterId || 'flow'}`;
    policy.slots.push({ logicalId, kind, chapterId, sourceFileId, sourceFolderId, bodyAnchors: [topic] });
    const hash = createHash('sha256').update(logicalId).digest('hex');
    candidate.entries.push({ logicalId, kind, chapterId, courseId: policy.courseId, distribution: policy.distribution, audience: policy.audience, localFile: `originals/${logicalId}.pdf`, sha256: hash, bytes: 512, pages: 1, encrypted: false, source: { fileId: sourceFileId, folderId: sourceFolderId, rootId: policy.sourceRootId, parentIds: [sourceFolderId], mimeType: 'application/pdf', filename: `fixture-${logicalId}_ver.${ver}.pdf`, declaredVersion: ver, bytes: 512 } });
    const text = `${kind === 'exercise' ? 'Exercise ' : ''}${chapterId ? `Chapter ${chapterId}:` : 'Learning Flow:'} ${topic} Version ${ver}`;
    inspections.set(logicalId, { sha256: hash, bytes: 512, pages: 1, encrypted: false, text, firstPage: text, bodyVersions: [ver] });
  }
  return { candidate, policy, inspections };
}
const codes = result => result.errors.map(e => e.code);
test('explicit chapter IDs validate in arbitrary input order and never approve a release', () => {
  const data = syntheticCandidate(); data.candidate.entries.reverse();
  const result = validateCandidate(data.candidate, data.policy, data.inspections, { strict: true });
  assert.equal(result.valid, true); assert.equal(result.approved, false); assert.equal(result.releaseReady, false);
  assert.equal(result.records.length, 20);
});
test('sequential exercise-09 replacement is rejected and missing exercise-10 is detected', () => {
  const data = syntheticCandidate();
  const entry = data.candidate.entries.find(e => e.logicalId === 'exercise-10');
  entry.logicalId = 'exercise-09'; entry.chapterId = '09';
  const result = validateCandidate(data.candidate, data.policy, data.inspections);
  assert.ok(codes(result).includes('unexpected-slot')); assert.ok(result.errors.some(e => e.slot === 'exercise-10' && e.code === 'missing-slot'));
  assert.ok(!fixtures().has('typescript-exercise-09.pdf')); assert.ok(fixtures().has('typescript-exercise-10.pdf'));
});
test('missing files and duplicate slots, sources, hashes and local paths fail closed', () => {
  const data = syntheticCandidate();
  data.candidate.entries.pop();
  data.candidate.entries.push(structuredClone(data.candidate.entries[0]));
  const result = validateCandidate(data.candidate, data.policy, data.inspections);
  for (const code of ['missing-slot', 'duplicate-slot', 'duplicate-source', 'duplicate-content', 'duplicate-local-file']) assert.ok(codes(result).includes(code), code);
});
test('wrong chapter number, body topic and body role are independently detected', () => {
  for (const [change, expected] of [
    [o => { o.firstPage = 'Exercise Chapter 09: fixture-topic-10'; }, 'body-chapter-mismatch'],
    [o => { o.text = 'Exercise Chapter 10: unrelated topic'; }, 'body-topic-mismatch'],
    [o => { o.firstPage = 'Chapter 10: fixture-topic-10'; }, 'body-role-mismatch'],
  ]) {
    const data = syntheticCandidate(); change(data.inspections.get('exercise-10'));
    assert.ok(codes(validateCandidate(data.candidate, data.policy, data.inspections)).includes(expected));
  }
});
test('foreign paid-product and other-course content is rejected', () => {
  for (const text of ['Taskapp paid course', 'React / SkyWay course']) {
    const data = syntheticCandidate(); data.inspections.get('chapter-01').text += '\n' + text;
    assert.ok(codes(validateCandidate(data.candidate, data.policy, data.inspections)).includes('foreign-course-content'));
  }
});
test('source identity, parent folder, course and audience must match the private policy', () => {
  const data = syntheticCandidate(), entry = data.candidate.entries[0];
  entry.source.fileId = 'fixture-unexpected-source'; entry.source.parentIds = ['fixture-other-folder']; entry.audience = 'everyone';
  const result = validateCandidate(data.candidate, data.policy, data.inspections);
  assert.ok(codes(result).includes('source-provenance-mismatch')); assert.ok(codes(result).includes('entry-policy-mismatch'));
});
test('byte hash, page count, size and encryption cannot silently change', () => {
  const data = syntheticCandidate(), observed = data.inspections.get('chapter-01');
  observed.sha256 = '0'.repeat(64); observed.bytes = 999; observed.pages = 3; observed.encrypted = true;
  const result = validateCandidate(data.candidate, data.policy, data.inspections);
  for (const code of ['sha256-mismatch', 'byte-size-mismatch', 'page-count-mismatch', 'encryption-mismatch']) assert.ok(codes(result).includes(code));
});
test('filename versions and body versions must agree; unlabeled bodies stay unapproved', () => {
  const data = syntheticCandidate(); data.candidate.entries[0].source.declaredVersion = '9.9.9'; data.inspections.get('chapter-01').bodyVersions = ['9.9.9'];
  const wrong = validateCandidate(data.candidate, data.policy, data.inspections);
  assert.ok(codes(wrong).includes('source-version-mismatch')); assert.ok(codes(wrong).includes('body-version-mismatch'));
  const missing = syntheticCandidate(); missing.inspections.get('chapter-01').bodyVersions = [];
  const candidate = validateCandidate(missing.candidate, missing.policy, missing.inspections);
  assert.equal(candidate.valid, true); assert.equal(candidate.releaseReady, false); assert.ok(candidate.warnings.some(w => w.code === 'body-version-unavailable'));
  assert.ok(codes(validateCandidate(missing.candidate, missing.policy, missing.inspections, { strict: true })).includes('body-version-required'));
});
test('real PDF inspection hashes exact synthetic bytes, reads pages/text and blocks path/symlink escapes', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'course-candidate-'));
  try {
    const root = join(folder, 'private'); await mkdir(root);
    const bytes = pdf('TypeScript Chapter 10: fixture-topic-10 Version 0.0.1');
    await writeFile(join(root, 'chapter-10.pdf'), bytes);
    const observed = await inspectPdf(root, 'chapter-10.pdf');
    assert.equal(observed.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(observed.pages, 1); assert.equal(observed.encrypted, false); assert.match(observed.text, /fixture-topic-10/); assert.deepEqual(observed.bodyVersions, [ver]);
    await writeFile(join(folder, 'outside.pdf'), bytes); await symlink(join(folder, 'outside.pdf'), join(root, 'escape.pdf'));
    for (const path of ['../outside.pdf', join(folder, 'outside.pdf'), 'escape.pdf']) await assert.rejects(inspectPdf(root, path));
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('private report CLI rejects public outputs, input overwrite and output symlinks', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'candidate-cli-'));
  try {
    const { candidate, policy } = syntheticCandidate();
    const input = join(folder, 'candidate.json'), rules = join(folder, 'policy.json');
    await writeFile(input, JSON.stringify(candidate)); await writeFile(rules, JSON.stringify(policy));
    const command = output => spawnSync(process.execPath, ['scripts/inspect-release-candidate.mjs', '--candidate', input, '--policy', rules, '--root', folder, '--output', output], { encoding: 'utf8', timeout: 15000 });
    const original = await readFile('package.json', 'utf8');
    assert.notEqual(command('package.json').status, 0);
    assert.equal(await readFile('package.json', 'utf8'), original);
    const before = await readFile(input, 'utf8');
    assert.notEqual(command(input).status, 0); assert.equal(await readFile(input, 'utf8'), before);
    const sentinel = join(folder, 'untouched.json'), link = join(folder, 'report.json');
    await writeFile(sentinel, 'synthetic sentinel'); await symlink(sentinel, link);
    assert.notEqual(command(link).status, 0); assert.equal(await readFile(sentinel, 'utf8'), 'synthetic sentinel');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('private report CLI never truncates hard-linked inputs and replaces existing reports atomically', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'candidate-link-'));
  try {
    const { candidate, policy } = syntheticCandidate();
    const input = join(folder, 'candidate.json'), rules = join(folder, 'policy.json'), sample = join(folder, 'sample.pdf');
    await writeFile(input, JSON.stringify(candidate)); await writeFile(rules, JSON.stringify(policy)); await writeFile(sample, pdf('Synthetic hard link sentinel'));
    const command = output => spawnSync(process.execPath, ['scripts/inspect-release-candidate.mjs', '--candidate', input, '--policy', rules, '--root', folder, '--output', output], { encoding: 'utf8', timeout: 15000 });
    const leftovers = async () => (await readdir(folder)).filter(name => name.includes('.tmp-'));
    for (const target of [input, rules, sample]) {
      const before = await readFile(target), link = join(folder, 'linked-report.json');
      await link_(target, link);
      try {
        const result = command(link);
        assert.notEqual(result.status, 0, target);
        assert.deepEqual(await readFile(target), before, target);
        assert.deepEqual(await readFile(link), before, target);
        assert.equal((await stat(target)).nlink, 2, target);
        assert.deepEqual(await leftovers(), []);
      } finally { await rm(link, { force: true }); }
    }
    const directory = join(folder, 'directory-report.json'); await mkdir(directory);
    assert.notEqual(command(directory).status, 0);
    assert.equal((await stat(directory)).isDirectory(), true);
    // `.env-report.json` is ignored, but its temporary sibling would not be; refuse before writing.
    assert.notEqual(command('.env-report.json').status, 0);
    await assert.rejects(stat('.env-report.json'));
    assert.deepEqual((await readdir('.')).filter(name => name.includes('.tmp-')), []);
    const report = join(folder, 'report.json');
    command(report);
    const first = JSON.parse(await readFile(report, 'utf8'));
    assert.equal(first.sourceReadOnly, true);
    assert.equal((await stat(report)).mode & 0o777, 0o600);
    await writeFile(report, '{"stale":true}\n');
    command(report);
    assert.equal(JSON.parse(await readFile(report, 'utf8')).sourceReadOnly, true);
    assert.equal((await stat(report)).mode & 0o777, 0o600);
    assert.equal((await stat(report)).nlink, 1);
    assert.deepEqual(await leftovers(), []);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
