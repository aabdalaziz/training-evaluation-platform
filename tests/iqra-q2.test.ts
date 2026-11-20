// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «اقْرَأْ» ق٢ — «العَتَبة» عبر اختبار نهاية المستوى المعياري (مِعيار «عُبور») · طابور «أُنتج» · التقاط الترقية · النسيان.
 *  الدورة كاملة على قاعدة مصطنعة: building → (ساعات+إتقان) early/ready → requested → invited (دعوة شخصية) → sat → passed → promoted (A1 مغلق بتقدّمه، A2 مفتوح).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IQRA_LIMITS, THRESHOLD_STATUSES, THRESHOLD_LIVE, THRESHOLD_STATUS_AR, PRODUCE_RUBRIC, RUBRIC_AR, HOURS_TARGET } from '../lib/iqra/registry';
import { normalizePack } from '../lib/iqra/content';
import { importPack, setLessonStatus, learnerHome, logTime, finishLesson, answerItem, lessonView, saveProduce, forgetLearner, libraryList } from '../lib/iqra/store';
import { examFacts, thresholdView, requestThreshold, cancelThreshold, syncFromReport, adminThresholds, acceptThreshold, deferThreshold, sendProduce, withdrawProduce, produceReviews, adminProduce, reviewProduce, crossedCard } from '../lib/iqra/q2';
import { REGISTRY } from '../lib/vault/registry';
import { unitLevel } from '../lib/iqra/content';
import { fakeDb } from './iqra-fake-db';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PACK2 = JSON.parse(read('tools/iqra/packs/iqra-pack-2-fixture.json'));
const STAFF = { email: 'admin@athar-portal.com', id: 'u1', role: 'ADMIN' };
const UNIT = (code: string) => ({ code, level: unitLevel(code), idx: Number(code.slice(-2)), title_ar: `منزلة ${code}`, title_en: code, focus_ar: 'تركيز', domains: ['personal'], descriptor_codes: [], status: 'approved' });
const EMAIL = 'l@x.sa'; const BP = '11111111-1111-4111-8111-111111111111'; const INV_G = '22222222-2222-4222-8222-222222222222';
async function seeded() {
  const db = fakeDb({ miaar_syllabus_units: ['A1-U01', 'A1-U02', 'A1-U03', 'A1-U04', 'A1-U05', 'A1-U06', 'A1-U07', 'A1-U08', 'A2-U01'].map(UNIT), question_bank_blueprints: [{ id: BP, code: 'SYS-EXIT-A1', status: 'active' }] });
  const n = normalizePack(PACK2); assert.ok(n.ok); await importPack(db, n.pack, STAFF, 'b');
  for (const l of db.T.iqra_lessons) { const r = await setLessonStatus(db, l.id, 'approved', STAFF, null); assert.ok(r.ok); }
  db.T.iqra_enrolments.push({ id: 'e1', learner_email: EMAIL, user_id: null, level: 'A1', source: 'placement', report_id: 'rep-0', active: true, created_at: new Date(Date.now() - 30 * 86400e3).toISOString() });
  const e = db.T.iqra_enrolments[0];
  return { db, e };
}
/** يُتمّ كلّ الحلقات المعتمدة (إتقان 100%) */
async function masterAll(db: any, e: any) {
  for (const l of db.T.iqra_lessons) {
    const v = await lessonView(db, e, l.id); for (const ex of v!.مِران) { const key = db.T.question_bank_answer_keys.find((k: any) => k.item_id === ex.id); const row = db.T.question_bank_items.find((i: any) => i.id === ex.id); const a = row.item_type === 'mcq' ? { option: key.correct_option_id } : key.accepted?.pairs ? { pairs: key.accepted.pairs } : key.accepted?.order ? { order: key.accepted.order } : key.accepted?.gaps ? { gaps: key.accepted.gaps } : key.accepted?.word ? { word: key.accepted.word } : key.accepted?.text ? { text: key.accepted.text } : { option: key.correct_option_id }; await answerItem(db, e, { lesson_id: l.id, item_id: ex.id, answer: a as any }); }
    const f = await finishLesson(db, e, l.id); assert.ok(f.ok);
  }
}
/** يضيف ساعات مقيسة بأيام متفرّقة */
async function addHours(db: any, e: any, hours: number) { const days = Math.ceil(hours / 5); for (let d = 0; d < days; d += 1) { const when = new Date(Date.now() - d * 86400e3); const sec = Math.min(5, hours - d * 5) * 3600; db.T.iqra_time_log.push({ id: `t${d}`, learner_email: e.learner_email, level: e.level, day: when.toISOString().slice(0, 10), activity: 'lesson', seconds: sec }); } }

