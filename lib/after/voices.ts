// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P39 «أصوات حول الشهادة» — متابعة أثر التدريب، المستوى الثاني (دوال صافية، بلا اعتماديات خادم)
 *  في P38 صار للشهادة صوت واحد: صاحبها يكتب ما فعل. هنا أربعة أصوات حولها — من غير أن تمسّ قاعدتها
 *  (كلمات لا أرقام · لا أثر رجعي · k≥5 · الإنسان يعتمد):
 *   1) صوت المتدرّب من الماضي — «رسالة إلى نفسي بعد سنة»: تُكتب في آخر أيام البرنامج وتُختم، وتُفتح مع محطة السنة. خاصة دائمًا.
 *   2) صوت البرنامج — «البرنامج يردّ»: حين يكتب خمسة «لم تسنح الفرصة» يعرض البرنامج ورشة تطبيق — إنسان يكتب العرض ويقرّر.
 *   3) صوت الجهة — «محطة الجهة»: بعد سنة تكتب الجهة سطرها هي: ماذا تغيّر عندنا؟ (حالة بالكلمات + نصّ) — تُفتح بخمسة منسوبين.
 *   4) صوت القياس — «أثر بعد» في مِعيار: مستوى الالتحاق وآخر قياس بعد البرنامج إلى جوار كلمات المتدرّب — بخياره.
 */
import { scrubPii, cleanText } from '../onair/registry';
import { stationWindow, stationPhase, bandAr, addDays, AFTER_K } from './registry';
import type { StationRow } from './registry';
import type { OrgChapter } from '../org-journey/registry';

export const P39_NAMES_AR = {
  phase: 'أصوات حول الشهادة', official: 'متابعة أثر التدريب — المستوى الثاني',
  letter: 'رسالة إلى نفسي بعد سنة', letter_opened: 'ما قلته لنفسك قبل سنة',
  offer: 'البرنامج يردّ', offer_official: 'ورشة تطبيق بعد البرنامج',
  org: 'محطة الجهة', org_said: 'وقالت الجهة', measure: 'قياسك في مِعيار',
} as const;

/* ───────── 1) رسالة إلى نفسي بعد سنة ───────── */
export const LETTER_MIN = 40; export const LETTER_MAX = 600; export const LETTER_BEFORE_DAYS = 7;
export const LETTER_QUESTION_AR = 'بعد سنة، ما الذي تتمنى أن تكون قد فعلته بما تعلّمت؟';
export const LETTER_PRIVACY_AR = 'تُختم فورًا: لا تراها أنت ولا غيرك ولا الذكاء الاصطناعي حتى تُفتح مع محطة السنة — ولا تُنشر أبدًا.';
export type LetterRow = { id: number | string; enrollment_id: string; program_id: string; user_id: string | null; email: string; text_ar: string; sealed_at: string; opened_at: string | null; in_doc: boolean };
export type LetterPhase = 'future' | 'open' | 'missed' | 'sealed' | 'opened';
const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** نافذة الكتابة: من end_date − 7 إلى إغلاق نافذة محطة الشهر (end_date + 44) */
export function letterWindow(endDay: string): { opens: string; closes: string; unseals: string } {
  return { opens: addDays(endDay, -LETTER_BEFORE_DAYS), closes: stationWindow(endDay, 30).closes, unseals: stationWindow(endDay, 365).opens };
}
export function letterPhase(endDay: string, row: Pick<LetterRow, 'opened_at'> | null | undefined, now = new Date()): LetterPhase {
  if (row) return row.opened_at ? 'opened' : 'sealed';
  const w = letterWindow(endDay); const today = ymd(now);
  if (today < w.opens) return 'future'; if (today > w.closes) return 'missed'; return 'open';
}
export const LETTER_PHASE_AR: Record<LetterPhase, string> = { future: 'تُكتب في آخر أيام البرنامج', open: 'يمكنك كتابتها الآن', missed: 'فات وقتها — تبقى بلا رسالة', sealed: 'مختومة حتى محطة السنة', opened: 'فُتحت' };
export function canWriteLetter(endDay: string, row: Pick<LetterRow, 'opened_at'> | null | undefined, now = new Date()): { ok: true } | { ok: false; error: string } {
  const ph = letterPhase(endDay, row, now);
  if (ph === 'sealed' || ph === 'opened') return { ok: false, error: 'كتبتَ رسالتك وخُتمت — لا تُعدَّل' };
  if (ph === 'future') return { ok: false, error: `تُكتب الرسالة من ${letterWindow(endDay).opens}` };
  if (ph === 'missed') return { ok: false, error: 'فات وقت الرسالة — تبقى بلا رسالة، ولا كتابة بأثر رجعي' };
  return { ok: true };
}
export function cleanLetter(s: unknown): { ok: true; text_ar: string } | { ok: false; error: string } {
  const t = scrubPii(cleanText(s, LETTER_MAX)); if (t.length < LETTER_MIN) return { ok: false, error: `اكتب من ${LETTER_MIN} حرفًا على الأقل — لنفسك بعد سنة` }; return { ok: true, text_ar: t };
}
/** تُفتح الرسالة حين تدخل محطة السنة نافذتها (بلا كرون جديد: داخل openStations أو عند زيارة المتدرّب) */
export function shouldUnseal(endDay: string, row: Pick<LetterRow, 'opened_at'> | null | undefined, now = new Date()): boolean {
  return !!row && !row.opened_at && ymd(now) >= letterWindow(endDay).unseals;
}
export const LETTER_DOC_LINE_AR = 'كتب لنفسه رسالة يوم أتمّ البرنامج وفتحها بعد سنة';

