// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م9 «أدلة مِعيار» — الحقائق → أدلة (k ≥ 5 · أحكام نهائية · ترقية موقَّعة) · الملخّص · الغراء على قاعدة وهمية · بوابة الجهة (الوحدات والجلسات والأثر) · جاهزية سلّة الخبير · التسجيل في الملف */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE_KIND_AR, EVIDENCE_RULES, K_MIN, coverageOf, DEFAULT_STANDARDS } from '../lib/accreditation/registry';
import type { Evidence } from '../lib/accreditation/registry';
import { MIAAR_EVIDENCE_TITLE, MIAAR_CODES, EMPTY_FACTS, miaarEvidence, miaarSummary, collectMiaarEvidence } from '../lib/accreditation/miaar';
import type { MiaarFacts } from '../lib/accreditation/miaar';
import { clientUnitsView } from '../lib/miaar/service';
import { beforeAfterRows, sessionsWithEffect } from '../lib/miaar/remedial';
import { expertReadiness, cellKey } from '../lib/miaar/blueprint';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const facts = (over: Partial<MiaarFacts> = {}): MiaarFacts => ({
  ...EMPTY_FACTS,
  invites: [{ id: 'inv1', label: 'A-101', level: 'A1', finals: 12, passed: 9, promoted: 7, avg: 71, last_at: '2026-11-04T08:00:00Z', weak_units: 2 }],
  retakes: { n: 6, passed_after: 4, last_at: '2026-11-05T08:00:00Z' },
  sessions: [{ id: 's1', title_ar: 'جلسة تعويض', starts_at: '2026-11-08T07:00:00Z', duration_min: 60, units: ['A1-U04'], joined: 9, status: 'scheduled' }],
  effects: [{ session_id: 's1', title_ar: 'A1-U04', effect: { code: 'A1-U04', attended: { n: 5, delta: 18 }, others: { n: 2, delta: 3 }, n_retakes: 7 } }],
  linked_units: { program_units: 3, level_units: 7 },
  ...over,
});

test('م9: الأسماء والأنواع — خمسة أنواع جديدة بتسميات عربية · خرائط المعايير الفرعية · مهام 2.2/2.5/3.3 تذكر مِعيار', () => {
  assert.equal(MIAAR_EVIDENCE_TITLE.ar, 'أدلة مِعيار');
  for (const k of ['miaar_exit', 'miaar_units', 'miaar_remedial', 'miaar_effect', 'miaar_retake'] as const) { assert.ok(EVIDENCE_KIND_AR[k], k); assert.match(EVIDENCE_KIND_AR[k], /مِعيار/); }
  assert.deepEqual([...MIAAR_CODES.exit], ['2.5']); assert.deepEqual([...MIAAR_CODES.units], ['1.4', '1.6']); assert.deepEqual([...MIAAR_CODES.retake], ['3.3', '3.1']);
  assert.match(EVIDENCE_RULES['2.5'].task_ar, /مِعيار/); assert.match(EVIDENCE_RULES['2.2'].task_ar, /تعويض/); assert.match(EVIDENCE_RULES['3.3'].task_ar, /عُبور/);
  assert.equal(K_MIN, 5);
});

test('م9: miaarEvidence — الحقائق الكاملة تُنتج 5 أدلة بمعرّفات ثابتة وروابط تحقّق وتواريخ', () => {
  const ev = miaarEvidence(facts());
  assert.deepEqual(ev.map((e) => e.kind), ['miaar_exit', 'miaar_units', 'miaar_remedial', 'miaar_effect', 'miaar_retake']);
  const exit = ev[0]; assert.equal(exit.id, 'miaar_exit:inv1'); assert.deepEqual(exit.codes, ['2.5', '3.3']); assert.equal(exit.n, 12); assert.equal(exit.at, '2026-11-04'); assert.equal(exit.href, '/admin/miaar/exit?invite=inv1');
  assert.match(exit.label_ar, /A1 — A-101: 12 متعلّمًا بحكم نهائي · 9 اجتازوا · 7 رُقّوا بتوقيع · متوسط 71% · 2 وحدة حمراء/);
  assert.match(ev[1].label_ar, /3 وحدة برنامجية مربوطة بـ7 وحدة مستوى/); assert.equal(ev[1].href, '/me/reports#diploma');
  assert.match(ev[2].label_ar, /A1-U04/); assert.match(ev[2].label_ar, /انضمّ 9/); assert.equal(ev[2].at, '2026-11-08');
  assert.match(ev[3].label_ar, /أثر التعويض — A1-U04: الحاضرون \+18 نقطة \(5\)/);
  assert.match(ev[4].label_ar, /6 إعادة · 4 أفضت إلى اجتياز/); assert.equal(ev[4].at, '2026-11-05');
  for (const e of ev) { assert.ok(!/@/.test(e.label_ar), 'لا بريد'); assert.ok(e.label_ar.length < 220); }
});

