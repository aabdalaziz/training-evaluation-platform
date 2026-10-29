// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — طبقة الذكاء الاصطناعي المسؤول (P9-أ): المطالبات، التحليل، والبدائل المحلية — دوال نقية (بلا شبكة/بيئة) قابلة للاختبار
 *  الأغراض الأربعة: impact_brief (موجز تنفيذي لتقرير الأثر) · learner_plan (خطة تطوير شخصية) · org_brief (توصيات للجهة) · activity_draft (مسودّات أنشطة للمدرب)
 *  مبادئ الحوكمة المضمّنة في كل مطالبة: لا اختلاق، الاعتماد على الحقائق المُمرَّرة فقط، تمييز عدم اليقين، لا قرار نهائي بشأن أشخاص، الإنسان يعتمد.
 */
import type { Lang } from '../portal/content';
import type { Scenario, Turn } from '../portal/sim';

export type AiPurpose = 'impact_brief' | 'learner_plan' | 'org_brief' | 'activity_draft' | 'sim_turn' | 'sim_score' | 'daily_skill' | 'advisor' | 'companion' | 'mission_check' | 'mission_suggest' | 'daily_case' | 'daily_case_eval' | 'factory_foresight' | 'factory_design' | 'factory_review' | 'daily_case_whatif' | 'copilot_memo' | 'evidence_query' | 'agent_reply' | 'council_scribe';
/** حدود الاستخدام لكل مستخدم خلال 24 ساعة */
export const AI_LIMITS: Record<AiPurpose, number> = { impact_brief: 30, learner_plan: 6, org_brief: 12, activity_draft: 40, sim_turn: 120, sim_score: 20, daily_skill: 3, advisor: 40, companion: 150, mission_check: 30, mission_suggest: 20, daily_case: 3, daily_case_eval: 6, factory_foresight: 20, factory_design: 20, factory_review: 20, daily_case_whatif: 4, copilot_memo: 20, evidence_query: 60, agent_reply: 200, council_scribe: 40 };
export const AI_PURPOSE_LABEL: Record<AiPurpose, { ar: string; en: string }> = {
  council_scribe: { ar: 'كاتب المجلس (مجالس أَثَر)', en: 'Council scribe' },
  impact_brief: { ar: 'موجز تنفيذي لتقرير الأثر', en: 'Impact executive brief' },
  learner_plan: { ar: 'خطة تطوير شخصية', en: 'Personal development plan' },
  org_brief: { ar: 'توصيات للجهة', en: 'Organization recommendations' },
  activity_draft: { ar: 'مسودّات أنشطة للمدرب', en: 'Trainer activity drafts' },
  sim_turn: { ar: 'شخصية المحاكاة', en: 'Simulation persona' }, sim_score: { ar: 'تقييم المحاكاة', en: 'Simulation scoring' },
  daily_skill: { ar: 'كل يوم مهارة', en: 'Daily skill' }, advisor: { ar: 'مستشارك: اسأل وأنا أجيب', en: 'Your advisor' }, companion: { ar: 'أثير — المدرب الرفيق', en: 'Athir — AI companion' },
  mission_check: { ar: 'فحص أولي لدليل مهمة عمل', en: 'Workflow mission first check' }, mission_suggest: { ar: 'اقتراح مهمات عمل لبرنامج', en: 'Mission suggestions' },
  daily_case: { ar: 'كتابة «موقف اليوم»', en: 'Daily case writing' }, daily_case_eval: { ar: 'مرآة الأداء لموقف اليوم', en: 'Daily case performance mirror' },
  factory_foresight: { ar: 'هندسة البرامج التدريبية — محلل الاحتياج', en: 'Program engineering — needs analyst' }, factory_design: { ar: 'هندسة البرامج التدريبية — المصمم التعليمي', en: 'Program engineering — instructional designer' }, factory_review: { ar: 'هندسة البرامج التدريبية — مراجع الجودة', en: 'Program engineering — QA reviewer' },
  daily_case_whatif: { ar: '«ماذا لو؟» — الجولة الثانية لموقف اليوم', en: 'Daily case — what-if round' }, copilot_memo: { ar: 'الميسِّر — محضر الأثر', en: 'Live facilitator — impact memo' }, evidence_query: { ar: 'قاعدة الأدلة — اختيار السؤال المؤسسي', en: 'Evidence base — question routing' }, agent_reply: { ar: 'الوكلاء المفوَّضون — صياغة الرد', en: 'Authorized agents — reply phrasing' },
};
export const AI_DISCLAIMER = { ar: 'مُولَّد بمساعدة الذكاء الاصطناعي من بياناتك في أَثَر — للاسترشاد، والقرار النهائي للإنسان.', en: 'AI-assisted, generated from your Athar data — for guidance; final decisions stay human.' };

// ---------- أدوات عامة ----------
const S = (v: unknown, max = 300): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (v: unknown, max = 8, len = 300): string[] => (Array.isArray(v) ? v.map(x => S(x, len)).filter(Boolean).slice(0, max) : []);
const N = (v: unknown): number | null => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
/** يستخرج JSON من نص قد يحتوي أسوار ``` أو كلامًا حوله */
export function parseJsonLoose(text: string): any | null {
  if (!text) return null; let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(s); } catch { /* متابعة */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } }
  return null;
}
function systemBase(lang: Lang, role: string): string {
  const ar = `أنت مساعد تحليلي في بوابة «أَثَر» (Athar · TRACE) — شعارها: التدريب ما بعد الذكاء الاصطناعي: نبني القدرة ونُثبت الأثر. دورك: ${role}.
قواعد صارمة: (1) استخدم الحقائق المُمرَّرة فقط ولا تختلق أرقامًا أو أسماء أو برامج. (2) إن كانت البيانات ناقصة فقل ذلك صراحة بدل التخمين. (3) لا تُصدر أحكامًا نهائية على أشخاص؛ قدّم توصيات يعتمدها الإنسان. (4) اكتب بالعربية الفصحى الواضحة والموجزة${lang === 'en' ? ' (ثم بالإنجليزية إن طُلب)' : ''}. (5) أعد JSON صالحًا فقط وفق المخطط المطلوب بلا أي نص خارجه.`;
  const en = `You are an analytical assistant inside the "Athar · TRACE" portal — motto: Post-AI training: build capability, prove impact. Your role: ${role}.
Strict rules: (1) use only the provided facts; never invent numbers, names or programs. (2) If data is missing, say so instead of guessing. (3) Never make final judgements about people; give recommendations for a human to approve. (4) Write clear, concise English. (5) Return valid JSON only, matching the requested schema, with no text outside it.`;
  return lang === 'en' ? en : ar;
}

