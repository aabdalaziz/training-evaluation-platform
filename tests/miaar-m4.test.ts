// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م4-أ «صوتك وقلمك» — سُلّم التقدير والحدود وعدّاد الكلمات وتحقّق المهمة وتقدير الآلة وكابا المصحّحَين · خلايا «غرفة الأداء» في المخطّط */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUBRIC_DIMENSIONS, WRITING_LIMITS, SPEAKING_LIMITS, MAX_RECORD_SECONDS, validateTask, countWords, lengthStatus, validateScores, weightedMean, judge, parseAiRating, weightedKappa } from '../lib/miaar/rubric';
import { PRODUCTIVE_SKILLS, PRODUCTIVE_ITEM_TYPES, ITEM_TYPES, skillLabel, isProductiveSkill, BANK_LEVELS } from '../lib/miaar/registry';
import { planFromBlueprint, systemPlan, productiveTotal, planTotal } from '../lib/miaar/blueprint';

test('م4-أ: السجلّ — مهارتان إنتاجيتان ونوعا بند وتسميات عربية', () => {
  assert.deepEqual([...PRODUCTIVE_SKILLS], ['writing', 'speaking'], 'المهارتان');
  assert.ok(ITEM_TYPES.includes('writing_task') && ITEM_TYPES.includes('speaking_task'), 'النوعان في ITEM_TYPES');
  assert.equal(PRODUCTIVE_ITEM_TYPES.writing, 'writing_task'); assert.equal(PRODUCTIVE_ITEM_TYPES.speaking, 'speaking_task');
  assert.equal(skillLabel('writing'), 'الكتابة'); assert.equal(skillLabel('speaking'), 'التحدّث');
  assert.ok(isProductiveSkill('speaking') && !isProductiveSkill('reading'), 'التمييز');
  for (const lv of BANK_LEVELS) { assert.ok(WRITING_LIMITS[lv].min_words <= WRITING_LIMITS[lv].max_words, `حدود الكتابة ${lv}`); assert.ok(SPEAKING_LIMITS[lv].max_seconds <= MAX_RECORD_SECONDS, `سقف التسجيل ${lv}`); }
  assert.deepEqual([...RUBRIC_DIMENSIONS.writing], ['range', 'accuracy', 'coherence', 'task']); assert.deepEqual([...RUBRIC_DIMENSIONS.speaking], ['range', 'accuracy', 'fluency', 'task']);
});

test('م4-أ: عدّاد الكلمات العربية يتجاهل التشكيل والترقيم', () => {
  assert.equal(countWords('أنا طالبٌ في الجامعة.'), 4, 'أربع كلمات');
  assert.equal(countWords('مرحبًا، كيف حالك؟ أنا بخير!'), 5, 'خمس كلمات مع ترقيم');
  assert.equal(countWords('   '), 0, 'فراغ'); assert.equal(countWords(''), 0, 'خالٍ');
  assert.equal(countWords('الاسم: سارة · البلد: مصر'), 4, 'النقطة الوسطى لا تُعدّ');
  assert.equal(countWords('ـــــ 2026 ـــــ'), 1, 'التطويل لا يُعدّ والرقم يُعدّ');
});

test('م4-أ: تحقّق المهمة — الافتراضات بحسب المستوى والرفض عند الخلل', () => {
  const w = validateTask('writing', 'B1', { genre: 'formal_email', tips_ar: ['أ', 'ب', '', 'ج', 'د'], sample_ar: 'نموذج' });
  assert.ok(w.task, 'تُقبل'); assert.equal(w.task!.min_words, 80); assert.equal(w.task!.max_words, 130); assert.equal(w.task!.time_seconds, 720); assert.deepEqual(w.task!.tips_ar, ['أ', 'ب', 'ج', 'د'], 'أربعة إرشادات كحدّ أقصى بلا فراغات');
  const bad = validateTask('writing', 'B1', { genre: 'essay', min_words: 200, max_words: 100 }); assert.equal(bad.task, null); assert.ok(bad.errors.some((e) => e.includes('أكبر')), 'الأدنى > الأقصى');
  const sp = validateTask('speaking', 'C1', { genre: 'fluent_talk' }); assert.ok(sp.task); assert.equal(sp.task!.max_seconds, 90); assert.equal(sp.task!.prep_seconds, 60); assert.equal(sp.task!.retakes, 1);
  const over = validateTask('speaking', 'A1', { genre: 'greet', max_seconds: 400 }); assert.ok(over.task, 'القيمة خارج النطاق تعود إلى الافتراضي'); assert.equal(over.task!.max_seconds, 45);
  const noGenre = validateTask('writing', 'A1', { genre: 'Mémo 1' }); assert.equal(noGenre.task, null, 'genre لاتيني صغير فقط');
  const badLevel = validateTask('writing', 'Z9', { genre: 'essay' }); assert.equal(badLevel.task, null);
  assert.equal(lengthStatus('writing', w.task!, 50), 'short'); assert.equal(lengthStatus('writing', w.task!, 100), 'ok'); assert.equal(lengthStatus('writing', w.task!, 200), 'long');
  assert.equal(lengthStatus('speaking', sp.task!, 30), 'short'); assert.equal(lengthStatus('speaking', sp.task!, 60), 'ok');
});

