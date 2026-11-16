// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P73 «ساعة الأثر» — المنطق النقي: المواعيد الأسبوعية · الطور · الكلمة والسطر · k ≥ 5 · السحابة · الاختيار (التعادل للأقصر) · النصوص · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOUR_LIMITS, HOUR_KINDS, P73_NAMES_AR, WEEKDAYS_AR, validatePin, occurrences, phaseOf, canWrite, validateWord, validateHourLine, normWord, weekViewOf, cloudOf, linesViewOf, pickLine, validVotes, carryNotice, pinNotice, sealNotice, sealHeadAr, riyadhStartIso, riyadhDay, fmtTimeAr, fmtDayAr, shuffleSeeded, RULES_AR } from '../lib/hour/registry';
import { buildCards, CARD_KEYS } from '../lib/level/registry';
import { crumbsFor } from '../lib/portal/way';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ses = (id: string, startsAt: string, status = 'scheduled') => ({ id, starts_at: startsAt, duration_min: 60, status, series_id: 's1', day: riyadhDay(new Date(startsAt)) });
const users = (n: number) => Array.from({ length: n }, (_, i) => `u${i + 1}`);

test('P73 · الأسماء والحدود والأنواع', () => {
  assert.equal(P73_NAMES_AR.phase, 'ساعة الأثر'); assert.equal(P73_NAMES_AR.official, 'لقاء التأمل الأسبوعي للشعبة'); assert.equal(P73_NAMES_AR.path, '/me/hour');
  assert.equal(HOUR_LIMITS.minutes, 60); assert.equal(HOUR_LIMITS.k, 5); assert.equal(HOUR_LIMITS.wordMax, 24); assert.equal(HOUR_LIMITS.lineMax, 120); assert.equal(HOUR_LIMITS.homeHours, 24);
  assert.deepEqual([...HOUR_KINDS], ['hour_word', 'hour_line', 'hour_vote', 'carry', 'hour_seal']); assert.equal(WEEKDAYS_AR[0], 'الأحد'); assert.equal(WEEKDAYS_AR[6], 'السبت'); assert.equal(RULES_AR.length, 5);
});

test('P73 · التثبيت: لا افتراضي — يوم ووقت صالحان', () => {
  assert.equal(validatePin({}).ok, false); assert.equal(validatePin({ weekday: 7, time: '10:00' }).ok, false); assert.equal(validatePin({ weekday: 2, time: '25:00' }).ok, false); assert.equal(validatePin({ weekday: 2, time: '1030' }).ok, false);
  const v = validatePin({ weekday: '2', time: '10:30' }); assert.ok(v.ok && v.weekday === 2 && v.time === '10:30');
  assert.equal(riyadhStartIso('2026-12-22', '10:30'), '2026-12-22T10:30:00+03:00'); assert.equal(fmtTimeAr('2026-12-22T10:30:00+03:00'), '10:30'); assert.equal(fmtDayAr('2026-12-22'), 'الثلاثاء 22/12');
});

test('P73 · المواعيد الأسبوعية: من أول ثلاثاء قادم حتى نهاية البرنامج — وإن مضى وقت اليوم فالأسبوع التالي', () => {
  const now = new Date('2026-12-20T06:00:00Z'); /* الأحد 20 ديسمبر 09:00 الرياض */
  const d = occurrences(2, '10:30', now, '2027-01-20'); assert.deepEqual(d, ['2026-12-22', '2026-12-29', '2027-01-05', '2027-01-12', '2027-01-19']);
  assert.equal(occurrences(0, '08:00', now, '2027-01-20')[0], '2026-12-27', 'الأحد ومضى وقته → الأحد القادم');
  assert.equal(occurrences(0, '10:30', now, '2027-01-20')[0], '2026-12-20', 'الأحد ووقته لم يأتِ → اليوم');
  assert.equal(occurrences(2, '10:30', now, null).length, HOUR_LIMITS.maxWeeks, 'بلا نهاية → الحدّ الأقصى'); assert.equal(occurrences(2, '10:30', now, '2026-12-21').length, 0, 'ينتهي قبل أول موعد → لا شيء');
});

