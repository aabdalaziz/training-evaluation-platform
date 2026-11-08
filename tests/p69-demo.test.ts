// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P69 «غرفة العرض» — اختبارات الوحدة: النصّ الثابت · المولّد الحتمي · المحو من البيان فقط وبترتيب التبعيات · الخطوة التالية · الحالة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PATH, DEMO_VOICES_AR, DEMO_PROGRAMS, DEMO_POLICY, DEMO_ORG, pathWith, pathText, rng, bandOf, trainingNo, presenterNo, dayIso, DEMO_LEARNERS, DEMO_PRESENTERS } from '../lib/demo/script';
import { destroyManifest, nextStep, STEP_ORDER, STEPS_AR, DESTROY_ORDER, staleDays, presenterCards, type Manifest, type RunRow } from '../lib/demo/build';

const M = (): Manifest => ({ org_id: 'org-x', user_ids: ['u1', 'u2'], member_ids: ['m1'], program_ids: ['p1'], classroom_ids: ['c1'], enrollment_ids: ['e1', 'e2'], attendance_session_ids: ['as1'], assessment_ids: ['ia1'], followup_ids: ['bf1'], evaluation_ids: ['ev1'], line_ids: [7], invite_ids: ['inv1', 'inv2'], form_ids: ['f1', 'f2'], session_ids: ['s1', 's2'], report_codes: ['ATH-LR-AAAA-AAAA'], seal_codes: [], emails: [] });

/** قاعدة مزيّفة تسجّل كل حذف (الجدول · العمود · المعرّفات) وتردّ على الاستعلامات القليلة التي يحتاجها المحو */
function fakeDb(extra: { sessionsOnInvite?: string[]; formsOnInvite?: string[]; enrollmentsOnProgram?: string[]; strayOrgs?: string[] } = {}) {
  const deletes: Array<{ table: string; col: string; ids: Array<string | number> }> = []; const deletedUsers: string[] = [];
  const db: any = {
    from(table: string) {
      const q: any = { _op: 'select', _f: {} as Record<string, unknown> };
      q.select = () => q; q.delete = () => { q._op = 'delete'; return q; }; q.update = () => { q._op = 'update'; return q; }; q.limit = () => q; q.order = () => q; q.maybeSingle = () => q; q.single = () => q;
      q.eq = (c: string, v: unknown) => { q._f[c] = v; return q; };
      q.in = (c: string, ids: Array<string | number>) => { if (q._op === 'delete') { deletes.push({ table, col: c, ids: [...ids] }); q._del = ids; } q._f[c] = ids; return q; };
      q.then = (res: (v: any) => void) => {
        if (q._op === 'delete') return res({ data: (q._del || []).map((id: any) => ({ id })), error: null });
        if (table === 'placement_secure_sessions') return res({ data: (extra.sessionsOnInvite || []).map((id) => ({ id })), error: null });
        if (table === 'question_bank_forms') return res({ data: (extra.formsOnInvite || []).map((id) => ({ id })), error: null });
        if (table === 'portal_enrollments') return res({ data: (extra.enrollmentsOnProgram || []).map((id) => ({ id })), error: null });
        if (table === 'portal_organizations') return res({ data: (extra.strayOrgs || []).map((id) => ({ id })), error: null });
        return res({ data: [], error: null });
      };
      return q;
    },
    auth: { admin: { deleteUser: async (id: string) => { deletedUsers.push(id); return { data: {}, error: null }; } } },
  };
  return { db, deletes, deletedUsers };
}

