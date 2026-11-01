// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P37 — «أَثَر معك — عُمر الهواء»: جدار الأسبوع (الظهور · «أفادتني») · موسم مشترك (جهتان فقط · التسمية · المجموعات) ·
//                 سجلّ السنة (الخياطة من السجلّات · الجهات المختلفة من 5 · الذروة · الهجري) · مترجم الموسم (التحقق · الآن · التكرارات · السطر) · الخزنة · MCP · لا كرون جديد
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  P37_NAMES_AR, SIGN_HOUR_MIN, SIGN_HOUR_MAX, YEAR_K, wallVisible, canMarkHelped, wallLine, canShareInvite, sharedLabel, sharedGroups,
  cleanSignHour, signHourLiveNow, weeklyOccurrences, signPledgeLine, hijriSpanAr, yearRecord, recordLine, seasonIcs,
} from '../lib/onair/registry';
import type { SeasonRecord } from '../lib/onair/registry';
import { REGISTRY } from '../lib/vault/registry';
import { NATIVE_TOOLS } from '../lib/portal/mcp';
import { EMPTY_WITNESS, witnessLines } from '../lib/directory/registry';

const SEASON = { from_day: '2026-11-01', to_day: '2026-11-28' };   // 4 أسابيع: الأحد 1 → السبت 28
const REC = (o: Partial<SeasonRecord>): SeasonRecord => ({ season_id: '1', title_ar: 'م', invite_ar: null, from_day: '2026-11-01', to_day: '2026-11-28', days: 28, orgs: 0, cities: [], slots: [], sign_slots: 0, sign_verified: 0, meetings_band: 'أقل من 5', peak: [], present_people: { n: null, ar: 'أقل من 5' }, docs: [], recorded_at: '2026-11-29T00:00:00Z', line_ar: '', ...o });

test('الأسماء: عُمر الهواء · جدار الأسبوع · موسم مشترك · سجلّ السنة · مترجم الموسم', () => {
  assert.equal(P37_NAMES_AR.continuity, 'عُمر الهواء'); assert.equal(P37_NAMES_AR.wall, 'جدار الأسبوع'); assert.equal(P37_NAMES_AR.shared, 'موسم مشترك'); assert.equal(P37_NAMES_AR.year, 'سجلّ السنة'); assert.equal(P37_NAMES_AR.season_sign, 'مترجم الموسم');
  assert.deepEqual([SIGN_HOUR_MIN, SIGN_HOUR_MAX, YEAR_K], [30, 90, 5]);
});

test('جدار الأسبوع: يظهر المطويّ غير المخفيّ الذي له إجابة فقط · «أفادتني» لكاتب الأمانة مرة واحدة بعد إجابة', () => {
  assert.ok(wallVisible({ status: 'retired', wall_hidden: false }, 1), 'مطويّ بإجابة');
  assert.ok(!wallVisible({ status: 'retired', wall_hidden: false }, 0), 'بلا إجابات لا يُعلَّق');
  assert.ok(!wallVisible({ status: 'retired', wall_hidden: true }, 3), 'أخفاه الطاقم');
  assert.ok(!wallVisible({ status: 'published', wall_hidden: false }, 3), 'المنشور في صفحته لا على الجدار');
  assert.ok(canMarkHelped({ helped_at: null, status: 'retired' }, 'u1', 'u1', 2).ok);
  assert.ok(canMarkHelped({ helped_at: null, status: 'published' }, 'u1', 'u1', 1).ok, 'يجوز وهو منشور');
  assert.equal((canMarkHelped({ helped_at: null, status: 'retired' }, 'u1', 'u2', 2) as any).error, 'هذا لكاتب الأمانة وحده');
  assert.equal((canMarkHelped({ helped_at: null, status: 'retired' }, null, 'u1', 2) as any).error, 'هذا لكاتب الأمانة وحده', 'أمانة بلا صاحب معروف');
  assert.ok(!canMarkHelped({ helped_at: '2026-11-01T00:00:00Z', status: 'retired' }, 'u1', 'u1', 2).ok, 'مرة واحدة');
  assert.equal((canMarkHelped({ helped_at: null, status: 'retired' }, 'u1', 'u1', 0) as any).error, 'لم تصل إجابة بعد');
  assert.ok(!canMarkHelped({ helped_at: null, status: 'queued' }, 'u1', 'u1', 1).ok);
  assert.ok(wallLine(0).includes('لا أسئلة')); assert.equal(wallLine(1), 'سؤال واحد أجاب عنه الهواء'); assert.equal(wallLine(2), 'سؤالان أجاب عنهما الهواء'); assert.ok(wallLine(7).startsWith('7 أسئلة')); assert.ok(wallLine(12).startsWith('12 سؤالًا'));
});

