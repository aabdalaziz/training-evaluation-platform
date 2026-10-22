/**
 * إرسال روابط متابعة الأثر السلوكي بالبريد — يعمل على الخادم فقط
 * يُستخدم من /api/followups/send (يدوي من لوحة الإدارة + تلقائي عبر Cron)
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendViaResend } from '../email/resend';
import type { BehaviorFollowup, Recipient } from './model';

export type DispatchMode = 'send' | 'remind' | 'test';
export type DispatchResult = { followup_id: string; mode: DispatchMode; total: number; sent: number; skipped: number; failed: number; errors: string[] };

export function respondentHash(followupId: string, role: string, email: string | null, name: string): string {
  return createHash('md5').update(`${followupId}:${role}:${email ? email.toLowerCase().trim() : name.toLowerCase().trim()}`).digest('hex');
}

export function followupLink(site: string, token: string, r: Recipient): string {
  const qp = new URLSearchParams({ role: r.role });
  if (r.role !== 'trainee') { if (r.trainee_name) qp.set('tn', r.trainee_name); if (r.trainee_email) qp.set('te', r.trainee_email); }
  return `${site}/followup/${token}?${qp.toString()}`;
}

export function buildEmail(f: BehaviorFollowup, programName: string, r: Recipient, link: string, remind: boolean): { subject: string; html: string } {
  const who = r.role === 'supervisor' ? `بصفتك المشرف المباشر${r.trainee_name ? ` على <b>${esc(r.trainee_name)}</b>` : ''}` : r.role === 'peer' ? 'بصفتك زميل عمل' : 'بصفتك أحد المشاركين في البرنامج';
  const subject = `${remind ? 'تذكير: ' : ''}متابعة أثر التدريب — ${programName}`;
  const html = `
  <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f3f6fa;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #c9a24b;border-radius:14px;padding:24px">
      <div style="color:#0b8a83;font-weight:bold;font-size:12px">منصة التقويم والجودة — متابعة أثر التدريب في بيئة العمل</div>
      <h2 style="color:#0f2a4e;margin:8px 0 4px">${esc(f.title_ar)}</h2>
      <div style="color:#475569;font-size:13px;margin-bottom:14px">البرنامج: <b>${esc(programName)}</b></div>
      <p style="color:#0f172a;font-size:14px;line-height:1.9">مرحبًا ${esc(r.name)}،<br>${who}، نرجو تخصيص <b>3 دقائق</b> لتقييم ما تم تطبيقه فعليًا في العمل من محتوى البرنامج. إجاباتك تساعدنا على قياس الأثر الحقيقي وتحسين البرامج القادمة.</p>
      ${remind ? '<p style="color:#9a3412;font-size:13px;font-weight:bold">هذا تذكير — إن كنت قد أجبت مسبقًا فتجاهل هذه الرسالة.</p>' : ''}
      <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#0f2a4e;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:bold;font-size:15px;display:inline-block">ابدأ التقييم</a></p>
      <p style="color:#94a3b8;font-size:11.5px;line-height:1.7">إن لم يعمل الزر انسخ الرابط: <br><span dir="ltr">${link}</span></p>
    </div>
  </div>`;
  return { subject, html };
}

/** إرسال/تذكير لحملة واحدة. remind: يستثني من أجاب فعلًا (نفس تجزئة الخادم). */
export async function dispatchFollowup(db: SupabaseClient, f: BehaviorFollowup, site: string, mode: DispatchMode, testEmail?: string): Promise<DispatchResult> {
  const res: DispatchResult = { followup_id: f.id, mode, total: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
  const { data: pr } = await db.from('programs').select('name_ar').eq('id', f.program_id || '').maybeSingle();
  const programName = String((pr as any)?.name_ar || '—');
  let recipients: Recipient[] = Array.isArray(f.recipients) ? f.recipients : [];
  if (mode === 'test') recipients = [{ name: 'تجربة', email: String(testEmail || ''), role: 'supervisor', trainee_name: 'اسم المتدرب' }];
  recipients = recipients.filter(r => r.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));
  res.total = recipients.length;
  if (!recipients.length) return res;

  let done = new Set<string>();
  if (mode === 'remind') {
    const { data: rs } = await db.from('behavior_responses').select('respondent_hash').eq('followup_id', f.id);
    done = new Set(((rs || []) as any[]).map(x => String(x.respondent_hash)));
  }
  for (const r of recipients) {
    if (mode === 'remind' && done.has(respondentHash(f.id, r.role, r.email, r.name))) { res.skipped++; continue; }
    const link = followupLink(site, f.token, r);
    const { subject, html } = buildEmail(f, programName, r, link, mode === 'remind');
    try { await sendViaResend({ to: [r.email], subject, html, tags: [{ name: 'kind', value: 'behavior_followup' }] }); res.sent++; }
    catch (e: any) { res.failed++; if (res.errors.length < 5) res.errors.push(`${r.email}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 120)); // احترام حد Resend (~10 رسائل/ثانية)
  }
  if (mode === 'send' && res.sent) await db.from('behavior_followups').update({ sent_at: new Date().toISOString() }).eq('id', f.id);
  if (mode === 'remind' && res.sent) await db.from('behavior_followups').update({ reminded_at: new Date().toISOString() }).eq('id', f.id);
  return res;
}

function esc(s: string): string { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
