// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P6: الجلسات والمزوّدون والحالة الزمنية والسلاسل والتعارض والإسكان ولوحة البث والبريد
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, KINDS, SESSION_ACCESS, WEEKDAYS, providerLabel, kindLabel, sessionAccessLabel, sessionTitle, classroomLabel, trainerName, endsAt, timeState, canJoin, canCheckIn, fmtWhen, fmtRange, countdown, localDay, riyadhToIso, isoToRiyadh, groupByDay, atharRoomUrl, validateJoinUrl, expandSeries, conflicts, placementPlan, occupancyTone, EMPTY_SESSION, validateSession, sessionPayload, sessionToForm, validateRegistration, liveBoard, sessionsSheet, roomsSheet, reminderEmail, registeredEmail, STATE_LABEL } from '../lib/portal/live';
import type { LiveSession, Classroom } from '../lib/portal/live';
import { SERVICES, NAV, serviceBySlug } from '../lib/portal/content';

const S = (o: Partial<LiveSession>): LiveSession => ({ id: 'aaaaaaaa-0000-4000-8000-000000000001', kind: 'class', title_ar: 'جلسة', starts_at: '2026-11-20T16:00:00.000Z', duration_min: 90, provider: 'teams', skills: [], access: 'program', status: 'scheduled', ...o });
const C = (o: Partial<Classroom>): Classroom => ({ id: 'c1', code: 'SEC-01', program_id: 'p1', capacity: 30, placement_open: true, ...o });
const at = (iso: string) => new Date(iso);

test('live: catalogs + labels', () => {
  assert.equal(PROVIDERS.length, 5); assert.equal(KINDS.length, 4); assert.equal(SESSION_ACCESS.length, 5); assert.equal(WEEKDAYS.length, 7); assert.equal(WEEKDAYS[0].value, 0);
  assert.equal(providerLabel('athar', 'ar'), 'قاعة أَثَر (تجريبي)'); assert.equal(providerLabel('meet', 'en'), 'Google Meet'); assert.equal(kindLabel('webinar', 'ar'), 'ندوة عامة'); assert.equal(sessionAccessLabel('program', 'en'), 'Section / program trainees');
  assert.equal(sessionTitle(S({ title_en: 'X' }), 'en'), 'X'); assert.equal(sessionTitle(S({}), 'en'), 'جلسة');
  assert.equal(classroomLabel(C({ section_name: 'شعبة 1' }), 'ar'), 'شعبة 1 (SEC-01)'); assert.equal(classroomLabel(C({}), 'en'), 'Section SEC-01'); assert.equal(classroomLabel(null, 'ar'), '');
  assert.equal(trainerName({ id: 't', name: 'أحمد' }), 'أحمد'); assert.equal(trainerName(null), '');
  for (const k of Object.keys(STATE_LABEL)) assert.ok(STATE_LABEL[k as keyof typeof STATE_LABEL].ar);
});

test('live: time state machine (Riyadh = UTC+3, 15-min join window, 30-min grace)', () => {
  const s = S({}); // 19:00–20:30 Riyadh = 16:00–17:30Z
  assert.equal(endsAt(s).toISOString(), '2026-11-20T17:30:00.000Z');
  assert.equal(timeState(s, at('2026-11-20T10:00:00Z')), 'upcoming');
  assert.equal(timeState(s, at('2026-11-20T15:44:59Z')), 'upcoming');
  assert.equal(timeState(s, at('2026-11-20T15:45:00Z')), 'soon');
  assert.equal(timeState(s, at('2026-11-20T16:00:00Z')), 'live');
  assert.equal(timeState(s, at('2026-11-20T17:29:00Z')), 'live');
  assert.equal(timeState(s, at('2026-11-20T17:30:00Z')), 'ended');
  assert.equal(timeState(S({ status: 'live' }), at('2026-11-20T17:50:00Z')), 'live', 'manually live stays live within grace');
  assert.equal(timeState(S({ status: 'live' }), at('2026-11-20T18:01:00Z')), 'ended');
  assert.equal(timeState(S({ status: 'cancelled' }), at('2026-11-20T16:00:00Z')), 'cancelled'); assert.equal(timeState(S({ status: 'ended' }), at('2026-11-20T10:00:00Z')), 'ended');
  assert.equal(canJoin('soon'), true); assert.equal(canJoin('live'), true); assert.equal(canJoin('upcoming'), false); assert.equal(canJoin('ended'), false);
  assert.equal(canCheckIn(s, at('2026-11-20T15:49:00Z')), false); assert.equal(canCheckIn(s, at('2026-11-20T15:50:00Z')), true); assert.equal(canCheckIn(s, at('2026-11-20T18:00:00Z')), true); assert.equal(canCheckIn(s, at('2026-11-20T18:01:00Z')), false);
});

