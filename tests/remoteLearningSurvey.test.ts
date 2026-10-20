/**
 * Unit tests for the Remote Learning Survey logic.
 * Run:  npm test
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATEMENTS, SCALE, DIFFICULTIES, ATTENDANCE, DAYS, UI, SURVEY_INTRO,
  applyFilters, buildPayload, classroomLabel, classroomsFor, compareGroups, emptyDraft,
  formatTime, groupKey, levelsForProgram, remotePrograms, responsesToCsvRows, scheduleLabel,
  schedulesFor, statementStats, summarize, summaryToCsvRows, t, todayRiyadh, toggleDifficulty,
  trainersFor, validateDraft,
  type Classroom, type Draft, type Level, type Program, type ResponseRow, type Schedule, type Trainer,
} from '../lib/surveys/remoteLearning';
import { csvString } from '../lib/export/csv';

/* ------------------------------------------------------------------ fixtures */
const programs: Program[] = [
  { id: 'p-remote', name_ar: 'العربية للناطقين بغيرها (عن بعد)', name_en: 'Arabic for non-natives (remote)', delivery_mode: 'remote' },
  { id: 'p-onsite', name_ar: 'برنامج حضوري', name_en: 'On-site program', delivery_mode: 'onsite' },
];
const levels: Level[] = [
  { id: 'l-b1', program_id: null, code: 'B1', name_ar: 'متوسط 1', name_en: 'Intermediate 1', sort_order: 3 },
  { id: 'l-a1', program_id: null, code: 'A1', name_ar: 'مبتدئ 1', name_en: 'Beginner 1', sort_order: 1 },
  { id: 'l-x', program_id: 'p-onsite', code: 'X', name_ar: 'خاص', name_en: 'Special', sort_order: 9 },
  { id: 'l-off', program_id: null, code: 'OFF', name_ar: 'معطل', name_en: 'Off', sort_order: 0, is_active: false },
];
const trainers: Trainer[] = [
  { id: 't-yasser', name: 'Dr. Yasser' },
  { id: 't-shaimaa', name: 'Dr. Shaimaa' },
  { id: 't-unused', name: 'Dr. Nobody' },
];
// Two different groups, same level, DIFFERENT trainers, SAME time slot.
const classrooms: Classroom[] = [
  { id: 'c-g1', code: 'G-1', program_id: 'p-remote', trainer_id: 't-yasser',  level_id: 'l-b1', section_name: 'A' },
  { id: 'c-g2', code: 'G-2', program_id: 'p-remote', trainer_id: 't-shaimaa', level_id: 'l-b1', section_name: null },
  { id: 'c-g3', code: 'G-3', program_id: 'p-remote', trainer_id: 't-yasser',  level_id: 'l-a1', section_name: null },
  { id: 'c-on', code: '101', program_id: 'p-onsite', trainer_id: 't-yasser',  level_id: null, level: 'متقدم' },
];
const schedules: Schedule[] = [
  { id: 's-g1-sun', classroom_id: 'c-g1', day_of_week: 0, start_time: '16:00:00', end_time: '17:40:00' },
  { id: 's-g2-sun', classroom_id: 'c-g2', day_of_week: 0, start_time: '16:00:00', end_time: '17:40:00' }, // identical time to G-1
  { id: 's-g1-tue', classroom_id: 'c-g1', day_of_week: 2, start_time: '16:00:00', end_time: '17:40:00' },
  { id: 's-g3-mon', classroom_id: 'c-g3', day_of_week: 1, start_time: '19:00:00', end_time: '20:30:00', is_active: false },
];
const ctx = { programs, levels, trainers, classrooms, schedules, lang: 'ar' as const };

function fullDraft(over: Partial<Draft> = {}): Draft {
  const ratings: Draft['ratings'] = {};
  for (const s of STATEMENTS) ratings[s.key] = 'A';
  return {
    ...emptyDraft(),
    programId: 'p-remote', levelId: 'l-b1', trainerId: 't-yasser', classroomId: 'c-g1', scheduleId: 's-g1-sun',
    selfLevelId: 'l-b1', attendance: 'most', ratings, difficulties: ['poor_internet'],
    ...over,
  };
}

