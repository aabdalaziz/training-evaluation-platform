// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P47-ب — «نسخة الدفعة»: تطبيق التعديلات المقبولة على الوحدات (آلي/يدوي) · رسالة الدفعة القادمة · العرض العام · حفظ version في body
import test from 'node:test';
import assert from 'node:assert/strict';
import { P47B_NAMES_AR, VERSION_MESSAGE_MAX, VERSION_MESSAGE_MIN, applyChanges, cleanVersionMessage, localCohortMessage, versionPublicView, cleanReviewBody, UNIT_OUTCOME_MAX, type Unit, type ReviewChange } from '../lib/reports/registry';

const U = (idx: number, hours: number, codes: string[], closed = true): Unit => ({ id: `u${idx}`, idx, title_ar: `الوحدة ${idx}`, outcome_ar: `ناتج ${idx}`, hours, skill_codes: codes, starts_on: '2026-01-01', ends_on: '2026-02-01', closed_at: closed ? '2026-02-01T00:00:00Z' : null, closed_report_id: closed ? 'r' : null, source: 'manual' });
const SK = [{ code: 'A', name_ar: 'أ' }, { code: 'B', name_ar: 'ب' }, { code: 'C', name_ar: 'ج' }];
const CH = (target: string, action: ReviewChange['action'], text_ar: string, decision: 'accept' | 'edit' = 'accept'): ReviewChange => ({ target, target_ar: target.startsWith('unit:') ? `الوحدة ${target.slice(5)} — عنوان` : target.startsWith('skill:') ? `كفاية ${target.slice(6)}` : 'البرنامج', action, action_ar: action, text_ar, decision });

