import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runtime, localPhrase, basicHeader, digest } from '../scripts/runtime.mjs';
import { seed, fixtures, version, productVersion } from '../scripts/fixtures.mjs';

// views.ts reads the app version from package.json; data: modules need it as a module.
const packageUrl = 'data:text/javascript,' + encodeURIComponent(`export const version = ${JSON.stringify(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version)};`);
const origin = 'http://127.0.0.1:8813';
const secret = 'synthetic-only-test-signing-key-000000000000000000000';
const productPhrase = 'synthetic-product-phrase-only';
let mf;
let ip = 0;
before(async () => { mf = runtime({ origin, bindings: { SESSION_SECRET: secret, ACCESS_PHRASE_SHA256_REDMINE_CLONE: digest(productPhrase) }, totalLimit: 1000 }); await mf.ready; await seed(mf); });
after(async () => { await mf?.dispose(); });
const req = (path, opts = {}) => mf.dispatchFetch(origin + path, { redirect: 'manual', ...opts });
function headerCookie(res, name) { return res.headers.getSetCookie().find(c => c.startsWith(name + '='))?.split(';')[0] || ''; }
async function loginAttempt(phrase = localPhrase, options = {}) {
  const entry = await req('/');
  const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const cookie = headerCookie(entry, 'local_course_login');
  const res = await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `192.0.2.${++ip}`, Cookie: cookie, ...options.headers }, body: new URLSearchParams({ csrf, phrase, ...options.form }) });
  return { res, cookie: headerCookie(res, 'local_course_session'), csrf };
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
    const res = await req('/download/typescript/chapter-01', options);
    assert.equal(res.status, 401); noCache(res); assert.equal(res.headers.get('Content-Disposition'), null);
    if (options.method === 'HEAD') assert.equal(await res.text(), '');
  }
});
test('wrong phrase and tampered session fail', async () => {
  assert.equal((await loginAttempt('wrong')).res.status, 401);
  const { cookie } = await loginAttempt();
  assert.equal((await req('/download/typescript/chapter-01', { headers: { Cookie: cookie + 'tampered' } })).status, 401);
});
test('expired, future, overlong and wrong-purpose signed sessions fail', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const token of [signed('session', now - 100, now - 1), signed('session', now + 100, now + 200), signed('session', now, now + 14401), signed('login', now, now + 100)]) {
    const res = await req('/download/typescript/chapter-01', { headers: { Cookie: `local_course_session=${token}` } });
    assert.notEqual(res.status, 200); noCache(res);
  }
});
test('a session without unlocked collections is locked out of every download', async () => {
  const now = Math.floor(Date.now() / 1000);
  const res = await req('/download/typescript/chapter-01', { headers: { Cookie: `local_course_session=${signed('session', now, now + 100)}` } });
  assert.equal(res.status, 404);
});
test('a session issued a few seconds ahead of the worker clock is still accepted', async () => {
  const now = Math.floor(Date.now() / 1000);
  const res = await req('/download/typescript/chapter-01', { headers: { Cookie: `local_course_session=${signed('session', now + 5, now + 100)}` } });
  assert.equal(res.status, 404);
});
test('the product phrase unlocks only its product, not the survey gift', async () => {
  const { res, cookie } = await loginAttempt(productPhrase);
  assert.equal(res.status, 303);
  const course = await req('/courses/redmine-clone', { headers: { Cookie: cookie } });
  assert.equal(course.status, 200);
  const productHtml = await course.text();
  assert.match(productHtml, /ソースコード一式/);
  assert.ok(productHtml.includes(`redmine-clone-source-v${productVersion}.zip`));
  assert.match(productHtml, /Day 3 の手順は <code>redmine-clone\.zip<\/code> という名前で書かれています。保存したファイルの名前を <code>redmine-clone\.zip<\/code> に変えてから、Day 3 の手順どおりに進めてください。/);
  assert.equal((await req('/courses/typescript', { headers: { Cookie: cookie } })).status, 403);
  assert.equal((await req('/download/typescript/chapter-01', { headers: { Cookie: cookie } })).status, 404);
  // 承認済みの商品は、実オブジェクトが置かれていればバイトごと取り出せる。
  const bucket = await mf.getR2Bucket('MATERIALS');
  await bucket.put(`releases/redmine-clone/${productVersion}/redmine-clone-source.zip`, 'PRODUCT ZIP BYTES');
  const dl = await req('/download/redmine-clone/source-zip', { headers: { Cookie: cookie } });
  assert.equal(dl.status, 200);
  assert.equal(dl.headers.get('Content-Disposition'), `attachment; filename="redmine-clone-source-v${productVersion}.zip"`);
  assert.equal(await dl.text(), 'PRODUCT ZIP BYTES');
});
test('buyers read product wording in the library hero and the product footer; entry, header and footer keep the design copy', async () => {
  const entry = await (await req('/')).text();
  assert.match(entry, /<title>プレゼント教材を受け取る \|/); assert.match(entry, /<div class="eyebrow">A GIFT FOR SURVEY RESPONDENTS<\/div>/);
  assert.match(entry, /<h2>TypeScript教材を受け取る<\/h2>/); assert.match(entry, /アンケートへのご協力、ありがとうございます。/);
  assert.match(entry, /<span class="brand-note">アンケート回答者限定<\/span>/);
  assert.match(entry, new RegExp(`<footer>教材ライブラリ · ${version.replaceAll('.', '\\.')}<br><span class="note-long">回答後に届いたご案内のURLをブックマークしてご利用ください。</span>`));
  const { cookie } = await loginAttempt(productPhrase);
  const library = await (await req('/library', { headers: { Cookie: cookie } })).text();
  const product = await (await req('/courses/redmine-clone', { headers: { Cookie: cookie } })).text();
  const hero = /<div class="catalogue-hero">[\s\S]*?<\/p>/.exec(library)[0];
  for (const limited of ['アンケート', 'ご協力', 'FEEDBACK', 'プレゼント', '回答']) assert.ok(!hero.includes(limited), limited);
  assert.match(hero, /<div class="eyebrow">YOUR LIBRARY<\/div><h1>ご購入の教材を、<br>手元に。<\/h1>/); assert.match(library, /<title>教材一覧 \|/);
  // The locked survey gift card carries no survey description for buyers.
  assert.ok(!library.includes('アンケートにお答えいただいた方への無料プレゼントです。'), 'locked gift description');
  assert.match(library, /<h2>TypeScript教材<\/h2><div class="course-meta">/);
  // The product page footer shows the product version, never the gift version.
  const footer = /<footer>[\s\S]*?<\/footer>/.exec(product)[0];
  assert.ok(footer.startsWith(`<footer>教材ライブラリ · ${productVersion}<br>`), footer); assert.ok(!footer.includes(version), 'gift version in product footer');
  assert.match(product, /<span class="brand-note">アンケート回答者限定<\/span>/);
});
test('the product page shows its version, date and the three verification sentences as body text', async () => {
  const manifestSource = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const { productRelease } = await import('data:text/javascript;base64,' + Buffer.from(manifestSource).toString('base64'));
  const { cookie } = await loginAttempt(productPhrase);
  const html = await (await req('/courses/redmine-clone', { headers: { Cookie: cookie } })).text();
  const card = /<h2>ダウンロード<\/h2>[\s\S]*?<\/section>/.exec(html)[0];
  assert.ok(card.includes(`<p class="release-meta">${productRelease.version} · <time datetime="${productRelease.date}">${productRelease.date}</time></p>`));
  const items = [...card.matchAll(/<li>([^<]*)<\/li>/g)].map(m => m[1]);
  assert.deepEqual(items, [productRelease.verification.materials, productRelease.verification.delivery, productRelease.verification.platforms]);
  assert.doesNotMatch(card, /class="muted"/);
});
test('the gift phrase does not unlock paid products', async () => {
  const { cookie } = await loginAttempt(localPhrase);
  assert.equal((await req('/courses/redmine-clone', { headers: { Cookie: cookie } })).status, 403);
  assert.equal((await req('/download/redmine-clone/source-zip', { headers: { Cookie: cookie } })).status, 404);
  assert.equal((await req('/download/typescript/chapter-01', { headers: { Cookie: cookie } })).status, 200);
});
test('gift level phrases open chapters 1..N only, level 10 and the legacy phrase open all, unset levels never match', async () => {
  const levelPhrase = n => `synthetic-gift-level-${n}`;
  const pad = n => String(n).padStart(2, '0');
  const bindings = { SESSION_SECRET: secret };
  for (const n of [1, 3, 9, 10]) bindings[`ACCESS_PHRASE_SHA256_TYPESCRIPT_${pad(n)}`] = digest(levelPhrase(n));
  const instance = runtime({ origin, bindings, totalLimit: 1000 });
  try {
    await instance.ready; await seed(instance);
    const get = (path, cookie, options = {}) => instance.dispatchFetch(origin + path, { redirect: 'manual', ...options, headers: { Cookie: cookie, ...options.headers } });
    async function levelLogin(phrase) {
      const entry = await instance.dispatchFetch(origin + '/');
      assert.equal(entry.status, 200);
      const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
      const res = await instance.dispatchFetch(origin + '/login', { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'CF-Connecting-IP': `198.51.100.${++ip}`, Cookie: headerCookie(entry, 'local_course_login') }, body: new URLSearchParams({ csrf, phrase }) });
      return { res, cookie: headerCookie(res, 'local_course_session') };
    }
    // 未設定の段（2 段目）の合言葉は誰にも合わず、サイト全体も 503 にならない。
    assert.equal((await levelLogin(levelPhrase(2))).res.status, 401);
    for (const n of [1, 3, 9]) {
      const { res, cookie } = await levelLogin(levelPhrase(n));
      assert.equal(res.status, 303, `level ${n}`);
      const ok = await get(`/download/typescript/chapter-${pad(n)}`, cookie);
      assert.equal(ok.status, 200, `chapter ${n}`);
      assert.deepEqual(Buffer.from(await ok.arrayBuffer()), fixtures().get(`typescript-chapter-${pad(n)}.pdf`));
      assert.equal((await get('/download/typescript/learning-flow', cookie)).status, 200);
      for (const options of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }]) {
        const denied = await get(`/download/typescript/chapter-${pad(n + 1)}`, cookie, options);
        assert.equal(denied.status, 403, `chapter ${n + 1}`); noCache(denied); assert.equal(denied.headers.get('Content-Disposition'), null);
      }
      assert.equal((await get('/download/typescript/all-materials', cookie)).status, 403);
      const page = await get('/courses/typescript', cookie);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes(`/download/typescript/chapter-${pad(n)}"`)); assert.ok(!html.includes(`/download/typescript/chapter-${pad(n + 1)}"`));
      assert.equal((await get('/courses/redmine-clone', cookie)).status, 403);
      if (n === 3) {
        assert.equal((await get('/download/typescript/exercise-03', cookie)).status, 200);
        assert.equal((await get('/download/typescript/exercise-04', cookie)).status, 403);
      }
    }
    for (const phrase of [levelPhrase(10), localPhrase]) {
      const { res, cookie } = await levelLogin(phrase);
      assert.equal(res.status, 303);
      for (const [name, bytes] of fixtures()) {
        const id = name.replace('typescript-', '').replace(/\.(pdf|zip)$/, '');
        const dl = await get('/download/typescript/' + id, cookie);
        assert.equal(dl.status, 200, `${phrase === localPhrase ? 'legacy' : 'level 10'} ${id}`);
        assert.deepEqual(Buffer.from(await dl.arrayBuffer()), bytes);
      }
    }
  } finally { await instance.dispose(); }
});
test('session gift levels are signed, bounded and fail closed when missing', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = extra => {
    const body = Buffer.from(JSON.stringify({ purpose: 'session', iat: now, exp: now + 100, nonce: '00000000-0000-4000-a000-000000000000', unlocked: ['typescript'], ...extra })).toString('base64url');
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  for (const giftLevel of [0, 11, -1, 1.5, '10', null]) {
    const res = await req('/download/typescript/chapter-01', { headers: { Cookie: `local_course_session=${token({ giftLevel })}` } });
    assert.equal(res.status, 401, String(giftLevel));
  }
  // 段を持たないセッションはギフトの章を開けない（全部開ける扱いにしない）。
  assert.equal((await req('/download/typescript/chapter-01', { headers: { Cookie: `local_course_session=${token({})}` } })).status, 403);
  assert.equal((await req('/download/typescript/chapter-02', { headers: { Cookie: `local_course_session=${token({ giftLevel: 1 })}` } })).status, 403);
  assert.equal((await req('/download/typescript/chapter-01', { headers: { Cookie: `local_course_session=${token({ giftLevel: 1 })}` } })).status, 200);
});
test('below level 10 the learning page drops the bundle heading, link and ZIP note but keeps the verification sentences; level 10 keeps the whole bundle box', async () => {
  const manifestSource = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const { release } = await import('data:text/javascript;base64,' + Buffer.from(manifestSource).toString('base64'));
  const now = Math.floor(Date.now() / 1000);
  const token = extra => {
    const body = Buffer.from(JSON.stringify({ purpose: 'session', iat: now, exp: now + 100, nonce: '00000000-0000-4000-a000-000000000000', unlocked: ['typescript'], ...extra })).toString('base64url');
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  const bundleCard = async extra => {
    const res = await req('/courses/typescript', { headers: { Cookie: `local_course_session=${token(extra)}` } });
    assert.equal(res.status, 200);
    const card = /<section class="card bundle-card">[\s\S]*?<\/section>/.exec(await res.text())?.[0];
    assert.ok(card, JSON.stringify(extra));
    for (const sentence of Object.values(release.verification)) assert.ok(card.includes(sentence), `${JSON.stringify(extra)} ${sentence}`);
    return card;
  };
  for (const extra of [{}, { giftLevel: 1 }, { giftLevel: 3 }, { giftLevel: 9 }]) {
    const card = await bundleCard(extra);
    assert.doesNotMatch(card, /まとめて手元に|ZIPを展開してから|<a /, JSON.stringify(extra));
  }
  const full = await bundleCard({ giftLevel: 10 });
  assert.ok(full.includes('<h2>まとめて手元に</h2><a class="download bundle" href="/download/typescript/all-materials">'));
  assert.ok(full.includes('<p class="muted">ZIPを展開してからPDFを開いてください。PDF用パスワードは配布時のご案内をご確認ください。</p>'));
});
test('the library gift card and the learning page headings count only what the session level opens', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = extra => {
    const body = Buffer.from(JSON.stringify({ purpose: 'session', iat: now, exp: now + 100, nonce: '00000000-0000-4000-a000-000000000000', unlocked: ['typescript'], ...extra })).toString('base64url');
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  };
  const both = text => `<span class="wide-only">${text}</span><span class="narrow-only">${text}</span>`;
  // [段, カードの内訳, 教材ページの見出し]。段の無いセッションは何も開けないので、内訳の行も 01〜03 の欄も出ない。
  const cases = [
    [{}, null, []],
    [{ giftLevel: 1 }, both('学習の進め方 / 本編 1章 / 練習問題 1本'), ['まずは学習の進め方から', '本編 1章', '練習問題 1本']],
    [{ giftLevel: 3 }, both('学習の進め方 / 本編 3章 / 練習問題 3本'), ['まずは学習の進め方から', '本編 3章', '練習問題 3本']],
    [{ giftLevel: 9 }, both('学習の進め方 / 本編 9章 / 練習問題 8本'), ['まずは学習の進め方から', '本編 9章', '練習問題 8本']],
    [{ giftLevel: 10 }, '<span class="wide-only">学習の進め方 / 本編 10章 / 練習問題 9本 / まとめて保存</span><span class="narrow-only">学習の進め方 / 本編 10章 / 練習問題 9本</span>', ['まずは学習の進め方から', '本編 10章', '練習問題 9本', 'まとめて手元に']],
  ];
  for (const [extra, meta, headings] of cases) {
    const label = JSON.stringify(extra);
    const cookie = `local_course_session=${token(extra)}`;
    const library = await req('/library', { headers: { Cookie: cookie } });
    assert.equal(library.status, 200, label);
    const card = /<article class="course-card">[\s\S]*?<\/article>/.exec(await library.text())[0];
    assert.deepEqual([...card.matchAll(/<div class="course-meta">([\s\S]*?)<\/div>/g)].map(m => m[1]), meta === null ? [] : [meta], label);
    if (!extra.giftLevel || extra.giftLevel < 10) assert.doesNotMatch(card, /まとめて保存/, label);
    const course = await req('/courses/typescript', { headers: { Cookie: cookie } });
    assert.equal(course.status, 200, label);
    const html = await course.text();
    assert.deepEqual([...html.matchAll(/<main[\s\S]*?<\/main>/g)].flatMap(m => [...m[0].matchAll(/<h2>([^<]*)<\/h2>/g)].map(h => h[1])), headings, label);
    // 見出しの数と、ページから保存できるリンクの数が一致する。
    const count = group => (html.match(new RegExp(`href="/download/typescript/${group}-`, 'g')) || []).length;
    if (extra.giftLevel) {
      assert.ok(html.includes(`<h2>本編 ${count('chapter')}章</h2>`), label); assert.ok(html.includes(`<h2>練習問題 ${count('exercise')}本</h2>`), label);
    } else {
      assert.equal(count('chapter') + count('exercise'), 0, label); assert.doesNotMatch(html, /本編 0章|練習問題 0本|まずは学習の進め方から/, label);
    }
  }
});
test('production serves the paid product to product-phrase holders behind the Basic gate', async () => {
  const prodOrigin = 'https://course.example';
  const instance = runtime({ bindings: { SESSION_SECRET: secret, ACCESS_PHRASE_SHA256_REDMINE_CLONE: digest(productPhrase) } });
  try {
    const bucket = await instance.getR2Bucket('MATERIALS');
    await bucket.put(`releases/redmine-clone/${productVersion}/redmine-clone-source.zip`, 'PROD PRODUCT BYTES');
    const authHeaders = { Authorization: basicHeader };
    const entry = await instance.dispatchFetch(prodOrigin, { headers: authHeaders });
    const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
    const res = await instance.dispatchFetch(prodOrigin + '/login', { method: 'POST', redirect: 'manual', headers: { ...authHeaders, Origin: prodOrigin, 'CF-Connecting-IP': '192.0.2.231', Cookie: headerCookie(entry, '__Host-course_login') }, body: new URLSearchParams({ csrf, phrase: productPhrase }) });
    assert.equal(res.status, 303);
    const cookie = res.headers.getSetCookie().find(c => c.startsWith('__Host-course_session=')).split(';')[0];
    const course = await instance.dispatchFetch(prodOrigin + '/courses/redmine-clone', { headers: { ...authHeaders, Cookie: cookie } });
    assert.equal(course.status, 200); assert.match(await course.text(), /redmine-clone-source\.zip|ソースコード一式/);
    const dl = await instance.dispatchFetch(prodOrigin + '/download/redmine-clone/source-zip', { headers: { ...authHeaders, Cookie: cookie } });
    assert.equal(dl.status, 200); assert.equal(await dl.text(), 'PROD PRODUCT BYTES'); noCache(dl);
    // 商品だけ開いた人に特典は渡らない。
    assert.equal((await instance.dispatchFetch(prodOrigin + '/download/typescript/chapter-01', { headers: { ...authHeaders, Cookie: cookie } })).status, 404);
  } finally { await instance.dispose(); }
});
test('successful login rotates session, uses secure cookies and fixed redirect', async () => {
  const a = await loginAttempt(), b = await loginAttempt();
  assert.equal(a.res.status, 303); assert.equal(a.res.headers.get('Location'), '/library');
  assert.notEqual(a.cookie, b.cookie);
  const header = a.res.headers.getSetCookie().find(c => c.startsWith('local_course_session='));
  for (const attr of ['HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=14400']) assert.ok(header.includes(attr));
  assert.ok(a.res.headers.getSetCookie().some(c => c.startsWith('local_course_login=') && c.includes('Max-Age=0')));
  noCache(a.res);
});
test('synthetic downloads match all 21 synthetic files, including the TypeScript bundle', async () => {
  const { cookie } = await loginAttempt();
  const files = fixtures();
  for (const [name, bytes] of files) {
    const id = name.replace('typescript-', '').replace(/\.(pdf|zip)$/, '');
    const res = await req('/download/typescript/' + id, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200, id); noCache(res);
    assert.equal(res.headers.get('Content-Disposition'), `attachment; filename="${name}"`);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
  }
  assert.equal(files.size, 21);
});
test('authenticated HEAD and Range return correct metadata and bytes', async () => {
  const { cookie } = await loginAttempt();
  const bytes = fixtures().get('typescript-chapter-01.pdf');
  const head = await req('/download/typescript/chapter-01', { method: 'HEAD', headers: { Cookie: cookie } });
  assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('Content-Length'), String(bytes.length)); noCache(head);
  for (const [range, expected] of [['bytes=0-9', bytes.subarray(0, 10)], ['bytes=-10', bytes.subarray(-10)], ['bytes=10-', bytes.subarray(10)]]) {
    const res = await req('/download/typescript/chapter-01', { headers: { Cookie: cookie, Range: range } });
    assert.equal(res.status, 206); assert.match(res.headers.get('Content-Range'), /^bytes /); assert.deepEqual(Buffer.from(await res.arrayBuffer()), expected); noCache(res);
  }
});
test('malformed and unsatisfiable ranges fail; mismatching If-Range gets whole file', async () => {
  const { cookie } = await loginAttempt();
  for (const range of ['bytes=999999-', 'bytes=2-1', 'bytes=0-1,3-4', 'bytes=-0', 'bytes=-', 'bytes=999999999999999999999-']) {
    const res = await req('/download/typescript/chapter-01', { headers: { Cookie: cookie, Range: range } });
    assert.equal(res.status, 416, range); noCache(res);
  }
  assert.equal((await req('/download/typescript/chapter-01', { headers: { Cookie: cookie, Range: 'bytes=0-9', 'If-Range': '"other"' } })).status, 200);
});
test('valid response never authenticates a later anonymous request to same URL', async () => {
  const { cookie } = await loginAttempt();
  noCache(await req('/library', { headers: { Cookie: cookie } }));
  assert.equal((await req('/library')).status, 401);
  noCache(await req('/download/typescript/chapter-01', { headers: { Cookie: cookie } }));
  const anonymous = await req('/download/typescript/chapter-01');
  assert.equal(anonymous.status, 401); noCache(anonymous);
});
test('filename and encoded path traversal, injection, unknown IDs are rejected', async () => {
  const { cookie } = await loginAttempt();
  for (const id of ['..%2Fchapter-01', '%2e%2e%2fsecret', '%5csecret', 'chapter-01.pdf', 'chapter-01%00', 'chapter-01%0d%0aX-Test:x', 'https:%2f%2fevil.example', 'missing', 'chapter-01/extra']) {
    const res = await req('/download/typescript/' + id, { headers: { Cookie: cookie } });
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
test('expired login CSRF reissues the entry; tampered and duplicate form/cookie values are rejected', async () => {
  const now = Math.floor(Date.now() / 1000), token = signed('login', now - 700, now - 100);
  const res = await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.201', Cookie: `local_course_login=${token}` }, body: new URLSearchParams({ csrf: token, phrase: localPhrase }) });
  assert.equal(res.status, 200); assert.match(await res.text(), /時間がたったので、もう一度入力してください。/);
  assert.equal(headerCookie(res, 'local_course_session'), '');
  const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
  assert.equal((await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.201', Cookie: `local_course_login=${tampered}` }, body: new URLSearchParams({ csrf: tampered, phrase: localPhrase }) })).status, 403);
  const { cookie } = await loginAttempt();
  assert.equal((await req('/library', { headers: { Cookie: cookie + '; ' + cookie } })).status, 401);
  const entry = await req('/'); const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const body = new URLSearchParams({ csrf, phrase: localPhrase }); body.append('phrase', 'other');
  assert.equal((await req('/login', { method: 'POST', headers: { Origin: origin, Cookie: headerCookie(entry, 'local_course_login'), 'CF-Connecting-IP': '192.0.2.202' }, body })).status, 403);
});
test('an entry left open past its 600-second limit is shown again and the phrase then works', async () => {
  const entry = await req('/');
  const fresh = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const claims = JSON.parse(Buffer.from(fresh.split('.')[0], 'base64url').toString());
  assert.equal(claims.exp - claims.iat, 600);
  assert.match(entry.headers.get('Set-Cookie'), /Max-Age=600/);
  const now = Math.floor(Date.now() / 1000), expired = signed('login', now - 700, now - 100);
  const post = (csrf, cookie, phrase = localPhrase) => req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `192.0.2.${++ip}`, ...(cookie ? { Cookie: cookie } : {}) }, body: new URLSearchParams({ csrf, phrase }) });
  // ブラウザでは Cookie も 600 秒で消えるので、Cookie が無い送信が普通の形になる。
  for (const cookie of ['', `local_course_login=${expired}`]) {
    const res = await post(expired, cookie, 'wrong');
    assert.equal(res.status, 200, cookie || 'no cookie');
    const html = await res.text();
    assert.match(html, /role="status" class="notice">時間がたったので、もう一度入力してください。/);
    assert.doesNotMatch(html, /role="alert"/);
    const csrf = /name="csrf" value="([^"]+)"/.exec(html)[1];
    assert.notEqual(csrf, expired);
    const again = JSON.parse(Buffer.from(csrf.split('.')[0], 'base64url').toString());
    assert.equal(again.exp - again.iat, 600);
    assert.match(res.headers.get('Set-Cookie'), /^local_course_login=[^;]+; .*Max-Age=600/);
    const ok = await post(csrf, headerCookie(res, 'local_course_login'));
    assert.equal(ok.status, 303); assert.equal(ok.headers.get('Location'), '/library');
  }
  // Cookie の値と合わない、用途が違う、署名が不正な値は、今までどおり 403。
  assert.equal((await post(expired, headerCookie(entry, 'local_course_login'))).status, 403);
  assert.equal((await post(signed('session', now - 700, now - 100), '')).status, 403);
  assert.equal((await post(expired.slice(0, -2) + (expired.endsWith('AA') ? 'BB' : 'AA'), '')).status, 403);
  assert.equal((await post(fresh, '')).status, 403);
  // 同じ名前の Cookie が2つ、または空の Cookie は「Cookie が無い」とは扱わず 403。
  assert.equal((await post(expired, `local_course_login=${expired}; local_course_login=${expired}`)).status, 403);
  assert.equal((await post(expired, 'local_course_login=')).status, 403);
});
test('surrounding half-width and full-width spaces are removed before the phrase is compared', async () => {
  for (const phrase of [` ${localPhrase}`, `${localPhrase} `, `\u3000${localPhrase}\u3000`, `\t ${localPhrase}\u3000\n`]) {
    assert.equal((await loginAttempt(phrase)).res.status, 303, JSON.stringify(phrase));
  }
  assert.equal((await loginAttempt(` ${productPhrase}\u3000`)).res.status, 303);
  for (const phrase of [' wrong ', '\u3000wrong', `${localPhrase}x `, '\u3000 ']) {
    const { res } = await loginAttempt(phrase);
    assert.equal(res.status, 401, JSON.stringify(phrase)); assert.match(await res.text(), /合言葉を確認して/);
  }
});
test('IP brute-force limit is enforced by the actual platform binding', async () => {
  const entry = await req('/'); const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
  const cookie = headerCookie(entry, 'local_course_login');
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
    if (value === csrf) { assert.match(res.headers.get('Set-Cookie'), /Max-Age=0/); assert.equal(res.headers.get('Location'), '/closed'); }
  }
  const page = await req('/closed');
  assert.equal(page.status, 200); noCache(page);
  const html = await page.text();
  assert.match(html, /role="status"/); assert.match(html, /教材ページを閉じました/); assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /name="csrf"|<script(?! defer src="\/app\.js")/);
  assert.equal((await req('/closed', { headers: { Cookie: cookie } })).headers.get('Location'), '/library');
});
test('closing without a session goes to the closed page; other origins are still refused', async () => {
  const now = Math.floor(Date.now() / 1000);
  // 4時間たって戻った人の Cookie は、期限切れのセッションの値になっている。
  for (const cookie of ['', `local_course_session=${signed('session', now - 14500, now - 100)}`]) {
    const res = await req('/logout', { method: 'POST', headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: new URLSearchParams({ csrf: 'stale-or-missing' }) });
    assert.equal(res.status, 303, cookie || 'no cookie'); assert.equal(res.headers.get('Location'), '/closed');
    assert.match(res.headers.get('Set-Cookie'), /^local_course_session=; .*Max-Age=0/);
    noCache(res);
  }
  assert.equal((await req('/logout', { method: 'POST', headers: { Origin: origin }, body: '' })).status, 303);
  for (const headers of [{ Origin: 'https://evil.example' }, {}, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }]) {
    const res = await req('/logout', { method: 'POST', headers, body: new URLSearchParams({ csrf: 'x' }) });
    assert.equal(res.status, 403, JSON.stringify(headers)); assert.equal(res.headers.get('Set-Cookie'), null);
  }
  // セッションがある時は、今までどおり確認用の値が違えば 403。
  const { cookie } = await loginAttempt();
  assert.equal((await req('/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: new URLSearchParams({ csrf: 'bad' }) })).status, 403);
  assert.equal((await req('/library', { headers: { Cookie: cookie } })).status, 200);
});
test('the locked page primary button leads to a phrase field, and re-entering closes the previous collection', async () => {
  const { cookie } = await loginAttempt(localPhrase);
  const locked = await req('/courses/redmine-clone', { headers: { Cookie: cookie } });
  assert.equal(locked.status, 403);
  const html = await locked.text();
  const href = /<section class="card status-card"[^>]*>.*?<a class="button" href="([^"]+)">/.exec(html)[1];
  assert.equal(href, '/phrase');
  assert.match(html, /別の合言葉で入り直すと、いま開いている教材は閉じます。/);
  assert.doesNotMatch(html, /ログアウトしてから別の合言葉で入り直すこともできます/);
  assert.equal((await req('/', { headers: { Cookie: cookie } })).headers.get('Location'), '/library');
  const entry = await req(href, { headers: { Cookie: cookie } });
  assert.equal(entry.status, 200); noCache(entry);
  const form = await entry.text();
  assert.match(form, /<input id="phrase" type="password" name="phrase"/);
  assert.match(form, /別の合言葉で入り直すと、いま開いている教材は閉じます。/);
  const csrf = /name="csrf" value="([^"]+)"/.exec(form)[1];
  const res = await req('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `192.0.2.${++ip}`, Cookie: `${cookie}; ${headerCookie(entry, 'local_course_login')}` }, body: new URLSearchParams({ csrf, phrase: productPhrase }) });
  assert.equal(res.status, 303);
  const next = headerCookie(res, 'local_course_session');
  assert.equal((await req('/courses/redmine-clone', { headers: { Cookie: next } })).status, 200);
  // 今の動きのまま: 入り直すと、前に開けた教材は閉じる。
  assert.equal((await req('/courses/typescript', { headers: { Cookie: next } })).status, 403);
  const anonymous = await req(href);
  assert.equal(anonymous.status, 200); assert.doesNotMatch(await anonymous.text(), /いま開いている教材は閉じます/);
});
test('fixed redirects ignore user-controlled next URL; unexpected hosts are refused', async () => {
  const { cookie } = await loginAttempt();
  const res = await req('/?next=https://evil.example', { headers: { Cookie: cookie } });
  assert.equal(res.headers.get('Location'), '/library');
  assert.equal((await mf.dispatchFetch('https://evil.example/library', { headers: { Cookie: cookie } })).status, 421);
});
test('missing/short secrets and invalid production origin fail closed', async () => {
  for (const bindings of [{ SESSION_SECRET: '' }, { SESSION_SECRET: 'short' }, { ACCESS_PHRASE_SHA256: '' }, { BASIC_AUTH_USER: '' }, { BASIC_AUTH_PASS: '' }, { APP_ORIGIN: 'https://setup-required.invalid' }, { APP_ORIGIN: 'http://course.example' }]) {
    const instance = runtime({ bindings });
    try { const res = await instance.dispatchFetch(origin + '/download/typescript/chapter-01'); assert.equal(res.status, 503); noCache(res); }
    finally { await instance.dispose(); }
  }
});
async function productPhraseCase(productSecret) {
  const instance = runtime({ origin, bindings: { SESSION_SECRET: secret, ...(productSecret === undefined ? {} : { ACCESS_PHRASE_SHA256_REDMINE_CLONE: productSecret }) } });
  await instance.ready;
  const send = (path, opts = {}) => instance.dispatchFetch(origin + path, { redirect: 'manual', ...opts });
  const attempt = async phrase => {
    const entry = await send('/');
    const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
    return send('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `192.0.2.${++ip}`, Cookie: headerCookie(entry, 'local_course_login') }, body: new URLSearchParams({ csrf, phrase }) });
  };
  return { instance, send, attempt };
}
test('an unset product phrase setting keeps the site and the gift working', async () => {
  const { instance, send, attempt } = await productPhraseCase(undefined);
  try {
    assert.equal((await send('/')).status, 200);
    assert.equal((await attempt(localPhrase)).status, 303);
    const denied = await attempt(productPhrase);
    assert.equal(denied.status, 401); assert.doesNotMatch(await denied.text(), /配布設定を確認しています/);
  } finally { await instance.dispose(); }
});
test('a malformed product phrase setting closes only that product as under configuration check', async () => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ purpose: 'session', iat: now, exp: now + 100, nonce: '00000000-0000-4000-a000-000000000000', unlocked: ['redmine-clone'] })).toString('base64url');
  const productSession = `local_course_session=${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  // 大文字のダイジェスト、ダイジェストにし忘れた生の合言葉、長さ違いの3通り。
  for (const malformed of [digest(productPhrase).toUpperCase(), productPhrase, digest(productPhrase).slice(1)]) {
    const { instance, send, attempt } = await productPhraseCase(malformed);
    try {
      await instance.getR2Bucket('MATERIALS').then(b => b.put(`releases/redmine-clone/${productVersion}/redmine-clone-source.zip`, 'PRODUCT ZIP BYTES'));
      assert.equal((await send('/')).status, 200);
      const denied = await attempt(productPhrase);
      assert.equal(denied.status, 401);
      assert.match(await denied.text(), /販売中の教材は、ただいま配布設定を確認しています/);
      assert.equal((await attempt(malformed)).status, 401);
      const gift = await attempt(localPhrase);
      assert.equal(gift.status, 303);
      const giftCookie = headerCookie(gift, 'local_course_session');
      assert.equal((await send('/courses/typescript', { headers: { Cookie: giftCookie } })).status, 200);
      const closedPage = await send('/courses/redmine-clone', { headers: { Cookie: giftCookie } });
      assert.equal(closedPage.status, 503); assert.match(await closedPage.text(), /配布設定の確認中です/);
      // 設定を間違える前に入った購入者のセッションでも、閉じた商品は渡さない。
      for (const path of ['/courses/redmine-clone', '/download/redmine-clone/source-zip']) {
        const res = await send(path, { headers: { Cookie: productSession } });
        assert.equal(res.status, 503, path); assert.equal(res.headers.get('Content-Disposition'), null);
      }
    } finally { await instance.dispose(); }
  }
});
test('a product phrase setting that repeats another collection\'s digest closes that product; one phrase never opens two collections', async () => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ purpose: 'session', iat: now, exp: now + 100, nonce: '00000000-0000-4000-a000-000000000000', unlocked: ['redmine-clone'] })).toString('base64url');
  const productSession = `local_course_session=${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  const unlockedOf = res => JSON.parse(Buffer.from(headerCookie(res, 'local_course_session').split('=')[1].split('.')[0], 'base64url').toString()).unlocked;
  const levelPhrase = 'synthetic-gift-level-shared';
  // ギフトの合言葉と同じ、ギフトの段の合言葉と同じ、の2通り。
  for (const [shared, extra] of [[localPhrase, {}], [levelPhrase, { ACCESS_PHRASE_SHA256_TYPESCRIPT_03: digest(levelPhrase) }]]) {
    const instance = runtime({ origin, bindings: { SESSION_SECRET: secret, ...extra, ACCESS_PHRASE_SHA256_REDMINE_CLONE: digest(shared) }, totalLimit: 1000 });
    const send = (path, opts = {}) => instance.dispatchFetch(origin + path, { redirect: 'manual', ...opts });
    try {
      await instance.getR2Bucket('MATERIALS').then(b => b.put(`releases/redmine-clone/${productVersion}/redmine-clone-source.zip`, 'PRODUCT ZIP BYTES'));
      assert.equal((await send('/')).status, 200);
      const entry = await send('/');
      const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
      const res = await send('/login', { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': `192.0.2.${++ip}`, Cookie: headerCookie(entry, 'local_course_login') }, body: new URLSearchParams({ csrf, phrase: shared }) });
      assert.equal(res.status, 303, shared);
      assert.deepEqual(unlockedOf(res), ['typescript'], shared);
      const cookie = headerCookie(res, 'local_course_session');
      assert.equal((await send('/courses/typescript', { headers: { Cookie: cookie } })).status, 200);
      for (const path of ['/courses/redmine-clone', '/download/redmine-clone/source-zip']) {
        const closedRes = await send(path, { headers: { Cookie: productSession } });
        assert.equal(closedRes.status, 503, path); assert.equal(closedRes.headers.get('Content-Disposition'), null);
        assert.match(await closedRes.text(), /配布設定の確認中です/);
      }
    } finally { await instance.dispose(); }
  }
  // ギフトの中での重なり（10 段目が従来の合言葉と同じ）は、商品を閉じない。
  const instance = runtime({ origin, bindings: { SESSION_SECRET: secret, ACCESS_PHRASE_SHA256_TYPESCRIPT_10: digest(localPhrase), ACCESS_PHRASE_SHA256_REDMINE_CLONE: digest(productPhrase) }, totalLimit: 1000 });
  try {
    const res = await instance.dispatchFetch(origin + '/courses/redmine-clone', { redirect: 'manual', headers: { Cookie: productSession } });
    assert.equal(res.status, 200);
  } finally { await instance.dispose(); }
});
test('release manifest validates all filenames and rejects unsafe filenames', async () => {
  const source = await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8');
  const js = stripTypeScriptTypes(source);
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  manifest.validateManifest(); assert.equal(manifest.release.version, version); assert.equal(manifest.materials.length, 21);
  const base = manifest.materials[0];
  for (const filename of ['../secret.pdf', 'bad\r\nname.pdf', '/tmp/file.pdf', 'taskapp-a.pdf.exe', 'taskapp-a.zip/../secret', 'taskapp-a".pdf']) assert.equal(manifest.validMaterial({ ...base, filename }), false);
});
test('security headers and mobile semantic page structure are present', async () => {
  const entry = await req('/'), html = await entry.text();
  assert.match(html, /lang="ja"/); assert.match(html, /name="viewport"/); assert.match(html, /<label for="phrase">/);
  assert.match(entry.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/); assert.equal(entry.headers.get('Referrer-Policy'), 'same-origin');
  assert.equal(entry.headers.get('Strict-Transport-Security'), null);
  noCache(entry);
});
test('the gift section of the catalogue lists only TypeScript; a paid product is never listed as a gift and no unknown collection appears', async () => {
  const { cookie } = await loginAttempt();
  const catalogue = await (await req('/library', { headers: { Cookie: cookie } })).text();
  assert.match(catalogue, /アンケート/); assert.match(catalogue, /無料プレゼント/);
  assert.match(catalogue, /THANK YOU FOR YOUR FEEDBACK/); assert.match(catalogue, /ご協力の感謝を、<br>次の学びに。/); assert.match(catalogue, /<title>プレゼント教材 \|/);
  assert.match(catalogue, /<div class="eyebrow">THANK YOU FOR YOUR FEEDBACK<\/div><h1>ご協力の感謝を、<br>次の学びに。<\/h1><p class="lead"><span class="wide-only">アンケートにお答えいただいた方へ。<br>TypeScript教材を無料プレゼントとしてお届けします。<\/span><span class="narrow-only">アンケートにお答えいただいた方へ。TypeScript教材を無料プレゼントとしてお届けします。<\/span><\/p>/);
  assert.match(catalogue, /<h2>TypeScript教材<\/h2><p>アンケートにお答えいただいた方への無料プレゼントです。<\/p>/);
  assert.ok(catalogue.includes(`<footer>教材ライブラリ · ${version}<br><span class="note-long">回答後に届いたご案内のURLをブックマークしてご利用ください。</span>`), 'gift library footer');
  assert.match(catalogue, /<span class="brand-note">アンケート回答者限定<\/span>/);
  assert.match(catalogue, /href="\/courses\/typescript"/); assert.doesNotMatch(catalogue, /taskapp|Taskapp|36巻|スターター|完成例/);
  // 商品は「教材（販売）」の欄に鍵つきで並ぶ。ギフトの欄には入らない。
  const giftSection = catalogue.slice(catalogue.indexOf('<h2>回答者限定プレゼント</h2>'), catalogue.indexOf('<h2>教材（販売）</h2>'));
  assert.match(giftSection, /href="\/courses\/typescript"/); assert.doesNotMatch(giftSection, /redmine-clone|PAID PRODUCT/);
  const course = await (await req('/courses/typescript', { headers: { Cookie: cookie } })).text();
  assert.match(course, /ダミー教材/); assert.ok(course.includes(version));
  assert.ok(course.includes(`<footer>教材ライブラリ · ${version}<br>`), 'gift course footer');
  assert.equal((course.match(/href="\/download\/typescript\//g) || []).length, 21);
});
test('the gift pages keep the design board copy at PC and mobile widths', async () => {
  const { cookie } = await loginAttempt();
  const course = await (await req('/courses/typescript', { headers: { Cookie: cookie } })).text();
  // Chapters read 第1章 (no zero padding); exercises read 練習問題 01 on PC and 問題 01 on mobile.
  assert.match(course, /<span>第1章<\/span>/); assert.match(course, /<span>第10章<\/span>/); assert.doesNotMatch(course, /第0\d章/);
  assert.match(course, /<span class="wide-only">練習問題 01<\/span><span class="narrow-only">問題 01<\/span>/);
  assert.match(course, /<p class="lead wide-only">学んだ内容を手を動かして確かめましょう。第9章には練習問題がありません。<\/p><p class="lead narrow-only">第9章には練習問題がありません。<\/p>/);
  assert.match(course, /<span class="wide-only">学習の進め方を確認したら、本編と練習問題へ。<br>手元に保存して、ひとつずつ進めましょう。<\/span><span class="narrow-only">学習の進め方を確認したら、本編と練習問題へ。手元に保存して、ひとつずつ進めましょう。<\/span>/);
  const catalogue = await (await req('/library', { headers: { Cookie: cookie } })).text();
  assert.match(catalogue, /<div class="course-meta"><span class="wide-only">学習の進め方 \/ 本編 10章 \/ 練習問題 9本 \/ まとめて保存<\/span><span class="narrow-only">学習の進め方 \/ 本編 10章 \/ 練習問題 9本<\/span><\/div>/);
  const entry = await (await req('/')).text();
  assert.match(entry, /<span class="wide-only">アンケートへのご協力、ありがとうございます。<br>回答後のご案内に記載された合言葉を入力してください。<\/span><span class="narrow-only">アンケートへのご協力、ありがとうございます。回答後のご案内に記載された合言葉を入力してください。<\/span>/);
  // The board has no normal line-height override on body text; REPEAT. keeps the book's weight 800.
  const css = await (await req('/style.css')).text();
  assert.match(css, /body\{[^}]*font:16px\/normal /); assert.match(css, /\.shelf-book b,\.cover-book b\{color:var\(--accent\);font-weight:inherit\}/);
});
test('only the learning page drops the footer bookmark sentence on mobile', async () => {
  const gift = (await loginAttempt()).cookie;
  const product = (await loginAttempt(productPhrase)).cookie;
  const main = html => /<main class="([^"]+)">/.exec(html)[1];
  // The mobile learning board shows no bookmark sentence. /guide and the product page have no board and keep it.
  assert.equal(main(await (await req('/courses/typescript', { headers: { Cookie: gift } })).text()), 'course learning');
  assert.equal(main(await (await req('/guide', { headers: { Cookie: gift } })).text()), 'course');
  assert.equal(main(await (await req('/courses/redmine-clone', { headers: { Cookie: product } })).text()), 'course');
  const css = await (await req('/style.css')).text();
  assert.match(css, /main\.learning\+footer br,main\.learning\+footer \.note-short\{display:none\}/);
  assert.doesNotMatch(css, /main\.course\+footer/);
});
test('PC and mobile copy never both show: the width queries leave no gap', async () => {
  const css = await (await req('/style.css')).text();
  // min-width:721px and max-width:720px both miss a zoomed width such as 720.5px, and both copies show.
  const queries = [...css.matchAll(/@media([^{]*)\{/g)].map(m => m[1].trim());
  assert.ok(!queries.some(q => q.includes('min-width')), queries.join(' | '));
  for (const q of queries.filter(q => q.startsWith('(max-width:'))) assert.ok(queries.includes(`not all and ${q}`), q);
  assert.ok(queries.includes('not all and (max-width:720px)'), queries.join(' | '));
});
test('locked and pending screens line the breadcrumb up with the card', async () => {
  const css = await (await req('/style.css')).text();
  // Locked and pending screens: the breadcrumb is as wide as the card and centred like it.
  assert.match(css, /\.status \.breadcrumb\{width:min\(690px,100%\);[^}]*align-self:center/);
  assert.match(css, /\.status-card\{width:min\(690px,100%\)/);
});
test('aggregate login limiter rejects attempts spread across IP addresses', async () => {
  const instance = runtime({ origin, totalLimit: 1, bindings: { SESSION_SECRET: secret } });
  try {
    const now = Math.floor(Date.now() / 1000), csrf = signed('login', now, now + 600);
    for (let i = 0; i < 2; i++) {
      const res = await instance.dispatchFetch(origin + '/login', { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'CF-Connecting-IP': `203.0.113.${i + 1}`, Cookie: `local_course_login=${csrf}` }, body: new URLSearchParams({ csrf, phrase: 'wrong' }) });
      assert.equal(res.status, i === 0 ? 401 : 429);
    }
  } finally { await instance.dispose(); }
});
test('missing release file has an authenticated empty state and no metadata leak', async () => {
  const { cookie } = await loginAttempt();
  const bucket = await mf.getR2Bucket('MATERIALS');
  const key = `releases/typescript/${version}/typescript-exercise-10.pdf`;
  await bucket.delete(key);
  try {
    const res = await req('/download/typescript/exercise-10', { headers: { Cookie: cookie } });
    assert.equal(res.status, 404); noCache(res); assert.match(await res.text(), /準備中/);
    assert.equal((await req('/download/typescript/exercise-10')).status, 401);
  } finally { await bucket.put(key, fixtures().get('typescript-exercise-10.pdf')); }
});
test('empty release files fail closed for GET, HEAD and Range without attachment metadata', async () => {
  const { cookie } = await loginAttempt();
  const bucket = await mf.getR2Bucket('MATERIALS');
  for (const id of ['chapter-01', 'all-materials']) {
    const filename = id === 'all-materials' ? 'typescript-all-materials.zip' : 'typescript-chapter-01.pdf';
    const key = `releases/typescript/${version}/${filename}`, path = '/download/typescript/' + id;
    await bucket.put(key, new Uint8Array());
    try {
      for (const options of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }]) {
        const res = await req(path, { ...options, headers: { ...options.headers, Cookie: cookie } });
        assert.equal(res.status, 503); noCache(res);
        for (const name of ['Content-Disposition', 'ETag', 'Accept-Ranges', 'Content-Range']) assert.equal(res.headers.get(name), null);
        const body = await res.text();
        if (options.method === 'HEAD') assert.equal(body, ''); else assert.match(body, /準備中/);
        const anonymous = await req(path, options);
        assert.equal(anonymous.status, 401); noCache(anonymous); assert.equal(anonymous.headers.get('Content-Disposition'), null);
      }
    } finally { await bucket.put(key, fixtures().get(filename)); }
  }
});
test('pending, preview and published labels are distinct; verification copy belongs to the release', async () => {
  const manifestSource = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifestUrl = 'data:text/javascript;base64,' + Buffer.from(manifestSource).toString('base64');
  const manifest = await import(manifestUrl);
  const viewSource = stripTypeScriptTypes(await readFile(new URL('../src/views.ts', import.meta.url), 'utf8')).replace("from './manifest'", `from ${JSON.stringify(manifestUrl)}`).replace("from '../package.json'", `from ${JSON.stringify(packageUrl)}`);
  const views = await import('data:text/javascript;base64,' + Buffer.from(viewSource).toString('base64'));
  assert.deepEqual(['pending', 'preview', 'published'].map(manifest.collectionStatusLabel), ['準備中', '開発プレビュー', '公開中']);
  const course = manifest.collections[0];
  const originalStatus = course.status, originalRelease = course.release;
  const originalPolicy = { ...manifest.giftPolicy };
  try {
    course.status = 'published';
    manifest.giftPolicy.myaspVerified = true; manifest.giftPolicy.distributionApproved = true;
    course.release = { ...course.release, synthetic: false, verification: { delivery: '配送の確認記録A', materials: '教材の確認記録B', platforms: '環境の確認記録C' } };
    const catalogue = views.catalogue('synthetic-csrf', false, ['typescript']);
    // Gift only keeps the gift hero; gift plus product uses the neutral hero; product only uses the product hero.
    assert.match(catalogue, /THANK YOU FOR YOUR FEEDBACK/); assert.match(catalogue, /<title>プレゼント教材 \|/);
    const mixed = views.catalogue('synthetic-csrf', false, ['typescript', 'redmine-clone']);
    assert.match(mixed, /<div class="eyebrow">YOUR LIBRARY<\/div><h1>次の学びを、<br>ひとつずつ。<\/h1>/); assert.match(mixed, /アンケートにお答えいただいた方への無料プレゼントです。/);
    const bought = views.catalogue('synthetic-csrf', false, ['redmine-clone']);
    assert.match(bought, /<h1>ご購入の教材を、<br>手元に。<\/h1>/); assert.doesNotMatch(bought, /アンケートにお答えいただいた方への/);
    // A course without its own version falls back to the app version, never the gift version.
    const product = manifest.collections.find(c => c.id === 'redmine-clone');
    const unversioned = views.productLibrary('synthetic-csrf', { ...product, version: null });
    const appVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
    assert.ok(unversioned.includes(`<footer>教材ライブラリ · ${appVersion}<br>`)); assert.ok(!/<footer>[^<]*synthetic/.test(unversioned));
    // A released gift card reads as the design board: badge 受け取れます and action 教材を受け取る.
    assert.match(catalogue, /<span class="badge">受け取れます<\/span>/); assert.match(catalogue, />教材を受け取る <span/); assert.doesNotMatch(catalogue, /開発プレビュー/);
    const html = views.library('synthetic-csrf', course);
    for (const value of ['配送の確認記録A', '教材の確認記録B', '環境の確認記録C']) assert.ok(html.includes(value));
    assert.doesNotMatch(html, /教材コードはダミー|開発プレビュー：/);
    assert.doesNotMatch(views.guide(), /教材コードはダミー|配布サイトはMac/);
  } finally { course.status = originalStatus; course.release = originalRelease; Object.assign(manifest.giftPolicy, originalPolicy); }
});
test('routes of a collection id that is not in the manifest (taskapp) are denied even with valid gift auth and objects stored under that id', async () => {
  const { cookie } = await loginAttempt();
  const sentinel = 'PAID PRODUCT MUST NEVER BE A SURVEY GIFT';
  const bucket = await mf.getR2Bucket('MATERIALS');
  await bucket.put('releases/taskapp/0.1.0-synthetic/taskapp-book-01.pdf', sentinel);
  for (const path of ['/courses/taskapp', '/download/taskapp/book-01', '/download/taskapp/books-bundle', '/download/taskapp/starter', '/download/taskapp/example', '/download/book-01', '/download/typescript/taskapp-book-01']) {
    for (const options of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }]) {
      const res = await req(path, { ...options, headers: { ...options.headers, Cookie: cookie } });
      assert.equal(res.status, 404, path); noCache(res);
      assert.equal(res.headers.get('Content-Disposition'), null);
      assert.ok(!(await res.text()).includes(sentinel));
    }
    assert.equal((await req(path)).status, 401);
  }
});
test('production requires the Basic site gate before the phrase login', async () => {
  const prodOrigin = 'https://course.example';
  const instance = runtime({ bindings: { SESSION_SECRET: secret } });
  try {
    const denied = await instance.dispatchFetch(prodOrigin);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('WWW-Authenticate'), /^Basic realm="course-library"/);
    assert.match(await denied.text(), /ご案内にある ID とパスワードを入力してください/);
    const wrong = await instance.dispatchFetch(prodOrigin, { headers: { Authorization: 'Basic ' + Buffer.from('test-basic-user:wrong').toString('base64') } });
    assert.equal(wrong.status, 401);
    for (const path of ['/library', '/download/typescript/chapter-01']) {
      assert.equal((await instance.dispatchFetch(prodOrigin + path)).status, 401);
    }
    const entry = await instance.dispatchFetch(prodOrigin, { headers: { Authorization: basicHeader } });
    assert.equal(entry.status, 200); assert.match(await entry.text(), /name="csrf"/);
  } finally { await instance.dispose(); }
});
test('production auth remains secure but neither synthetic files nor unverified survey gifts are distributed', async () => {
  const prodOrigin = 'https://course.example';
  const instance = runtime({ bindings: { SESSION_SECRET: secret } });
  try {
    await seed(instance);
    const authHeaders = { Authorization: basicHeader };
    const entry = await instance.dispatchFetch(prodOrigin, { headers: authHeaders });
    assert.equal(entry.headers.get('Strict-Transport-Security'), 'max-age=31536000');
    const csrf = /name="csrf" value="([^"]+)"/.exec(await entry.text())[1];
    const res = await instance.dispatchFetch(prodOrigin + '/login', { method: 'POST', redirect: 'manual', headers: { ...authHeaders, Origin: prodOrigin, 'CF-Connecting-IP': '192.0.2.230', Cookie: headerCookie(entry, '__Host-course_login') }, body: new URLSearchParams({ csrf, phrase: localPhrase }) });
    assert.equal(res.status, 303);
    const setCookie = res.headers.getSetCookie().find(c => c.startsWith('__Host-course_session='));
    for (const attr of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=14400']) assert.ok(setCookie.includes(attr));
    const cookie = setCookie.split(';')[0];
    const pending = await instance.dispatchFetch(prodOrigin + '/courses/typescript', { headers: { ...authHeaders, Cookie: cookie } });
    const html = await pending.text();
    assert.match(html, /現在ダウンロードできるファイルはありません/); assert.doesNotMatch(html, /href="\/download\//);
    for (const options of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }]) {
      const denied = await instance.dispatchFetch(prodOrigin + '/download/typescript/chapter-01', { ...options, headers: { ...options.headers, ...authHeaders, Cookie: cookie } });
      assert.equal(denied.status, 503); noCache(denied); assert.equal(denied.headers.get('Content-Disposition'), null);
    }
  } finally { await instance.dispose(); }
});
test('release policy fails closed for product mixing, wrong audiences and incomplete MyASP/distribution approval', async () => {
  const js = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const course = manifest.collections[0], original = structuredClone(course), policy = { ...manifest.giftPolicy }, approval = course.approval;
  try {
    // taskapp は、ギフトとして認めていない id の例（giftPolicy.allowedCourseIds に無い id はギフトにならない）。
    for (const [field, value] of [['id', 'taskapp'], ['distribution', 'free-product'], ['audience', 'all-newsletter-readers']]) {
      Object.assign(course, original, { [field]: value });
      assert.equal(manifest.canDistribute(course, true), false);
      assert.throws(() => manifest.validateManifest());
    }
    // 商品コレクションは buyers 以外の audience を許可しない（paid-product 型は正当）。
    Object.assign(course, structuredClone(original), { distribution: 'paid-product', audience: 'buyers', phraseEnv: 'ACCESS_PHRASE_SHA256_TYPESCRIPT' });
    assert.doesNotThrow(() => manifest.validateManifest());
    // 商品の設定名がマニフェストに無い、または id と食い違う商品は、起動しない。
    Object.assign(course, { phraseEnv: undefined });
    assert.throws(() => manifest.validateManifest());
    Object.assign(course, { phraseEnv: 'ACCESS_PHRASE_SHA256_REDMINE_CLONE' });
    assert.throws(() => manifest.validateManifest());
    Object.assign(course, structuredClone(original), { distribution: 'paid-product', audience: 'buyers', phraseEnv: 'ACCESS_PHRASE_SHA256_TYPESCRIPT' });
    assert.doesNotThrow(() => manifest.validateManifest());
    Object.assign(course, structuredClone(original)); delete course.phraseEnv;
    assert.doesNotThrow(() => manifest.validateManifest());
    course.materials[0].filename = 'taskapp-book-01.pdf';
    assert.throws(() => manifest.validateManifest());
    Object.assign(course, structuredClone(original));
    course.release.prefix = 'releases/taskapp/1.0.0/';
    assert.throws(() => manifest.validateManifest());
    Object.assign(course, structuredClone(original));
    course.status = 'published'; course.release.synthetic = false;
    // 承認の旗はコレクションの中（course.approval）を見る。
    for (const [myaspVerified, distributionApproved] of [[false, false], [true, false], [false, true]]) {
      Object.assign(course.approval, { myaspVerified, distributionApproved });
      assert.equal(manifest.canDistribute(course, false), false);
    }
    Object.assign(course.approval, { myaspVerified: true, distributionApproved: true });
    assert.equal(manifest.canDistribute(course, false), true);
  } finally { Object.assign(course, original, { approval }); delete course.phraseEnv; Object.assign(manifest.giftPolicy, policy); }
});
test('gift level settings keep the names built from the gift id, and a gift id that disagrees with them does not start', async () => {
  const js = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  // 型を付ける前と同じ名前（ギフトの id を大文字にし、段を2桁にした物）を、1 段目から順に読む。
  const gift = manifest.collections.find(manifest.isSurveyGift);
  assert.equal(manifest.GIFT_LEVELS, 10);
  assert.deepEqual(manifest.giftLevelEnvNames, Array.from({ length: 10 }, (_, i) => `ACCESS_PHRASE_SHA256_${gift.id.toUpperCase().replaceAll('-', '_')}_${String(i + 1).padStart(2, '0')}`));
  const policy = [...manifest.giftPolicy.allowedCourseIds], id = gift.id;
  try {
    manifest.giftPolicy.allowedCourseIds = ['javascript']; gift.id = 'javascript';
    assert.throws(() => manifest.validateManifest(), /Gift level setting does not match the gift/);
  } finally { manifest.giftPolicy.allowedCourseIds = policy; gift.id = id; }
  assert.doesNotThrow(() => manifest.validateManifest());
});
test('approval lives in each collection and one decision function covers gifts and products', async () => {
  const js = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const [gift, product] = manifest.collections;
  assert.equal(gift.approval, manifest.giftPolicy);
  assert.equal(product.approval, manifest.productPolicy);
  // 今の動き: ギフトはダミー教材なのでローカルだけ、商品は本番でも配れる。
  for (const local of [true, false]) {
    assert.equal(manifest.isDistributable(gift, local), local);
    assert.equal(manifest.canDistribute(gift, local), local);
    assert.equal(manifest.isDistributable(product, local), true);
  }
  assert.equal(manifest.canDistributeProduct(product), true);
  assert.equal(manifest.canDistribute(product, true), false);
  assert.equal(manifest.canDistributeProduct(gift), false);
  // 商品を1つ止めても、別の承認を持つ商品は止まらない。
  const second = { ...structuredClone(product), id: 'second-product', approval: { distributionApproved: false } };
  assert.equal(manifest.canDistributeProduct(second), false);
  assert.equal(manifest.canDistributeProduct(product), true);
  // ギフトは MyASP の確認が無いと、配布の承認があっても本番では配らない。
  const published = { ...structuredClone(gift), status: 'published', release: { ...gift.release, synthetic: false } };
  published.approval = { distributionApproved: true };
  assert.equal(manifest.isDistributable(published, false), false);
  published.approval = { distributionApproved: true, myaspVerified: true };
  assert.equal(manifest.isDistributable(published, false), true);
  assert.equal(manifest.isDistributable({ ...published, status: 'pending' }, true), false);
  assert.equal(manifest.isDistributable({ ...published, release: null }, true), false);
});
test('validateManifest stops a second survey gift, a repeated phrase setting and a gift material without a level', async () => {
  const js = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const [gift, product] = manifest.collections;
  const allowed = [...manifest.giftPolicy.allowedCourseIds], materials = [...gift.materials], phraseEnv = product.phraseEnv;
  assert.doesNotThrow(() => manifest.validateManifest());
  try {
    // ギフトの段はセッションに1つだけなので、ギフトは1つに限る。
    manifest.giftPolicy.allowedCourseIds = [...allowed, 'typescript-two'];
    manifest.collections.push({ ...structuredClone(gift), id: 'typescript-two', approval: { myaspVerified: false, distributionApproved: false } });
    assert.throws(() => manifest.validateManifest(), /Only one survey gift is supported/);
    manifest.collections.pop(); manifest.giftPolicy.allowedCourseIds = allowed;
    assert.doesNotThrow(() => manifest.validateManifest());
    // 商品の設定名がギフトの合言葉や段の合言葉と同じ名前なら起動しない。
    for (const name of ['ACCESS_PHRASE_SHA256', 'ACCESS_PHRASE_SHA256_TYPESCRIPT_01', 'ACCESS_PHRASE_SHA256_TYPESCRIPT_10']) {
      product.phraseEnv = name;
      assert.throws(() => manifest.validateManifest(), /Duplicate phrase setting/, name);
    }
    product.phraseEnv = phraseEnv;
    assert.doesNotThrow(() => manifest.validateManifest());
    // 段の決まらない教材がギフトにあると起動しない。
    gift.materials.push({ id: 'appendix', title: '付録', filename: 'typescript-appendix.pdf', type: 'application/pdf', group: 'books' });
    assert.throws(() => manifest.validateManifest(), /Gift material without a level/);
  } finally {
    manifest.giftPolicy.allowedCourseIds = allowed; gift.materials.splice(0, gift.materials.length, ...materials); product.phraseEnv = phraseEnv;
    manifest.collections.splice(2);
  }
  assert.doesNotThrow(() => manifest.validateManifest());
});
test('two collections never share one approval object, and a missing approval fails closed without throwing', async () => {
  const js = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const manifest = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const [gift, product] = manifest.collections;
  const approval = product.approval;
  try {
    // 商品にギフトの承認を付けると、ギフトを承認した時に商品も開く。同じオブジェクトの共有は起動しない。
    product.approval = manifest.giftPolicy;
    assert.throws(() => manifest.validateManifest(), /Shared approval/);
    // 値が同じでも別のオブジェクトなら共有ではない。
    product.approval = { ...manifest.giftPolicy };
    assert.doesNotThrow(() => manifest.validateManifest());
    product.approval = undefined;
    assert.equal(manifest.isApproved(product), false);
    assert.equal(manifest.isDistributable(product, false), false);
    assert.equal(manifest.canDistributeProduct(product), false);
    // 真偽値の true 以外は承認として扱わない。
    product.approval = { distributionApproved: 'false' };
    assert.equal(manifest.canDistributeProduct(product), false);
    const published = { ...structuredClone(gift), status: 'published', release: { ...gift.release, synthetic: false }, approval: undefined };
    assert.equal(manifest.isDistributable(published, false), false);
    assert.equal(manifest.canDistribute(published, true), false);
  } finally { product.approval = approval; }
  assert.equal(manifest.canDistributeProduct(product), true);
  assert.doesNotThrow(() => manifest.validateManifest());
});
test('zero-byte release objects return an authenticated no-store 503 without attachment metadata', async () => {
  const { cookie } = await loginAttempt();
  const bucket = await mf.getR2Bucket('MATERIALS');
  const files = { 'chapter-01': 'typescript-chapter-01.pdf', 'all-materials': 'typescript-all-materials.zip' };
  try {
    for (const name of Object.values(files)) await bucket.put(`releases/typescript/${version}/${name}`, new Uint8Array(0));
    for (const id of Object.keys(files)) {
      for (const options of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-9' } }]) {
        const label = `${id} ${options.method || 'GET'} ${options.headers?.Range || ''}`;
        const res = await req('/download/typescript/' + id, { ...options, headers: { ...options.headers, Cookie: cookie } });
        assert.equal(res.status, 503, label); noCache(res);
        for (const header of ['Content-Disposition', 'ETag', 'Accept-Ranges', 'Content-Range']) assert.equal(res.headers.get(header), null, `${label} ${header}`);
        assert.match(res.headers.get('Content-Type'), /^text\/html/, label);
        const body = await res.text();
        if (options.method === 'HEAD') assert.equal(body, '', label);
        else { assert.match(body, /準備中/, label); assert.match(body, /href="\/courses\/typescript"/, label); }
        const anonymous = await req('/download/typescript/' + id, options);
        assert.equal(anonymous.status, 401, label); assert.equal(anonymous.headers.get('Content-Disposition'), null);
      }
    }
  } finally {
    for (const name of Object.values(files)) await bucket.put(`releases/typescript/${version}/${name}`, fixtures().get(name));
  }
  for (const [id, name] of Object.entries(files)) {
    const res = await req('/download/typescript/' + id, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200, id); assert.deepEqual(Buffer.from(await res.arrayBuffer()), fixtures().get(name));
    const part = await req('/download/typescript/' + id, { headers: { Cookie: cookie, Range: 'bytes=0-9' } });
    assert.equal(part.status, 206, id); assert.deepEqual(Buffer.from(await part.arrayBuffer()), fixtures().get(name).subarray(0, 10));
  }
});

test('the local product fixture seeds the exact object prefix the manifest serves', async () => {
  const source = stripTypeScriptTypes(await readFile(new URL('../src/manifest.ts', import.meta.url), 'utf8'));
  const { productRelease } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(productVersion, productRelease.version);
  const bucket = await mf.getR2Bucket('MATERIALS');
  assert.ok(await bucket.head(`${productRelease.prefix}redmine-clone-source.zip`), 'seeded product object missing at the manifest prefix');
});
