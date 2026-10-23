/**
 * مؤشرات النتائج المؤسسية (المستوى 4) وسلسلة الأثر 1→4 — بدون تبعيات
 */
export type Direction = 'up' | 'down';
export type OutcomeKpi = {
  id: string; organization_id?: string | null; program_id: string; name_ar: string; name_en?: string | null;
  unit: string; direction: Direction; baseline: number | null; baseline_date: string | null; target: number | null; target_date: string | null;
  source: string | null; owner_name: string | null; weight: number; notes: string | null; created_at?: string; updated_at?: string;
};
export type OutcomeMeasurement = { id: string; kpi_id: string; value: number; measured_on: string; note: string | null; created_at?: string };

export const UNITS = ['%', 'عدد', 'درجة', 'دقيقة', 'ساعة', 'يوم', 'ريال', 'نقطة'];

/** قوالب مؤشرات جاهزة حسب طبيعة البرنامج */
export const KPI_TEMPLATES: { group: string; items: Omit<OutcomeKpi, 'id' | 'program_id' | 'baseline' | 'baseline_date' | 'target' | 'target_date' | 'source' | 'owner_name' | 'notes'>[] }[] = [
  { group: 'برامج اللغة والتعليم', items: [
    { name_ar: 'نسبة اجتياز اختبار المستوى', name_en: 'Placement/level test pass rate', unit: '%', direction: 'up', weight: 3 },
    { name_ar: 'متوسط درجة الاختبار المعياري', name_en: 'Average standardized test score', unit: 'درجة', direction: 'up', weight: 3 },
    { name_ar: 'نسبة الاستمرار حتى نهاية المستوى', name_en: 'Retention to end of level', unit: '%', direction: 'up', weight: 2 },
    { name_ar: 'نسبة المتدربين المنتقلين للمستوى التالي', name_en: 'Progression to next level', unit: '%', direction: 'up', weight: 2 },
  ] },
  { group: 'الأداء الوظيفي والتشغيل', items: [
    { name_ar: 'رضا المستفيدين من خدمة المتدرب', name_en: 'Beneficiary satisfaction', unit: '%', direction: 'up', weight: 3 },
    { name_ar: 'نسبة الأخطاء / إعادة العمل', name_en: 'Error / rework rate', unit: '%', direction: 'down', weight: 2 },
    { name_ar: 'زمن إنجاز المهمة', name_en: 'Task completion time', unit: 'دقيقة', direction: 'down', weight: 2 },
    { name_ar: 'نسبة الالتزام بالإجراءات', name_en: 'Procedure compliance', unit: '%', direction: 'up', weight: 2 },
  ] },
  { group: 'القيادة والتطوير المهني', items: [
    { name_ar: 'نسبة المشاريع التحسينية المنفّذة', name_en: 'Improvement projects implemented', unit: '%', direction: 'up', weight: 3 },
    { name_ar: 'رضا الفريق عن القائد', name_en: 'Team satisfaction with leader', unit: '%', direction: 'up', weight: 2 },
    { name_ar: 'معدل دوران الموظفين في الوحدة', name_en: 'Unit staff turnover', unit: '%', direction: 'down', weight: 1 },
  ] },
];

export const DEFAULT_KPI = (program_id: string): Omit<OutcomeKpi, 'id'> => ({ program_id, name_ar: '', name_en: '', unit: '%', direction: 'up', baseline: null, baseline_date: null, target: null, target_date: null, source: '', owner_name: '', weight: 2, notes: '' });

/** آخر قياس للمؤشر */
export function latest(ms: OutcomeMeasurement[]): OutcomeMeasurement | null {
  return ms.length ? [...ms].sort((a, b) => (b.measured_on > a.measured_on ? 1 : b.measured_on < a.measured_on ? -1 : (b.created_at || '') > (a.created_at || '') ? 1 : -1))[0] : null;
}

/**
 * نسبة تحقق المستهدف 0..100:
 *  up:   (current − baseline) / (target − baseline)
 *  down: (baseline − current) / (baseline − target)
 * بلا هدف: مقارنة بسيطة بالخط الأساس (تحسّن = 100، تراجع = 0، ثبات = 50) · بلا خط أساس: نسبة البلوغ إلى الهدف
 */
export function achievement(k: Pick<OutcomeKpi, 'direction' | 'baseline' | 'target'>, current: number | null): number | null {
  if (current == null || !Number.isFinite(current)) return null;
  const b = k.baseline, t = k.target, up = k.direction === 'up';
  if (b != null && t != null && t !== b) {
    const r = up ? (current - b) / (t - b) : (b - current) / (b - t);
    return clamp(Math.round(r * 100));
  }
  if (t != null && t !== 0) { const r = up ? current / t : t / Math.max(current, 1e-9); return clamp(Math.round(r * 100)); }
  if (b != null) { if (current === b) return 50; return (up ? current > b : current < b) ? 100 : 0; }
  return null;
}
const clamp = (x: number) => Math.max(0, Math.min(100, x));

