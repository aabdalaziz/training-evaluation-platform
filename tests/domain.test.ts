// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** النطاق الرسمي athar.university (2026-11-15): الافتراضيات، المُرسِل، robots/sitemap */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SITE, normalizeSite } from '../lib/portal/open';
import { DEFAULT_FROM, fromAddress, channelEnv } from '../lib/portal/notify';
import robots from '../app/robots';
import sitemap, { PUBLIC_PATHS } from '../app/sitemap';

test('domain: الافتراضي في الكود هو النطاق الرسمي', () => {
  assert.equal(DEFAULT_SITE, 'https://athar.university');
  assert.equal(normalizeSite(undefined), 'https://athar.university');
  assert.equal(normalizeSite('https://athar.university/'), 'https://athar.university');
  assert.equal(DEFAULT_FROM, 'أَثَر <reports@athar.university>');
  assert.equal(fromAddress({} as any), DEFAULT_FROM);
  assert.equal(channelEnv({ RESEND_API_KEY: 'k' } as any).emailTest, false, 'المُرسِل الافتراضي ليس وضع اختبار');
  assert.equal(fromAddress({ REPORTS_FROM_EMAIL: ' X <x@athar.university> ' } as any), 'X <x@athar.university>', 'المتغير يغلب الافتراضي');
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
    assert.equal(r.sitemap, 'https://athar.university/sitemap.xml'); assert.equal(r.host, 'https://athar.university');
    assert.equal(rule.allow, '/'); const dis = rule.disallow as string[];
    for (const p of ['/api/', '/admin/', '/me/', '/verify/', '/e/', '/mcp', '/miaar/result/']) assert.ok(dis.includes(p), `محجوب: ${p}`);
    const sm = sitemap(); assert.equal(sm.length, PUBLIC_PATHS.length); assert.equal(sm[0].url, 'https://athar.university/'); assert.equal(sm[0].priority, 1);
    for (const e of sm) { assert.ok(e.url.startsWith('https://athar.university/')); assert.ok(!dis.some(d => e.url.replace('https://athar.university', '').startsWith(d)), `صفحة عامّة ليست محجوبة: ${e.url}`); }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3100'; assert.equal(robots().host, 'http://127.0.0.1:3100', 'يتبع المتغير');
  } finally { if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = prev; }
});