/* ───────── 2) البرنامج يردّ ───────── */
export const OFFER_K = AFTER_K; export const OFFER_TITLE_MAX = 120; export const OFFER_TEXT_MIN = 20; export const OFFER_TEXT_MAX = 400;
export type OfferRow = { id: number | string; program_id: string; title_ar: string; text_ar: string; link: string | null; created_by: string | null; created_at: string; closed_at: string | null };
export type OfferReply = 'want' | 'no';
export const OFFER_REPLY_AR: Record<OfferReply, string> = { want: 'أرغب', no: 'لا، شكرًا' };
export const OFFER_LINE_AR = 'وردّ البرنامج بورشة تطبيق لمن لم تسنح لهم الفرصة.';
/** كم متدرّبًا مختلفًا كتب «لم تسنح الفرصة» في هذا البرنامج (أيّ محطة) */
export function noChancePeople(rows: Pick<StationRow, 'state' | 'written_at' | 'user_id' | 'email'>[]): number {
  return new Set(rows.filter(r => r.written_at && r.state === 'no_chance').map(r => (r.user_id || r.email || '').toLowerCase()).filter(Boolean)).size;
}
export function offerTrigger(rows: Pick<StationRow, 'state' | 'written_at' | 'user_id' | 'email'>[], k = OFFER_K): { ready: boolean; n: number; k: number; line_ar: string } {
  const n = noChancePeople(rows); const ready = n >= k;
  return { ready, n, k, line_ar: ready ? `${n} لم تسنح لهم الفرصة — هل يردّ البرنامج؟` : `يُعرض الردّ حين يكتب ${k} متدرّبين «لم تسنح الفرصة» — كتب ${n} حتى الآن.` };
}
export function cleanOffer(b: any): { ok: true; o: { title_ar: string; text_ar: string; link: string | null } } | { ok: false; error: string } {
  const title_ar = cleanText(b?.title_ar, OFFER_TITLE_MAX); if (title_ar.length < 3) return { ok: false, error: 'اكتب عنوانًا للعرض' };
  const text_ar = scrubPii(cleanText(b?.text_ar, OFFER_TEXT_MAX)); if (text_ar.length < OFFER_TEXT_MIN) return { ok: false, error: `نصّ العرض من ${OFFER_TEXT_MIN} حرفًا` };
  const raw = String(b?.link || '').trim(); let link: string | null = null;
  if (raw) { if (!/^(https:\/\/[^\s]+|\/[^\s]*)$/.test(raw) || raw.length > 300) return { ok: false, error: 'الرابط: https://… أو مسار داخل أَثَر يبدأ بـ /' }; link = raw; }
  return { ok: true, o: { title_ar, text_ar, link } };
}
/** مسودّة محلية (بلا مفتاح) يكتبها الميسِّر من نصوص «لم تسنح» مجهَّلةً — الطاقم يحرّرها ويقرّر */
export function localOfferDraft(programAr: string, texts: string[]): { title_ar: string; text_ar: string } {
  const n = texts.length; const hint = texts.map(t => t.trim()).filter(t => t.length >= 20).sort((a, b) => a.length - b.length)[0];
  const text = `كتب ${n} منكم بعد «${programAr}» أن الفرصة لم تسنح بعد لتطبيق ما تعلّمتم${hint ? ` — قال أحدكم: «${hint.slice(0, 90)}${hint.length > 90 ? '…' : ''}»` : ''}. نقترح ورشة تطبيق قصيرة نعمل فيها على موقف حقيقي من عملكم، ونخرج منها بخطوة أولى واضحة. إن رغبتم، اضغطوا «أرغب» ونرتّب الموعد.`;
  return { title_ar: `ورشة تطبيق — ${programAr}`.slice(0, OFFER_TITLE_MAX), text_ar: text.slice(0, OFFER_TEXT_MAX) };
}
export function offerPrompt(programAr: string, texts: string[]): { system: string; user: string } {
  return {
    system: 'أنت ميسِّر برامج تدريبية في منصّة «أَثَر». اكتب دعوة قصيرة دافئة لورشة تطبيق بعد البرنامج، موجّهة لمن كتبوا أن الفرصة لم تسنح لهم لتطبيق ما تعلّموه. بلا أسماء ولا أرقام ولا وعود. أجب بـJSON فقط: {"title_ar": "...", "text_ar": "..."} — العنوان ≤ 120 حرفًا والنصّ من 20 إلى 400 حرف.',
    user: JSON.stringify({ program: programAr, what_they_wrote: texts.slice(0, 12).map(t => t.slice(0, 300)) }),
  };
}
export function parseOfferDraft(raw: any, fallback: { title_ar: string; text_ar: string }): { title_ar: string; text_ar: string } {
  const o = raw && typeof raw === 'object' ? raw : {}; const title_ar = cleanText(o.title_ar, OFFER_TITLE_MAX); const text_ar = scrubPii(cleanText(o.text_ar, OFFER_TEXT_MAX));
  return { title_ar: title_ar.length >= 3 ? title_ar : fallback.title_ar, text_ar: text_ar.length >= OFFER_TEXT_MIN ? text_ar : fallback.text_ar };
}

