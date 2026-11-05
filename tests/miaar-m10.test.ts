// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م10 «مِران» — الأهلية · الوحدات الضعيفة · 14 يومًا (مرآة 7/14 · تمرين مزدوج) · الزمن بلا عقوبة · البنود والتصحيح · التقدّم والمرآة والجاهزية · مرآة النصّ · دمج الإعادة · التحقّق · الملخّص · الإشعارات · السحب مع الاستثناء · الأدلة · الغراء على قاعدة وهمية */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PLAN_DAYS, ITEMS_PER_DAY, MIRROR_DAYS, MAX_UNITS, READY_N, STATUS_AR, PRACTICE_TITLE,
  weakUnitsFrom, eligibleExit, quotas, planDays, currentDay, activeDay, pickDrill, pickMirror, gradeAnswer, unitProgress, mirrorRows, readiness,
  textPrompt, textMirror, mergeRetakeUnits, isAudioDataUrl, validateDayEdit, applyDayEdits, summarize,
  draftPlan, approvePlan, learnerView, answerItem, summariesForReports, practiceFactsForReports, runPracticeReminders, exposedCodes,
} from '../lib/miaar/practice';
import type { PlanRow } from '../lib/miaar/practice';
import { noticeText, KIND_AR } from '../lib/portal/notices';
import { drawPlan, systemPlan } from '../lib/miaar/blueprint';
import { LEVELS, SKILLS } from '../lib/miaar/registry';
import type { PoolItem } from '../lib/miaar/registry';
import { miaarEvidence, EMPTY_FACTS, MIAAR_CODES, practiceText } from '../lib/accreditation/miaar';
import { EVIDENCE_KIND_AR } from '../lib/accreditation/registry';
import { resetUnitsCache } from '../lib/miaar/syllabus';
import { invalidatePoolCache } from '../lib/miaar/bank';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const U = (code: string, title = code, focus = 'تركيز') => ({ code, level: code.slice(0, 2) as any, idx: 1, title_ar: title, title_en: title, focus_ar: focus, domains: [], descriptor_codes: [], status: 'approved' as const });
const EXIT = (over: any = {}) => ({ الحالة: 'final', النتيجة: 'conditional', المستوى: 'A1', مهارة_الإعادة: 'reading', الوحدات: [
  { الرمز: 'A1-U01', الاسم: 'التحية', عدد: 6, صواب: 2, النسبة: 33, الحالة: 'weak' }, { الرمز: 'A1-U02', الاسم: 'الأسرة', عدد: 6, صواب: 3, النسبة: 50, الحالة: 'watch' },
  { الرمز: 'A1-U03', الاسم: 'الوقت', عدد: 6, صواب: 6, النسبة: 100, الحالة: 'ok' }], ...over });

test('م10: الأهلية — نهائي ومشروط/راسب فقط · ما أُدمجت إعادته لا يُعاد تدريبه · الوحدات الضعيفة مرتّبة من الأضعف وبحدّ 4', () => {
  assert.equal(eligibleExit(EXIT()).ok, true, 'مشروط نهائي مؤهّل'); assert.equal((eligibleExit(EXIT()) as any).skill, 'reading', 'مهارة الإعادة');
  assert.equal(eligibleExit(EXIT({ النتيجة: 'failed' })).ok, true, 'راسب مؤهّل'); assert.equal((eligibleExit(EXIT({ النتيجة: 'failed' })) as any).skill, null, 'الراسب بلا مهارة إعادة');
  assert.equal((eligibleExit(EXIT({ الحالة: 'pending' })) as any).reason, 'not_final'); assert.equal((eligibleExit(EXIT({ النتيجة: 'passed' })) as any).reason, 'passed');
  assert.equal((eligibleExit(EXIT({ الإعادة: { الحالة: 'merged' } })) as any).reason, 'retake_merged'); assert.equal((eligibleExit(null) as any).reason, 'not_final');
  assert.deepEqual(weakUnitsFrom(EXIT()), ['A1-U01', 'A1-U02'], 'الضعيفة فقط ومن الأضعف');
  const allOk = EXIT({ الوحدات: EXIT().الوحدات.map((u: any) => ({ ...u, الحالة: 'ok' })) }); assert.deepEqual(weakUnitsFrom(allOk), ['A1-U01', 'A1-U02', 'A1-U03'], 'لا حمراء → الأدنى نسبةً');
  const many = EXIT({ الوحدات: Array.from({ length: 8 }, (_, i) => ({ الرمز: `A1-U0${i + 1}`, النسبة: i * 10, الحالة: 'weak', عدد: 5 })) }); assert.equal(weakUnitsFrom(many).length, MAX_UNITS, 'حدّ 4');
  assert.deepEqual(weakUnitsFrom({}), [], 'بلا وحدات');
});

