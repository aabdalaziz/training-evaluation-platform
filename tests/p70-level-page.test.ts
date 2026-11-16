// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P70 «بكلماتي عبر المستوى» — النواة: النافذة من تقويم الشعبة · سطر المستوى ≤ 200 · البطاقات من كلماته هو فقط (سطوره · التزاماته · نصّ اختباره · «عبرتُ» بالكلمات) · الجسم المختوم والبصمة · الوجه العام (الصوت ونصّ الاختبار لا يسافران) · k ≥ 5 · «الكلمة التي تعبر» · الصوت ≤ 30 ث · التحقّق · التوحيد مع P63/P66-ب/الطريق/الخزنة · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { P70_NAMES_AR, LEVEL_LIMITS, LEVEL_PATH, LEVEL_PUBLIC_PREFIX, CODE_RE, CARD_KEYS, CARD_AR, PUBLIC_KEYS, PUBLIC_DEFAULT, PUBLIC_AR, levelWindow, levelPhase, isEchoWeek, inDays, daysBetween, addDaysKey, validateLine, normalizeKeep, normalizePublic, crossedText, buildCards, levelBody, publicFace, sectionLineAr, echoIntroAr, fmtSec, DONE_STATE_AR, LINE_PROMPT_AR, LEVEL_FOOT_AR } from '../lib/level/registry';
import type { Sources } from '../lib/level/registry';
import { levelCode, digestOf, LEVEL_COLS, voiceOfRow, validateLevelVoice, LEVEL_VOICE_MAX_BYTES, levelVoicePath, verifyLevel } from '../lib/level/store';
import { jcs } from '../lib/portal/vc';
import { parseCommand } from '../lib/portal/voice';
import { REGISTRY } from '../lib/vault/registry';
import { NO_PAGE, crumbsFor } from '../lib/portal/way';
import { CARD_KEYS as GRAD_CARD_KEYS, PUBLIC_KEYS as GRAD_PUBLIC_KEYS, buildCards as gradCards, programWindow } from '../lib/grad/registry';
import { levelCloseNotice } from '../lib/diploma/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/* مستوى 2 من دبلوم: من 2026-10-04 إلى 2026-11-12 (40 يومًا) · المستوى 3 يبدأ 2026-11-15 */
const W = levelWindow('2026-10-04', '2026-11-12');
const src = (o: Partial<Sources> = {}): Sources => ({
  lines: [
    { kind: 'learn', day: '2026-10-05', body_ar: 'تعلّمتُ أن أسأل قبل أن أشرح', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null },
    { kind: 'learn', day: '2026-10-06', body_ar: 'قبل أن أغادر: الصوت الواضح نصف الدرس', blocker_ar: null, done: null, done_note_ar: null, unit_id: 'un1', week_no: null },
    { kind: 'learn', day: '2026-09-30', body_ar: 'من المستوى السابق — خارج النافذة', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null },
    { kind: 'learn', day: '2026-10-07', body_ar: '   ', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null },
    { kind: 'apply', day: '2026-10-20', body_ar: 'طبّقتُ السؤال الافتتاحي مع صفّ كامل', blocker_ar: 'ضيق الوقت', done: null, done_note_ar: null, unit_id: null, week_no: 3 },
    { kind: 'apply', day: '2026-10-27', body_ar: 'جرّبتُ التعليم بالأقران', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: 4 },
    { kind: 'commit', day: '2026-10-10', body_ar: 'ألتزم بسؤال واحد مفتوح كل حصة', blocker_ar: null, done: 'yes', done_note_ar: 'صار عادة', unit_id: null, week_no: null },
    { kind: 'commit', day: '2026-10-24', body_ar: 'ألتزم بتسجيل صوتي مرّة أسبوعيًّا', blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null },
    { kind: 'commit', day: '2026-11-20', body_ar: 'التزام من المستوى التالي', blocker_ar: null, done: 'no', done_note_ar: null, unit_id: null, week_no: null },
  ],
  prev_line: { line_ar: 'بدأتُ أسمع قبل أن أتكلّم', level_no: 1, sealed_at: '2026-10-02T10:00:00Z' },
  first_why: null,
  exam: { level: 'B1', outcome: 'passed', retake_skill_ar: null, from_level: 'A2', at: '2026-11-10T08:00:00Z', writing: { text: 'في مدرستي نبدأ اليوم بسؤال…', words: 142, at: '2026-11-10T08:30:00Z' }, speaking: { sec: 95, has_media: true, purged: false, transcript: null, at: '2026-11-10T08:50:00Z' } },
  training_days: 18, ...o,
});

