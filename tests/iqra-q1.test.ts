// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «اقْرَأْ — من أَثَر» ق1 — المستويات السبعة · الحزمة (فحص/تطبيع/تحويل إلى البنك) · ما يراه المتعلّم بلا مفاتيح · التصحيح · التكرار المتباعد · السلسلة · البوّابة (لا رِواق بلا قرار مِعيار) · الاستيراد والاعتماد · الحلقة والإجابة والإغلاق · أراجع · دفتري · k≥5 · الخزنة والمسارات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IQRA_LEVELS, LEVEL_META, levelLabel, levelFromDecision, nextLevel, IQRA_LIMITS, IQRA_NAMES_AR, UI_AR, isIqraLevel } from '../lib/iqra/registry';
import { normalizePack, exerciseToBank, publicExercise, grade, nextInterval, streakDays, scorePct, lessonCode, itemCode, unitLevel, LESSON_CODE_RE } from '../lib/iqra/content';
import { gate, manualEnrol, learnerHome, lessonView, answerItem, finishLesson, reviewsDue, reviewAnswer, notebook, importPack, setLessonStatus, adminOverview, adminLessons, adminLesson, forgetLearner, riyadhDate } from '../lib/iqra/store';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { UNIT_LEVELS, UNIT_CODE_RE } from '../lib/miaar/syllabus';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PACK_A1 = JSON.parse(read('tools/iqra/packs/iqra-pack-A1-batch1.json'));
const PACK_S = JSON.parse(read('tools/iqra/packs/iqra-pack-A2-C2-samples.json'));
const STAFF = { email: 'admin@athar-portal.com', id: 'u1' };

import { fakeDb } from './iqra-fake-db';
const UNIT = (code: string, title = code) => ({ code, level: unitLevel(code), idx: Number(code.slice(-2)), title_ar: title, title_en: title, focus_ar: 'تركيز', domains: ['personal'], descriptor_codes: [], status: 'approved' });
const UNITS_A1 = ['A1-U01', 'A1-U02', 'A1-U03', 'A1-U04', 'A1-U05', 'A1-U06', 'A1-U07', 'A1-U08'].map((c) => UNIT(c, `منزلة ${c}`));
async function seeded(approveAll = true) {
  const db = fakeDb({ miaar_syllabus_units: [...UNITS_A1, UNIT('A2-U01'), UNIT('A2-U03'), UNIT('B1-U03'), UNIT('B1-U05'), UNIT('B1-U07'), UNIT('B2-U05'), UNIT('C1-U03'), UNIT('C2-U03')] });
  const n = normalizePack(PACK_A1); assert.ok(n.ok); const rep = await importPack(db, n.pack, STAFF, 'batch-1');
  if (approveAll) for (const l of db.T.iqra_lessons) { const r = await setLessonStatus(db, l.id, 'approved', STAFF, null); assert.ok(r.ok, l.code); }
  return { db, rep };
}
const enrolled = (level = 'A1') => ({ id: 'e1', learner_email: 'l@x.sa', user_id: null, level: level as any, source: 'manual', report_id: null, active: true, created_at: new Date().toISOString() });