/* ───────── 3) محطة الجهة ───────── */
export const ORG_K = AFTER_K; export const ORG_TEXT_MIN = 40; export const ORG_TEXT_MAX = 600;
export const ORG_STATES = ['changed', 'partly', 'not_yet', 'cannot_judge'] as const;
export type OrgState = (typeof ORG_STATES)[number];
export const ORG_STATE_AR: Record<OrgState, string> = { changed: 'تغيّر ملموس', partly: 'تغيّر جزئي', not_yet: 'لم يتغيّر بعد', cannot_judge: 'لا نستطيع الحكم' };
export const ORG_QUESTION_AR = 'ماذا تغيّر عندنا بعد سنة من هذا البرنامج؟';
export type OrgStationRow = { id: number | string; program_id: string; organization_id: string; state: OrgState | null; text_ar: string | null; public: boolean; written_by: string | null; written_at: string | null; notified_at: string | null };
export type OrgStationPhase = 'future' | 'open' | 'missed' | 'written';
/** محطة الجهة واحدة عند السنة — النافذة نفسها (±14) */
export function orgStationPhase(endDay: string, row: Pick<OrgStationRow, 'written_at'> | null | undefined, now = new Date()): OrgStationPhase { return stationPhase(endDay, 365, row, now); }
export function canWriteOrgStation(endDay: string, members: number, row: Pick<OrgStationRow, 'written_at'> | null | undefined, now = new Date(), k = ORG_K): { ok: true } | { ok: false; error: string } {
  if (members < k) return { ok: false, error: `تُفتح محطة الجهة حين يكون في البرنامج ${k} من منسوبيكم المؤكَّدين — فيه ${members}` };
  const ph = orgStationPhase(endDay, row, now);
  if (ph === 'written') return { ok: false, error: 'كُتبت محطة الجهة — لا تُعدَّل' };
  if (ph === 'future') return { ok: false, error: `تُفتح محطة الجهة في ${stationWindow(endDay, 365).opens}` };
  if (ph === 'missed') return { ok: false, error: 'فاتت محطة الجهة — تبقى فارغة، ولا استكمال بأثر رجعي' };
  return { ok: true };
}
export function cleanOrgStation(b: any): { ok: true; s: { state: OrgState; text_ar: string; public: boolean } } | { ok: false; error: string } {
  const state = String(b?.state || '') as OrgState; if (!ORG_STATES.includes(state)) return { ok: false, error: 'اختاروا حالة واحدة بالكلمات' };
  const t = scrubPii(cleanText(b?.text_ar, ORG_TEXT_MAX)); if (t.length < ORG_TEXT_MIN) return { ok: false, error: `اكتبوا من ${ORG_TEXT_MIN} حرفًا — بصيغة الجهة` };
  return { ok: true, s: { state, text_ar: t, public: !!b?.public } };
}
export type OrgSaid = { org_ar: string; state: OrgState; state_ar: string; text_ar: string; written_at: string };
export function orgSaidLine(s: OrgSaid): string { return `وقالت ${s.org_ar} بعد سنة — ${s.state_ar}: «${s.text_ar}»`; }

