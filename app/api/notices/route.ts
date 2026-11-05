/**
 * P39 «إشعارات المتعلّم» — واجهة «تنبيهاتي» (داخل أَثَر)
 *  GET  /api/notices?limit=20[&unread=1]   → إشعارات صاحب الجلسة (ببريده) + عدد غير المقروء
 *  POST /api/notices {action:'read', ids:[…] | all:true} → تعليم مقروء
 *  المتقدّم بلا حساب يرى إشعاراته على بطاقة نتيجته (/api/miaar?result=ML-…) — لا هنا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listNotices, markRead, KIND_AR, KIND_ICON } from '../../../lib/portal/notices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase() } };
}

const shape = (n: any) => ({ id: n.id, kind: n.kind, kind_ar: KIND_AR[n.kind as keyof typeof KIND_AR] || 'تنبيه', icon: KIND_ICON[n.kind as keyof typeof KIND_ICON] || '🔔', title_ar: n.title_ar, body_ar: n.body_ar, url: n.url, pushed: !!n.pushed, read_at: n.read_at, created_at: n.created_at });

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const u = new URL(req.url); const limit = Math.min(50, Math.max(1, Number(u.searchParams.get('limit') || 20) || 20)); const unreadOnly = u.searchParams.get('unread') === '1';
  const rows = await listNotices(db, user.email, { limit, unreadOnly });
  const unread = unreadOnly ? rows.length : (await listNotices(db, user.email, { limit: 50, unreadOnly: true })).length;
  return NextResponse.json({ success: true, unread, notices: rows.map(shape) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || 'read');
  if (action === 'read') {
    const n = await markRead(db, user.email, body.all ? 'all' : (Array.isArray(body.ids) ? body.ids.map(String) : []));
    return NextResponse.json({ success: true, marked: n }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
