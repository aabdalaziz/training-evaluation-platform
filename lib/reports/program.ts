/**
 * التقرير الشامل للبرنامج — صفحة واحدة لصانع القرار
 * يجمع: البطاقة التعريفية · الحضور · التقييمات (المستوى 1) · الكسب (2) · نقل الأثر (3) · مؤشرات النتائج (4) · الشهادات · سلسلة الأثر · التوصيات
 * دوال نقية بلا تبعيات — قابلة للاختبار
 */
import { buildEvaluations, buildFacts, buildComments, applyFilters, kpis, groupBy, riskRegister, factsOf, TARGET } from './analytics';
import type { RawEvaluation, RawAnswer, RawQuestion, Classroom, Trainer, Program, Lookups, Kpis, GroupRow, Action, Comment } from './analytics';
import { summarize as impactSummary } from '../impact/analytics';
import type { ImpactSummary } from '../impact/analytics';
import type { ImpactResponse } from '../impact/model';
import { analyze as transferAnalyze } from '../behavior/model';
import type { BehaviorFollowup, BehaviorQuestion, BehaviorResponse, TransferSummary } from '../behavior/model';
import { summarize as attendanceSummary } from '../attendance/model';
import type { PersonSummary } from '../attendance/model';
import { kpiRows, programOutcomeIndex, chainRecommendations } from '../outcomes/model';
import type { OutcomeKpi, OutcomeMeasurement, KpiRow } from '../outcomes/model';
import { buildChain } from '../outcomes/chain';
import type { ChainRow } from '../outcomes/chain';
import type { Sheet } from '../export/xlsx';

export type Certificate = { id: string; program_id: string | null; recipient_name?: string | null; recipient_email?: string | null; serial?: string | null; issued_at?: string | null; sent_at?: string | null; revoked_at?: string | null };

export type ProgramReportInput = {
  program: Program;
  classrooms: Classroom[]; trainers: Trainer[]; questions: RawQuestion[];
  evaluations: RawEvaluation[]; answers: RawAnswer[];
  assessments: { id: string; program_id: string | null; title_ar?: string | null }[]; impactResponses: ImpactResponse[];
  followups: BehaviorFollowup[]; behaviorQuestions: BehaviorQuestion[]; behaviorResponses: BehaviorResponse[];
  sessions: { id: string; program_id: string; session_date?: string; title?: string; status?: string }[];
  records: { session_id: string; full_name: string; email?: string | null; phone?: string | null; identity_key?: string | null; status: 'present' | 'late' | 'excused' | 'absent' }[];
  certificates: Certificate[];
  kpis: OutcomeKpi[]; measurements: OutcomeMeasurement[];
};

export type ProgramReport = {
  program: Program;
  rooms: { id: string; code: string; trainer: string }[];
  trainers: string[];
  attendance: { sessions: number; participants: number; avgPct: number | null; eligible80: number; people: PersonSummary[] };
  evaluation: { k: Kpis | null; axes: GroupRow[]; questionsTop: GroupRow[]; questionsLow: GroupRow[]; byKind: GroupRow[]; byRoom: GroupRow[]; actions: Action[]; comments: Comment[] };
  learning: { s: ImpactSummary | null; tools: number };
  transfer: { s: TransferSummary | null; campaigns: number };
  outcomes: { rows: KpiRow[]; index: number | null; measured: number };
  certificates: { issued: number; sent: number; revoked: number; coveragePct: number | null };
  chain: ChainRow;
  headline: { key: 'strong' | 'good' | 'limited' | 'weak' | 'none'; ar: string };
  recommendations: string[];
};

const r1 = (x: number) => Math.round(x * 10) / 10;

