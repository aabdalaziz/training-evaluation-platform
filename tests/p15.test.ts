// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P15 — «الحلقة المغلقة»: فجوات البرامج بدليل، مهمات تُغلق قناة النقل، تركيز الجلسة، بطاقة الصف (مجهولة بلا درجات)،
//                 توقّع القدرة المؤسسية (نافذتا 45 يومًا + «لا دليل كافٍ»)، خطوات الجهة، «ما تعلّمته أَثَر هذا الشهر»، تعلّم الأولوية
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../lib/portal/evidence';
import type { GraphSources } from '../lib/portal/evidence';
import { programGaps, channelGaps, sessionFocus, learnerCards, classSummary, forecastSkills, weatherLine, orgSteps, monthlyLearning, learnedScore, ideaN, decisionN, KIND_LABEL_AR, TREND_AR, WEAK_PEOPLE, slug } from '../lib/portal/loop';
import type { Suggestion } from '../lib/portal/loop';
import { manualFingerprint } from '../lib/portal/loop-cron';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SK1 = U(1), SK2 = U(2), SK3 = U(3), P1 = 'p1', S1 = U(55), ORG1 = U(70);
const META = new Map([[SK1, { level: 3, code: 'A', name_ar: 'التقويم الصفي' }], [SK2, { level: 3, code: 'B', name_ar: 'إدارة الحوار' }], [SK3, { level: 4, code: 'C', name_ar: 'قياس الأثر' }]]);
const TODAY = '2026-10-28';
const ago = (d: number) => new Date(Date.parse(TODAY + 'T09:00:00Z') - d * 86400000).toISOString();

/** ذاكرة: SK1 مغطّاة ببرنامج ومهمات (≥5 أشخاص) · SK2 فقط حضور جلسات (لا نقل) · SK3 يحتاجها القطاع ولا برنامج عليها */
function sources(people = 7): GraphSources {
  const events: GraphSources['events'] = [];
  for (let i = 0; i < people; i++) {
    const uid = U(100 + i);
    events.push({ at: `2026-0${1 + (i % 9)}-10T09:00:00Z`, user_id: uid, verb: 'completed', object_type: 'program', object_id: P1, skills: [SK1], context: { program_id: P1 } });
    events.push({ at: `2026-05-1${i % 9}T09:00:00Z`, user_id: uid, verb: 'assessed', object_type: 'mission', object_id: `m${i}`, skills: [SK1], context: { score: 80, confirmed: true } });
    events.push({ at: `2026-06-0${1 + (i % 9)}T09:00:00Z`, user_id: uid, verb: 'attended', object_type: 'session', object_id: S1, skills: [SK2], context: { session_id: S1 } });
  }
  return {
    events,
    skills: [{ id: SK1, code: 'A', name_ar: 'التقويم الصفي', level: 3, sector: 'education' }, { id: SK2, code: 'B', name_ar: 'إدارة الحوار', level: 3, sector: 'education' }, { id: SK3, code: 'C', name_ar: 'قياس الأثر', level: 4, sector: 'education' }] as any,
    programs: [{ id: P1, name_ar: 'برنامج التقويم', sector: 'education' }],
    sessions: [{ id: S1, title_ar: 'جلسة الحوار', trainer_id: 't1', sector: 'education', skills: [SK2], program_id: P1, organization_id: ORG1 }],
    trainers: [{ id: 't1', full_name: 'د. سارة' }], scenarios: [], missions: [], registrations: [], enrollments: [],
    orgs: [{ id: ORG1, name_ar: 'جامعة', sector: 'education' }], sectors: [{ code: 'education', name_ar: 'التعليم' }], contracts: [], today: TODAY,
  } as any;
}

test('p15: فجوة برنامج — المهارة التي يحتاجها القطاع بلا برنامج تظهر بدليل، والمغطّاة لا تظهر', () => {
  const g = buildGraph(sources()); const gaps = programGaps(g);
  assert.ok(gaps.some(x => x.target.skill_id === SK3), 'SK3 بلا برنامج → فجوة');
  assert.ok(!gaps.some(x => x.target.skill_id === SK2), 'SK2 حضورها ضمن جلسة تابعة للبرنامج P1 و7 أشخاص → مغطّاة');
  assert.ok(!gaps.some(x => x.target.skill_id === SK1), 'SK1 مغطّاة ببرنامج و7 أشخاص → ليست فجوة');
  const g3 = gaps.find(x => x.target.skill_id === SK3)!;
  assert.equal(g3.kind, 'program'); assert.equal(g3.fingerprint, `program|sector:education|skill:${SK3}`);
  assert.ok(g3.evidence.length >= 5, 'سلسلة دليل'); assert.ok(String(g3.target.gap_ar).includes('قياس الأثر'), 'gap_ar يُملأ لهندسة البرامج'); assert.ok(g3.score > 0 && g3.score <= 100, 'score');
  assert.ok(g3.why_ar.includes('لا يوجد برنامج'), 'السبب صريح');
});

