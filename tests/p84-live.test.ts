// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P84 — اختبارات «التقرير الحيّ»: الوسم التلقائي، توزيع البنود، التنبيهات، إزالة التكرار، القوالب الخمسة، تهريب HTML */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgramReport } from '../lib/reports/program';
import { buildEvaluations, buildFacts, buildComments, applyFilters, factsOf, groupBy } from '../lib/reports/analytics';
import type { Lookups } from '../lib/reports/analytics';
import { autoLevel, buildItems, kirkpatrick, detectAlerts, newAlerts, previousCohort, buildDoc, templateHtml, TEMPLATES } from '../lib/reports/live';
import type { TemplateKind } from '../lib/reports/live';

const program = { id: 'p1', name_ar: 'برنامج أ', name_en: 'Program A', start_date: '2026-09-01', end_date: '2026-10-01', status: 'ACTIVE' };
const questions = [
  { id: 'q1', text_ar: 'وضوح الشرح', text_en: 'Clarity', section_ar: 'المدرّب', section_en: 'Trainer', kind: 'RATING_5' },
  { id: 'q2', text_ar: 'تعلّمت مهارات جديدة', text_en: 'I learned new skills', section_ar: 'التعلّم', section_en: 'Learning', kind: 'RATING_5' },
  { id: 'q3', text_ar: 'سأطبّق ما تعلّمته في عملي', text_en: 'I will apply', section_ar: 'النقل', section_en: 'Transfer', kind: 'RATING_5', kp_level: 3 },
  { id: 'q4', text_ar: 'ملاحظات', text_en: 'Comments', section_ar: 'رأيك', section_en: 'Opinion', kind: 'LONG_TEXT' },
];
const evaluations = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, program_id: 'p1', classroom_id: 'c1', kind: i < 5 ? 'DAILY' : 'FINAL', submitted_at: `2026-09-1${i}T08:00:00Z`, guest_email: `t${i}@x.sa` }));
const answers = evaluations.flatMap((e, i) => [
  { evaluation_id: e.id, question_id: 'q1', rating_value: 5 }, { evaluation_id: e.id, question_id: 'q2', rating_value: i % 2 ? 2 : 3 }, { evaluation_id: e.id, question_id: 'q3', rating_value: 4 },
  { evaluation_id: e.id, question_id: 'q4', rating_value: null, text_value: i < 4 ? 'الوقت قصير جدًا وضعيف التنظيم' : '' },
]);
const base = {
  program, classrooms: [{ id: 'c1', code: 'A-101', program_id: 'p1', trainer_id: 't1' }], trainers: [{ id: 't1', name: 'د. خالد' }], questions,
  evaluations, answers, assessments: [], impactResponses: [], followups: [], behaviorQuestions: [], behaviorResponses: [],
  sessions: [{ id: 's1', program_id: 'p1' }, { id: 's2', program_id: 'p1' }],
  records: [{ session_id: 's1', full_name: 'أحمد', email: 'a@x.sa', status: 'present' as const }, { session_id: 's1', full_name: 'سارة', email: 's@x.sa', status: 'absent' as const }, { session_id: 's2', full_name: 'سارة', email: 's@x.sa', status: 'absent' as const }],
  certificates: [], kpis: [], measurements: [],
};
function ctx() {
  const rep = buildProgramReport(base as any);
  const lk: Lookups = { classrooms: base.classrooms, trainers: base.trainers, programs: [program], questions } as any;
  const evals = applyFilters(buildEvaluations(evaluations as any, answers as any, lk), { programId: 'p1', kind: 'ALL' } as any, lk);
  const facts = buildFacts(answers as any, questions as any); const pf = factsOf(evals, facts);
  const items = buildItems(groupBy('question', evals, pf, lk, 'ar'), questions as any);
  const comments = buildComments(evals, answers as any, questions as any);
  return { rep, items, comments, cards: kirkpatrick(rep, items), alerts: detectAlerts(rep, items, comments, { minN: 2 }) };
}