// ================================================================ 1) موجز تنفيذي لتقرير الأثر
export type ImpactFacts = {
  scope: string; period: string;
  totals: { programs: number; learners: number; orgs: number; hours: number; credentials: number; skillsProven: number; skillsApproved: number; attendanceRate: number | null; satisfactionMean: number | null; satisfactionN: number; pre: number | null; post: number | null; improvement: number | null; transferMean: number | null; transferN: number; placements: number; events: number };
  programs: { name: string; learners: number; attendance: number | null; satisfaction: number | null; improvement: number | null; sector?: string | null }[];
  skills: { name: string; learners: number; avg: number | null }[];
  sectors: { name: string; learners: number }[];
  orgs: { name: string; learners: number; attendance: number | null }[];
};
export type ImpactBrief = { headline: string; findings: string[]; recommendations: string[]; risks: string[]; next_quarter: string[] };
export function sanitizeImpactFacts(raw: any): ImpactFacts | null {
  if (!raw || typeof raw !== 'object' || !raw.totals) return null; const t = raw.totals;
  const row = (p: any) => ({ name: S(p?.name, 120), learners: N(p?.learners) ?? 0, attendance: N(p?.attendance), satisfaction: N(p?.satisfaction), improvement: N(p?.improvement), sector: p?.sector ? S(p.sector, 60) : null });
  return {
    scope: S(raw.scope, 200), period: S(raw.period, 80),
    totals: { programs: N(t.programs) ?? 0, learners: N(t.learners) ?? 0, orgs: N(t.orgs) ?? 0, hours: N(t.hours) ?? 0, credentials: N(t.credentials) ?? 0, skillsProven: N(t.skillsProven) ?? 0, skillsApproved: N(t.skillsApproved) ?? 0, attendanceRate: N(t.attendanceRate), satisfactionMean: N(t.satisfactionMean), satisfactionN: N(t.satisfactionN) ?? 0, pre: N(t.pre), post: N(t.post), improvement: N(t.improvement), transferMean: N(t.transferMean), transferN: N(t.transferN) ?? 0, placements: N(t.placements) ?? 0, events: N(t.events) ?? 0 },
    programs: (Array.isArray(raw.programs) ? raw.programs : []).slice(0, 15).map(row),
    skills: (Array.isArray(raw.skills) ? raw.skills : []).slice(0, 12).map((s: any) => ({ name: S(s?.name, 120), learners: N(s?.learners) ?? 0, avg: N(s?.avg) })),
    sectors: (Array.isArray(raw.sectors) ? raw.sectors : []).slice(0, 12).map((s: any) => ({ name: S(s?.name, 120), learners: N(s?.learners) ?? 0 })),
    orgs: (Array.isArray(raw.orgs) ? raw.orgs : []).slice(0, 12).map((o: any) => ({ name: S(o?.name, 120), learners: N(o?.learners) ?? 0, attendance: N(o?.attendance) })),
  };
}
export function buildImpactPrompt(f: ImpactFacts, lang: Lang): { system: string; user: string } {
  const system = systemBase(lang, lang === 'ar' ? 'كتابة موجز تنفيذي لتقرير أثر تدريبي يقرؤه قادة الجهات والممولون' : 'writing an executive brief of a training impact report for executives and funders');
  const schema = `{"headline": string (≤ 120 chars), "findings": string[3-6], "recommendations": string[3-6], "risks": string[0-4], "next_quarter": string[2-4]}`;
  const user = `${lang === 'ar' ? 'الحقائق (JSON):' : 'Facts (JSON):'}\n${JSON.stringify(f)}\n\n${lang === 'ar' ? 'المطلوب: موجز تنفيذي. اربط كل نتيجة برقم من الحقائق. المؤشرات التي قيمتها null غير متاحة — اذكر غيابها في المخاطر إن كان مهمًا. المخطط:' : 'Task: executive brief. Tie each finding to a number from the facts. Null metrics are unavailable — mention their absence under risks if material. Schema:'}\n${schema}`;
  return { system, user };
}
export function parseImpactBrief(raw: any): ImpactBrief | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const b: ImpactBrief = { headline: S(j.headline, 160), findings: arr(j.findings, 6), recommendations: arr(j.recommendations, 6), risks: arr(j.risks, 4), next_quarter: arr(j.next_quarter, 4) };
  return b.headline && b.findings.length ? b : null;
}
export function localImpactBrief(f: ImpactFacts, lang: Lang): ImpactBrief {
  const t = f.totals; const ar = lang === 'ar'; const findings: string[] = []; const recs: string[] = []; const risks: string[] = []; const nq: string[] = [];
  findings.push(ar ? `شمل النطاق ${t.programs} برنامجًا و${t.learners} متعلمًا من ${t.orgs} جهة خلال ${f.period}.` : `${t.programs} programs and ${t.learners} learners from ${t.orgs} organizations in ${f.period}.`);
  if (t.attendanceRate !== null) findings.push(ar ? `نسبة الحضور ${t.attendanceRate}%${t.attendanceRate >= 80 ? ' — التزام مرتفع' : t.attendanceRate < 60 ? ' — دون المستهدف' : ''}.` : `Attendance ${t.attendanceRate}%.`);
  if (t.satisfactionMean !== null) findings.push(ar ? `الرضا ${t.satisfactionMean}/5 من ${t.satisfactionN} استجابة.` : `Satisfaction ${t.satisfactionMean}/5 (${t.satisfactionN} responses).`);
  if (t.improvement !== null) findings.push(ar ? `التحسّن القبلي/البعدي ${t.improvement}% (${t.pre} ← ${t.post}).` : `Pre/post improvement ${t.improvement}% (${t.pre} → ${t.post}).`);
  if (t.transferMean !== null) findings.push(ar ? `نقل الأثر إلى العمل ${t.transferMean}% من ${t.transferN} متابعة.` : `Transfer to work ${t.transferMean}% from ${t.transferN} follow-ups.`);
  findings.push(ar ? `${t.skillsProven} مهارة مُثبتة بأدلة (${t.skillsApproved} معتمدة) و${t.credentials} شهادة رقمية.` : `${t.skillsProven} evidenced skills (${t.skillsApproved} approved) and ${t.credentials} digital credentials.`);
  const top = [...f.programs].sort((a, b) => b.learners - a.learners)[0]; if (top) findings.push(ar ? `أكبر البرامج: «${top.name}» (${top.learners} متعلمًا).` : `Largest program: “${top.name}” (${top.learners} learners).`);
  if (t.satisfactionMean === null) risks.push(ar ? 'لا استبانات رضا مرتبطة بالفترة — فعّل استبانة نهاية البرنامج.' : 'No satisfaction surveys in period — enable end-of-program surveys.');
  if (t.improvement === null) risks.push(ar ? 'لا قياس قبلي/بعدي مكتمل — اربط كل برنامج باختبار قبلي وبعدي.' : 'No completed pre/post measurement — attach pre/post tests to each program.');
  if (t.transferMean === null) risks.push(ar ? 'لا متابعة لنقل الأثر (30/60/90 يومًا) — جدولة المتابعات ترفع مصداقية التقرير.' : 'No transfer follow-ups (30/60/90 days).');
  if (t.skillsApproved < t.skillsProven) recs.push(ar ? 'اعتماد المهارات المحسوبة يدويًا بعد مراجعة الأدلة لرفع الثقة في الملفات المهارية.' : 'Approve computed skills after reviewing evidence.');
  recs.push(ar ? 'ربط كل برنامج بقطاع ومهارات مستهدفة ليظهر في مقارنات القطاعات والكتالوج المفتوح.' : 'Map each program to a sector and target skills.');
  recs.push(ar ? 'مشاركة لوحة الجهة مع مديري الجهات المشاركة لتعزيز الطلب المؤسسي.' : 'Share the organization dashboard with partner org admins.');
  if (t.attendanceRate !== null && t.attendanceRate < 75) recs.push(ar ? 'تفعيل التذكيرات التلقائية قبل الجلسات ومتابعة الغياب المتكرر.' : 'Enable session reminders and follow up on repeated absence.');
  nq.push(ar ? 'إغلاق فجوات القياس (رضا/قبلي-بعدي/نقل أثر) في كل برنامج نشط.' : 'Close measurement gaps in every active program.'); nq.push(ar ? 'إصدار شهادات رقمية لكل مُتمّ وربطها بالمهارات.' : 'Issue digital credentials to all completers.');
  return { headline: ar ? `أثر التدريب — ${f.scope || 'كل الخدمات'}: ${t.learners} متعلمًا، ${t.skillsProven} مهارة مُثبتة` : `Training impact — ${f.scope || 'all services'}: ${t.learners} learners, ${t.skillsProven} evidenced skills`, findings: findings.slice(0, 6), recommendations: recs.slice(0, 6), risks: risks.slice(0, 4), next_quarter: nq };
}

