// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — إشعارات الويب (Web Push · P13-ب) بلا أي اعتماديات خارجية:
 *  - تشفير الرسالة وفق RFC 8291 (ECDH P-256 + HKDF) وترميز المحتوى aes128gcm وفق RFC 8188 (سجل واحد).
 *  - توقيع VAPID وفق RFC 8292 (JWT ES256) بمفاتيح من متغيرات البيئة VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
 *  - مُرسِل يومي لـ«موقف اليوم» يعمل داخل سلسلة Cron القائمة (بلا مهمة Cron جديدة).
 *  التحقق: متجهات الاختبار الرسمية في RFC 8291 (الملحق A) ضمن tests/p13b.test.ts.
 */
import { createECDH, createCipheriv, createDecipheriv, createPrivateKey, hkdfSync, randomBytes, sign as nodeSign } from 'crypto';

// ====================================================================== base64url
export const b64u = {
  enc: (b: Buffer | Uint8Array): string => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
  dec: (s: string): Buffer => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(s || '').length % 4)) % 4), 'base64'),
};

// ====================================================================== المفاتيح
export type VapidKeys = { publicKey: string; privateKey: string };
/** توليد زوج مفاتيح VAPID (P-256) — مرة واحدة، ثم يُحفظ في متغيرات البيئة */
export function generateVapidKeys(): VapidKeys {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  return { publicKey: b64u.enc(ecdh.getPublicKey()), privateKey: b64u.enc(ecdh.getPrivateKey()) };
}
export function vapidFromEnv(env: NodeJS.ProcessEnv = process.env): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim(); const privateKey = String(env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(env.VAPID_SUBJECT || '').trim() || 'mailto:aaabdalaziz@gmail.com';
  if (!publicKey || !privateKey) return null;
  try { if (b64u.dec(publicKey).length !== 65 || b64u.dec(privateKey).length !== 32) return null; } catch { return null; }
  return { publicKey, privateKey, subject };
}

// ====================================================================== التشفير (RFC 8291 + RFC 8188)
const te = (s: string) => Buffer.from(s, 'utf8');
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, len: number): Buffer { return Buffer.from(hkdfSync('sha256', ikm, salt, info, len)); }
export type EncryptOptions = { salt?: Buffer; asPrivateKey?: Buffer; recordSize?: number };
/** تشفير حمولة لرسالة Push: يعيد جسم الطلب كاملًا (رأس aes128gcm + النص المشفّر + الوسم) */
export function encryptPayload(plaintext: Buffer | string, uaPublicKeyB64u: string, authSecretB64u: string, opts: EncryptOptions = {}): Buffer {
  const uaPublic = b64u.dec(uaPublicKeyB64u); const authSecret = b64u.dec(authSecretB64u);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('مفتاح المتصفح غير صالح (p256dh)');
  if (authSecret.length !== 16) throw new Error('سر المصادقة غير صالح (auth)');
  const ecdh = createECDH('prime256v1');
  if (opts.asPrivateKey) ecdh.setPrivateKey(opts.asPrivateKey); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); const ecdhSecret = ecdh.computeSecret(uaPublic);
  const salt = opts.salt || randomBytes(16); if (salt.length !== 16) throw new Error('salt');
  // RFC 8291 §3.3
  const keyInfo = Buffer.concat([te('WebPush: info'), Buffer.from([0]), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
  // RFC 8188 §2.2
  const cek = hkdf(salt, ikm, Buffer.concat([te('Content-Encoding: aes128gcm'), Buffer.from([0])]), 16);
  const nonce = hkdf(salt, ikm, Buffer.concat([te('Content-Encoding: nonce'), Buffer.from([0])]), 12);
  const data = Buffer.isBuffer(plaintext) ? plaintext : te(plaintext);
  const rs = opts.recordSize || 4096;
  if (data.length + 1 + 16 > rs) throw new Error('الرسالة أطول من حجم السجل');
  const record = Buffer.concat([data, Buffer.from([0x02])]); // آخر سجل: فاصل الحشو 0x02 بلا حشو
  const cipher = createCipheriv('aes-128-gcm', cek, nonce); const ct = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(16 + 4 + 1 + 65); salt.copy(header, 0); header.writeUInt32BE(rs, 16); header[20] = 65; asPublic.copy(header, 21);
  return Buffer.concat([header, ct]);
}
/** فك التشفير (جهة المتصفح) — للاختبار فقط */
export function decryptPayload(body: Buffer, uaPrivateKey: Buffer, authSecretB64u: string): Buffer {
  const salt = body.subarray(0, 16); const idlen = body[20]; const asPublic = body.subarray(21, 21 + idlen); const ct = body.subarray(21 + idlen);
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(uaPrivateKey); const uaPublic = ecdh.getPublicKey(); const secret = ecdh.computeSecret(asPublic);
  const ikm = hkdf(b64u.dec(authSecretB64u), secret, Buffer.concat([te('WebPush: info'), Buffer.from([0]), uaPublic, asPublic]), 32);
  const cek = hkdf(salt, ikm, Buffer.concat([te('Content-Encoding: aes128gcm'), Buffer.from([0])]), 16);
  const nonce = hkdf(salt, ikm, Buffer.concat([te('Content-Encoding: nonce'), Buffer.from([0])]), 12);
  const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const rec = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = rec.length - 1; while (end >= 0 && rec[end] === 0) end--;
  if (rec[end] !== 0x02 && rec[end] !== 0x01) throw new Error('فاصل حشو غير صالح');
  return rec.subarray(0, end);
}

// ====================================================================== VAPID (RFC 8292)
export function vapidHeaders(endpoint: string, keys: { publicKey: string; privateKey: string; subject: string }, now = Date.now()): { Authorization: string } {
  const aud = new URL(endpoint).origin;
  const header = b64u.enc(te(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u.enc(te(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })));
  const pub = b64u.dec(keys.publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33, 65)), d: keys.privateKey };
  const key = createPrivateKey({ key: jwk as any, format: 'jwk' });
  const sig = nodeSign('sha256', te(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return { Authorization: `vapid t=${header}.${claims}.${b64u.enc(sig)}, k=${keys.publicKey}` };
}

// ====================================================================== الإرسال
export type PushSubscriptionRow = { id?: string; endpoint: string; p256dh: string; auth: string; lang?: string | null };
export type PushMessage = { title: string; body: string; url?: string; tag?: string; icon?: string; badge?: string; lang?: string; data?: Record<string, unknown> };
export type SendResult = { ok: boolean; status: number; gone: boolean; error?: string };
export function validateSubscription(s: any): PushSubscriptionRow | null {
  const endpoint = String(s?.endpoint || ''); const p256dh = String(s?.keys?.p256dh || s?.p256dh || ''); const auth = String(s?.keys?.auth || s?.auth || '');
  if (!/^https:\/\/[^\s]+$/i.test(endpoint) || endpoint.length > 1500) return null;
  try { if (b64u.dec(p256dh).length !== 65 || b64u.dec(auth).length !== 16) return null; } catch { return null; }
  return { endpoint, p256dh, auth };
}
/** إرسال رسالة واحدة؛ 404/410 تعني أن الاشتراك انتهى ويجب تعطيله */
export async function sendPush(sub: PushSubscriptionRow, msg: PushMessage, keys: { publicKey: string; privateKey: string; subject: string }, opts: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; fetchImpl?: typeof fetch } = {}): Promise<SendResult> {
  const f = opts.fetchImpl || fetch;
  try {
    const body = encryptPayload(JSON.stringify(msg), sub.p256dh, sub.auth);
    const headers: Record<string, string> = { ...vapidHeaders(sub.endpoint, keys), 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'Content-Length': String(body.length), TTL: String(opts.ttl ?? 86400), Urgency: opts.urgency || 'normal' };
    if (msg.tag) headers.Topic = msg.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'athar';
    const r = await f(sub.endpoint, { method: 'POST', headers, body: new Uint8Array(body) });
    const gone = r.status === 404 || r.status === 410;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, gone, error: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e: any) { return { ok: false, status: 0, gone: false, error: e?.message || String(e) }; }
}

