// بوابة أَثَر — الاستشارات: الأنواع، التسميات، الحسابات، البريد، عرض السعر PDF
import type { Lang, T } from './content';
import { t } from './content';
import { money, num } from './payments';
import type { PaymentSettings } from './payments';

export type ReqStatus = 'new' | 'reviewing' | 'quoted' | 'accepted' | 'declined' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'superseded';
export type QuoteItem = { d: string; q: number; u: number };
export type ConsultingRequest = {
  id: string; created_at: string; updated_at?: string; user_id?: string | null; full_name: string; email: string; phone?: string | null; organization?: string | null; sector?: string | null;
  area: string; title: string; details: string; goals?: string | null; timeline?: string | null; budget_range?: string | null; lang?: string | null; status: ReqStatus;
  assigned_to?: string | null; internal_notes?: string | null; client_note?: string | null; decided_at?: string | null; completed_at?: string | null; invoice_id?: string | null;
};
export type Quote = { id: string; request_id: string; created_at: string; created_by?: string | null; version: number; currency: string; items: QuoteItem[]; subtotal: number | string; vat_rate: number | string; vat_amount: number | string; total: number | string; valid_until?: string | null; scope?: string | null; deliverables?: string | null; duration?: string | null; terms?: string | null; status: QuoteStatus; sent_at?: string | null; responded_at?: string | null; client_note?: string | null };
export type Milestone = { id: string; request_id: string; position: number; title: string; due_date?: string | null; status: 'planned' | 'in_progress' | 'done'; note?: string | null; done_at?: string | null; visible_to_client: boolean };
export type Update = { id: string; request_id: string; created_at: string; author_id?: string | null; author_name?: string | null; by_staff: boolean; body: string; visible_to_client: boolean };

