// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م6-ج «جلسة التعويض — من خريطة المنهج» — الموعد الافتراضي · العنوان · أخطاء المجموعة · الخطّة المحلية · التحقّق · أثر التعويض · ربط وحدات البرنامج · الذكاء بلا حفظ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { UNIT_SEED } from '../lib/miaar/syllabus';
import type { Unit } from '../lib/miaar/syllabus';
import { KINDS, kindLabel } from '../lib/portal/live';
import { cleanUnits } from '../lib/reports/registry';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';
import type { EffectIn } from '../lib/miaar/remedial';
import {
  REMEDIAL_KIND, REMEDIAL_TITLE, LEARNER_TITLE, REMEDIAL_DEFAULT_MIN, REMEDIAL_MAX_UNITS, nextWorkdayAt, remedialTitle, mistakesFor, draftPlan, validateCreate, effectFor, effectText,
  suggestProgramLinks, programUnitFor, remedialsForLearner, listRemedials, joinedEmails, unitsOfItemMap, titlesOf, parsePlan, planPrompt, PLAN_SYSTEM,
} from '../lib/miaar/remedial';

const ROOT = path.join(__dirname, '..');
const units = (): Unit[] => UNIT_SEED.filter((u) => u.level === 'A1').map((u) => ({ ...u, status: 'approved' as const }));
const riyadh = (iso: string) => { const d = new Date(new Date(iso).getTime() + 3 * 3600000); return { wd: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes(), day: d.toISOString().slice(0, 10) }; };

test('م6-ج: الأسماء — «جلسة التعويض» للطاقم و«جلسة مراجعة» للمتعلّم · النوع remedial في قائمة أنواع البثّ · غرض الذكاء مسجَّل بحدّ 20/يوم', () => {
  assert.equal(REMEDIAL_KIND, 'remedial'); assert.equal(REMEDIAL_TITLE.ar, 'جلسة التعويض — من خريطة المنهج'); assert.equal(LEARNER_TITLE.ar, 'جلسة مراجعة');
  assert.ok(KINDS.some((k) => k.value === 'remedial')); assert.match(kindLabel('remedial', 'ar'), /مراجعة/); assert.match(kindLabel('remedial', 'en'), /Review/);
  assert.equal(AI_LIMITS.miaar_remedial_plan, 20); assert.ok(AI_PURPOSE_LABEL.miaar_remedial_plan.ar.includes('التعويض'));
  assert.equal(REMEDIAL_DEFAULT_MIN, 60); assert.equal(REMEDIAL_MAX_UNITS, 3);
});

test('م6-ج: nextWorkdayAt — الغد 10:00 بتوقيت الرياض؛ الخميس→الأحد · الجمعة→الأحد · السبت→الأحد · ثابت عبر منتصف الليل', () => {
  /* 2026-11-05 الخميس (UTC) */
  const thu = nextWorkdayAt(new Date('2026-11-05T08:00:00Z')); assert.deepEqual([riyadh(thu).wd, riyadh(thu).h, riyadh(thu).m], [0, 10, 0]); assert.equal(riyadh(thu).day, '2026-11-08');
  const wed = nextWorkdayAt(new Date('2026-11-04T08:00:00Z')); assert.equal(riyadh(wed).day, '2026-11-05'); assert.equal(riyadh(wed).wd, 4);
  const fri = nextWorkdayAt(new Date('2026-11-06T12:00:00Z')); assert.equal(riyadh(fri).wd, 0); const sat = nextWorkdayAt(new Date('2026-11-07T12:00:00Z')); assert.equal(riyadh(sat).wd, 0);
  /* 22:30 UTC = 01:30 بالرياض من اليوم التالي → «الغد» يُحسب من يوم الرياض */
  const late = nextWorkdayAt(new Date('2026-11-02T22:30:00Z')); assert.equal(riyadh(late).day, '2026-11-04');
  assert.equal(nextWorkdayAt(new Date('2026-11-02T08:00:00Z'), 14).includes('T11:00:00'), true, 'الساعة 14 بالرياض = 11 UTC');
});

test('م6-ج: remedialTitle — وحدة واحدة باسمها · أكثر تُلخَّص · إنجليزي', () => {
  const us = units(); assert.equal(remedialTitle([us[3]]), 'جلسة مراجعة — أين؟ الأماكن وحروف الجرّ');
  assert.equal(remedialTitle([us[3], us[0]]), 'جلسة مراجعة — أين؟ الأماكن وحروف الجرّ ووحدة أخرى'); assert.equal(remedialTitle([us[3], us[0], us[1]]), 'جلسة مراجعة — أين؟ الأماكن وحروف الجرّ و2 وحدات أخرى');
  assert.equal(remedialTitle([us[3]], 'en'), 'Review session — Where? Places and prepositions'); assert.equal(remedialTitle([]), 'جلسة مراجعة');
});

