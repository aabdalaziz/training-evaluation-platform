// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P57 «نبض الجهة» — خلاصة الحوار الشهري بين المدرّبين ومنسوبي الجهة / Monthly trainer–member dialogue pulse
 *  قسم «نبض الشهر» داخل «رسالة الشهر» (P52): سطر أرقام + سطر «مرآة» بلا حكم — بلا أسماء، بقاعدة الخمسة.
 *  - الكلمة: إشعار trainer_word وُجِّه إلى منسوب مؤكَّد خلال الشهر (meta.voice = كلمة صوتية).
 *  - الردّ: صفّ portal_word_replies لمنسوب مؤكَّد خلال الشهر (🌱 ✋ 🕐 · meta.voice = أمانة صوتية).
 *  - اليد المفتوحة: آخر ✋ للمنسوب لم تتبعها كلمة صوتية من مدرّبه وبقيت ≥ 7 أيام (منطق P56 نفسه — المدرّب والمتعلّم والجهة يرون الحقيقة ذاتها).
 *  - «أكثر أسبوع حوارًا»: خميس الأسبوع الذي بلغت فيه الردود ذروتها.
 *  - صفر تخزين جديد؛ يُحسب عند إنشاء المسوَّدة ويتجمّد مع التوقيع داخل بصمة الرسالة.
 *  النقي أعلى الملف (قابل للاختبار بلا قاعدة) ثم الغراء أسفله.
 */
import { K_ORG } from './registry';
import { parseWordNotice, voiceOf } from '../portal/word-reply';
import type { ChipKey } from '../portal/word-reply';
import { echoWeekKey } from '../portal/week-echo';

export const PULSE_TITLE = { ar: 'نبض الشهر', en: 'Pulse of the month' };
export const PULSE_OFFICIAL = { ar: 'خلاصة الحوار الشهري بين المدرّبين ومنسوبي الجهة', en: 'Monthly trainer–member dialogue pulse' };
export const OPEN_HAND_DAYS = 7;      /* اليد تُعدّ «باقية» إن مرّ أسبوع بلا كلمة صوتية بعدها */
export const LOW_REPLY_PCT = 30;      /* دون هذا يُقترح طلب من الإدارة */
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export type OrgPulse = {
  v: 1; words: number; voice_words: number; trainers: number; reached: number; replied: number; replied_pct: number | null;
  by_chip: Record<ChipKey, number>; voice_replies: number; hands: number; hands_open: number;
  peak_week: string | null; peak_week_ar: string | null; k: boolean;
  line_ar: string | null; mirror_ar: string; ask_ar: string | null;
};

