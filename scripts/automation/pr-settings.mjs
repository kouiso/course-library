// PR settings (#8 items 5 and 6). Each mode runs as its own workflow step.
import { client, isBot, paginate, runDirectly, targetNumber } from './github-api.mjs';
export function assignment(pr) {
  if (isBot(pr.user)) return { assign: null, reason: 'bot-author' };
  if ((pr.assignees || []).some(a => a.login === pr.user?.login)) return { assign: null, reason: 'already-assigned' };
  return { assign: pr.user.login, reason: 'author' };
}
export const branchLabels = [
  [/^(?:feature|feat)\//, 'feature'], [/^(?:bugfix|fix)\//, 'bugfix'], [/^hotfix\//, 'hotfix'],
  [/^(?:chore|refactor)\//, 'chore'], [/^docs\//, 'documentation'], [/^release\//, 'release'],
];
// Path labels follow this repository's layout: prose docs, runtime/CI configuration, npm dependencies.
export const pathLabels = [
  [/^(?:docs\/|README\.md$)|\.md$/, 'documentation'],
  [/^(?:wrangler\.jsonc|tsconfig\.json|worker-configuration\.d\.ts)$|^\.github\/|^\.githooks\//, 'config'],
  [/^package(?:-lock)?\.json$/, 'dependencies'],
];
export function labelsFor(branch, files, existing = []) {
  const wanted = new Set();
  for (const [pattern, label] of branchLabels) if (pattern.test(branch || '')) wanted.add(label);
  for (const file of files) for (const [pattern, label] of pathLabels) if (pattern.test(file)) wanted.add(label);
  // Only additions are returned; labels already on the PR are never removed.
  const current = new Set(existing.map(l => l.name ?? l));
  return [...wanted].filter(label => !current.has(label)).sort();
}
async function main() {
  const mode = process.env.SETTING_MODE, number = targetNumber(), api = client();
  const pr = await api('GET', `/pulls/${number}`);
  if (mode === 'assign') {
    const decision = assignment(pr);
    if (decision.assign) await api('POST', `/issues/${number}/assignees`, { assignees: [decision.assign] });
    console.log(JSON.stringify({ number, mode, ...decision }));
    return;
  }
  if (mode === 'labels') {
    const files = (await paginate(api, `/pulls/${number}/files`)).map(f => f.filename);
    const add = labelsFor(pr.head?.ref, files, pr.labels);
    if (add.length) await api('POST', `/issues/${number}/labels`, { labels: add });
    console.log(JSON.stringify({ number, mode, added: add }));
    return;
  }
  throw new Error('SETTING_MODE must be assign or labels');
}
if (runDirectly(import.meta)) await main();
