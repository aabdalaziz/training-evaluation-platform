// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P66-ب «هيكل الدبلوم» — النواة: التسلسل الرسمي · التحقّق بلا افتراضات زمنية · المحاضرات والفترات الخاصّة · التعارضات · «الميسِّر يقترح» · «البديل بلمسة» · «قبل أن تغادر» (k ≥ 5) · «محطّة المستوى» · وضع الوردية · المخزن مع قاعدة وهمية · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { D_NAMES_AR, D_LIMITS, DIPLOMA_PATH, WEEKDAYS_AR, structureLine, sectionLabel, validateSlot, validatePeriod, lectureOn, slotDays, lecturesOf, conflictsOf, weekGrid, suggestGrid, substitutesFor, courseThread, corridorCard, levelSpans, currentLevel, isLevelLastWeek, todayAnswerAr, timeAr, shiftGraceDay, effectiveTrainer, levelCloseNotice } from '../lib/diploma/registry';
import type { Course, Slot, Period, Section } from '../lib/diploma/registry';
import { structureView, saveCourse, saveSlot, deleteSlot, savePeriod, suggest, adopt, substitutes, applySubstitute, corridor, myLecturesToday, lectureDaysOf, lectureCardsFor, requestMove, decideMove, runLevelClose, myPrograms } from '../lib/diploma/store';
import { parseCommand } from '../lib/portal/voice';
import { crumbsFor } from '../lib/portal/way';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* ───────── بيانات الدبلوم الافتراضي: «دبلوم الإشراف التربوي» — مستويان · 3 مقرّرات · شعبتان · 3 أساتذة ───────── */
const P = U(1); const C1 = U(11); const C2 = U(12); const C3 = U(13); const S1 = U(21); const S2 = U(22); const T1 = U(31); const T2 = U(32); const T3 = U(33);
const courses: Course[] = [
  { id: C1, idx: 1, title_ar: 'القيادة التربوية', code: 'EDU101', level_no: 1, trainer_id: T1, hours: 30 },
  { id: C2, idx: 2, title_ar: 'الإشراف الصفّي', code: 'EDU102', level_no: 1, trainer_id: T2, hours: 30 },
  { id: C3, idx: 3, title_ar: 'بحوث الفعل', code: 'EDU201', level_no: 2, trainer_id: T3, hours: 30 },
];
const sections: Section[] = [{ id: S1, code: 'A-1', section_name: null, trainer_id: T1 }, { id: S2, code: 'A-2', section_name: null, trainer_id: null }];
const instructors = [{ id: T1, name: 'د. سالم', email: 'salem@x.sa' }, { id: T2, name: 'د. هند', email: 'hind@x.sa' }, { id: T3, name: 'د. فهد', email: 'fahd@x.sa' }];
const slot = (id: string, unit_id: string, classroom_id: string, weekday: number, period_no: number, starts_at: string, minutes: number, extra: Partial<Slot> = {}): Slot => ({ id, program_id: P, unit_id, classroom_id, trainer_id: null, weekday, period_no, starts_at, minutes, from_day: '2026-11-15', to_day: '2026-12-31', room_ar: null, provider: 'athar', ...extra });
const names = { course: (id: string) => courses.find((c) => c.id === id)?.title_ar || 'مقرّر', section: (id: string) => sectionLabel(sections.find((s) => s.id === id)) || 'شعبة', instructor: (id: string | null) => instructors.find((t) => t.id === id)?.name || 'أستاذ المادة' };

test('P66-ب · الأسماء والحدود · التسلسل الرسمي «الدبلوم : المستوى — المقرّر — الشعبة — أستاذ المادة» · الشعبة بالرقم', () => {
  assert.equal(D_NAMES_AR.page, 'هيكل الدبلوم'); assert.equal(D_NAMES_AR.instructor, 'أستاذ المادة'); assert.equal(D_NAMES_AR.leave, 'قبل أن تغادر'); assert.equal(D_NAMES_AR.corridor, 'الممرّ'); assert.equal(D_NAMES_AR.suggest, 'الميسِّر يقترح الجدول'); assert.equal(D_NAMES_AR.substitute, 'البديل بلمسة'); assert.equal(D_NAMES_AR.level_close, 'محطّة المستوى');
  assert.equal(DIPLOMA_PATH, '/me/diploma'); assert.equal(D_LIMITS.maxLevels, 8); assert.equal(D_LIMITS.maxPeriods, 8); assert.equal(D_LIMITS.minMinutes, 20); assert.equal(D_LIMITS.maxMinutes, 300); assert.equal(D_LIMITS.k, 5); assert.equal(WEEKDAYS_AR[0], 'الأحد');
  assert.equal(structureLine({ diploma: 'دبلوم الإشراف التربوي', level: 1, course: 'القيادة التربوية', section: 'شعبة 2', instructor: 'د. سالم' }), 'دبلوم الإشراف التربوي : المستوى 1 — القيادة التربوية — شعبة 2 — د. سالم');
  assert.equal(structureLine({ diploma: 'د', section: 'شعبة 1' }), 'د : شعبة 1'); assert.equal(structureLine({ diploma: 'د' }), 'د'); assert.equal(structureLine({ course: 'م' }), 'م');
  assert.equal(sectionLabel({ code: 'A-2' }), 'شعبة 2'); assert.equal(sectionLabel({ code: 'ABC', section_name: 'المسائية' }), 'شعبة المسائية'); assert.equal(sectionLabel(null), '');
  assert.equal(timeAr('16:00'), '4 عصرًا'); assert.equal(timeAr('08:30'), '8:30 صباحًا'); assert.equal(timeAr('19:10'), '7:10 مساءً');
});

