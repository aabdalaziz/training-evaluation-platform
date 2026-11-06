// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P51 «دفتر اليوم» — سجلّ المدرّب اليومي: التنقية والصيغ · التحية والتاريخ · الروستر الحيّ والغياب · المتوقّفون · عُبور الأسبوع · «كلمة» (dedupe/merge · لا درجات) · نبض الصباح · عقد المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanWord, fillTemplate, WORD_TEMPLATES, greeting, yesterdayOf, riyadhDayBounds, digestText, recipientsFor, resolveTrainer, collectDayBook, sendWord, runDayDigest, DAY_OFFICIAL, WORD_MAX } from '../lib/portal/day';
import type { ClassDay } from '../lib/portal/day';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';
import { DOORS } from '../lib/portal/hub';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const NOW = new Date('2026-11-06T06:30:00.000Z'); /* 09:30 الرياض · الجمعة */

test('P51: cleanWord (وسوم · روابط · مسافات · ≤200) · fillTemplate · الصيغ الثلاث بلا درجات', () => {
  assert.equal(cleanWord('  <b>أهلًا</b>  بك https://x.y/z  و www.a.b  '), 'أهلًا بك و'); assert.equal(cleanWord('<i>أمل</i>، أهلًا'), 'أمل، أهلًا'); assert.equal(cleanWord('ن'.repeat(300)).length, WORD_MAX); assert.equal(cleanWord(null), '');
  assert.equal(fillTemplate(WORD_TEMPLATES[0], 'سارة'), 'افتقدناك أمس يا سارة. مقعدك محفوظ، والدرس القادم يبدأ من حيث توقّفنا — أراك فيه.'); assert.match(fillTemplate(WORD_TEMPLATES[1], ''), /يا صديقي/);
  assert.deepEqual(WORD_TEMPLATES.map((t) => t.key), ['absent', 'idle', 'cheer']); assert.ok(WORD_TEMPLATES.every((t) => !/\d+\s*%|درجة/.test(t.text_ar)), 'لا درجات ولا نسب');
  assert.equal(DAY_OFFICIAL.en, 'Trainer Daily Ledger'); assert.equal(KIND_AR.trainer_word, 'كلمة من مدرّبك'); assert.equal(KIND_ICON.day_digest, '📒');
});

test('P51: greeting بساعة الرياض · yesterdayOf · riyadhDayBounds · digestText', () => {
  const g = greeting(NOW, 'أحمد'); assert.equal(g.hello_ar, 'صباح الخير يا أحمد'); assert.equal(g.date, '2026-11-06'); assert.match(g.date_ar, /الجمعة/);
  assert.match(greeting(new Date('2026-11-06T11:00:00Z')).hello_ar, /^نهارك سعيد$/); assert.match(greeting(new Date('2026-11-06T16:00:00Z')).hello_ar, /^مساء الخير$/);
  assert.equal(yesterdayOf(NOW), '2026-11-05'); assert.equal(yesterdayOf(new Date('2026-11-06T22:30:00Z')), '2026-11-06', 'بعد منتصف ليل الرياض — أمس هو 6');
  assert.deepEqual(riyadhDayBounds(NOW), { from: '2026-11-05T21:00:00.000Z', to: '2026-11-06T21:00:00.000Z' });
  const d = digestText({ sessions_today: 2, absent_yesterday: 3, idle: 1, to_sign: 4 }); assert.equal(d.title_ar, 'دفتر اليوم: جلستان · غاب أمس 3 · متوقّفون في مِران 1 · ينتظر توقيعك 4'); assert.equal(d.url, '/me/day');
  assert.equal(digestText({ sessions_today: 0, absent_yesterday: 0, idle: 0, to_sign: 0 }).title_ar, 'دفتر اليوم: لا شيء يستدعي انتباهك'); assert.match(digestText({ sessions_today: 1, absent_yesterday: 0, idle: 0, to_sign: 0 }).title_ar, /جلسة واحدة$/); assert.match(digestText({ sessions_today: 5, absent_yesterday: 0, idle: 0, to_sign: 0 }).title_ar, /5 جلسات$/);
});

