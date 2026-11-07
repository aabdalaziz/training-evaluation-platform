// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P64 «أول يوم — قال من سبقك» (الاسم الرسمي: صفحة اليوم الأول للمتدرّب) — السجلّ النقي (بلا قاعدة، بلا شبكة)
 *  الفكرة: يوم start_date يفتح للمتدرّب بابٌ يبدأ بكلمة من أَثَر (شكر وتقدير وأمنيات — نصّ إنساني ثابت، لا ذكاء اصطناعي)،
 *  ثم «قال من سبقك»: سطور تخرّج خرّيجي هذا البرنامج (P63 — الوجه العام فقط · خمسة أشخاص على الأقل · سبعة سطور كحدّ · لا أسماء أبدًا)
 *  وما قاله من تدرّب هنا بعد أشهر (P38)، ثم يكتب هو «لماذا جئتُ» — سطرًا يُختم رسالةً إلى نفسه تُفتح يوم تخرّجه (محرّك P62)،
 *  وكلمة استقبال من مدرّبه (P51 بعلامة welcome) تبقى في صفحة تخرّجه. لا درجة ولا تقييم؛ لا أسماء؛ صفر SQL.
 *  التسمية: «أول يوم» لأن الباب يُفتح مرة واحدة في بداية كل برنامج؛ «قال من سبقك» لأن الكلام للخرّيج لا للمنصّة.
 */
export const P64_NAMES_AR = {
  title: 'أول يوم', sub: 'قال من سبقك', official_ar: 'صفحة اليوم الأول للمتدرّب',
  athar: 'شكر وتقدير وأمنيات', said: 'قال من سبقك', after: 'وقالوا بعد أشهر', why: 'لماذا جئتُ', welcome: 'كلمة الاستقبال من مدرّبك', road: 'ما ينتظرك في أَثَر', mates: 'شعبتك',
} as const;
export const FIRST_PATH = '/me/first';
export const FIRST_LIMITS = { k: 5, show: 7, whyMin: 10, whyMax: 160, windowDays: 7, welcomeBeforeDays: 1, afterMax: 3 } as const;
export const WHY_PROMPT_AR = 'لماذا جئتُ إلى هذا البرنامج؟ — سطر واحد يُختم اليوم ويُفتح لك يوم تخرّجك.';
export const FIRST_FOOT_AR = 'لا تدخل هذه الصفحة في أي تقييم أو درجة. لا يكتبها ذكاء اصطناعي. ما تقرؤه هنا كتبه خرّيجون بأيديهم واختاروا إظهاره بلا أسماء؛ وما تكتبه أنت يبقى لك وحدك حتى يوم تخرّجك.';

/* ───────── أَثَر يقول — نصّ ثابت بقلم إنسان (يُخصَّص بالاسم الأول واسم البرنامج فقط) ───────── */
export type AtharWord = { thanks_ar: string; appreciation_ar: string; wishes_ar: string; signed_ar: string };
export function atharWelcome(firstName: string | null | undefined, programAr: string): AtharWord {
  const n = String(firstName || '').trim(); const you = n ? `يا ${n}` : 'يا صديقنا';
  return {
    thanks_ar: `شكرًا ${you}. لأنك اخترتَ أن تبدأ — وأن تبدأ هنا.`,
    appreciation_ar: `نقدّر أنك جئتَ إلى «${programAr}» بوقتك وجهدك واسمك، وأن وراء كل اسم في هذه الشعبة حكايةً جاءت به إلى هنا. هذا وحده بدايةُ أثر.`,
    wishes_ar: 'أمنيتنا لك: أن تخرج من هذا البرنامج بشيءٍ تُطبّقه، وبسطرٍ تقوله لمن يأتي بعدك — كما قال لك من سبقك.',
    signed_ar: '— أَثَر',
  };
}

