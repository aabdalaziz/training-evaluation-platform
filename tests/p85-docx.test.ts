// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 — سلامة ملفّ Word المولَّد: ZIP صالح + XML قابل للتحليل + النصوص موجودة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildDocx } from '../lib/export/docx';

test('buildDocx ينتج ZIP/OOXML صالحًا يحوي العناوين والجداول والصور', (t) => {
  try { execFileSync('python3', ['-c', 'import zipfile']); } catch { t.skip('python3 غير متاح — يُتجاوز فحص ZIP الخارجي'); return; }
  // PNG 1×1 صالح
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,13,73,68,65,84,120,156,99,248,255,255,63,0,5,254,2,254,167,53,129,132,0,0,0,0,73,69,78,68,174,66,96,130]);
  const bytes = buildDocx([
    { type: 'h2', text: 'الملخّص التنفيذي' }, { type: 'p', text: 'نصّ عربي & <رموز> "اقتباس"' },
    { type: 'kpis', items: [{ label: 'المتوسط', value: '4.31', sub: 'من 5' }] },
    { type: 'table', head: ['البند', 'n', 'المتوسط'], rows: [['أ', 10, 4.2], ['ب', 12, 3.9]] },
    { type: 'bullets', items: ['أولًا', 'ثانيًا'] }, { type: 'numbered', items: ['خطوة 1', 'خطوة 2'] },
    { type: 'image', png, w: 400, h: 200, caption: 'رسم تجريبي' }, { type: 'callout', title: 'F1 · قوّة', text: 'دليل' }, { type: 'pagebreak' }, { type: 'h3', text: 'ختام' },
  ], { title: 'تقرير اختبار', subtitle: 'فرعي', header: 'بوّابة أَثَر' });
  assert.ok(bytes.length > 1000);
  writeFileSync('/tmp/p85-test.docx', bytes);
  const py = `
import zipfile, xml.etree.ElementTree as ET, sys
z = zipfile.ZipFile('/tmp/p85-test.docx'); assert z.testzip() is None, 'bad zip'
names = z.namelist()
for req in ['[Content_Types].xml','_rels/.rels','word/document.xml','word/_rels/document.xml.rels','word/styles.xml']: assert req in names, req
for n in names:
    if n.endswith('.xml') or n.endswith('.rels'): ET.fromstring(z.read(n))
doc = z.read('word/document.xml').decode('utf-8')
for s in ['الملخّص التنفيذي','&amp;','&lt;رموز&gt;','4.31','<w:tbl>','<w:drawing>','w:br w:type="page"','ختام']: assert s in doc, 'missing '+s
assert any(n.startswith('word/media/') and n.endswith('.png') for n in names), 'no media'
rels = z.read('word/_rels/document.xml.rels').decode()
assert 'media/' in rels and ('header' in rels or 'footer' in rels)
print('OK', len(names))
`;
  const out = execFileSync('python3', ['-c', py]).toString();
  assert.match(out, /^OK/);
});
