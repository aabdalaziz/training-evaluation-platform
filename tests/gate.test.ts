// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */ /** اختبارات نواة «تصاريح الدخول»: التوقيع · القرار · الرموز · التحقّق من الطلب · البريد. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { signGate, verifyGate, decide, productOfPath, permitCode, normalizeCode, isCode, validateRequest, payloadForPermits, permitExpiry, buildPermitMail, canTrial, DEFAULT_PRODUCTS, findProduct, type GatePayload } from '../lib/portal/gate';

const env = { VC_SIGNING_KEY: 'test-key-123' };
const iqra = findProduct('iqra')!; const now = 1_800_000_000;

test('التوقيع والتحقّق: يقبل الصحيح ويرفض المعدَّل والمنتهي والمفتاح الآخر', async () => {
  const p: GatePayload = { v: 1, k: 'permit', p: ['iqra'], e: now + 100, m: 'a@b.co' };
  const t = await signGate(p, env);
  assert.deepEqual(await verifyGate(t, env, now), p);
  assert.equal(await verifyGate(t + 'x', env, now), null);
  assert.equal(await verifyGate(t, { VC_SIGNING_KEY: 'other' }, now), null);
  assert.equal(await verifyGate(t, env, now + 100), null);
  assert.equal(await verifyGate(null, env, now), null);
  // تدوير المفتاح: السابق ما زال يُقبل
  assert.ok(await verifyGate(t, { VC_SIGNING_KEY: 'new', TOKEN_SECRET_PREV: 'test-key-123' }, now));
});

test('القرار: الطاقم والتصريح يفتحان · المفتوح يمرّ · المغلق يُحوَّل · التجربة السارية تمرّ · المستهلكة تُحوَّل برسالة الانتهاء', () => {
  const staff: GatePayload = { v: 1, k: 'staff', p: ['*'], e: now + 10 }; const permit: GatePayload = { v: 1, k: 'permit', p: ['kids'], e: now + 10 };
  assert.deepEqual(decide({ product: iqra, gate: staff, trial: null, trialDone: [], pathname: '/iqra', nowS: now }), { allow: true, via: 'staff' });
  assert.equal(decide({ product: iqra, gate: permit, trial: null, trialDone: [], pathname: '/iqra', nowS: now }).allow, false); // تصريح لمنتج آخر
  assert.deepEqual(decide({ product: { ...iqra, mode: 'open' }, gate: null, trial: null, trialDone: [], pathname: '/iqra', nowS: now }), { allow: true, via: 'open' });
  const closed = decide({ product: { ...iqra, mode: 'closed' }, gate: null, trial: { v: 1, k: 'trial', p: ['iqra'], e: now + 50 }, trialDone: [], pathname: '/iqra/x', nowS: now });
  assert.equal(closed.allow, false); assert.equal((closed as any).reason, 'closed'); assert.equal((closed as any).redirect, '/gate/iqra?next=%2Fiqra%2Fx');
  assert.deepEqual(decide({ product: iqra, gate: null, trial: { v: 1, k: 'trial', p: ['iqra'], e: now + 50 }, trialDone: ['iqra'], pathname: '/iqra', nowS: now }), { allow: true, via: 'trial' });
  const done = decide({ product: iqra, gate: null, trial: null, trialDone: ['iqra'], pathname: '/iqra', nowS: now });
  assert.equal((done as any).reason, 'trial_expired'); assert.match((done as any).redirect, /expired=1$/);
  assert.equal((decide({ product: iqra, gate: null, trial: null, trialDone: [], pathname: '/iqra', nowS: now }) as any).reason, 'permit');
});

test('المسارات والمنتجات والتجربة', () => {
  assert.equal(productOfPath('/iqra'), 'iqra'); assert.equal(productOfPath('/kids/demo/3'), 'kids'); assert.equal(productOfPath('/on-air/week'), 'on-air'); assert.equal(productOfPath('/iqrax'), null); assert.equal(productOfPath('/miaar'), null);
  assert.equal(canTrial(iqra, []), true); assert.equal(canTrial(iqra, ['iqra']), false); assert.equal(canTrial({ ...iqra, trial_seconds: 0 }, []), false); assert.equal(canTrial({ ...iqra, mode: 'open' }, []), false);
  assert.equal(DEFAULT_PRODUCTS.filter((p) => p.mode === 'permit').map((p) => p.slug).join(','), 'iqra,kids');
});

