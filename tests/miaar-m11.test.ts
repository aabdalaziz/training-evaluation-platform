// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م11 «مِران البداية» — أهلية التشخيص · أضعف وحدات مستوى الالتحاق · مسوَّدة لكل قرار تسكين + إشعار مدرّب الشعبة · لا تُفتح قبل توقيع · جاهزية «أول درس» · أدلّة · الهجرة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  KIND_AR, READY_START_AR, READY_AR, MAX_UNITS, PLAN_DAYS,
  weakUnitsFromTally, eligibleReport, readiness, planDays, mirrorRowsFrom,
  draftPlan, draftForPlacements, approvePlan, learnerView, summariesForReports, practiceFactsForReports,
} from '../lib/miaar/practice';
import { noticeText, KIND_AR as NOTICE_KIND_AR, KIND_ICON } from '../lib/portal/notices';
import { practiceText } from '../lib/accreditation/miaar';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const U = (code: string, title = code) => ({ code, level: code.slice(0, 2) as any, idx: 1, title_ar: title, title_en: title, focus_ar: 'تركيز', domains: [], descriptor_codes: [], status: 'approved' as const });
/** تقرير تشخيص (بلا exit): ملخّص تسكين + خريطة وحدات {رمز:{n,correct}} كما يكتبها المحرّك */
const DIAG = (over: any = {}) => ({
  المستوى_العام: 'A2', بيانات_المتقدم: { الاسم: 'سارة' },
  ملخص_التسكين: { المستوى_المثبت: 'A2', مستوى_الالتحاق_المقترح: 'A2', دون_A1: false },
  الوحدات: { 'A2-U01': { n: 6, correct: 2 }, 'A2-U02': { n: 5, correct: 5 }, 'A2-U03': { n: 4, correct: 1 }, 'A2-U04': { n: 6, correct: 4 }, 'A2-U05': { n: 3, correct: 1 }, 'A2-U06': { n: 2, correct: 1 }, 'B1-U01': { n: 4, correct: 0 }, 'A1-U01': { n: 2, correct: 0 } },
  ...over,
});

test('م11: أضعف وحدات مستوى الالتحاق من خريطة التشخيص — دون 70% أولًا، مرتّبة من الأضعف، بحدّ 4، من المستوى نفسه فقط', () => {
  const w = weakUnitsFromTally(DIAG().الوحدات, 'A2');
  assert.deepEqual(w, ['A2-U03', 'A2-U01', 'A2-U05', 'A2-U06'], 'B1-U01 وA1-U01 مستبعدتان (مستوى آخر) · A2-U02 (100%) وA2-U04 (67%→دون 70 لكن الحدّ 4)');
  assert.equal(w.length, MAX_UNITS);
  assert.deepEqual(weakUnitsFromTally({ 'A1-U01': { n: 5, correct: 5 }, 'A1-U02': { n: 5, correct: 4 } }, 'A1'), ['A1-U02', 'A1-U01'], 'لا ضعيفة → الأدنى نسبةً حتى لو مرتفعة (تمرين تثبيت)');
  assert.deepEqual(weakUnitsFromTally({ 'A1-U01': { n: 0, correct: 0 } }, 'A1'), [], 'n=0 لا يُحتسب');
  assert.deepEqual(weakUnitsFromTally(null, 'A1'), []);
  assert.deepEqual(weakUnitsFromTally({ 'A1-U01': { n: 5, correct: 1 } }, 'A2'), [], 'لا شيء في المستوى المطلوب');
});

