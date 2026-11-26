// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */
/**
 * «بطاقة أَثَر الرقمية» — رمز QR موقَّع لكلّ مستخدم: ATHAR1.<payload>.<sig>
 *  payload = base64url(JSON{ v:1, u:<uuid المستخدم>, e:<انتهاء بالثواني> }) · sig = HMAC-SHA256('athar-pass-v1:'+السرّ) مقطوع إلى 16 بايت.
 *  السرّ نفسه المستعمل في التصاريح (VC_SIGNING_KEY ثمّ CRON_SECRET) مع دعم TOKEN_SECRET_PREV للتدوير.
 *  الرمز لا يحمل اسمًا ولا بريدًا — الطاقم فقط يحلّه على الخادم (/api/reader/card) بعد تسجيل الدخول، ويُسجَّل كلّ حلّ في audit_logs.
 *  صلاحية افتراضية سنتان؛ Web Crypto فيعمل في Node 18+ والمتصفّح وحافة Vercel.
 */
export const PASS_PREFIX = 'ATHAR1';
export const PASS_TTL_S = 2 * 365 * 24 * 3600;
export type PassPayload = { v: 1; u: string; e: number };

const enc = new TextEncoder();
const b64u = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s: string): Uint8Array => { const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); const bin = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary'); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

export function passSecrets(env: Record<string, string | undefined>): string[] { const cur = env.VC_SIGNING_KEY || env.CRON_SECRET || 'athar-dev-only'; const prev = env.TOKEN_SECRET_PREV; return prev ? [cur, prev] : [cur]; }
async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode('athar-pass-v1:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))).slice(0, 16);
}
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** يُصدر رمز بطاقة لمستخدم. */
export async function signPass(userId: string, env: Record<string, string | undefined>, nowS = Math.floor(Date.now() / 1000), ttlS = PASS_TTL_S): Promise<string> {
  if (!isUuid(userId)) throw new Error('bad user id');
  const body = b64u(enc.encode(JSON.stringify({ v: 1, u: userId.toLowerCase(), e: nowS + ttlS } satisfies PassPayload)));
  return `${PASS_PREFIX}.${body}.${b64u(await hmac(passSecrets(env)[0], body))}`;
}
/** يتحقّق من رمز بطاقة (التوقيع بالمفتاح الحالي أو السابق + الانتهاء)؛ يعيد الحمولة أو null. */
export async function verifyPass(token: string | null | undefined, env: Record<string, string | undefined>, nowS = Math.floor(Date.now() / 1000)): Promise<PassPayload | null> {
  if (!token || token.length > 600) return null; const parts = token.trim().split('.'); if (parts.length !== 3 || parts[0] !== PASS_PREFIX) return null;
  const [, body, sig] = parts; let ok = false;
  for (const s of passSecrets(env)) { const want = b64u(await hmac(s, body)); if (want.length === sig.length && timingSafeEq(want, sig)) { ok = true; break; } }
  if (!ok) return null;
  try { const p = JSON.parse(new TextDecoder().decode(unb64u(body))) as PassPayload; if (p?.v !== 1 || !isUuid(p.u) || typeof p.e !== 'number' || p.e <= nowS) return null; return p; } catch { return null; }
}
function timingSafeEq(a: string, b: string): boolean { let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
/** الأدوار المخوَّلة بحلّ البطاقة (طاقم التسجيل والحضور). */
export const PASS_READERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER', 'FINANCE_MANAGER'];
