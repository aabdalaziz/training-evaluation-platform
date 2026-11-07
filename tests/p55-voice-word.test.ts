// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P55 «كلمة صوتية» — المدرّب يقول كلمته بصوته (≤ 20 ث · ≤ 768 ك.ب) من صندوق «كلمة» في /me/day
 *  الصرف: الحدود · validateTrainerVoice · trainerVoicePath (w-) · sendWord بصوت (ملف واحد ← N إشعارات · meta.voice/transcript · كلمة نصّية لاحقة تُزيل الصوت)
 *  pushNotice يمرّر meta ويعيد المحاولة بلا meta قبل تطبيق SQL · listNotices يسقط إلى الأعمدة القديمة · noticeVoiceUrl (المالك فقط · منتهٍ)
 *  purgeWordVoices على الإشعارات (يفرغ meta.voice ويضع voice_expired) · sweepVoiceStorage · answeredByVoice «أُجيب 🎙️» · hands3 يستثني المُجابين
 *  repliesLine/digest «أُجيبوا» · voice «سجّل كلمة» · registry · route multipart · DayBook/Notices/VoiceRecorder testids */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TRAINER_VOICE_LIMITS, TRAINER_VOICE_OFFICIAL, TRAINER_VOICE_TITLE, VOICE_LIMITS, validateTrainerVoice, trainerVoicePath, voiceOf, purgeWordVoices, sweepVoiceStorage, answeredByVoice, lastHandByLearner, handsByLearner, summarizeReplies, collectReplies, repliesLine, noticeVoiceUrl } from '../lib/portal/word-reply';
