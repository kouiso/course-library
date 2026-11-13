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
  assert.match(result.stdout, /^Note: the survey gift is not approved and stays closed/m);
  assert.doesNotMatch(result.stderr, /Release blocked/);
});

test('release check blocks when the survey gift is unapproved and no paid product is ready', async () => {
  const edit = text => replaceOnce(text, 'export const productPolicy = {\n  distributionApproved: true,', 'export const productPolicy = {\n  distributionApproved: false,');
  await withManifest(edit, result => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^survey-gift: blocked typescript /m);
    assert.match(result.stdout, /^paid-product: blocked redmine-clone /m);
    assert.match(result.stderr, /^Release blocked: a paid product is not ready\./m);
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

test('a blocked paid product stops the release even when the survey gift is approved', async () => {
  const edit = text => replaceOnce(approveGift(text), 'export const productPolicy = {\n  distributionApproved: true,', 'export const productPolicy = {\n  distributionApproved: false,');
  await withManifest(edit, result => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^survey-gift: ready typescript \S+$/m);
    assert.match(result.stdout, /^paid-product: blocked redmine-clone \S+ - productPolicy\.distributionApproved is false$/m);
    assert.match(result.stderr, /^Release blocked: a paid product is not ready\./m);
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
