// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P83 */
/**
 * قراءة إيصال التحويل البنكي (نصّ OCR من «أَثَر يقرأ») ومطابقته بالفاتورة — دوال نقيّة بلا تبعيّات.
 *  parseReceipt(text)                 → {amount, currency, date, ref, bank, iban, iban_tail, sender, confidence}
 *  matchReceipt(parsed, invoice, settings) → {verdict: match|partial|mismatch, score, checks[]}
 *  القاعدة الذهبية: الناتج نصّ يُعرض للمستخدم ليؤكّده؛ الصورة لا تُقرأ إلا على الجهاز.
 */

export type ParsedReceipt = {
  amount: number | null; currency: string | null; date: string | null; ref: string | null; bank: string | null;
  iban: string | null; iban_tail: string | null; sender: string | null; confidence: number; amounts: number[];
};
export type ReceiptCheck = { key: 'amount' | 'iban' | 'date' | 'ref'; ok: boolean | null; label_ar: string; note_ar: string };
export type ReceiptVerdict = 'match' | 'partial' | 'mismatch';
export type ReceiptMatch = { verdict: ReceiptVerdict; score: number; checks: ReceiptCheck[]; summary_ar: string };
export const VERDICT_AR: Record<ReceiptVerdict, string> = { match: 'مطابق للفاتورة', partial: 'مطابقة جزئية — يحتاج نظرة', mismatch: 'غير مطابق' };

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩', FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
/** تحويل الأرقام العربية/الفارسية إلى لاتينية وتوحيد الفواصل. */
export function latinDigits(s: string): string {
  return String(s || '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٫]/g, '.').replace(/[٬،]/g, ',');
}

const BANKS: { re: RegExp; ar: string }[] = [
  { re: /الراجحي|al ?rajhi/i, ar: 'مصرف الراجحي' }, { re: /الأهلي|الاهلي|\bsnb\b|\bncb\b|saudi national bank/i, ar: 'البنك الأهلي السعودي' },
  { re: /بنك الرياض|riyad ?bank/i, ar: 'بنك الرياض' }, { re: /الإنماء|الانماء|alinma/i, ar: 'مصرف الإنماء' }, { re: /البلاد|al ?bilad/i, ar: 'بنك البلاد' },
  { re: /\bساب\b|\bsab\b|sabb/i, ar: 'البنك السعودي الأول (ساب)' }, { re: /الجزيرة|al ?jazira/i, ar: 'بنك الجزيرة' }, { re: /العربي الوطني|\banb\b|arab national/i, ar: 'البنك العربي الوطني' },
  { re: /الفرنسي|\bbsf\b|fransi/i, ar: 'البنك السعودي الفرنسي' }, { re: /الاستثمار|\bsaib\b/i, ar: 'البنك السعودي للاستثمار' }, { re: /stc ?pay/i, ar: 'stc pay' }, { re: /urpay/i, ar: 'urpay' },
  { re: /\bd360\b/i, ar: 'بنك D360' }, { re: /الخليج الدولي|\bgib\b/i, ar: 'بنك الخليج الدولي' }, { re: /الإمارات|emirates nbd/i, ar: 'الإمارات دبي الوطني' },
];
const AMOUNT_KEYS = /(المبلغ|الاجمالي|الإجمالي|إجمالي|اجمالي|القيمة|قيمة التحويل|مبلغ التحويل|amount|total|value)/i;
const REF_KEYS = /(رقم المرجع|المرجع|رقم العملية|رقم الحوالة|رقم التحويل|رقم المعاملة|رقم الطلب|reference|ref\.?|transaction|txn|transfer no|payment id|رقم الإيصال)/i;
const SENDER_KEYS = /(اسم المحوّل|اسم المحول|من حساب|المرسل|from account|sender|from)\s*[:：]?\s*([^\n]{3,60})/i;
const MONTHS_AR: Record<string, number> = { يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, مايو: 5, يونيو: 6, يوليو: 7, أغسطس: 8, اغسطس: 8, سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12 };
const MONTHS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');
function isoDate(y: number, m: number, d: number): string | null { if (y < 100) y += 2000; if (y < 2015 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null; return `${y}-${pad(m)}-${pad(d)}`; }
/** استخراج أوّل تاريخ ميلادي معقول من النصّ. */
export function parseDate(text: string): string | null {
  const t = latinDigits(text);
  let m = t.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) { const r = isoDate(+m[1], +m[2], +m[3]); if (r) return r; }
  m = t.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/); if (m) { const r = isoDate(+m[3], +m[2], +m[1]); if (r) return r; }
  m = t.match(/(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s+(20\d{2})/); if (m) { const r = isoDate(+m[3], MONTHS_AR[m[2]], +m[1]); if (r) return r; }
  const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
  m = t.match(new RegExp('\\b(\\d{1,2})\\s+' + MON + '\\.?,?\\s+(20\\d{2})', 'i')); if (m) { const r = isoDate(+m[3], MONTHS_EN.indexOf(m[2].toLowerCase()) + 1, +m[1]); if (r) return r; }
  m = t.match(new RegExp('\\b' + MON + '\\.?\\s+(\\d{1,2}),?\\s+(20\\d{2})', 'i')); if (m) { const r = isoDate(+m[3], MONTHS_EN.indexOf(m[1].toLowerCase()) + 1, +m[2]); if (r) return r; }
  return null;
}
/** كلّ المبالغ المحتملة (أرقام بفاصلة آلاف/كسور) مع ترجيح ما جاور كلمة «المبلغ». */
export function parseAmounts(text: string): { value: number; keyed: boolean }[] {
  const out: { value: number; keyed: boolean }[] = [];
  for (const rawLine of latinDigits(text).split(/\n+/)) {
    const line = rawLine.replace(/\s*,\s*/g, ',');
    const keyed = AMOUNT_KEYS.test(line) || /(ر\.?\s?س|ريال|sar|srs?)\b/i.test(line);
    const re = /(?<![\d.])(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{2,7})(?![\d.])/g; let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const s = m[1]; const v = Number(s.replace(/,/g, '')); if (!isFinite(v) || v <= 0 || v > 5_000_000) continue;
      const hasDec = /\.\d{1,2}$/.test(s) || /,/.test(s); if (!hasDec && !keyed) continue; /* أرقام مجرّدة بلا سياق تُهمل (هواتف/مراجع) */
      if (!hasDec && (s.length >= 7 || /^20\d{2}$/.test(s))) continue;
      out.push({ value: v, keyed });
    }
  }
  return out;
}
/** قراءة الإيصال: نصّ OCR → حقول. */
export function parseReceipt(text: string): ParsedReceipt {
  const t = latinDigits(text || '');
  const amounts = parseAmounts(t); const keyed = amounts.filter((a) => a.keyed);
  const pick = (keyed.length ? keyed : amounts).map((a) => a.value).sort((a, b) => b - a)[0] ?? null;
  const currency = /(ر\.?\s?س|ريال|sar)/i.test(t) ? 'SAR' : /(aed|درهم)/i.test(t) ? 'AED' : /(usd|\$|دولار)/i.test(t) ? 'USD' : /(eur|€|يورو)/i.test(t) ? 'EUR' : /(egp|جنيه)/i.test(t) ? 'EGP' : null;
  const ibanM = t.replace(/\s+/g, '').match(/SA\d{22}/i); const iban = ibanM ? ibanM[0].toUpperCase() : null;
  let ref: string | null = null;
  const refM = t.match(new RegExp(REF_KEYS.source + '\\s*[:：#]?\\s*([A-Z0-9][A-Z0-9-]{5,34})', 'i')); if (refM) ref = refM[refM.length - 1].toUpperCase();
  if (!ref) { const runs = (t.replace(/SA\d{22}/gi, ' ').match(/\b\d{8,20}\b/g) || []).filter((r) => !/^20\d{6}$/.test(r) && !/^(05|9665)\d{8}$/.test(r)); if (runs.length) ref = runs.sort((a, b) => b.length - a.length)[0]; }
  const bank = BANKS.find((b) => b.re.test(t))?.ar || null;
  const sm = t.match(SENDER_KEYS); const sender = sm ? sm[2].trim().replace(/[:：].*$/, '').slice(0, 60) : null;
  const date = parseDate(t);
  const confidence = Math.round(((pick != null ? 40 : 0) + (date ? 20 : 0) + (ref ? 20 : 0) + (iban ? 10 : 0) + (bank ? 10 : 0)));
  return { amount: pick, currency, date, ref, bank, iban, iban_tail: iban ? iban.slice(-4) : null, sender, confidence, amounts: Array.from(new Set(amounts.map((a) => a.value))).slice(0, 8) };
}

