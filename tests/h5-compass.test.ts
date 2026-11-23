/* هـ-5 «بوصلة أَثَر»: الجولة التعريفية لكل داخل · خدمة التوقيت والتاريخ · الخدمات الدائمة · من أنت؟ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { QUICK_SERVICES, WHERE_TO, nowParts, TOUR_SRC, TOUR_POSTER, TOUR_SECONDS, RIYADH_TZ } from '../app/components/Compass';

const ROOT = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('هـ-5: كل خدمة سريعة وكل باب «من أنت؟» يشير إلى مسار موجود فعلًا', () => {
  assert.equal(QUICK_SERVICES.length, 10);
  assert.equal(new Set(QUICK_SERVICES.map((s) => s.key)).size, 10);
  for (const s of [...QUICK_SERVICES, ...WHERE_TO]) {
    const seg = s.href.replace(/^\//, '').split('#')[0];
    const dir = path.join(ROOT, 'app', seg);
    assert.ok(fs.existsSync(path.join(dir, 'page.tsx')) || fs.existsSync(dir), `${s.href} لا صفحة له`);
  }
  for (const s of QUICK_SERVICES) assert.ok(s.ar.length > 3 && s.en.length > 3 && s.hint_ar.length > 3, s.key);
});

test('هـ-5: التوقيت والتاريخ — ساعة الرياض 24 ساعة · هجري أمّ القرى · ميلادي · اليوم', () => {
  const d = new Date('2026-11-23T03:02:29Z');
  const p = nowParts(d, 'ar');
  assert.equal(RIYADH_TZ, 'Asia/Riyadh');
  assert.equal(p.time, '06:02'); assert.equal(p.seconds, '29');
  assert.match(p.hijri, /1448/); assert.match(p.hijri, /جمادى/);
  assert.match(p.greg, /2026/); assert.match(p.greg, /نوفمبر/);
  assert.equal(p.weekday, 'الاثنين');
  const e = nowParts(d, 'en'); assert.match(e.weekday, /Monday/); assert.match(e.hijri, /1448/);
});

test('هـ-5: الفيديو التعريفي — ملف خفيف (≤ 3 MB) مع صورة غلاف، ودقيقة واحدة', () => {
  const v = path.join(ROOT, 'public', TOUR_SRC); const img = path.join(ROOT, 'public', TOUR_POSTER);
  assert.ok(fs.existsSync(v) && fs.existsSync(img));
  assert.ok(fs.statSync(v).size < 3 * 1024 * 1024, 'الفيديو أثقل من 3 MB');
  assert.ok(TOUR_SECONDS >= 60 && TOUR_SECONDS <= 70);
});

test('هـ-5: الصدفة تحمل الجولة والساعة في كل صفحة، والواجهة تحمل البوصلة قبل الأبواب', () => {
  const shell = read('app/components/PortalShell.tsx');
  assert.match(shell, /<TourVeil lang=\{lang\} \/>/); assert.match(shell, /<NowStrip lang=\{lang\} compact \/>/); assert.match(shell, /<TourButton lang=\{lang\} compact \/>/); assert.match(shell, /COMPASS_CSS/);
  const home = read('app/page.tsx');
  const i = home.indexOf('<CompassSection lang={lang} />'); const j = home.indexOf('<HomeDoors lang={lang} />');
  assert.ok(i > 0 && j > i, 'البوصلة قبل الأبواب');
  const c = read('app/components/Compass.tsx');
  assert.match(c, /localStorage\.getItem\(TOUR_KEY\)/); // مرّة لكل جهاز
  assert.match(c, /prefers-reduced-motion/);
  assert.match(c, /data-testid="cp-tour-skip"/); assert.match(c, /data-testid="cp-tour-unmute"/);
  assert.ok(!/المتدرب|المنصة|استطلاع|القاعة/.test(c), 'المعجم: لا صيغة متقاعدة في البوصلة');
});