const ROOM: ClassDay = { id: 'c1', code: 'A-101', section_name: null, program_id: 'p1', roster: 3, roster_list: [{ email: 'a@x.sa', name: 'أمل' }, { email: 'b@x.sa', name: 'بدر' }, { email: 'c@x.sa', name: 'جود' }], absent_yesterday: [{ email: 'a@x.sa', name: 'أمل', absences_30: 2 }, { email: 'b@x.sa', name: 'بدر', absences_30: 1 }], sessions_yesterday: 1, practice: { active: 2, done_today: 0, idle: [{ email: 'b@x.sa', name: 'بدر', idle_days: 4 }] }, drafts_pending: 0, exit_week: { passed: 0, conditional: 0, failed: 0, no_plan: 0 } };
test('P51: recipientsFor — absent/idle/all/one بلا تكرار · one خارج الروستر → لا أحد', () => {
  assert.deepEqual(recipientsFor('absent', ROOM).map((l) => l.email), ['a@x.sa', 'b@x.sa']); assert.deepEqual(recipientsFor('idle', ROOM).map((l) => l.email), ['b@x.sa']); assert.equal(recipientsFor('all', ROOM).length, 3);
  assert.deepEqual(recipientsFor('one', ROOM, 'C@X.SA'), [{ email: 'c@x.sa', name: 'جود' }]); assert.deepEqual(recipientsFor('one', ROOM, 'z@x.sa'), []); assert.deepEqual(recipientsFor('one', ROOM, null), []);
});

