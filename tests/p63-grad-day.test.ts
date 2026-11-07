// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P63 «يوم تخرّجي — بكلماتي» — النواة: النافذة والمرحلة · سطر التخرّج · البطاقات من كلمات صاحبها فقط · الجسم المختوم والبصمة · الوجه العام الافتراضي (السطر والأعداد) · «منذ ذلك اليوم» · k ≥ 5 · الكرون · التوحيد مع P39/P62 · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { P63_NAMES_AR, GRAD_LIMITS, CODE_RE, CARD_KEYS, PUBLIC_KEYS, PUBLIC_DEFAULT, programWindow, inWindow, gradPhase, daysSince, daysBetween, validateLine, normalizeKeep, normalizePublic, buildCards, sinceThen, sinceLinesAr, gradBody, publicFace, cohortLineAr, gradEvidenceLineAr, pulseGradLineAr, gradDayNotice, farewellAskNotice } from '../lib/grad/registry';
import type { Sources } from '../lib/grad/registry';
import { gradCode, digestOf, runGradDays, GRAD_COLS, voiceOfRow } from '../lib/grad/store';
import { jcs } from '../lib/portal/vc';
import { parseCommand } from '../lib/portal/voice';
import { REGISTRY } from '../lib/vault/registry';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { NO_PAGE, crumbsFor } from '../lib/portal/way';
import { EVIDENCE_KIND_AR } from '../lib/accreditation/registry';
import { DOORS_AR } from '../lib/letters/self';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = { id: 'p63', name_ar: 'دبلوم تعليم العربية', start: '2026-08-01', end: '2026-11-07' };
const W = programWindow(P.start, P.end);
const src = (o: Partial<Sources> = {}): Sources => ({
  threads: [
    { from: 'program:p63', to: 'skill:s1', rule: 'program_skill', status: 'kept', note_ar: 'لأن الصوت صار أوضح في الحصة', decided_at: '2026-09-10T09:00:00Z' },
    { from: 'skill:s1', to: 'case:c1', rule: 'manual', status: 'kept', note_ar: 'طبّقته مع طالب خجول', decided_at: '2026-10-02T09:00:00Z' },
    { from: 'x', to: 'y', rule: 'manual', status: 'declined', note_ar: null, decided_at: '2026-10-03T09:00:00Z' },
    { from: 'a', to: 'b', rule: 'manual', status: 'kept', note_ar: 'قديم', decided_at: '2026-05-01T09:00:00Z' },
    { from: 'c', to: 'd', rule: 'manual', status: 'kept', note_ar: 'بعد التخرّج', decided_at: '2026-12-01T09:00:00Z' },
  ],
  replies: [{ text: 'وصلت، وسأجرّب غدًا', voice: false, at: '2026-09-12T09:00:00Z' }, { text: null, voice: true, at: '2026-09-20T09:00:00Z' }, { text: 'قديم', voice: false, at: '2026-01-01T09:00:00Z' }],
  chapters: [{ key: 'k1', title_ar: 'كل يوم مهارة: موقف الصفّ', at: '2026-09-01T09:00:00Z' }, { key: 'k2', title_ar: 'محاكاة', at: '2027-01-01T09:00:00Z' }],
  cohort_line: { body_ar: 'ابدأ قبل أن تشعر بالجاهزية', created_at: '2026-11-01T09:00:00Z' },
  grad_letter: { id: 77, state: 'today', opens_ar: '7 نوفمبر 2026', open_hour_ar: '21:40' },
  map_code: { code: 'ATH-MP-AAAA-BBBB', created_at: '2026-10-20T09:00:00Z', is_public: false },
  farewell: { text_ar: 'كنتم أجمل دفعة', at: '2026-11-05T09:00:00Z', voice_sec: 12, trainer_ar: 'د. أحمد' },
  stations: [{ station: 30, written: true }, { station: 90, written: false }, { station: 365, written: false }], cohort_opened: false, threads_after: 1, ...o,
});

