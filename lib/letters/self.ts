// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P62 «رسالة إلى نفسي بعد سنة» — الطبعة الثانية (النواة النقيّة، بلا قاعدة بيانات)
 *  الاسم الرسمي: الرسالة المؤجَّلة للمتدرّب / Deferred self-letter · السطر التحتي: «إلى مَن سأكون»
 *  تبني على «رسالة إلى نفسي» في «رحلتي» (P25 · جدول portal_time_capsules) ولا تنشئ جدولًا جديدًا:
 *   • آفاق: 3 أشهر · 6 أشهر · سنة (الافتراضي) · «عند تخرّجي» (تاريخ نهاية البرنامج)
 *   • تُفتح في «ساعة الكتابة» نفسها: deliver_at يحمل ساعة الكتابة ودقيقتها، والصفحة لا تكشف النصّ قبلها
 *   • الفتح المبكّر مسموح (الرسالة ملك صاحبها) لكنه يُوسم بصدق: «فُتحت قبل أوانها بـ N يومًا»
 *   • «ما حدث فعلًا»: مرآة أعداد من بيانات صاحبها فقط منذ كتابتها — لا تقييم ولا نسبة تحقّق ولا ذكاء اصطناعي
 *   • «ردّ على نفسك القديمة» ثم «اكتب الرسالة التالية» → «سلسلة سنواتي»
 *   • «رسالة الدفعة»: سطر واحد مختوم لكل خرّيج، يُفتح للدفعة بعد سنة من نهاية البرنامج إذا كتب ≥ 5 — بلا أسماء
 *  قواعد السفر: الرسالة والردّ لا يسافران (لا مدرّب، لا جهة، لا ملف اعتماد)؛ الصوت يبقى مع صاحبه؛ الحذف فوري؛ الإدارة أعداد فقط.
 */
export const P62_NAMES_AR = {
  title: 'رسالة إلى نفسي بعد سنة', sub: 'إلى مَن سأكون', official_ar: 'الرسالة المؤجَّلة للمتدرّب', official_en: 'Deferred self-letter',
  mirror: 'ما حدث فعلًا', chain: 'سلسلة سنواتي', reply: 'ردّ على نفسك القديمة', next: 'اكتب الرسالة التالية', cohort: 'رسالة الدفعة', early: 'فُتحت قبل أوانها', seal: 'أختم',
} as const;
export const LETTER_PATH = '/me/letter';
export type Horizon = '3m' | '6m' | '1y' | 'grad';
export const HORIZON_DAYS: Record<Exclude<Horizon, 'grad'>, number> = { '3m': 91, '6m': 182, '1y': 365 };
export const HORIZONS: { key: Horizon; label_ar: string; hint_ar: string }[] = [
  { key: '3m', label_ar: 'بعد 3 أشهر', hint_ar: 'قريب — لخطوة تهابها اليوم' },
  { key: '6m', label_ar: 'بعد 6 أشهر', hint_ar: 'منتصف الطريق' },
  { key: '1y', label_ar: 'بعد سنة', hint_ar: 'الافتراضي — سنة كاملة من الأثر' },
  { key: 'grad', label_ar: 'عند تخرّجي', hint_ar: 'يوم نهاية برنامجك' },
];
export const LETTER_LIMITS = { minChars: 40, maxChars: 3000, replyMax: 1500, cohortMax: 160, maxSealed: 3, kCohort: 5, cohortAfterDays: 365, mediaGraceDays: 400 } as const;
export const PROMPTS: { key: string; ar: string }[] = [
  { key: 'learned', ar: 'ما الذي أرجو أن أكون قد تعلّمته؟' },
  { key: 'fear', ar: 'ما الخطوة التي أهابها اليوم؟' },
  { key: 'remind', ar: 'ما الذي أريد أن أذكّر نفسي به؟' },
];
/** بذرة اليوم تتناوب بيوم السنة — فتختلف من يوم لآخر وتثبت خلال اليوم */
export function promptOfDay(now = new Date()): { key: string; ar: string } { const d = Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000); return PROMPTS[d % PROMPTS.length]; }
/** أبواب الكتابة الأربعة (context_key) */
export const DOORS_AR: Record<string, string> = { first_day: 'أول يوم في البرنامج', map_sign: 'يوم توقيع خريطة أثرك', weave: 'أول زيارة لنسيج البرنامج', free: 'من مساحتك' , chain: 'سلسلة سنواتي', grad: 'من «ما بعد البرنامج» / يوم تخرّجي' /* P63 */ };

