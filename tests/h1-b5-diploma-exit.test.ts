// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-1/5 — توأمة البرامج والدبلومات + EXIT: المنطق الصرف
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { levelsOf, carryToday, attendanceVerdict, riskSignal, stateOf, canExit, canReturn, returnByOf, achievementRecord, RETURN_MONTHS, REASONS, type Unit, type Completion } from '../lib/diploma/exit';

const R = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const U = (id: string, level_no: number | null, hours = 10, extra: Partial<Unit> = {}): Unit => ({ id, idx: Number(id.replace(/\D/g, '')) || 1, title_ar: `مقرّر ${id}`, level_no, hours, starts_on: null, ends_on: null, closed_at: null, linked_program_id: null, ...extra });
const D = (unit_id: string, source: Completion['source'] = 'manual'): Completion => ({ unit_id, status: 'done', source });
const units = [U('u1', 1), U('u2', 1), U('u3', 2), U('u4', 2), U('u5', 2), U('u6', 3), U('u7', null, 5)];

test('المستويات: تجميع وإتمام', () => {
  const L = levelsOf(units, [D('u1'), D('u2'), D('u3')]);
  assert.deepEqual(L.map((l) => [l.level_no, l.done, l.total, l.complete]), [[0, 0, 1, false], [1, 2, 2, true], [2, 1, 3, false], [3, 0, 1, false]]);
  assert.equal(L[1].title, 'المستوى الأوّل'); assert.equal(L[1].hours, 20);
});

test('«لو خرجت اليوم تحمل معك»: شهادة لكل مستوى مكتمل + سجلّ + afterLevel متّصل', () => {
  const c = carryToday('دبلوم إعداد المدرّبين', units, [D('u1'), D('u2'), D('u3'), D('u6')]);
  assert.equal(c.levelsDone, 2); assert.equal(c.afterLevel, 1); // شهادة لكل مستوى مكتمل (١ و٣ — كلّ شهادة صالحة بذاتها) · لكن «بعد المستوى» = المتّصل من البداية = ١
  assert.equal(c.unitsDone, 4); assert.equal(c.unitsTotal, 7); assert.equal(c.hours, 40);
  assert.equal(c.certificates[0].title_ar, 'شهادة برنامج المستوى الأوّل — دبلوم إعداد المدرّبين');
  assert.ok(c.line_ar.startsWith('لو خرجت اليوم تحمل معك: شهادتا برنامج وسجلّ إنجاز موقَّعًا بـ٤ مقرّرات (٤٠ ساعة)'), c.line_ar);
  const one = carryToday('د', units, [D('u1'), D('u2')]); assert.ok(one.line_ar.includes('شهادة برنامج واحدة'));
  assert.ok(c.line_ar.includes('٢٤ شهرًا'));
  const z = carryToday('د', units, []); assert.equal(z.levelsDone, 0); assert.ok(z.line_ar.includes('سجلّ بداية'));
  const two = carryToday('د', units, [D('u1'), D('u2'), D('u3'), D('u4'), D('u5')]); assert.equal(two.afterLevel, 2); assert.equal(two.levelsDone, 2);
});

test('الاعتراف بالتعلّم السابق: البرامج المرتبطة للمقرّرات المتمّة', () => {
  const us = [U('u1', 1, 10, { linked_program_id: 'P-A' }), U('u2', 1, 10, { linked_program_id: 'P-B' }), U('u3', 2)];
  const c = carryToday('د', us, [D('u1', 'credential')]); assert.deepEqual(c.rplPrograms, ['P-A']);
});

test('الإتمام من الحضور: ≥ ٧٥٪ بعد الإغلاق، ولا حكم قبل الانتهاء أو بلا محاضرات', () => {
  const u = U('u1', 1, 10, { starts_on: '2026-09-01', ends_on: '2026-09-30' });
  const days = ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23'].map((day, i) => ({ day, present: i !== 3 }));
  assert.equal(attendanceVerdict(u, days, '2026-09-20'), null);                       // لم ينتهِ
  assert.deepEqual(attendanceVerdict(u, days, '2026-10-05'), { done: true, pct: 75 }); // انتهى · ٣/٤
  assert.deepEqual(attendanceVerdict({ ...u, closed_at: '2026-09-29T00:00:00Z' }, days.map((d) => ({ ...d, present: false })), '2026-09-20'), { done: false, pct: 0 });
  assert.equal(attendanceVerdict(u, [{ day: '2026-10-02', present: true }], '2026-10-05'), null); // خارج النافذة
});

