// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P46 ر3-ب — التقرير الاستشاري («أثرُ الرأي»): الأسماء · الجسمان الفارغان · التنظيف والحدود · النواقص · فحص الاتساق · «من نقاطي إلى فقرة» (محلي · رفض الأرقام الجديدة والطول وكلمات الحكم) · ما تراه الجهة والعامة · من يعتمد (لا الكاتب) · ربط المخرج بوثيقة · «ما شهده أَثَر»
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOC_KINDS, DOC_NAMES_AR, METHOD_TOOLS, METHOD_TOOL_AR, ADV_MAX_OPTIONS, ADV_MAX_INPUTS, STU_MAX_FINDINGS, STU_MAX_RECS, BULLETS_RATIO,
  emptyAdvisoryBody, emptyStudyBody, cleanAdvisoryBody, cleanStudyBody, missingBeforeAdvisorySubmit, missingBeforeStudySubmit, studyConsistency, canDecideDoc, canDecide, isDocKind, isClientKind,
  bulletLines, localBulletsParagraph, bulletsPrompt, parseBulletsParagraph, docClientView, docPublicView, docListLineAr, listLineAr, cleanMissionBody, emptyMissionBody, type AdvisoryBody, type StudyBody, type RequestComputed,
} from '../lib/reports/registry';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';
import { witnessLines, EMPTY_WITNESS } from '../lib/directory/registry';

const RC: RequestComputed = { request_id: 'cr1', engagement_id: null, engagement_code: null, title: 'بناء نظام جودة داخلي', details: 'تشخيص وبناء دليل', goals: 'الاعتماد', timeline: 'فصل', org_ar: 'مدارس النخبة', sector: 'edu', area: 'quality', client_name: 'أحمد', client_email: 'client@x.sa', requested_at: '2026-11-02', request_status: 'in_progress', consultant_name: 'ريم الدوسري', consultant_title: 'خبيرة جودة', assigned_name: '', quote_scope: 'تشخيص', quote_deliverables: ['تقرير تشخيصي'], quote_duration: '8 أسابيع', milestones: [], at: '2026-11-04T00:00:00Z', client_sent_at: null, client_sent_to: 'client@x.sa' };
const LONG = 'نصّ طويل بما يكفي ليتجاوز الحدّ الأدنى المطلوب في فحص النواقص قبل الإرسال، ويشرح السبب بوضوح للقارئ. ';
function fullAdvisory(): AdvisoryBody {
  return cleanAdvisoryBody({
    question: { text: 'هل تُنشئ المدرسة وحدة جودة مستقلة أم تدمجها في التخطيط؟ وما الأنسب قبل الاعتماد؟', assumptions: ['الاعتماد خلال سنة'], limits: 'لا يتناول المالية' },
    inputs: { items: [{ text: 'لا توجد وحدة جودة حاليًا', source: 'مقابلة المدير' }] },
    options: { items: [{ title: 'وحدة مستقلة', desc: 'وحدة بخطّ تقرير مباشر', pros: 'استقلالية', cons: 'كلفة', conditions: 'تفرّغ مسؤول' }, { title: 'دمج في التخطيط', desc: '', pros: 'سرعة', cons: 'تضارب أولويات', conditions: '' }] },
    opinion: { chosen: 0, rationale: LONG + LONG, first_steps: [{ text: 'تعيين مسؤول جودة', horizon: 'near', owner: 'المدير' }], risks: ['مقاومة التغيير — تُدار بورش'] },
  }, emptyAdvisoryBody());
}
function fullStudy(): StudyBody {
  return cleanStudyBody({
    summary: { executive: LONG + LONG },
    problem: { statement: 'ضعف توثيق الإجراءات', objectives: ['تشخيص الوضع'], questions: ['ما نسبة الإجراءات الموثَّقة؟'] },
    method: { tools: ['interviews', 'documents', 'athar_data', 'bogus'], sample: '12 مقابلة', period: 'أكتوبر 2026', limits: '' },
    findings: { items: [{ text: 'نسبة التوثيق 30%', evidence: 'جرد 40 إجراء', source: 'وثائق' }, { text: 'غياب مؤشّرات', evidence: 'لا لوحة مؤشّرات', source: 'ملاحظة' }, { text: 'رضا المتدرّبين 72%', evidence: 'استبانة أَثَر', source: 'بيانات أَثَر' }], kpis: [{ name: 'نسبة التوثيق', value: '30', unit: '%', source: 'جرد' }] },
    analysis: { gaps: [{ target: 'توثيق 100%', current: '30%', gap: '70 نقطة', priority: 'high' }, { target: 'لوحة مؤشّرات', current: 'لا شيء', gap: 'غياب كامل', priority: 'mid' }], reading: 'الفجوة الأكبر في التوثيق.' },
    recommendations: { items: [{ text: 'إطلاق مشروع توثيق', ref: 'g:0', horizon: 'near', priority: 'high', owner: 'وحدة الجودة', cost: 'mid', indicator: 'نسبة التوثيق ≥ 80% خلال 6 أشهر' }, { text: 'بناء لوحة مؤشّرات', ref: 'f:1', horizon: 'mid', priority: 'mid', owner: 'التخطيط', cost: 'low', indicator: 'لوحة شهرية' }] },
    plan: { phases: [{ title: 'التهيئة', duration: '4 أسابيع', owner: 'الجودة', output: 'خطة' }], risks: ['انشغال الفريق'], followup: 'مراجعة ربع سنوية' },
    annexes: ['أداة الاستبانة'],
  }, emptyStudyBody());
}
const ME = { id: 'u2', email: 'staff@x.sa', staff: true, admin: false }; const ADMIN = { id: 'u1', email: 'admin@x.sa', staff: true, admin: true };

