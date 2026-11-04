// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P46 ر4-أ — «ملف الدبلوم» («أثرُ الدبلوم»): الوحدات (تنظيف · استيراد · حالات) · نبض الأسبوع (تنظيف · نواقص · سلسلة الانتباه) · تقرير الوحدة (جسم · كشف بالشواهد · نواقص · نسبة مقترَحة · التحقّق العام) · التسمية والقوائم
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R4_NAMES_AR, UNIT_MAX, PULSE_MAX_ATTENTION, DIPLOMA_KINDS, isDiplomaKind, diplomaKindAr, ATTENTION_CHANGE, UNIT_DECISION, UNIT_TOOLS_AR, EVIDENCE_MARKS_AR,
  cleanUnits, unitsFromDesign, unitStates, currentUnit, emptyPulseBody, cleanPulseBody, missingBeforePulseSubmit, carryAttention, pulseLineAr,
  emptyUnitBody, cleanUnitBody, cleanUnitStudents, missingBeforeUnitSubmit, outcomePctSuggested, unitLineAr, unitPublicView, listLineAr, publicVerifyView,
  type Unit, type PulseComputed, type UnitComputed, type StudentRow, type Skill,
} from '../lib/reports/registry';

const SK: Skill[] = [{ code: 'listening', name_ar: 'الاستماع' }, { code: 'speaking', name_ar: 'التحدّث' }, { code: 'writing', name_ar: 'الكتابة' }] as any;
const roster: StudentRow[] = [
  { key: 'k1', name: 'أحمد', email: 'a@x.sa', level: null, attendance_pct: 100, scores: {}, avg: null, grade_ar: null, note: '' },
  { key: 'k2', name: 'ريم', email: 'r@x.sa', level: null, attendance_pct: 50, scores: {}, avg: null, grade_ar: null, note: '' },
  { key: 'k3', name: 'خالد', email: 'k@x.sa', level: null, attendance_pct: 0, scores: {}, avg: null, grade_ar: null, note: '' },
] as any;
const U = (idx: number, extra: Partial<Unit> = {}): Unit => ({ id: 'u' + idx, idx, title_ar: 'الوحدة ' + idx, outcome_ar: 'ناتج ' + idx, hours: 20, skill_codes: ['listening'], starts_on: null, ends_on: null, closed_at: null, source: 'manual', ...extra });

