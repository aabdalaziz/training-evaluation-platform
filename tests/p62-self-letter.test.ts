// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P62 «رسالة إلى نفسي بعد سنة» — النواة: الآفاق وساعة الكتابة · الحجب قبل الفتح · الفتح المبكّر موسوم · مرآة «ما حدث فعلًا» · السلسلة · ظرف الدفعة k ≥ 5 · الكرون داخل اليومي · الأمر الصوتي · الخزنة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { P62_NAMES_AR, HORIZONS, HORIZON_DAYS, LETTER_LIMITS, PROMPTS, promptOfDay, deliverAt, validateLetter, validateReply, validateCohortLine, letterState, toPublicLetter, mirrorOf, chainOf, cohortOpensAt, cohortEnvelope, letterCounts, pulseLetterLine, todayNoticeText, countdownAr, earlyAr, openHourAr, LETTER_PATH } from '../lib/letters/self';
import type { LetterRow } from '../lib/letters/self';
import { runSelfLetters, LETTER_COLS, SELF_NOTICE_KIND } from '../lib/letters/store';
import { parseCommand } from '../lib/portal/voice';
import { REGISTRY } from '../lib/vault/registry';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = new Date('2026-03-10T18:40:00Z'); /* كُتبت 21:40 بتوقيت الرياض */
const row = (o: Partial<LetterRow> = {}): LetterRow => ({ id: 1, created_at: W.toISOString(), user_id: 'u1', email: 'me@x.sa', body_ar: 'سرّ لا يُقرأ قبل موعده — ' + 'x'.repeat(40), media_id: null, kind: 'text', deliver_at: new Date(W.getTime() + 365 * 86400000).toISOString(), delivered_at: null, status: 'sealed', horizon: '1y', opened_at: null, opened_early: false, scope: 'self', ...o });

test('P62 · الأسماء والآفاق والحدود وبذرة اليوم', () => {
  assert.equal(P62_NAMES_AR.title, 'رسالة إلى نفسي بعد سنة'); assert.equal(P62_NAMES_AR.sub, 'إلى مَن سأكون'); assert.equal(P62_NAMES_AR.official_ar, 'الرسالة المؤجَّلة للمتدرّب'); assert.equal(P62_NAMES_AR.mirror, 'ما حدث فعلًا');
  assert.deepEqual(HORIZONS.map((h) => h.key), ['3m', '6m', '1y', 'grad']); assert.equal(HORIZON_DAYS['1y'], 365); assert.equal(LETTER_LIMITS.maxSealed, 3); assert.equal(LETTER_LIMITS.kCohort, 5); assert.equal(LETTER_LIMITS.cohortMax, 160); assert.equal(LETTER_PATH, '/me/letter');
  assert.equal(PROMPTS.length, 3); const a = promptOfDay(new Date('2026-01-01T12:00:00Z')); const b = promptOfDay(new Date('2026-01-02T12:00:00Z')); assert.notEqual(a.key, b.key, 'تتناوب يومًا بيوم'); assert.equal(promptOfDay(new Date('2026-01-01T01:00:00Z')).key, a.key, 'ثابتة خلال اليوم');
});

