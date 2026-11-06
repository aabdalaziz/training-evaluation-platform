// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P53 «ردّ على الكلمة» — الصرف (التنقية · اللمسات · قراءة إشعار الكلمة · التجميع ✋ أولًا · نصّ إشعار المدرّب · سطر الموجز · دلو الساعة) · الغراء على قاعدة وهمية (الردّ · التعديل خلال ساعة · الثبات بعدها · إشعار مجمَّع مرّة في الساعة · جمع الردود · «قرأت» · ردودي · ردود أمس · دفتر اليوم) · عقد التكامل */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CHIPS, REPLY_MAX, EDIT_WINDOW_MIN, cleanReply, chipOf, chipLabel, parseWordNotice, summarizeReplies, trainerNoticeText, repliesLine, hourBucket, submitReply, collectReplies, markRepliesSeen, myReplies, repliesYesterday, REPLY_OFFICIAL } from '../lib/portal/word-reply';
import { KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { digestText, collectDayBook } from '../lib/portal/day';
import { DESTINATIONS, parseCommand } from '../lib/portal/voice';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('P53: التنقية · اللمسات · قراءة إشعار الكلمة · التجميع · النصوص · الدلو', () => {
  assert.equal(REPLY_MAX, 200); assert.equal(EDIT_WINDOW_MIN, 60); assert.equal(CHIPS.length, 3); assert.deepEqual(CHIPS.map((c) => c.key), ['got_it', 'need_help', 'will_attend']); assert.equal(REPLY_OFFICIAL.en, 'Learner replies to trainer notes');
  assert.equal(cleanReply(' <b>شكرًا</b> يا أستاذ https://x.y و a@b.co  '), 'شكرًا يا أستاذ و'); assert.equal(cleanReply('x'.repeat(500)).length, 200); assert.equal(cleanReply(null), '');
  assert.equal(chipOf('need_help'), 'need_help'); assert.equal(chipOf('hack'), null); assert.equal(chipOf(''), null); assert.equal(chipLabel('got_it'), '🌱 وصلت، شكرًا'); assert.equal(chipLabel(null), '');
  assert.deepEqual(parseWordNotice({ kind: 'trainer_word', dedupe_key: 'trainer_word:t1:reem@example.com:2026-11-07', ref_id: 'c1' }), { trainer_id: 't1', classroom_id: 'c1' });
  assert.equal(parseWordNotice({ kind: 'exit_final', dedupe_key: 'trainer_word:t1:x:y', ref_id: 'c1' }), null); assert.equal(parseWordNotice({ kind: 'trainer_word', dedupe_key: 'other:t1', ref_id: null }), null); assert.deepEqual(parseWordNotice({ kind: 'trainer_word', dedupe_key: 'trainer_word:u9:e:d', ref_id: null }), { trainer_id: 'u9', classroom_id: null });
  const rows: any[] = [
    { id: 'a', created_at: '2026-11-07T06:00:00Z', updated_at: '2026-11-07T06:00:00Z', notice_id: 'n1', trainer_id: 't1', classroom_id: 'c1', learner_email: 'A@x.sa', learner_name: null, chip: 'got_it', text: null, seen_at: null, meta: {} },
    { id: 'b', created_at: '2026-11-07T05:00:00Z', updated_at: '2026-11-07T05:00:00Z', notice_id: 'n2', trainer_id: 't1', classroom_id: 'c1', learner_email: 'b@x.sa', learner_name: 'بدر', chip: 'need_help', text: 'لم أفهم الدرس', seen_at: '2026-11-07T05:30:00Z', meta: {} },
    { id: 'c', created_at: '2026-11-07T07:00:00Z', updated_at: '2026-11-07T07:00:00Z', notice_id: 'n3', trainer_id: 't1', classroom_id: 'c1', learner_email: 'c@x.sa', learner_name: null, chip: null, text: 'شكرًا', seen_at: null, meta: {} },
  ];
  const s = summarizeReplies(rows, new Map([['a@x.sa', 'أحمد']])); assert.equal(s.total, 3); assert.equal(s.need_help, 1); assert.equal(s.unseen, 2); assert.deepEqual(s.by_chip, { got_it: 1, need_help: 1, will_attend: 0 });
  assert.deepEqual(s.items.map((i) => i.id), ['b', 'c', 'a'], '✋ أولًا ثم الأحدث'); assert.equal(s.items[2].name, 'أحمد'); assert.equal(s.items[0].chip_ar, '✋ أحتاج مساعدة'); assert.equal(s.items[1].chip_ar, '');
  assert.equal(trainerNoticeText(1, 0).title_ar, 'ردّ جديد على كلمتك'); assert.equal(trainerNoticeText(2, 0).title_ar, 'ردّان جديدان على كلمتك'); assert.equal(trainerNoticeText(3, 1).title_ar, '3 ردود جديدة على كلمتك'); assert.equal(trainerNoticeText(11, 2).title_ar, '11 ردًّا جديدًا على كلمتك');
  assert.match(trainerNoticeText(3, 1).body_ar, /^متعلّم واحد يرفع يده/); assert.match(trainerNoticeText(3, 2).body_ar, /^متعلّمان يرفعان/); assert.match(trainerNoticeText(5, 4).body_ar, /^4 متعلّمين يرفعون/); assert.equal(trainerNoticeText(1, 0).url, '/me/day#replies');
  assert.equal(repliesLine(0, 0), ''); assert.equal(repliesLine(7, 0), 'ردود أمس 7'); assert.equal(repliesLine(7, 2), 'ردود أمس 7 · ✋ 2');
  assert.equal(hourBucket(new Date('2026-11-07T06:59:59Z')), '2026-11-07T06'); assert.equal(hourBucket(new Date('2026-11-07T07:00:00Z')), '2026-11-07T07');
  assert.equal(KIND_AR.word_reply, 'ردّ على كلمتك'); assert.equal(KIND_ICON.word_reply, '🗨️');
  assert.equal(digestText({ sessions_today: 1, absent_yesterday: 0, idle: 0, to_sign: 0, replies_yesterday: 3, need_help_yesterday: 1 }).title_ar, 'دفتر اليوم: جلسة واحدة · ردود أمس 3 · ✋ 1');
  assert.equal(digestText({ sessions_today: 0, absent_yesterday: 0, idle: 0, to_sign: 0 }).title_ar, 'دفتر اليوم: لا شيء يستدعي انتباهك');
});

/** قاعدة وهمية: كلمة من t1 إلى ريم (إشعار n1 · شعبة c1) + كلمة إلى بدر (n2) · المدرّب t1 بريده trainer@x.sa */
function fakeDb(over: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {
    portal_learner_notices: [
      { id: 'n1', email: 'reem@x.sa', kind: 'trainer_word', ref_id: 'c1', dedupe_key: 'trainer_word:t1:reem@x.sa:2026-11-07', created_at: '2026-11-07T05:00:00Z' },
      { id: 'n2', email: 'badr@x.sa', kind: 'trainer_word', ref_id: 'c1', dedupe_key: 'trainer_word:t1:badr@x.sa:2026-11-07', created_at: '2026-11-07T05:00:00Z' },
      { id: 'n3', email: 'reem@x.sa', kind: 'exit_final', ref_id: null, dedupe_key: 'exit_final:r1', created_at: '2026-11-07T05:00:00Z' },
    ],
    portal_word_replies: [], trainers: [{ id: 't1', name: 'د. أحمد', email: 'Trainer@x.sa' }], profiles: [], audit_logs: [], ...over,
  };
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'; let payload: any = null; let ord: { k: string; asc: boolean } | null = null; let conflict = ''; let ignoreDup = false;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => String(r[k]) === String(v)); return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, in(k: string, v: any[]) { const s = new Set(v.map(String)); f.push((r) => s.has(String(r[k]))); return b; }, is(k: string, v: any) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; }, not(k: string, op: string, v: any) { if (op === 'is' && v === null) f.push((r) => r[k] != null); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k] || '') >= String(v)); return b; }, lte(k: string, v: any) { f.push((r) => String(r[k] || '') <= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(r[k] || '') < String(v)); return b; }, ilike(k: string, v: any) { f.push((r) => String(r[k] || '').toLowerCase() === String(v).toLowerCase()); return b; }, or() { return b; }, order(k: string, o?: any) { ord = { k, asc: o?.ascending !== false }; return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, upsert(p: any, o?: any) { mode = 'upsert'; payload = p; conflict = o?.onConflict || ''; ignoreDup = !!o?.ignoreDuplicates; return b; },
      then(res: any) {
        if (mode === 'insert' || mode === 'upsert') { const a = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${rows.length + 1}-${table}`, created_at: new Date().toISOString(), ...p })); const out: any[] = [];
          for (const p of a) { const i = conflict ? rows.findIndex((r) => String(r[conflict]) === String(p[conflict])) : -1; if (i >= 0) { if (ignoreDup) continue; rows[i] = { ...rows[i], ...p, id: rows[i].id }; out.push(rows[i]); } else { rows.push(p); out.push(p); } }
          return res({ data: single ? out[0] || null : out, error: null }); }
        if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); return res({ data: single ? hit[0] || null : hit, error: single && !hit[0] ? { message: 'no row' } : null }); }
        let hit = rows.filter((r) => f.every((p) => p(r))); if (ord) { const { k, asc } = ord; hit = [...hit].sort((x, y) => (String(x[k] || '') < String(y[k] || '') ? -1 : 1) * (asc ? 1 : -1)); } if (lim) hit = hit.slice(0, lim);
        return res({ data: single ? hit[0] || null : hit, error: null, count: hit.length }); } };
    return b; };
  return { T, from: q };
}

test('P53: submitReply — رفض الفارغ · ليست كلمتي · ليست كلمة · لمسة · تعديل خلال ساعة (يعيد seen) · ثبات بعد ساعة · إشعار المدرّب مجمَّع (نفس الساعة = إشعار واحد يُحدَّث) · myReplies', async () => {
  const db = fakeDb(); const now = new Date('2026-11-07T06:10:00Z'); const reem = { email: 'Reem@x.sa', name: 'ريم' };
  const e1 = await submitReply(db as any, reem, { notice_id: 'n1' }, { now }); assert.ok('error' in e1 && e1.status === 400);
  const e2 = await submitReply(db as any, reem, { notice_id: 'n2', chip: 'got_it' }, { now }); assert.ok('error' in e2 && e2.status === 404, 'كلمة بدر ليست لريم');
  const e3 = await submitReply(db as any, reem, { notice_id: 'n3', chip: 'got_it' }, { now }); assert.ok('error' in e3 && e3.status === 400, 'exit_final ليست كلمة');
  const dry = await submitReply(db as any, reem, { notice_id: 'n1', chip: 'got_it' }, { now, dry: true }); assert.ok(!('error' in dry) && dry.created); assert.equal(db.T.portal_word_replies.length, 0);
  const r1 = await submitReply(db as any, reem, { notice_id: 'n1', chip: 'got_it', text: ' <i>شكرًا</i> أستاذ ' }, { now }); assert.ok(!('error' in r1), JSON.stringify(r1));
  assert.equal(r1.created, true); assert.equal(r1.row.trainer_id, 't1'); assert.equal(r1.row.classroom_id, 'c1'); assert.equal(r1.row.learner_email, 'reem@x.sa'); assert.equal(r1.row.learner_name, 'ريم'); assert.equal(r1.row.chip, 'got_it'); assert.equal(r1.row.text, 'شكرًا أستاذ'); assert.equal(r1.notified, true);
  const n = db.T.portal_learner_notices.filter((x: any) => x.kind === 'word_reply'); assert.equal(n.length, 1); assert.equal(n[0].email, 'trainer@x.sa'); assert.equal(n[0].title_ar, 'ردّ جديد على كلمتك'); assert.equal(n[0].url, '/me/day#replies'); assert.equal(n[0].dedupe_key, 'word_reply:t1:2026-11-07T06');
  db.T.portal_word_replies[0].seen_at = '2026-11-07T06:20:00Z';
  const r2 = await submitReply(db as any, reem, { notice_id: 'n1', chip: 'need_help' }, { now: new Date('2026-11-07T06:40:00Z') }); assert.ok(!('error' in r2)); assert.equal(r2.created, false); assert.equal(db.T.portal_word_replies.length, 1, 'ردّ واحد لكل كلمة'); assert.equal(db.T.portal_word_replies[0].chip, 'need_help'); assert.equal(db.T.portal_word_replies[0].text, null); assert.equal(db.T.portal_word_replies[0].seen_at, null, 'التعديل يعيد الردّ جديدًا');
  const r2b = await submitReply(db as any, reem, { notice_id: 'n1', text: 'لم أفهم الدرس' }, { now: new Date('2026-11-07T06:45:00Z') }); assert.ok(!('error' in r2b)); assert.equal(db.T.portal_word_replies[0].chip, 'need_help', 'تعديل بسطر فقط يُبقي اللمسة السابقة'); assert.equal(db.T.portal_word_replies[0].text, 'لم أفهم الدرس');
  const n2 = db.T.portal_learner_notices.filter((x: any) => x.kind === 'word_reply'); assert.equal(n2.length, 1, 'نفس الساعة → الإشعار نفسه'); assert.match(n2[0].body_ar, /^متعلّم واحد يرفع يده/, 'الإشعار المجمَّع يُحدَّث بالعدّ الجديد');
  const late = await submitReply(db as any, reem, { notice_id: 'n1', chip: 'got_it' }, { now: new Date('2026-11-07T07:11:00Z') }); assert.ok('error' in late && late.status === 409, 'بعد ساعة من الإنشاء يثبت');
  const badr = await submitReply(db as any, { email: 'badr@x.sa' }, { notice_id: 'n2', text: 'سأحاول' }, { now: new Date('2026-11-07T07:30:00Z') }); assert.ok(!('error' in badr)); assert.equal(db.T.portal_learner_notices.filter((x: any) => x.kind === 'word_reply').length, 2, 'ساعة أخرى → إشعار آخر');
  const mine = await myReplies(db as any, 'REEM@x.sa', ['n1', 'n3']); assert.equal(mine.size, 1); assert.equal(mine.get('n1')!.chip, 'need_help'); assert.equal(mine.get('n1')!.chip_ar, '✋ أحتاج مساعدة'); assert.equal(typeof mine.get('n1')!.editable, 'boolean');
});

test('P53: collectReplies (14 يومًا · بالشعبة · ✋ أولًا) · markRepliesSeen (شعبة ثم الكلّ) · repliesYesterday · collectDayBook يحمل replies والعدّادات', async () => {
  const db = fakeDb({ portal_word_replies: [
    { id: 'a', created_at: '2026-11-06T06:00:00Z', updated_at: '2026-11-06T06:00:00Z', notice_id: 'n1', trainer_id: 't1', classroom_id: 'c1', learner_email: 'reem@x.sa', learner_name: 'ريم', chip: 'got_it', text: null, seen_at: null, meta: {} },
    { id: 'b', created_at: '2026-11-06T07:00:00Z', updated_at: '2026-11-06T07:00:00Z', notice_id: 'n2', trainer_id: 't1', classroom_id: 'c1', learner_email: 'badr@x.sa', learner_name: 'بدر', chip: 'need_help', text: 'أحتاج شرحًا', seen_at: null, meta: {} },
    { id: 'c', created_at: '2026-11-05T07:00:00Z', updated_at: '2026-11-05T07:00:00Z', notice_id: 'n9', trainer_id: 't1', classroom_id: null, learner_email: 'z@x.sa', learner_name: null, chip: 'will_attend', text: null, seen_at: '2026-11-05T08:00:00Z', meta: {} },
    { id: 'old', created_at: '2026-10-01T07:00:00Z', updated_at: '2026-10-01T07:00:00Z', notice_id: 'n8', trainer_id: 't1', classroom_id: 'c1', learner_email: 'o@x.sa', learner_name: null, chip: 'got_it', text: null, seen_at: null, meta: {} },
    { id: 'other', created_at: '2026-11-06T07:00:00Z', updated_at: '2026-11-06T07:00:00Z', notice_id: 'n7', trainer_id: 't2', classroom_id: 'c2', learner_email: 'q@x.sa', learner_name: null, chip: 'need_help', text: null, seen_at: null, meta: {} },
  ] });
  const now = new Date('2026-11-07T06:00:00Z'); const c = await collectReplies(db as any, ['t1'], { now });
  assert.equal(c.total, 3, 'بلا القديم وبلا مدرّب آخر'); assert.equal(c.need_help, 1); assert.equal(c.unseen, 2); assert.equal(c.rooms.length, 2); assert.equal(c.rooms[0].classroom_id, 'c1'); assert.deepEqual(c.rooms[0].items.map((i) => i.id), ['b', 'a']); assert.equal(c.rooms[1].classroom_id, null);
  assert.equal(await markRepliesSeen(db as any, ['t1'], 'c1', { now }), 3, 'شعبة c1 كاملة (حتى القديم)'); assert.equal((await collectReplies(db as any, ['t1'], { now })).unseen, 0); assert.equal(db.T.portal_word_replies.find((r: any) => r.id === 'other').seen_at, null, 'لا يمسّ مدرّبًا آخر');
  assert.equal(await markRepliesSeen(db as any, ['t1'], null, { now }), 0, 'لم يبقَ غير مقروء'); assert.equal(await markRepliesSeen(db as any, [], null), 0);
  const y = await repliesYesterday(db as any, ['t1'], now); assert.deepEqual(y, { replies: 2, need_help: 1 });
  /* دفتر اليوم: مدرّب بلا شُعب → replies ضمن الدفتر والعدّادات */
  const db2 = fakeDb({ portal_word_replies: db.T.portal_word_replies, classrooms: [], portal_sessions: [], audit_logs: [] });
  const book = await collectDayBook(db2 as any, { id: 'u1', email: 'trainer@x.sa', staff: false, trainerIds: ['t1'], name: 'د. أحمد', viewing_other: false }, 'https://x', { now });
  assert.equal(book.replies.total, 3); assert.equal(book.counts.replies_yesterday, 2); assert.equal(book.counts.need_help_yesterday, 1); assert.equal(typeof book.counts.replies_unseen, 'number');
});

test('P53: التكامل — واجهة الإشعارات · واجهة الدفتر · «نادِ» · الخزنة · الهجرة · عقود الملفات', () => {
  const nt = read('app/api/notices/route.ts'); assert.match(nt, /action === 'word_reply'/); assert.match(nt, /can_reply: true, my_reply/); assert.match(nt, /rateLimit\(db, `wordreply:\$\{user\.id\}`, 3600, REPLIES_PER_HOUR\)/); assert.match(nt, /reply: \{ chips: CHIPS, max: REPLY_MAX \}/); assert.match(nt, /chip_ar: chipLabel\(r\.row\.chip\)/, 'استجابة الردّ تحمل chip_ar لتعرضه الواجهة فورًا');
  const dr = read('app/api/me/day/route.ts'); assert.match(dr, /action === 'seen_replies'/); assert.match(dr, /rateLimit\(db, `day:word:\$\{me\.id\}`, 3600, WORDS_PER_HOUR\)/, 'تصحيح ترتيب (نافذة، حدّ)');
  const ui = read('app/components/Notices.tsx'); for (const t of ['nt-reply', 'nt-chip', 'nt-reply-text', 'nt-reply-send', 'nt-reply-done', 'nt-reply-edit']) assert.ok(ui.includes(`data-testid="${t}"`), t); assert.match(ui, /لا يدخل في أي تقييم/);
  const dy = read('app/me/day/DayBook.tsx'); for (const t of ['dy-replies', 'dy-replies-room', 'dy-reply', 'dy-replies-seen']) assert.ok(dy.includes(`data-testid="${t}"`), t); assert.match(dy, /action: 'seen_replies'/); assert.match(dy, /id="replies"/);
  const d = DESTINATIONS.find((x) => x.href === '/me/day#replies'); assert.ok(d); const i = parseCommand('افتح ردود كلمتي', { admin: false }) as any; assert.equal(i.kind, 'go'); assert.equal(i.href, '/me/day#replies');
  assert.match(read('lib/vault/registry.ts'), /table: 'portal_word_replies'.*retentionDays: 180/); assert.match(read('supabase/migrations/20270208_portal_p53_word_replies.sql'), /portal_word_replies_one_per_word_uq unique \(notice_id, learner_email\)/);
  assert.match(read('tests/index.ts'), /import '\.\/p53-word-reply\.test'/);
});
