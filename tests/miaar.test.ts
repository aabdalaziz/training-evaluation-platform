// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات «مِعيار — من أَثَر» (م1): الخطة والسحب · مِسبار · قرار التقدّم · إحصاء المستويات والتسكين · ميزان الثقة · التقرير بمفاتيحه العربية · الرموز · الدعوات · تشكيل الصفوف القديمة
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, SKILLS, FORM_PLAN, PASS_PERCENT, WITHDRAWN_CODES, M1_ITEM_TYPES, MIAAR_NAMES_AR, CAN_DO,
  drawCodes, shufflePool, probePublic, probeScore, probeBand, probeStartIndex, PROBE_ITEMS, nextStep, levelStats, placementLevels, confidence,
  calculateReport, shortCode, isShortCode, resultCode, isResultCode, normalizeCandidate, normalizeAccess, accessDuration, accessLine, skillLevel,
} from '../lib/miaar/registry';
import type { PoolItem, SecureItem, Level } from '../lib/miaar/registry';
import { validateCreate, shareText, inviteUrl } from '../lib/miaar/invites';
import { shapeRow, LEGACY_ORDER, isLegacyTable } from '../lib/miaar/legacy';
import { optionList } from '../lib/miaar/bank';

const pool = (): PoolItem[] => { const out: PoolItem[] = []; let n = 0; for (const level of LEVELS) for (const skill of SKILLS) for (let i = 0; i < 6; i += 1) { n += 1; out.push({ id: `i${n}`, code: `${level}-${skill}-${i}`, level, skill, type: 'mcq', passageId: null, questionText: `س${n}`, options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { id: 'c', text: '3' }], correctOptionId: 'a', stimulus: null, descriptor: null }); } return out; };
const secure = (): SecureItem[] => { const out: SecureItem[] = []; let n = 0; for (const level of LEVELS) for (const skill of SKILLS) for (let i = 0; i < FORM_PLAN[level][skill]; i += 1) { n += 1; out.push({ id: `q${n}`, level, skill, correctOptionId: 'a' }); } return out; };
/** إجابات: كل مستوى ≤ upto صحيح بنسبة pct، وما فوقه بلا إجابة */
const answersFor = (items: SecureItem[], upto: Level, pct: Record<string, number> = {}) => { const idx = LEVELS.indexOf(upto); const out: { question_id: string; selected_option_id: string }[] = []; for (const level of LEVELS.slice(0, idx + 1)) { const its = items.filter((i) => i.level === level); const p = pct[level] ?? 100; its.forEach((it, k) => out.push({ question_id: it.id, selected_option_id: k < Math.round(its.length * p / 100) ? 'a' : 'b' })); } return out; };

test('مِعيار: الخطة 50 بندًا على ستة مستويات وثلاث مهارات · البنود المسحوبة · أنواع م1 · الأسماء', () => {
  assert.equal(LEVELS.length, 6); assert.equal(SKILLS.length, 3); assert.equal(PASS_PERCENT, 60);
  assert.equal(LEVELS.reduce((n, l) => n + SKILLS.reduce((m, s) => m + FORM_PLAN[l][s], 0), 0), 50, 'الخطة = 50');
  assert.equal(WITHDRAWN_CODES.size, 5); assert.ok(WITHDRAWN_CODES.has('GV10'), 'GV10 مسحوب');
  assert.deepEqual([...M1_ITEM_TYPES], ['mcq', 'picture_choice', 'picture_label', 'true_false_notgiven']);
  assert.equal(MIAAR_NAMES_AR.product, 'مِعيار — من أَثَر'); assert.equal(MIAAR_NAMES_AR.cta, 'حدّد مستواك'); assert.equal(MIAAR_NAMES_AR.probe, 'مِسبار');
  for (const l of LEVELS) { assert.equal(CAN_DO[l].ar.length, 3, `${l}: ثلاث جمل أستطيع`); assert.equal(CAN_DO[l].en.length, 3); }
});

