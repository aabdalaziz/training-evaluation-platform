/**
 * Reports analytics engine — pure functions (no React, no Supabase).
 * Turns raw evaluation rows into decision-ready KPIs, breakdowns, trends,
 * comparisons, qualitative insights, a risk register and a narrative.
 */

/* ============================================================ types */
export type Lang = 'ar' | 'en';
export type Kind = 'DAILY' | 'FINAL';

export type RawEvaluation = {
  id: string; program_id: string | null; classroom_id: string | null; kind: Kind | string;
  submitted_at: string | null; evaluation_date?: string | null; overall_rating?: number | null;
  guest_email?: string | null; guest_name?: string | null; guest_phone?: string | null;
  guest_gender?: string | null; accommodation_type?: string | null; trainee_id?: string | null;
};
export type RawAnswer = {
  evaluation_id: string; question_id: string; rating_value: number | string | null;
  text_value?: string | null; selected_option?: string | null; selected_options?: string[] | null;
};
export type RawQuestion = {
  id: string; question_key?: string | null; kind?: string | null; text_ar?: string | null; text_en?: string | null;
  section_ar?: string | null; section_en?: string | null; order_index?: number | null;
};
export type Classroom = { id: string; code: string; program_id?: string | null; trainer_id?: string | null; delivery_mode?: string | null; level?: string | null };
export type Trainer = { id: string; name: string };
export type Program = {
  id: string; name_ar: string; name_en?: string | null; delivery_mode?: string | null; status?: string | null;
  start_date?: string | null; end_date?: string | null;
  intro_ar?: string | null; intro_en?: string | null; objectives_ar?: string | null; objectives_en?: string | null;
  outcomes_ar?: string | null; outcomes_en?: string | null; audience_ar?: string | null; audience_en?: string | null;
};

export type Lookups = { classrooms: Classroom[]; trainers: Trainer[]; programs: Program[]; questions: RawQuestion[] };

export type Evaluation = RawEvaluation & {
  trainer_id: string | null; date: string; /* YYYY-MM-DD (Riyadh) */ ratings: number[]; mean: number | null;
};
/** One rating measurement (evaluation × question), duplicates collapsed. */
export type Fact = {
  evaluation_id: string; question_id: string; question_key: string; section_ar: string; section_en: string;
  text_ar: string; text_en: string; category: Category; value: number;
};
export type Comment = {
  evaluation_id: string; date: string; kind: string; program_id: string | null; classroom_id: string | null; trainer_id: string | null;
  question_id: string; question_ar: string; question_en: string; text: string; sentiment: 'positive' | 'negative' | 'neutral';
};

export type Filters = {
  programId?: string; trainerId?: string; classroomId?: string; kind?: 'ALL' | Kind;
  from?: string; to?: string; gender?: string; deliveryMode?: 'remote' | 'onsite' | '';
};

export type Category = 'trainer' | 'education' | 'facility' | 'arrival' | 'hospitality' | 'transport' | 'housing' | 'tours' | 'umrah' | 'administration' | 'satisfaction' | 'general';
export type PerfKey = 'EXCELLENT' | 'GOOD' | 'WATCH' | 'RISK' | 'NA';
export type RiskKey = 'HIGH' | 'MED' | 'LOW' | 'NA';

export type Stats = {
  n: number; mean: number; median: number; sd: number; min: number; max: number;
  lowPct: number; neutralPct: number; highPct: number; dist: [number, number, number, number, number];
};
export type GroupRow = Stats & {
  key: string; label: string; responses: number; participants: number; gap: number;
  perf: PerfKey; risk: RiskKey; delta: number | null; /* second half − first half */
  meta?: Record<string, unknown>;
};
export type Kpis = {
  responses: number; participants: number; daily: number; final: number; measurements: number;
  mean: number; median: number; sd: number; highPct: number; lowPct: number; gap: number;
  perf: PerfKey; risk: RiskKey; rooms: number; trainers: number; programs: number;
  firstDate: string; lastDate: string; days: number; perDay: number;
  dist: [number, number, number, number, number];
};
export type SeriesPoint = { key: string; label: string; n: number; responses: number; mean: number | null; ma: number | null };
export type Comparison = {
  current: Kpis; previous: Kpis; from: string; to: string; prevFrom: string; prevTo: string;
  deltaMean: number | null; deltaResponses: number; deltaHighPct: number | null; deltaLowPct: number | null;
};
export type Action = {
  id: string; area: 'axis' | 'trainer' | 'classroom' | 'program' | 'question'; label: string; category: Category;
  mean: number; gap: number; n: number; responses: number; lowPct: number; sd: number;
  priority: 'HIGH' | 'MED' | 'LOW'; impact: number; recommendation: string; owner: string; dueDays: number; kpi: string;
};

/* ============================================================ constants */
export const TARGET = 4.2;
export const THRESHOLDS = { excellent: 4.2, good: 3.7, watch: 3.0, minSample: 5 };

