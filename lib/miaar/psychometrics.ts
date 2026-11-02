// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — من أَثَر · م3 «ميزان مِعيار» — الرياضيات فقط (بلا قاعدة بيانات، بلا مكتبات)
 *  · تحليل البنود بالنظرية الكلاسيكية: الصعوبة p · التمييز r-pb (ارتباط البند بباقي كتلة مستواه) · حصص المشتِّتات · الأعلام بلغة الإنسان
 *  · موثوقية الكتلة/النموذج: ألفا (KR-20) للنماذج الثابتة · KR-21 (تقدير متحفّظ) للسحب العشوائي · SEM · ثبات القرار عند حدّ الاجتياز (Livingston)
 *  · المعايرة: نموذج راش (1PL) بتقدير JMLE مع تصحيح الانحياز وملاءمة infit/outfit · إسقاط السلّم على CEFR واقتراح نقل البند
 *  كل الدوال نقية وقابلة للاختبار؛ لا تعرف الأسماء ولا البريد — تعمل على معرّفات فقط.
 */

export type Response = { session: string; item: string; correct: 0 | 1; selected: string; level: string; ms?: number | null };

export const MIN_N_ITEM = 30;         /* لا أرقام قبل 30 إجابة للبند */
export const MIN_N_CALIB = 100;       /* لا معايرة معتمدة قبل 100 إجابة */
export const MIN_N_FORM = 30;         /* لا موثوقية قبل 30 جلسة */

