// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P76 «رسول مِعيار» — إرسال روابط الدعوة بالبريد من المنصّة (خادم فقط).
 *  الفكرة: الرمز الشخصي لا يُخزَّن إلا مُجزَّأً، فكل «إرسال» يُصدر رمزًا جديدًا للمستلم ويبطل القديم — الرسالة الأخيرة هي الصالحة دائمًا.
 *  يمرّ كل إرسال عبر محرك الإبلاغ (lib/portal/notify: واتساب إن وافق ← بريد ← إشعار ← «قائمة اليد») ويُسجَّل في portal_message_log بنوع miaar_invite.
 *  النصوص ar/en/fr (والباقي يرث en) — بالأسلوب نفسه الذي في بطاقة الترحيب (welcome.ts). دوال خالصة قابلة للاختبار + دالتا قاعدة بيانات تقبلان حقنًا للاختبار.
 */
import { createHash, randomBytes } from 'node:crypto';
import { welcomeText, sessionLine, localeOf, fillW } from './welcome';
import type { InviteRow, RecipientRow } from './invites';
import { inviteUrl } from './invites';

export type MailLang = 'ar' | 'en' | 'fr';
type M = { subject: string; subject_group: string; hello: string; hello_anon: string; intro: string; link_k: string; link_group_k: string; button: string; one_time: string; deadline: string; session_k: string; report: string; closing: string; help: string; copy_hint: string };

const TXT: Record<MailLang, M> = {
  ar: {
    subject: 'أَثَر | دعوتك لاختبار تحديد المستوى «مِعيار» — {label}', subject_group: 'أَثَر | اختبار تحديد المستوى «مِعيار» — {label}',
    hello: 'أهلًا {name}،', hello_anon: 'أهلًا بك،',
    intro: 'هذه دعوتك لاختبار تحديد المستوى في اللغة العربية «مِعيار — من أَثَر» ({label}).',
    link_k: 'رابطك الشخصي', link_group_k: 'رابط الاختبار', button: 'ابدأ الاختبار',
    one_time: 'هذا الرابط خاص بك ويُستخدم مرة واحدة — لا تُرسله لغيرك. إن وصلتك رسالة أحدث فالرابط الأحدث هو الصالح.',
    deadline: 'آخر موعد: {date}', session_k: 'موعد الجلسة', report: 'في النهاية يصلك تقرير مستواك برمز (ML-XXXX-XXXX) — احتفظ به؛ نتيجتك تُستخدم لتسكينك في المجموعة المناسبة فقط.',
    closing: 'إن تعذّر فتح الرابط من هذا البريد انسخه والصقه في المتصفح.', help: 'للاستفسار ردّ على هذه الرسالة.', copy_hint: 'أو انسخ الرابط:',
  },
  en: {
    subject: 'Athar | Your invitation to the Arabic placement test “Mi’yar” — {label}', subject_group: 'Athar | Arabic placement test “Mi’yar” — {label}',
    hello: 'Hello {name},', hello_anon: 'Hello,',
    intro: 'This is your invitation to the Arabic placement test “Mi’yar — by Athar” ({label}).',
    link_k: 'Your personal link', link_group_k: 'Test link', button: 'Start the test',
    one_time: 'This link is personal and works once — please do not forward it. If you receive a newer message, the newest link is the valid one.',
    deadline: 'Deadline: {date}', session_k: 'Your session', report: 'At the end you will receive your level report with a code (ML-XXXX-XXXX) — keep it; your result is used only to place you in the right group.',
    closing: 'If the button does not open, copy the link into your browser.', help: 'Questions? Just reply to this email.', copy_hint: 'Or copy the link:',
  },
  fr: {
    subject: 'ATHAR | Votre invitation au test de positionnement en arabe « Mi’yar » — {label}', subject_group: 'ATHAR | Test de positionnement en arabe « Mi’yar » — {label}',
    hello: 'Bonjour {name},', hello_anon: 'Bonjour,',
    intro: 'Voici votre invitation au test de positionnement en arabe « Mi’yar — by Athar » ({label}).',
    link_k: 'Votre lien personnel', link_group_k: 'Lien du test', button: 'Commencer le test',
    one_time: 'Ce lien est personnel et à usage unique — merci de ne pas le transférer. Si vous recevez un message plus récent, c’est le lien le plus récent qui est valable.',
    deadline: 'À faire avant le : {date}', session_k: 'Votre session', report: 'À la fin, vous recevrez votre rapport de niveau avec un code (ML-XXXX-XXXX) — conservez-le ; votre résultat sert uniquement à vous placer dans le groupe adapté.',
    closing: 'Si le bouton ne s’ouvre pas, copiez le lien dans votre navigateur.', help: 'Une question ? Répondez simplement à cet e-mail.', copy_hint: 'Ou copiez le lien :',
  },
};
export const mailText = (lang: string): M => TXT[(lang === 'ar' || lang === 'fr' ? lang : 'en') as MailLang];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const PLUM = '#3A1F36', CORAL = '#E8795C', CREAM = '#FBF4EE', GOLD = '#D9A866', GREY = '#6B5B67';

