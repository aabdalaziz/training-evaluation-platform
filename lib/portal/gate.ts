// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/**
 * «تصاريح الدخول» (P79) — النواة الخالصة المشتركة بين الحافة (middleware) وواجهات /api وصفحة البوّابة.
 *  • لا استيراد من Node (crypto/fs): التوقيع بـ Web Crypto حتى يعمل على Edge Runtime وفي Node 18+ وفي الاختبارات.
 *  • الكعكة `athar_gate`  : توقيع HMAC لحمولة {k: staff|permit, p: [منتجات] أو ['*'], e: انتهاء} — تفتح الأبواب.
 *  • الكعكة `athar_trial` : حمولة {k:'trial', p:[منتج], e: نهاية الدقيقتين} — تُقرأ من المتصفّح لعرض العدّاد (غير httpOnly).
 *  • الكعكة `athar_trial_done`: قائمة المنتجات التي استُهلكت تجربتها على هذا الجهاز (مرّة واحدة لكلّ جهاز).
 *  • المفتاح مشتقّ من VC_SIGNING_KEY (أو CRON_SECRET) كما في oauth.ts — لا متغيّر بيئة جديد.
 *  القرار النهائي: decide() — خالصة وقابلة للاختبار.
 */

export type GateMode = 'open' | 'permit' | 'closed';
export type GateProduct = { slug: string; name_ar: string; name_en: string; mode: GateMode; trial_seconds: number; entry_path: string; trial_path: string | null; message_ar: string | null; sort: number };
export type GateKind = 'staff' | 'permit' | 'trial';
export type GatePayload = { v: 1; k: GateKind; p: string[]; e: number /* epoch seconds */; m?: string /* email (للسجلّ فقط) */ };
export type GateDecision = { allow: true; via: GateKind | 'open' } | { allow: false; reason: 'closed' | 'permit' | 'trial_expired'; redirect: string };

export const GATE_COOKIE = 'athar_gate';
export const TRIAL_COOKIE = 'athar_trial';
export const TRIAL_DONE_COOKIE = 'athar_trial_done';
export const STAFF_DAYS = 30;
export const PERMIT_DAYS_DEFAULT = 30;

/** المنتجات الافتراضية — تُستخدم عندما يتعذّر الوصول إلى قاعدة البيانات من الحافة، وكمرجع للمسارات. */
export const DEFAULT_PRODUCTS: GateProduct[] = [
  { slug: 'iqra', name_ar: 'اقْرَأْ', name_en: 'Iqra', mode: 'permit', trial_seconds: 120, entry_path: '/iqra', trial_path: '/iqra', message_ar: null, sort: 10 },
  { slug: 'kids', name_ar: 'بَيان — أَثَر للأطفال', name_en: 'Bayan Kids', mode: 'permit', trial_seconds: 120, entry_path: '/kids', trial_path: '/kids/demo', message_ar: null, sort: 20 },
  { slug: 'sim', name_ar: 'المحاكيات', name_en: 'Simulators', mode: 'open', trial_seconds: 120, entry_path: '/sim', trial_path: '/sim', message_ar: null, sort: 30 },
  { slug: 'live', name_ar: 'التعلّم المباشر', name_en: 'Live learning', mode: 'open', trial_seconds: 0, entry_path: '/live', trial_path: '/live', message_ar: null, sort: 40 },
  { slug: 'on-air', name_ar: 'على الهواء', name_en: 'On air', mode: 'open', trial_seconds: 0, entry_path: '/on-air', trial_path: '/on-air', message_ar: null, sort: 50 },
];
/** المسارات التي يراقبها الوسيط — يجب أن تطابق `config.matcher` في middleware.ts */
export const GATE_PATH_PREFIXES: Record<string, string> = { '/iqra': 'iqra', '/kids': 'kids', '/sim': 'sim', '/live': 'live', '/on-air': 'on-air' };

export const DEFAULT_MESSAGE_AR = 'هذا المنتج متاح حاليًّا بتصريح من إدارة أَثَر إلى حين إطلاق الاشتراكات. اطلب التصريح وسنردّ على بريدك خلال يوم عمل، أو تواصل معنا مباشرة.';
export const CONTACT_AR = { email: 'info@athar-portal.com', phone: '+966 56 444 0406', wa: 'https://wa.me/966564440406' };

