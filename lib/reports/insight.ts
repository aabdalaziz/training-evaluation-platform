// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 */
/**
 * «عمق التحليل» — طبقة تحليل موحّدة فوق كلّ الاستبيانات (اليومي · النهائي · الختامي · التعلّم عن بُعد) بلا تبعيّات.
 *  الفكرة: كلّ استجابة من أيّ مصدر تُحوَّل إلى «مشاهدة» Obs (بنود 1–5 + محاور + نصوص + شرائح) ثمّ تجري عليها الأدوات نفسها:
 *   - الإحصاء الوصفي بفواصل ثقة 95% · ثبات المحاور (ألفا كرونباخ) · صافي الرضا (أعلى صندوقين − أدنى صندوقين)
 *   - محرّكات الرضا: ارتباط كلّ بند بالرضا العامّ → مصفوفة الأهمّية/الأداء (أصلِح أوّلًا · حافِظ · أولوية دنيا · فائض)
 *   - الديناميكا اليومية: الميل، أفضل/أسوأ يوم، إرهاق النصف الثاني، الأيام الشاذّة
 *   - الشرائح: فروق ذات دلالة بين الفصول/المدرّبين/المستويات/الجنس (Welch t + Cohen d)
 *   - خريطة حرارية محور × يوم/فصل · مواضيع التعليقات (12 موضوعًا) مع المشاعر والاقتباسات والطلبات
 *   - نتائج (Findings) مرقّمة بأدلّتها → توصيات مرتّبة بالأولوية لها مالك ومدّة ومؤشّر متابعة
 *   - مؤلّف التقرير: مستند مقسّم (ملخّص تنفيذي · منهجية · نتائج بحسب النوع · محاور · بنود · ديناميكا · محرّكات · شرائح · أصوات · توصيات · جودة إحصائية وحدود)
 */
import type { Evaluation, Fact, Lookups, Comment } from './analytics';
import { sentimentOf, TARGET } from './analytics';
import type { ResponseRow, ScaleCode } from '../surveys/remoteLearning';
import { STATEMENTS, STATEMENT_AXES, DIFFICULTIES, SATISFACTION_KEY } from '../surveys/remoteLearning';

/* ────────────────────────────── النموذج الموحّد ────────────────────────────── */
export type ObsKind = 'DAILY' | 'FINAL' | 'END' | 'REMOTE';
export const KIND_AR: Record<ObsKind, string> = { DAILY: 'التقييم اليومي', FINAL: 'التقييم النهائي', END: 'الاستبيان الختامي', REMOTE: 'استبيان التعلّم عن بُعد' };
export type Obs = {
  id: string; kind: ObsKind; date: string; program_id: string | null; classroom: string | null; trainer: string | null; level: string | null; gender: string | null;
  items: Record<string, number>; texts: { key: string; label: string; text: string }[]; tags: string[]; /* صعوبات/خيارات */
};
export type ItemDef = { key: string; label: string; axis: string; kinds: ObsKind[] };
export type Dataset = { obs: Obs[]; items: ItemDef[]; labels: Record<string, string> /* معرّفات الفصول/المدرّبين/المستويات → أسماء */ };

const SCALE_VAL: Record<ScaleCode, number | null> = { SA: 5, A: 4, N: 3, D: 2, SD: 1, NA: null };
const r2 = (x: number) => Math.round(x * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const variance = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1); };
const sd = (xs: number[]) => Math.sqrt(variance(xs));

/** من التقييمات الاعتيادية (يومي/نهائي/ختامي) — يعتمد على الحقائق المبنية في analytics. */
export function fromEvaluations(evals: Evaluation[], facts: Fact[], comments: Comment[], lk: Lookups): Dataset {
  const byEval = new Map<string, Fact[]>(); for (const f of facts) { const l = byEval.get(f.evaluation_id) || []; l.push(f); byEval.set(f.evaluation_id, l); }
  const byEvalC = new Map<string, Comment[]>(); for (const c of comments) { const l = byEvalC.get(c.evaluation_id) || []; l.push(c); byEvalC.set(c.evaluation_id, l); }
  const items = new Map<string, ItemDef>(); const labels: Record<string, string> = {};
  for (const c of lk.classrooms) labels[c.id] = c.code; for (const t of lk.trainers) labels[t.id] = t.name;
  const obs: Obs[] = [];
  for (const e of evals) {
    const fs = byEval.get(e.id) || []; if (!fs.length && !(byEvalC.get(e.id) || []).length) continue;
    const kind = (['DAILY', 'FINAL', 'END'].includes(String(e.kind)) ? e.kind : 'FINAL') as ObsKind; const it: Record<string, number> = {};
    for (const f of fs) { it[f.question_id] = f.value; const d = items.get(f.question_id); if (!d) items.set(f.question_id, { key: f.question_id, label: f.text_ar || f.text_en || f.question_key, axis: f.section_ar || f.section_en || 'عام', kinds: [kind] }); else if (!d.kinds.includes(kind)) d.kinds.push(kind); }
    obs.push({ id: e.id, kind, date: e.date, program_id: e.program_id, classroom: e.classroom_id, trainer: e.trainer_id, level: null, gender: e.guest_gender || null, items: it, texts: (byEvalC.get(e.id) || []).map((c) => ({ key: c.question_id, label: c.question_ar, text: c.text })), tags: [] });
  }
  return { obs, items: Array.from(items.values()), labels };
}
/** من استبيان التعلّم عن بُعد (SA..SD → 5..1، NA تُهمل). */
export function fromRemote(rows: ResponseRow[], ctx: { classrooms: { id: string; code: string }[]; trainers: { id: string; name: string }[]; levels: { id: string; name_ar: string }[] }): Dataset {
  const labels: Record<string, string> = {}; for (const c of ctx.classrooms) labels[c.id] = c.code; for (const t of ctx.trainers) labels[t.id] = t.name; for (const l of ctx.levels) labels[l.id] = l.name_ar;
  const axisOf = (k: string) => STATEMENT_AXES.find((a) => a.keys.includes(k))?.ar || 'عام';
  const items: ItemDef[] = STATEMENTS.map((s) => ({ key: s.key, label: s.ar, axis: axisOf(s.key), kinds: ['REMOTE'] }));
  const obs: Obs[] = rows.map((r) => {
    const it: Record<string, number> = {}; for (const [k, code] of Object.entries(r.ratings || {})) { const v = SCALE_VAL[code as ScaleCode]; if (v != null) it[k] = v; }
    const texts = [] as Obs['texts']; if (r.liked_most?.trim()) texts.push({ key: 'liked', label: 'ما أعجبني أكثر', text: r.liked_most.trim() }); if (r.suggestion?.trim()) texts.push({ key: 'suggest', label: 'اقتراح', text: r.suggestion.trim() }); if (r.difficulty_other?.trim()) texts.push({ key: 'difficulty', label: 'صعوبة أخرى', text: r.difficulty_other.trim() });
    const tags = (r.difficulties || []).filter((d) => d !== 'none').map((d) => DIFFICULTIES.find((x) => x.code === d)?.ar || d);
    if (r.attendance) tags.push(`حضور:${r.attendance}`);
    return { id: r.id, kind: 'REMOTE', date: r.lecture_date || String(r.submitted_at || '').slice(0, 10), program_id: r.program_id, classroom: r.classroom_id || r.classroom_code_snapshot || null, trainer: r.trainer_id || r.trainer_name_snapshot || null, level: r.level_id || r.level_code_snapshot || null, gender: null, items: it, texts, tags };
  });
  return { obs, items, labels };
}
export function merge(...ds: Dataset[]): Dataset {
  const items = new Map<string, ItemDef>(); const labels: Record<string, string> = {}; const obs: Obs[] = [];
  for (const d of ds) { obs.push(...d.obs); Object.assign(labels, d.labels); for (const i of d.items) { const p = items.get(i.key); if (!p) items.set(i.key, { ...i, kinds: [...i.kinds] }); else for (const k of i.kinds) if (!p.kinds.includes(k)) p.kinds.push(k); } }
  return { obs, items: Array.from(items.values()), labels };
}
export const filterKinds = (d: Dataset, kinds: ObsKind[]): Dataset => ({ ...d, obs: d.obs.filter((o) => kinds.includes(o.kind)) });

