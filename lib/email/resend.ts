// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * إرسال البريد — يعمل على الخادم فقط (لا يُستورد من مكوّنات المتصفح).
 * منذ P16: كل نداء sendViaResend يمرّ عبر محرك الإبلاغ متعدد القنوات (lib/portal/notify.ts):
 *  لكل مستلم: واتساب (إن وافق وكان مضبوطًا) ← بريد ← إشعار فوري ← «قائمة اليد» في /admin/outreach — ويُسجَّل كل شيء في portal_message_log.
 *  التوقيع القديم محفوظ كما هو (to/subject/html/attachments/replyTo/tags) فلا يتغير أي مرسِل قائم.
 *  إن لم تصل الرسالة عبر أي قناة آلية يرمي خطأً عربيًا واضحًا (كما كان) — لكن الرسالة محفوظة في «قائمة اليد» ولا تضيع، ولا تُكرَّر فيها خلال 7 أيام.
 */
import { createClient } from '@supabase/supabase-js';
import { notify, sendEmailRaw, fromAddress as fromAddr, type Delivery } from '../portal/notify';
import type { OutMessage } from '../portal/notify';

export type MailAttachment = { filename: string; content: string }; // content = base64
export type MailPayload = { to: string[]; subject: string; html: string; attachments?: MailAttachment[]; replyTo?: string; tags?: { name: string; value: string }[]; kind?: string; url?: string | null; ref?: string | null; name?: string | null; params?: Record<string, string> };

export function fromAddress(): string { return fromAddr(); }

function serviceDb(): any | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) return null;
  try { return createClient(url, key, { auth: { persistSession: false } }); } catch { return null; }
}

export async function sendViaResend(payload: MailPayload): Promise<{ id?: string; channel?: string; deliveries?: Delivery[] }> {
  const db = serviceDb(); const kind = payload.kind || payload.tags?.find(t => t.name === 'kind')?.value || 'notice';
  const to = Array.from(new Set((payload.to || []).map(x => String(x || '').trim()).filter(Boolean)));
  if (!to.length) throw new Error('لا مستلم');
  if (!db) return sendEmailRaw({ to, subject: payload.subject, html: payload.html, attachments: payload.attachments, replyTo: payload.replyTo, tags: payload.tags });
  const deliveries: Delivery[] = [];
  for (const email of to) {
    const msg: OutMessage = { kind, to: { email, name: to.length === 1 ? payload.name || null : null }, subject: payload.subject, html: payload.html, url: payload.url || null, ref: payload.ref || null, params: payload.params, attachments: payload.attachments, replyTo: payload.replyTo };
    deliveries.push(await notify(db, msg));
  }
  const first = deliveries[0];
  // الحفاظ على دلالة الخطأ القديمة للمرسِلين القائمين: إن لم تصل الرسالة عبر أي قناة آلية نرمي خطأً واضحًا (الرسالة نفسها محفوظة في «قائمة اليد» ولن تضيع)
  const failed = deliveries.filter(d => d.channel === 'manual');
  if (failed.length === deliveries.length) throw new Error(`لم تصل عبر أي قناة آلية — محفوظة في «قائمة اليد» (/admin/outreach)${first?.error ? ': ' + first.error : ''}`);
  return { id: first?.provider_id || undefined, channel: first?.channel, deliveries };
}
