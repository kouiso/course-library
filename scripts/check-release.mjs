import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';

// --manifest <path> lets tests check an alternative manifest; the default is the real one.
const index = process.argv.indexOf('--manifest');
const manifestUrl = index > -1 ? pathToFileURL(process.argv[index + 1]) : new URL('../src/manifest.ts', import.meta.url);
const source = stripTypeScriptTypes(await readFile(manifestUrl, 'utf8'));
const manifest = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
manifest.validateManifest();

function giftReasons(c) {
  const reasons = [];
  if (!c.release) reasons.push('no release');
  else if (c.release.synthetic) reasons.push('synthetic materials');
  if (c.status !== 'published') reasons.push(`status ${c.status}`);
  if (!manifest.giftPolicy.myaspVerified) reasons.push('giftPolicy.myaspVerified is false');
  if (!manifest.giftPolicy.distributionApproved) reasons.push('giftPolicy.distributionApproved is false');
  return reasons;
}
function productReasons(c) {
  const reasons = [];
  if (!c.release) reasons.push('no release');
  else if (c.release.synthetic) reasons.push('synthetic materials');
  if (c.status !== 'published') reasons.push(`status ${c.status}`);
  if (!manifest.productPolicy.distributionApproved) reasons.push('productPolicy.distributionApproved is false');
  return reasons;
}

// One line per collection. The leading word is the collection's distribution value.
let giftCount = 0;
let giftBlocked = false;
for (const c of manifest.collections) {
  const version = c.version || '-';
  if (manifest.isSurveyGift(c)) {
    giftCount++;
    if (manifest.canDistribute(c, false)) console.log(`survey-gift: ready ${c.id} ${version}`);
    else {
      giftBlocked = true;
      console.log(`survey-gift: blocked ${c.id} ${version} - ${giftReasons(c).join(', ') || 'not distributable'}`);
    }
  } else if (manifest.isPaidProduct(c)) {
    // Products are reported but never change the exit code here; the release policy for them is decided separately.
    if (manifest.canDistributeProduct(c)) console.log(`paid-product: ready ${c.id} ${version}`);
    else console.log(`paid-product: blocked ${c.id} ${version} - ${productReasons(c).join(', ') || 'not distributable'}`);
  }
}
if (!giftCount || giftBlocked || !manifest.giftPolicy.myaspVerified || !manifest.giftPolicy.distributionApproved) {
  console.error('Release blocked: survey gift is not ready. Survey eligibility/settings, approved distribution version, and non-synthetic materials must be verified first.');
  process.exit(1);
}
console.log('Approved survey-gift manifest is ready for a separately authorized production release.');