test('ق٢ — السجلّ: الحالات والسلّم التحليلي والحدود · حقائق الاختبار من مواصفات «عُبور» نفسها · الخزانة', () => {
  assert.deepEqual([...THRESHOLD_STATUSES], ['requested', 'deferred', 'invited', 'sat', 'passed', 'failed', 'promoted', 'cancelled']);
  assert.deepEqual([...THRESHOLD_LIVE], ['requested', 'deferred', 'invited', 'sat', 'passed']); for (const s of THRESHOLD_STATUSES) assert.ok(THRESHOLD_STATUS_AR[s]);
  assert.deepEqual([...PRODUCE_RUBRIC], ['content', 'organisation', 'vocabulary', 'accuracy']); for (const d of PRODUCE_RUBRIC) assert.equal(RUBRIC_AR[d].bands_ar.length, 4);
  assert.equal(IQRA_LIMITS.produce_per_week, 2); assert.equal(IQRA_LIMITS.produce_min_words, 20); assert.equal(IQRA_LIMITS.offline_units_max, 2);
  const f = examFacts('A1')!; assert.equal(f.official_ar, 'اختبار نهاية المستوى — معياري (CEFR)'); assert.equal(f.minutes, 60); assert.equal(f.cut, 60); assert.equal(f.skill_min, 50); assert.equal(f.retake_days, 7); assert.equal(f.counts.listening + f.counts.reading + f.counts.grammar_vocab, 35);
  assert.equal(examFacts('PRE_A1'), null, 'التمهيدي بلا اختبار نهاية مستوى'); assert.equal(examFacts('C2'), null);
  for (const t of ['iqra_threshold_requests', 'iqra_produce_reviews']) { const r = REGISTRY.find((x) => x.table === t)!; assert.ok(r, t); assert.equal(r.policy, 'delete'); assert.equal(r.emailCol, 'learner_email'); }
});

test('ق٢ — الأهلية: building يرفض الطلب · بعد 70% ساعات + إتقان 90% يُفتح المبكّر · بعد 100% + إتقان كامل ready · طلب حيّ واحد · السحب', async () => {
  const { db, e } = await seeded();
  let v = await thresholdView(db, e); assert.equal(v.state, 'building'); assert.equal(v.eligible, false); assert.equal(v.reason, 'building'); assert.equal(v.next_label, 'مبتدئ · A2'); assert.ok(v.copy.what.includes('CEFR'));
  let r = await requestThreshold(db, e); assert.equal(r.ok, false); assert.equal((r as any).error, 'not_ready');
  await masterAll(db, e); await addHours(db, e, 72);
  v = await thresholdView(db, e); assert.equal(v.state, 'early'); assert.equal(v.gate, 'early'); assert.equal(v.eligible, true);
  r = await requestThreshold(db, e); assert.ok(r.ok); assert.equal((r as any).request.gate, 'early'); assert.equal((r as any).request.hours_at, 72); assert.equal((r as any).request.mastery_at, 100);
  const dup = await requestThreshold(db, e); assert.equal(dup.ok, false); assert.equal((dup as any).error, 'already_requested');
  const home = await learnerHome(db, e); assert.equal(home.العَتَبة.request?.status, 'requested'); assert.equal(home.العَتَبة.request?.status_ar, 'طلبٌ بانتظار الطاقم');
  const c = await cancelThreshold(db, e, (r as any).request.id); assert.ok(c.ok); assert.equal((await thresholdView(db, e)).request?.status, 'cancelled');
  await addHours(db, e, 40); v = await thresholdView(db, e); assert.equal(v.state, 'ready'); assert.equal(v.gate, 'full');
  const r2 = await requestThreshold(db, e); assert.ok(r2.ok); assert.equal((r2 as any).request.gate, 'full');
});

