import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, canOpen, roomFor, navRooms, sideRooms } from '../lib/portal/rooms';
import { SYSTEM_ROLES } from '../lib/portal/roles';

const permsOf = (...codes: string[]) => [...new Set(codes.flatMap(c => SYSTEM_ROLES.find(r => r.code === c)?.permissions || []))].sort();
const FIN = permsOf('FINANCE_MANAGER'); const EXEC = permsOf('EXEC_PROGRAMS'); const PART = permsOf('PARTICIPANT');

test('P43-ب rooms: every room has a unique href, a label and at least one permission', () => {
  const hrefs = ROOMS.map(r => r.href);
  assert.equal(new Set(hrefs).size, hrefs.length, 'hrefs unique');
  for (const r of ROOMS) { assert.ok(r.label.length > 1, r.href + ' label'); assert.ok(r.perms.length >= 1, r.href + ' perms'); }
  assert.ok(ROOMS.filter(r => r.nav).length === 9, 'nine nav rooms as before');
  assert.ok(ROOMS.filter(r => r.side).length === 24, '24 dashboard side rooms (P49-هـ أضافت «نبض البيئة التدريبية»)');
});

test('P43-ب canOpen: * opens all · staff opens staff rooms · named permission or namespace wildcard', () => {
  assert.equal(canOpen({ perms: ['admin'] }, ['*'], true), true);
  assert.equal(canOpen({ perms: ['admin'] }, FIN, true), false, 'admin rooms stay closed to staff');
  assert.equal(canOpen({ perms: ['staff'] }, FIN, true), true);
  assert.equal(canOpen({ perms: ['staff'] }, PART, false), false);
  assert.equal(canOpen({ perms: ['payments.write'] }, FIN, false), true, 'named permission');
  assert.equal(canOpen({ perms: ['org.members'] }, ['org.*'], false), true, 'namespace wildcard');
  assert.equal(canOpen({ perms: ['reports.read'] }, PART, false), false);
});

test('P43-ب roomFor: exact, nested, legacy alias and /reports fallback; unknown → undefined', () => {
  assert.equal(roomFor('/admin/payments')?.label, 'المالية');
  assert.equal(roomFor('/admin/miaar/bank')?.href, '/admin/miaar');
  assert.equal(roomFor('/admin/factory')?.href, '/admin/program-engineering', 'legacy alias');
  assert.equal(roomFor('/reports/whatever')?.href, '/reports');
  assert.equal(roomFor('/admin/not-a-room'), undefined);
});

test('P43-ب navRooms: admin 9 · finance ≤ 6 with المالية and without نقل الأثر · exec keeps her nav rooms · null perms = legacy 9', () => {
  assert.equal(navRooms(['*'], true).length, 9);
  assert.equal(navRooms(null, false).length, 9);
  const fin = navRooms(FIN, true).map(r => r.href);
  assert.ok(fin.length >= 4 && fin.length <= 6, 'finance bar 4..6: ' + fin.join());
  assert.ok(fin.includes('/admin/payments') && fin.includes('/dashboard') && !fin.includes('/admin/followup'), fin.join());
  const ex = navRooms(EXEC, true).map(r => r.href);
  assert.ok(ex.includes('/admin/followup') && ex.includes('/admin/management') && !ex.includes('/admin/data-lifecycle'), ex.join());
  assert.equal(navRooms(PART, false).length, 0, 'participant has no command rooms');
});

test('P43-ب sideRooms: admin 24 · finance a short list without audit/backup', () => {
  assert.equal(sideRooms(['*'], true).length, 24);
  const fin = sideRooms(FIN, true).map(r => r.href);
  assert.ok(fin.length > 0 && fin.length <= 8 && !fin.includes('/admin/audit') && !fin.includes('/admin/backup'), fin.join());
  assert.equal(sideRooms(null, true).length, 24, 'before permissions load: all');
});