test('live: formatting + conversions', () => {
  assert.equal(riyadhToIso('2026-11-20', '19:00'), '2026-11-20T16:00:00.000Z'); assert.deepEqual(isoToRiyadh('2026-11-20T16:00:00.000Z'), { date: '2026-11-20', time: '19:00' });
  assert.equal(localDay('2026-11-20T22:30:00Z'), '2026-11-21', 'after midnight Riyadh'); assert.equal(localDay('2026-11-20T20:59:00Z'), '2026-11-20');
  assert.ok(fmtWhen('2026-11-20T16:00:00Z', 'en').includes('2026')); assert.ok(fmtWhen('2026-11-20T16:00:00Z', 'ar', { time: true }).includes('07:00') || fmtWhen('2026-11-20T16:00:00Z', 'ar', { time: true }).includes('7:00'));
  assert.ok(fmtRange(S({}), 'en').includes('–'));
  assert.equal(countdown('2026-11-20T16:00:00Z', at('2026-11-20T15:30:00Z'), 'en'), 'in 30 min'); assert.equal(countdown('2026-11-20T16:00:00Z', at('2026-11-20T13:30:00Z'), 'en'), 'in 2h 30m'); assert.equal(countdown('2026-11-22T16:00:00Z', at('2026-11-20T15:00:00Z'), 'en'), 'in 2d 1h'); assert.equal(countdown('2026-11-20T16:00:00Z', at('2026-11-20T16:00:00Z'), 'ar'), '');
  const g = groupByDay([S({ id: 'b', starts_at: '2026-11-21T16:00:00Z' }), S({ id: 'a', starts_at: '2026-11-20T16:00:00Z' }), S({ id: 'c', starts_at: '2026-11-20T18:00:00Z' })]);
  assert.deepEqual(g.map(x => [x.day, x.items.map(i => i.id)]), [['2026-11-20', ['a', 'c']], ['2026-11-21', ['b']]]);
});

test('live: providers + join url validation + Athar room', () => {
  assert.equal(validateJoinUrl('teams', ''), 'أدخل رابط Microsoft Teams'); assert.equal(validateJoinUrl('teams', 'notaurl'), 'الرابط يجب أن يبدأ بـ https://');
  assert.equal(validateJoinUrl('teams', 'https://zoom.us/j/123'), 'الرابط لا يبدو رابط Microsoft Teams'); assert.equal(validateJoinUrl('teams', 'https://teams.microsoft.com/l/meetup-join/abc'), null);
  assert.equal(validateJoinUrl('zoom', 'https://us02web.zoom.us/j/123?pwd=x'), null); assert.equal(validateJoinUrl('meet', 'https://meet.google.com/abc-defg-hij'), null); assert.equal(validateJoinUrl('other', 'https://youtube.com/live/x'), null); assert.equal(validateJoinUrl('other', ''), 'أدخل رابط البث');
  assert.equal(validateJoinUrl('athar', ''), null);
  const u = atharRoomUrl('aaaaaaaa-0000-4000-8000-000000000001', 'جلسة القيادة 1'); assert.ok(u.startsWith('https://meet.jit.si/athar-aaaaaaaa-')); assert.ok(!u.includes(' '));
});

