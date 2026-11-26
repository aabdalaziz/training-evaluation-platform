// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P81 */
/**
 * /api/clock — «ساعة البرنامج» (إداري)
 *  GET  ?key=<CRON_SECRET>&dry=1            معاينة ما سيُنفَّذ اليوم (بلا إرسال) · بلا dry: تشغيل فعلي خارج موعد السلسلة
 *  POST { action: 'preview' }                معاينة للطاقم (Bearer)
 *  POST { action: 'run', event_id }          تنفيذ حدث واحد الآن (حتى لو تُجووِز أو تعثّر)
 *  POST { action: 'skip', event_id }         تجاوز حدث
 *  POST { action: 'reset', event_id }        إعادته إلى «بانتظار موعده»
 *  POST { action: 'generate', program_id? }  إعادة توليد الأحداث (برنامج واحد أو الكلّ)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '../../../lib/shield/body';
import { runProgramClock } from '../../../lib/clock/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteOf = (req: Request) => { const u = new URL(req.url); return (process.env.NEXT_PUBLIC_SITE_URL || `${u.protocol}//${u.host}`).replace(/\/$/, ''); };
function serviceDb() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; return URL_ && SERVICE ? createClient(URL_, SERVICE, { auth: { persistSession: false } }) : null; }

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return bad('unauthorized', 401);
  const db = serviceDb(); if (!db) return bad('SUPABASE_SERVICE_ROLE_KEY مطلوب', 500);
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  return NextResponse.json({ success: true, ...(await runProgramClock(db, { site: siteOf(req), dry })) });
}

export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!SUPABASE_URL || !ANON) return bad('إعدادات الخادم غير مكتملة', 500);
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser(token); if (uErr || !u?.user) return bad('جلسة المستخدم غير صالحة', 401);
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', u.user.id).single(); if (!ALLOWED.includes(String((profile as any)?.role || '').toUpperCase())) return bad('غير مصرح', 403);
  const db = serviceDb(); if (!db) return bad('SUPABASE_SERVICE_ROLE_KEY مطلوب', 500);
  const body = await req.json().catch(() => ({})); const action = String(body.action || ''); const site = siteOf(req);
  if (action === 'preview') return NextResponse.json({ success: true, ...(await runProgramClock(db, { site, dry: true })) });
  if (action === 'generate') { const { data, error } = body.program_id ? await db.rpc('program_clock_generate', { p_program: body.program_id }) : await db.rpc('program_clock_generate_all'); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, generated: Number(data) || 0 }); }
  if (!body.event_id || !/^[0-9a-f-]{36}$/i.test(String(body.event_id))) return bad('event_id مطلوب');
  if (action === 'run') { const r = await runProgramClock(db, { site, dry: false, eventId: String(body.event_id) }); return NextResponse.json({ success: true, ...r }); }
  if (action === 'skip' || action === 'reset') {
    const patch = action === 'skip' ? { status: 'skipped', done_at: new Date().toISOString(), result: { reason: 'تجاوز يدوي', by: u.user.email } } : { status: 'pending', done_at: null, result: null };
    const { error } = await db.from('program_clock_events').update(patch).eq('id', body.event_id); if (error) return bad(error.message, 500); return NextResponse.json({ success: true });
  }
  return bad('action غير معروف');
}
