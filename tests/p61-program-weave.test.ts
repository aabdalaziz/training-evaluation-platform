// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P61 «نسيج البرنامج» — النواة: النطاق · k ≥ 5 · اليدوي لا يُحتسب · الخرّيجون · الدفعات · الأدلة تحت معاييرها · لا أسماء في المخرجات · الشفافية للمتعلّم */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { programWeave, weaveEvidence, weaveSnapshotLine, scopeKeys, cohortOf, programPeersOf, programPeersLine, kindShort, K_PROGRAM, P61_NAMES_AR, WEAVE_EVIDENCE_CODES, PROGRAM_WEAVE_ANCHOR } from '../lib/map/program-weave';
import type { ThreadRow, RosterRow } from '../lib/map/program-weave';
import { loadProgramWeave, programPeersForLearner, forgetProgramWeave } from '../lib/map/program-weave-load';
import { EVIDENCE_KIND_AR, coverageOf, DEFAULT_STANDARDS, snapshotBody } from '../lib/accreditation/registry';
import { parseCommand } from '../lib/portal/voice';

const SK = 'skill:11111111-1111-4111-8111-111111111111';
const PID = 'p-61'; const PK = `program:${PID}`;
const D = (d: number) => new Date(Date.UTC(2026, 0, 1) + d * 86400000).toISOString();
const emails = (n: number, p = 'l') => Array.from({ length: n }, (_, i) => `${p}${i}@upm.edu.sa`);
const roster = (es: string[], cohort = '2026'): RosterRow[] => es.map((email) => ({ email, cohort }));
const row = (email: string, rule: string, from = PK, to = SK, decided = D(100)): ThreadRow => ({ email, from_key: from, to_key: to, rule, decided_at: decided });
const scope = (end: string | null = D(90), extra: string[] = []) => ({ program_id: PID, name_ar: 'دبلوم التدريس', keys: scopeKeys(PID, ['s1', ...extra], ['m1']), end_date: end });

test('P61 · الأسماء والحدّ والمرساة ورموز الأدلة', () => {
  assert.equal(P61_NAMES_AR.title, 'نسيج البرنامج'); assert.match(P61_NAMES_AR.official, /المجمَّعة للبرنامج/); assert.equal(K_PROGRAM, 5); assert.equal(PROGRAM_WEAVE_ANCHOR, '#weave');
  assert.deepEqual(WEAVE_EVIDENCE_CODES.program_skill, ['3.2', '1.6']); assert.deepEqual(WEAVE_EVIDENCE_CODES.hand_session, ['3.4', '3.1']); assert.equal(WEAVE_EVIDENCE_CODES.manual, undefined);
  assert.match(EVIDENCE_KIND_AR.weave, /نسيج البرنامج/);
  assert.equal(kindShort('program:x'), 'البرنامج'); assert.equal(kindShort(SK), 'مهارة معتمدة'); assert.equal(kindShort('hand:1'), '✋ يد مرفوعة');
  assert.equal(cohortOf('2025-09-01T00:00:00Z', '2024-01-01'), '2025'); assert.equal(cohortOf(null, '2024-03-02'), '2024'); assert.equal(cohortOf(null, null), null);
});

test('P61 · تحت خمسة: لا خيوط ولا أعداد ولا أدلة — جملة فقط', () => {
  const es = emails(4); const w = programWeave(es.map((e) => row(e, 'program_skill')), roster(es), scope());
  assert.equal(w.below_k, true); assert.equal(w.threads.length, 0); assert.equal(w.weavers_n, 0); assert.equal(w.cohorts.length, 0); assert.equal(w.sources.length, 0);
  assert.match(w.mirror.lines_ar[0], /حين يبلغ منسوبو البرنامج 5/); assert.equal(w.mirror.strongest_ar, null);
  assert.deepEqual(weaveEvidence(w), []); assert.deepEqual(weaveSnapshotLine(w), { weave_ar: null, weave_n: 0 });
  const empty = programWeave([], [], scope()); assert.match(empty.mirror.lines_ar[0], /لا منسوبون/);
  /* عشرة منسوبين لكن 4 ناسجين فقط: المنسوبون فوق الحدّ والناسجون تحته → «خيط لم يبلغ خمسة» بلا عدد */
  const ten = emails(10); const w2 = programWeave(ten.slice(0, 4).map((e) => row(e, 'program_skill')), roster(ten), scope());
  assert.equal(w2.threads.length, 0); assert.equal(w2.weavers_n, 0); assert.match(w2.mirror.belowk_ar!, /لم يبلغ خمسة بعد — لا يُعرض عدده/); assert.doesNotMatch(w2.mirror.belowk_ar!, /4/);
  assert.match(w2.mirror.lines_ar[0], /لم ينسج خمسةٌ/);
});

