#!/usr/bin/env node
// Side-by-side "design board (left) vs. running app (right)" images plus a text/style diff.
// Usage: node design-compare.cjs --app <app worktree> --design <design project dir> --out <dir> [--only Main,Library]
// Starts the app in-process from --app with the repo's own scripts/runtime.mjs + scripts/fixtures.mjs
// (synthetic fixtures, local test phrase, no network), captures each board's matching screen, and stops it.
'use strict';
const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
if (!args.app || !args.design || !args.out) {
  console.error('Usage: node design-compare.cjs --app <app worktree> --design <design dir> --out <dir> [--only A,B]');
  process.exit(2);
}
const app = path.resolve(args.app), design = path.resolve(args.design), out = path.resolve(args.out);
const only = args.only ? new Set(args.only.split(',').map(s => s.trim())) : null;

// Board -> app screen. `states` are captured in order; `appScope`/`designScope` narrow the text diff.
const SCREENS = {
  Main: { route: 'GET / (anonymous)', states: ['entry'] },
  EntryMobile: { route: 'GET / (anonymous)', states: ['entry'] },
  LoginStates: { route: 'POST /login wrong phrase (401) + sending state (submit held client-side)', states: ['wrong', 'sending'], appScope: '.login-card', designScope: 'section' },
  LoginStatesMobile: { route: 'POST /login wrong phrase (401) + sending state (submit held client-side)', states: ['wrong', 'sending'], appScope: '.login-card', designScope: 'section' },
  Library: { route: 'GET /library (gift phrase)', states: ['library'] },
  LibraryMobile: { route: 'GET /library (gift phrase)', states: ['library'] },
  Course: { route: 'GET /courses/typescript (gift phrase)', states: ['course'] },
  CourseMobile: { route: 'GET /courses/typescript (gift phrase)', states: ['course'] },
  Preparing: { route: 'GET /download/typescript/exercise-10 with an empty R2 object (503)', states: ['preparing'] },
  PreparingMobile: { route: 'GET /download/typescript/exercise-10 with an empty R2 object (503)', states: ['preparing'] },
  Logout: { route: 'POST /logout -> /closed', states: ['logout'] },
  LogoutMobile: { route: 'POST /logout -> /closed', states: ['logout'] },
};
const PROPS = ['font-size', 'font-weight', 'color', 'background-color', 'padding', 'border-radius'];

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

