// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م5-ب «النموّ والمقارنة» — خطأ القياس · حكم النموّ · المقارنة بين محاولتين · إحصاء المجموعات و Cohen d · وثيقة شهادة النموّ · رموز ATH-G */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seOfPercent, verdictOf, certificateAllowed, attemptOf, compareAttempts, pairFor, groupStats, compareGroups, cohenD, effectAr, parseGroupSel, buildGrowthDoc, growthCode, isGrowthCode, levelIndex, VERDICT_AR, MIN_GROUP, type Attempt } from '../lib/miaar/growth';

const row = (id: string, email: string, level: string, entry: string, pct: number, n: number, when: string, over: Record<string, unknown> = {}) => ({
  id, candidate_email: email, access_code: `ML-${id.slice(0, 4).toUpperCase().padEnd(4, 'A')}-BBBB`, created_at: when, archived_at: null, previous_report_id: null, invite_id: null, group_tag: null, growth_vc_code: null, growth_public: false,
  report: { بيانات_المتقدم: { الاسم: 'نور الهدى الصالح' }, المستوى_العام: level, النسبة_العامة: pct, ملخص_التسكين: { المستوى_المثبت: level, مستوى_الالتحاق_المقترح: entry }, عدد_البنود_المقدمة: n, ميزان_الثقة: { الرمز: 'high' }, الموثوقية: { الضوء: 'green' },
    احصائيات: { grammar_vocab: { percent: pct, answered: 10 }, reading: { percent: pct - 5, answered: 10 }, listening: { percent: pct + 5, answered: 10 } }, سبب_الانتهاء: 'اكتمال النموذج' }, ...over,
});
const A = (r: any, i = 1): Attempt => attemptOf(r, i);

test('م5-ب: خطأ القياس للنسبة — مقيَّد بين 5% و95% ويصغر مع عدد البنود', () => {
  assert.equal(seOfPercent(null, 30), null, 'null');
  assert.equal(seOfPercent(50, 0), null, 'n 0');
  const se30 = seOfPercent(50, 30)!, se60 = seOfPercent(50, 60)!;
  assert.ok(Math.abs(se30 - 9.13) < 0.05, `se 50%/30 ≈ 9.13 (${se30})`); assert.ok(se60 < se30, 'أكثر بنودًا → خطأ أصغر');
  assert.ok(seOfPercent(100, 30)! > 0 && seOfPercent(0, 30)! > 0, 'الأطراف لا تصفر');
});

test('م5-ب: حكم النموّ — مؤكَّد/محتمل/ضمن الخطأ/تراجع', () => {
  assert.equal(verdictOf(1, 2.1), 'confirmed', 'درجة + z ≥ 1'); assert.equal(verdictOf(2, 0.2), 'confirmed', 'درجتان مهما كان z');
  assert.equal(verdictOf(1, 0.3), 'likely', 'درجة بلا دعم من النسبة → محتمل'); assert.equal(verdictOf(0, 2.2), 'likely', 'نسبة فقط فوق 1.96 → محتمل');
  assert.equal(verdictOf(0, 0.5), 'within', 'داخل الهامش'); assert.equal(verdictOf(0, -0.8), 'within', 'سالب صغير داخل الهامش');
  assert.equal(verdictOf(-1, -1.5), 'decline', 'نزول درجة مع z ≤ −1'); assert.equal(verdictOf(0, -2.5), 'decline', 'z ≤ −1.96');
  assert.equal(verdictOf(1, null), 'confirmed', 'بلا نسب: الدرجة تحكم');
  assert.ok(certificateAllowed('confirmed') && certificateAllowed('likely') && !certificateAllowed('within') && !certificateAllowed('decline'), 'الشهادة للمؤكَّد والمحتمل فقط');
  for (const k of Object.keys(VERDICT_AR)) assert.ok(VERDICT_AR[k as keyof typeof VERDICT_AR].title.length > 3, `عنوان ${k}`);
});