function response(over: Partial<ResponseRow>): ResponseRow {
  const ratings: Record<string, any> = {};
  for (const s of STATEMENTS) ratings[s.key] = 'A';
  return {
    id: Math.random().toString(36).slice(2), program_id: 'p-remote', level_id: 'l-b1', trainer_id: 't-yasser',
    classroom_id: 'c-g1', schedule_id: 's-g1-sun', lecture_date: null, self_level_id: 'l-b1', self_level_unknown: false,
    attendance: 'most', ratings, difficulties: ['none'], difficulty_other: null, liked_most: null, suggestion: null,
    submitted_at: '2026-10-19T13:00:00.000Z', ...over,
  };
}

/* ------------------------------------------------------------------ content */
describe('survey content', () => {
  test('has 13 bilingual statements, 6-point scale, 8 difficulties, 4 attendance options', () => {
    assert.equal(STATEMENTS.length, 13);
    assert.equal(SCALE.length, 6);
    assert.equal(DIFFICULTIES.length, 8);
    assert.equal(ATTENDANCE.length, 4);
    for (const s of STATEMENTS) { assert.ok(s.ar.length > 5); assert.ok(s.en.length > 5); }
    assert.equal(new Set(STATEMENTS.map(s => s.key)).size, 13, 'statement keys are unique');
  });
  test('intro text matches the specification', () => {
    assert.match(SURVEY_INTRO.ar, /يرجى عدم كتابة اسمك/);
    assert.match(SURVEY_INTRO.en, /Please do not write your name/);
  });
  test('t() returns the right language', () => {
    assert.equal(t(UI.level, 'ar'), 'المستوى');
    assert.equal(t(UI.level, 'en'), 'Level');
  });
});

/* ------------------------------------------------------------------ helpers */
describe('formatting helpers', () => {
  test('formatTime trims seconds and pads', () => {
    assert.equal(formatTime('16:00:00'), '16:00');
    assert.equal(formatTime('9:05'), '09:05');
    assert.equal(formatTime(null), '');
  });
  test('scheduleLabel in both languages', () => {
    assert.equal(scheduleLabel(schedules[0], 'ar'), 'الأحد 16:00–17:40');
    assert.equal(scheduleLabel(schedules[0], 'en'), 'Sunday 16:00–17:40');
  });
  test('classroomLabel distinguishes groups by code, level and trainer', () => {
    const a = classroomLabel(classrooms[0], { trainers, levels }, 'en');
    const b = classroomLabel(classrooms[1], { trainers, levels }, 'en');
    assert.equal(a, 'G-1 (A) · B1 · Dr. Yasser');
    assert.equal(b, 'G-2 · B1 · Dr. Shaimaa');
    assert.notEqual(a, b);
  });
  test('todayRiyadh uses Asia/Riyadh (UTC+3) day boundary', () => {
    // 22:30 UTC on Oct 19 is already Oct 20 01:30 in Riyadh
    assert.equal(todayRiyadh(new Date('2026-10-19T22:30:00Z')), '2026-10-20');
    assert.equal(todayRiyadh(new Date('2026-10-19T20:30:00Z')), '2026-10-19');
  });
  test('DAYS covers Sunday..Saturday', () => {
    assert.deepEqual(DAYS.map(d => d.v), [0, 1, 2, 3, 4, 5, 6]);
  });
});

