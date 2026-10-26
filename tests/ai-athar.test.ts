// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P9-أ: طبقة الذكاء الاصطناعي المسؤول — تحليل JSON المرن، تنقية الحقائق، المطالبات، التحليل الآمن (لا روابط مختلقة)، البدائل المحلية، الحدود، التشغيل بلا مفتاح
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonLoose, AI_LIMITS, AI_PURPOSE_LABEL, AI_DISCLAIMER, sanitizeImpactFacts, buildImpactPrompt, parseImpactBrief, localImpactBrief, buildLearnerPrompt, parseLearnerPlan, localLearnerPlan, buildOrgPrompt, parseOrgBrief, localOrgBrief, buildActivityPrompt, parseActivityDraft, localActivityDraft } from '../lib/ai/prompts';
import type { ImpactFacts, LearnerFacts, OrgFacts, ActivityFacts } from '../lib/ai/prompts';
import { runAi, aiStatus } from '../lib/ai/athar';
import { BRAND } from '../lib/portal/content';

const IMPACT: ImpactFacts = {
  scope: 'قطاع التدريب', period: '2026-01-01 → 2026-11-25',
  totals: { programs: 2, learners: 40, orgs: 3, hours: 1200, credentials: 12, skillsProven: 30, skillsApproved: 10, attendanceRate: 82, satisfactionMean: 4.4, satisfactionN: 25, pre: 58.3, post: 76.1, improvement: 30.5, transferMean: null, transferN: 0, placements: 5, events: 90 },
  programs: [{ name: 'برنامج الانغماس', learners: 30, attendance: 85, satisfaction: 4.5, improvement: 30.5, sector: 'training' }, { name: 'دبلوم المعلمين', learners: 10, attendance: 70, satisfaction: null, improvement: null }],
  skills: [{ name: 'S01 تصميم الأنشطة', learners: 20, avg: 3.2 }], sectors: [{ name: 'التدريب', learners: 40 }], orgs: [{ name: 'جامعة أ', learners: 25, attendance: null }],
};
const LEARNER: LearnerFacts = {
  name: 'سارة', goal: 'أدرّب زملائي',
  skills: [{ id: 's1', name: 'تصميم الأنشطة', domain: 'pedagogy', level: 2, approved: false, confidence: 40 }, { id: 's2', name: 'التقويم', domain: 'assessment', level: 4, approved: true, confidence: 80 }],
  credentials: [{ title: 'حضور ندوة', kind: 'attendance' }], enrollments: [{ program: 'دبلوم المعلمين', status: 'approved' }], placement: 'B1',
  programs: [{ id: 'p1', name: 'برنامج الانغماس', level: 'A1', skills: ['s1'], fee: 1500 }, { id: 'p3', name: 'دبلوم المعلمين', level: 'B2', skills: ['s2'], fee: 3000 }],
  resources: [{ id: 'r1', title: 'حقيبة تصميم الأنشطة', type: 'guide', skills: ['s1'] }], sessions: [{ id: 'l1', title: 'ورشة الأنشطة', when: '2026-12-01T18:00', skills: ['s1'] }],
};
const ORG: OrgFacts = {
  org: 'جامعة أ', sector: 'edu_higher', kpis: { members: 20, pending: 3, learners: 8, programs: 2, attendance: 68, credentials: 4, placements: 2 },
  skills: [{ name: 'تصميم الأنشطة', domain: 'pedagogy', people: 6, avg: 2.4 }, { name: 'التقويم', domain: 'assessment', people: 5, avg: 3.8 }],
  programs: [{ name: 'دبلوم المعلمين', learners: 8, attendance: 68 }], requests: [{ program: 'دبلوم المعلمين', status: 'new', people: 5 }],
  offers: [{ id: 'p1', name: 'برنامج الانغماس', skills: ['تصميم الأنشطة'] }, { id: 'p9', name: 'برنامج القيادة', skills: ['القيادة'] }],
};
const ACT: ActivityFacts = { session: { title: 'الوحدة 3: تصميم الأنشطة', description: 'تخطيط النشاط الصفي وفق الأهداف', kind: 'class', program: 'دبلوم المعلمين', level: 'B2' }, skills: [{ id: 's1', name: 'تصميم الأنشطة', domain: 'pedagogy' }], existing: ['أي العناصر يسبق تصميم النشاط؟'], want: { kind: 'mcq', count: 3, skill_id: 's1' } };

test('P9-أ: parseJsonLoose يتعامل مع الأسوار والنص المحيط ويرفض غير الصالح', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('```json\n{"a":[1,2]}\n```'), { a: [1, 2] });
  assert.deepEqual(parseJsonLoose('النتيجة: {"ok":true} شكرًا'), { ok: true });
  assert.equal(parseJsonLoose('لا يوجد json هنا'), null); assert.equal(parseJsonLoose(''), null);
});

