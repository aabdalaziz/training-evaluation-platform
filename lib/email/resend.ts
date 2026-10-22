/** إرسال البريد عبر Resend REST API — يعمل على الخادم فقط (لا يُستورد من مكوّنات المتصفح) */
export type MailAttachment = { filename: string; content: string }; // content = base64

export function fromAddress(): string {
  return process.env.REPORTS_FROM_EMAIL || 'Training Evaluation Platform <onboarding@resend.dev>';
}

export async function sendViaResend(payload: { to: string[]; subject: string; html: string; attachments?: MailAttachment[]; replyTo?: string; tags?: { name: string; value: string }[] }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY غير مضبوط في Vercel');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromAddress(), to: payload.to, subject: payload.subject, html: payload.html,
      reply_to: payload.replyTo, attachments: payload.attachments?.map(a => ({ filename: a.filename, content: a.content })), tags: payload.tags,
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || json?.error || `Resend HTTP ${res.status}`);
  return json as { id?: string };
}
