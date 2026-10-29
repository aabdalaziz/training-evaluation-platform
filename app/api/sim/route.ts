// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/sim — محاكيات الأداء (بوابة أَثَر · P10)
 *  GET                                   → السيناريوهات المنشورة (عام)
 *  GET ?run=<id>                         → تشغيلة واحدة (صاحبها أو موظف)
 *  GET ?mine=1                           → تشغيلات المستخدم
 *  GET ?admin=1&status=scored            → موظف: التشغيلات بانتظار الاعتماد (+ أسئلة المستشار الأخيرة)
 *  POST { action:'start', scenario }     → بدء تشغيلة (زائر: سيناريو demo بلا حفظ؛ مستخدم: تُحفظ)
 *  POST { action:'turn', run_id|turns, scenario, text } → دور المتعلم → ردّ الشخصية (ذكاء اصطناعي أو بديل محلي)؛ عند بلوغ الحد تُقيَّم تلقائيًا
 *  POST { action:'finish', run_id|turns, scenario }     → إنهاء مبكر وتقييم
 *  POST { action:'approve', run_id, decision:'approved'|'rejected', note? } → موظف: اعتماد الدليل (يُحدَّث سياق حدث التعلّم)
 *  الحوكمة: الذكاء الاصطناعي يمثّل الشخصية ويقترح الدرجة؛ الدليل لا يصبح معتمدًا إلا بقرار بشري. للزوار حدّ 40 دورًا/ساعة لكل IP.
 */
import { NextResponse } from 'next/server';
import { limitFor, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { createClient } from '@supabase/supabase-js';
import { runAi, aiUsage, logAi } from '../../../lib/ai/athar';
import { buildSimTurnPrompt, parseSimTurn, buildSimScorePrompt, parseJsonLoose } from '../../../lib/ai/prompts';
import { DEMO_SCENARIO, cleanUtterance, learnerTurns, localPersonaReply, localScore, sanitizeScore, simEvidenceEvent } from '../../../lib/portal/sim';
import type { Scenario, Turn, SimScore } from '../../../lib/portal/sim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const SCEN_COLS = 'id,slug,title_ar,title_en,situation_ar,goal_ar,persona,skills,rubric,max_turns,minutes,level,audience,status,demo';

// حدّ بسيط للزوار (في الذاكرة لكل نسخة خادم)

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, user: null as null | { id: string; email: string; name: string }, role: '', staff: false };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { db, user: null, role: '', staff: false };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, role, staff: STAFF.includes(role) };
}
const norm = (r: any): Scenario => ({ ...r, persona: r.persona || {}, skills: r.skills || [], rubric: r.rubric || [], max_turns: Number(r.max_turns) || 6, minutes: Number(r.minutes) || 5, demo: !!r.demo });
async function loadScenario(db: any, key: string): Promise<Scenario | null> {
  if (!key) return null; if (key === 'demo') return DEMO_SCENARIO;
  const isUuid = /^[0-9a-f-]{36}$/i.test(key);
  const { data } = await db.from('portal_scenarios').select(SCEN_COLS).eq(isUuid ? 'id' : 'slug', key).maybeSingle();
  if (data) return norm(data); return key === DEMO_SCENARIO.slug ? DEMO_SCENARIO : null;
}
const now = () => new Date().toISOString();