test('م11: أهلية التقرير — حكم العبور أولًا (م10)، وإلا التشخيص بمستوى الالتحاق؛ أسباب الرفض واضحة', () => {
  const el = eligibleReport(DIAG()); assert.equal(el.ok, true); if (!el.ok) return;
  assert.equal(el.kind, 'placement'); assert.equal(el.level, 'A2'); assert.equal(el.skill, null); assert.deepEqual(el.units, ['A2-U03', 'A2-U01', 'A2-U05', 'A2-U06']);
  assert.equal(el.before.get('A2-U01'), 33); assert.equal(el.before.get('A2-U02'), 100);
  const pre = eligibleReport(DIAG({ ملخص_التسكين: { دون_A1: true, مستوى_الالتحاق_المقترح: 'A1' } })); assert.deepEqual(pre, { ok: false, reason: 'level_unsupported' }, 'دون A1: لا وحدات منهج بعد');
  assert.deepEqual(eligibleReport({ المستوى_العام: 'A2' }), { ok: false, reason: 'not_diagnostic' });
  assert.deepEqual(eligibleReport(DIAG({ exit_retake: { of: 'x' } })), { ok: false, reason: 'retake_sitting' }, 'جلسة إعادة مهارة ليست تشخيصًا');
  assert.deepEqual(eligibleReport(DIAG({ الوحدات: undefined })), { ok: false, reason: 'no_units' });
  assert.deepEqual(eligibleReport(DIAG({ الوحدات: { 'B1-U01': { n: 4, correct: 0 } } })), { ok: false, reason: 'no_units' }, 'خريطة بلا وحدات من مستوى الالتحاق');
  const fallback = eligibleReport(DIAG({ ملخص_التسكين: { المستوى_المثبت: 'A1' } })); assert.equal(fallback.ok && fallback.level, 'A1', 'بلا مقترح → المستوى المثبت');
  const ex = eligibleReport({ ...DIAG(), exit: { الحالة: 'final', النتيجة: 'conditional', المستوى: 'A2', مهارة_الإعادة: 'reading', الوحدات: [{ الرمز: 'A2-U09', النسبة: 20, الحالة: 'weak' }] } });
  assert.equal(ex.ok && ex.kind, 'exit', 'وجود حكم عبور يقدّم باب م10'); assert.equal(ex.ok && ex.units[0], 'A2-U09');
  const exPassed = eligibleReport({ ...DIAG(), exit: { الحالة: 'final', النتيجة: 'passed', المستوى: 'A2' } }); assert.equal(exPassed.ok, false, 'المجتاز لا يعود إلى باب التشخيص');
  assert.equal(KIND_AR.placement, 'مِران البداية — بعد التشخيص'); assert.equal(KIND_AR.exit, 'مِران — بعد حكم العبور');
});

test('م11: الجاهزية بلغة «أول درس» بدل «الإعادة» — الحالات نفسها، العنوان والجملة تتبدّل بالنوع', () => {
  const units = [U('A2-U01', 'التسوّق'), U('A2-U03', 'الاتجاهات')];
  const prog = [{ unit: 'A2-U01', n: 12, correct: 10, percent: 83, recent_n: 10, recent_percent: 80 }, { unit: 'A2-U03', n: 12, correct: 9, percent: 75, recent_n: 10, recent_percent: 70 }];
  const ex = readiness(prog, units); const st = readiness(prog, units, 'placement');
  assert.equal(ex.state, 'ready'); assert.equal(st.state, ex.state, 'العتبات واحدة');
  assert.equal(ex.label_ar, READY_AR.ready); assert.equal(st.label_ar, READY_START_AR.ready); assert.equal(st.label_ar, 'جاهز لأول درس');
  assert.match(st.sentence_ar, /أنت جاهز لأول درس/); assert.doesNotMatch(st.sentence_ar, /الإعادة/);
  const early = readiness([{ unit: 'A2-U01', n: 2, correct: 1, percent: 50, recent_n: 2, recent_percent: 50 }], units, 'placement'); assert.equal(early.label_ar, 'واصل التمرين');
});

test('م11: أيام الخطّة — A1 بلا أيام نصّية (استقبالي فقط)، A2 فأعلى بأيام نصّية · المرآة قبل/بعد من خريطة التشخيص', () => {
  const dA1 = planDays(['A1-U01', 'A1-U02'], false); assert.equal(dA1.length, PLAN_DAYS); assert.ok(dA1.every((d) => !(d as any).text), 'A1 بلا كتابة');
  const dA2 = planDays(['A2-U01', 'A2-U03'], true); assert.ok(dA2.some((d) => (d as any).text), 'A2 فيه أيام نصّية (يوم 1 و12 + المرآة)');
  const el = eligibleReport(DIAG()); if (!el.ok) return assert.fail('مؤهّل');
  const rows = mirrorRowsFrom(el.before, [{ unit: 'A2-U03', n: 10, correct: 8, percent: 80, recent_n: 10, recent_percent: 80 }], [U('A2-U03', 'الاتجاهات')]);
  const r = rows.find((x) => x.unit === 'A2-U03')!; assert.equal(r.before, 25, 'قبل = نسبة التشخيص'); assert.equal(r.now, 80); assert.equal(r.delta, 55);
});

