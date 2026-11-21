// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م13-ج — المستورِد (miaar-pack-1) · لوحة الإرث · المتطلّبات: البنود in_review، لا بند قائم يُمَسّ، التشغيل الجافّ لا يكتب. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePack, summarize, importPack, recentImports, normStem, PACK_VERSION, RESERVED_VERSIONS } from '../lib/miaar/pack';
import { summarizeHeritage, markHeritage, archiveUnreviewed, heritageSummary, isReviewed, HERITAGE_BATCH } from '../lib/miaar/heritage';
import { fakeDb } from './iqra-fake-db';

const mcq = (code: string, level: string, stem: string, correct = 'a', extra: Record<string, unknown> = {}) => ({ item_code: code, level, skill: 'grammar_vocab', item_type: 'mcq', question_text: stem, options: [{ id: 'a', text: `${stem} أ` }, { id: 'b', text: `${stem} ب` }, { id: 'c', text: `${stem} ج` }, { id: 'd', text: `${stem} د` }], correct, descriptor_code: `LU-${level}-01`, unit_codes: [`${level}-U01`], domain: 'personal', difficulty_est: 2, rationale: { a: 'الصواب', b: 'خطأ', c: 'خطأ', d: 'خطأ' }, ...extra });
const good = () => ({
  version: PACK_VERSION, source: 'athar-m13a-B1-1', content_version: 'athar-m13a',
  passages: [{ id: 'R-B1-M13-01', level: 'B1', skill: 'reading', title: 'إعلان', body: 'تفتح المكتبة أبوابها من الثامنة صباحًا حتى العاشرة مساءً طوال أيام الأسبوع.' }, { id: 'L-B1-M13-01', level: 'B1', skill: 'listening', title: 'حوار', body: 'ماذا تفعل في العطلة؟ أسافر مع أسرتي إلى الطائف.', audio_public_path: '/miaar/audio/L-B1-M13-01.mp3' }],
  items: [
    mcq('AR-LU-B1-M13-001', 'B1', 'لو كنت مكانك ___ العرض الأول', 'a'), mcq('AR-LU-B1-M13-002', 'B1', 'كاد الطالب ___ من التعب', 'b'), mcq('AR-LU-B1-M13-003', 'B1', 'ما زال المطر ___ منذ الصباح', 'c'), mcq('AR-LU-B1-M13-004', 'B1', 'لن ___ المشروع قبل الموعد', 'd'),
    { item_code: 'AR-RD-B1-M13-001', level: 'B1', skill: 'reading', item_type: 'true_false_notgiven', question_text: 'المكتبة مغلقة يوم الجمعة.', options: [{ id: 'a', text: 'صواب' }, { id: 'b', text: 'خطأ' }, { id: 'c', text: 'غير مذكور' }], correct: 'b', descriptor_code: 'RD-B1-02', passage_id: 'R-B1-M13-01', rationale: { a: 'النص يقول طوال الأسبوع', b: 'صحيح', c: 'مذكور صراحة' } },
    { item_code: 'AR-LI-B1-M13-001', level: 'B1', skill: 'listening', item_type: 'mcq', question_text: 'إلى أين يسافر المتحدث؟', options: [{ id: 'a', text: 'الطائف' }, { id: 'b', text: 'جدة' }, { id: 'c', text: 'الرياض' }, { id: 'd', text: 'أبها' }], correct: 'a', descriptor_code: 'LI-B1-01', passage_id: 'L-B1-M13-01', rationale: { a: 'ورد في الحوار', b: 'لم يُذكر', c: 'لم يُذكر', d: 'لم يُذكر' } },
  ],
  tasks: [{ item_code: 'AR-WR-B1-M13-001', level: 'B1', skill: 'writing', question_text: 'اكتب رسالة إلى صديقك تدعوه فيها إلى زيارة مدينتك.', task: { genre: 'message', tips_ar: ['ابدأ بالتحية'] }, descriptor_code: 'WR-B1-01' }],
});
const seedDb = () => fakeDb({
  miaar_descriptors: ['LU-B1-01', 'RD-B1-02', 'LI-B1-01', 'WR-B1-01', 'LU-A1-01'].map((code) => ({ code, level: code.split('-')[1] })),
  question_bank_items: [
    { id: 'old-1', item_code: 'AR-LU-B1-OLD', content_version: 'athar-m2a', level: 'B1', skill: 'grammar_vocab', question_text: 'لو كنتُ مكانك ___ العرضَ الأوّل؟', status: 'approved', legacy_extra: null },
    { id: 'leg-1', item_code: 'ADV-01', content_version: '1.4.0', level: 'B1', skill: 'reading', question_text: 'قديم ١', status: 'approved', legacy_extra: { batch: HERITAGE_BATCH, review_flag: 'legacy_recheck' } },
    { id: 'leg-2', item_code: 'ADV-02', content_version: '1.4.0', level: 'A1', skill: 'reading', question_text: 'قديم ٢', status: 'approved', legacy_extra: { batch: HERITAGE_BATCH, review_flag: 'legacy_recheck', duplicate_of: 'x' } },
    { id: 'leg-3', item_code: 'ADV-03', content_version: '1.4.0', level: 'A1', skill: 'listening', question_text: 'قديم ٣', status: 'in_review', legacy_extra: { batch: HERITAGE_BATCH, review_flag: 'kept' } },
  ],
  miaar_passages: [{ id: 'R-B1-EXIST', level: 'B1', skill: 'reading', title: 'موجود', body: 'نص' }],
});
const user = { id: 'staff-1' };

