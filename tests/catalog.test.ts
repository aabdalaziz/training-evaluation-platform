import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, typeLabel, feeLabel, seatsLeft, regState, canApply, catalogPrograms, filterPrograms, lines, pick, durationLabel, validateEnrollment, decisionEmail, enrollmentsSheet, statusLabel } from '../lib/portal/catalog';
import type { CatalogProgram, Counts, Enrollment } from '../lib/portal/catalog';

const TODAY = '2026-10-24';
const P = (x: Partial<CatalogProgram>): CatalogProgram => ({ id: 'p', name_ar: 'برنامج', status: 'ACTIVE', start_date: '2026-11-01', end_date: '2026-11-30', ...x });

test('catalog: fee + type labels', () => {
  assert.equal(TYPES.length, 4);
  assert.equal(feeLabel(null, 'SAR', 'ar'), 'الرسوم عند التواصل'); assert.equal(feeLabel('', 'SAR', 'en'), 'Fee on request');
  assert.equal(feeLabel(0, 'SAR', 'ar'), 'مجاني'); assert.equal(feeLabel('0', 'SAR', 'en'), 'Free');
  assert.equal(feeLabel(1500, 'SAR', 'ar'), '1,500 ر.س'); assert.equal(feeLabel('1500.5', 'sar', 'en'), 'SAR 1,500.5'); assert.equal(feeLabel(99, 'USD', 'en'), 'USD 99');
  assert.equal(typeLabel('diploma', 'ar'), 'دبلوم'); assert.equal(typeLabel(null, 'en'), 'Training program'); assert.equal(typeLabel('zzz', 'ar'), 'برنامج تدريبي');
});

test('catalog: registration state machine', () => {
  const c = (approved: number, pending = 0): Counts => ({ program_id: 'p', approved, pending, waitlisted: 0 });
  assert.equal(regState(P({}), TODAY), 'open');
  assert.equal(regState(P({ end_date: '2026-10-01' }), TODAY), 'ended');
  assert.equal(regState(P({ status: 'COMPLETED' }), TODAY), 'ended');
  assert.equal(regState(P({ registration_open: false }), TODAY), 'closed');
  assert.equal(regState(P({ registration_deadline: '2026-10-20' }), TODAY), 'deadline');
  assert.equal(regState(P({ registration_deadline: '2026-10-24' }), TODAY), 'open', 'deadline day still open');
  assert.equal(regState(P({ seats: 10 }), TODAY, c(10)), 'full');
  assert.equal(regState(P({ seats: 10 }), TODAY, c(7, 3)), 'waitlist');
  assert.equal(regState(P({ seats: 10 }), TODAY, c(7, 2)), 'open');
  assert.equal(seatsLeft(P({ seats: 10 }), c(12)), 0); assert.equal(seatsLeft(P({}), c(5)), null); assert.equal(seatsLeft(P({ seats: 10 }), null), 10);
  assert.ok(canApply('open') && canApply('waitlist') && !canApply('full') && !canApply('closed'));
});

test('catalog: public listing + filters', () => {
  const rows: CatalogProgram[] = [
    P({ id: 'a', name_ar: 'دبلوم إعداد المعلمين', program_type: 'diploma', delivery_mode: 'onsite', start_date: '2026-09-05', end_date: '2027-06-24' }),
    P({ id: 'b', name_ar: 'العربية عن بعد', name_en: 'Arabic Online', program_type: 'arabic', delivery_mode: 'REMOTE', seats: 5 }),
    P({ id: 'c', name_ar: 'مخفي', is_public: false }),
    P({ id: 'd', name_ar: 'منتهٍ', end_date: '2026-07-30', status: 'COMPLETED' }),
    P({ id: 'e', name_ar: 'ملغى', status: 'CANCELLED' }),
    P({ id: 'f', name_ar: 'مؤرشف', archived_at: '2026-01-01T00:00:00Z' }),
    P({ id: 'g', name_ar: 'بلا تواريخ', start_date: null, end_date: null }),
  ];
  assert.deepEqual(catalogPrograms(rows, TODAY).map(p => p.id), ['a', 'b', 'g']);
  assert.deepEqual(catalogPrograms(rows, TODAY, true).map(p => p.id), ['a', 'b', 'd', 'g']);
  const pub = catalogPrograms(rows, TODAY);
  assert.deepEqual(filterPrograms(pub, { type: 'diploma' }, TODAY).map(p => p.id), ['a']);
  assert.deepEqual(filterPrograms(pub, { mode: 'remote' }, TODAY).map(p => p.id), ['b']);
  assert.deepEqual(filterPrograms(pub, { mode: 'onsite' }, TODAY).map(p => p.id), ['a', 'g']);
  assert.deepEqual(filterPrograms(pub, { q: 'online' }, TODAY).map(p => p.id), ['b']);
  assert.deepEqual(filterPrograms(pub, { state: 'full' }, TODAY, [{ program_id: 'b', approved: 5, pending: 0, waitlisted: 0 }]).map(p => p.id), ['b']);
  assert.deepEqual(filterPrograms(pub, { state: 'open' }, TODAY, [{ program_id: 'b', approved: 5, pending: 0, waitlisted: 0 }]).map(p => p.id), ['a', 'g']);
});