export type InvoiceLike = { total: number | string; currency?: string | null; created_at?: string | null; due_date?: string | null };
export type SettingsLike = { iban?: string | null };
/** مطابقة ما قُرئ بالفاتورة: المبلغ (حاسم) · IBAN المستفيد (حاسم إن قُرئ) · التاريخ · المرجع. */
export function matchReceipt(p: ParsedReceipt, inv: InvoiceLike, settings: SettingsLike, today: string = new Date().toISOString().slice(0, 10)): ReceiptMatch {
  const total = Number(inv.total) || 0; const checks: ReceiptCheck[] = [];
  const diff = p.amount == null ? null : Math.abs(p.amount - total);
  const amountOk = diff == null ? null : diff <= 0.5 ? true : diff <= Math.max(1, total * 0.01) ? null : false;
  checks.push({ key: 'amount', ok: amountOk, label_ar: 'المبلغ', note_ar: p.amount == null ? 'لم يُقرأ مبلغ' : amountOk ? `${p.amount} = ${total}` : amountOk === null ? `${p.amount} قريب من ${total}` : `${p.amount} ≠ ${total}` });
  const ourIban = String(settings.iban || '').replace(/\s+/g, '').toUpperCase();
  const ibanOk = !p.iban ? null : !ourIban ? null : p.iban === ourIban;
  checks.push({ key: 'iban', ok: ibanOk, label_ar: 'حساب المستفيد', note_ar: !p.iban ? 'لم يُقرأ IBAN' : !ourIban ? 'لم يُضبط IBAN البوّابة' : ibanOk ? `ينتهي بـ ${p.iban_tail}` : `IBAN مختلف (…${p.iban_tail})` });
  let dateOk: boolean | null = null; let dateNote = 'لم يُقرأ تاريخ';
  if (p.date) { const from = (inv.created_at || '').slice(0, 10); const max = today > (inv.due_date || '') ? today : today; dateOk = (!from || p.date >= shiftDays(from, -1)) && p.date <= shiftDays(max, 1); dateNote = dateOk ? p.date : `${p.date} خارج نافذة الفاتورة`; }
  checks.push({ key: 'date', ok: dateOk, label_ar: 'التاريخ', note_ar: dateNote });
  checks.push({ key: 'ref', ok: p.ref ? true : null, label_ar: 'رقم المرجع', note_ar: p.ref || 'لم يُقرأ مرجع' });
  const score = Math.round((amountOk === true ? 55 : amountOk === null && p.amount != null ? 25 : 0) + (ibanOk === true ? 20 : ibanOk === null ? 8 : 0) + (dateOk === true ? 15 : dateOk === null ? 5 : 0) + (p.ref ? 10 : 0));
  let verdict: ReceiptVerdict = 'partial';
  if (amountOk === false || ibanOk === false || dateOk === false) verdict = 'mismatch';
  else if (amountOk === true && (ibanOk === true || !!p.ref)) verdict = 'match';
  const summary_ar = verdict === 'match' ? `المبلغ ${total} ${inv.currency || 'SAR'} مطابق${p.date ? ` بتاريخ ${p.date}` : ''}${p.ref ? ` · مرجع ${p.ref}` : ''}` : verdict === 'mismatch' ? checks.filter((c) => c.ok === false).map((c) => `${c.label_ar}: ${c.note_ar}`).join(' · ') : checks.filter((c) => c.ok !== true).map((c) => `${c.label_ar}: ${c.note_ar}`).join(' · ');
  return { verdict, score, checks, summary_ar };
}
function shiftDays(iso: string, d: number): string { const t = new Date(iso + 'T00:00:00Z'); if (isNaN(+t)) return iso; t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); }

