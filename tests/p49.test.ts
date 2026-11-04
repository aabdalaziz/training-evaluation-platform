// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P49 — «تقويم البرامج — الرابط الذي لا يُخطئ»: الرموز · الحالة الزمنية · التسمية · الشعب المسموحة · القالب الافتراضي · NPS 0–10 · بذرة استبيان نهاية البرنامج · صفّ الإجابة
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P49_NAMES_AR, LINK_KINDS, KIND_AR, KIND_PATH, kindFromPath, isLinkKind, LINK_ALPHABET, linkCode, normalizeCode, shortUrl,
  linkState, linkStateText, TITLE_PRESETS, titlePreset, linkTitle, classroomLabel, scopeText, allowedClassrooms, cleanLabel, validateLinkInput,
  pickTemplate, normalizeNps, npsSummary, NPS_BAND_AR, END_SURVEY_SEED, endSurveyStats, LIKERT_AR, LIKERT_EN, OVERALL_OPTIONS, answerRow, likertValue, likertLabel,
  type EvalLink,
} from '../lib/evaluation/links';

const L = (o: Partial<EvalLink> = {}): EvalLink => ({ id: 'l1', code: 'ABC234', kind: 'END', program_id: 'p1', classroom_id: null, level: null, label_ar: null, slot_ar: null, opens_at: null, closes_at: null, active: true, hits: 0, ...o });
const ROOMS = [{ id: 'c1', code: 'A-101', section_name: 'شعبة 1', level: 'مبتدئ' }, { id: 'c2', code: 'A-102', section_name: null, level: 'متوسط' }, { id: 'c3', code: 'A-103', section_name: 'شعبة 3', level: 'مبتدئ' }];
const NOW = new Date('2026-11-04T09:00:00Z');

