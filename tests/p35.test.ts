// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P35 — «أَثَر معك — موسم الهواء»: الموسم (التحقق · الحالة بتوقيت الرياض · وقوع ساعة الجهة · السطر k≥5 · الوثيقة)
//                 صدى يعود (الدرجات 5/25/100 · السطر) · أمانة إلى جهة (24 ساعة ثم عامة · الجهة الفعّالة) · ميراث متبادل (الشروط · الظلّ المعكوس مرة واحدة)
//                 الهواء على الخريطة بالزمن (شبكة 7×24 · k≥5 مدن · بلا أعداد) · همسة المترجم (الشروط · مرة في اليوم · تنتهي وحدها) · خزنة أَثَر · لا كرون جديد
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P35_NAMES_AR, ORG_HOLD_HOURS, ECHO_BACK_STEPS, WHEN_WEEKS, WHEN_K, WHISPER_MINUTES, SEASON_K, PRESENCE_LOG_DAYS,
  cleanSeason, cleanSlot, seasonState, seasonPhraseAr, slotOccursAt, seasonLine, seasonCode, seasonDocNarrative, riyadhDay,
  orgHoldUntil, holdReleased, effectiveOrg, echoBackLine, echoBackStep, canReverse, reverseOnTake, whenGrid, canWhisper, whisperOver, whisperEndsAt, isWhisper,
} from '../lib/onair/registry';
import type { Presence, Request } from '../lib/onair/registry';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { witnessLines, EMPTY_WITNESS } from '../lib/directory/registry';

const P = (o: Partial<Presence> & { user_id: string }): Presence => ({ email: `${o.user_id}@x`, face: 'expert', receives: ['quick', 'session'], domains: [], alt_link: null, on_air_until: new Date(Date.now() + 3600000).toISOString(), grounded_at: null, grounded_note: null, meta: {}, ...o });
const R = (o: Partial<Request> & { id: string }): Request => ({ kind: 'quick', status: 'open', asker_user_id: null, asker_email: null, asker_alias: 'سائل', domain: null, text_ar: 'سؤال', receiver_user_id: null, room_code: null, taken_at: null, done_at: null, outcome: null, what_changed_ar: null, duration_min: null, meta: {}, created_at: new Date().toISOString(), ...o });

test('P35 الأسماء والثوابت', () => {
  assert.equal(P35_NAMES_AR.season, 'موسم الهواء'); assert.equal(P35_NAMES_AR.org_hold, 'أمانة إلى جهة'); assert.equal(P35_NAMES_AR.whisper, 'همسة المترجم');
  assert.equal(ORG_HOLD_HOURS, 24); assert.deepEqual(ECHO_BACK_STEPS, [5, 25, 100]); assert.equal(WHEN_WEEKS, 8); assert.equal(WHEN_K, 5); assert.equal(WHISPER_MINUTES, 10); assert.equal(SEASON_K, 5); assert.equal(PRESENCE_LOG_DAYS, 90);
});

test('1) الموسم: التحقق — يوم إلى 14 يومًا', () => {
  assert.equal(cleanSeason({ from_day: '2026-11-15', to_day: '2026-11-21' }).ok, true);
  assert.equal(cleanSeason({ from_day: '2026-11-15', to_day: '2026-11-14' }).ok, false);
  assert.equal(cleanSeason({ from_day: '2026-11-01', to_day: '2026-11-30' }).ok, false);
  assert.equal(cleanSeason({ from_day: 'x', to_day: '2026-11-30' }).ok, false);
  const c = cleanSeason({ title_ar: '', invite_ar: ' نرفع  أيدينا ', from_day: '2026-11-15', to_day: '2026-11-15' }); assert.ok(c.ok, 'يوم واحد يكفي'); if (c.ok) { assert.equal(c.s.title_ar, 'موسم الهواء'); assert.equal(c.s.invite_ar, 'نرفع أيدينا'); }
  const sl = cleanSlot({ weekday: 2, from_min: 20 * 60, duration_min: 60, public_name: 'yes' }); assert.ok(sl.ok, 'ساعة صالحة'); if (sl.ok) assert.equal(sl.s.public_name, false, 'الإذن بالاسم قيمة منطقية صريحة');
  assert.equal(cleanSlot({ weekday: 9, from_min: 0, duration_min: 60 }).ok, false);
});

