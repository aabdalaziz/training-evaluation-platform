// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P22 — «خزنة أَثَر» (PDPL): تغطية السجل لكل جدول يستعمله الكود · سلامة السجل · خطة النسيان · الإشعار الآلي · طلبات الأشخاص (30+30)
//                 · الحوادث (72 ساعة) ومسودة سدايا · حجر النسيان (رمز/تراجع/تنفيذ/تجزئة) · الاحتفاظ · إيصال موقَّع · الحارس الزمني.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRY, NON_PERSONAL_TABLES, PROCESSORS, RIGHTS_AR, erasurePlan, retentionRules, countsSpec, personalTables, byTable, NOTICE_VERSION, DSR_DAYS, INCIDENT_HOURS, ERASURE_HOLD_DAYS } from '../lib/vault/registry';
import { privacyJson, noticeModel, orgFromEnv } from '../lib/vault/notice';
import { subjectCounts, exportSubject, renderExportHtml, touches, signReceipt, liveConsents, sha256 } from '../lib/vault/subject';
import { createDsr, extendDsr, closeDsr, dueSoon, overdue, dsrSummary, daysLeft } from '../lib/vault/dsr';
import { openIncident, markReported, closeIncident, sdaiaDraft, affectedNotice, hoursLeft } from '../lib/vault/incidents';
import { requestErasure, undoErasure, executeErasure, dueErasures, erasureStatus, hashEmail } from '../lib/vault/erasure';
import { runVault, runRetention } from '../lib/vault/cron';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const U = '00000000-0000-4000-8000-000000000077'; const EMAIL = 'sara@example.com';

