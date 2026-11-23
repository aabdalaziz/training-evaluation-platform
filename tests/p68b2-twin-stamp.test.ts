// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P68-ب-2 «توأم النموذج» و«ختم المراقب» — التوزيع حتمي بالبريد · التوأم بالخلايا نفسها بلا بند مشترك وإصدار جديد بالرمز نفسه · البصمة تشمل الورقتين
 *  · التبديل داخل ورقة واحدة والبدائل تستبعد الورقتين · إعادة السحب تعيد سحب التوأم · القفل · «ميزان التكافؤ» · الختم الموقَّع (403/404/410) · «عدّ الشعبة» · الحدّ · الدرع · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fmDigest, variantFor, VARIANT_AR, freezeForm, twinForm, swapItem, redrawForm, alternativesFor, previewForm, verifyForm, twinItems, sessionsByVariant, computePerformance, equivalenceOf, reportsOfVariant, EQUIV_GAP, stampToken, stampTokenOk, stampState, addStamp, hallSummary, proctorSheet, STAMP_MAX } from '../lib/miaar/forms';
import { frozenDraw } from '../lib/miaar/engine';
import { invalidatePoolCache, loadApprovedPool } from '../lib/miaar/bank';
import { KIND_AR, DEFAULT_SEVERITY } from '../lib/shield/guard';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BY = { id: U(1), email: 'admin@upm.edu.sa' };
const ENV = { NEXT_PUBLIC_SITE_URL: 'https://athar.test', CRON_SECRET: 'test-key-p68b2' };

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
/* بنك اصطناعي: A2 قواعد 24 بندًا (واصفان) — يكفي لورقتين ثم إعادة سحبهما · B1 قواعد 6 */
function bank() {
  const items: any[] = []; const keys: any[] = []; let n = 0;
  const add = (level: string, k: number, descr: (i: number) => string | null) => { for (let i = 1; i <= k; i++) { n += 1; const id = U(5000 + n); items.push({ id, item_code: `${level}GV${String(i).padStart(2, '0')}`, level, skill: 'grammar_vocab', passage_id: null, question_text: `سؤال ${level} رقم ${i}`, options: [{ id: 'a', text: 'أ' }, { id: 'b', text: 'ب' }, { id: 'c', text: 'ج' }, { id: 'd', text: 'د' }], status: 'approved', item_type: 'mcq', stimulus: null, media_path: null, media_alt: null, descriptor_code: descr(i), cefr_descriptor: null, unit_codes: [i % 2 ? 'A2-U01' : 'A2-U02'] }); keys.push({ item_id: id, correct_option_id: 'a' }); } };
  add('A2', 24, (i) => (i <= 12 ? 'A2-GV-01' : 'A2-GV-02')); add('B1', 6, () => null);
  return { question_bank_items: items, question_bank_answer_keys: keys, miaar_passages: [] };
}
const BP = { id: U(900), code: 'T-A2-4', name_ar: 'اختبار A2 قصير', name_en: 'A2 short', description_ar: null, test_type: 'level', requirements: { levels: ['A2'], counts: { A2: { grammar_vocab: 4, reading: 0, listening: 0 } }, draw: 'random' }, duration_minutes: 20, is_system: false, purpose: 'level', level: 'A2', cut_percent: 60, status: 'active', is_public: true, name_en2: null, sort_order: 1 };
const INV = (id: string, over: any = {}) => ({ id, code: `INV${id.slice(-3)}`, kind: 'group', label_ar: `دعوة ${id.slice(-3)}`, org_id: null, program_id: null, lang: 'ar', exam_mode: 'comprehensive', blueprint_id: BP.id, purpose: 'level', expires_at: null, max_seats: null, status: 'open', note: null, created_by: U(1), created_at: '2026-11-01T00:00:00Z', classroom_id: null, form_id: null, ...over });
const seeded = () => fakeDb({ ...bank(), question_bank_blueprints: [BP], placement_invites: [INV(U(700)), INV(U(701), { classroom_id: 'c1' })], placement_secure_sessions: [], placement_reports: [], portal_security_events: [] });
const codesOf = (xs: readonly { code: string }[]) => xs.map((x) => x.code);
const cells = (xs: readonly { level: string; skill: string }[]) => xs.map((x) => `${x.level}:${x.skill}`).sort().join(',');

