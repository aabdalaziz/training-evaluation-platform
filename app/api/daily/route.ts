// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/daily — «موقف اليوم» (كل يوم بناء · P13-أ) — يحلّ محل «كل يوم مهارة» (سؤال واختيار) بموقف/قضية/حالة وردّ حرّ ومرآة أداء
 *  GET                       → موقف اليوم {day, case, event, participants} (+ {mine: {response, evaluation}, streak, total} إن كان Bearer صالحًا)
 *  POST { response }         → تقويم الردّ: «مرآة الأداء» (وصف الأداء، ما ظهر من الجدارات، ما لم يره، الاحتياجات، خطوة اليوم)
 *                              للمستخدم تُحفظ مرة واحدة يوميًا وتُودَع شاهدًا في portal_learning_events (object_type=daily_case)؛ للزائر تُعاد المرآة فقط
 *  الموقف يُختار من المناسبة الفاعلة (اليوم/الشهر) ثم المجال الدوري من المجالات الاثني عشر؛ يُكتب مرة واحدة يوميًا (ذكاء اصطناعي أو البنك المحلي) ويُخزَّن في portal_daily_cases.
 *  P13-ب: POST { action: 'whatif' } → أثير يضيف معلومة جديدة ويطلب القرار ثانية؛ POST { action: 'whatif', response } → تقويم الجولة الثانية (ثبات/مراجعة، مرونة)
 *          GET يعيد أيضًا crowd: مقارنة مجهولة «كيف تصرّف N شخصًا آخر اليوم» (توزيع المستويات، المعيار الأكثر غيابًا)
 *  التقويم: تغطية معايير محلية شفافة + تحسين بالذكاء الاصطناعي حين يتوفر — والنص لا يحكم على الشخص بل على تصرّفه في هذا الموقف.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi } from '../../../lib/ai/athar';
import { eventsFor, upcomingEvents, EVENTS, FAMILIES } from '../../../lib/portal/lexicon';
import type { CalendarEvent } from '../../../lib/portal/lexicon';
import { delegateFromHeaders } from '../../../lib/portal/oauth';
import { CASE_BANK, pickSeed, seedToCase, buildCasePrompt, parseCase, localEvaluate, buildEvalPrompt, parseEval, streakOf, eventLine, MIN_RESPONSE_CHARS, MAX_RESPONSE_CHARS, DOMAIN_OF_DAY, dayIndexOf, whatIfFor, buildWhatIfPrompt, parseWhatIf, evaluateRound2, crowdOf, crowdLine } from '../../../lib/portal/daily-case';
import type { DailyCase, CaseEvaluation, WhatIf, Round2, RubricItem } from '../../../lib/portal/daily-case';
import { echoForDay } from '../../../lib/onair/load';   // P34 «صدى السؤال»

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
/** يوم أَثَر بتوقيت الرياض (UTC+3) */
function riyadhDay(d = new Date()): string { return new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10); }

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const dg = delegateFromHeaders(req.headers, process.env); if (dg && dg.scopes.includes('daily:write')) return { db, user: { id: dg.id, email: dg.email } as null | { id: string; email: string } }; // P20: وكيل مفوَّض شخصيًا
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, user: null as null | { id: string; email: string } };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { db, user: null };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() } };
}

