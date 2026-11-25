// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار — بطاقة «الترحيب قبل الموعد» (دعوة لها نافذة لم تُفتح بعد)
 *  بدل «عُد في الموعد»: ترحيب بأَثَر ومِعيار · اسم الدعوة · موعد الجلسة كاملًا بتوقيت الزائر · إرشادات · تمنٍّ وتحية.
 *  نصوص ar/en/fr (والباقي يرث en). دوال خالصة قابلة للاختبار. */

export type InvitePreview = { code: string; label_ar: string; lang: string; opens_at: string | null; expires_at: string | null; location?: string | null; client_name?: string | null; recipient_name?: string | null };

type W = { title: string; hello: string; about_athar: string; about_miaar: string; session: string; from_to: string; until: string; opens_in: string; days: string; hours: string; minutes: string; tips_k: string; tips: string[]; auto: string; luck: string; regards: string; team: string; refresh: string; label_k: string; where_k: string; by_k: string };

const TXT: Record<'ar' | 'en' | 'fr', W> = {
  ar: {
    title: 'مرحبًا بك في مِعيار', hello: 'أهلًا {name}',
    about_athar: 'أَثَر منصّة تعليم وتدريب تُعنى بتعليم اللغة العربية للناطقين بغيرها، وتقيس أثر التعلّم لا حضوره.',
    about_miaar: 'مِعيار اختبار تكيّفي لتحديد مستواك في العربية وفق الإطار الأوروبي المرجعي (A1 إلى C2) — يختار كل سؤال بحسب إجابتك السابقة، فلا يطول ولا يُحرج.',
    session: 'موعد اختبارك', from_to: '{day} — من {from} إلى {to}', until: 'يبقى الرابط مفتوحًا حتى {to}', opens_in: 'يُفتح بعد {t}', days: '{n} يوم', hours: '{n} ساعة', minutes: '{n} دقيقة',
    tips_k: 'قبل أن تبدأ', tips: ['المدة نحو 30 إلى 50 دقيقة — لا يحتاج حسابًا.', 'مكان هادئ وسمّاعات (جزء الاستماع) وكاميرا مفعّلة.', 'ستكتب اسمك وبريدك كما تريد أن يظهرا في تقرير المستوى.'],
    auto: 'يُفعَّل هذا الرابط نفسه تلقائيًّا في الموعد — احتفظ به وافتحه حينها.',
    luck: 'نتمنّى لك التوفيق — وشكرًا لثقتك.', regards: 'مع خالص تحيّاتنا،', team: 'فريق أَثَر · مِعيار', refresh: 'تحديث الصفحة', label_k: 'الدعوة', where_k: 'المكان', by_k: 'بطلب من',
  },
  en: {
    title: 'Welcome to Mi\'yar', hello: 'Hello {name}',
    about_athar: 'Athar is a learning and training platform dedicated to teaching Arabic to speakers of other languages — it measures the impact of learning, not mere attendance.',
    about_miaar: 'Mi\'yar is an adaptive Arabic placement test aligned with the CEFR (A1 to C2): each question is chosen from your previous answer, so it stays short and fair.',
    session: 'Your test session', from_to: '{day} — from {from} to {to}', until: 'The link stays open until {to}', opens_in: 'Opens in {t}', days: '{n} d', hours: '{n} h', minutes: '{n} min',
    tips_k: 'Before you start', tips: ['About 30 to 50 minutes — no account needed.', 'A quiet place, headphones (listening part) and your camera enabled.', 'You will enter your name and email as you want them on your level report.'],
    auto: 'This very link activates automatically at the scheduled time — keep it and open it then.',
    luck: 'We wish you every success — and thank you for your trust.', regards: 'Kind regards,', team: 'The Athar · Mi\'yar team', refresh: 'Refresh', label_k: 'Invitation', where_k: 'Venue', by_k: 'Requested by',
  },
  fr: {
    title: 'Bienvenue sur Mi\'yar', hello: 'Bonjour {name}',
    about_athar: 'ATHAR est une plateforme d\'apprentissage et de formation dédiée à l\'enseignement de l\'arabe aux non-arabophones — elle mesure l\'impact de l\'apprentissage, pas seulement la présence.',
    about_miaar: 'Mi\'yar est un test de positionnement adaptatif en arabe, aligné sur le CECRL (A1 à C2) : chaque question est choisie d\'après votre réponse précédente, le test reste donc court et équitable.',
    session: 'Votre session de test', from_to: '{day} — de {from} à {to}', until: 'Le lien reste ouvert jusqu\'au {to}', opens_in: 'Ouverture dans {t}', days: '{n} j', hours: '{n} h', minutes: '{n} min',
    tips_k: 'Avant de commencer', tips: ['Durée : environ 30 à 50 minutes — sans création de compte.', 'Un endroit calme, des écouteurs (partie compréhension orale) et la caméra activée.', 'Vous saisirez votre nom et votre e-mail tels qu\'ils figureront sur votre rapport de niveau.'],
    auto: 'Ce même lien s\'activera automatiquement à l\'heure prévue — conservez-le et ouvrez-le à ce moment-là.',
    luck: 'Nous vous souhaitons plein succès — et merci de votre confiance.', regards: 'Avec nos salutations les plus cordiales,', team: 'L\'équipe ATHAR · Mi\'yar', refresh: 'Actualiser la page', label_k: 'Invitation', where_k: 'Lieu', by_k: 'À la demande de',
  },
};

