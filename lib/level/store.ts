// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P70 «بكلماتي عبر المستوى» — طبقة القاعدة (جدول واحد جديد: portal_level_pages)
 *  myLevels (مستوياتي التي فُتحت صفحتها: من قيود التسجيل + مدى المستوى في جدول الشُّعب — لا من الدرجات) · loadSources (كلمات صاحبها فقط:
 *  سطور P66/P66-ب · «لماذا جئتُ» P64 · كلمته من المستوى السابق · نصّه وصوته في «عُبور» م6) · loadLevelPage · saveLine · setKeep · setPublic
 *  sealLevel (رمز ATH-LV + بصمة SHA-256 على JCS؛ الختم الجديد يُبطل السابق ويُسجَّل في history) · revokeLevel (فوري ومعلَن) · deleteLevel (فوري)
 *  verifyLevel (/verify/level و /lv/<code>) · sectionSealed (k ≥ 5) · levelEcho («الكلمة التي تعبر» — أول أسبوع في المستوى التالي) · sealedLevelLines (لصفحة التخرّج P63)
 *  لا كرون جديد: النافذة تُحسب من تقويم الشعبة عند الطلب. إشعار «محطّة المستوى» القائم صار يفتح هذه الصفحة.
 */
import { createHash, randomBytes } from 'crypto';
import { userFlag, POLICY_BLOCK_AR } from '../org/policy';
import { MAP_VOICE_LIMITS, validateMapVoice } from '../map/voice';
import type { MapVoiceStored } from '../map/voice';
import { jcs } from '../portal/vc';
import { letterState, fmtDayAr as fmtIsoAr, dayKeyRiyadh } from '../letters/self';
import { programLevelSpans } from '../diploma/store';
import { MEDIA_BUCKET } from '../miaar/bank';
import { learnerEchoWord } from './echo'; /* P70-ب: كلمة العبور من الأستاذ — تظهر في «سطري» تحت «الكلمة التي تعبر» */
import { levelWindow, levelPhase, isEchoWeek, buildCards, levelBody, publicFace, validateLine, normalizeKeep, normalizePublic, sectionLineAr, echoIntroAr, CODE_RE, LEVEL_LIMITS, LEVEL_PATH, LEVEL_PUBLIC_PREFIX, PUBLIC_DEFAULT, addDaysKey } from './registry';
import type { Card, Counts, Sources, CardKey, PublicKey, LevelBody, LevelPhase, LevelWindow, PublicFace, ExamSource, LineSrc, Done } from './registry';

type Db = any;
export type Me = { id: string; email: string; name?: string };
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const ENROLLED = ['approved', 'placed', 'active', 'completed'];
export const LEVEL_COLS = 'id,user_id,email,program_id,enrollment_id,classroom_id,level_no,line_ar,line_voice,keep,public_keys,live_public,body,code,digest,history,sealed_at,revoked_at,created_at,updated_at';
export const levelCode = (): string => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(8); const s = Array.from(b).map((x) => A[x % A.length]).join(''); return `ATH-LV-${s.slice(0, 4)}-${s.slice(4, 8)}`; };
export const digestOf = (doc: unknown): string => createHash('sha256').update(jcs(doc)).digest('hex');
const SIGN_SECONDS = 5 * 60;
const SKILL_AR: Record<string, string> = { listening: 'الاستماع', reading: 'القراءة', grammar_vocab: 'المفردات والتراكيب', writing: 'الكتابة', speaking: 'التحدّث' };

export type LevelItem = { key: string; program_id: string; name_ar: string; enrollment_id: string; classroom_id: string; section_ar: string | null; level_no: number; levels: number; window: LevelWindow; phase: LevelPhase; next_from: string | null; sealed: boolean; is_first: boolean };
export type LevelRow = { id: number; user_id: string; email: string; program_id: string; enrollment_id: string; classroom_id: string | null; level_no: number; line_ar: string | null; line_voice: MapVoiceStored | Record<string, never> | null; keep: Record<string, boolean> | null; public_keys: string[] | null; live_public: boolean; body: LevelBody | null; code: string | null; digest: string | null; history: { code: string; sealed_at: string; digest: string; revoked_at: string }[] | null; sealed_at: string | null; revoked_at: string | null; created_at: string; updated_at: string };
export type LevelView = {
  level: Omit<LevelItem, 'sealed'>; today: string; cards: Card[]; counts: Counts; keep: Record<CardKey, boolean>; line_ar: string | null; voice: { sec: number; at: string } | null; public_keys: PublicKey[]; live_public: boolean;
  seal: { code: string; sealed_at: string; digest: string; revoked_at: string | null; public_path: string; verify_path: string; previous: number; stale: boolean } | null;
  section_ar: string | null; exam_voice: boolean;
};
const itemKey = (enrollmentId: string, levelNo: number) => `${enrollmentId}:${levelNo}`;

