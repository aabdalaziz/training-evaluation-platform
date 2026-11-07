// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P66 «أيام التدريب وفترات التطبيق» — النواة: الإدخال بثلاث طرق · الاشتقاق (كتل · فترات تطبيق ≥ 7 · أول/آخر يوم) · الطور اليومي · ما يُسمح بكتابته · «ما جرى في الميدان» k ≥ 5 · الكرون · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { P66_NAMES_AR, CAL_LIMITS, LINE_PATH, parseDays, expandDays, patternDays, validateDays, deriveCalendar, phaseOf, allowedKinds, weekStartIn, validateLine, cleanLine, fieldSummaryOf, atharLine, roadOf, applyStartNotice, applyWeekNotice, fieldSummaryNotice, commitOpenNotice, isWeekend, addDays, daysBetween } from '../lib/calendar/registry';
import { runRoomCalendar } from '../lib/calendar/store';
import { parseCommand } from '../lib/portal/voice';
import { crumbsFor } from '../lib/portal/way';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));

test('P66 · الأسماء والحدود · الإدخال بثلاث طرق (لصق · N أيام · نمط) يتخطّى الجمعة والسبت · التحقّق', () => {
  assert.equal(P66_NAMES_AR.cal, 'تقويم الشعبة'); assert.equal(P66_NAMES_AR.apply, 'البرنامج معك في موقعك'); assert.equal(P66_NAMES_AR.commit, 'التزامي حتى نلتقي'); assert.equal(P66_NAMES_AR.official, 'تقويم الشعبة وفترات التطبيق الميداني'); assert.equal(LINE_PATH, '/me/line');
  assert.deepEqual(CAL_LIMITS, { maxDays: 400, joinGap: 2, applyGap: 7, lineMin: 5, lineMax: 200, k: 5, show: 5, summaryBeforeDays: 3, commitTailDays: 1 });
  assert.deepEqual(parseDays('2026-1-5 · 06/01/2026\n2026-01-05 2026-02-30 نص'), ['2026-01-05', '2026-01-06'], 'صيغتان · بلا تكرار · تاريخ مستحيل يُستبعد');
  assert.ok(isWeekend('2026-11-06') && isWeekend('2026-11-07') && !isWeekend('2026-11-08'), 'الجمعة والسبت');
  assert.deepEqual(expandDays('2026-11-05', 3), ['2026-11-05', '2026-11-08', '2026-11-09'], 'الخميس ثم الأحد والاثنين');
  const pat = patternDays('2026-11-08', 5, 4, 3); assert.equal(pat.length, 15); assert.equal(pat[0], '2026-11-08'); assert.equal(pat[4], '2026-11-12'); assert.equal(pat[5], '2026-12-06', 'الكتلة الثانية بعد 4 أسابيع'); assert.equal(pat[14], '2027-01-07');
  assert.equal(validateDays([]).ok, false); assert.equal(validateDays(['x']).ok, false); const v = validateDays(['2026-11-09', '2026-11-08', '2026-11-08']); assert.ok(v.ok && v.days.join() === '2026-11-08,2026-11-09');
  assert.equal(validateDays(['2020-01-01', '2026-01-01']).ok, false, 'لا يمتدّ ثلاث سنوات');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02'); assert.equal(daysBetween('2026-11-01', '2026-11-08'), 7);
});

