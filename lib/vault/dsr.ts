// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — طلبات الأشخاص (DSR): إنشاء · تمديد (مرة واحدة، 30 يومًا، بسبب مكتوب) · إغلاق · المستحقّة قريبًا · المتأخرة.
 *  النظام: الردّ خلال 30 يومًا من الاستلام، ويجوز التمديد 30 يومًا أخرى مع إشعار الشخص قبل انتهاء المدة الأولى.
 */
import { DSR_DAYS, DSR_EXTENSION_DAYS } from './registry';

export type DsrKind = 'access' | 'correction' | 'erasure' | 'objection' | 'portability';
export type DsrStatus = 'open' | 'extended' | 'done' | 'rejected' | 'cancelled';
export type DsrRow = { id: number; created_at: string; user_id: string | null; email: string; full_name: string | null; kind: DsrKind; status: DsrStatus; due_at: string; extended_at: string | null; extension_reason: string | null; details: any; result: any; handled_by: string | null; closed_at: string | null; reminded_at: string | null };

export const DSR_KIND_AR: Record<DsrKind, string> = { access: 'اطّلاع / نسخة', correction: 'تصحيح', erasure: 'نسيان (إتلاف)', objection: 'اعتراض على معالجة', portability: 'نقل البيانات' };
export const DSR_STATUS_AR: Record<DsrStatus, string> = { open: 'مفتوح', extended: 'مُمدَّد', done: 'نُفِّذ', rejected: 'مرفوض بسبب', cancelled: 'ألغاه صاحبه' };

export const daysLeft = (due: string, now = Date.now()) => Math.ceil((new Date(due).getTime() - now) / 864e5);

/** إنشاء طلب — لا يكرّر طلبًا مفتوحًا من النوع نفسه للبريد نفسه */
export async function createDsr(db: any, p: { user_id: string | null; email: string; full_name?: string | null; kind: DsrKind; details?: any; autoDone?: any }): Promise<{ row: DsrRow | null; duplicate: boolean; error?: string }> {
  const email = p.email.toLowerCase();
  try {
    if (!p.autoDone) {
      const { data: ex } = await db.from('portal_dsr_requests').select('*').ilike('email', email).eq('kind', p.kind).in('status', ['open', 'extended']).limit(1);
      if (ex?.length) return { row: ex[0] as DsrRow, duplicate: true };
    }
    const now = new Date();
    const row: any = { user_id: p.user_id, email, full_name: p.full_name || null, kind: p.kind, status: 'open', details: p.details || {}, due_at: new Date(now.getTime() + DSR_DAYS * 864e5).toISOString() };
    if (p.autoDone) { row.status = 'done'; row.closed_at = now.toISOString(); row.result = p.autoDone; }
    const { data, error } = await db.from('portal_dsr_requests').insert(row).select('*').maybeSingle();
    if (error) return { row: null, duplicate: false, error: error.message };
    return { row: data as DsrRow, duplicate: false };
  } catch (e: any) { return { row: null, duplicate: false, error: e?.message || String(e) }; }
}

export async function extendDsr(db: any, id: number, reason: string, by: string | null): Promise<{ ok: boolean; error?: string; row?: DsrRow }> {
  const { data: cur } = await db.from('portal_dsr_requests').select('*').eq('id', id).maybeSingle();
  if (!cur) return { ok: false, error: 'الطلب غير موجود' };
  if (cur.status !== 'open') return { ok: false, error: 'لا يُمدَّد إلا طلب مفتوح ولم يُمدَّد من قبل' };
  if (!reason || reason.trim().length < 8) return { ok: false, error: 'التمديد يحتاج سببًا مكتوبًا (يُبلَّغ به الشخص)' };
  const due = new Date(new Date(cur.due_at).getTime() + DSR_EXTENSION_DAYS * 864e5).toISOString();
  const { data, error } = await db.from('portal_dsr_requests').update({ status: 'extended', extended_at: new Date().toISOString(), extension_reason: reason.trim().slice(0, 500), due_at: due, handled_by: by }).eq('id', id).select('*').maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as DsrRow };
}

export async function closeDsr(db: any, id: number, status: 'done' | 'rejected', result: any, by: string | null): Promise<{ ok: boolean; error?: string; row?: DsrRow }> {
  if (status === 'rejected' && !(result && String(result.reason || '').trim().length >= 8)) return { ok: false, error: 'الرفض يحتاج سببًا مكتوبًا' };
  const { data, error } = await db.from('portal_dsr_requests').update({ status, result: result || {}, closed_at: new Date().toISOString(), handled_by: by }).eq('id', id).in('status', ['open', 'extended']).select('*').maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'الطلب ليس مفتوحًا' };
  return { ok: true, row: data as DsrRow };
}

export async function cancelDsr(db: any, id: number, email: string) {
  const { data } = await db.from('portal_dsr_requests').update({ status: 'cancelled', closed_at: new Date().toISOString() }).eq('id', id).ilike('email', email).in('status', ['open', 'extended']).select('id').maybeSingle();
  return !!data;
}

export async function openDsrs(db: any, opts: { email?: string; limit?: number } = {}): Promise<DsrRow[]> {
  let q = db.from('portal_dsr_requests').select('*').in('status', ['open', 'extended']).order('due_at', { ascending: true }).limit(opts.limit || 200);
  if (opts.email) q = q.ilike('email', opts.email);
  const { data } = await q; return (data || []) as DsrRow[];
}
export async function allDsrs(db: any, limit = 300): Promise<DsrRow[]> { const { data } = await db.from('portal_dsr_requests').select('*').order('created_at', { ascending: false }).limit(limit); return (data || []) as DsrRow[]; }
export async function dueSoon(db: any, days = 5, now = Date.now()): Promise<DsrRow[]> { const rows = await openDsrs(db); return rows.filter(r => daysLeft(r.due_at, now) <= days); }
export async function overdue(db: any, now = Date.now()): Promise<DsrRow[]> { const rows = await openDsrs(db); return rows.filter(r => daysLeft(r.due_at, now) < 0); }
export function dsrSummary(rows: DsrRow[], now = Date.now()) {
  const open = rows.filter(r => r.status === 'open' || r.status === 'extended');
  return { open: open.length, due_soon: open.filter(r => daysLeft(r.due_at, now) <= 5 && daysLeft(r.due_at, now) >= 0).length, overdue: open.filter(r => daysLeft(r.due_at, now) < 0).length, done_30d: rows.filter(r => r.status === 'done' && r.closed_at && now - new Date(r.closed_at).getTime() < 30 * 864e5).length };
}
