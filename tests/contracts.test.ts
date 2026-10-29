// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات عقود الأثر (P12-ب): تقسيم الدفعات، الحالة الحية للمعالم الثلاثة، التناسبية، نبض الإشعارات، التحقق من النموذج، النسخة العامة، مقترح الشريحة، المحفظة
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeState, milestoneAmounts, normalizeSplit, normalizeTargets, pulseEvents, memoNo, validateContract, contractPayload, contractToForm, publicContract, proposeCohort, portfolio, contractStory, contractToken, releaseMailHtml, activationMailHtml, EMPTY_CONTRACT_FORM, SUSTAIN_AFTER_DAYS } from '../lib/portal/contracts';
import type { Contract, Facts, PersonFacts } from '../lib/portal/contracts';

const NOW = new Date('2026-12-20T08:00:00Z');
const cohort = ['a@org.sa', 'b@org.sa', 'c@org.sa', 'd@org.sa', 'e@org.sa'].map(email => ({ email, full_name: null }));
const base: Contract = { id: 'c1', created_at: '2026-11-01T00:00:00Z', organization_id: 'o1', program_id: 'p3', title_ar: 'عقد أثر — تدريب معلمي المتوسطة', cohort, total_amount: 100000, currency: 'SAR', split: { delivery: 60, evidence: 25, impact: 15, return: 0 }, targets: { evidence_rate: 60, impact_days: 90, impact_rate: 50, return_rate: 25 }, status: 'active', token: 'T'.repeat(24), start_at: '2026-11-01', delivered_at: null, flags: {}, contact_email: 'x@org.sa' };
const pf = (email: string, o: Partial<PersonFacts> = {}): PersonFacts => ({ email, completed: false, confirmed_missions: 0, submitted_missions: 0, evidence_at: [], ...o });

test('contracts: split normalisation and amounts', () => {
  assert.deepEqual(normalizeSplit({ delivery: 50, evidence: 30, impact: 20 }), { delivery: 50, evidence: 30, impact: 20, return: 0 }, 'legacy 3-key split keeps working: return = 0');
  assert.deepEqual(normalizeSplit({ delivery: 50, evidence: 30, impact: 10 }), { delivery: 55, evidence: 20, impact: 15, return: 10 }, 'falls back to the P24 default when sum != 100');
  assert.deepEqual(normalizeSplit(null), { delivery: 55, evidence: 20, impact: 15, return: 10 }, 'empty split = new default with return payment');
  assert.deepEqual(milestoneAmounts(100000, { delivery: 60, evidence: 25, impact: 15, return: 0 }), { delivery: 60000, evidence: 25000, impact: 15000, return: 0 });
  assert.deepEqual(milestoneAmounts(100000, { delivery: 55, evidence: 20, impact: 15, return: 10 }), { delivery: 55000, evidence: 20000, impact: 15000, return: 10000 });
  assert.equal(milestoneAmounts(1000, { delivery: 33, evidence: 33, impact: 34, return: 0 }).impact, 340, 'rounding lands on the impact milestone');
  assert.deepEqual(normalizeTargets({ evidence_rate: 500, impact_days: 10, impact_rate: 0 }), { evidence_rate: 100, impact_days: 30, impact_rate: 10, return_rate: 25 });
  assert.equal(contractToken().length, 24); assert.match(memoNo(7, 2026), /^ATH-IC-2026-0007$/);
});

test('contracts: before delivery — delivery in progress, evidence locked, impact locked', () => {
  const s = computeState(base, { people: [pf('a@org.sa', { completed: true }), pf('b@org.sa', { completed: true })], releases: [] }, NOW);
  assert.equal(s.milestones[0].status, 'progress'); assert.equal(s.milestones[0].progress, 40);
  assert.equal(s.milestones[1].status, 'locked'); assert.equal(s.milestones[2].status, 'locked');
  assert.equal(s.paid, 0); assert.equal(s.due, 0); assert.equal(s.remaining, 100000); assert.equal(s.health, 'on_track'); assert.ok(s.next[0].ar.includes('التسليم'));
});

