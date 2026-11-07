// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P60 «لأن… بصوتك» — النواة: حدود مطابقة لـ P54 · المسار لا يقبل غريبًا · قراءة آمنة للحقل · قائمة التشغيل · سطر اللقطة (عدد فقط) · الغراء: رفع/استبدال/حذف · الحذف مع الخيط والاستبعاد · الصوت لا يسافر (النسيج/التحقّق) · «نادِ» */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAP_VOICE_LIMITS, mapVoicePath, voiceOfRow, toPublic, validateMapVoice, voiceExt, countVoices, snapshotVoiceLine, playlistOf, playlistSeconds, VOICE_FOOT_AR } from '../lib/map/voice';
import { VOICE_LIMITS } from '../lib/portal/word-reply';
import { buildMap, snapshotBody } from '../lib/map/registry';
import type { MapInput, Decision } from '../lib/map/registry';
import { setThreadVoice, clearThreadVoice, voiceUrl, voiceUrls, declineThread, removeThread, keepThread, loadDecisions } from '../lib/map/store';
import { weave } from '../lib/map/weave';
import { parseCommand } from '../lib/portal/voice';

const SK = '11111111-1111-4111-8111-111111111111';
const D = (d: number) => new Date(Date.UTC(2026, 9, 1) + d * 86400000).toISOString();
const inp = (): MapInput => ({
  events: [{ at: D(0), verb: 'completed', object_type: 'program', object_id: 'p1', skills: [SK], context: { title: 'دبلوم' } }, { at: D(10), verb: 'attended', object_type: 'session', object_id: 's1', skills: [SK], context: { title: 'جلسة' } }],
  daily: [], missions: [], memberships: [], cases: [], levels: [{ skill_id: SK, approved_level: 2, approved_at: D(40), computed_level: 2 }], credentials: [], skills: { [SK]: 'تدريس العربية' }, hands: [],
} as unknown as MapInput);

test('p60: الحدود مطابقة لأمانة P54 · الامتداد · التحقّق', () => {
  assert.equal(MAP_VOICE_LIMITS.maxSeconds, VOICE_LIMITS.maxSeconds); assert.equal(MAP_VOICE_LIMITS.maxBytes, VOICE_LIMITS.maxBytes); assert.equal(MAP_VOICE_LIMITS.perHour, VOICE_LIMITS.perHour); assert.equal(MAP_VOICE_LIMITS.bucket, VOICE_LIMITS.bucket);
  assert.notEqual(MAP_VOICE_LIMITS.prefix, VOICE_LIMITS.prefix, 'بادئة مختلفة عن أمانات الكلمات');
  assert.equal(voiceExt('audio/webm;codecs=opus'), 'webm'); assert.equal(voiceExt('audio/mp4'), 'm4a'); assert.equal(voiceExt('audio/ogg'), 'ogg');
  assert.equal(validateMapVoice({ mime: 'audio/webm', bytes: 5000, sec: 9 }).ok, true);
  assert.equal(validateMapVoice({ mime: 'text/plain', bytes: 5000, sec: 9 }).ok, false);
  assert.equal(validateMapVoice({ mime: 'audio/webm', bytes: 100, sec: 9 }).ok, false, 'فارغ');
  assert.equal(validateMapVoice({ mime: 'audio/webm', bytes: 600 * 1024, sec: 9 }).ok, false, 'أكبر من 512 KB');
  assert.equal(validateMapVoice({ mime: 'audio/webm', bytes: 5000, sec: 17 }).ok, false, 'أطول من 15 ث');
  const v = validateMapVoice({ mime: 'audio/webm', bytes: 5000, sec: 16 }); assert.ok(v.ok && v.sec === 15, 'ثانية تسامح تُقصّ إلى 15');
});

test('p60: «لأن» في أول الكلمة لا تتكرّر (كتابةً أو إملاءً)', async () => {
  const { validateNote } = await import('../lib/map/registry');
  const a = validateNote('لأن هذا الخيط غيّرني'); assert.ok(a.ok && a.note === 'هذا الخيط غيّرني');
  const b = validateNote('لان: فتح لي بابًا'); assert.ok(b.ok && b.note === 'فتح لي بابًا');
  const c = validateNote('لأنني تغيّرت'); assert.ok(c.ok && c.note === 'لأنني تغيّرت', 'لأنني تبقى');
  const d = validateNote('لأن  هذا  الخيط'); assert.ok(d.ok && d.note === 'هذا الخيط');
});