test('P68-ب-2: التوزيع حتمي بالبريد (نفس البريد → نفس الورقة · حالة الأحرف لا تؤثّر) · ≈ 50/50 على 400 بريد · البصمة تتغيّر بإضافة التوأم', () => {
  assert.equal(variantFor('ATH-FM-AAAA-BBBB', 'Sara@X.sa'), variantFor('ATH-FM-AAAA-BBBB', ' sara@x.sa '));
  let b = 0; for (let i = 0; i < 400; i++) if (variantFor('ATH-FM-AAAA-BBBB', `u${i}@x.sa`) === 'b') b += 1; assert.ok(b > 140 && b < 260, `ب = ${b}/400`);
  assert.equal(variantFor('ATH-FM-AAAA-BBBB', null, 'seed-1'), variantFor('ATH-FM-AAAA-BBBB', '', 'seed-1')); assert.deepEqual(VARIANT_AR, { a: 'أ', b: 'ب' });
  assert.notEqual(fmDigest('C', 1, ['x', 'y']), fmDigest('C', 1, ['x', 'y'], ['p', 'q'])); assert.equal(fmDigest('C', 1, ['x', 'y'], []), fmDigest('C', 1, ['x', 'y']), 'بلا توأم = البصمة القديمة نفسها');
});

test('P68-ب-2: «ضُمّ توأمًا» → إصدار 2 بالرمز نفسه: أ كما هي · ب 4 بنود بالخلايا نفسها بلا بند مشترك · البصمة سليمة · لا توأم ثانٍ (409) · المعاينة والتحقّق يعرفان التوأم', async () => {
  invalidatePoolCache(); const { db, T } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  const t = await twinForm(db, { form_id: r.form.id, by: BY, env: ENV }); assert.equal(t.ok, true, JSON.stringify(t)); if (!t.ok) return;
  assert.equal(t.form.code, r.form.code); assert.equal(t.form.version, 2); assert.deepEqual(codesOf(t.items), codesOf(r.items), 'أ لم تتغيّر'); assert.equal(t.itemsB.length, 4);
  assert.equal(cells(t.itemsB), cells(t.items), 'الخلايا نفسها'); assert.equal(t.itemsB.filter((i) => codesOf(r.items).includes(i.code)).length, 0, 'بلا بند مشترك'); assert.ok(t.same_descriptor >= 0 && t.same_descriptor <= 4);
  assert.equal(t.form.changes[0].kind, 'twin'); assert.equal(t.form.draw_meta.twin.n, 4); assert.equal(T.placement_invites[0].form_id, t.form.id); assert.equal(T.question_bank_forms.find((f) => f.id === r.form.id).status, 'superseded');
  assert.equal(T.question_bank_form_items.filter((i) => i.form_id === t.form.id && i.variant === 'b').length, 4); assert.equal(T.question_bank_form_items.filter((i) => i.form_id === t.form.id && i.variant === 'a').length, 4);
  assert.equal(t.form.digest, fmDigest(t.form.code, 2, codesOf(t.items), codesOf(t.itemsB)));
  const again = await twinForm(db, { form_id: t.form.id, by: BY, env: ENV }); assert.equal(again.ok, false); if (!again.ok) assert.equal(again.status, 409);
  const tw = await twinItems(db, t.form.id); assert.equal(tw.a.length, 4); assert.equal(tw.b.length, 4);
  const p = await previewForm(db, t.form.id, { withText: true }); assert.ok(p); assert.equal(p!.twin, true); assert.equal(p!.items_b.length, 4); assert.ok(p!.items_b[0].text); assert.ok(p!.balance_b); assert.equal(p!.balance_b!.tone, 'ok'); assert.equal(p!.same_descriptor, t.same_descriptor);
  const v = await verifyForm(db, t.form.code); assert.equal(v.valid, true); assert.equal(v.intact, true); assert.equal(v.form!.n, 4); assert.deepEqual(v.form!.twin && { n: v.form!.twin.n, a: v.form!.twin.sessions_a, b: v.form!.twin.sessions_b }, { n: 4, a: 0, b: 0 }); assert.equal(v.form!.proctoring, null);
  assert.ok(T.portal_security_events.some((e) => e.kind === 'miaar_form_changed' && e.meta?.kind === 'twin'));
});