test('مِعيار: السحب حتمي بالبذرة، يحترم الخطة، ويقبل النقص بتسجيله، ويفشل فقط إن خلا مستوى', () => {
  const p = pool(); const a = drawCodes(p, 'seed-1'); const b = drawCodes(p, 'seed-1'); const c = drawCodes(p, 'seed-2');
  assert.ok(a && b && c, 'سحب ناجح'); assert.deepEqual(a!.codes, b!.codes, 'نفس البذرة → نفس النموذج'); assert.notDeepEqual(a!.codes, c!.codes, 'بذرة أخرى → نموذج آخر');
  assert.equal(a!.codes.length, 50); assert.deepEqual(a!.short, []);
  for (const level of LEVELS) for (const skill of SKILLS) assert.equal(a!.codes.filter((x) => x.startsWith(`${level}-${skill}-`)).length, FORM_PLAN[level][skill], `${level}/${skill}`);
  const thin = p.filter((i) => !(i.level === 'C2' && i.skill === 'listening' && i.code.endsWith('-0') === false)); // C2/استماع بند واحد فقط
  const d = drawCodes(thin, 'x'); assert.ok(d, 'نقص لا يوصد الباب'); assert.deepEqual(d!.short, ['C2/listening:1/4']); assert.equal(d!.codes.length, 47);
  const empty = p.filter((i) => i.level !== 'B1'); assert.equal(drawCodes(empty, 'x'), null, 'مستوى خالٍ → null');
  assert.equal(shufflePool([1, 2, 3, 4, 5], 's').length, 5);
});

test('مِسبار: خمسة بنود عامة بلا مفاتيح · الدرجة · النطاق · نقطة البداية لا تتجاوز B1 والشامل يبدأ من A1', () => {
  assert.equal(PROBE_ITEMS.length, 5); const pub = probePublic('seed'); assert.equal(pub.length, 5);
  for (const it of pub) { assert.ok(!('correct' in it), 'لا مفتاح في العام'); assert.ok(it.options.length >= 3); }
  const all = Object.fromEntries(PROBE_ITEMS.map((i) => [i.id, i.correct])); assert.equal(probeScore(all), 5); assert.equal(probeScore({}), 0); assert.equal(probeScore('junk'), 0);
  assert.equal(probeBand(0), 'A1'); assert.equal(probeBand(2), 'A2'); assert.equal(probeBand(3), 'B1'); assert.equal(probeBand(4), 'B2'); assert.equal(probeBand(5), 'C1');
  assert.equal(probeStartIndex(5, 'adaptive'), 2, 'أقصى بداية B1'); assert.equal(probeStartIndex(2, 'adaptive'), 1); assert.equal(probeStartIndex(5, 'comprehensive'), 0);
});

test('قرار التقدّم: صعود عند الاجتياز · نزول من نقطة بداية أعلى · فشل في A1 · اكتمال عند C2 · الشامل يمرّ دائمًا', () => {
  assert.equal(nextStep({ currentIndex: 0, startIndex: 0, direction: 'up', mode: 'adaptive' }, 70).decision, 'advance');
  assert.equal(nextStep({ currentIndex: 0, startIndex: 0, direction: 'up', mode: 'adaptive' }, 40).decision, 'fail');
  const d = nextStep({ currentIndex: 2, startIndex: 2, direction: 'up', mode: 'adaptive' }, 40); assert.equal(d.decision, 'descend'); assert.equal(d.nextIndex, 1); assert.equal(d.direction, 'down');
  assert.equal(nextStep({ currentIndex: 1, startIndex: 2, direction: 'down', mode: 'adaptive' }, 80).decision, 'complete', 'اجتاز الأدنى بعد النزول → اكتمال');
  assert.equal(nextStep({ currentIndex: 1, startIndex: 2, direction: 'down', mode: 'adaptive' }, 20).decision, 'descend');
  assert.equal(nextStep({ currentIndex: 0, startIndex: 2, direction: 'down', mode: 'adaptive' }, 20).decision, 'fail');
  assert.equal(nextStep({ currentIndex: 3, startIndex: 2, direction: 'up', mode: 'adaptive' }, 40).decision, 'fail', 'إخفاق بعد صعود → توقّف');
  assert.equal(nextStep({ currentIndex: 5, startIndex: 0, direction: 'up', mode: 'adaptive' }, 95).decision, 'complete');
  assert.equal(nextStep({ currentIndex: 1, startIndex: 0, direction: 'up', mode: 'comprehensive' }, 10).decision, 'advance');
});