test('P70 · الأسماء والحدود والمسارات والرمز والمفاتيح', () => {
  assert.equal(P70_NAMES_AR.title, 'بكلماتي عبر المستوى'); assert.equal(P70_NAMES_AR.official_ar, 'صفحة المستوى — بكلمات المتدرّب'); assert.equal(P70_NAMES_AR.official_en, "Level Page — In the Learner's Own Words"); assert.equal(P70_NAMES_AR.crossed, 'عبرتُ');
  assert.equal(LEVEL_PATH, '/me/level'); assert.equal(LEVEL_PUBLIC_PREFIX, '/lv');
  assert.equal(LEVEL_LIMITS.lineMax, 200); assert.equal(LEVEL_LIMITS.lineMin, 10); assert.equal(LEVEL_LIMITS.voiceSec, 30); assert.equal(LEVEL_LIMITS.k, 5); assert.equal(LEVEL_LIMITS.openBeforeDays, 7); assert.equal(LEVEL_LIMITS.openAfterDays, 7);
  for (let i = 0; i < 30; i++) assert.match(levelCode(), CODE_RE); assert.ok(!CODE_RE.test('ATH-GD-AAAA-BBBB'), 'عائلة مستقلّة عن P63'); assert.ok(!CODE_RE.test('ATH-LV-0000-1111'), 'بلا 0 و1');
  assert.deepEqual(CARD_KEYS, ['prev_line', 'first_why', 'day_lines', 'apply_lines', 'commits', 'exam_writing', 'exam_speaking', 'crossed']); assert.equal(Object.keys(CARD_AR).length, CARD_KEYS.length);
  assert.deepEqual(PUBLIC_DEFAULT, ['line', 'counts']); assert.ok(!PUBLIC_KEYS.includes('exam_writing' as any) && !PUBLIC_KEYS.includes('exam_speaking' as any) && !PUBLIC_KEYS.includes('voice' as any), 'نصّ الاختبار وصوته لا مفتاح لهما على الوجه العام'); assert.equal(Object.keys(PUBLIC_AR).length, PUBLIC_KEYS.length);
  assert.match(LEVEL_COLS, /classroom_id,level_no,line_ar,line_voice,keep,public_keys,live_public,body,code,digest,history,sealed_at,revoked_at/);
  assert.match(LINE_PROMPT_AR, /سطر أحمله معي/); assert.match(LEVEL_FOOT_AR, /لا تدخل هذه الصفحة في أي تقييم أو درجة أو قرار عبور/); assert.match(LEVEL_FOOT_AR, /لا يكتبها ذكاء اصطناعي/);
});

