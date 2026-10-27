// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P13-ب: إشعارات الويب (RFC 8291 متجهات رسمية · VAPID) · الطيار المساعد الحي (النبض، المقترحات، محضر الأثر) · «ماذا لو؟» والمقارنة المجهولة · جسر المصنع ↔ عقود الأثر
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, verify } from 'crypto';
import { b64u, encryptPayload, decryptPayload, generateVapidKeys, vapidHeaders, vapidFromEnv, validateSubscription, dailyCaseMessage, runDailyPush, sendPush } from '../lib/portal/push';
import { computePulse, suggest, buildLocalMemo, parseMemo, engagementCurve, memoText } from '../lib/portal/copilot';
import type { Pulse } from '../lib/portal/copilot';
import { CASE_BANK, seedToCase, localEvaluate, whatIfFor, parseWhatIf, evaluateRound2, crowdOf, crowdLine, RUBRIC_LABEL } from '../lib/portal/daily-case';
import { EMPTY_NEED, localForesight, localDesign, contractProposalFrom, contractUrlFor, contractPrefillFromQuery } from '../lib/portal/factory';
import type { Draft, Need } from '../lib/portal/factory';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';

// ====================================================================== Web Push
const UA_PUB = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const UA_PRIV = 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94';
const AUTH = 'BTBZMqHH6r4Tts7J_aSIgg';
test('push: RFC 8291 Appendix A — matches the official ciphertext byte-for-byte', () => {
  const out = encryptPayload('When I grow up, I want to be a watermelon', UA_PUB, AUTH, { salt: b64u.dec('DGv6ra1nlYgDCS1FRnbzlw'), asPrivateKey: b64u.dec('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw') });
  assert.equal(b64u.enc(out), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN', 'ciphertext must equal RFC vector');
  assert.equal(out.length, 144, 'header 86 + plaintext 41 + delimiter 1 + tag 16');
});
test('push: round trip with random keys and Arabic JSON payload', () => {
  const msg = JSON.stringify({ title: 'موقف اليوم في أَثَر', body: 'كيف تتصرّف؟', url: '/#daily' });
  const body = encryptPayload(msg, UA_PUB, AUTH);
  assert.equal(decryptPayload(body, b64u.dec(UA_PRIV), AUTH).toString('utf8'), msg, 'decrypt(encrypt(m)) = m');
  assert.throws(() => encryptPayload('x', 'AAAA', AUTH), /p256dh/, 'rejects a bad browser key');
  assert.throws(() => encryptPayload('x'.repeat(4100), UA_PUB, AUTH), /أطول/, 'rejects oversize record');
});
test('push: VAPID keys + ES256 JWT verifies with the public key and carries aud/sub/exp', () => {
  const k = generateVapidKeys(); assert.equal(b64u.dec(k.publicKey).length, 65, 'public key 65 bytes'); assert.equal(b64u.dec(k.privateKey).length, 32, 'private key 32 bytes');
  const h = vapidHeaders('https://fcm.googleapis.com/fcm/send/abc', { ...k, subject: 'mailto:a@b.c' }, 1_700_000_000_000);
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(h.Authorization); assert.ok(m, 'authorization format'); assert.equal(m![2], k.publicKey, 'k = public key');
  const [hh, cc, ss] = m![1].split('.'); const pub = b64u.dec(k.publicKey);
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u.enc(pub.subarray(1, 33)), y: b64u.enc(pub.subarray(33, 65)) } as any, format: 'jwk' });
  assert.equal(verify('sha256', Buffer.from(`${hh}.${cc}`), { key, dsaEncoding: 'ieee-p1363' }, b64u.dec(ss)), true, 'signature verifies');
  const claims = JSON.parse(b64u.dec(cc).toString()); assert.equal(claims.aud, 'https://fcm.googleapis.com', 'aud = origin'); assert.equal(claims.sub, 'mailto:a@b.c', 'sub'); assert.equal(claims.exp, 1_700_000_000 + 12 * 3600, 'exp = +12h');
  assert.equal(vapidFromEnv({} as any), null, 'missing env → null'); assert.equal(vapidFromEnv({ VAPID_PUBLIC_KEY: 'bad', VAPID_PRIVATE_KEY: 'bad' } as any), null, 'bad env → null');
  assert.ok(vapidFromEnv({ VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey } as any)?.subject.startsWith('mailto:'), 'default subject');
});
test('push: subscription validation + daily message + runDailyPush (sent/gone/skipped, dry)', async () => {
  assert.ok(validateSubscription({ endpoint: 'https://push.example/x', keys: { p256dh: UA_PUB, auth: AUTH } }), 'valid browser subscription');
  assert.equal(validateSubscription({ endpoint: 'http://insecure', keys: { p256dh: UA_PUB, auth: AUTH } }), null, 'http endpoint rejected');
  assert.equal(validateSubscription({ endpoint: 'https://x', keys: { p256dh: UA_PUB, auth: 'short' } }), null, 'bad auth rejected');
  const m = dailyCaseMessage({ title_ar: 'المؤشر الأخضر الذي يكذب', event_name_ar: 'اليوم العالمي للجودة' }, 'ar', 'https://athar.example');
  assert.ok(m.body.includes('المؤشر الأخضر') && m.body.includes('اليوم العالمي للجودة'), 'message mentions case + event'); assert.equal(m.url, 'https://athar.example/#daily', 'deep link to #daily'); assert.equal(m.tag, 'daily', 'topic tag');
  const k = generateVapidKeys(); const env = { VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey } as any;
  const subs = [
    { id: 'a', endpoint: 'https://push.example/ok', p256dh: UA_PUB, auth: AUTH, lang: 'ar', last_sent_at: null, topics: ['daily'] },
    { id: 'b', endpoint: 'https://push.example/gone', p256dh: UA_PUB, auth: AUTH, lang: 'en', last_sent_at: null, topics: ['daily'] },
    { id: 'c', endpoint: 'https://push.example/today', p256dh: UA_PUB, auth: AUTH, lang: 'ar', last_sent_at: '2026-10-28T03:00:00Z', topics: ['daily'] },
    { id: 'd', endpoint: 'https://push.example/other', p256dh: UA_PUB, auth: AUTH, lang: 'ar', last_sent_at: null, topics: ['live'] },
  ];
  const updates: any[] = []; const posted: { url: string; headers: Record<string, string>; len: number }[] = [];
  const db = { from: (t: string) => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: t === 'portal_push_subscriptions' ? subs : [] }) }) }), update: (row: any) => ({ eq: async (_c: string, id: string) => { updates.push({ id, ...row }); return { error: null }; } }) }) } as any;
  const fetchImpl: any = async (url: string, init: any) => { posted.push({ url, headers: init.headers, len: init.body.length }); return { status: url.endsWith('/gone') ? 410 : 201, ok: !url.endsWith('/gone') }; };
  const r = await runDailyPush(db, 'https://athar.example', '2026-10-28', { title_ar: 'x' }, { env, fetchImpl });
  assert.deepEqual([r.sent, r.gone, r.skipped, r.failed], [1, 1, 1, 0], 'one sent, one gone, one already today, one other topic ignored');
  assert.equal(posted.length, 2, 'two HTTP posts'); assert.equal(posted[0].headers['Content-Encoding'], 'aes128gcm', 'content-encoding'); assert.ok(posted[0].headers.Authorization.startsWith('vapid t='), 'vapid header'); assert.equal(posted[0].headers.TTL, '36000', 'ttl 10h');
  assert.ok(updates.find(u => u.id === 'b' && u.active === false), 'gone subscription deactivated'); assert.ok(updates.find(u => u.id === 'a' && u.last_sent_at), 'sent subscription stamped');
  const dry = await runDailyPush(db, 'https://athar.example', '2026-10-28', { title_ar: 'x' }, { env, fetchImpl, dry: true }); assert.equal(dry.sent, 2, 'dry run counts without sending');
  const off = await runDailyPush(db, 'https://athar.example', '2026-10-28', { title_ar: 'x' }, { env: {} as any, fetchImpl }); assert.equal(off.reason, 'vapid_missing', 'no keys → graceful skip');
  const bad = await sendPush(subs[0] as any, { title: 't', body: 'b' }, { ...k, subject: 'mailto:x@y.z' }, { fetchImpl: async () => { throw new Error('net'); } }); assert.equal(bad.ok, false, 'network error is reported, not thrown');
  assert.equal(AI_LIMITS.copilot_memo, 20, 'copilot_memo limit'); assert.equal(AI_LIMITS.daily_case_whatif, 4, 'whatif limit'); assert.ok(AI_PURPOSE_LABEL.copilot_memo.ar.includes('الطيار'), 'label');
});