test('م9: الخصوصية — k ≥ 5: دعوة بأربعة أحكام لا تظهر · أثر بأربع إعادات لا يظهر · خمس إعادات تظهر · جلسة انضمّ لها 3 تظهر بلا عدد · ترقية = 0 تُسقط 3.3', () => {
  const ev = miaarEvidence(facts({ invites: [{ id: 'x', label: 'B', level: 'A2', finals: 4, passed: 4, promoted: 0, avg: 80, last_at: null, weak_units: 0 }], retakes: { n: 4, passed_after: 4, last_at: null }, effects: [{ session_id: 's1', title_ar: 'u', effect: { code: 'A1-U04', attended: { n: 2, delta: 10 }, others: { n: 2, delta: 0 }, n_retakes: 4 } }], sessions: [{ id: 's1', title_ar: 't', starts_at: '2026-11-08T07:00:00Z', duration_min: 45, units: ['A1-U04'], joined: 3, status: 'scheduled' }] }));
  assert.deepEqual(ev.map((e) => e.kind), ['miaar_units', 'miaar_remedial']); assert.ok(!/انضمّ/.test(ev[1].label_ar), 'عدد المنضمّين يُخفى دون 5');
  const ev2 = miaarEvidence(facts({ invites: [{ id: 'y', label: 'C', level: 'B1', finals: 5, passed: 2, promoted: 0, avg: null, last_at: '2026-11-01', weak_units: 0 }], retakes: { n: 5, passed_after: 0, last_at: null } }));
  assert.deepEqual(ev2.find((e) => e.kind === 'miaar_exit')!.codes, ['2.5'], 'بلا ترقية موقَّعة لا يُحتسب 3.3'); assert.ok(ev2.some((e) => e.kind === 'miaar_retake'));
  const ev3 = miaarEvidence(facts({ sessions: [{ id: 'c', title_ar: 'x', starts_at: '2026-11-08T07:00:00Z', duration_min: 60, units: [], joined: 0, status: 'cancelled' }], effects: [{ session_id: 's1', title_ar: 'u', effect: { code: 'A1-U04', attended: { n: 0, delta: null }, others: { n: 5, delta: 2 }, n_retakes: 5 } }] }));
  assert.ok(!ev3.some((e) => e.kind === 'miaar_remedial'), 'الملغاة لا تُحتسب'); assert.ok(!ev3.some((e) => e.kind === 'miaar_effect'), 'أثر بلا حاضرين لا يُحتسب');
  assert.deepEqual(miaarEvidence(EMPTY_FACTS), []);
});

