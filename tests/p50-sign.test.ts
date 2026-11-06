// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P50 «توقيعي» — سجلّ التوقيعات المعلّقة: الترتيب بالأقدم · المجاميع · نصّ «نبض الصباح» · اللمسة تستدعي الواجهة القائمة فقط · المدرّب يرى شُعبه · لا أسماء · نبض الصباح مرّة في اليوم · عقد المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ageDays, orderGroups, summarize, digestText, touchFor, SIGN_ACTION_RE, SIGN_PATH, SIGN_OFFICIAL, STAFF_ROLES, collectRegister, invalidateSignCache, runSignDigest } from '../lib/portal/sign';
import type { SignGroup } from '../lib/portal/sign';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';
import { ROOMS, canOpen } from '../lib/portal/rooms';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const NOW = new Date('2026-11-06T09:00:00.000Z');
const G = (key: string, count: number, oldest: string | null, over: Partial<SignGroup> = {}): SignGroup => ({ key, area: 'miaar', title_ar: key, hint_ar: '', count, oldest_at: oldest, href: '/x', ...over });

test('P50: ageDays · orderGroups (الأقدم أولًا، العاجل عند التساوي، الفارغ لا يُعرض) · summarize', () => {
  assert.equal(ageDays('2026-11-01T00:00:00Z', NOW), 5); assert.equal(ageDays(null, NOW), null); assert.equal(ageDays('bad', NOW), null); assert.equal(ageDays('2026-11-07T00:00:00Z', NOW), 0, 'لا سالب');
  const o = orderGroups([G('a', 2, '2026-11-05T00:00:00Z'), G('b', 0, '2026-10-01T00:00:00Z'), G('c', 1, '2026-11-01T00:00:00Z'), G('d', 3, null), G('e', 1, '2026-11-05T00:00:00Z', { urgent: true })]);
  assert.deepEqual(o.map((g) => g.key), ['c', 'e', 'a', 'd'], 'c الأقدم · e عاجل قبل a عند التساوي · d بلا تاريخ آخرًا · b فارغ محذوف');
  const s = summarize(o, NOW); assert.equal(s.total, 7); assert.equal(s.oldest_days, 5); assert.equal(s.oldest_at, '2026-11-01T00:00:00Z');
  assert.deepEqual(summarize([], NOW), { total: 0, oldest_days: null, oldest_at: null });
});

test('P50: نصّ «نبض الصباح» — العدد والأقدم وأوّل مجموعة، رابط /admin/sign، بلا أسماء', () => {
  const t = digestText(7, 5, 'خطط مِران تنتظر توقيعك'); assert.equal(t.title_ar, 'ينتظر توقيعك اليوم 7 — الأقدم منذ 5 أيام'); assert.match(t.body_ar, /أوّلها: خطط مِران/); assert.equal(t.url, SIGN_PATH);
  assert.equal(digestText(1, 0, null).title_ar, 'ينتظر توقيعك اليوم 1'); assert.match(digestText(3, 1, null).title_ar, /منذ 1 يوم$/); assert.match(digestText(3, 2, null).title_ar, /يومين$/); assert.match(digestText(3, 15, null).title_ar, /15 يومًا$/);
  assert.equal(KIND_AR.sign_digest, 'نبض الصباح — توقيعي'); assert.equal(KIND_ICON.sign_digest, '✍️'); assert.equal(SIGN_OFFICIAL.en, 'Pending Signatures Register');
});