test('P66-ب · التحقّق: لا وقت ولا مدّة افتراضيين — المشرف يكتبهما (50 أو 110 دقيقة سواء) · رقم المحاضرة 1–8 · المدى ≤ 400 يومًا · الفترة الخاصّة', () => {
  const base = { unit_id: C1, classroom_id: S1, weekday: 0, period_no: 1, from_day: '2026-11-15', to_day: '2026-12-31' };
  assert.equal(validateSlot(base).ok, false, 'بلا وقت → رفض (لا افتراض)'); assert.match((validateSlot(base) as any).error, /وقت بدء/);
  assert.equal(validateSlot({ ...base, starts_at: '16:00' }).ok, false, 'بلا مدّة → رفض'); assert.match((validateSlot({ ...base, starts_at: '16:00' }) as any).error, /مدّة/);
  const v50 = validateSlot({ ...base, starts_at: '8:00', minutes: 50 }); assert.ok(v50.ok && v50.slot.starts_at === '08:00' && v50.slot.minutes === 50 && v50.slot.provider === 'athar' && v50.slot.trainer_id === null);
  const v110 = validateSlot({ ...base, starts_at: '16:00', minutes: 110, trainer_id: T2, room_ar: '  قاعة 3  ', provider: 'teams' }); assert.ok(v110.ok && v110.slot.minutes === 110 && v110.slot.trainer_id === T2 && v110.slot.room_ar === 'قاعة 3' && v110.slot.provider === 'teams');
  assert.equal(validateSlot({ ...base, starts_at: '16:00', minutes: 10 }).ok, false); assert.equal(validateSlot({ ...base, starts_at: '16:00', minutes: 301 }).ok, false); assert.equal(validateSlot({ ...base, starts_at: '25:00', minutes: 50 }).ok, false);
  assert.equal(validateSlot({ ...base, starts_at: '16:00', minutes: 50, period_no: 9 }).ok, false); assert.equal(validateSlot({ ...base, starts_at: '16:00', minutes: 50, weekday: 7 }).ok, false);
  assert.equal(validateSlot({ ...base, starts_at: '16:00', minutes: 50, to_day: '2026-11-01' }).ok, false, 'النهاية قبل البداية'); assert.equal(validateSlot({ ...base, starts_at: '16:00', minutes: 50, to_day: '2028-01-01' }).ok, false, '> 400 يومًا');
  assert.equal(validatePeriod({ name_ar: 'ر', from_day: '2027-02-08', to_day: '2027-03-09' }).ok, false, 'اسم قصير');
  const r = validatePeriod({ name_ar: 'شهر رمضان 1448', from_day: '2027-02-08', to_day: '2027-03-09', lecture_minutes: '40', first_lecture_at: '21:30', lecture_break_min: '10', shift_minutes: '' });
  assert.ok(r.ok && r.period.lecture_minutes === 40 && r.period.first_lecture_at === '21:30' && r.period.lecture_break_min === 10 && r.period.shift_minutes === 0);
  const e = validatePeriod({ name_ar: 'الاختبارات', from_day: '2027-01-10', to_day: '2027-01-14' }); assert.ok(e.ok && e.period.lecture_minutes === null && e.period.first_lecture_at === null, 'فترة بلا تغيير مدّة — تُستخدم للإزاحة أو كعلامة');
  assert.equal(validatePeriod({ name_ar: 'خطأ', from_day: '2027-01-10', to_day: '2027-01-14', lecture_minutes: 5 }).ok, false); assert.equal(validatePeriod({ name_ar: 'خطأ', from_day: '2027-01-10', to_day: '2027-01-14', shift_minutes: 800 }).ok, false);
});

test('P66-ب · المحاضرات من السطر: تواريخ اليوم الأسبوعي ضمن المدى · ISO +03:00 · الفترة الخاصّة تغيّر المدّة/البداية/الإزاحة داخل مداها فقط', () => {
  const s = slot(U(41), C1, S1, 0, 2, '16:00', 110, { from_day: '2026-11-15', to_day: '2026-12-13' }); /* 15/11/2026 أحد */
  assert.deepEqual(slotDays(s), ['2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13']); assert.deepEqual(slotDays(s, '2026-12-01'), ['2026-12-06', '2026-12-13']);
  const s2 = slot(U(42), C1, S1, 2, 1, '08:00', 50, { from_day: '2026-11-15', to_day: '2026-11-30' }); assert.deepEqual(slotDays(s2), ['2026-11-17', '2026-11-24'], 'الثلاثاء الأول بعد البداية');
  const l = lectureOn(s, '2026-11-22', []); assert.deepEqual(l, { day: '2026-11-22', weekday: 0, starts: '16:00', ends: '17:50', minutes: 110, starts_at_iso: '2026-11-22T16:00:00+03:00', period_name: null });
  const ramadan: Period = { id: U(51), program_id: P, name_ar: 'رمضان', from_day: '2026-11-29', to_day: '2026-12-10', lecture_minutes: 40, lecture_break_min: 10, first_lecture_at: '21:30', shift_minutes: 0 };
  const lr = lectureOn(s, '2026-11-29', [ramadan]); assert.equal(lr.starts, '22:20', 'المحاضرة الثانية = 21:30 + (40+10)'); assert.equal(lr.minutes, 40); assert.equal(lr.ends, '23:00'); assert.equal(lr.period_name, 'رمضان');
  assert.equal(lectureOn(s, '2026-12-13', [ramadan]).starts, '16:00', 'بعد الفترة يعود الأصل');
  const shift: Period = { ...ramadan, id: U(52), from_day: '2026-12-06', to_day: '2026-12-06', lecture_minutes: null, lecture_break_min: null, first_lecture_at: null, shift_minutes: -60 };
  assert.equal(lectureOn(s, '2026-12-06', [shift]).starts, '15:00', 'إزاحة فقط — المدّة كما هي'); assert.equal(lectureOn(s, '2026-12-06', [shift]).minutes, 110);
  assert.equal(lecturesOf(s, [ramadan]).length, 5); assert.equal(lecturesOf(s, [ramadan], '2026-12-07').length, 1);
});

test('P66-ب · التعارضات (أستاذ في محاضرتين · شعبة لها محاضرتان) تحترم المدى والوقت · شبكة الأسبوع · أستاذ السطر يغلب أستاذ المقرّر', () => {
  const a = slot(U(61), C1, S1, 0, 1, '16:00', 110); const b = slot(U(62), C1, S2, 0, 1, '17:00', 50); /* T1 في شعبتين متداخلتين */
  const c = slot(U(63), C2, S1, 0, 1, '16:30', 50); /* الشعبة 1 لها محاضرتان */ const d = slot(U(64), C2, S2, 1, 1, '16:00', 50); const e = slot(U(65), C3, S2, 0, 1, '16:00', 50, { from_day: '2027-01-10', to_day: '2027-02-10' }); /* مدى آخر → لا تعارض */
  const cf = conflictsOf([a, b, c, d, e], courses, names);
  assert.deepEqual(cf.map((x) => [x.kind, x.a, x.b]), [['instructor', U(61), U(62)], ['section', U(61), U(63)]]);
  assert.match(cf[0].text_ar, /د\. سالم في محاضرتين معًا الأحد 16:00/); assert.match(cf[1].text_ar, /شعبة 1 لها محاضرتان معًا/);
  assert.equal(conflictsOf([a, { ...b, trainer_id: T3 }], courses, names).length, 0, 'أستاذ السطر (بديل دائم) يفكّ التعارض'); assert.equal(effectiveTrainer({ ...b, trainer_id: T3 }, courses), T3);
  const g = weekGrid([a, b, c, d]); assert.deepEqual(g.days, [0, 1]); assert.deepEqual(g.periods, [1]); assert.deepEqual(g.cells['0:1'], [U(61), U(62), U(63)]); assert.deepEqual(weekGrid([]).days, [0, 1, 2, 3, 4]);
});

