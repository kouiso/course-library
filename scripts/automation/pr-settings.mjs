// PR settings (#8 items 5 and 6). Each mode runs as its own workflow step.
import { client, isBot, paginate, runDirectly, targetNumber } from './github-api.mjs';
export function assignment(pr) {
  if (isBot(pr.user)) return { assign: null, reason: 'bot-author' };
  if ((pr.assignees || []).some(a => a.login === pr.user?.login)) return { assign: null, reason: 'already-assigned' };
  return { assign: pr.user.login, reason: 'author' };
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
  throw new Error('SETTING_MODE must be assign');
}
if (runDirectly(import.meta)) await main();