test('ق٢ — الطاقم: تأجيل بسبب يراه المتعلّم · قبول = دعوة «عُبور» شخصية (level_exit · SYS-EXIT-A1 · 30 يومًا) + إشعار · الرابط يصل المتعلّم', async () => {
  const { db, e } = await seeded(); await masterAll(db, e); await addHours(db, e, 100);
  const r = await requestThreshold(db, e); assert.ok(r.ok); const id = (r as any).request.id;
  let d = await deferThreshold(db, id, '', STAFF); assert.equal(d.ok, false); assert.equal((d as any).error, 'note_required');
  d = await deferThreshold(db, id, 'أكمل حلقة الكتابة في المنزلة 7 أوّلًا', STAFF); assert.ok(d.ok);
  let v = await thresholdView(db, e); assert.equal(v.request?.status, 'deferred'); assert.ok(v.request?.defer_note?.includes('المنزلة 7'));
  const dup = await requestThreshold(db, e); assert.equal(dup.ok, false, 'المؤجَّل طلب حيّ');
  const a = await acceptThreshold(db, id, STAFF, 'https://athar-portal.com'); assert.ok(a.ok, JSON.stringify(a));
  assert.match((a as any).url, /\/miaar\/d\/[A-Z0-9]{8}\?t=/, 'رابط شخصي برمز لمرّة واحدة');
  const inv = db.T.placement_invites[0]; assert.equal(inv.kind, 'personal'); assert.equal(inv.purpose, 'level_exit'); assert.equal(inv.level_target, 'A1'); assert.equal(inv.blueprint_id, BP); assert.equal(inv.reuse_key, `iqra:${id}`); assert.ok(inv.label_ar.startsWith('عَتَبة اقْرَأْ'));
  assert.ok(Date.parse(inv.expires_at) - Date.now() > 29 * 86400e3);
  assert.equal(db.T.placement_invite_recipients.length, 1); assert.equal(db.T.placement_invite_recipients[0].email, EMAIL);
  v = await thresholdView(db, e); assert.equal(v.request?.status, 'invited'); assert.ok(v.request?.invite_url?.startsWith('/miaar/d/')); assert.ok(v.request?.invite_url?.includes('?t='));
  assert.ok(db.T.portal_learner_notices.some((x: any) => x.kind === 'iqra_threshold' && x.title_ar === 'طلب العَتَبة: ليس بعد')); assert.ok(db.T.portal_learner_notices.some((x: any) => x.kind === 'iqra_threshold' && x.title_ar.includes('دعوتك')));
  const again = await acceptThreshold(db, id, STAFF, 'https://athar-portal.com'); assert.equal(again.ok, false); assert.equal((again as any).error, 'not_pending');
  const board = await adminThresholds(db); assert.equal(board.live.length, 1); assert.equal(board.live[0].status, 'invited'); assert.equal(board.live[0].target, HOURS_TARGET.A1); assert.equal(board.stats.early, null, 'k<5 يُحجب');
});

