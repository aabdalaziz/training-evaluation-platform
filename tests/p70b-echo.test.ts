// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P70-ب «رجع الصدى» — النواة: النافذة (أول أسبوع من مستوى ≥ 2) · الموجز من كلمات المشاركين وحدها (k ≥ 5 · بلا أسماء · بلا أرقام مِعيار) · كلمة العبور (علامة echo على آلية P51) · صدى الصدى · ما يراه المشارك في «سطري» · شاهد الاعتماد 3.5 · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ECHO_LIMITS, ECHO_NAMES_AR, ECHO_PATH, echoPhase, buildInstructorEcho, echoWordTitleAr, echoDedupeKey, echoDedupePrefix, echoReachAr, instructorEcho, echoReach, learnerEchoWord, levelEvidence, levelEvidenceLineAr } from '../lib/level/echo';
import type { EchoInput } from '../lib/level/echo';
import { EVIDENCE_KIND_AR } from '../lib/accreditation/registry';
import { parseCommand } from '../lib/portal/voice';
import { parseWordNotice } from '../lib/portal/word-reply';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SPANS = [{ level_no: 1, from_day: '2026-09-01', to_day: '2026-10-01', courses: 2 }, { level_no: 2, from_day: '2026-10-04', to_day: '2026-11-12', courses: 2 }, { level_no: 3, from_day: '2026-11-15', to_day: '2026-12-24', courses: 2 }];

/* قاعدة وهمية صغيرة: select/eq/in/is/not/gte/lt/like/limit/maybeSingle */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = { portal_enrollments: [], portal_level_pages: [], portal_learning_lines: [], portal_learner_notices: [], portal_word_replies: [], ...seed };
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => r[k] === v); return b; },
      not(k: string, op: string, v: any) { if (op === 'is') f.push((r) => r[k] !== v); return b; }, gte(k: string, v: any) { f.push((r) => String(r[k]) >= String(v)); return b; }, lt(k: string, v: any) { f.push((r) => String(r[k]) < String(v)); return b; },
      like(k: string, v: string) { const p = v.replace(/%/g, ''); f.push((r) => String(r[k] || '').includes(p)); return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, order() { return b; },
      then(res: any) { const hit = rows.filter((r) => f.every((p) => p(r))); return res({ data: single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit), error: null }); } };
    return b; };
  return { T, from: q };
}
const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
const line = (user_id: string, day: string, body_ar: string, kind = 'learn', extra: any = {}) => ({ classroom_id: 'c1', user_id, day, body_ar, kind, blocker_ar: null, ...extra });
const seed = () => ({
  portal_enrollments: users.map((u) => ({ id: `e-${u}`, classroom_id: 'c1', status: 'active' })).concat([{ id: 'e-x', classroom_id: 'c1', status: 'rejected' }]),
  portal_level_pages: users.slice(0, 5).map((u, i) => ({ id: 9000 + i, classroom_id: 'c1', program_id: 'p1', level_no: 2, user_id: u, sealed_at: '2026-11-13T10:00:00Z', revoked_at: null, body: { cards: [{ key: 'crossed', text_ar: 'دخلتُ بـ A2 — وأعبره إلى B1' }] } }))
    .concat([{ id: 9009, classroom_id: 'c1', program_id: 'p1', level_no: 2, user_id: 'u6', sealed_at: '2026-11-13T10:00:00Z', revoked_at: '2026-11-14T10:00:00Z', body: { cards: [{ key: 'crossed', text_ar: 'ملغاة' }] } }, { id: 9010, classroom_id: 'c1', program_id: 'p1', level_no: 1, user_id: 'u1', sealed_at: '2026-10-02T10:00:00Z', revoked_at: null, body: { cards: [] } }]),
  portal_learning_lines: [
    ...users.map((u, i) => line(u, `2026-10-1${i}`, `تعلّمتُ أن أسأل قبل أن أشرح — ${i}`)),
    ...users.slice(0, 5).map((u, i) => line(u, `2026-10-2${i}`, `طبّقتُ السؤال الافتتاحي ${i}`, 'apply', { blocker_ar: 'ضيق الوقت في الحصة' })),
    line('u1', '2026-09-20', 'من المستوى الأول — خارج المدى'), line('u2', '2026-11-16', 'من المستوى الثالث — بعد المدى'),
    ...users.map((u, i) => line(u, '2026-11-01', `ألتزم ${i}`, 'commit', { done: i < 4 ? 'yes' : null })),
    line('u1', '2026-10-30', 'التزام ثانٍ', 'commit', { done: 'no' }),
  ],
});
const input = (o: Partial<EchoInput> = {}): EchoInput => ({ prev_level_no: 2, level_no: 3, roster: 14, sealed: 11, lines: users.map((u, i) => ({ user_id: u, body_ar: `سطر طويل بما يكفي رقم ${i}`, blocker_ar: i < 5 ? `ضيق الوقت دائمًا ${'جدًا '.repeat(i)}`.trim() : null, day: '2026-10-10' })), commits: { authors: 6, total: 13, done: 9 }, crossed: Array(9).fill('دخلتُ بـ A2 — وأعبره إلى B1').concat(['دخلتُ بـ A2 — وأبقى فيه']), seed: 'c1', phase: 'week', word: null, can_write: true, ...o });

