/**
 * قارئ ملفات Word/Excel بدون أي مكتبات (متصفح فقط):
 *   .docx → فقرات نصية   |   .xlsx → صفوف الورقة الأولى
 * يعتمد على DecompressionStream('deflate-raw') المتاح في المتصفحات الحديثة.
 */

import { parseCsv } from './import';

type ZipEntry = { name: string; method: number; compSize: number; size: number; offset: number };

function readZipEntries(buf: ArrayBuffer): ZipEntry[] {
  const dv = new DataView(buf); const u8 = new Uint8Array(buf);
  // End of central directory
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('ليس ملف ZIP/Office صالحًا');
  const count = dv.getUint16(eocd + 10, true); const cdOff = dv.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = []; let p = cdOff;
  const td = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nLen));
    entries.push({ name, method, compSize, size, offset }); p += 46 + nLen + xLen + cLen;
  }
  return entries;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error('المتصفح لا يدعم فك الضغط — استخدم Chrome/Edge/Safari حديثًا أو ارفع CSV/نصًا');
  const copy = new Uint8Array(data.byteLength); copy.set(data);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DS('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const dv = new DataView(buf); const u8 = new Uint8Array(buf);
  if (dv.getUint32(e.offset, true) !== 0x04034b50) throw new Error('بنية ZIP غير متوقعة');
  const nLen = dv.getUint16(e.offset + 26, true), xLen = dv.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nLen + xLen;
  const raw = u8.subarray(start, start + e.compSize);
  const out = e.method === 0 ? raw : e.method === 8 ? await inflate(raw) : null;
  if (!out) throw new Error('طريقة ضغط غير مدعومة');
  return new TextDecoder('utf-8').decode(out);
}

const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, '&');

/** .docx → سطور (فقرة لكل سطر؛ خلايا الجداول تُفصل بـ tab) */
export async function docxToLines(buf: ArrayBuffer): Promise<string[]> {
  const entries = readZipEntries(buf);
  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('الملف ليس مستند Word (.docx)');
  const xml = await readEntry(buf, doc);
  const lines: string[] = [];
  // الجداول: كل صف سطر واحد بخلايا مفصولة بـ tab
  const body = xml.replace(/<w:tr[ >][\s\S]*?<\/w:tr>/g, tr => {
    const cells = Array.from(tr.matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)).map(m => paraText(m[0]).join(' '));
    return `<w:p><w:t>${cells.map(c => c.replace(/</g, '&lt;')).join('\t')}</w:t></w:p>`;
  });
  for (const t of paraText(body)) lines.push(t);
  return lines.filter(l => l.trim());
}
function paraText(xml: string): string[] {
  return Array.from(xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g)).map(m => {
    const p = m[0];
    const parts = Array.from(p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)).map(x => x[0].startsWith('<w:tab') ? '\t' : x[0].startsWith('<w:br') ? ' ' : unesc(x[1]));
    // ترقيم تلقائي من Word: نستنتج وجود قائمة مرقّمة
    const numbered = /<w:numPr>/.test(p) && /<w:numId w:val="(\d+)"/.test(p);
    const text = parts.join('').trim();
    return numbered && text && !/^\d+[).\-]/.test(text) && !/^[أابجد][).\-]/.test(text) ? `• ${text}` : text;
  });
}

/** .xlsx → صفوف الورقة الأولى (نصوص) */
export async function xlsxToRows(buf: ArrayBuffer): Promise<string[][]> {
  const entries = readZipEntries(buf);
  const ss = entries.find(e => e.name === 'xl/sharedStrings.xml');
  const shared: string[] = [];
  if (ss) { const xml = await readEntry(buf, ss); for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(Array.from(m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map(x => unesc(x[1])).join('')); }
  // الورقة الأولى حسب workbook.xml ثم rels؛ وإلا sheet1
  let sheetName = 'xl/worksheets/sheet1.xml';
  const wb = entries.find(e => e.name === 'xl/workbook.xml'); const rels = entries.find(e => e.name === 'xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const wx = await readEntry(buf, wb); const rx = await readEntry(buf, rels);
    const first = wx.match(/<sheet\b[^>]*r:id="([^"]+)"/); const rid = first?.[1];
    const target = rid ? rx.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] || rx.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : null;
    if (target) sheetName = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }
  const sh = entries.find(e => e.name === sheetName) || entries.find(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  if (!sh) throw new Error('الملف ليس مصنف Excel (.xlsx)');
  const xml = await readEntry(buf, sh);
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const attrs = cm[1] || cm[3] || ''; const inner = cm[2] || '';
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1] || ''; const col = colIndex(ref);
      const type = attrs.match(/t="(\w+)"/)?.[1];
      let v = '';
      if (type === 's') { const i = Number(inner.match(/<v>(.*?)<\/v>/)?.[1] || -1); v = shared[i] || ''; }
      else if (type === 'inlineStr') v = Array.from(inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map(x => unesc(x[1])).join('');
      else v = unesc(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] || '');
      while (row.length < col) row.push('');
      row[col] = v;
    }
    rows.push(row);
  }
  return rows.filter(r => r.some(x => x && x.trim()));
}
function colIndex(ref: string): number { let n = 0; for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64); return Math.max(0, n - 1); }

/** قراءة ملف من input[type=file] → نص أو صفوف */
export async function readInstrumentFile(file: File): Promise<{ kind: 'text'; text: string } | { kind: 'rows'; rows: string[][] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return { kind: 'text', text: (await docxToLines(await file.arrayBuffer())).join('\n') };
  if (name.endsWith('.xlsx')) return { kind: 'rows', rows: await xlsxToRows(await file.arrayBuffer()) };
  if (name.endsWith('.doc') || name.endsWith('.xls') || name.endsWith('.pdf')) throw new Error('الصيغ القديمة (.doc/.xls) وملفات PDF غير مدعومة — احفظ الملف بصيغة .docx أو .xlsx أو انسخ النص والصقه.');
  const text = await file.text();
  if (name.endsWith('.csv') || name.endsWith('.tsv')) return { kind: 'rows', rows: parseCsv(text) };
  return { kind: 'text', text };
}
