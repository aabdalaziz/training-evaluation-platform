// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P33 — «أَثَر معك — على الهواء»: الحضور بإرادة صاحبه وينطفئ وحده · الأوجه · الدرجات الثلاث · آلة الحالات (أخذ/إغلاق/تصعيد) ·
//                 مهلة الثلاث دقائق · ترتيب الصفّ والنداء · الساعات من اللقاءات الفعلية → ATH-OA · k للسائلين · النوافذ · التلخيص المحلي ·
//                 ما يراه العامة (بلا بريد/رابط) · «ما شهده أَثَر» · خزنة أَثَر · الغرف kind=support · وثيقة VC
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADES, GRADE_LABEL, GRADE_HINT, FACES, FACE_AR, STATUS_AR, OUTCOME_AR, ON_AIR_MINUTES, ON_AIR_MAX_MINUTES, QUICK_TIMEOUT_MIN, QUICK_CLOSE_MIN, SESSION_MINUTES, SESSION_EXTEND_MINUTES,
  MAX_OPEN_PER_ASKER, MAX_OPEN_ANON, MAX_WINDOWS, TEXT_MIN, TEXT_MAX, CERT_HOURS, CERT_MEETINGS, ON_AIR_K, STATS_K, TAGLINE_AR,
  cleanGrades, cleanDomains, cleanLink, cleanText, allowedFaces, isOnAir, minutesLeft, goOnAir, publicPresence, alias, canTake, canClose, nextStatus, quickExpired, quickClosed,
  rankQueue, matchReceivers, hoursFrom, certCode, onAirWitnessLine, avgResponseMin, publicStats, sessionEndsAt, summaryPrompt, localSummary, WEEKDAY_AR, hhmm, cleanWindow, nextWindowAt,
} from '../lib/onair/registry';
import type { Presence, Request } from '../lib/onair/registry';
import { buildOnAirDoc } from '../lib/onair/load';
import { witnessLines, EMPTY_WITNESS } from '../lib/directory/registry';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { ROOM_KIND_LABEL, ROOM_DEFAULT_PROMPT } from '../lib/portal/media';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';

const NOW = Date.parse('2026-10-31T08:00:00Z'); const iso = (ms: number) => new Date(ms).toISOString(); const min = 60000;
const P = (o: Partial<Presence> & { user_id: string }): Presence => ({ email: `${o.user_id}@x.sa`, face: 'expert', receives: ['quick', 'session'], domains: [], alt_link: null, on_air_until: iso(NOW + 60 * min), grounded_at: null, grounded_note: null, meta: {}, ...o });
const R = (o: Partial<Request> & { id: number }): Request => ({ kind: 'quick', status: 'open', asker_user_id: 'a1', asker_email: 'a1@x.sa', asker_alias: 'سائل 1234', domain: null, text_ar: 'كيف أبدأ تقويم برنامج؟', receiver_user_id: null, room_code: null, taken_at: null, done_at: null, outcome: null, what_changed_ar: null, duration_min: null, meta: {}, created_at: iso(NOW - min), ...o });

test('P33 الثوابت: ثلاث درجات بأسمائها · أربعة أوجه · 90 دقيقة تنطفئ وحدها · 3 دقائق مهلة · 20+10 · الشهادة عند 10 س و8 لقاءات · العدّ من 1 والطالبون k≥5', () => {
  assert.deepEqual(GRADES, ['quick', 'session', 'consult']);
  assert.equal(GRADE_LABEL.quick.ar, 'عونٌ سريع'); assert.equal(GRADE_LABEL.session.ar, 'جلسة دعم'); assert.equal(GRADE_LABEL.consult.ar, 'استشارة');
  for (const g of GRADES) { assert.ok(GRADE_HINT[g].ar.length > 10, `تلميح ${g}`); assert.ok(GRADE_LABEL[g].en.length > 2, `en ${g}`); }
  assert.deepEqual(FACES, ['expert', 'trainer', 'interpreter', 'staff']); assert.equal(FACE_AR.interpreter, 'مترجم لغة إشارة');
  assert.equal(ON_AIR_MINUTES, 90); assert.equal(ON_AIR_MAX_MINUTES, 240); assert.equal(QUICK_TIMEOUT_MIN, 3); assert.equal(QUICK_CLOSE_MIN, 15);
  assert.equal(SESSION_MINUTES, 20); assert.equal(SESSION_EXTEND_MINUTES, 10); assert.equal(MAX_OPEN_PER_ASKER, 3); assert.equal(MAX_OPEN_ANON, 1); assert.equal(MAX_WINDOWS, 5);
  assert.equal(TEXT_MIN, 5); assert.equal(TEXT_MAX, 500); assert.equal(CERT_HOURS, 10); assert.equal(CERT_MEETINGS, 8); assert.equal(ON_AIR_K, 1); assert.equal(STATS_K, 5);
  assert.equal(TAGLINE_AR, 'اسأل الآن… فثمّة إنسان يسمعك');
  assert.ok(Object.keys(STATUS_AR).length === 6 && STATUS_AR.taken === 'معك الآن', 'الحالات'); assert.equal(OUTCOME_AR.needs_staff, 'يحتاج الطاقم');
});

