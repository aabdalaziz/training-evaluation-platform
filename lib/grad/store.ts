// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P63 «يوم تخرّجي — بكلماتي» — طبقة القاعدة (جدول واحد جديد: portal_grad_pages)
 *  gradPrograms · loadGradPage (يجمع كلمات صاحبها من مصادر P25/P51/P53/P58/P62 داخل نافذة البرنامج) · saveLine · setKeep · setPublic
 *  sealGrad (رمز ATH-GD + بصمة SHA-256 على JCS؛ الختم الجديد يُبطل السابق ويُسجَّل في history) · revokeGrad (فوري ومعلَن) · deleteGrad (فوري)
 *  verifyGrad (/verify/grad و /g/<code>) · cohortSealed (k ≥ 5) · gradEvidence (اعتماد 3.5) · النبض يقرأ الجدول مباشرة (pulse.ts)
 *  runGradDays (ضمن الكرون اليومي القائم): إشعار «اليوم يومك» للخرّيج يوم end_date · «اكتب كلمة الوداع» للمدرّب قبلها بثلاثة أيام — بلا بريد، بلا إشعارات رجعية.
 */
import { createHash, randomBytes } from 'crypto';
import { MAP_VOICE_LIMITS, validateMapVoice } from '../map/voice';
import type { MapVoiceStored } from '../map/voice';
import { jcs } from '../portal/vc';
import { loadJourney } from '../journey/load';
import { letterState, openHourAr, fmtDayAr as fmtIsoAr, cohortOpensAt, dayKeyRiyadh, LETTER_LIMITS } from '../letters/self';
import { buildCards, sinceThen, gradBody, publicFace, programWindow, gradPhase, validateLine, normalizeKeep, normalizePublic, cohortLineAr, gradEvidenceLineAr, gradDayNotice, farewellAskNotice, CODE_RE, GRAD_LIMITS, GRAD_PATH, PUBLIC_DEFAULT } from './registry';
import type { Card, Counts, Since, Sources, CardKey, PublicKey, GradBody, GradPhase, PublicFace } from './registry';
import type { Evidence } from '../accreditation/registry';

type Db = any;
export type Me = { id: string; email: string; name?: string };
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const ENROLLED = ['approved', 'placed', 'active', 'completed'];
export const GRAD_COLS = 'id,user_id,email,program_id,enrollment_id,line_ar,line_voice,keep,public_keys,live_public,body,code,digest,history,sealed_at,revoked_at,created_at,updated_at';
export const gradCode = (): string => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(8); const s = Array.from(b).map((x) => A[x % A.length]).join(''); return `ATH-GD-${s.slice(0, 4)}-${s.slice(4, 8)}`; };
export const digestOf = (doc: unknown): string => createHash('sha256').update(jcs(doc)).digest('hex');

export type GradProgram = { id: string; name_ar: string; start_date: string | null; end_date: string; enrollment_id: string; classroom_id: string | null; phase: GradPhase; sealed: boolean };
export type GradRow = { id: number; user_id: string; email: string; program_id: string; enrollment_id: string | null; line_ar: string | null; line_voice: MapVoiceStored | Record<string, never> | null; keep: Record<string, boolean> | null; public_keys: string[] | null; live_public: boolean; body: GradBody | null; code: string | null; digest: string | null; history: { code: string; sealed_at: string; digest: string; revoked_at: string }[] | null; sealed_at: string | null; revoked_at: string | null; created_at: string; updated_at: string };
export type GradView = {
  program: Omit<GradProgram, 'sealed'>; today: string; window: { from: string; to: string };
  cards: Card[]; counts: Counts; keep: Record<CardKey, boolean>; line_ar: string | null; voice: { sec: number; at: string } | null; public_keys: PublicKey[]; live_public: boolean;
  seal: { code: string; sealed_at: string; digest: string; revoked_at: string | null; public_path: string; verify_path: string; previous: number; stale: boolean } | null;
  since: Since; cohort_ar: string | null; legacy_letter: { text_ar: string | null; sealed_at: string; opened_at: string | null; opens_ar: string } | null;
};

