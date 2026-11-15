import { cookie, cookieName, cookies, equal, issue, SESSION_TTL, sha256, verify } from './auth';
import { canDistribute, canDistributeProduct, canOpenMaterial, collections, GIFT_LEVELS, giftLevelEnvName, isPaidProduct, isSurveyGift, phraseEnvName, type Collection, type Secrets, validateManifest } from './manifest';
import { catalogue, closed, css, guide, js, library, lockedCourse, login, message, pendingCourse, preparingMaterial, productLibrary } from './views';

type AppEnv = Omit<Env, 'APP_MODE' | 'APP_ORIGIN'> & { APP_MODE: string; APP_ORIGIN: string } & Secrets;
const security = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  'Vary': 'Cookie',
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
};
function response(body: BodyInit | null, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(security);
  h.set('Content-Type', 'text/html; charset=utf-8');
  new Headers(headers).forEach((v, k) => h.set(k, v));
  return new Response(body, { status, headers: h });
}
const error = (status: number, title: string) => response(message(title), status);
const redirect = (to: '/closed' | '/library') => response(null, 303, { Location: to });
const digestShape = /^[0-9a-f]{64}$/;
function configured(env: AppEnv): boolean {
  try {
    const u = new URL(env.APP_ORIGIN);
    const local = env.APP_MODE === 'local';
    return u.origin === env.APP_ORIGIN && !u.username && !u.password
      && (local ? u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) : u.protocol === 'https:' && !u.hostname.endsWith('.invalid'))
      && !!env.SESSION_SECRET && env.SESSION_SECRET.length >= 43
      && digestShape.test(env.ACCESS_PHRASE_SHA256 || '')
      && !!env.MATERIALS && !!env.LOGIN_IP_LIMIT && !!env.LOGIN_TOTAL_LIMIT
      && (local || (!!env.BASIC_AUTH_USER && !!env.BASIC_AUTH_PASS));
  } catch { return false; }
}
// 商品用の合言葉は、未設定ならその商品が閉じたままになるだけで、全体は動かす。
// 設定済みで形（小文字の16進64文字）が違う商品は、全体を 503 にせず、その商品だけを設定確認中として閉じる。
// 1つの設定の間違いで、ギフトや他の商品を持つ人まで入れなくしないため。
function misconfiguredProducts(env: AppEnv): Set<string> {
  const ids = new Set<string>();
  for (const c of collections) {
    const name = phraseEnvName(c);
    const value = name ? env[name] : undefined;
    if (isPaidProduct(c) && value && !digestShape.test(value)) ids.add(c.id);
  }
  return ids;
}
// The outer site gate. Local previews keep the phrase-only flow; production requires browser credentials before any page.
async function basicAuth(req: Request, env: AppEnv): Promise<boolean> {
  const header = req.headers.get('Authorization');
  if (!header || !header.startsWith('Basic ')) return false;
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6).trim()), c => c.charCodeAt(0)));
    return await equal(decoded, `${env.BASIC_AUTH_USER}:${env.BASIC_AUTH_PASS}`);
  } catch { return false; }
}
function sameOrigin(req: Request, env: AppEnv): boolean {
  const site = req.headers.get('Sec-Fetch-Site');
  return req.headers.get('Origin') === env.APP_ORIGIN && (!site || site === 'same-origin' || site === 'none');
}
async function boundedForm(req: Request): Promise<URLSearchParams | null> {
  if (req.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/x-www-form-urlencoded') return null;
  if (Number(req.headers.get('Content-Length')) > 4096 || !req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  const form = new URLSearchParams(new TextDecoder().decode(bytes));
  if ([...form.keys()].some(k => form.getAll(k).length !== 1)) return null;
  return form;
}

async function download(req: Request, env: AppEnv, course: Collection, id: string): Promise<Response> {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return error(404, '教材が見つかりません');
  const material = course.materials.find(m => m.id === id);
  if (!material || !course.release) return error(404, '教材が見つかりません');
  const key = course.release.prefix + material.filename;
  const object = await env.MATERIALS.head(key);
  if (!object) return response(preparingMaterial(course), 404);
  // An empty object is an unfinished upload, not a material. Answer before any attachment metadata exists.
  if (object.size === 0) return response(preparingMaterial(course), 503);
  const h = new Headers({
    'Content-Type': material.type,
    'Content-Disposition': `attachment; filename="${material.filename}"`,
    'Content-Length': String(object.size),
    'Accept-Ranges': 'bytes',
    'ETag': object.httpEtag,
  });
  // HEAD still requires authentication. RFC Range is only meaningful for GET.
  if (req.method === 'HEAD') return response(null, 200, h);
  let range: { offset: number; length: number } | undefined;
  const requested = req.headers.get('Range');
  const ifRange = req.headers.get('If-Range');
  if (requested && (!ifRange || ifRange === object.httpEtag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
    if (!match || (!match[1] && !match[2])) return response(null, 416, { 'Content-Range': `bytes */${object.size}` });
    const first = match[1] ? Number(match[1]) : undefined;
    const last = match[2] ? Number(match[2]) : undefined;
    const start = first ?? Math.max(0, object.size - (last ?? 0));
    const end = first === undefined ? object.size - 1 : Math.min(last ?? object.size - 1, object.size - 1);
    if (![start, end, first ?? 0, last ?? 0].every(Number.isSafeInteger) || start < 0 || start >= object.size || end < start || (first === undefined && last === 0)) {
      return response(null, 416, { 'Content-Range': `bytes */${object.size}` });
    }
    range = { offset: start, length: end - start + 1 };
    h.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    h.set('Content-Length', String(range.length));
  }
  // Release keys are immutable. Conditional fetch avoids serving changed bytes with stale metadata.
  const body = await env.MATERIALS.get(key, { range, onlyIf: { etagMatches: object.etag } });
  if (!body || !('body' in body)) return error(503, '教材の更新中です。少し待ってお試しください');
  return response(body.body, range ? 206 : 200, h);
}

async function handle(req: Request, env: AppEnv): Promise<Response> {
  const url = new URL(req.url);
  if (!configured(env)) return error(503, 'ただいま準備中です');
  if (url.origin !== env.APP_ORIGIN) return error(421, '正しいURLからアクセスしてください');
  validateManifest();
  const misconfigured = misconfiguredProducts(env);
  const local = env.APP_MODE === 'local';
  if (!local && !await basicAuth(req, env)) return response(message('認証が必要です'), 401, { 'WWW-Authenticate': 'Basic realm="course-library", charset="UTF-8"' });
  const secret = env.SESSION_SECRET!;
  const jar = cookies(req);
  const session = await verify(secret, jar.get(cookieName('course_session', local)), 'session');

  if (req.method === 'POST') {
    if (url.pathname !== '/login' && url.pathname !== '/logout') return error(404, 'ページが見つかりません');
    if (!sameOrigin(req, env)) return error(403, '入口からもう一度お試しください');
    if (url.pathname === '/login') {
      const ip = req.headers.get('CF-Connecting-IP') || (local ? 'local' : '');
      if (!ip) return error(403, '入口からもう一度お試しください');
      const ipAllowed = await env.LOGIN_IP_LIMIT.limit({ key: await sha256(ip) });
      const totalAllowed = await env.LOGIN_TOTAL_LIMIT.limit({ key: 'course-login' });
      if (!ipAllowed.success || !totalAllowed.success) return response(message('少し待ってお試しください', '入力回数が多くなっています。1分ほど待って入口からお試しください。'), 429, { 'Retry-After': '60' });
      const form = await boundedForm(req);
      const csrf = form?.get('csrf') || '';
      const loginCookie = jar.get(cookieName('course_login', local));
      if (!form || !loginCookie || !await equal(csrf, loginCookie) || !await verify(secret, csrf, 'login')) return error(403, '入口からもう一度お試しください');
      const phrase = form.get('phrase') || '';
      // 合言葉はコレクションごとに別の secret を持つ。打たれた合言葉が
      // どのコレクションのものかを全件照合し、合ったものだけを開ける。
      const digest = phrase.length > 256 ? '' : await sha256(phrase);
      const secrets = env as unknown as Record<string, string | undefined>;
      const matches = async (name: string) => {
        const expected = secrets[name];
        return !!expected && /^[0-9a-f]{64}$/.test(expected) && !!digest && await equal(digest, expected);
      };
      const matched: string[] = [];
      let giftLevel = 0;
      for (const c of collections) {
        if (misconfigured.has(c.id)) continue;
        const name = phraseEnvName(c);
        // ギフトは段の合言葉も全段照合し（途中で打ち切らない）、合った中で一番上の段を持たせる。
        if (isSurveyGift(c)) {
          if (name && await matches(name)) giftLevel = GIFT_LEVELS;
          for (let level = 1; level <= GIFT_LEVELS; level++) {
            if (await matches(giftLevelEnvName(c, level))) giftLevel = Math.max(giftLevel, level);
          }
          if (giftLevel) matched.push(c.id);
        } else if (name && await matches(name)) matched.push(c.id);
      }
      if (!matched.length) {
        // 設定確認中の商品がある時は、購入者が合言葉の打ち間違いと思い込まないよう、その事を添える。
        const notice = misconfigured.size ? '販売中の教材は、ただいま配布設定を確認しています。商品用の合言葉で入れない時は、時間をおいてお試しください。' : '';
        return response(login(csrf, `合言葉を確認して、もう一度入力してください。${notice}`), 401);
      }
      const unlocked = [...new Set(matched)];
      const res = redirect('/library');
      res.headers.append('Set-Cookie', cookie('course_session', await issue(secret, 'session', SESSION_TTL, giftLevel ? { unlocked, giftLevel } : { unlocked }), SESSION_TTL, local));
      res.headers.append('Set-Cookie', cookie('course_login', '', 0, local));
      return res;
    }
    const form = await boundedForm(req);
    if (!session || !form || !await equal(form.get('csrf') || '', session.nonce)) return error(403, '入口からもう一度お試しください');
    // A fixed page confirms the closed session without query parameters or JavaScript.
    const res = redirect('/closed');
    res.headers.append('Set-Cookie', cookie('course_session', '', 0, local));
    return res;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return response(null, 405, { Allow: 'GET, HEAD, POST' });
  if (url.pathname === '/style.css') return response(req.method === 'HEAD' ? null : css, 200, { 'Content-Type': 'text/css; charset=utf-8' });
  if (url.pathname === '/app.js') return response(req.method === 'HEAD' ? null : js, 200, { 'Content-Type': 'text/javascript; charset=utf-8' });
  if (url.pathname === '/') {
    if (session) return redirect('/library');
    const csrf = await issue(secret, 'login', 600);
    return response(req.method === 'HEAD' ? null : login(csrf), 200, { 'Set-Cookie': cookie('course_login', csrf, 600, local) });
  }
  if (url.pathname === '/closed') return session ? redirect('/library') : response(req.method === 'HEAD' ? null : closed());
  if (!session) return error(401, '合言葉を入力して教材を開いてください');
  const unlocked = session.unlocked ?? [];
  // 段を持たないセッションはギフトの教材を1つも開けない（全部開ける扱いにはしない）。
  const giftLevel = session.giftLevel ?? 0;
  if (url.pathname === '/library') return response(req.method === 'HEAD' ? null : catalogue(session.nonce, local, unlocked));
  if (url.pathname === '/status') {
    const gift = collections.find(isSurveyGift);
    return gift ? response(req.method === 'HEAD' ? null : pendingCourse(gift, session.nonce)) : error(503, '配布設定の確認中です');
  }
  const courseRoute = /^\/courses\/([a-z0-9-]+)$/.exec(url.pathname);
  if (courseRoute) {
    const course = collections.find(c => c.id === courseRoute[1]);
    if (!course) return error(404, '教材が見つかりません');
    if (misconfigured.has(course.id)) return error(503, '配布設定の確認中です');
    if (!unlocked.includes(course.id)) return response(req.method === 'HEAD' ? null : lockedCourse(course, session.nonce), 403);
    if (isSurveyGift(course)) {
      const opened = { ...course, materials: course.materials.filter(m => canOpenMaterial(course, m, giftLevel)) };
      return response(req.method === 'HEAD' ? null : canDistribute(course, local) ? library(session.nonce, opened) : pendingCourse(course, session.nonce));
    }
    if (isPaidProduct(course)) return response(req.method === 'HEAD' ? null : canDistributeProduct(course) ? productLibrary(session.nonce, course) : pendingCourse(course, session.nonce));
    return error(404, '教材が見つかりません');
  }
  if (url.pathname === '/guide') return response(req.method === 'HEAD' ? null : guide());
  const downloadRoute = /^\/download\/([a-z0-9-]+)\/(.+)$/.exec(url.pathname);
  if (downloadRoute) {
    const course = collections.find(c => c.id === downloadRoute[1]);
    if (!course || !unlocked.includes(course.id)) return error(404, '教材が見つかりません');
    if (misconfigured.has(course.id)) return error(503, '配布設定の確認中です');
    const distributable = isSurveyGift(course) ? canDistribute(course, local) : isPaidProduct(course) && canDistributeProduct(course);
    if (!distributable) return error(503, '配布設定の確認中です');
    // 段より上の教材は、存在を確かめる前に 403 で止める（GET・HEAD・Range とも）。
    const material = course.materials.find(m => m.id === downloadRoute[2]);
    if (material && !canOpenMaterial(course, material, giftLevel)) return error(403, 'この教材はお持ちの合言葉ではまだ開けません');
    return download(req, env, course, downloadRoute[2]!);
  }
  return error(404, 'ページが見つかりません');
}

export default {
  async fetch(req, env): Promise<Response> {
    try {
      const res = await handle(req, env);
      if (new URL(req.url).protocol === 'https:') res.headers.set('Strict-Transport-Security', 'max-age=31536000');
      // Strip bodies from every HEAD response, including authentication failures.
      return req.method === 'HEAD' ? new Response(null, res) : res;
    } catch {
      // Do not log requests, credentials, cookies, or storage keys.
      const res = error(503, 'ただいま準備中です');
      return req.method === 'HEAD' ? new Response(null, res) : res;
    }
  },
} satisfies ExportedHandler<AppEnv>;