test('م10: 14 يومًا — مرآة في 7 و14 · 12 يوم تمرين موزّعة بوزن تنازلي · لا تكرار وحدة الأمس · «تمرين مزدوج» يومي 1 و12 للمهارة الإنتاجية', () => {
  assert.equal(PLAN_DAYS, 14); assert.deepEqual([...MIRROR_DAYS], [7, 14]); assert.equal(ITEMS_PER_DAY, 5);
  assert.deepEqual(quotas(1), [12]); assert.deepEqual(quotas(2), [8, 4]); assert.deepEqual(quotas(3), [6, 4, 2]); assert.deepEqual(quotas(4), [5, 4, 2, 1]); assert.deepEqual(quotas(0), []);
  const days = planDays(['A1-U01', 'A1-U02', 'A1-U03']); assert.equal(days.length, 14);
  assert.equal(days[6].kind, 'mirror'); assert.equal(days[13].kind, 'mirror'); assert.equal(days.filter((d) => d.kind === 'drill').length, 12);
  const count = (u: string) => days.filter((d) => d.unit === u).length; assert.equal(count('A1-U01'), 6, 'الأضعف 6 أيام'); assert.equal(count('A1-U02'), 4); assert.equal(count('A1-U03'), 2);
  for (let i = 1; i < days.length; i += 1) if (days[i].kind === 'drill' && days[i - 1].kind === 'drill' && days[i].unit === days[i - 1].unit) assert.ok(count(days[i].unit!) >= 6, `تكرار متتالٍ فقط عند الضرورة (${days[i].d})`);
  assert.ok(days.every((d) => !d.text), 'لا نصّ للمهارة الاستقبالية');
  const prod = planDays(['A1-U01'], true); assert.equal(prod[0].text, true, 'نصّ اليوم 1'); assert.equal(prod[11].text, true, 'نصّ اليوم 12'); assert.equal(prod[6].text, true, 'يوم المرآة بنصّ'); assert.ok(!prod[2].text);
  assert.equal(planDays(['bad', 'A1-U01']).filter((d) => d.unit === 'A1-U01').length, 12, 'يتجاهل الرموز غير الصالحة');
});

test('م10: الزمن بتوقيت الرياض — قبل البدء 0 · اليوم 1 يوم البدء · بعد 14 انتهت · اليوم المفتوح = الحالي أو أقدم فائت (بلا عقوبة)', () => {
  assert.deepEqual(currentDay(null, new Date()), { d: 0, ended: false, before: true });
  assert.equal(currentDay('2026-11-06', new Date('2026-11-05T20:00:00Z')).d, 0, 'قبل البدء (الرياض 23:00 يوم 5)');
  assert.equal(currentDay('2026-11-06', new Date('2026-11-05T21:30:00Z')).d, 1, 'الرياض 00:30 يوم 6 → اليوم 1');
  assert.equal(currentDay('2026-11-06', new Date('2026-11-12T10:00:00Z')).d, 7, 'اليوم 7');
  const end = currentDay('2026-11-06', new Date('2026-11-25T10:00:00Z')); assert.equal(end.d, 14); assert.equal(end.ended, true);
  const days = planDays(['A1-U01', 'A1-U02']); assert.equal(activeDay(days, 0), null, 'قبل البدء لا بطاقة');
  assert.equal(activeDay(days, 3)!.d, 3, 'اليوم الحالي غير منجز');
  const d2 = days.map((x) => (x.d === 3 ? { ...x, done_at: 'x' } : x)); assert.equal(activeDay(d2, 3)!.d, 1, 'أُنجز 3 → يعود للفائت 1');
  const all = days.map((x) => ({ ...x, done_at: 'x' })); assert.equal(activeDay(all, 5), null, 'كلّ ما فُتح أُنجز');
});

const LITE = (n = 8, level = 'A1', unit = 'A1-U01'): PoolItem[] => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, code: `${level}-${i < n / 2 ? 'reading' : 'grammar_vocab'}-${i}`, level: level as any, skill: (i < n / 2 ? 'reading' : 'grammar_vocab') as any, type: 'mcq' as any, passageId: null, questionText: `س${i}`, options: [{ id: 'a', text: 'صواب' }, { id: 'b', text: 'خطأ' }], correctOptionId: 'a', stimulus: null, descriptor: 'A1.R.1', unitCodes: [unit] }));
test('م10: اختيار البنود — من الوحدة والمستوى · تفضيل مهارة الإعادة الاستقبالية · غير المكشوف أولًا · خلط ثابت بالبذرة · يوم المرآة من أخطاء الأسبوع', () => {
  const pool = LITE(12);
  const a = pickDrill(pool, 'A1', 'A1-U01', 'reading', new Set(), 'seed', 5); assert.equal(a.length, 5); assert.equal(a.filter((x) => x.skill === 'reading').length, 5, 'القراءة تكفي (6) → كلّها قراءة');
  const mixed = pickDrill(LITE(8), 'A1', 'A1-U01', 'reading', new Set(), 'seed', 5); assert.equal(mixed.length, 5, 'القراءة لا تكفي (4) → من الوحدة كلّها');
  const b = pickDrill(pool, 'A1', 'A1-U01', 'reading', new Set(), 'seed', 5); assert.deepEqual(a.map((x) => x.code), b.map((x) => x.code), 'نفس البذرة نفس الترتيب');
  const c = pickDrill(pool, 'A1', 'A1-U01', null, new Set(a.map((x) => x.code)), 'seed2', 5); assert.ok(c.slice(0, 3).every((x) => !a.some((y) => y.code === x.code)), 'غير المكشوف أولًا');
  assert.equal(pickDrill(pool, 'A1', 'A1-U09', null, new Set(), 's').length, 0, 'وحدة أخرى → لا شيء'); assert.equal(pickDrill(pool, 'A2', 'A1-U01', null, new Set(), 's').length, 0, 'مستوى آخر → لا شيء');
  const att = [{ kind: 'item' as const, item_code: 'x1', correct: false, at: '2026-11-01' }, { kind: 'item' as const, item_code: 'x1', correct: false, at: '2026-11-03' }, { kind: 'item' as const, item_code: 'x2', correct: true, at: '2026-11-02' }, { kind: 'item' as const, item_code: 'x3', correct: false, at: '2026-11-04' }, { kind: 'text' as const, item_code: null, correct: null, at: '2026-11-04' }];
  assert.deepEqual(pickMirror(att, 2), ['x1', 'x3'], 'الأكثر خطأً ثم الأحدث');
  const fb = gradeAnswer(pool[0], 'a', U('A1-U01', 'التحية', 'السلام والتعارف')); assert.equal(fb.correct, true); assert.match(fb.why_ar, /أحسنت/); assert.match(fb.why_ar, /التحية/);
  const bad = gradeAnswer(pool[0], 'b', null); assert.equal(bad.correct, false); assert.equal(bad.correct_option, 'صواب'); assert.match(bad.why_ar, /الإجابة الصحيحة/);
});

