import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInstrumentText, parseAnswerKey, applyAnswerKey, parseCsv, parseRows, letterToKey, csvTemplate, validateQuestions } from '../lib/impact/import';
import { parseModelOutput, offlineGenerate, normalizeSpec, buildPrompt, buildPlan, planTotal, splitBatches, dedupeQuestions, parseBatch } from '../lib/impact/generate';

test('import: letters normalize', () => {
  assert.equal(letterToKey('أ.'), 'a'); assert.equal(letterToKey('ب)'), 'b'); assert.equal(letterToKey('C'), 'c'); assert.equal(letterToKey('٤'), 'd'); assert.equal(letterToKey('x'), null);
});

test('import: Arabic numbered instrument with options, domains and inline correct marks', () => {
  const text = `المحور: المعرفة
1. ما جمع كلمة «كتاب»؟
أ. كاتبون
ب. كتب *
ج. مكاتب
د. كتابات
٢) أي الجمل صحيحة؟
أ) ذهبتُ إلى السوقِ ✓
ب) ذهبتُ إلى السوقُ
ج) ذهبتُ إلى السوقَ
د) ذهبت الى السوق
المحور: المهارة
3- أستطيع كتابة فقرة قصيرة دون أخطاء
4- أشعر بالثقة عند التحدث بالعربية`;
  const r = parseInstrumentText(text);
  assert.equal(r.questions.length, 4);
  assert.equal(r.questions[0].kind, 'mcq'); assert.equal(r.questions[0].options.length, 4); assert.equal(r.questions[0].correct_key, 'b'); assert.equal(r.questions[0].options[1].ar, 'كتب');
  assert.equal(r.questions[1].correct_key, 'a'); assert.equal(r.questions[1].domain_ar, 'المعرفة');
  assert.equal(r.questions[2].kind, 'scale'); assert.equal(r.questions[2].domain_ar, 'المهارة'); assert.equal(r.questions[3].order_no, 4);
  assert.deepEqual(r.domains, ['المعرفة', 'المهارة']);
  assert.equal(validateQuestions(r.questions).length, 0);
});

test('import: Latin options + separate answer key', () => {
  const r = parseInstrumentText(`Q1. What is 2+2?\nA. 3\nB. 4\nC. 5\nD. 6\nQ2. Capital of KSA?\nA) Jeddah\nB) Riyadh\nC) Dammam`);
  assert.equal(r.questions.length, 2); assert.equal(r.questions[0].correct_key, null);
  assert.ok(r.warnings.some(w => w.includes('عدد البدائل 3')));
  const key = parseAnswerKey('1-B 2) ب');
  assert.deepEqual(key, { 1: 'b', 2: 'b' });
  const ap = applyAnswerKey(r.questions, key); assert.equal(ap.applied, 2); assert.deepEqual(ap.missing, []);
  assert.deepEqual(parseAnswerKey('1. أ\n2. د\n3: ج'), { 1: 'a', 2: 'd', 3: 'c' });
});

test('import: bullets become options, single option downgrades to scale', () => {
  const r = parseInstrumentText(`1. سؤال بنقاط\n• خيار أول\n• خيار ثانٍ (صحيح)\n• خيار ثالث\n• خيار رابع\n2. سؤال ببديل واحد\nأ. وحيد`);
  assert.equal(r.questions[0].kind, 'mcq'); assert.equal(r.questions[0].correct_key, 'b'); assert.equal(r.questions[0].options[1].ar, 'خيار ثانٍ');
  assert.equal(r.questions[1].kind, 'scale'); assert.ok(r.warnings.some(w => w.includes('حُوِّل إلى بند مقياس')));
});

test('import: CSV template round-trips through parseRows', () => {
  const rows = parseCsv(csvTemplate());
  assert.equal(rows.length, 5);
  const r = parseRows(rows);
  assert.equal(r.questions.length, 4);
  assert.equal(r.questions[0].kind, 'mcq'); assert.equal(r.questions[0].options.length, 4); assert.equal(r.questions[0].correct_key, 'b');
  assert.equal(r.questions[1].options.length, 2); assert.equal(r.questions[1].correct_key, 'a');
  assert.equal(r.questions[2].kind, 'scale'); assert.equal(r.questions[2].domain_ar, 'المهارة');
  // headerless simple list
  const r2 = parseRows([['أستطيع أ'], ['أستطيع ب']]); assert.equal(r2.questions.length, 2); assert.equal(r2.questions[1].kind, 'scale');
  // quoted cells with commas
  assert.deepEqual(parseCsv('"a, b",c\n1,"x""y"'), [['a, b', 'c'], ['1', 'x"y']]);
});

