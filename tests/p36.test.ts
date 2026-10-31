// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P36 — «أَثَر معك — ذاكرة الهواء»: سجلّ الموسم (الشرائح · الأعداد من 5 · الساعات الأكثف · حضور المترجم · السطر · .ics)
//                 موسم بالإشارة (التحقق) · أمانة متسلسلة (المرشَّح · أسبوع السؤال · شروط الإجابة · التنظيف) · خريطة الزمن للجهة (الضبابية تحت 5 · لا شبكة تحت 5 أشخاص · أنسب الساعات) · خزنة أَثَر · MCP · لا كرون جديد
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P36_NAMES_AR, RECORD_K, ORG_TIME_K, ORG_TIME_MIN_USERS, WEEK_QUESTION_DAYS, MEETINGS_BANDS_AR,
  seasonEnded, seasonDays, meetingsBand, publicCount, peakHours, interpreterShowedUp, recordLine, seasonIcs, cleanSlot36,
  isChainCandidate, weekOver, canAnswerWeek, cleanWeekAnswer, cleanWeekQuestion, weekQuestionLine, timeGrid, bestHours, ORG_TIME_LEVEL_AR, riyadhDay,
} from '../lib/onair/registry';
import { cleanDomains } from '../lib/onair/registry';
import type { Presence, Request } from '../lib/onair/registry';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { NATIVE_TOOLS } from '../lib/portal/mcp';

const NOW = new Date('2026-11-10T09:00:00Z');   // الثلاثاء 12:00 الرياض
const P = (o: Partial<Presence> & { user_id: string }): Presence => ({ email: `${o.user_id}@x`, face: 'expert', receives: ['quick', 'session'], domains: [], alt_link: null, on_air_until: new Date(NOW.getTime() + 3600000).toISOString(), grounded_at: null, grounded_note: null, meta: {}, ...o });
const R = (o: Partial<Request> & { id: string }): Request => ({ kind: 'quick', status: 'open', asker_user_id: null, asker_email: null, asker_alias: 'سائل', domain: null, text_ar: 'سؤال', receiver_user_id: null, room_code: null, taken_at: null, done_at: null, outcome: null, what_changed_ar: null, duration_min: null, meta: {}, created_at: NOW.toISOString(), org_id: null, org_hold_until: null, ...o } as Request);
const log = (u: string, startIso: string, mins = 60) => ({ user_id: u, started_at: startIso, ended_at: new Date(Date.parse(startIso) + mins * 60000).toISOString() });

test('إصلاح P33: cleanDomains لا يحوّل undefined/null إلى نصّ', () => {
  assert.deepEqual(cleanDomains([undefined]), []); assert.deepEqual(cleanDomains([null, '', 'undefined', 'null']), []); assert.deepEqual(cleanDomains(['Training', undefined]), ['training']);
});

test('P36 الأسماء والثوابت', () => {
  assert.equal(P36_NAMES_AR.memory, 'ذاكرة الهواء'); assert.equal(P36_NAMES_AR.record, 'سجلّ الموسم'); assert.equal(P36_NAMES_AR.week_question, 'سؤال الأسبوع'); assert.equal(P36_NAMES_AR.org_time, 'خريطة الزمن للجهة');
  assert.equal(RECORD_K, 5); assert.equal(ORG_TIME_K, 5); assert.equal(ORG_TIME_MIN_USERS, 5); assert.equal(WEEK_QUESTION_DAYS, 7); assert.equal(MEETINGS_BANDS_AR.length, 4);
});

test('1) سجلّ الموسم: انتهى؟ · الأيام · شرائح اللقاءات · الأعداد من 5', () => {
  const s = { from_day: '2026-11-01', to_day: '2026-11-07' };
  assert.equal(seasonEnded(s, new Date('2026-11-07T20:00:00Z')), false, 'يومه الأخير بتوقيت الرياض (23:00) لم ينتهِ');
  assert.equal(seasonEnded(s, new Date('2026-11-07T21:30:00Z')), true, 'بعد منتصف ليل الرياض انتهى');
  assert.equal(seasonDays(s), 7); assert.equal(seasonDays({ from_day: '2026-11-01', to_day: '2026-11-01' }), 1);
  assert.equal(meetingsBand(0), 'لا لقاءات مسجّلة'); assert.equal(meetingsBand(3), 'أقل من 10'); assert.equal(meetingsBand(9), 'أقل من 10'); assert.equal(meetingsBand(10), '10–25'); assert.equal(meetingsBand(25), '10–25'); assert.equal(meetingsBand(26), 'أكثر من 25');
  assert.deepEqual(publicCount(0), { n: 0, ar: 'لا شيء' }); assert.deepEqual(publicCount(4), { n: null, ar: 'أقل من خمسة' }); assert.deepEqual(publicCount(5), { n: 5, ar: '5' });
});

