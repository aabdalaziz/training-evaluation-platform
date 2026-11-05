// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م6 «عُبور» — جدول المواصفات · مخطّطات النظام · الحكم المركّب (60/20/20 · حدّ 60 · لا مهارة دون 50 · اجتياز مشروط) · التقدير · خطّ العبور · السلّة الضيّقة · النافذة · الطريق */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXIT_SPEC, EXIT_LEVELS, SPEC_VERSION, exitBlueprintRow, skillRetakeBlueprintRow, specTable, exitVerdict, gradeOf, exitBlock, ratingPercent, growthLine, poolCheck, windowState, nextLevel, levelFromRoom, boardSummary, exitReuseKey, isExitCode, EXIT_TITLE, ANCHOR_ITEMS } from '../lib/miaar/exit';
import { planFromBlueprint } from '../lib/miaar/blueprint';
import { crumbsFor } from '../lib/portal/way';

test('م6: جدول المواصفات — خمسة مستويات بأعدادها وأزمنتها كما في الاقتراح المعتمد', () => {
  assert.deepEqual([...EXIT_LEVELS], ['A1', 'A2', 'B1', 'B2', 'C1']); assert.equal(SPEC_VERSION, 'exit-2026.11');
  assert.deepEqual([EXIT_SPEC.A1.listening, EXIT_SPEC.A1.reading, EXIT_SPEC.A1.grammar_vocab, EXIT_SPEC.A1.writing, EXIT_SPEC.A1.speaking, EXIT_SPEC.A1.minutes], [10, 10, 15, 1, 1, 60]);
  assert.deepEqual([EXIT_SPEC.B1.listening, EXIT_SPEC.B1.reading, EXIT_SPEC.B1.grammar_vocab, EXIT_SPEC.B1.writing, EXIT_SPEC.B1.speaking, EXIT_SPEC.B1.minutes], [12, 12, 16, 2, 2, 80]);
  assert.deepEqual([EXIT_SPEC.C1.listening, EXIT_SPEC.C1.reading, EXIT_SPEC.C1.grammar_vocab, EXIT_SPEC.C1.minutes], [14, 14, 12, 100]);
  const t = specTable('B2'); assert.equal(t.total, 40); assert.equal(t.rows.length, 5); assert.equal(Math.round(t.rows.reduce((a, r) => a + r.weight, 0)), 100); assert.equal(t.cut, 60); assert.equal(t.skillMin, 50);
  assert.equal(EXIT_TITLE.ar, 'اختبار نهاية المستوى — معياري (CEFR)');
});

test('م6: مخطّطات النظام SYS-EXIT-* تمرّ من planFromBlueprint بلا أخطاء — مستوى واحد · مُعلَن · عشوائي · الحدّ 60', () => {
  for (const l of EXIT_LEVELS) {
    const row = exitBlueprintRow(l); assert.equal(row.code, `SYS-EXIT-${l}`); assert.equal(row.purpose, 'exit'); assert.equal(row.test_type, 'level'); assert.ok(isExitCode(row.code));
    const { plan, errors } = planFromBlueprint(row as any); assert.deepEqual(errors, [], `${l}: ${errors.join(' · ')}`);
    assert.deepEqual(plan.levels, [l]); assert.equal(plan.ladder, 'single'); assert.equal(plan.productiveMode, 'declared'); assert.equal(plan.cut, 60); assert.equal(plan.durationSeconds, EXIT_SPEC[l].minutes * 60);
    assert.equal(plan.counts[l].listening + plan.counts[l].reading + plan.counts[l].grammar_vocab, EXIT_SPEC[l].listening + EXIT_SPEC[l].reading + EXIT_SPEC[l].grammar_vocab);
    assert.equal(plan.productive[l].writing, EXIT_SPEC[l].writing); assert.equal(plan.productive[l].speaking, EXIT_SPEC[l].speaking);
  }
  assert.ok(!isExitCode('SYS-LEVEL-B1') && !isExitCode('SYS-PLACEMENT'));
});