test('P70 · النافذة من تقويم الشعبة: تُفتح أول يوم من الأسبوع الأخير وتبقى أسبوعًا بعد المستوى · المرحلة · أسبوع الصدى', () => {
  assert.deepEqual(W, { from_day: '2026-10-04', to_day: '2026-11-12', open_from: '2026-11-06', open_to: '2026-11-19' });
  assert.equal(levelPhase(W, '2026-11-05'), 'before'); assert.equal(levelPhase(W, '2026-11-06'), 'open'); assert.equal(levelPhase(W, '2026-11-19'), 'open'); assert.equal(levelPhase(W, '2026-11-20'), 'after');
  const short = levelWindow('2026-11-01', '2026-11-05'); assert.equal(short.open_from, '2026-11-01', 'مستوى أقصر من أسبوع: يُفتح من أوله');
  assert.ok(isEchoWeek('2026-11-15', '2026-11-15') && isEchoWeek('2026-11-15', '2026-11-21') && !isEchoWeek('2026-11-15', '2026-11-22') && !isEchoWeek('2026-11-15', '2026-11-14'));
  assert.ok(inDays('2026-10-04', W) && inDays('2026-11-12', W) && !inDays('2026-11-13', W) && !inDays(null, W)); assert.equal(daysBetween('2026-10-04', '2026-11-12'), 40); assert.equal(addDaysKey('2026-11-12', 7), '2026-11-19');
});

test('P70 · سطر المستوى: ≤ 200 · ≥ 10 · بلا بريد أو هاتف · keep/public طبيعية', () => {
  assert.equal((validateLine('قصير') as any).ok, false); assert.match((validateLine('قصير') as any).error, /10 أحرف/);
  const long = validateLine('ك'.repeat(400)); assert.ok(long.ok); if (long.ok) assert.equal(long.text.length, 200, 'يُقصّ لا يُرفض');
  assert.match((validateLine('راسلوني على a@b.sa إن أردتم المساعدة') as any).error, /بلا بريد/); assert.match((validateLine('اتصلوا بي 0501234567 دائمًا') as any).error, /بلا بريد/);
  const ok = validateLine('  صرتُ   أسأل قبل أن  أشرح — وأسمع قبل أن أحكم  '); assert.ok(ok.ok); if (ok.ok) assert.equal(ok.text, 'صرتُ أسأل قبل أن أشرح — وأسمع قبل أن أحكم');
  const k = normalizeKeep({ exam_speaking: false, bogus: false }); assert.equal(k.exam_speaking, false); assert.equal(k.crossed, true); assert.equal(Object.keys(k).length, CARD_KEYS.length); assert.ok(!('bogus' in k));
  assert.deepEqual(normalizePublic(undefined), ['line', 'counts']); assert.deepEqual(normalizePublic(['crossed', 'exam_writing', 'name', 'line']), ['line', 'name', 'crossed'], 'بترتيب ثابت وبلا مفاتيح غريبة'); assert.deepEqual(normalizePublic([]), []);
});

test('P70 · «عبرتُ» بالكلمات لا الأرقام: عبر · على العتبة (مع الإعادة) · لم يعبر بعدُ · بانتظار القراءة', () => {
  assert.deepEqual(crossedText({ level: 'B1', outcome: 'passed', retake_skill_ar: null, from_level: 'A2' }), { text_ar: 'دخلتُ هذا المستوى بـ A2 — وأعبره اليوم إلى ما بعد B1.', state_ar: 'عبرتُ' });
  assert.deepEqual(crossedText({ level: 'B1', outcome: 'conditional', retake_skill_ar: 'التحدّث', from_level: null }), { text_ar: 'وأقف على عتبة B1 — ولي إعادة في التحدّث.', state_ar: 'على العتبة' });
  assert.match(crossedText({ level: 'B1', outcome: 'failed', retake_skill_ar: null, from_level: null }).text_ar, /لم أعبر B1 بعدُ — والطريق مفتوح/); assert.equal(crossedText({ level: 'B1', outcome: 'pending', retake_skill_ar: null, from_level: null }).state_ar, 'بانتظار القراءة');
  for (const o of ['passed', 'conditional', 'failed', 'pending']) assert.ok(!/\d{2,}|%/.test(crossedText({ level: 'B1', outcome: o, retake_skill_ar: null, from_level: null }).text_ar), `لا أرقام ولا نِسَب: ${o}`);
});