test('1) الساعات الأكثف: خلية من 5 أشخاص مختلفين فقط · أعلى 3 · داخل أيام الموسم', () => {
  const season = { from_day: '2026-11-01', to_day: '2026-11-07' };
  const logs: ReturnType<typeof log>[] = [];
  for (let i = 0; i < 6; i++) logs.push(log(`u${i}`, '2026-11-02T17:00:00Z'));           // الاثنين 20:00 الرياض — 6 أشخاص
  for (let i = 0; i < 4; i++) logs.push(log(`v${i}`, '2026-11-03T06:00:00Z'));           // الثلاثاء 09:00 — 4 أشخاص → لا تُذكر
  for (let i = 0; i < 5; i++) logs.push(log(`w${i}`, '2026-11-04T15:00:00Z', 120));      // الأربعاء 18:00 و19:00 — 5 أشخاص
  for (let i = 0; i < 9; i++) logs.push(log(`z${i}`, '2026-11-20T17:00:00Z'));           // خارج الموسم
  const r = peakHours(logs, season);
  assert.equal(r.people, 15, 'الأشخاص داخل الموسم فقط');
  assert.equal(r.peak.length, 3); assert.deepEqual(r.peak[0], { weekday: 1, hour: 20 }, 'الأكثف أولًا (6)');
  assert.ok(r.peak.every(p => !(p.weekday === 2 && p.hour === 9)), 'خلية 4 أشخاص لا تظهر');
  assert.equal(peakHours(logs.slice(0, 4), season).peak.length, 0, 'أقل من 5 → لا ساعات');
});

test('1) حضور المترجم يُثبت ساعة الإشارة · سطر السجلّ', () => {
  const at = '2026-11-02T17:00:00Z';
  assert.equal(interpreterShowedUp([log('i1', '2026-11-02T17:30:00Z')], 'i1', at, 60), true, 'صعد في منتصف الساعة');
  assert.equal(interpreterShowedUp([log('i1', '2026-11-02T18:30:00Z')], 'i1', at, 60), false, 'صعد بعد انتهائها');
  assert.equal(interpreterShowedUp([log('i2', '2026-11-02T17:30:00Z')], 'i1', at, 60), false, 'شخص آخر');
  assert.equal(interpreterShowedUp([], null, at, 60), false); assert.equal(interpreterShowedUp([log('i1', at)], 'i1', null, 60), false);
  const line = recordLine({ days: 7, orgs: 3, cities: [{ key: 'riyadh', ar: 'الرياض', n: 2 }, { key: 'jeddah', ar: 'جدة', n: 1 }], meetings_band: '10–25', sign_verified: 1 });
  assert.ok(line.includes('7 أيام') && line.includes('3 جهات') && line.includes('مدينتين') === false && line.includes('2 مدن') && line.includes('10–25') && line.includes('ساعة واحدة بالإشارة'), line);
  assert.ok(recordLine({ days: 1, orgs: 0, cities: [], meetings_band: 'لا لقاءات مسجّلة', sign_verified: 0 }).includes('بلا ساعات معلنة'));
});