test('م9: التغطية — أدلة مِعيار تُحتسب في 2.5 و3.3 و1.4 و2.2 عبر coverageOf · ملخّص الجهة', () => {
  const ev: Evidence[] = miaarEvidence(facts());
  const cov = coverageOf(DEFAULT_STANDARDS as any, ev, new Set());
  const sub = (c: string) => cov.flatMap((s) => s.subs).find((x) => x.code === c)!;
  assert.ok(sub('2.5').n >= 2, '2.5: نهاية المستوى + الأثر'); assert.ok(sub('3.3').n >= 2, '3.3: ترقية + إعادة'); assert.ok(sub('1.4').n >= 1); assert.ok(sub('2.2').n >= 1); assert.equal(sub('4.1').n, 0);
  assert.deepEqual(miaarSummary(facts()), { exits: 1, finals: 12, promoted: 7, sessions: 1, retakes: 6, avg_effect: 18 });
  assert.deepEqual(miaarSummary(EMPTY_FACTS), { exits: 0, finals: 0, promoted: 0, sessions: 0, retakes: 0, avg_effect: null });
  assert.deepEqual(miaarSummary(facts({ invites: [{ id: 'q', label: 'D', level: 'A1', finals: 4, passed: 4, promoted: 4, avg: 90, last_at: null, weak_units: 0 }] })).exits, 0, 'الملخّص يتبع قاعدة k ≥ 5 أيضًا');
});

/* قاعدة وهمية مشتركة */
function fakeDb(tables: Record<string, any[]>) {
  const q = (rows: any[]) => { const st: Array<(r: any) => boolean> = []; const self: any = {
    select: () => self, order: () => self, limit: () => self, maybeSingle: () => Promise.resolve({ data: rows.filter((r) => st.every((f) => f(r)))[0] || null, error: null }),
    eq: (k: string, v: any) => { st.push((r) => r[k] === v); return self; }, neq: (k: string, v: any) => { st.push((r) => r[k] !== v); return self; }, in: (k: string, vs: any[]) => { st.push((r) => vs.includes(r[k])); return self; },
    not: () => self, then: (res: any) => res({ data: rows.filter((r) => st.every((f) => f(r))), error: null }) }; return self; };
  return { from: (t: string) => q(tables[t] || []) };
}
const exitRep = (id: string, invite_id: string, email: string, outcome: string, total: number, extra: Record<string, any> = {}, units: any = { 'A1-U04': { n: 4, correct: 1 }, 'A1-U02': { n: 4, correct: 4 } }) => ({ id, invite_id, candidate_email: email, created_at: `2026-11-0${id.length % 9 || 1}T08:00:00Z`, report: { الوحدات: units, exit: { الحالة: 'final', النتيجة: outcome, الكلي: total, وحدات_للمراجعة: [{ الرمز: 'A1-U04', النسبة: 25 }], ...extra } } });

