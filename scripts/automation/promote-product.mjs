// Points a paid-product collection at a new immutable release in src/manifest.ts.
// Run by .github/workflows/promote-product.yml, and locally for review:
//   node scripts/automation/promote-product.mjs --collection task-app --version 1.1.5 [--date 2026-11-20] [--dry-run]
// The version must already be uploaded to R2 under releases/<collection>/<version>/ by the
// product repository's deploy workflow; this file only selects which uploaded release is served.
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const manifestPath = new URL('../../src/manifest.ts', import.meta.url);
const VERSION_RE = /^[a-z0-9][a-z0-9.-]{0,62}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Release constants follow <camelCase(collectionId)>Release so the collection id alone selects the block.
export const releaseConstName = id => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()) + 'Release';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--dry-run') { args.dryRun = true; continue; }
    if (!['--collection', '--version', '--date'].includes(flag) || !argv[i + 1]) {
      throw new Error('Use --collection <id> --version <version> [--date YYYY-MM-DD] [--dry-run]');
    }
    args[flag.slice(2)] = argv[++i];
  }
  for (const key of ['collection', 'version']) if (!args[key]) throw new Error(`Missing ${key}`);
  return args;
}

// Replaces the release fields inside one `export const <name> = { ... } as const;` block.
// Field order inside the block is fixed by the manifest, so a line-scoped edit cannot drift.
export function promoteProduct(source, { collection, version, date }) {
  const constName = releaseConstName(collection);
  const start = source.indexOf(`export const ${constName} = {`);
  if (start < 0) throw new Error(`No release constant ${constName} for collection "${collection}"`);
  const end = source.indexOf('} as const;', start);
  if (end < 0) throw new Error(`Release constant ${constName} is not closed with "as const"`);
  const block = source.slice(start, end);
  const next = block
    .replace(/version: '[^']+'/, `version: '${version}'`)
    .replace(/date: '[^']+'/, `date: '${date}'`)
    .replace(/prefix: '[^']+'/, `prefix: 'releases/${collection}/${version}/'`);
  if (!next.includes(`version: '${version}'`) || !next.includes(`date: '${date}'`) || !next.includes(`prefix: 'releases/${collection}/${version}/'`))
    throw new Error(`Release block ${constName} lacks a version/date/prefix field`);
  return { text: source.slice(0, start) + next + source.slice(end), changed: next !== block, constName };
}

// The collection must exist as a paid product and the result must pass the manifest's own checks.
async function verify(source, { collection, version, date }) {
  const code = stripTypeScriptTypes(source);
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  manifest.validateManifest();
  const course = manifest.collections.find(c => c.id === collection);
  if (!course || !manifest.isPaidProduct(course)) throw new Error(`"${collection}" is not a paid-product collection`);
  if (!course.release || course.release.version !== version || course.release.date !== date
    || course.release.prefix !== `releases/${collection}/${version}/` || course.version !== version)
    throw new Error(`"${collection}" does not point at ${version}`);
  return course;
}

export async function run(argv, { write = writeFile, log = console.log } = {}) {
  const args = parseArgs(argv);
  if (!VERSION_RE.test(args.version)) throw new Error(`Invalid version: ${args.version}`);
  if (args.date && !DATE_RE.test(args.date)) throw new Error(`Invalid date: ${args.date}`);
  args.date ||= new Date().toISOString().slice(0, 10);
  const source = await readFile(manifestPath, 'utf8');
  const { text, changed, constName } = promoteProduct(source, args);
  if (!changed) {
    log(`"${args.collection}" already points at ${args.version}. Nothing to do.`);
    return { changed: false, version: args.version };
  }
  const course = await verify(text, args);
  if (!args.dryRun) await write(manifestPath, text);
  log(`${args.dryRun ? '[dry-run] ' : ''}${constName}: ${args.collection} ${course.release.version === args.version ? '' : ''}${args.version} (${args.date}), prefix releases/${args.collection}/${args.version}/`);
  log(`Upload releases/${args.collection}/${args.version}/${args.collection}-textbook.zip too if the textbook is distributed; without it the product page hides the textbook for this version.`);
  return { changed: true, version: args.version, date: args.date };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  run(process.argv.slice(2)).catch(error => { console.error(`promote-product: ${error.message}`); process.exit(1); });
}