test('P61 · خمسة فأكثر: الخيوط بالعدد والترتيب · اليدوي لا يُحتسب · خارج النطاق لا يُحتسب · المكرَّر لمتعلّم واحد مرّة', () => {
  const es = emails(8);
  const rows: ThreadRow[] = [
    ...es.map((e) => row(e, 'program_skill')),                                   /* 8 */
    ...es.slice(0, 6).map((e) => row(e, 'hand_session', 'hand:n1', 'session:s1')), /* 6 — الجلسة من نطاق البرنامج */
    ...es.slice(0, 5).map((e) => row(e, 'manual', PK, 'daily:x')),               /* يدوي — لا */
    ...es.slice(0, 7).map((e) => row(e, 'council_badge', 'council:c1', 'badge:b1')), /* خارج النطاق — لا */
    row(es[0], 'program_skill'),                                                   /* تكرار الصفّ نفسه */
    row('stranger@x.sa', 'program_skill'),                                         /* ليس من المنسوبين */
  ];
  const w = programWeave(rows, roster(es), scope());
  assert.equal(w.below_k, false); assert.deepEqual(w.threads.map((t) => [t.rule, t.n]), [['program_skill', 8], ['hand_session', 6]]);
  assert.equal(w.strongest!.rule, 'program_skill'); assert.match(w.mirror.strongest_ar!, /برنامج قاد إلى مهارة معتمدة — نسجه 8 منهم/);
  assert.equal(w.weavers_n, 8); assert.match(w.mirror.weavers_ar!, /8 من 8 متدرّبًا/); assert.equal(w.threads_n, 14);
  assert.deepEqual(w.sources, [{ from: 'البرنامج', to: 'مهارة معتمدة', n: 8 }, { from: '✋ يد مرفوعة', to: 'جلسة', n: 6 }]);
  assert.deepEqual(w.threads[0].codes, ['3.2', '1.6']);
  const json = JSON.stringify(w); for (const e of es) assert.equal(json.includes(e), false, 'لا بريد في النسيج'); assert.equal(json.includes('stranger'), false); assert.equal(json.includes('lأن'), false);
});

test('P61 · الخرّيجون: خيط قُرّر بعد انتهاء البرنامج (أيّ قاعدة غير يدوية) · بلا تاريخ انتهاء لا خرّيجون', () => {
  const es = emails(9);
  const rows: ThreadRow[] = [...es.map((e) => row(e, 'program_skill', PK, SK, D(50))), ...es.slice(0, 6).map((e) => row(e, 'skill_credential', SK, 'credential:c1', D(120))), ...es.slice(6, 9).map((e) => row(e, 'manual', SK, 'credential:c2', D(130)))];
  const w = programWeave(rows, roster(es), scope(D(90)));
  assert.equal(w.graduates.n, 6); assert.equal(w.graduates.rules, 1); assert.match(w.mirror.graduates_ar!, /6 خرّيجًا ما زالوا ينسجون/);
  const ev = weaveEvidence(w); const g = ev.find((e) => e.id === 'weave:graduates')!; assert.deepEqual(g.codes, ['3.5']); assert.equal(g.n, 6); assert.equal(g.href, '#weave');
  const w0 = programWeave(rows, roster(es), scope(null)); assert.equal(w0.graduates.n, 0); assert.equal(w0.mirror.graduates_ar, null);
  /* 4 خرّيجين فقط → صفر */
  const w4 = programWeave([...es.map((e) => row(e, 'program_skill', PK, SK, D(50))), ...es.slice(0, 4).map((e) => row(e, 'skill_credential', SK, 'credential:c1', D(120)))], roster(es), scope(D(90)));
  assert.equal(w4.graduates.n, 0);
});

test('P61 · عبر الدفعات: نسبة الناسجين لكل سنة قبول · دفعة تحت خمسة لا تظهر · ناسجون تحت خمسة = «تحت»', () => {
  const a = emails(10, 'a'), b = emails(6, 'b'), c = emails(3, 'c');
  const ro = [...roster(a, '2025'), ...roster(b, '2026'), ...roster(c, '2024')];
  const rows = [...a.slice(0, 8).map((e) => row(e, 'program_skill')), ...b.slice(0, 3).map((e) => row(e, 'program_skill')), ...c.map((e) => row(e, 'program_skill'))];
  const w = programWeave(rows, ro, scope());
  assert.deepEqual(w.cohorts, [{ label_ar: 'دفعة 2026', roster: 6, weavers: 0, share: 0 }, { label_ar: 'دفعة 2025', roster: 10, weavers: 8, share: 80 }]);
  assert.equal(w.roster_n, 19); assert.equal(w.weavers_n, 14);
});

