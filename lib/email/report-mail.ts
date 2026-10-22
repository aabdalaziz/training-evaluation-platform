/**
 * قوالب البريد الإلكتروني للتقارير — HTML آمن لعملاء البريد (جداول + أنماط مضمّنة، RTL).
 * تُستخدم من المتصفح (مركز التقارير) ومن الخادم (الملخص الأسبوعي) على حدّ سواء.
 */
import { PERF_LABEL, RISK_LABEL, TARGET, THRESHOLDS, type Action, type Kpis, type Lang } from '../reports/analytics';

export type MailKpi = { label: string; value: string; sub?: string; color?: string };
export type ReportMailInput = {
  lang: Lang;
  title: string;            // عنوان التقرير
  scope: string;            // نطاق التقرير (برنامج · فترة …)
  generatedAt: string;      // تاريخ الإعداد
  audience?: string;        // الجمهور المستهدف
  k: Kpis;                  // المؤشرات
  deltaMean?: number | null;// الفرق عن الفترة السابقة
  story?: string[];         // القراءة التحليلية
  actions?: Action[];       // الإجراءات الموصى بها
  link?: string;            // رابط التقرير الحي
  note?: string;            // رسالة من المرسل
  senderName?: string;
  attachments?: string[];   // أسماء المرفقات (للعرض فقط)
  brand?: { org?: string; platform?: string };
};

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** نص الحكم — نفس منطق مركز التقارير */
export function verdictText(k: Kpis, lang: Lang): string {
  const ar = lang === 'ar';
  if (k.responses < THRESHOLDS.minSample) return ar ? 'حجم العينة الحالي لا يسمح بإصدار حكم موثوق. يُوصى بزيادة الاستجابات قبل اتخاذ قرارات.' : 'Sample too small for a reliable verdict; collect more responses before deciding.';
  if (k.perf === 'EXCELLENT') return ar ? `الأداء يتجاوز الهدف المرجعي (${TARGET}). يُوصى بتوثيق الممارسات الناجحة وتعميمها.` : `Performance exceeds the ${TARGET} benchmark; document and scale what works.`;
  if (k.perf === 'GOOD') return ar ? `أداء جيد والفجوة إلى الامتياز ${k.gap.toFixed(2)} درجة؛ التركيز على المحاور الأدنى سيرفع المؤشر سريعًا.` : `Good performance; gap to excellence is ${k.gap.toFixed(2)}. Focus on the lowest axes.`;
  if (k.perf === 'WATCH') return ar ? `أداء مقبول دون الهدف بفجوة ${k.gap.toFixed(2)} درجة؛ تلزم خطة تحسين خلال أسبوعين.` : `Acceptable but ${k.gap.toFixed(2)} below target; an improvement plan within two weeks is needed.`;
  return ar ? 'مستوى خطر — يتطلب تدخلًا عاجلًا ومراجعة أسبوعية للمحاور الحمراء.' : 'At risk — urgent intervention and weekly review of red axes.';
}

export function mailSubject(i: Pick<ReportMailInput, 'lang' | 'title' | 'scope' | 'k'>): string {
  const ar = i.lang === 'ar';
  const perf = PERF_LABEL[i.k.perf][i.lang];
  return ar ? `[تقويم البرامج] ${i.title} — ${i.scope} — ${i.k.responses ? `${i.k.mean.toFixed(2)}/5 · ${perf}` : 'لا توجد استجابات'}`
    : `[Training Evaluation] ${i.title} — ${i.scope} — ${i.k.responses ? `${i.k.mean.toFixed(2)}/5 · ${perf}` : 'no responses'}`;
}

