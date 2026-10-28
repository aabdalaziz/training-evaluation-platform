// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P14: (أ) قاعدة الأدلة المؤسسية — بناء الشبكة، القوالب المغلقة، الخيوط العامة (≥ 5)، درس الأسبوع، الكوكبة
//                 (ب) أَثَر للوكلاء — الأدوات، الصلاحيات والحدود، التحقق من المعاملات، الملاءمة بدليل، السعر التقديري، البطاقة، السجل العام
import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_MIN_PEOPLE, buildGraph, TEMPLATES, TEMPLATE_IDS, matchTemplate, runTemplate, publicThreads, weekStart, lessonDraft, constellation, nodeStory, graphRows, KIND_LABEL, CHANNEL_LABEL } from '../lib/portal/evidence';
import type { GraphSources, EntityIndex } from '../lib/portal/evidence';
import { arCount, evN, peopleN, learnerN } from '../lib/portal/evidence';
import { AGENT_TOOLS, TOOL_NAMES, toolByName, ALL_SCOPES, DEFAULT_SCOPES, ANON_SCOPES, ANON_DAILY_LIMIT, keyFromBytes, isAgentKey, keyPrefix, allowCall, validateArgs, fitPrograms, findSkillNode, indicativeQuote, pluginManifest, agentsJsonLd, AGENT_CAN_AR, AGENT_CANNOT_AR, publicLogLine } from '../lib/portal/agents';
import { buildEvidenceRoutePrompt, parseEvidencePick } from '../lib/ai/prompts';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SK1 = U(1), SK2 = U(2), P1 = 'p1', P2 = 'p2', S1 = U(55), ORG1 = U(70), TR1 = U(80);
function sources(people = 7): GraphSources {
  const events: GraphSources['events'] = [];
  for (let i = 0; i < people; i++) {
    const uid = U(100 + i);
    events.push({ at: `2026-0${1 + (i % 9)}-10T09:00:00Z`, user_id: uid, verb: 'completed', object_type: 'program', object_id: P1, skills: [SK1], context: { program_id: P1, program_name: 'برنامج التقويم' } });
    events.push({ at: `2026-05-1${i % 9}T09:00:00Z`, user_id: uid, verb: 'assessed', object_type: 'mission', object_id: `m${i}`, skills: [SK1], context: { score: 80, confirmed: true, title: 'مهمة' } });
    events.push({ at: `2026-06-0${1 + (i % 9)}T09:00:00Z`, user_id: uid, verb: 'attended', object_type: 'session', object_id: S1, skills: [SK2], context: { session_id: S1 } });
    events.push({ at: `2026-06-0${1 + (i % 9)}T10:00:00Z`, user_id: uid, verb: 'viewed', object_type: 'resource', object_id: 'r1', skills: [SK2], context: {} });
  }
  events.push({ at: '2026-07-01T09:00:00Z', user_id: U(900), verb: 'assessed', object_type: 'simulation', object_id: 'run1', skills: [SK2], context: { score: 70, scenario_id: 'sc1', approved: true } });
  return {
    events,
    skills: [{ id: SK1, code: 'ATH-ED-001', name_ar: 'التقويم الصفي', name_en: 'Classroom assessment', level: 3, sector: 'education' }, { id: SK2, code: 'ATH-ED-002', name_ar: 'إدارة الحوار', name_en: 'Dialogue facilitation', level: 3, sector: 'education' }] as any,
    programs: [{ id: P1, name_ar: 'برنامج التقويم', name_en: 'Assessment program', sector: 'education' }, { id: P2, name_ar: 'برنامج القيادة', sector: 'education' }],
    sessions: [{ id: S1, title_ar: 'جلسة الحوار', trainer_id: TR1, sector: 'education', skills: [SK2], program_id: P2, organization_id: ORG1 }],
    trainers: [{ id: TR1, full_name: 'د. سارة' }], scenarios: [{ id: 'sc1', title_ar: 'محاكي اجتماع أولياء الأمور', skills: [SK2] }],
    missions: [{ id: 'm0', template_id: 'tpl-1', title_ar: 'مهمة تطبيق التقويم', skills: [SK1], status: 'confirmed' }],
    registrations: [{ session_id: S1, organization: 'جامعة الأمير مقرن', user_id: U(100) }],
    enrollments: [{ program_id: P1, organization: 'جامعة الأمير مقرن', status: 'approved', user_id: U(101) }, { program_id: P1, organization: 'جامعة الأمير مقرن', status: 'pending', user_id: U(102) }],
    orgs: [{ id: ORG1, name_ar: 'جامعة الأمير مقرن', name_en: 'Prince Mugrin University', sector: 'education' }],
    sectors: [{ code: 'education', name_ar: 'التعليم', name_en: 'Education' }],
    contracts: [{ id: 'c1', title_ar: 'عقد أثر التقويم', organization_id: ORG1, program_id: P1, status: 'active' }],
    today: '2026-10-28',
  };
}
const idx = (s: GraphSources): EntityIndex => ({ skills: s.skills.map((x: any) => ({ id: x.id, name_ar: x.name_ar, name_en: x.name_en, code: x.code })), sectors: s.sectors, orgs: s.orgs, programs: s.programs, trainers: s.trainers.map(t => ({ id: t.id, name_ar: t.full_name })) } as any);