test('م9: collectMiaarEvidence — يجمع الدعوات بالبرنامج أو بقاعاته بلا تكرار · الأحكام النهائية فقط · الترقية الموقَّعة · الإعادات · جلسة التعويض وأثرها · ربط الوحدات', async () => {
  const reports = ['a', 'b', 'c', 'd', 'e', 'f'].map((x, i) => exitRep(`r${x}`, 'inv1', `${x}@x.com`, i < 4 ? 'passed' : 'conditional', 60 + i, i < 3 ? { قرار_العبور: { إلى: 'A2', في: '2026-11-04', بواسطة: 'u1' } } : {}));
  reports.push({ id: 'rp', invite_id: 'inv1', candidate_email: 'p@x.com', created_at: '2026-11-05T09:00:00Z', report: { exit: { الحالة: 'pending', النتيجة: 'pending', الكلي: null } } } as any);
  (reports[0].report.exit as any).الإعادة = { المهارة: 'reading' };
  const retakes = ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: `rt${i}`, retake_of: `r${x}`, purpose: 'exit', created_at: '2026-11-06T08:00:00Z' }));
  const retakeReports = retakes.slice(0, 5).map((t, i) => ({ id: `rr${i}`, invite_id: t.id, candidate_email: `${'abcde'[i]}@x.com`, created_at: '2026-11-07T08:00:00Z', report: { الوحدات: { 'A1-U04': { n: 4, correct: i < 3 ? 4 : 1 } } } }));
  const db = fakeDb({
    placement_invites: [{ id: 'inv1', code: 'EX1', label_ar: 'عبور A1', classroom_id: 'c1', program_id: 'p1', purpose: 'level_exit', level_target: 'A1', created_at: '2026-11-01' }, { id: 'inv2', code: 'EX2', label_ar: 'عبور A1 ب', classroom_id: 'c9', program_id: null, purpose: 'level_exit', level_target: 'A1', created_at: '2026-11-01' }, { id: 'pl', code: 'PL', purpose: 'placement', program_id: 'p1' }, ...retakes],
    placement_reports: [...reports, ...retakeReports],
    classrooms: [{ id: 'c1', code: 'A-101', name: 'الشعبة الأولى' }],
    portal_sessions: [{ id: 's1', title_ar: 'جلسة تعويض — A1-U04', starts_at: '2026-11-06T07:00:00Z', duration_min: 60, status: 'scheduled', kind: 'remedial', miaar_unit_codes: ['A1-U04'], source_invite_id: 'inv1' }, { id: 's2', title_ar: 'ملغاة', starts_at: '2026-11-06T07:00:00Z', duration_min: 60, status: 'cancelled', kind: 'remedial', miaar_unit_codes: ['A1-U02'], source_invite_id: 'inv1' }],
    portal_learning_events: ['a', 'b', 'c', 'd', 'e'].map((x) => ({ verb: 'joined', object_type: 'session', object_id: 's1', email: `${x}@x.com` })),
  });
  const { evidence, facts: f } = await collectMiaarEvidence(db, 'p1', ['c1'], [{ miaar_unit_codes: ['A1-U01', 'A1-U04'] }, { miaar_unit_codes: [] }, { miaar_unit_codes: ['A1-U04', 'A1-U05'] }]);
  assert.equal(f.invites.length, 1, 'inv2 لقاعة خارج البرنامج · PL ليست عبورًا'); const i1 = f.invites[0];
  assert.equal(i1.label, 'A-101'); assert.equal(i1.finals, 6, 'المعلّق لا يُحتسب'); assert.equal(i1.passed, 4); assert.equal(i1.promoted, 3); assert.equal(i1.avg, 63); assert.equal(i1.weak_units, 1);
  assert.deepEqual(f.retakes, { n: 5, passed_after: 1, last_at: '2026-11-06T08:00:00Z' });
  assert.equal(f.sessions.length, 1); assert.equal(f.sessions[0].joined, 5);
  assert.equal(f.effects.length, 1); assert.equal(f.effects[0].effect.n_retakes, 5); assert.equal(f.effects[0].effect.attended.n, 5);
  assert.deepEqual(f.linked_units, { program_units: 2, level_units: 3 });
  assert.deepEqual(evidence.map((e) => e.kind), ['miaar_exit', 'miaar_units', 'miaar_remedial', 'miaar_effect', 'miaar_retake']);
  assert.deepEqual(evidence[0].codes, ['2.5', '3.3']);
  /* بلا دعوات: ربط الوحدات وحده */
  const empty = await collectMiaarEvidence(fakeDb({}), 'p2', [], [{ miaar_unit_codes: ['A1-U01'] }]); assert.deepEqual(empty.evidence.map((e) => e.kind), ['miaar_units']);
  /* فشل الجدول = لا شيء */
  const broken = { from: () => { throw new Error('x'); } }; const none = await collectMiaarEvidence(broken, 'p1', ['c1'], []); assert.deepEqual(none.evidence, []);
});

