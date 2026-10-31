// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/athir — «أثير» المدرب الرفيق (بوابة أَثَر · P10)
 *  POST { action:'hello', page? }                  → تحية مبادِرة من ذاكرة المتعلم وملفه المهاري (visits++، last_seen) — للزائر تحية عامة
 *  POST { action:'chat', text, history?[], page? } → حوار قصير يعرف الملف المهاري والأهداف والعروض الحيّة (ذكاء اصطناعي أو بديل محلي)، ويحدّث الذاكرة الموجزة كل بضع رسائل
 *  POST { action:'goal', text }                    → إضافة هدف (حد 5)؛ { action:'forget' } → مسح الذاكرة بالكامل (حق المتعلم)
 *  POST { action:'prefs', prefs:{voice?, name?} }  → تفضيلات (الصوت، اسم المناداة)
 *  الحوكمة: الذاكرة ملخص ≤ 400 حرف بلا بيانات حساسة، يراها المتعلم ويمسحها متى شاء؛ أثير يقترح ولا يقرّر؛ لا يُقيّم أحدًا نيابة عن مدرب.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, aiUsage, logAi } from '../../../lib/ai/athar';
import { buildAdvisorPrompt, parseAdvisor, localAdvisor, buildHelloPrompt, parseHello, localHello, buildMemoryPrompt, parseMemory, parseJsonLoose } from '../../../lib/ai/prompts';
import type { AdvisorAnswer, CompanionContext, CompanionHello } from '../../../lib/ai/prompts';
import { advisorFacts, timeOf } from '../../../lib/portal/home';
import { fmtDate } from '../../../lib/portal/content';
import type { Lang } from '../../../lib/portal/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const langOf = (v: unknown): Lang => (v === 'en' ? 'en' : 'ar');
const S = (v: unknown, n: number) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const riyadhDay = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
const riyadhHour = () => new Date(Date.now() + 3 * 3600000).getUTCHours();

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, user: null as null | { id: string; email: string; name: string } };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { db, user: null };
  const { data: prof } = await userDb.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') } };
}

