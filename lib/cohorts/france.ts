// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P88 «مساحة الطالبة — France Cohort Hub» — الطبقة النقيّة (بلا React/DB): إعدادات المجموعة، الجدول، النصوص بثلاث لغات، اختيار اللغة */

export type HubLang = 'fr' | 'en' | 'ar';
export const HUB_LANGS: HubLang[] = ['fr', 'en', 'ar'];

/** إعدادات المجموعة — مصدر واحد للحقيقة (مطابق لـ P87-1-setup.sql) */
export const FRANCE = {
  programId: '101bdcac-95cc-46df-8ca9-96a2b1c903c1',
  start: '2026-12-06', end: '2026-12-26',
  weekdays: [0, 1, 2, 3, 4] as number[],          // JS getUTCDay: 0=الأحد … 4=الخميس
  periods: [['08:00', '10:00'], ['11:00', '13:00']],
  breakAt: ['10:00', '11:00'] as [string, string],
  lateAfter: '08:30', /* قرار المالك 27/11: التأخير بعد 8:30 */
  certificate: { /* P91 — قرارات المالك 27/11 */
    lang2: 'fr' as const,
    programNameAr: 'برنامج الانغماس اللغوي — ديسمبر 2026', programNameFr: 'Programme d’immersion en arabe — Décembre 2026',
    wishTo: 'لها', sign1: { name: 'د/ أحمد عبدالعزيز', title: 'المدير الأكاديمي', title_fr: 'Directeur académique' } /* يمين */, sign2: { name: 'د/ عبدالله العتيبي', title: 'المدير العام', title_fr: 'Directeur général' } /* يسار */,
  },
  hours: 60,
  trainer: { ar: 'د. آلاء', en: 'Dr. Alaa', fr: 'Dr Alaa' },
  organiser: { ar: 'أ. عمرو سنبل', en: 'Mr. Amr Sunbul', fr: 'M. Amr Sunbul' },
  location: { ar: 'المدينة المنوّرة — مقرّ أَثَر', en: 'Madinah — Athar premises', fr: 'Médine — locaux d’Athar' },
  codes: { daily: 'FRDAILY', final: 'FRFINAL' },
  links: { daily: '/e/FRDAILY', final: '/e/FRFINAL', miaar: '/miaar', login: '/france', verify: '/verify' },
  contact: { email: 'info@athar-portal.com', phone: '+966 56 444 0406', whatsapp: 'https://wa.me/966564440406' },
} as const;