test('إحصاء المستويات والتسكين: المتخطّى يُعدّ مجتازًا · أول غير مجتاز هو الالتحاق · ميزان الثقة بالهامش', () => {
  const items = secure();
  const a = answersFor(items, 'B1', { B1: 25 }); const sel = new Map(a.map((x) => [x.question_id, x.selected_option_id]));
  const st = levelStats(items, sel, 0); assert.equal(st[0].status, 'passed'); assert.equal(st[2].status, 'failed'); assert.equal(st[3].status, 'partial');
  const pl = placementLevels(st); assert.equal(pl.demonstrated, 'A2'); assert.equal(pl.entry, 'B1'); assert.equal(pl.completedAll, false);
  assert.equal(confidence(st, 'A2', 'B1', false, 0).grade, 'high', 'A2 100% و B1 ~22% → مؤكَّد');
  // بداية من B1 (مِسبار): A1/A2 متخطّاة
  const b = answersFor(items, 'B1').filter((x) => items.find((i) => i.id === x.question_id)!.level === 'B1'); const sel2 = new Map(b.map((x) => [x.question_id, x.selected_option_id]));
  const st2 = levelStats(items, sel2, 2); assert.equal(st2[0].status, 'skipped'); assert.equal(st2[1].status, 'skipped'); assert.ok(st2[0].passedThreshold);
  const pl2 = placementLevels(st2); assert.equal(pl2.demonstrated, 'B1'); assert.equal(pl2.entry, 'B2');
  // على الحدّ: 67% (6/9) في B1 → هامش 7
  const c = answersFor(items, 'B1', { B1: 67 }); const st3 = levelStats(items, new Map(c.map((x) => [x.question_id, x.selected_option_id])), 0);
  assert.equal(st3[2].status, 'passed'); assert.equal(confidence(st3, 'B1', 'B2', false, 0).grade, 'border');
  assert.equal(skillLevel(90, 10), 'C1'); assert.equal(skillLevel(50, 10), 'B1'); assert.equal(skillLevel(0, 0), '—');
});