test('P63 · الأسماء والحدود والرمز والمفاتيح', () => {
  assert.equal(P63_NAMES_AR.title, 'يوم تخرّجي'); assert.equal(P63_NAMES_AR.words, 'بكلماتي'); assert.equal(P63_NAMES_AR.official_ar, 'صفحة التخرّج الذاتية للمتدرّب'); assert.equal(P63_NAMES_AR.official_en, 'Learner-authored graduation page');
  assert.equal(GRAD_LIMITS.lineMax, 160, 'حدّ سطر الدفعة نفسه'); assert.equal(GRAD_LIMITS.voiceSec, 15); assert.equal(GRAD_LIMITS.k, 5); assert.equal(GRAD_LIMITS.farewellBeforeDays, 3);
  for (let i = 0; i < 20; i++) assert.match(gradCode(), CODE_RE); assert.ok(!CODE_RE.test('ATH-MP-AAAA-BBBB'), 'عائلة مستقلّة'); assert.ok(!CODE_RE.test('ATH-GD-0000-1111'), 'بلا 0 و1');
  assert.deepEqual(CARD_KEYS, ['farewell', 'welcome', 'first_why', 'first_because', 'replies', 'chapters', 'cohort_line', 'grad_letter', 'map_code']); /* P64 أضاف welcome · first_why */ assert.deepEqual(PUBLIC_DEFAULT, ['line', 'counts']); assert.ok(PUBLIC_KEYS.includes('since') && !PUBLIC_KEYS.includes('voice' as any) && !PUBLIC_KEYS.includes('grad_letter' as any), 'لا مفتاح للصوت ولا لرسالة P62');
  assert.match(GRAD_COLS, /line_voice,keep,public_keys,live_public,body,code,digest,history,sealed_at,revoked_at/);
});

test('P63 · النافذة والمرحلة: تُفتح يوم end_date ولكل خرّيج سابق · منذ ذلك اليوم', () => {
  assert.equal(W.from, '2026-08-01T00:00:00.000Z'); assert.equal(W.to, '2026-11-09T00:00:00.000Z', 'end + يوم (شامل)');
  assert.equal(programWindow(null, P.end).from, '2026-07-10T00:00:00.000Z', 'بلا start_date: 120 يومًا قبل النهاية');
  assert.ok(inWindow('2026-11-08T23:00:00Z', W) && !inWindow('2026-11-09T00:00:00Z', W) && !inWindow('2026-07-31T23:59:59Z', W) && !inWindow(null, W));
  assert.equal(gradPhase(P.end, '2026-11-06'), 'before'); assert.equal(gradPhase(P.end, '2026-11-07'), 'today'); assert.equal(gradPhase(P.end, '2027-01-01'), 'after');
  assert.equal(daysSince(P.end, new Date('2026-11-17T12:00:00Z')), 10); assert.equal(daysSince(P.end, new Date('2026-11-01T12:00:00Z')), 0); assert.equal(daysBetween(P.start, P.end), 99);
});

test('P63 · سطر التخرّج: ≤ 160 · ≥ 10 · بلا بريد أو هاتف · keep/public طبيعية', () => {
  assert.equal((validateLine('قصير') as any).ok, false); assert.match((validateLine('قصير') as any).error, /10 أحرف/);
  const long = validateLine('ك'.repeat(300)); assert.ok(long.ok); if (long.ok) assert.equal(long.text.length, 160, 'يُقصّ لا يُرفض');
  assert.match((validateLine('راسلوني على a@b.sa إن أردتم المساعدة') as any).error, /بلا بريد/); assert.match((validateLine('اتصلوا بي 0501234567 دائمًا') as any).error, /بلا بريد/);
  const ok = validateLine('  ابدأ   قبل أن تشعر  بالجاهزية — ثم تعلّم في الطريق  '); assert.ok(ok.ok); if (ok.ok) assert.equal(ok.text, 'ابدأ قبل أن تشعر بالجاهزية — ثم تعلّم في الطريق');
  const k = normalizeKeep({ replies: false, bogus: false }); assert.equal(k.replies, false); assert.equal(k.farewell, true); assert.equal(Object.keys(k).length, CARD_KEYS.length); assert.ok(!('bogus' in k));
  assert.deepEqual(normalizePublic(undefined), ['line', 'counts']); assert.deepEqual(normalizePublic(['since', 'voice', 'name', 'line']), ['line', 'name', 'since'], 'بترتيب ثابت وبلا مفاتيح غريبة'); assert.deepEqual(normalizePublic([]), []);
});