test('م10: التقدّم والمرآة والجاهزية — آخر 10 محاولات هي الميزان · أخضر 70%/10 · كهرماني 50%/5 · المرآة قبل ← الآن', () => {
  const units = ['A1-U01', 'A1-U02']; const iu = new Map<string, string[]>([['r1', ['A1-U01']], ['r2', ['A1-U02']]]);
  const att = (code: string, n: number, ok: number) => Array.from({ length: n }, (_, i) => ({ kind: 'item' as const, item_code: code, correct: i < ok, at: `2026-11-${String(i + 1).padStart(2, '0')}` }));
  const p0 = unitProgress([], iu, units); assert.equal(p0[0].percent, null); assert.equal(readiness(p0, [U('A1-U01'), U('A1-U02')]).state, 'early', 'بلا محاولات → مبكر');
  const p1 = unitProgress([...att('r1', 12, 10), ...att('r2', 12, 10)], iu, units); assert.equal(p1[0].n, 12); assert.equal(p1[0].recent_n, READY_N); assert.equal(p1[0].percent, 83);
  const r1 = readiness(p1, [U('A1-U01', 'التحية'), U('A1-U02')]); assert.equal(r1.state, 'ready'); assert.equal(r1.label_ar, 'جاهز للإعادة'); assert.match(r1.sentence_ar, /موعد الإعادة مناسب/);
  const p2 = unitProgress([...att('r1', 12, 10), ...att('r2', 6, 3)], iu, units); const r2 = readiness(p2, [U('A1-U01'), U('A1-U02', 'الأسرة')]); assert.equal(r2.state, 'close'); assert.match(r2.sentence_ar, /الأسرة/);
  const p3 = unitProgress([...att('r1', 12, 10), ...att('r2', 3, 3)], iu, units); assert.equal(readiness(p3, []).state, 'early', 'وحدة بلا 5 محاولات → مبكر');
  const m = mirrorRows(EXIT(), p1, [U('A1-U01', 'التحية'), U('A1-U02', 'الأسرة')]); assert.equal(m[0].before, 33); assert.equal(m[0].now, 83); assert.equal(m[0].delta, 50); assert.equal(m[0].title_ar, 'التحية'); assert.equal(mirrorRows(EXIT(), p0, [])[0].delta, null);
});

test('م10: المهارات الإنتاجية — مطلب محلي من تركيز الوحدة (لا مهامّ البنك) · مرآة نصّ بلا درجة · مُحدِّدات حسب المستوى', () => {
  const w = textPrompt(U('A1-U01', 'التحية', 'السلام والتعارف'), 'writing', 'A1'); assert.equal(w.min_words, 20); assert.match(w.prompt_ar, /اكتب 20 كلمة/); assert.match(w.prompt_ar, /التحية/);
  const s = textPrompt(null, 'speaking', 'B1'); assert.equal(s.min_words, 50); assert.match(s.prompt_ar, /تحدّث/); assert.match(s.prompt_ar, /60 ثانية/);
  assert.equal(textPrompt(null, 'writing', 'C1').min_words, 70);
  const poor = textMirror('أنا طالب. أنا طالب.', 20); assert.equal(poor.words, 4); assert.match(poor.notes_ar[0], /كتبت 4 كلمة/); assert.match(poor.notes_ar[2], /رابطين/);
  const good = textMirror('ذهبت إلى السوق صباحًا ثم اشتريت الخبز والحليب، لأن أمي طلبت ذلك. بعد أن رجعت إلى البيت قرأت كتابًا جديدًا. لكن الجو كان حارًا جدًا، لذلك فتحت النافذة وشربت الماء البارد.', 20);
  assert.ok(good.words >= 25); assert.ok(good.sentences >= 3); assert.ok(good.connectors >= 3, `روابط ${good.connectors}`); assert.match(good.notes_ar[0], /طول مناسب/); assert.match(good.notes_ar[3], /تنوّع/);
  assert.equal(textMirror('').words, 0);
});

