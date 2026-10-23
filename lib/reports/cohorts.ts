/**
 * المرحلة I — مقارنة الدفعات ومقارنة المدربين بعدالة إحصائية — دوال نقية بلا تبعيات
 */
import { applyFilters, groupBy, kpis, factsOf, mean, sd, TARGET, THRESHOLDS } from './analytics';
import type { Evaluation, Fact, Lookups, GroupRow, Lang } from './analytics';

/* ------------------------------------------------------------------ الدفعات */
export type CohortMode = 'classroom' | 'month' | 'quarter';
export type CohortRow = {
  key: string; label: string; from: string; to: string;
  n: number; participants: number; mean: number | null; highPct: number; lowPct: number; sd: number;
  trainers: string[]; delta: number | null; // الفرق عن الدفعة السابقة
  vsBest: number | null;                     // الفرق عن أفضل دفعة
  axes: { label: string; mean: number }[];   // أعلى/أدنى محاور
  perf: 'ok' | 'info' | 'warn' | 'bad' | 'na';
};

const monthKey = (d: string) => d.slice(0, 7);
const quarterKey = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function monthLabel(k: string): string { const m = Number(k.slice(5, 7)); return `${AR_MONTHS[m - 1] || k} ${k.slice(0, 4)}`; }
export function perfOf(m: number | null, n: number): CohortRow['perf'] { if (m == null || n < THRESHOLDS.minSample) return 'na'; return m >= THRESHOLDS.excellent ? 'ok' : m >= THRESHOLDS.good ? 'info' : m >= THRESHOLDS.watch ? 'warn' : 'bad'; }

/** تقسيم تقييمات برنامج إلى دفعات (حسب القاعة أو الشهر أو الربع) ومقارنتها */
export function cohorts(programId: string, all: Evaluation[], facts: Fact[], lk: Lookups, mode: CohortMode, lang: Lang = 'ar'): CohortRow[] {
  const evals = applyFilters(all, { programId, kind: 'ALL' }, lk);
  const groups = new Map<string, Evaluation[]>();
  for (const e of evals) {
    const d = e.date || (e.submitted_at || '').slice(0, 10); if (!d) continue;
    const k = mode === 'classroom' ? (e.classroom_id || '—') : mode === 'month' ? monthKey(d) : quarterKey(d);
    const arr = groups.get(k) || []; arr.push(e); groups.set(k, arr);
  }
  const rows: CohortRow[] = [];
  groups.forEach((es, key) => {
    const fx = factsOf(es, facts); const k = kpis(es, fx);
    const axes = groupBy('axis', es, fx, lk, lang).filter(a => a.n >= 3).sort((a, b) => b.mean - a.mean).map(a => ({ label: a.label, mean: Math.round(a.mean * 100) / 100 }));
    const dates = es.map(e => e.date).filter(Boolean).sort();
    const trainers = Array.from(new Set(es.map(e => e.trainer_id).filter(Boolean).map(t => lk.trainers.find(x => x.id === t)?.name || ''))).filter(Boolean);
    const label = mode === 'classroom' ? (lk.classrooms.find(c => c.id === key)?.code || (lang === 'ar' ? 'بدون قاعة' : 'No room')) : mode === 'month' ? monthLabel(key) : key;
    rows.push({ key, label, from: dates[0] || '', to: dates[dates.length - 1] || '', n: k.responses, participants: k.participants, mean: k.responses ? Math.round(k.mean * 100) / 100 : null, highPct: Math.round(k.highPct), lowPct: Math.round(k.lowPct), sd: Math.round(k.sd * 100) / 100, trainers, delta: null, vsBest: null, axes, perf: perfOf(k.responses ? k.mean : null, k.responses) });
  });
  rows.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.label.localeCompare(b.label, 'ar')));
  const best = Math.max(...rows.filter(r => r.mean != null && r.n >= THRESHOLDS.minSample).map(r => r.mean as number), -Infinity);
  rows.forEach((r, i) => {
    const prev = rows.slice(0, i).reverse().find(p => p.mean != null);
    r.delta = r.mean != null && prev?.mean != null ? Math.round((r.mean - prev.mean) * 100) / 100 : null;
    r.vsBest = r.mean != null && Number.isFinite(best) ? Math.round((r.mean - best) * 100) / 100 : null;
  });
  return rows;
}