test('P14-أ · بناء الشبكة: عقد بأنواعها، أدلة موزونة، أشخاص فريدون، نقل مؤكَّد، استثمار الجهات', () => {
  const g = buildGraph(sources());
  const kinds = new Set(g.nodes.map(n => n.kind)); for (const k of ['skill', 'program', 'session', 'channel', 'sector', 'org', 'trainer', 'scenario', 'mission', 'contract']) assert.ok(kinds.has(k as any), `نوع العقدة ${k} موجود`);
  const progSkill = g.edges.find(e => e.src === `program:${P1}` && e.dst === `skill:${SK1}` && e.rel === 'raised'); assert.ok(progSkill, 'البرنامج رفع المهارة');
  assert.equal(progSkill!.evidence, 7, '7 أدلة إتمام'); assert.equal(progSkill!.people, 7, '7 أشخاص فريدين'); assert.equal(progSkill!.period_from, '2026-01-10', 'بداية الفترة'); assert.equal(progSkill!.period_to, '2026-07-10', 'نهاية الفترة');
  const missionCh = g.edges.find(e => e.src === 'channel:mission' && e.dst === `skill:${SK1}`); assert.ok(missionCh, 'قناة المهمات');
  assert.equal(Number((missionCh!.meta as any).transfer), 7, 'كل المهمات المؤكَّدة نُقلت إلى العمل');
  assert.ok(!g.edges.some(e => e.src === 'channel:viewed'), 'المشاهدة لا تُحتسب دليلًا');
  const trainer = g.edges.find(e => e.src === `trainer:${TR1}` && e.dst === `skill:${SK2}` && e.rel === 'raised'); assert.ok(trainer, 'المدرب رفع المهارة عبر جلسته');
  const sessProg = g.edges.find(e => e.src === `session:${S1}` && e.dst === `program:${P2}` && e.rel === 'belongs'); assert.ok(sessProg, 'الجلسة تنتمي للبرنامج');
  const inv = g.edges.find(e => e.src === `org:${ORG1}` && e.dst === `program:${P1}` && e.rel === 'invested'); assert.ok(inv, 'الجهة استثمرت في البرنامج'); assert.equal(inv!.weight, 1.5, 'معتمد 1 + معلّق 0.5');
  assert.ok(g.edges.some(e => e.src === 'contract:c1' && e.dst === `program:${P1}` && e.rel === 'targets'), 'العقد يستهدف البرنامج');
  assert.ok(g.edges.some(e => e.src === 'sector:education' && e.rel === 'needs'), 'القطاع يحتاج المهارة');
  const rows = graphRows(g, '2026-10-28T00:00:00Z'); assert.equal(rows.nodes.length, g.nodes.length, 'صفوف العقد'); assert.ok(rows.edges.every(e => (e as any).updated_at), 'طابع زمني للحواف');
  assert.ok(Object.keys(CHANNEL_LABEL).length >= 8, 'ثماني قنوات'); assert.equal(KIND_LABEL.skill.ar, 'مهارة', 'تسمية النوع');
});

