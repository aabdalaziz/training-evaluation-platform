// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/placements — نتائج مِعيار في أَثَر (P7 → م3)
 *  منذ «مِعيار — من أَثَر» (م1) تُكتب كل نتيجة في portal_placements مباشرةً لحظة اكتمال الاختبار (lib/miaar/engine.ts → recordPlacement)،
 *  فلم تعد هناك قاعدة خارجية تُزامَن منها. المسارات باقية لتوافق الواجهات القديمة:
 *  POST { action: 'mine' }  → مستخدم: أحدث نتائجه ببريده (بلا مزامنة)
 *  POST { action: 'sync' }  → موظف: يرجع { success:true, retired:true, imported:0 } — لا عمل
 *  GET                      → { success:true, configured:true, retired:true }
 *  متغيّرا البيئة MIAAR_SUPABASE_URL / MIAAR_SERVICE_ROLE_KEY لم يعودا مطلوبَين ويمكن حذفهما من Vercel.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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

export async function GET() { return NextResponse.json({ success: true, configured: true, retired: true, note: 'النتائج تُكتب مباشرة من مِعيار داخل أَثَر — لا مزامنة' }); }

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');
  if (action === 'mine') {
    const { data } = await c.db.from('portal_placements').select('*').ilike('email', c.user.email).order('taken_at', { ascending: false }).limit(5);
    return NextResponse.json({ success: true, configured: true, retired: true, placements: data || [] });
  }
  if (!c.staff) return bad('غير مصرّح', 403);
  if (action === 'sync') return NextResponse.json({ success: true, retired: true, fetched: 0, imported: 0, skipped: 0, note: 'المزامنة متقاعدة: مِعيار داخل أَثَر يكتب النتائج مباشرة' });
  return bad('إجراء غير معروف');
}