test('موسم مشترك: جهتان فقط · لا الجهة نفسها · مشاركة واحدة في الموسم · التسمية بالاسمين أو «بين جهتين» · عدّ المجموعات', () => {
  const a = { org_id: 'A', shared_status: null }, b = { org_id: 'B', shared_status: null };
  assert.ok(canShareInvite(a, b).ok);
  assert.equal((canShareInvite(null, b) as any).error, 'أعلن ساعة جهتك أولًا');
  assert.equal((canShareInvite(a, null) as any).error, 'الجهة الأخرى لم تعلن ساعتها في هذا الموسم');
  assert.equal((canShareInvite(a, { org_id: 'A', shared_status: null }) as any).error, 'لا تُدعى الجهة نفسها');
  assert.ok(String((canShareInvite({ org_id: 'A', shared_status: 'accepted' }, b) as any).error).includes('مشاركة واحدة'));
  assert.ok(String((canShareInvite({ org_id: 'A', shared_status: 'invited' }, b) as any).error).includes('دعوة قائمة'));
  assert.ok(String((canShareInvite(a, { org_id: 'B', shared_status: 'pending' }) as any).error).includes('الجهة الأخرى مرتبطة'));
  assert.equal(sharedLabel('جامعة أَثَر', 'معهد النور'), 'ساعة مشتركة: جامعة أَثَر + معهد النور');
  assert.equal(sharedLabel('جامعة أَثَر', null), 'ساعة مشتركة بين جهتين', 'اسم بلا إذن → بلا أسماء');
  assert.equal(sharedGroups([{ shared_status: 'accepted', shared_group: '1:A' }, { shared_status: 'accepted', shared_group: '1:A' }, { shared_status: 'invited', shared_group: '1:C' }, { shared_status: 'accepted', shared_group: '1:D' }, { shared_status: 'accepted', shared_group: '1:D' }]), 2);
  assert.ok(recordLine({ orgs: 4, cities: [{ key: 'riyadh', ar: 'الرياض', n: 4 }], meetings_band: '5–9', sign_verified: 0, days: 28, shared: 1 }).includes('ساعة مشتركة'));
  assert.ok(recordLine({ orgs: 4, cities: [], meetings_band: '5–9', sign_verified: 0, days: 28, sign_hours_verified: 2 }).includes('ساعتا إشارة مفتوحة') || recordLine({ orgs: 4, cities: [], meetings_band: '5–9', sign_verified: 0, days: 28, sign_hours_verified: 2 }).includes('2 ساعات إشارة مفتوحة'));
});

test('مترجم الموسم: 30–90 دقيقة · أسبوعية داخل أيام الموسم · «الآن» بتوقيت الرياض · التكرارات · سطر الشاهد', () => {
  assert.ok(cleanSignHour({ weekday: 2, from_min: 18 * 60, duration_min: 60 }).ok);
  assert.equal((cleanSignHour({ weekday: 7, from_min: 0, duration_min: 60 }) as any).error, 'اليوم غير صالح');
  assert.equal((cleanSignHour({ weekday: 1, from_min: 1500, duration_min: 60 }) as any).error, 'الوقت غير صالح');
  assert.ok(String((cleanSignHour({ weekday: 1, from_min: 600, duration_min: 120 }) as any).error).includes('30'), 'أقصاها 90');
  assert.ok(!cleanSignHour({ weekday: 1, from_min: 600, duration_min: 20 }).ok, 'أدناها 30');
  assert.equal((cleanSignHour({ weekday: 1, from_min: 600 }) as any).s.duration_min, 60, 'المدة الافتراضية 60');
  const h = { weekday: 2, from_min: 18 * 60, duration_min: 60 };   // الثلاثاء 18:00–19:00 الرياض
  assert.ok(signHourLiveNow(h, SEASON, new Date('2026-11-10T15:30:00Z')), 'الثلاثاء 18:30 الرياض');
  assert.ok(!signHourLiveNow(h, SEASON, new Date('2026-11-10T16:00:00Z')), '19:00 انتهت');
  assert.ok(!signHourLiveNow(h, SEASON, new Date('2026-11-11T15:30:00Z')), 'الأربعاء');
  assert.ok(!signHourLiveNow(h, SEASON, new Date('2026-12-01T15:30:00Z')), 'بعد الموسم');
  assert.deepEqual(weeklyOccurrences(2, { from_day: '2026-11-01', to_day: '2026-11-14' }), ['2026-11-03', '2026-11-10'], 'موسم أسبوعين → مرتان');
  assert.equal(weeklyOccurrences(2, SEASON).length, 2, 'لا يتجاوز الحدّ الأقصى للموسم (14 يومًا)');
  assert.equal(weeklyOccurrences(0, { from_day: '2026-11-01', to_day: '2026-11-07' }).length, 1);
  assert.equal(signPledgeLine('موسم الشتاء', 3, 4), 'تعهّد بساعة إشارة أسبوعية في «موسم الشتاء» وحضرها 3 من 4');
  const f = { ...EMPTY_WITNESS, on_air_sign_pledge: signPledgeLine('م', 1, 2) }; assert.ok(witnessLines(f).some(l => l.key === 'on_air_sign_pledge' && l.text.includes('حضرها 1 من 2')));
  assert.equal(EMPTY_WITNESS.on_air_sign_pledge, null); assert.ok(!witnessLines(EMPTY_WITNESS).some(l => l.key === 'on_air_sign_pledge'));
  const ics = seasonIcs({ id: 1, title_ar: 'م', invite_ar: null, ...SEASON }, [{ id: 'sign-9', weekday: 2, from_min: 18 * 60, duration_min: 60, org_name_ar: 'ساعة إشارة مفتوحة', sign_language: true }], 'https://x', new Date('2026-10-20T00:00:00Z'));
  assert.ok(ics.includes('sign-9') && ics.includes('ساعة إشارة مفتوحة'), 'ساعات الإشارة في .ics');
});

