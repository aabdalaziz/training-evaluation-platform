// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «اقْرَأْ — من أَثَر» الخطوة 2 («100 ساعة» + جولة الملاحظات 1):
 *  سلّم الساعات وقاعدة العَتَبة · المهارات الخمس والمحطّات الستّ · تسعة أنواع مِران (تطبيع · بنك · ما يراه المتعلّم بلا مفاتيح · تصحيح) ·
 *  السحب 10 من 30 على زيارات (جديد → خطأ → صواب، مستقرّ بالبذرة) · «ساعاتي» (نبضة ≤ 60 ث · سقف يومي · خارج أَثَر لا يُحتسب · تقدير صادق) ·
 *  محطّة «أُنتج» · مكتبة المستوى · فاحص الإنصاف 60/40 غير المانع · فاحص القالب · الخزانة · النسيان الفوري.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IQRA_LIMITS, IQRA_SKILLS, SKILL_META, STATIONS_AR, EXERCISE_KINDS, KIND_AR, HOURS_TARGET, THRESHOLD_RULE, COUNTED_ACTIVITIES, isActivity, isIqraSkill, IQRA_LEVELS } from '../lib/iqra/registry';
import { normalizePack, exerciseToBank, publicExercise, grade, drawExercises, fairnessLint, templateLint, normArabic, LIBRARY_CODE_RE } from '../lib/iqra/content';
import { learnerHome, lessonView, answerItem, finishLesson, importPack, setLessonStatus, setLibraryStatus, logTime, hoursSummary, saveProduce, libraryList, libraryView, libraryAnswer, adminLessons, adminLibrary, adminHours, adminOverview, forgetLearner, riyadhDate } from '../lib/iqra/store';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { unitLevel } from '../lib/iqra/content';
import { fakeDb } from './iqra-fake-db';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PACK2 = JSON.parse(read('tools/iqra/packs/iqra-pack-2-fixture.json'));
const PACK1 = JSON.parse(read('tools/iqra/packs/iqra-pack-A1-batch1.json'));
const STAFF = { email: 'admin@athar-portal.com', id: 'u1' };
const UNIT = (code: string) => ({ code, level: unitLevel(code), idx: Number(code.slice(-2)), title_ar: `منزلة ${code}`, title_en: code, focus_ar: 'تركيز', domains: ['personal'], descriptor_codes: [], status: 'approved' });
const enrolled = (level = 'A1', email = 'l@x.sa') => ({ id: 'e1', learner_email: email, user_id: null, level: level as any, source: 'manual', report_id: null, active: true, created_at: new Date().toISOString() });
async function seeded() {
  const db = fakeDb({ miaar_syllabus_units: ['A1-U01', 'A1-U02', 'A1-U03', 'A1-U04', 'A1-U05', 'A1-U06', 'A1-U07', 'A1-U08'].map(UNIT) });
  const n = normalizePack(PACK2); assert.ok(n.ok, JSON.stringify(n)); const rep = await importPack(db, n.pack, STAFF, 'batch-s2');
  for (const l of db.T.iqra_lessons) { const r = await setLessonStatus(db, l.id, 'approved', STAFF, null); assert.ok(r.ok, l.code); }
  for (const x of db.T.iqra_library) { const r = await setLibraryStatus(db, x.id, 'approved', STAFF); assert.ok(r.ok, x.code); }
  return { db, rep, n };
}

test('الخطوة 2 — السجلّ: سلّم الساعات المعتمد (§9) · قاعدة العَتَبة · المهارات الخمس · المحطّات الستّ · تسعة أنواع · الأنشطة', () => {
  assert.deepEqual(HOURS_TARGET, { PRE_A1: 40, A1: 100, A2: 120, B1: 180, B2: 200, C1: 220, C2: 240 });
  for (const L of IQRA_LEVELS) assert.ok(L === 'PRE_A1' || HOURS_TARGET[L] >= 100, `${L}: لا يقلّ عن 100 ساعة`);
  assert.equal(THRESHOLD_RULE.early_hours_pct, 70); assert.equal(THRESHOLD_RULE.early_mastery_pct, 90); assert.equal(THRESHOLD_RULE.full_mastery_pct, 100); assert.equal(THRESHOLD_RULE.lesson_pass_pct, 70);
  assert.deepEqual([...IQRA_SKILLS], ['listen', 'read', 'grammar', 'speak', 'write']); for (const s of IQRA_SKILLS) { assert.ok(SKILL_META[s].name_ar); assert.ok(isIqraSkill(s)); } assert.equal(isIqraSkill('x'), false);
  assert.equal(STATIONS_AR.length, 6); assert.ok(STATIONS_AR.includes('أُنتج')); assert.ok(STATIONS_AR.includes('المِران'));
  assert.equal(EXERCISE_KINDS.length, 9); for (const k of EXERCISE_KINDS) assert.ok(KIND_AR[k], k);
  assert.equal(IQRA_LIMITS.draw_per_visit, 10); assert.equal(IQRA_LIMITS.items_per_lesson_target, 30); assert.equal(IQRA_LIMITS.tick_max_seconds, 60); assert.equal(IQRA_LIMITS.tick_day_cap_seconds, 6 * 3600);
  assert.deepEqual([...COUNTED_ACTIVITIES], ['lesson', 'review', 'daily', 'library', 'free', 'produce']); assert.ok(isActivity('external')); assert.equal(isActivity('lecture'), false);
});

