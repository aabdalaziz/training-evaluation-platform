// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P58 «خريطة أثرك — ما قاد إلى ماذا» — النقي: المحطات · القواعد الست ونوافذها · القرارات (إبقاء/استبعاد/يدوي) · الإحداثيات · المرآة · اللقطة والبصمة · التحقّق · الإشعار 🧭 · الغراء بقاعدة وهمية */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationsOf, proposeThreads, withCaseReturns, buildMap, layout, mirror, validateNote, isStationKey, snapshotBody, topicOf, degree, strokeOf, fmtDays, RULE_AR, KIND_AR, CODE_RE, NOTE_MAX, MAP_LIMITS } from '../lib/map/registry';
import type { MapInput, Decision } from '../lib/map/registry';
import { digestOf, mapCode, keepThread, declineThread, removeThread, signSnapshot, verifyMap, revokeSnapshot, setSnapshotPublic, yearOf } from '../lib/map/store';
import { nudgeText, runMapNudges, dayKey } from '../lib/map/nudge';
import { KIND_AR as NOTICE_KIND_AR, KIND_ICON } from '../lib/portal/notices';

const S1 = '00000000-0000-4000-8000-000000000001'; const S2 = '00000000-0000-4000-8000-000000000002';
const d = (iso: string) => `${iso}T09:00:00.000Z`;
/** رحلة متعلّم واحدة تمسّ كل القواعد */
function inp(over: Partial<MapInput> = {}): MapInput {
  return {
    events: [
      { at: d('2026-01-05'), verb: 'assessed', object_type: 'placement', object_id: 'rep-1', skills: [S1], context: { level: 'B1' } },
      { at: d('2026-02-01'), verb: 'completed', object_type: 'program', object_id: 'p1', skills: [S1, S2], context: { program_name: 'دبلوم إعداد المعلمين' } },
      { at: d('2026-02-10'), verb: 'attended', object_type: 'session', object_id: 'ses-1', skills: [S2], context: {} },
      { at: d('2026-03-20'), verb: 'assessed', object_type: 'simulation', object_id: 'run-1', skills: [S2], context: { title: 'محاكاة وليّ أمر غاضب' } },
      { at: d('2026-05-01'), verb: 'issued', object_type: 'council_badge', object_id: 'b1', skills: [], context: {} },
      { at: d('2026-03-01'), verb: 'pledged', object_type: 'horizon', object_id: 'h1', skills: [], context: { step_ar: 'أبدأ كل حصة بسؤال' } },
      { at: d('2026-09-01'), verb: 'reviewed', object_type: 'horizon', object_id: 'h1', skills: [], context: {} },
    ],
    daily: [{ created_at: d('2026-02-15'), response: '…', band: 'B', score: 70, case_title: 'طالب يرفض المشاركة في الصفّ', case_id: 'c1' } as any],
    sims: [], missions: [{ id: 'm1', title_ar: 'مهمة: تطبيق استراتيجية في الصفّ', confirmed_at: d('2026-03-10'), submitted_at: d('2026-03-05'), status: 'confirmed', skills: [S1] }],
    memberships: [{ council_id: 'co1', council_title: 'مجلس معلمي اللغة', joined_at: d('2026-01-20'), status: 'active' }],
    cases: [{ id: 'cs1', created_at: d('2026-02-20'), title_ar: 'قضية الغياب', commitment_ar: 'أتصل بالأسرة', committed_at: d('2026-02-21'), return_ar: 'عاد الطالب', return_outcome: 'better', returned_at: d('2026-03-15'), theme: null }],
    attestations: [],
    levels: [{ skill_id: S1, approved_level: 3, approved_at: d('2026-03-01'), computed_level: 3.2 }, { skill_id: S2, approved_level: 2, approved_at: d('2026-03-25'), computed_level: 2.1 }],
    credentials: [{ id: 'cr1', title_ar: 'شهادة إتمام: دبلوم إعداد المعلمين', kind: 'program_completion', issued_at: d('2026-02-20'), verify_code: 'X', level: null }, { id: 'cr2', title_ar: 'شهادة مهارة: إدارة الصفّ', kind: 'skill', issued_at: d('2026-04-01'), verify_code: 'Y', level: 3 }, { id: 'cr3', title_ar: 'شهادة حضور ملتقى', kind: 'attendance', issued_at: d('2026-10-01'), verify_code: 'Z', level: null }],
    skills: { [S1]: 'إدارة الصفّ', [S2]: 'تصميم الأنشطة' },
    hands: [{ at: d('2026-02-05'), notice_id: 'n1' }],
    ...over,
  } as MapInput;
}

