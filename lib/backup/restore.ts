// الاستعادة من نسخة JSON — دوال نقية (التحقق، الخطة، التجزئة، التلخيص)
import { CATALOG } from './model';
import type { Dataset, Manifest, TableSpec, Row } from './model';

export type ParsedBackup = { manifest: Manifest | null; data: Dataset; tables: { table: string; label: string; rows: number; known: boolean }[]; warnings: string[] };
export type Strategy = 'add' | 'replace';
export type TableResult = { table: string; label: string; total: number; existing: number; inserted: number; updated: number; skipped: number; failed: number; error?: string };

export const BATCH = 400;
export const MAX_BYTES = 60 * 1024 * 1024;

export function specOf(table: string): TableSpec | undefined { return CATALOG.find(t => t.table === table); }
export function conflictKey(table: string): string { return specOf(table)?.conflict || 'id'; }

/** تحليل نص JSON والتحقق من بنيته {manifest, data} (أو {table: rows[]} مباشرة) */
export function parseBackup(text: string): ParsedBackup {
  const warnings: string[] = [];
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error('الملف ليس JSON صالحًا'); }
  const data: Dataset = j && typeof j === 'object' && j.data && typeof j.data === 'object' ? j.data : j;
  const manifest: Manifest | null = j?.manifest && typeof j.manifest === 'object' ? j.manifest : null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('بنية الملف غير معروفة — المتوقع {manifest, data}');
  const tables: ParsedBackup['tables'] = [];
  for (const [table, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) { warnings.push(`«${table}» ليس قائمة صفوف — تم تجاهله`); delete (data as any)[table]; continue; }
    const spec = specOf(table);
    if (!spec) { warnings.push(`جدول غير معروف للمنصة: ${table} (${rows.length} صفًا) — لن يُستعاد`); continue; }
    const key = conflictKey(table).split(',');
    const badRows = rows.filter(r => !r || typeof r !== 'object' || key.some(k => r[k] === undefined || r[k] === null)).length;
    if (badRows) warnings.push(`«${spec.label}»: ${badRows} صفًا بلا مفتاح (${key.join(',')}) — ستُتجاهل`);
    tables.push({ table, label: spec.label, rows: rows.length, known: true });
  }
  if (!tables.length) throw new Error('لا يحوي الملف أي جدول معروف');
  if (manifest?.app && manifest.app !== 'training-evaluation-platform') warnings.push(`الملف من تطبيق آخر: ${manifest.app}`);
  // ترتيب حسب الكتالوج (ترتيب الاعتماديات)
  tables.sort((a, b) => CATALOG.findIndex(t => t.table === a.table) - CATALOG.findIndex(t => t.table === b.table));
  return { manifest, data, tables, warnings };
}

/** خطة التنفيذ: الجداول المختارة مرتبة حسب الاعتماديات، مع صفوفها الصالحة فقط */
export function restorePlan(parsed: ParsedBackup, selected: string[]): { table: string; label: string; rows: Row[] }[] {
  const sel = new Set(selected);
  return parsed.tables.filter(t => sel.has(t.table)).map(t => {
    const key = conflictKey(t.table).split(',');
    const rows = (parsed.data[t.table] || []).filter(r => r && typeof r === 'object' && key.every(k => r[k] !== undefined && r[k] !== null));
    return { table: t.table, label: t.label, rows };
  }).filter(t => t.rows.length);
}

export function chunk<T>(arr: T[], size = BATCH): T[][] {
  const out: T[][] = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out;
}

/** مفتاح مركّب لصف (للمقارنة بين النسخة وقاعدة البيانات) */
export function rowKey(row: Row, conflict: string): string { return conflict.split(',').map(k => String(row[k])).join('|'); }

export function emptyResult(table: string, label: string, total: number): TableResult {
  return { table, label, total, existing: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
}

export function summarize(results: TableResult[]): { tables: number; total: number; inserted: number; updated: number; skipped: number; failed: number } {
  return results.reduce((s, r) => ({ tables: s.tables + 1, total: s.total + r.total, inserted: s.inserted + r.inserted, updated: s.updated + r.updated, skipped: s.skipped + r.skipped, failed: s.failed + r.failed }), { tables: 0, total: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 });
}

export function strategyLabel(s: Strategy): string { return s === 'add' ? 'إضافة الناقص فقط (الصفوف الموجودة لا تُمس)' : 'استبدال المطابق (تحديث الصفوف الموجودة بقيم النسخة)'; }