test('م13-ج: normStem — بلا تشكيل ولا ترقيم، همزات موحَّدة، فراغات مضغوطة', () => {
  assert.equal(normStem('لو كنتُ مكانك ___ العرضَ الأوّل؟'), normStem('لو كنت مكانك العرض الاول'));
  assert.notEqual(normStem('ذهب إلى المدرسة'), normStem('ذهبت إلى المدرسة'));
});

test('م13-ج: normalizePack — الحزمة الصالحة تمرّ · الملخّص بالمستوى والنوع · تحذيرات غير مانعة (تشكيل B1 · مبرّر ناقص)', () => {
  const n = normalizePack(good()); assert.ok(n.ok, JSON.stringify((n as any).problems));
  if (!n.ok) return;
  assert.equal(n.pack.items.length, 6); assert.equal(n.pack.tasks.length, 1); assert.equal(n.pack.passages.length, 2);
  const s = summarize(n.pack, n.warnings); assert.equal(s.by_level.B1, 7); assert.equal(s.by_type.mcq, 5); assert.equal(s.by_type.true_false_notgiven, 1); assert.equal(s.by_type.writing_task, 1);
  assert.ok(n.pack.items[0].unit_codes.includes('B1-U01')); assert.equal(n.pack.items[4].passage_id, 'R-B1-M13-01');
  const raw = good(); raw.items[0].question_text = 'لَوْ كُنْتُ مَكانَكَ'; const w = normalizePack(raw); assert.ok(w.ok); assert.ok(w.warnings.some((x) => /مشكول/.test(x.msg)), 'تشكيل في B1 → تحذير');
});

test('م13-ج: normalizePack — الرفض: إصدار خاطئ · دفعة محجوزة · نوع غير مدعوم (م13-ب) · مفتاح لا يطابق · واصف من مستوى آخر · وحدة من مستوى آخر · استماع بلا مقطع · رمز مكرّر · جذع مكرّر · بلا بنود', () => {
  const bad = (mut: (p: any) => void, re: RegExp) => { const p = good(); mut(p); const n = normalizePack(p); assert.ok(!n.ok, `كان يجب الرفض: ${re}`); assert.ok(n.problems.some((x) => re.test(x.msg)), `${re} — ${JSON.stringify(n.problems)}`); };
  bad((p) => { p.version = 'miaar-pack-0'; }, /الإصدار/);
  for (const v of RESERVED_VERSIONS) bad((p) => { p.content_version = v; }, /محجوزة/);
  bad((p) => { p.content_version = 'M13'; }, /athar-xxx/);
  bad((p) => { p.items[0].item_type = 'cloze_bank'; }, /م13-ب/);
  bad((p) => { p.items[0].correct = 'e'; }, /المفتاح/);
  bad((p) => { p.items[0].descriptor_code = 'LU-A1-01'; }, /مستوى آخر/);
  bad((p) => { p.items[0].descriptor_code = 'RD-B1-01'; }, /لا يناسب/);
  bad((p) => { p.items[0].unit_codes = ['A1-U01']; }, /مستوى آخر/);
  bad((p) => { p.items[5].passage_id = null; }, /يحتاج مقطعًا/);
  bad((p) => { p.items[1].item_code = p.items[0].item_code; }, /رمز مكرّر/);
  bad((p) => { p.items[1].question_text = p.items[0].question_text + '؟'; }, /جذع مكرّر/);
  bad((p) => { p.items = []; p.tasks = []; }, /بلا بنود/);
  bad((p) => { p.items[0].options = p.items[0].options.slice(0, 3); }, /الخيارات/);
  bad((p) => { p.tasks[0].task = { genre: 'Bad Genre' }; }, /genre/);
  bad((p) => { p.passages[0].level = 'A2'; }, /من مستوى آخر/);
});