test('الحزمة 2 — تطبيع: 5 حلقات بمهارة و«أستطيع أن…» · 30 مِرانًا بتسعة أنواع · مكتبة برموز صحيحة · النسخة iqra-pack-2 · الحزمة 1 ما زالت تمرّ', () => {
  const n = normalizePack(PACK2); assert.ok(n.ok, JSON.stringify(n)); assert.equal(n.pack.version, 'iqra-pack-2');
  assert.equal(n.pack.lessons.length, 5); assert.deepEqual(n.pack.lessons.map((l) => l.skill), ['listen', 'read', 'grammar', 'speak', 'write']);
  for (const l of n.pack.lessons) { assert.equal(l.exercises.length, 30, l.code); assert.ok(l.can_do_ar && l.can_do_en, l.code); assert.ok(l.descriptor_codes!.length >= 1); assert.equal(l.minutes_total, 120); assert.ok(l.content.produce, 'محطّة أُنتج'); }
  assert.equal(new Set(n.pack.lessons[0].exercises.map((e) => e.kind)).size, 9);
  assert.equal(n.pack.library!.length, 2); for (const x of n.pack.library!) assert.ok(LIBRARY_CODE_RE.test(x.code), x.code); assert.deepEqual(n.pack.library!.map((x) => x.kind), ['read', 'listen']);
  const n1 = normalizePack(PACK1); assert.ok(n1.ok); assert.equal(n1.pack.version, 'iqra-pack-1');
  const bad = normalizePack({ ...PACK2, library: [{ ...PACK2.library[0], code: 'A1-U02-R01' }] }); assert.ok(!bad.ok); assert.ok(bad.problems.some((p) => /رمز مكتبة/.test(p.msg)));
});

test('الأنواع الستّة الجديدة — رفض البنى الناقصة بأسباب عربية', () => {
  const one = (ex: any) => { const r = normalizePack({ ...PACK2, lessons: [{ ...PACK2.lessons[0], exercises: [ex] }], library: [] }); return r.ok ? { problems: [] as { at: string; msg: string }[] } : r; };
  assert.ok(one({ kind: 'picture_choice', prompt_ar: 'أين؟', options: [{ text: 'أ', image: '/a.svg' }], correct: 0 }).problems.some((p) => /2 إلى 4 صور/.test(p.msg)));
  assert.ok(one({ kind: 'cloze_bank', prompt_ar: 'املأ', text: 'أنا ___', bank: ['طالب'], gaps: ['طالب'] }).problems.some((p) => /مشتّت/.test(p.msg)));
  assert.ok(one({ kind: 'cloze_bank', prompt_ar: 'املأ', text: 'أنا ___ و ___', bank: ['طالب', 'هي', 'هو'], gaps: ['طالب'] }).problems.some((p) => /بعدد الإجابات/.test(p.msg)));
  assert.ok(one({ kind: 'true_false_notgiven', prompt_ar: 'س', passage_ar: 'نصّ', correct: 'maybe' }).problems.some((p) => /true \| false \| ng/.test(p.msg)));
  assert.ok(one({ kind: 'word_tap', prompt_ar: 'المس', words: ['أنا', 'من', 'جدّة', 'من'], correct: 'من' }).problems.some((p) => /مرّة واحدة/.test(p.msg)));
  assert.ok(one({ kind: 'short_dictation', prompt_ar: 'اكتب', text_ar: 'hello' }).problems.some((p) => /إملاء قصير/.test(p.msg)));
  assert.ok(one({ kind: 'picture_sequence', prompt_ar: 'رتّب', frames: [{ image: '/a.svg', text: 'أ' }, { image: '/b.svg', text: 'ب' }] }).problems.some((p) => /3 إلى 6 إطارات/.test(p.msg)));
  assert.ok(one({ kind: 'mystery', prompt_ar: 'x' }).problems.some((p) => /غير معروف/.test(p.msg)));
});