const norm = (e: unknown) => String(e || '').trim().toLowerCase();
const nAr = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const dayAr = (iso: string): string => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS_AR[(m - 1) % 12]}`; };

export type PulseWord = { email: string; kind?: string; dedupe_key?: string | null; ref_id?: string | null; meta?: unknown; created_at: string };
export type PulseReply = { learner_email: string; chip: string | null; meta?: unknown; created_at: string };

/** الحساب النقي — words/replies مقصورة سلفًا على منسوبي الجهة وعلى الشهر · asOf = الآن أو نهاية الشهر (الأسبق) */
export function computePulse(words: PulseWord[], replies: PulseReply[], asOf: Date, k = K_ORG): OrgPulse {
  const trainers = new Set<string>(); const reached = new Set<string>(); const voiceAt = new Map<string, string[]>(); let w = 0; let vw = 0;
  for (const n of words) { const p = parseWordNotice(n); if (!p || !n.email) continue; w += 1; trainers.add(p.trainer_id); const e = norm(n.email); reached.add(e); if (voiceOf(n.meta)) { vw += 1; const l = voiceAt.get(e) || []; l.push(String(n.created_at || '')); voiceAt.set(e, l); } }
  const by_chip: Record<ChipKey, number> = { got_it: 0, need_help: 0, will_attend: 0 }; const replied = new Set<string>(); let vr = 0; const lastHand = new Map<string, string>(); const byWeek = new Map<string, number>();
  for (const r of replies) { const e = norm(r.learner_email); if (!e) continue; replied.add(e); if (r.chip && r.chip in by_chip) by_chip[r.chip as ChipKey] += 1; if (voiceOf(r.meta)) vr += 1;
    const at = String(r.created_at || ''); if (r.chip === 'need_help' && (lastHand.get(e) || '') < at) lastHand.set(e, at);
    if (at) { const wk = echoWeekKey(new Date(at)); byWeek.set(wk, (byWeek.get(wk) || 0) + 1); } }
  const cutoff = new Date(asOf.getTime() - OPEN_HAND_DAYS * 86400000).toISOString(); let open = 0;
  for (const [e, at] of lastHand) { const answered = (voiceAt.get(e) || []).some((t) => t >= at); if (!answered && at <= cutoff) open += 1; }
  let peak: string | null = null; let peakN = 0; for (const [wk, n] of byWeek) if (n > peakN || (n === peakN && peak && wk < peak)) { peak = wk; peakN = n; }
  const ok = reached.size >= k;
  const base = { v: 1 as const, words: w, voice_words: vw, trainers: trainers.size, reached: reached.size, replied: replied.size, replied_pct: ok && reached.size ? Math.round((replied.size / reached.size) * 100) : null,
    by_chip, voice_replies: vr, hands: lastHand.size, hands_open: open, peak_week: ok && peakN >= 2 ? peak : null, peak_week_ar: ok && peakN >= 2 && peak ? dayAr(peak) : null, k: ok };
  return { ...base, line_ar: pulseLine(base), mirror_ar: pulseMirror(base), ask_ar: pulseAsk(base) };
}

type PulseCore = Omit<OrgPulse, 'line_ar' | 'mirror_ar' | 'ask_ar'>;
/** سطر الأرقام — null حين لا يكتمل النصاب (تُقال الحقيقة في المرآة) */
export function pulseLine(p: PulseCore): string | null {
  if (!p.k) return null;
  const parts = [`${nAr(p.words, 'كلمة واحدة', 'كلمتان', 'كلمات', 'كلمة')} من ${nAr(p.trainers, 'مدرّب واحد', 'مدرّبَين', 'مدرّبين', 'مدرّبًا')}${p.voice_words ? ` (🎙️ ${p.voice_words})` : ''} وصلت إلى ${p.reached} من منسوبيكم`];
  if (p.replied_pct !== null) parts.push(`ردّ ${p.replied_pct}٪`);
  if (p.by_chip.got_it) parts.push(`🌱 ${p.by_chip.got_it}`); if (p.by_chip.need_help) parts.push(`✋ ${p.by_chip.need_help}`); if (p.by_chip.will_attend) parts.push(`🕐 ${p.by_chip.will_attend}`); if (p.voice_replies) parts.push(`🎙️ ${p.voice_replies}`);
  return parts.join(' · ');
}
/** سطر «المرآة» — ملاحظة واحدة بلا حكم + ذروة الأسبوع إن وُجدت */
export function pulseMirror(p: PulseCore): string {
  if (!p.words) return 'لم تصل كلمات لمنسوبيكم هذا الشهر — الحوار يبدأ من الشُّعب.';
  if (!p.k) return 'الحوار هذا الشهر تحت خمسة منسوبين — نحفظ خصوصيتهم ونذكره حين يبلغ العدد.';
  let m: string;
  if (p.hands_open) m = `${nAr(p.hands_open, 'يد واحدة بقيت مرفوعة', 'يدان بقيتا مرفوعتين', 'أيدٍ بقيت مرفوعة', 'يدًا بقيت مرفوعة')} أكثر من أسبوع — المدرّبون يرونها بالأسماء، ونذكرها لكم عددًا.`;
  else if (p.hands) m = 'كل يد مرفوعة لقيت كلمة من مدرّبها ✓';
  else if ((p.replied_pct ?? 0) <= 50) m = 'نصف من وصلتهم كلمة لم يردّوا بعد — كلمة من إدارتكم تفتح الباب.';
  else m = 'حوار حيّ: أكثر من نصف من وصلتهم كلمة ردّوا.';
  return p.peak_week_ar ? `${m} — وأكثر أسبوع حوارًا كان أسبوع ${p.peak_week_ar}.` : m;
}
/** اقتراح ثالث لـ«ما نحتاجه منكم» (أدنى أولوية من اقتراحَي P52) */
export function pulseAsk(p: PulseCore): string | null { return p.k && p.replied_pct !== null && p.replied_pct < LOW_REPLY_PCT ? 'كلمة قصيرة من إدارتكم: ردّ واحد على كلمة المدرّب يكفي 🌱' : null; }
/** نصّ يُقرأ بصوت الجهاز */
export function pulseSpeech(p: Pick<OrgPulse, 'line_ar' | 'mirror_ar'>): string { return [p.line_ar, p.mirror_ar].filter(Boolean).join('. ').replace(/[🎙️🌱✋🕐✓]/gu, '').replace(/ · /g, '، ').replace(/\s+/g, ' ').trim(); }

/* ============================ الغراء ============================ */
type Db = any;
const arr = <T = any>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const chunk = <T,>(a: T[], n = 200) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

/** نبض جهة لشهر: members = بريد المنسوبين المؤكَّدين · range = حدود الشهر ISO */
export async function orgPulse(db: Db, members: Set<string>, range: { from: string; to: string }, opts: { now?: Date } = {}): Promise<OrgPulse> {
  const now = opts.now || new Date(); const end = new Date(range.to); const asOf = now < end ? now : end; const mem = [...members];
  const words: PulseWord[] = []; const replies: PulseReply[] = [];
  for (const part of chunk(mem)) {
    const [{ data: w }, { data: r }] = await Promise.all([
      db.from('portal_learner_notices').select('email, kind, dedupe_key, ref_id, meta, created_at').eq('kind', 'trainer_word').in('email', part).gte('created_at', range.from).lt('created_at', range.to).limit(5000),
      db.from('portal_word_replies').select('learner_email, chip, meta, created_at').in('learner_email', part).gte('created_at', range.from).lt('created_at', range.to).limit(5000),
    ]);
    words.push(...arr<PulseWord>(w).filter((x) => members.has(norm(x.email)))); replies.push(...arr<PulseReply>(r).filter((x) => members.has(norm(x.learner_email))));
  }
  return computePulse(words, replies, asOf);
}
