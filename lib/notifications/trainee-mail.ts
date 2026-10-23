/**
 * بريد المتدربين التلقائي (H2) — يعمل داخل Cron المتابعة اليومي (بلا Cron جديد)
 *  R-A  فتح التقييم النهائي: لكل برنامج is_final_open=true → بريد لكل متدرب (بريد من سجلات الحضور) مرة واحدة لكل (برنامج، بريد)
 *  R-B  إصدار الشهادة: شهادة لها recipient_email ولم تُرسل يدويًا خلال GRACE_HOURS → بريد برابط التحقق وبوابة المتدرب، مرة واحدة لكل شهادة
 * التعطيل: TRAINEE_MAIL=0 · الحد الأقصى لكل تشغيل: MAX_PER_RUN
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendViaResend } from '../email/resend';

export const GRACE_HOURS = 24;
export const MAX_PER_RUN = 150;
export type MailKind = 'final_open' | 'certificate_issued';
export type Plan = { kind: MailKind; program_id: string | null; ref_id: string | null; email: string; name: string; program_name: string; extra?: Record<string, string> };
export type RunResult = { enabled: boolean; planned: number; sent: number; failed: number; skipped: number; errors: string[]; by_kind: Record<MailKind, number> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] || 'عزيزي المتدرب';

export function isEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.TRAINEE_MAIL ?? '1').trim().toLowerCase();
  return !(v === '0' || v === 'off' || v === 'false' || v === 'no');
}

/** يخطط الرسائل من بيانات خام (نقية — قابلة للاختبار) */
export function planMails(d: {
  programs: { id: string; name_ar: string; is_final_open?: boolean | null; status?: string | null }[];
  sessions: { id: string; program_id: string }[];
  records: { session_id: string; full_name: string; email?: string | null }[];
  certificates: { id: string; program_id: string | null; recipient_name?: string | null; recipient_email?: string | null; verify_code?: string | null; serial?: string | null; issued_at?: string | null; created_at?: string | null; sent_at?: string | null; revoked_at?: string | null }[];
  log: { kind: string; program_id: string | null; ref_id: string | null; email: string }[];
  now?: Date;
}): Plan[] {
  const now = d.now || new Date();
  const done = new Set(d.log.map(l => `${l.kind}|${l.program_id || ''}|${l.ref_id || ''}|${l.email.toLowerCase()}`));
  const out: Plan[] = [];
  // R-A
  const sessProg = new Map(d.sessions.map(s => [s.id, s.program_id] as const));
  const traineesByProg = new Map<string, Map<string, string>>();
  for (const r of d.records) {
    const pid = sessProg.get(r.session_id); const em = (r.email || '').trim().toLowerCase();
    if (!pid || !EMAIL_RE.test(em)) continue;
    const m = traineesByProg.get(pid) || new Map<string, string>(); if (!m.has(em)) m.set(em, r.full_name || ''); traineesByProg.set(pid, m);
  }
  for (const p of d.programs) {
    if (!p.is_final_open || p.status === 'CANCELLED') continue;
    const m = traineesByProg.get(p.id); if (!m) continue;
    m.forEach((name, email) => { if (!done.has(`final_open|${p.id}||${email}`)) out.push({ kind: 'final_open', program_id: p.id, ref_id: null, email, name, program_name: p.name_ar }); });
  }
  // R-B
  const pname = new Map(d.programs.map(p => [p.id, p.name_ar] as const));
  for (const c of d.certificates) {
    const em = (c.recipient_email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em) || c.revoked_at || c.sent_at || !c.verify_code) continue;
    const issued = new Date(c.issued_at || c.created_at || 0).getTime();
    if (!issued || now.getTime() - issued < GRACE_HOURS * 3600000) continue;
    if (done.has(`certificate_issued|${c.program_id || ''}|${c.id}|${em}`)) continue;
    out.push({ kind: 'certificate_issued', program_id: c.program_id, ref_id: c.id, email: em, name: c.recipient_name || '', program_name: pname.get(c.program_id || '') || 'البرنامج التدريبي', extra: { verify_code: c.verify_code, serial: c.serial || '' } });
  }
  return out.slice(0, MAX_PER_RUN);
}