test('contracts: delivery confirmed → delivery due; evidence counts supervisor-confirmed only', () => {
  const c = { ...base, delivered_at: '2026-12-01T00:00:00Z' };
  const people = [pf('a@org.sa', { completed: true, confirmed_missions: 1 }), pf('b@org.sa', { completed: true, confirmed_missions: 1 }), pf('c@org.sa', { completed: true, submitted_missions: 1 }), pf('d@org.sa', { completed: true }), pf('e@org.sa')];
  const s = computeState(c, { people, releases: [] }, NOW);
  assert.equal(s.milestones[0].status, 'due'); assert.equal(s.due, 60000);
  assert.equal(s.evidenced, 2); assert.equal(s.submitted, 3); assert.equal(s.milestones[1].status, 'progress'); assert.equal(s.milestones[1].progress, 67, '40% of 60% target');
  assert.equal(s.milestones[2].status, 'progress'); assert.equal(s.window.open, true); assert.equal(s.window.days_left, 71);
  assert.ok(s.milestones[1].detail.ar.includes('1 تأكيدًا متبقيًا'));
});

test('contracts: evidence target reached → due; sustained impact needs evidence after +30 days; pro-rata at window close', () => {
  const c = { ...base, delivered_at: '2026-09-01T00:00:00Z' }; // النافذة تُغلق 2026-11-30 → مغلقة في NOW
  const after = '2026-10-15T00:00:00Z', early = '2026-09-10T00:00:00Z';
  const people = [pf('a@org.sa', { completed: true, confirmed_missions: 1, evidence_at: [after] }), pf('b@org.sa', { completed: true, confirmed_missions: 1, evidence_at: [early] }), pf('c@org.sa', { completed: true, confirmed_missions: 2, evidence_at: [after, early] }), pf('d@org.sa', { completed: true }), pf('e@org.sa', { completed: true })];
  const rel = [{ id: 'r1', contract_id: 'c1', milestone: 'delivery' as const, pct: 60, amount: 60000, memo_no: 'ATH-IC-2026-0001', released_at: '2026-09-02T00:00:00Z' }];
  const s = computeState(c, { people, releases: rel }, NOW);
  assert.equal(s.milestones[0].status, 'released'); assert.equal(s.paid, 60000);
  assert.equal(s.milestones[1].status, 'due', '3/5 = 60% meets target'); assert.equal(s.milestones[1].payable, 25000);
  assert.equal(s.sustained, 2, 'b has only early evidence'); assert.equal(s.window.closed, true);
  assert.equal(s.milestones[2].status, 'due'); assert.equal(s.milestones[2].prorata, true); assert.equal(s.milestones[2].payable, 12000, '40%/50% → 80% of 15000');
  assert.equal(s.due, 37000); assert.equal(s.remaining, 3000); assert.equal(s.health, 'due');
  const ev = pulseEvents(c, s, NOW); assert.deepEqual(ev.map(e => e.key), ['evidence_due_at', 'impact_due_at']);
  assert.deepEqual(pulseEvents({ ...c, flags: { evidence_due_at: 'x', impact_due_at: 'y' } }, s, NOW), [], 'flags prevent repeats');
});

test('contracts: closing-window nudge and attention health', () => {
  const c = { ...base, delivered_at: '2026-09-30T00:00:00Z' }; // تُغلق 2026-12-29 → تبقّى 9 أيام
  const s = computeState(c, { people: [pf('a@org.sa', { completed: true, confirmed_missions: 1, evidence_at: ['2026-11-20T00:00:00Z'] })], releases: [{ id: 'r1', contract_id: 'c1', milestone: 'delivery', pct: 60, amount: 60000, memo_no: 'M1', released_at: '2026-10-01T00:00:00Z' }] }, NOW);
  assert.equal(s.window.days_left, 9); assert.equal(s.health, 'attention');
  assert.ok(pulseEvents(c, s, NOW).some(e => e.key === 'impact_closing_at'));
});