test('P70 · البطاقات من كلماته هو داخل النافذة فقط · سطوره والتزاماته وتطبيقه · نصّ اختباره كما كتبه · الصوت مدّةً فقط · الأعداد', () => {
  const { cards, counts } = buildCards(src(), W);
  assert.deepEqual(cards.map((c) => c.key), ['prev_line', 'day_lines', 'apply_lines', 'commits', 'exam_writing', 'exam_speaking', 'crossed']);
  const dl = cards.find((c) => c.key === 'day_lines')!; assert.equal(dl.items!.length, 2, 'الفارغ وخارج النافذة لا يظهران'); assert.equal(dl.items![1].state_ar, 'قبل أن أغادر'); assert.equal(dl.items![0].state_ar, null);
  const ap = cards.find((c) => c.key === 'apply_lines')!; assert.equal(ap.items![0].text_ar, 'طبّقتُ السؤال الافتتاحي مع صفّ كامل — وما عاقني: ضيق الوقت'); assert.equal(ap.items![0].state_ar, 'الأسبوع 3');
  const cm = cards.find((c) => c.key === 'commits')!; assert.equal(cm.items!.length, 2, 'التزام المستوى التالي خارج'); assert.equal(cm.items![0].text_ar, 'ألتزم بسؤال واحد مفتوح كل حصة — صار عادة'); assert.equal(cm.items![0].state_ar, DONE_STATE_AR.yes); assert.equal(cm.items![1].state_ar, DONE_STATE_AR.none);
  const ew = cards.find((c) => c.key === 'exam_writing')!; assert.equal(ew.text_ar, 'في مدرستي نبدأ اليوم بسؤال…'); assert.match(ew.state_ar!, /142 كلمة — كما كتبتُها، بلا درجة/);
  const es = cards.find((c) => c.key === 'exam_speaking')!; assert.equal(es.text_ar, null); assert.equal(es.voice_sec, 95); assert.match(es.state_ar!, /قلتُها في 1:35 — لك وحدك/);
  const cr = cards.find((c) => c.key === 'crossed')!; assert.equal(cr.state_ar, 'عبرتُ'); assert.match(cr.text_ar!, /دخلتُ هذا المستوى بـ A2/);
  assert.equal(cards.find((c) => c.key === 'prev_line')!.state_ar, 'المستوى 1');
  assert.deepEqual(counts, { day_lines: 2, apply_lines: 2, commits: 2, commits_done: 1, training_days: 18, apply_weeks: 2 });
  const empty = buildCards(src({ lines: [], prev_line: null, exam: null, training_days: 0 }), W); assert.deepEqual(empty.cards, []); assert.deepEqual(empty.counts, { day_lines: 0, apply_lines: 0, commits: 0, commits_done: 0, training_days: 0, apply_weeks: 0 });
  const purged = buildCards(src({ exam: { ...src().exam!, speaking: { sec: 80, has_media: false, purged: true, transcript: 'نصّ منسوخ', at: '2026-11-10T08:50:00Z' } } }), W); assert.match(purged.cards.find((c) => c.key === 'exam_speaking')!.state_ar!, /حُذف التسجيل وفق سياسة الصوت/); assert.equal(purged.cards.find((c) => c.key === 'exam_speaking')!.text_ar, 'نصّ منسوخ');
  const fw = buildCards(src({ first_why: { id: 5, body_ar: 'جئتُ لأُتقن', at: '2026-10-04T07:00:00Z', state: 'sealed', opens_ar: '7 مارس 2027' } }), W); const f = fw.cards.find((c) => c.key === 'first_why')!; assert.equal(f.text_ar, null, 'المختومة لا تُفتح هنا'); assert.match(f.state_ar!, /مختومة — تُفتح لك يوم تخرّجك/); assert.equal(f.href, '/me/letter#letter-5');
  const many = buildCards(src({ lines: Array.from({ length: 50 }, (_, i) => ({ kind: 'learn' as const, day: addDaysKey('2026-10-04', i % 39), body_ar: `سطر ${i}`, blocker_ar: null, done: null, done_note_ar: null, unit_id: null, week_no: null })) }), W); assert.equal(many.cards.find((c) => c.key === 'day_lines')!.items!.length, LEVEL_LIMITS.dayLinesMax); assert.equal(many.counts.day_lines, 50);
  assert.equal(fmtSec(95), '1:35'); assert.equal(fmtSec(null), '0:00');
});