test('1) الموسم: الحالة بتوقيت الرياض والعبارة', () => {
  const s = { from_day: '2026-11-15', to_day: '2026-11-21' };
  assert.equal(seasonState(s, new Date('2026-11-10T12:00:00Z')).phase, 'before'); assert.equal(seasonState(s, new Date('2026-11-10T12:00:00Z')).days_to, 5);
  assert.equal(seasonState(s, new Date('2026-11-14T21:30:00Z')).phase, 'live', 'الساعة 00:30 بالرياض = يوم 15');
  assert.equal(seasonState(s, new Date('2026-11-21T20:00:00Z')).phase, 'live'); assert.equal(seasonState(s, new Date('2026-11-21T20:00:00Z')).days_left, 1);
  assert.equal(seasonState(s, new Date('2026-11-21T21:30:00Z')).phase, 'after');
  assert.equal(seasonPhraseAr(seasonState(s, new Date('2026-11-14T12:00:00Z'))), 'يبدأ غدًا');
  assert.equal(seasonPhraseAr(seasonState(s, new Date('2026-11-21T12:00:00Z'))), 'جارٍ — يومه الأخير');
  assert.equal(seasonPhraseAr(seasonState(s, new Date('2026-12-01T12:00:00Z'))), 'انتهى');
  assert.equal(riyadhDay(new Date('2026-11-14T21:30:00Z')), '2026-11-15');
});

test('1) الموسم: وقوع ساعة الجهة داخل أيامه (UTC = الرياض − 3)', () => {
  const s = { from_day: '2026-11-15', to_day: '2026-11-21' };   // 15 نوفمبر 2026 أحد
  assert.equal(slotOccursAt({ weekday: 2, from_min: 20 * 60 }, s), '2026-11-17T17:00:00.000Z');
  assert.equal(slotOccursAt({ weekday: 0, from_min: 9 * 60 }, s), '2026-11-15T06:00:00.000Z');
  assert.equal(slotOccursAt({ weekday: 3, from_min: 600 }, { from_day: '2026-11-15', to_day: '2026-11-17' }), null, 'الأربعاء خارج موسم من الأحد إلى الثلاثاء');
});

