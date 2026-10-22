/**
 * تحليلات قياس الأثر (قبلي/بعدي) — دوال صافية بلا اعتماديات
 * Paired pre/post analytics: gains, Hake normalized gain, Cohen's d, paired t-test.
 */
import type { ImpactQuestion, ImpactResponse, Phase } from './model';

export type Paired = { hash: string; label: string; gender: string | null; pre: ImpactResponse; post: ImpactResponse; gain: number };

export type Stat = { n: number; mean: number | null; sd: number | null; min: number | null; max: number | null };

export type ImpactSummary = {
  nPre: number; nPost: number; nPaired: number;
  pre: Stat; post: Stat;              // الدرجة الموحدة 0..100 للأزواج فقط
  preAll: Stat; postAll: Stat;        // كل الاستجابات (غير مزدوجة)
  gain: number | null;                // فرق المتوسطات (نقاط من 100)
  gainPct: number | null;             // نسبة التغير %
  hake: number | null;                // الكسب المعياري (post-pre)/(100-pre)
  cohenD: number | null;              // حجم الأثر للأزواج (d_z)
  t: number | null; df: number; p: number | null;
  improved: number; same: number; declined: number;
  verdict: { key: 'high' | 'medium' | 'low' | 'none' | 'na'; ar: string; color: string };
};

export type QuestionStat = {
  q: ImpactQuestion; nPairs: number; pre: number | null; post: number | null; gain: number | null; hake: number | null;
  /** للأسئلة المعرفية: نسبة الصواب قبل/بعد؛ للمقياس: المتوسط */
  unit: 'scale' | 'pct';
};

export type DomainStat = { domain: string; nItems: number; pre: number | null; post: number | null; gain: number | null; hake: number | null; unit: 'scale' | 'pct' };

export type Bucket = { label: string; from: number; to: number; pre: number; post: number };

const r2 = (x: number) => Math.round(x * 100) / 100;

export function stat(xs: number[]): Stat {
  const v = xs.filter(x => Number.isFinite(x));
  if (!v.length) return { n: 0, mean: null, sd: null, min: null, max: null };
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 0;
  return { n: v.length, mean: r2(m), sd: r2(sd), min: Math.min(...v), max: Math.max(...v) };
}

/** الكسب المعياري (Hake): (post − pre) / (max − pre) */
export function hakeGain(pre: number | null, post: number | null, max = 100): number | null {
  if (pre === null || post === null) return null;
  const room = max - pre;
  if (room <= 0) return post >= pre ? 0 : null;
  return Math.round(((post - pre) / room) * 1000) / 1000;
}

export function hakeLabel(g: number | null): { key: 'high' | 'medium' | 'low' | 'none' | 'na'; ar: string; color: string } {
  if (g === null || !Number.isFinite(g)) return { key: 'na', ar: 'لا تتوفر بيانات مزدوجة كافية', color: '#64748b' };
  if (g >= 0.7) return { key: 'high', ar: 'أثر مرتفع', color: '#047857' };
  if (g >= 0.3) return { key: 'medium', ar: 'أثر متوسط', color: '#0b8a83' };
  if (g > 0) return { key: 'low', ar: 'أثر منخفض', color: '#b45309' };
  return { key: 'none', ar: 'لا يوجد أثر ملموس', color: '#b91c1c' };
}

export function cohenLabel(d: number | null): string {
  if (d === null) return '—';
  const a = Math.abs(d);
  if (a >= 0.8) return 'كبير'; if (a >= 0.5) return 'متوسط'; if (a >= 0.2) return 'صغير'; return 'ضئيل';
}

/* ----------------------------------------------------------------------------
 * توزيع t (طالب) — دالة التوزيع التراكمي عبر دالة بيتا الناقصة المنتظمة
 * ------------------------------------------------------------------------- */
function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
/** regularized incomplete beta I_x(a,b) */
export function betaInc(a: number, b: number, x: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}
/** two-tailed p-value for Student t with df */
export function tTestP(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return 1;
  const x = df / (df + t * t);
  return Math.min(1, Math.max(0, betaInc(df / 2, 0.5, x)));
}

/* ----------------------------------------------------------------------------
 * الاقتران والملخص
 * ------------------------------------------------------------------------- */
export function pairResponses(rows: ImpactResponse[]): Paired[] {
  const pre = new Map<string, ImpactResponse>(), post = new Map<string, ImpactResponse>();
  for (const r of rows) (r.phase === 'pre' ? pre : post).set(r.respondent_hash, r);
  const out: Paired[] = [];
  pre.forEach((p, h) => {
    const q = post.get(h);
    if (q && p.score !== null && q.score !== null) out.push({ hash: h, label: q.respondent_label || p.respondent_label || '…', gender: q.gender || p.gender, pre: p, post: q, gain: r2(Number(q.score) - Number(p.score)) });
  });
  return out.sort((a, b) => b.gain - a.gain);
}

