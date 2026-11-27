import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
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
  const edit = text => {
    let next = replaceOnce(text, 'export const productPolicy = {\n  distributionApproved: true,', 'export const productPolicy = {\n  distributionApproved: false,');
    return replaceOnce(next, 'export const taskAppPolicy = {\n  distributionApproved: true,', 'export const taskAppPolicy = {\n  distributionApproved: false,');
  };
  await withManifest(edit, result => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^survey-gift: blocked typescript /m);
    assert.match(result.stdout, /^paid-product: blocked redmine-clone /m);
    assert.match(result.stdout, /^paid-product: blocked task-app /m);
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
  const edit = text => replaceOnce(text, 'release: redmineCloneRelease, approval: productPolicy,', 'release: redmineCloneRelease, approval: giftPolicy,');
  await withManifest(edit, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Shared approval/);
    assert.doesNotMatch(result.stdout, /^paid-product: ready/m);
  });
});
test('an optional material outside a paid product, a product with only optional materials, and a rename hint for a missing material each stop the release check', async () => {
  const giftOptional = text => replaceOnce(text, "{ id: 'learning-flow', title: '学習の進め方', filename: 'typescript-learning-flow.pdf', type: 'application/pdf', group: 'intro' }", "{ id: 'learning-flow', title: '学習の進め方', filename: 'typescript-learning-flow.pdf', type: 'application/pdf', group: 'intro', optional: true }");
  await withManifest(giftOptional, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Optional material outside a product/);
  });
  // 名前の変え方の案内を外してから、ソースの ZIP も optional にする（案内の検査より先にこの規則で止まる事を見る）。
  const onlyOptional = text => replaceOnce(replaceOnce(text, " filenameHint: { filename: 'redmine-clone.zip', day: 'Day 3', material: 'source-zip' },", ''), "{ id: 'source-zip', title: 'ソースコード一式（Day0 の骨格）', filename: 'redmine-clone-source.zip', type: 'application/zip', group: 'bundle' }", "{ id: 'source-zip', title: 'ソースコード一式（Day0 の骨格）', filename: 'redmine-clone-source.zip', type: 'application/zip', group: 'bundle', optional: true }");
  await withManifest(onlyOptional, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Product without a required material/);
  });
  // textbook 以外の教材は optional にできない。必ず出す教材（ソースの ZIP）は残したまま、textbook 以外の optional を足す。
  const optionalExtra = text => replaceOnce(text, "filename: 'task-app-curriculum.zip', type: 'application/zip', group: 'bundle' }", "filename: 'task-app-curriculum.zip', type: 'application/zip', group: 'bundle' }, { id: 'extra-zip', title: 'おまけ', filename: 'task-app-extra.zip', type: 'application/zip', group: 'bundle', optional: true }");
  await withManifest(optionalExtra, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Optional material must be the textbook/);
    assert.doesNotMatch(result.stderr, /Product without a required material/);
  });
  // ソースの ZIP そのものを optional にした時（textbook も optional なので、必ず出す教材が無くなる）は、先にその規則で止まる。
  const optionalSource = text => replaceOnce(replaceOnce(text, " filenameHint: { filename: 'task-app-curriculum-v1.1.zip', day: 'Day 1', material: 'source-zip' },", ''), "filename: 'task-app-curriculum.zip', type: 'application/zip', group: 'bundle' }", "filename: 'task-app-curriculum.zip', type: 'application/zip', group: 'bundle', optional: true }");
  await withManifest(optionalSource, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Product without a required material/);
  });
  const hintToTextbook = text => replaceOnce(text, "day: 'Day 3', material: 'source-zip'", "day: 'Day 3', material: 'textbook'");
  await withManifest(hintToTextbook, result => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid release manifest/);
  });
});

// presentCollection: R2 の head の結果が何であっても、必ず出す教材は残り、教材本文は中身がある時だけ残る。
async function presentCase(head) {
  const source = stripTypeScriptTypes(await readFile(manifestPath, 'utf8'));
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const course = manifest.collections.find(c => c.id === 'redmine-clone');
  const keys = [];
  const shown = await manifest.presentCollection(course, key => { keys.push(key); return head(key); });
  return { ids: shown.materials.map(m => m.id), keys, textbookKey: `releases/redmine-clone/${manifest.redmineCloneRelease.version}/redmine-clone-textbook.zip` };
}
for (const [name, head, textbook] of [
  ['rejects', () => Promise.reject(new Error('R2 down')), false],
  ['throws synchronously', () => { throw new Error('R2 down'); }, false],
  ['returns null', async () => null, false],
  ['returns size 0', async () => ({ size: 0 }), false],
  ['returns size > 0', async () => ({ size: 5 }), true],
]) {
  test(`presentCollection keeps the source ZIP and ${textbook ? 'keeps' : 'drops'} the textbook when head ${name}`, async () => {
    const { ids, keys, textbookKey } = await presentCase(head);
    assert.deepEqual(ids, textbook ? ['textbook', 'source-zip'] : ['source-zip']);
    assert.deepEqual(keys, [textbookKey]);
  });
}