export const KIND_LABEL: Record<string, { ar: string; en: string }> = {
  DAILY: { ar: 'يومي', en: 'Daily' }, FINAL: { ar: 'ختامي', en: 'Final' }, ALL: { ar: 'الكل', en: 'All' },
};
export const PERF_LABEL: Record<PerfKey, { ar: string; en: string; color: string; bg: string }> = {
  EXCELLENT: { ar: 'ممتاز', en: 'Excellent', color: '#047857', bg: '#d1fae5' },
  GOOD: { ar: 'جيد', en: 'Good', color: '#0f766e', bg: '#ccfbf1' },
  WATCH: { ar: 'مراقبة', en: 'Watch', color: '#b45309', bg: '#fef3c7' },
  RISK: { ar: 'خطر', en: 'At risk', color: '#b91c1c', bg: '#fee2e2' },
  NA: { ar: 'بيانات غير كافية', en: 'Insufficient', color: '#64748b', bg: '#f1f5f9' },
};
export const RISK_LABEL: Record<RiskKey, { ar: string; en: string; color: string; bg: string }> = {
  HIGH: { ar: 'عالٍ', en: 'High', color: '#b91c1c', bg: '#fee2e2' },
  MED: { ar: 'متوسط', en: 'Medium', color: '#b45309', bg: '#fef3c7' },
  LOW: { ar: 'منخفض', en: 'Low', color: '#047857', bg: '#d1fae5' },
  NA: { ar: 'غير محدد', en: 'N/A', color: '#64748b', bg: '#f1f5f9' },
};
export const CATEGORY_LABEL: Record<Category, { ar: string; en: string }> = {
  trainer: { ar: 'المدرب', en: 'Trainer' }, education: { ar: 'التعليم والمحتوى', en: 'Teaching & content' },
  facility: { ar: 'القاعات والتجهيزات', en: 'Facilities' }, arrival: { ar: 'الوصول والاستقبال', en: 'Arrival' },
  hospitality: { ar: 'الضيافة والخدمات', en: 'Hospitality' }, transport: { ar: 'النقل', en: 'Transport' },
  housing: { ar: 'السكن', en: 'Housing' }, tours: { ar: 'الجولات والزيارات', en: 'Tours' }, umrah: { ar: 'العمرة', en: 'Umrah' },
  administration: { ar: 'الإدارة والتنظيم', en: 'Administration' }, satisfaction: { ar: 'الرضا العام', en: 'Satisfaction' },
  general: { ar: 'عام', en: 'General' },
};
/** Recommendation library per category (decision support). */
export const RECOMMENDATIONS: Record<Category, { ar: string; en: string; owner_ar: string; owner_en: string; days: number }> = {
  trainer: { ar: 'زيارة صفية داعمة خلال أسبوع، تغذية راجعة فردية، وورشة قصيرة في استراتيجيات التفاعل وإدارة الصف.', en: 'Supportive class observation within a week, individual feedback, and a short workshop on engagement strategies.', owner_ar: 'المشرف الأكاديمي', owner_en: 'Academic supervisor', days: 14 },
  education: { ar: 'مراجعة ملاءمة المحتوى للمستوى، تقليل الكثافة، وزيادة الأنشطة التطبيقية والتدرّج في الصعوبة.', en: 'Review content-level fit, reduce density, add applied activities and smoother difficulty progression.', owner_ar: 'لجنة المناهج', owner_en: 'Curriculum committee', days: 21 },
  facility: { ar: 'فحص فوري للتجهيزات (صوت/عرض/تكييف/إنترنت) وجدولة صيانة وقائية أسبوعية.', en: 'Immediate equipment check (audio/projection/AC/internet) and weekly preventive maintenance.', owner_ar: 'الخدمات المساندة', owner_en: 'Support services', days: 7 },
  arrival: { ar: 'تحديث دليل الوصول، تأكيد مواعيد الاستقبال مسبقًا، وتعيين منسق استقبال لكل دفعة.', en: 'Update arrival guide, confirm pickup times in advance, assign a reception coordinator per cohort.', owner_ar: 'إدارة البرنامج', owner_en: 'Program office', days: 10 },
  hospitality: { ar: 'مراجعة مزوّد الخدمة، تنويع الوجبات، وقناة شكاوى سريعة بردّ خلال 24 ساعة.', en: 'Review the service provider, diversify meals, and open a fast complaints channel with 24h response.', owner_ar: 'الخدمات المساندة', owner_en: 'Support services', days: 10 },
  transport: { ar: 'مراجعة جدول الحافلات ومواعيدها، وإبلاغ المشاركين بالتغييرات عبر قناة موحدة.', en: 'Review bus schedule and punctuality; announce changes via one channel.', owner_ar: 'النقل والخدمات', owner_en: 'Transport', days: 7 },
  housing: { ar: 'جولة تفقدية للسكن، معالجة الشكاوى المتكررة (نظافة/إنترنت/ضوضاء) خلال أسبوع.', en: 'Housing inspection; fix recurring complaints (cleanliness/internet/noise) within a week.', owner_ar: 'إدارة السكن', owner_en: 'Housing office', days: 7 },
  tours: { ar: 'إعادة تصميم البرنامج الثقافي وفق اهتمامات المشاركين وتقليل أوقات الانتظار.', en: 'Redesign the cultural program around participant interests; cut waiting times.', owner_ar: 'الأنشطة الطلابية', owner_en: 'Student activities', days: 21 },
  umrah: { ar: 'تحسين التنسيق اللوجستي للرحلة، مرشد لكل مجموعة، وجدول واضح.', en: 'Improve trip logistics, a guide per group, and a clear schedule.', owner_ar: 'الأنشطة الطلابية', owner_en: 'Student activities', days: 14 },
  administration: { ar: 'نقطة اتصال واحدة للمشاركين، زمن استجابة محدد (24 ساعة)، وتوضيح الإجراءات كتابيًا.', en: 'Single point of contact, defined response time (24h), and written procedures.', owner_ar: 'إدارة البرنامج', owner_en: 'Program office', days: 10 },
  satisfaction: { ar: 'تحليل الأسباب الجذرية عبر مقابلات قصيرة مع عينة من المشاركين، ومعالجة المحاور الأدنى أولًا.', en: 'Root-cause analysis via short interviews; address lowest axes first.', owner_ar: 'إدارة الجودة', owner_en: 'Quality office', days: 14 },
  general: { ar: 'مراجعة المحور مع الفريق المعني ووضع خطة تحسين قصيرة بمؤشر قياس واضح.', en: 'Review with the responsible team and set a short improvement plan with a clear KPI.', owner_ar: 'إدارة البرنامج', owner_en: 'Program office', days: 14 },
};

