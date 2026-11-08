// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P68-ب «النموذج المثبَّت» — الرمز والبصمة · التثبيت حتمي ومحفوظ · القفل عند أول جلسة · التبديل يولّد إصدارًا بسبب · الاستبدال يستبعد القديم
 *  · السحب يعيد الدعوة عشوائية ويبقي السجلّ · المحرّك يستعمل النموذج مع بديل «مِران» الفردي · التحقّق بلا نصوص · الأداء k ≥ 5 · الميزان · الدرع والخزنة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fmCode, isFmCode, fmDigest, cellCounts, balanceOf, computePerformance, freezeForm, swapItem, redrawForm, withdrawForm, lockState, alternativesFor, previewForm, verifyForm, liveFormForInvite, formItems, proctorSheet } from '../lib/miaar/forms';
import { frozenDraw } from '../lib/miaar/engine';
import { invalidatePoolCache, loadApprovedPool } from '../lib/miaar/bank';
import { KIND_AR, DEFAULT_SEVERITY } from '../lib/shield/guard';
import { REGISTRY } from '../lib/vault/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BY = { id: U(1), email: 'admin@upm.edu.sa' };
const ENV = { NEXT_PUBLIC_SITE_URL: 'https://athar.test' };

/* قاعدة وهمية: جداول في الذاكرة بسلسلة supabase الشائعة */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = JSON.parse(JSON.stringify(seed)); let ids = 100;
  const from = (t: string) => {
    T[t] = T[t] || []; const rows = T[t]; const fs: ((r: any) => boolean)[] = []; let op = 'select'; let patch: any = null; let lim = 0; let single = false; let head = false; let ordBy: [string, boolean] | null = null;
    const q: any = {
      select(_c?: string, o?: any) { if (o?.head) head = true; return q; }, eq(c: string, v: any) { fs.push((r) => String(r[c]) === String(v)); return q; }, neq(c: string, v: any) { fs.push((r) => String(r[c]) !== String(v)); return q; },
      in(c: string, v: any[]) { fs.push((r) => v.map(String).includes(String(r[c]))); return q; }, gt(c: string, v: any) { fs.push((r) => String(r[c]) > String(v)); return q; }, gte(c: string, v: any) { fs.push((r) => String(r[c]) >= String(v)); return q; },
      lt(c: string, v: any) { fs.push((r) => String(r[c]) < String(v)); return q; }, lte(c: string, v: any) { fs.push((r) => String(r[c]) <= String(v)); return q; }, is(c: string, v: any) { fs.push((r) => (v === null ? r[c] == null : r[c] === v)); return q; },
      not(c: string, _o: string, v: any) { fs.push((r) => !(v === null ? r[c] == null : r[c] === v)); return q; }, ilike(c: string, v: string) { fs.push((r) => String(r[c] || '').toLowerCase() === String(v).toLowerCase()); return q; },
      or() { return q; }, order(c: string, o: any) { ordBy = [c, o?.ascending !== false]; return q; }, limit(n: number) { lim = n; return q; }, maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      update(p: any) { op = 'update'; patch = p; return q; }, insert(p: any) { op = 'insert'; patch = p; return q; }, upsert(p: any) { op = 'insert'; patch = p; return q; },
      then(res: any) {
        let out = rows.filter((r) => fs.every((f) => f(r)));
        if (op === 'update') for (const r of out) Object.assign(r, patch);
        else if (op === 'insert') { const list = Array.isArray(patch) ? patch : [patch]; out = []; for (const p of list) { const r = { id: U(++ids), created_at: new Date(Date.now() + ids).toISOString(), ...p }; rows.push(r); out.push(r); } }
        if (ordBy) { const [c, asc] = ordBy; out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : String(a[c]) > String(b[c]) ? 1 : 0) * (asc ? 1 : -1)); }
        if (lim) out = out.slice(0, lim);
        res({ data: head ? null : single ? out[0] || null : out, error: null, count: out.length });
      },
    };
    return q;
  };
  return { db: { from, rpc: async () => ({ data: null, error: null }) }, T };
}
/* بنك اصطناعي: A2 قواعد 14 بندًا (واصفان) · B1 قواعد 6 */
function bank() {
  const items: any[] = []; const keys: any[] = []; let n = 0;
  const add = (level: string, k: number, descr: (i: number) => string | null) => { for (let i = 1; i <= k; i++) { n += 1; const id = U(5000 + n); items.push({ id, item_code: `${level}GV${String(i).padStart(2, '0')}`, level, skill: 'grammar_vocab', passage_id: null, question_text: `سؤال ${level} رقم ${i}`, options: [{ id: 'a', text: 'أ' }, { id: 'b', text: 'ب' }, { id: 'c', text: 'ج' }, { id: 'd', text: 'د' }], status: 'approved', item_type: 'mcq', stimulus: null, media_path: null, media_alt: null, descriptor_code: descr(i), cefr_descriptor: null, unit_codes: [i % 2 ? 'A2-U01' : 'A2-U02'] }); keys.push({ item_id: id, correct_option_id: 'a' }); } };
  add('A2', 14, (i) => (i <= 7 ? 'A2-GV-01' : 'A2-GV-02')); add('B1', 6, () => null);
  return { question_bank_items: items, question_bank_answer_keys: keys, miaar_passages: [] };
}
const BP = { id: U(900), code: 'T-A2-4', name_ar: 'اختبار A2 قصير', name_en: 'A2 short', description_ar: null, test_type: 'level', requirements: { levels: ['A2'], counts: { A2: { grammar_vocab: 4, reading: 0, listening: 0 } }, draw: 'random' }, duration_minutes: 20, is_system: false, purpose: 'level', level: 'A2', cut_percent: 60, status: 'active', is_public: true, name_en2: null, sort_order: 1 };
const INV = (id: string, over: any = {}) => ({ id, code: `INV${id.slice(-3)}`, kind: 'group', label_ar: `دعوة ${id.slice(-3)}`, org_id: null, program_id: null, lang: 'ar', exam_mode: 'comprehensive', blueprint_id: BP.id, purpose: 'level', expires_at: null, max_seats: null, status: 'open', note: null, created_by: U(1), created_at: '2026-11-01T00:00:00Z', classroom_id: null, form_id: null, ...over });
const seeded = () => fakeDb({ ...bank(), question_bank_blueprints: [BP], placement_invites: [INV(U(700)), INV(U(701), { classroom_id: 'c1' }), INV(U(702), { classroom_id: 'c1' })], placement_secure_sessions: [], placement_reports: [], portal_security_events: [] });