test('م5-ب: المقارنة بين محاولتين — الجملة والدرجات و«أستطيع» المستجدّ وفروق المهارات', () => {
  const a = A(row('a1', 'x@y.com', 'A2', 'B1', 48, 30, '2026-09-01T10:00:00Z'), 1); const b = A(row('a2', 'x@y.com', 'B1', 'B2', 72, 36, '2026-10-29T10:00:00Z'), 2);
  const c = compareAttempts(a, b);
  assert.equal(c.steps, 1, 'درجة واحدة'); assert.equal(c.percent_diff, 24, 'فرق 24'); assert.equal(c.days, 58, 'الأيام'); assert.equal(c.verdict, 'confirmed', 'مؤكَّد');
  assert.ok(c.sentence.includes('الاختبار الأول بتاريخ 2026-09-01') && c.sentence.includes('والثاني بتاريخ 2026-10-29') && c.sentence.includes('نموّ مؤكَّد'), c.sentence);
  assert.deepEqual(c.gained.map((g) => g.level), ['B1'], 'B1 فقط'); assert.equal(c.gained[0].statements.length, 3, 'ثلاث عبارات');
  assert.equal(c.skills.length, 3, 'ثلاث مهارات'); assert.ok(c.skills.every((s) => s.diff === 24), 'كل فرق 24');
  const d = compareAttempts(b, a); assert.equal(d.steps, -1, 'عكسيًّا'); assert.equal(d.verdict, 'decline', 'تراجع'); assert.equal(d.gained.length, 0, 'لا مكتسبات عند النزول');
  const pre = A(row('p0', 'x@y.com', 'A1', 'A1', 30, 20, '2026-08-01T10:00:00Z', { report: { ...row('p0', 'x@y.com', 'A1', 'A1', 30, 20, '2026-08-01T10:00:00Z').report, ملخص_التسكين: { المستوى_المثبت: 'A1', مستوى_الالتحاق_المقترح: 'A1', دون_A1: true } } }));
  assert.equal(pre.demonstrated, 'PRE_A1', 'دون A1 → PRE_A1'); const e = compareAttempts(pre, b); assert.equal(e.steps, 3, 'ثلاث درجات'); assert.deepEqual(e.gained.map((g) => g.level), ['A1', 'A2', 'B1'], 'كل المستويات بين البداية والنهاية');
});

test('م5-ب: المحاولة المرجعية — previous_report_id أولًا ثم السابقة مباشرة', () => {
  const a1 = A(row('r1', 'x@y.com', 'A1', 'A1', 40, 20, '2026-07-01T00:00:00Z'), 1), a2 = A(row('r2', 'x@y.com', 'A2', 'A2', 50, 20, '2026-08-01T00:00:00Z'), 2), a3 = A(row('r3', 'x@y.com', 'B1', 'B1', 65, 30, '2026-10-01T00:00:00Z', { previous_report_id: 'r1' }), 3);
  assert.equal(pairFor([a1, a2, a3], a3)?.id, 'r1', 'الإذن أشار إلى r1'); assert.equal(pairFor([a1, a2, a3], a2)?.id, 'r1', 'السابقة مباشرة'); assert.equal(pairFor([a1, a2, a3], a1), null, 'الأولى بلا مرجع');
});

