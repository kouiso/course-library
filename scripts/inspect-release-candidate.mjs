import { readFile, mkdir, realpath, open, lstat, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { resolve, dirname, basename, join, relative, isAbsolute, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectPdf, validateCandidate } from './candidate-validation.mjs';
async function main() {
const args = process.argv.slice(2);
const values = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--candidate', '--policy', '--root', '--output', '--mode'].includes(args[i]) || !args[i + 1]) throw new Error('Use --candidate --policy --root --output [--mode candidate|strict]');
  values[args[i]] = args[i + 1];
}
for (const key of ['--candidate', '--policy', '--root', '--output']) if (!values[key]) throw new Error(`Missing ${key}`);
if (values['--mode'] && !['candidate', 'strict'].includes(values['--mode'])) throw new Error('Invalid mode');
// Prevent accidental public evidence files. Resolve links before testing privacy.
const repository = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
function requirePrivate(path) {
  const r = relative(repository, path);
  if (r === '..' || r.startsWith('..' + sep) || isAbsolute(r)) return;
  try { execFileSync('git', ['check-ignore', '--quiet', '--', path]); }
  catch { throw new Error('Candidate, policy and report must remain outside tracked/public paths'); }
}
for (const key of ['--candidate', '--policy', '--root']) requirePrivate(await realpath(values[key]));
if (!values['--output'].endsWith('.json')) throw new Error('Report must be a private JSON file');
await mkdir(dirname(values['--output']), { recursive: true, mode: 0o700 });
const output = resolve(await realpath(dirname(values['--output'])), basename(values['--output']));
requirePrivate(output);
if ([await realpath(values['--candidate']), await realpath(values['--policy'])].includes(output)) throw new Error('Do not overwrite candidate or policy inputs');
// An existing report may be replaced only when it is a plain file with no other names.
// A hard link would otherwise let truncation reach a candidate, policy or PDF inode.
async function replaceableOutput(path) {
  const existing = await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing && (!existing.isFile() || existing.nlink !== 1)) throw new Error('Report output must be a new file or an unlinked regular report');
}
await replaceableOutput(output);
const temporary = join(dirname(output), `.${basename(output)}.tmp-${randomUUID()}`);
requirePrivate(temporary);
// Write a unique 0600 file, then rename it over the report so no existing inode is truncated.
async function writeReport(path, text) {
  let created = false;
  try {
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    created = true;
    try { await handle.writeFile(text); await handle.chmod(0o600); await handle.sync(); }
    finally { await handle.close(); }
    await replaceableOutput(path);
    await rename(temporary, path);
    created = false;
  } finally {
    // Cleanup must not mask the original write or rename error.
    if (created) await unlink(temporary).catch(() => undefined);
  }
}
const candidate = JSON.parse(await readFile(values['--candidate'], 'utf8'));
const policy = JSON.parse(await readFile(values['--policy'], 'utf8'));
const inspections = new Map(), inspectionFailures = [];
for (const entry of candidate.entries || []) {
  try { inspections.set(entry.logicalId, await inspectPdf(values['--root'], entry.localFile)); }
  catch { inspectionFailures.push({ logicalId: entry.logicalId, code: 'pdf-inspection-failed' }); }
}
const result = validateCandidate(candidate, policy, inspections, { strict: values['--mode'] === 'strict' });
result.inspectionFailures = inspectionFailures;
result.sourceReadOnly = true;
result.mode = values['--mode'] || 'candidate';
await writeReport(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ valid: result.valid, approved: false, releaseReady: false, inspected: inspections.size, errors: result.errors, warnings: result.warnings.length, inspectionFailures }));
if (!result.valid || inspectionFailures.length) process.exitCode = 1;

}
try { await main(); }
catch (error) {
  console.error(JSON.stringify({ error: 'candidate-inspection-failed', code: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'INVALID_INPUT' }));
  process.exitCode = 1;
}
