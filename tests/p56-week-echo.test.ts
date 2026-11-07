// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P56 «صدى الأسبوع» — الخميس (الرياض) · مفتاح الأسبوع · تجميع صدى المتعلّم من إشعارات الكلمة والردود · النصوص (بلا ردّ · مع ردّ · يد مرفوعة · أُجبتَ 🎙️)
 *  runWeekEcho (ليس الخميس → لا شيء · force · dedupe · dry · من لم تصله كلمة لا يُزعَج) · صدى المدرّب (كلمات · وصلت · ردّ ٪ · أيدٍ مفتوحة · لم يردّ) · المرآة · echoSpeech
 *  digestText يحمل سطر الخميس · الكرون · النوع والأيقونة · «نادِ» · الواجهات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ECHO_KIND, ECHO_TITLE, ECHO_OFFICIAL, ECHO_DAYS, ECHO_WEEKDAY, riyadhWeekday, isEchoDay, echoWeekKey, buildLearnerEchoes, learnerEchoText, runWeekEcho, trainerEchoStats, trainerEchoLine, trainerEchoMirror, echoSpeech } from '../lib/portal/week-echo';
import { digestText } from '../lib/portal/day';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const THU = new Date('2026-11-05T06:00:00Z'); /* الخميس 5 نوفمبر 2026 (الرياض 09:00) */
const SAT = new Date('2026-11-07T06:00:00Z');
const ago = (base: Date, d: number) => new Date(base.getTime() - d * 86400000).toISOString();
const W = (email: string, d: number, tid = 't1', voice = false, base = THU): any => ({ email, kind: 'trainer_word', dedupe_key: `trainer_word:${tid}:${email}:x`, ref_id: 'c1', created_at: ago(base, d), meta: voice ? { voice: { path: `word-voice/${tid}/w-${d}.webm`, sec: 9, bytes: 1, mime: 'audio/webm', at: 'x' } } : {} });
const R = (email: string, d: number, chip: string | null, voice = false, base = THU): any => ({ learner_email: email, chip, created_at: ago(base, d), updated_at: ago(base, d), meta: voice ? { voice: { path: 'word-voice/t1/r.webm', sec: 5, bytes: 1, mime: 'audio/webm', at: 'x' } } : {} });

test('P56: الثوابت · يوم الخميس بتوقيت الرياض · مفتاح الأسبوع', () => {
  assert.equal(ECHO_KIND, 'week_echo'); assert.equal(ECHO_TITLE, 'صدى الأسبوع'); assert.equal(ECHO_DAYS, 7); assert.equal(ECHO_WEEKDAY, 4); assert.equal(ECHO_OFFICIAL.en, 'Weekly trainer–learner interaction echo'); assert.match(ECHO_OFFICIAL.ar, /خلاصة التفاعل الأسبوعية/);
  assert.equal(riyadhWeekday(THU), 4); assert.ok(isEchoDay(THU)); assert.ok(!isEchoDay(SAT)); assert.equal(riyadhWeekday(SAT), 6);
  assert.ok(isEchoDay(new Date('2026-11-04T21:30:00Z')), 'الأربعاء 21:30 UTC = الخميس 00:30 الرياض'); assert.ok(!isEchoDay(new Date('2026-11-05T21:30:00Z')), 'الخميس 21:30 UTC = الجمعة الرياض');
  assert.equal(echoWeekKey(THU), '2026-11-05'); assert.equal(echoWeekKey(SAT), '2026-11-12', 'السبت → خميس الأسبوع القادم'); assert.equal(echoWeekKey(new Date('2026-11-01T06:00:00Z')), '2026-11-05', 'الأحد → خميس الأسبوع نفسه');
});

