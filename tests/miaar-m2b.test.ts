// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات مِعيار م2-ب: المخطّطات والخطط · السحب العشوائي لكل جلسة · سلّم الخطة · اجتياز المستوى · المِسبار المتجدّد
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, SKILLS, FORM_PLAN } from '../lib/miaar/registry';
import type { PoolItem, Level } from '../lib/miaar/registry';
import {
  TEST_TYPES, TEST_TYPE_INFO, systemPlan, planFromBlueprint, planFromSession, drawPlan, planStartIndex, nextStepPlan, levelVerdict, planTotal, examModeOf,
  probeFromPool, probeScoreFrom, probeBandIndexOf, doorOf, cellKey,
} from '../lib/miaar/blueprint';

const pool = (perCell = 6): PoolItem[] => { const out: PoolItem[] = []; let n = 0; for (const level of [...LEVELS, 'PRE_A1'] as const) for (const skill of SKILLS) for (let i = 0; i < perCell; i += 1) { n += 1; out.push({ id: `i${n}`, code: `${level}-${skill}-${i}`, level, skill, type: 'mcq', passageId: null, questionText: `سؤال ${n}`, options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { id: 'c', text: '3' }], correctOptionId: 'a', stimulus: null, descriptor: null }); } return out; };

test('م2-ب: ستة أنواع اختبار بأسماء رسمية · الخطط النظامية · نمط الجلسة من السلّم', () => {
  assert.equal(TEST_TYPES.length, 6, 'ستة أنواع');
  for (const t of TEST_TYPES) { assert.ok(TEST_TYPE_INFO[t].name_ar.length >= 3, `اسم ${t}`); assert.ok(TEST_TYPE_INFO[t].hint_ar.length > 10, `شرح ${t}`); }
  const place = systemPlan('placement'); assert.equal(planTotal(place), 50, 'تحديد المستوى 50'); assert.equal(place.probe, true, 'مِسبار'); assert.equal(place.floor, true, 'أرضية'); assert.equal(examModeOf(place), 'adaptive', 'نمط تكيفي');
  const comp = systemPlan('comprehensive'); assert.equal(planTotal(comp), 50, 'الشامل 50'); assert.equal(examModeOf(comp), 'comprehensive', 'نمط شامل'); assert.equal(comp.probe, false, 'بلا مِسبار');
  const short = systemPlan('short'); assert.equal(planTotal(short), 18, 'القصير 18'); assert.equal(short.durationSeconds, 15 * 60, 'ربع ساعة');
  const lvl = systemPlan('level', 'B2'); assert.deepEqual(lvl.levels, ['B2'], 'مستوى واحد'); assert.equal(lvl.ladder, 'single', 'سلّم مفرد'); assert.equal(lvl.cut, 70, 'حدّ 70'); assert.equal(planTotal(lvl), 20, '20 بندًا');
  assert.equal(doorOf(place).door, 'adaptive', 'باب تكيفي'); assert.equal(doorOf(short).items, 18, 'باب القصير 18');
});

test('م2-ب: planFromBlueprint — تنظيف الصفّ وأخطاء الخطة', () => {
  const ok = planFromBlueprint({ code: 'BP-X', name_ar: 'نموذج', test_type: 'custom', duration_minutes: 40, cut_percent: 65, requirements: { levels: ['B1', 'A2'], counts: { A2: { grammar_vocab: 3, reading: 1, listening: 0 }, B1: { grammar_vocab: 2, reading: 2, listening: 2 } }, draw: 'random' } });
  assert.deepEqual(ok.errors, [], 'بلا أخطاء'); assert.deepEqual(ok.plan.levels, ['A2', 'B1'], 'المستويات مرتّبة'); assert.equal(planTotal(ok.plan), 10, 'المجموع 10'); assert.equal(ok.plan.durationSeconds, 2400, 'المدة'); assert.equal(ok.plan.cut, 65, 'الحدّ');
  const empty = planFromBlueprint({ code: 'BP-E', name_ar: 'فارغ', test_type: 'custom', requirements: { levels: ['A1'], counts: { A1: { grammar_vocab: 0, reading: 0, listening: 0 } } } });
  assert.ok(empty.errors.some((e) => e.includes('لا بنود')), 'خطة فارغة مرفوضة');
  const basket = planFromBlueprint({ code: 'BP-B', name_ar: 'سلّة', test_type: 'custom', requirements: { levels: ['A1'], counts: { A1: { grammar_vocab: 3, reading: 0, listening: 0 } }, draw: 'expert_pool', pool: { 'A1:grammar_vocab': ['x', 'y'] } } });
  assert.ok(basket.errors.some((e) => e.includes('السلّة')), 'سلّة أصغر من المطلوب');
  const fixed = planFromBlueprint({ code: 'BP-F', name_ar: 'ثابت', test_type: 'custom', requirements: { levels: ['A1'], counts: { A1: { grammar_vocab: 2, reading: 0, listening: 0 } }, draw: 'fixed', pool: { 'A1:grammar_vocab': ['x', 'y', 'z'] } } });
  assert.ok(fixed.errors.some((e) => e.includes('بالضبط')), 'الثابت يحتاج العدد بالضبط');
  const level = planFromBlueprint({ code: 'BP-L', name_ar: 'B1', test_type: 'level', level: 'B1', cut_percent: 70, requirements: { counts: { B1: { grammar_vocab: 8, reading: 6, listening: 6 } } } });
  assert.deepEqual(level.plan.levels, ['B1'], 'المستوى من العمود'); assert.equal(level.plan.ladder, 'single', 'مفرد');
  const unknown = planFromBlueprint({ code: 'OLD', name_ar: 'قديم', test_type: 'diagnostic_short', requirements: {} });
  assert.equal(unknown.plan.type, 'custom', 'نوع قديم → خاص'); assert.ok(unknown.errors.length > 0, 'مع تنبيه');
  const sess = planFromSession(ok.plan); assert.equal(sess?.code, 'BP-X', 'الخطة من الجلسة'); assert.equal(planFromSession({ foo: 1 }), null, 'شكل غريب → null');
});

