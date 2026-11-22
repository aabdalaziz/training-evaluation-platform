/**
 * POST /api/payments/webhook — استقبال إشعارات Moyasar (payment_paid / payment_refunded)
 * الأمان: secret_token في جسم الطلب يُقارن بـ MOYASAR_WEBHOOK_SECRET، ثم يُعاد جلب الدفعة من Moyasar بالمفتاح السري قبل أي تغيير.
 * idempotent: الفاتورة المدفوعة لا تُعدَّل مرة أخرى. يرد 200 دائمًا بعد التحقق كي لا يكرر Moyasar الإرسال بلا داعٍ.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../../lib/email/resend';
import { receiptEmail, verifyGatewayPayment } from '../../../../lib/portal/payments';
import type { Invoice } from '../../../../lib/portal/payments';
import { safeEqual, eventAction, invoiceIdFrom } from '../../../../lib/portal/webhook';
import type { MoyasarEvent } from '../../../../lib/portal/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET; const apiKey = process.env.MOYASAR_SECRET_KEY;
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !apiKey || !URL_ || !SVC) return NextResponse.json({ ok: false, error: 'webhook not configured' }, { status: 503 });
  let ev: MoyasarEvent; try { ev = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const secretOk = safeEqual(String(ev.secret_token || ''), secret);
  /* هـ-1/3: توثيق الـWebhook من لوحة Moyasar — حدث webhook_verification ومعه data.verification_code. نحفظ الرمز (مع نتيجة مطابقة السرّ لتشخيص الإعداد)
     ليقرأه المدير من /admin/payments → الإعدادات. الرمز بذاته لا يمنح شيئًا — لا يصلح إلا داخل لوحة Moyasar. */
  if (ev.type === 'webhook_verification') {
    const code = String((ev.data as any)?.verification_code || (ev as any)?.verification_code || '').replace(/[^0-9A-Za-z-]/g, '').slice(0, 16);
    console.log(`[moyasar] webhook_verification code=${code} secret_ok=${secretOk}`);
    if (code) await createClient(URL_, SVC).from('audit_logs').insert({ action: 'moyasar_webhook_verification', entity_type: 'webhook', entity_id: 'moyasar', metadata: { code, secret_ok: secretOk, live: !!ev.live, at: new Date().toISOString() } });
    return NextResponse.json({ ok: true, verification: true });
  }
  if (!secretOk) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const db = createClient(URL_, SVC);
  const action = eventAction(ev.type); const pid = String(ev.data?.id || '').replace(/[^a-zA-Z0-9-]/g, '');
  if (action === 'ignore' || !pid) return NextResponse.json({ ok: true, ignored: true });

  // إيجاد الفاتورة: metadata.invoice_id ثم gateway_payment_id
  let inv: Invoice | null = null; const invId = invoiceIdFrom(ev);
  if (invId) { const { data } = await db.from('portal_invoices').select('*').eq('id', invId).maybeSingle(); inv = (data as Invoice) || null; }
  if (!inv) { const { data } = await db.from('portal_invoices').select('*').eq('gateway_payment_id', pid).maybeSingle(); inv = (data as Invoice) || null; }
  if (!inv) return NextResponse.json({ ok: true, ignored: true, reason: 'invoice_not_found' });

  if (action === 'refunded') {
    if (inv.status === 'paid') await db.from('portal_invoices').update({ status: 'refunded', gateway_payload: ev.data, notes: `${inv.notes ? inv.notes + ' · ' : ''}استرداد عبر Moyasar (${pid})` }).eq('id', inv.id);
    return NextResponse.json({ ok: true, status: 'refunded' });
  }

  if (inv.status === 'paid') return NextResponse.json({ ok: true, already: true });
  // إعادة الجلب من Moyasar — لا نثق بجسم الإشعار وحده
  const res = await fetch(`https://api.moyasar.com/v1/payments/${pid}`, { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` }, cache: 'no-store' });
  const payment: any = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json({ ok: false, error: `moyasar ${res.status}` }, { status: 502 });
  const v = verifyGatewayPayment(payment, inv);
  if (!v.ok) { await db.from('portal_invoices').update({ gateway_payment_id: pid, gateway_payload: payment, notes: `webhook: فشل التحقق (${v.reason})` }).eq('id', inv.id); return NextResponse.json({ ok: true, rejected: v.reason }); }
  const { error } = await db.from('portal_invoices').update({ status: 'paid', method: 'card', paid_at: new Date().toISOString(), gateway_payment_id: pid, gateway_payload: payment }).eq('id', inv.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  let mail_error: string | null = null;
  try { const { data: p } = await db.from('programs').select('name_ar').eq('id', inv.program_id || '').maybeSingle(); const m = receiptEmail({ ...inv, status: 'paid', method: 'card' }, String((p as any)?.name_ar || ''), (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '')); await sendViaResend({ to: [inv.customer_email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'receipt' }] }); } catch (e: any) { mail_error = String(e?.message || e); }
  return NextResponse.json({ ok: true, status: 'paid', mail_error });
}

export async function GET(req: Request) {
  const configured = !!(process.env.MOYASAR_WEBHOOK_SECRET && process.env.MOYASAR_SECRET_KEY);
  const u = new URL(req.url);
  if (u.searchParams.get('verification') !== '1') return NextResponse.json({ ok: true, endpoint: 'moyasar-webhook', configured });
  /* آخر رمز توثيق — لمديري المنصّة فقط (Bearer) */
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!URL_ || !ANON || !SVC || !token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data: ud } = await userDb.auth.getUser(token);
  if (!ud?.user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = createClient(URL_, SVC); const { data: prof } = await db.from('profiles').select('role').eq('id', ud.user.id).maybeSingle();
  if (!['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(String((prof as any)?.role || '').toUpperCase())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const { data } = await db.from('audit_logs').select('created_at, metadata').eq('action', 'moyasar_webhook_verification').order('created_at', { ascending: false }).limit(1);
  const r = Array.isArray(data) && data[0]; return NextResponse.json({ ok: true, configured, code: r ? String((r as any).metadata?.code || '') : null, at: r ? (r as any).created_at : null, secret_ok: r ? (r as any).metadata?.secret_ok !== false : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
