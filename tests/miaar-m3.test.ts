import test from 'node:test';
import assert from 'node:assert/strict';
import { itemStats, formReliability, rasch, bandMap, suggestLevel, alpha, kr21, livingston, light, pearson, type Response } from '../lib/miaar/psychometrics';

/* مولّد عشوائي حتمي */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const gauss = (r: () => number) => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/** محاكاة راش: أشخاص N بقدرات عادية، بنود k بصعوبات معلومة؛ كل شخص يجيب عن كل البنود */
function simulate(N: number, difficulties: number[], seed = 7, levelOf: (j: number) => string = () => 'B1'): Response[] {
  const r = rng(seed); const out: Response[] = [];
  for (let i = 0; i < N; i += 1) {
    const th = gauss(r);
    difficulties.forEach((b, j) => { const P = 1 / (1 + Math.exp(-(th - b))); const ok = r() < P; out.push({ session: 's' + i, item: 'i' + j, correct: ok ? 1 : 0, selected: ok ? 'a' : (['b', 'c', 'd'][Math.floor(r() * 3)]), level: levelOf(j), ms: 5000 + Math.floor(r() * 20000) }); });
  }
  return out;
}

test('م3 pearson/alpha/kr21/livingston على حالات معلومة', () => {
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-9);
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-9);
  const perfect = [[1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0]];
  assert.ok(alpha(perfect) > 0.99, 'بنود متطابقة → ألفا ≈ 1');
  assert.equal(alpha([[1, 0], [0, 1], [1, 0], [0, 1]]), 0, 'بنود متعاكسة → ألفا 0 (مقصوصة)');
  assert.ok(kr21([5, 6, 7, 8, 9, 10, 4, 3, 7, 6], 10) > 0.3);
  assert.ok(livingston([10, 10, 10, 10, 10], 6, 0.5) === 0 || livingston([9, 10, 9, 10, 9], 6, 0.5) > 0.9, 'كل الدرجات بعيدة عن الحدّ → ثبات قرار عالٍ');
  assert.equal(light(0.85, 120), 'green'); assert.equal(light(0.75, 60), 'yellow'); assert.equal(light(0.85, 60), 'yellow'); assert.equal(light(0.6, 200), 'red'); assert.equal(light(0.9, 20), 'gray');
});

test('م3 itemStats: صعوبة وتمييز وأعلام — بند مفخّخ بمفتاح خاطئ يُكشف', () => {
  const diffs = [-2, -1, 0, 1, 2, 0.5, -0.5, 0, 1.5, -1.5]; const data = simulate(200, diffs, 3);
  const key = new Map(diffs.map((_, j) => ['i' + j, 'a']));
  /* بند 9 مفتاحه الحقيقي a لكن سُجِّل b → المشتِّت a يغلب المفتاح */
  key.set('i9', 'b'); const poisoned = data.map((r) => r.item === 'i9' ? { ...r, correct: (r.selected === 'b' ? 1 : 0) as 0 | 1 } : r);
  const st = itemStats(poisoned, key); const by = new Map(st.map((s) => [s.item, s]));
  assert.equal(by.get('i0')!.n, 200);
  assert.ok(by.get('i0')!.p > by.get('i4')!.p, 'البند الأسهل (b=-2) أعلى صوابًا من الأصعب (b=2)');
  assert.ok(by.get('i2')!.rpb > 0.2, 'بند متوسط الصعوبة يميّز إيجابيًا: ' + by.get('i2')!.rpb);
  assert.ok(by.get('i9')!.flags.includes('distractor_beats_key'), 'المفتاح الخاطئ يُكشف: ' + by.get('i9')!.flags.join());
  assert.ok(by.get('i9')!.flags.includes('negative_discrimination') || by.get('i9')!.rpb < 0.15, 'المفخّخ لا يميّز');
  assert.ok(typeof by.get('i0')!.median_ms === 'number');
  const few = itemStats(data.filter((r) => Number(r.session.slice(1)) < 10), key); assert.ok(few.every((s) => s.flags.includes('collecting')), 'أقل من 30 → ما زال يجمع');
});