test('م2-ب: السحب عشوائي لكل جلسة ضمن الخلايا · سلّة الخبير · الثابت يبدّل الترتيب فقط · النقص لا يغلق الباب', () => {
  const P = pool(6); const plan = systemPlan('comprehensive');
  const a = drawPlan(P, 'session-1', plan)!; const b = drawPlan(P, 'session-2', plan)!;
  assert.equal(a.codes.length, 50, '50 بندًا'); assert.equal(b.codes.length, 50, '50 بندًا');
  assert.notDeepEqual(a.codes, b.codes, 'جلستان مختلفتان → بنود مختلفة');
  for (const level of LEVELS) for (const skill of SKILLS) assert.equal(a.codes.filter((c) => c.startsWith(`${level}-${skill}-`)).length, FORM_PLAN[level][skill], `خلية ${level}/${skill}`);
  const place = systemPlan('placement'); const withFloor = drawPlan(P, 's', place)!; assert.equal(withFloor.codes.filter((c) => c.startsWith('PRE_A1-')).length, 12, 'الأرضية 12 عند تفعيلها');
  const basketPlan = planFromBlueprint({ code: 'BP-B', name_ar: 'سلّة', test_type: 'custom', requirements: { levels: ['A1'], counts: { A1: { grammar_vocab: 2, reading: 0, listening: 0 } }, draw: 'expert_pool', pool: { [cellKey('A1', 'grammar_vocab')]: ['A1-grammar_vocab-0', 'A1-grammar_vocab-1', 'A1-grammar_vocab-2'] } } }).plan;
  const seen = new Set<string>(); for (let i = 0; i < 20; i += 1) for (const c of drawPlan(P, `s${i}`, basketPlan)!.codes) seen.add(c);
  assert.deepEqual([...seen].sort(), ['A1-grammar_vocab-0', 'A1-grammar_vocab-1', 'A1-grammar_vocab-2'], 'السحب لا يخرج عن السلّة'); assert.equal(drawPlan(P, 'x', basketPlan)!.codes.length, 2, 'اثنان من ثلاثة');
  const fixedPlan = planFromBlueprint({ code: 'BP-F', name_ar: 'ثابت', test_type: 'custom', requirements: { levels: ['A1'], counts: { A1: { grammar_vocab: 3, reading: 0, listening: 0 } }, draw: 'fixed', pool: { [cellKey('A1', 'grammar_vocab')]: ['A1-grammar_vocab-3', 'A1-grammar_vocab-4', 'A1-grammar_vocab-5'] } } }).plan;
  assert.deepEqual(drawPlan(P, 'p', fixedPlan)!.codes.sort(), ['A1-grammar_vocab-3', 'A1-grammar_vocab-4', 'A1-grammar_vocab-5'], 'الثابت: البنود نفسها');
  const thin = drawPlan(pool(1), 't', plan)!; assert.ok(thin.short.length > 0, 'النقص مسجَّل'); assert.ok(thin.codes.length < 50, 'اختبار أقصر لا باب موصد');
  assert.equal(drawPlan(P.filter((i) => i.level !== 'C2'), 'z', plan), null, 'مستوى خالٍ تمامًا → null');
});

