// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م13-ب — المطابقة والترتيب: الاستجابة المركّبة «b-a-d-c» · كلّه أو لا شيء · بلا هجرة · الحزمة والمستورد والمحرّر والبنك والمحرّك والمِران */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComposite, isResponseFor, isIdentityKey, PLAYER_ITEM_TYPES, M1_ITEM_TYPES, isCompositeType, ITEM_TYPE_AR } from '../lib/miaar/registry';
import { optionList, leftList, loadApprovedPool, invalidatePoolCache, secureItems } from '../lib/miaar/bank';
import { normalizePack, importPack, acceptedOf, PACK_VERSION } from '../lib/miaar/pack';
import { gradeAnswer, correctText } from '../lib/miaar/practice';
import { fakeDb } from './iqra-fake-db';

const L = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), text: `يسار ${i + 1}` }));
const O = (ids: string, texts?: string[]) => ids.split('').map((id, i) => ({ id, text: texts?.[i] || `خيار ${id}` }));
const matching = (code = 'AR-LU-A2-M13B-001', extra: Record<string, unknown> = {}) => ({ item_code: code, level: 'A2', skill: 'grammar_vocab', item_type: 'matching', question_text: `صِل كلّ كلمة بضدّها ${code}`, left: L(3), options: O('abcd'), correct: 'b-a-d', descriptor_code: 'LU-A2-01', rationale: { 1: 'م', 2: 'م', 3: 'م' }, ...extra });
const ordering = (code = 'AR-RD-A2-M13B-001', extra: Record<string, unknown> = {}) => ({ item_code: code, level: 'A2', skill: 'reading', item_type: 'ordering', question_text: `رتّب الجمل لتكوّن فقرة ${code}`, options: O('abcd'), correct: 'c-a-d-b', descriptor_code: 'RD-A2-01', rationale: { why: 'الزمن' }, ...extra });
const pack = (items: unknown[]) => ({ version: PACK_VERSION, source: 'athar-m13b-A2', content_version: 'athar-m13b', passages: [], items, tasks: [] });
const db0 = () => fakeDb({ miaar_descriptors: [{ code: 'LU-A2-01', level: 'A2' }, { code: 'RD-A2-01', level: 'A2' }], question_bank_items: [], miaar_passages: [] });

test('م13-ب: السجلّ — النوعان في المشغّل · الاستجابة المركّبة تُحلَّل وتُفحص بالنوع · الهويّة تُكشف', () => {
  assert.deepEqual([...PLAYER_ITEM_TYPES], [...M1_ITEM_TYPES, 'matching', 'ordering', 'cloze_bank', 'picture_sequence']); assert.ok(isCompositeType('matching') && !isCompositeType('mcq'));
  assert.equal(ITEM_TYPE_AR.matching, 'مطابقة'); assert.equal(ITEM_TYPE_AR.ordering, 'ترتيب');
  assert.deepEqual(parseComposite('b-a-d-c'), ['b', 'a', 'd', 'c']); assert.equal(parseComposite('a-a-b'), null); assert.deepEqual(parseComposite('a-b'), ['a', 'b']); assert.equal(parseComposite('a'), null); assert.equal(parseComposite('ab-c'), null); assert.equal(parseComposite(7), null);
  const ids = ['a', 'b', 'c', 'd'];
  assert.ok(isResponseFor('mcq', ids, 0, 'c')); assert.ok(!isResponseFor('mcq', ids, 0, 'e')); assert.ok(!isResponseFor('mcq', ids, 0, 'a-b-c'));
  assert.ok(isResponseFor('matching', ids, 3, 'b-a-d')); assert.ok(!isResponseFor('matching', ids, 3, 'b-a-d-c'), 'طول العمود الأيسر'); assert.ok(!isResponseFor('matching', ids, 3, 'b-a-e'));
  assert.ok(isResponseFor('ordering', ids, 0, 'c-a-d-b')); assert.ok(!isResponseFor('ordering', ids, 0, 'c-a-d'), 'تبديل كامل'); assert.ok(!isResponseFor('ordering', ids, 0, 'c'));
  assert.ok(isIdentityKey('a-b-c-d', ids)); assert.ok(isIdentityKey('a-b-c', ids)); assert.ok(!isIdentityKey('b-a-c', ids));
});