test('P70 · الجسم المختوم: keep يُسقط البطاقة · الروابط تُزال · JCS ثابت · البصمة تتغيّر بتغيّر السطر', () => {
  const { cards, counts } = buildCards(src({ first_why: { id: 5, body_ar: 'جئتُ لأُتقن', at: '2026-10-04T07:00:00Z', state: 'opened', opens_ar: '' } }), W); const keep = normalizeKeep({ exam_speaking: false });
  const program = { id: 'p1', name_ar: 'دبلوم تعليم العربية', level_no: 2, from: W.from_day, to: W.to_day, section_ar: 'شعبة 1' };
  const body = levelBody({ code: 'ATH-LV-AAAA-BBBB', program, name: 'نورة', line_ar: 'صرتُ أسأل قبل أن أشرح', cards, keep, counts, sealed_at: '2026-11-12T10:00:00Z' });
  assert.equal(body.v, 'p70'); assert.ok(!body.cards.some((c) => c.key === 'exam_speaking'), 'المخفيّ لا يُختم'); assert.ok(body.cards.every((c) => c.href === undefined), 'لا روابط داخلية في الجسم'); assert.equal(body.counts.training_days, 18);
  const d1 = digestOf(body); assert.match(d1, /^[0-9a-f]{64}$/); assert.equal(d1, digestOf(JSON.parse(jcs(body))), 'JCS: ترتيب المفاتيح لا يغيّر البصمة');
  assert.notEqual(digestOf({ ...body, line_ar: 'صرتُ أسأل قبل أن أشرح.' }), d1);
  const reordered = JSON.parse(JSON.stringify({ sealed_at: body.sealed_at, name: body.name, v: body.v, code: body.code, program: body.program, line_ar: body.line_ar, cards: body.cards, counts: body.counts })); assert.equal(digestOf(reordered), d1);
});

test('P70 · الوجه العام: الافتراضي السطر والأعداد · الاسم و«عبرتُ» وكلمة المستوى السابق بالاختيار · نصّ الاختبار وصوته لا يسافران · المُبطل', () => {
  const { cards, counts } = buildCards(src(), W);
  const program = { id: 'p1', name_ar: 'دبلوم تعليم العربية', level_no: 2, from: W.from_day, to: W.to_day, section_ar: null };
  const body = levelBody({ code: 'ATH-LV-AAAA-BBBB', program, name: 'نورة', line_ar: 'سطري', cards, keep: normalizeKeep({}), counts, sealed_at: '2026-11-12T10:00:00Z' });
  const f0 = publicFace(body, PUBLIC_DEFAULT); assert.equal(f0.line_ar, 'سطري'); assert.deepEqual(f0.counts, body.counts); assert.equal(f0.name, null); assert.deepEqual(f0.cards, []); assert.equal(f0.level_no, 2); assert.equal(f0.revoked, false); assert.equal(f0.intact, true);
  const f1 = publicFace(body, ['line', 'name', 'crossed', 'prev_line', 'exam_writing' as any, 'exam_speaking' as any]);
  assert.equal(f1.name, 'نورة'); assert.deepEqual(f1.cards.map((c) => c.key), ['prev_line', 'crossed']); assert.equal(f1.counts, null); assert.ok(f1.cards.every((c) => c.voice_sec === undefined && c.href === null));
  const f2 = publicFace(body, ['commits', 'day_lines']); assert.deepEqual(f2.cards.map((c) => c.key), ['day_lines', 'commits']); assert.equal(f2.line_ar, null);
  assert.ok(!JSON.stringify(publicFace(body, PUBLIC_KEYS)).includes('في مدرستي نبدأ'), 'نصّ اختباره لا يظهر حتى بكل المفاتيح');
  const fr = publicFace(body, PUBLIC_DEFAULT, { revoked: true, intact: false }); assert.equal(fr.revoked, true); assert.equal(fr.intact, false);
  assert.equal(sectionLineAr(4), null); assert.equal(sectionLineAr(5), '5 من شعبتك ختموا صفحة هذا المستوى'); assert.equal(echoIntroAr(2), 'قلتَ وأنت تعبر المستوى 2:');
});