test('P68-ب: الرمز ATH-FM من 32 حرفًا بلا التباس · البصمة حتمية وتتغيّر بتغيّر الترتيب أو الإصدار', () => {
  const c = fmCode(); assert.ok(isFmCode(c), c); assert.doesNotMatch(c, /[01OI]/); assert.equal(fmCode((n) => Buffer.alloc(n, 7)), 'ATH-FM-HHHH-HHHH');
  assert.equal(fmDigest('ATH-FM-AAAA-BBBB', 1, ['x', 'y']), fmDigest('ATH-FM-AAAA-BBBB', 1, ['x', 'y']));
  assert.notEqual(fmDigest('ATH-FM-AAAA-BBBB', 1, ['x', 'y']), fmDigest('ATH-FM-AAAA-BBBB', 1, ['y', 'x'])); assert.notEqual(fmDigest('ATH-FM-AAAA-BBBB', 1, ['x']), fmDigest('ATH-FM-AAAA-BBBB', 2, ['x']));
  assert.deepEqual(cellCounts([{ level: 'A2', skill: 'grammar_vocab' }, { level: 'A2', skill: 'grammar_vocab' }, { level: 'B1', skill: 'reading' }]), { 'A2:grammar_vocab': 2, 'B1:reading': 1 });
});

test('P68-ب: التثبيت يحفظ الورقة (4 بنود A2) موقَّعة ببصمة سليمة · الدعوة تشير إليها · لا تثبيت ثانٍ · المحرّك يعيد البنود نفسها لكل متقدّم', async () => {
  invalidatePoolCache(); const { db, T } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV, site: 'https://athar.test', rand: (n) => Buffer.from(Array.from({ length: n }, (_, i) => i * 7 + 3)) });
  assert.equal(r.ok, true, JSON.stringify(r)); if (!r.ok) return;
  assert.ok(isFmCode(r.form.code)); assert.equal(r.form.version, 1); assert.equal(r.form.status, 'frozen'); assert.equal(r.items.length, 4); assert.ok(r.items.every((i) => i.level === 'A2' && i.skill === 'grammar_vocab'));
  assert.equal(T.question_bank_form_items.length, 4); assert.equal(T.placement_invites[0].form_id, r.form.id);
  assert.equal(r.form.digest, fmDigest(r.form.code, 1, r.items.map((i) => i.code))); assert.equal(r.form.body.type, 'AtharFrozenForm'); assert.equal(r.form.body.n, 4); assert.equal(r.form.body.invite_code, 'INV700');
  assert.equal(r.balance.cells[0].have, 4); assert.equal(r.balance.tone, 'ok');
  const again = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(again.ok, false); if (!again.ok) assert.equal(again.status, 409);
  /* المحرّك: الورقة نفسها مرّتين (بذرتان مختلفتان) · بديل فردي لبند مكشوف في «مِران» */
  const pool = await loadApprovedPool(db);
  const a = await frozenDraw(db, r.form.id, pool, 'seed-one'); const b = await frozenDraw(db, r.form.id, pool, 'seed-two');
  assert.ok(a && b); assert.deepEqual(a!.codes, r.items.map((i) => i.code)); assert.deepEqual(a!.codes, b!.codes); assert.deepEqual(a!.substituted, []); assert.equal(a!.code, r.form.code);
  const exposed = new Set([r.items[1].code]); const c = await frozenDraw(db, r.form.id, pool, 'seed-three', exposed);
  assert.ok(c); assert.deepEqual(c!.substituted, [r.items[1].code]); assert.notEqual(c!.codes[1], r.items[1].code); assert.equal(c!.codes.length, 4); assert.equal(new Set(c!.codes).size, 4, 'لا تكرار بعد البديل');
  assert.ok(!exposed.has(c!.codes[1])); assert.equal(c!.codes[0], r.items[0].code); assert.equal(c!.codes[2], r.items[2].code);
  /* الدرع: حدث تثبيت */
  assert.ok(T.portal_security_events.some((e) => e.kind === 'miaar_form_frozen'));
});