test('P56: صدى المتعلّم — التجميع والنصوص', () => {
  const words = [W('a@x.sa', 1), W('a@x.sa', 3, 't1', true), W('a@x.sa', 5), W('b@x.sa', 2), W('c@x.sa', 2), W('d@x.sa', 1), W('d@x.sa', 0.5, 't1', true)];
  const replies = [R('a@x.sa', 1, 'got_it'), R('a@x.sa', 3, 'need_help'), R('a@x.sa', 4, 'need_help', true), R('c@x.sa', 1, 'need_help'), R('d@x.sa', 1, 'need_help'), R('zz@x.sa', 1, 'got_it')];
  const m = buildLearnerEchoes(words, replies);
  const a = m.get('a@x.sa')!; assert.equal(a.words, 3); assert.equal(a.voice_words, 1); assert.equal(a.replies, 3); assert.deepEqual(a.by_chip, { got_it: 1, need_help: 2, will_attend: 0 }); assert.equal(a.voice_replies, 1); assert.equal(a.voice_after_hand, true, 'كلمة صوتية (قبل 3 أيام) بعد آخر ✋ (قبل 3 أيام) — نفس اللحظة تُعدّ بعدها');
  const ta = learnerEchoText(a)!; assert.equal(ta.title_ar, 'صدى أسبوعك 🪞'); assert.equal(ta.body_ar, '3 كلمات من مدرّبك (🎙️ 1) · ردودك: 🌱 1 · ✋ 2 · 🎙️ 1 · أُجبتَ 🎙️ ✓ — كلمتك القادمة؟'); assert.equal(ta.url, '/me#notices');
  const b = learnerEchoText(m.get('b@x.sa')!)!; assert.equal(b.body_ar, 'كلمة واحدة من مدرّبك ولم تردّ بعد — لمسة واحدة تكفي 🌱');
  const c = learnerEchoText(m.get('c@x.sa')!)!; assert.equal(c.body_ar, 'كلمة واحدة من مدرّبك · ردودك: ✋ 1 · يدك ما زالت مرفوعة — مدرّبك يراها — كلمتك القادمة؟');
  const d = m.get('d@x.sa')!; assert.equal(d.voice_after_hand, true, 'الكلمة الصوتية جاءت بعد ✋'); assert.match(learnerEchoText(d)!.body_ar, /^كلمتان من مدرّبك \(🎙️ 1\) · ردودك: ✋ 1 · أُجبتَ 🎙️ ✓/);
  assert.equal(learnerEchoText(m.get('zz@x.sa')!), null, 'ردّ بلا كلمة في النافذة → لا صدى');
  assert.equal(echoSpeech('كلماتك 3 (🎙️ 1) · ردّ 50٪ · ✋ 2 ✓'), 'كلماتك 3 ( 1)، ردّ 50٪، 2');
});

