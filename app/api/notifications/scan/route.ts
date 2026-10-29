/**
 * /api/notifications/scan
 *  POST  Authorization: Bearer <access_token> — «فحص الآن» من مركز الإشعارات (موظفو المنصة)
 *  GET   ?key=<CRON_SECRET>                — تشغيل يدوي/مجدول (يُشغَّل أيضًا تلقائيًا ضمن Cron /api/followups/send)
 *  يحتاج: SUPABASE_SERVICE_ROLE_KEY (للـ GET)، RESEND_API_KEY (اختياري لبريد الملخص)، NOTIFY_EMAILS (اختياري)
 */
import { NextResponse } from 'next/server';
import { cronAuthorized } from '../../../../lib/shield/body';
import { createClient } from '@supabase/supabase-js';
import { runNotificationScan } from '../../../../lib/notifications/scan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
function siteOf(req: Request) { const u = new URL(req.url); return (process.env.NEXT_PUBLIC_SITE_URL || `${u.protocol}//${u.host}`).replace(/\/$/, ''); }

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
  if (!SUPABASE_URL || !ANON) return bad('إعدادات Supabase غير مكتملة', 500);
  // عميل المستخدم نفسه: الدالة notifications_scan تتحقق من الدور داخليًا
  const db = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return bad('جلسة غير صالحة', 401);
  try {
    const body = await req.json().catch(() => ({}));
    const res = await runNotificationScan(db, { source: 'manual', site: siteOf(req), email: !!body?.email });
    return NextResponse.json({ success: true, ...res });
  } catch (e: any) { return bad(e?.message || String(e), /forbidden/.test(String(e?.message)) ? 403 : 500); }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!cronAuthorized(req)) return bad('unauthorized', 401);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return bad('SUPABASE_SERVICE_ROLE_KEY مطلوب', 500);
  const db = createClient(SUPABASE_URL, key);
  try {
    const res = await runNotificationScan(db, { source: 'cron', site: siteOf(req), email: url.searchParams.get('email') !== '0' });
    return NextResponse.json({ success: true, ...res });
  } catch (e: any) { return bad(e?.message || String(e), 500); }
}
