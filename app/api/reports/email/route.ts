/**
 * POST /api/reports/email
 * إرسال تقرير بالبريد (Resend) + إدارة الاشتراكات الأسبوعية.
 *
 * body.action:
 *   'send'        → { to: string[], subject, html, attachments?: [{ filename, content(base64) }], meta? }
 *   'subscribe'   → { to: string[], reportId, filters, lang, label }
 *   'unsubscribe' → { id }
 *   'list'        → {}
 *
 * الحماية: Bearer <access_token> لمستخدم مسجّل دوره إداري (PLATFORM_ADMIN / PROGRAM_MANAGER / QUALITY_ANALYST).
 * المتغيرات: RESEND_API_KEY (مطلوب للإرسال)، REPORTS_FROM_EMAIL (اختياري، مثل "منصة التقويم <reports@domain.edu.sa>").
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EMAIL_RE } from '../../../../lib/email/report-mail';
import { sendViaResend, type MailAttachment } from '../../../../lib/email/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const MAX_RECIPIENTS = 25;
const MAX_ATTACH_BYTES = 8 * 1024 * 1024; // حد Resend العملي ≈ 40MB للرسالة؛ نكتفي بـ 8MB

type Attachment = MailAttachment;

function bad(error: string, status = 400) { return NextResponse.json({ success: false, error }, { status }); }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'send');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !ANON_KEY) return bad('إعدادات الخادم غير مكتملة', 500);

    // ---- المصادقة
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) return bad('جلسة المستخدم غير صالحة', 401);
    const { data: profile } = await userClient.from('profiles').select('role,full_name,organization_id').eq('id', u.user.id).single();
    const role = String(profile?.role || '').toUpperCase();
    if (!ALLOWED_ROLES.includes(role)) return bad('غير مصرح — هذه الخدمة للإدارة ومديري البرامج ومحللي الجودة', 403);

    // عميل الكتابة: service role إن وُجد (للتدقيق والاشتراكات)، وإلا عميل المستخدم نفسه (تحكمه سياسات RLS)
    const db = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : userClient;
    const audit = async (act: string, metadata: Record<string, unknown>) => {
      try { await db.from('audit_logs').insert({ actor_id: u.user.id, action: act, entity_type: 'report', metadata }); } catch { /* الجدول اختياري */ }
    };

    // ---- الإجراءات
    if (action === 'list') {
      const { data, error } = await db.from('report_subscriptions').select('*').eq('organization_id', profile?.organization_id || '').order('created_at', { ascending: false });
      if (error) return bad(error.message, 500);
      return NextResponse.json({ success: true, data: data || [] });
    }

    if (action === 'unsubscribe') {
      const id = String(body.id || '');
      if (!id) return bad('معرّف الاشتراك مطلوب');
      const { error } = await db.from('report_subscriptions').delete().eq('id', id);
      if (error) return bad(error.message, 500);
      await audit('report_unsubscribe', { id });
      return NextResponse.json({ success: true });
    }

    const to: string[] = Array.from(new Set((Array.isArray(body.to) ? body.to : []).map((x: unknown) => String(x).trim().toLowerCase()).filter((x: string) => EMAIL_RE.test(x))));
    if (!to.length) return bad('أدخل بريدًا إلكترونيًا صحيحًا واحدًا على الأقل');
    if (to.length > MAX_RECIPIENTS) return bad(`الحد الأقصى ${MAX_RECIPIENTS} مستلمًا في الرسالة الواحدة`);

    if (action === 'subscribe') {
      const reportId = String(body.reportId || 'executive');
      const rows = to.map(email => ({
        organization_id: profile?.organization_id || null, email, report_id: reportId, filters: body.filters || {}, lang: body.lang === 'en' ? 'en' : 'ar',
        label: String(body.label || '').slice(0, 160), frequency: 'weekly', active: true, created_by: u.user.id,
      }));
      const { error } = await db.from('report_subscriptions').upsert(rows, { onConflict: 'email,report_id,organization_id' });
      if (error) return bad(error.message, 500);
      await audit('report_subscribe', { to, reportId });
      return NextResponse.json({ success: true, count: rows.length });
    }

    // action === 'send'
    const subject = String(body.subject || '').slice(0, 250);
    const html = String(body.html || '');
    if (!subject || !html) return bad('العنوان ومحتوى الرسالة مطلوبان');
    const attachments: Attachment[] = (Array.isArray(body.attachments) ? body.attachments : [])
      .filter((a: any) => a && typeof a.filename === 'string' && typeof a.content === 'string')
      .map((a: any) => ({ filename: String(a.filename).replace(/[^\w.\-\u0600-\u06FF ]+/g, '_').slice(0, 120), content: a.content }));
    const totalBytes = attachments.reduce((s, a) => s + Math.floor(a.content.length * 0.75), 0);
    if (totalBytes > MAX_ATTACH_BYTES) return bad('حجم المرفقات يتجاوز 8MB — أزل مرفقًا أو ضيّق نطاق التقرير');

    const result = await sendViaResend({
      to, subject, html, attachments, replyTo: u.user.email || undefined,
      tags: [{ name: 'kind', value: 'report' }, { name: 'report', value: String(body.meta?.reportId || 'custom').replace(/[^a-z0-9_-]/gi, '_') }],
    });
    await audit('report_email', { to, subject, reportId: body.meta?.reportId, scope: body.meta?.scope, attachments: attachments.map(a => a.filename), resend_id: result?.id });
    return NextResponse.json({ success: true, id: result?.id, to });
  } catch (e: any) {
    return bad(e?.message || 'خطأ غير متوقع', 500);
  }
}