export const AREAS: { value: string; label: T; desc: T; icon: string }[] = [
  { value: 'management', label: { ar: 'استشارات إدارية', en: 'Management consulting' }, desc: { ar: 'الهياكل والحوكمة، التخطيط الاستراتيجي، تطوير الأداء المؤسسي.', en: 'Structures and governance, strategic planning, institutional performance.' }, icon: 'compass' },
  { value: 'academic', label: { ar: 'استشارات أكاديمية', en: 'Academic consulting' }, desc: { ar: 'تصميم البرامج والمناهج، توصيف المقررات، المسارات الأكاديمية.', en: 'Program and curriculum design, course specifications, academic pathways.' }, icon: 'school' },
  { value: 'educational', label: { ar: 'استشارات تعليمية', en: 'Educational consulting' }, desc: { ar: 'تطوير أداء المعلمين، استراتيجيات التدريس، التقويم وبيئات التعلم.', en: 'Teacher development, teaching strategies, assessment and learning environments.' }, icon: 'book' },
  { value: 'quality', label: { ar: 'الجودة والاعتماد', en: 'Quality & accreditation' }, desc: { ar: 'بناء أنظمة الجودة، التقويم الذاتي، الاستعداد للاعتماد المؤسسي والبرامجي.', en: 'Quality systems, self-evaluation, readiness for institutional and program accreditation.' }, icon: 'award' },
];
export const SECTORS: { value: string; label: T }[] = [
  { value: 'gov', label: { ar: 'جهة حكومية', en: 'Government' } }, { value: 'edu', label: { ar: 'مؤسسة تعليمية / جامعة', en: 'Educational institution / university' } },
  { value: 'private', label: { ar: 'قطاع خاص', en: 'Private sector' } }, { value: 'nonprofit', label: { ar: 'قطاع غير ربحي', en: 'Non-profit' } }, { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
];
export const BUDGETS: { value: string; label: T }[] = [
  { value: 'na', label: { ar: 'غير محدد بعد', en: 'Not defined yet' } }, { value: 'lt25', label: { ar: 'أقل من 25,000 ر.س', en: 'Under SAR 25,000' } },
  { value: '25-100', label: { ar: '25,000 – 100,000 ر.س', en: 'SAR 25,000 – 100,000' } }, { value: '100-300', label: { ar: '100,000 – 300,000 ر.س', en: 'SAR 100,000 – 300,000' } }, { value: 'gt300', label: { ar: 'أكثر من 300,000 ر.س', en: 'Over SAR 300,000' } },
];
export const STEPS: { label: T; desc: T }[] = [
  { label: { ar: 'الطلب', en: 'Request' }, desc: { ar: 'تصف لنا الحاجة والهدف في دقائق.', en: 'Describe your need and goal in minutes.' } },
  { label: { ar: 'الدراسة وعرض السعر', en: 'Study & proposal' }, desc: { ar: 'نراجع الطلب ونرسل عرضًا بالنطاق والمخرجات والمدة والتكلفة.', en: 'We review and send a proposal with scope, deliverables, duration and cost.' } },
  { label: { ar: 'القبول والتعاقد', en: 'Acceptance' }, desc: { ar: 'توافق إلكترونيًا وتصدر الفاتورة.', en: 'Accept online; the invoice is issued.' } },
  { label: { ar: 'التنفيذ والمتابعة', en: 'Delivery & follow-up' }, desc: { ar: 'مراحل واضحة وتحديثات مستمرة حتى التسليم وقياس الأثر.', en: 'Clear milestones and continuous updates through delivery and impact measurement.' } },
];

export const REQ_STATUS: Record<ReqStatus, T> = {
  new: { ar: 'جديد', en: 'New' }, reviewing: { ar: 'قيد الدراسة', en: 'Under review' }, quoted: { ar: 'أُرسل عرض السعر', en: 'Proposal sent' }, accepted: { ar: 'مقبول — بانتظار السداد', en: 'Accepted — awaiting payment' },
  declined: { ar: 'اعتذر العميل', en: 'Declined by client' }, in_progress: { ar: 'قيد التنفيذ', en: 'In progress' }, completed: { ar: 'مكتمل', en: 'Completed' }, closed: { ar: 'مغلق', en: 'Closed' }, cancelled: { ar: 'ملغى', en: 'Cancelled' },
};
export const reqStatusLabel = (s: string, lang: Lang) => t(REQ_STATUS[s as ReqStatus] || { ar: s, en: s }, lang);
export const QUOTE_STATUS: Record<QuoteStatus, T> = { draft: { ar: 'مسودة', en: 'Draft' }, sent: { ar: 'مُرسل', en: 'Sent' }, accepted: { ar: 'مقبول', en: 'Accepted' }, declined: { ar: 'مرفوض', en: 'Declined' }, superseded: { ar: 'مستبدل', en: 'Superseded' } };
export const areaLabel = (v: string | null | undefined, lang: Lang) => t(AREAS.find(a => a.value === v)?.label || { ar: v || '', en: v || '' }, lang);
export const sectorLabel = (v: string | null | undefined, lang: Lang) => t(SECTORS.find(a => a.value === v)?.label || { ar: v || '—', en: v || '—' }, lang);
export const budgetLabel = (v: string | null | undefined, lang: Lang) => t(BUDGETS.find(a => a.value === v)?.label || { ar: v || '—', en: v || '—' }, lang);
/** مسار الحالة لعرض الخط الزمني للعميل */
export const TIMELINE: ReqStatus[] = ['new', 'reviewing', 'quoted', 'accepted', 'in_progress', 'completed'];
export function timelineIndex(s: ReqStatus): number { if (s === 'declined' || s === 'cancelled') return -1; if (s === 'closed') return TIMELINE.length - 1; return TIMELINE.indexOf(s); }

export type ReqForm = { full_name: string; email: string; phone: string; organization: string; sector: string; area: string; title: string; details: string; goals: string; timeline: string; budget_range: string };
export const EMPTY_FORM: ReqForm = { full_name: '', email: '', phone: '', organization: '', sector: '', area: '', title: '', details: '', goals: '', timeline: '', budget_range: 'na' };
export function validateRequest(f: ReqForm, lang: Lang): string | null {
  const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (f.full_name.trim().length < 3) return m('اكتب الاسم الكامل', 'Enter your full name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return m('البريد الإلكتروني غير صالح', 'Invalid email');
  if (f.organization.trim().length < 2) return m('اكتب اسم الجهة', 'Enter your organization');
  if (!AREAS.some(a => a.value === f.area)) return m('اختر مجال الاستشارة', 'Choose a consulting area');
  if (f.title.trim().length < 5) return m('اكتب عنوانًا مختصرًا للطلب (5 أحرف على الأقل)', 'Enter a short title (5+ characters)');
  if (f.details.trim().length < 30) return m('صف الحاجة بتفصيل أكبر (30 حرفًا على الأقل)', 'Describe the need in more detail (30+ characters)');
  if (f.phone && f.phone.replace(/\D/g, '').length < 7) return m('رقم الجوال غير صالح', 'Invalid phone number');
  return null;
}

/** حساب عرض السعر */
export function quoteTotals(items: QuoteItem[], vatRate: number, pricesIncludeVat = false): { subtotal: number; vat: number; total: number } {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const gross = r2(items.reduce((a, i) => a + num(i.q) * num(i.u), 0));
  if (pricesIncludeVat) { const total = gross; const subtotal = r2(gross / (1 + vatRate / 100)); return { subtotal, vat: r2(total - subtotal), total }; }
  const vat = r2(gross * vatRate / 100); return { subtotal: gross, vat, total: r2(gross + vat) };
}
export function cleanItems(items: QuoteItem[]): QuoteItem[] { return items.map(i => ({ d: String(i.d || '').trim(), q: Math.max(0, num(i.q)), u: Math.max(0, num(i.u)) })).filter(i => i.d && i.q > 0); }
export function validateQuote(q: { items: QuoteItem[]; valid_until?: string | null; scope?: string | null }): string | null {
  const items = cleanItems(q.items); if (!items.length) return 'أضف بندًا واحدًا على الأقل (وصف + كمية)';
  if (!q.scope || q.scope.trim().length < 10) return 'اكتب نطاق العمل (10 أحرف على الأقل)';
  if (q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10)) return 'تاريخ صلاحية العرض في الماضي';
  return null;
}
export const isQuoteExpired = (q: Quote, today: string) => q.status === 'sent' && !!q.valid_until && q.valid_until < today;
export const lines = (s: string | null | undefined) => String(s || '').split(/\r?\n/).map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);

