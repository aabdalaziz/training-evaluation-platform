// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66-ب «هيكل الدبلوم» — المستويات · المقرّرات · الشُّعب · أساتذة المواد · جدول المحاضرات · الفترات الخاصّة
 *  GET  /api/diploma?program=<id>            → الهيكل كاملًا (للطاقم ومنسّق الشعبة وأساتذة المواد: قراءة؛ التعديل للطاقم والمنسّق)
 *  GET  /api/diploma?list=1                  → برامجي التي أرى هيكلها (اختيار البرنامج)
 *  GET  /api/diploma?today=1                 → «ماذا عندي اليوم؟» (متدرّب أو أستاذ) — نصّ واحد + البنود
 *  GET  /api/diploma?corridor=<session_id>   → «الممرّ»: بطاقة الشعبة القادمة لأستاذ المحاضرة (k ≥ 5، بلا أسماء)
 *  POST { action:'course', program_id, unit_id, level_no?, trainer_id?, code? | levels_count }     المقرّر: المستوى/أستاذ المادة/الرمز
 *  POST { action:'slot_save', program_id, id?, unit_id, classroom_id, trainer_id?, weekday, period_no, starts_at, minutes, from_day, to_day, room_ar?, provider? } ← يولّد المحاضرات القادمة
 *  POST { action:'slot_delete', program_id, id } · { action:'regenerate', program_id }
 *  POST { action:'period_save', program_id, id?, name_ar, from_day, to_day, lecture_minutes?, lecture_break_min?, first_lecture_at?, shift_minutes? } · { action:'period_delete', program_id, id }
 *  POST { action:'suggest', program_id, level_no, weekdays:[..], times:[{period_no,starts_at,minutes}], from_day, to_day, sections?:[..], per_week? } → اقتراح (لا يُحفظ)
 *  POST { action:'adopt', program_id, proposed:[..] } → اعتماد الاقتراح (حفظ + توليد)
 *  POST { action:'substitutes', program_id, slot_id, day } · { action:'substitute', program_id, slot_id, day, trainer_id } → البديل بلمسة
 *  POST { action:'move_request', program_id, to_classroom?, reason_ar }  (المتدرّب) · { action:'move_decide', program_id, id, status, note_ar?, to_classroom? } (الطاقم/المنسّق)
 *  المصادقة: Bearer. الحدّ: 60 كتابة/ساعة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../lib/shield/ratelimit';
import { normEmail } from '../../../lib/portal/roles';
import { STAFF_ROLES } from '../../../lib/portal/sign';
import { resolveTrainer } from '../../../lib/portal/day';
import { structureView, myPrograms, saveCourse, saveSlot, deleteSlot, regenerate, savePeriod, deletePeriod, suggest, adopt, substitutes, applySubstitute, corridor, myLecturesToday, requestMove, decideMove } from '../../../lib/diploma/store';
import { D_NAMES_AR } from '../../../lib/diploma/registry';
import { freezeGate } from '../../../lib/shield/freeze';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{1,40}$/.test(v);
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const email = normEmail(String(data.user.email || '')); const { data: prof } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  const staff = STAFF_ROLES.includes(role); const t = await resolveTrainer(db, { id: data.user.id, email, staff, fullName: (prof as any)?.full_name || null }, null);
  return { db, me: { id: data.user.id, email, name: t.name || (prof as any)?.full_name || null, staff, trainerIds: t.trainerIds } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c; const u = new URL(req.url);
  const program = u.searchParams.get('program'); const corridorId = u.searchParams.get('corridor');
  if (u.searchParams.get('list')) { const programs = await myPrograms(db, me); return NextResponse.json({ success: true, programs, names: D_NAMES_AR }, { headers: NO }); }
  if (u.searchParams.get('today')) { const r = await myLecturesToday(db, me, new Date()); return NextResponse.json({ success: true, ...r, names: D_NAMES_AR }, { headers: NO }); }
  if (corridorId) { if (!isId(corridorId)) return bad('معرّف غير صالح'); const r = await corridor(db, me, corridorId, new Date()); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true, ...r }, { headers: NO }); }
  if (program) { if (!isId(program)) return bad('معرّف غير صالح'); const v = await structureView(db, me, program, new Date()); if ('error' in v) return bad(v.error, v.status); return NextResponse.json({ success: true, ...v }, { headers: NO }); }
  return bad('حدّد program أو today أو corridor');
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c;
  const fz = await freezeGate(db, me); if (fz) return fz; /* P65 ★3 زرّ التجميد: جهة مجمَّدة = قراءة فقط */
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); if (!isId(String(body.program_id || ''))) return bad('حدّد البرنامج');
  const rl = await rateLimit(db, `diploma:${me.id}`, 3600, 60); if (!rl.allowed) return tooMany(rl); const now = new Date();
  const out = (r: any) => (r.ok ? NextResponse.json({ success: true, ...r }, { headers: NO }) : bad(r.error, r.status));
  if (action === 'course') return out(await saveCourse(db, me, body));
  if (action === 'slot_save') return out(await saveSlot(db, me, body, now));
  if (action === 'slot_delete') return out(await deleteSlot(db, me, body, now));
  if (action === 'regenerate') return out(await regenerate(db, me, body, now));
  if (action === 'period_save') return out(await savePeriod(db, me, body, now));
  if (action === 'period_delete') return out(await deletePeriod(db, me, body, now));
  if (action === 'suggest') return out(await suggest(db, me, body));
  if (action === 'adopt') return out(await adopt(db, me, body, now));
  if (action === 'substitutes') return out(await substitutes(db, me, body));
  if (action === 'substitute') return out(await applySubstitute(db, me, body, now));
  if (action === 'move_request') return out(await requestMove(db, me, body, now));
  if (action === 'move_decide') return out(await decideMove(db, me, body, now));
  return bad('إجراء غير معروف');
}
