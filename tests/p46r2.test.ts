// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P46 ر2 — التقرير الختامي لأداء المتدرّبين («خاتمة الرحلة»): الأسماء · النضج والتقدّم · المسارات من الأسبوعيات · الاقتراح الآلي · التنظيف · النواقص · التوقيعان · الفقرة · العرض العام · المسارات والخزنة
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P46_NAMES_AR, RECS, REC_AR, PROMOTE_MIN, PROMOTE_ATT, SUPPORT_MAX, FINAL_READY_PCT, FINAL_READY_DAYS, SIGNS, SIGN_AR, PARA_MAX, TREND_AR,
  progressPct, maturityOf, finalSuggested, trendOf, buildTrajectories, suggestRec, distribution, emptyFinalBody, cleanFinalBody, cleanFinalStudents, missingBeforeFinalSubmit,
  canSign, signoffComplete, signoffView, localParagraph, paragraphPrompt, parseParagraph, studentPageData, publicVerifyView, listLineAr, ARABIC_SKILLS, type StudentRow, type WeekSrc, type FinalStudent,
} from '../lib/reports/registry';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { crumbsFor, NO_PAGE } from '../lib/portal/way';

const S = (o: Partial<StudentRow> = {}): StudentRow => ({ key: 'e:a@x.sa', name: 'أحمد', email: 'a@x.sa', level: null, attendance_pct: 100, scores: {}, avg: null, grade_ar: null, note: '', ...o });
const W = (week_no: number, avgA: number | null, avgB: number | null, extra: Partial<WeekSrc> = {}): WeekSrc => ({ id: 'w' + week_no, week_no, period_from: `2026-10-${String(week_no * 7).padStart(2, '0')}`, period_to: `2026-10-${String(week_no * 7 + 4).padStart(2, '0')}`, verify_code: 'R' + week_no + 'ABCDEFGH',
  students: [S({ avg: avgA, scores: { listening: avgA, speaking: avgA === null ? null : avgA - 10 } }), S({ key: 'e:b@x.sa', name: 'بدر', email: 'b@x.sa', avg: avgB, scores: { listening: avgB, speaking: avgB } })], strengths: [{ point: 'تفاعل', evidence: 'ملاحظة' }], challenges: [{ point: 'النطق', action: 'تكرار' }], lines: [{ key: 'e:a@x.sa', email: 'a@x.sa', text: `سطر ${week_no}` }], promote: week_no === 2 ? [{ key: 'e:a@x.sa' }] : [], support: [{ key: 'e:b@x.sa' }], ...extra });
const skills = ARABIC_SKILLS.slice(0, 2);

