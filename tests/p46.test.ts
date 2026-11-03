// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P46 — «محور التقارير» (توثيق الجودة والأداء) ر1: الأسماء · مفتاح التقدير · القالب الفعّال · الأسبوع والفترة · الكشف من الحضور · التنظيف · الإحصاء · الصلاحيات · الاكتمال · الصياغة المحلية · التحقّق العام · الخزنة · المسارات
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P46_NAMES_AR, KINDS, STATUSES, STATUS_AR, PASS_MARK, REGULAR_PCT, LINE_MAX, LINE_MIN, MAX_ACTIVITIES, MAX_TOOLS, MAX_STUDENTS, GRADES, GRADE_KEY_AR, gradeOf, ARABIC_SKILLS, GENERIC_SKILLS, ARABIC_STRATEGIES, GENERIC_STRATEGIES, effectiveTemplate,
  emptyBody, cleanBody, cleanStudents, cleanLines, summativeStats, weakestSkill, skillAverages, weekBounds, weekNo, validPeriod, buildRoster, hoursOf, rosterKey, canEdit, canDecide, canView, isAuthor, missingBeforeSubmit,
  localPhrases, parsePhrases, phrasePrompt, verifyCode, VERIFY_ALPHABET, publicVerifyView, listLineAr, type StudentRow, type Computed,
} from '../lib/reports/registry';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { crumbsFor } from '../lib/portal/way';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';

const S = (o: Partial<StudentRow> = {}): StudentRow => ({ key: 'e:a@x.sa', name: 'أحمد', email: 'a@x.sa', level: null, attendance_pct: 100, scores: {}, avg: null, grade_ar: null, note: '', ...o });
const computed = (o: Partial<Computed> = {}): Computed => ({ program_ar: 'العربية للناطقين بغيرها', program_type: 'arabic', org_ar: 'جامعة أَثَر', trainer_ar: 'د. محمد', classroom_ar: 'شعبة 1 · A-101', level_ar: 'مبتدئ', delivery_ar: 'حضوري', enrolled: 10, regular: 8, sessions: 5, hours: 15, units: ['الوحدة 3'], period_from: '2026-11-01', period_to: '2026-11-05', week_no: 3, attendance: {}, computed_at: '2026-11-05T10:00:00Z', skills: ARABIC_SKILLS, strategies: ARABIC_STRATEGIES, ...o });
const me = { id: 'u5', email: 'reem@example.com' }; const staff = { id: 'u1', email: 'admin@upm.edu.sa', staff: true };
const rep = (o: any = {}) => ({ status: 'draft', author_id: 'u5', author_email: 'reem@example.com', ...o });