test('م9: beforeAfterRows و sessionsWithEffect — «بعد» = آخر إعادة · بلا إعادات = null · الجلسات مع joined وeffect مُعنوَن', async () => {
  const db = fakeDb({
    placement_reports: [exitRep('r1', 'inv1', 'A@x.com', 'conditional', 61), exitRep('r2', 'inv1', 'b@x.com', 'passed', 80), { id: 'rr1', invite_id: 'rt1', candidate_email: 'a@x.com', created_at: '2026-11-07T08:00:00Z', report: { الوحدات: { 'A1-U04': { n: 4, correct: 2 } } } }, { id: 'rr2', invite_id: 'rt2', candidate_email: 'a@x.com', created_at: '2026-11-09T08:00:00Z', report: { الوحدات: { 'A1-U04': { n: 4, correct: 4 } } } }],
    placement_invites: [{ id: 'rt1', retake_of: 'r1', created_at: '2026-11-06' }, { id: 'rt2', retake_of: 'r1', created_at: '2026-11-08' }],
    portal_sessions: [{ id: 's1', title_ar: 'ج', starts_at: '2026-11-06T07:00:00Z', duration_min: 60, status: 'scheduled', kind: 'remedial', miaar_unit_codes: ['A1-U04'], source_invite_id: 'inv1' }],
    portal_learning_events: [{ verb: 'joined', object_type: 'session', object_id: 's1', email: 'a@x.com' }],
  });
  const rows = await beforeAfterRows(db, 'inv1'); assert.equal(rows.length, 2);
  const a = rows.find((r) => r.email === 'a@x.com')!; assert.deepEqual(a.after, { 'A1-U04': { n: 4, correct: 4 } }, 'آخر إعادة'); assert.equal(rows.find((r) => r.email === 'b@x.com')!.after, null);
  const s = await sessionsWithEffect(db, 'inv1', new Map([['A1-U04', 'الأسرة']])); assert.equal(s.length, 1); assert.equal(s[0].joined, 1); assert.equal(s[0].effect[0].title_ar, 'الأسرة'); assert.equal(s[0].effect[0].attended.delta, 75); assert.match(s[0].effect[0].text, /الأسرة: الحاضرون \+75/);
  assert.deepEqual(await beforeAfterRows(fakeDb({}), 'none'), []);
});

test('م9: بوابة الجهة — clientUnitsView: حرارة بلا أسماء · أضعف 3 · نطاق «ما دُرّس فقط» · الجلسات الملغاة تُستبعد · متوسط الأثر · نصّ التوضيح', () => {
  const heat = [{ code: 'A1-U04', title_ar: 'الأسرة', percent: 25, state: 'weak', state_ar: 'ضعيفة', n_students: 12 }, { code: 'A1-U02', title_ar: 'التحية', percent: 90, state: 'ok', state_ar: 'جيدة', n_students: 12 }, { code: 'A1-U01', title_ar: 'أ', percent: 40, state: 'weak', state_ar: 'ضعيفة', n_students: 12 }, { code: 'A1-U03', title_ar: 'ب', percent: 45, state: 'weak', state_ar: 'ضعيفة', n_students: 12 }, { code: 'A1-U05', title_ar: 'ج', percent: 48, state: 'weak', state_ar: 'ضعيفة', n_students: 12 }];
  const sessions = [{ id: 's1', title_ar: 'ج1', starts_at: '2026-11-06T07:00:00Z', duration_min: 60, provider: 'teams', status: 'scheduled', miaar_unit_codes: ['A1-U04'], joined: 7, effect: [{ code: 'A1-U04', title_ar: 'الأسرة', n_retakes: 6, attended: { n: 4, delta: 20 }, others: { n: 2, delta: 2 }, text: 'الأسرة: الحاضرون +20 نقطة (4) · غير الحاضرين +2 نقطة (2).' }] }, { id: 's2', status: 'cancelled', miaar_unit_codes: [], effect: [{ code: 'x', attended: { n: 1, delta: -50 }, others: { n: 0, delta: null }, n_retakes: 1 }] }];
  const v = clientUnitsView(heat, sessions, ['A1-U01', 'A1-U02']);
  assert.equal(v.units.length, 5); assert.deepEqual(v.weak.map((u) => u.code), ['A1-U04', 'A1-U01', 'A1-U03']); assert.equal(v.scoped, true); assert.deepEqual(v.scope, ['A1-U01', 'A1-U02']);
  assert.equal(v.sessions.length, 1); assert.equal(v.sessions[0].joined, 7); assert.equal(v.effect_avg, 20); assert.match(v.note_ar, /بلا أسماء/); assert.match(v.note_ar, /لا تظهر على الشهادة/);
  assert.ok(!JSON.stringify(v).includes('@'));
  const e = clientUnitsView([], [], null); assert.deepEqual(e.units, []); assert.equal(e.scoped, false); assert.equal(e.effect_avg, null);
});