export type LetterRow = {
  id: number; created_at: string; user_id: string; email: string; body_ar: string; media_id: string | null; kind: string;
  deliver_at: string; delivered_at: string | null; status: 'sealed' | 'delivered' | 'cancelled';
  snapshot_then?: unknown; snapshot_now?: unknown; meta?: Record<string, unknown> | null;
  horizon?: Horizon | null; opened_at?: string | null; opened_early?: boolean | null; reply_ar?: string | null; reply_media_id?: string | null; replied_at?: string | null;
  chain_of?: number | null; prompt_key?: string | null; context_key?: string | null; program_id?: string | null; scope?: 'self' | 'cohort' | null;
};
export type LetterState = 'sealed' | 'today' | 'ready' | 'opened';
/** ما يصل إلى الواجهة — النصّ لا يُرسل قبل الفتح أبدًا */
export type LetterPublic = {
  id: number; created_at: string; deliver_at: string; horizon: Horizon; state: LetterState; days_left: number; open_hour_ar: string; written_ar: string; opens_ar: string;
  has_media: boolean; opened_at: string | null; opened_early: boolean; early_days: number | null; prompt_ar: string | null; door_ar: string | null; chain_of: number | null;
  body_ar: string | null; media_id: string | null; reply_ar: string | null; reply_media_id: string | null; replied_at: string | null; snapshot_then: unknown; snapshot_now: unknown;
};

const RIYADH = 'Asia/Riyadh';
export const fmtDayAr = (iso: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', timeZone: RIYADH }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };
export const openHourAr = (iso: string) => { try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: RIYADH }).format(new Date(iso)); } catch { return String(iso).slice(11, 16); } };
export const dayKeyRiyadh = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: RIYADH, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** موعد الفتح: الأفق الزمني بساعة الكتابة نفسها · «عند تخرّجي» = يوم نهاية البرنامج بساعة الكتابة (يجب أن يكون بعد الغد على الأقل) */
export function deliverAt(written: Date, horizon: Horizon, programEnd?: string | null): { ok: true; at: Date } | { ok: false; error: string } {
  if (horizon !== 'grad') { const days = HORIZON_DAYS[horizon]; if (!days) return { ok: false, error: 'أفق غير معروف' }; return { ok: true, at: addDays(written, days) }; }
  if (!programEnd) return { ok: false, error: 'اختر برنامجًا له تاريخ نهاية' };
  const end = new Date(`${String(programEnd).slice(0, 10)}T${written.toISOString().slice(11, 19)}Z`); if (Number.isNaN(end.getTime())) return { ok: false, error: 'تاريخ نهاية البرنامج غير صالح' };
  if (end.getTime() < written.getTime() + 86400000) return { ok: false, error: 'برنامجك ينتهي قبل الغد — اختر أفقًا آخر' };
  return { ok: true, at: end };
}
export function validateLetter(b: { body_ar?: unknown; media_id?: unknown; horizon?: unknown }): string | null {
  const body = String(b.body_ar || '').trim(); const media = b.media_id ? String(b.media_id) : '';
  if (!media && body.length < LETTER_LIMITS.minChars) return `اكتب لنفسك ${LETTER_LIMITS.minChars} حرفًا على الأقل — أو سجّل صوتك`;
  if (body.length > LETTER_LIMITS.maxChars) return `الرسالة أطول من ${LETTER_LIMITS.maxChars} حرفًا`;
  if (b.horizon !== undefined && !HORIZONS.some((h) => h.key === b.horizon)) return 'أفق غير معروف';
  return null;
}
export function validateReply(b: { reply_ar?: unknown; media_id?: unknown }): string | null {
  const t = String(b.reply_ar || '').trim(); const media = b.media_id ? String(b.media_id) : '';
  if (!t && !media) return 'اكتب ردًّا أو سجّله';
  if (t.length > LETTER_LIMITS.replyMax) return `الردّ أطول من ${LETTER_LIMITS.replyMax} حرفًا`;
  return null;
}
export function validateCohortLine(s: unknown): string | null { const t = String(s || '').trim(); if (t.length < 10) return 'سطر واحد — عشرة أحرف على الأقل'; if (t.length > LETTER_LIMITS.cohortMax) return `سطر الدفعة ${LETTER_LIMITS.cohortMax} حرفًا كحدّ أقصى`; if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) return 'بلا بريد ولا أسماء — سطر مجهول'; return null; }

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
export function letterState(l: Pick<LetterRow, 'deliver_at' | 'opened_at' | 'created_at'>, now = new Date()): { state: LetterState; days_left: number } {
  if (l.opened_at) return { state: 'opened', days_left: 0 };
  const at = new Date(l.deliver_at); if (now.getTime() >= at.getTime()) return { state: 'ready', days_left: 0 };
  if (dayKeyRiyadh(now) === dayKeyRiyadh(at)) return { state: 'today', days_left: 0 };
  return { state: 'sealed', days_left: Math.max(1, Math.ceil((at.getTime() - now.getTime()) / 86400000)) };
}
export const countdownAr = (days: number) => days <= 0 ? 'اليوم' : days === 1 ? 'غدًا' : days === 2 ? 'بعد يومين' : days <= 10 ? `بعد ${days} أيام` : `بعد ${days} يومًا`;
export const earlyAr = (days: number) => days <= 0 ? '' : days === 1 ? 'فُتحت قبل أوانها بيوم' : days === 2 ? 'فُتحت قبل أوانها بيومين' : days <= 10 ? `فُتحت قبل أوانها بـ ${days} أيام` : `فُتحت قبل أوانها بـ ${days} يومًا`;
export const horizonAr = (h: Horizon | null | undefined) => HORIZONS.find((x) => x.key === (h || '1y'))?.label_ar || 'بعد سنة';