export function productOfPath(pathname: string): string | null {
  const p = (pathname || '/').toLowerCase();
  for (const [prefix, slug] of Object.entries(GATE_PATH_PREFIXES)) if (p === prefix || p.startsWith(prefix + '/')) return slug;
  return null;
}
export function findProduct(slug: string, list: GateProduct[] = DEFAULT_PRODUCTS): GateProduct | null { return list.find((x) => x.slug === slug) || DEFAULT_PRODUCTS.find((x) => x.slug === slug) || null; }
export const isSlug = (s: unknown): s is string => typeof s === 'string' && /^[a-z][a-z0-9-]{1,30}$/.test(s);

// ====================================================================== التوقيع (Web Crypto)
const enc = new TextEncoder();
const b64u = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s: string): Uint8Array => { const b = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); const bin = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary'); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const utf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

export function gateSecrets(env: Record<string, string | undefined>): string[] {
  const cur = env.VC_SIGNING_KEY || env.CRON_SECRET || 'athar-dev-only'; const prev = env.TOKEN_SECRET_PREV; return prev ? [cur, prev] : [cur];
}
async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode('athar-gate-v1:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
export async function signGate(payload: GatePayload, env: Record<string, string | undefined>): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(payload))); const sig = b64u(await hmac(gateSecrets(env)[0], body)); return `${body}.${sig}`;
}
/** يتحقّق من التوقيع (بالمفتاح الحالي أو السابق) ومن الانتهاء؛ يعيد الحمولة أو null. */
export async function verifyGate(token: string | null | undefined, env: Record<string, string | undefined>, nowS = Math.floor(Date.now() / 1000)): Promise<GatePayload | null> {
  if (!token || token.length > 2048) return null; const i = token.indexOf('.'); if (i <= 0) return null;
  const body = token.slice(0, i), sig = token.slice(i + 1);
  let ok = false;
  for (const s of gateSecrets(env)) { const want = b64u(await hmac(s, body)); if (want.length === sig.length && timingSafeEq(want, sig)) { ok = true; break; } }
  if (!ok) return null;
  try { const p = JSON.parse(utf8(unb64u(body))) as GatePayload; if (p?.v !== 1 || !Array.isArray(p.p) || typeof p.e !== 'number') return null; if (p.e <= nowS) return null; return p; } catch { return null; }
}
function timingSafeEq(a: string, b: string): boolean { let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

export const covers = (p: GatePayload | null, slug: string) => !!p && (p.p.includes('*') || p.p.includes(slug));

// ====================================================================== القرار
export type DecideInput = { product: GateProduct; gate: GatePayload | null; trial: GatePayload | null; trialDone: string[]; pathname: string; nowS?: number };
export function decide(i: DecideInput): GateDecision {
  const slug = i.product.slug; const nowS = i.nowS ?? Math.floor(Date.now() / 1000);
  if (covers(i.gate, slug)) return { allow: true, via: i.gate!.k === 'staff' ? 'staff' : 'permit' };
  if (i.product.mode === 'open') return { allow: true, via: 'open' };
  const to = `/gate/${slug}?next=${encodeURIComponent(i.pathname)}`;
  if (i.product.mode === 'closed') return { allow: false, reason: 'closed', redirect: to };
  if (i.trial && i.trial.k === 'trial' && covers(i.trial, slug) && i.trial.e > nowS) return { allow: true, via: 'trial' };
  if (i.trialDone.includes(slug)) return { allow: false, reason: 'trial_expired', redirect: to + '&expired=1' };
  return { allow: false, reason: 'permit', redirect: to };
}
export const parseTrialDone = (raw: string | null | undefined) => String(raw || '').split(',').map((s) => s.trim()).filter(isSlug).slice(0, 20);
export const canTrial = (product: GateProduct, trialDone: string[]) => product.mode === 'permit' && product.trial_seconds > 0 && !trialDone.includes(product.slug);

// ====================================================================== الرموز والطلبات
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بلا 0/O/1/I
export function permitCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string { const b = rand(10); let s = ''; for (let i = 0; i < 10; i++) s += ALPHABET[b[i] % ALPHABET.length]; return s; }
export const normalizeCode = (raw: unknown) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I').slice(0, 10);
export const isCode = (s: string) => /^[A-Z2-9]{10}$/.test(s);

export type GateRequestInput = { product: string; name: string; email: string; phone?: string | null; org?: string | null; purpose?: string | null; lang?: string };
export function validateRequest(b: any): { ok: true; value: GateRequestInput } | { ok: false; error: string } {
  const product = String(b?.product || '').trim().toLowerCase(); if (!isSlug(product)) return { ok: false, error: 'المنتج غير معروف' };
  const name = String(b?.name || '').trim().replace(/\s+/g, ' '); if (name.length < 2 || name.length > 80) return { ok: false, error: 'اكتب اسمك (حرفان على الأقل)' };
  const email = String(b?.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) return { ok: false, error: 'البريد الإلكتروني غير صالح' };
  const phone = String(b?.phone || '').trim().slice(0, 30) || null; if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) return { ok: false, error: 'رقم الجوّال غير صالح' };
  const org = String(b?.org || '').trim().slice(0, 120) || null; const purpose = String(b?.purpose || '').trim().slice(0, 600) || null;
  const lang = b?.lang === 'en' ? 'en' : 'ar';
  return { ok: true, value: { product, name, email, phone, org, purpose, lang } };
}

