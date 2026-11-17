// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ — من أَثَر» (ق1) — السجلّ: الأسماء الرسمية · الرِّواقات السبعة · الحدود الثابتة.
 *  الاسم بالرسم القرآني «اقْرَأْ» (همزة وصل) — وفي الكلام العادي «إقرأ»؛ بالإنجليزية Iqra.
 *  المبدأ: تعلّم ذاتي غير متزامن على سُلّم الإطار الأوروبي المرجعي المشترك (CEFR)؛ الدخول بنتيجة «مِعيار» المعتمدة فقط؛
 *  واجهة المتعلّم عربية فقط؛ المحتوى يعتمده إنسان؛ لا أثر على التقييم أو الشهادة؛ التقدّم ملك المتعلّم ويُحذف فورًا عند الطلب.
 */
export const IQRA_NAMES_AR = {
  product: 'اقْرَأْ',
  full: 'اقْرَأْ — من أَثَر',
  en: 'Iqra — self-paced Arabic',
  nature: 'تعلّم ذاتي غير متزامن للعربية على سُلّم الإطار الأوروبي المرجعي',
  hall: 'رِواق',           /* رِواق المستوى: بيت المتعلّم داخل اقْرَأْ */
  unit: 'مَنزِلة', units: 'المنازل',
  lesson: 'حَلْقة', lessons: 'الحلقات',
  exercise: 'مِران',
  review: 'أراجع',
  threshold: 'عَتَبة',
  notebook: 'دفتري',
  steps: 'خطواتي',
  streak: 'أيامي المتّصلة',
  daily: 'سؤال اليوم',
  closing: 'أثر الحلقة',
  tutor_soon: 'اسأل أثير — قريبًا',
  voice_soon: 'تدرّب بصوتك — قريبًا',
} as const;

export const IQRA_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type IqraLevel = (typeof IQRA_LEVELS)[number];
export const isIqraLevel = (v: unknown): v is IqraLevel => typeof v === 'string' && (IQRA_LEVELS as readonly string[]).includes(v);

/** الاسم المدمج (قرار 2026-11-17): الاسم العربي الودّي + رمز CEFR معًا — «مكتشف · A1» */
export const LEVEL_META: Record<IqraLevel, { name_ar: string; code: string; line_ar: string; can_ar: string }> = {
  PRE_A1: { name_ar: 'تمهيدي', code: 'Pre-A1', line_ar: 'الحروف والأصوات وكلماتي الأولى', can_ar: 'أقرأ الحروف وأكتب اسمي وأفهم التحية.' },
  A1: { name_ar: 'مكتشف', code: 'A1', line_ar: 'أولى الخطوات: أنا وعائلتي ومدينتي', can_ar: 'أفهم جملًا قصيرة عن نفسي وأسأل عن الأشياء القريبة.' },
  A2: { name_ar: 'مبتدئ', code: 'A2', line_ar: 'الحياة اليومية والسفر والعمل البسيط', can_ar: 'أتحدّث عن يومي وأفهم رسائل قصيرة وأطلب ما أحتاج.' },
  B1: { name_ar: 'متوسط', code: 'B1', line_ar: 'عتبة الاستقلال: أروي وأشرح وأقترح', can_ar: 'أتابع حديثًا مألوفًا وأكتب نصًّا متّصلًا عن تجربتي.' },
  B2: { name_ar: 'مستقل', code: 'B2', line_ar: 'النقاش والرأي والنصّ المركّب', can_ar: 'أناقش بطلاقة وأفهم مقالًا وأكتب رأيًا مسبَّبًا.' },
  C1: { name_ar: 'متقدّم', code: 'C1', line_ar: 'الدقّة والبلاغة والمعنى الضمني', can_ar: 'أدرك ما وراء السطور وأكتب بأسلوب يناسب المقام.' },
  C2: { name_ar: 'متقن', code: 'C2', line_ar: 'التراث والأكاديميا والمناظرة', can_ar: 'أفهم كلّ ما أقرأ وأسمع وأعبّر بدقّة البليغ.' },
};
export const levelLabel = (l: IqraLevel) => `${LEVEL_META[l].name_ar} · ${LEVEL_META[l].code}`;
export const levelOrder = (l: IqraLevel) => IQRA_LEVELS.indexOf(l);
export const nextLevel = (l: IqraLevel): IqraLevel | null => IQRA_LEVELS[levelOrder(l) + 1] || null;

/** تحويل قرار مِعيار (assigned_level) إلى رِواق — مستويات السجلّ تتطابق؛ أي قيمة أخرى تعود null (لا تخمين) */
export const levelFromDecision = (v: unknown): IqraLevel | null => (isIqraLevel(v) ? v : v === 'BELOW_A1' || v === 'A0' ? 'PRE_A1' : null);

export const IQRA_LIMITS = {
  lesson_pass_pct: 70,          /* «أثر الحلقة» يُفتح بـ 70% فأكثر — وتبقى الحلقة قابلة للإعادة بلا حدّ */
  review_steps_days: [1, 3, 7, 14, 30] as readonly number[],   /* التكرار المتباعد */
  review_batch: 12,             /* أقصى بطاقات في جلسة «أراجع» */
  daily_question_pool: 1,       /* سؤال اليوم: واحد من بنود الرِّواق المعتمدة (بذرة اليوم + البريد) */
  cards_per_lesson_max: 16,
  items_per_lesson_max: 10,
  content_max_bytes: 24_000,
  import_max_lessons: 60,
  writes_per_hour: 240,
  k_min: 5,                     /* أيّ رقم جماعي يُعرض للطاقم بأقلّ من 5 متعلّمين لا يُعرض */
} as const;

/** مفاتيح واجهة المتعلّم (عربية فقط) */
export const UI_AR = {
  gate_title: 'ابدأ بمِعيار أولًا',
  gate_body: 'اقْرَأْ يفتح رِواقك بعد نتيجة «مِعيار» المعتمدة، حتى تبدأ من موضعك الصحيح على السُّلّم لا قبله ولا بعده.',
  gate_cta: 'إلى مِعيار',
  pending_title: 'نتيجتك في انتظار الاعتماد',
  pending_body: 'سيفتح رِواقك فور اعتماد الطاقم لقرار التسكين.',
  empty_level: 'حلقات هذا الرِّواق قيد الإعداد والاعتماد — تعود قريبًا.',
  ready: 'أتممتُ الحلقة',
  again: 'أعيدها',
  next: 'الحلقة التالية',
  check: 'تحقّق',
  correct: 'أحسنت',
  wrong: 'ليس بعد — انظر الشرح',
  review_again: 'ما زلت أتعلّمها', review_good: 'أعرفها', review_easy: 'سهلة',
  no_reviews: 'لا بطاقات مستحقّة اليوم — عد غدًا أو أكمل حلقة جديدة.',
} as const;