test('الأسماء: محور التقارير · توثيق الجودة والأداء · تقرير التعلّم الأسبوعي · الأنواع الستة · الحالات الأربع', () => {
  assert.equal(P46_NAMES_AR.axis, 'محور التقارير'); assert.equal(P46_NAMES_AR.official, 'توثيق الجودة والأداء'); assert.equal(P46_NAMES_AR.weekly, 'تقرير التعلّم الأسبوعي'); assert.equal(P46_NAMES_AR.weekly_full, 'تقرير التعلّم الشامل'); assert.equal(P46_NAMES_AR.line, 'سطر لك من تقرير الأسبوع');
  assert.equal(KINDS.length, 6); assert.ok(KINDS.includes('weekly') && KINDS.includes('final') && KINDS.includes('mission')); assert.equal(STATUSES.length, 4); for (const s of STATUSES) assert.ok(STATUS_AR[s], s); assert.equal(STATUS_AR.submitted, 'بانتظار الاعتماد');
  assert.equal(PASS_MARK, 60); assert.equal(REGULAR_PCT, 75); assert.equal(LINE_MAX, 300); assert.equal(LINE_MIN, 3); assert.equal(MAX_ACTIVITIES, 5); assert.equal(MAX_TOOLS, 4); assert.equal(MAX_STUDENTS, 60);
  assert.equal(AI_LIMITS.report_phrase, 40); assert.ok(AI_PURPOSE_LABEL.report_phrase.ar.includes('لا تقديرات'));
});
test('مفتاح التقدير من نموذج المستخدم: 90–100 ممتاز · 80–89 جيد جدًا · 70–79 جيد · 60–69 مقبول · <60 ضعيف', () => {
  assert.equal(GRADES.length, 5); assert.equal(gradeOf(100)?.ar, 'ممتاز'); assert.equal(gradeOf(90)?.ar, 'ممتاز'); assert.equal(gradeOf(89.9)?.ar, 'جيد جدًا'); assert.equal(gradeOf(80)?.ar, 'جيد جدًا'); assert.equal(gradeOf(79)?.ar, 'جيد'); assert.equal(gradeOf(70)?.ar, 'جيد'); assert.equal(gradeOf(65)?.ar, 'مقبول'); assert.equal(gradeOf(60)?.ar, 'مقبول'); assert.equal(gradeOf(59.9)?.ar, 'ضعيف'); assert.equal(gradeOf(0)?.ar, 'ضعيف'); assert.equal(gradeOf(null), null); assert.equal(gradeOf(NaN), null);
  assert.ok(GRADE_KEY_AR.includes('ممتاز (90–100%)') && GRADE_KEY_AR.includes('ضعيف (أقل من 60%)'));
});
test('القالب الفعّال: العربية = 5 مهارات لغوية + استراتيجياتها · غيرها = مهارات البرنامج أو العامة · قالب الجهة يغلب · حدود 2–8', () => {
  const ar = effectiveTemplate({ program_type: 'arabic' }); assert.equal(ar.skills.length, 5); assert.deepEqual(ar.skills.map(s => s.name_ar), ['استماع', 'تحدّث', 'نطق', 'قراءة', 'كتابة']); assert.equal(ar.strategies, ARABIC_STRATEGIES); assert.equal(ar.source, 'arabic');
  const co = effectiveTemplate({ program_type: 'course' }); assert.equal(co.skills, GENERIC_SKILLS); assert.equal(co.strategies, GENERIC_STRATEGIES); assert.equal(co.source, 'generic');
  const ps = effectiveTemplate({ program_type: 'diploma', programSkills: [{ code: 'a', name_ar: 'التخطيط' }, { code: 'b', name_ar: 'التقويم' }] }); assert.equal(ps.source, 'program_skills'); assert.equal(ps.skills.length, 2);
  const one = effectiveTemplate({ program_type: 'diploma', programSkills: [{ code: 'a', name_ar: 'التخطيط' }] }); assert.equal(one.source, 'generic');
  const tpl = effectiveTemplate({ program_type: 'arabic', template: { skills: Array.from({ length: 12 }, (_, i) => ({ code: 's' + i, name_ar: 'مهارة ' + i })), strategies: ['س1', '', 'س2'] } }); assert.equal(tpl.source, 'template'); assert.equal(tpl.skills.length, 8); assert.deepEqual(tpl.strategies, ['س1', 'س2']);
  const badTpl = effectiveTemplate({ program_type: 'arabic', template: { skills: [{ code: 'x', name_ar: 'واحدة' }] } }); assert.equal(badTpl.source, 'arabic');
});
test('الأسبوع: الأحد→الخميس · رقم الأسبوع من بداية البرنامج · الفترة من يوم إلى شهر', () => {
  assert.deepEqual(weekBounds('2026-11-03'), { from: '2026-11-01', to: '2026-11-05' });   // الثلاثاء
  assert.deepEqual(weekBounds('2026-11-01'), { from: '2026-11-01', to: '2026-11-05' });   // الأحد
  assert.deepEqual(weekBounds('2026-11-07'), { from: '2026-11-01', to: '2026-11-05' });   // السبت → الأسبوع المنتهي للتوّ
  assert.deepEqual(weekBounds('2026-11-06'), { from: '2026-11-01', to: '2026-11-05' });   // الجمعة → الأسبوع المنتهي للتوّ
  assert.equal(weekNo('2026-10-18', '2026-11-01'), 3); assert.equal(weekNo('2026-11-01', '2026-11-01'), 1); assert.equal(weekNo(null, '2026-11-01'), 1); assert.equal(weekNo('2026-12-01', '2026-11-01'), 1);
  assert.ok(validPeriod('2026-11-01', '2026-11-05').ok); assert.ok(!validPeriod('2026-11-05', '2026-11-01').ok); assert.ok(!validPeriod('2026-11-01', '2026-12-15').ok); assert.ok(validPeriod('2026-11-01', '2026-11-30').ok); assert.ok(!validPeriod('x', '2026-11-01').ok); assert.ok(validPeriod('2026-11-01', '2026-11-01').ok);
});
test('الكشف: المسجَّلون ∪ هويات الحضور · الحضور المتأخّر يُحتسب · الغياب لا · المنتظم ≥ 75% · بلا جلسات = غير محدَّد (يُعدّ منتظمًا) · الساعات من الأوقات', () => {
  const sessions = [{ id: 's1', session_date: '2026-11-01', start_time: '09:00', end_time: '12:00' }, { id: 's2', session_date: '2026-11-02', start_time: '09:00', end_time: '10:30' }, { id: 's3', session_date: '2026-11-03', start_time: '09:00', end_time: '12:00' }, { id: 's4', session_date: '2026-11-04', start_time: null, end_time: null }];
  assert.equal(hoursOf(sessions[0]), 3); assert.equal(hoursOf(sessions[1]), 1.5); assert.equal(hoursOf(sessions[3]), 0);
  const enrolled = [{ full_name: 'يوسف', email: 'Y@X.sa', placement_level: 'A1' }, { full_name: 'هند', email: null }];
  const records = [{ session_id: 's1', email: 'y@x.sa', status: 'present' }, { session_id: 's2', email: 'y@x.sa', status: 'late' }, { session_id: 's3', email: 'y@x.sa', status: 'present' }, { session_id: 's4', email: 'y@x.sa', status: 'absent' },
    { session_id: 's1', full_name: 'هند', status: 'present' }, { session_id: 's1', email: 'ghost@x.sa', full_name: 'زائر', status: 'present' }, { session_id: 'other', email: 'nobody@x.sa', status: 'present' }];
  const { roster, attendance, regular } = buildRoster(enrolled, sessions, records);
  assert.equal(roster.length, 3); const y = roster.find(r => r.email === 'y@x.sa')!; assert.equal(y.attendance_pct, 75); assert.equal(y.level, 'A1'); assert.equal(y.key, 'e:y@x.sa');
  const h = roster.find(r => r.name === 'هند')!; assert.equal(h.attendance_pct, 25); assert.equal(h.key, rosterKey(null, 'هند')); assert.ok(roster.some(r => r.email === 'ghost@x.sa')); assert.ok(!roster.some(r => r.email === 'nobody@x.sa'));
  assert.equal(regular, 1); assert.equal(attendance['e:y@x.sa'].present, 3); assert.equal(attendance['e:y@x.sa'].total, 4);
  const none = buildRoster(enrolled, [], []); assert.equal(none.roster[0].attendance_pct, null); assert.equal(none.regular, 2);
});
test('التنظيف: الجسم يحفظ 5 أيام · أنشطة ≤ 5 · أدوات ≤ 4 · القيم المغلقة تُفلتر · استراتيجيات القالب + إضافات المعلّم · الدرجات 0–100 والمتوسط والتقدير · الأسطر لمن له بريد وبطول ≥ 3', () => {
  const b0 = emptyBody(['س1', 'س2']); assert.equal(b0.objectives.days.length, 5); assert.equal(b0.activities.strategies.length, 2); assert.equal(b0.activities.strategies[0].name, 'س1');
  const b = cleanBody({ general: { institution: '  جامعة  أَثَر ', notes: 'x'.repeat(2000) }, objectives: { days: Array.from({ length: 9 }, () => ({ goal: 'هدف', skill: 'قراءة', fit: 'weird', note: '' })), achieved: 'full' }, activities: { items: Array.from({ length: 9 }, (_, i) => ({ name: 'ن' + i })), strategies: [{ name: 'مزوّرة', applied: 'yes' }, { name: 'س2', applied: 'partial', how: 'كيف' }] }, assessment: { formative: { response: 'bad' }, summative: { tools: Array.from({ length: 9 }, () => ({ tool: 'اختبار' })) } }, recommendations: { promote: [{ key: 'k', name: 'n', reason: 'r', date: 'notadate' }], next_week: { focus: 'تركيز' } } }, ['س1', 'س2']);
  assert.equal(b.general.institution, 'جامعة أَثَر'); assert.equal(b.general.notes.length, 600); assert.equal(b.objectives.days.length, 5); assert.equal(b.objectives.days[0].fit, ''); assert.equal(b.objectives.achieved, 'full'); assert.equal(b.activities.items.length, MAX_ACTIVITIES); assert.equal(b.activities.strategies.length, 3); assert.equal(b.activities.strategies[1].applied, 'partial'); assert.equal(b.activities.strategies[0].applied, ''); assert.equal(b.activities.strategies[2].name, 'مزوّرة');   // استراتيجية أضافها المعلّم تُحفظ بعد استراتيجيات القالب (≤ 4)
  assert.equal(b.assessment.formative.response, ''); assert.equal(b.assessment.summative.tools.length, MAX_TOOLS); assert.equal(b.recommendations.promote[0].date, ''); assert.equal(b.recommendations.next_week.focus, 'تركيز');
  const roster = [S(), S({ key: 'n:هند', name: 'هند', email: null })]; const skills = ARABIC_SKILLS;
  const st = cleanStudents([{ key: 'e:a@x.sa', scores: { listening: 95, speaking: '85', reading: 500, writing: -4, pronunciation: 'x' }, note: 'م'.repeat(300) }, { key: 'ghost', scores: { listening: 1 } }], roster, skills);
  assert.equal(st.length, 2); assert.equal(st[0].scores.listening, 95); assert.equal(st[0].scores.speaking, 85); assert.equal(st[0].scores.reading, 100); assert.equal(st[0].scores.writing, 0); assert.equal(st[0].scores.pronunciation, null); assert.equal(st[0].avg, 70); assert.equal(st[0].grade_ar, 'جيد'); assert.equal(st[0].note.length, 160); assert.equal(st[1].avg, null); assert.equal(st[1].grade_ar, null);
  const lines = cleanLines([{ key: 'e:a@x.sa', text: ' صوتك أوضح ' }, { key: 'n:هند', text: 'لن تصل' }, { key: 'e:a@x.sa', text: 'قص' }, { key: 'zz', text: 'xxxx' }], roster); assert.equal(lines.length, 1); assert.equal(lines[0].email, 'a@x.sa'); assert.equal(lines[0].text, 'صوتك أوضح');
  assert.equal(cleanLines([{ key: 'e:a@x.sa', text: 'الأولى' }, { key: 'e:a@x.sa', text: 'الأخيرة تغلب' }], roster)[0].text, 'الأخيرة تغلب');
  assert.equal(cleanLines([{ key: 'e:a@x.sa', text: 'ab' }], roster).length, 0);
});
test('الإحصاء: متوسط · أعلى · أدنى · ناجحون ≥ 60 · يحتاجون دعمًا < 60 · متوسط كل مهارة · المهارة الأضعف', () => {
  const ss = [S({ avg: 92, scores: { listening: 90, speaking: 94 } }), S({ key: 'b', avg: 55, scores: { listening: 50, speaking: 60 } }), S({ key: 'c', avg: 70, scores: { listening: 80, speaking: 60 } }), S({ key: 'd', avg: null })];
  const st = summativeStats(ss); assert.equal(st.n, 3); assert.equal(st.avg, 72.3); assert.equal(st.max, 92); assert.equal(st.min, 55); assert.equal(st.pass_pct, 67); assert.equal(st.support_pct, 33);
  const e = summativeStats([S()]); assert.equal(e.n, 0); assert.equal(e.avg, null); assert.equal(e.pass_pct, null);
  const sk = [{ code: 'listening', name_ar: 'استماع' }, { code: 'speaking', name_ar: 'تحدّث' }, { code: 'writing', name_ar: 'كتابة' }];
  const sa = skillAverages(ss, sk); assert.equal(sa[0].avg, 73.3); assert.equal(sa[1].avg, 71.3); assert.equal(sa[2].avg, null);
  assert.equal(weakestSkill(ss[1], sk)?.code, 'listening'); assert.equal(weakestSkill(ss[2], sk)?.code, 'speaking'); assert.equal(weakestSkill(ss[3], sk), null);
});
test('الصلاحيات: المؤلّف وحده يحرّر المسودّة والمُعاد (لا الطاقم) · الطاقم يقرّر المُرسَل فقط · الرؤية للمؤلّف والطاقم · المؤلّف بالمعرّف أو البريد', () => {
  assert.ok(canEdit(rep(), me)); assert.ok(canEdit(rep({ status: 'returned' }), me)); assert.ok(!canEdit(rep({ status: 'submitted' }), me)); assert.ok(!canEdit(rep({ status: 'approved' }), me)); assert.ok(!canEdit(rep(), staff));
  assert.ok(canEdit(rep({ status: 'draft' }), { ...staff, id: 'u5' }));   // الطاقم يحرّر ما ألّفه هو فقط
  assert.ok(canDecide(rep({ status: 'submitted' }), staff)); assert.ok(!canDecide(rep({ status: 'submitted' }), me)); assert.ok(!canDecide(rep({ status: 'draft' }), staff));
  assert.ok(canView(rep(), me)); assert.ok(canView(rep(), staff)); assert.ok(!canView(rep(), { id: 'u9', email: 'x@y.sa' })); assert.ok(isAuthor(rep({ author_id: null, author_email: 'REEM@example.com' }), me));
});
test('الاكتمال قبل الإرسال: هدف · مدى التحقّق · نشاط · الاستجابة · درجة واحدة · تركيز الأسبوع القادم', () => {
  const b = emptyBody([]); const m = missingBeforeSubmit(b, [S()]); assert.equal(m.length, 6); assert.ok(m[0].includes('القسم الثاني')); assert.ok(m[5].includes('القسم السادس'));
  b.objectives.days[0].goal = 'هدف'; b.objectives.achieved = 'partial'; b.activities.items.push({ name: 'ن', skill: '', desc: '', teacher_role: '', student_role: '', tools: '' }); b.assessment.formative.response = 'good'; b.recommendations.next_week.focus = 'تركيز';
  assert.deepEqual(missingBeforeSubmit(b, [S({ avg: 80 })]), []); assert.equal(missingBeforeSubmit(b, [S()]).length, 1);
});
test('«صِغ لي من الأرقام» محليًا: جمل من الأرقام فقط · بلا أسماء · الأقسام الخمسة · ≤ 6 · التحليل يرفض التقدير/التوصية · الموجّه يمنع الاسم والتقدير', () => {
  const c = computed(); const ss = [S({ name: 'أحمد الفريد', avg: 92, scores: { listening: 90, speaking: 94, reading: 92 }, attendance_pct: 100 }), S({ key: 'b', name: 'بدر', avg: 55, scores: { listening: 50, speaking: 60, reading: 55 }, attendance_pct: 40 })];
  const ph = localPhrases(c, ss, ARABIC_SKILLS); assert.ok(ph.length >= 3 && ph.length <= 6); assert.ok(ph.every(p => !p.text.includes('أحمد') && !p.text.includes('بدر'))); assert.ok(ph.some(p => p.section === 'admin_attendance' && p.text.includes('5 جلسات'))); assert.ok(ph.some(p => p.section === 'strengths' && p.text.includes('تحدّث'))); assert.ok(ph.some(p => p.text.includes('1 من المتدرّبين دون حدّ الانتظام')));
  assert.deepEqual(localPhrases(computed({ sessions: 0 }), [], ARABIC_SKILLS), []);
  const parsed = parsePhrases('نص قبل [{"section":"strengths","text":"أعلى متوسط للمجموعة في مهارة التحدّث (94%)."},{"section":"bogus","text":"رُصدت درجات اثنين من المتدرّبين بمتوسط 73%."},{"section":"challenges","text":"أوصي بنقل الطالب إلى مستوى أعلى."},{"section":"challenges","text":"قصير"}] بعد');
  assert.ok(parsed); assert.equal(parsed!.length, 2); assert.equal(parsed![1].section, 'general_notes'); assert.equal(parsePhrases('ليس JSON'), null); assert.equal(parsePhrases('{"a":1}'), null);
  const p = phrasePrompt(c, ss, ARABIC_SKILLS); assert.ok(p.system.includes('ممنوع')); assert.ok(!p.user.includes('أحمد')); assert.ok(p.user.includes('"enrolled":10')); assert.ok(p.user.includes('low_attendance_count":1'));
});
test('رمز التحقّق R+9 من أبجدية مِعيار · العرض العام بلا أسماء طلاب ولا درجات · سطر القائمة', () => {
  const code = verifyCode(() => 0.5); assert.equal(code.length, 10); assert.ok(code.startsWith('R')); assert.ok([...code.slice(1)].every(ch => VERIFY_ALPHABET.includes(ch))); assert.ok(!VERIFY_ALPHABET.includes('O') && !VERIFY_ALPHABET.includes('0') && !VERIFY_ALPHABET.includes('I'));
  const full = { verify_code: 'RABCDEFGHJ', status: 'approved', week_no: 3, period_from: '2026-11-01', period_to: '2026-11-05', author_name: 'د. محمد', approved_name: 'المدير', approved_at: '2026-11-06T08:00:00Z', computed: computed(), kind: 'weekly', students: [S({ name: 'سرّي' })], body: { x: 1 } };
  const v = publicVerifyView(full); const js = JSON.stringify(v); assert.equal(v.code, 'RABCDEFGHJ'); assert.equal(v.kind_ar, 'تقرير التعلّم الأسبوعي'); assert.equal(v.enrolled, 10); assert.ok(!js.includes('سرّي') && !js.includes('students') && !js.includes('body')); assert.ok(!v.verify_code);
  assert.equal(publicVerifyView({ ...full, status: 'submitted' }), null); assert.equal(publicVerifyView({ ...full, verify_code: null }), null);
  const line = listLineAr({ week_no: 3, period_from: '2026-11-01', period_to: '2026-11-05', computed: computed(), status: 'approved' }); assert.ok(line.includes('الأسبوع 3') && line.includes('العربية للناطقين بغيرها') && line.includes('شعبة 1') && line.includes('معتمَد'));
});
test('الخزنة والمسارات: 3 جداول (قالب لا-شخصي · تقارير self+staff · أسطر self) · فتات /me/reports و/admin/reports و/verify/report', () => {
  assert.ok(NON_PERSONAL_TABLES.includes('portal_report_templates'));
  const rp = REGISTRY.find(r => r.table === 'portal_reports')!; assert.ok(rp); assert.equal(rp.userCol, 'author_id'); assert.equal(rp.emailCol, 'author_email'); assert.deepEqual(rp.access, ['self', 'staff']); assert.equal(rp.policy, 'anonymize');
  const rl = REGISTRY.find(r => r.table === 'portal_report_lines')!; assert.ok(rl); assert.deepEqual(rl.access, ['self']); assert.equal(rl.policy, 'delete');
  const c1 = crumbsFor('/me/reports', 'ar'); assert.equal(c1[c1.length - 1].label, 'تقاريري'); const c2 = crumbsFor('/admin/reports', 'ar'); assert.equal(c2[c2.length - 1].label, 'التقارير'); const c3 = crumbsFor('/verify/report/RABC', 'ar'); assert.ok(c3.some(c => c.label === 'التحقّق من تقرير'));
});