test('P68-ب-2: المحرّك يختار الورقة بالبريد — ثابتة لنفس البريد · بريدان مختلفان يغطّيان أ وب · بديل «مِران» يعمل على ب · بلا توأم → أ دائمًا', async () => {
  invalidatePoolCache(); const { db } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return; const pool = await loadApprovedPool(db);
  const solo = await frozenDraw(db, r.form.id, pool, 's1', undefined, 'anyone@x.sa'); assert.ok(solo); assert.equal(solo!.twin, false); assert.equal(solo!.variant, 'a');
  const t = await twinForm(db, { form_id: r.form.id, by: BY, env: ENV }); assert.equal(t.ok, true); if (!t.ok) return;
  const seen = new Set<string>(); let picked: { email: string; v: 'a' | 'b' }[] = [];
  for (let i = 0; i < 40 && seen.size < 2; i++) { const email = `c${i}@x.sa`; const d = await frozenDraw(db, t.form.id, pool, `seed-${i}`, undefined, email); assert.ok(d); assert.equal(d!.twin, true); seen.add(d!.variant); picked.push({ email, v: d!.variant }); assert.deepEqual(d!.codes, codesOf(d!.variant === 'b' ? t.itemsB : t.items)); }
  assert.equal(seen.size, 2, 'الورقتان تظهران');
  const bUser = picked.find((x) => x.v === 'b')!; const again = await frozenDraw(db, t.form.id, pool, 'other-seed', undefined, bUser.email); assert.equal(again!.variant, 'b', 'إعادة الدخول = الورقة نفسها');
  const exposed = new Set([t.itemsB[2].code]); const sub = await frozenDraw(db, t.form.id, pool, 'x', exposed, bUser.email); assert.deepEqual(sub!.substituted, [t.itemsB[2].code]); assert.ok(!codesOf(t.items).includes(sub!.codes[2]), 'البديل ليس من ورقة أ'); assert.equal(new Set(sub!.codes).size, 4);
});

test('P68-ب-2: التبديل داخل ورقة ب لا يمسّ أ · البدائل تستبعد الورقتين · إعادة السحب تعيد سحب التوأم بلا تداخل · القفل عند أول جلسة يمنع ضمّ التوأم (423) · الجلسات تُحصى أ/ب', async () => {
  invalidatePoolCache(); const { db, T } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  const t = await twinForm(db, { form_id: r.form.id, by: BY, env: ENV }); assert.equal(t.ok, true); if (!t.ok) return;
  const alts = await alternativesFor(db, t.form.id, t.itemsB[0].code); assert.equal(alts.ok, true); if (!alts.ok) return;
  const inPapers = new Set([...codesOf(t.items), ...codesOf(t.itemsB)]); assert.ok(alts.alternatives.every((a) => !inPapers.has(a.code)), 'لا بديل من الورقتين');
  const dup = await swapItem(db, { form_id: t.form.id, from: t.itemsB[0].code, to: t.items[0].code, reason: 'تجربة', by: BY, env: ENV }); assert.equal(dup.ok, false); if (!dup.ok) assert.match(dup.error, /إحدى الورقتين/);
  const sw = await swapItem(db, { form_id: t.form.id, from: t.itemsB[0].code, to: alts.alternatives[0].code, reason: 'نصّ غامض', by: BY, env: ENV }); assert.equal(sw.ok, true, JSON.stringify(sw)); if (!sw.ok) return;
  assert.equal(sw.form.version, 3); assert.equal(sw.items[0].code, alts.alternatives[0].code); assert.equal(sw.form.changes[1].variant, 'b');
  const tw3 = await twinItems(db, sw.form.id); assert.deepEqual(codesOf(tw3.a), codesOf(t.items), 'أ كما هي'); assert.equal(tw3.b.length, 4); assert.equal(tw3.b[0].code, alts.alternatives[0].code);
  assert.equal(sw.form.digest, fmDigest(sw.form.code, 3, codesOf(tw3.a), codesOf(tw3.b)));
  const rd = await redrawForm(db, { form_id: sw.form.id, by: BY, env: ENV }); assert.equal(rd.ok, true, JSON.stringify(rd)); if (!rd.ok) return;
  const tw4 = await twinItems(db, rd.form.id); assert.equal(tw4.b.length, 4, 'التوأم بقي بعد إعادة السحب'); assert.equal(tw4.b.filter((i) => codesOf(tw4.a).includes(i.code)).length, 0); assert.equal(rd.overlap, 0); assert.equal(rd.form.draw_meta.twin.n, 4);
  T.placement_secure_sessions.push({ id: U(800), invite_id: U(700), status: 'active', candidate: { email: 'a@x.sa', frozenForm: { code: rd.form.code, version: rd.form.version, variant: 'b', twin: true } } });
  T.placement_secure_sessions.push({ id: U(801), invite_id: U(700), status: 'finished', candidate: { email: 'b@x.sa', frozenForm: { code: rd.form.code, version: rd.form.version, variant: 'a', twin: true } } });
  assert.deepEqual(await sessionsByVariant(db, rd.form), { a: 1, b: 1 });
  const r2 = await freezeForm(db, { invite_id: U(701), by: BY, env: ENV }); assert.equal(r2.ok, true); if (!r2.ok) return;
  T.placement_secure_sessions.push({ id: U(802), invite_id: U(701), status: 'active', candidate: { email: 'c@x.sa', frozenForm: { code: r2.form.code, version: 1 } } });
  const late = await twinForm(db, { form_id: r2.form.id, by: BY, env: ENV }); assert.equal(late.ok, false); if (!late.ok) assert.equal(late.status, 423);
});