test('ر3-ب: الأنواع والأسماء', () => {
  assert.deepEqual([...DOC_KINDS], ['advisory', 'study']); assert.equal(DOC_NAMES_AR.umbrella, 'التقرير الاستشاري'); assert.equal(DOC_NAMES_AR.story, 'أثرُ الرأي'); assert.equal(DOC_NAMES_AR.bullets, 'من نقاطي إلى فقرة');
  assert.ok(isDocKind('advisory') && isDocKind('study') && !isDocKind('mission'), 'doc kinds'); assert.ok(isClientKind('mission') && isClientKind('study') && !isClientKind('weekly'), 'client kinds');
  assert.equal(METHOD_TOOLS.length, 7); assert.equal(METHOD_TOOL_AR.athar_data, 'بيانات أَثَر');
  assert.equal(AI_LIMITS.report_advisory, 30); assert.ok(AI_PURPOSE_LABEL.report_advisory.ar.includes('فقرة'), 'label');
});
test('ر3-ب: الجسمان الفارغان والتنظيف يحفظان الإقرار والإلحاقات', () => {
  const a = emptyAdvisoryBody(); assert.equal(a.opinion.chosen, null); assert.equal(a.ack, null);
  const prev = { ...emptyAdvisoryBody(), ack: { at: '2026-11-01T00:00:00Z', name: 'س', note: '', email: 'c@x' }, addenda: [{ at: 'x', by: 'y', text: 'z' }], superseded_by: { code: 'ABC', at: 't' } };
  const c = cleanAdvisoryBody({ ack: null, addenda: [], superseded_by: null, question: { text: 'س؟' } }, prev); assert.equal(c.ack?.name, 'س'); assert.equal(c.addenda.length, 1); assert.equal(c.superseded_by?.code, 'ABC'); assert.equal(c.question.text, 'س؟');
});
test('ر3-ب: تنظيف الرأي — الحدود والخيار المختار ضمن النطاق', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ title: `خ${i}`, pros: 'م', cons: 'خ' }));
  const b = cleanAdvisoryBody({ options: { items: many }, opinion: { chosen: 7, first_steps: [{ text: 'خطوة', horizon: 'bogus' }] }, inputs: { items: Array.from({ length: 12 }, () => ({ text: 'م' })) } }, emptyAdvisoryBody());
  assert.equal(b.options.items.length, ADV_MAX_OPTIONS); assert.equal(b.opinion.chosen, null, 'خارج النطاق → null'); assert.equal(b.inputs.items.length, ADV_MAX_INPUTS); assert.equal(b.opinion.first_steps[0].horizon, '');
  const ok = cleanAdvisoryBody({ options: { items: many.slice(0, 2) }, opinion: { chosen: '1' } }, emptyAdvisoryBody()); assert.equal(ok.opinion.chosen, 1);
});
test('ر3-ب: نواقص الرأي قبل الإرسال ثم اكتمالها', () => {
  const m = missingBeforeAdvisorySubmit(emptyAdvisoryBody()); assert.ok(m.length >= 5, m.join()); assert.ok(m.some(x => x.includes('خياران')), 'options');
  assert.deepEqual(missingBeforeAdvisorySubmit(fullAdvisory()), []);
  const noPros = fullAdvisory(); noPros.options.items[1].cons = ''; assert.ok(missingBeforeAdvisorySubmit(noPros).some(x => x.includes('مزايا ومخاطر')), 'pros/cons per option');
});
test('ر3-ب: تنظيف الدراسة — أدوات معروفة فقط · مرجع التوصية يجب أن يوجد · الحدود', () => {
  const s = fullStudy(); assert.deepEqual(s.method.tools, ['interviews', 'documents', 'athar_data']); assert.equal(s.findings.kpis[0].value, 30); assert.equal(s.recommendations.items[0].ref, 'g:0'); assert.equal(s.recommendations.items[1].ref, 'f:1');
  const bad = cleanStudyBody({ findings: { items: [{ text: 'ن' }] }, recommendations: { items: [{ text: 'ت', ref: 'f:5' }, { text: 'ت2', ref: 'g:0' }, { text: 'ت3', ref: 'zzz' }] } }, emptyStudyBody()); assert.deepEqual(bad.recommendations.items.map(r => r.ref), ['', '', '']);
  const big = cleanStudyBody({ findings: { items: Array.from({ length: 20 }, () => ({ text: 'ن' })) }, recommendations: { items: Array.from({ length: 20 }, () => ({ text: 'ت' })) } }, emptyStudyBody()); assert.equal(big.findings.items.length, STU_MAX_FINDINGS); assert.equal(big.recommendations.items.length, STU_MAX_RECS);
});
test('ر3-ب: فحص الاتساق — توصية بلا مرجع · نتيجة بلا شاهد · فجوة عالية بلا توصية', () => {
  assert.deepEqual(studyConsistency(fullStudy()), []);
  const s = fullStudy(); s.findings.items[0].evidence = ''; s.recommendations.items[0].ref = ''; s.recommendations.items[1].indicator = '';
  const c = studyConsistency(s); assert.ok(c.some(x => x.includes('ن1') && x.includes('شاهد')), 'evidence'); assert.ok(c.some(x => x.includes('ت1') && x.includes('غير مربوطة')), 'ref'); assert.ok(c.some(x => x.includes('ت2') && x.includes('مؤشّر')), 'indicator'); assert.ok(c.some(x => x.includes('ف1') && x.includes('عالية')), 'high gap unaddressed');
});
test('ر3-ب: نواقص الدراسة قبل الإرسال', () => {
  const m = missingBeforeStudySubmit(emptyStudyBody()); assert.ok(m.some(x => x.includes('ثلاث نتائج')), 'findings'); assert.ok(m.some(x => x.includes('توصيتان')), 'recs'); assert.ok(m.some(x => x.includes('مرحلة')), 'phase');
  assert.deepEqual(missingBeforeStudySubmit(fullStudy()), []);
});
test('ر3-ب: من نقاطي إلى فقرة — محلي · البرومبت · رفض رقم جديد وطول زائد وحكم مطلق', () => {
  const inp = '- نسبة التوثيق 30%\n- 12 مقابلة أُجريت\n• لا لوحة مؤشّرات';
  assert.deepEqual(bulletLines(inp), ['نسبة التوثيق 30%', '12 مقابلة أُجريت', 'لا لوحة مؤشّرات']);
  const loc = localBulletsParagraph(inp); assert.ok(loc.includes('؛') && loc.endsWith('.'), loc);
  const p = bulletsPrompt(inp, { kind: 'study', section: 'الملخّص', title: 'ع', org: 'ج' }); assert.ok(p.system.includes('ممنوع') && p.user.includes('bullets'), 'prompt');
  const good = JSON.stringify({ text: 'بلغت نسبة التوثيق 30% بعد 12 مقابلة أُجريت، ولا توجد لوحة مؤشّرات حتى الآن.' }); assert.ok(parseBulletsParagraph(good, inp), 'good accepted');
  assert.equal(parseBulletsParagraph(JSON.stringify({ text: 'بلغت نسبة التوثيق 35% بعد 12 مقابلة، ولا توجد لوحة مؤشّرات حتى الآن.' }), inp), null, 'new number rejected');
  assert.equal(parseBulletsParagraph(JSON.stringify({ text: 'هذا هو الخيار الأفضل بلا شكّ: نسبة التوثيق 30% بعد 12 مقابلة ولا لوحة مؤشّرات.' }), inp), null, 'absolute judgment rejected');
  assert.equal(parseBulletsParagraph(JSON.stringify({ text: ('نسبة التوثيق 30% و12 مقابلة ولا لوحة مؤشّرات. ').repeat(12) }), inp), null, `too long (> ${BULLETS_RATIO}×)`);
  assert.equal(parseBulletsParagraph('not json', inp), null);
});
test('ر3-ب: من يعتمد — الطاقم غير الكاتب، ومدير المنصة يعتمد حتى ما كتبه', () => {
  const r = { status: 'submitted', author_id: 'u2', author_email: 'staff@x.sa' };
  assert.ok(canDecide(r, ME), 'ر3: canDecide لا يستثني الكاتب'); assert.equal(canDecideDoc(r, ME), false, 'ر3-ب: الكاتب لا يعتمد'); assert.ok(canDecideDoc(r, { ...ME, id: 'u3', email: 'other@x.sa' }), 'زميل'); assert.ok(canDecideDoc({ ...r, author_id: 'u1', author_email: 'admin@x.sa' }, ADMIN), 'admin self');
  assert.equal(canDecideDoc({ ...r, status: 'draft' }, { ...ME, id: 'u3' }), false);
});
test('ر3-ب: ما تراه الجهة (بلا بريد) وما تراه العامة (أعداد فقط)', () => {
  const r = { id: 'r1', kind: 'study', verify_code: 'ABCD1234', status: 'approved', author_name: 'ريم', approved_name: 'م', approved_at: '2026-11-04T00:00:00Z', computed: RC, body: { ...fullStudy(), ack: { at: 't', name: 'منى', note: 'شكرًا', email: 'secret@x' } }, period_from: '2026-11-02', period_to: '2026-11-04', supersedes_id: null };
  const cv = docClientView(r); assert.equal(cv.computed.client_email, undefined, 'no client email'); assert.equal(cv.body.ack.email, undefined, 'no ack email'); assert.equal(cv.body.findings.items.length, 3, 'full content for client'); assert.equal(cv.can_ack, false);
  const pv = docPublicView(r); assert.equal(pv.kind_ar, 'دراسة'); assert.deepEqual(pv.counts, { findings: 3, recommendations: 2, phases: 1 }); assert.equal((pv as any).body, undefined, 'no content publicly'); assert.equal(pv.ack.name, 'منى'); assert.equal(pv.ack.note, undefined);
  const av = docPublicView({ ...r, kind: 'advisory', body: fullAdvisory() }); assert.deepEqual(av.counts, { options: 2, steps: 1 });
  assert.ok(docListLineAr({ kind: 'advisory', computed: RC, status: 'draft' }).startsWith('رأي استشاري · بناء نظام جودة داخلي · مدارس النخبة'), 'list line'); assert.ok(listLineAr({ kind: 'study', week_no: 0, period_from: '', period_to: '', computed: RC, status: 'approved' } as any).startsWith('دراسة'), 'dispatch');
});
test('ر3-ب: ربط مخرج تقرير الإنجاز بوثيقة معتمَدة (doc_code) يُحفظ ويُرفض إن كان غير صالح', () => {
  const prev = emptyMissionBody({ deliverables: ['تقرير تشخيصي'], quote_deliverables: [] } as any);
  const b = cleanMissionBody({ deliverables: [{ title: 'تقرير تشخيصي', source: 'contract', status: 'delivered', evidence: 'x', date: '', note: '', doc_code: 'ABCD1234' }, { title: 'زيادة', source: 'extra', doc_code: 'bad code' }] }, prev);
  assert.equal(b.deliverables[0].doc_code, 'ABCD1234'); assert.equal(b.deliverables[1].doc_code, '');
});
test('ر3-ب: «ما شهده أَثَر» — سطر الوثائق الاستشارية المعتمَدة', () => {
  const l1 = witnessLines({ ...EMPTY_WITNESS, docs_written: 1 } as any).find(x => x.key === 'docs_written'); assert.ok(l1 && l1.text.includes('وثيقة استشارية واحدة'), 'one');
  const l3 = witnessLines({ ...EMPTY_WITNESS, docs_written: 3 } as any).find(x => x.key === 'docs_written'); assert.ok(l3 && l3.text.includes('3 وثائق استشارية'), 'three');
  assert.equal(witnessLines(EMPTY_WITNESS as any).find(x => x.key === 'docs_written'), undefined);
});