test('p60: المسار مُنقّى · قراءة الحقل آمنة · العامّ بلا مسار', () => {
  assert.equal(mapVoicePath('u-1', 'row-9', 'webm'), 'map-voice/u-1/row-9.webm');
  assert.equal(mapVoicePath('../u', 'r/../x', 'we bm'), 'map-voice/u/rx.webm');
  assert.throws(() => mapVoicePath('', 'r', 'webm'));
  assert.equal(voiceOfRow({}), null); assert.equal(voiceOfRow(null), null); assert.equal(voiceOfRow({ path: 'word-voice/x/y.webm', sec: 5 }), null, 'بادئة غريبة تُرفض');
  const s = voiceOfRow({ path: 'map-voice/u/r.webm', sec: 7.4, bytes: 1000, mime: 'audio/webm', at: D(1) }); assert.ok(s && s.sec === 7);
  const p = toPublic(s); assert.deepEqual(Object.keys(p || {}).sort(), ['at', 'sec'], 'لا مسار في العامّ');
});

test('p60: قائمة التشغيل بترتيب الزمن · الخيوط بلا صوت تُقرأ نصًّا · المدّة التقريبية · سطر اللقطة', () => {
  const st = [{ key: 'a', title_ar: 'أ' }, { key: 'b', title_ar: 'ب' }, { key: 'c', title_ar: 'ج' }];
  const th = [
    { from: 'a', to: 'b', status: 'kept', note_ar: 'كلمتان هنا فقط', decided_at: D(5), voice: null },
    { from: 'b', to: 'c', status: 'kept', note_ar: 'بصوتي', decided_at: D(2), voice: { sec: 9, at: D(3) } },
    { from: 'a', to: 'c', status: 'proposed', note_ar: null, decided_at: null },
    { from: 'a', to: 'zzz', status: 'kept', note_ar: 'محطة غير موجودة', decided_at: D(1) },
  ];
  const pl = playlistOf(th, st); assert.equal(pl.length, 2); assert.equal(pl[0].key, 'b>c'); assert.equal(pl[0].voice, true); assert.equal(pl[1].voice, false); assert.equal(pl[1].title_ar, 'أ ⟵ ب');
  assert.equal(playlistSeconds(pl), 9 + 2);
  assert.equal(countVoices(th as any), 1);
  assert.equal(snapshotVoiceLine(0), null); assert.equal(snapshotVoiceLine(1), 'خيط واحد من خيوطك بصوتك'); assert.equal(snapshotVoiceLine(2), 'خيطان من خيوطك بصوتك'); assert.equal(snapshotVoiceLine(7), '7 من خيوطك بصوتك');
  assert.match(VOICE_FOOT_AR, /صوتك لك وحدك/);
});

test('p60: اللقطة تحمل العدد فقط — لا مسار ولا صوت في الجسد الموقَّع', () => {
  const dec: Decision[] = [{ from_key: 'program:p1', to_key: `skill:${SK}`, rule: 'program_skill', status: 'kept', note_ar: 'غيّرني', decided_at: D(41), voice: { sec: 8, at: D(41) } }];
  const m = buildMap(inp(), dec); assert.equal(m.threads.find((t) => t.status === 'kept')?.voice?.sec, 8);
  const b = snapshotBody(m, 2026); assert.ok(b.mirror_ar.includes('خيط واحد من خيوطك بصوتك'));
  const raw = JSON.stringify(b); assert.ok(!/map-voice|note_voice|"voice"/.test(raw), 'لا صوت في اللقطة');
  const m0 = buildMap(inp(), [{ ...dec[0], voice: null }]); assert.ok(!snapshotBody(m0, 2026).mirror_ar.some((l) => /بصوتك/.test(l)));
});