// ====================================================================== إشعار «موقف اليوم» (داخل سلسلة Cron الحالية)
export function dailyCaseMessage(c: { title_ar: string; domain_name_ar?: string; event_name_ar?: string | null }, lang: 'ar' | 'en' = 'ar', site = ''): PushMessage {
  const ar = lang !== 'en';
  const lead = c.event_name_ar ? (ar ? `${c.event_name_ar} · ` : `${c.event_name_ar} · `) : '';
  return {
    title: ar ? 'موقف اليوم في أَثَر' : 'Today’s case on Athar',
    body: ar ? `${lead}«${c.title_ar}» — كيف تتصرّف؟ اكتبها بكلماتك واقرأ مرآة أدائك.` : `${lead}“${c.title_ar}” — how would you act? Write it and read your mirror.`,
    url: `${site}/#daily`, tag: 'daily', icon: `${site}/icons/icon-192.png`, badge: `${site}/icons/badge-72.png`, lang,
  };
}
/** يُرسل مرة واحدة يوميًا لكل اشتراك نشط موضوعه daily (آخر إرسال ليس اليوم) */
export async function runDailyPush(db: any, site: string, today: string, c: { title_ar: string; event_name_ar?: string | null } | null, opts: { dry?: boolean; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; limit?: number } = {}): Promise<{ ok: boolean; sent: number; failed: number; gone: number; skipped: number; reason?: string }> {
  const keys = vapidFromEnv(opts.env || process.env); if (!keys) return { ok: true, sent: 0, failed: 0, gone: 0, skipped: 0, reason: 'vapid_missing' };
  if (!c) return { ok: true, sent: 0, failed: 0, gone: 0, skipped: 0, reason: 'no_case' };
  const { data } = await db.from('portal_push_subscriptions').select('id,endpoint,p256dh,auth,lang,last_sent_at,topics').eq('active', true).limit(opts.limit || 2000);
  const subs = ((data || []) as any[]).filter(s => !Array.isArray(s.topics) || s.topics.includes('daily'));
  let sent = 0, failed = 0, gone = 0, skipped = 0;
  for (const s of subs) {
    if (s.last_sent_at && String(s.last_sent_at).slice(0, 10) >= today) { skipped++; continue; }
    if (opts.dry) { sent++; continue; }
    const r = await sendPush(s, dailyCaseMessage(c, s.lang === 'en' ? 'en' : 'ar', site), keys, { fetchImpl: opts.fetchImpl, ttl: 10 * 3600 });
    if (r.ok) { sent++; await db.from('portal_push_subscriptions').update({ last_sent_at: new Date().toISOString(), failures: 0, last_error: null }).eq('id', s.id); }
    else if (r.gone) { gone++; await db.from('portal_push_subscriptions').update({ active: false, last_error: r.error || 'gone' }).eq('id', s.id); }
    else { failed++; await db.from('portal_push_subscriptions').update({ failures: Number(s.failures || 0) + 1, last_error: r.error || 'error', ...(Number(s.failures || 0) + 1 >= 5 ? { active: false } : {}) }).eq('id', s.id); }
  }
  return { ok: true, sent, failed, gone, skipped };
}
