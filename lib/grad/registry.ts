// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P63 «يوم تخرّجي — بكلماتي» — النواة النقيّة (بلا قاعدة بيانات)
 *  الاسم الرسمي: صفحة التخرّج الذاتية للمتدرّب / Learner-authored graduation page
 *  يوم end_date تُفتح لكل خرّيج صفحة واحدة تجمع ما كتبه **هو** في هذا البرنامج — لا ما كُتب عنه:
 *   • أول «لأن…» على خيطه (P58) · ردوده على كلمات مدرّبه (P53 — سطره هو) · فصول رحلته داخل النافذة (P25)
 *   • سطره في ظرف الدفعة (P62) · حال رسالته «عند تخرّجي» (P62 — بلا نصّ) · رمز لقطة خريطته (P58) · كلمة الوداع من مدرّبه (P51/P55)
 *  ثم يكملها بيده: يُبقي أو يُخفي كل بطاقة، يكتب «سطر التخرّج» (≤ 160)، ويختمها إن شاء: رمز ATH-GD + بصمة SHA-256 على JCS.
 *  «تبقى حيّة»: بعد الختم شريط «منذ ذلك اليوم» يُحسب طازجًا (أعداد فقط) — المختوم لا يتغيّر، والحيّ معلَن.
 *  قواعد: لا درجة ولا مستوى ولا تقييم · لا ذكاء اصطناعي · خاصّة افتراضيًا (الوجه العام: السطر والأعداد) · الصوت لا يسافر · الحذف فوري · k ≥ 5 للدفعة والاعتماد.
 */
import { scrubPii, cleanText } from '../onair/registry';

export const P63_NAMES_AR = {
  title: 'يوم تخرّجي', sub: 'ما كتبتُه بيدي في هذا البرنامج — لا ما كُتب عنّي', official_ar: 'صفحة التخرّج الذاتية للمتدرّب', official_en: 'Learner-authored graduation page',
  words: 'بكلماتي', line: 'سطر التخرّج', farewell: 'قال مدرّبك يوم تخرّجك', since: 'منذ ذلك اليوم', seal: 'اختم صفحتي', cohort: 'دفعتك', public_face: 'الوجه العام',
} as const;
export const GRAD_PATH = '/me/grad';
export const GRAD_PUBLIC_PREFIX = '/g';
export const GRAD_LIMITS = { lineMin: 10, lineMax: 160, repliesMax: 5, chaptersMax: 6, k: 5, farewellBeforeDays: 3, windowAfterDays: 1, voiceSec: 15 } as const;
export const LINE_PROMPT_AR = 'لو لخّصتُ هذا البرنامج في سطر أقوله لمن سيأتي بعدي…';
export const GRAD_FOOT_AR = 'لا تدخل هذه الصفحة في أي تقييم أو شهادة. لا يكتبها ذكاء اصطناعي. خاصّة حتى تختمها وتختار وجهها العام بنفسك — وتُبطلها متى شئت.';
export const CODE_RE = /^ATH-GD-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export type CardKey = 'first_because' | 'replies' | 'chapters' | 'cohort_line' | 'grad_letter' | 'map_code' | 'farewell' | 'welcome' | 'first_why' /* P64 */;
export const CARD_KEYS: CardKey[] = ['farewell', 'welcome', 'first_why', 'first_because', 'replies', 'chapters', 'cohort_line', 'grad_letter', 'map_code'];
export const CARD_AR: Record<CardKey, string> = {
  farewell: 'قال مدرّبك يوم تخرّجك', first_because: 'أول «لأن…» على خيطي', replies: 'ردودي على كلمات مدرّبي', chapters: 'فصول رحلتي في هذا البرنامج',
  cohort_line: 'سطري في ظرف الدفعة', grad_letter: 'رسالتي إلى نفسي عند تخرّجي', map_code: 'لقطة خريطة أثري',
  welcome: 'قال مدرّبك في أول يوم', first_why: 'ما كتبتُه أول يوم — «لماذا جئتُ»' /* P64 */,
};
/** ما يجوز أن يظهر على الوجه العام (الصوت لا يظهر أبدًا — لا مفتاح له) */
export type PublicKey = 'line' | 'counts' | 'name' | 'farewell' | 'first_because' | 'replies' | 'chapters' | 'cohort_line' | 'map_code' | 'since' | 'welcome' | 'first_why' /* P64 */;
export const PUBLIC_KEYS: PublicKey[] = ['line', 'counts', 'name', 'farewell', 'first_because', 'replies', 'chapters', 'cohort_line', 'map_code', 'since', 'welcome', 'first_why'];
export const PUBLIC_DEFAULT: PublicKey[] = ['line', 'counts'];
export const PUBLIC_AR: Record<PublicKey, string> = {
  line: 'سطر التخرّج', counts: 'الأعداد (بلا تفاصيل)', name: 'اسمي', farewell: 'كلمة الوداع من مدرّبي', first_because: 'أول «لأن…»', replies: 'ردودي (كلماتي أنا)',
  chapters: 'فصول رحلتي', cohort_line: 'سطري في ظرف الدفعة', map_code: 'رمز لقطة خريطتي', since: 'شريط «منذ ذلك اليوم» (أعداد حيّة)', welcome: 'كلمة الاستقبال من مدرّبي (أول يوم)', first_why: 'ما كتبتُه أول يوم',
};