test('p58: المحطات — كل نوع له مفتاح ثابت وعنوان عام بلا أسماء · مرتَّبة زمنيًا · عودة القضية مشتقّة', () => {
  const st = withCaseReturns(stationsOf(inp()));
  const kinds = st.map((s) => s.kind);
  for (const k of ['placement', 'program', 'session', 'simulation', 'badge', 'horizon', 'daily', 'mission', 'skill', 'credential', 'council', 'case', 'hand']) assert.ok(kinds.includes(k as any), k);
  for (let i = 1; i < st.length; i++) assert.ok(Date.parse(st[i].at) >= Date.parse(st[i - 1].at), 'ترتيب زمني');
  const daily = st.find((s) => s.kind === 'daily')!; assert.equal(daily.key, 'daily:c1'); assert.equal(daily.public_ar, 'حالة يوم — إدارة الصفّ'); assert.match(daily.title_ar, /طالب يرفض/);
  assert.ok(st.some((s) => s.key === 'case_return:case:cs1' && s.kind === 'case'));
  assert.equal(st.find((s) => s.key === `skill:${S1}`)!.title_ar, 'إدارة الصفّ — مستوى 3');
  assert.equal(topicOf('اجتماع مع وليّ أمر'), 'أولياء الأمور'); assert.equal(topicOf(null), 'موقف مهني');
  assert.equal(new Set(st.map((s) => s.key)).size, st.length, 'لا تكرار مفاتيح');
});

test('p58: القواعد — كل قاعدة تُقترح مرّة واحدة لكل زوج وفي نافذتها فقط', () => {
  const st = withCaseReturns(stationsOf(inp())); const p = proposeThreads(st); const rules = p.map((x) => x.rule);
  for (const r of ['placement_program', 'program_skill', 'program_credential', 'skill_credential', 'session_skill', 'simulation_skill', 'daily_mission', 'hand_session', 'pledge_review', 'council_badge', 'case_return']) assert.ok(rules.includes(r as any), `قاعدة ${r}`);
  assert.equal(new Set(p.map((x) => `${x.from}>${x.to}`)).size, p.length, 'لا زوج مكرّر');
  const ps = p.filter((x) => x.rule === 'program_skill'); assert.equal(ps.length, 2, 'برنامج → مهارتان تشتركان في الوسوم خلال 90 يومًا');
  const sc = p.find((x) => x.rule === 'skill_credential')!; assert.equal(sc.from, `skill:${S1}`); assert.equal(sc.to, 'credential:cr2');
  const hs = p.find((x) => x.rule === 'hand_session')!; assert.equal(hs.to, 'session:ses-1'); assert.equal(hs.days, 5); assert.match(hs.why_ar, /خلال 5 يومًا|خلال 5/);
  assert.ok(!p.some((x) => x.to === 'credential:cr3'), 'شهادة الحضور بلا قاعدة تقودها');
  /* خارج النافذة: المهمة بعد 61 يومًا من الحالة → لا خيط */
  const late = proposeThreads(stationsOf(inp({ missions: [{ id: 'm1', title_ar: 'م', confirmed_at: d('2026-04-20'), submitted_at: null, status: 'confirmed', skills: [] }] })));
  assert.ok(!late.some((x) => x.rule === 'daily_mission'));
  assert.ok(p.length <= MAP_LIMITS.maxProposals);
});

