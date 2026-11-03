// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «الطريق» — فتات المسار والرجوع والإظهار */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crumbsFor, parentOf, showWay, looksLikeId, updateStack } from '../lib/portal/way';

test('الطريق: فتات عربية بالأسماء الرسمية، والمركّب يسبق المفرد', () => {
  assert.deepEqual(crumbsFor('/miaar/result/ML-AB12-CD34').map((c) => c.label), ['الرئيسية', 'مِعيار', 'النتيجة', 'التفاصيل'], 'رمز النتيجة لا يُعرض');
  assert.deepEqual(crumbsFor('/admin/miaar/bank').map((c) => c.label), ['الرئيسية', 'الإدارة', 'مِعيار', 'بنك البنود']);
  assert.deepEqual(crumbsFor('/admin/miaar/rating', 'en').map((c) => c.label), ['Home', 'Admin', 'Mi‘yar', 'Rating']);
  const c = crumbsFor('/me/skills'); assert.equal(c[c.length - 1].current, true); assert.equal(c[0].href, '/'); assert.equal(c[1].href, '/me');
  assert.deepEqual(crumbsFor('/programs/some-program-slug').map((c) => c.label), ['الرئيسية', 'البرامج', 'some program slug'], 'المقطع المجهول يُقرأ');
});
test('الطريق: الأب والإظهار والمعرّفات', () => {
  assert.equal(parentOf('/admin/miaar/bank'), '/admin/miaar'); assert.equal(parentOf('/miaar'), '/'); assert.equal(parentOf('/'), '/');
  assert.equal(showWay('/'), false, 'الرئيسية بلا شريط'); assert.equal(showWay('/dashboard/x'), false, 'لوحة التحكم لها قائمتها'); assert.equal(showWay('/miaar'), true);
  assert.ok(looksLikeId('ML-AB12-CD34') && looksLikeId('3f2a9c10-1b2c-4d5e-8f90-aabbccddeeff') && looksLikeId('12345') && looksLikeId('abcdefghijklmnopqrstuvwxyz012345'));
  assert.equal(looksLikeId('bank'), false); assert.equal(looksLikeId('miaar'), false);
});
test('الطريق: المقاطع بلا صفحة لا تُربَط ولا يُرجَع إليها (كانت 404)', () => {
  const c = crumbsFor('/miaar/result/ML-AB12-CD34'); assert.equal(c[2].dead, true, '/miaar/result مجلّد فقط'); assert.equal(c[1].dead, undefined, '/miaar صفحة');
  assert.equal(parentOf('/miaar/result/ML-AB12-CD34'), '/miaar'); assert.equal(parentOf('/credential/ABC'), '/'); assert.equal(parentOf('/live/copilot/7'), '/live'); assert.equal(parentOf('/m/confirm/tok'), '/');
  assert.equal(parentOf('/admin/miaar'), '/admin', '/admin صار صفحة (تحويل إلى الردهة)');
});
test('الطريق: سجلّ التبويب يميّز الرجوع عن التقدّم', () => {
  let st = updateStack([], '/'); st = updateStack(st, '/services'); st = updateStack(st, '/programs'); assert.deepEqual(st, ['/', '/services', '/programs']);
  st = updateStack(st, '/services'); assert.deepEqual(st, ['/', '/services'], 'العودة لما قبلها = رجوع (pop)');
  st = updateStack(st, '/services'); assert.equal(st.length, 2, 'التكرار لا يُضاف'); assert.equal(updateStack(Array.from({ length: 60 }, (_, i) => `/p${i}`), '/x').length, 40, 'سقف 40');
});