/** مستوياتي التي فُتحت صفحتها (اليوم ≥ أول يوم من الأسبوع الأخير) — من قيود التسجيل ومدى المستوى في جدول الشُّعب */
export async function myLevels(db: Db, me: Me, now = new Date()): Promise<LevelItem[]> {
  const today = dayKeyRiyadh(now);
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,status,classroom_id,created_at').eq('email', lower(me.email)).in('status', ENROLLED).not('classroom_id', 'is', null).limit(50), []);
  const pids = [...new Set(en.map((e) => String(e.program_id || '')).filter(Boolean))].slice(0, 20); if (!pids.length) return [];
  const mine = await safe<any[]>(db.from('portal_level_pages').select('enrollment_id,level_no,sealed_at,revoked_at').eq('user_id', me.id).limit(100), []);
  const sealed = new Set(mine.filter((r) => r.sealed_at && !r.revoked_at).map((r) => itemKey(String(r.enrollment_id), Number(r.level_no))));
  const out: LevelItem[] = [];
  for (const pid of pids) {
    const P = await programLevelSpans(db, pid).catch(() => null); if (!P || !P.spans.length) continue;
    const e = en.filter((x) => String(x.program_id) === pid).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]; if (!e) continue;
    const spans = P.spans.filter((s) => s.from_day && s.to_day); const first = spans[0]?.level_no;
    for (let i = 0; i < spans.length; i++) { const s = spans[i]; const w = levelWindow(s.from_day, s.to_day); const phase = levelPhase(w, today); if (phase === 'before') continue;
      out.push({ key: itemKey(String(e.id), s.level_no), program_id: pid, name_ar: P.name_ar || 'برنامج', enrollment_id: String(e.id), classroom_id: String(e.classroom_id), section_ar: P.sectionLabel(String(e.classroom_id)), level_no: s.level_no, levels: spans.length, window: w, phase, next_from: spans[i + 1]?.from_day || null, sealed: sealed.has(itemKey(String(e.id), s.level_no)), is_first: s.level_no === first }); }
  }
  return out.sort((a, b) => b.window.to_day.localeCompare(a.window.to_day));
}
async function rowOf(db: Db, me: Me, it: Pick<LevelItem, 'enrollment_id' | 'level_no'>): Promise<LevelRow | null> { const { data } = await db.from('portal_level_pages').select(LEVEL_COLS).eq('user_id', me.id).eq('enrollment_id', it.enrollment_id).eq('level_no', it.level_no).maybeSingle(); return (data as LevelRow) || null; }

