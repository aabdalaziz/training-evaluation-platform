// أَثَر — بوابة التعليم والتدريب والتطوير: المحتوى والهوية (ملف واحد قابل للتعديل)
// كل النصوص ثنائية اللغة: { ar, en }. غيّر النصوص هنا فقط وتنعكس على كل صفحات البوابة.
import type { IconName } from '../ui/icons';

export type Lang = 'ar' | 'en';
export type T = { ar: string; en: string };
export const t = (x: T, lang: Lang): string => x[lang] || x.ar;

export const BRAND = {
  name: { ar: 'أَثَر', en: 'Athar' } as T,
  full: { ar: 'أَثَر — بوابة التعليم والتدريب والتطوير', en: 'Athar · TRACE — Education, Training & Development Portal' } as T,
  tagline: { ar: 'نتعلّم، نتدرّب، نتطوّر… ونقيس الأثر', en: 'Learn. Train. Grow. Prove it.' } as T,
  promise: { ar: 'بوابة واحدة تجمع تعليم العربية للناطقين بغيرها، والبرامج التدريبية والدبلومات، والاستشارات، والحقائب، والبث المباشر — ويحكمها قياس حقيقي للأثر قبل التعلّم وأثناءه وبعده.', en: 'One portal for Arabic for non-native speakers, professional training and diplomas, consulting, resources and live channels — governed by real impact measurement before, during and after learning.' } as T,
  /** مالك الحقوق الفكرية للمنصة والهوية والمنهجيات */
  owner: { ar: 'د. أحمد محمد عبدالعزيز بدوي', en: 'Dr. Ahmed Mohamed Abdelaziz Badawi' } as T,
  /** الكيان التجاري المشغِّل حاليًا (الفواتير والتعاقدات) — لا يحمل أي حق ملكية */
  legal: { ar: 'شركة بوابة التميز للاستشارات والتدريب', en: 'CenterGate for Excellence' } as T,
  operatedBy: { ar: 'تُشغَّل تجاريًا عبر', en: 'Commercially operated by' } as T,
  copyrightYear: 2026,
  colors: { navy: '#0f2a4e', teal: '#0b8a83', gold: '#c9a24b' },
  /** الاختصار الإنجليزي الرسمي: TRACE = أثر، وحروفه أوائل الخدمات */
  acronym: 'TRACE',
  acronymLine: { ar: 'أَثَر = TRACE: حروفه أوائل خدماتنا', en: 'Athar means “trace” — and TRACE spells our services' } as T,
  evaluationUrl: '/login',
  placementUrl: 'https://miaar-placement-test.vercel.app',
};

export const CONTACT = {
  email: 'info@athar-portal.sa',
  phone: '+966 56 444 0406',
  city: { ar: 'المدينة المنورة، المملكة العربية السعودية', en: 'Madinah, Saudi Arabia' } as T,
  hours: { ar: 'الأحد – الخميس · 8:00 ص – 4:00 م', en: 'Sun – Thu · 8:00 – 16:00' } as T,
  social: [
    { name: 'X', href: 'https://x.com/' },
    { name: 'LinkedIn', href: 'https://linkedin.com/' },
    { name: 'YouTube', href: 'https://youtube.com/' },
  ],
};