/** قاعدة بيانات وهمية: المدرّب t1 (trainer@x.sa) يملك c1 · شعبة c2 لغيره · جلستان اليوم (واحدة ملغاة) · حضور أمس: أمل غابت، بدر حضر، جود (غير مقيَّدة) حضرت قبل أسبوع فهي في الروستر وغابت أمس · خطّتا مِران: بدر متوقّف 4 أيام، أمل أنجزت اليوم · تقرير عُبور «لم يجتز» بلا خطّة */
function fakeDb(over: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {
    trainers: [{ id: 't1', name: 'د. أحمد', email: 'Trainer@x.sa' }, { id: 't2', name: 'أ. سارة', email: 'other@x.sa' }, { id: 't3', name: 'بلا بريد', email: null }],
    classrooms: [{ id: 'c1', code: 'A-101', section_name: 'شعبة 1', program_id: 'p1', trainer_id: 't1' }, { id: 'c2', code: 'B-201', section_name: null, program_id: 'p1', trainer_id: 't2' }],
    portal_sessions: [{ id: 's1', title_ar: 'محادثة', kind: 'class', starts_at: '2026-11-06T07:00:00Z', duration_min: 60, provider: 'teams', status: 'scheduled', classroom_id: 'c1', trainer_id: 't1', join_url: 'https://teams.example/j' }, { id: 's2', title_ar: 'تعويض', kind: 'remedial', starts_at: '2026-11-06T15:00:00Z', duration_min: 45, provider: 'athar', status: 'cancelled', classroom_id: 'c1', trainer_id: 't1', join_url: null }, { id: 's3', title_ar: 'غدًا', kind: 'class', starts_at: '2026-11-07T07:00:00Z', duration_min: 60, provider: 'zoom', status: 'scheduled', classroom_id: 'c1', trainer_id: 't1', join_url: null }, { id: 's9', title_ar: 'لغيري', kind: 'class', starts_at: '2026-11-06T08:00:00Z', duration_min: 60, provider: 'meet', status: 'scheduled', classroom_id: 'c2', trainer_id: 't2', join_url: null }],
    portal_session_private: [{ session_id: 's1', host_url: 'https://teams.example/host' }],
    portal_enrollments: [{ email: 'a@x.sa', full_name: 'أمل', classroom_id: 'c1', status: 'approved' }, { email: 'b@x.sa', full_name: 'بدر', classroom_id: 'c1', status: 'approved' }, { email: 'p@x.sa', full_name: 'معلّق', classroom_id: 'c1', status: 'pending' }, { email: 'z@x.sa', full_name: 'زيد', classroom_id: 'c2', status: 'approved' }],
    attendance_sessions: [{ id: 'as1', classroom_id: 'c1', session_date: '2026-11-05' }, { id: 'as0', classroom_id: 'c1', session_date: '2026-10-29' }, { id: 'asx', classroom_id: 'c2', session_date: '2026-11-05' }],
    attendance_records: [{ session_id: 'as1', email: 'B@x.sa', full_name: 'بدر', status: 'present' }, { session_id: 'as0', email: 'c@x.sa', full_name: 'جود', status: 'late' }, { session_id: 'as0', email: 'a@x.sa', full_name: 'أمل', status: 'present' }, { session_id: 'asx', email: 'z@x.sa', full_name: 'زيد', status: 'present' }],
    placement_decisions: [{ report_id: 'r1', classroom_id: 'c1', decision_status: 'approved' }, { report_id: 'r2', classroom_id: 'c1', decision_status: 'approved' }],
    placement_invites: [{ id: 'inv1', classroom_id: 'c1', level_target: 'A1' }],
    miaar_practice_plans: [{ id: 'p1', report_id: 'r1', invite_id: null, email: 'a@x.sa', kind: 'placement', status: 'approved', approved_at: '2026-11-01T00:00:00Z', last_attempt_at: '2026-11-06T05:00:00Z', days: [{ d: 1, done_at: '2026-11-06T05:00:00Z' }] }, { id: 'p2', report_id: 'r2', invite_id: null, email: 'b@x.sa', kind: 'placement', status: 'approved', approved_at: '2026-11-01T00:00:00Z', last_attempt_at: '2026-11-02T05:00:00Z', days: [] }, { id: 'p3', report_id: 'r3', invite_id: null, email: 'q@x.sa', kind: 'placement', status: 'draft', approved_at: null, last_attempt_at: null, days: [] }],
    placement_reports: [{ id: 'x1', invite_id: 'inv1', report: { exit: { الحالة: 'final', النتيجة: 'failed' } }, created_at: '2026-11-04T00:00:00Z', archived_at: null }, { id: 'x2', invite_id: 'inv1', report: { exit: { الحالة: 'final', النتيجة: 'passed' } }, created_at: '2026-11-04T00:00:00Z', archived_at: null }, { id: 'x3', invite_id: 'inv1', report: { exit: { الحالة: 'final', النتيجة: 'failed' } }, created_at: '2026-10-01T00:00:00Z', archived_at: null }],
    miaar_service_orders: [], question_bank_items: [], miaar_performances: [], audit_logs: [], portal_learner_notices: [], profiles: [], ...over,
  };
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let cnt = false; let mode: 'select' | 'insert' | 'upsert' = 'select'; let payload: any = null; let merge = false;
    const b: any = { select(_c?: string, o?: any) { if (o?.count) cnt = true; return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; }, not(k: string, op: string, v: any) { if (op === 'is' && v === null) f.push((r) => r[k] != null); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k] || '') >= String(v)); return b; }, lte(k: string, v: any) { f.push((r) => String(r[k] || '') <= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(r[k] || '') < String(v)); return b; }, ilike(k: string, v: any) { f.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, upsert(p: any, o?: any) { mode = 'upsert'; payload = p; merge = !o?.ignoreDuplicates; return b; },
      then(res: any) { if (mode !== 'select') { const arr = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}`, ...p })); if (mode === 'upsert') { for (const p of arr) { const i = rows.findIndex((r) => r.dedupe_key && r.dedupe_key === p.dedupe_key); if (i >= 0) { if (merge) { rows[i] = { ...rows[i], ...p, id: rows[i].id }; return res({ data: single ? rows[i] : [rows[i]], error: null }); } return res({ data: [], error: null }); } rows.push(p); } return res({ data: single ? arr[0] : arr, error: null }); } rows.push(...arr); return res({ data: arr, error: null }); }
        const hit = rows.filter((r) => f.every((p) => p(r))); const data = single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit); return res({ data, error: null, count: cnt ? hit.length : null }); } };
    return b; };
  return { T, from: q };
}

test('P51: resolveTrainer — ببريده · الطاقم يطّلع على مدرّب آخر (viewing_other) · غير الطاقم لا يستطيع', async () => {
  const db = fakeDb(); const me = await resolveTrainer(db as any, { id: 'u1', email: 'trainer@x.sa', staff: false }); assert.deepEqual(me.trainerIds, ['t1']); assert.equal(me.name, 'د. أحمد'); assert.equal(me.viewing_other, false);
  const st = await resolveTrainer(db as any, { id: 'u2', email: 'admin@x.sa', staff: true }, 't2'); assert.deepEqual(st.trainerIds, ['t2']); assert.equal(st.viewing_other, true); assert.equal(st.name, 'أ. سارة');
  const no = await resolveTrainer(db as any, { id: 'u5', email: 'learner@x.sa', staff: false }, 't2'); assert.deepEqual(no.trainerIds, [], 'لا اطّلاع بالنيابة لغير الطاقم');
});

test('P51: collectDayBook — جلسات اليوم (بلا الملغاة وبلا الغد وبلا جلسات غيري) · الروستر الحيّ (مقيَّد ∪ حضر خلال 30 يومًا، لا المعلّق) · من غاب أمس وعدد غياباته · المتوقّفون · أنجز اليوم · عُبور الأسبوع · العدّادات', async () => {
  const db = fakeDb(); const me = await resolveTrainer(db as any, { id: 'u1', email: 'trainer@x.sa', staff: false }); const b = await collectDayBook(db as any, me, 'https://x', { now: NOW });
  assert.equal(b.linked, true); assert.equal(b.hello_ar, 'صباح الخير يا د. أحمد'); assert.equal(b.date, '2026-11-06');
  assert.deepEqual(b.sessions.map((s) => s.id), ['s1']); assert.equal(b.sessions[0].host_url, 'https://teams.example/host'); assert.equal(b.sessions[0].state, 'upcoming'); { const live = await collectDayBook(db as any, me, 'https://x', { now: new Date('2026-11-06T07:20:00Z') }); assert.equal(live.sessions[0].state, 'live', 'بدأت ولم تنتهِ → على الهواء'); const soon = await collectDayBook(db as any, me, 'https://x', { now: new Date('2026-11-06T06:45:00Z') }); assert.equal(soon.sessions[0].state, 'soon'); const ended = await collectDayBook(db as any, me, 'https://x', { now: new Date('2026-11-06T09:00:00Z') }); assert.equal(ended.sessions[0].state, 'ended'); } assert.equal(b.sessions[0].classroom?.code, 'A-101'); assert.equal(b.sessions[0].facilitator_href, '/live/facilitator/s1');
  assert.equal(b.classrooms.length, 1); const r = b.classrooms[0]; assert.equal(r.id, 'c1'); assert.equal(r.roster, 3, 'أمل · بدر · جود (حضرت قبل أسبوع)'); assert.ok(!r.roster_list.some((l) => l.email === 'p@x.sa'), 'المعلّق ليس في الروستر');
  assert.equal(r.sessions_yesterday, 1);
  const ab = Object.fromEntries(r.absent_yesterday.map((l) => [l.email, l])); assert.ok(ab['a@x.sa'] && ab['c@x.sa'] && !ab['b@x.sa'], 'أمل وجود غابتا، بدر حضر'); assert.equal(ab['a@x.sa'].absences_30, 1, 'أمل حضرت جلسة 29 أكتوبر وغابت أمس'); assert.equal(ab['c@x.sa'].absences_30, 1); assert.equal(ab['a@x.sa'].name, 'أمل');
  assert.equal(r.practice.active, 2); assert.equal(r.practice.done_today, 1, 'أمل أنجزت اليوم'); assert.deepEqual(r.practice.idle.map((l) => [l.email, l.name, l.idle_days]), [['b@x.sa', 'بدر', 4]]);
  assert.deepEqual(r.exit_week, { passed: 1, conditional: 0, failed: 1, no_plan: 1 }, 'x3 أقدم من أسبوع فلا يُعدّ');
  assert.deepEqual(b.counts, { sessions_today: 1, absent_yesterday: 2, idle: 1, to_sign: 0 }); assert.equal(b.words_today, 0); assert.equal(b.templates.length, 3);
  assert.ok(!JSON.stringify(b).includes('زيد'), 'لا أسماء من شعبة غيري');
});

test('P51: collectDayBook — بريد غير مربوط → linked:false وفارغ · طاقم يطّلع على t2 → شعبة c2 بلا كلمة', async () => {
  const db = fakeDb(); const me = await resolveTrainer(db as any, { id: 'u9', email: 'nobody@x.sa', staff: false }); const b = await collectDayBook(db as any, me, 'https://x', { now: NOW }); assert.equal(b.linked, false); assert.equal(b.sessions.length, 0); assert.equal(b.classrooms.length, 0);
  const st = await resolveTrainer(db as any, { id: 'u2', email: 'admin@x.sa', staff: true }, 't2'); const b2 = await collectDayBook(db as any, st, 'https://x', { now: NOW }); assert.equal(b2.viewing_other, true); assert.deepEqual(b2.classrooms.map((c) => c.id), ['c2']); assert.deepEqual(b2.sessions.map((s) => s.id), ['s9']); assert.equal(b2.classrooms[0].absent_yesterday.length, 0, 'زيد حضر');
});

test('P51: sendWord — صيغة بالاسم الأول · نصّ حرّ منقّى · dedupe لكل متعلّم/مدرّب/يوم مع merge (الأحدث تحلّ محلّ الأقدم) · لا مستلم → خطأ · dry لا يكتب · كلمة للشعبة كلها', async () => {
  const db = fakeDb(); const me = await resolveTrainer(db as any, { id: 'u1', email: 'trainer@x.sa', staff: false }); const b = await collectDayBook(db as any, me, 'https://x', { now: NOW }); const room = b.classrooms[0];
  const r1 = await sendWord(db as any, me, room, { mode: 'absent', template: 'absent' }, { now: NOW }); assert.ok(!('error' in r1)); assert.equal(r1.sent, 2); assert.equal(r1.recipients, 2);
  const n = db.T.portal_learner_notices; assert.equal(n.length, 2); const a = n.find((x: any) => x.email === 'a@x.sa'); assert.equal(a.kind, 'trainer_word'); assert.equal(a.title_ar, 'كلمة من مدرّبك د. أحمد'); assert.match(a.body_ar, /^افتقدناك أمس يا أمل\./); assert.equal(a.url, '/me'); assert.equal(a.dedupe_key, 'trainer_word:t1:a@x.sa:2026-11-06'); assert.equal(a.ref_id, 'c1');
  const r2 = await sendWord(db as any, me, room, { mode: 'one', email: 'a@x.sa', text: '<i>أمل</i>، ننتظرك غدًا https://bad.link' }, { now: NOW }); assert.ok(!('error' in r2)); assert.equal(db.T.portal_learner_notices.length, 2, 'لا صفّ جديد — تحديث'); assert.equal(db.T.portal_learner_notices.find((x: any) => x.email === 'a@x.sa').body_ar, 'أمل، ننتظرك غدًا');
  const r3 = await sendWord(db as any, me, room, { mode: 'one', email: 'nope@x.sa', text: 'x' }, { now: NOW }); assert.deepEqual(r3, { error: 'لا مستلم لهذه الكلمة' });
  const r4 = await sendWord(db as any, me, room, { mode: 'idle', text: '' }, { now: NOW }); assert.deepEqual(r4, { error: 'اكتب كلمة أو اختر صيغة' });
  const r5 = await sendWord(db as any, me, room, { mode: 'all', template: 'cheer' }, { now: NOW, dry: true }); assert.ok(!('error' in r5)); assert.equal(r5.recipients, 3); assert.equal(db.T.portal_learner_notices.length, 2, 'dry لا يكتب');
  const r6 = await sendWord(db as any, me, room, { mode: 'all', template: 'cheer' }, { now: NOW }); assert.ok(!('error' in r6)); assert.equal(db.T.portal_learner_notices.length, 3, 'جود جديدة؛ أمل وبدر تحديث');
  assert.ok(db.T.portal_learner_notices.every((x: any) => !/\d+\s*%/.test(x.body_ar)), 'لا درجات');
});

test('P51: runDayDigest — إشعار day_digest لكل مدرّب له شيء (t1 نعم · t2 لا: لا غياب ولا توقّف لكن جلسة اليوم نعم → يُرسل) · بلا بريد يُتجاوز · مرّة في اليوم · dry', async () => {
  const db = fakeDb(); const r = await runDayDigest(db as any, { now: NOW }); assert.equal(r.trainers, 2); assert.equal(r.sent, 2);
  const n = db.T.portal_learner_notices.filter((x: any) => x.kind === 'day_digest'); assert.equal(n.length, 2); const t1 = n.find((x: any) => x.email === 'trainer@x.sa'); assert.equal(t1.title_ar, 'دفتر اليوم: جلسة واحدة · غاب أمس 2 · متوقّفون في مِران 1'); assert.equal(t1.url, '/me/day'); assert.equal(t1.dedupe_key, 'day_digest:trainer@x.sa:2026-11-06');
  const r2 = await runDayDigest(db as any, { now: NOW }); assert.equal(r2.sent, 0); assert.equal(db.T.portal_learner_notices.length, 2);
  const quiet = fakeDb({ portal_sessions: [], attendance_sessions: [], miaar_practice_plans: [] }); const r3 = await runDayDigest(quiet as any, { now: NOW }); assert.equal(r3.sent, 0, 'لا شيء → لا نبض');
  const dry = fakeDb(); const r4 = await runDayDigest(dry as any, { now: NOW, dry: true }); assert.equal(r4.sent, 2); assert.equal(dry.T.portal_learner_notices.length, 0);
});

test('P51: التكامل — «نادِ» يعرف «دفتر اليوم» لغير الإداري · باب المدرّب يبدأ به · WayBar · الكرون · /live/trainer · عقد المسار', () => {
  const d = DESTINATIONS.find((x) => x.href === '/me/day'); assert.ok(d && !d.admin);
  for (const say of ['دفتر اليوم', 'افتح دفتري', 'ماذا عندي اليوم', 'من غاب أمس']) { const i = parseCommand(say, { admin: false }) as any; assert.equal(i.kind, 'go', say); assert.equal(i.href, '/me/day', say); }
  assert.equal(DOORS.trainer.links[0].href, '/me/day'); assert.match(read('lib/portal/way.ts'), /'me\/day': \{ ar: 'دفتر اليوم'/);
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runDayDigest\(db, \{ site, dry \}\)/); assert.match(cron, /sign_digest, day_digest/);
  assert.match(read('app/live/trainer/page.tsx'), /href="\/me\/day"[^>]*data-testid="tr-daybook"/);
  const route = read('app/api/me/day/route.ts'); assert.match(route, /action !== 'word'/); assert.match(route, /me\.viewing_other\) return bad\('لا «كلمة» بالنيابة/); assert.match(route, /action: 'trainer_word'/); assert.match(route, /WORDS_PER_HOUR, 3600/); assert.match(route, /not_my_classroom/);
  const ui = read('app/me/day/DayBook.tsx'); for (const t of ['dy-root', 'dy-counts', 'dy-session', 'dy-room', 'dy-absent-row', 'dy-idle-row', 'dy-word-send', 'dy-word-ok', 'dy-print', 'dy-empty', 'dy-unlinked']) assert.ok(ui.includes(`data-testid="${t}"`) || ui.includes(`data-testid={\`${t}`), t);
  assert.match(ui, /window\.confirm/); assert.match(ui, /@media print/); assert.match(read('app/me/day/page.tsx'), /ssr: false/);
  assert.match(read('tests/index.ts'), /import '\.\/p51-day\.test'/);
});
