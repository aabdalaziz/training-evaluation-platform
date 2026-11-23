// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/kids — هـ-6-و «بَيْتُ بَيان» (البوّابة الأبوية لبرنامج بَيان)
 *  GET                         → بيتي: أطفالي · تقدّمهم · أماناتهم السارية · «قالَ لِلُؤلُؤ» · رسالة الأسبوع (محسوبة)
 *  GET ?child=<id>             → بذرة طفل واحد بالتفصيل
 *  POST child    {nick, gender, birth_year, avatar, id?}      → إضافة/تعديل
 *  POST consent  {child, kind, granted}                       → صفّ موافقة جديد (سجلّ إلحاقي)
 *  POST progress {child, session, stations, badge, self, selfVoice, talk, startedAt} → حدث نهاية جلسة (من جهاز الطفل بجلسة وليّ الأمر)
 *  POST task     {child, progress}                            → «تَمَّتْ ✓» مهمّة البيت
 *  POST delete   {child}                                      → حذف كلّ بيانات الطفل فعليًّا (cascade)
 *  لا صوت ولا صورة تُقبل هنا (hasMedia) · النصّ يُحفظ بإذن save_text فقط · كلّ شيء لوليّ الأمر المالك وحده.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LIMITS, CONSENT_KINDS, CONSENTS, consentExpiry, effectiveConsents, cleanNick, cleanBirthYear, cleanProgress, stageOf, luluLetter, weekStart, type ConsentKind, type ConsentRow } from '../../../lib/kids/parent';
import { getSession, SESSIONS } from '../../../lib/kids/sessions';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 20;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function who(req: Request): Promise<{ id: string } | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null;
  const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token);
  return data?.user ? { id: data.user.id } : null;
}
/** الطفل يخصّ هذا المستخدم؟ (403 وإلا) */
async function ownChild(db: any, uid: string, childId: unknown) {
  const id = String(childId || ''); if (!UUID.test(id)) return null;
  const { data } = await db.from('kids_children').select('id,parent_id,nick,gender,birth_year,avatar').eq('id', id).eq('parent_id', uid).is('archived_at', null).maybeSingle();
  return data || null;
}