test('ق٢ — الالتقاط: تقرير بلا حكم = sat · حكم نهائي failed · حكم passed بلا قرار = passed · قرار معتمد A2 = promoted (A1 مغلق بتقدّمه · A2 مفتوح · بطاقة «عبرتُ» · مكتبة A1 تبقى)', async () => {
  const { db, e } = await seeded(); await masterAll(db, e); await addHours(db, e, 100);
  const r = await requestThreshold(db, e); assert.ok(r.ok); const id = (r as any).request.id; const a = await acceptThreshold(db, id, STAFF, 'https://x'); assert.ok(a.ok);
  const inviteId = db.T.placement_invites[0].id;
  db.T.placement_reports.push({ id: 'rep-1', candidate_email: EMAIL.toUpperCase(), invite_id: inviteId, report: {}, created_at: new Date().toISOString() });
  let v = await thresholdView(db, e); assert.equal(v.request?.status, 'sat'); assert.equal(v.request?.report_id, 'rep-1');
  db.T.placement_reports[0].report = { exit: { الحالة: 'final', النتيجة: 'failed', الكلي: 48 } };
  v = await thresholdView(db, e); assert.equal(v.request?.status, 'failed'); assert.equal(v.request?.exit_total, 48);
  /* يطلب من جديد بعد الإخفاق */
  const r2 = await requestThreshold(db, e); assert.ok(r2.ok); const id2 = (r2 as any).request.id; const a2 = await acceptThreshold(db, id2, STAFF, 'https://x'); assert.ok(a2.ok); const inv2 = db.T.placement_invites[1].id;
  db.T.placement_reports.push({ id: 'rep-2', candidate_email: EMAIL, invite_id: inv2, report: { exit: { الحالة: 'final', النتيجة: 'passed', الكلي: 71 } }, created_at: new Date().toISOString() });
  v = await thresholdView(db, e); assert.equal(v.request?.status, 'passed'); assert.equal(v.request?.exit_total, 71);
  assert.equal(db.T.iqra_enrolments.filter((x: any) => x.active).length, 1); assert.equal(db.T.iqra_enrolments.find((x: any) => x.active).level, 'A1', 'يبقى في A1 حتى يعتمد الطاقم الترقية');
  /* الطاقم يرقّي من لوحة «عُبور» (قرار معتمد A2 على التقرير) */
  db.T.placement_decisions.push({ report_id: 'rep-2', assigned_level: 'A2', decision_status: 'approved', decided_at: new Date().toISOString() });
  const home = await learnerHome(db, e); assert.equal(home.العَتَبة.request?.status, 'promoted', 'الالتقاط يتمّ عند فتح البيت');
  const act = db.T.iqra_enrolments.filter((x: any) => x.active); assert.equal(act.length, 1); assert.equal(act[0].level, 'A2'); assert.equal(act[0].source, 'threshold'); assert.equal(act[0].report_id, 'rep-2');
  const old = db.T.iqra_enrolments.find((x: any) => x.id === 'e1'); assert.equal(old.active, false); assert.equal(old.closed_reason, 'threshold'); assert.ok(old.closed_at);
  assert.ok(db.T.iqra_progress.length > 0, 'التقدّم لا يُمسّ');
  const req = db.T.iqra_threshold_requests.find((x: any) => x.id === id2); assert.equal(req.status, 'promoted');
  assert.ok(db.T.portal_learner_notices.some((x: any) => x.dedupe_key === `iqra_promoted:${id2}`));
  const e2 = act[0]; const card = await crossedCard(db, e2); assert.ok(card); assert.equal(card!.from, 'مكتشف · A1'); assert.equal(card!.to, 'مبتدئ · A2'); assert.ok(card!.hours >= 100); assert.equal(card!.exit_total, 71); assert.equal(card!.gate, 'full');
  const home2 = await learnerHome(db, e2); assert.ok(home2.عبرتُ); assert.equal(home2.فارغ, true, 'A2 بلا حلقات بعد'); assert.equal(home2.العَتَبة.request, null, 'لم يبق طلب حيّ');
  db.T.iqra_library.push({ id: 'lib1', code: 'A1-U01-R01', unit_code: 'A1-U01', level: 'A1', kind: 'read', title_ar: 'نصّ', minutes: 25, status: 'approved', questions: [] });
  const lib = await libraryList(db, e2); assert.equal(lib.نصوص.length, 1); assert.equal(lib.نصوص[0].سابق, true, 'مكتبة المستوى السابق تبقى مفتوحة للعابر');
});

test('ق٢ — الالتقاط لا يرقّي إلا بقرار بمستوى مختلف · قرار معتمد بالمستوى نفسه يبقى passed', async () => {
  const { db, e } = await seeded(); await masterAll(db, e); await addHours(db, e, 100);
  const r = await requestThreshold(db, e); assert.ok(r.ok); const a = await acceptThreshold(db, (r as any).request.id, STAFF, 'https://x'); assert.ok(a.ok);
  db.T.placement_reports.push({ id: 'rep-9', candidate_email: EMAIL, invite_id: db.T.placement_invites[0].id, report: { exit: { الحالة: 'final', النتيجة: 'passed', الكلي: 66 } }, created_at: new Date().toISOString() });
  db.T.placement_decisions.push({ report_id: 'rep-9', assigned_level: 'A1', decision_status: 'approved' });
  const s = await syncFromReport(db, db.T.iqra_threshold_requests[0]); assert.equal(s.status, 'passed');
  const dup = await requestThreshold(db, e); assert.equal((dup as any).error, 'already_requested', 'المجتاز بانتظار الاعتماد لا يطلب من جديد');
  assert.equal(db.T.iqra_enrolments.find((x: any) => x.active).level, 'A1');
});