test('P70 · الصوت: ≤ 30 ث · ≤ 1 MiB · بادئة level-voice وحدها · المسار', () => {
  assert.equal(LEVEL_VOICE_MAX_BYTES, 1024 * 1024);
  const ok = validateLevelVoice({ mime: 'audio/webm', bytes: 300_000, sec: 29 }); assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.ext, 'webm'); assert.equal(ok.sec, 29); }
  assert.match((validateLevelVoice({ mime: 'audio/webm', bytes: 1000, sec: 32 }) as any).error, /30/); assert.ok(validateLevelVoice({ mime: 'audio/webm', bytes: 1000, sec: 31 }).ok, 'تسامح ثانية واحدة للتقريب'); assert.equal((validateLevelVoice({ mime: 'audio/webm', bytes: LEVEL_VOICE_MAX_BYTES + 1, sec: 10 }) as any).ok, false); assert.equal((validateLevelVoice({ mime: 'video/mp4', bytes: 1000, sec: 10 }) as any).ok, false);
  assert.equal(voiceOfRow({ path: 'level-voice/u/1.webm', sec: 9 })?.sec, 9); assert.equal(voiceOfRow({ path: 'grad-voice/u/1.webm', sec: 9 }), null, 'بادئة P70 فقط'); assert.equal(voiceOfRow({}), null);
  assert.equal(levelVoicePath('u1', 7, 'webm'), 'level-voice/u1/7.webm');
});