test('P49 · الأسماء والأنواع والمسارات', () => {
  assert.equal(P49_NAMES_AR.links, 'الرابط الذي لا يُخطئ'); assert.equal(P49_NAMES_AR.generator, 'مولّد الروابط'); assert.equal(P49_NAMES_AR.sheet, 'ورقة الطباعة'); assert.equal(P49_NAMES_AR.end, 'استبيان نهاية البرنامج');
  assert.deepEqual([...LINK_KINDS], ['DAILY', 'FINAL', 'END']); assert.equal(KIND_AR.END, 'استبيان نهاية البرنامج'); assert.equal(KIND_PATH.END, 'end');
  assert.equal(kindFromPath('end'), 'END'); assert.equal(kindFromPath('final'), 'FINAL'); assert.equal(kindFromPath('x'), 'DAILY'); assert.equal(kindFromPath(null), 'DAILY');
  assert.ok(isLinkKind('end')); assert.ok(isLinkKind('DAILY')); assert.ok(!isLinkKind('REMOTE')); assert.ok(!isLinkKind(''));
});
test('P49 · الرمز: 6 أحرف من أبجدية بلا التباس (لا I O 0 1) · التطبيع · الرابط القصير', () => {
  assert.equal(LINK_ALPHABET.length, 32); assert.ok(!/[IO01]/.test(LINK_ALPHABET));
  const c = linkCode(() => 0.999); assert.equal(c.length, 6); assert.match(c, /^[A-Z2-9]{6}$/);
  assert.equal(linkCode(() => 0), 'AAAAAA'); assert.equal(linkCode(() => 0, 8).length, 8);
  assert.equal(normalizeCode(' ab-c2 34 '), 'ABC234'); assert.equal(normalizeCode('abc10'), 'ABC'); assert.equal(normalizeCode(null), ''); assert.equal(normalizeCode('A'.repeat(20)).length, 12);
  assert.equal(shortUrl('https://athar-portal.vercel.app/', 'ABC234'), 'https://athar-portal.vercel.app/e/ABC234'); assert.equal(shortUrl('', 'X'), '/e/X');
});
test('P49 · الحالة الزمنية: مفتوح/لم يُفتح/أُغلق/موقوف + النصّ للمتدرّب', () => {
  assert.equal(linkState(L(), NOW), 'open'); assert.equal(linkState(L({ active: false }), NOW), 'off'); assert.equal(linkState(null, NOW), 'off');
  assert.equal(linkState(L({ opens_at: '2026-11-05T00:00:00Z' }), NOW), 'before'); assert.equal(linkState(L({ closes_at: '2026-11-03T00:00:00Z' }), NOW), 'after');
  assert.equal(linkState(L({ opens_at: '2026-11-01T00:00:00Z', closes_at: '2026-11-30T00:00:00Z' }), NOW), 'open');
  assert.equal(linkStateText('open', L()), ''); assert.match(linkStateText('off', L()), /انتهى هذا الرابط/); assert.match(linkStateText('before', L({ opens_at: '2026-11-05T00:00:00Z' })), /يُفتح من/); assert.match(linkStateText('after', L({ closes_at: '2026-11-03T00:00:00Z' })), /أُغلق/);
  assert.match(linkStateText('off', L(), 'en'), /expired/);
});
test('P49 · التسمية: قوالب المجموعة/البرنامج/الفترة · التسمية اليدوية تغلب · تنظيف النصّ', () => {
  assert.deepEqual([...TITLE_PRESETS], ['group', 'program', 'period']);
  assert.equal(titlePreset('program', { program_ar: 'إدارة المشاريع' }), 'إدارة المشاريع');
  assert.equal(titlePreset('group', { program_ar: 'إدارة المشاريع', classroom: ROOMS[0] }), 'شعبة 1 — مبتدئ — إدارة المشاريع');
  assert.equal(titlePreset('group', { program_ar: 'إدارة المشاريع', level: 'متقدم' }), 'متقدم — إدارة المشاريع');
  assert.equal(titlePreset('group', { program_ar: 'إدارة المشاريع' }), 'إدارة المشاريع');
  assert.equal(titlePreset('period', { program_ar: 'إدارة المشاريع', slot_ar: 'الأسبوع الثالث' }), 'إدارة المشاريع — الأسبوع الثالث');
  assert.match(titlePreset('period', { program_ar: 'ب', opens_at: '2026-11-01T06:00:00Z', closes_at: '2026-11-30T06:00:00Z' }), /ب — .+ → .+/);
  assert.equal(linkTitle(L({ label_ar: ' مجموعة  الصباح ' }), 'ب', ROOMS[0]), ' مجموعة  الصباح '.trim() === 'مجموعة  الصباح' ? 'مجموعة  الصباح' : linkTitle(L({ label_ar: 'مجموعة  الصباح' }), 'ب', ROOMS[0]));
  assert.equal(linkTitle(L(), 'ب', ROOMS[1]), 'A-102 — متوسط — ب'); assert.equal(classroomLabel(ROOMS[1]), 'A-102 — متوسط'); assert.equal(classroomLabel(null), '');
  assert.equal(cleanLabel('  a   b  '), 'a b'); assert.equal(cleanLabel('x'.repeat(200)).length, 120); assert.equal(cleanLabel(null), '');
});
test('P49 · النطاق والشعب المسموحة: شعبة واحدة · مستوى · كل الشعب', () => {
  assert.deepEqual(allowedClassrooms(L({ classroom_id: 'c2' }), ROOMS).map(r => r.id), ['c2']);
  assert.deepEqual(allowedClassrooms(L({ level: 'مبتدئ' }), ROOMS).map(r => r.id), ['c1', 'c3']);
  assert.equal(allowedClassrooms(L(), ROOMS).length, 3);
  assert.equal(scopeText(L({ classroom_id: 'c1' }), ROOMS[0]), 'شعبة واحدة: شعبة 1 — مبتدئ'); assert.equal(scopeText(L({ level: 'متوسط' })), 'مستوى: متوسط (كل شعبه)'); assert.equal(scopeText(L()), 'كل الشعب'); assert.equal(scopeText(L(), null, 'en'), 'All sections');
});
test('P49 · التحقّق من طلب الإنشاء: النوع · البرنامج · النافذة الزمنية · المستوى يُهمل مع شعبة', () => {
  assert.deepEqual(validateLinkInput({ kind: 'x', program_id: 'p1' }), { ok: false, error: 'نوع الاستبيان غير معروف' });
  assert.deepEqual(validateLinkInput({ kind: 'end' }), { ok: false, error: 'اختر البرنامج' });
  assert.equal((validateLinkInput({ kind: 'end', program_id: 'p1', opens_at: 'زمن' }) as any).error, 'تاريخ الفتح غير صالح');
  assert.equal((validateLinkInput({ kind: 'end', program_id: 'p1', opens_at: '2026-11-10', closes_at: '2026-11-09' }) as any).error, 'الإغلاق يجب أن يكون بعد الفتح');
  const v = validateLinkInput({ kind: 'daily', program_id: 'p1', classroom_id: 'c1', level: 'مبتدئ', label_ar: '  أ  ب ', slot_ar: 'صباحًا', opens_at: '2026-11-01T06:00' });
  assert.ok(v.ok); if (v.ok) { assert.equal(v.value.kind, 'DAILY'); assert.equal(v.value.classroom_id, 'c1'); assert.equal(v.value.level, null); assert.equal(v.value.label_ar, 'أ ب'); assert.equal(v.value.slot_ar, 'صباحًا'); assert.ok(v.value.opens_at?.endsWith('Z')); assert.equal(v.value.closes_at, null); }
  const v2 = validateLinkInput({ kind: 'END', program_id: 'p1', level: ' متقدم ' }); assert.ok(v2.ok && v2.value.level === 'متقدم' && v2.value.label_ar === null);
});
test('P49 · القالب: قالب البرنامج أوّلًا، ثم الافتراضي العام، ثم أيّ قالب من النوع', () => {
  const T = [{ id: 't-end-any', kind: 'END' }, { id: 't-end-def', kind: 'END', is_default: true }, { id: 't-end-own', kind: 'END' }, { id: 't-final', kind: 'FINAL' }];
  const LK = [{ program_id: 'p1', template_id: 't-end-own', is_active: true }, { program_id: 'p2', template_id: 't-end-own', is_active: false }];
  assert.deepEqual(pickTemplate('END', 'p1', LK, T), { id: 't-end-own', via: 'program' });
  assert.deepEqual(pickTemplate('END', 'p2', LK, T), { id: 't-end-def', via: 'default' });
  assert.deepEqual(pickTemplate('END', 'p3', [], T.filter(t => !t.is_default)), { id: 't-end-any', via: 'any' });
  assert.equal(pickTemplate('DAILY', 'p1', LK, T), null);
});
test('P49 · NPS 0–10: المروّجون 9–10 · المحايدون 7–8 · المنتقدون 0–6 · الدرجة −100…100', () => {
  assert.equal(normalizeNps(10), 10); assert.equal(normalizeNps('0'), 0); assert.equal(normalizeNps(11), null); assert.equal(normalizeNps(-1), null); assert.equal(normalizeNps('x'), null); assert.equal(normalizeNps(null), null); assert.equal(normalizeNps(''), null); assert.equal(normalizeNps(7.6), 8);
  const s = npsSummary([10, 9, 8, 7, 6, 0, 'x', null, 11]);
  assert.deepEqual([s.n, s.promoters, s.passives, s.detractors], [6, 2, 2, 2]); assert.equal(s.score, 0); assert.equal(s.mean, 6.7);
  assert.equal(npsSummary([10, 10, 9]).score, 100); assert.equal(npsSummary([0, 1]).score, -100); assert.equal(npsSummary([]).score, null);
  assert.equal(NPS_BAND_AR(50), 'ممتاز'); assert.equal(NPS_BAND_AR(0), 'جيد'); assert.equal(NPS_BAND_AR(-1), 'يحتاج انتباهًا'); assert.equal(NPS_BAND_AR(null), '—');
});
test('P49 · بذرة استبيان نهاية البرنامج: 17 سؤالًا = 12 ليكرت + 3 آراء + تقدير عام + ترشيح؛ مفاتيح فريدة؛ قسمان لليكرت', () => {
  const st = endSurveyStats(); assert.equal(st.total, 17); assert.equal(st.likert, 12); assert.equal(st.text, 3);
  assert.equal(END_SURVEY_SEED.filter(q => q.kind === 'SINGLE_CHOICE').length, 1); assert.equal(END_SURVEY_SEED.filter(q => q.kind === 'NPS_10').length, 1);
  assert.equal(new Set(END_SURVEY_SEED.map(q => q.key)).size, 17);
  const sections = Array.from(new Set(END_SURVEY_SEED.filter(q => q.kind === 'LIKERT_5').map(q => q.section_ar))); assert.deepEqual(sections, ['الدورة ومحتواها', 'المدرّب']);
  assert.equal(END_SURVEY_SEED.filter(q => q.kind === 'LIKERT_5' && q.section_ar === 'الدورة ومحتواها').length, 6); assert.equal(END_SURVEY_SEED.filter(q => q.kind === 'LIKERT_5' && q.section_ar === 'المدرّب').length, 6);
  assert.deepEqual(END_SURVEY_SEED.find(q => q.kind === 'SINGLE_CHOICE')?.options, OVERALL_OPTIONS); assert.equal(OVERALL_OPTIONS.length, 5);
  assert.ok(END_SURVEY_SEED.filter(q => q.kind === 'LONG_TEXT').every(q => !q.required), 'الآراء اختيارية'); assert.ok(END_SURVEY_SEED.filter(q => q.kind === 'LIKERT_5').every(q => q.required));
  assert.equal(LIKERT_AR.length, 5); assert.equal(LIKERT_AR[0], 'موافق بقوة'); assert.equal(LIKERT_EN[4], 'Strongly disagree');
});
test('P49 · صفّ الإجابة: NPS نصًّا (لا يُفسد متوسّط 1–5) · ليكرت رقمًا · الاختيار · المتعدّد · النصّ', () => {
  assert.deepEqual(answerRow('NPS_10', '9'), { rating_value: null, selected_option: null, selected_options: [], text_value: '9' });
  assert.deepEqual(answerRow('NPS_10', '0'), { rating_value: null, selected_option: null, selected_options: [], text_value: '0' });
  assert.equal(answerRow('NPS_10', '12').text_value, null);
  assert.equal(answerRow('LIKERT_5', '5').rating_value, 5); assert.equal(answerRow('STARS', '').rating_value, null);
  assert.equal(answerRow('SINGLE_CHOICE', 'ممتاز').selected_option, 'ممتاز'); assert.deepEqual(answerRow('MULTI_CHOICE', ['a', 'b']).selected_options, ['a', 'b']); assert.equal(answerRow('LONG_TEXT', ' رأي ').text_value, ' رأي ');
  assert.equal(likertValue(0), 5); assert.equal(likertValue(4), 1); assert.equal(likertLabel(5), 'موافق بقوة'); assert.equal(likertLabel(1, 'en'), 'Strongly disagree'); assert.equal(likertLabel(9), '9');
});
