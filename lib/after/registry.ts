// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P38 «الشهادة التي تكبر» — متابعة أثر التدريب (دوال صافية، بلا اعتماديات)
 *  الشهادة لا تُختم يوم انتهاء البرنامج؛ تُفتح: بعد 30 · 90 · 365 يومًا يكتب المتدرّب بكلماته ما فعله بما تعلّم،
 *  ويختار حالة واحدة بالكلمات (لا نجوم ولا نسب)، ويدعو شاهدًا إن شاء. المحطة الفائتة تبقى فارغة — الصدق أهم من الاكتمال.
 *  لا شيء هنا يكتبه الذكاء الاصطناعي؛ خلاصة الميسِّر لهندسة البرامج مسودّة يطلبها إنسان من الطاقم.
 */
import { scrubPii, cleanText } from '../onair/registry';

export const P38_NAMES_AR = { phase: 'الشهادة التي تكبر', official: 'متابعة أثر التدريب', stations: 'محطاتي', chapters: 'فصول بعد البرنامج', said: 'ما قاله من تدرّب هنا', doc: 'أثر بعد', witness: 'شاهد' } as const;
export const STATIONS = [30, 90, 365] as const;
export type Station = (typeof STATIONS)[number];
export const WINDOW_DAYS = 14;            // نافذة كل محطة ± 14 يومًا
export const TEXT_MIN = 40;               // «ما الذي فعلته بما تعلّمت؟» — من 40 حرفًا
export const TEXT_MAX = 1200;
export const WITNESS_MAX = 300;
export const AFTER_K = 5;                 // صفحة البرنامج تتكلم من 5 متدرّبين مختلفين كتبوا محطة الـ90
export const DOC_MIN_WRITTEN = 2;         // وثيقة ATH-AF عند المحطة الثالثة إن كُتبت محطتان فأكثر
export const EXCERPTS_MAX = 3;            // حتى ثلاث شهادات مجهولة يختارها إنسان
export const STATES = ['applied', 'partly', 'no_chance', 'not_useful'] as const;
export type AfterState = (typeof STATES)[number];
export const STATE_AR: Record<AfterState, string> = { applied: 'طبّقته', partly: 'طبّقته جزئيًا', no_chance: 'لم تسنح الفرصة', not_useful: 'لم ينفعني' };
export const STATE_EN: Record<AfterState, string> = { applied: 'I applied it', partly: 'I applied part of it', no_chance: 'No chance yet', not_useful: 'It did not help me' };
export const STATION_AR: Record<Station, string> = { 30: 'بعد شهر', 90: 'بعد ثلاثة أشهر', 365: 'بعد سنة' };
export const STATION_EN: Record<Station, string> = { 30: 'After one month', 90: 'After three months', 365: 'After one year' };
export const QUESTION_AR = 'ما الذي فعلته بما تعلّمت؟';
export const HONESTY_AR = 'الصدق أهم من الاكتمال — «لم ينفعني» إجابة مرحَّب بها، والمحطة التي تفوت تبقى فارغة.';
export const TAGLINE_AR = 'الشهادة لا تُختم يوم انتهاء البرنامج؛ تُفتح.';

export type StationRow = {
  id: number | string; enrollment_id: string; program_id: string; user_id: string | null; email: string; station: Station;
  state: AfterState | null; text_ar: string | null; may_publish: boolean; shown_on_credential: boolean;
  witness_email: string | null; witness_user_id: string | null; witness_status: 'invited' | 'signed' | 'declined' | null; witness_text: string | null; witness_at: string | null;
  notified_at: string | null; written_at: string | null; published_at: string | null; published_by: string | null;
};
export type StationPhase = 'future' | 'open' | 'missed' | 'written';

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => ymd(new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY));