// ====================================================================== الطيار المساعد
const T0 = new Date('2026-10-28T06:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60000).toISOString();
const SES = { id: 's1', status: 'live', starts_at: T0.toISOString(), duration_min: 60 };
function pulseAt(min: number, o: Partial<Parameters<typeof computePulse>[0]> = {}): Pulse {
  return computePulse({ session: SES, registered: 20, joinedEvents: [], activities: [], responses: [], notes: 0, now: new Date(T0.getTime() + min * 60000), ...o });
}
test('copilot: computePulse derives elapsed/fraction/join rate/last activity rate', () => {
  const joined = Array.from({ length: 8 }, (_, i) => ({ user_id: `u${i}`, created_at: at(1) }));
  const acts = [{ id: 'a1', kind: 'mcq', created_at: at(10), active: true }];
  const resp = [{ activity_id: 'a1', created_at: at(11) }, { activity_id: 'a1', created_at: at(12) }];
  const p = pulseAt(15, { joinedEvents: joined, activities: acts, responses: resp });
  assert.equal(p.elapsed_min, 15, 'elapsed'); assert.equal(p.fraction, 0.25, 'fraction'); assert.equal(p.joined, 8, 'joined unique'); assert.equal(p.join_rate, 0.4, 'join rate');
  assert.equal(p.last_activity_min_ago, 5, 'last activity 5 min ago'); assert.equal(p.last_activity_answered, 2, 'answered'); assert.equal(p.last_activity_rate, 0.25, '2 of 8'); assert.equal(p.responses_last10, 2, 'last 10 min');
});
test('copilot: suggestions follow transparent rules and respect accepted/dismissed', () => {
  const ctx = { title_ar: 'جلسة', skills: [{ id: 'k1', name_ar: 'الحكم المهني' }] };
  const open = suggest(pulseAt(2), ctx); assert.equal(open[0]?.code, 'open_rating', 'minute 2 with no activity → opening self-rating'); assert.equal(open[0]?.activity?.kind, 'self_rating', 'activity kind');
  assert.ok(open[0]!.activity!.prompt_ar.includes('الحكم المهني'), 'prompt names the skill');
  const joined5 = Array.from({ length: 5 }, (_, i) => ({ user_id: `u${i}`, created_at: at(1) }));
  const absent = suggest(pulseAt(12, { joinedEvents: joined5 }), ctx); assert.ok(absent.some(s => s.code === 'remind_absent' && s.kind === 'remind'), '5/20 joined at minute 12 → remind');
  const silent = suggest(pulseAt(16, { joinedEvents: joined5, activities: [{ id: 'a1', kind: 'mcq', created_at: at(11), active: true }], responses: [{ activity_id: 'a1', created_at: at(12) }] }), ctx);
  assert.ok(silent.some(s => s.code === 'breakout_small'), '1 of 5 answered after 5 min → breakout');
  const late = suggest(pulseAt(50, { joinedEvents: joined5 }), ctx); assert.ok(late.some(s => s.code === 'close_reflection'), 'last quarter with no reflection → closing commitment');
  const none = suggest(pulseAt(50, { joinedEvents: joined5 }), { ...ctx, dismissed: ['close_reflection', 'mini_case'], accepted: ['wrap'] }); assert.ok(!none.some(s => ['close_reflection', 'mini_case', 'wrap'].includes(s.code)), 'dismissed/accepted codes are not repeated');
  const ended = suggest(computePulse({ session: { ...SES, status: 'ended' }, registered: 1, joinedEvents: [], activities: [], responses: [], notes: 0 }), ctx); assert.equal(ended[0]?.code, 'memo', 'ended → memo');
  const sched = suggest(computePulse({ session: { ...SES, status: 'scheduled' }, registered: 1, joinedEvents: [], activities: [], responses: [], notes: 0 }), ctx); assert.equal(sched[0]?.code, 'start', 'scheduled → start hint');
  assert.ok(suggest(pulseAt(30, { joinedEvents: joined5 }), ctx).length <= 4, 'max 4 suggestions');
});
test('copilot: local memo reports attendance, curve, gaps and next steps; AI parse keeps numbers', () => {
  const joined = Array.from({ length: 4 }, (_, i) => ({ user_id: `u${i}`, created_at: at(1) }));
  const acts = [{ id: 'a1', kind: 'reflection', prompt_ar: 'ما الذي ستطبّقه غدًا؟', created_at: at(45), active: true }];
  const resp = [{ activity_id: 'a1', created_at: at(47), answer: { text: 'سأبدأ اجتماع الغد بسؤال الأطراف قبل أن أقرّر أي شيء جديد' } }, { activity_id: 'a1', created_at: at(48), answer: { text: 'قصير' } }];
  const p = computePulse({ session: { ...SES, status: 'ended' }, registered: 10, joinedEvents: joined, activities: acts, responses: resp, notes: 1, now: new Date(T0.getTime() + 61 * 60000) });
  const m = buildLocalMemo({ session: { title_ar: 'قرارات تحت الضغط', starts_at: SES.starts_at, duration_min: 60 }, pulse: p, activities: acts, responses: resp, notes: [{ at: at(20), text: 'نقاش حقيقي', min: 20 }], skills: [{ id: 'k1', name_ar: 'الحكم المهني' }], accepted: ['open_rating'] });
  assert.equal(m.attendance.rate, 40, '4 of 10'); assert.equal(m.engagement.length, 6, 'six 10-min buckets'); assert.equal(m.engagement[4].responses, 2, 'both responses in bucket 40–50');
  assert.ok(m.gaps_ar.some(g => g.includes('غاب 6')), 'absence gap'); assert.ok(m.highlights_ar.some(h => h.includes('التزامًا مكتوبًا')), 'written commitments highlighted'); assert.ok(m.moments_ar[0].startsWith('د20'), 'moment with minute');
  assert.ok(m.summary_ar.includes('قرارات تحت الضغط') && m.summary_ar.includes('الحكم المهني'), 'summary names session + skill'); assert.ok(m.next_ar[0].includes('7 أيام'), 'follow-up after 7 days when commitments exist');
  assert.equal(parseMemo('نص غير JSON', m), null, 'garbage → null'); assert.equal(parseMemo({ summary_ar: 'قصير' }, m), null, 'too-short summary → null');
  const ai = parseMemo({ summary_ar: 'س'.repeat(80), highlights_ar: ['أ'], next_ar: [] }, m)!; assert.equal(ai.source, 'ai', 'ai source'); assert.deepEqual(ai.next_ar, m.next_ar, 'empty arrays fall back to local'); assert.equal(ai.attendance.rate, 40, 'numbers untouched');
  assert.ok(memoText(m).includes('محضر الأثر'), 'memo text'); assert.equal(engagementCurve([], SES.starts_at, 25).length, 3, 'ceil(25/10)');
});

// ====================================================================== «ماذا لو؟» والمقارنة
const CASE = seedToCase(CASE_BANK.find(c => c.slug === 'quality-indicator-lies')!, '2026-10-28', null, []);
const WEAK = 'أرى أن المؤشرات ممتازة وسأنشرها اليوم كما طلب المدير لأن الأرقام واضحة ولا داعي للتأخير في الاجتماع.';
test('whatif: targets the most-missed rubric, AI parse is safe, round two detects stance and shift', () => {
  const ev = localEvaluate(CASE, WEAK); const w = whatIfFor(CASE, ev);
  assert.equal(ev.rubric_hits.find(h => h.code === w.tests)?.hit, 0, 'picks a rubric that scored 0'); assert.ok(w.text_ar.length > 30 && w.ask_ar.length > 10, 'text + ask'); assert.equal(w.source, 'local', 'local source');
  assert.equal(parseWhatIf('{"text_ar":"قصير","ask_ar":"؟"}', w), null, 'too short → null'); assert.equal(parseWhatIf({ text_ar: 'م'.repeat(40), ask_ar: 'س'.repeat(12) }, w)?.source, 'ai', 'valid → ai');
  const r2a = evaluateRound2(CASE, w, ev, 'أتراجع عن النشر اليوم. أولًا أطلب من المدقق والمشرفين والمتدربين والإدارة اجتماعًا قصيرًا، ثانيًا أوقف الاستبانة داخل القاعة وأعيد القياس بعد 30 يومًا بمؤشر سلوك، ثالثًا أفصح للمدير بصدق عن ما رأيته وأتحمّل المسؤولية.');
  assert.equal(r2a.stance, 'revised', 'revised stance'); assert.ok(r2a.shift > 0, 'better rubric coverage raises shift'); assert.ok(evaluateRound2(CASE, w, ev, 'أتراجع. أتحدث مع المدير، وأسأل المدربون والمتدربون أولًا، ثم أقرّر بعد 30 يومًا بمؤشر سلوك واضح، وأبلغ جهة الاعتماد بصدق.').shift >= 0, 'a short but structured answer is not penalised for length'); assert.ok(r2a.verdict_ar.includes('راجعتَ قرارك'), 'verdict names revision'); assert.ok(r2a.adaptability_ar.length > 10, 'adaptability line');
  const r2b = evaluateRound2(CASE, w, ev, 'أبقى على قراري ولا أغيّر شيئًا لأن المدير طلب ذلك والأرقام جيدة وسننشرها اليوم كما هي.'); assert.equal(r2b.stance, 'held', 'held stance');
  const r2c = evaluateRound2(CASE, w, ev, 'سأفكر في الأمر لاحقًا وأرى ما يحدث في الاجتماع ثم أتصرّف بحسب الظروف.'); assert.equal(r2c.stance, 'unclear', 'unclear stance');
});
test('crowd: anonymous aggregate + comparison line with Arabic number grammar', () => {
  const rows = [
    { user_id: 'me', score: 70, band: 'distinguished', evaluation: { rubric_hits: [{ code: 'frame', hit: 2 }, { code: 'follow_up', hit: 0 }] }, round2: { stance: 'revised' } },
    { user_id: 'a', score: 30, band: 'emerging', evaluation: { rubric_hits: [{ code: 'frame', hit: 1 }, { code: 'follow_up', hit: 0 }] } },
    { user_id: 'b', score: 50, band: 'capable', evaluation: { band: 'capable' } },
    { user_id: null, score: 90, band: 'exceptional', evaluation: { band: 'exceptional', score: 90 } },
  ];
  const c = crowdOf(rows); assert.equal(c.n, 4, 'n'); assert.equal(c.avg, 60, 'avg'); assert.deepEqual(c.bands, { emerging: 1, capable: 1, distinguished: 1, exceptional: 1 }, 'bands');
  assert.equal(c.most_missed, 'follow_up', 'most missed rubric'); assert.equal(c.rubric_rates.find(r => r.code === 'frame')?.rate, 100, 'frame hit rate'); assert.equal(c.stances?.revised, 1, 'stances counted');
  const me = localEvaluate(CASE, WEAK); const line = crowdLine({ ...me, score: 70 }, c, rows.filter(r => r.user_id !== 'me'));
  assert.ok(line.includes('3 أشخاص آخرون') && line.includes('أعلى من 67%'), `others + percentile: ${line}`); assert.ok(crowdLine({ ...me, score: 70 }, crowdOf(rows.slice(0, 3)), rows.slice(1, 3)).includes('تعامل شخصان آخران'), 'dual without numeral'); assert.ok(crowdLine({ ...me, score: 70 }, crowdOf(rows.slice(0, 2)), rows.slice(1, 2)).includes('شخص واحد آخر'), 'singular'); assert.ok(line.includes(RUBRIC_LABEL.follow_up.ar), 'names most-missed');
  assert.equal(crowdLine(null, crowdOf([]), []), 'أنت أول من تعامل مع هذا الموقف اليوم.', 'empty'); assert.ok(crowdLine(null, c, rows).includes('4 أشخاص'), 'visitor line'); assert.ok(crowdLine({ ...me, score: 10 }, crowdOf([rows[0]]), []).includes('أول من'), 'alone today');
  const many = crowdOf(Array.from({ length: 12 }, (_, i) => ({ user_id: `u${i}`, score: 50 }))); assert.ok(crowdLine(null, many, []).includes('12 شخصًا'), '11+ → شخصًا');
});

// ====================================================================== جسر المصنع ↔ العقود
test('factory bridge: proposal carries indicators/split/targets, URL round-trips through the contracts prefill', () => {
  const need: Need = { ...EMPTY_NEED, sector: 'health', domain_code: 'judgment', family: 'judgment_accountability', stage: 'adulthood', institution: 'work', horizon: 2035, audience_ar: 'مشرفو الجودة', gap_ar: 'الاعتماد على المؤشرات بلا شواهد' };
  const fs = localForesight(need); const des = localDesign(need, fs);
  const d: Draft = { id: '11111111-2222-4333-8444-555555555555', created_at: '', title_ar: 'x', need, stage: 'published', foresight: fs, design: des, review: null, program_id: '99999999-0000-4000-8000-000000000001', notes: null, log: [] };
  const p = contractProposalFrom(d);
  assert.ok(p.title_ar.startsWith('عقد أثر — '), 'title'); assert.equal(p.split.delivery + p.split.evidence + p.split.impact, 100, 'split sums to 100'); assert.ok(p.indicators.length >= 3, 'indicators from design'); assert.ok(p.notes.includes('مؤشرات الأثر') && p.notes.includes('1)'), 'notes enumerate indicators'); assert.equal(p.targets.impact_days, 90, '2035 → 90 days');
  const url = contractUrlFor(d); assert.ok(url.startsWith('/admin/contracts?new=1'), 'url'); const pre = contractPrefillFromQuery(url.slice(url.indexOf('?')))!;
  assert.equal(pre.program_id, d.program_id, 'program id'); assert.equal(pre.title_ar, p.title_ar, 'title'); assert.deepEqual(pre.split, p.split, 'split'); assert.deepEqual(pre.targets, p.targets, 'targets'); assert.equal(pre.factory_draft_id, d.id, 'draft id'); assert.ok(pre.notes.includes('مصنع البرامج'), 'notes');
  assert.equal(contractPrefillFromQuery('?tab=new'), null, 'no new=1 → null'); assert.deepEqual(contractPrefillFromQuery('?new=1&split=70/70/70')!.split, { delivery: 60, evidence: 25, impact: 15 }, 'bad split → default');
  const far: Draft = { ...d, need: { ...need, horizon: 2050 }, design: null, foresight: null }; const pf = contractProposalFrom(far); assert.equal(pf.targets.impact_days, 120, '2050 → 120 days'); assert.deepEqual(pf.split, { delivery: 60, evidence: 25, impact: 15 }, 'no design → default split');
});
