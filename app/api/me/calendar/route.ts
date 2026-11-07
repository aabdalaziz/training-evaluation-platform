// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «تقويم الشعبة» — للمدرّب صاحب الشعبة أو الطاقم
 *  GET  /api/me/calendar?room=<classroom_id>        → التقويم (الأيام · الكتل · فترات التطبيق) · طور اليوم · عدد المقيَّدين · «ما جرى في الميدان» (k ≥ 5، بلا أسماء) · من كتب سطر اليوم (عدد)
 *  GET  /api/me/calendar?rooms=a,b,c                → ملخّص لكل شعبة (هل لها تقويم · الطور · عدد الكتل والفترات) — لبطاقة دفتر اليوم
 *  POST /api/me/calendar { action:'save', classroom_id, days?:[...] | text?:'...' | start,n | start,block_len,every_weeks,blocks } → حفظ/استبدال التقويم
 *  POST /api/me/calendar { action:'clear', classroom_id } → إزالة التقويم (يعود البرنامج متّصلًا)
 *  المصادقة: Bearer · المدرّب = بريده في trainers وشعبته · الطاقم = STAFF_ROLES. الحدّ: 30 حفظًا/ساعة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { normEmail } from '../../../../lib/portal/roles';
import { STAFF_ROLES } from '../../../../lib/portal/sign';
import { resolveTrainer } from '../../../../lib/portal/day';
import { roomView, roomsSummary, saveCalendar, clearCalendar } from '../../../../lib/calendar/store';
import { P66_NAMES_AR, CAL_LIMITS } from '../../../../lib/calendar/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{1,40}$/.test(v);
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const email = normEmail(String(data.user.email || '')); const { data: prof } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  const staff = STAFF_ROLES.includes(role); const t = await resolveTrainer(db, { id: data.user.id, email, staff, fullName: (prof as any)?.full_name || null }, null);
  if (!staff && role !== 'TRAINER' && !t.trainerIds.length) return { error: bad('«تقويم الشعبة» للمدرّبين والطاقم', 403) };
  return { db, me: { id: data.user.id, email, name: t.name, staff, trainerIds: t.trainerIds } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c; const u = new URL(req.url);
  const room = u.searchParams.get('room'); const rooms = u.searchParams.get('rooms');
  if (room) { if (!isId(room)) return bad('معرّف غير صالح'); const v = await roomView(db, me, room, new Date()); if ('error' in v) return bad(v.error, v.status); return NextResponse.json({ success: true, ...v }, { headers: NO }); }
  if (rooms) { const ids = rooms.split(',').map((s) => s.trim()).filter(isId).slice(0, 50); return NextResponse.json({ success: true, rooms: await roomsSummary(db, ids, new Date()), names: P66_NAMES_AR }, { headers: NO }); }
  return bad('حدّد الشعبة (room) أو الشُّعب (rooms)');
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c;
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); const cid = String(body.classroom_id || ''); if (!isId(cid)) return bad('حدّد الشعبة');
  const rl = await rateLimit(db, `calendar:${me.id}`, 3600, 30); if (!rl.allowed) return tooMany(rl);
  if (action === 'save') { const r = await saveCalendar(db, me, cid, body, new Date()); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true, calendar: r.calendar, phase: r.phase, limits: CAL_LIMITS }, { headers: NO }); }
  if (action === 'clear') { const r = await clearCalendar(db, me, cid); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