test('P61 · أدلة الاعتماد: تدخل التغطية تحت معاييرها · لا دليل تحت خمسة · النسخة المختومة تحمل سطر النسيج', () => {
  const es = emails(7); const rows = [...es.map((e) => row(e, 'program_skill')), ...es.slice(0, 5).map((e) => row(e, 'hand_session', 'hand:n1', 'session:s1')), ...es.slice(0, 4).map((e) => row(e, 'placement_program', 'placement:x', PK))];
  const w = programWeave(rows, roster(es), scope(D(200))); const ev = weaveEvidence(w);
  assert.deepEqual(ev.map((e) => e.id), ['weave:program_skill', 'weave:hand_session']); assert.match(ev[0].label_ar, /7 من متدرّبي البرنامج نسجوا بأيديهم/); assert.equal(ev.every((e) => e.kind === 'weave' && e.href === '#weave' && e.at === null), true);
  const cov = coverageOf(DEFAULT_STANDARDS, ev, new Set()); const sub = (code: string) => cov.flatMap((c) => c.subs).find((s) => s.code === code)!;
  assert.equal(sub('3.2').n, 1); assert.equal(sub('3.4').state, 'met'); assert.equal(sub('3.1').n, 1); assert.equal(sub('3.3').n, 0, 'placement_program تحت خمسة لا يُحتسب');
  const line = weaveSnapshotLine(w); assert.equal(line.weave_n, 7); assert.match(line.weave_ar!, /نسجه 7 منهم/);
  const body: any = snapshotBody({ program_ar: 'x', org_ar: null, program_type: 'diploma', cov, narratives: [], eligibility: [], timeline: [], standards: DEFAULT_STANDARDS, skill_map_coverage: { n: 0, total: 10 }, frozen_at: D(1), note_ar: '', ...line });
  assert.equal(body.weave_n, 7); assert.match(body.weave_ar, /أقوى خيط/);
  const body0: any = snapshotBody({ program_ar: 'x', org_ar: null, program_type: 'diploma', cov, narratives: [], eligibility: [], timeline: [], standards: DEFAULT_STANDARDS, skill_map_coverage: { n: 0, total: 10 }, frozen_at: D(1), note_ar: '' }); assert.equal(body0.weave_ar, null); assert.equal(body0.weave_n, 0);
});

test('P61 · الشفافية للمتعلّم: «جزء من نسيج برنامج …» على الخيط الذي يمسّ برنامجًا فقط · k ≥ 5 · بلا أسماء', () => {
  const mine = [{ from: PK, to: SK }, { from: 'session:s1', to: 'daily:d1' }, { from: SK, to: 'credential:c1' }];
  const p = programPeersOf(mine, { [PK]: 12 }, { [PK]: 'دبلوم التدريس' });
  assert.deepEqual(Object.keys(p), [`${PK}>${SK}`]); assert.equal(p[`${PK}>${SK}`].n, 12); assert.match(programPeersLine(p[`${PK}>${SK}`]), /نسيج برنامج «دبلوم التدريس» — نسجه معك 12 من متدرّبيه، بلا أسماء/);
  assert.deepEqual(programPeersOf(mine, { [PK]: 4 }, {}), {});
});