export function buildReportEmailHtml(i: ReportMailInput): string {
  const ar = i.lang === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const align = ar ? 'right' : 'left';
  const k = i.k;
  const perf = PERF_LABEL[k.perf]; const risk = RISK_LABEL[k.risk];
  const org = i.brand?.org || (ar ? 'جامعة الأمير مقرن · بوابة التميز للاستشارات والتدريب' : 'Prince Mugrin University · CenterGate for Excellence');
  const platform = i.brand?.platform || (ar ? 'منصة تقويم البرامج التدريبية' : 'Training Evaluation Platform');
  const kpis: MailKpi[] = k.responses ? [
    { label: ar ? 'المتوسط العام' : 'Overall mean', value: `${k.mean.toFixed(2)}/5`, sub: `${ar ? 'الهدف' : 'Target'} ${TARGET} · ${ar ? 'الفجوة' : 'gap'} ${(k.mean - TARGET).toFixed(2)}`, color: perf.color },
    { label: ar ? 'الاستجابات' : 'Responses', value: String(k.responses), sub: `${k.participants} ${ar ? 'مشارك' : 'participants'}` },
    { label: ar ? 'رضا مرتفع (4–5)' : 'High (4–5)', value: `${k.highPct.toFixed(0)}%` },
    { label: ar ? 'تقييمات منخفضة (1–2)' : 'Low (1–2)', value: `${k.lowPct.toFixed(0)}%`, color: k.lowPct > 15 ? '#b91c1c' : undefined },
  ] : [];
  const delta = i.deltaMean === null || i.deltaMean === undefined ? '' :
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${i.deltaMean >= 0 ? '#eafaf0' : '#fef2f2'};color:${i.deltaMean >= 0 ? '#15803d' : '#b91c1c'}">${i.deltaMean >= 0 ? '▲' : '▼'} ${Math.abs(i.deltaMean).toFixed(2)} ${ar ? 'عن الفترة السابقة' : 'vs previous period'}</span>`;
  const kpiCells = kpis.map(x => `
    <td width="25%" style="padding:6px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4eaf2;border-top:3px solid ${x.color || NAVY};border-radius:10px;background:#fff">
        <tr><td style="padding:12px 12px 2px;font:700 11px Tahoma,Arial;color:#64748b">${esc(x.label)}</td></tr>
        <tr><td style="padding:0 12px;font:900 24px Tahoma,Arial;color:${x.color || NAVY};direction:ltr;text-align:${align}">${esc(x.value)}</td></tr>
        <tr><td style="padding:2px 12px 12px;font:700 11px Tahoma,Arial;color:#64748b">${esc(x.sub || '')}</td></tr>
      </table>
    </td>`).join('');
  const storyHtml = (i.story || []).slice(0, 6).map(p => `<p style="margin:0 0 8px;font:14px/1.9 Tahoma,Arial;color:#334155">${esc(p)}</p>`).join('');
  const actionsHtml = (i.actions || []).slice(0, 5).map((a, n) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e4eaf2;font:700 13px Tahoma,Arial;color:${NAVY};width:28px;text-align:center">${n + 1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e4eaf2;font:13px/1.7 Tahoma,Arial;color:#0f172a">
        <b>${esc(a.label)}</b> <span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${a.priority === 'HIGH' ? '#fef2f2' : a.priority === 'MED' ? '#fff7e6' : '#f1f5f9'};color:${a.priority === 'HIGH' ? '#b91c1c' : a.priority === 'MED' ? '#b45309' : '#475569'}">${ar ? 'أولوية' : 'Priority'} ${a.priority === 'HIGH' ? (ar ? 'عالية' : 'High') : a.priority === 'MED' ? (ar ? 'متوسطة' : 'Medium') : (ar ? 'منخفضة' : 'Low')}</span><br>
        <span style="color:#334155">${esc(a.recommendation)}</span><br>
        <span style="font-size:11.5px;color:#64748b">${ar ? 'المالك' : 'Owner'}: ${esc(a.owner)} · ${ar ? 'خلال' : 'within'} ${a.dueDays} ${ar ? 'يوم' : 'days'} · ${a.mean.toFixed(2)}/5 · n=${a.responses}</span>
      </td>
    </tr>`).join('');
  const note = i.note ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px"><tr><td style="padding:12px 14px;background:#fbf5e4;border:1px solid #ead9a6;border-radius:10px;font:14px/1.8 Tahoma,Arial;color:#0f172a">${esc(i.note).replace(/\n/g, '<br>')}${i.senderName ? `<div style="margin-top:6px;font-size:12px;color:#64748b">— ${esc(i.senderName)}</div>` : ''}</td></tr></table>` : '';
  const att = i.attachments?.length ? `<p style="margin:10px 0 0;font:12px Tahoma,Arial;color:#64748b">📎 ${ar ? 'المرفقات' : 'Attachments'}: ${i.attachments.map(esc).join(' · ')}</p>` : '';
  const btn = i.link ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:14px 0 0"><tr><td style="background:${TEAL};border-radius:10px"><a href="${esc(i.link)}" style="display:inline-block;padding:11px 22px;font:700 14px Tahoma,Arial;color:#fff;text-decoration:none">${ar ? 'فتح التقرير التفاعلي' : 'Open interactive report'}</a></td></tr></table>` : '';

  return `<!doctype html><html dir="${dir}" lang="${i.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(i.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fa;direction:${dir}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;width:100%">
  <tr><td style="background:${NAVY};border-radius:16px 16px 0 0;padding:22px 26px;border-bottom:3px solid ${GOLD}">
    <div style="font:700 11px Tahoma,Arial;color:#a9c4d8;letter-spacing:.5px">${esc(platform)}</div>
    <div style="font:900 22px/1.3 Tahoma,Arial;color:#fff;margin-top:4px">${esc(i.title)}</div>
    <div style="font:700 12.5px Tahoma,Arial;color:#a9c4d8;margin-top:6px">${esc(i.scope)}</div>
  </td></tr>
  <tr><td style="background:#fff;padding:22px 26px;border:1px solid #e4eaf2;border-top:0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="font:700 12px Tahoma,Arial;color:#64748b">${ar ? 'أُعدّ في' : 'Generated'}: <bdi>${esc(i.generatedAt)}</bdi> · Asia/Riyadh${i.audience ? ` · ${ar ? 'الجمهور' : 'Audience'}: ${esc(i.audience)}` : ''}</td>
      <td align="${ar ? 'left' : 'right'}">${delta}</td>
    </tr></table>
    <div style="height:14px"></div>
    ${note}
    ${k.responses ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -6px"><tr>${kpiCells}</tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 18px"><tr><td style="padding:12px 16px;border:1px solid ${perf.color};border-${ar ? 'right' : 'left'}-width:5px;border-radius:10px;background:${perf.bg};font:700 14px/1.8 Tahoma,Arial;color:#0f172a">
      <span style="color:${perf.color}">${ar ? 'الحكم' : 'Verdict'}: ${esc(perf[i.lang])}</span> · ${ar ? 'المخاطر' : 'Risk'}: <span style="color:${risk.color}">${esc(risk[i.lang])}</span><br>${esc(verdictText(k, i.lang))}
    </td></tr></table>
    ${storyHtml ? `<h3 style="margin:0 0 8px;font:800 15px Tahoma,Arial;color:${NAVY};border-${ar ? 'right' : 'left'}:4px solid ${TEAL};padding-${ar ? 'right' : 'left'}:10px">${ar ? 'القراءة التحليلية' : 'Analytical reading'}</h3>${storyHtml}` : ''}
    ${actionsHtml ? `<h3 style="margin:18px 0 8px;font:800 15px Tahoma,Arial;color:${NAVY};border-${ar ? 'right' : 'left'}:4px solid ${TEAL};padding-${ar ? 'right' : 'left'}:10px">${ar ? 'القرارات المطلوبة' : 'Decisions required'}</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4eaf2;border-radius:10px">${actionsHtml}</table>` : ''}
    ` : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:14px 16px;background:#fff7e6;border:1px solid #f5d9a3;border-radius:10px;font:700 14px/1.7 Tahoma,Arial;color:#7c4a03">${ar ? 'لا توجد استجابات ضمن هذا النطاق خلال الفترة المحددة.' : 'No responses in this scope for the selected period.'}</td></tr></table>`}
    ${btn}
    ${att}
  </td></tr>
  <tr><td style="background:#f8fafc;border:1px solid #e4eaf2;border-top:0;border-radius:0 0 16px 16px;padding:14px 26px;font:700 11px/1.7 Tahoma,Arial;color:#94a3b8">
    ${esc(org)}<br>${ar ? 'النتائج مجمّعة ولا تعرض هوية المشاركين. هذه رسالة آلية من المنصة — لا تردّ عليها.' : 'Aggregated, anonymous results. Automated message — please do not reply.'}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** تحويل Uint8Array إلى base64 (يعمل في المتصفح وفي Node) */
export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  return btoa(s);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function parseRecipients(s: string): string[] {
  return Array.from(new Set(s.split(/[\s,;،]+/).map(x => x.trim().toLowerCase()).filter(x => EMAIL_RE.test(x))));
}