test('P68-ب-2: «ميزان التكافؤ» — يحتاج 5 تقارير لكل ورقة · الفرق > 0.15 = غير متكافئ · التقرير يُنسب إلى الورقة الغالبة', () => {
  const A = [{ code: 'a1', level: 'A2', skill: 'grammar_vocab', position: 0 }, { code: 'a2', level: 'A2', skill: 'grammar_vocab', position: 1 }];
  const B = [{ code: 'b1', level: 'A2', skill: 'grammar_vocab', position: 0 }, { code: 'b2', level: 'A2', skill: 'grammar_vocab', position: 1 }];
  const rep = (codes: string[], ok: boolean[]) => ({ items: codes.map((code, i) => ({ code, correct: ok[i] })) });
  const ra = Array.from({ length: 6 }, (_, i) => rep(['a1', 'a2'], [true, i < 3])); const rb = Array.from({ length: 6 }, (_, i) => rep(['b1', 'b2'], [i < 1, i < 1]));
  const mixed = [...ra, ...rb]; assert.equal(reportsOfVariant(mixed, { a: A, b: B }, 'a').length, 6); assert.equal(reportsOfVariant(mixed, { a: A, b: B }, 'b').length, 6);
  const pa = computePerformance(A, ra); const pb = computePerformance(B, rb); assert.ok(pa.ok && pb.ok);
  const e = equivalenceOf(pa, pb); assert.equal(e.ok, true); assert.equal(e.mean_a, 0.75); assert.ok(e.mean_b! < 0.3); assert.equal(e.flag, 'uneven'); assert.ok(Math.abs(e.diff!) > EQUIV_GAP);
  const even = equivalenceOf(pa, computePerformance(B, Array.from({ length: 6 }, (_, i) => rep(['b1', 'b2'], [true, i < 3])))); assert.equal(even.flag, 'even'); assert.equal(even.diff, 0);
  const na = equivalenceOf(pa, computePerformance(B, rb.slice(0, 2))); assert.equal(na.ok, false); assert.equal(na.flag, 'na'); assert.match(na.reason!, /5 تقارير/);
});

