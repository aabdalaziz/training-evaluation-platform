// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-3 و — أقسام مركز القيادة: «الكلّ لا يرى الكلّ»
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WINGS, wingsFor, wingsOfHref, resolveWing, hrefsInWing, unassignedRooms, roomsOfWing, isShared } from '../lib/portal/wings';

const ROOT = path.resolve(__dirname, '..'); const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('خمسة أقسام بأسماء «… أَثَر»، وكلّ غرفة في الخريطة لها قسم أو مشتركة', () => {
  assert.deepEqual(WINGS.map(w => w.key), ['programs', 'assess', 'quality', 'people', 'system']);
  WINGS.forEach(w => assert.match(w.name, /أَثَر$/));
  assert.deepEqual(unassignedRooms(), [], 'غرف بلا قسم');
  WINGS.forEach(w => assert.ok(roomsOfWing(w).length >= 3, `${w.name} فيه غرف`));
});

test('الصلاحيات تفتح أقسامًا لا قوائم: مصحّح مِعيار يرى تقييم أَثَر فقط؛ المدير الكامل يرى الخمسة', () => {
  const rater = wingsFor(['miaar.rate'], true);
  assert.deepEqual(rater.map(w => w.key), ['assess']);
  assert.deepEqual(wingsFor(['*'], true).length, 5);
  const fin = wingsFor(['payments.write'], true); assert.ok(fin.some(w => w.key === 'people'));
  assert.deepEqual(wingsFor(null, false), []);
});

test('داخل القسم لا يظهر غيره + المشتركة؛ الغرفة ذات القسمين تتبع آخر قسم فتحته', () => {
  const quality = WINGS.find(w => w.key === 'quality')!; const assess = WINGS.find(w => w.key === 'assess')!;
  const vis = hrefsInWing(assess, ['/admin/miaar', '/admin/payments', '/admin/sign', '/reports', '/help']);
  assert.deepEqual(vis, ['/admin/miaar', '/admin/sign', '/help']);
  assert.ok(isShared('/admin/notifications'));
  assert.deepEqual(wingsOfHref('/admin/evidence').map(w => w.key), ['assess', 'quality']);
  assert.equal(resolveWing('/admin/evidence', [assess, quality], 'quality')?.key, 'quality');
  assert.equal(resolveWing('/admin/evidence', [assess, quality], null)?.key, 'assess');
  assert.equal(resolveWing('/admin/miaar/rating', [assess, quality], 'quality')?.key, 'assess', 'غرفة بقسم واحد تفرض قسمها');
  assert.equal(resolveWing('/admin/sign', [assess, quality], null), null, 'غرفة مشتركة بلا آخر قسم ومع أكثر من قسم → الردهة');
  assert.equal(resolveWing('/admin/sign', [assess], null)?.key, 'assess', 'قسم واحد → مباشرة');
  assert.equal(wingsOfHref('/admin/whatever-new')[0].key, 'system', 'غرفة إدارية غير مصنَّفة → أضيق باب');
});

test('البنية: الردهة في لوحة القيادة، وألسنة الغرف مقيَّدة بالقسم، والقسم في مسار الغلاف', () => {
  const db = R('app/dashboard/page.tsx');
  assert.ok(db.includes('function Lobby(') && db.includes('data-testid="command-lobby"') && db.includes('data-testid="command-side-lobby"'));
  assert.ok(db.includes("mine.length === 1 ? mine[0] : null"), 'قسم واحد → دخول مباشر');
  assert.ok(db.includes('hrefsInWing(wing, all.map(r => r.href))'), 'غرف القائمة الجانبية من القسم');
  assert.ok(db.includes('VIEWS_BY_WING[wing.key].includes(n.id)'));
  const tabs = R('app/components/PortalAdminTabs.tsx');
  assert.ok(tabs.includes('data-testid="pat-wing"') && tabs.includes('hrefsInWing(wing, allowed.map(t => t.href))') && tabs.includes('writeLastWing(wing.key)'));
  const shell = R('app/components/AdminShell.tsx'); assert.ok(shell.includes('data-testid="as-wing"'));
});
