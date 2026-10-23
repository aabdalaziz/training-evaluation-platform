import test from 'node:test';
import assert from 'node:assert/strict';
import { scopeOf, canSee, diffAssignments, accessMatrix, accessCsv, filterPrograms, roleLabel } from '../lib/access/model';
import type { Assignment } from '../lib/access/model';

const A: Assignment[] = [{ profile_id: 'm1', program_id: 'p1' }, { profile_id: 'm1', program_id: 'p2' }, { profile_id: 'm1', program_id: 'p2' }];
const programs = [{ id: 'p1', name_ar: 'أ' }, { id: 'p2', name_ar: 'ب' }, { id: 'p3', name_ar: 'ج' }];

test('access: scopeOf per role', () => {
  assert.equal(scopeOf('PLATFORM_ADMIN', A, 'x').kind, 'all');
  assert.equal(scopeOf('quality_analyst', A, 'x').kind, 'all');
  const s = scopeOf('PROGRAM_MANAGER', A, 'm1'); assert.equal(s.kind, 'subset'); assert.deepEqual(s.programIds, ['p1', 'p2']);
  assert.equal(scopeOf('PROGRAM_MANAGER', A, 'm2').kind, 'all');       // بلا ربط = الكل
  assert.equal(scopeOf('TRAINEE', A, 'm1').kind, 'none'); assert.equal(scopeOf(null, A, 'm1').kind, 'none');
  assert.equal(roleLabel('PROGRAM_MANAGER'), 'مدير برنامج');
});

test('access: canSee + filterPrograms', () => {
  const s = scopeOf('PROGRAM_MANAGER', A, 'm1');
  assert.equal(canSee(s, 'p1'), true); assert.equal(canSee(s, 'p3'), false); assert.equal(canSee(s, null), false);
  assert.equal(canSee(scopeOf('ADMIN', A, 'z'), null), true); assert.equal(canSee(scopeOf('TRAINEE', A, 'z'), 'p1'), false);
  assert.deepEqual(filterPrograms(programs, s).map(p => p.id), ['p1', 'p2']);
  assert.equal(filterPrograms(programs, scopeOf('ADMIN', A, 'z')).length, 3);
});

test('access: diffAssignments computes minimal add/remove', () => {
  const d = diffAssignments('m1', A, ['p2', 'p3']);
  assert.deepEqual(d.add, [{ profile_id: 'm1', program_id: 'p3' }]); assert.deepEqual(d.remove, [{ profile_id: 'm1', program_id: 'p1' }]);
  const e = diffAssignments('m1', A, []); assert.equal(e.add.length, 0); assert.equal(e.remove.length, 2);
  const n = diffAssignments('m9', A, ['p1']); assert.equal(n.add.length, 1); assert.equal(n.remove.length, 0);
});

test('access: accessMatrix sorts managers first and resolves names; csv', () => {
  const profiles = [{ id: 'a1', full_name: 'أدمن', email: 'a@x', role: 'ADMIN' }, { id: 'm1', full_name: 'منى', email: 'm@x', role: 'PROGRAM_MANAGER' }, { id: 'm2', full_name: 'خالد', email: 'k@x', role: 'program_manager' }];
  const m = accessMatrix(profiles, [...A, { profile_id: 'm2', program_id: 'gone' }], programs);
  assert.equal(m[0].role, 'PROGRAM_MANAGER'); assert.equal(m[2].role, 'ADMIN');
  const mona = m.find(r => r.profile.id === 'm1')!; assert.deepEqual(mona.programs.map(p => p.name_ar), ['أ', 'ب']);
  const kh = m.find(r => r.profile.id === 'm2')!; assert.equal(kh.scope.kind, 'subset'); assert.ok(kh.programs[0].name_ar?.includes('محذوف'));
  const csv = accessCsv(m); assert.equal(csv.length, 4); assert.ok(csv.some(r => r[4] === 'أ | ب'));
});
