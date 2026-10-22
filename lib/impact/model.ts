/**
 * قياس أثر التدريب (قبلي/بعدي) — النماذج والأنواع والقوالب الجاهزة
 * Impact measurement: types, templates and small pure helpers (no deps).
 */

export type QuestionKind = 'scale' | 'mcq';
export type Phase = 'pre' | 'post';

export type McqOption = { k: string; ar: string; en?: string };

export type ImpactQuestion = {
  id: string; assessment_id?: string; order_no: number; kind: QuestionKind; domain_ar: string;
  text_ar: string; text_en?: string | null; options: McqOption[]; correct_key?: string | null; weight?: number;
};

export type ImpactAssessment = {
  id: string; organization_id?: string | null; program_id: string | null; classroom_id: string | null;
  title_ar: string; title_en?: string | null; intro_ar?: string | null; token: string;
  status: 'draft' | 'open' | 'closed'; pre_open: boolean; post_open: boolean; scale_max: number;
  identity_hint_ar: string; created_by_name?: string | null; created_at?: string; updated_at?: string;
};

export type ImpactResponse = {
  id: string; assessment_id: string; phase: Phase; respondent_hash: string; respondent_label: string | null;
  gender: string | null; answers: Record<string, string | number>; scale_mean: number | null;
  knowledge_pct: number | null; score: number | null; submitted_at: string;
};

export const PHASE_LABEL: Record<Phase, { ar: string; en: string; short: string }> = {
  pre: { ar: 'القياس القبلي (قبل التدريب)', en: 'Pre-assessment', short: 'قبلي' },
  post: { ar: 'القياس البعدي (بعد التدريب)', en: 'Post-assessment', short: 'بعدي' },
};

/** تسميات مقياس التقدير الذاتي */
export function scaleLabels(max: number): { v: number; ar: string; en: string }[] {
  if (max === 5) return [
    { v: 1, ar: 'ضعيف جدًا', en: 'Very low' }, { v: 2, ar: 'ضعيف', en: 'Low' }, { v: 3, ar: 'متوسط', en: 'Moderate' },
    { v: 4, ar: 'جيد', en: 'Good' }, { v: 5, ar: 'ممتاز', en: 'Excellent' },
  ];
  return Array.from({ length: max }, (_, i) => ({ v: i + 1, ar: String(i + 1), en: String(i + 1) }));
}

/** رمز رابط عام مكوّن من 8 رموز بدون الأحرف الملتبسة */
export function makeToken(rand: () => number = Math.random): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}

export function impactUrl(token: string, phase?: Phase): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '')).replace(/\/$/, '');
  return `${base}/impact/${token}${phase ? `?phase=${phase}` : ''}`;
}

/** حساب الدرجة الموحدة محليًا (نفس منطق دالة SQL) — للمعاينة والاختبارات */
export function computeScore(questions: ImpactQuestion[], answers: Record<string, string | number>, scaleMax: number): { scale_mean: number | null; knowledge_pct: number | null; score: number | null } {
  let sSum = 0, sN = 0, kOk = 0, kN = 0;
  for (const q of questions) {
    const v = answers[q.id];
    if (v === undefined || v === null || v === '') continue;
    if (q.kind === 'scale') { sSum += Math.min(Math.max(Number(v), 1), scaleMax); sN++; }
    else { const w = q.weight ?? 1; kN += w; if (q.correct_key && String(v) === q.correct_key) kOk += w; }
  }
  if (!sN && !kN) return { scale_mean: null, knowledge_pct: null, score: null };
  const sm = sN ? +(sSum / sN).toFixed(3) : null;
  const kp = kN ? +((100 * kOk) / kN).toFixed(2) : null;
  const parts: number[] = [];
  if (sm !== null) parts.push(scaleMax > 1 ? (100 * (sm - 1)) / (scaleMax - 1) : 0);
  if (kp !== null) parts.push(kp);
  return { scale_mean: sm, knowledge_pct: kp, score: +(parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2) };
}