// ================================================================ 2) خطة تطوير شخصية للمتعلم
export type LearnerFacts = {
  name: string; goal: string;
  skills: { id: string; name: string; domain: string; level: number; approved: boolean; confidence: number }[];
  credentials: { title: string; kind: string }[];
  enrollments: { program: string; status: string }[];
  placement: string | null;
  programs: { id: string; name: string; level?: string | null; skills: string[]; fee?: number | null }[];
  resources: { id: string; title: string; type: string; skills: string[] }[];
  sessions: { id: string; title: string; when: string; skills: string[] }[];
};
export type PlanStep = { title: string; why: string; kind: 'program' | 'resource' | 'session' | 'practice'; ref_id: string | null; href: string | null; hours: number | null };
export type LearnerPlan = { goal: string; strengths: string[]; gaps: string[]; steps: PlanStep[]; weekly_hours: number; message: string };
export function buildLearnerPrompt(f: LearnerFacts, lang: Lang): { system: string; user: string } {
  const system = systemBase(lang, lang === 'ar' ? 'مرشد تعلّم يبني خطة تطوير شخصية قصيرة من الملف المهاري للمتعلم والعروض المتاحة فعلًا في البوابة' : 'a learning coach building a short personal development plan from the learner profile and what the portal actually offers');
  const schema = `{"goal": string, "strengths": string[1-4], "gaps": string[1-4], "steps": [{"title": string, "why": string, "kind": "program"|"resource"|"session"|"practice", "ref_id": string|null (id من القوائم المتاحة فقط), "hours": number|null}] (3-5), "weekly_hours": number, "message": string (≤ 200 chars, تحفيزي وواقعي)}`;
  const user = `${lang === 'ar' ? 'ملف المتعلم والعروض المتاحة (JSON):' : 'Learner profile and available offers (JSON):'}\n${JSON.stringify(f)}\n\n${lang === 'ar' ? 'المطلوب: خطة 4–8 أسابيع. اختر الخطوات من programs/resources/sessions المتاحة فقط (استخدم id الحقيقي في ref_id)، وأضف خطوة practice واحدة على الأكثر بلا ref_id. ركّز على أضعف المهارات ذات الصلة بالهدف. المخطط:' : 'Task: a 4–8 week plan. Pick steps only from the available programs/resources/sessions (real id in ref_id), plus at most one practice step without ref_id. Focus on the weakest goal-relevant skills. Schema:'}\n${schema}`;
  return { system, user };
}
const hrefOf = (kind: PlanStep['kind'], id: string | null) => (!id ? null : kind === 'program' ? `/programs/${id}` : kind === 'resource' ? `/resources/${id}` : kind === 'session' ? `/live/${id}` : null);
export function parseLearnerPlan(raw: any, f: LearnerFacts): LearnerPlan | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object' || !Array.isArray(j.steps)) return null;
  const known = { program: new Set(f.programs.map(p => p.id)), resource: new Set(f.resources.map(r => r.id)), session: new Set(f.sessions.map(s => s.id)) } as Record<string, Set<string>>;
  const steps: PlanStep[] = j.steps.slice(0, 5).map((s: any) => {
    const kind: PlanStep['kind'] = ['program', 'resource', 'session', 'practice'].includes(s?.kind) ? s.kind : 'practice';
    const id = S(s?.ref_id, 80) || null; const valid = kind !== 'practice' && id && known[kind]?.has(id) ? id : null; // لا روابط مختلقة
    return { title: S(s?.title, 140), why: S(s?.why, 240), kind: valid ? kind : 'practice', ref_id: valid, href: hrefOf(valid ? kind : 'practice', valid), hours: N(s?.hours) };
  }).filter((s: PlanStep) => s.title);
  if (!steps.length) return null;
  return { goal: S(j.goal, 160) || f.goal, strengths: arr(j.strengths, 4), gaps: arr(j.gaps, 4), steps, weekly_hours: Math.min(20, Math.max(1, N(j.weekly_hours) ?? 3)), message: S(j.message, 240) };
}
export function localLearnerPlan(f: LearnerFacts, lang: Lang): LearnerPlan {
  const ar = lang === 'ar'; const sorted = [...f.skills].sort((a, b) => a.level - b.level || a.confidence - b.confidence);
  const strong = [...f.skills].sort((a, b) => b.level - a.level || b.confidence - a.confidence).slice(0, 3).filter(s => s.level >= 4); const strongIds = new Set(strong.map(s => s.id));
  const weak = (sorted.filter(s => !strongIds.has(s.id)).length ? sorted.filter(s => !strongIds.has(s.id)) : sorted).slice(0, 3);
  const weakIds = new Set(weak.map(s => s.id)); const steps: PlanStep[] = [];
  const res = f.resources.find(r => r.skills.some(s => weakIds.has(s))) || f.resources[0]; if (res) steps.push({ title: ar ? `ادرس الحقيبة: ${res.title}` : `Study: ${res.title}`, why: ar ? 'ترفع المهارة الأضعف في ملفك بأقل جهد.' : 'Targets your weakest skill.', kind: 'resource', ref_id: res.id, href: hrefOf('resource', res.id), hours: 2 });
  const ses = f.sessions.find(s => s.skills.some(k => weakIds.has(k))) || f.sessions[0]; if (ses) steps.push({ title: ar ? `احضر الجلسة: ${ses.title}` : `Attend: ${ses.title}`, why: ar ? 'التفاعل المباشر وأنشطة الجلسة تُسجَّل دليلًا في ملفك.' : 'Live activities become evidence in your profile.', kind: 'session', ref_id: ses.id, href: hrefOf('session', ses.id), hours: 1.5 });
  const enrolled = new Set(f.enrollments.map(e => e.program)); const prog = f.programs.find(p => !enrolled.has(p.name) && p.skills.some(s => weakIds.has(s))) || f.programs.find(p => !enrolled.has(p.name)); if (prog) steps.push({ title: ar ? `سجّل في برنامج: ${prog.name}` : `Enrol: ${prog.name}`, why: ar ? 'مسار منظّم بشهادة رقمية في نهايته.' : 'A structured path with a digital credential.', kind: 'program', ref_id: prog.id, href: hrefOf('program', prog.id), hours: 3 });
  steps.push({ title: ar ? 'طبّق في عملك ودوّن أثرًا واحدًا أسبوعيًا' : 'Apply at work and log one impact per week', why: ar ? 'نقل الأثر إلى العمل هو ما يثبت القدرة.' : 'Transfer to work is what proves capability.', kind: 'practice', ref_id: null, href: null, hours: 1 });
  return {
    goal: f.goal || (ar ? 'رفع أضعف مهاراتي خلال 6 أسابيع' : 'Raise my weakest skills in 6 weeks'),
    strengths: strong.length ? strong.map(s => `${s.name} (${s.level}/5)`) : [ar ? 'بدأ ملفك بالتشكّل — كل نشاط يضيف دليلًا.' : 'Your profile is forming — every activity adds evidence.'],
    gaps: weak.length ? weak.map(s => `${s.name} (${s.level}/5)`) : [ar ? 'لا أدلة كافية بعد لتحديد الفجوات بدقة.' : 'Not enough evidence yet to pinpoint gaps.'],
    steps: steps.slice(0, 5), weekly_hours: 4,
    message: ar ? 'خطة قصيرة وواقعية: ساعة يوميًا تقريبًا، وكل خطوة تُسجَّل تلقائيًا في ملفك المهاري.' : 'Short and realistic: about an hour a day, and every step is logged in your skills profile.',
  };
}

