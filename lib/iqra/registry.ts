// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ — من أَثَر» (ق1) — السجلّ: الأسماء الرسمية · المستويات السبعة · الحدود الثابتة.
 *  الاسم بالرسم القرآني «اقْرَأْ» (همزة وصل) — وفي الكلام العادي «إقرأ»؛ بالإنجليزية Iqra.
 *  المبدأ: تعلّم ذاتي غير متزامن على سُلّم الإطار الأوروبي المرجعي المشترك (CEFR)؛ الدخول بنتيجة «مِعيار» المعتمدة فقط؛
 *  واجهة المتعلّم عربية فقط؛ المحتوى يعتمده إنسان؛ لا أثر على التقييم أو الشهادة؛ التقدّم ملك المتعلّم ويُحذف فورًا عند الطلب.
 */
export const IQRA_NAMES_AR = {
  product: 'اقْرَأْ',
  full: 'اقْرَأْ — من أَثَر',
  en: 'Iqra — self-paced Arabic',
  nature: 'تعلّم ذاتي غير متزامن للعربية على سُلّم الإطار الأوروبي المرجعي',
  hall: 'مستوى',           /* المستوى: بيت المتعلّم داخل اقْرَأْ */
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

/** تحويل قرار مِعيار (assigned_level) إلى مستوى — مستويات السجلّ تتطابق؛ أي قيمة أخرى تعود null (لا تخمين) */
export const levelFromDecision = (v: unknown): IqraLevel | null => (isIqraLevel(v) ? v : v === 'BELOW_A1' || v === 'A0' ? 'PRE_A1' : null);

export const IQRA_LIMITS = {
  lesson_pass_pct: 70,          /* «أثر الحلقة» يُفتح بـ 70% فأكثر — وتبقى الحلقة قابلة للإعادة بلا حدّ */
  review_steps_days: [1, 3, 7, 14, 30] as readonly number[],   /* التكرار المتباعد */
  review_batch: 12,             /* أقصى بطاقات في جلسة «أراجع» */
  daily_question_pool: 1,       /* سؤال اليوم: واحد من بنود المستوى المعتمدة (بذرة اليوم + البريد) */
  cards_per_lesson_max: 16,
  items_per_lesson_max: 30,     /* الخطوة 2: 30 تمرينًا في الحلقة — 10 تُسحب في كلّ زيارة على ثلاثة أيام */
  items_per_lesson_max_pre_a1: 40, /* اقْرَأْ ت٣ (2026-11-20): التمهيديّ 40 تمرينًا (تمارين قصيرة جدًّا: حرف/كلمة/صورة) — 4 زيارات × 10 */
  items_per_lesson_target: 30,
  draw_per_visit: 10,
  cards_per_lesson_min: 8,
  kinds_per_lesson_min: 4,      /* تنوّع المِران: 4 أنواع على الأقل في الحلقة */
  content_max_bytes: 60_000,   /* B2/C1: نصّ حتى 9,000 حرف + نموذج حتى 4,000 */
  import_max_lessons: 60,
  tick_max_seconds: 60,         /* «ساعاتي»: أقصى ما تضيفه نبضة واحدة (كلّ 30 ث) */
  tick_day_cap_seconds: 6 * 3600, /* سقف يوم واحد لنشاط واحد — ضدّ الصفحات المنسيّة */
  fairness_min_pct: 40,         /* ميثاق الإنصاف: لا يقلّ حضور أيّ من الجنسين عن 40% في نصوص الحلقة */
  fairness_min_refs: 6,
  writes_per_hour: 240,
  k_min: 5,                     /* أيّ رقم جماعي يُعرض للطاقم بأقلّ من 5 متعلّمين لا يُعرض */
  /* ق٢ (2026-11-17) */
  produce_min_words: 20,        /* طابور «أُنتج»: لا يُرسَل نصّ دون 20 كلمة */
  produce_per_week: 2,          /* نصّان في الأسبوع لكلّ متعلّم (يرتفع مع الميسِّر لاحقًا) */
  produce_slow_queue: 50,       /* فوق 50 نصًّا في الطابور يُقال للمتعلّم «خلال أسبوعين» بدل «خلال أسبوع» */
  threshold_invite_days: 30,    /* صلاحية دعوة «العَتَبة» الشخصية */
  offline_units_max: 2,         /* «المنزلة في جيبي»: منزلتان محمّلتان معًا على الجهاز */
} as const;
/** سقف المِران حسب المستوى: التمهيديّ 40 (تمارين قصيرة جدًّا) والمتقن C2 40 (أسئلة في طبقات حرفيّ/استدلاليّ/نقديّ)، وما سواهما 30 */
export const ITEMS_MAX_BY_LEVEL: Partial<Record<IqraLevel, number>> = { PRE_A1: IQRA_LIMITS.items_per_lesson_max_pre_a1, C2: IQRA_LIMITS.items_per_lesson_max_pre_a1 };
export const itemsMaxFor = (level: string | null | undefined): number => (level && ITEMS_MAX_BY_LEVEL[level as IqraLevel]) || IQRA_LIMITS.items_per_lesson_max;
/** سقف البطاقات حسب المستوى: المتقن C2 20 (تراثيّ · أكاديميّ · أمثال)، وما سواه 16 */
export const cardsMaxFor = (level: string | null | undefined): number => (level === 'C2' ? 20 : IQRA_LIMITS.cards_per_lesson_max);

/* ---------- ق٢: «العَتَبة» (Level-exit gate) · طابور «أُنتج» (analytic rubric) ---------- */
/** حالات طلب العَتَبة — المصدر الوحيد للحكم هو تقرير مِعيار (اختبار نهاية المستوى المعياري «عُبور») */
export const THRESHOLD_STATUSES = ['requested', 'deferred', 'invited', 'sat', 'passed', 'failed', 'promoted', 'cancelled'] as const;
export type ThresholdStatus = (typeof THRESHOLD_STATUSES)[number];
export const THRESHOLD_LIVE: readonly ThresholdStatus[] = ['requested', 'deferred', 'invited', 'sat', 'passed']; /* passed: بانتظار اعتماد الترقية — ما زال حيًّا */
export const THRESHOLD_STATUS_AR: Record<ThresholdStatus, string> = {
  requested: 'طلبٌ بانتظار الطاقم', deferred: 'مؤجَّل', invited: 'دعوتك جاهزة', sat: 'النتيجة قيد التصحيح',
  passed: 'اجتزتَ', failed: 'لم تجتز هذه المرّة', promoted: 'انتقلتَ إلى المستوى التالي', cancelled: 'أُلغي',
};
/** سلّم التقدير التحليلي للكتابة (CEFR analytic rubric): أربعة أبعاد × 4 درجات */
export const PRODUCE_RUBRIC = ['content', 'organisation', 'vocabulary', 'accuracy'] as const;
export type RubricDim = (typeof PRODUCE_RUBRIC)[number];
export const RUBRIC_AR: Record<RubricDim, { name_ar: string; bands_ar: [string, string, string, string] }> = {
  content: { name_ar: 'المضمون وإنجاز المهمّة', bands_ar: ['لم يُنجز المهمّة', 'أنجز جزءًا منها', 'أنجزها مع نقص يسير', 'أنجزها كاملة'] },
  organisation: { name_ar: 'التنظيم والترابط', bands_ar: ['جمل مبعثرة', 'ترابط ضعيف', 'ترابط مقبول بأدوات بسيطة', 'نصّ متّصل واضح'] },
  vocabulary: { name_ar: 'المفردات', bands_ar: ['دون مفردات المستوى', 'مفردات محدودة متكرّرة', 'مفردات المستوى بتنويع', 'مفردات دقيقة ومناسبة'] },
  accuracy: { name_ar: 'الصحّة اللغوية', bands_ar: ['أخطاء تعيق الفهم', 'أخطاء كثيرة لا تعيق', 'أخطاء قليلة', 'صحيح في معظمه'] },
};
export const PRODUCE_STATUS_AR = { queued: 'في طابور المراجعة', reviewed: 'رُوجع', withdrawn: 'سُحب' } as const;

/** الخطوة 2 (2026-11-17): قالب المَنزِلة — خمس حلقات، لكلّ حلقة مهارة من الإطار الأوروبي */
export const IQRA_SKILLS = ['listen', 'read', 'grammar', 'speak', 'write'] as const;
export type IqraSkill = (typeof IQRA_SKILLS)[number];
export const isIqraSkill = (v: unknown): v is IqraSkill => typeof v === 'string' && (IQRA_SKILLS as readonly string[]).includes(v);
export const SKILL_META: Record<IqraSkill, { name_ar: string; name_en: string; cefr: string; icon: string }> = {
  listen: { name_ar: 'أسمع وأفهم', name_en: 'Listening', cefr: 'Oral comprehension', icon: 'ear' },
  read: { name_ar: 'أقرأ وأفهم', name_en: 'Reading', cefr: 'Reading comprehension', icon: 'book' },
  grammar: { name_ar: 'أبني الجملة', name_en: 'Grammar & vocabulary', cefr: 'Linguistic competence', icon: 'blocks' },
  speak: { name_ar: 'أتحدّث', name_en: 'Speaking', cefr: 'Oral production & interaction', icon: 'mic' },
  write: { name_ar: 'أكتب وأُتقن', name_en: 'Writing', cefr: 'Written production', icon: 'pen' },
};
/** محطّات الحلقة الستّ (≈ ساعتان على أيام): أسمع وأقرأ 20 د · كلماتي 25 د · القاعدة 20 د · المِران 3×10 د · أُنتج 30 د · أثر الحلقة */
export const STATIONS_AR = ['أسمع وأقرأ', 'كلماتي', 'القاعدة', 'المِران', 'أُنتج', 'أثر الحلقة'] as const;
/** أنواع المِران التسعة (ثلاثة من ق1 + ستّة جديدة) */
export const EXERCISE_KINDS = ['mcq', 'matching', 'ordering', 'picture_choice', 'cloze_bank', 'true_false_notgiven', 'word_tap', 'short_dictation', 'picture_sequence'] as const;
export const KIND_AR: Record<(typeof EXERCISE_KINDS)[number], string> = { mcq: 'اختيار', matching: 'مطابقة', ordering: 'ترتيب الجملة', picture_choice: 'اختيار بالصورة', cloze_bank: 'ملء الفراغ', true_false_notgiven: 'صحيح · خطأ · غير مذكور', word_tap: 'المس الكلمة', short_dictation: 'إملاء قصير', picture_sequence: 'ترتيب الصور' };

/** «مِئة ساعة» — عقد الزمن (قرار 2026-11-17، السلّم المتدرّج): ساعات تعلّم ذاتي مقيسة داخل البوابة لكلّ مستوى.
 *  مرجعيًّا: Cambridge GLH التراكمي A1 90–100 · A2 180–200 · B1 350–400 · B2 500–600 · C1 700–800 · C2 1000–1200؛ والعربية فئة FSI الرابعة فالسلّم يصعد. */
export const HOURS_TARGET: Record<IqraLevel, number> = { PRE_A1: 40, A1: 100, A2: 120, B1: 180, B2: 200, C1: 220, C2: 240 };
/** العَتَبة المرنة: الاختبار المبكّر يُفتح عند ≥ 70% من الساعات مع إتقان ≥ 90% من الحلقات؛ وإلّا الأرضية كاملة + الإتقان */
export const THRESHOLD_RULE = { early_hours_pct: 70, early_mastery_pct: 90, full_mastery_pct: 100, lesson_pass_pct: 70 } as const;
export const COUNTED_ACTIVITIES = ['lesson', 'review', 'daily', 'library', 'free', 'produce'] as const;
export type Activity = (typeof COUNTED_ACTIVITIES)[number] | 'external';
export const isActivity = (v: unknown): v is Activity => typeof v === 'string' && ([...COUNTED_ACTIVITIES, 'external'] as string[]).includes(v);

/** مفاتيح واجهة المتعلّم (عربية فقط) */
export const UI_AR = {
  gate_title: 'ابدأ بمِعيار أولًا',
  gate_body: 'اقْرَأْ يفتح مستواك بعد نتيجة «مِعيار» المعتمدة، حتى تبدأ من موضعك الصحيح على السُّلّم لا قبله ولا بعده.',
  gate_cta: 'إلى مِعيار',
  pending_title: 'نتيجتك في انتظار الاعتماد',
  pending_body: 'سيفتح مستواك فور اعتماد الطاقم لقرار التسكين.',
  empty_level: 'حلقات هذا المستوى قيد الإعداد والاعتماد — تعود قريبًا.',
  ready: 'أتممتُ الحلقة',
  again: 'أعيدها',
  next: 'الحلقة التالية',
  check: 'تحقّق',
  correct: 'أحسنت',
  wrong: 'ليس بعد — انظر الشرح',
  review_again: 'ما زلت أتعلّمها', review_good: 'أعرفها', review_easy: 'سهلة',
  no_reviews: 'لا بطاقات مستحقّة اليوم — عد غدًا أو أكمل حلقة جديدة.',
  /* ق٢ */
  thr_title: 'العَتَبة',
  thr_what: 'العَتَبة هي «اختبار نهاية المستوى — معياري (CEFR)» في مِعيار: استماع وقراءة واستعمال اللغة (60%) وكتابة (20%) وتحدّث (20%). الاجتياز من 60% ولا مهارة دون 50%. الإعادة بعد 7 أيام، وإعادة مهارة واحدة خلال 14 يومًا.',
  thr_who: 'يقبل الطلب طاقم أَثَر، ويعتمد الانتقال إلى المستوى التالي بتوقيعه. نتيجتك لا تمسّ شهادة سابقة.',
  thr_ask: 'أطلب العَتَبة',
  thr_cancel: 'أسحب طلبي',
  thr_pre_a1: 'في التمهيدي ينتقل المتعلّم إلى «مكتشف · A1» بقرار الطاقم بعد إتمام حلقاته — لا اختبار هنا.',
  thr_c2: 'أنت في أعلى السُّلّم — لا عَتَبة بعد المتقن. بدلها «إجازة أَثَر» على طريقة القدماء: حين يعتمد الطاقم مشروعك الختاميّ «كتاب المجلس» (المنزلة الثامنة، حلقة الإجازة) يُصدرها لك بنصّ ثابت وتاريخ، وتظهر في «خريطة أثري».',
  prod_send: 'أرسل لمراجعة بشرية',
  prod_withdraw: 'أسحب النصّ',
  prod_who: 'يقرؤه مصحّح من طاقم أَثَر ويردّ بدرجة من 4 على أربعة أبعاد وجملة واحدة يعيد كتابتها لك. نصّك ملكك ويُحذف مع تقدّمك.',
} as const;

/** «إجازة أَثَر» (C2 ج٤ — §3هـ من مقترح C2): لا عَتَبة بعد المتقن؛ بدلها إجازة على طريقة القدماء يُصدرها الطاقم بعد اعتماد المشروع الختاميّ في طابور «أُنتج».
 *  تُحفَظ سطرًا في iqra_progress (station = 'licence' بلا lesson_id ولا library_id — بلا جدول جديد) وتُعلَن حدثًا في portal_learning_events فتظهر في «خريطة أثري». النصّ ثابت لا يُحرَّر. */
export const LICENCE_LESSON_CODE = 'C2-U08-L05';
export const LICENCE_TITLE_AR = 'إجازة أَثَر — اقْرَأْ · متقن C2';
export const licenceText = (email: string, issued_at: string) => `أجاز طاقم أَثَر حامل هذه الإجازة (${email}) في قراءة العربيّة وسماعها والكتابة بها والتحدّث بها على مستوى المتقن C2 بعد أن أتمّ منازل «اقْرَأْ» كلّها من التمهيديّ إلى المتقن واعتُمد مشروعه الختاميّ «كتاب المجلس»، وأذن له أن يقرأ ويُقرئ، وأن يضيف الشيء إلى قائله — ومن بركة العلم أن يُنسب القول إلى صاحبه. حُرِّرت في ${issued_at.slice(0, 10)}. قرار التسكين الرسميّ يبقى لمِعيار؛ وهذه الإجازة شهادة طريق لا شهادة اختبار.`;
