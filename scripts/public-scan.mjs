import { execFileSync } from 'node:child_process';
const git = args => execFileSync('git', args, { encoding: 'utf8' });
const paths = git(['ls-files']).trim().split('\n').filter(Boolean);
const forbiddenPath = /(^|\/)(materials|private|artifacts|node_modules|\.wrangler)(\/|$)|(^|\/)\.env|(^|\/)\.dev\.vars|\.(pdf|zip|pem|key)$/i;
const secrets = [/gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
let failures = 0;
for (const path of paths) {
  if (forbiddenPath.test(path)) { console.error(`Forbidden public path: ${path}`); failures++; }
  const text = git(['show', `:${path}`]);
  if (secrets.some(pattern => pattern.test(text))) { console.error(`Potential credential in staged file: ${path}`); failures++; }
}
const revisions = git(['rev-list', '--all']);
const blobs = new Map();
if (revisions.trim()) {
  for (const item of git(['rev-list', '--all', '--objects']).trim().split('\n')) {
    const separator = item.indexOf(' ');
    if (separator < 0) continue;
    const oid = item.slice(0, separator), path = item.slice(separator + 1);
    if (forbiddenPath.test(path)) { console.error(`Forbidden public history path: ${path}`); failures++; }
    if (git(['cat-file', '-t', oid]).trim() === 'blob') blobs.set(oid, path);
  }
  for (const [oid, path] of blobs) {
    if (secrets.some(pattern => pattern.test(git(['cat-file', '-p', oid])))) { console.error(`Potential credential in history: ${path}`); failures++; }
  }
}
if (failures) process.exit(1);
console.log(`Public scan passed: ${paths.length} staged paths, ${blobs.size} historical blobs. Pattern scan supplements manual content review.`);