/* ============================================================ basic helpers */
export const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
export function safeRating(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null; }
export function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
export function median(xs: number[]): number { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
export function sd(xs: number[]): number { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); }
const normTxt = (v: unknown) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** YYYY-MM-DD in Asia/Riyadh for an ISO timestamp. */
export function riyadhDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}
/** ISO week key, e.g. 2026-W43 (weeks start Sunday to match Saudi work week). */
export function weekKey(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const start = new Date(d); start.setUTCDate(d.getUTCDate() - d.getUTCDay()); // back to Sunday
  return start.toISOString().slice(0, 10);
}

export function axisCategory(ar = '', en = ''): Category {
  const s = `${ar} ${en}`.toLowerCase();
  const has = (...k: string[]) => k.some(x => s.includes(x));
  if (has('مدرب', 'معلم', 'teacher', 'trainer', 'instructor')) return 'trainer';
  if (has('تعليم', 'تعلم', 'مادة', 'محتوى', 'درس', 'حصة', 'learning', 'content', 'lesson', 'session')) return 'education';
  if (has('قاعة', 'تجهيز', 'facilit', 'room', 'equipment')) return 'facility';
  if (has('وصول', 'استقبال', 'airport', 'arrival', 'reception')) return 'arrival';
  if (has('ضيافة', 'خدمات', 'hospitality', 'service', 'meal', 'وجب')) return 'hospitality';
  if (has('نقل', 'انتقال', 'مواصلات', 'transport', 'bus')) return 'transport';
  if (has('سكن', 'housing', 'accommodation')) return 'housing';
  if (has('جولات', 'زيارة', 'tour', 'visit')) return 'tours';
  if (has('عمرة', 'umrah')) return 'umrah';
  if (has('إدارة', 'برنامج', 'استجابة', 'admin', 'management', 'organization')) return 'administration';
  if (has('رضا', 'satisfaction', 'overall')) return 'satisfaction';
  return 'general';
}
export function perfKey(m: number, n: number): PerfKey {
  if (n < 1) return 'NA';
  if (m >= THRESHOLDS.excellent) return 'EXCELLENT';
  if (m >= THRESHOLDS.good) return 'GOOD';
  if (m >= THRESHOLDS.watch) return 'WATCH';
  return 'RISK';
}
export function riskKey(s: { n: number; mean: number; sd: number; lowPct: number }, responses = s.n): RiskKey {
  if (responses < THRESHOLDS.minSample) return 'NA';
  if (s.mean < 3 || s.lowPct >= 20 || s.sd >= 1.2) return 'HIGH';
  if (s.mean < 3.7 || s.lowPct >= 10 || s.sd >= 1) return 'MED';
  return 'LOW';
}
export function stats(values: number[]): Stats {
  const xs = values.filter(v => Number.isFinite(v));
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  xs.forEach(v => { const r = Math.round(v); if (r >= 1 && r <= 5) dist[r - 1]++; });
  const low = xs.filter(v => v <= 2).length, high = xs.filter(v => v >= 4).length, mid = xs.length - low - high;
  const pct = (c: number) => xs.length ? round((c / xs.length) * 100, 1) : 0;
  return {
    n: xs.length, mean: round(mean(xs)), median: round(median(xs)), sd: round(sd(xs)),
    min: xs.length ? Math.min(...xs) : 0, max: xs.length ? Math.max(...xs) : 0,
    lowPct: pct(low), neutralPct: pct(mid), highPct: pct(high), dist,
  };
}

/* ============================================================ normalisation */
export function buildEvaluations(raw: RawEvaluation[], answers: RawAnswer[], lk: Lookups): Evaluation[] {
  const roomTrainer = new Map(lk.classrooms.map(c => [c.id, c.trainer_id || null]));
  const ratingsByEval = new Map<string, number[]>();
  for (const a of answers) { const v = safeRating(a.rating_value); if (v === null) continue; const arr = ratingsByEval.get(a.evaluation_id) || []; arr.push(v); ratingsByEval.set(a.evaluation_id, arr); }
  return raw.filter(Boolean).map(r => {
    const ratings = ratingsByEval.get(r.id) || [];
    return {
      ...r, kind: String(r.kind || '').toUpperCase(),
      trainer_id: r.classroom_id ? (roomTrainer.get(r.classroom_id) || null) : null,
      date: riyadhDate(r.submitted_at) || String(r.evaluation_date || '').slice(0, 10),
      ratings, mean: ratings.length ? round(mean(ratings)) : (safeRating(r.overall_rating)),
    };
  });
}

/** Rating facts with duplicate question texts (same eval + section + text) collapsed to one value. */
export function buildFacts(answers: RawAnswer[], questions: RawQuestion[]): Fact[] {
  const qMap = new Map(questions.map(q => [q.id, q]));
  const buckets = new Map<string, { a: RawAnswer; q: RawQuestion | undefined; values: number[] }>();
  for (const a of answers) {
    const v = safeRating(a.rating_value); if (v === null) continue;
    const q = qMap.get(a.question_id);
    if (q?.question_key === 'daily_difficulty') continue; // difficulty ≠ satisfaction (same rule as the form)
    const key = `${a.evaluation_id}__${normTxt(q?.section_ar)}__${normTxt(q?.text_ar || q?.text_en || a.question_id)}`;
    const b = buckets.get(key) || { a, q, values: [] }; b.values.push(v); buckets.set(key, b);
  }
  return Array.from(buckets.values()).map(({ a, q, values }) => ({
    evaluation_id: a.evaluation_id, question_id: q?.id || a.question_id, question_key: q?.question_key || '',
    section_ar: q?.section_ar || 'عام', section_en: q?.section_en || q?.section_ar || 'General',
    text_ar: q?.text_ar || q?.text_en || '', text_en: q?.text_en || q?.text_ar || '',
    category: axisCategory(q?.section_ar || '', q?.section_en || ''), value: round(mean(values)),
  }));
}

