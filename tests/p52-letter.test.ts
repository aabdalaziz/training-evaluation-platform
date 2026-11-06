// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P52 «رسالة الشهر» — الشهر والحدود · الصياغات البشرية وقاعدة k · التنقية · البصمة · بناء الجسد من قاعدة وهمية · المسوَّدة والتوقيع والتجميد · الردّ · التحقّق · الكرون (اليوم الثالث · التذكير) · عقد التكامل */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { monthOf, prevMonth, nextMonth, monthRange, monthLabelAr, isMonth, kSafe, countAr, deltaAr, composeLines, suggestAsk, cleanLine, letterCode, frozenDoc, digestOf, orgNoticeText, buildLetterBody, ensureDraft, eligibleOrgs, signLetter, replyLetter, verifyLetter, runOrgLetters, draftCount, DRAFT_DAY, PROMISES, LETTER_OFFICIAL, WRITER_ROLES } from '../lib/org-impact/letter';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';
import { ROOMS } from '../lib/portal/rooms';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ORG = '00000000-0000-4000-8000-000000000021';

test('P52: الشهر بتوقيت الرياض · السابق/التالي · الحدود · التسمية · isMonth', () => {
  assert.equal(monthOf(new Date('2026-10-31T21:30:00Z')), '2026-11', 'بعد منتصف ليل الرياض صار نوفمبر'); assert.equal(monthOf(new Date('2026-10-31T20:30:00Z')), '2026-10');
  assert.equal(prevMonth('2026-01'), '2025-12'); assert.equal(nextMonth('2026-12'), '2027-01'); assert.equal(monthLabelAr('2026-10'), 'أكتوبر 2026');
  assert.deepEqual(monthRange('2026-10'), { from: '2026-09-30T21:00:00.000Z', to: '2026-10-31T21:00:00.000Z', day_from: '2026-10-01', day_to: '2026-11-01' });
  assert.ok(isMonth('2026-10') && !isMonth('2026-13') && !isMonth('2026-1') && !isMonth(null)); assert.equal(DRAFT_DAY, 3); assert.equal(LETTER_OFFICIAL.en, 'Monthly Organization Impact Letter');
});

