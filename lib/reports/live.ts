// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P84 */
/**
 * «التقرير الحيّ» — طبقة فوق التقرير الشامل (lib/reports/program.ts) تضيف ما طلبته خارطة التدقيق. دوالّ نقيّة بلا React/Supabase:
 *  1) هرم كيركباتريك صريحًا: كلّ سؤال تقييم موسوم kp_level 1–4 (من القاعدة أو وسم تلقائي autoLevel) → أربعة مستويات معًا من البرنامج نفسه
 *     L1 رضا (بنود المستوى 1) · L2 تعلّم (قبل/بعد: الكسب وحجم الأثر d + بنود التعلّم المصرَّح بها) · L3 سلوك (حملات نقل الأثر + بنود نيّة التطبيق) · L4 نتائج (مؤشرات).
 *  2) توزيع الإجابات لكلّ بند (1..5) لا المتوسّط فقط · فجوة المحاور · أعلى/أدنى 5.
 *  3) مقارنة بالدفعة السابقة (البرنامج نفسه بالاسم، الأقدم مباشرة).
 *  4) التنبيه التلقائي: بند < 3.0 · تعليقات سلبية متكرّرة · حضور < 80% · كسب منخفض · نقل ضعيف · مؤشّر نتائج دون 50 → مهامّ report_alerts (بلا تكرار).
 *  5) خمسة قوالب بحسب القارئ من البيانات نفسها: executive (صفحة) · org (الجهة) · trainer · learner · quality — مستند مقاطع (Section[]) يُعرض ويُطبع ويُرسل بريدًا (templateHtml).
 */
import type { ProgramReport } from './program';
import type { Comment, GroupRow, RawQuestion, Program } from './analytics';
import { TARGET, THRESHOLDS } from './analytics';

export type KpLevel = 1 | 2 | 3 | 4;
export const KP_META: Record<KpLevel, { ar: string; en: string; short_ar: string; color: string; hint_ar: string }> = {
  1: { ar: 'رد الفعل (الرضا)', en: 'Reaction', short_ar: 'رضا', color: '#5EA8A0', hint_ar: 'كيف وجد المشاركون التجربة؟' },
  2: { ar: 'التعلّم', en: 'Learning', short_ar: 'تعلّم', color: '#D9A866', hint_ar: 'ما الذي اكتسبوه معرفةً ومهارة؟' },
  3: { ar: 'السلوك (التطبيق)', en: 'Behavior', short_ar: 'سلوك', color: '#D4614A', hint_ar: 'هل طبّقوه في العمل؟' },
  4: { ar: 'النتائج', en: 'Results', short_ar: 'نتائج', color: '#3A1F36', hint_ar: 'ما الذي تغيّر في مؤشّرات الجهة؟' },
};
export type LiveQuestion = RawQuestion & { kp_level?: number | null };

/** الوسم من القاعدة إن وُجد، وإلا وسم تلقائي بالنصّ (يوافق منطق SQL) — للعرض قبل تشغيل الهجرة. */
export function autoLevel(q: Pick<LiveQuestion, 'text_ar' | 'text_en' | 'question_key' | 'kp_level'>): KpLevel {
  const k = Number(q.kp_level); if (q.kp_level != null && k >= 1 && k <= 4) return k as KpLevel; /* الوسم في القاعدة يُحترم كما هو */
  const ar = q.text_ar || '', en = (q.text_en || '').toLowerCase(), key = (q.question_key || '').toLowerCase();
  if (/(تعلّمت|تعلمت|اكتسبت|معرفتي|مهارتي|مهاراتي|فهمي|أتقنت|اتقنت|أصبحت قادرًا|اصبحت قادرا|استوعبت)/.test(ar) || /(learned|learnt|knowledge|skill|understand|acquired|able to)/.test(en) || /(learn|knowledge|skill|gain)/.test(key)) return 2;
  if (/(سأطبّق|سأطبق|أطبّق|اطبق|تطبيق|في عملي|في وظيفتي|سلوك|ممارس|أنوي|انوي|سأستخدم|ساستخدم)/.test(ar) || /(apply|applied|behavio|in my (job|work)|intend|practice)/.test(en) || /(apply|behavio|transfer|intent)/.test(key)) return 3;
  if (/(نتائج (الجهة|العمل|المنظمة|المؤسسة)|أداء الجهة|إنتاجية|انتاجية|مؤشرات الأداء|العائد|أثر .*(العمل|الجهة|المنظمة)|جودة العمل)/.test(ar) || /(organi[sz]ation(al)? (result|performance|outcome)|productivity|kpi|return on|business impact)/.test(en) || /(result|outcome|kpi|roi)/.test(key)) return 4;
  return 1;
}