/** تحويل صفّ إلى شكل عام — النصّ والصوت يُحجبان ما لم تكن مفتوحة */
export function toPublicLetter(l: LetterRow, now = new Date()): LetterPublic {
  const st = letterState(l, now); const opened = st.state === 'opened'; const earlyDays = opened && l.opened_early && l.opened_at ? Math.max(1, daysBetween(new Date(l.opened_at), new Date(l.deliver_at))) : null;
  const prompt = PROMPTS.find((p) => p.key === l.prompt_key)?.ar || null;
  return {
    id: Number(l.id), created_at: l.created_at, deliver_at: l.deliver_at, horizon: (l.horizon || '1y') as Horizon, state: st.state, days_left: st.days_left, open_hour_ar: openHourAr(l.deliver_at), written_ar: fmtDayAr(l.created_at), opens_ar: fmtDayAr(l.deliver_at),
    has_media: !!l.media_id, opened_at: l.opened_at || null, opened_early: !!l.opened_early, early_days: earlyDays, prompt_ar: prompt, door_ar: l.context_key ? DOORS_AR[l.context_key] || null : null, chain_of: l.chain_of ? Number(l.chain_of) : null,
    body_ar: opened ? l.body_ar : null, media_id: opened ? l.media_id : null, reply_ar: opened ? l.reply_ar || null : null, reply_media_id: opened ? l.reply_media_id || null : null, replied_at: l.replied_at || null, snapshot_then: opened ? l.snapshot_then ?? null : null, snapshot_now: opened ? l.snapshot_now ?? null : null,
  };
}

// ——— «ما حدث فعلًا» — مرآة أعداد من بيانات صاحبها فقط ———
export type MirrorInput = {
  written_at: string; now?: Date;
  chapters: { kind: string; at: string }[];                 // فصول «رحلتي» (buildJourney) — كلها، تُصفّى هنا
  threads: { decided_at: string | null; status: string; from_key: string; to_key: string }[]; // خريطة أثرك
  words: { created_at: string }[];                           // كلمات المدرّب التي وصلت (إشعارات trainer_word)
  letters_written: number;                                   // رسائل أخرى ختمها بعدها (السلسلة)
};
export type MirrorLine = { key: string; label_ar: string; n: number };
const since = (iso: string | null | undefined, from: number, to: number) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) && t >= from && t <= to; };
export function mirrorOf(inp: MirrorInput): { lines: MirrorLine[]; summary_ar: string; quiet: boolean; days: number } {
  const from = Date.parse(inp.written_at); const now = inp.now || new Date(); const to = now.getTime(); const days = Math.max(0, daysBetween(new Date(from), now));
  const ch = inp.chapters.filter((c) => since(c.at, from, to)); const kind = (k: string) => ch.filter((c) => c.kind === k).length;
  const kept = inp.threads.filter((t) => t.status === 'kept' && since(t.decided_at, from, to));
  const lines: MirrorLine[] = [
    { key: 'chapters', label_ar: 'فصل جديد في رحلتك', n: ch.length },
    { key: 'levels', label_ar: 'مستوى مهارة اعتُمد لك', n: kind('level') },
    { key: 'credentials', label_ar: 'شهادة أو اعتماد', n: kind('credential') + kind('badge') },
    { key: 'missions', label_ar: 'مهمة ميدانية مؤكَّدة', n: kind('mission') },
    { key: 'daily', label_ar: 'موقف يومي كتبتَ كيف تعاملت معه', n: kind('daily') },
    { key: 'council', label_ar: 'مجلس أو قضية', n: kind('council') + kind('case') + kind('return') },
    { key: 'threads', label_ar: 'خيط أبقيتَه بيدك في خريطة أثرك', n: kept.length },
    { key: 'program_threads', label_ar: 'خيط منها يمسّ برنامجًا', n: kept.filter((t) => t.from_key.startsWith('program:') || t.to_key.startsWith('program:')).length },
    { key: 'words', label_ar: 'كلمة من مدرّب وصلتك', n: inp.words.filter((w) => since(w.created_at, from, to)).length },
    { key: 'letters', label_ar: 'رسالة أخرى ختمتها لنفسك', n: Math.max(0, inp.letters_written | 0) },
  ].filter((l) => l.n > 0);
  const quiet = lines.length === 0;
  const summary_ar = quiet ? `منذ كتبتَها قبل ${days <= 1 ? 'يوم' : `${days} يومًا`} صفحتك هادئة — وهذا أيضًا خبر تقرؤه أنت لا غيرك.` : `منذ كتبتَها قبل ${days} يومًا: ${lines.slice(0, 4).map((l) => `${l.n} ${l.label_ar}`).join(' · ')}${lines.length > 4 ? ' · …' : ''}. أعداد لا أحكام — أنت من يقرأ.`;
  return { lines, summary_ar, quiet, days };
}

