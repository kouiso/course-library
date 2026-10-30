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