test('P14-أ · القوالب المغلقة: 16 قالبًا، كل قالب يُعيد إجابة بسلسلة أدلة؛ لا SQL حر', () => {
  const g = buildGraph(sources());
  assert.ok(TEMPLATES.length >= 16, `≥ 16 قالبًا (${TEMPLATES.length})`); assert.equal(new Set(TEMPLATE_IDS).size, TEMPLATES.length, 'معرّفات فريدة');
  for (const t of TEMPLATES) { assert.ok(t.example_ar.length > 5, `مثال لقالب ${t.id}`); assert.ok(t.keywords.length >= 2, `كلمات مفتاحية لـ${t.id}`); }
  const a = runTemplate('top_programs_for_skill', g, { skill: SK1 }); assert.ok(a, 'إجابة'); assert.equal(a!.rows[0].id, `program:${P1}`, 'البرنامج الأعلى'); assert.ok(a!.chain.length >= 2, 'سلسلة أدلة'); assert.ok(a!.people >= 7, 'عدد الأشخاص'); assert.ok(['strong', 'medium', 'weak'].includes(a!.confidence), 'درجة ثقة');
  assert.equal(runTemplate('top_programs_for_skill', g, {}), null, 'قالب يحتاج مهارة بلا مهارة → null');
  assert.equal(runTemplate('drop table', g, {}), null, 'قالب مجهول → null');
  const tc = runTemplate('top_channel', g, {}); assert.ok(tc && tc.rows.length >= 2, 'قنوات متعددة'); assert.match(tc!.rows[0].value, /نقل/, 'نسبة النقل');
  const ys = runTemplate('year_summary', g, {}); assert.ok(ys && ys.rows.length, 'ملخص العام'); const oy = runTemplate('org_year', g, { org: ORG1 }); assert.ok(oy && oy.answer_ar.includes('جامعة'), 'الجهة بالاسم');
  const empty = runTemplate('top_programs_for_skill', buildGraph({ ...sources(0), events: [] }), { skill: SK1 }); assert.ok(empty && empty.confidence === 'weak' && empty.rows.length === 0, 'بلا بيانات → إجابة ضعيفة صريحة لا خطأ');
});

test('P14-أ · توجيه السؤال الطبيعي إلى قالب + استخراج الكيانات (محلي بلا ذكاء اصطناعي)', () => {
  const s = sources(); const ix = idx(s);
  const m1 = matchTemplate('أي برنامج أثبت رفع مهارة التقويم الصفي؟', ix); assert.equal(m1.template.id, 'top_programs_for_skill', 'قالب البرامج للمهارة'); assert.equal(m1.params.skill, SK1, 'المهارة مستخرَجة');
  const m2 = matchTemplate('ماذا حدث مع جامعة الأمير مقرن في 2026؟', ix); assert.equal(m2.params.org, ORG1, 'الجهة مستخرَجة'); assert.equal(m2.params.year, 2026, 'السنة');
  const m3 = matchTemplate('أي قناة تعلّم تنقل الأثر إلى العمل أكثر؟', ix); assert.equal(m3.template.id, 'top_channel', 'قناة');
  const m4 = matchTemplate('كلام لا علاقة له بشيء', ix); assert.ok(m4.template, 'دائمًا قالب احتياطي'); assert.equal(m4.template.id, 'year_summary', 'الاحتياطي ملخص العام');
  const m5 = matchTemplate('ATH-ED-002', ix); assert.equal(m5.params.skill, SK2, 'بالرمز');
  const pr = buildEvidenceRoutePrompt('سؤال', TEMPLATES.map(t => ({ id: t.id, title_ar: t.title_ar, example_ar: t.example_ar, needs: t.needs as string[] })), { skills: [{ id: SK1, name: 'التقويم' }], sectors: [], orgs: [], programs: [] } as any); assert.ok(pr.system.length > 50 && pr.user.includes('top_channel'), 'موجّه القالب يحمل القائمة المغلقة');
  assert.equal(parseEvidencePick({ template: 'drop_all', skill: SK1 }, TEMPLATE_IDS), null, 'قالب خارج القائمة يُرفض');
  const pk = parseEvidencePick('{"template":"top_programs_for_skill","skill":"' + SK1 + '","year":2026}', TEMPLATE_IDS); assert.ok(pk && pk.template === 'top_programs_for_skill' && pk.skill === SK1 && pk.year === 2026, 'اختيار صالح');
  assert.equal(parseEvidencePick({ template: 'year_summary', year: 1999 }, TEMPLATE_IDS)!.year, null, 'سنة خارج النطاق تُهمل');
});

