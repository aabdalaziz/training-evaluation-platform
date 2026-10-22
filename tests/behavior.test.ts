import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, csvRows, followupUrl, makeToken, parseRecipients, recipientsText, recommendations, suggestOpenAt, transferLabel, TEMPLATE } from '../lib/behavior/model';
import type { BehaviorFollowup, BehaviorQuestion, BehaviorResponse } from '../lib/behavior/model';

test('makeToken is 8 chars without ambiguous letters', () => {
  let i = 0; const t = makeToken(() => ((i += 7) % 32) / 32);
  assert.equal(t.length, 8);
  assert.ok(!/[01IO]/.test(t));
});

test('parseRecipients reads name, email, role and trainee linkage; dedupes; warns on bad lines', () => {
  const txt = [
    'أحمد علي, ahmed@x.sa, مشرف, سارة محمد, sara@x.sa',
    'سارة محمد, Sara@X.sa',
    'سارة محمد, sara@x.sa, متدرب',
    'بدون بريد, ---',
    'خالد, khalid@x.sa; supervisor; نورة',
  ].join('\n');
  const { recipients, warnings } = parseRecipients(txt);
  assert.equal(recipients.length, 3);
  assert.deepEqual(recipients[0], { name: 'أحمد علي', email: 'ahmed@x.sa', role: 'supervisor', trainee_name: 'سارة محمد', trainee_email: 'sara@x.sa' });
  assert.equal(recipients[1].role, 'trainee');
  assert.equal(recipients[1].email, 'sara@x.sa');
  assert.equal(recipients[2].trainee_name, 'نورة');
  assert.equal(warnings.length, 1);
  // round-trip
  const again = parseRecipients(recipientsText(recipients)).recipients;
  assert.deepEqual(again, recipients);
});

test('suggestOpenAt adds due days to program end (or today)', () => {
  assert.equal(suggestOpenAt('2026-10-01', 60), '2026-11-30');
  assert.equal(suggestOpenAt('2026-10-01', 90), '2026-12-30');
  assert.equal(suggestOpenAt(null, 0, new Date('2026-10-23T10:00:00Z')), '2026-10-23');
});

test('followupUrl carries role and trainee hints', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.org/';
  assert.equal(followupUrl('ABCD2345'), 'https://example.org/followup/ABCD2345');
  const u = followupUrl('ABCD2345', 'supervisor', { name: 'سارة', email: 'sara@x.sa' });
  assert.ok(u.startsWith('https://example.org/followup/ABCD2345?role=supervisor&tn='));
  assert.ok(u.endsWith('&te=sara%40x.sa'));
});

test('transferLabel thresholds', () => {
  assert.equal(transferLabel(80).ar, 'نقل أثر قوي');
  assert.equal(transferLabel(65).tone, 'info');
  assert.equal(transferLabel(50).tone, 'warn');
  assert.equal(transferLabel(10).tone, 'bad');
  assert.equal(transferLabel(null).tone, 'info');
});

function fixtures() {
  const qs: BehaviorQuestion[] = TEMPLATE.map((q, i) => ({ ...q, id: `q${i + 1}`, followup_id: 'f1' }));
  const resp = (role: 'supervisor' | 'trainee', key: string, label: string, scale: number, app: number, barriers: string[], comment: string | null): BehaviorResponse => ({
    id: Math.random().toString(36).slice(2), followup_id: 'f1', role, respondent_hash: 'h', respondent_label: role === 'trainee' ? label : 'مشرف',
    trainee_key: key, trainee_label: label, answers: { q1: scale, q2: scale, q3: scale, q4: scale, q5: scale, q6: scale },
    scale_mean: scale, application_pct: app, barriers, comment, submitted_at: '2026-12-01T00:00:00Z',
  });
  const rs = [
    resp('supervisor', 'e:sara@x.sa', 'سارة', 4, 75, ['ضيق الوقت وضغط العمل'], 'طبّقت نموذج المتابعة الجديد'),
    resp('trainee', 'e:sara@x.sa', 'سارة', 5, 100, ['لا توجد معوقات'], null),
    resp('supervisor', 'e:khalid@x.sa', 'خالد', 2, 25, ['ضيق الوقت وضغط العمل', 'نقص الأدوات أو الموارد'], null),
    resp('trainee', 'e:khalid@x.sa', 'خالد', 3, 50, ['ضيق الوقت وضغط العمل'], 'أحتاج أدوات'),
  ];
  return { qs, rs };
}

test('analyze computes means, application %, weighted transfer index, gap, barriers, pairs', () => {
  const { qs, rs } = fixtures();
  const s = analyze(qs, rs, 5);
  assert.equal(s.n, 4); assert.equal(s.n_sup, 2); assert.equal(s.n_tr, 2); assert.equal(s.n_trainees, 2);
  assert.equal(s.mean_sup, 3); assert.equal(s.mean_tr, 4);
  assert.equal(s.app_sup, 50); assert.equal(s.app_tr, 75);
  // iSup = avg(50, 50) = 50 ; iTr = avg(75, 75) = 75 ; index = 0.6*50 + 0.4*75 = 60
  assert.equal(s.transfer_index, 60);
  assert.equal(s.label.tone, 'info');
  assert.equal(s.gap, -1); // المشرف أقل من التقدير الذاتي بدرجة واحدة
  assert.equal(s.barriers[0].label, 'ضيق الوقت وضغط العمل');
  assert.equal(s.barriers[0].n, 3);
  assert.equal(s.barriers[0].pct, 75);
  assert.equal(s.pairs.length, 2);
  assert.equal(s.pairs[0].label, 'خالد'); // الأضعف أولًا
  assert.equal(s.pairs[0].gap, -1);
  assert.equal(s.domains.length, 4); // التطبيق، الأداء، نقل الأثر، الدعم
  assert.equal(s.comments.length, 2);
  const recs = recommendations(s);
  assert.ok(recs.length >= 2);
  assert.ok(recs.some(r => /ضيق الوقت/.test(r)));
});

test('analyze handles supervisor-only and empty data', () => {
  const { qs, rs } = fixtures();
  const s1 = analyze(qs, rs.filter(r => r.role === 'supervisor'), 5);
  assert.equal(s1.transfer_index, 50); assert.equal(s1.gap, null);
  const s0 = analyze(qs, [], 5);
  assert.equal(s0.n, 0); assert.equal(s0.transfer_index, null); assert.equal(s0.pairs.length, 0);
  assert.ok(recommendations(s0).length >= 1);
});

test('csvRows has header + one row per trainee', () => {
  const { qs, rs } = fixtures();
  const f = { id: 'f1', title_ar: 'متابعة', token: 'ABCD2345', program_id: 'p', classroom_id: null, status: 'open', scale_max: 5, due_days: 60, open_at: null, supervisor_open: true, trainee_open: true, auto_send: false, remind_after_days: 7, recipients: [] } as BehaviorFollowup;
  const rows = csvRows(f, 'برنامج', analyze(qs, rs, 5));
  assert.equal(rows.length, 3);
  assert.equal(rows[1][2], 'خالد');
});
