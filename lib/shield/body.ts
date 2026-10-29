// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — تحصين المدخلات والأسرار:
 *  readJson(req, { maxBytes, maxDepth })  → يقرأ جسم JSON بحدّ حجم وعمق؛ يرفض بـ { ok:false, status, error } بلا تفاصيل داخلية.
 *  safeEqual(a, b)                        → مقارنة أسرار بزمن ثابت (CRON_SECRET · webhooks · أكواد التأكيد).
 *  browserWrite(req)                      → هل الطلب كتابة آتية من متصفح من موقع آخر؟ (Sec-Fetch-Site) — دفاع CSRF إضافي للنماذج العامة.
 *  honeypotTripped(body)                  → حقل فخ في النماذج العامة (الروبوتات تملؤه، البشر لا يرونه).
 */
import { timingSafeEqual, createHash } from 'crypto';

export const PUBLIC_MAX_BYTES = 64 * 1024; export const STAFF_MAX_BYTES = 1024 * 1024; export const MAX_DEPTH = 8;
export type ReadJson = { ok: true; body: any; bytes: number } | { ok: false; status: number; error: string; error_en: string; reason: 'too_large' | 'too_deep' | 'invalid' | 'empty' };

export function jsonDepth(v: unknown, d = 0): number {
  if (d > 64) return d; if (v === null || typeof v !== 'object') return d;
  let m = d + 1; for (const x of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) { const k = jsonDepth(x, d + 1); if (k > m) m = k; if (m > 64) break; }
  return m;
}

export async function readJson(req: Request, opts: { maxBytes?: number; maxDepth?: number; allowEmpty?: boolean } = {}): Promise<ReadJson> {
  const maxBytes = opts.maxBytes ?? PUBLIC_MAX_BYTES; const maxDepth = opts.maxDepth ?? MAX_DEPTH;
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) return { ok: false, status: 413, error: 'حجم الطلب أكبر من المسموح', error_en: 'Payload too large', reason: 'too_large' };
  let text = '';
  try { text = await req.text(); } catch { return { ok: false, status: 400, error: 'تعذّر قراءة الطلب', error_en: 'Unreadable body', reason: 'invalid' }; }
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > maxBytes) return { ok: false, status: 413, error: 'حجم الطلب أكبر من المسموح', error_en: 'Payload too large', reason: 'too_large' };
  if (!text.trim()) return opts.allowEmpty ? { ok: true, body: {}, bytes } : { ok: false, status: 400, error: 'الطلب فارغ', error_en: 'Empty body', reason: 'empty' };
  let body: any; try { body = JSON.parse(text); } catch { return { ok: false, status: 400, error: 'صيغة JSON غير صالحة', error_en: 'Invalid JSON', reason: 'invalid' }; }
  if (jsonDepth(body) > maxDepth) return { ok: false, status: 400, error: 'بنية الطلب أعمق من المسموح', error_en: 'JSON too deeply nested', reason: 'too_deep' };
  return { ok: true, body, bytes };
}

export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false; const ha = createHash('sha256').update(String(a)).digest(); const hb = createHash('sha256').update(String(b)).digest(); return timingSafeEqual(ha, hb);
}

/** كتابة من متصفح عبر موقع آخر (CSRF محتمل) — الطلبات غير المتصفحية (وكلاء، curl) لا تحمل الترويسة فتمرّ */
export function crossSiteBrowserWrite(req: Request): boolean {
  const site = (req.headers.get('sec-fetch-site') || '').toLowerCase(); const mode = (req.headers.get('sec-fetch-mode') || '').toLowerCase();
  if (!site) return false; return site === 'cross-site' && mode !== 'cors';
}

export const HONEYPOT_FIELD = 'website_url';
export const honeypotTripped = (body: any) => !!(body && typeof body === 'object' && String(body[HONEYPOT_FIELD] || '').trim());

/** تحقق سرّ الكرون بزمن ثابت: Bearer أو ?key= */
export function cronAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET; if (!secret) return false;
  const url = new URL(req.url); const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('key') || '';
  return safeEqual(given, secret);
}