test('P33 التنظيف: الدرجات · المجالات (عربي/لاتيني، ≤12) · الرابط https فقط · النص', () => {
  assert.deepEqual(cleanGrades(['quick', 'x', 'quick', 'consult']), ['quick', 'consult']); assert.deepEqual(cleanGrades('quick'), []);
  assert.deepEqual(cleanDomains(['تقويم البرامج', ' Program-Eval ', 'a', 'x'.repeat(50), 'تقويم البرامج']), ['تقويمالبرامج', 'program-eval']);
  assert.equal(cleanDomains(Array.from({ length: 20 }, (_, i) => `dom${i}`)).length, 12);
  assert.equal(cleanLink('https://teams.microsoft.com/l/meetup-join/abc'), 'https://teams.microsoft.com/l/meetup-join/abc'); assert.equal(cleanLink('http://x.sa/abc'), null); assert.equal(cleanLink('javascript:alert(1)'), null); assert.equal(cleanLink(''), null);
  assert.equal(cleanText('  أ  ب\n\nج  ', 500), 'أ ب ج'); assert.equal(cleanText('x'.repeat(600)).length, 500);
});

test('P33 الأوجه المسموحة: من سيرة الهيئة المعتمَدة · المترجم باعتماد الطاقم · الطاقم بدوره — لا أحد غيرهم', () => {
  assert.deepEqual(allowedFaces({ directoryFaces: [], isStaff: false, interpreterOk: false }), []);
  assert.deepEqual(allowedFaces({ directoryFaces: ['expert', 'trainer'], isStaff: false, interpreterOk: false }), ['expert', 'trainer']);
  assert.deepEqual(allowedFaces({ directoryFaces: [], isStaff: true, interpreterOk: true }), ['interpreter', 'staff']);
});

test('P33 الحضور: ينطفئ وحده · المُنزَل ليس على الهواء · التجديد بين 15 و240 دقيقة · ما يراه العامة بلا بريد ولا رابط ولا meta', () => {
  const p = P({ user_id: 'u1' }); assert.ok(isOnAir(p, NOW), 'على الهواء'); assert.equal(minutesLeft(p, NOW), 60);
  assert.ok(!isOnAir({ ...p, on_air_until: iso(NOW - 1) }, NOW), 'انتهى'); assert.ok(!isOnAir({ ...p, grounded_at: iso(NOW) }, NOW), 'مُنزَل'); assert.ok(!isOnAir({ ...p, on_air_until: null }, NOW), 'لم يصعد');
  assert.equal(goOnAir(90, NOW), iso(NOW + 90 * min)); assert.equal(goOnAir(5, NOW), iso(NOW + 15 * min)); assert.equal(goOnAir(999, NOW), iso(NOW + 240 * min)); assert.equal(goOnAir(0, NOW), iso(NOW + 90 * min));
  const v = publicPresence({ ...p, alt_link: 'https://zoom.us/j/1', meta: { blocked: ['x'] } }, { name_ar: 'ريم الدوسري', slug: 'reem', photo_url: null, title_ar: 'خبيرة' }, NOW) as any;
  assert.equal(v.name_ar, 'ريم الدوسري'); assert.equal(v.face_ar, 'خبير استشاري'); assert.equal(v.minutes_left, 60);
  assert.ok(!('email' in v) && !('alt_link' in v) && !('meta' in v), 'لا بريد ولا رابط ولا meta للعامة');
  assert.equal(publicPresence({ ...p, face: 'staff' }, null, NOW).name_ar, 'طاقم أَثَر'); assert.equal(publicPresence(p, null, NOW).name_ar, 'عضو هيئة أَثَر');
});

