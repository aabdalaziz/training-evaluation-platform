// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P10: المحاكيات (المعيار، الدرجة، البدائل المحلية، تنقية مخرجات النموذج)، كل يوم مهارة، مستشارك، أثير، الصفحة الحيّة، أدلة الملف المهاري
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SCENARIO, weightedTotal, scoreToLevel, bandLabel, learnerTurns, isFinished, cleanUtterance, localPersonaReply, localScore, sanitizeScore, simEvidenceEvent } from '../lib/portal/sim';
import type { Turn } from '../lib/portal/sim';
import { AI_LIMITS, AI_PURPOSE_LABEL, buildSimTurnPrompt, parseSimTurn, buildSimScorePrompt, buildDailyPrompt, parseDaily, localDaily, buildAdvisorPrompt, parseAdvisor, localAdvisor, localHello, parseHello, buildHelloPrompt, parseMemory, parseJsonLoose } from '../lib/ai/prompts';
import type { AdvisorFacts, CompanionContext, DailySkillFacts } from '../lib/ai/prompts';
import { buildFeed, countdown, advisorFacts, typewriter } from '../lib/portal/home';
import { evidenceFromEvent, EVIDENCE_WEIGHT, EVIDENCE_LABEL, SIMULATION_APPROVED_WEIGHT, computeSkillLevels } from '../lib/portal/profile';
import { NAV, CONTACT_SUBJECTS } from '../lib/portal/content';

const S = DEMO_SCENARIO;
const turnsOf = (...mine: string[]): Turn[] => { const out: Turn[] = [{ role: 'persona', text: S.persona.opening_ar, at: '2026-12-06T10:00:00Z' }]; mine.forEach((m, i) => { out.push({ role: 'learner', text: m, at: `2026-12-06T10:0${i + 1}:00Z` }); out.push({ role: 'persona', text: 'طيب', at: `2026-12-06T10:0${i + 1}:30Z` }); }); return out; };

