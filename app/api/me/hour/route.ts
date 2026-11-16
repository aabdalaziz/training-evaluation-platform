// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P73 «ساعة أَثَر» (الرسمي: لقاء التأمل الأسبوعي للشعبة)
 *  GET  /api/me/hour                        → شُعبي وساعاتها (متدرّبًا أو أستاذًا): التثبيت · الطور الآن · سطر آخر ساعة
 *  GET  /api/me/hour?classroom=<id>         → الغرفة: «ما كتبناه هذا الأسبوع» (k ≥ 5) · ما حملتُه · سحابة الكلمات (k ≥ 5) · السطور والأصوات · الختم · ساعات سابقة
 *  POST { action:'pin', classroom_id, weekday, time }  (الأستاذ) تثبيت أسبوعي حتى نهاية البرنامج — لا موعد افتراضي
 *  POST { action:'unpin', classroom_id }               (الأستاذ) إلغاء المواعيد القادمة
 *  POST { action:'carry', classroom_id, line_id }      (المتدرّب) «أحمله معي» — إشعار لصاحب السطر بلا اسم
 *  POST { action:'word',  classroom_id, text }         (المتدرّب) كلمة واحدة ≤ 24
 *  POST { action:'line',  classroom_id, text }         (المتدرّب) سطر مقترَح ≤ 120
 *  POST { action:'vote',  classroom_id, line_id }      (المتدرّب) صوت واحد لسطر غيري (يُبدَّل)
 *  POST { action:'seal',  classroom_id }               (الأستاذ) ختم الساعة — الأعلى أصواتًا، والتعادل للأقصر
 *  المبدأ: لا درجة ولا حضور ولا تقرير؛ لا أسماء؛ لا ذكاء اصطناعي. المصادقة: Bearer · الحدّ: 60 كتابة/ساعة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { normEmail } from '../../../../lib/portal/roles';
import { STAFF_ROLES } from '../../../../lib/portal/sign';
import { freezeGate } from '../../../../lib/shield/freeze';
import { myHourRooms, hourView, pinHour, unpinHour, actCarry, actWord, actLine, actVote, actSeal } from '../../../../lib/hour/store';
import { P73_NAMES_AR, HOUR_LIMITS, RULES_AR, WEEKDAYS_AR } from '../../../../lib/hour/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{1,40}$/.test(v);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const email = normEmail(String(data.user.email)); const { data: prof } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  const { data: tr } = await db.from('trainers').select('id').ilike('email', email || 'x@x').limit(5);
  const me = { id: data.user.id, email, name: String((prof as any)?.full_name || (data.user.user_metadata as any)?.full_name || '').trim() || undefined, staff: STAFF_ROLES.includes(role), trainerIds: (Array.isArray(tr) ? tr : []).map((t: any) => String(t.id)) };
  return { db, me };
}
const audit = async (db: any, me: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: 'LEARNER', action: 'athar_hour', entity_type: 'portal_learning_lines', entity_id: String(meta.classroom_id || ''), meta }); } catch { /* لا شيء */ } };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c; const u = new URL(req.url);
  const rl = await rateLimit(db, `hour:get:${me.id}`, 60, 90); if (!rl.allowed) return tooMany(rl);
  const cid = u.searchParams.get('classroom');
  if (!cid) return NextResponse.json({ success: true, rooms: await myHourRooms(db, me), names: P73_NAMES_AR, limits: HOUR_LIMITS, rules_ar: RULES_AR, weekdays: WEEKDAYS_AR, now: new Date().toISOString() }, { headers: NO });
  if (!isId(cid)) return bad('معرّف شعبة غير صالح');
  const v = await hourView(db, me, cid); if ('error' in v) return bad(v.error, v.status);
  return NextResponse.json({ success: true, ...v, rules_ar: RULES_AR }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c;
  const fz = await freezeGate(db, me); if (fz) return fz; /* P65 جهة مجمَّدة = قراءة فقط */
  const rl = await rateLimit(db, `hour:post:${me.id}`, 3600, 60); if (!rl.allowed) return tooMany(rl);
  const jr = await readJson(req, { maxBytes: 4 * 1024 }); if (!jr.ok) return bad(jr.error, jr.status); const b = jr.body as Record<string, unknown>;
  const action = String(b.action || ''); const cid = b.classroom_id; if (!isId(cid)) return bad('حدّد الشعبة');
  let r: any;
  if (action === 'pin') r = await pinHour(db, me, cid, { weekday: b.weekday, time: b.time });
  else if (action === 'unpin') r = await unpinHour(db, me, cid);
  else if (action === 'carry') r = await actCarry(db, me, cid, { line_id: b.line_id });
  else if (action === 'word') r = await actWord(db, me, cid, { text: b.text });
  else if (action === 'line') r = await actLine(db, me, cid, { text: b.text });
  else if (action === 'vote') r = await actVote(db, me, cid, { line_id: b.line_id });
  else if (action === 'seal') r = await actSeal(db, me, cid);
  else return bad('إجراء غير معروف');
  if (!r.ok) return bad(r.error, r.status);
  await audit(db, me, { classroom_id: cid, action, ...(action === 'pin' ? { count: r.count } : {}), ...(action === 'seal' ? { people: r.meta.people, words: r.meta.words, lines: r.meta.lines } : {}) });
  const { ok, ...rest } = r; void ok; return NextResponse.json({ success: true, ...rest }, { headers: NO });
}