test('P70 · التحقّق: رمز سليم · البصمة · المُبطل · المستبدَل من history · الخاصّ بلا وجه', async () => {
  const { cards, counts } = buildCards(src(), W);
  const program = { id: 'p1', name_ar: 'دبلوم تعليم العربية', level_no: 2, from: W.from_day, to: W.to_day, section_ar: null };
  const body = levelBody({ code: 'ATH-LV-AAAA-BBBB', program, name: 'نورة', line_ar: 'سطري', cards, keep: normalizeKeep({}), counts, sealed_at: '2026-11-12T10:00:00Z' });
  const rows: any[] = [
    { id: 1, user_id: 'u1', email: 'a@x.sa', program_id: 'p1', enrollment_id: 'e1', classroom_id: 'c1', level_no: 2, line_ar: 'سطري', line_voice: {}, keep: {}, public_keys: ['line', 'counts', 'crossed'], live_public: true, body, code: 'ATH-LV-AAAA-BBBB', digest: digestOf(body), history: [{ code: 'ATH-LV-OLDD-CODE', sealed_at: '2026-11-11T10:00:00Z', digest: 'x', revoked_at: '2026-11-12T10:00:00Z' }], sealed_at: '2026-11-12T10:00:00Z', revoked_at: null },
    { id: 2, user_id: 'u2', email: 'b@x.sa', program_id: 'p1', enrollment_id: 'e2', classroom_id: 'c1', level_no: 2, line_ar: 'خاصّ', line_voice: {}, keep: {}, public_keys: ['line'], live_public: false, body: { ...body, code: 'ATH-LV-CCCC-DDDD', line_ar: 'خاصّ' }, code: 'ATH-LV-CCCC-DDDD', digest: 'tampered', history: [], sealed_at: '2026-11-12T10:00:00Z', revoked_at: '2026-11-13T10:00:00Z' },
  ];
  const db: any = { from: (t: string) => { assert.ok(t === 'portal_level_pages' || t === 'portal_org_policy' || t === 'portal_org_members' || t === 'organizations' || t === 'profiles' || true); let list = t === 'portal_level_pages' ? rows : []; const q: any = {};
    for (const op of ['select', 'is', 'not', 'order', 'neq', 'in', 'gte', 'lte', 'ilike', 'or']) q[op] = () => q;
    q.eq = (k: string, v: any) => { list = list.filter((r) => String(r[k]) === String(v)); return q; };
    q.contains = (_k: string, v: string) => { const want = JSON.parse(v)[0].code; list = list.filter((r) => (r.history || []).some((h: any) => h.code === want)); return q; };
    q.limit = () => Promise.resolve({ data: list, error: null }); q.maybeSingle = () => Promise.resolve({ data: list[0] || null, error: null }); q.single = q.maybeSingle; q.then = (res: any) => Promise.resolve({ data: list, error: null }).then(res); return q; } };
  const ok = await verifyLevel(db, 'ath-lv-aaaa-bbbb', { face: true }); assert.equal(ok.valid, true); assert.equal(ok.intact, true); assert.equal(ok.public, true); assert.equal(ok.level_no, 2); assert.equal(ok.program_ar, 'دبلوم تعليم العربية'); assert.equal(ok.face!.line_ar, 'سطري'); assert.deepEqual(ok.face!.cards.map((c) => c.key), ['crossed']); assert.equal(ok.face!.name, null);
  const noFace = await verifyLevel(db, 'ATH-LV-AAAA-BBBB'); assert.equal(noFace.face, undefined);
  const rv = await verifyLevel(db, 'ATH-LV-CCCC-DDDD', { face: true }); assert.equal(rv.valid, false); assert.equal(rv.revoked, true); assert.equal(rv.intact, false); assert.equal(rv.public, false); assert.equal(rv.face!.revoked, true); assert.equal(rv.face!.line_ar, null, 'المُبطل بلا محتوى');
  const rep = await verifyLevel(db, 'ATH-LV-OLDD-CODE'); assert.deepEqual(rep, { valid: false, revoked: true, replaced: true, sealed_at: '2026-11-11T10:00:00Z', digest: 'x' });
  assert.deepEqual(await verifyLevel(db, 'ATH-LV-ZZZZ-ZZZZ'), { valid: false }); assert.deepEqual(await verifyLevel(db, 'ATH-GD-AAAA-BBBB'), { valid: false }, 'عائلة أخرى');
});

