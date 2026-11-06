// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P53 «ردّ على الكلمة» — صوت المتعلّم يعود إلى المدرّب · الاسم الرسمي: «ردود المتعلّمين على رسائل المدرّب» / Learner replies to trainer notes
 *  - تحت كل «كلمة» (إشعار trainer_word من P51) ثلاث «لمسات» (🌱 وصلت · ✋ أحتاج مساعدة · 🕐 سأحضر) + سطر اختياري ≤ 200 حرف.
 *  - ردّ واحد لكل كلمة؛ يُعدَّل خلال ساعة ثم يثبت. يصل إلى المدرّب وحده: «دفتر اليوم» (/me/day#replies) + إشعار 🗨️ مجمَّع (مرّة في الساعة كحدّ أقصى).
 *  - لا يُستعمل الردّ في أي تقييم أو درجة. من ضغط ✋ يُرتَّب أولًا — ترتيب لا إنذار. لا يرى متعلّم ردود غيره.
 *  الجزء الصرف: CHIPS · cleanReply · chipOf · parseWordNotice · summarizeReplies · trainerNoticeText · repliesLine — الغراء: submitReply · collectReplies · markRepliesSeen · myReplies · repliesYesterday
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

export type ChipKey = 'got_it' | 'need_help' | 'will_attend';
export type Chip = { key: ChipKey; icon: string; label_ar: string; label_en: string };
/** «اللمسات» — ردّ بلا كتابة (للجوّال ولمن لا يحبّ الكتابة) */
export const CHIPS: readonly Chip[] = [
  { key: 'got_it', icon: '🌱', label_ar: 'وصلت، شكرًا', label_en: 'Got it, thanks' },
  { key: 'need_help', icon: '✋', label_ar: 'أحتاج مساعدة', label_en: 'I need help' },
  { key: 'will_attend', icon: '🕐', label_ar: 'سأحضر الجلسة القادمة', label_en: 'I will attend the next session' },
] as const;

export type ReplyRow = { id: string; created_at: string; updated_at: string; notice_id: string; trainer_id: string; classroom_id: string | null; learner_email: string; learner_name: string | null; chip: ChipKey | null; text: string | null; seen_at: string | null; meta: Record<string, unknown> };

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
export type ReplyView = { id: string; email: string; name: string; chip: ChipKey | null; chip_ar: string; text: string | null; at: string; seen: boolean; notice_id: string };
export type ReplySummary = { total: number; need_help: number; unseen: number; by_chip: Record<ChipKey, number>; items: ReplyView[] };
/** تجميع ردود شعبة: ✋ أولًا ثم الأحدث · عدّادات */
export function summarizeReplies(rows: ReplyRow[], names: Map<string, string> = new Map()): ReplySummary {
  const by_chip: Record<ChipKey, number> = { got_it: 0, need_help: 0, will_attend: 0 }; let unseen = 0;
  const items: ReplyView[] = rows.map((r) => { if (r.chip) by_chip[r.chip] += 1; if (!r.seen_at) unseen += 1; const e = norm(r.learner_email); return { id: r.id, email: e, name: r.learner_name || names.get(e) || '', chip: r.chip, chip_ar: chipLabel(r.chip), text: r.text || null, at: r.updated_at || r.created_at, seen: !!r.seen_at, notice_id: r.notice_id }; });
  items.sort((a, b) => Number(b.chip === 'need_help') - Number(a.chip === 'need_help') || Date.parse(b.at) - Date.parse(a.at));
  return { total: rows.length, need_help: by_chip.need_help, unseen, by_chip, items };
}
const nAr = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
/** نصّ إشعار المدرّب المجمَّع */
export function trainerNoticeText(count: number, needHelp: number): { title_ar: string; body_ar: string; url: string } {
  return { title_ar: `${nAr(count, 'ردّ جديد', 'ردّان جديدان', 'ردود جديدة', 'ردًّا جديدًا')} على كلمتك`, body_ar: needHelp ? `${nAr(needHelp, 'متعلّم واحد يرفع يده', 'متعلّمان يرفعان أيديهما', 'متعلّمين يرفعون أيديهم', 'متعلّمًا يرفعون أيديهم')} — افتح دفتر اليوم لتراهم أولًا.` : 'افتح «دفتر اليوم» لتقرأها — ردودهم لك وحدك.', url: REPLIES_PATH };
}
/** سطر موجز الصباح 📒 */
export function repliesLine(replies: number, needHelp: number): string { return replies ? `ردود أمس ${replies}${needHelp ? ` · ✋ ${needHelp}` : ''}` : ''; }
export const hourBucket = (now: Date): string => new Date(Math.floor(now.getTime() / (TRAINER_NOTICE_BUCKET_MIN * 60000)) * TRAINER_NOTICE_BUCKET_MIN * 60000).toISOString().slice(0, 13);

/* ---------- غراء ---------- */
export type ReplyMe = { email: string; name?: string | null };
export type SubmitResult = { row: ReplyRow; created: boolean; notified: boolean } | { error: string; status: number };
/** ردّ المتعلّم: الإشعار له ونوعه «كلمة» · لمسة أو سطر · يُعدَّل خلال ساعة · إشعار مجمَّع للمدرّب */
export async function submitReply(db: Db, me: ReplyMe, input: { notice_id: string; chip?: unknown; text?: unknown }, opts: { now?: Date; dry?: boolean } = {}): Promise<SubmitResult> {
  const now = opts.now || new Date(); const email = norm(me.email); const nid = String(input.notice_id || ''); if (!nid) return { error: 'حدّد الكلمة', status: 400 };
  const chip = chipOf(input.chip); const text = cleanReply(input.text); if (!chip && !text) return { error: 'اختر لمسة أو اكتب سطرًا', status: 400 };
  if (String(input.text || '').length > REPLY_MAX * 3) return { error: `السطر أطول من ${REPLY_MAX} حرفًا`, status: 400 };
  const { data: n } = await db.from('portal_learner_notices').select('id, email, kind, ref_id, dedupe_key, created_at').eq('id', nid).maybeSingle();
  if (!n || norm(n.email) !== email) return { error: 'هذه الكلمة ليست لك', status: 404 };
  const w = parseWordNotice(n); if (!w) return { error: 'الردّ متاح على «كلمة» المدرّب فقط', status: 400 };
  const { data: ex } = await db.from('portal_word_replies').select('*').eq('notice_id', nid).eq('learner_email', email).maybeSingle();
  if (ex && now.getTime() - Date.parse(ex.created_at) > EDIT_WINDOW_MIN * 60000) return { error: 'ثبت ردّك — يُعدَّل خلال ساعة من إرساله فقط', status: 409 };
  // تعديل بسطر فقط يُبقي اللمسة السابقة (لا تُمحى إلا باختيار لمسة أخرى)
  const payload = { chip: chip || (ex?.chip ? chipOf(ex.chip) : null), text: text || null, updated_at: now.toISOString(), learner_name: me.name || ex?.learner_name || null };
  if (opts.dry) return { row: { ...(ex || { id: 'dry', created_at: now.toISOString(), notice_id: nid, trainer_id: w.trainer_id, classroom_id: w.classroom_id, learner_email: email, seen_at: null, meta: {} }), ...payload } as ReplyRow, created: !ex, notified: false };
  let row: ReplyRow;
  if (ex) { const { data, error } = await db.from('portal_word_replies').update({ ...payload, seen_at: null }).eq('id', ex.id).select('*').single(); if (error) return { error: error.message, status: 500 }; row = data as ReplyRow; }
  else { const { data, error } = await db.from('portal_word_replies').insert({ notice_id: nid, trainer_id: w.trainer_id, classroom_id: w.classroom_id, learner_email: email, created_at: now.toISOString(), ...payload }).select('*').single(); if (error) return { error: error.message, status: 500 }; row = data as ReplyRow; }
  const notified = await notifyTrainer(db, w.trainer_id, now).catch(() => false);
  return { row, created: !ex, notified };
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
  const { data: rs } = await db.from('portal_word_replies').select('id, chip').eq('trainer_id', trainerId).gte('updated_at', since).limit(500); const rows = arr(rs);
  const txt = trainerNoticeText(rows.length || 1, rows.filter((r) => r.chip === 'need_help').length);
  const { pushNotice } = await import('./notices');
  const r = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'word_reply', ...txt, ref_id: null, dedupe_key: `word_reply:${trainerId}:${hourBucket(now)}`, push: false, merge: true });
  return !!r.inserted || !!(r as any).merged;
}
export type RoomReplies = ReplySummary & { classroom_id: string | null };
/** ردود شُعب المدرّب خلال 14 يومًا — مجمَّعة بالشعبة (null = كلمات بلا شعبة) */
export async function collectReplies(db: Db, trainerIds: string[], opts: { now?: Date; names?: Map<string, string> } = {}): Promise<{ total: number; need_help: number; unseen: number; rooms: RoomReplies[] }> {
  const now = opts.now || new Date(); const ids = trainerIds.filter(Boolean); if (!ids.length) return { total: 0, need_help: 0, unseen: 0, rooms: [] };
  const since = new Date(now.getTime() - REPLIES_WINDOW_DAYS * 86400000).toISOString();
  const { data } = await db.from('portal_word_replies').select('*').in('trainer_id', ids).gte('updated_at', since).order('updated_at', { ascending: false }).limit(1000); const rows = arr(data) as ReplyRow[];
  const groups = new Map<string, ReplyRow[]>(); for (const r of rows) { const k = r.classroom_id ? String(r.classroom_id) : ''; const g = groups.get(k) || []; g.push(r); groups.set(k, g); }
  const rooms: RoomReplies[] = [...groups].map(([k, g]) => ({ classroom_id: k || null, ...summarizeReplies(g, opts.names) }));
  rooms.sort((a, b) => b.need_help - a.need_help || b.unseen - a.unseen || b.total - a.total);
  return { total: rows.length, need_help: rooms.reduce((n, r) => n + r.need_help, 0), unseen: rooms.reduce((n, r) => n + r.unseen, 0), rooms };
}
/** «قرأت» — تعليم ردود شعبة (أو كلّها) مقروءة؛ تعود بعدد ما عُلِّم */
export async function markRepliesSeen(db: Db, trainerIds: string[], classroomId: string | null, opts: { now?: Date } = {}): Promise<number> {
  const ids = trainerIds.filter(Boolean); if (!ids.length) return 0; const now = (opts.now || new Date()).toISOString();
  let q = db.from('portal_word_replies').update({ seen_at: now }).in('trainer_id', ids).is('seen_at', null); if (classroomId) q = q.eq('classroom_id', classroomId);
  const { data } = await q.select('id'); return arr(data).length;
}
/** ردود المتعلّم على إشعاراته (لعرض «ردّك» تحت الكلمة) */
export async function myReplies(db: Db, email: string, noticeIds: string[]): Promise<Map<string, { chip: ChipKey | null; chip_ar: string; text: string | null; at: string; editable: boolean }>> {
  const out = new Map<string, { chip: ChipKey | null; chip_ar: string; text: string | null; at: string; editable: boolean }>(); if (!noticeIds.length) return out;
  const { data } = await db.from('portal_word_replies').select('notice_id, chip, text, created_at, updated_at').eq('learner_email', norm(email)).in('notice_id', noticeIds).limit(200);
  const now = Date.now(); for (const r of arr(data)) out.set(String(r.notice_id), { chip: r.chip || null, chip_ar: chipLabel(r.chip || null), text: r.text || null, at: r.updated_at || r.created_at, editable: now - Date.parse(r.created_at) <= EDIT_WINDOW_MIN * 60000 });
  return out;
}
/** ردود أمس (ليوم الرياض) — لسطر موجز الصباح */
export async function repliesYesterday(db: Db, trainerIds: string[], now: Date): Promise<{ replies: number; need_help: number }> {
  const ids = trainerIds.filter(Boolean); if (!ids.length) return { replies: 0, need_help: 0 };
  const y = riyadhDate(new Date(now.getTime() - 86400000)); const from = new Date(Date.parse(`${y}T00:00:00Z`) - 3 * 3600000); const to = new Date(from.getTime() + 86400000);
  const { data } = await db.from('portal_word_replies').select('id, chip').in('trainer_id', ids).gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).limit(1000); const rows = arr(data);
  return { replies: rows.length, need_help: rows.filter((r) => r.chip === 'need_help').length };
}
