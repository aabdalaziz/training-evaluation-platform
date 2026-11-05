// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م6-ب «خريطة المنهج — وسم وحدات المستوى» — البذرة · السحب المتوازن · «ما دُرّس فقط» · التغطية · تقرير الوحدات · خريطة الحرارة · العدالة · الاقتراح · التحقّق · الهجرة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEVELS, SKILLS } from '../lib/miaar/registry';
import type { PoolItem } from '../lib/miaar/registry';
import { drawPlan, planFromBlueprint } from '../lib/miaar/blueprint';
import { exitBlueprintRow, EXIT_SPEC, EXIT_LEVELS } from '../lib/miaar/exit';
import {
  UNIT_SEED, UNIT_LEVELS, UNIT_CODE_RE, isUnitCode, unitLevelOf, unitIndex, descriptorUnits, approvedFor, balancedOrder, scopeCell, coverage, tallyUnits, unitReport, reviewUnits, boardHeat, fairness,
  suggestLocal, suggestPrompt, parseSuggestions, SUGGEST_SYSTEM, validateUnit, validateTag, validateScope, unitState, UNIT_STATE_AR, SYLLABUS_TITLE, listUnits, resetUnitsCache, tagItems,
} from '../lib/miaar/syllabus';
import type { Unit } from '../lib/miaar/syllabus';

const ROOT = path.join(__dirname, '..');
const units = (status: Unit['status'] = 'approved'): Unit[] => UNIT_SEED.map((u) => ({ ...u, status }));
const pool = (perCell = 8, tagger?: (level: string, skill: string, i: number) => string[] | undefined): PoolItem[] => {
  const out: PoolItem[] = []; let n = 0;
  for (const level of [...LEVELS, 'PRE_A1'] as const) for (const skill of SKILLS) for (let i = 0; i < perCell; i += 1) { n += 1; const unitCodes = tagger?.(level, skill, i); out.push({ id: `i${n}`, code: `${level}-${skill}-${i}`, level, skill, type: 'mcq', passageId: null, questionText: `س${n}`, options: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }], correctOptionId: 'a', stimulus: null, descriptor: null, ...(unitCodes ? { unitCodes } : {}) } as PoolItem); }
  return out;
};

test('م6-ب: البذرة — 38 وحدة (8×A1–B2 + 6×C1) · رموز صالحة وفريدة · كل واصف A1–C1 الـ60 في وحدة · عناوين عربية/إنجليزية ومجالات CEFR', () => {
  assert.equal(UNIT_SEED.length, 38); assert.deepEqual([...UNIT_LEVELS], ['A1', 'A2', 'B1', 'B2', 'C1']);
  for (const L of UNIT_LEVELS) assert.equal(UNIT_SEED.filter((u) => u.level === L).length, L === 'C1' ? 6 : 8, L);
  const codes = UNIT_SEED.map((u) => u.code); assert.equal(new Set(codes).size, 38); for (const c of codes) { assert.match(c, UNIT_CODE_RE); assert.ok(isUnitCode(c)); }
  assert.equal(unitLevelOf('B2-U07'), 'B2'); assert.equal(unitLevelOf('C2-U01'), null); assert.equal(isUnitCode('A1-U1'), false);
  const descs = new Set(UNIT_SEED.flatMap((u) => u.descriptor_codes)); assert.equal(descs.size, 60);
  for (const m of ['LI', 'RD', 'LU']) for (const L of UNIT_LEVELS) for (let i = 1; i <= 4; i += 1) assert.ok(descs.has(`${m}-${L}-0${i}`), `${m}-${L}-0${i}`);
  for (const u of UNIT_SEED) { assert.ok(u.title_ar.length >= 4 && u.title_en.length >= 4 && u.focus_ar.length >= 10, u.code); assert.ok(u.domains.length >= 1 && u.domains.every((d) => ['personal', 'public', 'professional', 'educational'].includes(d)), u.code); assert.equal(u.code, `${u.level}-U${String(u.idx).padStart(2, '0')}`); }
  const du = descriptorUnits(units()); assert.deepEqual(du.get('LU-A1-01'), ['A1-U01']); assert.equal(unitIndex(units()).get('C1-U05')?.title_ar, 'المعاني الضمنية والتلميح');
  assert.equal(SYLLABUS_TITLE.ar, 'خريطة المنهج — وسم وحدات المستوى'); assert.equal(approvedFor(units('draft'), 'A1').length, 0); assert.equal(approvedFor(units(), 'C1').length, 6);
});