test('P14-أ · الخيوط العامة: مجموعات ≥ 5 فقط، بلا أسماء، حتمية حسب اليوم، تختفي عند قلة البيانات', () => {
  const g = buildGraph(sources(7)); const th = publicThreads(g, 3);
  assert.ok(th.length >= 1 && th.length <= 3, `1–3 خيوط (${th.length})`);
  for (const t of th) { assert.ok(t.text_ar.length > 10 && t.text_en.length > 10, 'نص بالعربية والإنجليزية'); assert.ok(!/د\. سارة|نورة/.test(t.text_ar), 'بلا أسماء أشخاص'); assert.ok(['spark', 'compass', 'target'].includes(t.icon), 'أيقونة'); }
  assert.deepEqual(publicThreads(g, 3), th, 'حتمية لليوم نفسه');
  assert.equal(PUBLIC_MIN_PEOPLE, 5, 'الحد 5');
  const small = buildGraph(sources(3)); assert.equal(publicThreads(small, 1).length, 0, 'أقل من 5 أشخاص → لا خيوط');
});

test('P14-أ · درس الأسبوع (مسودة تنتظر إنسانًا) + الكوكبة + حكاية العقدة', () => {
  const g = buildGraph(sources());
  assert.equal(weekStart('2026-10-28'), '2026-10-25', 'الأسبوع يبدأ الأحد'); assert.equal(weekStart('2026-10-25'), '2026-10-25', 'الأحد نفسه');
  const l = lessonDraft(g, '2026-10-28'); assert.ok(l, 'مسودة درس'); assert.equal(l!.week, '2026-10-25', 'أسبوع الدرس'); assert.ok(l!.title_ar.length > 5 && l!.body_ar.length > 20 && l!.evidence.length >= 2, 'عنوان ومتن وأدلة');
  assert.equal(lessonDraft(buildGraph(sources(2)), '2026-10-28'), null, 'بيانات قليلة → لا درس');
  const c = constellation(g); assert.ok(c.stars.length >= 8 && c.stars.length <= 60, 'نجوم'); assert.ok(c.links.length >= 5, 'روابط');
  for (const s of c.stars) { assert.ok(s.x >= 0 && s.x <= 900 && s.y >= 0 && s.y <= 520, 'داخل اللوحة'); assert.ok(s.r >= 3, 'نصف قطر'); }
  assert.deepEqual(constellation(g).stars.map(s => s.id), c.stars.map(s => s.id), 'تخطيط حتمي');
  const ids = new Set(c.stars.map(s => s.id)); assert.ok(c.links.every(l => ids.has(l.a) && ids.has(l.b)), 'كل رابط بين نجمين مرسومين');
  const story = nodeStory(g, `program:${P1}`); assert.ok(story.length >= 2 && story.some(s => s.includes('التقويم الصفي')), 'حكاية البرنامج تذكر المهارة');
  assert.deepEqual(nodeStory(g, 'nope:x'), [], 'عقدة مجهولة → حكاية فارغة');
});

test('P14-ب · الأدوات الثماني والصلاحيات: القراءة بلا مفتاح محدودة، الكتابة تحتاج مفتاحًا ونطاقًا وحدًا', () => {
  assert.equal(AGENT_TOOLS.length, 8, '8 أدوات'); assert.deepEqual(TOOL_NAMES.sort(), ['discover_programs', 'impact_report', 'open_dialogue_room', 'request_quote', 'request_status', 'reserve_seats', 'skill_fit', 'verify_credential'], 'الأسماء');
  assert.ok(AGENT_TOOLS.filter(t => t.writes).every(t => ['quote', 'reserve', 'dialogue'].includes(t.scope)), 'الأدوات الكاتبة ضمن نطاقات الالتزام');
  assert.equal(toolByName('nope'), null, 'أداة مجهولة'); assert.equal(ALL_SCOPES.length, 7, '7 نطاقات'); assert.ok(!DEFAULT_SCOPES.includes('reserve'), 'الافتراضي بلا حجز'); assert.deepEqual(ANON_SCOPES, ['discover', 'verify'], 'بلا مفتاح: اكتشاف وتحقق'); assert.equal(ANON_DAILY_LIMIT, 60, 'حد المجهول');
  const now = '2026-10-28T10:00:00Z'; const key = { id: 'k', name: 'x', scopes: ['discover', 'fit', 'quote'], daily_limit: 5 };
  assert.ok(allowCall(key, 'fit', 0, now).ok, 'نطاق مسموح'); const d = allowCall(key, 'reserve', 0, now); assert.ok(!d.ok && d.status === 403, 'نطاق غير ممنوح → 403');
  const lim = allowCall(key, 'fit', 5, now); assert.ok(!lim.ok && lim.status === 429, 'حد يومي → 429');
  assert.equal((allowCall({ ...key, revoked_at: now }, 'fit', 0, now) as any).status, 401, 'مُبطَل → 401'); assert.equal((allowCall({ ...key, expires_at: '2026-01-01T00:00:00Z' }, 'fit', 0, now) as any).status, 401, 'منتهٍ → 401'); assert.equal((allowCall(null, 'fit', 0, now) as any).status, 401, 'بلا مفتاح → 401');
  const k = keyFromBytes(Array.from({ length: 32 }, (_, i) => i * 7)); assert.ok(isAgentKey(k), `مفتاح صالح ${k}`); assert.equal(keyPrefix(k).length, 12, 'بادئة 12'); assert.ok(!isAgentKey('atk_short'), 'قصير مرفوض'); assert.ok(!isAgentKey('sk_' + 'a'.repeat(32)), 'بادئة غريبة مرفوضة');
});