/* ────────────────────────────── الإحصاء الوصفي ────────────────────────────── */
export type Desc = { n: number; mean: number; sd: number; se: number; lo: number; hi: number; dist: [number, number, number, number, number]; top2: number; bottom2: number; net: number };
export function describe(xs: number[]): Desc {
  const n = xs.length; const m = mean(xs); const s = sd(xs); const se = n > 1 ? s / Math.sqrt(n) : 0; const t = n > 30 ? 1.96 : n > 1 ? T95[Math.min(n - 1, 30)] : 0;
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0]; for (const x of xs) { const r = Math.round(x); if (r >= 1 && r <= 5) dist[r - 1]++; }
  const top2 = n ? Math.round(((dist[3] + dist[4]) / n) * 1000) / 10 : 0; const bottom2 = n ? Math.round(((dist[0] + dist[1]) / n) * 1000) / 10 : 0;
  return { n, mean: r2(m), sd: r2(s), se: r2(se), lo: r2(m - t * se), hi: r2(m + t * se), dist, top2, bottom2, net: r2(top2 - bottom2) };
}
const T95 = [0, 12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.2, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.1, 2.09, 2.09, 2.08, 2.07, 2.07, 2.06, 2.06, 2.06, 2.05, 2.05, 2.05, 2.04];
export type ItemStat = ItemDef & Desc & { rank: number; tone: 'ok' | 'info' | 'warn' | 'bad' };
export const toneOf = (m: number, n: number): ItemStat['tone'] => (n === 0 ? 'info' : m >= TARGET ? 'ok' : m >= 3.7 ? 'info' : m >= 3 ? 'warn' : 'bad');
export function itemStats(d: Dataset): ItemStat[] {
  const out = d.items.map((it) => { const xs = d.obs.map((o) => o.items[it.key]).filter((v): v is number => v != null); return { ...it, ...describe(xs), rank: 0, tone: toneOf(mean(xs), xs.length) }; }).filter((i) => i.n > 0);
  out.sort((a, b) => b.mean - a.mean).forEach((i, k) => (i.rank = k + 1)); return out;
}
export type AxisStat = { axis: string; items: ItemStat[]; n: number; mean: number; lo: number; hi: number; top2: number; bottom2: number; alpha: number | null; alphaLabel: string; tone: ItemStat['tone'] };
/** ألفا كرونباخ على المشاهدات التي أجابت عن كلّ بنود المحور (≥ 2 بنود و ≥ 5 مشاهدات). */
export function cronbach(d: Dataset, keys: string[]): number | null {
  if (keys.length < 2) return null; const rows = d.obs.map((o) => keys.map((k) => o.items[k])).filter((r) => r.every((v) => v != null)) as number[][]; if (rows.length < 5) return null;
  const k = keys.length; const itemVar = keys.map((_, j) => variance(rows.map((r) => r[j]))).reduce((a, b) => a + b, 0); const totVar = variance(rows.map((r) => r.reduce((a, b) => a + b, 0))); if (!totVar) return null;
  return r2((k / (k - 1)) * (1 - itemVar / totVar));
}
export const alphaLabel = (a: number | null) => (a == null ? 'غير محسوب (عيّنة/بنود قليلة)' : a <= 0 ? 'غير دالّ — تباين ضئيل بين البنود' : a >= 0.8 ? 'ثبات مرتفع' : a >= 0.7 ? 'ثبات مقبول' : a >= 0.6 ? 'ثبات حدّي' : 'ثبات منخفض — راجع صياغة البنود');
export function axisStats(d: Dataset, items = itemStats(d)): AxisStat[] {
  const byAxis = new Map<string, ItemStat[]>(); for (const i of items) { const l = byAxis.get(i.axis) || []; l.push(i); byAxis.set(i.axis, l); }
  return Array.from(byAxis.entries()).map(([axis, its]) => { const keys = its.map((i) => i.key); const xs = d.obs.flatMap((o) => keys.map((k) => o.items[k]).filter((v): v is number => v != null)); const ds = describe(xs); const alpha = cronbach(d, keys); return { axis, items: its, n: ds.n, mean: ds.mean, lo: ds.lo, hi: ds.hi, top2: ds.top2, bottom2: ds.bottom2, alpha, alphaLabel: alphaLabel(alpha), tone: toneOf(ds.mean, ds.n) }; }).sort((a, b) => b.mean - a.mean);
}
export function overall(d: Dataset): Desc { return describe(d.obs.flatMap((o) => Object.values(o.items))); }

/* ────────────────────────────── محرّكات الرضا (IPA) ────────────────────────────── */
export type Quadrant = 'fix_first' | 'keep' | 'low_priority' | 'overkill';
export const QUADRANT_AR: Record<Quadrant, string> = { fix_first: 'أصلِح أوّلًا', keep: 'حافِظ عليه', low_priority: 'أولوية دنيا', overkill: 'فائض جهد' };
export type Driver = { key: string; label: string; axis: string; r: number; mean: number; n: number; quadrant: Quadrant };
export function pearson(xs: number[], ys: number[]): number { const n = xs.length; if (n < 3) return 0; const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return sxx && syy ? r2(sxy / Math.sqrt(sxx * syy)) : 0; }
/** البند المعياري للرضا: مفتاح الرضا في «عن بُعد» أو بند نصّه يحوي رضا/أوصي/overall؛ وإلا متوسّط المشاهدة بلا البند نفسه. */
const OVERALL_RE = /(رضا|راضٍ|راض عام|بشكل عام|أوصي|انطباع عام|overall|recommend|satisf)/i;
/** بنود الرضا المعيارية (قد تتعدّد بتعدّد المصادر: بند الرضا في «عن بُعد» + بند «الرضا العامّ» في اليومي). */
export function overallKeys(d: Dataset): string[] { return d.items.filter((i) => i.key === SATISFACTION_KEY || OVERALL_RE.test(i.label)).map((i) => i.key); }
export function overallKey(d: Dataset): string | null { return overallKeys(d)[0] || null; }
/** قيمة الرضا لمشاهدة: أوّل بند رضا متاح فيها، وإلا متوسّط بقيّة بنودها. */
function overallOf(o: Obs, keys: string[], excluding: string): number | null { for (const k of keys) if (k !== excluding && o.items[k] != null) return o.items[k]; const rest = Object.entries(o.items).filter(([k]) => k !== excluding && !keys.includes(k)).map(([, v]) => v); return rest.length >= 2 ? mean(rest) : null; }
export function drivers(d: Dataset, items = itemStats(d)): Driver[] {
  const keys = overallKeys(d); const out: Driver[] = [];
  for (const it of items) { if (keys.includes(it.key)) continue; const xs: number[] = [], ys: number[] = []; for (const o of d.obs) { const v = o.items[it.key]; if (v == null) continue; const y = overallOf(o, keys, it.key); if (y == null) continue; xs.push(v); ys.push(y); } if (xs.length < 5 || sd(xs) === 0) continue; /* لا تباين → لا ارتباط قابل للتفسير */ out.push({ key: it.key, label: it.label, axis: it.axis, r: pearson(xs, ys), mean: it.mean, n: xs.length, quadrant: 'keep' }); }
  if (!out.length) return out; const rMed = median(out.map((x) => x.r)); const mMed = median(out.map((x) => x.mean));
  for (const x of out) x.quadrant = x.r >= rMed ? (x.mean < mMed ? 'fix_first' : 'keep') : x.mean < mMed ? 'low_priority' : 'overkill';
  return out.sort((a, b) => b.r - a.r);
}
export function median(xs: number[]): number { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

/* ────────────────────────────── الديناميكا اليومية ────────────────────────────── */
export type DayPoint = { date: string; n: number; mean: number; lo: number; hi: number; z: number };
export type Dynamics = { days: DayPoint[]; slope: number; trend: 'up' | 'down' | 'flat'; best: DayPoint | null; worst: DayPoint | null; fatigue: boolean; firstThird: number; lastThird: number; anomalies: DayPoint[] };
export function dynamics(d: Dataset): Dynamics {
  const dated = d.obs.filter((o) => o.kind === 'DAILY' || o.kind === 'REMOTE'); const src = dated.length >= 3 ? dated : d.obs; /* الديناميكا للاستبيانات المرتبطة بيوم/محاضرة؛ النهائي والختامي لا يصفان يومًا */
  const by = new Map<string, number[]>(); for (const o of src) { if (!o.date) continue; const l = by.get(o.date) || []; l.push(...Object.values(o.items)); by.set(o.date, l); }
  const days: DayPoint[] = Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, xs]) => { const ds = describe(xs); return { date, n: ds.n, mean: ds.mean, lo: ds.lo, hi: ds.hi, z: 0 }; }).filter((p) => p.n >= 3);
  const ms = days.map((p) => p.mean); const gm = mean(ms), gs = sd(ms); for (const p of days) p.z = gs ? r2((p.mean - gm) / gs) : 0;
  let slope = 0; if (days.length >= 3) { const xs = days.map((_, i) => i); const mx = mean(xs); const my = gm; const num = xs.reduce((s, x, i) => s + (x - mx) * (ms[i] - my), 0); const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0); slope = den ? r2(num / den) : 0; }
  const third = Math.max(1, Math.floor(days.length / 3)); const firstThird = r2(mean(ms.slice(0, third))); const lastThird = r2(mean(ms.slice(-third)));
  const sorted = [...days].sort((a, b) => b.mean - a.mean);
  return { days, slope, trend: slope > 0.03 ? 'up' : slope < -0.03 ? 'down' : 'flat', best: sorted[0] || null, worst: sorted[sorted.length - 1] || null, fatigue: days.length >= 4 && firstThird - lastThird >= 0.2, firstThird, lastThird, anomalies: days.filter((p) => p.z <= -1.5) };
}