test('p58: القرارات — مبقى بكلمة · مستبعَد يختفي ولا يعود · يدوي بين أي محطتين · المرآة بلا حكم', () => {
  const dec: Decision[] = [
    { from_key: 'program:p1', to_key: `skill:${S1}`, rule: 'program_skill', status: 'kept', note_ar: 'تعلّمت فيه كيف أبدأ الحصة', decided_at: d('2026-03-02') },
    { from_key: 'program:p1', to_key: `skill:${S2}`, rule: 'program_skill', status: 'kept', note_ar: 'ورشة الأنشطة', decided_at: d('2026-03-26') },
    { from_key: 'hand:n1', to_key: 'session:ses-1', rule: 'hand_session', status: 'declined', note_ar: null, decided_at: d('2026-02-11') },
    { from_key: 'daily:c1', to_key: 'credential:cr3', rule: 'manual', status: 'kept', note_ar: 'الحالة دفعتني للملتقى', decided_at: d('2026-10-02') },
    { from_key: 'ghost:1', to_key: 'program:p1', rule: 'manual', status: 'kept', note_ar: 'محطة غير موجودة', decided_at: d('2026-10-02') },
  ];
  const m = buildMap(inp(), dec);
  assert.equal(m.declined, 1); assert.ok(!m.threads.some((t) => t.from === 'hand:n1'));
  assert.equal(m.counts.kept, 3); assert.equal(m.counts.manual, 1); assert.ok(!m.threads.some((t) => t.from === 'ghost:1'), 'خيط لمحطة غير موجودة يُهمل');
  const manual = m.threads.find((t) => t.rule === 'manual')!; assert.equal(manual.status, 'kept'); assert.equal(manual.why_ar, RULE_AR.manual.why);
  assert.match(m.mirror.strongest_ar!, /^أقوى خيط في أثرك: برنامج قاد إلى مهارة معتمدة — مرّتان$/);
  assert.match(m.mirror.waiting_ar!, /خيوط تنتظر كلمتك$|خيطان ينتظران كلمتك$/);
  assert.equal(m.mirror.lonely_ar, 'شهادتان بلا خيط — من أين جاءتا؟');
  for (const l of m.mirror.lines_ar) assert.ok(!/%|٪|ضعيف|متأخر|يجب/.test(l), 'بلا حكم ولا نسب');
  const deg = degree(m); assert.equal(deg['program:p1'], 2); assert.ok(strokeOf(m.threads.find((t) => t.from === 'program:p1')!, deg) > strokeOf(m.threads.find((t) => t.status === 'proposed')!, deg));
  const empty = buildMap({ ...inp(), events: [], daily: [], missions: [], memberships: [], cases: [], levels: [], credentials: [], hands: [] }, []);
  assert.equal(empty.counts.stations, 0); assert.match(empty.mirror.lines_ar[0], /أول محطة/);
});

test('p58: الإحداثيات — حتمية · داخل الإطار · الزمن من اليمين إلى اليسار · المسار بحسب النوع', () => {
  const st = stationsOf(inp()); const a = layout(st); const b = layout(st);
  assert.deepEqual(a, b); assert.equal(Object.keys(a.pos).length, st.length);
  for (const p of Object.values(a.pos)) { assert.ok(p.x >= 0 && p.x <= a.w && p.y >= 0 && p.y <= a.h); }
  assert.ok(a.pos[st[0].key].x > a.pos[st[st.length - 1].key].x, 'الأقدم يمينًا');
  assert.ok(a.pos['program:p1'].y < a.pos['daily:c1'].y, 'البرنامج في مسار أعلى من حالة اليوم');
  assert.deepEqual(layout([]).pos, {});
});

test('p58: «لأن…» — ≥ كلمتين · ≤ 120 · بلا روابط · مفاتيح المحطات', () => {
  assert.equal(validateNote('x').ok, false); assert.equal(validateNote('  لأنني  تعلّمت ').ok && (validateNote('  لأنني  تعلّمت ') as any).note, 'لأنني تعلّمت');
  assert.equal(validateNote('ا'.repeat(NOTE_MAX + 1)).ok, false); assert.equal(validateNote('انظر https://x.y').ok, false); assert.equal(NOTE_MAX, 120);
  assert.ok(isStationKey('program:p1')); assert.ok(isStationKey(`skill:${S1}`)); assert.ok(!isStationKey('program')); assert.ok(!isStationKey('a:' + 'x'.repeat(90))); assert.ok(!isStationKey(5));
  assert.equal(fmtDays(0), 'اليوم نفسه'); assert.equal(fmtDays(2), 'يومين'); assert.equal(fmtDays(5), '5 أيام'); assert.equal(fmtDays(40), '40 يومًا');
});

