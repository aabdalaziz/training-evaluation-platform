// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م5-أ «سجلّ مِعيار» — مستويات التقرير · المنطقة الرمادية · المهلة · أرقام المحاولات · تأكيد الحذف الجماعي · CSV · المرشّح · الأسماء · القرار بالمحاكاة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportLevels, grayZone, deadlineFor, isDue, attemptNumbers, bulkConfirmOk, ledgerCsv, parseFilter, LEDGER_LEVELS, LEVEL_AR, DELETE_ROLES, DEFAULT_DEADLINE_HOURS, isLedgerLevel, decidePlacement, autoPlaceDue, archiveReports, deleteReports } from '../lib/miaar/ledger';
import { reasonLabel } from '../lib/miaar/registry';
import { crumbsFor } from '../lib/portal/way';
import { DESTINATIONS } from '../lib/portal/voice';

const rep = (over: Record<string, unknown> = {}) => ({ بيانات_المتقدم: { الاسم: 'سارة أحمد' }, المستوى_العام: 'B1', النسبة_العامة: 68.4, ملخص_التسكين: { المستوى_المثبت: 'B1', مستوى_الالتحاق_المقترح: 'B2' }, ميزان_الثقة: { الرمز: 'high' }, سبب_الانتهاء: reasonLabel('completed'), النموذج: { الرمز: 'SYS-PLACEMENT' }, ...over });

