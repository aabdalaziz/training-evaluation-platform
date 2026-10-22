import test from 'node:test';
import assert from 'node:assert/strict';
import { attendancePct, attendanceTone, buildTasks, isRunning, type MeProgram } from '../lib/me/model';

const prog = (over: Partial<MeProgram> = {}): MeProgram => ({
  id: 'p1', name_ar: 'برنامج', name_en: null, status: 'ACTIVE', start_date: '2026-10-01', end_date: '2026-11-30', is_final_open: false, delivery_mode: 'onsite',
  attendance: { sessions: 10, present: 7, late: 1, excused: 1 }, open_sessions: [], evals: { daily: 3, final: 0, last_at: '2026-10-22T06:00:00Z' },
  impact: [], followups: [], certificates: [], ...over,
});

test('attendancePct excludes excused sessions and counts late as present', () => {
  assert.equal(attendancePct({ sessions: 10, present: 7, late: 1, excused: 1 }), 89);
  assert.equal(attendancePct({ sessions: 0, present: 0, late: 0, excused: 0 }), null);
  assert.equal(attendancePct({ sessions: 2, present: 0, late: 0, excused: 2 }), null);
  assert.equal(attendanceTone(89), 'ok'); assert.equal(attendanceTone(65), 'warn'); assert.equal(attendanceTone(20), 'bad'); assert.equal(attendanceTone(null), 'none');
});

test('isRunning respects dates and cancelled status', () => {
  assert.equal(isRunning(prog(), '2026-10-23'), true);
  assert.equal(isRunning(prog(), '2026-12-23'), false);
  assert.equal(isRunning(prog({ start_date: '2026-11-01' }), '2026-10-23'), false);
  assert.equal(isRunning(prog({ status: 'CANCELLED' }), '2026-10-23'), false);
});

test('buildTasks: attendance, daily (not done today), final, impact, followup — urgent first', () => {
  const p = prog({
    open_sessions: [{ token: 'AAA', title: 'اليوم 3', session_date: '2026-10-23', checked: false }, { token: 'BBB', title: 'اليوم 2', session_date: '2026-10-22', checked: true }],
    impact: [{ token: 'IMP1', title_ar: 'أداة', pre_open: true, post_open: false }],
    followups: [{ token: 'FU1', title_ar: 'متابعة', answered: false }, { token: 'FU2', title_ar: 'متابعة 2', answered: true }],
    is_final_open: true,
  });
  const tasks = buildTasks({ programs: [p], today: '2026-10-23' });
  const kinds = tasks.map(t => t.kind);
  assert.deepEqual(kinds.filter(k => k === 'attend').length, 1);
  assert.ok(kinds.includes('daily')); assert.ok(kinds.includes('final')); assert.ok(kinds.includes('impact_pre')); assert.ok(kinds.includes('followup'));
  assert.equal(tasks.filter(t => t.kind === 'followup').length, 1);
  assert.ok(tasks[0].urgent && !tasks[tasks.length - 1].urgent);
  assert.equal(tasks.find(t => t.kind === 'attend')!.href, '/attend/AAA');
  assert.equal(tasks.find(t => t.kind === 'followup')!.href, '/followup/FU1?role=trainee');
});

test('buildTasks: no daily when evaluated today, no final when done, none for ended program', () => {
  const done = prog({ evals: { daily: 1, final: 1, last_at: '2026-10-23T05:00:00Z' }, is_final_open: true });
  assert.deepEqual(buildTasks({ programs: [done], today: '2026-10-23' }), []);
  const ended = prog({ end_date: '2026-10-01', impact: [{ token: 'I', title_ar: 'x', pre_open: true, post_open: true }] });
  const t = buildTasks({ programs: [ended], today: '2026-10-23' });
  assert.deepEqual(t.map(x => x.kind), ['impact_post']);
});
