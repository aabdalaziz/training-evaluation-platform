// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P13-أ: المعجم (المجالات H1–H12، العائلات F1–F8، تقويم المناسبات، خريطة الجدارات ومؤشراتها)، «كل يوم بناء» (اختيار الموقف حسب
// اليوم والمناسبة، التقويم المحلي للاستجابات، التحليل الآمن لمخرجات الذكاء الاصطناعي، السلسلة)، وهندسة البرامج التدريبية (التحقق، الاستشراف، التصميم، المراجعة، حمولة النشر).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUMAN_DOMAINS, FAMILIES, EVENTS, SECTORS_2062, eventsFor, upcomingEvents, legacyToDomain, domainByCode, domainMap, balanceIndex, hcri, readinessIndex, indexBand, weakestDomains, lexiconIssues, HORIZONS } from '../lib/portal/lexicon';
import { CASE_BANK, pickSeed, seedToCase, localEvaluate, parseCase, parseEval, streakOf, bandOf, eventLine, buildCasePrompt, buildEvalPrompt, MIN_RESPONSE_CHARS, DOMAIN_OF_DAY, RUBRIC_LABEL } from '../lib/portal/daily-case';
import { EMPTY_NEED, validateNeed, needPayload, draftTitle, localForesight, localDesign, localReview, parseForesight, parseDesign, parseReview, programPayload, nextStage, factoryStats, STAGES } from '../lib/portal/factory';
import type { Draft, Need } from '../lib/portal/factory';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';
import { EVIDENCE_WEIGHT, evidenceFromEvent } from '../lib/portal/profile';

// ---------------------------------------------------------------- المعجم
test('lexicon: 12 domains with unique codes/H-numbers, 4 personal, 8 families cover all domains', () => {
  assert.equal(HUMAN_DOMAINS.length, 12);
  assert.equal(new Set(HUMAN_DOMAINS.map(d => d.code)).size, 12); assert.equal(new Set(HUMAN_DOMAINS.map(d => d.h)).size, 12);
  assert.equal(HUMAN_DOMAINS.filter(d => d.personal).length, 4);
  assert.deepEqual(HUMAN_DOMAINS.filter(d => d.personal).map(d => d.h), ['H1', 'H4', 'H6', 'H12']);
  assert.equal(FAMILIES.length, 8);
  const covered = new Set(FAMILIES.flatMap(f => f.domains)); for (const d of HUMAN_DOMAINS) assert.ok(covered.has(d.code), `domain ${d.code} must feed a family`);
  for (const d of HUMAN_DOMAINS) { assert.ok(d.name.ar && d.name.en && d.question.ar && d.scarce_2062.ar, d.code); }
});

test('lexicon: legacy domain mapping is total and stable', () => {
  assert.equal(legacyToDomain('arabic'), 'language'); assert.equal(legacyToDomain('quality'), 'judgment'); assert.equal(legacyToDomain('data_ai'), 'digital_sovereignty');
  assert.equal(legacyToDomain('pedagogy'), 'professional'); assert.equal(legacyToDomain('whatever'), 'professional'); assert.equal(legacyToDomain(null), 'professional');
  assert.equal(domainByCode('nope'), null); assert.equal(domainByCode('judgment')?.h, 'H2');
});