test('P33 آلة الحالات: أول «أستقبل» يأخذ · لا تستقبل طلبك · الإغلاق لطرفيه أو الطاقم · «يحتاج الطاقم» → escalated', () => {
  assert.deepEqual(canTake(R({ id: 1 }), 'r1'), { ok: true }); assert.equal(canTake(R({ id: 1, status: 'taken' }), 'r1').ok, false); assert.equal(canTake(R({ id: 1 }), 'a1').ok, false);
  const t = R({ id: 2, status: 'taken', receiver_user_id: 'r1' });
  assert.equal(canClose(t, 'r1').ok, true); assert.equal(canClose(t, 'a1').ok, true); assert.equal(canClose(t, 'zz').ok, false); assert.equal(canClose(t, 'zz', true).ok, true); assert.equal(canClose({ ...t, status: 'done' }, 'r1').ok, false);
  assert.equal(nextStatus('solved'), 'done'); assert.equal(nextStatus('needs_session'), 'done'); assert.equal(nextStatus('needs_staff'), 'escalated');
  assert.equal(alias(() => 0), 'سائل 1000'); assert.equal(alias(() => 0.9999), 'سائل 9999');
});

test('P33 المهل: عونٌ سريع بلا ردّ 3 دقائق → منتهٍ · خيط مأخوذ 15 دقيقة → يُغلق · لا تنطبق على الجلسة', () => {
  assert.ok(!quickExpired(R({ id: 1, created_at: iso(NOW - 2 * min) }), NOW)); assert.ok(quickExpired(R({ id: 1, created_at: iso(NOW - 4 * min) }), NOW));
  assert.ok(!quickExpired(R({ id: 1, kind: 'session', created_at: iso(NOW - 40 * min) }), NOW), 'الجلسة لا تنتهي بالثلاث');
  assert.ok(quickClosed(R({ id: 1, status: 'taken', taken_at: iso(NOW - 16 * min) }), NOW)); assert.ok(!quickClosed(R({ id: 1, status: 'taken', taken_at: iso(NOW - 10 * min) }), NOW));
  assert.equal(sessionEndsAt(iso(NOW)), iso(NOW + 20 * min)); assert.equal(sessionEndsAt(iso(NOW), true), iso(NOW + 30 * min));
});

test('P33 الصفّ والنداء: مجال المُستقبِل أولًا ثم الأقدم · لا يرى إلا ما يستقبله · النداء للحاضرين فقط', () => {
  const open = [R({ id: 1, domain: 'x', created_at: iso(NOW - 5 * min) }), R({ id: 2, domain: 'eval', created_at: iso(NOW - 1 * min) }), R({ id: 3, kind: 'session', created_at: iso(NOW - 9 * min) }), R({ id: 4, created_at: iso(NOW - 9 * min) })];
  assert.deepEqual(rankQueue(open, { receives: ['quick'], domains: ['eval'] }).map(r => r.id), [2, 4, 1]);
  assert.deepEqual(rankQueue(open, { receives: ['session'], domains: [] }).map(r => r.id), [3]);
  const present = [P({ user_id: 'a', receives: ['session'] }), P({ user_id: 'b', domains: ['eval'], on_air_until: iso(NOW + 30 * min) }), P({ user_id: 'c', on_air_until: iso(NOW + 10 * min) }), P({ user_id: 'd', on_air_until: iso(NOW - 1) })];
  assert.deepEqual(matchReceivers(present, R({ id: 9, domain: 'eval' }), NOW).map(p => p.user_id), ['b', 'c']);
  assert.deepEqual(matchReceivers(present, R({ id: 9, kind: 'session' }), NOW).map(p => p.user_id), ['c', 'b', 'a'], 'بلا مجال: من ينتهي حضوره أولًا يُنادى أولًا');
  assert.ok(!matchReceivers(present, R({ id: 9 }), NOW).some(p => p.user_id === 'd'), 'المنتهي لا يُنادى');
});

