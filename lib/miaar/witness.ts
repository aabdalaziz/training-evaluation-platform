// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «شاهِد» — سجلّ نزاهة الاختبار (مراقبة مصوَّرة) · Examination Integrity Record (photo proctoring) — م8
 *  المبدأ: لقطات لا فيديو · المؤشّرات تُحسب في المتصفح بلا نماذج · أي حكم يوقّعه إنسان · الجهة ترى الحكم لا الصور · حذف الصور بعد 90 يومًا.
 *  الأوضاع: room (قاعة بمراقب — أحداث الشاشة فقط) · camera (قاعة + شاهِد) · remote (عن بُعد: + لقطة هوية · ملء الشاشة · شاشة ثانية · فاصل أقصر)
 */
import { MEDIA_BUCKET } from './bank';

type Db = any;
const nowIso = () => new Date().toISOString();

export const WITNESS_TITLE = { ar: 'سجلّ نزاهة الاختبار — مراقبة مصوَّرة', en: 'Examination Integrity Record (photo proctoring)' } as const;
export const WITNESS_MODES = ['room', 'camera', 'remote'] as const;
export type WitnessMode = (typeof WITNESS_MODES)[number];
export const WITNESS_MODE_AR: Record<WitnessMode, string> = { room: 'قاعة بمراقب', camera: 'قاعة + شاهِد', remote: 'عن بُعد (شاهِد)' };
export const WITNESS_MODE_EN: Record<WitnessMode, string> = { room: 'Proctored room', camera: 'Room + camera witness', remote: 'Remote (camera witness)' };
export const isWitnessMode = (v: unknown): v is WitnessMode => typeof v === 'string' && (WITNESS_MODES as readonly string[]).includes(v);
export const usesCamera = (m: unknown) => m === 'camera' || m === 'remote';

