// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P39 «إشعارات المتعلّم» — النصوص (بلا درجات) · الحفظ مرّة واحدة (dedupe) · الدفعة باشتراك «نبّهني» المجهول · ساعات الهدوء · القراءة · «أُبلغ؟» · التذكيرات اليومية · الجمهور · الملفّات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { noticeText, pushNotice, listNotices, markRead, unreadCount, noticeReach, runNoticeReminders, publicNotice, KIND_AR, KIND_ICON, SKILL_AR, isEmail } from '../lib/portal/notices';
import type { NoticeKind } from '../lib/portal/notices';
import { pushSubsFor } from '../lib/portal/notify';
import { generateVapidKeys } from '../lib/portal/push';
import { remedialAudience } from '../lib/miaar/remedial';
import { announceExitFinal } from '../lib/miaar/room';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* قاعدة وهمية تكفي ما تستخدمه الوحدة: eq/in/is/neq/gte/lte/order/limit/maybeSingle/single + upsert(onConflict, ignoreDuplicates) + update().select() */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = { profiles: [], trainers: [], classrooms: [], portal_contact_prefs: [], portal_push_subscriptions: [], portal_learner_notices: [], placement_invites: [], placement_reports: [], placement_invite_recipients: [], portal_sessions: [], ...seed }; let n = 1;
  function q(table: string) {
    const rows = () => (T[table] = T[table] || []); const f: ((r: any) => boolean)[] = []; let op: 'select' | 'insert' | 'update' | 'upsert' = 'select'; let payload: any = null; let lim = 0; let single: 'maybe' | 'one' | null = null; let ups: any = {};
    const run = () => {
      let out: any[]; const list = () => (Array.isArray(payload) ? payload : [payload]);
      if (op === 'insert') { out = list().map((r: any) => ({ id: `n${n++}`, created_at: new Date().toISOString(), ...r })); rows().push(...out); }
      else if (op === 'upsert') {
        out = []; const keys = String(ups.onConflict || 'id').split(',');
        for (const r of list()) { const ex = rows().find((x) => keys.every((k) => String(x[k]) === String(r[k]))); if (ex) { if (!ups.ignoreDuplicates) { Object.assign(ex, r); out.push(ex); } } else { const row = { id: `n${n++}`, created_at: new Date().toISOString(), read_at: null, pushed: false, ...r }; rows().push(row); out.push(row); } }
      }
      else if (op === 'update') { out = rows().filter((r) => f.every((x) => x(r))); out.forEach((r) => Object.assign(r, payload)); }
      else out = rows().filter((r) => f.every((x) => x(r)));
      if (lim) out = out.slice(0, lim);
      const data = single ? (out[0] ?? null) : out; return { data, error: single === 'one' && !out[0] ? { message: 'no rows' } : null, count: out.length };
    };
    const b: any = {
      select() { return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; },
      is(k: string, v: any) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; }, gte(k: string, v: any) { f.push((r) => r[k] >= v); return b; }, lte(k: string, v: any) { f.push((r) => r[k] <= v); return b; },
      order() { return b; }, limit(x: number) { lim = x; return b; }, maybeSingle() { single = 'maybe'; return b; }, single() { single = 'one'; return b; },
      insert(p: any) { op = 'insert'; payload = p; return b; }, update(p: any) { op = 'update'; payload = p; return b; }, upsert(p: any, o: any) { op = 'upsert'; payload = p; ups = o || {}; return b; },
      then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
    };
    return b;
  }
  return { from: q, T };
}
const keys = generateVapidKeys();
const ENV = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:a@b.c', NEXT_PUBLIC_SITE_URL: 'https://athar-portal.vercel.app' } as unknown as NodeJS.ProcessEnv;
const SUB = (endpoint: string, extra: any = {}) => ({ id: endpoint, endpoint: `https://push.example/${endpoint}`, p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg', lang: 'ar', active: true, failures: 0, ...extra });
const fetchStub = (calls: string[], status = 201) => (async (url: any) => { calls.push(String(url)); return new Response('', { status }); }) as unknown as typeof fetch;

test('p39: noticeText — عربي بلا درجات؛ كل نوع له عنوان ورابط صحيح', () => {
  const f = noticeText({ kind: 'exit_final', level: 'A2', outcome: 'passed', code: 'ML-ABCD-EFGH' });
  assert.equal(f.title_ar, 'صدر حكم عبورك من A2'); assert.equal(f.url, '/miaar/result/ML-ABCD-EFGH'); assert.ok(!/\d+\s*%/.test(f.body_ar), 'لا نسب مئوية في الإشعار');
  assert.match(noticeText({ kind: 'exit_final', level: 'B1', outcome: 'conditional', code: 'X' }).body_ar, /مشروط/); assert.match(noticeText({ kind: 'exit_final', level: 'B1', outcome: 'failed', code: 'X' }).body_ar, /لم يُجتَز/);
  const r = noticeText({ kind: 'retake_open', skill: 'writing', until: '2026-11-20T00:00:00Z', inviteUrl: '/miaar/d/ABCD' }); assert.equal(r.title_ar, 'فُتحت لك إعادة مهارة الكتابة'); assert.match(r.body_ar, /حتى/); assert.equal(r.url, '/miaar/d/ABCD');
  assert.match(noticeText({ kind: 'retake_rem3', skill: 'speaking', until: null, inviteUrl: '/x', days: 3 }).title_ar, /بقي 3 أيام على إعادة المحادثة/); assert.match(noticeText({ kind: 'retake_rem1', skill: 'reading', until: null, inviteUrl: '/x', days: 1 }).title_ar, /آخر يوم/);
  const m = noticeText({ kind: 'remedial_new', title: 'جلسة مراجعة — الأماكن', starts_at: '2026-11-10T07:00:00Z', units: ['أ', 'ب', 'ج', 'د'], joinUrl: null }); assert.match(m.title_ar, /جلسة تعويض لك/); assert.match(m.body_ar, /أ، ب، ج…/); assert.equal(m.url, '/me');
  assert.match(noticeText({ kind: 'remedial_tmrw', title: 'ت', starts_at: '2026-11-10T07:00:00Z' }).title_ar, /^غدًا: ت/);
  const p = noticeText({ kind: 'promoted', from: 'A1', to: 'A2', code: 'ML-1' }); assert.equal(p.title_ar, 'رُقّيت من A1 إلى A2'); assert.equal(p.url, '/miaar/certificate/ML-1');
  assert.match(noticeText({ kind: 'placed', classroom: 'SEC-01', program: 'العربية' }).body_ar, /برنامج العربية/);
  const s = noticeText({ kind: 'exit_summary', invite: 'عُبور A1', final: 3, total: 10, passed: 2, conditional: 1, failed: 0, inviteId: 'inv1' }); assert.equal(s.title_ar, 'عُبور A1: صدرت 3 من 10 نتيجة'); assert.match(s.url, /\/admin\/miaar\/exit\?invite=inv1/);
});

test('p39: المعاجم — كل نوع له اسم وأيقونة · المهارات الخمس · isEmail', () => {
  const kinds: NoticeKind[] = ['exit_final', 'retake_open', 'retake_rem3', 'retake_rem1', 'remedial_new', 'remedial_tmrw', 'promoted', 'placed', 'exit_summary', 'custom'];
  for (const k of kinds) { assert.ok(KIND_AR[k], k); assert.ok(KIND_ICON[k], k); }
  assert.equal(Object.keys(SKILL_AR).length, 5); assert.equal(SKILL_AR.grammar_vocab, 'القواعد والمفردات');
  assert.ok(isEmail('A@b.co')); assert.ok(!isEmail('')); assert.ok(!isEmail('x'));
});

test('p39: pushNotice — يُحفظ مرّة واحدة لكل dedupe_key · البريد يُطبَّع · بلا بريد لا شيء · dry لا يكتب', async () => {
  const db = fakeDb();
  const a = await pushNotice(db, { email: 'Sara@Example.com ', kind: 'exit_final', title_ar: 'ع', body_ar: 'ن', dedupe_key: 'exit_final:r1', report_id: 'r1' }, { env: {} as any });
  assert.equal(a.inserted, true); assert.equal(a.pushed, false); assert.ok(a.id);
  const b = await pushNotice(db, { email: 'sara@example.com', kind: 'exit_final', title_ar: 'ع2', body_ar: 'ن', dedupe_key: 'exit_final:r1' }, { env: {} as any });
  assert.equal(b.inserted, false); assert.equal(b.reason, 'duplicate');
  assert.equal(db.T.portal_learner_notices.length, 1); assert.equal(db.T.portal_learner_notices[0].email, 'sara@example.com'); assert.equal(db.T.portal_learner_notices[0].title_ar, 'ع');
  const c = await pushNotice(db, { email: '', kind: 'placed', title_ar: 'x', dedupe_key: 'k' }); assert.equal(c.reason, 'no_email');
  const d = await pushNotice(db, { email: 'z@z.z', kind: 'placed', title_ar: 'x', dedupe_key: 'k2' }, { dry: true }); assert.equal(d.inserted, true); assert.equal(d.reason, 'dry'); assert.equal(db.T.portal_learner_notices.length, 1);
});

test('p39: الدفعة — اشتراك «نبّهني» المجهول (بالبريد) يكفي؛ pushed=true؛ ولا دفعة حين push:false أو بلا VAPID', async () => {
  const db = fakeDb({ portal_push_subscriptions: [SUB('e1', { email: 'sara@example.com', user_id: null })] }); const calls: string[] = [];
  const a = await pushNotice(db, { email: 'sara@example.com', kind: 'retake_open', title_ar: 'ع', body_ar: 'ن', url: '/miaar/d/AB', dedupe_key: 'k1' }, { env: ENV, fetchImpl: fetchStub(calls) });
  assert.equal(a.pushed, true); assert.equal(calls.length, 1); assert.match(calls[0], /push\.example\/e1/); assert.equal(db.T.portal_learner_notices[0].pushed, true); assert.ok(db.T.portal_push_subscriptions[0].last_sent_at);
  const b = await pushNotice(db, { email: 'sara@example.com', kind: 'exit_summary', title_ar: 'م', dedupe_key: 'k2', push: false }, { env: ENV, fetchImpl: fetchStub(calls) });
  assert.equal(b.inserted, true); assert.equal(b.pushed, false); assert.equal(calls.length, 1, 'لا نداء');
  const c = await pushNotice(db, { email: 'sara@example.com', kind: 'placed', title_ar: 'م', dedupe_key: 'k3' }, { env: {} as any, fetchImpl: fetchStub(calls) });
  assert.equal(c.inserted, true); assert.equal(c.pushed, false);
  /* اشتراك ميت (410) يُعطَّل */
  const db2 = fakeDb({ portal_push_subscriptions: [SUB('dead', { email: 'x@y.z' })] }); const r = await pushNotice(db2, { email: 'x@y.z', kind: 'placed', title_ar: 'م', dedupe_key: 'k' }, { env: ENV, fetchImpl: fetchStub([], 410) });
  assert.equal(r.pushed, false); assert.equal(db2.T.portal_push_subscriptions[0].active, false);
});

test('p39: الدفعة تحترم push_ok=false وساعات الهدوء — الصفّ يُحفظ والدفعة تُحجب', async () => {
  const calls: string[] = [];
  const db = fakeDb({ portal_push_subscriptions: [SUB('e1', { email: 'q@q.q' })], portal_contact_prefs: [{ email: 'q@q.q', push_ok: false }] });
  const a = await pushNotice(db, { email: 'q@q.q', kind: 'placed', title_ar: 'م', dedupe_key: 'a' }, { env: ENV, fetchImpl: fetchStub(calls) }); assert.equal(a.inserted, true); assert.equal(a.pushed, false); assert.equal(calls.length, 0);
  const db2 = fakeDb({ portal_push_subscriptions: [SUB('e1', { email: 'h@h.h' })], portal_contact_prefs: [{ email: 'h@h.h', quiet_from: '22:00', quiet_to: '07:00' }] });
  const b = await pushNotice(db2, { email: 'h@h.h', kind: 'placed', title_ar: 'م', dedupe_key: 'b' }, { env: ENV, fetchImpl: fetchStub(calls), now: new Date('2026-11-05T21:30:00Z') /* 00:30 بالرياض */ }); assert.equal(b.pushed, false); assert.equal(calls.length, 0);
  const c = await pushNotice(db2, { email: 'h@h.h', kind: 'placed', title_ar: 'م', dedupe_key: 'c' }, { env: ENV, fetchImpl: fetchStub(calls), now: new Date('2026-11-05T09:00:00Z') }); assert.equal(c.pushed, true); assert.equal(calls.length, 1);
});

test('p39: merge — ملخّص المدرّب يتحدّث نصّه ويعود غير مقروء بدل التجاهل', async () => {
  const db = fakeDb();
  await pushNotice(db, { email: 't@t.t', kind: 'exit_summary', title_ar: 'صدرت 1 من 5', dedupe_key: 'exit_summary:i1:t@t.t', push: false, merge: true });
  await markRead(db, 't@t.t', 'all'); assert.ok(db.T.portal_learner_notices[0].read_at);
  const r = await pushNotice(db, { email: 't@t.t', kind: 'exit_summary', title_ar: 'صدرت 2 من 5', dedupe_key: 'exit_summary:i1:t@t.t', push: false, merge: true });
  assert.equal(r.inserted, true); assert.equal(db.T.portal_learner_notices.length, 1); assert.equal(db.T.portal_learner_notices[0].title_ar, 'صدرت 2 من 5'); assert.equal(db.T.portal_learner_notices[0].read_at, null);
});

test('p39: القراءة — listNotices بالبريد/التقرير · unreadCount · markRead بمعرّفات أو الكل · publicNotice بلا بريد', async () => {
  const db = fakeDb();
  await pushNotice(db, { email: 'a@a.a', kind: 'exit_final', title_ar: '1', dedupe_key: 'k1', report_id: 'r1' });
  await pushNotice(db, { email: 'a@a.a', kind: 'placed', title_ar: '2', dedupe_key: 'k2', report_id: 'r2' });
  await pushNotice(db, { email: 'b@b.b', kind: 'placed', title_ar: '3', dedupe_key: 'k3' });
  assert.equal((await listNotices(db, 'A@a.a')).length, 2); assert.equal((await listNotices(db, 'a@a.a', { report_id: 'r1' })).length, 1); assert.equal(await unreadCount(db, 'a@a.a'), 2);
  const first = (await listNotices(db, 'a@a.a', { report_id: 'r1' }))[0]; assert.equal(await markRead(db, 'a@a.a', [first.id]), 1); assert.equal(await unreadCount(db, 'a@a.a'), 1);
  assert.equal(await markRead(db, 'a@a.a', []), 0); assert.equal(await markRead(db, 'a@a.a', 'all'), 1); assert.equal(await unreadCount(db, 'a@a.a'), 0); assert.equal(await unreadCount(db, 'b@b.b'), 1, 'لا يمسّ غيره');
  const pub = publicNotice(first); assert.deepEqual(Object.keys(pub), ['id', 'النوع', 'العنوان', 'النصّ', 'الرابط', 'في', 'دُفع', 'قُرئ']); assert.ok(!JSON.stringify(pub).includes('a@a.a'));
});

test('p39: noticeReach — «أُبلغ؟» لكل بريد: العدد · دُفع · الأحدث · اشتراك فعّال', async () => {
  const db = fakeDb({ portal_push_subscriptions: [SUB('s', { email: 'b@b.b' }), SUB('dead', { email: 'c@c.c', active: false })] });
  await pushNotice(db, { email: 'a@a.a', kind: 'exit_final', title_ar: '1', dedupe_key: 'k1' }); db.T.portal_learner_notices[0].pushed = true; db.T.portal_learner_notices[0].created_at = '2026-01-01T00:00:00Z';
  await pushNotice(db, { email: 'a@a.a', kind: 'placed', title_ar: '2', dedupe_key: 'k2' });
  const r = await noticeReach(db, ['A@a.a', 'b@b.b', 'c@c.c', 'bad']);
  assert.equal(r['a@a.a'].count, 2); assert.equal(r['a@a.a'].pushed, true); assert.equal(r['a@a.a'].sub, false); assert.ok(r['a@a.a'].last_at);
  assert.equal(r['b@b.b'].count, 0); assert.equal(r['b@b.b'].sub, true); assert.equal(r['c@c.c'].sub, false); assert.equal(r.bad, undefined);
});

test('p39: pushSubsFor — يجمع اشتراكات الحساب واشتراكات البريد (المجهولة) فريدةً بالنقطة', async () => {
  const db = fakeDb({ profiles: [{ id: 'u1', email: 'a@a.a' }], portal_push_subscriptions: [SUB('x', { user_id: 'u1', email: null }), SUB('x', { user_id: null, email: 'a@a.a' }), SUB('y', { user_id: null, email: 'a@a.a' }), SUB('z', { user_id: null, email: 'a@a.a', active: false })] });
  const subs = await pushSubsFor(db, 'A@a.a', null); assert.deepEqual(subs.map((s) => s.endpoint).sort(), ['https://push.example/x', 'https://push.example/y']);
  assert.equal((await pushSubsFor(db, 'none@n.n', null)).length, 0);
});

test('p39: runNoticeReminders — «بقي 3 أيام» ثم «آخر يوم» مرّة لكل دعوة · المدموجة تُستثنى · جلسة التعويض «غدًا» لجمهور remedial_new', async () => {
  const now = new Date('2026-11-05T06:00:00Z');
  const rep = (id: string, extra: any = {}) => ({ id, candidate_email: `${id}@x.x`, user_id: null, report: { exit: { الحالة: 'final', النتيجة: 'conditional', مهارة_الإعادة: 'writing', الإعادة: { المهارة: 'writing', الحالة: 'invited' } }, ...extra } });
  const db = fakeDb({
    placement_reports: [rep('r1'), rep('r2'), rep('r3', { exit: { الحالة: 'final', الإعادة: { المهارة: 'writing', الحالة: 'merged' } } })],
    placement_invites: [
      { id: 'i1', code: 'C1', status: 'open', purpose: 'skill_retake', retake_of: 'r1', expires_at: '2026-11-07T12:00:00Z' }, /* بعد يومين ونصف → rem3 */
      { id: 'i2', code: 'C2', status: 'open', purpose: 'skill_retake', retake_of: 'r2', expires_at: '2026-11-05T20:00:00Z' }, /* اليوم → rem1 */
      { id: 'i3', code: 'C3', status: 'open', purpose: 'skill_retake', retake_of: 'r3', expires_at: '2026-11-06T12:00:00Z' }, /* مدموجة */
      { id: 'i4', code: 'C4', status: 'open', purpose: 'skill_retake', retake_of: 'r1', expires_at: '2026-11-15T12:00:00Z' }, /* بعيدة */
      { id: 'i5', code: 'C5', status: 'closed', purpose: 'skill_retake', retake_of: 'r1', expires_at: '2026-11-06T12:00:00Z' },
    ],
    portal_sessions: [{ id: 's1', kind: 'remedial', status: 'scheduled', title_ar: 'جلسة مراجعة — الأماكن', starts_at: '2026-11-06T07:00:00Z', join_url: 'https://t.example/j' }, { id: 's2', kind: 'remedial', status: 'scheduled', title_ar: 'بعيدة', starts_at: '2026-11-09T07:00:00Z' }],
    portal_learner_notices: [{ id: 'old', email: 'r1@x.x', kind: 'remedial_new', ref_id: 's1', dedupe_key: 'remedial_new:s1:r1@x.x', title_ar: 'x', read_at: null, created_at: '2026-11-01T00:00:00Z' }],
  });
  const a = await runNoticeReminders(db, { now, env: {} as any });
  assert.deepEqual(a.errors, []); assert.equal(a.retake.checked, 3); assert.equal(a.retake.sent, 2); assert.equal(a.remedial.checked, 1); assert.equal(a.remedial.sent, 1);
  const kinds = db.T.portal_learner_notices.map((n) => `${n.kind}:${n.email}`).sort(); assert.deepEqual(kinds, ['remedial_new:r1@x.x', 'remedial_tmrw:r1@x.x', 'retake_rem1:r2@x.x', 'retake_rem3:r1@x.x']);
  const tm = db.T.portal_learner_notices.find((n) => n.kind === 'remedial_tmrw'); assert.equal(tm.url, 'https://t.example/j'); assert.match(tm.title_ar, /^غدًا:/);
  const b = await runNoticeReminders(db, { now: new Date('2026-11-05T07:00:00Z'), env: {} as any }); assert.equal(b.retake.sent, 0); assert.equal(b.remedial.sent, 0, 'إعادة التشغيل لا تكرّر');
  /* بعد يومين: i1 تصبح «آخر يوم» → مفتاح جديد */
  const c = await runNoticeReminders(db, { now: new Date('2026-11-07T06:00:00Z'), env: {} as any }); assert.equal(c.retake.sent, 1); assert.ok(db.T.portal_learner_notices.some((n) => n.kind === 'retake_rem1' && n.email === 'r1@x.x'));
});

test('p39: remedialAudience — تقاطع الوحدات الضعيفة/المراقبة؛ وبلا خريطة: من لم يجتز أو اجتاز بشرط؛ بلا تكرار', () => {
  const rows = [
    { email: 'A@a.a', report_id: 'r1', exit: { النتيجة: 'passed', الوحدات: [{ الرمز: 'A1-U03', الحالة: 'weak' }, { الرمز: 'A1-U05', الحالة: 'ok' }] } },
    { email: 'b@b.b', report_id: 'r2', exit: { النتيجة: 'passed', الوحدات: [{ الرمز: 'A1-U05', الحالة: 'ok' }] } },
    { email: 'c@c.c', report_id: 'r3', exit: { النتيجة: 'failed' } },
    { email: 'd@d.d', report_id: 'r4', exit: { النتيجة: 'passed' } },
    { email: 'e@e.e', report_id: null, exit: { النتيجة: 'failed' } },
    { email: 'a@a.a', report_id: 'r9', exit: { النتيجة: 'failed' } },
    { email: 'f@f.f', report_id: 'r6', exit: { النتيجة: 'passed', الوحدات: [{ الرمز: 'a1-u03', الحالة: 'watch' }] } },
  ];
  assert.deepEqual(remedialAudience(rows, ['A1-U03']).map((r) => r.email), ['a@a.a', 'c@c.c', 'f@f.f']);
  assert.deepEqual(remedialAudience(rows, ['A1-U05']).map((r) => r.email), ['c@c.c', 'a@a.a'], 'محاولة ثانية بلا خريطة ولم تجتز → تُبلَّغ');
});

test('p39: announceExitFinal — المتعلّم يُبلَّغ بالحكم (بلا درجات) · منشئ الدعوة ومدرّب القاعة ملخّص داخل أَثَر فقط يتحدّث مع كل نتيجة', async () => {
  const db = fakeDb({
    profiles: [{ id: 'u1', email: 'admin@upm.edu.sa' }], trainers: [{ id: 't1', email: 'trainer@upm.edu.sa' }], classrooms: [{ id: 'c5', trainer_id: 't1' }],
    placement_invites: [{ id: 'inv1', label_ar: 'عُبور A1 — SEC-01', code: 'ABCD', created_by: 'u1', classroom_id: 'c5' }],
    placement_invite_recipients: [{ id: 1, invite_id: 'inv1' }, { id: 2, invite_id: 'inv1' }, { id: 3, invite_id: 'inv1' }],
    placement_reports: [{ id: 'r1', invite_id: 'inv1', report: { exit: { الحالة: 'final', النتيجة: 'passed', الكلي: 81 } } }, { id: 'r2', invite_id: 'inv1', report: { exit: { الحالة: 'pending' } } }],
  });
  await announceExitFinal(db, { reportId: 'r1', email: 'sara@x.x', userId: null, code: 'ML-2345-6789', inviteId: 'inv1', exit: { المستوى: 'A1', النتيجة: 'passed', الكلي: 81 } });
  const L = db.T.portal_learner_notices; const mine = L.find((n) => n.email === 'sara@x.x'); assert.ok(mine); assert.equal(mine.kind, 'exit_final'); assert.equal(mine.url, '/miaar/result/ML-2345-6789'); assert.ok(!mine.body_ar.includes('81') && !mine.title_ar.includes('81'), 'لا درجات');
  const staff = L.filter((n) => n.kind === 'exit_summary').map((n) => n.email).sort(); assert.deepEqual(staff, ['admin@upm.edu.sa', 'trainer@upm.edu.sa']);
  const s = L.find((n) => n.email === 'admin@upm.edu.sa'); assert.equal(s.title_ar, 'عُبور A1 — SEC-01: صدرت 1 من 3 نتيجة'); assert.equal(s.pushed, false);
  db.T.placement_reports[1].report.exit = { الحالة: 'final', النتيجة: 'conditional' };
  await announceExitFinal(db, { reportId: 'r2', email: 'omar@x.x', userId: null, code: 'ML-2345-6780', inviteId: 'inv1', exit: { المستوى: 'A1', النتيجة: 'conditional' } });
  assert.equal(L.filter((n) => n.kind === 'exit_summary').length, 2, 'الملخّص يتحدّث لا يتكرّر'); assert.equal(L.find((n) => n.email === 'admin@upm.edu.sa').title_ar, 'عُبور A1 — SEC-01: صدرت 2 من 3 نتيجة'); assert.match(L.find((n) => n.email === 'admin@upm.edu.sa').body_ar, /اجتاز 1 · مشروط 1/);
  await announceExitFinal(db, { reportId: 'r1', email: 'sara@x.x', userId: null, code: 'ML-2345-6789', inviteId: 'inv1', exit: { المستوى: 'A1', النتيجة: 'passed' } }); assert.equal(L.filter((n) => n.email === 'sara@x.x').length, 1, 'لا تكرار للمتعلّم');
});

test('p39: الهجرة — جدول واحد · dedupe فريد · فهرس البريد · RLS · reload schema · تشخيص', () => {
  const sql = read('supabase/migrations/20270204_portal_p39_learner_notices.sql');
  assert.match(sql, /create table if not exists public\.portal_learner_notices/); assert.match(sql, /create unique index if not exists pln_dedupe_uq .*\(dedupe_key\)/); assert.match(sql, /pln_email_idx .*\(email, created_at desc\)/);
  assert.match(sql, /enable row level security/); assert.match(sql, /notify pgrst, 'reload schema'/); assert.match(sql, /as tbl,[\s\S]*as uq,[\s\S]*as idx,[\s\S]*as rows/);
  assert.ok(!/create policy/.test(sql), 'لا سياسات للمجهول — الخادم فقط');
});

test('p39: الربط — الخزنة · واجهة الدفعة ترمز النتيجة · المحرّكات الخمسة تستدعي pushNotice · cron · الجرس · «نبّهني» · «أُبلغ؟» · «أنا»', () => {
  assert.match(read('lib/vault/registry.ts'), /table: 'portal_learner_notices'.*emailCol: 'email'/);
  const push = read('app/api/push/route.ts'); assert.match(push, /isResultCode/); assert.match(push, /body\.result/); assert.match(push, /`miaar:\$\{code\}`/);
  assert.match(read('lib/miaar/room.ts'), /announceExitFinal\(db/); assert.match(read('lib/miaar/exitflow.ts'), /dedupe_key: `retake_open:/); assert.match(read('lib/miaar/exitflow.ts'), /dedupe_key: `promoted:/); assert.match(read('lib/miaar/exitflow.ts'), /:merged:/);
  assert.match(read('lib/miaar/ledger.ts'), /dedupe_key: `placed:/); assert.match(read('app/api/admin/miaar/remedial/route.ts'), /notifyRemedial\(db, board/);
  assert.match(read('app/api/followups/send/route.ts'), /runNoticeReminders\(db, \{ site, dry \}\)/); assert.match(read('app/api/followups/send/route.ts'), /learner_notices/);
  assert.match(read('app/components/PortalShell.tsx'), /\{loggedIn && <NoticesBell lang=\{lang\} \/>\}/); assert.match(read('app/components/PortalShell.tsx'), /NOTICES_CSS/);
  const mi = read('app/miaar/MiaarApp.tsx'); assert.match(mi, /<NoticesStrip n=/); assert.match(mi, /testid="mi-notify"/); assert.match(mi, /extra=\{\{ result: code \}\}/); assert.match(mi, /topics=\{\['miaar'\]\}/);
  assert.match(read('lib/miaar/engine.ts'), /\(safe as any\)\.تنبيهات = \{ القائمة:/);
  const xb = read('app/admin/miaar/ExitBoard.tsx'); assert.match(xb, /أُبلغ؟/); assert.match(xb, /data-testid="xb-reach"/); assert.match(read('app/api/admin/miaar/exit/route.ts'), /reach = await noticeReach\(db/);
  assert.match(read('app/me/page.tsx'), /<NoticesCard \/>/); assert.match(read('app/api/notices/route.ts'), /action === 'read'/);
  const pwa = read('app/components/Pwa.tsx'); assert.match(pwa, /topics && topics\.length \? topics : \['daily'\]/); assert.match(pwa, /if \(tok && !custom\) fetch/);
  assert.ok(!/RESEND_API_KEY|sendEmailRaw|sendWhatsApp/.test(read('lib/portal/notices.ts')), 'لا بريد ولا واتساب في قناة P39');
});
