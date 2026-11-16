// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P71 «يوم دخلتُ» — سطر الدخول: الحدود · التحقّق (أي لغة · بلا بريد/هاتف) · الصوت ≤ 20 ث · «قالوا يوم دخلوا» k ≥ 5 · الحفظ/الربط/الحذف على قاعدة وهمية · البطاقات في P64/P70/P63 · الخزنة · الواجهة · شكل الكود */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENTRY_LIMITS, ENTRY_NAMES, ENTRY_COLS, validateEntryText, validateEntryVoice, entryPromptFor, entryEchoLine, entryView, voiceOfEntry } from '../lib/first/entry-pure';
import { saveEntry, entryOfEmail, deleteEntry, sectionEntry, entryVoicePath } from '../lib/first/entry';
import { buildCards as levelCards, CARD_KEYS as LV_KEYS, CARD_AR as LV_AR, publicFace as levelPublic, levelBody, normalizeKeep as lvKeep } from '../lib/level/registry';
import { buildCards as gradCards, CARD_KEYS as GD_KEYS, CARD_AR as GD_AR, PUBLIC_KEYS as GD_PUBLIC, programWindow } from '../lib/grad/registry';
import { REGISTRY } from '../lib/vault/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/* قاعدة وهمية صغيرة: from().select/eq/in/not/order/limit/maybeSingle/single + insert/update/delete + storage */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = { portal_entry_lines: [], placement_reports: [], ...seed }; const removed: string[] = []; const uploaded: string[] = [];
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let single = false; let lim = 0; let mode: 'select' | 'insert' | 'update' | 'delete' = 'select'; let payload: any = null;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => r[k] === v); return b; },
      not(k: string, op: string, v: any) { if (op === 'is') f.push((r) => r[k] !== v); return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, delete() { mode = 'delete'; return b; },
      then(res: any) {
        if (mode === 'insert') { const row = { id: 100 + rows.length, created_at: '2026-11-16T08:00:00Z', ...payload }; rows.push(row); return res({ data: row, error: null }); }
        const hit = rows.filter((r) => f.every((p) => p(r)));
        if (mode === 'update') { for (const r of hit) Object.assign(r, payload); return res({ data: single ? hit[0] || null : hit, error: null }); }
        if (mode === 'delete') { for (const r of hit) rows.splice(rows.indexOf(r), 1); return res({ data: null, error: null }); }
        return res({ data: single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit), error: null });
      } };
    return b; };
  const storage = { from: () => ({ upload: async (path: string) => { uploaded.push(path); return { error: null }; }, remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; }, createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` }, error: null }) }) };
  return { T, from: q, storage, removed, uploaded };
}
const sess = (over: any = {}) => ({ id: 'sess-1', candidate: { email: 'Lina@Example.com' }, user_id: null, invite_id: 'inv-9', status: 'completed', ...over });

test('P71 الحدود والأسماء والنصوص', () => {
  assert.equal(ENTRY_LIMITS.textMax, 200); assert.equal(ENTRY_LIMITS.textMin, 3); assert.equal(ENTRY_LIMITS.voiceSec, 20); assert.equal(ENTRY_LIMITS.k, 5); assert.equal(ENTRY_LIMITS.show, 3); assert.equal(ENTRY_LIMITS.bucket, 'athar-media'); assert.equal(ENTRY_LIMITS.prefix, 'entry-voice');
  assert.equal(ENTRY_NAMES.ar.narrative, 'يوم دخلتُ'); assert.match(ENTRY_NAMES.ar.official, /سطر الدخول — بكلمات المتعلّم يوم التسكين/); assert.match(ENTRY_NAMES.en.official, /Entry Line/); assert.equal(ENTRY_NAMES.ar.echo, 'قالوا يوم دخلوا');
  assert.match(ENTRY_COLS, /^id,email,session_id,report_id,user_id,invite_id,lang,body_text,voice,created_at,updated_at$/);
  const ar = entryPromptFor('ar'); const en = entryPromptFor('en');
  assert.match(ar.lead, /لماذا تتعلّم العربية/); assert.match(ar.lead, /لا يراه المصحّح/); assert.match(ar.title, /قبل أن تعرف نتيجتك/); assert.equal(ar.skip, 'أتجاوز الآن');
  assert.match(en.lead, /Why are you learning Arabic/); assert.match(en.lead, /rater never sees it/); assert.equal(en.skip, 'Skip for now');
  assert.match(entryVoicePath('s1', 'webm'), /^entry-voice\/s1\/[0-9a-f-]{36}\.webm$/);
});

test('P71 التحقّق من النصّ: أي لغة · تنظيف · بلا بريد أو هاتف', () => {
  assert.deepEqual(validateEntryText('  I want to read the Quran <b>myself</b>  '), { ok: true, text: 'I want to read the Quran myself' });
  assert.equal((validateEntryText('Saya ingin membaca Al-Quran.') as any).ok, true); assert.equal((validateEntryText('为了我在吉达的工作') as any).ok, true); assert.equal((validateEntryText('لأن أمي من مكة') as any).ok, true);
  assert.deepEqual(validateEntryText(''), { ok: false, error: 'empty' }); assert.deepEqual(validateEntryText('ok'), { ok: false, error: 'too_short' });
  assert.deepEqual(validateEntryText('write me at lina@mail.com'), { ok: false, error: 'no_contact' }); assert.deepEqual(validateEntryText('call +966 56 444 0406 please'), { ok: false, error: 'no_contact' });
  assert.equal((validateEntryText('x'.repeat(500)) as any).text.length, 200, 'يُقصّ إلى 200');
  assert.equal((validateEntryText('see https://example.com now') as any).text, 'see now', 'الروابط تُحذف');
});

test('P71 التحقّق من الصوت: ≤ 20 ث · ≤ 1 م.ب · صيغ معروفة', () => {
  assert.deepEqual(validateEntryVoice({ mime: 'audio/webm;codecs=opus', bytes: 24000, sec: 9 }), { ok: true, mime: 'audio/webm', ext: 'webm', sec: 9 });
  assert.equal((validateEntryVoice({ mime: 'audio/mp4', bytes: 24000, sec: 21 }) as any).ok, true, 'ثانية سماح واحدة'); assert.equal((validateEntryVoice({ mime: 'audio/mp4', bytes: 24000, sec: 21 }) as any).sec, 20);
  assert.deepEqual(validateEntryVoice({ mime: 'audio/mp4', bytes: 24000, sec: 22 }), { ok: false, error: 'too_long' });
  assert.deepEqual(validateEntryVoice({ mime: 'video/mp4', bytes: 24000, sec: 5 }), { ok: false, error: 'bad_voice' });
  assert.deepEqual(validateEntryVoice({ mime: 'audio/ogg', bytes: 100, sec: 5 }), { ok: false, error: 'empty' });
  assert.deepEqual(validateEntryVoice({ mime: 'audio/ogg', bytes: 2 * 1024 * 1024, sec: 5 }), { ok: false, error: 'too_big' });
  assert.equal(voiceOfEntry({}), null); assert.equal(voiceOfEntry(null), null); assert.equal(voiceOfEntry({ path: 'entry-voice/s/x.webm', sec: 3 })?.sec, 3);
});

test('P71 «قالوا يوم دخلوا»: k ≥ 5 · 3 سطور · كما كُتبت · بلا تكرار · ثابت بالبذرة', () => {
  const few = entryEchoLine(['a b c', 'd e f', 'g h i', 'j k l'], 12, 's'); assert.equal(few.shown, false); assert.equal(few.n, 4); assert.deepEqual(few.lines, []);
  const texts = ['I want to read the Quran', 'Pour mon travail', 'لأن أمي من مكة', 'Saya ingin membaca', 'To understand my patients', 'I want to read the Quran'];
  const e = entryEchoLine(texts, 12, 'c64:2026-11-16'); assert.equal(e.shown, true); assert.equal(e.n, 6); assert.equal(e.lines.length, 3); assert.match(e.head_ar!, /^6 من 12 — 6 سطور، بلغاتهم كما كتبوها/);
  assert.deepEqual(e.lines, entryEchoLine(texts, 12, 'c64:2026-11-16').lines, 'البذرة نفسها → الترتيب نفسه'); assert.equal(new Set(e.lines).size, 3);
  for (const l of e.lines) assert.ok(texts.includes(l), 'تُعرض كما كُتبت — لا ترجمة');
  assert.equal(entryEchoLine(['ok', 'no', 'x', 'y', 'z'], 5, 's').n, 0, 'القصيرة جدًا لا تُعدّ');
});

test('P71 الحفظ: نصّ ثم صوت · صفّ واحد لكل جلسة · ربط التقرير · البريد يُطبَّع', async () => {
  const db = fakeDb({ placement_reports: [{ id: 'rep-7', submission_id: 'sess-1', report: {} }] });
  const r1 = await saveEntry(db as any, sess(), { text: '  Because my grandmother speaks it. ', lang: 'en' }); assert.ok(r1.ok); if (!r1.ok) return;
  assert.equal(r1.entry.text, 'Because my grandmother speaks it.'); assert.equal(r1.entry.lang, 'en'); assert.equal(r1.entry.voice_sec, null); assert.equal(r1.entry.title_ar, 'قلتَ يوم دخلتَ');
  assert.equal(db.T.portal_entry_lines.length, 1); const row = db.T.portal_entry_lines[0]; assert.equal(row.email, 'lina@example.com'); assert.equal(row.report_id, 'rep-7'); assert.equal(row.invite_id, 'inv-9'); assert.equal(row.session_id, 'sess-1');
  assert.ok(!('report' in row) && !('score' in row), 'لا شيء من التقرير في الصفّ — ولا شيء من الصفّ في التقرير');
  const b64 = Buffer.alloc(3000, 1).toString('base64');
  const r2 = await saveEntry(db as any, sess(), { audio: `data:audio/webm;base64,${b64}`, mime: 'audio/webm;codecs=opus', sec: 12, lang: 'ar' }); assert.ok(r2.ok); if (!r2.ok) return;
  assert.equal(db.T.portal_entry_lines.length, 1, 'إعادة الحفظ تحدّث الصفّ نفسه'); assert.equal(r2.entry.voice_sec, 12); assert.equal(r2.entry.text, 'Because my grandmother speaks it.', 'الصوت الجديد يبقي النصّ السابق'); assert.equal(db.uploaded.length, 1); assert.match(db.uploaded[0], /^entry-voice\/sess-1\//);
  const r3 = await saveEntry(db as any, sess(), { text: 'Now with words too', lang: 'en' }); assert.ok(r3.ok); if (!r3.ok) return; assert.equal(r3.entry.voice_sec, 12, 'النصّ الجديد يبقي الصوت'); assert.equal(r3.entry.text, 'Now with words too');
  const bad = await saveEntry(db as any, sess(), {}); assert.deepEqual(bad, { ok: false, error: 'empty', status: 400 });
  const noMail = await saveEntry(db as any, sess({ candidate: { email: '' } }), { text: 'hello there' }); assert.equal((noMail as any).error, 'no_email');
  const contact = await saveEntry(db as any, sess(), { text: 'mail me x@y.com' }); assert.equal((contact as any).error, 'no_contact');
});

test('P71 الاسترجاع بالبريد والربط بالحساب والحذف الفوري (نصًّا وصوتًا)', async () => {
  const db = fakeDb({ portal_entry_lines: [{ id: 1, email: 'lina@example.com', session_id: 's', report_id: null, user_id: null, invite_id: null, lang: 'en', body_text: 'For my kids', voice: { path: 'entry-voice/s/a.webm', sec: 5, bytes: 900, mime: 'audio/webm', at: 'x' }, created_at: '2026-11-10T08:00:00Z', updated_at: '2026-11-10T08:00:00Z' }] });
  const r = await entryOfEmail(db as any, 'LINA@example.com', 'u-77'); assert.equal(r?.body_text, 'For my kids'); assert.equal(db.T.portal_entry_lines[0].user_id, 'u-77', 'يُربط بالحساب عند أول قراءة');
  assert.equal(await entryOfEmail(db as any, 'nobody@example.com'), null);
  const v = entryView(r!); assert.equal(v.voice_sec, 5); assert.equal(v.lang, 'en');
  const d = await deleteEntry(db as any, 'lina@example.com'); assert.deepEqual(d, { ok: true, had: true }); assert.equal(db.T.portal_entry_lines.length, 0); assert.deepEqual(db.removed, ['entry-voice/s/a.webm']);
  assert.deepEqual(await deleteEntry(db as any, 'lina@example.com'), { ok: true, had: false });
});

test('P71 صدى الشعبة: يقرأ بأبرِدة القيود فقط · k على الشعبة · بلا أسماء', async () => {
  const rows = ['a@x', 'b@x', 'c@x', 'd@x', 'e@x', 'f@x'].map((email, i) => ({ id: i, email, body_text: `reason number ${i}`, session_id: `s${i}` }));
  const db = fakeDb({ portal_entry_lines: rows.concat([{ id: 9, email: 'z@x', body_text: 'outsider', session_id: 's9' }]) });
  const e = await sectionEntry(db as any, ['A@x', 'b@x', 'c@x', 'd@x', 'e@x', 'f@x'], 10, 'seed'); assert.equal(e.shown, true); assert.equal(e.n, 6); assert.ok(!e.lines.includes('outsider')); assert.ok(!JSON.stringify(e).includes('@x'), 'لا بريد في الصدى');
  const small = await sectionEntry(db as any, ['a@x', 'b@x'], 2, 'seed'); assert.deepEqual(small, { shown: false, n: 0, head_ar: null, lines: [] });
});

test('P71 البطاقات: P70 entry_line (المستوى الأول · خاصّة لا عامة) · P63 entry أولًا · لا تدخل الوجه العام', () => {
  assert.ok(LV_KEYS.includes('entry_line')); assert.match(LV_AR.entry_line, /قلتُه يوم دخلتُ/);
  const src: any = { lines: [], prev_line: null, first_why: null, exam: null, training_days: 3, entry_line: { text: 'Pour la poésie', lang: 'en', voice_sec: null, at: '2026-10-01T08:00:00Z' } };
  const { cards } = levelCards(src, { from_day: '2026-10-01', to_day: '2026-10-30' }); assert.equal(cards[0].key, 'entry_line'); assert.equal(cards[0].text_ar, 'Pour la poésie');
  const voiceOnly = levelCards({ ...src, entry_line: { text: null, lang: 'ar', voice_sec: 8, at: 'x' } }, { from_day: '2026-10-01', to_day: '2026-10-30' }).cards[0]; assert.equal(voiceOnly.voice_sec, 8); assert.match(voiceOnly.state_ar!, /بصوتك/);
  assert.equal(levelCards({ ...src, entry_line: null }, { from_day: '2026-10-01', to_day: '2026-10-30' }).cards.length, 0);
  const body = levelBody({ code: 'ATH-LV-AAAA-BBBB', program: { id: 'p', name_ar: 'د', level_no: 1, from: '2026-10-01', to: '2026-10-30' } as any, name: 'ر', line_ar: 'سطر', cards, keep: lvKeep({}), counts: { learn: 0, apply: 0, commits: 0, done: 0, days: 3 } as any, sealed_at: 'x' });
  const face = levelPublic(body, ['line', 'counts', 'crossed', 'prev_line', 'commits', 'day_lines'] as any); assert.ok(!face.cards.some((c) => c.key === 'entry_line'), 'سطر الدخول لا يظهر على الوجه العام للمستوى');
  assert.equal(GD_KEYS[0], 'entry'); assert.match(GD_AR.entry, /أول كلمة/); assert.ok(!GD_PUBLIC.includes('entry' as any), 'ولا على الوجه العام للتخرّج');
  const w = programWindow('2026-01-01', '2026-11-01');
  const g = gradCards({ threads: [], replies: [], chapters: [], cohort_line: null, grad_letter: null, map_code: null, farewell: { text_ar: 'وداعًا', at: '2026-11-01T08:00:00Z', voice_sec: null, trainer_ar: null }, stations: [], cohort_opened: false, threads_after: 0, entry: { text: 'Because of my grandmother', lang: 'en', voice_sec: 6, at: '2025-12-20T08:00:00Z' } } as any, { id: 'p' }, w);
  assert.equal(g.cards[0].key, 'entry'); assert.equal(g.cards[1].key, 'farewell'); assert.equal(g.cards[0].href, '/me/first#fd-entry'); assert.match(g.cards[0].state_ar!, /اسمعه في «أول يوم»/);
});

test('P71 الخزنة والواجهة وشكل الكود', () => {
  const v = REGISTRY.find((r) => r.table === 'portal_entry_lines'); assert.ok(v); assert.equal(v!.policy, 'delete'); assert.deepEqual(v!.piiCols, ['body_text', 'voice']); assert.deepEqual(v!.access, ['self']); assert.match(v!.purpose_ar, /لا يراه المصحّح/);
  const api = read('app/api/miaar/route.ts'); assert.match(api, /action === 'entry'/); assert.match(api, /session\.status === 'active'\) return bad\('session_not_finished', 409\)/); assert.match(api, /miaar_entry:/);
  const app = read('app/miaar/MiaarApp.tsx'); assert.match(app, /'review' \| 'entry' \| 'result'/); assert.match(app, /setStep\('entry'\); \/\* P71/); assert.ok(!/resume[\s\S]{0,400}setStep\('entry'\)/.test(app), 'الاستئناف برمز النتيجة لا يمرّ بالشاشة'); assert.match(app, /dynamic\(\(\) => import\('\.\/EntryLine'\)/);
  const ui = read('app/miaar/EntryLine.tsx'); for (const id of ['mi-why', 'mi-why-ta', 'mi-why-save', 'mi-why-skip', 'mi-why-rec', 'mi-why-stop', 'mi-why-saved', 'mi-why-err']) assert.ok(ui.includes(`data-testid="${id}"`), id); assert.match(ui, /dir="auto"/);
  const fd = read('app/me/first/FirstDesk.tsx'); for (const id of ['fd-entry', 'fd-entry-text', 'fd-entry-del', 'fd-entry-copy']) assert.ok(fd.includes(`data-testid="${id}"`), id); assert.match(fd, /entry_voice=1/); assert.match(fd, /action: 'entry_delete'/);
  const dy = read('app/me/day/DayBook.tsx'); assert.match(dy, /data-testid="dy-entry"/); assert.match(dy, /data-testid="dy-entry-line"/); assert.match(dy, /قالوا يوم دخلوا/);
  const day = read('lib/portal/day.ts'); assert.match(day, /sectionEntry\(db, c\.roster_list\.map\(\(l\) => l\.email\)/);
  const first = read('app/api/me/first/route.ts'); assert.match(first, /entry_voice/); assert.match(first, /entry_delete/);
  const echo = read('lib/level/echo.ts'); assert.ok(!/portal_entry_lines/.test(echo), 'صدى المستوى لا يقرأ سطور الدخول');
  const sql = read('supabase/p71-entry-lines.sql'); assert.match(sql, /create table if not exists public\.portal_entry_lines/); assert.match(sql, /unique \(session_id\)/); assert.match(sql, /char_length\(body_text\) <= 200/); assert.match(sql, /rows = 0 · indexes = 4 · policies = 1 · columns = 11/);
  for (const f of ['lib/first/entry.ts', 'lib/first/entry-pure.ts', 'app/miaar/EntryLine.tsx', 'supabase/p71-entry-lines.sql']) assert.match(read(f), /© 2026 Dr\. Ahmed Mohamed Abdelaziz Badawi/);
  assert.ok(!/from '\.\.\/\.\.\/lib\/first\/entry'/.test(ui) && /lib\/first\/entry-pure/.test(ui), 'المكوّن العميل يستورد الجزء الصرف فقط');
});