/** نافذة المحطة: تُفتح قبل موعدها بـ14 يومًا وتُغلق بعده بـ14 */
export function stationWindow(endDay: string, station: Station, window = WINDOW_DAYS): { due: string; opens: string; closes: string } {
  const due = addDays(endDay, station); return { due, opens: addDays(due, -window), closes: addDays(due, window) };
}
/** حال المحطة اليوم */
export function stationPhase(endDay: string, station: Station, row: Pick<StationRow, 'written_at'> | null | undefined, now = new Date()): StationPhase {
  if (row?.written_at) return 'written';
  const w = stationWindow(endDay, station); const today = ymd(now);
  if (today < w.opens) return 'future'; if (today > w.closes) return 'missed'; return 'open';
}
export const PHASE_AR: Record<StationPhase, string> = { future: 'لم تحن بعد', open: 'مفتوحة الآن', missed: 'فاتت — تبقى فارغة', written: 'كُتبت' };
/** هل يجوز الكتابة الآن؟ (داخل النافذة ولم تُكتب) */
export function canWrite(endDay: string, station: Station, row: Pick<StationRow, 'written_at'> | null | undefined, now = new Date()): { ok: true } | { ok: false; error: string } {
  const ph = stationPhase(endDay, station, row, now);
  if (ph === 'written') return { ok: false, error: 'كُتبت هذه المحطة — لا تُعدَّل' };
  if (ph === 'future') return { ok: false, error: `المحطة تُفتح في ${stationWindow(endDay, station).opens}` };
  if (ph === 'missed') return { ok: false, error: 'فاتت المحطة — تبقى فارغة، ولا استكمال بأثر رجعي' };
  return { ok: true };
}
/** تنقية ما يُكتب في المحطة */
export function cleanStation(b: any): { ok: true; s: { station: Station; state: AfterState; text_ar: string; may_publish: boolean } } | { ok: false; error: string } {
  const station = Number(b?.station) as Station; if (!STATIONS.includes(station)) return { ok: false, error: 'محطة غير معروفة' };
  const state = String(b?.state || '') as AfterState; if (!STATES.includes(state)) return { ok: false, error: 'اختر حالة واحدة بالكلمات' };
  const t = scrubPii(cleanText(b?.text_ar, TEXT_MAX)); if (t.length < TEXT_MIN) return { ok: false, error: `اكتب من ${TEXT_MIN} حرفًا على الأقل — بكلماتك` };
  return { ok: true, s: { station, state, text_ar: t, may_publish: !!b?.may_publish } };
}
/** الشاهد: يدعوه المتدرّب وحده، ببريد، لمحطة كُتبت، ما لم يوقّع أحد بعد */
export function canInviteWitness(row: Pick<StationRow, 'written_at' | 'witness_status' | 'email'>, email: string): { ok: true } | { ok: false; error: string } {
  if (!row.written_at) return { ok: false, error: 'اكتب المحطة أولًا ثم ادعُ شاهدًا' };
  if (row.witness_status === 'signed') return { ok: false, error: 'وقّع الشاهد — لا يُبدَّل' };
  const e = String(email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: 'أدخل بريد الشاهد' };
  if (e === String(row.email || '').toLowerCase()) return { ok: false, error: 'لا يشهد المرء لنفسه' };
  return { ok: true };
}
export function canAnswerWitness(row: Pick<StationRow, 'witness_email' | 'witness_status'>, meEmail: string): { ok: true } | { ok: false; error: string } {
  if (!row.witness_email || row.witness_status !== 'invited') return { ok: false, error: 'لا دعوة قائمة' };
  if (String(row.witness_email).toLowerCase() !== String(meEmail || '').toLowerCase()) return { ok: false, error: 'الدعوة ليست لك', };
  return { ok: true };
}
export function cleanWitnessText(s: unknown): string { return scrubPii(cleanText(s, WITNESS_MAX)); }

/** الوثيقة: عند المحطة الثالثة (فُتحت نافذتها أو كُتبت) إن كُتبت محطتان فأكثر */
export function docEligible(endDay: string, rows: Pick<StationRow, 'station' | 'written_at'>[], now = new Date()): { ok: true; written: number } | { ok: false; error: string; written: number } {
  const written = rows.filter(r => r.written_at).length; const ph = stationPhase(endDay, 365, rows.find(r => r.station === 365) || null, now);
  if (ph === 'future') return { ok: false, error: `تصدر الوثيقة عند محطة السنة (${stationWindow(endDay, 365).opens})`, written };
  if (written < DOC_MIN_WRITTEN) return { ok: false, error: `تحتاج ${DOC_MIN_WRITTEN} محطتين مكتوبتين على الأقل — كُتبت ${written}`, written };
  return { ok: true, written };
}
export const afterCode = (rnd: () => string) => `ATH-AF-${rnd().slice(0, 4).toUpperCase()}-${rnd().slice(0, 4).toUpperCase()}`;