test('البنك — الأنواع التسعة تتحوّل إلى صفوف بنك بمفتاح منفصل · ما يراه المتعلّم بلا مفاتيح (الإملاء لا يكشف نصّه) · التصحيح لكلّ نوع', () => {
  const n = normalizePack(PACK2); assert.ok(n.ok); const l = n.pack.lessons[0];
  const rows = l.exercises.map((e, i) => exerciseToBank(e, l.code, i, 'A1', 'A1-U01', l.skill, 'iqra-s2'));
  assert.equal(new Set(rows.map((r) => r.item_type)).size, 9); for (const r of rows) { assert.equal(r.source_kind, 'iqra'); assert.equal(r.content_version, 'iqra-s2'); assert.ok(/^IQ-A1-U01-L01-\d{2}$/.test(r.item_code)); assert.equal(r.skill, 'listening'); }
  const of = (k: string) => rows.find((r) => r.item_type === k)!;
  const pub = (k: string) => publicExercise({ id: 'x', item_type: k, question_text: of(k).question_text, options: of(k).options, stimulus: of(k).stimulus })!;
  // لا مفاتيح في العرض العامّ
  const dict = pub('short_dictation'); assert.ok(dict.say && /صباح/.test(dict.say)); assert.equal(JSON.stringify(dict).includes('"text_ar"'), false);
  assert.equal(JSON.stringify(pub('cloze_bank')).includes('gaps'), false); assert.ok(pub('cloze_bank').bank!.length >= 3); assert.ok(/___/.test(pub('cloze_bank').text!));
  assert.equal(JSON.stringify(pub('word_tap')).includes('correct'), false); assert.equal(pub('word_tap').words!.length, 6);
  assert.equal(pub('true_false_notgiven').options!.length, 3); assert.ok(pub('true_false_notgiven').passage_ar);
  assert.equal(pub('picture_choice').options!.length, 3); assert.ok(pub('picture_choice').options![0].image);
  assert.equal(pub('picture_sequence').frames!.length, 3); assert.equal(JSON.stringify(pub('picture_sequence')).includes('"order"'), false);
  // التصحيح
  const g = (k: string, a: any) => grade({ item_type: k, stimulus: of(k).stimulus }, of(k).key as any, a)!;
  assert.equal(g('cloze_bank', { gaps: ['طالب', 'هي'] }).correct, true); assert.equal(g('cloze_bank', { gaps: ['هي', 'طالب'] }).correct, false); assert.deepEqual(g('cloze_bank', { gaps: ['هو', 'هو'] }).correct_gaps, ['طالب', 'هي']);
  assert.equal(g('word_tap', { word: 'الرياض' }).correct, true); assert.equal(g('word_tap', { word: 'جدّة' }).correct_word, 'الرياض');
  assert.equal(g('short_dictation', { text: 'صباح الخير' }).correct, true); assert.equal(g('short_dictation', { text: 'صَبَاحُ الْخَيْرِ' }).correct, true, 'التشكيل لا يُحاسَب'); assert.equal(g('short_dictation', { text: 'صباح النور' }).correct, false); assert.equal(g('short_dictation', { text: 'x' }).correct_text, 'صباح الخير');
  assert.equal(g('picture_sequence', { order: ['تستيقظ', 'تفطر', 'تذهب إلى العمل'] }).correct, true); assert.equal(g('picture_sequence', { order: ['تفطر', 'تستيقظ', 'تذهب إلى العمل'] }).correct, false);
  const tf = pub('true_false_notgiven'); const falseOpt = tf.options!.find((o) => /خطأ/.test(o.text))!; assert.equal(g('true_false_notgiven', { option: falseOpt.id }).correct, true);
  const pc = pub('picture_choice'); assert.equal(g('picture_choice', { option: pc.options![0].id }).correct, true); assert.equal(g('picture_choice', { option: pc.options![1].id }).correct, false);
  assert.equal(normArabic('أَهْلاً وَسَهْلاً'), normArabic('اهلا وسهلا'));
});

test('السحب — 10 من 30: الجديد أوّلًا ثم الخطأ ثم الصواب · مستقرّ بالبذرة · يتغيّر بالزيارة · أقلّ من 10 إن قلّ المتاح', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `i${i}`);
  const a = drawExercises(ids, {}, 's1'); const b = drawExercises(ids, {}, 's1'); const c = drawExercises(ids, {}, 's2');
  assert.equal(a.length, 10); assert.deepEqual(a, b); assert.notDeepEqual(a, c); assert.equal(new Set(a).size, 10);
  const answers: Record<string, { correct: boolean }> = {}; for (let i = 0; i < 25; i++) answers[`i${i}`] = { correct: i % 5 !== 0 };
  const d = drawExercises(ids, answers, 's1'); assert.equal(d.length, 10); const fresh = d.filter((x) => !answers[x]); assert.equal(fresh.length, 5, 'الخمسة الجديدة كلّها'); assert.equal(d.filter((x) => answers[x] && !answers[x].correct).length, 5, 'ثم الأخطاء');
  assert.equal(drawExercises(ids.slice(0, 3), {}, 's').length, 3);
});