/* ============================================================ qualitative */
const POS_AR = ['ممتاز', 'رائع', 'جميل', 'شكرا', 'شكرًا', 'أشكر', 'جيد', 'مفيد', 'استفدت', 'أحببت', 'احببت', 'متميز', 'مبدع', 'سعيد', 'أفضل', 'افضل', 'واضح', 'منظم'];
const NEG_AR = ['سيء', 'سيئ', 'ضعيف', 'مشكلة', 'مشاكل', 'تأخير', 'تأخر', 'لا يوجد', 'غير', 'صعب', 'صعوبة', 'ممل', 'بطيء', 'بطئ', 'ازعاج', 'إزعاج', 'شكوى', 'للأسف', 'سوء', 'نقص', 'كثير', 'ضيق', 'حار', 'بارد', 'انقطاع'];
const POS_EN = ['excellent', 'great', 'good', 'thank', 'helpful', 'useful', 'amazing', 'love', 'clear', 'organized', 'best', 'enjoy'];
const NEG_EN = ['bad', 'poor', 'problem', 'issue', 'late', 'delay', 'difficult', 'hard', 'boring', 'slow', 'noise', 'complain', 'unfortunately', 'lack', 'not ', 'no '];
const STOP = new Set(['في', 'من', 'على', 'إلى', 'الى', 'عن', 'أن', 'ان', 'كان', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'و', 'أو', 'او', 'ثم', 'لم', 'لا', 'ما', 'هو', 'هي', 'كل', 'بعض', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'is', 'are', 'was', 'were', 'it', 'for', 'with', 'that', 'this', 'i', 'we', 'you', 'they', 'be', 'very', 'so', 'as', 'at', 'by']);

export function sentimentOf(text: string): Comment['sentiment'] {
  const s = ` ${text.toLowerCase()} `;
  const score = [...POS_AR, ...POS_EN].filter(k => s.includes(k)).length - [...NEG_AR, ...NEG_EN].filter(k => s.includes(k)).length;
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}
export function buildComments(evals: Evaluation[], answers: RawAnswer[], questions: RawQuestion[]): Comment[] {
  const qMap = new Map(questions.map(q => [q.id, q]));
  const eMap = new Map(evals.map(e => [e.id, e]));
  const out: Comment[] = [];
  for (const a of answers) {
    const text = String(a.text_value || '').trim();
    if (text.length < 2) continue;
    const e = eMap.get(a.evaluation_id); if (!e) continue;
    const q = qMap.get(a.question_id);
    out.push({
      evaluation_id: e.id, date: e.date, kind: e.kind, program_id: e.program_id, classroom_id: e.classroom_id, trainer_id: e.trainer_id,
      question_id: a.question_id, question_ar: q?.text_ar || '', question_en: q?.text_en || q?.text_ar || '', text, sentiment: sentimentOf(text),
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
export function keywordFrequency(comments: Comment[], top = 25): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const c of comments) {
    const words = c.text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
    for (const w of new Set(words)) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return Array.from(freq.entries()).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, top);
}

/* ============================================================ filtering */
export function applyFilters(evals: Evaluation[], f: Filters, lk: Lookups): Evaluation[] {
  const roomMode = new Map(lk.classrooms.map(c => [c.id, c.delivery_mode || 'onsite']));
  const progMode = new Map(lk.programs.map(p => [p.id, p.delivery_mode || 'onsite']));
  return evals.filter(e => {
    if (f.programId && e.program_id !== f.programId) return false;
    if (f.classroomId && e.classroom_id !== f.classroomId) return false;
    if (f.trainerId && e.trainer_id !== f.trainerId) return false;
    if (f.kind && f.kind !== 'ALL' && e.kind !== f.kind) return false;
    if (f.gender && String(e.guest_gender || '').toLowerCase() !== f.gender.toLowerCase()) return false;
    if (f.deliveryMode) {
      const mode = (e.classroom_id && roomMode.get(e.classroom_id)) || (e.program_id && progMode.get(e.program_id)) || 'onsite';
      if (mode !== f.deliveryMode) return false;
    }
    if (f.from && e.date && e.date < f.from) return false;
    if (f.to && e.date && e.date > f.to) return false;
    return true;
  });
}
export function factsOf(evals: Evaluation[], facts: Fact[]): Fact[] {
  const ids = new Set(evals.map(e => e.id)); return facts.filter(x => ids.has(x.evaluation_id));
}
export function participantsOf(evals: Evaluation[]): number {
  return new Set(evals.map(e => (e.guest_email || e.trainee_id || e.guest_phone || e.id).toString().toLowerCase())).size;
}

/* ============================================================ KPIs */
export function kpis(evals: Evaluation[], facts: Fact[]): Kpis {
  const fx = factsOf(evals, facts);
  const s = stats(fx.map(x => x.value));
  const dates = evals.map(e => e.date).filter(Boolean).sort();
  const first = dates[0] || '', last = dates[dates.length - 1] || '';
  const days = first && last ? daysBetween(first, last) + 1 : 0;
  return {
    responses: evals.length, participants: participantsOf(evals),
    daily: evals.filter(e => e.kind === 'DAILY').length, final: evals.filter(e => e.kind === 'FINAL').length,
    measurements: s.n, mean: s.mean, median: s.median, sd: s.sd, highPct: s.highPct, lowPct: s.lowPct,
    gap: round(TARGET - s.mean), perf: perfKey(s.mean, s.n), risk: riskKey(s, evals.length),
    rooms: new Set(evals.map(e => e.classroom_id).filter(Boolean)).size,
    trainers: new Set(evals.map(e => e.trainer_id).filter(Boolean)).size,
    programs: new Set(evals.map(e => e.program_id).filter(Boolean)).size,
    firstDate: first, lastDate: last, days, perDay: days ? round(evals.length / days, 1) : 0, dist: s.dist,
  };
}

/* ============================================================ breakdowns */
export type Dimension = 'trainer' | 'classroom' | 'program' | 'axis' | 'category' | 'question' | 'kind' | 'gender' | 'accommodation' | 'day' | 'week';

export function labelFor(dim: Dimension, key: string, lk: Lookups, lang: Lang): string {
  const ar = lang === 'ar';
  switch (dim) {
    case 'trainer': return lk.trainers.find(t => t.id === key)?.name || (ar ? 'بدون مدرب' : 'No trainer');
    case 'classroom': return lk.classrooms.find(c => c.id === key)?.code || (ar ? 'بدون قاعة' : 'No room');
    case 'program': { const p = lk.programs.find(p => p.id === key); return p ? (ar ? p.name_ar : (p.name_en || p.name_ar)) : (ar ? 'غير محدد' : 'Unspecified'); }
    case 'kind': return KIND_LABEL[key]?.[lang] || key;
    case 'category': return CATEGORY_LABEL[key as Category]?.[lang] || key;
    case 'gender': return key === 'male' || key === 'ذكر' ? (ar ? 'ذكور' : 'Male') : key === 'female' || key === 'أنثى' ? (ar ? 'إناث' : 'Female') : (key || (ar ? 'غير محدد' : 'Unspecified'));
    default: return key || (ar ? 'غير محدد' : 'Unspecified');
  }
}

function halfDelta(items: { date: string; value: number }[]): number | null {
  if (items.length < 6) return null;
  const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : 1));
  const mid = Math.floor(sorted.length / 2);
  return round(mean(sorted.slice(mid).map(x => x.value)) - mean(sorted.slice(0, mid).map(x => x.value)));
}