test('م4-أ: السُلّم — المتوسّط الموزون والحكم ومستوى التقدير', () => {
  assert.equal(validateScores('writing', { range: 3, accuracy: 3, coherence: 3 }), null, 'بُعد ناقص');
  assert.equal(validateScores('writing', { range: 3, accuracy: 6, coherence: 3, task: 3 }), null, 'خارج 0–5');
  assert.equal(validateScores('speaking', { range: 3, accuracy: 3, fluency: 2.5, task: 3 }), null, 'كسر مرفوض');
  const at = validateScores('writing', { range: 3, accuracy: 3, coherence: 3, task: 3 })!; assert.equal(weightedMean('writing', at), 3);
  assert.equal(weightedMean('writing', { range: 2, accuracy: 2, coherence: 2, task: 5 }), 3, 'إنجاز المهمة بوزن 1.5: (6+7.5)/4.5 = 3');
  assert.equal(judge('writing', 'B1', at).verdict, 'at'); assert.equal(judge('writing', 'B1', at).estimated, 'B1');
  const above = judge('writing', 'B1', { range: 5, accuracy: 4, coherence: 5, task: 5 }); assert.equal(above.verdict, 'above'); assert.equal(above.estimated, 'B2');
  const top = judge('speaking', 'C2', { range: 5, accuracy: 5, fluency: 5, task: 5 }); assert.equal(top.estimated, 'C2', 'لا يتجاوز C2');
  const below = judge('speaking', 'A2', { range: 2, accuracy: 2, fluency: 2, task: 2 }); assert.equal(below.verdict, 'below'); assert.equal(below.estimated, 'A1');
  const well = judge('writing', 'A1', { range: 1, accuracy: 1, coherence: 1, task: 1 }); assert.equal(well.verdict, 'well_below'); assert.equal(well.estimated, 'PRE_A1', 'يهبط إلى الأرضية لا أدنى');
  const none = judge('writing', 'C1', { range: 5, accuracy: 5, coherence: 5, task: 0 }); assert.equal(none.verdict, 'no_task', 'إنجاز 0 يُبطل البقية'); assert.equal(none.estimated, 'B1'); assert.equal(none.verdict_ar, 'لم يؤدِّ المهمة');
});

test('م4-ج (تمهيد): تحقّق JSON المصحّح الآلي صارم — ويقبل سياج ```json', () => {
  const ok = parseAiRating('writing', 'B2', '```json\n{"scores":{"range":4,"accuracy":3,"coherence":4,"task":4},"evidence":["«وبما أنّني أعمل عن بُعد»"],"next_step_ar":"نوّع أدوات الربط بدل تكرار «و»","confidence":0.8}\n```');
  assert.ok(ok, 'يُقبل'); assert.equal(ok!.estimated, 'B2'); assert.equal(ok!.confidence, 0.8); assert.equal(ok!.evidence.length, 1);
  assert.equal(parseAiRating('writing', 'B2', { scores: { range: 4, accuracy: 3, coherence: 4, task: 4 }, evidence: [], next_step_ar: 'نوّع أدوات الربط' }), null, 'بلا شواهد → مرفوض');
  assert.equal(parseAiRating('writing', 'B2', { scores: { range: 4, accuracy: 3, coherence: 4, task: 4 }, evidence: ['x'], next_step_ar: 'قصير' }), null, 'الخطوة التالية قصيرة → مرفوض');
  assert.equal(parseAiRating('speaking', 'B2', { scores: { range: 4, accuracy: 3, coherence: 4, task: 4 }, evidence: ['x'], next_step_ar: 'نوّع أدوات الربط' }), null, 'أبعاد الكتابة لمهمة تحدّث → مرفوض');
  assert.equal(parseAiRating('writing', 'B2', 'not json'), null);
  const clamp = parseAiRating('writing', 'A1', { scores: { range: 1, accuracy: 1, coherence: 1, task: 1 }, evidence: ['a', 'b', 'c', 'd'], next_step_ar: 'اكتب جملًا أقصر وأوضح', confidence: 7 })!; assert.equal(clamp.confidence, 1); assert.equal(clamp.evidence.length, 3, 'ثلاثة شواهد كحدّ أقصى');
});

