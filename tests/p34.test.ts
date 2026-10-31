// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P34 — «أَثَر معك — الهواء يتّسع»: الساعة الذهبية (الحالة والعدّاد ومفتاح الأسبوع) · الهواء الصامت (المطابقة) · صدى السؤال (التجهيل والمطالبة والتحليل)
//                 ميراث الهواء (من يرافق · الظلّ عند «أستقبل») · هواء الجهة (نطاق النداء · سطر الجهة k≥5) · الخريطة (المدن بلا أسماء) · الهواء بالإشارة (افتراضيات الحوار محليًا)
//                 رسالة في زجاجة (لا تنتهي بعد 3 دقائق · أولًا في الصفّ) · خزنة أَثَر · الكرون بلا كرون جديد
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTTLE_HOURS, SHADOW_REQUESTS, GOLDEN_REMIND_MIN, P34_NAMES_AR, isBottle, dialogDefaults, cleanGolden, weekKey, goldenState, countdownAr, canAdopt, shadowOnTake,
  CITY_POINTS, cityKey, liveMap, echoPrompt, localEcho, parseEcho, scrubPii, orgAirLine, quickExpired, rankQueue, matchReceivers, STATS_K, QUICK_TIMEOUT_MIN,
} from '../lib/onair/registry';
import type { Presence, Request } from '../lib/onair/registry';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';

const P = (o: Partial<Presence> & { user_id: string }): Presence => ({ email: `${o.user_id}@x`, face: 'expert', receives: ['quick', 'session'], domains: [], alt_link: null, on_air_until: new Date(Date.now() + 3600000).toISOString(), grounded_at: null, grounded_note: null, meta: {}, ...o });
const R = (o: Partial<Request> & { id: number }): Request => ({ kind: 'quick', status: 'open', asker_user_id: null, asker_email: null, asker_alias: 'سائل 1000', domain: null, text_ar: 'سؤال', receiver_user_id: null, room_code: null, taken_at: null, done_at: null, outcome: null, what_changed_ar: null, duration_min: null, meta: {}, created_at: new Date().toISOString(), ...o });

test('P34 — الأسماء الثمانية ثابتة والثوابت', () => {
  assert.deepEqual(Object.keys(P34_NAMES_AR), ['golden', 'quiet', 'echo', 'legacy', 'org', 'map', 'signed', 'bottle']);
  assert.equal(P34_NAMES_AR.bottle, 'رسالة في زجاجة'); assert.equal(P34_NAMES_AR.golden, 'ساعة الهواء الذهبية');
  assert.equal(BOTTLE_HOURS, 72); assert.equal(SHADOW_REQUESTS, 5); assert.equal(GOLDEN_REMIND_MIN, 60);
});

test('P34 — 8) رسالة في زجاجة: لا تنتهي بعد 3 دقائق، وتبقى 72 ساعة، وتأتي أولًا في الصفّ', () => {
  const old = new Date(Date.now() - (QUICK_TIMEOUT_MIN + 1) * 60000).toISOString();
  assert.equal(quickExpired(R({ id: 1, created_at: old })), true, 'عادي ينتهي');
  assert.equal(quickExpired(R({ id: 2, created_at: old, meta: { bottle: true } })), false, 'الزجاجة لا تنتهي بعد 3 دقائق');
  assert.equal(quickExpired(R({ id: 3, created_at: new Date(Date.now() - (BOTTLE_HOURS + 1) * 3600000).toISOString(), meta: { bottle: true } })), true, 'تنتهي بعد 72 ساعة');
  assert.ok(isBottle({ meta: { bottle: true } }) && !isBottle({ meta: {} }) && !isBottle({ meta: null }), 'isBottle');
  const q = rankQueue([R({ id: 1, created_at: new Date(Date.now() - 60000).toISOString(), domain: 'تقويم' }), R({ id: 2, created_at: new Date(Date.now() - 30000).toISOString(), meta: { bottle: true } })], { receives: ['quick'], domains: ['تقويم'] });
  assert.equal(q[0].id, 2, 'الزجاجة أولًا ولو كان الآخر في مجالي وأقدم');
});

test('P34 — 2) الهواء الصامت: من يفضّل النص يُقدَّم له المُستقبِل النصّي؛ والنصّي لا يرى جلسة صوتية صريحة', () => {
  const a = P({ user_id: 'a', text_only: false, on_air_until: new Date(Date.now() + 1000000).toISOString() }), b = P({ user_id: 'b', text_only: true, on_air_until: new Date(Date.now() + 2000000).toISOString() });
  assert.equal(matchReceivers([a, b], R({ id: 1, meta: { prefer_text: true } }))[0].user_id, 'b', 'النصّي أولًا عند تفضيل النص');
  assert.equal(matchReceivers([a, b], R({ id: 1 }))[0].user_id, 'a', 'بلا تفضيل: الأقرب انتهاءً أولًا كما كان');
  const q = rankQueue([R({ id: 1, kind: 'session', meta: { prefer_text: false } }), R({ id: 2, kind: 'session' })], { receives: ['session'], domains: [], text_only: true });
  assert.deepEqual(q.map(r => r.id), [2], 'الجلسة الصوتية الصريحة تُخفى عن النصّي');
});