test('P63 · «بكلماتي»: كلمات صاحبها داخل النافذة فقط · أول «لأن…» · ردوده النصّية ≤ 5 · كلمة الوداع وحدها من المدرّب · الأعداد', () => {
  const { cards, counts } = buildCards(src(), P, W);
  assert.deepEqual(cards.map((c) => c.key), ['farewell', 'first_because', 'replies', 'chapters', 'cohort_line', 'grad_letter', 'map_code']);
  const fb = cards.find((c) => c.key === 'first_because')!; assert.equal(fb.text_ar, 'لأن الصوت صار أوضح في الحصة', 'أول خيط مبقى بكلمة — لا يُكرّر «لأن»'); assert.equal(fb.at, '2026-09-10T09:00:00Z');
  const rp = cards.find((c) => c.key === 'replies')!; assert.equal(rp.items!.length, 1, 'ردّ صوتي بلا نصّ لا يظهر، والقديم خارج النافذة'); assert.equal(rp.items![0].text_ar, 'وصلت، وسأجرّب غدًا');
  const ch = cards.find((c) => c.key === 'chapters')!; assert.equal(ch.items!.length, 1, 'فصل ما بعد التخرّج خارج');
  assert.match(cards.find((c) => c.key === 'grad_letter')!.state_ar!, /تُفتح اليوم الساعة 21:40/); assert.equal(cards.find((c) => c.key === 'grad_letter')!.text_ar, null, 'لا نصّ لرسالة P62 هنا أبدًا');
  assert.equal(cards.find((c) => c.key === 'farewell')!.voice_sec, 12); assert.equal(cards.find((c) => c.key === 'map_code')!.href, '/verify/map?code=ATH-MP-AAAA-BBBB');
  assert.deepEqual(counts, { threads: 2, replies: 2, amanat: 1, chapters: 1, days: 0 });
  const empty = buildCards(src({ threads: [], replies: [], chapters: [], cohort_line: null, grad_letter: null, map_code: null, farewell: null }), P, W); assert.deepEqual(empty.cards, []); assert.deepEqual(empty.counts, { threads: 0, replies: 0, amanat: 0, chapters: 0, days: 0 });
  const many = buildCards(src({ replies: Array.from({ length: 9 }, (_, i) => ({ text: `ردّ ${i}`, voice: false, at: '2026-09-12T09:00:00Z' })) }), P, W); assert.equal(many.cards.find((c) => c.key === 'replies')!.items!.length, 5);
});

test('P63 · الجسم المختوم: keep يُسقط البطاقة · الصوت لا يدخل · JCS ثابت · البصمة تتغيّر بتغيّر السطر', () => {
  const { cards, counts } = buildCards(src(), P, W); const keep = normalizeKeep({ replies: false });
  const body = gradBody({ code: 'ATH-GD-AAAA-BBBB', program: { id: P.id, name_ar: P.name_ar, start: P.start, end: P.end }, name: 'نورة', line_ar: 'ابدأ قبل أن تشعر بالجاهزية', cards, keep, counts, sealed_at: '2026-11-07T10:00:00Z' });
  assert.equal(body.v, 'p63'); assert.ok(!body.cards.some((c) => c.key === 'replies'), 'المخفيّ لا يُختم'); assert.ok(body.cards.every((c) => c.voice_sec === undefined), 'لا ثوانٍ صوت في الجسم'); assert.equal(body.counts.days, 99);
  const d1 = digestOf(body); assert.match(d1, /^[0-9a-f]{64}$/); assert.equal(d1, digestOf(JSON.parse(jcs(body))), 'JCS: ترتيب المفاتيح لا يغيّر البصمة');
  const body2 = { ...body, line_ar: 'ابدأ قبل أن تشعر بالجاهزية.' }; assert.notEqual(digestOf(body2), d1);
  const reordered = JSON.parse(JSON.stringify({ sealed_at: body.sealed_at, name: body.name, v: body.v, code: body.code, program: body.program, line_ar: body.line_ar, cards: body.cards, counts: body.counts })); assert.equal(digestOf(reordered), d1);
});