test('p15: مهمة تُغلق قناة النقل — تظهر للمهارة التي دليلها حضور فقط ولا تظهر لمن لديها مهمات', () => {
  const g = buildGraph(sources()); const ms = channelGaps(g);
  assert.ok(ms.some(x => x.target.skill_id === SK2), 'SK2: حضور فقط → مهمة مقترحة');
  assert.ok(!ms.some(x => x.target.skill_id === SK1), 'SK1: نقل عبر مهمات ≥ 30% → لا اقتراح');
  const m = ms.find(x => x.target.skill_id === SK2)!; assert.equal(m.kind, 'mission'); assert.equal(m.fingerprint, `mission|skill:${SK2}`); assert.equal(m.target.dominant_channel, 'session', 'القناة المهيمنة: الجلسات');
  // أقل من 5 أشخاص → لا اقتراح (لا تخمين بدليل ضعيف)
  assert.equal(channelGaps(buildGraph(sources(3))).length, 0, 'أقل من WEAK_PEOPLE');
  assert.equal(WEAK_PEOPLE, 5);
});

test('p15: تركيز الجلسة — مهارات البرنامج مرتّبة من الأقل دليلًا مع الحالة الصادقة', () => {
  const g = buildGraph(sources()); const f = sessionFocus(g, P1, [SK1, SK3]);
  assert.equal(f[0].skill_id, SK3); assert.equal(f[0].status, 'none'); assert.equal(f[0].evidence, 0);
  assert.equal(f[1].skill_id, SK1); assert.equal(f[1].status, 'strong'); assert.ok(f[1].evidence >= 7, 'دليل SK1');
  assert.equal(sessionFocus(buildGraph(sources(2)), P1, [SK1])[0].status, 'weak', 'شخصان → ضعيف');
});

test('p15: بطاقة الصف — مفاتيح مجهولة، ما أثبته/ما لم يُفحص/قناته، وبلا أي درجة', () => {
  const ev: GraphSources['events'] = [
    { at: ago(20), user_id: 'a', verb: 'assessed', object_type: 'mission', object_id: 'm1', skills: [SK1], context: { score: 91, confirmed: true } },
    { at: ago(18), user_id: 'a', verb: 'attended', object_type: 'session', object_id: 's9', skills: [SK1], context: {} },
    { at: ago(10), email: 'B@X.SA', verb: 'attended', object_type: 'session', object_id: 's9', skills: [SK2], context: {} },
    { at: ago(9), email: 'b@x.sa', verb: 'viewed', object_type: 'resource', object_id: 'r', skills: [SK1], context: {} },
  ];
  const cards = learnerCards(ev, [SK1, SK2], META, [{ key: 'م1', user_id: 'a' }, { key: 'م2', email: 'b@x.sa' }, { key: 'م3', user_id: 'zzz' }]);
  assert.equal(cards.length, 3);
  assert.deepEqual(cards[0].proven.map(p => p.skill_id), [SK1]); assert.deepEqual(cards[0].unexamined.map(u => u.skill_id), [SK2]); assert.equal(cards[0].best_channel, 'mission'); assert.equal(cards[0].one_channel, false);
  assert.deepEqual(cards[1].proven.map(p => p.skill_id), [SK2], 'البريد يُطابَق بلا حساسية لحالة الأحرف'); assert.equal(cards[1].evidence, 1, 'المشاهدة لا تُحسب دليلًا'); assert.equal(cards[1].one_channel, true);
  assert.equal(cards[2].evidence, 0); assert.equal(cards[2].unexamined.length, 2);
  assert.ok(!JSON.stringify(cards).includes('91'), 'لا درجات في البطاقة');
  const sum = classSummary(cards, [SK1, SK2], META);
  assert.equal(sum.no_evidence, 1); assert.equal(sum.one_channel, 1); assert.ok(sum.hints.length >= 1 && sum.hints.length <= 3, 'تلميحات 1–3'); assert.ok(sum.hints.some(h => h.includes('بلا أي دليل سابق')), 'تلميح للمتعلم بلا دليل');
});

