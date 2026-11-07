// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P53 «ردّ على الكلمة» — صوت المتعلّم يعود إلى المدرّب · الاسم الرسمي: «ردود المتعلّمين على رسائل المدرّب» / Learner replies to trainer notes
 *  - تحت كل «كلمة» (إشعار trainer_word من P51) ثلاث «لمسات» (🌱 وصلت · ✋ أحتاج مساعدة · 🕐 سأحضر) + سطر اختياري ≤ 200 حرف.
 *  - ردّ واحد لكل كلمة؛ يُعدَّل خلال ساعة ثم يثبت. يصل إلى المدرّب وحده: «دفتر اليوم» (/me/day#replies) + إشعار 🗨️ مجمَّع (مرّة في الساعة كحدّ أقصى).
 *  - لا يُستعمل الردّ في أي تقييم أو درجة. من ضغط ✋ يُرتَّب أولًا — ترتيب لا إنذار. لا يرى متعلّم ردود غيره.
 *  الجزء الصرف: CHIPS · cleanReply · chipOf · parseWordNotice · summarizeReplies · trainerNoticeText · repliesLine — الغراء: submitReply · collectReplies · markRepliesSeen · myReplies · repliesYesterday
 *  P54 «أمانة صوتية» (ردّ صوتي للمتعلّم على رسالة المدرّب / Learner voice reply): 15 ثانية في الدلو الخاص athar-media تحت word-voice/… ·
 *    تُحفَظ في meta.voice للردّ نفسه (ردّ واحد لكل كلمة) · يسمعها المدرّب وحده برابط موقَّع · نصّ تقريبي اختياري من المتصفّح · تُحذف مع الردّ (180 يومًا).
 *    + «✋ ثلاث مرّات»: من رفع يده ثلاثًا في أسبوع يُوسَم في الدفتر ويُذكر في النبض — بلا تخزين.
 */
import { riyadhDate } from '../miaar/practice';

type Db = any;
export const REPLY_TITLE = { ar: 'ردّ على الكلمة', en: 'Reply to the note' } as const;
export const REPLY_OFFICIAL = { ar: 'ردود المتعلّمين على رسائل المدرّب', en: 'Learner replies to trainer notes' } as const;
export const REPLY_MAX = 200;
export const EDIT_WINDOW_MIN = 60;            /* يُعدَّل الردّ خلال ساعة من إرساله */
export const REPLIES_PER_HOUR = 30;           /* حدّ المتعلّم */
export const TRAINER_NOTICE_BUCKET_MIN = 60;  /* إشعار المدرّب مجمَّع: مرّة كل ساعة كحدّ أقصى */
export const REPLIES_WINDOW_DAYS = 14;        /* ما يظهر في دفتر اليوم */
export const REPLIES_PATH = '/me/day#replies';
/* P54 «أمانة صوتية» */
export const VOICE_TITLE = { ar: 'أمانة صوتية', en: 'Voice note' } as const;
export const VOICE_OFFICIAL = { ar: 'ردّ صوتي للمتعلّم على رسالة المدرّب', en: 'Learner voice reply to trainer note' } as const;
export const VOICE_LIMITS = { maxSeconds: 15, maxBytes: 512 * 1024, perHour: 10, transcriptMax: 300, signedSeconds: 300, bucket: 'athar-media', prefix: 'word-voice' } as const;
export const VOICE_MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'] as const;
export const HANDS_WEEK_DAYS = 7; export const HANDS_WEEK_MIN = 3;
export type VoiceMeta = { path: string; sec: number; bytes: number; mime: string; at: string };

export type ChipKey = 'got_it' | 'need_help' | 'will_attend';
export type Chip = { key: ChipKey; icon: string; label_ar: string; label_en: string };
/** «اللمسات» — ردّ بلا كتابة (للجوّال ولمن لا يحبّ الكتابة) */
export const CHIPS: readonly Chip[] = [
  { key: 'got_it', icon: '🌱', label_ar: 'وصلت، شكرًا', label_en: 'Got it, thanks' },
  { key: 'need_help', icon: '✋', label_ar: 'أحتاج مساعدة', label_en: 'I need help' },
  { key: 'will_attend', icon: '🕐', label_ar: 'سأحضر الجلسة القادمة', label_en: 'I will attend the next session' },
] as const;

export type ReplyRow = { id: string; created_at: string; updated_at: string; notice_id: string; trainer_id: string; classroom_id: string | null; learner_email: string; learner_name: string | null; chip: ChipKey | null; text: string | null; seen_at: string | null; meta: Record<string, unknown> };
/* ---------- P54 صرف: الصوت ---------- */
export const voiceBase = (mime: string): string => String(mime || '').split(';')[0].trim().toLowerCase();
export function voiceExt(mime: string): string { const b = voiceBase(mime); return b === 'audio/mp4' ? 'm4a' : b === 'audio/ogg' ? 'ogg' : b === 'audio/mpeg' ? 'mp3' : b === 'audio/wav' ? 'wav' : 'webm'; }
/** التحقّق من أمانة صوتية: صيغة صوت معروفة · ≤ 15 ث · ≤ 512 ك.ب · ليست فارغة */
export function validateVoice(input: { mime: string; bytes: number; sec: number }): { ok: true; mime: string; ext: string; sec: number } | { ok: false; error: string } {
  const mime = voiceBase(input.mime); if (!(VOICE_MIMES as readonly string[]).includes(mime)) return { ok: false, error: 'صيغة الصوت غير مدعومة (webm · m4a · ogg · mp3 · wav)' };
  const bytes = Number(input.bytes) || 0; if (bytes < 200) return { ok: false, error: 'التسجيل فارغ — أعِد المحاولة' }; if (bytes > VOICE_LIMITS.maxBytes) return { ok: false, error: `التسجيل أكبر من ${Math.round(VOICE_LIMITS.maxBytes / 1024)} ك.ب` };
  const sec = Math.round(Number(input.sec) || 0); if (sec < 1) return { ok: false, error: 'التسجيل أقصر من ثانية' }; if (sec > VOICE_LIMITS.maxSeconds + 1) return { ok: false, error: `الأمانة الصوتية ${VOICE_LIMITS.maxSeconds} ثانية كحدّ أقصى` };
  return { ok: true, mime, ext: voiceExt(mime), sec: Math.min(sec, VOICE_LIMITS.maxSeconds) };
}
/** مسار الملف في الدلو الخاص: word-voice/<trainer>/<id>.<ext> — المدرّب في المسار ليسهل التحقّق والتنظيف */
export function voicePath(trainerId: string, id: string, ext: string): string { return `${VOICE_LIMITS.prefix}/${String(trainerId).replace(/[^0-9a-zA-Z-]/g, '')}/${String(id).replace(/[^0-9a-zA-Z-]/g, '')}.${ext}`; }
export function voiceOf(meta: unknown): VoiceMeta | null { const v = meta && typeof meta === 'object' ? (meta as any).voice : null; return v && typeof v.path === 'string' && v.path.startsWith(`${VOICE_LIMITS.prefix}/`) ? { path: v.path, sec: Number(v.sec) || 0, bytes: Number(v.bytes) || 0, mime: String(v.mime || ''), at: String(v.at || '') } : null; }
export function transcriptOf(meta: unknown): string | null { const t = meta && typeof meta === 'object' ? (meta as any).transcript : null; return typeof t === 'string' && t.trim() ? t : null; }
/** النصّ التقريبي من متصفّح المتعلّم: تنقية كالسطر لكن أطول (≤ 300) */
export function cleanTranscript(v: unknown): string { return String(v ?? '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, VOICE_LIMITS.transcriptMax); }
export const fmtSec = (sec: number): string => { const s = Math.max(0, Math.round(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/* ---------- صرف ---------- */
const norm = (e: unknown) => String(e || '').trim().toLowerCase();
const arr = (d: unknown): any[] => (Array.isArray(d) ? d : []);
/** تنقية السطر: لا وسوم، لا روابط، لا بريد، مسافات مفردة، ≤ 200 حرف */
export function cleanReply(v: unknown): string { return String(v ?? '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\S+@\S+\.\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, REPLY_MAX); }
export function chipOf(v: unknown): ChipKey | null { const k = String(v || ''); return (CHIPS as readonly Chip[]).some((c) => c.key === k) ? (k as ChipKey) : null; }
export const chipLabel = (k: ChipKey | null): string => { const c = CHIPS.find((x) => x.key === k); return c ? `${c.icon} ${c.label_ar}` : ''; };
/** من إشعار «كلمة»: المدرّب من مفتاح التفرّد trainer_word:<tid>:<email>:<day> · الشعبة من ref_id */
export function parseWordNotice(n: { kind?: string; dedupe_key?: string | null; ref_id?: string | null }): { trainer_id: string; classroom_id: string | null } | null {
  if (!n || n.kind !== 'trainer_word') return null; const parts = String(n.dedupe_key || '').split(':'); if (parts[0] !== 'trainer_word' || !parts[1]) return null;
  return { trainer_id: parts[1], classroom_id: n.ref_id ? String(n.ref_id) : null };
}
export type ReplyView = { id: string; email: string; name: string; chip: ChipKey | null; chip_ar: string; text: string | null; at: string; seen: boolean; notice_id: string; voice: { sec: number } | null; transcript: string | null; hands_week: number };
export type ReplySummary = { total: number; need_help: number; unseen: number; voice: number; by_chip: Record<ChipKey, number>; items: ReplyView[] };
/** تجميع ردود شعبة: ✋ أولًا ثم الأحدث · عدّادات */
export function summarizeReplies(rows: ReplyRow[], names: Map<string, string> = new Map(), hands: Map<string, number> = new Map()): ReplySummary {
  const by_chip: Record<ChipKey, number> = { got_it: 0, need_help: 0, will_attend: 0 }; let unseen = 0; let voice = 0;
  const items: ReplyView[] = rows.map((r) => { if (r.chip) by_chip[r.chip] += 1; if (!r.seen_at) unseen += 1; const e = norm(r.learner_email); const v = voiceOf(r.meta); if (v) voice += 1;
    return { id: r.id, email: e, name: r.learner_name || names.get(e) || '', chip: r.chip, chip_ar: chipLabel(r.chip), text: r.text || null, at: r.updated_at || r.created_at, seen: !!r.seen_at, notice_id: r.notice_id, voice: v ? { sec: v.sec } : null, transcript: transcriptOf(r.meta), hands_week: hands.get(e) || 0 }; });
  /* ✋ أولًا · ثم الصوت قبل النصّ (P54) · ثم الأحدث */
  items.sort((a, b) => Number(b.chip === 'need_help') - Number(a.chip === 'need_help') || Number(!!b.voice) - Number(!!a.voice) || Date.parse(b.at) - Date.parse(a.at));
  return { total: rows.length, need_help: by_chip.need_help, unseen, voice, by_chip, items };
}
/** «✋ ثلاث مرّات»: عدّ رفع اليد لكل متعلّم خلال 7 أيام (من صفوف الردود) */
export function handsByLearner(rows: Pick<ReplyRow, 'learner_email' | 'chip' | 'updated_at' | 'created_at'>[], now: Date): Map<string, number> {
  const since = now.getTime() - HANDS_WEEK_DAYS * 86400000; const m = new Map<string, number>();
  for (const r of rows) { if (r.chip !== 'need_help') continue; const t = Date.parse(r.updated_at || r.created_at); if (!(t >= since)) continue; const e = norm(r.learner_email); m.set(e, (m.get(e) || 0) + 1); }
  return m;
}
export const hands3Count = (hands: Map<string, number>): number => [...hands.values()].filter((n) => n >= HANDS_WEEK_MIN).length;
export function hands3Line(n: number): string { return n ? `${n === 1 ? 'متعلّم واحد رفع يده' : n === 2 ? 'متعلّمان رفعا أيديهما' : `${n} متعلّمين رفعوا أيديهم`} ثلاثًا هذا الأسبوع — كلمة منك تكفي` : ''; }
const nAr = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
/** نصّ إشعار المدرّب المجمَّع */
export function trainerNoticeText(count: number, needHelp: number, voices = 0): { title_ar: string; body_ar: string; url: string } {
  const vo = voices ? (voices === 1 ? '، ومنهم من ترك لك صوتًا 🎙️' : `، و${voices === 2 ? 'اثنان تركا' : `${voices} تركوا`} لك أصواتًا 🎙️`) : ''; /* P54 */
  return { title_ar: `${nAr(count, 'ردّ جديد', 'ردّان جديدان', 'ردود جديدة', 'ردًّا جديدًا')} على كلمتك`, body_ar: needHelp ? `${nAr(needHelp, 'متعلّم واحد يرفع يده', 'متعلّمان يرفعان أيديهما', 'متعلّمين يرفعون أيديهم', 'متعلّمًا يرفعون أيديهم')}${vo} — افتح دفتر اليوم لتراهم أولًا.` : `افتح «دفتر اليوم» لتقرأها${vo} — ردودهم لك وحدك.`, url: REPLIES_PATH };
}
/** سطر موجز الصباح 📒 */
export function repliesLine(replies: number, needHelp: number, voices = 0): string { return replies ? `ردود أمس ${replies}${needHelp ? ` · ✋ ${needHelp}` : ''}${voices ? ` · 🎙️ ${voices}` : ''}` : ''; }
export const hourBucket = (now: Date): string => new Date(Math.floor(now.getTime() / (TRAINER_NOTICE_BUCKET_MIN * 60000)) * TRAINER_NOTICE_BUCKET_MIN * 60000).toISOString().slice(0, 13);

/* ---------- غراء ---------- */
export type ReplyMe = { email: string; name?: string | null };
export type SubmitResult = { row: ReplyRow; created: boolean; notified: boolean; replaced_voice?: string | null } | { error: string; status: number };
/** ردّ المتعلّم: الإشعار له ونوعه «كلمة» · لمسة أو سطر · يُعدَّل خلال ساعة · إشعار مجمَّع للمدرّب */
export async function submitReply(db: Db, me: ReplyMe, input: { notice_id: string; chip?: unknown; text?: unknown; voice?: VoiceMeta | null; transcript?: unknown }, opts: { now?: Date; dry?: boolean } = {}): Promise<SubmitResult> {
  const now = opts.now || new Date(); const email = norm(me.email); const nid = String(input.notice_id || ''); if (!nid) return { error: 'حدّد الكلمة', status: 400 };
  const chip = chipOf(input.chip); const text = cleanReply(input.text); const voice = input.voice || null; if (!chip && !text && !voice) return { error: 'اختر لمسة أو اكتب سطرًا أو سجّل صوتًا', status: 400 };
  if (String(input.text || '').length > REPLY_MAX * 3) return { error: `السطر أطول من ${REPLY_MAX} حرفًا`, status: 400 };
  const { data: n } = await db.from('portal_learner_notices').select('id, email, kind, ref_id, dedupe_key, created_at').eq('id', nid).maybeSingle();
  if (!n || norm(n.email) !== email) return { error: 'هذه الكلمة ليست لك', status: 404 };
  const w = parseWordNotice(n); if (!w) return { error: 'الردّ متاح على «كلمة» المدرّب فقط', status: 400 };
  const { data: ex } = await db.from('portal_word_replies').select('*').eq('notice_id', nid).eq('learner_email', email).maybeSingle();
  if (ex && now.getTime() - Date.parse(ex.created_at) > EDIT_WINDOW_MIN * 60000) return { error: 'ثبت ردّك — يُعدَّل خلال ساعة من إرساله فقط', status: 409 };
  // تعديل بسطر فقط يُبقي اللمسة السابقة (لا تُمحى إلا باختيار لمسة أخرى)
  /* P54: الصوت والنصّ التقريبي في meta — صوت جديد يحلّ محلّ القديم (المسار القديم يعود في replaced_voice ليحذفه المستدعي) · سطر/لمسة فقط لا يمسّان الصوت */
  const exVoice = voiceOf(ex?.meta); const tr = input.transcript === undefined ? undefined : cleanTranscript(input.transcript) || null;
  const meta: Record<string, unknown> = { ...((ex?.meta && typeof ex.meta === 'object') ? ex.meta : {}) }; if (voice) { meta.voice = voice; meta.transcript = tr ?? null; } else if (tr !== undefined && exVoice) meta.transcript = tr;
  const payload = { chip: chip || (ex?.chip ? chipOf(ex.chip) : null), text: text || (voice && !chip ? ex?.text || null : null) /* صوت وحده = إضافة لا تمسّ السطر؛ وإلا سلوك P53 */, updated_at: now.toISOString(), learner_name: me.name || ex?.learner_name || null, meta };
  if (opts.dry) return { row: { ...(ex || { id: 'dry', created_at: now.toISOString(), notice_id: nid, trainer_id: w.trainer_id, classroom_id: w.classroom_id, learner_email: email, seen_at: null, meta: {} }), ...payload } as ReplyRow, created: !ex, notified: false, replaced_voice: voice && exVoice && exVoice.path !== voice.path ? exVoice.path : null };
  let row: ReplyRow;
  if (ex) { const { data, error } = await db.from('portal_word_replies').update({ ...payload, seen_at: null }).eq('id', ex.id).select('*').single(); if (error) return { error: error.message, status: 500 }; row = data as ReplyRow; }
  else { const { data, error } = await db.from('portal_word_replies').insert({ notice_id: nid, trainer_id: w.trainer_id, classroom_id: w.classroom_id, learner_email: email, created_at: now.toISOString(), ...payload }).select('*').single(); if (error) return { error: error.message, status: 500 }; row = data as ReplyRow; }
  const notified = await notifyTrainer(db, w.trainer_id, now).catch(() => false);
  return { row, created: !ex, notified, replaced_voice: voice && exVoice && exVoice.path !== voice.path ? exVoice.path : null };
}
/** P54: الكلمة ومدرّبها للمتعلّم (قبل رفع الصوت نحتاج المدرّب للمسار) */
export async function resolveWordForLearner(db: Db, email: string, noticeId: string): Promise<{ trainer_id: string; classroom_id: string | null; existing: ReplyRow | null } | { error: string; status: number }> {
  const nid = String(noticeId || ''); if (!nid) return { error: 'حدّد الكلمة', status: 400 };
  const { data: n } = await db.from('portal_learner_notices').select('id, email, kind, ref_id, dedupe_key, created_at').eq('id', nid).maybeSingle();
  if (!n || norm(n.email) !== norm(email)) return { error: 'هذه الكلمة ليست لك', status: 404 };
  const w = parseWordNotice(n); if (!w) return { error: 'الأمانة الصوتية على «كلمة» المدرّب فقط', status: 400 };
  const { data: ex } = await db.from('portal_word_replies').select('*').eq('notice_id', nid).eq('learner_email', norm(email)).maybeSingle();
  return { ...w, existing: (ex as ReplyRow) || null };
}
/** P54: حذف الأمانة الصوتية من الردّ (خلال ساعة) — إن لم يبقَ لمسة ولا سطر يُحذف الردّ كلّه؛ يعيد مسار الملف ليحذفه المستدعي من المخزن */
export async function removeVoice(db: Db, me: ReplyMe, noticeId: string, opts: { now?: Date } = {}): Promise<{ path: string; row_deleted: boolean } | { error: string; status: number }> {
  const now = opts.now || new Date(); const { data: ex } = await db.from('portal_word_replies').select('*').eq('notice_id', String(noticeId || '')).eq('learner_email', norm(me.email)).maybeSingle();
  const v = voiceOf(ex?.meta); if (!ex || !v) return { error: 'لا أمانة صوتية على هذه الكلمة', status: 404 };
  if (now.getTime() - Date.parse(ex.created_at) > EDIT_WINDOW_MIN * 60000) return { error: 'ثبت ردّك — يُحذف الصوت خلال ساعة من إرساله فقط', status: 409 };
  if (!ex.chip && !ex.text) { await db.from('portal_word_replies').delete().eq('id', ex.id); return { path: v.path, row_deleted: true }; }
  const meta = { ...((ex.meta && typeof ex.meta === 'object') ? ex.meta : {}) }; delete (meta as any).voice; delete (meta as any).transcript;
  await db.from('portal_word_replies').update({ meta, updated_at: now.toISOString() }).eq('id', ex.id); return { path: v.path, row_deleted: false };
}
/** P54: رابط موقَّع (5 دقائق) لأمانة صوتية — للمدرّب صاحب الكلمة أو الطاقم المطّلع */
export async function voiceUrlFor(db: Db, trainerIds: string[], replyId: string): Promise<{ url: string; sec: number; transcript: string | null } | { error: string; status: number }> {
  const { data: r } = await db.from('portal_word_replies').select('id, trainer_id, meta').eq('id', String(replyId || '')).maybeSingle(); const v = voiceOf(r?.meta);
  if (!r || !v) return { error: 'لا أمانة صوتية بهذا المعرّف', status: 404 }; if (!trainerIds.includes(String(r.trainer_id))) return { error: 'هذه الأمانة ليست لكلمتك', status: 403 };
  try { const { data } = await db.storage.from(VOICE_LIMITS.bucket).createSignedUrl(v.path, VOICE_LIMITS.signedSeconds); if (!data?.signedUrl) return { error: 'تعذّر إنشاء الرابط', status: 500 }; return { url: data.signedUrl, sec: v.sec, transcript: transcriptOf(r.meta) }; } catch (e: any) { return { error: e?.message || 'تعذّر إنشاء الرابط', status: 500 }; }
}
/** P54: تنظيف ملفات الصوت لردود تجاوزت مدّة الاحتفاظ — يُستدعى من خطوة الاحتفاظ القائمة قبل حذف الصفوف (لا كرون جديد) */
export async function purgeWordVoices(db: Db, days: number, opts: { now?: Date; dry?: boolean } = {}): Promise<{ scanned: number; removed: number }> {
  const now = opts.now || new Date(); const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
  const { data } = await db.from('portal_word_replies').select('id, meta').lt('created_at', cutoff).limit(500); const rows = arr(data); const paths = rows.map((r) => voiceOf(r.meta)?.path).filter(Boolean) as string[];
  if (!paths.length || opts.dry) return { scanned: rows.length, removed: opts.dry ? paths.length : 0 };
  try { await db.storage.from(VOICE_LIMITS.bucket).remove(paths); } catch { /* يُعاد غدًا */ }
  return { scanned: rows.length, removed: paths.length };
}
/** بريد المدرّب: بطاقة trainers بالمعرّف — أو حساب profiles إن كان المعرّف حسابًا */
async function trainerEmail(db: Db, trainerId: string): Promise<string | null> {
  const { data: t } = await db.from('trainers').select('id, email').eq('id', trainerId).maybeSingle(); if (t?.email) return norm(t.email);
  const { data: p } = await db.from('profiles').select('id, email').eq('id', trainerId).maybeSingle(); return p?.email ? norm(p.email) : null;
}
/** إشعار مجمَّع للمدرّب: مفتاح تفرّد بالساعة → مرّة في الساعة كحدّ أقصى؛ التحديثات داخل الساعة تُحدِّث العدّ */
async function notifyTrainer(db: Db, trainerId: string, now: Date): Promise<boolean> {
  const email = await trainerEmail(db, trainerId); if (!email) return false;
  const since = new Date(Date.parse(`${hourBucket(now)}:00:00.000Z`)).toISOString();
  const { data: rs } = await db.from('portal_word_replies').select('id, chip, meta').eq('trainer_id', trainerId).gte('updated_at', since).limit(500); const rows = arr(rs);
  const txt = trainerNoticeText(rows.length || 1, rows.filter((r) => r.chip === 'need_help').length, rows.filter((r) => !!voiceOf(r.meta)).length);
  const { pushNotice } = await import('./notices');
  const r = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'word_reply', ...txt, ref_id: null, dedupe_key: `word_reply:${trainerId}:${hourBucket(now)}`, push: false, merge: true });
  return !!r.inserted || !!(r as any).merged;
}
export type RoomReplies = ReplySummary & { classroom_id: string | null };
/** ردود شُعب المدرّب خلال 14 يومًا — مجمَّعة بالشعبة (null = كلمات بلا شعبة) */
export async function collectReplies(db: Db, trainerIds: string[], opts: { now?: Date; names?: Map<string, string> } = {}): Promise<{ total: number; need_help: number; unseen: number; voice: number; hands3: number; rooms: RoomReplies[] }> {
  const now = opts.now || new Date(); const ids = trainerIds.filter(Boolean); if (!ids.length) return { total: 0, need_help: 0, unseen: 0, voice: 0, hands3: 0, rooms: [] };
  const since = new Date(now.getTime() - REPLIES_WINDOW_DAYS * 86400000).toISOString();
  const { data } = await db.from('portal_word_replies').select('*').in('trainer_id', ids).gte('updated_at', since).order('updated_at', { ascending: false }).limit(1000); const rows = arr(data) as ReplyRow[];
  const hands = handsByLearner(rows, now); /* P54 «✋ ثلاث مرّات» — من النافذة نفسها (14 يومًا ⊇ 7 أيام) */
  const groups = new Map<string, ReplyRow[]>(); for (const r of rows) { const k = r.classroom_id ? String(r.classroom_id) : ''; const g = groups.get(k) || []; g.push(r); groups.set(k, g); }
  const rooms: RoomReplies[] = [...groups].map(([k, g]) => ({ classroom_id: k || null, ...summarizeReplies(g, opts.names, hands) }));
  rooms.sort((a, b) => b.need_help - a.need_help || b.unseen - a.unseen || b.total - a.total);
  return { total: rows.length, need_help: rooms.reduce((n, r) => n + r.need_help, 0), unseen: rooms.reduce((n, r) => n + r.unseen, 0), voice: rooms.reduce((n, r) => n + r.voice, 0), hands3: hands3Count(hands), rooms };
}
/** «قرأت» — تعليم ردود شعبة (أو كلّها) مقروءة؛ تعود بعدد ما عُلِّم */
export async function markRepliesSeen(db: Db, trainerIds: string[], classroomId: string | null, opts: { now?: Date } = {}): Promise<number> {
  const ids = trainerIds.filter(Boolean); if (!ids.length) return 0; const now = (opts.now || new Date()).toISOString();
  let q = db.from('portal_word_replies').update({ seen_at: now }).in('trainer_id', ids).is('seen_at', null); if (classroomId) q = q.eq('classroom_id', classroomId);
  const { data } = await q.select('id'); return arr(data).length;
}
/** ردود المتعلّم على إشعاراته (لعرض «ردّك» تحت الكلمة) */
export type MyReplyView = { chip: ChipKey | null; chip_ar: string; text: string | null; at: string; editable: boolean; voice_sec: number | null; transcript: string | null };
export async function myReplies(db: Db, email: string, noticeIds: string[]): Promise<Map<string, MyReplyView>> {
  const out = new Map<string, MyReplyView>(); if (!noticeIds.length) return out;
  const { data } = await db.from('portal_word_replies').select('notice_id, chip, text, created_at, updated_at, meta').eq('learner_email', norm(email)).in('notice_id', noticeIds).limit(200);
  const now = Date.now(); for (const r of arr(data)) { const v = voiceOf(r.meta); out.set(String(r.notice_id), { chip: r.chip || null, chip_ar: chipLabel(r.chip || null), text: r.text || null, at: r.updated_at || r.created_at, editable: now - Date.parse(r.created_at) <= EDIT_WINDOW_MIN * 60000, voice_sec: v ? v.sec : null, transcript: transcriptOf(r.meta) }); }
  return out;
}
/** ردود أمس (ليوم الرياض) — لسطر موجز الصباح */
export async function repliesYesterday(db: Db, trainerIds: string[], now: Date): Promise<{ replies: number; need_help: number; voices: number }> {
  const ids = trainerIds.filter(Boolean); if (!ids.length) return { replies: 0, need_help: 0, voices: 0 };
  const y = riyadhDate(new Date(now.getTime() - 86400000)); const from = new Date(Date.parse(`${y}T00:00:00Z`) - 3 * 3600000); const to = new Date(from.getTime() + 86400000);
  const { data } = await db.from('portal_word_replies').select('id, chip, meta').in('trainer_id', ids).gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(1000); const rows = arr(data);
  return { replies: rows.length, need_help: rows.filter((r) => r.chip === 'need_help').length, voices: rows.filter((r) => !!voiceOf(r.meta)).length };
}
