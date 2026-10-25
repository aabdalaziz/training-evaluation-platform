// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/placements — تكامل مِعيار (بوابة أَثَر · P7)
 *  POST { action: 'mine' }            → مستخدم: مزامنة نتائجه ببريده من مِعيار ثم إرجاع أحدث نتيجة
 *  POST { action: 'sync', since? }    → موظف: استيراد التقارير الجديدة كلها
 *  GET  ?health=1                     → موظف/زائر: هل إعدادات مِعيار مضبوطة؟ (بلا أسرار)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncPlacements, miaarClient } from '../../../lib/portal/placement-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return { user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() }, staff: WRITERS.includes(String((prof as any)?.role || '').toUpperCase()), db: createClient(URL_, SERVICE) };
}

export async function GET() { return NextResponse.json({ success: true, configured: !!miaarClient() }); }

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');
  if (action === 'mine') {
    const sync = await syncPlacements(c.db, { email: c.user.email, limit: 20 });
    const { data } = await c.db.from('portal_placements').select('*').ilike('email', c.user.email).order('taken_at', { ascending: false }).limit(5);
    return NextResponse.json({ success: true, configured: sync.ok || !String((sync as any).error || '').includes('MIAAR_'), synced: sync, placements: data || [] });
  }
  if (!c.staff) return bad('غير مصرّح', 403);
  if (action === 'sync') { const r = await syncPlacements(c.db, { since: body.since || null, limit: Number(body.limit) || 500 }); return NextResponse.json({ success: r.ok, ...r }); }
  return bad('إجراء غير معروف');
}