test('p58: اللقطة — الوجه العام فقط · حتى نهاية السنة · بصمة ثابتة · الرمز بالصيغة', () => {
  const dec: Decision[] = [{ from_key: 'program:p1', to_key: `skill:${S1}`, rule: 'program_skill', status: 'kept', note_ar: 'كلمتي', decided_at: d('2026-03-02') }, { from_key: 'daily:c1', to_key: 'mission:m1', rule: 'daily_mission', status: 'kept', note_ar: 'نزلت للميدان', decided_at: d('2026-03-12') }];
  const m = buildMap(inp(), dec); const b = snapshotBody(m, 2026);
  assert.equal(b.v, 1); assert.equal(b.year, 2026); assert.equal(b.threads.length, 2); assert.equal(b.counts.proposed, 0);
  const daily = b.stations.find((s) => s.key === 'daily:c1')!; assert.equal(daily.title_ar, 'حالة يوم — إدارة الصفّ'); assert.ok(!JSON.stringify(b).includes('طالب يرفض'), 'لا عنوان حسّاس في الوجه العام');
  assert.ok(!b.mirror_ar.some((l) => /تنتظر كلمتك/.test(l)), 'سطر الانتظار لا يدخل اللقطة');
  const b25 = snapshotBody(m, 2025); assert.equal(b25.stations.length, 0); assert.equal(b25.threads.length, 0);
  assert.equal(digestOf(b), digestOf(JSON.parse(JSON.stringify(b)))); assert.notEqual(digestOf(b), digestOf({ ...b, threads: [] }));
  for (let i = 0; i < 20; i++) assert.match(mapCode(), CODE_RE);
  assert.ok(!CODE_RE.test('ATH-ML-ABCD-EFGH')); assert.ok(yearOf(new Date('2026-12-31T21:30:00Z')) === 2027, 'سنة الرياض');
});

