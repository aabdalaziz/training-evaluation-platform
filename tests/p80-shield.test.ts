// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P80 */ /** اختبارات الحزمة الأمنية: قرار التوثيق الثنائي · فكّ JWT · سياسة احتفاظ النسخ · أسماء الملفّات · مفتاح CSP. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mfaDecision, jwtPayload, aalOf, otpauthUri, isTotpCode, requireMfa, MFA_ROLES } from '../lib/shield/mfa';
import { pruneList, objectName, monthlyName, KEEP_DAILY } from '../lib/backup/auto';

const jwt = (p: any) => 'h.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.s';

test('MFA: من سجّل عاملًا يُطالَب به دائمًا · الأدوار الإدارية تُلزَم بعد التاريخ · غيرهم يمرّ', () => {
  const from = new Date('2026-12-01T00:00:00Z');
  assert.equal(mfaDecision({ role: 'TRAINER', aal: 'aal1', verifiedFactors: 1, requiredFrom: null }), 'challenge');
  assert.equal(mfaDecision({ role: 'TRAINER', aal: 'aal2', verifiedFactors: 1, requiredFrom: null }), 'ok');
  assert.equal(mfaDecision({ role: 'TRAINER', aal: 'aal1', verifiedFactors: 0, requiredFrom: from, now: new Date('2027-01-01') }), 'ok');
  assert.equal(mfaDecision({ role: 'ADMIN', aal: 'aal1', verifiedFactors: 0, requiredFrom: null }), 'enrol_soft');
  assert.equal(mfaDecision({ role: 'ADMIN', aal: 'aal1', verifiedFactors: 0, requiredFrom: from, now: new Date('2026-11-26') }), 'enrol_soft');
  assert.equal(mfaDecision({ role: 'platform_admin', aal: 'aal1', verifiedFactors: 0, requiredFrom: from, now: new Date('2026-12-01') }), 'enrol');
  assert.ok(MFA_ROLES.includes('FINANCE_MANAGER'));
});

test('JWT: فكّ الحمولة بلا تحقّق · aal', () => {
  assert.equal(jwtPayload(jwt({ aal: 'aal2', sub: 'x' }))?.aal, 'aal2'); assert.equal(aalOf(jwt({ aal: 'aal2' })), 'aal2'); assert.equal(aalOf(jwt({})), 'aal1'); assert.equal(aalOf('garbage'), 'aal1'); assert.equal(jwtPayload(null), null);
  assert.match(otpauthUri({ secret: 'ABC', email: 'a@b.co' }), /^otpauth:\/\/totp\/Athar:a%40b\.co\?secret=ABC&issuer=Athar/);
  assert.equal(isTotpCode('123 456'), true); assert.equal(isTotpCode('12345'), false);
});

test('requireMfa (خادم): aal2 يمرّ بلا استعلام · aal1 مع عامل موثَّق → 403 · aal1 بلا عامل ودور عادي → يمرّ', async () => {
  let calls = 0; const mk = (totp: any[]) => ({ auth: { mfa: { listFactors: async () => { calls++; return { data: { totp } }; } } } });
  const r1 = await requireMfa(mk([{ status: 'verified' }]), jwt({ aal: 'aal2' }), 'ADMIN', {}); assert.ok(r1.ok); assert.equal(calls, 0);
  const r2 = await requireMfa(mk([{ status: 'verified' }]), jwt({ aal: 'aal1' }), 'TRAINER', {}); assert.equal(r2.ok, false); if (!r2.ok) { assert.equal(r2.status, 403); assert.equal(r2.code, 'MFA_REQUIRED'); }
  const r3 = await requireMfa(mk([]), jwt({ aal: 'aal1' }), 'TRAINER', {}); assert.ok(r3.ok);
  const r4 = await requireMfa(mk([]), jwt({ aal: 'aal1' }), 'ADMIN', { NEXT_PUBLIC_MFA_REQUIRED_FROM: '2020-01-01' }); assert.equal(r4.ok, false); if (!r4.ok) assert.equal(r4.code, 'MFA_ENROL_REQUIRED');
  const r5 = await requireMfa(mk([]), jwt({ aal: 'aal1' }), 'ADMIN', {}); assert.ok(r5.ok); if (r5.ok) assert.equal(r5.decision, 'enrol_soft');
});

test('النسخ الاحتياطي: الأسماء · الاحتفاظ 14 يوميّة + 12 شهريّة', () => {
  const now = new Date('2026-11-26T03:00:00Z');
  assert.equal(objectName(now), 'daily/2026-11-26.json'); assert.equal(monthlyName(now), 'monthly/2026-11.json');
  const names = ['daily/2026-11-26.json', 'daily/2026-11-12.json', 'daily/2026-11-11.json', 'daily/2026-10-01.json', 'monthly/2026-11.json', 'monthly/2025-11.json', 'monthly/2025-10.json', 'other.txt'];
  assert.deepEqual(pruneList(names, now), ['daily/2026-11-11.json', 'daily/2026-10-01.json', 'monthly/2025-10.json']);
  assert.equal(KEEP_DAILY, 14);
});

test('CSP: المفتاح يقلب السياسة إلى إلزامية', async () => {
  const fs = await import('node:fs'); const src = fs.readFileSync(new URL('../next.config.js', import.meta.url), 'utf8');
  assert.match(src, /SHIELD_CSP_ENFORCE === '1'/); assert.match(src, /cspFor\('\*'\)/); assert.match(src, /cspFor\("'none'"\)/); assert.doesNotMatch(src, /Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY \}\] \},\n\s*\{ source: '\/m/);
});
