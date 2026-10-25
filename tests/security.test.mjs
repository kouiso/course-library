import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runtime, localPhrase } from '../scripts/runtime.mjs';
import { seed, fixtures, version } from '../scripts/fixtures.mjs';

const origin = 'https://course.example';
const secret = 'synthetic-only-test-signing-key-000000000000000000000';
let mf;
let ip = 0;
before(async () => { mf = runtime({ bindings: { SESSION_SECRET: secret }, totalLimit: 1000 }); await mf.ready; await seed(mf); });
after(async () => { await mf?.dispose(); });
const req = (path, opts = {}) => mf.dispatchFetch(origin + path, { redirect: 'manual', ...opts });
function headerCookie(res, name) { return res.headers.getSetCookie().find(c => c.startsWith(name + '='))?.split(';')[0] || ''; }
async function loginAttempt(phrase = localPhrase, options = {}) {
  const entry = await req('/');
  const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const cookie = headerCookie(entry, '__Host-taskapp_login');
  const res = await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `192.0.2.${++ip}`, Cookie: cookie, ...options.headers }, body: new URLSearchParams({ csrf, phrase, ...options.form }) });
  return { res, cookie: headerCookie(res, '__Host-taskapp_session'), csrf };
}
function signed(purpose, iat, exp) {
  const body = Buffer.from(JSON.stringify({ purpose, iat, exp, nonce: '00000000-0000-4000-a000-000000000000' })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
function noCache(res) {
  assert.match(res.headers.get('Cache-Control'), /private.*no-store/);
  assert.equal(res.headers.get('CDN-Cache-Control'), 'no-store');
  assert.equal(res.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  assert.match(res.headers.get('Vary'), /Cookie/);
}
test('anonymous GET, HEAD, Range and conditional requests never download', async () => {
  for (const options of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }, { headers: { 'If-None-Match': '*' } }]) {
    const res = await req('/download/taskapp/book-01', options);
    assert.equal(res.status, 401); noCache(res); assert.equal(res.headers.get('Content-Disposition'), null);
    if (options.method === 'HEAD') assert.equal(await res.text(), '');
  }
});
test('wrong phrase and tampered session fail', async () => {
  assert.equal((await loginAttempt('wrong')).res.status, 401);
  const { cookie } = await loginAttempt();
  assert.equal((await req('/download/taskapp/book-01', { headers: { Cookie: cookie + 'tampered' } })).status, 401);
});
test('expired, future, overlong and wrong-purpose signed sessions fail', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const token of [signed('session', now - 100, now - 1), signed('session', now + 100, now + 200), signed('session', now, now + 14401), signed('login', now, now + 100)]) {
    const res = await req('/download/taskapp/book-01', { headers: { Cookie: `__Host-taskapp_session=${token}` } });
    assert.equal(res.status, 401); noCache(res);
  }
});
test('successful login rotates session, uses secure cookies and fixed redirect', async () => {
  const a = await loginAttempt(), b = await loginAttempt();
  assert.equal(a.res.status, 303); assert.equal(a.res.headers.get('Location'), '/library');
  assert.notEqual(a.cookie, b.cookie);
  const header = a.res.headers.getSetCookie().find(c => c.startsWith('__Host-taskapp_session='));
  for (const attr of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=14400']) assert.ok(header.includes(attr));
  assert.ok(a.res.headers.getSetCookie().some(c => c.startsWith('__Host-taskapp_login=') && c.includes('Max-Age=0')));
  noCache(a.res);
});
test('synthetic downloads match all 40 original files, including the 36-book ZIP', async () => {
  const { cookie } = await loginAttempt();
  const files = fixtures();
  for (const [name, bytes] of files) {
    const id = name === 'taskapp-introduction.pdf' ? 'introduction' : name === 'taskapp-books-01-36.zip' ? 'books-bundle' : name.replace('taskapp-', '').replace(/\.(pdf|zip)$/, '');
    const res = await req('/download/taskapp/' + id, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200, id); noCache(res);
    assert.equal(res.headers.get('Content-Disposition'), `attachment; filename="${name}"`);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
  }
  assert.equal(files.size, 40);
});
test('authenticated HEAD and Range return correct metadata and bytes', async () => {
  const { cookie } = await loginAttempt();
  const bytes = fixtures().get('taskapp-book-01.pdf');
  const head = await req('/download/taskapp/book-01', { method: 'HEAD', headers: { Cookie: cookie } });
  assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('Content-Length'), String(bytes.length)); noCache(head);
  for (const [range, expected] of [['bytes=0-9', bytes.subarray(0, 10)], ['bytes=-10', bytes.subarray(-10)], ['bytes=10-', bytes.subarray(10)]]) {
    const res = await req('/download/taskapp/book-01', { headers: { Cookie: cookie, Range: range } });
    assert.equal(res.status, 206); assert.match(res.headers.get('Content-Range'), /^bytes /); assert.deepEqual(Buffer.from(await res.arrayBuffer()), expected); noCache(res);
  }
});
test('malformed and unsatisfiable ranges fail; mismatching If-Range gets whole file', async () => {
  const { cookie } = await loginAttempt();
  for (const range of ['bytes=999999-', 'bytes=2-1', 'bytes=0-1,3-4', 'bytes=-0', 'bytes=-', 'bytes=999999999999999999999-']) {
    const res = await req('/download/taskapp/book-01', { headers: { Cookie: cookie, Range: range } });
    assert.equal(res.status, 416, range); noCache(res);
  }
  assert.equal((await req('/download/taskapp/book-01', { headers: { Cookie: cookie, Range: 'bytes=0-9', 'If-Range': '"other"' } })).status, 200);
});
test('valid response never authenticates a later anonymous request to same URL', async () => {
  const { cookie } = await loginAttempt();
  noCache(await req('/library', { headers: { Cookie: cookie } }));
  assert.equal((await req('/library')).status, 401);
  noCache(await req('/download/taskapp/book-01', { headers: { Cookie: cookie } }));
  const anonymous = await req('/download/taskapp/book-01');
  assert.equal(anonymous.status, 401); noCache(anonymous);
});
test('filename and encoded path traversal, injection, unknown IDs are rejected', async () => {
  const { cookie } = await loginAttempt();
  for (const id of ['..%2Fbook-01', '%2e%2e%2fsecret', '%5csecret', 'book-01.pdf', 'book-01%00', 'book-01%0d%0aX-Test:x', 'https:%2f%2fevil.example', 'missing', 'book-01/extra']) {
    const res = await req('/download/taskapp/' + id, { headers: { Cookie: cookie } });
    assert.equal(res.status, 404, id); assert.equal(res.headers.get('Location'), null);
  }
});
test('login rejects missing/mismatched CSRF, cross-site origins and oversized forms', async () => {
  assert.equal((await loginAttempt(localPhrase, { form: { csrf: 'fake' } })).res.status, 403);
  assert.equal((await loginAttempt(localPhrase, { headers: { Origin: 'https://evil.example' } })).res.status, 403);
  assert.equal((await loginAttempt(localPhrase, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).res.status, 403);
  assert.equal((await loginAttempt(localPhrase, { form: { padding: 'x'.repeat(5000) } })).res.status, 403);
  assert.equal((await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.200' }, body: new URLSearchParams({ phrase: localPhrase, csrf: 'none' }) })).status, 403);
});
test('expired login CSRF and duplicate form/cookie values are rejected', async () => {
  const now = Math.floor(Date.now() / 1000), token = signed('login', now - 700, now - 100);
  const res = await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.201', Cookie: `__Host-taskapp_login=${token}` }, body: new URLSearchParams({ csrf: token, phrase: localPhrase }) });
  assert.equal(res.status, 403);
  const { cookie } = await loginAttempt();
  assert.equal((await req('/library', { headers: { Cookie: cookie + '; ' + cookie } })).status, 401);
  const entry = await req('/'); const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const body = new URLSearchParams({ csrf, phrase: localPhrase }); body.append('phrase', 'other');
  assert.equal((await req('/login', { method: 'POST', headers: { Origin: origin, Cookie: headerCookie(entry, '__Host-taskapp_login'), 'CF-Connecting-IP': '192.0.2.202' }, body })).status, 403);
});
test('IP brute-force limit is enforced by the actual platform binding', async () => {
  const entry = await req('/'); const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const cookie = headerCookie(entry, '__Host-taskapp_login');
  for (let i = 0; i < 6; i++) {
    const res = await req('/login', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'CF-Connecting-IP': '198.51.100.1' }, body: new URLSearchParams({ csrf, phrase: 'wrong' }) });
    assert.equal(res.status, i < 5 ? 401 : 429);
    if (i === 5) assert.equal(res.headers.get('Retry-After'), '60');
  }
});
test('logout requires session-bound CSRF and clears the browser cookie', async () => {
  const { cookie } = await loginAttempt();
  const library = await req('/library', { headers: { Cookie: cookie } });
  const csrf = /name="csrf" value="([^"]+)"/.exec(await library.text())[1];
  assert.equal((await req('/logout', { headers: { Cookie: cookie } })).status, 404);
  for (const value of ['bad', csrf]) {
    const res = await req('/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: new URLSearchParams({ csrf: value }) });
    assert.equal(res.status, value === 'bad' ? 403 : 303);
    if (value === csrf) assert.match(res.headers.get('Set-Cookie'), /Max-Age=0/);
  }
});
test('fixed redirects ignore user-controlled next URL; unexpected hosts are refused', async () => {
  const { cookie } = await loginAttempt();
  const res = await req('/?next=https://evil.example', { headers: { Cookie: cookie } });
  assert.equal(res.headers.get('Location'), '/library');
  assert.equal((await mf.dispatchFetch('https://evil.example/library', { headers: { Cookie: cookie } })).status, 421);
});
test('missing/short secrets and invalid production origin fail closed', async () => {
  for (const bindings of [{ SESSION_SECRET: '' }, { SESSION_SECRET: 'short' }, { ACCESS_PHRASE_SHA256: '' }, { APP_ORIGIN: 'https://setup-required.invalid' }, { APP_ORIGIN: 'http://course.example' }]) {
    const instance = runtime({ bindings });
    try { const res = await instance.dispatchFetch(origin + '/download/taskapp/book-01'); assert.equal(res.status, 503); noCache(res); }
    finally { await instance.dispose(); }
  }
});
test('release manifest validates all filenames and rejects unsafe filenames', async () => {
  const source = await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8');
  const js = stripTypeScriptTypes(source);
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  manifest.validateManifest(); assert.equal(manifest.release.version, version); assert.equal(manifest.materials.length, 40);
  const base = manifest.materials[0];
  for (const filename of ['../secret.pdf', 'bad\r\nname.pdf', '/tmp/file.pdf', 'taskapp-a.pdf.exe', 'taskapp-a.zip/../secret', 'taskapp-a".pdf']) assert.equal(manifest.validMaterial({ ...base, filename }), false);
});
test('security headers and mobile semantic page structure are present', async () => {
  const entry = await req('/'), html = await entry.text();
  assert.match(html, /lang="ja"/); assert.match(html, /name="viewport"/); assert.match(html, /<label for="phrase">/);
  assert.match(entry.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/); assert.equal(entry.headers.get('Referrer-Policy'), 'same-origin');
  assert.equal(entry.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  noCache(entry);
});
test('course collection routes stay distinct and pending TypeScript exposes no downloads', async () => {
  const { cookie } = await loginAttempt();
  const catalogue = await (await req('/library', { headers: { Cookie: cookie } })).text();
  assert.match(catalogue, /href="\/courses\/taskapp"/); assert.match(catalogue, /href="\/courses\/typescript"/);
  const pending = await (await req('/courses/typescript', { headers: { Cookie: cookie } })).text();
  assert.match(pending, /ダウンロードできるファイルはありません/); assert.doesNotMatch(pending, /href="\/download\//);
  const taskapp = await (await req('/courses/taskapp', { headers: { Cookie: cookie } })).text();
  assert.match(taskapp, /0\.1\.0-synthetic/); assert.equal((taskapp.match(/href="\/download\/taskapp\//g) || []).length, 40);
  assert.equal((await req('/download/typescript/book-01', { headers: { Cookie: cookie } })).status, 404);
});
test('aggregate login limiter rejects attempts spread across IP addresses', async () => {
  const instance = runtime({ totalLimit: 1, bindings: { SESSION_SECRET: secret } });
  try {
    const now = Math.floor(Date.now() / 1000), csrf = signed('login', now, now + 600);
    for (let i = 0; i < 2; i++) {
      const res = await instance.dispatchFetch(origin + '/login', { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'CF-Connecting-IP': `203.0.113.${i + 1}`, Cookie: `__Host-taskapp_login=${csrf}` }, body: new URLSearchParams({ csrf, phrase: 'wrong' }) });
      assert.equal(res.status, i === 0 ? 401 : 429);
    }
  } finally { await instance.dispose(); }
});
test('missing release file has an authenticated empty state and no metadata leak', async () => {
  const { cookie } = await loginAttempt();
  const bucket = await mf.getR2Bucket('MATERIALS');
  const key = `releases/taskapp/${version}/taskapp-starter.zip`;
  await bucket.delete(key);
  try {
    const res = await req('/download/taskapp/starter', { headers: { Cookie: cookie } });
    assert.equal(res.status, 404); noCache(res); assert.match(await res.text(), /準備中/);
    assert.equal((await req('/download/taskapp/starter')).status, 401);
  } finally { await bucket.put(key, fixtures().get('taskapp-starter.zip')); }
});
test('pending, preview and published labels are distinct; verification copy belongs to the release', async () => {
  const manifestSource = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifestUrl = 'data:text/javascript;base64,' + Buffer.from(manifestSource).toString('base64');
  const manifest = await import(manifestUrl);
  const viewSource = stripTypeScriptTypes(await readFile(new URL('../src/views.ts', import.meta.url), 'utf8')).replace("from './manifest'", `from ${JSON.stringify(manifestUrl)}`);
  const views = await import('data:text/javascript;base64,' + Buffer.from(viewSource).toString('base64'));
  assert.deepEqual(['pending', 'preview', 'published'].map(manifest.collectionStatusLabel), ['準備中', '開発プレビュー', '公開中']);
  const course = manifest.collections[0];
  const originalStatus = course.status, originalRelease = course.release;
  try {
    course.status = 'published';
    course.release = { ...course.release, synthetic: false, verification: { delivery: '配送の確認記録A', materials: '教材の確認記録B', platforms: '環境の確認記録C' } };
    const catalogue = views.catalogue('synthetic-csrf');
    assert.match(catalogue, />公開中</); assert.doesNotMatch(catalogue, /開発プレビュー/);
    const html = views.library('synthetic-csrf', course);
    for (const value of ['配送の確認記録A', '教材の確認記録B', '環境の確認記録C']) assert.ok(html.includes(value));
    assert.doesNotMatch(html, /教材コードはダミー|開発プレビュー：/);
    assert.doesNotMatch(views.guide(), /教材コードはダミー|配布サイトはMac/);
  } finally { course.status = originalStatus; course.release = originalRelease; }
});