test('م13-ب: optionList/leftList — حدود المطابقة [3,5] والترتيب [3,6] · اليسار 3–4 بلا تكرار · نصّ أو صورة', () => {
  assert.ok(optionList(O('abc'), 'matching')); assert.ok(optionList(O('abcde'), 'matching')); assert.equal(optionList(O('ab'), 'matching'), null); assert.equal(optionList(O('abcdef'), 'matching'), null);
  assert.ok(optionList(O('abcdef'), 'ordering')); assert.equal(optionList(O('ab'), 'ordering'), null);
  assert.ok(optionList([{ id: 'a', text: '', image: '/miaar/img/cat.svg' }, { id: 'b', text: 'ب' }, { id: 'c', text: 'ج' }], 'matching'), 'خيار مطابقة بصورة فقط');
  assert.ok(leftList(L(3))); assert.ok(leftList(L(4))); assert.equal(leftList(L(2)), null); assert.equal(leftList(L(5)), null);
  assert.equal(leftList([{ text: 'أ' }, { text: 'أ' }, { text: 'ب' }]), null, 'تكرار'); assert.equal(leftList([{ text: 'أ' }, { text: '' }, { text: 'ب' }]), null, 'عنصر فارغ');
  const l = leftList([{ text: 'x' }, { image: '/miaar/img/cat.svg', alt: 'قطّ' }, { text: 'z' }])!; assert.deepEqual(l.map((x) => x.id), ['1', '2', '3']); assert.equal(l[1].image, '/miaar/img/cat.svg');
});

test('م13-ب: normalizePack — المطابقة والترتيب يمرّان · وتُرفض: بلا left · خيارات زائدة · مفتاح ناقص/مكرّر · ترتيب هويّة · وتحذّر: مطابقة هويّة ومبرّر ناقص', () => {
  const ok = normalizePack(pack([matching(), ordering()])); assert.ok(ok.ok, JSON.stringify((ok as any).problems)); if (!ok.ok) return;
  assert.equal(ok.pack.items[0].left?.length, 3); assert.equal(ok.pack.items[0].correct, 'b-a-d'); assert.equal(ok.pack.items[1].correct, 'c-a-d-b'); assert.equal(ok.pack.items[1].left, undefined);
  assert.deepEqual(ok.pack.items[1].rationale, { why: 'الزمن' }); assert.equal(ok.warnings.filter((w) => /مبرّر/.test(w.msg)).length, 0);
  const problemsOf = (it: unknown) => { const n = normalizePack(pack([it])); return n.ok ? [] : n.problems.map((p) => p.msg); };
  assert.match(problemsOf(matching('AR-LU-A2-M13B-002', { left: undefined })).join(' '), /left/);
  assert.match(problemsOf(matching('AR-LU-A2-M13B-003', { options: O('abcde') })).join(' '), /خيارات المطابقة 5/);
  assert.match(problemsOf(matching('AR-LU-A2-M13B-004', { correct: 'b-a' })).join(' '), /مفتاح المطابقة/);
  assert.match(problemsOf(matching('AR-LU-A2-M13B-005', { correct: 'b-b-a' })).join(' '), /مفتاح المطابقة/);
  assert.match(problemsOf(ordering('AR-RD-A2-M13B-002', { correct: 'a-b-c-d' })).join(' '), /بترتيبها الصحيح/);
  assert.match(problemsOf(ordering('AR-RD-A2-M13B-003', { correct: 'a-b-c' })).join(' '), /مفتاح الترتيب/);
  assert.match(problemsOf(ordering('AR-RD-A2-M13B-004', { options: [...O('abc'), { id: 'd', text: 'خيار a' }] })).join(' '), /متطابقان/);
  const warn = normalizePack(pack([matching('AR-LU-A2-M13B-006', { correct: 'a-b-c', rationale: {} }), ordering('AR-RD-A2-M13B-005', { rationale: {} })])); assert.ok(warn.ok);
  const msgs = warn.warnings.map((w) => w.msg).join(' | '); assert.match(msgs, /الهويّة/); assert.match(msgs, /عناصر المطابقة/); assert.match(msgs, /rationale\.why/);
  /* توزيع المفاتيح لا يحسب المركّب (لا تحذير «المفتاح b-a-d في 100%») */
  const many = normalizePack(pack(Array.from({ length: 9 }, (_, i) => matching(`AR-LU-A2-M13B-10${i}`)))); assert.ok(many.ok); assert.equal(many.warnings.filter((w) => /وزّع المفاتيح/.test(w.msg)).length, 0);
  /* الأنواع غير المبنية ما زالت مرفوضة */
  assert.match(problemsOf({ ...ordering('AR-RD-A2-M13B-009'), item_type: 'word_tap' }).join(' '), /غير مدعوم/);
});