test('P63 · الوجه العام: الافتراضي السطر والأعداد · الاسم والبطاقات بالاختيار · رسالة P62 لا تظهر أبدًا · «منذ ذلك اليوم» بالاختيار · المُبطل', () => {
  const { cards, counts } = buildCards(src(), P, W);
  const body = gradBody({ code: 'ATH-GD-AAAA-BBBB', program: { id: P.id, name_ar: P.name_ar, start: P.start, end: P.end }, name: 'نورة', line_ar: 'سطري', cards, keep: normalizeKeep({}), counts, sealed_at: '2026-11-07T10:00:00Z' });
  const f0 = publicFace(body, PUBLIC_DEFAULT); assert.equal(f0.line_ar, 'سطري'); assert.deepEqual(f0.counts, body.counts); assert.equal(f0.name, null); assert.deepEqual(f0.cards, []); assert.equal(f0.since_ar, null); assert.equal(f0.revoked, false); assert.equal(f0.intact, true);
  const since = sinceThen(src(), P.end, new Date('2026-12-10T00:00:00Z'));
  const f1 = publicFace(body, ['line', 'name', 'farewell', 'first_because', 'map_code', 'since', 'grad_letter' as any], { since });
  assert.equal(f1.name, 'نورة'); assert.deepEqual(f1.cards.map((c) => c.key), ['farewell', 'first_because', 'map_code']); assert.equal(f1.counts, null); assert.equal(f1.cards.find((c) => c.key === 'map_code')!.href, '/verify/map?code=ATH-MP-AAAA-BBBB');
  assert.ok(!f1.cards.some((c) => c.key === 'grad_letter'), 'رسالة إلى نفسي لا تسافر'); assert.ok(f1.since_ar && f1.since_ar.length >= 2);
  const f2 = publicFace(body, ['line', 'cohort_line', 'replies', 'chapters']); assert.deepEqual(f2.cards.map((c) => c.key), ['replies', 'chapters', 'cohort_line']); assert.ok(f2.cards.every((c) => c.key === 'map_code' || c.href === null), 'لا روابط داخلية على الوجه العام');
  const fr = publicFace(body, PUBLIC_DEFAULT, { revoked: true, intact: false }); assert.equal(fr.revoked, true); assert.equal(fr.intact, false);
});

test('P63 · «منذ ذلك اليوم» أعداد فقط · الدفعة والاعتماد والنبض k ≥ 5 · نصوص الإشعارات', () => {
  const s = sinceThen(src(), P.end, new Date('2026-12-07T00:00:00Z')); assert.deepEqual(s, { threads_after: 1, stations: { 30: true, 90: false, 365: false }, letter_opened: false, cohort_opened: false, days_since: 30 });
  assert.deepEqual(sinceLinesAr(s), ['ما زال ينسج: 1 خيط بعد التخرّج', 'محطات ما بعد البرنامج: شهر ✓']);
  const s2 = sinceThen(src({ threads_after: 3, grad_letter: { id: 1, state: 'opened', opens_ar: '', open_hour_ar: '' }, cohort_opened: true, stations: [{ station: 30, written: true }, { station: 90, written: true }, { station: 365, written: true }] }), P.end, new Date('2027-12-07T00:00:00Z'));
  assert.deepEqual(sinceLinesAr(s2), ['ما زال ينسج: 3 خيوط بعد التخرّج', 'محطات ما بعد البرنامج: شهر ✓ · 3 أشهر ✓ · سنة ✓', 'فتح رسالته إلى نفسه', 'قرأ ظرف دفعته']);
  assert.deepEqual(sinceLinesAr(sinceThen(src({ threads_after: 0, stations: [] }), P.end, new Date())), []);
  assert.equal(cohortLineAr(4), null); assert.equal(cohortLineAr(5), '5 من دفعتك ختموا صفحات تخرّجهم'); assert.equal(gradEvidenceLineAr(4), null); assert.match(gradEvidenceLineAr(7)!, /^7 من خرّيجي البرنامج كتبوا صفحة تخرّجهم بأيديهم/); assert.equal(pulseGradLineAr(2), null); assert.match(pulseGradLineAr(5)!, /^5 من منسوبيكم ختموا صفحة تخرّجهم هذا الشهر/);
  const n = gradDayNotice('دبلوم'); assert.match(n.title_ar, /اليوم يومك/); assert.match(n.body_ar, /«دبلوم»/); const f = farewellAskNotice('دبلوم', 'A-101', '2026-11-10'); assert.match(f.title_ar, /دفعتك تتخرّج .*— اكتب كلمة الوداع/); assert.match(f.body_ar, /شعبة A-101/);
  assert.equal(voiceOfRow({ path: 'grad-voice/u/1.webm', sec: 9 })?.sec, 9); assert.equal(voiceOfRow({ path: 'map-voice/u/1.webm', sec: 9 }), null, 'بادئة P63 فقط'); assert.equal(voiceOfRow({}), null);
});

