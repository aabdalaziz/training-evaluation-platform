import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, computeAmounts, toHalalas, isValidIban, formatIban, receiptPath, isOverdue, totals, verifyGatewayPayment, invoicesSheet, invoiceEmail, receiptEmail, jpegToPortraitPdf, invStatusLabel, methodLabel, INV_STATUS } from '../lib/portal/payments';
import type { Invoice } from '../lib/portal/payments';

const INV = (x: Partial<Invoice> = {}): Invoice => ({ id: 'inv-1', invoice_no: 'ATH-2026-00001', created_at: '2026-10-24T10:00:00Z', enrollment_id: 'en1', program_id: 'p1', user_id: 'u1', customer_name: 'سارة أحمد', customer_email: 'sara@example.com', description: 'رسوم التسجيل: دبلوم', currency: 'SAR', subtotal: 13913.04, vat_rate: 15, vat_amount: 2086.96, total: 16000, status: 'unpaid', method: 'bank_transfer', due_date: '2026-10-31', lang: 'ar', ...x });

test('payments: money + labels', () => {
  assert.equal(money(16000, 'SAR', 'ar'), '16,000.00 ر.س'); assert.equal(money('16000', 'sar', 'en'), 'SAR 16,000.00'); assert.equal(money(99.5, 'USD', 'en'), 'USD 99.50'); assert.equal(money(null, 'SAR', 'ar'), '0.00 ر.س');
  assert.equal(Object.keys(INV_STATUS).length, 6); assert.equal(invStatusLabel('under_review', 'ar'), 'إيصال قيد المراجعة'); assert.equal(invStatusLabel('paid', 'en'), 'Paid'); assert.equal(invStatusLabel('zzz', 'ar'), 'zzz');
  assert.match(methodLabel('card', 'ar'), /^بطاقة/); assert.equal(methodLabel(null, 'en'), '—');
});

test('payments: VAT split matches database logic', () => {
  assert.deepEqual(computeAmounts(16000, 15, true), { subtotal: 13913.04, vat: 2086.96, total: 16000 });
  assert.deepEqual(computeAmounts(1000, 15, false), { subtotal: 1000, vat: 150, total: 1150 });
  assert.deepEqual(computeAmounts(1000, 0, true), { subtotal: 1000, vat: 0, total: 1000 });
  const a = computeAmounts(1234.56, 15, true); assert.equal(a.subtotal + a.vat, a.total);
  assert.equal(toHalalas(16000), 1600000); assert.equal(toHalalas('99.99'), 9999); assert.equal(toHalalas(0.1 + 0.2), 30);
});

test('payments: IBAN + receipt path + overdue', () => {
  assert.ok(isValidIban('SA0380000000608010167519')); assert.ok(isValidIban('sa03 8000 0000 6080 1016 7519'));
  assert.ok(!isValidIban('SA038000000060801016751')); assert.ok(!isValidIban('AE070331234567890123456')); assert.ok(!isValidIban(''));
  assert.equal(formatIban('sa0380000000608010167519'), 'SA03 8000 0000 6080 1016 7519');
  const p = receiptPath('u1', 'ATH-2026-00001', 'My Receipt.PNG'); assert.match(p, /^u1\/ATH-2026-00001-\d+\.png$/);
  assert.match(receiptPath('u1', 'X', 'noext'), /\.noext$|\.jpg$/); assert.match(receiptPath('u1', 'X', 'a.b.pdf'), /\.pdf$/);
  assert.ok(isOverdue(INV(), '2026-11-01')); assert.ok(!isOverdue(INV(), '2026-10-31')); assert.ok(!isOverdue(INV({ status: 'paid' }), '2026-12-01')); assert.ok(!isOverdue(INV({ due_date: null }), '2026-12-01'));
});