import { sendWord, digestText } from '../lib/portal/day';
import { pushNotice, listNotices } from '../lib/portal/notices';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';
import { REGISTRY } from '../lib/vault/registry';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const NOW = new Date('2026-11-07T06:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();
const V = (id: string, sec = 14): any => ({ path: `word-voice/t1/w-${id}.webm`, sec, bytes: 40000, mime: 'audio/webm', at: NOW.toISOString() });

/* قاعدة وهمية صغيرة: تفهم meta->voice · not.is.null · gte/lt · order/limit · maybeSingle · خيار «لا عمود meta» · مخزن مع list */
function fakeDb(over: Record<string, any[]> = {}, opts: { noMeta?: boolean } = {}) {
  const T: Record<string, any[]> = { portal_learner_notices: [], portal_word_replies: [], trainers: [{ id: 't1', name: 'د. أحمد', email: 'trainer@x.sa' }], profiles: [], audit_logs: [], ...over };
  const objects = new Map<string, number>(); const removed: string[][] = []; const signed: string[] = []; const errors: string[] = [];
  const get = (r: any, k: string) => { if (k.includes('->')) { const [c, key] = k.split('->'); const o = r[c]; return o && typeof o === 'object' ? o[key] : undefined; } return r[k]; };
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let mode = 'select'; let payload: any = null; let ord: { k: string; asc: boolean } | null = null; let conflict = ''; let ignoreDup = false;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => String(get(r, k)) === String(v)); return b; }, in(k: string, v: any[]) { const s = new Set(v.map(String)); f.push((r) => s.has(String(get(r, k)))); return b; }, is(k: string, v: any) { f.push((r) => (v === null ? get(r, k) == null : get(r, k) === v)); return b; },
      not(k: string, op: string, v: any) { if (op === 'is' && v === null) f.push((r) => get(r, k) != null); return b; }, gte(k: string, v: any) { f.push((r) => String(get(r, k) || '') >= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(get(r, k) || '') < String(v)); return b; },
      order(k: string, o?: any) { ord = { k, asc: o?.ascending !== false }; return b; }, limit(n: number) { lim = n; return b; }, single() { single = true; return b; }, maybeSingle() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, delete() { mode = 'delete'; return b; }, upsert(p: any, o?: any) { mode = 'upsert'; payload = p; conflict = o?.onConflict || ''; ignoreDup = !!o?.ignoreDuplicates; return b; },
      then(res: any) {
        if (mode === 'insert' || mode === 'upsert') { const a = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}-${table}`, created_at: NOW.toISOString(), ...p })); const out: any[] = [];
          if (opts.noMeta && table === 'portal_learner_notices' && a.some((p: any) => 'meta' in p)) { errors.push('meta'); return res({ data: null, error: { message: "Could not find the 'meta' column of 'portal_learner_notices' in the schema cache" } }); }
          for (const p of a) { const i = conflict ? rows.findIndex((r) => String(r[conflict]) === String(p[conflict])) : -1; if (i >= 0) { if (ignoreDup) continue; rows[i] = { ...rows[i], ...p, id: rows[i].id }; out.push(rows[i]); } else { rows.push(p); out.push(p); } }
          return res({ data: single ? out[0] || null : out, error: null }); }
        if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); return res({ data: single ? hit[0] || null : hit, error: null }); }
        if (mode === 'delete') { const keep = rows.filter((r) => !f.every((p) => p(r))); rows.splice(0, rows.length, ...keep); return res({ data: null, error: null }); }
        let hit = rows.filter((r) => f.every((p) => p(r))); if (ord) { const { k, asc } = ord; hit = [...hit].sort((x, y) => (String(x[k] || '') < String(y[k] || '') ? -1 : 1) * (asc ? 1 : -1)); } if (lim) hit = hit.slice(0, lim);
        return res({ data: single ? hit[0] || null : hit, error: null, count: hit.length }); } };
    return b; };
  const storage = { from: (bucket: string) => ({
    async upload(p: string, body: any) { objects.set(`${bucket}/${p}`, NOW.getTime()); return { data: { path: p }, error: null }; },
    async remove(ps: string[]) { removed.push(ps); ps.forEach((p) => objects.delete(`${bucket}/${p}`)); return { data: ps.map((name) => ({ name })), error: null }; },
    async createSignedUrl(p: string, sec: number) { signed.push(p); return objects.has(`${bucket}/${p}`) ? { data: { signedUrl: `https://signed.test/${p}?exp=${sec}` }, error: null } : { data: null, error: { message: 'Object not found' } }; },
    async list(prefix: string) { const keys = [...objects.keys()].filter((k) => k.startsWith(`${bucket}/${prefix}/`)).map((k) => k.slice(bucket.length + prefix.length + 2)); const dirs = new Set(keys.filter((k) => k.includes('/')).map((k) => k.split('/')[0]));
      return { data: ([...dirs].map((name) => ({ name, id: null })) as any[]).concat(keys.filter((k) => !k.includes('/')).map((name) => ({ name, id: 'obj', created_at: new Date(objects.get(`${bucket}/${prefix}/${name}`)!).toISOString() }))), error: null }; },
  }) };
  return { T, from: q, storage, objects, removed, signed, errors };
}
const me: any = { id: 'u-trainer', email: 'trainer@x.sa', name: 'د. أحمد', trainerIds: ['t1'], staff: false, viewing_other: false };
const room: any = { id: 'c1', code: 'A1', roster: 3, roster_list: [{ email: 'reem@x.sa', name: 'ريم العلي' }, { email: 'badr@x.sa', name: 'بدر' }, { email: 'sara@x.sa', name: 'سارة' }], absent_yesterday: [{ email: 'badr@x.sa', name: 'بدر' }], practice: { idle: [] } };