test('P70-ب · الأسماء والحدود والمسار · مفاتيح كلمة العبور · «نادِ»', () => {
  assert.equal(ECHO_NAMES_AR.narrative, 'رجع الصدى'); assert.equal(ECHO_NAMES_AR.official, 'صدى المستوى للأستاذ — موجز الشعبة بلا أسماء'); assert.equal(ECHO_NAMES_AR.word, 'كلمة العبور'); assert.equal(ECHO_NAMES_AR.evidence, 'عبروا بكلماتهم');
  assert.equal(ECHO_LIMITS.k, 5); assert.equal(ECHO_LIMITS.weekDays, 7); assert.equal(ECHO_LIMITS.show, 3); assert.equal(ECHO_LIMITS.blockersShow, 2); assert.equal(ECHO_PATH, '/me/day#echo');
  assert.equal(echoWordTitleAr('سارة', 3), '🔁 كلمة العبور من أستاذك سارة — المستوى 3'); assert.equal(echoWordTitleAr(null, 2), '🔁 كلمة العبور من أستاذك — المستوى 2');
  assert.equal(echoDedupeKey('c1', 3, 't1', 'a@x.sa'), 'echo_word:c1:3:t1:a@x.sa'); assert.ok(echoDedupeKey('c1', 3, 't1', 'a@x.sa').startsWith(echoDedupePrefix('c1', 3))); assert.ok(!echoDedupeKey('c1', 3, 't1', 'a@x.sa').startsWith(echoDedupePrefix('c1', 2)));
  assert.deepEqual(parseWordNotice({ kind: 'trainer_word', dedupe_key: echoDedupeKey('c1', 3, 't1', 'a@x.sa'), ref_id: 'c1' }), { trainer_id: 't1', classroom_id: 'c1' }, 'كلمة العبور تُردّ كأي كلمة (P53)'); assert.equal(parseWordNotice({ kind: 'trainer_word', dedupe_key: 'grad_word:c1:a@x.sa' }), null);
  for (const say of ['افتح رجع الصدى', 'كلمة العبور', 'اكتب كلمة العبور', 'صدى المستوى']) { const c = parseCommand(say); assert.equal(c.kind, 'go', say); if (c.kind === 'go') assert.equal(c.href, '/me/day#echo', say); }
  const c = parseCommand('افتح دفتر اليوم'); assert.equal(c.kind, 'go'); if (c.kind === 'go') assert.equal(c.href, '/me/day', 'دفتر اليوم كما كان');
});