export function groupBy(dim: Dimension, evals: Evaluation[], facts: Fact[], lk: Lookups, lang: Lang): GroupRow[] {
  const fx = factsOf(evals, facts);
  const eMap = new Map(evals.map(e => [e.id, e]));
  const groups = new Map<string, { label: string; values: number[]; dated: { date: string; value: number }[]; evalIds: Set<string>; meta?: Record<string, unknown> }>();
  const push = (key: string, label: string, f: Fact, e: Evaluation, meta?: Record<string, unknown>) => {
    const g = groups.get(key) || { label, values: [], dated: [], evalIds: new Set<string>(), meta };
    g.values.push(f.value); g.dated.push({ date: e.date, value: f.value }); g.evalIds.add(e.id); groups.set(key, g);
  };
  for (const f of fx) {
    const e = eMap.get(f.evaluation_id); if (!e) continue;
    switch (dim) {
      case 'trainer': push(e.trainer_id || '', labelFor(dim, e.trainer_id || '', lk, lang), f, e); break;
      case 'classroom': push(e.classroom_id || '', labelFor(dim, e.classroom_id || '', lk, lang), f, e, { trainer_id: e.trainer_id }); break;
      case 'program': push(e.program_id || '', labelFor(dim, e.program_id || '', lk, lang), f, e); break;
      case 'kind': push(e.kind, labelFor(dim, e.kind, lk, lang), f, e); break;
      case 'gender': push(String(e.guest_gender || ''), labelFor(dim, String(e.guest_gender || ''), lk, lang), f, e); break;
      case 'accommodation': push(String(e.accommodation_type || ''), String(e.accommodation_type || (lang === 'ar' ? 'غير محدد' : 'Unspecified')), f, e); break;
      case 'axis': push(normTxt(f.section_ar), lang === 'ar' ? f.section_ar : f.section_en, f, e, { category: f.category }); break;
      case 'category': push(f.category, CATEGORY_LABEL[f.category][lang], f, e); break;
      case 'question': push(f.question_id, lang === 'ar' ? f.text_ar : f.text_en, f, e, { section: lang === 'ar' ? f.section_ar : f.section_en, category: f.category }); break;
      case 'day': push(e.date, e.date, f, e); break;
      case 'week': { const w = weekKey(e.date); push(w, `${w} → ${addDays(w, 6)}`, f, e); break; }
    }
  }
  const rows: GroupRow[] = Array.from(groups.entries()).map(([key, g]) => {
    const s = stats(g.values);
    const evs = Array.from(g.evalIds).map(id => eMap.get(id)!).filter(Boolean);
    return {
      key, label: g.label, ...s, responses: g.evalIds.size, participants: participantsOf(evs),
      gap: round(TARGET - s.mean), perf: perfKey(s.mean, s.n), risk: riskKey(s, g.evalIds.size), delta: halfDelta(g.dated), meta: g.meta,
    };
  });
  if (dim === 'day' || dim === 'week') return rows.sort((a, b) => (a.key < b.key ? -1 : 1));
  return rows.sort((a, b) => b.mean - a.mean || b.responses - a.responses);
}

