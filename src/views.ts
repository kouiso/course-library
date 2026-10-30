import { canDistribute, collections, collectionStatusLabel, exerciseChapterIds, isSurveyGift, release, type Collection } from './manifest';
export const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
type Layout = 'entry' | 'library' | 'course' | 'status';
// Status screens (errors, preparation, closed) carry only the version in the footer, as in the design.
export function page(title: string, body: string, layout: Layout = 'status'): string {
  const note = layout === 'status' ? '' : '<br><span class="note-long">回答後に届いたご案内のURLをブックマークしてご利用ください。</span><span class="note-short">ご案内のURLをブックマークしてご利用ください。</span>';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | 教材ライブラリ</title><link rel="stylesheet" href="/style.css"><script defer src="/app.js"></script></head><body><header><a href="/" class="brand">COURSE LIBRARY</a><span class="brand-note">アンケート回答者限定</span></header><main class="${layout}">${body}</main><footer>教材ライブラリ · ${escape(release.version)}${note}</footer></body></html>`;
}
const shelf = '<div class="shelf" aria-hidden="true"><i class="spine ink"></i><i class="spine forest"></i><i class="spine pale"></i><div class="shelf-book">LEARN<br>BUILD<br><b>REPEAT.</b></div></div>';
const waiting = '<div class="waiting" aria-hidden="true"><i class="spine ink"></i><i class="spine forest"></i><i class="spine dashed"></i></div>';
const logout = (nonce: string, label: string, note: string) => `<form method="post" action="/logout" class="logout"><input type="hidden" name="csrf" value="${escape(nonce)}"><button class="secondary">${label}</button><p class="muted">${note}</p></form>`;
// One centred card for every non-catalogue state: errors, the #7 preparation page and the closed page.
export function notice(options: { eyebrow: string; title: string; body: string; action?: { href: string; label: string }; note?: string; art?: boolean; role?: 'status'; after?: string }): string {
  const { eyebrow, title, body, action, note, art, role, after = '' } = options;
  return `<section class="card status-card"${role ? ` role="${role}"` : ''}>${art ? waiting : ''}<div class="eyebrow">${eyebrow}</div><h1>${escape(title)}</h1><p class="lead">${body}</p>${action ? `<a class="button" href="${action.href}">${action.label}</a>` : ''}${note ? `<p class="muted">${note}</p>` : ''}</section>${after}`;
}
export function login(csrf: string, error = ''): string {
  const invalid = error ? ' aria-invalid="true" aria-describedby="phrase-error"' : '';
  const note = error ? '続けて間違えると、1分ほど入力を受け付けなくなります。' : 'アンケート回答者限定の無料プレゼントです。PDFを開くパスワードは配布時のご案内をご確認ください。';
  return page('プレゼント教材を受け取る', `<div class="entry-copy"><div class="eyebrow">A GIFT FOR SURVEY RESPONDENTS</div><h1>次の学びを、<br>ひとつずつ。</h1><p class="lead">アンケートへのご協力、ありがとうございます。<br class="wide">回答後のご案内に記載された合言葉を入力してください。</p>${shelf}</div><section class="card login-card"><h2>TypeScript教材を受け取る</h2>${error ? `<p role="alert" class="error" id="phrase-error">${escape(error)}</p>` : ''}<form method="post" action="/login"><input type="hidden" name="csrf" value="${escape(csrf)}"><label for="phrase">アクセス用の合言葉</label><input id="phrase" type="password" name="phrase" required maxlength="256" autocomplete="current-password"${invalid}><button>教材ページを開く <span aria-hidden="true">→</span></button><p class="muted form-note">${note}</p><p class="muted busy-note">送信は1回で大丈夫です。画面が切り替わるまでお待ちください。</p></form></section>`, 'entry');
}
function links(course: Collection, group: string): string {
  return course.materials.filter(m => m.group === group).map(m => `<a class="download${m.group === 'bundle' ? ' bundle' : ''}" href="/download/${course.id}/${m.id}"><span>${escape(m.title)}</span><small>${m.type === 'application/pdf' ? 'PDF' : 'ZIP'}</small></a>`).join('');
}
const chapterCount = (course: Collection) => course.materials.filter(m => m.group === 'books').length;
const exerciseCount = (course: Collection) => course.materials.filter(m => m.group === 'exercises').length;
function missingExercises(course: Collection): string {
  const chapters = course.materials.filter(m => m.group === 'books').map(m => m.id.replace('chapter-', ''));
  const missing = chapters.filter(n => !exerciseChapterIds.includes(n)).map(n => `第${Number(n)}章`);
  return missing.length ? `${missing.join('・')}には練習問題がありません。` : '';
}
export function library(nonce: string, course: Collection): string {
  const verification = course.release?.verification;
  return page(course.title, `<a href="/library" class="breadcrumb">← プレゼント一覧へ</a><div class="eyebrow">YOUR TYPESCRIPT LEARNING GIFT</div><h1>TypeScriptを、<br>自分のペースで。</h1><p class="lead">学習の進め方を確認したら、本編と練習問題へ。<br class="wide">手元に保存して、ひとつずつ進めましょう。</p>${course.release?.synthetic ? '<p class="notice">ローカル確認用のダミー教材です。実教材と配布設定の確認が終わるまで本番配布は行いません。</p>' : ''}<section class="card"><div class="section-title"><b>01</b><h2>まずは学習の進め方から</h2></div><p class="lead wide-only">教材の読み方と進め方を確認しましょう。</p>${links(course, 'intro')}<a href="/guide" class="text-link">保存と閲覧の手順を見る →</a></section><section class="card"><div class="section-title"><b>02</b><h2>本編 ${chapterCount(course)}章</h2></div><p class="lead wide-only">必要な章を1つずつ保存できます。</p><div class="book-grid">${links(course, 'books')}</div></section><section class="card"><div class="section-title"><b>03</b><h2>練習問題 ${exerciseCount(course)}本</h2></div><p class="lead"><span class="wide-only">学んだ内容を手を動かして確かめましょう。</span>${missingExercises(course)}</p><div class="book-grid">${links(course, 'exercises')}</div></section><section class="card"><h2>まとめて手元に</h2>${links(course, 'bundle')}<p class="muted">ZIPを展開してからPDFを開いてください。PDF用パスワードは配布時のご案内をご確認ください。</p><p class="muted">${escape(verification?.delivery || '')} ${escape(verification?.materials || '')} ${escape(verification?.platforms || '')}</p></section>${logout(nonce, '教材ページを閉じる', 'アクセスは4時間で期限切れになります。続ける場合は再度合言葉を入力してください。')}`, 'course');
}
export function guide(): string {
  return page('保存と閲覧の手順', '<a href="/library" class="breadcrumb">← プレゼント一覧へ</a><div class="eyebrow">GETTING STARTED</div><h1>教材を手元に。</h1><section class="card"><ol><li>アンケート回答後のご案内から、合言葉を確認します。</li><li>TypeScript教材の「学習の進め方」と必要なPDFを保存します。</li><li>まとめて保存した場合はZIPを展開し、案内されたPDF用パスワードで開きます。</li></ol><h2>確認済みの範囲</h2><p>教材の確認済み環境は教材一覧に記載しています。お使いの環境が確認対象に含まれているかご確認ください。</p><p>配布版とPDFリーダーの案内もあわせてご確認ください。</p><a href="/library" class="text-link">← プレゼント一覧へ戻る</a></section>', 'course');
}
export function catalogue(nonce: string, local = false): string {
  const gifts = collections.filter(isSurveyGift);
  return page('プレゼント教材', `<div class="catalogue-hero"><div><div class="eyebrow">THANK YOU FOR YOUR FEEDBACK</div><h1>ご協力の感謝を、<br>次の学びに。</h1><p class="lead">アンケートにお答えいただいた方へ。<br class="wide">TypeScript教材を無料プレゼントとしてお届けします。</p></div><div class="hero-art" aria-hidden="true"><div class="cover-book"><div>LEARN<br>BUILD<br><b>REPEAT.</b></div><span>ONE STEP AT A TIME</span></div><div class="art-tag">一歩ずつ、自分のペースで。</div></div></div><div class="library-label"><h2>回答者限定プレゼント</h2><span>SURVEY GIFT</span></div>${gifts.map(c => {
    const available = canDistribute(c, local);
    const contents = `学習の進め方 / 本編 ${chapterCount(c)}章 / 練習問題 ${exerciseCount(c)}本<span class="wide-only"> / まとめて保存</span>`;
    return `<article class="course-card"><div class="course-cover"><div class="cover-title"><span>THANK-YOU GIFT</span><strong>${escape(c.cover).replaceAll('\n', '<br>')}</strong></div><div class="cover-mark">${escape(c.mark)}</div></div><div class="course-body"><span class="badge">${available ? collectionStatusLabel(c.status) : '配布準備中'}</span><h2>${escape(c.title)}</h2><p>${escape(c.description)}</p><div class="course-meta">${available ? contents : '回答後のご案内と配布版を確認しています'}</div><a class="course-action" href="/courses/${c.id}">${available ? c.release?.synthetic ? 'ダミー教材を見る' : '教材を受け取る' : '配布準備状況を見る'} <span aria-hidden="true">↗</span></a>${c.version && available ? `<small class="version">${c.version}</small>` : ''}</div></article>`;
  }).join('')}${logout(nonce, 'ライブラリを閉じる', 'アクセスの有効期限は4時間です。')}`, 'library');
}
export function pendingCourse(course: Collection, nonce: string): string {
  return page(`${course.title}の準備状況`, `<a href="/library" class="breadcrumb">← プレゼント一覧へ</a>${notice({ eyebrow: 'GETTING YOUR GIFT READY', title: course.title, body: 'アンケート回答者限定の無料プレゼントです。回答後のご案内と教材の配布設定を確認しています。準備が整い次第、こちらから受け取れるようになります。', action: { href: '/library', label: '一覧に戻る' }, note: '現在ダウンロードできるファイルはありません。', art: true, after: logout(nonce, 'ライブラリを閉じる', 'アクセスの有効期限は4時間です。') })}`);
}
export function preparingMaterial(course: Collection): string {
  return page('教材の準備中', notice({ eyebrow: 'GETTING READY', title: 'この教材はただいま準備中です', body: 'ファイルの用意が整っていないため、今は保存できません。少し時間をおいてから、もう一度お試しください。ほかの教材はそのまま受け取れます。', action: { href: `/courses/${course.id}`, label: '教材ページに戻る' }, note: 'しばらくたっても変わらない場合は、配布時のご案内にある連絡先へお知らせください。', art: true }));
}
export function closed(): string {
  return page('教材ページを閉じました', notice({ eyebrow: 'SEE YOU AGAIN', title: '教材ページを閉じました', body: 'この端末に残っていたアクセスの記録を消しました。保存したPDFとZIPは手元に残っています。続けて受け取るときは、もう一度合言葉を入力してください。', action: { href: '/', label: '入口へ戻る' }, role: 'status' }));
}
export function message(title: string, body = '', action = { href: '/', label: '入口へ戻る' }): string {
  return page(title, notice({ eyebrow: 'NOTICE', title, body, action }));
}
// Progressive enhancement only: the form already submits without this script.
// The input becomes read-only, not disabled, because disabled fields are left out of the submission.
export const js = `for(const form of document.querySelectorAll('form')){form.addEventListener('submit',()=>{const button=form.querySelector('button');if(button){button.dataset.label=button.innerHTML;button.textContent='確認しています…';const spinner=document.createElement('span');spinner.className='spinner';spinner.setAttribute('aria-hidden','true');button.append(spinner);button.disabled=true;form.setAttribute('aria-busy','true');}for(const input of form.querySelectorAll('input[type=password]'))input.readOnly=true;});}window.addEventListener('pageshow',()=>{for(const form of document.querySelectorAll('form')){form.removeAttribute('aria-busy');for(const input of form.querySelectorAll('input[type=password]'))input.readOnly=false;const button=form.querySelector('button');if(button?.dataset.label){button.innerHTML=button.dataset.label;delete button.dataset.label;button.disabled=false;}}});`;
// Values follow the reviewed design boards (PC 1440 / mobile 390). No external fonts or images.
export const css = `:root{color-scheme:light;--paper:#f4f6f1;--ink:#1f3341;--muted:#536875;--line:#d9e3e4;--accent:#11675d;--accent-dark:#0b4a43;--pale:#c9d8cf;--field:#82969c;--error:#9b231f;--error-bg:#fbeaea;--busy:#4d7f78}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font:16px/1.8 system-ui,-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif}
a{color:var(--accent)}a:hover{color:var(--accent-dark)}
a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #c07424;outline-offset:4px}
header{background:#fff;border-bottom:1px solid var(--line);padding:22px 72px;display:flex;align-items:baseline;gap:14px}
.brand{font-weight:800;letter-spacing:.12em;color:var(--ink);text-decoration:none;font-size:16px}
.brand-note{font-size:12px;color:var(--muted)}
main{flex:1;width:100%}
footer{padding:28px 24px;text-align:center;color:var(--muted);font-size:12px;border-top:1px solid var(--line);line-height:1.8}
.note-short{display:none}
h1{margin:0;font-size:48px;line-height:1.5;letter-spacing:.025em;font-weight:800}
h2{margin:0;font-size:21px}
p{margin:0}
.eyebrow{color:var(--accent);font-size:12px;letter-spacing:.18em;font-weight:800}
.lead{color:var(--muted);line-height:1.9}
.muted{font-size:13px;color:var(--muted);line-height:1.8}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:32px;display:flex;flex-direction:column;gap:12px}
.button{align-self:flex-start;margin-top:8px;padding:13px 22px;border-radius:9px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
.button:hover{background:var(--accent-dark);color:#fff}
.spine{display:block;border-radius:4px 4px 2px 2px}.spine.ink{background:var(--ink)}.spine.forest{background:var(--accent)}.spine.pale{background:var(--pale)}.spine.dashed{border:2px dashed var(--field);border-radius:3px}
.entry{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:72px;align-items:center;width:min(1200px,100% - 48px);margin:0 auto;padding:88px 0}
.entry-copy{display:flex;flex-direction:column;gap:20px}
.shelf{margin-top:28px;display:flex;align-items:flex-end;gap:10px;height:180px}
.shelf .spine.ink{width:46px;height:150px}.shelf .spine.forest{width:38px;height:170px}.shelf .spine.pale{width:52px;height:132px}
.shelf-book{width:120px;height:160px;background:#fff;border:1px solid var(--line);border-radius:6px 14px 14px 6px;box-shadow:inset 10px 0 0 var(--accent);display:flex;flex-direction:column;justify-content:center;padding-left:26px;font-size:13px;font-weight:800;letter-spacing:.08em;line-height:1.5}
.shelf-book b,.cover-book b{color:var(--accent)}
.login-card{padding:40px;gap:0}
.login-card h2{margin:0 0 10px}
.login-card form{display:flex;flex-direction:column}
.error{margin:6px 0 4px;padding:12px 14px;border-radius:8px;background:var(--error-bg);color:var(--error);font-size:15px;line-height:1.7}
label{font-weight:600;margin-top:12px;font-size:15px}
.error+form label{margin-top:14px}
input[type=password]{margin-top:8px;padding:14px;border:1px solid var(--field);border-radius:8px;font:inherit;font-size:16px;width:100%}
input[aria-invalid=true]{border:2px solid var(--error)}
button{margin-top:22px;padding:15px 20px;border:0;border-radius:9px;background:var(--accent);color:#fff;font:inherit;font-size:16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer;width:100%}
button:disabled{background:var(--busy);cursor:wait}
.spinner{width:18px;height:18px;border:3px solid #fff;border-right-color:transparent;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.form-note{margin-top:18px}.busy-note{display:none;margin-top:18px}
form[aria-busy=true] .form-note{display:none}form[aria-busy=true] .busy-note{display:block}
form[aria-busy=true] input[type=password]{border:1px solid #b7c4c8;background:var(--paper);color:var(--muted)}
.library{width:min(1120px,100% - 48px);margin:0 auto;padding:72px 0;display:flex;flex-direction:column;gap:40px}
.catalogue-hero{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:56px;align-items:center}
.catalogue-hero>div:first-child{display:flex;flex-direction:column;gap:18px}
.library h1{font-size:46px;letter-spacing:0}
.hero-art{display:flex;justify-content:center;align-items:center;gap:24px}
.cover-book{width:210px;height:270px;background:#fff;border:1px solid var(--line);border-radius:8px 22px 22px 8px;box-shadow:inset 14px 0 0 var(--ink);display:flex;flex-direction:column;justify-content:space-between;padding:30px 26px 26px 44px}
.cover-book div{font-size:18px;font-weight:800;letter-spacing:.08em;line-height:1.5}
.cover-book span{font-size:10px;letter-spacing:.16em;color:var(--muted)}
.art-tag{padding:10px 16px;background:var(--ink);color:#fff;border-radius:999px;font-size:13px}
.library-label{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:12px}
.library-label span{font-size:12px;letter-spacing:.16em;color:var(--muted)}
.course-card{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}
.course-cover{background:var(--accent);color:#fff;padding:30px;display:flex;flex-direction:column;justify-content:space-between;min-height:260px}
.cover-title{display:contents}.cover-title span{font-size:11px;letter-spacing:.18em}
.course-cover strong{font-size:26px;line-height:1.4}
.cover-mark{align-self:flex-end;width:56px;height:56px;border:2px solid #fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800}
.course-body{grid-column:span 2;padding:34px 40px;display:flex;flex-direction:column;gap:12px}
.badge{align-self:flex-start;padding:4px 12px;border-radius:999px;background:#e3f0ea;color:var(--accent-dark);font-size:12px;font-weight:700}
.course-body h2{font-size:24px}
.course-body p{color:var(--muted);line-height:1.8}
.course-meta{font-size:14px;color:var(--muted)}
.course-action{margin-top:10px;align-self:flex-start;padding:13px 22px;border-radius:9px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
.course-action:hover{background:var(--accent-dark);color:#fff}
.version{font-size:11px;color:var(--muted)}
.course{width:min(920px,100% - 48px);margin:0 auto;padding:56px 0;display:flex;flex-direction:column;gap:24px}
.course h1{font-size:44px;letter-spacing:0}
.breadcrumb{font-size:14px;align-self:flex-start}
.notice{padding:14px 20px;background:#fff0cd;border-radius:10px;font-size:14px}
.section-title{display:flex;align-items:baseline;gap:16px}.section-title b{color:var(--accent);font-size:14px}
.download{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:8px;text-decoration:none}
.download:hover{background:#eaf5ed}
.download small{white-space:nowrap;color:var(--muted)}
.download.bundle{background:#edf5eb}
.book-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px}
.text-link{font-size:15px;align-self:flex-start}
.logout{width:min(460px,100%);margin:16px auto 0;text-align:center;display:flex;flex-direction:column;gap:10px}
.logout .secondary{margin:0;justify-content:center;background:transparent;color:var(--accent);border:1px solid var(--accent)}
.logout .secondary:disabled{color:var(--busy);border-color:var(--busy)}
.logout .secondary .spinner{display:none}
.status{display:flex;flex-direction:column;justify-content:center;align-items:center;padding:56px}
.status .breadcrumb{width:min(600px,100%);margin-bottom:16px}
.status-card{width:min(600px,100%);padding:44px;gap:16px}
.status-card h1{font-size:30px;letter-spacing:0}
.waiting{display:flex;align-items:flex-end;gap:8px;height:72px}
.waiting .spine{border-radius:3px}.waiting .ink{width:22px;height:64px}.waiting .forest{width:18px;height:72px}.waiting .dashed{width:22px;height:56px}
ol{margin:0;padding-left:22px}li{margin:10px 0}
@media(max-width:720px){
header{padding:16px 20px;flex-direction:column;align-items:flex-start;gap:2px}
.brand{font-size:15px}
footer{padding:20px 18px}
.note-long,.wide,.wide-only{display:none}.note-short{display:inline}
h1,.library h1,.course h1{font-size:30px;letter-spacing:0}
h2{font-size:19px}
.eyebrow{font-size:11px;letter-spacing:.16em}
.lead{font-size:15px;line-height:1.8}
.card{border-radius:14px;padding:22px 18px;gap:10px}
.button,.course-action{align-self:stretch;min-height:52px;padding:14px 18px;display:flex;justify-content:center;align-items:center}
.course-action{justify-content:space-between}
.entry{display:flex;flex-direction:column;gap:14px;align-items:stretch;width:100%;padding:32px 18px}
.entry-copy{gap:14px}
.shelf{display:none}
.login-card{margin-top:10px;padding:22px 18px}
.login-card h2{margin-bottom:6px}
.error{font-size:14px;padding:12px}
.error+form label{margin-top:12px}
button{margin-top:18px;min-height:52px;padding:14px 18px}
.form-note,.busy-note{margin-top:14px}
.library{width:100%;padding:32px 18px;gap:16px}
.catalogue-hero{display:flex;flex-direction:column;gap:16px;align-items:stretch}
.catalogue-hero>div:first-child{gap:16px}
.hero-art{margin:12px 0}
.cover-book{width:160px;height:206px;border-radius:6px 18px 18px 6px;box-shadow:inset 11px 0 0 var(--ink);padding:22px 18px 18px 32px}
.cover-book div{font-size:15px}.cover-book span{font-size:9px;letter-spacing:.14em}
.art-tag{display:none}
.library-label{padding-bottom:10px}.library-label span{font-size:11px;letter-spacing:.14em}
.course-card{display:flex;flex-direction:column;border-radius:14px}
.course-cover{flex-direction:row;align-items:flex-end;min-height:150px;padding:22px}
.cover-title{display:flex;flex-direction:column;gap:18px}.cover-title span{font-size:10px;letter-spacing:.16em}
.course-cover{justify-content:space-between}
.course-cover strong{font-size:22px}
.cover-mark{width:46px;height:46px;border-radius:9px;align-self:auto;flex:none}
.course-body{padding:22px 18px;gap:10px}
.course-body h2{font-size:20px}.course-body p{font-size:15px}.course-meta{font-size:13px}
.course{width:100%;padding:28px 18px;gap:16px}
.breadcrumb{min-height:44px;display:flex;align-items:center}
.section-title{gap:12px}.section-title b{font-size:13px}
.course .card .lead{font-size:14px}
.download{min-height:48px;padding:12px;align-items:center}
.book-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.logout{margin-top:8px}
.logout .secondary{min-height:52px}
.status{display:block;padding:36px 18px}
.status .breadcrumb{margin-bottom:8px}
.status-card{padding:26px 20px;gap:14px}
.status-card h1{font-size:24px}
.waiting{gap:7px;height:60px}.waiting .ink{width:18px;height:52px}.waiting .forest{width:15px;height:60px}.waiting .dashed{width:18px;height:46px}
}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.spinner{animation:none}}
`;