test('P55: الحدود · validateTrainerVoice · trainerVoicePath · الاسم الرسمي · voiceOf يقبل w-', () => {
  assert.equal(TRAINER_VOICE_LIMITS.maxSeconds, 20); assert.equal(TRAINER_VOICE_LIMITS.maxBytes, 768 * 1024); assert.equal(TRAINER_VOICE_TITLE, 'كلمة صوتية');
  assert.equal(TRAINER_VOICE_OFFICIAL.en, 'Trainer voice note to learner'); assert.match(TRAINER_VOICE_OFFICIAL.ar, /رسالة صوتية من المدرّب إلى المتعلّم/);
  const ok = validateTrainerVoice({ mime: 'audio/webm;codecs=opus', bytes: 600 * 1024, sec: 18 }); assert.ok(ok.ok && ok.mime === 'audio/webm' && ok.ext === 'webm' && ok.sec === 18, 'أكبر من حدّ المتعلّم (512) لكن ضمن حدّ المدرّب');
  assert.ok(!validateTrainerVoice({ mime: 'audio/webm', bytes: 800 * 1024, sec: 10 }).ok, '> 768 ك.ب'); assert.ok(!validateTrainerVoice({ mime: 'audio/webm', bytes: 5000, sec: 22 }).ok, '> 20 ث'); const edge = validateTrainerVoice({ mime: 'audio/mp4', bytes: 5000, sec: 21 }); assert.ok(edge.ok && edge.sec === 20 && edge.ext === 'm4a', 'تسامح ثانية');
  assert.ok(!validateTrainerVoice({ mime: 'video/webm', bytes: 5000, sec: 5 }).ok); assert.ok(!validateTrainerVoice({ mime: 'audio/webm', bytes: 10, sec: 5 }).ok); assert.ok(!validateTrainerVoice({ mime: 'audio/webm', bytes: 5000, sec: 0 }).ok);
  assert.equal(trainerVoicePath('t1', 'abc', 'webm'), 'word-voice/t1/w-abc.webm', 'نفس مجلد الأمانات · البادئة w- تميّز كلمة المدرّب'); assert.equal(trainerVoicePath('../t1', 'a/b', 'ogg'), 'word-voice/t1/w-ab.ogg');
  assert.deepEqual(voiceOf({ voice: V('x') }), V('x'));
});

test('P55: sendWord بصوت — ملف واحد ← 3 إشعارات بـ meta.voice/transcript · المتن الافتراضي 🎙️ · نصّ+صوت · كلمة نصّية لاحقة تُزيل الصوت · voice_sec في النتيجة · بلا شيء → خطأ', async () => {
  const db = fakeDb();
  const r1: any = await sendWord(db, me, room, { mode: 'all', voice: V('one'), transcript: 'أحسنتم اليوم' }, { now: NOW });
  assert.equal(r1.sent, 3); assert.equal(r1.recipients, 3); assert.equal(r1.voice_sec, 14); assert.match(r1.text_ar, /🎙️ كلمة صوتية من مدرّبك \(14 ث\)/);
  const ns = db.T.portal_learner_notices; assert.equal(ns.length, 3); assert.ok(ns.every((n: any) => n.kind === 'trainer_word' && n.meta?.voice?.path === 'word-voice/t1/w-one.webm' && n.meta?.transcript === 'أحسنتم اليوم'), 'المسار نفسه مرجعًا في كل إشعار');
  assert.equal(new Set(ns.map((n: any) => n.meta.voice.path)).size, 1, 'ملف واحد لا ثلاثة');
  const r2: any = await sendWord(db, me, room, { mode: 'one', email: 'reem@x.sa', text: 'ريم، نطقك تحسّن', voice: V('two', 9) }, { now: NOW });
  assert.equal(r2.sent, 1); const reem = ns.find((n: any) => n.email === 'reem@x.sa'); assert.equal(reem.body_ar, 'ريم، نطقك تحسّن'); assert.equal(reem.meta.voice.sec, 9); assert.equal(reem.meta.transcript, null, 'نصّ + صوت: المتن هو النصّ');
  assert.equal(ns.length, 3, 'نفس اليوم → تحديث لا إضافة');
  const r3: any = await sendWord(db, me, room, { mode: 'one', email: 'reem@x.sa', text: 'كلمة نصّية فقط' }, { now: NOW });
  assert.equal(r3.sent, 1); assert.equal(r3.voice_sec, null); assert.deepEqual(ns.find((n: any) => n.email === 'reem@x.sa').meta, {}, 'الكلمة النصّية اللاحقة في اليوم نفسه تُزيل الصوت (الأحدث تحلّ محلّ الأقدم)');
  const bad: any = await sendWord(db, me, room, { mode: 'one', email: 'reem@x.sa' }, { now: NOW }); assert.match(bad.error, /قُلها بصوتك/);
  const tplOnly: any = await sendWord(db, me, room, { mode: 'absent', template: 'absent' }, { now: NOW }); assert.equal(tplOnly.sent, 1, 'الصيغ القديمة كما هي');
});

