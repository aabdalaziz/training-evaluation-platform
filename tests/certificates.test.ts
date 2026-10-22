/**
 * Tests for certificates (QR encoder, PDF writer) and trainer-award rules.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrSvg } from '../lib/certificates/qr';
import { jpegsToPdf } from '../lib/certificates/render';
import { computeAwards, winners, periodKey, periodLabel, monthRange, previousRange, DEFAULT_RULES } from '../lib/awards/rules';
import type { GroupRow } from '../lib/reports/analytics';

// Reference matrix generated with the Python `qrcode` library (byte mode, border 0).
// 'hello' requested at ECC L fits version 1 at ECC H, so the encoder boosts to H (same as the spec recommends).
const REF_HELLO_L_M0 = [
  '111111101101101111111', '100000100101101000001', '101110100001001011101', '101110101101101011101', '101110100100101011101', '100000100100101000001', '111111101010101111111',
  '000000000010100000000', '001011101011010001001', '010110001001110000011', '110010101010010011111', '000101000010000000010', '000110101101011010000', '000000001111010100111',
  '111111100110010100111', '100000101000101110000', '101110101101100100011', '101110100101000100110', '101110101110001010101', '100000100010010010010', '111111100110001100011',
];

describe('QR encoder', () => {
  test('matches reference matrix (v1, ECC L→boosted H, mask 0)', () => {
    const m = qrMatrix('hello', 'L', 0);
    assert.equal(m.version, 1); assert.equal(m.size, 21);
    const rows = m.modules.map(r => r.map(c => (c ? '1' : '0')).join(''));
    assert.deepEqual(rows, REF_HELLO_L_M0);
  });
  test('finder patterns present and auto mask in range', () => {
    const m = qrMatrix('https://training-evaluation-platform.vercel.app/verify/9F3KQ27XVB');
    assert.ok(m.mask >= 0 && m.mask <= 7);
    for (const [x, y] of [[0, 0], [6, 6], [m.size - 7, 0], [0, m.size - 7]]) assert.equal(m.get(x, y), true);
    assert.equal(m.get(3, 3), true); assert.equal(m.get(1, 1), false);
  });
  test('UTF-8 Arabic text and long payload (version bits ≥ 7)', () => {
    assert.equal(qrMatrix('شهادة إتمام برنامج تدريبي 2026', 'H', 7).version, 6);
    const big = qrMatrix('a'.repeat(700), 'L');
    assert.ok(big.version >= 7); assert.equal(big.size, big.version * 4 + 17);
  });
  test('capacity overflow throws', () => { assert.throws(() => qrMatrix('x'.repeat(5000), 'H')); });
  test('svg output', () => { const s = qrSvg('abc', 100); assert.ok(s.startsWith('<svg')); assert.ok(s.includes('<path')); });
});

describe('PDF writer', () => {
  test('produces a valid multi-page PDF structure', () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const pdf = jpegsToPdf([{ jpeg: fakeJpeg, w: 10, h: 5 }, { jpeg: fakeJpeg, w: 10, h: 5 }], 'شهادات');
    const txt = Buffer.from(pdf).toString('latin1');
    assert.ok(txt.startsWith('%PDF-1.4'));
    assert.ok(txt.includes('/Type /Pages /Kids [4 0 R 7 0 R] /Count 2'));
    assert.ok(txt.includes('/Filter /DCTDecode'));
    assert.ok(txt.includes('/Title <FEFF'));
    assert.ok(txt.trim().endsWith('%%EOF'));
    const startxref = Number(txt.match(/startxref\n(\d+)/)![1]);
    assert.equal(txt.slice(startxref, startxref + 4), 'xref');
    assert.ok(txt.includes('0 10\n0000000000 65535 f'));
  });
});

function row(key: string, label: string, mean: number, responses: number, sd = 0.5): GroupRow {
  return { key, label, n: responses * 8, mean, median: mean, sd, min: 1, max: 5, lowPct: 5, neutralPct: 20, highPct: 75, dist: [0, 0, 0, 0, 0], responses, participants: responses, gap: 4.2 - mean, perf: 'GOOD', risk: 'LOW', delta: null };
}
describe('Trainer awards rules', () => {
  const cur = [row('t1', 'أحمد', 4.6, 40, 0.4), row('t2', 'سارة', 4.3, 60, 0.3), row('t3', 'محمد', 3.9, 8, 0.9), row('', 'بدون مدرب', 4.9, 100)];
  const prev = [row('t1', 'أحمد', 4.5, 30), row('t2', 'سارة', 3.8, 50), row('t3', 'محمد', 4.2, 20)];
  const c = computeAwards(cur, prev, DEFAULT_RULES);
  test('top_mean ranks by mean and excludes empty key', () => {
    const top = c.filter(x => x.category === 'top_mean');
    assert.equal(top[0].trainer_id, 't1'); assert.ok(!top.some(x => x.trainer_id === ''));
    assert.equal(top.find(x => x.trainer_id === 't3')?.eligible, false);
  });
  test('most_improved uses previous period delta', () => {
    const imp = c.filter(x => x.category === 'most_improved');
    assert.equal(imp[0].trainer_id, 't2'); assert.ok(Math.abs(imp[0].metric_value - 0.5) < 1e-9);
    assert.ok(!imp.some(x => x.trainer_id === 't3')); // declined
  });
  test('most_engaged by responses; most_consistent by sd with min mean', () => {
    assert.equal(c.find(x => x.category === 'most_engaged')!.trainer_id, 't2');
    const cons = c.filter(x => x.category === 'most_consistent'); assert.equal(cons[0].trainer_id, 't2'); assert.equal(cons.find(x => x.trainer_id === 't3')?.eligible, false);
  });
  test('winners: one per category, max 2 per trainer', () => {
    const w = winners(c);
    assert.equal(w.length, 4);
    const counts = new Map<string, number>(); w.forEach(x => counts.set(x.trainer_id, (counts.get(x.trainer_id) || 0) + 1));
    for (const v of counts.values()) assert.ok(v <= 2);
    assert.equal(w.find(x => x.category === 'top_mean')!.trainer_id, 't1');
  });
  test('period helpers', () => {
    assert.equal(periodKey('2026-10-01', '2026-10-31'), '2026-10');
    assert.equal(periodLabel('2026-10-01', '2026-10-31'), 'أكتوبر 2026');
    assert.deepEqual(monthRange('2026-02-15'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(previousRange('2026-10-01', '2026-10-31'), { from: '2026-08-31', to: '2026-09-30' });
  });
});