/* ============================================================ time series */
export function timeSeries(evals: Evaluation[], facts: Fact[], granularity: 'day' | 'week', lk: Lookups, lang: Lang, window = 3): SeriesPoint[] {
  const rows = groupBy(granularity, evals, facts, lk, lang);
  return rows.map((r, i) => {
    const slice = rows.slice(Math.max(0, i - window + 1), i + 1);
    return { key: r.key, label: r.label, n: r.n, responses: r.responses, mean: r.n ? r.mean : null, ma: slice.length ? round(mean(slice.map(x => x.mean))) : null };
  });
}

/* ============================================================ period comparison */
export function periodComparison(all: Evaluation[], facts: Fact[], f: Filters, lk: Lookups): Comparison | null {
  const cur = applyFilters(all, f, lk);
  const curK = kpis(cur, facts);
  const from = f.from || curK.firstDate, to = f.to || curK.lastDate;
  if (!from || !to) return null;
  const len = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1), prevFrom = addDays(from, -len);
  const prev = applyFilters(all, { ...f, from: prevFrom, to: prevTo }, lk);
  const prevK = kpis(prev, facts);
  const d = (a: number, b: number, ok: boolean) => (ok ? round(a - b) : null);
  return {
    current: curK, previous: prevK, from, to, prevFrom, prevTo,
    deltaMean: d(curK.mean, prevK.mean, curK.measurements > 0 && prevK.measurements > 0),
    deltaResponses: curK.responses - prevK.responses,
    deltaHighPct: d(curK.highPct, prevK.highPct, curK.measurements > 0 && prevK.measurements > 0),
    deltaLowPct: d(curK.lowPct, prevK.lowPct, curK.measurements > 0 && prevK.measurements > 0),
  };
}

/* ============================================================ risk register / actions */
export function riskRegister(evals: Evaluation[], facts: Fact[], lk: Lookups, lang: Lang): Action[] {
  const ar = lang === 'ar';
  const out: Action[] = [];
  const add = (area: Action['area'], r: GroupRow, category: Category, labelPrefix = '') => {
    if (r.responses < THRESHOLDS.minSample || r.mean >= THRESHOLDS.good) return;
    const rec = RECOMMENDATIONS[category];
    const priority: Action['priority'] = r.risk === 'HIGH' ? 'HIGH' : r.risk === 'MED' ? 'MED' : 'LOW';
    const impact = round(Math.max(0, r.gap) * Math.log10(r.responses + 1) * (1 + r.lowPct / 100), 2);
    out.push({
      id: `${area}:${r.key}`, area, label: labelPrefix ? `${labelPrefix}: ${r.label}` : r.label, category,
      mean: r.mean, gap: round(Math.max(0, r.gap)), n: r.n, responses: r.responses, lowPct: r.lowPct, sd: r.sd,
      priority, impact, recommendation: ar ? rec.ar : rec.en, owner: ar ? rec.owner_ar : rec.owner_en, dueDays: rec.days,
      kpi: ar ? `رفع المتوسط من ${r.mean.toFixed(2)} إلى ≥ ${TARGET} وخفض التقييمات المنخفضة دون 10%` : `Raise mean from ${r.mean.toFixed(2)} to ≥ ${TARGET}; low ratings below 10%`,
    });
  };
  for (const r of groupBy('axis', evals, facts, lk, lang)) add('axis', r, (r.meta?.category as Category) || 'general');
  for (const r of groupBy('trainer', evals, facts, lk, lang)) if (r.key) add('trainer', r, 'trainer', ar ? 'المدرب' : 'Trainer');
  for (const r of groupBy('classroom', evals, facts, lk, lang)) if (r.key) add('classroom', r, 'facility', ar ? 'القاعة' : 'Room');
  for (const r of groupBy('program', evals, facts, lk, lang)) if (r.key) add('program', r, 'administration', ar ? 'البرنامج' : 'Program');
  const order = { HIGH: 0, MED: 1, LOW: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority] || b.impact - a.impact);
}