function childView(c: any, progress: any[], consents: ConsentRow[], talks: any[]) {
  const mine = progress.filter(p => p.child_id === c.id);
  const finished = mine.filter(p => p.finished_at).length;
  const fruits = mine.filter(p => p.home_task_done_at).length;
  const eff = effectiveConsents(consents.filter(x => (x as any).child_id === c.id));
  const myTalks = talks.filter(t => t.child_id === c.id);
  const doneSlugs = new Set(mine.filter(p => p.finished_at).map(p => p.session_slug));
  const next = SESSIONS.find(s => !doneSlugs.has(s.slug)) || SESSIONS[0];
  return {
    id: c.id, nick: c.nick, gender: c.gender, birth_year: c.birth_year, avatar: c.avatar,
    stage: stageOf(finished), finished, fruits, consents: eff, next: { slug: next.slug, world: next.meta.world, order: next.meta.order },
    progress: mine.map(p => { const S = getSession(p.session_slug); return { id: p.id, session: p.session_slug, world: S?.meta.world || p.session_slug, started_at: p.started_at, finished_at: p.finished_at, stations: p.stations, badge: p.badge, self_check: p.self_check, self_voice: p.self_voice, home_task: S?.athari.homeTask || null, home_task_done_at: p.home_task_done_at }; }),
    talks: myTalks.map(t => ({ id: t.id, session: t.session_slug, at: t.at, results: eff.save_text ? t.results : (t.results || []).map((r: any) => ({ role: r.role, matched: r.matched, attempts: r.attempts })), self_voice: t.self_voice })),
  };
}
function letterFor(v: ReturnType<typeof childView>) {
  const since = Date.now() - 7 * 86400000;
  const sessions = v.progress.filter(p => Date.parse(p.started_at) >= since).map(p => { const S = getSession(p.session); const t1 = S?.talk?.turns[0]; return { world: p.world, badge: p.badge, self: p.self_check, homeTaskDone: !!p.home_task_done_at, homeTask: S?.athari.homeTask, supportQ: S?.athari.parentCard.support[0], weekSentence: t1?.model.text }; });
  const recent = v.talks.filter(t => Date.parse(t.at) >= since);
  const said = v.consents.save_text ? recent.flatMap(t => (t.results as any[]).map(r => r.heard).filter(Boolean)) : [];
  return { week_start: weekStart(), ...luluLetter({ nick: v.nick, gender: v.gender, sessions, said, talkCount: recent.length }) };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req); if (!me) return bad('سجّل الدخول', 401);
  const sp = new URL(req.url).searchParams;
  const { data: kids } = await db.from('kids_children').select('id,nick,gender,birth_year,avatar,created_at').eq('parent_id', me.id).is('archived_at', null).order('created_at');
  const ids = (kids || []).map((k: any) => k.id);
  if (!ids.length) return NextResponse.json({ success: true, children: [], consents_meta: CONSENTS, limits: LIMITS, sessions: SESSIONS.map(s => ({ slug: s.slug, world: s.meta.world, order: s.meta.order, letter: s.meta.letterName, value: s.meta.value })) });
  const [{ data: progress }, { data: consents }, { data: talks }] = await Promise.all([
    db.from('kids_progress').select('*').in('child_id', ids).order('started_at', { ascending: false }).limit(400),
    db.from('kids_consents').select('child_id,kind,granted,granted_at,expires_at,text_version').in('child_id', ids).order('granted_at').limit(2000),
    db.from('kids_talks').select('id,child_id,session_slug,at,results,self_voice').in('child_id', ids).gt('purge_after', new Date().toISOString()).order('at', { ascending: false }).limit(300),
  ]);
  let views = (kids || []).map((c: any) => childView(c, progress || [], (consents || []) as any, talks || []));
  const one = sp.get('child'); if (one) { views = views.filter(v => v.id === one); if (!views.length) return bad('الطفل غير موجود', 404); }
  return NextResponse.json({ success: true, children: views.map(v => ({ ...v, letter: letterFor(v) })), consents_meta: CONSENTS, limits: LIMITS, sessions: SESSIONS.map(s => ({ slug: s.slug, world: s.meta.world, order: s.meta.order, letter: s.meta.letterName, value: s.meta.value })) });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req); if (!me) return bad('سجّل الدخول', 401);
  let body: any = {}; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || '');

  if (action === 'child') {
    const nick = cleanNick(body.nick); if (!nick) return bad('اكتب اسمًا أوّل أو كنية (حتى 20 حرفًا، بلا أرقام)');
    const birth_year = cleanBirthYear(body.birth_year); if (!birth_year) return bad('سنة الميلاد غير صالحة');
    const gender = body.gender === 'f' ? 'f' : 'm'; const avatar = Math.min(8, Math.max(1, Number(body.avatar) || 1));
    if (body.id) { const c = await ownChild(db, me.id, body.id); if (!c) return bad('غير مصرّح', 403); const { error } = await db.from('kids_children').update({ nick, gender, birth_year, avatar }).eq('id', c.id); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, id: c.id }); }
    const { count } = await db.from('kids_children').select('id', { count: 'exact', head: true }).eq('parent_id', me.id).is('archived_at', null);
    if ((count || 0) >= LIMITS.children) return bad(`الحدّ ${LIMITS.children} أطفال`);
    const { data, error } = await db.from('kids_children').insert({ parent_id: me.id, nick, gender, birth_year, avatar }).select('id').single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, id: data.id });
  }

  const child = await ownChild(db, me.id, body.child); if (!child) return bad('غير مصرّح', 403);

  if (action === 'consent') {
    const kind = String(body.kind) as ConsentKind; if (!CONSENT_KINDS.includes(kind)) return bad('أمانة غير معروفة');
    const granted = !!body.granted; const def = CONSENTS.find(c => c.kind === kind)!;
    const { error } = await db.from('kids_consents').insert({ child_id: child.id, kind, granted, text_version: def.version, granted_by: me.id, expires_at: granted ? consentExpiry(kind) : null }); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }

  if (action === 'progress') {
    const { data: crows } = await db.from('kids_consents').select('kind,granted,granted_at,expires_at,text_version').eq('child_id', child.id).order('granted_at');
    const eff = effectiveConsents((crows || []) as ConsentRow[]);
    const r = cleanProgress(body, eff.save_text); if (!r.ok) return bad(r.error);
    if (!getSession(r.p.session)) return bad('جلسة غير معروفة');
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await db.from('kids_progress').select('id', { count: 'exact', head: true }).eq('child_id', child.id).gte('started_at', since);
    if ((count || 0) >= LIMITS.eventsPerDay) return bad('حدّ اليوم');
    const done = Object.values(r.p.stations).filter(Boolean).length >= 7;
    const row = { child_id: child.id, session_slug: r.p.session, started_at: r.p.startedAt || new Date().toISOString(), finished_at: done ? new Date().toISOString() : null, stations: r.p.stations, badge: done ? r.p.badge : null, self_check: r.p.self, self_voice: r.p.selfVoice };
    const { data: prog, error } = await db.from('kids_progress').upsert(row, { onConflict: 'child_id,session_slug,started_at' }).select('id').single(); if (error) return bad(error.message, 500);
    if (r.p.talk && r.p.talk.length) { const { error: e2 } = await db.from('kids_talks').insert({ child_id: child.id, session_slug: r.p.session, results: r.p.talk, self_voice: r.p.selfVoice }); if (e2) return bad(e2.message, 500); }
    return NextResponse.json({ success: true, id: prog.id, finished: done });
  }

  if (action === 'task') {
    const pid = String(body.progress || ''); if (!UUID.test(pid)) return bad('معرّف غير صالح');
    const { error } = await db.from('kids_progress').update({ home_task_done_at: new Date().toISOString() }).eq('id', pid).eq('child_id', child.id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    const { error } = await db.from('kids_children').delete().eq('id', child.id).eq('parent_id', me.id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }

  return bad('فعل غير معروف');
}
