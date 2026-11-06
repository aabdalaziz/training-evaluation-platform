// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م12 «مِران للجهات» — جاهزية الدفعة بلا أسماء · خلية الطالب (أيام/جاهزية لا نسب) · طلب الجهة في events (مرّة في اليوم) · رسالة الجهة تُنقّى · إشعار الطاقم · «بطلب من جهة» في الأدلة · لا تُفتح خطّة بطلب الجهة وحده */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CLIENT_MSG_MAX, PLAN_DAYS, READY_AR, READY_START_AR,
  cohortReadiness, clientPracticeCell, lastClientRequest, normalizeClientMessage, summariesForReports, practiceFactsForReports,
} from '../lib/miaar/practice';
import type { PlanSummary } from '../lib/miaar/practice';
import { noticeText, KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { practiceText } from '../lib/accreditation/miaar';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const S = (over: Partial<PlanSummary> = {}): PlanSummary => ({ id: 'p', kind: 'exit', status: 'approved', status_ar: 'معتمدة', today: 5, ended: false, done: 4, total: PLAN_DAYS, last_attempt_at: null, idle_days: 0, avg_delta: 10, ready: 'early', units: ['B1-U01'], skill: null, start_date: '2026-11-01', approved_at: '2026-11-01T08:00:00.000Z', ...over });

test('م12: جاهزية الدفعة — تعدّ المعتمدة والمنتهية فقط، تستبعد المسوَّدات والملغاة، نسبة الجاهز من كل الخطط، ومتوسط التحسّن بلا أسماء', () => {
  const c = cohortReadiness({ a: S({ ready: 'ready', avg_delta: 20 }), b: S({ ready: 'close', avg_delta: 0 }), c: S({ ready: null, avg_delta: null }), d: S({ status: 'draft', ready: 'ready' }), e: S({ status: 'cancelled' }), f: S({ status: 'done', ended: true, ready: 'ready', done: 14, avg_delta: 10 }) });
  assert.equal(c.plans, 4); assert.equal(c.active, 3, 'المنتهية ليست نشطة'); assert.equal(c.ready, 2); assert.equal(c.close, 1); assert.equal(c.early, 1, 'بلا جاهزية = في البداية');
  assert.equal(c.ready_pct, 50); assert.equal(c.avg_delta, 10); assert.equal(c.days_done, 4 * 3 + 14);
  const z = cohortReadiness({}); assert.equal(z.plans, 0); assert.equal(z.ready_pct, null); assert.equal(z.avg_delta, null);
});

test('م12: خلية الطالب للجهة — أيام وجاهزية فقط، لا نسب ولا وحدات ولا متوسط تحسّن؛ المسوَّدة والملغاة لا تظهر؛ نصّ الجاهزية بحسب النوع', () => {
  const c = clientPracticeCell(S({ ready: 'ready' }))!; assert.ok(c);
  assert.deepEqual(Object.keys(c).sort(), ['done', 'ready', 'ready_ar', 'status', 'status_ar', 'today', 'total'].sort(), 'لا avg_delta ولا units في ما تراه الجهة');
  assert.equal(c.ready_ar, READY_AR.ready); assert.equal(c.today, 5); assert.equal(c.done, 4); assert.equal(c.total, 14);
  assert.equal(clientPracticeCell(S({ kind: 'placement', ready: 'close' }))!.ready_ar, READY_START_AR.close, 'مِران البداية بصياغته');
  assert.equal(clientPracticeCell(S({ ready: null }))!.ready_ar, null);
  assert.equal(clientPracticeCell(S({ status: 'draft' })), null); assert.equal(clientPracticeCell(S({ status: 'cancelled' })), null); assert.equal(clientPracticeCell(null), null);
});

test('م12: آخر طلب من الجهة يُقرأ من events أمر الخدمة — الأحدث يفوز، الرسالة تُقصّ، لا طلب → null', () => {
  assert.equal(lastClientRequest(null), null); assert.equal(lastClientRequest([{ type: 'status', at: 'x' }]), null);
  const r = lastClientRequest([{ type: 'practice_request', at: '2026-11-01T00:00:00Z', message: 'أولى', eligible: 3 }, { type: 'proctor_signed', at: 'y' }, { type: 'practice_request', at: '2026-11-03T00:00:00Z', message: 'م'.repeat(400), eligible: '5', by: 'client:1.2.3.4' }])!;
  assert.equal(r.at, '2026-11-03T00:00:00Z'); assert.equal(r.eligible, 5); assert.equal(r.by, 'client:1.2.3.4'); assert.equal(r.message!.length, CLIENT_MSG_MAX);
});

test('م12: رسالة الجهة لطلابها — تُنقّى من الوسوم والروابط، تُدمج المسافات، فارغة → null، أطول من 200 → خطأ، غير نصّ → خطأ', () => {
  assert.deepEqual(normalizeClientMessage(undefined), { ok: true, text: null }); assert.deepEqual(normalizeClientMessage(''), { ok: true, text: null });
  assert.deepEqual(normalizeClientMessage('  نفخر   بكم <b>جدًّا</b> https://x.y/z  '), { ok: true, text: 'نفخر بكم جدًّا' });
  assert.deepEqual(normalizeClientMessage('<script>a</script>'), { ok: true, text: 'a' });
  assert.equal((normalizeClientMessage('ن'.repeat(201)) as any).error, 'message_too_long'); assert.equal((normalizeClientMessage(5) as any).error, 'bad_message');
  assert.equal(CLIENT_MSG_MAX, 200);
});

test('م12: إشعار «طلب مِران من جهة» للطاقم — اسم الجهة والعدد ورسالتهم، رابط لوحة عُبور على قسم مِران، لا نتائج؛ ونوعه مسجّل بأيقونة 🏢', () => {
  const t = noticeText({ kind: 'practice_requested', client: 'جامعة أَثَر', n: 7, inviteId: 'inv-9', message: 'ربع ساعة يوميًا تكفي' });
  assert.match(t.title_ar, /جامعة أَثَر/); assert.match(t.title_ar, /7/); assert.match(t.body_ar, /ربع ساعة يوميًا تكفي/); assert.match(t.body_ar, /لا تُفتح خطّة بطلب الجهة وحده/);
  assert.equal(t.url, '/admin/miaar/exit?invite=inv-9#xb-practice');
  const t2 = noticeText({ kind: 'practice_requested', client: 'ج', n: 1, inviteId: 'i', message: null }); assert.ok(!t2.body_ar.includes('رسالتهم'));
  assert.equal(KIND_AR.practice_requested, 'طلب مِران من جهة'); assert.equal(KIND_ICON.practice_requested, '🏢');
});

/** قاعدة بيانات وهمية صغيرة لاختبار «بطلب من جهة» */
function fakeDb(T: Record<string, any[]>) {
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is() { return b; }, lte() { return b; }, gte() { return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      then(res: any) { const hit = rows.filter((r) => f.every((p) => p(r))); return res({ data: single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit), error: null }); } };
    return b; };
  return { T, from: q, rpc: async () => ({ data: null, error: null }) };
}
const PLAN = (id: string, report_id: string, invite_id: string, approved_at: string, status = 'approved') => ({ id, kind: 'exit', report_id, invite_id, email: `${id}@x.sa`, user_id: null, level: 'B1', skill: null, units: ['B1-U01'], days: Array.from({ length: PLAN_DAYS }, (_, i) => ({ d: i + 1, unit: 'B1-U01', done_at: null })), status, created_by: 'u1', approved_by: 'u1', approved_at, start_date: approved_at.slice(0, 10), last_attempt_at: null, created_at: approved_at, updated_at: approved_at });
const EXIT_REP = (id: string) => ({ id, report: { المستوى_العام: 'B1', بيانات_المتقدم: { الاسم: 'ن' }, exit: { الحالة: 'final', النتيجة: 'failed', المستوى: 'B1' } } });

