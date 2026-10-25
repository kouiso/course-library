const encoder = new TextEncoder();
export const SESSION_TTL = 4 * 60 * 60;
export type Token = { purpose: 'login' | 'session'; iat: number; exp: number; nonce: string };
const encode = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
function decode(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}
async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function sha256(s: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s))), x => x.toString(16).padStart(2, '0')).join('');
}
export async function equal(a: string, b: string): Promise<boolean> {
  // Fixed-length digest comparison using the runtime's constant-time primitive.
  const x = await crypto.subtle.digest('SHA-256', encoder.encode(a));
  const y = await crypto.subtle.digest('SHA-256', encoder.encode(b));
  return crypto.subtle.timingSafeEqual(x, y);
}
export async function issue(secret: string, purpose: Token['purpose'], ttl: number): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const body = encode(encoder.encode(JSON.stringify({ purpose, iat, exp: iat + ttl, nonce: crypto.randomUUID() })));
  return `${body}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(body))))}`;
}
export async function verify(secret: string, value: string | undefined, purpose: Token['purpose']): Promise<Token | null> {
  try {
    if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null;
    const [body, sig] = value.split('.');
    if (!body || !sig || !await crypto.subtle.verify('HMAC', await key(secret), decode(sig), encoder.encode(body))) return null;
    const t: Token = JSON.parse(new TextDecoder().decode(decode(body)));
    const now = Math.floor(Date.now() / 1000);
    const ttl = purpose === 'session' ? SESSION_TTL : 600;
    if (t.purpose !== purpose || !Number.isSafeInteger(t.iat) || !Number.isSafeInteger(t.exp)
      || t.iat > now || t.exp <= now || t.exp <= t.iat || t.exp - t.iat > ttl
      || !/^[0-9a-f-]{36}$/.test(t.nonce)) return null;
    return t;
  } catch { return null; }
}
export function cookies(req: Request): Map<string, string> {
  const result = new Map<string, string>();
  for (const item of (req.headers.get('Cookie') || '').split(';')) {
    const i = item.indexOf('=');
    if (i < 0) continue;
    const name = item.slice(0, i).trim();
    if (result.has(name)) result.set(name, ''); // Reject ambiguous duplicate cookies.
    else result.set(name, item.slice(i + 1).trim());
  }
  return result;
}
export const cookie = (name: string, value: string, age: number, local: boolean) => `${local ? 'local_' : '__Host-'}${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${local ? '' : '; Secure'}`;
export const cookieName = (name: string, local: boolean) => `${local ? 'local_' : '__Host-'}${name}`;