test('م10: دمج الإعادة في خريطة الوحدات (المؤجَّل من م9) — تبقى النسبة الأصلية وتُضاف «بعد_الإعادة» مع الفرق', () => {
  const merged = mergeRetakeUnits(EXIT().الوحدات, { 'A1-U01': { n: 4, correct: 3 }, 'A1-U03': { n: 2, correct: 2 } })!;
  assert.equal(merged[0].النسبة, 33, 'الأصل لا يُمسّ'); assert.deepEqual(merged[0].بعد_الإعادة, { عدد: 4, صواب: 3, النسبة: 75, الفرق: 42 });
  assert.equal(merged[1].بعد_الإعادة, undefined, 'وحدة لم تظهر في الإعادة'); assert.equal(merged[2].بعد_الإعادة.الفرق, 0);
  assert.equal(mergeRetakeUnits(null, { a: { n: 1, correct: 1 } }), null); assert.deepEqual(mergeRetakeUnits(EXIT().الوحدات, null), EXIT().الوحدات);
  assert.equal(mergeRetakeUnits([{ الرمز: 'A1-U01' }], { 'A1-U01': { n: 0, correct: 0 } })![0].بعد_الإعادة, undefined, 'n=0 يُتجاهل');
});

test('م10: التحقّق — اليوم 1..14 · الوحدة من مستوى الخطّة · ملاحظة ≤300 · صوت data URL ≤220k بأنواع محدّدة · تطبيق التعديلات لا يمسّ يوم المرآة', () => {
  assert.equal((validateDayEdit({ day: 0 }, 'A1') as any).ok, false); assert.equal((validateDayEdit({ day: 15 }, 'A1') as any).ok, false);
  assert.deepEqual(validateDayEdit({ day: 3, unit: 'A1-U02' }, 'A1'), { ok: true, d: 3, unit: 'A1-U02' });
  assert.match((validateDayEdit({ day: 3, unit: 'A2-U02' }, 'A1') as any).error, /غير صالحة لهذا المستوى/);
  assert.equal((validateDayEdit({ day: 3, note_ar: '  ' + 'ن'.repeat(400) }, 'A1') as any).note_ar.length, 300);
  assert.equal((validateDayEdit({ day: 3, note_ar: '' }, 'A1') as any).note_ar, null);
  const au = 'data:audio/webm;codecs=opus;base64,' + 'A'.repeat(100); assert.equal(isAudioDataUrl(au), true); assert.equal(isAudioDataUrl('data:image/png;base64,AAA'), false); assert.equal(isAudioDataUrl('data:audio/webm;base64,' + 'A'.repeat(230000)), false, 'أطول من الحدّ');
  assert.equal((validateDayEdit({ day: 2, note_audio: au }, 'A1') as any).note_audio, au); assert.match((validateDayEdit({ day: 2, note_audio: 'javascript:x' }, 'A1') as any).error, /غير صالح/);
  const days = planDays(['A1-U01', 'A1-U02']); const out = applyDayEdits(days, [{ d: 1, unit: 'A1-U02', note_ar: 'ركّز' }, { d: 7, unit: 'A1-U02', note_ar: 'مرآة' }]);
  assert.equal(out[0].unit, 'A1-U02'); assert.equal(out[0].note_ar, 'ركّز'); assert.equal(out[6].unit, null, 'يوم المرآة بلا وحدة'); assert.equal(out[6].note_ar, 'مرآة'); assert.equal(days[0].unit, 'A1-U01', 'الأصل لم يتغيّر');
});

test('م10: الملخّص للوحات — الحالة بالعربية · اليوم · المُنجَز · الخمول من آخر محاولة · متوسط فرق المرآة', () => {
  const plan: PlanRow = { id: 'p1', report_id: 'r1', invite_id: 'i1', email: 'a@x', user_id: null, level: 'A1', skill: 'reading', units: ['A1-U01'], days: planDays(['A1-U01']).map((d) => (d.d <= 3 ? { ...d, done_at: 'x' } : d)), status: 'approved', created_by: null, approved_by: 'u1', approved_at: '2026-11-01T06:00:00Z', start_date: '2026-11-02', last_attempt_at: '2026-11-04T06:00:00Z', done_at: null, created_at: '2026-11-01' };
  const s = summarize(plan, new Date('2026-11-08T09:00:00Z'), [{ unit: 'A1-U01', title_ar: 'x', before: 30, now: 60, delta: 30 }, { unit: 'A1-U02', title_ar: 'y', before: 40, now: 50, delta: 10 }], { state: 'close', label_ar: '', sentence_ar: '', per_unit: [] });
  assert.equal(s.status_ar, 'معتمدة'); assert.equal(s.today, 7); assert.equal(s.done, 3); assert.equal(s.total, 14); assert.equal(s.idle_days, 4); assert.equal(s.avg_delta, 20); assert.equal(s.ready, 'close');
  assert.equal(summarize({ ...plan, status: 'draft' }, new Date(), null, null).idle_days, null, 'المسوَّدة بلا خمول'); assert.equal(STATUS_AR.done, 'انتهت'); assert.equal(PRACTICE_TITLE.ar, 'مِران — تدريب ما بين الحكم والإعادة');
});