test('P14-ب · التحقق من المعاملات: المطلوب، الأنواع، المقاعد 1–500، البريد، المشاركون، الحدّ 20', () => {
  const q = toolByName('request_quote')!; const r = toolByName('reserve_seats')!; const dsc = toolByName('discover_programs')!;
  assert.ok(!validateArgs(q, {}).ok, 'program_id مطلوب'); assert.ok(!validateArgs(q, { program_id: 'p1', seats: 'abc', contact_email: 'a@b.co' }).ok, 'المقاعد عدد');
  assert.ok(!validateArgs(q, { program_id: 'p1', seats: 0, contact_email: 'a@b.co' }).ok, '0 مقعد مرفوض'); assert.ok(!validateArgs(q, { program_id: 'p1', seats: 501, contact_email: 'a@b.co' }).ok, '501 مرفوض');
  assert.ok(!validateArgs(q, { program_id: 'p1', seats: 10, contact_email: 'not-mail' }).ok, 'بريد غير صالح');
  const ok = validateArgs(q, { program_id: ' p1 ', seats: '10', contact_email: 'hr@org.sa', notes: 'x'.repeat(1000) }); assert.ok(ok.ok, 'صالح'); if (ok.ok) { assert.equal(ok.args.program_id, 'p1', 'تشذيب'); assert.equal(ok.args.seats, 10, 'رقم'); assert.equal(ok.args.notes.length, 400, 'قصّ الملاحظات'); }
  const bad = validateArgs(r, { program_id: 'p1', participants: 'x', contact_email: 'hr@org.sa' }); assert.ok(!bad.ok, 'المشاركون قائمة');
  const ps = validateArgs(r, { program_id: 'p1', contact_email: 'hr@org.sa', participants: [{ full_name: 'نورة', email: 'N@ORG.SA' }, { full_name: '', email: 'x@y.z' }, { full_name: 'بلا بريد' }] }); assert.ok(ps.ok, 'مشاركون'); if (ps.ok) { assert.equal(ps.args.participants.length, 1, 'يبقى الصالح فقط'); assert.equal(ps.args.participants[0].email, 'n@org.sa', 'بريد صغير'); }
  const l = validateArgs(dsc, { limit: 99 }); assert.ok(l.ok && l.args.limit === 20, 'الحد الأقصى 20');
});

test('P14-ب · ملاءمة مهارة بدليل من الشبكة + السعر التقديري غير الملزم', () => {
  const g = buildGraph(sources()); const sid = findSkillNode(g, 'التقويم الصفي'); assert.equal(sid, `skill:${SK1}`, 'إيجاد المهارة بالاسم'); assert.equal(findSkillNode(g, 'ATH-ED-002'), `skill:${SK2}`, 'بالرمز'); assert.equal(findSkillNode(g, 'zzz'), null, 'مجهول');
  const fit = fitPrograms(g, sid!); assert.ok(fit.length >= 1, 'برامج ملائمة'); assert.equal(fit[0].program_id, P1, 'الأعلى'); assert.equal(fit[0].people, 7, 'الأشخاص'); assert.ok(fit[0].proof_ar.includes('7'), 'نص الدليل يحمل الأرقام');
  const qt = indicativeQuote({ fee: 1500, currency: 'SAR', seats: 30 }, 25); assert.equal(qt.total, 37500, 'الإجمالي'); assert.equal(qt.per_seat, 1500, 'للمقعد'); assert.equal(qt.indicative, true, 'تقديري'); assert.equal(qt.capacity_warning, false, 'ضمن السعة'); assert.match(qt.note_ar, /إنسان|ملزم/, 'تنبيه الاعتماد البشري');
  const over = indicativeQuote({ fee: 1500, currency: 'SAR', seats: 30 }, 40); assert.equal(over.capacity_warning, true, 'تحذير السعة');
  const free = indicativeQuote({ fee: null, currency: null }, 10); assert.equal(free.total, null, 'بلا رسوم → null'); assert.equal(free.currency, 'SAR', 'العملة الافتراضية');
});

