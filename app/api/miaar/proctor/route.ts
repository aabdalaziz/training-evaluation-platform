// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/miaar/proctor — P68-ب-2 «ختم المراقب»: بلا تسجيل دخول — الهوية هي QR الموقَّع على نسخة المراقب (HMAC على رمز الدعوة + رمز النموذج)
 *  GET  ?invite=<code>&t=<token>                       → حالة الختم (الدعوة · النموذج · الأختام · القاعات المفتوحة · عدد الجلسات)
 *  POST {invite, t, kind: open|close, hall, count?}    → ختم فتح (رقم القاعة) أو إغلاق (+ «عدّ القاعة» يُقارن بالجلسات)
 *  لا أسماء: رقم القاعة فقط · ≤ 10 أختام لكل دعوة · حدّ معدّل بالـ IP · حدث درع miaar_proctor_stamped (warn عند فرق العدّ)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, crossSiteBrowserWrite } from '../../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { stampState, addStamp } from '../../../../lib/miaar/forms';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const NO = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
function db() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !S) return null; return createClient(U, S, { auth: { persistSession: false } }); }

export async function GET(req: Request) {
  const d = db(); if (!d) return bad('إعدادات الخادم غير مكتملة', 500);
  const rl = await rateLimit(d, `miaar_proctor:${ipOf(req)}`, 3600, 120); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة — حاول بعد قليل');
  const u = new URL(req.url); const r = await stampState(d, u.searchParams.get('invite'), u.searchParams.get('t'));
  return 'error' in r ? bad(r.error, r.status || 400) : NextResponse.json({ success: true, ...r }, { headers: NO });
}
export async function POST(req: Request) {
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const d = db(); if (!d) return bad('إعدادات الخادم غير مكتملة', 500);
  const rl = await rateLimit(d, `miaar_proctor_w:${ipOf(req)}`, 3600, 30); if (!rl.allowed) return tooMany(rl, 'أختام كثيرة من هذا الجهاز — حاول لاحقًا');
  const j = await readJson(req, { maxBytes: 8 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const r = await addStamp(d, { invite_code: b.invite, token: b.t, kind: b.kind, hall: b.hall, count: b.count });
  if (!r.ok) return bad(r.error, r.status || 400);
  return NextResponse.json({ success: true, stamp: r.stamp, stamps: r.stamps, hall: r.hall, note_ar: r.stamp.kind === 'open' ? `خُتم بدء المراقبة — القاعة ${r.stamp.hall}.` : `خُتم الإغلاق — القاعة ${r.stamp.hall}: عدّ ${r.stamp.count} ${r.stamp.diff === 0 ? 'يطابق الجلسات ✓' : `مقابل ${r.stamp.sessions} جلسة (فرق ${r.stamp.diff! > 0 ? '+' : ''}${r.stamp.diff}) — سُجّل في درع أَثَر`}` }, { headers: NO });
}