/* ============================================================ narrative */
export function narrative(k: Kpis, axes: GroupRow[], series: SeriesPoint[], cmp: Comparison | null, lang: Lang, context: string): string[] {
  const ar = lang === 'ar';
  const p: string[] = [];
  if (k.responses < 1) return [ar ? 'لا توجد بيانات ضمن نطاق التصفية الحالي.' : 'No data in the current filter scope.'];
  const perf = PERF_LABEL[k.perf][lang];
  p.push(ar
    ? `شمل ${context} ${k.responses} استجابة من ${k.participants} مشاركًا (${k.daily} يومي، ${k.final} ختامي) خلال ${k.days} يومًا، بمتوسط رضا عام ${k.mean.toFixed(2)}/5 (${perf}) ووسيط ${k.median.toFixed(1)}. بلغت نسبة التقييمات المرتفعة ${k.highPct.toFixed(0)}% والمنخفضة ${k.lowPct.toFixed(0)}%، و${k.gap > 0 ? `الفجوة إلى الهدف (${TARGET}) ${k.gap.toFixed(2)} درجة` : `الأداء يتجاوز الهدف (${TARGET}) بمقدار ${Math.abs(k.gap).toFixed(2)} درجة`}.`
    : `${context} covered ${k.responses} responses from ${k.participants} participants (${k.daily} daily, ${k.final} final) over ${k.days} days, with an overall mean of ${k.mean.toFixed(2)}/5 (${perf}) and median ${k.median.toFixed(1)}. High ratings were ${k.highPct.toFixed(0)}% and low ratings ${k.lowPct.toFixed(0)}%; ${k.gap > 0 ? `the gap to the ${TARGET} target is ${k.gap.toFixed(2)}` : `performance exceeds the ${TARGET} target by ${Math.abs(k.gap).toFixed(2)}`}.`);
  if (k.responses < THRESHOLDS.minSample) p.push(ar ? 'تنبيه: حجم العينة صغير، وتُقرأ النتائج كمؤشرات أولية لا كأحكام نهائية.' : 'Caution: small sample — treat results as indicative only.');
  const strengths = axes.filter(a => a.mean >= THRESHOLDS.good).slice(0, 2);
  const gaps = [...axes].sort((a, b) => a.mean - b.mean).filter(a => a.mean < THRESHOLDS.good).slice(0, 2);
  if (strengths.length) p.push(ar
    ? `تصدّر نقاط القوة: ${strengths.map(s => `«${s.label}» (${s.mean.toFixed(2)})`).join(' و')}.`
    : `Leading strengths: ${strengths.map(s => `“${s.label}” (${s.mean.toFixed(2)})`).join(' and ')}.`);
  if (gaps.length) p.push(ar
    ? `في المقابل، سجّل ${gaps.map(g => `«${g.label}» ${g.mean.toFixed(2)}/5 (منخفض ${g.lowPct.toFixed(0)}%${g.sd >= 1 ? `، تفاوت مرتفع SD ${g.sd.toFixed(2)}` : ''})`).join(' و')} أدنى المستويات، ويستدعي تدخلًا منظمًا وفق خطة الإجراءات.`
    : `Conversely, ${gaps.map(g => `“${g.label}” ${g.mean.toFixed(2)}/5 (${g.lowPct.toFixed(0)}% low${g.sd >= 1 ? `, high variance SD ${g.sd.toFixed(2)}` : ''})`).join(' and ')} scored lowest and need structured intervention per the action plan.`);
  else if (axes.length) p.push(ar ? 'لم يسجّل أي محور مستوى مقلقًا يستدعي تدخلًا عاجلًا.' : 'No axis reached a concerning level requiring urgent action.');
  const pts = series.filter(s => s.mean !== null);
  if (pts.length >= 3) {
    const d = (pts[pts.length - 1].mean as number) - (pts[0].mean as number);
    p.push(Math.abs(d) < 0.15
      ? (ar ? 'الاتجاه الزمني مستقر نسبيًا خلال الفترة.' : 'The trend is relatively stable over the period.')
      : d > 0 ? (ar ? `الاتجاه الزمني تحسّن بمقدار ${d.toFixed(2)} درجة بين بداية الفترة ونهايتها.` : `The trend improved by ${d.toFixed(2)} from start to end of the period.`)
        : (ar ? `الاتجاه الزمني تراجع بمقدار ${Math.abs(d).toFixed(2)} درجة ويستدعي متابعة أسبوعية.` : `The trend declined by ${Math.abs(d).toFixed(2)} and warrants weekly follow-up.`));
  }
  if (cmp && cmp.deltaMean !== null) p.push(ar
    ? `مقارنةً بالفترة السابقة (${cmp.prevFrom} → ${cmp.prevTo}): ${cmp.deltaMean >= 0 ? 'ارتفع' : 'انخفض'} المتوسط بمقدار ${Math.abs(cmp.deltaMean).toFixed(2)}، و${cmp.deltaResponses >= 0 ? 'زادت' : 'قلّت'} الاستجابات بـ ${Math.abs(cmp.deltaResponses)}.`
    : `Versus the previous period (${cmp.prevFrom} → ${cmp.prevTo}): mean ${cmp.deltaMean >= 0 ? 'rose' : 'fell'} by ${Math.abs(cmp.deltaMean).toFixed(2)} and responses ${cmp.deltaResponses >= 0 ? 'increased' : 'decreased'} by ${Math.abs(cmp.deltaResponses)}.`);
  return p;
}

/** Short plain-text brief (for WhatsApp / email). */
export function briefText(title: string, k: Kpis, axes: GroupRow[], actions: Action[], lang: Lang, scope: string): string {
  const ar = lang === 'ar';
  const top = [...axes].sort((a, b) => b.mean - a.mean).slice(0, 3);
  const low = [...axes].sort((a, b) => a.mean - b.mean).slice(0, 3);
  const lines = [
    `📊 ${title}`, scope,
    ar ? `• الاستجابات: ${k.responses} | المشاركون: ${k.participants}` : `• Responses: ${k.responses} | Participants: ${k.participants}`,
    ar ? `• المتوسط العام: ${k.mean.toFixed(2)}/5 (${PERF_LABEL[k.perf].ar}) | الهدف ${TARGET}` : `• Overall mean: ${k.mean.toFixed(2)}/5 (${PERF_LABEL[k.perf].en}) | Target ${TARGET}`,
    ar ? `• مرتفع ${k.highPct.toFixed(0)}% | منخفض ${k.lowPct.toFixed(0)}%` : `• High ${k.highPct.toFixed(0)}% | Low ${k.lowPct.toFixed(0)}%`,
  ];
  if (top.length) lines.push(ar ? `💪 الأقوى: ${top.map(x => `${x.label} ${x.mean.toFixed(2)}`).join(' | ')}` : `💪 Top: ${top.map(x => `${x.label} ${x.mean.toFixed(2)}`).join(' | ')}`);
  if (low.length) lines.push(ar ? `⚠️ الأدنى: ${low.map(x => `${x.label} ${x.mean.toFixed(2)}`).join(' | ')}` : `⚠️ Lowest: ${low.map(x => `${x.label} ${x.mean.toFixed(2)}`).join(' | ')}`);
  const acts = actions.slice(0, 3);
  if (acts.length) { lines.push(ar ? '🎯 الإجراءات ذات الأولوية:' : '🎯 Priority actions:'); acts.forEach((a, i) => lines.push(`${i + 1}. ${a.label} — ${a.recommendation} (${a.owner}, ${a.dueDays} ${ar ? 'يوم' : 'days'})`)); }
  return lines.join('\n');
}

