// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P74 «سمعناكم» + «بصوتِ واحدٍ منّا» — المنطق النقي: العتبتان (20 فردًا و5 شُعب) · يوم الأسبوع فقط · إطفاء الأستاذ والجهة · سطر واحد لكل يوم · الصوت ≤ 15 ث وحذفه · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEARD_LIMITS, P74_NAMES_AR, heardOf, sealLite, weekdayAr, validateHourVoice, hourVoicePath, voiceOfMeta, voicePublic, canRemoveVoice, type SealLite } from '../lib/hour/heard';
import { parseCommand } from '../lib/portal/voice';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const now = new Date('2026-12-31T08:00:00Z'); /* الخميس 31 ديسمبر 11:00 الرياض */
let seq = 1;
const seal = (day: string, cid: string, people = 6, line: string | null = `سطر ${cid} ${day}`, extra: Partial<SealLite> = {}): SealLite => ({ id: seq++, day, line, people, classroom_id: cid, org_id: null, public: true, ...extra });
const week = (n: number, cids: string[], people = 6) => cids.flatMap((c, j) => Array.from({ length: n }, (_, i) => seal(`2026-12-${String(30 - i - (j % 2)).padStart(2, '0')}`, c, people)));

test('P74 · الأسماء والحدود', () => {
  assert.equal(P74_NAMES_AR.heard, 'سمعناكم'); assert.equal(P74_NAMES_AR.heard_official, 'خيط لقاءات التأمل على الصفحة الرئيسية'); assert.equal(P74_NAMES_AR.voice, 'بصوتِ واحدٍ منّا'); assert.equal(P74_NAMES_AR.voice_official, 'القراءة الصوتية لسطر الشعبة');
  assert.equal(HEARD_LIMITS.people, 20); assert.equal(HEARD_LIMITS.sections, 5); assert.equal(HEARD_LIMITS.items, 7); assert.equal(HEARD_LIMITS.voiceSec, 15); assert.equal(HEARD_LIMITS.voiceBytes, 1024 * 1024); assert.equal(HEARD_LIMITS.signedSeconds, 300); assert.equal(HEARD_LIMITS.bucket, 'athar-media'); assert.equal(HEARD_LIMITS.prefix, 'hour-voice');
  assert.ok(P74_NAMES_AR.consent.includes('لا يصل الصفحة الرئيسية')); assert.ok(P74_NAMES_AR.consent.includes('حذفه'));
});

test('P74 · العتبتان معًا: 5 شُعب و20 فردًا — وإلا لا قسم', () => {
  assert.equal(heardOf([], new Set(), now).why, 'empty');
  const fourRooms = week(1, ['a', 'b', 'c', 'd'], 10); const v4 = heardOf(fourRooms, new Set(), now); assert.equal(v4.shown, false); assert.equal(v4.why, 'sections'); assert.equal(v4.sections, 4); assert.equal(v4.people, 40);
  const fiveSmall = week(1, ['a', 'b', 'c', 'd', 'e'], 3); const v5 = heardOf(fiveSmall, new Set(), now); assert.equal(v5.shown, false); assert.equal(v5.why, 'people'); assert.equal(v5.people, 15);
  const ok = week(1, ['a', 'b', 'c', 'd', 'e'], 4); const v = heardOf(ok, new Set(), now); assert.equal(v.shown, true); assert.equal(v.why, 'ok'); assert.equal(v.people, 20); assert.equal(v.sections, 5); assert.ok(v.head_ar.includes('5 شُعب')); assert.ok(v.head_ar.includes('20 متدرّبًا'));
});

