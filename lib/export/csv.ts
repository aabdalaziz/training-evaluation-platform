/**
 * CSV download helper (browser only).
 * Same escaping rules as the existing reports page: UTF-8 BOM for Excel,
 * quotes doubled, phone-like values protected from Excel auto-formatting.
 */
export function csvString(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    if (/^\+?[\d\s\-()]{7,}$/.test(s.trim())) return `="${s.replace(/"/g, '""')}"`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
}

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvString(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(base: string, ext = 'csv'): string {
  const date = new Date().toISOString().slice(0, 10);
  const safe = base.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, '_');
  return `${safe}_${date}.${ext}`;
}