/** التقويم المدمج + مناسبات الإدارة */
async function calendar(db: any): Promise<CalendarEvent[]> {
  try {
    const { data } = await db.from('portal_calendar_events').select('code,name_ar,name_en,month,day,kind,domains,theme_ar').eq('active', true);
    const extra: CalendarEvent[] = ((data || []) as any[]).map(r => ({ code: String(r.code), name: { ar: String(r.name_ar), en: String(r.name_en || r.name_ar) }, month: Number(r.month), day: r.day === null || r.day === undefined ? null : Number(r.day), kind: (['national', 'international', 'month'].includes(r.kind) ? r.kind : 'international') as CalendarEvent['kind'], domains: Array.isArray(r.domains) ? r.domains : [], theme: { ar: String(r.theme_ar || ''), en: String(r.theme_ar || '') } }));
    return [...extra, ...EVENTS];
  } catch { return EVENTS; }
}
function rowToCase(r: any): DailyCase {
  return { id: r.id, day: String(r.day).slice(0, 10), slug: r.slug, title_ar: r.title_ar, scene_ar: r.scene_ar || '', role_ar: r.role_ar || '', situation_ar: r.situation_ar, twist_ar: r.twist_ar || '', ask_ar: r.ask_ar || '', parties_ar: Array.isArray(r.parties_ar) ? r.parties_ar : [], domain_code: r.domain_code, family: r.family || 'judgment_accountability', horizon: (r.horizon || 2035) as any, skill_codes: Array.isArray(r.skill_codes) ? r.skill_codes : [], skill_ids: Array.isArray(r.skill_ids) ? r.skill_ids : [], event_code: r.event_code || null, event_name_ar: r.event_name_ar || null, rubric: Array.isArray(r.rubric) ? r.rubric : [], source: r.source || 'local', model: r.model || null };
}
async function todayCase(db: any): Promise<{ c: DailyCase; events: ReturnType<typeof eventsFor> }> {
  const day = riyadhDay(); const cal = await calendar(db); const active = eventsFor(day, cal);
  const { data: cached } = await db.from('portal_daily_cases').select('*').eq('day', day).maybeSingle();
  if (cached) return { c: rowToCase(cached), events: active };
  // P34 «صدى السؤال»: مسودّة اعتمدها الطاقم من سؤال حُلّ على الهواء (بإذن صاحبه) تسبق التوليد
  const echo = await echoForDay(db, day);
  if (echo?.draft?.title_ar) {
    const d = echo.draft as { title_ar: string; situation_ar: string; ask_ar: string; rubric: string[]; domain_code?: string | null };
    const codes: RubricItem['code'][] = ['frame', 'options', 'action', 'follow_up', 'ethics'];
    const rubric: RubricItem[] = codes.map((code, i) => ({ code, weight: i < 3 ? 2 : 1, look_for: d.rubric[i] ? [d.rubric[i]] : undefined }));
    const domain_code = (d.domain_code || DOMAIN_OF_DAY(day)) as DailyCase['domain_code'];
    const c: DailyCase = { day, slug: `echo-${String(echo.request_id)}`, title_ar: d.title_ar, scene_ar: 'سؤال حقيقي وصل إلى «أَثَر معك — على الهواء» وأُعيدت صياغته بإذن صاحبه.', role_ar: 'أنت المُستقبِل على الهواء', situation_ar: d.situation_ar, twist_ar: '', ask_ar: d.ask_ar, parties_ar: ['السائل', 'المُستقبِل'], domain_code, family: 'judgment_accountability' as DailyCase['family'], horizon: 2035 as DailyCase['horizon'], skill_codes: [], skill_ids: [], event_code: null, event_name_ar: 'صدى السؤال', rubric, source: 'human', model: null };
    const { data: ins } = await db.from('portal_daily_cases').insert({ day, slug: c.slug, title_ar: c.title_ar, scene_ar: c.scene_ar, role_ar: c.role_ar, situation_ar: c.situation_ar, twist_ar: c.twist_ar, ask_ar: c.ask_ar, parties_ar: c.parties_ar, domain_code: c.domain_code, family: c.family, horizon: c.horizon, skill_codes: [], skill_ids: [], event_code: null, event_name_ar: c.event_name_ar, rubric: c.rubric, source: 'human', model: null }).select('*').maybeSingle();
    await db.from('portal_onair_echoes').update({ status: 'published' }).eq('id', echo.id).then(() => null, () => null);
    if (ins) return { c: rowToCase(ins), events: active };
    return { c, events: active };
  }
  // اختيار البذرة (مناسبة أولًا) ثم ربط المهارات
  const { seed, event } = pickSeed(day, CASE_BANK, active);
  const { data: skills } = await db.from('portal_skills').select('id,code,name_ar,domain_code,future_family').eq('active', true);
  const list = (skills || []) as { id: string; code: string; name_ar: string; domain_code?: string | null; future_family?: string | null }[];
  const byCode = new Map(list.map(s => [s.code, s]));
  let skillRows = seed.skill_codes.map(c => byCode.get(c)).filter(Boolean) as typeof list;
  if (!skillRows.length) skillRows = list.filter(s => s.domain_code === seed.domain_code).slice(0, 2);
  const skillIds = skillRows.map(s => s.id); const skillCodes = skillRows.length ? skillRows.map(s => s.code) : seed.skill_codes;
  const local = seedToCase({ ...seed, skill_codes: skillCodes }, day, event, skillIds);
  // توليد بالذكاء الاصطناعي (إن توفر) لموقف جديد في نفس المجال/المناسبة؛ البديل المحلي هو البنك
  const { data: recent } = await db.from('portal_daily_cases').select('slug').order('day', { ascending: false }).limit(30);
  const avoid = ((recent || []) as any[]).map(r => String(r.slug));
  const domain = event ? seed.domain_code : DOMAIN_OF_DAY(day); const family = seed.family || FAMILIES[dayIndexOf(day) % FAMILIES.length].code;
  const p = buildCasePrompt({ day, weekday_ar: WEEKDAYS[new Date(day + 'T00:00:00Z').getUTCDay()], event, domain, family, skills: skillRows.map(s => ({ code: s.code, name_ar: s.name_ar })), avoid_slugs: avoid });
  const res = await runAi<DailyCase>({ system: p.system, user: p.user, parse: raw => parseCase(raw, { day, domain, family, horizon: seed.horizon, skill_codes: skillCodes, skill_ids: skillIds, event }), local: () => local, budgetMs: 25000 });
  const c = res.data; c.model = res.model;
  const { data: ins } = await db.from('portal_daily_cases').insert({ day, slug: c.slug, title_ar: c.title_ar, scene_ar: c.scene_ar, role_ar: c.role_ar, situation_ar: c.situation_ar, twist_ar: c.twist_ar, ask_ar: c.ask_ar, parties_ar: c.parties_ar, domain_code: c.domain_code, family: c.family, horizon: c.horizon, skill_codes: c.skill_codes, skill_ids: c.skill_ids || [], event_code: c.event_code || null, event_name_ar: c.event_name_ar || null, rubric: c.rubric, source: res.source === 'ai' ? 'ai' : 'local', model: res.model }).select('*').maybeSingle();
  if (ins) return { c: rowToCase(ins), events: active };
  // سباق: صفّ آخر أُدرج قبلنا
  const { data: again } = await db.from('portal_daily_cases').select('*').eq('day', day).maybeSingle();
  return { c: again ? rowToCase(again) : c, events: active };
}
/** النسخة العامة: نخفي التعقيد الخفي حتى يُرسل الردّ */
const publicCase = (c: DailyCase, reveal: boolean) => ({ ...c, twist_ar: reveal ? c.twist_ar : '', rubric: c.rubric.map(r => r.code) });

