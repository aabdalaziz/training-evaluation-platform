import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, scopeToProgram, counts, totalRows, wideAnswers, buildSheets, manifest, jsonPayload, backupFilename, backupStatus, daysSince, archiveCandidates, splitArchive, columnsOf } from '../lib/backup/model';
import type { Dataset } from '../lib/backup/model';
import { buildXlsx } from '../lib/export/xlsx';

const NOW = new Date('2026-10-23T08:00:00Z');
const data = (): Dataset => ({
  programs: [{ id: 'p1', name_ar: 'التفويض', status: 'ACTIVE', end_date: '2026-11-20', organization_id: 'o' }, { id: 'p2', name_ar: 'تعليم', status: 'COMPLETED', end_date: '2026-05-01', archived_at: null }],
  trainers: [{ id: 't1', name: 'أحمد' }, { id: 't2', name: 'سارة' }],
  classrooms: [{ id: 'c1', program_id: 'p1', trainer_id: 't1', code: 'A-1' }, { id: 'c2', program_id: 'p2', trainer_id: 't2', code: 'B-1' }],
  class_schedules: [{ id: 's1', classroom_id: 'c1' }, { id: 's2', classroom_id: 'c2' }],
  evaluation_templates: [{ id: 'd', kind: 'DAILY' }, { id: 'f', kind: 'FINAL' }],
  questions: [{ id: 'q1', template_id: 'd', text_ar: 'وضوح الشرح', order_index: 1 }, { id: 'q2', template_id: 'd', text_ar: 'ملاحظات', order_index: 2 }, { id: 'q9', template_id: 'f', text_ar: 'ختامي', order_index: 1 }],
  program_evaluation_templates: [{ program_id: 'p1', template_id: 'd', is_active: true }, { program_id: 'p2', template_id: 'f', is_active: true }],
  evaluations: [{ id: 'e1', program_id: 'p1', classroom_id: 'c1', kind: 'DAILY', evaluation_date: '2026-10-20', overall_rating: 4.5, respondent_hash: 'secret' }, { id: 'e2', program_id: 'p2', classroom_id: 'c2', kind: 'FINAL', submitted_at: '2026-04-30T10:00:00Z', overall_rating: 3 }],
  evaluation_answers: [{ id: 'a1', evaluation_id: 'e1', question_id: 'q1', rating_value: 5 }, { id: 'a2', evaluation_id: 'e1', question_id: 'q2', text_value: 'ممتاز' }, { id: 'a3', evaluation_id: 'e2', question_id: 'q9', rating_value: 3 }],
  attendance_sessions: [{ id: 'as1', program_id: 'p1', token: 'tok' }],
  attendance_records: [{ id: 'ar1', session_id: 'as1', full_name: 'x', identity_key: 'k' }],
  certificates: [], impact_assessments: [], behavior_followups: [],
  outcome_kpis: [{ id: 'k1', program_id: 'p2' }], outcome_measurements: [{ id: 'm1', kpi_id: 'k1', value: 7 }],
  remote_learning_survey_responses: [], trainer_awards: [{ id: 'w1', trainer_id: 't1' }],
});

test('backup: catalog covers core tables and counts/total', () => {
  const t = CATALOG.map(c => c.table);
  for (const need of ['programs', 'classrooms', 'questions', 'evaluations', 'evaluation_answers', 'certificates', 'behavior_followups', 'outcome_kpis']) assert.ok(t.includes(need), need);
  const c = counts(data()); assert.equal(c.programs, 2); assert.equal(c.certificates, 0); assert.equal(totalRows(data()), 25);
});