test('P10 sim: rubric weights sum to 100 and weightedTotal respects weights', () => {
  assert.equal(S.rubric.reduce((a, r) => a + r.weight, 0), 100);
  const total = weightedTotal(S.rubric, [{ key: 'empathy', score: 100, note: '' }, { key: 'diagnosis', score: 0, note: '' }, { key: 'technique', score: 100, note: '' }, { key: 'check', score: 0, note: '' }]);
  assert.equal(total, 60); // 25 + 35
  assert.equal(weightedTotal(S.rubric, []), 0);
  assert.equal(weightedTotal(S.rubric, [{ key: 'empathy', score: 250, note: '' }]), 100); // يقصّ عند 100 ويحسب على الوزن المتاح فقط
});
test('P10 sim: score → level and band', () => {
  assert.equal(scoreToLevel(90, 3), 4); assert.equal(scoreToLevel(70, 3), 3); assert.equal(scoreToLevel(50, 3), 2); assert.equal(scoreToLevel(10, 3), 1); assert.equal(scoreToLevel(95, 5), 5);
  assert.equal(bandLabel(90, 'ar'), 'أداء متمكّن'); assert.equal(bandLabel(30, 'en'), 'Needs guided practice');
});
test('P10 sim: turns helpers and utterance cleaning', () => {
  const t = turnsOf('أهلًا رافي', 'جرّب معي');
  assert.equal(learnerTurns(t), 2); assert.equal(isFinished(S, t), false); assert.equal(isFinished(S, turnsOf('1', '2', '3')), true);
  assert.equal(cleanUtterance('  <b>مرحبا</b>   يا   رافي '), 'مرحبا يا رافي'); assert.equal(cleanUtterance('x'.repeat(1000)).length, 600);
});
test('P10 sim: local persona reacts to warmth/concreteness and closes at the limit', () => {
  const warm = localPersonaReply(S, turnsOf('لا بأس يا رافي، هذا طبيعي جدًا'));
  const cold = localPersonaReply(S, turnsOf('هذا خطأ، ركّز أكثر'));
  assert.notEqual(warm, cold); assert.ok(warm.includes('ما أسمع فرق'));
  const concrete = localPersonaReply(S, turnsOf('أحسنت', 'ضع لسانك بين أسنانك وقل: ظ… ثم ض'));
  assert.ok(concrete.includes('لساني'));
  const closing = localPersonaReply(S, turnsOf('1', '2', '3')); assert.ok(closing.includes('بكرة'));
  for (const slug of ['silent-class', 'impact-skeptic', 'design-in-two-days']) { const r = localPersonaReply({ ...S, slug, max_turns: 6 }, turnsOf('ما رأيك؟')); assert.ok(r.length > 5, slug); }
});
test('P10 sim: local scoring rewards concrete + warm + checking, and stays within bounds', () => {
  const weak = localScore(S, turnsOf('لا')); const strong = localScore(S, turnsOf('لا بأس يا رافي، هذا طبيعي — الفرق بين الصوتين دقيق.', 'جرّب معي: ضع طرف لسانك بين أسنانك وقل «ظ»، ثم ارفعه وقل «ض». مثال: ظهر / ضهر.', 'ممتاز! الآن كرر «ظهر» ثلاث مرات وأعد لي الفرق قبل أن تذهب.'));
  assert.ok(strong.total > weak.total, `${strong.total} > ${weak.total}`); assert.ok(weak.total >= 0 && strong.total <= 100);
  assert.equal(strong.criteria.length, 4); assert.ok(strong.criteria.every(c => c.score >= 0 && c.score <= 100)); assert.ok(strong.improve.length >= 1 && strong.strengths.length >= 1 && strong.expert_path.length > 10);
});
test('P10 sim: sanitizeScore clamps, fills missing criteria and rejects garbage', () => {
  assert.equal(sanitizeScore(null, S), null); assert.equal(sanitizeScore({ total: 90 }, S), null);
  const sc = sanitizeScore({ criteria: [{ key: 'empathy', score: 140, note: 'x' }, { key: 'bogus', score: 100 }], strengths: ['a', 'b', 'c', 'd'], improve: 'no', expert_path: 'e'.repeat(1000), closing_ar: 'أحسنت' }, S)!;
  assert.equal(sc.criteria.length, 4); assert.equal(sc.criteria[0].score, 100); assert.equal(sc.criteria[1].score, 50); assert.equal(sc.strengths.length, 3); assert.deepEqual(sc.improve, []); assert.equal(sc.expert_path.length, 600); assert.equal(sc.closing_ar, 'أحسنت');
  assert.equal(sc.total, weightedTotal(S.rubric, sc.criteria));
});
test('P10 sim: evidence event shape', () => {
  const ev = simEvidenceEvent({ id: 'r1', user_id: 'u1', email: 'a@b.c', score: { total: 77, criteria: [], strengths: [], improve: [], expert_path: '' } }, { ...S, skills: ['s1'] }, true);
  assert.equal(ev.verb, 'assessed'); assert.equal(ev.object_type, 'simulation'); assert.equal(ev.object_id, 'r1'); assert.deepEqual(ev.skills, ['s1']); assert.equal(ev.context.score, 77); assert.equal(ev.context.approved, true); assert.equal(ev.context.scenario, 'dad-dha');
});
test('P10 prompts: sim turn/score prompts keep persona in character and parse replies', () => {
  const t = turnsOf('أهلًا'); const p = buildSimTurnPrompt(S, t, 'ar');
  assert.ok(p.system.includes(S.persona.name) && p.system.includes('JSON') && p.system.includes('ابقَ في الشخصية')); assert.ok(p.user.includes('المتعلم: أهلًا')); assert.ok(!p.system.includes('آخر دور'));
  assert.ok(buildSimTurnPrompt(S, turnsOf('1', '2', '3'), 'ar').system.includes('آخر دور'));
  assert.equal(parseSimTurn('{"reply":"طيب أستاذ"}'), 'طيب أستاذ'); assert.equal(parseSimTurn({ reply: '' }), null); assert.equal(parseSimTurn('garbage'), null);
  const sp = buildSimScorePrompt(S, t, 'ar'); assert.ok(sp.user.includes('"key":"empathy"') || sp.user.includes('"key": "empathy"')); assert.ok(sp.user.includes('لا تُكافئ الطول'));
});
test('P10 limits/labels cover the new purposes', () => {
  for (const k of ['sim_turn', 'sim_score', 'daily_skill', 'advisor', 'companion'] as const) { assert.ok(AI_LIMITS[k] > 0, k); assert.ok(AI_PURPOSE_LABEL[k].ar.length > 2, k); }
  assert.ok(AI_LIMITS.sim_turn > AI_LIMITS.sim_score);
});
const DF: DailySkillFacts = { skill: { id: 's1', code: 'ATH-PD-001', name_ar: 'تصميم البرامج التدريبية', domain: 'pedagogy', description_ar: 'تحليل الاحتياج' }, day: '2026-12-06', weekday_ar: 'الأحد' };
test('P10 daily: prompt, parse and local lesson', () => {
  const p = buildDailyPrompt(DF, 'ar'); assert.ok(p.user.includes('ATH-PD-001') && p.system.includes('كل يوم مهارة'));
  const local = localDaily(DF); assert.equal(local.challenge.options.length, 4); assert.ok(local.challenge.correct >= 0 && local.challenge.correct <= 3); assert.ok(local.idea_ar.includes('تصميم البرامج التدريبية')); assert.ok(local.apply_ar.length > 10);
  assert.equal(parseDaily('nope'), null); assert.equal(parseDaily({ title_ar: 'x', idea_ar: 'y', challenge: { question_ar: 'q', options: ['a', 'b'], correct: 0 } }), null);
  const ok = parseDaily(JSON.stringify({ title_ar: 'ع', hook_ar: 'h', idea_ar: 'i', example_ar: 'e', challenge: { question_ar: 'q', options: ['1', '2', '3', '4'], correct: 7, explain_ar: 'x' }, apply_ar: 'a' }))!;
  assert.equal(ok.challenge.correct, 3); assert.equal(ok.challenge.options.length, 4);
});
const AF: AdvisorFacts = { services: [{ title: 'تعليم العربية', href: '/services/arabic', summary: 's' }], programs: [{ id: 'p1', name: 'برنامج الانغماس', fee: 1500, start: '2026-12-20', open: true }, { id: 'p9', name: 'مغلق', fee: null, start: null, open: false }], sessions: [{ id: 'l1', title: 'ندوة الأثر', when: '7 ديسمبر 18:00', free: true }], resources: 5, contact: { email: 'e', phone: 'p' } };
test('P10 advisor: local answers route by intent and only allowed links survive parsing', () => {
  assert.ok(localAdvisor('كم الرسوم؟', AF).answer_ar.includes('1500')); assert.ok(localAdvisor('أبحث عن دورة', AF).links.some(l => l.href === '/programs/p1')); assert.ok(localAdvisor('متى الندوة القادمة؟', AF).answer_ar.includes('ندوة الأثر'));
  assert.equal(localAdvisor('نريد تعاقدًا لمؤسسة', AF).handoff, true); assert.equal(localAdvisor('كيف أتحقق من شهادة؟', AF).links[0].href, '/verify'); assert.ok(localAdvisor('شيء غامض تمامًا', AF).confidence < 0.5);
  const parsed = parseAdvisor({ answer_ar: 'ج', links: [{ label: 'x', href: 'https://evil.example' }, { label: 'ok', href: '/programs/p1' }, { label: 'bad', href: '/programs/p404' }], handoff: 'yes', confidence: 3 }, AF)!;
  assert.deepEqual(parsed.links.map(l => l.href), ['/programs/p1']); assert.equal(parsed.handoff, true); assert.equal(parsed.confidence, 1); assert.equal(parseAdvisor({ links: [] }, AF), null);
  const p = buildAdvisorPrompt('س', AF, 'ar', 'companion'); assert.ok(p.system.includes('أثير')); assert.ok(buildAdvisorPrompt('س', AF, 'ar').system.includes('مستشارك'));
});
const CC: CompanionContext = { name: 'سارة أحمد', visits: 3, last_seen_days: 9, goals: ['أدرّب زملائي'], summary: '', weakest: { name: 'قياس الأثر', level: 2, days_since: 20 }, strongest: { name: 'التواصل', level: 4 }, daily_done: false, next_session: null, page: '/', hour: 9 };
test('P10 companion: proactive local hello picks the most relevant nudge', () => {
  const h = localHello(CC); assert.ok(h.greeting.includes('سارة') && h.greeting.includes('9 يومًا')); assert.ok(h.nudge.includes('قياس الأثر') && h.nudge.includes('20')); assert.equal(h.actions[0].href, '/sim'); assert.ok(h.actions.length <= 3);
  const h2 = localHello({ ...CC, weakest: null }); assert.ok(h2.nudge.includes('مهارة اليوم')); assert.equal(h2.actions[0].href, '/#daily');
  const h3 = localHello({ ...CC, weakest: null, daily_done: true, next_session: { id: 'l1', title: 'ندوة', when: 'غدًا' } }); assert.equal(h3.actions[0].href, '/live/l1');
  const first = localHello({ ...CC, visits: 0, name: '' }); assert.ok(first.greeting.includes('أنا أثير'));
  assert.ok(buildHelloPrompt(CC).user.includes('قياس الأثر'));
  const parsed = parseHello({ greeting: 'g', nudge: 'n', actions: [{ label: 'a', href: '/live/abc' }, { label: 'b', href: '/admin' }] })!; assert.deepEqual(parsed.actions.map(a => a.href), ['/live/abc']); assert.equal(parseHello({}), null);
  assert.equal(parseMemory('{"summary":"يهتم بقياس الأثر"}'), 'يهتم بقياس الأثر'); assert.equal(parseMemory(parseJsonLoose('x')), null);
});
test('P10 home: feed ordering, live detection, countdown and facts', () => {
  const now = '2026-12-06T10:00:00Z';
  const programs = [{ id: 'p1', name_ar: 'أ', start_date: '2026-12-20', registration_open: true, program_type: 'diploma', fee: 100, is_public: true }, { id: 'p2', name_ar: 'ب', start_date: '2026-12-10', registration_open: false, is_public: true }, { id: 'p3', name_ar: 'منتهٍ', end_date: '2026-01-01', is_public: true }];
  const sessions = [{ id: 'l1', title_ar: 'بث حي', starts_at: '2026-12-06T09:50:00Z', duration_min: 60, access: 'public' }, { id: 'l2', title_ar: 'لاحقًا', starts_at: '2026-12-08T15:00:00Z', access: 'public' }, { id: 'l3', title_ar: 'خاص', starts_at: '2026-12-07T15:00:00Z', access: 'private' }, { id: 'l4', title_ar: 'ملغاة', starts_at: '2026-12-07T15:00:00Z', status: 'cancelled' }];
  const feed = buildFeed(programs as any, sessions as any, now, 'ar');
  assert.equal(feed[0].id, 'l1'); assert.equal(feed[0].badge, 'يُبثّ الآن'); assert.equal(feed[1].id, 'l2'); assert.equal(feed[2].id, 'p1'); assert.ok(feed[2].badge.includes('التسجيل مفتوح') && feed[2].badge.includes('دبلوم')); assert.equal(feed[3].id, 'p2');
  assert.ok(feed.some(f => f.kind === 'sim')); assert.ok(feed.length <= 6); assert.ok(!feed.some(f => f.id === 'l3' || f.id === 'l4' || f.id === 'p3'));
  const cd = countdown('2026-12-08T15:00:00Z', Date.parse(now), 'ar'); assert.equal(cd.d, 2); assert.equal(cd.h, 5); assert.ok(cd.label.includes('بعد 2 يوم')); assert.equal(countdown(now, Date.parse(now) + 1000, 'en').past, true);
  const f = advisorFacts(programs as any, sessions as any, 7, now, 'ar'); assert.equal(f.programs.length, 2); assert.equal(f.sessions.length, 2); assert.equal(f.resources, 7); assert.ok(f.services.length >= 8);
  assert.equal(typewriter('abcdefgh', 2), 'abcdef'); assert.equal(typewriter('ab', 9), 'ab');
});
test('P10 profile: simulation and daily evidence feed the skills profile with the right weights', () => {
  const meta = new Map([['s1', { level: 3, code: 'ATH-AR-003' }]]);
  const pending = evidenceFromEvent({ at: '2026-12-06T10:00:00Z', verb: 'assessed', object_type: 'simulation', object_id: 'r1', skills: ['s1'], context: { score: 88, scenario: 'dad-dha', approved: false } }, meta);
  assert.equal(pending.length, 1); assert.equal(pending[0].e.kind, 'simulation'); assert.equal(pending[0].e.level, 4); assert.equal(pending[0].e.weight, EVIDENCE_WEIGHT.simulation);
  const approved = evidenceFromEvent({ at: '2026-12-06T10:00:00Z', verb: 'assessed', object_type: 'simulation', object_id: 'r1', skills: ['s1'], context: { score: 88, approved: true } }, meta);
  assert.equal(approved[0].e.weight, SIMULATION_APPROVED_WEIGHT); assert.ok(approved[0].e.label?.includes('✓'));
  assert.equal(evidenceFromEvent({ at: '2026-12-06T10:00:00Z', verb: 'assessed', object_type: 'simulation', object_id: 'r2', skills: ['s1'], context: { score: 88, rejected: true } }, meta).length, 0);
  const daily = evidenceFromEvent({ at: '2026-12-06T10:00:00Z', verb: 'assessed', object_type: 'daily', object_id: '2026-12-06', skills: ['s1'], context: { score: 100, day: '2026-12-06' } }, meta);
  assert.equal(daily[0].e.kind, 'daily'); assert.equal(daily[0].e.level, 3); assert.equal(daily[0].e.weight, 0.15); assert.ok(EVIDENCE_LABEL.daily.ar.length > 3 && EVIDENCE_LABEL.simulation.en.length > 3);
  const levels = computeSkillLevels('u1', [{ at: '2026-12-06T10:00:00Z', verb: 'assessed', object_type: 'simulation', object_id: 'r1', skills: ['s1'], context: { score: 88, approved: true } }], meta, new Date('2026-12-07T00:00:00Z'));
  assert.equal(levels.length, 1); assert.equal(levels[0].computed_level, 4); assert.ok(levels[0].confidence > 0);
});
test('P10 content: nav has simulators and contact subjects include advisor handoff', () => {
  assert.ok(NAV.some(n => n.href === '/sim')); assert.ok(CONTACT_SUBJECTS.some(s => s.value === 'advisor'));
});