test('P66-ب · «الميسِّر يقترح الجدول»: خوارزمية قيود بلا ذكاء اصطناعي — لا أستاذ في خانتين · لا شعبة في خانتين · المقرّر مرّة في اليوم · يحترم الموجود · يبلّغ ما تعذّر', () => {
  const times = [{ period_no: 1, starts_at: '16:00', minutes: 110 }, { period_no: 2, starts_at: '18:00', minutes: 110 }];
  const r = suggestGrid({ courses, sections, weekdays: [0, 1], times, from_day: '2026-11-15', to_day: '2026-12-31', existing: [], level_no: 1 });
  assert.equal(r.proposed.length, 4, 'مقرّران × شعبتان'); assert.equal(r.unplaced.length, 0); assert.match(r.note_ar, /بلا تعارض/);
  const asSlots = r.proposed.map((p, i) => ({ ...p, id: `p${i}`, program_id: P })) as Slot[]; assert.equal(conflictsOf(asSlots, courses, names).length, 0, 'الاقتراح نفسه بلا تعارض');
  assert.ok(r.proposed.every((p) => p.trainer_id === null && p.minutes === 110 && p.from_day === '2026-11-15'), 'الأستاذ من المقرّر · المدّة كما كتبها المشرف');
  const tight = suggestGrid({ courses, sections, weekdays: [0], times: [times[0]], from_day: '2026-11-15', to_day: '2026-12-31', existing: [], level_no: 1 });
  assert.equal(tight.proposed.length, 2, 'خانة واحدة: أستاذان مختلفان في شعبتين مختلفتين'); assert.equal(tight.unplaced.length, 2); assert.match(tight.note_ar, /تعذّر توزيع 2/);
  const busy = slot(U(71), C3, S1, 0, 1, '16:00', 50); /* T3 مشغول الأحد 1 — والشعبة 1 كذلك */
  const withExisting = suggestGrid({ courses, sections, weekdays: [0, 1], times, from_day: '2026-11-15', to_day: '2026-12-31', existing: [busy], level_no: 1 });
  assert.ok(!withExisting.proposed.some((p) => p.classroom_id === S1 && p.weekday === 0 && p.period_no === 1), 'الخانة المشغولة للشعبة 1 لا تُقترح');
  const two = suggestGrid({ courses, sections, weekdays: [0, 1, 2], times, from_day: '2026-11-15', to_day: '2026-12-31', existing: [], level_no: 1, per_week: 2 }); assert.equal(two.proposed.length, 8); assert.ok(!two.proposed.some((p, i) => two.proposed.some((q, j) => j !== i && q.unit_id === p.unit_id && q.classroom_id === p.classroom_id && q.weekday === p.weekday)), 'لا محاضرتان للمقرّر نفسه في اليوم نفسه');
});

test('P66-ب · «البديل بلمسة»: المتفرّغون في وقت المحاضرة مرتّبين (المقرّر نفسه → المستوى نفسه → متفرّغ) · «محطّة المستوى» · «ماذا عندي اليوم؟»', () => {
  const a = slot(U(81), C1, S1, 0, 1, '16:00', 110); const b = slot(U(82), C1, S2, 1, 1, '16:00', 110, { trainer_id: T3 }); const c = slot(U(83), C2, S2, 0, 1, '16:30', 50);
  const subs = substitutesFor(a, '2026-11-22', [a, b, c], courses, instructors); /* الأحد: T2 مشغول (c) · T3 يدرّس المقرّر نفسه لشعبة أخرى */
  assert.deepEqual(subs.map((s) => [s.id, s.why_ar]), [[T3, 'يدرّس المقرّر نفسه لشعبة أخرى وله فراغ']]);
  const subs2 = substitutesFor(c, '2026-11-22', [b, c], courses, instructors); assert.deepEqual(subs2.map((s) => s.id), [T1, T3]); assert.equal(subs2[0].why_ar, 'من أساتذة المستوى نفسه وله فراغ');
  const spans = levelSpans(courses, [a, b, slot(U(84), C3, S1, 0, 1, '16:00', 50, { from_day: '2027-01-10', to_day: '2027-02-28' })]);
  assert.deepEqual(spans, [{ level_no: 1, from_day: '2026-11-15', to_day: '2026-12-31', courses: 2 }, { level_no: 2, from_day: '2027-01-10', to_day: '2027-02-28', courses: 1 }]);
  assert.equal(currentLevel(spans, '2026-12-01')?.level_no, 1); assert.equal(currentLevel(spans, '2027-01-05'), null, 'بين المستويين: فترة تطبيق'); assert.equal(isLevelLastWeek(spans[0], '2026-12-25'), true); assert.equal(isLevelLastWeek(spans[0], '2026-12-24'), false); assert.equal(isLevelLastWeek(spans[0], '2027-01-01'), false);
  const n = levelCloseNotice('دبلوم الإشراف التربوي', 1); assert.match(n.title_ar, /محطّة المستوى — المستوى 1/); assert.match(n.body_ar, /ماذا تغيّر في عملك/);
  assert.equal(todayAnswerAr([]), 'لا محاضرات لك اليوم.');
  assert.equal(todayAnswerAr([{ course: 'القيادة التربوية', section: 'شعبة 2', starts: '16:00', instructor: 'د. سالم' }]), 'محاضرة واحدة: القيادة التربوية — شعبة 2 — 4 عصرًا مع د. سالم.');
  assert.match(todayAnswerAr([{ course: 'أ', section: 'شعبة 1', starts: '08:00', instructor: null }, { course: 'ب', section: 'شعبة 1', starts: '10:00', instructor: null }]), /^محاضرتان: أ — شعبة 1 — 8 صباحًا · ب — شعبة 1 — 10 صباحًا\.$/);
});