test('1) الموسم: السطر العام k≥5 · الرمز · الوثيقة', () => {
  assert.equal(seasonLine({ orgs: 0, meetings: 0, phase: 'live' }), 'لم تعلن جهة ساعتها بعد');
  assert.equal(seasonLine({ orgs: 2, meetings: 0, phase: 'before' }), 'جهتان أعلنتا ساعتيهما');
  assert.match(seasonLine({ orgs: 7, meetings: 3, phase: 'after' }), /تُذكر من خمسة/);
  assert.match(seasonLine({ orgs: 7, meetings: 12, phase: 'after' }), /12 لقاءً/);
  let i = 0; const code = seasonCode(() => ['abcd1234', 'wxyz9876'][i++ % 2]); assert.match(code, /^ATH-OS-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const season = { title_ar: 'موسم الهواء', from_day: '2026-11-15', to_day: '2026-11-21' };
  assert.doesNotMatch(seasonDocNarrative('جامعة أَثَر', season, 4), /لقاءً/, 'أقل من خمسة لا يُذكر');
  assert.match(seasonDocNarrative('جامعة أَثَر', season, 9), /9 لقاءً/);
});

test('2) صدى يعود: الدرجات والسطر', () => {
  assert.equal(echoBackStep(4), 0); assert.equal(echoBackStep(5), 5); assert.equal(echoBackStep(30), 25); assert.equal(echoBackStep(250), 100);
  assert.equal(echoBackLine(4, 'asker'), null, 'لا سطر قبل خمسة');
  assert.equal(echoBackLine(7, 'asker'), 'سؤالك علّم 7 أشخاص');
  assert.match(echoBackLine(25, 'receiver')!, /السؤال الذي حللته صار «مهارة يوم» وتدرّب عليها 25 شخصًا/);
});

test('3) أمانة إلى جهة: 24 ساعة في عهدة الجهة ثم الهواء العام — بالقراءة', () => {
  const created = '2026-11-15T10:00:00.000Z'; assert.equal(orgHoldUntil(created), '2026-11-16T10:00:00.000Z');
  const r = R({ id: 'b1', org_id: 'org-1', org_hold_until: orgHoldUntil(created), meta: { bottle: true } });
  const during = Date.parse('2026-11-15T20:00:00Z'), after = Date.parse('2026-11-16T10:00:01Z');
  assert.equal(holdReleased(r, during), false); assert.equal(effectiveOrg(r, during), 'org-1');
  assert.equal(holdReleased(r, after), true); assert.equal(effectiveOrg(r, after), null, 'بعد العهدة: عامة');
  const plain = R({ id: 'q1', org_id: 'org-1' }); assert.equal(effectiveOrg(plain, after), 'org-1', 'طلب الجهة بلا عهدة يبقى داخلها');
  assert.equal(effectiveOrg(R({ id: 'p' }), after), null);
});

test('4) ميراث متبادل: الشروط والظلّ المعكوس مرة واحدة', () => {
  const mentor = { id: 'm', reverse_left: 0, reverse_user_id: null };
  assert.equal(canReverse(mentor, { user_id: 'n', mentor_user_id: 'm', mentor_status: 'done' }).ok, true);
  assert.equal(canReverse(mentor, { user_id: 'n', mentor_user_id: 'other', mentor_status: 'done' }).ok, false);
  assert.equal(canReverse(mentor, { user_id: 'n', mentor_user_id: 'm', mentor_status: 'accepted' }).ok, false, 'قبل اكتمال الخمسة لا');
  assert.equal(canReverse({ id: 'm', reverse_left: 1, reverse_user_id: 'z' }, { user_id: 'n', mentor_user_id: 'm', mentor_status: 'done' }).ok, false, 'دور معلّق واحد فقط');
  assert.equal(canReverse({ id: 'm', legacy_complete: ['n'] }, { user_id: 'n', mentor_user_id: 'm', mentor_status: 'done' }).ok, false, 'بعد اكتمال الميراث لا يتكرر');
  const none = reverseOnTake(P({ user_id: 'm' })); assert.equal(none.shadow_user_id, null); assert.equal(none.patch, null);
  const rv = reverseOnTake(P({ user_id: 'm', reverse_left: 1, reverse_user_id: 'n', meta: { legacy_complete: ['a'] } }));
  assert.equal(rv.shadow_user_id, 'n'); assert.equal(rv.complete_with, 'n'); assert.equal(rv.patch!.reverse_left, 0); assert.equal(rv.patch!.reverse_user_id, null); assert.deepEqual(rv.patch!.meta.legacy_complete, ['a', 'n']);
  const lines = witnessLines({ ...EMPTY_WITNESS, on_air_legacy: 1 }); assert.equal(lines.length, 1); assert.match(lines[0].text, /ميراث هواء متبادلًا مع زميل/);
  assert.deepEqual(witnessLines(EMPTY_WITNESS), [], 'لا سطر بلا ميراث');
});

test('5) الهواء على الخريطة بالزمن: شبكة 7×24 · مدن k≥5 · كثافة بلا أعداد', () => {
  const now = new Date('2026-11-20T12:00:00Z'); const logs: { user_id: string; city_key: string | null; started_at: string; ended_at: string | null }[] = [];
  // الرياض: 6 أشخاص مختلفين، كل ثلاثاء 20:00–21:30 بالرياض (17:00Z) على 6 أسابيع
  for (let w = 0; w < 6; w++) for (let u = 0; u < 6; u++) { const d = new Date('2026-11-17T17:00:00Z'); d.setUTCDate(d.getUTCDate() - 7 * w); logs.push({ user_id: `r${u}`, city_key: 'riyadh', started_at: d.toISOString(), ended_at: new Date(d.getTime() + 90 * 60000).toISOString() }); }
  // جدة: 3 أشخاص فقط → لا تظهر
  for (let u = 0; u < 3; u++) logs.push({ user_id: `j${u}`, city_key: 'jeddah', started_at: '2026-11-18T08:00:00Z', ended_at: '2026-11-18T09:00:00Z' });
  // بلا مدينة → تُهمل · قديم (قبل 8 أسابيع) → يُهمل
  logs.push({ user_id: 'x', city_key: null, started_at: '2026-11-18T08:00:00Z', ended_at: null }); logs.push({ user_id: 'r0', city_key: 'riyadh', started_at: '2026-08-01T08:00:00Z', ended_at: '2026-08-01T09:00:00Z' });
  const g = whenGrid(logs, now);
  assert.equal(g.weeks, 8); assert.equal(g.cities.length, 1); assert.equal(g.cities[0].key, 'riyadh');
  const cells = g.cities[0].cells; assert.equal(cells.length, 7); assert.equal(cells[0].length, 24);
  assert.equal(cells[2][20], 3, 'الثلاثاء 20 بالرياض: 6 من 8 أسابيع → غالبًا'); assert.equal(cells[2][21], 3, 'يمتد إلى 21'); assert.equal(cells[2][19], 0); assert.equal(cells[3][20], 0);
  assert.equal(JSON.stringify(g).includes('r0'), false, 'لا معرّفات'); assert.equal(JSON.stringify(g).includes('"users"'), false, 'لا أعداد أشخاص');
  const sparse = whenGrid(logs.filter(l => l.city_key === 'riyadh' && Date.parse(l.started_at) > Date.parse('2026-11-12T00:00:00Z')), now); assert.equal(sparse.cities[0].cells[2][20], 1, 'أسبوع واحد من 8 → نادرًا');
});

test('6) همسة المترجم: للمترجم على الهواء · مرة في اليوم · تنتهي وحدها بعد 10 دقائق', () => {
  const now = new Date('2026-11-18T08:00:00Z');
  assert.equal(canWhisper(null, null, now).ok, false);
  assert.equal(canWhisper(P({ user_id: 'i', face: 'expert' }), null, now).ok, false, 'ليس مترجمًا');
  assert.equal(canWhisper(P({ user_id: 'i', face: 'interpreter', on_air_until: null }), null, now).ok, false, 'ليس على الهواء');
  const ip = P({ user_id: 'i', face: 'interpreter', on_air_until: '2026-11-18T09:00:00Z' });
  assert.equal(canWhisper(ip, null, now).ok, true);
  assert.equal(canWhisper(ip, '2026-11-18T05:00:00Z', now).ok, false, 'همسة اليوم نفسه');
  assert.equal(canWhisper(ip, '2026-11-17T20:00:00Z', now).ok, true, 'يوم رياض سابق (23:00 بالرياض)');
  const w = R({ id: 'w', kind: 'session', status: 'taken', taken_at: '2026-11-18T08:00:00Z', receiver_user_id: 'i', meta: { whisper: true } });
  assert.equal(isWhisper(w), true); assert.equal(whisperEndsAt(w.taken_at!), '2026-11-18T08:10:00.000Z');
  assert.equal(whisperOver(w, Date.parse('2026-11-18T08:09:00Z')), false); assert.equal(whisperOver(w, Date.parse('2026-11-18T08:10:00Z')), true);
  assert.equal(whisperOver({ ...w, meta: {} }, Date.parse('2026-11-18T09:00:00Z')), false, 'جلسة عادية لا تنتهي هكذا');
});

test('خزنة أَثَر: سجل الحضور شخصي (90 يومًا) · الموسم وساعاته غير شخصية', () => {
  const log = REGISTRY.find(r => r.table === 'portal_onair_presence_log'); assert.ok(log, 'سجل الحضور مسجّل'); assert.equal(log!.policy, 'delete'); assert.equal(log!.retentionDays, 90); assert.equal(log!.tsCol, 'started_at'); assert.deepEqual(log!.piiCols, []);
  assert.ok(NON_PERSONAL_TABLES.includes('portal_onair_seasons'), 'المواسم'); assert.ok(NON_PERSONAL_TABLES.includes('portal_onair_season_slots'), 'ساعات الجهات');
});

test('لا كرون جديد ولا تبعيات جديدة', () => {
  const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); const n = (v.crons || []).length; assert.ok(n <= 6, `crons=${n}`);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); assert.equal(Object.keys(pkg.dependencies || {}).some(d => /season|whisper|heatmap|calendar/i.test(d)), false);
  const sql = fs.readFileSync('supabase/migrations/20261213_portal_p35_onair_season.sql', 'utf8');
  for (const t of ['portal_onair_seasons', 'portal_onair_season_slots', 'portal_onair_presence_log', 'org_hold_until', 'reverse_left', 'reverse_user_id', 'back_notified', "'on_air_season'"]) assert.ok(sql.includes(t), t);
});