export function permitExpiry(days: number | null | undefined, now = new Date()): string | null { const d = Number(days); if (!Number.isFinite(d) || d <= 0) return null; return new Date(now.getTime() + Math.min(d, 3650) * 86400e3).toISOString(); }
export const permitActive = (p: { revoked_at?: string | null; expires_at?: string | null }, now = new Date()) => !p.revoked_at && (!p.expires_at || new Date(p.expires_at).getTime() > now.getTime());
/** الحمولة المناسبة لمجموعة تصاريح نشطة لبريد واحد: أقرب انتهاء يحدّ الكعكة (أو 30 يومًا للمفتوحة). */
export function payloadForPermits(permits: Array<{ product: string; expires_at?: string | null; revoked_at?: string | null }>, email: string, now = new Date()): GatePayload | null {
  const act = permits.filter((p) => permitActive(p, now)); if (!act.length) return null;
  const cap = now.getTime() + PERMIT_DAYS_DEFAULT * 86400e3;
  const e = Math.min(cap, ...act.map((p) => (p.expires_at ? new Date(p.expires_at).getTime() : cap)));
  return { v: 1, k: 'permit', p: Array.from(new Set(act.map((p) => p.product))), e: Math.floor(e / 1000), m: email };
}

// ====================================================================== البريد
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const PLUM = '#3A1F36', CORAL = '#E8795C', CREAM = '#FBF4EE', GOLD = '#D9A866', GREY = '#6B5B67';
function shell(title: string, inner: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:${CREAM};padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EADFD6;direction:rtl;text-align:right">
<tr><td style="height:6px;background:linear-gradient(90deg,${CORAL},${GOLD},${PLUM})"></td></tr>
<tr><td style="padding:26px 28px 6px;font:900 22px Tahoma,Arial;color:${PLUM}">${esc(title)}</td></tr>${inner}
<tr><td style="padding:18px 28px 24px;font:12px/1.6 Tahoma,Arial;color:${GREY}">أَثَر — بوّابة أَثَر للتعليم والتدريب والتطوير والجودة · <a href="https://athar-portal.com" style="color:${GREY}">athar-portal.com</a> · ${esc(CONTACT_AR.email)}</td></tr>
</table></td></tr></table></body></html>`;
}
const para = (t: string, color = PLUM, size = 15) => `<tr><td style="padding:8px 28px 0;font:${size}px/1.8 Tahoma,Arial;color:${color}">${t}</td></tr>`;
const fmtDate = (iso: string | null) => (iso ? new Intl.DateTimeFormat('ar-SA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)) : null);

/** بريد صاحب التصريح: زرّ يفتح الباب على جهازه (الرابط يضبط الكعكة ثمّ يحوّل إلى المنتج). */
export function buildPermitMail(i: { name: string | null; product: GateProduct; code: string; url: string; expires_at: string | null }): { subject: string; html: string; text: string } {
  const subject = `تصريح دخولك إلى ${i.product.name_ar} — أَثَر`;
  const hello = i.name ? `مرحبًا ${i.name}،` : 'مرحبًا،';
  const until = fmtDate(i.expires_at);
  const untilLine = until ? `التصريح صالح حتى ${until}.` : 'التصريح صالح حتى إشعار آخر.';
  const text = [hello, '', `تمّت الموافقة على طلبك، وهذا تصريح دخولك إلى «${i.product.name_ar}» في بوّابة أَثَر.`, '', `رابط الدخول: ${i.url}`, `رمز التصريح (إن طُلب منك): ${i.code}`, untilLine, '', 'الرابط يفتح الباب على الجهاز الذي تضغطه منه؛ وعلى جهاز آخر أدخل الرمز في صفحة البوّابة.', `لأيّ سؤال: ${CONTACT_AR.email} · ${CONTACT_AR.phone}`, '', 'فريق أَثَر'].join('\n');
  const html = shell('تصريح دخول — ' + i.product.name_ar, para(esc(hello) + '<br>' + esc(`تمّت الموافقة على طلبك، وهذا تصريح دخولك إلى «${i.product.name_ar}» في بوّابة أَثَر.`))
    + `<tr><td style="padding:22px 28px 6px" align="center"><a href="${esc(i.url)}" style="display:inline-block;background:${CORAL};color:#fff;text-decoration:none;font:900 16px Tahoma,Arial;padding:14px 30px;border-radius:999px">ادخل الآن ←</a></td></tr>`
    + `<tr><td style="padding:0 28px 8px;font:12px/1.6 Tahoma,Arial;color:${GREY}" align="center">أو انسخ الرابط:<br><a href="${esc(i.url)}" dir="ltr" style="color:${PLUM};word-break:break-all">${esc(i.url)}</a></td></tr>`
    + `<tr><td style="padding:14px 28px 0"><div style="background:${CREAM};border-radius:12px;padding:14px 18px;font:14px/1.8 Tahoma,Arial;color:${PLUM}">رمز التصريح: <b dir="ltr" style="font-size:18px;letter-spacing:2px">${esc(i.code)}</b><br>${esc(untilLine)}<br><span style="color:${GREY};font-size:13px">الرابط يفتح الباب على الجهاز الذي تضغطه منه؛ وعلى جهاز آخر أدخل الرمز في صفحة البوّابة.</span></div></td></tr>`
    + para(`لأيّ سؤال: ${esc(CONTACT_AR.email)} · <span dir="ltr">${esc(CONTACT_AR.phone)}</span><br><b>فريق أَثَر</b>`, PLUM, 14));
  return { subject, html, text };
}
/** بريد الرفض المهذّب (اختياري بملاحظة). */
export function buildRejectMail(i: { name: string | null; product: GateProduct; note: string | null }): { subject: string; html: string; text: string } {
  const subject = `بخصوص طلب الدخول إلى ${i.product.name_ar} — أَثَر`;
  const hello = i.name ? `مرحبًا ${i.name}،` : 'مرحبًا،';
  const body = `شكرًا لاهتمامك بـ«${i.product.name_ar}». لا نستطيع فتح الدخول في الوقت الحالي${i.note ? `: ${i.note}` : ''}. سنعلن قريبًا عن خطط الاشتراك، ويسعدنا تواصلك على ${CONTACT_AR.email}.`;
  return { subject, text: [hello, '', body, '', 'فريق أَثَر'].join('\n'), html: shell('طلب الدخول — ' + i.product.name_ar, para(esc(hello) + '<br>' + esc(body)) + para('<b>فريق أَثَر</b>')) };
}
/** إشعار الطاقم بطلب جديد. */
export function buildStaffNotice(i: { req: GateRequestInput; product: GateProduct; adminUrl: string }): { subject: string; html: string; text: string } {
  const r = i.req; const subject = `طلب تصريح جديد — ${i.product.name_ar} — ${r.name}`;
  const rows: Array<[string, string]> = [['المنتج', i.product.name_ar], ['الاسم', r.name], ['البريد', r.email], ['الجوّال', r.phone || '—'], ['الجهة', r.org || '—'], ['الغرض', r.purpose || '—']];
  const text = [subject, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `القرار: ${i.adminUrl}`].join('\n');
  const html = shell('طلب تصريح جديد', `<tr><td style="padding:10px 28px 0"><table role="presentation" cellspacing="0" cellpadding="0">${rows.map(([k, v]) => `<tr><td style="padding:4px 0;font:700 13px Tahoma,Arial;color:${GREY};white-space:nowrap">${esc(k)}</td><td style="padding:4px 10px;font:14px Tahoma,Arial;color:${PLUM}">${esc(v)}</td></tr>`).join('')}</table></td></tr>`
    + `<tr><td style="padding:22px 28px 6px" align="center"><a href="${esc(i.adminUrl)}" style="display:inline-block;background:${PLUM};color:#fff;text-decoration:none;font:900 15px Tahoma,Arial;padding:12px 26px;border-radius:999px">افتح شاشة التصاريح ←</a></td></tr>`);
  return { subject, html, text };
}

// ====================================================================== الكعكات (نصّ Set-Cookie مشترك)
export function cookieAttrs(maxAgeS: number, httpOnly = true, secure = true): string { return `Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeS))}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure ? '; Secure' : ''}`; }