export type CohortInsight = { kind: 'ok' | 'info' | 'warn' | 'bad'; text: string };
export function cohortInsights(rows: CohortRow[]): CohortInsight[] {
  const out: CohortInsight[] = []; const valid = rows.filter(r => r.mean != null && r.n >= THRESHOLDS.minSample);
  if (valid.length < 2) return [{ kind: 'info', text: 'تحتاج دفعتين على الأقل (بعينة ≥ 5 استبانات لكل منهما) لإجراء مقارنة موثوقة.' }];
  const best = valid.reduce((a, b) => ((b.mean as number) > (a.mean as number) ? b : a)); const worst = valid.reduce((a, b) => ((b.mean as number) < (a.mean as number) ? b : a));
  const spread = Math.round(((best.mean as number) - (worst.mean as number)) * 100) / 100;
  out.push({ kind: spread >= 0.5 ? 'warn' : 'ok', text: spread >= 0.5 ? `تفاوت كبير بين الدفعات (${spread} نقطة): الأفضل «${best.label}» ${best.mean} والأدنى «${worst.label}» ${worst.mean} — ابحث عن الفرق في المدرب/التوقيت/المحتوى.` : `اتساق جيد بين الدفعات (الفارق ${spread} نقطة فقط) — جودة التنفيذ مستقرة.` });
  const last = valid[valid.length - 1]; const first = valid[0];
  if (valid.length >= 3) { const trend = (last.mean as number) - (first.mean as number); out.push({ kind: trend >= 0.2 ? 'ok' : trend <= -0.2 ? 'bad' : 'info', text: trend >= 0.2 ? `اتجاه تحسّن عبر الزمن: من ${first.mean} إلى ${last.mean} (+${Math.round(trend * 100) / 100}).` : trend <= -0.2 ? `اتجاه تراجع عبر الزمن: من ${first.mean} إلى ${last.mean} (${Math.round(trend * 100) / 100}) — تدخّل مطلوب قبل الدفعة القادمة.` : 'الأداء مستقر عبر الزمن دون اتجاه واضح.' }); }
  const below = valid.filter(r => (r.mean as number) < TARGET);
  if (below.length) out.push({ kind: 'warn', text: `${below.length} من ${valid.length} دفعات دون المستهدف ${TARGET}: ${below.map(b => b.label).join('، ')}.` });
  const lowAxes = new Map<string, number>();
  for (const r of valid) { const low = r.axes[r.axes.length - 1]; if (low) lowAxes.set(low.label, (lowAxes.get(low.label) || 0) + 1); }
  const common = Array.from(lowAxes.entries()).sort((a, b) => b[1] - a[1])[0];
  if (common && common[1] >= 2) out.push({ kind: 'warn', text: `«${common[0]}» هو المحور الأدنى في ${common[1]} دفعات — مشكلة بنيوية لا تخص دفعة بعينها.` });
  return out;
}

/* ------------------------------------------------------------------ المدربون بعدالة */
export const SHRINK_K = 10; // قوة الانكماش نحو المتوسط العام (تعادل 10 استبانات)
export type TrainerRow = {
  id: string; name: string; n: number; participants: number; programs: number; rooms: number;
  raw: number | null;        // المتوسط الخام
  adjusted: number | null;   // بعد الانكماش البايزي نحو المتوسط العام
  context: number | null;    // الفرق عن متوسط البرامج التي درّسها (موزون) — يعزل صعوبة البرنامج
  ci: number | null;         // نصف فاصل الثقة 95%
  lowPct: number; confidence: 'high' | 'medium' | 'low' | 'none'; rank: number | null; perf: CohortRow['perf'];
  delta: number | null;      // النصف الثاني − النصف الأول (اتجاه)
};