// ——— «سلسلة سنواتي» ———
export type ChainItem = { id: number; written_ar: string; opened: boolean; replied: boolean; horizon_ar: string; early: boolean };
export function chainOf(letters: LetterPublic[]): ChainItem[] {
  return [...letters].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((l) => ({ id: l.id, written_ar: l.written_ar, opened: l.state === 'opened', replied: !!l.replied_at, horizon_ar: horizonAr(l.horizon), early: l.opened_early }));
}

// ——— «رسالة الدفعة» ———
export type CohortLine = { body_ar: string; created_at: string };
/** ظرف الدفعة يُفتح بعد سنة من نهاية البرنامج، التاسعة صباحًا بتوقيت الرياض (06:00Z = ساعة الكرون اليومي) */
export function cohortOpensAt(programEnd: string): Date { const end = new Date(`${String(programEnd).slice(0, 10)}T06:00:00Z`); return Number.isNaN(end.getTime()) ? end : addDays(end, LETTER_LIMITS.cohortAfterDays); }
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
/** ظرف الدفعة: يُفتح بعد موعده وإذا كتب k فأكثر؛ الأسطر تُخلط خلطًا ثابتًا (لا ترتيب زمني يكشف كاتبًا) */
export function cohortEnvelope(lines: CohortLine[], opensAt: Date, now = new Date(), k = LETTER_LIMITS.kCohort): { n: number; ready: boolean; below_k: boolean; opens_ar: string; days_left: number; lines: string[] } {
  const n = lines.length; const due = now.getTime() >= opensAt.getTime(); const ready = due && n >= k;
  const shuffled = ready ? [...lines].sort((a, b) => hashStr(a.body_ar + a.created_at) - hashStr(b.body_ar + b.created_at)).map((l) => l.body_ar) : [];
  return { n, ready, below_k: due && n < k, opens_ar: fmtDayAr(opensAt.toISOString()), days_left: due ? 0 : Math.max(1, Math.ceil((opensAt.getTime() - now.getTime()) / 86400000)), lines: shuffled };
}

// ——— أعداد للإدارة ونبض الجهة (k ≥ 5 · لا محتوى) ———
export function letterCounts(rows: Pick<LetterRow, 'status' | 'opened_at' | 'replied_at' | 'opened_early' | 'scope'>[]): { sealed: number; opened: number; replied: number; early: number; cohort_lines: number } {
  const self = rows.filter((r) => (r.scope || 'self') === 'self' && r.status !== 'cancelled');
  return { sealed: self.filter((r) => !r.opened_at).length, opened: self.filter((r) => !!r.opened_at).length, replied: self.filter((r) => !!r.replied_at).length, early: self.filter((r) => !!r.opened_early).length, cohort_lines: rows.filter((r) => r.scope === 'cohort').length };
}
export function pulseLetterLine(writers: number, k = LETTER_LIMITS.kCohort): string | null { return writers >= k ? `${writers} من منسوبيكم كتبوا رسائل إلى أنفسهم هذا الموسم — تعود إليهم وحدهم.` : null; }

/** نصّ إشعار «يوم الفتح» (داخل أَثَر فقط) */
export function todayNoticeText(l: Pick<LetterRow, 'deliver_at' | 'created_at'>): { title_ar: string; body_ar: string } {
  return { title_ar: `اليوم تُفتح رسالتك إلى نفسك — الساعة ${openHourAr(l.deliver_at)}`, body_ar: `كتبتَها في ${fmtDayAr(l.created_at)}. تُفتح في ساعة كتابتها نفسها، ومعها «ما حدث فعلًا» منذ يومها. لا يقرؤها أحد غيرك.` };
}
export const LETTER_FOOT_AR = 'رسالتك وردّك لا يسافران: لا إلى مدرّب ولا جهة ولا ملف اعتماد. صوتك يبقى معك. الحذف فوري.';
