// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/enter — P67 «الاسم يدخل من الباب»: باب الدخول بالرمز (بلا بريد)
 *  GET  ?o=<slug>                      → عام: اسم الجهة + هل الدخول بالرمز مفعَّل + دقائق الكشك (لا شيء آخر)
 *  POST { o, no, pin }                 → جلسة Supabase (access/refresh) أو 401/423 — القفل بعد 5 محاولات متتالية
 *  الحدّ: 20 محاولة/10 دقائق لكل IP (portal_rate_buckets — لا كرون جديد) · البريد المصطنع لا يُراسَل ولا يُعرض
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { orgBySlug, enterWithCode } from '../../../lib/org/roster';
import { rateLimit, tooMany, ipOf } from '../../../lib/shield/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO });
function service() {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return null; return { db: createClient(URL_, SERVICE, { auth: { persistSession: false } }), url: URL_, anon: ANON };
}

export async function GET(req: Request) {
  const s = service(); if (!s) return bad('إعدادات الخادم غير مكتملة', 500);
  const slug = String(new URL(req.url).searchParams.get('o') || '').trim().toLowerCase(); if (!slug) return bad('حدّد الجهة ?o=');
  const org = await orgBySlug(s.db, slug); if (!org) return bad('لا توجد جهة بهذا المُعرِّف', 404);
  return NextResponse.json({ success: true, org: { name_ar: org.name_ar, name_en: org.name_en, slug: org.slug, code_login: org.policy.code_login, kiosk_minutes: org.policy.kiosk_minutes, frozen: !!org.frozen } }, { headers: NO });
}

export async function POST(req: Request) {
  const s = service(); if (!s) return bad('إعدادات الخادم غير مكتملة', 500);
  const ip = ipOf(req); const rl = await rateLimit(s.db, `enter:${ip}`, 600, 20); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة من هذا الجهاز — انتظر قليلًا');
  let body: any = {}; try { body = await req.json(); } catch { return bad('طلب غير صالح'); }
  const r = await enterWithCode(s.db, { slug: String(body.o || ''), training_no: String(body.no || ''), pin: String(body.pin || ''), url: s.url, anon: s.anon, ip });
  if (!r.ok) return bad(r.error, r.status, { locked_until: r.locked_until || null, remaining: r.remaining ?? null });
  return NextResponse.json({ success: true, access_token: r.access_token, refresh_token: r.refresh_token, expires_in: r.expires_in, first_login: r.first_login, pin_changed: r.pin_changed, org: r.org, epithet: r.epithet }, { headers: NO });
}
