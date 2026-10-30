// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/ai — بوابة الذكاء الاصطناعي المسؤول (بوابة أَثَر · P9-أ)
 *  GET                                                   → الحالة العامة {enabled, provider, limits} (+ سجل آخر 50 استدعاءً واستخدام المستخدم إن كان Bearer صالحًا)
 *  POST { purpose:'impact_brief', lang?, facts }         → موظف: موجز تنفيذي لتقرير الأثر (الحقائق من التقرير المعروض)
 *  POST { purpose:'learner_plan', lang?, goal? }         → مستخدم: خطة تطوير شخصية من ملفه المهاري + العروض المتاحة (تُجمع في الخادم)
 *  POST { purpose:'org_brief', lang?, org_id }           → مدير جهة/موظف: توصيات للجهة من لوحتها
 *  POST { purpose:'activity_draft', lang?, session_id, kind?, count?, skill_id? } → موظف/مدرب الجلسة: مسودّات أنشطة يراجعها المدرب
 *  الحوكمة: حدود استخدام لكل مستخدم/غرض خلال 24 ساعة، سجل portal_ai_log بلا محتوى شخصي، بديل محلي دائمًا، لا قرار آلي نهائي.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { aiStatus, runAi, aiUsage, logAi } from '../../../lib/ai/athar';
import { AI_LIMITS, sanitizeImpactFacts, buildImpactPrompt, parseImpactBrief, localImpactBrief, buildLearnerPrompt, parseLearnerPlan, localLearnerPlan, buildOrgPrompt, parseOrgBrief, localOrgBrief, buildActivityPrompt, parseActivityDraft, localActivityDraft } from '../../../lib/ai/prompts';
import type { AiPurpose, LearnerFacts, OrgFacts, ActivityFacts } from '../../../lib/ai/prompts';
import { orgKpis, topSkills } from '../../../lib/portal/org';
import type { Lang } from '../../../lib/portal/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const PURPOSES: AiPurpose[] = ['impact_brief', 'learner_plan', 'org_brief', 'activity_draft'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const langOf = (v: unknown): Lang => (v === 'en' ? 'en' : 'ar');

async function ctx(req: Request, optional = false) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  if (!token) return optional ? { db, userDb: db, user: null, role: '', staff: false } : { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return optional ? { db, userDb: db, user: null, role: '', staff: false } : { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { db, userDb, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, role, staff: STAFF.includes(role) };
}
async function isOrgAdmin(db: any, orgId: string, user: { id: string; email: string }) {
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1);
  return !!(data || []).length;
}
const skillRef = (s: any, lang: Lang) => (lang === 'en' && s?.name_en ? String(s.name_en) : String(s?.name_ar || s?.name_en || ''));