/** قاعدة وهمية بجداول في الذاكرة تدعم ما تستعمله الخزنة: select/or/ilike/eq/in/is/lte/lt/gte/order/limit/maybeSingle/insert/update + rpc */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {}; for (const [k, v] of Object.entries(seed)) T[k] = v.map((r, i) => ({ id: i + 1, ...r }));
  const rpcCalls: any[] = []; const auth = { deleted: [] as string[] };
  const table = (t: string) => (T[t] = T[t] || []);
  const match = (r: any, f: any): boolean => {
    switch (f.op) {
      case 'eq': return r[f.c] === f.v || String(r[f.c]) === String(f.v);
      case 'ilike': return String(r[f.c] || '').toLowerCase() === String(f.v).toLowerCase();
      case 'in': return f.v.map(String).includes(String(r[f.c]));
      case 'is': return r[f.c] == null;
      case 'not_is': return r[f.c] != null;
      case 'lte': return r[f.c] <= f.v; case 'lt': return r[f.c] < f.v; case 'gte': return r[f.c] >= f.v;
      case 'or': return f.v.split(',').some((part: string) => { const [c, op, ...rest] = part.split('.'); const v = rest.join('.'); return match(r, { op: op === 'eq' ? 'eq' : 'ilike', c, v }); });
      default: return true;
    }
  };
  const db: any = {
    T, rpcCalls, auth: { admin: { deleteUser: async (id: string) => { auth.deleted.push(id); return { error: null }; } } }, deleted: auth.deleted,
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      if (name === 'vault_subject_counts') { const out: any = {}; for (const s of args.p_tables) { if (!T[s.t]) { out[s.t] = null; continue; } out[s.t] = T[s.t].filter(r => (s.u && args.p_user && r[s.u] === args.p_user) || (s.e && args.p_email && String(r[s.e] || '').toLowerCase() === args.p_email)).length; } return { data: out, error: null }; }
      if (name === 'vault_delete') { const rows = table(args.p_table); const keep = rows.filter(r => !((args.p_user_col && args.p_user && r[args.p_user_col] === args.p_user) || (args.p_email_col && args.p_email && String(r[args.p_email_col] || '').toLowerCase() === args.p_email))); const n = rows.length - keep.length; T[args.p_table] = keep; return { data: n, error: null }; }
      if (name === 'vault_anonymize') { let n = 0; for (const r of table(args.p_table)) { if ((args.p_user_col && args.p_user && r[args.p_user_col] === args.p_user) || (args.p_email_col && args.p_email && String(r[args.p_email_col] || '').toLowerCase() === args.p_email)) { n++; if (args.p_user_col) r[args.p_user_col] = 'anon-uuid'; if (args.p_email_col) r[args.p_email_col] = 'anon-x@erased.invalid'; for (const c of args.p_null_cols || []) if (c in r) r[c] = null; } } return { data: n, error: null }; }
      if (name === 'vault_retention') { const cutoff = new Date(Date.now() - args.p_days * 864e5).toISOString(); const rows = table(args.p_table).filter(r => r[args.p_ts_col] < cutoff); if (!args.p_dry) { if (args.p_action === 'delete') T[args.p_table] = table(args.p_table).filter(r => !(r[args.p_ts_col] < cutoff)); else for (const r of rows) { if (args.p_email_col) r[args.p_email_col] = 'anon-y@erased.invalid'; } } return { data: rows.length, error: null }; }
      if (name === 'vault_scrub_audit') return { data: 0, error: null };
      return { data: null, error: { message: 'unknown rpc ' + name } };
    },
    from: (t: string) => {
      const q: any = { _f: [] as any[], _order: null, _limit: 0, _single: false, _op: 'select', _payload: null, _count: false, _head: false };
      const run = () => {
        const rows = table(t);
        if (q._op === 'insert') { const arr = Array.isArray(q._payload) ? q._payload : [q._payload]; const ins = arr.map((p: any) => ({ id: rows.length + 1 + Math.floor(Math.random() * 1e6), created_at: new Date().toISOString(), ...p })); rows.push(...ins); return { data: q._single ? ins[0] : ins, error: null }; }
        let sel = rows.filter(r => q._f.every((f: any) => match(r, f)));
        if (q._op === 'update') { for (const r of sel) Object.assign(r, q._payload); return { data: q._single ? sel[0] || null : sel, error: null }; }
        if (q._order) sel = [...sel].sort((a, b) => (a[q._order.c] < b[q._order.c] ? 1 : -1) * (q._order.asc ? -1 : 1));
        if (q._limit) sel = sel.slice(0, q._limit);
        if (q._head) return { data: null, count: sel.length, error: null };
        return { data: q._single ? sel[0] || null : sel, count: sel.length, error: null };
      };
      q.select = (_c?: string, o?: any) => { if (o?.count) q._count = true; if (o?.head) q._head = true; return q; };
      for (const op of ['eq', 'ilike', 'lte', 'lt', 'gte']) q[op] = (c: string, v: any) => { q._f.push({ op, c, v }); return q; };
      q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; }; q.is = (c: string, v: any) => { q._f.push({ op: 'is', c, v }); return q; }; q.not = (c: string, op: string) => { if (op === 'is') q._f.push({ op: 'not_is', c }); return q; }; q.or = (s: string) => { q._f.push({ op: 'or', v: s }); return q; };
      q.order = (c: string, o: any) => { q._order = { c, asc: !!o?.ascending }; return q; }; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}
