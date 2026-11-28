// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P95: صفحة التحقّق /verify بثلاث لغات (عربيّ · فرنسيّ · إنجليزيّ) — ترتيب اللغة: ?lang → المحفوظ → المتصفّح → ar (دوال صافية) */
import { FRANCE } from '../cohorts/france';
import type { CertKind } from './render';
import { KIND_LABEL } from './render';

export type VerifyLang = 'ar' | 'fr' | 'en';
export const VERIFY_LANGS: VerifyLang[] = ['ar', 'fr', 'en'];
export const VERIFY_LANG_KEY = 'tep.verify.lang';
export const VERIFY_LANG_NAMES: Record<VerifyLang, string> = { ar: 'العربية', fr: 'Français', en: 'English' };

export function pickVerifyLang(q: string | null | undefined, stored: string | null | undefined, nav: string | null | undefined): VerifyLang {
  for (const v of [q, stored, nav]) { const c = String(v || '').toLowerCase().slice(0, 2) as VerifyLang; if (VERIFY_LANGS.includes(c)) return c; }
  return 'ar';
}
export const verifyDir = (l: VerifyLang) => (l === 'ar' ? 'rtl' : 'ltr');

/** اسم البرنامج لمجموعة فرنسا يظهر بالفرنسيّة لغير العربيّة؛ غيره كما هو في السجلّ */
export function programLabel(name: string | null | undefined, l: VerifyLang): string {
  if (!name) return '—';
  if (l !== 'ar' && name === FRANCE.certificate.programNameAr) return FRANCE.certificate.programNameFr;
  return name;
}
/** الجهة لغير العربيّة: «أَثَر» → Athar، وما بقي عربيًّا يُعرض كما هو داخل bdi */
export function issuerLabel(s: string | null | undefined, l: VerifyLang): string { const v = String(s || '').trim(); if (!v) return ''; if (l === 'ar') return v; return v.replace(/أَثَر|أثر/g, 'Athar'); }
export function kindLabel(kind: CertKind, l: VerifyLang): string { const k = KIND_LABEL[kind]; return k ? (l === 'ar' ? k.ar : l === 'fr' ? k.fr : k.en) : String(kind); }

type T = {
  title: string; hint: string; placeholder: string; check: string; scan: string; scanTitle: string; scanHint: string; footer: string;
  code: string; loading: string; none: string; error: string; valid: (unit: string) => string; revoked: (d: string) => string;
  kind: string; recipient: string; program: string; period: string; hours: string; issued: string; serial: string; issuer: string; readable: string; accessibility: string; another: string; footNote: string; langLabel: string;
};
export const VERIFY_T: Record<VerifyLang, T> = {
  ar: {
    title: 'التحقق من صحة شهادة', hint: 'أدخل الرقم التسلسلي المطبوع على الشهادة (مثل ATH-2026-000123) أو رمز التحقق المكوّن من 10 رموز، أو امسح رمز QR الموجود على الشهادة.', placeholder: 'ATH-2026-000123', check: 'تحقق',
    scan: 'امسح رمز الشهادة بالكاميرا', scanTitle: 'أَثَر يقرأ — تحقّق', scanHint: 'وجّه الكاميرا إلى رمز QR المطبوع على الشهادة', footer: 'أَثَر — بوّابة أَثَر للتعليم والتدريب والتطوير والجودة',
    code: 'الرمز', loading: 'جارٍ التحقق…', none: 'لا توجد شهادة بهذا الرمز. تأكد من كتابة الرقم التسلسلي كاملًا كما هو مطبوع على الشهادة.', error: 'تعذر التحقق حاليًا.',
    valid: (u) => `شهادة صحيحة وسارية — صادرة من ${u}`, revoked: (d) => `هذه الشهادة ملغاة منذ ${d} ولا يُعتدّ بها`,
    kind: 'نوع الشهادة', recipient: 'اسم المستفيد', program: 'البرنامج', period: 'فترة التنفيذ', hours: 'الساعات التدريبية', issued: 'تاريخ الإصدار', serial: 'الرقم التسلسلي', issuer: 'الجهة المصدِرة',
    readable: 'هذه هي النسخة المقروءة آليًا من الشهادة — نص HTML تقرؤه قارئات الشاشة ويُطبع ويُترجم؛ الصورة في ملف PDF زينة لها لا بديل عنها.', accessibility: 'أَثَر للجميع · بيان الوصول', another: 'تحقق من شهادة أخرى',
    footNote: 'نتيجة التحقق صادرة مباشرة من سجل الشهادات الرسمي للبوّابة ولا تعرض أي بيانات شخصية إضافية.', langLabel: 'اللغة',
  },
  fr: {
    title: 'Vérification d’un certificat', hint: 'Saisissez le numéro de série imprimé sur le certificat (ex. ATH-2026-000123) ou le code de vérification à 10 caractères, ou scannez le QR code du certificat.', placeholder: 'ATH-2026-000123', check: 'Vérifier',
    scan: 'Scanner le QR code du certificat', scanTitle: 'Athar lit — vérification', scanHint: 'Dirigez la caméra vers le QR code imprimé sur le certificat', footer: 'Athar — Portail pour l’éducation, la formation, le développement et la qualité',
    code: 'Code', loading: 'Vérification en cours…', none: 'Aucun certificat ne correspond à ce code. Vérifiez le numéro de série complet tel qu’il est imprimé sur le certificat.', error: 'Vérification impossible pour le moment.',
    valid: (u) => `Certificat authentique et valide — délivré par ${u}`, revoked: (d) => `Ce certificat a été révoqué le ${d} et n’est plus valable`,
    kind: 'Type de certificat', recipient: 'Titulaire', program: 'Programme', period: 'Période', hours: 'Heures de formation', issued: 'Date de délivrance', serial: 'Numéro de série', issuer: 'Autorité émettrice',
    readable: 'Ceci est la version lisible par machine du certificat — un texte HTML que les lecteurs d’écran lisent, qui s’imprime et se traduit ; l’image du PDF n’en est que l’ornement.', accessibility: 'Athar pour tous · déclaration d’accessibilité', another: 'Vérifier un autre certificat',
    footNote: 'Le résultat provient directement du registre officiel des certificats du portail et n’affiche aucune donnée personnelle supplémentaire.', langLabel: 'Langue',
  },
  en: {
    title: 'Certificate verification', hint: 'Enter the serial number printed on the certificate (e.g. ATH-2026-000123) or the 10-character verification code, or scan the QR code on the certificate.', placeholder: 'ATH-2026-000123', check: 'Verify',
    scan: 'Scan the certificate QR code', scanTitle: 'Athar reads — verify', scanHint: 'Point the camera at the QR code printed on the certificate', footer: 'Athar — Portal for Education, Training, Development and Quality',
    code: 'Code', loading: 'Verifying…', none: 'No certificate matches this code. Check the full serial number exactly as printed on the certificate.', error: 'Verification is unavailable right now.',
    valid: (u) => `Authentic and valid certificate — issued by ${u}`, revoked: (d) => `This certificate was revoked on ${d} and is no longer valid`,
    kind: 'Certificate type', recipient: 'Recipient', program: 'Programme', period: 'Period', hours: 'Training hours', issued: 'Issued on', serial: 'Serial number', issuer: 'Issuing authority',
    readable: 'This is the machine-readable version of the certificate — HTML text that screen readers read, that prints and translates; the PDF image is only its ornament.', accessibility: 'Athar for all · accessibility statement', another: 'Verify another certificate',
    footNote: 'The result comes directly from the portal’s official certificate register and shows no additional personal data.', langLabel: 'Language',
  },
};