/** إحصاءات اللوحة */
export function pipeline(rows: ConsultingRequest[]) {
  const c: Record<string, number> = {}; for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  return { total: rows.length, open: rows.filter(r => ['new', 'reviewing', 'quoted', 'accepted', 'in_progress'].includes(r.status)).length, byStatus: c, needsAction: (c.new || 0) + (c.accepted || 0) };
}
export function requestsSheet(rows: (ConsultingRequest & { quote_total?: number | string | null })[]) {
  const header = ['التاريخ', 'الجهة', 'الاسم', 'البريد', 'الجوال', 'القطاع', 'المجال', 'العنوان', 'الحالة', 'الميزانية', 'قيمة العرض', 'آخر تحديث'];
  return { name: 'طلبات الاستشارات', rtl: true, widths: [12, 26, 22, 28, 16, 16, 18, 36, 18, 18, 12, 12], rows: [header, ...rows.map(r => [r.created_at.slice(0, 10), r.organization || '', r.full_name, r.email, r.phone || '', sectorLabel(r.sector, 'ar'), areaLabel(r.area, 'ar'), r.title, reqStatusLabel(r.status, 'ar'), budgetLabel(r.budget_range, 'ar'), r.quote_total == null ? '' : num(r.quote_total), (r.updated_at || r.created_at).slice(0, 10)])] };
}

// ---------- البريد ----------
const esc = (s: string) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
function shell(lang: Lang, inner: string): string {
  return `<div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
  <div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="font-size:20px;font-weight:900">${lang === 'ar' ? 'أَثَر' : 'Athar · TRACE'}</div><div style="font-size:12px;opacity:.8">${lang === 'ar' ? 'الاستشارات' : 'Consulting'}</div></div>
  <div style="padding:22px;color:#0f172a;line-height:1.9;font-size:15px">${inner}</div>
  <div style="background:#f8fafc;color:#64748b;font-size:12px;padding:12px 22px">${lang === 'ar' ? 'رسالة آلية من بوابة أَثَر — للاستفسار ردّ على هذا البريد.' : 'Automated message from the Athar portal — reply to this email for help.'}</div></div>`;
}
const btn = (href: string, label: string) => `<p style="margin:18px 0"><a href="${href}" style="background:#0b8a83;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:800;display:inline-block">${label}</a></p>`;
const link = (siteUrl: string, r: ConsultingRequest) => `${siteUrl}/consulting/${r.id}`;
const L = (r: ConsultingRequest): Lang => (r.lang === 'en' ? 'en' : 'ar');

