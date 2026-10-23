/**
 * مركز الإشعارات — الأنواع والتسميات والمساعدات (بدون تبعيات)
 */
export type Severity = 'info' | 'warn' | 'critical';
export type NotificationKind =
  | 'followup_missing' | 'followup_silent' | 'followup_manual_due' | 'session_unclosed'
  | 'certificates_missing' | 'impact_post_pending' | 'low_transfer' | 'program_overdue' | 'system_health' | 'manual';

export type Notification = {
  id: string; organization_id?: string | null; kind: NotificationKind | string; severity: Severity;
  title: string; body: string | null; href: string | null; entity_id?: string | null; dedupe_key?: string;
  created_at: string; read_at: string | null; read_by?: string | null; resolved_at: string | null;
};

export type ScanResult = { ok: boolean; inserted: number; resolved: number; new: { id: string; kind: string; severity: Severity; title: string; href: string | null }[]; ran_at?: string };

export const KIND_LABEL: Record<string, { ar: string; icon: string }> = {
  followup_missing:     { ar: 'متابعة الأثر', icon: 'trend' },
  followup_silent:      { ar: 'متابعة الأثر', icon: 'trend' },
  followup_manual_due:  { ar: 'متابعة الأثر', icon: 'send' },
  session_unclosed:     { ar: 'الحضور', icon: 'check' },
  certificates_missing: { ar: 'الشهادات', icon: 'certificate' },
  impact_post_pending:  { ar: 'قياس الأثر', icon: 'target' },
  low_transfer:         { ar: 'نقل الأثر', icon: 'alert' },
  program_overdue:      { ar: 'البرامج', icon: 'programs' },
  system_health:        { ar: 'صحة المنصة', icon: 'shield' },
  manual:               { ar: 'عام', icon: 'bell' },
};
export const SEVERITY_LABEL: Record<Severity, string> = { info: 'معلومة', warn: 'تنبيه', critical: 'حرج' };
export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };

export function kindLabel(kind: string): string { return KIND_LABEL[kind]?.ar || 'عام'; }
export function kindIcon(kind: string): string { return KIND_LABEL[kind]?.icon || 'bell'; }

/** الإشعارات المفتوحة (غير المحلولة) مرتبة: الحرج أولًا ثم الأحدث */
export function openOnes(list: Notification[]): Notification[] {
  return list.filter(n => !n.resolved_at).sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (b.created_at < a.created_at ? -1 : b.created_at > a.created_at ? 1 : 0));
}
export function unreadCount(list: Notification[]): number { return list.filter(n => !n.resolved_at && !n.read_at).length; }

export function countBySeverity(list: Notification[]): Record<Severity, number> {
  const out: Record<Severity, number> = { info: 0, warn: 0, critical: 0 };
  for (const n of list) if (!n.resolved_at) out[n.severity] = (out[n.severity] || 0) + 1;
  return out;
}

/** «قبل 5 دقائق» / «قبل 3 أيام» */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  if (h < 24) return `قبل ${h} ساعة`;
  if (d < 30) return `قبل ${d} يومًا`;
  return new Date(iso).toISOString().slice(0, 10);
}

/** نص بريد الملخص للإدارة عند ظهور إشعارات جديدة */
export function scanEmailHtml(site: string, items: ScanResult['new'], ranAt: string): { subject: string; html: string } {
  const sev = (s: Severity) => (s === 'critical' ? '#dc2626' : s === 'warn' ? '#d97706' : '#0b8a83');
  const rows = items.map(i => `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sev(i.severity)};margin-inline-end:8px"></span>${esc(i.title)}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${i.href ? `<a href="${site}${i.href}" style="color:#0f2a4e;font-weight:700">فتح</a>` : ''}</td></tr>`).join('');
  const crit = items.filter(i => i.severity === 'critical').length;
  return {
    subject: `منصة التقويم: ${items.length} إشعار جديد${crit ? ` (${crit} حرج)` : ''}`,
    html: `<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a">
<div style="border-top:4px solid #c9a24b;background:#0f2a4e;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:17px">مركز الإشعارات — ${items.length} إشعار جديد</b><div style="font-size:12px;color:#cbd5e1;margin-top:4px">${esc(ranAt.slice(0, 16).replace('T', ' '))}</div></div>
<div style="border:1px solid #e2e8f0;border-top:0;padding:14px 20px;border-radius:0 0 12px 12px"><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
<p style="margin:14px 0 0"><a href="${site}/admin/notifications" style="display:inline-block;background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:800">فتح مركز الإشعارات</a></p></div></div>`,
  };
}
function esc(s: string): string { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
