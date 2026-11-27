// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P89 «الاستبيان بالفرنسيّة» — طبقة نقيّة بلا قاعدة بيانات:
 *  • الأسئلة في الجدول `questions` عربيّة/إنجليزيّة فقط (لا عمود text_fr) — فنترجم في المتصفّح بمفتاح السؤال (question_key)
 *    مع الرجوع إلى الإنجليزيّة لأيّ سؤال جديد غير مترجَم. القيم المحفوظة لا تتغيّر (الخيارات تُخزَّن بنصّها الأصليّ) فالتقارير سليمة.
 *  • نصوص الواجهة الفرنسيّة لصفحة /evaluate/* وعدّة «محطّات» ورسائل «مرّة واحدة» وحالة الرابط.
 *  • نافذة الرابط تُعرض بتوقيت الرياض لا UTC (إصلاح العقبة المعروفة).
 *  • لغة الفتح: ?lang → لغة الرابط (ar/en) → برنامج فرنسيّ: متصفّح عربيّ ← عربيّة وإلّا فرنسيّة → غير ذلك كما كان.
 */
import { FRANCE } from '../cohorts/france';
import { normalizeLinkLang } from './links';

export type EvalLang = 'ar' | 'en' | 'fr';
export const EVAL_LANGS: EvalLang[] = ['ar', 'en', 'fr'];
export const isEvalLang = (v: unknown): v is EvalLang => v === 'ar' || v === 'en' || v === 'fr';
/** البرامج التي تُفتح استبياناتها بالفرنسيّة افتراضيًّا */
export const FR_PROGRAMS: string[] = [FRANCE.programId];

export function resolveEvalLang(opts: { query?: string | null; linkLang?: unknown; programId?: string | null; browser?: string | null }): EvalLang {
  if (isEvalLang(opts.query)) return opts.query;
  const b = String(opts.browser || '').toLowerCase();
  const frProgram = !!opts.programId && FR_PROGRAMS.includes(opts.programId);
  const l = normalizeLinkLang(opts.linkLang);
  if (frProgram) return b.startsWith('ar') ? 'ar' : l === 'en' && !b.startsWith('fr') ? 'en' : 'fr';
  if (l !== 'auto') return l;
  if (!b) return 'ar'; return b.startsWith('ar') ? 'ar' : b.startsWith('fr') ? 'fr' : 'en';
}