export type InviteMailInput = { invite: Pick<InviteRow, 'code' | 'label_ar' | 'lang' | 'kind' | 'expires_at' | 'opens_at' | 'location' | 'service_mode' | 'client_name'>; url: string; name?: string | null; timeZone?: string };
export type InviteMail = { subject: string; html: string; text: string };

function deadlineText(expires_at: string | null | undefined, lang: string, timeZone?: string): string | null {
  if (!expires_at) return null; const d = new Date(expires_at); if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...(timeZone ? { timeZone } : {}) }).format(d);
}

/** بناء الرسالة (موضوع + HTML آمن لعملاء البريد + نص خام) — خالصة. */
export function buildInviteMail(i: InviteMailInput): InviteMail {
  const lang = i.invite.lang || 'en'; const m = mailText(lang); const w = welcomeText(lang); const ar = lang === 'ar'; const dir = ar ? 'rtl' : 'ltr'; const align = ar ? 'right' : 'left';
  const personal = i.invite.kind === 'personal';
  const subject = fillW(personal ? m.subject : m.subject_group, { label: i.invite.label_ar });
  const hello = i.name ? fillW(m.hello, { name: i.name }) : m.hello_anon;
  const session = sessionLine({ opens_at: i.invite.opens_at || null, expires_at: i.invite.expires_at || null }, lang, i.timeZone);
  const deadline = !session ? deadlineText(i.invite.expires_at, lang, i.timeZone) : null;
  const client = i.invite.service_mode === 'external' && i.invite.client_name ? i.invite.client_name : null;
  const lines: string[] = [hello, '', fillW(m.intro, { label: i.invite.label_ar }), ...(client ? [`${w.by_k}: ${client}`] : []), ...(i.invite.location ? [`${w.where_k}: ${i.invite.location}`] : []), '', `${personal ? m.link_k : m.link_group_k}: ${i.url}`, ...(personal ? [m.one_time] : []), ''];
  if (session) { lines.push(`${m.session_k}: ${session.main}`); if (session.extra) lines.push(session.extra); lines.push(w.auto, ''); }
  else if (deadline) lines.push(fillW(m.deadline, { date: deadline }), '');
  lines.push(`${w.tips_k}:`, ...w.tips.map((t) => `• ${t}`), '', m.report, '', w.luck, w.regards, w.team, 'athar-portal.com');
  const text = lines.join('\n');
  const row = (label: string, val: string) => `<tr><td style="padding:4px 0;font:700 13px Tahoma,Arial;color:${GREY};white-space:nowrap">${esc(label)}</td><td style="padding:4px 10px;font:14px Tahoma,Arial;color:${PLUM}">${esc(val)}</td></tr>`;
  const meta = [client ? row(w.by_k, client) : '', i.invite.location ? row(w.where_k, i.invite.location) : '', session ? row(m.session_k, session.main + (session.extra ? ` · ${session.extra}` : '')) : deadline ? row(m.deadline.replace(/[:：]\s*\{date\}.*$/, '').replace('{date}', '').trim(), deadline) : ''].join('');
  const html = `<!doctype html><html lang="${esc(lang)}" dir="${dir}"><body style="margin:0;background:${CREAM};padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EADFD6;direction:${dir};text-align:${align}">
  <tr><td style="height:6px;background:linear-gradient(90deg,${CORAL},${GOLD},${PLUM})"></td></tr>
  <tr><td style="padding:26px 28px 6px;font:900 22px Tahoma,Arial;color:${PLUM}">${esc(w.title)}</td></tr>
  <tr><td style="padding:0 28px;font:15px/1.7 Tahoma,Arial;color:${PLUM}">${esc(hello)}<br>${esc(fillW(m.intro, { label: i.invite.label_ar }))}</td></tr>
  ${meta ? `<tr><td style="padding:12px 28px 0"><table role="presentation" cellspacing="0" cellpadding="0">${meta}</table></td></tr>` : ''}
  <tr><td style="padding:22px 28px 6px" align="center"><a href="${esc(i.url)}" style="display:inline-block;background:${CORAL};color:#fff;text-decoration:none;font:900 16px Tahoma,Arial;padding:14px 30px;border-radius:999px">${esc(m.button)} ${ar ? '←' : '→'}</a></td></tr>
  <tr><td style="padding:0 28px 8px;font:12px/1.6 Tahoma,Arial;color:${GREY}" align="center">${esc(m.copy_hint)}<br><a href="${esc(i.url)}" dir="ltr" style="color:${PLUM};word-break:break-all">${esc(i.url)}</a></td></tr>
  ${personal ? `<tr><td style="padding:6px 28px 0;font:13px/1.6 Tahoma,Arial;color:#B9544A">${esc(m.one_time)}</td></tr>` : ''}
  ${session ? `<tr><td style="padding:10px 28px 0;font:13px/1.6 Tahoma,Arial;color:${GREY}">${esc(w.auto)}</td></tr>` : ''}
  <tr><td style="padding:18px 28px 0"><div style="background:${CREAM};border-radius:12px;padding:14px 18px"><div style="font:700 13px Tahoma,Arial;color:${PLUM};margin-bottom:6px">${esc(w.tips_k)}</div>${w.tips.map((t) => `<div style="font:13px/1.7 Tahoma,Arial;color:${PLUM}">• ${esc(t)}</div>`).join('')}</div></td></tr>
  <tr><td style="padding:14px 28px 0;font:13px/1.7 Tahoma,Arial;color:${GREY}">${esc(m.report)}</td></tr>
  <tr><td style="padding:12px 28px 0;font:13px/1.7 Tahoma,Arial;color:${GREY}">${esc(w.about_miaar)}</td></tr>
  <tr><td style="padding:20px 28px 4px;font:15px/1.7 Tahoma,Arial;color:${PLUM}">${esc(w.luck)}<br>${esc(w.regards)}<br><b>${esc(w.team)}</b></td></tr>
  <tr><td style="padding:6px 28px 24px;font:12px/1.6 Tahoma,Arial;color:${GREY}">${esc(m.closing)} ${esc(m.help)}<br><span dir="rtl">أَثَر — بوّابة أَثَر للتعليم والتدريب والتطوير والجودة</span> · <a href="https://athar-portal.com" style="color:${GREY}">athar-portal.com</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

// ====================================================================== الإرسال
export type MailMode = 'unsent' | 'unopened' | 'all';
export type MailItem = { email: string; name: string | null; url: string; recipient_id?: string | null };
export type MailOutcome = { email: string; name: string | null; ok: boolean; channel: string | null; error: string | null };
export type MailSummary = { ok: true; sent: number; failed: number; skipped: { finished: number; started: number; mailed: number }; total: number; outcomes: MailOutcome[]; note_ar: string } | { ok: false; error: string };
type NotifyFn = (db: any, msg: any) => Promise<{ ok: boolean; channel: string; error?: string | null }>;
export type SendOpts = { site: string; mode?: MailMode; emails?: string[]; now?: Date; notifyFn?: NotifyFn; tokenFn?: () => string; timeZone?: string };

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function parseEmails(raw: unknown): string[] { const seen = new Set<string>(); const out: string[] = []; for (const ln of String(raw || '').split(/[\n,;]+/)) { const m = ln.match(/[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+/); if (!m) continue; const e = m[0].toLowerCase(); if (EMAIL_RE.test(e) && !seen.has(e)) { seen.add(e); out.push(e); } } return out; }

async function defaultNotify(db: any, msg: any) { const { notify } = await import('../portal/notify'); return notify(db, msg); }

/** يرسل رسائل جاهزة (روابطها معلومة) ويسجّل النتيجة على المستلمين وعلى الدعوة. */
export async function deliverInviteMail(db: any, invite: InviteRow, items: MailItem[], opts: SendOpts): Promise<{ outcomes: MailOutcome[]; sent: number; failed: number }> {
  const notifyFn = opts.notifyFn || defaultNotify; const now = (opts.now || new Date()).toISOString(); const outcomes: MailOutcome[] = [];
  for (const it of items) {
    const mail = buildInviteMail({ invite, url: it.url, name: it.name, timeZone: opts.timeZone });
    let d: { ok: boolean; channel: string; error?: string | null };
    try { d = await notifyFn(db, { kind: 'miaar_invite', to: { email: it.email, name: it.name }, subject: mail.subject, html: mail.html, url: it.url, ref: invite.id, params: { title: invite.label_ar, when: '' } }); } catch (e: any) { d = { ok: false, channel: 'manual', error: String(e?.message || e) }; }
    const ok = d.ok && d.channel !== 'manual'; const err = ok ? null : (d.error || 'لم تصل عبر قناة آلية — في «قائمة اليد»');
    outcomes.push({ email: it.email, name: it.name, ok, channel: d.channel || null, error: err });
    if (it.recipient_id) { try { const { data: cur } = await db.from('placement_invite_recipients').select('mail_count').eq('id', it.recipient_id).maybeSingle(); await db.from('placement_invite_recipients').update(ok ? { mailed_at: now, mail_count: (Number((cur as any)?.mail_count) || 0) + 1, mail_channel: d.channel, mail_error: null } : { mail_error: err, mail_channel: d.channel || null }).eq('id', it.recipient_id); } catch { /* ignore */ } }
  }
  const sent = outcomes.filter((o) => o.ok).length; const failed = outcomes.length - sent;
  if (sent) { try { await db.from('placement_invites').update({ mail_sent_at: now, mail_count: (Number(invite.mail_count) || 0) + sent }).eq('id', invite.id); } catch { /* ignore */ } }
  return { outcomes, sent, failed };
}

/** الإرسال من صفّ الدعوة: شخصية → يُصدر رمزًا جديدًا لكل مستلم مستحقّ ويرسل؛ جماعية → يرسل الرابط العام إلى قائمة بريد مُمرَّرة. */
export async function sendInviteMail(db: any, inviteId: unknown, opts: SendOpts): Promise<MailSummary> {
  const id = String(inviteId || ''); if (!id) return { ok: false, error: 'لا دعوة' };
  const { data: inv } = await db.from('placement_invites').select('*').eq('id', id).maybeSingle(); const invite = inv as InviteRow | null; if (!invite) return { ok: false, error: 'الدعوة غير موجودة' };
  if (invite.status !== 'open') return { ok: false, error: 'الدعوة مغلقة — افتحها أولًا' };
  if (invite.expires_at && Date.parse(invite.expires_at) < (opts.now || new Date()).getTime()) return { ok: false, error: 'انتهى موعد الدعوة — مدّده أولًا' };
  const mode: MailMode = opts.mode === 'unopened' || opts.mode === 'all' ? opts.mode : 'unsent';
  const skipped = { finished: 0, started: 0, mailed: 0 };
  let items: MailItem[] = [];
  if (invite.kind === 'personal') {
    const { data } = await db.from('placement_invite_recipients').select('*').eq('invite_id', id); const rows = (data || []) as Array<RecipientRow & { mailed_at?: string | null }>;
    const only = opts.emails && opts.emails.length ? new Set(opts.emails.map((e) => e.toLowerCase())) : null;
    for (const r of rows) {
      if (only && !only.has(r.email.toLowerCase())) continue;
      if (r.report_id) { skipped.finished += 1; continue; }
      if (r.started_at) { skipped.started += 1; continue; }
      if (mode === 'unsent' && r.mailed_at) { skipped.mailed += 1; continue; }
      if (mode === 'unopened' && r.opened_at) { skipped.mailed += 1; continue; }
      const token = (opts.tokenFn || (() => randomBytes(12).toString('base64url')))();
      const up = await db.from('placement_invite_recipients').update({ token_hash: hash(token), opened_at: null }).eq('id', r.id); if (up?.error) return { ok: false, error: `تعذّر تجديد رمز ${r.email}: ${up.error.message}` };
      items.push({ email: r.email, name: r.name, url: inviteUrl(opts.site, invite.code, token), recipient_id: r.id });
    }
    if (!items.length && !rows.length) return { ok: false, error: 'لا مستلمين في هذه الدعوة' };
  } else {
    const emails = (opts.emails || []).filter((e) => EMAIL_RE.test(e)); if (!emails.length) return { ok: false, error: 'الدعوة جماعية — ألصق قائمة البريد أولًا' };
    if (emails.length > 300) return { ok: false, error: 'حدّ الدفعة 300 بريد' };
    items = emails.map((e) => ({ email: e, name: null, url: inviteUrl(opts.site, invite.code) }));
  }
  const r = items.length ? await deliverInviteMail(db, invite, items, opts) : { outcomes: [], sent: 0, failed: 0 };
  const parts = [`أُرسل ${r.sent}`]; if (r.failed) parts.push(`تعذّر ${r.failed}`); if (skipped.mailed) parts.push(`سبق إرساله ${skipped.mailed}`); if (skipped.started) parts.push(`بدأ ${skipped.started}`); if (skipped.finished) parts.push(`أنهى ${skipped.finished}`);
  return { ok: true, sent: r.sent, failed: r.failed, skipped, total: items.length, outcomes: r.outcomes, note_ar: parts.join(' · ') + (invite.kind === 'personal' && r.sent ? ' — الروابط القديمة لمن أُرسل له أُبطلت؛ رسالة البريد هي المرجع.' : '') };
}

/** بعد الإنشاء مباشرة: إرسال الروابط المولَّدة للتوّ بلا تجديد رمز. */
export async function mailFreshLinks(db: any, invite: InviteRow, links: Array<{ email: string; name: string | null; url: string }>, opts: SendOpts): Promise<MailSummary> {
  if (!links.length) return { ok: false, error: 'لا روابط' };
  const { data } = await db.from('placement_invite_recipients').select('id,email').eq('invite_id', invite.id); const byEmail = new Map(((data || []) as any[]).map((r) => [String(r.email).toLowerCase(), String(r.id)]));
  const items: MailItem[] = links.map((l) => ({ email: l.email, name: l.name, url: l.url, recipient_id: byEmail.get(l.email.toLowerCase()) || null }));
  const r = await deliverInviteMail(db, invite, items, opts);
  return { ok: true, sent: r.sent, failed: r.failed, skipped: { finished: 0, started: 0, mailed: 0 }, total: items.length, outcomes: r.outcomes, note_ar: `أُرسل ${r.sent}${r.failed ? ` · تعذّر ${r.failed}` : ''} من ${items.length} بالبريد.` };
}