export function buildProgramReport(d: ProgramReportInput): ProgramReport {
  const pid = d.program.id;
  const rooms = d.classrooms.filter(c => c.program_id === pid).map(c => ({ id: c.id, code: c.code, trainer: d.trainers.find(t => t.id === c.trainer_id)?.name || '—' }));
  const trainers = Array.from(new Set(rooms.map(r => r.trainer).filter(x => x !== '—')));

  // الحضور
  const sess = d.sessions.filter(s => s.program_id === pid); const sids = new Set(sess.map(s => s.id));
  const people = sess.length ? attendanceSummary(sess, d.records.filter(r => sids.has(r.session_id)) as any) : [];
  const avgPct = people.length ? Math.round(people.reduce((a, p) => a + p.pct, 0) / people.length) : null;
  const attendance = { sessions: sess.length, participants: people.length, avgPct, eligible80: people.filter(p => p.pct >= 80).length, people };

  // التقييمات (المستوى 1)
  const lk: Lookups = { classrooms: d.classrooms, trainers: d.trainers, programs: [d.program], questions: d.questions };
  const allEvals = buildEvaluations(d.evaluations, d.answers, lk);
  const facts = buildFacts(d.answers, d.questions);
  const evals = applyFilters(allEvals, { programId: pid, kind: 'ALL' }, lk);
  const pf = factsOf(evals, facts);
  const k = evals.length ? kpis(evals, pf) : null;
  const axes = evals.length ? groupBy('axis', evals, pf, lk, 'ar') : [];
  const qs = evals.length ? groupBy('question', evals, pf, lk, 'ar').filter(q => q.n >= 3) : [];
  const sortedQ = [...qs].sort((a, b) => b.mean - a.mean);
  const evaluation = {
    k, axes, questionsTop: sortedQ.slice(0, 3), questionsLow: sortedQ.slice(-3).reverse(),
    byKind: evals.length ? groupBy('kind', evals, pf, lk, 'ar') : [], byRoom: evals.length ? groupBy('classroom', evals, pf, lk, 'ar') : [],
    actions: evals.length ? riskRegister(evals, pf, lk, 'ar').slice(0, 5) : [],
    comments: buildComments(evals, d.answers, d.questions).filter(c => c.text.length >= 12).slice(0, 8),
  };

  // التعلم (المستوى 2)
  const aids = new Set(d.assessments.filter(a => a.program_id === pid).map(a => a.id));
  const ir = d.impactResponses.filter(r => aids.has(r.assessment_id)).map(r => ({ ...r, respondent_hash: `${r.assessment_id}:${r.respondent_hash}` }));
  const learning = { s: ir.length ? impactSummary(ir) : null, tools: aids.size };

  // السلوك (المستوى 3): نحلل أكبر حملة (أكثر استجابات) كممثل تفصيلي
  const fus = d.followups.filter(f => f.program_id === pid);
  let best: { f: BehaviorFollowup; s: TransferSummary } | null = null;
  for (const f of fus) {
    const s = transferAnalyze(d.behaviorQuestions.filter(q => q.followup_id === f.id), d.behaviorResponses.filter(r => r.followup_id === f.id), f.scale_max || 5);
    if (s.n && (!best || s.n > best.s.n)) best = { f, s };
  }
  const transfer = { s: best?.s || null, campaigns: fus.length };

  // النتائج (المستوى 4)
  const rows = kpiRows(d.kpis.filter(x => x.program_id === pid), d.measurements);
  const oi = programOutcomeIndex(rows);
  const outcomes = { rows, index: oi.index, measured: oi.measured };

  // الشهادات
  const certs = d.certificates.filter(c => c.program_id === pid);
  const issued = certs.filter(c => !c.revoked_at).length;
  const certificates = { issued, sent: certs.filter(c => c.sent_at && !c.revoked_at).length, revoked: certs.filter(c => c.revoked_at).length, coveragePct: attendance.participants ? Math.min(100, Math.round((issued / attendance.participants) * 100)) : null };

  // سلسلة الأثر
  const chain = buildChain({
    programs: [d.program as any], evaluations: d.evaluations, answers: d.answers, assessments: d.assessments, impactResponses: d.impactResponses,
    followups: d.followups, questions: d.behaviorQuestions, behaviorResponses: d.behaviorResponses, sessions: d.sessions, records: d.records, kpis: d.kpis, measurements: d.measurements,
  })[0];

  const idx = chain.s.index;
  const headline = idx == null ? { key: 'none' as const, ar: 'لا تتوفر بيانات أثر كافية بعد' } : idx >= 75 ? { key: 'strong' as const, ar: 'برنامج عالي الأثر — يُوصى بتكراره وتوسيعه' } : idx >= 60 ? { key: 'good' as const, ar: 'برنامج جيد الأثر — مع فرص تحسين محددة' } : idx >= 45 ? { key: 'limited' as const, ar: 'أثر محدود — يحتاج مراجعة قبل الدفعة القادمة' } : { key: 'weak' as const, ar: 'أثر ضعيف — يُوصى بإعادة التصميم' };

  const recommendations = buildRecommendations({ attendance, evaluation, learning, transfer, outcomes, certificates, chain });
  return { program: d.program, rooms, trainers, attendance, evaluation, learning, transfer, outcomes, certificates, chain, headline, recommendations };
}