test('P55: pushNotice قبل تطبيق SQL — يعيد المحاولة بلا meta فلا تتوقّف الكلمات · listNotices يسقط إلى الأعمدة القديمة', async () => {
  const db = fakeDb({}, { noMeta: true });
  const r = await pushNotice(db, { email: 'reem@x.sa', kind: 'trainer_word', title_ar: 'كلمة', body_ar: 'نصّ', dedupe_key: 'trainer_word:t1:reem@x.sa:2026-11-07', push: false, merge: true, meta: { voice: V('z') } } as any);
  assert.ok(r.inserted && r.id, 'نجح رغم غياب العمود'); assert.deepEqual(db.errors, ['meta']); assert.equal(db.T.portal_learner_notices.length, 1); assert.ok(!('meta' in db.T.portal_learner_notices[0]));
  const r2 = await pushNotice(db, { email: 'reem@x.sa', kind: 'exit_final', title_ar: 'x', body_ar: 'y', dedupe_key: 'exit_final:r1', push: false } as any); assert.ok(r2.inserted, 'بلا meta لا محاولة ثانية'); assert.equal(db.errors.length, 1);
  /* listNotices: قاعدة ترفض عمود meta في select */
  const db2 = fakeDb({ portal_learner_notices: [{ id: 'n1', email: 'reem@x.sa', kind: 'trainer_word', title_ar: 'k', body_ar: 'b', dedupe_key: 'd1', created_at: NOW.toISOString(), read_at: null }] });
  const orig = db2.from; let calls = 0; (db2 as any).from = (t: string) => { const b = orig(t); const sel = b.select; b.select = (cols: string) => { calls += 1; if (/meta/.test(cols)) { const bad: any = { eq: () => bad, order: () => bad, limit: () => bad, is: () => bad, then: (res: any) => res({ data: null, error: { message: 'column portal_learner_notices.meta does not exist' } }) }; return bad; } return sel.call(b, cols); }; return b; };
  const list = await listNotices(db2, 'reem@x.sa'); assert.equal(list.length, 1); assert.equal(calls, 2, 'محاولة بـ meta ثم بدونها');
});

test('P55: noticeVoiceUrl — المالك فقط · لا صوت · منتهٍ · رابط موقَّع 300 ث', async () => {
  const db = fakeDb({ portal_learner_notices: [
    { id: 'n1', email: 'reem@x.sa', kind: 'trainer_word', meta: { voice: V('a'), transcript: 'مرحبًا' } },
    { id: 'n2', email: 'reem@x.sa', kind: 'trainer_word', meta: {} },
    { id: 'n3', email: 'reem@x.sa', kind: 'trainer_word', meta: { voice_expired: true } },
  ] });
  await db.storage.from('athar-media').upload('word-voice/t1/w-a.webm', Buffer.alloc(10));
  const ok: any = await noticeVoiceUrl(db, 'Reem@x.sa', 'n1'); assert.match(ok.url, /^https:\/\/signed\.test\/word-voice\/t1\/w-a\.webm\?exp=300$/); assert.equal(ok.sec, 14); assert.equal(ok.transcript, 'مرحبًا');
  const other: any = await noticeVoiceUrl(db, 'badr@x.sa', 'n1'); assert.equal(other.status, 404); assert.match(other.error, /ليست لك/);
  const none: any = await noticeVoiceUrl(db, 'reem@x.sa', 'n2'); assert.equal(none.status, 404); assert.match(none.error, /لا صوت/);
  const exp: any = await noticeVoiceUrl(db, 'reem@x.sa', 'n3'); assert.equal(exp.status, 404); assert.match(exp.error, /180 يومًا/);
  const missing: any = await noticeVoiceUrl(db, 'reem@x.sa', 'nope'); assert.equal(missing.status, 404);
});

