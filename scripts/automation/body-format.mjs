// Issue / PR body format check (#8 item 2). Plain text rules only, no AI.
import { client, isBot, runDirectly, targetNumber, upsertMarkerComment } from './github-api.mjs';
export const MARKER = '<!-- course-library:body-format -->';
export const issueSections = [
  { name: '背景' }, { name: '今どこまで' }, { name: '次にやること' }, { name: '誰の判断待ち' }, { name: '完了条件' },
];
// Aliases accept the account-wide default PR template (関連 Issue / 概要・背景・妥協点 / やったこと).
export const prSections = [
  { name: '概要', aliases: ['概要・背景・妥協点'] },
  { name: '変更内容', aliases: ['やったこと'] },
  { name: '関連Issue', aliases: ['関連 Issue'], pattern: /\b(?:Closes|Refs):?\s+(?:[\w.-]+\/[\w.-]+)?#\d+/i },
];
export const alertLabels = ['alert', 'alerts'];
const normalize = heading => heading.replace(/[（(]\s*(?:必須|任意)\s*[）)]/g, '').replace(/\s+/g, '').replace(/[:：]$/, '');
export function sections(markdown) {
  const found = new Map();
  let current = null, fence = false;
  for (const line of String(markdown || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = !fence && /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) { current = normalize(heading[1]); if (!found.has(current)) found.set(current, []); continue; }
    if (current) found.get(current).push(line);
  }
  return new Map([...found].map(([k, v]) => [k, v.join('\n')]));
}
// A heading with only a dash, an empty checkbox, an HTML comment or the form placeholder is unfilled.
export function filled(content) {
  const text = String(content || '').replace(/<!--[\s\S]*?(?:-->|$)/g, '').replace(/_No response_/g, '');
  return text.split('\n').some(line => !/^\s*(?:[-*+]\s*)?(?:\[[ xX]?\]\s*)?(?:>\s*)?$/.test(line));
}
export function evaluate({ kind, body, author, draft = false, labels = [] }) {
  if (isBot(author)) return { skipped: 'bot-author' };
  if (kind === 'pr' && draft) return { skipped: 'draft-pr' };
  if (kind === 'issue' && labels.some(l => alertLabels.includes(String(l.name ?? l).toLowerCase()))) return { skipped: 'alert-issue' };
  const rules = kind === 'pr' ? prSections : issueSections;
  const parsed = sections(body);
  const missing = rules.filter(rule => {
    const names = [rule.name, ...(rule.aliases || [])].map(normalize);
    const content = names.filter(n => parsed.has(n)).map(n => parsed.get(n)).join('\n');
    return !filled(content) || (rule.pattern && !rule.pattern.test(content.replace(/<!--[\s\S]*?-->/g, '')));
  }).map(rule => rule.name);
  return { ok: missing.length === 0, missing };
}
export function render(kind, result) {
  if (result.ok) return `${MARKER}\n書き方チェック: OK`;
  const target = kind === 'pr' ? 'PR' : 'issue';
  return `${MARKER}\n書き方チェック: ${target}本文に、中身が書かれていない見出しがあります。\n\n${result.missing.map(name => `- ${name}`).join('\n')}${kind === 'pr' && result.missing.includes('関連Issue') ? '\n\n関連Issueには `Closes #番号` か `Refs #番号` を書いてください。' : ''}\n\n直すとこのコメントが更新されます。`;
}
async function main() {
  const kind = process.env.TARGET_KIND;
  if (!['issue', 'pr'].includes(kind)) throw new Error('TARGET_KIND must be issue or pr');
  const number = targetNumber(), api = client();
  const item = kind === 'pr' ? await api('GET', `/pulls/${number}`) : await api('GET', `/issues/${number}`);
  if (kind === 'issue' && item.pull_request) throw new Error('This number is a pull request; use kind=pr');
  const result = evaluate({ kind, body: item.body, author: item.user, draft: item.draft, labels: item.labels });
  if (result.skipped) { console.log(JSON.stringify({ kind, number, skipped: result.skipped })); return; }
  const comment = await upsertMarkerComment(api, number, MARKER, render(kind, result), { createIfMissing: !result.ok });
  console.log(JSON.stringify({ kind, number, ok: result.ok, missing: result.missing, comment }));
  if (!result.ok) process.exitCode = 1;
}
if (runDirectly(import.meta)) await main();
