// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** النطاق الرسمي athar-portal.com (2026-11-15): الافتراضيات، المُرسِل، robots/sitemap */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SITE, normalizeSite } from '../lib/portal/open';
import { DEFAULT_FROM, fromAddress, channelEnv } from '../lib/portal/notify';
import robots from '../app/robots';
import sitemap, { PUBLIC_PATHS } from '../app/sitemap';
import { POST as sendmailPost, GET as sendmailGet } from '../app/api/sendmail/route';
import { resolveSiteEnv, CANONICAL_SITE, register } from '../instrumentation';

test('domain: الافتراضي في الكود هو النطاق الرسمي', () => {
  assert.equal(DEFAULT_SITE, 'https://athar-portal.com');
  assert.equal(normalizeSite(undefined), 'https://athar-portal.com');
  assert.equal(normalizeSite('https://athar-portal.com/'), 'https://athar-portal.com');
  assert.equal(DEFAULT_FROM, 'أَثَر <reports@athar-portal.com>');
  assert.equal(fromAddress({} as any), DEFAULT_FROM);
  assert.equal(channelEnv({ RESEND_API_KEY: 'k' } as any).emailTest, false, 'المُرسِل الافتراضي ليس وضع اختبار');
  assert.equal(fromAddress({ REPORTS_FROM_EMAIL: ' X <x@athar-portal.com> ' } as any), 'X <x@athar-portal.com>', 'المتغير يغلب الافتراضي');
});

test('domain: لا بقايا للنطاق القديم في المصادر (باستثناء الوثائق التاريخية)', () => {
  const files = ['lib/portal/open.ts', 'lib/portal/notify.ts', 'lib/portal/mcp-server.ts', 'lib/portal/passport.ts', 'lib/portal/pocket.ts', 'lib/vault/subject.ts', 'lib/vault/notice.ts', 'lib/shield/drill.ts', 'lib/miaar/mail-draft.ts',
    'app/page.tsx', 'app/agents/page.tsx', 'app/me/agents/page.tsx', 'app/security/page.tsx', 'app/api/agent/route.ts', 'app/api/shield/route.ts', 'app/api/shield/report/route.ts', 'app/api/sendmail/route.ts'];
  for (const f of files) { const src = readFileSync(f, 'utf8'); assert.ok(!src.includes('athar-portal.vercel.app'), `${f} ما زال يذكر النطاق القديم`); assert.ok(!src.includes('onboarding@resend.dev') && !src.includes('yourdomain'), `${f} مُرسِل غير معتمد`); }
});

test('domain: robots يسمح بالعامّ ويحجب الخاصّ، وsitemap للصفحات العامّة فقط', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL; delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const r = robots(); const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { allow?: string | string[]; disallow?: string | string[] };
    assert.equal(r.sitemap, 'https://athar-portal.com/sitemap.xml'); assert.equal(r.host, 'https://athar-portal.com');
    assert.equal(rule.allow, '/'); const dis = rule.disallow as string[];
    for (const p of ['/api/', '/admin/', '/me/', '/verify/', '/e/', '/mcp', '/miaar/result/']) assert.ok(dis.includes(p), `محجوب: ${p}`);
    const sm = sitemap(); assert.equal(sm.length, PUBLIC_PATHS.length); assert.equal(sm[0].url, 'https://athar-portal.com/'); assert.equal(sm[0].priority, 1);
    for (const e of sm) { assert.ok(e.url.startsWith('https://athar-portal.com/')); assert.ok(!dis.some(d => e.url.replace('https://athar-portal.com', '').startsWith(d)), `صفحة عامّة ليست محجوبة: ${e.url}`); }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3100'; assert.equal(robots().host, 'http://127.0.0.1:3100', 'يتبع المتغير');
  } finally { if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = prev; }
});

test('security 2026-11-15: مسار /api/sendmail القديم مُوقَف (410) ولا يقرأ الجسم ولا يتصل بالخارج', async () => {
  const p = await sendmailPost(); assert.equal(p.status, 410); const j = await p.json(); assert.equal(j.success, false); assert.equal(j.error, 'gone');
  assert.equal(p.headers.get('cache-control'), 'no-store'); const g = await sendmailGet(); assert.equal(g.status, 410);
  const src = readFileSync('app/api/sendmail/route.ts', 'utf8'); assert.ok(!src.includes('api.resend.com') && !src.includes('RESEND_API_KEY') && !src.includes('request.json'), 'لا إرسال ولا قراءة جسم');
  const sql = readFileSync('supabase/sec-2026-11-15-hardening.sql', 'utf8');
  for (const k of ['drop policy if exists needs_public_read', 'create policy needs_own_read', 'revoke execute on function public.portal_oauth_gc()', 'revoke execute on function public.portal_latest_level(text)', 'union all']) assert.ok(sql.includes(k), `SQL: ${k}`);
});