/* ───────── المصادر — كلمات صاحبها فقط ───────── */
const toLine = (r: any): LineSrc => ({ kind: r.kind, day: String(r.day), body_ar: String(r.body_ar || ''), blocker_ar: r.blocker_ar || null, done: (r.done === 'yes' || r.done === 'part' || r.done === 'no' ? r.done : null) as Done | null, done_note_ar: r.meta && (r.meta as any).note_ar ? String((r.meta as any).note_ar) : null, unit_id: r.unit_id ? String(r.unit_id) : null, week_no: r.week_no ? Number(r.week_no) : null });
export async function loadSources(db: Db, me: Me, it: Pick<LevelItem, 'program_id' | 'enrollment_id' | 'classroom_id' | 'level_no' | 'window' | 'is_first'>, now = new Date()): Promise<Sources> {
  const email = lower(me.email); const w = it.window; const examTo = addDaysKey(w.to_day, LEVEL_LIMITS.openAfterDays);
  const [lines, prev, caps, cal, reports] = await Promise.all([
    safe<any[]>(db.from('portal_learning_lines').select('kind,day,body_ar,blocker_ar,done,meta,unit_id,week_no').eq('user_id', me.id).eq('classroom_id', it.classroom_id).gte('day', w.from_day).lte('day', w.to_day).order('day').limit(400), []),
    it.level_no > 1 ? safe<any>(db.from('portal_level_pages').select('line_ar,level_no,sealed_at,revoked_at').eq('user_id', me.id).eq('enrollment_id', it.enrollment_id).eq('level_no', it.level_no - 1).maybeSingle(), null) : Promise.resolve(null),
    it.is_first ? safe<any[]>(db.from('portal_time_capsules').select('id,body_ar,created_at,deliver_at,opened_at,status,context_key,scope').eq('user_id', me.id).eq('program_id', it.program_id).eq('context_key', 'first_day').neq('status', 'cancelled').limit(1), []) : Promise.resolve([] as any[]),
    safe<any>(db.from('portal_room_calendars').select('days').eq('classroom_id', it.classroom_id).maybeSingle(), null),
    safe<any[]>(db.from('placement_reports').select('id,submission_id,created_at,report').ilike('candidate_email', email).is('archived_at', null).gte('created_at', `${w.from_day}T00:00:00Z`).lte('created_at', `${examTo}T23:59:59Z`).order('created_at', { ascending: false }).limit(10), []),
  ]);
  const firstWhy = caps[0] || null;
  const days = arr<string>(cal?.days).filter((d) => d >= w.from_day && d <= w.to_day).length;
  /* «عُبور»: آخر تقرير نهاية مستوى داخل النافذة (+ أسبوع) — نقرأ النصّ والصوت لا الدرجة */
  let exam: ExamSource | null = null;
  const rep = reports.find((r) => r.report && (r.report as any).exit && !(r.report as any).exit_retake) || null;
  if (rep) {
    const ex = (rep.report as any).exit || {}; const perfs = rep.submission_id ? await safe<any[]>(db.from('miaar_performances').select('skill,text_answer,word_count,duration_sec,media_path,media_purged_at,transcript,transcript_source,created_at').eq('session_id', String(rep.submission_id)).limit(4), []) : [];
    const wr = perfs.find((p) => p.skill === 'writing') || null; const sp = perfs.find((p) => p.skill === 'speaking') || null;
    exam = {
      level: String(ex.المستوى || ''), outcome: String(ex.النتيجة || 'pending'), retake_skill_ar: ex.مهارة_الإعادة ? SKILL_AR[String(ex.مهارة_الإعادة)] || String(ex.مهارة_الإعادة) : null, from_level: ex.خط_العبور?.from_level ? String(ex.خط_العبور.from_level) : null, at: String(rep.created_at),
      writing: wr && wr.text_answer ? { text: String(wr.text_answer), words: wr.word_count ? Number(wr.word_count) : null, at: String(wr.created_at) } : null,
      speaking: sp ? { sec: sp.duration_sec ? Number(sp.duration_sec) : null, has_media: !!sp.media_path && !sp.media_purged_at, purged: !!sp.media_purged_at, transcript: sp.transcript && sp.transcript_source === 'human' ? String(sp.transcript) : null, at: String(sp.created_at) } : null,
    };
  }
  return {
    lines: lines.map(toLine).filter((l) => l.kind === 'learn' || l.kind === 'apply' || l.kind === 'commit'),
    prev_line: prev && prev.line_ar && prev.sealed_at && !prev.revoked_at ? { line_ar: String(prev.line_ar), level_no: Number(prev.level_no), sealed_at: String(prev.sealed_at) } : null,
    first_why: firstWhy ? { id: Number(firstWhy.id), body_ar: firstWhy.opened_at ? String(firstWhy.body_ar || '') : null, at: String(firstWhy.created_at), state: letterState(firstWhy, now).state, opens_ar: fmtIsoAr(firstWhy.deliver_at) } : null,
    exam, training_days: days,
  };
}

