// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — «الصمّام»: حدود معدل موحّدة ومستمرة.
 *  rateLimit(db, key, windowS, limit) → نداء ذرّي واحد إلى RPC shield_hit (نافذة ثابتة في Postgres) — لا تعتمد على ذاكرة نسخة الخادم.
 *  مسار سريع في الذاكرة: إن تجاوز المفتاح حدّه في هذه النسخة نرفض فورًا دون قراءة قاعدة البيانات حتى نهاية النافذة.
 *  احتياط: إن غاب RPC (قبل تنفيذ SQL) أو تعطّلت القاعدة → نافذة ذاكرة محلية (أفضل من لا شيء) مع علم fallback.
 *  الردّ القياسي tooMany(): 429 بالعربية + Retry-After + X-Request-Id.
 */
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export type RateResult = { allowed: boolean; count: number; limit: number; retryAfter: number; fallback: boolean };
type MemHit = { n: number; slot: number };
const mem = new Map<string, MemHit>();
const MEM_MAX = 5000;

export const ipOf = (req: Request) => ((req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
export const requestId = () => randomBytes(6).toString('hex');

function memHit(key: string, windowS: number, limit: number): RateResult {
  const slot = Math.floor(Date.now() / 1000 / windowS); const h = mem.get(key);
  const n = h && h.slot === slot ? h.n + 1 : 1; mem.set(key, { n, slot });
  if (mem.size > MEM_MAX) { const cutoff = slot - 1; for (const [k, v] of mem) if (v.slot < cutoff) mem.delete(k); }
  const retryAfter = Math.max(1, (slot + 1) * windowS - Math.floor(Date.now() / 1000));
  return { allowed: n <= limit, count: n, limit, retryAfter, fallback: true };
}

/** key: اسم المسار + الهوية (ip أو client أو user) — مثل `oauth_token:ip:1.2.3.4` */
export async function rateLimit(db: any, key: string, windowS: number, limit: number): Promise<RateResult> {
  const slot = Math.floor(Date.now() / 1000 / windowS); const h = mem.get(key);
  if (h && h.slot === slot && h.n > limit) { h.n += 1; return { allowed: false, count: h.n, limit, retryAfter: Math.max(1, (slot + 1) * windowS - Math.floor(Date.now() / 1000)), fallback: false }; } // مسار سريع
  if (!db) return memHit(key, windowS, limit);
  try {
    const { data, error } = await db.rpc('shield_hit', { p_key: key, p_window_s: windowS, p_limit: limit });
    if (error || !data || typeof data !== 'object') return memHit(key, windowS, limit);
    const r = data as any; const count = Number(r.count || 0);
    mem.set(key, { n: count, slot });
    return { allowed: !!r.allowed, count, limit, retryAfter: Math.max(1, Number(r.retry_after || windowS)), fallback: false };
  } catch { return memHit(key, windowS, limit); }
}

/** 429 موحَّد */
export function tooMany(r: RateResult, ar = 'محاولات كثيرة — حاول لاحقًا', extraHeaders: Record<string, string> = {}) {
  const rid = requestId();
  return NextResponse.json({ success: false, error: `${ar} (بعد ${r.retryAfter} ث)`, error_en: 'Too many requests', retry_after: r.retryAfter, request_id: rid },
    { status: 429, headers: { 'Retry-After': String(r.retryAfter), 'X-Request-Id': rid, 'Cache-Control': 'no-store', ...extraHeaders } });
}

/** الحدود القياسية (ثوانٍ، عدد) — مرجع واحد يسهل ضبطه */
export const LIMITS = {
  oauth_token_ip: { w: 60, n: 20 }, oauth_token_client: { w: 60, n: 10 }, oauth_register_ip: { w: 3600, n: 60 }, oauth_describe_ip: { w: 60, n: 30 },
  mcp_public_ip: { w: 3600, n: 120 }, mcp_401_ip: { w: 3600, n: 20 },
  vc_ip: { w: 3600, n: 120 }, credential_ip: { w: 3600, n: 12 }, advisor_ip: { w: 3600, n: 20 }, sim_anon_ip: { w: 3600, n: 40 },
  vuln_report_ip: { w: 3600, n: 3 }, csp_ip: { w: 60, n: 30 },
  council_write_ip: { w: 3600, n: 90 }, // P23: نشر/التزام/شهادة
  oauth_token_drill: { w: 60, n: 5 }, // التمرين الذاتي: دلو منفصل صغير (ترويسة X-Athar-Drill) حتى لا يلوّث دلو الـ IP الحقيقي
} as const;
export type LimitName = keyof typeof LIMITS;
export const limitFor = (db: any, name: LimitName, id: string) => rateLimit(db, `${name}:${id}`, LIMITS[name].w, LIMITS[name].n);

/** للاختبارات: تصفير ذاكرة النسخة */
export const _resetMem = () => mem.clear();