test('م13-ج: الإنصاف — مفتاح واحد في أكثر من 40% أو mcq فوق 60% → تحذير لا رفض', () => {
  const p = good(); p.items = Array.from({ length: 10 }, (_, i) => mcq(`AR-LU-B1-M13-${String(i + 1).padStart(3, '0')}`, 'B1', `جذع رقم ${i + 1} مختلف`, 'a'));
  const n = normalizePack(p); assert.ok(n.ok); assert.ok(n.warnings.some((w) => /المفتاح «a»/.test(w.msg))); assert.ok(n.warnings.some((w) => /حصّة mcq/.test(w.msg)));
});

test('م13-ج: importPack — التشغيل الجافّ يفحص ضدّ القاعدة (رمز موجود · واصف مجهول · مقطع مجهول · تكرار الجذع) ولا يكتب شيئًا', async () => {
  const db = seedDb(); const p = good(); p.items.push(mcq('AR-LU-B1-M13-009', 'B1', 'بند بواصف مجهول', 'a', { descriptor_code: 'LU-B1-09' }));
  p.items.push({ ...p.items[4], item_code: 'AR-RD-B1-M13-002', question_text: 'سؤال آخر عن الإعلان', passage_id: 'R-B1-NOPE' });
  p.items.push({ ...p.items[4], item_code: 'AR-RD-B1-M13-003', question_text: 'سؤال ثالث عن الإعلان', passage_id: 'R-B1-EXIST' });
  db.T.question_bank_items.push({ id: 'ex-1', item_code: 'AR-LU-B1-M13-002', content_version: 'athar-m13a', level: 'B1', skill: 'grammar_vocab', question_text: 'موجود من قبل', status: 'in_review' });
  const n = normalizePack(p); assert.ok(n.ok, JSON.stringify((n as any).problems)); if (!n.ok) return;
  const before = JSON.stringify(db.T);
  const r = await importPack(db, n.pack, user, { dryRun: true });
  assert.equal(r.dry_run, true); assert.equal(r.batch_id, null);
  assert.deepEqual(r.skipped_existing, ['AR-LU-B1-M13-002']);
  assert.deepEqual(r.descriptors_unknown, ['LU-B1-09']);
  assert.ok(r.rejected.some((x) => x.item_code === 'AR-LU-B1-M13-009' && x.field === 'descriptor_code'));
  assert.ok(r.rejected.some((x) => x.item_code === 'AR-RD-B1-M13-002' && x.field === 'passage_id'));
  assert.ok(!r.rejected.some((x) => x.item_code === 'AR-RD-B1-M13-003'), 'مقطع موجود في القاعدة يكفي');
  assert.deepEqual(r.possible_duplicates, [{ item_code: 'AR-LU-B1-M13-001', of: 'AR-LU-B1-OLD' }]);
  assert.equal(r.items_created, 6); assert.equal(r.tasks_created, 1); assert.equal(r.passages_created, 2);
  assert.equal(JSON.stringify(db.T), before, 'الجافّ لا يكتب');
});