test('backup: scopeToProgram follows relations (classroom, evaluation, session, kpi, templates)', () => {
  const s = scopeToProgram(data(), 'p1');
  assert.deepEqual(s.programs.map(p => p.id), ['p1']);
  assert.deepEqual(s.classrooms.map(c => c.id), ['c1']);
  assert.deepEqual(s.class_schedules.map(x => x.id), ['s1']);
  assert.deepEqual(s.evaluations.map(e => e.id), ['e1']);
  assert.deepEqual(s.evaluation_answers.map(a => a.id).sort(), ['a1', 'a2']);
  assert.deepEqual(s.attendance_records.map(a => a.id), ['ar1']);
  assert.deepEqual(s.trainers.map(t => t.id), ['t1']);
  assert.deepEqual(s.evaluation_templates.map(t => t.id), ['d']);
  assert.deepEqual(s.questions.map(q => q.id), ['q1', 'q2']);
  assert.equal(s.outcome_measurements.length, 0); assert.equal(s.trainer_awards.length, 0);
  const s2 = scopeToProgram(data(), 'p2'); assert.deepEqual(s2.outcome_measurements.map(m => m.id), ['m1']); assert.equal(s2.evaluation_answers.length, 1);
});

test('backup: columnsOf hides sensitive/technical columns, id first', () => {
  const cols = columnsOf(data().evaluations, ['respondent_hash']);
  assert.equal(cols[0], 'id'); assert.ok(!cols.includes('respondent_hash'));
  assert.ok(!columnsOf(data().programs).includes('organization_id'));
  assert.ok(columnsOf(data().evaluations).includes('submitted_at'), 'union of keys across rows');
});

test('backup: wideAnswers = one row per evaluation, one column per used question', () => {
  const sh = wideAnswers(data());
  assert.equal(sh.rows.length, 3);
  const head = sh.rows[0]; assert.deepEqual(head.slice(0, 6), ['التقييم', 'البرنامج', 'القاعة', 'النوع', 'التاريخ', 'المتوسط']);
  assert.deepEqual(head.slice(6), ['وضوح الشرح', 'ملاحظات', 'ختامي']);
  const r1 = sh.rows[1]; assert.equal(r1[1], 'التفويض'); assert.equal(r1[2], 'A-1'); assert.equal(r1[4], '2026-10-20'); assert.equal(r1[6], 5); assert.equal(r1[7], 'ممتاز'); assert.equal(r1[8], null);
  const r2 = sh.rows[2]; assert.equal(r2[4], '2026-04-30'); assert.equal(r2[8], 3);
});

test('backup: buildSheets → manifest first, wide answers, then non-empty tables; valid xlsx zip', () => {
  const d = data(); const m = manifest(d, 'all', 'كل البيانات', NOW);
  assert.equal(m.total_rows, 25); assert.equal(m.tables.certificates, 0); assert.equal(m.generated_at, NOW.toISOString());
  const sheets = buildSheets(d, m);
  assert.equal(sheets[0].name, 'الفهرس'); assert.equal(sheets[1].name, 'الإجابات المفكوكة');
  assert.ok(sheets.some(s => s.name === 'التقييمات')); assert.ok(!sheets.some(s => s.name === 'الشهادات'), 'empty tables skipped');
  const evalSheet = sheets.find(s => s.name === 'التقييمات')!; assert.ok(!(evalSheet.rows[0] as string[]).includes('respondent_hash'));
  const bytes = buildXlsx(sheets); assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); assert.ok(bytes.length > 2000);
  const sessions = sheets.find(s => s.name === 'جلسات الحضور')!; assert.ok(!(sessions.rows[0] as string[]).includes('token'));
});

test('backup: json payload keeps sensitive columns + manifest; filenames', () => {
  const d = data(); const m = manifest(d, 'program:p1', 'التفويض', NOW);
  const j = JSON.parse(jsonPayload(d, m));
  assert.equal(j.manifest.scope, 'program:p1'); assert.equal(j.data.evaluations[0].respondent_hash, 'secret');
  assert.equal(backupFilename('all', 'xlsx', NOW), 'backup_full_2026-10-23.xlsx');
  assert.equal(backupFilename('برنامج التفويض 2026', 'json', NOW), 'backup_برنامج-التفويض-2026_2026-10-23.json');
});

