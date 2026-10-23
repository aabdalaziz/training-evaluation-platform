import test from 'node:test';
import assert from 'node:assert/strict';
import { achievement, changePct, latest, kpiRows, programOutcomeIndex, achievementLabel, chainScore, chainLabel, chainRecommendations, chainCsv, KPI_TEMPLATES } from '../lib/outcomes/model';
import type { OutcomeKpi, OutcomeMeasurement } from '../lib/outcomes/model';
import { buildChain, portfolioSummary } from '../lib/outcomes/chain';

const kpi = (o: Partial<OutcomeKpi>): OutcomeKpi => ({ id: 'k1', program_id: 'p1', name_ar: 'م', unit: '%', direction: 'up', baseline: 50, baseline_date: null, target: 80, target_date: null, source: null, owner_name: null, weight: 2, notes: null, ...o });

test('achievement: up direction interpolates baseline→target and clamps 0..100', () => {
  const k = kpi({});
  assert.equal(achievement(k, 65), 50);
  assert.equal(achievement(k, 80), 100);
  assert.equal(achievement(k, 95), 100);
  assert.equal(achievement(k, 40), 0);
  assert.equal(achievement(k, null), null);
});

test('achievement: down direction (lower is better) is mirrored', () => {
  const k = kpi({ direction: 'down', baseline: 20, target: 10 });
  assert.equal(achievement(k, 15), 50);
  assert.equal(achievement(k, 10), 100);
  assert.equal(achievement(k, 25), 0);
});

test('achievement: falls back when baseline or target missing', () => {
  assert.equal(achievement(kpi({ baseline: null, target: 80 }), 60), 75);
  assert.equal(achievement(kpi({ baseline: 50, target: null }), 55), 100);
  assert.equal(achievement(kpi({ baseline: 50, target: null }), 50), 50);
  assert.equal(achievement(kpi({ baseline: 50, target: null }), 45), 0);
  assert.equal(achievement(kpi({ baseline: null, target: null }), 45), null);
  assert.equal(achievement(kpi({ baseline: 50, target: 50 }), 60), 100); // target == baseline → fallback to target ratio
});

test('changePct is sign-normalised to the desired direction', () => {
  assert.equal(changePct(kpi({ baseline: 50 }), 60), 20);
  assert.equal(changePct(kpi({ direction: 'down', baseline: 50 }), 40), 20);
  assert.equal(changePct(kpi({ direction: 'down', baseline: 50 }), 60), -20);
  assert.equal(changePct(kpi({ baseline: 0 }), 60), null);
});

test('latest picks the most recent measurement; kpiRows + weighted program index', () => {
  const ms: OutcomeMeasurement[] = [
    { id: 'm1', kpi_id: 'k1', value: 60, measured_on: '2026-09-01', note: null },
    { id: 'm2', kpi_id: 'k1', value: 74, measured_on: '2026-10-01', note: null },
    { id: 'm3', kpi_id: 'k2', value: 12, measured_on: '2026-10-05', note: null },
  ];
  assert.equal(latest(ms.filter(m => m.kpi_id === 'k1'))?.value, 74);
  const rows = kpiRows([kpi({ id: 'k1', weight: 3 }), kpi({ id: 'k2', direction: 'down', baseline: 20, target: 10, weight: 1 }), kpi({ id: 'k3', weight: 5 })], ms);
  assert.equal(rows[0].achievement, 80);
  assert.equal(rows[1].achievement, 80);
  assert.equal(rows[2].achievement, null);
  const s = programOutcomeIndex(rows);
  assert.deepEqual(s, { index: 80, n: 3, measured: 2 });
  assert.equal(achievementLabel(100).tone, 'ok');
  assert.equal(achievementLabel(72).tone, 'info');
  assert.equal(achievementLabel(45).tone, 'warn');
  assert.equal(achievementLabel(10).tone, 'bad');
  assert.equal(achievementLabel(null).tone, 'none');
});

test('chainScore normalises levels to 0..100 and averages the available ones', () => {
  const s = chainScore({ l1: 4.2, l1_n: 30, l2: 0.45, l2_pairs: 12, l2_gain: 20, l3: null, l3_n: 0, l4: 90, l4_n: 2, attendance_pct: 88, participants: 20 });
  assert.equal(s.s1, 80); assert.equal(s.s2, 45); assert.equal(s.s3, null); assert.equal(s.s4, 90);
  assert.equal(s.index, Math.round((80 + 45 + 90) / 3));
  assert.equal(s.levels, 3); assert.equal(s.weakest, 2);
  const empty = chainScore({ l1: null, l1_n: 0, l2: null, l2_pairs: 0, l2_gain: null, l3: null, l3_n: 0, l4: null, l4_n: 0, attendance_pct: null, participants: null });
  assert.equal(empty.index, null); assert.equal(empty.levels, 0); assert.equal(empty.weakest, null);
  assert.equal(chainLabel(80).tone, 'ok'); assert.equal(chainLabel(30).tone, 'bad'); assert.equal(chainLabel(null).tone, 'none');
  // negative Hake clamps to 0
  assert.equal(chainScore({ ...empty, l2: -0.2 } as any).s2, 0);
});

