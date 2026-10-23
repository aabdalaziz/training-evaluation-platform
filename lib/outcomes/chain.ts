/**
 * بناء سلسلة الأثر 1→4 لكل برنامج من الجداول الخام — دالة نقية قابلة للاختبار
 */
import { safeRating, mean } from '../reports/analytics';
import { summarize as impactSummary } from '../impact/analytics';
import type { ImpactResponse } from '../impact/model';
import { analyze as transferAnalyze } from '../behavior/model';
import type { BehaviorFollowup, BehaviorQuestion, BehaviorResponse } from '../behavior/model';
import { summarize as attendanceSummary } from '../attendance/model';
import { kpiRows, programOutcomeIndex, chainScore } from './model';
import type { OutcomeKpi, OutcomeMeasurement, ChainLevels, ChainScore } from './model';

export type ChainInput = {
  programs: { id: string; name_ar: string; status?: string | null; end_date?: string | null }[];
  evaluations: { id: string; program_id: string | null; overall_rating?: number | null }[];
  answers: { evaluation_id: string; rating_value: unknown }[];
  assessments: { id: string; program_id: string | null }[];
  impactResponses: ImpactResponse[];
  followups: BehaviorFollowup[];
  questions: BehaviorQuestion[];
  behaviorResponses: BehaviorResponse[];
  sessions: { id: string; program_id: string }[];
  records: { session_id: string; full_name: string; email?: string | null; phone?: string | null; identity_key?: string | null; status: 'present' | 'late' | 'excused' | 'absent' }[];
  kpis: OutcomeKpi[];
  measurements: OutcomeMeasurement[];
};

export type ChainRow = { program: ChainInput['programs'][number]; c: ChainLevels; s: ChainScore };

const r2 = (x: number) => Math.round(x * 100) / 100;

export function buildChain(d: ChainInput): ChainRow[] {
  // L1: متوسط تقييم كل استبانة (متوسط إجاباتها أو overall_rating) ثم متوسط البرنامج
  const byEval = new Map<string, number[]>();
  for (const a of d.answers) { const v = safeRating(a.rating_value); if (v == null) continue; const arr = byEval.get(a.evaluation_id) || []; arr.push(v); byEval.set(a.evaluation_id, arr); }
  const evalMeans = new Map<string, number[]>();
  for (const e of d.evaluations) {
    if (!e.program_id) continue;
    const rs = byEval.get(e.id); const m = rs && rs.length ? mean(rs) : safeRating(e.overall_rating);
    if (m == null) continue; const arr = evalMeans.get(e.program_id) || []; arr.push(m); evalMeans.set(e.program_id, arr);
  }
  // L2: دمج استجابات كل أدوات البرنامج (الأزواج تُطابق داخل الأداة نفسها عبر respondent_hash + assessment)
  const assessProg = new Map(d.assessments.map(a => [a.id, a.program_id] as const));
  const impactByProg = new Map<string, ImpactResponse[]>();
  for (const r of d.impactResponses) { const pid = assessProg.get(r.assessment_id); if (!pid) continue; const arr = impactByProg.get(pid) || []; arr.push({ ...r, respondent_hash: `${r.assessment_id}:${r.respondent_hash}` }); impactByProg.set(pid, arr); }
  // L3: متوسط مؤشر النقل لحملات البرنامج موزونًا بعدد الاستجابات
  const fuByProg = new Map<string, BehaviorFollowup[]>();
  for (const f of d.followups) { if (!f.program_id) continue; const arr = fuByProg.get(f.program_id) || []; arr.push(f); fuByProg.set(f.program_id, arr); }
  // الحضور
  const sessByProg = new Map<string, { id: string }[]>();
  for (const s of d.sessions) { const arr = sessByProg.get(s.program_id) || []; arr.push({ id: s.id }); sessByProg.set(s.program_id, arr); }

  return d.programs.map(p => {
    const l1s = evalMeans.get(p.id) || [];
    const l1 = l1s.length ? r2(mean(l1s)) : null;

    const ir = impactByProg.get(p.id) || [];
    const isum = ir.length ? impactSummary(ir) : null;
    const l2 = isum && isum.nPaired > 0 && isum.hake != null ? r2(isum.hake) : null;

    let l3: number | null = null, l3n = 0;
    const fus = fuByProg.get(p.id) || [];
    if (fus.length) {
      let wsum = 0, acc = 0;
      for (const f of fus) {
        const s = transferAnalyze(d.questions.filter(q => q.followup_id === f.id), d.behaviorResponses.filter(r => r.followup_id === f.id), f.scale_max || 5);
        if (s.transfer_index == null || !s.n) continue; acc += s.transfer_index * s.n; wsum += s.n; l3n += s.n;
      }
      if (wsum) l3 = Math.round(acc / wsum);
    }

    const krows = kpiRows(d.kpis.filter(k => k.program_id === p.id), d.measurements);
    const oi = programOutcomeIndex(krows);

    const sess = sessByProg.get(p.id) || [];
    let attendance_pct: number | null = null, participants: number | null = null;
    if (sess.length) {
      const ids = new Set(sess.map(s => s.id));
      const people = attendanceSummary(sess, d.records.filter(r => ids.has(r.session_id)) as any);
      participants = people.length;
      attendance_pct = people.length ? Math.round(mean(people.map(x => x.pct))) : null;
    }

    const c: ChainLevels = { l1, l1_n: l1s.length, l2, l2_pairs: isum?.nPaired || 0, l2_gain: isum && isum.nPaired > 0 && isum.gain != null ? r2(isum.gain) : null, l3, l3_n: l3n, l4: oi.index, l4_n: oi.n, attendance_pct, participants };
    return { program: p, c, s: chainScore(c) };
  });
}

/** ملخص المؤسسة: متوسطات المستويات عبر البرامج التي لديها بيانات */
export function portfolioSummary(rows: ChainRow[]) {
  const pick = (f: (r: ChainRow) => number | null) => { const xs = rows.map(f).filter((x): x is number => x != null); return { mean: xs.length ? Math.round(mean(xs)) : null, n: xs.length }; };
  return { s1: pick(r => r.s.s1), s2: pick(r => r.s.s2), s3: pick(r => r.s.s3), s4: pick(r => r.s.s4), index: pick(r => r.s.index), complete: rows.filter(r => r.s.levels === 4).length, total: rows.length };
}