test('P33 الساعات من اللقاءات الفعلية: لا من المفتاح · 10 س و8 لقاءات = شهادة · الرمز ATH-OA · سطر الشاهد', () => {
  const done = Array.from({ length: 7 }, (_, i) => R({ id: i, status: 'done', kind: 'session', duration_min: 30 }));
  const h = hoursFrom([...done, R({ id: 99, status: 'expired' }), R({ id: 98, status: 'open' })]);
  assert.equal(h.meetings, 7); assert.equal(h.hours, 3.5); assert.equal(h.by_kind.session, 7); assert.ok(!h.eligible); assert.equal(h.remaining_hours, 6.5); assert.equal(h.remaining_meetings, 1);
  const big = Array.from({ length: 8 }, (_, i) => R({ id: i, status: 'done', kind: 'session', duration_min: 80 }));
  const h2 = hoursFrom(big); assert.ok(h2.eligible, 'مؤهَّل'); assert.equal(h2.hours, 10.7);
  assert.equal(hoursFrom([R({ id: 1, status: 'done', duration_min: null })]).minutes, 10, 'عون سريع بلا مدة = 10 دقائق'); assert.equal(hoursFrom([R({ id: 1, status: 'done', duration_min: 999 })]).minutes, 240, 'سقف 240');
  assert.match(certCode(() => 'abcdefgh'), /^ATH-OA-ABCD-ABCD$/);
  assert.equal(onAirWitnessLine({ meetings: 0, hours: 0 }), null); assert.equal(onAirWitnessLine({ meetings: 1, hours: 0.5 }), 'كان على الهواء 0.5 ساعة · لقاءً واحدًا'); assert.equal(onAirWitnessLine({ meetings: 12, hours: 6 }), 'كان على الهواء 6 ساعة · 12 لقاءً');
  const lines = witnessLines({ ...EMPTY_WITNESS, on_air_hours: 10.7, on_air_meetings: 8 }); assert.equal(lines.length, 1); assert.equal(lines[0].key, 'on_air'); assert.ok(lines[0].text.includes('أَثَر معك') && lines[0].text.includes('8 لقاءات'), lines[0].text);
  assert.deepEqual(witnessLines(EMPTY_WITNESS), [], 'لا سطر بلا لقاءات');
});

test('P33 الأرقام العامة: الحاضرون من 1 · لقاءات/سائلو الشهر وزمن الردّ يختفون دون k=5 · متوسط أول ردّ', () => {
  const s = publicStats({ present: 1, faces: { expert: 1 }, month_done: 4, askers_month: 9, avg_response_min: 2 });
  assert.equal(s.present, 1); assert.equal(s.meetings_month, null); assert.equal(s.askers_month, 9); assert.equal(s.avg_response_min, null); assert.equal(s.k, 5);
  const s2 = publicStats({ present: 0, faces: {}, month_done: 5, askers_month: 3, avg_response_min: 2.5 }); assert.equal(s2.meetings_month, 5); assert.equal(s2.askers_month, null); assert.equal(s2.avg_response_min, 2.5);
  assert.equal(avgResponseMin([]), null);
  assert.equal(avgResponseMin([R({ id: 1, created_at: iso(NOW), taken_at: iso(NOW + 2 * min) }), R({ id: 2, created_at: iso(NOW), taken_at: iso(NOW + 3 * min) }), R({ id: 3, created_at: iso(NOW), taken_at: null })]), 2.5);
  assert.equal(avgResponseMin([R({ id: 1, created_at: iso(NOW), taken_at: iso(NOW + 700 * min) })]), null, 'القيم الشاذة تُستبعد');
});

test('P33 النوافذ: 30 د–4 س · اليوم 0..6 · hh:mm · القادمة بتوقيت الرياض خلال 7 أيام', () => {
  assert.equal(cleanWindow({ weekday: 7, from_min: 600, to_min: 660 }).ok, false); assert.equal(cleanWindow({ weekday: 0, from_min: 600, to_min: 620 }).ok, false); assert.equal(cleanWindow({ weekday: 0, from_min: 600, to_min: 900 }).ok, false);
  const w = cleanWindow({ weekday: 2, from_min: 600, to_min: 660, note_ar: '  أسئلة  التقويم ' }); assert.ok(w.ok); if (w.ok) assert.deepEqual(w.w, { weekday: 2, from_min: 600, to_min: 660, note_ar: 'أسئلة التقويم' });
  assert.equal(hhmm(600), '10:00'); assert.equal(hhmm(0), '00:00'); assert.equal(hhmm(1439), '23:59'); assert.equal(WEEKDAY_AR[5], 'الجمعة');
  // 2026-10-31 هو سبت؛ 08:00Z = 11:00 الرياض
  const sat = new Date('2026-10-31T08:00:00Z');
  assert.equal(nextWindowAt({ weekday: 6, from_min: 12 * 60 }, sat).toISOString(), '2026-10-31T09:00:00.000Z', 'اليوم نفسه لاحقًا');
  assert.equal(nextWindowAt({ weekday: 6, from_min: 10 * 60 }, sat).toISOString(), '2026-11-07T07:00:00.000Z', 'فات وقته → الأسبوع القادم');
  assert.equal(nextWindowAt({ weekday: 0, from_min: 9 * 60 }, sat).toISOString(), '2026-11-01T06:00:00.000Z', 'الأحد');
});