test('م6-ب: balancedOrder — البنود التي تغطّي وحدة غير مغطّاة تتقدّم ثم يبقى الترتيب · المجموعة تُحدَّث · بلا وحدات = بلا تغيير', () => {
  const cell = [{ code: 'a' }, { code: 'b', unitCodes: ['A1-U02'] }, { code: 'c', unitCodes: ['A1-U01', 'A1-U02'] }, { code: 'd', unitCodes: ['A1-U03'] }, { code: 'e' }];
  const un = new Set(['A1-U01', 'A1-U02']); const o = balancedOrder(cell, un).map((x) => x.code);
  assert.deepEqual(o, ['b', 'c', 'a', 'd', 'e']); assert.equal(un.size, 0);
  assert.deepEqual(balancedOrder(cell, new Set()).map((x) => x.code), ['a', 'b', 'c', 'd', 'e']);
  const un2 = new Set(['A1-U09']); assert.deepEqual(balancedOrder(cell, un2).map((x) => x.code), ['a', 'b', 'c', 'd', 'e']); assert.equal(un2.size, 1, 'لم تُغطَّ');
});

test('م6-ب: scopeCell — «ما دُرّس فقط» يحصر البنود في النطاق · إن قلّت عن المطلوب تعود الخلية كاملة مع fallback', () => {
  const cell = [{ code: 'a', unitCodes: ['A1-U01'] }, { code: 'b', unitCodes: ['A1-U02'] }, { code: 'c' }, { code: 'd', unitCodes: ['A1-U01'] }];
  const r = scopeCell(cell, ['A1-U01'], 2); assert.equal(r.narrowed, true); assert.equal(r.fallback, false); assert.deepEqual(r.cell.map((x) => x.code), ['a', 'd']);
  const f = scopeCell(cell, ['A1-U01'], 3); assert.equal(f.fallback, true); assert.equal(f.cell.length, 4);
  const n = scopeCell(cell, null, 2); assert.equal(n.narrowed, false); assert.equal(n.cell.length, 4);
});

test('م6-ب: drawPlan مع وحدات — عدد البنود كما في مواصفة عُبور تمامًا · كل وحدة معتمدة ذات بنود تظهر مرّة على الأقل · بلا وحدات = السحب القديم نفسه (بصمة مطابقة)', () => {
  for (const L of EXIT_LEVELS) {
    const { plan, errors } = planFromBlueprint(exitBlueprintRow(L) as any); assert.deepEqual(errors, []);
    const U = approvedFor(units(), L).map((u) => u.code);
    /* وسم: البند i في كل خلية يخدم الوحدة i mod n — فكل وحدة لها بنود في كل مهارة */
    const P = pool(20, (lv, _sk, i) => (lv === L ? [U[i % U.length]] : undefined));
    const plain = drawPlan(P, 'seed-1', plan)!; const bal = drawPlan(P, 'seed-1', plan, { units: U })!;
    const want = EXIT_SPEC[L].listening + EXIT_SPEC[L].reading + EXIT_SPEC[L].grammar_vocab;
    assert.equal(plain.codes.length, want, `${L}: عدد قديم`); assert.equal(bal.codes.length, want, `${L}: العدد لم يتغيّر`);
    for (const sk of ['listening', 'reading', 'grammar_vocab'] as const) assert.equal(bal.codes.filter((c) => c.includes(`-${sk}-`)).length, plan.counts[L][sk], `${L}/${sk}: عدد الخلية`);
    const byCode = new Map(P.map((i) => [i.code, i])); const covered = new Set(bal.codes.flatMap((c) => byCode.get(c)!.unitCodes || []));
    for (const u of U) assert.ok(covered.has(u), `${L}: الوحدة ${u} ظهرت`);
    assert.deepEqual(bal.units!.missing, []); assert.equal(bal.units!.covered.length, U.length); assert.equal(bal.units!.scoped, false);
    assert.equal(drawPlan(P, 'seed-1', plan)!.codes.join(), plain.codes.join(), 'السحب بلا خيارات حتمي'); assert.equal((drawPlan(P, 'seed-1', plan) as any).units, undefined);
  }
});

