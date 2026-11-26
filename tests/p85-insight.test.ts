// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 — اختبارات «عمق التحليل»: التوحيد (يومي+نهائي+ختامي+عن بُعد)، الوصفي وفواصل الثقة، ألفا، المحرّكات، الديناميكا، الشرائح، المواضيع، النتائج، التوصيات، المؤلّف */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvaluations, buildFacts, buildComments } from '../lib/reports/analytics';
import type { Lookups } from '../lib/reports/analytics';
import { fromEvaluations, fromRemote, merge, describe, cronbach, drivers, dynamics, segments, segmentGap, themes, analyze, compose, reportText, pearson, pFromT } from '../lib/reports/insight';
import type { ResponseRow } from '../lib/surveys/remoteLearning';

/* مولّد شبه عشوائي ثابت */
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const clamp = (x: number) => Math.max(1, Math.min(5, Math.round(x)));

const questions = [
  { id: 'q1', text_ar: 'وضوح شرح المدرّب', section_ar: 'المدرّب', kind: 'RATING_5' }, { id: 'q2', text_ar: 'تفاعل المدرّب مع الأسئلة', section_ar: 'المدرّب', kind: 'RATING_5' },
  { id: 'q3', text_ar: 'ملاءمة المحتوى لاحتياجي', section_ar: 'المحتوى', kind: 'RATING_5' }, { id: 'q4', text_ar: 'كفاية الوقت المخصّص', section_ar: 'المحتوى', kind: 'RATING_5' },
  { id: 'q5', text_ar: 'جودة الصوت والصورة في المنصّة', section_ar: 'المنصّة', kind: 'RATING_5' }, { id: 'q6', text_ar: 'الرضا العامّ عن اليوم التدريبي', section_ar: 'عام', kind: 'RATING_5' },
  { id: 'q7', text_ar: 'ملاحظاتك', section_ar: 'رأيك', kind: 'LONG_TEXT' },
];
const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
const evaluations: any[] = []; const answers: any[] = [];
days.forEach((d, di) => { for (let p = 0; p < 12; p++) { const room = p < 6 ? 'cA' : 'cB'; const id = `e${di}_${p}`; evaluations.push({ id, program_id: 'p1', classroom_id: room, kind: 'DAILY', submitted_at: `${d}T12:00:00Z`, guest_email: `t${p}@x.sa`, guest_gender: p % 2 ? 'F' : 'M' });
  const fatigue = di >= 4 ? -0.8 : 0; const roomEff = room === 'cB' ? -0.9 : 0; const base = 4.3 + fatigue + roomEff;
  const q4v = clamp(2.6 + roomEff + (rnd() - 0.5)); /* الوقت: ضعيف دائمًا */
  answers.push({ evaluation_id: id, question_id: 'q1', rating_value: clamp(base + 0.4 + (rnd() - 0.5)) }, { evaluation_id: id, question_id: 'q2', rating_value: clamp(base + 0.3 + (rnd() - 0.5)) }, { evaluation_id: id, question_id: 'q3', rating_value: clamp(base + (rnd() - 0.5)) }, { evaluation_id: id, question_id: 'q4', rating_value: q4v }, { evaluation_id: id, question_id: 'q5', rating_value: clamp(4.6 + (rnd() - 0.5)) }, { evaluation_id: id, question_id: 'q6', rating_value: clamp((base + q4v) / 2 + 0.6 + (rnd() - 0.5)) });
  if (p % 3 === 0) answers.push({ evaluation_id: id, question_id: 'q7', rating_value: null, text_value: room === 'cB' ? 'الوقت قصير جدًا ونتمنى زيادة مدة التطبيق العملي' : 'شرح المدرّب ممتاز وواضح' }); } });