async function personaReply(db: any, s: Scenario, turns: Turn[], user: { id: string; email: string } | null, role: string) {
  const p = buildSimTurnPrompt(s, turns, 'ar');
  const res = await runAi<string>({ system: p.system, user: p.user, parse: raw => parseSimTurn(raw), local: () => localPersonaReply(s, turns), budgetMs: 15000 });
  if (user) await logAi(db, { user_id: user.id, email: user.email, role, purpose: 'sim_turn', result: res, context: { scenario: s.slug } });
  return res;
}
async function scoreRun(db: any, s: Scenario, turns: Turn[], user: { id: string; email: string } | null, role: string) {
  const p = buildSimScorePrompt(s, turns, 'ar');
  const res = await runAi<SimScore>({ system: p.system, user: p.user, parse: raw => sanitizeScore(parseJsonLoose(raw), s), local: () => localScore(s, turns), budgetMs: 20000 });
  if (user) await logAi(db, { user_id: user.id, email: user.email, role, purpose: 'sim_score', result: res, context: { scenario: s.slug, total: res.data.total } });
  return res;
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, staff } = c; const u = new URL(req.url);
  const runId = u.searchParams.get('run');
  if (runId) {
    if (!user) return bad('يرجى تسجيل الدخول أولاً', 401);
    const { data: run } = await db.from('portal_sim_runs').select('*').eq('id', runId).maybeSingle(); if (!run) return bad('التشغيلة غير موجودة', 404);
    if ((run as any).user_id !== user.id && !staff) return bad('غير مصرح', 403);
    const s = await loadScenario(db, (run as any).scenario_id); return NextResponse.json({ success: true, run, scenario: s });
  }
  if (u.searchParams.get('mine')) {
    if (!user) return bad('يرجى تسجيل الدخول أولاً', 401);
    const { data } = await db.from('portal_sim_runs').select('id,created_at,scenario_id,status,score,ended_at,turns').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    const { data: sc } = await db.from('portal_scenarios').select('id,slug,title_ar,title_en,skills');
    return NextResponse.json({ success: true, runs: data || [], scenarios: sc || [] });
  }
  if (u.searchParams.get('admin')) {
    if (!staff) return bad('غير مصرح', 403); const status = u.searchParams.get('status') || 'scored';
    const [{ data: runs }, { data: sc }, { data: qs }] = await Promise.all([
      db.from('portal_sim_runs').select('*').eq('status', status).order('created_at', { ascending: false }).limit(100),
      db.from('portal_scenarios').select(SCEN_COLS).order('created_at'),
      db.from('portal_advisor_questions').select('id,created_at,name,email,question,answer,source,handoff,page').order('created_at', { ascending: false }).limit(100),
    ]);
    return NextResponse.json({ success: true, runs: runs || [], scenarios: (sc || []).map(norm), questions: qs || [] });
  }
  const { data } = await db.from('portal_scenarios').select(SCEN_COLS).eq('status', 'published').order('created_at');
  const list = (data || []).map(norm); if (!list.length) list.push(DEMO_SCENARIO);
  return NextResponse.json({ success: true, scenarios: list });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, role, staff } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');

  if (action === 'approve') {
    if (!staff) return bad('غير مصرح', 403); const decision = body.decision === 'rejected' ? 'rejected' : 'approved'; const runId = String(body.run_id || '');
    const { data: run } = await db.from('portal_sim_runs').select('id,user_id,email,scenario_id,score,status').eq('id', runId).maybeSingle(); if (!run) return bad('التشغيلة غير موجودة', 404);
    const { error } = await db.from('portal_sim_runs').update({ status: decision, approved_by: user!.id, approved_at: now(), note: String(body.note || '').slice(0, 400) || null }).eq('id', runId); if (error) return bad(error.message);
    const s = await loadScenario(db, (run as any).scenario_id);
    if (s) { const ev = simEvidenceEvent(run as any, s, decision === 'approved'); await db.from('portal_learning_events').update({ context: { ...ev.context, approved: decision === 'approved', rejected: decision === 'rejected' } }).eq('object_type', 'simulation').eq('object_id', runId); }
    return NextResponse.json({ success: true, status: decision });
  }

  const s = await loadScenario(db, String(body.scenario || body.scenario_id || body.slug || '')); if (!s) return bad('السيناريو غير موجود', 404);
  const anonDemo = !user; if (anonDemo && !s.demo) return bad('هذا السيناريو يتطلب تسجيل الدخول — جرّب سيناريو العرض أولًا', 401);
  if (anonDemo) { const rl = await limitFor(db, 'sim_anon_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl, 'بلغت حدّ التجربة للزوار هذه الساعة — سجّل الدخول لمتابعة التدريب'); }

  if (action === 'start') {
    const turns: Turn[] = [{ role: 'persona', text: s.persona.opening_ar, at: now() }];
    if (anonDemo) return NextResponse.json({ success: true, run: { id: 'demo', scenario_id: s.id, turns, status: 'running' }, scenario: s, stateless: true });
    const id = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const { error } = await db.from('portal_sim_runs').insert({ id, user_id: user!.id, email: user!.email, scenario_id: s.id === 'demo' ? null : s.id, turns, status: 'running' }); if (error) return bad(error.message);
    return NextResponse.json({ success: true, run: { id, scenario_id: s.id, turns, status: 'running' }, scenario: s });
  }

  // تحميل التشغيلة (محفوظة) أو الأدوار (عرض بلا حفظ)
  let run: any = null; let turns: Turn[] = [];
  if (!anonDemo && body.run_id && body.run_id !== 'demo') {
    const { data } = await db.from('portal_sim_runs').select('*').eq('id', String(body.run_id)).maybeSingle(); if (!data) return bad('التشغيلة غير موجودة', 404);
    if ((data as any).user_id !== user!.id) return bad('غير مصرح', 403); if ((data as any).status !== 'running') return bad('هذه التشغيلة انتهت');
    run = data; turns = Array.isArray((data as any).turns) ? (data as any).turns : [];
  } else {
    turns = (Array.isArray(body.turns) ? body.turns : []).filter((t: any) => t && (t.role === 'persona' || t.role === 'learner')).map((t: any) => ({ role: t.role, text: cleanUtterance(t.text), at: String(t.at || now()) })).slice(0, 40);
    if (!turns.length) turns = [{ role: 'persona', text: s.persona.opening_ar, at: now() }];
  }

  if (action === 'turn') {
    const text = cleanUtterance(body.text); if (text.length < 2) return bad('اكتب ردّك أولًا');
    if (learnerTurns(turns) >= s.max_turns) return bad('انتهت أدوار هذه المحاكاة');
    if (user) { const q = await aiUsage(db, user.id, 'sim_turn'); if (!q.allowed) return bad(`بلغت حدّ الاستخدام اليومي (${q.limit})`, 429); }
    turns = [...turns, { role: 'learner', text, at: now() }];
    const r = await personaReply(db, s, turns, user, role); turns = [...turns, { role: 'persona', text: r.data, at: now() }];
    const finished = learnerTurns(turns) >= s.max_turns; let score: SimScore | null = null; let scoreSource: string | null = null; let model: string | null = r.model;
    if (finished) { const sc = await scoreRun(db, s, turns, user, role); score = sc.data; scoreSource = sc.source; model = sc.model || model; }
    if (run) {
      const patch: any = { turns, model }; if (finished) { patch.status = 'scored'; patch.score = score; patch.source = scoreSource; patch.ended_at = now(); }
      await db.from('portal_sim_runs').update(patch).eq('id', run.id);
      if (finished && s.id !== 'demo') await db.from('portal_learning_events').insert(simEvidenceEvent({ id: run.id, user_id: user!.id, email: user!.email, score }, s, false));
    }
    return NextResponse.json({ success: true, reply: r.data, source: r.source, turns, finished, score, score_source: scoreSource, run_id: run?.id || 'demo', status: finished ? 'scored' : 'running' });
  }

  if (action === 'finish') {
    if (learnerTurns(turns) < 1) return bad('لم يبدأ الحوار بعد');
    const sc = await scoreRun(db, s, turns, user, role);
    if (run) { await db.from('portal_sim_runs').update({ status: 'scored', score: sc.data, source: sc.source, model: sc.model, ended_at: now() }).eq('id', run.id); if (s.id !== 'demo') await db.from('portal_learning_events').insert(simEvidenceEvent({ id: run.id, user_id: user!.id, email: user!.email, score: sc.data }, s, false)); }
    return NextResponse.json({ success: true, turns, finished: true, score: sc.data, score_source: sc.source, run_id: run?.id || 'demo', status: 'scored' });
  }
  return bad('إجراء غير معروف');
}