export const EVENT_KINDS = ['frame', 'identity_frame', 'tab_hidden', 'focus_lost', 'fullscreen_exit', 'camera_lost', 'camera_back', 'still_frame', 'screen_extended', 'paste', 'section_start', 'whisper', 'verdict'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const isEventKind = (v: unknown): v is EventKind => typeof v === 'string' && (EVENT_KINDS as readonly string[]).includes(v);
/** ما يجوز للمتصفح إرساله (الهمسة والحكم من الطاقم فقط) */
export const CLIENT_KINDS: readonly EventKind[] = ['frame', 'identity_frame', 'tab_hidden', 'focus_lost', 'fullscreen_exit', 'camera_lost', 'camera_back', 'still_frame', 'screen_extended', 'paste', 'section_start'];
export const FRAME_KINDS: readonly EventKind[] = ['frame', 'identity_frame', 'tab_hidden', 'focus_lost', 'fullscreen_exit', 'camera_back', 'section_start'];
export const EVENT_AR: Record<EventKind, string> = { frame: 'لقطة', identity_frame: 'لقطة الهوية', tab_hidden: 'غادر اللسان', focus_lost: 'فقد التركيز', fullscreen_exit: 'خرج من ملء الشاشة', camera_lost: 'انقطعت الكاميرا', camera_back: 'عادت الكاميرا', still_frame: 'لا حركة', screen_extended: 'شاشة ثانية', paste: 'لصق نصّ', section_start: 'بداية قسم', whisper: 'همسة المراقب', verdict: 'حكم الشاهد' };

export const FRAME_MAX_BYTES = 16 * 1024;     /* 240×180 JPEG ≈ 8–12 KB */
export const FRAMES_MAX = 160;                /* ≈ 100 دقيقة × فاصل 40 ث */
export const EVENTS_MAX = 600;
export const RETENTION_DAYS = 90;
export const WHISPER_MAX = 160;
export const DEFAULT_INTERVAL: Record<WitnessMode, number> = { room: 0, camera: 45, remote: 30 };
export const INTEGRITY = ['pending', 'clear', 'note', 'invalid'] as const;
export type Integrity = (typeof INTEGRITY)[number];
export const INTEGRITY_AR: Record<Integrity, string> = { pending: 'قيد المراجعة', clear: 'سليم', note: 'ملاحظة', invalid: 'لاغٍ' };
export const INTEGRITY_EN: Record<Integrity, string> = { pending: 'Under review', clear: 'Clear', note: 'Noted', invalid: 'Annulled' };
export const isIntegrity = (v: unknown): v is Integrity => typeof v === 'string' && (INTEGRITY as readonly string[]).includes(v);

/** فاصل اللقطات بالثواني: مخصّص (20–90) أو الافتراضي للوضع */
export function intervalFor(mode: unknown, custom?: unknown): number {
  const m = isWitnessMode(mode) ? mode : 'room'; if (m === 'room') return 0;
  const n = Number(custom); return Number.isInteger(n) && n >= 20 && n <= 90 ? n : DEFAULT_INTERVAL[m];
}
/** ما يُعلَن للمتقدّم قبل البدء */
export function witnessPublic(row: { proctor_mode?: string | null; witness_interval?: number | null } | null | undefined) {
  const mode = isWitnessMode(row?.proctor_mode) ? row!.proctor_mode as WitnessMode : 'room';
  return { mode, camera: usesCamera(mode), interval: intervalFor(mode, row?.witness_interval), identity: mode === 'remote', fullscreen: mode === 'remote', retention_days: RETENTION_DAYS, title_ar: WITNESS_TITLE.ar, title_en: WITNESS_TITLE.en, mode_ar: WITNESS_MODE_AR[mode], mode_en: WITNESS_MODE_EN[mode] };
}

/** التحقّق من لقطة JPEG صغيرة (base64) */
export function decodeFrame(b64: unknown): { ok: true; buf: Buffer } | { ok: false; error: string } {
  if (typeof b64 !== 'string' || !b64) return { ok: false, error: 'frame_empty' };
  const raw = b64.replace(/^data:image\/jpeg;base64,/, ''); if (raw.length > FRAME_MAX_BYTES * 1.4) return { ok: false, error: 'frame_too_big' };
  let buf: Buffer; try { buf = Buffer.from(raw, 'base64'); } catch { return { ok: false, error: 'frame_bad' }; }
  if (buf.length < 200 || buf.length > FRAME_MAX_BYTES) return { ok: false, error: buf.length < 200 ? 'frame_bad' : 'frame_too_big' };
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return { ok: false, error: 'frame_not_jpeg' };
  return { ok: true, buf };
}
export const framePath = (sessionId: string, seq: number, kind: string) => `witness/${sessionId}/${String(seq).padStart(4, '0')}-${kind}.jpg`;

/** تنظيف meta القادم من المتصفح: أرقام ونصوص قصيرة فقط */
export function cleanMeta(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== 'object') return {}; const out: Record<string, unknown> = {}; let n = 0;
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    if (n >= 8 || !/^[a-z_]{1,24}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100; else if (typeof v === 'string') out[k] = v.slice(0, 80); else if (typeof v === 'boolean') out[k] = v; else continue;
    n += 1;
  }
  return out;
}

export type WitnessEvent = { id?: string; session_id: string; invite_id?: string | null; seq: number; kind: EventKind; at: string; media_path: string | null; meta: Record<string, any> };