test('P68-ب-2: «ختم المراقب» — الرمز HMAC ثابت ومرتبط بالدعوة والنموذج · 404/403/410 · ختم فتح ثم إغلاق بعدّ يُقارن بالجلسات منذ الفتح · الحدّ 10 · الدرع · نسخة المراقب تحمل رابط الختم · التحقّق العام يعرض الأعداد', async () => {
  invalidatePoolCache(); const { db, T } = seeded();
  const r = await freezeForm(db, { invite_id: U(700), by: BY, env: ENV }); assert.equal(r.ok, true); if (!r.ok) return;
  const tok = stampToken('INV700', r.form.code, ENV); assert.equal(tok, stampToken('INV700', r.form.code, ENV)); assert.equal(tok.length, 22); assert.notEqual(tok, stampToken('INV701', r.form.code, ENV)); assert.notEqual(tok, stampToken('INV700', r.form.code, { CRON_SECRET: 'other' }));
  assert.equal(stampTokenOk('INV700', r.form.code, tok, ENV), true); assert.equal(stampTokenOk('INV700', r.form.code, tok.slice(0, 21) + 'x', ENV), false); assert.equal(stampTokenOk('INV700', r.form.code, '', ENV), false);
  const sheet = await proctorSheet(db, r.form.id, 'https://athar.test/', ENV); assert.ok(sheet); assert.equal(sheet!.stamp_url, `https://athar.test/miaar/proctor/INV700?t=${tok}`); assert.equal(sheet!.twin, false); assert.deepEqual(sheet!.stamps, []);
  const nf = await stampState(db, 'NOPE', tok, ENV); assert.equal('error' in nf && nf.status, 404);
  const bad = await stampState(db, 'INV700', 'wrong', ENV); assert.equal('error' in bad && bad.status, 403);
  const st = await stampState(db, 'INV700', tok, ENV); assert.ok(!('error' in st)); if ('error' in st) return; assert.equal(st.form.code, r.form.code); assert.deepEqual(st.stamps, []); assert.equal(st.sessions, 0); assert.equal(st.max, STAMP_MAX);
  const noHall = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'open', hall: '  ', env: ENV }); assert.equal(noHall.ok, false);
  const open = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'open', hall: ' قاعة <b>3</b> ', env: ENV }); assert.equal(open.ok, true, JSON.stringify(open)); if (!open.ok) return; assert.equal(open.stamp.hall, 'قاعة 3'); assert.equal(open.stamp.count, null);
  await new Promise((res) => setTimeout(res, 5));
  for (let i = 0; i < 3; i++) await db.from('placement_secure_sessions').insert({ invite_id: U(700), status: 'active', candidate: { email: `s${i}@x.sa`, frozenForm: { code: r.form.code, version: 1 } } });
  const badCount = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'close', hall: 'قاعة 3', count: -1, env: ENV }); assert.equal(badCount.ok, false);
  const close = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'close', hall: 'قاعة 3', count: 3, env: ENV }); assert.equal(close.ok, true, JSON.stringify(close)); if (!close.ok) return;
  assert.equal(close.stamp.sessions, 3); assert.equal(close.stamp.diff, 0); assert.equal(close.stamps.length, 2); assert.equal(close.hall.halls, 1); assert.equal(close.hall.diff_total, 0); assert.match(close.hall.lines_ar[0], /القاعة قاعة 3: فُتحت .* · أُغلقت .* · عدّ 3 = الجلسات ✓/);
  assert.deepEqual(T.placement_invites[0].proctor_stamps.map((s: any) => s.kind), ['open', 'close']);
  const close2 = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'close', hall: 'قاعة 7', count: 5, env: ENV }); assert.equal(close2.ok, true); if (!close2.ok) return; assert.equal(close2.stamp.sessions, 3, 'بلا ختم فتح لهذه القاعة → كل جلسات الدعوة'); assert.equal(close2.stamp.diff, 2);
  const ev = T.portal_security_events.filter((e) => e.kind === 'miaar_proctor_stamped'); assert.equal(ev.length, 3); assert.equal(ev[1].severity, 'info'); assert.equal(ev[2].severity, 'warn'); assert.ok(!JSON.stringify(ev).includes('@'), 'لا بريد في حدث الختم');
  const v = await verifyForm(db, r.form.code); assert.deepEqual(v.form!.proctoring, { open: 1, close: 2, halls: 2, diff_total: 2 });
  const p = await previewForm(db, r.form.id, { withText: false }); assert.equal(p!.stamps.length, 3); assert.equal(p!.hall.halls, 2);
  for (let i = 0; i < STAMP_MAX - 3; i++) { const x = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'open', hall: `ق${i}`, env: ENV }); assert.equal(x.ok, true); }
  const over = await addStamp(db, { invite_code: 'INV700', token: tok, kind: 'open', hall: 'زيادة', env: ENV }); assert.equal(over.ok, false); if (!over.ok) assert.equal(over.status, 429);
  T.placement_invites[0].status = 'closed'; T.placement_invites[0].updated_at = new Date(Date.now() - 48 * 3600000).toISOString();
  const late = await stampState(db, 'INV700', tok, ENV); assert.equal('error' in late && late.status, 410);
  T.placement_invites[0].status = 'open'; T.question_bank_forms.find((f) => f.id === r.form.id).status = 'withdrawn';
  const gone = await stampState(db, 'INV700', tok, ENV); assert.equal('error' in gone && gone.status, 410);
  assert.equal(hallSummary([]).diff_total, null); assert.equal(hallSummary([]).lines_ar.length, 0);
});

