/**
 * /api/consulting — بريد وإجراءات الاستشارات (بوابة أَثَر)
 *  POST { action: 'submitted', id }                         → المالك: بريد استلام للعميل + تنبيه الإدارة
 *  POST { action: 'send_quote', quote_id }                   → موظف: وسم العرض «مُرسل» (والأقدم «مستبدل») + حالة الطلب quoted + بريد للعميل
 *  POST { action: 'respond', quote_id, accept, note? }       → المالك: RPC portal_quote_respond (قبول ⇒ فاتورة) + بريد الفاتورة + تنبيه الإدارة
 *  POST { action: 'status', id, status, note?, notify? }     → موظف: تغيير الحالة + بريد للعميل
 *  POST { action: 'update_posted', update_id }               → أي طرف: إشعار الطرف الآخر بتحديث جديد
 * الأخطاء البريدية لا تُفشل العملية (mail_error)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../lib/email/resend';
import { requestReceivedEmail, newRequestAdminEmail, quoteSentEmail, quoteRespondedAdminEmail, statusEmail, updateEmail } from '../../../lib/portal/consulting';
import type { ConsultingRequest, Quote, Update, ReqStatus } from '../../../lib/portal/consulting';
import { invoiceEmail } from '../../../lib/portal/payments';
import type { Invoice } from '../../../lib/portal/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STATUSES: ReqStatus[] = ['new', 'reviewing', 'quoted', 'accepted', 'declined', 'in_progress', 'completed', 'closed', 'cancelled'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
const admins = () => String(process.env.NOTIFY_EMAILS || '').split(/[,;\s]+/).filter(Boolean);
async function mail(fn: () => Promise<any>): Promise<string | null> { try { await fn(); return null; } catch (e: any) { return String(e?.message || e); } }

async function who(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL_ || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error } = await userClient.auth.getUser(token);
  if (error || !u?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await userClient.from('profiles').select('role,full_name').eq('id', u.user.id).maybeSingle();
  const role = String((prof as any)?.role || '').toUpperCase(); const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { user: u.user, name: String((prof as any)?.full_name || u.user.email || ''), staff: WRITERS.includes(role), db: service ? createClient(URL_, service) : userClient, userDb: userClient };
}

export async function POST(req: Request) {
  const a = await who(req); if ('error' in a) return a.error;
  let body: any; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const site = siteUrl(req); const action = String(body?.action || '');
  const getReq = async (id: string) => { const { data } = await a.db.from('portal_consulting_requests').select('*').eq('id', id).maybeSingle(); return (data as ConsultingRequest) || null; };

  if (action === 'submitted') {
    const r = await getReq(String(body?.id || '')); if (!r) return bad('الطلب غير موجود', 404);
    if (r.user_id !== a.user.id && !a.staff) return bad('غير مصرح', 403);
    const m1 = requestReceivedEmail(r, site); const e1 = await mail(() => sendViaResend({ to: [r.email], subject: m1.subject, html: m1.html, tags: [{ name: 'kind', value: 'consult_received' }] }));
    const to = admins(); const m2 = newRequestAdminEmail(r, site); const e2 = to.length ? await mail(() => sendViaResend({ to, subject: m2.subject, html: m2.html, tags: [{ name: 'kind', value: 'consult_new' }] })) : null;
    return NextResponse.json({ success: true, mail_error: e1 || e2 });
  }

  if (action === 'send_quote') {
    if (!a.staff) return bad('غير مصرح', 403);
    const qid = String(body?.quote_id || ''); const { data: qd } = await a.db.from('portal_consulting_quotes').select('*').eq('id', qid).maybeSingle(); const q = qd as Quote | null;
    if (!q) return bad('العرض غير موجود', 404); if (q.status !== 'draft' && q.status !== 'sent') return bad('لا يمكن إرسال هذا العرض');
    const r = await getReq(q.request_id); if (!r) return bad('الطلب غير موجود', 404);
    await a.db.from('portal_consulting_quotes').update({ status: 'superseded' }).eq('request_id', r.id).neq('id', q.id).in('status', ['draft', 'sent']);
    const { error } = await a.db.from('portal_consulting_quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', q.id); if (error) return bad(error.message, 500);
    await a.db.from('portal_consulting_requests').update({ status: 'quoted', updated_at: new Date().toISOString() }).eq('id', r.id);
    const m = quoteSentEmail(r, { ...q, status: 'sent' }, site);
    return NextResponse.json({ success: true, mail_error: await mail(() => sendViaResend({ to: [r.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'consult_quote' }] })) });
  }

  if (action === 'respond') {
    const qid = String(body?.quote_id || ''); const accept = !!body?.accept; const note = body?.note ? String(body.note).slice(0, 1000) : null;
    const { data: invId, error } = await a.userDb.rpc('portal_quote_respond', { p_quote: qid, p_accept: accept, p_note: note });
    if (error) return bad(error.message, 400);
    const { data: qd } = await a.db.from('portal_consulting_quotes').select('*').eq('id', qid).maybeSingle(); const q = qd as Quote; const r = await getReq(q.request_id); if (!r) return bad('الطلب غير موجود', 404);
    let mail_error: string | null = null;
    if (accept && invId) { const { data: inv } = await a.db.from('portal_invoices').select('*').eq('id', invId).maybeSingle(); if (inv) { const m = invoiceEmail(inv as Invoice, r.title, site); mail_error = await mail(() => sendViaResend({ to: [r.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'invoice' }] })); } }
    const to = admins(); if (to.length) { const m = quoteRespondedAdminEmail(r, q, accept, site); const e = await mail(() => sendViaResend({ to, subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'consult_response' }] })); mail_error = mail_error || e; }
    return NextResponse.json({ success: true, accepted: accept, invoice_id: invId || null, mail_error });
  }

  if (action === 'status') {
    if (!a.staff) return bad('غير مصرح', 403);
    const status = String(body?.status || '') as ReqStatus; if (!STATUSES.includes(status)) return bad('حالة غير صالحة');
    const r = await getReq(String(body?.id || '')); if (!r) return bad('الطلب غير موجود', 404);
    const patch: any = { status, updated_at: new Date().toISOString() }; if (status === 'completed') patch.completed_at = new Date().toISOString();
    const { error } = await a.db.from('portal_consulting_requests').update(patch).eq('id', r.id); if (error) return bad(error.message, 500);
    let mail_error: string | null = null;
    if (body?.notify !== false && ['reviewing', 'in_progress', 'completed', 'closed'].includes(status)) { const m = statusEmail(r, status, body?.note ? String(body.note).slice(0, 1000) : null, site); mail_error = await mail(() => sendViaResend({ to: [r.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: `consult_${status}` }] })); }
    return NextResponse.json({ success: true, status, mail_error });
  }

  if (action === 'update_posted') {
    const { data: ud } = await a.db.from('portal_consulting_updates').select('*').eq('id', String(body?.update_id || '')).maybeSingle(); const u = ud as Update | null;
    if (!u) return bad('التحديث غير موجود', 404); const r = await getReq(u.request_id); if (!r) return bad('الطلب غير موجود', 404);
    if (u.author_id !== a.user.id && !a.staff) return bad('غير مصرح', 403);
    let mail_error: string | null = null;
    if (u.by_staff) { if (u.visible_to_client) { const m = updateEmail(r, u, site, true); mail_error = await mail(() => sendViaResend({ to: [r.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'consult_update' }] })); } }
    else { const to = admins(); if (to.length) { const m = updateEmail(r, u, site, false); mail_error = await mail(() => sendViaResend({ to, subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'consult_update' }] })); } }
    return NextResponse.json({ success: true, mail_error });
  }
  return bad('action غير معروف');
}