test('م6-ب: drawPlan مع «ما دُرّس فقط» — البنود كلّها من وحدات النطاق حين يكفي البنك · وإلا تراجع مُعلَن للخلية وحدها', () => {
  const L = 'A2'; const { plan } = planFromBlueprint(exitBlueprintRow(L) as any);
  const P = pool(20, (lv, _sk, i) => (lv === L ? [i < 15 ? 'A2-U01' : 'A2-U02'] : undefined));
  const only = drawPlan(P, 's', plan, { only: ['A2-U01'] })!; const byCode = new Map(P.map((i) => [i.code, i]));
  assert.equal(only.codes.length, EXIT_SPEC[L].listening + EXIT_SPEC[L].reading + EXIT_SPEC[L].grammar_vocab);
  for (const c of only.codes) assert.deepEqual(byCode.get(c)!.unitCodes, ['A2-U01'], c);
  assert.equal(only.units!.scoped, true); assert.deepEqual(only.units!.fallback, []);
  const short = drawPlan(P, 's', plan, { only: ['A2-U02'] })!;  /* 5 بنود فقط لكل خلية من U02 — كل الخلايا تحتاج أكثر */
  assert.equal(short.codes.length, only.codes.length, 'العدد ثابت رغم التراجع');
  assert.ok(short.units!.fallback.length >= 1, 'تراجع مُعلَن'); for (const f of short.units!.fallback) assert.match(f, /^A2\//);
});

test('م6-ب: coverage — الوحدات المعتمدة فقط · عدد البنود لكل وحدة ومهارة · غير المغطّاة · الموسوم/غير الموسوم', () => {
  const all = units('draft').map((u) => (u.code === 'B1-U01' || u.code === 'B1-U02' ? { ...u, status: 'approved' as const } : u));
  const P = pool(5, (lv, sk, i) => (lv === 'B1' && sk === 'reading' && i < 2 ? ['B1-U01'] : undefined));
  const c = coverage(all, 'B1', P); assert.equal(c.rows.length, 2); assert.deepEqual(c.uncovered, ['B1-U02']);
  const r1 = c.rows.find((r) => r.code === 'B1-U01')!; assert.equal(r1.items, 2); assert.deepEqual(r1.by_skill, { reading: 2 }); assert.equal(r1.covered, true);
  assert.equal(c.total, 15); assert.equal(c.tagged, 2); assert.equal(c.untagged, 13);
});

test('م6-ب: tallyUnits/unitReport/reviewUnits — صواب/عدد لكل وحدة (البند متعدّد الوحدات يُحسب لكلٍّ) · الترتيب من الأضعف · الحالات 50/70 · ≤3 للمراجعة · بلا عيّنة = لا حكم', () => {
  const t = tallyUnits([
    { unitCodes: ['A1-U01'], answered: true, correct: true }, { unitCodes: ['A1-U01'], answered: true, correct: false },
    { unitCodes: ['A1-U02', 'A1-U03'], answered: true, correct: false }, { unitCodes: ['A1-U02'], answered: false, correct: false },
    { unitCodes: ['A1-U04'], answered: true, correct: true }, { unitCodes: ['A1-U04'], answered: true, correct: true }, { unitCodes: ['A1-U04'], answered: true, correct: true },
    { unitCodes: null, answered: true, correct: true },
  ]);
  assert.deepEqual(t, { 'A1-U01': { n: 2, correct: 1 }, 'A1-U02': { n: 2, correct: 0 }, 'A1-U03': { n: 1, correct: 0 }, 'A1-U04': { n: 3, correct: 3 } });
  const rows = unitReport(t, units()); assert.deepEqual(rows.map((r) => r.code), ['A1-U02', 'A1-U03', 'A1-U01', 'A1-U04']);
  assert.equal(rows[0].title_ar, 'الأسماء: المذكّر والمؤنّث والعدد'); assert.equal(rows[0].state, 'weak'); assert.equal(rows[2].percent, 50); assert.equal(rows[2].state, 'watch'); assert.equal(rows[3].state, 'ok');
  assert.equal(unitState(49), 'weak'); assert.equal(unitState(50), 'watch'); assert.equal(unitState(69), 'watch'); assert.equal(unitState(70), 'ok'); assert.equal(UNIT_STATE_AR.weak, 'تحتاج مراجعة');
  assert.deepEqual(reviewUnits(rows).map((r) => r.code), ['A1-U02', 'A1-U03', 'A1-U01']); assert.deepEqual(reviewUnits(rows, 2).map((r) => r.code), ['A1-U02', 'A1-U03']);
  assert.deepEqual(unitReport(null, units()), []); assert.deepEqual(unitReport({ 'A1-U05': { n: 0, correct: 0 } }, units()), []);
  assert.equal(unitReport({ 'A1-U99': { n: 1, correct: 1 } }, units())[0].title_ar, 'A1-U99', 'وحدة مجهولة تُعرض برمزها');
  assert.deepEqual(unitReport({ 'A1-U01': { n: 2, correct: 1 } }, units('draft')), [], 'وحدة مسوَّدة لا تظهر في التقرير');
});

test('م6-ب: boardHeat/fairness — تجميع الشعبة من الأضعف · عدد المتعلّمين · الوحدة الضعيفة في شعبتين فأكثر (≥3 متعلّمين) = مشكلة منهج', () => {
  const s1 = { 'A1-U01': { n: 2, correct: 0 }, 'A1-U02': { n: 2, correct: 2 } }; const s2 = { 'A1-U01': { n: 2, correct: 1 }, 'A1-U02': { n: 2, correct: 2 } }; const s3 = { 'A1-U01': { n: 2, correct: 0 } };
  const heat = boardHeat([s1, s2, s3, null], units()); assert.deepEqual(heat.map((h) => h.code), ['A1-U01', 'A1-U02']);
  assert.equal(heat[0].percent, 17); assert.equal(heat[0].n_students, 3); assert.equal(heat[0].n_items, 6); assert.equal(heat[0].state, 'weak'); assert.equal(heat[1].n_students, 2); assert.equal(heat[1].state, 'ok');
  const other = boardHeat([s1, s1, s3], units()); const fine = boardHeat([s2, s2, s2], units());
  const f = fairness([{ key: 'a', label: 'شعبة أ', heat }, { key: 'b', label: 'شعبة ب', heat: other }, { key: 'c', label: 'شعبة ج', heat: fine }]);
  assert.equal(f.length, 1); assert.equal(f[0].code, 'A1-U01'); assert.equal(f[0].groups, 2); assert.equal(f[0].of, 3); assert.deepEqual(f[0].labels, ['شعبة أ', 'شعبة ب']);
  assert.deepEqual(fairness([{ key: 'a', label: 'أ', heat }]), [], 'شعبة واحدة لا عدالة');
  const few = boardHeat([s1, s3], units()); assert.deepEqual(fairness([{ key: 'a', label: 'أ', heat: few }, { key: 'b', label: 'ب', heat: few }]), [], 'أقل من 3 متعلّمين لا يُحتسب');
});

test('م6-ب: الاقتراح — المحلي من الواصف دقيق · الموجّه يحمل الوحدات والبنود · parseSuggestions يرفض الرموز والبنود الغريبة والتكرار', () => {
  const U = units(); const items = [
    { id: '11111111-1111-4111-8111-111111111111', code: 'A1-GV-001', level: 'A1', skill: 'grammar_vocab', descriptor_code: 'LU-A1-02', domain: 'public', text: 'الكتاب ___ الطاولة' },
    { id: '22222222-2222-4222-8222-222222222222', code: 'A1-RD-001', level: 'A1', skill: 'reading', descriptor_code: null, domain: 'public', text: 'لافتة: ممنوع التدخين' },
  ];
  const loc = suggestLocal(items, U); assert.equal(loc.length, 1); assert.equal(loc[0].unit_code, 'A1-U04'); assert.equal(loc[0].source, 'descriptor'); assert.match(loc[0].why, /LU-A1-02/);
  const prompt = suggestPrompt('A1', U, items); assert.match(prompt, /A1-U05 — لافتات وإشارات/); assert.match(prompt, /A1-RD-001|22222222/); assert.ok(!prompt.includes('B1-U01')); assert.match(SUGGEST_SYSTEM, /JSON/);
  const raw = 'إليك: [{"item_id":"22222222-2222-4222-8222-222222222222","unit_code":"A1-U05","why":"لافتة"},{"item_id":"22222222-2222-4222-8222-222222222222","unit_code":"A1-U06","why":"مكرر"},{"item_id":"x","unit_code":"A1-U01"},{"item_id":"11111111-1111-4111-8111-111111111111","unit_code":"Z9-U01"}]';
  const p = parseSuggestions(raw, items, U)!; assert.equal(p.length, 1); assert.equal(p[0].unit_code, 'A1-U05'); assert.equal(p[0].source, 'ai');
  assert.equal(parseSuggestions('لا شيء', items, U), null); assert.equal(parseSuggestions('[oops', items, U), null);
});

test('م6-ب: التحقّق — validateUnit (مستوى/رقم/عنوان/واصفات/مجالات/رمز) · validateTag (uuid · حتى 4 وحدات · الأنماط) · validateScope (مستوى الدعوة فقط)', () => {
  const bad = validateUnit({ level: 'C2', idx: 1, title_ar: 'x' }); assert.equal(bad.ok, false);
  assert.equal((validateUnit({ level: 'A1', idx: 0, title_ar: 'وحدة' }) as any).error, 'رقم الوحدة من 1 إلى 40'); assert.equal((validateUnit({ level: 'A1', idx: 9, title_ar: ' ' }) as any).error, 'عنوان الوحدة بالعربية مطلوب');
  const ok = validateUnit({ level: 'A1', idx: 9, title_ar: '  وحدة   جديدة ', title_en: 'New', focus_ar: 'تركيز', domains: ['public', 'public', 'nope'], descriptor_codes: ['lu-a1-01', 'LU-A1-01', 'XX-A1-01', 'RD-C2-01'], status: 'approved', code: 'B1-U09' });
  assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.unit.code, 'A1-U09', 'الرمز يُشتقّ من المستوى والرقم إن خالف'); assert.equal(ok.unit.title_ar, 'وحدة جديدة'); assert.deepEqual(ok.unit.domains, ['public']); assert.deepEqual(ok.unit.descriptor_codes, ['LU-A1-01']); assert.equal(ok.unit.status, 'approved'); }
  const id1 = '11111111-1111-4111-8111-111111111111';
  assert.equal(validateTag({ item_ids: ['no,pe'], unit_codes: ['A1-U01'] }).ok, false); assert.equal(validateTag({ item_ids: ['x'], unit_codes: ['A1-U01'] }).ok, false); assert.equal(validateTag({ item_ids: [id1], unit_codes: [] }).ok, false);
  const t = validateTag({ item_ids: [id1, id1], unit_codes: ['A1-U01', 'A1-U02', 'A1-U03', 'A1-U04', 'A1-U05', 'bad'], mode: 'remove' }); assert.ok(t.ok); if (t.ok) { assert.deepEqual(t.item_ids, [id1]); assert.equal(t.unit_codes.length, 4); assert.equal(t.mode, 'remove'); }
  const rep = validateTag({ item_ids: [id1], unit_codes: [], mode: 'replace' }); assert.ok(rep.ok, 'replace بلا وحدات = مسح الوسم');
  assert.deepEqual(validateScope(['A1-U01', 'A2-U01', 'A1-U01', 'x'], 'A1'), ['A1-U01']); assert.equal(validateScope(['A2-U01'], 'A1'), null); assert.equal(validateScope('A1-U01', 'A1'), null); assert.deepEqual(validateScope(['B2-U03'], null), ['B2-U03']);
});