test('ق٢ — القبول بضمّ إلى دعوة مستوى مفتوحة: يجب أن تكون جماعية · level_exit · للمستوى نفسه', async () => {
  const { db, e } = await seeded(); await masterAll(db, e); await addHours(db, e, 100);
  const r = await requestThreshold(db, e); assert.ok(r.ok); const id = (r as any).request.id;
  db.T.placement_invites.push({ id: INV_G, code: 'ABCD2345', kind: 'group', purpose: 'level_exit', level_target: 'A2', status: 'open', label_ar: 'قاعة' });
  let a = await acceptThreshold(db, id, STAFF, 'https://x', { invite_id: INV_G }); assert.equal(a.ok, false); assert.equal((a as any).error, 'invite_mismatch');
  db.T.placement_invites[0].level_target = 'A1'; a = await acceptThreshold(db, id, STAFF, 'https://x', { invite_id: INV_G }); assert.ok(a.ok); assert.equal((a as any).url, '/miaar/d/ABCD2345');
  assert.equal(db.T.placement_invites.length, 1, 'لم تُنشأ دعوة جديدة');
  const board = await adminThresholds(db); assert.equal(board.open_invites.length, 1);
});

test('ق٢ — التمهيدي والمتقن: لا طلب (لا اختبار نهاية مستوى / لا مستوى تالٍ)', async () => {
  const { db } = await seeded();
  const pre = { id: 'e9', learner_email: 'p@x.sa', user_id: null, level: 'PRE_A1' as any, source: 'manual', report_id: null, active: true, created_at: new Date().toISOString() };
  const v = await thresholdView(db, pre); assert.equal(v.eligible, false); assert.equal(v.reason, 'no_exam'); assert.ok(v.copy.pre_a1);
  const r = await requestThreshold(db, pre); assert.equal(r.ok, false); assert.equal((r as any).error, 'no_exam');
  const top = { ...pre, level: 'C2' as any }; const r2 = await requestThreshold(db, top); assert.equal((r2 as any).error, 'top_level');
});

test('ق٢ — طابور «أُنتج»: احفظ أوّلًا · ≥20 كلمة · واحد في الطابور للحلقة · نصّان في الأسبوع · السحب · المراجعة بالسلّم الرباعي + إشعار · ما يراه المتعلّم', async () => {
  const { db, e } = await seeded(); const lessons = db.T.iqra_lessons.filter((l: any) => l.content?.produce?.kind === 'write'); assert.ok(lessons.length >= 1);
  const L = lessons[0];
  let s = await sendProduce(db, e, L.id); assert.equal(s.ok, false); assert.equal((s as any).error, 'save_first');
  await saveProduce(db, e, { lesson_id: L.id, text: 'أنا أحمد من جدة', checked: [true] }); s = await sendProduce(db, e, L.id); assert.equal((s as any).error, 'too_short');
  const text = Array.from({ length: 24 }, (_, i) => (i % 2 ? 'كلمة' : 'جملة')).join(' ');
  await saveProduce(db, e, { lesson_id: L.id, text, checked: [true, false] }); s = await sendProduce(db, e, L.id); assert.ok(s.ok, JSON.stringify(s)); assert.equal((s as any).eta_ar, 'خلال أسبوع');
  const dup = await sendProduce(db, e, L.id); assert.equal((dup as any).error, 'already_queued');
  let mine = await produceReviews(db, e); assert.equal(mine.ردود.length, 1); assert.equal(mine.ردود[0].status, 'queued'); assert.equal(mine.left_this_week, 1);
  /* السحب ثم الإرسال من جديد */
  const w = await withdrawProduce(db, e, (s as any).id); assert.ok(w.ok); s = await sendProduce(db, e, L.id); assert.ok(s.ok);
  /* الحدّ الأسبوعي: الثاني يمرّ إن كانت حلقة أخرى، الثالث يُرفض */
  if (lessons[1]) { await saveProduce(db, e, { lesson_id: lessons[1].id, text, checked: [] }); const s2 = await sendProduce(db, e, lessons[1].id); assert.ok(s2.ok); }
  else db.T.iqra_produce_reviews.push({ id: 'x', learner_email: EMAIL, lesson_id: 'other', level: 'A1', status: 'queued', text, words: 24, created_at: new Date().toISOString() });
  if (lessons[2]) { await saveProduce(db, e, { lesson_id: lessons[2].id, text, checked: [] }); const s3 = await sendProduce(db, e, lessons[2].id); assert.equal((s3 as any).error, 'weekly_limit'); }
  mine = await produceReviews(db, e); assert.equal(mine.left_this_week, 0);
  /* الطاقم */
  const q = await adminProduce(db, 'queue'); assert.ok(q.depth >= 2); assert.ok(q.rows[0].lesson?.prompt_ar !== undefined); assert.equal(q.rows[0].learner_email, EMAIL);
  const id = q.rows.find((r: any) => r.lesson_id === L.id)!.id;
  let rv = await reviewProduce(db, id, STAFF, { rubric: { content: 3, organisation: 2, vocabulary: 5, accuracy: 3 }, comment: 'x', rewritten: '' }); assert.equal(rv.ok, false); assert.equal((rv as any).error, 'rubric_vocabulary');
  rv = await reviewProduce(db, id, STAFF, { rubric: { content: 3, organisation: 2, vocabulary: 3, accuracy: 4 }, comment: '', rewritten: '' }); assert.equal((rv as any).error, 'comment_required');
  rv = await reviewProduce(db, id, STAFF, { rubric: { content: 3, organisation: 2, vocabulary: 3, accuracy: 4 }, comment: 'نصّ واضح؛ اربط الجمل بـ«و» و«ثمّ».', rewritten: 'أنا أحمد، وأنا من جدة.' }); assert.ok(rv.ok); assert.equal((rv as any).score, 3);
  const again = await reviewProduce(db, id, STAFF, { rubric: { content: 1, organisation: 1, vocabulary: 1, accuracy: 1 }, comment: 'x' , rewritten: '' }); assert.equal((again as any).error, 'not_queued');
  mine = await produceReviews(db, e, L.id); const rr = mine.ردود[0]; assert.equal(rr.status, 'reviewed'); assert.equal(rr.score, 3); assert.equal(rr.rubric!.content.band_ar, 'أنجزها مع نقص يسير'); assert.equal(rr.rewritten, 'أنا أحمد، وأنا من جدة.');
  assert.ok(db.T.portal_learner_notices.some((x: any) => x.kind === 'iqra_produce' && x.title_ar.includes('3 من 4')));
  const done = await adminProduce(db, 'done'); assert.equal(done.rows.length, 1);
  /* درجات «أُنتج» تُلحق بطلب العَتَبة بيّنةً */
  await masterAll(db, e); await addHours(db, e, 100); const r = await requestThreshold(db, e); assert.ok(r.ok); assert.deepEqual((r as any).request.produce_scores, [3]);
});