test('P66-ب · «قبل أن تغادر» → «خيط المقرّر» و«الممرّ»: الأشخاص ≥ 5 وإلا عدد فقط · بلا أسماء · وضع الوردية (06:00 أو quiet_to العابر لمنتصف الليل)', () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ user_id: `u${i}`, body_ar: `سأجرّب الأسلوب ${i} مع صفّي غدًا`, blocker_ar: i === 0 ? 'ضيق الوقت' : null, day: '2026-11-15' }));
  const four = courseThread(lines(4), 'seed'); assert.equal(four.shown, false); assert.equal(four.people, 4); assert.equal(four.applied.length, 0);
  const six = courseThread(lines(6), 'seed'); assert.equal(six.shown, true); assert.equal(six.people, 6); assert.ok(six.applied.length >= 1 && six.applied.length <= D_LIMITS.show); assert.match(six.head_ar, /^قال 6 قبل أن يغادروا — 6 سطرًا\.$/); assert.equal(six.intro_ar, 'ما قلتم قبل أن تغادروا المحاضرة الماضية');
  assert.ok(!JSON.stringify(six).includes('u0'), 'لا معرّفات ولا أسماء في الخيط');
  const card = corridorCard({ diploma: 'دبلوم', level: 1, course: 'القيادة', section: 'شعبة 2', instructor: 'د. سالم', starts: '18:00', room_ar: 'قاعة 3', thread: six, commits_open: 2 });
  assert.equal(card.title_ar, 'دبلوم : المستوى 1 — القيادة — شعبة 2 — د. سالم'); assert.match(card.line_ar, /^قبل أن يغادروا قالوا 6: /); assert.ok(card.thread.length <= 3); assert.equal(card.commits_open, 2); assert.equal(card.next.room_ar, 'قاعة 3');
  assert.match(corridorCard({ diploma: 'د', level: null, course: 'م', section: 'شعبة 1', instructor: 'أ', starts: '08:00', room_ar: null, thread: four, commits_open: 0 }).line_ar, /كتب 4 قبل أن يغادروا؛ تظهر السطور حين يبلغون خمسة/);
  /* وضع الوردية — الساعة بتوقيت الرياض (UTC+3) */
  const at = (h: string) => new Date(`2026-11-16T${h}:00+03:00`);
  assert.equal(shiftGraceDay(at('02:30'), null, '2026-11-16', '2026-11-15'), '2026-11-15', 'قبل السادسة → سطر الأمس مفتوح');
  assert.equal(shiftGraceDay(at('06:00'), null, '2026-11-16', '2026-11-15'), null); assert.equal(shiftGraceDay(at('13:00'), null, '2026-11-16', '2026-11-15'), null);
  assert.equal(shiftGraceDay(at('07:30'), { quiet_from: '23:00', quiet_to: '08:00' }, '2026-11-16', '2026-11-15'), '2026-11-15', 'نافذة هدوء تعبر منتصف الليل تمدّ المهلة إلى 08:00');
  assert.equal(shiftGraceDay(at('07:30'), { quiet_from: '13:00', quiet_to: '15:00' }, '2026-11-16', '2026-11-15'), null, 'نافذة نهارية لا تمدّ'); assert.equal(shiftGraceDay(at('07:30'), { quiet_from: '22:00', quiet_to: '16:00' }, '2026-11-16', '2026-11-15'), null, 'لا تمتدّ بعد الظهر');
});

/* ───────── قاعدة وهمية عامّة: جداول في الذاكرة · select/insert/update/delete/upsert · مرشّحات eq/in/is/not/gte/gt/lt/lte/neq ───────── */
function fakeDb(tables: Record<string, any[]>) {
  let seq = 1000; const notices: any[] = (tables.portal_learner_notices = tables.portal_learner_notices || []);
  const from = (t: string) => {
    const rows = (tables[t] = tables[t] || []); const q: any = { _f: [] as Array<(r: any) => boolean>, _op: 'select', _ret: false, _payload: null as any, _single: null as 'maybe' | 'one' | null, _opts: null as any };
    const flt = (fn: (r: any) => boolean) => { q._f.push(fn); return q; }; const S = (v: any) => (v === null || v === undefined ? v : String(v));
    q.select = () => { if (q._op !== 'select') q._ret = true; return q; }; q.order = () => q; q.limit = () => q;
    q.eq = (k: string, v: any) => flt((r) => S(r[k]) === S(v)); q.neq = (k: string, v: any) => flt((r) => S(r[k]) !== S(v)); q.in = (k: string, v: any[]) => flt((r) => v.map(S).includes(S(r[k])));
    q.is = (k: string, v: any) => flt((r) => (v === null ? r[k] === null || r[k] === undefined : r[k] === v)); q.not = (k: string, op: string, v: any) => flt((r) => (op === 'is' && v === null ? r[k] !== null && r[k] !== undefined : true));
    q.gte = (k: string, v: any) => flt((r) => S(r[k]) >= S(v)); q.gt = (k: string, v: any) => flt((r) => S(r[k]) > S(v)); q.lt = (k: string, v: any) => flt((r) => S(r[k]) < S(v)); q.lte = (k: string, v: any) => flt((r) => S(r[k]) <= S(v));
    q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; }; q.delete = () => { q._op = 'delete'; return q; }; q.upsert = (p: any, o: any) => { q._op = 'upsert'; q._payload = p; q._opts = o || {}; return q; };
    q.maybeSingle = () => { q._single = 'maybe'; return q; }; q.single = () => { q._single = 'one'; return q; };
    const exec = () => {
      const match = (r: any) => q._f.every((f: any) => f(r)); let data: any[] = [];
      if (q._op === 'select') data = rows.filter(match);
      else if (q._op === 'insert') { const ps = Array.isArray(q._payload) ? q._payload : [q._payload]; for (const p of ps) { const r = { id: p.id ?? (t === 'portal_section_requests' || t === 'portal_learner_notices' ? ++seq : U(++seq)), created_at: new Date().toISOString(), ...p }; rows.push(r); data.push(r); } }
      else if (q._op === 'upsert') { const p = q._payload; const key = q._opts?.onConflict; const ex = key ? rows.find((r) => r[key] === p[key]) : null; if (ex) { if (q._opts?.ignoreDuplicates) data = []; else { Object.assign(ex, p); data = [ex]; } } else { const r = { id: ++seq, ...p }; rows.push(r); data = [r]; } }
      else if (q._op === 'update') { data = rows.filter(match); for (const r of data) Object.assign(r, q._payload); }
      else if (q._op === 'delete') { data = rows.filter(match); for (const r of data) rows.splice(rows.indexOf(r), 1); }
      if (q._single === 'maybe') return { data: data[0] || null, error: null }; if (q._single === 'one') return data[0] ? { data: data[0], error: null } : { data: null, error: { code: '23505', message: 'no row' } };
      return { data, error: null, count: data.length };
    };
    q.then = (res: any, rej?: any) => Promise.resolve().then(exec).then(res, rej); return q;
  };
  return { db: { from } as any, tables, notices };
}
const seed = () => ({
  programs: [{ id: P, name_ar: 'دبلوم الإشراف التربوي', program_type: 'diploma', start_date: '2026-11-15', end_date: '2027-03-01', levels_count: 2, organization_id: null }],
  portal_program_units: courses.map((c) => ({ ...c, program_id: P })),
  classrooms: sections.map((s) => ({ ...s, program_id: P })),
  trainers: instructors.map((t) => ({ ...t })),
  portal_unit_schedules: [] as any[], portal_schedule_periods: [] as any[], portal_sessions: [] as any[], portal_learning_lines: [] as any[], portal_section_requests: [] as any[], portal_contact_prefs: [] as any[],
  portal_enrollments: [{ id: U(91), email: 'reem@x.sa', user_id: 'u-reem', program_id: P, classroom_id: S2, status: 'approved', full_name: 'ريم' }, { id: U(92), email: 'sara@x.sa', user_id: 'u-sara', program_id: P, classroom_id: S1, status: 'approved' }, { id: U(93), email: 'p@x.sa', user_id: 'u-p', program_id: P, classroom_id: S1, status: 'pending' }],
});
const staff = { id: 'u-admin', email: 'admin@x.sa', name: 'المشرف', staff: true, trainerIds: [] as string[] };
const salem = { id: 'u-salem', email: 'salem@x.sa', name: 'د. سالم', staff: false, trainerIds: [T1] };
const hind = { id: 'u-hind', email: 'hind@x.sa', name: 'د. هند', staff: false, trainerIds: [T2] };
const reem = { id: 'u-reem', email: 'reem@x.sa', name: 'ريم', staff: false, trainerIds: [] as string[] };