// --- design board -> plain HTML ---
function boardHtml(file) {
  const src = fs.readFileSync(file, 'utf8');
  const style = (/<helmet>([\s\S]*?)<\/helmet>/.exec(src) || [, ''])[1];
  const inner = (/<x-dc>([\s\S]*?)<\/x-dc>/.exec(src) || [, ''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const script = (/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(src) || [, ''])[1];
  return { html: `<!doctype html><html lang="ja"><head><meta charset="utf-8">${style}</head><body>${inner}</body></html>`, script };
}
// Runs inside the (offline) browser page: board logic only feeds {{holes}} and <sc-for> lists.
function expandHoles(script) {
  let vals = {}, note = '';
  try { class DCLogic {} const C = new Function('DCLogic', `${script}\n;return Component;`)(DCLogic); vals = new C().renderVals() || {}; }
  catch (e) { note = `renderVals failed: ${e.message}`; }
  const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const fill = (s, scope) => s.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => { const v = get(scope, p); return v == null ? m : String(v); });
  for (const loop of [...document.querySelectorAll('sc-for')]) {
    const name = (/\{\{\s*([\w.$]+)\s*\}\}/.exec(loop.getAttribute('list') || '') || [])[1];
    const as = loop.getAttribute('as') || 'item';
    let list = name ? get(vals, name) : null;
    if (!Array.isArray(list)) { list = Array.from({ length: Number(loop.getAttribute('hint-placeholder-count') || 1) }, () => ({})); note ||= `no data for ${name}`; }
    const tpl = loop.innerHTML;
    loop.insertAdjacentHTML('beforebegin', list.map(item => fill(tpl, { ...vals, [as]: item })).join(''));
    loop.remove();
  }
  document.body.innerHTML = fill(document.body.innerHTML, vals);
  return { note, leftover: (document.body.innerHTML.match(/\{\{[^}]*\}\}/g) || []).length };
}
// Runs in either page: visible text nodes in document order with their element's computed style.
function collect([scope, props]) {
  const roots = scope ? [...document.querySelectorAll(scope)] : [document.body];
  const bg = el => { for (; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; } return 'transparent'; };
  const items = [];
  for (const root of roots) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.textContent.replace(/\s+/g, ' ').trim(), el = n.parentElement;
      if (!t || !el || ['STYLE', 'SCRIPT'].includes(el.tagName)) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // Box props (padding, radius) come from the enclosing link/button or the nearest non-inline element,
      // so a text wrapper <span> inside a styled link is not reported as "padding 0".
      let box = el.closest('a,button');
      if (!box) for (box = el; box.parentElement && getComputedStyle(box).display === 'inline'; box = box.parentElement);
      const cs = getComputedStyle(el), bs = getComputedStyle(box), s = {};
      for (const p of props) s[p] = p === 'background-color' ? bg(el) : (p === 'padding' || p === 'border-radius' ? bs : cs).getPropertyValue(p);
      items.push({ t, tag: el.tagName.toLowerCase(), s });
    }
  }
  return { items, height: document.documentElement.scrollHeight };
}
function lcsDiff(a, b) {
  const m = a.length, n = b.length, L = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i].t === b[j].t ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i].t === b[j].t) ops.push(['=', a[i++], b[j++]]);
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push(['-', a[i++]]);
    else ops.push(['+', null, b[j++]]);
  }
  while (i < m) ops.push(['-', a[i++]]);
  while (j < n) ops.push(['+', null, b[j++]]);
  return ops;
}
const short = t => (t.length > 70 ? t.slice(0, 69) + '…' : t);
function diffSection(name, board, spec, d, appSides) {
  const appItems = appSides.flatMap(s => s.items);
  const ops = lcsDiff(d.items, appItems), lines = [], style = new Map();
  for (const [op, x, y] of ops) {
    if (op === '-') lines.push(`- design only: \`${short(x.t)}\` (${x.tag})`);
    else if (op === '+') lines.push(`- app only: \`${short(y.t)}\` (${y.tag})`);
    else for (const p of PROPS) if (x.s[p] !== y.s[p]) { const k = `\`${short(x.t)}\` ${p}: ${x.s[p]} → ${y.s[p]}`; style.set(k, (style.get(k) || 0) + 1); }
  }
  const matched = ops.filter(o => o[0] === '=').length;
  return [`## ${name} — ${board.title}`, '', `- app: ${spec.route}`,
    `- page height: board ${board.h}px, design rendered ${d.height}px, app ${appSides.map((s, i) => `${spec.states[i]} ${s.height}px`).join(', ')}`,
    `- text nodes: design ${d.items.length}, app ${appItems.length}, matched ${matched}${spec.appScope ? ` (app scoped to \`${spec.appScope}\`, design to \`${spec.designScope}\`)` : ''}`,
    ...(d.note ? [`- design render note: ${d.note}`] : []), '',
    '### Text (design order)', '', ...(lines.length ? lines : ['- none']), '',
    '### Style of matched text (design → app)', '', ...(style.size ? [...style].map(([k, c]) => `- ${k}${c > 1 ? ` (×${c})` : ''}`) : ['- none']), ''].join('\n');
}

async function main() {
  const canvas = JSON.parse(fs.readFileSync(path.join(design, 'canvas.json'), 'utf8'));
  const boards = canvas.order.map(f => ({ name: f.replace(/\.dc\.html$/, ''), file: path.join(design, f), ...canvas.boards[f] }))
    .filter(b => !only || only.has(b.name));
  assert(boards.length, 'no boards selected');
  for (const b of boards) assert(SCREENS[b.name], `no app screen mapping for board ${b.name}`);
  fs.mkdirSync(out, { recursive: true });
  const commit = execFileSync('git', ['-C', app, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const built = spawnSync('node', ['scripts/wrangler.mjs', 'deploy', '--dry-run', '--outdir', 'dist'], { cwd: app, encoding: 'utf8' });
  if (built.status !== 0) throw new Error(`app build failed:\n${built.stdout}\n${built.stderr}`);
  process.chdir(app); // runtime.mjs resolves dist/index.js against cwd
  const rt = await import(pathToFileURL(path.join(app, 'scripts/runtime.mjs')).href);
  const fx = await import(pathToFileURL(path.join(app, 'scripts/fixtures.mjs')).href);
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  let mf, browser;
  try {
    mf = rt.runtime({ origin, port, ipLimit: 1000, totalLimit: 1000, bindings: { ACCESS_PHRASE_SHA256_REDMINE_CLONE: rt.digest(rt.localProductPhrase) } });
    await mf.ready;
    await fx.seed(mf);
    const bucket = await mf.getR2Bucket('MATERIALS');
    browser = await chromium.launch();

    const login = async page => {
      await page.goto(origin + '/');
      await page.getByLabel('アクセス用の合言葉').fill(rt.localPhrase);
      await page.getByRole('button', { name: '教材ページを開く' }).click();
      await page.waitForURL(origin + '/library');
    };
    const h1 = async (page, re) => { const t = await page.locator('h1').first().innerText(); assert(re.test(t), `unexpected heading "${t}" at ${page.url()}`); };
    const STATES = {
      async entry(page) { const r = await page.goto(origin + '/'); assert(r.status() === 200, `entry status ${r.status()}`); await h1(page, /次の学び/); },
      async wrong(page) {
        await page.goto(origin + '/');
        await page.getByLabel('アクセス用の合言葉').fill('wrong-synthetic-phrase');
        const res = page.waitForResponse(r => r.url() === origin + '/login');
        await page.getByRole('button', { name: '教材ページを開く' }).click();
        assert((await res).status() === 401, 'wrong phrase did not answer 401');
        await page.getByRole('alert').waitFor();
      },
      // The app's own app.js submit handler sets the busy state; a later listener cancels navigation so it stays on screen.
      async sending(page) {
        await page.goto(origin + '/');
        await page.getByLabel('アクセス用の合言葉').fill('xxxxxxxx');
        await page.evaluate(() => document.querySelector('form[action="/login"]').addEventListener('submit', e => e.preventDefault()));
        await page.getByRole('button', { name: '教材ページを開く' }).click();
        await page.locator('form[aria-busy="true"]').waitFor();
      },
      async library(page) { await login(page); await h1(page, /ご協力の感謝/); },
      async course(page) {
        await login(page);
        const r = await page.goto(origin + '/courses/typescript');
        assert(r.status() === 200, `course status ${r.status()}`);
        await h1(page, /TypeScript/);
        assert(await page.locator('a[href^="/download/typescript/"]').count() === 21, 'course page does not list 21 downloads');
      },
      async preparing(page) {
        await login(page);
        const key = `releases/typescript/${fx.version}/typescript-exercise-10.pdf`;
        await bucket.put(key, new Uint8Array());
        try {
          const r = await page.goto(origin + '/download/typescript/exercise-10');
          assert(r.status() === 503, `preparing status ${r.status()}`);
          await h1(page, /準備中/);
        } finally { await bucket.put(key, fx.fixtures().get('typescript-exercise-10.pdf')); }
      },
      async logout(page) {
        await login(page);
        await page.getByRole('button', { name: 'ライブラリを閉じる' }).click();
        await page.waitForURL(origin + '/closed');
        await page.getByRole('status').waitFor();
      },
    };

    const report = [`# Design vs. app — ${commit}`, '', `- app: \`${commit}\` (${app}), synthetic local runtime on ${origin}`, `- design: ${canvas.title} (${boards.length} boards)`, `- captured: ${stamp} (UTC), Chromium ${browser.version()}, deviceScaleFactor 1, viewport = board w × board h, full page`,
      '- method: visible text nodes in document order, LCS-aligned; styles compared only for matched text (background = nearest non-transparent ancestor).',
      '- the LoginStates "sending" state is reproduced by letting the app\'s own submit handler run and cancelling navigation; the real request is not held.',
      '- local fixture effects (synthetic notice, "ダミー教材を見る", version `0.2.2-synthetic`/manifest version vs. board `0.2.x`) are expected local differences, not design gaps.', ''];
    for (const board of boards) {
      const spec = SCREENS[board.name];
      const ctxOpts = { viewport: { width: board.w, height: board.h }, deviceScaleFactor: 1, locale: 'ja-JP', reducedMotion: 'reduce' };
      // Design board, rendered offline.
      const dctx = await browser.newContext(ctxOpts);
      await dctx.route('**/*', r => r.abort());
      const dpage = await dctx.newPage();
      const { html, script } = boardHtml(board.file);
      await dpage.setContent(html);
      const holes = await dpage.evaluate(expandHoles, script);
      const d = await dpage.evaluate(collect, [spec.designScope || null, PROPS]);
      // Boards whose content overflows their nominal h are captured to the end of the content.
      const dShot = await dpage.screenshot({ clip: { x: 0, y: 0, width: board.w, height: Math.max(board.h, d.height) } });
      d.note = [holes.note, holes.leftover ? `${holes.leftover} unresolved {{holes}}` : ''].filter(Boolean).join('; ');
      await dctx.close();
      // App screens.
      const appSides = [], appShots = [];
      for (const state of spec.states) {
        const actx = await browser.newContext(ctxOpts);
        const page = await actx.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await STATES[state](page);
        assert(!errors.length, `${board.name}/${state}: page script errors ${errors.join('; ')}`);
        appShots.push({ state, url: page.url().replace(origin, ''), png: await page.screenshot({ fullPage: true }) });
        appSides.push(await page.evaluate(collect, [spec.appScope || null, PROPS]));
        await actx.close();
      }
      await compose(browser, path.join(out, `${board.name}.png`), board, d, dShot, appShots, `${board.name} — ${board.title}  |  app ${commit}  |  ${spec.route}  |  ${stamp} UTC`);
      report.push(diffSection(board.name, board, spec, d, appSides));
      console.log(`${board.name}: ok`);
    }
    fs.writeFileSync(path.join(out, 'diff.md'), report.join('\n'));
  } finally {
    await browser?.close().catch(() => {});
    await mf?.dispose().catch(() => {});
  }
}

