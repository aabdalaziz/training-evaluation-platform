// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P46 ر3 — تقرير إنجاز المهمة («أثرُ المهمة»): الأسماء · الانحراف الزمني · الجسم من العقد · التنظيف · الإحصاء · النواقص · الصياغة المحلية ورفض كلمات الحكم · ما تراه الجهة · التحقّق العام · سطر الدليل
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P46_NAMES_AR, MISSION_NAMES_AR, DELIV, DELIV_AR, HORIZON, PRIORITY, DEVIATION_DAYS, MAX_EXTRA, MAX_FINDINGS, MAX_RECS, MISSION_SUMMARY_MAX, ACK_NOTE_MAX, ADDENDUM_MAX, MAX_ADDENDA,
  milestoneDeviations, lateMilestones, emptyMissionBody, cleanMissionBody, missionStats, missingBeforeMissionSubmit, canAck, localMissionPhrases, parseMissionPhrases, missionPhrasePrompt,
  missionClientView, missionPublicView, ackToken, missionListLineAr, listLineAr, type MissionComputed, type MissionBody,
} from '../lib/reports/registry';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';
import { witnessLines, EMPTY_WITNESS } from '../lib/directory/registry';

const MS = [
  { id: 'm1', position: 1, title: 'التشخيص', due_date: '2026-10-10', status: 'done', done_at: '2026-10-09T10:00:00Z' },
  { id: 'm2', position: 2, title: 'التصميم', due_date: '2026-10-20', status: 'done', done_at: '2026-10-28T10:00:00Z' },
  { id: 'm3', position: 3, title: 'التسليم', due_date: '2026-11-10', status: 'in_progress', done_at: null },
];
function computed(over: Partial<MissionComputed> = {}): MissionComputed {
  return {
    engagement_id: 'e1', kind: 'consult', kind_ar: 'استشارة', title_ar: 'تطوير نظام الجودة', scope_ar: 'تشخيص وتصميم', deliverables: ['تقرير تشخيصي', 'دليل الإجراءات'], start_at: '2026-10-01', end_at: '2026-11-15', mode: 'hybrid', member_signed_at: '2026-09-28T09:00:00Z', athar_signed_at: '2026-09-28T09:00:00Z', engagement_code: 'ATH-CO-0001', engagement_status: 'active',
    expert_name: 'ريم', expert_title: 'مستشارة جودة', org_ar: 'جامعة الشمال', sector: 'التعليم', area: 'الجودة', request_id: 'r1', request_title: 'طلب نظام جودة', request_goals: 'اعتماد مؤسسي', request_timeline: 'شهران', client_name: 'خالد', client_email: 'khaled@north.edu.sa',
    quote_scope: 'ورشتان', quote_deliverables: ['دليل الإجراءات', 'ورشة تدريبية'], quote_duration: '6 أسابيع',
    milestones: milestoneDeviations(MS, '2026-11-04'), milestones_done: 2, milestones_on_time: 1, milestones_late: 1, updates: 3, updates_from: '2026-10-05', updates_to: '2026-10-30', my_updates: ['بدأنا التشخيص', 'سلّمنا المسودّة', 'ورشة أولى'],
    duration_days: 45, sessions: 0, hours: 0, attendance_pct: null, at: '2026-11-04T08:00:00Z', ...over,
  };
}
function filled(c: MissionComputed): MissionBody {
  const b = emptyMissionBody(c);
  b.summary.executive = 'نُفِّذت المهمة لصالح جامعة الشمال على مدى خمسة وأربعين يومًا وشملت ثلاثة مخرجات متّفقًا عليها سُلِّمت جميعها.';
  b.deliverables = b.deliverables.map(d => ({ ...d, status: 'delivered', evidence: 'ملف مُرسل بالبريد', date: '2026-11-01' }));
  b.results.findings = [{ text: 'وُثِّقت 42 إجراءً', evidence: 'الدليل v2' }]; b.results.kpis = [{ name: 'نسبة الإجراءات الموثَّقة', before: 40, after: 90, unit: '%' }];
  b.recommendations.items = [{ text: 'تشكيل لجنة متابعة', horizon: 'near', priority: 'high', owner: 'وحدة الجودة', impact: 'استدامة' }];
  b.timeline.reasons = { m2: 'تأخّر وصول بيانات الجهة' }; b.handover.items = ['الدليل', 'العرض']; b.handover.open = ['اعتماد المجلس'];
  return b;
}