test('P62 · موعد الفتح يحمل ساعة الكتابة · «عند تخرّجي» من تاريخ نهاية البرنامج · الأخطاء', () => {
  const y = deliverAt(W, '1y'); assert.ok(y.ok); if (y.ok) { assert.equal(y.at.toISOString(), '2027-03-10T18:40:00.000Z'); assert.equal(openHourAr(y.at.toISOString()), '21:40', 'ساعة الكتابة بتوقيت الرياض'); }
  const q = deliverAt(W, '3m'); assert.ok(q.ok && q.at.getTime() - W.getTime() === 91 * 86400000);
  const g = deliverAt(W, 'grad', '2026-06-30'); assert.ok(g.ok); if (g.ok) assert.equal(g.at.toISOString(), '2026-06-30T18:40:00.000Z', 'يوم التخرّج بساعة الكتابة');
  assert.equal((deliverAt(W, 'grad', null) as any).ok, false); assert.match((deliverAt(W, 'grad', '2026-03-10') as any).error, /قبل الغد/); assert.equal((deliverAt(W, 'bad' as any) as any).ok, false);
  assert.match(validateLetter({ body_ar: 'قصير' }) || '', /40 حرفًا/); assert.equal(validateLetter({ body_ar: '', media_id: 'm' }), null, 'صوت بلا نصّ مقبول'); assert.match(validateLetter({ body_ar: 'x'.repeat(41), horizon: '9y' }) || '', /أفق/); assert.match(validateLetter({ body_ar: 'x'.repeat(3001) }) || '', /أطول/);
  assert.match(validateReply({}) || '', /اكتب ردًّا/); assert.equal(validateReply({ reply_ar: 'أهلًا بك يا أنا' }), null);
  assert.match(validateCohortLine('قصير') || '', /عشرة/); assert.match(validateCohortLine('x'.repeat(161)) || '', /160/); assert.match(validateCohortLine('راسلوني على a@b.sa إن أردتم') || '', /بلا بريد/); assert.equal(validateCohortLine('لا تنسوا أول يوم — كنا نرتجف ونضحك'), null);
});

test('P62 · الحالة: مختومة → اليوم → جاهزة → مفتوحة · العدّ التنازلي · الحجب قبل الفتح · وسم الفتح المبكّر', () => {
  const l = row(); const open = new Date(l.deliver_at);
  assert.equal(letterState(l, new Date(open.getTime() - 40 * 86400000)).state, 'sealed'); assert.equal(letterState(l, new Date(open.getTime() - 40 * 86400000)).days_left, 40);
  assert.equal(letterState(l, new Date(open.getTime() - 3 * 3600000)).state, 'today', 'اليوم نفسه (بتوقيت الرياض) قبل الساعة'); assert.equal(letterState(l, new Date(open.getTime() + 60000)).state, 'ready'); assert.equal(letterState({ ...l, opened_at: open.toISOString() }, open).state, 'opened');
  assert.equal(countdownAr(1), 'غدًا'); assert.equal(countdownAr(2), 'بعد يومين'); assert.equal(countdownAr(5), 'بعد 5 أيام'); assert.equal(countdownAr(40), 'بعد 40 يومًا'); assert.equal(earlyAr(90), 'فُتحت قبل أوانها بـ 90 يومًا');
  const sealedPub = toPublicLetter(l, new Date(open.getTime() - 86400000 * 10)); assert.equal(sealedPub.body_ar, null, 'النصّ لا يغادر الخادم قبل الفتح'); assert.equal(sealedPub.media_id, null); assert.equal(sealedPub.state, 'sealed'); assert.equal(sealedPub.open_hour_ar, '21:40'); assert.equal(sealedPub.horizon, '1y');
  const earlyOpen = new Date(open.getTime() - 90 * 86400000); const ep = toPublicLetter({ ...l, opened_at: earlyOpen.toISOString(), opened_early: true }, earlyOpen); assert.equal(ep.state, 'opened'); assert.equal(ep.body_ar, l.body_ar, 'بعد الفتح يصل النصّ'); assert.equal(ep.opened_early, true); assert.equal(ep.early_days, 90, 'وسم صادق: قبل أوانها بـ 90 يومًا');
  const ontime = toPublicLetter({ ...l, opened_at: open.toISOString(), opened_early: false }, open); assert.equal(ontime.early_days, null);
});

