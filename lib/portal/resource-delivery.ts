// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P5-ب — تسليم ملفّات الحقيبة المرخَّصة إلى بريد صاحب الترخيص (خادم فقط؛ صلاحية الخدمة).
 *  deliverResourceFiles(db, { invoiceId | grantId }, site) → يُرسل كلّ ملفّات الحقيبة مرفقةً (أو روابط موقّعة 7 أيام إن تجاوز الحجم حدّ البريد)،
 *  ويُحدّث portal_resource_grants.delivered_at ويُسجّل حدث تعلّم 'delivered'. يُستدعى من: تأكيد السداد (payments/set · verify_card · webhook)،
 *  ومن /api/resources action=deliver (الطاقم أو صاحب الترخيص لإعادة الإرسال).
 */
import { sendViaResend } from '../email/resend';

const BUCKET = 'portal-resources';
const MAX_ATTACH_BYTES = 18 * 1024 * 1024; /* حدّ آمن تحت سقف Resend (40 م.ب للرسالة) */
const esc = (s: string) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(b / 1024))} ك.ب`);

export type DeliverResult = { sent: boolean; mode?: 'attachments' | 'links'; files?: number; error?: string; skipped?: string };

export function deliveryEmail(o: { title: string; version: string; email: string; files: { name: string; size: number; url?: string }[]; mode: 'attachments' | 'links'; site: string; resourceId: string; invoiceNo?: string | null }): { subject: string; html: string } {
  const subject = `ملفّات حقيبة «${o.title}» — ترخيصك من أَثَر`;
  const list = o.files.map((f) => `<li style="margin:4px 0"><bdi dir="ltr">${o.mode === 'links' && f.url ? `<a href="${f.url}" style="color:#3A1F36;font-weight:700">${esc(f.name)}</a>` : esc(f.name)}</bdi> <span style="color:#8E7F8A;font-size:12px">(${fmtSize(f.size)})</span></li>`).join('');
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#2A1626;max-width:640px;margin:auto">
    <div style="background:#3A1F36;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0"><div style="font-size:22px;font-weight:900">أَثَر</div><div style="font-size:12.5px;opacity:.85">بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ · مستودع الحقائب</div></div>
    <div style="border:1px solid #EADFD6;border-top:0;padding:20px 22px;border-radius:0 0 14px 14px;background:#fff">
      <h2 style="margin:0 0 8px;color:#3A1F36;font-size:18px">ملفّات حقيبة «${esc(o.title)}» <span style="color:#8E7F8A;font-size:13px;font-weight:600">الإصدار ${esc(o.version)}</span></h2>
      <p style="margin:0 0 12px">شكرًا لك. هذا ترخيص استخدام شخصيّ باسم <b><bdi dir="ltr">${esc(o.email)}</bdi></b>${o.invoiceNo ? ` (الفاتورة <bdi dir="ltr">${esc(o.invoiceNo)}</bdi>)` : ''}. ${o.mode === 'attachments' ? 'ملفّات الحقيبة مرفقة بهذه الرسالة كاملة:' : 'روابط ملفّات الحقيبة (صالحة ٧ أيام من الآن):'}</p>
      <ul style="margin:0 0 14px;padding-inline-start:20px">${list}</ul>
      <div style="background:#FBF4EE;border:1px solid #F1D9A8;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.8">
        <b style="color:#8A5A1E">شروط الترخيص</b><br/>الملفّات لاستخدامك الشخصيّ داخل عملك أو أسرتك؛ لا يجوز إعادة نشرها أو نقلها أو مشاركتها. كلّ ملفّ يحمل حقوق المؤلّف © 2026 د. أحمد محمد عبدالعزيز بدوي. التنزيل من صفحة الحقيبة متاح مرّة واحدة لكلّ ملفّ — احتفظ بهذه الرسالة.
      </div>
      <p style="margin:14px 0 0"><a href="${o.site}/resources/${o.resourceId}" style="background:#3A1F36;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:800;display:inline-block">صفحة الحقيبة</a></p>
      <p style="margin:14px 0 0;color:#8E7F8A;font-size:12px">لم تطلب هذا؟ تواصل معنا عبر البوّابة مع ذكر رقم الفاتورة.</p>
    </div></div>`;
  return { subject, html };
}