/* ───────── الطور والنافذة ───────── */
export type FirstPhase = 'before' | 'first' | 'week' | 'later';
export const dayKey = (d: string) => String(d || '').slice(0, 10);
export const addDaysKey = (day: string, n: number) => new Date(new Date(`${dayKey(day)}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
export const daysBetweenKeys = (a: string, b: string) => Math.round((new Date(`${dayKey(b)}T00:00:00Z`).getTime() - new Date(`${dayKey(a)}T00:00:00Z`).getTime()) / 86400000);
/** الطور حسب يوم الرياض: قبل البداية · اليوم الأول · الأسبوع الأول (حتى 7 أيام) · لاحقًا */
export function firstPhase(startDay: string, todayRiyadh: string): FirstPhase {
  const s = dayKey(startDay); if (!s) return 'later'; if (todayRiyadh < s) return 'before'; if (todayRiyadh === s) return 'first';
  return daysBetweenKeys(s, todayRiyadh) <= FIRST_LIMITS.windowDays ? 'week' : 'later';
}
/** نافذة كتابة «لماذا جئتُ»: من يوم البداية حتى سبعة أيام بعده (لا رجعية) */
export const canWriteWhy = (phase: FirstPhase) => phase === 'first' || phase === 'week';
export const windowUntil = (startDay: string) => addDaysKey(startDay, FIRST_LIMITS.windowDays);
/** الصفحة تُفتح من يوم البداية حتى نهاية البرنامج (ولمن بدأ قبل اليوم بلا إشعار رجعي) */
export function firstOpen(startDay: string | null | undefined, endDay: string | null | undefined, todayRiyadh: string): boolean {
  const s = dayKey(startDay || ''); if (!s || todayRiyadh < s) return false; const e = dayKey(endDay || ''); return !e || todayRiyadh <= e;
}

/* ───────── «قال من سبقك» — اختيار السطور: أشخاص مختلفون ≥ k · خلط يومي ثابت · ≤ show · لا أسماء ───────── */
export type GradLine = { user_id: string; line_ar: string; sealed_at: string | null };
const fnv = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const mulberry = (seed: number) => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export function pickLines(rows: GradLine[], seedKey: string, k = FIRST_LIMITS.k, show = FIRST_LIMITS.show): { shown: boolean; n: number; lines: string[] } {
  const byUser = new Map<string, string>();
  for (const r of rows) { const u = String(r.user_id || ''); const t = String(r.line_ar || '').trim(); if (!u || !t || byUser.has(u)) continue; byUser.set(u, t); }
  const n = byUser.size; if (n < k) return { shown: false, n, lines: [] };
  const all = [...byUser.values()]; const rnd = mulberry(fnv(seedKey));
  for (let i = all.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return { shown: true, n, lines: all.slice(0, show) };
}
export const belowKLineAr = (n: number) => (n === 0 ? 'أنت من أوائل من يبدأ هنا — سطرك يوم تخرّجك سيكون أول ما يقرؤه من يأتي بعدك.' : `كتب ${n} من خرّيجي هذا البرنامج سطرهم؛ تظهر السطور حين يبلغون خمسة — بلا أسماء.`);
export const saidHeadAr = (n: number) => `من ${n} خرّيجًا كتبوا سطرهم يوم تخرّجهم — بلا أسماء، ولا يُطلب منهم شيء`;

/* ───────── «لماذا جئتُ» ───────── */
export function validateWhy(b: { body_ar?: unknown }): string | null {
  const t = String(b.body_ar || '').trim();
  if (t.length < FIRST_LIMITS.whyMin) return `اكتب ${FIRST_LIMITS.whyMin} أحرف على الأقل — سطر واحد يكفي`;
  if (t.length > FIRST_LIMITS.whyMax) return `السطر أطول من ${FIRST_LIMITS.whyMax} حرفًا`;
  return null;
}
export const WHY_CONTEXT = 'first_day' as const; export const WHY_PROMPT_KEY = 'why_came' as const;
export const matesLineAr = (n: number) => (n >= FIRST_LIMITS.k ? `معك في شعبتك ${n} متدرّبًا بدؤوا اليوم نفسه.` : null);
export const whyCountLineAr = (n: number, k = FIRST_LIMITS.k) => (n >= k ? `${n} من شعبتك كتبوا «لماذا جئتُ»` : null);

/* ───────── «ما ينتظرك في أَثَر» — خارطة الطريق الثابتة ───────── */
export type RoadStep = { when_ar: string; what_ar: string; href: string };
export const ROAD: RoadStep[] = [
  { when_ar: 'اليوم', what_ar: 'سطر «لماذا جئتُ» — يُختم ويُفتح لك يوم تخرّجك', href: '/me/first' },
  { when_ar: 'كل يوم', what_ar: 'كلمة من مدرّبك في «دفتر اليوم» — وردّك عليها إن شئت', href: '/me' },
  { when_ar: 'كل أسبوع', what_ar: '«صدى الأسبوع» — ما قالته شعبتك بلا أسماء', href: '/me' },
  { when_ar: 'في أثناء البرنامج', what_ar: '«خريطة أثرك» و«لأن… بصوتك» و«نسيج الشعبة»', href: '/me/athar-map' },
  { when_ar: 'متى شئت', what_ar: '«رسالة إلى نفسي» — تُفتح بعد شهر أو سنة أو يوم تخرّجك', href: '/me/letter' },
  { when_ar: 'يوم تخرّجك', what_ar: '«يوم تخرّجي — بكلماتي» — صفحة تجمع ما كتبتَه بيدك وتختمها أنت', href: '/me/grad' },
  { when_ar: 'بعد شهر · ثلاثة · سنة', what_ar: '«ما بعد البرنامج» — محطات بكلماتك، ورسالة السنة', href: '/me/after' },
];

/* ───────── الإشعارات (داخل أَثَر؛ «اليوم يومك الأول» وحده يُدفع) ───────── */
export const firstDayNotice = (program_ar: string) => ({ title_ar: 'اليوم يومك الأول 🌅 — قال من سبقك كلمة لك', body_ar: `يبدأ «${program_ar}» اليوم. كلمة من أَثَر، وسطور من خرّيجي هذا البرنامج، وسطرٌ تكتبه أنت يُفتح يوم تخرّجك.` });
export const welcomeAskNotice = (program_ar: string, room_code: string, startDay: string) => ({ title_ar: `دفعة جديدة تبدأ ${fmtDayShortAr(startDay)} — اكتب كلمة الاستقبال`, body_ar: `شعبة ${room_code} في «${program_ar}» تبدأ غدًا. كلمة الاستقبال تصل إلى كل متعلّم في أول يوم وتبقى في صفحة تخرّجه.` });
export const lineAwaitsNotice = (program_ar: string, n: number) => ({ title_ar: `سطرك ينتظر ${n} متدرّبًا جديدًا 🌅`, body_ar: `بدأت اليوم دفعة جديدة في «${program_ar}» — سطر تخرّجك من أول ما يقرؤونه، بلا اسمك. شكرًا لأنك تركتَه لهم.` });
export const fmtDayShortAr = (day: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dayKey(day)}T00:00:00Z`)); } catch { return day; } };
export const fmtDayAr = (day: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dayKey(day)}T00:00:00Z`)); } catch { return day; } };