test('اقْرَأْ: المستويات السبعة بأسمائها المدمجة · الخريطة اتّسعت · أسماء المنتج بالتشكيل · «قريبًا» بلا مفتاح', () => {
  assert.deepEqual([...IQRA_LEVELS], ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']); assert.deepEqual([...UNIT_LEVELS], [...IQRA_LEVELS]);
  assert.equal(levelLabel('A1'), 'مكتشف · A1'); assert.equal(levelLabel('PRE_A1'), 'تمهيدي · Pre-A1'); assert.equal(levelLabel('C2'), 'متقن · C2');
  for (const L of IQRA_LEVELS) { assert.ok(LEVEL_META[L].line_ar.length > 10 && LEVEL_META[L].can_ar.length > 10, L); }
  assert.equal(levelFromDecision('BELOW_A1'), 'PRE_A1'); assert.equal(levelFromDecision('B1'), 'B1'); assert.equal(levelFromDecision('X'), null); assert.equal(nextLevel('C2'), null); assert.equal(nextLevel('A1'), 'A2');
  assert.equal(IQRA_NAMES_AR.full, 'اقْرَأْ — من أَثَر', 'الاسم الرسمي بالتشكيل'); assert.equal(IQRA_NAMES_AR.product, 'اقْرَأْ');
  assert.match(IQRA_NAMES_AR.tutor_soon, /قريبًا/); assert.match(IQRA_NAMES_AR.voice_soon, /قريبًا/);
  assert.ok(UI_AR.gate_title && UI_AR.pending_title && UI_AR.gate_cta); assert.equal(IQRA_LIMITS.lesson_pass_pct, 70); assert.deepEqual([...IQRA_LIMITS.review_steps_days], [1, 3, 7, 14, 30]); assert.equal(IQRA_LIMITS.k_min, 5);
  assert.ok(UNIT_CODE_RE.test('PRE_A1-U03') && UNIT_CODE_RE.test('C2-U10') && !UNIT_CODE_RE.test('A1-U1')); assert.ok(isIqraLevel('B2') && !isIqraLevel('b2'));
});

test('اقْرَأْ: الحزمتان المولَّدتان صالحتان (11 + 10 حلقة) · رموز الحلقات والبنود · التطبيع يرفض الناقص ويحذّر من الطويل', () => {
  const a = normalizePack(PACK_A1); assert.ok(a.ok); if (!a.ok) return;
  assert.equal(a.pack.lessons.length, 11); assert.equal(a.pack.lessons.reduce((s, l) => s + l.cards.length, 0), 59); assert.equal(a.pack.lessons.reduce((s, l) => s + l.exercises.length, 0), 33);
  for (const l of a.pack.lessons) { assert.match(l.code, LESSON_CODE_RE); assert.equal(l.code, lessonCode(l.unit_code, l.idx)); assert.ok(l.exercises.length >= 3, l.code); assert.ok(l.content.intro_ar && l.content.closing_ar, l.code); }
  assert.equal(new Set(a.pack.lessons.map((l) => l.code)).size, 11, 'لا تكرار');
  const kinds = new Set(a.pack.lessons.flatMap((l) => l.exercises.map((e) => e.kind))); assert.deepEqual([...kinds].sort(), ['matching', 'mcq', 'ordering']);
  const s = normalizePack(PACK_S); assert.ok(s.ok); if (!s.ok) return; assert.equal(s.pack.lessons.length, 10); assert.deepEqual([...new Set(s.pack.lessons.map((l) => unitLevel(l.unit_code)))].sort(), ['A2', 'B1', 'B2', 'C1', 'C2']);
  assert.equal(itemCode('A1-U01-L01', 3), 'IQ-A1-U01-L01-03');
  const bad = normalizePack({ version: 'x' }); assert.equal(bad.ok, false);
  const bad2 = normalizePack({ version: 'iqra-pack-1', source: 't', lessons: [{ unit_code: 'A1-U1', idx: 1, title_ar: 'x', content: {}, cards: [], exercises: [] }] }); assert.equal(bad2.ok, false); if (!bad2.ok) assert.ok(bad2.problems.length >= 1);
  const bad3 = normalizePack({ version: 'iqra-pack-1', source: 't', lessons: [{ unit_code: 'A1-U01', idx: 1, title_ar: 'حلقة', content: { intro_ar: 'م' }, cards: [], exercises: [{ kind: 'mcq', prompt_ar: 's', options: ['a'], correct: 0 }] }] });
  assert.equal(bad3.ok, false, 'اختيار بخيار واحد مرفوض');
  const ok1 = normalizePack({ version: 'iqra-pack-1', source: 't', lessons: [{ unit_code: 'A1-U01', idx: 1, title_ar: 'حلقة', content: { intro_ar: 'م' }, cards: [], exercises: [{ kind: 'ordering', prompt_ar: 'رتّب', words: ['أنا', 'طالب'], order: ['أنا', 'طالب'] }, { kind: 'matching', prompt_ar: 'طابق', pairs: [{ l: 'أ', r: '1' }, { l: 'ب', r: '2' }] }] }] });
  assert.ok(ok1.ok); if (ok1.ok) assert.equal(ok1.pack.lessons[0].code, 'A1-U01-L01');
});

test('اقْرَأْ: التحويل إلى البنك (source_kind=iqra · content_version=iqra-q1 · مسوَّدة · 4 خيارات a–d) · ما يراه المتعلّم بلا مفاتيح وبخلط ثابت · التصحيح للأنواع الثلاثة', () => {
  const mcq = exerciseToBank({ kind: 'mcq', prompt_ar: 'ما معنى؟', options: ['١', '٢', '٣', '٤'], correct: 2, explanation_ar: 'لأن' }, 'A1-U01-L01', 1, 'A1', 'A1-U01');
  assert.equal(mcq.source_kind, 'iqra'); assert.equal(mcq.content_version, 'iqra-q1'); assert.equal(mcq.status, 'draft'); assert.equal(mcq.item_code, 'IQ-A1-U01-L01-01'); assert.deepEqual(mcq.options.map((o) => o.id), ['a', 'b', 'c', 'd']); assert.equal(mcq.key.correct_option_id, 'c'); assert.equal(mcq.skill, 'grammar_vocab'); assert.deepEqual(mcq.unit_codes, ['A1-U01']);
  const m = exerciseToBank({ kind: 'matching', prompt_ar: 'طابق', pairs: [{ l: 'كتاب', r: 'book' }, { l: 'قلم', r: 'pen' }, { l: 'باب', r: 'door' }] }, 'A1-U01-L01', 2, 'A1', 'A1-U01'); assert.equal(m.key.correct_option_id, 'match'); assert.equal((m.key.accepted as any).pairs.length, 3);
  const o = exerciseToBank({ kind: 'ordering', prompt_ar: 'رتّب', words: ['طالب', 'أنا', 'جديد'], order: ['أنا', 'طالب', 'جديد'] }, 'A1-U01-L01', 3, 'A1', 'A1-U01'); assert.equal(o.key.correct_option_id, 'order');
  const pm = publicExercise({ id: 'i1', item_type: 'mcq', question_text: mcq.question_text, options: mcq.options, stimulus: mcq.stimulus })!; assert.equal(pm.kind, 'mcq'); assert.equal(pm.options!.length, 4); assert.equal(JSON.stringify(pm).includes('correct'), false, 'لا مفتاح في الردّ');
  const pmatch = publicExercise({ id: 'i2', item_type: 'matching', question_text: 'طابق', options: [], stimulus: m.stimulus })!; assert.deepEqual(pmatch.left, ['كتاب', 'قلم', 'باب']); assert.deepEqual([...pmatch.right!].sort(), ['book', 'door', 'pen']);
  const again = publicExercise({ id: 'i2', item_type: 'matching', question_text: 'طابق', options: [], stimulus: m.stimulus })!; assert.deepEqual(again.right, pmatch.right, 'الخلط ثابت للبند نفسه');
  const po = publicExercise({ id: 'i3', item_type: 'ordering', question_text: 'رتّب', options: [], stimulus: o.stimulus })!; assert.deepEqual([...po.words!].sort(), ['أنا', 'جديد', 'طالب']); assert.equal(JSON.stringify(po).includes('"order"'), false);
  assert.equal(publicExercise({ id: 'x', item_type: 'cloze_bank', question_text: 'q', options: [], stimulus: {} }), null, 'أنواع البنك الأخرى لا تدخل اقْرَأْ');
  /* التصحيح */
  const gm = grade({ item_type: 'mcq', stimulus: mcq.stimulus }, mcq.key, { option: 'c' })!; assert.equal(gm.correct, true); assert.equal(gm.explanation_ar, 'لأن'); assert.equal(gm.correct_option, 'c');
  assert.equal(grade({ item_type: 'mcq', stimulus: {} }, mcq.key, { option: 'a' })!.correct, false); assert.equal(grade({ item_type: 'mcq', stimulus: {} }, mcq.key, {}), null);
  assert.equal(grade({ item_type: 'matching', stimulus: m.stimulus }, m.key, { pairs: [['كتاب', 'book'], ['قلم', 'pen'], ['باب', 'door']] })!.correct, true);
  assert.equal(grade({ item_type: 'matching', stimulus: m.stimulus }, m.key, { pairs: [['كتاب', 'pen'], ['قلم', 'book'], ['باب', 'door']] })!.correct, false);
  assert.equal(grade({ item_type: 'matching', stimulus: m.stimulus }, m.key, { pairs: [['كتاب', 'book']] })!.correct, false, 'ناقص = خطأ');
  assert.equal(grade({ item_type: 'ordering', stimulus: o.stimulus }, o.key, { order: ['أنا', 'طالب', 'جديد'] })!.correct, true); assert.equal(grade({ item_type: 'ordering', stimulus: o.stimulus }, o.key, { order: ['طالب', 'أنا', 'جديد'] })!.correct, false);
  assert.deepEqual(grade({ item_type: 'ordering', stimulus: o.stimulus }, o.key, { order: [] })!.correct_order, ['أنا', 'طالب', 'جديد'], 'الصواب يُعاد بعد الإجابة');
});

test('اقْرَأْ: التكرار المتباعد 1·3·7·14·30 · النسبة · سلسلة الأيام بتوقيت الرياض', () => {
  assert.equal(nextInterval(1, 'good'), 3); assert.equal(nextInterval(3, 'good'), 7); assert.equal(nextInterval(7, 'easy'), 30); assert.equal(nextInterval(30, 'good'), 30); assert.equal(nextInterval(14, 'again'), 1); assert.equal(nextInterval(5 as any, 'good'), 3, 'قيمة غريبة تبدأ من أوّل السلّم');
  assert.equal(scorePct(2, 3), 67); assert.equal(scorePct(0, 0), 0); assert.equal(scorePct(7, 10), 70);
  assert.equal(streakDays(['2026-11-17', '2026-11-16', '2026-11-15'], '2026-11-17'), 3); assert.equal(streakDays(['2026-11-16', '2026-11-15'], '2026-11-17'), 2, 'لم يدرس اليوم بعد — الأمس يُحسب'); assert.equal(streakDays(['2026-11-14'], '2026-11-17'), 0); assert.equal(streakDays([], '2026-11-17'), 0);
  assert.equal(riyadhDate(new Date('2026-11-17T21:30:00Z')), '2026-11-18', 'بعد منتصف ليل الرياض');
});

test('اقْرَأْ: البوّابة — لا قرار → none · تقرير بلا اعتماد → pending · قرار معتمد → تسكين تلقائي مرّة واحدة · BELOW_A1 → تمهيدي · التسكين اليدوي يغلق السابق', async () => {
  const db = fakeDb({ placement_reports: [{ id: 'r1', candidate_email: 'a@x.sa', archived_at: null, created_at: '2026-11-01' }, { id: 'r2', candidate_email: 'b@x.sa', archived_at: null, created_at: '2026-11-02' }, { id: 'r3', candidate_email: 'c@x.sa', archived_at: null, created_at: '2026-11-03' }],
    placement_decisions: [{ report_id: 'r2', assigned_level: 'A2', decision_status: 'approved', decided_at: '2026-11-05' }, { report_id: 'r3', assigned_level: 'BELOW_A1', decision_status: 'approved', decided_at: '2026-11-06' }] });
  assert.equal((await gate(db, 'nobody@x.sa', null)).state, 'none'); assert.equal((await gate(db, 'a@x.sa', null)).state, 'pending');
  const g = await gate(db, 'b@x.sa', 'u-b'); assert.equal(g.state, 'enrolled'); if (g.state === 'enrolled') { assert.equal(g.enrolment.level, 'A2'); assert.equal(g.enrolment.source, 'placement'); assert.equal(g.enrolment.report_id, 'r2'); }
  const g2 = await gate(db, 'b@x.sa', 'u-b'); assert.equal(g2.state, 'enrolled'); assert.equal(db.T.iqra_enrolments.filter((e) => e.learner_email === 'b@x.sa').length, 1, 'لا تكرار');
  const g3 = await gate(db, 'c@x.sa', null); assert.equal(g3.state, 'enrolled'); if (g3.state === 'enrolled') assert.equal(g3.enrolment.level, 'PRE_A1');
  assert.equal(await manualEnrol(db, 'b@x.sa', 'B1', 'admin@x.sa', 'ترفيع'), true); const g4 = await gate(db, 'b@x.sa', null); if (g4.state === 'enrolled') assert.equal(g4.enrolment.level, 'B1'); assert.equal(db.T.iqra_enrolments.filter((e) => e.learner_email === 'b@x.sa' && e.active).length, 1);
  await forgetLearner(db, 'b@x.sa'); assert.equal(db.T.iqra_enrolments.filter((e) => e.learner_email === 'b@x.sa').length, 0, 'النسيان يمحو');
});

test('اقْرَأْ: الاستيراد → مسوَّدات وبنود بنك مسوَّدة · المعتمدة لا تُمَسّ · إعادة الاستيراد تستبدل المسوَّدة · منزلة مجهولة ترفض الحلقة · الاعتماد يعتمد المِران ولا حلقة بلا مِران', async () => {
  const { db, rep } = await seeded(false);
  assert.equal(rep.lessons_created, 11); assert.equal(rep.items, 33); assert.equal(rep.cards, 59); assert.deepEqual(rep.errors, []);
  assert.ok(db.T.iqra_lessons.every((l) => l.status === 'draft')); assert.ok(db.T.question_bank_items.every((i) => i.status === 'draft' && i.source_kind === 'iqra' && i.content_version === 'iqra-q1')); assert.equal(db.T.question_bank_answer_keys.length, 33);
  const first = db.T.iqra_lessons[0]; const r0 = await setLessonStatus(db, first.id, 'approved', STAFF, 'جيّدة'); assert.ok(r0.ok);
  assert.ok(first.item_ids.every((id: string) => db.T.question_bank_items.find((i) => i.id === id).status === 'approved'), 'بنود الحلقة اعتُمدت معها'); assert.equal(first.review_note, 'جيّدة');
  const n = normalizePack(PACK_A1); if (!n.ok) return; const rep2 = await importPack(db, n.pack, STAFF, 'batch-2');
  assert.deepEqual(rep2.lessons_skipped, [first.code]); assert.equal(rep2.lessons_updated, 10); assert.equal(rep2.lessons_created, 0); assert.equal(db.T.iqra_lessons.length, 11); assert.equal(db.T.iqra_cards.length, 59, 'البطاقات استُبدلت لا تكرّرت'); assert.equal(db.T.question_bank_items.length, 33, 'البنود عُدّلت بالرمز لا تكرّرت');
  const orphan = normalizePack({ version: 'iqra-pack-1', source: 't', lessons: [{ unit_code: 'A1-U09', idx: 1, title_ar: 'حلقة', content: { intro_ar: 'م' }, cards: [], exercises: [{ kind: 'mcq', prompt_ar: 's', options: ['a', 'b'], correct: 0 }] }] }); if (!orphan.ok) return;
  const r3 = await importPack(db, orphan.pack, STAFF, 'b3'); assert.equal(r3.lessons_created, 0); assert.match(r3.errors[0], /A1-U09/);
  const withUnit = normalizePack({ version: 'iqra-pack-1', source: 't', units: [{ code: 'PRE_A1-U01', level: 'PRE_A1', idx: 1, title_ar: 'الحروف الأولى' }], lessons: [{ unit_code: 'PRE_A1-U01', idx: 1, title_ar: 'حلقة', content: { intro_ar: 'م' }, cards: [], exercises: [] }] }); if (!withUnit.ok) return;
  const r4 = await importPack(db, withUnit.pack, STAFF, 'b4'); assert.equal(r4.units_created, 1); assert.equal(r4.lessons_created, 1); assert.equal(db.T.miaar_syllabus_units.find((u) => u.code === 'PRE_A1-U01').status, 'draft');
  const empty = db.T.iqra_lessons.find((l) => l.code === 'PRE_A1-U01-L01'); const r5 = await setLessonStatus(db, empty.id, 'approved', STAFF, null); assert.equal(r5.ok, false, 'لا تُعتمد حلقة بلا مِران');
  assert.equal((await setLessonStatus(db, 'nope', 'approved', STAFF, null)).ok, false); assert.equal((await setLessonStatus(db, first.id, 'weird', STAFF, null)).ok, false);
  const back = await setLessonStatus(db, first.id, 'draft', STAFF, null); assert.ok(back.ok); assert.ok(first.item_ids.every((id: string) => db.T.question_bank_items.find((i) => i.id === id).status === 'draft'), 'الإرجاع يُرجع البنود');
});

test('اقْرَأْ: رِواق المتعلّم — المعتمد فقط · الحلقة بمحطّاتها بلا مفاتيح · الإجابة تُحفظ والخطأ يدخل «أراجع» · الإغلاق ≥70% يفتح «أثر الحلقة» والبطاقات · أقلّ من ذلك يُعاد', async () => {
  const { db } = await seeded(true); const e = enrolled('A1');
  /* أرجع واحدة إلى مسوَّدة لنتأكد أنها تختفي */
  const hidden = db.T.iqra_lessons[10]; await setLessonStatus(db, hidden.id, 'draft', STAFF, null);
  const home = await learnerHome(db, e, new Date('2026-11-17T06:00:00Z'));
  assert.equal(home.الرِّواق.label, 'مكتشف · A1'); assert.equal(home.الرِّواق.next, 'مبتدئ · A2'); assert.equal(home.خطواتي.total, 10); assert.equal(home.خطواتي.done, 0); assert.equal(home.فارغ, false); assert.equal(home.أيامي, 0); assert.equal(home.أراجع_مستحقّ, 0);
  assert.ok(home.منازل.length >= 3 && home.منازل.every((u) => u.حلقات.length > 0), 'المنازل التي فيها حلقات فقط'); assert.ok(home.منازل.flatMap((u) => u.حلقات).every((h) => h.حالة === 'new' && !('content' in h)));
  assert.ok(home.سؤال_اليوم && home.سؤال_اليوم.kind === 'mcq' && !JSON.stringify(home.سؤال_اليوم).includes('correct'), 'سؤال اليوم بلا مفتاح');
  const same = await learnerHome(db, e, new Date('2026-11-17T18:00:00Z')); assert.equal(same.سؤال_اليوم!.id, home.سؤال_اليوم!.id, 'يثبت لليوم نفسه');
  assert.equal(await lessonView(db, e, hidden.id), null, 'المسوَّدة لا تُفتح'); assert.equal(await lessonView(db, enrolled('B1'), home.التالية!.id), null, 'حلقة من رِواق آخر لا تُفتح');
  const v = (await lessonView(db, e, home.التالية!.id))!; assert.ok(v.content.intro_ar && v.بطاقات.length > 0 && v.مِران.length >= 3); assert.equal(JSON.stringify(v.مِران).includes('correct'), false); assert.deepEqual(v.قريبًا, [IQRA_NAMES_AR.tutor_soon, IQRA_NAMES_AR.voice_soon]); assert.equal(v.تقدّمي.status, 'started');
  assert.equal(db.T.iqra_progress.length, 1, 'فتح الحلقة يسجّل البدء');
  /* إجابات: الأولى خطأ ثم صواب للبقية */
  const keyOf = (id: string) => db.T.question_bank_answer_keys.find((k) => k.item_id === id); const rowOf = (id: string) => db.T.question_bank_items.find((i) => i.id === id);
  const right = (id: string): any => { const k = keyOf(id); const r = rowOf(id); return r.item_type === 'mcq' ? { option: k.correct_option_id } : r.item_type === 'matching' ? { pairs: k.accepted.pairs } : { order: k.accepted.order }; };
  const wrong = (id: string): any => { const r = rowOf(id); return r.item_type === 'mcq' ? { option: 'zz' } : r.item_type === 'matching' ? { pairs: [] } : { order: ['x'] }; };
  const ex0 = v.مِران[0]; const a0 = await answerItem(db, e, { lesson_id: v.id, item_id: ex0.id, answer: wrong(ex0.id) }); assert.ok(a0.ok); if (a0.ok) { assert.equal(a0.correct, false); assert.equal(a0.saved, true); assert.equal((a0 as any).answered, 1); assert.equal((a0 as any).of, v.مِران.length); }
  assert.equal(db.T.iqra_reviews.filter((r) => r.kind === 'item').length, 1, 'الخطأ دخل أراجع'); assert.equal(db.T.iqra_reviews[0].interval_days, 1);
  for (const ex of v.مِران.slice(1)) { const a = await answerItem(db, e, { lesson_id: v.id, item_id: ex.id, answer: right(ex.id) }); assert.ok(a.ok && a.correct, ex.prompt_ar); }
  assert.equal((await answerItem(db, e, { lesson_id: v.id, item_id: 'nope', answer: {} })).ok, false); assert.equal((await answerItem(db, e, { lesson_id: v.id, item_id: ex0.id, answer: {} })).ok, false, 'إجابة بلا شكل');
  const other = db.T.iqra_lessons.find((l) => l.id !== v.id && l.status === 'approved')!; const cross = await answerItem(db, e, { lesson_id: v.id, item_id: other.item_ids[0], answer: right(other.item_ids[0]) }); assert.equal(cross.ok, false, 'بند من حلقة أخرى');
  const f = await finishLesson(db, e, v.id); assert.ok(f.ok); if (f.ok) { assert.equal(f.score, scorePct(v.مِران.length - 1, v.مِران.length)); assert.equal(f.passed, f.score >= 70); if (f.passed) { assert.ok(f.closing_ar); assert.ok(f.next); } }
  const cardsN = db.T.iqra_cards.filter((c) => c.lesson_id === v.id).length; if (f.ok && f.passed) assert.equal(db.T.iqra_reviews.filter((r) => r.kind === 'card').length, cardsN, 'بطاقات الحلقة دخلت أراجع');
  const daily = await answerItem(db, e, { item_id: home.سؤال_اليوم!.id, answer: { option: 'a' }, daily: true }); assert.ok(daily.ok); if (daily.ok) assert.equal(daily.saved, false);
  const h2 = await learnerHome(db, e, new Date()); assert.equal(h2.خطواتي.done, f.ok && f.passed ? 1 : 0); assert.equal(h2.أيامي, 1);
  /* حلقة ثانية بإجابات خاطئة كلّها → لا تُغلق وتُعاد */
  const v2 = (await lessonView(db, e, other.id))!; for (const ex of v2.مِران) await answerItem(db, e, { lesson_id: v2.id, item_id: ex.id, answer: wrong(ex.id) });
  const f2 = await finishLesson(db, e, v2.id); assert.ok(f2.ok); if (f2.ok) { assert.equal(f2.passed, false); assert.equal(f2.score, 0); assert.equal(f2.closing_ar, null); assert.equal(f2.attempts, 1); }
  const p2 = db.T.iqra_progress.find((p) => p.lesson_id === v2.id); assert.equal(p2.status, 'started'); assert.deepEqual(p2.answers, {}, 'تُمسح الإجابات لإعادة نظيفة');
  assert.equal((await finishLesson(db, e, hidden.id)).ok, false);
});

test('اقْرَأْ: «أراجع» — المستحقّ اليوم فقط · التقييم يحرّك الموعد 1→3→7 و«مرّة أخرى» يعيد إلى 1 · «دفتري» يحسب الإتقان من السلّم · لا يصل إلى بطاقات غيره', async () => {
  const { db } = await seeded(true); const e = enrolled('A1'); const home = await learnerHome(db, e); const v = (await lessonView(db, e, home.التالية!.id))!;
  const keyOf = (id: string) => db.T.question_bank_answer_keys.find((k) => k.item_id === id); const rowOf = (id: string) => db.T.question_bank_items.find((i) => i.id === id);
  for (const ex of v.مِران) { const k = keyOf(ex.id); const r = rowOf(ex.id); await answerItem(db, e, { lesson_id: v.id, item_id: ex.id, answer: r.item_type === 'mcq' ? { option: k.correct_option_id } : r.item_type === 'matching' ? { pairs: k.accepted.pairs } : { order: k.accepted.order } }); }
  const f = await finishLesson(db, e, v.id); assert.ok(f.ok && f.passed);
  const today = await reviewsDue(db, e, new Date()); assert.equal(today.total, 0, 'البطاقات تُستحقّ غدًا');
  const tomorrow = new Date(Date.now() + 2 * 86400e3); const due = await reviewsDue(db, e, tomorrow); assert.equal(due.total, v.بطاقات.length); assert.ok(due.بطاقات.length <= IQRA_LIMITS.review_batch); assert.ok(due.بطاقات.every((b: any) => b.kind === 'card' && b.card.word_ar));
  const r1 = due.بطاقات[0]; const g = await reviewAnswer(db, e, r1.review_id, 'good'); assert.ok(g.ok); if (g.ok) assert.equal(g.next_in_days, 3);
  const row = db.T.iqra_reviews.find((r) => r.id === r1.review_id); assert.equal(row.interval_days, 3); assert.equal(row.last_result, 'good'); assert.ok(row.due_at > new Date(Date.now() + 2.5 * 86400e3).toISOString());
  const g2 = await reviewAnswer(db, e, r1.review_id, 'good'); if (g2.ok) assert.equal(g2.next_in_days, 7); const g3 = await reviewAnswer(db, e, r1.review_id, 'again'); if (g3.ok) assert.equal(g3.next_in_days, 1); assert.equal(row.lapses, 1);
  assert.equal((await reviewAnswer(db, e, r1.review_id, 'meh')).ok, false); assert.equal((await reviewAnswer(db, enrolled('A1') && { ...e, learner_email: 'other@x.sa' }, r1.review_id, 'good')).ok, false, 'بطاقة غيره');
  const nb = await notebook(db, e); assert.equal(nb.كلمات.length, v.بطاقات.length); assert.ok(nb.كلمات.every((w: any) => w.word_ar && w.gloss_ar && typeof w.إتقان === 'number' && w.الحلقة)); 
  const w1 = nb.كلمات.find((w: any) => w.id === r1.card.id); assert.equal(w1.إتقان, 0, 'عاد إلى 1 يوم = 0%');
  await reviewAnswer(db, e, r1.review_id, 'easy'); await reviewAnswer(db, e, r1.review_id, 'easy'); const nb2 = await notebook(db, e); assert.equal(nb2.كلمات.find((w: any) => w.id === r1.card.id).إتقان, 100, '30 يومًا = 100%');
  assert.deepEqual(await notebook(db, { ...e, learner_email: 'new@x.sa' }), { كلمات: [], إتقان: 0 });
});

test('اقْرَأْ: الطاقم — نظرة عامّة بالمستويات السبعة · المتعلّمون تحت 5 تُحجب · حلقات المستوى بعدّاداتها · الحلقة الكاملة بمفاتيحها', async () => {
  const { db } = await seeded(false);
  for (let i = 0; i < 4; i += 1) db.T.iqra_enrolments.push({ learner_email: `l${i}@x.sa`, level: 'A1', active: true }); for (let i = 0; i < 5; i += 1) db.T.iqra_enrolments.push({ learner_email: `m${i}@x.sa`, level: 'A2', active: true }); db.T.iqra_enrolments.push({ learner_email: 'z@x.sa', level: 'A2', active: false });
  const ov = await adminOverview(db); assert.deepEqual(Object.keys(ov).sort(), [...IQRA_LEVELS].sort()); assert.equal(ov.A1.draft, 11); assert.equal(ov.A1.learners, null, '4 < 5 تُحجب'); assert.equal(ov.A2.learners, 5); assert.equal(ov.B1.learners, null);
  const ls = await adminLessons(db, 'A1'); assert.equal(ls.lessons.length, 11); assert.equal(ls.units.length, 8); assert.ok(ls.lessons.every((l: any) => l.items >= 3 && l.cards >= 1));
  const full = (await adminLesson(db, ls.lessons[0].id))!; assert.equal(full.items.length, ls.lessons[0].items); assert.ok(full.items.every((i: any) => i.key && i.key.correct_option_id), 'الطاقم يرى المفاتيح'); assert.ok(full.cards.length > 0);
  assert.equal(await adminLesson(db, 'nope'), null); assert.deepEqual((await adminLessons(db, 'C2')).lessons, []);
});

test('اقْرَأْ: الخزنة — جداول المتعلّم مسجَّلة (حذف فوري) والمحتوى غير شخصي · المسارات في الدليل والتنقّل · المحوّل لا يُشحن مع مصادره · مصدر البنك يستثني iqra من السحب الرسمي', () => {
  const reg = new Map(REGISTRY.map((r) => [r.table, r]));
  for (const t of ['iqra_enrolments', 'iqra_progress', 'iqra_reviews']) { const r = reg.get(t)!; assert.ok(r, t); assert.equal(r.policy, 'delete'); assert.equal(r.emailCol, 'learner_email'); assert.ok(r.access.includes('self')); }
  assert.ok(NON_PERSONAL_TABLES.includes('iqra_lessons') && NON_PERSONAL_TABLES.includes('iqra_cards'));
  assert.ok(reg.get('iqra_progress')!.piiCols.includes('answers'));
  const way = read('lib/portal/way.ts'); assert.match(way, /iqra: \{ ar: 'اقْرَأْ'/); assert.match(way, /'admin\/iqra'/);
  const nav = read('app/components/GlobalNavigation.tsx'); assert.match(nav, /'\/miaar', '\/iqra'/);
  const bank = read('lib/miaar/bank.ts'); assert.ok((bank.match(/\.neq\('source_kind', 'iqra'\)/g) || []).length >= 4, 'كل استعلامات السحب تستثني iqra');
  const admin = read('app/admin/miaar/AdminMiaar.tsx'); assert.match(admin, /\['iqra', '12', 'اقْرَأْ', '\/admin\/iqra'\]/); assert.match(admin, /<IqraDesk auth=/);
  const ui = read('app/iqra/IqraApp.tsx'); assert.ok(!/[A-Za-z]{4,}(?![^<]*>)/.test(ui.replace(/<style jsx global>[\s\S]*<\/style>/, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, (m) => (/[\u0600-\u06FF]/.test(m) ? m.replace(/[A-Za-z]/g, 'x') : m)).split('\n').filter((l) => />[^<]*[\u0600-\u06FF]/.test(l)).map((l) => l.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '')).join('\n')), 'نصوص المتعلّم الظاهرة عربية');
  assert.doesNotMatch(ui, /gemini|openai|GEMINI|API_KEY/i, 'لا ذكاء اصطناعي ولا مفاتيح في واجهة المتعلّم');
  const api = read('app/api/iqra/route.ts'); assert.match(api, /crossSiteBrowserWrite/); assert.match(api, /rateLimit/); assert.match(api, /isResultCode/); assert.doesNotMatch(api, /gemini/i);
  assert.ok(fs.existsSync(path.join(ROOT, 'tools/iqra/convert.ts')) && fs.existsSync(path.join(ROOT, 'tools/iqra/packs/iqra-pack-A1-batch1.json')));
});