/* ============================================================ export helpers */
export function groupRowsToTable(rows: GroupRow[], lang: Lang, dimLabel: string): (string | number)[][] {
  const ar = lang === 'ar';
  const head = ar
    ? [dimLabel, 'الاستجابات', 'المشاركون', 'القياسات', 'المتوسط', 'الوسيط', 'الانحراف', 'مرتفع %', 'محايد %', 'منخفض %', 'الفجوة للهدف', 'التصنيف', 'المخاطر', 'التغير (نصف الفترة)']
    : [dimLabel, 'Responses', 'Participants', 'Measurements', 'Mean', 'Median', 'SD', 'High %', 'Neutral %', 'Low %', 'Gap to target', 'Performance', 'Risk', 'Δ (half-period)'];
  return [head, ...rows.map(r => [r.label, r.responses, r.participants, r.n, r.mean, r.median, r.sd, r.highPct, r.neutralPct, r.lowPct, r.gap, PERF_LABEL[r.perf][lang], RISK_LABEL[r.risk][lang], r.delta ?? ''])];
}
export function kpisToTable(k: Kpis, lang: Lang): (string | number)[][] {
  const ar = lang === 'ar';
  const rows: [string, string | number][] = [
    [ar ? 'الاستجابات' : 'Responses', k.responses], [ar ? 'المشاركون (فريد)' : 'Unique participants', k.participants],
    [ar ? 'تقييم يومي' : 'Daily', k.daily], [ar ? 'تقييم ختامي' : 'Final', k.final], [ar ? 'القياسات' : 'Measurements', k.measurements],
    [ar ? 'المتوسط العام' : 'Overall mean', k.mean], [ar ? 'الوسيط' : 'Median', k.median], [ar ? 'الانحراف المعياري' : 'SD', k.sd],
    [ar ? 'مرتفع %' : 'High %', k.highPct], [ar ? 'منخفض %' : 'Low %', k.lowPct], [ar ? 'الهدف' : 'Target', TARGET], [ar ? 'الفجوة' : 'Gap', k.gap],
    [ar ? 'التصنيف' : 'Performance', PERF_LABEL[k.perf][lang]], [ar ? 'المخاطر' : 'Risk', RISK_LABEL[k.risk][lang]],
    [ar ? 'القاعات' : 'Rooms', k.rooms], [ar ? 'المدربون' : 'Trainers', k.trainers], [ar ? 'البرامج' : 'Programs', k.programs],
    [ar ? 'من' : 'From', k.firstDate], [ar ? 'إلى' : 'To', k.lastDate], [ar ? 'استجابة/يوم' : 'Responses/day', k.perDay],
  ];
  return [[ar ? 'المؤشر' : 'Indicator', ar ? 'القيمة' : 'Value'], ...rows];
}
export function actionsToTable(actions: Action[], lang: Lang): (string | number)[][] {
  const ar = lang === 'ar';
  const head = ar ? ['#', 'المجال', 'العنصر', 'المتوسط', 'الفجوة', 'منخفض %', 'الاستجابات', 'الأولوية', 'درجة الأثر', 'الإجراء الموصى به', 'المسؤول', 'المدة (يوم)', 'مؤشر النجاح']
    : ['#', 'Area', 'Item', 'Mean', 'Gap', 'Low %', 'Responses', 'Priority', 'Impact', 'Recommended action', 'Owner', 'Due (days)', 'Success KPI'];
  return [head, ...actions.map((a, i) => [i + 1, a.area, a.label, a.mean, a.gap, a.lowPct, a.responses, a.priority, a.impact, a.recommendation, a.owner, a.dueDays, a.kpi])];
}
export function rawToTable(evals: Evaluation[], lk: Lookups, lang: Lang): (string | number)[][] {
  const ar = lang === 'ar';
  const head = ar ? ['التاريخ', 'النوع', 'البرنامج', 'القاعة', 'المدرب', 'الجنس', 'الإقامة', 'عدد الإجابات', 'متوسط الاستجابة', 'المعرف']
    : ['Date', 'Kind', 'Program', 'Room', 'Trainer', 'Gender', 'Accommodation', 'Answers', 'Response mean', 'ID'];
  return [head, ...evals.map(e => [
    e.date, KIND_LABEL[e.kind]?.[lang] || e.kind, labelFor('program', e.program_id || '', lk, lang), e.classroom_id ? labelFor('classroom', e.classroom_id, lk, lang) : '',
    e.trainer_id ? labelFor('trainer', e.trainer_id, lk, lang) : '', String(e.guest_gender || ''), String(e.accommodation_type || ''), e.ratings.length, e.mean ?? '', e.id,
  ])];
}
export function commentsToTable(comments: Comment[], lk: Lookups, lang: Lang): (string | number)[][] {
  const ar = lang === 'ar';
  const head = ar ? ['التاريخ', 'النوع', 'البرنامج', 'القاعة', 'المدرب', 'السؤال', 'التعليق', 'الانطباع'] : ['Date', 'Kind', 'Program', 'Room', 'Trainer', 'Question', 'Comment', 'Sentiment'];
  const sent = { positive: ar ? 'إيجابي' : 'Positive', negative: ar ? 'سلبي' : 'Negative', neutral: ar ? 'محايد' : 'Neutral' };
  return [head, ...comments.map(c => [c.date, KIND_LABEL[c.kind]?.[lang] || c.kind, labelFor('program', c.program_id || '', lk, lang), c.classroom_id ? labelFor('classroom', c.classroom_id, lk, lang) : '', c.trainer_id ? labelFor('trainer', c.trainer_id, lk, lang) : '', ar ? c.question_ar : c.question_en, c.text, sent[c.sentiment]])];
}