export function requestReceivedEmail(r: ConsultingRequest, siteUrl: string) {
  const lang = L(r); const u = link(siteUrl, r);
  return lang === 'ar'
    ? { subject: `استلمنا طلب الاستشارة — ${r.title}`, html: shell('ar', `<p>مرحبًا ${esc(r.full_name)}،</p><p>استلمنا طلبكم «<b>${esc(r.title)}</b>» (${areaLabel(r.area, 'ar')}). سيدرسه فريقنا ويرسل عرضًا مبدئيًا خلال 3 أيام عمل.</p>${btn(u, 'متابعة الطلب')}<p>رقم الطلب: <bdi>${r.id.slice(0, 8).toUpperCase()}</bdi></p>`) }
    : { subject: `We received your consulting request — ${r.title}`, html: shell('en', `<p>Hello ${esc(r.full_name)},</p><p>We received your request "<b>${esc(r.title)}</b>" (${areaLabel(r.area, 'en')}). Our team will review it and send an initial proposal within 3 business days.</p>${btn(u, 'Track your request')}<p>Reference: <bdi>${r.id.slice(0, 8).toUpperCase()}</bdi></p>`) };
}
export function newRequestAdminEmail(r: ConsultingRequest, siteUrl: string) {
  return { subject: `طلب استشارة جديد — ${r.organization || r.full_name}: ${r.title}`, html: shell('ar', `<p>طلب جديد من <b>${esc(r.full_name)}</b> (${esc(r.organization || '—')}) — ${areaLabel(r.area, 'ar')}.</p><p><b>${esc(r.title)}</b><br>${esc(r.details).slice(0, 600)}</p><p>الميزانية: ${budgetLabel(r.budget_range, 'ar')} · التوقيت: ${esc(r.timeline || '—')}</p>${btn(`${siteUrl}/admin/consulting?open=${r.id}`, 'فتح الطلب')}`) };
}
export function quoteSentEmail(r: ConsultingRequest, q: Quote, siteUrl: string) {
  const lang = L(r); const u = link(siteUrl, r); const total = money(q.total, q.currency, lang);
  return lang === 'ar'
    ? { subject: `عرض سعر الاستشارة — ${r.title}`, html: shell('ar', `<p>مرحبًا ${esc(r.full_name)}،</p><p>أعددنا عرض السعر (الإصدار ${q.version}) لطلبكم «<b>${esc(r.title)}</b>».</p><p>الإجمالي شامل الضريبة: <b>${total}</b>${q.duration ? ` · المدة: ${esc(q.duration)}` : ''}${q.valid_until ? ` · صالح حتى <bdi>${q.valid_until}</bdi>` : ''}</p><p>يمكنكم الاطلاع على النطاق والمخرجات والشروط، ثم القبول أو طلب تعديل من الصفحة:</p>${btn(u, 'عرض السعر والردّ')}`) }
    : { subject: `Consulting proposal — ${r.title}`, html: shell('en', `<p>Hello ${esc(r.full_name)},</p><p>We prepared the proposal (v${q.version}) for "<b>${esc(r.title)}</b>".</p><p>Total incl. VAT: <b>${total}</b>${q.duration ? ` · Duration: ${esc(q.duration)}` : ''}${q.valid_until ? ` · valid until <bdi>${q.valid_until}</bdi>` : ''}</p>${btn(u, 'View proposal & respond')}`) };
}
export function quoteRespondedAdminEmail(r: ConsultingRequest, q: Quote, accepted: boolean, siteUrl: string) {
  return { subject: `${accepted ? '✅ قبول' : '✖ اعتذار'} عرض السعر — ${r.organization || r.full_name}: ${r.title}`, html: shell('ar', `<p><b>${esc(r.full_name)}</b> ${accepted ? 'قبل' : 'اعتذر عن'} عرض السعر (الإصدار ${q.version}) بقيمة <b>${money(q.total, q.currency, 'ar')}</b>.</p>${r.client_note ? `<p>ملاحظة العميل: ${esc(r.client_note)}</p>` : ''}${accepted ? '<p>صدرت الفاتورة تلقائيًا وأُرسلت للعميل. ابدأ بإضافة مراحل التنفيذ.</p>' : ''}${btn(`${siteUrl}/admin/consulting?open=${r.id}`, 'فتح الطلب')}`) };
}
export function statusEmail(r: ConsultingRequest, status: ReqStatus, note: string | null, siteUrl: string) {
  const lang = L(r); const u = link(siteUrl, r); const st = reqStatusLabel(status, lang);
  const body: Record<string, T> = {
    reviewing: { ar: 'بدأ فريقنا دراسة طلبكم وسنوافيكم بعرض السعر قريبًا.', en: 'Our team has started reviewing your request; a proposal will follow shortly.' },
    in_progress: { ar: 'بدأ تنفيذ المشروع. ستجدون مراحل التنفيذ والتحديثات في صفحة الطلب.', en: 'Project delivery has started. Milestones and updates are on your request page.' },
    completed: { ar: 'اكتمل تنفيذ الخدمة الاستشارية. شكرًا لثقتكم — يسعدنا تقييمكم للتجربة.', en: 'The consulting engagement is complete. Thank you for your trust — we would value your feedback.' },
    closed: { ar: 'أُغلق الطلب. يمكنكم فتح طلب جديد في أي وقت.', en: 'The request has been closed. You may open a new request at any time.' },
  };
  const txt = t(body[status] || { ar: `تحدّثت حالة طلبكم إلى: ${st}`, en: `Your request status is now: ${st}` }, lang);
  return { subject: lang === 'ar' ? `تحديث طلب الاستشارة — ${r.title}` : `Consulting request update — ${r.title}`, html: shell(lang, `<p>${lang === 'ar' ? 'مرحبًا' : 'Hello'} ${esc(r.full_name)}،</p><p><b>${st}</b> — ${txt}</p>${note ? `<p style="background:#f8fafc;border-radius:10px;padding:10px 14px">${esc(note)}</p>` : ''}${btn(u, lang === 'ar' ? 'صفحة الطلب' : 'Request page')}`) };
}
export function updateEmail(r: ConsultingRequest, u: Update, siteUrl: string, toClient: boolean) {
  const lang = toClient ? L(r) : 'ar'; const href = toClient ? link(siteUrl, r) : `${siteUrl}/admin/consulting?open=${r.id}`;
  return { subject: lang === 'ar' ? `تحديث جديد — ${r.title}` : `New update — ${r.title}`, html: shell(lang, `<p><b>${esc(u.author_name || (u.by_staff ? 'فريق أَثَر' : r.full_name))}</b>:</p><p style="background:#f8fafc;border-radius:10px;padding:10px 14px;white-space:pre-wrap">${esc(u.body)}</p>${btn(href, lang === 'ar' ? 'فتح الطلب' : 'Open request')}`) };
}

