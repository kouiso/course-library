import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
// Keep Wrangler's own logs inside the isolated ignored workspace.
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: resolve('.wrangler/logs/') },
});
if (result.error) { console.error('Unable to start Wrangler.'); process.exit(1); }
process.exit(result.status ?? 1);