/** المقارنة المجهولة: صفوف اليوم (بلا هوية) → توزيع المستويات ومعدلات المعايير وجملة المقارنة */
async function crowdFor(db: any, day: string, userId: string | null, mine: CaseEvaluation | null) {
  const { data } = await db.from('portal_daily_case_responses').select('user_id,score,band,evaluation,round2').eq('day', day).limit(800);
  const rows = ((data || []) as any[]); const others = userId ? rows.filter(r => r.user_id !== userId) : rows;
  const crowd = crowdOf(rows); return { crowd, line: crowdLine(mine, crowd, others) };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const { c: cs, events } = await todayCase(db);
  const ev = events.find(e => e.event.code === cs.event_code) || events[0] || null;
  let mine: null | { response: string; evaluation: CaseEvaluation; round2?: Partial<Round2> | null } = null; let streak = 0; let total = 0;
  if (user) {
    const { data: rows } = await db.from('portal_daily_case_responses').select('day,response,evaluation,round2').eq('user_id', user.id).order('day', { ascending: false }).limit(120);
    const list = (rows || []) as any[]; total = list.length; const today = list.find(r => String(r.day).slice(0, 10) === cs.day); if (today) mine = { response: today.response, evaluation: today.evaluation, round2: today.round2 || null };
    streak = streakOf(list.map(r => String(r.day).slice(0, 10)), cs.day);
  }
  const { count } = await db.from('portal_daily_case_responses').select('id', { count: 'exact', head: true }).eq('day', cs.day);
  const crowd = await crowdFor(db, cs.day, user?.id || null, mine?.evaluation || null);
  return NextResponse.json({ success: true, day: cs.day, case: publicCase(cs, !!mine), crowd: crowd.crowd, crowd_line: crowd.line, event: ev ? { code: ev.event.code, name_ar: ev.event.name.ar, name_en: ev.event.name.en, theme_ar: ev.event.theme.ar, line_ar: eventLine(ev, 'ar'), line_en: eventLine(ev, 'en'), exact: ev.exact, kind: ev.event.kind } : null, upcoming: upcomingEvents(cs.day, await calendar(db)).filter(e => e.event.code !== cs.event_code).slice(0, 3).map(e => ({ code: e.event.code, name_ar: e.event.name.ar, line_ar: eventLine(e, 'ar'), line_en: eventLine(e, 'en') })), mine, streak, total, participants: count || 0, limits: { min: MIN_RESPONSE_CHARS, max: MAX_RESPONSE_CHARS } });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  if (body.action === 'whatif') return whatIf(db, user, body);
  const response = String(body.response || '').trim();
  if (response.length < MIN_RESPONSE_CHARS) return bad(`اكتب كيف تتصرّف فعلًا — ${MIN_RESPONSE_CHARS} حرفًا على الأقل`);
  if (response.length > MAX_RESPONSE_CHARS) return bad(`الردّ طويل جدًا (الحد ${MAX_RESPONSE_CHARS} حرفًا)`);
  const { c: cs } = await todayCase(db);
  if (user) {
    const { data: prev } = await db.from('portal_daily_case_responses').select('id,response,evaluation').eq('user_id', user.id).eq('day', cs.day).maybeSingle();
    if (prev) return NextResponse.json({ success: true, saved: true, already: true, evaluation: (prev as any).evaluation, case: publicCase(cs, true), streak: 0 });
  }
  // تقويم: محلي دائمًا، ثم تحسين بالذكاء الاصطناعي (للمستخدمين المسجّلين فقط — حوكمة الاستخدام)
  const local = localEvaluate(cs, response); let evaluation: CaseEvaluation = local;
  if (user) {
    const p = buildEvalPrompt(cs, response);
    const res = await runAi<CaseEvaluation>({ system: p.system, user: p.user, parse: raw => parseEval(raw, local), local: () => local, budgetMs: 25000 });
    evaluation = { ...res.data, model: res.model };
    await logAi(db, { user_id: user.id, email: user.email, role: 'user', purpose: 'daily_case_eval', result: res, context: { day: cs.day, slug: cs.slug, chars: response.length } });
  }
  // أسماء المهارات (للعرض)
  if (cs.skill_ids && cs.skill_ids.length) {
    const { data: sk } = await db.from('portal_skills').select('id,code,name_ar').in('id', cs.skill_ids);
    const names = new Map(((sk || []) as any[]).map(s => [s.code, s.name_ar])); evaluation.skills = evaluation.skills.map(s => ({ ...s, label_ar: names.get(s.code) || s.label_ar }));
  }
  let streak = 0; let saved = false;
  if (user) {
    const { error } = await db.from('portal_daily_case_responses').insert({ case_id: cs.id, day: cs.day, user_id: user.id, email: user.email, response, evaluation, band: evaluation.band, score: evaluation.score, source: evaluation.source, model: evaluation.model || null, chars: response.length });
    saved = !error;
    if (saved && cs.skill_ids && cs.skill_ids.length) await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'assessed', object_type: 'daily_case', object_id: cs.day, skills: cs.skill_ids, context: { score: evaluation.score, band: evaluation.band, day: cs.day, title: cs.title_ar, domain_code: cs.domain_code, event_code: cs.event_code || null } });
    const { data: rows } = await db.from('portal_daily_case_responses').select('day').eq('user_id', user.id).order('day', { ascending: false }).limit(120);
    streak = streakOf(((rows || []) as any[]).map(r => String(r.day).slice(0, 10)), cs.day);
  } else {
    await db.from('portal_daily_case_responses').insert({ case_id: cs.id, day: cs.day, user_id: null, email: null, response: response.slice(0, 600), evaluation: { band: evaluation.band, score: evaluation.score }, band: evaluation.band, score: evaluation.score, source: evaluation.source, chars: response.length });
  }
  return NextResponse.json({ success: true, saved, evaluation, case: publicCase(cs, true), streak });
}

