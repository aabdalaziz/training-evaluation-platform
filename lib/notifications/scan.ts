/**
 * تشغيل فحص الإشعارات (خادم فقط): يستدعي RPC notifications_scan ثم يراسل الإدارة بالجديد
 * يُستخدم من /api/notifications/scan ومن الـ Cron اليومي في /api/followups/send
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendViaResend } from '../email/resend';
import { scanEmailHtml, type ScanResult } from './model';

export async function runNotificationScan(db: SupabaseClient, opts: { source: 'cron' | 'manual'; site: string; email?: boolean }): Promise<ScanResult & { emailed?: number; email_error?: string }> {
  const { data, error } = await db.rpc('notifications_scan', { p_source: opts.source });
  if (error) throw new Error(error.message);
  const res = (data || { ok: false, inserted: 0, resolved: 0, new: [] }) as ScanResult;
  if (!opts.email || !res.new?.length || !process.env.RESEND_API_KEY) return res;
  try {
    const to = await adminEmails(db);
    if (!to.length) return { ...res, emailed: 0 };
    const { subject, html } = scanEmailHtml(opts.site, res.new, res.ran_at || new Date().toISOString());
    await sendViaResend({ to, subject, html, tags: [{ name: 'kind', value: 'notifications' }] });
    return { ...res, emailed: to.length };
  } catch (e: any) { return { ...res, emailed: 0, email_error: e?.message || String(e) }; }
}

/** مستلمو بريد الإشعارات: NOTIFY_EMAILS (مفصولة بفواصل) وإلا مديرو المنصة من profiles */
export async function adminEmails(db: SupabaseClient): Promise<string[]> {
  const env = (process.env.NOTIFY_EMAILS || '').split(/[,\s;]+/).map(s => s.trim().toLowerCase()).filter(s => /@/.test(s));
  if (env.length) return Array.from(new Set(env));
  const { data } = await db.from('profiles').select('email,role').limit(500);
  const rows = (data || []) as { email: string | null; role: string | null }[];
  return Array.from(new Set(rows.filter(r => r.email && ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(String(r.role || '').toUpperCase())).map(r => String(r.email).toLowerCase())));
}
