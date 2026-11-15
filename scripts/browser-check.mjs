// Explicit opt-in local visual verification. Reuse an installed official Playwright;
// this script never downloads a browser or opens a personal browser profile.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runtime, localPhrase } from './runtime.mjs';
import { seed, fixtures, version } from './fixtures.mjs';

const load = createRequire(import.meta.url);
// Without the two variables, look for an already-installed Playwright in this repository,
// the global npm folder and the npx cache, and use the Chromium that matches it.
function installedPlaywright() {
  const roots = [resolve('node_modules'), join(dirname(dirname(process.execPath)), 'lib', 'node_modules'), join(dirname(process.execPath), 'node_modules')];
  const npx = join(homedir(), '.npm', '_npx');
  const cached = existsSync(npx) ? readdirSync(npx).map(d => join(npx, d, 'node_modules')) : [];
  const found = [];
  for (const [order, root] of [...roots, ...cached].entries()) {
    for (const name of ['playwright-core', 'playwright']) {
      const dir = join(root, name);
      if (!existsSync(join(dir, 'package.json'))) continue;
      try {
        const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
        const browser = load(dir).chromium.executablePath();
        if (browser && existsSync(browser)) found.push({ order, dir, version, browser });
      } catch { /* Not a usable Playwright package. */ }
    }
  }
  const newer = (a, b) => b.version.localeCompare(a.version, undefined, { numeric: true });
  return found.sort((a, b) => (a.order < roots.length || b.order < roots.length ? a.order - b.order : newer(a, b)))[0];
}
let playwrightPackage = process.env.COURSE_PLAYWRIGHT_PACKAGE;
let executablePath = process.env.COURSE_BROWSER_EXECUTABLE;
if (!playwrightPackage || !executablePath) {
  const found = installedPlaywright();
  if (!found && !playwrightPackage) {
    console.error('No installed Playwright with its Chromium was found. This check never downloads browsers.\nInstall them yourself, for example: npm install --no-save playwright@1.64.1 && npx playwright install chromium\nOr set COURSE_PLAYWRIGHT_PACKAGE and COURSE_BROWSER_EXECUTABLE to already-installed official tooling.');
    process.exit(1);
  }
  playwrightPackage ||= found.dir;
  executablePath ||= found?.browser || load(playwrightPackage).chromium.executablePath();
}
if (!existsSync(executablePath)) {
  console.error(`Chromium was not found at ${executablePath}. Install it with the matching Playwright (npx playwright install chromium) or set COURSE_BROWSER_EXECUTABLE.`);
  process.exit(1);
}
console.log(JSON.stringify({ event: 'browser-tooling', playwright: playwrightPackage, chromium: executablePath }));
const { chromium } = load(playwrightPackage);
const origin = 'http://127.0.0.1:8813';
const folder = resolve('artifacts/visual');
await mkdir(folder, { recursive: true });
const checks = [];
let mf, browserServer, browser, context, page;
const deadline = setTimeout(() => {
  console.error('Local browser verification exceeded its 60-second bound.');
  process.exitCode = 1;
  void Promise.allSettled([page?.close(), context?.close(), browser?.close(), browserServer?.close(), mf?.dispose()]);
}, 60_000);
deadline.unref();
const screenshot = name => page.screenshot({ path: resolve(folder, `${name}.png`), fullPage: true, timeout: 8000 });
const checkpoint = message => { checks.push(message); console.log(message); };
async function noOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}
async function enter() {
  await page.goto(origin);
  await page.getByLabel('アクセス用の合言葉').fill(localPhrase);
  await page.getByRole('button', { name: '教材ページを開く' }).click();
  await page.waitForURL(origin + '/library');
}
try {
  mf = runtime({ origin, port: 8813, ipLimit: 1000, totalLimit: 1000 });
  await mf.ready;
  await seed(mf);
  browserServer = await chromium.launchServer({ headless: true, executablePath, timeout: 15000, args: ['--renderer-process-limit=1', '--disable-background-networking'] });
  browser = await chromium.connect(browserServer.wsEndpoint(), { timeout: 15000 });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP', reducedMotion: 'reduce', acceptDownloads: true });
  page = await context.newPage();
  page.setDefaultTimeout(8000);
  const scriptErrors = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/login') {
      const h = request.headers();
      console.log(JSON.stringify({ event: 'login-request-policy', origin: h.origin, fetchSite: h['sec-fetch-site'] }));
    }
  });
  page.on('pageerror', e => scriptErrors.push(e.message));
  await page.goto(origin);
  await noOverflow();
  await screenshot('desktop-entry');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'A');
  await page.keyboard.press('Tab');
  assert.equal(await page.getByLabel('アクセス用の合言葉').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: '教材ページを開く' }).evaluate(el => el === document.activeElement), true);
  await screenshot('desktop-keyboard-focus');
  checkpoint('Keyboard: brand → labelled phrase field → visible submit focus.');

  await page.getByLabel('アクセス用の合言葉').fill('wrong-synthetic-phrase');
  await page.getByRole('button', { name: '教材ページを開く' }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /合言葉を確認/);
  await screenshot('desktop-wrong-phrase');
  checkpoint('Incorrect phrase: accessible inline error, no authentication.');

  let releaseLogin, reachedLogin;
  const gate = new Promise(resolveGate => { releaseLogin = resolveGate; });
  const held = new Promise(resolveHeld => { reachedLogin = resolveHeld; });
  await page.route('**/login', async route => { reachedLogin(); await gate; await route.continue(); });
  // While the submission is held, Chromium answers no screenshot or DOM query, so the submitting state
  // is recorded at the moment of sending and read after the release. The hold is released even on failure.
  try {
    await page.waitForLoadState('load');
    await page.getByLabel('アクセス用の合言葉').fill(localPhrase);
    await page.evaluate(() => {
      const form = document.querySelector('form[action="/login"]');
      form.addEventListener('submit', () => {
        const button = form.querySelector('button');
        sessionStorage.setItem('submitting', JSON.stringify({ disabled: button.disabled, busy: form.getAttribute('aria-busy'), label: button.textContent }));
      });
    });
    await page.getByRole('button', { name: '教材ページを開く' }).click({ noWaitAfter: true });
    await Promise.race([held, new Promise((_, reject) => setTimeout(() => reject(new Error('The login submission was not sent.')), 8000))]);
  } finally { releaseLogin(); }
  await page.waitForURL(origin + '/library');
  await page.unroute('**/login');
  const submitting = JSON.parse(await page.evaluate(() => sessionStorage.getItem('submitting')) || '{}');
  assert.equal(submitting.disabled, true);
  assert.equal(submitting.busy, 'true');
  assert.match(submitting.label, /確認しています…/);
  await noOverflow();
  await screenshot('desktop-catalogue');
  assert.equal(await page.getByRole('link', { name: /Taskapp/ }).count(), 0);
  assert.match(await page.locator('main').innerText(), /アンケート/);
  checkpoint('Submitting: button disabled and aria-busy set, then successful catalogue navigation.');

  await page.getByRole('link', { name: 'ダミー教材を見る' }).click();
  await page.waitForURL(origin + '/courses/typescript');
  assert.equal(await page.locator('a[href^="/download/typescript/"]').count(), 21);
  await noOverflow();
  await screenshot('desktop-typescript');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: '第1章' }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'typescript-chapter-01.pdf');
  const downloadPath = resolve(folder, 'downloaded-synthetic-chapter-01.pdf');
  await download.saveAs(downloadPath);
  assert.deepEqual(await readFile(downloadPath), fixtures().get('typescript-chapter-01.pdf'));
  checkpoint('Download: real browser attachment has expected filename and exact synthetic PDF bytes.');

  await page.getByRole('link', { name: '保存と閲覧の手順を見る' }).click();
  await page.getByRole('heading', { name: '教材を手元に。' }).waitFor();
  await screenshot('desktop-guide');
  await page.getByRole('link', { name: 'プレゼント一覧へ戻る' }).click();
  await page.getByRole('link', { name: 'ダミー教材を見る' }).click();
  const bundleEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'ダミー教材をまとめて保存' }).click();
  const bundle = await bundleEvent;
  assert.equal(bundle.suggestedFilename(), 'typescript-all-materials.zip');
  const bundlePath = resolve(folder, 'downloaded-synthetic-bundle.zip');
  await bundle.saveAs(bundlePath);
  assert.deepEqual(await readFile(bundlePath), fixtures().get('typescript-all-materials.zip'));
  checkpoint('Guide and bundle: navigation returns to the gift; ZIP attachment has the expected filename and bytes.');

  const bucket = await mf.getR2Bucket('MATERIALS');
  const key = `releases/typescript/${version}/typescript-exercise-10.pdf`;
  await bucket.delete(key);
  await page.getByRole('link', { name: '練習問題 10' }).click();
  await page.getByRole('heading', { name: 'この教材はただいま準備中です' }).waitFor();
  await screenshot('desktop-missing-download');
  await bucket.put(key, fixtures().get('typescript-exercise-10.pdf'));
  const productDenied = await context.request.get(origin + '/download/taskapp/book-01');
  assert.equal(productDenied.status(), 404);
  checkpoint('Taskapp product download is denied with valid survey-gift authentication.');
  checkpoint('Missing download: useful authenticated error page instead of a broken attachment.');

  await bucket.put(key, new Uint8Array());
  try {
    await page.goto(origin + '/courses/typescript');
    const emptyResponse = page.waitForResponse(origin + '/download/typescript/exercise-10');
    await page.getByRole('link', { name: '練習問題 10' }).click();
    const empty = await emptyResponse;
    assert.equal(empty.status(), 503);
    assert.equal(empty.headers()['content-disposition'], undefined);
    await page.getByRole('heading', { name: 'この教材はただいま準備中です' }).waitFor();
    await screenshot('desktop-empty-download');
  } finally { await bucket.put(key, fixtures().get('typescript-exercise-10.pdf')); }
  checkpoint('Empty download: preparing page with503 and no attachment; synthetic source restored.');

  await page.goto(origin + '/status');
  assert.equal(await page.locator('a[href^="/download/"]').count(), 0);
  await screenshot('desktop-pending-course');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/library');
  await noOverflow();
  for (const title of ['TypeScript教材', 'Redmineクローン教材']) {
    assert.equal(await page.locator('.course-card').filter({ has: page.getByRole('heading', { name: title }) }).evaluate(card => {
      const bounds = card.getBoundingClientRect();
      const body = card.querySelector('.course-body').getBoundingClientRect();
      const action = card.querySelector('.course-action').getBoundingClientRect();
      return body.top >= bounds.top && body.bottom <= bounds.bottom + 1 && action.bottom <= bounds.bottom + 1;
    }), true, `Mobile ${title} title, description and action must fit inside the card without clipping`);
  }
  await screenshot('mobile-catalogue');
  await page.getByRole('link', { name: 'ダミー教材を見る' }).click();
  await noOverflow();
  await screenshot('mobile-typescript');
  await page.goto(origin + '/library');
  await page.getByRole('button', { name: 'ライブラリを閉じる' }).click();
  await page.waitForURL(origin + '/closed');
  assert.match(await page.getByRole('status').innerText(), /教材ページを閉じました/);
  await screenshot('mobile-closed');
  await page.getByRole('link', { name: '入口へ戻る' }).click();
  await page.waitForURL(origin + '/');
  await screenshot('mobile-entry');
  await noOverflow();
  checkpoint('Mobile 390×844: entry, catalogue and 21-file TypeScript gift have no horizontal overflow.');
  for (let i = 0; i < 3; i++) {
    await enter();
    await page.getByRole('button', { name: 'ライブラリを閉じる' }).click();
    await page.waitForURL(origin + '/closed');
    const denied = await context.request.get(origin + '/library');
    assert.equal(denied.status(), 401);
  }
  checkpoint('Repeated login/logout: 3 additional full cycles; library denied after each logout.');

  for (const options of [{ method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }]) {
    const res = await context.request.fetch(origin + '/download/typescript/chapter-01', options);
    assert.equal(res.status(), 401);
    assert.match(res.headers()['cache-control'], /private.*no-store/);
    assert.equal(res.headers()['content-disposition'], undefined);
  }
  checkpoint('Anonymous direct HEAD and Range: 401, private no-store, no attachment metadata.');
  assert.deepEqual(scriptErrors, []);
  checkpoint('No uncaught page script errors. One temporary browser, context and page used.');
  await writeFile(resolve(folder, 'checks.json'), JSON.stringify({ source: 'synthetic local runtime', viewport: ['1440x1000', '390x844'], checks, screenshots: 'actual Chromium pixels; see PNG files', visualReview: 'pending human/agent pixel inspection' }, null, 2) + '\n');
} catch (e) {
  if (page && !page.isClosed()) {
    await screenshot('failure-state').catch(() => {});
    console.log(JSON.stringify({ failedUrl: page.url(), headings: await page.locator('h1').allTextContents() }));
  }
  throw e;
} finally {
  clearTimeout(deadline);
  await page?.close().catch(() => {});
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await browserServer?.close().catch(() => {});
  await mf?.dispose().catch(() => {});
  console.log('Closed only the temporary page, context, browser server and local test runtime created by this script.');
}