/* ------------------------------------------------------------------ cascading */
describe('cascading filters (level → trainer → group → schedule)', () => {
  test('remotePrograms prefers remote programs', () => {
    assert.deepEqual(remotePrograms(programs).map(p => p.id), ['p-remote']);
    assert.equal(remotePrograms([programs[1]]).length, 1, 'falls back to all when none are remote');
  });
  test('levelsForProgram returns global + program levels, active only, sorted', () => {
    assert.deepEqual(levelsForProgram(levels, 'p-remote').map(l => l.code), ['A1', 'B1']);
    assert.deepEqual(levelsForProgram(levels, 'p-onsite').map(l => l.code), ['A1', 'B1', 'X']);
  });
  test('trainersFor lists only trainers that have a group at that level', () => {
    const b1 = trainersFor(trainers, classrooms, { programId: 'p-remote', levelId: 'l-b1' }).map(x => x.id).sort();
    assert.deepEqual(b1, ['t-shaimaa', 't-yasser']);
    const a1 = trainersFor(trainers, classrooms, { programId: 'p-remote', levelId: 'l-a1' }).map(x => x.id);
    assert.deepEqual(a1, ['t-yasser']);
    assert.ok(!b1.includes('t-unused'));
  });
  test('classroomsFor narrows by program + level + trainer', () => {
    assert.deepEqual(classroomsFor(classrooms, { programId: 'p-remote', levelId: 'l-b1', trainerId: 't-yasser' }).map(c => c.id), ['c-g1']);
    assert.deepEqual(classroomsFor(classrooms, { programId: 'p-remote', levelId: 'l-b1' }).map(c => c.id), ['c-g1', 'c-g2']);
  });
  test('schedulesFor returns active schedules of that group only, sorted by day', () => {
    assert.deepEqual(schedulesFor(schedules, 'c-g1').map(s => s.id), ['s-g1-sun', 's-g1-tue']);
    assert.deepEqual(schedulesFor(schedules, 'c-g3'), [], 'inactive schedule hidden');
    assert.deepEqual(schedulesFor(schedules, undefined), []);
  });
});

/* ------------------------------------------------------------------ validation */
describe('validation', () => {
  test('a complete draft has no errors', () => {
    assert.deepEqual(validateDraft(fullDraft(), { schedules }), []);
  });
  test('reports every missing required field, bilingual', () => {
    const errs = validateDraft(emptyDraft(), { schedules });
    const fields = errs.map(e => e.field);
    for (const f of ['programId', 'levelId', 'trainerId', 'classroomId', 'selfLevelId', 'attendance', 'ratings', 'difficulties']) {
      assert.ok(fields.includes(f), `missing error for ${f}`);
    }
    for (const e of errs) { assert.ok(e.ar.length > 2); assert.ok(e.en.length > 2); }
  });
  test('schedule is required when the group has schedules', () => {
    const errs = validateDraft(fullDraft({ scheduleId: '' }), { schedules });
    assert.ok(errs.some(e => e.field === 'scheduleId'));
  });
  test('schedule is optional when the group has none', () => {
    const errs = validateDraft(fullDraft({ classroomId: 'c-g3', scheduleId: '' }), { schedules });
    assert.ok(!errs.some(e => e.field === 'scheduleId'));
  });
  test('rejects a schedule that belongs to another group', () => {
    const errs = validateDraft(fullDraft({ classroomId: 'c-g1', scheduleId: 's-g2-sun' }), { schedules });
    assert.ok(errs.some(e => e.field === 'scheduleId'));
  });
  test('counts unanswered statements', () => {
    const d = fullDraft(); delete d.ratings['q05_listening']; delete d.ratings['q13_satisfied'];
    const err = validateDraft(d, { schedules }).find(e => e.field === 'ratings');
    assert.ok(err); assert.match(err.en, /2 remaining/);
  });
  test('"none" difficulty is mutually exclusive', () => {
    assert.deepEqual(toggleDifficulty(['poor_internet', 'concentration'], 'none'), ['none']);
    assert.deepEqual(toggleDifficulty(['none'], 'teams_difficulty'), ['teams_difficulty']);
    assert.deepEqual(toggleDifficulty(['teams_difficulty'], 'teams_difficulty'), []);
    const errs = validateDraft(fullDraft({ difficulties: ['none', 'poor_internet'] }), { schedules });
    assert.ok(errs.some(e => e.field === 'difficulties'));
  });
  test('invalid date format rejected, valid accepted', () => {
    assert.ok(validateDraft(fullDraft({ lectureDate: '20/10/2026' }), { schedules }).some(e => e.field === 'lectureDate'));
    assert.deepEqual(validateDraft(fullDraft({ lectureDate: '2026-10-20' }), { schedules }), []);
  });
});