// ====================================================================== البنود وتوزيعاتها
export type Item = { id: string; label: string; section: string; level: KpLevel; n: number; mean: number; sd: number; dist: [number, number, number, number, number]; top2: number; bottom2: number; perf: GroupRow['perf'] };
export function buildItems(questionRows: GroupRow[], questions: LiveQuestion[]): Item[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return questionRows.map((r) => { const q = byId.get(r.key); const total = r.dist.reduce((a, b) => a + b, 0) || 1; return { id: r.key, label: r.label, section: q?.section_ar || '', level: q ? autoLevel(q) : 1, n: r.n, mean: r.mean, sd: r.sd, dist: r.dist, top2: Math.round(((r.dist[3] + r.dist[4]) / total) * 100), bottom2: Math.round(((r.dist[0] + r.dist[1]) / total) * 100), perf: r.perf }; });
}
export const topItems = (items: Item[], n = 5) => [...items].filter((i) => i.n >= 3).sort((a, b) => b.mean - a.mean).slice(0, n);
export const lowItems = (items: Item[], n = 5) => [...items].filter((i) => i.n >= 3).sort((a, b) => a.mean - b.mean).slice(0, n);
/** فجوة المحاور = أعلى محور − أدنى محور. */
export function axisGap(axes: GroupRow[]): { gap: number; high: GroupRow | null; low: GroupRow | null } { const a = axes.filter((x) => x.n >= 3); if (a.length < 2) return { gap: 0, high: a[0] || null, low: a[0] || null }; const s = [...a].sort((x, y) => y.mean - x.mean); return { gap: Math.round((s[0].mean - s[s.length - 1].mean) * 100) / 100, high: s[0], low: s[s.length - 1] }; }

// ====================================================================== هرم كيركباتريك
export type LevelCard = { level: KpLevel; score: number | null; headline: string; detail: string[]; n: number; tone: 'ok' | 'info' | 'warn' | 'bad' | 'none' };
const tone = (s: number | null): LevelCard['tone'] => (s == null ? 'none' : s >= 75 ? 'ok' : s >= 60 ? 'info' : s >= 45 ? 'warn' : 'bad');
const meanOf = (xs: Item[]) => { const w = xs.reduce((a, i) => a + i.n, 0); return w ? xs.reduce((a, i) => a + i.mean * i.n, 0) / w : null; };
const to100 = (m: number | null) => (m == null ? null : Math.round(((m - 1) / 4) * 100));
const f2 = (x: number | null | undefined) => (x == null ? '—' : (Math.round(x * 100) / 100).toFixed(2));

