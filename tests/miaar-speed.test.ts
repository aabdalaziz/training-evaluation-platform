// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «سرعة مِعيار» (2026-11-02): ذاكرة البنك المعتمد 90 ث + توقيع جماعي لروابط الوسائط — بلا شبكة (قاعدة مزيَّفة) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApprovedPool, loadPassages, invalidatePoolCache, mediaUrls } from '../lib/miaar/bank';

type Q = { select: () => Q; eq: () => Q; limit: () => Promise<{ data: unknown[]; error: null }> };
function fakeDb(counter: { items: number; passages: number; keys: number; signed: string[][] }) {
  const table = (name: string): Q => {
    const q: Q = { select: () => q, eq: () => q, limit: async () => { if (name === 'question_bank_items') counter.items += 1; else if (name === 'miaar_passages') counter.passages += 1; else counter.keys += 1; return { data: [], error: null }; } };
    return q;
  };
  return {
    from: (name: string) => table(name),
    storage: { from: () => ({ createSignedUrls: async (paths: string[]) => { counter.signed.push(paths); return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })), error: null }; }, createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://single/${p}` }, error: null }) }) },
  };
}

test('سرعة: البنك المعتمد يُقرأ مرة واحدة ثم من الذاكرة — والإفراغ يعيد القراءة', async () => {
  invalidatePoolCache();
  const c = { items: 0, passages: 0, keys: 0, signed: [] as string[][] }; const db = fakeDb(c);
  await loadApprovedPool(db); await loadApprovedPool(db); await loadApprovedPool(db);
  assert.equal(c.items, 1, 'استعلام البنود مرة واحدة لثلاث قراءات'); assert.equal(c.passages, 1, 'المقاطع مرة واحدة');
  invalidatePoolCache(); await loadPassages(db); await loadApprovedPool(db);
  assert.equal(c.items, 2, 'بعد الإفراغ يُقرأ من جديد'); assert.equal(c.passages, 2, 'المقاطع كذلك');
  invalidatePoolCache();
});

test('سرعة: روابط الوسائط تُوقَّع بطلب واحد — والمسارات العامة تمرّ كما هي', async () => {
  const c = { items: 0, passages: 0, keys: 0, signed: [] as string[][] }; const db = fakeDb(c);
  const m = await mediaUrls(db, ['/miaar/img/book.svg', 'audio/a1.m4a', null, 'img/x.png', 'audio/a1.m4a', 'https://cdn/x.png']);
  assert.equal(c.signed.length, 1, 'طلب توقيع واحد'); assert.deepEqual(c.signed[0], ['audio/a1.m4a', 'img/x.png'], 'المسارات المخزنية فقط وبلا تكرار');
  assert.equal(m.get('/miaar/img/book.svg'), '/miaar/img/book.svg'); assert.equal(m.get('https://cdn/x.png'), 'https://cdn/x.png');
  assert.equal(m.get('audio/a1.m4a'), 'https://signed/audio/a1.m4a'); assert.equal(m.get('img/x.png'), 'https://signed/img/x.png');
  const none = await mediaUrls(db, ['/a.svg', null]); assert.equal(c.signed.length, 1, 'بلا مسارات مخزنية لا يُرسل طلب');
  assert.equal(none.get('/a.svg'), '/a.svg', 'العام يمرّ');
});