export const welcomeText = (lang: string): W => TXT[(lang === 'ar' || lang === 'fr' ? lang : 'en') as 'ar' | 'en' | 'fr'];
export const fillW = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

const LOCALE: Record<string, string> = { ar: 'ar-u-nu-latn', fr: 'fr-FR', en: 'en-GB', de: 'de-DE', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', tr: 'tr-TR', nl: 'nl-NL', ru: 'ru-RU', id: 'id-ID', ms: 'ms-MY', ur: 'ur-PK', zh: 'zh-CN' };
export const localeOf = (lang: string) => LOCALE[lang] || lang || 'en-GB';

/** صياغة موعد الجلسة بتوقيت الزائر (أو timeZone مُمرَّر للاختبارات). */
export function sessionLine(p: Pick<InvitePreview, 'opens_at' | 'expires_at'>, lang: string, timeZone?: string): { main: string; extra: string | null } | null {
  if (!p.opens_at) return null;
  const w = welcomeText(lang); const loc = localeOf(lang); const o = new Date(p.opens_at); const e = p.expires_at ? new Date(p.expires_at) : null;
  const tz = timeZone ? { timeZone } : {};
  const dayF = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz });
  const timeF = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, ...tz });
  const tzF = new Intl.DateTimeFormat(loc, { timeZoneName: 'short', ...tz });
  const tzName = (tzF.formatToParts(o).find((x) => x.type === 'timeZoneName') || { value: '' }).value;
  const sameDay = !!e && dayF.format(o) === dayF.format(e);
  if (e && sameDay) return { main: fillW(w.from_to, { day: dayF.format(o), from: timeF.format(o), to: timeF.format(e) }) + (tzName ? ` (${tzName})` : ''), extra: null };
  const main = `${dayF.format(o)} — ${timeF.format(o)}${tzName ? ` (${tzName})` : ''}`;
  return { main, extra: e ? fillW(w.until, { to: `${dayF.format(e)} ${timeF.format(e)}` }) : null };
}

/** «يُفتح بعد …» — أيام/ساعات/دقائق؛ null إن كان الموعد قد حلّ. */
export function opensIn(opens_at: string | null, lang: string, now: number = Date.now()): string | null {
  if (!opens_at) return null; const ms = Date.parse(opens_at) - now; if (!(ms > 0)) return null;
  const w = welcomeText(lang); const m = Math.ceil(ms / 60000); const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60); const mi = m % 60;
  const parts: string[] = []; if (d) parts.push(fillW(w.days, { n: d })); if (h) parts.push(fillW(w.hours, { n: h })); if (!d && mi) parts.push(fillW(w.minutes, { n: mi }));
  return fillW(w.opens_in, { t: parts.join(' ') || fillW(w.minutes, { n: 1 }) });
}
