/** P49-ج «مرّة واحدة» — اختبارات وحدة */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniqueViolation, markDone, onceKey, onceMessage, oncePerDay, riyadhToday, wasDone, clearDone } from '../lib/evaluation/once';

function memStore() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; }

test('P49-ج: السياسة — اليومي وعن بُعد يوميًّا، الختامي والنهاية مرّة للبرنامج', () => {
  assert.equal(oncePerDay('DAILY'), true); assert.equal(oncePerDay('REMOTE'), true);
  assert.equal(oncePerDay('FINAL'), false); assert.equal(oncePerDay('END'), false);
  assert.match(onceMessage('DAILY', 'ar'), /اليوم/); assert.doesNotMatch(onceMessage('END', 'ar'), /اليوم/);
  assert.match(onceMessage('REMOTE', 'en'), /today/i);
});

test('P49-ج: تاريخ الرياض — 22:30 UTC هو اليوم التالي بتوقيت الرياض', () => {
  assert.equal(riyadhToday(new Date('2026-11-05T22:30:00Z')), '2026-11-06');
  assert.equal(riyadhToday(new Date('2026-11-05T20:59:00Z')), '2026-11-05');
});

test('P49-ج: مفتاح العلامة — يوميّ بالتاريخ، برنامجيّ بلا تاريخ، وذاكرة الجهاز تُسجَّل وتُقرأ وتُمسح', () => {
  assert.equal(onceKey({ kind: 'DAILY', programId: 'p1', classroomId: 'c1', date: '2026-11-05' }), 'athar:once:DAILY:p1:c1:-:2026-11-05');
  assert.equal(onceKey({ kind: 'END', programId: 'p1', classroomId: 'c1' }), 'athar:once:END:p1:c1:-:-');
  const st = memStore(); const sc = { kind: 'END' as const, programId: 'p1' };
  assert.equal(wasDone(sc, st), null); markDone(sc, st, new Date('2026-11-05T10:00:00Z')); assert.equal(wasDone(sc, st), '2026-11-05T10:00:00.000Z');
  assert.equal(wasDone({ kind: 'END', programId: 'p2' }, st), null); clearDone(sc, st); assert.equal(wasDone(sc, st), null);
  assert.equal(wasDone(sc, null), null);   // بلا localStorage (SSR/خاص) لا يتعطّل
});

test('P49-ج: انتهاك الفهرس الفريد يُكتشف بالرمز 23505 أو بالنصّ', () => {
  assert.equal(isUniqueViolation({ code: '23505', message: 'duplicate key value violates unique constraint' }), true);
  assert.equal(isUniqueViolation({ message: 'duplicate key value violates unique constraint "evaluations_once_daily_uidx"' }), true);
  assert.equal(isUniqueViolation({ code: '42501', message: 'permission denied' }), false); assert.equal(isUniqueViolation(null), false);
});