/** ملخّص المؤشّرات — ثلاثة مستويات هادئة: calm (لا شيء يلفت) · watch (إشارات قليلة) · review (يستحق نظرة بشرية) */
export function integritySummary(events: readonly WitnessEvent[]) {
  const c = { frames: 0, identity: 0, tab_hidden: 0, hidden_seconds: 0, focus_lost: 0, fullscreen_exit: 0, camera_lost: 0, still_frame: 0, screen_extended: 0, paste: 0, sections: 0, whispers: 0 };
  let last_frame_at: string | null = null; let first_at: string | null = null; let last_at: string | null = null;
  for (const e of events) {
    if (!first_at || e.at < first_at) first_at = e.at; if (!last_at || e.at > last_at) last_at = e.at;
    if (e.media_path || e.kind === 'frame') { c.frames += 1; if (!last_frame_at || e.at > last_frame_at) last_frame_at = e.at; }
    if (e.kind === 'identity_frame') c.identity += 1;
    else if (e.kind === 'tab_hidden') { c.tab_hidden += 1; c.hidden_seconds += Math.max(0, Number(e.meta?.seconds) || 0); }
    else if (e.kind === 'focus_lost') c.focus_lost += 1; else if (e.kind === 'fullscreen_exit') c.fullscreen_exit += 1; else if (e.kind === 'camera_lost') c.camera_lost += 1;
    else if (e.kind === 'still_frame') c.still_frame += 1; else if (e.kind === 'screen_extended') c.screen_extended += 1; else if (e.kind === 'paste') c.paste += 1;
    else if (e.kind === 'section_start') c.sections += 1; else if (e.kind === 'whisper') c.whispers += 1;
  }
  c.hidden_seconds = Math.round(c.hidden_seconds);
  const signals = c.tab_hidden + c.focus_lost + c.fullscreen_exit + c.camera_lost + c.still_frame + c.screen_extended + c.paste;
  const level: 'calm' | 'watch' | 'review' = c.hidden_seconds > 60 || c.tab_hidden >= 3 || c.camera_lost >= 3 || c.screen_extended > 0 || c.still_frame >= 2 || c.paste >= 2 ? 'review' : signals > 0 ? 'watch' : 'calm';
  const reasons_ar: string[] = [];
  if (c.hidden_seconds > 60) reasons_ar.push(`غادر اللسان ${c.hidden_seconds} ثانية مجتمعة`); if (c.tab_hidden >= 3) reasons_ar.push(`غادر اللسان ${c.tab_hidden} مرات`);
  if (c.camera_lost >= 3) reasons_ar.push(`انقطعت الكاميرا ${c.camera_lost} مرات`); if (c.screen_extended > 0) reasons_ar.push('اكتُشفت شاشة ثانية'); if (c.still_frame >= 2) reasons_ar.push('فترات بلا حركة أمام الكاميرا'); if (c.paste >= 2) reasons_ar.push(`لصق نصّ ${c.paste} مرات في الكتابة`);
  return { ...c, signals, level, level_ar: level === 'calm' ? 'هادئ' : level === 'watch' ? 'إشارات' : 'يستحق المراجعة', reasons_ar, first_at, last_at, last_frame_at };
}

/* ---------- التخزين ---------- */
async function countsFor(db: Db, sessionId: string): Promise<{ events: number; frames: number; seq: number }> {
  const { data } = await db.from('miaar_witness_events').select('seq, media_path').eq('session_id', sessionId); const rows = (data || []) as any[];
  return { events: rows.length, frames: rows.filter((r) => r.media_path).length, seq: rows.reduce((m, r) => Math.max(m, Number(r.seq) || 0), 0) };
}

export type RecordInput = { kind: unknown; meta?: unknown; frame?: unknown };
/** تسجيل حدث من متصفح المتقدّم (داخل جلسة حيّة) — يرفض ما لا يناسب الوضع ويحترم الحدود */
export async function recordEvent(db: Db, session: { id: string; invite_id: string | null; status: string }, invite: { proctor_mode?: string | null } | null, input: RecordInput): Promise<{ ok: true; seq: number; frames: number; stored: boolean } | { ok: false; error: string; status: number }> {
  if (!isEventKind(input.kind) || !CLIENT_KINDS.includes(input.kind)) return { ok: false, error: 'witness_bad_kind', status: 400 };
  const mode = isWitnessMode(invite?.proctor_mode) ? invite!.proctor_mode as WitnessMode : 'room';
  const wantsFrame = typeof input.frame === 'string' && input.frame.length > 0;
  if (wantsFrame && !usesCamera(mode)) return { ok: false, error: 'witness_no_camera_mode', status: 400 };
  if (input.kind === 'identity_frame' && mode !== 'remote') return { ok: false, error: 'witness_identity_not_required', status: 400 };
  const cnt = await countsFor(db, session.id);
  if (cnt.events >= EVENTS_MAX) return { ok: true, seq: cnt.seq, frames: cnt.frames, stored: false };
  const seq = cnt.seq + 1; let media_path: string | null = null;
  if (wantsFrame && cnt.frames < FRAMES_MAX) {
    const f = decodeFrame(input.frame); if (!f.ok) return { ok: false, error: `witness_${f.error}`, status: f.error === 'frame_too_big' ? 413 : 400 };
    const path = framePath(session.id, seq, input.kind);
    const up = await db.storage.from(MEDIA_BUCKET).upload(path, f.buf, { contentType: 'image/jpeg', upsert: true }); if (!up.error) media_path = path;
  }
  const meta = cleanMeta(input.meta); if (wantsFrame && !media_path) meta.frame_dropped = true;
  const ins = await db.from('miaar_witness_events').insert({ session_id: session.id, invite_id: session.invite_id, seq, kind: input.kind, at: nowIso(), media_path, meta });
  if (ins.error) return { ok: false, error: 'witness_save_failed', status: 500 };
  return { ok: true, seq, frames: cnt.frames + (media_path ? 1 : 0), stored: true };
}