export async function loadLevelPage(db: Db, me: Me, key: string | null, now = new Date()): Promise<{ levels: LevelItem[]; view: LevelView | null; section_line_ar: string | null }> {
  const levels = await myLevels(db, me, now); if (!levels.length) return { levels, view: null, section_line_ar: null };
  const it = levels.find((x) => x.key === key) || levels.find((x) => x.phase === 'open') || levels[0];
  const [src, row, n] = await Promise.all([loadSources(db, me, it, now), rowOf(db, me, it), sectionSealed(db, it.classroom_id, it.level_no)]);
  const { cards, counts } = buildCards(src, it.window);
  const keep = normalizeKeep(row?.keep); const line = row?.line_ar || null; const sealedBody = row?.sealed_at && !row.revoked_at && row.body ? row.body : null;
  const stale = !!sealedBody && (sealedBody.line_ar !== (line || '') || JSON.stringify(sealedBody.cards.map((c) => c.key)) !== JSON.stringify(cards.filter((c) => keep[c.key] !== false).map((c) => c.key)));
  const { sealed, ...level } = it; void sealed;
  return { levels, section_line_ar: sectionLineAr(n), view: {
    level, today: dayKeyRiyadh(now), cards, counts, keep, line_ar: line, voice: (() => { const v = voiceOfRow(row?.line_voice); return v ? { sec: v.sec, at: v.at } : null; })(), public_keys: normalizePublic(row?.public_keys ?? PUBLIC_DEFAULT), live_public: !!row?.live_public,
    seal: row?.code && row.sealed_at && row.body ? { code: row.code, sealed_at: row.sealed_at, digest: String(row.digest || ''), revoked_at: row.revoked_at || null, public_path: `${LEVEL_PUBLIC_PREFIX}/${row.code}`, verify_path: `/verify/level?code=${row.code}`, previous: arr(row.history).length, stale } : null,
    section_ar: it.section_ar, exam_voice: !!src.exam?.speaking?.has_media,
  } };
}

