// Auto-merge eligibility for Dependabot PRs (#8 item 8). Only the grouped minor/patch version update qualifies.
import { appendFile } from 'node:fs/promises';
import { client, runDirectly, targetNumber } from './github-api.mjs';
export const GROUP = 'minor-and-patch';
export function eligible(pr) {
  if (pr.user?.login !== 'dependabot[bot]') return { eligible: false, reason: 'not-dependabot' };
  if (pr.state !== 'open' || pr.draft) return { eligible: false, reason: 'not-open' };
  if (pr.base?.ref !== pr.base?.repo?.default_branch) return { eligible: false, reason: 'not-default-branch' };
  if ((pr.labels || []).some(l => /security/i.test(l.name ?? l))) return { eligible: false, reason: 'security-update' };
  if (!String(pr.head?.ref || '').startsWith(`dependabot/npm_and_yarn/${GROUP}-`) || !new RegExp(`^Bump the ${GROUP} group\\b`).test(pr.title || '')) return { eligible: false, reason: 'not-minor-and-patch-group' };
  return { eligible: true, reason: 'grouped-minor-and-patch' };
}
async function main() {
  const number = targetNumber(), api = client();
  const decision = eligible(await api('GET', `/pulls/${number}`));
  console.log(JSON.stringify({ number, ...decision }));
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `eligible=${decision.eligible}\n`);
}
if (runDirectly(import.meta)) await main();