export function buildMail(site: string, p: Plan): { subject: string; html: string } {
  const me = `${site}/me`;
  const shell = (title: string, body: string, cta: { href: string; label: string }) => `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#f3f6fa;font-family:Tahoma,Arial,sans-serif;color:#0f172a">
<div style="max-width:620px;margin:24px auto;background:#fff;border-radius:16px;border-top:5px solid #c9a24b;padding:28px 30px">
<div style="font-size:12px;font-weight:bold;color:#0b8a83">منصة تقييم التدريب</div>
<h1 style="margin:6px 0 12px;font-size:21px;color:#0f2a4e">${title}</h1>
<div style="font-size:15px;line-height:1.9">${body}</div>
<p style="margin:22px 0"><a href="${cta.href}" style="background:#0b8a83;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">${cta.label}</a></p>
<p style="font-size:12px;color:#64748b;line-height:1.8">إن لم يعمل الزر، انسخ الرابط: <span dir="ltr">${cta.href}</span><br>هذه رسالة تلقائية من بوابة المتدرب — يمكنك الدخول بالبريد نفسه عبر رمز تحقق.</p>
</div></body></html>`;
  if (p.kind === 'final_open') {
    return {
      subject: `التقييم النهائي مفتوح الآن — ${p.program_name}`,
      html: shell('التقييم النهائي للبرنامج مفتوح الآن', `<p>${esc(firstName(p.name))}، شكرًا لمشاركتك في <b>${esc(p.program_name)}</b>.</p><p>فُتح الآن <b>التقييم النهائي</b> للبرنامج، ورأيك مطلوب لإصدار شهادتك ولتطوير الدفعات القادمة. يستغرق أقل من 5 دقائق.</p><p>يمكنك أيضًا متابعة مهامك وشهاداتك من <a href="${me}">بوابة المتدرب</a>.</p>`, { href: `${site}/evaluate/final?program=${encodeURIComponent(p.program_id || '')}`, label: 'ابدأ التقييم النهائي' }),
    };
  }
  const verify = `${site}/verify/${encodeURIComponent(p.extra?.verify_code || '')}`;
  return {
    subject: `صدرت شهادتك — ${p.program_name}`,
    html: shell('مبارك! صدرت شهادتك', `<p>${esc(firstName(p.name))}، يسعدنا إبلاغك بصدور شهادة إتمام <b>${esc(p.program_name)}</b>${p.extra?.serial ? ` برقم <span dir="ltr">${esc(p.extra.serial)}</span>` : ''}.</p><p>يمكنك عرض الشهادة وتنزيلها من <a href="${me}">بوابة المتدرب</a>، والتحقق من صحتها في أي وقت عبر الرابط أدناه.</p>`, { href: verify, label: 'عرض الشهادة والتحقق منها' }),
  };
}

/** التشغيل الفعلي داخل Cron (مفتاح الخدمة) */
export async function runTraineeMail(db: SupabaseClient, site: string, opts: { dry?: boolean; now?: Date } = {}): Promise<RunResult & { plans?: Plan[] }> {
  const res: RunResult & { plans?: Plan[] } = { enabled: isEnabled(), planned: 0, sent: 0, failed: 0, skipped: 0, errors: [], by_kind: { final_open: 0, certificate_issued: 0 } };
  if (!res.enabled) return res;
  const [pg, ss, rc, ce, lg] = await Promise.all([
    db.from('programs').select('id,name_ar,is_final_open,status'),
    db.from('attendance_sessions').select('id,program_id'),
    db.from('attendance_records').select('session_id,full_name,email').limit(50000),
    db.from('certificates').select('id,program_id,recipient_name,recipient_email,verify_code,serial,issued_at,created_at,sent_at,revoked_at').is('sent_at', null).is('revoked_at', null).limit(5000),
    db.from('trainee_mail_log').select('kind,program_id,ref_id,email').limit(50000),
  ]);
  const err = [pg, ss, rc, ce, lg].find(r => r.error)?.error; if (err) { res.errors.push(err.message); return res; }
  const plans = planMails({ programs: (pg.data || []) as any[], sessions: (ss.data || []) as any[], records: (rc.data || []) as any[], certificates: (ce.data || []) as any[], log: (lg.data || []) as any[], now: opts.now });
  res.planned = plans.length;
  if (opts.dry) { res.plans = plans; return res; }
  for (const p of plans) {
    const m = buildMail(site, p);
    try {
      await sendViaResend({ to: [p.email], subject: m.subject, html: m.html, tags: [{ name: 'type', value: p.kind }] });
      res.sent++; res.by_kind[p.kind]++;
      await db.from('trainee_mail_log').insert({ kind: p.kind, program_id: p.program_id, ref_id: p.ref_id, email: p.email, ok: true });
      if (p.kind === 'certificate_issued' && p.ref_id) { try { await db.from('certificates').update({ sent_at: new Date().toISOString(), sent_to: p.email }).eq('id', p.ref_id); } catch { /* ignore */ } }
    } catch (e: any) {
      // لا نسجّل الفشل في السجل كي تُعاد المحاولة في التشغيل التالي
      res.failed++; const msg = e?.message || String(e); if (res.errors.length < 10) res.errors.push(`${p.email}: ${msg}`);
    }
  }
  return res;
}