test('الإنصاف — 60/40 تحذير غير مانع · الإعفاء لحلقات قواعد الجنس · فاحص القالب يحذّر بلا منع', () => {
  const skew = fairnessLint(['أحمد ذهب. خالد جاء. محمد قال. هو طالب. أبي معلّم.']); assert.ok(skew.warn, 'نصّ ذكوري بالكامل يحذّر'); assert.ok(skew.pct_f < 40); assert.ok(skew.warn!.includes('الإنصاف') || skew.warn!.includes('حضور'));
  const fair = fairnessLint(['سارة ذهبت وأحمد جاء. هي معلّمة وهو طالب.']); assert.equal(fair.warn, null);
  const prep = fairnessLint(['سارة على اليمين وعلى اليسار، وأحمد على الكرسيّ. هي معلّمة وهو طالب.']); assert.deepEqual([prep.f, prep.m], [3, 3], 'حرف الجرّ «على» لا يُحسب اسمًا (عليّ) — إصلاح الدفعة 4'); assert.equal(prep.warn, null);
  assert.equal(fairnessLint(['أحمد ذهب. خالد جاء. محمد قال. هو وهو وهو وأبي.'], true).warn, null, 'معفاة');
  const n = normalizePack(PACK2); assert.ok(n.ok); assert.ok(Array.isArray(n.warnings));
  const skewed = normalizePack({ ...PACK2, lessons: [{ ...PACK2.lessons[0], content: { ...PACK2.lessons[0].content, text: { kind: 'narrative', body: Array(6).fill('أحمد وخالد ومحمد وعليّ ذهبوا. هو قال وهو ردّ وهو ضحك. أبي وأخي وجدّي وعمّي والرجل والولد والمعلّم والطالب.').join('\n') } } }], library: [] });
  assert.ok(skewed.ok, 'التحذير لا يمنع'); assert.ok(skewed.warnings.some((w) => w.msg.startsWith('الإنصاف')), JSON.stringify(skewed.warnings));
  const thin = templateLint([{ ...n.pack.lessons[0], exercises: n.pack.lessons[0].exercises.slice(0, 5), cards: [], content: { ...n.pack.lessons[0].content, produce: null } }]);
  assert.ok(thin.some((w) => /أُنتج/.test(w.msg))); assert.ok(thin.some((w) => /مِران|بطاق/.test(w.msg)));
});

test('الاستيراد — الأعمدة الجديدة · المكتبة تُستورد مسوَّدةً ولا تُمَسّ بعد الاعتماد · النسخة iqra-s2 · الحزمة 1 القديمة تبقى صالحة', async () => {
  const { db, rep } = await seeded();
  assert.equal(rep.lessons_created, 5); assert.equal(rep.items, 150); assert.equal(rep.library_created, 2);
  const l = db.T.iqra_lessons.find((x) => x.code === 'A1-U01-L02'); assert.equal(l.skill, 'read'); assert.ok(l.can_do_en); assert.equal(l.domain, 'شخصي'); assert.equal(l.minutes_total, 120); assert.deepEqual(l.descriptor_codes, ['A1-R01']);
  assert.equal(db.T.question_bank_items.filter((r) => r.content_version === 'iqra-s2').length, 150); assert.equal(new Set(db.T.question_bank_items.map((r) => r.item_type)).size, 9);
  assert.equal(db.T.iqra_library.length, 2); assert.ok(db.T.iqra_library.every((x) => x.status === 'approved' && x.version === 'iqra-s2'));
  const n = normalizePack({ ...PACK2, library: [{ ...PACK2.library[0], title_ar: 'عنوان جديد' }] }); assert.ok(n.ok); const rep2 = await importPack(db, n.pack, STAFF, 'batch-s2b');
  assert.equal(db.T.iqra_library.find((x) => x.code === 'A1-U01-R01').title_ar, 'رسالة من نور', 'المعتمد لا يُمَسّ'); assert.equal(rep2.lessons_skipped.length, 5);
  const adm = await adminLessons(db, 'A1'); assert.equal(adm.lessons.length, 5); assert.equal(adm.lessons[0].مهارة?.name_ar, 'أسمع وأفهم'); assert.equal(adm.library.length, 2); assert.equal(adm.library.find((x: any) => x.code === 'A1-U01-R01').questions, 3);
  const x = await adminLibrary(db, db.T.iqra_library[0].id); assert.ok(x && x.body_ar);
  const bad = await setLibraryStatus(db, db.T.iqra_library[0].id, 'published', STAFF); assert.equal(bad.ok, false);
  const ov = await adminOverview(db); assert.equal(ov.A1.approved, 5); assert.equal(ov.A1.library, 2);
});