export const ABOUT = {
  /** بيان الملكية — يُعرض في «من نحن» */
  ownership: { ar: 'أَثَر مشروع فكري ومهني للدكتور أحمد محمد عبدالعزيز بدوي: فكرته ومنهجيته (TRACE) وتصميمه ومحتواه ملك حصري له. الجهات الأكاديمية والمؤسسات المذكورة في البوابة هي جهات عمل وتعاون، ويُدار النشاط التجاري حاليًا عبر شركة بوابة التميز للاستشارات والتدريب.', en: 'Athar is the intellectual and professional project of Dr. Ahmed Mohamed Abdelaziz Badawi; its concept, TRACE methodology, design and content are his exclusive property. The institutions named on this portal are employers and collaborators; commercial operations currently run through CenterGate for Excellence.' } as T,
  intro: { ar: 'أَثَر بوابة متكاملة تجمع تحت سقف واحد ثلاث رحلات: التعليم، والتدريب، والتطوير المؤسسي — وتربطها بمنظومة قياس تبدأ قبل الرحلة باختبار «مِعيار»، وتستمر أثناءها بمنصة التقويم، وتُثبت نتائجها بعدها بقياس الأثر وفق مستويات كيركباتريك الأربعة.', en: 'Athar is an integrated portal bringing together three journeys — education, training and institutional development — bound by a measurement system that starts before the journey (Miaar placement test), continues during it (the Evaluation Platform) and proves results after it through Kirkpatrick levels 1–4.' } as T,
  vision: { ar: 'أن نكون المرجع الأول في المنطقة لحلول التعليم والتدريب التي تُثبت أثرها بالأرقام.', en: 'To be the region’s first reference for education and training solutions that prove their impact with numbers.' } as T,
  mission: { ar: 'تقديم برامج وخدمات تعليمية وتدريبية واستشارية عالية الجودة، تُصمَّم على احتياج حقيقي، وتُنفَّذ بخبرات متخصصة، وتُقاس نتائجها بشفافية.', en: 'To deliver high-quality education, training and consulting services designed on real needs, delivered by specialists, and measured transparently.' } as T,
  values: [
    { icon: 'scale' as IconName, title: { ar: 'الأثر قبل الحضور', en: 'Impact over attendance' }, desc: { ar: 'لا نكتفي بعدد الساعات؛ نقيس ما تغيّر في المعرفة والسلوك والنتائج.', en: 'We don’t count hours; we measure change in knowledge, behaviour and results.' } },
    { icon: 'check' as IconName, title: { ar: 'الإتقان', en: 'Mastery' }, desc: { ar: 'جودة في التصميم والتنفيذ والمتابعة، بمعايير معلنة.', en: 'Quality in design, delivery and follow-up, against published standards.' } },
    { icon: 'users' as IconName, title: { ar: 'الشراكة', en: 'Partnership' }, desc: { ar: 'نبني مع شركائنا الأكاديميين والمهنيين، ولا نعمل بمعزل عنهم.', en: 'We build with academic and professional partners, never in isolation.' } },
    { icon: 'globe' as IconName, title: { ar: 'الانفتاح', en: 'Openness' }, desc: { ar: 'عربي وإنجليزي، حضوري وعن بُعد، للأفراد والمؤسسات.', en: 'Arabic and English, on-site and online, for individuals and institutions.' } },
  ],
  method: [
    { n: 1, icon: 'target' as IconName, title: { ar: 'قبل: نقيس المستوى', en: 'Before: measure the level' }, desc: { ar: 'اختبار مِعيار التكيفي وفق الإطار الأوروبي CEFR، وتحليل الاحتياج للمؤسسات.', en: 'Miaar adaptive CEFR test for learners; needs analysis for institutions.' } },
    { n: 2, icon: 'evaluations' as IconName, title: { ar: 'أثناء: نُحسّن باستمرار', en: 'During: improve continuously' }, desc: { ar: 'تقييمات يومية وختامية، حضور رقمي، ومؤشرات لحظية للمدرب والإدارة.', en: 'Daily and final evaluations, digital attendance, live indicators for trainers and management.' } },
    { n: 3, icon: 'trend' as IconName, title: { ar: 'بعد: نُثبت الأثر', en: 'After: prove the impact' }, desc: { ar: 'قياس قبلي/بعدي، متابعة نقل الأثر بعد 60–90 يومًا، ومؤشرات النتائج المؤسسية.', en: 'Pre/post measurement, 60–90 day transfer follow-up and institutional KPIs.' } },
  ],
};

export const PARTNERS = [
  { logo: '/logos/upm.png', name: { ar: 'جامعة الأمير مقرن بن عبدالعزيز', en: 'Prince Mugrin University' } as T, role: { ar: 'جهة عمل وتعاون أكاديمي', en: 'Employer & academic collaborator' } as T },
  { logo: '/logos/center.png', name: { ar: 'المركز العالمي لتعليم اللغة العربية', en: 'Global Center for Teaching Arabic' } as T, role: { ar: 'جهة تعاون متخصصة', en: 'Specialised collaborator' } as T },
  { logo: '/logos/gate.png', name: { ar: 'شركة بوابة التميز للاستشارات والتدريب', en: 'CenterGate for Excellence' } as T, role: { ar: 'الكيان التجاري المشغِّل حاليًا', en: 'Current operating entity' } as T, wide: true },
];