test('P66-ب · المخزن: الصلاحيات (طاقم/منسّق يحرّر · أستاذ يقرأ · متدرّب 403) · حفظ سطر يولّد المحاضرات القادمة فقط · الفترة الخاصّة تعيد التوليد · الحذف يبقي الماضي', async () => {
  const { db, tables } = fakeDb(seed()); const now = new Date('2026-11-20T06:00:00Z'); /* الجمعة 20/11 */
  const v0 = await structureView(db, staff, P, now); assert.ok(!('error' in v0)); assert.equal(v0.can_edit, true); assert.equal(v0.courses.length, 3); assert.equal(v0.sections.length, 2); assert.equal(v0.instructors.length, 3); assert.equal(v0.program.is_diploma, true);
  const vS = await structureView(db, salem, P, now); assert.ok(!('error' in vS) && vS.can_edit === true, 'منسّق الشعبة 1 يحرّر'); const vH = await structureView(db, hind, P, now); assert.ok(!('error' in vH) && vH.can_edit === false, 'أستاذ المادة يقرأ فقط');
  const vR = await structureView(db, reem, P, now); assert.ok('error' in vR && vR.status === 403, 'المتدرّب لا يفتح الهيكل');
  assert.equal(((await saveSlot(db, hind, { program_id: P, unit_id: C1, classroom_id: S1, weekday: 0, period_no: 1, starts_at: '16:00', minutes: 110, from_day: '2026-11-15', to_day: '2026-12-13' }, now)) as any).status, 403);
  const r1 = await saveSlot(db, staff, { program_id: P, unit_id: C1, classroom_id: S1, weekday: 0, period_no: 1, starts_at: '16:00', minutes: 110, from_day: '2026-11-15', to_day: '2026-12-13', room_ar: 'قاعة 3' }, now);
  assert.ok(r1.ok); assert.equal(r1.lectures, 4, 'الأحد 15/11 مضى → 22، 29/11، 6، 13/12'); assert.equal(r1.conflicts.length, 0);
  const ses = tables.portal_sessions; assert.equal(ses.length, 4); assert.equal(ses[0].starts_at, '2026-11-22T16:00:00+03:00'); assert.equal(ses[0].duration_min, 110); assert.equal(ses[0].kind, 'class'); assert.equal(ses[0].status, 'scheduled'); assert.equal(ses[0].series_id, r1.slot.id); assert.equal(ses[0].unit_id, C1); assert.equal(ses[0].trainer_id, T1, 'أستاذ المقرّر'); assert.equal(ses[0].title_ar, 'القيادة التربوية');
  assert.equal(ses[0].description_ar, 'دبلوم الإشراف التربوي : المستوى 1 — القيادة التربوية — شعبة 1 — د. سالم — قاعة 3');
  const r2 = await saveSlot(db, staff, { program_id: P, unit_id: C2, classroom_id: S1, weekday: 0, period_no: 1, starts_at: '16:30', minutes: 50, from_day: '2026-11-15', to_day: '2026-12-13' }, now); assert.ok(r2.ok); assert.equal(r2.conflicts.length, 1, 'تنبيه تعارض الشعبة — يُحفظ مع التنبيه (الإنسان يقرّر)'); assert.equal(r2.conflicts[0].kind, 'section');
  /* الماضي يبقى: نضيف جلسة ماضية مولّدة ثم نعدّل السطر */
  ses.push({ id: U(999), program_id: P, classroom_id: S1, trainer_id: T1, series_id: r1.slot.id, unit_id: C1, kind: 'class', title_ar: 'القيادة التربوية', starts_at: '2026-11-15T16:00:00+03:00', duration_min: 110, status: 'ended' });
  const r3 = await saveSlot(db, staff, { program_id: P, id: r1.slot.id, unit_id: C1, classroom_id: S1, weekday: 0, period_no: 1, starts_at: '17:00', minutes: 50, from_day: '2026-11-15', to_day: '2026-12-13' }, now); assert.ok(r3.ok); assert.equal(r3.lectures, 4);
  const mine = ses.filter((s: any) => s.series_id === r1.slot.id); assert.equal(mine.length, 5, '4 جديدة + الماضية'); assert.ok(mine.some((s: any) => s.starts_at === '2026-11-15T16:00:00+03:00' && s.status === 'ended'), 'الماضية كما جرت'); assert.ok(mine.filter((s: any) => s.status === 'scheduled').every((s: any) => s.starts_at.includes('T17:00') && s.duration_min === 50));
  /* الفترة الخاصّة تعيد توليد الكل */
  const pr = await savePeriod(db, staff, { program_id: P, name_ar: 'رمضان التجريبي', from_day: '2026-12-01', to_day: '2026-12-10', lecture_minutes: 40, first_lecture_at: '21:30', lecture_break_min: 10 }, now); assert.ok(pr.ok); assert.equal(pr.lectures, 8);
  const dec6 = ses.find((s: any) => s.series_id === r1.slot.id && s.starts_at.startsWith('2026-12-06')); assert.equal(dec6.starts_at, '2026-12-06T21:30:00+03:00'); assert.equal(dec6.duration_min, 40); assert.equal(ses.find((s: any) => s.series_id === r1.slot.id && s.starts_at.startsWith('2026-12-13')).starts_at, '2026-12-13T17:00:00+03:00', 'خارج الفترة يعود الأصل');
  const v1 = await structureView(db, staff, P, now); assert.ok(!('error' in v1)); assert.equal(v1.slots.length, 2); assert.equal(v1.periods.length, 1); assert.equal(v1.conflicts.length, 1); assert.equal(v1.slots[0].lectures_left, 4); assert.match(v1.slots[0].line_ar, /^دبلوم الإشراف التربوي : المستوى 1 — /); assert.deepEqual(v1.levels, [{ level_no: 1, from_day: '2026-11-15', to_day: '2026-12-13', courses: 2 }, { level_no: 2, from_day: '', to_day: '', courses: 1 }], 'المستوى 2 بلا جدول بعد'); assert.equal(v1.current_level?.level_no, 1);
  const cal = await lectureDaysOf(db, [S1]); assert.deepEqual(cal.get(S1), ['2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13'], 'أيام المحاضرات = التقويم المشتق للشعبة');
  const del = await deleteSlot(db, staff, { program_id: P, id: r2.slot.id }, now); assert.ok(del.ok); assert.equal(ses.filter((s: any) => s.series_id === r2.slot.id).length, 0);
  const sc = await saveCourse(db, staff, { program_id: P, unit_id: C3, level_no: 2, trainer_id: T2, code: 'EDU-201' }); assert.ok(sc.ok); assert.equal(tables.portal_program_units.find((u: any) => u.id === C3).trainer_id, T2);
  assert.equal(((await saveCourse(db, staff, { program_id: P, unit_id: C3, level_no: 9 })) as any).ok, false); assert.ok((await saveCourse(db, staff, { program_id: P, levels_count: 3 })).ok); assert.equal(tables.programs[0].levels_count, 3);
  const lst = await myPrograms(db, hind); assert.deepEqual(lst.map((p) => [p.id, p.courses, p.sections, p.role_ar]), [[P, 3, 2, 'أستاذ مادة']]); assert.equal((await myPrograms(db, salem))[0].role_ar, 'منسّق شعبة'); assert.equal((await myPrograms(db, staff)).length, 1); assert.equal((await myPrograms(db, reem)).length, 0);
});