test('م12: خطّة اعتُمدت بعد «طلب مِران» من الجهة تُعدّ «بطلب من جهة» — وما قبل الطلب أو بلا أمر خدمة لا؛ وتظهر في أدلة الاعتماد', async () => {
  const db = fakeDb({
    miaar_practice_plans: [PLAN('p1', 'r1', 'invA', '2026-11-05T10:00:00.000Z'), PLAN('p2', 'r2', 'invA', '2026-11-01T10:00:00.000Z'), PLAN('p3', 'r3', 'invB', '2026-11-05T10:00:00.000Z'), PLAN('p4', 'r4', 'invA', '2026-11-06T10:00:00.000Z', 'draft')],
    miaar_practice_attempts: [], miaar_syllabus_units: [], question_bank_items: [], question_bank_answer_keys: [],
    miaar_service_orders: [{ id: 'o1', invite_id: 'invA', client_name: 'جامعة أَثَر', events: [{ at: '2026-11-03T09:00:00.000Z', type: 'practice_request', message: 'هيا', eligible: 2 }] }],
  });
  const sums = await summariesForReports(db as any, [EXIT_REP('r1'), EXIT_REP('r2'), EXIT_REP('r3'), EXIT_REP('r4')]);
  assert.equal(sums.r1.client_requested, true, 'اعتُمدت بعد الطلب'); assert.equal(sums.r2.client_requested, false, 'اعتُمدت قبل الطلب'); assert.equal(sums.r3.client_requested, false, 'دعوة أخرى بلا طلب');
  assert.equal(sums.r1.approved_at, '2026-11-05T10:00:00.000Z', 'approved_at يُعرض لحساب «اعتُمدت بعد طلبكم»');
  const f = await practiceFactsForReports(db as any, [EXIT_REP('r1'), EXIT_REP('r2'), EXIT_REP('r3'), EXIT_REP('r4')]);
  assert.equal(f.approved, 3); assert.equal(f.client_requested, 1);
  const txt = practiceText(f as any); assert.match(txt, /منها 1 بطلب من جهة/); assert.doesNotMatch(practiceText({ ...f, client_requested: 0 } as any), /بطلب من جهة/);
});

