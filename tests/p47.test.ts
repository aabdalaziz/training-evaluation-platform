// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P47-أ — «البرنامج الذي يراجع نفسه» (مراجعة البرنامج بعد الدفعة): الفجوات · الاقتراح المحلي · تنقية اقتراح الذكاء · القرارات · النواقص · التحقّق العام · سجلّ التغيير
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P47_NAMES_AR, GAP_GRADE_AR, GAP_KEPT, GAP_NEAR, ATTEND_KEPT, REVIEW_ACTIONS, REVIEW_ACTION_AR, REVIEW_DECISIONS, REVIEW_MAX_PROPOSALS, REVIEW_CONTEXT_MIN,
  gapGrade, buildGaps, localProposals, cleanProposals, emptyReviewBody, cleanReviewBody, mergeProposals, missingBeforeReviewSubmit, reviewChanges, gapCounts, targetLabelAr, reviewListLineAr, reviewPublicView, programChangeLog, reviewPrompt, publicVerifyView, listLineAr,
  type ReviewComputed, type ReviewBody,
} from '../lib/reports/registry';

const U = (idx: number, outcome_pct: number | null, closed = true, hours = 10) => ({ idx, title_ar: `الوحدة ${idx}`, hours_planned: hours, hours_actual: hours, closed, report_code: closed && outcome_pct !== null ? `RU${idx}` : null, outcome_pct, avg: outcome_pct, decisions: { completed: 4, support: 1, repeat: outcome_pct !== null && outcome_pct < 50 ? 3 : 0, pending: 0 }, attention: 1 });
const SK = (code: string, avg: number | null, extra: any = {}) => ({ code, name_ar: 'كفاية ' + code, avg, dist: [0, 0, 0, 0, 0, 0], profiles: 0, proven_pct: null, missions: 0, cases: 0, in_units: [1], ...extra });
function C(over: Partial<ReviewComputed> = {}): ReviewComputed {
  const c: ReviewComputed = { kind: 'program_review', program_ar: 'دبلوم', program_type: 'diploma', org_ar: 'جامعة أَثَر', classroom_ar: 'شعبة 1', trainer_ar: 'نورة', cohort_no: 1, period_from: '2026-09-01', period_to: '2026-11-01', source: 'units',
    promise: { hours: 30, units: [{ idx: 1, title_ar: 'الوحدة 1', outcome_ar: 'ن1', hours: 10, skill_codes: ['a'] }, { idx: 2, title_ar: 'الوحدة 2', outcome_ar: 'ن2', hours: 20, skill_codes: ['a', 'b'] }], skills: [{ code: 'a', name_ar: 'كفاية a' }, { code: 'b', name_ar: 'كفاية b' }] },
    proven: { enrolled: 8, regular: 6, attendance_pct: 80, sessions: 12, hours: 28, weeks_approved: 4, final_code: null, profiles: 6, completion_pct: 83, units: [U(1, 85), U(2, 40, true, 20)], skills: [SK('a', 78), SK('b', 42, { in_units: [2] })], after: { stations: 0, applied: 0, letters: 0 } }, gaps: [], previous: [], computed_at: 'x', ...over };
  c.gaps = buildGaps(c.promise, c.proven); return c;
}

