// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P80 */
/**
 * النسخ الاحتياطي المجدول (P80-ج) — يوميًّا إلى Storage الخاصّ `portal-backups` (الملف: daily/YYYY-MM-DD.json)
 *  • الجداول: CATALOG نفسه الذي تستخدمه شاشة /admin/backup (صيغة JSON المتوافقة مع الاستعادة من الشاشة).
 *  • الاحتفاظ: آخر 14 نسخة يومية + نسخة «أوّل الشهر» تبقى 12 شهرًا.
 *  • آمن للتكرار: تشغيله مرّتين في اليوم نفسه يستبدل الملف لا يضاعفه. يُسجَّل في audit_logs (source backup).
 *  الدوال الخالصة (أسماء الملفّات · ما يُحذف) مفصولة لتُختبر.
 */
import { CATALOG, manifest, jsonPayload, type Dataset } from './model';

export const BUCKET = 'portal-backups';
export const KEEP_DAILY = 14, KEEP_MONTHLY = 12;
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
export const objectName = (d: Date) => `daily/${dayKey(d)}.json`;
export const monthlyName = (d: Date) => `monthly/${dayKey(d).slice(0, 7)}.json`;

/** ما يُحذف من قائمة أسماء (daily/… و monthly/…) بحسب سياسة الاحتفاظ. */
export function pruneList(names: string[], now = new Date()): string[] {
  const out: string[] = []; const t = new Date(dayKey(now) + 'T00:00:00Z').getTime(); // بأيام كاملة لا بالساعات
  for (const n of names) {
    const m = n.match(/^daily\/(\d{4}-\d{2}-\d{2})\.json$/); if (m) { if (Math.round((t - new Date(m[1] + 'T00:00:00Z').getTime()) / 86400e3) > KEEP_DAILY) out.push(n); continue; }
    const mm = n.match(/^monthly\/(\d{4}-\d{2})\.json$/); if (mm) { const d = new Date(mm[1] + '-01T00:00:00Z'); const months = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth()); if (months > KEEP_MONTHLY) out.push(n); }
  }
  return out;
}

export type AutoBackupResult = { ok: boolean; name: string; bytes: number; tables: Record<string, number>; total_rows: number; pruned: string[]; monthly?: string | null; ms: number; error?: string; warnings: string[] };

export async function runAutoBackup(db: any, opts: { now?: Date; dry?: boolean; maxRows?: number } = {}): Promise<AutoBackupResult> {
  const t0 = Date.now(); const now = opts.now || new Date(); const maxRows = opts.maxRows ?? 20000; const warnings: string[] = [];
  const data: Dataset = {} as any;
  for (const spec of CATALOG) {
    try { const q = db.from(spec.table).select('*').limit(maxRows); const { data: rows, error } = spec.order ? await q.order(spec.order) : await q; if (error) { warnings.push(`${spec.table}: ${error.message}`); (data as any)[spec.table] = []; continue; } (data as any)[spec.table] = rows || []; if ((rows || []).length >= maxRows) warnings.push(`${spec.table}: بلغ السقف ${maxRows} صفًّا`); }
    catch (e: any) { warnings.push(`${spec.table}: ${e?.message || e}`); (data as any)[spec.table] = []; }
  }
  const m = manifest(data, 'all', 'نسخة يومية تلقائية', now); const body = jsonPayload(data, m); const bytes = Buffer.byteLength(body, 'utf8'); const name = objectName(now);
  const base: AutoBackupResult = { ok: true, name, bytes, tables: m.tables, total_rows: m.total_rows, pruned: [], monthly: null, ms: 0, warnings };
  if (opts.dry) return { ...base, ms: Date.now() - t0 };
  const up = await db.storage.from(BUCKET).upload(name, Buffer.from(body, 'utf8'), { contentType: 'application/json', upsert: true });
  if (up.error) return { ...base, ok: false, error: `storage: ${up.error.message}`, ms: Date.now() - t0 };
  if (now.getUTCDate() === 1) { const mn = monthlyName(now); const r = await db.storage.from(BUCKET).upload(mn, Buffer.from(body, 'utf8'), { contentType: 'application/json', upsert: true }); base.monthly = r.error ? null : mn; }
  const names: string[] = [];
  for (const folder of ['daily', 'monthly']) { const { data: list } = await db.storage.from(BUCKET).list(folder, { limit: 1000 }); for (const f of (list || []) as any[]) if (f?.name) names.push(`${folder}/${f.name}`); }
  const pruned = pruneList(names, now); if (pruned.length) { const { error } = await db.storage.from(BUCKET).remove(pruned); if (error) warnings.push(`prune: ${error.message}`); }
  try { await db.from('audit_logs').insert({ actor_id: null, action: 'backup_auto', entity_type: 'backup', entity_id: name, source: 'backup', metadata: { bytes, total_rows: m.total_rows, tables: m.tables, pruned, monthly: base.monthly, warnings } }); } catch { /* ثانوي */ }
  return { ...base, pruned, ms: Date.now() - t0 };
}