export type Card = { key: CardKey; title_ar: string; text_ar: string | null; at: string | null; items?: { text_ar: string; at: string }[]; href?: string | null; voice_sec?: number | null; state_ar?: string | null };
export type Counts = { threads: number; replies: number; amanat: number; chapters: number; days: number };
export type Since = { threads_after: number; stations: { 30: boolean; 90: boolean; 365: boolean }; letter_opened: boolean; cohort_opened: boolean; days_since: number };

/* ───────── النافذة ───────── */
const DAY = 86400000;
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** نافذة البرنامج: من start_date (أو end−120 إن غاب) إلى end_date + يوم */
export function programWindow(startDay: string | null | undefined, endDay: string): { from: string; to: string } {
  const end = new Date(`${endDay}T00:00:00Z`); const from = startDay ? `${startDay}T00:00:00Z` : new Date(end.getTime() - 120 * DAY).toISOString();
  return { from: new Date(from).toISOString(), to: new Date(end.getTime() + (GRAD_LIMITS.windowAfterDays + 1) * DAY).toISOString() };
}
export const inWindow = (iso: string | null | undefined, w: { from: string; to: string }) => !!iso && iso >= w.from && iso < w.to;
export type GradPhase = 'before' | 'today' | 'after';
export function gradPhase(endDay: string, todayRiyadh: string): GradPhase { return todayRiyadh < endDay ? 'before' : todayRiyadh === endDay ? 'today' : 'after'; }
export const daysSince = (endDay: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(`${endDay}T00:00:00Z`).getTime()) / DAY));
export const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY) + 1);

/* ───────── سطر التخرّج ───────── */
export function validateLine(s: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const t = scrubPii(cleanText(s, GRAD_LIMITS.lineMax)); if (/\[بريد\]|\[رقم\]/.test(t)) return { ok: false, error: 'سطر التخرّج بلا بريد ولا أرقام هواتف' };
  if (t.length < GRAD_LIMITS.lineMin) return { ok: false, error: `اكتب من ${GRAD_LIMITS.lineMin} أحرف على الأقل — سطر واحد لمن سيأتي بعدك` };
  return { ok: true, text: t };
}
export function normalizeKeep(v: unknown): Record<CardKey, boolean> {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>; const out = {} as Record<CardKey, boolean>;
  for (const k of CARD_KEYS) out[k] = o[k] !== false; return out;
}
export function normalizePublic(v: unknown): PublicKey[] { const a = Array.isArray(v) ? v : PUBLIC_DEFAULT; return PUBLIC_KEYS.filter((k) => a.includes(k)); }