test('ر4 · الأسماء والأنواع', () => {
  assert.equal(R4_NAMES_AR.file, 'ملف الدبلوم'); assert.equal(R4_NAMES_AR.pulse, 'نبض الأسبوع'); assert.equal(R4_NAMES_AR.unit, 'تقرير الوحدة'); assert.equal(R4_NAMES_AR.story, 'أثرُ الدبلوم');
  assert.deepEqual([...DIPLOMA_KINDS], ['diploma_pulse', 'diploma_unit', 'diploma_profile']); assert.ok(isDiplomaKind('diploma_unit'), 'unit'); assert.ok(!isDiplomaKind('weekly'), 'weekly');
  assert.equal(diplomaKindAr('diploma_pulse'), 'نبض الأسبوع'); assert.equal(ATTENTION_CHANGE.length, 4); assert.equal(UNIT_DECISION.length, 4); assert.ok(UNIT_TOOLS_AR.includes('بروفة'), 'tools'); assert.equal(Object.keys(EVIDENCE_MARKS_AR).length, 4);
});
test('ر4 · cleanUnits: ترقيم · حصر المهارات · حدود · إسقاط الفارغ', () => {
  const out = cleanUnits([{ title_ar: ' الوحدة  الأولى ', outcome_ar: 'ن', hours: '30', skill_codes: ['listening', 'xx', 'listening'], starts_on: '2026-09-05', ends_on: 'bad' }, { title_ar: 'x' }, { id: 'u9', title_ar: 'الثالثة', hours: 5000, source: 'design' }], SK);
  assert.equal(out.length, 2); assert.equal(out[0].idx, 1); assert.equal(out[0].title_ar, 'الوحدة الأولى'); assert.equal(out[0].hours, 30); assert.deepEqual(out[0].skill_codes, ['listening']); assert.equal(out[0].starts_on, '2026-09-05'); assert.equal(out[0].ends_on, null);
  assert.equal(out[1].idx, 2); assert.equal(out[1].id, 'u9'); assert.equal(out[1].hours, 999); assert.equal(out[1].source, 'design'); assert.equal(out[0].source, 'manual');
  assert.equal(cleanUnits(Array.from({ length: 40 }, (_, i) => ({ title_ar: 'وحدة ' + i })), SK).length, UNIT_MAX);
});
test('ر4 · unitsFromDesign: من modules مع قسمة الساعات', () => {
  const us = unitsFromDesign({ hours: 100, modules: [{ title_ar: 'المدخل', outcome_ar: 'ن1' }, { title_ar: 'التخطيط' }, { title_ar: 'التنفيذ' }, { title_ar: 'التقويم' }] }, SK);
  assert.equal(us.length, 4); assert.equal(us[0].hours, 25); assert.equal(us[1].outcome_ar, ''); assert.equal(us[3].source, 'design'); assert.deepEqual(unitsFromDesign({}, SK), []);
});
test('ر4 · unitStates: مغلقة ✓ · جارية بالتاريخ أو أول غير مغلقة · قادمة', () => {
  const st = unitStates([U(1, { closed_at: 'x' }), U(2), U(3)], '2026-10-01'); assert.deepEqual(st.map(s => s.state), ['closed', 'current', 'upcoming']);
  const byDate = unitStates([U(1), U(2, { starts_on: '2026-09-20', ends_on: '2026-10-10' }), U(3)], '2026-10-01'); assert.deepEqual(byDate.map(s => s.state), ['upcoming', 'current', 'upcoming']);
  assert.equal(currentUnit([U(1, { closed_at: 'x' }), U(2, { closed_at: 'y' })], '2026-10-01'), null); assert.equal(currentUnit([U(3), U(1), U(2)], '2026-10-01')?.idx, 1);
});
const PC: PulseComputed = { kind: 'diploma_pulse', program_ar: 'دبلوم', org_ar: 'جامعة أَثَر', trainer_ar: 'م', classroom_ar: 'شعبة 1', week_no: 5, period_from: '2026-10-04', period_to: '2026-10-08', unit: { id: 'u2', idx: 2, title_ar: 'الوحدة 2' }, units_total: 6, units_closed: 1, enrolled: 3, regular: 2, absent: 1, sessions: 4, hours: 6, around: { missions: 2, rehearsals: 1, cases: 7, stations: 0 }, prev_attention: [{ key: 'k2', name: 'ريم', reason: 'غياب متكرّر', since_week: 3 }], roster: roster.map(r => ({ key: r.key, name: r.name, email: r.email })), computed_at: 'now', full_weekly_id: null };
test('ر4 · النبض: الجسم الفارغ يحمل سلسلة الانتباه · التنظيف يرفض الغرباء ويحفظ المتابعة', () => {
  const e = emptyPulseBody(PC); assert.equal(e.follow.length, 1); assert.equal(e.follow[0].key, 'k2'); assert.equal(e.follow[0].change, '');
  const b = cleanPulseBody({ done: '  قدّمنا  الدرس ', attention: [{ key: 'k1', reason: 'تراجع في الكتابة' }, { key: 'zz', reason: 'غريب' }], follow: [{ key: 'k2', change: 'plan', note: 'جلسات دعم' }, { key: 'k2', change: 'same' }], need: 'x' }, PC);
  assert.equal(b.done, 'قدّمنا الدرس'); assert.equal(b.attention.length, 1); assert.equal(b.attention[0].name, 'أحمد'); assert.equal(b.follow.length, 1); assert.equal(b.follow[0].change, 'plan'); assert.equal(b.follow[0].prev_reason, 'غياب متكرّر');
  const b2 = cleanPulseBody({ follow: [{ key: 'k2', change: 'weird' }] }, PC); assert.equal(b2.follow[0].change, ''); const b3 = cleanPulseBody({ follow: [] }, PC); assert.equal(b3.follow.length, 1, 'المتابعة لا تسقط بالحذف');
  assert.equal(cleanPulseBody({ attention: Array.from({ length: 20 }, () => ({ key: 'k1', reason: 'س' })) }, PC).attention.length, PULSE_MAX_ATTENTION);
});
test('ر4 · النبض: النواقص · carryAttention يحمل الجديد والمستمرّ ويُسقط المتحسّن', () => {
  const b = cleanPulseBody({ done: 'قصير', attention: [{ key: 'k1', reason: '' }], follow: [{ key: 'k2', change: '' }] }, PC); const m = missingBeforePulseSubmit(b); assert.equal(m.length, 3);
  const ok = cleanPulseBody({ done: 'قدّمنا الوحدة الثانية كاملة وطبّقنا نشاط المحاكاة', attention: [{ key: 'k1', reason: 'تراجع' }], follow: [{ key: 'k2', change: 'improved' }] }, PC); assert.deepEqual(missingBeforePulseSubmit(ok), []);
  const carry = carryAttention(ok, 5); assert.deepEqual(carry.map(c => c.key), ['k1']); assert.equal(carry[0].since_week, 5);
  const carry2 = carryAttention(cleanPulseBody({ attention: [{ key: 'k1', reason: 'ت' }], follow: [{ key: 'k2', change: 'plan', note: 'خطة' }] }, PC), 5); assert.deepEqual(carry2.map(c => [c.key, c.reason, c.since_week]), [['k2', 'خطة', 3], ['k1', 'ت', 5]]);
  assert.match(pulseLineAr({ week_no: 5, period_from: '2026-10-04', period_to: '2026-10-08', computed: PC, status: 'draft' }), /نبض الأسبوع 5 .* الوحدة 2 /);
});
const UC: UnitComputed = { kind: 'diploma_unit', program_ar: 'دبلوم', org_ar: 'جامعة أَثَر', classroom_ar: 'شعبة 1', trainer_ar: 'م', enrolled: 3, regular: 2, sessions: 12, hours: 18, period_from: '2026-09-05', period_to: '2026-10-08', week_no: 2, attendance: 80, skills: SK, strategies: [], unit: U(2, { outcome_ar: 'يصمّم درسًا' }), unit_skills: SK.slice(0, 2), planned_hours: 20, planned_from: null, planned_to: null, weeks: [{ id: 'w1', kind: 'weekly', week_no: 3, period_from: '2026-09-20', period_to: '2026-09-24', verify_code: 'ABCD1234', status: 'approved' }], weekly_approved: 1, pulses_approved: 2, attention: [{ key: 'k2', name: 'ريم', reason: 'غياب', since_week: 3, last_change: 'plan' }], around: { missions: 2, rehearsals: 1, cases: 7, stations: 0 }, units_total: 6, units_closed: 1, grid_source: 'weeks' } as any;
test('ر4 · تقرير الوحدة: الجسم الفارغ · التنظيف · الكشف بالشواهد والقرار', () => {
  const e = emptyUnitBody(UC); assert.equal(e.attention.length, 1); assert.equal(e.outcome.pct, null);
  const b = cleanUnitBody({ assessment: { tools: [{ tool: 'بروفة', skill: 'speaking', desc: 'محاكاة' }, { tool: '' }] }, outcome: { judgment: 'ج', pct: '140', evidence: '' }, attention: [{ key: 'zz', decision: 'x' }], next: { support: [{ key: 'k1', what: 'جلسة', owner: 'المعلّم' }, { key: 'zz' }], adjust: '', admin: '' } }, UC, roster);
  assert.equal(b.assessment.tools.length, 1); assert.equal(b.outcome.pct, 100); assert.equal(b.attention.length, 1); assert.equal(b.attention[0].decision, ''); assert.equal(b.next.support.length, 1); assert.equal(b.next.support[0].name, 'أحمد');
  assert.equal(cleanUnitBody({ outcome: { pct: 'abc' } }, UC, roster).outcome.pct, null);
  const marks = new Map([['k1', { missions: 2, rehearsals: 0, cases: 3, stations: 0 }]]);
  const st = cleanUnitStudents([{ key: 'k1', scores: { listening: 90, speaking: 70, writing: 10 }, decision: 'completed' }, { key: 'k2', scores: { listening: 50 }, decision: 'bogus' }], roster, UC.unit_skills, marks);
  assert.equal(st.length, 3); assert.equal(st[0].avg, 80, 'مهارات الوحدة فقط'); assert.equal(st[0].decision, 'completed'); assert.deepEqual(st[0].marks, { missions: 2, rehearsals: 0, cases: 3, stations: 0 }); assert.equal(st[1].decision, ''); assert.deepEqual(st[2].marks, { missions: 0, rehearsals: 0, cases: 0, stations: 0 });
  assert.equal(outcomePctSuggested(st), 50); assert.equal(outcomePctSuggested([]), null);
});
test('ر4 · تقرير الوحدة: النواقص قبل الإرسال', () => {
  const st = cleanUnitStudents([{ key: 'k1', scores: { listening: 90 } }], roster, UC.unit_skills, new Map());
  const m = missingBeforeUnitSubmit(emptyUnitBody(UC), st); assert.equal(m.length, 5, m.join(' | '));
  const ok = cleanUnitBody({ assessment: { tools: [{ tool: 'اختبار', skill: '', desc: '' }] }, outcome: { judgment: 'بلغ أغلب المتدرّبين ناتج الوحدة بدليل مشاريعهم', pct: 67, evidence: 'ع' }, attention: [{ key: 'k2', decision: 'تستمرّ خطة الدعم' }] }, UC, roster);
  const st2 = cleanUnitStudents([{ key: 'k1', scores: { listening: 90 }, decision: 'completed' }], roster, UC.unit_skills, new Map()); assert.deepEqual(missingBeforeUnitSubmit(ok, st2), []);
});
test('ر4 · التحقّق العام لتقرير الوحدة: أعداد بلا أسماء · القوائم', () => {
  const st = cleanUnitStudents([{ key: 'k1', scores: { listening: 90 }, decision: 'completed' }, { key: 'k2', scores: { listening: 40 }, decision: 'support' }], roster, UC.unit_skills, new Map());
  const r = { verify_code: 'ZZZZ9999', status: 'approved', period_from: '2026-09-05', period_to: '2026-10-08', author_name: 'م', approved_name: 'ط', approved_at: 'now', computed: UC, students: st, body: { outcome: { pct: 67 } }, kind: 'diploma_unit', week_no: 2 };
  const v = unitPublicView(r); assert.equal(v.kind_ar, 'تقرير الوحدة'); assert.equal(v.unit.idx, 2); assert.deepEqual(v.chain, ['ABCD1234']); assert.equal(v.outcome_pct, 67); assert.equal(v.decisions.find((d: any) => d.code === 'completed').n, 1); assert.ok(!JSON.stringify(v).includes('أحمد'), 'بلا أسماء');
  assert.equal(unitPublicView({ ...r, status: 'draft' }), null); assert.equal(publicVerifyView(r as any)?.kind, 'diploma_unit');
  assert.match(unitLineAr(r), /تقرير الوحدة 2 «الوحدة 2»/); assert.match(listLineAr({ ...r, kind: 'diploma_pulse', computed: PC, status: 'submitted' } as any), /نبض الأسبوع/); assert.match(listLineAr(r as any), /تقرير الوحدة/);
});