test('autoLevel: db tag wins, else text regex, else L1', () => {
  assert.equal(autoLevel(questions[0] as any), 1);
  assert.equal(autoLevel(questions[1] as any), 2);
  assert.equal(autoLevel(questions[2] as any), 3);
  assert.equal(autoLevel({ id: 'x', text_ar: 'أثر البرنامج على نتائج العمل', kp_level: null } as any), 4);
  assert.equal(autoLevel({ id: 'y', text_ar: 'سأطبّق', kp_level: 1 } as any), 1);
});

test('buildItems: per-item distribution, top2/bottom2, levels', () => {
  const { items } = ctx(); const q2 = items.find(i => i.id === 'q2')!;
  assert.equal(q2.n, 8); assert.deepEqual(q2.dist, [0, 4, 4, 0, 0]); assert.equal(q2.top2, 0); assert.equal(q2.bottom2, 50); assert.equal(q2.level, 2);
  const q1 = items.find(i => i.id === 'q1')!; assert.equal(q1.mean, 5); assert.equal(q1.top2, 100);
});

test('kirkpatrick: four cards, L2 falls back to learning items, L3 to intent items', () => {
  const { cards } = ctx(); assert.equal(cards.length, 4); assert.deepEqual(cards.map(c => c.level), [1, 2, 3, 4]);
  assert.ok(cards[0].score! > 70); assert.ok(cards[1].score! < 60); assert.ok(cards[2].score! >= 70); assert.equal(cards[3].score, null);
});

test('detectAlerts: low item, negative comments, low attendance; newAlerts dedupes', () => {
  const { alerts } = ctx(); const kinds = alerts.map(a => `${a.kind}:${a.ref}`);
  assert.ok(kinds.includes('low_item:q2')); assert.ok(kinds.includes('neg_comments:q4')); assert.ok(kinds.includes('low_attendance:program'));
  assert.ok(!kinds.includes('low_item:q1'));
  const att = alerts.find(a => a.kind === 'low_attendance')!; assert.equal(att.severity, 'high');
  const left = newAlerts(alerts, [{ kind: 'low_item', ref: 'q2' }, { kind: 'neg_comments', ref: 'q4' }]);
  assert.equal(left.length, alerts.length - 2); assert.ok(!left.some(a => a.kind === 'low_item' && a.ref === 'q2'));
});

test('previousCohort: picks latest earlier program of the same name family', () => {
  const programs = [program, { ...program, id: 'p0', name_ar: 'برنامج أ', start_date: '2026-03-01' }, { ...program, id: 'pz', name_ar: 'برنامج ب', start_date: '2026-05-01' }];
  const prev = previousCohort(programs as any, program as any, (p) => ({ mean: p.id === 'p0' ? 3.9 : 4.4, responses: 10 }));
  assert.equal(prev?.prev.id, 'p0'); assert.equal(prev?.prevMean, 3.9); assert.equal(prev?.delta, 0.5);
  assert.equal(previousCohort([program] as any, program as any, () => ({ mean: 4, responses: 1 })), null);
});

test('buildDoc: five templates each produce sections; templateHtml escapes', () => {
  const c = ctx(); const input = { ...c, cohort: null, generatedAt: '١ ديسمبر ٢٠٢٦' };
  for (const k of Object.keys(TEMPLATES) as TemplateKind[]) {
    const doc = buildDoc(k, input); assert.equal(doc.kind, k); assert.ok(doc.sections.length >= 2, k); assert.equal(doc.program, 'برنامج أ');
  }
  const doc = buildDoc('executive', { ...input, rep: { ...c.rep, program: { ...c.rep.program, name_ar: '<script>x</script>' } } as any });
  const html = templateHtml(doc, 'https://athar-portal.com');
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('athar-portal.com'));
});