function buildRecommendations(r: Pick<ProgramReport, 'attendance' | 'evaluation' | 'learning' | 'transfer' | 'outcomes' | 'certificates' | 'chain'>): string[] {
  const out: string[] = [];
  const k = r.evaluation.k;
  if (k && k.mean < TARGET) out.push(`متوسط الرضا ${k.mean.toFixed(2)} دون المستهدف ${TARGET} — ركّز على: ${r.evaluation.questionsLow.map(q => q.label).slice(0, 2).join('، ') || 'أقل المحاور'}.`);
  if (k && k.lowPct >= 15) out.push(`${Math.round(k.lowPct)}% من التقييمات منخفضة (≤2) — راجع التعليقات السلبية واتصل بعينة من المتدربين.`);
  if (r.attendance.participants && r.attendance.avgPct != null && r.attendance.avgPct < 80) out.push(`متوسط الحضور ${r.attendance.avgPct}% — ${r.attendance.participants - r.attendance.eligible80} متدربًا دون 80% (شرط الشهادة)؛ فعّل التذكير قبل الجلسات.`);
  if (r.learning.s && r.learning.s.nPaired > 0 && r.learning.s.hake != null && r.learning.s.hake < 0.3) out.push(`الكسب المعياري g = ${r.learning.s.hake} (منخفض) — زد الأنشطة التطبيقية والتغذية الراجعة أثناء البرنامج.`);
  if (r.transfer.s && r.transfer.s.gap != null && r.transfer.s.gap <= -0.5) out.push('المتدربون يقدّرون تطبيقهم أعلى من تقدير مشرفيهم — نسّق مع المشرفين على معايير تطبيق واضحة.');
  if (r.transfer.s && r.transfer.s.barriers[0] && r.transfer.s.barriers[0].pct >= 30) out.push(`أبرز معوّق للنقل: «${r.transfer.s.barriers[0].label}» (${r.transfer.s.barriers[0].pct}%) — عالجه مؤسسيًا.`);
  if (r.certificates.coveragePct != null && r.certificates.coveragePct < 60 && r.attendance.eligible80 > r.certificates.issued) out.push(`${r.attendance.eligible80 - r.certificates.issued} متدربًا مستوفيًا للحضور بلا شهادة — أصدر الشهادات من صفحة الشهادات.`);
  for (const s of chainRecommendations(r.chain.c, r.chain.s)) if (!out.includes(s)) out.push(s);
  return out.slice(0, 7);
}