test('P70-ب · النافذة: لا صدى في المستوى الأول · أسبوع في أول 7 أيام من مستوى ≥ 2 · later بعده · none خارج المستوى', () => {
  assert.equal(echoPhase(SPANS, 1, '2026-09-02').phase, 'none', 'المستوى الأول لا مستوى قبله');
  const w = echoPhase(SPANS, 3, '2026-11-15'); assert.equal(w.phase, 'week'); assert.equal(w.prev?.level_no, 2); assert.equal(w.cur?.level_no, 3);
  assert.equal(echoPhase(SPANS, 3, '2026-11-21').phase, 'week'); assert.equal(echoPhase(SPANS, 3, '2026-11-22').phase, 'later'); assert.equal(echoPhase(SPANS, 3, '2026-12-24').phase, 'later');
  assert.equal(echoPhase(SPANS, 3, '2026-11-14').phase, 'none', 'قبل بدء المستوى'); assert.equal(echoPhase(SPANS, 3, '2026-12-25').phase, 'none', 'بعد نهايته'); assert.equal(echoPhase(SPANS, 9, '2026-11-15').phase, 'none', 'مستوى غير موجود');
  assert.equal(echoPhase([SPANS[1], SPANS[0], SPANS[2]], 2, '2026-10-05').prev?.level_no, 1, 'الترتيب لا يهمّ');
});

test('P70-ب · الموجز: أعداد وعبارات فقط · k ≥ 5 لكل مكوّن · لا أسماء · «عبروا» من كلمات المشاركين وبلا أرقام', () => {
  const e = buildInstructorEcho(input());
  assert.equal(e.title_ar, '🔁 رجع الصدى — المستوى 2'); assert.equal(e.shown, true); assert.equal(e.people, 6); assert.equal(e.roster, 14); assert.equal(e.silent_ar, null);
  assert.equal(e.sealed_ar, 'ختم صفحةَ مستواهم 11 من 14.'); assert.match(String(e.lines_ar), /^قالت الشعبة عبر المستوى 2 \(6 من 14 — 6 سطور\):$/); assert.equal(e.lines.length, 3, 'ثلاث عبارات');
  assert.equal(e.blockers.length, 2); assert.equal(e.blockers_ar, 'أكثر ما عاقهم في التطبيق (5):'); assert.equal(e.commits_ar, 'التزاماتهم: أوفوا بـ 9 من 13.');
  assert.equal(e.crossed_ar, 'كتب 10 منهم عن عبورهم بكلماتهم — أكثرها: «دخلتُ بـ A2 — وأعبره إلى B1».'); assert.equal(e.can_write, true); assert.equal(e.word, null);
  const all = JSON.stringify(e); for (const u of users) assert.ok(!all.includes(`"${u}"`), 'لا معرّفات'); assert.doesNotMatch(all, /%|درجة|score|rating|مقيّم/);
  /* تحت k: كل مكوّن يصمت وحده */
  const few = buildInstructorEcho(input({ sealed: 4, lines: input().lines.slice(0, 4), commits: { authors: 4, total: 4, done: 2 }, crossed: ['دخلتُ بـ A2 — وأعبره إلى B1'] }));
  assert.equal(few.shown, false); assert.match(few.sealed_ar, /^ختم صفحةَ مستواهم 4 منهم؛ يظهر الصدى حين يكتملون خمسة\.$/); assert.equal(few.lines_ar, null); assert.equal(few.lines.length, 0); assert.equal(few.commits_ar, null); assert.equal(few.crossed_ar, null); assert.match(String(few.silent_ar), /حين يكتمل خمسةٌ/);
  assert.equal(buildInstructorEcho(input({ sealed: 0 })).sealed_ar, 'لم يختم أحد صفحة مستواه بعد.');
  /* معوّقات دون k لا تظهر وإن ظهرت السطور */
  const b4 = buildInstructorEcho(input({ lines: input().lines.map((l, i) => ({ ...l, blocker_ar: i < 4 ? `ضيق الوقت دائمًا ${i}` : null })) })); assert.equal(b4.blockers_ar, null); assert.equal(b4.lines.length, 3);
  /* نصّ عبور فيه رقم لا يُعرض أبدًا (حارس) */
  const dig = buildInstructorEcho(input({ crossed: Array(9).fill('حصلتُ على 72%') })); assert.equal(dig.crossed_ar, null); assert.equal(buildInstructorEcho(input({ crossed: Array(9).fill('درجتي 58 من 100') })).crossed_ar, null);
  assert.match(String(buildInstructorEcho(input({ crossed: Array(9).fill('دخلتُ هذا المستوى بـ A2 — وأعبره اليوم إلى ما بعد B1.') })).crossed_ar), /A2 — وأعبره اليوم إلى ما بعد B1/, 'رموز المستويات تمرّ');
  /* بعد الأسبوع: لا كتابة */
  assert.equal(buildInstructorEcho(input({ phase: 'later' })).phase, 'later');
  /* صدى الصدى */
  const w = { text_ar: 'أهلًا بكم في المستوى الثالث', voice_sec: null, at: '2026-11-16T07:00:00Z', sent: 12, reach: { replies: 10, chips: { '🌱': 8, '✋': 2 } } };
  assert.equal(echoReachAr(w), 'وصلت كلمة العبور إلى 12 · ردّ 10 · 🌱 8 · ✋ 2'); assert.equal(echoReachAr({ ...w, reach: { replies: 0, chips: {} } }), 'وصلت كلمة العبور إلى 12');
});