test('generate: model output parsing tolerates fences and index answers', () => {
  const out = parseModelOutput('```json\n{"questions":[{"domain_ar":"المعرفة","kind":"mcq","text_ar":"س؟","options":[{"ar":"1"},{"ar":"2"},{"ar":"3"},{"ar":"4"}],"correct_key":"3"},{"kind":"scale","text_ar":"أستطيع…"},{"kind":"mcq","text_ar":"ناقص","options":[{"ar":"x"}]}]}\n```');
  assert.equal(out.questions.length, 3);
  assert.equal(out.questions[0].correct_key, 'c'); assert.equal(out.questions[0].options[3].k, 'd');
  assert.equal(out.questions[1].kind, 'scale'); assert.equal(out.questions[1].domain_ar, 'عام');
  assert.equal(out.questions[2].kind, 'scale'); assert.ok(out.warnings.length >= 1);
  assert.equal(parseModelOutput('nonsense').questions.length, 0);
});

test('generate: offline generator + spec normalization + prompt', () => {
  const spec = normalizeSpec({ program_name: 'إدارة المشاريع', axes: 'التخطيط\nالتنفيذ', scale_per_axis: 3, mcq_per_axis: 2, objectives: 'أن يتمكن المتدرب من إعداد خطة مشروع\nأن يميز المتدرب بين أنواع المخاطر' });
  assert.deepEqual(spec.axes, ['التخطيط', 'التنفيذ']); assert.equal(spec.scale_count, 3); assert.equal(spec.count_mode, 'per_axis');
  const g = offlineGenerate(spec);
  assert.equal(g.questions.filter(q => q.kind === 'scale').length, g.questions.length);
  assert.equal(g.questions.filter(q => q.domain_ar === 'التخطيط').length, 3);
  assert.equal(g.questions.filter(q => q.domain_ar === 'أهداف البرنامج').length, 2);
  assert.ok(g.questions.some(q => q.text_ar === 'أستطيع إعداد خطة مشروع'));
  assert.ok(g.questions.some(q => q.text_ar === 'أستطيع أن أميز بين أنواع المخاطر'));
  assert.ok(g.warnings[0].includes('4 سؤالًا معرفيًا'));
  const p = buildPrompt(spec); assert.ok(p.user.includes('«التخطيط»: 3 بند تقدير ذاتي') && p.system.includes('JSON') && p.user.includes('التنويع إلزامي'));
  assert.equal(normalizeSpec({ scale_per_axis: 99 }).scale_count, 40);
  assert.equal(normalizeSpec({ count_mode: 'total', scale_count: 999 }).scale_count, 200);
});

test('generate: plan distributes totals, caps at 200, splits into batches', () => {
  const spec = normalizeSpec({ axes: ['أ', 'ب', 'ج'], count_mode: 'total', scale_count: 10, mcq_count: 7, tf_count: 2 });
  const plan = buildPlan(spec);
  assert.deepEqual(plan.map(p => p.scale), [4, 3, 3]); assert.deepEqual(plan.map(p => p.mcq), [3, 2, 2]); assert.deepEqual(plan.map(p => p.tf), [1, 1, 0]);
  assert.equal(planTotal(plan), 19);
  const big = buildPlan(normalizeSpec({ axes: ['أ', 'ب', 'ج', 'د', 'هـ', 'و'], count_mode: 'per_axis', scale_count: 40, mcq_count: 40 }));
  assert.equal(planTotal(big), 200);
  const batches = splitBatches(big);
  assert.ok(batches.length >= 8 && batches.every(b => planTotal(b) <= 24));
  assert.equal(batches.reduce((s, b) => s + planTotal(b), 0), 200);
  const one = splitBatches(plan); assert.equal(one.length, 1); // 19 بندًا ≤ 24
  assert.deepEqual(parseBatch(batches[0], big.map(p => p.axis)), batches[0]); assert.equal(parseBatch([{ axis: 'غريب', scale: 3 }], ['أ']), null);
});

test('generate: offline stems are varied across axes and dedupe works', () => {
  const spec = normalizeSpec({ axes: ['التخطيط', 'التنفيذ', 'المتابعة', 'التقويم'], scale_count: 6, mcq_count: 0 });
  const g = offlineGenerate(spec);
  assert.equal(g.questions.length, 24);
  const first3 = (t: string) => t.split(' ').slice(0, 3).join(' ');
  for (const ax of spec.axes) { const texts = g.questions.filter(q => q.domain_ar === ax).map(q => first3(q.text_ar)); assert.equal(new Set(texts).size, texts.length, ax); }
  // المحور الأول والثاني لا يبدآن بالصياغة نفسها
  assert.notEqual(first3(g.questions[0].text_ar), first3(g.questions[6].text_ar));
  const many = offlineGenerate(normalizeSpec({ axes: ['س'], scale_count: 40, mcq_count: 0 }));
  assert.equal(many.questions.length, 40);
  const dd = dedupeQuestions([...g.questions, ...g.questions]); assert.equal(dd.removed, 24); assert.equal(dd.questions[23].order_no, 24);
});