/* ———— قاعدة وهمية للغراء ———— */
function fakeDb(seed: { email: string; input: MapInput }) {
  const T: Record<string, any[]> = { portal_map_threads: [], portal_map_snapshots: [], portal_learner_notices: [], audit_logs: [], portal_word_replies: seed.input.hands.map((h) => ({ learner_email: seed.email, chip: 'need_help', notice_id: h.notice_id, created_at: h.at })), portal_learning_events: seed.input.events.map((e) => ({ ...e, email: seed.email, user_id: 'u1' })), portal_daily_case_responses: seed.input.daily.map((x: any) => ({ ...x, email: seed.email })), portal_sim_runs: [], portal_missions: seed.input.missions.map((m) => ({ ...m, email: seed.email })), portal_council_members: seed.input.memberships.map((m) => ({ ...m, email: seed.email })), portal_council_cases: seed.input.cases.map((c) => ({ ...c, author_email: seed.email })), portal_council_attestations: [], portal_skill_levels: seed.input.levels.map((l) => ({ ...l, email: seed.email, user_id: 'u1' })), portal_credentials: seed.input.credentials.map((c) => ({ ...c, email: seed.email, revoked_at: null })), portal_skills: Object.entries(seed.input.skills).map(([id, name_ar]) => ({ id, name_ar })), portal_daily_cases: [{ id: 'c1', title_ar: 'طالب يرفض المشاركة في الصفّ' }] };
  const q = (table: string) => {
    const rows = () => (T[table] = T[table] || []); let f: ((r: any) => boolean)[] = []; let mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'; let payload: any = null; let single = false; let lim = 0;
    const run = () => {
      const all = rows(); const hit = all.filter((r) => f.every((p) => p(r)));
      if (mode === 'insert') { const r = { id: `id-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString(), ...payload }; if (table === 'portal_map_snapshots' && all.some((x) => x.code === r.code)) return { data: null, error: { message: 'duplicate key value violates unique constraint "portal_map_snapshots_code_key"' } }; if (table === 'portal_map_snapshots' && all.some((x) => x.email === r.email && x.year === r.year && !x.revoked_at)) return { data: null, error: { message: 'duplicate key value violates unique constraint portal_map_snapshots_year_live_uq' } }; all.push(r); return { data: single ? r : [r], error: null }; }
      if (mode === 'upsert') { const same = (x: any) => payload.dedupe_key ? x.dedupe_key === payload.dedupe_key : (x.email === payload.email && x.from_key === payload.from_key && x.to_key === payload.to_key); const i = all.findIndex(same); if (i >= 0) { if (payload.dedupe_key) return { data: [], error: null }; all[i] = { ...all[i], ...payload }; return { data: [all[i]], error: null }; } const r = { id: `id-${all.length + 1}`, created_at: (T.__now?.[0] as any) || new Date().toISOString(), ...payload }; all.push(r); return { data: [r], error: null }; }
      if (mode === 'update') { for (const r of hit) Object.assign(r, payload); return { data: hit, error: null }; }
      if (mode === 'delete') { T[table] = all.filter((r) => !hit.includes(r)); return { data: null, error: null }; }
      const out = lim ? hit.slice(0, lim) : hit; return { data: single ? out[0] || null : out, error: null };
    };
    const b: any = { select() { return b; }, eq(c: string, v: any) { f.push((r) => String(r[c]) === String(v)); return b; }, neq(c: string, v: any) { f.push((r) => r[c] !== v); return b; }, is(c: string, v: any) { f.push((r) => (r[c] ?? null) === v); return b; }, in(c: string, vs: any[]) { f.push((r) => vs.includes(r[c])); return b; }, gte(c: string, v: any) { f.push((r) => String(r[c]) >= String(v)); return b; }, lt(c: string, v: any) { f.push((r) => String(r[c]) < String(v)); return b; }, or(expr: string) { const m = /(?:^|,)([a-z_]*email)\.(?:eq|ilike)\.([^,)]+)/.exec(expr); if (m) { const e = m[2]; f.push((r) => String(r.email || r.author_email || r.learner_email || r.to_email || '').toLowerCase() === e.toLowerCase()); } return b; }, not(c: string, _op: string, v: any) { f.push((r) => (r[c] ?? null) !== v); return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; }, insert(p: any) { mode = 'insert'; payload = p; return b; }, upsert(p: any) { mode = 'upsert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, delete() { mode = 'delete'; return b; }, then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); } };
    return b;
  };
  return { T, from: q };
}

test('p58: الغراء — إبقاء/استبعاد/حذف · لقطة واحدة نافذة لكل سنة · عام/خاص · إبطال · تحقّق', async () => {
  const email = 'noura@example.com'; const me = { id: 'u1', email }; const db: any = fakeDb({ email, input: inp() });
  let r: any = await keepThread(db, me, { from: 'program:p1', to: `skill:${S1}`, note: 'x' }); assert.equal(r.ok, false); assert.equal(r.status, 400);
  r = await keepThread(db, me, { from: 'program:p1', to: 'skill:none', note: 'كلمتان هنا' }); assert.equal(r.status, 404);
  r = await keepThread(db, me, { from: 'program:p1', to: `skill:${S1}`, note: 'تعلّمت فيه كيف أبدأ' }); assert.equal(r.ok, true); assert.equal(db.T.portal_map_threads[0].rule, 'program_skill'); assert.equal(db.T.portal_map_threads[0].status, 'kept');
  r = await keepThread(db, me, { from: 'daily:c1', to: 'credential:cr3', note: 'خيطي أنا' }); assert.equal(r.ok, true); assert.equal(db.T.portal_map_threads[1].rule, 'manual');
  r = await declineThread(db, me, { from: 'hand:n1', to: 'session:ses-1' }); assert.equal(r.ok, true); r = await declineThread(db, me, { from: 'hand:n1', to: 'program:p1' }); assert.equal(r.status, 404);
  /* اللقطة */
  const v0 = await verifyMap(db, 'ATH-MP-AAAA-BBBB'); assert.equal(v0.valid, false);
  const s1: any = await signSnapshot(db, me, { year: 2026, now: new Date('2026-11-07T10:00:00Z') }); assert.equal(s1.ok, true); assert.match(s1.snap.code, CODE_RE); assert.equal(s1.snap.is_public, false); assert.equal(s1.body.threads.length, 2);
  const fut: any = await signSnapshot(db, me, { year: 2030, now: new Date('2026-11-07T10:00:00Z') }); assert.equal(fut.status, 400);
  let v: any = await verifyMap(db, s1.snap.code.toLowerCase()); assert.equal(v.valid, true); assert.equal(v.intact, true); assert.equal(v.revoked, false); assert.equal(v.body, undefined, 'خاصّة → لا جسم'); assert.equal(v.counts.kept, 2); assert.equal(v.title_ar, 'خريطة أثري 2026');
  await setSnapshotPublic(db, me, s1.snap.id, true); v = await verifyMap(db, s1.snap.code); assert.equal(v.is_public, true); assert.ok(v.body && v.body.stations.length > 0); assert.ok(!JSON.stringify(v.body).includes('طالب يرفض'));
  /* العبث بالجسم يكسر البصمة */
  db.T.portal_map_snapshots[0].body = { ...db.T.portal_map_snapshots[0].body, threads: [] }; v = await verifyMap(db, s1.snap.code); assert.equal(v.intact, false);
  /* إعادة التوقيع تُبطل السابقة — واحدة نافذة */
  const s2: any = await signSnapshot(db, me, { year: 2026, now: new Date('2026-12-01T10:00:00Z') }); assert.equal(s2.ok, true); assert.notEqual(s2.snap.code, s1.snap.code);
  assert.equal(db.T.portal_map_snapshots.filter((x: any) => !x.revoked_at).length, 1); v = await verifyMap(db, s1.snap.code); assert.equal(v.revoked, true); assert.equal(v.body, undefined);
  await revokeSnapshot(db, me, s2.snap.id); v = await verifyMap(db, s2.snap.code); assert.equal(v.revoked, true); assert.equal(v.is_public, false);
  /* الحذف فوري ويعيد الخيط مقترَحًا */
  r = await removeThread(db, me, { from: 'program:p1', to: `skill:${S1}` }); assert.equal(r.ok, true); assert.equal(db.T.portal_map_threads.length, 2);
  const nothing: any = await signSnapshot(db, { id: 'u9', email: 'nobody@example.com' }, { year: 2026, now: new Date('2026-11-07T10:00:00Z') }); assert.equal(nothing.status, 409);
});

test('p58: 🧭 الإشعار — نصّ · لمن تحرّك فقط · مرّة لكل خيط · ≤ 1 في اليوم · dry لا يكتب', async () => {
  assert.equal(nudgeText(1, 'x').title_ar, 'خيط جديد ينتظر كلمتك'); assert.equal(nudgeText(2, 'x').title_ar, 'خيطان جديدان ينتظران كلمتك'); assert.match(nudgeText(4, 'برنامج').body_ar, /^برنامج — هل هذا خيط؟/); assert.equal(nudgeText(1, 'x').url, '/me/athar-map');
  assert.equal(NOTICE_KIND_AR.map_thread, 'خريطة أثرك'); assert.equal(KIND_ICON.map_thread, '🧭');
  const email = 'noura@example.com'; const now = new Date('2026-09-02T06:00:00Z'); const db: any = fakeDb({ email, input: inp() });
  const dry = await runMapNudges(db, { now, dry: true }); assert.equal(dry.scanned, 1); assert.equal(dry.sent, 1); assert.equal(db.T.portal_learner_notices.length, 0);
  db.T.__now = [now.toISOString()]; const a = await runMapNudges(db, { now }); assert.equal(a.sent, 1); assert.equal(db.T.portal_learner_notices.length, 1); const n = db.T.portal_learner_notices[0]; assert.equal(n.kind, 'map_thread'); assert.match(n.dedupe_key, /^map_thread:noura@example.com:horizon:h1>horizon_review:/); assert.match(n.title_ar, /خيوط جديدة تنتظر كلمتك/);
  const b = await runMapNudges(db, { now: new Date('2026-09-02T12:00:00Z') }); assert.equal(b.sent, 0, 'لا ثاني في اليوم نفسه');
  db.T.__now = ['2026-09-03T06:00:00.000Z']; const c = await runMapNudges(db, { now: new Date('2026-09-03T06:00:00Z') }); assert.equal(c.scanned, 1); assert.equal(c.sent, 1, 'اليوم التالي: الخيط التالي مرّة واحدة'); assert.notEqual(db.T.portal_learner_notices[1].dedupe_key, n.dedupe_key);
  const quiet = await runMapNudges(db, { now: new Date('2026-12-01T06:00:00Z') }); assert.equal(quiet.scanned, 0, 'لا حركة خلال 48 ساعة → لا فحص');
  assert.equal(dayKey(new Date('2026-09-02T21:30:00Z')), '2026-09-03');
  assert.equal(Object.keys(KIND_AR).length, 13);
});

test('p58: «نادِ» — «خريطتي» و«ما قاد إلى ماذا» تقودان إلى /me/athar-map · «رحلتي» تبقى كما هي', async () => {
  const { parseCommand } = await import('../lib/portal/voice');
  for (const s of ['خريطتي', 'افتح خريطة أثري', 'ما قاد إلى ماذا', 'خيوطي']) { const i: any = parseCommand(s); assert.equal(i.href || i.to || i.path, '/me/athar-map', s); }
  const j: any = parseCommand('رحلتي'); assert.equal(j.href || j.to || j.path, '/me/journey');
});
