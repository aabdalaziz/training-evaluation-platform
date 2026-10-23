import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProgramReport, programSheets } from '../lib/reports/program';
import { planMails, buildMail, isEnabled, GRACE_HOURS } from '../lib/notifications/trainee-mail';
import { buildXlsx } from '../lib/export/xlsx';

const program = { id: 'p1', name_ar: 'برنامج أ', name_en: 'Program A', start_date: '2026-09-01', end_date: '2026-10-01', status: 'ACTIVE' };
const questions = [
  { id: 'q1', text_ar: 'وضوح الشرح', text_en: 'Clarity', section_ar: 'المدرب', section_en: 'Trainer', kind: 'RATING_5' },
  { id: 'q2', text_ar: 'ملاءمة المحتوى', text_en: 'Content', section_ar: 'المحتوى', section_en: 'Content', kind: 'RATING_5' },
  { id: 'q3', text_ar: 'ملاحظات', text_en: 'Comments', section_ar: 'رأيك', section_en: 'Opinion', kind: 'LONG_TEXT' },
];
const evaluations = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, program_id: 'p1', classroom_id: 'c1', kind: i < 4 ? 'DAILY' : 'FINAL', submitted_at: `2026-09-1${i}T08:00:00Z`, guest_email: `t${i}@x.sa` }));
const answers = evaluations.flatMap((e, i) => [
  { evaluation_id: e.id, question_id: 'q1', rating_value: 5 }, { evaluation_id: e.id, question_id: 'q2', rating_value: i % 2 ? 2 : 4 },
  { evaluation_id: e.id, question_id: 'q3', rating_value: null, text_value: i === 0 ? 'المحتوى ممتاز لكن الوقت قصير جدًا' : '' },
]);

function input(over: Partial<Parameters<typeof buildProgramReport>[0]> = {}) {
  return {
    program, classrooms: [{ id: 'c1', code: 'A-101', program_id: 'p1', trainer_id: 't1' }], trainers: [{ id: 't1', name: 'د. خالد' }], questions,
    evaluations, answers, assessments: [], impactResponses: [], followups: [], behaviorQuestions: [], behaviorResponses: [],
    sessions: [{ id: 's1', program_id: 'p1' }, { id: 's2', program_id: 'p1' }],
    records: [{ session_id: 's1', full_name: 'أحمد', email: 'a@x.sa', status: 'present' as const }, { session_id: 's2', full_name: 'أحمد', email: 'a@x.sa', status: 'present' as const }, { session_id: 's1', full_name: 'سارة', email: 's@x.sa', status: 'absent' as const }],
    certificates: [{ id: 'ce1', program_id: 'p1', issued_at: '2026-10-02', sent_at: null, revoked_at: null }],
    kpis: [{ id: 'k1', program_id: 'p1', name_ar: 'نسبة الاجتياز', unit: '%', direction: 'up' as const, baseline: 50, baseline_date: null, target: 80, target_date: null, source: null, owner_name: null, weight: 2, notes: null }],
    measurements: [{ id: 'm1', kpi_id: 'k1', value: 74, measured_on: '2026-10-20', note: null }],
    ...over,
  };
}

test('buildProgramReport assembles sections and chain', () => {
  const r = buildProgramReport(input());
  assert.equal(r.rooms[0].code, 'A-101'); assert.deepEqual(r.trainers, ['د. خالد']);
  assert.equal(r.attendance.participants, 2); assert.equal(r.attendance.eligible80, 1); assert.equal(r.attendance.avgPct, 50);
  assert.ok(r.evaluation.k); assert.equal(r.evaluation.k!.responses, 6);
  assert.equal(r.evaluation.axes.length, 2);
  assert.equal(r.evaluation.byKind.length, 2);
  assert.equal(r.evaluation.comments.length, 1);
  assert.equal(r.learning.s, null); assert.equal(r.transfer.s, null);
  assert.equal(r.outcomes.index, 80); assert.equal(r.outcomes.measured, 1);
  assert.equal(r.certificates.issued, 1); assert.equal(r.certificates.coveragePct, 50);
  assert.equal(r.chain.s.levels, 2); // L1 + L4
  assert.ok(['strong', 'good', 'limited', 'weak'].includes(r.headline.key));
  assert.ok(r.recommendations.some(x => x.includes('الحضور')));
  assert.ok(r.recommendations.some(x => x.includes('المستوى 2 غير مقاس')));
  assert.ok(r.recommendations.length <= 7);
});

test('programSheets builds a valid multi-sheet xlsx', () => {
  const r = buildProgramReport(input());
  const sheets = programSheets(r);
  assert.equal(sheets.length, 6);
  assert.equal(sheets[0].rows[1][1], 'برنامج أ');
  assert.equal(sheets[2].rows.length, 3); // header + 2 people
  const bytes = buildXlsx(sheets);
  assert.ok(bytes.length > 2000); assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
});

