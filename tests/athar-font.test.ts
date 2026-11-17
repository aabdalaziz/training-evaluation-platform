// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «خطّ أَثَر» — طبقتان: الواجهة IBM Plex Sans Arabic والقراءة التعليمية Noto Naskh Arabic؛ كلّ ما يقرؤه المتعلّم بخطّ القراءة؛ لا Google Fonts خارجي؛ لا رقعة للأسئلة؛ حجم القراءة بثلاث درجات على الجهاز */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.join(__dirname, '..'); const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('خطّ أَثَر: المتغيّران في القشرة · .read والدرجات الثلاث في style.css · مبدّل الحجم بلا خادم', () => {
  const layout = read('app/layout.tsx'); assert.match(layout, /variable: '--font-ar'/); assert.match(layout, /variable: '--font-read'/); assert.match(layout, /className=\{`\$\{plex\.variable\} \$\{naskh\.variable\}`\}/);
  const css = read('app/style.css'); assert.match(css, /\.read\{font-family:var\(--font-read\)/); assert.match(css, /html\[data-read="2"\]\{--read-size:1\.15\}/); assert.match(css, /html\[data-read="3"\]\{--read-size:1\.35\}/); assert.match(css, /line-height:2/);
  const rs = read('app/components/ReadSize.tsx'); assert.match(rs, /localStorage/); assert.doesNotMatch(rs, /fetch\(/); assert.match(rs, /data-testid="read-size"/); assert.match(rs, /dataset\.read = s/);
});

test('خطّ أَثَر: نصوص المتعلّم في اقْرَأْ ومِعيار ومِران والبنك بخطّ القراءة · لا رقعة · لا رابط Google Fonts في أيّ ملف', () => {
  const iq = read('app/iqra/IqraApp.tsx'); assert.match(iq, /\.iq-text,\.iq-intro,\.iq-q,\.iq-opt,\.iq-chip,\.iq-flash,\.iq-ex legend[^{]*\{font-family:var\(--font-read\)/); assert.match(iq, /<ReadSize \/>/); assert.match(iq, /var\(--read-size\)/);
  const mi = read('app/miaar/MiaarApp.tsx'); assert.match(mi, /\.mi-q\{[^}]*font-family:var\(--font-read\)/); assert.match(mi, /\.mi-opt\{[^}]*font-family:var\(--font-read\)/); assert.match(mi, /\.mi-specimen\{[^}]*font-family:var\(--font-read\)/); assert.doesNotMatch(mi, /Aref Ruqaa"\)/); assert.equal((mi.match(/<ReadSize label=/g) || []).length, 2, 'المبدّل في رأسَي مِعيار');
  const mp = read('app/miaar/practice/PracticeApp.tsx'); assert.match(mp, /\.mp-passage,\.mp-q legend,\.mp-opt[^{]*\{font-family:var\(--font-read\)/);
  const bk = read('app/admin/miaar/BankEditor.tsx'); assert.match(bk, /\.bk-stem,\.bk-opts,\.bk-edit textarea[^{]*\{font-family:var\(--font-read\)/);
  const iqd = read('app/admin/miaar/IqraDesk.tsx'); assert.match(iqd, /\.iqd-text\{[^}]*var\(--font-read\)/);
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' || e.name === '.next' ? [] : walk(path.join(d, e.name))) : /\.(tsx?|css)$/.test(e.name) ? [path.join(d, e.name)] : []));
  const offenders = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))].filter((f) => /fonts\.googleapis\.com/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => path.relative(ROOT, f)), [], 'لا تحميل خطوط من Google وقت التشغيل');
});