/* قاعدة وهمية صغيرة (نمط م10) تغطي الجداول التي يلمسها م11 */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = { miaar_practice_plans: [], miaar_practice_attempts: [], portal_learner_notices: [], placement_reports: [], question_bank_items: [], question_bank_answer_keys: [], miaar_syllabus_units: [], classrooms: [], trainers: [], placement_decisions: [], ...seed };
  let ids = 0;
  const q = (table: string) => { const rows = T[table] || (T[table] = []); const f: Array<(r: any) => boolean> = []; let mode: 'select' | 'insert' | 'update' | 'upsert' = 'select'; let payload: any = null; let single = false; let lim = 0;
    const b: any = { select() { return b; }, eq(k: string, v: any) { f.push((r) => r[k] === v); return b; }, in(k: string, v: any[]) { f.push((r) => v.includes(r[k])); return b; }, is(k: string, v: any) { f.push((r) => r[k] === v); return b; }, lte() { return b; }, gte() { return b; }, lt() { return b; }, gt() { return b; }, neq(k: string, v: any) { f.push((r) => r[k] !== v); return b; }, not() { return b; }, order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = true; return b; }, single() { single = true; return b; },
      insert(p: any) { mode = 'insert'; payload = p; return b; }, update(p: any) { mode = 'update'; payload = p; return b; }, upsert(p: any) { mode = 'upsert'; payload = p; return b; },
      then(res: any) { let data: any;
        if (mode === 'insert' || mode === 'upsert') { const arr = (Array.isArray(payload) ? payload : [payload]).map((p: any) => ({ id: `id${++ids}`, created_at: new Date().toISOString(), ...p }));
          if (mode === 'upsert' && table === 'portal_learner_notices') { for (const p of arr) { const i = rows.findIndex((r) => r.dedupe_key === p.dedupe_key); if (i >= 0) Object.assign(rows[i], p); else rows.push(p); } data = arr; } else { rows.push(...arr); data = single ? arr[0] : arr; } }
        else if (mode === 'update') { const hit = rows.filter((r) => f.every((p) => p(r))); for (const r of hit) Object.assign(r, payload); data = single ? hit[0] || null : hit; }
        else { const hit = rows.filter((r) => f.every((p) => p(r))); data = single ? hit[0] || null : (lim ? hit.slice(0, lim) : hit); }
        return res({ data, error: null }); } };
    return b; };
  return { T, from: q, rpc: async () => ({ data: null, error: null }) };
}
const REP = (id: string, email: string, over: any = {}) => ({ id, candidate_email: email, access_code: `ML-${id}-0000`, invite_id: 'inv1', user_id: null, report: DIAG(over) });