test('lexicon: calendar events — national day, Arabic language day, quality month, anticipation window', () => {
  assert.ok(EVENTS.length >= 20); assert.equal(new Set(EVENTS.map(e => e.code)).size, EVENTS.length);
  const nat = eventsFor('2026-09-23'); assert.ok(nat.some(a => a.event.code === 'national_day' && a.exact), 'national day exact');
  const arabic = eventsFor('2026-12-18'); assert.ok(arabic.some(a => a.event.code === 'arabic_day' && a.exact)); assert.ok(arabic.some(a => a.event.code === 'arabic_month'), 'Arabic month also active');
  const before = eventsFor('2026-12-16'); const al = before.find(a => a.event.code === 'arabic_day'); assert.ok(al && !al.exact && al.distance === 2, 'two days before → anticipation');
  assert.ok(!eventsFor('2026-12-10').some(a => a.event.code === 'arabic_day'), 'outside window');
  const nov = eventsFor('2026-11-05'); assert.ok(nov.some(a => a.event.code === 'quality_month' && a.event.kind === 'month'), 'a month-long occasion is active all month');
  assert.deepEqual(eventsFor('bad-date'), []); assert.deepEqual(upcomingEvents('bad-date'), []);
  const up = upcomingEvents('2026-10-28'); assert.ok(up.length >= 2 && up[0].distance > 0 && up.every((u, i, a) => i === 0 || u.distance >= a[i - 1].distance), 'upcoming sorted by distance'); assert.ok(up.some(u => u.event.code === 'children_day' && u.distance === 23), 'children day 20 Nov is 23 days after 28 Oct'); assert.ok(!up.some(u => u.event.kind === 'month'));
  assert.ok(upcomingEvents('2026-12-28').some(u => u.event.code === 'education_day'), 'wraps into next year');
  for (const e of EVENTS) assert.ok(e.domains.every(d => !!domainByCode(d)), `event ${e.code} domains must exist`);
});

test('lexicon: domain map + indices from skill levels', () => {
  const skills = new Map<string, { domain?: string | null; domain_code?: string | null }>([['s1', { domain_code: 'judgment' }], ['s2', { domain_code: 'judgment' }], ['s3', { domain: 'arabic' }], ['s4', { domain_code: 'purpose' }]]);
  const levels = [
    { skill_id: 's1', computed_level: 4, approved_level: null, confidence: 60, evidence: [{ kind: 'mission' }, { kind: 'daily_case' }] },
    { skill_id: 's2', computed_level: 2, approved_level: 3, confidence: 40, evidence: [{ kind: 'simulation' }] },
    { skill_id: 's3', computed_level: 1, confidence: 20, evidence: [{ kind: 'daily' }] },
    { skill_id: 's4', computed_level: 5, confidence: 90, evidence: [{ kind: 'placement' }] },
  ];
  const map = domainMap(levels, skills); assert.equal(map.length, 12);
  const j = map.find(m => m.code === 'judgment')!; assert.equal(j.skills, 2); assert.equal(j.level, 3.5, 'approved level wins; mean of 4 and 3'); assert.equal(j.evidence, 3); assert.equal(j.human_attested, 2);
  const l = map.find(m => m.code === 'language')!; assert.equal(l.level, 1, 'legacy domain mapped');
  assert.equal(map.find(m => m.code === 'civic')!.level, 0);
  const r = readinessIndex(map); assert.ok(r > 0 && r < 100, `readiness ${r}`);
  assert.ok(balanceIndex(map) >= 0 && balanceIndex(map) <= 100);
  assert.equal(hcri(map), 60, '3 of 5 evidence human-attested (mission, simulation, placement)');
  assert.equal(indexBand(10).code, 'seed'); assert.equal(indexBand(90).code, 'leading');
  const weak = weakestDomains(map, 3); assert.equal(weak.length, 3); assert.ok(weak.every(w => w.level === 0));
  const empty = domainMap([], new Map()); assert.equal(readinessIndex(empty), 0); assert.equal(hcri(empty), 0);
});

test('lexicon: style guide catches forbidden terms; sectors have 3 domains and roles', () => {
  assert.ok(lexiconIssues('ورشة مهارات ناعمة سحرية لتأهيل المتدربين').length >= 3);
  assert.equal(lexiconIssues('برنامج بناء جدارة الحكم المهني للمشاركين').length, 0);
  assert.ok(SECTORS_2062.length >= 20); assert.ok(SECTORS_2062.some(s => s.kind === 'new'));
  for (const s of SECTORS_2062) { assert.equal(s.domains.length, 3, s.code); assert.ok(s.roles.length >= 2 && s.decision_2062, s.code); }
  assert.deepEqual([...HORIZONS], [2035, 2050, 2070]);
});