// ================================================================ 3) توصيات للجهة
export type OrgFacts = {
  org: string; sector: string | null;
  kpis: { members: number; pending: number; learners: number; programs: number; attendance: number | null; credentials: number; placements: number };
  skills: { name: string; domain: string; people: number; avg: number }[];
  programs: { name: string; learners: number; attendance: number | null }[];
  requests: { program: string; status: string; people: number }[];
  offers: { id: string; name: string; skills: string[] }[];
};
export type OrgBrief = { headline: string; highlights: string[]; gaps: string[]; recommendations: string[]; suggested_programs: { program_id: string | null; name: string; why: string }[] };
export function buildOrgPrompt(f: OrgFacts, lang: Lang): { system: string; user: string } {
  const system = systemBase(lang, lang === 'ar' ? 'مستشار تطوير قدرات يكتب توصيات موجزة لمدير جهة بناءً على لوحة أثر منسوبيه' : 'a capability-development advisor writing concise recommendations for an organization admin');
  const schema = `{"headline": string (≤ 120), "highlights": string[2-4], "gaps": string[1-4], "recommendations": string[3-5], "suggested_programs": [{"program_id": string|null (من offers فقط), "name": string, "why": string}] (0-3)}`;
  const user = `${lang === 'ar' ? 'لوحة الجهة والعروض المتاحة (JSON):' : 'Organization dashboard and available offers (JSON):'}\n${JSON.stringify(f)}\n\n${lang === 'ar' ? 'المطلوب: توصيات عملية لمدير الجهة. لا تذكر أسماء أفراد. اقترح برامج من offers فقط. المخطط:' : 'Task: practical recommendations for the org admin. No individual names. Suggest programs only from offers. Schema:'}\n${schema}`;
  return { system, user };
}
export function parseOrgBrief(raw: any, f: OrgFacts): OrgBrief | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null; const ids = new Set(f.offers.map(o => o.id));
  const b: OrgBrief = { headline: S(j.headline, 160), highlights: arr(j.highlights, 4), gaps: arr(j.gaps, 4), recommendations: arr(j.recommendations, 5), suggested_programs: (Array.isArray(j.suggested_programs) ? j.suggested_programs : []).slice(0, 3).map((p: any) => { const id = S(p?.program_id, 80); return { program_id: ids.has(id) ? id : null, name: S(p?.name, 140), why: S(p?.why, 240) }; }).filter((p: any) => p.name) };
  return b.headline && b.recommendations.length ? b : null;
}
export function localOrgBrief(f: OrgFacts, lang: Lang): OrgBrief {
  const ar = lang === 'ar'; const k = f.kpis; const hl: string[] = []; const gaps: string[] = []; const recs: string[] = [];
  hl.push(ar ? `${k.learners} متدربًا مقبولًا من ${k.members} منسوبًا في ${k.programs} برنامجًا.` : `${k.learners} accepted learners of ${k.members} members in ${k.programs} programs.`);
  if (k.attendance !== null) hl.push(ar ? `نسبة الحضور ${k.attendance}%.` : `Attendance ${k.attendance}%.`);
  if (k.credentials) hl.push(ar ? `${k.credentials} شهادة رقمية قابلة للتحقق.` : `${k.credentials} verifiable credentials.`);
  const topS = [...f.skills].sort((a, b) => b.people - a.people)[0]; if (topS) hl.push(ar ? `أكثر المهارات انتشارًا: ${topS.name} (${topS.people} منسوبًا، متوسط ${topS.avg}/5).` : `Most common skill: ${topS.name} (${topS.people} people, avg ${topS.avg}/5).`);
  const low = [...f.skills].filter(s => s.avg < 3).sort((a, b) => a.avg - b.avg).slice(0, 3); for (const s of low) gaps.push(ar ? `${s.name}: متوسط ${s.avg}/5 — دون مستوى الإتقان.` : `${s.name}: avg ${s.avg}/5 — below mastery.`);
  if (k.pending) gaps.push(ar ? `${k.pending} منسوبًا بانتظار التأكيد — لا تظهر بياناتهم في اللوحة.` : `${k.pending} members pending confirmation.`);
  if (k.members && k.learners / Math.max(1, k.members) < 0.5) gaps.push(ar ? 'أقل من نصف المنسوبين التحقوا ببرنامج.' : 'Fewer than half of members enrolled in a program.');
  if (!gaps.length) gaps.push(ar ? 'لا فجوات بارزة بالبيانات الحالية — وسّعوا القياس (قبلي/بعدي ونقل أثر).' : 'No major gaps in current data — widen measurement.');
  if (k.pending) recs.push(ar ? 'أكّدوا الأعضاء المعلّقين من تبويب المنسوبين.' : 'Confirm pending members.');
  if (k.attendance !== null && k.attendance < 75) recs.push(ar ? 'اطلبوا من المنسوبين تفعيل تذكيرات الجلسات، وتابعوا الغياب المتكرر.' : 'Ask members to enable session reminders; follow up on absences.');
  recs.push(ar ? 'أرسلوا طلب تسجيل جماعي للمنسوبين الذين لم يلتحقوا بعد.' : 'Send a bulk enrollment request for members not yet enrolled.');
  recs.push(ar ? 'اطلبوا تقرير الأثر الفصلي للجهة (Excel/PDF) لمجلس الإدارة.' : 'Request the quarterly impact report (Excel/PDF) for the board.');
  const lowNames = new Set(low.map(s => s.name)); const sug = f.offers.filter(o => o.skills.some(s => lowNames.has(s))).slice(0, 2).map(o => ({ program_id: o.id, name: o.name, why: ar ? 'يستهدف مهارة متوسطها منخفض في الجهة.' : 'Targets a low-average skill in your organization.' }));
  if (!sug.length && f.offers[0]) sug.push({ program_id: f.offers[0].id, name: f.offers[0].name, why: ar ? 'البرنامج المفتوح الأقرب لقطاع الجهة.' : 'Nearest open program to your sector.' });
  return { headline: ar ? `أثر التدريب في ${f.org}: ${k.learners} متدربًا و${k.credentials} شهادة` : `Training impact at ${f.org}: ${k.learners} learners, ${k.credentials} credentials`, highlights: hl.slice(0, 4), gaps: gaps.slice(0, 4), recommendations: recs.slice(0, 5), suggested_programs: sug };
}