test('م11: مسوَّدة لكل قرار تسكين — نوع placement · لا تُفتح للمتعلّم · إشعار واحد لمدرّب الشعبة بعدد المسوَّدات المعلّقة · لا تكرار في اليوم نفسه بل تحديث', async () => {
  const db = fakeDb({ classrooms: [{ id: 'c1', code: 'A2-01', section_name: 'شعبة 1', trainer_id: 't1' }, { id: 'c2', code: 'A2-02', trainer_id: 't9' }], trainers: [{ id: 't1', email: 'Trainer@upm.edu.sa' }],
    placement_decisions: [{ report_id: 'r1', classroom_id: 'c1', decision_status: 'approved' }, { report_id: 'r2', classroom_id: 'c1', decision_status: 'approved' }, { report_id: 'r3', classroom_id: 'c2', decision_status: 'approved' }],
    placement_reports: [REP('r1', 'a@x.sa'), REP('r2', 'b@x.sa'), REP('r3', 'c@x.sa'), REP('r4', 'd@x.sa', { ملخص_التسكين: { دون_A1: true } })] });
  const now = new Date('2026-11-05T09:00:00Z');
  const s = await draftForPlacements(db as any, [{ rep: db.T.placement_reports[0], classroom_id: 'c1' }, { rep: db.T.placement_reports[1], classroom_id: 'c1' }, { rep: db.T.placement_reports[2], classroom_id: 'c2' }, { rep: db.T.placement_reports[3], classroom_id: 'c1' }], 'u1', { now });
  assert.deepEqual(s, { drafted: 3, existed: 0, skipped: 1, notified: 1 }, 'دون A1 تُخطّى · شعبة بلا مدرّب معروف لا إشعار');
  const plans = db.T.miaar_practice_plans; assert.equal(plans.length, 3); assert.ok(plans.every((p: any) => p.kind === 'placement' && p.status === 'draft' && p.skill === null && p.level === 'A2'));
  assert.deepEqual(plans[0].units, ['A2-U03', 'A2-U01', 'A2-U05', 'A2-U06']); assert.equal(plans[0].days.length, PLAN_DAYS); assert.ok(plans[0].days.some((d: any) => d.text), 'A2 → أيام نصّية');
  const n = db.T.portal_learner_notices; assert.equal(n.length, 1); assert.equal(n[0].kind, 'practice_pending'); assert.equal(n[0].email, 'trainer@upm.edu.sa'); assert.equal(n[0].dedupe_key, 'practice_pending:c1:2026-11-05');
  assert.match(n[0].title_ar, /^2 خطّة مِران البداية بانتظار توقيعك — شعبة A2-01/); assert.equal(n[0].url, '/admin/miaar/ledger?practice=c1'); assert.doesNotMatch(n[0].body_ar, /%|درجة/);
  assert.equal(await learnerView(db as any, db.T.placement_reports[0]), null, 'المسوَّدة لا تظهر للمتعلّم قبل التوقيع');
  const again = await draftForPlacements(db as any, [{ rep: db.T.placement_reports[0], classroom_id: 'c1' }], 'u1', { now }); assert.deepEqual(again, { drafted: 0, existed: 1, skipped: 0, notified: 0 }, 'لا مسوَّدة ثانية');
  /* قرار جديد في اليوم نفسه للشعبة c1 → الإشعار يُحدَّث (العدد = كل المعلّق) لا يتكرّر */
  db.T.placement_reports.push(REP('r5', 'e@x.sa')); db.T.placement_decisions.push({ report_id: 'r5', classroom_id: 'c1', decision_status: 'approved' });
  const third = await draftForPlacements(db as any, [{ rep: db.T.placement_reports[4], classroom_id: 'c1' }], 'u1', { now }); assert.equal(third.drafted, 1);
  assert.equal(db.T.portal_learner_notices.length, 1, 'إشعار واحد للشعبة في اليوم'); assert.match(db.T.portal_learner_notices[0].title_ar, /^3 خطّة/);
});