for (let p = 0; p < 10; p++) { const id = `f${p}`; evaluations.push({ id, program_id: 'p1', classroom_id: p < 5 ? 'cA' : 'cB', kind: 'FINAL', submitted_at: '2026-11-07T12:00:00Z', guest_email: `t${p}@x.sa` }); for (const q of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) answers.push({ evaluation_id: id, question_id: q, rating_value: clamp((q === 'q4' ? 2.8 : 4.2) + (rnd() - 0.5)) }); }
for (let p = 0; p < 6; p++) { const id = `n${p}`; evaluations.push({ id, program_id: 'p1', classroom_id: null, kind: 'END', submitted_at: '2026-11-08T12:00:00Z', guest_email: `t${p}@x.sa` }); for (const q of ['q3', 'q6']) answers.push({ evaluation_id: id, question_id: q, rating_value: clamp(4.3 + (rnd() - 0.5)) }); }
const lk: Lookups = { classrooms: [{ id: 'cA', code: 'الفصل أ', program_id: 'p1', trainer_id: 't1' }, { id: 'cB', code: 'الفصل ب', program_id: 'p1', trainer_id: 't2' }], trainers: [{ id: 't1', name: 'أ. سارة' }, { id: 't2', name: 'أ. خالد' }], programs: [{ id: 'p1', name_ar: 'العربية للناطقين بغيرها (عن بُعد)' }], questions } as any;
const evals = buildEvaluations(evaluations, answers, lk); const facts = buildFacts(answers, questions as any); const comments = buildComments(evals, answers, questions as any);
const remoteRows: ResponseRow[] = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, program_id: 'p1', level_id: i < 5 ? 'L1' : 'L2', trainer_id: 't1', classroom_id: 'cA', schedule_id: null, lecture_date: days[i % 6], self_level_id: null, self_level_unknown: false, attendance: 'most', ratings: { q01_teams_easy: 'A', q02_av_clear: i % 3 ? 'SA' : 'N', q03_teacher_clear: 'SA', q04_new_words: 'SA', q05_listening: 'A', q06_speaking: i % 2 ? 'D' : 'N', q07_reading: 'A', q08_writing: 'A', q09_materials_level: 'A', q10_instructions: 'A', q11_help: 'SA', q12_improved: 'A', q13_satisfied: i % 2 ? 'A' : 'SA' } as any, difficulties: i % 2 ? ['few_speaking', 'poor_internet'] : ['none'], difficulty_other: null, liked_most: i % 2 ? 'المدرّسة صبورة وواضحة' : null, suggestion: i % 3 === 0 ? 'أتمنى فرصًا أكثر للتحدث بالعربية في الدرس' : null, submitted_at: `${days[i % 6]}T18:00:00Z` }));
const ds = merge(fromEvaluations(evals, facts, comments, lk), fromRemote(remoteRows, { classrooms: lk.classrooms, trainers: lk.trainers, levels: [{ id: 'L1', name_ar: 'المستوى الأوّل' }, { id: 'L2', name_ar: 'المستوى الثاني' }] }));
export const DS = ds;

test('unified dataset: four kinds, items with axes, remote scale mapped 5..1 and NA dropped', () => {
  assert.deepEqual(Array.from(new Set(ds.obs.map(o => o.kind))).sort(), ['DAILY', 'END', 'FINAL', 'REMOTE']);
  assert.equal(ds.obs.length, 72 + 10 + 6 + 9);
  const r0 = ds.obs.find(o => o.id === 'r0')!; assert.equal(r0.items.q03_teacher_clear, 5); assert.equal(r0.items.q06_speaking, 3); assert.equal(ds.items.find(i => i.key === 'q06_speaking')!.axis, 'المهارات اللغوية');
  assert.ok(ds.items.find(i => i.key === 'q1')!.kinds.includes('DAILY') && ds.items.find(i => i.key === 'q1')!.kinds.includes('FINAL'));
});

test('describe: CI narrows with n, top2/bottom2/net; pearson and p approximations sane', () => {
  const a = describe([4, 5, 4, 5, 4, 5, 4, 5]); const b = describe([4, 5, 4, 5]);
  assert.ok(a.hi - a.lo < b.hi - b.lo); assert.equal(a.top2, 100); assert.equal(a.net, 100);
  assert.equal(pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1); assert.ok(pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]) < -0.99);
  assert.ok(pFromT(0, 10) > 0.99); assert.ok(pFromT(3, 40) < 0.01); assert.ok(pFromT(2.1, 20) < 0.06);
});