/** خريطة الاختصار TRACE → الخدمات (تُعرض في الرئيسية والتذييل) */
export const ACRONYM: { letter: string; word: string; ar: string; slug: string }[] = [
  { letter: 'T', word: 'Training', ar: 'البرامج التدريبية والدبلومات', slug: 'training' },
  { letter: 'R', word: 'Resources', ar: 'مستودع الحقائب التدريبية', slug: 'resources' },
  { letter: 'A', word: 'Arabic', ar: 'تعليم العربية للناطقين بغيرها', slug: 'arabic' },
  { letter: 'C', word: 'Consulting', ar: 'الاستشارات', slug: 'consulting' },
  { letter: 'E', word: 'Evaluation', ar: 'تقويم الخدمات واختبار المستوى', slug: 'evaluation' },
];

export type ServiceStatus = 'live' | 'soon';
export type Service = {
  slug: string; icon: IconName; tone: 'navy' | 'teal' | 'gold' | 'info' | 'ok' | 'warn';
  title: T; short: T; long: T[]; features: T[]; modes?: T[];
  cta: { label: T; href: string; external?: boolean }; status: ServiceStatus; phase?: string;
};

export const SERVICES: Service[] = [
  {
    slug: 'arabic', icon: 'book', tone: 'navy', status: 'live',
    title: { ar: 'تعليم اللغة العربية للناطقين بغيرها', en: 'Arabic for Non-Native Speakers' },
    short: { ar: 'برامج مكثفة ومستويات متدرجة وفق الإطار الأوروبي CEFR — حضوريًا وعن بُعد.', en: 'Intensive programs and graded CEFR levels — on-site and online.' },
    long: [
      { ar: 'نبدأ بتحديد مستواك باختبار «مِعيار» التكيفي، ثم نضعك في المستوى المناسب داخل برنامج يجمع المهارات الأربع (الاستماع، التحدث، القراءة، الكتابة) مع ثقافة عربية حية.', en: 'We start by placing you with the adaptive Miaar test, then enrol you at the right level in a program covering the four skills with living Arabic culture.' },
      { ar: 'كل برنامج يُقوَّم يوميًا وختاميًا، وتُصدر شهادته برمز تحقق، وتتابعه بوابة المتدرب.', en: 'Every program is evaluated daily and at completion, certified with a verifiable code, and tracked in the student portal.' },
    ],
    features: [{ ar: 'مستويات A1 → C1', en: 'Levels A1 → C1' }, { ar: 'معلمون متخصصون', en: 'Specialist teachers' }, { ar: 'شهادة موثّقة برمز تحقق', en: 'Verified certificate' }, { ar: 'بوابة المتدرب لمتابعة الرحلة', en: 'Student portal' }],
    modes: [{ ar: 'حضوري', en: 'On-site' }, { ar: 'عن بُعد', en: 'Online' }],
    cta: { label: { ar: 'اختبر مستواك أولًا', en: 'Take the placement test' }, href: BRAND.placementUrl, external: true },
  },
  {
    slug: 'training', icon: 'trend', tone: 'teal', status: 'live',
    title: { ar: 'البرامج التدريبية التطويرية', en: 'Professional Development Programs' },
    short: { ar: 'برامج قصيرة ومتوسطة لتطوير المهارات القيادية والإدارية والتعليمية — حضوريًا وعن بُعد.', en: 'Short and mid-length programs for leadership, management and teaching skills — on-site and online.' },
    long: [
      { ar: 'برامج تُصمَّم على احتياج فعلي، يقدمها مدربون معتمدون، ويُقاس أثرها قبل وبعد، ثم تُتابَع في بيئة العمل بعد 60–90 يومًا لقياس نقل الأثر.', en: 'Programs designed on real needs, delivered by certified trainers, measured pre/post, then followed up at the workplace after 60–90 days.' },
    ],
    features: [{ ar: 'تحليل احتياج قبل التصميم', en: 'Needs analysis first' }, { ar: 'قياس قبلي/بعدي', en: 'Pre/post measurement' }, { ar: 'متابعة نقل الأثر', en: 'Transfer follow-up' }, { ar: 'تقرير أثر للجهة', en: 'Impact report for the client' }],
    modes: [{ ar: 'حضوري', en: 'On-site' }, { ar: 'عن بُعد', en: 'Online' }],
    cta: { label: { ar: 'تصفّح البرامج', en: 'Browse programs' }, href: '/programs' },
  },
  {
    slug: 'diplomas', icon: 'school', tone: 'gold', status: 'live',
    title: { ar: 'برامج الدبلومات', en: 'Diploma Programs' },
    short: { ar: 'دبلومات مهنية وتخصصية بالشراكة مع جهات أكاديمية — حضوريًا وعن بُعد.', en: 'Professional and specialised diplomas with academic partners — on-site and online.' },
    long: [
      { ar: 'مسارات أطول وأعمق (مثل دبلوم إعداد معلمي اللغة العربية للناطقين بغيرها) بمستويات متتابعة، وتقويم مستمر، وشهادة معتمدة من الشريك الأكاديمي.', en: 'Longer, deeper tracks (e.g. the TAFL Teacher Preparation Diploma) with sequential levels, continuous evaluation and partner-accredited certification.' },
    ],
    features: [{ ar: 'مستويات متتابعة', en: 'Sequential levels' }, { ar: 'شراكة أكاديمية', en: 'Academic partnership' }, { ar: 'تقويم مستمر', en: 'Continuous evaluation' }, { ar: 'شهادة معتمدة', en: 'Accredited certificate' }],
    modes: [{ ar: 'حضوري', en: 'On-site' }, { ar: 'عن بُعد', en: 'Online' }],
    cta: { label: { ar: 'تصفّح الدبلومات', en: 'Browse diplomas' }, href: '/programs?type=diploma' },
  },
  {
    slug: 'consulting', icon: 'compass', tone: 'info', status: 'live',
    title: { ar: 'الاستشارات', en: 'Consulting' },
    short: { ar: 'استشارات إدارية وأكاديمية وتعليمية، وجودة واعتماد المؤسسات.', en: 'Management, academic and educational consulting, plus institutional quality and accreditation.' },
    long: [
      { ar: 'نرافق المؤسسات من التشخيص إلى التحسين: هياكل وحوكمة، تصميم برامج ومناهج، تطوير أداء المعلمين، وبناء أنظمة الجودة والاستعداد للاعتماد.', en: 'We accompany institutions from diagnosis to improvement: structures and governance, program and curriculum design, teacher performance, quality systems and accreditation readiness.' },
    ],
    features: [{ ar: 'إدارية', en: 'Management' }, { ar: 'أكاديمية', en: 'Academic' }, { ar: 'تعليمية', en: 'Educational' }, { ar: 'جودة واعتماد', en: 'Quality & accreditation' }],
    cta: { label: { ar: 'اطلب استشارة', en: 'Request a consultation' }, href: '/consulting' },
  },
  {
    slug: 'resources', icon: 'folder', tone: 'ok', status: 'live',
    title: { ar: 'مستودع الحقائب التدريبية', en: 'Training Resources Repository' },
    short: { ar: 'حقائب تدريبية وأدلة ومواد تعليمية جاهزة، مصنّفة بمستويات وصول.', en: 'Ready training kits, guides and learning materials with tiered access.' },
    long: [
      { ar: 'مكتبة رقمية منظمة: حقائب كاملة (دليل المدرب، دليل المتدرب، العروض، الأنشطة، أدوات التقييم)، مع نسخ وإصدارات، وبحث، وروابط تحميل آمنة.', en: 'An organised digital library: complete kits (trainer guide, trainee guide, slides, activities, assessment tools) with versions, search and secure download links.' },
    ],
    features: [{ ar: 'موسومة بالمهارات والقطاع', en: 'Tagged by skill and sector' }, { ar: 'إصدارات وتحديثات', en: 'Versions and updates' }, { ar: 'وصول عام / مسجّل / برنامج / جهة', en: 'Public / member / program / organization' }, { ar: 'روابط تحميل آمنة وسجل تعلّم', en: 'Secure downloads & learning log' }],
    cta: { label: { ar: 'تصفّح المستودع', en: 'Browse the repository' }, href: '/resources' },
  },
  {
    slug: 'live', icon: 'play', tone: 'warn', status: 'live',
    title: { ar: 'التعلّم المباشر والهجين', en: 'Live & Hybrid Learning' },
    short: { ar: 'جلسات الشعب والندوات والورش عبر Teams وZoom وMeet وقاعة أَثَر — بقاعات متوازية وحضور رقمي وتسجيلات.', en: 'Class sessions, webinars and workshops on Teams, Zoom, Meet and Athar Room — parallel rooms, digital attendance and recordings.' },
    long: [
      { ar: 'كل شعبة قاعة مستقلة بمدربها ورابطها، والمتدرب يُسكن في شعبته تلقائيًا بعد السداد ويرى جلساته في بوابته. جدول واضح، انضمام بنقرة قبل الموعد بـ15 دقيقة، حضور رقمي مرتبط بالجلسة، تسجيلات لاحقة، وكل جلسة موسومة بالمهارات التي تنمّيها.', en: 'Every section is an independent room with its own trainer and link; trainees are auto-placed after payment and see their sessions in their portal. Clear schedule, one-click join 15 minutes before start, session-linked digital attendance, recordings, and skill tagging for every session.' },
    ],
    features: [{ ar: 'قاعات متوازية بلا حد', en: 'Unlimited parallel rooms' }, { ar: 'Teams · Zoom · Meet · قاعة أَثَر', en: 'Teams · Zoom · Meet · Athar Room' }, { ar: 'حضور رقمي', en: 'Digital attendance' }, { ar: 'تسجيلات ومهارات', en: 'Recordings & skills' }],
    cta: { label: { ar: 'جدول الجلسات', en: 'Session schedule' }, href: '/live' },
  },
  {
    slug: 'evaluation', icon: 'scale', tone: 'navy', status: 'live',
    title: { ar: 'تقويم الخدمات — منصة التقويم', en: 'Service Evaluation — The Evaluation Platform' },
    short: { ar: 'منصة متكاملة لإدارة البرامج وتقييمها وقياس أثرها وفق كيركباتريك 1→4.', en: 'An integrated platform to manage, evaluate and measure programs across Kirkpatrick 1→4.' },
    long: [
      { ar: 'المحرّك الذي يشغّل كل خدمات أَثَر: تقييمات ثنائية اللغة، حضور رقمي، قياس قبلي/بعدي، متابعة نقل الأثر، مؤشرات مؤسسية، شهادات موثّقة، وتقارير تنفيذية — بجاهزية وصحة وتدقيق ونسخ احتياطي.', en: 'The engine behind every Athar service: bilingual evaluations, digital attendance, pre/post measurement, transfer follow-up, institutional KPIs, verified certificates and executive reports — with readiness, health, audit and backup built in.' },
    ],
    features: [{ ar: 'كيركباتريك 1→4', en: 'Kirkpatrick 1→4' }, { ar: 'تقارير تنفيذية', en: 'Executive reports' }, { ar: 'شهادات برمز تحقق', en: 'Verifiable certificates' }, { ar: 'حوكمة وتدقيق', en: 'Governance & audit' }],
    cta: { label: { ar: 'دخول المنصة', en: 'Open the platform' }, href: BRAND.evaluationUrl },
  },
  {
    slug: 'placement', icon: 'target', tone: 'teal', status: 'live',
    title: { ar: 'اختبار تحديد المستوى — مِعيار', en: 'Placement Test — Miaar' },
    short: { ar: 'اختبار تكيفي لتحديد مستوى اللغة العربية وفق الإطار الأوروبي المرجعي CEFR.', en: 'An adaptive Arabic placement test aligned with the CEFR.' },
    long: [
      { ar: 'يتكيّف الاختبار مع إجاباتك ليحدد مستواك بدقة في وقت أقصر، ويقترح لك البرنامج والمستوى المناسبين داخل أَثَر.', en: 'The test adapts to your answers to pinpoint your level faster, then suggests the right Athar program and level.' },
    ],
    features: [{ ar: 'تكيفي', en: 'Adaptive' }, { ar: 'مواءمة CEFR', en: 'CEFR-aligned' }, { ar: 'نتيجة فورية', en: 'Instant result' }, { ar: 'توصية بالبرنامج', en: 'Program recommendation' }],
    cta: { label: { ar: 'ابدأ الاختبار', en: 'Start the test' }, href: BRAND.placementUrl, external: true },
  },
];

