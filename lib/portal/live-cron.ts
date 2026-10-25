// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// تذكيرات الجلسات التلقائية — تُشغَّل من الـcron اليومي الحالي (/api/followups/send) بلا مهمة cron إضافية
import { sendViaResend } from '../email/resend';
import { dueForReminder, reminderEmail, atharRoomUrl } from './live';
import type { LiveSession } from './live';

export async function runLiveReminders(db: any, site: string, opts: { dry?: boolean; now?: Date } = {}) {
  const now = opts.now || new Date();
  const { data, error } = await db.from('portal_sessions').select('*').eq('status', 'scheduled').is('reminder_sent_at', null).gte('starts_at', now.toISOString()).lte('starts_at', new Date(now.getTime() + 30 * 3600000).toISOString()).limit(200);
  if (error) return { ok: false, error: error.message };
  const due = dueForReminder((data || []) as LiveSession[], now);
  const out: { session_id: string; title: string; recipients: number; sent: number; errors: number }[] = [];
  for (const s of due) {
    const to = new Map<string, string>();
    if (s.classroom_id) { const { data: e } = await db.from('portal_enrollments').select('email,full_name').eq('classroom_id', s.classroom_id).eq('status', 'approved'); for (const x of (e || []) as any[]) to.set(String(x.email).toLowerCase(), x.full_name || ''); }
    else if (s.program_id) { const { data: e } = await db.from('portal_enrollments').select('email,full_name').eq('program_id', s.program_id).eq('status', 'approved'); for (const x of (e || []) as any[]) to.set(String(x.email).toLowerCase(), x.full_name || ''); }
    const { data: regs } = await db.from('portal_session_registrations').select('email,full_name').eq('session_id', s.id); for (const r of (regs || []) as any[]) to.set(String(r.email).toLowerCase(), r.full_name || '');
    const row = { session_id: s.id, title: s.title_ar, recipients: to.size, sent: 0, errors: 0 };
    if (!opts.dry && to.size) {
      const lang = s.lang === 'en' ? 'en' : 'ar'; const join = s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : (s.join_url || `${site}/live/${s.id}`);
      for (const [email, name] of to) { const m = reminderEmail(s, join, `${site}/live/${s.id}`, lang, name); try { await sendViaResend({ to: [email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'live_reminder_auto' }] }); row.sent++; } catch { row.errors++; } }
      await db.from('portal_sessions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', s.id);
    }
    out.push(row);
  }
  return { ok: true, due: due.length, results: out, dry: !!opts.dry };
}