function fakeDb(T: Record<string, any[]>) {
  const get = (r: any, k: string) => r[k];
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let mode = 'select'; let payload: any = null; let conflict = ''; let ignoreDup = false;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => String(get(r, k)) === String(v)); return b; }, in(k: string, v: any[]) { const s = new Set(v.map(String)); f.push((r) => s.has(String(get(r, k)))); return b; }, is() { return b; }, not() { return b; }, gte(k: string, v: any) { f.push((r) => String(get(r, k) || '') >= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(get(r, k) || '') < String(v)); return b; },
      order() { return b; }, limit() { return b; }, single() { single = true; return b; }, maybeSingle() { single = true; return b; }, insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, upsert(p: any, o?: any) { mode = 'upsert'; payload = p; conflict = o?.onConflict || ''; ignoreDup = !!o?.ignoreDuplicates; return b; },
      then(res: any) {
        if (mode === 'insert' || mode === 'upsert') { const a = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}`, created_at: new Date().toISOString(), ...p })); const out: any[] = [];
          for (const p of a) { const i = conflict ? rows.findIndex((r) => String(r[conflict]) === String(p[conflict])) : -1; if (i >= 0) { if (ignoreDup) continue; rows[i] = { ...rows[i], ...p, id: rows[i].id }; out.push(rows[i]); } else { rows.push(p); out.push(p); } }
          return res({ data: single ? out[0] || null : out, error: null }); }
        if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); return res({ data: hit, error: null }); }
        const hit = rows.filter((r) => f.every((p) => p(r))); return res({ data: single ? hit[0] || null : hit, error: null }); } };
    return b; };
  return { T, from: q };
}

test('P56: runWeekEcho — ليس الخميس → لا شيء · force · إشعار لكل من وصلته كلمة · dedupe بالأسبوع · dry · لا push_subscriptions → لا خطأ', async () => {
  const T = { portal_learner_notices: [W('a@x.sa', 1), W('a@x.sa', 3, 't1', true), W('b@x.sa', 2), W('old@x.sa', 9)], portal_word_replies: [R('a@x.sa', 1, 'got_it'), R('zz@x.sa', 1, 'got_it')], portal_push_subscriptions: [] as any[] };
  const db = fakeDb(T as any);
  const r0 = await runWeekEcho(db, { now: SAT }); assert.deepEqual(r0, { day: false, learners: 0, sent: 0, errors: [] });
  const r1 = await runWeekEcho(db, { now: SAT, force: true, dry: true }); assert.equal(r1.learners, 2); assert.equal(r1.sent, 2); assert.equal(T.portal_learner_notices.filter((n) => n.kind === 'week_echo').length, 0, 'dry لا يكتب');
  const r2 = await runWeekEcho(db, { now: THU }); assert.equal(r2.day, true); assert.equal(r2.learners, 2, 'a وb (old خارج 7 أيام · zz بلا كلمة)'); assert.equal(r2.sent, 2);
  const echoes = T.portal_learner_notices.filter((n) => n.kind === 'week_echo'); assert.equal(echoes.length, 2); const ea = echoes.find((n) => n.email === 'a@x.sa')!; assert.equal(ea.dedupe_key, 'week_echo:a@x.sa:2026-11-05'); assert.equal(ea.body_ar, 'كلمتان من مدرّبك (🎙️ 1) · ردودك: 🌱 1 — كلمتك القادمة؟'); assert.equal(ea.url, '/me#notices');
  const r3 = await runWeekEcho(db, { now: THU }); assert.equal(r3.sent, 0, 'الخميس نفسه مرّة ثانية → لا تكرار'); assert.equal(T.portal_learner_notices.filter((n) => n.kind === 'week_echo').length, 2);
  T.portal_learner_notices.push(W('a@x.sa', 2, 't1', false, new Date('2026-11-12T06:00:00Z')));
  const r4 = await runWeekEcho(db, { now: new Date('2026-11-12T06:00:00Z') }); assert.equal(r4.learners, 1, 'الخميس التالي: a وحدها لها كلمة في النافذة الجديدة'); assert.equal(r4.sent, 1, 'مفتاح أسبوع جديد → إشعار جديد'); assert.equal(T.portal_learner_notices.filter((n) => n.kind === 'week_echo').length, 3);
  assert.equal(T.portal_learner_notices.find((n) => n.kind === 'week_echo' && n.email === 'a@x.sa' && n.dedupe_key.endsWith('2026-11-12'))!.body_ar, 'كلمة واحدة من مدرّبك ولم تردّ بعد — لمسة واحدة تكفي 🌱');
});

test('P56: صدى المدرّب — الإحصاء والسطر والمرآة', () => {
  const words = [W('a@x.sa', 1), W('a@x.sa', 2, 't1', true), W('b@x.sa', 1), W('c@x.sa', 1), W('d@x.sa', 1), W('e@x.sa', 9), W('z@x.sa', 1, 't9')];
  const items = [
    { email: 'a@x.sa', chip: 'got_it', at: ago(THU, 1) }, { email: 'a@x.sa', chip: 'need_help', at: ago(THU, 2.5), voice: { sec: 4 } }, /* كلمة صوتية قبل يومين = بعد ✋ → مُجابة */
    { email: 'b@x.sa', chip: 'need_help', at: ago(THU, 1) }, { email: 'c@x.sa', chip: null, at: ago(THU, 1), voice: { sec: 3 } }, { email: 'd@x.sa', chip: 'will_attend', at: ago(THU, 10) },
  ];
  const t = trainerEchoStats(words, items, ['t1'], THU);
  assert.equal(t.words, 5, 'كلمات t1 خلال 7 أيام (لا e القديمة ولا z لمدرّب آخر)'); assert.equal(t.voice_words, 1); assert.equal(t.reached, 4); assert.equal(t.replied, 3, 'a b c (d ردّها قديم)'); assert.equal(t.replied_pct, 75);
  assert.equal(t.replies, 4); assert.deepEqual(t.by_chip, { got_it: 1, need_help: 2, will_attend: 0 }); assert.equal(t.voice_replies, 2); assert.equal(t.answered, 1); assert.equal(t.hands_open, 1, 'b ما زالت مرفوعة'); assert.equal(t.silent, 1);
  assert.equal(trainerEchoLine(t), 'كلماتك 5 (🎙️ 1) · وصلت إلى 4 متعلّمًا · ردّ 75٪ · 🌱 1 · ✋ 2 · 🎙️ 2 · أُجيبوا 🎙️ 1 · لم يردّ بعد 1');
  assert.equal(trainerEchoMirror(t), '✋ يد واحدة ما زالت مرفوعة بلا كلمة بعدها — كلمة صوتية تُجيبها.');
  const t0 = trainerEchoStats([], [], ['t1'], THU); assert.equal(trainerEchoLine(t0), ''); assert.match(trainerEchoMirror(t0), /لم تقل كلمة هذا الأسبوع/);
  const tAll = trainerEchoStats([...words, W('b@x.sa', 0.5, 't1', true)], items, ['t1'], THU); assert.equal(tAll.hands_open, 0); assert.equal(trainerEchoMirror(tAll), 'كل يد مرفوعة لقيت كلمة ✓');
  const tQuiet = trainerEchoStats([W('a@x.sa', 1), W('b@x.sa', 1), W('c@x.sa', 1)], [{ email: 'a@x.sa', chip: 'got_it', at: ago(THU, 1) }], ['t1'], THU); assert.match(trainerEchoMirror(tQuiet), /^2 لم يردّوا بعد/);
  const tLoud = trainerEchoStats([W('a@x.sa', 1), W('b@x.sa', 1), W('c@x.sa', 1)], [{ email: 'a@x.sa', chip: 'got_it', at: ago(THU, 1) }, { email: 'b@x.sa', chip: 'got_it', at: ago(THU, 1) }, { email: 'c@x.sa', chip: 'got_it', at: ago(THU, 1) }], ['t1'], THU); assert.match(trainerEchoMirror(tLoud), /صداك مسموع/);
  /* الخلاصة الصباحية: سطر الخميس */
  const d = digestText({ sessions_today: 0, absent_yesterday: 0, idle: 0, to_sign: 0, echo_line: trainerEchoLine(t) }); assert.match(d.body_ar, /^صدى الأسبوع: كلماتك 5/); assert.equal(digestText({ sessions_today: 0, absent_yesterday: 0, idle: 0, to_sign: 0 }).body_ar.includes('صدى'), false);
});

test('P56: النوع والأيقونة · الكرون · «نادِ» · الواجهات · لا SQL', () => {
  assert.equal(KIND_AR.week_echo, 'صدى الأسبوع'); assert.equal(KIND_ICON.week_echo, '🪞');
  const cron = read('app/api/followups/send/route.ts'); assert.match(cron, /runWeekEcho\(db, \{ dry, force: url\.searchParams\.get\('echo'\) === '1' \}\)/); assert.match(cron, /day_digest, week_echo, org_letters/);
  const day = read('lib/portal/day.ts'); assert.match(day, /trainerEcho\(db, \[\.\.\.tids, me\.id\], replies\.rooms\.flatMap/); assert.match(day, /echo_line: echo\.line/); assert.match(day, /!c\.echo_line\) continue/);
  const dest = DESTINATIONS.find((d) => d.href === '/me/day#dy-echo'); assert.ok(dest); assert.equal(dest!.label, 'صدى الأسبوع'); for (const u of ['صدى الأسبوع', 'صداي', 'مرآة الأسبوع']) assert.equal((parseCommand(u) as any)?.href, '/me/day#dy-echo', u);
  const db = read('app/me/day/DayBook.tsx'); for (const t of ['dy-echo', 'dy-echo-line', 'dy-echo-mirror']) assert.ok(db.includes(`data-testid="${t}"`), t); assert.match(db, /testid="dy-echo-say"/); assert.match(db, /import \{ EchoSay \} from '\.\.\/\.\.\/components\/Notices'/);
  const nt = read('app/components/Notices.tsx'); const es = read('app/components/EchoSay.tsx'); assert.match(es, /export function EchoSay/); assert.match(nt, /export \{ EchoSay \} from '\.\/EchoSay'/); /* P57: انتقل إلى ملفه */ assert.match(nt, /n\.kind === 'week_echo' && <EchoSay/); assert.match(es, /speechSynthesis/); assert.match(es, /data-testid=\{testid\}/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'supabase/migrations')) || !fs.readdirSync(path.join(ROOT, 'supabase/migrations')).some((f) => /p56|week_echo/i.test(f)), 'لا هجرة SQL');
});