test('م4-ج (تمهيد): كابا المرجّح — اتفاق تامّ 1 · اختلاف منهجي أقلّ · عيّنة صغيرة null', () => {
  assert.equal(weightedKappa([1, 2, 3, 4, 5, 0], [1, 2, 3, 4, 5, 0]), 1, 'اتفاق تامّ');
  const k1 = weightedKappa([3, 4, 2, 5, 1, 3, 4, 2], [3, 4, 2, 5, 1, 3, 4, 3])!; assert.ok(k1 > 0.85 && k1 < 1, `اختلاف واحد صغير: ${k1}`);
  const k2 = weightedKappa([3, 4, 2, 5, 1, 3, 4, 2], [1, 2, 0, 3, 0, 1, 2, 0])!; assert.ok(k2 < k1, `انحياز منهجي بدرجتين أقلّ اتفاقًا: ${k2}`);
  assert.equal(weightedKappa([3], [3]), null, 'أقلّ من اثنين');
  assert.ok(weightedKappa([0, 5, 0, 5], [5, 0, 5, 0])! < 0, 'تعاكس تامّ سالب');
});

test('م4-أ: المخطّط — خلايا «غرفة الأداء» تُقرأ وتُقيَّد 0–3 ولا تكسر الخطط القائمة', () => {
  const sys = systemPlan('placement'); assert.equal(productiveTotal(sys), 0, 'النظامي بلا مهام افتراضيًّا'); assert.equal(sys.productiveMode, 'demonstrated');
  const { plan, errors } = planFromBlueprint({ code: 'SYS-FULL', test_type: 'placement', requirements: { levels: ['A1', 'B1', 'C2'], productive: { A1: { writing: 1, speaking: 1 }, B1: { writing: 9, speaking: -2 }, C2: { writing: 'x' } }, productive_mode: 'declared' }, duration_minutes: 62, cut_percent: 60 });
  assert.equal(errors.length, 0, errors.join(' | ')); assert.equal(plan.productive.A1.writing, 1); assert.equal(plan.productive.B1.writing, 3, 'سقف 3'); assert.equal(plan.productive.B1.speaking, 0, 'لا سالب'); assert.equal(plan.productive.C2.writing, 0, 'غير رقمي → 0');
  assert.equal(plan.productiveMode, 'declared'); assert.equal(productiveTotal(plan), 5); assert.ok(planTotal(plan) > 0, 'البنود الاستقبالية تبقى');
  const prodOnly = planFromBlueprint({ code: 'SYS-PRODUCTIVE', test_type: 'custom', requirements: { levels: ['B1'], counts: { B1: { grammar_vocab: 0, reading: 0, listening: 0 } }, productive: { B1: { writing: 1, speaking: 1 } } }, duration_minutes: 15, cut_percent: 60 });
  assert.equal(prodOnly.errors.length, 0, `إنتاجي فقط مقبول: ${prodOnly.errors.join(' | ')}`); assert.equal(planTotal(prodOnly.plan), 0); assert.equal(productiveTotal(prodOnly.plan), 2);
  const empty = planFromBlueprint({ code: 'X', test_type: 'custom', requirements: { levels: ['B1'], counts: { B1: { grammar_vocab: 0, reading: 0, listening: 0 } } }, duration_minutes: 15, cut_percent: 60 });
  assert.ok(empty.errors.includes('لا بنود في الخطة'), 'خطة فارغة تمامًا تُرفض');
});