/* ───────── نافذة الرابط بتوقيت الرياض ───────── */
const LOCALE: Record<EvalLang, string> = { ar: 'ar-SA-u-ca-gregory-nu-latn', en: 'en-GB', fr: 'fr-FR' };
export function fmtRiyadh(iso: string | null | undefined, lang: EvalLang = 'ar'): string {
  if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(LOCALE[lang], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Riyadh' });
}
const TZ_NOTE: Record<EvalLang, string> = { ar: 'بتوقيت الرياض', en: 'Riyadh time', fr: 'heure de Riyad' };
export function windowText(state: 'before' | 'after' | 'off' | 'open', link: { opens_at?: string | null; closes_at?: string | null } | null | undefined, lang: EvalLang): string {
  if (state === 'open') return '';
  const o = fmtRiyadh(link?.opens_at, lang), c = fmtRiyadh(link?.closes_at, lang), tz = TZ_NOTE[lang];
  if (state === 'off') return { ar: 'انتهى هذا الرابط — اطلب رابطًا جديدًا من ميسّرك أو إدارة البرنامج.', en: 'This link has expired — ask your trainer or the program office for a new one.', fr: 'Ce lien a expiré — demandez-en un nouveau à votre formatrice ou au bureau du programme.' }[lang];
  if (state === 'before') return { ar: `هذا الرابط يُفتح من ${o}${c ? ` إلى ${c}` : ''} (${tz}).`, en: `This link opens on ${o}${c ? ` until ${c}` : ''} (${tz}).`, fr: `Ce lien s’ouvre le ${o}${c ? ` jusqu’au ${c}` : ''} (${tz}).` }[lang];
  return { ar: `أُغلق هذا الرابط في ${c} (${tz}) — شكرًا لك؛ إن كنت لم تقيّم بعد فاطلب رابطًا جديدًا.`, en: `This link closed on ${c} (${tz}) — thank you; if you have not evaluated yet, ask for a new link.`, fr: `Ce lien s’est fermé le ${c} (${tz}) — merci ; si vous n’avez pas encore répondu, demandez un nouveau lien.` }[lang];
}

/* ───────── ترجمة الأسئلة بمفتاحها ───────── */
export const FR_Q: Record<string, string> = {
  daily_clarity: 'Clarté de la leçon', daily_teaching_style: 'Méthode d’enseignement', daily_motivation: 'Ma motivation à apprendre aujourd’hui',
  daily_confidence: 'Dans quelle mesure vous sentez-vous capable d’utiliser l’arabe après la leçon d’aujourd’hui ?',
  daily_difficulty: 'Comment avez-vous trouvé la leçon d’aujourd’hui ? (1 = très facile, 5 = très difficile)',
  daily_skills: 'Quelles compétences souhaitez-vous travailler davantage demain ? (plusieurs choix possibles)',
  daily_new_word: 'Un mot nouveau appris aujourd’hui', daily_new_sentence: 'Une phrase nouvelle apprise aujourd’hui', daily_suggestion: 'Votre suggestion pour améliorer la leçon de demain ?',
  final_1: 'Accueil à l’aéroport', final_2: 'Qualité de l’enseignement et de l’apprentissage', final_3: 'Adéquation du contenu et du niveau', final_4: 'Performance globale des formateurs',
  final_5: 'Clarté des explications des formateurs', final_6: 'Interaction des formateurs avec les participants', final_7: 'Organisation du programme', final_8: 'Hospitalité et accueil',
  final_9: 'Qualité du logement', final_10: 'Visites et sorties', final_11: 'Organisation de la Omra', final_12: 'Transports et déplacements', final_13: 'Relations avec l’administration du programme',
  final_14: 'Rapidité de réponse', final_15: 'Satisfaction globale du programme',
};
export const FR_SECTIONS: Record<string, string> = {
  'تقييم الحصة / Class Evaluation': 'Évaluation de la séance', 'أثر التعلم / Learning Impact': 'Impact sur l’apprentissage', 'مستوى الصعوبة / Difficulty Level': 'Niveau de difficulté',
  'مهارات الغد / Skills for Tomorrow': 'Compétences pour demain', 'ماذا تعلمت اليوم؟ / Today\'s Learning': 'Ce que j’ai appris aujourd’hui', 'مقترحاتك / Your Suggestions': 'Vos suggestions',
  'الوصول': 'Arrivée', 'المحتوى التعليمي': 'Contenu pédagogique', 'المدرّبون': 'Formateurs', 'التنظيم': 'Organisation', 'الخدمات': 'Services', 'السكن': 'Logement', 'الجولات': 'Visites',
  'الرحلات': 'Sorties', 'الإدارة': 'Administration', 'الرضا العام': 'Satisfaction globale', 'التقييم العام': 'Général',
};
export const FR_OPTIONS: Record<string, string> = {
  'الاستماع / Listening': 'Compréhension orale', 'التحدث / Speaking': 'Expression orale', 'القراءة / Reading': 'Lecture', 'الكتابة / Writing': 'Écriture',
  'المفردات / Vocabulary': 'Vocabulaire', 'النطق / Pronunciation': 'Prononciation', 'نعم': 'Oui', 'لا': 'Non', 'ذكر': 'Homme', 'أنثى': 'Femme',
};
const norm = (s: unknown) => String(s || '').replace(/\u0651/g, '').replace(/\s+/g, ' ').trim();   /* بلا شدّة: نصوص القاعدة قد تأتي غير مشكولة */
/** نصّ السؤال بالفرنسيّة: بالمفتاح، وإلّا الإنجليزيّة، وإلّا العربيّة */
export function frQuestion(q: { question_key?: string | null; text_en?: string | null; text_ar?: string | null }): string { return (q.question_key && FR_Q[q.question_key]) || q.text_en || q.text_ar || ''; }
const SECTIONS_N: Record<string, string> = Object.fromEntries(Object.entries(FR_SECTIONS).map(([k, v]) => [norm(k), v]));
export function frSection(ar: string | null | undefined, en?: string | null): string { const k = norm(ar); return SECTIONS_N[k] || SECTIONS_N[k.split(' / ')[0]] || en || ar || ''; }
const OPTIONS_N: Record<string, string> = Object.fromEntries(Object.entries(FR_OPTIONS).map(([k, v]) => [norm(k), v]));
export function frOption(o: string): string { return OPTIONS_N[norm(o)] || o; }
/** تغطية الترجمة لقالب: كم سؤالًا له ترجمة فرنسيّة بمفتاحه */
export function frCoverage(qs: { question_key?: string | null }[]): { translated: number; total: number } { return { translated: qs.filter(q => q.question_key && FR_Q[q.question_key]).length, total: qs.length }; }

/* ───────── نصوص الواجهة ───────── */
export const SCALE_FR: Record<number, string> = { 1: 'Très faible', 2: 'Faible', 3: 'Moyen', 4: 'Bien', 5: 'Excellent' };
export const LIKERT_FR = ['Tout à fait d’accord', 'D’accord', 'Neutre', 'Pas d’accord', 'Pas du tout d’accord'];
export const FLOW_FR = {
  stepOf: (i: number, n: number) => `Étape ${i} sur ${n}`, next: 'Suivant', back: 'Précédent', start: 'Commencer', submit: 'Envoyer les réponses', sending: 'Envoi…',
  journey: 'Étapes du questionnaire', progress: 'Progression', optional: 'Facultatif', missing: 'Réponse obligatoire manquante',
};
export const ONCE_FR = { title: 'Merci — votre réponse est enregistrée', perDay: 'Vous avez déjà répondu à ce questionnaire aujourd’hui — merci, votre avis est sauvegardé. Vous pourrez participer de nouveau à la prochaine séance.', once: 'Vous avez déjà répondu à ce questionnaire — merci, votre avis est sauvegardé.', shared: 'Appareil partagé ? Une autre participante commence ici' };
export const KIND_FR = { DAILY: 'Questionnaire du jour', FINAL: 'Évaluation finale', END: 'Questionnaire de fin de programme' } as const;
export const STR_FR: Record<string, string> = {
  dailyTitle: 'Évaluation quotidienne des séances', finalTitle: 'Évaluation finale du programme', endTitle: 'Questionnaire de fin de programme', kicker: 'Portail Athar',
  intro: 'Votre avis nous aide à améliorer la qualité des programmes. Les champs marqués * sont obligatoires ; environ 3 minutes.',
  introEnd: 'Votre avis nous aide à améliorer chaque détail de l’environnement de formation — de l’accueil au certificat. Les champs marqués * sont obligatoires ; laissez vides les points « si applicable » qui ne vous concernent pas ; environ 6 minutes.',
  participant: 'Vos informations', name: 'Nom complet', email: 'Adresse e-mail', phone: 'Numéro de portable', nationality: 'Nationalité', gender: 'Genre', male: 'Homme', female: 'Femme', choose: '— Choisir —',
  accommodation: 'Hébergement pendant le programme', program: 'Programme', classroom: 'Groupe', room: 'Groupe',
  noTemplate: 'Aucun questionnaire actif pour ce programme pour le moment — contactez le bureau du programme.',
  journey: 'Votre parcours dans le questionnaire', journeyHint: 'Touchez une section pour y aller', journeyMissing: 'obligatoire manquant',
  linkErr: 'Enregistrement impossible : le questionnaire n’est pas encore lié à ce programme — prévenez le bureau du programme puis réessayez ; vos réponses restent sur la page.',
  loading: 'Préparation du questionnaire…', submit: 'Envoyer l’évaluation', sending: 'Envoi…',
  privacy: 'Vos données servent uniquement à la qualité ; les résultats sont présentés de façon agrégée.',
  missingFields: 'Merci de compléter les champs suivants :', missingQs: 'Merci de répondre aux questions obligatoires suivantes :',
  dupDaily: 'Nos registres indiquent que vous avez déjà évalué cette séance aujourd’hui — merci.', dupEnd: 'Vous avez déjà envoyé le questionnaire de fin de programme — merci.', dupFinal: 'Vous avez déjà envoyé l’évaluation finale de ce programme — merci.',
  locked: 'Vous évaluez', lockedHint: 'Ouvert via un lien dédié — pas besoin de choisir le programme.', section: 'Groupe', npsLow: '0 = je ne recommanderais jamais', npsHigh: '10 = je recommande vivement',
  thanks: 'Merci ! Votre évaluation a bien été reçue', thanksBody: 'Vos remarques nous aident à améliorer la qualité de nos programmes.',
  writeHere: 'Écrivez votre réponse ici…', general: 'Général', yes: 'Oui', no: 'Non', required: 'Obligatoire', another: 'Nouvelle évaluation', progress: 'Répondu à', of: 'sur', questions: 'questions',
  notOpen: 'Pas encore ouvert', closed: 'Lien fermé', invalid: 'Ce lien est fermé ou invalide', scopeOne: 'Un groupe', scopeLevel: 'Niveau', scopeAll: 'Tous les groupes',
};