export function summarize(rows: ImpactResponse[]): ImpactSummary {
  const pairs = pairResponses(rows);
  const preAll = stat(rows.filter(r => r.phase === 'pre').map(r => Number(r.score)));
  const postAll = stat(rows.filter(r => r.phase === 'post').map(r => Number(r.score)));
  const pre = stat(pairs.map(p => Number(p.pre.score))), post = stat(pairs.map(p => Number(p.post.score)));
  const diffs = pairs.map(p => p.gain);
  const d = stat(diffs);
  const gain = pre.mean !== null && post.mean !== null ? r2(post.mean - pre.mean) : null;
  const gainPct = gain !== null && pre.mean ? r2((gain / pre.mean) * 100) : null;
  const hake = hakeGain(pre.mean, post.mean);
  const cohenD = d.n > 1 && d.sd && d.sd > 0 ? r2((d.mean || 0) / d.sd) : (d.n > 1 && d.mean ? (d.mean > 0 ? 9.99 : -9.99) : null);
  const t = d.n > 1 && d.sd && d.sd > 0 ? r2(((d.mean || 0) / d.sd) * Math.sqrt(d.n)) : null;
  const df = Math.max(0, d.n - 1);
  const p = t !== null ? Math.round(tTestP(t, df) * 10000) / 10000 : null;
  return {
    nPre: preAll.n, nPost: postAll.n, nPaired: pairs.length, pre, post, preAll, postAll, gain, gainPct, hake, cohenD, t, df, p,
    improved: diffs.filter(x => x > 0.5).length, same: diffs.filter(x => Math.abs(x) <= 0.5).length, declined: diffs.filter(x => x < -0.5).length,
    verdict: hakeLabel(pairs.length >= 3 ? hake : null),
  };
}

function qValue(q: ImpactQuestion, r: ImpactResponse): number | null {
  const v = r.answers?.[q.id];
  if (v === undefined || v === null || v === '') return null;
  if (q.kind === 'scale') return Number(v);
  return q.correct_key && String(v) === q.correct_key ? 100 : 0;
}

export function questionStats(questions: ImpactQuestion[], rows: ImpactResponse[], scaleMax: number): QuestionStat[] {
  const pairs = pairResponses(rows);
  return [...questions].sort((a, b) => a.order_no - b.order_no).map(q => {
    const pre: number[] = [], post: number[] = [];
    for (const p of pairs) { const a = qValue(q, p.pre), b = qValue(q, p.post); if (a !== null && b !== null) { pre.push(a); post.push(b); } }
    const sp = stat(pre), so = stat(post);
    const max = q.kind === 'scale' ? scaleMax : 100;
    return { q, nPairs: pre.length, pre: sp.mean, post: so.mean, gain: sp.mean !== null && so.mean !== null ? r2(so.mean - sp.mean) : null, hake: hakeGain(sp.mean, so.mean, max), unit: q.kind === 'scale' ? 'scale' : 'pct' };
  });
}

export function domainStats(qs: QuestionStat[], scaleMax = 5): DomainStat[] {
  const m = new Map<string, QuestionStat[]>();
  for (const s of qs) { const k = s.q.domain_ar || 'عام'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(s); }
  return Array.from(m.entries()).map(([domain, items]) => {
    const scaleItems = items.filter(i => i.unit === 'scale' && i.pre !== null);
    const use = scaleItems.length ? scaleItems : items.filter(i => i.pre !== null);
    const unit: 'scale' | 'pct' = scaleItems.length ? 'scale' : 'pct';
    const avg = (f: (i: QuestionStat) => number | null) => { const v = use.map(f).filter((x): x is number => x !== null); return v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const pre = avg(i => i.pre), post = avg(i => i.post);
    return { domain, nItems: items.length, pre, post, gain: pre !== null && post !== null ? r2(post - pre) : null, hake: hakeGain(pre, post, unit === 'scale' ? scaleMax : 100), unit };
  }).sort((a, b) => (b.gain || 0) - (a.gain || 0));
}

export function buckets(rows: ImpactResponse[]): Bucket[] {
  const defs: Bucket[] = [
    { label: 'أقل من 40', from: 0, to: 40, pre: 0, post: 0 }, { label: '40–59', from: 40, to: 60, pre: 0, post: 0 },
    { label: '60–74', from: 60, to: 75, pre: 0, post: 0 }, { label: '75–89', from: 75, to: 90, pre: 0, post: 0 }, { label: '90–100', from: 90, to: 101, pre: 0, post: 0 },
  ];
  for (const r of rows) { const s = Number(r.score); if (!Number.isFinite(s)) continue; const b = defs.find(d => s >= d.from && s < d.to); if (b) b[r.phase as Phase]++; }
  return defs;
}

/** سرد تفسيري قصير بالعربية */
export function narrative(s: ImpactSummary, title: string): string[] {
  const out: string[] = [];
  if (s.nPaired < 3) { out.push(`لا تتوفر بعد استجابات مزدوجة كافية (قبلي وبعدي لنفس المتدرب) لأداة «${title}». القياس القبلي: ${s.nPre} · البعدي: ${s.nPost} · المزدوج: ${s.nPaired}.`); return out; }
  out.push(`شارك ${s.nPaired} متدربًا في القياسين؛ ارتفع المتوسط من ${s.pre.mean} إلى ${s.post.mean} من 100 (${s.gain! >= 0 ? '+' : ''}${s.gain} نقطة، ${s.gainPct}%).`);
  out.push(`الكسب المعياري (Hake g) = ${s.hake?.toFixed(2)} → ${s.verdict.ar}؛ حجم الأثر (Cohen's d) = ${s.cohenD} (${cohenLabel(s.cohenD)}).`);
  if (s.p !== null) out.push(s.p < 0.05 ? `الفرق دال إحصائيًا (t = ${s.t}, df = ${s.df}, p = ${s.p < 0.001 ? '< 0.001' : s.p}).` : `الفرق غير دال إحصائيًا عند مستوى 0.05 (t = ${s.t}, p = ${s.p}) — يُنصح بزيادة العينة أو مراجعة الأداة.`);
  out.push(`تحسّن ${s.improved} متدربًا، وثبت ${s.same}، وتراجع ${s.declined}.`);
  return out;
}
