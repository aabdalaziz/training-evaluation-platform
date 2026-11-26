// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 */
/**
 * كاتب Word (.docx) بسيط بصيغة Office Open XML بلا تبعيّات — عربي RTL بالهوية: عناوين · فقرات · قوائم · جداول · صور PNG · ترويسة/تذييل.
 *  buildDocx(blocks, opts) → Uint8Array   ·   downloadDocx(name, blocks, opts)
 *  يعيد استخدام كاتب الـzip من مصدّر Excel. الصور تُمرَّر PNG جاهزة (من svgToPng).
 */
import { zipStored, xmlEscape } from './xlsx';

export type DocBlock =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string; bold?: boolean; color?: string; size?: number; align?: 'right' | 'center' | 'left' }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; head: string[]; rows: (string | number)[][]; widths?: number[] }
  | { type: 'image'; png: Uint8Array; w: number; h: number; caption?: string }
  | { type: 'kpis'; items: { label: string; value: string; sub?: string }[] }
  | { type: 'callout'; title: string; text: string; color?: string }
  | { type: 'pagebreak' };
export type DocOptions = { title: string; subtitle?: string; header?: string; footer?: string; font?: string; accent?: string; dark?: string; rtl?: boolean; logoPng?: Uint8Array | null };

const enc = new TextEncoder();
const EMU = 9525; /* EMU لكلّ بكسل عند 96dpi */
const hex = (c: string | undefined, d: string) => (c || d).replace('#', '').toUpperCase();

