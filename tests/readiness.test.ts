import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessProgram, phaseOf, daysUntil, sortByUrgency, nextAction, readinessRows, levelLabel } from '../lib/readiness/model';
import type { ReadinessInput } from '../lib/readiness/model';

const TODAY = '2026-10-23';
const base = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
  program: { id: 'p1', name_ar: 'التفويض', status: 'DRAFT', start_date: '2026-11-01', end_date: '2026-11-20', delivery_mode: 'IN_PERSON' },
  classrooms: [{ id: 'c1', program_id: 'p1', trainer_id: 't1', code: 'A-1' }],
  schedules: [{ classroom_id: 'c1', is_active: true }],
  links: [{ program_id: 'p1', template_id: 'd', is_active: true }, { program_id: 'p1', template_id: 'f', is_active: true }],
  templates: [{ id: 'd', kind: 'DAILY' }, { id: 'f', kind: 'FINAL' }],
  questions: [{ template_id: 'd' }, { template_id: 'd' }, { template_id: 'f' }],
  evaluations: [], attendance: [], certificates: [], impact: [{ program_id: 'p1' }], followups: [], kpis: [],
  today: TODAY, ...over,
});

test('phaseOf/daysUntil', () => {
  assert.equal(phaseOf({ id: 'x', name_ar: 'x', status: 'DRAFT', start_date: '2026-11-01' }, TODAY), 'before');
  assert.equal(phaseOf({ id: 'x', name_ar: 'x', status: 'ACTIVE' }, TODAY), 'during');
  assert.equal(phaseOf({ id: 'x', name_ar: 'x', status: 'DRAFT', start_date: '2026-10-01', end_date: '2026-10-30' }, TODAY), 'during');
  assert.equal(phaseOf({ id: 'x', name_ar: 'x', status: 'ACTIVE', end_date: '2026-10-01' }, TODAY), 'after');
  assert.equal(phaseOf({ id: 'x', name_ar: 'x', status: 'COMPLETED' }, TODAY), 'after');
  assert.equal(daysUntil('2026-11-01', TODAY), 9); assert.equal(daysUntil(null, TODAY), null);
});

test('برنامج قادم مكتمل الإعداد = جاهز وبنود الإغلاق غير مطبّقة', () => {
  const r = assessProgram(base());
  assert.equal(r.phase, 'before'); assert.equal(r.blockers, 0); assert.equal(r.level, 'ready');
  assert.ok(r.checks.filter(c => c.stage === 'closure').every(c => c.status === 'na'));
  assert.equal(r.checks.find(c => c.id === 'attendance')!.status, 'na');
  assert.equal(nextAction(r), null);
});

test('بلا قاعات وبلا قالب يومي = عوائق والخطوة التالية هي القاعات', () => {
  const r = assessProgram(base({ classrooms: [], links: [{ program_id: 'p1', template_id: 'f', is_active: true }] }));
  const ids = r.checks.filter(c => c.status === 'missing').map(c => c.id);
  assert.deepEqual(ids, ['rooms', 'tpl-daily']);
  assert.equal(r.checks.find(c => c.id === 'trainers')!.status, 'na');
  assert.equal(nextAction(r)!.id, 'rooms'); assert.equal(r.level, 'not');
});

test('قالب مرتبط بلا أسئلة = عائق، وقاعة بلا مدرب = تحذير', () => {
  const r = assessProgram(base({ questions: [{ template_id: 'd' }], classrooms: [{ id: 'c1', program_id: 'p1', trainer_id: 't1' }, { id: 'c2', program_id: 'p1', trainer_id: null, code: 'B-2' }] }));
  assert.equal(r.checks.find(c => c.id === 'tpl-final')!.status, 'missing');
  const tr = r.checks.find(c => c.id === 'trainers')!; assert.equal(tr.status, 'warn'); assert.ok(tr.detail.includes('B-2'));
});

test('برنامج جارٍ بلا حضور ولا تقييمات = تحذيرات؛ منتهٍ بلا ختامي = عائق', () => {
  const during = assessProgram(base({ program: { id: 'p1', name_ar: 'x', status: 'ACTIVE' } }));
  assert.equal(during.checks.find(c => c.id === 'attendance')!.status, 'warn');
  assert.equal(during.checks.find(c => c.id === 'ev-daily')!.status, 'warn');
  assert.equal(during.checks.find(c => c.id === 'ev-final')!.status, 'na');
  const after = assessProgram(base({ program: { id: 'p1', name_ar: 'x', status: 'COMPLETED' }, evaluations: [{ program_id: 'p1', kind: 'DAILY' }], attendance: [{ program_id: 'p1' }] }));
  assert.equal(after.checks.find(c => c.id === 'ev-final')!.status, 'missing');
  assert.equal(after.checks.find(c => c.id === 'certs')!.status, 'warn');
  assert.equal(after.checks.find(c => c.id === 'ev-daily')!.status, 'ok');
});

test('sortByUrgency/readinessRows', () => {
  const a = assessProgram(base({ program: { id: 'a', name_ar: 'أ', status: 'COMPLETED' } }));
  const b = assessProgram(base({ program: { id: 'b', name_ar: 'ب', status: 'DRAFT', start_date: '2026-12-01' } }));
  const c = assessProgram(base({ program: { id: 'c', name_ar: 'ج', status: 'DRAFT', start_date: '2026-10-25' } }));
  const d = assessProgram(base({ program: { id: 'd', name_ar: 'د', status: 'ACTIVE' } }));
  assert.deepEqual(sortByUrgency([a, b, c, d], TODAY).map(r => r.program.id), ['c', 'b', 'd', 'a']);
  const rows = readinessRows([c, d]);
  assert.equal(rows.length, 3); assert.equal(rows[0][0], 'البرنامج'); assert.equal(rows[0].length, 5 + c.checks.length); assert.equal(rows[1][3], levelLabel(c.level));
});