test('P50: اللمسة تستدعي approve_all القائم فقط — لا لمسة لعنصر بلا touch · أفعال التوقيع في التدقيق', () => {
  assert.deepEqual(touchFor({ touch: { action: 'practice_approve_all', body: { invite_id: 'i1' } } }), { path: '/api/admin/miaar/practice', body: { action: 'approve_all', invite_id: 'i1' } });
  assert.equal(touchFor({}), null); assert.equal(touchFor(null), null); assert.equal(touchFor({ touch: { action: 'anything_else' as any, body: {} } }), null);
  for (const a of ['miaar_practice_approve_all', 'miaar_ledger_decide', 'miaar_exit_promote', 'miaar_witness_verdict', 'rating_release', 'enrollment_accept', 'sign_touch']) assert.ok(SIGN_ACTION_RE.test(a), a);
  for (const a of ['miaar_practice_draft', 'login', 'export', 'view']) assert.ok(!SIGN_ACTION_RE.test(a), a);
});

test('P50: «نادِ» يعرف «ما ينتظر توقيعي» · الغرفة /admin/sign مفتوحة للطاقم والمدرّب (sessions.host) ومغلقة لمن لا صفة له · «الطريق» يسمّيها', () => {
  const d = DESTINATIONS.find((x) => x.href === '/admin/sign'); assert.ok(d && d.admin, 'وجهة إدارية');
  for (const say of ['توقيعي', 'ما ينتظر توقيعي', 'افتح التوقيعات المعلقة']) { const i = parseCommand(say, { admin: true }) as any; assert.equal(i.kind, 'go', say); assert.equal(i.href, '/admin/sign', say); }
  assert.equal((parseCommand('وقع', { admin: true }) as any).kind, 'unknown', '«وقع» وحدها ليست أمرًا — تفاديًا للالتباس');
  assert.equal((parseCommand('توقيعي', { admin: false }) as any).href, undefined, 'غير الإداري لا يُقاد إليها');
  const room = ROOMS.find((r) => r.href === '/admin/sign')!; assert.ok(room); assert.equal(room.label, 'توقيعي');
  assert.ok(canOpen(room, [], true)); assert.ok(canOpen(room, ['sessions.host'], false), 'المدرّب'); assert.ok(canOpen(room, ['reports.read'], false), 'القيادة'); assert.ok(!canOpen(room, ['directory.self'], false), 'الخبير بلا باب قرارات');
  assert.match(read('lib/portal/way.ts'), /'admin\/sign': \{ ar: 'توقيعي'/);
});

/** قاعدة بيانات وهمية: دعوة عُبور بثلاثة تقارير (2 لم يجتز بلا خطّة · 1 اجتاز بلا ترقية) · مسوَّدتا مِران البداية في شعبتين (c1 للمدرّب t1 · c2 لغيره) · أمر خدمة بطلب جهة · أداء معلّق · قرار رمادي · بند بنك */
function fakeDb(over: Record<string, any[]> = {}) {
  const EXIT_FAIL = { المستوى_العام: 'A1', بيانات_المتقدم: { الاسم: 'سرّي' }, exit: { الحالة: 'final', النتيجة: 'failed', المستوى: 'A1', الوحدات: [{ الرمز: 'A1-U01', النسبة: 30, الحالة: 'weak' }] } };
  const EXIT_PASS = { المستوى_العام: 'A1', بيانات_المتقدم: { الاسم: 'سرّي' }, exit: { الحالة: 'final', النتيجة: 'passed', المستوى: 'A1' } };
  const T: Record<string, any[]> = {
    placement_invites: [{ id: 'inv1', code: 'ABCD', label_ar: 'شعبة A1-01', level_target: 'A1', classroom_id: 'c1', status: 'open', created_at: '2026-11-01T00:00:00Z' }, { id: 'inv9', code: 'SRV1', label_ar: 'معهد الأفق', level_target: 'A1', classroom_id: null, status: 'open', created_at: '2026-11-02T00:00:00Z' }],
    placement_reports: [{ id: 'r1', invite_id: 'inv1', submission_id: 's1', report: EXIT_FAIL, integrity_status: null, archived_at: null, created_at: '2026-11-02T00:00:00Z' }, { id: 'r2', invite_id: 'inv1', submission_id: 's2', report: EXIT_FAIL, integrity_status: null, archived_at: null, created_at: '2026-11-03T00:00:00Z' }, { id: 'r3', invite_id: 'inv1', submission_id: 's3', report: EXIT_PASS, integrity_status: 'clear', archived_at: null, created_at: '2026-11-03T00:00:00Z' }, { id: 'r9', invite_id: 'inv9', submission_id: 's9', report: EXIT_PASS, integrity_status: null, archived_at: null, created_at: '2026-11-04T00:00:00Z' }],
    miaar_service_orders: [{ id: 'o1', invite_id: 'inv9', client_name: 'معهد الأفق', status: 'open', events: [{ at: '2026-11-05T08:00:00Z', type: 'practice_request', eligible: 2, message: 'هيا' }] }],
    miaar_practice_plans: [{ id: 'p1', report_id: 'rp1', invite_id: null, kind: 'placement', status: 'draft', created_at: '2026-10-30T00:00:00Z' }, { id: 'p2', report_id: 'rp2', invite_id: null, kind: 'placement', status: 'draft', created_at: '2026-11-04T00:00:00Z' }],
    placement_decisions: [{ report_id: 'rp1', classroom_id: 'c1', decision_status: 'approved' }, { report_id: 'rp2', classroom_id: 'c2', decision_status: 'approved' }, { report_id: 'rg', classroom_id: null, decision_status: 'review', deadline_at: '2026-11-07T12:00:00Z', decided_at: '2026-11-04T00:00:00Z' }],
    classrooms: [{ id: 'c1', code: 'A2-01', section_name: 'شعبة 1', trainer_id: 't1' }, { id: 'c2', code: 'A2-02', section_name: 'شعبة 2', trainer_id: 't2' }],
    trainers: [{ id: 't1', email: 'Trainer@x.sa' }, { id: 't2', email: 'other@x.sa' }],
    miaar_performances: [{ id: 'pf1', status: 'submitted', adjudication: null, created_at: '2026-11-05T00:00:00Z' }],
    question_bank_items: [{ id: 'q1', status: 'in_review', created_at: '2026-10-20T00:00:00Z' }, { id: 'q2', status: 'approved', created_at: '2026-10-21T00:00:00Z' }],
    miaar_witness_events: [], audit_logs: [{ actor_id: 'u1', action: 'miaar_practice_approve', created_at: new Date().toISOString() }, { actor_id: 'u1', action: 'view', created_at: new Date().toISOString() }, { actor_id: 'u2', action: 'miaar_practice_approve', created_at: new Date().toISOString() }],
    profiles: [{ id: 'u1', email: 'admin@x.sa', role: 'PLATFORM_ADMIN' }, { id: 'u7', email: 'pm@x.sa', role: 'PROGRAM_MANAGER' }, { id: 'u5', email: 'learner@x.sa', role: 'TRAINEE' }],
    portal_learner_notices: [], ...over,
  };
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let cnt = false; let mode: 'select' | 'insert' | 'upsert' = 'select'; let payload: any = null;
    const b: any = { select(_c?: string, o?: any) { if (o?.count) cnt = true; return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; }, not(k: string, op: string, v: any) { if (op === 'is' && v === null) f.push((r) => r[k] != null); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k] || '') >= String(v)); return b; }, ilike(k: string, v: any) { f.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, upsert(p: any) { mode = 'upsert'; payload = p; return b; },
      then(res: any) { if (mode !== 'select') { const arr = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}`, ...p })); if (mode === 'upsert' && table === 'portal_learner_notices') { for (const p of arr) { const i = rows.findIndex((r) => r.dedupe_key === p.dedupe_key); if (i >= 0) { return res({ data: [], error: null }); } rows.push(p); } return res({ data: arr, error: null }); } rows.push(...arr); return res({ data: arr, error: null }); }
        const hit = rows.filter((r) => f.every((p) => p(r))); const data = single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit); return res({ data, error: null, count: cnt ? hit.length : null }); } };
    return b; };
  return { T, from: q, rpc: async () => ({ data: null, error: null }) };
}
const ADMIN = { id: 'u1', email: 'admin@x.sa', role: 'PLATFORM_ADMIN', staff: true, trainer: false, doors: [] as any[] };
const TRAINER = { id: 'u3', email: 'trainer@x.sa', role: 'TRAINER', staff: false, trainer: true, doors: [] as any[] };

test('P50: السجلّ للطاقم — 8 مجموعات مِعيار بأعدادها الصحيحة · الأقدم أولًا · لمسة على الدعوة والشعبة · «وقّعتَ اليوم» من التدقيق · لا أسماء', async () => {
  invalidateSignCache(); const db = fakeDb(); const reg = await collectRegister(db as any, ADMIN, 'https://x', { now: NOW, fresh: true });
  const by = Object.fromEntries(reg.groups.map((g) => [g.key, g]));
  assert.equal(by.practice_exit?.count, 2, 'اثنان لم يجتازا بلا خطّة'); assert.equal(by.practice_exit.items?.[0].id, 'inv1'); assert.deepEqual(by.practice_exit.items?.[0].touch, { action: 'practice_approve_all', body: { invite_id: 'inv1' } });
  assert.equal(by.practice_start?.count, 2); assert.equal(by.practice_start.items?.length, 2); assert.equal(by.practice_start.items?.[0].id, 'c1', 'الأقدم (30 أكتوبر) أولًا'); assert.deepEqual(by.practice_start.items?.[0].touch, { action: 'practice_approve_all', body: { classroom_id: 'c1' } });
  assert.equal(by.client_requests?.count, 1); assert.ok(by.client_requests.urgent); assert.match(by.client_requests.items![0].label_ar, /معهد الأفق — 2 طالبًا · برسالة/); assert.equal(by.client_requests.items![0].touch, undefined, 'طلب الجهة يُقرأ قبل التوقيع — لا لمسة');
  assert.equal(by.rating?.count, 1); assert.equal(by.placement_review?.count, 1); assert.equal(by.placement_review.deadline_days, 2); assert.ok(by.placement_review.urgent, 'المهلة ≤ يومين');
  assert.equal(by.exit_promote?.count, 1, 'r3 اجتاز بلا قرار — r9 تابع لأمر خدمة فلا ترقية'); assert.equal(by.integrity, undefined, 'لا أحداث شاهِد → لا جلسات تستحق المراجعة'); assert.equal(by.bank_review?.count, 1);
  assert.equal(reg.total, 2 + 2 + 1 + 1 + 1 + 1 + 1); assert.equal(reg.groups[0].key, 'bank_review', 'الأقدم: بند 20 أكتوبر'); assert.equal(reg.oldest_days, 17); assert.equal(reg.today_signed, 1, 'approve فقط — لا view ولا توقيع غيره'); assert.equal(reg.scope, 'all');
  assert.ok(!JSON.stringify(reg).includes('سرّي'), 'لا أسماء متعلّمين في السجلّ');
});

test('P50: المدرّب يرى مسوَّدات شُعبه فقط (c1) · لا تصحيح ولا جهات · الذاكرة 45 ث تُتجاوز بـfresh', async () => {
  invalidateSignCache(); const db = fakeDb(); const reg = await collectRegister(db as any, TRAINER, 'https://x', { now: NOW, fresh: true });
  assert.deepEqual(reg.groups.map((g) => g.key), ['practice_start']); assert.equal(reg.groups[0].count, 1); assert.equal(reg.groups[0].items?.[0].id, 'c1'); assert.equal(reg.scope, 'trainer');
  db.T.miaar_practice_plans.push({ id: 'p3', report_id: 'rp1', invite_id: null, kind: 'placement', status: 'draft', created_at: '2026-11-05T00:00:00Z' });
  const cached = await collectRegister(db as any, TRAINER, 'https://x', { now: NOW }); assert.equal(cached.groups[0].count, 1, 'من الذاكرة');
  const fresh = await collectRegister(db as any, TRAINER, 'https://x', { now: NOW, fresh: true }); assert.equal(fresh.groups[0].count, 2);
});

test('P50: «نبض الصباح» — إشعار sign_digest لكل طاقم (لا متعلّم) مرّة في اليوم · لا شيء حين لا ينتظر شيء · dry لا يكتب', async () => {
  invalidateSignCache(); const db = fakeDb(); const r = await runSignDigest(db as any, { now: NOW });
  assert.equal(r.staff, 2); assert.equal(r.sent, 2); assert.equal(r.total, 9); const n = db.T.portal_learner_notices; assert.equal(n.length, 2); assert.ok(n.every((x: any) => x.kind === 'sign_digest' && x.url === '/admin/sign' && x.dedupe_key.startsWith('sign_digest:') && x.dedupe_key.endsWith(':2026-11-06')));
  assert.match(n[0].title_ar, /ينتظر توقيعك اليوم 9 — الأقدم منذ 17 يومًا/); assert.ok(!n.some((x: any) => x.email === 'learner@x.sa'));
  invalidateSignCache(); const r2 = await runSignDigest(db as any, { now: NOW }); assert.equal(r2.sent, 0, 'مرّة في اليوم'); assert.equal(db.T.portal_learner_notices.length, 2);
  invalidateSignCache(); const empty = fakeDb({ placement_invites: [], placement_reports: [], miaar_service_orders: [], miaar_practice_plans: [], placement_decisions: [], miaar_performances: [], question_bank_items: [] }); const r3 = await runSignDigest(empty as any, { now: NOW }); assert.equal(r3.total, 0); assert.equal(r3.sent, 0);
  invalidateSignCache(); const dry = fakeDb(); const r4 = await runSignDigest(dry as any, { now: NOW, dry: true }); assert.equal(r4.sent, 2); assert.equal(dry.T.portal_learner_notices.length, 0);
  assert.deepEqual(STAFF_ROLES, ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST']);
});

test('P50: عقد المصدر — المسار يقبل light/fresh/touch ولا يعتمد بنفسه · الصفحة والعدّاد والصدفتان والكرون', () => {
  const route = read('app/api/admin/sign/route.ts'); assert.match(route, /light.*=== '1'/); assert.match(route, /fresh.*=== '1'/); assert.match(route, /action !== 'touch'/); assert.match(route, /touchFor\(item\)/); assert.match(route, /action: 'sign_touch'/); assert.doesNotMatch(route, /approvePlan|draftPlan/, 'اللمسة لا تعتمد بنفسها — تستدعي الواجهة القائمة');
  assert.match(route, /if \(!me\.staff\) return bad\(/, 'اللمسة للطاقم فقط');
  const board = read('app/admin/sign/SignBoard.tsx'); assert.match(board, /data-testid="sg-total"/); assert.match(board, /data-testid="sg-today"/); assert.match(board, /data-testid="sg-touch"/); assert.match(board, /data-testid="sg-empty"/); assert.match(board, /لا شيء ينتظر توقيعك/); assert.match(board, /window\.confirm/);
  assert.match(read('app/components/PortalShell.tsx'), /<SignCounter lang=\{lang\} \/>/); assert.match(read('app/components/AdminShell.tsx'), /<SignCounter lang="ar" tone="strip" \/>/);
  assert.match(read('app/components/SignCounter.tsx'), /\/api\/admin\/sign\?light=1/); assert.match(read('app/components/SignCounter.tsx'), /r\.status === 403/);
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runSignDigest\(db, \{ site, dry \}\)/); assert.match(cron, /sign_digest/);
  assert.doesNotMatch(read('tests/index.ts'), /\/\/\s*import '\.\/p50-sign\.test'/);
});