test('live: weekly series expansion + conflicts', () => {
  const d = expandSeries({ start_date: '2026-11-01', end_date: '2026-11-30', weekdays: [0, 2], time: '19:00', duration_min: 90 }); // Sundays & Tuesdays in Nov 2026
  assert.equal(d.length, 9); assert.equal(d[0], '2026-11-01T16:00:00.000Z'); assert.equal(d[1], '2026-11-03T16:00:00.000Z'); assert.equal(d[d.length - 1], '2026-11-29T16:00:00.000Z');
  assert.equal(expandSeries({ start_date: '2026-11-10', end_date: '2026-11-01', weekdays: [0], time: '19:00', duration_min: 60 }).length, 0);
  assert.equal(expandSeries({ start_date: '2026-01-01', end_date: '2027-12-31', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '09:00', duration_min: 60 }).length, 120, 'capped');
  const ex = [S({ id: 'x', trainer_id: 't1', classroom_id: 'c1' }), S({ id: 'y', trainer_id: 't2', classroom_id: 'c2', starts_at: '2026-11-20T17:00:00Z' }), S({ id: 'z', trainer_id: 't1', classroom_id: 'c3', status: 'cancelled' })];
  assert.deepEqual(conflicts(ex, { starts_at: '2026-11-20T17:00:00Z', duration_min: 60, trainer_id: 't1', classroom_id: 'c9' }).map(c => c.id), ['x'], 'same trainer overlapping');
  assert.deepEqual(conflicts(ex, { starts_at: '2026-11-20T17:30:00Z', duration_min: 60, trainer_id: 't1', classroom_id: 'c9' }).map(c => c.id), [], 'back-to-back is fine');
  assert.deepEqual(conflicts(ex, { starts_at: '2026-11-20T16:30:00Z', duration_min: 60, trainer_id: 't9', classroom_id: 'c2' }).map(c => c.id), ['y'], 'same room');
  assert.deepEqual(conflicts(ex, { id: 'x', starts_at: '2026-11-20T16:00:00Z', duration_min: 90, trainer_id: 't1', classroom_id: 'c1' }).map(c => c.id), [], 'editing itself');
});

test('live: placement plan fills 30 then opens new sections', () => {
  const rooms = [C({ id: 'c1', code: 'SEC-01' }), C({ id: 'c2', code: 'SEC-02', capacity: 30 }), C({ id: 'c3', code: 'SEC-03', placement_open: false })];
  assert.deepEqual(placementPlan(rooms, { c1: 28, c2: 0 }, 5), [{ classroom_id: 'c1', code: 'SEC-01', take: 2 }, { classroom_id: 'c2', code: 'SEC-02', take: 3 }]);
  assert.deepEqual(placementPlan(rooms, { c1: 30, c2: 30 }, 45), [{ classroom_id: null, code: 'SEC-04', take: 30 }, { classroom_id: null, code: 'SEC-05', take: 15 }]);
  assert.deepEqual(placementPlan([], {}, 0), []);
  assert.equal(occupancyTone(10, 30), 'ok'); assert.equal(occupancyTone(24, 30), 'warn'); assert.equal(occupancyTone(30, 30), 'full');
});

test('live: admin form validation + payload + round-trip', () => {
  const base = { ...EMPTY_SESSION, title_ar: 'جلسة تعريفية', date: '2026-11-20', time: '19:00', program_id: 'p1', classroom_id: 'c1', join_url: 'https://teams.microsoft.com/l/x' };
  assert.equal(validateSession({ ...EMPTY_SESSION }), 'عنوان الجلسة مطلوب (4 أحرف على الأقل)');
  assert.equal(validateSession({ ...base, date: '' }), 'اختر تاريخ الجلسة'); assert.equal(validateSession({ ...base, classroom_id: '' }), 'اختر الشعبة (القاعة)'); assert.equal(validateSession({ ...base, kind: 'webinar', program_id: '', classroom_id: '' }), null);
  assert.equal(validateSession({ ...base, duration_min: 5 }), 'المدة بين 15 و600 دقيقة'); assert.equal(validateSession({ ...base, access: 'org' }), 'اختر الجهة المرتبطة'); assert.equal(validateSession({ ...base, join_url: 'https://zoom.us/j/1' }), 'الرابط لا يبدو رابط Microsoft Teams');
  assert.equal(validateSession({ ...base, provider: 'athar', join_url: '' }), null); assert.equal(validateSession({ ...base, host_url: 'bad' }), 'رابط المضيف غير صالح');
  assert.equal(validateSession({ ...base, mode: 'series' }), 'اختر تاريخ نهاية السلسلة'); assert.equal(validateSession({ ...base, mode: 'series', series_end: '2026-11-10' }), 'نهاية السلسلة قبل بدايتها'); assert.equal(validateSession({ ...base, mode: 'series', series_end: '2026-12-20' }), 'اختر يومًا واحدًا على الأقل في الأسبوع'); assert.equal(validateSession({ ...base, mode: 'series', series_end: '2026-12-20', weekdays: [0, 2] }), null);
  assert.equal(validateSession(base), null);
  const p = sessionPayload({ ...base, provider: 'athar', join_url: 'https://x', capacity: '40', skills: ['s1'] }, '2026-11-20T16:00:00.000Z', 'ser1', 'u1');
  assert.equal(p.join_url, null, 'athar rooms are generated'); assert.equal(p.capacity, 40); assert.equal(p.series_id, 'ser1'); assert.equal(p.status, 'scheduled'); assert.deepEqual(p.skills, ['s1']); assert.equal(p.title_en, null);
  const f = sessionToForm(S({ starts_at: '2026-11-20T16:00:00.000Z', capacity: 25, provider: 'zoom', join_url: 'https://zoom.us/j/1' }), 'https://host'); assert.equal(f.date, '2026-11-20'); assert.equal(f.time, '19:00'); assert.equal(f.capacity, '25'); assert.equal(f.host_url, 'https://host'); assert.equal(f.provider, 'zoom');
  assert.equal(validateRegistration({ full_name: 'أب', email: 'a@b.co' }), 'الاسم مطلوب'); assert.equal(validateRegistration({ full_name: 'سارة', email: 'x' }), 'البريد الإلكتروني غير صالح'); assert.equal(validateRegistration({ full_name: 'سارة', email: 'a@b.co' }), null);
});

