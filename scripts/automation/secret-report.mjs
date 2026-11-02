import { readFile } from 'node:fs/promises';
import { runDirectly } from './github-api.mjs';
export function safeFindings(findings) {
  if (!Array.isArray(findings)) throw new Error('Invalid findings report');
  return findings.map(f => {
    if (!f || typeof f.File !== 'string' || typeof f.Commit !== 'string' || typeof f.RuleID !== 'string' || !Number.isSafeInteger(f.StartLine) || f.StartLine < 1) throw new Error('Invalid finding metadata');
    return { file: f.File, commit: f.Commit, line: f.StartLine, rule: f.RuleID };
  });
}
if (runDirectly(import.meta)) {
  try { for (const finding of safeFindings(JSON.parse(await readFile(process.argv[2], 'utf8')))) console.log(JSON.stringify(finding)); }
  catch { console.error('Unable to read safe finding metadata'); process.exitCode = 1; }
}