// ================================================================ 4) مسودّات أنشطة للمدرب
export type ActivityFacts = {
  session: { title: string; description: string; kind: string; program: string | null; level: string | null };
  skills: { id: string; name: string; domain: string }[];
  existing: string[];
  want: { kind: 'mcq' | 'reflection' | 'self_rating'; count: number; skill_id: string | null };
};
export type ActivityItem = { kind: 'mcq' | 'reflection' | 'self_rating'; prompt_ar: string; prompt_en: string; options: string[]; correct: number; skill_id: string | null; rationale: string };
export type ActivityDraft = { items: ActivityItem[] };
export function buildActivityPrompt(f: ActivityFacts, lang: Lang): { system: string; user: string } {
  const system = systemBase(lang, lang === 'ar' ? 'مصمم تعليمي يقترح أنشطة تقويم قصيرة لجلسة تدريبية، يراجعها المدرب ويعدّلها قبل النشر' : 'an instructional designer proposing short assessment activities for a training session, to be reviewed by the trainer');
  const schema = `{"items": [{"kind": "${f.want.kind}", "prompt_ar": string, "prompt_en": string, "options": string[4] (لـ mcq فقط وإلا []), "correct": number (فهرس 0-3 لـ mcq وإلا 0), "skill_id": string|null (من skills فقط), "rationale": string (≤ 120)}] (${f.want.count})}`;
  const user = `${lang === 'ar' ? 'الجلسة والمهارات والأنشطة الموجودة (JSON):' : 'Session, skills and existing activities (JSON):'}\n${JSON.stringify(f)}\n\n${lang === 'ar' ? `المطلوب: ${f.want.count} نشاطًا من نوع ${f.want.kind} مرتبطًا بمحتوى الجلسة ومهاراتها، مختلفًا عن الأنشطة الموجودة. mcq: سؤال تطبيقي بأربعة خيارات متقاربة وإجابة صحيحة واحدة. reflection: سؤال تأملي يربط التعلّم بالتطبيق في العمل. self_rating: عبارة تقييم ذاتي لمهارة محددة. المخطط:` : `Task: ${f.want.count} ${f.want.kind} activities tied to the session content and skills, different from existing ones. Schema:`}\n${schema}`;
  return { system, user };
}
export function parseActivityDraft(raw: any, f: ActivityFacts): ActivityDraft | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || !Array.isArray(j.items)) return null; const ids = new Set(f.skills.map(s => s.id));
  const items: ActivityItem[] = j.items.slice(0, 6).map((it: any) => {
    const kind = f.want.kind; const options = kind === 'mcq' ? arr(it?.options, 4, 160) : []; const correct = kind === 'mcq' ? Math.min(3, Math.max(0, Math.round(N(it?.correct) ?? 0))) : 0; const sk = S(it?.skill_id, 80);
    return { kind, prompt_ar: S(it?.prompt_ar, 400), prompt_en: S(it?.prompt_en, 400), options, correct, skill_id: ids.has(sk) ? sk : (f.want.skill_id && ids.has(f.want.skill_id) ? f.want.skill_id : null), rationale: S(it?.rationale, 160) };
  }).filter((it: ActivityItem) => it.prompt_ar && (it.kind !== 'mcq' || it.options.length === 4));
  return items.length ? { items } : null;
}
export function localActivityDraft(f: ActivityFacts, lang: Lang): ActivityDraft {
  const ar = lang === 'ar'; const title = f.session.title || (ar ? 'الجلسة' : 'the session'); const sk = f.skills.find(s => s.id === f.want.skill_id) || f.skills[0] || null; const skName = sk?.name || (ar ? 'المهارة المستهدفة' : 'the target skill');
  const mk = (i: number): ActivityItem => {
    if (f.want.kind === 'mcq') return { kind: 'mcq', prompt_ar: [`ما الخطوة الأولى الصحيحة عند تطبيق ما تعلّمته في «${title}» في عملك؟`, `أي الممارسات التالية تعكس إتقان ${skName}؟`, `في موقف عملي من «${title}»، ما القرار الأنسب؟`][i % 3], prompt_en: ['What is the correct first step when applying this session at work?', `Which practice reflects mastery of ${skName}?`, 'In a practical situation from this session, what is the best decision?'][i % 3], options: ar ? ['تحديد الهدف والمعيار قبل التنفيذ', 'البدء بالتنفيذ ثم القياس لاحقًا', 'الاعتماد على الانطباع العام', 'تأجيل التطبيق حتى اكتمال البرنامج'] : ['Define the goal and criterion first', 'Execute first, measure later', 'Rely on general impression', 'Postpone until the program ends'], correct: 0, skill_id: sk?.id || null, rationale: ar ? 'مسودّة محلية — عدّل الخيارات لتطابق محتوى الجلسة.' : 'Local draft — adjust options to the session content.' };
    if (f.want.kind === 'reflection') return { kind: 'reflection', prompt_ar: [`ما أهم فكرة خرجت بها من «${title}»؟ وكيف ستطبّقها خلال الأسبوع القادم، وما الدليل الذي سيُظهر أنك طبّقتها؟`, `صِف موقفًا من عملك يمكن أن يتحسّن بتطبيق ${skName}. ما أول خطوة ستتخذها؟`][i % 2], prompt_en: ['What is your key takeaway and how will you apply it next week? What evidence will show it?', `Describe a work situation that would improve by applying ${skName}. First step?`][i % 2], options: [], correct: 0, skill_id: sk?.id || null, rationale: ar ? 'يربط التعلّم بنقل الأثر إلى العمل.' : 'Links learning to transfer.' };
    return { kind: 'self_rating', prompt_ar: `قيّم تمكّنك من «${skName}» بعد «${title}» — من 1 (أحتاج دعمًا) إلى 5 (أستطيع تدريب غيري).`, prompt_en: `Rate your mastery of “${skName}” after this session — 1 (need support) to 5 (can coach others).`, options: [], correct: 0, skill_id: sk?.id || null, rationale: ar ? 'تقييم ذاتي يُقارن لاحقًا بالأدلة الأخرى.' : 'Self-rating compared later with other evidence.' };
  };
  return { items: Array.from({ length: Math.min(5, Math.max(1, f.want.count)) }, (_, i) => mk(i)) };
}

// ================================================================ 5) المحاكاة — شخصية ودور (P10)
export function buildSimTurnPrompt(s: Scenario, turns: Turn[], lang: Lang): { system: string; user: string } {
  const p = s.persona; const n = turns.filter(t => t.role === 'learner').length; const last = n >= s.max_turns;
  const system = `أنت تمثّل شخصية في محاكاة تدريبية داخل بوابة «أَثَر». الشخصية: ${p.name} — ${p.role}. سماتها: ${p.traits.join('، ')}.
الموقف: ${s.situation_ar}
قواعد صارمة: (1) ابقَ في الشخصية تمامًا ولا تخرج منها ولا تشرح ولا تقيّم. (2) تحدّث كما يتحدث هذا الشخص فعلًا (${p.voice === 'child' ? 'طفل: جمل قصيرة، عفوية، عامية خفيفة مفهومة' : 'بالغ: عربية مفهومة بلمسة عامية خليجية خفيفة'}). (3) ردّك 1–3 جمل فقط. (4) استجب بواقعية لما يفعله المتعلم: إن أحسن تجاوب تدريجيًا، وإن أخطأ أو كان عامًا أظهر أثر ذلك دون تلقين. (5) لا تحلّ المشكلة بدلًا عنه. (6) أعد JSON فقط: {"reply": string}.${last ? ' (7) هذا آخر دور: اختم الموقف بشكل طبيعي.' : ''}`;
  const user = `الحوار حتى الآن:\n${turns.map(t => `${t.role === 'persona' ? p.name : 'المتعلم'}: ${t.text}`).join('\n')}\n\nردّ ${p.name} الآن (JSON فقط).`;
  return { system, user };
}
export function parseSimTurn(raw: any): string | null { const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; const r = S(j?.reply, 400); return r || null; }