/** همسات المراقب بعد لحظة معيّنة — يستدعيها المتصفح كل ~20 ث */
export async function whispersSince(db: Db, sessionId: string, since: unknown): Promise<Array<{ at: string; text: string }>> {
  const s = typeof since === 'string' && !Number.isNaN(Date.parse(since)) ? since : new Date(0).toISOString();
  const { data } = await db.from('miaar_witness_events').select('at, meta').eq('session_id', sessionId).eq('kind', 'whisper').gt('at', s).order('at', { ascending: true }).limit(10);
  return ((data || []) as any[]).map((r) => ({ at: r.at, text: String(r.meta?.text || '') })).filter((w) => w.text);
}
/** «همسة المراقب»: سطر هادئ يظهر للمتقدّم — لا إيقاف ولا إنذار آلي */
export async function sendWhisper(db: Db, sessionId: string, text: unknown, by: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const t = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ').slice(0, WHISPER_MAX) : ''; if (t.length < 2) return { ok: false, error: 'اكتب همسة من حرفين على الأقل' };
  const { data: s } = await db.from('placement_secure_sessions').select('id, status, invite_id').eq('id', sessionId).maybeSingle(); if (!s) return { ok: false, error: 'الجلسة غير موجودة' };
  if (s.status !== 'active') return { ok: false, error: 'الجلسة انتهت — الهمسة لمن يختبر الآن' };
  const cnt = await countsFor(db, sessionId);
  const ins = await db.from('miaar_witness_events').insert({ session_id: sessionId, invite_id: s.invite_id, seq: cnt.seq + 1, kind: 'whisper', at: nowIso(), media_path: null, meta: { text: t, by } });
  return ins.error ? { ok: false, error: 'تعذّر الإرسال' } : { ok: true, text: t };
}

/** «حكم الشاهد» — يوقّعه إنسان: سليم / ملاحظة / لاغٍ (يحجب الشهادة) */
export async function setVerdict(db: Db, reportId: string, status: unknown, note: unknown, by: { id: string; email: string }): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  if (!isIntegrity(status) || status === 'pending') return { ok: false, error: 'اختر الحكم: سليم أو ملاحظة أو لاغٍ' };
  const n = typeof note === 'string' ? note.trim().slice(0, 500) : '';
  if ((status === 'note' || status === 'invalid') && n.length < 3) return { ok: false, error: status === 'invalid' ? 'الإبطال يحتاج سببًا مكتوبًا' : 'اكتب الملاحظة' };
  const { data: rep } = await db.from('placement_reports').select('id, submission_id, report, integrity_status').eq('id', reportId).maybeSingle(); if (!rep) return { ok: false, error: 'التقرير غير موجود' };
  const at = nowIso(); const patch = { integrity_status: status, integrity_note: n || null, integrity_by: by.email || by.id, integrity_at: at };
  const up = await db.from('placement_reports').update(patch).eq('id', reportId).select('id, submission_id, candidate_email, access_code, integrity_status, integrity_note, integrity_by, integrity_at').maybeSingle();
  if (up.error) return { ok: false, error: 'تعذّر الحفظ' };
  if (rep.submission_id) { const cnt = await countsFor(db, rep.submission_id); await db.from('miaar_witness_events').insert({ session_id: rep.submission_id, invite_id: null, seq: cnt.seq + 1, kind: 'verdict', at, media_path: null, meta: { status, note: n, by: by.email || by.id, previous: rep.integrity_status || null } }); }
  return { ok: true, report: up.data };
}

