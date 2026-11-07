// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P57 «نبض الجهة» — النقي: قاعدة الخمسة · الأيدي الباقية · ذروة الأسبوع · المرآة · اقتراح الطلب · الغراء بقاعدة وهمية */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePulse, pulseLine, pulseMirror, pulseAsk, pulseSpeech, orgPulse, OPEN_HAND_DAYS } from '../lib/org-impact/pulse';
import { suggestAsk } from '../lib/org-impact/letter';

const ASOF = new Date('2026-11-30T20:59:59.000Z'); /* نهاية نوفمبر بالرياض */
const ago = (days: number) => new Date(ASOF.getTime() - days * 86400000).toISOString();
const W = (email: string, days: number, t = 't1', voice = false) => ({ email, kind: 'trainer_word', dedupe_key: `trainer_word:${t}:${email}:${ago(days).slice(0, 10)}`, ref_id: 'c1', meta: voice ? { voice: { path: `word-voice/${t}/w-x.webm`, sec: 5, bytes: 1000, mime: 'audio/webm', at: ago(days) } } : {}, created_at: ago(days) });
const R = (email: string, chip: string | null, days: number, voice = false) => ({ learner_email: email, chip, meta: voice ? { voice: { path: 'word-voice/t1/r.webm', sec: 4, bytes: 900, mime: 'audio/webm', at: ago(days) } } : {}, created_at: ago(days) });

test('p57: دون خمسة منسوبين → لا سطر أرقام · مرآة الخصوصية · لا اقتراح', () => {
  const p = computePulse([W('a@x.sa', 3), W('b@x.sa', 3), W('c@x.sa', 2), W('d@x.sa', 1)], [R('a@x.sa', 'got_it', 2)], ASOF);
  assert.equal(p.k, false); assert.equal(p.reached, 4); assert.equal(p.line_ar, null); assert.equal(p.replied_pct, null);
  assert.match(p.mirror_ar, /تحت خمسة منسوبين/); assert.equal(p.ask_ar, null);
  const z = computePulse([], [], ASOF); assert.match(z.mirror_ar, /لم تصل كلمات/); assert.equal(z.words, 0);
});

test('p57: الأرقام والسطر — كلمات · مدرّبون · 🎙️ · وصلت · ردّ٪ · اللمسات', () => {
  const words = [W('a@x.sa', 9), W('a@x.sa', 2, 't2', true), W('b@x.sa', 8), W('c@x.sa', 8), W('d@x.sa', 8), W('e@x.sa', 8), W('f@x.sa', 8, 't3')];
  const reps = [R('a@x.sa', 'got_it', 8), R('b@x.sa', 'need_help', 8), R('c@x.sa', 'will_attend', 7, true), R('d@x.sa', 'got_it', 1)];
  const p = computePulse(words, reps, ASOF);
  assert.equal(p.k, true); assert.equal(p.words, 7); assert.equal(p.voice_words, 1); assert.equal(p.trainers, 3); assert.equal(p.reached, 6); assert.equal(p.replied, 4); assert.equal(p.replied_pct, 67);
  assert.deepEqual(p.by_chip, { got_it: 2, need_help: 1, will_attend: 1 }); assert.equal(p.voice_replies, 1);
  assert.equal(p.line_ar, '7 كلمات من 3 مدرّبين (🎙️ 1) وصلت إلى 6 من منسوبيكم · ردّ 67٪ · 🌱 2 · ✋ 1 · 🕐 1 · 🎙️ 1');
  assert.equal(pulseLine({ ...p, words: 1, trainers: 1, voice_words: 0, by_chip: { got_it: 0, need_help: 0, will_attend: 0 }, voice_replies: 0 }), 'كلمة واحدة من مدرّب واحد وصلت إلى 6 من منسوبيكم · ردّ 67٪');
  assert.ok(pulseLine({ ...p, words: 12, trainers: 2 })?.startsWith('12 كلمة من مدرّبَين (🎙️ 1)'));
  assert.equal(pulseSpeech(p).includes('🌱'), false); assert.match(pulseSpeech(p), /، ردّ 67٪،/);
});

test('p57: الأيدي — باقية ≥ 7 أيام بلا كلمة صوتية بعدها · أُجيبت بكلمة صوتية · حديثة لا تُعدّ باقية', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((x) => W(`${x}@x.sa`, 20));
  /* a: ✋ قبل 15 يومًا ثم كلمة صوتية قبل 10 → مُجابة · b: ✋ قبل 12 بلا جواب → باقية · c: ✋ قبل 3 أيام → حديثة */
  const p = computePulse([...five, W('a@x.sa', 10, 't1', true)], [R('a@x.sa', 'need_help', 15), R('b@x.sa', 'need_help', 12), R('c@x.sa', 'need_help', 3), R('d@x.sa', 'got_it', 5)], ASOF);
  assert.equal(p.hands, 3); assert.equal(p.hands_open, 1); assert.match(p.mirror_ar, /^يد واحدة بقيت مرفوعة أكثر من أسبوع/); assert.match(p.mirror_ar, /نذكرها لكم عددًا/);
  const q = computePulse([...five, W('a@x.sa', 10, 't1', true), W('b@x.sa', 11, 't1', true)], [R('a@x.sa', 'need_help', 15), R('b@x.sa', 'need_help', 12), R('c@x.sa', 'got_it', 3), R('d@x.sa', 'got_it', 5)], ASOF);
  assert.equal(q.hands_open, 0); assert.match(q.mirror_ar, /^كل يد مرفوعة لقيت كلمة من مدرّبها ✓/);
  assert.equal(OPEN_HAND_DAYS, 7);
});