export async function deliverResourceFiles(db: any, by: { invoiceId?: string; grantId?: string }, site: string, opts: { force?: boolean } = {}): Promise<DeliverResult> {
  let grant: any = null;
  if (by.grantId) { const { data } = await db.from('portal_resource_grants').select('*').eq('id', by.grantId).maybeSingle(); grant = data; }
  else if (by.invoiceId) {
    const { data: inv } = await db.from('portal_invoices').select('id, invoice_no, resource_id, status, customer_email, user_id').eq('id', by.invoiceId).maybeSingle();
    if (!inv?.resource_id) return { sent: false, skipped: 'ليست فاتورة حقيبة' };
    if (!['paid', 'waived'].includes(String(inv.status))) return { sent: false, skipped: 'الفاتورة غير مسدَّدة' };
    const { data } = await db.from('portal_resource_grants').select('*').eq('invoice_id', inv.id).maybeSingle(); grant = data;
    if (!grant) { /* الزناد لم يعمل بعد؟ أنشئ الترخيص مباشرة */
      await db.from('portal_resource_grants').insert({ resource_id: inv.resource_id, user_id: inv.user_id, email: String(inv.customer_email).toLowerCase(), source: 'invoice', invoice_id: inv.id, note: 'فاتورة ' + inv.invoice_no }).then(() => null, () => null);
      const { data: g } = await db.from('portal_resource_grants').select('*').eq('resource_id', inv.resource_id).ilike('email', String(inv.customer_email)).maybeSingle(); grant = g;
    }
  }
  if (!grant) return { sent: false, error: 'لا ترخيص لهذه الفاتورة' };
  if (grant.delivered_at && !opts.force) return { sent: false, skipped: 'أُرسلت من قبل' };
  const [{ data: r }, { data: files }] = await Promise.all([
    db.from('portal_resources').select('id, title_ar, version, skills').eq('id', grant.resource_id).maybeSingle(),
    db.from('portal_resource_files').select('id, name, path, size').eq('resource_id', grant.resource_id).order('sort'),
  ]);
  if (!r) return { sent: false, error: 'الحقيبة غير موجودة' };
  const list: any[] = files || []; if (!list.length) return { sent: false, error: 'لا ملفّات في الحقيبة بعد' };
  let invoiceNo: string | null = null; if (grant.invoice_id) { const { data: i } = await db.from('portal_invoices').select('invoice_no').eq('id', grant.invoice_id).maybeSingle(); invoiceNo = i?.invoice_no || null; }
  const total = list.reduce((a, f) => a + Number(f.size || 0), 0);
  const mode: 'attachments' | 'links' = total <= MAX_ATTACH_BYTES ? 'attachments' : 'links';
  const attachments: { filename: string; content: string }[] = []; const shown: { name: string; size: number; url?: string }[] = [];
  for (const f of list) {
    if (mode === 'attachments') {
      const { data: blob, error } = await db.storage.from(BUCKET).download(f.path); if (error || !blob) return { sent: false, error: `تعذّر قراءة ${f.name}: ${error?.message || ''}` };
      const buf = Buffer.from(await blob.arrayBuffer()); attachments.push({ filename: f.name, content: buf.toString('base64') }); shown.push({ name: f.name, size: buf.length });
    } else {
      const { data: s } = await db.storage.from(BUCKET).createSignedUrl(f.path, 7 * 24 * 3600, { download: f.name }); shown.push({ name: f.name, size: Number(f.size || 0), url: s?.signedUrl });
    }
  }
  const m = deliveryEmail({ title: r.title_ar, version: r.version || '1.0', email: grant.email, files: shown, mode, site, resourceId: r.id, invoiceNo });
  try { await sendViaResend({ to: [grant.email], subject: m.subject, html: m.html, attachments: mode === 'attachments' ? attachments : undefined, tags: [{ name: 'kind', value: 'resource_files' }], kind: 'resource_files', ref: grant.id, url: `${site}/resources/${r.id}` }); }
  catch (e: any) { return { sent: false, error: String(e?.message || e) }; }
  await db.from('portal_resource_grants').update({ delivered_at: new Date().toISOString() }).eq('id', grant.id);
  await db.from('portal_learning_events').insert({ user_id: grant.user_id || null, email: grant.email, verb: 'delivered', object_type: 'resource', object_id: r.id, skills: r.skills || [], context: { resource_id: r.id, grant_id: grant.id, mode, files: list.length } }).then(() => null, () => null);
  return { sent: true, mode, files: list.length };
}
