/**
 * Minimal PPTX writer (Office Open XML) — no dependencies.
 * Produces a 16:9 deck with title + bullets and/or a simple table per slide.
 * Reuses the stored-zip writer from the Excel exporter.
 */
import { zipStored, xmlEscape } from './xlsx';

export type PptSlide = {
  title: string;
  subtitle?: string;
  bullets?: string[];
  table?: (string | number)[][]; // first row = header
  note?: string;
};
export type PptOptions = { rtl?: boolean; footer?: string; accent?: string; navy?: string; font?: string };

const W = 12192000, H = 6858000; // EMU, 16:9
const enc = new TextEncoder();

export function buildPptx(slides: PptSlide[], opts: PptOptions = {}): Uint8Array {
  const rtl = opts.rtl !== false;
  const navy = (opts.navy || '0F2A4E').replace('#', '');
  const accent = (opts.accent || '078981').replace('#', '');
  const font = opts.font || 'Tajawal';
  const footer = opts.footer || '';
  const n = Math.max(1, slides.length);

  const files: { name: string; data: Uint8Array }[] = [];
  const add = (name: string, xml: string) => files.push({ name, data: enc.encode(xml) });

  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${Array.from({ length: n }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEscape(slides[0]?.title || 'Report')}</dc:title><dc:creator>Training Evaluation Platform</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`);
  add('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Training Evaluation Platform</Application><Slides>${n}</Slides></Properties>`);

  add('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"${rtl ? ' rtl="1"' : ''} saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${Array.from({ length: n }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst>
<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/>
<p:defaultTextStyle><a:defPPr><a:defRPr lang="ar-SA"/></a:defPPr></p:defaultTextStyle>
</p:presentation>`);

  add('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
${Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('\n')}
</Relationships>`);

  add('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200" b="1"><a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr></p:otherStyle></p:txStyles>
</p:sldMaster>`);
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`);

  add('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`);
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);

  add('ppt/theme/theme1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Platform">
<a:themeElements>
<a:clrScheme name="Platform"><a:dk1><a:srgbClr val="0F172A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${navy}"/></a:dk2><a:lt2><a:srgbClr val="F1F5F9"/></a:lt2><a:accent1><a:srgbClr val="${accent}"/></a:accent1><a:accent2><a:srgbClr val="${navy}"/></a:accent2><a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="DC2626"/></a:accent4><a:accent5><a:srgbClr val="059669"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6><a:hlink><a:srgbClr val="${accent}"/></a:hlink><a:folHlink><a:srgbClr val="64748B"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Platform"><a:majorFont><a:latin typeface="${font}"/><a:ea typeface=""/><a:cs typeface="${font}"/></a:majorFont><a:minorFont><a:latin typeface="${font}"/><a:ea typeface=""/><a:cs typeface="${font}"/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Platform"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/>
</a:theme>`);

  slides.forEach((s, i) => {
    add(`ppt/slides/slide${i + 1}.xml`, slideXml(s, i, n, { rtl, navy, accent, font, footer }));
    add(`ppt/slides/_rels/slide${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  });

  return zipStored(files);
}