export function trainerFairness(all: Evaluation[], facts: Fact[], lk: Lookups, opts: { programId?: string; from?: string; to?: string } = {}): { rows: TrainerRow[]; globalMean: number | null; k: number } {
  const evals = applyFilters(all, { programId: opts.programId, from: opts.from, to: opts.to, kind: 'ALL' } as any, lk);
  const byTrainer = groupBy('trainer', evals, facts, lk, 'ar');
  const g = evals.length ? kpis(evals, factsOf(evals, facts)).mean : null;
  // متوسط كل برنامج (سياق الصعوبة)
  const progMean = new Map<string, number>(); for (const p of groupBy('program', evals, facts, lk, 'ar')) progMean.set(p.key, p.mean);
  const rows: TrainerRow[] = byTrainer.filter(t => t.key && t.key !== '').map(t => {
    const mine = evals.filter(e => e.trainer_id === t.key);
    const progs = new Set(mine.map(e => e.program_id || '')); const rooms = new Set(mine.map(e => e.classroom_id || ''));
    // السياق: متوسط (متوسط المدرب في البرنامج − متوسط البرنامج) موزونًا بعدد الاستبانات
    let acc = 0, w = 0;
    progs.forEach(pid => { const es = mine.filter(e => e.program_id === pid); const fx = factsOf(es, facts); if (!fx.length) return; const m = mean(fx.map(f => f.value)); const pm = progMean.get(pid); if (pm == null) return; acc += (m - pm) * es.length; w += es.length; });
    const context = w ? Math.round((acc / w) * 100) / 100 : null;
    const adjusted = g == null ? null : Math.round(((t.responses * t.mean + SHRINK_K * g) / (t.responses + SHRINK_K)) * 100) / 100;
    const ci = t.responses > 1 ? Math.round(((1.96 * t.sd) / Math.sqrt(t.responses)) * 100) / 100 : null;
    const confidence: TrainerRow['confidence'] = t.responses >= 30 ? 'high' : t.responses >= 10 ? 'medium' : t.responses >= THRESHOLDS.minSample ? 'low' : 'none';
    return { id: t.key, name: t.label, n: t.responses, participants: t.participants, programs: progs.size, rooms: rooms.size, raw: Math.round(t.mean * 100) / 100, adjusted, context, ci, lowPct: Math.round(t.lowPct), confidence, rank: null, perf: perfOf(adjusted, t.responses), delta: t.delta == null ? null : Math.round(t.delta * 100) / 100 };
  });
  const ranked = rows.filter(r => r.confidence !== 'none' && r.adjusted != null).sort((a, b) => (b.adjusted as number) - (a.adjusted as number));
  ranked.forEach((r, i) => { r.rank = i + 1; });
  rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || b.n - a.n);
  return { rows, globalMean: g == null ? null : Math.round(g * 100) / 100, k: SHRINK_K };
}

export function fairnessNotes(res: ReturnType<typeof trainerFairness>): string[] {
  const out: string[] = [];
  const r = res.rows; const ranked = r.filter(x => x.rank);
  if (!ranked.length) return ['لا توجد عينات كافية (≥ 5 استبانات لكل مدرب) لترتيب عادل.'];
  const flipped = r.filter(x => x.raw != null && x.adjusted != null && x.rank && Math.abs(x.raw - x.adjusted) >= 0.15);
  if (flipped.length) out.push(`${flipped.length} مدربًا تغيّر تقديرهم بعد التصحيح الإحصائي (عينات صغيرة): لا تعتمد المتوسط الخام وحده — ${flipped.slice(0, 3).map(x => `${x.name} ${x.raw}→${x.adjusted}`).join('، ')}.`);
  const hardCtx = r.filter(x => x.context != null && x.context >= 0.2 && x.raw != null && res.globalMean != null && x.raw < res.globalMean);
  if (hardCtx.length) out.push(`${hardCtx.map(x => x.name).join('، ')}: متوسط خام دون العام لكنهم يتفوقون على متوسط برامجهم (برامج أصعب) — يستحقون تقديرًا سياقيًا.`);
  const lowConf = r.filter(x => x.confidence === 'low' || x.confidence === 'none');
  if (lowConf.length) out.push(`${lowConf.length} مدربًا بعينة صغيرة (< 10 استبانات) — فواصل الثقة واسعة؛ تجنّب القرارات الفردية قبل اكتمال العينة.`);
  const top = ranked[0]; if (top) out.push(`الأعلى بعد التصحيح: ${top.name} (${top.adjusted} ± ${top.ci ?? '—'}) على ${top.n} استبانة في ${top.programs} برنامج.`);
  return out;
}

export function cohortsCsv(programName: string, rows: CohortRow[]): (string | number | null)[][] {
  return [['البرنامج', 'الدفعة', 'من', 'إلى', 'استبانات', 'مشاركون', 'المتوسط', '% مرتفع', '% منخفض', 'الانحراف', 'الفرق عن السابقة', 'الفرق عن الأفضل', 'المدربون'], ...rows.map(r => [programName, r.label, r.from, r.to, r.n, r.participants, r.mean, r.highPct, r.lowPct, r.sd, r.delta, r.vsBest, r.trainers.join('، ')])];
}
export function trainersCsv(rows: TrainerRow[]): (string | number | null)[][] {
  return [['الترتيب', 'المدرب', 'استبانات', 'مشاركون', 'برامج', 'قاعات', 'المتوسط الخام', 'المعدّل (انكماش)', 'السياق (± عن البرنامج)', '± ثقة 95%', '% منخفض', 'الثقة', 'الاتجاه'], ...rows.map(r => [r.rank, r.name, r.n, r.participants, r.programs, r.rooms, r.raw, r.adjusted, r.context, r.ci, r.lowPct, r.confidence, r.delta])];
}
export { sd };