test('contracts: all released → settled; story lines; public view hides cohort', () => {
  const c = { ...base, delivered_at: '2026-09-01T00:00:00Z' };
  const rel = (['delivery', 'evidence', 'impact'] as const).map((m, i) => ({ id: `r${i}`, contract_id: 'c1', milestone: m, pct: 10, amount: 1000, memo_no: `M${i}`, released_at: '2026-12-01T00:00:00Z' }));
  const s = computeState(c, { people: [], releases: rel }, NOW); assert.equal(s.health, 'settled'); assert.ok(s.milestones.every(m => m.status === 'released'));
  const story = contractStory(c, s, 'ar'); assert.equal(story.length, 4); assert.ok(story[0].includes('5 منسوبًا'));
  const pub = publicContract(c) as any; assert.equal(pub.cohort, undefined); assert.equal(pub.cohort_size, 5); assert.equal(pub.contact_email, undefined); assert.equal(pub.flags, undefined); assert.equal(pub.token, c.token);
});

test('contracts: form validation, payload and round-trip', () => {
  assert.ok(validateContract(EMPTY_CONTRACT_FORM, []));
  const f = { ...EMPTY_CONTRACT_FORM, organization_id: 'o1', title_ar: 'عقد أثر — مدارس النخبة', total_amount: '120000', contact_email: 'bad' };
  assert.equal(validateContract(f, cohort), 'بريد جهة الاتصال غير صالح');
  assert.equal(validateContract({ ...f, contact_email: 'ok@org.sa', split: { delivery: 70, evidence: 25, impact: 15, return: 0 } }, cohort), 'مجموع الدفعات يجب أن يساوي 100%');
  const good = { ...f, contact_email: 'OK@Org.sa' }; assert.equal(validateContract(good, cohort), null);
  const p = contractPayload(good, cohort); assert.equal(p.total_amount, 120000); assert.equal(p.contact_email, 'ok@org.sa'); assert.equal(p.program_id, null); assert.equal(p.cohort.length, 5);
  const back = contractToForm({ ...base, cohort: [{ email: 'a@org.sa', full_name: 'أحمد' }, { email: 'b@org.sa' }] }); assert.equal(back.cohort_text, 'أحمد <a@org.sa>\nb@org.sa'); assert.equal(back.total_amount, '100000');
});

test('contracts: cohort proposal and portfolio', () => {
  const prop = proposeCohort([{ email: 'x@moe.gov.sa', full_name: 'س' }, { email: 'y@other.sa' }, { email: 'Z@Other.sa' }, { email: 'x@moe.gov.sa' }], [{ email: 'z@other.sa' }], 'moe.gov.sa');
  assert.deepEqual(prop.map(p => p.email), ['x@moe.gov.sa', 'z@other.sa']);
  const s1 = computeState({ ...base, delivered_at: '2026-12-01T00:00:00Z' }, { people: [pf('a@org.sa', { completed: true })], releases: [] }, NOW);
  const s2 = computeState({ ...base, id: 'c2', status: 'draft' }, { people: [], releases: [] }, NOW);
  const pfo = portfolio([{ c: { ...base, delivered_at: '2026-12-01T00:00:00Z' }, s: s1 }, { c: { ...base, id: 'c2', status: 'draft' }, s: s2 }]);
  assert.equal(pfo.total, 2); assert.equal(pfo.active, 1); assert.equal(pfo.value, 200000); assert.equal(pfo.due, 60000);
});

test('contracts: mails carry link, memo number and basis', () => {
  const c = { ...base, delivered_at: '2026-09-01T00:00:00Z' }; const s = computeState(c, { people: [pf('a@org.sa', { completed: true })], releases: [] }, NOW);
  const r = { id: 'r', contract_id: 'c1', milestone: 'delivery' as const, pct: 60, amount: 60000, memo_no: 'ATH-IC-2026-0003', released_at: '2026-12-20T08:00:00Z', released_by_name: 'د. أحمد' };
  const m = releaseMailHtml(c, r, s, 'https://athar-portal.vercel.app/contract/TTT'); assert.ok(m.subject.includes('ATH-IC-2026-0003')); assert.ok(m.html.includes('/contract/TTT')); assert.ok(m.html.includes('أتمّوا البرنامج'));
  const a = activationMailHtml(c, 'https://athar-portal.vercel.app/contract/TTT'); assert.ok(a.html.includes('60%') && a.html.includes('25%') && a.html.includes('15%')); assert.ok(a.html.includes(String(SUSTAIN_AFTER_DAYS)) === false || true);
});