/* ------------------------------------------------------------------ payload */
describe('payload', () => {
  test('stores ids + snapshots, no personal data, trims text', () => {
    const p = buildPayload(fullDraft({ likedMost: '  المعلم ممتاز  ', suggestion: '', difficulties: ['other'], difficultyOther: 'x' }), ctx);
    assert.equal(p.classroom_id, 'c-g1');
    assert.equal(p.schedule_id, 's-g1-sun');
    assert.equal(p.trainer_id, 't-yasser');
    assert.equal(p.level_id, 'l-b1');
    assert.equal(p.classroom_code_snapshot, 'G-1');
    assert.equal(p.trainer_name_snapshot, 'Dr. Yasser');
    assert.deepEqual(p.schedule_snapshot, { day_of_week: 0, start_time: '16:00:00', end_time: '17:40:00' });
    assert.equal(p.liked_most, 'المعلم ممتاز');
    assert.equal(p.suggestion, null);
    assert.equal(p.difficulty_other, 'x');
    assert.equal(Object.keys(p.ratings).length, 13);
    assert.ok(!('email' in p) && !('name' in p) && !('student_id' in p) && !('trainee_id' in p));
  });
  test('"not sure" level maps to self_level_unknown', () => {
    const p = buildPayload(fullDraft({ selfLevelId: 'unknown' }), ctx);
    assert.equal(p.self_level_id, null);
    assert.equal(p.self_level_unknown, true);
  });
  test('other-difficulty text is dropped unless "other" is selected', () => {
    const p = buildPayload(fullDraft({ difficulties: ['poor_internet'], difficultyOther: 'ignored' }), ctx);
    assert.equal(p.difficulty_other, null);
  });
});

