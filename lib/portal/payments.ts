// أَثَر — P3: منطق الدفع والفواتير (دوال نقية + رسم الفاتورة PDF على Canvas)
import type { Lang, T } from './content';
import { t } from './content';

export type InvoiceStatus = 'unpaid' | 'under_review' | 'paid' | 'cancelled' | 'refunded' | 'waived';
export type PaymentSettings = {
  bank_name: string; account_name: string; iban: string; swift?: string | null; vat_rate: number | string; vat_number?: string | null;
  prices_include_vat: boolean; invoice_prefix: string; next_invoice_no?: number; due_days: number; bank_transfer_enabled: boolean; card_enabled: boolean;
  currency: string; terms_ar: string; terms_en: string;
};
export type Invoice = {
  id: string; invoice_no: string; created_at: string; enrollment_id?: string | null; program_id?: string | null; user_id?: string | null;
  customer_name: string; customer_email: string; customer_phone?: string | null; customer_org?: string | null; description: string; currency: string;
  subtotal: number | string; vat_rate: number | string; vat_amount: number | string; total: number | string; status: InvoiceStatus; method?: string | null;
  due_date?: string | null; paid_at?: string | null; receipt_path?: string | null; receipt_uploaded_at?: string | null; transfer_ref?: string | null; payer_note?: string | null;
  gateway_payment_id?: string | null; notes?: string | null; lang?: string | null;
};