// ---------------------------------------------------------------- كل يوم بناء
test('daily case: bank integrity — unique slugs, valid domains, rubric weights sum ~1, no multiple-choice', () => {
  assert.ok(CASE_BANK.length >= 20);
  assert.equal(new Set(CASE_BANK.map(c => c.slug)).size, CASE_BANK.length);
  for (const c of CASE_BANK) {
    assert.ok(domainByCode(c.domain_code), c.slug); assert.ok(c.situation_ar.length > 60, `${c.slug} situation too short`); assert.ok(c.ask_ar.length > 10, c.slug);
    const w = c.rubric.reduce((s, r) => s + r.weight, 0); assert.ok(w > 0 && c.rubric.every(r => r.weight > 0) && c.rubric.length >= 4, `${c.slug} rubric weights ${w}`); assert.ok(c.parties_ar.length >= 3, `${c.slug} parties`);
    for (const r of c.rubric) assert.ok(RUBRIC_LABEL[r.code], `${c.slug} rubric ${r.code}`);
    assert.ok(!/[أاب]\)\s|\(أ\)|\(ب\)|اختر الإجابة/.test(c.situation_ar + c.ask_ar), `${c.slug} must not be an MCQ`);
  }
});

test('daily case: deterministic pick per day, event-aware on occasions, varies across days', () => {
  const a = pickSeed('2026-11-10'), b = pickSeed('2026-11-10'); assert.equal(a.seed.slug, b.seed.slug);
  const nat = pickSeed('2026-09-23'); assert.ok(nat.event && nat.event.event.code === 'national_day'); assert.equal(nat.seed.slug, 'national-day-patriotism', 'national day picks its case');
  const ar = pickSeed('2026-12-18'); assert.equal(ar.event?.event.code, 'arabic_day'); assert.equal(ar.seed.domain_code, 'language');
  const slugs = new Set(Array.from({ length: 10 }, (_, i) => pickSeed(`2027-02-${String(i + 1).padStart(2, '0')}`).seed.slug)); assert.ok(slugs.size >= 6, `variety ${slugs.size}`);
  assert.ok(HUMAN_DOMAINS.some(d => d.code === DOMAIN_OF_DAY('2026-11-10')));
  const c = seedToCase(nat.seed, '2026-09-23', nat.event, ['sk1']); assert.equal(c.day, '2026-09-23'); assert.equal(c.event_code, 'national_day'); assert.deepEqual(c.skill_ids, ['sk1']); assert.ok(c.title_ar && c.rubric.length >= 3);
  assert.match(eventLine(nat.event, 'ar') || '', /اليوم الوطني/); assert.equal(eventLine(null, 'ar'), null);
  const pre = eventsFor('2026-12-16')[0]; assert.equal(eventLine(pre, 'ar'), 'بعد يومين: اليوم العالمي للغة العربية'); assert.match(eventLine({ ...pre, distance: 15 }, 'ar') || '', /^بعد 15 يومًا/); assert.match(eventLine({ ...pre, distance: 5 }, 'ar') || '', /^بعد 5 أيام/); assert.match(eventLine({ ...pre, distance: 1 }, 'en') || '', /^In 1 day:/);
});