test('catalog: text helpers', () => {
  assert.deepEqual(lines('1. هدف أول\n- هدف ثانٍ\n• ثالث؛ رابع'), ['هدف أول', 'هدف ثانٍ', 'ثالث', 'رابع']);
  assert.deepEqual(lines(null), []);
  const p = P({ intro_ar: 'مقدمة', intro_en: 'Intro', objectives_ar: 'أ', hours: 40, start_date: '2026-11-01', end_date: '2026-11-28' });
  assert.equal(pick(p, 'intro', 'en'), 'Intro'); assert.equal(pick(p, 'objectives', 'en'), 'أ', 'falls back to Arabic'); assert.equal(pick(p, 'location', 'ar'), '');
  assert.equal(durationLabel(p, 'ar'), '40 ساعة · 4 أسابيع'); assert.equal(durationLabel(P({ start_date: '2026-11-01', end_date: '2026-11-03' }), 'en'), '3 days'); assert.equal(durationLabel(P({ start_date: null, end_date: null }), 'en'), '');
});

test('catalog: enrollment validation + decision email + sheet', () => {
  const ok = { full_name: 'أحمد', email: 'a@b.sa', phone: '+966 55 123 4567', organization: '', city: '', notes: '' };
  assert.equal(validateEnrollment(ok, 'ar'), null);
  assert.ok(validateEnrollment({ ...ok, full_name: 'أ' }, 'ar')); assert.ok(validateEnrollment({ ...ok, phone: '' }, 'en')); assert.ok(validateEnrollment({ ...ok, email: 'x' }, 'ar')); assert.ok(validateEnrollment({ ...ok, notes: 'x'.repeat(1001) }, 'ar'));
  const e: Enrollment = { id: 'e1', created_at: '2026-10-24T08:00:00Z', program_id: 'p1', full_name: 'Maria <Lopez>', email: 'm@x.com', status: 'pending', lang: 'en', decided_at: null, decision_note: null };
  const m = decisionEmail(e, 'Arabic Online', 'approved', 'Pay by Nov 1', 'https://site.sa');
  assert.equal(m.subject, "You're in: Arabic Online"); assert.match(m.html, /dir="ltr"/); assert.match(m.html, /Maria &lt;Lopez&gt;/); assert.match(m.html, /Pay by Nov 1/); assert.match(m.html, /https:\/\/site\.sa\/programs\/p1/);
  const ar = decisionEmail({ ...e, lang: 'ar' }, 'العربية', 'waitlisted', null, 'https://site.sa');
  assert.equal(ar.subject, 'أُدرجت في قائمة الانتظار: العربية'); assert.match(ar.html, /dir="rtl"/); assert.ok(!ar.html.includes('ملاحظة من الإدارة'));
  assert.equal(statusLabel('rejected', 'ar'), 'معتذر'); assert.equal(statusLabel('weird', 'en'), 'weird');
  const sh = enrollmentsSheet([{ ...e, program_name: 'العربية', decided_at: '2026-10-25T09:00:00Z', status: 'approved' }]);
  assert.equal(sh.rows.length, 2); assert.equal(sh.rows[0].length, 11); assert.equal(sh.rows[1][0], 'العربية'); assert.equal(sh.rows[1][6], 'مقبول'); assert.equal(sh.rows[1][7], '2026-10-24'); assert.equal(sh.rows[1][8], '2026-10-25'); assert.ok(sh.rtl);
});
