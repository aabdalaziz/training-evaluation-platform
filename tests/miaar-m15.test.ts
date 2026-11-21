/* مِعيار م15 — مكتب المراجعة: القفل · الفحص الآلي · المفتاح المقروء · ملخّص التقدّم */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canApprove, isOwnItem, creatorsOf, reviewChecklist, keyText, reviewSummary, APPROVE_REASON_AR } from '../lib/miaar/review';

const O = (ids: string, texts?: string[]) => [...ids].map((id, i) => ({ id, text: texts ? texts[i] : `خيار ${id}` }));

test('م15: canApprove — المستورِد لا يعتمد بنده · مراجع آخر يعتمد · الاستثناء للمدير مع ملاحظة فقط', () => {
  const imported = { created_by: 'u-owner', author_notes: { imported_by: 'u-owner', options: {} } };
  assert.deepEqual(creatorsOf(imported), ['u-owner']); assert.ok(isOwnItem(imported, { id: 'u-owner' })); assert.ok(!isOwnItem(imported, { id: 'u-rev' }));
  assert.deepEqual(canApprove(imported, { id: 'u-rev', role: 'QUALITY_ANALYST' }), { ok: true, self: false });
  assert.deepEqual(canApprove(imported, { id: 'u-owner', role: 'SUPER_ADMIN' }), { ok: false, reason: 'own_item' });
  assert.deepEqual(canApprove(imported, { id: 'u-owner', role: 'QUALITY_ANALYST' }, { selfApprove: true, note: 'سبب' }), { ok: false, reason: 'self_needs_admin' });
  assert.deepEqual(canApprove(imported, { id: 'u-owner', role: 'ADMIN' }, { selfApprove: true, note: '' }), { ok: false, reason: 'self_needs_note' });
  assert.deepEqual(canApprove(imported, { id: 'u-owner', role: 'ADMIN' }, { selfApprove: true, note: 'لا مراجع ثانٍ متاح هذا الأسبوع' }), { ok: true, self: true });
  /* البند المنسوب لمستورِد مختلف عن created_by (نُقل الملف) — كلاهما «صاحب» */
  const two = { created_by: 'u-a', author_notes: { imported_by: 'u-b' } }; assert.ok(isOwnItem(two, { id: 'u-a' }) && isOwnItem(two, { id: 'u-b' }));
  assert.ok(Object.keys(APPROVE_REASON_AR).length === 3);
});

test('م15: reviewChecklist — فراغات سليمة كلّها أخضر · فراغ ناقص/هويّة/مبرّر ناقص/تشكيل زائد كهرماني · mcq بلا مفتاح', () => {
  const good = { item_type: 'cloze_bank', level: 'B1', skill: 'grammar_vocab', question_text: 'رغب ___ السفر، وبحث ___ تذكرة.', options: O('abc', ['عن', 'في', 'إلى']), correct: 'b-a', author_notes: { options: { 1: 'x', 2: 'y' } } };
  assert.ok(reviewChecklist(good).every((c) => c.ok), JSON.stringify(reviewChecklist(good).filter((c) => !c.ok)));
  const bad = reviewChecklist({ ...good, question_text: 'فراغ ___ واحد', correct: 'a-b', author_notes: { options: { 1: 'x' } }, level: 'C1' });
  const warn = Object.fromEntries(bad.map((c) => [c.code, c.ok]));
  assert.equal(warn.key_shape, false); assert.equal(warn.blanks, false); assert.equal(warn.identity, false); assert.equal(warn.rationale, false);
  const tash = reviewChecklist({ ...good, level: 'C2', question_text: 'رَغِبَ ___ السَّفَرِ، وَبَحَثَ ___ تَذْكِرَةٍ.' }).find((c) => c.code === 'tashkeel')!; assert.equal(tash.ok, false); assert.match(tash.msg, /زائد/);
  const a1 = reviewChecklist({ ...good, level: 'A1' }).find((c) => c.code === 'tashkeel')!; assert.equal(a1.ok, false); assert.match(a1.msg, /ناقص/);
  const mcq = reviewChecklist({ item_type: 'mcq', level: 'A2', skill: 'reading', question_text: 'س؟', options: O('abcd'), correct: null, passage_id: null, author_notes: { options: { a: '1', b: '2', c: '3', d: '4' } } });
  const m = Object.fromEntries(mcq.map((c) => [c.code, c.ok])); assert.equal(m.key_shape, false); assert.equal(m.passage, false); assert.equal(m.rationale, true);
  const li = reviewChecklist({ item_type: 'mcq', level: 'A2', skill: 'listening', question_text: 'س؟', options: O('abcd'), correct: 'b', passage_id: 'L-1', passage: { skill: 'listening', status: 'in_review', audio_public_path: null, audio_storage_path: null }, author_notes: {} });
  const l = Object.fromEntries(li.map((c) => [c.code, c.ok])); assert.equal(l.audio, false); assert.equal(l.passage_status, false);
  const pseq = reviewChecklist({ item_type: 'picture_sequence', level: 'A1', skill: 'reading', question_text: 'رَتِّبْ', options: [{ id: 'a', text: '', image: '/x.svg', alt: '' }, { id: 'b', text: '', image: '/y.svg', alt: 'ب' }, { id: 'c', text: '', image: '/z.svg', alt: 'ج' }], correct: 'b-a-c', passage_id: null, author_notes: { options: { why: 'w' } } });
  assert.equal(pseq.find((c) => c.code === 'alt')!.ok, false); assert.equal(pseq.find((c) => c.code === 'identity')!.ok, true);
});

test('م15: keyText — mcq · فراغات · مطابقة · ترتيب', () => {
  assert.equal(keyText({ item_type: 'mcq', options: O('abcd', ['١', '٢', '٣', '٤']), correct: 'c' }), 'c · ٣');
  assert.equal(keyText({ item_type: 'cloze_bank', options: O('abc', ['عن', 'في', 'إلى']), correct: 'b-a' }), '1 ← في · 2 ← عن');
  assert.equal(keyText({ item_type: 'matching', options: O('abc', ['بعيد', 'صغير', 'قديم']), correct: 'b-a-c', stimulus: { left: [{ id: '1', text: 'كبير' }, { id: '2', text: 'قريب' }, { id: '3', text: 'جديد' }] } }), 'كبير ← صغير · قريب ← بعيد · جديد ← قديم');
  assert.equal(keyText({ item_type: 'picture_sequence', options: [{ id: 'a', text: '', alt: 'التاسعة' }, { id: 'b', text: '', alt: 'الثالثة' }], correct: 'b-a' }), 'الثالثة ← التاسعة');
  assert.equal(keyText({ item_type: 'mcq', options: O('ab'), correct: null }), '—');
});

test('م15: reviewSummary — تجميع دفعة × مستوى × حالة', () => {
  const s = reviewSummary([{ batch: 'athar-m14', level: 'A1', status: 'in_review', n: 12 }, { batch: 'athar-m14', level: 'A1', status: 'approved', n: 3 }, { batch: 'athar-m14', level: 'B1', status: 'in_review', n: 12 }, { batch: 'athar-m13b', level: 'A1', status: 'in_review', n: 12 }]);
  assert.deepEqual(s['athar-m14'].total, { in_review: 24, approved: 3 }); assert.deepEqual(s['athar-m14'].levels.A1, { in_review: 12, approved: 3 }); assert.equal(s['athar-m13b'].total.in_review, 12);
});
