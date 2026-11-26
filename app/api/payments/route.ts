/**
 * /api/payments — عمليات الدفع (بوّابة أَثَر)
 *  POST { action: 'issue',   enrollment_id }                   → موظف: إصدار فاتورة لطلب مقبول + بريد الفاتورة
 *  POST { action: 'send',    id }                              → موظف: إعادة إرسال بريد الفاتورة
 *  POST { action: 'set',     id, status, method?, note? }      → موظف: paid | cancelled | refunded | waived | unpaid (+ بريد تأكيد عند paid)
 *  POST { action: 'submitted', id, receipt? }                  → المالك: تنبيه الإدارة بإيصال تحويل جديد (+P83: مطابقة ما قرأه القارئ على الخادم؛ اعتماد آلي إن فُعِّل وكان مطابقًا وأُرفقت صورة)
 *  GET  ?gateway=1                                             → موظف (P83): جاهزية بوّابة Moyasar (مفاتيح · اتصال · webhook · تفعيل)
 *  POST { action: 'verify_card', id, payment_id }              → المالك: التحقق من عملية Moyasar عبر المفتاح السري ثم اعتماد السداد
 * الأخطاء البريدية لا تُفشل العملية (mail_error في الاستجابة)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../lib/email/resend';
import { invoiceEmail, receiptEmail, verifyGatewayPayment, money } from '../../../lib/portal/payments';
import type { Invoice, InvoiceStatus } from '../../../lib/portal/payments';
import { deliverResourceFiles } from '../../../lib/portal/resource-delivery'; /* P5-ب */
import { sanitizeParsed, matchReceipt, receiptMeta, gatewayStatus } from '../../../lib/finance/receipt'; /* P83 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const SET: InvoiceStatus[] = ['paid', 'cancelled', 'refunded', 'waived', 'unpaid'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
const admins = () => String(process.env.NOTIFY_EMAILS || '').split(/[,;\s]+/).filter(Boolean);

async function who(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL_ || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error } = await userClient.auth.getUser(token);
  if (error || !u?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await userClient.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  const role = String((prof as any)?.role || '').toUpperCase();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { user: u.user, role, staff: STAFF.includes(role), db: service ? createClient(URL_, service) : userClient, userDb: userClient };
}
async function programName(db: any, inv: { program_id?: string | null; description?: string | null }) { if (!inv.program_id) return String(inv.description || ''); const { data } = await db.from('programs').select('name_ar').eq('id', inv.program_id).maybeSingle(); return String((data as any)?.name_ar || inv.description || ''); }
async function mail(fn: () => Promise<any>): Promise<string | null> { try { await fn(); return null; } catch (e: any) { return String(e?.message || e); } }

/* P83: جاهزية بوّابة الدفع — للطاقم */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('gateway') !== '1') return bad('غير معروف', 404);
  const a = await who(req); if ('error' in a) return a.error; if (!a.staff) return bad('غير مصرح', 403);
  const env = { pk: process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY, sk: process.env.MOYASAR_SECRET_KEY, wh: process.env.MOYASAR_WEBHOOK_SECRET };
  const { data: st } = await a.db.from('portal_payment_settings').select('card_enabled').eq('id', 1).maybeSingle();
  let api: { ok: boolean | null; note: string } = { ok: null, note: 'لا مفتاح سرّي' };
  if (env.sk) { try { const r = await fetch('https://api.moyasar.com/v1/payments?per=1', { headers: { Authorization: `Basic ${Buffer.from(`${env.sk}:`).toString('base64')}` }, cache: 'no-store' }); api = r.ok ? { ok: true, note: 'متّصل' } : { ok: false, note: `Moyasar HTTP ${r.status}${r.status === 401 ? ' — المفتاح مرفوض' : ''}` }; } catch (e: any) { api = { ok: false, note: `تعذّر الاتصال: ${String(e?.message || e).slice(0, 80)}` }; } }
  const { data: wh } = await a.db.from('audit_logs').select('created_at,metadata').eq('action', 'moyasar_webhook_verification').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const g = gatewayStatus(env, st as any, api, { at: (wh as any)?.created_at || null, secret_ok: (wh as any)?.metadata?.secret_ok ?? null });
  return NextResponse.json({ success: true, gateway: g, webhook_url: `${siteUrl(req)}/api/payments/webhook` }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const a = await who(req); if ('error' in a) return a.error;
  let body: any; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const site = siteUrl(req); const action = String(body?.action || '');

  if (action === 'issue') {
    if (!a.staff) return bad('غير مصرح', 403);
    const eid = String(body?.enrollment_id || ''); if (!eid) return bad('enrollment_id مطلوب');
    const { data: invId, error } = await a.userDb.rpc('portal_issue_invoice', { p_enrollment: eid });
    if (error) return bad(error.message, 500);
    if (!invId) return NextResponse.json({ success: true, invoice_id: null, message: 'البرنامج مجاني أو بلا رسوم محددة — لا فاتورة' });
    const { data: inv } = await a.db.from('portal_invoices').select('*').eq('id', invId).single();
    const m = invoiceEmail(inv as Invoice, await programName(a.db, inv as Invoice), site);
    const mail_error = await mail(() => sendViaResend({ to: [(inv as Invoice).customer_email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'invoice' }] }));
    return NextResponse.json({ success: true, invoice_id: invId, mail_error });
  }

  const id = String(body?.id || ''); if (!id) return bad('id مطلوب');
  const { data: invRow } = await a.db.from('portal_invoices').select('*').eq('id', id).maybeSingle();
  if (!invRow) return bad('الفاتورة غير موجودة', 404);
  const inv = invRow as Invoice; const pname = await programName(a.db, inv);
  const isOwner = inv.user_id === a.user.id;

  if (action === 'send') {
    if (!a.staff) return bad('غير مصرح', 403);
    const m = invoiceEmail(inv, pname, site);
    return NextResponse.json({ success: true, mail_error: await mail(() => sendViaResend({ to: [inv.customer_email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'invoice' }] })) });
  }

  if (action === 'set') {
    if (!a.staff) return bad('غير مصرح', 403);
    const status = String(body?.status || '') as InvoiceStatus; if (!SET.includes(status)) return bad('حالة غير صالحة');
    const method = body?.method ? String(body.method) : (status === 'waived' ? 'waived' : inv.method || 'bank_transfer');
    const patch: any = { status, method, notes: body?.note ? String(body.note).slice(0, 1000) : inv.notes };
    if (status === 'paid') { patch.paid_at = new Date().toISOString(); patch.confirmed_by = a.user.id; } else if (status === 'unpaid') { patch.paid_at = null; patch.confirmed_by = null; }
    const { error } = await a.db.from('portal_invoices').update(patch).eq('id', id); if (error) return bad(error.message, 500);
    let mail_error: string | null = null;
    if (status === 'paid' && body?.notify !== false) { const m = receiptEmail({ ...inv, status, method }, pname, site); mail_error = await mail(() => sendViaResend({ to: [inv.customer_email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'receipt' }] })); }
    let delivery: any = null; if ((status === 'paid' || status === 'waived') && inv.resource_id) delivery = await deliverResourceFiles(a.db, { invoiceId: id }, site).catch((e: any) => ({ sent: false, error: String(e?.message || e) })); /* P5-ب: ملفّات الحقيبة إلى بريد الفاتورة */
    return NextResponse.json({ success: true, status, mail_error, delivery });
  }

  if (action === 'submitted') {
    if (!isOwner && !a.staff) return bad('غير مصرح', 403);
    /* P83: إعادة المطابقة على الخادم (لا نثق بحكم العميل) ثم اعتماد آلي مشروط */
    let verdictLine = ''; let auto = false;
    const parsed = sanitizeParsed(body?.receipt);
    if (parsed && inv.status === 'under_review') {
      const { data: st } = await a.db.from('portal_payment_settings').select('iban,auto_confirm_receipts').eq('id', 1).maybeSingle();
      const m = matchReceipt(parsed, inv, { iban: (st as any)?.iban });
      const meta = receiptMeta(parsed, m, 'ocr');
      await a.db.from('portal_invoices').update({ receipt_meta: meta, receipt_match: m.verdict }).eq('id', id);
      verdictLine = `<p>مطابقة القارئ: <b>${m.verdict === 'match' ? 'مطابق' : m.verdict === 'partial' ? 'جزئي' : 'غير مطابق'}</b> (${m.score}/100) — ${m.summary_ar}</p>`;
      if ((st as any)?.auto_confirm_receipts && m.verdict === 'match' && inv.receipt_path && Number(inv.total) > 0) {
        const { error } = await a.db.from('portal_invoices').update({ status: 'paid', method: 'bank_transfer', paid_at: new Date().toISOString(), auto_confirmed: true, notes: `${inv.notes ? inv.notes + ' · ' : ''}اعتماد آلي بمطابقة الإيصال (${m.score}/100) — يُراجع خلال 48 ساعة` }).eq('id', id).eq('status', 'under_review');
        if (!error) { auto = true; const rm = receiptEmail({ ...inv, status: 'paid', method: 'bank_transfer' }, pname, site); await mail(() => sendViaResend({ to: [inv.customer_email], subject: rm.subject, html: rm.html, tags: [{ name: 'kind', value: 'receipt' }] })); if (inv.resource_id) await deliverResourceFiles(a.db, { invoiceId: id }, site).catch(() => null); }
      }
    }
    const to = admins(); if (!to.length) return NextResponse.json({ success: true, mail_error: null, auto_confirmed: auto });
    const mail_error = await mail(() => sendViaResend({ to, subject: `${auto ? 'اعتُمد آليًّا — راجع خلال 48 ساعة' : 'إيصال تحويل جديد للمراجعة'} — ${inv.invoice_no}`, html: `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><p>رفع <b>${inv.customer_name}</b> إيصال تحويل لفاتورة <b>${inv.invoice_no}</b> (${money(inv.total, inv.currency, 'ar')}) — ${pname}.</p>${inv.transfer_ref ? `<p>مرجع التحويل: ${inv.transfer_ref}</p>` : ''}${verdictLine}${auto ? '<p><b>اعتُمد السداد آليًّا</b> وأُغلق المقعد — يُرجى مراجعة صورة الإيصال خلال 48 ساعة، ويمكن الرجوع عنه من «المدفوعات».</p>' : ''}<p><a href="${site}/admin/payments">فتح المدفوعات</a></p></div>`, tags: [{ name: 'kind', value: 'receipt_review' }] }));
    return NextResponse.json({ success: true, mail_error, auto_confirmed: auto });
  }

  if (action === 'verify_card') {
    if (!isOwner && !a.staff) return bad('غير مصرح', 403);
    const secret = process.env.MOYASAR_SECRET_KEY; if (!secret) return bad('الدفع بالبطاقة غير مفعّل (MOYASAR_SECRET_KEY)', 503);
    const pid = String(body?.payment_id || '').replace(/[^a-zA-Z0-9-]/g, ''); if (!pid) return bad('payment_id مطلوب');
    if (inv.status === 'paid') return NextResponse.json({ success: true, status: 'paid', already: true });
    const res = await fetch(`https://api.moyasar.com/v1/payments/${pid}`, { headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}` }, cache: 'no-store' });
    const payment: any = await res.json().catch(() => null);
    if (!res.ok) return bad(`Moyasar HTTP ${res.status}`, 502);
    const v = verifyGatewayPayment(payment, inv);
    if (!v.ok) { await a.db.from('portal_invoices').update({ gateway_payment_id: pid, gateway_payload: payment, notes: `فشل التحقق: ${v.reason}` }).eq('id', id); return bad(`لم يُعتمد الدفع (${v.reason})`, 409); }
    const { error } = await a.db.from('portal_invoices').update({ status: 'paid', method: 'card', paid_at: new Date().toISOString(), gateway_payment_id: pid, gateway_payload: payment }).eq('id', id);
    if (error) return bad(error.message, 500);
    const m = receiptEmail({ ...inv, status: 'paid', method: 'card' }, pname, site);
    const mail_error = await mail(() => sendViaResend({ to: [inv.customer_email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'receipt' }] }));
    const delivery = inv.resource_id ? await deliverResourceFiles(a.db, { invoiceId: id }, site).catch((e: any) => ({ sent: false, error: String(e?.message || e) })) : null; /* P5-ب */
    return NextResponse.json({ success: true, status: 'paid', mail_error, delivery });
  }
  return bad('action غير معروف');
}