test('P62 · مرآة «ما حدث فعلًا»: أعداد منذ الكتابة فقط · هادئة بصدق · لا أحكام', () => {
  const at = (d: number) => new Date(W.getTime() + d * 86400000).toISOString();
  const m = mirrorOf({ written_at: W.toISOString(), now: new Date(W.getTime() + 365 * 86400000), chapters: [{ kind: 'level', at: at(-5) }, { kind: 'level', at: at(30) }, { kind: 'credential', at: at(200) }, { kind: 'daily', at: at(10) }, { kind: 'daily', at: at(11) }, { kind: 'mission', at: at(400) }],
    threads: [{ decided_at: at(50), status: 'kept', from_key: 'program:p1', to_key: 'skill:s' }, { decided_at: at(51), status: 'kept', from_key: 'daily:1', to_key: 'mission:1' }, { decided_at: at(52), status: 'declined', from_key: 'a', to_key: 'b' }, { decided_at: at(-1), status: 'kept', from_key: 'program:p1', to_key: 'x' }], words: [{ created_at: at(3) }, { created_at: at(-3) }], letters_written: 1 });
  const n = Object.fromEntries(m.lines.map((l) => [l.key, l.n]));
  assert.equal(n.chapters, 4, 'الفصول بعد الكتابة وقبل الآن فقط (لا قبلها ولا بعد الآن)'); assert.equal(n.levels, 1); assert.equal(n.credentials, 1); assert.equal(n.daily, 2); assert.equal(n.missions, undefined, 'مهمة بعد «الآن» لا تُحتسب');
  assert.equal(n.threads, 2, 'المبقاة فقط'); assert.equal(n.program_threads, 1); assert.equal(n.words, 1); assert.equal(n.letters, 1); assert.equal(m.quiet, false); assert.equal(m.days, 365);
  assert.match(m.summary_ar, /^منذ كتبتَها قبل 365 يومًا: 4 فصل جديد في رحلتك/); assert.match(m.summary_ar, /أعداد لا أحكام/); assert.doesNotMatch(m.summary_ar, /٪|نسبة|تحقّق/);
  const q = mirrorOf({ written_at: W.toISOString(), now: new Date(W.getTime() + 10 * 86400000), chapters: [], threads: [], words: [], letters_written: 0 }); assert.equal(q.quiet, true); assert.equal(q.lines.length, 0); assert.match(q.summary_ar, /هادئة — وهذا أيضًا خبر/);
});

test('P62 · «سلسلة سنواتي» بترتيب الكتابة · ظرف الدفعة: موعده وk ≥ 5 وخلط ثابت · أعداد الإدارة · سطر النبض', () => {
  const ls = [row({ id: 2, created_at: '2027-03-10T18:40:00Z', opened_at: '2028-03-10T18:40:00Z' }), row({ id: 1, opened_at: '2027-03-10T18:40:00Z', replied_at: '2027-03-11T00:00:00Z' })].map((r) => toPublicLetter(r, new Date('2028-06-01T00:00:00Z')));
  const ch = chainOf(ls); assert.deepEqual(ch.map((c) => c.id), [1, 2]); assert.equal(ch[0].replied, true); assert.equal(ch[1].replied, false); assert.equal(ch[0].horizon_ar, 'بعد سنة');
  const opens = cohortOpensAt('2026-06-30'); assert.equal(opens.toISOString(), '2027-06-30T06:00:00.000Z', 'سنة بعد نهاية البرنامج · 09:00 الرياض');
  const lines = Array.from({ length: 5 }, (_, i) => ({ body_ar: `سطر ${i}`, created_at: `2026-06-0${i + 1}T00:00:00Z` }));
  const before = cohortEnvelope(lines, opens, new Date('2027-01-01T00:00:00Z')); assert.equal(before.ready, false); assert.equal(before.lines.length, 0, 'قبل الموعد لا شيء'); assert.ok(before.days_left > 100);
  const few = cohortEnvelope(lines.slice(0, 4), opens, new Date('2027-07-01T00:00:00Z')); assert.equal(few.ready, false); assert.equal(few.below_k, true, 'أقل من 5 يبقى مغلقًا');
  const ok = cohortEnvelope(lines, opens, new Date('2027-07-01T00:00:00Z')); assert.equal(ok.ready, true); assert.equal(ok.lines.length, 5); assert.notDeepEqual(ok.lines, lines.map((l) => l.body_ar), 'ليس بالترتيب الزمني'); assert.deepEqual(ok.lines, cohortEnvelope(lines, opens, new Date('2027-08-01T00:00:00Z')).lines, 'خلط ثابت');
  const c = letterCounts([row(), row({ opened_at: 'x', opened_early: true }), row({ opened_at: 'x', replied_at: 'y' }), row({ scope: 'cohort' }), row({ status: 'cancelled' })]); assert.deepEqual(c, { sealed: 1, opened: 2, replied: 1, early: 1, cohort_lines: 1 });
  assert.equal(pulseLetterLine(4), null); assert.match(pulseLetterLine(5) || '', /^5 من منسوبيكم كتبوا رسائل إلى أنفسهم/);
});