/* ────────────────────────────── الشرائح ────────────────────────────── */
export type SegDim = 'classroom' | 'trainer' | 'level' | 'gender' | 'kind';
export const SEG_AR: Record<SegDim, string> = { classroom: 'الفصل', trainer: 'المدرّب', level: 'المستوى', gender: 'الجنس', kind: 'نوع الاستبيان' };
export type Segment = { key: string; label: string; n: number; responses: number; mean: number; lo: number; hi: number; top2: number };
export type SegmentGap = { dim: SegDim; best: Segment; worst: Segment; d: number; t: number; df: number; p: number; significant: boolean };
export function segments(d: Dataset, dim: SegDim): Segment[] {
  const by = new Map<string, { xs: number[]; resp: number }>();
  for (const o of d.obs) { const k = dim === 'kind' ? o.kind : (o as any)[dim]; if (!k) continue; const b = by.get(k) || { xs: [], resp: 0 }; b.xs.push(...Object.values(o.items)); b.resp++; by.set(k, b); }
  return Array.from(by.entries()).map(([key, b]) => { const ds = describe(b.xs); return { key, label: dim === 'kind' ? KIND_AR[key as ObsKind] : d.labels[key] || key, n: ds.n, responses: b.resp, mean: ds.mean, lo: ds.lo, hi: ds.hi, top2: ds.top2 }; }).filter((s) => s.n >= 5).sort((a, b) => b.mean - a.mean);
}
/** Welch t بين أعلى وأدنى شريحة + Cohen d. */
export function segmentGap(d: Dataset, dim: SegDim): SegmentGap | null {
  const segs = segments(d, dim); if (segs.length < 2) return null; const best = segs[0], worst = segs[segs.length - 1];
  const xs = (k: string) => d.obs.filter((o) => (dim === 'kind' ? o.kind : (o as any)[dim]) === k).flatMap((o) => Object.values(o.items));
  const a = xs(best.key), b = xs(worst.key); const va = variance(a), vb = variance(b); const se = Math.sqrt(va / a.length + vb / b.length); if (!se) return null;
  const t = (mean(a) - mean(b)) / se; const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2)); const dd = sp ? (mean(a) - mean(b)) / sp : 0; const p = pFromT(Math.abs(t), df);
  return { dim, best, worst, d: r2(dd), t: r2(t), df: Math.round(df), p: r2(p), significant: p < 0.05 && Math.abs(dd) >= 0.3 };
}
/** تقريب p ثنائي الذيل من t (تقريب عادي محسَّن للدرجات الصغيرة). */
export function pFromT(t: number, df: number): number { const z = df > 0 && df < 30 ? t * (1 - 1 / (4 * df)) / Math.sqrt(1 + (t * t) / (2 * df)) : t; const p = 2 * (1 - Phi(Math.abs(z))); return Math.max(0, Math.min(1, p)); }
function Phi(z: number): number { const t = 1 / (1 + 0.2316419 * z); const d = 0.3989423 * Math.exp((-z * z) / 2); return 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); }

/* ────────────────────────────── الخريطة الحرارية ────────────────────────────── */
export type Heat = { rows: string[]; cols: string[]; cells: (number | null)[][]; ns: number[][] };
export function heatmap(d: Dataset, col: 'date' | 'classroom' | 'trainer' | 'level', items = itemStats(d)): Heat {
  const axes = Array.from(new Set(items.map((i) => i.axis))); const axisOf = new Map(items.map((i) => [i.key, i.axis]));
  const src = col === 'date' ? d.obs.filter((o) => o.kind === 'DAILY' || o.kind === 'REMOTE') : d.obs; /* الأعمدة الزمنية للاستبيانات اليومية فقط */
  const colKeys = Array.from(new Set(src.map((o) => (o as any)[col]).filter(Boolean))).sort() as string[];
  const acc = new Map<string, number[]>(); for (const o of src) { const c = (o as any)[col]; if (!c) continue; for (const [k, v] of Object.entries(o.items)) { const a = axisOf.get(k); if (!a) continue; const kk = `${a}|${c}`; const l = acc.get(kk) || []; l.push(v); acc.set(kk, l); } }
  const cells = axes.map((a) => colKeys.map((c) => { const l = acc.get(`${a}|${c}`); return l && l.length >= 3 ? r2(mean(l)) : null; })); const ns = axes.map((a) => colKeys.map((c) => (acc.get(`${a}|${c}`) || []).length));
  return { rows: axes, cols: colKeys.map((c) => (col === 'date' ? c : d.labels[c] || c)), cells, ns };
}