test('م11: الاعتماد بتوقيع إنسان يفتح الخطّة فورًا بنوعها — المتعلّم يرى «مِران البداية» وجاهزية «أول درس» · الملخّصات والأدلّة تميّز النوع', async () => {
  const db = fakeDb({ placement_reports: [REP('r1', 'a@x.sa')], miaar_syllabus_units: [U('A2-U01'), U('A2-U03'), U('A2-U05'), U('A2-U06')] });
  const rep = db.T.placement_reports[0]; const now = new Date('2026-11-05T09:00:00Z');
  const d = await draftPlan(db as any, rep, 'u1'); assert.equal(d.ok, true); if (!d.ok) return; assert.equal(d.plan.kind, 'placement');
  const ap = await approvePlan(db as any, d.plan.id, 'u2', [], { site: 'https://x', code: rep.access_code, now }); assert.equal(ap.ok, true); if (!ap.ok) return;
  assert.equal(ap.plan.status, 'approved'); assert.equal(ap.plan.start_date, '2026-11-05'); assert.equal(ap.plan.kind, 'placement');
  const learnerNotice = db.T.portal_learner_notices.find((x: any) => x.kind === 'practice_plan'); assert.ok(learnerNotice, 'إشعار المتعلّم عند الاعتماد'); assert.equal(learnerNotice.email, 'a@x.sa');
  const lv = await learnerView(db as any, rep, { now }); assert.ok(lv); if (!lv) return;
  assert.equal(lv.النوع, 'placement'); assert.equal(lv.اليوم, 1); assert.equal(lv.المهارة, null); assert.equal(lv.الجاهزية.label_ar, 'واصل التمرين'); assert.ok(!/الإعادة/.test(lv.الجاهزية.sentence_ar));
  assert.equal(lv.المرآة.find((r: any) => r.unit === 'A2-U03')?.before, 25, 'قبل = نسبة التشخيص لا العبور'); assert.match(lv.الشعار, /تقرير تشخيصك/);
  const sums = await summariesForReports(db as any, [rep], { now }); assert.equal(sums.r1.kind, 'placement'); assert.equal(sums.r1.status, 'approved');
  const facts = await practiceFactsForReports(db as any, [rep]); assert.equal(facts.plans, 1); assert.equal(facts.placement, 1); assert.equal(facts.approved, 1);
  assert.match(practiceText(facts as any), /منها 1 «مِران البداية» بعد التشخيص/);
  assert.doesNotMatch(practiceText({ ...facts, placement: 0 } as any), /مِران البداية/);
});

test('م11: نصّ إشعار المدرّب · أيقونته · الهجرة (عمود kind + فهرس) · السجلّ يحمل زرّ «مِران البداية» والاعتماد الجماعي · بطاقة النتيجة تعرض الصندوق للتشخيص', () => {
  const t = noticeText({ kind: 'practice_pending', n: 4, classroom: 'A2-01', classroomId: 'c1' } as any);
  assert.equal(t.url, '/admin/miaar/ledger?practice=c1'); assert.match(t.title_ar, /4 خطّة مِران البداية بانتظار توقيعك/); assert.ok(NOTICE_KIND_AR.practice_pending); assert.equal(KIND_ICON.practice_pending, '✍️');
  const sql = read('supabase/migrations/20270206_portal_miaar_m11_practice_kind.sql');
  assert.match(sql, /alter table public\.miaar_practice_plans add column if not exists kind text not null default 'exit'/i); assert.match(sql, /check \(kind in \('exit', *'placement'\)\)/i); assert.match(sql, /mpp_kind_chk/); assert.match(sql, /mpp_kind_idx/); assert.match(sql, /notify pgrst, 'reload schema'/);
  const ledger = read('app/admin/miaar/Ledger.tsx'); for (const id of ['lg-practice-go', 'lg-practice-all', 'lg-practice-room', 'lg-practice-room-go', 'lg-practice']) assert.ok(ledger.includes(`data-testid="${id}"`), id);
  assert.ok(ledger.includes("action: 'approve_all', report_ids: ids") && ledger.includes("action: 'approve_all', classroom_id: practiceRoom"));
  const route = read('app/api/admin/miaar/practice/route.ts'); assert.ok(route.includes("searchParams.get('reports')") && route.includes("searchParams.get('classroom')") && route.includes('reportsByClassroom'));
  const led = read('lib/miaar/ledger.ts'); assert.equal((led.match(/draftForPlacements\(/g) || []).length, 2, 'بعد القرار اليدوي وبعد التسكين التلقائي');
  const app = read('app/miaar/MiaarApp.tsx'); assert.ok(app.includes('function PracticeBox') && app.includes('!report?.exit && (report as any)?.مِران'));
  const pa = read('app/miaar/practice/PracticeApp.tsx'); assert.ok(pa.includes("v.النوع === 'placement' ? 'مِران البداية · أول أسبوعين قبل أول درس'"));
  assert.match(read('lib/miaar/engine.ts'), /النوع: p\.kind \|\| 'exit'/);
});