export function buildSimScorePrompt(s: Scenario, turns: Turn[], lang: Lang): { system: string; user: string } {
  const system = systemBase(lang, 'مقيّم أداء مهني يحكم على حوار محاكاة وفق معيار معلن، بإنصاف وتحديد، ويكتب ملاحظات يمكن للمتعلم تطبيقها فورًا');
  const schema = `{"criteria":[{"key": string (من المعيار فقط), "score": number 0-100, "note": string (≤ 160 حرفًا، تذكر ما قاله المتعلم حرفيًا)}], "strengths": string[1-3], "improve": string[1-3], "expert_path": string (كيف كان سيتصرف خبير في 2–3 جمل), "closing_ar": string (جملة تشجيع صادقة)}`;
  const user = `الهدف: ${s.goal_ar}\nالمعيار: ${JSON.stringify(s.rubric)}\nالحوار:\n${turns.map(t => `${t.role === 'persona' ? s.persona.name : 'المتعلم'}: ${t.text}`).join('\n')}\n\nقيّم أداء المتعلم فقط (لا الشخصية). لا تُكافئ الطول ولا الكلام العام. المخطط:\n${schema}`;
  return { system, user };
}

// ================================================================ 6) كل يوم مهارة (P10)
export type DailyLesson = { title_ar: string; hook_ar: string; idea_ar: string; example_ar: string; challenge: { question_ar: string; options: string[]; correct: number; explain_ar: string }; apply_ar: string };
export type DailySkillFacts = { skill: { id: string; code: string; name_ar: string; name_en?: string | null; domain: string; description_ar?: string | null }; day: string; weekday_ar: string };
export function buildDailyPrompt(f: DailySkillFacts, lang: Lang): { system: string; user: string } {
  const system = systemBase(lang, 'مصمم تعلّم مصغّر يكتب درس «كل يوم مهارة»: ثلاث دقائق قراءة، فكرة واحدة عميقة، مثال من واقع المعلمين والمدربين العرب، وتحدٍّ من سؤال واحد');
  const schema = `{"title_ar": string (≤ 60), "hook_ar": string (جملة تشويق تبدأ بموقف حقيقي), "idea_ar": string (3–4 جمل: الفكرة الجوهرية ولماذا تعمل), "example_ar": string (مثال ملموس خطوة بخطوة), "challenge": {"question_ar": string (موقف قصير يتطلب حكمًا), "options": string[4] (متقاربة ومعقولة), "correct": number (0-3), "explain_ar": string (لماذا هذا الخيار، ولماذا الأقرب خطأ)}, "apply_ar": string (إجراء واحد يُنفَّذ اليوم خلال 10 دقائق)}`;
  const user = `المهارة: ${f.skill.code} — ${f.skill.name_ar}${f.skill.description_ar ? ` — ${f.skill.description_ar}` : ''} (المجال: ${f.skill.domain}). اليوم: ${f.weekday_ar} ${f.day}.\nالمطلوب: درس اليوم. تجنّب العموميات والمواعظ؛ ركّز على فكرة واحدة قابلة للتطبيق. المخطط:\n${schema}`;
  return { system, user };
}
export function parseDaily(raw: any): DailyLesson | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object' || !j.challenge) return null;
  const options = arr(j.challenge.options, 4, 200); const correct = Math.min(3, Math.max(0, Math.round(N(j.challenge.correct) ?? 0)));
  const d: DailyLesson = { title_ar: S(j.title_ar, 80), hook_ar: S(j.hook_ar, 300), idea_ar: S(j.idea_ar, 900), example_ar: S(j.example_ar, 900), challenge: { question_ar: S(j.challenge.question_ar, 400), options, correct, explain_ar: S(j.challenge.explain_ar, 500) }, apply_ar: S(j.apply_ar, 300) };
  return d.title_ar && d.idea_ar && options.length === 4 && d.challenge.question_ar ? d : null;
}
export function localDaily(f: DailySkillFacts): DailyLesson {
  const n = f.skill.name_ar;
  return {
    title_ar: `${n}: ابدأ بالنتيجة لا بالنشاط`, hook_ar: `في آخر مرة خططت فيها لجلسة حول «${n}»، هل بدأت بما سيفعله المتعلم… أم بما ستقوله أنت؟`,
    idea_ar: `الفكرة الجوهرية: صِف السلوك الذي تريد رؤيته في نهاية الجلسة بجملة يمكن ملاحظتها، ثم صمّم النشاط عكسيًا. هذا يحوّل «${n}» من معرفة تُشرح إلى قدرة تُمارَس، ويجعل التقويم جزءًا من التصميم لا ملحقًا به. الأدلة تُظهر أن التصميم العكسي يرفع نقل الأثر لأن كل دقيقة تخدم السلوك المستهدف.`,
    example_ar: `بدل «سأشرح ${n}»: اكتب «سيُنتج المتعلم مثالًا واحدًا صحيحًا ويشرح لماذا هو صحيح». ثم: (1) مثال نموذجي منك، (2) محاولة ثنائية، (3) إنتاج فردي يُعرض في الدردشة، (4) تغذية راجعة على محاولة واحدة أمام الجميع.`,
    challenge: { question_ar: `معلم يريد تنمية «${n}». أي صياغة هدف تمكّنه من قياس الأثر في نهاية الجلسة؟`, options: ['أن يتعرف المتعلم على مفهوم المهارة وأهميتها', 'أن يُنتج المتعلم مثالًا صحيحًا ويبرّر صحته أمام زميل', 'أن يستمع المتعلم إلى شرح وافٍ مع أمثلة', 'أن يناقش المتعلم أهمية المهارة في عمله'], correct: 1, explain_ar: 'الخيار الثاني يصف سلوكًا قابلًا للملاحظة (يُنتج ويبرّر)؛ أما «يتعرف» و«يستمع» و«يناقش» فأفعال لا يمكن التحقق منها مباشرة.' },
    apply_ar: `خذ جلستك القادمة واكتب هدفها بصيغة «سيفعل المتعلم…» خلال 10 دقائق، ثم احذف أي نشاط لا يخدم هذا الفعل.`,
  };
}