test('P66 · الاشتقاق: عطلة ≤ يومين تُضمّ إلى الكتلة · فجوة ≥ 7 = فترة تطبيق · أول/آخر يوم · بلا تقويم = لا شيء', () => {
  const cal = deriveCalendar(patternDays('2026-11-08', 5, 4, 3));
  assert.equal(cal.blocks.length, 3); assert.equal(cal.applies.length, 2); assert.equal(cal.first, '2026-11-08'); assert.equal(cal.last, '2027-01-07');
  assert.deepEqual(cal.blocks.map((b) => [b.no, b.start, b.end, b.days.length]), [[1, '2026-11-08', '2026-11-12', 5], [2, '2026-12-06', '2026-12-10', 5], [3, '2027-01-03', '2027-01-07', 5]]);
  assert.deepEqual(cal.applies[0], { no: 1, from: '2026-11-13', to: '2026-12-05', after_block: 1, next_block_start: '2026-12-06', weeks: 4, days: 23 });
  const w = deriveCalendar(['2026-11-05', '2026-11-08']); assert.equal(w.blocks.length, 1, 'الخميس والأحد كتلة واحدة (عطلة يومان)'); assert.equal(w.applies.length, 0);
  const g3 = deriveCalendar(['2026-11-05', '2026-11-09']); assert.equal(g3.blocks.length, 2, 'ثلاثة أيام فاصلة = كتلتان'); assert.equal(g3.applies.length, 0, 'لكن ليست فترة تطبيق (< 7)');
  const empty = deriveCalendar([]); assert.equal(empty.first, null); assert.equal(phaseOf(empty, '2026-11-08').phase, 'none'); assert.equal(phaseOf(null, '2026-11-08').phase, 'none');
});

test('P66 · الطور اليومي: قبل · تدريب (أول/آخر يوم كتلة · أول/آخر يوم برنامج) · تطبيق (أسبوع · أيام متبقية) · استراحة · بعد — وما يُسمح بكتابته', () => {
  const cal = deriveCalendar(patternDays('2026-11-08', 5, 4, 3));
  assert.equal(phaseOf(cal, '2026-11-01').phase, 'before'); assert.equal(phaseOf(cal, '2026-11-01').next?.days, 7);
  const d1 = phaseOf(cal, '2026-11-08'); assert.equal(d1.phase, 'training'); assert.deepEqual(d1.block, { no: 1, day_idx: 1, len: 5, is_first_day: true, is_last_day: false, is_program_first: true, is_program_last: false, next_block_start: '2026-12-06' }); assert.deepEqual(allowedKinds(d1), ['learn']);
  const d5 = phaseOf(cal, '2026-11-12'); assert.ok(d5.block?.is_last_day); assert.deepEqual(allowedKinds(d5), ['learn', 'commit'], 'آخر يوم الكتلة: سطر اليوم + الالتزام');
  const a = phaseOf(cal, '2026-11-20'); assert.equal(a.phase, 'apply'); assert.deepEqual(a.apply, { no: 1, week_no: 2, weeks: 4, from: '2026-11-13', to: '2026-12-05', next_block_start: '2026-12-06', days_left: 16, week_start: '2026-11-20' }); assert.deepEqual(allowedKinds(a), ['apply']);
  assert.equal(weekStartIn('2026-11-13', '2026-11-19'), '2026-11-13'); assert.equal(weekStartIn('2026-11-13', '2026-11-20'), '2026-11-20');
  const last = phaseOf(cal, '2027-01-07'); assert.ok(last.block?.is_program_last && last.block.is_last_day); assert.deepEqual(allowedKinds(last), ['learn'], 'آخر يوم البرنامج: لا التزام (لا كتلة بعده)');
  assert.equal(phaseOf(cal, '2027-02-01').phase, 'after'); assert.deepEqual(allowedKinds(phaseOf(cal, '2027-02-01')), []);
  const two = deriveCalendar(['2026-11-05', '2026-11-09']); assert.equal(phaseOf(two, '2026-11-07').phase, 'rest', 'فجوة قصيرة = استراحة صامتة'); assert.deepEqual(allowedKinds(phaseOf(two, '2026-11-07')), []);
  assert.match(atharLine(d1, 'الدبلوم'), /يومك الأول/); assert.match(atharLine(d5, 'الدبلوم'), /آخر يوم في الكتلة 1/); assert.match(atharLine(a, 'الدبلوم'), /البرنامج معك في موقعك.*الأسبوع 2 من 4/); assert.match(atharLine(last, 'الدبلوم'), /آخر يوم تدريب/);
  const road = roadOf(cal, a); assert.equal(road.length, 5, '3 كتل + فترتان'); assert.deepEqual(road.map((r) => r.state), ['done', 'now', 'next', 'next', 'next']);
});