test('م13-ب: importPack — stimulus.left والمفتاح المركّب و accepted المقروء · التشغيل الجافّ لا يكتب', async () => {
  const n = normalizePack(pack([matching(), ordering()])); assert.ok(n.ok); if (!n.ok) return;
  const db = db0(); const dry = await importPack(db, n.pack, { id: 'u1' }, { dryRun: true }); assert.equal(dry.items_created, 2); assert.equal(db.T.question_bank_items.length, 0);
  const r = await importPack(db, n.pack, { id: 'u1' }); assert.equal(r.items_created, 2); assert.equal(r.rejected.length, 0);
  const m = db.T.question_bank_items.find((x: any) => x.item_type === 'matching'); assert.deepEqual(m.stimulus.left.map((l: any) => l.id), ['1', '2', '3']); assert.equal(m.status, 'in_review');
  const o = db.T.question_bank_items.find((x: any) => x.item_type === 'ordering'); assert.equal(o.stimulus, null);
  const km = db.T.question_bank_answer_keys.find((k: any) => k.item_id === m.id); assert.equal(km.correct_option_id, 'b-a-d'); assert.deepEqual(km.accepted.pairs.map((p: any) => p.right_id), ['b', 'a', 'd']); assert.equal(km.accepted.pairs[0].l, 'يسار 1');
  const ko = db.T.question_bank_answer_keys.find((k: any) => k.item_id === o.id); assert.deepEqual(ko.accepted.order, ['c', 'a', 'd', 'b']); assert.deepEqual(ko.accepted.order_text, ['خيار c', 'خيار a', 'خيار d', 'خيار b']);
  assert.deepEqual(acceptedOf({ item_type: 'mcq', options: O('ab'), correct: 'a' } as any).pairs, []);
});

test('م13-ب: البنك المعتمد — المطابقة تحتاج left والمفتاح بالنوع · SecureItem يحمل النوع والمعرّفات · النموذج العام يعرض left', async () => {
  invalidatePoolCache();
  const items = [
    { id: 'i1', item_code: 'M-OK', level: 'A2', skill: 'grammar_vocab', item_type: 'matching', question_text: 'صل', options: O('abcd'), stimulus: { left: L(3) }, status: 'approved' },
    { id: 'i2', item_code: 'M-NOLEFT', level: 'A2', skill: 'grammar_vocab', item_type: 'matching', question_text: 'صل', options: O('abcd'), stimulus: null, status: 'approved' },
    { id: 'i3', item_code: 'O-OK', level: 'A2', skill: 'grammar_vocab', item_type: 'ordering', question_text: 'رتب', options: O('abcd'), status: 'approved' },
    { id: 'i4', item_code: 'O-BADKEY', level: 'A2', skill: 'grammar_vocab', item_type: 'ordering', question_text: 'رتب', options: O('abcd'), status: 'approved' },
    { id: 'i5', item_code: 'Q-OK', level: 'A2', skill: 'grammar_vocab', item_type: 'mcq', question_text: 'اختر', options: O('abcd'), status: 'approved' },
  ];
  const keys = [{ item_id: 'i1', correct_option_id: 'b-a-d' }, { item_id: 'i2', correct_option_id: 'b-a-d' }, { item_id: 'i3', correct_option_id: 'c-a-d-b' }, { item_id: 'i4', correct_option_id: 'c-a-d' }, { item_id: 'i5', correct_option_id: 'b' }];
  const db = fakeDb({ question_bank_items: items, question_bank_answer_keys: keys, miaar_passages: [] });
  const pool = await loadApprovedPool(db); assert.deepEqual(pool.map((p) => p.code).sort(), ['M-OK', 'O-OK', 'Q-OK']);
  const m = pool.find((p) => p.code === 'M-OK')!; assert.equal(m.left?.length, 3); assert.equal(m.correctOptionId, 'b-a-d');
  const sec = secureItems(pool, ['M-OK', 'O-OK', 'Q-OK'])!; assert.equal(sec[0].type, 'matching'); assert.equal(sec[0].leftCount, 3); assert.deepEqual(sec[1].optionIds, ['a', 'b', 'c', 'd']);
  assert.ok(isResponseFor(sec[0].type!, sec[0].optionIds!, sec[0].leftCount!, 'a-b-c')); assert.ok(!isResponseFor(sec[0].type!, sec[0].optionIds!, sec[0].leftCount!, 'a'));
  const { formFromPool } = await import('../lib/miaar/bank'); const f = (await formFromPool(db, pool, ['M-OK', 'O-OK'], new Map()))!; assert.ok(f); assert.equal(f.questions[0].left?.length, 3); assert.equal(f.questions[1].left, undefined);
  invalidatePoolCache();
});

