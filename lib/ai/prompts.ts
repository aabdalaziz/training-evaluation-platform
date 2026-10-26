// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — طبقة الذكاء الاصطناعي المسؤول (P9-أ): المطالبات، التحليل، والبدائل المحلية — دوال نقية (بلا شبكة/بيئة) قابلة للاختبار
 *  الأغراض الأربعة: impact_brief (موجز تنفيذي لتقرير الأثر) · learner_plan (خطة تطوير شخصية) · org_brief (توصيات للجهة) · activity_draft (مسودّات أنشطة للمدرب)
 *  مبادئ الحوكمة المضمّنة في كل مطالبة: لا اختلاق، الاعتماد على الحقائق المُمرَّرة فقط، تمييز عدم اليقين، لا قرار نهائي بشأن أشخاص، الإنسان يعتمد.
 */
import type { Lang } from '../portal/content';

export type AiPurpose = 'impact_brief' | 'learner_plan' | 'org_brief' | 'activity_draft';
/** حدود الاستخدام لكل مستخدم خلال 24 ساعة */
export const AI_LIMITS: Record<AiPurpose, number> = { impact_brief: 30, learner_plan: 6, org_brief: 12, activity_draft: 40 };
export const AI_PURPOSE_LABEL: Record<AiPurpose, { ar: string; en: string }> = {
  impact_brief: { ar: 'موجز تنفيذي لتقرير الأثر', en: 'Impact executive brief' },
  learner_plan: { ar: 'خطة تطوير شخصية', en: 'Personal development plan' },
  org_brief: { ar: 'توصيات للجهة', en: 'Organization recommendations' },
  activity_draft: { ar: 'مسودّات أنشطة للمدرب', en: 'Trainer activity drafts' },
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
