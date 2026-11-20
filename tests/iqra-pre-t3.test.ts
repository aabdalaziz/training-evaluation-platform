/* ت٣ (2026-11-20) — سقف التمهيديّ 40 · استيراد فوق حلقة معتمدة بخيار «تحديث المعتمدة» يُبقيها معتمدة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IQRA_LIMITS, itemsMaxFor } from '../lib/iqra/registry';
import { normalizePack, unitLevel } from '../lib/iqra/content';
import { importPack, setLessonStatus } from '../lib/iqra/store';
import { fakeDb } from './iqra-fake-db';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const STAFF = { email: 'admin@athar-portal.com', id: 'u1' };
const UNIT = (code: string) => ({ code, level: unitLevel(code), idx: Number(code.slice(-2)), title_ar: `منزلة ${code}`, title_en: code, focus_ar: 'تركيز', domains: ['personal'], descriptor_codes: [], status: 'approved' });

test('ت٣ — السقف بحسب المستوى: التمهيديّ 40 والبقيّة 30 · الهدف 30 والسحب 10 لم يتغيّرا', () => {
  assert.equal(IQRA_LIMITS.items_per_lesson_max, 30); assert.equal(IQRA_LIMITS.items_per_lesson_max_pre_a1, 40);
  assert.equal(itemsMaxFor('PRE_A1'), 40); for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) assert.equal(itemsMaxFor(lv), 30);
  assert.equal(IQRA_LIMITS.items_per_lesson_target, 30); assert.equal(IQRA_LIMITS.draw_per_visit, 10);
});

test('ت٣ — الحزم الأربع للتمهيديّ: 40 مِرانًا بتسعة أنواع في كلّ حلقة ولا اقتطاع · حزمة A1 تُقتطع عند 30', () => {
  for (const u of ['01', '02', '03', '04']) {
    const raw = JSON.parse(read(`tools/iqra/packs/iqra-pack-PRE_A1-U${u}.json`)); const n = normalizePack(raw); assert.ok(n.ok, JSON.stringify(n));
    assert.equal(n.pack.lessons.length, 5, u);
    for (const l of n.pack.lessons) { assert.equal(l.exercises.length, 40, l.code); assert.equal(new Set(l.exercises.map((e: any) => e.kind)).size, 9, l.code); }
    assert.ok(!(n.warnings || []).some((w: any) => /يُقتطع/.test(w.msg)), `لا تحذير اقتطاع في U${u}`);
  }
  const a1 = JSON.parse(read('tools/iqra/packs/iqra-pack-2-fixture.json')); const l0 = a1.lessons[0];
  const fat = normalizePack({ ...a1, lessons: [{ ...l0, exercises: [...l0.exercises, ...l0.exercises.slice(0, 5)] }], library: [] }); assert.ok(fat.ok, JSON.stringify(fat));
  assert.equal(fat.pack.lessons[0].exercises.length, 30, 'A1 يبقى عند 30'); assert.ok((fat.warnings || []).some((w: any) => /يُقتطع/.test(w.msg)));
});

test('ت٣ — استيراد فوق حلقة معتمدة: بلا الخيار تُتخطّى · بالخيار تُحدَّث (40 بندًا معتمدًا) وتبقى معتمدة بالمعرّف نفسه · المكتبة المسوَّدة تُحدَّث كالمعتاد', async () => {
  const raw = JSON.parse(read('tools/iqra/packs/iqra-pack-PRE_A1-U01.json'));
  const db = fakeDb({ miaar_syllabus_units: ['PRE_A1-U01'].map(UNIT) });
  const thirty = { ...raw, lessons: raw.lessons.map((l: any) => ({ ...l, exercises: l.exercises.slice(0, 30) })) };
  const n30 = normalizePack(thirty); assert.ok(n30.ok, JSON.stringify(n30)); const r0 = await importPack(db, n30.pack, STAFF, 'b-t3-0'); assert.equal(r0.errors.length, 0); assert.equal(r0.lessons_created, 5);
  for (const l of db.T.iqra_lessons) { const r = await setLessonStatus(db, l.id, 'approved', STAFF, null); assert.ok(r.ok, l.code); }
  const l0 = db.T.iqra_lessons.find((x) => x.code === 'PRE_A1-U01-L01'); assert.equal(l0.item_ids.length, 30); const id0 = l0.id;
  const n40 = normalizePack(raw); assert.ok(n40.ok, JSON.stringify(n40));
  const skip = await importPack(db, n40.pack, STAFF, 'b-t3-1'); assert.equal(skip.lessons_skipped.length, 5); assert.equal(skip.lessons_updated, 0); assert.equal(skip.library_updated, (raw.library || []).length, 'المكتبة مسوَّدة فتُحدَّث');
  const rep = await importPack(db, n40.pack, STAFF, 'b-t3-2', { replaceApproved: true }); assert.equal(rep.errors.length, 0); assert.equal(rep.lessons_updated, 5); assert.equal(rep.lessons_skipped.length, 0); assert.equal(rep.items, 200);
  const l1 = db.T.iqra_lessons.find((x) => x.code === 'PRE_A1-U01-L01'); assert.equal(l1.id, id0, 'المعرّف نفسه'); assert.equal(l1.status, 'approved', 'تبقى معتمدة'); assert.equal(l1.item_ids.length, 40);
  const mine = db.T.question_bank_items.filter((r) => r.item_code.startsWith('IQ-PRE_A1-U01-L01-'));
  assert.equal(mine.filter((r) => l1.item_ids.includes(r.id)).length, 40); assert.ok(mine.filter((r) => l1.item_ids.includes(r.id)).every((r) => r.status === 'approved'), 'البنود الأربعون معتمدة');
  for (const x of db.T.iqra_library) assert.equal(x.status, 'draft', 'المكتبة الجديدة مسوَّدة كما هو معهود');
});
