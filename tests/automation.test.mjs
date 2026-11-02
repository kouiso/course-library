import { test } from 'node:test';
import assert from 'node:assert/strict';
import { client, upsertMarkerComment } from '../scripts/automation/github-api.mjs';
import { MARKER, evaluate, render } from '../scripts/automation/body-format.mjs';

const human = { login: 'synthetic-writer', type: 'User' };
const fullIssue = '## 背景\n合成の背景。\n## 今どこまで\n- 調べた\n## 次にやること\n- 直す\n## 誰の判断待ち\nなし\n## 完了条件\n- [ ] 試験が通る\n';
// A recording fake of the REST API. No network is used.
function fakeApi(comments = []) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ method: init.method, path: new URL(url).pathname + new URL(url).search, body: init.body && JSON.parse(init.body) });
    if (init.method === 'GET') return new Response(JSON.stringify(comments), { status: 200 });
    return new Response(JSON.stringify({}), { status: init.method === 'POST' ? 201 : 200 });
  };
  return { api: client({ token: 'synthetic-token', repository: 'example/repo', fetchImpl }), calls };
}

test('issue format: all five headings with content pass; empty, dash-only and comment-only headings fail', () => {
  assert.deepEqual(evaluate({ kind: 'issue', body: fullIssue, author: human }), { ok: true, missing: [] });
  const form = fullIssue.replaceAll('## ', '### ').replace('合成の背景。', '_No response_').replace('- 調べた', '-').replace('- 直す', '<!-- 未記入 -->');
  assert.deepEqual(evaluate({ kind: 'issue', body: form, author: human }).missing, ['背景', '今どこまで', '次にやること']);
  assert.deepEqual(evaluate({ kind: 'issue', body: '## 背景\n本文\n', author: human }).missing, ['今どこまで', '次にやること', '誰の判断待ち', '完了条件']);
  assert.equal(evaluate({ kind: 'issue', body: '```\n## 背景\n```\n', author: human }).missing.includes('背景'), true);
});
test('PR format: summary, changes and a Closes/Refs link are required; the default template headings are accepted', () => {
  const ok = '## 概要\n合成。\n## 変更内容\n- 一つ\n## 関連Issue\nRefs #8\n## スクリーンショット\n';
  assert.equal(evaluate({ kind: 'pr', body: ok, author: human }).ok, true);
  const defaults = '## 関連 Issue\n<!-- 説明 -->\n- Closes #7\n- Refs:\n## 概要・背景・妥協点\n合成。\n## やったこと\n- 一つ\n';
  assert.equal(evaluate({ kind: 'pr', body: defaults, author: human }).ok, true);
  const unlinked = '## 関連 Issue\n- Closes #\n- Refs:\n## 概要・背景・妥協点\n合成。\n## やったこと\n-\n';
  assert.deepEqual(evaluate({ kind: 'pr', body: unlinked, author: human }).missing, ['変更内容', '関連Issue']);
  assert.match(render('pr', evaluate({ kind: 'pr', body: unlinked, author: human })), /Closes #番号/);
});
test('bots, draft PRs and alert issues are out of scope', () => {
  assert.deepEqual(evaluate({ kind: 'pr', body: '', author: { login: 'dependabot[bot]', type: 'Bot' } }), { skipped: 'bot-author' });
  assert.deepEqual(evaluate({ kind: 'pr', body: '', author: human, draft: true }), { skipped: 'draft-pr' });
  assert.deepEqual(evaluate({ kind: 'issue', body: '', author: human, labels: [{ name: 'alert' }] }), { skipped: 'alert-issue' });
});
test('the marked comment is created once on red, updated after fixes and never duplicated', async () => {
  const red = render('issue', evaluate({ kind: 'issue', body: '', author: human }));
  const first = fakeApi();
  assert.equal(await upsertMarkerComment(first.api, 5, MARKER, red), 'created');
  assert.deepEqual(first.calls.map(c => `${c.method} ${c.path.split('?')[0]}`), ['GET /repos/example/repo/issues/5/comments', 'POST /repos/example/repo/issues/5/comments']);
  const green = render('issue', evaluate({ kind: 'issue', body: fullIssue, author: human }));
  const existing = [{ id: 41, user: { login: 'someone' }, body: MARKER }, { id: 42, user: { login: 'github-actions[bot]', type: 'Bot' }, body: red }];
  const second = fakeApi(existing);
  assert.equal(await upsertMarkerComment(second.api, 5, MARKER, green, { createIfMissing: false }), 'updated');
  assert.deepEqual(second.calls.at(-1), { method: 'PATCH', path: '/repos/example/repo/issues/comments/42', body: { body: `${MARKER}\n書き方チェック: OK` } });
  const clean = fakeApi();
  assert.equal(await upsertMarkerComment(clean.api, 5, MARKER, green, { createIfMissing: false }), 'skipped');
  assert.equal(clean.calls.length, 1);
});
test('every workflow is manual-only, has explicit permissions and pins external actions to a commit SHA', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const files = (await readdir('.github/workflows')).filter(f => /\.ya?ml$/.test(f));
  assert.ok(files.length >= 2);
  for (const file of files) {
    const text = await readFile(`.github/workflows/${file}`, 'utf8');
    const on = /^on:\n((?:[ #].*\n|\n)*)/m.exec(text);
    assert.ok(on, file);
    const triggers = on[1].split('\n').filter(line => /^  [a-z_]+:/.test(line)).map(line => line.trim().replace(/:.*/, ''));
    assert.deepEqual(triggers, ['workflow_dispatch'], `${file} must not start on push, PR, issue or schedule events`);
    assert.match(text, /^permissions:\n/m, file);
    assert.doesNotMatch(text, /pull_request_target/, file);
    if (file !== 'verify.yml') assert.doesNotMatch(text, /secrets\./, `${file} must run with GITHUB_TOKEN only`);
    for (const [, ref] of text.matchAll(/uses:\s*\S+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, file);
  }
});
test('issue heading fix lifts ### to ## and #### to ### once, outside code blocks only', async () => {
  const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
  const form = '### 背景\n本文\n#### 詳細\n## 既存\n##### 深い\n```\n### コード\n```\n###見出しではない';
  assert.deepEqual(fixHeadings(form), { body: '## 背景\n本文\n### 詳細\n## 既存\n##### 深い\n```\n### コード\n```\n###見出しではない', changed: true });
  assert.deepEqual(fixHeadings(fullIssue), { body: fullIssue, changed: false });
  assert.deepEqual(fixHeadings(null), { body: '', changed: false });
});
test('the issue form requires exactly the checked headings, and its rendered body passes after the heading fix', async () => {
  const { readFile } = await import('node:fs/promises');
  const { issueSections } = await import('../scripts/automation/body-format.mjs');
  const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
  const form = await readFile('.github/ISSUE_TEMPLATE/request.yml', 'utf8');
  const fields = [...form.matchAll(/- type: textarea\n(?:.*\n)*?\s+label: "([^"]+)"\n(?:.*\n)*?\s+required: (true|false)/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(fields, issueSections.map(s => [s.name, 'true']));
  // GitHub renders each form field as "### label" followed by the answer.
  const rendered = fields.map(([label]) => `### ${label}\n\n合成の${label}`).join('\n\n');
  assert.equal(evaluate({ kind: 'issue', body: fixHeadings(rendered).body, author: human }).ok, true);
  const unanswered = fields.map(([label]) => `### ${label}\n\n_No response_`).join('\n\n');
  assert.equal(evaluate({ kind: 'issue', body: fixHeadings(unanswered).body, author: human }).missing.length, 5);
});
test('PR assignee is the human author; bots and already-assigned authors are left alone', async () => {
  const { assignment } = await import('../scripts/automation/pr-settings.mjs');
  assert.deepEqual(assignment({ user: human, assignees: [] }), { assign: 'synthetic-writer', reason: 'author' });
  assert.deepEqual(assignment({ user: human, assignees: [human] }), { assign: null, reason: 'already-assigned' });
  assert.deepEqual(assignment({ user: { login: 'renovate[bot]', type: 'Bot' }, assignees: [] }), { assign: null, reason: 'bot-author' });
});
test('PR labels come from the branch prefix and changed paths, and existing labels are never removed', async () => {
  const { labelsFor } = await import('../scripts/automation/pr-settings.mjs');
  for (const [branch, label] of [['feature/a', 'feature'], ['feat/a', 'feature'], ['bugfix/a', 'bugfix'], ['fix/a', 'bugfix'], ['hotfix/a', 'hotfix'], ['chore/a', 'chore'], ['refactor/a', 'chore'], ['docs/a', 'documentation'], ['release/a', 'release']]) {
    assert.deepEqual(labelsFor(branch, []), [label], branch);
  }
  assert.deepEqual(labelsFor('ccr-synthetic', ['src/index.ts']), []);
  assert.deepEqual(labelsFor('fix/x', ['docs/SECURITY.md', 'wrangler.jsonc', '.github/workflows/verify.yml', 'package-lock.json', 'src/views.ts']), ['bugfix', 'config', 'dependencies', 'documentation']);
  assert.deepEqual(labelsFor('fix/x', ['README.md'], [{ name: 'bugfix' }, { name: 'keep-me' }]), ['documentation']);
  assert.deepEqual(labelsFor('features/x', ['src/featured.ts']), []);
});
test('the code secret scan pins a gitleaks release by version and checksum and redacts findings', async () => {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile('.github/workflows/secret-scan.yml', 'utf8');
  assert.match(text, /GITLEAKS_VERSION: \d+\.\d+\.\d+\n/);
  assert.match(text, /GITLEAKS_SHA256: [0-9a-f]{64}\n/);
  assert.match(text, /sha256sum -c -/);
  assert.match(text, /--redact/);
  assert.match(text, /fetch-depth: 0/);
  assert.doesNotMatch(text, /issues:|pull-requests:|write/);
});
test('public content check flags synthetic secrets, DB info and personal email without echoing them, and passes plain text', async () => {
  const { loadRules, scan, render } = await import('../scripts/automation/public-content.mjs');
  const rules = await loadRules('.github/public-content-rules.json');
  // Synthetic values are assembled at run time so the repository never contains a literal match.
  const token = 'gh' + 'p_' + 'Synthetic0Only0Value0Abcdefghijkl12';
  const key = '-----BEGIN ' + 'PRIVATE KEY-----';
  const assignment = 'SESSION_' + 'SECRET=' + 'synthetic-value-0001';
  const database = 'postgres' + '://synthetic-user:pw@db.invalid:5432/library';
  const email = 'synthetic.person' + '@' + 'mail.invalid';
  const body = ['## 背景', `値は ${token} です`, key, assignment, `接続先 ${database}`, `連絡先 ${email} と ${email}`].join('\n');
  const hits = scan([{ label: 'title', text: '合成のタイトル' }, { label: 'body', text: body }], rules);
  assert.deepEqual(hits, [
    { rule: 'token-github', lines: [2], count: 1 },
    { rule: 'private-key-block', lines: [3], count: 1 },
    { rule: 'secret-assignment', lines: [4], count: 1 },
    { rule: 'database-url', lines: [5], count: 1 },
    // user:password@host inside a database URL also looks like an address; both rules report it.
    { rule: 'personal-email', lines: [5, 6], count: 3 },
  ]);
  const comment = render('issue', '12', hits);
  for (const secret of [token, key, assignment, database, email, 'synthetic', 'mail.invalid']) assert.ok(!comment.includes(secret), 'comment must not echo matched text');
  assert.match(comment, /\| personal-email \| 5, 6 \| 3 \|/);
  const plain = '## 背景\nTypeScript教材の配布画面を直しました。SESSION_SECRET は手順書どおり別の場所で管理します。\n連絡は noreply@users.noreply.github.com 経由、例は someone@example.com です。';
  assert.deepEqual(scan([{ label: 'title', text: '画面の修正' }, { label: 'body', text: plain }], rules), []);
  assert.match(render('pr', '3', []), /: OK$/);
  assert.deepEqual(scan([{ label: 'title', text: `件名 ${email}` }], rules), [{ rule: 'personal-email', lines: ['title:1'], count: 1 }]);
});
test('public content rules are replaceable and malformed rule files fail closed', async () => {
  const { loadRules, scan } = await import('../scripts/automation/public-content.mjs');
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const folder = await mkdtemp(join(tmpdir(), 'public-rules-'));
  try {
    const custom = join(folder, 'rules.json');
    await writeFile(custom, JSON.stringify({ version: 1, rules: [{ name: 'forbidden-word', pattern: 'ごうせいきんしご', flags: 'i' }] }));
    const rules = await loadRules(custom);
    assert.deepEqual(scan([{ label: 'body', text: '一行目\nここに ごうせいきんしご がある' }], rules), [{ rule: 'forbidden-word', lines: [2], count: 1 }]);
    assert.deepEqual(scan([{ label: 'body', text: '普通の文章です。' }], rules), []);
    for (const bad of [{}, { version: 1, rules: [] }, { version: 1, rules: [{ name: 'Bad Name', pattern: 'x' }] }, { version: 1, rules: [{ name: 'a', pattern: 'x' }, { name: 'a', pattern: 'y' }] }, { version: 1, rules: [{ name: 'a', pattern: '(' }] }, { version: 1, rules: [{ name: 'a', pattern: 'x', flags: 'g' }] }]) {
      await writeFile(custom, JSON.stringify(bad));
      await assert.rejects(loadRules(custom));
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('long and mixed code fences preserve literal headings and outside sections', async () => {
  const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
  const { sections } = await import('../scripts/automation/body-format.mjs');
  for (const [open, nested, close] of [['````js', '```', '````'], ['~~~~', '```', '~~~~'], ['````', '~~~', '`````']]) {
    const code = [open, nested, '### literal code', close].join('\n');
    const source = code + '\n### outside\nreal';
    assert.equal(fixHeadings(source).body, code + '\n## outside\nreal');
    const found = sections(source);
    assert.equal(found.has('literalcode'), false);
    assert.equal(found.get('outside'), 'real');
  }
});

test('list and quote fenced code never becomes a heading section', async () => {
  const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
  const { sections } = await import('../scripts/automation/body-format.mjs');
  for (const [start, indent] of [['- ', '  '], ['1. ', '   '], ['> ', '> ']]) {
    const code = start + '```\n' + indent + '### literal code\n' + indent + '```';
    const body = code + '\n### outside\nreal';
    assert.equal(fixHeadings(body).body, code + '\n## outside\nreal');
    assert.equal(sections(body).has('literalcode'), false);
    assert.equal(sections(body).get('outside'), 'real');
  }
});

test('literal container markers inside plain fences cannot close the code block', async () => {
  const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
  const { sections } = await import('../scripts/automation/body-format.mjs');
  for (const literal of ['- ```', '> ```', '1. ```']) {
    const code = ['```', literal, '### literal code', '```'].join('\n');
    const source = code + '\n### outside\nreal';
    assert.equal(fixHeadings(source).body, code + '\n## outside\nreal');
    assert.equal(sections(source).has('literalcode'), false);
    assert.equal(sections(source).get('outside'), 'real');
  }
});

test('unclosed container fences end when the quote or list ends', async () => {
  const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
  const { sections } = await import('../scripts/automation/body-format.mjs');
  for (const code of ['> ```\n> ### literal code', '- ```\n  ### literal code']) {
    const source = code + '\n\n### outside\nreal';
    assert.equal(fixHeadings(source).body, code + '\n\n## outside\nreal');
    assert.equal(sections(source).has('literalcode'), false);
    assert.equal(sections(source).get('outside'), 'real');
  }
});

test('tab-indented code is never rewritten as headings', async () => {
 const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
 for (const code of ['\t### literal', ' \t#### literal', '    ### literal']) assert.equal(fixHeadings(code).body, code);
});
test('parent section includes nested body but never borrows sibling content', async () => {
 const { sections } = await import('../scripts/automation/body-format.mjs');
 const found = sections('## 概要\n### 現状\n本文\n#### 詳細\n説明\n## 変更内容\n### 空欄\n## 別節\n隣の本文');
 assert.match(found.get('概要'), /本文/); assert.match(found.get('概要'), /説明/);
 assert.equal(found.get('変更内容').trim(), ''); assert.doesNotMatch(found.get('概要'), /隣の本文/);
});

test('CRLF fences preserve code and retain original line endings', async () => {
 const { fixHeadings } = await import('../scripts/automation/heading-fix.mjs');
 const { sections } = await import('../scripts/automation/body-format.mjs');
 const code = '```js\r\n### literal code\r\n```\r\n';
 assert.equal(fixHeadings(code+'### outside\r\nreal').body, code+'## outside\r\nreal');
 assert.equal(sections(code+'### outside\r\nreal').has('literalcode'), false);
});
test('secret reports emit only safe finding location metadata', async () => {
 const { safeFindings } = await import('../scripts/automation/secret-report.mjs');
 const result=safeFindings([{File:'fixture.ts',Commit:'a'.repeat(40),StartLine:7,RuleID:'fixture-rule',Secret:'PRIVATE_SENTINEL',Match:'PRIVATE_MATCH'}]);
 assert.deepEqual(result,[{file:'fixture.ts',commit:'a'.repeat(40),line:7,rule:'fixture-rule'}]);
 assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
 assert.throws(()=>safeFindings(null)); assert.throws(()=>safeFindings([{}]));
});

test('email exemptions match the complete host rather than a domain prefix', async () => {
 const { loadRules, scan } = await import('../scripts/automation/public-content.mjs');
 const rules=(await loadRules('.github/public-content-rules.json')).filter(r=>r.name==='personal-email');
 for (const host of ['example.com.private.invalid','example.com-private.invalid','users.noreply.github.com.private.invalid','anthropic.com.private.invalid']) assert.equal(scan([{label:'body',text:'person'+'@'+host}],rules).length,1,host);
 for (const host of ['example.com','sub.example.com','users.noreply.github.com','noreply.github.com','anthropic.com']) for(const suffix of ['', '.', ',']) assert.equal(scan([{label:'body',text:'person'+'@'+host+suffix}],rules).length,0,host+suffix);
});