/** شريحة بالكلمات — لا نسب مئوية */
export function bandAr(n: number, total: number): string {
  if (total <= 0 || n <= 0) return 'لا أحد'; const r = n / total;
  return r >= 0.75 ? 'أكثرهم' : r >= 0.5 ? 'نحو النصف أو أكثر' : r >= 0.25 ? 'قرابة الربع إلى النصف' : 'قلّة';
}
export type ProgramAfter = { shown: boolean; n: number; k: number; states: { key: AfterState; ar: string; band_ar: string; n: number }[]; witnessed: number; excerpts: { station: Station; state: AfterState; text_ar: string; witness_text: string | null }[]; line_ar: string };
/** «ما قاله من تدرّب هنا» — من محطة الـ90 لخمسة متدرّبين مختلفين؛ الاقتباسات ما اعتمده إنسان من بين ما أذن أصحابه */
export function programAfter(rows: StationRow[], k = AFTER_K, now = new Date()): ProgramAfter {
  const ninety = rows.filter(r => r.station === 90 && r.written_at && r.state); const people = new Set(ninety.map(r => (r.user_id || r.email || '').toLowerCase()).filter(Boolean));
  const n = people.size; const shown = n >= k;
  const states = STATES.map(key => { const c = ninety.filter(r => r.state === key).length; return { key, ar: STATE_AR[key], band_ar: shown ? bandAr(c, ninety.length) : '—', n: shown ? c : 0 }; });
  const witnessed = shown ? ninety.filter(r => r.witness_status === 'signed').length : 0;
  const excerpts = shown ? rows.filter(r => r.published_at && r.may_publish && r.text_ar).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, EXCERPTS_MAX).map(r => ({ station: r.station, state: r.state as AfterState, text_ar: String(r.text_ar), witness_text: r.witness_status === 'signed' ? r.witness_text : null })) : [];
  const line_ar = shown ? `كتب ${n} متدرّبين ما فعلوه بعد ثلاثة أشهر: ${states.filter(s => s.n > 0).map(s => `${s.band_ar} ${s.ar === 'طبّقته' ? 'طبّقوه' : s.ar === 'طبّقته جزئيًا' ? 'طبّقوا جزءًا منه' : s.ar === 'لم تسنح الفرصة' ? 'لم تسنح لهم الفرصة' : 'لم ينفعهم'}`).join(' · ')}${witnessed ? ` — وشهد مشرفون على ${witnessed}` : ''}.` : `تتكلم هذه الصفحة حين يكتب ${k} متدرّبين محطة الأشهر الثلاثة — كُتبت ${n} حتى الآن.`;
  void now; return { shown, n, k, states, witnessed, excerpts, line_ar };
}
/** سطر الجهة — منسوبوها (k≥5)، سطر لا رسم */
export function orgAfterLine(rows: StationRow[], k = AFTER_K): { shown: boolean; line_ar: string | null; n: number } {
  const w = rows.filter(r => r.written_at && r.state); const people = new Set(w.map(r => (r.user_id || r.email || '').toLowerCase()));
  if (people.size < k) return { shown: false, line_ar: null, n: people.size };
  const applied = w.filter(r => r.state === 'applied' || r.state === 'partly').length;
  return { shown: true, n: people.size, line_ar: `${people.size} من منسوبيكم كتبوا ما فعلوه بعد برامجهم — ${bandAr(applied, w.length)} طبّقوه كليًّا أو جزئيًا.` };
}
/** سطر «ما شهده أَثَر» للمتدرّب */
export function afterFactLine(rows: Pick<StationRow, 'written_at' | 'witness_status'>[]): string | null {
  const w = rows.filter(r => r.written_at).length; if (!w) return null; const s = rows.filter(r => r.witness_status === 'signed').length;
  return `كتب ${w} ${w === 1 ? 'محطة' : w === 2 ? 'محطتين' : 'محطات'} بعد برامجه${s ? ` وشهد على ${s} منها مشرف` : ''}`;
}
/** مسودّة الميسِّر لهندسة البرامج — من نصوص محطات مجهَّلة؛ محلّي بلا مفتاح */
export function summaryPrompt(input: { program_ar: string; texts: { station: Station; state: AfterState; text: string }[] }) {
  const system = 'أنت ميسِّر في أَثَر. تلخّص ما كتبه متدرّبون بكلماتهم عمّا فعلوه بعد برنامج تدريبي، لمهندس البرنامج البشري. لا تذكر أسماء، لا تقيّم الأشخاص، لا تخترع ما لم يُكتب. أجب بـJSON: {"kept_ar":[..3 جمل: ما نفع فعلًا..],"gaps_ar":[..3 جمل: ما لم ينتقل إلى العمل ولماذا..],"next_ar":[..3 اقتراحات ملموسة للنسخة التالية..]}';
  const user = `البرنامج: ${input.program_ar}\n${input.texts.map(t => `[${STATION_AR[t.station]} · ${STATE_AR[t.state]}] ${t.text}`).join('\n')}`;
  return { system, user };
}
export type AfterSummary = { kept_ar: string[]; gaps_ar: string[]; next_ar: string[] };
export function parseSummary(x: any): AfterSummary | null {
  const arr = (v: any) => Array.isArray(v) ? v.map(s => String(s || '').trim()).filter(Boolean).slice(0, 3) : [];
  const s = { kept_ar: arr(x?.kept_ar), gaps_ar: arr(x?.gaps_ar), next_ar: arr(x?.next_ar) }; return s.kept_ar.length || s.gaps_ar.length || s.next_ar.length ? s : null;
}
export function localSummary(input: { texts: { station: Station; state: AfterState; text: string }[] }): AfterSummary {
  const by = (st: AfterState[]) => input.texts.filter(t => st.includes(t.state)).map(t => t.text.slice(0, 140));
  return { kept_ar: by(['applied', 'partly']).slice(0, 3), gaps_ar: by(['no_chance', 'not_useful']).slice(0, 3), next_ar: ['راجع ما تكرّر في «لم تسنح الفرصة» — غالبًا عائق في بيئة العمل لا في البرنامج', 'حوّل ما تكرّر في «طبّقته» إلى تمرين تطبيقي مبكر في النسخة التالية', 'اسأل من كتب «لم ينفعني» عن محطة الـ365 قبل تعديل الأهداف'] };
}