test('P62 · الكرون: إشعار «اليوم تُفتح — الساعة» لرسائل اليوم فقط · مرّة واحدة (dedupe) · ليس لظرف الدفعة · داخل الكرون اليومي بعد org_letters', async () => {
  const now = new Date('2027-03-10T06:00:00Z'); /* 09:00 الرياض يوم الفتح */
  const rows = [row({ id: 1 }), row({ id: 2, deliver_at: '2027-03-11T18:40:00Z' }), row({ id: 3, opened_at: '2027-03-10T05:00:00Z' }), row({ id: 4, scope: 'cohort' }), row({ id: 5, status: 'cancelled' })];
  const notices: any[] = []; const db: any = { from: (t: string) => { const q: any = { _f: [] as any[] }; const chain = () => q; for (const op of ['select', 'gte', 'lte', 'neq', 'is', 'eq', 'order']) q[op] = chain; q.limit = () => Promise.resolve({ data: t === 'portal_time_capsules' ? rows.filter((r) => r.status !== 'cancelled' && !r.opened_at) : [], error: null });
    q.upsert = (p: any) => ({ select: () => ({ maybeSingle: async () => { if (notices.some((n) => n.dedupe_key === p.dedupe_key)) return { data: null, error: { code: '23505' } }; notices.push(p); return { data: { id: notices.length, ...p }, error: null }; } }) });
    q.insert = (p: any) => ({ select: () => ({ maybeSingle: async () => { if (notices.some((n) => n.dedupe_key === p.dedupe_key)) return { data: null, error: { code: '23505' } }; notices.push(p); return { data: { id: notices.length, ...p }, error: null }; } }), then: (r: any) => r({ data: null, error: null }) }); return q; } };
  const r1 = await runSelfLetters(db, { now, dry: true }); assert.equal(r1.scanned, 1, 'رسالة اليوم فقط (لا غدًا، لا المفتوحة، لا الدفعة)'); assert.deepEqual(r1.errors, []);
  const t = todayNoticeText(rows[0]); assert.equal(t.title_ar, 'اليوم تُفتح رسالتك إلى نفسك — الساعة 21:40'); assert.match(t.body_ar, /لا يقرؤها أحد غيرك/);
  assert.equal(KIND_AR[SELF_NOTICE_KIND], 'رسالة إلى نفسك'); assert.equal(KIND_ICON[SELF_NOTICE_KIND], '✉️');
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runSelfLetters\(db, \{ dry \}\)/); assert.match(cron, /day_digest, week_echo, org_letters, self_letters/); assert.match(cron, /org_letters, self_letters, map_nudges, media_cleanup/);
  assert.match(LETTER_COLS, /horizon,opened_at,opened_early,reply_ar,reply_media_id,replied_at,chain_of,prompt_key,context_key,program_id,scope$/);
  const sql = read('supabase/migrations/20270209_portal_p62_self_letter.sql'); for (const c of ['horizon', 'opened_at', 'opened_early', 'reply_ar', 'reply_media_id', 'replied_at', 'chain_of', 'prompt_key', 'context_key', 'program_id', 'scope']) assert.match(sql, new RegExp(`add column if not exists ${c}`)); assert.match(sql, /portal_time_capsules_cohort_one_idx/); assert.match(sql, /new_cols = 11/);
});