export function kirkpatrick(rep: ProgramReport, items: Item[]): LevelCard[] {
  const l1i = items.filter((i) => i.level === 1), l2i = items.filter((i) => i.level === 2), l3i = items.filter((i) => i.level === 3), l4i = items.filter((i) => i.level === 4);
  const m1 = meanOf(l1i) ?? rep.evaluation.k?.mean ?? null; const s1 = to100(m1);
  const L1: LevelCard = { level: 1, score: s1, tone: tone(s1), n: rep.evaluation.k?.responses || 0, headline: m1 == null ? 'لا تقييمات بعد' : `${f2(m1)} من 5 · ${rep.evaluation.k?.highPct ?? 0}% راضون جدًّا`, detail: [l1i.length ? `${l1i.length} بندًا للرضا` : 'لا بنود موسومة بالمستوى 1', rep.evaluation.k ? `${rep.evaluation.k.lowPct}% تقييمات منخفضة (≤2)` : ''].filter(Boolean) };
  const ls = rep.learning.s; const m2 = meanOf(l2i); const pre = ls && ls.nPaired > 0 ? ls : null;
  const s2 = pre && pre.hake != null ? Math.max(0, Math.min(100, Math.round(50 + pre.hake * 50))) : to100(m2);
  const L2: LevelCard = { level: 2, score: s2, tone: tone(s2), n: pre ? pre.nPaired : l2i.reduce((a, i) => a + i.n, 0), headline: pre ? `الكسب ${pre.gain != null ? (pre.gain > 0 ? '+' : '') + Math.round(pre.gain) : '—'} نقطة · g = ${f2(pre.hake)} · d = ${f2(pre.cohenD)}` : m2 != null ? `تعلّم مصرَّح به ${f2(m2)} من 5 (بلا قياس قبلي)` : 'لا قياس قبلي/بعدي ولا بنود تعلّم', detail: [pre ? `${pre.nPaired} زوجًا قبل/بعد · تحسّن ${pre.improved} · ثبت ${pre.same} · تراجع ${pre.declined}` : rep.learning.tools ? `${rep.learning.tools} أداة قياس بلا أزواج مكتملة` : 'أنشئ قياسًا قبليًّا/بعديًّا من «الأثر»', pre && pre.p != null ? `p = ${pre.p < 0.001 ? '< 0.001' : f2(pre.p)}` : '', m2 != null && pre ? `+ بنود التعلّم المصرَّح: ${f2(m2)}` : ''].filter(Boolean) };
  const ts = rep.transfer.s; const m3 = meanOf(l3i); const s3 = ts && ts.transfer_index != null ? ts.transfer_index : to100(m3);
  const L3: LevelCard = { level: 3, score: s3, tone: tone(s3), n: ts?.n || l3i.reduce((a, i) => a + i.n, 0), headline: ts && ts.transfer_index != null ? `مؤشّر النقل ${ts.transfer_index}/100 · تطبيق ${ts.app_all != null ? Math.round(ts.app_all) + '%' : '—'}` : m3 != null ? `نيّة التطبيق ${f2(m3)} من 5 (بلا متابعة بعدية)` : 'لا متابعة سلوكية بعد', detail: [ts ? `${ts.n_sup} مشرفًا · ${ts.n_tr} مشاركًا${ts.gap != null ? ` · فجوة مشرف−مشارك ${f2(ts.gap)}` : ''}` : rep.transfer.campaigns ? `${rep.transfer.campaigns} حملة بلا استجابات` : 'أطلق متابعة «نقل الأثر» بعد 30–90 يومًا', ts?.barriers[0] ? `أبرز معوّق: ${ts.barriers[0].label} (${ts.barriers[0].pct}%)` : ''].filter(Boolean) };
  const oi = rep.outcomes; const m4 = meanOf(l4i); const s4 = oi.index != null ? oi.index : to100(m4);
  const L4: LevelCard = { level: 4, score: s4, tone: tone(s4), n: oi.measured, headline: oi.index != null ? `تحقّق المؤشّرات ${oi.index}% · ${oi.measured}/${oi.rows.length} مؤشّرًا مقيسًا` : m4 != null ? `نتائج مصرَّح بها ${f2(m4)} من 5` : 'لا مؤشّرات نتائج بعد', detail: oi.rows.slice(0, 3).map((r: any) => `${r.name_ar || r.name || 'مؤشّر'}: ${r.current ?? '—'}${r.target != null ? ` / ${r.target}` : ''}`).concat(oi.rows.length ? [] : ['عرّف 1–3 مؤشّرات أعمال في «النتائج»']) };
  return [L1, L2, L3, L4];
}

// ====================================================================== الدفعة السابقة
export type CohortDelta = { prev: Program; prevMean: number | null; curMean: number | null; delta: number | null; prevResponses: number } | null;
export function previousCohort(programs: Program[], current: Program, meanOfProgram: (p: Program) => { mean: number | null; responses: number }): CohortDelta {
  const same = programs.filter((p) => p.id !== current.id && p.name_ar.trim() === current.name_ar.trim() && (p.start_date || '') < (current.start_date || '9999')).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  if (!same.length) return null; const prev = same[0]; const pm = meanOfProgram(prev); const cm = meanOfProgram(current);
  return { prev, prevMean: pm.mean, curMean: cm.mean, delta: pm.mean != null && cm.mean != null ? Math.round((cm.mean - pm.mean) * 100) / 100 : null, prevResponses: pm.responses };
}

