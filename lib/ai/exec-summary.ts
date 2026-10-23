/**
 * الملخص التنفيذي الذكي — يبني حقائق مضغوطة من البيانات، يطلب من النموذج صياغة ملخص عربي JSON،
 * ويملك بديلًا محليًا كاملًا عند غياب المفتاح أو فشل الاستدعاء. (دوال البناء/التحليل نقية — قابلة للاختبار)
 */
import { TARGET } from '../reports/analytics';
import type { Kpis, GroupRow, Action, Comparison } from '../reports/analytics';

export type SummaryFacts = {
  scope: string; period: string; generatedAt: string;
  kpis: Pick<Kpis, 'responses' | 'participants' | 'mean' | 'highPct' | 'lowPct' | 'programs' | 'trainers' | 'rooms'> | null;
  deltaMean: number | null;
  axesTop: { label: string; mean: number }[]; axesLow: { label: string; mean: number }[];
  programs: { label: string; mean: number; n: number }[];
  trainersTop: { label: string; mean: number; n: number }[]; trainersLow: { label: string; mean: number; n: number }[];
  actions: { label: string; recommendation: string; priority: string }[];
  extras?: Record<string, string | number | null>; // سلسلة الأثر، الإشعارات المفتوحة…
};
export type ExecSummary = { headline: string; bullets: string[]; risks: string[]; actions: string[]; source: 'ai' | 'local'; model?: string };

const r2 = (x: number) => Math.round(x * 100) / 100;
export function factsFrom(p: { scope: string; period: string; generatedAt: string; k: Kpis | null; cmp: Comparison | null; axes: GroupRow[]; programs: GroupRow[]; trainers: GroupRow[]; actions: Action[]; extras?: SummaryFacts['extras'] }): SummaryFacts {
  const sorted = [...p.axes].filter(a => a.n >= 3).sort((a, b) => b.mean - a.mean);
  const tr = [...p.trainers].filter(t => t.responses >= 5).sort((a, b) => b.mean - a.mean);
  const pick = (g: GroupRow) => ({ label: g.label, mean: r2(g.mean), n: g.responses });
  return {
    scope: p.scope, period: p.period, generatedAt: p.generatedAt,
    kpis: p.k && p.k.responses ? { responses: p.k.responses, participants: p.k.participants, mean: r2(p.k.mean), highPct: Math.round(p.k.highPct), lowPct: Math.round(p.k.lowPct), programs: p.k.programs, trainers: p.k.trainers, rooms: p.k.rooms } : null,
    deltaMean: p.cmp?.deltaMean == null ? null : r2(p.cmp.deltaMean),
    axesTop: sorted.slice(0, 3).map(a => ({ label: a.label, mean: r2(a.mean) })), axesLow: sorted.slice(-3).reverse().map(a => ({ label: a.label, mean: r2(a.mean) })),
    programs: [...p.programs].filter(x => x.responses >= 5).sort((a, b) => b.mean - a.mean).slice(0, 8).map(pick),
    trainersTop: tr.slice(0, 3).map(pick), trainersLow: tr.slice(-3).reverse().map(pick),
    actions: p.actions.slice(0, 5).map(a => ({ label: a.label, recommendation: a.recommendation, priority: a.priority })),
    extras: p.extras,
  };
}

export function buildSummaryPrompt(f: SummaryFacts): { system: string; user: string } {
  const system = `أنت محلل جودة تدريب خبير يكتب لمدير تنفيذي مشغول. اكتب بالعربية الفصحى المختصرة، بأرقام دقيقة من الحقائق المعطاة فقط، دون مبالغة أو اختراع. المستهدف المؤسسي لمتوسط الرضا ${TARGET} من 5. أعد JSON فقط بالشكل: {"headline": "جملة واحدة ≤ 20 كلمة", "bullets": ["3–5 نقاط أبرز النتائج"], "risks": ["0–3 مخاطر"], "actions": ["2–4 إجراءات محددة بصيغة الأمر مع المسؤول إن أمكن"]}`;
  const user = `الحقائق (JSON):\n${JSON.stringify(f, null, 0)}\n\nاكتب الملخص التنفيذي الآن.`;
  return { system, user };
}

export function parseSummary(text: string): Omit<ExecSummary, 'source'> | null {
  const raw = String(text || '').trim(); const m = raw.match(/\{[\s\S]*\}/); if (!m) return null;
  try {
    const j = JSON.parse(m[0]); const arr = (x: any) => (Array.isArray(x) ? x.map(s => String(s).trim()).filter(Boolean).slice(0, 6) : []);
    const headline = String(j.headline || '').trim(); if (!headline) return null;
    return { headline: headline.slice(0, 220), bullets: arr(j.bullets), risks: arr(j.risks), actions: arr(j.actions) };
  } catch { return null; }
}

