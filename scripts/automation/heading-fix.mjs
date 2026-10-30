// Issue heading fix (#8 item 3). Issue forms render fields one level deeper (###), so lift them by one.
import { client, runDirectly, targetNumber } from './github-api.mjs';
export function fixHeadings(body) {
  let fence = false;
  const lines = String(body ?? '').split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return line; }
    if (fence) return line;
    // One replacement per line, so #### becomes ### and is not lifted twice. ## and ##### stay.
    return line.replace(/^(\s{0,3})(#{3,4})(?=[ \t])/, (m, indent, marks) => indent + marks.slice(1));
  });
  const fixed = lines.join('\n');
  return { body: fixed, changed: fixed !== String(body ?? '') };
}
async function main() {
  const number = targetNumber(), api = client();
  const issue = await api('GET', `/issues/${number}`);
  if (issue.pull_request) throw new Error('Heading fix is for issues only');
  const { body, changed } = fixHeadings(issue.body);
  if (changed) await api('PATCH', `/issues/${number}`, { body });
  console.log(JSON.stringify({ number, changed }));
}
if (runDirectly(import.meta)) await main();