test('م10: نصوص الإشعارات الأربعة — بلا درجات · روابط صحيحة · أسماء الأنواع بالعربية', () => {
  const plan = noticeText({ kind: 'practice_plan', level: 'A1', code: 'ML-1111-2222', days: 14 }); assert.equal(plan.url, '/miaar/practice/ML-1111-2222'); assert.match(plan.title_ar, /مِران/); assert.match(plan.title_ar + plan.body_ar, /14/);
  const day = noticeText({ kind: 'practice_day', day: 5, unit_title: 'الأسرة', code: 'ML-1111-2222' }); assert.match(day.title_ar, /5/); assert.match(day.title_ar, /الأسرة/); assert.equal(day.url, '/miaar/practice/ML-1111-2222');
  const nudge = noticeText({ kind: 'practice_nudge', trainer: 'أ. سارة', code: 'ML-1111-2222' }); assert.match(nudge.title_ar, /سارة/);
  const idle = noticeText({ kind: 'practice_idle', name: 'محمد', days: 3, inviteId: 'inv-1' }); assert.match(idle.title_ar, /محمد/); assert.match(idle.url, /\/admin\/miaar\/exit\?invite=inv-1/);
  for (const k of ['practice_plan', 'practice_day', 'practice_nudge', 'practice_idle'] as const) assert.ok(KIND_AR[k]?.length >= 3, `اسم ${k}`);
  for (const t of [plan, day, nudge]) assert.ok(!/\d+%/.test(t.title_ar + t.body_ar), 'لا نسب في نصّ الإشعار');
});

test('م10: الحماية من الكشف — drawPlan يستثني البنود المكشوفة في مِران حين يكفي المخزون ويُعلم بـ exposure-kept حين لا يكفي', () => {
  const pool: PoolItem[] = []; let n = 0; for (const level of LEVELS) for (const skill of SKILLS) for (let i = 0; i < 12; i += 1) { n += 1; pool.push({ id: `i${n}`, code: `${level}-${skill}-${i}`, level, skill, type: 'mcq' as any, passageId: null, questionText: `س${n}`, options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }], correctOptionId: 'a', stimulus: null, descriptor: null }); }
  const plan = systemPlan('level', 'A1'); const base = drawPlan(pool, 'seed', plan)!; const need = base.codes.length; assert.ok(need > 0);
  const exposed = new Set(base.codes.slice(0, 3)); const ex = drawPlan(pool, 'seed', plan, { exclude: exposed })!;
  assert.equal(ex.codes.length, need, 'العدد نفسه'); assert.ok(ex.codes.every((c) => !exposed.has(c)), 'لا بند مكشوف'); assert.ok(!ex.short.some((s) => s.includes('exposure-kept')));
  const allA1 = new Set(pool.filter((p) => p.level === 'A1' && p.skill === 'grammar_vocab').map((p) => p.code)); const tight = drawPlan(pool, 'seed', plan, { exclude: allA1 })!;
  assert.equal(tight.codes.length, need, 'لا يغلق الباب'); assert.ok(tight.short.some((s) => s.includes('exposure-kept')), 'يُعلم أن المخزون ضاق');
});

test('م10: أدلة الاعتماد — نوع miaar_practice (2.2 · 2.5 · 3.3) · k ≥ 5 خطّة معتمدة · نصّ بلا أسماء', () => {
  assert.deepEqual([...MIAAR_CODES.practice], ['2.2', '2.5', '3.3']); assert.match(EVIDENCE_KIND_AR.miaar_practice, /مِران/);
  const few = miaarEvidence({ ...EMPTY_FACTS, practice: { plans: 4, approved: 4, active: 2, days_done: 20, avg_delta: 12, with_delta: 3, retook: 1, passed_after: 1 } }); assert.ok(!few.some((e) => e.kind === 'miaar_practice'), 'أقل من 5 → لا دليل');
  const ev = miaarEvidence({ ...EMPTY_FACTS, practice: { plans: 7, approved: 6, active: 2, days_done: 41, avg_delta: 18, with_delta: 4, retook: 3, passed_after: 2 } }).find((e) => e.kind === 'miaar_practice')!;
  assert.ok(ev); assert.equal(ev.n, 6); assert.deepEqual(ev.codes, ['2.2', '2.5', '3.3']); assert.match(ev.label_ar, /6 خطّة/); assert.match(ev.label_ar, /\+18/); assert.match(ev.label_ar, /3 أعادوا/); assert.match(ev.href, /admin\/miaar\/exit/);
  assert.ok(!practiceText({ plans: 5, approved: 5, active: 0, days_done: 0, avg_delta: null, with_delta: 0, retook: 0, passed_after: 0 }).includes('متوسط'), 'بلا فرق → بلا متوسط');
});