test('م6-ج: mistakesFor — يحصي الخطأ ولم يُجب كخطأ · البند متعدّد الوحدات يُحسب لكلٍّ · أمثلة ≤ 3 بلا تكرار ومقتضبة · وحدة بلا بنود = صفر', () => {
  const uoi = new Map<string, string[]>([['GV01', ['A1-U02']], ['GV02', ['A1-U02', 'A1-U04']], ['R01', ['A1-U04']], ['L01', ['A1-U05']]]);
  const rep = (results: Record<string, string>) => ({ بنود_الجلسة: Object.entries(results).map(([k, v]) => ({ الرمز: k, المهارة: k.startsWith('GV') ? 'grammar_vocab' : k.startsWith('R') ? 'reading' : 'listening', النص: `نص ${k} `.repeat(30), النتيجة: v })) });
  const ms = mistakesFor([rep({ GV01: 'صحيح', GV02: 'غير صحيح', R01: 'لم يُجب', L01: 'صحيح' }), rep({ GV01: 'غير صحيح', GV02: 'غير صحيح', R01: 'صحيح', L01: 'صحيح' })], uoi, ['A1-U02', 'A1-U04', 'A1-U05', 'A1-U09']);
  const by = Object.fromEntries(ms.map((m) => [m.code, m]));
  assert.deepEqual([by['A1-U02'].n_wrong, by['A1-U02'].n_total], [3, 4]); assert.deepEqual(by['A1-U02'].by_skill, { grammar_vocab: 3 });
  assert.deepEqual([by['A1-U04'].n_wrong, by['A1-U04'].n_total], [3, 4]); assert.deepEqual(by['A1-U04'].by_skill, { grammar_vocab: 2, reading: 1 });
  assert.deepEqual([by['A1-U05'].n_wrong, by['A1-U09'].n_total], [0, 0]);
  assert.equal(by['A1-U02'].samples.length, 2, 'GV02 وGV01 مرّة واحدة لكلٍّ'); for (const s of by['A1-U02'].samples) assert.ok(s.length <= 90);
});