test('P68-ب: البدائل من الخليّة نفسها (الواصف أولًا · بلا بنود الورقة) · التبديل بسبب يولّد v2 بنفس الرمز والقديم superseded · التبديل من خليّة أخرى مرفوض', async () => {
  invalidatePoolCache(); const { db, T } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  const first = r.items[0]; const alts = await alternativesFor(db, r.form.id, first.code); assert.equal(alts.ok, true); if (!alts.ok) return;
  assert.equal(alts.alternatives.length, 8, '14 − 4 في الورقة = 10 → الحدّ 8'); assert.ok(alts.alternatives.every((a) => !r.items.some((i) => i.code === a.code))); assert.ok(alts.alternatives[0].same_descriptor || alts.alternatives.every((a) => !a.same_descriptor));
  assert.equal(alts.item.text, `سؤال A2 رقم ${Number(first.code.slice(-2))}`);
  const noReason = await swapItem(db, { form_id: r.form.id, from: first.code, to: alts.alternatives[0].code, reason: '', by: BY, env: ENV }); assert.equal(noReason.ok, false);
  const wrongCell = await swapItem(db, { form_id: r.form.id, from: first.code, to: 'B1GV01', reason: 'تجربة', by: BY, env: ENV }); assert.equal(wrongCell.ok, false); if (!wrongCell.ok) assert.match(wrongCell.error, /خليّة مختلفة/);
  const sw = await swapItem(db, { form_id: r.form.id, from: first.code, to: alts.alternatives[0].code, reason: 'نصّ غامض', by: BY, env: ENV }); assert.equal(sw.ok, true, JSON.stringify(sw)); if (!sw.ok) return;
  assert.equal(sw.form.code, r.form.code); assert.equal(sw.form.version, 2); assert.equal(sw.items[0].code, alts.alternatives[0].code); assert.deepEqual(sw.items.slice(1).map((i) => i.code), r.items.slice(1).map((i) => i.code), 'الترتيب محفوظ');
  const old = T.question_bank_forms.find((f) => f.id === r.form.id); assert.equal(old.status, 'superseded'); assert.equal(old.superseded_by, sw.form.id); assert.equal(T.placement_invites[0].form_id, sw.form.id);
  assert.equal(sw.form.changes.length, 1); assert.equal(sw.form.changes[0].kind, 'swap'); assert.equal(sw.form.changes[0].reason, 'نصّ غامض'); assert.equal(sw.form.digest, fmDigest(sw.form.code, 2, sw.items.map((i) => i.code)));
  const live = await liveFormForInvite(db, U(700)); assert.equal(live?.id, sw.form.id);
  const onOld = await swapItem(db, { form_id: r.form.id, from: sw.items[1].code, to: alts.alternatives[1].code, reason: 'مكرّر', by: BY, env: ENV }); assert.equal(onOld.ok, false, 'لا تعديل على إصدار قديم');
});