test('p57: ذروة الأسبوع (≥ 2 ردود في الأسبوع) · المرآة الهادئة · اقتراح الطلب دون 30٪ يمرّ عبر suggestAsk بأدنى أولوية', () => {
  const five = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => W(`${x}@x.sa`, 25));
  /* أسبوع ذروة: 3 ردود قبل 20–18 يومًا (خميس 12 نوفمبر) · ردّ واحد قبل 4 أيام */
  const p = computePulse(five, [R('a@x.sa', 'got_it', 20), R('b@x.sa', 'got_it', 19), R('c@x.sa', 'got_it', 18), R('d@x.sa', 'got_it', 4)], ASOF);
  assert.equal(p.peak_week, '2026-11-12'); assert.equal(p.peak_week_ar, '12 نوفمبر'); assert.equal(p.replied_pct, 67);
  assert.equal(p.mirror_ar, 'حوار حيّ: أكثر من نصف من وصلتهم كلمة ردّوا. — وأكثر أسبوع حوارًا كان أسبوع 12 نوفمبر.');
  const low = computePulse(five, [R('a@x.sa', 'got_it', 4)], ASOF);
  assert.equal(low.replied_pct, 17); assert.match(low.mirror_ar, /^نصف من وصلتهم كلمة لم يردّوا بعد/); assert.equal(low.peak_week, null);
  assert.equal(pulseAsk(low), 'كلمة قصيرة من إدارتكم: ردّ واحد على كلمة المدرّب يكفي 🌱');
  assert.equal(suggestAsk({ people: { members: 10, pending: 0, active_raw: 9 }, pulse: low }), low.ask_ar);
  assert.match(suggestAsk({ people: { members: 10, pending: 1, active_raw: 9 }, pulse: low }) || '', /ينتظر تأكيدكم/); /* الأولوية للموجود */
  assert.equal(suggestAsk({ people: { members: 10, pending: 0, active_raw: 9 }, pulse: p }), null);
  assert.equal(pulseMirror({ ...p, hands: 0, hands_open: 0, replied_pct: 50, peak_week_ar: null }), 'نصف من وصلتهم كلمة لم يردّوا بعد — كلمة من إدارتكم تفتح الباب.');
});

test('p57: الغراء — يقصر على منسوبي الجهة وعلى الشهر · asOf = الأسبق من الآن ونهاية الشهر', async () => {
  const calls: any[] = [];
  const mk = (table: string) => { const q: any = { _t: table, _f: [] as any[] }; for (const m of ['select', 'eq', 'in', 'gte', 'lt', 'limit']) q[m] = (...a: any[]) => { q._f.push([m, ...a]); return q; };
    q.then = (res: any) => { calls.push(q); const inEmails: string[] = (q._f.find((f: any[]) => f[0] === 'in') || [])[2] || [];
      const rows = table === 'portal_learner_notices' ? [W('a@x.sa', 3), W('b@x.sa', 3), W('c@x.sa', 3), W('d@x.sa', 3), W('e@x.sa', 3), W('zz@other.sa', 3)].filter((r) => inEmails.includes(r.email)) : [R('a@x.sa', 'got_it', 2)].filter((r) => inEmails.includes(r.learner_email));
      return Promise.resolve({ data: rows, error: null }).then(res); }; return q; };
  const db = { from: (t: string) => mk(t) };
  const members = new Set(['a@x.sa', 'b@x.sa', 'c@x.sa', 'd@x.sa', 'e@x.sa']);
  const p = await orgPulse(db, members, { from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T21:00:00.000Z' }, { now: new Date('2026-12-03T06:00:00Z') });
  assert.equal(p.reached, 5); assert.equal(p.k, true); assert.equal(p.replied, 1); assert.equal(p.words, 5);
  const n = calls.find((c) => c._t === 'portal_learner_notices'); assert.ok(n._f.some((f: any[]) => f[0] === 'eq' && f[1] === 'kind' && f[2] === 'trainer_word')); assert.ok(n._f.some((f: any[]) => f[0] === 'gte' && f[1] === 'created_at'));
});

test('p57: «نادِ» → نبض الجهة · الواجهة تعرض ls-pulse · EchoSay في ملفه', () => {
  const { DESTINATIONS, parseCommand } = require('../lib/portal/voice'); const fs = require('node:fs'); const path = require('node:path');
  const dest = DESTINATIONS.find((d: any) => d.href === '/org?tab=letters'); assert.ok(dest); assert.equal(dest.label, 'نبض الجهة');
  for (const u of ['نبض الجهة', 'نبض الشهر', 'نبض جهتي']) assert.equal((parseCommand(u) as any)?.href, '/org?tab=letters', u);
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  const sh = read('app/components/LetterSheet.tsx'); for (const t of ['ls-pulse', 'ls-pulse-line', 'ls-pulse-mirror']) assert.ok(sh.includes(`data-testid="${t}"`), t); assert.match(sh, /testid="ls-pulse-say"/); assert.match(sh, /b\.pulse && <section/);
  assert.match(read('app/components/EchoSay.tsx'), /export function EchoSay/); assert.match(read('lib/org-impact/letter.ts'), /pulse\?: OrgPulse \| null/);
});