test('P62 · الأمر الصوتي · الخزنة · الصفحة والأبواب · الصوت لا يسافر (لا بريد يحمل النصّ)', () => {
  assert.equal(parseCommand('افتح رسالتي إلى نفسي').kind, 'go'); assert.equal((parseCommand('رسالة إلى نفسي') as any).href, '/me/letter'); assert.equal((parseCommand('سلسلة سنواتي') as any).href, '/me/letter'); assert.equal((parseCommand('رسالة الشهر', { admin: true }) as any).href, '/admin/org/letters', 'لا تداخل مع رسالة الشهر'); assert.equal((parseCommand('نبض جهتي') as any).href, '/org?tab=letters');
  const v = REGISTRY.find((r) => r.table === 'portal_time_capsules')!; assert.ok(v.piiCols.includes('reply_ar')); assert.deepEqual(v.access, ['self'], 'صاحبها فقط'); assert.match(v.purpose_ar, /ساعة كتابتها/);
  const page = read('app/me/letter/SelfLetter.tsx'); for (const id of ['sl-env', 'sl-env-open', 'sl-env-del', 'sl-opened', 'sl-mirror', 'sl-reply-send', 'sl-next', 'sl-chain', 'sl-cohort', 'sl-horizon', 'sl-seal']) assert.ok(page.includes(`data-testid="${id}"`), id);
  assert.ok(page.includes('video={false}'), 'بلا فيديو — نصّ أو صوت'); assert.doesNotMatch(page, /runAi|GEMINI|openai/i, 'لا ذكاء اصطناعي');
  assert.ok(read('app/me/page.tsx').includes('href="/me/letter"')); assert.ok(read('app/me/athar-map/AtharMapDesk.tsx').includes('/me/letter?door=map_sign')); assert.ok(read('app/components/Accreditation.tsx').includes('/me/letter?door=weave')); assert.ok(read('app/me/journey/page.tsx').includes('href="/me/letter"'), 'رحلتي تحيل إلى الصفحة الجديدة');
  const store = read('lib/letters/store.ts'); assert.ok(store.includes("context_type: 'self_letter'") && store.includes('mediaGraceDays'), 'الصوت لا ينتهي قبل موعد الفتح (إصلاح موروث من P25)'); assert.doesNotMatch(store, /sendEmail|notify\(/, 'لا بريد يحمل النصّ — إشعار داخلي فقط حتى (ج)');
  const api = read('app/api/me/letter/route.ts'); assert.doesNotMatch(api, /admin=1|staff/, 'لا قراءة إدارية للمحتوى');
});

test('P62 · كرون «رحلتي» القديم لا يرسل رسائل P62 ولا أسطر الدفعة بالبريد — الكبسولات القديمة فقط', async () => {
  const { isLegacyCapsule, CAPSULE_COLS } = await import('../lib/journey/cron');
  assert.ok(CAPSULE_COLS.includes('context_key') && CAPSULE_COLS.includes('scope'));
  assert.equal(isLegacyCapsule({}), true); /* صفّ قبل الترحيل */
  assert.equal(isLegacyCapsule({ context_key: 'journey', scope: 'self' }), true); /* كبسولة P25 بعد التعبئة */
  assert.equal(isLegacyCapsule({ context_key: 'free', scope: 'self' }), false); /* رسالة P62 — تُفتح باليد */
  assert.equal(isLegacyCapsule({ context_key: 'map_sign', scope: 'self' }), false);
  assert.equal(isLegacyCapsule({ context_key: 'cohort', scope: 'cohort' }), false); /* سطر الدفعة — لا بريد أبدًا */
  const src = read('lib/journey/cron.ts'); assert.ok(/\.filter\(isLegacyCapsule\)/.test(src));
});