test('م6: مخطّط إعادة المهارة — استقبالية بالعدد نفسه · إنتاجية ببنود تهيئة لا تدخل في الحكم', () => {
  const r = skillRetakeBlueprintRow('B1', 'reading'); const p = planFromBlueprint(r as any); assert.deepEqual(p.errors, []); assert.equal(p.plan.counts.B1.reading, 12); assert.equal(p.plan.counts.B1.listening, 0); assert.equal(p.plan.productive.B1.writing, 0); assert.ok(isExitCode(r.code));
  const w = skillRetakeBlueprintRow('A2', 'writing'); const pw = planFromBlueprint(w as any); assert.deepEqual(pw.errors, []); assert.equal(pw.plan.productive.A2.writing, 1); assert.equal(pw.plan.productive.A2.speaking, 0); assert.equal(pw.plan.counts.A2.grammar_vocab, ANCHOR_ITEMS); assert.equal(w.code, 'EXIT-RT-A2-WRITING');
});

test('م6: الحكم المركّب — 60/20/20 · اجتياز · مشروط (مهارة واحدة دون 50) · رسوب (كلّي < 60 أو مهارتان) · معلّق', () => {
  const ok = exitVerdict({ listening: 80, reading: 70, grammar_vocab: 90, writing: 60, speaking: 70 });
  assert.equal(ok.receptive, 80); assert.equal(ok.total, Math.round(80 * 0.6 + 60 * 0.2 + 70 * 0.2)); assert.equal(ok.total, 74); assert.equal(ok.outcome, 'passed'); assert.equal(ok.grade, 'good'); assert.deepEqual(ok.weights, { receptive: 60, writing: 20, speaking: 20 });
  const cond = exitVerdict({ listening: 80, reading: 75, grammar_vocab: 85, writing: 40, speaking: 70 });
  assert.equal(cond.outcome, 'conditional'); assert.equal(cond.retake_skill, 'writing'); assert.deepEqual(cond.below, ['writing']); assert.ok((cond.total || 0) >= 60);
  const two = exitVerdict({ listening: 80, reading: 75, grammar_vocab: 85, writing: 40, speaking: 45 }); assert.equal(two.outcome, 'failed'); assert.equal(two.grade, 'fail');
  const low = exitVerdict({ listening: 55, reading: 55, grammar_vocab: 55, writing: 55, speaking: 55 }); assert.equal(low.total, 55); assert.equal(low.outcome, 'failed');
  const pend = exitVerdict({ listening: 80, reading: 75, grammar_vocab: 85, writing: 'pending', speaking: 70 }); assert.equal(pend.status, 'pending'); assert.equal(pend.total, null); assert.deepEqual(pend.pending, ['writing']); assert.equal(pend.receptive, 80);
  const skipped = exitVerdict({ listening: 90, reading: 90, grammar_vocab: 90, writing: 'skipped', speaking: 90 }); assert.equal(skipped.skills.writing.percent, 0); assert.equal(skipped.outcome, 'conditional', 'لم تُقدَّم = صفر → مهارة واحدة دون الحدّ');
  const noProd = exitVerdict({ listening: 70, reading: 70, grammar_vocab: 70, writing: null, speaking: null }); assert.deepEqual(noProd.weights, { receptive: 100, writing: 0, speaking: 0 }); assert.equal(noProd.total, 70);
  const edge = exitVerdict({ listening: 60, reading: 60, grammar_vocab: 60, writing: 60, speaking: 60 }); assert.equal(edge.outcome, 'passed'); assert.equal(edge.grade, 'pass');
  const edge2 = exitVerdict({ listening: 50, reading: 70, grammar_vocab: 70, writing: 60, speaking: 60 }); assert.equal(edge2.skills.listening.state, 'ok', '50 بالضبط ليست دون الحدّ');
});