/* ------------------------------------------------------------------ slide */
function slideXml(s: PptSlide, idx: number, total: number, o: { rtl: boolean; navy: string; accent: string; font: string; footer: string }): string {
  const algn = o.rtl ? 'r' : 'l';
  const rtlAttr = o.rtl ? ' rtl="1"' : '';
  const run = (t: string, sz: number, color: string, b = false) => `<a:r><a:rPr lang="ar-SA" sz="${sz}"${b ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${o.font}"/><a:cs typeface="${o.font}"/></a:rPr><a:t>${xmlEscape(t)}</a:t></a:r>`;
  const para = (t: string, sz: number, color: string, b = false, bullet = false) => `<a:p><a:pPr algn="${algn}"${rtlAttr}${bullet ? ' marL="342900" indent="-342900"' : ''}>${bullet ? `<a:buClr><a:srgbClr val="${o.accent}"/></a:buClr><a:buChar char="•"/>` : '<a:buNone/>'}</a:pPr>${run(t, sz, color, b)}</a:p>`;
  const box = (id: number, name: string, x: number, y: number, cx: number, cy: number, body: string, fill?: string) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}</p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="${o.rtl ? 1 : 0}" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`;

  const M = 457200; // 0.5in margin
  const parts: string[] = [];
  let id = 2;
  const cover = idx === 0;

  // accent band (top) + footer line
  parts.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Band"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${cover ? H : 182880}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${o.navy}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`);

  if (cover) {
    parts.push(box(id++, 'Title', M, 2200000, W - 2 * M, 1400000, para(s.title, 4000, 'FFFFFF', true)));
    if (s.subtitle) parts.push(box(id++, 'Subtitle', M, 3650000, W - 2 * M, 900000, para(s.subtitle, 1800, 'CBD5E1')));
    if (s.bullets?.length) parts.push(box(id++, 'Meta', M, 4600000, W - 2 * M, 1200000, s.bullets.map(b => para(b, 1400, 'E2E8F0')).join('')));
  } else {
    parts.push(box(id++, 'Title', M, 320000, W - 2 * M, 760000, para(s.title, 2800, o.navy, true)));
    if (s.subtitle) parts.push(box(id++, 'Subtitle', M, 1020000, W - 2 * M, 420000, para(s.subtitle, 1400, '64748B')));
    let y = s.subtitle ? 1500000 : 1150000;
    if (s.bullets?.length) {
      const h = s.table ? 1900000 : H - y - 700000;
      parts.push(box(id++, 'Body', M, y, W - 2 * M, h, s.bullets.map(b => para(b, s.table ? 1500 : 1800, '0F172A', false, true)).join('')));
      y += h + 150000;
    }
    if (s.table?.length) parts.push(tableXml(id++, s.table, M, y, W - 2 * M, Math.max(600000, H - y - 650000), o));
  }
  // footer
  const foot = `${o.footer}${o.footer ? '  ·  ' : ''}${idx + 1} / ${total}`;
  parts.push(box(id++, 'Footer', M, H - 500000, W - 2 * M, 350000, `<a:p><a:pPr algn="${o.rtl ? 'l' : 'r'}"${rtlAttr}><a:buNone/></a:pPr>${run(foot, 1000, cover ? 'CBD5E1' : '94A3B8')}</a:p>`));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${parts.join('\n')}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function tableXml(id: number, rows: (string | number)[][], x: number, y: number, cx: number, cy: number, o: { rtl: boolean; navy: string; accent: string; font: string }): string {
  const maxRows = 14, maxCols = 8;
  const data = rows.slice(0, maxRows).map(r => r.slice(0, maxCols));
  const cols = Math.max(...data.map(r => r.length), 1);
  const colW = Math.floor(cx / cols);
  const rowH = Math.floor(Math.min(cy / data.length, 420000));
  const cell = (v: string | number, head: boolean, zebra: boolean) =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${o.rtl ? 'r' : 'l'}"${o.rtl ? ' rtl="1"' : ''}/><a:r><a:rPr lang="ar-SA" sz="${head ? 1200 : 1100}"${head ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${head ? 'FFFFFF' : '0F172A'}"/></a:solidFill><a:latin typeface="${o.font}"/><a:cs typeface="${o.font}"/></a:rPr><a:t>${xmlEscape(String(v ?? ''))}</a:t></a:r></a:p></a:txBody><a:tcPr marL="72000" marR="72000" marT="36000" marB="36000" anchor="ctr"><a:solidFill><a:srgbClr val="${head ? o.navy : zebra ? 'F8FAFC' : 'FFFFFF'}"/></a:solidFill></a:tcPr></a:tc>`;
  const trs = data.map((r, ri) => `<a:tr h="${rowH}">${Array.from({ length: cols }, (_, ci) => cell(r[ci] ?? '', ri === 0, ri % 2 === 0)).join('')}</a:tr>`).join('');
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${colW * cols}" cy="${rowH * data.length}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr${o.rtl ? ' rtl="1"' : ''} firstRow="1" bandRow="1"/><a:tblGrid>${Array.from({ length: cols }, () => `<a:gridCol w="${colW}"/>`).join('')}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
}

export function downloadPptx(filename: string, slides: PptSlide[], opts?: PptOptions): void {
  const bytes = buildPptx(slides, opts);
  const buf = new ArrayBuffer(bytes.byteLength); new Uint8Array(buf).set(bytes);
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.endsWith('.pptx') ? filename : `${filename}.pptx`; a.click(); URL.revokeObjectURL(a.href);
}