export const INV_STATUS: Record<InvoiceStatus, T> = {
  unpaid: { ar: 'بانتظار الدفع', en: 'Awaiting payment' },
  under_review: { ar: 'إيصال قيد المراجعة', en: 'Receipt under review' },
  paid: { ar: 'مدفوعة', en: 'Paid' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled' },
  refunded: { ar: 'مستردّة', en: 'Refunded' },
  waived: { ar: 'معفاة', en: 'Waived' },
};
export const invStatusLabel = (s: string, lang: Lang) => t(INV_STATUS[s as InvoiceStatus] || { ar: s, en: s }, lang);
export const METHOD_LABEL: Record<string, T> = { bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' }, card: { ar: 'بطاقة (Moyasar)', en: 'Card (Moyasar)' }, cash: { ar: 'نقدًا', en: 'Cash' }, waived: { ar: 'إعفاء', en: 'Waived' } };
export const methodLabel = (m: string | null | undefined, lang: Lang) => (m ? t(METHOD_LABEL[m] || { ar: m, en: m }, lang) : '—');

export const num = (x: number | string | null | undefined): number => { const n = Number(x); return isFinite(n) ? n : 0; };
export function money(x: number | string | null | undefined, currency: string, lang: Lang): string {
  const n = num(x); const s = n.toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const c = (currency || 'SAR').toUpperCase(); const cl = c === 'SAR' ? (lang === 'ar' ? 'ر.س' : 'SAR') : c;
  return lang === 'ar' ? `${s} ${cl}` : `${cl} ${s}`;
}

/** حساب الضريبة بنفس منطق قاعدة البيانات (للمعاينة والاختبار) */
export function computeAmounts(fee: number, vatRate: number, pricesIncludeVat: boolean): { subtotal: number; vat: number; total: number } {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  if (pricesIncludeVat) { const total = r2(fee); const subtotal = r2(fee / (1 + vatRate / 100)); return { subtotal, vat: r2(total - subtotal), total }; }
  const subtotal = r2(fee); const vat = r2(fee * vatRate / 100); return { subtotal, vat, total: r2(subtotal + vat) };
}

export const toHalalas = (total: number | string) => Math.round(num(total) * 100);
export const isValidIban = (iban: string) => /^SA\d{22}$/.test(iban.replace(/\s+/g, '').toUpperCase());
export const formatIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
export const receiptPath = (userId: string, invoiceNo: string, filename: string) => `${userId}/${invoiceNo}-${Date.now()}.${(filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'}`;
export const isOverdue = (inv: Invoice, today: string) => inv.status === 'unpaid' && !!inv.due_date && inv.due_date < today;

export type Totals = { count: number; paid: number; outstanding: number; review: number };
export function totals(rows: Invoice[]): Totals {
  return rows.reduce((a, r) => ({ count: a.count + 1, paid: a.paid + (r.status === 'paid' ? num(r.total) : 0), outstanding: a.outstanding + (r.status === 'unpaid' || r.status === 'under_review' ? num(r.total) : 0), review: a.review + (r.status === 'under_review' ? 1 : 0) }), { count: 0, paid: 0, outstanding: 0, review: 0 });
}

/** التحقق من استجابة Moyasar قبل اعتبار الفاتورة مدفوعة */
export function verifyGatewayPayment(payment: { status?: string; amount?: number; currency?: string; metadata?: Record<string, string> } | null | undefined, inv: Invoice): { ok: boolean; reason?: string } {
  if (!payment) return { ok: false, reason: 'no_payment' };
  if (payment.status !== 'paid') return { ok: false, reason: `status_${payment.status || 'unknown'}` };
  if (Number(payment.amount) !== toHalalas(inv.total)) return { ok: false, reason: 'amount_mismatch' };
  if (String(payment.currency || '').toUpperCase() !== String(inv.currency || 'SAR').toUpperCase()) return { ok: false, reason: 'currency_mismatch' };
  if (payment.metadata?.invoice_id && payment.metadata.invoice_id !== inv.id) return { ok: false, reason: 'invoice_mismatch' };
  return { ok: true };
}

/** ورقة Excel للفواتير */
export function invoicesSheet(rows: (Invoice & { program_name?: string })[]) {
  const header = ['رقم الفاتورة', 'التاريخ', 'العميل', 'البريد', 'البرنامج', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'العملة', 'الحالة', 'طريقة الدفع', 'تاريخ السداد', 'مرجع التحويل'];
  return { name: 'الفواتير', rtl: true, widths: [16, 12, 24, 28, 34, 12, 10, 12, 8, 14, 14, 12, 18],
    rows: [header, ...rows.map(r => [r.invoice_no, r.created_at.slice(0, 10), r.customer_name, r.customer_email, r.program_name || r.description, num(r.subtotal), num(r.vat_amount), num(r.total), r.currency, invStatusLabel(r.status, 'ar'), methodLabel(r.method, 'ar'), r.paid_at ? r.paid_at.slice(0, 10) : '', r.transfer_ref || ''])] };
}

// ---------- البريد ----------
const esc = (s: string) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
function shell(lang: Lang, inner: string): string {
  return `<div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
  <div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="font-size:20px;font-weight:900">${lang === 'ar' ? 'أَثَر' : 'Athar · TRACE'}</div><div style="font-size:12px;opacity:.8">${lang === 'ar' ? 'بوابة التعليم والتدريب والتطوير' : 'Education, Training & Development Portal'}</div></div>
  <div style="padding:22px;color:#0f172a;line-height:1.9;font-size:15px">${inner}</div>
  <div style="background:#f8fafc;color:#64748b;font-size:12px;padding:12px 22px">${lang === 'ar' ? 'رسالة آلية من بوابة أَثَر — للاستفسار ردّ على هذا البريد.' : 'Automated message from the Athar portal — reply to this email for help.'}</div></div>`;
}
export function invoiceEmail(inv: Invoice, programName: string, siteUrl: string): { subject: string; html: string } {
  const lang: Lang = inv.lang === 'en' ? 'en' : 'ar'; const url = `${siteUrl}/pay/${inv.id}`;
  const subject = lang === 'ar' ? `فاتورة ${inv.invoice_no} — ${programName}` : `Invoice ${inv.invoice_no} — ${programName}`;
  const html = shell(lang, `<p style="margin:0 0 10px">${lang === 'ar' ? 'مرحبًا' : 'Dear'} ${esc(inv.customer_name)}،</p>
    <p style="margin:0 0 10px">${lang === 'ar' ? `صدرت فاتورة رسوم التسجيل في <b>${esc(programName)}</b>.` : `Your registration invoice for <b>${esc(programName)}</b> has been issued.`}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px"><tr><td style="padding:6px 0;color:#64748b">${lang === 'ar' ? 'رقم الفاتورة' : 'Invoice no.'}</td><td style="padding:6px 0;text-align:${lang === 'ar' ? 'left' : 'right'}"><b>${esc(inv.invoice_no)}</b></td></tr><tr><td style="padding:6px 0;color:#64748b">${lang === 'ar' ? 'الإجمالي شامل الضريبة' : 'Total incl. VAT'}</td><td style="padding:6px 0;text-align:${lang === 'ar' ? 'left' : 'right'}"><b>${money(inv.total, inv.currency, lang)}</b></td></tr>${inv.due_date ? `<tr><td style="padding:6px 0;color:#64748b">${lang === 'ar' ? 'آخر موعد للسداد' : 'Due date'}</td><td style="padding:6px 0;text-align:${lang === 'ar' ? 'left' : 'right'}">${inv.due_date}</td></tr>` : ''}</table>
    <p style="margin:14px 0 0"><a href="${url}" style="background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:800;display:inline-block">${lang === 'ar' ? 'عرض الفاتورة والدفع' : 'View invoice & pay'}</a></p>`);
  return { subject, html };
}
export function receiptEmail(inv: Invoice, programName: string, siteUrl: string): { subject: string; html: string } {
  const lang: Lang = inv.lang === 'en' ? 'en' : 'ar';
  const subject = lang === 'ar' ? `تأكيد السداد — ${inv.invoice_no}` : `Payment confirmed — ${inv.invoice_no}`;
  const html = shell(lang, `<p style="margin:0 0 10px">${lang === 'ar' ? 'مرحبًا' : 'Dear'} ${esc(inv.customer_name)}،</p>
    <p style="margin:0 0 10px">${lang === 'ar' ? `تم تأكيد سداد الفاتورة <b>${esc(inv.invoice_no)}</b> بمبلغ <b>${money(inv.total, inv.currency, lang)}</b> لبرنامج <b>${esc(programName)}</b>. شكرًا لك — مقعدك مؤكّد.` : `Payment of <b>${money(inv.total, inv.currency, lang)}</b> for invoice <b>${esc(inv.invoice_no)}</b> (<b>${esc(programName)}</b>) is confirmed. Thank you — your seat is secured.`}</p>
    <p style="margin:14px 0 0"><a href="${siteUrl}/pay/${inv.id}" style="background:#0f2a4e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:800;display:inline-block">${lang === 'ar' ? 'تنزيل الفاتورة PDF' : 'Download invoice PDF'}</a></p>`);
  return { subject, html };
}

// ---------- رسم الفاتورة (A4 عمودي 1654×2339 ≈ 200dpi) ----------
export const IW = 1654, IH = 2339;
export type InvoiceRender = { inv: Invoice; programName: string; settings: PaymentSettings; legal: { name_ar: string; name_en: string; city: string; email: string }; lang: Lang; qrUrl?: string };
export function renderInvoice(canvas: HTMLCanvasElement, d: InvoiceRender): void {
  const { inv, settings: s, lang } = d; const rtl = lang === 'ar'; const ctx = canvas.getContext('2d')!; canvas.width = IW; canvas.height = IH;
  const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b', MUTED = '#64748b', TXT = '#0f172a'; const F = 'Tajawal, Arial, sans-serif';
  const L = 110, R = IW - 110; const x0 = rtl ? R : L; const dir = rtl ? -1 : 1;
  ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, IW, IH);
  const text = (str: string, x: number, y: number, size: number, opt: { color?: string; weight?: string; align?: CanvasTextAlign; max?: number } = {}) => { ctx.fillStyle = opt.color || TXT; ctx.font = `${opt.weight || '400'} ${size}px ${F}`; ctx.textAlign = opt.align || (rtl ? 'right' : 'left'); if (opt.max) ctx.fillText(str, x, y, opt.max); else ctx.fillText(str, x, y); };
  const wrap = (str: string, size: number, max: number): string[] => { ctx.font = `500 ${size}px ${F}`; const out: string[] = []; let line = ''; for (const w of String(str || '').split(/\s+/)) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; };
  // header band
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, IW, 230);
  ctx.beginPath(); ctx.arc(x0 + dir * 60, 115, 48, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(x0 + dir * 60, 115, 28, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x0 + dir * 60, 115, 12, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill();
  text(rtl ? 'أَثَر' : 'Athar · TRACE', x0 + dir * 135, 105, 54, { color: '#fff', weight: '900' });
  text(rtl ? 'بوابة التعليم والتدريب والتطوير' : 'Education, Training & Development Portal', x0 + dir * 135, 155, 26, { color: 'rgba(255,255,255,.8)', weight: '700' });
  text(rtl ? 'فاتورة ضريبية مبسطة' : 'Simplified Tax Invoice', IW - x0, 105, 40, { color: GOLD, weight: '900', align: rtl ? 'left' : 'right' });
  text(inv.invoice_no, IW - x0, 158, 34, { color: '#fff', weight: '700', align: rtl ? 'left' : 'right' });
  // parties
  let y = 330;
  const block = (title: string, lines: string[], x: number, align: CanvasTextAlign) => { let yy = y; text(title, x, yy, 24, { color: TEAL, weight: '900', align }); yy += 42; for (const l of lines) { if (!l) continue; text(l, x, yy, 27, { weight: '700', align }); yy += 40; } return yy; };
  const seller = [rtl ? d.legal.name_ar : d.legal.name_en, rtl ? d.legal.name_en : d.legal.name_ar, d.legal.city, d.legal.email, s.vat_number ? `${rtl ? 'الرقم الضريبي' : 'VAT No.'}: ${s.vat_number}` : ''];
  const buyer = [inv.customer_name, inv.customer_org || '', inv.customer_email, inv.customer_phone || ''];
  const y1 = block(rtl ? 'من' : 'From', seller, x0, rtl ? 'right' : 'left');
  const y2 = block(rtl ? 'إلى' : 'Bill to', buyer, IW - x0, rtl ? 'left' : 'right');
  y = Math.max(y1, y2) + 20;
  // meta row
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(L, y, R - L, 110);
  const meta = [[rtl ? 'تاريخ الإصدار' : 'Issue date', inv.created_at.slice(0, 10)], [rtl ? 'آخر موعد للسداد' : 'Due date', inv.due_date || '—'], [rtl ? 'الحالة' : 'Status', invStatusLabel(inv.status, lang)], [rtl ? 'طريقة الدفع' : 'Method', methodLabel(inv.method, lang)]];
  const cw = (R - L) / meta.length;
  meta.forEach((m, i) => { const cx = rtl ? R - i * cw - 24 : L + i * cw + 24; text(m[0], cx, y + 42, 22, { color: MUTED, weight: '700' }); text(m[1], cx, y + 84, 27, { weight: '800' }); });
  y += 170;
  // items table
  const cols = rtl ? [R, R - 780, R - 960, R - 1180] : [L, L + 780, L + 960, L + 1180];
  ctx.fillStyle = NAVY; ctx.fillRect(L, y, R - L, 64);
  const heads = [rtl ? 'البيان' : 'Description', rtl ? 'الكمية' : 'Qty', rtl ? 'السعر' : 'Price', rtl ? 'المجموع' : 'Amount'];
  heads.forEach((h, i) => text(h, cols[i] + dir * 24, y + 43, 24, { color: '#fff', weight: '800', align: i === 0 ? (rtl ? 'right' : 'left') : (rtl ? 'right' : 'left') }));
  y += 64;
  const desc = rtl ? `${inv.description}` : `Registration fee: ${d.programName}`;
  text(desc, cols[0] + dir * 24, y + 56, 27, { weight: '700', max: 730 }); text('1', cols[1] + dir * 24, y + 56, 27); text(money(inv.subtotal, inv.currency, lang), cols[2] + dir * 24, y + 56, 27); text(money(inv.subtotal, inv.currency, lang), cols[3] + dir * 24, y + 56, 27, { weight: '800' });
  y += 90; ctx.fillStyle = '#e2e8f0'; ctx.fillRect(L, y, R - L, 2); y += 40;
  // totals
  const tx = rtl ? L + 520 : R - 520; const tl = rtl ? L : R;
  const row = (k: string, v: string, big = false) => { text(k, tx, y, big ? 30 : 26, { color: big ? TXT : MUTED, weight: big ? '900' : '700', align: rtl ? 'right' : 'left' }); text(v, tl, y, big ? 34 : 27, { weight: big ? '900' : '800', align: rtl ? 'left' : 'right', color: big ? NAVY : TXT }); y += big ? 60 : 46; };
  row(rtl ? 'المجموع قبل الضريبة' : 'Subtotal', money(inv.subtotal, inv.currency, lang));
  row(rtl ? `ضريبة القيمة المضافة (${num(inv.vat_rate)}%)` : `VAT (${num(inv.vat_rate)}%)`, money(inv.vat_amount, inv.currency, lang));
  ctx.fillStyle = GOLD; ctx.fillRect(rtl ? L : R - 520, y - 30, 520, 3); y += 10;
  row(rtl ? 'الإجمالي المستحق' : 'Total due', money(inv.total, inv.currency, lang), true);
  if (inv.status === 'paid') { ctx.save(); ctx.translate(rtl ? R - 320 : L + 320, y - 80); ctx.rotate(rtl ? 0.25 : -0.25); ctx.strokeStyle = '#059669'; ctx.lineWidth = 8; ctx.strokeRect(-200, -60, 400, 120); text(rtl ? 'مدفوعة' : 'PAID', 0, 25, 70, { color: '#059669', weight: '900', align: 'center' }); ctx.restore(); }
  y += 60;
  // payment instructions
  if (inv.status === 'unpaid' || inv.status === 'under_review') {
    ctx.fillStyle = '#f0fdfa'; ctx.fillRect(L, y, R - L, 230); ctx.fillStyle = TEAL; ctx.fillRect(rtl ? R - 8 : L, y, 8, 230);
    text(rtl ? 'بيانات التحويل البنكي' : 'Bank transfer details', x0 + dir * 30, y + 50, 28, { color: TEAL, weight: '900' });
    const lines = [`${rtl ? 'البنك' : 'Bank'}: ${s.bank_name}`, `${rtl ? 'اسم الحساب' : 'Account name'}: ${s.account_name}`, `IBAN: ${formatIban(s.iban)}`, `${rtl ? 'يرجى كتابة رقم الفاتورة في وصف التحويل' : 'Please quote the invoice number in the transfer description'}: ${inv.invoice_no}`];
    lines.forEach((l, i) => text(l, x0 + dir * 30, y + 100 + i * 40, 25, { weight: i === 2 ? '800' : '600' }));
    y += 270;
  }
  // terms + footer
  wrap(rtl ? s.terms_ar : s.terms_en, 21, R - L).forEach((l, i) => text(l, x0, y + 30 + i * 32, 21, { color: MUTED, weight: '500' }));
  ctx.fillStyle = NAVY; ctx.fillRect(0, IH - 90, IW, 90);
  text(rtl ? `${d.legal.name_ar} · ${d.legal.email}` : `${d.legal.name_en} · ${d.legal.email}`, IW / 2, IH - 36, 22, { color: 'rgba(255,255,255,.85)', weight: '700', align: 'center' });
}

/** PDF صفحة واحدة A4 عمودية من صورة JPEG (نفس أسلوب شهادات المنصة، بلا اعتماديات) */
export function jpegToPortraitPdf(jpeg: Uint8Array, w: number, h: number, title: string): Uint8Array {
  const PW = 595.28, PH = 841.89; const enc = new TextEncoder();
  const chunks: Uint8Array[] = []; const offsets: number[] = []; let pos = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); pos += b.length; };
  const obj = (n: number, body: string, stream?: Uint8Array) => { offsets[n] = pos; push(`${n} 0 obj\n${body}\n`); if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); } push('endobj\n'); };
  let hex = 'FEFF'; for (const ch of title) { const c = ch.codePointAt(0)!; if (c > 0xffff) { const v = c - 0x10000; hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0'); } else hex += c.toString(16).padStart(4, '0'); }
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [4 0 R] /Count 1 >>'); obj(3, `<< /Title <${hex}> /Producer (Athar Portal) >>`);
  const content = enc.encode(`q ${PW.toFixed(2)} 0 0 ${PH.toFixed(2)} 0 0 cm /Im0 Do Q`);
  obj(4, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 6 0 R >> >> /Contents 5 0 R >>`);
  obj(5, `<< /Length ${content.length} >>`, content);
  obj(6, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  const xref = pos; let x = 'xref\n0 7\n0000000000 65535 f \n'; for (let i = 1; i <= 6; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  x += `trailer\n<< /Size 7 /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`; push(x);
  const out = new Uint8Array(pos); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
}