test('م3 formReliability: نموذج ثابت → ألفا؛ سحب عشوائي → KR-21؛ الأضواء والنصيحة', () => {
  const diffs = Array.from({ length: 12 }, (_, j) => -1.5 + j * 0.27); const data = simulate(150, diffs, 11);
  const sessions = new Map<string, { item: string; correct: 0 | 1 }[]>(); for (const r of data) { const a = sessions.get(r.session) || []; a.push({ item: r.item, correct: r.correct }); sessions.set(r.session, a); }
  const fixed = formReliability('level:B1', [...sessions.values()].map((items) => ({ items })), 60);
  assert.equal(fixed.method, 'alpha'); assert.equal(fixed.n, 150); assert.equal(fixed.k, 12);
  assert.ok(fixed.rel > 0.5 && fixed.rel < 1, 'ألفا معقولة: ' + fixed.rel); assert.ok(fixed.sem > 0); assert.ok(fixed.livingston > 0.5);
  assert.ok(['green', 'yellow', 'red'].includes(fixed.light));
  /* عشوائي: كل جلسة 8 بنود مختلفة من 12 */
  const r = rng(5); const rnd = [...sessions.values()].map((items) => ({ items: [...items].sort(() => r() - 0.5).slice(0, 8) }));
  const random = formReliability('level:B1', rnd, 60); assert.equal(random.method, 'kr21'); assert.equal(random.k, 8); assert.ok(random.rel >= 0 && random.rel <= 1);
  const tiny = formReliability('level:C2', rnd.slice(0, 10), 60); assert.equal(tiny.light, 'gray'); assert.match(tiny.advice, /جلسة أخرى/);
});

test('م3 rasch: يسترجع الصعوبات المعلومة (ارتباط > 0.95، RMSE < 0.3) ويتقارب', () => {
  const diffs = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, -0.25, 0.25, -1.25, 1.25]; const data = simulate(400, diffs, 21);
  const res = rasch(data); assert.ok(res.converged, 'تقارب خلال ' + res.iterations); assert.equal(res.items.length, 15); assert.ok(res.persons > 300);
  const est = diffs.map((_, j) => res.items.find((i) => i.item === 'i' + j)!.b); const centered = diffs.map((d) => d - diffs.reduce((a, b) => a + b, 0) / diffs.length);
  const corr = pearson(est, centered); assert.ok(corr > 0.95, 'ارتباط ' + corr);
  const rmse = Math.sqrt(est.reduce((s, e, j) => s + (e - centered[j]) ** 2, 0) / est.length); assert.ok(rmse < 0.3, 'RMSE ' + rmse);
  assert.ok(res.items.every((i) => i.infit > 0.6 && i.infit < 1.4), 'ملاءمة البنود ضمن 0.6–1.4');
  assert.ok(res.items.every((i) => i.se > 0 && i.se < 0.3));
});

test('م3 bandMap/suggestLevel: البند الذي يسقط في نطاق مستوى آخر يُقترح نقله، والقريب لا يُقترح', () => {
  const items = [
    ...Array.from({ length: 5 }, (_, i) => ({ level: 'A1', b: -2 + i * 0.1 })), ...Array.from({ length: 5 }, (_, i) => ({ level: 'A2', b: -1 + i * 0.1 })),
    ...Array.from({ length: 5 }, (_, i) => ({ level: 'B1', b: 0 + i * 0.1 })), ...Array.from({ length: 5 }, (_, i) => ({ level: 'B2', b: 1 + i * 0.1 })),
  ];
  const map = bandMap(items); assert.deepEqual(Object.keys(map.medians), ['A1', 'A2', 'B1', 'B2']);
  assert.equal(suggestLevel('A1', -1.9, map), null, 'في مكانه');
  assert.equal(suggestLevel('A1', 1.1, map), 'B2', 'بند معلَن A1 لكنه بصعوبة B2');
  assert.equal(suggestLevel('B2', -0.9, map), 'A2');
  assert.equal(suggestLevel('A2', -0.3, map), null, 'ضمن التسامح 0.75');
  assert.equal(suggestLevel('C2', 3, map), null, 'مستوى بلا بيانات → لا اقتراح');
});