/** ما يُحفظ في portal_invoices.receipt_meta (نصّ فقط، حدود أطوال). */
export function receiptMeta(p: ParsedReceipt, m: ReceiptMatch, source: 'ocr' | 'manual' = 'ocr') {
  return { amount: p.amount, currency: p.currency, date: p.date, ref: p.ref ? p.ref.slice(0, 40) : null, bank: p.bank, iban_tail: p.iban_tail, sender: p.sender ? p.sender.slice(0, 60) : null, confidence: p.confidence, verdict: m.verdict, score: m.score, source, at: new Date().toISOString() };
}
/** تنظيف ما يصل من العميل قبل إعادة المطابقة على الخادم. */
export function sanitizeParsed(x: any): ParsedReceipt | null {
  if (!x || typeof x !== 'object') return null;
  const num = (v: any) => { const n = Number(v); return isFinite(n) && n > 0 && n < 5_000_000 ? Math.round(n * 100) / 100 : null; };
  const str = (v: any, n: number, re?: RegExp) => { const s = typeof v === 'string' ? v.trim().slice(0, n) : ''; return s && (!re || re.test(s)) ? s : null; };
  const iban = str(x.iban, 24, /^SA\d{22}$/i); const iu = iban ? iban.toUpperCase() : null;
  return { amount: num(x.amount), currency: str(x.currency, 3, /^[A-Z]{3}$/), date: str(x.date, 10, /^\d{4}-\d{2}-\d{2}$/), ref: str(x.ref, 40, /^[A-Za-z0-9-]{4,40}$/), bank: str(x.bank, 60), iban: iu, iban_tail: iu ? iu.slice(-4) : null, sender: str(x.sender, 60), confidence: Math.max(0, Math.min(100, Number(x.confidence) || 0)), amounts: [] };
}

