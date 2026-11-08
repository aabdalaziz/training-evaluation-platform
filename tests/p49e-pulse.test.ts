import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computePulse, actionDraft, cohortKey, sectionOrder, tone, K_MIN } from '../lib/evaluation/pulse';
import type { PulseEval, PulseAnswer, PulseQ } from '../lib/evaluation/pulse';
import { END_SURVEY_SEED, END_SURVEY_SECTIONS_AR } from '../lib/evaluation/links';

/* بيئة اصطناعية: 3 أقسام × بندان · دفعتان (شعبتان) · k يختلف */
const Q: PulseQ[] = [
  { id: 'q1', kind: 'LIKERT_5', question_key: 'end_r01_registration', text_ar: 'التسجيل واضح', text_en: 'Registration clear', section_ar: 'التسجيل والاستقبال', section_en: 'Registration & reception' },
  { id: 'q2', kind: 'LIKERT_5', question_key: 'end_r04_reception', text_ar: 'الاستقبال محترم', text_en: null, section_ar: 'التسجيل والاستقبال', section_en: 'Registration & reception' },
  { id: 'q3', kind: 'LIKERT_5', question_key: 'end_t02_internet', text_ar: 'الإنترنت مستقر', text_en: null, section_ar: 'التجهيزات والتقنية', section_en: 'Equipment & technology' },
  { id: 'q4', kind: 'LIKERT_5', question_key: 'end_h02_breaks', text_ar: 'الاستراحات مناسبة', text_en: null, section_ar: 'الضيافة والخدمات', section_en: 'Hospitality & services' },
  { id: 'q5', kind: 'NPS_10', question_key: 'end_q17_nps', text_ar: 'الترشيح', text_en: null, section_ar: 'الترشيح', section_en: 'Recommendation' },
  { id: 'q6', kind: 'LONG_TEXT', question_key: 'end_q14_strengths', text_ar: 'نقاط القوة', text_en: null, section_ar: 'رأيك', section_en: 'Your opinion' },
];
function cohort(prefix: string, program: string, room: string | null, n: number, day: string, vals: Record<string, number>): { e: PulseEval[]; a: PulseAnswer[] } {
  const e: PulseEval[] = []; const a: PulseAnswer[] = [];
  for (let i = 0; i < n; i++) {
    const id = `${prefix}${i}`; e.push({ id, program_id: program, classroom_id: room, submitted_at: `${day}T10:0${i % 10}:00Z` });
    for (const [q, v] of Object.entries(vals)) a.push({ evaluation_id: id, question_id: q, rating_value: v });
    a.push({ evaluation_id: id, question_id: 'q5', rating_value: null });   // NPS نصّ — لا يدخل
    a.push({ evaluation_id: id, question_id: 'q6', rating_value: null });
  }
  return { e, a };
}
const A = cohort('a', 'p1', 'c1', 6, '2026-10-01', { q1: 4, q2: 5, q3: 2, q4: 3 });   // دفعة أقدم
const B = cohort('b', 'p1', 'c2', 7, '2026-11-01', { q1: 5, q2: 5, q3: 3, q4: 2 });   // أحدث: الإنترنت تحسّن، الاستراحات ساءت
const C = cohort('c', 'p2', null, 3, '2026-11-05', { q1: 1, q2: 1, q3: 1, q4: 1 });  // k < 5 — لا تُعرض ولا تُحسب كدفعة كبيرة
const evals = [...A.e, ...B.e, ...C.e]; const answers = [...A.a, ...B.a, ...C.a];

test('P49-هـ · k ≥ 5: أقل من 5 استجابات → لا أرقام إطلاقًا (enough=false وكل القوائم فارغة)', () => {
  const p = computePulse(evals, answers, Q, { programId: 'p2' });
  assert.equal(p.n, 3); assert.equal(p.enough, false); assert.equal(p.sections.length, 0); assert.equal(p.weakest.length, 0); assert.equal(p.itemOfWeek, null); assert.equal(p.cohorts.length, 0);
  assert.equal(K_MIN, 5);
});

test('P49-هـ · الأقسام بترتيب رحلة المتدرّب · ليكرت فقط (NPS والنصّ لا يدخلان) · المتوسّطات صحيحة', () => {
  const p = computePulse(evals, answers, Q);
  assert.equal(p.n, 16); assert.ok(p.enough);
  assert.deepEqual(p.sections.map(s => s.name), ['التسجيل والاستقبال', 'التجهيزات والتقنية', 'الضيافة والخدمات']);
  const reg = p.sections[0]; assert.equal(reg.items.length, 2); assert.equal(reg.n, 2 * 16);
  // q1: 6×4 + 7×5 + 3×1 = 62 / 16 = 3.875 → 3.88 ; q2: 6×5 + 7×5 + 3×1 = 68/16 = 4.25 ; متوسّط القسم = 130/32 = 4.0625 → 4.06
  assert.equal(reg.items.find(i => i.key === 'end_r01_registration')!.mean, 3.88); assert.equal(reg.mean, 4.06);
  assert.ok(!p.sections.some(s => s.name === 'الترشيح' || s.name === 'رأيك'));
  assert.equal(sectionOrder('الضيافة والخدمات'), 3); assert.equal(sectionOrder('قسم خاص'), 100);
});