test('الاستيراد فوق حلقة قائمة — المسوَّدة تُستبدل كاملةً · البنود القديمة التي لم تعد في الحزمة تُؤرشف لا تُحذف · المعتمدة تُترك حتى تُرجَع إلى مسوَّدة', async () => {
  const { db } = await seeded(); const l0 = db.T.iqra_lessons.find((x) => x.code === 'A1-U01-L01'); assert.equal(l0.item_ids.length, 30);
  const smaller = normalizePack({ ...PACK2, lessons: [{ ...PACK2.lessons[0], title_ar: 'عنوان محدَّث', exercises: PACK2.lessons[0].exercises.slice(0, 12) }] }); assert.ok(smaller.ok, JSON.stringify(smaller));
  const skip = await importPack(db, smaller.pack, STAFF, 'batch-s2c'); assert.deepEqual(skip.lessons_skipped, ['A1-U01-L01']); assert.equal(skip.lessons_updated, 0); assert.equal(l0.title_ar, 'أسمع وأفهم: التعارف', 'المعتمدة لا تُمَسّ');
  const back = await setLessonStatus(db, l0.id, 'draft', STAFF, null); assert.ok(back.ok);
  const rep = await importPack(db, smaller.pack, STAFF, 'batch-s2d'); assert.equal(rep.lessons_updated, 1); assert.equal(rep.items, 12); assert.equal(rep.errors.length, 0);
  const l1 = db.T.iqra_lessons.find((x) => x.code === 'A1-U01-L01'); assert.equal(l1.id, l0.id, 'المعرّف نفسه — تقدّم المتعلّمين لا يضيع'); assert.equal(l1.title_ar, 'عنوان محدَّث'); assert.equal(l1.item_ids.length, 12); assert.equal(l1.status, 'draft');
  const mine = db.T.question_bank_items.filter((r) => r.item_code.startsWith('IQ-A1-U01-L01-')); assert.equal(mine.length, 30, 'لا حذف');
  assert.equal(mine.filter((r) => r.status === 'archived').length, 18, 'الـ18 الزائدة تُؤرشف'); assert.ok(mine.filter((r) => r.status !== 'archived').every((r) => l1.item_ids.includes(r.id)));
  assert.equal(db.T.iqra_cards.filter((c) => c.lesson_id === l0.id).length, PACK2.lessons[0].cards.length, 'البطاقات تُستبدل لا تتراكم');
  const ok = await setLessonStatus(db, l0.id, 'approved', STAFF, null); assert.ok(ok.ok); assert.equal(mine.filter((r) => r.status === 'approved').length, 12); assert.equal(mine.filter((r) => r.status === 'archived').length, 18, 'الاعتماد لا يُحيي المؤرشف');
});

