import { readFile, mkdir, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, basename, relative, isAbsolute, sep } from 'node:path';
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
const report = await open(output, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
try { await report.writeFile(JSON.stringify(result, null, 2) + '\n'); await report.chmod(0o600); }
finally { await report.close(); }
console.log(JSON.stringify({ valid: result.valid, approved: false, releaseReady: false, inspected: inspections.size, errors: result.errors, warnings: result.warnings.length, inspectionFailures }));
if (!result.valid || inspectionFailures.length) process.exitCode = 1;

}
try { await main(); }
catch (error) {
  console.error(JSON.stringify({ error: 'candidate-inspection-failed', code: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'INVALID_INPUT' }));
  process.exitCode = 1;
}