test('P70 · التوحيد: الإشعار يفتح الصفحة · سطور المستويات في صفحة التخرّج (P63) · الصدى في «سطري» · الطريق والصوت والخزنة · شكل المصدر', () => {
  const n = levelCloseNotice('دبلوم', 2); assert.match(n.body_ar, /بكلماتي عبر المستوى/); assert.match(read('lib/diploma/store.ts'), /url: '\/me\/level'/); assert.match(read('lib/diploma/store.ts'), /export async function programLevelSpans/);
  assert.ok(GRAD_CARD_KEYS.includes('level_lines') && GRAD_PUBLIC_KEYS.includes('level_lines'));
  const GP = { id: 'p1', name_ar: 'دبلوم', start: '2026-08-01', end: '2026-11-30' }; const GW = programWindow(GP.start, GP.end);
  const g = gradCards({ threads: [], replies: [], chapters: [], cohort_line: null, grad_letter: null, map_code: null, farewell: null, stations: [], cohort_opened: false, threads_after: 0, level_lines: [{ level_no: 1, line_ar: 'بدأتُ أسمع', sealed_at: '2026-09-10T10:00:00Z' }, { level_no: 2, line_ar: 'صرتُ أسأل', sealed_at: '2026-11-12T10:00:00Z' }] } as any, GP, GW);
  const ll = g.cards.find((c) => c.key === 'level_lines')!; assert.equal(ll.items!.length, 2); assert.equal((ll.items![1] as any).state_ar, 'المستوى 2'); assert.match(read('lib/grad/store.ts'), /level_lines: await sealedLevelLines\(db, me, p\.id\)/);
  const ld = read('app/me/line/LineDesk.tsx'); assert.match(ld, /\/api\/me\/level\?echo=1/); assert.match(ld, /data-testid="ln-echo"/); assert.match(ld, /href="\/me\/level"/);
  assert.equal((parseCommand('افتح سطر المستوى') as any).href, '/me/level'); assert.equal((parseCommand('عبرتُ') as any).href, '/me/level'); assert.equal((parseCommand('بكلماتي عبر المستوى') as any).href, '/me/level'); assert.equal((parseCommand('افتح يوم تخرجي') as any).href, '/me/grad', 'P63 كما هو'); assert.equal((parseCommand('افتح بكلماتي') as any).href, '/me/grad', 'P63 يحتفظ بـ«بكلماتي» وحدها'); assert.equal((parseCommand('سطري') as any).href, '/me/line', 'P66 كما هو');
  assert.ok(REGISTRY.some((r) => r.table === 'portal_level_pages' && r.policy === 'delete' && r.access.includes('self') && r.access.includes('public') && r.piiCols.includes('line_ar') && r.piiCols.includes('body')));
  assert.ok(NO_PAGE.has('/lv')); assert.equal(crumbsFor('/me/level', 'ar').pop()!.label, 'بكلماتي عبر المستوى'); assert.equal(crumbsFor('/verify/level', 'ar').pop()!.label, 'تحقّق من صفحة مستوى'); assert.equal(crumbsFor('/lv/ATH-LV-AAAA-BBBB', 'ar')[1].label, 'صفحة مستوى');
  assert.match(read('app/me/page.tsx'), /href="\/me\/level" data-testid="me-level"/); assert.match(read('app/components/GlobalNavigation.tsx'), /'\/lv', '\/verify\/level'/);
  const sql = read('supabase/p70-level-pages.sql'); assert.match(sql, /create table if not exists public\.portal_level_pages/); assert.match(sql, /unique \(user_id, enrollment_id, level_no\)/); assert.match(sql, /char_length\(line_ar\) <= 200/); assert.match(sql, /level_no between 1 and 8/); assert.match(sql, /ATH-LV-\[A-Z2-9\]\{4\}-\[A-Z2-9\]\{4\}/); assert.match(sql, /level_pages_owner_read/); assert.match(sql, /'\["line","counts"\]'::jsonb/);
  const store = read('lib/level/store.ts'); assert.ok(!/GoogleGenerativeAI|openai|gemini/i.test(store), 'لا ذكاء اصطناعي'); assert.match(store, /is\('revoked_at', null\)/); assert.match(store, /level-voice/); assert.match(store, /miaar-media|MEDIA_BUCKET/);
  const api = read('app/api/me/level/route.ts'); assert.match(api, /freezeGate/); assert.match(api, /`level:\$\{user\.id\}`|'level:'/); assert.match(api, /'line'|"line"/); assert.match(api, /'seal'/); assert.match(api, /'revoke'/); assert.match(api, /'delete'/);
  const vapi = read('app/api/me/level/voice/route.ts'); assert.match(vapi, /exam/); assert.match(vapi, /levelvoice:/);
  assert.match(read('app/api/verify/level/route.ts'), /verify:level:/); assert.match(read('app/lv/[code]/page.tsx'), /face=1/); assert.match(read('app/verify/level/page.tsx'), /\/api\/verify\/level\?code=/);
  const desk = read('app/me/level/LevelDesk.tsx'); assert.match(desk, /data-testid="lv-/); assert.ok(!/import \{[^}]*\} from '\.\.\/\.\.\/\.\.\/lib\/level\/store'/.test(desk), 'المكوّن العميل لا يستورد طبقة القاعدة إلا كأنواع');
  assert.match(read('tests/index.ts'), /p70-level-page\.test/);
});