test('P55: purgeWordVoices على الإشعارات — يحذف الملف مرّة واحدة ويفرغ meta.voice ويضع voice_expired · الحديثة لا تُمسّ · dry · sweepVoiceStorage للملفات اليتيمة', async () => {
  const db = fakeDb({ portal_learner_notices: [
    { id: 'o1', email: 'reem@x.sa', kind: 'trainer_word', created_at: ago(200), meta: { voice: V('old'), transcript: 'قديم' } },
    { id: 'o2', email: 'badr@x.sa', kind: 'trainer_word', created_at: ago(200), meta: { voice: V('old') } },
    { id: 'o3', email: 'sara@x.sa', kind: 'trainer_word', created_at: ago(200), meta: {} },
    { id: 'o4', email: 'sara@x.sa', kind: 'exit_final', created_at: ago(200), meta: { voice: V('notword') } },
    { id: 'n1', email: 'reem@x.sa', kind: 'trainer_word', created_at: ago(10), meta: { voice: V('new') } },
  ] });
  for (const p of ['w-old', 'w-new', 'w-orphan']) db.objects.set(`athar-media/word-voice/t1/${p}.webm`, NOW.getTime() - (p === 'w-new' ? 10 : 200) * 86400000);
  const dry = await purgeWordVoices(db, 180, { now: NOW, dry: true, table: 'portal_learner_notices' }); assert.equal(dry.scanned, 2); assert.equal(dry.removed, 1, 'ملف واحد لإشعارين'); assert.equal(db.removed.length, 0);
  const r = await purgeWordVoices(db, 180, { now: NOW, table: 'portal_learner_notices' }); assert.equal(r.removed, 1); assert.deepEqual(db.removed, [['word-voice/t1/w-old.webm']]);
  const o1 = db.T.portal_learner_notices.find((n: any) => n.id === 'o1'); assert.deepEqual(o1.meta, { voice_expired: true }, 'meta.voice والنصّ أُزيلا'); assert.deepEqual(db.T.portal_learner_notices.find((n: any) => n.id === 'o2').meta, { voice_expired: true });
  assert.ok(db.T.portal_learner_notices.find((n: any) => n.id === 'n1').meta.voice, 'الحديث لا يُمسّ'); assert.ok(db.T.portal_learner_notices.find((n: any) => n.id === 'o4').meta.voice, 'نوع آخر لا يُمسّ');
  assert.ok(db.objects.has('athar-media/word-voice/t1/w-orphan.webm'));
  const sw = await sweepVoiceStorage(db, 180, { now: NOW }); assert.equal(sw.removed, 1, 'اليتيم القديم فقط'); assert.ok(!db.objects.has('athar-media/word-voice/t1/w-orphan.webm')); assert.ok(db.objects.has('athar-media/word-voice/t1/w-new.webm'));
  /* الردود (P54) كما هي */
  const db2 = fakeDb({ portal_word_replies: [{ id: 'r1', created_at: ago(200), meta: { voice: { path: 'word-voice/t1/r1.webm', sec: 5, bytes: 1, mime: 'audio/webm', at: 'x' } } }] });
  const r2 = await purgeWordVoices(db2, 180, { now: NOW }); assert.equal(r2.removed, 1); assert.deepEqual(db2.removed, [['word-voice/t1/r1.webm']]); assert.ok(db2.T.portal_word_replies[0].meta.voice, 'صفوف الردود يحذفها الاحتفاظ لاحقًا — لا نفرغها');
});