test('P63 · الكرون: «اليوم يومك» للخرّيج يوم end_date فقط · «اكتب كلمة الوداع» للمدرّب قبلها بثلاثة أيام · dedupe · لا إشعارات رجعية', async () => {
  const now = new Date('2026-11-07T06:00:00Z'); /* 09:00 الرياض */
  const programs = [{ id: 'p63', name_ar: 'دبلوم', end_date: '2026-11-07' }, { id: 'pOld', name_ar: 'قديم', end_date: '2026-10-01' }, { id: 'pSoon', name_ar: 'قريب', end_date: '2026-11-10' }];
  const enroll = [{ id: 'e1', program_id: 'p63', email: 'a@x.sa', user_id: 'u1', status: 'approved' }, { id: 'e2', program_id: 'p63', email: 'A@x.sa', user_id: 'u1', status: 'approved' }, { id: 'e3', program_id: 'p63', email: 'b@x.sa', user_id: null, status: 'pending' }, { id: 'e4', program_id: 'pOld', email: 'c@x.sa', user_id: null, status: 'approved' }];
  const rooms = [{ id: 'c1', code: 'A-101', program_id: 'pSoon', trainer_id: 't1' }, { id: 'c2', code: 'A-102', program_id: 'pSoon', trainer_id: 't9' }, { id: 'c3', code: 'B-1', program_id: 'p63', trainer_id: 't1' }];
  const trainers = [{ id: 't1', email: 'T1@x.sa' }, { id: 't9', email: null }];
  const notices: any[] = [];
  const db: any = { from: (t: string) => { const q: any = { _eq: {} as Record<string, string>, _in: {} as Record<string, string[]> }; const chain = () => q;
    for (const op of ['select', 'gte', 'lte', 'neq', 'is', 'not', 'order']) q[op] = chain; q.eq = (k: string, v: string) => { q._eq[k] = v; return q; }; q.in = (k: string, v: string[]) => { q._in[k] = v; return q; };
    q.limit = () => { let rows: any[] = t === 'programs' ? programs : t === 'portal_enrollments' ? enroll : t === 'classrooms' ? rooms : t === 'trainers' ? trainers : [];
      for (const [k, v] of Object.entries(q._eq)) rows = rows.filter((r) => String(r[k]) === v); for (const [k, v] of Object.entries(q._in)) rows = rows.filter((r) => (v as string[]).includes(String(r[k]))); return Promise.resolve({ data: rows, error: null }); };
    const ins = (p: any) => ({ select: () => { const run = async () => { if (notices.some((n) => n.dedupe_key === p.dedupe_key)) return { data: null, error: null }; notices.push(p); return { data: [{ id: notices.length, ...p }], error: null }; }; const pr = run(); return Object.assign(pr, { single: async () => { const r = await pr; return r.data ? { data: r.data[0], error: null } : { data: null, error: { code: '23505', message: 'dup' } }; }, maybeSingle: async () => { const r = await pr; return { data: r.data ? r.data[0] : null, error: null }; } }); }, then: (r: any) => r({ data: null, error: null }) });
    q.upsert = ins; q.insert = ins; return q; } };
  const r1 = await runGradDays(db, { now, dry: false }); assert.deepEqual(r1.errors, []); assert.equal(r1.graduates, 1, 'بريد واحد (تكرار الحالة يُجمع) · pending لا · القديم لا'); assert.equal(r1.trainers, 1, 'شعبة واحدة لمدرّب له بريد — والبرنامج الذي ينتهي اليوم ليس «قبل ثلاثة أيام»');
  const g = notices.find((n) => n.kind === 'grad_day'); assert.equal(g.email, 'a@x.sa'); assert.equal(g.dedupe_key, 'grad_day:e1'); assert.equal(g.url, '/me/grad?program=p63');
  const w = notices.find((n) => n.kind === 'grad_word'); assert.equal(w.email, 't1@x.sa'); assert.equal(w.dedupe_key, 'grad_word:c1'); assert.equal(w.url, '/me/day?grad=c1');
  const r2 = await runGradDays(db, { now, dry: false }); assert.equal(r2.graduates + r2.trainers, 0, 'مرّة واحدة');
  assert.equal(KIND_AR.grad_day, 'يوم تخرّجك'); assert.equal(KIND_ICON.grad_day, '🎓'); assert.equal(KIND_AR.grad_word, 'كلمة الوداع');
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runGradDays\(db, \{ site, dry \}\)/); assert.match(cron, /org_letters, self_letters, map_nudges, media_cleanup, grad_days,/);
});