test('P66 · السطر 5–200 منقّى · «ما جرى في الميدان»: أشخاص ≥ 5 · ≤ 5 سطور · الموانع تظهر بخمسة أشخاص أيضًا · بلا أسماء · ثابت بالبذرة', () => {
  assert.match(validateLine('قصر')!, /5 أحرف/); assert.equal(validateLine('طبّقتُ طريقة الأسئلة المفتوحة مع الفريق'), null); assert.match(validateLine('x'.repeat(201))!, /200/); assert.match(validateLine('سطر سليم', 'y'.repeat(201))!, /200/);
  assert.equal(cleanLine('<b>نص</b>  مع http://x.y رابط'), 'نص مع رابط');
  const L = (u: string, b: string, bl?: string) => ({ user_id: u, body_ar: b, blocker_ar: bl || null, day: '2026-11-20' });
  const four = fieldSummaryOf([L('a', 'طبّقت أ'), L('b', 'طبّقت ب'), L('c', 'طبّقت ج'), L('d', 'طبّقت د'), L('a', 'طبّقت أ مرة أخرى')], { roster: 12 });
  assert.equal(four.shown, false); assert.equal(four.people, 4); assert.equal(four.lines, 5); assert.match(four.head_ar, /وثّق تطبيقَه 4 من 12؛ تظهر السطور حين يبلغون خمسة/); assert.deepEqual(four.applied, []);
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((u, i) => L(u, `طبّقت الخطوة ${i + 1}`, i < 4 ? `منعني ضغط العمل ${i + 1}` : undefined));
  const s = fieldSummaryOf(rows, { roster: 12, seed: 's' }); assert.equal(s.shown, true); assert.equal(s.people, 7); assert.equal(s.applied.length, 5, 'خمسة كحدّ'); assert.deepEqual(s.blockers, [], 'أربعة ذكروا الموانع — لا تظهر'); assert.equal(s.blockers_people, 4); assert.match(s.below_ar!, /ذكر ما منعه 4/);
  assert.deepEqual(fieldSummaryOf(rows, { roster: 12, seed: 's' }).applied, s.applied, 'ثابت بالبذرة'); assert.notDeepEqual(fieldSummaryOf(rows, { roster: 12, seed: 't' }).applied, s.applied);
  const s5 = fieldSummaryOf(rows.map((r, i) => ({ ...r, blocker_ar: `منعني شيء ${i}` })), { roster: 12 }); assert.equal(s5.blockers.length, 5); assert.equal(s5.below_ar, null);
  assert.ok(!JSON.stringify(s).includes('user_id'), 'المخرج بلا معرّفات');
  assert.equal(fieldSummaryOf([], {}).head_ar, 'لم يوثّق أحد تطبيقه بعد.');
});

test('P66 · نصوص الإشعارات · الصوت والطريق · سجلّ الخزنة', () => {
  assert.match(applyStartNotice('الدبلوم', '2026-12-06').title_ar, /«الدبلوم» معك في موقعك/); assert.match(applyWeekNotice('الدبلوم', 2, 4).title_ar, /الأسبوع 2 من 4/);
  const fs = fieldSummaryOf([], {}); assert.match(fieldSummaryNotice('N-1', fs, '2026-12-06').title_ar, /ما جرى في الميدان — شعبة N-1/); assert.match(commitOpenNotice('الدبلوم').title_ar, /وعدتَ به نفسك/);
  assert.equal((parseCommand('افتح سطري') as any)?.href, '/me/line'); assert.equal((parseCommand('سطر التطبيق') as any)?.href, '/me/line'); assert.equal((parseCommand('ماذا طبقت') as any)?.href, '/me/line');
  assert.equal(crumbsFor('/me/line', 'ar').slice(-1)[0].label, 'سطري');
  const reg = REGISTRY.find((r) => r.table === 'portal_learning_lines'); assert.ok(reg); assert.equal(reg!.policy, 'delete'); assert.deepEqual(reg!.piiCols, ['body_ar', 'blocker_ar']); assert.ok(NON_PERSONAL_TABLES.includes('portal_room_calendars'));
});