test('م13-ب: المِران — التصحيح كلّه أو لا شيء · نصّ المفتاح للعرض «١ ← ب» وللترتيب القطع بترتيبها', () => {
  const m = { type: 'matching' as const, options: O('abcd', ['بارد', 'كبير', 'قصير', 'بطيء']), left: [{ id: '1', text: 'حارّ' }, { id: '2', text: 'صغير' }, { id: '3', text: 'سريع' }], correctOptionId: 'a-b-d', descriptor: 'LU-A2-01' };
  assert.equal(gradeAnswer(m, 'a-b-d').correct, true); assert.equal(gradeAnswer(m, 'a-d-b').correct, false, 'زوج واحد خطأ = البند خطأ');
  assert.equal(correctText(m), 'حارّ ← بارد · صغير ← كبير · سريع ← بطيء');
  const o = { type: 'ordering' as const, options: O('abcd', ['ثمّ نام', 'استيقظ', 'ثمّ عمل', 'أكل']), correctOptionId: 'b-d-c-a', descriptor: null };
  assert.equal(gradeAnswer(o, 'b-d-c-a').correct, true); assert.equal(correctText(o), 'استيقظ ← أكل ← ثمّ عمل ← ثمّ نام'); assert.match(gradeAnswer(o, 'a-b-c-d').why_ar, /استيقظ ← أكل/);
  assert.equal(correctText({ options: O('ab', ['نعم', 'لا']), correctOptionId: 'b' }), 'لا');
});

/* ───────── م14: الفراغات بمصرف كلمات · تسلسل الصور ───────── */
import { countBlanks, isSlotType, isPermutationType } from '../lib/miaar/registry';
const cloze = (code = 'AR-LU-A2-M14-001', extra: Record<string, unknown> = {}) => ({ item_code: code, level: 'A2', skill: 'grammar_vocab', item_type: 'cloze_bank', question_text: `ذهبت ___ السوق ___ اشتريت خبزا. ${code}`, options: O('abcd', ['ثم', 'إلى', 'على', 'لكن']), correct: 'b-a', descriptor_code: 'LU-A2-01', rationale: { 1: 'حرف جر', 2: 'عطف' }, ...extra });
const pseq = (code = 'AR-RD-A2-M14-001', extra: Record<string, unknown> = {}) => ({ item_code: code, level: 'A2', skill: 'reading', item_type: 'picture_sequence', question_text: `رتب الصور بحسب الوقت ${code}`, options: [{ id: 'a', text: '', image: '/miaar/img/clock6.svg', alt: 'السادسة' }, { id: 'b', text: '', image: '/miaar/img/clock3.svg', alt: 'الثالثة' }, { id: 'c', text: '', image: '/miaar/img/clock9.svg', alt: 'التاسعة' }], correct: 'b-a-c', descriptor_code: 'RD-A2-01', rationale: { why: 'الوقت' }, ...extra });

test('م14: السجلّ — عدّ الفراغات · الفراغات كالمطابقة (طول = الفراغات) · التسلسل كالترتيب (تبديل كامل)', () => {
  assert.equal(countBlanks('أنا ___ من ___.'), 2); assert.equal(countBlanks('بلا فراغ'), 0); assert.equal(countBlanks('____ و ______'), 2); assert.equal(countBlanks('__ قصير'), 0);
  assert.ok(isSlotType('cloze_bank') && isSlotType('matching') && !isSlotType('ordering')); assert.ok(isPermutationType('picture_sequence') && !isPermutationType('cloze_bank'));
  assert.ok(isResponseFor('cloze_bank', ['a', 'b', 'c', 'd'], 2, 'a-b')); assert.ok(!isResponseFor('cloze_bank', ['a', 'b', 'c', 'd'], 2, 'a-b-c'));
  assert.ok(isResponseFor('picture_sequence', ['a', 'b', 'c'], 0, 'b-a-c')); assert.ok(!isResponseFor('picture_sequence', ['a', 'b', 'c'], 0, 'b-a'));
  assert.ok(PLAYER_ITEM_TYPES.includes('cloze_bank') && PLAYER_ITEM_TYPES.includes('picture_sequence'));
});

