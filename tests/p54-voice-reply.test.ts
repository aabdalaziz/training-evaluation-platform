// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P54 «أمانة صوتية» — الصرف (الحدود · التحقّق من الصوت · المسار · النصّ التقريبي · ✋ ×3 · الترتيب ✋ → 🎙️ · نصوص الإشعار والموجز) ·
 *  submitReply بصوت (يحلّ محلّ القديم · لا يمسّه سطر لاحق) · removeVoice (خلال ساعة · حذف الصفّ إن خلا) · voiceUrlFor (المالك فقط) · purgeWordVoices · collectReplies يحمل voice/hands3 · الملفّات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { VOICE_LIMITS, VOICE_MIMES, VOICE_OFFICIAL, HANDS_WEEK_DAYS, HANDS_WEEK_MIN, validateVoice, voicePath, voiceExt, voiceOf, transcriptOf, cleanTranscript, fmtSec, summarizeReplies, handsByLearner, hands3Count, hands3Line, trainerNoticeText, repliesLine, submitReply, resolveWordForLearner, removeVoice, voiceUrlFor, purgeWordVoices, collectReplies, myReplies, repliesYesterday } from '../lib/portal/word-reply';
import { digestText } from '../lib/portal/day';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';
import { REGISTRY } from '../lib/vault/registry';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('P54: الحدود · التحقّق · المسار · النصّ التقريبي · الصرف', () => {
  assert.equal(VOICE_LIMITS.maxSeconds, 15); assert.equal(VOICE_LIMITS.maxBytes, 512 * 1024); assert.equal(VOICE_LIMITS.perHour, 10); assert.equal(VOICE_LIMITS.transcriptMax, 300); assert.equal(VOICE_LIMITS.signedSeconds, 300); assert.equal(VOICE_LIMITS.bucket, 'athar-media'); assert.equal(VOICE_LIMITS.prefix, 'word-voice');
  assert.equal(VOICE_OFFICIAL.en, 'Learner voice reply to trainer note'); assert.match(VOICE_OFFICIAL.ar, /ردّ صوتي للمتعلّم/); assert.equal(HANDS_WEEK_DAYS, 7); assert.equal(HANDS_WEEK_MIN, 3); assert.ok(VOICE_MIMES.includes('audio/webm') && VOICE_MIMES.includes('audio/mp4'));
  const ok = validateVoice({ mime: 'audio/webm;codecs=opus', bytes: 40000, sec: 12 }); assert.ok(ok.ok && ok.mime === 'audio/webm' && ok.ext === 'webm' && ok.sec === 12);
  assert.ok(!validateVoice({ mime: 'video/mp4', bytes: 40000, sec: 5 }).ok, 'صيغة غير صوتية'); assert.ok(!validateVoice({ mime: 'audio/webm', bytes: 10, sec: 5 }).ok, 'فارغ'); assert.ok(!validateVoice({ mime: 'audio/webm', bytes: 600 * 1024, sec: 5 }).ok, 'كبير');
  assert.ok(!validateVoice({ mime: 'audio/webm', bytes: 5000, sec: 0 }).ok, 'أقصر من ثانية'); assert.ok(!validateVoice({ mime: 'audio/webm', bytes: 5000, sec: 17 }).ok, 'أطول من 15'); const edge = validateVoice({ mime: 'audio/mp4', bytes: 5000, sec: 16 }); assert.ok(edge.ok && edge.sec === 15, 'ثانية تسامح للتقريب');
  assert.equal(voiceExt('audio/mp4'), 'm4a'); assert.equal(voiceExt('audio/ogg;codecs=opus'), 'ogg'); assert.equal(voiceExt('audio/mpeg'), 'mp3'); assert.equal(voiceExt('audio/webm'), 'webm');
  assert.equal(voicePath('t1', 'abc-123', 'webm'), 'word-voice/t1/abc-123.webm'); assert.equal(voicePath('../t1', 'a/b', 'webm'), 'word-voice/t1/ab.webm', 'لا خروج من المسار');
  assert.deepEqual(voiceOf({ voice: { path: 'word-voice/t1/x.webm', sec: 9, bytes: 100, mime: 'audio/webm', at: 'now' } }), { path: 'word-voice/t1/x.webm', sec: 9, bytes: 100, mime: 'audio/webm', at: 'now' });
  assert.equal(voiceOf({ voice: { path: 'other/x.webm', sec: 9 } }), null, 'مسار خارج word-voice يُرفض'); assert.equal(voiceOf(null), null); assert.equal(voiceOf({}), null);
  assert.equal(transcriptOf({ transcript: ' نعم ' }), ' نعم '); assert.equal(transcriptOf({ transcript: '  ' }), null); assert.equal(transcriptOf({}), null);
  assert.equal(cleanTranscript(' <b>لم</b> أفهم https://x.y الدرس '), 'لم أفهم الدرس'); assert.equal(cleanTranscript('x'.repeat(900)).length, 300); assert.equal(cleanTranscript(undefined), '');
  assert.equal(fmtSec(12), '0:12'); assert.equal(fmtSec(0), '0:00'); assert.equal(fmtSec(65), '1:05');
  /* ✋ ×3 خلال 7 أيام */
  const now = new Date('2026-11-07T06:00:00Z'); const mk = (id: string, email: string, chip: string | null, daysAgo: number, meta: any = {}) => ({ id, created_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(), updated_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(), notice_id: `n-${id}`, trainer_id: 't1', classroom_id: 'c1', learner_email: email, learner_name: null, chip, text: null, seen_at: null, meta });
  const rows: any[] = [mk('a1', 'a@x.sa', 'need_help', 1), mk('a2', 'a@x.sa', 'need_help', 3), mk('a3', 'a@x.sa', 'need_help', 6), mk('a4', 'a@x.sa', 'need_help', 9), mk('b1', 'b@x.sa', 'need_help', 2), mk('c1', 'c@x.sa', 'got_it', 0.5, { voice: { path: 'word-voice/t1/c.webm', sec: 12, bytes: 1, mime: 'audio/webm', at: '' }, transcript: 'شكرًا' }), mk('d1', 'd@x.sa', null, 0.2, { }), mk('e1', 'e@x.sa', 'got_it', 0.1)];
  rows[6].text = 'سطر'; const hands = handsByLearner(rows, now); assert.equal(hands.get('a@x.sa'), 3, '9 أيام لا تُحتسب'); assert.equal(hands.get('b@x.sa'), 1); assert.equal(hands3Count(hands), 1);
  assert.equal(hands3Line(0), ''); assert.match(hands3Line(1), /^متعلّم واحد رفع يده ثلاثًا هذا الأسبوع — كلمة منك تكفي$/); assert.match(hands3Line(2), /^متعلّمان رفعا/); assert.match(hands3Line(4), /^4 متعلّمين رفعوا/);
  const s = summarizeReplies(rows, new Map(), hands); assert.equal(s.voice, 1); assert.equal(s.items[0].chip, 'need_help', '✋ أولًا'); assert.equal(s.items.filter((i) => i.chip === 'need_help').length, 5);
  const firstNonHand = s.items.find((i) => i.chip !== 'need_help')!; assert.equal(firstNonHand.id, 'c1', 'ثم 🎙️ قبل النصّ الأحدث'); assert.deepEqual(firstNonHand.voice, { sec: 12 }); assert.equal(firstNonHand.transcript, 'شكرًا'); assert.equal(s.items.find((i) => i.id === 'a1')!.hands_week, 3); assert.equal(s.items.find((i) => i.id === 'e1')!.hands_week, 0);
  /* نصوص P53 ثابتة حين لا صوت */
  assert.equal(trainerNoticeText(1, 0).title_ar, 'ردّ جديد على كلمتك'); assert.equal(trainerNoticeText(3, 1).body_ar, trainerNoticeText(3, 1, 0).body_ar); assert.match(trainerNoticeText(3, 1, 2).body_ar, /واثنان تركا لك أصواتًا 🎙️/); assert.match(trainerNoticeText(1, 0, 1).body_ar, /ومنهم من ترك لك صوتًا 🎙️/); assert.match(trainerNoticeText(5, 0, 3).body_ar, /و3 تركوا لك أصواتًا/); assert.equal(trainerNoticeText(2, 0).body_ar, 'افتح «دفتر اليوم» لتقرأها — ردودهم لك وحدك.');
  assert.equal(repliesLine(7, 2), 'ردود أمس 7 · ✋ 2'); assert.equal(repliesLine(7, 2, 3), 'ردود أمس 7 · ✋ 2 · 🎙️ 3'); assert.equal(repliesLine(7, 0, 3), 'ردود أمس 7 · 🎙️ 3'); assert.equal(repliesLine(0, 0, 3), '');
  const d = digestText({ sessions_today: 1, absent_yesterday: 0, idle: 0, to_sign: 0, replies_yesterday: 3, need_help_yesterday: 1, voice_yesterday: 2, hands3_week: 1 }); assert.equal(d.title_ar, 'دفتر اليوم: جلسة واحدة · ردود أمس 3 · ✋ 1 · 🎙️ 2'); assert.match(d.body_ar, /^متعلّم واحد رفع يده ثلاثًا هذا الأسبوع — كلمة منك تكفي — افتح دفتر اليوم/);
  assert.equal(digestText({ sessions_today: 1, absent_yesterday: 0, idle: 0, to_sign: 0, replies_yesterday: 3, need_help_yesterday: 1 }).title_ar, 'دفتر اليوم: جلسة واحدة · ردود أمس 3 · ✋ 1', 'P53 كما هو'); assert.match(digestText({ sessions_today: 0, absent_yesterday: 0, idle: 0, to_sign: 0 }).body_ar, /^افتح دفتر اليوم/);
  /* «نادِ» */
  const dest = DESTINATIONS.find((x) => x.href === '/me/day#replies')!; assert.ok(dest.aliases.includes('شغّل أمانات اليوم')); const pc = parseCommand('شغل امانات اليوم') as any; assert.ok(pc && JSON.stringify(pc).includes('/me/day#replies'), JSON.stringify(pc));
  /* الخزنة */
  const reg = REGISTRY.find((r: any) => r.table === 'portal_word_replies') as any; assert.match(reg.data_ar, /تسجيل صوتي ≤15 ث/); assert.equal(reg.retentionDays, 180);
});