test('ق٢ — النسيان: حذف المتعلّم يمسح طلبات العَتَبة ونصوص «أُنتج» معه', async () => {
  const { db, e } = await seeded(); await masterAll(db, e); await addHours(db, e, 100); const r = await requestThreshold(db, e); assert.ok(r.ok);
  db.T.iqra_produce_reviews.push({ id: 'p1', learner_email: EMAIL, lesson_id: 'l', level: 'A1', status: 'queued', text: 't', words: 20, created_at: new Date().toISOString() });
  db.T.iqra_produce_reviews.push({ id: 'p2', learner_email: 'other@x.sa', lesson_id: 'l', level: 'A1', status: 'queued', text: 't', words: 20, created_at: new Date().toISOString() });
  await forgetLearner(db, EMAIL);
  assert.equal(db.T.iqra_threshold_requests.length, 0); assert.equal(db.T.iqra_produce_reviews.length, 1); assert.equal(db.T.iqra_produce_reviews[0].learner_email, 'other@x.sa'); assert.equal(db.T.iqra_enrolments.length, 0);
});

test('ق٢ — SQL: جدولان بفهرس «طلب حيّ واحد» وأعمدة الإغلاق · لا مساس بجداول مِعيار', () => {
  const sql = fs.readFileSync(path.join(ROOT, '..', '..', 'dashboard-redesign', 'phase92-iqra-q2', 'supabase', 'iqra-q2.sql'), 'utf8');
  assert.ok(sql.includes('create table if not exists public.iqra_threshold_requests')); assert.ok(sql.includes('create table if not exists public.iqra_produce_reviews'));
  assert.ok(sql.includes("where status in ('requested','deferred','invited','sat','passed')")); assert.ok(sql.includes('closed_reason')); assert.ok(sql.includes('invite_url'));
  assert.ok(!/alter table public\.(placement_|miaar_)/.test(sql)); assert.ok(!/create table if not exists public\.(placement_|miaar_)/.test(sql));
  for (const t of ['iqra_threshold_requests', 'iqra_produce_reviews']) { assert.ok(sql.includes(`alter table public.${t} enable row level security`)); assert.ok(sql.includes(`revoke all on public.${t} from anon, authenticated`)); }
});