export const CROSS = [
  { icon: 'shield' as IconName, title: { ar: 'الدفع الآمن', en: 'Secure payment' }, desc: { ar: 'فاتورة إلكترونية فور قبولك، وسداد بتحويل بنكي موثّق بالإيصال أو عبر مدى والبطاقات وApple Pay.', en: 'An e-invoice the moment you are accepted; pay by verified bank transfer or via mada, cards and Apple Pay.' } },
  { icon: 'users' as IconName, title: { ar: 'حساب واحد لكل شيء', en: 'One account for everything' }, desc: { ar: 'برامجك وفواتيرك وشهاداتك ونتيجة مِعيار في مكان واحد.', en: 'Your programs, invoices, certificates and Miaar result in one place.' } },
  { icon: 'globe' as IconName, title: { ar: 'عربي / English', en: 'Arabic / English' }, desc: { ar: 'واجهة واستمارات ثنائية اللغة للمتعلمين الدوليين.', en: 'Bilingual interface and forms for international learners.' } },
];

export const NAV: { href: string; label: T }[] = [
  { href: '/', label: { ar: 'الرئيسية', en: 'Home' } },
  { href: '/services', label: { ar: 'الخدمات', en: 'Services' } },
  { href: '/programs', label: { ar: 'البرامج', en: 'Programs' } },
  { href: '/consulting', label: { ar: 'الاستشارات', en: 'Consulting' } },
  { href: '/resources', label: { ar: 'الحقائب', en: 'Resources' } },
  { href: '/live', label: { ar: 'البث المباشر', en: 'Live' } },
  { href: '/about', label: { ar: 'من نحن', en: 'About' } },
  { href: '/contact', label: { ar: 'تواصل', en: 'Contact' } },
];