/* ─── المقاعد ─── */
export type SeatStatus = 'none' | 'held' | 'confirmed' | 'released';
export const SEAT_AR: Record<SeatStatus, string> = { none: '—', held: 'محجوز · بانتظار السداد', confirmed: 'مؤكَّد', released: 'مُحرَّر' };
export type SeatCounts = { held: number; confirmed: number; released: number };
export function seatCounts(rows: { seat_status?: string | null }[]): SeatCounts { const c: SeatCounts = { held: 0, confirmed: 0, released: 0 }; for (const r of rows) { const s = r.seat_status as SeatStatus; if (s === 'held' || s === 'confirmed' || s === 'released') c[s]++; } return c; }

/* ─── جاهزية بوّابة الدفع ─── */
export type GatewayStatus = { pk: boolean; sk: boolean; webhook_secret: boolean; card_enabled: boolean; mode: 'live' | 'test' | 'none'; api_ok: boolean | null; api_note: string; webhook_verified_at: string | null; webhook_secret_ok: boolean | null; ready: boolean; steps_ar: { label: string; ok: boolean | null }[] };
export function gatewayStatus(env: { pk?: string; sk?: string; wh?: string }, settings: { card_enabled?: boolean | null } | null, api: { ok: boolean | null; note: string }, webhook: { at: string | null; secret_ok: boolean | null }): GatewayStatus {
  const pk = !!env.pk, sk = !!env.sk, wh = !!env.wh; const mode: GatewayStatus['mode'] = !sk ? 'none' : /^sk_live_/.test(env.sk || '') ? 'live' : 'test';
  const card = !!settings?.card_enabled; const whOk = !!webhook.at && webhook.secret_ok !== false;
  const ready = pk && sk && wh && api.ok === true && whOk && card;
  return { pk, sk, webhook_secret: wh, card_enabled: card, mode, api_ok: api.ok, api_note: api.note, webhook_verified_at: webhook.at, webhook_secret_ok: webhook.secret_ok, ready, steps_ar: [
    { label: 'مفتاح النشر NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY في Vercel', ok: pk }, { label: 'المفتاح السرّي MOYASAR_SECRET_KEY في Vercel', ok: sk },
    { label: 'الاتصال بـ Moyasar بالمفتاح السرّي', ok: api.ok }, { label: 'سرّ الـWebhook MOYASAR_WEBHOOK_SECRET في Vercel', ok: wh },
    { label: 'توثيق الـWebhook من لوحة Moyasar (رمز التحقّق وصل)', ok: webhook.at ? webhook.secret_ok !== false : null }, { label: 'تفعيل «البطاقات» في إعدادات المدفوعات', ok: card },
  ] };
}