test('الرموز: 10 أحرف بلا 0/O/1/I · التطبيع يصحّح الالتباس', () => {
  for (let i = 0; i < 50; i++) { const c = permitCode(); assert.ok(isCode(c), c); assert.doesNotMatch(c, /[01OI]/); }
  assert.equal(normalizeCode(' ab2-c0d1 ef9 '), 'AB2CODIEF9'); assert.equal(isCode(normalizeCode('ab2c0d1ef9')), true); assert.equal(isCode('SHORT'), false);
});

test('التحقّق من الطلب', () => {
  const ok = validateRequest({ product: 'iqra', name: '  أحمد   بدوي ', email: 'A@B.CO', phone: '+966 56 444 0406', org: '', purpose: 'x' });
  assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.value.name, 'أحمد بدوي'); assert.equal(ok.value.email, 'a@b.co'); assert.equal(ok.value.org, null); assert.equal(ok.value.lang, 'ar'); }
  assert.equal(validateRequest({ product: 'iqra', name: 'أ', email: 'a@b.co' }).ok, false);
  assert.equal(validateRequest({ product: 'iqra', name: 'أحمد', email: 'nope' }).ok, false);
  assert.equal(validateRequest({ product: 'IQRA!', name: 'أحمد', email: 'a@b.co' }).ok, false);
  assert.equal(validateRequest({ product: 'iqra', name: 'أحمد', email: 'a@b.co', phone: 'abc' }).ok, false);
});

test('حمولة التصاريح: النشطة فقط · أقرب انتهاء يحدّ الكعكة · المفتوحة تُحدّ بثلاثين يومًا', () => {
  const t0 = new Date('2026-09-16T00:00:00Z');
  assert.equal(payloadForPermits([{ product: 'iqra', revoked_at: '2026-01-01' }], 'a@b.co', t0), null);
  assert.equal(payloadForPermits([{ product: 'iqra', expires_at: '2026-01-01T00:00:00Z' }], 'a@b.co', t0), null);
  const p = payloadForPermits([{ product: 'iqra', expires_at: '2026-09-20T00:00:00Z' }, { product: 'kids', expires_at: null }, { product: 'sim', revoked_at: 'x' }], 'a@b.co', t0)!;
  assert.deepEqual(p.p, ['iqra', 'kids']); assert.equal(p.e, Math.floor(new Date('2026-09-20T00:00:00Z').getTime() / 1000)); assert.equal(p.k, 'permit');
  const q = payloadForPermits([{ product: 'kids', expires_at: null }], 'a@b.co', t0)!; assert.equal(q.e, Math.floor(t0.getTime() / 1000) + 30 * 86400);
  assert.equal(permitExpiry(0), null); assert.equal(permitExpiry(null), null); assert.equal(permitExpiry(30, t0), '2026-10-16T00:00:00.000Z');
});

test('بريد التصريح: موضوع عربي · رابط ورمز في النصّ والـHTML · هروب HTML', () => {
  const m = buildPermitMail({ name: '<b>x</b>', product: iqra, code: 'ABCDEFGHJK', url: 'https://athar-portal.com/gate/p/ABCDEFGHJK', expires_at: '2026-10-16T00:00:00Z' });
  assert.match(m.subject, /اقْرَأْ/); assert.match(m.text, /ABCDEFGHJK/); assert.match(m.html, /gate\/p\/ABCDEFGHJK/); assert.doesNotMatch(m.html, /<b>x<\/b>/); assert.match(m.html, /&lt;b&gt;x/); assert.match(m.text, /صالح حتى/);
  assert.match(buildPermitMail({ name: null, product: iqra, code: 'ABCDEFGHJK', url: 'u', expires_at: null }).text, /حتى إشعار آخر/);
});
