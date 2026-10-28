// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/copilot — «الميسِّر الحي» للجلسات المباشرة (أَثَر · P13-ب)
 *  يصل إليه: موظفو البوابة، أو مدرب الجلسة (trainers.email = بريد المستخدم و portal_sessions.trainer_id = trainers.id)، أو من أنشأ الجلسة.
 *  GET  ?id=<session>                                   → { session, pulse, suggestions, notes, log, memo, skills }
 *  POST { action:'accept',  session_id, suggestion }    → تنفيذ مقترح: إنشاء نشاط (activity) أو تذكير الغائبين (remind) — بضغطة واحدة، والقرار للمدرب
 *  POST { action:'dismiss', session_id, code }          → تجاهل مقترح (لا يعود في هذه الجلسة)
 *  POST { action:'note',    session_id, text }          → ملاحظة لحظية («لحظة مهمة») تدخل المحضر
 *  POST { action:'memo',    session_id }                → توليد «محضر الأثر» (محلي + تحسين بالذكاء الاصطناعي) كمسودة
 *  POST { action:'approve', session_id, edits? }        → اعتماد المحضر (مع تعديلات بشرية اختيارية) → يراه المشاركون في صفحة الجلسة
 *  المبدأ: الآلة تقترح وتكتب المسودة؛ الإنسان ينفّذ ويعتمد.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi } from '../../../lib/ai/athar';