/* ────────────────────────────── أصوات المشاركين ────────────────────────────── */
export type ThemeKey = 'trainer' | 'content' | 'time' | 'platform' | 'materials' | 'organization' | 'application' | 'interaction' | 'assessment' | 'tech' | 'language' | 'other';
export const THEME_AR: Record<ThemeKey, string> = { trainer: 'المدرّب', content: 'المحتوى', time: 'الوقت والمدّة', platform: 'المكان/المنصّة', materials: 'المواد والحقيبة', organization: 'التنظيم والتواصل', application: 'التطبيق العملي', interaction: 'التفاعل والأنشطة', assessment: 'التقييم والواجبات', tech: 'التقنية والاتصال', language: 'اللغة والفهم', other: 'أخرى' };
const THEME_RE: [ThemeKey, RegExp][] = [
  ['trainer', /(مدرب|مدرّب|مدرس|مدرّس|معلم|معلّم|الدكتور|أستاذ|استاذ|trainer|teacher|instructor)/i], ['tech', /(انترنت|إنترنت|(^|\s)(ال)?نت(\s|$|[.,،])|اتصال|الصوت|صوت|الصورة|كاميرا|مايك|ميكروفون|تقطيع|انقطاع|internet|audio|video|connection|mic)/i],
  ['platform', /(teams|تيمز|زوم|zoom|منصة|منصّة|القاعة|قاعة|المكان|مكان|الفندق|التكييف|تكييف|الكراسي|platform|room|venue)/i], ['time', /(الوقت|وقت|المدة|مدّة|مدة|طويل|قصير|ساعات|ساعة|اليوم|الأيام|ايام|موعد|مواعيد|تأخير|time|long|short|schedule|late)/i],
  ['materials', /(الحقيبة|حقيبة|المادة العلمية|المواد|مواد|الكتاب|كتاب|الملف|ملف|العرض|شرائح|pdf|material|slides|handout|book)/i], ['application', /(تطبيق|عملي|تمارين|تمرين|حالات|حالة عملية|واقع|العمل|ورشة|practical|apply|hands|exercise|workshop)/i],
  ['interaction', /(تفاعل|نقاش|حوار|مشاركة|أنشطة|انشطة|نشاط|مجموعات|ألعاب|العاب|interact|discussion|activit|group|game)/i], ['assessment', /(اختبار|امتحان|واجب|واجبات|تقييم|درجات|quiz|exam|assignment|homework|grade)/i],
  ['organization', /(تنظيم|التنظيم|تواصل|التواصل|إشعار|اشعار|رسائل|الشهادة|شهادة|التسجيل|تسجيل|الاستقبال|organi|communicat|certificate|registration)/i], ['language', /(اللغة|لغة|الفهم|فهم|كلمات|مفردات|صعب|سهل|language|understand|vocabulary|difficult|easy)/i],
  ['content', /(المحتوى|محتوى|المادة|معلومات|المعلومات|الشرح|شرح|الأمثلة|امثلة|المنهج|منهج|content|explanation|example|curriculum|topic)/i],
];
const REQUEST_RE = /(أتمنى|اتمنى|نتمنى|أقترح|اقترح|نقترح|يفضل|يُفضَّل|لو |ليت|نرجو|أرجو|ارجو|ياليت|يا ليت|زيادة|إضافة|اضافة|تقليل|تخصيص|hope|suggest|wish|prefer|please|should|more |less )/i;
export type Theme = { key: ThemeKey; label: string; count: number; positive: number; negative: number; neutral: number; share: number; quotes: { text: string; sentiment: Comment['sentiment']; kind: ObsKind }[]; requests: string[] };
const EXTRA_NEG = /(قصير|قليل|قلة|قلّة|ضعف|ضعيف|متعب|مرهق|لم يكن|ليس|غير كاف|ناقص|مشتت|سريع جدًا|سريع جدا|بطيء|مزدحم|زحمة|مكرر|مكرّر|سطحي|غير واضح|لا يكفي|لا تكفي|تقطع|انقطع)/i;
const EXTRA_POS = /(صبور|صبورة|رائع|رائعة|مبدع|مبدعة|متمكن|متمكّن|استفدت|أفادني|افادني|شكرًا|شكرا|ممتن|أنصح|انصح|واضح|واضحة)/i;
/** مشاعر: معجم analytics ثمّ مكمّل محلّي للعامّية والصياغات الشائعة في التعليقات التدريبية. */
export function sentiment(text: string): Comment['sentiment'] { const base = sentimentOf(text); if (base !== 'neutral') return base; const neg = EXTRA_NEG.test(text), pos = EXTRA_POS.test(text); return neg && !pos ? 'negative' : pos && !neg ? 'positive' : 'neutral'; }
export function themes(d: Dataset, maxQuotes = 3): { themes: Theme[]; total: number; requests: string[] } {
  const acc = new Map<ThemeKey, Theme>(); let total = 0; const requests: string[] = [];
  for (const o of d.obs) for (const t of o.texts) { const text = t.text.trim(); if (text.length < 3) continue; total++; const s = sentiment(text); const hit = THEME_RE.filter(([, re]) => re.test(text)).map(([k]) => k); const keys: ThemeKey[] = hit.length ? hit.slice(0, 2) : ['other']; const isReq = REQUEST_RE.test(text); if (isReq) requests.push(text);
    for (const k of keys) { const th = acc.get(k) || { key: k, label: THEME_AR[k], count: 0, positive: 0, negative: 0, neutral: 0, share: 0, quotes: [], requests: [] }; th.count++; th[s]++; if (th.quotes.length < maxQuotes && text.length >= 15 && text.length <= 220) th.quotes.push({ text, sentiment: s, kind: o.kind }); if (isReq && th.requests.length < 5) th.requests.push(text); acc.set(k, th); } }
  const list = Array.from(acc.values()).map((t) => ({ ...t, share: total ? Math.round((t.count / total) * 100) : 0 })).sort((a, b) => b.count - a.count);
  return { themes: list, total, requests: Array.from(new Set(requests)).slice(0, 12) };
}
/** الصعوبات/الوسوم المختارة (عن بُعد): عدد ونسبة. */
export function tagCounts(d: Dataset): { tag: string; count: number; pct: number }[] { const n = d.obs.filter((o) => o.kind === 'REMOTE').length || d.obs.length; const acc = new Map<string, number>(); for (const o of d.obs) for (const t of o.tags) if (!t.startsWith('حضور:')) acc.set(t, (acc.get(t) || 0) + 1); return Array.from(acc.entries()).map(([tag, count]) => ({ tag, count, pct: n ? Math.round((count / n) * 100) : 0 })).sort((a, b) => b.count - a.count); }

/* ────────────────────────────── المرجعية ────────────────────────────── */
export type Benchmark = { mean: number; portfolioMean: number; percentile: number; rank: number; of: number; z: number };
export function benchmark(current: number, others: number[]): Benchmark | null { if (!others.length) return null; const below = others.filter((x) => x < current).length; const pm = mean(others); const s = sd(others); const all = [...others, current].sort((a, b) => b - a); return { mean: r2(current), portfolioMean: r2(pm), percentile: Math.round((below / others.length) * 100), rank: all.indexOf(current) + 1, of: all.length, z: s ? r2((current - pm) / s) : 0 }; }

