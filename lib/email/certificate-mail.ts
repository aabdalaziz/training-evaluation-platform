/** قالب بريد الشهادة (HTML متوافق مع عملاء البريد) */
const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export type CertMailInput = {
  recipientName: string; kindLabel: string; programName: string; serial: string; verifyUrl: string; issuedAt: string;
  issuer: string; unit: string; hours?: number | null; awardTitle?: string | null; note?: string | null; senderName?: string | null;
};
export function certificateSubject(i: CertMailInput): string {
  return `${i.kindLabel} — ${i.programName} · ${i.serial}`;
}
export function buildCertificateEmailHtml(i: CertMailInput): string {
  const details = [
    i.awardTitle ? `<b>الجائزة:</b> ${esc(i.awardTitle)}` : '',
    `<b>البرنامج:</b> ${esc(i.programName)}`,
    i.hours ? `<b>الساعات التدريبية:</b> ${i.hours}` : '',
    `<b>الرقم التسلسلي:</b> <span style="font-family:Consolas,monospace;direction:ltr;unicode-bidi:embed">${esc(i.serial)}</span>`,
    `<b>تاريخ الإصدار:</b> ${esc(i.issuedAt)}`,
  ].filter(Boolean).map(x => `<tr><td style="padding:6px 0;font:14px/1.7 Tahoma,Arial;color:#1e293b">${x}</td></tr>`).join('');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f3f6fa;padding:24px 12px;font-family:Tahoma,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e4eaf2" cellspacing="0" cellpadding="0">
  <tr><td style="background:${NAVY};padding:22px 26px;border-bottom:4px solid ${GOLD}">
    <div style="font:700 13px Tahoma,Arial;color:#cfe0f5;opacity:.9">${esc(i.issuer)} · ${esc(i.unit)}</div>
    <div style="font:800 24px/1.4 Tahoma,Arial;color:#fff;margin-top:6px">${esc(i.kindLabel)}</div>
  </td></tr>
  <tr><td style="padding:24px 26px 8px">
    <p style="margin:0 0 10px;font:16px/1.8 Tahoma,Arial;color:#1e293b">الأستاذ/ة <b style="color:${TEAL}">${esc(i.recipientName)}</b> المحترم/ة،</p>
    <p style="margin:0 0 14px;font:14px/1.8 Tahoma,Arial;color:#334155">يسرّنا أن نرفق لكم ${esc(i.kindLabel)} الخاصة بكم. الشهادة صادرة إلكترونيًا وتحمل رقمًا تسلسليًا ورمز تحقق يمكن لأي جهة التأكد من صحتها من خلاله.</p>
    ${i.note ? `<div style="margin:0 0 14px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font:14px/1.8 Tahoma,Arial;color:#78350f">${esc(i.note).replace(/\n/g, '<br>')}</div>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e4eaf2;border-radius:10px;padding:10px 14px">${details}</table>
  </td></tr>
  <tr><td align="center" style="padding:14px 26px 24px">
    <a href="${esc(i.verifyUrl)}" style="display:inline-block;background:${TEAL};color:#fff;text-decoration:none;font:800 15px Tahoma,Arial;padding:12px 26px;border-radius:10px">التحقق من الشهادة</a>
    <div style="margin-top:8px;font:12px Tahoma,Arial;color:#94a3b8;direction:ltr">${esc(i.verifyUrl)}</div>
  </td></tr>
  <tr><td style="padding:14px 26px;background:#f8fafc;border-top:1px solid #e4eaf2;font:12px/1.7 Tahoma,Arial;color:#64748b">
    ${i.senderName ? `أُرسلت بواسطة: ${esc(i.senderName)} · ` : ''}${esc(i.unit)} — ${esc(i.issuer)}. هذه رسالة آلية من المنصة؛ الشهادة مرفقة بصيغة PDF.
  </td></tr>
</table></td></tr></table></body></html>`;
}
