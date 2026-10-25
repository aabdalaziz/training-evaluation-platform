// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/live — التعلّم المباشر (بوابة أَثَر · P6)
 *  POST { action: 'join', session_id }                         → أي زائر/مستخدم: تحقق الوصول (RLS) ⇒ رابط الانضمام + حدث joined
 *  POST { action: 'register', session_id, full_name, organization? } → مستخدم: تسجيل في ندوة عامة + بريد تأكيد
 *  POST { action: 'remind', session_id }                       → موظف: تذكير بالبريد لمتدربي الشعبة/البرنامج والمسجّلين
 *  POST { action: 'place', program_id, force? }                → موظف: إسكان المقبولين المسدّدين (أو الجميع مع force) عبر RPC portal_place_enrollment
 *  POST { action: 'status', session_id, status }               → موظف: live | ended | cancelled | scheduled
 *  POST { action: 'answer', activity_id, answer }               → مستخدم: إجابة نشاط ما بعد الجلسة ⇒ تصحيح + حدث assessed موسوم بالمهارة
 *  POST { action: 'recording', session_id }                     → أي زائر/مستخدم: رابط التسجيل (حسب RLS) + حدث viewed
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../lib/email/resend';
import { reminderEmail, registeredEmail, atharRoomUrl, scoreAnswer, validateAnswer } from '../../../lib/portal/live';
import type { LiveSession, Activity, ActivityAnswer } from '../../../lib/portal/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
const UUID = /^[0-9a-f-]{36}$/i;
async function mail(fn: () => Promise<any>): Promise<string | null> { try { await fn(); return null; } catch (e: any) { return String(e?.message || e); } }

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  if (!SERVICE) return { error: bad('مفتاح الخدمة غير مضبوط (SUPABASE_SERVICE_ROLE_KEY)', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const userDb = createClient(URL_, ANON, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined);
  let user: { id: string; email: string; name: string } | null = null; let staff = false;
  if (token) {
    const { data } = await userDb.auth.getUser(token);
    if (data?.user) {
      user = { id: data.user.id, email: String(data.user.email || ''), name: String(data.user.user_metadata?.full_name || '') };
      const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
      staff = WRITERS.includes(String((prof as any)?.role || '').toUpperCase()); if ((prof as any)?.full_name) user.name = String((prof as any).full_name);
    }
  }
  return { user, staff, db: createClient(URL_, SERVICE), userDb };
}
const joinOf = (s: LiveSession) => s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : (s.join_url || '');

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const { db, userDb, user, staff } = c; const site = siteUrl(req);
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');

  if (action === 'join') {
    const id = String(body.session_id || ''); if (!UUID.test(id)) return bad('معرّف غير صالح');
    const { data: s } = await userDb.from('portal_sessions').select('*').eq('id', id).maybeSingle(); // RLS تحدد الرؤية
    if (!s) return bad('الجلسة غير متاحة لك — سجّل الدخول أو تحقق من تسجيلك', 403);
    const url = joinOf(s as LiveSession); if (!url) return bad('لم يُضف رابط الانضمام بعد', 409);
    await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb: 'joined', object_type: 'session', object_id: id, skills: (s as any).skills || [], context: { program_id: (s as any).program_id, classroom_id: (s as any).classroom_id, provider: (s as any).provider } });
    return NextResponse.json({ success: true, url });
  }

  if (action === 'register') {
    if (!user) return bad('يرجى تسجيل الدخول أولاً', 401);
    const id = String(body.session_id || ''); if (!UUID.test(id)) return bad('معرّف غير صالح');
    const { data: s } = await db.from('portal_sessions').select('*').eq('id', id).maybeSingle();
    if (!s || !['public', 'registered'].includes((s as any).access) || (s as any).status === 'cancelled') return bad('التسجيل غير متاح لهذه الجلسة', 403);
    if ((s as any).capacity) { const { count } = await db.from('portal_session_registrations').select('id', { count: 'exact', head: true }).eq('session_id', id); if ((count || 0) >= (s as any).capacity) return bad('اكتمل العدد لهذه الجلسة', 409); }
    const full_name = String(body.full_name || user.name || '').trim(); if (full_name.length < 3) return bad('الاسم مطلوب');
    const { error } = await db.from('portal_session_registrations').upsert({ session_id: id, user_id: user.id, email: user.email.toLowerCase(), full_name, organization: String(body.organization || '').trim() || null }, { onConflict: 'session_id,email' });
    if (error) return bad(error.message, 500);
    await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'registered', object_type: 'session', object_id: id, skills: (s as any).skills || [], context: {} });
    const lang = (s as any).lang === 'en' ? 'en' : 'ar'; const m = registeredEmail(s as LiveSession, `${site}/live/${id}`, lang, full_name);
    const mail_error = await mail(() => sendViaResend({ to: [user.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'live_registered' }] }));
    return NextResponse.json({ success: true, mail_error });
  }

  if (action === 'recording') {
    const id = String(body.session_id || ''); if (!UUID.test(id)) return bad('معرّف غير صالح');
    const { data: s } = await userDb.from('portal_sessions').select('id,recording_url,skills,program_id').eq('id', id).maybeSingle();
    if (!s || !(s as any).recording_url) return bad('التسجيل غير متاح لك', 403);
    await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb: 'viewed', object_type: 'recording', object_id: id, skills: (s as any).skills || [], context: { program_id: (s as any).program_id } });
    return NextResponse.json({ success: true, url: (s as any).recording_url });
  }

  if (action === 'answer') {
    if (!user) return bad('يرجى تسجيل الدخول أولاً', 401);
    const aid = String(body.activity_id || ''); if (!UUID.test(aid)) return bad('معرّف النشاط غير صالح');
    const { data: a } = await userDb.from('portal_session_activities').select('*').eq('id', aid).maybeSingle(); // RLS: يرى النشاط من يرى الجلسة
    if (!a) return bad('النشاط غير متاح لك', 403);
    const act = a as Activity; const ans: ActivityAnswer = { choice: typeof body.answer?.choice === 'number' ? body.answer.choice : undefined, text: body.answer?.text ? String(body.answer.text).slice(0, 2000) : undefined, rating: body.answer?.rating !== undefined ? Number(body.answer.rating) : undefined };
    const v = validateAnswer(act, ans); if (v) return bad(v);
    const score = scoreAnswer(act, ans);
    const { error } = await db.from('portal_activity_responses').upsert({ activity_id: aid, session_id: act.session_id, user_id: user.id, email: user.email, answer: ans, score }, { onConflict: 'activity_id,user_id' });
    if (error) return bad(error.message, 500);
    await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'assessed', object_type: 'activity', object_id: aid, skills: act.skill_id ? [act.skill_id] : [], context: { session_id: act.session_id, kind: act.kind, score } });
    return NextResponse.json({ success: true, score, correct: act.kind === 'mcq' ? act.correct : null });
  }

  if (!staff) return bad('غير مصرّح', 403);

  if (action === 'status') {
    const id = String(body.session_id || ''); const status = String(body.status || '');
    if (!UUID.test(id) || !['scheduled', 'live', 'ended', 'cancelled'].includes(status)) return bad('بيانات غير صالحة');
    const { error } = await db.from('portal_sessions').update({ status, updated_at: new Date().toISOString() }).eq('id', id); if (error) return bad(error.message, 500);
    if (status === 'ended' || status === 'cancelled') { const { data: s } = await db.from('portal_sessions').select('attendance_session_id').eq('id', id).maybeSingle(); if ((s as any)?.attendance_session_id) await db.from('attendance_sessions').update({ status: 'closed' }).eq('id', (s as any).attendance_session_id); }
    return NextResponse.json({ success: true });
  }

  if (action === 'remind') {
    const id = String(body.session_id || ''); if (!UUID.test(id)) return bad('معرّف غير صالح');
    const { data: s } = await db.from('portal_sessions').select('*').eq('id', id).maybeSingle(); if (!s) return bad('الجلسة غير موجودة', 404);
    const ses = s as LiveSession; const to = new Map<string, string>();
    if (ses.classroom_id) { const { data } = await db.from('portal_enrollments').select('email,full_name').eq('classroom_id', ses.classroom_id).eq('status', 'approved'); for (const e of (data || []) as any[]) to.set(String(e.email).toLowerCase(), e.full_name || ''); }
    else if (ses.program_id) { const { data } = await db.from('portal_enrollments').select('email,full_name').eq('program_id', ses.program_id).eq('status', 'approved'); for (const e of (data || []) as any[]) to.set(String(e.email).toLowerCase(), e.full_name || ''); }
    const { data: regs } = await db.from('portal_session_registrations').select('email,full_name').eq('session_id', id); for (const r of (regs || []) as any[]) to.set(String(r.email).toLowerCase(), r.full_name || '');
    if (to.size === 0) return bad('لا يوجد مستلمون (لا متدربون مُسكَنون ولا مسجّلون)', 409);
    const lang = ses.lang === 'en' ? 'en' : 'ar'; const url = joinOf(ses) || `${site}/live/${id}`; let sent = 0; const errors: string[] = [];
    for (const [email, name] of to) { const m = reminderEmail(ses, url, `${site}/live/${id}`, lang, name); const e = await mail(() => sendViaResend({ to: [email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'live_reminder' }] })); if (e) errors.push(`${email}: ${e}`); else sent++; }
    await db.from('portal_sessions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ success: true, sent, total: to.size, mail_error: errors.length ? errors.slice(0, 3).join(' | ') : null });
  }

  if (action === 'place') {
    const pid = String(body.program_id || ''); if (!/^[\w-]{1,64}$/.test(pid)) return bad('معرّف البرنامج غير صالح');
    const force = !!body.force;
    const [{ data: ens }, { data: prog }] = await Promise.all([db.from('portal_enrollments').select('id,status,classroom_id').eq('program_id', pid).eq('status', 'approved').is('classroom_id', null), db.from('programs').select('fee').eq('id', pid).maybeSingle()]);
    const free = !(prog as any)?.fee || Number((prog as any).fee) <= 0; let eligible = (ens || []) as any[];
    if (!free && !force && eligible.length) { const { data: inv } = await db.from('portal_invoices').select('enrollment_id,status').in('enrollment_id', eligible.map(e => e.id)).in('status', ['paid', 'waived']); const ok = new Set(((inv || []) as any[]).map(i => i.enrollment_id)); eligible = eligible.filter(e => ok.has(e.id)); }
    let placed = 0; const rooms = new Set<string>();
    for (const e of eligible) { const { data: room, error } = await db.rpc('portal_place_enrollment', { p_enrollment: e.id }); if (!error && room) { placed++; rooms.add(String(room)); } }
    return NextResponse.json({ success: true, placed, pending: ((ens || []) as any[]).length - placed, rooms: rooms.size });
  }

  return bad('إجراء غير معروف');
}