/* ────────────────────────────── النتائج والتوصيات ────────────────────────────── */
export type Finding = { id: string; kind: 'strength' | 'gap' | 'risk' | 'signal' | 'quality'; title: string; evidence: string; weight: number /* 1..5 */; refs: string[] };
export type Recommendation = { id: string; title: string; why: string; steps: string[]; owner: string; days: number; kpi: string; priority: 'عاجلة' | 'عالية' | 'متوسّطة' | 'منخفضة'; score: number; findings: string[] };
export type Analysis = { kinds: ObsKind[]; n: number; participants: number; overall: Desc; items: ItemStat[]; axes: AxisStat[]; drivers: Driver[]; dyn: Dynamics; segs: { dim: SegDim; rows: Segment[]; gap: SegmentGap | null }[]; heat: Heat; voices: ReturnType<typeof themes>; tags: ReturnType<typeof tagCounts>; byKind: { kind: ObsKind; n: number; desc: Desc; top: ItemStat | null; low: ItemStat | null }[]; bench: Benchmark | null; findings: Finding[]; recs: Recommendation[] };
export function analyze(d: Dataset, opts: { benchmarkOthers?: number[]; heatCol?: 'date' | 'classroom' | 'trainer' | 'level' } = {}): Analysis {
  const items = itemStats(d); const axes = axisStats(d, items); const ov = overall(d); const drv = drivers(d, items); const dyn = dynamics(d);
  const segs = (['kind', 'classroom', 'trainer', 'level', 'gender'] as SegDim[]).map((dim) => ({ dim, rows: segments(d, dim), gap: segmentGap(d, dim) })).filter((s) => s.rows.length >= 2);
  const kinds = Array.from(new Set(d.obs.map((o) => o.kind))) as ObsKind[];
  const byKind = kinds.map((kind) => { const sub = filterKinds(d, [kind]); const its = itemStats(sub); return { kind, n: sub.obs.length, desc: overall(sub), top: its[0] || null, low: its[its.length - 1] || null }; });
  const heatCol = opts.heatCol || (dyn.days.length >= 3 ? 'date' : 'classroom');
  const voices = themes(d); const tags = tagCounts(d); const bench = opts.benchmarkOthers ? benchmark(ov.mean, opts.benchmarkOthers) : null;
  const findings = buildFindings({ ov, items, axes, drv, dyn, segs, voices, tags, bench, n: d.obs.length });
  return { kinds, n: d.obs.length, participants: d.obs.length, overall: ov, items, axes, drivers: drv, dyn, segs, heat: heatmap(d, heatCol, items), voices, tags, byKind, bench, findings, recs: recommend(findings, { items, axes, drv, dyn, segs, voices, tags }) };
}
function buildFindings(a: { ov: Desc; items: ItemStat[]; axes: AxisStat[]; drv: Driver[]; dyn: Dynamics; segs: Analysis['segs']; voices: ReturnType<typeof themes>; tags: ReturnType<typeof tagCounts>; bench: Benchmark | null; n: number }): Finding[] {
  const f: Finding[] = []; let i = 0; const id = () => `F${++i}`; const f2 = (x: number) => x.toFixed(2);
  if (a.n < 5) f.push({ id: id(), kind: 'quality', title: 'العيّنة صغيرة جدًّا', evidence: `${a.n} استجابات فقط — النتائج استرشادية ولا تصلح للتعميم.`, weight: 5, refs: [] });
  if (a.ov.n) f.push({ id: id(), kind: a.ov.mean >= TARGET ? 'strength' : a.ov.mean >= 3.7 ? 'signal' : 'gap', title: a.ov.mean >= TARGET ? 'الرضا العامّ فوق المستهدف' : a.ov.mean >= 3.7 ? 'الرضا العامّ جيّد دون المستهدف' : 'الرضا العامّ دون الجيّد', evidence: `المتوسّط ${f2(a.ov.mean)} من 5 (فاصل ثقة 95%: ${f2(a.ov.lo)}–${f2(a.ov.hi)}) · أعلى صندوقين ${a.ov.top2}% · أدنى صندوقين ${a.ov.bottom2}% · صافي الرضا ${a.ov.net}.`, weight: 4, refs: [] });
  for (const ax of a.axes.filter((x) => x.mean < 3.7 && x.n >= 5)) f.push({ id: id(), kind: ax.mean < 3 ? 'risk' : 'gap', title: `محور «${ax.axis}» دون الجيّد`, evidence: `${f2(ax.mean)} من 5 على ${ax.n} قياسًا · أدنى بنوده: «${ax.items[ax.items.length - 1].label}» (${f2(ax.items[ax.items.length - 1].mean)}).`, weight: ax.mean < 3 ? 5 : 3, refs: [ax.axis] });
  for (const it of a.items.filter((x) => x.mean < 3 && x.n >= 5).slice(0, 5)) f.push({ id: id(), kind: 'risk', title: `بند حرج: «${it.label}»`, evidence: `${f2(it.mean)} من 5 (n=${it.n}) · ${it.bottom2}% أعطوه 1–2.`, weight: 5, refs: [it.key] });
  for (const dr of a.drv.filter((x) => x.quadrant === 'fix_first').slice(0, 3)) f.push({ id: id(), kind: 'gap', title: `محرّك رضا يحتاج إصلاحًا: «${dr.label}»`, evidence: `ارتباطه بالرضا العامّ r=${dr.r} (مرتفع) بينما أداؤه ${f2(dr.mean)} (دون وسيط البنود) — تحسينه يرفع الرضا أكثر من غيره.`, weight: 4, refs: [dr.key] });
  const top = a.items.filter((x) => x.mean >= 4.5 && x.n >= 5).slice(0, 3); if (top.length) f.push({ id: id(), kind: 'strength', title: 'نقاط قوّة راسخة', evidence: top.map((t) => `«${t.label}» ${f2(t.mean)}`).join(' · ') + '.', weight: 2, refs: top.map((t) => t.key) });
  if (a.dyn.fatigue) f.push({ id: id(), kind: 'signal', title: 'تراجع في الثلث الأخير من البرنامج', evidence: `متوسّط الأيام الأولى ${f2(a.dyn.firstThird)} مقابل ${f2(a.dyn.lastThird)} في الأخيرة (ميل ${a.dyn.slope}/يوم)${a.dyn.worst ? ` · أسوأ يوم ${a.dyn.worst.date} (${f2(a.dyn.worst.mean)})` : ''}.`, weight: 3, refs: [] });
  else if (a.dyn.trend === 'up' && a.dyn.days.length >= 4) f.push({ id: id(), kind: 'strength', title: 'تحسّن مطّرد عبر الأيام', evidence: `ميل ${a.dyn.slope}/يوم من ${f2(a.dyn.firstThird)} إلى ${f2(a.dyn.lastThird)}.`, weight: 2, refs: [] });
  for (const an of a.dyn.anomalies.slice(0, 2)) f.push({ id: id(), kind: 'signal', title: `يوم شاذّ: ${an.date}`, evidence: `متوسّطه ${f2(an.mean)} (z=${an.z}) على ${an.n} قياسًا — ابحث عن سبب ظرفي (مدرّب بديل، تقنية، موضوع صعب).`, weight: 3, refs: [an.date] });
  for (const s of a.segs) if (s.gap?.significant) f.push({ id: id(), kind: 'gap', title: `فجوة دالّة بين ${SEG_AR[s.dim]}: «${s.gap.worst.label}» مقابل «${s.gap.best.label}»`, evidence: `${f2(s.gap.worst.mean)} مقابل ${f2(s.gap.best.mean)} · حجم الأثر d=${s.gap.d} · p=${s.gap.p}.`, weight: s.gap.d >= 0.8 ? 5 : 3, refs: [s.gap.worst.key] });
  for (const th of a.voices.themes.filter((t) => t.negative >= 3 && t.negative > t.positive).slice(0, 3)) f.push({ id: id(), kind: 'gap', title: `شكاوى متكرّرة حول «${th.label}»`, evidence: `${th.negative} تعليقات سلبية من ${th.count} (${th.share}% من التعليقات)${th.quotes[0] ? ` — مثال: «${th.quotes[0].text.slice(0, 90)}»` : ''}.`, weight: th.negative >= 6 ? 4 : 3, refs: [th.key] });
  for (const t of a.tags.filter((x) => x.pct >= 25).slice(0, 2)) f.push({ id: id(), kind: 'gap', title: `صعوبة شائعة: ${t.tag}`, evidence: `${t.count} مشاركًا (${t.pct}%) اختاروها.`, weight: t.pct >= 40 ? 4 : 3, refs: [t.tag] });
  for (const ax of a.axes.filter((x) => x.alpha != null && x.alpha < 0.6)) f.push({ id: id(), kind: 'quality', title: `ثبات منخفض لمحور «${ax.axis}»`, evidence: `ألفا كرونباخ ${ax.alpha} — بنود المحور لا تقيس الشيء نفسه؛ راجع الصياغة قبل الاستناد إلى متوسّطه.`, weight: 2, refs: [ax.axis] });
  if (a.bench) f.push({ id: id(), kind: a.bench.percentile >= 60 ? 'strength' : a.bench.percentile <= 30 ? 'gap' : 'signal', title: `الموقع بين البرامج: الترتيب ${a.bench.rank} من ${a.bench.of}`, evidence: `متوسّط البرنامج ${f2(a.bench.mean)} مقابل ${f2(a.bench.portfolioMean)} لمحفظة البرامج (المئين ${a.bench.percentile}).`, weight: 2, refs: [] });
  return f.sort((x, y) => y.weight - x.weight);
}
const OWNER: Record<ThemeKey | 'axis' | 'driver' | 'segment' | 'fatigue' | 'quality', { owner: string; days: number }> = { trainer: { owner: 'مدير التدريب', days: 14 }, content: { owner: 'المصمّم التعليمي', days: 30 }, time: { owner: 'منسّق البرنامج', days: 7 }, platform: { owner: 'الدعم التقني / الإدارة', days: 7 }, materials: { owner: 'المصمّم التعليمي', days: 21 }, organization: { owner: 'منسّق البرنامج', days: 7 }, application: { owner: 'المدرّب + المصمّم', days: 21 }, interaction: { owner: 'المدرّب', days: 7 }, assessment: { owner: 'المدرّب', days: 14 }, tech: { owner: 'الدعم التقني', days: 3 }, language: { owner: 'المدرّب + منسّق المستويات', days: 14 }, other: { owner: 'منسّق البرنامج', days: 14 }, axis: { owner: 'مدير الجودة', days: 21 }, driver: { owner: 'مدير التدريب', days: 21 }, segment: { owner: 'مدير التدريب', days: 14 }, fatigue: { owner: 'منسّق البرنامج', days: 7 }, quality: { owner: 'مدير الجودة', days: 30 } };
function recommend(findings: Finding[], a: { items: ItemStat[]; axes: AxisStat[]; drv: Driver[]; dyn: Dynamics; segs: Analysis['segs']; voices: ReturnType<typeof themes>; tags: ReturnType<typeof tagCounts> }): Recommendation[] {
  const recs: Recommendation[] = []; let i = 0; const push = (r: Omit<Recommendation, 'id' | 'priority'>) => recs.push({ ...r, id: `R${++i}`, priority: r.score >= 80 ? 'عاجلة' : r.score >= 60 ? 'عالية' : r.score >= 40 ? 'متوسّطة' : 'منخفضة' });
  const fx = (k: Finding['kind'], pred: (f: Finding) => boolean) => findings.filter((f) => f.kind === k && pred(f));
  for (const f of fx('risk', (x) => x.title.startsWith('بند حرج'))) { const it = a.items.find((x) => x.key === f.refs[0]); if (!it) continue; const th = themeOfText(it.label); const o = OWNER[th]; push({ title: `خطّة إصلاح فورية للبند «${it.label}»`, why: f.evidence, steps: ['حدّد السبب الجذري بجلسة قصيرة مع المدرّب والمنسّق (ما الذي حدث فعلًا؟)', 'قرّر تدخّلًا واحدًا قابلًا للقياس خلال الأسبوع (تعديل مادة/جدول/أداة)', 'أعد قياس البند نفسه في الدفعة أو الأسبوع التالي'], owner: o.owner, days: o.days, kpi: `متوسّط البند ≥ 3.7 في القياس التالي (الآن ${it.mean})`, score: 90, findings: [f.id] }); }
  for (const f of fx('gap', (x) => x.title.startsWith('محرّك رضا'))) { const dr = a.drv.find((x) => x.key === f.refs[0]); if (!dr) continue; const th = themeOfText(dr.label); push({ title: `استثمر في «${dr.label}» — أعلى عائد على الرضا`, why: f.evidence, steps: ['اجعل هذا البند هدف التحسين الأوّل للدفعة القادمة', 'اسأل 3–5 مشاركين عمّا ينقص فيه تحديدًا (مقابلة دقيقتين)', 'تابعه يوميًّا في التقييم اليومي حتى يتجاوز وسيط البنود'], owner: OWNER[th].owner, days: 21, kpi: `متوسّط البند ≥ ${Math.min(5, dr.mean + 0.5).toFixed(1)} وانتقاله إلى «حافِظ عليه»`, score: 78, findings: [f.id] }); }
  for (const f of fx('gap', (x) => x.title.startsWith('محور'))) { const ax = a.axes.find((x) => x.axis === f.refs[0]); if (!ax) continue; push({ title: `برنامج تحسين لمحور «${ax.axis}»`, why: f.evidence, steps: [`ابدأ بأدنى بندين: «${ax.items.slice(-2).map((x) => x.label).join('» و«')}»`, 'قارن المحور بين الفصول/المدرّبين لمعرفة إن كان المشكل عامًّا أم موضعيًّا', 'ضمّن المحور في مرآة المدرّب واتّفق على سلوكين ملموسين'], owner: OWNER.axis.owner, days: 21, kpi: `متوسّط المحور ≥ 3.7 (الآن ${ax.mean})`, score: ax.mean < 3 ? 85 : 65, findings: [f.id] }); }
  for (const f of fx('gap', (x) => x.title.startsWith('فجوة دالّة'))) { const seg = a.segs.find((s) => s.gap?.worst.key === f.refs[0]); if (!seg?.gap) continue; push({ title: `انقل ممارسات «${seg.gap.best.label}» إلى «${seg.gap.worst.label}»`, why: f.evidence, steps: ['جلسة تبادل خبرة 45 دقيقة بين الطرفين حول ما يفعله الأعلى تقييمًا', 'زيارة صفّية/حضور جلسة واحدة متبادلة', 'أعد قياس الفجوة بعد أسبوعين'], owner: OWNER.segment.owner, days: 14, kpi: `تقليص الفجوة إلى أقلّ من 0.3 نقطة (الآن ${(seg.gap.best.mean - seg.gap.worst.mean).toFixed(2)})`, score: seg.gap.d >= 0.8 ? 80 : 60, findings: [f.id] }); }
  for (const f of fx('signal', (x) => x.title.startsWith('تراجع'))) push({ title: 'أعد توزيع الطاقة على الثلث الأخير', why: f.evidence, steps: ['انقل الأنشطة التفاعلية الأقوى إلى الأيام الأخيرة', 'قصّر الجلسات النظرية في النصف الثاني وأضف استراحة إضافية', 'افتح اليوم الأخير بمراجعة ما تحقّق لا بمحتوى جديد'], owner: OWNER.fatigue.owner, days: 7, kpi: 'متوسّط الثلث الأخير ≥ متوسّط الثلث الأوّل − 0.1', score: 62, findings: [f.id] });
  for (const f of fx('gap', (x) => x.title.startsWith('شكاوى متكرّرة'))) { const th = a.voices.themes.find((t) => t.key === f.refs[0]); if (!th) continue; const o = OWNER[th.key]; push({ title: `عالج موضوع «${th.label}» الذي يتكرّر في التعليقات`, why: f.evidence, steps: th.requests.length ? [`استجب للطلبات الصريحة: ${th.requests.slice(0, 2).map((r) => `«${r.slice(0, 60)}»`).join('، ')}`, 'أبلغ المشاركين بما تغيّر (يرفع الثقة في الاستبيان نفسه)'] : ['اقرأ التعليقات الكاملة للموضوع وصنّفها إلى 2–3 أسباب', 'اختر السبب الأكثر تكرارًا وعالجه أوّلًا', 'أبلغ المشاركين بما تغيّر'], owner: o.owner, days: o.days, kpi: `انخفاض التعليقات السلبية في «${th.label}» إلى النصف`, score: th.negative >= 6 ? 70 : 55, findings: [f.id] }); }
  for (const f of fx('gap', (x) => x.title.startsWith('صعوبة شائعة'))) { const th = themeOfText(f.refs[0]); push({ title: `خفّف «${f.refs[0]}»`, why: f.evidence, steps: th === 'tech' ? ['أرسل دليل إعداد الاتصال/التطبيق قبل الدرس بيوم', 'سجّل الدروس وأتح التسجيل 7 أيام', 'خصّص قناة دعم فوري أثناء الدرس'] : th === 'language' ? ['أبطئ الإيقاع وأضف تلخيصًا مرئيًّا لكلّ 10 دقائق', 'استخدم لغة المشارك للتعليمات فقط لا للمحتوى', 'أضف قاموس مفردات الدرس مسبقًا'] : ['افهم السبب من 3 مشاركين', 'طبّق تعديلًا واحدًا في الدرس التالي', 'أعد السؤال بعد أسبوع'], owner: OWNER[th].owner, days: OWNER[th].days, kpi: `نسبة من يختارها < 15% (الآن ${a.tags.find((t) => t.tag === f.refs[0])?.pct ?? '—'}%)`, score: 58, findings: [f.id] }); }
  for (const f of fx('quality', (x) => x.title.startsWith('ثبات منخفض'))) push({ title: `راجع صياغة بنود محور «${f.refs[0]}»`, why: f.evidence, steps: ['افحص أيّ بند يضعف الثبات (احذفه تجريبيًّا وأعد الحساب)', 'أعد صياغته ليقيس سلوكًا واحدًا واضحًا', 'جرّبه في الدفعة القادمة قبل اعتماده'], owner: OWNER.quality.owner, days: 30, kpi: 'ألفا ≥ 0.7 في الدفعة القادمة', score: 35, findings: [f.id] });
  for (const f of fx('quality', (x) => x.title.startsWith('العيّنة'))) push({ title: 'ارفع معدّل الاستجابة قبل الاستناد إلى النتائج', why: f.evidence, steps: ['خصّص آخر 5 دقائق من الجلسة للاستبيان برمز QR على الشاشة', 'ذكّر عبر واتساب بعد الجلسة بساعة', 'اعرض للمشاركين ما تغيّر بفضل آرائهم'], owner: OWNER.organization.owner, days: 7, kpi: 'استجابات ≥ 70% من الحاضرين', score: 75, findings: [f.id] });
  const strengths = findings.filter((f) => f.kind === 'strength' && f.title === 'نقاط قوّة راسخة')[0]; if (strengths) push({ title: 'ثبّت نقاط القوّة واجعلها معيارًا', why: strengths.evidence, steps: ['وثّق ما يفعله المدرّب/المصمّم في هذه البنود بصفحة واحدة', 'استخدمها في تأهيل المدرّبين الجدد وفي التسويق للبرنامج'], owner: 'مدير الجودة', days: 30, kpi: 'بقاء البنود ≥ 4.5 في الدفعة القادمة', score: 30, findings: [strengths.id] });
  return recs.sort((x, y) => y.score - x.score).slice(0, 10);
}
export function themeOfText(s: string): ThemeKey { const hit = THEME_RE.find(([, re]) => re.test(s)); return hit ? hit[0] : 'other'; }