test('P34 — 7) الهواء بالإشارة: افتراضيات الحوار تُحسب محليًا من «احتياجاتي» ولا تُغيّر شيئًا لمن لا احتياج له', () => {
  const s = dialogDefaults(['sign_language']); assert.equal(s.grade, 'session'); assert.equal(s.interpreter, true); assert.equal(s.prefer_text, true); assert.ok(s.note_ar, 'ملاحظة تظهر للسائل');
  const h = dialogDefaults(['hard_hearing']); assert.equal(h.grade, null); assert.equal(h.interpreter, false); assert.equal(h.prefer_text, true);
  const n = dialogDefaults([]); assert.deepEqual(n, { grade: null, interpreter: false, prefer_text: false, note_ar: null });
  assert.deepEqual(dialogDefaults(null), n, 'null آمن');
});

test('P34 — 1) ساعة الهواء الذهبية: التنظيف · الحالة (قادمة/جارية) · مفتاح الأسبوع · العدّاد بالعربية', () => {
  assert.equal((cleanGolden({ weekday: 9 }) as any).ok, false); assert.equal((cleanGolden({ weekday: 2, from_min: 1200, duration_min: 10 }) as any).ok, false, 'المدة ≥ 30');
  const g = cleanGolden({ weekday: 2, from_min: 1200, duration_min: 60, title_ar: '  ساعة   الثلاثاء ' }); assert.ok(g.ok && g.g.title_ar === 'ساعة الثلاثاء' && g.g.duration_min === 60, 'تنظيف العنوان');
  // الثلاثاء 20:00 الرياض = 17:00Z؛ الآن الثلاثاء 17:30Z → جارية
  const tue = new Date(Date.UTC(2026, 10, 3, 17, 30, 0)); assert.equal(tue.getUTCDay(), 2, 'تاريخ الاختبار ثلاثاء');
  const live = goldenState({ weekday: 2, from_min: 1200, duration_min: 60 }, tue); assert.equal(live.live, true); assert.equal(live.minutes_to, 0);
  const before = goldenState({ weekday: 2, from_min: 1200, duration_min: 60 }, new Date(Date.UTC(2026, 10, 3, 16, 0, 0))); assert.equal(before.live, false); assert.equal(before.minutes_to, 60);
  const after = goldenState({ weekday: 2, from_min: 1200, duration_min: 60 }, new Date(Date.UTC(2026, 10, 3, 18, 30, 0))); assert.equal(after.live, false); assert.equal(after.minutes_to, 7 * 1440 - 90, 'الأسبوع القادم');
  assert.equal(before.week_key, live.week_key, 'نفس الأسبوع قبل وأثناء'); assert.notEqual(after.week_key, live.week_key, 'بعد الانتهاء → الأسبوع التالي');
  assert.match(weekKey(new Date(Date.UTC(2026, 0, 1))), /^2026-W01$/); assert.match(weekKey(new Date(Date.UTC(2026, 11, 31))), /^2026-W53$/);
  assert.equal(countdownAr(0), 'الآن'); assert.equal(countdownAr(1), 'بعد دقيقة'); assert.equal(countdownAr(2), 'بعد دقيقتان'.replace('دقيقتان', 'دقيقتان')); assert.equal(countdownAr(90), 'بعد ساعة و30 دقائق'); assert.equal(countdownAr(1440 * 2 + 60), 'بعد يومان وساعة');
});

test('P34 — 4) ميراث الهواء: حامل ATH-OA وحده يرافق؛ لا نفسه؛ لا من له مرافق؛ والظلّ ينقص عند «أستقبل» حتى يكتمل', () => {
  assert.equal((canAdopt({ eligible: false, id: 'm' }, null) as any).ok, false, 'غير مؤهّل');
  assert.equal((canAdopt({ eligible: true, id: 'm' }, { user_id: 'm', mentor_status: null, shadow_left: 0 }) as any).ok, false, 'نفسه');
  assert.equal((canAdopt({ eligible: true, id: 'm' }, { user_id: 'n', mentor_status: 'accepted', shadow_left: 3 }) as any).ok, false, 'له مرافق');
  assert.ok((canAdopt({ eligible: true, id: 'm' }, { user_id: 'n', mentor_status: 'done', shadow_left: 0 }) as any).ok, 'اكتملت السابقة → يجوز');
  assert.ok((canAdopt({ eligible: true, id: 'm' }, null) as any).ok, 'لا حضور بعد → يجوز');
  assert.deepEqual(shadowOnTake({ mentor_user_id: 'm', mentor_status: 'invited', shadow_left: 5 }), { shadow_user_id: null, patch: null }, 'قبل القبول لا ظلّ');
  assert.deepEqual(shadowOnTake({ mentor_user_id: 'm', mentor_status: 'accepted', shadow_left: 5 }), { shadow_user_id: 'm', patch: { shadow_left: 4 } });
  assert.deepEqual(shadowOnTake({ mentor_user_id: 'm', mentor_status: 'accepted', shadow_left: 1 }), { shadow_user_id: 'm', patch: { shadow_left: 0, mentor_status: 'done' } }, 'الخامس يُكمل');
  assert.deepEqual(shadowOnTake({ mentor_user_id: 'm', mentor_status: 'accepted', shadow_left: 0 }), { shadow_user_id: null, patch: null });
});