test('م6: التقدير — ممتاز ≥85 · جيد جدًا 75 · جيد 65 · اجتياز 60 · لم يجتز', () => {
  assert.equal(gradeOf(85, true), 'excellent'); assert.equal(gradeOf(84, true), 'very_good'); assert.equal(gradeOf(75, true), 'very_good'); assert.equal(gradeOf(74, true), 'good'); assert.equal(gradeOf(65, true), 'good'); assert.equal(gradeOf(64, true), 'pass'); assert.equal(gradeOf(90, false), 'fail');
});

test('م6: نسبة التصحيح البشري من المتوسط 0–5 أو الأبعاد', () => {
  assert.equal(ratingPercent({ mean: 4 }), 80); assert.equal(ratingPercent({ scores: { range: 3, accuracy: 4, coherence: 3, task: 4 } }), 70); assert.equal(ratingPercent(null), null); assert.equal(ratingPercent({ mean: 7 }), 100);
});

test('م6: كتلة التقرير — معلّقة قبل الإصدار ثم نهائية بعده · لا كتابة مطلوبة = لا انتظار', () => {
  const report = { احصائيات: { listening: { percent: 80, answered: 10 }, reading: { percent: 70, answered: 10 }, grammar_vocab: { percent: 90, answered: 15 } } };
  const b1 = exitBlock({ level: 'A1', report, perfs: [], wantWriting: 1, wantSpeaking: 1 }); assert.equal(b1.الحالة, 'pending'); assert.equal(b1.الاستقبالي, 80); assert.equal(b1.المستوى, 'A1'); assert.equal(b1.الاسم_الرسمي, EXIT_TITLE.ar);
  const b2 = exitBlock({ level: 'A1', report, perfs: [{ skill: 'writing', status: 'submitted' }, { skill: 'speaking', status: 'released', human_rating: { mean: 3.5 } }], wantWriting: 1, wantSpeaking: 1 }); assert.equal(b2.الحالة, 'pending'); assert.deepEqual(b2.قيد_التصحيح, ['writing']);
  const b3 = exitBlock({ level: 'A1', report, perfs: [{ skill: 'writing', status: 'released', human_rating: { mean: 4 } }, { skill: 'speaking', status: 'released', human_rating: { mean: 3.5 } }], wantWriting: 1, wantSpeaking: 1 });
  assert.equal(b3.الحالة, 'final'); assert.equal(b3.الكلي, Math.round(80 * 0.6 + 80 * 0.2 + 70 * 0.2)); assert.equal(b3.النتيجة, 'passed'); assert.equal(b3.تقدير_ar, 'جيد جدًا');
  const b4 = exitBlock({ level: 'A1', report, perfs: [], wantWriting: 0, wantSpeaking: 0 }); assert.equal(b4.الحالة, 'final'); assert.equal(b4.الكلي, 80);
  const miss = exitBlock({ level: 'A1', report: { احصائيات: { reading: { percent: 70, answered: 10 }, grammar_vocab: { percent: 90, answered: 15 } } }, perfs: [], wantWriting: 0, wantSpeaking: 0 }); assert.equal(miss.المهارات.listening.النسبة, 0, 'محور مطلوب بلا إجابات = صفر لا «غير مطلوب»');
});

test('م6: خطّ العبور — من تقرير تسكين سابق فقط · لا من نهاية مستوى سابقة', () => {
  const g = growthLine({ report: { المستوى_العام: 'A1', النسبة_العامة: 62.4, ملخص_التسكين: { مستوى_الالتحاق_المقترح: 'A2' } }, created_at: '2026-09-01T10:00:00Z' }, 'A2', 78);
  assert.ok(g); assert.equal(g!.from_level, 'A2'); assert.equal(g!.from_percent, 62.4); assert.equal(g!.to_level, 'A2'); assert.equal(g!.to_percent, 78); assert.match(g!.text_ar, /دخلتَ بمستوى A2/); assert.match(g!.text_en, /entered at A2/);
  assert.equal(growthLine({ report: { exit: {}, المستوى_العام: 'A1' } }, 'A2', 70), null); assert.equal(growthLine(null, 'A2', 70), null);
});