test('P66-ب · المخزن: الاقتراح → الاعتماد يولّد · «البديل بلمسة» يبدّل أستاذ محاضرة واحدة ويبلّغ الشعبة · «الممرّ» · «ماذا عندي اليوم؟» للمتدرّبة والأستاذ · بطاقات «قبل أن تغادر» · وضع الوردية', async () => {
  const { db, tables, notices } = fakeDb(seed()); const now = new Date('2026-11-20T06:00:00Z');
  const sg = await suggest(db, staff, { program_id: P, level_no: 1, weekdays: [0, 1], times: [{ period_no: 1, starts_at: '16:00', minutes: 110 }, { period_no: 2, starts_at: '18:00', minutes: 110 }], from_day: '2026-11-22', to_day: '2026-12-20' }); assert.ok(sg.ok); assert.equal(sg.proposed.length, 4); assert.match(sg.proposed[0].line_ar, /^دبلوم الإشراف التربوي : المستوى 1 — /);
  assert.equal(((await suggest(db, staff, { program_id: P, level_no: 1, weekdays: [0], times: [], from_day: '2026-11-22', to_day: '2026-12-20' })) as any).ok, false, 'بلا أوقات لا اقتراح — المشرف يكتبها');
  const ad = await adopt(db, staff, { program_id: P, proposed: sg.proposed }, now); assert.ok(ad.ok); assert.equal(ad.saved, 4); assert.equal(ad.lectures, 20, '4 سطور × 5 أسابيع'); assert.equal(tables.portal_sessions.length, 20);
  const slotS2 = tables.portal_unit_schedules.find((s: any) => s.unit_id === C1 && s.classroom_id === S2); const day = slotS2.weekday === 0 ? '2026-11-22' : '2026-11-23';
  const subs = await substitutes(db, staff, { program_id: P, slot_id: slotS2.id, day }); assert.ok(subs.ok); assert.deepEqual(subs.candidates.map((c) => c.id), [T3], 'T2 مشغول في الخانة نفسها (شعبة أخرى) · T3 متفرّغ'); assert.match(subs.line_ar, /شعبة 2/);
  const ap = await applySubstitute(db, staff, { program_id: P, slot_id: slotS2.id, day, trainer_id: T3 }, now, { dry: false }); assert.ok(ap.ok); assert.equal(ap.notified, 1, 'ريم وحدها في الشعبة 2 (approved)');
  const sess = tables.portal_sessions.find((s: any) => s.series_id === slotS2.id && s.starts_at.startsWith(day)); assert.equal(sess.trainer_id, T3); assert.match(sess.description_ar, /د\. فهد/); assert.equal(tables.portal_sessions.filter((s: any) => s.series_id === slotS2.id && s.trainer_id === T1).length, 4, 'بقية المحاضرات على أستاذها');
  const sn = notices.find((n) => n.kind === 'substitute'); assert.equal(sn.email, 'reem@x.sa'); assert.equal(sn.dedupe_key, `substitute:${sess.id}:${U(91)}`); assert.match(sn.body_ar, /د\. فهد/);
  assert.equal(((await applySubstitute(db, staff, { program_id: P, slot_id: slotS2.id, day: '2026-11-19', trainer_id: T3 }, now)) as any).ok, false, 'لا محاضرة في هذا اليوم');
  /* «ماذا عندي اليوم؟» — يوم محاضرة: الأحد 22/11 الساعة 16:30 الرياض (محاضرة 1 جارية) */
  const sunday = new Date('2026-11-22T13:30:00Z');
  const tr = await myLecturesToday(db, reem, sunday); assert.equal(tr.items.length, 2, 'مقرّران للشعبة 2 يوم الأحد'); assert.equal(tr.items[0].state, 'live'); assert.equal(tr.items[1].state, 'upcoming'); assert.match(tr.answer_ar, /^محاضرتان: /); assert.match(tr.items[0].line_ar, /شعبة 2/);
  const tt = await myLecturesToday(db, { ...salem, trainerIds: [T1] }, sunday); assert.equal(tt.items.length, slotS2.weekday === 0 ? 1 : 2, 'د. سالم: شعبتاه يوم الأحد إلا ما أُسند لبديل'); assert.ok(tt.items.every((i) => i.course === 'القيادة التربوية'));
  const th = await myLecturesToday(db, { ...hind, trainerIds: [T3] }, sunday); assert.equal(th.items.length, slotS2.weekday === 0 ? 1 : 0, 'البديل يرى محاضرة اليوم إن كانت اليوم');
  /* بطاقات المتدرّبة · «قبل أن تغادر» · الخيط يظهر حين يبلغ من كتبوا خمسة */
  const cards0 = await lectureCardsFor(db, reem, [S2], sunday); const c0 = cards0.get(S2)!; assert.equal(c0.lectures.length, 2); assert.equal(c0.lectures[0].written, false); assert.equal(c0.lectures[0].thread.shown, false); assert.equal(c0.move_open, false); assert.equal(c0.lectures[0].question_ar, 'قبل أن تغادر: ماذا ستفعل بهذا غدًا؟ — سطر واحد.');
  for (let i = 0; i < 5; i += 1) tables.portal_learning_lines.push({ id: 500 + i, user_id: `x${i}`, email: `x${i}@x.sa`, classroom_id: S2, unit_id: c0.lectures[0].unit_id, kind: 'learn', day: '2026-11-15', body_ar: `سأبدأ درسي بسؤال ${i}`, blocker_ar: null });
  tables.portal_learning_lines.push({ id: 600, user_id: 'u-reem', email: 'reem@x.sa', classroom_id: S2, unit_id: c0.lectures[0].unit_id, kind: 'learn', day: '2026-11-22', body_ar: 'سطري اليوم', blocker_ar: null });
  const cards1 = await lectureCardsFor(db, reem, [S2], sunday); const c1 = cards1.get(S2)!; assert.equal(c1.lectures[0].written, true); assert.equal(c1.lectures[0].thread.shown, true); assert.equal(c1.lectures[0].thread.applied.length, 5); assert.equal(c1.lectures[1].thread.shown, false, 'المقرّر الآخر لا يرث الخيط');
  /* «الممرّ» للأستاذ: بطاقة محاضرته القادمة */
  const sesC1S2 = tables.portal_sessions.find((s: any) => s.unit_id === c0.lectures[0].unit_id && s.classroom_id === S2 && s.starts_at.startsWith('2026-11-22'));
  const who = sesC1S2.trainer_id === T1 ? salem : { ...hind, trainerIds: [sesC1S2.trainer_id] }; const co = await corridor(db, who, sesC1S2.id, sunday); assert.ok(co.ok); assert.equal(co.thread_shown, true); assert.match(co.corridor.title_ar, /شعبة 2/); assert.equal(co.corridor.people, 6, 'الخمسة السابقون + سطر ريم اليوم — الممرّ يضمّ ما كُتب للتوّ'); assert.ok(!JSON.stringify(co).includes('x1@'), 'بلا أسماء ولا بريد');
  assert.equal(((await corridor(db, reem, sesC1S2.id, sunday)) as any).status, 403, 'الممرّ للأستاذ والطاقم');
  /* وضع الوردية عبر القاعدة */
  const { shiftDayFor } = await import('../lib/diploma/store'); tables.portal_contact_prefs.push({ email: 'reem@x.sa', quiet_from: '23:00', quiet_to: '08:00' });
  assert.deepEqual(await shiftDayFor(db, reem, new Date('2026-11-23T04:30:00+03:00')), { day: '2026-11-22', until: '08:00' }); assert.equal(await shiftDayFor(db, reem, new Date('2026-11-23T09:00:00+03:00')), null); assert.deepEqual(await shiftDayFor(db, { ...reem, email: 'sara@x.sa' }, new Date('2026-11-23T05:00:00+03:00')), { day: '2026-11-22', until: '06:00' });
});