test('P68-ب-2: شكل المصدر — SQL (عمودان + قيد + تشخيص 5) · الدرع يعرف miaar_proctor_stamped · المحرّك يمرّر البريد ويلحق الورقة بالمصدر · الصفحات والمسارات · «الجلوس بالألوان» في مِعيار · اللوحة والتحقّق والتقرير التفصيلي', () => {
  const sql = read('supabase/p68b2-twin-stamp.sql'); for (const s of ["add column if not exists variant text not null default 'a'", 'qbfi_variant_chk', "add column if not exists proctor_stamps jsonb not null default '[]'", 'p68b2_variant_col', 'p68b2_stamps_col', 'p68b2_variant_check', 'p68b2_items_nonA', 'p68b2_invites_with_stamps']) assert.ok(sql.includes(s), s);
  assert.ok(KIND_AR.miaar_proctor_stamped); assert.equal(DEFAULT_SEVERITY.miaar_proctor_stamped, 'info');
  const engine = read('lib/miaar/engine.ts'); assert.match(engine, /frozenDraw\(db, input\.invite\.form_id, pool, token, drawOpts\?\.exclude, candidate\.email\)/); assert.match(engine, /frozenMeta\.twin \? `-\$\{frozenMeta\.variant\}` : ''/); assert.match(engine, /paper: s\.candidate\?\.frozenForm\?\.twin/);
  for (const p of ['app/api/miaar/proctor/route.ts', 'app/miaar/proctor/[code]/page.tsx', 'app/miaar/proctor/[code]/ProctorStamp.tsx']) assert.ok(has(p), p);
  const api = read('app/api/miaar/proctor/route.ts'); assert.match(api, /rateLimit\(/); assert.match(api, /crossSiteBrowserWrite\(req\)/); assert.match(api, /addStamp\(/); assert.doesNotMatch(api, /authorization/i, 'بلا دخول — الرمز الموقَّع هو الهوية');
  const staff = read('app/api/admin/miaar/frozen/route.ts'); assert.match(staff, /action === 'twin'/); assert.match(staff, /equivalenceOf\(/);
  assert.match(read('lib/portal/way.ts'), /'miaar\/proctor'/);
  const app = read('app/miaar/MiaarApp.tsx'); assert.match(app, /data-testid="mi-paper"/); assert.match(app, /\.mi-paper\.a\{background:#D4614A\}/); assert.match(app, /\.mi-paper\.b\{background:#D9A866/);
  const desk = read('app/admin/miaar/FormDesk.tsx'); for (const s of ['fm-twin-go', 'fm-paper-', 'fm-equiv', 'fm-hall', 'stamp_url', "action: 'twin'"]) assert.ok(desk.includes(s), s);
  const vf = read('app/verify/form/page.tsx'); assert.match(vf, /vf-twin/); assert.match(vf, /vf-proctoring/); assert.doesNotMatch(vf, /questionText|\.text\b/);
  assert.match(read('lib/miaar/detail.ts'), /paper: sess\.candidate\.frozenForm\.twin/); assert.match(read('app/miaar/DetailReport.tsx'), /الورقة \$\{d\.form\.paper\}/);
  const forms = read('lib/miaar/forms.ts'); assert.doesNotMatch(forms.slice(forms.indexOf('export type Stamp'), forms.indexOf('export async function addStamp')), /email|name/, 'الختم بلا أسماء');
});