import { sendViaResend } from '../../../lib/email/resend';
import { reminderEmail, atharRoomUrl } from '../../../lib/portal/live';
import type { LiveSession } from '../../../lib/portal/live';
import { computePulse, suggest, buildLocalMemo, buildMemoPrompt, parseMemo } from '../../../lib/portal/copilot';
import type { Suggestion, SessionMemo, Note, SkillRef } from '../../../lib/portal/copilot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const email = String(data.user.email || '').toLowerCase();
  const user = { id: data.user.id, email, name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
  return { db, user };
}
/** يحمّل الجلسة ويتحقق من الصلاحية */
async function loadSession(db: any, user: { id: string; email: string; staff: boolean }, id: string): Promise<{ s: LiveSession } | { error: NextResponse }> {
  if (!UUID.test(id)) return { error: bad('معرّف غير صالح') };
  const { data: s } = await db.from('portal_sessions').select('*').eq('id', id).maybeSingle(); if (!s) return { error: bad('الجلسة غير موجودة', 404) };
  if (user.staff || (s as any).created_by === user.id) return { s: s as LiveSession };
  const { data: tr } = await db.from('trainers').select('id').ilike('email', user.email);
  const mine = ((tr || []) as any[]).some(t => t.id === (s as any).trainer_id);
  if (!mine) return { error: bad('هذه الجلسة ليست من جلساتك', 403) };
  return { s: s as LiveSession };
}
async function snapshot(db: any, s: LiveSession) {
  const [{ count: registered }, { data: joined }, { data: acts }, { data: resp }, { data: logRows }, { data: memoRow }] = await Promise.all([
    db.from('portal_session_registrations').select('id', { count: 'exact', head: true }).eq('session_id', s.id),
    db.from('portal_learning_events').select('user_id,email,created_at').eq('verb', 'joined').eq('object_type', 'session').eq('object_id', s.id).limit(2000),
    db.from('portal_session_activities').select('id,kind,prompt_ar,created_at,active,skill_id').eq('session_id', s.id).order('sort'),
    db.from('portal_activity_responses').select('activity_id,created_at,score,answer').eq('session_id', s.id).limit(5000),
    db.from('portal_copilot_log').select('id,created_at,kind,code,payload').eq('session_id', s.id).order('created_at', { ascending: false }).limit(60),
    db.from('portal_session_memos').select('*').eq('session_id', s.id).maybeSingle(),
  ]);
  const log = ((logRows || []) as any[]);
  // جمهور الجلسة: المسجّلون، وإن كانت جلسة شعبة/برنامج فالمتدربون المقبولون
  let audience = registered || 0;
  if (s.classroom_id) { const { count } = await db.from('portal_enrollments').select('id', { count: 'exact', head: true }).eq('classroom_id', s.classroom_id).eq('status', 'approved'); audience = Math.max(audience, count || 0); }
  else if (s.program_id) { const { count } = await db.from('portal_enrollments').select('id', { count: 'exact', head: true }).eq('program_id', s.program_id).eq('status', 'approved'); audience = Math.max(audience, count || 0); }
  const start = new Date(s.starts_at).getTime();
  const notes: Note[] = log.filter(l => l.kind === 'note').map(l => ({ at: l.created_at, text: String(l.payload?.text || ''), min: Math.max(0, Math.round((new Date(l.created_at).getTime() - start) / 60000)) })).reverse();
  const accepted = log.filter(l => l.kind === 'accepted').map(l => String(l.code)); const dismissed = log.filter(l => l.kind === 'dismissed').map(l => String(l.code));
  let skills: SkillRef[] = [];
  if (Array.isArray(s.skills) && s.skills.length) { const { data: sk } = await db.from('portal_skills').select('id,name_ar,domain_code').in('id', s.skills); skills = ((sk || []) as any[]).map(k => ({ id: k.id, name_ar: k.name_ar, domain_code: k.domain_code || null })); }
  const pulse = computePulse({ session: { id: s.id, status: s.status, starts_at: s.starts_at, duration_min: s.duration_min }, registered: audience, joinedEvents: (joined || []) as any[], activities: (acts || []) as any[], responses: (resp || []) as any[], notes: notes.length });
  return { pulse, notes, accepted, dismissed, skills, acts: (acts || []) as any[], resp: (resp || []) as any[], log: log.slice(0, 30), memo: memoRow || null };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const id = new URL(req.url).searchParams.get('id') || ''; const L = await loadSession(db, user, id); if ('error' in L) return L.error; const s = L.s;
  const snap = await snapshot(db, s);
  const suggestions = suggest(snap.pulse, { title_ar: s.title_ar, skills: snap.skills, accepted: snap.accepted, dismissed: snap.dismissed });
  // نبضة مسجّلة كل 5 دقائق أثناء البث (لتاريخ الجلسة)
  const lastPulse = snap.log.find(l => l.kind === 'pulse');
  if (s.status === 'live' && (!lastPulse || Date.now() - new Date(lastPulse.created_at).getTime() > 5 * 60000)) await db.from('portal_copilot_log').insert({ session_id: s.id, user_id: user.id, kind: 'pulse', code: null, payload: { joined: snap.pulse.joined, registered: snap.pulse.registered, responses: snap.pulse.responses_total, elapsed: snap.pulse.elapsed_min } });
  return NextResponse.json({ success: true, session: { id: s.id, title_ar: s.title_ar, title_en: s.title_en || null, status: s.status, starts_at: s.starts_at, duration_min: s.duration_min, provider: s.provider, join_url: s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : (s.join_url || null) }, pulse: snap.pulse, suggestions, notes: snap.notes, log: snap.log, memo: snap.memo, skills: snap.skills, activities: snap.acts.map(a => ({ id: a.id, kind: a.kind, prompt_ar: a.prompt_ar, active: a.active, answered: snap.resp.filter(r => r.activity_id === a.id).length })) });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || ''); const id = String(body.session_id || '');
  const L = await loadSession(db, user, id); if ('error' in L) return L.error; const s = L.s;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
  const log = (kind: string, code: string | null, payload: any) => db.from('portal_copilot_log').insert({ session_id: s.id, user_id: user.id, kind, code, payload });

  if (action === 'accept') {
    const sg = body.suggestion as Suggestion; if (!sg || !sg.code) return bad('مقترح غير صالح');
    if (sg.kind === 'activity' && sg.activity) {
      const a = sg.activity; const kind = ['mcq', 'reflection', 'self_rating'].includes(a.kind) ? a.kind : 'reflection';
      const prompt = String(body.prompt_ar || a.prompt_ar || '').trim().slice(0, 1200); if (prompt.length < 8) return bad('نص النشاط قصير');
      const { count } = await db.from('portal_session_activities').select('id', { count: 'exact', head: true }).eq('session_id', s.id);
      const options = kind === 'mcq' ? (Array.isArray(a.options) ? a.options.map(String).slice(0, 6) : []) : kind === 'self_rating' ? ['1', '2', '3', '4', '5'] : [];
      const { data: ins, error } = await db.from('portal_session_activities').insert({ session_id: s.id, kind, prompt_ar: prompt, options, correct: kind === 'mcq' && Number.isInteger(a.correct) ? a.correct : null, skill_id: a.skill_id && UUID.test(String(a.skill_id)) ? a.skill_id : null, sort: (count || 0) + 1, active: true }).select('id').maybeSingle();
      if (error) return bad('تعذّر إنشاء النشاط: ' + error.message, 500);
      await log('accepted', sg.code, { kind: 'activity', activity_id: (ins as any)?.id || null, prompt });
      return NextResponse.json({ success: true, created: 'activity', id: (ins as any)?.id || null });
    }
    if (sg.kind === 'remind') {
      const { data: regs } = await db.from('portal_session_registrations').select('email,full_name,user_id').eq('session_id', s.id);
      const { data: joined } = await db.from('portal_learning_events').select('user_id,email').eq('verb', 'joined').eq('object_type', 'session').eq('object_id', s.id);
      const j = new Set(((joined || []) as any[]).flatMap(x => [x.user_id, String(x.email || '').toLowerCase()].filter(Boolean)));
      const absent = ((regs || []) as any[]).filter(r => !j.has(r.user_id) && !j.has(String(r.email).toLowerCase())).slice(0, 80);
      const url = s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : (s.join_url || `${site}/live/${s.id}`); const lang = s.lang === 'en' ? 'en' : 'ar'; let sent = 0; const errors: string[] = [];
      for (const r of absent) { const m = reminderEmail(s, url, `${site}/live/${s.id}`, lang, r.full_name); try { await sendViaResend({ to: [r.email], subject: (lang === 'ar' ? 'بدأت الآن — ' : 'Live now — ') + m.subject, html: m.html, tags: [{ name: 'kind', value: 'copilot_remind' }] }); sent++; } catch (e: any) { errors.push(String(e?.message || e)); } }
      await log('accepted', sg.code, { kind: 'remind', absent: absent.length, sent, errors: errors.slice(0, 3) });
      return NextResponse.json({ success: true, created: 'remind', absent: absent.length, sent, errors: errors.slice(0, 3) });
    }
    await log('accepted', sg.code, { kind: sg.kind });
    return NextResponse.json({ success: true, created: sg.kind });
  }
  if (action === 'dismiss') { const code = String(body.code || '').slice(0, 40); if (!code) return bad('code مطلوب'); await log('dismissed', code, {}); return NextResponse.json({ success: true }); }
  if (action === 'note') { const text = String(body.text || '').trim().slice(0, 400); if (text.length < 3) return bad('اكتب الملاحظة'); await log('note', null, { text }); return NextResponse.json({ success: true }); }
  if (action === 'memo') {
    const snap = await snapshot(db, s);
    const local = buildLocalMemo({ session: { title_ar: s.title_ar, starts_at: s.starts_at, duration_min: s.duration_min, skills: s.skills }, pulse: snap.pulse, activities: snap.acts, responses: snap.resp, notes: snap.notes, skills: snap.skills, accepted: snap.accepted });
    const refl = snap.resp.filter(r => snap.acts.some(a => a.id === r.activity_id && a.kind === 'reflection')).map(r => String(r.answer?.text || r.answer?.value || '')).filter(t => t.length > 20);
    const p = buildMemoPrompt(local, refl);
    const res = await runAi<SessionMemo>({ system: p.system, user: p.user, parse: raw => parseMemo(raw, local), local: () => local, budgetMs: 25000 });
    const memo: SessionMemo = { ...res.data, model: res.model };
    await logAi(db, { user_id: user.id, email: user.email, role: user.staff ? 'staff' : 'trainer', purpose: 'copilot_memo', result: res, context: { session_id: s.id } });
    const { error } = await db.from('portal_session_memos').upsert({ session_id: s.id, memo, status: 'draft', source: memo.source, model: memo.model || null, generated_by: user.id, approved_by: null, approved_at: null, updated_at: new Date().toISOString() }, { onConflict: 'session_id' });
    if (error) return bad('تعذّر حفظ المحضر: ' + error.message, 500);
    await log('memo', null, { source: memo.source });
    return NextResponse.json({ success: true, memo, status: 'draft' });
  }
  if (action === 'approve') {
    const { data: row } = await db.from('portal_session_memos').select('*').eq('session_id', s.id).maybeSingle(); if (!row) return bad('أنشئ المحضر أولًا');
    const m = { ...((row as any).memo as SessionMemo) }; const e = body.edits || {}; let human = false;
    const S = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
    if (typeof e.summary_ar === 'string' && S(e.summary_ar, 1500).length >= 40) { m.summary_ar = S(e.summary_ar, 1500); human = true; }
    if (typeof e.trainer_note_ar === 'string' && S(e.trainer_note_ar, 600)) { m.trainer_note_ar = S(e.trainer_note_ar, 600); human = true; }
    if (Array.isArray(e.next_ar) && e.next_ar.length) { m.next_ar = e.next_ar.map((x: unknown) => S(x, 240)).filter(Boolean).slice(0, 4); human = true; }
    if (human) m.source = 'human';
    const { error } = await db.from('portal_session_memos').update({ memo: m, status: 'approved', source: m.source, approved_by: user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('session_id', s.id);
    if (error) return bad('تعذّر الاعتماد: ' + error.message, 500);
    await log('approved', null, { human });
    return NextResponse.json({ success: true, memo: m, status: 'approved' });
  }
  return bad('إجراء غير معروف');
}