test('ر3 — الأسماء والثوابت', () => {
  assert.equal(P46_NAMES_AR.mission, 'تقرير إنجاز المهمة'); assert.equal(MISSION_NAMES_AR.story, 'أثرُ المهمة'); assert.equal(MISSION_NAMES_AR.matrix, 'الوعد مقابل الواقع'); assert.equal(MISSION_NAMES_AR.timeline, 'خطّ المهمة');
  assert.equal(MISSION_NAMES_AR.ack_btn, 'أقرّ بالاستلام'); assert.deepEqual([...DELIV], ['delivered', 'partial', 'changed', 'not']); assert.equal(DELIV_AR.changed, 'تغيّر بالاتفاق');
  assert.equal(HORIZON.length, 3); assert.equal(PRIORITY.length, 3); assert.equal(DEVIATION_DAYS, 3); assert.equal(MAX_EXTRA, 3); assert.equal(MISSION_SUMMARY_MAX, 900); assert.equal(ACK_NOTE_MAX, 300); assert.equal(ADDENDUM_MAX, 600); assert.equal(MAX_ADDENDA, 5);
  assert.equal(AI_LIMITS.report_mission, 40); assert.ok(AI_PURPOSE_LABEL.report_mission.ar.includes('إنجاز المهمة'), 'label');
});

test('ر3 — الانحراف الزمني للمراحل: مبكّر · متأخّر · جارٍ بعد موعده', () => {
  const ms = milestoneDeviations(MS, '2026-11-04');
  assert.equal(ms[0].deviation_days, -1); assert.equal(ms[1].deviation_days, 8); assert.equal(ms[2].deviation_days, null, 'لم يحلّ موعدها');
  const ms2 = milestoneDeviations(MS, '2026-11-20'); assert.equal(ms2[2].deviation_days, 10, 'جارية بعد موعدها تُحسب حتى اليوم');
  assert.deepEqual(lateMilestones(ms).map(m => m.id), ['m2']);
});

test('ر3 — الجسم من العقد: مخرجات العقد ثم العرض بلا تكرار، ولا تُحذف عند التنظيف', () => {
  const c = computed(); const b = emptyMissionBody(c);
  assert.deepEqual(b.deliverables.map(d => `${d.source}:${d.title}`), ['contract:تقرير تشخيصي', 'contract:دليل الإجراءات', 'quote:ورشة تدريبية']);
  const hacked = { ...b, deliverables: [{ title: 'شيء آخر', source: 'contract', status: 'delivered' }], ack: { name: 'x' }, addenda: [{ text: 'y' }], handover: { admin_note: 'سرّي' } };
  const cl = cleanMissionBody(hacked, b);
  assert.equal(cl.deliverables.filter(d => d.source !== 'extra').length, 3, 'مخرجات العقد باقية'); assert.equal(cl.ack, null, 'الإقرار لا يأتي من المتصفح'); assert.deepEqual(cl.addenda, []); assert.equal(cl.handover.admin_note, 'سرّي');
  const extra = { ...b, deliverables: [...b.deliverables, ...Array.from({ length: 5 }, (_, i) => ({ title: `زيادة ${i}`, source: 'extra', status: 'delivered' }))] };
  assert.equal(cleanMissionBody(extra, b).deliverables.filter(d => d.source === 'extra').length, MAX_EXTRA);
  const bad = { ...b, results: { kpis: [{ name: 'k', before: 'abc', after: '12.345', unit: '%' }], findings: Array.from({ length: 9 }, () => ({ text: 'n' })) }, recommendations: { items: Array.from({ length: 12 }, () => ({ text: 't', horizon: 'zzz', priority: 'high' })) } };
  const cb = cleanMissionBody(bad, b); assert.equal(cb.results.kpis[0].before, null); assert.equal(cb.results.kpis[0].after, 12.35); assert.equal(cb.results.findings.length, MAX_FINDINGS); assert.equal(cb.recommendations.items.length, MAX_RECS); assert.equal(cb.recommendations.items[0].horizon, '');
});

test('ر3 — الإحصاء: سُلِّم x من y بلا الزيادة · فرق المؤشّرات', () => {
  const c = computed(); const b = filled(c); b.deliverables.push({ title: 'زيادة', source: 'extra', status: 'delivered', evidence: '', date: '', note: '' }); b.deliverables[1].status = 'partial';
  const s = missionStats(b, c); assert.equal(s.total, 3); assert.equal(s.delivered, 2); assert.equal(s.partial, 1); assert.equal(s.extra, 1); assert.equal(s.pct, 67); assert.equal(s.late, 1); assert.equal(s.on_time, 1);
  assert.equal(s.kpi_deltas[0].delta, 50); assert.equal(s.kpi_deltas[0].pct, 125);
});

test('ر3 — النواقص قبل الإرسال', () => {
  const c = computed(); const e = emptyMissionBody(c); const m = missingBeforeMissionSubmit(e, c);
  assert.ok(m.some(x => x.includes('ملخّص')), 'ملخّص'); assert.ok(m.some(x => x.includes('حالة لكل مخرج')), 'حالة'); assert.ok(m.some(x => x.includes('نتيجة')), 'نتيجة'); assert.ok(m.some(x => x.includes('توصية')), 'توصية'); assert.ok(m.some(x => x.includes('سبب الانحراف')), 'سبب');
  assert.deepEqual(missingBeforeMissionSubmit(filled(c), c), []);
  const f = filled(c); f.deliverables[0].status = 'not'; f.deliverables[0].note = ''; assert.ok(missingBeforeMissionSubmit(f, c).some(x => x.includes('لم يُسلَّم')), 'ملاحظة');
  const g = filled(c); g.deliverables[0].evidence = ''; assert.ok(missingBeforeMissionSubmit(g, c).some(x => x.includes('شاهد')), 'شاهد');
});