test('P73 · الطور: قبل · مفتوحة (−10 د … +90 د) · في البيت حتى 24 ساعة · مختومة = في البيت · ثم القادمة', () => {
  const s1 = ses('a', '2026-12-22T10:30:00+03:00'); const s2 = ses('b', '2026-12-29T10:30:00+03:00'); const none = new Set<string>();
  assert.equal(phaseOf([], none, new Date('2026-12-22T07:00:00Z')).phase, 'none');
  let p = phaseOf([s1, s2], none, new Date('2026-12-22T07:00:00Z')); assert.equal(p.phase, 'before'); assert.equal(p.session?.id, 'a');
  p = phaseOf([s1, s2], none, new Date('2026-12-22T07:25:00Z')); assert.equal(p.phase, 'open', 'قبل البداية بخمس دقائق مفتوحة'); assert.equal(p.minutes_left, 65);
  p = phaseOf([s1, s2], none, new Date('2026-12-22T08:00:00Z')); assert.equal(p.phase, 'open'); assert.equal(p.minutes_left, 30); assert.equal(p.next?.id, 'b');
  p = phaseOf([s1, s2], none, new Date('2026-12-22T09:10:00Z')); assert.equal(p.phase, 'home', 'بعد المهلة → في البيت'); assert.equal(p.session?.id, 'a');
  p = phaseOf([s1, s2], new Set(['a']), new Date('2026-12-22T08:00:00Z')); assert.equal(p.phase, 'home', 'ختم الأستاذ أثناء الساعة → في البيت للغائبين');
  p = phaseOf([s1, s2], none, new Date('2026-12-23T07:31:00Z')); assert.equal(p.phase, 'before', 'بعد 24 ساعة → القادمة'); assert.equal(p.session?.id, 'b');
  p = phaseOf([s1], none, new Date('2027-01-01T07:00:00Z')); assert.equal(p.phase, 'closed');
  assert.ok(canWrite('open') && canWrite('home') && !canWrite('before') && !canWrite('closed') && !canWrite('none'));
  assert.equal(phaseOf([ses('c', '2026-12-22T10:30:00+03:00', 'cancelled')], none, new Date('2026-12-22T08:00:00Z')).phase, 'none', 'الملغاة لا تُحسب');
});

test('P73 · الكلمة الواحدة والسطر: الحدود والتطبيع', () => {
  assert.equal(validateWord('').ok, false); assert.equal(validateWord('كلمة ثانية').ok, false); assert.equal(validateWord('أ'.repeat(25)).ok, false);
  const w = validateWord('  امتنان!  '); assert.ok(w.ok && w.word === 'امتنان'); assert.equal(normWord('إمتنانٌ'), 'امتنان'); assert.equal(normWord('هُدًى'), 'هدي');
  assert.equal(validateHourLine('قصير').ok, false); assert.equal(validateHourLine('س'.repeat(121)).ok, false); const l = validateHourLine('  تعلّمنا   أن نصمت قبل أن نكتب '); assert.ok(l.ok && l.text === 'تعلّمنا أن نصمت قبل أن نكتب');
});

test('P73 · «ما كتبناه هذا الأسبوع»: k ≥ 5 · بلا تكرار · سطوري معلَّمة · خلط ثابت بالبذرة', () => {
  const rows = users(4).map((u, i) => ({ id: i + 1, user_id: u, kind: 'learn', body_ar: `سطر رقم ${i + 1} من الأسبوع`, day: '2026-12-21' }));
  const below = weekViewOf(rows, 'u1', 'seed'); assert.equal(below.shown, false); assert.equal(below.people, 4); assert.match(below.head_ar, /خمسة/);
  rows.push({ id: 5, user_id: 'u5', kind: 'apply', body_ar: 'سطر رقم 1 من الأسبوع', day: '2026-12-22' }, { id: 6, user_id: 'u5', kind: 'commit', body_ar: 'التزامي أن أقرأ كل يوم', day: '2026-12-22' });
  const v = weekViewOf(rows, 'u1', 'seed'); assert.equal(v.shown, true); assert.equal(v.people, 5); assert.equal(v.lines.length, 5, 'المكرّر نصًّا يُحذف'); assert.ok(v.lines.find((l) => l.id === 1)?.mine); assert.ok(!v.lines.find((l) => l.id === 2)?.mine);
  assert.deepEqual(weekViewOf(rows, 'u1', 'seed').lines.map((l) => l.id), v.lines.map((l) => l.id), 'البذرة نفسها → الترتيب نفسه'); assert.ok(!v.lines.some((l) => 'user_id' in l), 'لا معرّفات أشخاص في المخرَج');
  assert.deepEqual(shuffleSeeded([1, 2, 3, 4, 5], 'x'), shuffleSeeded([1, 2, 3, 4, 5], 'x'));
});