// ---------- عرض السعر PDF (Canvas A4 عمودي — نفس أسلوب الفاتورة) ----------
export const QW = 1654, QH = 2339;
export function renderQuote(canvas: HTMLCanvasElement, d: { r: ConsultingRequest; q: Quote; settings: PaymentSettings | null; legal: { name_ar: string; name_en: string; city: string; email: string }; lang: Lang }): void {
  const { r, q, lang } = d; const rtl = lang === 'ar'; const ctx = canvas.getContext('2d')!; canvas.width = QW; canvas.height = QH;
  const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b', MUTED = '#64748b', TXT = '#0f172a'; const F = 'Tajawal, Arial, sans-serif';
  const Lm = 110, R = QW - 110, W = R - Lm; const x0 = rtl ? R : Lm; const dir = rtl ? -1 : 1;
  ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, QW, QH);
  const text = (str: string, x: number, y: number, size: number, opt: { color?: string; weight?: string; align?: CanvasTextAlign; max?: number } = {}) => { ctx.fillStyle = opt.color || TXT; ctx.font = `${opt.weight || '400'} ${size}px ${F}`; ctx.textAlign = opt.align || (rtl ? 'right' : 'left'); if (opt.max) ctx.fillText(str, x, y, opt.max); else ctx.fillText(str, x, y); };
  const wrap = (str: string, size: number, max: number, weight = '500'): string[] => { ctx.font = `${weight} ${size}px ${F}`; const out: string[] = []; for (const para of String(str || '').split(/\r?\n/)) { let line = ''; for (const w of para.split(/\s+/)) { const tt = line ? `${line} ${w}` : w; if (ctx.measureText(tt).width > max && line) { out.push(line); line = w; } else line = tt; } out.push(line); } return out; };
  let y = 0;
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, QW, 230);
  ctx.beginPath(); ctx.arc(x0 + dir * 60, 115, 48, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(x0 + dir * 60, 115, 28, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x0 + dir * 60, 115, 12, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
  text(rtl ? 'أَثَر' : 'Athar · TRACE', x0 + dir * 135, 105, 54, { color: '#fff', weight: '900' });
  text(rtl ? 'الاستشارات الإدارية والأكاديمية والتعليمية' : 'Management, Academic & Educational Consulting', x0 + dir * 135, 155, 26, { color: 'rgba(255,255,255,.8)', weight: '700' });
  text(rtl ? 'عرض سعر' : 'Proposal', QW - x0, 105, 40, { color: GOLD, weight: '900', align: rtl ? 'left' : 'right' });
  text(`${rtl ? 'الإصدار' : 'Version'} ${q.version} · ${r.id.slice(0, 8).toUpperCase()}`, QW - x0, 158, 30, { color: '#fff', weight: '700', align: rtl ? 'left' : 'right' });
  y = 320;
  const block = (title: string, ls: string[], x: number, align: CanvasTextAlign) => { let yy = y; text(title, x, yy, 24, { color: TEAL, weight: '900', align }); yy += 42; for (const l of ls) { if (!l) continue; text(l, x, yy, 27, { weight: '700', align, max: W / 2 - 30 }); yy += 40; } return yy; };
  const y1 = block(rtl ? 'من' : 'From', [rtl ? d.legal.name_ar : d.legal.name_en, d.legal.city, d.legal.email, d.settings?.vat_number ? `${rtl ? 'الرقم الضريبي' : 'VAT No.'}: ${d.settings.vat_number}` : ''], x0, rtl ? 'right' : 'left');
  const y2 = block(rtl ? 'إلى' : 'To', [r.organization || '', r.full_name, r.email, r.phone || ''], QW - x0, rtl ? 'left' : 'right');
  y = Math.max(y1, y2) + 10;
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(Lm, y, W, 110);
  const meta = [[rtl ? 'تاريخ العرض' : 'Date', (q.sent_at || q.created_at).slice(0, 10)], [rtl ? 'صالح حتى' : 'Valid until', q.valid_until || '—'], [rtl ? 'المجال' : 'Area', areaLabel(r.area, lang)], [rtl ? 'المدة' : 'Duration', q.duration || '—']];
  const cw = W / meta.length; meta.forEach((m, i) => { const cx = rtl ? R - i * cw - 24 : Lm + i * cw + 24; text(m[0], cx, y + 42, 22, { color: MUTED, weight: '700' }); text(m[1], cx, y + 84, 26, { weight: '800', max: cw - 40 }); });
  y += 150;
  text(rtl ? 'الموضوع' : 'Subject', x0, y, 24, { color: TEAL, weight: '900' }); y += 40; wrap(r.title, 30, W, '900').forEach(l => { text(l, x0, y, 30, { weight: '900' }); y += 42; });
  y += 10; text(rtl ? 'نطاق العمل' : 'Scope of work', x0, y, 24, { color: TEAL, weight: '900' }); y += 38; wrap(q.scope || '', 24, W).forEach(l => { text(l, x0, y, 24, { color: TXT, weight: '500' }); y += 34; });
  if (q.deliverables) { y += 10; text(rtl ? 'المخرجات' : 'Deliverables', x0, y, 24, { color: TEAL, weight: '900' }); y += 38; for (const dl of lines(q.deliverables)) { wrap(`• ${dl}`, 24, W).forEach(l => { text(l, x0, y, 24, { weight: '500' }); y += 34; }); } }
  y += 20;
  const cols = rtl ? [R, R - 900, R - 1080, R - 1300] : [Lm, Lm + 900, Lm + 1080, Lm + 1300];
  ctx.fillStyle = NAVY; ctx.fillRect(Lm, y, W, 60);
  [rtl ? 'البند' : 'Item', rtl ? 'الكمية' : 'Qty', rtl ? 'سعر الوحدة' : 'Unit price', rtl ? 'المجموع' : 'Amount'].forEach((h, i) => text(h, cols[i] + dir * 20, y + 41, 23, { color: '#fff', weight: '800' }));
  y += 60;
  for (const it of cleanItems(q.items)) {
    const ls = wrap(it.d, 24, 840, '700'); const rowH = Math.max(1, ls.length) * 32 + 22;
    ls.forEach((l, i) => text(l, cols[0] + dir * 20, y + 38 + i * 32, 24, { weight: '700' }));
    text(String(it.q), cols[1] + dir * 20, y + 38, 24); text(money(it.u, q.currency, lang), cols[2] + dir * 20, y + 38, 24); text(money(it.q * it.u, q.currency, lang), cols[3] + dir * 20, y + 38, 24, { weight: '800' });
    y += rowH; ctx.fillStyle = '#e2e8f0'; ctx.fillRect(Lm, y, W, 2);
  }
  y += 44;
  const tx = rtl ? Lm + 520 : R - 520; const tl = rtl ? Lm : R;
  const row = (k: string, v: string, big = false) => { text(k, tx, y, big ? 30 : 26, { color: big ? TXT : MUTED, weight: big ? '900' : '700', align: rtl ? 'right' : 'left' }); text(v, tl, y, big ? 34 : 27, { weight: big ? '900' : '800', align: rtl ? 'left' : 'right', color: big ? NAVY : TXT }); y += big ? 60 : 46; };
  row(rtl ? 'المجموع قبل الضريبة' : 'Subtotal', money(q.subtotal, q.currency, lang)); row(rtl ? `ضريبة القيمة المضافة (${num(q.vat_rate)}%)` : `VAT (${num(q.vat_rate)}%)`, money(q.vat_amount, q.currency, lang));
  ctx.fillStyle = GOLD; ctx.fillRect(rtl ? Lm : R - 520, y - 30, 520, 3); y += 10; row(rtl ? 'الإجمالي' : 'Total', money(q.total, q.currency, lang), true);
  if (q.status === 'accepted') { ctx.save(); ctx.translate(rtl ? R - 320 : Lm + 320, y - 80); ctx.rotate(rtl ? 0.25 : -0.25); ctx.strokeStyle = '#059669'; ctx.lineWidth = 8; ctx.strokeRect(-200, -60, 400, 120); text(rtl ? 'مقبول' : 'ACCEPTED', 0, 25, 70, { color: '#059669', weight: '900', align: 'center' }); ctx.restore(); }
  y += 30;
  const terms = q.terms || (rtl ? d.settings?.terms_ar : d.settings?.terms_en) || '';
  if (terms && y < QH - 260) { text(rtl ? 'الشروط' : 'Terms', x0, y, 22, { color: TEAL, weight: '900' }); y += 34; wrap(terms, 21, W).forEach(l => { if (y < QH - 130) { text(l, x0, y, 21, { color: MUTED }); y += 30; } }); }
  ctx.fillStyle = NAVY; ctx.fillRect(0, QH - 90, QW, 90);
  text(rtl ? `${d.legal.name_ar} · ${d.legal.email}` : `${d.legal.name_en} · ${d.legal.email}`, QW / 2, QH - 36, 22, { color: 'rgba(255,255,255,.85)', weight: '700', align: 'center' });
}