test('P47-ب · الأسماء والحدود', () => {
  assert.equal(P47B_NAMES_AR.version, 'نسخة الدفعة'); assert.equal(P47B_NAMES_AR.apply, 'طبّق على النسخة القادمة'); assert.equal(P47B_NAMES_AR.message, 'رسالة إلى الدفعة القادمة');
  assert.equal(VERSION_MESSAGE_MAX, 300); assert.equal(VERSION_MESSAGE_MIN, 10); assert.equal(cleanVersionMessage(' x '.repeat(400)).length, 300);
});
test('P47-ب · applyChanges: الوحدات الجديدة مفتوحة بلا معرّفات ولا تواريخ، والترقيم متسلسل، وبلا تعديلات = نسخة مطابقة', () => {
  const r = applyChanges([U(2, 20, ['B']), U(1, 10, ['A'])], SK, []);
  assert.equal(r.units.length, 2); assert.deepEqual(r.units.map(u => u.idx), [1, 2]); assert.ok(r.units.every(u => u.id === null && u.closed_at === null && u.starts_on === null && u.ends_on === null), 'مفتوحة');
  assert.equal(r.hours, 30); assert.equal(r.skills.length, 3); assert.equal(r.applied.length, 0); assert.equal(r.manual.length, 0);
});
test('P47-ب · add_hours: على وحدة برقم → تُضاف · بلا رقم → يدوي · على البرنامج برقم → الوحدة الأخيرة', () => {
  const r = applyChanges([U(1, 10, ['A']), U(2, 20, ['B'])], SK, [CH('unit:1', 'add_hours', 'زِد 4 ساعات تطبيق'), CH('unit:2', 'add_hours', 'زِد ساعات'), CH('program:hours', 'add_hours', 'زِد ٦ ساعات تعويضية')]);
  assert.equal(r.units[0].hours, 14); assert.equal(r.units[1].hours, 26); assert.equal(r.hours, 40); assert.equal(r.applied.length, 2); assert.equal(r.manual.length, 1); assert.match(r.manual[0].note_ar, /يدويًا/);
});
test('P47-ب · split_unit: وحدتان بنصف الساعات والكفايات مقسومة، والترقيم يُعاد', () => {
  const r = applyChanges([U(1, 10, ['A']), U(2, 21, ['A', 'B', 'C']), U(3, 5, ['C'])], SK, [CH('unit:2', 'split_unit', 'قسّمها')]);
  assert.equal(r.units.length, 4); assert.deepEqual(r.units.map(u => u.idx), [1, 2, 3, 4]); assert.deepEqual(r.units.map(u => u.hours), [10, 11, 10, 5]); assert.equal(r.hours, 36);
  assert.match(r.units[1].title_ar, /\(١\)$/); assert.match(r.units[2].title_ar, /\(٢\)$/); assert.deepEqual(r.units[1].skill_codes, ['A', 'B']); assert.deepEqual(r.units[2].skill_codes, ['C']); assert.match(r.units[2].outcome_ar, /الجزء الثاني/);
  assert.equal(r.applied.length, 1); assert.equal(applyChanges([U(1, 10, ['A'])], SK, [CH('unit:9', 'split_unit', 'x')]).manual.length, 1);
});
test('P47-ب · add_evidence: يُلحق بناتج الوحدة (أو أول وحدة تحمل الكفاية) ضمن الحدّ · بلا وحدة → يدوي', () => {
  const r = applyChanges([U(1, 10, ['A']), U(2, 10, ['B'])], SK, [CH('unit:1', 'add_evidence', 'أضف نشاط دليل: عرض عملي أمام الزملاء'), CH('skill:B', 'add_evidence', 'ملف إنجاز', 'edit'), CH('skill:C', 'add_evidence', 'x')]);
  assert.match(r.units[0].outcome_ar, /دليله: عرض عملي أمام الزملاء$/); assert.match(r.units[1].outcome_ar, /دليله: ملف إنجاز$/); assert.ok(r.units[0].outcome_ar.length <= UNIT_OUTCOME_MAX, 'حدّ الناتج');
  assert.equal(r.applied.length, 2); assert.equal(r.manual.length, 1);
});
test('P47-ب · drop_skill: تُحذف من القالب ومن كل الوحدات · لا يُنزل القالب تحت كفايتين · كفاية غير موجودة → يدوي', () => {
  const r = applyChanges([U(1, 10, ['A', 'C']), U(2, 10, ['C'])], SK, [CH('skill:C', 'drop_skill', 'احذف')]);
  assert.deepEqual(r.skills.map(s => s.code), ['A', 'B']); assert.deepEqual(r.units[0].skill_codes, ['A']); assert.deepEqual(r.units[1].skill_codes, []); assert.equal(r.applied.length, 1);
  const r2 = applyChanges([U(1, 10, ['A'])], SK.slice(0, 2), [CH('skill:A', 'drop_skill', 'احذف')]); assert.equal(r2.manual.length, 1); assert.equal(r2.skills.length, 2);
  assert.equal(applyChanges([U(1, 10, ['A'])], SK, [CH('skill:Z', 'drop_skill', 'احذف')]).manual.length, 1);
});
test('P47-ب · move_skill · reorder · add_support → يدوي بملاحظة · keep → مطبَّق بلا أثر', () => {
  const r = applyChanges([U(1, 10, ['A']), U(2, 10, ['B'])], SK, [CH('skill:A', 'move_skill', 'انقلها'), CH('program:order', 'reorder', 'رتّب'), CH('program:support', 'add_support', 'محطة'), CH('unit:1', 'keep', 'أبقِ')]);
  assert.equal(r.manual.length, 3); assert.ok(r.manual.every(m => m.note_ar.length > 5), 'ملاحظات'); assert.equal(r.applied.length, 1); assert.equal(r.applied[0].action, 'keep'); assert.equal(r.hours, 20); assert.equal(r.units.length, 2);
});
test('P47-ب · localCohortMessage: من المطبَّق (بلا keep) · ≤ 300 · وبلا تعديلات جملة عامة', () => {
  const r = applyChanges([U(1, 10, ['A']), U(2, 20, ['A', 'B'])], SK, [CH('unit:2', 'split_unit', 'قسّم'), CH('unit:1', 'add_hours', 'زِد 2'), CH('unit:1', 'keep', 'أبقِ')]);
  const m = localCohortMessage(r, 1); assert.match(m, /^بسبب من سبقوكم/); assert.match(m, /قُسّمت «عنوان» إلى وحدتين/); assert.match(m, /زادت ساعات/); assert.ok(m.length <= VERSION_MESSAGE_MAX, 'الحدّ');
  assert.match(localCohortMessage(applyChanges([U(1, 10, ['A'])], SK, []), 3), /بعد الدفعة 3\.$/);
});
test('P47-ب · versionPublicView: بلا أسماء ولا معرّفات · keep يُستبعد · قبل/بعد أرقام', () => {
  const v = versionPublicView({ version: 2, created_at: '2027-01-22T10:00:00Z', cohort_no: 1, review_code: 'ABC', applied: [{ target_ar: 'و1', action_ar: 'زِد', note_ar: 'n', action: 'add_hours' }, { target_ar: 'و2', action_ar: 'أبقِ', note_ar: '', action: 'keep' }], manual: [{}, {}], message_ar: 'م', after: { units: [1, 2, 3], hours: 36 }, before: { units: [1, 2], hours: 30 }, ...({ created_by: 'x', created_name: 'y' } as any) });
  assert.deepEqual(Object.keys(v).sort(), ['applied', 'at', 'code', 'cohort_no', 'hours_after', 'hours_before', 'manual_n', 'message_ar', 'units_after', 'units_before', 'version'].sort());
  assert.equal(v.applied.length, 1); assert.equal(v.manual_n, 2); assert.equal(v.units_before, 2); assert.equal(v.units_after, 3); assert.equal(v.hours_after, 36); assert.equal(v.at, '2027-01-22'); assert.ok(!JSON.stringify(v).includes('created_'), 'لا أسماء');
});
test('P47-ب · cleanReviewBody يحفظ version من الخادم فقط ولا يقبلها من العميل', () => {
  const prev = { version: { id: 'v1', version: 2, at: '2027-01-22' } };
  assert.deepEqual(cleanReviewBody({ proposals: [], decisions: [], version: { id: 'hack', version: 9, at: '' } }).version, undefined);
  assert.deepEqual(cleanReviewBody({ proposals: [], decisions: [] }, prev as any).version, prev.version);
});