test('P73 · السحابة: k ≥ 5 · الكلمة المكرّرة تكبر · التطبيع يجمع الهمزات والتشكيل', () => {
  const few = cloudOf(users(4).map((u) => ({ user_id: u, body_ar: 'صبر' }))); assert.equal(few.shown, false); assert.equal(few.items.length, 0);
  const c = cloudOf([{ user_id: 'u1', body_ar: 'امتنان' }, { user_id: 'u2', body_ar: 'إمتنان' }, { user_id: 'u3', body_ar: 'امتنانٌ' }, { user_id: 'u4', body_ar: 'صبر' }, { user_id: 'u5', body_ar: 'ضوء' }, { user_id: 'u6', body_ar: 'صبر' }]);
  assert.equal(c.shown, true); assert.equal(c.items[0].word, 'امتنان'); assert.equal(c.items[0].n, 3); assert.equal(c.items[1].word, 'صبر'); assert.equal(c.items[1].n, 2); assert.equal(c.items[2].n, 1);
});

test('P73 · «سطر ساعتنا»: الأصوات الصالحة · لا صوت لسطري · الأعلى يفوز · التعادل للأقصر · بلا أصوات الأقصر', () => {
  const lines = [{ id: 1, user_id: 'u1', body_ar: 'سطر طويل جدًّا جدًّا نسبيًّا' }, { id: 2, user_id: 'u2', body_ar: 'سطر قصير' }, { id: 3, user_id: 'u3', body_ar: 'سطر متوسط الطول' }, { id: 4, user_id: 'u4', body_ar: 'آخر' }, { id: 5, user_id: 'u5', body_ar: 'سطر خامس' }];
  assert.equal(validVotes(lines, [{ user_id: 'u1', for: 1 }, { user_id: 'u2', for: 99 }, { user_id: 'u3', for: 1 }]).length, 1, 'صوت لسطري ولسطر غير موجود يسقطان');
  assert.equal(pickLine([], []), null);
  assert.equal(pickLine(lines, [{ user_id: 'u2', for: 1 }, { user_id: 'u3', for: 1 }, { user_id: 'u4', for: 3 }])?.id, 1, 'الأعلى أصواتًا');
  assert.equal(pickLine(lines, [{ user_id: 'u2', for: 1 }, { user_id: 'u1', for: 3 }])?.id, 3, 'تعادل 1–1 → الأقصر («سطر متوسط الطول» أقصر من الطويل)');
  assert.equal(pickLine(lines, [])?.id, 4, 'بلا أصوات → الأقصر من الكل');
  const lv = linesViewOf(lines, [{ user_id: 'u2', for: 1 }], 'u2', 'seed'); assert.equal(lv.shown, true); assert.equal(lv.my_vote, 1); assert.equal(lv.lines.find((l) => l.id === 1)?.votes, 1); assert.ok(lv.lines.find((l) => l.id === 2)?.mine);
  assert.equal(linesViewOf(lines.slice(0, 4), [], 'u1', 's').shown, false, 'أربعة مقترحين → لا تصويت بعد');
});