// ====================================================================== التنبيهات التلقائية
export type AlertKind = 'low_item' | 'neg_comments' | 'low_attendance' | 'low_gain' | 'low_transfer' | 'low_outcome';
export type Alert = { kind: AlertKind; ref: string; severity: 'high' | 'med'; title_ar: string; detail: Record<string, unknown>; owner_ar: string; days: number };
export const ALERT_LABEL: Record<AlertKind, string> = { low_item: 'بند دون 3.0', neg_comments: 'تعليقات سلبية متكرّرة', low_attendance: 'حضور منخفض', low_gain: 'كسب تعلّم منخفض', low_transfer: 'نقل أثر ضعيف', low_outcome: 'مؤشّرات نتائج متأخّرة' };
export function detectAlerts(rep: ProgramReport, items: Item[], comments: Comment[], opts: { itemFloor?: number; minN?: number } = {}): Alert[] {
  const floor = opts.itemFloor ?? 3.0, minN = opts.minN ?? THRESHOLDS.minSample; const out: Alert[] = [];
  for (const i of items) if (i.n >= minN && i.mean < floor) out.push({ kind: 'low_item', ref: i.id, severity: i.mean < 2.5 ? 'high' : 'med', title_ar: `البند «${i.label}» ${f2(i.mean)} من 5 (${i.n} إجابة · ${i.bottom2}% منخفضة)`, detail: { mean: i.mean, n: i.n, dist: i.dist, section: i.section, level: i.level }, owner_ar: i.level === 1 && /مدرّب|المدرب/.test(i.section + i.label) ? 'مدير البرنامج + المدرّب' : 'مدير البرنامج', days: 14 });
  const neg = new Map<string, Comment[]>(); for (const c of comments) if (c.sentiment === 'negative') { const l = neg.get(c.question_id) || []; l.push(c); neg.set(c.question_id, l); }
  for (const [qid, cs] of neg) if (cs.length >= 3) out.push({ kind: 'neg_comments', ref: qid, severity: cs.length >= 6 ? 'high' : 'med', title_ar: `${cs.length} تعليقات سلبية على «${cs[0].question_ar}»`, detail: { n: cs.length, samples: cs.slice(0, 3).map((c) => c.text.slice(0, 160)) }, owner_ar: 'الجودة', days: 7 });
  const a = rep.attendance; if (a.participants >= minN && a.avgPct != null && a.avgPct < 80) out.push({ kind: 'low_attendance', ref: 'program', severity: a.avgPct < 65 ? 'high' : 'med', title_ar: `متوسّط الحضور ${a.avgPct}% · ${a.participants - a.eligible80} دون 80%`, detail: { avgPct: a.avgPct, participants: a.participants, eligible80: a.eligible80 }, owner_ar: 'منسّق البرنامج', days: 7 });
  const l = rep.learning.s; if (l && l.nPaired >= minN && l.hake != null && l.hake < 0.3) out.push({ kind: 'low_gain', ref: 'program', severity: l.hake < 0.15 ? 'high' : 'med', title_ar: `الكسب المعياري g = ${f2(l.hake)} (منخفض) على ${l.nPaired} زوجًا`, detail: { hake: l.hake, gain: l.gain, d: l.cohenD, n: l.nPaired }, owner_ar: 'المدرّب + تصميم التعلّم', days: 21 });
  const t = rep.transfer.s; if (t && t.n >= minN && t.transfer_index != null && t.transfer_index < 50) out.push({ kind: 'low_transfer', ref: 'program', severity: t.transfer_index < 35 ? 'high' : 'med', title_ar: `مؤشّر نقل الأثر ${t.transfer_index}/100${t.barriers[0] ? ` · المعوّق الأبرز: ${t.barriers[0].label}` : ''}`, detail: { index: t.transfer_index, barriers: t.barriers.slice(0, 3) }, owner_ar: 'الجهة (المشرف المباشر) + مدير البرنامج', days: 30 });
  const o = rep.outcomes; if (o.rows.length && o.measured && o.index != null && o.index < 50) out.push({ kind: 'low_outcome', ref: 'program', severity: 'med', title_ar: `تحقّق مؤشّرات النتائج ${o.index}% فقط`, detail: { index: o.index, measured: o.measured, total: o.rows.length }, owner_ar: 'راعي البرنامج في الجهة', days: 45 });
  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'high' ? -1 : 1));
}
/** الجديد من التنبيهات مقارنة بما في القاعدة (بالمفتاح نوع+مرجع). */
export const newAlerts = (detected: Alert[], existing: { kind: string; ref: string }[]) => { const have = new Set(existing.map((e) => `${e.kind}:${e.ref}`)); return detected.filter((a) => !have.has(`${a.kind}:${a.ref}`)); };