test('identity 2026-11-15: النطاق الرسمي athar-portal.com مثبَّت في next.config وبريد التواصل والأمن على النطاق نفسه', () => {
  const nc = readFileSync('next.config.js', 'utf8');
  assert.ok(nc.includes("const CANONICAL_SITE = 'https://athar-portal.com'"), 'ثابت النطاق الرسمي');
  assert.ok(/env:\s*\{\s*NEXT_PUBLIC_SITE_URL:\s*process\.env\.VERCEL\s*\?\s*CANONICAL_SITE/.test(nc), 'على Vercel يُثبَّت النطاق الرسمي');
  const content = readFileSync('lib/portal/content.ts', 'utf8'); assert.ok(content.includes("email: 'info@athar-portal.com'"), 'بريد التواصل الرسمي');
  const agents = readFileSync('lib/portal/agents.ts', 'utf8'); assert.ok(agents.includes("contact_email: 'info@athar-portal.com'"), 'بطاقة الوكلاء');
  for (const f of ['lib/portal/content.ts', 'lib/portal/agents.ts', 'lib/shield/drill.ts', 'lib/portal/push.ts', 'app/layout.tsx', 'lib/portal/open.ts', 'lib/portal/notify.ts']) {
    const src = readFileSync(f, 'utf8'); assert.ok(!src.includes('athar.university') && !src.includes('info@athar-portal.sa') && !src.includes('aaabdalaziz@gmail.com'), `${f}: لا بقايا هوية قديمة`);
  }
});

test('identity: instrumentation يثبّت النطاق الرسمي على Vercel ويترك المحلي', async () => {
  assert.equal(CANONICAL_SITE, 'https://athar-portal.com');
  assert.equal(resolveSiteEnv({ VERCEL: '1', NEXT_PUBLIC_SITE_URL: 'https://athar.university' }), CANONICAL_SITE, 'على Vercel دائمًا الرسمي');
  assert.equal(resolveSiteEnv({ VERCEL: '1' }), CANONICAL_SITE);
  assert.equal(resolveSiteEnv({ NEXT_PUBLIC_SITE_URL: 'https://athar.university' }), CANONICAL_SITE, 'نطاق قديم محليًا → الرسمي');
  assert.equal(resolveSiteEnv({ NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100' }), 'http://127.0.0.1:3100', 'E2E لا يتغيّر');
  assert.equal(resolveSiteEnv({}), undefined);
  const prevV = process.env.VERCEL, prevS = process.env.NEXT_PUBLIC_SITE_URL;
  try { process.env.VERCEL = '1'; process.env.NEXT_PUBLIC_SITE_URL = 'https://athar.university'; await register(); assert.equal(process.env.NEXT_PUBLIC_SITE_URL, CANONICAL_SITE, 'register يصحّح القيمة الحيّة'); }
  finally { if (prevV === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevV; if (prevS === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = prevS; }
  const nc = readFileSync('next.config.js', 'utf8'); assert.ok(nc.includes('instrumentationHook: true'), 'الخطّاف مفعَّل');
});

test('SEO: «بوابة الأثر» في العنوان والكلمات والبيانات المنظّمة', () => {
  const lay = readFileSync('app/layout.tsx', 'utf8');
  assert.ok(lay.includes("default: 'أَثَر — بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ'"), 'العنوان الرئيسي');
  assert.ok(lay.includes("'بوابة الأثر'") && lay.includes("'Athar Portal'"), 'الأسماء البديلة');
  assert.ok(lay.includes('application/ld+json') && lay.includes("'@type': 'Organization'") && lay.includes("'@type': 'WebSite'"), 'JSON-LD منظمة + موقع');
  assert.ok(lay.includes('siteJsonLd(normalizeSite(process.env.NEXT_PUBLIC_SITE_URL))'), 'النطاق من normalizeSite');
});