test('م5-ب: إحصاء المجموعة — المتقدّم مرّة واحدة (أحدث محاولة) · التوزيع · k ≥ 5 · Cohen d بتفسير عربي', () => {
  const g = (tag: string, pcts: number[], levels: string[]) => pcts.map((p, i) => A(row(`${tag}${i}`, `${tag}${i}@y.com`, levels[i], levels[i], p, 30, `2026-10-${String(10 + i).padStart(2, '0')}T00:00:00Z`)));
  const GA = g('a', [40, 52, 48, 61, 50], ['A1', 'A2', 'A2', 'B1', 'A2']); const GB = g('b', [68, 72, 80, 65, 58], ['B1', 'B1', 'B2', 'B1', 'A2']);
  const dup = A(row('a0x', 'a0@y.com', 'B2', 'B2', 90, 30, '2026-10-20T00:00:00Z')); const sa = groupStats([...GA, dup], 'أ');
  assert.equal(sa.k, 5, 'البريد المكرّر يُحسب مرّة'); assert.equal(sa.dist.B2, 1, 'أحدث محاولة هي المعتمدة'); assert.equal(sa.attempts, 6, 'عدد المحاولات الخام');
  const c = compareGroups(GA, 'أ', GB, 'ب'); assert.ok(c.ok, 'k 5/5'); assert.equal(c.a.mean, 50.2, 'متوسط أ'); assert.equal(c.b.mean, 68.6, 'متوسط ب'); assert.ok((c.d || 0) > 2, `d كبير (${c.d})`); assert.ok(c.interpretation!.includes('أثر كبير') && c.interpretation!.includes('الثانية'), c.interpretation!);
  const small = compareGroups(GA.slice(0, 2), 'أ', GB, 'ب'); assert.equal(small.ok, false, 'أصغر من 5'); assert.ok(small.reason!.includes(String(MIN_GROUP)), 'السبب يذكر 5'); assert.equal(small.d, null, 'لا d');
  assert.equal(effectAr(0.1).startsWith('أثر لا يُذكر'), true, 'لا يُذكر'); assert.ok(effectAr(-0.6).includes('متوسط') && effectAr(-0.6).includes('الأولى'), 'لصالح الأولى');
  const e = cohenD([1, 2, 3], [1, 2, 3])!; assert.equal(e.d, 0, 'متطابقتان → 0'); assert.equal(cohenD([1], [2]), null, 'عيّنة أقلّ من 2');
});

test('م5-ب: parseGroupSel — وسم/دعوة/برنامج/فترة', () => {
  assert.deepEqual(parseGroupSel('a', new URLSearchParams('a_kind=tag&a=دفعة')), { kind: 'tag', value: 'دفعة' }, 'وسم');
  assert.deepEqual(parseGroupSel('b', new URLSearchParams('b_kind=period&b_from=2026-01-01&b_to=2026-02-01')), { kind: 'period', from: '2026-01-01', to: '2026-02-01' }, 'فترة');
  assert.equal(parseGroupSel('a', new URLSearchParams('a_kind=tag')), null, 'بلا قيمة'); assert.equal(parseGroupSel('a', new URLSearchParams('a_kind=x&a=1')), null, 'نوع مجهول');
});

test('م5-ب: وثيقة شهادة النموّ — Open Badges 3.0 بسُلّم CEFR و_athar.kind miaar_growth · رمز ATH-G', () => {
  const a = A(row('a1', 'x@y.com', 'A2', 'B1', 48, 30, '2026-09-01T10:00:00Z'), 1); const b = A(row('a2', 'x@y.com', 'B1', 'B2', 72, 36, '2026-10-29T10:00:00Z'), 2);
  const cmp = compareAttempts(a, b); const code = growthCode(() => 0.5); assert.ok(isGrowthCode(code), `رمز صالح ${code}`); assert.ok(!isGrowthCode('ATH-G-0000-1111'), 'بلا 0/1');
  const doc = buildGrowthDoc({ code, name: 'نور الهدى', email: 'x@y.com', cmp, site: 'https://athar-portal.vercel.app', did: 'did:web:athar-portal.vercel.app', now: new Date('2026-11-03T00:00:00Z'), statusIndex: 7, issuedBy: 'u1' });
  assert.ok(doc.type.includes('OpenBadgeCredential'), 'النوع'); assert.equal(doc.credentialStatus?.statusListIndex, '7', 'فهرس الحالة'); assert.equal(doc._athar.kind, 'miaar_growth', 'النوع الداخلي');
  assert.equal(doc.credentialSubject.achievement.alignment[0].targetCode, 'B1', 'محاذاة CEFR بالمستوى الثاني'); assert.equal(doc.credentialSubject.result.length, 2, 'نتيجتان'); assert.ok(doc.name.includes('→'), 'الاسم يحمل السهم');
  assert.equal(doc._athar.first.level, 'A2'); assert.equal(doc._athar.second.level, 'B1'); assert.equal(doc._athar.gained.length, 1, 'مكتسبات B1'); assert.ok(!('validUntil' in doc), 'بلا انتهاء');
  assert.equal(levelIndex('C2'), 6, 'فهرس السُّلّم');
});
