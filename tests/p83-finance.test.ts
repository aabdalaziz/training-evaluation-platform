// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P83 — اختبارات المالية: قراءة الإيصال (عربي/إنجليزي/أرقام عربية)، المطابقة، التنظيف، المقاعد، جاهزية البوّابة */
import test from 'node:test';
import assert from 'node:assert/strict';
import { latinDigits, parseDate, parseAmounts, parseReceipt, matchReceipt, sanitizeParsed, receiptMeta, seatCounts, gatewayStatus } from '../lib/finance/receipt';

const AR = `مصرف الراجحي
تحويل محلي ناجح
المبلغ: ١٬١٥٠٫٠٠ ر.س
إلى حساب: SA03 8000 0000 6080 1016 7519
اسم المستفيد: بوابة التميز للاستشارات والتدريب
رقم المرجع: FT26331ABCD9
التاريخ: ٢٧/١١/٢٠٢٦ ١٠:٢٢
الرسوم: ٠٫٠٠ ر.س`;
const EN = `SNB AlAhli
Transfer successful
Amount SAR 1,150.00
Beneficiary IBAN SA0380000000608010167519
Reference 2026112712345678
Date 27 Nov 2026`;
const inv = { total: 1150, currency: 'SAR', created_at: '2026-11-20T08:00:00Z', due_date: '2026-11-30' };
const settings = { iban: 'SA0380000000608010167519' };

test('latinDigits + parseDate handle Arabic-Indic digits and several formats', () => {
  assert.equal(latinDigits('١٬١٥٠٫٠٠'), '1,150.00');
  assert.equal(parseDate('التاريخ ٢٧/١١/٢٠٢٦'), '2026-11-27');
  assert.equal(parseDate('2026-11-27 10:22'), '2026-11-27');
  assert.equal(parseDate('27 Nov 2026'), '2026-11-27');
  assert.equal(parseDate('27 نوفمبر 2026'), '2026-11-27');
  assert.equal(parseDate('Nov 27, 2026'), '2026-11-27');
  assert.equal(parseDate('لا تاريخ هنا 0500000000'), null);
});

test('parseAmounts ignores phones/references and prefers keyed amounts', () => {
  const a = parseAmounts('جوال 0551234567\nالمبلغ 1,150.00 ريال\nرقم المرجع 2026112712345678');
  assert.deepEqual(a.map(x => x.value), [1150]);
  assert.equal(parseReceipt(AR).amount, 1150); assert.equal(parseReceipt(EN).amount, 1150);
});

test('parseReceipt extracts bank/iban/ref/date in Arabic and English receipts', () => {
  const p = parseReceipt(AR);
  assert.equal(p.bank, 'مصرف الراجحي'); assert.equal(p.iban, 'SA0380000000608010167519'); assert.equal(p.iban_tail, '7519'); assert.equal(p.ref, 'FT26331ABCD9'); assert.equal(p.date, '2026-11-27'); assert.equal(p.currency, 'SAR'); assert.ok(p.confidence >= 90);
  const e = parseReceipt(EN);
  assert.equal(e.bank, 'البنك الأهلي السعودي'); assert.equal(e.ref, '2026112712345678'); assert.equal(e.date, '2026-11-27'); assert.equal(e.iban_tail, '7519');
});

test('matchReceipt: match / partial / mismatch', () => {
  const m = matchReceipt(parseReceipt(AR), inv, settings, '2026-11-28'); assert.equal(m.verdict, 'match'); assert.ok(m.score >= 90);
  const partial = matchReceipt({ ...parseReceipt(AR), iban: null, iban_tail: null, ref: null }, inv, settings, '2026-11-28'); assert.equal(partial.verdict, 'partial');
  const wrongAmount = matchReceipt({ ...parseReceipt(AR), amount: 1000 }, inv, settings, '2026-11-28'); assert.equal(wrongAmount.verdict, 'mismatch'); assert.equal(wrongAmount.checks.find(c => c.key === 'amount')!.ok, false);
  const wrongIban = matchReceipt({ ...parseReceipt(AR), iban: 'SA0310000000000000000001', iban_tail: '0001' }, inv, settings, '2026-11-28'); assert.equal(wrongIban.verdict, 'mismatch');
  const oldDate = matchReceipt({ ...parseReceipt(AR), date: '2026-10-01' }, inv, settings, '2026-11-28'); assert.equal(oldDate.verdict, 'mismatch');
  const near = matchReceipt({ ...parseReceipt(AR), amount: 1149.5 }, inv, settings, '2026-11-28'); assert.equal(near.verdict, 'match');
  const noIbanSetting = matchReceipt(parseReceipt(AR), inv, { iban: '' }, '2026-11-28'); assert.equal(noIbanSetting.verdict, 'match', 'ref present → match without configured IBAN');
});

test('sanitizeParsed rejects junk and bounds values; receiptMeta is text-only', () => {
  assert.equal(sanitizeParsed(null), null);
  const s = sanitizeParsed({ amount: '1150.004', date: '2026-11-27', ref: 'ft26331abcd9; drop table', iban: 'sa0380000000608010167519', bank: 'x'.repeat(200), confidence: 999 })!;
  assert.equal(s.amount, 1150); assert.equal(s.ref, null); assert.equal(s.iban, 'SA0380000000608010167519'); assert.equal(s.bank!.length, 60); assert.equal(s.confidence, 100);
  const meta = receiptMeta(parseReceipt(AR), matchReceipt(parseReceipt(AR), inv, settings, '2026-11-28'));
  assert.equal(meta.verdict, 'match'); assert.ok(!('amounts' in meta)); assert.ok(typeof meta.at === 'string');
});

test('seatCounts + gatewayStatus', () => {
  assert.deepEqual(seatCounts([{ seat_status: 'held' }, { seat_status: 'confirmed' }, { seat_status: 'confirmed' }, { seat_status: 'none' }, {}]), { held: 1, confirmed: 2, released: 0 });
  const g = gatewayStatus({ pk: 'pk_live_x', sk: 'sk_live_x', wh: 's' }, { card_enabled: true }, { ok: true, note: 'متّصل' }, { at: '2026-11-27T00:00:00Z', secret_ok: true });
  assert.equal(g.ready, true); assert.equal(g.mode, 'live'); assert.equal(g.steps_ar.length, 6);
  const g2 = gatewayStatus({ pk: 'pk_test_x', sk: 'sk_test_x' }, { card_enabled: false }, { ok: true, note: '' }, { at: null, secret_ok: null });
  assert.equal(g2.ready, false); assert.equal(g2.mode, 'test'); assert.equal(g2.steps_ar[3].ok, false); assert.equal(g2.steps_ar[4].ok, null);
});
