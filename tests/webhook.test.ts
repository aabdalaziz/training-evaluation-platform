import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeEqual, eventAction, invoiceIdFrom } from '../lib/portal/webhook';

test('webhook: constant-time secret compare', () => {
  assert.ok(safeEqual('abc123', 'abc123')); assert.ok(!safeEqual('abc123', 'abc124')); assert.ok(!safeEqual('', '')); assert.ok(!safeEqual('a', 'ab')); assert.ok(!safeEqual('abc', ''));
});
test('webhook: event mapping', () => {
  assert.equal(eventAction('payment_paid'), 'paid'); assert.equal(eventAction('payment_captured'), 'paid'); assert.equal(eventAction('payment_refunded'), 'refunded');
  for (const t of ['payment_failed', 'payment_voided', 'payment_abandoned', 'card_auth_authenticated', undefined]) assert.equal(eventAction(t), 'ignore');
});
test('webhook: invoice id extraction is validated', () => {
  const u = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  assert.equal(invoiceIdFrom({ data: { metadata: { invoice_id: u } } }), u);
  assert.equal(invoiceIdFrom({ data: { metadata: { invoice_id: 'inv1; drop table' } } }), null);
  assert.equal(invoiceIdFrom({ data: {} }), null); assert.equal(invoiceIdFrom({}), null);
});
