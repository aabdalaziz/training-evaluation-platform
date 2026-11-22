// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-1/4 «نبض أَثَر»: شريط أخبار المنطقة + تقييم الخدمة — اختبارات خالصة (بلا شبكة)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RATING_SERVICES, RATING_TAGS, SERVICE_AR, STAR_WORDS, maskEmail, fmtAvg, fmtCount, satisfaction } from '../lib/portal/ratings';
import { zoneOf } from '../app/components/AtharBackdrop';

const R = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('قاموس الخدمات مكتمل ومُعرَّب', () => {
  assert.equal(RATING_SERVICES.length, 7);
  for (const s of RATING_SERVICES) assert.ok(SERVICE_AR[s], s);
  assert.equal(SERVICE_AR.iqra, 'اقْرَأْ'); assert.equal(SERVICE_AR.miaar, 'مِعيار');
  assert.equal(STAR_WORDS.length, 6); assert.equal(STAR_WORDS[5], 'ممتاز');
  assert.ok(RATING_TAGS.filter((t) => t.tone === 'up').length >= 4 && RATING_TAGS.filter((t) => t.tone === 'down').length >= 4);
  assert.equal(new Set(RATING_TAGS.map((t) => t.key)).size, RATING_TAGS.length);
  // «التقييم» لا «القياس»
  assert.ok(!JSON.stringify(RATING_TAGS).includes('قياس'));
});

test('قناع البريد لا يكشف العنوان', () => {
  const m = maskEmail('ahmed.badawi@gmail.com');
  assert.ok(!m.includes('ahmed.badawi')); assert.ok(m.startsWith('a')); assert.ok(m.endsWith('.com')); assert.ok(m.includes('@'));
  assert.equal(maskEmail(''), '***'); assert.equal(maskEmail('x@y.z').length > 3, true);
});

test('صياغات عربية للأعداد والمتوسّط', () => {
  assert.equal(fmtCount(1), 'تقييم واحد'); assert.equal(fmtCount(2), 'تقييمان');
  assert.ok(fmtCount(3).endsWith('تقييمات')); assert.ok(fmtCount(11).endsWith('تقييمًا'));
  assert.equal(fmtAvg(4.75).length >= 3, true); // ٤٫٨
  assert.equal(satisfaction([0, 0, 1, 1, 2]), 75); assert.equal(satisfaction([0, 0, 0, 0, 0]), 0);
});

test('خريطة المناطق: الشريط لا يظهر في الرئيسة ويظهر في المناطق', () => {
  assert.equal(zoneOf('/'), 'home'); assert.equal(zoneOf('/iqra/start'), 'iqra'); assert.equal(zoneOf('/miaar'), 'miaar');
  assert.equal(zoneOf('/org'), 'org'); assert.equal(zoneOf('/experts'), 'experts'); assert.equal(zoneOf('/admin/pulse'), 'staff');
  assert.equal(zoneOf('/programs/x'), 'portal'); // تُترجَم إلى programs في PortalShell
  const shell = R('app/components/PortalShell.tsx');
  assert.match(shell, /pathname\.startsWith\('\/programs'\) \? 'programs' : zoneOf\(pathname\)/);
  assert.match(shell, /pathname !== '\/' && !pathname\.startsWith\('\/admin'\)/);
});

test('الترحيل: جداول ودوال هـ-1/4 بأسمائها', () => {
  const sql = R('supabase/migrations/20270218_portal_h1_b4_zone_news_ratings.sql');
  for (const s of ['create table if not exists public.zone_news', 'create table if not exists public.service_ratings', 'portal_zone_news_upsert', 'portal_zone_news_delete', 'service_rating_summary', 'unique (service, ref_id, rater_email)']) assert.ok(sql.includes(s), s);
  assert.ok(/stars\s+smallint\s+not null\s+check\s*\(stars between 1 and 5\)/i.test(sql));
  assert.ok(/zone\s+text\s+not null\s+check\s*\(zone in \('miaar','iqra','programs','org','experts','staff','portal'\)\)/i.test(sql));
});

test('ZoneTape: يدور كل ٧ ثوانٍ، يتوقّف بالتحويم، ساكن مع خفض الحركة، ولا يظهر بلا أخبار', () => {
  const z = R('app/components/ZoneTape.tsx');
  assert.ok(z.includes('7000')); assert.ok(z.includes('onMouseEnter={() => setHold(true)}'));
  assert.ok(z.includes("prefers-reduced-motion: reduce") && z.includes("dataset.engrave === 'none'"));
  assert.ok(z.includes("if (!items || !items.length || zone === 'home') return null"));
  assert.ok(z.includes('data-testid="zone-tape"'));
});

test('RateService: نجوم ١–٥ ووسوم حسب النجمة وكلمة ≤٣٠٠ وتعديل بعد الإرسال', () => {
  const r = R('app/components/RateService.tsx');
  assert.ok(r.includes('[1, 2, 3, 4, 5].map')); assert.ok(r.includes('slice(0, 300)')); assert.ok(r.includes("stars >= 4 ? t.tone === 'up' : stars <= 2 ? t.tone === 'down' : true"));
  assert.ok(r.includes("setState('edit')")); assert.ok(r.includes('data-testid="rate-send"'));
});

test('API التقييم: صلاحيات وحدود', () => {
  const a = R('app/api/ratings/route.ts');
  assert.ok(a.includes("onConflict: 'service,ref_id,rater_email'"));
  assert.ok(a.includes("if (!c.email) return bad('sign_in_or_code', 401)"));
  assert.ok(a.includes("if (!STAFF.includes(c.role)) return bad('forbidden', 403)"));
  assert.ok(a.includes('rateLimit(c.db, `ratings:${ipOf(req)}`, 3600, 40)'));
  assert.ok(a.includes('maskEmail(r.rater_email)'));
  const n = R('app/api/zone-news/route.ts');
  assert.ok(n.includes('portal_zone_news_upsert') && n.includes('portal_zone_news_delete'));
});

test('نبض أَثَر مُسجَّل في التبويبات والغرف', () => {
  assert.ok(R('app/components/PortalAdminTabs.tsx').includes("'/admin/pulse'"));
  assert.ok(R('lib/portal/rooms.ts').includes("'/admin/pulse'"));
  const p = R('app/admin/pulse/page.tsx'); assert.ok(p.includes('data-testid="zn-form"') && p.includes('data-testid="pulse-tab-ratings"'));
});

test('نقاط التركيب: مِعيار النتيجة · اقْرَأْ · البرنامج · بعد الدفع', () => {
  assert.ok(R('app/miaar/MiaarApp.tsx').includes('<RateService service="miaar" refId={code} code={code}'));
  assert.ok(R('app/iqra/IqraApp.tsx').includes('<RateService service="iqra"') && R('app/iqra/IqraApp.tsx').includes('<ZoneTape zone="iqra" compact />'));
  assert.ok(R('app/programs/[id]/page.tsx').includes('{mine && rateTok && <RateService service="program"'));
  assert.ok(R('app/pay/[id]/page.tsx').includes("{inv.status === 'paid' && rateTok && <RateService service=\"payment\""));
});