test('1) تقويم .ics: حدث لكل ساعة جهة بتوقيت UTC · بلا ساعات → يوم كامل · طيّ الأسطر · بلا مكتبات', () => {
  const season = { id: 7, title_ar: 'موسم الهواء الأول', invite_ar: 'أسبوعٌ نرفع فيه أيدينا', from_day: '2026-11-01', to_day: '2026-11-07' };
  const ics = seasonIcs(season, [{ id: 1, weekday: 1, from_min: 20 * 60, duration_min: 60, org_name_ar: 'جامعة أَثَر', sign_language: true }, { id: 2, weekday: 3, from_min: 18 * 60, duration_min: 90, org_name_ar: null }], 'https://athar-portal.vercel.app', NOW);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART:20261102T170000Z'), 'الاثنين 20:00 الرياض = 17:00Z'); assert.ok(ics.includes('DTEND:20261102T180000Z'));
  assert.ok(ics.includes('(بالإشارة)') && ics.includes('ساعة جهة') && ics.includes('/on-air/seasons/7'));
  assert.ok(ics.split('\r\n').every(l => l.length <= 75), 'كل سطر ≤ 75 بايت-حرفًا (RFC 5545 طيّ)');
  const empty = seasonIcs(season, [], 'https://x', NOW); assert.ok(empty.includes('DTSTART;VALUE=DATE:20261101') && empty.includes('DTEND;VALUE=DATE:20261108'), 'يوم كامل للمدة');
  assert.ok(!fs.readFileSync('package.json', 'utf8').includes('"ics"'), 'بلا مكتبة ics');
});

test('2) موسم بالإشارة: التحقق يتطلّب مترجمًا', () => {
  const base = { weekday: 2, from_min: 1200, duration_min: 60, public_name: true };
  const a = cleanSlot36({ ...base, sign_language: true }); assert.ok(!a.ok && /المترجم/.test(a.error));
  const b = cleanSlot36({ ...base, sign_language: true, interpreter_user_id: 'u9' }); assert.ok(b.ok && b.s.sign_language && b.s.interpreter_user_id === 'u9');
  const c = cleanSlot36({ ...base, interpreter_user_id: 'u9' }); assert.ok(c.ok && !c.s.sign_language && c.s.interpreter_user_id === null, 'بلا علم → لا مترجم يُحفظ');
  const d = cleanSlot36({ ...base, weekday: 9, sign_language: false }); assert.ok(!d.ok, 'تحقق الساعة الأصلي باقٍ');
});

test('3) أمانة متسلسلة: المرشَّح = منقضية + أمانة + إذن', () => {
  assert.equal(isChainCandidate(R({ id: '1', status: 'expired', meta: { bottle: true, may_publish: true } })), true);
  assert.equal(isChainCandidate(R({ id: '2', status: 'open', meta: { bottle: true, may_publish: true } })), false, 'ما زالت في عهدة الهواء');
  assert.equal(isChainCandidate(R({ id: '3', status: 'expired', meta: { bottle: true } })), false, 'بلا إذن');
  assert.equal(isChainCandidate(R({ id: '4', status: 'expired', meta: { may_publish: true } })), false, 'ليست أمانة');
});

test('3) سؤال الأسبوع: ينقضي بعد 7 أيام بتوقيت الرياض · السطر · الصياغة والإجابة بلا بيانات شخصية', () => {
  const q = { status: 'published' as const, week_start: '2026-11-01' };
  assert.equal(weekOver(q, new Date('2026-11-07T20:00:00Z')), false); assert.equal(weekOver(q, new Date('2026-11-07T21:30:00Z')), true, 'اليوم الثامن بالرياض');
  assert.equal(weekOver({ status: 'queued', week_start: '2026-10-01' }, NOW), false, 'الطابور لا ينقضي');
  assert.equal(weekQuestionLine(0), 'لم يجب أحد بعد — من على الهواء يجيب'); assert.equal(weekQuestionLine(2), 'إجابتان من الهواء'); assert.equal(weekQuestionLine(7), '7 إجابات من الهواء');
  const a = cleanWeekAnswer('قصير'); assert.ok(!a.ok);
  const b = cleanWeekAnswer('راسلني على test@example.com أو 0501234567 وسأشرح لك خطوات التقويم'); assert.ok(b.ok && !b.text.includes('@') && !b.text.includes('0501234567'), 'البريد والرقم يُجهَّلان');
  const c = cleanWeekQuestion('كيف أبدأ؟'); assert.ok(c.ok); assert.ok(!cleanWeekQuestion('قصير').ok);
});

test('3) من يجيب: على الهواء الآن ومرة واحدة', () => {
  assert.equal(canAnswerWeek(null, false, NOW.getTime()).ok, false, 'بلا حضور');
  assert.equal(canAnswerWeek(P({ user_id: 'u1', on_air_until: new Date(NOW.getTime() - 1000).toISOString() }), false, NOW.getTime()).ok, false, 'انطفأ');
  assert.equal(canAnswerWeek(P({ user_id: 'u1' }), true, NOW.getTime()).ok, false, 'أجاب من قبل');
  assert.equal(canAnswerWeek(P({ user_id: 'u1' }), false, NOW.getTime()).ok, true);
});