test('chainRecommendations flags where the chain breaks', () => {
  const c = { l1: 4.6, l1_n: 20, l2: 0.1, l2_pairs: 10, l2_gain: 4, l3: 40, l3_n: 8, l4: 20, l4_n: 2, attendance_pct: 60, participants: 20 };
  const recs = chainRecommendations(c, chainScore(c));
  assert.ok(recs.some(r => r.includes('رضا مرتفع')));
  assert.ok(recs.some(r => r.includes('الحضور 60%')));
  const none = chainRecommendations({ ...c, l1: null, l2: null, l3: null, l4: null, l1_n: 0 }, chainScore({ ...c, l1: null, l2: null, l3: null, l4: null }));
  assert.equal(none.length, 1);
  const good = { l1: 4.7, l1_n: 20, l2: 0.7, l2_pairs: 10, l2_gain: 30, l3: 85, l3_n: 8, l4: 95, l4_n: 2, attendance_pct: 95, participants: 20 };
  assert.ok(chainRecommendations(good, chainScore(good))[0].includes('متكاملة'));
});

test('buildChain aggregates all four levels per program from raw rows', () => {
  const rows = buildChain({
    programs: [{ id: 'p1', name_ar: 'برنامج أ' }, { id: 'p2', name_ar: 'برنامج ب' }],
    evaluations: [{ id: 'e1', program_id: 'p1' }, { id: 'e2', program_id: 'p1', overall_rating: 3 }, { id: 'e3', program_id: null }],
    answers: [{ evaluation_id: 'e1', rating_value: 5 }, { evaluation_id: 'e1', rating_value: 4 }, { evaluation_id: 'e1', rating_value: 'x' }],
    assessments: [{ id: 'a1', program_id: 'p1' }],
    impactResponses: [
      { id: 'r1', assessment_id: 'a1', phase: 'pre', respondent_hash: 'h1', respondent_label: null, gender: null, answers: {}, scale_mean: null, knowledge_pct: null, score: 40, submitted_at: '' },
      { id: 'r2', assessment_id: 'a1', phase: 'post', respondent_hash: 'h1', respondent_label: null, gender: null, answers: {}, scale_mean: null, knowledge_pct: null, score: 70, submitted_at: '' },
      { id: 'r3', assessment_id: 'a1', phase: 'pre', respondent_hash: 'h2', respondent_label: null, gender: null, answers: {}, scale_mean: null, knowledge_pct: null, score: 50, submitted_at: '' },
    ] as any,
    followups: [{ id: 'f1', program_id: 'p1', scale_max: 5, title_ar: 'م', token: 't', status: 'open', classroom_id: null, due_days: 60, open_at: null, supervisor_open: true, trainee_open: true, auto_send: false, remind_after_days: 7, recipients: [] }],
    questions: [{ id: 'q1', followup_id: 'f1', order_no: 1, kind: 'scale', audience: 'all', domain_ar: 'تطبيق', text_ar: 's' }, { id: 'q2', followup_id: 'f1', order_no: 2, kind: 'percent', audience: 'all', domain_ar: null, text_ar: 'p' }],
    behaviorResponses: [
      { id: 'b1', followup_id: 'f1', role: 'supervisor', respondent_hash: 'x', respondent_label: null, trainee_key: 'k1', trainee_label: null, answers: { q1: 4, q2: 75 }, scale_mean: 4, application_pct: 75, barriers: [], comment: null, submitted_at: '' },
      { id: 'b2', followup_id: 'f1', role: 'trainee', respondent_hash: 'y', respondent_label: null, trainee_key: 'k1', trainee_label: null, answers: { q1: 5, q2: 100 }, scale_mean: 5, application_pct: 100, barriers: [], comment: null, submitted_at: '' },
    ],
    sessions: [{ id: 's1', program_id: 'p1' }, { id: 's2', program_id: 'p1' }],
    records: [{ session_id: 's1', full_name: 'أحمد', status: 'present' }, { session_id: 's2', full_name: 'أحمد', status: 'absent' }, { session_id: 's1', full_name: 'سارة', email: 's@x', status: 'late' }, { session_id: 's2', full_name: 'سارة', email: 's@x', status: 'present' }],
    kpis: [kpi({ id: 'k1', program_id: 'p1' })],
    measurements: [{ id: 'm1', kpi_id: 'k1', value: 71, measured_on: '2026-10-01', note: null }],
  });
  const a = rows[0];
  assert.equal(a.c.l1, 3.75);             // mean(mean(5,4)=4.5, 3)
  assert.equal(a.c.l1_n, 2);
  assert.equal(a.c.l2, 0.5);              // (70−40)/(100−40)
  assert.equal(a.c.l2_pairs, 1);
  assert.ok(a.c.l3 != null && a.c.l3 > 0); assert.equal(a.c.l3_n, 2);
  assert.equal(a.c.l4, 70);
  assert.equal(a.c.participants, 2);
  assert.equal(a.c.attendance_pct, 75);    // (50 + 100) / 2
  assert.equal(a.s.levels, 4);
  const b = rows[1];
  assert.equal(b.s.levels, 0); assert.equal(b.c.participants, null);
  const port = portfolioSummary(rows);
  assert.equal(port.total, 2); assert.equal(port.complete, 1); assert.equal(port.index.n, 1);
  const csv = chainCsv(rows.map(r => ({ program: r.program.name_ar, c: r.c, s: r.s })));
  assert.equal(csv.length, 3); assert.equal(csv[1][0], 'برنامج أ');
});

test('KPI templates are well-formed', () => {
  for (const g of KPI_TEMPLATES) for (const i of g.items) { assert.ok(i.name_ar && i.unit); assert.ok(['up', 'down'].includes(i.direction)); assert.ok(i.weight >= 1 && i.weight <= 5); }
});
