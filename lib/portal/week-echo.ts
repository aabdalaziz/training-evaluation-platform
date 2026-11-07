// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P56 «صدى الأسبوع» — خلاصة التفاعل الأسبوعية بين المدرّب والمتعلّم / Weekly trainer–learner interaction echo
 *  - المتعلّم: كل خميس (الرياض) إشعار 🪞 «صدى أسبوعك»: كلمات مدرّبه خلال 7 أيام · لمساته · يده المرفوعة وهل أُجيبت · «كلمتك القادمة؟»
 *    يُرسل من الكرون اليومي القائم (لا كرون جديد) · dedupe week_echo:<email>:<تاريخ الخميس> · لمن وصلته كلمة واحدة على الأقل.
 *  - المدرّب: بطاقة «صدى الأسبوع» في دفتر اليوم (آخر 7 أيام) + سطر «مرآة» واحد بلا حكم + سطر الخميس في الخلاصة الصباحية.
 *  - صفر تخزين جديد: يُحسب من portal_learner_notices (kind trainer_word · meta.voice) وportal_word_replies.
 *  - لا تقييم ولا درجات: الصدى يُعيد للمتعلّم صوت أسبوعه، والمرآة تُري المدرّب أثر كلماته.
 */
import { riyadhDate } from '../miaar/practice';
import { parseWordNotice, voiceOf, HANDS_WEEK_MIN } from './word-reply';
import type { ChipKey } from './word-reply';

type Db = any;
const arr = (d: unknown): any[] => (Array.isArray(d) ? d : []);
const norm = (e: unknown) => String(e || '').trim().toLowerCase();

export const ECHO_KIND = 'week_echo' as const;
export const ECHO_TITLE = 'صدى الأسبوع';
export const ECHO_OFFICIAL = { ar: 'خلاصة التفاعل الأسبوعية بين المدرّب والمتعلّم', en: 'Weekly trainer–learner interaction echo' } as const;
export const ECHO_DAYS = 7;
/** الخميس — آخر يوم عمل في الأسبوع السعودي (0 = الأحد … 4 = الخميس) */
export const ECHO_WEEKDAY = 4;
export const ECHO_PATH = '/me#notices';
export const TRAINER_ECHO_PATH = '/me/day#dy-echo';
const TZ_MS = 3 * 3600000;

/** يوم الأسبوع بتوقيت الرياض (0 الأحد … 6 السبت) */
export function riyadhWeekday(now: Date): number { return new Date(now.getTime() + TZ_MS).getUTCDay(); }
export const isEchoDay = (now: Date): boolean => riyadhWeekday(now) === ECHO_WEEKDAY;
/** مفتاح الأسبوع = تاريخ الخميس (الرياض) الذي يُغلق هذا الأسبوع */
export function echoWeekKey(now: Date): string { const wd = riyadhWeekday(now); const delta = (ECHO_WEEKDAY - wd + 7) % 7; return riyadhDate(new Date(now.getTime() + delta * 86400000)); }

/* ====================================================================== صدى المتعلّم */
export type LearnerEcho = { email: string; words: number; voice_words: number; trainers: Set<string>; replies: number; by_chip: Record<ChipKey, number>; voice_replies: number; last_hand_at: string | null; voice_after_hand: boolean };
const emptyEcho = (email: string): LearnerEcho => ({ email, words: 0, voice_words: 0, trainers: new Set(), replies: 0, by_chip: { got_it: 0, need_help: 0, will_attend: 0 }, voice_replies: 0, last_hand_at: null, voice_after_hand: false });

/** تجميع من صفوف الأسبوع: إشعارات الكلمة (كل المتعلّمين) + الردود (كل المتعلّمين) */
export function buildLearnerEchoes(words: any[], replies: any[]): Map<string, LearnerEcho> {
  const m = new Map<string, LearnerEcho>(); const get = (e: string) => { const k = norm(e); let x = m.get(k); if (!x) { x = emptyEcho(k); m.set(k, x); } return x; };
  const voiceAt = new Map<string, string[]>(); /* بريد → أوقات الكلمات الصوتية */
  for (const n of words) { const w = parseWordNotice(n); if (!w || !n.email) continue; const x = get(n.email); x.words += 1; x.trainers.add(w.trainer_id); if (voiceOf(n.meta)) { x.voice_words += 1; const l = voiceAt.get(x.email) || []; l.push(String(n.created_at || '')); voiceAt.set(x.email, l); } }
  for (const r of replies) { if (!r.learner_email) continue; const x = get(r.learner_email); x.replies += 1; const chip = r.chip as ChipKey | null; if (chip && chip in x.by_chip) x.by_chip[chip] += 1; if (voiceOf(r.meta)) x.voice_replies += 1; if (chip === 'need_help') { const at = String(r.updated_at || r.created_at || ''); if (!x.last_hand_at || at > x.last_hand_at) x.last_hand_at = at; } }
  for (const x of m.values()) { if (x.last_hand_at) x.voice_after_hand = (voiceAt.get(x.email) || []).some((t) => t >= x.last_hand_at!); }
  return m;
}