/** «ماذا لو؟» — الجولة الثانية (للمستخدمين المسجّلين الذين أجابوا اليوم) */
async function whatIf(db: any, user: { id: string; email: string } | null, body: any) {
  if (!user) return bad('سجّل الدخول لتلعب جولة «ماذا لو؟»', 401);
  const { c: cs } = await todayCase(db);
  const { data: row } = await db.from('portal_daily_case_responses').select('id,response,evaluation,round2').eq('user_id', user.id).eq('day', cs.day).maybeSingle();
  if (!row) return bad('اكتب ردّك على موقف اليوم أولًا');
  const first = (row as any).evaluation as CaseEvaluation; const existing = ((row as any).round2 || null) as Partial<Round2> | null;
  const response = String(body.response || '').trim();
  if (!response) {
    if (existing?.whatif) return NextResponse.json({ success: true, whatif: existing.whatif, round2: existing.response ? existing : null });
    const local = whatIfFor(cs, first); const p = buildWhatIfPrompt(cs, (row as any).response, first);
    const res = await runAi<WhatIf>({ system: p.system, user: p.user, parse: raw => parseWhatIf(raw, local), local: () => local, budgetMs: 20000 });
    const w: WhatIf = { ...res.data, model: res.model };
    await logAi(db, { user_id: user.id, email: user.email, role: 'user', purpose: 'daily_case_whatif', result: res, context: { day: cs.day, slug: cs.slug, tests: w.tests } });
    await db.from('portal_daily_case_responses').update({ round2: { whatif: w } }).eq('id', (row as any).id);
    return NextResponse.json({ success: true, whatif: w, round2: null });
  }
  if (!existing?.whatif) return bad('اطلب «ماذا لو؟» أولًا');
  if (existing.response) return NextResponse.json({ success: true, whatif: existing.whatif, round2: existing, already: true });
  if (response.length < 40) return bad('اكتب قرارك الثاني في 40 حرفًا على الأقل');
  if (response.length > MAX_RESPONSE_CHARS) return bad(`الردّ طويل جدًا (الحد ${MAX_RESPONSE_CHARS} حرفًا)`);
  const r2 = evaluateRound2(cs, existing.whatif as WhatIf, first, response);
  await db.from('portal_daily_case_responses').update({ round2: r2 }).eq('id', (row as any).id);
  if (cs.skill_ids && cs.skill_ids.length) await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'assessed', object_type: 'daily_case', object_id: `${cs.day}:r2`, skills: cs.skill_ids, context: { score: r2.score, band: r2.band, day: cs.day, title: cs.title_ar, round: 2, stance: r2.stance, shift: r2.shift, tests: r2.whatif.tests } });
  const crowd = await crowdFor(db, cs.day, user.id, first);
  return NextResponse.json({ success: true, whatif: existing.whatif, round2: r2, crowd: crowd.crowd, crowd_line: crowd.line });
}
