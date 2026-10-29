// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — «الحارس الزمني» يعمل ضمن الكرون اليومي الحالي (لا كرون جديد):
 *  1) سياسات الاحتفاظ من السجل (حذف/تجهيل ما تجاوز مدته) عبر RPC vault_retention
 *  2) تنفيذ النسيان الذي انتهى حجره
 *  3) تذكير الطاقم بطلبات تستحق خلال ≤ 5 أيام أو تأخرت
 *  4) تذكير بحوادث مفتوحة مضى عليها > 48 ساعة بلا إبلاغ
 */
import { retentionRules } from './registry';
import { dueErasures, executeErasure } from './erasure';
import { dueSoon, daysLeft } from './dsr';
import { openIncidents, hoursLeft } from './incidents';
import { notify } from '../portal/notify';

const staffEmails = (env: Record<string, string | undefined>) => String(env.DATA_PROTECTION_CONTACT || env.NOTIFY_EMAILS || env.ADMIN_EMAILS || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

export async function runRetention(db: any, dry: boolean) {
  const out: { table: string; action: string; days: number; rows: number | null }[] = [];
  for (const r of retentionRules()) {
    try {
      const { data, error } = await db.rpc('vault_retention', { p_table: r.table, p_ts_col: r.tsCol, p_days: r.retentionDays, p_action: r.policy === 'delete' ? 'delete' : 'anonymize', p_user_col: r.userCol, p_email_col: r.emailCol, p_null_cols: r.piiCols, p_dry: dry });
      out.push({ table: r.table, action: r.policy, days: r.retentionDays || 0, rows: error ? null : Number(data ?? 0) });
    } catch { out.push({ table: r.table, action: r.policy, days: r.retentionDays || 0, rows: null }); }
  }
  return out;
}

export async function runVault(db: any, opts: { dry?: boolean; site: string; env?: Record<string, string | undefined>; now?: Date }) {
  const env = opts.env || process.env; const dry = !!opts.dry; const now = opts.now || new Date(); const site = opts.site.replace(/\/+$/, '');
  const result: any = { dry, retention: [], erasures: [], dsr_reminders: 0, incident_reminders: 0, errors: [] as string[] };
  try { result.retention = await runRetention(db, dry); } catch (e: any) { result.errors.push('retention: ' + (e?.message || e)); }
  try {
    const due = await dueErasures(db, now);
    for (const q of due) { if (dry) { result.erasures.push({ id: q.id, dry: true }); continue; } const r = await executeErasure(db, q, site, env); result.erasures.push({ id: q.id, ok: r.ok, auth: r.authDeleted }); }
  } catch (e: any) { result.errors.push('erasure: ' + (e?.message || e)); }
  const staff = staffEmails(env);
  try {
    const soon = await dueSoon(db, 5, now.getTime());
    const fresh = soon.filter(r => !r.reminded_at || now.getTime() - new Date(r.reminded_at).getTime() > 2 * 864e5);
    if (fresh.length && !dry) {
      const lines = fresh.map(r => `• #${r.id} ${r.kind} — ${r.email} — ${daysLeft(r.due_at, now.getTime()) < 0 ? `متأخر ${-daysLeft(r.due_at, now.getTime())} يوم` : `يستحق خلال ${daysLeft(r.due_at, now.getTime())} يوم`}`);
      for (const to of staff) { try { await notify(db, { kind: 'dsr_due', to: { email: to }, subject: `خزنة أَثَر: ${fresh.length} طلب يقترب موعده النظامي`, text: lines.join('\n') + `\n\nغرفة الطلبات: ${site}/admin/vault`, html: `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><h3>طلبات تقترب من مهلتها (30 يومًا)</h3><ul>${fresh.map(l => `<li>#${l.id} ${l.kind} — ${l.email} — يستحق ${String(l.due_at).slice(0, 10)}</li>`).join('')}</ul><p><a href="${site}/admin/vault">غرفة الطلبات</a></p></div>`, url: `${site}/admin/vault`, ref: `dsr_due:${now.toISOString().slice(0, 10)}` }); } catch { /* */ } }
      await db.from('portal_dsr_requests').update({ reminded_at: now.toISOString() }).in('id', fresh.map(r => r.id)).then(() => null, () => null);
    }
    result.dsr_reminders = fresh.length;
  } catch (e: any) { result.errors.push('dsr: ' + (e?.message || e)); }
  try {
    const inc = (await openIncidents(db)).filter(i => hoursLeft(i.deadline_at, now.getTime()) <= 24 && (!i.reminded_at || now.getTime() - new Date(i.reminded_at).getTime() > 6 * 36e5));
    if (inc.length && !dry) {
      for (const to of staff) { try { await notify(db, { kind: 'incident_due', to: { email: to }, subject: `⚠ خزنة أَثَر: حادثة مفتوحة تقترب من مهلة الـ72 ساعة`, text: inc.map(i => `#${i.id} ${i.summary.slice(0, 80)} — المهلة ${i.deadline_at}`).join('\n') + `\n\n${site}/admin/vault`, url: `${site}/admin/vault`, ref: `incident_due:${inc.map(i => i.id).join(',')}` }); } catch { /* */ } }
      await db.from('portal_incidents').update({ reminded_at: now.toISOString() }).in('id', inc.map(i => i.id)).then(() => null, () => null);
    }
    result.incident_reminders = inc.length;
  } catch (e: any) { result.errors.push('incidents: ' + (e?.message || e)); }
  return result;
}