const n2 = (n: number, one: string, two: string, many: string) => (n === 1 ? one : n === 2 ? two : `${n} ${many}`);
/** نصّ الصدى — صادق بلا لوم · سؤال واحد في الختام */
export function learnerEchoText(x: LearnerEcho): { title_ar: string; body_ar: string; url: string } | null {
  if (!x.words) return null; /* من لم تصله كلمة لا يُزعَج */
  const wordsTxt = `${n2(x.words, 'كلمة واحدة', 'كلمتان', 'كلمات')} من مدرّبك${x.voice_words ? ` (🎙️ ${x.voice_words})` : ''}`;
  let body: string;
  if (!x.replies) body = `${wordsTxt} ولم تردّ بعد — لمسة واحدة تكفي 🌱`;
  else {
    const chips: string[] = []; if (x.by_chip.got_it) chips.push(`🌱 ${x.by_chip.got_it}`); if (x.by_chip.need_help) chips.push(`✋ ${x.by_chip.need_help}`); if (x.by_chip.will_attend) chips.push(`🕐 ${x.by_chip.will_attend}`); if (x.voice_replies) chips.push(`🎙️ ${x.voice_replies}`);
    const hand = x.by_chip.need_help ? (x.voice_after_hand ? ' · أُجبتَ 🎙️ ✓' : ' · يدك ما زالت مرفوعة — مدرّبك يراها') : '';
    body = `${wordsTxt} · ردودك: ${chips.join(' · ')}${hand} — كلمتك القادمة؟`;
  }
  return { title_ar: 'صدى أسبوعك 🪞', body_ar: body, url: ECHO_PATH };
}

