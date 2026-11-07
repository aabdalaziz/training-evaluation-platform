// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P53-ب «أرسل من بريدك» — مسوَّدات بريد النتائج من بريد الطاقم الشخصي (قبل تفعيل النطاق/Resend)
 *  لا خادم ولا جدول: دوال صرفة تبني (إلى · الموضوع · النصّ) ورابط mailto لكل متقدّم على حدة، ونصًّا مجمَّعًا للصق في البريد رسالةً رسالة.
 *  قواعد: رسالة لكل طالب وحده (لا BCC) · البطاقة العلنية لا تُظهر بريدًا ولا هاتفًا · لا درجات رقمية في البريد — المستوى والرابط فقط.
 *  الاسم الرسمي: «إشعار نتيجة تحديد المستوى — بريد يدوي / Manual placement result notice».
 */
export type MailRow = { name: string | null; email: string; code: string | null; demonstrated?: string | null; entry?: string | null; program_name?: string | null; classroom?: string | null };
export type MailDraft = { to: string; subject: string; body: string; mailto: string; url: string };
export const LEVEL_AR: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
export const SITE_DEFAULT = 'https://athar-portal.vercel.app';
/** الاسم الأول فقط (كما في البطاقة العلنية) — يتخطّى «د.» و«أ.» و«م.» */
export function firstName(name: string | null | undefined): string { const parts = String(name || '').trim().split(/\s+/).filter((p) => p && !/^(د|أ|م|دكتور|الأستاذ|الأستاذة)\.?$/.test(p)); return parts[0] || ''; }
export function resultUrl(code: string, site = SITE_DEFAULT): string { return `${site.replace(/\/$/, '')}/miaar/result/${encodeURIComponent(code)}`; }
/** مسوَّدة رسالة لمتقدّم واحد — null إن لم يكن له رمز نتيجة بعد */
export function resultMailDraft(r: MailRow, opts: { site?: string; sender?: string; org?: string } = {}): MailDraft | null {
  if (!r.code || !r.email) return null; const url = resultUrl(r.code, opts.site); const fn = firstName(r.name); const lvl = r.demonstrated ? LEVEL_AR[r.demonstrated] || r.demonstrated : '';
  const subject = 'نتيجتك في اختبار تحديد المستوى «مِعيار» — من أَثَر';
  const lines = [
    `السلام عليكم${fn ? ` ${fn}` : ''}،`,
    '',
    'شكرًا لإتمامك اختبار تحديد المستوى «مِعيار».',
    lvl ? `مستواك المثبت: ${lvl}.` : '',
    r.program_name ? `وقد تمّ تسكينك في: ${r.program_name}${r.classroom ? ` — شعبة ${r.classroom}` : ''}.` : '',
    '',
    'بطاقتك الدائمة (المستوى · توصية الالتحاق · شهادة النموّ · خطّتك):',
    url,
    '',
    'هذا الرابط لك وحدك؛ لا تشاركه مع غيرك.',
    `مع تحيّات ${opts.org ? `فريق ${opts.org}` : 'فريق أَثَر'}${opts.sender ? ` — ${opts.sender}` : ''}.`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));
  const body = lines.join('\n');
  const mailto = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to: r.email, subject, body, mailto, url };
}
/** نصّ مجمَّع للصق: رسالة لكل طالب بفاصل واضح — يتخطّى من لا رمز له ويعيد عدّهم */
export function bulkMailText(rows: MailRow[], opts: { site?: string; sender?: string; org?: string } = {}): { text: string; count: number; skipped: number } {
  const seen = new Set<string>(); const parts: string[] = []; let skipped = 0;
  for (const r of rows) { const k = `${r.email}|${r.code}`; if (seen.has(k)) continue; seen.add(k); const d = resultMailDraft(r, opts); if (!d) { skipped += 1; continue; } parts.push(`إلى: ${d.to}\nالموضوع: ${d.subject}\n\n${d.body}`); }
  return { text: parts.join('\n\n' + '─'.repeat(40) + '\n\n'), count: parts.length, skipped };
}
/** ذاكرة محلية في متصفّح الموظّف فقط (لا خادم): من فُتحت له رسالة ومتى — تساعد على عدم إرسال الرسالة مرّتين */
export const MAILED_KEY = 'miaar-mailed-v1';
export function readMailed(storage: { getItem(k: string): string | null } | null | undefined): Record<string, string> { try { const v = storage?.getItem(MAILED_KEY); const j = v ? JSON.parse(v) : {}; return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } }
export function markMailed(storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined, code: string, when = new Date(), on = true): Record<string, string> {
  const m = readMailed(storage); if (on) m[code] = when.toISOString(); else delete m[code]; try { storage?.setItem(MAILED_KEY, JSON.stringify(m)); } catch { /* تخزين ممتلئ أو معطَّل */ } return m;
}