export type HubDay = { n: number; date: string; dow: number };
/** أيام البرنامج (الأحد–الخميس) — نفس خوارزمية SQL: 15 يومًا */
export function cohortDays(start = FRANCE.start, end = FRANCE.end, weekdays: number[] = FRANCE.weekdays): HubDay[] {
  const out: HubDay[] = []; const d = new Date(start + 'T00:00:00Z'); const e = new Date(end + 'T00:00:00Z'); let n = 0;
  while (d <= e) { const dow = d.getUTCDay(); if (weekdays.includes(dow)) { n++; out.push({ n, date: d.toISOString().slice(0, 10), dow }); } d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/** اليوم بتوقيت الرياض (UTC+3) */
export function riyadhToday(now: Date = new Date()): string { return new Date(now.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10); }

export type Phase = { kind: 'before'; days: number } | { kind: 'running'; day: number; total: number; isClassDay: boolean } | { kind: 'after' };
export function phaseOf(today: string, days: HubDay[] = cohortDays()): Phase {
  const first = days[0]?.date, last = days[days.length - 1]?.date; if (!first || !last) return { kind: 'after' };
  if (today < first) return { kind: 'before', days: Math.round((Date.parse(first) - Date.parse(today)) / 86400000) };
  if (today > last) return { kind: 'after' };
  const idx = days.findIndex((d) => d.date >= today); const d = days[idx];
  return { kind: 'running', day: d.date === today ? d.n : Math.max(1, d.n - 1), total: days.length, isClassDay: d.date === today };
}

/** اختيار لغة الواجهة: ?lang= → المحفوظة → لغة المتصفّح (fr/ar) → en */
export function pickLang(query?: string | null, saved?: string | null, browser?: string | null): HubLang {
  const ok = (x?: string | null): x is HubLang => !!x && (HUB_LANGS as string[]).includes(x);
  if (ok(query)) return query; if (ok(saved)) return saved;
  const b = String(browser || '').toLowerCase(); if (b.startsWith('fr')) return 'fr'; if (b.startsWith('ar')) return 'ar'; return 'en';
}

const LOCALE: Record<HubLang, string> = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-SA-u-nu-latn-ca-gregory' };
export function fmtDay(date: string, lang: HubLang, o: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  return new Date(date + 'T00:00:00Z').toLocaleDateString(LOCALE[lang], { ...o, timeZone: 'UTC' });
}

/* ───────── P92: صفحة الحضور /attend بالفرنسيّة ───────── */
/** هل هذه الجلسة لمجموعة فرنسا؟ (الـRPC العامّ لا يُعيد program_id؛ نستدلّ من الرمز/العنوان/اسم البرنامج) */
export function isFranceSession(x: { token?: string | null; title?: string | null; program_name?: string | null; program_name_en?: string | null }): boolean {
  const tk = String(x.token || '').toUpperCase();
  if (/^FR\d{2}[0-9A-Z]{6}$/.test(tk)) return true;
  if ((x.title || '').includes('مجموعة فرنسا')) return true;
  return /france cohort/i.test(x.program_name_en || '') || (x.program_name || '').includes('مجموعة فرنسا');
}
/** عنوان الجلسة الفرنسيّ: «Jour 3 · mardi 8 décembre» (يُشتقّ من التاريخ، لا من العنوان العربيّ) */
export function attendTitleFr(session_date: string, days: HubDay[] = cohortDays()): string {
  const d = days.find(x => x.date === session_date);
  const day = fmtDay(session_date, 'fr');
  return d ? `Jour ${d.n} / ${days.length} · ${day}` : day;
}
/** اسم البرنامج كما يظهر للطالبة الفرنسيّة */
export const ATTEND_PROGRAM_FR = FRANCE.certificate.programNameFr;

/* ───────── النصوص ───────── */
export type HubText = {
  dir: 'ltr' | 'rtl'; brand: string; brandSub: string; kicker: string; title: string; subtitle: string; dates: string; place: string; when: string; hoursLabel: string; hoursVal: string; trainerLabel: string; organiserLabel: string;
  startsIn: (n: number) => string; dayOf: (d: number, t: number) => string; restDay: string; finished: string;
  helloTitle: string; hello: (n: string) => string; notEnrolled: string; level: string; levelNone: string; levelHint: string; attendance: string; attendanceOf: (p: number, s: number) => string; noSessions: string;
  todayOpen: string; checkIn: string; dailyNow: string; dailyHint: string; finalOpen: string; finalBtn: string; finalHint: string; certs: string; certVerify: string; certNone: string; signOut: string; fullSpace: string;
  signInTitle: string; signInHint: string; email: string; send: string; sending: string; sent: string; sendErr: string; stepsTitle: string; steps: [string, string][]; lostInvite: string;
  scheduleTitle: string; scheduleHint: string; today: string; dayCol: string; dateCol: string; timeCol: string; faqTitle: string; faq: [string, string][]; contact: string; footer: string;
};
export const T: Record<HubLang, HubText> = {
  en: {
    dir: 'ltr', brand: 'Athar', brandSub: 'Education, Training, Development & Quality',
    kicker: 'France cohort · December 2026', title: 'Arabic Immersion Program', subtitle: 'Three weeks of living Arabic in Madinah — conversation, reading, listening and real-life situations, led by the Athar team with',
    dates: '6 → 26 December 2026', place: 'Where', when: 'When', hoursLabel: 'Contact hours', hoursVal: '60 hours · Sun–Thu · 08:00–13:00', trainerLabel: 'Trainer', organiserLabel: 'Organiser',
    startsIn: (n: number) => (n === 1 ? 'Starts tomorrow' : `Starts in ${n} days`), dayOf: (d: number, t: number) => `Day ${d} of ${t}`, restDay: 'No class today — see you Sunday', finished: 'Program completed — thank you!',
    helloTitle: 'Your space', hello: (n: string) => `Hello ${n}`, notEnrolled: 'This account is not enrolled in the France cohort. Use the e-mail from your Miaar invitation, or contact us.',
    level: 'Your Miaar level', levelNone: 'Not yet — take the Miaar test', levelHint: 'Your group is set by this result.', attendance: 'Attendance', attendanceOf: (p: number, s: number) => `${p} of ${s} sessions`, noSessions: 'Starts on day 1',
    todayOpen: 'Check-in is open now', checkIn: 'Check in', dailyNow: 'Rate today', dailyHint: '2 minutes · at the end of each day', finalOpen: 'Final evaluation is open', finalBtn: 'Final evaluation', finalHint: 'Required for your certificate',
    certs: 'Your certificate', certVerify: 'Verify', certNone: 'Issued after the final evaluation (end of December).', signOut: 'Sign out', fullSpace: 'Full Athar space (Arabic)',
    signInTitle: 'Sign in to your space', signInHint: 'Use the e-mail address that received your Miaar invitation. No password — we send you a one-time link.', email: 'E-mail', send: 'Send me the link', sending: 'Sending…', sent: 'Link sent — open it from this device.', sendErr: 'Could not send the link: ',
    stepsTitle: 'Four steps — that’s all', steps: [
      ['Take the Miaar test', 'Open the invitation e-mail from reports@athar-portal.com (subject “Miaar”). 30 minutes, in your language. It sets your group.'],
      ['Sign in once', 'Here, with the same e-mail. Your journey, level and certificate live in this space.'],
      ['Check in every morning', 'Scan the QR code shown by the trainer, enter your name and e-mail. After 08:30 you are marked “late”.'],
      ['Rate your day', 'Last 15 minutes: scan the daily code (FRDAILY). Anonymous, two minutes, and it changes tomorrow.'],
    ],
    lostInvite: 'Lost the invitation? Ask us to resend it', scheduleTitle: 'Schedule — 15 days', scheduleHint: 'Sunday to Thursday · 08:00–10:00 · break 10:00–11:00 · 11:00–13:00', today: 'today', dayCol: 'Day', dateCol: 'Date', timeCol: 'Time',
    faqTitle: 'Good to know', faq: [
      ['What should I bring?', 'A notebook, a pen, your phone (for the QR codes) and something warm — mornings in December are cool.'],
      ['I don’t have a phone / no network?', 'Tell the trainer — she records your attendance manually. Nothing is lost.'],
      ['Which e-mail should I use everywhere?', 'Always the one that received the Miaar invitation. Attendance, surveys and certificate are linked to it.'],
      ['How do I get my certificate?', 'Attend, complete the final evaluation on the last day, and the certificate (60 hours, bilingual Arabic/English, with a verification code) appears in your space.'],
      ['Who do I contact?', 'The Athar team: e-mail, phone or WhatsApp below — Sunday to Thursday, 08:00–16:00 (Madinah time).'],
    ],
    contact: 'Contact', footer: 'Athar Portal · athar-portal.com · “We build capacity and prove impact”',
  },
  fr: {
    dir: 'ltr', brand: 'Athar', brandSub: 'Éducation, formation, développement et qualité',
    kicker: 'Cohorte France · décembre 2026', title: 'Programme d’immersion en arabe', subtitle: 'Trois semaines d’arabe vivant à Médine — conversation, lecture, écoute et situations de la vie quotidienne, animées par l’équipe Athar avec',
    dates: '6 → 26 décembre 2026', place: 'Lieu', when: 'Dates', hoursLabel: 'Volume horaire', hoursVal: '60 heures · dim.–jeu. · 08h00–13h00', trainerLabel: 'Formatrice', organiserLabel: 'Organisateur',
    startsIn: (n: number) => (n === 1 ? 'Début demain' : `Début dans ${n} jours`), dayOf: (d: number, t: number) => `Jour ${d} sur ${t}`, restDay: 'Pas de cours aujourd’hui — à dimanche', finished: 'Programme terminé — merci !',
    helloTitle: 'Votre espace', hello: (n: string) => `Bonjour ${n}`, notEnrolled: 'Ce compte n’est pas inscrit à la cohorte France. Utilisez l’e-mail de votre invitation Miaar, ou contactez-nous.',
    level: 'Votre niveau Miaar', levelNone: 'Pas encore — passez le test Miaar', levelHint: 'Votre groupe est défini par ce résultat.', attendance: 'Présence', attendanceOf: (p: number, s: number) => `${p} séance(s) sur ${s}`, noSessions: 'Commence le jour 1',
    todayOpen: 'L’émargement est ouvert', checkIn: 'Émarger', dailyNow: 'Évaluer la journée', dailyHint: '2 minutes · en fin de journée', finalOpen: 'L’évaluation finale est ouverte', finalBtn: 'Évaluation finale', finalHint: 'Nécessaire pour votre certificat',
    certs: 'Votre certificat', certVerify: 'Vérifier', certNone: 'Délivré après l’évaluation finale (fin décembre).', signOut: 'Se déconnecter', fullSpace: 'Espace Athar complet (en arabe)',
    signInTitle: 'Connectez-vous à votre espace', signInHint: 'Utilisez l’adresse e-mail qui a reçu votre invitation Miaar. Sans mot de passe — nous vous envoyons un lien à usage unique.', email: 'E-mail', send: 'Recevoir le lien', sending: 'Envoi…', sent: 'Lien envoyé — ouvrez-le depuis cet appareil.', sendErr: 'Impossible d’envoyer le lien : ',
    stepsTitle: 'Quatre étapes — c’est tout', steps: [
      ['Passez le test Miaar', 'Ouvrez l’e-mail d’invitation de reports@athar-portal.com (objet « Miaar »). 30 minutes, dans votre langue. Il détermine votre groupe.'],
      ['Connectez-vous une fois', 'Ici, avec le même e-mail. Votre parcours, votre niveau et votre certificat vivent dans cet espace.'],
      ['Émargez chaque matin', 'Scannez le QR code affiché par la formatrice, saisissez nom et e-mail. Après 08h30, vous êtes notée « en retard ».'],
      ['Évaluez votre journée', 'Les 15 dernières minutes : scannez le code du jour (FRDAILY). Anonyme, deux minutes, et cela change le lendemain.'],
    ],
    lostInvite: 'Invitation perdue ? Demandez-nous de la renvoyer', scheduleTitle: 'Planning — 15 jours', scheduleHint: 'Du dimanche au jeudi · 08h00–10h00 · pause 10h00–11h00 · 11h00–13h00', today: 'aujourd’hui', dayCol: 'Jour', dateCol: 'Date', timeCol: 'Horaires',
    faqTitle: 'Bon à savoir', faq: [
      ['Que dois-je apporter ?', 'Un cahier, un stylo, votre téléphone (pour les QR codes) et un vêtement chaud — les matinées de décembre sont fraîches.'],
      ['Pas de téléphone / pas de réseau ?', 'Dites-le à la formatrice — elle enregistre votre présence manuellement. Rien n’est perdu.'],
      ['Quel e-mail utiliser partout ?', 'Toujours celui qui a reçu l’invitation Miaar. Présence, sondages et certificat y sont rattachés.'],
      ['Comment obtenir mon certificat ?', 'Soyez présente, complétez l’évaluation finale le dernier jour, et le certificat (60 heures, bilingue arabe/anglais, avec code de vérification) apparaît dans votre espace.'],
      ['Qui contacter ?', 'L’équipe Athar : e-mail, téléphone ou WhatsApp ci-dessous — du dimanche au jeudi, 08h00–16h00 (heure de Médine).'],
    ],
    contact: 'Contact', footer: 'Portail Athar · athar-portal.com · « Nous bâtissons la capacité et prouvons l’impact »',
  },
  ar: {
    dir: 'rtl', brand: 'أَثَر', brandSub: 'بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ',
    kicker: 'مجموعة فرنسا · ديسمبر 2026', title: 'برنامج الانغماس اللغوي', subtitle: 'ثلاثة أسابيع من العربية الحيّة في المدينة المنوّرة — حوار وقراءة واستماع ومواقف من الحياة اليوميّة، يقودها فريق أَثَر مع',
    dates: '6 → 26 ديسمبر 2026', place: 'المكان', when: 'الموعد', hoursLabel: 'الساعات', hoursVal: '60 ساعة · الأحد–الخميس · 8:00–13:00', trainerLabel: 'المدرّبة', organiserLabel: 'المنظّم',
    startsIn: (n: number) => (n === 1 ? 'ينطلق غدًا' : `ينطلق بعد ${n} أيام`), dayOf: (d: number, t: number) => `اليوم ${d} من ${t}`, restDay: 'لا درس اليوم — نلتقي الأحد', finished: 'اكتمل البرنامج — شكرًا لكنّ!',
    helloTitle: 'مساحتكِ', hello: (n: string) => `مرحبًا ${n}`, notEnrolled: 'هذا الحساب غير مسجّل في مجموعة فرنسا. استخدمي بريد دعوة مِعيار، أو تواصلي معنا.',
    level: 'مستواكِ في مِعيار', levelNone: 'لم يُحدَّد بعد — أدّي اختبار مِعيار', levelHint: 'شعبتكِ تتحدّد بهذه النتيجة.', attendance: 'الحضور', attendanceOf: (p: number, s: number) => `${p} من ${s} جلسة`, noSessions: 'يبدأ من اليوم الأوّل',
    todayOpen: 'تسجيل الحضور مفتوح الآن', checkIn: 'سجّلي حضوركِ', dailyNow: 'قيّمي يومكِ', dailyHint: 'دقيقتان · في نهاية كلّ يوم', finalOpen: 'التقييم الختامي مفتوح', finalBtn: 'التقييم الختامي', finalHint: 'شرط إصدار الشهادة',
    certs: 'شهادتكِ', certVerify: 'تحقّق', certNone: 'تصدر بعد التقييم الختامي (نهاية ديسمبر).', signOut: 'خروج', fullSpace: 'مساحة أَثَر الكاملة',
    signInTitle: 'ادخلي إلى مساحتكِ', signInHint: 'استخدمي البريد الذي وصلته دعوة مِعيار. بلا كلمة مرور — نرسل لكِ رابطًا لمرّة واحدة.', email: 'البريد الإلكتروني', send: 'أرسلي لي الرابط', sending: 'جارٍ الإرسال…', sent: 'أُرسل الرابط — افتحيه من هذا الجهاز.', sendErr: 'تعذّر إرسال الرابط: ',
    stepsTitle: 'أربع خطوات — لا أكثر', steps: [
      ['أدّي اختبار مِعيار', 'افتحي بريد الدعوة من reports@athar-portal.com (الموضوع «مِعيار»). 30 دقيقة بلغتكِ. يحدّد شعبتكِ.'],
      ['ادخلي مرّة واحدة', 'هنا، بالبريد نفسه. رحلتكِ ومستواكِ وشهادتكِ في هذه المساحة.'],
      ['سجّلي حضوركِ كلّ صباح', 'امسحي رمز QR الذي تعرضه المدرّبة، واكتبي اسمكِ وبريدكِ. بعد 8:30 يُسجَّل «متأخّر».'],
      ['قيّمي يومكِ', 'آخر 15 دقيقة: امسحي رمز اليوم (FRDAILY). مجهول، دقيقتان، ويغيّر الغد.'],
    ],
    lostInvite: 'ضاعت الدعوة؟ اطلبي إعادة إرسالها', scheduleTitle: 'الجدول — 15 يومًا', scheduleHint: 'الأحد إلى الخميس · 8:00–10:00 · استراحة 10:00–11:00 · 11:00–13:00', today: 'اليوم', dayCol: 'اليوم', dateCol: 'التاريخ', timeCol: 'الوقت',
    faqTitle: 'يحسن أن تعرفي', faq: [
      ['ماذا أحضر معي؟', 'دفترًا وقلمًا وجوّالكِ (لرموز QR) وشيئًا دافئًا — صباحات ديسمبر باردة.'],
      ['لا جوّال معي / لا شبكة؟', 'أخبري المدرّبة — تسجّل حضوركِ يدويًّا. لا يضيع شيء.'],
      ['أيّ بريد أستخدم في كلّ مكان؟', 'دائمًا البريد الذي وصلته دعوة مِعيار. الحضور والاستبيانات والشهادة مرتبطة به.'],
      ['كيف أحصل على شهادتي؟', 'احضري، وأكملي التقييم الختامي في اليوم الأخير، وتظهر الشهادة (60 ساعة، عربي/إنجليزي، برمز تحقّق) في مساحتكِ.'],
      ['بمن أتّصل؟', 'فريق أَثَر: البريد أو الهاتف أو واتساب أدناه — الأحد إلى الخميس 8:00–16:00 بتوقيت المدينة.'],
    ],
    contact: 'التواصل', footer: 'بوّابة أَثَر · athar-portal.com · «نبني القدرة ونُثبت الأثر»',
  },
};
