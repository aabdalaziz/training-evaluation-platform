// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P77 «المكنسة» — البصمة · الاقتراحات · الحذف بحماية النتائج وتأكيد العدد · الجلسات المعلّقة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestInvite, inviteFootprint, cleanupSuggestions, purgeInvites, purgeOrphanSessions } from '../lib/miaar/cleanup';

const ADMIN = { id: 'u1', email: 'a@athar', role: 'PLATFORM_ADMIN' }; const STAFF = { id: 'u2', email: 's@athar', role: 'INSTRUCTOR' };

test('التجريبية تُكتشف من الاسم/الغرض/الملاحظة', () => {
  assert.ok(isTestInvite({ label_ar: 'دعوة تجريبية', purpose: null, note: null } as any));
  assert.ok(isTestInvite({ label_ar: 'Cohort', purpose: 'demo', note: null } as any));
  assert.ok(!isTestInvite({ label_ar: 'الانغماس اللغوي — فرنسا', purpose: 'placement', note: null } as any));
});

/** قاعدة وهمية: جداول في الذاكرة مع eq/in/neq/lt/is/delete/update/count */
function fakeDb(tables: Record<string, any[]>) {
  const deleted: Array<{ table: string; f: any }> = []; const audits: any[] = [];
  const db: any = { _deleted: deleted, _audits: audits, storage: { from: () => ({ remove: async () => ({}) }) },
    from(table: string) {
      const q: any = { _f: [] as Array<[string, string, any]>, _op: 'select', _patch: null as any, _count: false,
        select(_c?: string, o?: any) { q._count = !!o?.head; return q; }, limit() { return q; }, order() { return q; },
        eq(k: string, v: any) { q._f.push([k, 'eq', v]); return q; }, neq(k: string, v: any) { q._f.push([k, 'neq', v]); return q; }, lt(k: string, v: any) { q._f.push([k, 'lt', v]); return q; }, is(k: string, v: any) { q._f.push([k, 'is', v]); return q; }, in(k: string, v: any[]) { q._f.push([k, 'in', v]); return q; },
        delete() { q._op = 'delete'; return q; }, update(p: any) { q._op = 'update'; q._patch = p; return q; },
        insert(row: any) { (tables[table] ||= []).push(row); if (table === 'audit_logs') audits.push(row); return Promise.resolve({ error: null }); },
        _rows() { return (tables[table] || []).filter((r) => q._f.every(([k, op, v]: any) => op === 'eq' ? r[k] === v : op === 'neq' ? r[k] !== v : op === 'lt' ? r[k] < v : op === 'is' ? r[k] == v : op === 'in' ? v.includes(r[k]) : true)); },
        _run() { const rows = q._rows(); if (q._op === 'delete') { deleted.push({ table, f: q._f }); tables[table] = (tables[table] || []).filter((r: any) => !rows.includes(r)); return { data: null, error: null }; } if (q._op === 'update') { rows.forEach((r: any) => Object.assign(r, q._patch)); return { data: null, error: null }; } return q._count ? { count: rows.length, error: null } : { data: rows, error: null }; },
        maybeSingle: async () => ({ data: q._rows()[0] || null }),
        then(res: any, rej?: any) { return Promise.resolve(q._run()).then(res, rej); },
      };
      return q;
    },
  };
  return db;
}
const seed = () => ({
  placement_invites: [
    { id: 'i-test', code: 'TEST01', label_ar: 'دعوة تجريبية', kind: 'group', status: 'open', purpose: null, note: null, expires_at: null, created_at: '2026-10-01T00:00:00Z' },
    { id: 'i-old', code: 'OLD001', label_ar: 'دفعة قديمة', kind: 'personal', status: 'closed', purpose: 'placement', note: null, expires_at: '2026-10-15T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
    { id: 'i-res', code: 'RES001', label_ar: 'دفعة بنتائج', kind: 'group', status: 'closed', purpose: 'placement', note: null, expires_at: '2026-10-15T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
    { id: 'i-live', code: 'XZ89FDXX', label_ar: 'الانغماس اللغوي — فرنسا', kind: 'personal', status: 'open', purpose: 'placement', note: null, expires_at: '2026-12-03T00:00:00Z', created_at: '2026-11-25T00:00:00Z' },
  ],
  placement_invite_recipients: [{ id: 'r1', invite_id: 'i-old', report_id: null }, { id: 'r2', invite_id: 'i-live', report_id: null }],
  placement_secure_sessions: [{ id: 's1', invite_id: 'i-test', status: 'abandoned', created_at: '2026-10-02T00:00:00Z' }, { id: 's2', invite_id: 'i-res', status: 'completed', created_at: '2026-10-05T00:00:00Z' }, { id: 's3', invite_id: null, status: 'expired', created_at: '2026-09-01T00:00:00Z' }, { id: 's4', invite_id: null, status: 'active', created_at: '2026-11-24T00:00:00Z' }],
  placement_secure_answers: [{ session_id: 's1', question_id: 'q1' }, { session_id: 's3', question_id: 'q1' }],
  placement_reports: [{ id: 'p1', invite_id: 'i-res', submission_id: 's2', candidate_email: 'x@y.com', access_code: 'ML-1', created_at: '2026-10-05T00:00:00Z' }],
  miaar_service_orders: [], miaar_performances: [], placement_decisions: [], test_retake_approvals: [], portal_sessions: [], miaar_witness_events: [], portal_enrollments: [], portal_placements: [], audit_logs: [],
});
const NOW = new Date('2026-11-25T12:00:00Z');

test('البصمة: أعداد المستلمين/الجلسات/النتائج لكل دعوة + وسم التجريبية', async () => {
  const fp = await inviteFootprint(fakeDb(seed()), ['i-test', 'i-res', 'i-live']);
  const by = Object.fromEntries(fp.map((f) => [f.id, f]));
  assert.equal(by['i-test'].test, true); assert.equal(by['i-test'].sessions, 1); assert.equal(by['i-test'].reports, 0);
  assert.equal(by['i-res'].reports, 1); assert.equal(by['i-live'].recipients, 1); assert.equal(by['i-live'].test, false);
});

test('الاقتراحات: التجريبية · المغلقة/المنتهية بلا نتائج (لا تشمل ما له نتائج ولا الحيّة) · الجلسات المعلّقة · النتائج اليتيمة', async () => {
  const sg = await cleanupSuggestions(fakeDb(seed()), { now: NOW });
  assert.deepEqual(sg.test, ['i-test']); assert.deepEqual(sg.stale, ['i-old']);
  assert.equal(sg.orphan_sessions, 2, 's1 و s3 غير مكتملتين وقديمتان؛ s2 مكتملة وs4 حديثة مستثنيتان'); assert.equal(sg.orphan_reports, 0);
});

test('الحذف: غير المدير يُرفض · أكثر من واحدة تحتاج العدد · ما له نتائج يُتخطّى بلا «مع النتائج» · التسلسل يحذف الجلسات والإجابات ويسجّل التدقيق', async () => {
  const t = seed(); const db = fakeDb(t);
  const noRole = await purgeInvites(db, ['i-test'], STAFF); assert.equal(noRole.ok, false);
  const noConfirm = await purgeInvites(db, ['i-test', 'i-old'], ADMIN, { confirm: '' }); assert.equal(noConfirm.ok, false);
  const r = await purgeInvites(db, ['i-test', 'i-old', 'i-res'], ADMIN, { confirm: '3' }); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.deleted, 2); assert.equal(r.skipped.length, 1); assert.equal(r.skipped[0].code, 'RES001'); assert.ok(r.skipped[0].reason.includes('مع النتائج'));
  assert.ok(!t.placement_invites.find((i) => i.id === 'i-test') && !t.placement_invites.find((i) => i.id === 'i-old') && t.placement_invites.find((i) => i.id === 'i-res'));
  assert.ok(!t.placement_secure_sessions.find((s) => s.id === 's1'), 'جلسة الدعوة التجريبية حُذفت'); assert.ok(!t.placement_secure_answers.find((a) => a.session_id === 's1'));
  assert.equal(db._audits.filter((a: any) => a.action === 'miaar_invite_delete').length, 2);
  const r2 = await purgeInvites(db, ['i-res'], ADMIN, { with_results: true }); assert.ok(r2.ok); if (!r2.ok) return;
  assert.equal(r2.deleted, 1); assert.equal(r2.reports, 1); assert.ok(!t.placement_reports.length, 'النتيجة حُذفت عبر deleteReports'); assert.ok(!t.placement_secure_sessions.find((s) => s.id === 's2'));
  assert.ok(t.placement_invites.find((i) => i.id === 'i-live'), 'الدعوة الحيّة لم تُمسّ');
});

test('الجلسات المعلّقة: تُمسح غير المكتملة الأقدم من N يومًا فقط', async () => {
  const t = seed(); const db = fakeDb(t);
  const r = await purgeOrphanSessions(db, ADMIN, 30, NOW); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.n, 2, 's1 و s3'); assert.ok(t.placement_secure_sessions.find((s) => s.id === 's2') && t.placement_secure_sessions.find((s) => s.id === 's4'));
  assert.equal((await purgeOrphanSessions(db, STAFF, 30, NOW)).ok, false);
});