test('P49-هـ · الدفعات = الشعبة أو البرنامج · الأحدث أولًا · دفعة < 5 تظهر بلا متوسّط في الجدول لكنها لا تدخل الاتجاه', () => {
  const p = computePulse(evals, answers, Q);
  assert.deepEqual(p.cohorts.map(c => c.key), ['p2', 'c2', 'c1']); assert.equal(cohortKey({ id: 'x', program_id: 'p9', classroom_id: null }), 'p9');
  assert.equal(p.cohorts[1].n, 7); assert.equal(p.cohorts[2].n, 6); assert.equal(p.cohorts[0].n, 3);
  assert.equal(p.trend.length, 3);
  const net = p.trend.find(t => t.section === 'التجهيزات والتقنية')!; assert.equal(net.prev, 2); assert.equal(net.last, 3); assert.equal(net.delta, 1);
  const hosp = p.trend.find(t => t.section === 'الضيافة والخدمات')!; assert.equal(hosp.delta, -1);
});

test('P49-هـ · أدنى/أعلى 3 بنود عبر الدفعات (k ≥ 5 لكل بند) · «بند الأسبوع» = أضعف بند في آخر دفعة k ≥ 5 (c2: الاستراحات 2.00)', () => {
  const p = computePulse(evals, answers, Q);
  assert.equal(p.weakest[0].key, 'end_h02_breaks'); assert.equal(p.strongest[0].key, 'end_r04_reception');
  assert.ok(p.itemOfWeek); assert.equal(p.itemOfWeek!.key, 'end_h02_breaks'); assert.equal(p.itemOfWeek!.mean, 2); assert.equal(p.itemOfWeek!.n, 7); assert.equal(p.itemOfWeek!.cohort.key, 'c2');
  const d = actionDraft(p)!; assert.deepEqual(Object.keys(d).sort(), ['classroom_id', 'cohort_key', 'mean', 'n', 'program_id', 'question_key', 'question_text', 'section']);
  assert.equal(d.classroom_id, 'c2'); assert.equal(d.program_id, 'p1'); assert.ok(!JSON.stringify(d).includes('@'), 'لا بيانات شخصية في مسودّة المهمّة');
});

test('P49-هـ · تصفية ببرنامج · درجات اللون · المفاتيح القديمة تجمع النصّ القديم والجديد للبند نفسه', () => {
  const p = computePulse(evals, answers, Q, { programId: 'p1' }); assert.equal(p.n, 13); assert.equal(p.cohorts.length, 2);
  assert.equal(tone(4.5), 'ok'); assert.equal(tone(3.9), 'good'); assert.equal(tone(3.2), 'warn'); assert.equal(tone(2.1), 'bad');
  const Q2 = [...Q, { id: 'q1old', kind: 'LIKERT_5', question_key: 'end_r01_registration', text_ar: 'نصّ قديم', text_en: null, section_ar: 'التسجيل والاستقبال', section_en: null }];
  const extra: PulseAnswer[] = [{ evaluation_id: 'a0', question_id: 'q1old', rating_value: 1 }];
  const p2 = computePulse(evals, [...answers, ...extra], Q2); const it = p2.sections[0].items.find(i => i.key === 'end_r01_registration')!; assert.equal(it.n, 17);
  assert.ok(END_SURVEY_SECTIONS_AR.every(s => END_SURVEY_SEED.some(q => q.section_ar === s)));
});

test('P49-هـ · الشكل: صفحة /admin/pulse بالمعرّفات · الغرفة والبحث والمسار · الجدول في سجلّ المعالجة · SQL بقيد k ≥ 5 وسياسات الطاقم', () => {
  const page = readFileSync('app/admin/pulse/page.tsx', 'utf8');
  for (const id of ['pl-program', 'pl-kpis', 'pl-few', 'pl-week', 'pl-week-record', 'pl-sections', 'pl-weakest', 'pl-strongest', 'pl-cohorts', 'pl-actions']) assert.ok(page.includes(`data-testid="${id}"`), id);
  assert.ok(page.includes("from('end_survey_actions')") && page.includes('length < 5'), 'الإغلاق بملاحظة ≥ 5 أحرف');
  assert.ok(readFileSync('lib/portal/rooms.ts', 'utf8').includes("'/admin/pulse'") && readFileSync('lib/portal/search.ts', 'utf8').includes("'admin-pulse'") && readFileSync('lib/portal/way.ts', 'utf8').includes("'admin/pulse'") && readFileSync('lib/portal/hub.ts', 'utf8').includes("'/admin/pulse'"));
  assert.ok(readFileSync('lib/vault/registry.ts', 'utf8').includes("'end_survey_actions'"));
  const sql = readFileSync('supabase/p49e-pulse.sql', 'utf8'); assert.ok(sql.includes('check (n >= 5)') && sql.includes('esa_open_uidx') && sql.includes('portal_is_staff()') && sql.includes("status <> 'done' or"));
  const ev = readFileSync('app/evaluate/[kind]/page.tsx', 'utf8'); assert.ok(ev.includes('data-testid="ev-journey"') && ev.includes('ev-jchip') && ev.includes('id={`sec-${gi}`}') && ev.includes('scroll-margin-top'), 'شريط الرحلة');
});