/** التغير النسبي عن الخط الأساس (موجب = في الاتجاه المرغوب) */
export function changePct(k: Pick<OutcomeKpi, 'direction' | 'baseline'>, current: number | null): number | null {
  if (current == null || k.baseline == null || k.baseline === 0) return null;
  const raw = ((current - k.baseline) / Math.abs(k.baseline)) * 100;
  return Math.round((k.direction === 'up' ? raw : -raw) * 10) / 10;
}

export type KpiRow = OutcomeKpi & { current: number | null; measured_on: string | null; achievement: number | null; change_pct: number | null; measurements: OutcomeMeasurement[] };
export function kpiRows(kpis: OutcomeKpi[], measurements: OutcomeMeasurement[]): KpiRow[] {
  return kpis.map(k => {
    const ms = measurements.filter(m => m.kpi_id === k.id); const l = latest(ms);
    const cur = l ? Number(l.value) : null;
    return { ...k, current: cur, measured_on: l?.measured_on || null, achievement: achievement(k, cur), change_pct: changePct(k, cur), measurements: ms };
  });
}

/** مؤشر النتائج للبرنامج = متوسط موزون لنسب التحقق (بالأوزان) */
export function programOutcomeIndex(rows: KpiRow[]): { index: number | null; n: number; measured: number } {
  const withVal = rows.filter(r => r.achievement != null);
  const w = withVal.reduce((s, r) => s + (r.weight || 1), 0);
  const index = w ? Math.round(withVal.reduce((s, r) => s + (r.achievement as number) * (r.weight || 1), 0) / w) : null;
  return { index, n: rows.length, measured: withVal.length };
}

export function achievementLabel(a: number | null): { ar: string; tone: 'ok' | 'info' | 'warn' | 'bad' | 'none' } {
  if (a == null) return { ar: 'بلا قياس', tone: 'none' };
  if (a >= 100) return { ar: 'تحقق المستهدف', tone: 'ok' };
  if (a >= 70) return { ar: 'على المسار', tone: 'info' };
  if (a >= 40) return { ar: 'تقدم جزئي', tone: 'warn' };
  return { ar: 'دون المأمول', tone: 'bad' };
}

/* ---------------- سلسلة الأثر 1→4 ---------------- */
export type ChainLevels = {
  l1: number | null; // رد الفعل: متوسط التقييم 1–5
  l1_n: number;
  l2: number | null; // التعلم: الكسب المعياري Hake g (−1..1)
  l2_pairs: number;
  l2_gain: number | null; // فرق الدرجة الموحدة
  l3: number | null; // السلوك: مؤشر نقل الأثر 0..100
  l3_n: number;
  l4: number | null; // النتائج: مؤشر تحقق المستهدفات 0..100
  l4_n: number;
  attendance_pct: number | null; participants: number | null;
};
export type ChainScore = { s1: number | null; s2: number | null; s3: number | null; s4: number | null; index: number | null; levels: number; weakest: 1 | 2 | 3 | 4 | null };

/** تحويل كل مستوى إلى 0..100 ثم المتوسط البسيط للمستويات المتاحة */
export function chainScore(c: ChainLevels): ChainScore {
  const s1 = c.l1 == null ? null : clamp(Math.round(((c.l1 - 1) / 4) * 100));
  const s2 = c.l2 == null ? null : clamp(Math.round(c.l2 * 100));
  const s3 = c.l3 == null ? null : clamp(Math.round(c.l3));
  const s4 = c.l4 == null ? null : clamp(Math.round(c.l4));
  const parts = [s1, s2, s3, s4].filter((x): x is number => x != null);
  const index = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  let weakest: ChainScore['weakest'] = null; let min = Infinity;
  [s1, s2, s3, s4].forEach((s, i) => { if (s != null && s < min) { min = s; weakest = (i + 1) as 1 | 2 | 3 | 4; } });
  return { s1, s2, s3, s4, index, levels: parts.length, weakest };
}

export const LEVEL_META: Record<1 | 2 | 3 | 4, { ar: string; en: string; what: string; source: string; href: string }> = {
  1: { ar: 'رد الفعل', en: 'Reaction', what: 'رضا المتدربين عن البرنامج والمدرب والبيئة', source: 'التقييم اليومي/النهائي', href: '/reports/center' },
  2: { ar: 'التعلم', en: 'Learning', what: 'الكسب في المعرفة والمهارة (قبلي/بعدي)', source: 'أداة قياس الأثر', href: '/reports/impact' },
  3: { ar: 'السلوك', en: 'Behavior', what: 'تطبيق ما تم تعلّمه في بيئة العمل', source: 'متابعة المشرف والمتدرب', href: '/reports/transfer' },
  4: { ar: 'النتائج', en: 'Results', what: 'أثر البرنامج على مؤشرات المؤسسة', source: 'مؤشرات النتائج', href: '/admin/outcomes' },
};

