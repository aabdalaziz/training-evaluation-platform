/**
 * /api/enrollments — بريد طلبات التسجيل (بوابة أَثَر)
 *  POST { action: 'ack',    id }                 → المتقدّم نفسه: إشعار استلام له + تنبيه للإدارة (NOTIFY_EMAILS)
 *  POST { action: 'decide', id, status, note? }  → موظف: تحديث القرار + بريد للمتقدّم
 * الأخطاء البريدية لا تُفشل العملية (تُعاد ضمن الاستجابة mail_error)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../lib/email/resend';
import { decisionEmail } from '../../../lib/portal/catalog';
import { money } from '../../../lib/portal/payments';
import type { Invoice } from '../../../lib/portal/payments';
import type { Enrollment, EnrollStatus } from '../../../lib/portal/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const DECISIONS: EnrollStatus[] = ['approved', 'waitlisted', 'rejected', 'pending'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

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
  const db = service ? createClient(URL_, service) : userClient;
  return { user: u.user, role, staff: STAFF.includes(role), db, hasService: !!service };
}

export async function POST(req: Request) {
  const a = await who(req); if ('error' in a) return a.error;
  let body: any; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const id = String(body?.id || ''); if (!id) return bad('id مطلوب');

  const { data: e } = await a.db.from('portal_enrollments').select('*').eq('id', id).maybeSingle();
  if (!e) return bad('الطلب غير موجود', 404);
  const en = e as Enrollment;
  const { data: p } = await a.db.from('programs').select('name_ar,name_en').eq('id', en.program_id).maybeSingle();
  const programName = String((p as any)?.name_ar || (p as any)?.name_en || '');
  const site = siteUrl(req);

  if (body.action === 'ack') {
    if (en.user_id !== a.user.id && !a.staff) return bad('غير مصرح', 403);
    let mail_error: string | null = null;
    try {
      const m = decisionEmail(en, programName, 'pending', null, site);
      await sendViaResend({ to: [en.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'enrollment_ack' }] });
      const admins = String(process.env.NOTIFY_EMAILS || '').split(/[,;\s]+/).filter(Boolean);
      if (admins.length) await sendViaResend({ to: admins, subject: `طلب تسجيل جديد: ${programName} — ${en.full_name}`, html: `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><p>طلب تسجيل جديد في <b>${programName}</b></p><p>${en.full_name} · <span dir="ltr">${en.email}</span> · <span dir="ltr">${en.phone || ''}</span>${en.organization ? ` · ${en.organization}` : ''}</p>${en.notes ? `<p>ملاحظات: ${en.notes}</p>` : ''}<p><a href="${site}/admin/enrollments">فتح طلبات التسجيل</a></p></div>`, tags: [{ name: 'kind', value: 'enrollment_new' }] });
      await a.db.from('portal_enrollments').update({ notified_at: new Date().toISOString() }).eq('id', id);
    } catch (err: any) { mail_error = String(err?.message || err); }
    return NextResponse.json({ success: true, mail_error });
  }

  if (body.action === 'decide') {
    if (!a.staff) return bad('غير مصرح — للموظفين فقط', 403);
    const status = String(body?.status || '') as EnrollStatus; if (!DECISIONS.includes(status)) return bad('حالة غير صالحة');
    let note: string | null = body?.note ? String(body.note).slice(0, 1000) : null;
    const patch = status === 'pending' ? { status, decided_by: null, decided_at: null, decision_note: null } : { status, decided_by: a.user.id, decided_at: new Date().toISOString(), decision_note: note };
    const { error: uErr } = await a.db.from('portal_enrollments').update(patch).eq('id', id);
    if (uErr) return bad(uErr.message, 500);
    let mail_error: string | null = null; let invoice_id: string | null = null;
    if (status === 'approved') {
      // الفاتورة تُصدر تلقائيًا بمحفّز قاعدة البيانات عند القبول (إن كان للبرنامج رسوم)
      const { data: inv } = await a.db.from('portal_invoices').select('*').eq('enrollment_id', id).neq('status', 'cancelled').maybeSingle();
      if (inv) invoice_id = (inv as Invoice).id;
      if (inv && (inv as Invoice).status !== 'paid') { const i = inv as Invoice; const lang = en.lang === 'en' ? 'en' : 'ar'; const pay = `${site}/pay/${i.id}`; note = `${note ? note + '\n' : ''}${lang === 'ar' ? `فاتورة رقم ${i.invoice_no} بمبلغ ${money(i.total, i.currency, 'ar')} — ادفع من هنا: ${pay}` : `Invoice ${i.invoice_no}, total ${money(i.total, i.currency, 'en')} — pay here: ${pay}`}`; }
    }
    if (status !== 'pending' && body?.notify !== false) {
      try {
        const m = decisionEmail({ ...en, status }, programName, status, note, site);
        await sendViaResend({ to: [en.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: `enrollment_${status}` }] });
        await a.db.from('portal_enrollments').update({ notified_at: new Date().toISOString() }).eq('id', id);
      } catch (err: any) { mail_error = String(err?.message || err); }
    }
    return NextResponse.json({ success: true, status, mail_error, invoice_id });
  }
  return bad('action غير معروف');
}