test('التقرير: المفاتيح العربية القديمة محفوظة (ملخص_التسكين، احصائيات، مستويات_تفصيلية…) + إضافات م1 (ميزان الثقة، نقطة البداية، التيسيرات)', () => {
  const items = secure(); const a = answersFor(items, 'B2', { B2: 50 });
  const access = normalizeAccess({ time: 1.25, simple: true, contrast: 'no', large: true });
  assert.deepEqual(access, { time: 1.25, simple: true, contrast: false, large: true }); assert.equal(accessDuration(3000, access), 3750); assert.ok(accessLine(access)!.includes('×1.25'));
  const r = calculateReport({ candidate: { name: 'سارة', email: 'sara@example.com', studiedBefore: true, purpose: 'دراسة' }, examMode: 'adaptive', startIndex: 0, durationSeconds: 3000, remainingSeconds: 1200, source: 'athar-m1', title: 'سحب', access, inviteLabel: 'جامعة أَثَر — يناير', short: [] }, a, 'failed', items, new Map([['q1', 'نص السؤال']]));
  assert.equal(r.المستوى_العام, 'B1'); assert.equal(r.ملخص_التسكين.المستوى_المثبت, 'B1'); assert.equal(r.ملخص_التسكين.مستوى_الالتحاق_المقترح, 'B2'); assert.equal(r.ملخص_التسكين.طبيعة_النتيجة, 'توصية تسكين مبدئية');
  assert.equal(r.بيانات_المتقدم.الاسم, 'سارة'); assert.equal(r.بيانات_المتقدم.دراسة_سابقة_للعربية, 'نعم'); assert.equal(r.الوقت_المستغرق, '30:00');
  assert.equal(r.مستويات_تفصيلية.length, 6); assert.ok(r.احصائيات.reading.answered > 0); assert.equal(r.عدد_البنود_المقدمة, a.length);
  assert.equal(r.نمط_الاختبار, 'تكيفي'); assert.equal(r.نقطة_البداية, 'A1'); assert.equal(r.الدعوة, 'جامعة أَثَر — يناير'); assert.ok(r.تيسيرات); assert.equal(r.نقص_البنك, null);
  assert.ok(['high', 'medium', 'border'].includes(r.ميزان_الثقة.الرمز)); assert.equal(r.الجهة_المصدرة, 'مِعيار — من أَثَر'); assert.equal(r.بنود_الجلسة[0].النص, 'نص السؤال');
  assert.ok(r.التوصية.includes('مستوى الالتحاق المقترح: B2'));
  const cand = normalizeCandidate({ name: '  Ali   Hassan ', email: 'ALI@Example.com', phone: '0555', studiedBefore: 'x', purpose: 'عمل' }); assert.equal(cand!.name, 'Ali Hassan'); assert.equal(cand!.email, 'ali@example.com'); assert.equal(cand!.studiedBefore, null);
  assert.equal(normalizeCandidate({ name: 'A', email: 'bad' }), null);
});

test('الرموز: رمز قصير بلا حروف ملتبسة · رمز نتيجة ML-XXXX-XXXX · التحقق', () => {
  let k = 0; const rnd = () => ((k += 7) % 31) / 31;
  const s = shortCode(8, rnd); assert.equal(s.length, 8); assert.ok(isShortCode(s)); assert.ok(!/[01OIL]/.test(s), 'لا 0/1/O/I/L');
  const rc = resultCode(rnd); assert.ok(isResultCode(rc), rc); assert.ok(!isResultCode('ML-0000-0000')); assert.ok(!isShortCode('abc'));
});

test('الدعوات: تحقق الإنشاء (جماعية/شخصية) · قائمة البُرُد سطرًا سطرًا بلا تكرار · الرابط · نص المشاركة بلغة الدعوة', () => {
  const g = validateCreate({ kind: 'group', label_ar: 'جامعة أَثَر — دفعة يناير 2027', lang: 'tr', exam_mode: 'comprehensive', max_seats: 40, expires_at: '2027-01-31' });
  assert.ok(g.ok); if (g.ok) { assert.equal(g.row.kind, 'group'); assert.equal(g.row.lang, 'tr'); assert.equal(g.row.exam_mode, 'comprehensive'); assert.equal(g.row.max_seats, 40); assert.ok(g.row.expires_at!.startsWith('2027-01-31')); assert.deepEqual(g.recipients, []); }
  const bad = validateCreate({ kind: 'group', label_ar: 'أب' }); assert.ok(!bad.ok);
  const p = validateCreate({ kind: 'personal', label_ar: 'منحة الشركاء', lang: 'xx', recipients: 'سارة أحمد sara@example.com\nJohn Smith <john@example.com>\nsara@example.com\nلا بريد هنا' });
  assert.ok(p.ok); if (p.ok) { assert.equal(p.row.lang, 'en', 'لغة مجهولة → en'); assert.equal(p.recipients.length, 2); assert.equal(p.recipients[0].name, 'سارة أحمد'); assert.equal(p.recipients[1].email, 'john@example.com'); assert.equal(p.recipients[1].name, 'John Smith'); }
  assert.ok(!validateCreate({ kind: 'personal', label_ar: 'بلا بريد' }).ok);
  assert.equal(inviteUrl('https://athar-portal.vercel.app/', 'ABCD2345'), 'https://athar-portal.vercel.app/miaar/d/ABCD2345'); assert.ok(inviteUrl('https://x', 'C', 'a+b').endsWith('?t=a%2Bb'));
  assert.ok(shareText({ label_ar: 'دفعة', lang: 'ar', expires_at: '2027-01-31T00:00:00Z' }, 'https://x/miaar/d/Q').includes('آخر موعد: 2027-01-31'));
  assert.ok(shareText({ label_ar: 'Batch', lang: 'fr', expires_at: null }, 'https://x/miaar/d/Q').startsWith('Hello!'));
});