/** كتلة «نزاهة» للبطاقة والشهادة والجهة (بلا صور ولا أسماء موقّعين للعلن) */
export function integrityBlock(row: { integrity_status?: string | null; integrity_note?: string | null; integrity_at?: string | null } | null | undefined) {
  const st = isIntegrity(row?.integrity_status) ? row!.integrity_status as Integrity : null; if (!st) return null;
  return { الحالة: st, الحالة_ar: INTEGRITY_AR[st], status_en: INTEGRITY_EN[st], ملاحظة: st === 'note' || st === 'invalid' ? row?.integrity_note || null : null, في: row?.integrity_at || null, مصوَّرة: true };
}

/* ---------- القراءة للطاقم ---------- */
async function signAll(db: Db, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>(); if (!paths.length) return out;
  try { const r = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 600); if (!r.error && Array.isArray(r.data)) for (const row of r.data as any[]) if (row?.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl); } catch { /* بلا صور */ }
  return out;
}
export async function eventsFor(db: Db, sessionId: string): Promise<WitnessEvent[]> {
  const { data } = await db.from('miaar_witness_events').select('id, session_id, invite_id, seq, kind, at, media_path, meta').eq('session_id', sessionId).order('at', { ascending: true }).limit(EVENTS_MAX + 20);
  return (data || []) as WitnessEvent[];
}
/** «غرفة الشاهد»: الخطّ الزمني الكامل لجلسة — لقطات موقَّعة 10 دقائق + أحداث + ملخّص + الحكم */
export async function timelineFor(db: Db, sessionId: string) {
  const { data: s } = await db.from('placement_secure_sessions').select('id, candidate, status, created_at, finished_at, invite_id, report').eq('id', sessionId).maybeSingle(); if (!s) return null;
  const [events, { data: rep }, { data: inv }] = await Promise.all([
    eventsFor(db, sessionId),
    db.from('placement_reports').select('id, access_code, integrity_status, integrity_note, integrity_by, integrity_at, source').eq('submission_id', sessionId).maybeSingle(),
    s.invite_id ? db.from('placement_invites').select('id, code, label_ar, level_target, proctor_mode, witness_interval, client_name, service_mode').eq('id', s.invite_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const urls = await signAll(db, events.map((e) => e.media_path).filter(Boolean) as string[]);
  const frames = events.filter((e) => e.media_path).map((e) => ({ id: e.id, seq: e.seq, kind: e.kind, at: e.at, url: urls.get(e.media_path as string) || null, meta: e.meta }));
  const marks = events.filter((e) => !e.media_path && e.kind !== 'frame').map((e) => ({ id: e.id, seq: e.seq, kind: e.kind, kind_ar: EVENT_AR[e.kind] || e.kind, at: e.at, meta: e.meta }));
  const identity = frames.find((f) => f.kind === 'identity_frame') || null;
  const summary = integritySummary(events);
  const exit = (s.report as any)?.exit || null;
  return {
    session: { id: s.id, status: s.status, started_at: s.created_at, finished_at: s.finished_at, name: String(s.candidate?.name || ''), email: String(s.candidate?.email || ''), id_number: s.candidate?.idNumber ? String(s.candidate.idNumber) : null },
    invite: inv ? { id: inv.id, code: inv.code, label_ar: inv.label_ar, level: inv.level_target, mode: isWitnessMode(inv.proctor_mode) ? inv.proctor_mode : 'room', mode_ar: WITNESS_MODE_AR[(isWitnessMode(inv.proctor_mode) ? inv.proctor_mode : 'room') as WitnessMode], client_name: inv.service_mode === 'external' ? inv.client_name : null } : null,
    report: rep ? { id: rep.id, access_code: rep.access_code, integrity_status: rep.integrity_status, integrity_note: rep.integrity_note, integrity_by: rep.integrity_by, integrity_at: rep.integrity_at, source: rep.source } : null,
    exit: exit ? { الحالة: exit.الحالة, النتيجة: exit.النتيجة, الكلي: exit.الكلي, تقدير_ar: exit.تقدير_ar } : null,
    frames, marks, identity, summary, retention_days: RETENTION_DAYS, integrity_ar: INTEGRITY_AR, title: WITNESS_TITLE, at: nowIso(),
  };
}
/** للوحة الحيّة: آخر لقطة ومستوى الإشارات لكل جلسة في الدعوة (استعلام واحد + توقيع جماعي) */
export async function liveFor(db: Db, sessionIds: string[]): Promise<Record<string, { level: string; level_ar: string; signals: number; frames: number; last_frame_at: string | null; last_frame_url: string | null; camera: 'on' | 'off' | 'none'; counters: Record<string, number> }>> {
  const out: Record<string, any> = {}; const ids = sessionIds.filter(Boolean).slice(0, 200); if (!ids.length) return out;
  const { data } = await db.from('miaar_witness_events').select('session_id, seq, kind, at, media_path, meta').in('session_id', ids).order('at', { ascending: false }).limit(4000);
  const by = new Map<string, WitnessEvent[]>(); for (const e of (data || []) as WitnessEvent[]) { const a = by.get(e.session_id) || []; a.push(e); by.set(e.session_id, a); }
  const lastPaths: string[] = []; const lastOf = new Map<string, string>();
  for (const [sid, evs] of by) { const lf = evs.find((e) => e.media_path); if (lf?.media_path) { lastOf.set(sid, lf.media_path); lastPaths.push(lf.media_path); } }
  const urls = await signAll(db, lastPaths);
  for (const sid of ids) {
    const evs = by.get(sid) || []; const s = integritySummary(evs); const lastCam = evs.find((e) => e.kind === 'camera_lost' || e.kind === 'camera_back' || e.media_path);
    const camera: 'on' | 'off' | 'none' = !evs.some((e) => e.media_path) ? 'none' : lastCam?.kind === 'camera_lost' ? 'off' : 'on';
    out[sid] = { level: s.level, level_ar: s.level_ar, signals: s.signals, frames: s.frames, last_frame_at: s.last_frame_at, last_frame_url: lastOf.has(sid) ? urls.get(lastOf.get(sid) as string) || null : null, camera, counters: { tab_hidden: s.tab_hidden, focus_lost: s.focus_lost, fullscreen_exit: s.fullscreen_exit, camera_lost: s.camera_lost, still_frame: s.still_frame, paste: s.paste, hidden_seconds: s.hidden_seconds } };
  }
  return out;
}
/** حذف الصور بعد 90 يومًا — كسولًا عند فتح غرفة الشاهد (بلا كرون)؛ الأحداث والحكم يبقيان */
export async function purgeExpiredFrames(db: Db, limit = 50): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();
  const { data } = await db.from('miaar_witness_events').select('id, media_path').not('media_path', 'is', null).lt('at', cutoff).limit(limit); const rows = (data || []) as { id: string; media_path: string }[];
  if (!rows.length) return { purged: 0 };
  try { await db.storage.from(MEDIA_BUCKET).remove(rows.map((r) => r.media_path)); } catch { /* نكمل: التصفير يمنع أي رابط جديد */ }
  let purged = 0; for (const r of rows) { const up = await db.from('miaar_witness_events').update({ media_path: null, meta: { purged_at: nowIso() } }).eq('id', r.id); if (!up.error) purged += 1; }
  return { purged };
}
/** حذف كل آثار جلسة (يُستدعى من حذف النتيجة الفوري في السجلّ) */
export async function deleteWitness(db: Db, sessionId: string): Promise<void> {
  const { data } = await db.from('miaar_witness_events').select('media_path').eq('session_id', sessionId).not('media_path', 'is', null); const paths = ((data || []) as any[]).map((r) => r.media_path).filter(Boolean);
  if (paths.length) { try { await db.storage.from(MEDIA_BUCKET).remove(paths); } catch { /* المخزن قد يكون فارغًا */ } }
  await db.from('miaar_witness_events').delete().eq('session_id', sessionId);
}
