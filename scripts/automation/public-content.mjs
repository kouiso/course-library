// Public content check for issue, PR and comment text (#8 item 1).
// It reports rule names, line numbers and counts only. It never edits or deletes the text.
import { readFile } from 'node:fs/promises';
import { client, runDirectly, upsertMarkerComment } from './github-api.mjs';
export const DEFAULT_RULES = '.github/public-content-rules.json';
export async function loadRules(path = process.env.PUBLIC_CONTENT_RULES || DEFAULT_RULES) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  if (data?.version !== 1 || !Array.isArray(data.rules) || !data.rules.length) throw new Error('Rules file must have version 1 and a non-empty rules array');
  const names = new Set();
  return data.rules.map(rule => {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(rule?.name || '') || names.has(rule.name)) throw new Error('Each rule needs a unique lowercase name');
    if (typeof rule.pattern !== 'string' || !/^[imsu]*$/.test(rule.flags || '')) throw new Error(`Rule ${rule.name} has an invalid pattern or flags`);
    names.add(rule.name);
    return { name: rule.name, regex: new RegExp(rule.pattern, `${rule.flags || ''}g`) };
  });
}
// fields: [{ label, text }]. Lines are numbered per field from 1.
export function scan(fields, rules) {
  const hits = [];
  for (const rule of rules) {
    const lines = [];
    let count = 0;
    for (const { label, text } of fields) {
      String(text ?? '').replace(/\r\n?/g, '\n').split('\n').forEach((line, i) => {
        rule.regex.lastIndex = 0;
        const n = [...line.matchAll(rule.regex)].length;
        if (n) { count += n; lines.push(label === 'body' ? i + 1 : `${label}:${i + 1}`); }
      });
    }
    if (count) hits.push({ rule: rule.name, lines, count });
  }
  return hits;
}
export const marker = (kind, id) => `<!-- course-library:public-content:${kind}:${id} -->`;
const labels = { issue: 'issue本文', pr: 'PR本文', issue_comment: 'コメント', review_comment: 'レビューコメント' };
export function render(kind, id, hits) {
  const head = `${marker(kind, id)}\n公開内容チェック（${labels[kind]} ${kind.endsWith('comment') ? `id ${id}` : `#${id}`}）: `;
  if (!hits.length) return `${head}OK`;
  return `${head}外に出してはいけない内容に当たる規則がありました。当たった文字はここには書きません。本文の編集・削除はしていません。\n\n| 規則 | 行 | 件数 |\n|---|---|---|\n${hits.map(h => `| ${h.rule} | ${h.lines.join(', ')} | ${h.count} |`).join('\n')}`;
}
async function main() {
  const kind = process.env.TARGET_KIND, id = process.env.TARGET_ID || '';
  if (!['issue', 'pr', 'issue_comment', 'review_comment'].includes(kind) || !/^[1-9]\d{0,15}$/.test(id)) throw new Error('TARGET_KIND and a numeric TARGET_ID are required');
  const rules = await loadRules(), api = client();
  let number, fields;
  if (kind === 'issue' || kind === 'pr') {
    const item = await api('GET', `/issues/${id}`);
    number = Number(id); fields = [{ label: 'title', text: item.title }, { label: 'body', text: item.body }];
  } else {
    const comment = await api('GET', kind === 'issue_comment' ? `/issues/comments/${id}` : `/pulls/comments/${id}`);
    number = Number(/\/(\d+)$/.exec(comment.issue_url || comment.pull_request_url || '')?.[1]);
    if (!number) throw new Error('Comment parent not found');
    fields = [{ label: 'body', text: comment.body }];
  }
  const hits = scan(fields, rules);
  const result = await upsertMarkerComment(api, number, marker(kind, id), render(kind, id, hits), { createIfMissing: hits.length > 0 });
  console.log(JSON.stringify({ kind, id, parent: number, hits, comment: result }));
  if (hits.length) process.exitCode = 1;
}
if (runDirectly(import.meta)) await main();