test('م5-أ: مستويات التقرير — المثبت والالتحاق و«دون A1» والنسبة والنموذج', () => {
  const L = reportLevels(rep()); assert.equal(L.demonstrated, 'B1'); assert.equal(L.entry, 'B2'); assert.equal(L.percent, 68); assert.equal(L.name, 'سارة أحمد'); assert.equal(L.form_code, 'SYS-PLACEMENT'); assert.equal(L.confidence, 'high');
  const P = reportLevels(rep({ ملخص_التسكين: { المستوى_المثبت: 'A1', دون_A1: true } })); assert.equal(P.demonstrated, 'PRE_A1'); assert.equal(P.entry, 'PRE_A1', 'ما قبل A1 التحاقًا أيضًا');
  const E = reportLevels({}); assert.equal(E.demonstrated, 'A1'); assert.equal(E.percent, null); assert.equal(E.name, '—');
  assert.deepEqual([...LEDGER_LEVELS], ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']); assert.equal(LEVEL_AR.PRE_A1, 'ما قبل A1'); assert.ok(isLedgerLevel('C2') && !isLedgerLevel('D1'));
});

test('م5-أ: المنطقة الرمادية — الحدّ والضوء الأحمر وعدم الاكتمال؛ وإلا null', () => {
  assert.equal(grayZone(rep()), null, 'نتيجة نظيفة');
  assert.match(grayZone(rep({ ميزان_الثقة: { الرمز: 'border' } })) || '', /على الحدّ/);
  assert.match(grayZone(rep({ الموثوقية: { الضوء: 'red' } })) || '', /أحمر/);
  assert.match(grayZone(rep({ سبب_الانتهاء: reasonLabel('time') })) || '', /لم يكتمل/);
  assert.match(grayZone(rep({ سبب_الانتهاء: reasonLabel('quit') })) || '', /لم يكتمل/);
  assert.equal(grayZone(rep({ سبب_الانتهاء: reasonLabel('failed') })), null, 'الإيقاف التدرّجي نتيجة مكتملة');
});

test('م5-أ: المهلة — 48 ساعة افتراضًا · null يعطّل · الحدود 1–720', () => {
  const t0 = '2026-11-01T10:00:00.000Z';
  assert.equal(deadlineFor(t0, DEFAULT_DEADLINE_HOURS), '2026-11-03T10:00:00.000Z'); assert.equal(DEFAULT_DEADLINE_HOURS, 48);
  assert.equal(deadlineFor(t0, null), null, 'معطّل'); assert.equal(deadlineFor(t0, 0), '2026-11-01T11:00:00.000Z', 'الحدّ الأدنى ساعة'); assert.equal(deadlineFor(t0, 9999), '2026-12-01T10:00:00.000Z', 'الحدّ الأعلى 720');
  assert.equal(isDue('2026-11-03T10:00:00.000Z', '2026-11-03T10:00:00.000Z'), true); assert.equal(isDue('2026-11-03T10:00:00.000Z', '2026-11-03T09:59:59.000Z'), false); assert.equal(isDue(null), false);
});

test('م5-أ: أرقام المحاولات بالبريد (الأقدم = 1) وتأكيد الحذف الجماعي بكتابة العدد', () => {
  const m = attemptNumbers([{ id: 'b', email: 'A@x.com', taken_at: '2026-02-01' }, { id: 'a', email: 'a@x.com', taken_at: '2026-01-01' }, { id: 'c', email: 'z@x.com', taken_at: '2026-01-05' }]);
  assert.equal(m.get('a'), 1); assert.equal(m.get('b'), 2, 'البريد بلا حساسية حالة'); assert.equal(m.get('c'), 1);
  assert.equal(bulkConfirmOk(3, '3'), true); assert.equal(bulkConfirmOk(3, ' 3 '), true); assert.equal(bulkConfirmOk(3, '2'), false); assert.equal(bulkConfirmOk(0, '0'), false); assert.equal(bulkConfirmOk(2, undefined), false);
  assert.deepEqual(DELETE_ROLES, ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'], 'الحذف لمدير النظام فقط');
});

test('م5-أ: CSV — BOM وترويسة عربية وتهريب الفواصل والاقتباس', () => {
  const csv = ledgerCsv([{ id: '1', email: 'a@x.com', name: 'سارة, أحمد', taken_at: '2026-11-01T10:00:00Z', code: 'ML-1', demonstrated: 'B1', entry: 'B2', percent: 68, confidence: 'high', form_code: 'F"1', invite_id: null, invite_label: null, group_tag: 'g', archived_at: null, previous_report_id: null, attempt: 2, gray: null, decision: { level: 'B2', status: 'approved', source: 'auto', program_id: 'p', program_name: 'برنامج', classroom: 'شعبة 1', decided_at: '2026-11-03', deadline_at: null, gray_reason: null, note: null }, deadline_at: null, retake_open: false }]);
  assert.ok(csv.startsWith('\uFEFF'), 'BOM'); const lines = csv.split('\r\n'); assert.equal(lines.length, 2); assert.ok(lines[0].slice(1).startsWith('التاريخ,الاسم,البريد,المحاولة'));
  assert.ok(lines[1].includes('"سارة, أحمد"'), 'الفاصلة داخل الاسم تُقتبس'); assert.ok(lines[1].includes('"F""1"'), 'الاقتباس يُضاعف'); assert.ok(lines[1].includes(',تلقائي,برنامج,شعبة 1,'), 'القرار والبرنامج والشعبة');
});

test('م5-أ: المرشّح — تواريخ اليوم كاملًا · حالة افتراضية نشطة · تنظيف البحث · الحدّ', () => {
  const f = parseFilter(new URLSearchParams('from=2026-11-01&to=2026-11-03&status=archived&decision=review&level=B1&q=A%25B,(c)&limit=5000'));
  assert.equal(f.from, '2026-11-01T00:00:00.000Z'); assert.equal(f.to, '2026-11-03T23:59:59.999Z'); assert.equal(f.status, 'archived'); assert.equal(f.decision, 'review'); assert.equal(f.level, 'B1'); assert.equal(f.q, 'abc', 'تنظيف رموز PostgREST'); assert.equal(f.limit, 500, 'الحدّ الافتراضي عند تجاوز 2000');
  const g = parseFilter({ status: 'weird', level: 'Z9', invite: 'x' }); assert.equal(g.status, 'active'); assert.equal(g.level, null); assert.equal(g.invite_id, null, 'معرّف من حرف واحد يُرفض'); assert.equal(g.decision, 'all');
});

test('م5-أ: المسار الجديد في أسماء الطريق ووجهات «نادِ»', () => {
  assert.equal(crumbsFor('/admin/miaar/ledger').at(-1)?.label, 'السجلّ'); assert.ok(DESTINATIONS.some((d) => d.href === '/admin/miaar/ledger' && d.admin), 'وجهة صوتية للطاقم');
});

/* محاكاة قاعدة صغيرة: تكفي لمسار القرار والتسكين التلقائي والأرشفة والحذف */
function fakeDb() {
  const T: Record<string, any[]> = { placement_reports: [], placement_decisions: [], portal_enrollments: [], programs: [{ id: 'p1', name_ar: 'برنامج B2', cefr_level: 'B2', archived_at: null, registration_open: true, start_date: '2026-12-01', seats: 10, status: 'ACTIVE' }], classrooms: [], placement_invites: [], test_retake_approvals: [], audit_logs: [], portal_placements: [], miaar_performances: [], placement_secure_answers: [], placement_secure_sessions: [], placement_invite_recipients: [], portal_contact_prefs: [], portal_message_log: [] };
  const q = (t: string) => { const st: any = { t, w: [] as any[], order: null, lim: 0, head: false, single: false, op: 'select', patch: null as any };
    const apply = (rows: any[]) => rows.filter((r) => st.w.every((c: any) => c(r)));
    const run = () => { let rows = T[t] || []; if (st.op === 'insert') { const ins = (Array.isArray(st.patch) ? st.patch : [st.patch]).map((r: any, i: number) => ({ id: `${t}-${(T[t] || []).length + i + 1}`, created_at: new Date().toISOString(), ...r })); T[t] = [...(T[t] || []), ...ins]; return { data: st.single ? ins[0] : ins, error: null }; }
      if (st.op === 'upsert') { const r = st.patch; const ex = (T[t] || []).find((x) => x.report_id === r.report_id); if (ex) Object.assign(ex, r); else T[t].push({ id: `${t}-${T[t].length + 1}`, ...r }); return { data: null, error: null }; }
      const m = apply(rows); if (st.op === 'update') { m.forEach((r) => Object.assign(r, st.patch)); return { data: null, error: null }; } if (st.op === 'delete') { T[t] = rows.filter((r) => !m.includes(r)); return { data: null, error: null }; }
      if (st.head) return { count: m.length, data: null, error: null }; let out = m; if (st.order) out = [...out].sort((a, b) => String(a[st.order.k]).localeCompare(String(b[st.order.k])) * (st.order.asc ? 1 : -1)); if (st.lim) out = out.slice(0, st.lim);
      return { data: st.single ? out[0] || null : out, error: null }; };
    const b: any = { select(_s?: string, o?: any) { if (o?.head) st.head = true; return b; }, insert(r: any) { st.op = 'insert'; st.patch = r; return b; }, update(p: any) { st.op = 'update'; st.patch = p; return b; }, upsert(r: any) { st.op = 'upsert'; st.patch = r; return b; }, delete() { st.op = 'delete'; return b; },
      eq(k: string, v: any) { st.w.push((r: any) => String(r[k]) === String(v)); return b; }, neq(k: string, v: any) { st.w.push((r: any) => String(r[k]) !== String(v)); return b; }, in(k: string, vs: any[]) { st.w.push((r: any) => vs.map(String).includes(String(r[k]))); return b; }, is(k: string, v: any) { st.w.push((r: any) => v === null ? r[k] === null || r[k] === undefined : r[k] === v); return b; },
      not(k: string, _o: string, v: any) { st.w.push((r: any) => !(v === null ? r[k] === null || r[k] === undefined : false)); return b; }, ilike(k: string, v: string) { const p = v.replace(/%/g, '').toLowerCase(); st.w.push((r: any) => String(r[k] || '').toLowerCase().includes(p)); return b; }, gte(k: string, v: any) { st.w.push((r: any) => String(r[k]) >= String(v)); return b; }, lte(k: string, v: any) { st.w.push((r: any) => String(r[k]) <= String(v)); return b; }, gt(k: string, v: any) { st.w.push((r: any) => String(r[k]) > String(v)); return b; }, lt(k: string, v: any) { st.w.push((r: any) => String(r[k]) < String(v)); return b; },
      order(k: string, o: any) { st.order = { k, asc: o?.ascending !== false }; return b; }, limit(n: number) { st.lim = n; return b; }, maybeSingle() { st.single = true; return b; }, single() { st.single = true; return b; }, then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); } };
    return b; };
  return { T, from: q, rpc: async (name: string, args: any) => { if (name !== 'portal_place_enrollment') return { data: null, error: null }; const e = T.portal_enrollments.find((x) => x.id === args.p_enrollment); if (!e) return { data: null, error: null }; const room = { id: `room-${T.classrooms.length + 1}`, program_id: e.program_id, code: `SEC-0${T.classrooms.length + 1}`, section_name: `شعبة ${T.classrooms.length + 1} (${e.placement_level})`, cefr_level: e.placement_level, capacity: 30, placement_open: true }; T.classrooms.push(room); e.classroom_id = room.id; return { data: room.id, error: null }; }, storage: { from: () => ({ remove: async () => ({ data: [], error: null }) }) } };
}
const actor = { id: 'u1', email: 'admin@x.com', role: 'ADMIN' };