test('P69 script: 9 stations in fixed order · placeholders resolved · text carries site + say/open/see', () => {
  assert.equal(DEMO_PATH.length, 9); assert.deepEqual(DEMO_PATH.map((s) => s.no), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(DEMO_PATH.some((s) => s.title_ar === 'اللجنة تقرّر'), 'المحطّة 8 «اللجنة تقرّر»');
  const p = pathWith(DEMO_PATH, { form: 'ATH-FM-ABCD-EFGH', report: null });
  assert.equal(p[4].href, '/verify/form?code=ATH-FM-ABCD-EFGH'); assert.ok(!p.some((s) => s.href.includes('<')), 'لا عناصر نائبة بعد الاستبدال');
  const t = pathText(p, 'https://athar-portal.vercel.app'); assert.ok(t.includes('https://athar-portal.vercel.app/enter?o=region-x') && t.includes('قل:') && t.includes('سيرون:'));
  assert.equal(DEMO_VOICES_AR.length, 12); for (const v of DEMO_VOICES_AR) { assert.ok(v.body.length >= 20 && v.body.length <= 120); assert.ok(!/[A-Za-z]|@/.test(v.body), 'لا لاتينية ولا بريد في الأصوات'); }
  assert.ok(DEMO_ORG.name_ar.includes('افتراضية'), 'الاسم نفسه يحمل الوسم'); assert.equal(DEMO_POLICY.pseudonymous, true); assert.equal(DEMO_POLICY.kiosk_minutes, 20);
});

test('P69 programs/roster: 36 learners cover RX-0001…0036 exactly once in A+B · C re-uses 13…24 · dates relative (A finished · B running · C upcoming)', () => {
  const seen = new Map<number, string[]>();
  for (const p of DEMO_PROGRAMS) for (const c of p.classrooms) for (let i = c.learners[0]; i <= c.learners[1]; i++) seen.set(i, [...(seen.get(i) || []), p.key]);
  assert.equal(seen.size, DEMO_LEARNERS); for (let i = 1; i <= 36; i++) assert.ok(seen.has(i), `RX-${i}`);
  const ab = [...seen.entries()].filter(([, ks]) => ks.includes('A') || ks.includes('B')); assert.equal(ab.length, 36); assert.ok(ab.every(([, ks]) => ks.filter((k) => k !== 'C').length === 1));
  const [A, B, C] = DEMO_PROGRAMS; assert.ok(A.end < 0 && B.start < 0 && B.end > 0 && C.start > 0);
  assert.equal(trainingNo(7), 'RX-0007'); assert.equal(presenterNo(1), 'RX-P01'); assert.equal(DEMO_PRESENTERS, 5);
  const anchor = new Date('2026-11-08T00:00:00Z'); assert.equal(dayIso(anchor, A.end), '2026-09-29'); assert.equal(dayIso(anchor, 0), '2026-11-08');
});

test('P69 rng is deterministic per seed · bands cycle weak/mid/mid/strong', () => {
  const a = rng('athar-demo:2026-11-08'); const b = rng('athar-demo:2026-11-08'); const c = rng('athar-demo:2026-11-09');
  const xa = [a(), a(), a()], xb = [b(), b(), b()], xc = [c(), c(), c()]; assert.deepEqual(xa, xb); assert.notDeepEqual(xa, xc); for (const x of xa) assert.ok(x >= 0 && x < 1);
  assert.deepEqual([1, 2, 3, 4, 5].map((i) => bandOf(i).name), ['mid', 'mid', 'strong', 'weak', 'mid']);
  assert.equal(bandOf(4).p, 0.35); assert.equal(bandOf(3).p, 0.85);
});

test('P69 nextStep walks STEP_ORDER by ok entries only · labels exist for all steps', () => {
  assert.equal(nextStep([]), 'org'); assert.equal(nextStep([{ at: '', step: 'org', ok: true }]), 'codes');
  assert.equal(nextStep([{ at: '', step: 'org', ok: true }, { at: '', step: 'codes', ok: false }]), 'codes', 'فشل لا يُعدّ إنجازًا');
  assert.equal(nextStep(STEP_ORDER.map((k) => ({ at: '', step: k, ok: true }))), null);
  for (const k of STEP_ORDER) assert.ok(STEPS_AR[k], k); assert.equal(STEP_ORDER.length, 11);
});

test('P69 destroyManifest deletes ONLY manifest ids, in dependency order (sessions before invites, codes/members before org, org last)', async () => {
  const { db, deletes, deletedUsers } = fakeDb(); const m = M();
  const counts = await destroyManifest(db, m);
  const order = deletes.map((d) => d.table); const pos = (t: string) => order.indexOf(t);
  assert.ok(pos('placement_secure_answers') < pos('placement_secure_sessions') && pos('placement_secure_sessions') < pos('placement_invites'));
  assert.ok(pos('question_bank_form_items') < pos('question_bank_forms') && pos('question_bank_forms') < pos('placement_invites'));
  assert.ok(pos('evaluation_answers') < pos('evaluations') && pos('attendance_records') < pos('attendance_sessions') && pos('portal_enrollments') < pos('programs') && pos('classrooms') < pos('programs'));
  assert.ok(pos('portal_org_codes') < pos('portal_organizations') && pos('portal_org_members') < pos('portal_organizations') && pos('portal_org_reports') < pos('portal_organizations'));
  assert.equal(order[order.length - 1], 'portal_organizations');
  for (const d of deletes) { const allowed = new Set<string | number>([...m.session_ids, ...m.invite_ids, ...m.form_ids, ...m.evaluation_ids, ...m.followup_ids, ...m.assessment_ids, ...m.attendance_session_ids, ...m.line_ids, ...m.user_ids, ...m.enrollment_ids, ...m.classroom_ids, ...m.program_ids, m.org_id!]); for (const id of d.ids) assert.ok(allowed.has(id), `${d.table}.${d.col} حذف معرّفًا خارج البيان: ${id}`); }
  assert.deepEqual(deletedUsers, ['u1', 'u2']); assert.equal(counts['auth.users'], 2); assert.equal(counts['portal_organizations'], 1);
  for (const t of DESTROY_ORDER) if (t !== 'auth.users') assert.ok(order.includes(t), `الجدول ${t} في ترتيب المحو`);
});

test('P69 destroyManifest also sweeps what the committee created during the show (sessions on demo invites · enrollments on demo programs) — still only via manifest anchors', async () => {
  const { db, deletes } = fakeDb({ sessionsOnInvite: ['s1', 's9'], formsOnInvite: ['f1', 'f3'], enrollmentsOnProgram: ['e1', 'e9'] });
  await destroyManifest(db, M());
  const ids = (t: string) => deletes.filter((d) => d.table === t).flatMap((d) => d.ids);
  assert.ok(ids('placement_secure_sessions').includes('s9') && ids('question_bank_forms').includes('f3') && ids('portal_enrollments').includes('e9'));
  assert.equal(ids('placement_secure_sessions').filter((x) => x === 's1').length, 1, 'لا حذف مكرّر لجلسة البيان');
});

test('P69 empty manifest deletes nothing · staleDays · presenter cards carry enter url and org name', async () => {
  const { db, deletes, deletedUsers } = fakeDb();
  await destroyManifest(db, { user_ids: [], member_ids: [], program_ids: [], classroom_ids: [], enrollment_ids: [], attendance_session_ids: [], assessment_ids: [], followup_ids: [], evaluation_ids: [], line_ids: [], invite_ids: [], form_ids: [], session_ids: [], report_codes: [], seal_codes: [], emails: [] });
  assert.equal(deletes.length, 0); assert.equal(deletedUsers.length, 0);
  const run = { id: 1, slug: 'region-x', status: 'ready', step_ar: null, log: [], manifest: M(), presenters: [{ training_no: 'RX-P01', pin: '482913', role: 'org_admin', label_ar: 'رئيس اللجنة' }, { training_no: 'RX-P02', pin: '112233', role: 'learner', label_ar: 'عارض 2' }], anchor: '2026-11-01', built_by: 'u', built_at: '2026-11-01T06:00:00Z', destroyed_at: null, error_ar: null, created_at: '', updated_at: '' } as unknown as RunRow;
  assert.equal(staleDays(run, new Date('2026-11-09T06:00:00Z')), 8); assert.equal(staleDays(null), null);
  const cards = presenterCards(run, 'https://athar-portal.vercel.app'); assert.equal(cards.length, 2); assert.equal(cards[0].enter_url, 'https://athar-portal.vercel.app/enter?o=region-x'); assert.ok(cards[0].org_ar.includes('المنطقة س')); assert.ok(cards[0].note_ar.includes('القرار'));
});