async function ensureRow(db: Db, me: Me, it: LevelItem, now: Date): Promise<LevelRow | Fail> {
  const ex = await rowOf(db, me, it); if (ex) return ex;
  const row = { user_id: me.id, email: lower(me.email), program_id: it.program_id, enrollment_id: it.enrollment_id, classroom_id: it.classroom_id, level_no: it.level_no, keep: {}, public_keys: PUBLIC_DEFAULT, live_public: false, history: [], created_at: now.toISOString(), updated_at: now.toISOString() };
  const { data, error } = await db.from('portal_level_pages').insert(row).select(LEVEL_COLS).single(); if (error || !data) return fail('تعذّر فتح صفحتك', 500); return data as LevelRow;
}
async function myLevel(db: Db, me: Me, key: string, now: Date): Promise<LevelItem | Fail> { const it = (await myLevels(db, me, now)).find((x) => x.key === key); return it || fail('هذا المستوى ليس من مستوياتك المفتوحة', 404); }
/** «سطر المستوى» (≤ 200) — الصوت له مسار مستقلّ ولا يدخل الجسم المختوم ولا الوجه العام */
export async function saveLine(db: Db, me: Me, key: string, b: { line_ar?: string }, now = new Date()): Promise<{ ok: true; line_ar: string } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const v = validateLine(b.line_ar); if (!v.ok) return fail(v.error);
  const row = await ensureRow(db, me, it, now); if ('ok' in row) return row;
  const { error } = await db.from('portal_level_pages').update({ line_ar: v.text, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر حفظ السطر', 500);
  return { ok: true, line_ar: v.text };
}
const VOICE_PREFIX = 'level-voice';
export const LEVEL_VOICE_MAX_BYTES = 1024 * 1024;
/** صوت سطر المستوى: الصيغ نفسها (map/voice) · ≤ 30 ث · ≤ 1 م.ب — يبقى مع صاحبه */
export function validateLevelVoice(input: { mime: string; bytes: number; sec: number }): { ok: true; mime: string; ext: string; sec: number } | { ok: false; error: string } {
  const sec = Math.round(Number(input.sec) || 0); if (sec < 1) return { ok: false, error: 'التسجيل أقصر من ثانية' }; if (sec > LEVEL_LIMITS.voiceSec + 1) return { ok: false, error: `سطر المستوى بصوتك ${LEVEL_LIMITS.voiceSec} ثانية كحدّ أقصى` };
  const bytes = Number(input.bytes) || 0; if (bytes > LEVEL_VOICE_MAX_BYTES) return { ok: false, error: 'التسجيل أكبر من 1 م.ب' };
  const base = validateMapVoice({ mime: input.mime, bytes: Math.min(bytes, MAP_VOICE_LIMITS.maxBytes), sec: Math.min(sec, MAP_VOICE_LIMITS.maxSeconds) }); if (!base.ok) return base;
  return { ok: true, mime: base.mime, ext: base.ext, sec: Math.min(sec, LEVEL_LIMITS.voiceSec) };
}
export function voiceOfRow(v: unknown): MapVoiceStored | null { if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>; const path = typeof o.path === 'string' ? o.path : ''; const sec = Number(o.sec || 0); if (!path.startsWith(`${VOICE_PREFIX}/`) || !(sec > 0)) return null; return { path, sec, bytes: Number(o.bytes || 0), mime: String(o.mime || ''), at: String(o.at || '') }; }
export const levelVoicePath = (userId: string, rowId: number | string, ext: string) => `${VOICE_PREFIX}/${userId}/${rowId}.${ext}`;
const removeVoiceFile = async (db: Db, path: string) => { try { await db.storage.from(MAP_VOICE_LIMITS.bucket).remove([path]); } catch { /* يتيم نادر */ } };
/** 🎙️ سطر المستوى بصوت صاحبه (≤ 40 ث · ملف واحد) — يبقى معه: لا وجه عام، لا تحقّق */
export async function setLineVoice(db: Db, me: Me, key: string, file: { buf: Buffer; mime: string; bytes: number; sec: number }, now = new Date()): Promise<{ ok: true; voice: { sec: number; at: string }; replaced: boolean } | Fail> {
  if (await userFlag(db, me.id, 'voice_off', me.email)) return fail(POLICY_BLOCK_AR.voice_off, 403); /* P67 */
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await ensureRow(db, me, it, now); if ('ok' in row) return row;
  const v = validateLevelVoice({ mime: file.mime, bytes: file.bytes, sec: file.sec }); if (!v.ok) return fail(v.error);
  const prev = voiceOfRow(row.line_voice); const path = levelVoicePath(me.id, row.id, v.ext); const at = now.toISOString();
  const { error: upErr } = await db.storage.from(MAP_VOICE_LIMITS.bucket).upload(path, file.buf, { contentType: v.mime, upsert: true }); if (upErr) return fail(`تعذّر رفع التسجيل: ${upErr.message}`, 500);
  const stored: MapVoiceStored = { path, sec: v.sec, bytes: file.bytes, mime: v.mime, at };
  const { error } = await db.from('portal_level_pages').update({ line_voice: stored, updated_at: at }).eq('id', row.id); if (error) { await removeVoiceFile(db, path); return fail('تعذّر حفظ الصوت', 500); }
  if (prev?.path && prev.path !== path) await removeVoiceFile(db, prev.path);
  return { ok: true, voice: { sec: v.sec, at }, replaced: !!prev };
}
export async function clearLineVoice(db: Db, me: Me, key: string, now = new Date()): Promise<{ ok: true; had: boolean } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await rowOf(db, me, it); const prev = voiceOfRow(row?.line_voice); if (!row || !prev) return { ok: true, had: false };
  const { error } = await db.from('portal_level_pages').update({ line_voice: {} }).eq('id', row.id); if (error) return fail('تعذّر الحذف', 500); await removeVoiceFile(db, prev.path); return { ok: true, had: true };
}
export async function lineVoiceUrl(db: Db, me: Me, key: string, now = new Date()): Promise<{ ok: true; url: string; sec: number } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await rowOf(db, me, it); const v = voiceOfRow(row?.line_voice); if (!row || !v) return fail('لا صوت على سطرك', 404);
  try { const { data } = await db.storage.from(MAP_VOICE_LIMITS.bucket).createSignedUrl(v.path, MAP_VOICE_LIMITS.signedSeconds); if (!data?.signedUrl) return fail('تعذّر إنشاء الرابط', 500); return { ok: true, url: data.signedUrl, sec: v.sec }; } catch { return fail('تعذّر إنشاء الرابط', 500); }
}
/** 🔊 ما قلتُه في «عُبور» — رابط موقَّع 5 دقائق لصاحب التسجيل وحده (لا تنزيل، لا وجه عام) */
export async function examVoiceUrl(db: Db, me: Me, key: string, now = new Date()): Promise<{ ok: true; url: string; sec: number | null } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const src = await loadSources(db, me, it, now); const sp = src.exam?.speaking; if (!sp || !sp.has_media) return fail(sp?.purged ? 'حُذف التسجيل وفق سياسة الصوت' : 'لا تسجيل لك في هذا المستوى', 404);
  const w = it.window; const examTo = addDaysKey(w.to_day, LEVEL_LIMITS.openAfterDays);
  const reports = await safe<any[]>(db.from('placement_reports').select('id,submission_id,report').ilike('candidate_email', lower(me.email)).is('archived_at', null).gte('created_at', `${w.from_day}T00:00:00Z`).lte('created_at', `${examTo}T23:59:59Z`).order('created_at', { ascending: false }).limit(10), []);
  const rep = reports.find((r) => r.report && (r.report as any).exit && !(r.report as any).exit_retake); if (!rep?.submission_id) return fail('لا تسجيل', 404);
  const p = await safe<any>(db.from('miaar_performances').select('media_path,media_purged_at,duration_sec,candidate_email,user_id').eq('session_id', String(rep.submission_id)).eq('skill', 'speaking').maybeSingle(), null);
  if (!p?.media_path || p.media_purged_at) return fail('لا تسجيل', 404); if (p.user_id && String(p.user_id) !== me.id && lower(p.candidate_email) !== lower(me.email)) return fail('ليس لك', 403);
  try { const r = await db.storage.from(MEDIA_BUCKET).createSignedUrl(String(p.media_path), SIGN_SECONDS); if (!r.data?.signedUrl) return fail('تعذّر إنشاء الرابط', 500); return { ok: true, url: r.data.signedUrl, sec: p.duration_sec ? Number(p.duration_sec) : null }; } catch { return fail('تعذّر إنشاء الرابط', 500); }
}
export async function setKeep(db: Db, me: Me, key: string, cardKey: string, on: boolean, now = new Date()): Promise<{ ok: true; keep: Record<CardKey, boolean> } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await ensureRow(db, me, it, now); if ('ok' in row) return row;
  const keep = normalizeKeep(row.keep); if (!(cardKey in keep)) return fail('بطاقة غير معروفة'); keep[cardKey as CardKey] = !!on;
  const { error } = await db.from('portal_level_pages').update({ keep, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر الحفظ', 500); return { ok: true, keep };
}
export async function setPublic(db: Db, me: Me, key: string, b: { public_keys?: unknown; live_public?: unknown }, now = new Date()): Promise<{ ok: true; public_keys: PublicKey[]; live_public: boolean } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await ensureRow(db, me, it, now); if ('ok' in row) return row;
  const keys = b.public_keys === undefined ? normalizePublic(row.public_keys ?? PUBLIC_DEFAULT) : normalizePublic(b.public_keys); const live = b.live_public === undefined ? !!row.live_public : !!b.live_public;
  const { error } = await db.from('portal_level_pages').update({ public_keys: keys, live_public: live, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر الحفظ', 500); return { ok: true, public_keys: keys, live_public: live };
}
/** الختم: جسم ثابت (JCS) → SHA-256 → رمز ATH-LV. الختم الجديد يُبطل السابق (يبقى في history ويُجيب /verify بـ «أُبطلت واستُبدلت»). */
export async function sealLevel(db: Db, me: Me, key: string, now = new Date()): Promise<{ ok: true; code: string; digest: string; sealed_at: string; public_path: string; verify_path: string } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await ensureRow(db, me, it, now); if ('ok' in row) return row;
  if (!row.line_ar) return fail('اكتب «سطر المستوى» أولًا — سطر واحد تحمله معك');
  const src = await loadSources(db, me, it, now); const { cards, counts } = buildCards(src, it.window);
  const history = arr<{ code: string; sealed_at: string; digest: string; revoked_at: string }>(row.history); if (row.code && row.sealed_at) history.push({ code: row.code, sealed_at: row.sealed_at, digest: String(row.digest || ''), revoked_at: row.revoked_at || now.toISOString() }); /* الرمز السابق — مُبطَلًا كان أو قائمًا — يبقى معروفًا في التحقّق: «استُبدل بختم أحدث» */
  let last: any = null;
  for (let i = 0; i < 3; i++) {
    const code = levelCode(); const body = levelBody({ code, program: { id: it.program_id, name_ar: it.name_ar, level_no: it.level_no, from: it.window.from_day, to: it.window.to_day, section_ar: it.section_ar }, name: String(me.name || ''), line_ar: row.line_ar, cards, keep: normalizeKeep(row.keep), counts, sealed_at: now.toISOString() }); const digest = digestOf(body);
    const { error } = await db.from('portal_level_pages').update({ code, digest, body, history: history.slice(-20), sealed_at: now.toISOString(), revoked_at: null, updated_at: now.toISOString() }).eq('id', row.id); last = error;
    if (!error) return { ok: true, code, digest, sealed_at: now.toISOString(), public_path: `${LEVEL_PUBLIC_PREFIX}/${code}`, verify_path: `/verify/level?code=${code}` };
    if (!String(error?.message || '').includes('code')) break;
  }
  void last; return fail('تعذّر الختم', 500);
}
export async function revokeLevel(db: Db, me: Me, key: string, now = new Date()): Promise<{ ok: true } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await rowOf(db, me, it); if (!row || !row.code || !row.sealed_at) return fail('لا ختم لإبطاله', 404); if (row.revoked_at) return { ok: true };
  const { error } = await db.from('portal_level_pages').update({ revoked_at: now.toISOString(), live_public: false, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر الإبطال', 500); return { ok: true };
}
/** الحذف فوري: الصفّ كلّه (السطر، الصوت إن وُجد، الختم، التاريخ) — كلماته في مصادرها تبقى حيث هي */
export async function deleteLevel(db: Db, me: Me, key: string, now = new Date()): Promise<{ ok: true } | Fail> {
  const it = await myLevel(db, me, key, now); if ('ok' in it) return it; const row = await rowOf(db, me, it); if (!row) return { ok: true };
  const v = voiceOfRow(row.line_voice); if (v) await removeVoiceFile(db, v.path);
  const { error } = await db.from('portal_level_pages').delete().eq('id', row.id).eq('user_id', me.id); if (error) return fail('تعذّر الحذف', 500); return { ok: true };
}

/* ───────── التحقّق والوجه العام ───────── */
export type VerifyOut = { valid: boolean; revoked?: boolean; replaced?: boolean; intact?: boolean; sealed_at?: string; digest?: string; program_ar?: string; level_no?: number; face?: PublicFace | null; public?: boolean; minimal?: boolean };
export async function verifyLevel(db: Db, code: string, opts: { face?: boolean } = {}): Promise<VerifyOut> {
  const c = String(code || '').trim().toUpperCase(); if (!CODE_RE.test(c)) return { valid: false };
  let { data: r } = await db.from('portal_level_pages').select(LEVEL_COLS).eq('code', c).maybeSingle();
  if (!r) { const { data: hs } = await db.from('portal_level_pages').select('id,code,history,sealed_at,program_id').contains('history', JSON.stringify([{ code: c }])).limit(1); const h = arr<any>(hs)[0]; if (!h) return { valid: false }; const old = arr<any>(h.history).find((x) => x.code === c); return { valid: false, revoked: true, replaced: true, sealed_at: old?.sealed_at, digest: old?.digest }; }
  const row = r as LevelRow; if (!row.body || !row.sealed_at) return { valid: false };
  const intact = digestOf(row.body) === row.digest; const revoked = !!row.revoked_at;
  const minimal = row.live_public ? await userFlag(db, row.user_id, 'verify_minimal', row.email) : false; /* P67 */
  const out: VerifyOut = { valid: !revoked && intact, revoked, intact, sealed_at: row.sealed_at, digest: String(row.digest || ''), program_ar: row.body.program.name_ar, level_no: row.body.program.level_no, public: !!row.live_public && !minimal, minimal };
  if (opts.face && row.live_public && !revoked && !minimal) out.face = publicFace(row.body, normalizePublic(row.public_keys ?? PUBLIC_DEFAULT), { revoked, intact });
  else if (opts.face && revoked) out.face = { code: c, program_ar: row.body.program.name_ar, level_no: row.body.program.level_no, from: row.body.program.from, to: row.body.program.to, sealed_at: row.sealed_at, name: null, line_ar: null, counts: null, cards: [], revoked: true, intact };
  return out;
}

/* ───────── الشعبة (أعداد فقط · k ≥ 5) · الصدى · صفحة التخرّج ───────── */
export async function sectionSealed(db: Db, classroomId: string, levelNo: number): Promise<number> { try { const { count } = await db.from('portal_level_pages').select('id', { count: 'exact', head: true }).eq('classroom_id', classroomId).eq('level_no', levelNo).not('sealed_at', 'is', null).is('revoked_at', null); return Number(count || 0); } catch { return 0; } }
/** «الكلمة التي تعبر»: في الأسبوع الأول من مستوى جديد يرى صاحبها سطره المختوم من المستوى السابق — له وحده */
export async function levelEcho(db: Db, me: Me, now = new Date()): Promise<{ intro_ar: string; line_ar: string; level_no: number; next_level_no: number; href: string } | null> {
  const today = dayKeyRiyadh(now); const levels = await myLevels(db, me, now);
  for (const it of levels) { if (!it.sealed || !it.next_from || !isEchoWeek(it.next_from, today)) continue; const row = await rowOf(db, me, it); if (!row?.line_ar || !row.sealed_at || row.revoked_at) continue;
    return { intro_ar: echoIntroAr(it.level_no), line_ar: String(row.line_ar), level_no: it.level_no, next_level_no: it.level_no + 1, href: `${LEVEL_PATH}?level=${encodeURIComponent(it.key)}` }; }
  return null;
}
/** P70-ب: ما يراه المتدرّب في «سطري» — كلمته التي تعبر (P70) + كلمة العبور من أستاذه + تذكير لطيف إن كانت صفحة مستواه ما زالت مفتوحة */
export type LearnerEchoView = {
  own: { intro_ar: string; line_ar: string; level_no: number; next_level_no: number; href: string } | null;
  word: { notice_id: string; title_ar: string; text_ar: string; voice_sec: number | null; at: string; level_no: number } | null;
  open: { href: string; level_no: number; until_ar: string } | null;
};
export async function learnerEchoView(db: Db, me: Me, now = new Date()): Promise<LearnerEchoView> {
  const today = dayKeyRiyadh(now); const levels = await myLevels(db, me, now);
  const own = await levelEcho(db, me, now);
  /* المستوى الحالي: آخر مستوى بدأ ما بعده */
  const cur = levels.filter((it) => it.next_from && today >= it.next_from).sort((a, b) => b.level_no - a.level_no)[0] || null;
  const word = cur ? await learnerEchoWord(db, me.email, cur.classroom_id, cur.level_no + 1).catch(() => null) : null;
  const pend = levels.find((it) => !it.sealed && it.phase === 'open' && today > it.window.to_day) || null;
  const open = pend ? { href: `${LEVEL_PATH}?level=${encodeURIComponent(pend.key)}`, level_no: pend.level_no, until_ar: fmtIsoAr(`${pend.window.open_to}T00:00:00Z`) } : null;
  return { own, word, open };
}
/** لصفحة التخرّج (P63): سطور المستويات المختومة بالترتيب — كلماته هو */
export async function sealedLevelLines(db: Db, me: Me, programId: string): Promise<{ level_no: number; line_ar: string; sealed_at: string }[]> {
  const rows = await safe<any[]>(db.from('portal_level_pages').select('level_no,line_ar,sealed_at,revoked_at').eq('user_id', me.id).eq('program_id', programId).not('sealed_at', 'is', null).is('revoked_at', null).order('level_no').limit(10), []);
  return rows.filter((r) => r.line_ar).map((r) => ({ level_no: Number(r.level_no), line_ar: String(r.line_ar), sealed_at: String(r.sealed_at) }));
}