test('م6-ج: draftPlan — صيغة ## و- فقط · المدّة تُقاس · الأهداف من الواصفات أو التركيز · قسم الأخطاء يظهر فقط حين توجد · لا يتجاوز 3 وحدات · فارغ بلا وحدات', () => {
  const us = units(); const chosen = [us[3], us[0]];
  const p = draftPlan({ units: chosen, level: 'A1', group_label: 'A-101', descriptors: new Map([['LU-A1-02', 'يستطيع فهم حروف الجرّ المكانية البسيطة']]) });
  const lines = p.split('\n'); assert.ok(lines.length > 15); for (const l of lines) assert.match(l, /^(## |- )/, l);
  assert.ok(p.includes('المدّة: 60 دقيقة')); assert.ok(p.includes('A1-U04 «أين؟ الأماكن وحروف الجرّ»')); assert.ok(p.includes('يستطيع فهم حروف الجرّ المكانية البسيطة'));
  assert.ok(!p.includes('ما أخطأت فيه المجموعة'), 'بلا أخطاء = بلا قسم'); assert.ok(p.includes('55–60 د · تذكرة الخروج') || /\d+–60 د · تذكرة الخروج/.test(p), 'آخر مرحلة تنتهي عند 60');
  const p90 = draftPlan({ units: chosen, duration_min: 90, mistakes: [{ code: 'A1-U04', n_wrong: 5, n_total: 8, by_skill: { reading: 3, grammar_vocab: 2 }, samples: ['أين الكتاب؟ ___ الطاولة.'] }] });
  assert.ok(p90.includes('المدّة: 90 دقيقة')); assert.ok(p90.includes('ما أخطأت فيه المجموعة')); assert.ok(p90.includes('5 من 8 إجابة غير صحيحة — القراءة (3) · المفردات والتراكيب (2)')); assert.ok(p90.includes('نموذج: «أين الكتاب؟ ___ الطاولة.»')); assert.ok(/\d+–90 د · تذكرة الخروج/.test(p90));
  const p4 = draftPlan({ units: us.slice(0, 5) }); assert.equal((p4.match(/^- س\d/gm) || []).length, 3, 'تذكرة خروج لثلاث وحدات فقط');
  assert.equal(draftPlan({ units: [] }), ''); assert.ok(draftPlan({ units: [us[0]], duration_min: 5 }).includes('المدّة: 30 دقيقة'), 'الحدّ الأدنى 30');
});

test('م6-ج: validateCreate — وحدات ضمن المسموح وحتى 3 · موعد مستقبلي ≤ 120 يومًا · مدّة 30–180 · منصّة معروفة · رابط https · عنوان ≥ 4 · تطبيع', () => {
  const allowed = new Set(['A1-U02', 'A1-U04', 'A1-U05', 'A1-U07']); const now = new Date('2026-11-05T08:00:00Z');
  const base = { invite_id: 'inv1', unit_codes: ['A1-U04', 'A1-U04', 'B1-U01', 'zzz'], starts_at: '2026-11-08T07:00:00Z', duration_min: 60, provider: 'teams', join_url: ' https://teams.microsoft.com/l/x ', title_ar: '  جلسة   مراجعة — أين؟ ', description_ar: '## خطّة\n- نقطة' };
  const ok = validateCreate(base, allowed, now); assert.ok(ok.ok); if (ok.ok) { assert.deepEqual(ok.value.unit_codes, ['A1-U04']); assert.equal(ok.value.join_url, 'https://teams.microsoft.com/l/x'); assert.equal(ok.value.title_ar, 'جلسة مراجعة — أين؟'); assert.equal(ok.value.starts_at, '2026-11-08T07:00:00.000Z'); }
  const bad = (patch: any, re: RegExp) => { const r = validateCreate({ ...base, ...patch }, allowed, now); assert.ok(!r.ok, JSON.stringify(patch)); if (!r.ok) assert.match(r.error, re); };
  bad({ unit_codes: ['B1-U01'] }, /وحدة واحدة/); bad({ unit_codes: ['A1-U02', 'A1-U04', 'A1-U05', 'A1-U07'] }, /حتى 3/); bad({ starts_at: 'x' }, /غير صالح/); bad({ starts_at: '2026-11-01T07:00:00Z' }, /الماضي/); bad({ starts_at: '2027-06-01T07:00:00Z' }, /120/);
  bad({ duration_min: 20 }, /المدّة/); bad({ duration_min: 200 }, /المدّة/); bad({ provider: 'skype' }, /منصّة/); bad({ join_url: 'teams.microsoft.com' }, /https/); bad({ title_ar: 'أب' }, /قصير/); bad({ invite_id: '' }, /الدعوة/);
  const athar = validateCreate({ ...base, provider: 'athar', join_url: '' }, allowed, now); assert.ok(athar.ok); const noUrl = validateCreate({ ...base, join_url: '' }, allowed, now); assert.ok(noUrl.ok && noUrl.value.join_url === null, 'بلا رابط مسموح — يُضاف لاحقًا');
});

test('م6-ج: effectFor/effectText — فرق بعد−قبل للحاضرين مقابل غيرهم · من لا إعادة له لا يُحسب · وحدة لم تظهر في الإعادة لا تُحسب · نصّ عربي بإشارة', () => {
  const rows: EffectIn[] = [
    { email: 'a@x', before: { 'A1-U04': { n: 4, correct: 1 } }, after: { 'A1-U04': { n: 4, correct: 3 } }, attended: true },   /* 25 → 75 = +50 */
    { email: 'b@x', before: { 'A1-U04': { n: 4, correct: 2 } }, after: { 'A1-U04': { n: 4, correct: 2 } }, attended: true },   /* 50 → 50 = 0 */
    { email: 'c@x', before: { 'A1-U04': { n: 4, correct: 2 } }, after: { 'A1-U04': { n: 4, correct: 1 } }, attended: false },  /* 50 → 25 = −25 */
    { email: 'd@x', before: { 'A1-U04': { n: 4, correct: 0 } }, after: null, attended: true },                                   /* لا إعادة */
    { email: 'e@x', before: { 'A1-U04': { n: 4, correct: 0 } }, after: { 'A1-U02': { n: 2, correct: 2 } }, attended: false },   /* الإعادة بلا الوحدة */
  ];
  const [e] = effectFor(rows, ['A1-U04']); assert.deepEqual(e, { code: 'A1-U04', attended: { n: 2, delta: 25 }, others: { n: 1, delta: -25 }, n_retakes: 3 });
  assert.equal(effectText(e, 'أين؟'), 'أين؟: الحاضرون +25 نقطة (2) · غير الحاضرين -25 نقطة (1).');
  const [z] = effectFor([], ['A1-U04']); assert.equal(effectText(z, 'أين؟'), 'أين؟: لا إعادات بعد.'); assert.equal(z.attended.delta, null);
});

test('م6-ج: suggestProgramLinks/programUnitFor — تطابق كلمات العنوان/الناتج · المعتمدة فقط · ≤ 3 مرتّبة · الوحدة البرنامجية المقابلة', () => {
  const us = units(); const s = suggestProgramLinks('الأسبوع 2: العائلة والتعريف بالنفس', 'يعرّف المتدرّب بنفسه وبعائلته', us);
  assert.ok(s.length >= 1 && s.length <= 3); assert.equal(s[0].code, 'A1-U01', JSON.stringify(s));
  assert.deepEqual(suggestProgramLinks('', '', us), []); assert.deepEqual(suggestProgramLinks('العائلة', '', us.map((u) => ({ ...u, status: 'draft' as const }))), [], 'المسوَّدة لا تُقترح');
  const pus = [{ idx: 1, title_ar: 'التعارف', miaar_unit_codes: ['A1-U01'], starts_on: '2026-11-01' }, { idx: 3, title_ar: 'المكان', miaar_unit_codes: ['A1-U04', 'A1-U05'], starts_on: null }];
  assert.deepEqual(programUnitFor('A1-U05', pus), { idx: 3, title_ar: 'المكان', starts_on: null }); assert.equal(programUnitFor('A1-U09', pus), null);
  /* cleanUnits (بطاقة الدبلوم) يقبل الرموز الصالحة فقط ويحدّها بـ 8 */
  const cu = cleanUnits([{ title_ar: 'وحدة', miaar_unit_codes: ['A1-U01', 'A1-U01', 'bad', 'B2-U08', 'C2-U01'] }], []); assert.deepEqual(cu[0].miaar_unit_codes, ['A1-U01', 'B2-U08']);
  assert.deepEqual(cleanUnits([{ title_ar: 'وحدة' }], [])[0].miaar_unit_codes, []);
});

test('م6-ج: قاعدة البيانات (وهمية) — listRemedials يستبعد الملغاة · remedialsForLearner يطابق وحدات المتعلّم ويخفي رابط قاعة أَثَر · joinedEmails يجمع من سجلّ التعلّم · فشل الجدول = []', async () => {
  const S = [
    { id: 's1', title_ar: 'جلسة مراجعة — أين؟', starts_at: '2026-11-08T07:00:00Z', duration_min: 60, provider: 'teams', join_url: 'https://teams.microsoft.com/x', status: 'scheduled', miaar_unit_codes: ['A1-U04'], source_invite_id: 'inv1' },
    { id: 's2', title_ar: 'ملغاة', starts_at: '2026-11-09T07:00:00Z', duration_min: 60, provider: 'zoom', join_url: null, status: 'cancelled', miaar_unit_codes: ['A1-U02'], source_invite_id: 'inv1' },
    { id: 's3', title_ar: 'قاعة أَثَر', starts_at: '2026-11-10T07:00:00Z', duration_min: 45, provider: 'athar', join_url: 'https://meet.jit.si/x', status: 'scheduled', miaar_unit_codes: ['A1-U02', 'A1-U05'], source_invite_id: 'inv1' },
  ];
  const ev = (object_id: string, email: string | null, verb = 'joined') => ({ verb, object_type: 'session', object_id, email }); const E = [ev('s1', 'A@X.com'), ev('s1', 'b@x.com'), ev('s3', 'b@x.com'), ev('s1', null), ev('s3', 'z@x.com', 'viewed')];
  const q = (rows: any[]) => { const st: any = { f: [] as Array<(r: any) => boolean> }; const self: any = { select: () => self, eq: (k: string, v: any) => { st.f.push((r: any) => r[k] === v); return self; }, neq: (k: string, v: any) => { st.f.push((r: any) => r[k] !== v); return self; }, in: (k: string, vs: any[]) => { st.f.push((r: any) => vs.includes(r[k])); return self; }, order: () => self, limit: () => self, then: (res: any) => res({ data: rows.filter((r) => st.f.every((f: any) => f(r))), error: null }) }; return self; };
  const db = { from: (t: string) => (t === 'portal_sessions' ? q(S) : t === 'portal_learning_events' ? q(E) : q([])) };
  const ls = await listRemedials(db, 'inv1'); assert.deepEqual(ls.map((s) => s.id), ['s1', 's3']);
  const mine = await remedialsForLearner(db, 'inv1', ['A1-U05']); assert.equal(mine.length, 1); assert.equal(mine[0].id, 's3'); assert.equal(mine[0].join_url, null, 'رابط قاعة أَثَر لا يُكشف على البطاقة العامة');
  assert.deepEqual((await remedialsForLearner(db, 'inv1', ['A1-U04'])).map((s) => s.join_url), ['https://teams.microsoft.com/x']); assert.deepEqual(await remedialsForLearner(db, null, ['A1-U04']), []); assert.deepEqual(await remedialsForLearner(db, 'inv1', []), []);
  const j = await joinedEmails(db, ['s1', 's3']); assert.deepEqual([...j.get('s1')!].sort(), ['a@x.com', 'b@x.com']); assert.deepEqual([...j.get('s3')!], ['b@x.com']); assert.equal((await joinedEmails(db, [])).size, 0);
  const broken = { from: () => { throw new Error('no table'); } }; assert.deepEqual(await listRemedials(broken, 'inv1'), []); assert.equal((await joinedEmails(broken, ['s1'])).size, 0);
  assert.deepEqual([...unitsOfItemMap([{ code: 'GV01', unitCodes: ['A1-U02'] }, { code: 'GV02', unitCodes: [] }, { code: 'GV03' }]).keys()], ['GV01']); assert.deepEqual(titlesOf(['A1-U04', 'zz'], units()).map((u) => u.code), ['A1-U04']);
});

test('م6-ج: الذكاء — parsePlan يقبل الصيغة الصحيحة فقط (≥ 70% أسطر ## أو -) ويزيل أسوار الكود ويحدّ الطول؛ المطالبة تحمل المسوَّدة والمستوى؛ النظام يمنع وحدات جديدة وذكر الذكاء', () => {
  const good = '## عنوان\n- نقطة أولى طويلة بما يكفي\n- نقطة ثانية طويلة بما يكفي\n- نقطة ثالثة طويلة بما يكفي\n## قسم\n- نقطة رابعة طويلة بما يكفي';
  assert.equal(parsePlan('```markdown\n' + good + '\n```'), good); assert.equal(parsePlan('نص حرّ طويل '.repeat(20)), null); assert.equal(parsePlan('## قصير'), null);
  const mixed = good + '\nسطر حرّ\nسطر حرّ آخر\nثالث'; assert.equal(parsePlan(mixed), null, '3 أسطر حرّة من 9 = 67% < 70%');
  const long = Array.from({ length: 120 }, (_, i) => `- نقطة رقم ${i} طويلة بما يكفي لتُحسب`).join('\n'); assert.equal(parsePlan(long)!.split('\n').length, 80);
  assert.ok(planPrompt('مسوَّدة', 'A1').includes('المستوى: A1')); assert.ok(PLAN_SYSTEM.includes('لا تضف وحدات')); assert.ok(PLAN_SYSTEM.includes('لا تذكر الذكاء'));
});

test('م6-ج: الهجرة — حارس الترتيب · الأعمدة الثلاثة · توسيع قيد النوع · التشخيص 1·1·1·1 · بلا جدول جديد', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20270203_portal_miaar_m6c_remedial.sql'), 'utf8');
  assert.ok(sql.includes("raise exception 'مِعيار م6-ج")); assert.ok(sql.includes('miaar_syllabus_units'));
  assert.ok(sql.includes('alter table public.portal_program_units add column if not exists miaar_unit_codes text[]')); assert.ok(sql.includes('alter table public.portal_sessions add column if not exists miaar_unit_codes text[]')); assert.ok(sql.includes('add column if not exists source_invite_id uuid'));
  assert.ok(sql.includes("drop constraint if exists psn_kind_chk")); assert.ok(sql.includes("'office_hours','remedial'")); assert.ok(!/create table/i.test(sql), 'بلا جدول جديد'); assert.ok(sql.includes("notify pgrst, 'reload schema'"));
  assert.ok(sql.includes('pu_col') && sql.includes('ps_units') && sql.includes('ps_src') && sql.includes('kind_ok'));
  /* الواجهات والمسارات موجودة ومسجَّلة */
  for (const f of ['app/api/admin/miaar/remedial/route.ts', 'app/admin/miaar/RemedialPanel.tsx', 'lib/miaar/remedial.ts']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  assert.ok(fs.readFileSync(path.join(ROOT, 'app/admin/miaar/ExitBoard.tsx'), 'utf8').includes('<RemedialPanel')); assert.ok(fs.readFileSync(path.join(ROOT, 'app/miaar/MiaarApp.tsx'), 'utf8').includes('mi-exit-session')); assert.ok(fs.readFileSync(path.join(ROOT, 'lib/miaar/engine.ts'), 'utf8').includes('remedialsForLearner'));
});