test('P34 — 5) هواء الجهة: النداء داخل الجهة فقط؛ وسطر «أثر الجهة» يحترم k≥5 للسائلين', () => {
  const a = P({ user_id: 'in' }), b = P({ user_id: 'out' });
  assert.deepEqual(matchReceivers([a, b], { ...R({ id: 1 }), org_id: 'org1' }, Date.now(), new Set(['in'])).map(p => p.user_id), ['in']);
  assert.equal(matchReceivers([a, b], R({ id: 1 }), Date.now(), new Set(['in'])).length, 2, 'بلا org_id يُنادى الجميع');
  assert.equal(orgAirLine({ hours_given: 0, meetings_given: 0, hours_received: 0, askers: 3 }), null, 'لا شيء قبل k');
  assert.equal(orgAirLine({ hours_given: 2.5, meetings_given: 4, hours_received: 0, askers: 2 }), 'منسوبوها قدّموا 2.5 ساعة على الهواء في 4 لقاءً');
  assert.match(orgAirLine({ hours_given: 2.5, meetings_given: 4, hours_received: 1, askers: STATS_K })!, /و5 من منسوبيها سألوا$/);
});

test('P34 — 6) خريطة الحضور الحيّة: مدن بأعداد، بلا أسماء ولا معرّفات؛ المجهول يُعدّ «أخرى»', () => {
  assert.equal(cityKey('المدينة المنورة'), 'madinah'); assert.equal(cityKey('Jeddah'), 'jeddah'); assert.equal(cityKey('الرياض - حي الملقا'), 'riyadh'); assert.equal(cityKey('قرية بعيدة'), null); assert.equal(cityKey(''), null);
  for (const k of Object.keys(CITY_POINTS)) { const c = CITY_POINTS[k]; assert.ok(c.x >= 0 && c.x <= 100 && c.y >= 0 && c.y <= 100 && c.ar, `نقطة ${k}`); }
  const m = liveMap([{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }, { user_id: 'd' }], { a: 'المدينة المنورة', b: 'جدة', c: 'المدينة المنورة', d: null });
  assert.equal(m.total, 4); assert.equal(m.other, 1); assert.deepEqual(m.points.map(p => [p.key, p.n]), [['madinah', 2], ['jeddah', 1]]);
  assert.ok(!JSON.stringify(m).includes('user_id') && !JSON.stringify(m).includes('"a"'), 'لا معرّفات في الخريطة');
});

test('P34 — 3) صدى السؤال: التجهيل قبل النموذج · المطالبة بلا أسماء · التحليل يرفض الناقص · البديل المحلي', () => {
  assert.equal(scrubPii('راسلني على x@y.sa أو 0551234567 أو https://a.b/c'), 'راسلني على [بريد] أو [رقم] أو [رابط]');
  const p = echoPrompt({ text_ar: 'كيف أقنع الإدارة بمؤشر أداء بدل استبانة الرضا؟', summary_ar: 'اعرض مؤشرًا واحدًا من العمل', domain: 'تقويم' });
  assert.match(p.system, /بلا أسماء/); assert.match(p.user, /المجال: تقويم/); assert.match(p.system, /title_ar/);
  assert.equal(parseEcho({ title_ar: 'x' }), null, 'ناقص'); assert.equal(parseEcho({ title_ar: 'x', situation_ar: 'y', ask_ar: 'z', rubric: ['1'] }), null, 'معيار واحد لا يكفي');
  const ok = parseEcho({ title_ar: ' عنوان ', situation_ar: 'موقف', ask_ar: 'مطلوب', rubric: ['أ', ' ب ', '', 'ج'] }); assert.ok(ok && ok.title_ar === 'عنوان' && ok.rubric.length === 3, 'تنظيف');
  const l = localEcho({ text_ar: 'سؤال طويل '.repeat(20), summary_ar: '', domain: null }); assert.ok(l.title_ar.length <= 60 && l.rubric.length === 3 && l.ask_ar, 'البديل المحلي صالح');
  assert.ok(parseEcho(l), 'البديل المحلي يمرّ من التحليل');
  assert.equal(AI_LIMITS.onair_echo, 20); assert.match(AI_PURPOSE_LABEL.onair_echo.ar, /صدى السؤال/);
});

test('P34 — خزنة أَثَر: التعهّدات شخصية؛ الساعة والصدى غير شخصيين', () => {
  const t = REGISTRY.find(r => r.table === 'portal_onair_golden_pledges'); assert.ok(t && t.userCol === 'user_id' && t.policy === 'delete', 'التعهّدات في الخزنة');
  assert.ok(NON_PERSONAL_TABLES.includes('portal_onair_golden') && NON_PERSONAL_TABLES.includes('portal_onair_echoes'), 'غير شخصية');
});