test('م6-ب: listUnits/tagItems — قاعدة وهمية: الجدول غائب = [] بلا خطأ · ذاكرة 30 ث · الوسم add/replace/remove يكتب فقط عند التغيير', async () => {
  resetUnitsCache();
  const missing: any = { from: () => ({ select: () => ({ order: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'relation does not exist' } }) }) }) }) }) };
  assert.deepEqual(await listUnits(missing), []);
  resetUnitsCache(); let calls = 0;
  const rows = UNIT_SEED.slice(0, 3).map((u) => ({ ...u, status: 'approved', updated_at: null, updated_by: null }));
  const present: any = { from: () => ({ select: () => ({ order: () => ({ order: () => ({ limit: async () => { calls += 1; return { data: rows, error: null }; } }) }) }) }) };
  assert.equal((await listUnits(present)).length, 3); await listUnits(present); assert.equal(calls, 1, 'من الذاكرة'); await listUnits(present, true); assert.equal(calls, 2, 'force يعيد القراءة');
  const store = new Map<string, string[] | null>([['a', ['A1-U01']], ['b', null]]); const writes: string[] = [];
  const db: any = { from: (t: string) => { assert.equal(t, 'question_bank_items'); return {
    select: () => ({ in: async (_k: string, ids: string[]) => ({ data: ids.filter((i) => store.has(i)).map((id) => ({ id, unit_codes: store.get(id) })) }) }),
    update: (patch: any) => ({ eq: async (_k: string, id: string) => { store.set(id, patch.unit_codes); writes.push(id); return { error: null }; } }),
  }; } };
  assert.equal(await tagItems(db, ['a', 'b'], ['A1-U01'], 'add'), 1, 'a بلا تغيير · b يُكتب'); assert.deepEqual(store.get('b'), ['A1-U01']);
  assert.equal(await tagItems(db, ['a'], ['A1-U02'], 'add'), 1); assert.deepEqual(store.get('a'), ['A1-U01', 'A1-U02']);
  assert.equal(await tagItems(db, ['a'], ['A1-U01'], 'remove'), 1); assert.deepEqual(store.get('a'), ['A1-U02']);
  assert.equal(await tagItems(db, ['a'], [], 'replace'), 1); assert.equal(store.get('a'), null, 'replace فارغ = null');
  resetUnitsCache();
});