/* ───────── 4) أثر بعد في مِعيار ───────── */
export const MEASURE_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const MEASURE_LEVEL_AR: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
export const levelIdx = (l: unknown) => (MEASURE_LEVELS as readonly string[]).indexOf(String(l || '').toUpperCase().replace('-', '_'));
export type Measure = { entry_level: string | null; entry_ar: string | null; after_level: string | null; after_ar: string | null; after_at: string | null; after_code: string | null; steps: number | null; line_ar: string; has_after: boolean };
/** سطر القياس للمتدرّب: مستوى الالتحاق ↔ أول قياس بعد نهاية البرنامج */
export function measureOf(entry: string | null, after: { level: string; at: string; code: string | null } | null): Measure {
  const ei = levelIdx(entry); const entry_level = ei >= 0 ? MEASURE_LEVELS[ei] : null; const entry_ar = entry_level ? MEASURE_LEVEL_AR[entry_level] : null;
  if (!after) return { entry_level, entry_ar, after_level: null, after_ar: null, after_at: null, after_code: null, steps: null, has_after: false, line_ar: entry_ar ? `كنت ${entry_ar} عند الالتحاق — لم تقِس مستواك بعد البرنامج بعد.` : 'لم تقِس مستواك بعد البرنامج بعد.' };
  const ai = levelIdx(after.level); const after_level = ai >= 0 ? MEASURE_LEVELS[ai] : null; const after_ar = after_level ? MEASURE_LEVEL_AR[after_level] : null; const day = String(after.at).slice(0, 10);
  const steps = ei >= 0 && ai >= 0 ? ai - ei : null;
  const line_ar = entry_ar && after_ar ? `كنت ${entry_ar} عند الالتحاق، وقِست ${after_ar} في ${day}${steps !== null ? steps > 0 ? ` — ${steps === 1 ? 'تقدّمت مستوى' : `تقدّمت ${steps} مستويات`}` : steps === 0 ? ' — المستوى نفسه' : ' — أقلّ من مستوى الالتحاق' : ''}.` : after_ar ? `قِست ${after_ar} في ${day}.` : 'قِست مستواك بعد البرنامج.';
  return { entry_level, entry_ar, after_level, after_ar, after_at: after.at, after_code: after.code, steps, has_after: true, line_ar };
}
/** سطر البرنامج العام — من خمسة قاسوا مستواهم بعد البرنامج؛ شرائح بالكلمات لا نسب */
export function programMeasureLine(steps: number[], k = AFTER_K): { shown: boolean; n: number; line_ar: string | null } {
  const n = steps.length; if (n < k) return { shown: false, n, line_ar: null };
  const up = steps.filter(s => s > 0).length; const same = steps.filter(s => s === 0).length;
  const what = up >= same ? `${bandAr(up, n)} تقدّموا مستوى فأكثر` : `${bandAr(same, n)} ثبتوا على مستواهم`;
  return { shown: true, n, line_ar: `وقاس ${n} متدرّبين مستواهم في مِعيار بعد البرنامج: ${what}.` };
}
export const nAr = (n: number) => n === 1 ? 'واحد' : n === 2 ? 'اثنان' : String(n);

/* ───────── رحلة الجهة (P26): فصل «قالت بعد سنة» ───────── */
export function orgAfterChapters(rows: { program_ar: string; written_at: string; state: OrgState }[], quarterOf: (iso: string) => string): OrgChapter[] {
  return rows.filter(r => r.written_at).map(r => ({ key: `${quarterOf(r.written_at)}:org_after:${r.written_at.slice(0, 10)}:${r.program_ar}`, kind: 'org_after' as const, quarter: quarterOf(r.written_at), at: r.written_at, people: null, title_ar: 'قالت الجهة كلمتها بعد سنة من برنامج', what_ar: `بعد سنة من «${r.program_ar}» كتبت الجهة محطتها: ${ORG_STATE_AR[r.state]} — بالكلمات لا بالأرقام، مرة واحدة ولا تُعدَّل.`, theme_ar: null }));
}