test('سجلّ السنة: يُخاط من السجلّات المجمَّدة فقط · الجهات المختلفة من 5 · المشاركات تُجمع · الذروة الأكثر تكرارًا · الهجري في العنوان · سنة بلا مواسم', () => {
  const r1 = REC({ season_id: '1', orgs: 3, org_ids: ['A', 'B', 'C'], cities: [{ key: 'riyadh', ar: 'الرياض', n: 2 }, { key: 'jeddah', ar: 'جدة', n: 1 }], peak: [{ weekday: 2, hour: 20 }, { weekday: 4, hour: 19 }], sign_verified: 1, shared: 1, sign_hours_verified: 2 });
  const r2 = REC({ season_id: '2', orgs: 3, org_ids: ['A', 'D', 'E'], cities: [{ key: 'riyadh', ar: 'الرياض', n: 3 }], peak: [{ weekday: 2, hour: 20 }], sign_verified: 0, shared: 0, sign_hours_verified: 1 });
  const y = yearRecord(2026, [r1, r2], 12);
  assert.equal(y.seasons, 2); assert.equal(y.org_participations, 6); assert.deepEqual(y.orgs_distinct, { n: 5, ar: '5' }, 'A,B,C,D,E = 5 → تُذكر');
  assert.deepEqual(y.cities[0], { key: 'riyadh', ar: 'الرياض', n: 5 }); assert.equal(y.cities.length, 2);
  assert.deepEqual(y.peak, { weekday: 2, hour: 20 }); assert.equal(y.sign_verified, 1); assert.equal(y.sign_hours_verified, 3); assert.equal(y.shared, 1); assert.equal(y.meetings_band, '10–25');
  assert.deepEqual(y.season_ids, ['1', '2']); assert.ok(y.line_ar.startsWith('2026: موسمان · 6 مشاركة جهة في مدينتان') && y.line_ar.includes('4 ساعات بالإشارة') && y.line_ar.includes('ساعة مشتركة واحدة'));
  const y4 = yearRecord(2026, [r1], null); assert.equal(y4.orgs_distinct.n, null, 'ثلاث جهات مختلفة < 5 → لا رقم'); assert.equal(y4.meetings_band, 'غير محسوبة');
  const old = yearRecord(2026, [REC({ season_id: '9', orgs: 7 })], 0); assert.equal(old.orgs_distinct.ar, 'غير محسوبة', 'سجلّ قديم بلا org_ids لا يُخمَّن');
  const none = yearRecord(2027, [], null); assert.equal(none.seasons, 0); assert.equal(none.line_ar, '2027: لم ينتهِ موسم بعد'); assert.equal(none.peak, null);
  const hj = hijriSpanAr(2026); assert.ok(/^14\d\d(–14\d\d)?هـ$/.test(hj), `هجري: ${hj}`); assert.equal(y.hijri_ar, hj);
});

test('خزنة أَثَر: تعهّد المترجم شخصي (self+public، حذف) · MCP week_wall و year_record عامّان للقراءة · لا كرون جديد · SQL · الكرون القائم يذكّر بساعات الإشارة', () => {
  const sh = REGISTRY.find(r => r.table === 'portal_onair_season_sign_hours'); assert.ok(sh && sh.policy === 'delete' && sh.access.includes('public') && sh.userCol === 'user_id', 'تعهّد المترجم');
  for (const n of ['week_wall', 'year_record']) { const t = NATIVE_TOOLS.find(x => x.name === n); assert.ok(t && t.tiers.includes('anon') && t.annotations.readOnlyHint && !t.annotations.destructiveHint, n); }
  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); assert.ok(!(vercel.crons || []).some((c: any) => /p37|wall|year|sign/.test(String(c.path))), 'لا كرون جديد');
  const cron = fs.readFileSync('lib/directory/cron.ts', 'utf8'); assert.ok(cron.includes('remindSignHours'), 'التذكير من مسار الموسم القائم');
  const sql = fs.readFileSync('supabase/migrations/20261215_portal_p37_onair_continuity.sql', 'utf8');
  assert.ok(sql.includes('portal_onair_season_sign_hours') && sql.includes('wall_hidden') && sql.includes('helped_at') && sql.includes('shared_with_org_id') && sql.includes('shared_status') && sql.includes('meetings_n'));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); assert.ok(!Object.keys(pkg.dependencies || {}).some(d => /hijri|moment|dayjs|luxon|ical/.test(d)), 'بلا حزم جديدة — الهجري عبر Intl');
});