/* قاعدة وهمية صغيرة مع مخزن */
function fakeDb(email: string) {
  const T: Record<string, any[]> = { portal_map_threads: [], portal_learning_events: [{ at: D(0), verb: 'completed', object_type: 'program', object_id: 'p1', skills: [SK], context: { title: 'دبلوم' }, email, user_id: 'u1' }], portal_skill_levels: [{ skill_id: SK, approved_level: 2, approved_at: D(40), computed_level: 2, user_id: 'u1' }], skills: [{ id: SK, name_ar: 'تدريس العربية', name: 'Arabic' }], profiles: [{ id: 'u1', email }], audit_logs: [] };
  const files = new Map<string, number>(); const removed: string[] = [];
  const q = (table: string) => {
    const rows = () => (T[table] = T[table] || []); const f: ((r: any) => boolean)[] = []; let mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'; let payload: any = null; let single = false;
    const run = () => { const all = rows(); const hit = all.filter((r) => f.every((p) => p(r)));
      if (mode === 'insert') { const r = { id: `id-${all.length + 1}`, ...payload }; all.push(r); return { data: single ? r : [r], error: null }; }
      if (mode === 'upsert') { const i = all.findIndex((x) => x.email === payload.email && x.from_key === payload.from_key && x.to_key === payload.to_key); if (i >= 0) { all[i] = { ...all[i], ...payload }; return { data: [all[i]], error: null }; } const r = { id: `id-${all.length + 1}`, note_voice: {}, ...payload }; all.push(r); return { data: [r], error: null }; }
      if (mode === 'update') { for (const r of hit) Object.assign(r, payload); return { data: hit, error: null }; }
      if (mode === 'delete') { T[table] = all.filter((r) => !hit.includes(r)); return { data: null, error: null }; }
      return { data: single ? hit[0] || null : hit, error: null }; };
    const b: any = { select() { return b; }, eq(c: string, v: any) { f.push((r) => String(r[c]) === String(v)); return b; }, neq(c: string, v: any) { f.push((r) => r[c] !== v); return b; }, is(c: string, v: any) { f.push((r) => (r[c] ?? null) === v); return b; }, in(c: string, vs: any[]) { f.push((r) => vs.includes(r[c])); return b; }, gte() { return b; }, lt() { return b; }, lte() { return b; }, gt() { return b; }, or() { return b; }, not() { return b; }, order() { return b; }, limit() { return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, upsert(p: any) { mode = 'upsert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, delete() { mode = 'delete'; return b; }, then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); } };
    return b;
  };
  const storage = { from: (_b: string) => ({ upload: async (path: string, buf: Buffer) => { files.set(path, buf.length); return { error: null }; }, remove: async (paths: string[]) => { for (const p of paths) { files.delete(p); removed.push(p); } return { error: null }; }, createSignedUrl: async (path: string, sec: number) => ({ data: files.has(path) ? { signedUrl: `https://signed.test/${path}?exp=${sec}` } : null }) }) };
  return { T, files, removed, from: q, storage };
}

test('p60: الغراء — الصوت لخيط مُبقى فقط · ملف واحد يستبدل القديم · حذف فوري · يُحذف مع الاستبعاد والحذف · روابط لصاحبها', async () => {
  const email = 'noura@example.com'; const me = { id: 'u1', email }; const db: any = fakeDb(email); const buf = Buffer.alloc(4000, 1);
  const T = { from: 'program:p1', to: `skill:${SK}` };
  let r: any = await setThreadVoice(db, me, T, { buf, mime: 'audio/webm', bytes: 4000, sec: 8 }); assert.equal(r.ok, false); assert.equal(r.status, 404, 'لا صفّ بعد — أبقِه أولًا');
  assert.equal((await keepThread(db, me, { ...T, note: 'غيّرني فعلًا' })).ok, true);
  r = await setThreadVoice(db, me, T, { buf, mime: 'text/plain', bytes: 4000, sec: 8 }); assert.equal(r.status, 400);
  r = await setThreadVoice(db, me, T, { buf, mime: 'audio/webm', bytes: 4000, sec: 8 }); assert.equal(r.ok, true); assert.equal(r.replaced, false); assert.equal(r.voice.sec, 8);
  const row = db.T.portal_map_threads[0]; assert.equal(row.note_voice.path, `map-voice/u1/${row.id}.webm`); assert.equal(db.files.size, 1);
  let dec = await loadDecisions(db, me); assert.deepEqual(Object.keys(dec[0].voice || {}).sort(), ['at', 'sec'], 'القرار يحمل مدّة وتاريخًا فقط');
  r = await setThreadVoice(db, me, T, { buf, mime: 'audio/mp4', bytes: 3000, sec: 5 }); assert.equal(r.ok, true); assert.equal(r.replaced, true); assert.equal(db.files.size, 1, 'الجديد يستبدل القديم ويُحذف القديم'); assert.ok(db.removed.some((p: string) => p.endsWith('.webm')));
  const u = await voiceUrl(db, me, T); assert.ok(u.ok && /signed\.test\/map-voice\/u1\//.test(u.url) && u.sec === 5);
  const all = await voiceUrls(db, me); assert.equal(Object.keys(all).length, 1); assert.ok(all[`${T.from}>${T.to}`].url);
  assert.equal((await voiceUrl(db, { id: 'u2', email: 'x@example.com' }, T) as any).status, 404, 'غير صاحبه لا يحصل على رابط');
  r = await clearThreadVoice(db, me, T); assert.equal(r.ok, true); assert.equal(r.had, true); assert.equal(db.files.size, 0); assert.deepEqual(db.T.portal_map_threads[0].note_voice, {});
  r = await clearThreadVoice(db, me, T); assert.equal(r.had, false);
  /* الحذف مع الخيط */
  await setThreadVoice(db, me, T, { buf, mime: 'audio/webm', bytes: 4000, sec: 8 }); assert.equal(db.files.size, 1);
  assert.equal((await removeThread(db, me, T)).ok, true); assert.equal(db.files.size, 0, 'حذف الخيط يحذف صوته');
  /* الحذف مع الاستبعاد */
  await keepThread(db, me, { ...T, note: 'مرّة ثانية' }); await setThreadVoice(db, me, T, { buf, mime: 'audio/webm', bytes: 4000, sec: 8 }); assert.equal(db.files.size, 1);
  assert.equal((await declineThread(db, me, T)).ok, true); assert.equal(db.files.size, 0, 'الاستبعاد يحذف الصوت'); assert.deepEqual(db.T.portal_map_threads[0].note_voice, {});
  dec = await loadDecisions(db, me); assert.equal(dec[0].voice, null);
});

test('p60: الصوت لا يسافر — نسيج الشعبة لا يُخرج صوتًا ولا مسارًا', () => {
  const dec: Decision[] = [{ from_key: 'program:p1', to_key: `skill:${SK}`, rule: 'program_skill', status: 'kept', note_ar: 'غيّرني', decided_at: D(41), shared: true, voice: { sec: 8, at: D(41) } }];
  const maps = Array.from({ length: 6 }, (_, i) => ({ email: `l${i}@x.sa`, map: buildMap(inp(), dec) }));
  const w = weave(maps, maps.map((m) => ({ email: m.email, from_key: 'program:p1', to_key: `skill:${SK}`, rule: 'program_skill', note_ar: 'غيّرني' })), { now: new Date(D(60)), roster: 6 });
  const raw = JSON.stringify(w); assert.ok(w.quotes.length === 6); assert.ok(!/voice|map-voice|sec"/.test(raw), 'لا أثر للصوت في النسيج');
});

test('p60: «نادِ» — اسمع خريطتي → الخريطة بوضع التشغيل · الواجهة والمسار يحملان المبدأ', () => {
  const c = parseCommand('اسمع خريطتي') as any; assert.equal(c.kind, 'go'); assert.equal(c.href, '/me/athar-map?play=1');
  const desk = readFileSync('app/me/athar-map/AtharMapDesk.tsx', 'utf8'); for (const id of ['am-play-all', 'am-voice-rec', 'am-voice-clear', 'am-voice-hear', 'am-voice-foot', 'am-player']) assert.ok(desk.includes(id), id);
  assert.ok(desk.includes('play=1'), 'التشغيل التلقائي من «نادِ»');
  const route = readFileSync('app/api/me/map/voice/route.ts', 'utf8'); assert.ok(/mapvoice:\$\{user\.id\}/.test(route) && /multipart/.test(route) && route.includes('export async function DELETE'));
  const svg = readFileSync('app/components/AtharMapSvg.tsx', 'utf8'); assert.ok(svg.includes('am-active') && svg.includes('active?:'));
  assert.ok(!readFileSync('lib/map/voice.ts', 'utf8').includes("from '../portal/word-reply'"), 'ملف خفيف للمتصفّح');
});
