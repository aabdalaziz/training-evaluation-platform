// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P59 «نسيج الشعبة — ما نسجه متعلّموك معًا» — واجهة المدرّب
 *  GET  /api/me/day/weave                         → شُعبي (مع عدد المنسوبين)
 *  GET  /api/me/day/weave?classroom=<id>[&fresh=1] → النسيج المجمَّع للشعبة (k ≥ 5 في كل شيء · بلا أسماء · ذاكرة 5 دقائق)
 *  POST /api/me/day/weave {classroom_id, text}     → «كلمة على النسيج»: كلمة واحدة لكل الشعبة (تمرّ بالمسار نفسه: sendWord · mode=all · meta.weave)
 *  المصادقة: Bearer · المدرّب صاحب الشعبة أو الطاقم (?trainer= للاطّلاع فقط، لا كلمة بالنيابة) · الحدّ: 30 طلبًا/دقيقة
 *  لا ذكاء اصطناعي · لا يدخل في أي تقييم · لا يرى المدرّب خيط فرد ولا كلمته إلا بإذنه الصريح
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { rateLimit, tooMany } from '../../../../../lib/shield/ratelimit';
import { normalizeSite } from '../../../../../lib/portal/open';
import { normEmail } from '../../../../../lib/portal/roles';
import { STAFF_ROLES } from '../../../../../lib/portal/sign';
import { resolveTrainer, collectDayBook, sendWord, cleanWord, WORD_MAX, WORDS_PER_HOUR } from '../../../../../lib/portal/day';
import { loadWeave } from '../../../../../lib/map/weave-load';
import type { WeaveRoom } from '../../../../../lib/map/weave-load';
import { WEAVE_TITLE, WEAVE_OFFICIAL, WEAVE_LIMITS, RULE_AR, KIND_AR } from '../../../../../lib/map/weave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO });
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{1,40}$/.test(v);
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);

async function ctx(req: Request, wantTrainer?: string | null) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const email = normEmail(String(data.user.email || '')); const { data: prof } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  const staff = STAFF_ROLES.includes(role);
  const me = await resolveTrainer(db, { id: data.user.id, email, staff, fullName: (prof as any)?.full_name || null }, wantTrainer && isId(wantTrainer) ? wantTrainer : null);
  if (!staff && role !== 'TRAINER' && !me.trainerIds.length) return { error: bad('«نسيج الشعبة» للمدرّبين والطاقم', 403) };
  return { db, me };
}

export async function GET(req: Request) {
  const u = new URL(req.url); const c = await ctx(req, u.searchParams.get('trainer')); if ('error' in c) return c.error; const { db, me } = c;
  const rl = await rateLimit(db, `weave:${me.id}`, 60, 30); if (!rl.allowed) return tooMany(rl);
  const book = await collectDayBook(db, me, siteOf(req)); const rooms: WeaveRoom[] = book.classrooms.map((r) => ({ id: r.id, code: r.code, section_name: r.section_name, roster: r.roster }));
  const cid = u.searchParams.get('classroom');
  if (!cid) return NextResponse.json({ success: true, title: WEAVE_TITLE, official: WEAVE_OFFICIAL, limits: WEAVE_LIMITS, trainer_name: me.name, viewing_other: me.viewing_other, rooms }, { headers: NO });
  if (!isId(cid)) return bad('معرّف شعبة غير صالح');
  const room = rooms.find((r) => r.id === cid); const full = book.classrooms.find((r) => r.id === cid); if (!room || !full) return bad('هذه الشعبة ليست من شُعبك', 404, { code: 'not_my_classroom' });
  const w = await loadWeave(db, room.id, full.roster_list.map((l) => l.email), { fresh: u.searchParams.get('fresh') === '1' });
  return NextResponse.json({ success: true, title: WEAVE_TITLE, official: WEAVE_OFFICIAL, limits: WEAVE_LIMITS, rules: RULE_AR, kinds: KIND_AR, room, rooms, viewing_other: me.viewing_other, weave: w }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c;
  const rl = await rateLimit(db, `day:word:${me.id}`, 3600, WORDS_PER_HOUR); if (!rl.allowed) return tooMany(rl);
  const jr = await readJson(req, { maxBytes: 8 * 1024 }); if (!jr.ok) return bad(jr.error, jr.status); const b = jr.body as Record<string, unknown>;
  if (!me.trainerIds.length) return bad('«كلمة على النسيج» من مدرّب الشعبة نفسه', 403); if (me.viewing_other) return bad('لا كلمة بالنيابة عن مدرّب آخر', 403);
  if (!isId(b.classroom_id)) return bad('حدّد الشعبة');
  const text = cleanWord(b.text); if (text.length < 2) return bad('اكتب كلمتك على النسيج', 400, { code: 'empty' }); if (String(b.text || '').length > WORD_MAX * 3) return bad(`الكلمة أطول من ${WORD_MAX} حرفًا`, 400, { code: 'too_long' });
  const book = await collectDayBook(db, me, siteOf(req)); const room = book.classrooms.find((r) => r.id === b.classroom_id);
  if (!room) return bad('هذه الشعبة ليست من شُعبك', 404, { code: 'not_my_classroom' });
  const r = await sendWord(db, me, room, { mode: 'all', text, weave: true });
  if ('error' in r) return bad(r.error, 400, { code: 'no_recipients' });
  try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: me.staff ? 'STAFF' : 'TRAINER', action: 'weave_word', entity_type: 'classroom', entity_id: room.id, entity_label: `شعبة ${room.code}`, source: 'portal', metadata: { recipients: r.recipients, sent: r.sent } }); } catch { /* لا يعطّل */ }
  return NextResponse.json({ success: true, ...r }, { headers: NO });
}