test('م9: سلّة الخبير — expertReadiness: كل خلية مطلوبة لها سلّة ≥ العدد · خلية ناقصة = غير جاهز · لا خلايا = غير جاهز', () => {
  const counts: any = { A1: { listening: 2, reading: 3, grammar_vocab: 0 } };
  const pool: Record<string, string[]> = { [cellKey('A1', 'listening')]: ['a', 'b'], [cellKey('A1', 'reading')]: ['c', 'd', 'e'] };
  assert.deepEqual(expertReadiness({ levels: ['A1'] as any, counts, pool, draw: 'random' }), { ready: true, cells_ok: 2, cells_total: 2, mode: 'random' });
  assert.deepEqual(expertReadiness({ levels: ['A1'] as any, counts, pool: { ...pool, [cellKey('A1', 'reading')]: ['c'] }, draw: 'expert_pool' }), { ready: false, cells_ok: 1, cells_total: 2, mode: 'expert_pool' });
  assert.equal(expertReadiness({ levels: ['A1'] as any, counts: { A1: { listening: 0, reading: 0, grammar_vocab: 0 } } as any, pool: {}, draw: 'random' }).ready, false);
});

test('م9: السلك — ملف الاعتماد يستدعي أدلة مِعيار · التجميع المؤسسي يحمل سطر مِعيار · بوابة الجهة تُرجع units وتصدّر أعمدة الوحدات · البطاقات تحمل الشارات · لا تبعيات جديدة', () => {
  const load = read('lib/accreditation/load.ts'); assert.match(load, /collectMiaarEvidence\(db, pid, rooms\.map/); assert.match(load, /miaar: miaarSummary\(miaar\.facts\)/); assert.match(load, /return \{ miaar, programs: files\.length/);
  const svc = read('lib/miaar/service.ts'); assert.match(svc, /sessionsWithEffect/); assert.match(svc, /clientReport\(level, b\.rows, bench\), units,/); assert.match(svc, /وحدات_للمراجعة: Array\.isArray/);
  const route = read('app/api/miaar/client/route.ts'); assert.match(route, /'وحدات تحتاج مراجعة'/); assert.match(route, /`وحدة \$\{c\}`/);
  const cb = read('app/miaar/client/ClientBoard.tsx'); for (const t of ['cb-units', 'cb-unit', 'cb-sessions', 'cb-effect', 'cb-row-units']) assert.ok(cb.includes(`data-testid="${t}"`), t); assert.match(cb, /خريطة المنهج — أين ضعفت المجموعة؟/); assert.match(cb, /جلسات التعويض وأثرها/);
  const fb = read('app/admin/miaar/FormBuilder.tsx'); assert.ok(fb.includes('data-testid="fb-expert"')); assert.match(fb, /جاهز للتحويل إلى سلّة الخبير/);
  const forms = read('app/api/admin/miaar/forms/route.ts'); assert.match(forms, /expert_ready: expertReadiness\(plan\)/);
  const bk = read('app/admin/miaar/BankEditor.tsx'); assert.ok(bk.includes('data-testid="bk-units"')); assert.match(read('app/api/admin/miaar/bank/route.ts'), /descriptor_code, unit_codes,/);
  const ac = read('app/components/Accreditation.tsx'); assert.ok(ac.includes('data-testid="ac-org-miaar"')); assert.match(ac, /ترقية موقَّعة/);
  const rem = read('app/api/admin/miaar/remedial/route.ts'); assert.match(rem, /sessionsWithEffect\(db, inviteId, ix\)/); assert.ok(!rem.includes('async function effectRows'), 'نُقلت إلى المكتبة');
  const pkg = JSON.parse(read('package.json')); assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@supabase/ssr', '@supabase/supabase-js', 'next', 'react', 'react-dom'].filter((d) => pkg.dependencies[d]).sort());
  assert.ok(!fs.existsSync(path.join(ROOT, 'supabase/migrations')) || !fs.readdirSync(path.join(ROOT, 'supabase/migrations')).some((f) => /m9/i.test(f)), 'م9 بلا ترحيل');
});
