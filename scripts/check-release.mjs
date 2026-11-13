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
let paidReady = 0;
let paidBlocked = 0;
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
    if (manifest.canDistributeProduct(c)) {
      paidReady++;
      console.log(`paid-product: ready ${c.id} ${version}`);
    } else {
      paidBlocked++;
      console.log(`paid-product: blocked ${c.id} ${version} - ${productReasons(c).join(', ') || 'not distributable'}`);
    }
  }
}
const giftReady = giftCount > 0 && !giftBlocked && manifest.giftPolicy.myaspVerified && manifest.giftPolicy.distributionApproved;

// Exit policy: a paid product that cannot be distributed always stops the release. An unapproved survey gift stops it
// only when no paid product is ready; with every paid product ready the gift simply stays closed in production.
if (paidBlocked) {
  console.error('Release blocked: a paid product is not ready. See the paid-product lines above for the reasons.');
  process.exit(1);
}
if (!giftReady && !paidReady) {
  console.error('Release blocked: survey gift is not ready. Survey eligibility/settings, approved distribution version, and non-synthetic materials must be verified first.');
  process.exit(1);
}
if (!giftReady) console.log('Note: the survey gift is not approved and stays closed in production; only the ready paid products are released.');
console.log('Approved manifest is ready for a separately authorized production release.');
