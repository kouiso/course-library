import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
let errors = 0;
for (const path of paths) {
  if (!/\.(ts|mjs|md|json|jsonc|yml)$/.test(path)) continue;
  if (path === 'worker-configuration.d.ts') continue; // Wrangler owns this generated format.
  const text = await readFile(path, 'utf8');
  if (!text.endsWith('\n') || text.split('\n').some(line => /[\t ]+$/.test(line))) { console.error(`${path}: trailing whitespace or missing final newline`); errors++; }
}
if (errors) process.exit(1);
console.log(`Source hygiene passed (${paths.length} files inspected). Strict TypeScript checking runs separately.`);