export const UI = {
  student: { ar: 'بوابة المتدرب', en: 'Student portal' } as T,
  admin: { ar: 'دخول الإدارة', en: 'Staff login' } as T,
  verify: { ar: 'التحقق من الشهادات', en: 'Verify certificate' } as T,
  services: { ar: 'خدماتنا', en: 'Our services' } as T,
  servicesSub: { ar: 'ثماني خدمات متكاملة، تجمعها منهجية قياس واحدة', en: 'Eight integrated services under one measurement method' } as T,
  programs: { ar: 'البرامج الجارية والقادمة', en: 'Current & upcoming programs' } as T,
  programsSub: { ar: 'من منصة التقويم مباشرة — ما يُعلن هنا يُقاس هناك', en: 'Straight from the Evaluation Platform — what is announced here is measured there' } as T,
  noPrograms: { ar: 'لا توجد برامج معلنة حاليًا — تواصل معنا لمعرفة المواعيد القادمة.', en: 'No programs announced at the moment — contact us for upcoming dates.' } as T,
  method: { ar: 'منهجية أَثَر', en: 'The Athar method' } as T,
  methodSub: { ar: 'قبل · أثناء · بعد', en: 'Before · During · After' } as T,
  partners: { ar: 'جهات العمل والتعاون', en: 'Employers & collaborators' } as T,
  ctaTitle: { ar: 'جاهز لتبدأ رحلة لها أثر؟', en: 'Ready for a journey with impact?' } as T,
  ctaSub: { ar: 'اختبر مستواك، أو تصفّح البرامج، أو حدّثنا عن احتياج مؤسستك.', en: 'Take the test, browse programs, or tell us about your institution’s needs.' } as T,
  contactUs: { ar: 'تواصل معنا', en: 'Contact us' } as T,
  soon: { ar: 'قريبًا', en: 'Coming soon' } as T,
  live: { ar: 'متاح الآن', en: 'Available now' } as T,
  learnMore: { ar: 'اعرف المزيد', en: 'Learn more' } as T,
  onsite: { ar: 'حضوري', en: 'On-site' } as T,
  remote: { ar: 'عن بُعد', en: 'Online' } as T,
  hybrid: { ar: 'مدمج', en: 'Hybrid' } as T,
  starts: { ar: 'يبدأ', en: 'Starts' } as T,
  ends: { ar: 'ينتهي', en: 'Ends' } as T,
  ongoing: { ar: 'جارٍ الآن', en: 'Ongoing' } as T,
  upcoming: { ar: 'قادم', en: 'Upcoming' } as T,
  register: { ar: 'التفاصيل والتسجيل', en: 'Details & registration' } as T,
  allPrograms: { ar: 'كل البرامج', en: 'All programs' } as T,
  vision: { ar: 'رؤيتنا', en: 'Our vision' } as T,
  mission: { ar: 'رسالتنا', en: 'Our mission' } as T,
  values: { ar: 'قيمنا', en: 'Our values' } as T,
  rights: { ar: 'جميع الحقوق محفوظة', en: 'All rights reserved' } as T,
  quick: { ar: 'روابط سريعة', en: 'Quick links' } as T,
  contactInfo: { ar: 'بيانات التواصل', en: 'Contact' } as T,
  features: { ar: 'ماذا تتضمن؟', en: 'What’s included' } as T,
  modes: { ar: 'نمط التنفيذ', en: 'Delivery' } as T,
  allServices: { ar: 'كل الخدمات', en: 'All services' } as T,
  back: { ar: 'العودة', en: 'Back' } as T,
};

