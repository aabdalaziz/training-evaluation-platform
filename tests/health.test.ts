import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHealth, overall, cronStatus, healthAlerts, healthCsv, hoursSince, fmtHours, ENV_SPECS } from '../lib/health/model';
import type { HealthRaw } from '../lib/health/model';

const NOW = '2026-10-23T09:00:00Z';
function raw(over: Partial<HealthRaw> = {}): HealthRaw {
  const env: Record<string, boolean> = {}; for (const s of ENV_SPECS) env[s.key] = true;
  return {
    now: NOW, env, db: { ok: true, latencyMs: 120 },
    crons: { followups: '2026-10-23T03:00:00Z', digest: '2026-10-19T02:00:00Z', notificationScan: '2026-10-23T03:00:00Z' },
    mail7d: { trainee_ok: 10, trainee_failed: 0, reports: 4, certificates_sent: 6, certificates_failed: 0, last_failure: null },
    counts: { programs: 5, programs_active: 2, classrooms: 4, trainers: 4, questions: 20, evaluations: 400, evaluations_7d: 30, subscriptions_active: 2, open_notifications: 3, critical_notifications: 0, profiles: 6, profiles_no_role: 0, audit_rows: 50, outcome_kpis: 3, certificates: 12 },
    integrity: { active_programs_without_rooms: [], rooms_without_trainer: [], trainers_without_rooms: [], active_programs_silent_14d: [], programs_ended_still_active: [] },
    ai: { configured: true, provider: 'gemini' }, errors: [], ...over,
  };
}

test('health: all green → score 100, no alerts', () => {
  const checks = evaluateHealth(raw()); const o = overall(checks);
  assert.equal(o.status, 'ok'); assert.equal(o.score, 100); assert.equal(o.bad, 0); assert.equal(healthAlerts(checks).length, 0);
  assert.ok(checks.find(c => c.id === 'cron:digest')?.status === 'ok'); assert.ok(checks.find(c => c.id === 'cron:followups')?.status === 'ok');
  assert.equal(healthCsv(checks)[0].length, 5);
});

test('health: missing required env → bad + critical alert; optional env → info', () => {
  const r = raw(); r.env.RESEND_API_KEY = false; r.env.AI_API_KEY = false;
  const checks = evaluateHealth(r); const o = overall(checks);
  assert.equal(o.status, 'bad');
  assert.equal(checks.find(c => c.id === 'env:RESEND_API_KEY')?.status, 'bad');
  assert.equal(checks.find(c => c.id === 'env:AI_API_KEY')?.status, 'info');
  assert.equal(checks.find(c => c.id === 'mail:7d')?.status, 'bad');
  const al = healthAlerts(checks); assert.ok(al.find(a => a.dedupe_key === 'health:env:RESEND_API_KEY' && a.severity === 'critical')); assert.ok(al.find(a => a.dedupe_key === 'health:mail:7d'));
  assert.ok(!al.find(a => a.dedupe_key.startsWith('health:env:AI')));
});

test('health: cron freshness thresholds', () => {
  const now = new Date(NOW);
  assert.equal(cronStatus(null, 24, now).status, 'info');
  assert.equal(cronStatus('2026-10-22T10:00:00Z', 24, now).status, 'ok');      // 23h
  assert.equal(cronStatus('2026-10-21T12:00:00Z', 24, now).status, 'warn');    // 45h
  assert.equal(cronStatus('2026-10-19T09:00:00Z', 24, now).status, 'bad');     // 96h
  assert.equal(cronStatus('2026-10-12T09:00:00Z', 168, now).status, 'warn');   // 11 days for weekly
  assert.equal(hoursSince('2026-10-23T08:00:00Z', now), 1); assert.equal(fmtHours(0.5), 'قبل أقل من ساعة'); assert.equal(fmtHours(72), 'قبل 3 يومًا');
  const r = raw({ crons: { followups: '2026-10-19T03:00:00Z', digest: null, notificationScan: null } });
  const checks = evaluateHealth(r);
  assert.equal(checks.find(c => c.id === 'cron:followups')?.status, 'bad'); assert.equal(checks.find(c => c.id === 'cron:digest')?.status, 'info');
  assert.ok(healthAlerts(checks).find(a => a.dedupe_key === 'health:cron:followups' && a.severity === 'critical'));
});

test('health: data integrity warnings + partial failures + no subscriptions', () => {
  const r = raw({ integrity: { active_programs_without_rooms: ['أ'], rooms_without_trainer: ['A-1', 'A-2'], trainers_without_rooms: ['س'], active_programs_silent_14d: ['ب'], programs_ended_still_active: ['ج'] }, errors: ['questions: relation missing'] });
  r.counts.subscriptions_active = 0; r.counts.profiles_no_role = 2; r.counts.questions = 0; r.mail7d.trainee_failed = 3; r.mail7d.last_failure = 'invalid address';
  const checks = evaluateHealth(r); const o = overall(checks);
  assert.equal(o.status, 'bad'); // questions = 0
  assert.equal(checks.find(c => c.id === 'data:rooms')?.status, 'warn'); assert.equal(checks.find(c => c.id === 'data:trainer')?.detail, 'A-1، A-2');
  assert.equal(checks.find(c => c.id === 'data:idle-trainers')?.status, 'info'); assert.equal(checks.find(c => c.id === 'cron:subs')?.status, 'warn');
  assert.equal(checks.find(c => c.id === 'data:roles')?.status, 'warn'); assert.equal(checks.find(c => c.id === 'mail:7d')?.status, 'warn');
  assert.ok(checks.find(c => c.id === 'mail:7d')?.hint?.includes('invalid address'));
  assert.ok(checks.find(c => c.label === 'خطأ أثناء الفحص'));
  assert.ok(o.score < 100 && o.score > 50);
  // تنبيهات البيانات لا تذهب للجرس؛ الكرون بلا اشتراكات نعم (warn في مجموعة cron)
  const al = healthAlerts(checks); assert.ok(al.find(a => a.dedupe_key === 'health:cron:subs')); assert.ok(!al.find(a => a.dedupe_key.startsWith('health:data:')));
});