test('المتعلّم — المستوى يعرض المهارة و«أستطيع أن» و«ساعاتي» (0 من 100) · الحلقة تسحب 10 من 30 · الإتمام يحتاج إجابة العشرة · الزيارة التالية تسحب غيرها · 3 زيارات تكمل الحلقة', async () => {
  const { db } = await seeded(); const e = enrolled();
  const home = await learnerHome(db, e); assert.equal(home.ساعاتي!.target, 100); assert.equal(home.ساعاتي!.hours, 0); assert.equal(home.ساعاتي!.threshold.state, 'building'); assert.equal(home.مكتبة, 2);
  const first = home.منازل![0].حلقات[0]; assert.equal(first.مهارة!.key, 'listen'); assert.ok(first.can_do_ar.startsWith('أستطيع')); assert.equal(first.الكلّ, 30); assert.equal(first.مجاب, 0); assert.equal(first.minutes_total, 120);
  const v1 = (await lessonView(db, e, first.id))!; assert.equal(v1.مِران.length, 10); assert.equal(v1.زيارة.رقم, 1); assert.equal(v1.زيارة.الكلّ, 30); assert.equal(v1.مهارة!.name_ar, 'أسمع وأفهم'); assert.ok(v1.content.produce); assert.equal(JSON.stringify(v1.مِران).includes('text_ar'), false);
  const early = await finishLesson(db, e, first.id); assert.equal(early.ok, false); assert.equal((early as any).error, 'answer_first');
  const solve = async (v: NonNullable<Awaited<ReturnType<typeof lessonView>>>) => { for (const ex of v.مِران) { const key = db.T.question_bank_answer_keys.find((k) => k.item_id === ex.id); const row = db.T.question_bank_items.find((r) => r.id === ex.id); const a: any = ex.kind === 'matching' ? { pairs: (row.stimulus.pairs as any[]).map((p) => [p.l, p.r]) } : ex.kind === 'ordering' || ex.kind === 'picture_sequence' ? { order: key.accepted.order } : ex.kind === 'cloze_bank' ? { gaps: key.accepted.gaps } : ex.kind === 'word_tap' ? { word: key.accepted.word } : ex.kind === 'short_dictation' ? { text: key.accepted.text } : { option: key.correct_option_id }; const r = await answerItem(db, e, { lesson_id: first.id, item_id: ex.id, answer: a }); assert.ok(r.ok && r.correct, `${ex.kind}: ${JSON.stringify(r)}`); } };
  await solve(v1); const f1 = await finishLesson(db, e, first.id); assert.ok(f1.ok && f1.passed); assert.equal(f1.score, 100); assert.equal((f1 as any).complete, false); assert.equal((f1 as any).remaining, 20);
  const v2 = (await lessonView(db, e, first.id))!; assert.equal(v2.زيارة.رقم, 2); assert.equal(v2.زيارة.مجاب, 10); assert.equal(v2.مِران.length, 10); assert.equal(v2.مِران.filter((x) => v1.مِران.some((y) => y.id === x.id)).length, 0, 'الزيارة الثانية كلّها جديدة');
  await solve(v2); await finishLesson(db, e, first.id); const v3 = (await lessonView(db, e, first.id))!; assert.equal(v3.زيارة.رقم, 3); await solve(v3); const f3 = await finishLesson(db, e, first.id); assert.ok(f3.ok && (f3 as any).complete); assert.equal((f3 as any).remaining, 0);
  const v4 = (await lessonView(db, e, first.id))!; assert.equal(v4.زيارة.مكتملة, true); assert.equal(v4.مِران.length, 10, 'بعد الاكتمال يعود السحب للمراجعة');
  const home2 = await learnerHome(db, e); assert.equal(home2.منازل![0].حلقات[0].مكتملة, true); assert.equal(home2.منازل![0].حلقات[0].مجاب, 30); assert.equal(home2.خطواتي!.done, 1);
});

test('«ساعاتي» — النبضة ≤ 60 ث · التجميع اليومي · السقف اليومي 6 س · خارج أَثَر يُعرض ولا يُحتسب · نشاط غير معروف يُرفض · التقدير والعَتَبة', async () => {
  const { db } = await seeded(); const e = enrolled(); const now = new Date('2026-12-01T08:00:00Z');
  assert.equal((await logTime(db, e, 'lecture', 30, null, now)).ok, false); assert.equal((await logTime(db, e, 'lesson', 0, null, now)).ok, false);
  const t1 = await logTime(db, e, 'lesson', 600, null, now); assert.ok(t1.ok); assert.equal(t1.seconds, 60, 'نبضة واحدة لا تزيد على 60 ث مهما ادّعى العميل');
  for (let i = 0; i < 119; i++) await logTime(db, e, 'lesson', 30, null, now);
  assert.equal(db.T.iqra_time_log.filter((r) => r.activity === 'lesson').length, 1, 'صفّ واحد لليوم والنشاط'); assert.equal(db.T.iqra_time_log[0].seconds, 60 + 119 * 30); assert.equal(db.T.iqra_time_log[0].day, riyadhDate(now));
  await logTime(db, e, 'library', 1800, null, now); await logTime(db, e, 'review', 60, null, now);
  const ext = await logTime(db, e, 'external', 2 * 3600, 'قرأت كتابًا', now); assert.ok(ext.ok); assert.equal(ext.seconds, 7200);
  const h = await hoursSummary(db, e, 50, now); assert.equal(h.target, 100); assert.equal(h.external_hours, 2); assert.equal(h.hours, Math.round(((60 + 119 * 30 + 60 + 60) / 3600) * 10) / 10); assert.ok(h.hours < 2); assert.equal(h.today_min, Math.round((60 + 119 * 30 + 60 + 60) / 60)); assert.equal(h.threshold.state, 'building'); assert.ok(h.by_activity.lesson > 0); assert.equal((h.by_activity as any).external, undefined);
  // السقف اليومي
  const e2 = enrolled('A1', 'cap@x.sa'); for (let i = 0; i < 400; i++) await logTime(db, e2, 'lesson', 60, null, now); assert.equal(db.T.iqra_time_log.find((r) => r.learner_email === 'cap@x.sa').seconds, 6 * 3600, 'سقف 6 ساعات في اليوم');
  // الوصول للعَتَبة: 70% ساعات + 90% إتقان → مبكر؛ 100% + 100% → كامل؛ التقدير من آخر أسبوعين
  const e3 = enrolled('A1', 'far@x.sa'); for (let d = 0; d < 14; d++) { const day = new Date(now.getTime() - d * 86400e3); for (let i = 0; i < 300; i++) await logTime(db, e3, 'lesson', 60, null, day); } // 5 س × 14 = 70 س
  const h3 = await hoursSummary(db, e3, 95, now); assert.equal(h3.hours, 70); assert.equal(h3.pct, 70); assert.equal(h3.threshold.state, 'early'); assert.equal(h3.per_week, 35); assert.equal(h3.weeks_left, 1);
  assert.equal((await hoursSummary(db, e3, 80, now)).threshold.state, 'building', 'الإتقان دون 90% يمنع المبكر');
  for (let d = 14; d < 20; d++) { const day = new Date(now.getTime() - d * 86400e3); for (let i = 0; i < 300; i++) await logTime(db, e3, 'lesson', 60, null, day); }
  const h4 = await hoursSummary(db, e3, 100, now); assert.equal(h4.hours, 100); assert.equal(h4.threshold.state, 'ready'); assert.equal(h4.weeks_left, 0);
  const home = await learnerHome(db, e3, now); assert.equal(home.ساعاتي!.hours, 100);
  // النسيان الفوري يمسح السجلّ
  await forgetLearner(db, 'far@x.sa'); assert.equal(db.T.iqra_time_log.filter((r) => r.learner_email === 'far@x.sa').length, 0);
  // الطاقم: k ≥ 5 وإلا لا شيء
  assert.equal((await adminHours(db)).A1, null);
  for (let i = 0; i < 5; i++) await logTime(db, enrolled('A1', `k${i}@x.sa`), 'lesson', 60, null, now);
  const ah = await adminHours(db); assert.ok(ah.A1); assert.equal(ah.A1!.target, 100); assert.ok(ah.A1!.learners >= 5); assert.equal(JSON.stringify(ah).includes('@'), false);
});