test('م5-أ: قرار الإنسان — «كلٌّ بحسب نتيجته» + برنامج → تسجيل معتمد وشعبة بمستوى المتقدّم · تجاوز التوصية يُسجَّل', async () => {
  const db = fakeDb(); db.T.placement_reports.push({ id: 'r1', candidate_email: 'a@x.com', created_at: '2026-11-01T10:00:00Z', report: rep(), invite_id: null, archived_at: null, user_id: null }, { id: 'r2', candidate_email: 'b@x.com', created_at: '2026-11-01T11:00:00Z', report: rep({ ملخص_التسكين: { المستوى_المثبت: 'A2', مستوى_الالتحاق_المقترح: 'A2' } }), invite_id: null, archived_at: null, user_id: null });
  const r = await decidePlacement(db as any, { report_ids: ['r1', 'r2'], level: 'each', program_id: 'p1' }, actor); assert.ok(r.ok && r.n === 2 && r.placed === 2 && r.overrides === 0, JSON.stringify(r));
  const d1 = db.T.placement_decisions.find((d) => d.report_id === 'r1'); assert.equal(d1.assigned_level, 'B2'); assert.equal(d1.decision_status, 'approved'); assert.equal(d1.source, 'staff'); assert.ok(d1.classroom_id, 'شعبة');
  const e = db.T.portal_enrollments.find((x) => x.email === 'a@x.com'); assert.equal(e.status, 'approved'); assert.equal(e.placement_level, 'B2'); assert.equal(e.source, 'miaar'); assert.equal(db.T.classrooms.length, 2, 'شعبتان بمستويين مختلفين');
  const o = await decidePlacement(db as any, { report_ids: ['r2'], level: 'B1', program_id: null }, actor); assert.ok(o.ok && o.overrides === 1, 'تجاوز التوصية');
  const d2 = db.T.placement_decisions.find((d) => d.report_id === 'r2'); assert.equal(d2.assigned_level, 'B1'); assert.match(d2.note, /تسكين يدوي: B1 بدل A2/);
  assert.ok(db.T.audit_logs.some((a) => a.action === 'miaar_decision' && a.entity_id === 'r1'), 'درع أَثَر');
  const bad = await decidePlacement(db as any, { report_ids: ['r1'], level: 'Z9' }, actor); assert.ok(!bad.ok, 'مستوى غير صالح');
});