test('P66 · الكرون: 🧭 بداية فترة التطبيق (يُدفع) · التذكير الأسبوعي · «ما جرى في الميدان» للمدرّب قبل العودة بثلاثة أيام · فتح الالتزام يوم العودة · أول يوم من التقويم (مفتاح P64 نفسه) · dedupe', async () => {
  const today = '2026-11-20'; const now = new Date(`${today}T06:00:00Z`);
  const daysA = patternDays('2026-11-08', 5, 4, 3); /* فترة التطبيق 1: 13/11 → 5/12 · اليوم = بداية الأسبوع 2 */
  const daysB = [...expandDays('2026-11-01', 5), ...expandDays('2026-11-20', 5, false)]; /* اليوم = أول يوم الكتلة 2 → تُفتح الالتزامات */
  const daysC = [...expandDays('2026-10-25', 5), ...expandDays('2026-11-23', 3)]; /* days_left = 3 → ملخّص المدرّب */
  const daysD = expandDays('2026-11-20', 10, false); /* أول يوم من التقويم ≠ start_date للبرنامج → first_day عبر التقويم */
  const cals = [{ classroom_id: 'cA', program_id: 'pA', days: daysA }, { classroom_id: 'cB', program_id: 'pB', days: daysB }, { classroom_id: 'cC', program_id: 'pC', days: daysC }, { classroom_id: 'cD', program_id: 'pD', days: daysD }, { classroom_id: 'cOld', program_id: 'pOld', days: ['2025-01-01'] }];
  const rooms = [{ id: 'cA', code: 'A', program_id: 'pA', trainer_id: 't1' }, { id: 'cB', code: 'B', program_id: 'pB', trainer_id: 't1' }, { id: 'cC', code: 'C', program_id: 'pC', trainer_id: 't1' }, { id: 'cD', code: 'D', program_id: 'pD', trainer_id: null }];
  const programs = [{ id: 'pA', name_ar: 'ألف', start_date: '2026-11-08', end_date: '2027-01-07' }, { id: 'pB', name_ar: 'باء', start_date: '2026-11-01', end_date: '2026-11-26' }, { id: 'pC', name_ar: 'جيم', start_date: '2026-10-25', end_date: '2026-11-25' }, { id: 'pD', name_ar: 'دال', start_date: '2026-11-01', end_date: '2026-12-31' }];
  const trainers = [{ id: 't1', email: 'T1@x.sa' }];
  const enroll = [...['a', 'b', 'c'].map((x, i) => ({ id: `eA${i}`, classroom_id: 'cA', email: `${x}@x.sa`, user_id: `u${i}`, status: 'approved' })), { id: 'eAp', classroom_id: 'cA', email: 'p@x.sa', user_id: null, status: 'pending' },
    { id: 'eB1', classroom_id: 'cB', email: 'b1@x.sa', user_id: 'ub1', status: 'approved' }, ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: `eC${i}`, classroom_id: 'cC', email: `c${i}@x.sa`, user_id: `uc${i}`, status: 'approved' })), { id: 'eD1', classroom_id: 'cD', email: 'd1@x.sa', user_id: 'ud1', status: 'approved' }];
  const lines = [{ id: 1, classroom_id: 'cB', kind: 'commit', email: 'b1@x.sa', user_id: 'ub1', opens_on: '2026-11-20', done: null }, { id: 2, classroom_id: 'cB', kind: 'commit', email: 'b1@x.sa', user_id: 'ub1', opens_on: '2026-11-20', done: 'yes' },
    ...[1, 2, 3, 4, 5].map((i) => ({ id: 10 + i, classroom_id: 'cC', kind: 'apply', user_id: `uc${i}`, email: `c${i}@x.sa`, body_ar: `طبّقت الشيء ${i}`, blocker_ar: null, day: '2026-11-10' }))];
  const notices: any[] = [];
  const db: any = { from: (t: string) => { const q: any = { _eq: {} as Record<string, string>, _in: {} as Record<string, string[]>, _isnull: [] as string[], _notnull: [] as string[], _gte: {} as Record<string, string>, _lte: {} as Record<string, string> }; const chain = () => q;
    for (const op of ['select', 'neq', 'order']) q[op] = chain; q.eq = (k: string, v: any) => { q._eq[k] = String(v); return q; }; q.in = (k: string, v: string[]) => { q._in[k] = v; return q; }; q.is = (k: string, v: any) => { if (v === null) q._isnull.push(k); return q; }; q.not = (k: string, op: string, v: any) => { if (op === 'is' && v === null) q._notnull.push(k); return q; }; q.gte = (k: string, v: string) => { q._gte[k] = v; return q; }; q.lte = (k: string, v: string) => { q._lte[k] = v; return q; };
    const run = () => { let rows: any[] = t === 'portal_room_calendars' ? cals : t === 'classrooms' ? rooms : t === 'programs' ? programs : t === 'trainers' ? trainers : t === 'portal_enrollments' ? enroll : t === 'portal_learning_lines' ? lines : [];
      for (const [k, v] of Object.entries(q._eq)) rows = rows.filter((r) => String(r[k]) === v); for (const [k, v] of Object.entries(q._in)) rows = rows.filter((r) => (v as string[]).includes(String(r[k]))); for (const k of q._isnull) rows = rows.filter((r) => r[k] === null || r[k] === undefined); for (const k of q._notnull) rows = rows.filter((r) => r[k] !== null && r[k] !== undefined); for (const [k, v] of Object.entries(q._gte)) rows = rows.filter((r) => String(r[k]) >= String(v)); for (const [k, v] of Object.entries(q._lte)) rows = rows.filter((r) => String(r[k]) <= String(v)); return rows; };
    q.limit = () => Promise.resolve({ data: run(), error: null }); q.maybeSingle = () => Promise.resolve({ data: run()[0] || null, error: null });
    const ins = (p: any) => ({ select: () => { const go = async () => { if (notices.some((n) => n.dedupe_key === p.dedupe_key)) return { data: null, error: null }; notices.push(p); return { data: [{ id: notices.length, ...p }], error: null }; }; const pr = go(); return Object.assign(pr, { single: async () => { const r = await pr; return r.data ? { data: r.data[0], error: null } : { data: null, error: { code: '23505', message: 'dup' } }; }, maybeSingle: async () => { const r = await pr; return { data: r.data ? r.data[0] : null, error: null }; } }); }, then: (r: any) => r({ data: null, error: null }) });
    q.upsert = ins; q.insert = ins; return q; } };
  const r1 = await runRoomCalendar(db, { now, dry: false }); assert.deepEqual(r1.errors, []);
  assert.equal(r1.rooms, 4, 'القديم خارج نطاقه لا يُحسب'); assert.equal(r1.apply_week, 9, 'ثلاثة في cA (pending لا) + ستة في cC — تذكير أسبوعي'); assert.equal(r1.apply_start, 0, 'ليست بداية الفترة');
  const w = notices.find((n) => n.kind === 'apply_week'); assert.equal(w.dedupe_key, 'apply_week:eA0:1:2'); assert.equal(w.url, '/me/line'); assert.match(w.title_ar, /الأسبوع 2 من 4/);
  assert.equal(r1.commits, 1, 'التزام واحد غير مُجاب يُفتح اليوم'); const c = notices.find((n) => n.kind === 'commit_open'); assert.equal(c.dedupe_key, 'commit_open:1'); assert.equal(c.email, 'b1@x.sa');
  assert.equal(r1.field, 1, 'cC: تعود الكتلة بعد 3 أيام → ملخّص المدرّب'); const f = notices.find((n) => n.kind === 'field_summary'); assert.equal(f.email, 't1@x.sa'); assert.equal(f.dedupe_key, 'field_summary:cC:1'); assert.equal(f.url, '/me/day?room=cC#calendar'); assert.match(f.body_ar, /وثّق تطبيقَه 5 من 6/);
  assert.equal(r1.first, 1, 'cD: أول يوم من التقويم ≠ start_date → 🌅 عبر التقويم'); const fd = notices.find((n) => n.kind === 'first_day'); assert.equal(fd.dedupe_key, 'first_day:eD1', 'مفتاح P64 نفسه — لا تكرار'); assert.equal(fd.url, '/me/first?program=pD'); assert.equal(r1.last, 0);
  assert.ok(!notices.some((n) => n.email === 'p@x.sa'), 'pending لا يصله شيء');
  const r2 = await runRoomCalendar(db, { now, dry: false }); assert.equal(r2.apply_week + r2.commits + r2.field + r2.first, 0, 'مرّة واحدة'); assert.equal(notices.filter((n) => n.kind === 'apply_week' && n.email === 'c1@x.sa')[0].dedupe_key, 'apply_week:eC1:1:4');
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runRoomCalendar\(db, \{ site, dry \}\)/); assert.match(cron, /first_days, room_calendar, evidence/);
});