type Memory = { user_id: string; summary: string; goals: string[]; prefs: { voice?: boolean; name?: string }; visits: number; last_seen_at: string | null };
async function loadMemory(db: any, uid: string): Promise<Memory> {
  const { data } = await db.from('portal_companion_memory').select('user_id,summary,goals,prefs,visits,last_seen_at').eq('user_id', uid).maybeSingle();
  return data ? { user_id: uid, summary: String((data as any).summary || ''), goals: Array.isArray((data as any).goals) ? (data as any).goals : [], prefs: (data as any).prefs || {}, visits: Number((data as any).visits) || 0, last_seen_at: (data as any).last_seen_at || null } : { user_id: uid, summary: '', goals: [], prefs: {}, visits: 0, last_seen_at: null };
}
async function saveMemory(db: any, m: Memory) { await db.from('portal_companion_memory').upsert({ user_id: m.user_id, summary: m.summary, goals: m.goals, prefs: m.prefs, visits: m.visits, last_seen_at: m.last_seen_at, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); }

/** حقائق المتعلم: مهارات (الأضعف/الأقوى + آخر ممارسة)، مهارة اليوم، الجلسة القادمة */
async function learnerFacts(db: any, user: { id: string; email: string; name: string }, mem: Memory, page: string): Promise<{ c: CompanionContext; skills: { name: string; level: number }[]; enrollments: string[] }> {
  const nowIso = new Date().toISOString();
  const [{ data: levels }, { data: skills }, { data: daily }, { data: regs }, { data: enr }] = await Promise.all([
    db.from('portal_skill_levels').select('skill_id,computed_level,approved_level,confidence,evidence').eq('user_id', user.id),
    db.from('portal_skills').select('id,name_ar,level'),
    db.from('portal_daily_answers').select('id').eq('user_id', user.id).eq('day', riyadhDay()).limit(1),
    db.from('portal_session_registrations').select('session_id').eq('user_id', user.id).limit(50),
    db.from('portal_enrollments').select('program_id,status').eq('email', user.email).limit(20),
  ]);
  const nameOf = new Map<string, string>(((skills || []) as any[]).map(s => [s.id, s.name_ar]));
  const rows = ((levels || []) as any[]).map(l => { const ev = Array.isArray(l.evidence) ? l.evidence : []; const last = ev.map((e: any) => String(e.at || '')).sort().pop() || null; return { name: nameOf.get(l.skill_id) || 'مهارة', level: Number(l.approved_level ?? Math.round(Number(l.computed_level) || 0)) || 1, days_since: last ? Math.floor((Date.now() - Date.parse(last)) / 86400000) : null }; });
  const weakest = [...rows].sort((a, b) => a.level - b.level || (b.days_since ?? 0) - (a.days_since ?? 0))[0] || null; const strongest = [...rows].sort((a, b) => b.level - a.level)[0] || null;
  let next: CompanionContext['next_session'] = null;
  const ids = ((regs || []) as any[]).map(r => r.session_id).filter(Boolean);
  if (ids.length) { const { data: ss } = await db.from('portal_sessions').select('id,title_ar,starts_at').in('id', ids).gte('starts_at', nowIso).order('starts_at').limit(1); const s = ((ss || []) as any[])[0]; if (s) next = { id: s.id, title: s.title_ar, when: `${fmtDate(s.starts_at, 'ar')} ${timeOf(s.starts_at, 'ar')}` }; }
  const c: CompanionContext = { name: mem.prefs.name || user.name || '', visits: mem.visits, last_seen_days: mem.last_seen_at ? Math.floor((Date.now() - Date.parse(mem.last_seen_at)) / 86400000) : null, goals: mem.goals, summary: mem.summary, weakest: weakest ? { name: weakest.name, level: weakest.level, days_since: weakest.days_since } : null, strongest: strongest ? { name: strongest.name, level: strongest.level } : null, daily_done: ((daily || []) as any[]).length > 0, next_session: next, page, hour: riyadhHour() };
  return { c, skills: rows.map(r => ({ name: r.name, level: r.level })), enrollments: ((enr || []) as any[]).map(e => String(e.program_id)) };
}
async function liveFacts(db: any, lang: Lang) {
  const nowIso = new Date().toISOString();
  let progRes = await db.from('programs').select('id,name_ar,name_en,start_date,end_date,registration_open,fee,delivery_mode,status,archived_at,is_public').eq('is_public', true).is('archived_at', null).order('start_date').limit(30);
  if (progRes.error) progRes = await db.from('programs').select('id,name_ar,name_en,start_date,end_date,delivery_mode,status,archived_at,is_public').is('archived_at', null).limit(30);
  const { data: sessions } = await db.from('portal_sessions').select('id,title_ar,title_en,starts_at,access,status').eq('access', 'public').neq('status', 'cancelled').gte('starts_at', nowIso).order('starts_at').limit(6);
  return advisorFacts((progRes.data || []) as any[], (sessions || []) as any[], 0, nowIso, lang);
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || 'hello'); const lang = langOf(body.lang); const page = S(body.page, 120) || '/';
  // P32 أَثَر للجميع: «لغة أبسط» — علم بلا هوية (لا يُرسل أي احتياج آخر)؛ يُضاف سطر أسلوب فقط
  const SIMPLE_HINT = body.simple === true ? '\nأسلوب إلزامي: جمل قصيرة جدًا (≤ 10 كلمات)، فكرة واحدة في كل جملة، كلمات شائعة، لا مصطلحات، وأقصى ثلاث جمل.' : '';

  // ---------- زائر: تحية عامة وحوار المستشار ----------
  if (!user) {
    if (action === 'hello') return NextResponse.json({ success: true, guest: true, hello: { greeting: 'أهلًا! أنا أثير — رفيقك في أَثَر.', nudge: 'اسألني عن البرامج والجلسات والشهادات، أو جرّب محاكاة أداء من ثلاث دقائق. سجّل الدخول لأتذكّر أهدافك وأتابع تقدّمك.', actions: [{ label: 'جرّب محاكاة', href: '/sim' }, { label: 'البرامج', href: '/programs' }] } as CompanionHello });
    if (action === 'chat') {
      const text = S(body.text, 600); if (text.length < 2) return bad('اكتب رسالتك');
      const facts = await liveFacts(db, lang); const p = buildAdvisorPrompt(text, facts, lang, 'companion');
      const res = await runAi<AdvisorAnswer>({ system: p.system + SIMPLE_HINT, user: p.user, parse: raw => parseAdvisor(parseJsonLoose(raw), facts), local: () => localAdvisor(text, facts), budgetMs: 18000 });
      return NextResponse.json({ success: true, guest: true, answer: res.data.answer_ar, links: res.data.links, handoff: res.data.handoff, source: res.source });
    }
    return bad('يرجى تسجيل الدخول أولاً', 401);
  }

  const mem = await loadMemory(db, user.id);
  if (action === 'forget') { await db.from('portal_companion_memory').delete().eq('user_id', user.id); return NextResponse.json({ success: true }); }
  if (action === 'prefs') { mem.prefs = { ...mem.prefs, ...(body.prefs && typeof body.prefs === 'object' ? { voice: body.prefs.voice === undefined ? mem.prefs.voice : !!body.prefs.voice, name: body.prefs.name === undefined ? mem.prefs.name : S(body.prefs.name, 40) } : {}) }; await saveMemory(db, mem); return NextResponse.json({ success: true, prefs: mem.prefs }); }
  if (action === 'goal') { const g = S(body.text, 140); if (g.length < 3) return bad('اكتب هدفك'); mem.goals = [g, ...mem.goals.filter(x => x !== g)].slice(0, 5); await saveMemory(db, mem); return NextResponse.json({ success: true, goals: mem.goals }); }

  if (action === 'hello') {
    const prevSeen = mem.last_seen_at; const sameDay = prevSeen && prevSeen.slice(0, 10) === new Date().toISOString().slice(0, 10);
    const lf = await learnerFacts(db, user, { ...mem, last_seen_at: prevSeen }, page);
    if (!sameDay) mem.visits += 1; mem.last_seen_at = new Date().toISOString(); await saveMemory(db, mem);
    let hello: CompanionHello; let source = 'local';
    if (lf.c.visits >= 1 && (lf.c.weakest || lf.c.goals.length)) {
      const q = await aiUsage(db, user.id, 'companion');
      if (q.allowed) { const p = buildHelloPrompt(lf.c); const res = await runAi<CompanionHello>({ system: p.system + SIMPLE_HINT, user: p.user, parse: raw => parseHello(parseJsonLoose(raw)), local: () => localHello(lf.c), budgetMs: 12000 }); hello = res.data; source = res.source; await logAi(db, { user_id: user.id, email: user.email, role: 'USER', purpose: 'companion', result: res, context: { action: 'hello' } }); }
      else hello = localHello(lf.c);
    } else hello = localHello(lf.c);
    return NextResponse.json({ success: true, hello, source, memory: { summary: mem.summary, goals: mem.goals, prefs: mem.prefs, visits: mem.visits }, facts: { weakest: lf.c.weakest, strongest: lf.c.strongest, daily_done: lf.c.daily_done, next_session: lf.c.next_session, skills: lf.skills.length } });
  }

  if (action === 'chat') {
    const text = S(body.text, 600); if (text.length < 2) return bad('اكتب رسالتك');
    const q = await aiUsage(db, user.id, 'companion'); if (!q.allowed) return bad(`بلغت حدّ الحوار اليومي مع أثير (${q.limit})`, 429);
    const history = (Array.isArray(body.history) ? body.history : []).slice(-8).map((h: any) => ({ role: h?.role === 'athir' ? 'أثير' : 'المتعلم', text: S(h?.text, 300) })).filter((h: any) => h.text);
    const [lf, facts] = await Promise.all([learnerFacts(db, user, mem, page), liveFacts(db, lang)]);
    facts.profile = { name: lf.c.name, skills: lf.skills.slice(0, 12), enrollments: lf.enrollments };
    const convo = `${mem.summary ? `ذاكرتي عن المتعلم: ${mem.summary}\n` : ''}${mem.goals.length ? `أهدافه: ${mem.goals.join(' | ')}\n` : ''}${history.length ? `آخر الحوار:\n${history.map((h: any) => `${h.role}: ${h.text}`).join('\n')}\n` : ''}رسالته الآن: ${text}`;
    const p = buildAdvisorPrompt(convo, facts, lang, 'companion');
    const res = await runAi<AdvisorAnswer>({ system: p.system + SIMPLE_HINT, user: p.user, parse: raw => parseAdvisor(parseJsonLoose(raw), facts), local: () => localAdvisor(text, facts), budgetMs: 18000 });
    await logAi(db, { user_id: user.id, email: user.email, role: 'USER', purpose: 'companion', result: res, context: { action: 'chat' } });
    // تحديث الذاكرة كل 4 رسائل (أو عند ذكر هدف صريح)
    const wantsGoal = /هدفي|أريد أن|أبغى|أطمح|خطتي/.test(text);
    if (res.source === 'ai' && (history.length >= 4 || wantsGoal)) { const mp = buildMemoryPrompt(mem.summary, [...history, { role: 'المتعلم', text }, { role: 'أثير', text: res.data.answer_ar }]); const m = await runAi<string>({ system: mp.system, user: mp.user, parse: raw => parseMemory(parseJsonLoose(raw)), local: () => mem.summary, budgetMs: 10000 }); if (m.source === 'ai' && m.data) { mem.summary = m.data; await saveMemory(db, mem); } }
    else if (wantsGoal && !mem.goals.includes(text)) { mem.goals = [text.slice(0, 140), ...mem.goals].slice(0, 5); await saveMemory(db, mem); }
    return NextResponse.json({ success: true, answer: res.data.answer_ar, links: res.data.links, handoff: res.data.handoff, source: res.source, goals: mem.goals });
  }
  return bad('إجراء غير معروف');
}