test('ر3 — الصياغة المحلية وصف لا حكم · رفض كلمات الحكم من النموذج · لا أجر في الموجّه', () => {
  const c = computed(); const b = filled(c); const ph = localMissionPhrases(c, b);
  assert.ok(ph.length >= 3 && ph.length <= 5, 'عدد'); assert.ok(ph[0].text.includes('جامعة الشمال') && ph[0].text.includes('45 يومًا'), ph[0].text); assert.ok(ph.some(p => p.section === 'timeline' && p.text.includes('بتأخّر')), 'تأخّر');
  for (const p of ph) assert.ok(!/ممتاز|ناجح|ضعيف|ريال|SAR/.test(p.text), p.text);
  assert.equal(parseMissionPhrases('[{"section":"summary","text":"نُفِّذت المهمة بنجاح باهر وكان الخبير ممتازًا"}]'), null, 'كلمات الحكم مرفوضة');
  const ok = parseMissionPhrases('نص قبل [{"section":"timeline","text":"أُنجزت مرحلتان من ثلاث خلال خمسة وأربعين يومًا"},{"section":"xx","text":"قصير"}] بعد');
  assert.equal(ok?.length, 1); assert.equal(ok?.[0].section, 'timeline');
  const p = missionPhrasePrompt(c, b); assert.ok(p.system.includes('ممنوع') && p.system.includes('مبلغ مالي'), 'system'); assert.ok(!/fee|ريال|khaled@/.test(p.user), 'لا أجر ولا بريد'); assert.ok(p.user.includes('"delivered":3'), p.user);
});

test('ر3 — ما تراه الجهة: كامل بلا الملاحظة الإدارية ولا البريد · التحقّق العام مختصر · الإقرار مرة واحدة', () => {
  const c = computed(); const b = filled(c); b.handover.admin_note = 'ملاحظة داخلية';
  const r = { id: 'x', verify_code: 'RMSSN0001', status: 'approved', author_name: 'ريم', approved_name: 'أحمد', approved_at: '2026-11-04T09:00:00Z', computed: c, body: b, period_from: '2026-10-01', period_to: '2026-11-15', kind: 'mission' };
  const cv = missionClientView(r); const js = JSON.stringify(cv);
  assert.ok(!js.includes('ملاحظة داخلية') && !js.includes('khaled@') && !js.includes('my_updates'), 'مخفيّات'); assert.ok(js.includes('تشكيل لجنة متابعة') && js.includes('دليل الإجراءات'), 'التوصيات والمخرجات ظاهرة'); assert.equal(cv.can_ack, true); assert.equal(cv.stats.delivered, 3);
  const pv = missionPublicView(r); const pj = JSON.stringify(pv);
  assert.equal(pv.kind, 'mission'); assert.equal(pv.org_ar, 'جامعة الشمال'); assert.equal(pv.delivered, 3); assert.ok(!pj.includes('تشكيل لجنة') && !pj.includes('وُثِّقت'), 'بلا توصيات ولا نتائج'); assert.equal(pv.ack, null);
  assert.equal(canAck({ status: 'approved', body: { ack: { name: 'x' } } }), false); assert.equal(canAck({ status: 'submitted', body: {} }), false);
  const t = ackToken(); assert.equal(t.length, 24); assert.ok(/^[A-Z2-9]+$/.test(t) && !/[IO01]/.test(t), t);
});

test('ر3 — سطر القائمة وسطر الدليل «ما شهده أَثَر»', () => {
  const line = listLineAr({ kind: 'mission', status: 'approved', computed: computed() } as any); assert.ok(line.startsWith('تقرير إنجاز المهمة · تطوير نظام الجودة · جامعة الشمال'), line); assert.ok(line.includes('2/3 مراحل'), line);
  assert.equal(missionListLineAr({ computed: {}, status: 'draft' }), 'تقرير إنجاز المهمة ·  · مسودّة');
  const w1 = witnessLines({ ...EMPTY_WITNESS, missions_reported: 1 }); assert.ok(w1.some(l => l.key === 'missions_reported' && l.text.includes('مهمة واحدة موثَّقة')), JSON.stringify(w1));
  const w3 = witnessLines({ ...EMPTY_WITNESS, missions_reported: 3 }); assert.ok(w3.some(l => l.text.includes('3 مهمات موثَّقة')), JSON.stringify(w3));
  assert.ok(!witnessLines(EMPTY_WITNESS).some(l => l.key === 'missions_reported'), 'صفر لا يظهر');
});