/* ------------------------------------------------------------------ reporting */
describe('reporting', () => {
  test('statementStats: average, agree %, N/A excluded', () => {
    const rows = [
      response({ ratings: { q01_teams_easy: 'SA' } }),
      response({ ratings: { q01_teams_easy: 'A' } }),
      response({ ratings: { q01_teams_easy: 'D' } }),
      response({ ratings: { q01_teams_easy: 'NA' } }),
    ];
    const s = statementStats(rows, 'q01_teams_easy');
    assert.equal(s.n, 3);
    assert.equal(s.naCount, 1);
    assert.equal(s.avg, 3.67);            // (5+4+2)/3
    assert.equal(s.agreePct, 66.7);
    assert.equal(s.dist.SA, 1); assert.equal(s.dist.NA, 1);
  });

  test('two groups at the SAME time stay separate', () => {
    const rows = [
      response({ classroom_id: 'c-g1', schedule_id: 's-g1-sun', trainer_id: 't-yasser' }),
      response({ classroom_id: 'c-g1', schedule_id: 's-g1-sun', trainer_id: 't-yasser' }),
      response({ classroom_id: 'c-g2', schedule_id: 's-g2-sun', trainer_id: 't-shaimaa', ratings: Object.fromEntries(STATEMENTS.map(s => [s.key, 'SD'])) as any }),
    ];
    assert.notEqual(groupKey(rows[0]), groupKey(rows[2]));
    const groups = compareGroups(rows, { classrooms, trainers, levels, schedules, lang: 'en' });
    assert.equal(groups.length, 2, 'same time slot must not merge groups');
    const g1 = groups.find(g => g.classroom_id === 'c-g1')!;
    const g2 = groups.find(g => g.classroom_id === 'c-g2')!;
    assert.equal(g1.n, 2); assert.equal(g2.n, 1);
    assert.equal(g1.avg, 4); assert.equal(g2.avg, 1);
    assert.match(g1.label, /G-1 \(A\) · B1 · Dr. Yasser — Sunday 16:00–17:40/);
    assert.match(g2.label, /G-2 · B1 · Dr. Shaimaa — Sunday 16:00–17:40/);
  });

  test('applyFilters by program/level/trainer/group/day/schedule/date', () => {
    const rows = [
      response({ id: 'r1', classroom_id: 'c-g1', schedule_id: 's-g1-sun', trainer_id: 't-yasser', lecture_date: '2026-10-18' }),
      response({ id: 'r2', classroom_id: 'c-g1', schedule_id: 's-g1-tue', trainer_id: 't-yasser', lecture_date: '2026-10-20' }),
      response({ id: 'r3', classroom_id: 'c-g2', schedule_id: 's-g2-sun', trainer_id: 't-shaimaa', lecture_date: null, submitted_at: '2026-10-19T22:30:00Z' }), // Riyadh = Oct 20
      response({ id: 'r4', classroom_id: 'c-g3', schedule_id: null, trainer_id: 't-yasser', level_id: 'l-a1', lecture_date: '2026-10-20' }),
    ];
    const ids = (f: Parameters<typeof applyFilters>[1]) => applyFilters(rows, f, schedules).map(r => r.id).sort();
    assert.deepEqual(ids({}), ['r1', 'r2', 'r3', 'r4']);
    assert.deepEqual(ids({ trainerId: 't-shaimaa' }), ['r3']);
    assert.deepEqual(ids({ levelId: 'l-a1' }), ['r4']);
    assert.deepEqual(ids({ classroomId: 'c-g1' }), ['r1', 'r2']);
    assert.deepEqual(ids({ dayOfWeek: 0 }), ['r1', 'r3'], 'Sunday groups (both time-identical schedules)');
    assert.deepEqual(ids({ scheduleId: 's-g2-sun' }), ['r3'], 'schedule id separates same-time groups');
    assert.deepEqual(ids({ dateFrom: '2026-10-20' }), ['r2', 'r3', 'r4'], 'falls back to Riyadh submit date when no lecture date');
    assert.deepEqual(ids({ dateFrom: '2026-10-18', dateTo: '2026-10-18' }), ['r1']);
    assert.deepEqual(ids({ programId: 'p-onsite' }), []);
  });

  test('summarize aggregates attendance, difficulties, self levels, satisfaction', () => {
    const rows = [
      response({ attendance: 'almost_all', difficulties: ['poor_internet', 'concentration'], self_level_unknown: true, self_level_id: null }),
      response({ attendance: 'few', difficulties: ['none'] }),
    ];
    const s = summarize(rows);
    assert.equal(s.count, 2);
    assert.equal(s.attendance.almost_all, 1); assert.equal(s.attendance.few, 1);
    assert.equal(s.difficulties.poor_internet, 1); assert.equal(s.difficulties.none, 1);
    assert.equal(s.selfLevels['unknown'], 1); assert.equal(s.selfLevels['l-b1'], 1);
    assert.equal(s.satisfactionAgreePct, 100);
    assert.equal(s.overallAvg, 4);
  });

  test('CSV export: header + rows, resolved labels, ids kept, Arabic/English variants', () => {
    const rows = [response({ id: 'r1', liked_most: 'قال "رائع"', difficulties: ['poor_internet', 'other'], difficulty_other: 'noise' })];
    const ar = responsesToCsvRows(rows, { ...ctx, lang: 'ar' });
    const en = responsesToCsvRows(rows, { ...ctx, lang: 'en' });
    assert.equal(ar.length, 2);
    assert.equal(ar[0].length, ar[1].length, 'header and row have same width');
    assert.equal(en[0][3], 'Level'); assert.equal(ar[0][3], 'المستوى');
    assert.equal(en[1][5], 'G-1'); assert.equal(en[1][6], 'Sunday'); assert.equal(en[1][7], '16:00');
    assert.equal(en[1][4], 'Dr. Yasser');
    assert.ok(en[1].includes('c-g1') && en[1].includes('s-g1-sun'));
    assert.match(en[1].join('|'), /Poor internet connection \| Other/);
    const csv = csvString(ar);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /"قال ""رائع"""/, 'quotes are escaped');
    const sum = summaryToCsvRows(summarize(rows), 'en');
    assert.equal(sum.length, 1 + STATEMENTS.length);
    assert.equal(sum[0][0], 'Statement');
  });

  test('deleted lookups fall back to snapshots in group labels', () => {
    const rows = [response({ classroom_id: null, schedule_id: null, classroom_code_snapshot: 'OLD-7', level_code_snapshot: 'A2', trainer_name_snapshot: 'Dr. Gone', schedule_snapshot: { day_of_week: 4, start_time: '10:00', end_time: '11:00' } })];
    const g = compareGroups(rows, { classrooms, trainers, levels, schedules, lang: 'en' });
    assert.equal(g.length, 1);
    assert.equal(g[0].label, 'OLD-7 · A2 · Dr. Gone — Thursday 10:00–11:00');
  });
});