test('م6-ب: الهجرة والعقد — SQL (جدول · RLS · عمودان · 38 صفًّا · on conflict · notify · تشخيص) · API · الخزنة · way · اللسان 11 · مواضع الواجهة', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20270202_portal_miaar_m6b_syllabus.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.miaar_syllabus_units/); assert.match(sql, /enable row level security/); assert.match(sql, /revoke all on public\.miaar_syllabus_units from anon, authenticated/);
  assert.match(sql, /question_bank_items add column if not exists unit_codes text\[\]/); assert.match(sql, /placement_invites add column if not exists unit_scope text\[\]/);
  assert.equal((sql.match(/^  \('(A1|A2|B1|B2|C1)-U\d{2}', /gm) || []).length, 38); assert.match(sql, /on conflict \(code\) do nothing/); assert.match(sql, /notify pgrst, 'reload schema'/); assert.match(sql, /units_table = 1 · item_col = 1 · invite_col = 1 · seeded = 38/);
  for (const u of UNIT_SEED) assert.ok(sql.includes(`('${u.code}', '${u.level}', ${u.idx}, '${u.title_ar}'`), `بذرة SQL = بذرة الكود: ${u.code}`);
  const api = fs.readFileSync(path.join(ROOT, 'app/api/admin/miaar/syllabus/route.ts'), 'utf8');
  for (const a of ['unit_save', 'unit_status', 'seed_level', 'tag_items', 'suggest', 'apply_suggestions']) assert.match(api, new RegExp(`action === '${a}'`), a);
  assert.match(api, /miaar_syllabus_tag/); assert.match(api, /audit_logs/); assert.match(api, /logAi/); assert.match(api, /ADMINS\.includes\(user\.role\)/);
  assert.match(fs.readFileSync(path.join(ROOT, 'lib/ai/prompts.ts'), 'utf8'), /miaar_syllabus_tag: 30/);
  assert.match(fs.readFileSync(path.join(ROOT, 'lib/vault/registry.ts'), 'utf8'), /'miaar_syllabus_units'/);
  assert.match(fs.readFileSync(path.join(ROOT, 'lib/portal/way.ts'), 'utf8'), /'admin\/miaar\/syllabus': \{ ar: 'خريطة المنهج', en: 'Syllabus Map' \}/);
  const admin = fs.readFileSync(path.join(ROOT, 'app/admin/miaar/AdminMiaar.tsx'), 'utf8'); assert.match(admin, /\['syllabus', '11', 'خريطة المنهج', '\/admin\/miaar\/syllabus'\]/); assert.match(admin, /tab === 'syllabus' && <SyllabusMap/);
  assert.ok(fs.existsSync(path.join(ROOT, 'app/admin/miaar/syllabus/page.tsx')));
  const bank = fs.readFileSync(path.join(ROOT, 'lib/miaar/bank.ts'), 'utf8'); assert.match(bank, /\$\{COLS\}, unit_codes/); assert.match(bank, /if \(items\.error\) items = await db\.from\('question_bank_items'\)\.select\(COLS\)/, 'تراجع بلا العمود قبل الهجرة');
  const engine = fs.readFileSync(path.join(ROOT, 'lib/miaar/engine.ts'), 'utf8'); assert.match(engine, /drawPlan\(pool, token, activePlan, drawOpts\)/); assert.match(engine, /\.الوحدات = tally/);
  const xf = fs.readFileSync(path.join(ROOT, 'lib/miaar/exitflow.ts'), 'utf8'); assert.match(xf, /exit\.وحدات_للمراجعة/); assert.match(xf, /fairness\(groups\)/); assert.match(xf, /unit_scope: scope/);
  const app = fs.readFileSync(path.join(ROOT, 'app/miaar/MiaarApp.tsx'), 'utf8'); assert.match(app, /data-testid="mi-exit-units"/); assert.match(app, /data-testid="mi-exit-review"/); assert.match(app, /وحدات تحتاج مراجعة:/);
  const xb = fs.readFileSync(path.join(ROOT, 'app/admin/miaar/ExitBoard.tsx'), 'utf8'); assert.match(xb, /أين ضعفت المجموعة؟/); assert.match(xb, /درس التعويض المقترح/); assert.match(xb, /العدالة بين الشُّعب/);
  const lx = fs.readFileSync(path.join(ROOT, 'app/components/LevelExitQr.tsx'), 'utf8'); assert.match(lx, /ما دُرّس فقط/); assert.match(lx, /unit_scope: scopeOn && scope\.size/);
  const cert = fs.readFileSync(path.join(ROOT, 'app/miaar/certificate/[code]/page.tsx'), 'utf8'); assert.ok(!cert.includes('وحدات_للمراجعة') && !cert.includes('الوحدات'), 'الشهادة الرسمية بلا وحدات');
});