test('م6: السلّة الضيّقة — دون 1.5× المطلوب تحذير · النافذة · المستوى التالي · مستوى القاعة · مفتاح الإعادة', () => {
  const ok = poolCheck('A1', { 'A1:listening': 15, 'A1:reading': 15, 'A1:grammar_vocab': 23, 'A1:writing': 6, 'A1:speaking': 6 }); assert.ok(ok.ok); assert.equal(ok.cells.length, 5);
  const bad = poolCheck('A1', { 'A1:listening': 12, 'A1:reading': 15, 'A1:grammar_vocab': 23, 'A1:writing': 1, 'A1:speaking': 6 }); assert.ok(!bad.ok); assert.deepEqual(bad.narrow.map((c) => c.skill), ['listening', 'writing']);
  const now = Date.parse('2026-11-05T10:00:00Z'); assert.equal(windowState('2026-11-05T12:00:00Z', null, now), 'before'); assert.equal(windowState('2026-11-05T09:00:00Z', '2026-11-05T11:00:00Z', now), 'open'); assert.equal(windowState(null, '2026-11-05T09:00:00Z', now), 'after'); assert.equal(windowState(null, null, now), 'open');
  assert.equal(nextLevel('A1'), 'A2'); assert.equal(nextLevel('C1'), 'C2');
  assert.equal(levelFromRoom('A2'), 'A2'); assert.equal(levelFromRoom('', 'مبتدئ'), 'A1'); assert.equal(levelFromRoom('', 'متوسط'), 'B1'); assert.equal(levelFromRoom('', 'متقدم'), 'C1'); assert.equal(levelFromRoom('X9', 'غير معروف'), null); assert.equal(levelFromRoom('C2'), null, 'C2 لا اختبار نهاية له');
  assert.equal(exitReuseKey('c1', 'A1'), 'exit:c1:A1');
});

test('م6: ملخّص اللوحة — عدّادات الاجتياز والمعلّق ومتوسط النموّ (≥5 فقط)', () => {
  const row = (o: any, t: number | null, g?: any) => ({ email: 'a@b.c', name: '', status: 'finished' as const, started_at: null, finished_at: null, answered: 0, total: 0, idle_min: null, report_code: null, exit: o ? { الحالة: t === null ? 'pending' : 'final', النتيجة: o, الكلي: t, ...(g ? { خط_العبور: g } : {}) } as any : null });
  const s = boardSummary([row('passed', 80), row('passed', 70), row('conditional', 62), row('failed', 40), row('pending', null), { ...row(null, null), status: 'started' }]);
  assert.equal(s.invited, 6); assert.equal(s.finished, 5); assert.equal(s.pending, 1); assert.equal(s.passed, 2); assert.equal(s.conditional, 1); assert.equal(s.failed, 1); assert.equal(s.avg, 63); assert.equal(s.growth_avg, null);
  const g = { from_percent: 50, to_percent: 70 }; const s2 = boardSummary(Array.from({ length: 5 }, () => row('passed', 70, g))); assert.equal(s2.growth_avg, 20); assert.equal(s2.growth_n, 5);
});

test('م6: الطريق — /admin/miaar/exit و/miaar/certificate مسمّيان', () => {
  const c = crumbsFor('/admin/miaar/exit', 'ar'); assert.equal(c[c.length - 1].label, 'نهاية المستوى');
  const k = crumbsFor('/miaar/certificate/ML-AAAA-BBBB', 'ar'); assert.ok(k.some((x) => x.label === 'شهادة اجتياز المستوى'), JSON.stringify(k));
});