const seed = () => ({
  portal_enrollments: [{ user_id: U, email: EMAIL, full_name: 'سارة', phone: '0555', created_at: '2026-01-01T00:00:00Z' }, { user_id: 'other', email: 'o@x.com', full_name: 'آخر' }],
  portal_learning_events: [{ user_id: U, email: EMAIL, action: 'attended', at: '2026-02-01T00:00:00Z', context: { note: 'x' } }],
  portal_credentials: [{ user_id: U, email: EMAIL, full_name: 'سارة', title_ar: 'شهادة', verify_code: 'ATH-1' }],
  portal_contact_prefs: [{ user_id: U, email: EMAIL, whatsapp_opt_in: true, phone_e164: '+966555', push_ok: true }],
  portal_push_subscriptions: [{ user_id: U, email: EMAIL, active: true, endpoint: 'https://push', auth: 'a', p256dh: 'b', created_at: '2024-01-01T00:00:00Z' }],
  portal_delegations: [{ user_id: U, email: EMAIL, client_id: 'c1', client_name: 'Claude', scopes: ['wallet:read'], last_used_at: new Date().toISOString(), uses: 3, revoked_at: null }],
  portal_ai_log: [{ user_id: U, email: EMAIL, purpose: 'mirror', provider: 'openai', created_at: new Date().toISOString() }],
  portal_message_log: [{ to_email: EMAIL, kind: 'enrollment_ack', channel: 'email', status: 'sent', created_at: new Date().toISOString() }],
  portal_profiles: [{ user_id: U, display_name: 'سارة', share_mode: 'org' }],
  portal_invoices: [{ user_id: U, customer_email: EMAIL, amount: 100 }],
  audit_logs: [{ actor_id: 'admin', entity_id: U, entity_type: 'profiles', action: 'UPDATE', created_at: new Date().toISOString(), actor_role: 'ADMIN' }],
  portal_evidence_queries: [{ user_id: U, email: EMAIL, question: 'q', created_at: '2024-01-01T00:00:00Z' }, { user_id: 'z', email: 'z@x.com', question: 'q2', created_at: new Date().toISOString() }],
});