test('P55: «أُجيب 🎙️» — ✋ ×3 ثم كلمة صوتية من المدرّب بعد آخر ✋ → answered · قبلها لا · نصّية لا · مدرّب آخر لا · hands3 يستثني المُجابين · repliesLine/digest «أُجيبوا»', async () => {
  const mk = (id: string, email: string, chip: string | null, daysAgo: number): any => ({ id, created_at: ago(daysAgo), updated_at: ago(daysAgo), learner_email: email, learner_name: '', chip, text: null, seen_at: null, notice_id: 'n', classroom_id: 'c1', trainer_id: 't1', meta: {} });
  const rows = [mk('a1', 'a@x.sa', 'need_help', 1), mk('a2', 'a@x.sa', 'need_help', 3), mk('a3', 'a@x.sa', 'need_help', 5), mk('b1', 'b@x.sa', 'need_help', 1), mk('b2', 'b@x.sa', 'need_help', 2), mk('b3', 'b@x.sa', 'need_help', 4), mk('c1', 'c@x.sa', 'need_help', 1), mk('c2', 'c@x.sa', 'need_help', 2), mk('c3', 'c@x.sa', 'need_help', 3), mk('d1', 'd@x.sa', 'need_help', 1)];
  const hands = handsByLearner(rows, NOW); assert.equal(hands.get('a@x.sa'), 3); assert.equal(hands.get('d@x.sa'), 1);
  const last = lastHandByLearner(rows, NOW); assert.equal(last.get('a@x.sa'), ago(1)); assert.equal(last.get('c@x.sa'), ago(1));
  const notices = [
    { id: 'w1', email: 'a@x.sa', kind: 'trainer_word', created_at: ago(0.5), dedupe_key: 'trainer_word:t1:a@x.sa:2026-11-07', meta: { voice: V('a') } }, /* بعد آخر ✋ → أُجيب */
    { id: 'w2', email: 'b@x.sa', kind: 'trainer_word', created_at: ago(2.5), dedupe_key: 'trainer_word:t1:b@x.sa:2026-11-05', meta: { voice: V('b') } }, /* قبل آخر ✋ (منذ يوم) → لا */
    { id: 'w3', email: 'c@x.sa', kind: 'trainer_word', created_at: ago(0.5), dedupe_key: 'trainer_word:t1:c@x.sa:2026-11-07', meta: {} }, /* نصّية → لا */
    { id: 'w4', email: 'c@x.sa', kind: 'trainer_word', created_at: ago(0.2), dedupe_key: 'trainer_word:t9:c@x.sa:2026-11-07', meta: { voice: { ...V('x'), path: 'word-voice/t9/w-x.webm' } } }, /* مدرّب آخر → لا */
  ];
  const db = fakeDb({ portal_learner_notices: notices, portal_word_replies: rows });
  const ans = await answeredByVoice(db, ['t1'], hands, last, NOW); assert.deepEqual([...ans], ['a@x.sa']);
  const s = summarizeReplies(rows, new Map(), hands, ans); assert.equal(s.items.find((i) => i.email === 'a@x.sa')!.answered, true); assert.equal(s.items.find((i) => i.email === 'b@x.sa')!.answered, false); assert.equal(s.items.find((i) => i.email === 'd@x.sa')!.answered, false, 'أقل من 3 لا شارة أصلًا');
  const c = await collectReplies(db, ['t1'], { now: NOW }); assert.equal(c.answered, 1); assert.equal(c.hands3, 2, '3 رفعوا ثلاثًا − 1 أُجيب'); assert.equal(c.rooms[0].items.find((i) => i.email === 'a@x.sa')!.answered, true);
  assert.equal(repliesLine(7, 2, 3, 1), 'ردود أمس 7 · ✋ 2 · 🎙️ 3 · أُجيبوا 🎙️ 1'); assert.equal(repliesLine(7, 2, 3), 'ردود أمس 7 · ✋ 2 · 🎙️ 3', 'P54 ثابت'); assert.equal(repliesLine(0, 0, 0, 2), '');
  const d = digestText({ sessions_today: 1, absent_yesterday: 0, idle: 0, to_sign: 0, replies_yesterday: 3, need_help_yesterday: 1, hands3_week: 1, answered_week: 2 }); assert.match(d.body_ar + d.title_ar, /أُجيبوا 🎙️ 2/);
});