/* ───────── البطاقات من المصادر (كلماته هو فقط) ───────── */
export type Sources = {
  threads: { from: string; to: string; note_ar: string | null; decided_at: string | null; status: string; rule: string }[];
  replies: { text: string | null; voice: boolean; at: string }[];
  chapters: { key: string; title_ar: string; at: string }[];
  cohort_line: { body_ar: string; created_at: string } | null;
  grad_letter: { state: 'sealed' | 'today' | 'ready' | 'opened'; opens_ar: string; open_hour_ar: string; id: number } | null;
  map_code: { code: string; created_at: string; is_public: boolean } | null;
  farewell: { text_ar: string; at: string; voice_sec: number | null; trainer_ar: string | null } | null;
  welcome?: { text_ar: string; at: string; voice_sec: number | null; trainer_ar: string | null } | null; /* P64 */
  first_why?: { id: number; body_ar: string | null; at: string; state: 'sealed' | 'today' | 'ready' | 'opened'; opens_ar: string } | null; /* P64 */
  stations: { station: 30 | 90 | 365; written: boolean }[];
  cohort_opened: boolean; threads_after: number;
};
export function buildCards(src: Sources, program: { id: string }, w: { from: string; to: string }): { cards: Card[]; counts: Counts } {
  const key = `program:${program.id}`;
  const kept = src.threads.filter((t) => t.status === 'kept' && (inWindow(t.decided_at, w) || t.from === key || t.to === key)).sort((a, b) => String(a.decided_at || '').localeCompare(String(b.decided_at || '')));
  const first = kept.find((t) => t.note_ar && t.note_ar.trim().length > 0) || null;
  const replies = src.replies.filter((r) => inWindow(r.at, w)); const textReplies = replies.filter((r) => r.text && r.text.trim()).slice(0, GRAD_LIMITS.repliesMax);
  const chapters = src.chapters.filter((c) => inWindow(c.at, w)).slice(0, GRAD_LIMITS.chaptersMax);
  const cards: Card[] = [];
  if (src.farewell) cards.push({ key: 'farewell', title_ar: CARD_AR.farewell, text_ar: src.farewell.text_ar, at: src.farewell.at, voice_sec: src.farewell.voice_sec || null, state_ar: src.farewell.trainer_ar || null });
  if (src.welcome) cards.push({ key: 'welcome', title_ar: CARD_AR.welcome, text_ar: src.welcome.text_ar, at: src.welcome.at, voice_sec: src.welcome.voice_sec || null, state_ar: src.welcome.trainer_ar || null }); /* P64 */
  if (src.first_why) cards.push({ key: 'first_why', title_ar: CARD_AR.first_why, text_ar: src.first_why.state === 'opened' ? src.first_why.body_ar : null, at: src.first_why.at, href: `/me/letter#letter-${src.first_why.id}`, state_ar: src.first_why.state === 'opened' ? null : `مختوم — يُفتح ${src.first_why.opens_ar} بيدك في «رسالة إلى نفسي»` }); /* P64 */
  if (first) cards.push({ key: 'first_because', title_ar: CARD_AR.first_because, text_ar: `لأن ${String(first.note_ar).replace(/^لأن\s*/, '')}`, at: first.decided_at });
  if (textReplies.length) cards.push({ key: 'replies', title_ar: CARD_AR.replies, text_ar: null, at: textReplies[0].at, items: textReplies.map((r) => ({ text_ar: String(r.text), at: r.at })) });
  if (chapters.length) cards.push({ key: 'chapters', title_ar: CARD_AR.chapters, text_ar: null, at: chapters[0].at, items: chapters.map((c) => ({ text_ar: c.title_ar, at: c.at })) });
  if (src.cohort_line) cards.push({ key: 'cohort_line', title_ar: CARD_AR.cohort_line, text_ar: src.cohort_line.body_ar, at: src.cohort_line.created_at, state_ar: 'يُفتح للدفعة بعد سنة من نهاية البرنامج — بلا اسمك' });
  if (src.grad_letter) cards.push({ key: 'grad_letter', title_ar: CARD_AR.grad_letter, text_ar: null, at: null, href: `/me/letter#letter-${src.grad_letter.id}`, state_ar: src.grad_letter.state === 'opened' ? 'فُتحت — اقرأها في مكتب رسائلك' : src.grad_letter.state === 'sealed' ? `مختومة — تُفتح ${src.grad_letter.opens_ar} الساعة ${src.grad_letter.open_hour_ar}` : `تُفتح اليوم الساعة ${src.grad_letter.open_hour_ar}` });
  if (src.map_code) cards.push({ key: 'map_code', title_ar: CARD_AR.map_code, text_ar: src.map_code.code, at: src.map_code.created_at, href: `/verify/map?code=${encodeURIComponent(src.map_code.code)}` });
  const counts: Counts = { threads: kept.length, replies: replies.length, amanat: replies.filter((r) => r.voice).length, chapters: src.chapters.filter((c) => inWindow(c.at, w)).length, days: 0 };
  return { cards, counts };
}
export function sinceThen(src: Sources, endDay: string, now: Date): Since {
  const st = (n: 30 | 90 | 365) => src.stations.some((s) => Number(s.station) === n && s.written);
  return { threads_after: src.threads_after, stations: { 30: st(30), 90: st(90), 365: st(365) }, letter_opened: src.grad_letter?.state === 'opened', cohort_opened: src.cohort_opened, days_since: daysSince(endDay, now) };
}
export function sinceLinesAr(s: Since): string[] {
  const out: string[] = [];
  if (s.threads_after > 0) out.push(`ما زال ينسج: ${s.threads_after} ${s.threads_after === 1 ? 'خيط' : 'خيوط'} بعد التخرّج`);
  const done = ([30, 90, 365] as const).filter((k) => s.stations[k]); if (done.length) out.push(`محطات ما بعد البرنامج: ${done.map((k) => (k === 30 ? 'شهر ✓' : k === 90 ? '3 أشهر ✓' : 'سنة ✓')).join(' · ')}`);
  if (s.letter_opened) out.push('فتح رسالته إلى نفسه');
  if (s.cohort_opened) out.push('قرأ ظرف دفعته');
  return out;
}