test('P70-ب · الغراء: الموجز من قاعدة وهمية — سطور مدى المستوى السابق فقط · الصفحات المختومة غير الملغاة · التزامات · can_write لأستاذ المحاضرة في الأسبوع فقط', async () => {
  const db = fakeDb(seed());
  const e = await instructorEcho(db as any, { program_id: 'p1', classroom_id: 'c1', level_no: 3, trainer_name: 'سارة', can_write: true }, SPANS, '2026-11-16');
  assert.ok(e); if (!e) return;
  assert.equal(e.phase, 'week'); assert.equal(e.roster, 6, 'المرفوض لا يُحسب'); assert.equal(e.people, 6); assert.equal(e.sealed_ar, 'ختم صفحةَ مستواهم 5 من 6.');
  assert.match(String(e.lines_ar), /6 من 6 — 11 سطرًا/, 'learn 6 + apply 5 داخل المدى؛ سطرا خارج المدى مستبعدان'); assert.ok(!JSON.stringify(e.lines).includes('خارج المدى') && !JSON.stringify(e.lines).includes('بعد المدى'));
  assert.equal(e.blockers_ar, 'أكثر ما عاقهم في التطبيق (5):'); assert.deepEqual(e.blockers, ['ضيق الوقت في الحصة']);
  assert.equal(e.commits_ar, 'التزاماتهم: أوفوا بـ 4 من 7.'); assert.equal(e.crossed_ar, 'كتب 5 منهم عن عبورهم بكلماتهم — أكثرها: «دخلتُ بـ A2 — وأعبره إلى B1».', 'الملغاة لا تدخل');
  assert.equal(e.word, null); assert.equal(e.can_write, true);
  const later = await instructorEcho(db as any, { program_id: 'p1', classroom_id: 'c1', level_no: 3, can_write: true }, SPANS, '2026-11-25'); assert.equal(later?.phase, 'later'); assert.equal(later?.can_write, false, 'بعد الأسبوع لا كتابة');
  const staff = await instructorEcho(db as any, { program_id: 'p1', classroom_id: 'c1', level_no: 3, can_write: false }, SPANS, '2026-11-16'); assert.equal(staff?.can_write, false, 'المطّلع لا يكتب');
  assert.equal(await instructorEcho(db as any, { program_id: 'p1', classroom_id: 'c1', level_no: 1, can_write: true }, SPANS, '2026-09-02'), null);
  assert.equal(await instructorEcho(db as any, { program_id: 'p1', classroom_id: 'c1', level_no: 3, can_write: true }, [], '2026-11-16'), null, 'بلا مدى لا صدى');
});