test('«أُنتج» — النصّ يُحفظ للمتعلّم وحده ويُعاد النموذج · الكتابة تتطلّب نصًّا · التحدّث لا يرفع شيئًا · «أراجع» و«دفتري» لا تتأثّر', async () => {
  const { db } = await seeded(); const e = enrolled(); const home = await learnerHome(db, e); const w = home.منازل![0].حلقات[0]; const s = home.منازل![0].حلقات[3];
  const r0 = await saveProduce(db, e, { lesson_id: w.id, text: '   ', checked: [] }); assert.equal(r0.ok, false); assert.equal((r0 as any).error, 'text_required');
  const r1 = await saveProduce(db, e, { lesson_id: w.id, text: 'أنا نور. أنا من جدّة. أنا معلّمة في مدرسة.', checked: [true, true, false] }); assert.ok(r1.ok); assert.equal(r1.words, 9); assert.ok(r1.model_ar!.includes('نور'));
  const p = db.T.iqra_progress.find((x) => x.lesson_id === w.id); assert.equal(p.answers._produce.words, 9); assert.deepEqual(p.answers._produce.checked, [true, true, false]); assert.equal(p.status, 'started');
  const v = (await lessonView(db, e, w.id))!; assert.equal(v.أُنتج!.words, 9); assert.equal(v.تقدّمي.answered, 0, '_produce ليس إجابة مِران');
  const r2 = await saveProduce(db, e, { lesson_id: s.id, text: '', checked: [true] }); assert.ok(r2.ok, 'التحدّث يحفظ قائمة التدقيق فقط'); assert.equal(db.T.iqra_progress.find((x) => x.lesson_id === s.id).answers._produce.text, '');
  assert.equal((await saveProduce(db, e, { lesson_id: '00000000-0000-4000-8000-000000000999', text: 'x', checked: [] })).ok, false);
});