test('P63 · التوحيد: باب واحد للرسالة (P39 → P62) · كلمة الوداع في دفتر اليوم · الاعتماد 3.5 · النبض · الطريق والصوت والخزنة · شكل المصدر', () => {
  const voices = read('app/me/after/Voices.tsx'); assert.match(voices, /vo-letter-door/); assert.ok(!/action: 'letter_write'/.test(voices), 'الكتابة القديمة توقّفت في الواجهة'); assert.match(voices, /vo-grad-link/);
  const after = read('app/api/after/route.ts'); assert.match(after, /letter_write/, 'الإجراء القديم يبقى نائمًا — لا حذف'); assert.match(read('lib/after/voices-load.ts'), /gradLettersOf/); assert.match(read('lib/after/load.ts'), /gradLetters\.get\(e\.program_id\)/);
  const sl = read('app/me/letter/SelfLetter.tsx'); assert.match(sl, /qs\('door'\) !== 'grad'/); assert.match(sl, /sl-legacy/); assert.equal(DOORS_AR.grad, 'من «ما بعد البرنامج» / يوم تخرّجي'); assert.match(read('app/api/me/letter/route.ts'), /legacyLetters/);
  const day = read('lib/portal/day.ts'); assert.match(day, /input\.grad \? `🎓 كلمة الوداع من مدرّبك/); assert.match(day, /grad_word:\$\{room\.id\}:\$\{l\.email\}/); assert.match(day, /\{ grad: 1 \}/); assert.match(read('app/api/me/day/route.ts'), /grad: b\.grad === true/); const dy = read('app/me/day/DayBook.tsx'); assert.match(dy, /dy-grad/); assert.match(dy, /get\('grad'\)/);
  assert.equal(EVIDENCE_KIND_AR.grad, 'صفحات التخرّج الذاتية — كتبها الخرّيجون بأيديهم (P63)'); assert.match(read('lib/accreditation/load.ts'), /gradEvidence\(db, pid\)/); assert.match(read('lib/org-impact/pulse.ts'), /pulseGradLineAr/); assert.ok(!/grad\/store/.test(read('lib/org-impact/pulse.ts')), 'النبض لا يستورد طبقة القاعدة (حزمة العميل)'); assert.match(read('app/components/LetterSheet.tsx'), /ls-pulse-grad/);
  assert.equal(parseCommand('افتح يوم تخرجي')?.href, '/me/grad'); assert.equal(parseCommand('صفحة تخرّجي')?.href, '/me/grad'); assert.equal(parseCommand('رسالة إلى نفسي')?.href, '/me/letter', 'لم يتأثّر P62');
  assert.ok(REGISTRY.some((r) => r.table === 'portal_grad_pages' && r.policy === 'delete' && r.access.includes('self')));
  assert.ok(NO_PAGE.has('/g')); const cr = crumbsFor('/me/grad', 'ar'); assert.equal(cr[cr.length - 1].label, 'يوم تخرّجي'); assert.equal(crumbsFor('/verify/grad', 'ar').pop()!.label, 'تحقّق من صفحة تخرّج');
  assert.match(read('app/me/page.tsx'), /href="\/me\/grad" data-testid="me-grad"/);
  const sql = read('supabase/p63-grad-pages.sql'); assert.match(sql, /create table if not exists public\.portal_grad_pages/); assert.match(sql, /unique \(user_id, program_id\)/); assert.match(sql, /char_length\(line_ar\) <= 160/); assert.match(sql, /ATH-GD-\[A-Z2-9\]\{4\}-\[A-Z2-9\]\{4\}/); assert.match(sql, /enable row level security/); assert.ok(!/portal_after_letters\s+(drop|delete|alter)/i.test(sql));
  const store = read('lib/grad/store.ts'); assert.ok(!/GoogleGenerativeAI|openai|gemini/i.test(store), 'لا ذكاء اصطناعي'); assert.match(store, /is\('revoked_at', null\)/); assert.match(read('app/g/\[code\]/page.tsx'), /face=1/); assert.match(read('app/api/verify/grad/route.ts'), /rateLimit\(db, `verify:grad:/);
});