test('P33 التلخيص: المطالبة بلا أسماء ولا نصيحة · المحلي يعمل بلا مفتاح · حدّ 40/يوم · موصوف في /ai', () => {
  const msgs = [{ from_role: 'asker', text_ar: 'كيف أبدأ تقويم برنامج تدريبي؟' }, { from_role: 'receiver', text_ar: 'ابدأ بسؤال الأثر: ما الذي يجب أن يتغيّر في العمل؟' }, { from_role: 'system', text_ar: 'أُغلق: حُلّ' }];
  const p = summaryPrompt(msgs); assert.ok(p.system.includes('لا تذكر أسماء') && p.system.includes('summary_ar')); assert.ok(p.user.includes('السائل:') && p.user.includes('المُستقبِل:'));
  const l = localSummary(msgs); assert.ok(l.startsWith('السؤال: كيف أبدأ')); assert.ok(l.includes('ما قيل: ابدأ بسؤال الأثر'));
  assert.equal(localSummary([]), 'السؤال: \nما قيل: —');
  assert.equal(AI_LIMITS.onair_summary, 40); assert.ok(AI_PURPOSE_LABEL.onair_summary.ar.includes('أَثَر معك'));
});

test('P33 وثيقة ATH-OA: Open Badges 3.0 · الساعات واللقاءات نتائج · لا بريد · لا نجوم · حالة الإبطال', () => {
  const hours = hoursFrom(Array.from({ length: 8 }, (_, i) => R({ id: i, status: 'done', kind: i % 2 ? 'session' : 'quick', duration_min: 80 })));
  const doc: any = buildOnAirDoc({ code: 'ATH-OA-TEST-0001', name: 'ريم الدوسري', face: 'expert', hours, site: 'https://athar-portal.vercel.app', did: 'did:web:athar-portal.vercel.app', now: new Date(NOW), statusIndex: 7 });
  assert.ok(doc.type.includes('OpenBadgeCredential')); assert.equal(doc.id, 'https://athar-portal.vercel.app/verify/vc?code=ATH-OA-TEST-0001');
  assert.equal(doc.credentialSubject.name, 'ريم الدوسري'); assert.equal(doc.credentialSubject.achievement.id, 'https://athar-portal.vercel.app/on-air');
  assert.deepEqual(doc.credentialSubject.result.map((r: any) => r.resultDescription), ['hours', 'meetings', 'face']); assert.equal(doc.credentialSubject.result[1].value, '8');
  assert.ok(doc.credentialStatus, 'قابلة للإبطال'); assert.equal(doc._athar.kind, 'on_air'); assert.equal(doc._athar.face_ar, 'خبير استشاري'); assert.equal(doc._athar.by_kind.session, 4);
  const s = JSON.stringify(doc); assert.ok(!/@x\.sa|@example\.com/.test(s), 'لا بريد'); assert.ok(/No ratings/.test(s), 'لا نجوم');
  assert.equal(buildOnAirDoc({ code: 'c', name: 'n', face: 'staff', hours, site: 's', did: 'd', statusIndex: null }).credentialStatus, undefined);
});

test('P33 خزنة أَثَر: الجداول الأربعة مسجَّلة · الحضور والنوافذ تُحذف · الطلب يُجهَّل ويبقى للساعات · الخيط يُحذف مع السائل · الغرف kind=support', () => {
  const by = Object.fromEntries(REGISTRY.map(r => [r.table, r]));
  for (const t of ['portal_onair_presence', 'portal_onair_windows', 'portal_onair_requests', 'portal_onair_messages']) assert.ok(by[t], `${t} في السجل`);
  assert.equal(by.portal_onair_presence.policy, 'delete'); assert.equal(by.portal_onair_windows.policy, 'delete'); assert.equal(by.portal_onair_requests.policy, 'anonymize'); assert.equal(by.portal_onair_messages.policy, 'delete');
  assert.deepEqual(by.portal_onair_requests.alsoKeys, [{ userCol: 'receiver_user_id', emailCol: null }]); assert.ok(by.portal_onair_requests.piiCols.includes('ip_hash'));
  assert.equal(by.portal_onair_messages.userCol, 'asker_user_id'); assert.equal(by.portal_onair_requests.retentionDays, 365);
  const plan = erasurePlan() as any; const all = JSON.stringify(plan); assert.ok(all.includes('portal_onair_presence') && all.includes('portal_onair_requests'), 'في خطة النسيان');
  assert.equal(ROOM_KIND_LABEL.support.ar, 'جلسة دعم — أَثَر معك'); assert.ok(ROOM_DEFAULT_PROMPT.support.includes('عشرون دقيقة'));
});