test('P70-ب · كلمة العبور: صدى الصدى من الإشعارات والردود · المشارك يرى كلمته وحده · شاهد الاعتماد 3.5 عدد فقط', async () => {
  const db = fakeDb({ ...seed(), portal_learner_notices: [
    ...users.map((u, i) => ({ id: `n${i}`, email: `${u}@x.sa`, kind: 'trainer_word', title_ar: echoWordTitleAr('سارة', 3), body_ar: 'أهلًا بكم في المستوى الثالث', created_at: '2026-11-16T07:00:00Z', dedupe_key: echoDedupeKey('c1', 3, 't1', `${u}@x.sa`), meta: { echo: 3 } })),
    { id: 'n-old', email: 'u1@x.sa', kind: 'trainer_word', title_ar: 'كلمة', body_ar: 'كلمة عادية', created_at: '2026-11-16T08:00:00Z', dedupe_key: 'trainer_word:t1:u1@x.sa:2026-11-16', meta: {} },
    { id: 'n-l2', email: 'u1@x.sa', kind: 'trainer_word', title_ar: 'كلمة', body_ar: 'عبور المستوى الثاني', created_at: '2026-10-05T08:00:00Z', dedupe_key: echoDedupeKey('c1', 2, 't1', 'u1@x.sa'), meta: { echo: 2 } },
  ], portal_word_replies: [{ notice_id: 'n0', chip: 'got_it' }, { notice_id: 'n1', chip: 'got_it' }, { notice_id: 'n2', chip: 'need_help' }, { notice_id: 'n3', chip: null, text: 'سطر' }, { notice_id: 'n-old', chip: 'got_it' }] });
  const r = await echoReach(db as any, 'c1', 3); assert.ok(r); if (!r) return;
  assert.equal(r.sent, 6); assert.equal(r.text_ar, 'أهلًا بكم في المستوى الثالث'); assert.equal(r.voice_sec, null); assert.equal(r.reach.replies, 4); assert.deepEqual(r.reach.chips, { '🌱': 2, '✋': 1 }); assert.equal(echoReachAr(r), 'وصلت كلمة العبور إلى 6 · ردّ 4 · 🌱 2 · ✋ 1');
  assert.equal(await echoReach(db as any, 'c1', 4), null); assert.equal(await echoReach(db as any, 'c2', 3), null);
  const e = await instructorEcho(db as any, { program_id: 'p1', classroom_id: 'c1', level_no: 3, can_write: true }, SPANS, '2026-11-25'); assert.equal(e?.word?.sent, 6, 'بعد الأسبوع يبقى الوصول');
  const w = await learnerEchoWord(db as any, 'U1@x.sa', 'c1', 3); assert.ok(w); if (!w) return; assert.equal(w.notice_id, 'n0'); assert.equal(w.text_ar, 'أهلًا بكم في المستوى الثالث'); assert.equal(w.level_no, 3); assert.match(w.title_ar, /كلمة العبور من أستاذك سارة/);
  assert.equal(await learnerEchoWord(db as any, 'u9@x.sa', 'c1', 3), null, 'ليست له'); assert.equal((await learnerEchoWord(db as any, 'u1@x.sa', 'c1', 2))?.text_ar, 'عبور المستوى الثاني');
  /* الاعتماد */
  assert.equal(levelEvidenceLineAr(4, 1), null); assert.equal(levelEvidenceLineAr(5, 1), 'عبروا بكلماتهم: صفحات المستوى التي ختمها المشاركون بأيديهم 5 (عبر مستوى واحد) — عدد فقط، بلا محتوى.'); assert.match(String(levelEvidenceLineAr(23, 2)), /23 \(عبر مستويين\)/); assert.match(String(levelEvidenceLineAr(40, 3)), /\(عبر 3 مستويات\)/);
  const ev = await levelEvidence(db as any, 'p1'); assert.equal(ev.length, 1); assert.deepEqual({ id: ev[0].id, kind: ev[0].kind, codes: ev[0].codes, n: ev[0].n, href: ev[0].href }, { id: 'level:pages', kind: 'level', codes: ['3.5'], n: 6, href: null }); assert.match(ev[0].label_ar, /6 \(عبر مستويين\)/);
  assert.deepEqual(await levelEvidence(db as any, 'p-none'), []); assert.equal(EVIDENCE_KIND_AR.level, 'صفحات المستوى — بكلمات المشاركين أنفسهم (P70)');
});