export function chainLabel(index: number | null): { ar: string; tone: 'ok' | 'info' | 'warn' | 'bad' | 'none' } {
  if (index == null) return { ar: 'لا بيانات', tone: 'none' };
  if (index >= 75) return { ar: 'أثر قوي ومتكامل', tone: 'ok' };
  if (index >= 60) return { ar: 'أثر جيد', tone: 'info' };
  if (index >= 45) return { ar: 'أثر محدود', tone: 'warn' };
  return { ar: 'أثر ضعيف', tone: 'bad' };
}

/** توصيات سلسلة الأثر: أين تنكسر السلسلة؟ */
export function chainRecommendations(c: ChainLevels, s: ChainScore): string[] {
  const out: string[] = [];
  if (!s.levels) return ['لا توجد بيانات كافية بعد — ابدأ بالتقييم اليومي/النهائي ثم أداة القياس القبلي/البعدي.'];
  if (s.s1 != null && s.s2 != null && s.s1 >= 75 && s.s2 < 40) out.push('رضا مرتفع مع كسب تعلّم منخفض: راجع عمق المحتوى والأنشطة التطبيقية — الرضا وحده لا يعني التعلم.');
  if (s.s2 != null && s.s3 != null && s.s2 >= 60 && s.s3 < 50) out.push('تعلّم جيد لكنه لا يُنقل إلى العمل: السلسلة تنكسر عند التطبيق — فعّل خطة عمل فردية ودعم المشرف المباشر وراجع معوقات النقل.');
  if (s.s3 != null && s.s4 != null && s.s3 >= 60 && s.s4 < 50) out.push('سلوك متغيّر دون أثر على المؤشرات بعد: قد يحتاج الأثر وقتًا أطول، أو المؤشرات المختارة غير مرتبطة مباشرة بالسلوكيات المستهدفة — راجع اختيار المؤشرات.');
  if (s.weakest === 1 && s.s1 != null && s.s1 < 70) out.push('رد الفعل هو الأضعف: راجع تعليقات المتدربين في التقييم اليومي/النهائي (المدرب، المحتوى، البيئة) وعالج أقل محور.');
  if (s.weakest === 2 && s.s2 != null && s.s2 < 70) out.push('التعلم هو الأضعف (كسب معياري متوسط أو منخفض): راجع مواءمة الأسئلة مع الأهداف، وزد التدريب العملي والتغذية الراجعة أثناء البرنامج.');
  if (s.weakest === 3 && s.s3 != null && s.s3 < 70) out.push('السلوك هو الأضعف: راجع معوقات النقل المبلّغ عنها في تقرير المستوى 3، وفعّل خطة التطبيق ومتابعة المشرف.');
  if (s.weakest === 4 && s.s4 != null && s.s4 < 70) out.push('النتائج هي الأضعف: تحقق من جودة خط الأساس والمستهدفات، وسجّل قياسًا جديدًا بعد فترة كافية (3–6 أشهر).');
  if (c.l2 == null) out.push('المستوى 2 غير مقاس: أنشئ أداة قياس قبلي/بعدي للبرنامج لتوثيق الكسب المعياري.');
  if (c.l3 == null) out.push('المستوى 3 غير مقاس: أنشئ حملة متابعة أثر تُرسل تلقائيًا بعد 60–90 يومًا.');
  if (c.l4 == null) out.push('المستوى 4 غير مقاس: حدّد 2–4 مؤشرات نتائج مع خط أساس ومستهدف، وسجّل قياسًا بعد البرنامج.');
  if (c.attendance_pct != null && c.attendance_pct < 75) out.push(`نسبة الحضور ${c.attendance_pct}% — انخفاض الحضور يُضعف كل المستويات اللاحقة؛ راجع الجدولة والتذكير.`);
  if (!out.length) out.push(s.index != null && s.index >= 75 ? 'سلسلة أثر متكاملة — وثّق البرنامج كممارسة مثلى وكرّره مع دفعات جديدة.' : 'استمر في القياس الدوري ووثّق المستويات الناقصة لاكتمال الصورة.');
  return out;
}

/** صفوف CSV لتقرير السلسلة */
export function chainCsv(rows: { program: string; c: ChainLevels; s: ChainScore }[]): (string | number | null)[][] {
  const head = ['البرنامج', 'رد الفعل (1–5)', 'ن', 'الكسب المعياري g', 'أزواج', 'نقل الأثر (0–100)', 'ن', 'تحقق النتائج %', 'مؤشرات', 'مؤشر السلسلة', 'الحضور %'];
  return [head, ...rows.map(r => [r.program, r.c.l1, r.c.l1_n, r.c.l2, r.c.l2_pairs, r.c.l3, r.c.l3_n, r.c.l4, r.c.l4_n, r.s.index, r.c.attendance_pct])];
}