test('P52: k ≥ 5 · العدّ العربي · الفرق بكلمات · الصياغات الثلاث · الطلب المقترَح · التنقية · الرمز · البصمة', () => {
  assert.equal(kSafe(4), null); assert.equal(kSafe(5), 5);
  const P = { one: 'منسوب', two: 'منسوبان', few: 'منسوبين', many: 'منسوبًا' }; assert.equal(countAr(1, P), 'منسوب واحد'); assert.equal(countAr(2, P), 'منسوبان'); assert.equal(countAr(7, P), '7 منسوبين'); assert.equal(countAr(42, P), '42 منسوبًا');
  assert.equal(deltaAr(42, 36, 'سبتمبر'), '، بزيادة 6 عن سبتمبر'); assert.equal(deltaAr(30, 36, 'سبتمبر'), '، بنقص 6 عن سبتمبر'); assert.equal(deltaAr(36, 36, 'سبتمبر'), '، كما في سبتمبر'); assert.equal(deltaAr(36, null, 'سبتمبر'), '');
  const base = { month: '2026-10', prev_month: '2026-09', month_ar: 'أكتوبر 2026', prev_month_ar: 'سبتمبر 2026', org: { id: ORG, name_ar: 'وزارة التعليم' }, people: { members: 60, pending: 4, active: 42, active_prev: 36, active_raw: 42 }, attendance: { pct: 84, pct_prev: 78, sessions: 12, people: 50 }, miaar: { exits_passed: 9, placements: null, certificates: 5 }, threads: [] } as any;
  const L = composeLines(base); assert.equal(L.length, 3); assert.equal(L[0], '42 منسوبًا تعلّموا في أكتوبر 2026 (حضور أو مِران أو اختبار) من أصل 60، بزيادة 6 عن سبتمبر 2026.'); assert.equal(L[1], 'حضور الجلسات 84% عبر 12 جلسة (كان 78% في سبتمبر 2026).'); assert.equal(L[2], 'اجتاز 9 منسوبين اختبار المستوى، وصدرت 5 شهادات.');
  const small = composeLines({ ...base, people: { members: 8, pending: 0, active: null, active_prev: null, active_raw: 3 }, attendance: { pct: null, pct_prev: null, sessions: 0, people: 0 }, miaar: { exits_passed: null, placements: null, certificates: null } });
  assert.match(small[0], /^أقلّ من خمسة منسوبين/); assert.match(small[1], /لم تُعقد جلسات/); assert.match(small[2], /دون خمسة/); assert.ok(!JSON.stringify(small).includes('3'), 'الرقم الصغير لا يظهر');
  assert.match(composeLines({ ...base, people: { ...base.people, active: null, active_raw: 0 } })[0], /لم يُسجَّل تعلّم/);
  assert.match(suggestAsk(base)!, /^4 منسوبين من نطاق بريدكم ينتظرون تأكيدكم/); assert.match(suggestAsk({ people: { members: 9, pending: 1, active_raw: 6 } })!, /^منسوب واحد من نطاق بريدكم ينتظر تأكيدكم .* تأكيده يفتح له/); assert.match(suggestAsk({ people: { members: 9, pending: 2, active_raw: 6 } })!, /^منسوبان من نطاق بريدكم ينتظران/); assert.match(suggestAsk({ people: { members: 20, pending: 0, active_raw: 4 } })!, /نصف المقيَّدين/); assert.equal(suggestAsk({ people: { members: 20, pending: 0, active_raw: 15 } }), null);
  assert.equal(cleanLine(' <b>شكرًا</b> لكم https://x.y و a@b.co  '), 'شكرًا لكم و'); assert.equal(cleanLine('x'.repeat(400)).length, 280);
  assert.match(letterCode(), /^ATH-ML-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.notEqual(letterCode(), letterCode());
  const doc = frozenDoc({ organization_id: ORG, month: '2026-10', body: { ...base, v: 1, lines_ar: L, ask_suggested_ar: null, generated_at: 'x' }, line_ar: 'سطر', promise_ar: 'وعد', ask_ar: null, signed_name: 'أحمد', signed_title: 'مدير البرامج', signed_at: '2026-11-03T06:00:00Z', code: 'ATH-ML-AAAA-BBBB' });
  assert.equal(doc.type, 'Monthly Organization Impact Letter'); const d1 = digestOf(doc); assert.match(d1, /^[0-9a-f]{64}$/); assert.equal(d1, digestOf(JSON.parse(JSON.stringify(doc))), 'حتمية'); assert.notEqual(d1, digestOf({ ...doc, line_ar: 'سطر آخر' }));
  const n = orgNoticeText('2026-10', 'وزارة التعليم'); assert.equal(n.title_ar, 'وصلت رسالة شهر أكتوبر 2026 من أَثَر'); assert.equal(n.url, '/org?tab=letters');
  assert.equal(KIND_AR.org_letter, 'رسالة الشهر من أَثَر'); assert.equal(KIND_ICON.org_letter, '✉️'); assert.equal(KIND_ICON.org_letter_reply, '💌'); assert.equal(KIND_ICON.org_letter_due, '🖋️'); assert.equal(PROMISES.length, 5); assert.deepEqual(WRITER_ROLES, ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER']);
});

/** قاعدة وهمية: جهة بـ6 منسوبين مؤكَّدين (+2 معلّقان) · أكتوبر: 3 جلسات حضور لشعبة c1 (قيود 5 منسوبين) · سبتمبر: جلسة واحدة · مِران واختبارات وشهادات */
function fakeDb(over: Record<string, any[]> = {}) {
  const M = ['a@x.sa', 'b@x.sa', 'c@x.sa', 'd@x.sa', 'e@x.sa', 'f@x.sa'];
  const T: Record<string, any[]> = {
    portal_organizations: [{ id: ORG, name_ar: 'وزارة التعليم' }, { id: '00000000-0000-4000-8000-000000000022', name_ar: 'جامعة صغيرة' }],
    portal_org_members: [...M.map((e, i) => ({ organization_id: ORG, email: e.toUpperCase(), status: 'confirmed', role: i === 0 ? 'org_admin' : 'learner', user_id: i === 0 ? 'u-admin' : null })), { organization_id: ORG, email: 'p1@x.sa', status: 'pending', role: 'learner' }, { organization_id: ORG, email: 'p2@x.sa', status: 'pending', role: 'learner' }, { organization_id: '00000000-0000-4000-8000-000000000022', email: 'z@y.sa', status: 'confirmed', role: 'org_admin' }],
    attendance_sessions: [{ id: 's1', classroom_id: 'c1', session_date: '2026-10-05' }, { id: 's2', classroom_id: 'c1', session_date: '2026-10-12' }, { id: 's3', classroom_id: 'c1', session_date: '2026-10-19' }, { id: 's0', classroom_id: 'c1', session_date: '2026-09-20' }, { id: 's9', classroom_id: 'c1', session_date: '2026-11-02' }],
    attendance_records: [
      ...['a@x.sa', 'b@x.sa', 'c@x.sa', 'd@x.sa', 'e@x.sa'].map((e) => ({ session_id: 's1', email: e, status: 'present' })),
      ...['a@x.sa', 'b@x.sa', 'c@x.sa', 'd@x.sa'].map((e) => ({ session_id: 's2', email: e, status: 'late' })),
      ...['a@x.sa', 'b@x.sa', 'c@x.sa'].map((e) => ({ session_id: 's3', email: e, status: 'present' })), { session_id: 's3', email: 'd@x.sa', status: 'excused' },
      ...['a@x.sa', 'b@x.sa'].map((e) => ({ session_id: 's0', email: e, status: 'present' })), { session_id: 's1', email: 'outsider@q.sa', status: 'present' }],
    portal_enrollments: ['a@x.sa', 'b@x.sa', 'c@x.sa', 'd@x.sa', 'e@x.sa'].map((e) => ({ classroom_id: 'c1', email: e, status: 'approved' })),
    miaar_practice_attempts: [{ email: 'f@x.sa', created_at: '2026-10-10T10:00:00Z' }, { email: 'a@x.sa', created_at: '2026-10-11T10:00:00Z' }, { email: 'f@x.sa', created_at: '2026-11-01T10:00:00Z' }],
    placement_reports: [{ candidate_email: 'a@x.sa', report: { exit: { الحالة: 'final', النتيجة: 'passed' } }, created_at: '2026-10-20T00:00:00Z', archived_at: null }, { candidate_email: 'b@x.sa', report: {}, created_at: '2026-10-21T00:00:00Z', archived_at: null }],
    portal_credentials: [{ email: 'a@x.sa', issued_at: '2026-10-25T00:00:00Z', revoked_at: null }],
    portal_council_cases: [], portal_council_posts: [], portal_council_attestations: [], portal_daily_case_responses: [], portal_council_scribe: [],
    portal_org_letters: [], portal_learner_notices: [], profiles: [{ id: 'w1', email: 'pm@athar.sa', role: 'PROGRAM_MANAGER' }, { id: 'w2', email: 'qa@athar.sa', role: 'QUALITY_ANALYST' }], audit_logs: [], ...over,
  };
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let mode: 'select' | 'insert' | 'update' = 'select'; let payload: any = null; let ord: { k: string; asc: boolean } | null = null;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => String(r[k]) === String(v)); return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, in(k: string, v: any[]) { const s = new Set(v.map(String)); f.push((r) => s.has(String(r[k]))); return b; }, is(k: string, v: any) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; }, not(k: string, op: string, v: any) { if (op === 'is' && v === null) f.push((r) => r[k] != null); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k] || '') >= String(v)); return b; }, lte(k: string, v: any) { f.push((r) => String(r[k] || '') <= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(r[k] || '') < String(v)); return b; }, gt(k: string, v: any) { f.push((r) => String(r[k] || '') > String(v)); return b; }, ilike(k: string, v: any) { f.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return b; }, or() { return b; }, order(k: string, o?: any) { ord = { k, asc: o?.ascending !== false }; return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; },
      upsert(p: any) { mode = 'insert'; payload = p; return b; },
      then(res: any) {
        if (mode === 'insert') { const a = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}-${table}`, created_at: new Date().toISOString(), ...p })); for (const p of a) { if (p.dedupe_key && rows.some((r) => r.dedupe_key === p.dedupe_key)) { const i = rows.findIndex((r) => r.dedupe_key === p.dedupe_key); rows[i] = { ...rows[i], ...p, id: rows[i].id }; return res({ data: single ? rows[i] : [rows[i]], error: null }); } rows.push(p); } return res({ data: single ? a[0] : a, error: null }); }
        if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); return res({ data: single ? hit[0] || null : hit, error: single && !hit[0] ? { message: 'no row' } : null }); }
        let hit = rows.filter((r) => f.every((p) => p(r))); if (ord) { const { k, asc } = ord; hit = [...hit].sort((x, y) => (String(x[k] || '') < String(y[k] || '') ? -1 : 1) * (asc ? 1 : -1)); } if (lim) hit = hit.slice(0, lim);
        return res({ data: single ? hit[0] || null : hit, error: null, count: hit.length }); } };
    return b; };
  return { T, from: q };
}

test('P52: buildLetterBody — الروستر والحضور (80% = 12/15 بلا الخارجيّ) · الفاعلون (5 حضروا + f في مِران = 6) · الفرق عن سبتمبر · مِعيار دون خمسة يُخفى · المعلّقون في الطلب · لا أسماء', async () => {
  const db = fakeDb(); const b = await buildLetterBody(db as any, { id: ORG, name_ar: 'وزارة التعليم' }, '2026-10');
  assert.equal(b.people.members, 6); assert.equal(b.people.pending, 2); assert.equal(b.people.active, 6); assert.equal(b.people.active_raw, 6); assert.equal(b.people.active_prev, null, 'سبتمبر: 2 فقط → دون خمسة');
  assert.equal(b.attendance.sessions, 3); assert.equal(b.attendance.pct, 80, '(5+4+3)=12 من 15 مقعدًا'); assert.equal(b.attendance.pct_prev, 40, 'سبتمبر: جلسة واحدة · الروستر من القيود 5 · حضر 2 → 40%');
  assert.deepEqual(b.miaar, { exits_passed: null, placements: null, certificates: null }, 'كلها دون خمسة'); assert.equal(b.threads.length, 0);
  assert.match(b.lines_ar[0], /^6 منسوبين تعلّموا في أكتوبر 2026 .* من أصل 6\.$/); assert.equal(b.lines_ar[1], 'حضور الجلسات 80% عبر 3 جلسات (كان 40% في سبتمبر 2026).'); assert.match(b.lines_ar[2], /دون خمسة/);
  assert.match(b.ask_suggested_ar!, /^منسوبان من نطاق بريدكم ينتظران/); assert.equal(composeLines({ ...b, attendance: { ...b.attendance, sessions: 2, pct_prev: null } })[1], 'حضور الجلسات 80% عبر جلستين.'); const s = JSON.stringify(b); for (const e of ['a@x.sa', 'outsider', 'p1@x.sa']) assert.ok(!s.includes(e), `لا بريد ${e}`);
});

test('P52: eligibleOrgs (≥5) · ensureDraft (إنشاء · exists · force يحدّث · الموقَّعة لا تُمسّ) · draftCount', async () => {
  const db = fakeDb(); const orgs = await eligibleOrgs(db as any); assert.deepEqual(orgs.map((o) => o.id), [ORG]);
  const r1 = await ensureDraft(db as any, orgs[0], '2026-10'); assert.equal(r1.created, true); assert.equal(r1.row!.status, 'draft'); assert.equal(r1.row!.body.lines_ar.length, 3);
  const r2 = await ensureDraft(db as any, orgs[0], '2026-10'); assert.equal(r2.created, false); assert.equal(r2.reason, 'exists'); assert.equal(db.T.portal_org_letters.length, 1);
  const r3 = await ensureDraft(db as any, orgs[0], '2026-10', { force: true }); assert.equal(r3.reason, 'refreshed'); assert.equal(db.T.portal_org_letters.length, 1);
  const dc = await draftCount(db as any); assert.equal(dc.count, 1); assert.ok(dc.oldest_at);
});

test('P52: signLetter — يرفض بلا سطر/وعد · يجمّد مع رمز وبصمة · يُخبر مديري الجهة (✉️ مرّة لكل مدير) · لا توقيع ثانيًا · replyLetter يصل إلى الموقِّع 💌 · verifyLetter بلا محتوى', async () => {
  const db = fakeDb(); const { row } = await ensureDraft(db as any, { id: ORG, name_ar: 'وزارة التعليم' }, '2026-10'); const id = row!.id; const me = { id: 'w1', email: 'pm@athar.sa', name: 'د. أحمد' };
  const e1 = await signLetter(db as any, id, me, { line_ar: 'قصير', promise_ar: PROMISES[0].text_ar }); assert.ok('error' in e1 && e1.status === 400);
  const e2 = await signLetter(db as any, id, me, { line_ar: 'رأينا منسوبيكم يعودون بعد الغياب — هذا ما يفرحنا.', promise_ar: '' }); assert.ok('error' in e2 && /وعد/.test(e2.error));
  const dry = await signLetter(db as any, id, me, { line_ar: 'رأينا منسوبيكم يعودون بعد الغياب — هذا ما يفرحنا.', promise_ar: PROMISES[0].text_ar }, { dry: true }); assert.ok(!('error' in dry)); assert.equal(db.T.portal_org_letters[0].status, 'draft', 'dry لا يكتب');
  const ok = await signLetter(db as any, id, me, { line_ar: '<i>رأينا</i> منسوبيكم يعودون بعد الغياب — هذا ما يفرحنا. https://no.link', promise_ar: PROMISES[0].text_ar, ask_ar: '', signed_title: 'مدير البرامج' }); assert.ok(!('error' in ok), JSON.stringify(ok));
  const l = ok.row; assert.equal(l.status, 'signed'); assert.match(l.code!, /^ATH-ML-/); assert.match(l.digest!, /^[0-9a-f]{64}$/); assert.equal(l.line_ar, 'رأينا منسوبيكم يعودون بعد الغياب — هذا ما يفرحنا.'); assert.equal(l.ask_ar, null); assert.equal(l.signed_name, 'د. أحمد'); assert.equal(ok.notified, 1);
  const n = db.T.portal_learner_notices; assert.equal(n.length, 1); assert.equal(n[0].kind, 'org_letter'); assert.equal(n[0].email, 'a@x.sa'); assert.equal(n[0].title_ar, 'وصلت رسالة شهر أكتوبر 2026 من أَثَر'); assert.equal(n[0].url, '/org?tab=letters'); assert.equal(n[0].dedupe_key, `org_letter:${id}:a@x.sa`);
  const again = await signLetter(db as any, id, me, { line_ar: 'سطر آخر طويل بما يكفي', promise_ar: 'وعد' }); assert.ok('error' in again && again.status === 409);
  const rp = await replyLetter(db as any, id, { email: 'a@x.sa', name: 'إدارة التدريب' }, ' شكرًا — نريد الشهر القادم أرقام الشُّعب. <b>x</b>'); assert.ok(!('error' in rp)); assert.equal(rp.row.reply_ar, 'شكرًا — نريد الشهر القادم أرقام الشُّعب. x'); assert.equal(rp.row.reply_by, 'إدارة التدريب');
  assert.equal(n.length, 2); assert.equal(n[1].kind, 'org_letter_reply'); assert.equal(n[1].email, 'pm@athar.sa'); assert.match(n[1].url, new RegExp(`^/admin/org/letters\\?id=${id}`));
  const v = await verifyLetter(db as any, l.code!.toLowerCase()); assert.equal(v.valid, true); assert.equal(v.intact, true); assert.equal(v.org_name, 'وزارة التعليم'); assert.equal(v.month_ar, 'أكتوبر 2026'); assert.ok(!('line_ar' in v) && !('body' in v), 'لا محتوى');
  db.T.portal_org_letters[0].line_ar = 'عُدّل'; const v2 = await verifyLetter(db as any, l.code!); assert.equal(v2.intact, false, 'أي تعديل يكسر البصمة'); assert.equal((await verifyLetter(db as any, 'ATH-ML-ZZZZ-ZZZZ')).valid, false); assert.equal((await verifyLetter(db as any, 'junk')).valid, false);
});

test('P52: runOrgLetters — قبل اليوم الثالث لا مسوَّدات · في الثالث مسوَّدة للجهات المؤهَّلة عن الشهر المنصرم (مرّة) · dry يعدّ بلا كتابة · التذكير بعد 7 أيام للكتّاب فقط ومرّة', async () => {
  const db = fakeDb(); const early = await runOrgLetters(db as any, { now: new Date('2026-11-02T06:00:00Z') }); assert.equal(early.due, false); assert.equal(early.created, 0); assert.equal(db.T.portal_org_letters.length, 0);
  const dry = await runOrgLetters(db as any, { now: new Date('2026-11-03T06:00:00Z'), dry: true }); assert.equal(dry.due, true); assert.equal(dry.month, '2026-10'); assert.equal(dry.created, 1); assert.equal(db.T.portal_org_letters.length, 0);
  const r = await runOrgLetters(db as any, { now: new Date('2026-11-03T06:00:00Z') }); assert.equal(r.orgs, 1); assert.equal(r.created, 1); assert.equal(db.T.portal_org_letters.length, 1); assert.equal(db.T.portal_org_letters[0].month, '2026-10');
  const r2 = await runOrgLetters(db as any, { now: new Date('2026-11-04T06:00:00Z') }); assert.equal(r2.created, 0); assert.equal(r2.reminded, 0);
  db.T.portal_org_letters[0].created_at = '2026-11-03T06:00:00Z'; db.T.portal_org_letters[0].reminded_at = null;
  const r3 = await runOrgLetters(db as any, { now: new Date('2026-11-11T06:00:00Z') }); assert.equal(r3.reminded, 1, 'كاتب واحد (المحلّل ليس كاتبًا)'); const due = db.T.portal_learner_notices.filter((x: any) => x.kind === 'org_letter_due'); assert.equal(due.length, 1); assert.equal(due[0].email, 'pm@athar.sa'); assert.match(due[0].title_ar, /^رسالة شهر واحد تنتظر سطرك/); assert.ok(db.T.portal_org_letters[0].reminded_at);
  const r4 = await runOrgLetters(db as any, { now: new Date('2026-11-12T06:00:00Z') }); assert.equal(r4.reminded, 0, 'مرّة واحدة');
});

test('P52: التكامل — «نادِ» · الغرفة · WayBar · الكرون · «توقيعي» · تبويب الجهة · التحقّق · عقود الواجهات', () => {
  const d = DESTINATIONS.find((x) => x.href === '/admin/org/letters'); assert.ok(d && d.admin); const i = parseCommand('افتح رسالة الشهر', { admin: true }) as any; assert.equal(i.kind, 'go'); assert.equal(i.href, '/admin/org/letters');
  assert.ok(ROOMS.some((r) => r.href === '/admin/org/letters' && r.perms.includes('staff'))); assert.match(read('lib/portal/way.ts'), /'admin\/org\/letters': \{ ar: 'رسالة الشهر'/); assert.match(read('lib/portal/way.ts'), /'verify\/letter'/);
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runOrgLetters\(db, \{ site, dry \}\)/); assert.match(cron, /day_digest, org_letters/);
  const sign = read('lib/portal/sign.ts'); assert.match(sign, /key: 'org_letter'/); assert.match(sign, /letterGroup\(db\)/); assert.match(sign, /me\.staff \? safe\(letterGroup/);
  const org = read('app/org/page.tsx'); assert.match(org, /\['letters', 'رسالة الشهر', 'Monthly letter'\]/); assert.match(org, /tab === 'letters' && <OrgLetters/);
  const adm = read('app/api/admin/org/letters/route.ts'); assert.match(adm, /if \(!me\.writer\) return bad/); assert.match(adm, /action === 'sign'/); assert.match(adm, /org_letter_sign/); assert.match(adm, /invalidateSignCache/);
  const api = read('app/api/org/letters/route.ts'); assert.match(api, /eq\('status', 'signed'\)/, 'الجهة لا ترى المسوَّدات'); assert.match(api, /action === 'reply'|!== 'reply'/);
  const ver = read('app/api/verify/letter/route.ts'); assert.match(ver, /verifyLetter\(db, code\)/); assert.match(read('app/verify/letter/page.tsx'), /ولا نُظهر محتوى الرسالة/);
  const desk = read('app/admin/org/letters/LettersDesk.tsx'); for (const t of ['ol-root', 'ol-drafts', 'ol-editor', 'ol-line', 'ol-sign', 'ol-signed', 'ol-make']) assert.ok(desk.includes(`data-testid="${t}"`), t); assert.match(desk, /window\.confirm/);
  const sheet = read('app/components/LetterSheet.tsx'); assert.match(sheet, /لا تحوي الرسالة أسماء منسوبين/); assert.match(sheet, /بلا توقيع لا تُرسل الرسالة/);
  assert.match(read('tests/index.ts'), /import '\.\/p52-letter\.test'/); assert.match(read('supabase/migrations/20270207_portal_p52_org_letters.sql'), /portal_org_letters_org_month_uq unique \(organization_id, month\)/);
});
