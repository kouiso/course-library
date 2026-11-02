import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createHash, randomBytes } from 'node:crypto';
export const localPhrase = 'synthetic-development-only';
export const basicUser = 'test-basic-user';
export const basicPass = 'test-basic-pass';
export const basicHeader = 'Basic ' + Buffer.from(`${basicUser}:${basicPass}`).toString('base64');
export const digest = s => createHash('sha256').update(s).digest('hex');
export function runtime({ origin = 'https://course.example', bindings = {}, ipLimit = 5, totalLimit = 60, port } = {}) {
  return new Miniflare(convertV4MiniflareOptions({
    scriptPath: 'dist/index.js', modules: true, compatibilityDate: '2026-10-25', compatibilityFlags: ['nodejs_compat'],
    host: '127.0.0.1', ...(port ? { port } : {}),
    r2Buckets: ['MATERIALS'],
    ratelimits: {
      LOGIN_IP_LIMIT: { namespace_id: '9127301', simple: { limit: ipLimit, period: 60 } },
      LOGIN_TOTAL_LIMIT: { namespace_id: '9127302', simple: { limit: totalLimit, period: 60 } },
    },
    bindings: { APP_ORIGIN: origin, APP_MODE: origin.startsWith('http://') ? 'local' : 'production', ACCESS_PHRASE_SHA256: digest(localPhrase), SESSION_SECRET: randomBytes(32).toString('base64url'), BASIC_AUTH_USER: basicUser, BASIC_AUTH_PASS: basicPass, ...bindings },
  }));
}