test('م5-أ: التسكين التلقائي الكسول — بعد المهلة فقط · المنطقة الرمادية تُحال لإنسان · البرنامج الافتراضي بمستوى CEFR مطابق · لا يكرّر', async () => {
  const db = fakeDb(); const old = new Date(Date.now() - 72 * 3600_000).toISOString(); const fresh = new Date(Date.now() - 2 * 3600_000).toISOString();
  db.T.placement_reports.push({ id: 'r1', candidate_email: 'a@x.com', created_at: old, report: rep(), invite_id: null, archived_at: null, user_id: null }, { id: 'r2', candidate_email: 'b@x.com', created_at: old, report: rep({ ميزان_الثقة: { الرمز: 'border' } }), invite_id: null, archived_at: null, user_id: null }, { id: 'r3', candidate_email: 'c@x.com', created_at: fresh, report: rep(), invite_id: null, archived_at: null, user_id: null }, { id: 'r4', candidate_email: 'd@x.com', created_at: old, report: rep(), invite_id: 'inv-off', archived_at: null, user_id: null }, { id: 'r5', candidate_email: 'e@x.com', created_at: old, report: rep(), invite_id: null, archived_at: '2026-11-02T00:00:00Z', user_id: null });
  db.T.placement_invites.push({ id: 'inv-off', program_id: null, level_programs: {}, decision_deadline_hours: null });
  const a = await autoPlaceDue(db as any); assert.deepEqual(a, { placed: 1, review: 1 }, 'واحد يُسكَّن وواحد يُحال؛ الطازج والمعطّل والمؤرشف لا يُمسّون');
  const d1 = db.T.placement_decisions.find((d) => d.report_id === 'r1'); assert.equal(d1.source, 'auto'); assert.equal(d1.assigned_level, 'B2'); assert.equal(d1.program_id, 'p1', 'برنامج B2 المطابق'); assert.ok(d1.classroom_id);
  const d2 = db.T.placement_decisions.find((d) => d.report_id === 'r2'); assert.equal(d2.decision_status, 'review'); assert.match(d2.gray_reason, /الحدّ/); assert.equal(db.T.portal_enrollments.filter((e) => e.email === 'b@x.com').length, 0, 'لا تسجيل للرمادي');
  assert.ok(!db.T.placement_decisions.some((d) => ['r3', 'r4', 'r5'].includes(d.report_id)));
  const again = await autoPlaceDue(db as any); assert.deepEqual(again, { placed: 0, review: 0 }, 'لا تكرار');
});