test('P66 · شكل المصدر: جدولان (SQL واحد) · P64/P63/P62 تقرأ أول/آخر يوم من التقويم · بطاقة دفتر اليوم · تبويب «سطري» · الواجهات تستورد النقي فقط', () => {
  const sql = read('supabase/p66-room-calendar.sql'); assert.match(sql, /create table if not exists public\.portal_room_calendars/); assert.match(sql, /create table if not exists public\.portal_learning_lines/); assert.match(sql, /kind in \('learn','apply','commit'\)/); assert.match(sql, /unique \(user_id, classroom_id, kind, day\)/); assert.match(sql, /enable row level security/);
  for (const p of ['lib/first/store.ts', 'lib/grad/store.ts', 'lib/letters/store.ts']) assert.match(read(p), /datesOverlay\(db, en\.map/, p);
  const day = read('app/me/day/DayBook.tsx'); assert.match(day, /import\('\.\/RoomCalendar'\)/); assert.match(day, /<RoomCalendar roomId=\{r\.id\}/); assert.match(day, /roomParam === r\.id/);
  assert.match(read('app/me/page.tsx'), /href="\/me\/line" data-testid="me-line"/);
  for (const p of ['app/me/line/LineDesk.tsx', 'app/me/day/RoomCalendar.tsx']) { const s = read(p); assert.ok(!/from '\.\.\/\.\.\/\.\.\/lib\/calendar\/store'/.test(s.replace(/import type[^\n]*\n/g, '')), `${p} لا يستورد طبقة القاعدة إلا كنوع`); assert.ok(!s.includes('node:crypto')); }
  assert.ok(has('app/api/me/line/route.ts') && has('app/api/me/calendar/route.ts') && has('app/me/line/page.tsx'));
  const st = read('lib/calendar/store.ts'); assert.match(st, /dedupe_key: `first_day:\$\{e\.id\}`/); assert.match(st, /dedupe_key: `grad_day:\$\{e\.id\}`/); assert.match(st, /ph\.apply\.days_left === CAL_LIMITS\.summaryBeforeDays/);
  assert.match(read('lib/calendar/registry.ts'), /^export function phaseOf/m);
});