test('P70-ب · شكل المصدر: echo.ts لا يقرأ مِعيار ولا الدرجات · الممرّ يحمل الصدى · كلمة العبور علامة على sendWord · الواجهتان · لا SQL جديد', () => {
  const echo = read('lib/level/echo.ts');
  assert.doesNotMatch(echo, /miaar_|placement_reports|score|rating|band|cut/i, 'الأستاذ يرى ما كتبه المشاركون فقط'); assert.doesNotMatch(echo, /insert\(|upsert\(|update\(|delete\(/, 'لا يُخزَّن الموجز'); assert.doesNotMatch(echo, /openai|anthropic|gemini|fetch\(/i);
  assert.match(echo, /from\('portal_level_pages'\)/); assert.match(echo, /from\('portal_learning_lines'\)/); assert.match(echo, /like\('dedupe_key'/);
  const dip = read('lib/diploma/store.ts'); assert.match(dip, /instructorEcho\(db, \{ program_id/); assert.match(dip, /can_write: isOwn/);
  const day = read('lib/portal/day.ts'); assert.match(day, /echo\?: number \| null/); assert.match(day, /echoWordTitleAr\(me\.name, Number\(input\.echo\)\)/); assert.match(day, /echoDedupeKey\(room\.id, Number\(input\.echo\), tid, l\.email\)/); assert.match(day, /url: input\.echo \? '\/me\/line'/);
  const api = read('app/api/me/day/route.ts'); assert.match(api, /echo: mode === 'all' && Number\.isInteger\(Number\(b\.echo\)\) && Number\(b\.echo\) >= 2/);
  const lv = read('app/api/me/level/route.ts'); assert.match(lv, /learnerEchoView/); assert.match(lv, /word: v\.word, open: v\.open/);
  const ui = read('app/me/day/DayBook.tsx'); for (const t of ['dy-lvecho', 'dy-lvecho-sealed', 'dy-lvecho-lines', 'dy-lvecho-blockers', 'dy-lvecho-commits', 'dy-lvecho-crossed', 'dy-lvecho-reach', 'dy-lvecho-word', 'dy-lvecho-on', 'dy-lvecho-silent']) assert.ok(ui.includes(`data-testid="${t}"`) || ui.includes(`data-testid={\`${t}`), t);
  assert.match(ui, /id="echo"/); assert.match(ui, /\{ echo: echoLevel \}/); assert.match(ui, /بلا أسماء، بلا درجات، لا يُخزَّن هذا الموجز/);
  const ln = read('app/me/line/LineDesk.tsx'); for (const t of ['ln-echo-word', 'ln-echo-replied', 'ln-level-open']) assert.ok(ln.includes(`data-testid="${t}"`), t); assert.match(ln, /ln-echo-chip-\$\{k\}/); assert.match(ln, /action: 'word_reply'/);
  const acc = read('lib/accreditation/load.ts'); assert.match(acc, /levelEvidence\(db, pid\)/);
  const store = read('lib/level/store.ts'); assert.match(store, /export async function learnerEchoView/); assert.match(store, /learnerEchoWord\(db, me\.email, cur\.classroom_id, cur\.level_no \+ 1\)/);
});