test('م13-ج: importPack — الإدخال: سجلّ دفعة مكتمل · أخطاء مسجَّلة · مقاطع جديدة فقط · بنود in_review بمفاتيح وأحداث · unit_codes · التكرار المحتمل في author_notes · إعادة الاستيراد تتخطّى الموجود', async () => {
  const db = seedDb(); const p = good(); p.items.push(mcq('AR-LU-B1-M13-009', 'B1', 'بند بواصف مجهول', 'a', { descriptor_code: 'LU-B1-09' })); p.passages.push({ id: 'R-B1-EXIST', level: 'B1', skill: 'reading', title: 'سيُتجاهل', body: 'نص آخر' });
  const n = normalizePack(p); assert.ok(n.ok, JSON.stringify((n as any).problems)); if (!n.ok) return;
  const r = await importPack(db, n.pack, user, { fileName: 'b1-1.json' });
  assert.ok(r.batch_id); assert.equal(r.items_created, 6); assert.equal(r.tasks_created, 1); assert.equal(r.passages_created, 2); assert.deepEqual(r.passages_existing, ['R-B1-EXIST']);
  const batch = db.T.question_bank_import_batches[0]; assert.equal(batch.status, 'completed'); assert.equal(batch.imported_rows, 7); assert.equal(batch.rejected_rows, 1); assert.equal(batch.initial_status, 'in_review'); assert.equal(batch.file_name, 'b1-1.json');
  assert.equal(db.T.question_bank_import_errors.length, 1); assert.equal(db.T.question_bank_import_errors[0].item_code, 'AR-LU-B1-M13-009');
  assert.equal(db.T.miaar_passages.find((x: any) => x.id === 'R-B1-EXIST').title, 'موجود', 'المقطع القائم لا يُمَسّ');
  const newItems = db.T.question_bank_items.filter((x: any) => x.content_version === 'athar-m13a');
  assert.equal(newItems.length, 7); assert.ok(newItems.every((x: any) => x.status === 'in_review' && x.source_kind === 'imported' && x.import_batch_id === r.batch_id && x.created_by === 'staff-1'));
  const first = newItems.find((x: any) => x.item_code === 'AR-LU-B1-M13-001'); assert.deepEqual(first.unit_codes, ['B1-U01']); assert.equal(first.author_notes.possible_duplicate_of, 'AR-LU-B1-OLD'); assert.equal(first.author_notes.options.a, 'الصواب');
  const li = newItems.find((x: any) => x.item_code === 'AR-LI-B1-M13-001'); assert.equal(li.passage_id, 'L-B1-M13-01');
  const wr = newItems.find((x: any) => x.item_code === 'AR-WR-B1-M13-001'); assert.equal(wr.item_type, 'writing_task'); assert.equal(wr.task.genre, 'message'); assert.equal(typeof wr.task.min_words, 'number');
  assert.equal(db.T.question_bank_answer_keys.length, 6); assert.equal(db.T.question_bank_review_events.length, 7);
  assert.ok(db.T.question_bank_items.find((x: any) => x.id === 'old-1').status === 'approved', 'البند القديم كما هو');
  const again = await importPack(db, n.pack, user); assert.equal(again.items_created, 0); assert.equal(again.tasks_created, 0); assert.equal(again.skipped_existing.length, 7); assert.equal(again.passages_created, 0);
  const list = await recentImports(db); assert.equal(list.length, 2); assert.equal(list[0].content_version, 'athar-m13a');
});

test('م13-ج: لوحة الإرث — العدّاد «رُوجع x/y» بالمستوى · المكرّرات · heritage_mark يضع العلم (retired → archived) · أرشفة ما لم يُراجَع تترك المراجَع', async () => {
  const db = seedDb();
  const s0 = await heritageSummary(db); assert.equal(s0.total, 3); assert.equal(s0.reviewed, 1); assert.equal(s0.pending, 2); assert.equal(s0.dupes, 1); assert.equal(s0.by_outcome.legacy_recheck, 2); assert.equal(s0.by_outcome.kept, 1);
  assert.deepEqual(s0.levels.map((l) => [l.level, l.total, l.pending]), [['A1', 2, 1], ['B1', 1, 1]]);
  assert.equal(isReviewed({ legacy_extra: {} }), false); assert.equal(isReviewed({ legacy_extra: { review_flag: 'upgraded' } }), true);
  const m = await markHeritage(db, ['leg-1', 'old-1'], 'retired', user, 'نسخة أضعف'); assert.ok(m.ok && m.count === 1, 'old-1 ليس من التأسيسية');
  const leg1 = db.T.question_bank_items.find((x: any) => x.id === 'leg-1'); assert.equal(leg1.status, 'archived'); assert.equal(leg1.legacy_extra.review_flag, 'retired'); assert.equal(leg1.legacy_extra.batch, HERITAGE_BATCH);
  const k = await markHeritage(db, ['leg-2'], 'kept', user, ''); assert.ok(k.ok); assert.equal(db.T.question_bank_items.find((x: any) => x.id === 'leg-2').status, 'approved', 'kept لا يغيّر الحالة');
  const none = await markHeritage(db, ['old-1'], 'kept', user, ''); assert.ok(!none.ok);
  const bad = await markHeritage(db, [], 'kept', user, ''); assert.ok(!bad.ok);
  db.T.question_bank_items.push({ id: 'leg-4', item_code: 'ADV-04', content_version: '1.4.0', level: 'C1', skill: 'reading', question_text: 'قديم ٤', status: 'approved', legacy_extra: { batch: HERITAGE_BATCH, review_flag: 'legacy_recheck' } });
  const a = await archiveUnreviewed(db, user, ''); assert.ok(a.ok && a.count === 1);
  assert.equal(db.T.question_bank_items.find((x: any) => x.id === 'leg-4').status, 'archived'); assert.equal(db.T.question_bank_items.find((x: any) => x.id === 'leg-2').status, 'approved'); assert.equal(db.T.question_bank_items.find((x: any) => x.id === 'leg-3').status, 'in_review');
  const s1 = summarizeHeritage(db.T.question_bank_items.filter((x: any) => x.legacy_extra?.batch === HERITAGE_BATCH)); assert.equal(s1.pending, 0); assert.equal(s1.reviewed, 4);
  assert.equal((await archiveUnreviewed(db, user, '')).ok, true);
});