test('cronbach alpha: consistent axis high, random axis low/null', () => {
  const alphaTrainer = cronbach(ds, ['q1', 'q2']); assert.ok(alphaTrainer != null && alphaTrainer > 0.6, String(alphaTrainer));
  assert.equal(cronbach(ds, ['q1']), null);
});

test('drivers: time item is a fix_first driver (correlated with overall, low performance)', () => {
  const drv = drivers(ds); const time = drv.find(x => x.key === 'q4')!; const platform = drv.find(x => x.key === 'q5')!;
  assert.ok(time, 'time driver present'); assert.equal(time.quadrant, 'fix_first'); assert.ok(time.r > 0.3, `r=${time.r}`);
  assert.ok(platform.quadrant === 'overkill' || platform.quadrant === 'keep');
});

test('dynamics: fatigue in the last third detected; worst day among the last two', () => {
  const dyn = dynamics(ds); assert.ok(dyn.days.length >= 6); assert.equal(dyn.fatigue, true); assert.ok(['2026-11-05', '2026-11-06'].includes(dyn.worst!.date)); assert.ok(dyn.slope < 0);
});

test('segments: classroom gap significant with large effect; labels resolved', () => {
  const rows = segments(ds, 'classroom'); assert.equal(rows[0].label, 'الفصل أ'); const gap = segmentGap(ds, 'classroom')!; assert.equal(gap.significant, true); assert.ok(gap.d > 0.5, `d=${gap.d}`); assert.equal(gap.worst.label, 'الفصل ب');
  const kinds = segments(ds, 'kind'); assert.ok(kinds.length >= 3);
});

test('themes: time/application complaints and trainer praise; explicit requests captured', () => {
  const v = themes(ds); const time = v.themes.find(t => t.key === 'time')!; const trainer = v.themes.find(t => t.key === 'trainer')!;
  assert.ok(time && time.negative >= 3); assert.ok(trainer && trainer.positive >= 3); assert.ok(v.requests.some(r => r.includes('أتمنى') || r.includes('نتمنى')));
});

test('analyze + compose: findings reference evidence, recommendations prioritized with owners/KPIs, three depths', () => {
  const a = analyze(ds, { benchmarkOthers: [3.9, 4.1, 4.4, 3.6] });
  assert.ok(a.findings.some(f => f.title.startsWith('محرّك رضا')), 'driver finding'); assert.ok(a.findings.some(f => f.title.startsWith('تراجع')), 'fatigue finding'); assert.ok(a.findings.some(f => f.title.startsWith('فجوة دالّة')), 'segment finding'); assert.ok(a.bench && a.bench.of === 5);
  assert.ok(a.recs.length >= 4 && a.recs.length <= 10); assert.ok(a.recs.every(r => r.owner && r.days > 0 && r.kpi && r.steps.length >= 2 && r.findings.length));
  assert.ok(a.recs[0].score >= a.recs[a.recs.length - 1].score); assert.ok(a.tags.some(t => t.tag === 'قلة فرص التحدث بالعربية'));
  const meta = { program: 'العربية للناطقين بغيرها (عن بُعد)', period: '1–8 نوفمبر 2026', generatedAt: '27 نوفمبر 2026', depth: 'comprehensive' as const, delivery: 'عن بُعد' };
  const full = compose(a, meta); const exec = compose(a, { ...meta, depth: 'executive' }); const det = compose(a, { ...meta, depth: 'detailed' });
  assert.ok(full.sections.length > det.sections.length && det.sections.length > exec.sections.length);
  assert.ok(full.sections.some(s => s.id === 'quality') && full.sections.some(s => s.id === 'drivers') && full.sections.some(s => s.id === 'dynamics'));
  const charts = full.sections.flatMap(s => s.blocks).filter(b => b.type === 'chart'); assert.ok(charts.length >= 5);
  const txt = reportText(full); assert.ok(txt.includes('الملخّص التنفيذي') && txt.includes('R1') && txt.includes('F1'));
});