test('4) خريطة الزمن للجهة: لا شبكة تحت 5 أشخاص · ضبابية تحت 5 في الخلية · مستويات بالأسابيع', () => {
  const logs: ReturnType<typeof log>[] = [];
  for (let i = 0; i < 4; i++) logs.push(log(`a${i}`, '2026-11-03T17:00:00Z'));
  const g0 = timeGrid(logs, NOW); assert.equal(g0.users, 4); assert.equal(g0.shown, false); assert.ok(g0.cells.every(r => r.every(c => c === 0)), 'بلا شبكة أصلًا');
  // 6 أشخاص: خلية الثلاثاء 20:00 (الرياض) في 5 من 8 أسابيع → غالبًا؛ خلية الأحد 10:00 بشخصين → ضبابية
  for (let w = 0; w < 5; w++) for (let i = 0; i < 6; i++) logs.push(log(`b${i}`, new Date(Date.parse('2026-11-03T17:00:00Z') - w * 7 * 86400000).toISOString()));
  logs.push(log('b0', '2026-11-01T07:00:00Z')); logs.push(log('b1', '2026-11-01T07:00:00Z'));
  const g = timeGrid(logs, NOW); assert.equal(g.shown, true); assert.equal(g.cells[2][20], 3, 'غالبًا'); assert.equal(g.cells[0][10], -1, 'ضبابية (شخصان)'); assert.equal(g.cells[5][3], 0);
  assert.equal(ORG_TIME_LEVEL_AR['-1'], 'أقل من خمسة');
  const old = timeGrid([log('q1', '2026-06-01T10:00:00Z')], NOW); assert.equal(old.users, 0, 'خارج الأسابيع الثمانية');
});

test('4) أنسب ثلاث ساعات: الجهة ×2 + المنصّة ×1 · 8–22 فقط · لماذا', () => {
  const z = () => Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const org = z(), plat = z(); org[2][20] = 3; plat[2][20] = 1; plat[4][19] = 3; org[0][10] = -1; plat[1][3] = 3; org[6][9] = 1;
  const b = bestHours(org, plat); assert.equal(b.length, 3);
  assert.deepEqual([b[0].weekday, b[0].hour, b[0].score], [2, 20, 7]); assert.ok(b[0].why_ar.includes('معًا'));
  assert.deepEqual([b[1].weekday, b[1].hour], [4, 19]); assert.ok(b[1].why_ar.includes('بعدُ لا'));
  assert.ok(b.every(x => x.hour >= 8 && x.hour <= 22), 'لا ساعات ليل'); assert.ok(!b.some(x => x.weekday === 0 && x.hour === 10), 'الضبابية لا تُحسب');
  assert.deepEqual(bestHours(null, null), []); assert.equal(bestHours(null, plat).length, 2, 'ساعة الليل تُستبعد');
});

test('خزنة أَثَر: إجابات الأسبوع شخصية (self+public) · الأسئلة غير شخصية · لا كرون جديد · MCP season_record عامّ', () => {
  const wa = REGISTRY.find(r => r.table === 'portal_onair_week_answers'); assert.ok(wa && wa.policy === 'delete' && wa.access.includes('public'), 'إجابات الأسبوع');
  assert.ok(NON_PERSONAL_TABLES.includes('portal_onair_week_questions'));
  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); assert.ok(!(vercel.crons || []).some((c: any) => /p36|week|season|record/.test(String(c.path))), 'لا كرون جديد');
  const t = NATIVE_TOOLS.find(x => x.name === 'season_record'); assert.ok(t && t.tiers.includes('anon') && t.annotations.readOnlyHint, 'أداة عامة للقراءة');
  const src = fs.readFileSync('lib/directory/cron.ts', 'utf8'); assert.ok(src.includes('freezeSeasonRecords') && src.includes('rotateWeekQuestion'), 'من الكرون القائم');
  const sql = fs.readFileSync('supabase/migrations/20261214_portal_p36_onair_memory.sql', 'utf8'); assert.ok(sql.includes('portal_onair_week_questions') && sql.includes('sign_language') && sql.includes('record_json'));
  assert.equal(riyadhDay(new Date('2026-11-07T21:30:00Z')), '2026-11-08');
});