test('daily case: local evaluation rewards parties, options, human loop, follow-up; punishes blind delegation', () => {
  const { seed, event } = pickSeed('2026-11-10'); const c = seedToCase(seed, '2026-11-10', event);
  const weak = localEvaluate(c, 'أوافق على ما قاله النظام وأمضي، فهو أدق مني غالبًا ولا وقت لدي.');
  const strong = localEvaluate(c, 'أولًا أحدد المشكلة الحقيقية: ما الذي يتعارض هنا ومن المتأثر؟ أسأل الفريق والمستفيد عن رأيهم قبل أن أقرر. أضع ثلاثة خيارات: أؤجل ساعة وأتحقق من مصدر البيانات، أو أقرر الآن وأوثق سبب قراري، أو أصعّد لمن يملك الصلاحية. أختار التحقق أولًا لأن ضرر الخطأ أكبر من كلفة التأخير، وأتحمل مسؤولية القرار وأعلن حدود تفويضي للنظام. ثم أراجع بعد أسبوع ماذا حدث وأكتب الدرس في سجلي، وأخبر المتأثرين بوضوح وبلغة محترمة.');
  assert.ok(strong.score > weak.score + 25, `strong ${strong.score} vs weak ${weak.score}`);
  assert.ok(['distinguished', 'exceptional'].includes(strong.band)); assert.equal(weak.band === 'exceptional', false);
  assert.ok(strong.strengths_ar.length >= 2 && strong.needs_ar.length >= 1 && strong.performance_ar.length > 40 && strong.next_step_ar);
  assert.ok(weak.needs_ar.length >= 2, 'weak answer gets concrete needs'); assert.equal(strong.source, 'local');
  assert.ok(strong.rubric_hits.every(h => h.hit >= 0 && h.hit <= 2), 'hits are 0/1/2');
  assert.equal(bandOf(0), 'emerging'); assert.equal(bandOf(50), 'capable'); assert.equal(bandOf(70), 'distinguished'); assert.equal(bandOf(90), 'exceptional');
  assert.ok(MIN_RESPONSE_CHARS >= 40);
});

test('daily case: prompts carry the lexicon and parsing is defensive', () => {
  const { seed, event } = pickSeed('2026-12-18'); const c = seedToCase(seed, '2026-12-18', event);
  const p = buildCasePrompt({ day: '2026-12-18', weekday_ar: 'الجمعة', event, domain: 'language', family: 'presence_influence', skills: [{ code: 'ATH-AR-001', name_ar: 'x' }], avoid_slugs: ['a'] });
  assert.match(p.system, /جدارة/); assert.ok(!/اختيار من متعدد/.test(p.system) || /ليس|لا /.test(p.system)); assert.match(p.user, /للغة العربية|اللغة العربية/);
  const bad = parseCase({ title_ar: 'x' }, { day: '2026-12-18', domain: 'language', family: 'presence_influence', horizon: 2035, skill_codes: [], skill_ids: [], event }); assert.equal(bad, null, 'missing situation → null');
  const good = parseCase({ title_ar: 'موقف', scene_ar: 'مشهد', role_ar: 'دور', situation_ar: 'x'.repeat(80), twist_ar: 'تحول', ask_ar: 'ماذا تفعل؟', parties_ar: ['أ', 'ب'], rubric: [{ code: 'frame', weight: 0.5 }, { code: 'bogus', weight: 0.5 }, { code: 'action', weight: 0.5 }] }, { day: '2026-12-18', domain: 'language', family: 'presence_influence', horizon: 2035, skill_codes: [], skill_ids: [], event });
  assert.ok(good); assert.ok(good!.rubric.every(r => RUBRIC_LABEL[r.code]), 'unknown rubric codes dropped'); assert.ok(good!.rubric.length >= 2, 'too few valid codes → default rubric'); assert.ok(good!.slug.startsWith('ai-'), `slug ${good!.slug}`);
  const local = localEvaluate(c, 'أ'.repeat(120)); const ep = buildEvalPrompt(c, 'نص الاستجابة'); assert.match(ep.user, /نص الاستجابة/);
  assert.equal(parseEval({ score: 'nan' }, local), null);
  assert.equal(parseEval({ score: 90, performance_ar: 'قصير' }, local), null, 'a too-short performance text is rejected');
  const pe = parseEval({ score: 140, band: 'weird', performance_ar: 'تعاملتَ مع الموقف بوضوح: سمّيت القضية الجوهرية وأشركت الأطراف قبل القرار، وحدّدت موعدًا للمراجعة.', strengths_ar: ['أ'], needs_ar: ['ب'], blind_spot_ar: 'ج', next_step_ar: 'د', rubric_hits: [{ code: 'frame', hit: 9 }, { code: 'nope', hit: 1 }] }, local);
  assert.ok(pe); assert.equal(pe!.score, Math.round(0.7 * 100 + 0.3 * local.score), 'AI score clamped to 100 then blended 70/30 with the local score'); assert.equal(pe!.band, bandOf(pe!.score), 'band recomputed from blended score'); assert.equal(pe!.source, 'ai'); assert.deepEqual(pe!.strengths_ar, ['أ']); assert.ok(pe!.rubric_hits.every(h => h.hit <= 2 && h.code !== ('nope' as any)));
});