test('P68-ب: الاستبدال الكامل يستبعد بنود الإصدار السابق (تداخل 0 حين يكفي البنك) ويولّد v2 · ★5 الدعوة الثانية لنفس القاعة تستبعد ورقة الأولى', async () => {
  invalidatePoolCache(); const { db } = seeded();
  const r = await freezeForm(db, { invite_id: U(701), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  const rd = await redrawForm(db, { form_id: r.form.id, reason: 'ورقة جديدة', by: BY, env: ENV }); assert.equal(rd.ok, true, JSON.stringify(rd)); if (!rd.ok) return;
  assert.equal(rd.form.version, 2); assert.equal(rd.overlap, 0); assert.equal(rd.items.length, 4); const oldSet = new Set(r.items.map((i) => i.code)); assert.ok(rd.items.every((i) => !oldSet.has(i.code)));
  /* ★5: دعوة ثانية لنفس القاعة c1 — سحبها يستبعد بنود نموذج الدعوة الأولى (الحيّ والقديم) */
  const r2 = await freezeForm(db, { invite_id: U(702), by: BY, env: ENV }); assert.equal(r2.ok, true); if (!r2.ok) return;
  const prior = new Set([...r.items, ...rd.items].map((i) => i.code)); assert.equal(prior.size, 8);
  assert.ok(r2.items.every((i) => !prior.has(i.code)), `ورقة الدعوة الثانية ${r2.items.map((i) => i.code).join(',')} لا تتقاطع مع ${[...prior].join(',')}`);
  assert.equal(r2.form.draw_meta.excluded_prior, 8);
});

test('P68-ب: «القفل عند أول جلسة» يمنع التبديل والاستبدال (423) لا السحب · السحب يحتاج سببًا ≥ 5 · يعيد الدعوة عشوائية ويبقي الصفّ withdrawn مع حدث تحذير', async () => {
  invalidatePoolCache(); const { db, T } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  assert.deepEqual(await lockState(db, U(700)), { locked: false, sessions: 0, finished: 0 });
  T.placement_secure_sessions.push({ id: U(800), invite_id: U(700), status: 'active', candidate: { email: 'a@x.sa', frozenForm: { code: r.form.code, version: 1 } } });
  assert.equal((await lockState(db, U(700))).locked, true);
  const sw = await swapItem(db, { form_id: r.form.id, from: r.items[0].code, to: 'A2GV09', reason: 'تجربة', by: BY, env: ENV }); assert.equal(sw.ok, false); if (!sw.ok) { assert.equal(sw.status, 423); assert.match(sw.error, /القفل عند أول جلسة/); }
  const rd = await redrawForm(db, { form_id: r.form.id, by: BY, env: ENV }); assert.equal(rd.ok, false); if (!rd.ok) assert.equal(rd.status, 423);
  const noFreeze = await freezeForm(db, { invite_id: U(701), by: BY, env: ENV }); assert.equal(noFreeze.ok, true, 'دعوة أخرى بلا جلسات تُثبَّت عاديًا');
  const short = await withdrawForm(db, { form_id: r.form.id, reason: 'لا', by: BY, env: ENV }); assert.equal(short.ok, false);
  const wd = await withdrawForm(db, { form_id: r.form.id, reason: 'خطأ في بند 3 اكتُشف بعد البدء', by: BY, env: ENV }); assert.equal(wd.ok, true, JSON.stringify(wd)); if (!wd.ok) return;
  assert.equal(wd.form.status, 'withdrawn'); assert.equal(wd.form.withdraw_reason, 'خطأ في بند 3 اكتُشف بعد البدء'); assert.equal(wd.locked_sessions, 1); assert.equal(T.placement_invites[0].form_id, null);
  assert.equal(await liveFormForInvite(db, U(700)), null); assert.equal(T.question_bank_forms.length, 2, 'لا حذف');
  const ev = T.portal_security_events.find((e) => e.kind === 'miaar_form_withdrawn'); assert.ok(ev); assert.equal(ev.severity, 'warn');
  const pool = await loadApprovedPool(db); assert.equal(await frozenDraw(db, r.form.id, pool, 's'), null, 'المحرّك يعود إلى السحب العشوائي بعد السحب');
  /* التحقّق العام بعد السحب: موجود · سليم · مسحوب · بلا نصوص */
  const v = await verifyForm(db, r.form.code); assert.equal(v.valid, true); assert.equal(v.intact, true); assert.equal(v.status, 'withdrawn'); assert.equal(v.live, false); assert.equal(v.form?.sessions, 1); assert.equal(v.form?.n, 4);
  assert.doesNotMatch(JSON.stringify(v), /سؤال A2/);
});

test('P68-ب: المعاينة — نسخة المشرف بالنصوص والإجابة الصحيحة والميزان والإصدارات؛ بلا نصوص عند withText=false · نسخة المراقب بلا أسئلة · التحقّق برمز غير موجود', async () => {
  invalidatePoolCache(); const { db } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  const p = await previewForm(db, r.form.id, { withText: true }); assert.ok(p); assert.equal(p!.items.length, 4); assert.ok(p!.items[0].text); assert.equal(p!.items[0].options!.filter((o) => o.correct).length, 1); assert.equal(p!.items[0].options!.find((o) => o.correct)!.id, 'a');
  assert.ok(p!.balance); assert.equal(p!.versions.length, 1); assert.equal(p!.invite?.code, 'INV700'); assert.equal(p!.form.plan_code, 'T-A2-4'); assert.equal(p!.form.duration_minutes, 20); assert.match(p!.note_ar, /نسخة المشرف/);
  const byCode = await previewForm(db, r.form.code); assert.ok(byCode); assert.equal(byCode!.form.id, r.form.id); assert.equal(byCode!.items[0].text, undefined); assert.equal(byCode!.with_text, false);
  const sheet = await proctorSheet(db, r.form.id, 'https://athar.test/'); assert.ok(sheet); assert.equal(sheet!.invite_url, 'https://athar.test/miaar/d/INV700'); assert.equal(sheet!.n, 4); assert.doesNotMatch(JSON.stringify(sheet), /سؤال/);
  assert.deepEqual(await verifyForm(db, 'ATH-FM-ZZZZ-ZZZZ'), { valid: false }); assert.deepEqual(await verifyForm(db, 'nope'), { valid: false });
  const items = await formItems(db, r.form.id); assert.deepEqual(items.map((i) => i.position), [0, 1, 2, 3]);
});

test('P68-ب: «أثر الورقة» — أقل من 5 تقارير لا أرقام · نسبة الصواب والتمييز (أعلى ثلث − أدنى ثلث) · إشارة «لم يميّز» تقترح المراجعة · «الميزان» يلتقط النقص والوحدات الغائبة', () => {
  const items = [{ code: 'q1', level: 'A2', skill: 'grammar_vocab', position: 0 }, { code: 'q2', level: 'A2', skill: 'grammar_vocab', position: 1 }, { code: 'q3', level: 'A2', skill: 'grammar_vocab', position: 2 }];
  const rep = (a: boolean, b: boolean, c: boolean | null) => ({ items: [{ code: 'q1', correct: a }, { code: 'q2', correct: b }, { code: 'q3', correct: c }] });
  const few = computePerformance(items, [rep(true, true, true), rep(false, false, false), rep(true, false, true), rep(true, true, false)]); assert.equal(few.ok, false); assert.equal(few.reports, 4); assert.match(few.reason!, /5/);
  /* 6 تقارير: q1 يميّز (الأقوياء يصيبونه والضعاف لا) · q2 الجميع يصيبونه (سهل جدًا · تمييز 0) · q3 لم يُجب عنه أحد */
  const reports = [rep(false, true, null), rep(false, true, null), rep(true, true, null), rep(true, true, null), rep(true, true, null), rep(true, true, null)];
  const p = computePerformance(items, reports); assert.equal(p.ok, true); assert.equal(p.reports, 6);
  const q1 = p.items[0]; assert.equal(q1.n, 6); assert.equal(q1.p, 0.67); assert.equal(q1.discrimination, 1); assert.equal(q1.flag, 'ok');
  const q2 = p.items[1]; assert.equal(q2.p, 1); assert.equal(q2.discrimination, 0); assert.ok(['weak', 'easy'].includes(q2.flag)); const q3 = p.items[2]; assert.equal(q3.n, 0); assert.equal(q3.flag, 'ok');
  assert.ok(p.review_suggested.length <= 1);
  const plan: any = { levels: ['A2'], counts: { A2: { grammar_vocab: 4, reading: 2, listening: 0 } } };
  const pool: any[] = [{ code: 'q1', descriptor: 'D1', unitCodes: ['U1'] }, { code: 'q2', descriptor: 'D1', unitCodes: ['U1'] }, { code: 'q3', descriptor: null, unitCodes: [] }];
  const b = balanceOf(plan, items, pool, { units: [{ code: 'U1' }, { code: 'U2' }], seen: new Set(['q2']) });
  assert.equal(b.tone, 'warn'); assert.equal(b.cells.length, 2); assert.equal(b.cells[0].have, 3); assert.equal(b.cells[0].ok, false); assert.equal(b.cells[1].have, 0); assert.deepEqual(b.units, { approved: 2, covered: 1, missing: ['U2'], scoped: false }); assert.equal(b.seen_recent, 1); assert.equal(b.descriptors, 1);
  assert.ok(b.notes_ar.some((n) => n.includes('خلايا ناقصة'))); assert.ok(b.notes_ar.some((n) => n.includes('U2')));
  const ok = balanceOf({ levels: ['A2'], counts: { A2: { grammar_vocab: 3, reading: 0, listening: 0 } } } as any, items, pool); assert.equal(ok.tone, 'ok'); assert.deepEqual(ok.notes_ar, ['الورقة موزونة على المخطَّط — القرار لك']);
});

test('P68-ب: شكل المصدر — المحرّك يستعمل النموذج قبل السحب ويسجّل questionSource=frozen · الدرع يعرف الأحداث الثلاثة · الخزنة تسجّل الجدولين · SQL يحمل الأعمدة والفهارس والتشخيص · التحقّق العام بلا نصوص · الصفحات موجودة', () => {
  const engine = read('lib/miaar/engine.ts'); assert.match(engine, /frozenDraw\(db, input\.invite\.form_id/); assert.match(engine, /frozen-\$\{frozenMeta\.code\}-v\$\{frozenMeta\.version\}/); assert.match(engine, /frozenForm: frozenMeta/);
  for (const k of ['miaar_form_frozen', 'miaar_form_changed', 'miaar_form_withdrawn']) { assert.ok(KIND_AR[k], k); assert.ok(DEFAULT_SEVERITY[k], k); } assert.equal(DEFAULT_SEVERITY.miaar_form_withdrawn, 'warn');
  for (const t of ['question_bank_forms', 'question_bank_form_items']) assert.ok(REGISTRY.some((r) => r.table === t), t);
  const sql = read('supabase/p68b-frozen-form.sql'); for (const s of ['add column if not exists code text', 'add column if not exists version int', 'add column if not exists invite_id uuid', 'add column if not exists digest text', 'add column if not exists withdraw_reason text', 'qbf_live_invite_uidx', 'qbf_code_uidx', 'add column if not exists item_code text', "add column if not exists form_id uuid", 'enable row level security', 'p68b_frozen']) assert.ok(sql.includes(s), s);
  const api = read('app/api/miaar/route.ts'); assert.match(api, /searchParams\.get\('form'\)/); assert.match(api, /verifyForm/);
  const forms = read('lib/miaar/forms.ts'); assert.doesNotMatch(forms.slice(forms.indexOf('export async function verifyForm'), forms.indexOf('export type ItemPerf')), /questionText/, 'التحقّق لا يلمس النصوص');
  for (const p of ['app/verify/form/page.tsx', 'app/admin/miaar/FormDesk.tsx', 'app/api/admin/miaar/frozen/route.ts']) assert.ok(has(p), p);
  const way = read('lib/portal/way.ts'); assert.match(way, /'verify\/form'/); assert.match(way, /'\/verify\/form'/);
  const admin = read('app/admin/miaar/AdminMiaar.tsx'); assert.match(admin, /FormDesk/); assert.match(admin, /mm-form-\$\{i\.code\}/);
  const detail = read('lib/miaar/detail.ts'); assert.match(detail, /frozenForm/);
});