/** برامجي التي انتهت (أو تنتهي اليوم) — من قيود التسجيل لا من الدرجات */
export async function gradPrograms(db: Db, me: Me, now = new Date()): Promise<GradProgram[]> {
  const today = dayKeyRiyadh(now);
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,status,classroom_id,created_at').eq('email', lower(me.email)).in('status', ENROLLED).limit(50), []);
  const ids = [...new Set(en.map((e) => String(e.program_id || '')).filter(Boolean))].slice(0, 20); if (!ids.length) return [];
  const [ps, mine] = await Promise.all([safe<any[]>(db.from('programs').select('id,name_ar,start_date,end_date').in('id', ids).limit(20), []), safe<any[]>(db.from('portal_grad_pages').select('program_id,sealed_at,revoked_at').eq('user_id', me.id).limit(50), [])]);
  const sealed = new Set(mine.filter((r) => r.sealed_at && !r.revoked_at).map((r) => String(r.program_id)));
  const out: GradProgram[] = [];
  for (const p of ps) { const end = p.end_date ? String(p.end_date).slice(0, 10) : null; if (!end || end > today) continue; const e = en.filter((x) => String(x.program_id) === String(p.id)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    out.push({ id: String(p.id), name_ar: String(p.name_ar || 'برنامج'), start_date: p.start_date ? String(p.start_date).slice(0, 10) : null, end_date: end, enrollment_id: String(e.id), classroom_id: e.classroom_id ? String(e.classroom_id) : null, phase: gradPhase(end, today), sealed: sealed.has(String(p.id)) }); }
  return out.sort((a, b) => b.end_date.localeCompare(a.end_date));
}
async function rowOf(db: Db, me: Me, programId: string): Promise<GradRow | null> { const { data } = await db.from('portal_grad_pages').select(GRAD_COLS).eq('user_id', me.id).eq('program_id', programId).maybeSingle(); return (data as GradRow) || null; }

/** المصادر — كلمات صاحبها فقط (المدرّب يحضر بكلمة الوداع وحدها) */
export async function loadSources(db: Db, me: Me, p: Pick<GradProgram, 'id' | 'end_date' | 'enrollment_id'>, now = new Date()): Promise<Sources> {
  const email = lower(me.email);
  const [threads, replies, journey, caps, snaps, rooms, stations] = await Promise.all([
    safe<any[]>(db.from('portal_map_threads').select('from_key,to_key,rule,status,note_ar,decided_at').eq('email', email).limit(500), []),
    safe<any[]>(db.from('portal_word_replies').select('text,created_at,meta').eq('learner_email', email).limit(300), []),
    loadJourney(db, me, now.getTime(), false).catch(() => ({ chapters: [] as any[] })),
    safe<any[]>(db.from('portal_time_capsules').select('id,scope,horizon,program_id,body_ar,created_at,deliver_at,opened_at,status').eq('user_id', me.id).eq('program_id', p.id).neq('status', 'cancelled').limit(20), []),
    safe<any[]>(db.from('portal_map_snapshots').select('code,created_at,is_public,revoked_at').eq('user_id', me.id).is('revoked_at', null).order('created_at', { ascending: false }).limit(1), []),
    safe<any[]>(db.from('classrooms').select('id').eq('program_id', p.id).limit(50), []),
    safe<any[]>(db.from('portal_after_stations').select('station,written_at').eq('enrollment_id', p.enrollment_id).limit(10), []),
  ]);
  const roomIds = new Set(rooms.map((r) => String(r.id)));
  let farewell: Sources['farewell'] = null;
  try { const { data: n } = await db.from('portal_learner_notices').select('body_ar,title_ar,created_at,ref_id,meta').eq('email', email).eq('kind', 'trainer_word').order('created_at', { ascending: false }).limit(60);
    const f = arr<any>(n).find((x) => x.meta && (x.meta as any).grad && (!x.ref_id || roomIds.has(String(x.ref_id)))); if (f) farewell = { text_ar: String(f.body_ar || ''), at: String(f.created_at), voice_sec: f.meta?.voice?.sec ? Number(f.meta.voice.sec) : null, trainer_ar: String(f.title_ar || '').replace(/^🎓\s*/, '').replace(/^كلمة الوداع من مدرّبك\s*/, '').trim() || null }; } catch { farewell = null; }
  const cohort = caps.find((c) => c.scope === 'cohort') || null; const letter = caps.filter((c) => (c.scope || 'self') === 'self' && c.horizon === 'grad').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
  const st = letter ? letterState({ deliver_at: letter.deliver_at, opened_at: letter.opened_at, created_at: letter.created_at }, now) : null;
  const end = `${p.end_date}T23:59:59Z`;
  let cohort_opened = false; try { const opens = cohortOpensAt(p.end_date); if (now.getTime() >= opens.getTime()) { const { count } = await db.from('portal_time_capsules').select('id', { count: 'exact', head: true }).eq('scope', 'cohort').eq('program_id', p.id).neq('status', 'cancelled'); cohort_opened = Number(count || 0) >= LETTER_LIMITS.kCohort; } } catch { cohort_opened = false; }
  return {
    threads: threads.map((t) => ({ from: String(t.from_key), to: String(t.to_key), rule: String(t.rule || 'manual'), status: String(t.status || 'kept'), note_ar: t.note_ar || null, decided_at: t.decided_at ? String(t.decided_at) : null })),
    replies: replies.map((r) => ({ text: r.text ? String(r.text) : null, voice: !!(r.meta && (r.meta as any).voice), at: String(r.created_at) })),
    chapters: arr<any>((journey as any).chapters).map((c) => ({ key: String(c.key), title_ar: String(c.title_ar), at: String(c.at) })),
    cohort_line: cohort ? { body_ar: String(cohort.body_ar || ''), created_at: String(cohort.created_at) } : null,
    grad_letter: letter && st ? { id: Number(letter.id), state: st.state, opens_ar: fmtIsoAr(letter.deliver_at), open_hour_ar: openHourAr(letter.deliver_at) } : null,
    map_code: snaps[0] ? { code: String(snaps[0].code), created_at: String(snaps[0].created_at), is_public: !!snaps[0].is_public } : null,
    farewell, stations: stations.map((s) => ({ station: Number(s.station) as 30 | 90 | 365, written: !!s.written_at })), cohort_opened,
    threads_after: threads.filter((t) => t.status === 'kept' && t.decided_at && String(t.decided_at) > end).length,
  };
}

export async function loadGradPage(db: Db, me: Me, programId: string | null, now = new Date()): Promise<{ programs: GradProgram[]; view: GradView | null }> {
  const programs = await gradPrograms(db, me, now); if (!programs.length) return { programs, view: null };
  const p = programs.find((x) => x.id === programId) || programs[0];
  const [src, row, legacy, cohortN] = await Promise.all([loadSources(db, me, p, now), rowOf(db, me, p.id), safe<any>(db.from('portal_after_letters').select('text_ar,sealed_at,opened_at').eq('enrollment_id', p.enrollment_id).maybeSingle(), null), cohortSealed(db, p.id)]);
  const w = programWindow(p.start_date, p.end_date); const { cards, counts } = buildCards(src, p, w); const since = sinceThen(src, p.end_date, now);
  const keep = normalizeKeep(row?.keep); const line = row?.line_ar || null; const sealedBody = row?.sealed_at && !row.revoked_at && row.body ? row.body : null;
  const stale = !!sealedBody && (sealedBody.line_ar !== (line || '') || JSON.stringify(sealedBody.cards.map((c) => c.key)) !== JSON.stringify(cards.filter((c) => keep[c.key] !== false).map((c) => c.key)));
  const { sealed, ...program } = p; void sealed;
  return { programs, view: {
    program, today: dayKeyRiyadh(now), window: w, cards, counts: { ...counts, days: 0 }, keep, line_ar: line, voice: (() => { const v = voiceOfRow(row?.line_voice); return v ? { sec: v.sec, at: v.at } : null; })(), public_keys: normalizePublic(row?.public_keys ?? PUBLIC_DEFAULT), live_public: !!row?.live_public,
    seal: row?.code && row.sealed_at && row.body ? { code: row.code, sealed_at: row.sealed_at, digest: String(row.digest || ''), revoked_at: row.revoked_at || null, public_path: `/g/${row.code}`, verify_path: `/verify/grad?code=${row.code}`, previous: arr(row.history).length, stale } : null,
    since, cohort_ar: cohortLineAr(cohortN), legacy_letter: legacy ? { text_ar: legacy.opened_at ? String(legacy.text_ar || '') : null, sealed_at: String(legacy.sealed_at), opened_at: legacy.opened_at || null, opens_ar: fmtIsoAr(new Date(new Date(`${p.end_date}T00:00:00Z`).getTime() + 365 * 86400000).toISOString()) } : null,
  } };
}

async function ensureRow(db: Db, me: Me, p: GradProgram, now: Date): Promise<GradRow | Fail> {
  const ex = await rowOf(db, me, p.id); if (ex) return ex;
  const row = { user_id: me.id, email: lower(me.email), program_id: p.id, enrollment_id: p.enrollment_id, keep: {}, public_keys: PUBLIC_DEFAULT, live_public: false, history: [], created_at: now.toISOString(), updated_at: now.toISOString() };
  const { data, error } = await db.from('portal_grad_pages').insert(row).select(GRAD_COLS).single(); if (error || !data) return fail('تعذّر فتح صفحتك', 500); return data as GradRow;
}
async function myProgram(db: Db, me: Me, programId: string, now: Date): Promise<GradProgram | Fail> { const p = (await gradPrograms(db, me, now)).find((x) => x.id === programId); return p || fail('هذا البرنامج ليس من برامجك المنتهية', 404); }
/** «سطر التخرّج» (≤ 160) — الصوت له مسار مستقلّ (setLineVoice) ولا يدخل الجسم المختوم ولا الوجه العام */
export async function saveLine(db: Db, me: Me, programId: string, b: { line_ar?: string }, now = new Date()): Promise<{ ok: true; line_ar: string } | Fail> {
  const p = await myProgram(db, me, programId, now); if ('ok' in p) return p; const v = validateLine(b.line_ar); if (!v.ok) return fail(v.error);
  const row = await ensureRow(db, me, p, now); if ('ok' in row) return row;
  const { error } = await db.from('portal_grad_pages').update({ line_ar: v.text, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر حفظ السطر', 500);
  return { ok: true, line_ar: v.text };
}
const VOICE_PREFIX = 'grad-voice';
export function voiceOfRow(v: unknown): MapVoiceStored | null { if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>; const path = typeof o.path === 'string' ? o.path : ''; const sec = Number(o.sec || 0); if (!path.startsWith(`${VOICE_PREFIX}/`) || !(sec > 0)) return null; return { path, sec: Math.round(sec), bytes: Number(o.bytes || 0) || 0, mime: typeof o.mime === 'string' ? o.mime : 'audio/webm', at: typeof o.at === 'string' ? o.at : '' }; }
export const gradVoicePath = (userId: string, rowId: number | string, ext: string) => `${VOICE_PREFIX}/${userId}/${rowId}.${ext}`;
const removeVoiceFile = async (db: Db, path: string) => { try { await db.storage.from(MAP_VOICE_LIMITS.bucket).remove([path]); } catch { /* يتيم نادر */ } };
/** 🎙️ سطر التخرّج بصوت صاحبه (≤ 15 ث · ملف واحد) — يبقى معه: لا وجه عام، لا تحقّق، لا دفعة */
export async function setLineVoice(db: Db, me: Me, programId: string, file: { buf: Buffer; mime: string; bytes: number; sec: number }, now = new Date()): Promise<{ ok: true; voice: { sec: number; at: string }; replaced: boolean } | Fail> {
  const p = await myProgram(db, me, programId, now); if ('ok' in p) return p; const row = await ensureRow(db, me, p, now); if ('ok' in row) return row;
  const v = validateMapVoice({ mime: file.mime, bytes: file.bytes, sec: file.sec }); if (!v.ok) return fail(v.error);
  const prev = voiceOfRow(row.line_voice); const path = gradVoicePath(me.id, row.id, v.ext); const at = now.toISOString();
  const { error: upErr } = await db.storage.from(MAP_VOICE_LIMITS.bucket).upload(path, file.buf, { contentType: v.mime, upsert: true }); if (upErr) return fail(`تعذّر رفع التسجيل: ${upErr.message}`, 500);
  const stored: MapVoiceStored = { path, sec: v.sec, bytes: file.bytes, mime: v.mime, at };
  const { error } = await db.from('portal_grad_pages').update({ line_voice: stored, updated_at: at }).eq('id', row.id); if (error) { await removeVoiceFile(db, path); return fail('تعذّر حفظ الصوت', 500); }
  if (prev?.path && prev.path !== path) await removeVoiceFile(db, prev.path);
  return { ok: true, voice: { sec: v.sec, at }, replaced: !!prev };
}
export async function clearLineVoice(db: Db, me: Me, programId: string): Promise<{ ok: true; had: boolean } | Fail> {
  const row = await rowOf(db, me, programId); const prev = voiceOfRow(row?.line_voice); if (!row || !prev) return { ok: true, had: false };
  const { error } = await db.from('portal_grad_pages').update({ line_voice: {} }).eq('id', row.id); if (error) return fail('تعذّر الحذف', 500); await removeVoiceFile(db, prev.path); return { ok: true, had: true };
}
export async function lineVoiceUrl(db: Db, me: Me, programId: string): Promise<{ ok: true; url: string; sec: number } | Fail> {
  const row = await rowOf(db, me, programId); const v = voiceOfRow(row?.line_voice); if (!row || !v) return fail('لا صوت على سطرك', 404);
  try { const { data } = await db.storage.from(MAP_VOICE_LIMITS.bucket).createSignedUrl(v.path, MAP_VOICE_LIMITS.signedSeconds); if (!data?.signedUrl) return fail('تعذّر إنشاء الرابط', 500); return { ok: true, url: data.signedUrl, sec: v.sec }; } catch { return fail('تعذّر إنشاء الرابط', 500); }
}
export async function setKeep(db: Db, me: Me, programId: string, key: string, on: boolean, now = new Date()): Promise<{ ok: true; keep: Record<CardKey, boolean> } | Fail> {
  const p = await myProgram(db, me, programId, now); if ('ok' in p) return p; const row = await ensureRow(db, me, p, now); if ('ok' in row) return row;
  const keep = normalizeKeep(row.keep); if (!(key in keep)) return fail('بطاقة غير معروفة'); keep[key as CardKey] = !!on;
  const { error } = await db.from('portal_grad_pages').update({ keep, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر الحفظ', 500); return { ok: true, keep };
}
export async function setPublic(db: Db, me: Me, programId: string, b: { public_keys?: unknown; live_public?: unknown }, now = new Date()): Promise<{ ok: true; public_keys: PublicKey[]; live_public: boolean } | Fail> {
  const p = await myProgram(db, me, programId, now); if ('ok' in p) return p; const row = await ensureRow(db, me, p, now); if ('ok' in row) return row;
  const keys = b.public_keys === undefined ? normalizePublic(row.public_keys ?? PUBLIC_DEFAULT) : normalizePublic(b.public_keys); const live = b.live_public === undefined ? !!row.live_public : !!b.live_public;
  const { error } = await db.from('portal_grad_pages').update({ public_keys: keys, live_public: live, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر الحفظ', 500); return { ok: true, public_keys: keys, live_public: live };
}
/** الختم: جسم ثابت (JCS) → SHA-256 → رمز ATH-GD. الختم الجديد يُبطل السابق (يبقى في history ويُجيب /verify بـ «أُبطلت واستُبدلت»). */
export async function sealGrad(db: Db, me: Me, programId: string, now = new Date()): Promise<{ ok: true; code: string; digest: string; sealed_at: string; public_path: string; verify_path: string } | Fail> {
  const p = await myProgram(db, me, programId, now); if ('ok' in p) return p; const row = await ensureRow(db, me, p, now); if ('ok' in row) return row;
  if (!row.line_ar) return fail('اكتب «سطر التخرّج» أولًا — سطر واحد لمن سيأتي بعدك');
  const src = await loadSources(db, me, p, now); const w = programWindow(p.start_date, p.end_date); const { cards, counts } = buildCards(src, p, w);
  const history = arr<{ code: string; sealed_at: string; digest: string; revoked_at: string }>(row.history); if (row.code && row.sealed_at && !row.revoked_at) history.push({ code: row.code, sealed_at: row.sealed_at, digest: String(row.digest || ''), revoked_at: now.toISOString() });
  let last: any = null;
  for (let i = 0; i < 3; i++) {
    const code = gradCode(); const body = gradBody({ code, program: { id: p.id, name_ar: p.name_ar, start: p.start_date, end: p.end_date }, name: String(me.name || ''), line_ar: row.line_ar, cards, keep: normalizeKeep(row.keep), counts, sealed_at: now.toISOString() }); const digest = digestOf(body);
    const { error } = await db.from('portal_grad_pages').update({ code, digest, body, history: history.slice(-20), sealed_at: now.toISOString(), revoked_at: null, updated_at: now.toISOString() }).eq('id', row.id); last = error;
    if (!error) return { ok: true, code, digest, sealed_at: now.toISOString(), public_path: `/g/${code}`, verify_path: `/verify/grad?code=${code}` };
    if (!String(error?.message || '').includes('code')) break;
  }
  return fail(last?.message ? 'تعذّر الختم' : 'تعذّر الختم', 500);
}
export async function revokeGrad(db: Db, me: Me, programId: string, now = new Date()): Promise<{ ok: true } | Fail> {
  const row = await rowOf(db, me, programId); if (!row || !row.code || !row.sealed_at) return fail('لا ختم لإبطاله', 404); if (row.revoked_at) return { ok: true };
  const { error } = await db.from('portal_grad_pages').update({ revoked_at: now.toISOString(), live_public: false, updated_at: now.toISOString() }).eq('id', row.id); if (error) return fail('تعذّر الإبطال', 500); return { ok: true };
}
/** الحذف فوري: الصفّ كلّه (السطر، الصوت إن وُجد، الختم، التاريخ) */
export async function deleteGrad(db: Db, me: Me, programId: string): Promise<{ ok: true } | Fail> {
  const row = await rowOf(db, me, programId); if (!row) return { ok: true };
  const v = voiceOfRow(row.line_voice); if (v) await removeVoiceFile(db, v.path);
  const { error } = await db.from('portal_grad_pages').delete().eq('id', row.id).eq('user_id', me.id); if (error) return fail('تعذّر الحذف', 500); return { ok: true };
}

/* ───────── التحقّق والوجه العام ───────── */
export type VerifyOut = { valid: boolean; revoked?: boolean; replaced?: boolean; intact?: boolean; sealed_at?: string; digest?: string; program_ar?: string; end?: string; face?: PublicFace | null; public?: boolean };
export async function verifyGrad(db: Db, code: string, opts: { now?: Date; face?: boolean } = {}): Promise<VerifyOut> {
  const c = String(code || '').trim().toUpperCase(); if (!CODE_RE.test(c)) return { valid: false };
  let { data: r } = await db.from('portal_grad_pages').select(GRAD_COLS).eq('code', c).maybeSingle();
  if (!r) { /* رمز سابق استُبدل بختم أحدث */ const { data: hs } = await db.from('portal_grad_pages').select('id,code,history,sealed_at,program_id').contains('history', JSON.stringify([{ code: c }])).limit(1); const h = arr<any>(hs)[0]; if (!h) return { valid: false }; const old = arr<any>(h.history).find((x) => x.code === c); return { valid: false, revoked: true, replaced: true, sealed_at: old?.sealed_at, digest: old?.digest }; }
  const row = r as GradRow; if (!row.body || !row.sealed_at) return { valid: false };
  const intact = digestOf(row.body) === row.digest; const revoked = !!row.revoked_at;
  const out: VerifyOut = { valid: !revoked && intact, revoked, intact, sealed_at: row.sealed_at, digest: String(row.digest || ''), program_ar: row.body.program.name_ar, end: row.body.program.end, public: !!row.live_public };
  if (opts.face && row.live_public && !revoked) {
    const keys = normalizePublic(row.public_keys ?? PUBLIC_DEFAULT); let since: Since | null = null;
    if (keys.includes('since')) { try { const src = await loadSources(db, { id: row.user_id, email: row.email }, { id: row.program_id, end_date: row.body.program.end, enrollment_id: String(row.enrollment_id || '') }, opts.now || new Date()); since = sinceThen(src, row.body.program.end, opts.now || new Date()); } catch { since = null; } }
    out.face = publicFace(row.body, keys, { since, revoked, intact });
  } else if (opts.face && revoked) out.face = { code: c, program_ar: row.body.program.name_ar, end: row.body.program.end, sealed_at: row.sealed_at, name: null, line_ar: null, counts: null, cards: [], since_ar: null, revoked: true, intact };
  return out;
}

/* ───────── الدفعة · الاعتماد · النبض (أعداد فقط، k ≥ 5) ───────── */
export async function cohortSealed(db: Db, programId: string): Promise<number> { try { const { count } = await db.from('portal_grad_pages').select('id', { count: 'exact', head: true }).eq('program_id', programId).not('sealed_at', 'is', null).is('revoked_at', null); return Number(count || 0); } catch { return 0; } }
export async function gradEvidence(db: Db, programId: string): Promise<Evidence[]> {
  const n = await cohortSealed(db, programId); const line = gradEvidenceLineAr(n); if (!line) return [];
  return [{ id: 'grad:pages', kind: 'grad', codes: ['3.5'], label_ar: line, at: null, href: null, n }];
}

/* ───────── الكرون اليومي ───────── */
const addDaysKey = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
export async function runGradDays(db: Db, opts: { now?: Date; dry?: boolean; site?: string } = {}): Promise<{ graduates: number; trainers: number; errors: string[] }> {
  const now = opts.now || new Date(); const today = dayKeyRiyadh(now); const s = { graduates: 0, trainers: 0, errors: [] as string[] };
  const { pushNotice } = await import('../portal/notices');
  try { /* 1) يوم التخرّج — لمن ينتهي برنامجه اليوم فقط (لا إشعارات رجعية؛ الصفحة نفسها تُفتح لكل خرّيج سابق) */
    const ps = await safe<any[]>(db.from('programs').select('id,name_ar,end_date').eq('end_date', today).limit(50), []);
    for (const p of ps) { const en = await safe<any[]>(db.from('portal_enrollments').select('id,email,user_id').eq('program_id', p.id).in('status', ENROLLED).limit(500), []); const seen = new Set<string>();
      for (const e of en) { const email = lower(e.email); if (!email || seen.has(email)) continue; seen.add(email); const t = gradDayNotice(String(p.name_ar || 'برنامجك'));
        const r = await pushNotice(db, { email, user_id: e.user_id || null, report_id: null, kind: 'grad_day', ...t, url: `${GRAD_PATH}?program=${encodeURIComponent(String(p.id))}`, ref_id: String(p.id), dedupe_key: `grad_day:${e.id}`, push: true }, { dry: !!opts.dry, site: opts.site, now }); if (r.inserted) s.graduates += 1; } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  try { /* 2) «اكتب كلمة الوداع» — للمدرّب قبل النهاية بثلاثة أيام (اختيارية؛ الصفحة تعمل بدونها) */
    const day = addDaysKey(today, GRAD_LIMITS.farewellBeforeDays); const ps = await safe<any[]>(db.from('programs').select('id,name_ar,end_date').eq('end_date', day).limit(50), []);
    for (const p of ps) { const rooms = await safe<any[]>(db.from('classrooms').select('id,code,trainer_id').eq('program_id', p.id).not('trainer_id', 'is', null).limit(50), []); if (!rooms.length) continue;
      const trs = await safe<any[]>(db.from('trainers').select('id,email').in('id', [...new Set(rooms.map((r) => String(r.trainer_id)))]).limit(50), []);
      for (const room of rooms) { const t = trs.find((x) => String(x.id) === String(room.trainer_id)); const email = lower(t?.email); if (!email) continue; const n = farewellAskNotice(String(p.name_ar || 'البرنامج'), String(room.code || ''), String(p.end_date));
        const r = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'grad_word', ...n, url: `/me/day?grad=${encodeURIComponent(String(room.id))}`, ref_id: String(room.id), dedupe_key: `grad_word:${room.id}`, push: false }, { dry: !!opts.dry, site: opts.site, now }); if (r.inserted) s.trainers += 1; } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  return s;
}