test('P66-ب · المخزن: طلب نقل الشعبة (سبب 5–200 · واحد مفتوح · إشعار المنسّق بالرابط #requests) · القرار ينقل التسجيل ويبلّغ · «محطّة المستوى» أول يوم من الأسبوع الأخير مرّة واحدة', async () => {
  const { db, tables, notices } = fakeDb(seed()); const now = new Date('2026-11-20T06:00:00Z');
  await saveSlot(db, staff, { program_id: P, unit_id: C1, classroom_id: S1, weekday: 0, period_no: 1, starts_at: '16:00', minutes: 110, from_day: '2026-11-15', to_day: '2026-12-13' }, now);
  assert.equal(((await requestMove(db, reem, { program_id: P, reason_ar: 'قصير' }, now)) as any).ok, false);
  assert.equal(((await requestMove(db, reem, { program_id: P, to_classroom: S2, reason_ar: 'تعارض مع دوامي الصباحي' }, now)) as any).error, 'أنت في هذه الشعبة أصلًا');
  const rq = await requestMove(db, reem, { program_id: P, to_classroom: S1, reason_ar: 'تعارض مع دوامي الصباحي' }, now, { dry: false }); assert.ok(rq.ok); assert.equal(rq.notified, 0, 'الشعبة 2 بلا منسّق → لا إشعار (المشرف يراه في الصفحة)');
  assert.equal(((await requestMove(db, reem, { program_id: P, reason_ar: 'سبب آخر مختلف' }, now)) as any).status, 409, 'طلب واحد مفتوح');
  const rq2 = await requestMove(db, { id: 'u-sara', email: 'sara@x.sa', name: 'سارة', staff: false, trainerIds: [] }, { program_id: P, reason_ar: 'أقرب إلى سكني' }, now, { dry: false }); assert.ok(rq2.ok); assert.equal(rq2.notified, 1, 'الشعبة 1 منسّقها د. سالم');
  const mn = notices.find((n) => n.kind === 'move_request'); assert.equal(mn.email, 'salem@x.sa'); assert.equal(mn.url, `/me/diploma?program=${P}#requests`); assert.match(mn.body_ar, /دبلوم الإشراف التربوي : شعبة 1 ← أي شعبة أخرى/); assert.match(mn.body_ar, /أقرب إلى سكني/);
  const v = await structureView(db, staff, P, now); assert.ok(!('error' in v)); assert.equal(v.requests.length, 2); assert.equal((v.requests[0] as any).from_ar, 'شعبة 2'); assert.equal((v.requests[0] as any).to_ar, 'شعبة 1'); assert.equal((v.requests[1] as any).to_ar, 'أي شعبة أخرى');
  const vH = await structureView(db, hind, P, now); assert.ok(!('error' in vH)); assert.equal(vH.requests.length, 0, 'أستاذ المادة لا يرى الطلبات');
  assert.equal(((await decideMove(db, reem, { program_id: P, id: rq.id, status: 'done' }, now)) as any).status, 403);
  assert.equal(((await decideMove(db, staff, { program_id: P, id: rq2.id, status: 'done' }, now)) as any).error, 'حدّد الشعبة الجديدة', 'طلب «أي شعبة» يحتاج اختيارًا');
  const d1 = await decideMove(db, staff, { program_id: P, id: rq.id, status: 'done', note_ar: 'أهلًا بك' }, now, { dry: false }); assert.ok(d1.ok && d1.moved); assert.equal(tables.portal_enrollments.find((e: any) => e.id === U(91)).classroom_id, S1); assert.ok(tables.portal_enrollments.find((e: any) => e.id === U(91)).placed_at);
  const dn = notices.find((n) => n.kind === 'move_decided' && n.email === 'reem@x.sa'); assert.match(dn.title_ar, /✅/); assert.match(dn.body_ar, /شعبة 1\. أهلًا بك/); assert.equal(dn.url, '/me/line');
  const d2 = await decideMove(db, salem, { program_id: P, id: rq2.id, status: 'declined', note_ar: 'الشُّعب مكتملة هذا المستوى' }, now, { dry: false }); assert.ok(d2.ok && !d2.moved); assert.equal(tables.portal_section_requests.find((r: any) => r.id === rq2.id).status, 'declined');
  assert.equal(((await decideMove(db, staff, { program_id: P, id: rq.id, status: 'declined' }, now)) as any).status, 404, 'أُغلق');
  /* محطّة المستوى: to_day = 13/12 → أول يوم من الأسبوع الأخير = 7/12 */
  const r0 = await runLevelClose(db, new Date('2026-12-06T06:00:00Z'), { dry: false }); assert.equal(r0.level_close, 0); assert.equal(r0.programs, 1);
  const r1 = await runLevelClose(db, new Date('2026-12-07T06:00:00Z'), { dry: false }); assert.deepEqual(r1.errors, []); assert.equal(r1.level_close, 2, 'ريم وسارة (pending لا)');
  const lc = notices.filter((n) => n.kind === 'level_close'); assert.equal(lc[0].dedupe_key, `level_close:${U(91)}:1`); assert.equal(lc[0].url, '/me/line'); assert.match(lc[0].title_ar, /محطّة المستوى — المستوى 1/);
  const r2 = await runLevelClose(db, new Date('2026-12-07T06:00:00Z'), { dry: false }); assert.equal(r2.level_close, 0, 'مرّة واحدة'); assert.equal((await runLevelClose(db, new Date('2026-12-08T06:00:00Z'), { dry: false })).level_close, 0, 'ليس أول يوم الأسبوع الأخير');
});