test('P55: «نادِ» سجّل كلمة · السجلّ · الكرون · المسار multipart · الواجهات (DayBook · Notices · VoiceRecorder)', () => {
  const dest = DESTINATIONS.find((d) => d.href === '/me/day#dy-word'); assert.ok(dest, 'وجهة كلمة بصوتي'); assert.equal(dest!.label, 'كلمة بصوتي');
  for (const u of ['سجّل كلمة', 'كلمة بصوتي', 'كلمة صوتية']) { const c: any = parseCommand(u); assert.equal(c?.href, '/me/day#dy-word', u); }
  const reg = REGISTRY.find((r: any) => r.table === 'portal_learner_notices') as any; assert.match(reg.data_ar, /تسجيل صوتي منه ≤ 20 ث/); assert.match(reg.data_ar, /180 يومًا/);
  const cron = read('lib/vault/cron.ts'); assert.match(cron, /table: 'portal_learner_notices'/); assert.match(cron, /word-voice\(trainer\)/); assert.match(cron, /sweepVoiceStorage/);
  const route = read('app/api/me/day/route.ts'); assert.match(route, /multipart\/form-data/); assert.match(route, /validateTrainerVoice/); assert.match(route, /trainerVoicePath\(me\.trainerIds\[0\] \|\| me\.id, randomUUID\(\), v\.ext\)/); assert.match(route, /voice_sec: voice \? voice\.sec : null/); assert.match(route, /remove\(\[voice\.path\]\)/, 'لا مستلم → حذف الملف');
  const nr = read('app/api/notices/route.ts'); assert.match(nr, /searchParams\.get\('voice'\)/); assert.match(nr, /noticeVoiceUrl\(db, user\.email, vid\)/); assert.match(nr, /voice: tv \? \{ sec: tv\.sec, transcript: transcriptOf\(n\.meta\) \} : null/);
  const nt = read('lib/portal/notices.ts'); assert.match(nt, /meta\?: Record<string, unknown> \| null/); assert.match(nt, /NOTICE_COLS \+ ',meta'/);
  const day = read('lib/portal/day.ts'); assert.match(day, /🎙️ كلمة صوتية من مدرّبك/); assert.match(day, /answered_week/);
  const vr = read('app/components/VoiceRecorder.tsx'); for (const t of ['-start', '-stop', '-send', '-redo', '-tr', '-cancel']) assert.ok(vr.includes(`T('${t}')`), `VoiceRecorder testid ${t}`); assert.match(vr, /export const VOICE_RECORDER_CSS/); assert.match(vr, /export type VoiceTake/);
  const db = read('app/me/day/DayBook.tsx'); for (const t of ['dy-word-voice', 'dy-word-voice-take', 'dy-word-voice-redo', 'dy-word-voice-del', 'dy-answered', 'dy-hands3']) assert.ok(db.includes(`data-testid="${t}"`), `DayBook ${t}`);
  assert.match(db, /testid="dy-rec"/); assert.match(db, /maxSec=\{TRAINER_VOICE_SEC\}/); assert.match(db, /أُجيب 🎙️/); assert.match(db, /أُجيبوا 🎙️/); assert.match(db, /أرسل الكلمة بصوتك/); assert.match(db, /fd\.append\('file', take\.blob, voiceFileName\(take\.blob\)\)/); assert.match(db, /fd\.append\('duration_sec'/); assert.match(db, /import VoiceRecorder/);
  const n = read('app/components/Notices.tsx'); assert.match(n, /import VoiceRecorder/); assert.ok(!/function VoiceReply\(/.test(n), 'المسجّل القديم أُزيل لصالح المشترك'); for (const t of ['nt-tvoice', 'nt-tvoice-play', 'nt-tvoice-tr']) assert.ok(n.includes(`data-testid="${t}"`), `Notices ${t}`); assert.match(n, /\/api\/notices\?voice=/); assert.match(n, /استمع إلى مدرّبك/);
  assert.equal(VOICE_LIMITS.maxSeconds, 15, 'حدّ المتعلّم كما هو');
});