test('p15: طقس القدرة — تذوي/ترتفع من نافذتي 45 يومًا، و«لا دليل كافٍ» تحت 3 أشخاص، وخطوات تغيّر التوقع', () => {
  const ev: GraphSources['events'] = [];
  for (let i = 0; i < 5; i++) {
    ev.push({ at: ago(70 + i), user_id: `u${i}`, verb: 'assessed', object_type: 'mission', object_id: `a${i}`, skills: [SK1], context: { score: 80, confirmed: true } });
    ev.push({ at: ago(60 + i), user_id: `u${i}`, verb: 'assessed', object_type: 'mission', object_id: `b${i}`, skills: [SK1], context: { score: 80, confirmed: true } });
    ev.push({ at: ago(10 + i), user_id: `u${i}`, verb: 'attended', object_type: 'session', object_id: 's', skills: [SK2], context: {} });
    ev.push({ at: ago(8 + i), user_id: `u${i}`, verb: 'assessed', object_type: 'mission', object_id: `c${i}`, skills: [SK2], context: { score: 80, confirmed: true } });
  }
  ev.push({ at: ago(5), user_id: 'u0', verb: 'attended', object_type: 'session', object_id: 's2', skills: [SK1], context: {} });
  ev.push({ at: ago(3), user_id: 'u1', verb: 'assessed', object_type: 'mission', object_id: 'z', skills: [SK3], context: { score: 70, confirmed: true } });
  ev.push({ at: ago(200), user_id: 'u1', verb: 'assessed', object_type: 'mission', object_id: 'old', skills: [SK3], context: { score: 70, confirmed: true } });
  const f = forecastSkills(ev, META, TODAY);
  const f1 = f.find(x => x.skill_id === SK1)!, f2 = f.find(x => x.skill_id === SK2)!, f3 = f.find(x => x.skill_id === SK3)!;
  assert.equal(f1.trend, 'fading'); assert.ok(f1.slope < -0.25, 'ميل سالب'); assert.equal(f1.people, 5); assert.equal(f1.steps[0].kind, 'program', 'أول خطوة للمهارة الذاوية: تجديد قصير');
  assert.equal(f2.trend, 'rising'); assert.equal(f2.prior_weight, 0); assert.equal(f2.slope, 1);
  assert.equal(f3.trend, 'unknown', 'شخص واحد → لا دليل كافٍ'); assert.equal(f3.evidence, 1, 'الحدث الأقدم من 90 يومًا يُهمَل');
  assert.equal(f[0].trend, 'fading', 'الذاوي أولًا');
  assert.ok(f.every(x => x.steps.length <= 3), '≤ 3 خطوات');
  assert.ok(weatherLine(f).includes('مهارة واحدة ترتفع') && weatherLine(f).includes('1 تذوي') && weatherLine(f).includes('التقويم الصفي'), weatherLine(f));
  assert.ok(weatherLine([f3]).startsWith('لا دليل كافٍ'), 'سطر صادق عند غياب الدليل');
  assert.equal(TREND_AR.unknown, 'لا دليل كافٍ');
  const steps = orgSteps(ORG1, 'وزارة', f); assert.equal(steps.length, 1); assert.equal(steps[0].kind, 'org_step'); assert.equal(steps[0].fingerprint, `org_step|${ORG1}|${SK1}`); assert.ok(steps[0].title_ar.includes('وزارة') && steps[0].title_ar.includes('تذوي'), steps[0].title_ar);
});

