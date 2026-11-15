import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-release.mjs', import.meta.url));
const manifestPath = fileURLToPath(new URL('../src/manifest.ts', import.meta.url));

function run(args = []) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 15000 });
}
function replaceOnce(text, from, to) {
  assert.equal(text.split(from).length, 2, `expected exactly one ${from}`);
  return text.replace(from, to);
}
async function withManifest(edit, check) {
  const folder = await mkdtemp(join(tmpdir(), 'course-release-check-'));
  try {
    const path = join(folder, 'manifest.ts');
    await writeFile(path, edit(await readFile(manifestPath, 'utf8')));
    await check(run(['--manifest', path]));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
const approveGift = text => {
  let next = replaceOnce(text, '  myaspVerified: false,\n  distributionApproved: false,', '  myaspVerified: true,\n  distributionApproved: true,');
  next = replaceOnce(next, '  synthetic: true,', '  synthetic: false,');
  return replaceOnce(next, "distribution: 'survey-gift', audience: 'survey-respondents', status: 'preview'", "distribution: 'survey-gift', audience: 'survey-respondents', status: 'published'");
};

test('with the survey gift unapproved and the paid product ready, the check passes and says the gift stays closed', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^survey-gift: blocked typescript \S+ - .*giftPolicy\.myaspVerified is false/m);
  assert.match(result.stdout, /^paid-product: ready redmine-clone \S+$/m);
  assert.match(result.stdout, /^Note: the survey gift stays closed in production because it is blocked;/m);
  assert.doesNotMatch(result.stderr, /Release blocked/);
});

test('release check blocks when the survey gift is unapproved and no paid product is ready', async () => {
  const edit = text => replaceOnce(text, 'export const productPolicy = {\n  distributionApproved: true,', 'export const productPolicy = {\n  distributionApproved: false,');
  await withManifest(edit, result => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^survey-gift: blocked typescript /m);
    assert.match(result.stdout, /^paid-product: blocked redmine-clone /m);
    assert.match(result.stderr, /^Release blocked: no collection is distributable \(survey gift and paid product blocked\)\./m);
  });
});

test('release check passes when the survey gift is approved, even with a paid product present', async () => {
  await withManifest(approveGift, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^survey-gift: ready typescript \S+$/m);
    assert.match(result.stdout, /^paid-product: ready redmine-clone \S+$/m);
    assert.doesNotMatch(result.stderr, /Release blocked/);
  });
});

test('a blocked paid product is reported but does not change the exit code', async () => {
  const edit = text => replaceOnce(approveGift(text), 'export const productPolicy = {\n  distributionApproved: true,', 'export const productPolicy = {\n  distributionApproved: false,');
  await withManifest(edit, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^survey-gift: ready typescript \S+$/m);
    assert.match(result.stdout, /^paid-product: blocked redmine-clone \S+ - productPolicy\.distributionApproved is false$/m);
    assert.match(result.stdout, /^Note: 1 paid product stays closed in production because it is blocked;/m);
    assert.doesNotMatch(result.stderr, /Release blocked/);
  });
});

test('one paid product ready and one blocked, with the survey gift unapproved, passes and reports both', async () => {
  const second = "  {\n    id: 'second-product', title: 'Second', description: 'Second product.', distribution: 'paid-product', audience: 'buyers', status: 'pending', version: null, release: null, cover: 'Second', mark: 'SP', phraseEnv: 'ACCESS_PHRASE_SHA256_SECOND_PRODUCT',\n    materials: [],\n  },\n];\nexport function isSurveyGift";
  const edit = text => replaceOnce(text, '];\nexport function isSurveyGift', second);
  await withManifest(edit, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^paid-product: ready redmine-clone \S+$/m);
    assert.match(result.stdout, /^paid-product: blocked second-product /m);
    assert.match(result.stdout, /^Note: the survey gift and 1 paid product stay closed in production because they are blocked;/m);
    assert.doesNotMatch(result.stderr, /Release blocked/);
  });
});

test('an approved survey gift that still cannot be distributed blocks the release', async () => {
  const edit = text => replaceOnce(text, '  myaspVerified: false,\n  distributionApproved: false,', '  myaspVerified: true,\n  distributionApproved: true,');
  await withManifest(edit, result => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^survey-gift: blocked typescript \S+ - synthetic materials/m);
    assert.match(result.stderr, /^Release blocked: the survey gift is approved but cannot be distributed\./m);
  });
});