test('P74 · يوم الأسبوع فقط، بلا اسم شعبة ولا برنامج؛ سطر واحد لكل يوم (الأكثر حضورًا) وأحدث 7 أيام', () => {
  const rows = [...week(1, ['a', 'b', 'c', 'd', 'e'], 4), seal('2026-12-30', 'z', 30, 'الأكثر حضورًا'), seal('2026-12-20', 'a', 5, 'قديم'), seal('2026-12-21', 'b', 5), seal('2026-12-22', 'c', 5), seal('2026-12-23', 'd', 5), seal('2026-12-24', 'e', 5), seal('2026-12-25', 'a', 5), seal('2026-12-26', 'b', 5)];
  const v = heardOf(rows, new Set(), now); assert.equal(v.shown, true); assert.equal(v.items.length, 7);
  assert.equal(v.items[0].day, '2026-12-30'); assert.equal(v.items[0].line, 'الأكثر حضورًا'); assert.equal(v.items[0].weekday_ar, 'الأربعاء');
  for (const it of v.items) { assert.deepEqual(Object.keys(it).sort(), ['day', 'line', 'weekday_ar']); assert.ok(!('classroom_id' in it) && !('program' in it)); }
  assert.equal(new Set(v.items.map((i) => i.day)).size, 7, 'يوم واحد لا يتكرّر'); assert.equal(weekdayAr('2026-12-25'), 'الجمعة');
});

test('P74 · إطفاء الأستاذ (public=false) وإطفاء الجهة (home_threads_off) وختم بلا سطر — كلها خارج الخيط', () => {
  const base = week(1, ['a', 'b', 'c', 'd', 'e'], 4);
  const off = [...base, seal('2026-12-30', 'q', 50, 'لا يظهر', { public: false }), seal('2026-12-30', 'r', 50, 'جهة مغلقة', { org_id: 'org-x' }), seal('2026-12-30', 's', 50, null)];
  const v = heardOf(off, new Set(['org-x']), now); assert.equal(v.shown, true); assert.equal(v.people, 20, 'المطفأة لا تُعدّ'); assert.ok(!v.items.some((i) => i.line === 'لا يظهر' || i.line === 'جهة مغلقة'));
  const v2 = heardOf(off, new Set(), now); assert.ok(v2.items.some((i) => i.line === 'جهة مغلقة'), 'بلا سياسة تظهر');
});

test('P74 · أقدم من 28 يومًا لا يدخل؛ والمستقبل لا يدخل', () => {
  const rows = [...week(1, ['a', 'b', 'c', 'd', 'e'], 4), seal('2026-11-30', 'old', 100, 'قديم جدًا'), seal('2027-01-05', 'fut', 100, 'مستقبل')];
  const v = heardOf(rows, new Set(), now); assert.equal(v.people, 20); assert.ok(!v.items.some((i) => i.line === 'قديم جدًا' || i.line === 'مستقبل'));
});

test('P74 · sealLite يقرأ صفّ الختم: public الافتراضي true · «—» = بلا سطر · الجهة من الشعبة', () => {
  const l = sealLite({ id: '7', day: '2026-12-29', body_ar: 'سطرنا', meta: { people: 9 }, classroom_id: 'c1' }, (c) => (c === 'c1' ? 'org-1' : null));
  assert.deepEqual(l, { id: 7, day: '2026-12-29', line: 'سطرنا', people: 9, classroom_id: 'c1', org_id: 'org-1', public: true });
  assert.equal(sealLite({ id: 8, day: '2026-12-29', body_ar: '—', meta: { public: false }, classroom_id: 'c2' }, () => null).line, null);
  assert.equal(sealLite({ id: 8, day: '2026-12-29', body_ar: 'x', meta: { public: false }, classroom_id: 'c2' }, () => null).public, false);
});