test('ق٢ د٣ — «المَنزِلة في جيبي»: عامل الخدمة v3 يحفظ مخازن athar-iqra ويخدم الصوت والحلقات بلا اتصال · العميل: سقف مَنزِلتين · صندوق الصادر يقبل أفعال الحلقة فقط · الواجهة تحمل الزرّ والشارة', async () => {
  const sw = read('public/sw.js');
  assert.ok(sw.includes("const VERSION = 'athar-sw-v3'") && sw.includes("IQRA_PREFIX = 'athar-iqra:'"), 'v3 + بادئة الجيب');
  assert.ok(sw.includes('!k.startsWith(IQRA_PREFIX)'), 'ترقية العامل لا تمسح جيب المتعلّم');
  assert.ok(sw.includes("'/api/iqra?view=home'") && sw.includes("'/api/iqra?view=lesson&id='") && sw.includes("p === '/iqra'"), 'البيت والحلقة والصفحة ضمن المسموح');
  assert.ok(sw.includes("url.pathname.startsWith('/iqra/audio/')") && sw.includes('caches.match(url.pathname)'), 'الصوت شبكةً أولًا ثم الجيب');
  assert.ok(sw.includes("indexedDB.open('athar-iqra', 1)") && sw.includes('iqraOutboxCount()'), 'إشعار المزامنة يحصي صندوق اقْرَأْ');
  const off = await import('../lib/iqra/offline');
  assert.equal(off.IQRA_UNIT_CAP, 2); assert.deepEqual([...off.OFFLINE_ACTIONS], ['answer', 'finish', 'tick', 'produce', 'library_answer']);
  for (const live of ['daily', 'review', 'produce_send', 'threshold_request', 'external']) assert.ok(!(off.OFFLINE_ACTIONS as readonly string[]).includes(live), `${live} حيّ فقط`);
  assert.deepEqual(await off.listUnits(), [], 'بلا Cache API (Node) → لا مَنازل');
  assert.equal(await off.enqueue({ action: 'daily' }, {}), false, 'سؤال اليوم لا يدخل الصندوق');
  assert.equal(off.fmtBytes(7.4 * 1048576), '7.4 م.ب');
  const ui = read('app/iqra/IqraApp.tsx');
  for (const t of ['iq-dl', 'iq-dl-go', 'iq-dl-state', 'iq-dl-remove', 'iq-offline']) assert.ok(ui.includes(`data-testid="${t}"`), t);
  assert.ok(ui.includes("type: 'warm-pages', paths: ['/iqra']") && ui.includes("e.data?.type === 'athar-sync'") && ui.includes("addEventListener('online'"), 'التسخين والمزامنة وعودة الاتصال');
  assert.ok(ui.includes('حُفظت بلا اتصال — تُصحَّح حين يعود الاتصال'), 'صدق الرسالة: التصحيح عند عودة الاتصال');
});