const giftApprovalLine = "release, approval: giftPolicy, materials,";
// A published second product with a real release, so the decision reaches its approval.
const publishedSecond = approval => `  {
    id: 'second-product', title: 'Second', description: 'Second product.', distribution: 'paid-product', audience: 'buyers', status: 'published', version: '1.0.0',
    release: { schemaVersion: 1, version: '1.0.0', date: '2026-11-01', synthetic: false, prefix: 'releases/second-product/1.0.0/', verification: { delivery: 'd', materials: 'm', platforms: 'p' } },
    ${approval}cover: 'Second', mark: 'SP', phraseEnv: 'ACCESS_PHRASE_SHA256_SECOND_PRODUCT',
    materials: [{ id: 'source-zip', title: 'Source', filename: 'second-product-source.zip', type: 'application/zip', group: 'bundle' }],
  },
];
export function isSurveyGift`;
const pendingSecond = id => `  {
    id: '${id}', title: 'Second', description: 'Second product.', distribution: 'paid-product', audience: 'buyers', status: 'pending', version: null, release: null, approval: { distributionApproved: false }, cover: 'Second', mark: 'SP', phraseEnv: 'ACCESS_PHRASE_SHA256_${id.toUpperCase().replaceAll('-', '_')}',
    materials: [],
  },
];
export function isSurveyGift`;

test('the release check reads the approval held by the survey gift itself, not giftPolicy', async () => {
  // ギフトの承認を giftPolicy とは別のオブジェクトにして承認済みにする。Worker の判定はこのオブジェクトを見る。
  const approvedOwn = text => {
    let next = replaceOnce(text, '  synthetic: true,', '  synthetic: false,');
    next = replaceOnce(next, "distribution: 'survey-gift', audience: 'survey-respondents', status: 'preview'", "distribution: 'survey-gift', audience: 'survey-respondents', status: 'published'");
    return replaceOnce(next, giftApprovalLine, 'release, approval: { myaspVerified: true, distributionApproved: true }, materials,');
  };
  await withManifest(approvedOwn, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^survey-gift: ready typescript \S+$/m);
    assert.doesNotMatch(result.stdout, /^Note:/m);
  });
  // 逆向き: giftPolicy だけ承認済みで、ギフトが持つ承認は未承認。ギフトは閉じたまま、理由はギフトの承認を指す。
  const approvedPolicyOnly = text => replaceOnce(approveGift(text), giftApprovalLine, 'release, approval: { myaspVerified: false, distributionApproved: false }, materials,');
  await withManifest(approvedPolicyOnly, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^survey-gift: blocked typescript \S+ - typescript approval\.myaspVerified is false, typescript approval\.distributionApproved is false$/m);
    assert.match(result.stdout, /^Note: the survey gift stays closed in production because it is blocked;/m);
    assert.doesNotMatch(result.stderr, /Release blocked/);
  });
});

test('a published product without an approval is reported as blocked instead of crashing the check', async () => {
  const edit = text => replaceOnce(text, '];\nexport function isSurveyGift', publishedSecond(''));
  await withManifest(edit, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /TypeError/);
    assert.match(result.stdout, /^paid-product: ready redmine-clone \S+$/m);
    assert.match(result.stdout, /^paid-product: blocked second-product 1\.0\.0 - second-product approval is missing$/m);
    assert.match(result.stdout, /^Note: the survey gift and 1 paid product stay closed in production because they are blocked;/m);
  });
});

test('two blocked paid products are counted in the plural', async () => {
  const edit = text => replaceOnce(approveGift(text), '];\nexport function isSurveyGift', pendingSecond('second-product').replace('];\nexport function isSurveyGift', pendingSecond('third-product')));
  await withManifest(edit, result => {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^survey-gift: ready typescript \S+$/m);
    assert.match(result.stdout, /^Note: 2 paid products stay closed in production because they are blocked;/m);
  });
});

test('a product that shares the gift approval object stops the release check', async () => {
  const edit = text => replaceOnce(text, 'release: productRelease, approval: productPolicy,', 'release: productRelease, approval: giftPolicy,');
  await withManifest(edit, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Shared approval/);
    assert.doesNotMatch(result.stdout, /^paid-product: ready/m);
  });
});
