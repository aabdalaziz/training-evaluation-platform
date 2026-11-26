// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P83 */
/**
 * /api/cron/finance — المهمّة المالية اليومية
 *  GET ?key=CRON_SECRET (أو Bearer) [&dry=1]
 *   1) تحرير المقاعد المنتهية مهلتها (portal_release_expired_seats): الطلب → قائمة الانتظار، الفاتورة → ملغاة، بريد للمتقدّم وملخّص للإدارة.
 *   2) تذكير السداد قبل الاستحقاق بيومين (مرّة واحدة لكلّ فاتورة — يُعلَّم في notes بوسم [reminded]).
 *  تُستدعى من المهمّة اليومية القائمة (/api/followups/send) ويمكن تشغيلها يدويًّا بالمفتاح.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '../../../../lib/shield/body';
import { sendViaResend } from '../../../../lib/email/resend';
import { money } from '../../../../lib/portal/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const wrap = (body: string) => `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9;color:#22101F">${body}<p style="color:#8a7580;font-size:12px">بوّابة أَثَر · athar-portal.com</p></div>`;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return NextResponse.json({ success: false, error: 'إعدادات الخادم غير مكتملة' }, { status: 500 });
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const dry = new URL(req.url).searchParams.get('dry') === '1'; const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
  const admins = String(process.env.NOTIFY_EMAILS || '').split(/[,;\s]+/).filter(Boolean);
  const out: { released: number; reminded: number; mail_errors: number; dry: boolean; error?: string } = { released: 0, reminded: 0, mail_errors: 0, dry };

  /* 1) تحرير المقاعد */
  const { data: rel, error } = await db.rpc('portal_release_expired_seats', { p_dry: dry });
  if (error) out.error = error.message;
  const released = (rel || []) as { enrollment_id: string; invoice_no: string; program_id: string; full_name: string; email: string; due_date: string; lang: string }[];
  out.released = released.length;
  if (released.length) {
    const pids = Array.from(new Set(released.map((r) => r.program_id))); const { data: progs } = await db.from('programs').select('id,name_ar,name_en').in('id', pids);
    const pname = (id: string, lang: string) => { const p = (progs || []).find((x: any) => x.id === id) as any; return p ? (lang === 'en' && p.name_en ? p.name_en : p.name_ar) : ''; };
    if (!dry) for (const r of released) {
      const en = r.lang === 'en'; const pn = pname(r.program_id, r.lang);
      const html = wrap(en ? `<p>Dear ${esc(r.full_name)},</p><p>The payment window for <b>${esc(pn)}</b> (invoice ${esc(r.invoice_no)}, due ${esc(r.due_date)}) has passed, so your seat was released and your request moved to the waiting list. If you still wish to join, reply to this email and we will re-issue the invoice if a seat is available.</p>` : `<p>عزيزنا/عزيزتنا ${esc(r.full_name)}،</p><p>انقضت مهلة سداد رسوم <b>${esc(pn)}</b> (الفاتورة ${esc(r.invoice_no)} — الاستحقاق ${esc(r.due_date)})، فحُرّر مقعدك وانتقل طلبك إلى قائمة الانتظار. إن كنت ما زلت ترغب بالالتحاق فردّ على هذا البريد وسنعيد إصدار الفاتورة عند توفّر مقعد.</p>`);
      try { await sendViaResend({ to: [r.email], subject: en ? `Seat released — ${pn}` : `تحرير المقعد — ${pn}`, html, tags: [{ name: 'kind', value: 'seat_released' }] }); } catch { out.mail_errors++; }
    }
    if (admins.length && !dry) { const rows = released.map((r) => `<li>${esc(r.full_name)} — ${esc(pname(r.program_id, 'ar'))} — ${esc(r.invoice_no)} (استحقاق ${esc(r.due_date)})</li>`).join(''); try { await sendViaResend({ to: admins, subject: `تحرير ${released.length} مقعدًا لانتهاء مهلة السداد`, html: wrap(`<p>حُرّرت المقاعد التالية آليًّا وانتقل أصحابها إلى قائمة الانتظار:</p><ul>${rows}</ul><p><a href="${site}/admin/enrollments">فتح طلبات التسجيل</a></p>`), tags: [{ name: 'kind', value: 'seat_released_admin' }] }); } catch { out.mail_errors++; } }
  }

  /* 2) تذكير السداد قبل الاستحقاق بيومين */
  const in2 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); const today = new Date().toISOString().slice(0, 10);
  const { data: due } = await db.from('portal_invoices').select('id,invoice_no,customer_name,customer_email,total,currency,due_date,lang,program_id,notes').eq('status', 'unpaid').gte('due_date', today).lte('due_date', in2).limit(200);
  const pending = ((due || []) as any[]).filter((i) => !String(i.notes || '').includes('[reminded]'));
  if (pending.length) {
    const pids = Array.from(new Set(pending.map((i) => i.program_id).filter(Boolean))); const { data: progs } = pids.length ? await db.from('programs').select('id,name_ar,name_en').in('id', pids) : { data: [] as any[] };
    for (const i of pending) {
      const p = (progs || []).find((x: any) => x.id === i.program_id) as any; const en = i.lang === 'en'; const pn = p ? (en && p.name_en ? p.name_en : p.name_ar) : i.invoice_no;
      const html = wrap(en ? `<p>Dear ${esc(i.customer_name)},</p><p>A reminder that invoice <b>${esc(i.invoice_no)}</b> for <b>${esc(pn)}</b> (${esc(money(i.total, i.currency, 'en'))}) is due on <b>${esc(i.due_date)}</b>. Your seat is held until then.</p><p><a href="${site}/pay/${i.id}">Pay / upload receipt</a></p>` : `<p>عزيزنا/عزيزتنا ${esc(i.customer_name)}،</p><p>نذكّرك بأنّ الفاتورة <b>${esc(i.invoice_no)}</b> لبرنامج <b>${esc(pn)}</b> (${esc(money(i.total, i.currency, 'ar'))}) تستحقّ في <b>${esc(i.due_date)}</b>؛ مقعدك محجوز حتى ذلك الحين.</p><p><a href="${site}/pay/${i.id}">الدفع أو رفع الإيصال</a></p>`);
      if (dry) { out.reminded++; continue; }
      try { await sendViaResend({ to: [i.customer_email], subject: en ? `Payment reminder — ${pn}` : `تذكير بالسداد — ${pn}`, html, tags: [{ name: 'kind', value: 'invoice_reminder' }] }); await db.from('portal_invoices').update({ notes: `${i.notes ? i.notes + ' ' : ''}[reminded]` }).eq('id', i.id); out.reminded++; } catch { out.mail_errors++; }
    }
  }
  return NextResponse.json({ success: !out.error, ...out }, { status: out.error ? 500 : 200, headers: { 'Cache-Control': 'no-store' } });
}