test('P47 · الأسماء والقوائم المغلقة', () => {
  assert.equal(P47_NAMES_AR.review, 'مراجعة البرنامج بعد الدفعة'); assert.equal(P47_NAMES_AR.story, 'البرنامج الذي يراجع نفسه'); assert.equal(P47_NAMES_AR.promise, 'وعد التصميم'); assert.equal(P47_NAMES_AR.proven, 'ما ثبت');
  assert.deepEqual(Object.values(GAP_GRADE_AR), ['وفى', 'قارب', 'أخلف']); assert.equal(REVIEW_ACTIONS.length, 8); assert.ok(REVIEW_ACTIONS.includes('keep')); assert.equal(REVIEW_ACTION_AR.add_hours, 'زِد ساعات الوحدة'); assert.deepEqual([...REVIEW_DECISIONS], ['accept', 'edit', 'reject']); assert.equal(REVIEW_MAX_PROPOSALS, 8);
  assert.equal(gapGrade(null), null); assert.equal(gapGrade(GAP_KEPT), 'kept'); assert.equal(gapGrade(GAP_NEAR), 'near'); assert.equal(gapGrade(GAP_NEAR - 1), 'missed'); assert.equal(gapGrade(ATTEND_KEPT, ATTEND_KEPT), 'kept');
});
test('P47 · buildGaps: حضور · ساعات · إتمام · وحدات مغلقة · كفايات — لا فجوة لوحدة لم تُغلق ولا لكفاية بلا أثر', () => {
  const c = C(); const t = c.gaps.map(g => g.target);
  assert.deepEqual(t, ['program:attendance', 'program:hours', 'program:completion', 'unit:1', 'unit:2', 'skill:a', 'skill:b']);
  const by = Object.fromEntries(c.gaps.map(g => [g.target, g.grade])); assert.equal(by['program:attendance'], 'kept'); assert.equal(by['program:hours'], 'kept'); assert.equal(by['unit:1'], 'kept'); assert.equal(by['unit:2'], 'missed'); assert.equal(by['skill:a'], 'kept'); assert.equal(by['skill:b'], 'missed');
  assert.deepEqual(gapCounts(c.gaps), { kept: 5, near: 0, missed: 2 });
  const c2 = C({ proven: { ...C().proven, units: [U(1, null, false), U(2, null, true)], skills: [SK('a', null), SK('b', null, { profiles: 5, proven_pct: 60 })], hours: 10, attendance_pct: null, sessions: 0, completion_pct: null } });
  const t2 = c2.gaps.map(g => g.target); assert.ok(!t2.includes('unit:1')); assert.ok(t2.includes('unit:2')); assert.equal(c2.gaps.find(g => g.target === 'unit:2')!.grade, 'near'); assert.ok(!t2.includes('skill:a')); assert.equal(c2.gaps.find(g => g.target === 'skill:b')!.grade, 'near'); assert.equal(c2.gaps.find(g => g.target === 'program:hours')!.grade, 'missed'); assert.ok(!t2.includes('program:attendance'));
  assert.equal(targetLabelAr('unit:2', c), 'الوحدة 2 — الوحدة 2'); assert.equal(targetLabelAr('skill:b', c), 'الكفاية «كفاية b»'); assert.equal(targetLabelAr('program:attendance', c), 'البرنامج — الحضور');
});
test('P47 · localProposals: أخلفت وحدة كبيرة ← تقسيم · صغيرة ← ساعات · كفاية أخلفت ← دليل، وفي الدفعة الثانية إزالة/نقل · لا فجوة ← أبقِ', () => {
  const p = localProposals(C()); const key = p.map(x => `${x.target}|${x.action}`);
  assert.ok(key.includes('unit:2|split_unit')); assert.ok(key.includes('skill:b|add_evidence')); assert.ok(!key.some(k => k.endsWith('|keep'))); assert.ok(p.every(x => x.source === 'local' && x.why_ar.length <= 160 && /^p\d+$/.test(x.id)));
  const small = C({ proven: { ...C().proven, units: [U(1, 30, true, 8), U(2, 90, true, 20)] } }); assert.ok(localProposals(small).some(x => x.target === 'unit:1' && x.action === 'add_hours' && x.value.startsWith('+3')));
  const second = C({ cohort_no: 2, previous: [{ code: 'R1', period_to: '2026-06-01', kept: 3, near: 1, missed: 2, accepted: 2 }] }); const p2 = localProposals(second); assert.ok(p2.some(x => x.target === 'skill:b' && (x.action === 'drop_skill' || x.action === 'move_skill')));
  const fine = C({ proven: { ...C().proven, units: [U(1, 90), U(2, 85, true, 20)], skills: [SK('a', 88), SK('b', 80)] } }); const p3 = localProposals(fine); assert.equal(p3.length, 1); assert.equal(p3[0].action, 'keep'); assert.equal(p3[0].target, 'program:all');
  const low = C({ proven: { ...C().proven, attendance_pct: 55 } }); assert.ok(localProposals(low).some(x => x.action === 'add_support'));
});
test('P47 · cleanProposals: فعل من القائمة · هدف من الفجوات · لا حكم · لا رقم غريب · لا تكرار · ≤ 8', () => {
  const c = C(); const r = cleanProposals({ proposals: [
    { target: 'unit:2', action: 'split_unit', value: 'وحدتان', why_ar: 'بلغه 40% فقط من 20 ساعة' },
    { target: 'unit:2', action: 'split_unit', value: 'مكرر', why_ar: 'بلغه 40% فقط' },
    { target: 'unit:9', action: 'add_hours', value: '', why_ar: 'هدف غير موجود في الفجوات' },
    { target: 'skill:b', action: 'delete_program', value: '', why_ar: 'فعل غير مسموح به هنا' },
    { target: 'skill:b', action: 'add_evidence', value: '', why_ar: 'نتائج ضعيف جدًا في هذه الكفاية' },
    { target: 'skill:b', action: 'add_evidence', value: '3 مهمات', why_ar: 'رقم غريب 77% لم يرد' },
    { target: 'program:attendance', action: 'add_support', value: '', why_ar: 'حضور 80% مع 12 جلسة' },
  ] }, c, 'ai');
  assert.equal(r.proposals.length, 2); assert.equal(r.rejected, 5); assert.deepEqual(r.proposals.map(p => p.action), ['split_unit', 'add_support']); assert.ok(r.proposals.every(p => p.source === 'ai'));
  const many = cleanProposals(Array.from({ length: 12 }, (_, i) => ({ target: i % 2 ? 'unit:2' : 'skill:b', action: REVIEW_ACTIONS[i % 8], why_ar: 'سبب كافٍ بلا أرقام' })), c, 'ai'); assert.ok(many.proposals.length <= REVIEW_MAX_PROPOSALS);
});
test('P47 · cleanReviewBody + mergeProposals: قرارات محاذية للاقتراحات · تبقى عند التجديد بنفس الهدف والفعل', () => {
  const c = C(); const props = localProposals(c); const b0 = mergeProposals(emptyReviewBody(), props, 'local'); assert.equal(b0.decisions.length, props.length); assert.equal(b0.proposals_source, 'local');
  const b1 = cleanReviewBody({ ...b0, decisions: [{ proposal_id: props[0].id, decision: 'edit', text_ar: 'نقسمها إلى وحدتين من 10 ساعات', reason_ar: '' }, { proposal_id: 'zzz', decision: 'accept' }], context_ar: '  سياق   الدفعة  ', admin: 'x' }, b0);
  assert.equal(b1.decisions.find(d => d.proposal_id === props[0].id)!.decision, 'edit'); assert.ok(!b1.decisions.some(d => d.proposal_id === 'zzz')); assert.equal(b1.context_ar, 'سياق الدفعة');
  const renewed = mergeProposals(b1, [{ ...props[0], id: 'p9' }, { id: 'p10', target: 'program:all', action: 'keep', value: '', why_ar: 'x', source: 'ai' }], 'ai'); assert.equal(renewed.decisions.find(d => d.proposal_id === 'p9')!.decision, 'edit'); assert.equal(renewed.decisions.find(d => d.proposal_id === 'p10')!.decision, ''); assert.equal(renewed.proposals_source, 'ai');
  const bad = cleanReviewBody({ proposals: [{ id: 'p1', target: 'unit:1', action: 'nope' }], decisions: [{ proposal_id: 'p1', decision: 'maybe' }] }); assert.equal(bad.proposals[0].action, 'keep'); assert.equal(bad.decisions[0].decision, '');
});
test('P47 · missingBeforeReviewSubmit: اقتراحات · قرار لكل اقتراح · صيغة التعديل · سبب الرفض · السياق', () => {
  const c = C(); const b = mergeProposals(emptyReviewBody(), localProposals(c), 'local'); const m0 = missingBeforeReviewSubmit(emptyReviewBody()); assert.ok(m0.some(x => x.includes(P47_NAMES_AR.proposals))); assert.ok(m0.some(x => x.includes(P47_NAMES_AR.context)));
  assert.ok(missingBeforeReviewSubmit(b).some(x => x.includes('قرار على كل اقتراح')));
  const b2: ReviewBody = { ...b, decisions: b.decisions.map((d, i) => ({ ...d, decision: i === 0 ? 'edit' : 'reject', text_ar: '', reason_ar: '' })), context_ar: 'س'.repeat(REVIEW_CONTEXT_MIN) }; const m2 = missingBeforeReviewSubmit(b2); assert.ok(m2.some(x => x.includes('صيغتك'))); assert.ok(m2.some(x => x.includes('سبب الرفض'))); assert.ok(!m2.some(x => x.includes(P47_NAMES_AR.context)));
  const b3: ReviewBody = { ...b2, decisions: b2.decisions.map(d => ({ ...d, text_ar: 'صيغة كافية', reason_ar: 'سبب' })) }; assert.deepEqual(missingBeforeReviewSubmit(b3), []);
});
test('P47 · reviewChanges + reviewPublicView + programChangeLog: المقبول والمعدَّل فقط · بلا أسماء · العدّ', () => {
  const c = C(); const props = localProposals(c); const b: ReviewBody = { ...mergeProposals(emptyReviewBody(), props, 'local'), context_ar: 'سياق كافٍ للدفعة الأولى', decisions: props.map((p, i) => ({ proposal_id: p.id, decision: i === 0 ? 'accept' : i === 1 ? 'edit' : 'reject', text_ar: 'صيغتي', reason_ar: 'لا' })) };
  const ch = reviewChanges(b, c); assert.equal(ch.length, Math.min(2, props.length)); assert.equal(ch[0].decision, 'accept'); assert.ok(ch[0].text_ar.includes(REVIEW_ACTION_AR[props[0].action])); if (ch[1]) assert.equal(ch[1].text_ar, 'صيغتي');
  const r = { verify_code: 'RREV1', status: 'approved', author_name: 'نورة', approved_name: 'أحمد', approved_at: '2026-11-04T00:00:00Z', computed: c, body: b, kind: 'program_review', week_no: 1, period_from: c.period_from, period_to: c.period_to };
  const v = reviewPublicView(r); assert.equal(v.kind, 'program_review'); assert.equal(v.kind_ar, P47_NAMES_AR.review); assert.equal(v.kept, 5); assert.equal(v.missed, 2); assert.equal(v.changes.length, ch.length); assert.equal(v.rejected, props.length - ch.length); assert.ok(!JSON.stringify(v).includes('admin')); assert.equal(reviewPublicView({ ...r, status: 'draft' }), null);
  assert.equal(publicVerifyView(r as any).kind, 'program_review'); assert.ok(listLineAr(r as any).startsWith(P47_NAMES_AR.review)); assert.ok(reviewListLineAr(r).includes('الدفعة 1') && reviewListLineAr(r).includes('معتمَدة'));
  const log = programChangeLog([r, { ...r, verify_code: 'RREV0', approved_at: '2026-06-01T00:00:00Z', computed: { ...c, cohort_no: 0 } }, { ...r, verify_code: null }]); assert.equal(log.n, 2); assert.equal(log.last!.code, 'RREV1'); assert.equal(log.changes_total, ch.length * 2); assert.equal(programChangeLog([]).last, null);
});
test('P47 · reviewPrompt: JSON فقط · القائمة المغلقة · لا أسماء في المدخلات', () => {
  const c = C(); const p = reviewPrompt(c); assert.ok(p.system.includes('JSON') && p.system.includes('keep') && p.system.includes('split_unit')); const u = JSON.parse(p.user); assert.equal(u.gaps.length, c.gaps.length); assert.ok(!p.user.includes('نورة')); assert.ok(!('trainer_ar' in u));
});