/* ----------------------------------------------------------------------------
 * قوالب جاهزة (يمكن تعديلها بعد الإدراج)
 * ------------------------------------------------------------------------- */
export type Template = { id: string; ar: string; desc: string; questions: Omit<ImpactQuestion, 'id' | 'order_no'>[] };

const S = (domain_ar: string, text_ar: string, text_en?: string): Omit<ImpactQuestion, 'id' | 'order_no'> => ({ kind: 'scale', domain_ar, text_ar, text_en: text_en || null, options: [], correct_key: null, weight: 1 });

export const TEMPLATES: Template[] = [
  {
    id: 'competency', ar: 'تقدير ذاتي للكفايات (عام)', desc: '8 بنود على مقياس 1–5 تغطي المعرفة والمهارة والتطبيق والثقة.',
    questions: [
      S('المعرفة', 'أعرف المفاهيم الأساسية لموضوع البرنامج', 'I know the core concepts of the program topic'),
      S('المعرفة', 'أستطيع شرح الموضوع لزميل بوضوح', 'I can clearly explain the topic to a colleague'),
      S('المهارة', 'أمتلك المهارات العملية اللازمة لتطبيق ما يتناوله البرنامج', 'I have the practical skills to apply the program content'),
      S('المهارة', 'أستطيع أداء المهام المرتبطة بالموضوع دون مساعدة', 'I can perform related tasks without help'),
      S('التطبيق', 'أعرف كيف أطبّق ما تعلمته في عملي/دراستي', 'I know how to apply what I learn in my work/study'),
      S('التطبيق', 'أستطيع حل المشكلات الشائعة المرتبطة بالموضوع', 'I can solve common problems related to the topic'),
      S('الثقة', 'أشعر بالثقة عند التعامل مع هذا الموضوع', 'I feel confident dealing with this topic'),
      S('الثقة', 'أستطيع تدريب الآخرين على أساسيات الموضوع', 'I could coach others on the basics of this topic'),
    ],
  },
  {
    id: 'language', ar: 'اللغة العربية للناطقين بغيرها', desc: '8 بنود للمهارات اللغوية الأربع + الثقة.',
    questions: [
      S('الاستماع', 'أفهم حديثًا بسيطًا باللغة العربية عن مواضيع يومية', 'I understand simple spoken Arabic about daily topics'),
      S('التحدث', 'أستطيع التعريف بنفسي وإجراء محادثة قصيرة', 'I can introduce myself and hold a short conversation'),
      S('التحدث', 'أستطيع طلب الخدمات (مطعم، مواصلات، تسوق) بالعربية', 'I can request services in Arabic'),
      S('القراءة', 'أقرأ اللافتات والنصوص القصيرة وأفهمها', 'I can read and understand signs and short texts'),
      S('الكتابة', 'أكتب جملًا بسيطة صحيحة', 'I can write simple correct sentences'),
      S('المفردات', 'أمتلك رصيدًا كافيًا من المفردات للمواقف اليومية', 'I have enough vocabulary for daily situations'),
      S('القواعد', 'أستخدم التراكيب الأساسية (الجملة الاسمية والفعلية) بشكل صحيح', 'I use basic structures correctly'),
      S('الثقة', 'أشعر بالثقة عند التحدث بالعربية مع الناطقين بها', 'I feel confident speaking Arabic with natives'),
    ],
  },
  {
    id: 'blank', ar: 'أداة فارغة', desc: 'ابدأ من الصفر وأضف البنود يدويًا (مقياس أو أسئلة معرفية).', questions: [],
  },
];

export const MCQ_KEYS = ['a', 'b', 'c', 'd', 'e'];

export function emptyMcq(): Omit<ImpactQuestion, 'id' | 'order_no'> {
  return { kind: 'mcq', domain_ar: 'المعرفة', text_ar: '', text_en: null, options: [{ k: 'a', ar: '' }, { k: 'b', ar: '' }, { k: 'c', ar: '' }, { k: 'd', ar: '' }], correct_key: 'a', weight: 1 };
}