test('مكتبة المستوى — المعتمد فقط · نصّ الاستماع لا يكشف جسمه قبل الإجابة؟ (يكشفه بعد) · الأسئلة بلا مفاتيح · التصحيح والدرجة · التكرار يحدّث لا يكرّر', async () => {
  const { db } = await seeded(); const e = enrolled();
  const lst = await libraryList(db, e); assert.equal(lst.نصوص.length, 2); assert.equal(lst.نصوص[0].تمّ, false);
  await setLibraryStatus(db, db.T.iqra_library[1].id, 'draft', STAFF); assert.equal((await libraryList(db, e)).نصوص.length, 1); await setLibraryStatus(db, db.T.iqra_library[1].id, 'approved', STAFF);
  const v = (await libraryView(db, e, lst.نصوص.find((x) => x.code === 'A1-U01-R01')!.id))!; assert.equal(v.أسئلة.length, 3); assert.equal(JSON.stringify(v.أسئلة).includes('correct'), false); assert.ok(v.body_ar.includes('نور'));
  const r = await libraryAnswer(db, e, v.id, [0, 1, 0]); assert.ok(r.ok); assert.equal(r.score, 67); assert.equal(r.results.filter((x) => x.correct).length, 2); assert.equal(r.results[0].explanation_ar, 'قالت: أنا من جدّة.');
  const r2 = await libraryAnswer(db, e, v.id, [0, 1, 2]); assert.ok(r2.ok); assert.equal(r2.score, 100); assert.equal(db.T.iqra_progress.filter((x) => x.library_id === v.id).length, 1, 'صفّ واحد');
  assert.equal((await libraryList(db, e)).نصوص.find((x) => x.code === 'A1-U01-R01')!.درجة, 100); assert.equal((await learnerHome(db, e)).خطواتي!.done, 0, 'المكتبة لا تُعدّ حلقة');
  assert.equal((await libraryAnswer(db, e, v.id, [0])).ok, false); assert.equal((await libraryView(db, enrolled('PRE_A1'), v.id)), null, 'نصّ من مستوى أعلى لا يُفتح'); assert.ok(await libraryView(db, enrolled('A2'), v.id), 'ق٢: نصّ من مستوى أدنى يبقى مفتوحًا للعابر');
});

test('الخزانة — iqra_time_log بياناتٌ شخصية بسياسة حذف · iqra_library محتوى بلا بيانات شخصية · لا بيانات شخصية في الصور', () => {
  const t = REGISTRY.find((r) => r.table === 'iqra_time_log')!; assert.ok(t); assert.equal(t.policy, 'delete'); assert.equal(t.emailCol, 'learner_email'); assert.ok(t.purpose_ar.includes('لا تُحتسب'));
  assert.ok(NON_PERSONAL_TABLES.includes('iqra_library'));
  for (const f of ['book', 'pen', 'door', 'sun', 'cup', 'bus']) assert.ok(read(`public/iqra/img/${f}.svg`).startsWith('<svg'));
});

test('واجهة المتعلّم — الصوت من الجهاز فقط (Web Speech) · نبضة 30 ث وخمول 90 ث · ستّ محطّات · «say» لا يُعرض نصًّا · لا خادم صوت', () => {
  const app = read('app/iqra/IqraApp.tsx');
  const voice = read('lib/iqra/voice.ts'); assert.ok(voice.includes('speechSynthesis') && app.includes("from '../../lib/iqra/voice'"), 'الاحتياط صوت الجهاز في lib/iqra/voice.ts');
  assert.equal(/fetch\([^)]*(tts|speech|audio)/i.test(app), false, 'لا طلب صوت إلى خادم'); assert.ok(voice.includes('.cues.json') && voice.includes("'/iqra/audio'") && !/fetch\([^)]*\/api\//.test(voice), 'شريط الحلقة ملفّات ثابتة لا واجهة خادم');
  assert.ok(app.includes('data-testid="iq-stage"') && app.includes('skipRole') && app.includes('iq-turn-done'), 'مسرح الحلقة والعب الدور'); assert.ok(app.includes('maxPlays={t.kind === \'listen\' ? 2 : undefined}'), 'استماع المكتبة مرّتان كمِعيار');
  assert.ok(app.includes('30_000') && app.includes('90_000')); assert.ok(app.includes("action: 'tick'"));
  assert.ok(app.includes("'أسمع وأقرأ', 'كلماتي', 'القاعدة', 'المِران', 'أُنتج', 'أثر الحلقة'"));
  assert.equal(/\{ex\.say\}/.test(app), false, 'نصّ الإملاء لا يُطبع'); assert.ok(app.includes('data-testid="iq-hours"')); assert.ok(app.includes('data-testid="iq-external"')); assert.ok(app.includes('data-testid="iq-produce"'));
  for (const k of ['picture_choice', 'cloze_bank', 'true_false_notgiven', 'word_tap', 'short_dictation', 'picture_sequence']) assert.ok(app.includes(`ex.kind === '${k}'`), k);
  assert.ok(app.includes('MediaRecorder') && !app.includes('upload'), 'التسجيل محلّي');
  const route = read('app/api/iqra/route.ts'); for (const a of ['tick', 'external', 'produce', 'library']) assert.ok(route.includes(`action === '${a}'`), a); assert.ok(route.includes("view === 'library'"));
  const adm = read('app/api/admin/iqra/route.ts'); assert.ok(adm.includes("action === 'library_status'")); assert.ok(adm.includes('adminHours'));
});
