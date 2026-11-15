import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';

// --manifest <path> lets tests check an alternative manifest; the default is the real one.
const index = process.argv.indexOf('--manifest');
const manifestUrl = index > -1 ? pathToFileURL(process.argv[index + 1]) : new URL('../src/manifest.ts', import.meta.url);
const source = stripTypeScriptTypes(await readFile(manifestUrl, 'utf8'));
const manifest = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
manifest.validateManifest();

// The approval is read from each collection (c.approval), the same object the Worker decides with.
// It is named after the manifest export that holds it (giftPolicy, productPolicy, ...), or `<id> approval` otherwise.
function approvalName(c) {
  const name = Object.keys(manifest).find(key => c.approval !== undefined && manifest[key] === c.approval);
  return name || `${c.id} approval`;
}
function approvalReasons(c, flags) {
  if (!c.approval) return [`${approvalName(c)} is missing`];
  return flags.filter(flag => c.approval[flag] !== true).map(flag => `${approvalName(c)}.${flag} is ${c.approval[flag] === undefined ? 'missing' : JSON.stringify(c.approval[flag])}`);
}
function releaseReasons(c) {
  const reasons = [];
  if (!c.release) reasons.push('no release');
  else if (c.release.synthetic) reasons.push('synthetic materials');
  if (c.status !== 'published') reasons.push(`status ${c.status}`);
  return reasons;
}
const giftReasons = c => [...releaseReasons(c), ...approvalReasons(c, ['myaspVerified', 'distributionApproved'])];
const productReasons = c => [...releaseReasons(c), ...approvalReasons(c, ['distributionApproved'])];

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
const giftReady = giftCount > 0 && !giftBlocked;

// Exit policy: the release is blocked only when no collection (gift or paid product) can be distributed.
// A blocked collection is reported on its own line and simply stays closed in production while the others ship.
// An approved survey gift that still cannot be distributed is a mistake in the manifest, so it stops the release.
const giftApproved = manifest.collections.some(c => manifest.isSurveyGift(c) && manifest.isApproved(c));
if (giftApproved && !giftReady) {
  console.error('Release blocked: the survey gift is approved but cannot be distributed. See the survey-gift lines above for the reasons.');
  process.exit(1);
}
if (!giftReady && !paidReady) {
  const blocked = [giftCount > 0 && 'survey gift', paidBlocked > 0 && 'paid product'].filter(Boolean).join(' and ') || 'no collection';
  console.error(`Release blocked: no collection is distributable (${blocked} blocked). See the blocked lines above for the reasons.`);
  process.exit(1);
}
const closed = [giftBlocked && 'the survey gift', paidBlocked > 0 && `${paidBlocked} paid ${paidBlocked === 1 ? 'product' : 'products'}`].filter(Boolean);
// The verb agrees with the number of closed collections: "the survey gift stays", "2 paid products stay".
const closedCount = (giftBlocked ? 1 : 0) + paidBlocked;
if (closed.length) console.log(`Note: ${closed.join(' and ')} ${closedCount === 1 ? 'stays' : 'stay'} closed in production because ${closedCount === 1 ? 'it is' : 'they are'} blocked; only the ready collections are released.`);
console.log('Approved manifest is ready for a separately authorized production release.');