/* ───────────── أدوات ───────────── */
export const mean = (a: readonly number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const variance = (a: readonly number[]) => { if (a.length < 2) return 0; const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
export const median = (a: readonly number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
export function pearson(x: readonly number[], y: readonly number[]): number {
  const n = Math.min(x.length, y.length); if (n < 3) return 0;
  const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n)); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i += 1) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/* ───────────── تحليل البنود (CTT) ───────────── */
export type ItemStat = {
  item: string; level: string; n: number; p: number; rpb: number; distractors: Record<string, number>; median_ms: number | null; flags: string[];
};
export type FlagCode = 'too_easy' | 'too_hard' | 'no_discrimination' | 'negative_discrimination' | 'dead_distractor' | 'distractor_beats_key' | 'collecting';
export const FLAG_AR: Record<FlagCode, string> = {
  too_easy: 'سهل جدًا لمستواه', too_hard: 'صعب جدًا لمستواه', no_discrimination: 'لا يميّز بين من يعرف ومن لا يعرف',
  negative_discrimination: 'يميّز عكسيًا — راجع المفتاح أو الصياغة', dead_distractor: 'مشتِّت ميت (لا يختاره أحد)',
  distractor_beats_key: 'مشتِّت أقوى من المفتاح — خطأ محتمل في المفتاح!', collecting: 'ما زال يجمع إجابات',
};
export const FLAG_SEVERITY: Record<FlagCode, 1 | 2 | 3> = { distractor_beats_key: 3, negative_discrimination: 3, no_discrimination: 2, too_easy: 1, too_hard: 2, dead_distractor: 1, collecting: 0 as any };

/**
 * إحصاءات كل بند. r-pb = ارتباط صواب البند بـ «درجة باقي كتلة المستوى» في الجلسة نفسها (تصحيح الذات).
 * correctKey: مفتاح كل بند (لحصص المشتِّتات). distractor thresholds: ميت < 3% · أقوى من المفتاح = حصته > حصة المفتاح وn ≥ MIN_N_ITEM.
 */
export function itemStats(responses: readonly Response[], correctKey: ReadonlyMap<string, string>): ItemStat[] {
  const bySession = new Map<string, Response[]>(); for (const r of responses) { const a = bySession.get(r.session) || []; a.push(r); bySession.set(r.session, a); }
  const byItem = new Map<string, Response[]>(); for (const r of responses) { const a = byItem.get(r.item) || []; a.push(r); byItem.set(r.item, a); }
  const out: ItemStat[] = [];
  for (const [item, rs] of byItem) {
    const n = rs.length; const p = mean(rs.map((r) => r.correct));
    const xs: number[] = []; const rests: number[] = [];
    for (const r of rs) {
      const block = (bySession.get(r.session) || []).filter((q) => q.level === r.level && q.item !== item);
      if (block.length < 2) continue; xs.push(r.correct); rests.push(block.reduce((s, q) => s + q.correct, 0) / block.length);
    }
    const rpb = xs.length >= 10 ? pearson(xs, rests) : 0;
    const dist: Record<string, number> = {}; for (const r of rs) dist[r.selected] = (dist[r.selected] || 0) + 1; for (const k of Object.keys(dist)) dist[k] = r3(dist[k] / n);
    const times = rs.map((r) => r.ms).filter((v): v is number => typeof v === 'number' && v > 0);
    const key = correctKey.get(item) || ''; const flags: string[] = [];
    if (n < MIN_N_ITEM) flags.push('collecting');
    else {
      if (p > 0.9) flags.push('too_easy'); if (p < 0.25) flags.push('too_hard');
      if (rpb < 0) flags.push('negative_discrimination'); else if (rpb < 0.15) flags.push('no_discrimination');
      for (const [opt, share] of Object.entries(dist)) { if (opt === key) continue; if (share > (dist[key] || 0)) { flags.push('distractor_beats_key'); break; } }
      if (Object.keys(dist).length >= 3 && Object.entries(dist).some(([opt, share]) => opt !== key && share < 0.03)) flags.push('dead_distractor');
    }
    out.push({ item, level: rs[0].level, n, p: r3(p), rpb: r3(rpb), distractors: dist, median_ms: times.length ? Math.round(median(times)) : null, flags });
  }
  return out.sort((a, b) => b.n - a.n);
}

/* ───────────── موثوقية الكتلة ───────────── */
/** ألفا كرونباخ (= KR-20 للثنائي) على مصفوفة كاملة: صفوف = جلسات، أعمدة = البنود نفسها */
export function alpha(matrix: readonly (readonly number[])[]): number {
  const n = matrix.length; if (n < 2) return 0; const k = matrix[0]?.length || 0; if (k < 2) return 0;
  const itemVar = Array.from({ length: k }, (_, j) => variance(matrix.map((row) => row[j])));
  const total = matrix.map((row) => row.reduce((s, x) => s + x, 0)); const vt = variance(total); if (vt <= 0) return 0;
  return Math.max(0, Math.min(1, (k / (k - 1)) * (1 - itemVar.reduce((s, v) => s + v, 0) / vt)));
}
/** KR-21: تقدير متحفّظ من متوسط وتباين الدرجات الخام حين تختلف البنود بين الجلسات ويتساوى عددها k */
export function kr21(scores: readonly number[], k: number): number {
  if (scores.length < 2 || k < 2) return 0; const m = mean(scores); const v = variance(scores); if (v <= 0) return 0;
  return Math.max(0, Math.min(1, (k / (k - 1)) * (1 - (m * (k - m)) / (k * v))));
}
export const sem = (sd: number, rel: number) => sd * Math.sqrt(Math.max(0, 1 - rel));
/** ثبات القرار عند حدّ الاجتياز (Livingston K²) — درجات خام وحدّ خام */
export function livingston(scores: readonly number[], cut: number, rel: number): number {
  if (scores.length < 2) return 0; const m = mean(scores); const v = variance(scores); const d = (m - cut) ** 2;
  const den = v + d; return den > 0 ? Math.max(0, Math.min(1, (rel * v + d) / den)) : 0;
}
export type Light = 'green' | 'yellow' | 'red' | 'gray';
export const LIGHT_AR: Record<Light, string> = { green: 'موثوقية معتمدة', yellow: 'موثوقية مقبولة — تحتاج تعزيزًا', red: 'موثوقية غير كافية — النتائج إرشادية', gray: 'ما زال يُعايَر — لا حكم بعد' };
export function light(rel: number, n: number): Light { if (n < MIN_N_FORM) return 'gray'; if (rel >= 0.8 && n >= 100) return 'green'; if (rel >= 0.7 && n >= 50) return 'yellow'; return 'red'; }
/** ما الذي يلزم للضوء التالي؟ نصّ للمعدّ */
export function lightAdvice(rel: number, n: number, k: number): string {
  if (n < MIN_N_FORM) return `يلزم ${MIN_N_FORM - n} جلسة أخرى قبل أول حكم.`;
  const parts: string[] = [];
  if (rel < 0.8) { const need = Math.ceil(k * ((0.8 / (1 - 0.8)) / Math.max(0.05, rel / (1 - rel)))); parts.push(`الموثوقية ${rel.toFixed(2)}: استبدل البنود ضعيفة التمييز، أو ارفع عدد البنود إلى نحو ${Math.min(60, Math.max(k + 2, need))} (Spearman-Brown).`); }
  if (n < 100) parts.push(`العيّنة ${n}: يلزم ${100 - n} جلسة أخرى للاعتماد.`);
  return parts.join(' ') || 'مستوفٍ.';
}

export type FormReliability = { scope: string; n: number; k: number; method: 'alpha' | 'kr21'; rel: number; mean: number; sd: number; sem: number; cut: number; pass_rate: number; livingston: number; light: Light; advice: string };
/**
 * موثوقية كتلة مستوى (أو نموذج ثابت): sessions = لكل جلسة قائمة بنودها (معرّف+صواب) داخل الكتلة. cutPercent = حدّ الاجتياز.
 * إن اشتركت ≥ MIN_N_FORM جلسة في مجموعة البنود نفسها → ألفا على أكبر مجموعة؛ وإلا KR-21 على كل الجلسات ذات k الأكثر شيوعًا.
 */
export function formReliability(scope: string, sessions: readonly { items: readonly { item: string; correct: 0 | 1 }[] }[], cutPercent: number): FormReliability {
  const sigs = new Map<string, { rows: number[][]; k: number }>();
  for (const s of sessions) { if (!s.items.length) continue; const sorted = [...s.items].sort((a, b) => a.item.localeCompare(b.item)); const sig = sorted.map((i) => i.item).join('|'); const g = sigs.get(sig) || { rows: [], k: sorted.length }; g.rows.push(sorted.map((i) => i.correct)); sigs.set(sig, g); }
  const biggest = [...sigs.values()].sort((a, b) => b.rows.length - a.rows.length)[0];
  const kCount = new Map<number, number>(); for (const s of sessions) if (s.items.length) kCount.set(s.items.length, (kCount.get(s.items.length) || 0) + 1);
  const kMode = [...kCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  let method: 'alpha' | 'kr21' = 'kr21'; let rel = 0; let scores: number[]; let k = kMode;
  if (biggest && biggest.rows.length >= MIN_N_FORM) { method = 'alpha'; rel = alpha(biggest.rows); scores = biggest.rows.map((r) => r.reduce((a, b) => a + b, 0)); k = biggest.k; }
  else { scores = sessions.filter((s) => s.items.length === kMode).map((s) => s.items.reduce((a, i) => a + i.correct, 0)); rel = kr21(scores, kMode); }
  const n = scores.length; const m = mean(scores); const sd = Math.sqrt(variance(scores)); const cut = (cutPercent / 100) * k;
  const pass = n ? scores.filter((s) => s >= cut - 1e-9).length / n : 0;
  return { scope, n, k, method, rel: r3(rel), mean: r3(m), sd: r3(sd), sem: r3(sem(sd, rel)), cut: r3(cut), pass_rate: r3(pass), livingston: r3(livingston(scores, cut, rel)), light: light(rel, n), advice: lightAdvice(rel, n, k) };
}

/* ───────────── راش (1PL) ───────────── */
export type RaschItem = { item: string; n: number; b: number; se: number; infit: number; outfit: number };
export type RaschResult = { items: RaschItem[]; persons: number; iterations: number; converged: boolean };
/**
 * JMLE: يتناوب تقدير قدرات الأشخاص وصعوبات البنود (نيوتن-رافسون) حتى يقلّ أكبر تغيّر عن 0.001 أو 60 دورة.
 * يُسقط الأشخاص ذوي الدرجات الطرفية (كل صواب/كل خطأ) والبنود الطرفية؛ يُركّز متوسط الصعوبات على صفر؛ تصحيح الانحياز (k-1)/k.
 */
export function rasch(responses: readonly Response[], minN = 10): RaschResult {
  const items = [...new Set(responses.map((r) => r.item))]; const persons = [...new Set(responses.map((r) => r.session))];
  const iIdx = new Map(items.map((x, i) => [x, i])); const pIdx = new Map(persons.map((x, i) => [x, i]));
  /* مصفوفة متفرّقة */
  const cells: { p: number; i: number; x: number }[] = []; const seen = new Set<string>();
  for (const r of responses) { const key = r.session + '\u0001' + r.item; if (seen.has(key)) continue; seen.add(key); cells.push({ p: pIdx.get(r.session) as number, i: iIdx.get(r.item) as number, x: r.correct }); }
  let activeP = new Set(persons.map((_, i) => i)); let activeI = new Set(items.map((_, i) => i));
  /* إسقاط الطرفيين تكراريًا */
  for (let pass = 0; pass < 5; pass += 1) {
    const ps = new Map<number, { s: number; n: number }>(); const is = new Map<number, { s: number; n: number }>();
    for (const c of cells) { if (!activeP.has(c.p) || !activeI.has(c.i)) continue; const a = ps.get(c.p) || { s: 0, n: 0 }; a.s += c.x; a.n += 1; ps.set(c.p, a); const b = is.get(c.i) || { s: 0, n: 0 }; b.s += c.x; b.n += 1; is.set(c.i, b); }
    const nextP = new Set([...activeP].filter((p) => { const a = ps.get(p); return a && a.n >= 2 && a.s > 0 && a.s < a.n; }));
    const nextI = new Set([...activeI].filter((i) => { const a = is.get(i); return a && a.n >= minN && a.s > 0 && a.s < a.n; }));
    const same = nextP.size === activeP.size && nextI.size === activeI.size; activeP = nextP; activeI = nextI; if (same) break;
  }
  const live = cells.filter((c) => activeP.has(c.p) && activeI.has(c.i));
  if (!live.length || activeI.size < 2) return { items: [], persons: 0, iterations: 0, converged: false };
  const theta = new Float64Array(persons.length); const b = new Float64Array(items.length);
  /* PROX للبداية */
  const pS = new Map<number, { s: number; n: number }>(); const iS = new Map<number, { s: number; n: number }>();
  for (const c of live) { const a = pS.get(c.p) || { s: 0, n: 0 }; a.s += c.x; a.n += 1; pS.set(c.p, a); const d = iS.get(c.i) || { s: 0, n: 0 }; d.s += c.x; d.n += 1; iS.set(c.i, d); }
  for (const [p, a] of pS) theta[p] = Math.log(a.s / (a.n - a.s)); for (const [i, a] of iS) b[i] = Math.log((a.n - a.s) / a.s);
  let iterations = 0; let converged = false;
  for (; iterations < 60; iterations += 1) {
    /* البنود */
    const g = new Float64Array(items.length), h = new Float64Array(items.length);
    for (const c of live) { const P = 1 / (1 + Math.exp(-(theta[c.p] - b[c.i]))); g[c.i] += P - c.x; h[c.i] += P * (1 - P); }
    let maxD = 0;
    for (const i of activeI) { if (h[i] <= 0) continue; const d = Math.max(-1, Math.min(1, g[i] / h[i])); b[i] += d; maxD = Math.max(maxD, Math.abs(d)); }  /* dL/db = Σ(P−x) → الخطوة تُضاف */
    const mb = mean([...activeI].map((i) => b[i])); for (const i of activeI) b[i] -= mb;
    /* الأشخاص */
    const gp = new Float64Array(persons.length), hp = new Float64Array(persons.length);
    for (const c of live) { const P = 1 / (1 + Math.exp(-(theta[c.p] - b[c.i]))); gp[c.p] += c.x - P; hp[c.p] += P * (1 - P); }
    for (const p of activeP) { if (hp[p] <= 0) continue; const d = Math.max(-1, Math.min(1, gp[p] / hp[p])); theta[p] += d; maxD = Math.max(maxD, Math.abs(d)); }
    if (maxD < 0.001) { converged = true; iterations += 1; break; }
  }
  /* تصحيح الانحياز للبنود (k-1)/k حيث k = عدد البنود النشطة */
  const k = activeI.size; const shrink = (k - 1) / k; for (const i of activeI) b[i] *= shrink;
  /* الملاءمة والخطأ المعياري */
  const out: RaschItem[] = [];
  const acc = new Map<number, { n: number; info: number; outfit: number; num: number; den: number }>();
  for (const c of live) { const P = 1 / (1 + Math.exp(-(theta[c.p] - b[c.i]))); const w = P * (1 - P); const z2 = ((c.x - P) ** 2) / Math.max(1e-6, w); const a = acc.get(c.i) || { n: 0, info: 0, outfit: 0, num: 0, den: 0 }; a.n += 1; a.info += w; a.outfit += z2; a.num += (c.x - P) ** 2; a.den += w; acc.set(c.i, a); }
  for (const i of activeI) { const a = acc.get(i); if (!a) continue; out.push({ item: items[i], n: a.n, b: r3(b[i]), se: r3(1 / Math.sqrt(Math.max(1e-6, a.info))), infit: r3(a.num / Math.max(1e-6, a.den)), outfit: r3(a.outfit / a.n) }); }
  return { items: out.sort((x, y) => x.b - y.b), persons: activeP.size, iterations, converged };
}

/* ───────────── إسقاط السلّم على CEFR ───────────── */
export const CEFR_ORDER = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type BandMap = { medians: Record<string, number>; bounds: { level: string; lo: number; hi: number }[] };
/** وسيط صعوبات بنود كل مستوى (المعلَن) يرسم المستويات؛ الحدود منتصفات الوسيطين المتجاورين */
export function bandMap(items: readonly { level: string; b: number }[]): BandMap {
  const medians: Record<string, number> = {};
  for (const L of CEFR_ORDER) { const bs = items.filter((i) => i.level === L).map((i) => i.b); if (bs.length >= 3) medians[L] = r3(median(bs)); }
  const levels = CEFR_ORDER.filter((L) => L in medians); const bounds: BandMap['bounds'] = [];
  for (let i = 0; i < levels.length; i += 1) {
    const lo = i === 0 ? -Infinity : (medians[levels[i - 1]] + medians[levels[i]]) / 2; const hi = i === levels.length - 1 ? Infinity : (medians[levels[i]] + medians[levels[i + 1]]) / 2;
    bounds.push({ level: levels[i], lo: r3(lo), hi: r3(hi) });
  }
  return { medians, bounds };
}
/** اقتراح نقل: البند خارج نطاق مستواه بأكثر من tolerance لوجِت → المستوى الذي يقع فيه (null = في مكانه) */
export function suggestLevel(level: string, b: number, map: BandMap, tolerance = 0.75): string | null {
  const own = map.bounds.find((x) => x.level === level); if (!own) return null;
  if (b >= own.lo - tolerance && b <= own.hi + tolerance) return null;
  const hit = map.bounds.find((x) => b >= x.lo && b < x.hi); return hit && hit.level !== level ? hit.level : null;
}

/* ───────────── معادلة خطية بين نموذجين (Tucker المبسّطة عبر المراسي) ───────────── */
/** anchorsA/B: درجات المراسي نفسها في المجموعتين؛ totalsA/B: الدرجات الكلية. يُرجع دالة تحوّل درجة B إلى سلّم A. */
export function linearEquate(a: { anchorMean: number; anchorSd: number; totalMean: number; totalSd: number }, bGroup: { anchorMean: number; anchorSd: number; totalMean: number; totalSd: number }): { slope: number; intercept: number } {
  if (bGroup.totalSd <= 0 || a.anchorSd <= 0 || bGroup.anchorSd <= 0) return { slope: 1, intercept: 0 };
  /* فرق المراسي يُسقَط على الدرجات الكلية بنسبة الانحرافات */
  const slope = a.totalSd / bGroup.totalSd; const shift = (a.anchorMean - bGroup.anchorMean) * (a.totalSd / a.anchorSd);
  return { slope: r3(slope), intercept: r3(a.totalMean + shift - slope * bGroup.totalMean) };
}
