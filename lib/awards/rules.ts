/**
 * قواعد تكريم المدربين (لوحة الشرف) — منطق خالص قابل للاختبار.
 * المدخلات: صفوف المدربين للفترة الحالية والفترة السابقة (من groupBy('trainer')).
 */
import type { GroupRow } from '../reports/analytics';
import { THRESHOLDS, round } from '../reports/analytics';

export type AwardCategory = 'top_mean' | 'most_improved' | 'most_engaged' | 'most_consistent';
export type AwardCandidate = {
  category: AwardCategory; rank: number; trainer_id: string; trainer_name: string;
  metric_value: number; metric_label: string; responses: number; mean: number; eligible: boolean; reason?: string;
};
export type AwardRules = { minResponses: number; minMean: number; top: number };
export const DEFAULT_RULES: AwardRules = { minResponses: 10, minMean: THRESHOLDS.good, top: 3 };

export const CATEGORY_META: Record<AwardCategory, { ar: string; en: string; desc_ar: string; icon: string; certTitle: string }> = {
  top_mean: { ar: 'أعلى تقييم', en: 'Highest rating', desc_ar: 'أعلى متوسط رضا مع عينة كافية', icon: 'star', certTitle: 'جائزة التميز في التدريب — أعلى تقييم' },
  most_improved: { ar: 'الأكثر تحسنًا', en: 'Most improved', desc_ar: 'أكبر ارتفاع في المتوسط مقارنة بالفترة السابقة', icon: 'trend', certTitle: 'جائزة التطور المهني — الأكثر تحسنًا' },
  most_engaged: { ar: 'الأعلى مشاركة', en: 'Most engaged', desc_ar: 'أكبر عدد من استجابات المتدربين', icon: 'users', certTitle: 'جائزة التفاعل — الأعلى مشاركة' },
  most_consistent: { ar: 'الأكثر ثباتًا', en: 'Most consistent', desc_ar: 'أقل تشتت في التقييمات مع متوسط جيد', icon: 'shield', certTitle: 'جائزة الاتساق — الأكثر ثباتًا' },
};

/** مفتاح الفترة وتسميتها */
export function periodKey(from: string, to: string): string {
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01')) return from.slice(0, 7); // شهر كامل
  return `${from}_${to}`;
}
export function periodLabel(from: string, to: string, lang: 'ar' | 'en' = 'ar'): string {
  const months = lang === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (from.slice(0, 7) === to.slice(0, 7) && from.endsWith('-01')) { const [y, m] = from.split('-'); return `${months[Number(m) - 1]} ${y}`; }
  return `${from} → ${to}`;
}
export function monthRange(ymd: string): { from: string; to: string } {
  const [y, m] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}` };
}
export function previousRange(from: string, to: string): { from: string; to: string } {
  const a = new Date(from + 'T00:00:00Z'), b = new Date(to + 'T00:00:00Z');
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  const pTo = new Date(a.getTime() - 86400000), pFrom = new Date(pTo.getTime() - (days - 1) * 86400000);
  return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10) };
}

/** حساب المرشحين لكل فئة */
export function computeAwards(current: GroupRow[], previous: GroupRow[], rules: AwardRules = DEFAULT_RULES): AwardCandidate[] {
  const cur = current.filter(r => r.key); // استبعاد "بدون مدرب"
  const prevMap = new Map(previous.map(r => [r.key, r]));
  const out: AwardCandidate[] = [];
  const mk = (category: AwardCategory, rows: { r: GroupRow; value: number; label: string }[], eligibleFn: (r: GroupRow, v: number) => string | null) => {
    rows.slice(0, rules.top).forEach((x, i) => {
      const why = eligibleFn(x.r, x.value);
      out.push({ category, rank: i + 1, trainer_id: x.r.key, trainer_name: x.r.label, metric_value: x.value, metric_label: x.label, responses: x.r.responses, mean: round(x.r.mean), eligible: !why, reason: why || undefined });
    });
  };
  // 1) أعلى تقييم
  mk('top_mean',
    [...cur].sort((a, b) => b.mean - a.mean || b.responses - a.responses).map(r => ({ r, value: round(r.mean), label: `${round(r.mean).toFixed(2)} / 5` })),
    (r) => r.responses < rules.minResponses ? `عينة أقل من ${rules.minResponses} استجابة` : null);
  // 2) الأكثر تحسنًا (مقارنة بالفترة السابقة)
  const improved = cur.map(r => { const p = prevMap.get(r.key); return p && p.n >= THRESHOLDS.minSample ? { r, value: round(r.mean - p.mean), label: `${r.mean - p.mean >= 0 ? '+' : ''}${round(r.mean - p.mean).toFixed(2)} نقطة` } : null; })
    .filter((x): x is { r: GroupRow; value: number; label: string } => !!x && x.value > 0).sort((a, b) => b.value - a.value);
  mk('most_improved', improved, (r) => r.responses < rules.minResponses ? `عينة أقل من ${rules.minResponses} استجابة` : null);
  // 3) الأعلى مشاركة
  mk('most_engaged',
    [...cur].sort((a, b) => b.responses - a.responses || b.mean - a.mean).map(r => ({ r, value: r.responses, label: `${r.responses} استجابة` })),
    (r) => r.mean < THRESHOLDS.watch ? 'المتوسط دون حد المتابعة' : null);
  // 4) الأكثر ثباتًا
  mk('most_consistent',
    cur.filter(r => r.mean >= rules.minMean && r.n >= THRESHOLDS.minSample).sort((a, b) => a.sd - b.sd || b.mean - a.mean).map(r => ({ r, value: round(r.sd), label: `انحراف ${round(r.sd).toFixed(2)}` })),
    (r) => r.responses < rules.minResponses ? `عينة أقل من ${rules.minResponses} استجابة` : null);
  return out;
}

/** الفائزون المؤهلون فقط (المركز الأول في كل فئة، دون تكرار مدرب في أكثر من فئتين) */
export function winners(cands: AwardCandidate[], maxPerTrainer = 2): AwardCandidate[] {
  const count = new Map<string, number>(); const out: AwardCandidate[] = [];
  for (const cat of Object.keys(CATEGORY_META) as AwardCategory[]) {
    const pick = cands.filter(c => c.category === cat && c.eligible).find(c => (count.get(c.trainer_id) || 0) < maxPerTrainer);
    if (pick) { out.push({ ...pick, rank: 1 }); count.set(pick.trainer_id, (count.get(pick.trainer_id) || 0) + 1); }
  }
  return out;
}