// ---------- دوال نقية ----------
export function serviceBySlug(slug: string): Service | undefined { return SERVICES.find(s => s.slug === slug); }

export type PublicProgram = { id: string; name_ar: string; name_en?: string | null; delivery_mode?: string | null; status?: string | null; start_date?: string | null; end_date?: string | null; audience_ar?: string | null; intro_ar?: string | null; archived_at?: string | null };

export function deliveryLabel(mode: string | null | undefined, lang: Lang): string {
  const m = String(mode || '').toLowerCase();
  if (!m) return '';
  if (m.includes('remote') || m.includes('online')) return t(UI.remote, lang);
  if (m.includes('hybrid') || m.includes('blend')) return t(UI.hybrid, lang);
  return t(UI.onsite, lang);
}

/** البرامج المعروضة للعامة: غير مؤرشفة، غير ملغاة، لم تنتهِ بعد — مرتبة بتاريخ البداية */
export function publicPrograms(rows: PublicProgram[], today: string): (PublicProgram & { state: 'ongoing' | 'upcoming' })[] {
  return rows
    .filter(p => !p.archived_at && !['CANCELLED', 'COMPLETED'].includes(String(p.status || '').toUpperCase()) && (!p.end_date || p.end_date >= today))
    .map(p => ({ ...p, state: (p.start_date && p.start_date <= today ? 'ongoing' : 'upcoming') as 'ongoing' | 'upcoming' }))
    .sort((a, b) => String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')));
}

export function programName(p: PublicProgram, lang: Lang): string { return (lang === 'en' && p.name_en) ? p.name_en : p.name_ar; }

export function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  if (!isFinite(d.getTime())) return String(iso);
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const CONTACT_SUBJECTS: { value: string; label: T }[] = [
  { value: 'arabic', label: { ar: 'تعليم العربية للناطقين بغيرها', en: 'Arabic for non-native speakers' } },
  { value: 'training', label: { ar: 'برنامج تدريبي', en: 'Training program' } },
  { value: 'diplomas', label: { ar: 'الدبلومات', en: 'Diplomas' } },
  { value: 'consulting', label: { ar: 'استشارة', en: 'Consulting' } },
  { value: 'resources', label: { ar: 'الحقائب التدريبية', en: 'Training resources' } },
  { value: 'live', label: { ar: 'البث المتزامن', en: 'Live channels' } },
  { value: 'evaluation', label: { ar: 'منصة التقويم', en: 'Evaluation platform' } },
  { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
];

export function validateContact(f: { name: string; email: string; phone?: string; subject: string; message: string }, lang: Lang): string | null {
  const msg = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (!f.name.trim() || f.name.trim().length < 2) return msg('اكتب الاسم', 'Enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return msg('البريد الإلكتروني غير صالح', 'Invalid email');
  if (f.phone && f.phone.trim() && !/^[+\d][\d\s\-()]{6,}$/.test(f.phone.trim())) return msg('رقم الهاتف غير صالح', 'Invalid phone number');
  if (!CONTACT_SUBJECTS.some(s => s.value === f.subject)) return msg('اختر الموضوع', 'Choose a subject');
  if (!f.message.trim() || f.message.trim().length < 10) return msg('اكتب رسالة من 10 أحرف على الأقل', 'Write at least 10 characters');
  if (f.message.length > 4000) return msg('الرسالة طويلة جدًا', 'Message too long');
  return null;
}