test('م5-أ: الأرشفة تُبقي الصفّ · الحذف فوري لمدير النظام فقط والجماعي يحتاج العدد · يمسح الجلسة والإجابات والأداءات والتسكين الموحّد', async () => {
  const db = fakeDb(); db.T.placement_reports.push({ id: 'r1', submission_id: 's1', candidate_email: 'a@x.com', created_at: '2026-11-01T10:00:00Z', report: rep(), access_code: 'ML-1' }, { id: 'r2', submission_id: 's2', candidate_email: 'b@x.com', created_at: '2026-11-01T11:00:00Z', report: rep(), access_code: 'ML-2' });
  db.T.placement_secure_sessions.push({ id: 's1' }, { id: 's2' }); db.T.placement_secure_answers.push({ session_id: 's1', question_id: 'q' }); db.T.miaar_performances.push({ session_id: 's1', media_path: 'x.webm' }); db.T.portal_placements.push({ id: 'pp1', external_id: 'r1' }); db.T.placement_decisions.push({ id: 'd1', report_id: 'r1' });
  const ar = await archiveReports(db as any, ['r1'], actor, 'انتهت الدفعة'); assert.ok(ar.ok && ar.n === 1); assert.ok(db.T.placement_reports.find((r) => r.id === 'r1').archived_at, 'مؤرشفة'); assert.equal(db.T.placement_reports.length, 2, 'لم تُحذف');
  const un = await archiveReports(db as any, ['r1'], actor, null, true); assert.ok(un.ok); assert.equal(db.T.placement_reports.find((r) => r.id === 'r1').archived_at, null);
  const noRole = await deleteReports(db as any, ['r1'], { ...actor, role: 'PROGRAM_MANAGER' }, null); assert.ok(!noRole.ok && /مدير النظام/.test(noRole.error));
  const noConfirm = await deleteReports(db as any, ['r1', 'r2'], actor, '1'); assert.ok(!noConfirm.ok && /اكتب العدد 2/.test(noConfirm.error));
  const one = await deleteReports(db as any, ['r1'], actor, null); assert.ok(one.ok && one.n === 1 && !one.failed.length, JSON.stringify(one));
  assert.equal(db.T.placement_reports.length, 1); assert.equal(db.T.placement_secure_sessions.length, 1); assert.equal(db.T.placement_secure_answers.length, 0); assert.equal(db.T.miaar_performances.length, 0); assert.equal(db.T.portal_placements.length, 0); assert.equal(db.T.placement_decisions.length, 0);
  const au = db.T.audit_logs.find((a) => a.action === 'miaar_delete'); assert.ok(au && au.entity_id === 'r1' && !JSON.stringify(au).includes('a@x.com'), 'الأثر بلا بريد صريح');
  const two = await deleteReports(db as any, ['r2'], actor, null); assert.ok(two.ok); assert.equal(db.T.placement_reports.length, 0);
});
