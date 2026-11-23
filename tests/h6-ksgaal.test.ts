// حارس «معايير دعم اللغة العربية في التطبيقات الحاسوبية» (مجمع الملك سلمان) — ما يُقاس آليًا
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(__dirname, '..');
function walk(d: string, out: string[] = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(f)) walk(p, out); }
    else if (/\.(tsx?|css)$/.test(f)) out.push(p);
  }
  return out;
}
const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))];
test('١ البرمجية: أسماء الملفات لاتينية 100%', () => {
  const bad = files.filter(f => /[^\x00-\x7F]/.test(path.relative(ROOT, f)));
  assert.deepEqual(bad, []);
});
test('٦ الترميز: كل الملفات UTF-8 صالحة', () => {
  const dec = new TextDecoder('utf-8', { fatal: true });
  const bad = files.filter(f => { try { dec.decode(fs.readFileSync(f)); return false; } catch { return true; } });
  assert.deepEqual(bad, []);
});
test('٢ المكتوب: الجذر lang="ar" dir="rtl" وخطّان عربيان', () => {
  const s = fs.readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
  assert.match(s, /lang="ar"\s+dir="rtl"/);
  assert.match(s, /IBM_Plex_Sans_Arabic/); assert.match(s, /Noto_Naskh_Arabic/);
});
test('٣ التداخل: لا اختصارات عربية (م ع س · ص.ب …)', () => {
  const re = /(?<![\u0621-\u064A])(م ع س|م\.ع\.س|ص\.ب|د\.ت)(?![\u0621-\u064A])/;
  const bad = files.filter(f => re.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});
test('٦ الصرف: لا «2 اسم» بدل المثنى في النصوص', () => {
  const re = /(?<![\d.])2 (ملف|ساعة|جلسة|برنامج|شعبة|طالب|مشارك|يوم|أسبوع|شهر|سنة|مرة|نقطة|سؤال)(?![\u0621-\u064A])/;
  const bad = files.filter(f => re.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(ROOT, f));
  assert.deepEqual(bad, []);
});
test('٥ التوطين: هجري أمّ القرى + Asia/Riyadh + ريال', () => {
  const all = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  assert.match(all, /islamic-umalqura/); assert.match(all, /Asia\/Riyadh/); assert.match(all, /SAR|ريال/);
});
test('٤ الأطفال: نصوص بَيان مشكولة وبلا لاتينية خارج الأقواس', () => {
  const s = fs.readFileSync(path.join(ROOT, 'lib/kids/souq.ts'), 'utf8');
  const strs = [...s.matchAll(/(['"`])((?:(?!\1).){6,300})\1/g)].map(m => m[2]).filter(t => /[\u0621-\u064A]/.test(t));
  const mixed = strs.filter(t => /[A-Za-z]{2,}/.test(t.replace(/\([^)]*\)|\$\{[^}]*\}|https?:\/\/\S+|\/[\w./-]+/g, '')));
  assert.deepEqual(mixed, []);
  const vowelled = strs.filter(t => /[\u064B-\u0652]/.test(t)).length;
  assert.ok(vowelled / strs.length > 0.8, `نسبة النصوص المشكولة ${vowelled}/${strs.length}`);
});
test('٩ الصيانة: قنوات دعم بالعربية موجودة', () => {
  for (const p of ['app/help/page.tsx', 'app/contact/page.tsx', 'app/accessibility/page.tsx']) assert.ok(fs.existsSync(path.join(ROOT, p)), p);
});