test('نقل البيت: ترتيب الجداول يحترم المفاتيح · تشكيل الصفوف القديمة (أعمدة معروفة + legacy_extra) · تطبيع الحالات · خيارات البنود', () => {
  assert.equal(LEGACY_ORDER[0], 'question_bank_import_batches'); assert.ok(LEGACY_ORDER.indexOf('question_bank_items') < LEGACY_ORDER.indexOf('question_bank_answer_keys')); assert.ok(LEGACY_ORDER.indexOf('placement_reports') < LEGACY_ORDER.indexOf('placement_decisions')); assert.equal(LEGACY_ORDER[LEGACY_ORDER.length - 1], 'audio');
  assert.ok(isLegacyTable('placement_reports')); assert.ok(!isLegacyTable('profiles'));
  const id = '11111111-1111-4111-8111-111111111111';
  const s = shapeRow('placement_secure_sessions', { id, token_hash: 'h', candidate: { email: 'a@b.co' }, status: 'active', weird_col: 1, content_version: 'v' })!;
  assert.equal(s.status, 'expired', 'الجلسات القديمة لا تُستأنف'); assert.deepEqual(s.legacy_extra, { weird_col: 1 }); assert.ok(!('weird_col' in s));
  const d = shapeRow('placement_decisions', { id, report_id: id, assigned_level: 'B1', decision_status: 'something' })!; assert.equal(d.decision_status, 'review');
  const it = shapeRow('question_bank_items', { id, item_code: 'A1-GV-1', level: 'A1', skill: 'grammar_vocab', question_text: 'س', options: [] })!; assert.equal(it.item_type, 'mcq'); assert.equal(it.source_kind, 'imported');
  assert.equal(shapeRow('question_bank_items', { id: 'not-a-uuid', item_code: 'x' }), null, 'معرّف غير صالح يُستبعد');
  const r = shapeRow('placement_reports', { id, report: { بيانات_المتقدم: { البريد_الإلكتروني: 'X@Y.co' } } })!; assert.equal(r.candidate_email, 'x@y.co');
  assert.deepEqual(optionList([{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { text: '3' }, { text: '4' }], 'mcq')!.map((o) => o.id), ['a', 'b', 'c', 'd'], 'المعرّفات الناقصة تُكمَّل');
  assert.equal(optionList([{ id: 'a', text: '1' }, { id: 'b', text: '2' }], 'mcq'), null, 'الاختيار من متعدد = أربعة خيارات');
  assert.equal(optionList([{ id: 'a', text: 'صواب' }, { id: 'b', text: 'خطأ' }, { id: 'c', text: 'غير مذكور' }], 'true_false_notgiven')!.length, 3); assert.equal(optionList([{ id: 'a', text: 'صواب' }, { id: 'b', text: 'خطأ' }], 'true_false_notgiven'), null, 'صواب/خطأ يحتاج ثلاثة');
  assert.equal(optionList([{ text: 'x' }, { image: 'p.png' }], 'picture_choice'), null, 'المصوّر يحتاج صورة لكل خيار'); assert.equal(optionList([{ image: 'a.png', alt: 'قطة' }, { image: 'b.png' }], 'picture_choice')!.length, 2);
});