test('P74 · الصوت: ≤ 15 ث · ≤ 1 م.ب · صيغ معروفة · المسار شعبة/ختم بلا بريد', () => {
  assert.equal(validateHourVoice({ mime: 'audio/webm;codecs=opus', bytes: 40000, sec: 12 }).ok, true);
  assert.equal(validateHourVoice({ mime: 'audio/webm', bytes: 40000, sec: 17 }).ok, false); assert.equal(validateHourVoice({ mime: 'audio/webm', bytes: 40000, sec: 16 }).ok, true, 'سماحية ثانية');
  assert.equal(validateHourVoice({ mime: 'audio/webm', bytes: 1024 * 1024 + 1, sec: 5 }).ok, false); assert.equal(validateHourVoice({ mime: 'video/mp4', bytes: 4000, sec: 5 }).ok, false); assert.equal(validateHourVoice({ mime: 'audio/webm', bytes: 100, sec: 5 }).ok, false);
  const v = validateHourVoice({ mime: 'audio/mp4', bytes: 9000, sec: 16 }); assert.ok(v.ok && v.ext === 'm4a' && v.sec === 15, 'تُقصّ إلى 15');
  assert.equal(hourVoicePath('c-1', 42, 'webm'), 'hour-voice/c-1/42.webm'); assert.ok(!hourVoicePath('c-1', 42, 'webm').includes('@'));
});

test('P74 · meta.voice: القراءة والعلنية والحذف (صاحبها أو الأستاذ)', () => {
  assert.equal(voiceOfMeta({}), null); assert.equal(voiceOfMeta({ voice: { path: 'p' } }), null, 'بلا by لا صوت');
  const v = voiceOfMeta({ voice: { path: 'hour-voice/c/1.webm', by: 'u2', sec: 9, at: '2026-12-29T10:00:00Z', mime: 'audio/webm' } })!; assert.equal(v.sec, 9);
  assert.deepEqual(voicePublic(v, 'u2'), { sec: 9, at: '2026-12-29T10:00:00Z', mine: true }); assert.equal(voicePublic(v, 'u9')!.mine, false); assert.ok(!('by' in (voicePublic(v, 'u9') as object)), 'لا معرّف للقارئ في العرض');
  assert.equal(canRemoveVoice(v, { id: 'u2', role: 'learner' }), true); assert.equal(canRemoveVoice(v, { id: 'u1', role: 'instructor' }), true); assert.equal(canRemoveVoice(v, { id: 'u9', role: 'learner' }), false);
});

test('P74 · «نادِ»: «سمعناكم» → /#heard', () => {
  const m = parseCommand('يا أثر سمعناكم') as any; assert.ok(m && JSON.stringify(m).includes('/#heard'), JSON.stringify(m));
});

test('P74 · شكل المصدر: صفر جداول · الرئيسية تحمل heard · الصوت لا يدخل الرئيسية · الغرفة تطلب الموافقة · الختم يحمل public', () => {
  const store = read('lib/hour/store.ts'); const route = read('app/api/me/hour/route.ts'); const home = read('app/api/home/route.ts'); const page = read('app/page.tsx'); const room = read('app/me/hour/HourRoom.tsx'); const heard = read('lib/hour/heard.ts');
  assert.ok(store.includes("const meta = { ...(row.meta || {}), voice:") && store.includes('invalidateHeardCache'), 'الصوت في meta الختم');
  assert.ok(!store.includes("from('portal_hour_voices')") && !heard.includes("from('"), 'لا جدول جديد');
  assert.ok(route.includes("multipart/form-data") && route.includes("'voice_delete'") && route.includes("'seal_public'") && route.includes("userFlag(db, me.id, 'voice_off'"), 'المسارات الثلاثة وسياسة voice_off');
  assert.ok(home.includes('heardThread') && home.includes('heard }'), 'الرئيسية تحمل heard');
  assert.ok(!heard.includes('voice_url') && !/HeardItem = \{[^}]*voice/.test(heard), 'الخيط العام بلا صوت');
  assert.ok(page.includes('data-testid="hd-section"') && page.includes('id="heard"') && page.includes('— شعبة في أَثَر') && !page.includes('hd-voice') && !page.includes('<audio') , 'القسم بلا صوت وبنسخ طويل');
  assert.ok(room.includes('hr-voice-consent') && room.includes('P74_NAMES_AR.consent') && room.includes('hr-seal-public') && room.includes("action: 'seal', public: pub"), 'الموافقة الصريحة وخانة الأستاذ');
  assert.ok(store.includes("if (prev && prev.by !== me.id) return fail('سبقك"), 'قراءة واحدة لكل سطر');
});