/* ────────────────────────────── مؤلّف التقرير ────────────────────────────── */
export type ChartSpec = { chart: 'radar' | 'bars' | 'dist' | 'line' | 'quadrant' | 'heat' | 'donut'; title: string; data: any };
export type RBlock = { type: 'p'; text: string } | { type: 'kpis'; items: { label: string; value: string; sub?: string; tone?: ItemStat['tone'] }[] } | { type: 'table'; head: string[]; rows: (string | number)[][] } | { type: 'list'; items: string[] } | { type: 'chart'; spec: ChartSpec } | { type: 'quotes'; items: { text: string; who: string }[] } | { type: 'recs'; items: Recommendation[] } | { type: 'findings'; items: Finding[] };
export type RSection = { id: string; title: string; blocks: RBlock[] };
export type Report = { title: string; program: string; subtitle: string; period: string; generated_at: string; audience: string; sections: RSection[] };
export type Depth = 'executive' | 'detailed' | 'comprehensive';
export const DEPTH_AR: Record<Depth, { label: string; reader: string; pages: string }> = { executive: { label: 'التقرير التنفيذي', reader: 'صانع القرار', pages: 'صفحتان' }, detailed: { label: 'التقرير التفصيلي', reader: 'مدير التدريب والجودة', pages: '6–8 صفحات' }, comprehensive: { label: 'التقرير الشامل', reader: 'ملفّ الاعتماد والجهة', pages: '10+ صفحات' } };
const f2 = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(2));
const verdict = (m: number) => (m >= 4.5 ? 'ممتاز' : m >= TARGET ? 'فوق المستهدف' : m >= 3.7 ? 'جيّد' : m >= 3 ? 'يحتاج متابعة' : 'حرج');
export function compose(a: Analysis, meta: { program: string; period: string; generatedAt: string; depth: Depth; trainers?: string[]; delivery?: string | null; attendanceNote?: string }): Report {
  const d = meta.depth; const S: RSection[] = []; const sec = (id: string, title: string, blocks: RBlock[]) => { if (blocks.length) S.push({ id, title, blocks }); };
  const kindsAr = a.kinds.map((k) => KIND_AR[k]).join(' + ');
  const lead = `خضع برنامج «${meta.program}» لـ${a.n} استجابة عبر ${kindsAr}${meta.period ? ` خلال ${meta.period}` : ''}. المتوسّط العامّ ${f2(a.overall.mean)} من 5 (${verdict(a.overall.mean)}؛ فاصل الثقة 95%: ${f2(a.overall.lo)}–${f2(a.overall.hi)})، وصافي الرضا ${a.overall.net} نقطة (${a.overall.top2}% راضون جدًّا مقابل ${a.overall.bottom2}% غير راضين).`;
  const topAx = a.axes[0], lowAx = a.axes[a.axes.length - 1];
  const second = a.axes.length ? ` أقوى المحاور «${topAx.axis}» (${f2(topAx.mean)}) وأضعفها «${lowAx.axis}» (${f2(lowAx.mean)})${a.drivers.find((x) => x.quadrant === 'fix_first') ? `، وأعلى عائد تحسين يكمن في «${a.drivers.find((x) => x.quadrant === 'fix_first')!.label}» لأنّه أشدّ البنود ارتباطًا بالرضا العامّ مع أداء دون الوسيط` : ''}.` : '';
  const third = a.dyn.days.length >= 3 ? ` عبر الأيام كان الاتجاه ${a.dyn.trend === 'up' ? 'صاعدًا' : a.dyn.trend === 'down' ? 'هابطًا' : 'مستقرًّا'} (ميل ${a.dyn.slope}/يوم)${a.dyn.fatigue ? ' مع تراجع واضح في الثلث الأخير' : ''}.` : '';
  const kp: RBlock = { type: 'kpis', items: [{ label: 'المتوسّط العامّ', value: f2(a.overall.mean), sub: `±${f2((a.overall.hi - a.overall.lo) / 2)} · مستهدف ${TARGET}`, tone: toneOf(a.overall.mean, a.overall.n) }, { label: 'صافي الرضا', value: String(a.overall.net), sub: `${a.overall.top2}% ↑ · ${a.overall.bottom2}% ↓`, tone: a.overall.net >= 60 ? 'ok' : a.overall.net >= 30 ? 'info' : 'warn' }, { label: 'الاستجابات', value: String(a.n), sub: a.byKind.map((k) => `${KIND_AR[k.kind].replace('التقييم ', '').replace('استبيان ', '').replace('الاستبيان ', '')} ${k.n}`).join(' · '), tone: a.n >= 20 ? 'ok' : a.n >= 5 ? 'info' : 'bad' }, { label: 'توصيات', value: String(a.recs.length), sub: a.recs[0] ? `أوّلها: ${a.recs[0].title.slice(0, 40)}` : '—', tone: a.recs.some((r) => r.priority === 'عاجلة') ? 'warn' : 'info' }] };
  sec('summary', 'الملخّص التنفيذي', [kp, { type: 'p', text: lead + second + third }, { type: 'findings', items: a.findings.slice(0, d === 'executive' ? 4 : 8) }, { type: 'chart', spec: { chart: 'radar', title: 'المحاور', data: a.axes.map((x) => ({ label: x.axis, value: x.mean, n: x.n })) } }]);
  if (d !== 'executive') sec('method', 'المنهجية والبيانات', [{ type: 'table', head: ['نوع الاستبيان', 'الاستجابات', 'المتوسّط', 'فاصل الثقة', 'أعلى بند', 'أدنى بند'], rows: a.byKind.map((k) => [KIND_AR[k.kind], k.n, f2(k.desc.mean), `${f2(k.desc.lo)}–${f2(k.desc.hi)}`, k.top ? `${k.top.label} (${f2(k.top.mean)})` : '—', k.low ? `${k.low.label} (${f2(k.low.mean)})` : '—']) }, { type: 'p', text: `مقياس 1–5 (في استبيان التعلّم عن بُعد: أوافق بشدّة=5 … لا أوافق بشدّة=1، و«لا ينطبق» تُستبعد). المستهدف المؤسّسي ${TARGET}. فواصل الثقة بتوزيع t عند 95%. الثبات بألفا كرونباخ لكلّ محور. محرّكات الرضا بارتباط بيرسون مع ${overallLabel(a)}. الفروق بين الشرائح باختبار Welch وحجم الأثر Cohen d (دلالة عند p<0.05 وd≥0.3). المواضيع من تصنيف قواعدي للتعليقات مع تحليل مشاعر معجمي؛ كلّ حكم آليّ قابل للمراجعة البشرية.${meta.attendanceNote ? ' ' + meta.attendanceNote : ''}` }]);
  sec('axes', 'المحاور', [{ type: 'chart', spec: { chart: 'bars', title: 'متوسّط المحاور مع فاصل الثقة', data: a.axes.map((x) => ({ label: x.axis, value: x.mean, lo: x.lo, hi: x.hi, n: x.n })) } }, { type: 'table', head: ['المحور', 'n', 'المتوسّط', 'فاصل 95%', 'أعلى صندوقين', 'أدنى صندوقين', 'الثبات α'], rows: a.axes.map((x) => [x.axis, x.n, f2(x.mean), `${f2(x.lo)}–${f2(x.hi)}`, `${x.top2}%`, `${x.bottom2}%`, x.alpha == null ? '—' : `${x.alpha} (${x.alphaLabel})`]) }]);
  const itemRows = (d === 'executive' ? [...a.items.slice(0, 3), ...a.items.slice(-3)] : a.items);
  sec('items', d === 'executive' ? 'أعلى وأدنى البنود' : 'البنود بالتفصيل', [{ type: 'chart', spec: { chart: 'dist', title: 'توزيع الإجابات لكلّ بند', data: itemRows.map((i) => ({ label: i.label, dist: i.dist, mean: i.mean, n: i.n })) } }, ...(d !== 'executive' ? [{ type: 'table', head: ['#', 'البند', 'المحور', 'n', 'المتوسّط', 'فاصل 95%', '↑%', '↓%', 'الحكم'], rows: a.items.map((i) => [i.rank, i.label, i.axis, i.n, f2(i.mean), `${f2(i.lo)}–${f2(i.hi)}`, `${i.top2}`, `${i.bottom2}`, verdict(i.mean)]) } as RBlock] : [])]);
  if (a.dyn.days.length >= 3) sec('dynamics', 'الديناميكا اليومية', [{ type: 'chart', spec: { chart: 'line', title: 'المتوسّط اليومي مع نطاق الثقة', data: a.dyn.days } }, { type: 'p', text: `الاتجاه ${a.dyn.trend === 'up' ? 'صاعد' : a.dyn.trend === 'down' ? 'هابط' : 'مستقرّ'} (ميل ${a.dyn.slope} نقطة/يوم). أفضل يوم ${a.dyn.best?.date} (${f2(a.dyn.best?.mean)}) وأدناه ${a.dyn.worst?.date} (${f2(a.dyn.worst?.mean)}).${a.dyn.fatigue ? ` الثلث الأخير (${f2(a.dyn.lastThird)}) أدنى من الأوّل (${f2(a.dyn.firstThird)}) بأكثر من 0.2 — إشارة إرهاق تستحقّ إعادة توزيع الأنشطة.` : ''}${a.dyn.anomalies.length ? ` أيام شاذّة: ${a.dyn.anomalies.map((x) => `${x.date} (z=${x.z})`).join('، ')}.` : ''}` }, ...(d === 'comprehensive' && a.heat.cols.length >= 2 ? [{ type: 'chart', spec: { chart: 'heat', title: 'خريطة حرارية: المحور × اليوم/الفصل', data: a.heat } } as RBlock] : [])]);
  if (a.drivers.length >= 4 && d !== 'executive') sec('drivers', 'محرّكات الرضا (الأهمّية × الأداء)', [{ type: 'chart', spec: { chart: 'quadrant', title: 'مصفوفة الأهمّية/الأداء', data: a.drivers } }, { type: 'table', head: ['البند', 'الارتباط بالرضا r', 'الأداء', 'n', 'القرار'], rows: a.drivers.map((x) => [x.label, x.r, f2(x.mean), x.n, QUADRANT_AR[x.quadrant]]) }, { type: 'p', text: 'كيف تقرأها: البنود في «أصلِح أوّلًا» أشدّ ارتباطًا بالرضا العامّ لكنّ أداءها دون الوسيط — كلّ نقطة تحسين فيها تعود بأكبر أثر. «حافِظ عليه» مصدر قوّتك الحالي. «فائض جهد» أداء مرتفع لبنود لا تحرّك الرضا كثيرًا — لا تستثمر فيها أكثر.' }]);
  const segBlocks: RBlock[] = []; for (const s of a.segs) { if (s.dim === 'kind' && d === 'executive') continue; segBlocks.push({ type: 'table', head: [SEG_AR[s.dim], 'استجابات', 'المتوسّط', 'فاصل 95%', '↑%'], rows: s.rows.map((r) => [r.label, r.responses, f2(r.mean), `${f2(r.lo)}–${f2(r.hi)}`, `${r.top2}`]) }); if (s.gap) segBlocks.push({ type: 'p', text: `${s.gap.significant ? 'فجوة دالّة إحصائيًّا' : 'لا فجوة دالّة'} بين «${s.gap.best.label}» (${f2(s.gap.best.mean)}) و«${s.gap.worst.label}» (${f2(s.gap.worst.mean)}): d=${s.gap.d}، t=${s.gap.t}، p=${s.gap.p}.` }); }
  if (segBlocks.length && d !== 'executive') sec('segments', 'المقارنات بين الشرائح', segBlocks);
  const vb: RBlock[] = []; if (a.voices.total) { vb.push({ type: 'chart', spec: { chart: 'donut', title: `مواضيع ${a.voices.total} تعليقًا`, data: a.voices.themes.map((t) => ({ label: t.label, value: t.count, negative: t.negative, positive: t.positive })) } }); vb.push({ type: 'table', head: ['الموضوع', 'التعليقات', 'إيجابي', 'سلبي', 'الحصّة'], rows: a.voices.themes.map((t) => [t.label, t.count, t.positive, t.negative, `${t.share}%`]) }); const q = a.voices.themes.flatMap((t) => t.quotes.map((x) => ({ text: x.text, who: `${t.label} · ${x.sentiment === 'negative' ? 'ملاحظة' : x.sentiment === 'positive' ? 'إشادة' : 'رأي'}` }))).slice(0, d === 'executive' ? 3 : 9); if (q.length) vb.push({ type: 'quotes', items: q }); if (a.voices.requests.length && d !== 'executive') vb.push({ type: 'list', items: a.voices.requests.map((r) => `طلب صريح: ${r}`) }); }
  if (a.tags.length) vb.push({ type: 'table', head: ['الصعوبة المختارة', 'العدد', 'النسبة'], rows: a.tags.map((t) => [t.tag, t.count, `${t.pct}%`]) });
  sec('voices', 'أصوات المشاركين', vb);
  sec('recs', 'التوصيات وخطّة العمل', [{ type: 'recs', items: a.recs.slice(0, d === 'executive' ? 4 : 10) }]);
  if (d === 'comprehensive') sec('quality', 'الجودة الإحصائية والحدود', [{ type: 'list', items: [`حجم العيّنة ${a.n} استجابة؛ ${a.n < 5 ? 'دون الحدّ الأدنى (5) — النتائج استرشادية.' : a.n < 20 ? 'كافٍ للاتجاهات لا للفروق الدقيقة.' : 'كافٍ للاستدلال على مستوى البرنامج.'}`, ...a.axes.map((x) => `ثبات «${x.axis}»: ${x.alpha == null ? 'غير محسوب' : `α=${x.alpha} (${x.alphaLabel})`}`), 'تحليل المشاعر والمواضيع قواعديّ (معجمي) لا نموذج لغوي — دقّته جيّدة للعربية الفصحى والعامية الشائعة ويُراجَع بشريًّا عند الحسم.', 'الفروق بين الشرائح وصفية؛ الدلالة الإحصائية لا تعني سببية.', a.bench ? `المرجعية: الترتيب ${a.bench.rank} من ${a.bench.of} برنامجًا (المئين ${a.bench.percentile}).` : 'لا مرجعية بين البرامج في هذا النطاق.'] }, { type: 'findings', items: a.findings }]);
  return { title: DEPTH_AR[d].label, program: meta.program, subtitle: `${kindsAr}${meta.delivery ? ` · ${meta.delivery}` : ''}${meta.trainers?.length ? ` · ${meta.trainers.join('، ')}` : ''}`, period: meta.period, generated_at: meta.generatedAt, audience: DEPTH_AR[d].reader, sections: S };
}
function overallLabel(a: Analysis): string { const k = a.items.find((i) => i.key === SATISFACTION_KEY) || a.items.find((i) => /(رضا|راضٍ|بشكل عام|أوصي|overall|recommend|satisf)/i.test(i.label)); return k ? `بند «${k.label}»` : 'متوسّط بقيّة البنود'; }
/** نصّ خام (للنسخ/البريد) من المستند. */
export function reportText(r: Report): string { const L: string[] = [`${r.title} — ${r.program}`, r.subtitle, r.period, '']; for (const s of r.sections) { L.push(`## ${s.title}`); for (const b of s.blocks) { if (b.type === 'p') L.push(b.text); else if (b.type === 'kpis') L.push(b.items.map((i) => `${i.label}: ${i.value}`).join(' · ')); else if (b.type === 'table') { L.push(b.head.join(' | ')); for (const row of b.rows) L.push(row.join(' | ')); } else if (b.type === 'list') for (const i of b.items) L.push(`• ${i}`); else if (b.type === 'quotes') for (const q of b.items) L.push(`«${q.text}» — ${q.who}`); else if (b.type === 'findings') for (const f of b.items) L.push(`${f.id} ${f.title}: ${f.evidence}`); else if (b.type === 'recs') for (const x of b.items) L.push(`${x.id} [${x.priority}] ${x.title} — ${x.owner} خلال ${x.days} يومًا — مؤشّر: ${x.kpi}`); } L.push(''); } return L.join('\n'); }