/** بديل محلي قائم على القواعد — يعمل دائمًا */
export function localSummary(f: SummaryFacts): ExecSummary {
  const k = f.kpis;
  if (!k) return { headline: `لا توجد تقييمات في ${f.period} (${f.scope}).`, bullets: ['لم تصل استبانات خلال الفترة — تحقق من فتح التقييمات وروابط QR.'], risks: [], actions: ['تأكد من تفعيل التقييم اليومي في القاعات النشطة.'], source: 'local' };
  const gap = r2(k.mean - TARGET); const dir = f.deltaMean == null ? '' : f.deltaMean > 0 ? ` بتحسّن قدره ${Math.abs(f.deltaMean)} عن الفترة السابقة` : f.deltaMean < 0 ? ` بتراجع قدره ${Math.abs(f.deltaMean)} عن الفترة السابقة` : ' دون تغيير عن الفترة السابقة';
  const headline = `${k.responses} استبانة من ${k.participants} مشاركًا بمتوسط ${k.mean}/5 (${gap >= 0 ? 'فوق' : 'دون'} المستهدف ${TARGET} بـ${Math.abs(gap)})${dir}.`;
  const bullets: string[] = [];
  if (f.axesTop[0]) bullets.push(`أقوى المحاور: ${f.axesTop.map(a => `${a.label} (${a.mean})`).join('، ')}.`);
  if (f.axesLow[0]) bullets.push(`أضعف المحاور: ${f.axesLow.map(a => `${a.label} (${a.mean})`).join('، ')}.`);
  bullets.push(`${k.highPct}% تقييمات مرتفعة (4–5) مقابل ${k.lowPct}% منخفضة (1–2) عبر ${k.programs} برنامج و${k.trainers} مدربًا.`);
  if (f.programs.length >= 2) bullets.push(`أعلى برنامج: ${f.programs[0].label} (${f.programs[0].mean}) · أدنى برنامج: ${f.programs[f.programs.length - 1].label} (${f.programs[f.programs.length - 1].mean}).`);
  if (f.extras?.chain_index != null) bullets.push(`مؤشر سلسلة الأثر على مستوى المؤسسة: ${f.extras.chain_index}/100.`);
  const risks: string[] = [];
  if (k.lowPct >= 15) risks.push(`نسبة التقييمات المنخفضة ${k.lowPct}% تتجاوز حد التنبيه 15%.`);
  for (const p of f.programs.filter(p => p.mean < 3.7).slice(0, 2)) risks.push(`${p.label} عند ${p.mean} — دون مستوى «جيد».`);
  if (f.extras?.open_notifications && Number(f.extras.open_notifications) > 0) risks.push(`${f.extras.open_notifications} تنبيه جودة مفتوح في مركز الإشعارات.`);
  const actions = f.actions.slice(0, 3).map(a => `${a.label}: ${a.recommendation}`);
  if (!actions.length) actions.push(gap >= 0 ? 'حافظ على الزخم: وثّق ممارسات المحاور الأعلى وعمّمها.' : `أغلق فجوة ${Math.abs(gap)} عبر خطة تحسين للمحور الأدنى خلال 14 يومًا.`);
  return { headline, bullets: bullets.slice(0, 5), risks: risks.slice(0, 3), actions: actions.slice(0, 4), source: 'local' };
}

export function summaryHtml(s: ExecSummary): string {
  const li = (xs: string[]) => xs.map(x => `<li style="margin:0 0 4px">${x}</li>`).join('');
  return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:0 0 16px;background:#f8fafc">
<div style="font-size:11px;font-weight:bold;color:#0b8a83">الملخص التنفيذي ${s.source === 'ai' ? '· مُولَّد بالذكاء الاصطناعي' + (s.model ? ` (${s.model})` : '') : '· تحليل آلي'}</div>
<div style="font-size:16px;font-weight:bold;color:#0f2a4e;margin:4px 0 8px;line-height:1.6">${s.headline}</div>
${s.bullets.length ? `<ul style="margin:0 0 8px;padding:0 18px 0 0;font-size:13.5px;line-height:1.7">${li(s.bullets)}</ul>` : ''}
${s.risks.length ? `<div style="font-size:12px;font-weight:bold;color:#b45309">المخاطر</div><ul style="margin:0 0 8px;padding:0 18px 0 0;font-size:13px;line-height:1.7;color:#9a3412">${li(s.risks)}</ul>` : ''}
${s.actions.length ? `<div style="font-size:12px;font-weight:bold;color:#0f2a4e">الإجراءات</div><ol style="margin:0;padding:0 18px 0 0;font-size:13px;line-height:1.7">${li(s.actions)}</ol>` : ''}
</div>`;
}

/** يستدعي النموذج إن توفر المفتاح وإلا يعود للبديل المحلي — خادم فقط */
export async function generateExecSummary(f: SummaryFacts, deps: { callAi?: (system: string, user: string) => Promise<{ text: string; model: string }> }, budgetMs = 25000): Promise<ExecSummary> {
  if (!deps.callAi) return localSummary(f);
  try {
    const { system, user } = buildSummaryPrompt(f);
    const r = await Promise.race([deps.callAi(system, user), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('ai_timeout')), budgetMs))]);
    const parsed = parseSummary(r.text);
    if (!parsed) return { ...localSummary(f), source: 'local' };
    return { ...parsed, source: 'ai', model: r.model };
  } catch { return localSummary(f); }
}