/* ───────── الجسم المختوم والوجه العام ───────── */
export type GradBody = { v: 'p63'; code: string; program: { id: string; name_ar: string; start: string | null; end: string }; name: string; line_ar: string; cards: Card[]; counts: Counts; sealed_at: string };
export function gradBody(v: { code: string; program: GradBody['program']; name: string; line_ar: string; cards: Card[]; keep: Record<CardKey, boolean>; counts: Counts; sealed_at: string }): GradBody {
  const cards = v.cards.filter((c) => v.keep[c.key] !== false).map((c) => ({ ...c, voice_sec: undefined })); /* الصوت لا يدخل الجسم */
  return { v: 'p63', code: v.code, program: v.program, name: v.name, line_ar: v.line_ar, cards, counts: { ...v.counts, days: daysBetween(v.program.start || v.program.end, v.program.end) }, sealed_at: v.sealed_at };
}
export type PublicFace = { code: string; program_ar: string; end: string; sealed_at: string; name: string | null; line_ar: string | null; counts: Counts | null; cards: Card[]; since_ar: string[] | null; revoked: boolean; intact: boolean };
export function publicFace(body: GradBody, keys: PublicKey[], opts: { since?: Since | null; revoked?: boolean; intact?: boolean } = {}): PublicFace {
  const on = new Set(keys); const allowed: Set<string> = new Set(['farewell', 'first_because', 'replies', 'chapters', 'cohort_line', 'map_code', 'welcome', 'first_why'].filter((k) => on.has(k as PublicKey)));
  return {
    code: body.code, program_ar: body.program.name_ar, end: body.program.end, sealed_at: body.sealed_at, name: on.has('name') ? body.name : null, line_ar: on.has('line') ? body.line_ar : null,
    counts: on.has('counts') ? body.counts : null, cards: body.cards.filter((c) => allowed.has(c.key) && c.key !== 'grad_letter').map((c) => ({ ...c, href: c.key === 'map_code' ? c.href : null })),
    since_ar: on.has('since') && opts.since ? sinceLinesAr(opts.since) : null, revoked: !!opts.revoked, intact: opts.intact !== false,
  };
}
/** سطر الدفعة والاعتماد والنبض — أعداد فقط عند k ≥ 5 */
export const cohortLineAr = (n: number, k = GRAD_LIMITS.k) => (n >= k ? `${n} من دفعتك ختموا صفحات تخرّجهم` : null);
export const gradEvidenceLineAr = (n: number, k = GRAD_LIMITS.k) => (n >= k ? `${n} من خرّيجي البرنامج كتبوا صفحة تخرّجهم بأيديهم — بكلماتهم لا باستبيان` : null);
export const pulseGradLineAr = (n: number, k = GRAD_LIMITS.k) => (n >= k ? `${n} من منسوبيكم ختموا صفحة تخرّجهم هذا الشهر — بكلماتهم` : null);
/* الإشعارات */
export const gradDayNotice = (program_ar: string) => ({ title_ar: 'اليوم يومك 🎓 — صفحة تخرّجك جاهزة لتكتملَ بيدك', body_ar: `انتهى «${program_ar}» اليوم. ما كتبتَه بيدك فيه صار صفحة — أكملها بسطرٍ واحد، واختمها إن شئت.` });
export const farewellAskNotice = (program_ar: string, room_code: string, endDay: string) => ({ title_ar: `دفعتك تتخرّج ${fmtDayShortAr(endDay)} — اكتب كلمة الوداع`, body_ar: `شعبة ${room_code} في «${program_ar}» تنهي برنامجها. كلمة الوداع تصل إلى كل متعلّم وتبقى في صفحة تخرّجه.` });
export const fmtDayShortAr = (day: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)); } catch { return day; } };
export const fmtDayAr = (day: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)); } catch { return day; } };