// ---------- 1) السجل يغطي كل جدول يستعمله الكود ----------
function walk(dir: string, out: string[] = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); if (f === 'node_modules' || f.startsWith('.')) continue; if (statSync(p).isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(f) && !p.includes('/tests/')) out.push(p); } return out; }
test('P22 التغطية: كل جدول يستعمله الكود (from(\'…\')) إمّا مسجَّل في سجل المعالجة أو مُعلَن أنه بلا بيانات شخصية — ولا جدول مسجَّل مرتين', () => {
  const files = [...walk('app'), ...walk('lib')]; const used = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\.from\(['"]([a-z_]+)['"]\)/g)) used.add(m[1]);
  assert.ok(used.size > 80, `جداول مستعملة: ${used.size}`);
  const reg = new Set(REGISTRY.map(r => r.table)); const np = new Set(NON_PERSONAL_TABLES);
  const missing = Array.from(used).filter(t => !reg.has(t) && !np.has(t));
  assert.deepEqual(missing, [], `جداول غير مصنَّفة (أضفها إلى REGISTRY أو NON_PERSONAL_TABLES): ${missing.join(', ')}`);
  const both = Array.from(reg).filter(t => np.has(t)); assert.deepEqual(both, [], `مسجَّل في القائمتين: ${both.join(', ')}`);
  assert.equal(new Set(REGISTRY.map(r => r.table)).size, REGISTRY.length, 'لا تكرار في السجل');
  // جداول P21/P22 نفسها مغطاة
  for (const t of ['portal_security_events', 'portal_dsr_requests', 'portal_consents', 'portal_erasure_queue', 'portal_delegations', 'portal_ai_log']) assert.ok(reg.has(t), `${t} مسجَّل`);
});

test('P22 سلامة السجل: كل بند شخصي له مفتاح ربط، وكل سياسة احتفاظ لها عمود زمني، وكل «إبقاء نظامي» له سبب عربي، والنسخة الآلية تعكس السجل', () => {
  for (const r of personalTables()) {
    assert.ok(r.userCol || r.emailCol || r.retentionDays, `${r.table}: مفتاح ربط أو مدة احتفاظ تلقائية`);
    assert.ok(r.purpose_ar.length > 5 && r.data_ar.length > 2 && r.label_ar.length > 2, `${r.table}: نصوص عربية`);
    if (r.retentionDays) assert.ok(r.tsCol, `${r.table}: عمود زمني للاحتفاظ`);
    if (r.policy === 'retain_legal') assert.ok((r.retainNote_ar || '').length > 10, `${r.table}: سبب الإبقاء`);
  }
  assert.ok(retentionRules().length >= 10, 'سياسات احتفاظ كافية'); assert.ok(countsSpec().every(s => s.t && (s.u || s.e)), 'مواصفة العدّ');
  const plan = erasurePlan(); assert.ok(plan.delete.length > 5 && plan.anonymize.length > 5 && plan.retain.length >= 4, 'خطة النسيان بثلاث فئات');
  assert.ok(plan.retain.some(x => x.table === 'portal_invoices') && plan.retain.some(x => x.table === 'portal_credentials'), 'الفواتير والشهادات تُبقى نظامًا');
  assert.ok(PROCESSORS.length >= 5 && PROCESSORS.some(p => p.id === 'ai'), 'المعالجون يشملون الذكاء الاصطناعي'); assert.equal(RIGHTS_AR.length, 6, 'ستة حقوق');
  const org = orgFromEnv({ NEXT_PUBLIC_SITE_URL: 'https://t.example', DATA_PROTECTION_CONTACT: 'dpo@t.example' }, 'https://t.example');
  const pj = privacyJson(org); assert.equal(pj.processing.length, personalTables().length, 'privacy.json يغطي كل البنود'); assert.equal(pj.controller.contact, 'dpo@t.example', 'جهة الاتصال'); assert.equal(pj.timelines.breach_notification_hours, 72, '72 ساعة'); assert.equal(pj.ai.personal_identifiers_sent_to_models, false, 'لا هوية للنماذج'); assert.equal(pj.endpoints.mcp_tool, 'my_data_summary', 'أداة الوكيل');
  const nm = noticeModel(org); assert.ok(nm.categories.length >= 6 && nm.categories.every(c => c.items.length), 'الإشعار بالفئات'); assert.equal(nm.version, NOTICE_VERSION, 'الإصدار');
  assert.equal(byTable('portal_media')!.policy, 'delete', 'الوسائط تُحذف');
});

// ---------- 2) الشخص: الخريطة · النسخة · اللمسات · الموافقات · الإيصال ----------
test('P22 ذاكرتي: العدّ عبر RPC ثم تراجع بالعدّ المباشر، النسخة تحجب الأسرار وتُولِّد HTML عربيًا ببصمة، اللمسات من 5 مصادر، الموافقات من مصادرها', async () => {
  const db = fakeDb(seed()); const me = { id: U, email: EMAIL, name: 'سارة' };
  const map = await subjectCounts(db, me); const byT = Object.fromEntries(map.map(m => [m.table, m.count]));
  assert.equal(byT.portal_enrollments, 1, 'تسجيل واحد لسارة'); assert.equal(byT.portal_invoices, 1, 'فاتورة'); assert.equal(byT.portal_missions, null, 'جدول غير موجود → null لا صفر'); assert.ok(map.every(m => m.retention_ar && m.basis_ar && m.policy_ar), 'نصوص العرض');
  // بلا RPC
  const db2 = fakeDb(seed()); db2.rpc = async () => ({ data: null, error: { message: 'no' } });
  const map2 = await subjectCounts(db2, me); assert.equal(Object.fromEntries(map2.map(m => [m.table, m.count])).portal_enrollments, 1, 'التراجع يعدّ مباشرة');
  const x = await exportSubject(db, me);
  assert.ok(x.tables.portal_enrollments.rows.length === 1 && x.tables.portal_enrollments.rows[0].full_name === 'سارة', 'النسخة تضم صفوف الشخص فقط');
  assert.equal(x.tables.portal_push_subscriptions.rows[0].auth, '[محجوب]', 'الأسرار محجوبة'); assert.ok(!x.tables.portal_enrollments.rows.some(r => r.full_name === 'آخر'), 'لا بيانات غيره');
  assert.match(x.hash, /^sha256:[0-9a-f]{64}$/, 'بصمة'); const html = renderExportHtml(x); assert.ok(html.includes('dir="rtl"') && html.includes('نسختي من أَثَر') && html.includes('سارة'), 'HTML عربي');
  const t = await touches(db, me); const kinds = new Set(t.map(z => z.kind)); assert.ok(kinds.has('agent') && kinds.has('ai') && kinds.has('message') && kinds.has('staff'), `مصادر اللمس: ${Array.from(kinds).join(',')}`);
  assert.ok(t.find(z => z.kind === 'ai')!.what.includes('بلا اسمك'), 'شفافية الذكاء الاصطناعي');
  const c = await liveConsents(db, me); const on = c.items.filter(i => i.on).map(i => i.scope); assert.ok(on.includes('whatsapp') && on.includes('push') && on.includes('share_profile') && on.some(s => s.startsWith('agent:')), `الموافقات القائمة: ${on.join(',')}`);
  const rc = await signReceipt({ kind: 'export', export_hash: x.hash }, { VC_SIGNING_KEY: K1, NEXT_PUBLIC_SITE_URL: 'https://t.example' }, 'https://t.example');
  assert.ok(rc.proof && rc.proof.proofValue && rc.issuer === 'did:web:t.example' && rc.type === 'AtharVaultReceipt', 'إيصال موقَّع Ed25519');
  const rc2 = await signReceipt({ kind: 'export' }, {}, 'https://t.example'); assert.equal(rc2.proof, null, 'بلا مفتاح → بصمة فقط'); assert.ok(rc2.hash.startsWith('sha256:'), 'بصمة');
});

// ---------- 3) الطلبات: 30 يومًا + تمديد بسبب + إغلاق ----------
test('P22 الطلبات: مهلة 30 يومًا، لا تكرار للمفتوح، التمديد مرة واحدة بسبب ≥ 8 أحرف، الرفض بسبب، المستحقّ قريبًا والمتأخر، الملخص', async () => {
  const db = fakeDb(); const r1 = await createDsr(db, { user_id: U, email: EMAIL, kind: 'correction', details: { field: 'name' } });
  assert.ok(r1.row && !r1.duplicate, 'أُنشئ'); assert.ok(Math.abs(daysLeft(r1.row!.due_at) - DSR_DAYS) <= 1, '30 يومًا');
  const r2 = await createDsr(db, { user_id: U, email: EMAIL.toUpperCase(), kind: 'correction' }); assert.ok(r2.duplicate, 'لا تكرار (بلا حساسية لحالة الأحرف)');
  const bad = await extendDsr(db, r1.row!.id, 'قصير', null); assert.equal(bad.ok, false, 'سبب قصير يُرفض');
  const ext = await extendDsr(db, r1.row!.id, 'نحتاج مراجعة الشهادات الأصلية لدى الجهة', 'admin'); assert.ok(ext.ok && ext.row!.status === 'extended' && Math.abs(daysLeft(ext.row!.due_at) - 60) <= 1, 'مُدِّد إلى 60');
  const again = await extendDsr(db, r1.row!.id, 'سبب آخر طويل بما يكفي', 'admin'); assert.equal(again.ok, false, 'لا تمديد ثانٍ');
  const rej = await closeDsr(db, r1.row!.id, 'rejected', { reason: 'قصير' }, 'admin'); assert.equal(rej.ok, false, 'الرفض يحتاج سببًا');
  const done = await closeDsr(db, r1.row!.id, 'done', { note: 'صُحِّح الاسم' }, 'admin'); assert.ok(done.ok && done.row!.status === 'done' && done.row!.closed_at, 'أُغلق منفَّذًا');
  const closedAgain = await closeDsr(db, r1.row!.id, 'done', {}, 'admin'); assert.equal(closedAgain.ok, false, 'لا إغلاق مرتين');
  // مواعيد
  db.T.portal_dsr_requests.push({ id: 90, email: 'a@x', kind: 'access', status: 'open', due_at: new Date(Date.now() + 2 * 864e5).toISOString(), created_at: '' }, { id: 91, email: 'b@x', kind: 'objection', status: 'extended', due_at: new Date(Date.now() - 864e5).toISOString(), created_at: '' });
  assert.equal((await dueSoon(db, 5)).length, 2, 'يستحق قريبًا (يشمل المتأخر)'); assert.equal((await overdue(db)).length, 1, 'متأخر واحد');
  const s = dsrSummary(db.T.portal_dsr_requests); assert.equal(s.open, 2, 'مفتوحان'); assert.equal(s.overdue, 1, 'متأخر'); assert.equal(s.done_30d, 1, 'منفَّذ');
  const auto = await createDsr(db, { user_id: U, email: EMAIL, kind: 'access', autoDone: { instant: true } }); assert.equal(auto.row!.status, 'done', 'طلب الاطّلاع يُسجَّل منفَّذًا فورًا');
});

// ---------- 4) الحوادث: 72 ساعة ----------
test('P22 الحوادث: مهلة 72 ساعة من العلم، لا تكرار لحدث الدرع نفسه، مسودة سدايا تذكر الفئات بالعربية، الإبلاغ ثم الإغلاق، وإشعار المتأثرين', async () => {
  const db = fakeDb(); const short = await openIncident(db, { summary: 'قصير' }); assert.equal(short.row, null, 'وصف قصير يُرفض');
  const disc = new Date(Date.now() - 10 * 36e5).toISOString();
  const i = await openIncident(db, { summary: 'تسريب محتمل لجدول التسجيلات عبر مفتاح وكيل مسرَّب', tables: ['portal_enrollments', 'portal_profiles'], affected_count: 120, security_event_id: 55, discovered_at: disc });
  assert.ok(i.row, 'فُتحت'); assert.ok(Math.abs(hoursLeft(i.row!.deadline_at) - (INCIDENT_HOURS - 10)) < 0.1, 'المهلة تُحسب من لحظة العلم');
  const dup = await openIncident(db, { summary: 'نفس الحدث مرة أخرى بوصف مختلف', security_event_id: 55 }); assert.equal(dup.row!.id, i.row!.id, 'لا تكرار لحدث الدرع');
  const d = sdaiaDraft(i.row!, { name: 'شركة بوابة التميز', contact: 'dpo@x', site: 'https://t' }); assert.ok(d.includes('طلبات التسجيل') && d.includes('ملفي العام') && d.includes('72 ساعة') && d.includes('120'), 'المسودة عربية بالفئات');
  const n = affectedNotice(i.row!, { name: 'شركة بوابة التميز', contact: 'dpo@x' }); assert.ok(n.subject.includes('بياناتك') && n.text.includes('dpo@x'), 'إشعار المتأثرين');
  const rep = await markReported(db, i.row!.id, 'SDAIA-2026-001', true); assert.ok(rep.ok && rep.row!.status === 'reported' && rep.row!.affected_notified_at, 'أُبلغت الهيئة');
  const rep2 = await markReported(db, i.row!.id, 'x'); assert.equal(rep2.ok, false, 'لا إبلاغ مرتين');
  const cl = await closeIncident(db, i.row!.id, 'closed', 'دُوِّر المفتاح وأُبطلت التفويضات'); assert.ok(cl.ok && cl.row!.status === 'closed', 'أُغلقت');
});

// ---------- 5) النسيان: حجر · رمز · تراجع · تنفيذ · تجزئة ----------
test('P22 النسيان: حجر 7 أيام برمز مُجزَّأ ورسالة فيها الخطة، التراجع بالرابط يلغي الطلب، التنفيذ يحذف/يُجهِّل/يُبقي حسب السجل ويحذف حساب الدخول ويُصدر إيصالًا موقَّعًا ويُجزِّئ البريد', async () => {
  const db = fakeDb(seed()); const env = { VC_SIGNING_KEY: K1, NEXT_PUBLIC_SITE_URL: 'https://t.example' };
  const r = await requestErasure(db, { id: U, email: EMAIL, name: 'سارة' }, 'https://t.example', env);
  assert.ok(r.ok && !r.duplicate && r.queue, 'سُجِّل'); assert.ok(Math.abs(daysLeft(r.queue!.execute_after) - ERASURE_HOLD_DAYS) <= 1, 'حجر 7 أيام');
  assert.notEqual(r.queue!.token_hash.length, 0, 'الرمز مُجزَّأ'); assert.ok(db.T.portal_dsr_requests.some((d: any) => d.kind === 'erasure' && d.status === 'open'), 'طلب erasure مفتوح');
  const msg = db.T.portal_message_log?.find((m: any) => m.kind === 'erasure_confirm'); assert.ok(msg, 'رسالة التأكيد سُجِّلت'); assert.ok(String(msg.payload?.url || '').includes('/api/vault/confirm?t=') && String(msg.payload?.url).includes('a=undo'), 'رابط التراجع');
  const again = await requestErasure(db, { id: U, email: EMAIL }, 'https://t.example', env); assert.ok(again.duplicate, 'لا طلب ثانٍ أثناء الحجر');
  // التراجع بالرمز الحقيقي من الرابط
  const token = new URL(msg.payload.url).searchParams.get('t')!; assert.equal(sha256(token), r.queue!.token_hash, 'الرابط يحمل الرمز الذي جُزِّئ');
  const bad = await undoErasure(db, 'wrong'); assert.equal(bad.ok, false, 'رمز خاطئ');
  const un = await undoErasure(db, token); assert.ok(un.ok && un.email === EMAIL, 'تراجع'); assert.equal(await erasureStatus(db, U, EMAIL), null, 'لا حجر قائم'); assert.ok(db.T.portal_dsr_requests.find((d: any) => d.kind === 'erasure').status === 'cancelled', 'الطلب أُلغي');
  // طلب جديد ثم تنفيذ
  const r2 = await requestErasure(db, { id: U, email: EMAIL, name: 'سارة' }, 'https://t.example', env); assert.ok(r2.ok && !r2.duplicate, 'طلب جديد بعد التراجع');
  assert.equal((await dueErasures(db)).length, 0, 'ليس مستحقًا بعد'); db.T.portal_erasure_queue.find((q: any) => q.id === r2.queue!.id).execute_after = new Date(Date.now() - 1000).toISOString();
  const due = await dueErasures(db); assert.equal(due.length, 1, 'مستحق بعد انتهاء الحجر');
  const ex = await executeErasure(db, due[0], 'https://t.example', env);
  assert.ok(ex.ok && ex.authDeleted && db.deleted.includes(U), 'حساب الدخول حُذف');
  assert.equal(db.T.portal_contact_prefs.length, 0, 'التفضيلات حُذفت'); assert.equal(db.T.portal_push_subscriptions.length, 0, 'اشتراكات الدفع حُذفت'); assert.equal(db.T.portal_profiles.length, 0, 'الملف العام حُذف');
  const en = db.T.portal_enrollments.find((e: any) => e.full_name !== 'آخر'); assert.ok(en && en.email.endsWith('@erased.invalid') && en.full_name === null && en.phone === null, 'التسجيل جُهِّل (بريد مزيَّف، اسم وجوال null)'); assert.ok(db.T.portal_enrollments.some((e: any) => e.full_name === 'آخر'), 'بيانات الآخرين لم تُمسّ');
  assert.equal(db.T.portal_invoices[0].customer_email, EMAIL, 'الفاتورة بقيت (نظامًا)'); assert.equal(db.T.portal_credentials[0].email, EMAIL, 'الشهادة بقيت (نظامًا)');
  assert.equal(ex.counts.portal_invoices.action, 'retain', 'الإيصال يذكر الإبقاء'); assert.equal(ex.counts.portal_enrollments.rows, 1, 'الإيصال يعدّ المجهَّل');
  assert.ok(ex.receipt.proof && ex.receipt.subject_hash === hashEmail(EMAIL) && !JSON.stringify(ex.receipt).includes(EMAIL), 'إيصال موقَّع ببصمة لا بريد');
  const q = db.T.portal_erasure_queue.find((x: any) => x.id === r2.queue!.id); assert.ok(q.executed_at && q.email === hashEmail(EMAIL) && q.token_hash === 'used' && q.receipt?.hash, 'الحجر: مُنفَّذ، البريد مُجزَّأ');
  assert.ok(db.T.portal_dsr_requests.every((d: any) => d.email !== EMAIL), 'بريد الطلبات مُجزَّأ: ' + JSON.stringify(db.T.portal_dsr_requests.map((d: any) => [d.id, d.email, d.kind, d.status]))); assert.ok(db.T.portal_message_log.every((m: any) => m.to_email !== EMAIL), 'سجل الرسائل مُجزَّأ');
  assert.ok(db.rpcCalls.some((c: any) => c.name === 'vault_scrub_audit'), 'تنظيف سجل التدقيق');
});

// ---------- 6) الحارس الزمني ----------
test('P22 الحارس الزمني: الاحتفاظ يحذف القديم فقط (معاينة ثم تنفيذ)، ينفّذ النسيان المستحق، يذكّر بالطلبات ≤ 5 أيام مرة كل يومين، وبالحوادث قبل 24 ساعة من المهلة', async () => {
  const db = fakeDb(seed()); const env = { VC_SIGNING_KEY: K1, NEXT_PUBLIC_SITE_URL: 'https://t.example', ADMIN_EMAILS: 'ops@t.example' };
  const prev = await runRetention(db, true); const eq = prev.find(p => p.table === 'portal_evidence_queries')!; assert.equal(eq.rows, 1, 'معاينة: سؤال قديم واحد مستحق'); assert.equal(db.T.portal_evidence_queries.length, 2, 'المعاينة لا تحذف');
  db.T.portal_dsr_requests = [{ id: 1, email: 'a@x', kind: 'correction', status: 'open', due_at: new Date(Date.now() + 3 * 864e5).toISOString(), reminded_at: null, created_at: '' }];
  db.T.portal_incidents = [{ id: 1, status: 'open', summary: 'حادثة', deadline_at: new Date(Date.now() + 20 * 36e5).toISOString(), reminded_at: null }];
  db.T.portal_erasure_queue = [{ id: 1, user_id: U, email: EMAIL, token_hash: 'h', execute_after: new Date(Date.now() - 1000).toISOString(), cancelled_at: null, executed_at: null, created_at: '', plan: {} }];
  const dry = await runVault(db, { dry: true, site: 'https://t.example', env }); assert.equal(dry.erasures[0].dry, true, 'المعاينة لا تنفّذ النسيان'); assert.equal(db.T.portal_erasure_queue[0].executed_at, null, 'لم يُنفَّذ');
  const run = await runVault(db, { dry: false, site: 'https://t.example', env });
  assert.equal(db.T.portal_evidence_queries.length, 1, 'الاحتفاظ حذف القديم فقط'); assert.ok(run.erasures[0].ok, 'نُفِّذ النسيان المستحق'); assert.ok(db.deleted.includes(U), 'حساب الدخول');
  assert.equal(run.dsr_reminders, 1, 'تذكير طلب'); assert.equal(run.incident_reminders, 1, 'تذكير حادثة');
  const sent = db.T.portal_message_log.filter((m: any) => m.to_email === 'ops@t.example').map((m: any) => m.kind); assert.ok(sent.includes('dsr_due') && sent.includes('incident_due'), `رسائل الطاقم: ${sent.join(',')}`);
  const run2 = await runVault(db, { dry: false, site: 'https://t.example', env }); assert.equal(run2.dsr_reminders, 0, 'لا تذكير مكرَّر خلال يومين'); assert.equal(run2.incident_reminders, 0, 'لا تذكير حادثة مكرَّر خلال 6 ساعات');
});
