import test from 'node:test';
import assert from 'node:assert/strict';
import { describe, changeList, filterRows, auditStats, auditCsv, actionLabel, entityLabel, fmtVal } from '../lib/audit/model';
import type { AuditRow } from '../lib/audit/model';

const rows: AuditRow[] = [
  { id: '1', created_at: '2026-10-20T08:00:00Z', actor_id: 'u1', actor_email: 'a@x.sa', actor_role: 'ADMIN', action: 'UPDATE', entity_type: 'programs', entity_id: 'p1', entity_label: 'برنامج أ', changes: { status: { from: 'DRAFT', to: 'ACTIVE' }, end_date: { from: '2026-11-01', to: '2026-12-01' } }, source: 'db' },
  { id: '2', created_at: '2026-10-21T08:00:00Z', actor_id: 'u1', actor_email: 'a@x.sa', action: 'INSERT', entity_type: 'trainers', entity_id: 't9', entity_label: 'سعد', after_data: { id: 't9', name: 'سعد', email: 's@x.sa', is_active: true, created_at: 'x' }, source: 'db' },
  { id: '3', created_at: '2026-10-22T08:00:00Z', actor_id: null, action: 'report_digest', entity_type: 'report', metadata: { report: 'weekly', to: ['a@x.sa', 'b@x.sa'] }, source: 'cron' },
  { id: '4', created_at: '2026-10-22T09:00:00Z', actor_id: 'u2', actor_email: 'q@x.sa', action: 'DELETE', entity_type: 'classrooms', entity_id: 'c3', entity_label: 'B-1', before_data: { id: 'c3', code: 'B-1', capacity: 20 }, source: 'db' },
  { id: '5', created_at: '2026-10-23T09:00:00Z', actor_id: 'u2', actor_email: 'q@x.sa', action: 'PURGE_EVALUATIONS', entity_type: 'evaluations', metadata: { kind: 'DAILY', deleted_evaluations: 120 }, source: 'app' },
];

test('audit describe() produces Arabic sentences per action', () => {
  assert.equal(describe(rows[0]), 'a@x.sa عدّل برنامج «برنامج أ» (2 حقول: الحالة، تاريخ النهاية)');
  assert.equal(describe(rows[1]), 'a@x.sa أنشأ مدرب «سعد»');
  assert.equal(describe(rows[2]), 'الكرون أرسل التقرير الدوري «weekly» إلى 2 مشترك');
  assert.equal(describe(rows[3]), 'q@x.sa حذف قاعة/شعبة «B-1»');
  assert.equal(describe(rows[4]), 'q@x.sa فرّغ 120 تقييمًا (DAILY)');
  assert.equal(actionLabel('UPDATE'), 'تعديل'); assert.equal(entityLabel('zzz'), 'zzz'); assert.equal(entityLabel(null), '—');
});

test('audit changeList(): diffs for UPDATE, snapshot for INSERT/DELETE, metadata for app events', () => {
  const u = changeList(rows[0]); assert.equal(u.length, 2); assert.deepEqual(u[0], { field: 'status', label: 'الحالة', from: 'DRAFT', to: 'ACTIVE' });
  const i = changeList(rows[1]); assert.ok(i.every(c => c.from === '—')); assert.equal(i[0].label, 'الاسم'); assert.ok(!i.find(c => c.field === 'id' || c.field === 'created_at'));
  const d = changeList(rows[3]); assert.ok(d.every(c => c.to === '—')); assert.equal(d.find(c => c.field === 'capacity')?.from, '20');
  const m = changeList(rows[4]); assert.equal(m.find(c => c.field === 'deleted_evaluations')?.to, '120');
  assert.equal(fmtVal(true), 'نعم'); assert.equal(fmtVal(null), '—'); assert.equal(fmtVal(3.14159), '3.14'); assert.equal(fmtVal('x'.repeat(100)).length, 78);
});

test('audit filterRows() + auditStats() + csv', () => {
  assert.equal(filterRows(rows, { action: 'UPDATE' }).length, 1);
  assert.equal(filterRows(rows, { action: 'APP' }).length, 2);
  assert.equal(filterRows(rows, { entity: 'classrooms' }).length, 1);
  assert.equal(filterRows(rows, { actor: 'system' }).length, 1);
  assert.equal(filterRows(rows, { source: 'cron' }).length, 1);
  assert.equal(filterRows(rows, { from: '2026-10-22', to: '2026-10-22' }).length, 2);
  assert.equal(filterRows(rows, { q: 'b-1' }).length, 1);
  assert.equal(filterRows(rows, { q: 'تاريخ النهاية' }).length, 1);
  const s = auditStats(rows); assert.equal(s.total, 5); assert.equal(s.inserts, 1); assert.equal(s.updates, 1); assert.equal(s.deletes, 1); assert.equal(s.app, 2); assert.equal(s.actors, 3);
  assert.equal(s.byDay[0].day, '2026-10-20'); assert.equal(s.byDay.find(d => d.day === '2026-10-22')?.n, 2);
  const csv = auditCsv(rows); assert.equal(csv.length, 6); assert.equal(csv[0].length, 10); assert.ok(csv[1][9].includes('الحالة: DRAFT → ACTIVE'));
});