test('live: board + sheets + emails', () => {
  const now = at('2026-11-20T16:10:00Z');
  const rows = [S({ id: 'a' }), S({ id: 'b', starts_at: '2026-11-20T16:20:00Z' }), S({ id: 'c', starts_at: '2026-11-20T10:00:00Z', duration_min: 60 }), S({ id: 'd', starts_at: '2026-11-22T16:00:00Z' }), S({ id: 'e', status: 'cancelled' })];
  const b = liveBoard(rows, now); assert.deepEqual(b.live.map(x => x.id), ['a']); assert.deepEqual(b.soon.map(x => x.id), ['b']); assert.equal(b.today.length, 3); assert.equal(b.endedToday, 1); assert.deepEqual(b.upcoming.map(x => x.id), ['d']);
  const sh = sessionsSheet([S({ classroom_id: 'c1', trainer_id: 't1', program_id: 'p1', provider: 'athar' })], new Map([['c1', C({})]]), new Map([['t1', { id: 't1', name: 'أحمد' }]]), new Map([['p1', 'دبلوم']]));
  assert.equal(sh.rows.length, 2); assert.equal(sh.rows[1][0], '2026-11-20'); assert.equal(sh.rows[1][1], '19:00'); assert.equal(sh.rows[1][5], 'دبلوم'); assert.equal(sh.rows[1][7], 'أحمد'); assert.ok(String(sh.rows[1][11]).startsWith('https://meet.jit.si/')); assert.equal(sh.widths.length, sh.rows[0].length);
  const rs = roomsSheet([C({ trainer_id: 't1' })], { c1: 12 }, new Map([['t1', { id: 't1', name: 'أحمد' }]]), new Map([['p1', 'دبلوم']])); assert.equal(rs.rows[1][5], 12); assert.equal(rs.rows[1][6], 18); assert.equal(rs.rows[1][7], 'نعم');
  const m = reminderEmail(S({ title_en: 'Intro' }), 'https://teams.microsoft.com/x', 'https://athar-portal.vercel.app/live/1', 'ar', 'سارة'); assert.ok(m.subject.startsWith('تذكير: جلسة')); assert.ok(m.html.includes('https://teams.microsoft.com/x') && m.html.includes('سارة') && m.html.includes('dir="rtl"'));
  const r = registeredEmail(S({ title_en: 'Intro' }), 'https://athar-portal.vercel.app/live/1', 'en', 'Sara'); assert.equal(r.subject, "You're registered: Intro"); assert.ok(r.html.includes('dir="ltr"'));
});

test('live: portal content — all eight services are live', () => {
  const s = serviceBySlug('live')!; assert.equal(s.status, 'live'); assert.equal(s.cta.href, '/live'); assert.equal((s as any).phase, undefined);
  assert.ok(NAV.some(n => n.href === '/live')); assert.equal(SERVICES.filter(x => x.status === 'live').length, 8); assert.equal(NAV.length, 8);
});