export async function GET(req: Request) {
  const c = await ctx(req, true); if ('error' in c) return c.error;
  const st = aiStatus(); const out: any = { success: true, enabled: st.enabled, provider: st.provider, limits: AI_LIMITS };
  if (c.user) {
    const usage: Record<string, number> = {}; for (const p of PURPOSES) usage[p] = (await aiUsage(c.db, c.user.id, p)).used; out.usage = usage;
    if (c.staff) { const { data } = await c.db.from('portal_ai_log').select('id,created_at,email,role,purpose,source,provider,model,input_chars,output_chars,duration_ms,ok,error').order('created_at', { ascending: false }).limit(50); out.log = data || []; }
  }
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, role } = c; if (!user) return bad('يرجى تسجيل الدخول أولاً', 401);
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const purpose = String(body.purpose || '') as AiPurpose; const lang = langOf(body.lang);
  if (!PURPOSES.includes(purpose)) return bad('غرض غير معروف');
  const quota = await aiUsage(db, user.id, purpose); if (!quota.allowed) return bad(lang === 'ar' ? `بلغت الحد اليومي لهذه الخدمة (${quota.limit}). حاول غدًا.` : `Daily limit reached (${quota.limit}). Try tomorrow.`, 429);
  const respond = (result: any, extra: Record<string, unknown> = {}) => NextResponse.json({ success: true, purpose, source: result.source, model: result.model, provider: result.provider, ms: result.ms, data: result.data, usage: { used: quota.used + 1, limit: quota.limit }, ...extra });

  // 1) موجز تنفيذي لتقرير الأثر — موظفون
  if (purpose === 'impact_brief') {
    if (!c.staff) return bad('غير مصرّح', 403);
    const facts = sanitizeImpactFacts(body.facts); if (!facts) return bad('حقائق التقرير مطلوبة');
    const { system, user: u } = buildImpactPrompt(facts, lang);
    const r = await runAi({ system, user: u, parse: raw => parseImpactBrief(raw), local: () => localImpactBrief(facts, lang) });
    await logAi(db, { user_id: user.id, email: user.email, role, purpose, result: r, context: { scope: facts.scope, period: facts.period, programs: facts.programs.length } });
    return respond(r);
  }

  // 2) خطة تطوير شخصية — المستخدم عن نفسه فقط (البيانات تُجمع في الخادم)
  if (purpose === 'learner_plan') {
    const goal = String(body.goal || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const [{ data: levels }, { data: creds }, { data: ens }, { data: pls }] = await Promise.all([
      db.from('portal_skill_levels').select('skill_id,computed_level,approved_level,confidence').eq('user_id', user.id),
      db.from('portal_credentials').select('title_ar,title_en,kind').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(30),
      db.from('portal_enrollments').select('program_id,status').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(30),
      db.from('portal_placements').select('level,taken_at').ilike('email', user.email).order('taken_at', { ascending: false }).limit(1),
    ]);
    const lv = (levels || []) as any[]; const skillIds = lv.map(l => l.skill_id);
    const [{ data: skills }, progRes, { data: res }, { data: ses }, { data: pskills }] = await Promise.all([
      db.from('portal_skills').select('id,code,name_ar,name_en,domain'),
      db.from('programs').select('id,name_ar,name_en,cefr_level,fee,is_public,registration_open,archived_at').eq('is_public', true).is('archived_at', null).order('start_date', { ascending: false }).limit(40),
      db.from('portal_resources').select('id,title_ar,title_en,type,skills,status').eq('status', 'published').limit(60),
      db.from('portal_sessions').select('id,title_ar,title_en,starts_at,skills,access,status').gte('starts_at', new Date().toISOString()).neq('status', 'cancelled').order('starts_at').limit(20),
      db.from('portal_program_skills').select('program_id,skill_id').limit(500),
    ]);
    const sk = new Map<string, any>(((skills || []) as any[]).map(s => [s.id, s]));
    const progSkills = new Map<string, string[]>(); for (const r of (pskills || []) as any[]) progSkills.set(r.program_id, [...(progSkills.get(r.program_id) || []), r.skill_id]);
    const progs = ((progRes.data || []) as any[]).filter(p => p.registration_open !== false);
    const facts: LearnerFacts = {
      name: user.name || user.email.split('@')[0], goal,
      skills: lv.filter(l => sk.has(l.skill_id)).map(l => ({ id: l.skill_id, name: skillRef(sk.get(l.skill_id), lang), domain: String(sk.get(l.skill_id).domain || ''), level: Number(l.approved_level ?? l.computed_level) || 1, approved: l.approved_level !== null && l.approved_level !== undefined, confidence: Number(l.confidence) || 0 })),
      credentials: ((creds || []) as any[]).map(cr => ({ title: String(lang === 'en' && cr.title_en ? cr.title_en : cr.title_ar), kind: String(cr.kind) })),
      enrollments: ((ens || []) as any[]).map(e => ({ program: String(((progRes.data || []) as any[]).find(p => p.id === e.program_id)?.name_ar || e.program_id), status: String(e.status) })),
      placement: ((pls || []) as any[])[0]?.level || null,
      programs: progs.slice(0, 20).map(p => ({ id: p.id, name: String(lang === 'en' && p.name_en ? p.name_en : p.name_ar), level: p.cefr_level || null, skills: (progSkills.get(p.id) || []).map(id => skillRef(sk.get(id), lang)).filter(Boolean), fee: p.fee ?? null })),
      resources: ((res || []) as any[]).filter(r => !skillIds.length || (r.skills || []).some((s: string) => skillIds.includes(s))).slice(0, 20).map(r => ({ id: r.id, title: String(lang === 'en' && r.title_en ? r.title_en : r.title_ar), type: String(r.type || ''), skills: (r.skills || []).map((id: string) => skillRef(sk.get(id), lang)).filter(Boolean) })),
      sessions: ((ses || []) as any[]).filter(s => s.access !== 'private').slice(0, 10).map(s => ({ id: s.id, title: String(lang === 'en' && s.title_en ? s.title_en : s.title_ar), when: String(s.starts_at).slice(0, 16), skills: (s.skills || []).map((id: string) => skillRef(sk.get(id), lang)).filter(Boolean) })),
    };
    // لتمكين ربط المهارات في البديل المحلي نحتاج معرّفات المهارات داخل العروض
    const factsLocal: LearnerFacts = { ...facts, resources: ((res || []) as any[]).slice(0, 20).map(r => ({ id: r.id, title: String(r.title_ar), type: String(r.type || ''), skills: r.skills || [] })), sessions: ((ses || []) as any[]).filter(s => s.access !== 'private').slice(0, 10).map(s => ({ id: s.id, title: String(s.title_ar), when: String(s.starts_at).slice(0, 16), skills: s.skills || [] })), programs: progs.slice(0, 20).map(p => ({ id: p.id, name: String(p.name_ar), level: p.cefr_level || null, skills: progSkills.get(p.id) || [], fee: p.fee ?? null })), enrollments: facts.enrollments };
    const { system, user: u } = buildLearnerPrompt(facts, lang);
    const r = await runAi({ system, user: u, parse: raw => parseLearnerPlan(raw, facts), local: () => localLearnerPlan(factsLocal, lang) });
    await logAi(db, { user_id: user.id, email: user.email, role, purpose, result: r, context: { skills: facts.skills.length, has_goal: !!goal } });
    return respond(r);
  }

  // 3) توصيات للجهة — مدير الجهة أو موظف
  if (purpose === 'org_brief') {
    const orgId = String(body.org_id || ''); if (!orgId) return bad('معرّف الجهة مطلوب');
    if (!(c.staff || await isOrgAdmin(db, orgId, user))) return bad('غير مصرّح — أنت لست مدير هذه الجهة', 403);
    const { data: d, error } = await c.userDb.rpc('portal_org_dashboard', { p_org: orgId }); /* بجلسة المستخدم: الدالة تتحقق من auth.uid() */ if (error || !d?.ok) return bad(error?.message || d?.error || 'تعذّر تحميل لوحة الجهة', 500);
    const k = orgKpis(d); const ts = topSkills(d, 10);
    const byProg = new Map<string, { name: string; learners: number; present: number; sessions: number }>();
    for (const e of (d.enrollments || []) as any[]) { if (e.status !== 'approved') continue; const x = byProg.get(e.program_id) || { name: String(e.program || e.program_id), learners: 0, present: 0, sessions: 0 }; x.learners++; x.present += Number(e.attendance?.present) || 0; x.sessions += Number(e.attendance?.sessions) || 0; byProg.set(e.program_id, x); }
    const { data: offers } = await db.from('programs').select('id,name_ar,name_en,is_public,registration_open,archived_at').eq('is_public', true).is('archived_at', null).limit(30);
    const { data: pskills } = await db.from('portal_program_skills').select('program_id,skill_id').limit(500); const { data: skills } = await db.from('portal_skills').select('id,name_ar,name_en');
    const sk = new Map<string, any>(((skills || []) as any[]).map(s => [s.id, s])); const progSkills = new Map<string, string[]>(); for (const r of (pskills || []) as any[]) progSkills.set(r.program_id, [...(progSkills.get(r.program_id) || []), skillRef(sk.get(r.skill_id), lang)]);
    const facts: OrgFacts = {
      org: String(lang === 'en' && d.org?.name_en ? d.org.name_en : d.org?.name_ar || ''), sector: d.org?.sector || null,
      kpis: { members: k.members, pending: k.pending, learners: k.learners, programs: k.programs, attendance: k.attendance, credentials: k.credentials, placements: k.placements },
      skills: ts.map((s: any) => ({ name: lang === 'en' && s.name_en ? s.name_en : s.name_ar, domain: String(s.domain || ''), people: Number(s.n) || 0, avg: Number(s.avg) || 0 })),
      programs: Array.from(byProg.values()).map(p => ({ name: p.name, learners: p.learners, attendance: p.sessions ? Math.round((p.present / p.sessions) * 100) : null })),
      requests: ((d.requests || []) as any[]).slice(0, 10).map(r => ({ program: String(r.program || r.program_id || ''), status: String(r.status || ''), people: Number(r.count) || 0 })),
      offers: ((offers || []) as any[]).filter(o => o.registration_open !== false).slice(0, 15).map(o => ({ id: o.id, name: String(lang === 'en' && o.name_en ? o.name_en : o.name_ar), skills: progSkills.get(o.id) || [] })),
    };
    const { system, user: u } = buildOrgPrompt(facts, lang);
    const r = await runAi({ system, user: u, parse: raw => parseOrgBrief(raw, facts), local: () => localOrgBrief(facts, lang) });
    await logAi(db, { user_id: user.id, email: user.email, role, purpose, result: r, context: { org_id: orgId } });
    return respond(r);
  }

  // 4) مسودّات أنشطة — موظف أو مدرب الجلسة
  if (purpose === 'activity_draft') {
    const sid = String(body.session_id || ''); if (!sid) return bad('معرّف الجلسة مطلوب');
    const { data: s } = await db.from('portal_sessions').select('id,title_ar,title_en,description_ar,description_en,kind,program_id,trainer_id,skills,lang').eq('id', sid).maybeSingle(); if (!s) return bad('الجلسة غير موجودة', 404);
    if (!c.staff) { const { data: tr } = await db.from('trainers').select('id').eq('id', (s as any).trainer_id || '00000000-0000-0000-0000-000000000000').ilike('email', user.email).limit(1); if (!(tr || []).length) return bad('غير مصرّح', 403); }
    const kind = (['mcq', 'reflection', 'self_rating'] as const).includes(body.kind) ? body.kind : 'mcq'; const count = Math.min(5, Math.max(1, Number(body.count) || 3)); const want_skill = String(body.skill_id || '') || null;
    const [{ data: skills }, { data: acts }, prog] = await Promise.all([
      db.from('portal_skills').select('id,name_ar,name_en,domain').in('id', ((s as any).skills || []).length ? (s as any).skills : ['00000000-0000-0000-0000-000000000000']),
      db.from('portal_session_activities').select('prompt_ar').eq('session_id', sid).limit(30),
      (s as any).program_id ? db.from('programs').select('name_ar,name_en,cefr_level').eq('id', (s as any).program_id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    const facts: ActivityFacts = {
      session: { title: String(lang === 'en' && (s as any).title_en ? (s as any).title_en : (s as any).title_ar || ''), description: String((lang === 'en' ? (s as any).description_en : (s as any).description_ar) || (s as any).description_ar || '').slice(0, 1500), kind: String((s as any).kind || ''), program: prog?.data ? String(lang === 'en' && prog.data.name_en ? prog.data.name_en : prog.data.name_ar) : null, level: prog?.data?.cefr_level || null },
      skills: ((skills || []) as any[]).map(k => ({ id: k.id, name: skillRef(k, lang), domain: String(k.domain || '') })),
      existing: ((acts || []) as any[]).map(a => String(a.prompt_ar || '').slice(0, 160)),
      want: { kind, count, skill_id: want_skill },
    };
    const { system, user: u } = buildActivityPrompt(facts, lang);
    const r = await runAi({ system, user: u, parse: raw => parseActivityDraft(raw, facts), local: () => localActivityDraft(facts, lang) });
    await logAi(db, { user_id: user.id, email: user.email, role, purpose, result: r, context: { session_id: sid, kind, count } });
    return respond(r);
  }
  return bad('غرض غير معروف');
}