test('P9-أ: الحدود والتسميات والشعار', () => {
  for (const p of ['impact_brief', 'learner_plan', 'org_brief', 'activity_draft'] as const) { assert.ok(AI_LIMITS[p] > 0); assert.ok(AI_PURPOSE_LABEL[p].ar && AI_PURPOSE_LABEL[p].en); }
  assert.ok(AI_LIMITS.learner_plan < AI_LIMITS.activity_draft, 'حد المتعلم أضيق من حد المدرب');
  assert.match(AI_DISCLAIMER.ar, /الذكاء الاصطناعي/); assert.match(BRAND.tagline.ar, /ما بعد الذكاء الاصطناعي/); assert.match(BRAND.motto.en, /Prove impact/);
});

test('P9-أ: تنقية حقائق الأثر تقصّ الأحجام وتحوّل الأنواع', () => {
  assert.equal(sanitizeImpactFacts(null), null); assert.equal(sanitizeImpactFacts({ scope: 'x' }), null);
  const f = sanitizeImpactFacts({ ...IMPACT, totals: { ...IMPACT.totals, learners: '40', attendanceRate: 'abc' }, programs: Array.from({ length: 40 }, (_, i) => ({ name: `p${i}`, learners: i })) })!;
  assert.equal(f.totals.learners, 40); assert.equal(f.totals.attendanceRate, null); assert.equal(f.programs.length, 15);
});

test('P9-أ: مطالبة الأثر تحمل قواعد الحوكمة والحقائق، والتحليل يقبل الصالح ويرفض الناقص', () => {
  const { system, user } = buildImpactPrompt(IMPACT, 'ar');
  assert.match(system, /لا تختلق/); assert.match(system, /JSON/); assert.ok(user.includes('"learners":40')); assert.match(user, /headline/);
  const en = buildImpactPrompt(IMPACT, 'en'); assert.match(en.system, /never invent/);
  const ok = parseImpactBrief('```json\n{"headline":"عنوان","findings":["أ","ب"],"recommendations":["ج"],"risks":[],"next_quarter":["د"]}\n```')!;
  assert.equal(ok.headline, 'عنوان'); assert.deepEqual(ok.findings, ['أ', 'ب']);
  assert.equal(parseImpactBrief('{"headline":"x"}'), null); assert.equal(parseImpactBrief('nope'), null);
  const many = parseImpactBrief({ headline: 'h', findings: Array.from({ length: 20 }, (_, i) => `f${i}`), recommendations: ['r'] })!; assert.equal(many.findings.length, 6);
});

test('P9-أ: البديل المحلي للأثر يذكر الأرقام ويكشف فجوات القياس', () => {
  const b = localImpactBrief(IMPACT, 'ar');
  assert.match(b.headline, /40 متعلمًا/); assert.ok(b.findings.some(x => x.includes('82%'))); assert.ok(b.findings.some(x => x.includes('30.5%')));
  assert.ok(b.risks.some(x => /نقل الأثر/.test(x)), 'غياب نقل الأثر يظهر كمخاطرة'); assert.ok(!b.findings.some(x => /0 متابعة/.test(x)), 'المؤشر الغائب لا يُعرض صفرًا');
  assert.equal(sanitizeImpactFacts({ ...IMPACT, totals: { ...IMPACT.totals, transferMean: null } })!.totals.transferMean, null); assert.ok(b.recommendations.length >= 3); assert.ok(b.next_quarter.length >= 2);
  const e = localImpactBrief(IMPACT, 'en'); assert.match(e.headline, /40 learners/);
});

test('P9-أ: خطة المتعلم — لا روابط مختلقة، وتحويل المعرّفات غير المعروفة إلى practice', () => {
  const { user } = buildLearnerPrompt(LEARNER, 'ar'); assert.match(user, /ref_id/); assert.ok(user.includes('"p1"'));
  const raw = { goal: 'هدف', strengths: ['التقويم'], gaps: ['تصميم الأنشطة'], weekly_hours: 50, message: 'م', steps: [
    { title: 'حقيبة', why: 'لأن', kind: 'resource', ref_id: 'r1', hours: 2 }, { title: 'مختلق', why: 'x', kind: 'program', ref_id: 'p999' }, { title: 'جلسة', why: 'y', kind: 'session', ref_id: 'l1' }, { title: 'تطبيق', why: 'z', kind: 'practice' }] };
  const p = parseLearnerPlan(raw, LEARNER)!;
  assert.equal(p.steps[0].href, '/resources/r1'); assert.equal(p.steps[1].kind, 'practice'); assert.equal(p.steps[1].href, null); assert.equal(p.steps[2].href, '/live/l1'); assert.equal(p.weekly_hours, 20, 'سقف الساعات 20');
  assert.equal(parseLearnerPlan({ goal: 'x' }, LEARNER), null); assert.equal(parseLearnerPlan({ steps: [{ title: '' }] }, LEARNER), null);
});