// ================================================================ 7) مستشارك: اسأل وأنا أجيب (P10)
export type AdvisorFacts = { services: { title: string; href: string; summary: string }[]; programs: { id: string; name: string; fee?: number | null; start?: string | null; open: boolean; delivery?: string | null }[]; sessions: { id: string; title: string; when: string; free: boolean }[]; resources: number; contact: { email: string; phone: string }; profile?: { name?: string; skills: { name: string; level: number }[]; enrollments: string[] } | null };
export type AdvisorAnswer = { answer_ar: string; links: { label: string; href: string }[]; handoff: boolean; confidence: number };
export function buildAdvisorPrompt(q: string, f: AdvisorFacts, lang: Lang, persona: 'advisor' | 'companion' = 'advisor'): { system: string; user: string } {
  const role = persona === 'companion'
    ? 'أنت «أثير»، المدرب الرفيق في أَثَر: صوت دافئ، مباشر، يعرف ملف المتعلم ويشجّعه بصدق دون مبالغة، ويقترح خطوة واحدة واضحة'
    : 'أنت «مستشارك» في بوابة أَثَر: ترد على أسئلة الزوار عن الخدمات والبرامج والتعلّم بوضوح وأمانة، وتعرف متى تحوّل السؤال إلى مستشار بشري';
  const system = systemBase(lang, role) + `\nقواعد إضافية: أجب في 2–5 جمل بالعربية الواضحة. اذكر برامج/جلسات/روابط من الحقائق فقط. إن كان السؤال شخصيًا معقدًا (تعاقد، سعر خاص، شكوى، حالة طبية/قانونية) أو خارج نطاق أَثَر فاجعل handoff=true واشرح أنك ستحوّله لمستشار بشري. لا تعد بما ليس في الحقائق. أعد JSON: {"answer_ar": string, "links": [{"label": string, "href": string (من الحقائق فقط)}] (0-3), "handoff": boolean, "confidence": number 0-1}`;
  const user = `الحقائق (JSON):\n${JSON.stringify(f)}\n\nالسؤال: ${q}`;
  return { system, user };
}
export function parseAdvisor(raw: any, f: AdvisorFacts): AdvisorAnswer | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null; const a = S(j.answer_ar, 1200); if (!a) return null;
  const allowed = new Set<string>([...f.services.map(s => s.href), ...f.programs.map(p => `/programs/${p.id}`), ...f.sessions.map(s => `/live/${s.id}`), '/programs', '/live', '/resources', '/consulting', '/contact', '/sim', '/me', '/me/skills', '/me/twin', '/me/missions', '/verify', '/org', '/ai']);
  const links = (Array.isArray(j.links) ? j.links : []).map((l: any) => ({ label: S(l?.label, 60), href: S(l?.href, 120) })).filter((l: any) => l.label && allowed.has(l.href)).slice(0, 3);
  return { answer_ar: a, links, handoff: !!j.handoff, confidence: Math.max(0, Math.min(1, N(j.confidence) ?? 0.6)) };
}
export function localAdvisor(q: string, f: AdvisorFacts): AdvisorAnswer {
  const t = q.toLowerCase(); const has = (...w: string[]) => w.some(x => t.includes(x)); const open = f.programs.filter(p => p.open);
  if (has('سعر', 'رسوم', 'تكلفة', 'بكم', 'كم ال', 'price', 'fee', 'cost')) { const withFee = open.filter(p => p.fee); return { answer_ar: withFee.length ? `الرسوم تختلف بحسب البرنامج: ${withFee.slice(0, 3).map(p => `«${p.name}» ${p.fee} ر.س`).join('، ')}. للجهات والمجموعات أسعار تعاقدية — أحوّلك لمستشار بشري إن أردت عرضًا.` : 'الرسوم تُعلن في صفحة كل برنامج، وللجهات أسعار تعاقدية. أرسل تفاصيلك وسيتواصل معك مستشار.', links: withFee.slice(0, 2).map(p => ({ label: p.name, href: `/programs/${p.id}` })).concat([{ label: 'كل البرامج', href: '/programs' }]), handoff: !withFee.length, confidence: 0.6 }; }
  if (has('برنامج', 'برامج', 'دورة', 'دورات', 'دبلوم', 'تسجيل', 'سجل', 'مفتوح', 'program', 'course', 'enrol')) return { answer_ar: open.length ? `المفتوح للتسجيل الآن: ${open.slice(0, 3).map(p => `«${p.name}»${p.start ? ` (يبدأ ${p.start})` : ''}`).join('، ')}. التسجيل من صفحة البرنامج، ويبدأ ملفك المهاري بالتشكّل من أول نشاط.` : 'لا برامج مفتوحة للتسجيل في هذه اللحظة؛ اشترك في التنبيهات من صفحة البرامج وسنخبرك فور فتح باب التسجيل.', links: open.slice(0, 2).map(p => ({ label: p.name, href: `/programs/${p.id}` })).concat([{ label: 'كل البرامج', href: '/programs' }]), handoff: false, confidence: 0.7 };
  if (has('جلسة', 'ندوة', 'بث', 'مباشر', 'ورشة', 'webinar', 'live')) return { answer_ar: f.sessions.length ? `أقرب الجلسات: ${f.sessions.slice(0, 3).map(s => `«${s.title}» ${s.when}${s.free ? ' (مجانية)' : ''}`).join('، ')}. التسجيل بضغطة من صفحة الجلسة وتصلك تذكيرات تلقائية.` : 'لا جلسات قادمة معلنة الآن؛ تابع صفحة البث المباشر.', links: f.sessions.slice(0, 2).map(s => ({ label: s.title, href: `/live/${s.id}` })).concat([{ label: 'البث المباشر', href: '/live' }]), handoff: false, confidence: 0.7 };
  if (has('شهادة', 'تحقق', 'certificate', 'verify')) return { answer_ar: 'شهادات أَثَر رقمية قابلة للتحقق لحظيًا برمز أو QR وفق معيار Open Badges 3.0، ومرتبطة بالمهارات المُثبتة في ملفك المهاري.', links: [{ label: 'التحقق من شهادة', href: '/verify' }, { label: 'ملفي المهاري', href: '/me/skills' }], handoff: false, confidence: 0.8 };
  if (has('استشار', 'جهة', 'شركة', 'مؤسسة', 'موظفين', 'تعاقد', 'consult')) return { answer_ar: 'نقدّم للجهات: تحليل احتياج، تصميم برامج بمخرجات قابلة للقياس، قياس أثر قبل/أثناء/بعد، وبوابة خاصة ترى فيها الجهة أثر التدريب على منسوبيها. سأحوّل طلبك إلى مستشار بشري ليتواصل معك خلال يوم عمل.', links: [{ label: 'الاستشارات', href: '/consulting' }, { label: 'بوابة الجهات', href: '/org' }], handoff: true, confidence: 0.7 };
  if (has('محاكاة', 'تجربة', 'جرب', 'أثير', 'sim')) return { answer_ar: 'جرّب محاكاة الأداء الآن: تتقمّص دور معلم أمام طالب حقيقي الملامح، وتحصل على تقييم بمعيار معلن — بلا تسجيل للتجربة الأولى.', links: [{ label: 'المحاكيات', href: '/sim' }], handoff: false, confidence: 0.8 };
  return { answer_ar: `شكرًا لسؤالك. أَثَر بوابة تجمع ${f.services.slice(0, 3).map(s => s.title).join('، ')} وغيرها، ويحكمها قياس حقيقي للأثر. أخبرني بما تريد تحقيقه بالضبط (تعلّم العربية؟ برنامج لجهة؟ شهادة؟) أو اترك بريدك ليجيبك مستشار بشري.`, links: [{ label: 'الخدمات', href: '/programs' }, { label: 'تواصل', href: '/contact' }], handoff: false, confidence: 0.4 };
}