/** الخميس: صدى لكل متعلّم وصلته كلمة خلال 7 أيام · force للاختبار · dry لا يكتب */
export async function runWeekEcho(db: Db, opts: { now?: Date; dry?: boolean; force?: boolean } = {}): Promise<{ day: boolean; learners: number; sent: number; errors: string[] }> {
  const now = opts.now || new Date(); const s = { day: isEchoDay(now), learners: 0, sent: 0, errors: [] as string[] };
  if (!s.day && !opts.force) return s;
  try {
    const since = new Date(now.getTime() - ECHO_DAYS * 86400000).toISOString();
    const [{ data: words }, { data: replies }] = await Promise.all([
      db.from('portal_learner_notices').select('email, kind, dedupe_key, ref_id, meta, created_at').eq('kind', 'trainer_word').gte('created_at', since).limit(5000),
      db.from('portal_word_replies').select('learner_email, chip, meta, created_at, updated_at').gte('updated_at', since).limit(5000),
    ]);
    const echoes = buildLearnerEchoes(arr(words), arr(replies)); const key = echoWeekKey(now); const { pushNotice } = await import('./notices');
    for (const x of echoes.values()) { const t = learnerEchoText(x); if (!t) continue; s.learners += 1;
      try { const r = await pushNotice(db, { email: x.email, user_id: null, report_id: null, kind: ECHO_KIND, ...t, ref_id: null, dedupe_key: `${ECHO_KIND}:${x.email}:${key}`, push: true }, { dry: !!opts.dry }); if (r.inserted) s.sent += 1; } catch (e: any) { s.errors.push(e?.message || String(e)); } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  return s;
}

/* ====================================================================== صدى المدرّب */
export type TrainerEcho = { days: number; words: number; voice_words: number; reached: number; replied: number; replied_pct: number; replies: number; by_chip: Record<ChipKey, number>; voice_replies: number; hands_open: number; answered: number; silent: number };
type ItemLike = { email: string; chip: string | null; at: string; voice?: { sec: number } | null };
/** من إشعارات الكلمة (أسبوع) وعناصر الردود (نافذة 14 يومًا → نقصّها إلى 7) */
export function trainerEchoStats(words: any[], items: ItemLike[], trainerIds: string[], now: Date): TrainerEcho {
  const since = new Date(now.getTime() - ECHO_DAYS * 86400000).toISOString(); const reached = new Set<string>(); let w = 0; let vw = 0; const voiceAt = new Map<string, string[]>();
  for (const n of words) { const p = parseWordNotice(n); if (!p || !trainerIds.includes(p.trainer_id) || String(n.created_at || '') < since) continue; w += 1; const e = norm(n.email); reached.add(e); if (voiceOf(n.meta)) { vw += 1; const l = voiceAt.get(e) || []; l.push(String(n.created_at || '')); voiceAt.set(e, l); } }
  const by_chip: Record<ChipKey, number> = { got_it: 0, need_help: 0, will_attend: 0 }; const replied = new Set<string>(); let vr = 0; const lastHand = new Map<string, string>();
  for (const it of items) { if (String(it.at || '') < since) continue; const e = norm(it.email); replied.add(e); if (it.chip && it.chip in by_chip) by_chip[it.chip as ChipKey] += 1; if (it.voice) vr += 1; if (it.chip === 'need_help' && (lastHand.get(e) || '') < String(it.at)) lastHand.set(e, String(it.at)); }
  const replies = items.filter((it) => String(it.at || '') >= since).length;
  /* يد مرفوعة «مُجابة» = كلمة صوتية من المدرّب بعد آخر ✋ (نفس منطق صدى المتعلّم — بلا شرط ×3) */
  const answeredSet = new Set<string>(); for (const [e, at] of lastHand) if ((voiceAt.get(e) || []).some((t) => t >= at)) answeredSet.add(e);
  const handsOpen = [...lastHand.keys()].filter((e) => !answeredSet.has(e)).length;
  const repliedIn = [...replied].filter((e) => reached.has(e)).length; const pct = reached.size ? Math.round((repliedIn / reached.size) * 100) : 0;
  return { days: ECHO_DAYS, words: w, voice_words: vw, reached: reached.size, replied: repliedIn, replied_pct: pct, replies, by_chip, voice_replies: vr, hands_open: handsOpen, answered: answeredSet.size, silent: Math.max(0, reached.size - repliedIn) };
}
export async function trainerEcho(db: Db, trainerIds: string[], items: ItemLike[], now: Date): Promise<TrainerEcho> {
  const since = new Date(now.getTime() - ECHO_DAYS * 86400000).toISOString();
  const { data } = await db.from('portal_learner_notices').select('email, kind, dedupe_key, ref_id, meta, created_at').eq('kind', 'trainer_word').gte('created_at', since).limit(3000);
  return trainerEchoStats(arr(data), items, trainerIds, now);
}
/** السطر الرئيس للبطاقة والخلاصة */
export function trainerEchoLine(t: TrainerEcho): string {
  if (!t.words) return '';
  const parts = [`كلماتك ${t.words}${t.voice_words ? ` (🎙️ ${t.voice_words})` : ''}`, `وصلت إلى ${n2(t.reached, 'متعلّم واحد', 'متعلّمَين', 'متعلّمًا')}`];
  if (t.reached) parts.push(`ردّ ${t.replied_pct}٪`);
  const chips: string[] = []; if (t.by_chip.got_it) chips.push(`🌱 ${t.by_chip.got_it}`); if (t.by_chip.need_help) chips.push(`✋ ${t.by_chip.need_help}`); if (t.by_chip.will_attend) chips.push(`🕐 ${t.by_chip.will_attend}`); if (t.voice_replies) chips.push(`🎙️ ${t.voice_replies}`); if (chips.length) parts.push(chips.join(' · '));
  if (t.answered) parts.push(`أُجيبوا 🎙️ ${t.answered}`); if (t.silent) parts.push(`لم يردّ بعد ${t.silent}`);
  return parts.join(' · ');
}
/** سطر «المرآة» — ملاحظة واحدة بلا حكم */
export function trainerEchoMirror(t: TrainerEcho): string {
  if (!t.words) return 'لم تقل كلمة هذا الأسبوع — كلمة واحدة تكفي لتبدأ الصدى.';
  if (t.hands_open) return `✋ ${n2(t.hands_open, 'يد واحدة ما زالت مرفوعة', 'يدان ما زالتا مرفوعتين', 'أيدٍ ما زالت مرفوعة')} بلا كلمة بعدها — كلمة صوتية تُجيبها.`;
  if (t.by_chip.need_help) return 'كل يد مرفوعة لقيت كلمة ✓';
  if (t.replied_pct >= 70) return 'أكثر من ثلثَي من وصلتهم كلمتك ردّوا — صداك مسموع.';
  if (t.silent) return `${t.silent} لم يردّوا بعد — ليس صمتًا بالضرورة؛ كلمة باسمهم تفتح الباب.`;
  return 'صدى هادئ هذا الأسبوع.';
}
/** نصّ يُقرأ بصوت الجهاز (بلا رموز) */
export function echoSpeech(line: string): string { return line.replace(/[🎙️🌱✋🕐🪞✓]/gu, '').replace(/\s+/g, ' ').replace(/ ·/g, '،').trim(); }
export const HANDS_MIN = HANDS_WEEK_MIN;