test('م12: عقد المصدر — المسار العام يقبل practice_request ولا يفتح خطّة؛ approve_all يقبل day1_note بحدّ NOTE_MAX؛ بوابة الجهة لا تعرض نسب مِران؛ CSV +2 عمودان؛ شارة «طلب مِران معلّق»', () => {
  const route = read('app/api/miaar/client/route.ts'); assert.match(route, /action === 'practice_request'/); assert.match(route, /requestPractice\(/); assert.doesNotMatch(route, /approvePlan|draftPlan/, 'لا اعتماد من مسار الجهة');
  assert.match(route, /'مِران: الأيام المنجزة', 'مِران: الجاهزية'/);
  const svc = read('lib/miaar/service.ts'); assert.match(svc, /export async function requestPractice/); assert.match(svc, /type: 'practice_request'/); assert.match(svc, /kind: 'practice_requested'/); assert.match(svc, /miaar_practice_client_request/); assert.doesNotMatch(svc.slice(svc.indexOf('export async function requestPractice')), /approvePlan|draftPlan/, 'طلب الجهة يسجّل ويُشعر فقط');
  assert.match(svc, /can_request: eligible > 0 && !closedWindow/, 'لا طلب بعد التسليم/الإغلاق');
  const admin = read('app/api/admin/miaar/practice/route.ts'); assert.match(admin, /b\.day1_note/); assert.match(admin, /slice\(0, NOTE_MAX\)/); assert.match(admin, /client_request/);
  const cb = read('app/miaar/client/ClientBoard.tsx'); assert.match(cb, /action: 'practice_request'/); assert.match(cb, /data-testid="cb-miran"/); assert.match(cb, /data-testid="cb-row-practice"/); assert.match(cb, /maxLength=\{200\}/); assert.doesNotMatch(cb, /r\.practice\.avg_delta|r\.practice\.percent/, 'لا نسب فردية');
  const pp = read('app/admin/miaar/PracticePanel.tsx'); assert.match(pp, /data-testid="pr-client-request"/); assert.match(pp, /pr-approve-all-msg/); assert.match(pp, /pr-approve-all-plain/); assert.match(pp, /day1_note: day1Note/);
  const am = read('app/admin/miaar/AdminMiaar.tsx'); assert.match(am, /mm-practice-req/); assert.match(am, /طلب مِران معلّق/);
  assert.doesNotMatch(read('tests/index.ts'), /\/\/\s*import '\.\/miaar-m12\.test'/);
});
