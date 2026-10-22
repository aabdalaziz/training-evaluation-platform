/**
 * POST /api/certificates/send
 * إرسال شهادة (PDF مولَّد في المتصفح) إلى بريد المستفيد عبر Resend، وتحديث sent_at في السجل.
 * Body: { items: [{ certificateId, to, filename, pdfBase64, subject, html }], note? }
 * Header: Authorization: Bearer <access_token>
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../../lib/email/resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const MAX_ITEMS = 30;
const MAX_PDF_BYTES = 6 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function bad(error: string, status = 400) { return NextResponse.json({ success: false, error }, { status }); }

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !ANON_KEY) return bad('إعدادات الخادم غير مكتملة', 500);

    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) return bad('جلسة المستخدم غير صالحة', 401);
    const { data: profile } = await userClient.from('profiles').select('role,full_name,organization_id').eq('id', u.user.id).single();
    const role = String(profile?.role || '').toUpperCase();
    if (!ALLOWED_ROLES.includes(role)) return bad('غير مصرح — إصدار الشهادات للإدارة ومديري البرامج ومحللي الجودة', 403);
    const db = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : userClient;

    const items: any[] = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    if (!items.length) return bad('لا توجد شهادات للإرسال');

    const results: { certificateId: string; to: string; ok: boolean; error?: string; id?: string }[] = [];
    for (const it of items) {
      const to = String(it.to || '').trim().toLowerCase();
      const certificateId = String(it.certificateId || '');
      if (!EMAIL_RE.test(to)) { results.push({ certificateId, to, ok: false, error: 'بريد غير صالح' }); continue; }
      const pdf = String(it.pdfBase64 || '');
      if (!pdf || Math.ceil(pdf.length * 3 / 4) > MAX_PDF_BYTES) { results.push({ certificateId, to, ok: false, error: 'ملف الشهادة مفقود أو كبير' }); continue; }
      try {
        const r = await sendViaResend({
          to: [to], subject: String(it.subject || 'شهادة').slice(0, 200), html: String(it.html || ''),
          attachments: [{ filename: String(it.filename || 'certificate.pdf').replace(/[^\w.\-\u0600-\u06FF ]+/g, '_').slice(0, 120), content: pdf }],
          tags: [{ name: 'type', value: 'certificate' }],
        });
        results.push({ certificateId, to, ok: true, id: r?.id });
        if (certificateId) { try { await db.from('certificates').update({ sent_at: new Date().toISOString(), sent_to: to }).eq('id', certificateId); } catch { /* ignore */ } }
      } catch (e: any) {
        results.push({ certificateId, to, ok: false, error: e?.message || 'فشل الإرسال' });
      }
    }
    try { await db.from('audit_logs').insert({ actor_id: u.user.id, action: 'certificate_email', entity_type: 'certificate', metadata: { sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, to: results.map(r => r.to) } }); } catch { /* optional */ }
    const sent = results.filter(r => r.ok).length;
    return NextResponse.json({ success: sent > 0 || results.length === 0, sent, failed: results.length - sent, results });
  } catch (e: any) {
    return bad(e?.message || 'خطأ غير متوقع', 500);
  }
}