test('backup: status thresholds (none / ok / >30 days warn)', () => {
  assert.equal(backupStatus(null, true, NOW).status, 'warn'); assert.equal(backupStatus(null, false, NOW).status, 'none');
  assert.equal(backupStatus('2026-10-23T01:00:00Z', true, NOW).label, 'آخر نسخة اليوم');
  assert.equal(backupStatus('2026-10-01T00:00:00Z', true, NOW).status, 'ok');
  const w = backupStatus('2026-09-01T00:00:00Z', true, NOW); assert.equal(w.status, 'warn'); assert.equal(w.days, 52);
  assert.equal(daysSince('bad', NOW), null);
});

test('archive: candidates = completed or ended >90d, not archived; split', () => {
  const ps = [
    { id: '1', name_ar: 'a', status: 'ACTIVE', end_date: '2026-11-01' },
    { id: '2', name_ar: 'b', status: 'COMPLETED', end_date: '2026-10-01' },
    { id: '3', name_ar: 'c', status: 'DRAFT', end_date: '2026-06-01' },
    { id: '4', name_ar: 'd', status: 'COMPLETED', end_date: '2026-01-01', archived_at: '2026-09-01T00:00:00Z' },
    { id: '5', name_ar: 'e', status: 'ACTIVE', end_date: null },
  ];
  assert.deepEqual(archiveCandidates(ps, '2026-10-23').map(p => p.id), ['2', '3']);
  const sp = splitArchive(ps); assert.equal(sp.active.length, 4); assert.deepEqual(sp.archived.map(p => p.id), ['4']);
});

import { evaluateHealth, healthAlerts } from '../lib/health/model';
import type { HealthRaw } from '../lib/health/model';
const rawHealth = (backup?: HealthRaw['backup']): HealthRaw => ({
  now: NOW.toISOString(), env: { NEXT_PUBLIC_SUPABASE_URL: true, NEXT_PUBLIC_SUPABASE_ANON_KEY: true, SUPABASE_SERVICE_ROLE_KEY: true, CRON_SECRET: true, RESEND_API_KEY: true, REPORTS_FROM_EMAIL: true },
  db: { ok: true, latencyMs: 100 }, crons: { followups: NOW.toISOString(), digest: NOW.toISOString(), notificationScan: NOW.toISOString() },
  mail7d: { trainee_ok: 1, trainee_failed: 0, reports: 1, certificates_sent: 0, certificates_failed: 0 },
  counts: { programs: 5, programs_active: 2, classrooms: 3, trainers: 2, questions: 10, evaluations: 100, evaluations_7d: 5, subscriptions_active: 1, open_notifications: 0, critical_notifications: 0, profiles: 4, profiles_no_role: 0, audit_rows: 10, outcome_kpis: 1, certificates: 1 } as any,
  integrity: { active_programs_without_rooms: [], rooms_without_trainer: [], trainers_without_rooms: [], active_programs_silent_14d: [], programs_ended_still_active: [] },
  ai: { configured: false, provider: '' }, backup, errors: [],
});

test('health: backup check — absent before SQL, ok ≤30d, warn >30d raises bell alert', () => {
  assert.ok(!evaluateHealth(rawHealth(undefined)).some(c => c.id === 'data:backup'));
  const ok = evaluateHealth(rawHealth({ last: '2026-10-10T00:00:00Z', rows: 1200 })).find(c => c.id === 'data:backup')!;
  assert.equal(ok.status, 'ok'); assert.match(ok.detail, /منذ 13 يومًا/); assert.equal(ok.href, '/admin/backup');
  const warnChecks = evaluateHealth(rawHealth({ last: '2026-08-01T00:00:00Z', rows: 900 }));
  const w = warnChecks.find(c => c.id === 'data:backup')!; assert.equal(w.status, 'warn'); assert.ok(w.hint);
  assert.ok(healthAlerts(warnChecks).some(a => a.dedupe_key === 'health:data:backup' && a.severity === 'warn'));
  const never = evaluateHealth(rawHealth({ last: null, rows: null })).find(c => c.id === 'data:backup')!; assert.equal(never.status, 'warn'); assert.equal(never.detail, 'لم تُؤخذ نسخة بعد');
  assert.ok(!healthAlerts(ok ? evaluateHealth(rawHealth({ last: '2026-10-10T00:00:00Z', rows: 1 })) : []).some(a => a.dedupe_key === 'health:data:backup'));
});