test('payments: totals', () => {
  const T = totals([INV(), INV({ id: '2', status: 'paid', total: 500 }), INV({ id: '3', status: 'under_review', total: 100 }), INV({ id: '4', status: 'cancelled', total: 999 }), INV({ id: '5', status: 'waived', total: 50 })]);
  assert.deepEqual(T, { count: 5, paid: 500, outstanding: 16100, review: 1 });
  assert.deepEqual(totals([]), { count: 0, paid: 0, outstanding: 0, review: 0 });
});

test('payments: gateway verification is strict', () => {
  const inv = INV(); const good = { status: 'paid', amount: 1600000, currency: 'SAR', metadata: { invoice_id: 'inv-1' } };
  assert.deepEqual(verifyGatewayPayment(good, inv), { ok: true });
  assert.deepEqual(verifyGatewayPayment({ ...good, metadata: undefined }, inv), { ok: true }, 'metadata optional');
  assert.equal(verifyGatewayPayment(null, inv).reason, 'no_payment');
  assert.equal(verifyGatewayPayment({ ...good, status: 'failed' }, inv).reason, 'status_failed');
  assert.equal(verifyGatewayPayment({ ...good, status: 'initiated' }, inv).reason, 'status_initiated');
  assert.equal(verifyGatewayPayment({ ...good, amount: 1599999 }, inv).reason, 'amount_mismatch');
  assert.equal(verifyGatewayPayment({ ...good, currency: 'USD' }, inv).reason, 'currency_mismatch');
  assert.equal(verifyGatewayPayment({ ...good, metadata: { invoice_id: 'other' } }, inv).reason, 'invoice_mismatch');
});

test('payments: emails + sheet', () => {
  const e = invoiceEmail(INV(), 'دبلوم', 'https://x.test'); assert.match(e.subject, /ATH-2026-00001/); assert.match(e.html, /https:\/\/x\.test\/pay\/inv-1/); assert.match(e.html, /16,000\.00/); assert.match(e.html, /dir="rtl"/);
  const en = invoiceEmail(INV({ lang: 'en' }), 'Diploma', 'https://x.test'); assert.match(en.subject, /Invoice/); assert.match(en.html, /dir="ltr"/);
  const r = receiptEmail(INV({ status: 'paid', method: 'bank_transfer', paid_at: '2026-10-25T08:00:00Z' }), 'دبلوم', 'https://x.test'); assert.match(r.subject, /تأكيد|سداد/); assert.match(r.html, /\/pay\/inv-1/);
  const s = invoicesSheet([{ ...INV(), program_name: 'دبلوم' }, INV({ id: '2', status: 'paid', paid_at: '2026-10-25T08:00:00Z' })]);
  assert.equal(s.rows.length, 3); assert.equal(s.rows[1].length, s.rows[0].length); assert.equal(s.widths.length, s.rows[0].length); assert.ok(s.rows[1].includes('ATH-2026-00001')); assert.equal(s.rows[2][9], invStatusLabel('paid', 'ar')); assert.equal(s.rows[2][11], '2026-10-25'); assert.equal(s.rows[1][4], 'دبلوم');
});

test('payments: portrait PDF wrapper is well-formed', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); const pdf = jpegToPortraitPdf(jpeg, 1654, 2339, 'Invoice ATH-2026-00001 فاتورة');
  const txt = new TextDecoder('latin1').decode(pdf);
  assert.ok(txt.startsWith('%PDF-1.4')); assert.match(txt, /MediaBox \[0 0 595\.28 841\.89\]/); assert.match(txt, /\/Width 1654 \/Height 2339/); assert.match(txt, /\/DCTDecode/); assert.match(txt, /\/Title <FEFF/); assert.ok(txt.trimEnd().endsWith('%%EOF'));
  const start = Number(txt.match(/startxref\n(\d+)/)![1]); assert.equal(txt.slice(start, start + 4), 'xref');
  for (const m of txt.matchAll(/(\d{10}) 00000 n/g)) { const off = Number(m[1]); assert.match(txt.slice(off, off + 12), /^\d+ 0 obj/); }
});