/** قاعدة وهمية مع مخزن */
function fakeDb(over: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {
    portal_learner_notices: [
      { id: 'n1', email: 'reem@x.sa', kind: 'trainer_word', ref_id: 'c1', dedupe_key: 'trainer_word:t1:reem@x.sa:2026-11-07', created_at: '2026-11-07T05:00:00Z' },
      { id: 'n2', email: 'badr@x.sa', kind: 'trainer_word', ref_id: 'c1', dedupe_key: 'trainer_word:t1:badr@x.sa:2026-11-07', created_at: '2026-11-07T05:00:00Z' },
      { id: 'n3', email: 'reem@x.sa', kind: 'exit_final', ref_id: null, dedupe_key: 'exit_final:r1', created_at: '2026-11-07T05:00:00Z' },
    ],
    portal_word_replies: [], trainers: [{ id: 't1', name: 'د. أحمد', email: 'trainer@x.sa' }], profiles: [], audit_logs: [], ...over,
  };
  const objects = new Set<string>(); const removed: string[][] = []; const signed: string[] = [];
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'; let payload: any = null; let ord: { k: string; asc: boolean } | null = null; let conflict = ''; let ignoreDup = false;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => String(r[k]) === String(v)); return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, in(k: string, v: any[]) { const s = new Set(v.map(String)); f.push((r) => s.has(String(r[k]))); return b; }, is(k: string, v: any) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; }, not(k: string, op: string, v: any) { if (op === 'is' && v === null) f.push((r) => r[k] != null); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k] || '') >= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(r[k] || '') < String(v)); return b; }, lte(k: string, v: any) { f.push((r) => String(r[k] || '') <= String(v)); return b; }, order(k: string, o?: any) { ord = { k, asc: o?.ascending !== false }; return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, delete() { mode = 'delete'; return b; }, upsert(p: any, o?: any) { mode = 'upsert'; payload = p; conflict = o?.onConflict || ''; ignoreDup = !!o?.ignoreDuplicates; return b; },
      then(res: any) {
        if (mode === 'insert' || mode === 'upsert') { const a = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}-${table}`, created_at: new Date().toISOString(), ...p })); const out: any[] = [];
          for (const p of a) { const i = conflict ? rows.findIndex((r) => String(r[conflict]) === String(p[conflict])) : -1; if (i >= 0) { if (ignoreDup) continue; rows[i] = { ...rows[i], ...p, id: rows[i].id }; out.push(rows[i]); } else { rows.push(p); out.push(p); } }
          return res({ data: single ? out[0] || null : out, error: null }); }
        if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); return res({ data: single ? hit[0] || null : hit, error: null }); }
        if (mode === 'delete') { const keep = rows.filter((r) => !f.every((p) => p(r))); const n = rows.length - keep.length; rows.splice(0, rows.length, ...keep); return res({ data: null, error: null, count: n }); }
        let hit = rows.filter((r) => f.every((p) => p(r))); if (ord) { const { k, asc } = ord; hit = [...hit].sort((x, y) => (String(x[k] || '') < String(y[k] || '') ? -1 : 1) * (asc ? 1 : -1)); } if (lim) hit = hit.slice(0, lim);
        return res({ data: single ? hit[0] || null : hit, error: null, count: hit.length }); } };
    return b; };
  const storage = { from: (bucket: string) => ({ async upload(p: string) { objects.add(`${bucket}/${p}`); return { data: { path: p }, error: null }; }, async remove(ps: string[]) { removed.push(ps); ps.forEach((p) => objects.delete(`${bucket}/${p}`)); return { data: ps.map((name) => ({ name })), error: null }; }, async createSignedUrl(p: string, sec: number) { signed.push(p); return objects.has(`${bucket}/${p}`) ? { data: { signedUrl: `https://signed.test/${p}?exp=${sec}` }, error: null } : { data: null, error: { message: 'not found' } }; } }) };
  return { T, from: q, storage, objects, removed, signed };
}
const V = (id: string, sec = 12): any => ({ path: `word-voice/t1/${id}.webm`, sec, bytes: 30000, mime: 'audio/webm', at: '2026-11-07T06:00:00Z' });

test('P54: resolveWordForLearner · submitReply بصوت (ردّ واحد · يحلّ محلّ القديم · سطر لاحق لا يمسّه · نصّ تقريبي) · myReplies · إشعار المدرّب يذكر الصوت · removeVoice · voiceUrlFor', async () => {
  const db = fakeDb(); const now = new Date('2026-11-07T06:10:00Z'); const reem = { email: 'Reem@x.sa', name: 'ريم' };
  const w = await resolveWordForLearner(db as any, 'reem@x.sa', 'n1'); assert.ok(!('error' in w) && w.trainer_id === 't1' && w.classroom_id === 'c1' && w.existing === null);
  assert.ok('error' in (await resolveWordForLearner(db as any, 'reem@x.sa', 'n2')) , 'كلمة بدر'); assert.ok('error' in (await resolveWordForLearner(db as any, 'reem@x.sa', 'n3')), 'ليست كلمة'); assert.ok('error' in (await resolveWordForLearner(db as any, 'reem@x.sa', '')));
  const empty = await submitReply(db as any, reem, { notice_id: 'n1' }, { now }); assert.ok('error' in empty && empty.status === 400 && /صوتًا/.test(empty.error));
  await db.storage.from('athar-media').upload('word-voice/t1/v1.webm'); const r1 = await submitReply(db as any, reem, { notice_id: 'n1', voice: V('v1'), transcript: ' <b>لم</b> أفهم الدرس ' }, { now }); assert.ok(!('error' in r1), JSON.stringify(r1));
  assert.equal(r1.created, true); assert.equal(r1.row.chip, null); assert.equal(r1.row.text, null); assert.deepEqual(voiceOf(r1.row.meta), V('v1')); assert.equal(transcriptOf(r1.row.meta), 'لم أفهم الدرس'); assert.equal(r1.replaced_voice, null); assert.equal(db.T.portal_word_replies.length, 1, 'صوت بلا لمسة يُنشئ الردّ');
  const n = db.T.portal_learner_notices.filter((x: any) => x.kind === 'word_reply'); assert.equal(n.length, 1); assert.match(n[0].body_ar, /صوتًا/, 'إشعار المدرّب يذكر الصوت');
  const r2 = await submitReply(db as any, reem, { notice_id: 'n1', chip: 'need_help' }, { now: new Date('2026-11-07T06:20:00Z') }); assert.ok(!('error' in r2)); assert.equal(r2.created, false); assert.deepEqual(voiceOf(db.T.portal_word_replies[0].meta), V('v1'), 'لمسة لاحقة لا تمسّ الصوت'); assert.equal(transcriptOf(db.T.portal_word_replies[0].meta), 'لم أفهم الدرس'); assert.equal(db.T.portal_word_replies[0].chip, 'need_help');
  const r3 = await submitReply(db as any, reem, { notice_id: 'n1', text: 'الصفحة 12' }, { now: new Date('2026-11-07T06:25:00Z') }); assert.ok(!('error' in r3)); assert.equal(db.T.portal_word_replies[0].text, 'الصفحة 12'); assert.equal(db.T.portal_word_replies[0].chip, 'need_help'); assert.deepEqual(voiceOf(db.T.portal_word_replies[0].meta), V('v1'));
  await db.storage.from('athar-media').upload('word-voice/t1/v2.webm'); const r4 = await submitReply(db as any, reem, { notice_id: 'n1', voice: V('v2', 7), transcript: '' }, { now: new Date('2026-11-07T06:30:00Z') }); assert.ok(!('error' in r4)); assert.equal(r4.replaced_voice, 'word-voice/t1/v1.webm', 'الصوت الجديد يعيد مسار القديم للحذف'); assert.deepEqual(voiceOf(db.T.portal_word_replies[0].meta), V('v2', 7)); assert.equal(transcriptOf(db.T.portal_word_replies[0].meta), null, 'نصّ فارغ = حذف النصّ'); assert.equal(db.T.portal_word_replies[0].text, 'الصفحة 12', 'السطر يبقى'); assert.equal(db.T.portal_word_replies[0].chip, 'need_help');
  const mine = await myReplies(db as any, 'reem@x.sa', ['n1']); assert.equal(mine.get('n1')!.voice_sec, 7); assert.equal(mine.get('n1')!.transcript, null); assert.equal(mine.get('n1')!.chip, 'need_help');
  /* voiceUrlFor */
  const rid = db.T.portal_word_replies[0].id; const u1 = await voiceUrlFor(db as any, ['t1'], rid); assert.ok(!('error' in u1) && u1.url.startsWith('https://signed.test/word-voice/t1/v2.webm') && u1.sec === 7, JSON.stringify(u1));
  const u2 = await voiceUrlFor(db as any, ['t9'], rid); assert.ok('error' in u2 && u2.status === 403, 'مدرّب آخر'); const u3 = await voiceUrlFor(db as any, ['t1'], 'nope'); assert.ok('error' in u3 && u3.status === 404);
  /* removeVoice */
  const late = await removeVoice(db as any, reem, 'n1', { now: new Date('2026-11-07T07:20:00Z') }); assert.ok('error' in late && late.status === 409, 'بعد ساعة من الإنشاء');
  const rv = await removeVoice(db as any, reem, 'n1', { now: new Date('2026-11-07T06:50:00Z') }); assert.ok(!('error' in rv)); assert.equal(rv.path, 'word-voice/t1/v2.webm'); assert.equal(rv.row_deleted, false, 'بقيت لمسة وسطر'); assert.equal(voiceOf(db.T.portal_word_replies[0].meta), null); assert.equal(db.T.portal_word_replies[0].chip, 'need_help');
  assert.ok('error' in (await removeVoice(db as any, reem, 'n1', { now: new Date('2026-11-07T06:51:00Z') })), 'لا صوت الآن → 404');
  /* صوت وحده ثم حذفه → يُحذف الردّ كلّه */
  const badr = { email: 'badr@x.sa', name: 'بدر' }; await db.storage.from('athar-media').upload('word-voice/t1/b1.webm'); const rb = await submitReply(db as any, badr, { notice_id: 'n2', voice: V('b1') }, { now: new Date('2026-11-07T06:55:00Z') }); assert.ok(!('error' in rb)); assert.equal(db.T.portal_word_replies.length, 2);
  const rvb = await removeVoice(db as any, badr, 'n2', { now: new Date('2026-11-07T06:58:00Z') }); assert.ok(!('error' in rvb) && rvb.row_deleted === true); assert.equal(db.T.portal_word_replies.length, 1, 'لم يبقَ شيء → حُذف الصفّ');
  const u4 = await voiceUrlFor(db as any, ['t1'], rid); assert.ok('error' in u4 && u4.status === 404, 'بعد الحذف لا رابط');
});

test('P54: collectReplies يحمل voice وhands3 · repliesYesterday.voices · purgeWordVoices (قديم فقط · dry لا يحذف · ينظّف المخزن)', async () => {
  const now = new Date('2026-11-07T06:00:00Z'); const at = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
  const mk = (id: string, email: string, chip: string | null, d: number, meta: any = {}) => ({ id, created_at: at(d), updated_at: at(d), notice_id: `n-${id}`, trainer_id: 't1', classroom_id: 'c1', learner_email: email, learner_name: null, chip, text: null, seen_at: null, meta });
  const db = fakeDb({ portal_word_replies: [mk('a1', 'a@x.sa', 'need_help', 1), mk('a2', 'a@x.sa', 'need_help', 2), mk('a3', 'a@x.sa', 'need_help', 4), mk('c1', 'c@x.sa', 'got_it', 0.9, { voice: V('c1') }), mk('d1', 'd@x.sa', null, 0.6, { voice: V('d1', 4), transcript: 'نعم' }), mk('old', 'o@x.sa', null, 200, { voice: V('old') }), mk('old2', 'o2@x.sa', 'got_it', 190)] });
  for (const p of ['c1', 'd1', 'old']) await db.storage.from('athar-media').upload(`word-voice/t1/${p}.webm`);
  const c = await collectReplies(db as any, ['t1'], { now }); assert.equal(c.total, 5, '14 يومًا'); assert.equal(c.voice, 2); assert.equal(c.hands3, 1); assert.equal(c.rooms[0].voice, 2); assert.equal(c.rooms[0].items[0].chip, 'need_help'); assert.equal(c.rooms[0].items.find((i) => i.id === 'a1')!.hands_week, 3);
  const nonHands = c.rooms[0].items.filter((i) => i.chip !== 'need_help').map((i) => i.id); assert.deepEqual(nonHands, ['d1', 'c1'], '🎙️ الأحدث أولًا');
  const ry = await repliesYesterday(db as any, ['t1'], now); assert.equal(ry.replies, 3, 'أمس بتوقيت الرياض: a1 وc1 وd1'); assert.equal(ry.voices, 2); assert.equal(ry.need_help, 1);
  const dry = await purgeWordVoices(db as any, 180, { now, dry: true }); assert.equal(dry.scanned, 2); assert.equal(dry.removed, 1); assert.equal(db.removed.length, 0, 'dry لا يحذف'); assert.ok(db.objects.has('athar-media/word-voice/t1/old.webm'));
  const real = await purgeWordVoices(db as any, 180, { now }); assert.equal(real.removed, 1); assert.deepEqual(db.removed, [['word-voice/t1/old.webm']]); assert.ok(!db.objects.has('athar-media/word-voice/t1/old.webm')); assert.ok(db.objects.has('athar-media/word-voice/t1/c1.webm'), 'الحديث يبقى');
  assert.equal(db.T.portal_word_replies.length, 7, 'الصفوف تحذفها خطوة الاحتفاظ القائمة (RPC) لا نحن');
});

test('P54: الملفّات — المسار الجديد · /api/me/day?voice · /api/notices يعيد voice · الواجهتان · الاحتفاظ · لا SQL ولا env ولا كرون', () => {
  const route = read('app/api/me/voice-reply/route.ts'); assert.match(route, /export async function POST/); assert.match(route, /export async function DELETE/); assert.match(route, /wordvoice:\$\{user\.id\}`, 3600, VOICE_LIMITS\.perHour/); assert.match(route, /req\.formData\(\)/); assert.match(route, /resolveWordForLearner/); assert.match(route, /randomUUID\(\)/); assert.match(route, /upsert: false/); assert.match(route, /removeQuiet\(db, path\)/, 'فشل التسجيل → حذف الملف'); assert.match(route, /replaced_voice/); assert.match(route, /action: 'word_voice'/);
  const day = read('app/api/me/day/route.ts'); assert.match(day, /searchParams\.get\('voice'\)/); assert.match(day, /voiceUrlFor\(db, \[\.\.\.me\.trainerIds, me\.id\], voice\)/); assert.match(day, /isId\(voice\)/);
  const notices = read('app/api/notices/route.ts'); assert.match(notices, /reply: \{ chips: CHIPS, max: REPLY_MAX \}/, 'P53 كما هو'); assert.match(notices, /voice: \{ max_sec: VOICE_LIMITS\.maxSeconds, max_bytes: VOICE_LIMITS\.maxBytes/); assert.match(notices, /voice_sec:/);
  const ui = read('app/components/Notices.tsx') + read('app/components/VoiceRecorder.tsx'); /* P55: المسجّل صار مكوّنًا مشتركًا */ assert.match(ui, /import VoiceRecorder/); assert.match(ui, /data-testid="nt-voice"/); assert.match(ui, /قُل لي/); assert.match(ui, /canRecord\(\)/, 'يُخفى إن لم يُدعم'); assert.match(ui, /webkitSpeechRecognition/); assert.match(ui, /delete h\['Content-Type'\]/, 'multipart بلا Content-Type يدوي'); assert.match(ui, /\/api\/me\/voice-reply/); assert.match(ui, /T\('-tr-del'\)/); assert.match(ui, /nt-voice-del/); assert.match(ui, /تُحذف بعد 180 يومًا/); assert.match(ui, /prefers-reduced-motion/); assert.match(ui, /lang = ar \? 'ar-SA'/);
  const dy = read('app/me/day/DayBook.tsx'); assert.match(dy, /data-testid="dy-voice"/); assert.match(dy, /\/api\/me\/day\?voice=/); assert.match(dy, /dy-voice-tr/); assert.match(dy, /dy-hands3/); assert.match(dy, /dy-voice-playall/); assert.match(dy, /dy-pulse/); assert.match(dy, /يُحذف الصوت بعد 180 يومًا/); assert.match(dy, /aria-pressed/);
  const cron = read('lib/vault/cron.ts'); assert.match(cron, /purgeWordVoices\(db, r\.retentionDays, \{ dry \}\)/); assert.match(cron, /storage:athar-media\/word-voice/);
  assert.match(read('tests/index.ts'), /p54-voice-reply\.test/);
  for (const f of ['app/api/me/voice-reply/route.ts', 'lib/portal/word-reply.ts', 'app/components/Notices.tsx', 'app/me/day/DayBook.tsx']) { const s = read(f); assert.ok(!/process\.env\.[A-Z_]*VOICE/.test(s), `${f}: لا env جديد`); }
  assert.ok(!fs.existsSync(path.join(ROOT, 'supabase/migrations')) || !fs.readdirSync(path.join(ROOT, 'supabase/migrations')).some((f) => /p54|voice-reply/i.test(f)), 'لا SQL');
  const vercel = JSON.parse(read('vercel.json')); assert.ok(!JSON.stringify(vercel.crons || []).includes('voice'), 'لا كرون جديد');
});