test('م2-ب: نقطة البداية وسلّم الخطة — تكيفي على مجموعة مستويات · تتابعي · مفرد مع حكم اجتياز', () => {
  const place = systemPlan('placement');
  assert.equal(planStartIndex(place, probeBandIndexOf(5)), 2, 'المِسبار الكامل → B1 حدًّا أقصى'); assert.equal(planStartIndex(place, probeBandIndexOf(0)), 0, 'صفر → A1');
  const sub = planFromBlueprint({ code: 'BP-S', name_ar: 'ج', test_type: 'custom', requirements: { ladder: 'adaptive', levels: ['A2', 'B2', 'C1'], counts: { A2: { grammar_vocab: 2, reading: 0, listening: 0 }, B2: { grammar_vocab: 2, reading: 0, listening: 0 }, C1: { grammar_vocab: 2, reading: 0, listening: 0 } }, start_level: 'B2', floor: false } }).plan;
  assert.equal(planStartIndex(sub, 0), 3, 'البداية من B2 التي حدّدها المسؤول');
  const up = nextStepPlan(sub, { currentIndex: 3, startIndex: 3, direction: 'up', hasFloor: false }, 80); assert.equal(up.decision, 'advance', 'صعود'); assert.equal(up.nextIndex, 4, 'إلى C1 متخطّيًا B1 غير المدرج');
  const down = nextStepPlan(sub, { currentIndex: 3, startIndex: 3, direction: 'up', hasFloor: false }, 40); assert.equal(down.decision, 'descend', 'نزول من نقطة البداية'); assert.equal(down.nextIndex, 1, 'إلى A2 متخطّيًا B1');
  const failLow = nextStepPlan(sub, { currentIndex: 1, startIndex: 3, direction: 'down', hasFloor: true }, 40); assert.equal(failLow.decision, 'fail', 'الإخفاق في أدنى مستوى بلا أرضية في الخطة → فشل');
  const floorStep = nextStepPlan(place, { currentIndex: 0, startIndex: 0, direction: 'up', hasFloor: true }, 20); assert.equal(floorStep.decision, 'floor', 'تحديد المستوى: الأرضية بعد A1');
  const lin = systemPlan('short'); assert.equal(nextStepPlan(lin, { currentIndex: 0, startIndex: 0, direction: 'up', hasFloor: false }, 0).decision, 'advance', 'التتابعي يتقدّم ولو أخفق'); assert.equal(nextStepPlan(lin, { currentIndex: 5, startIndex: 0, direction: 'up', hasFloor: false }, 0).decision, 'complete', 'آخر مستوى → اكتمال');
  const lvl = systemPlan('level', 'B1'); assert.equal(nextStepPlan(lvl, { currentIndex: 2, startIndex: 2, direction: 'up', hasFloor: false }, 50).decision, 'complete', 'المفرد ينتهي بعد مستواه');
  const v = levelVerdict(lvl, [{ level: 'B1', percent: 75, answered: 20, total: 20 }])!; assert.equal(v.اجتاز, true, 'اجتاز 75 ≥ 70'); assert.equal(levelVerdict(lvl, [{ level: 'B1', percent: 65, answered: 20, total: 20 }])!.اجتاز, false, 'لم يجتز 65'); assert.equal(levelVerdict(lin, []), null, 'لا حكم لغير المفرد');
});

test('م2-ب: المِسبار المتجدّد — بند لكل مستوى من البنك · يختلف بين الزيارات · يستبعد المرئي · التصحيح بالرمز', () => {
  const P = pool(6);
  const a = probeFromPool(P, 'visit-1'); const b = probeFromPool(P, 'visit-2');
  assert.equal(a.length, 5, 'خمسة بنود'); assert.deepEqual(a.map((i) => i.level), ['A1', 'A2', 'B1', 'B2', 'C1'], 'A1..C1');
  assert.ok(a.some((i, k) => i.id !== b[k].id), 'زيارتان → بنود مختلفة');
  const seen = a.map((i) => i.id); const c = probeFromPool(P, 'visit-1', seen); assert.ok(c.every((i) => !seen.includes(i.id)), 'المرئي مستبعَد');
  for (const i of a) assert.ok(!('correct' in i) && !('correctOptionId' in i), 'بلا مفتاح');
  const answers = Object.fromEntries(a.map((i) => [i.id, 'a'])); assert.equal(probeScoreFrom(P, answers), 5, 'كلها صحيحة'); assert.equal(probeScoreFrom(P, { ...answers, [a[0].id]: 'b' }), 4, 'واحدة خطأ');
  assert.equal(probeScoreFrom(P, { 'A1-grammar_vocab-0': 'a', 'A1-grammar_vocab-1': 'a', 'A1-grammar_vocab-2': 'a' }), 1, 'إجابة واحدة لكل مستوى تُحتسب');
  assert.equal(probeScoreFrom(P, { 'warm-a1': 'a' }), 1, 'البنود الثابتة احتياط');
  const noBank = probeFromPool([], 's'); assert.equal(noBank.length, 5, 'بلا بنك → الثابتة'); assert.ok(noBank.every((i) => i.id.startsWith('warm-')), 'كلها ثابتة');
  const L: Level = 'A1'; void L;
});