// ====================================================================== القوالب الخمسة
export type TemplateKind = 'executive' | 'org' | 'trainer' | 'learner' | 'quality';
export const TEMPLATES: Record<TemplateKind, { ar: string; reader_ar: string; pages_ar: string }> = {
  executive: { ar: 'الصفحة التنفيذية', reader_ar: 'لصانع القرار', pages_ar: 'صفحة واحدة' }, org: { ar: 'تقرير الجهة', reader_ar: 'للجهة المستفيدة', pages_ar: '2–3 صفحات' },
  trainer: { ar: 'تقرير المدرّب', reader_ar: 'للمدرّب', pages_ar: 'صفحتان' }, learner: { ar: 'تقرير المتعلّم', reader_ar: 'للمشارك (مجمّع)', pages_ar: 'صفحة' }, quality: { ar: 'تقرير الجودة', reader_ar: 'للاعتماد والمراجعة', pages_ar: '3–4 صفحات' },
};
export type Block = { type: 'kpis'; items: { label: string; value: string; sub?: string; tone?: LevelCard['tone'] }[] } | { type: 'levels'; cards: LevelCard[] } | { type: 'table'; head: string[]; rows: (string | number)[][] } | { type: 'bars'; items: Item[] } | { type: 'text'; text: string } | { type: 'list'; items: string[] } | { type: 'quotes'; items: { text: string; who?: string }[] };
export type Section = { title: string; blocks: Block[] };
export type LiveDoc = { kind: TemplateKind; title: string; subtitle: string; program: string; period: string; generated_at: string; sections: Section[] };
export type LiveInput = { rep: ProgramReport; items: Item[]; cards: LevelCard[]; alerts: Alert[]; cohort: CohortDelta; comments: Comment[]; generatedAt: string };