/* قاعدة بيانات وهمية صغيرة: from(table) → سلسلة select/eq/in/limit → {data} */
function fakeDb(tables: Record<string, any[]>) {
  const q = (table: string) => { let rows = [...(tables[table] || [])]; const api: any = { select: () => api, order: () => api, limit: () => api, maybeSingle: () => Promise.resolve({ data: rows[0] || null, error: null }), eq: (c: string, v: any) => { rows = rows.filter((r) => String(r[c]) === String(v)); return api; }, in: (c: string, vs: any[]) => { const s = new Set(vs.map(String)); rows = rows.filter((r) => s.has(String(r[c]))); return api; }, then: (res: any, rej: any) => Promise.resolve({ data: rows, error: null }).then(res, rej) }; return api; };
  return { from: q };
}
test('P61 · الخادم: المنسوبون من التسجيلات (مكرَّر البريد مرّة) · النطاق من الجلسات والمهامّ · الذاكرة 10 دقائق · fresh يتجاوزها', async () => {
  const es = emails(6); forgetProgramWeave();
  const db = fakeDb({
    portal_enrollments: [...es.map((email, i) => ({ email, program_id: PID, status: i % 2 ? 'approved' : 'placed', placed_at: null, created_at: '2026-02-01' })), { email: es[0].toUpperCase(), program_id: PID, status: 'approved', created_at: '2026-02-01' }, { email: 'rej@x.sa', program_id: PID, status: 'rejected', created_at: '2026-02-01' }],
    attendance_sessions: [{ id: 'as1', program_id: PID }], portal_sessions: [{ id: 'ps1', program_id: PID }], portal_missions: [{ id: 'm1', program_id: PID }],
    portal_map_threads: [...es.map((email) => ({ email, from_key: 'hand:n', to_key: 'session:ps1', rule: 'hand_session', status: 'kept', decided_at: D(10) })), ...es.map((email) => ({ email, from_key: 'daily:d', to_key: 'mission:m1', rule: 'daily_mission', status: 'declined', decided_at: D(10) })), ...es.slice(0, 5).map((email) => ({ email, from_key: 'session:as1', to_key: SK, rule: 'session_skill', status: 'kept', decided_at: D(10) }))],
  });
  const w = await loadProgramWeave(db, { id: PID, name_ar: 'دبلوم', end_date: null }, { now: new Date(D(200)) });
  assert.equal(w.roster_n, 6); assert.deepEqual(w.threads.map((t) => [t.rule, t.n]), [['hand_session', 6], ['session_skill', 5]]); assert.deepEqual(w.cohorts, [{ label_ar: 'دفعة 2026', roster: 6, weavers: 6, share: 100 }]);
  /* الذاكرة: تغيير الجدول لا يظهر خلال 10 دقائق، ويظهر مع fresh */
  db.from = fakeDb({ portal_enrollments: [], portal_map_threads: [] }).from as any;
  const cached = await loadProgramWeave(db, { id: PID }, { now: new Date(new Date(D(200)).getTime() + 5 * 60000) }); assert.equal(cached.roster_n, 6);
  const fresh = await loadProgramWeave(db, { id: PID }, { now: new Date(D(200)), fresh: true }); assert.equal(fresh.roster_n, 0);
});
test('P61 · الخادم: أعداد ناسجي البرنامج للمتعلّم تستثنيه هو وتُفرز بالمفتاح', async () => {
  const others = emails(7, 'o');
  const db = fakeDb({ portal_map_threads: [...others.map((email) => ({ email, from_key: PK, to_key: SK, status: 'kept' })), { email: 'me@x.sa', from_key: PK, to_key: SK, status: 'kept' }, { email: 'o0@upm.edu.sa', from_key: 'placement:p', to_key: PK, status: 'kept' }, { email: 'o9@upm.edu.sa', from_key: PK, to_key: SK, status: 'declined' }] });
  const p = await programPeersForLearner(db, 'ME@x.sa', [{ from: PK, to: SK }], { [PK]: 'دبلوم' });
  assert.equal(p[`${PK}>${SK}`].n, 7); assert.equal(p[`${PK}>${SK}`].program_ar, 'دبلوم');
  assert.deepEqual(await programPeersForLearner(db, 'me@x.sa', [{ from: 'session:s', to: SK }], {}), {});
});

test('P61 · «نادِ»: نسيج البرنامج → ملف الاعتماد #weave', () => {
  assert.equal(parseCommand('نسيج البرنامج').href, '/me/accreditation#weave'); assert.equal(parseCommand('جديلة البرنامج').href, '/me/accreditation#weave'); assert.equal(parseCommand('نسيج شعبتي').href, '/me/day/weave');
});

test('P61 · شكل المصدر: الملف يقرأ النسيج داخل collectEvidence ويختمه ويعرضه · الواجهة تحمل اللوحة والجديلة وسطر التحقّق والمتعلّم', () => {
  const load = readFileSync(new URL('../lib/accreditation/load.ts', import.meta.url), 'utf8');
  assert.match(load, /loadProgramWeave\(db, \{ id: pid/); assert.match(load, /weaveEvidence\(weave\)/); assert.match(load, /\.\.\.weaveSnapshotLine\(f\.weave\)/); assert.match(load, /weave_ar: s\.body\?\.weave_ar/); assert.match(load, /last_weave_n/);
  const ui = readFileSync(new URL('../app/components/Accreditation.tsx', import.meta.url), 'utf8');
  for (const id of ['ac-weave', 'ac-weave-mirror', 'ac-weave-threads', 'ac-weave-braid', 'ac-weave-cohorts', 'ac-weave-belowk', 'ac-weave-regress', 'ac-verify-weave', 'ac-strip-weave', 'ac-admin-weave']) assert.ok(ui.includes(`data-testid="${id}"`), id);
  assert.doesNotMatch(ui, /note_ar[^\n]*ac-weave/, 'لا اقتباس في لوحة النسيج');
  const desk = readFileSync(new URL('../app/me/athar-map/AtharMapDesk.tsx', import.meta.url), 'utf8'); assert.match(desk, /data-testid="am-program-peers"/); assert.match(desk, /programPeersLine/);
  const route = readFileSync(new URL('../app/api/me/map/route.ts', import.meta.url), 'utf8'); assert.equal((route.match(/program_peers/g) || []).length >= 4, true);
  const vault = readFileSync(new URL('../lib/vault/registry.ts', import.meta.url), 'utf8'); assert.match(vault, /P61: عدد خيوطك/);
});