// ================================================================ 8) أثير — تحية مبادِرة وذاكرة (P10)
export type CompanionContext = { name: string; visits: number; last_seen_days: number | null; goals: string[]; summary: string; weakest: { name: string; level: number; days_since: number | null } | null; strongest: { name: string; level: number } | null; daily_done: boolean; next_session: { title: string; when: string; id: string } | null; page: string; hour: number };
export type CompanionHello = { greeting: string; nudge: string; actions: { label: string; href: string }[] };
export function localHello(c: CompanionContext): CompanionHello {
  const first = c.name ? c.name.split(' ')[0] : ''; const time = c.hour < 12 ? 'صباح الخير' : c.hour < 17 ? 'مساء الخير' : 'مساء النور';
  const greeting = c.visits <= 1 ? `${time}${first ? ` يا ${first}` : ''}! أنا أثير — رفيقك في أَثَر. سأتعلم معك خطوة خطوة، وأذكّرك حين تصدأ مهارة، وأضعك في مواقف حقيقية لتتدرب بأمان.` : `${time}${first ? ` يا ${first}` : ''}، سعيد بعودتك${c.last_seen_days && c.last_seen_days > 6 ? ` بعد ${c.last_seen_days} يومًا` : ''}.`;
  let nudge = ''; const actions: { label: string; href: string }[] = [];
  if (c.weakest && c.weakest.days_since !== null && c.weakest.days_since > 14) { nudge = `لاحظت أن «${c.weakest.name}» لم تُمارَس منذ ${c.weakest.days_since} يومًا ومستواها ${c.weakest.level}/5 — خمس دقائق في محاكاة تكفي لإنعاشها.`; actions.push({ label: 'ابدأ محاكاة', href: '/sim' }); }
  else if (!c.daily_done) { nudge = 'مهارة اليوم جاهزة — ثلاث دقائق قراءة وسؤال واحد، وتُضاف دليلًا في ملفك.'; actions.push({ label: 'مهارة اليوم', href: '/#daily' }); }
  else if (c.next_session) { nudge = `جلستك القادمة «${c.next_session.title}» ${c.next_session.when}. هل تريد أن أجهّز لك ثلاثة أسئلة قبلها؟`; actions.push({ label: 'الجلسة', href: `/live/${c.next_session.id}` }); }
  else if (c.goals.length) { nudge = `هدفك: «${c.goals[0]}». ${c.strongest ? `قوتك اليوم في «${c.strongest.name}» (${c.strongest.level}/5).` : ''} ما رأيك بخطوة واحدة نحوه اليوم؟`; actions.push({ label: 'خطتي', href: '/me/skills' }); }
  else { nudge = 'أخبرني بهدف واحد تريد تحقيقه هذا الشهر، وسأبني عليه كل ما أقترحه لك.'; }
  if (!actions.some(a => a.href === '/sim')) actions.push({ label: 'جرّب محاكاة', href: '/sim' });
  if (!actions.some(a => a.href === '/me/skills')) actions.push({ label: 'ملفي المهاري', href: '/me/skills' });
  if (c.weakest && (c.weakest.days_since ?? 0) >= 30 && !actions.some(a => a.href === '/me/twin')) actions.unshift({ label: 'متى تصدأ مهاراتي؟', href: '/me/twin' });
  return { greeting, nudge, actions: actions.slice(0, 3) };
}
export function buildHelloPrompt(c: CompanionContext): { system: string; user: string } {
  const system = systemBase('ar', 'أنت «أثير» المدرب الرفيق: تحية شخصية قصيرة ثم دفعة واحدة مبادِرة مبنية على الحقائق (لا أكثر من دفعة)، بلغة دافئة غير مبالغ فيها') + `\nأعد JSON: {"greeting": string (≤ 160), "nudge": string (≤ 220, تذكر رقمًا أو اسمًا من الحقائق), "actions": [{"label": string, "href": string (من: /sim, /me/skills, /#daily, /live/<id>, /programs)}] (1-3)}`;
  return { system, user: `حقائق المتعلم: ${JSON.stringify(c)}` };
}
export function parseHello(raw: any): CompanionHello | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || !S(j.greeting)) return null;
  const ok = (h: string) => ['/sim', '/me/skills', '/me/twin', '/me/missions', '/#daily', '/programs'].includes(h) || /^\/live\/[\w-]+$/.test(h);
  return { greeting: S(j.greeting, 200), nudge: S(j.nudge, 260), actions: (Array.isArray(j.actions) ? j.actions : []).map((a: any) => ({ label: S(a?.label, 40), href: S(a?.href, 80) })).filter((a: any) => a.label && ok(a.href)).slice(0, 3) };
}
export function buildMemoryPrompt(prev: string, history: { role: string; text: string }[]): { system: string; user: string } {
  const system = systemBase('ar', 'كاتب ذاكرة موجزة لمساعد تعلّم: تلخّص ما يهم مستقبلًا فقط (أهداف، تفضيلات، صعوبات، التزامات) في ≤ 400 حرف، بلا بيانات حساسة ولا اقتباسات حرفية') + '\nأعد JSON: {"summary": string}';
  return { system, user: `الذاكرة السابقة: ${prev || '(فارغة)'}\nالمحادثة الأخيرة:\n${history.map(h => `${h.role}: ${h.text}`).join('\n')}` };
}
export function parseMemory(raw: any): string | null { const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; const v = S(j?.summary, 400); return v || null; }

// ================================================================ P14-أ) قاعدة الأدلة المؤسسية — توجيه السؤال إلى قالب معتمد (لا SQL حرّ)
export type EvidencePick = { template: string; skill?: string | null; sector?: string | null; org?: string | null; program?: string | null; year?: number | null };
export function buildEvidenceRoutePrompt(question: string, templates: { id: string; title_ar: string; example_ar: string; needs?: string[] }[], entities: { skills: { id: string; name: string }[]; sectors: { code: string; name: string }[]; orgs: { id: string; name: string }[]; programs: { id: string; name: string }[] }): { system: string; user: string } {
  const system = systemBase('ar', 'موجّه أسئلة لقاعدة أدلة مؤسسية: تختار قالب السؤال الأنسب من قائمة مغلقة وتستخرج معاملاته من قوائم الكيانات المُمرَّرة فقط. لا تكتب استعلامات ولا أرقامًا ولا تجب عن السؤال نفسه.') + '\nأعد JSON فقط: {"template":"<id من القائمة>","skill":"<id أو null>","sector":"<code أو null>","org":"<id أو null>","program":"<id أو null>","year":<سنة أو null>}';
  const user = `السؤال: ${S(question, 400)}\nالقوالب:\n${templates.map(t => `- ${t.id}: ${t.title_ar} (مثال: ${t.example_ar})${t.needs?.length ? ` [يحتاج: ${t.needs.join('،')}]` : ''}`).join('\n')}\nالمهارات: ${entities.skills.slice(0, 80).map(x => `${x.id}=${x.name}`).join(' | ')}\nالقطاعات: ${entities.sectors.map(x => `${x.code}=${x.name}`).join(' | ')}\nالجهات: ${entities.orgs.slice(0, 60).map(x => `${x.id}=${x.name}`).join(' | ')}\nالبرامج: ${entities.programs.slice(0, 60).map(x => `${x.id}=${x.name}`).join(' | ')}`;
  return { system, user };
}
export function parseEvidencePick(raw: any, allowed: string[]): EvidencePick | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null; const t = S(j.template, 60); if (!allowed.includes(t)) return null;
  const id = (v: unknown) => { const x = S(v, 80); return x && x !== 'null' ? x : null; }; const y = N(j.year);
  return { template: t, skill: id(j.skill), sector: id(j.sector), org: id(j.org), program: id(j.program), year: y && y >= 2020 && y <= 2049 ? y : null };
}
