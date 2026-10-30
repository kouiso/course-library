// Minimal REST client for repository automation. It only uses the workflow's GITHUB_TOKEN.
import { pathToFileURL } from 'node:url';
export function client({ token = process.env.GITHUB_TOKEN, repository = process.env.GITHUB_REPOSITORY, fetchImpl = fetch } = {}) {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  const base = `https://api.github.com/repos/${repository}`;
  return async function api(method, path, body) {
    const res = await fetchImpl(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'course-library-automation', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // Never echo response bodies: they can contain the public text being checked.
    if (!res.ok) throw new Error(`GitHub API ${method} ${path.split('?')[0]} failed with ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
}
export async function paginate(api, path) {
  const items = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  return items;
}
export const isBot = user => user?.type === 'Bot' || /\[bot\]$/.test(user?.login || '');
// Keep one marked comment per check: update it instead of posting again.
export async function upsertMarkerComment(api, number, marker, body, { createIfMissing = true } = {}) {
  const comments = await paginate(api, `/issues/${number}/comments`);
  const existing = comments.find(c => c.user?.login === 'github-actions[bot]' && typeof c.body === 'string' && c.body.includes(marker));
  if (existing) {
    if (existing.body === body) return 'unchanged';
    await api('PATCH', `/issues/comments/${existing.id}`, { body });
    return 'updated';
  }
  if (!createIfMissing) return 'skipped';
  await api('POST', `/issues/${number}/comments`, { body });
  return 'created';
}
export function targetNumber(value = process.env.TARGET_NUMBER) {
  if (!/^[1-9]\d{0,9}$/.test(value || '')) throw new Error('TARGET_NUMBER must be a positive issue or pull request number');
  return Number(value);
}
export const runDirectly = meta => process.argv[1] && meta.url === pathToFileURL(process.argv[1]).href;