export function buildDocx(blocks: DocBlock[], opts: DocOptions): Uint8Array {
  const rtl = opts.rtl !== false; const font = opts.font || 'Tahoma'; const accent = hex(opts.accent, 'D4614A'); const dark = hex(opts.dark, '22101F'); const plum = '3A1F36'; const gold = 'D9A866'; const ivory = 'F6EBE0';
  const media: { name: string; data: Uint8Array }[] = []; const rels: string[] = [];
  const addImage = (png: Uint8Array) => { const id = `rId${100 + media.length}`; const name = `image${media.length + 1}.png`; media.push({ name, data: png }); rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`); return id; };
  const bidi = rtl ? '<w:bidi/>' : ''; const jc = (a?: string) => `<w:jc w:val="${a === 'center' ? 'center' : a === 'left' ? (rtl ? 'end' : 'start') : rtl ? 'start' : 'end'}"/>`;
  const rpr = (o: { bold?: boolean; color?: string; size?: number; italic?: boolean } = {}) => `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>${o.bold ? '<w:b/><w:bCs/>' : ''}${o.italic ? '<w:i/><w:iCs/>' : ''}${o.color ? `<w:color w:val="${hex(o.color, dark)}"/>` : ''}<w:sz w:val="${(o.size || 11) * 2}"/><w:szCs w:val="${(o.size || 11) * 2}"/>${rtl ? '<w:rtl/>' : ''}</w:rPr>`;
  const run = (t: string, o?: Parameters<typeof rpr>[0]) => `<w:r>${rpr(o)}<w:t xml:space="preserve">${xmlEscape(String(t))}</w:t></w:r>`;
  const para = (inner: string, ppr = '') => `<w:p><w:pPr>${bidi}${ppr}</w:pPr>${inner}</w:p>`;
  const heading = (t: string, lvl: 1 | 2 | 3) => para(run(t, { bold: true, color: lvl === 1 ? dark : plum, size: lvl === 1 ? 20 : lvl === 2 ? 15 : 12.5 }), `<w:pStyle w:val="Heading${lvl}"/><w:keepNext/><w:spacing w:before="${lvl === 1 ? 360 : 240}" w:after="120"/>${jc()}${lvl === 2 ? `<w:pBdr><w:${rtl ? 'right' : 'left'} w:val="single" w:sz="18" w:space="6" w:color="${gold}"/></w:pBdr>` : ''}`);
  const cell = (t: string | number, o: { fill?: string; bold?: boolean; color?: string; w?: number } = {}) => `<w:tc><w:tcPr>${o.w ? `<w:tcW w:w="${o.w}" w:type="dxa"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:start w:w="90" w:type="dxa"/><w:end w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>${para(run(String(t ?? ''), { bold: o.bold, color: o.color, size: 9.5 }), jc())}</w:tc>`;
  const tblPr = (borders = true) => `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>${rtl ? '<w:bidiVisual/>' : ''}<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="${borders ? 'single' : 'nil'}" w:sz="4" w:space="0" w:color="EADFD6"/>`).join('')}</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr>`;
  const body: string[] = [];
  /* صفحة الغلاف */
  body.push(para(run(opts.header || 'بوّابة أَثَر للتعليم والتدريب والتطوير والجودة', { color: accent, bold: true, size: 10 }), `<w:spacing w:before="1800" w:after="120"/>${jc()}`));
  body.push(para(run(opts.title, { bold: true, color: dark, size: 30 }), `<w:spacing w:after="160"/>${jc()}`));
  if (opts.subtitle) body.push(para(run(opts.subtitle, { color: plum, size: 13 }), `<w:spacing w:after="240"/>${jc()}`));
  body.push(para('', `<w:pBdr><w:bottom w:val="single" w:sz="24" w:space="1" w:color="${dark}"/></w:pBdr>`));
  for (const b of blocks) {
    if (b.type === 'h1') body.push(heading(b.text, 1)); else if (b.type === 'h2') body.push(heading(b.text, 2)); else if (b.type === 'h3') body.push(heading(b.text, 3));
    else if (b.type === 'p') body.push(para(run(b.text, { bold: b.bold, color: b.color, size: b.size || 11 }), `<w:spacing w:after="120" w:line="330" w:lineRule="auto"/>${jc(b.align)}`));
    else if (b.type === 'bullets' || b.type === 'numbered') b.items.forEach((it, i) => body.push(para(run(`${b.type === 'numbered' ? `${i + 1}. ` : '• '}${it}`, { size: 11 }), `<w:spacing w:after="60" w:line="320" w:lineRule="auto"/><w:ind w:${rtl ? 'start' : 'left'}="360" w:hanging="240"/>${jc()}`)));
    else if (b.type === 'table') { const rows = [`<w:tr><w:trPr><w:tblHeader/></w:trPr>${b.head.map((h, i) => cell(h, { fill: plum, bold: true, color: 'FFFFFF', w: b.widths?.[i] })).join('')}</w:tr>`, ...b.rows.map((r, k) => `<w:tr>${r.map((c, i) => cell(c, { fill: k % 2 ? 'FBF4EE' : undefined, w: b.widths?.[i] })).join('')}</w:tr>`)]; body.push(`<w:tbl>${tblPr()}<w:tblGrid>${b.head.map(() => '<w:gridCol/>').join('')}</w:tblGrid>${rows.join('')}</w:tbl>`, para('', '<w:spacing w:after="120"/>')); }
    else if (b.type === 'image') { const id = addImage(b.png); const maxW = 9000000; const scale = Math.min(1, maxW / (b.w * EMU)); const cx = Math.round(b.w * EMU * scale), cy = Math.round(b.h * EMU * scale); const n = media.length;
      body.push(para(`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="chart${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="chart${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`, `<w:keepNext/><w:spacing w:before="120" w:after="60"/>${jc('center')}`));
      if (b.caption) body.push(para(run(b.caption, { color: '8A7580', size: 9, italic: true }), `<w:spacing w:after="160"/>${jc('center')}`)); }
    else if (b.type === 'kpis') body.push(`<w:tbl>${tblPr(false)}<w:tblGrid>${b.items.map(() => '<w:gridCol/>').join('')}</w:tblGrid><w:tr>${b.items.map((k) => `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${ivory}"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${para(run(k.label, { size: 9, color: '5C4858', bold: true }), jc())}${para(run(k.value, { size: 20, bold: true, color: dark }), jc())}${k.sub ? para(run(k.sub, { size: 8.5, color: '5C4858' }), jc()) : ''}</w:tc>`).join('')}</w:tr></w:tbl>`, para('', '<w:spacing w:after="120"/>'));
    else if (b.type === 'callout') body.push(`<w:tbl>${tblPr(false)}<w:tblGrid><w:gridCol/></w:tblGrid><w:tr><w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${hex(b.color, 'FBF4EE')}"/><w:tcBorders><w:${rtl ? 'right' : 'left'} w:val="single" w:sz="24" w:space="0" w:color="${accent}"/></w:tcBorders><w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:start w:w="160" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${para(run(b.title, { bold: true, size: 10.5, color: plum }), jc())}${para(run(b.text, { size: 10 }), `<w:spacing w:line="320" w:lineRule="auto"/>${jc()}`)}</w:tc></w:tr></w:tbl>`, para('', '<w:spacing w:after="100"/>'));
    else if (b.type === 'pagebreak') body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
  }
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1100" w:bottom="1100" w:left="1100" w:header="500" w:footer="500" w:gutter="0"/>${rtl ? '<w:bidi/>' : ''}</w:sectPr>`;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body.join('')}${sect}</w:body></w:document>`;
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${para(run(opts.header || opts.title, { size: 8.5, color: '8A7580' }), `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${gold}"/></w:pBdr>${jc()}`)}</w:hdr>`;
  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${para(run(opts.footer || 'athar-portal.com · «نبني القدرة ونُثبت الأثر» · صفحة ', { size: 8.5, color: '8A7580' }) + `<w:r>${rpr({ size: 8.5, color: '8A7580' })}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rpr({ size: 8.5 })}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r>${rpr({ size: 8.5 })}<w:fldChar w:fldCharType="end"/></w:r>`, jc('center'))}</w:ftr>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>${bidi}<w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[1, 2, 3].map((l) => `<w:style w:type="paragraph" w:styleId="Heading${l}"><w:name w:val="heading ${l}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="${l - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:style>`).join('')}</w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${rels.join('')}</Relationships>`;
  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(opts.title)}</dc:title><dc:creator>بوّابة أَثَر</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Athar Portal</Application></Properties>`;
  return zipStored([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) }, { name: '_rels/.rels', data: enc.encode(rootRels) }, { name: 'word/document.xml', data: enc.encode(document) }, { name: 'word/styles.xml', data: enc.encode(styles) },
    { name: 'word/header1.xml', data: enc.encode(header) }, { name: 'word/footer1.xml', data: enc.encode(footer) }, { name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) }, { name: 'docProps/core.xml', data: enc.encode(core) }, { name: 'docProps/app.xml', data: enc.encode(app) },
    ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.data })),
  ]);
}
export function downloadDocx(filename: string, blocks: DocBlock[], opts: DocOptions): void {
  const bytes = buildDocx(blocks, opts); const ab = new ArrayBuffer(bytes.byteLength); new Uint8Array(ab).set(bytes);
  const url = URL.createObjectURL(new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
