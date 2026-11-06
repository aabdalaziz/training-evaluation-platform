// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P51 «دفتر اليوم» — سجلّ المدرّب اليومي
 *  GET  /api/me/day                → الدفتر (المدرّب: شُعبه وجلساته · الطاقم: دفتره أو ?trainer=<id> للاطّلاع فقط)
 *  POST /api/me/day {action:'word', classroom_id, mode:'one'|'absent'|'idle'|'all', email?, text?, template?} → «كلمة» داخل أَثَر
 *  POST /api/me/day {action:'seen_replies', classroom_id?} → P53: تعليم ردود المتعلّمين على كلمتي مقروءة (شعبة أو الكلّ)
 *  المصادقة: Bearer · المدرّب = TRAINER أو بريده في trainers · الطاقم = STAFF_ROLES. غيرهم 403. لا «كلمة» بالنيابة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { normalizeSite } from '../../../../lib/portal/open';
import { normEmail } from '../../../../lib/portal/roles';
import { STAFF_ROLES } from '../../../../lib/portal/sign';
import { collectDayBook, resolveTrainer, sendWord, cleanWord, DAY_TITLE, WORD_MAX, WORDS_PER_HOUR } from '../../../../lib/portal/day';
import type { WordMode } from '../../../../lib/portal/day';
import { markRepliesSeen } from '../../../../lib/portal/word-reply'; /* P53 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO });
const NO = { 'Cache-Control': 'private, no-store' };
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{1,40}$/.test(v);
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const MODES: WordMode[] = ['one', 'absent', 'idle', 'all'];

async function ctx(req: Request, wantTrainer?: string | null) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const email = normEmail(String(data.user.email || '')); const { data: prof } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  const staff = STAFF_ROLES.includes(role);
  const me = await resolveTrainer(db, { id: data.user.id, email, staff, fullName: (prof as any)?.full_name || null }, wantTrainer && isId(wantTrainer) ? wantTrainer : null);
  if (!staff && role !== 'TRAINER' && !me.trainerIds.length) return { error: bad('«دفتر اليوم» للمدرّبين والطاقم', 403) };
  return { db, me };
}

export async function GET(req: Request) {
  const u = new URL(req.url); const c = await ctx(req, u.searchParams.get('trainer')); if ('error' in c) return c.error; const { db, me } = c;
  const rl = await rateLimit(db, `day:user:${me.id}`, 120, 60); if (!rl.allowed) return tooMany(rl);
  const book = await collectDayBook(db, me, siteOf(req));
  return NextResponse.json({ success: true, title: DAY_TITLE, ...book }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c;
  const rl = await rateLimit(db, `day:word:${me.id}`, 3600, WORDS_PER_HOUR) /* P53: تصحيح ترتيب (نافذة، حدّ) */; if (!rl.allowed) return tooMany(rl);
  const jr = await readJson(req, { maxBytes: 16 * 1024 }); if (!jr.ok) return bad(jr.error, jr.status); const b = jr.body as Record<string, unknown>;
  if (b.action === 'seen_replies') { /* P53 */
    if (!me.trainerIds.length) return bad('لا ردود بلا بطاقة مدرّب', 403); if (me.viewing_other) return bad('الاطّلاع فقط — «قرأت» للمدرّب نفسه', 403);
    const n = await markRepliesSeen(db, [...me.trainerIds, me.id], isId(b.classroom_id) ? b.classroom_id : null); return NextResponse.json({ success: true, seen: n }, { headers: NO });
  }
  if (b.action !== 'word') return bad('إجراء غير معروف');
  if (!me.trainerIds.length) return bad('«كلمة» تُرسل من مدرّب الشعبة نفسه — بريدك غير مربوط ببطاقة مدرّب', 403);
  if (me.viewing_other) return bad('لا «كلمة» بالنيابة عن مدرّب آخر', 403);
  const mode = MODES.includes(b.mode as WordMode) ? (b.mode as WordMode) : null; if (!mode || !isId(b.classroom_id)) return bad('حدّد الشعبة ووضع الإرسال');
  const text = cleanWord(b.text); const template = typeof b.template === 'string' ? b.template : null;
  if (String(b.text || '').length > WORD_MAX * 3) return bad(`الكلمة أطول من ${WORD_MAX} حرفًا`, 400, { code: 'too_long' });
  if (!text && !template) return bad('اكتب كلمة أو اختر صيغة', 400, { code: 'empty' });
  const book = await collectDayBook(db, me, siteOf(req)); const room = book.classrooms.find((r) => r.id === b.classroom_id);
  if (!room) return bad('هذه الشعبة ليست من شُعبك', 404, { code: 'not_my_classroom' });
  const r = await sendWord(db, me, room, { mode, email: typeof b.email === 'string' ? b.email : null, text, template });
  if ('error' in r) return bad(r.error, 400, { code: 'no_recipients' });
  try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: me.staff ? 'STAFF' : 'TRAINER', action: 'trainer_word', entity_type: 'classroom', entity_id: room.id, entity_label: `شعبة ${room.code}`, source: 'portal', metadata: { mode, recipients: r.recipients, sent: r.sent, template, chars: text.length, ip: ipOf(req) } }); } catch { /* التدقيق لا يوقف الكلمة */ }
  return NextResponse.json({ success: true, ...r, words_today: book.words_today + 1 }, { headers: NO });
}