test('daily case: streak counts consecutive days ending today or yesterday', () => {
  assert.equal(streakOf(['2026-11-10', '2026-11-09', '2026-11-08'], '2026-11-10'), 3);
  assert.equal(streakOf(['2026-11-09', '2026-11-08'], '2026-11-10'), 2, 'yesterday still counts (not answered today yet)');
  assert.equal(streakOf(['2026-11-07'], '2026-11-10'), 0); assert.equal(streakOf([], '2026-11-10'), 0);
  assert.equal(streakOf(['2026-11-10', '2026-11-10', '2026-11-08'], '2026-11-10'), 1, 'duplicates ignored, gap breaks');
});

test('daily case: AI purposes/limits and evidence weight registered', () => {
  for (const p of ['daily_case', 'daily_case_eval', 'factory_foresight', 'factory_design', 'factory_review'] as const) { assert.ok(AI_LIMITS[p] > 0, p); assert.ok(AI_PURPOSE_LABEL[p]?.ar, p); }
  assert.equal(EVIDENCE_WEIGHT.daily_case, 0.35); assert.ok(EVIDENCE_WEIGHT.daily_case > EVIDENCE_WEIGHT.daily && EVIDENCE_WEIGHT.daily_case < EVIDENCE_WEIGHT.simulation);
  const meta = new Map([['s1', { level: 3, code: 'ATH-QA-001' }]]);
  const ev = evidenceFromEvent({ verb: 'assessed', object_type: 'daily_case', object_id: 'c1', at: '2026-11-10T05:00:00Z', skills: ['s1'], context: { score: 72, band: 'distinguished', title: 'موقف' } } as any, meta as any);
  assert.equal(ev.length, 1); assert.equal(ev[0].skill_id, 's1'); assert.equal(ev[0].e.kind, 'daily_case'); assert.equal(ev[0].e.weight, 0.35); assert.match(String(ev[0].e.label), /موقف/); assert.ok(ev[0].e.level >= 1 && ev[0].e.level <= 5);
  const low = evidenceFromEvent({ verb: 'assessed', object_type: 'daily_case', object_id: 'c2', at: '2026-11-10T05:00:00Z', skills: ['s1'], context: { score: 20, band: 'emerging' } } as any, meta as any); assert.ok(low[0].e.level <= ev[0].e.level, 'level scales with score');
});

// ---------------------------------------------------------------- هندسة البرامج التدريبية
const NEED: Need = { ...EMPTY_NEED, sector: 'health', domain_code: 'judgment', family: 'judgment_accountability', stage: 'adulthood', institution: 'work', horizon: 2035, audience_ar: 'مشرفو الأقسام في المستشفيات', gap_ar: 'يقبلون توصيات النظام الذكي بلا تحقق ولا يوثقون قراراتهم حين تتعارض الأنظمة ولا يكتبون حدود تفويض واضحة' };