test('الإشارة المبكرة: صامت ١٤ يومًا = عالية · < ٥٠٪ = مراقبة · منتظم = لا شيء', () => {
  const today = '2026-11-23';
  const silent = [{ day: '2026-11-03', present: true }, { day: '2026-11-10', present: false }, { day: '2026-11-17', present: false }];
  assert.equal(riskSignal(silent, today).level, 'high');
  const low = [{ day: '2026-11-05', present: false }, { day: '2026-11-12', present: true }, { day: '2026-11-19', present: false }];
  const r = riskSignal(low, today); assert.equal(r.level, 'watch'); assert.equal(r.pct, 33);
  assert.equal(riskSignal([{ day: '2026-11-19', present: true }, { day: '2026-11-21', present: true }], today).level, 'none');
  assert.equal(riskSignal([], today).level, 'none');
});

test('آلة الحالات والمهلة', () => {
  assert.equal(stateOf('approved', null, false, false), 'enrolled'); assert.equal(stateOf('approved', null, false, true), 'active');
  assert.equal(stateOf('approved', { state: 'exited' }, false, true), 'exited'); assert.equal(stateOf('approved', { state: 'returned' }, false, true), 'returned'); assert.equal(stateOf('approved', null, true, true), 'graduate');
  assert.ok(canExit('active') && canExit('returned') && !canExit('exited') && !canExit('graduate'));
  const rb = returnByOf('2026-11-23T10:00:00.000Z'); assert.ok(rb.startsWith('2028-11-23')); assert.equal(RETURN_MONTHS, 24);
  assert.ok(canReturn('exited', rb, '2028-11-23')); assert.ok(!canReturn('exited', rb, '2028-11-24')); assert.ok(!canReturn('active', rb, '2027-01-01'));
  assert.equal(REASONS.length, 7);
});

test('سجلّ الإنجاز الموقَّع — المحتوى', () => {
  const c = carryToday('دبلوم إعداد المدرّبين', units, [D('u1'), D('u2'), D('u3')]); const r = achievementRecord('دبلوم إعداد المدرّبين', c, '2026-11-23T10:00:00Z');
  assert.equal(r.title_ar, 'سجلّ الإنجاز — دبلوم إعداد المدرّبين'); assert.equal(r.level, 'L1'); assert.equal(r.hours, 30);
  assert.ok(r.description_ar.includes('بعد المستوى الأوّل') && r.description_ar.includes('٣ من ٧') && r.description_ar.includes('المستوى الأوّل: ٢/٢ ✓'));
});

test('الترحيل والمسارات والتركيب', () => {
  const sql = R('supabase/migrations/20270219_portal_h1_b5_diploma_exit.sql');
  for (const s of ['add column if not exists linked_program_id', 'create table if not exists public.portal_unit_completions', 'create table if not exists public.portal_diploma_exits', "'achievement_record'", 'unique (unit_id, email)', "where state = 'exited'"]) assert.ok(sql.includes(s), s);
  const api = R('app/api/diploma/exit/route.ts'); for (const a of ["'auto'", "'complete'", "'link'", "'exit'", "'return'", 'mine']) assert.ok(api.includes(a), a);
  assert.ok(api.includes("const self = !c.writer")); // المتدرّب يخرج من قيده هو فقط
  const st = R('lib/diploma/exit-store.ts'); assert.ok(st.includes("kind: 'program_completion'") && st.includes("kind: 'achievement_record'") && st.includes('signAndStoreCredential'));
  assert.ok(st.includes("cur.source === 'manual'")); // الآلي لا يمسّ اليدوي
  assert.ok(R('app/me/page.tsx').includes('<ExitCard />')); assert.ok(R('app/components/PortalAdminTabs.tsx').includes("'/admin/diplomas'")); assert.ok(R('lib/portal/rooms.ts').includes("'/admin/diplomas'"));
  const pg = R('app/admin/diplomas/page.tsx'); assert.ok(pg.includes('data-testid="dp-link"') && pg.includes('data-testid="dp-cell"') && pg.includes('data-testid="dp-exit-confirm"'));
  assert.ok(!R('app/me/ExitCard.tsx').includes('القياس'));
});