test('م14: normalizePack — الفراغات والتسلسل يمرّان · رفض: فراغ واحد · مصرف صغير/كبير · مفتاح بطول خاطئ · تسلسل بلا صور · تسلسل هويّة', () => {
  const ok = normalizePack(pack([cloze(), pseq()])); assert.ok(ok.ok, JSON.stringify((ok as any).problems)); if (!ok.ok) return;
  assert.equal(ok.pack.items[0].correct, 'b-a'); assert.deepEqual(ok.pack.items[0].rationale, { 1: 'حرف جر', 2: 'عطف' }); assert.equal(ok.warnings.length, 0, JSON.stringify(ok.warnings));
  const problemsOf = (it: unknown) => { const n = normalizePack(pack([it])); return n.ok ? [] : n.problems.map((p) => p.msg); };
  assert.match(problemsOf(cloze('AR-LU-A2-M14-002', { question_text: 'فراغ ___ واحد فقط' })).join(' '), /2–4 فراغات/);
  assert.match(problemsOf(cloze('AR-LU-A2-M14-003', { options: O('ab') })).join(' '), /غير صالحة/); assert.match(problemsOf(cloze('AR-LU-A2-M14-003', { question_text: 'أنا ___ من ___ في ___.', options: O('abc'), correct: 'b-a-c' })).join(' '), /مصرف الكلمات 3/);
  assert.match(problemsOf(cloze('AR-LU-A2-M14-004', { options: O('abcde') })).join(' '), /مصرف الكلمات 5/);
  assert.match(problemsOf(cloze('AR-LU-A2-M14-005', { correct: 'b-a-c' })).join(' '), /مفتاح الفراغات/);
  assert.match(problemsOf(pseq('AR-RD-A2-M14-002', { options: O('abc') })).join(' '), /الخيارات غير صالحة/);
  assert.match(problemsOf(pseq('AR-RD-A2-M14-003', { correct: 'a-b-c' })).join(' '), /بترتيبها الصحيح/);
  const warn = normalizePack(pack([cloze('AR-LU-A2-M14-006', { correct: 'a-b', options: O('abc', ['إلى', 'ثم', 'على']), rationale: {} })])); assert.ok(warn.ok); assert.match(warn.warnings.map((w) => w.msg).join('|'), /الهويّة/); assert.match(warn.warnings.map((w) => w.msg).join('|'), /الفراغات/);
});

test('م14: importPack يكتب accepted.fills/order · البنك المعتمد يحسب الفراغات من النصّ · المِران يعرض «١ ← كلمة»', async () => {
  const n = normalizePack(pack([cloze(), pseq()])); assert.ok(n.ok); if (!n.ok) return;
  const db = db0(); const r = await importPack(db, n.pack, { id: 'u1' }); assert.equal(r.items_created, 2);
  const c = db.T.question_bank_items.find((x: any) => x.item_type === 'cloze_bank'); const kc = db.T.question_bank_answer_keys.find((k: any) => k.item_id === c.id); assert.deepEqual(kc.accepted.fills.map((f: any) => f.r), ['إلى', 'ثم']);
  const sq = db.T.question_bank_items.find((x: any) => x.item_type === 'picture_sequence'); const ks = db.T.question_bank_answer_keys.find((k: any) => k.item_id === sq.id); assert.deepEqual(ks.accepted.order_text, ['الثالثة', 'السادسة', 'التاسعة']);
  invalidatePoolCache();
  const items = [
    { id: 'c1', item_code: 'C-OK', level: 'A2', skill: 'grammar_vocab', item_type: 'cloze_bank', question_text: 'أنا ___ من ___.', options: O('abc'), status: 'approved' },
    { id: 'c2', item_code: 'C-ONE', level: 'A2', skill: 'grammar_vocab', item_type: 'cloze_bank', question_text: 'فراغ ___ واحد', options: O('abc'), status: 'approved' },
    { id: 'p1', item_code: 'P-OK', level: 'A2', skill: 'reading', item_type: 'picture_sequence', question_text: 'رتب', options: pseq().options, status: 'approved' },
  ];
  const keys = [{ item_id: 'c1', correct_option_id: 'b-a' }, { item_id: 'c2', correct_option_id: 'b' }, { item_id: 'p1', correct_option_id: 'b-a-c' }];
  const pool = await loadApprovedPool(fakeDb({ question_bank_items: items, question_bank_answer_keys: keys, miaar_passages: [] }));
  assert.deepEqual(pool.map((p) => p.code).sort(), ['C-OK', 'P-OK']);
  const sec = secureItems(pool, ['C-OK', 'P-OK'])!; assert.equal(sec[0].leftCount, 2); assert.ok(isResponseFor(sec[0].type!, sec[0].optionIds!, sec[0].leftCount!, 'a-c'));
  const cl = pool.find((p) => p.code === 'C-OK')!; assert.equal(correctText({ ...cl, options: O('abc', ['طالب', 'مصر', 'في']) }), '1 ← مصر · 2 ← طالب');
  assert.equal(correctText({ type: 'picture_sequence', options: pseq().options, correctOptionId: 'b-a-c' }), 'الثالثة ← السادسة ← التاسعة');
  invalidatePoolCache();
});