const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x)}%`);
const pf = (x: number | null) => (x == null ? '—' : `${x}/100`);
const kpiTone = (m: number | null): LevelCard['tone'] => (m == null ? 'none' : m >= TARGET ? 'ok' : m >= THRESHOLDS.good ? 'info' : m >= THRESHOLDS.watch ? 'warn' : 'bad');

export function buildDoc(kind: TemplateKind, d: LiveInput): LiveDoc {
  const { rep, items, cards, alerts, cohort } = d; const k = rep.evaluation.k; const p = rep.program;
  const base = { kind, program: p.name_ar, period: `${p.start_date || '—'} ← ${p.end_date || '—'}`, generated_at: d.generatedAt };
  const levelsBlock: Block = { type: 'levels', cards };
  const headKpis: Block = { type: 'kpis', items: [
    { label: 'مؤشّر الأثر', value: pf(rep.chain.s.index), sub: rep.headline.ar, tone: tone(rep.chain.s.index) },
    { label: 'الرضا', value: k ? f2(k.mean) : '—', sub: k ? `${k.responses} تقييمًا · هدف ${TARGET}` : 'لا تقييمات', tone: kpiTone(k?.mean ?? null) },
    { label: 'الحضور', value: pct(rep.attendance.avgPct), sub: `${rep.attendance.participants} مشاركًا · ${rep.attendance.sessions} جلسة`, tone: rep.attendance.avgPct == null ? 'none' : rep.attendance.avgPct >= 80 ? 'ok' : 'warn' },
    { label: 'الشهادات', value: String(rep.certificates.issued), sub: rep.certificates.coveragePct != null ? `تغطية ${rep.certificates.coveragePct}%` : '—', tone: 'info' },
  ] };
  const cohortText = cohort ? `مقارنة بالدفعة السابقة (${cohort.prev.start_date || '—'}): الرضا ${f2(cohort.prevMean)} → ${f2(cohort.curMean)} (${cohort.delta == null ? '—' : (cohort.delta > 0 ? '+' : '') + cohort.delta}).` : 'لا دفعة سابقة بالاسم نفسه للمقارنة.';
  const recs: Block = { type: 'list', items: rep.recommendations };
  const alertsTable: Block = { type: 'table', head: ['التنبيه', 'الأهمّية', 'المسؤول المقترح', 'خلال'], rows: alerts.map((a) => [a.title_ar, a.severity === 'high' ? 'عالية' : 'متوسّطة', a.owner_ar, `${a.days} يومًا`]) };
  const axesTable: Block = { type: 'table', head: ['المحور', 'المتوسّط', 'n', 'راضون جدًّا', 'منخفض'], rows: rep.evaluation.axes.map((a) => [a.label, f2(a.mean), a.n, `${a.highPct}%`, `${a.lowPct}%`]) };
  const gap = axisGap(rep.evaluation.axes);
  const quotes: Block = { type: 'quotes', items: d.comments.filter((c) => c.text.length >= 20).slice(0, 6).map((c) => ({ text: c.text, who: c.sentiment === 'negative' ? 'ملاحظة' : 'شهادة' })) };

  if (kind === 'executive') return { ...base, title: 'الصفحة التنفيذية', subtitle: 'أثر البرنامج في صفحة واحدة', sections: [
    { title: 'الخلاصة', blocks: [headKpis, { type: 'text', text: `${rep.headline.ar}. ${cohortText}` }] },
    { title: 'هرم كيركباتريك — المستويات الأربعة معًا', blocks: [levelsBlock] },
    { title: 'قرارات مقترحة', blocks: [recs] },
    ...(alerts.length ? [{ title: 'تنبيهات تحتاج قرارًا', blocks: [alertsTable] }] : []),
  ] };
  if (kind === 'org') return { ...base, title: 'تقرير الجهة المستفيدة', subtitle: 'ما حصل عليه منسوبوكم وما الذي يحتاج دعمكم', sections: [
    { title: 'نظرة عامّة', blocks: [headKpis, { type: 'text', text: rep.headline.ar }] },
    { title: 'المستويات الأربعة', blocks: [levelsBlock] },
    { title: 'المحاور', blocks: [axesTable, { type: 'text', text: gap.high && gap.low && gap.gap > 0 ? `فجوة المحاور ${gap.gap}: الأعلى «${gap.high.label}» والأدنى «${gap.low.label}».` : '' }] },
    { title: 'نقل الأثر — دور الجهة', blocks: [{ type: 'text', text: rep.transfer.s ? `مؤشّر النقل ${pf(rep.transfer.s.transfer_index)}؛ ${rep.transfer.s.barriers.slice(0, 3).map((b) => `${b.label} (${b.pct}%)`).join(' · ') || 'لا معوّقات بارزة'}. يُستحسن أن يراجع المشرف المباشر خطّة تطبيق كلّ مشارك خلال 30 يومًا.` : 'لم تُجرَ متابعة سلوكية بعد — نقترح متابعة بعد 30–90 يومًا مع المشرفين المباشرين.' }] },
    { title: 'ما يقوله المشاركون', blocks: [quotes] },
    { title: 'توصيات', blocks: [recs] },
  ] };
  if (kind === 'trainer') { const mine = items.filter((i) => /مدرّب|المدرب|الميسّر|trainer/i.test(i.section + ' ' + i.label)); return { ...base, title: 'تقرير المدرّب', subtitle: 'أداؤك كما رآه المشاركون — بندًا بندًا', sections: [
    { title: 'مؤشّراتك', blocks: [{ type: 'kpis', items: [{ label: 'بنود المدرّب', value: mine.length ? f2(meanOf(mine)) : '—', sub: `${mine.length} بندًا`, tone: kpiTone(meanOf(mine)) }, { label: 'رضا عامّ', value: k ? f2(k.mean) : '—', sub: `${k?.responses || 0} تقييمًا`, tone: kpiTone(k?.mean ?? null) }, { label: 'الكسب', value: rep.learning.s?.hake != null ? `g ${f2(rep.learning.s.hake)}` : '—', sub: rep.learning.s ? `${rep.learning.s.nPaired} زوجًا` : 'بلا قياس', tone: rep.learning.s?.hake != null ? tone(Math.round(50 + rep.learning.s.hake * 50)) : 'none' }, { label: 'الحضور', value: pct(rep.attendance.avgPct), sub: `${rep.attendance.participants} مشاركًا`, tone: 'info' }] }] },
    { title: 'توزيع الإجابات لكلّ بند (بنود المدرّب أولًا)', blocks: [{ type: 'bars', items: [...mine, ...items.filter((i) => !mine.includes(i))].slice(0, 20) }] },
    { title: 'أعلى 5 وأدنى 5', blocks: [{ type: 'table', head: ['الأعلى', 'المتوسّط', 'الأدنى', 'المتوسّط'], rows: Array.from({ length: 5 }, (_, i) => [topItems(items)[i]?.label || '', topItems(items)[i] ? f2(topItems(items)[i].mean) : '', lowItems(items)[i]?.label || '', lowItems(items)[i] ? f2(lowItems(items)[i].mean) : '']) }] },
    { title: 'تعليقات مختارة', blocks: [quotes] },
    { title: 'اقتراحات تطوير', blocks: [{ type: 'list', items: [...lowItems(items, 3).map((i) => `ارفع «${i.label}» (${f2(i.mean)}): ${i.bottom2}% من الإجابات منخفضة — جرّب تغييرًا محدّدًا في الجلسة القادمة وقِسه.`), ...rep.recommendations.slice(0, 2)] }] },
  ] }; }
  if (kind === 'learner') return { ...base, title: 'تقرير المشاركين (مجمّع)', subtitle: 'ما أنجزته المجموعة معًا — بلا أسماء', sections: [
    { title: 'إنجاز المجموعة', blocks: [{ type: 'kpis', items: [{ label: 'مشاركون', value: String(rep.attendance.participants), sub: `${rep.attendance.eligible80} أتمّوا 80%+ حضورًا`, tone: 'info' }, { label: 'الشهادات', value: String(rep.certificates.issued), sub: rep.certificates.coveragePct != null ? `${rep.certificates.coveragePct}% من المشاركين` : '', tone: 'ok' }, { label: 'التعلّم', value: rep.learning.s?.gain != null ? `+${Math.round(rep.learning.s.gain)} نقطة` : '—', sub: rep.learning.s ? `تحسّن ${rep.learning.s.improved} من ${rep.learning.s.nPaired}` : 'بلا قياس قبلي/بعدي', tone: rep.learning.s?.hake != null ? tone(Math.round(50 + rep.learning.s.hake * 50)) : 'none' }, { label: 'الرضا', value: k ? f2(k.mean) : '—', sub: k ? `${k.highPct}% راضون جدًّا` : '', tone: kpiTone(k?.mean ?? null) }] }] },
    { title: 'ما قاله زملاؤك', blocks: [quotes] },
    { title: 'خطوتك التالية', blocks: [{ type: 'list', items: ['طبّق مهارة واحدة من البرنامج هذا الأسبوع وسجّلها في «خطّة التطبيق».', 'ستصلك متابعة «نقل الأثر» بعد 30 يومًا — أجب عنها ليكتمل أثرك.', 'شهادتك وبطاقة قدراتك في «صفحتي» — شاركها بالرمز الموقَّع.'] }] },
  ] };
  return { ...base, title: 'تقرير الجودة', subtitle: 'الأدلّة والمنهجية — للاعتماد والمراجعة الداخلية', sections: [
    { title: 'المنهجية', blocks: [{ type: 'text', text: `نموذج كيركباتريك بأربعة مستويات. المستوى 1 من ${k?.responses || 0} استبيانًا (${k?.daily || 0} يومي · ${k?.final || 0} ختامي · ${k?.end || 0} نهاية برنامج). المستوى 2 من قياس قبلي/بعدي (${rep.learning.s?.nPaired || 0} زوجًا؛ الكسب المعياري Hake وحجم الأثر d لعيّنات مزدوجة). المستوى 3 من متابعة بعدية بمصدرين (مشرف/مشارك). المستوى 4 من مؤشّرات أعمال مقيسة. العتبات: مستهدف الرضا ${TARGET}، حدّ العيّنة ${THRESHOLDS.minSample}، بند حرج < 3.0.` }] },
    { title: 'المستويات الأربعة', blocks: [levelsBlock] },
    { title: 'المحاور وفجوتها', blocks: [axesTable, { type: 'text', text: gap.high && gap.low ? `فجوة المحاور ${gap.gap} («${gap.high.label}» ↔ «${gap.low.label}»).` : '' }] },
    { title: 'توزيع الإجابات لكلّ بند', blocks: [{ type: 'bars', items }] },
    { title: 'سجلّ التنبيهات والمخاطر', blocks: [alerts.length ? alertsTable : { type: 'text', text: 'لا تنبيهات تلقائية — كلّ البنود فوق العتبة والحضور والكسب ضمن المستهدف.' }] },
    { title: 'المقارنة والاتّجاه', blocks: [{ type: 'text', text: cohortText }, { type: 'table', head: ['الشعبة', 'المتوسّط', 'n', 'الأداء'], rows: rep.evaluation.byRoom.map((r) => [r.label, f2(r.mean), r.n, r.perf]) }] },
    { title: 'توصيات الجودة', blocks: [recs] },
  ] };
}

/** HTML مضمَّن الأنماط للبريد/الأرشفة — نفس المستند. */
export function templateHtml(doc: LiveDoc, site = 'https://athar-portal.com'): string {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  const toneBg: Record<LevelCard['tone'], string> = { ok: '#e6f4f1', info: '#f6ecd9', warn: '#fdeee9', bad: '#f8d7d3', none: '#f3eee9' };
  const block = (b: Block): string => {
    if (b.type === 'kpis') return `<table width="100%" cellspacing="6"><tr>${b.items.map((i) => `<td style="background:${toneBg[i.tone || 'none']};border-radius:12px;padding:10px;text-align:center;vertical-align:top"><div style="font-size:12px;color:#6b5560">${esc(i.label)}</div><div style="font-size:22px;font-weight:800;color:#22101F">${esc(i.value)}</div><div style="font-size:11px;color:#6b5560">${esc(i.sub || '')}</div></td>`).join('')}</tr></table>`;
    if (b.type === 'levels') return `<table width="100%" cellspacing="6"><tr>${b.cards.map((c) => `<td style="border-top:6px solid ${KP_META[c.level].color};background:${toneBg[c.tone]};border-radius:10px;padding:10px;vertical-align:top;width:25%"><div style="font-size:12px;color:#6b5560">المستوى ${c.level} · ${esc(KP_META[c.level].ar)}</div><div style="font-size:24px;font-weight:800">${c.score == null ? '—' : c.score + '/100'}</div><div style="font-size:12px">${esc(c.headline)}</div><div style="font-size:11px;color:#6b5560">${c.detail.map(esc).join('<br>')}</div></td>`).join('')}</tr></table>`;
    if (b.type === 'table') return `<table width="100%" cellspacing="0" style="border-collapse:collapse;font-size:13px"><tr>${b.head.map((h) => `<th style="text-align:right;padding:6px;background:#F6EBE0;border-bottom:1px solid #e6d5c6">${esc(h)}</th>`).join('')}</tr>${b.rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px;border-bottom:1px solid #f0e4d8">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    if (b.type === 'bars') return `<table width="100%" cellspacing="0" style="font-size:12px">${b.items.map((i) => { const t = i.dist.reduce((a, x) => a + x, 0) || 1; const cols = ['#b3261e', '#e8795c', '#D9A866', '#8fc4bd', '#2e7d6f']; return `<tr><td style="padding:4px;width:42%">${esc(i.label)} <span style="color:#8a7580">(${i.n})</span></td><td style="padding:4px"><table cellspacing="0" width="100%"><tr>${i.dist.map((v, j) => (v ? `<td style="background:${cols[j]};width:${Math.round((v / t) * 100)}%;height:12px;font-size:0">.</td>` : '')).join('')}</tr></table></td><td style="padding:4px;width:12%;text-align:center;font-weight:700">${f2(i.mean)}</td></tr>`; }).join('')}</table><div style="font-size:11px;color:#8a7580">الألوان من اليمين: 1 ضعيف → 5 ممتاز</div>`;
    if (b.type === 'list') return `<ul style="line-height:1.9;padding-inline-start:18px">${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (b.type === 'quotes') return b.items.length ? b.items.map((q) => `<blockquote style="margin:6px 0;padding:8px 12px;border-right:3px solid #D9A866;background:#fff;border-radius:8px">${esc(q.text)}${q.who ? ` <small style="color:#8a7580">— ${esc(q.who)}</small>` : ''}</blockquote>`).join('') : '<p style="color:#8a7580">لا تعليقات كافية.</p>';
    return b.text ? `<p style="line-height:1.9">${esc(b.text)}</p>` : '';
  };
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#FBF4EE;font-family:Tahoma,Arial,sans-serif;color:#22101F"><div style="max-width:720px;margin:0 auto;padding:16px">
<div style="background:#22101F;color:#F6EBE0;border-radius:16px;padding:14px 18px"><div style="font-size:12px;opacity:.8">بوّابة أَثَر · ${esc(doc.title)} · ${esc(doc.generated_at)}</div><div style="font-size:22px;font-weight:800;margin-top:4px">${esc(doc.program)}</div><div style="font-size:13px;opacity:.85">${esc(doc.subtitle)} · ${esc(doc.period)}</div></div>
${doc.sections.map((s) => `<div style="background:#fff;border:1px solid #e6d5c6;border-radius:14px;padding:12px 16px;margin-top:12px"><h2 style="font-size:16px;margin:0 0 8px;color:#3A1F36">${esc(s.title)}</h2>${s.blocks.map(block).join('')}</div>`).join('')}
<p style="font-size:11px;color:#8a7580;text-align:center;margin-top:14px">أُنتج آليًّا من بيانات أَثَر · ${esc(site)} · «نبني القدرة ونُثبت الأثر»</p></div></body></html>`;
}