test('P9-أ: البديل المحلي للمتعلم يستهدف أضعف مهارة ويعرض حقيبة وجلسة وبرنامجًا غير مسجّل فيه', () => {
  const p = localLearnerPlan(LEARNER, 'ar');
  assert.ok(p.gaps[0].includes('تصميم الأنشطة')); assert.ok(p.strengths[0].includes('التقويم'));
  const kinds = p.steps.map(s => s.kind); assert.ok(kinds.includes('resource') && kinds.includes('session') && kinds.includes('program') && kinds.includes('practice'));
  const prog = p.steps.find(s => s.kind === 'program')!; assert.equal(prog.ref_id, 'p1', 'لا يقترح برنامجًا مسجّلًا فيه'); assert.equal(prog.href, '/programs/p1');
  const empty = localLearnerPlan({ ...LEARNER, skills: [], resources: [], sessions: [], programs: [] }, 'en'); assert.ok(empty.steps.length >= 1); assert.match(empty.gaps[0], /Not enough evidence/);
});

test('P9-أ: توصيات الجهة — البرامج المقترحة من العروض فقط، والبديل المحلي يكشف الفجوات', () => {
  const { user, system } = buildOrgPrompt(ORG, 'ar'); assert.match(system, /لا تُصدر أحكامًا/); assert.match(user, /offers/);
  const b = parseOrgBrief({ headline: 'h', highlights: ['a'], gaps: ['g'], recommendations: ['r1', 'r2'], suggested_programs: [{ program_id: 'p1', name: 'الانغماس', why: 'w' }, { program_id: 'zzz', name: 'مختلق', why: 'w' }] }, ORG)!;
  assert.equal(b.suggested_programs[0].program_id, 'p1'); assert.equal(b.suggested_programs[1].program_id, null);
  assert.equal(parseOrgBrief({ headline: 'h', recommendations: [] }, ORG), null);
  const l = localOrgBrief(ORG, 'ar');
  assert.ok(l.gaps.some(x => x.includes('تصميم الأنشطة'))); assert.ok(l.gaps.some(x => x.includes('3 منسوبًا بانتظار'))); assert.ok(l.recommendations.some(x => /التذكيرات|الغياب/.test(x)), 'حضور 68% → توصية تذكيرات');
  assert.equal(l.suggested_programs[0].program_id, 'p1', 'يقترح البرنامج الذي يستهدف المهارة الأضعف');
});

test('P9-أ: مسودّات الأنشطة — mcq بأربعة خيارات فقط، المهارة من قائمة الجلسة، والبديل المحلي لكل الأنواع', () => {
  const { user } = buildActivityPrompt(ACT, 'ar'); assert.match(user, /3 نشاطًا/); assert.match(user, /mcq/);
  const d = parseActivityDraft({ items: [{ prompt_ar: 'س1', options: ['أ', 'ب', 'ج', 'د'], correct: 2, skill_id: 'bad' }, { prompt_ar: 'ناقص', options: ['أ', 'ب'] }, { prompt_ar: '', options: ['أ', 'ب', 'ج', 'د'] }] }, ACT)!;
  assert.equal(d.items.length, 1); assert.equal(d.items[0].correct, 2); assert.equal(d.items[0].skill_id, 's1', 'المهارة غير المعروفة تعود لمهارة الطلب');
  assert.equal(parseActivityDraft({ items: [] }, ACT), null);
  const m = localActivityDraft(ACT, 'ar'); assert.equal(m.items.length, 3); assert.ok(m.items.every(i => i.kind === 'mcq' && i.options.length === 4));
  const r = localActivityDraft({ ...ACT, want: { kind: 'reflection', count: 2, skill_id: null } }, 'ar'); assert.equal(r.items.length, 2); assert.ok(r.items.every(i => i.options.length === 0 && /تطبّق|تعلّمته|موقفًا/.test(i.prompt_ar)));
  const s = localActivityDraft({ ...ACT, want: { kind: 'self_rating', count: 9, skill_id: 's1' } }, 'en'); assert.equal(s.items.length, 5, 'سقف 5'); assert.match(s.items[0].prompt_en, /Rate your mastery/);
});

test('P9-أ: runAi بلا مفتاح يعود للبديل المحلي فورًا دون رمي خطأ، وaiStatus يعكس ذلك', async () => {
  const saved = { a: process.env.AI_API_KEY, g: process.env.GEMINI_API_KEY, o: process.env.OPENAI_API_KEY, n: process.env.ANTHROPIC_API_KEY };
  delete process.env.AI_API_KEY; delete process.env.GEMINI_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.deepEqual(aiStatus(), { enabled: false, provider: null });
    const r = await runAi({ system: 's', user: 'u', parse: () => ({ x: 1 }), local: () => ({ x: 0 }) });
    assert.equal(r.source, 'local'); assert.deepEqual(r.data, { x: 0 }); assert.equal(r.model, null); assert.equal(r.input_chars, 2); assert.equal(r.error, null);
  } finally { if (saved.a) process.env.AI_API_KEY = saved.a; if (saved.g) process.env.GEMINI_API_KEY = saved.g; if (saved.o) process.env.OPENAI_API_KEY = saved.o; if (saved.n) process.env.ANTHROPIC_API_KEY = saved.n; }
});
