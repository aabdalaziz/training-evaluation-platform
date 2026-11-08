// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — خروج الجهة بأمر واحد (P65): تصدير موقَّع ATH-EX · محو مؤجَّل 7 أيام بإيصال موقَّع ATH-ER
 *  المبدأ: لا قائمة جداول مكتوبة يدويًا تشيخ — البصمة والتصدير والمحو تتبع المفاتيح الأجنبية إلى portal_organizations في كتالوج القاعدة نفسه
 *  (RPC: vault_org_footprint / vault_org_export / vault_org_erase في supabase/p65-shield-layer2.sql):
 *    on delete cascade → تُحذف صفوف الجهة · on delete set null → يُفكّ ربط الشخص بالجهة ويبقى حسابه وأثره له · restrict → تُحذف صراحةً.
 *  الإيصال لا يكشف محتوى: بصمة الجهة · الجداول وأعدادها · التواريخ · التوقيع. يُتحقّق منه في /verify/erasure.
 */
import { randomBytes } from 'crypto';
import { signReceipt, sha256 } from './subject';
import { byTable } from './registry';
import { securityEvent } from '../shield/guard';

export const ORG_ERASE_HOLD_DAYS = 7;
export const EXPORT_PREFIX = 'ATH-EX'; export const ERASE_PREFIX = 'ATH-ER';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function orgCode(prefix: string, rand: (n: number) => Buffer = randomBytes): string { const b = rand(8); let s = ''; for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length]; return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`; }
export const isEraseCode = (c: string) => /^ATH-ER-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(c || '').trim().toUpperCase());

export type FootRow = { table: string; column: string; rows: number; on_delete: 'cascade' | 'set_null' | 'set_default' | 'restrict'; label_ar: string; effect_ar: string };
export const EFFECT_AR: Record<string, string> = { cascade: 'يُحذف', set_null: 'يُفكّ الربط (يبقى للشخص)', set_default: 'يُعاد إلى الافتراضي', restrict: 'يُحذف صراحةً' };

/** تحويل خرج RPC البصمة {"table.col": {rows, on_delete}} إلى صفوف مقروءة (نقي) */
export function footprintRows(fp: Record<string, { rows: number; on_delete: string }> | null | undefined): FootRow[] {
  return Object.entries(fp || {}).map(([k, v]) => { const i = k.indexOf('.'); const table = i > 0 ? k.slice(0, i) : k; const column = i > 0 ? k.slice(i + 1) : ''; const od = (v?.on_delete || 'restrict') as FootRow['on_delete'];
    return { table, column, rows: Number(v?.rows || 0), on_delete: od, label_ar: byTable(table)?.label_ar || table, effect_ar: EFFECT_AR[od] || od }; }).sort((a, b) => b.rows - a.rows);
}
export function footprintSummaryAr(rows: FootRow[]): string {
  const del = rows.filter(r => r.on_delete === 'cascade' || r.on_delete === 'restrict').reduce((s, r) => s + r.rows, 0);
  const unlink = rows.filter(r => r.on_delete === 'set_null' || r.on_delete === 'set_default').reduce((s, r) => s + r.rows, 0);
  if (!rows.length) return 'لا صفوف مرتبطة بهذه الجهة — سيُحذف سجلّ الجهة فقط.';
  return `سيُحذف ${del} صفًّا في ${rows.filter(r => r.on_delete !== 'set_null' && r.on_delete !== 'set_default').length} جدولًا، ويُفكّ ربط ${unlink} صفًّا (حسابات الأشخاص وأثرهم يبقى لهم) في ${rows.filter(r => r.on_delete === 'set_null' || r.on_delete === 'set_default').length} جدولًا.`;
}

export async function orgFootprint(db: any, orgId: string): Promise<{ ok: boolean; rows: FootRow[]; error?: string }> {
  const { data, error } = await db.rpc('vault_org_footprint', { p_org: orgId });
  if (error) return { ok: false, rows: [], error: /function|does not exist/i.test(error.message) ? 'نفّذ supabase/p65-shield-layer2.sql أولًا' : error.message };
  return { ok: true, rows: footprintRows(data as any) };
}

/** تصدير الجهة: وثيقة موقَّعة تضمّ البيانات (بلا أعمدة أسرار؛ الأصوات تُسرد مساراتها فقط لأنها ملفات لا صفوف) */
export async function exportOrg(db: any, org: { id: string; name_ar: string }, by: { id: string; email: string }, env: Record<string, string | undefined> = process.env, site = '') {
  const { data, error } = await db.rpc('vault_org_export', { p_org: org.id, p_limit: 2000 });
  if (error) return { ok: false as const, error: /function|does not exist/i.test(error.message) ? 'نفّذ supabase/p65-shield-layer2.sql أولًا' : error.message };
  const tables = (data || {}) as Record<string, any[]>; const counts: Record<string, number> = {}; for (const [t, rows] of Object.entries(tables)) counts[t] = Array.isArray(rows) ? rows.length : 0;
  const code = orgCode(EXPORT_PREFIX);
  const doc = await signReceipt({ type: 'AtharOrgExport', kind: 'org_export', code, organization: { id: org.id, name_ar: org.name_ar }, exported_by_role: 'staff', tables: counts, truncated_at: 2000, note_ar: 'ملف تصدير الجهة من بوابة أَثَر — الأعمدة السرّية (رموز/بصمات/كلمات مرور) محذوفة؛ الوسائط الصوتية ليست صفوفًا فلا تُضمَّن.', data: tables }, env, site);
  await securityEvent(db, { severity: 'warn', kind: 'org_export', actor: by.email, user_id: by.id, meta: { code, org_id: org.id, org_name: org.name_ar, tables: counts, hash: (doc as any).hash } }, env);
  return { ok: true as const, code, doc, counts };
}

export async function requestOrgErase(db: any, org: { id: string; name_ar: string }, by: { id: string; email: string }, reason: string, env: Record<string, string | undefined> = process.env, now = new Date()) {
  const erase_at = new Date(now.getTime() + ORG_ERASE_HOLD_DAYS * 86400000).toISOString();
  const { error } = await db.from('portal_organizations').update({ erase_at, erase_requested_by: by.id, erase_reason: String(reason || '').slice(0, 300) || null }).eq('id', org.id);
  if (error) return { ok: false as const, error: error.message };
  await securityEvent(db, { severity: 'warn', kind: 'org_erase_requested', actor: by.email, user_id: by.id, meta: { org_id: org.id, org_name: org.name_ar, erase_at, reason: String(reason || '').slice(0, 300) } }, env);
  return { ok: true as const, erase_at };
}
export async function cancelOrgErase(db: any, org: { id: string; name_ar: string }, by: { id: string; email: string }, env: Record<string, string | undefined> = process.env) {
  const { error } = await db.from('portal_organizations').update({ erase_at: null, erase_requested_by: null, erase_reason: null }).eq('id', org.id);
  if (error) return { ok: false as const, error: error.message };
  await securityEvent(db, { severity: 'info', kind: 'org_erase_cancelled', actor: by.email, user_id: by.id, meta: { org_id: org.id, org_name: org.name_ar } }, env);
  return { ok: true as const };
}
export async function dueOrgErasures(db: any, now = new Date()) {
  const { data } = await db.from('portal_organizations').select('id,name_ar,erase_at,erase_reason,erase_requested_by').not('erase_at', 'is', null).lte('erase_at', now.toISOString()).limit(10);
  return (data || []) as { id: string; name_ar: string; erase_at: string; erase_reason: string | null; erase_requested_by: string | null }[];
}

/** التنفيذ: RPC واحدة تحترم المخطط + إيصال موقَّع يُحفظ حدثًا (warn لا يُكنس) ويُتحقّق منه بالرمز */
export async function executeOrgErase(db: any, org: { id: string; name_ar: string; erase_at?: string | null; erase_reason?: string | null }, actor = 'cron', env: Record<string, string | undefined> = process.env, site = '') {
  const { data, error } = await db.rpc('vault_org_erase', { p_org: org.id });
  if (error) return { ok: false as const, error: error.message };
  const rows = footprintRows((data as any)?.footprint); const code = orgCode(ERASE_PREFIX); const at = new Date().toISOString();
  const receipt = await signReceipt({ type: 'AtharVaultReceipt', kind: 'org_erasure', code, org_hash: 'sha256:' + sha256(org.id).slice(0, 32), name_hash: 'sha256:' + sha256(String(org.name_ar || '').trim()).slice(0, 32), requested_at: org.erase_at ? new Date(new Date(org.erase_at).getTime() - ORG_ERASE_HOLD_DAYS * 86400000).toISOString() : null, executed_at: at, hold_days: ORG_ERASE_HOLD_DAYS, tables: rows.map(r => ({ table: r.table, rows: r.rows, effect: r.on_delete })), summary_ar: footprintSummaryAr(rows), org_deleted: !!(data as any)?.org_deleted }, env, site);
  await securityEvent(db, { severity: 'warn', kind: 'org_erased', actor, meta: { code, receipt, org_name_hash: (receipt as any).name_hash } }, env);
  return { ok: true as const, code, receipt, rows };
}

export async function findEraseReceipt(db: any, code: string): Promise<{ valid: boolean; receipt?: any; intact?: boolean }> {
  const c = String(code || '').trim().toUpperCase(); if (!isEraseCode(c)) return { valid: false };
  const { data } = await db.from('portal_security_events').select('at,meta').eq('kind', 'org_erased').order('at', { ascending: false }).limit(200);
  const hit = ((data || []) as any[]).find(e => e.meta?.code === c); if (!hit) return { valid: false };
  const r = hit.meta.receipt || {}; const { proof: _p, hash, ...base } = r; void _p;
  const pub = { code: r.code, kind: r.kind, executed_at: r.executed_at, requested_at: r.requested_at, hold_days: r.hold_days, tables: r.tables, summary_ar: r.summary_ar, org_deleted: r.org_deleted, issuer: r.issuer, hash, signed: !!r.proof };
  return { valid: true, receipt: pub, intact: typeof hash === 'string' && hash.length > 10 && !!base };
}