test('الأسماء والثوابت: خاتمة الرحلة · التوصيات الأربع · قاعدة 80/75/60 · 75% أو 14 يومًا · توقيعان', () => {
  assert.equal(P46_NAMES_AR.final, 'التقرير الختامي لأداء المتدربين'); assert.equal(P46_NAMES_AR.final_story, 'خاتمة الرحلة'); assert.equal(P46_NAMES_AR.maturity, 'نضج التقرير'); assert.ok(P46_NAMES_AR.promote_btn.includes('تنسيب'));
  assert.deepEqual([...RECS], ['promote', 'continue', 'support', 'repeat']); assert.equal(REC_AR.promote, 'رفع للمستوى الأعلى'); assert.equal(PROMOTE_MIN, 80); assert.equal(PROMOTE_ATT, 75); assert.equal(SUPPORT_MAX, 60); assert.equal(FINAL_READY_PCT, 75); assert.equal(FINAL_READY_DAYS, 14);
  assert.deepEqual([...SIGNS], ['quality', 'manager']); assert.equal(SIGN_AR.manager, 'مدير البرنامج'); assert.equal(PARA_MAX, 420); assert.equal(TREND_AR.up, 'صاعد');
});
test('تقدّم البرنامج والنضج: 0..100 · المتوقَّع = أسابيع حتى اليوم (أو النهاية) · لا يقلّ عن المعتمَد', () => {
  assert.equal(progressPct('2026-10-01', '2026-10-31', '2026-10-16'), 50); assert.equal(progressPct('2026-10-01', '2026-10-31', '2026-12-01'), 100); assert.equal(progressPct(null, '2026-10-31', '2026-10-16'), null); assert.equal(progressPct('2026-10-01', '2026-10-01', '2026-10-16'), 100);
  const m = maturityOf(2, '2026-10-01', '2026-12-31', '2026-10-28'); assert.equal(m.expected, 4); assert.equal(m.approved, 2); assert.equal(m.pct, 50);
  assert.equal(maturityOf(3, '2026-10-01', '2026-10-10', '2026-12-01').expected, 3);   // انتهى البرنامج بعد أسبوعين لكن المعتمَد 3 → لا يتجاوز 100%
  assert.equal(maturityOf(0, null, null, '2026-10-28').expected, 1);
});
test('متى يُقترح البدء: أسبوعيتان معتمدتان · أو 75% من المدّة · أو 14 يومًا قبل النهاية · وإلا لا', () => {
  assert.equal(finalSuggested(10, '2027-01-01', '2026-10-28', 2), true); assert.equal(finalSuggested(80, null, '2026-10-28', 0), true); assert.equal(finalSuggested(20, '2026-11-05', '2026-10-28', 0), true); assert.equal(finalSuggested(20, '2027-01-01', '2026-10-28', 1), false); assert.equal(finalSuggested(null, null, '2026-10-28', 0), false);
});
test('المسارات من الأسبوعيات: ترتيب زمني · لكل مهارة قيم بالأسابيع · أوّل/آخر/الفرق/الاتجاه · أفضل وأضعف مهارة · الأسطر السابقة · مرّات الذكر', () => {
  const roster = [S(), S({ key: 'e:b@x.sa', name: 'بدر', email: 'b@x.sa', attendance_pct: 50 }), S({ key: 'n:جديد', name: 'جديد', email: null })];
  const t = buildTrajectories(roster, [W(3, 90, 55), W(1, 60, 50), W(2, 75, null)], skills);
  assert.equal(t.length, 3); assert.deepEqual(t[0].weeks, [1, 2, 3]); assert.deepEqual(t[0].avgs, [60, 75, 90]); assert.deepEqual(t[0].skills.listening, [60, 75, 90]); assert.deepEqual(t[0].skills.speaking, [50, 65, 80]);
  assert.equal(t[0].first, 60); assert.equal(t[0].last, 90); assert.equal(t[0].delta, 30); assert.equal(t[0].trend, 'up'); assert.equal(t[0].best_skill, 'listening'); assert.equal(t[0].weakest_skill, 'speaking'); assert.deepEqual(t[0].lines, ['سطر 1', 'سطر 2', 'سطر 3']); assert.equal(t[0].mentioned.promote, 1);
  assert.deepEqual(t[1].avgs, [50, null, 55]); assert.equal(t[1].delta, 5); assert.equal(t[1].trend, 'up'); assert.equal(t[1].mentioned.support, 3); assert.equal(t[1].weakest_skill, null);   // المهارتان متساويتان → لا «أضعف»
  assert.deepEqual(t[2].avgs, [null, null, null]); assert.equal(t[2].delta, null); assert.equal(t[2].trend, null);
  assert.equal(trendOf(70, 72), 'flat'); assert.equal(trendOf(70, 60), 'down'); assert.equal(trendOf(null, 60), null);
});
test('الاقتراح الآلي: ≥80 و حضور ≥75 → رفع · <60 → دعم · وإلا استمرار · الختامي يغلب آخر أسبوع · «إعادة» لا تُقترح', () => {
  assert.equal(suggestRec(85, 50, 80), 'promote'); assert.equal(suggestRec(85, 50, 60), 'continue'); assert.equal(suggestRec(null, 85, null), 'promote'); assert.equal(suggestRec(55, 90, 100), 'support'); assert.equal(suggestRec(70, null, 100), 'continue'); assert.equal(suggestRec(null, null, 100), null);
  const d = distribution([{ avg: 95 }, { avg: 85 }, { avg: 85 }, { avg: 50 }, { avg: null }]); assert.deepEqual(d.map(x => x.n), [1, 2, 0, 0, 1]);
});
test('تنظيف الختامي: البنية كاملة دائمًا · التواقيع والتنسيب لا تأتي من المتصفح · الكشف يحمل rec/reason/paragraph · إعادة فارغة بلا rec', () => {
  const e = emptyFinalBody(); assert.deepEqual(Object.keys(e), ['general', 'summary', 'results', 'recommendations', 'strengths', 'admin', 'signoff', 'promotion']);
  const b = cleanFinalBody({ summary: { overview: '  نظرة  عامة ' }, signoff: { quality: { name: 'مخترق', at: '2026-01-01' } }, promotion: { at: 'x' }, strengths: { strengths: [{ point: 'أ', evidence: 'ب' }, { point: '' }] } });
  assert.equal(b.summary.overview, 'نظرة عامة'); assert.equal(b.signoff.quality, null); assert.equal(b.promotion, null); assert.equal(b.strengths.strengths.length, 1);
  const kept = cleanFinalBody({}, { signoff: { quality: { name: 'نورة', email: 'N@x.sa', id: 'u2', at: '2026-11-01T00:00:00Z' }, manager: null }, promotion: { at: '2026-11-02T00:00:00Z', by: 'u1', program_id: 'p9', program_ar: 'المستوى 2', created: 3, skipped: 1 } }); assert.equal(kept.signoff.quality?.email, 'n@x.sa'); assert.equal(kept.promotion?.created, 3);
  const st = cleanFinalStudents([{ key: 'e:a@x.sa', scores: { listening: 90, speaking: 80 }, rec: 'promote', reason: 'تقدّم', paragraph: 'فقرة' }, { key: 'e:zzz', scores: { listening: 1 } }], [S(), S({ key: 'e:b@x.sa', name: 'بدر', email: 'b@x.sa' })], skills);
  assert.equal(st.length, 2); assert.equal(st[0].avg, 85); assert.equal(st[0].grade_ar, 'جيد جدًا'); assert.equal(st[0].rec, 'promote'); assert.equal(st[0].paragraph, 'فقرة'); assert.equal(st[1].rec, ''); assert.equal(st[1].avg, null);
  assert.equal(cleanFinalStudents([{ key: 'e:a@x.sa', rec: 'hack' }], [S()], skills)[0].rec, '');
});
test('النواقص قبل الإرسال: الملخّص · درجة ختامية · توصية لكل من له درجة · نقطة قوة', () => {
  const b = emptyFinalBody(); const st = cleanFinalStudents([], [S()], skills);
  assert.equal(missingBeforeFinalSubmit(b, st).length, 3);
  b.summary.overview = 'x'; b.strengths.strengths = [{ point: 'أ', evidence: '' }]; const st2 = cleanFinalStudents([{ key: 'e:a@x.sa', scores: { listening: 70 } }], [S()], skills); assert.deepEqual(missingBeforeFinalSubmit(b, st2).map(m => m.includes('توصية')), [true]);
  const st3 = cleanFinalStudents([{ key: 'e:a@x.sa', scores: { listening: 70 }, rec: 'continue' }], [S()], skills); assert.deepEqual(missingBeforeFinalSubmit(b, st3), []);
});
test('التوقيعان: طاقم فقط · على مُرسَل ختامي · لا توقيع مرّتين · الثاني من شخص آخر إلا مدير المنصة · الاكتمال بالاثنين', () => {
  const r = (so: any = {}) => ({ kind: 'final', status: 'submitted', body: { signoff: { quality: null, manager: null, ...so } } });
  const noura = { id: 'u2', email: 'n@x.sa', staff: true }; const admin = { id: 'u1', email: 'a@x.sa', staff: true, admin: true }; const reem = { id: 'u5', email: 'r@x.sa', staff: false };
  assert.equal(canSign(r(), noura, 'quality'), true); assert.equal(canSign(r(), reem, 'quality'), false); assert.equal(canSign({ ...r(), status: 'draft' }, noura, 'quality'), false); assert.equal(canSign({ ...r(), kind: 'weekly' }, noura, 'quality'), false);
  const q = { name: 'نورة', email: 'n@x.sa', id: 'u2', at: '2026-11-01T00:00:00Z' };
  assert.equal(canSign(r({ quality: q }), noura, 'quality'), false); assert.equal(canSign(r({ quality: q }), noura, 'manager'), false); assert.equal(canSign(r({ quality: q }), admin, 'manager'), true);
  assert.equal(canSign(r({ quality: { ...q, id: 'u1', email: 'a@x.sa' } }), admin, 'manager'), true);   // مدير المنصة يوقّع الاثنين
  assert.equal(signoffComplete({ signoff: { quality: q, manager: null } }), false); assert.equal(signoffComplete({ signoff: { quality: q, manager: q } }), true);
  assert.deepEqual(signoffView({ signoff: { quality: q, manager: null } }), { quality: { name: 'نورة', at: q.at }, manager: null });
});
test('فقرة المسار: المحلية تصف الأرقام فقط · البرومبت يمنع التقدير والتوصية · التحليل يرفض كلمات الحكم ويقبل JSON أو نصًا', () => {
  const t = buildTrajectories([S({ attendance_pct: 80 })], [W(1, 60, 50), W(2, 75, 50)], skills)[0];
  const p = localParagraph(t, skills, { avg: 82, attendance_pct: 80 }); assert.ok(p.includes('من 60%') && p.includes('إلى 75%') && p.includes('+15') && p.includes('حضر 80%') && p.includes('82%') && p.includes('سطر 2'), p); assert.ok(p.length <= PARA_MAX); assert.ok(!/ممتاز|توصي/.test(p));
  const pr = paragraphPrompt(t, skills, { avg: 82, attendance_pct: 80, scores: { listening: 90, speaking: 74 } }); assert.ok(pr.system.includes('ممنوع') && pr.system.includes('توصية')); const u = JSON.parse(pr.user); assert.equal(u.first, 60); assert.equal(u.final_scores['استماع'], 90); assert.deepEqual(u.previous_lines, ['سطر 1', 'سطر 2']);
  assert.equal(parseParagraph('{"text":"انتقل من 60% إلى 75% خلال أسبوعين وحضر 80% من الجلسات."}'), 'انتقل من 60% إلى 75% خلال أسبوعين وحضر 80% من الجلسات.'); assert.equal(parseParagraph('{"text":"طالب ممتاز يستحق الرفع للمستوى الأعلى بكل تأكيد"}'), null); assert.equal(parseParagraph('قصير'), null);
  assert.equal(parseParagraph('تقدّم المتدرّب في الاستماع من ستين إلى خمسة وسبعين بالمئة خلال أسبوعين.'), 'تقدّم المتدرّب في الاستماع من ستين إلى خمسة وسبعين بالمئة خلال أسبوعين.');
});
test('صفحة المتدرّب: مساره وحده بلا غيره · العرض العام للختامي يحمل عدد الأسابيع وسلسلة الثقة والتوقيعين · سطر القائمة', () => {
  const t = buildTrajectories([S()], [W(1, 60, 50), W(2, 75, 50)], skills)[0]; const fs: FinalStudent = { ...S({ avg: 82, scores: { listening: 90, speaking: 74 }, grade_ar: 'جيد جدًا' }), rec: 'promote', reason: 'x', paragraph: 'فقرة' };
  const pg = studentPageData(t, skills, fs); assert.deepEqual(pg.weeks, [1, 2]); assert.equal(pg.skills[0].name_ar, 'استماع'); assert.deepEqual(pg.skills[0].by_week, [60, 75]); assert.equal(pg.skills[0].final, 90); assert.equal(pg.delta, 15); assert.equal(pg.rec_ar, 'رفع للمستوى الأعلى'); assert.equal(pg.paragraph, 'فقرة'); assert.ok(!('name' in pg) && !('students' in pg));
  const q = { name: 'نورة', email: 'n@x.sa', id: 'u2', at: '2026-11-01T00:00:00Z' }; const v = publicVerifyView({ verify_code: 'RABC', status: 'approved', week_no: 2, period_from: '2026-10-01', period_to: '2026-11-01', author_name: 'ريم', approved_name: 'أحمد', approved_at: '2026-11-02', kind: 'final', computed: { program_ar: 'ع', weeks: [{ verify_code: 'R1' }, { verify_code: 'R2' }], sessions: 9, hours: 13.5, enrolled: 8 }, body: { signoff: { quality: q, manager: { ...q, name: 'أحمد' } } } } as any);
  assert.equal(v.kind_ar, 'التقرير الختامي لأداء المتدربين'); assert.equal(v.weeks, 2); assert.deepEqual(v.chain, ['R1', 'R2']); assert.equal(v.signoff.quality.name, 'نورة'); assert.equal(v.signoff.manager.name, 'أحمد'); assert.ok(!('students' in v));
  assert.ok(listLineAr({ kind: 'final', week_no: 2, period_from: '2026-10-01', period_to: '2026-11-01', computed: { program_ar: 'ع', classroom_ar: 'ش', weeks: [1, 2] }, status: 'draft' }).startsWith('التقرير الختامي لأداء المتدربين · ع · ش · 2 أسابيع معتمدة · مسودّة'));
});
test('المسارات والخزنة: /me/reports/line بلا صفحة · الفتات · organizations غير شخصية · سطر التقرير في السجلّ', () => {
  assert.ok(NO_PAGE.has('/me/reports/line') && NO_PAGE.has('/verify/report'));
  const c = crumbsFor('/me/reports/line/abc', 'ar'); assert.ok(c.some(x => x.label === 'صفحتي في التقرير الختامي'));
  assert.ok(NON_PERSONAL_TABLES.includes('organizations')); const row = REGISTRY.find(r => r.table === 'portal_report_lines'); assert.ok(row && row.label_ar.includes('التقرير الختامي'));
});