/* ───────── قاعدة وهمية ───────── */
function fakeDb(seed: { plans?: any[]; attempts?: any[]; notices?: any[]; reports?: any[]; items?: any[]; units?: any[]; profiles?: any[] } = {}) {
  const T: Record<string, any[]> = { miaar_practice_plans: seed.plans || [], miaar_practice_attempts: seed.attempts || [], portal_learner_notices: seed.notices || [], placement_reports: seed.reports || [], question_bank_items: seed.items || [], question_bank_answer_keys: (seed.items || []).map((i: any) => ({ item_id: i.id, correct_option_id: 'a' })), miaar_syllabus_units: seed.units || [], miaar_passages: [], profiles: seed.profiles || [], portal_push_subscriptions: [], portal_settings: [] };
  let ids = 0;
  const q = (table: string) => { const rows = T[table] || (T[table] = []); let f: Array<(r: any) => boolean> = []; let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'; let payload: any = null; let single = false; let lim = 0;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => r[k] === v); return b; }, lte() { return b; }, gte() { return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, upsert(p: any) { mode = 'upsert'; payload = p; return b; },
      then(res: any) { let data: any; if (mode === 'insert' || mode === 'upsert') { const arr = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${++ids}`, created_at: new Date().toISOString(), ...p })); if (mode === 'upsert' && table === 'portal_learner_notices') { for (const r of arr) if (rows.some((x) => x.dedupe_key === r.dedupe_key)) return res({ data: null, error: { code: '23505' } }); } rows.push(...arr); data = single ? arr[0] : arr; }
        else if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); data = single ? hit[0] || null : hit; }
        else { const hit = rows.filter((r) => f.every((p) => p(r))); data = single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit); }
        return res({ data, error: null }); } };
    return b; };
  return { T, from: q, rpc: async () => ({ data: null, error: null }) };
}
const ITEM = (code: string, skill: string, unit: string, level = 'A1') => ({ id: `id-${code}`, item_code: code, level, skill, item_type: 'mcq', status: 'approved', options: [{ id: 'a', text: 'صواب' }, { id: 'b', text: 'خطأ' }, { id: 'c', text: 'ربما' }, { id: 'd', text: 'لا' }], unit_codes: [unit], question_text: `سؤال ${code}`, passage_id: null, stimulus: null, media_path: null, media_alt: null, descriptor_code: null, cefr_descriptor: null });

test('م10: الغراء — مسوَّدة من الحكم · لا تُفتح للمتعلّم قبل الاعتماد · الاعتماد يثبّت الأيام ويبدأ غدًا ويُبلغ (مرة واحدة) · الملخّصات والحقائق', async () => {
  const db = fakeDb({ reports: [{ id: 'r1', candidate_email: 'a@x.sa', access_code: 'ML-1111-2222', invite_id: 'inv1', report: { exit: EXIT() } }] });
  const rep = { id: 'r1', candidate_email: 'a@x.sa', access_code: 'ML-1111-2222', invite_id: 'inv1', report: { exit: EXIT() } };
  const no = await draftPlan(db as any, { ...rep, report: { exit: EXIT({ النتيجة: 'passed' }) } }, 'u1'); assert.equal(no.ok, false, 'المجتاز لا خطّة له');
  const d = await draftPlan(db as any, rep, 'u1'); assert.equal(d.ok, true); if (!d.ok) return; assert.equal(d.plan.status, 'draft'); assert.deepEqual(d.plan.units, ['A1-U01', 'A1-U02']); assert.equal(d.plan.days.length, 14); assert.equal(d.plan.skill, 'reading');
  const again = await draftPlan(db as any, rep, 'u1'); assert.equal(again.ok && again.existed, true, 'المسوَّدة لا تتكرّر');
  const lv0 = await learnerView(db as any, rep); assert.equal(lv0, null, 'المسوَّدة لا تظهر للمتعلّم');
  const now = new Date('2026-11-05T09:00:00Z');
  const ap = await approvePlan(db as any, d.plan.id, 'u1', [{ d: 1, note_ar: 'ابدأ بهدوء' }], { site: 'https://x', code: 'ML-1111-2222', now }); assert.equal(ap.ok, true); if (!ap.ok) return;
  assert.equal(ap.plan.status, 'approved'); assert.equal(ap.plan.start_date, '2026-11-05', 'اليوم 1 = يوم الاعتماد (بتوقيت الرياض) — يبدأ فورًا'); assert.equal(ap.plan.days[0].note_ar, 'ابدأ بهدوء'); assert.equal(ap.plan.approved_by, 'u1');
  assert.equal(db.T.portal_learner_notices.length, 1, 'إشعار الاعتماد'); assert.equal(db.T.portal_learner_notices[0].kind, 'practice_plan'); assert.equal(db.T.portal_learner_notices[0].dedupe_key, `practice_plan:${d.plan.id}`);
  const twice = await approvePlan(db as any, d.plan.id, 'u1', [], { now }); assert.equal(twice.ok, false, 'لا اعتماد مرّتين');
  const sums = await summariesForReports(db as any, [rep], { now: new Date('2026-11-06T09:00:00Z') }); assert.equal(sums.r1.status, 'approved'); assert.equal(sums.r1.today, 2); assert.equal(sums.r1.done, 0);
  const facts = await practiceFactsForReports(db as any, [rep]); assert.equal(facts.plans, 1); assert.equal(facts.approved, 1); assert.equal(facts.active, 1);
  const exposed = await exposedCodes(db as any, 'a@x.sa'); assert.equal(exposed.size, 0, 'لا مكشوف قبل التمرين');
});

test('م10: الغراء — بطاقة اليوم ببنود الوحدة · الإجابة بتغذية راجعة فورية · لا إجابة مرّتين · إتمام اليوم · المكشوف يُسجَّل للاستثناء', async () => {
  const items = [...Array.from({ length: 6 }, (_, i) => ITEM(`A1-reading-${i}`, 'reading', 'A1-U01')), ...Array.from({ length: 6 }, (_, i) => ITEM(`A1-grammar_vocab-${i}`, 'grammar_vocab', 'A1-U02'))];
  const units = [{ code: 'A1-U01', level: 'A1', idx: 1, title_ar: 'التحية', title_en: 'Greetings', focus_ar: 'السلام', domains: [], descriptor_codes: [], status: 'approved' }, { code: 'A1-U02', level: 'A1', idx: 2, title_ar: 'الأسرة', title_en: 'Family', focus_ar: 'أفراد الأسرة', domains: [], descriptor_codes: [], status: 'approved' }];
  const days = planDays(['A1-U01', 'A1-U02']);
  const db = fakeDb({ items, units, plans: [{ id: 'p1', report_id: 'r1', invite_id: 'inv1', email: 'a@x.sa', user_id: null, level: 'A1', skill: 'reading', units: ['A1-U01', 'A1-U02'], days, status: 'approved', created_by: 'u1', approved_by: 'u1', approved_at: '2026-11-05T06:00:00Z', start_date: '2026-11-06', last_attempt_at: null, done_at: null, created_at: '2026-11-05' }] });
  resetUnitsCache(); invalidatePoolCache(); /* ذاكرات 30/90 ث من الاختبار السابق */
  const rep = { id: 'r1', report: { exit: EXIT() } }; const now = new Date('2026-11-06T09:00:00Z');
  const v = await learnerView(db as any, rep, { now }); assert.ok(v); assert.equal(v!.اليوم, 1); assert.equal(v!.الحالة, 'approved'); assert.equal(v!.الأيام.length, 14);
  const card = v!.بطاقة_اليوم!; assert.equal(card.d, 1); assert.equal(card.unit, 'A1-U01'); assert.equal(card.unit_title, 'التحية'); assert.equal(card.form!.questions.length, ITEMS_PER_DAY, '5 بنود');
  assert.ok(card.form!.questions.every((q: any) => !('correctOptionId' in q)), 'لا مفاتيح في النموذج');
  const q0 = card.form!.questions[0];
  const a1 = await answerItem(db as any, rep, { day: 1, item: q0.id, option: 'b' }, { now }); assert.equal(a1.ok, true); if (!a1.ok) return; assert.equal(a1.feedback.correct, false); assert.match(a1.feedback.why_ar, /التحية/); assert.equal(a1.day_done, false);
  const dup = await answerItem(db as any, rep, { day: 1, item: q0.id, option: 'a' }, { now }); assert.equal(dup.ok, false); assert.equal((dup as any).error, 'already_answered');
  const bad = await answerItem(db as any, rep, { day: 1, item: 'nope', option: 'a' }, { now }); assert.equal(bad.ok, false);
  let last: any = null; for (const q of card.form!.questions.slice(1)) last = await answerItem(db as any, rep, { day: 1, item: q.id, option: 'a' }, { now });
  assert.equal(last.day_done, true, 'اكتمل اليوم بعد 5'); assert.equal(db.T.miaar_practice_attempts.length, 5);
  const plan = db.T.miaar_practice_plans[0]; assert.ok(plan.days[0].done_at, 'يوم 1 مُنجَز'); assert.equal(plan.days[0].correct, 4); assert.ok(plan.last_attempt_at);
  const v2 = await learnerView(db as any, rep, { now }); assert.equal(v2!.بطاقة_اليوم, null, 'لا بطاقة بعد الإتمام'); assert.equal(v2!.أُنجز, 1); assert.equal(v2!.المرآة[0].now, 80); assert.equal(v2!.المرآة[0].before, 33); assert.equal(v2!.المرآة[0].delta, 47);
  const ex = await exposedCodes(db as any, 'a@x.sa'); assert.equal(ex.size, 5, 'خمسة بنود مكشوفة تُستثنى من الإعادة الرسمية');
  const sums = await summariesForReports(db as any, [rep], { now }); assert.equal(sums.r1.done, 1); assert.equal(sums.r1.ready, 'early');
});

test('م10: التذكير اليومي — «مِران اليوم» مرة لكل يوم (dedupe) · خامل 3 أيام → إشعار المدرّب · انتهاء 14 → done · تجريبي لا يكتب', async () => {
  const days = planDays(['A1-U01']);
  const mk = (id: string, start: string, last: string | null, email: string) => ({ id, report_id: 'r' + id, invite_id: 'inv1', email, user_id: null, level: 'A1', skill: null, units: ['A1-U01'], days, status: 'approved', created_by: 'u1', approved_by: 'u1', approved_at: `${start}T06:00:00Z`, start_date: start, last_attempt_at: last, done_at: null, created_at: start });
  const db = fakeDb({ plans: [mk('p1', '2026-11-06', null, 'a@x.sa'), mk('p2', '2026-10-20', '2026-10-21T06:00:00Z', 'b@x.sa'), mk('p3', '2026-11-01', '2026-11-01T06:00:00Z', 'c@x.sa')], reports: [{ id: 'rp1', access_code: 'ML-0000-0001', candidate_email: 'a@x.sa' }, { id: 'rp3', access_code: 'ML-0000-0003', candidate_email: 'c@x.sa', report: { بيانات_المتقدم: { الاسم: 'سامي أحمد' } } }], profiles: [{ id: 'u1', email: 'trainer@x.sa' }] });
  const now = new Date('2026-11-06T06:00:00Z');
  const dry = await runPracticeReminders(db as any, { site: 'https://x', dry: true } as any); assert.equal(dry.checked, 3);
  const r = await runPracticeReminders(db as any, { site: 'https://x' } as any); assert.equal(r.checked, 3); assert.ok(r.day_sent >= 1, 'تذكير اليوم'); assert.equal(r.closed, 1, 'p2 انتهت'); assert.ok(r.idle_sent >= 1, 'p3 خامل');
  assert.equal(db.T.miaar_practice_plans.find((p) => p.id === 'p2').status, 'done');
  const kinds = db.T.portal_learner_notices.map((n) => n.kind); assert.ok(kinds.includes('practice_day')); assert.ok(kinds.includes('practice_idle'));
  const idleN = db.T.portal_learner_notices.find((n) => n.kind === 'practice_idle'); assert.equal(idleN.email, 'trainer@x.sa', 'يصل المدرّب المعتمِد'); assert.match(idleN.title_ar, /سامي/); assert.ok(!/سامي أحمد/.test(idleN.title_ar), 'الاسم الأول فقط');
  const n1 = db.T.portal_learner_notices.length; await runPracticeReminders(db as any, { site: 'https://x' } as any); assert.equal(db.T.portal_learner_notices.length, n1, 'التشغيل الثاني لا يكرّر');
  void now;
});

test('م10: سلامة الملفات — الصفحة واللوحة والمسارات والهجرة والسجلّ والخريطة', () => {
  const app = read('app/miaar/practice/PracticeApp.tsx'); for (const t of ['mp-card', 'mp-opt', 'mp-fb', 'mp-mirror', 'mp-ready', 'mp-days', 'aria-live', 'consent', 'mp-back-result', 'WayBar']) assert.ok(app.includes(t), `PracticeApp: ${t}`);
  assert.ok(read('app/miaar/practice/[code]/page.tsx').includes("robots: { index: false"), 'لا فهرسة');
  const panel = read('app/admin/miaar/PracticePanel.tsx'); for (const t of ['pr-approve-all', 'pr-approve', 'pr-day', 'MediaRecorder', 'pr-nudge', 'pr-skip', 'approve_all']) assert.ok(panel.includes(t), `PracticePanel: ${t}`);
  const board = read('app/admin/miaar/ExitBoard.tsx'); assert.ok(board.includes('PracticePanel') && board.includes('xb-practice-cell') && board.includes('PR_CSS'), 'ExitBoard يربط مِران');
  const pub = read('app/api/miaar/practice/route.ts'); assert.ok(pub.includes("'ai_feedback'") && pub.includes('consent') && pub.includes('rateLimit'), 'المسار العام: موافقة صريحة وحدّ معدّل');
  const adm = read('app/api/admin/miaar/practice/route.ts'); for (const a of ['draft', 'approve', 'approve_all', 'edit_day', 'nudge', 'cancel']) assert.ok(adm.includes(`'${a}'`), `admin action ${a}`); assert.ok(adm.includes('miaar_practice_approve'), 'سجلّ تدقيق');
  const sql = read('supabase/migrations/20270205_portal_miaar_m10_practice.sql'); assert.ok(sql.includes('miaar_practice_plans') && sql.includes('miaar_practice_attempts') && sql.includes('row level security'), 'الهجرة');
  const reg = read('lib/vault/registry.ts'); assert.ok(reg.includes('miaar_practice_plans') && reg.includes('miaar_practice_attempts'), 'سجلّ الخزنة');
  const way = read('lib/portal/way.ts'); assert.ok(way.includes("'miaar/practice'"), 'الخريطة');
  assert.ok(read('app/api/followups/send/route.ts').includes('runPracticeReminders'), 'الكرون اليومي'); assert.ok(read('lib/ai/prompts.ts').includes('miaar_practice_feedback'), 'غرض الذكاء');
  assert.ok(read('lib/miaar/engine.ts').includes('exposedCodes'), 'المحرّك يستثني المكشوف'); assert.ok(read('lib/miaar/exitflow.ts').includes('mergeRetakeUnits'), 'دمج الإعادة');
  assert.ok(read('app/miaar/client/ClientBoard.tsx').includes('cb-practice'), 'بوابة الجهة'); assert.ok(read('app/miaar/MiaarApp.tsx').includes('mi-practice'), 'بطاقة النتيجة');
});
