import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
const manifest = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
manifest.validateManifest();
if (!manifest.giftPolicy.myaspVerified || !manifest.giftPolicy.distributionApproved
  || !manifest.collections.length || manifest.collections.some(c => !manifest.canDistribute(c, false))) {
  console.error('Release blocked: survey eligibility/settings, approved distribution version, and non-synthetic materials must be verified first.');
  process.exit(1);
}
console.log('Approved survey-gift manifest is ready for a separately authorized production release.');