test('factory: need validation and payload normalisation', () => {
  assert.equal(validateNeed(NEED), null);
  assert.ok(validateNeed({ ...NEED, gap_ar: 'قصير' })); assert.ok(validateNeed({ ...NEED, audience_ar: '' })); assert.ok(validateNeed({ ...NEED, sector: 'mars' })); assert.ok(validateNeed({ ...NEED, domain_code: 'x' as any })); assert.ok(validateNeed({ ...NEED, horizon: 2040 as any }));
  const p = needPayload({ ...NEED, audience_ar: '  مشرفون  ', org_name: '' }); assert.equal(p.audience_ar, 'مشرفون'); assert.equal(p.org_name, null); assert.equal(p.horizon, 2035);
  assert.match(draftTitle(NEED), /الحكم المهني/); assert.match(draftTitle(NEED), /الصحة/);
});

test('factory: local foresight → design → review chain is complete and approvable', () => {
  const fs = localForesight(NEED); assert.ok(fs.headline_ar && fs.why_now_ar && fs.scarce_ar && fs.wave_ar); assert.ok(fs.risks_ar.length >= 2 && fs.competencies_ar.length >= 3 && fs.indicators_ar.length >= 3 && fs.evidence_kinds.length >= 2);
  const d = localDesign(NEED, fs); assert.ok(d.brand_ar && d.subtitle_ar && d.name_en); assert.ok(d.modules.length >= 4 && d.modules.length <= 8); assert.ok(d.objectives_ar.length >= 4); assert.ok(d.saqf_level >= 3 && d.saqf_level <= 7); assert.equal(d.contract_split.delivery + d.contract_split.evidence + d.contract_split.impact, 100);
  for (const m of d.modules) assert.ok(m.title_ar && m.outcome_ar && m.simulation_ar && m.mission_ar && m.evidence_ar && m.hours > 0);
  assert.equal(lexiconIssues([d.brand_ar, d.subtitle_ar, d.intro_ar, ...d.objectives_ar].join(' ')).length, 0, 'local design obeys the lexicon');
  const r = localReview(NEED, d); assert.ok(r.items.length >= 8); assert.ok(r.score >= 80, `local design must pass its own review (${r.score}): ${r.items.filter(i => !i.ok).map(i => i.code).join(',')}`); assert.equal(r.verdict, 'approve');
  const broken = localReview(NEED, { ...d, objectives_ar: ['فهم الذكاء الاصطناعي', 'الإلمام بالمفاهيم', 'معرفة الأدوات', 'التعرف على المخاطر'], assessment_ar: ['اختبار معرفي نهائي'], human_gates_ar: [], brand_ar: 'ورشة مهارات ناعمة للمتدربين' });
  assert.ok(broken.score <= 60, `broken ${broken.score}`); assert.equal(broken.verdict, 'revise'); assert.ok(broken.lexicon.length >= 1); assert.equal(broken.items.find(i => i.code === 'objectives')!.ok, false); assert.equal(broken.items.find(i => i.code === 'human_gates')!.ok, false); assert.ok(broken.items.find(i => i.code === 'no_test')!.ok === false);
});

