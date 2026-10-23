import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOptions, validateQuestion, emptyDraft, questionPayload, move, renumber, nextOrder, coverage, linkPlan, applyPlan, duplicatePayload, previewGroups, templateStats, estimateMinutes, templateName } from '../lib/templates/model';
import type { Template, Question, TemplateLink } from '../lib/templates/model';

const T: Template[] = [
  { id: 'd1', kind: 'DAILY', name_ar: 'التقييم اليومي' },
  { id: 'd2', kind: 'DAILY', name_ar: 'يومي — نسخة' },
  { id: 'f1', kind: 'FINAL', name_ar: 'التقييم النهائي' },
  { id: 'f0', kind: 'FINAL', name_ar: null, name_en: null },
];
const q = (id: string, template_id: string, order_index: number, kind = 'RATING_5', extra: Partial<Question> = {}): Question => ({
  id, template_id, kind, text_ar: 'س' + id, text_en: null, section_ar: extra.section_ar ?? 'عام', section_en: null, is_required: true, options: [], max_value: 5, order_index, ...extra,
});
const Q: Question[] = [q('a', 'd1', 2), q('b', 'd1', 1), q('c', 'd1', 3, 'LONG_TEXT', { section_ar: 'رأيك', is_required: false }), q('x', 'f1', 1)];
const L: TemplateLink[] = [
  { program_id: 'p1', template_id: 'd1', is_active: true }, { program_id: 'p1', template_id: 'f1', is_active: true },
  { program_id: 'p2', template_id: 'd1', is_active: true }, { program_id: 'p2', template_id: 'f0', is_active: true },
  { program_id: 'p3', template_id: 'd2', is_active: false },
];
const P = [{ id: 'p1', name_ar: 'أ' }, { id: 'p2', name_ar: 'ب' }, { id: 'p3', name_ar: 'ج' }];

test('parseOptions: أسطر/فواصل، تشذيب، بلا تكرار', () => {
  assert.deepEqual(parseOptions('ممتاز\nجيد ، مقبول,جيد\n\n  '), ['ممتاز', 'جيد', 'مقبول']);
  assert.deepEqual(parseOptions(''), []);
});

test('validateQuestion: النص مطلوب، الخيارات ≥2، حدود المقياس', () => {
  assert.ok(validateQuestion(emptyDraft()).some(e => /مطلوب/.test(e)));
  const single = { ...emptyDraft('SINGLE_CHOICE'), text_ar: 'س', optionsText: 'واحد' };
  assert.ok(validateQuestion(single).some(e => /خيارين/.test(e)));
  assert.deepEqual(validateQuestion({ ...single, optionsText: 'واحد\nاثنان' }), []);
  assert.ok(validateQuestion({ ...emptyDraft(), text_ar: 'س', max_value: 2 }).some(e => /بين 3 و10/.test(e)));
  assert.deepEqual(validateQuestion({ ...emptyDraft('LONG_TEXT'), text_ar: 'س', max_value: 0 }), []);
});

test('questionPayload: يصفّر الخيارات لغير الاختيار والحد الأعلى لغير المقياس', () => {
  const p = questionPayload({ ...emptyDraft('YES_NO'), text_ar: ' س ', text_en: '', optionsText: 'a\nb', max_value: 7 });
  assert.equal(p.text_ar, 'س'); assert.equal(p.text_en, null); assert.deepEqual(p.options, []); assert.equal(p.max_value, null);
  const m = questionPayload({ ...emptyDraft('MULTI_CHOICE'), text_ar: 'س', optionsText: 'a\nb' });
  assert.deepEqual(m.options, ['a', 'b']); assert.equal(m.max_value, null);
});

test('move/renumber/nextOrder: ترتيب متسلسل وتغييرات دنيا', () => {
  const ordered = [q('b', 'd1', 1), q('a', 'd1', 2), q('c', 'd1', 3)];
  const moved = move(ordered, 2, 0);
  assert.deepEqual(moved.map(x => x.id), ['c', 'b', 'a']);
  assert.deepEqual(renumber(moved), [{ id: 'c', order_index: 1 }, { id: 'b', order_index: 2 }, { id: 'a', order_index: 3 }]);
  assert.deepEqual(renumber(ordered), []);
  assert.deepEqual(move(ordered, 0, 5).map(x => x.id), ['b', 'a', 'c']);
  assert.equal(nextOrder(Q, 'd1'), 4); assert.equal(nextOrder(Q, 'zz'), 1);
});

test('coverage: يكشف البرامج بلا قالب أو بقالب فارغ', () => {
  const c = coverage(P, T, Q, L);
  assert.equal(c[0].ok, true); assert.equal(c[0].dailyQuestions, 3); assert.equal(c[0].finalQuestions, 1);
  assert.equal(c[1].ok, false); assert.equal(c[1].final?.id, 'f0'); assert.equal(c[1].finalQuestions, 0);
  assert.equal(c[2].ok, false); assert.equal(c[2].daily, null);
});

test('linkPlan/applyPlan: قالب واحد مفعّل لكل نوع', () => {
  const plan = linkPlan('p1', 'DAILY', 'd2', T, L);
  assert.deepEqual(plan.deactivate.map(l => l.template_id), ['d1']); assert.equal(plan.activate, null); assert.deepEqual(plan.insert, { program_id: 'p1', template_id: 'd2', is_active: true });
  const after = applyPlan(L, plan);
  assert.equal(after.find(l => l.program_id === 'p1' && l.template_id === 'd1')!.is_active, false);
  assert.equal(after.find(l => l.program_id === 'p1' && l.template_id === 'f1')!.is_active, true, 'الختامي لا يتأثر');
  const re = linkPlan('p3', 'DAILY', 'd2', T, L);
  assert.equal(re.activate?.template_id, 'd2'); assert.equal(re.insert, null);
  const off = linkPlan('p1', 'FINAL', null, T, L);
  assert.deepEqual(off.deactivate.map(l => l.template_id), ['f1']); assert.equal(off.insert, null);
});

test('duplicatePayload/previewGroups/stats/estimate', () => {
  const d = duplicatePayload(T[0], Q, '');
  assert.equal(d.template.name_ar, 'التقييم اليومي — نسخة'); assert.equal(d.template.kind, 'DAILY');
  assert.deepEqual(d.questions.map(x => [x.text_ar, x.order_index]), [['سb', 1], ['سa', 2], ['سc', 3]]);
  assert.ok(!('id' in d.questions[0]));
  const g = previewGroups(Q.filter(x => x.template_id === 'd1'));
  assert.deepEqual(g.map(x => [x.section, x.items.length]), [['عام', 2], ['رأيك', 1]]);
  const s = templateStats(T, Q, L);
  const d1 = s.find(x => x.template.id === 'd1')!; assert.equal(d1.questions, 3); assert.equal(d1.required, 2); assert.equal(d1.activePrograms, 2);
  assert.equal(estimateMinutes(Q.filter(x => x.template_id === 'd1')), 1);
  assert.equal(templateName(T[3]), 'قالب ختامي');
});