test('empty program yields none headline and guidance', () => {
  const r = buildProgramReport(input({ evaluations: [], answers: [], sessions: [], records: [], certificates: [], kpis: [], measurements: [] }));
  assert.equal(r.headline.key, 'none'); assert.equal(r.evaluation.k, null); assert.equal(r.attendance.avgPct, null);
  assert.equal(r.certificates.coveragePct, null);
  assert.ok(r.recommendations.length >= 1);
});

/* ---------------- trainee automail ---------------- */
const now = new Date('2026-10-23T06:00:00Z');
const base = {
  programs: [{ id: 'p1', name_ar: 'برنامج أ', is_final_open: true }, { id: 'p2', name_ar: 'برنامج ب', is_final_open: false }],
  sessions: [{ id: 's1', program_id: 'p1' }, { id: 's2', program_id: 'p2' }],
  records: [
    { session_id: 's1', full_name: 'أحمد علي', email: 'A@x.sa' }, { session_id: 's1', full_name: 'أحمد علي', email: 'a@x.sa' },
    { session_id: 's1', full_name: 'بلا بريد', email: null }, { session_id: 's1', full_name: 'سارة', email: 'bad-email' }, { session_id: 's2', full_name: 'نورة', email: 'n@x.sa' },
  ],
  certificates: [
    { id: 'c1', program_id: 'p1', recipient_name: 'أحمد علي', recipient_email: 'a@x.sa', verify_code: 'V1', serial: 'UPM-1', issued_at: '2026-10-20T00:00:00Z', sent_at: null, revoked_at: null },
    { id: 'c2', program_id: 'p1', recipient_name: 'سارة', recipient_email: 's@x.sa', verify_code: 'V2', serial: 'UPM-2', issued_at: '2026-10-23T05:00:00Z', sent_at: null, revoked_at: null }, // داخل فترة السماح
    { id: 'c3', program_id: 'p1', recipient_name: 'منى', recipient_email: 'm@x.sa', verify_code: 'V3', serial: 'UPM-3', issued_at: '2026-10-01T00:00:00Z', sent_at: '2026-10-02T00:00:00Z', revoked_at: null }, // أُرسلت يدويًا
    { id: 'c4', program_id: 'p1', recipient_name: 'هند', recipient_email: 'h@x.sa', verify_code: 'V4', serial: 'UPM-4', issued_at: '2026-10-01T00:00:00Z', sent_at: null, revoked_at: '2026-10-05T00:00:00Z' }, // ملغاة
  ],
  log: [] as { kind: string; program_id: string | null; ref_id: string | null; email: string }[],
  now,
};

test('planMails: final_open once per (program,email), only open programs, valid emails, dedupes case', () => {
  const plans = planMails(base);
  const fo = plans.filter(p => p.kind === 'final_open');
  assert.equal(fo.length, 1); assert.equal(fo[0].email, 'a@x.sa'); assert.equal(fo[0].program_name, 'برنامج أ');
  const again = planMails({ ...base, log: [{ kind: 'final_open', program_id: 'p1', ref_id: null, email: 'A@x.sa' }] });
  assert.equal(again.filter(p => p.kind === 'final_open').length, 0);
});

test(`planMails: certificate_issued respects ${GRACE_HOURS}h grace, manual send, revocation and log`, () => {
  const plans = planMails(base).filter(p => p.kind === 'certificate_issued');
  assert.deepEqual(plans.map(p => p.ref_id), ['c1']);
  assert.equal(plans[0].extra?.verify_code, 'V1');
  const logged = planMails({ ...base, log: [{ kind: 'certificate_issued', program_id: 'p1', ref_id: 'c1', email: 'a@x.sa' }] }).filter(p => p.kind === 'certificate_issued');
  assert.equal(logged.length, 0);
  const later = planMails({ ...base, now: new Date('2026-10-25T00:00:00Z') }).filter(p => p.kind === 'certificate_issued');
  assert.deepEqual(later.map(p => p.ref_id), ['c1', 'c2']);
});

test('buildMail produces RTL HTML with the right links', () => {
  const [fo, ci] = [planMails(base).find(p => p.kind === 'final_open')!, planMails(base).find(p => p.kind === 'certificate_issued')!];
  const m1 = buildMail('https://site.sa', fo);
  assert.ok(m1.subject.includes('التقييم النهائي')); assert.ok(m1.html.includes('https://site.sa/evaluate/final?program=p1')); assert.ok(m1.html.includes('dir="rtl"')); assert.ok(m1.html.includes('أحمد'));
  const m2 = buildMail('https://site.sa', ci);
  assert.ok(m2.subject.includes('شهادتك')); assert.ok(m2.html.includes('https://site.sa/verify/V1')); assert.ok(m2.html.includes('UPM-1')); assert.ok(m2.html.includes('/me'));
});

test('isEnabled honours TRAINEE_MAIL', () => {
  assert.equal(isEnabled({}), true); assert.equal(isEnabled({ TRAINEE_MAIL: '0' }), false); assert.equal(isEnabled({ TRAINEE_MAIL: 'off' }), false); assert.equal(isEnabled({ TRAINEE_MAIL: '1' }), true);
});