test('P66-ب · الصوت والطريق · سجلّ الخزنة · شكل المصدر: SQL واحد · الكرون بعد room_calendar · سطري يقرأ التقويم المشتق ويحمل unit_id · الممرّ في دفتر اليوم', () => {
  assert.equal(parseCommand('ماذا عندي اليوم')?.href, '/me/day', 'P51 كما هو — وفي دفتر اليوم رابط للمتدرّب'); assert.equal(parseCommand('محاضراتي اليوم')?.href, '/me/line#today'); assert.equal(parseCommand('افتح محاضراتي')?.href, '/me/line#today'); assert.equal(parseCommand('وش عندي اليوم')?.href, '/me/line#today'); assert.equal(parseCommand('هيكل الدبلوم')?.href, '/me/diploma'); assert.equal(parseCommand('افتح طلبات النقل')?.href, '/me/diploma');
  assert.equal(parseCommand('سطري')?.href, '/me/line', 'P66 كما هو');
  assert.equal(crumbsFor('/me/diploma').at(-1)?.label, 'هيكل الدبلوم');
  assert.ok(NON_PERSONAL_TABLES.includes('portal_unit_schedules') && NON_PERSONAL_TABLES.includes('portal_schedule_periods'), 'الجدول تنظيمي بلا أفراد');
  const reg = REGISTRY.find((r) => r.table === 'portal_section_requests'); assert.ok(reg && reg.piiCols.includes('reason_ar') && reg.policy === 'delete' && reg.access.includes('self'));
  const sql = read('supabase/p66b-diploma-structure.sql');
  for (const t of ['portal_unit_schedules', 'portal_schedule_periods', 'portal_section_requests']) assert.match(sql, new RegExp(`create table if not exists public\\.${t}`));
  assert.match(sql, /alter table public\.portal_sessions add column if not exists unit_id/); assert.match(sql, /alter table public\.portal_learning_lines add column if not exists unit_id/); assert.match(sql, /portal_learning_lines_one_idx/); assert.match(sql, /levels_count/); assert.match(sql, /level_no/); assert.match(sql, /starts_at\s+time\s+not null/); assert.match(read('lib/diploma/store.ts'), /hhmm\(r\.starts_at\)/, 'time من PostgREST يأتي HH:MM:SS → HH:MM'); assert.match(sql, /minutes\s+int\s+not null check \(minutes between 20 and 300\)/);
  assert.ok(!/default '16:00'|default 60|default 50|default 110/.test(sql), 'لا أوقات ولا مدد افتراضية في SQL');
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runLevelClose\(db, new Date\(\), \{ site, dry \}\)/); assert.match(cron, /first_days, room_calendar, evidence, level_close,/);
  const cal = read('lib/calendar/store.ts'); assert.match(cal, /derivedFromLectures/); assert.match(cal, /lectureDaysOf/); assert.match(cal, /unit_id: uid/); assert.match(cal, /shiftDayFor/); assert.match(cal, /lectureCardsFor/); assert.match(cal, /lectureExists/);
  const ln = read('app/me/line/LineDesk.tsx'); for (const id of ['ln-today', 'ln-today-panel', 'ln-lec', 'ln-leave-ta', 'ln-leave-save', 'ln-thread', 'ln-move-btn', 'ln-move-send', 'ln-shift']) assert.ok(ln.includes(`data-testid="${id}"`), id); assert.match(ln, /\/api\/diploma\?today=1/); assert.match(ln, /action: 'move_request'/);
  const dy = read('app/me/day/DayBook.tsx'); assert.match(dy, /data-testid="dy-corridor"/); assert.match(dy, /dy-learner-today/); assert.match(dy, /\/api\/diploma\?corridor=/); const day = read('lib/portal/day.ts'); assert.match(day, /unit_id, description_ar/); assert.match(day, /extraIds/);
  const ds = read('app/me/diploma/StructureDesk.tsx'); for (const id of ['ds-root', 'ds-course', 'ds-slot-form', 'ds-slot-save', 'ds-grid', 'ds-period-form', 'ds-suggest-run', 'ds-adopt', 'ds-sub-run', 'ds-request-done', 'ds-list']) assert.ok(ds.includes(`data-testid="${id}"`), id);
  assert.ok(!/defaultValue="16:00"|value="60"|placeholder="60"|placeholder="50"/.test(ds), 'لا افتراضات زمنية في الواجهة'); assert.match(read('app/me/diploma/page.tsx'), /ssr: false/);
  assert.match(read('app/api/diploma/route.ts'), /diploma:\$\{/); assert.match(read('app/components/DiplomaReport.tsx'), /\/me\/diploma\?program=/);
  assert.ok(has('app/me/diploma/page.tsx') && has('app/api/diploma/route.ts') && has('lib/diploma/registry.ts') && has('lib/diploma/store.ts'));
});