test('p15: ما تعلّمته أَثَر هذا الشهر — عدّ الشهر فقط، دروس صادقة، والأولوية تتعلّم من نسب القبول', () => {
  const rows = [
    { at: '2026-10-02T00:00:00Z', kind: 'program', action: 'proposed' }, { at: '2026-10-03T00:00:00Z', kind: 'program', action: 'proposed' }, { at: '2026-10-04T00:00:00Z', kind: 'program', action: 'proposed' },
    { at: '2026-10-05T00:00:00Z', kind: 'program', action: 'accepted' }, { at: '2026-10-05T00:00:01Z', kind: 'program', action: 'outcome' },
    { at: '2026-10-06T00:00:00Z', kind: 'mission', action: 'proposed' }, { at: '2026-10-06T00:00:00Z', kind: 'mission', action: 'proposed' }, { at: '2026-10-06T00:00:00Z', kind: 'mission', action: 'proposed' }, { at: '2026-10-07T00:00:00Z', kind: 'mission', action: 'dismissed' }, { at: '2026-10-08T00:00:00Z', kind: 'mission', action: 'expired' },
    { at: '2026-09-20T00:00:00Z', kind: 'program', action: 'proposed' }, { at: '2026-09-21T00:00:00Z', kind: 'program', action: 'accepted' },
  ];
  const m = monthlyLearning(rows, '2026-10-01');
  assert.equal(m.proposed, 6); assert.equal(m.accepted, 1); assert.equal(m.dismissed, 1); assert.equal(m.expired, 1); assert.equal(m.outcomes, 1); assert.equal(m.acceptance, 17);
  assert.ok(m.lessons.some(l => l.includes('اقترحت الحلقة 6 أفكار')), m.lessons.join(' | '));
  assert.ok(m.lessons.some(l => l.includes('قرار واحد ترك')), 'مطابقة العدد');
  assert.equal(ideaN(1), 'فكرة واحدة'); assert.equal(ideaN(11), '11 فكرة'); assert.equal(decisionN(2), 'قراران');
  assert.ok(!m.lessons.some(l => l.includes('يُرفض')), 'لا حكم «يُرفض غالبًا» قبل 3 قرارات فعلية');
  const m2 = monthlyLearning([...rows, { at: '2026-10-09T00:00:00Z', kind: 'mission', action: 'dismissed' }, { at: '2026-10-10T00:00:00Z', kind: 'mission', action: 'dismissed' }], '2026-10-01');
  assert.ok(m2.lessons.some(l => l.includes('مهمة تُغلق قناة') && l.includes('يُرفض') && l.includes('(0/3)')), m2.lessons.join(' | '));
  assert.ok(m.lessons.some(l => l.includes('أثرًا مسجَّلًا')), 'أثر مسجَّل');
  assert.deepEqual(monthlyLearning([], '2026-10-01').lessons, ['لا قرارات بعد هذا الشهر — أول اعتماد أو رفض يبدأ تاريخ تعلّم أَثَر.']);
  // الأولوية المتعلَّمة: لا تغيير تحت 3 اقتراحات؛ قبول 100% → ×1.4؛ قبول 0% → ×0.6
  assert.equal(learnedScore(50, 'program', {}), 50); assert.equal(learnedScore(50, 'program', { program: { proposed: 9, accepted: 0, dismissed: 0 } }), 50, 'لا عقوبة على ما لم يُقرَّر');
  assert.equal(learnedScore(50, 'program', { program: { proposed: 2, accepted: 1, dismissed: 1 } }), 50, 'أقل من 3 قرارات → بلا تغيير');
  assert.equal(learnedScore(50, 'program', { program: { proposed: 4, accepted: 4, dismissed: 0 } }), 70); assert.equal(learnedScore(50, 'mission', { mission: { proposed: 3, accepted: 0, dismissed: 3 } }), 30);
  assert.equal(learnedScore(90, 'program', { program: { proposed: 4, accepted: 4, dismissed: 0 } }), 100, 'سقف 100');
});

test('p15: مفردات وبصمات مستقرة', () => {
  assert.deepEqual(Object.keys(KIND_LABEL_AR), ['program', 'mission', 'session_focus', 'org_step']);
  assert.equal(KIND_LABEL_AR.program, 'برنامج من فجوة'); assert.equal(KIND_LABEL_AR.org_step, 'خطوة للجهة');
  assert.equal(slug('قياس الأثر — Training 2030!'), 'قياس-الأثر-training-2030');
  assert.equal(manualFingerprint('program', 'قياس الأثر'), 'program|manual|قياس-الأثر');
  const g = buildGraph(sources()); const a: Suggestion[] = [...programGaps(g), ...channelGaps(g)]; const b = [...programGaps(g), ...channelGaps(g)];
  assert.deepEqual(a.map(x => x.fingerprint), b.map(x => x.fingerprint), 'نفس الذاكرة → نفس البصمات (لا تكرار بين الدورات)');
  assert.ok(a.every(x => x.why_ar.length > 20 && x.evidence.length >= 3), 'كل اقتراح يحمل سببًا وسلسلة دليل');
});