test('C2 ج٤ — «إجازة أَثَر»: لا عَتَبة بعد المتقن · الإصدار بعد مراجعة المشروع الختاميّ فقط · مرّة واحدة · سطر في التقدّم بلا حلقة + حدث للخريطة + إشعار · البطاقة تعرضها', async () => {
  const { LICENCE_LESSON_CODE, LICENCE_TITLE_AR, UI_AR } = await import('../lib/iqra/registry');
  const { licenceOf, licenceQueue, issueLicence } = await import('../lib/iqra/q2');
  const { buildJourney } = await import('../lib/journey/registry');
  assert.equal(LICENCE_LESSON_CODE, 'C2-U08-L05'); assert.ok(UI_AR.thr_c2.includes('إجازة أَثَر'));
  const db = fakeDb({ miaar_syllabus_units: [UNIT('C2-U08')] });
  const lid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  db.T.iqra_lessons.push({ id: lid, code: 'C2-U08-L05', unit_code: 'C2-U08', level: 'C2', title_ar: 'الإجازة', status: 'approved', item_ids: [], content: {} });
  db.T.iqra_enrolments.push({ id: 'e9', learner_email: 'c2@x.sa', user_id: 'u9', level: 'C2', source: 'placement', report_id: null, active: true, created_at: new Date().toISOString() });
  const e = db.T.iqra_enrolments[0];
  // أعلى السُّلّم: لا عَتَبة، نصّ الإجازة بدلها، ولا إجازة بعد
  const v = await thresholdView(db, e); assert.equal(v.reason, 'top_level'); assert.equal(v.copy.c2, UI_AR.thr_c2); assert.equal(v.licence, null);
  // قبل مراجعة المشروع: لا إصدار · ولا يظهر في الطابور
  assert.deepEqual((await licenceQueue(db)).rows, []);
  assert.equal((await issueLicence(db, 'c2@x.sa', STAFF)).error, 'project_not_reviewed');
  assert.equal((await issueLicence(db, 'nobody@x.sa', STAFF)).error, 'not_enrolled');
  // مشروع مُراجَع → يظهر في الطابور → الإصدار مرّة واحدة
  db.T.iqra_produce_reviews.push({ id: 'r1', learner_email: 'c2@x.sa', user_id: 'u9', lesson_id: lid, level: 'C2', kind: 'write', status: 'reviewed', score: 3, reviewed_at: new Date().toISOString(), created_at: new Date().toISOString() });
  const q1 = await licenceQueue(db); assert.equal(q1.rows.length, 1); assert.equal(q1.rows[0].learner_email, 'c2@x.sa'); assert.equal(q1.lesson?.code, 'C2-U08-L05');
  const r = await issueLicence(db, 'C2@x.sa ', STAFF); assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.licence.title_ar, LICENCE_TITLE_AR); assert.ok(r.licence.text_ar.includes('c2@x.sa') && r.licence.text_ar.includes('كتاب المجلس') && r.licence.text_ar.includes('يبقى لمِعيار'));
  assert.equal((await issueLicence(db, 'c2@x.sa', STAFF)).error, 'already_issued');
  const row = db.T.iqra_progress.find((p: any) => p.station === 'licence'); assert.ok(row); assert.equal(row.lesson_id, null); assert.equal(row.library_id, null); assert.equal(row.answers.licence.issued_by, STAFF.email);
  const lic = await licenceOf(db, 'c2@x.sa'); assert.ok(lic); assert.equal(lic!.id, row.id);
  const q2 = await licenceQueue(db); assert.equal(q2.rows.length, 0); assert.equal(q2.issued.length, 1);
  // البطاقة تعرض الإجازة · التقدّم في الحلقات لا يرى السطر (lesson_id فارغ)
  const v2 = await thresholdView(db, e); assert.equal(v2.licence?.id, row.id);
  const home = await learnerHome(db, e); assert.ok(home);
  // الحدث → فصل في «رحلتي/خريطة أثري»
  const ev = db.T.portal_learning_events.find((x: any) => x.object_type === 'iqra_licence'); assert.ok(ev); assert.equal(ev.verb, 'issued'); assert.equal(ev.email, 'c2@x.sa');
  const j = buildJourney({ events: [{ at: ev.at || new Date().toISOString(), verb: 'issued', object_type: 'iqra_licence', object_id: String(ev.object_id), skills: [], context: ev.context }], daily: [], sims: [], missions: [], memberships: [], cases: [], attestations: [], levels: [], credentials: [], skills: {} } as any);
  assert.ok(j.chapters.some((c: any) => c.key === `iqra_licence:${row.id}` && c.kind === 'credential' && c.title_ar === 'إجازة أَثَر'));
  // الإشعار
  assert.ok(db.T.portal_learner_notices.some((n: any) => n.dedupe_key === 'iqra_licence:c2@x.sa'));
  // الواجهتان
  const ui = read('app/iqra/IqraApp.tsx'); assert.ok(ui.includes('data-testid="iq-licence"') && ui.includes('iq-ijaza-text'));
  const desk = read('app/admin/miaar/IqraQ2Desk.tsx'); for (const t of ['iqd-lic-tab', 'iqd-lic-row', 'iqd-lic-issue', 'iqd-lic-done']) assert.ok(desk.includes(`data-testid="${t}"`), t);
  const api = read('app/api/admin/iqra/route.ts'); assert.ok(api.includes("action === 'licence_issue'") && api.includes("searchParams.get('licence')"));
});