/* ---------------- تصدير Excel موحّد ---------------- */
export function programSheets(rep: ProgramReport): Sheet[] {
  const p = rep.program; const k = rep.evaluation.k; const l = rep.learning.s; const t = rep.transfer.s; const c = rep.chain;
  const summary: (string | number | null)[][] = [
    ['البند', 'القيمة'],
    ['البرنامج', p.name_ar], ['الحالة', p.status || ''], ['البداية', p.start_date || ''], ['النهاية', p.end_date || ''], ['القاعات', rep.rooms.map(r => r.code).join('، ')], ['المدربون', rep.trainers.join('، ')],
    ['الجلسات', rep.attendance.sessions], ['المشاركون (حضور)', rep.attendance.participants], ['متوسط الحضور %', rep.attendance.avgPct], ['مستوفو 80%', rep.attendance.eligible80],
    ['استبانات التقييم', k?.responses ?? 0], ['متوسط الرضا (1–5)', k ? r1(k.mean) : null], ['% تقييمات مرتفعة', k ? Math.round(k.highPct) : null], ['% تقييمات منخفضة', k ? Math.round(k.lowPct) : null],
    ['أزواج قبلي/بعدي', l?.nPaired ?? 0], ['متوسط قبلي', l?.pre.mean ?? null], ['متوسط بعدي', l?.post.mean ?? null], ['الكسب المعياري g', l?.hake ?? null], ['Cohen d', l?.cohenD ?? null],
    ['استجابات المتابعة', t?.n ?? 0], ['مؤشر نقل الأثر', t?.transfer_index ?? null], ['نسبة التطبيق %', t?.app_all == null ? null : Math.round(t.app_all)],
    ['مؤشرات النتائج', rep.outcomes.rows.length], ['مؤشر النتائج %', rep.outcomes.index],
    ['شهادات صادرة', rep.certificates.issued], ['شهادات مُرسلة', rep.certificates.sent],
    ['سلسلة الأثر — L1', c.s.s1], ['L2', c.s.s2], ['L3', c.s.s3], ['L4', c.s.s4], ['مؤشر السلسلة', c.s.index], ['الخلاصة', rep.headline.ar],
  ];
  const axes = [['المحور', 'المتوسط', 'الاستجابات', '% مرتفع', '% منخفض', 'الفجوة عن المستهدف'], ...rep.evaluation.axes.map(a => [a.label, r1(a.mean), a.n, Math.round(a.highPct), Math.round(a.lowPct), r1(a.gap)])];
  const att = [['الاسم', 'البريد', 'حاضر', 'متأخر', 'معتذر', 'غائب', 'النسبة %'], ...rep.attendance.people.map(x => [x.name, x.email || '', x.present, x.late, x.excused, x.absent, x.pct])];
  const kp = [['المؤشر', 'الوحدة', 'الاتجاه', 'خط الأساس', 'المستهدف', 'الحالي', 'تاريخ القياس', 'التحقق %', 'الوزن'], ...rep.outcomes.rows.map(x => [x.name_ar, x.unit, x.direction === 'up' ? 'أعلى أفضل' : 'أقل أفضل', x.baseline, x.target, x.current, x.measured_on, x.achievement, x.weight])];
  const rec = [['#', 'التوصية'], ...rep.recommendations.map((x, i) => [i + 1, x])];
  const cm = [['التاريخ', 'النوع', 'السؤال', 'التعليق', 'الانطباع'], ...rep.evaluation.comments.map(x => [x.date, x.kind, x.question_ar, x.text, x.sentiment])];
  return [
    { name: 'الملخص', rows: summary, widths: [26, 60], rtl: true },
    { name: 'محاور التقييم', rows: axes, widths: [30, 10, 12, 10, 10, 14], rtl: true },
    { name: 'الحضور', rows: att, widths: [28, 28, 8, 8, 8, 8, 10], rtl: true },
    { name: 'مؤشرات النتائج', rows: kp, widths: [36, 8, 12, 10, 10, 10, 12, 10, 6], rtl: true },
    { name: 'التوصيات', rows: rec, widths: [4, 90], rtl: true },
    { name: 'التعليقات', rows: cm, widths: [12, 8, 30, 70, 10], rtl: true },
  ];
}
