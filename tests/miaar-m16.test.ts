/* مِعيار م16 — ميزان البنود المركّبة: تحليل الأجزاء · الأعلام · عدم كسر م3 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compositeStats, itemStats, FLAG_AR, FLAG_SEVERITY, MIN_N_ITEM, type Response } from '../lib/miaar/psychometrics';

/* يبني استجابات بند واحد بأنماط ونسب */
const build = (item: string, level: string, patterns: Array<[string, number]>, key: string, startSession = 0): Response[] => {
  const out: Response[] = []; let s = startSession;
  for (const [sel, n] of patterns) for (let i = 0; i < n; i += 1) { out.push({ session: `s${s}`, item, correct: sel === key ? 1 : 0, selected: sel, level }); s += 1; }
  return out;
};

test('م16: فراغات 3 أجزاء — الجزء 2 يقبل إجابةً ثانية → part_ambiguous + near_miss_heavy · لا dead_distractor', () => {
  const key = 'c-a-d';
  const rs = build('AR-LU-A1-M14-002', 'A1', [[key, 40], ['c-b-d', 45], ['a-a-d', 5], ['c-b-a', 10]], key);
  const c = compositeStats(rs, key, 'cloze_bank'); assert.ok(c);
  assert.equal(c.kind, 'slot'); assert.equal(c.n, 100); assert.equal(c.parts.length, 3);
  assert.equal(c.parts[0].p, 0.95); assert.equal(c.parts[1].p, 0.45); assert.equal(c.parts[1].top_wrong, 'b'); assert.equal(c.parts[1].top_wrong_share, 0.55);
  assert.equal(c.near_miss, 0.833); /* 45 (c-b-d) + 5 (a-a-d) جزء واحد خطأ من 60 خطأ */
  assert.ok(c.flags.includes('part_ambiguous')); assert.ok(c.flags.includes('near_miss_heavy')); assert.ok(!c.flags.includes('part_too_hard'));
  assert.ok(c.detail_ar.some((d) => d.includes('الفراغ ٢') && d.includes('«b»')));
  /* عبر itemStats مع نوع البند: الأعلام تُضمّ، ولا «مشتِّت ميت» رغم وجود نمط نادر (5%) */
  const st = itemStats(rs, new Map([['AR-LU-A1-M14-002', key]]), new Map([['AR-LU-A1-M14-002', 'cloze_bank']]));
  assert.equal(st.length, 1); assert.ok(st[0].composite); assert.ok(st[0].flags.includes('part_ambiguous')); assert.ok(!st[0].flags.includes('dead_distractor'));
  assert.ok(st[0].flags.includes('distractor_beats_key'), 'نمط c-b-d (45%) أقوى من المفتاح (40%) → شبهة مفتاح تبقى');
  assert.equal(st[0].composite!.flags.length, 2);
});

test('م16: ترتيب 4 قطع — تبديل متجاور شائع → pair_swapped · قريب من الصواب يعدّ التبديل المتجاور فقط', () => {
  const key = 'b-a-d-c';
  const rs = build('AR-RD-B1-M13B-010', 'B1', [[key, 50], ['b-d-a-c', 30], ['c-a-d-b', 10], ['a-b-c-d', 10]], key);
  const c = compositeStats(rs, key, 'ordering'); assert.ok(c);
  assert.equal(c.kind, 'perm'); assert.equal(c.swaps[0].a, 1); assert.equal(c.swaps[0].b, 2); assert.equal(c.swaps[0].share, 0.3);
  assert.ok(c.flags.includes('pair_swapped'));
  assert.equal(c.near_miss, 30 / 50, 'تبديل 1↔2 متجاور (30) نعم · تبديل 0↔3 غير متجاور (10) لا · a-b-c-d كلّ القطع خطأ لا');
  assert.ok(c.flags.includes('near_miss_heavy'));
  assert.ok(c.detail_ar.some((d) => d.includes('تبادل الموضع ٢↔٣')));
});

test('م16: جزء واحد صعب جدًا وبقيّة الأجزاء سهلة → part_too_hard · استجابات بطول مخالف تُهمَل من الأجزاء · لا يُرفع حين الكلّ صعب', () => {
  const key = 'a-b-c';
  const rs = build('X', 'A2', [[key, 20], ['a-b-d', 40], ['a-b-e', 35], ['a-b', 5]], key); /* 'a-b' طول مخالف → تُهمَل من الأجزاء */
  const c = compositeStats(rs, key, 'matching'); assert.ok(c);
  assert.equal(c.n, 95, 'بلا الخمس ذات الطول المخالف'); assert.equal(c.parts[0].p, 1); assert.equal(c.parts[2].p, 0.211);
  assert.ok(c.flags.includes('part_too_hard')); assert.ok(c.detail_ar.some((d) => d.startsWith('الزوج ٣')));
  assert.ok(c.flags.includes('part_ambiguous'), 'أكثر خطأ «d» 42% ≥ المفتاح 21% → شبهة إجابة ثانية أيضًا');
  /* الكلّ صعب (كلّ الأجزاء دون 0.6) → لا part_too_hard؛ too_hard العام يكفي */
  const c2 = compositeStats(build('Y', 'A2', [[key, 10], ['d-e-f', 60], ['a-e-f', 30]], key), key, 'matching'); assert.ok(c2 && c2.parts[0].p === 0.4 && !c2.flags.includes('part_too_hard'));
});

test('م16: mcq بلا typeByItem = سلوك م3 نفسه · n < 30 → collecting فقط · نوع غير مركّب → null · الأعلام الجديدة لها نصّ وشدّة', () => {
  const key = 'a'; const rs = build('M', 'A1', [['a', 60], ['b', 30], ['c', 9], ['d', 1]], key);
  const a = itemStats(rs, new Map([['M', key]])); const b = itemStats(rs, new Map([['M', key]]), new Map([['M', 'mcq']]));
  assert.deepEqual(a, b); assert.ok(a[0].flags.includes('dead_distractor')); assert.equal(a[0].composite, undefined);
  const few = compositeStats(build('Z', 'A1', [['c-a-d', 5], ['c-b-d', 20]], 'c-a-d'), 'c-a-d', 'cloze_bank'); assert.ok(few && few.n === 25 && few.flags.length === 0);
  const st = itemStats(build('Z', 'A1', [['c-a-d', 5], ['c-b-d', 20]], 'c-a-d'), new Map([['Z', 'c-a-d']]), new Map([['Z', 'cloze_bank']])); assert.deepEqual(st[0].flags, ['collecting']);
  assert.equal(compositeStats(rs, key, 'mcq'), null);
  for (const f of ['part_too_hard', 'part_ambiguous', 'pair_swapped', 'near_miss_heavy'] as const) { assert.ok(FLAG_AR[f].length > 5); assert.ok(FLAG_SEVERITY[f] >= 1); }
  assert.equal(MIN_N_ITEM, 30);
});