test('factory: AI parsers fall back field-by-field and clamp', () => {
  const fs = localForesight(NEED); const d = localDesign(NEED, fs);
  assert.equal(parseForesight(null, fs), null); assert.equal(parseForesight('not json', fs), null); assert.deepEqual(parseForesight({}, fs), fs, 'empty object → every field falls back to local');
  assert.equal(parseForesight({ headline_ar: 'عنوان', why_now_ar: 'قصير' }, fs), null, 'a too-short why_now is rejected'); const pf = parseForesight({ headline_ar: 'عنوان', why_now_ar: 'لماذا الآن: لأن الأنظمة الذكية تتخذ قرارات تشغيلية يومية والمشرفون يوقّعون عليها دون تحقق موثّق.', risks_ar: 'ليست مصفوفة' }, fs)!; assert.equal(pf.headline_ar, 'عنوان'); assert.deepEqual(pf.risks_ar, fs.risks_ar, 'non-array falls back'); assert.equal(pf.scarce_ar, fs.scarce_ar);
  assert.equal(parseDesign(null, d), null); const thin = parseDesign({ brand_ar: 'x' }, d)!; assert.ok(thin); assert.equal(thin.modules.length, d.modules.length, 'missing modules fall back to local');
  const pd = parseDesign({ brand_ar: 'حين تختلف الآلات', subtitle_ar: 'الحكم المهني', modules: [{ title_ar: 'و1', outcome_ar: 'ن', simulation_ar: 'م', mission_ar: 'مهمة', evidence_ar: 'ش', hours: 99 }], saqf_level: 12, hours: 1000, contract_split: { delivery: 90, evidence: 5, impact: 5 } }, d)!;
  assert.ok(pd.saqf_level <= 8 && pd.hours <= 400); assert.equal(pd.modules[0].hours <= 40, true); assert.equal(pd.contract_split.delivery + pd.contract_split.evidence + pd.contract_split.impact, 100); assert.equal(pd.objectives_ar.length, d.objectives_ar.length, 'missing objectives fall back');
  const lr = localReview(NEED, d); assert.equal(parseReview({ items: 'x' }, lr), null);
  assert.equal(parseReview({ summary_ar: 'قصير' }, lr), null, 'summary too short'); const pr = parseReview({ score: 999, verdict: 'nonsense', extra_items: [{ code: 'tone', label_ar: 'نبرة غير وعظية', ok: false, note_ar: 'الوحدة الثانية وعظية' }], summary_ar: 'ملخص المراجع الاصطناعي: المخطط متماسك لكن نبرة الوحدة الثانية وعظية وتحتاج إعادة صياغة.' }, lr)!; assert.ok(pr); assert.ok(pr.score <= 100 && pr.score < lr.score, 'extra failing item lowers the local score'); assert.ok(['approve', 'revise'].includes(pr.verdict)); assert.equal(pr.items.length, lr.items.length + 1); assert.equal(pr.items.find(i => i.code === 'ai_tone')!.ok, false); assert.ok(pr.items.find(i => i.code === 'lexicon'), 'lexicon check is always local'); assert.match(pr.summary_ar, /وعظية/);
});

test('factory: publish payload creates a draft, closed program with lexicon-compliant naming', () => {
  const d = localDesign(NEED, localForesight(NEED)); const p = programPayload(d, NEED) as any;
  assert.match(String(p.name_ar), /—/); assert.equal(p.status, 'DRAFT'); assert.equal(p.registration_open, false); assert.equal(p.is_public, false); assert.ok(['onsite', 'remote'].includes(p.delivery_mode), 'legacy delivery_mode values only');
  assert.ok(String(p.objectives_ar).split('\n').length >= 4); assert.ok(p.hours > 0); assert.equal('sector' in p, false, 'sector FK is not guessed'); assert.ok(String(p.description_ar || '').length > 40); assert.equal(lexiconIssues(String(p.name_ar)).length, 0);
  assert.equal(nextStage('foresight'), 'designed'); assert.equal(nextStage('reviewed'), 'published'); assert.equal(nextStage('published'), null); assert.equal(STAGES.length, 4);
  const drafts: Draft[] = [{ id: '1', created_at: '', title_ar: 'a', need: NEED, stage: 'foresight', foresight: null, design: null, review: null, program_id: null, notes: null, log: [] }, { id: '2', created_at: '', title_ar: 'b', need: { ...NEED, domain_code: 'language', horizon: 2050 }, stage: 'published', foresight: null, design: null, review: null, program_id: 'p9', notes: null, log: [] }];
  const st = factoryStats(drafts); assert.equal(st.total, 2); assert.equal(st.by_stage.published, 1); assert.equal(st.by_domain.find(x => x.code === 'language')!.n, 1); assert.equal(st.horizons['2050'], 1);
});