test('P73 · النصوص: الإشعارات بلا أسماء · رأس الختم أعداد فقط', () => {
  const c = carryNotice('SEC-01'); assert.match(c.title_ar, /حَمَل أحدُهم سطرك/); assert.match(c.body_ar, /بلا اسم/);
  const p = pinNotice('SEC-01', 2, '10:30'); assert.match(p.title_ar, /كل الثلاثاء 10:30/); assert.match(p.body_ar, /بلا تعليم ولا تصحيح/);
  assert.match(sealNotice('SEC-01', 'سطرنا', '2026-12-22').body_ar, /«سطرنا»/); assert.match(sealNotice('SEC-01', null, '2026-12-22').body_ar, /بلا سطر/);
  assert.equal(sealHeadAr({ people: 12, words: 11, lines: 9, carries: 10 }), 'حضر الساعة 12 · كلمات 11 · سطور مقترَحة 9 · سطور محمولة 10');
});

test('P73 · صفحة المستوى: بطاقتا «ما حملتُه من غيري» و«سطر ساعتنا»', () => {
  assert.ok(CARD_KEYS.includes('carried') && CARD_KEYS.includes('hour_line'));
  const w = { from_day: '2026-12-20', to_day: '2027-01-20' };
  const { cards } = buildCards({ lines: [
    { kind: 'learn', day: '2026-12-21', body_ar: 'سطر يومي الأول هنا', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null },
    { kind: 'carry', day: '2026-12-22', body_ar: 'سطر زميلي الذي حملتُه', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null },
    { kind: 'hour_line', day: '2026-12-22', body_ar: 'سطري المقترَح للساعة', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null, chosen: true },
  ], prev_line: null, first_why: null, exam: null, training_days: 3 }, w);
  const keys = cards.map((c) => c.key); assert.ok(keys.includes('carried') && keys.includes('hour_line') && keys.includes('day_lines'));
  assert.equal(cards.find((c) => c.key === 'carried')?.items?.[0].state_ar, 'سطر زميل — بلا اسم'); assert.equal(cards.find((c) => c.key === 'hour_line')?.items?.[0].state_ar, 'اختارته الشعبة سطرَ ساعتها');
});

test('P73 · المسار والمصدر: /me/hour في way · SQL يوسّع القيدين فقط · الواجهة والـ API بالترتيب المعلَن', () => {
  assert.equal(crumbsFor('/me/hour', 'ar').at(-1)?.label, 'ساعة الأثر');
  const sql = read('supabase/p73-athar-hour.sql'); assert.ok(!/create table/i.test(sql), 'صفر جداول جديدة'); assert.match(sql, /'athar_hour'/); for (const k of HOUR_KINDS) assert.ok(sql.includes(`'${k}'`), k);
  const store = read('lib/hour/store.ts'); assert.ok(/needLearner && who\.role !== 'learner'/.test(store), 'الأستاذ لا يكتب'); assert.ok(store.includes("who.role !== 'instructor') return fail('الختم لأستاذ الشعبة'"), 'الختم للأستاذ'); assert.ok(store.includes('pickLine(lines, votes)'), 'النظام يختار لا الأستاذ');
  const room = read('app/me/hour/HourRoom.tsx'); const at = (id: string) => room.indexOf(`data-testid="${id}"`); assert.ok(at('hr-week') > 0 && at('hr-week') < at('hr-silence') && at('hr-silence') < at('hr-lines-box') && at('hr-lines-box') < at('hr-seal-btn'), 'ترتيب الأقسام: نقرأ → صمت وكلمة → سطر → ختم'); assert.ok(room.includes('data-screen'), 'وضع شاشة القاعة');
  const api = read('app/api/me/hour/route.ts'); for (const a of ['pin', 'unpin', 'carry', 'word', 'line', 'vote', 'seal']) assert.ok(api.includes(`action === '${a}'`), a);
  assert.ok(read('app/me/day/DayBook.tsx').includes("import('./HourPin')"), 'بطاقة التثبيت في دفتر اليوم'); assert.ok(read('app/me/day/weave/WeaveDesk.tsx').includes('wv-hours'), 'خيط «ساعاتنا»'); assert.ok(read('lib/accreditation/load.ts').includes('hourEvidence'), 'شاهد «ساعة الدفعة»');
});