test('P14-ب · بطاقة الاكتشاف + JSON-LD + المكتب الزجاجي (سطور مجهّلة)', () => {
  const m = pluginManifest('https://athar-portal.vercel.app'); assert.equal(m.schema_version, 'v1', 'إصدار'); assert.equal(m.tools.length, 8, '8 أدوات في البطاقة'); assert.equal(m.api.url, 'https://athar-portal.vercel.app/api/agent', 'رابط الواجهة'); assert.equal(m.governance.human_in_the_loop, true, 'الإنسان في الحلقة');
  const rq = m.tools.find(t => t.name === 'request_quote')!; assert.deepEqual(rq.parameters.required.sort(), ['contact_email', 'program_id', 'seats'], 'المطلوب في المخطط');
  const ld = agentsJsonLd('https://x.sa'); assert.equal(ld['@type'], 'WebAPI', 'نوع'); assert.equal(ld.url, 'https://x.sa/agents', 'رابط');
  assert.ok(AGENT_CAN_AR.length >= 6 && AGENT_CANNOT_AR.length >= 5, 'قوائم يستطيع/لا يستطيع');
  const now = Date.parse('2026-10-28T10:00:00Z');
  const l1 = publicLogLine({ at: '2026-10-28T09:58:00Z', tool: 'skill_fit', ok: true, meta: { key: 'k1', org_sector: 'التعليم' } }, now); assert.match(l1, /قطاع التعليم/, 'القطاع لا الاسم'); assert.match(l1, /قبل 2 دقيقة/, 'الزمن النسبي'); assert.ok(!l1.includes('k1'), 'لا معرّف المفتاح');
  const l2 = publicLogLine({ at: '2026-10-27T09:00:00Z', tool: 'reserve_seats', ok: false, meta: { anon: true, ip: '1.2.3.4' } }, now); assert.match(l2, /بلا مفتاح/, 'وكيل عام'); assert.match(l2, /رُفض/, 'مرفوض'); assert.ok(!l2.includes('1.2.3.4'), 'لا IP في العام'); assert.match(l2, /قبل 1 يومًا/, 'يوم');
  const l3 = publicLogLine({ at: new Date(now - 3 * 3600000).toISOString(), tool: 'discover_programs', ok: true, meta: { sandbox: true } }, now); assert.match(l3, /تجريبي/, 'تجريبي'); assert.match(l3, /قبل 3 ساعة/, 'ساعات');
});

test('P14 · العدد والمعدود بالعربية في نصوص الأدلة (المصطلح الصحيح)', () => {
  assert.equal(evN(1), 'دليل واحد', 'مفرد'); assert.equal(evN(2), 'دليلان', 'مثنى'); assert.equal(evN(7), '7 أدلة', 'جمع 3–10'); assert.equal(evN(21), '21 دليلًا', 'مفرد منصوب 11–99'); assert.equal(evN(100), '100 دليل', 'المئات'); assert.equal(evN(0), '0 أدلة', 'صفر');
  assert.equal(peopleN(5), '5 أشخاص', 'أشخاص'); assert.equal(learnerN(12), '12 متعلمًا', 'متعلمًا'); assert.equal(arCount(3.6, 'a', 'b', 'c', 'd', 'e'), '4 c', 'تقريب');
  const g = buildGraph(sources()); const a = runTemplate('top_programs_for_skill', g, { skill: SK1 })!; assert.ok(!/\d+ دليلًا\b/.test(a.answer_ar.replace(/\d{2,} دليلًا/g, '')), 'لا «7 دليلًا» في الإجابات'); assert.match(JSON.stringify(a), /7 أدلة|7 أشخاص|7 متعلمين/, 'الصيغة الصحيحة تظهر');
});
