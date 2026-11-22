// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-2 (د) — «رابط باسمك»: التطبيع · القواعد · المحجوز
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlug, slugIssue, SLUG_MAX } from '../lib/directory/registry';

test('التطبيع: مسافات وشرطات سفلية → شرطات؛ أحرف كبيرة → صغيرة؛ حذف غير اللاتيني؛ قصّ الطول', () => {
  assert.equal(normalizeSlug('  Ahmed Abdelaziz '), 'ahmed-abdelaziz');
  assert.equal(normalizeSlug('ahmed__abdel--aziz'), 'ahmed-abdel-aziz');
  assert.equal(normalizeSlug('أحمد ahmed!'), 'ahmed');
  assert.equal(normalizeSlug('-a-'), 'a');
  assert.equal(normalizeSlug('x'.repeat(60)).length, SLUG_MAX);
});

test('القواعد: الطول · الصيغة · المحجوز · بادئة member-', () => {
  assert.equal(slugIssue('ahmed-abdelaziz'), null);
  assert.equal(slugIssue('dr-ahmed-2026'), null);
  assert.match(slugIssue('ab')!, /3 أحرف/);
  assert.match(slugIssue('admin')!, /محجوز/);
  assert.match(slugIssue('experts')!, /محجوز/);
  assert.match(slugIssue('member-ue2x')!, /member-/);
  assert.match(slugIssue('ahmed_abdelaziz')!, /حروف لاتينية/);
  assert.match(slugIssue('-ahmed')!, /حروف لاتينية/);
});
