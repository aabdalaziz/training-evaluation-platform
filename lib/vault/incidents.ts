// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — دفتر الحوادث (72 ساعة): فتح حادثة (يدويًا أو من حدث حرج في درع أَثَر) · مسودة بلاغ سدايا جاهزة · تسجيل الإبلاغ · إشعار المتأثرين · الإغلاق.
 *  المادة 24 من اللائحة التنفيذية: إبلاغ الهيئة خلال 72 ساعة من العلم بالحادثة إذا كان فيها ضرر محتمل، وإبلاغ الأفراد دون تأخير.
 */
import { INCIDENT_HOURS, byTable } from './registry';

export type IncidentStatus = 'open' | 'reported' | 'closed' | 'dismissed';
export type IncidentRow = { id: number; created_at: string; created_by: string | null; discovered_at: string; deadline_at: string; reported_at: string | null; sdaia_ref: string | null; status: IncidentStatus; severity: 'low' | 'medium' | 'high' | 'critical'; summary: string; tables: string[]; affected_count: number | null; actions: string | null; security_event_id: number | null; affected_notified_at: string | null; closed_at: string | null; reminded_at: string | null };
export const INCIDENT_STATUS_AR: Record<IncidentStatus, string> = { open: 'مفتوحة — العدّاد يعمل', reported: 'أُبلغت الهيئة', closed: 'مغلقة', dismissed: 'ليست حادثة بيانات' };

export const hoursLeft = (deadline: string, now = Date.now()) => (new Date(deadline).getTime() - now) / 36e5;

export async function openIncident(db: any, p: { summary: string; tables?: string[]; affected_count?: number | null; severity?: IncidentRow['severity']; discovered_at?: string; security_event_id?: number | null; created_by?: string | null; actions?: string | null }): Promise<{ row: IncidentRow | null; error?: string }> {
  if (!p.summary || p.summary.trim().length < 10) return { row: null, error: 'اكتب وصفًا موجزًا للحادثة (10 أحرف فأكثر)' };
  if (p.security_event_id) { const { data: ex } = await db.from('portal_incidents').select('*').eq('security_event_id', p.security_event_id).limit(1); if (ex?.length) return { row: ex[0] as IncidentRow }; }
  const discovered = p.discovered_at ? new Date(p.discovered_at) : new Date();
  const deadline = new Date(discovered.getTime() + INCIDENT_HOURS * 36e5).toISOString();
  const { data, error } = await db.from('portal_incidents').insert({ status: 'open', summary: p.summary.trim().slice(0, 1000), tables: (p.tables || []).filter(Boolean), affected_count: p.affected_count ?? null, severity: p.severity || 'high', discovered_at: discovered.toISOString(), deadline_at: deadline, security_event_id: p.security_event_id || null, created_by: p.created_by || null, actions: p.actions || null }).select('*').maybeSingle();
  if (error) return { row: null, error: error.message };
  return { row: data as IncidentRow };
}

export async function markReported(db: any, id: number, sdaia_ref: string, affected_notified = false) {
  const patch: any = { status: 'reported', reported_at: new Date().toISOString(), sdaia_ref: String(sdaia_ref || '').slice(0, 120) || 'بلاغ مقدَّم' };
  if (affected_notified) patch.affected_notified_at = new Date().toISOString();
  const { data, error } = await db.from('portal_incidents').update(patch).eq('id', id).in('status', ['open']).select('*').maybeSingle();
  return { ok: !error && !!data, error: error?.message || (!data ? 'الحادثة ليست مفتوحة' : undefined), row: data as IncidentRow | null };
}
export async function closeIncident(db: any, id: number, status: 'closed' | 'dismissed', actions: string) {
  const { data, error } = await db.from('portal_incidents').update({ status, closed_at: new Date().toISOString(), actions: String(actions || '').slice(0, 2000) || null }).eq('id', id).in('status', ['open', 'reported']).select('*').maybeSingle();
  return { ok: !error && !!data, error: error?.message || (!data ? 'الحادثة مغلقة أصلًا' : undefined), row: data as IncidentRow | null };
}
export async function listIncidents(db: any, limit = 100): Promise<IncidentRow[]> { const { data } = await db.from('portal_incidents').select('*').order('created_at', { ascending: false }).limit(limit); return (data || []) as IncidentRow[]; }
export async function openIncidents(db: any): Promise<IncidentRow[]> { const { data } = await db.from('portal_incidents').select('*').eq('status', 'open').order('deadline_at', { ascending: true }).limit(50); return (data || []) as IncidentRow[]; }

/** مسودة بلاغ سدايا — حقول نموذج الإبلاغ، تُنسخ إلى منصة الهيئة */
export function sdaiaDraft(i: IncidentRow, org: { name: string; contact: string; site: string }) {
  const tables = (i.tables || []).map(t => { const r = byTable(t); return r ? `${r.label_ar} (${t}): ${r.data_ar}` : t; });
  const lines = [
    `بلاغ حادثة بيانات شخصية — ${org.name}`,
    `جهة التحكم: ${org.name} · الموقع: ${org.site} · جهة الاتصال لحماية البيانات: ${org.contact}`,
    `تاريخ العلم بالحادثة: ${i.discovered_at} · مهلة الإبلاغ (72 ساعة): ${i.deadline_at}`,
    `الخطورة: ${i.severity} · رقم الحادثة الداخلي: ${i.id}${i.security_event_id ? ` · حدث درع أَثَر رقم ${i.security_event_id}` : ''}`,
    `وصف الحادثة: ${i.summary}`,
    `فئات البيانات المتأثرة:`, ...(tables.length ? tables.map(t => `  - ${t}`) : ['  - (تُحدَّد)']),
    `العدد التقديري للمتأثرين: ${i.affected_count ?? 'قيد الحصر'}`,
    `الضرر المحتمل: (يُقيَّم: انتحال هوية · تواصل غير مرغوب · كشف نتائج تعلّم …)`,
    `الإجراءات المتخذة: ${i.actions || '(احتواء · تدوير مفاتيح · إيقاف الوصول · تحليل السجلات)'}`,
    `إبلاغ المتأثرين: ${i.affected_notified_at ? `تم في ${i.affected_notified_at}` : 'سيتم عبر القنوات المسجَّلة (بريد/تنبيه) بنصّ يوضح ما حدث وما عليهم فعله'}`,
    `المعالجون المتأثرون: Supabase (قاعدة البيانات) · Vercel (الاستضافة) — حسب نطاق الحادثة`,
  ];
  return lines.join('\n');
}

/** نصّ إشعار المتأثرين — يُرسل عبر notify من غرفة الطلبات */
export function affectedNotice(i: IncidentRow, org: { name: string; contact: string }) {
  return { subject: `إشعار مهم بشأن بياناتك لدى ${org.name}`, text: `نُبلغك بوقوع حادثة قد تكون مسّت بعض بياناتك لدينا (${(i.tables || []).map(t => byTable(t)?.label_ar || t).join('، ') || 'فئات محددة'}). ما حدث: ${i.summary}. ما فعلناه: ${i.actions || 'احتواء الحادثة ومراجعة الوصول'}. ما ننصحك به: احذر رسائل تنتحل اسمنا، ولا تشارك رموز الدخول. للاستفسار: ${org.contact}. هذا الإشعار يصدر وفق نظام حماية البيانات الشخصية.` };
}