async function compose(browser, file, board, d, dShot, appShots, caption) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 800, height: 600 } });
  await ctx.route('**/*', r => r.abort());
  const page = await ctx.newPage();
  const img = b => `data:image/png;base64,${b.toString('base64')}`;
  const col = (label, png) => `<div class="col"><div class="lbl">${label}</div><img src="${img(png)}"></div>`;
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#888;font:15px/1.4 system-ui,sans-serif}
    .cap{background:#111;color:#fff;padding:10px 16px;white-space:nowrap}.row{display:flex;gap:24px;padding:16px;align-items:flex-start;width:max-content}
    .col{display:flex;flex-direction:column;gap:6px}.stack{display:flex;flex-direction:column;gap:16px}.lbl{color:#fff;font-weight:700}img{display:block;background:#fff}</style>
    <div class="cap">${caption.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>
    <div class="row">${col(`DESIGN ${board.name} (${board.w}×${board.h}${d.height > board.h ? `, content overflows to ${d.height}px` : ''})`, dShot)}<div class="stack">${appShots.map(s => col(`APP ${s.state} ${s.url}`, s.png)).join('')}</div></div>`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
}

const timer = setTimeout(() => { console.error('design-compare: timed out after 300s'); process.exit(1); }, 300_000);
main().then(() => { clearTimeout(timer); process.exit(0); }, e => { console.error(e.stack || e); clearTimeout(timer); process.exit(1); });
