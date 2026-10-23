/**
 * تحميل حقائق الملخص التنفيذي من قاعدة البيانات + مُستدعي النموذج — خادم فقط
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildEvaluations, buildFacts, applyFilters, kpis, groupBy, periodComparison, riskRegister, riyadhDate, addDays } from '../reports/analytics';
import type { Lookups, Filters } from '../reports/analytics';
import { buildChain } from '../outcomes/chain';
import { portfolioSummary } from '../outcomes/chain';
import { factsFrom } from './exec-summary';
import type { SummaryFacts } from './exec-summary';
import { readKey, resolveModel, callWithFallback } from './provider';

export async function loadSummaryFacts(db: SupabaseClient, opts: { programId?: string; days?: number }): Promise<SummaryFacts> {
  const days = Math.max(1, Math.min(365, Number(opts.days) || 30));
  const [ev, an, qs, cl, tr, pg, nt, ia, ir, fu, bq, br, ss, ar, ok, om] = await Promise.all([
    db.from('evaluations').select('*').limit(20000), db.from('evaluation_answers').select('*').limit(200000), db.from('questions').select('*'),
    db.from('classrooms').select('*'), db.from('trainers').select('*'), db.from('programs').select('*'),
    db.from('notifications').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    db.from('impact_assessments').select('id,program_id'), db.from('impact_responses').select('*').limit(20000),
    db.from('behavior_followups').select('*'), db.from('behavior_questions').select('*'), db.from('behavior_responses').select('*').limit(20000),
    db.from('attendance_sessions').select('id,program_id'), db.from('attendance_records').select('session_id,full_name,email,phone,identity_key,status').limit(50000),
    db.from('outcome_kpis').select('*'), db.from('outcome_measurements').select('*').limit(20000),
  ]);
  const lk: Lookups = { classrooms: (cl.data || []) as any[], trainers: (tr.data || []) as any[], programs: (pg.data || []) as any[], questions: (qs.data || []) as any[] };
  const all = buildEvaluations((ev.data || []) as any[], (an.data || []) as any[], lk);
  const facts = buildFacts((an.data || []) as any[], (qs.data || []) as any[]);
  const today = riyadhDate(new Date().toISOString());
  const f: Filters = { programId: opts.programId || undefined, kind: 'ALL', from: addDays(today, -(days - 1)), to: today };
  const evals = applyFilters(all, f, lk);
  const k = evals.length ? kpis(evals, facts) : null;
  const cmp = evals.length ? periodComparison(all, facts, f, lk) : null;
  const axes = evals.length ? groupBy('axis', evals, facts, lk, 'ar') : [];
  const programs = evals.length ? groupBy('program', evals, facts, lk, 'ar') : [];
  const trainers = evals.length ? groupBy('trainer', evals, facts, lk, 'ar') : [];
  const actions = evals.length ? riskRegister(evals, facts, lk, 'ar') : [];
  let chain_index: number | null = null;
  try {
    const rows = buildChain({ programs: lk.programs.filter((p: any) => !opts.programId || p.id === opts.programId) as any, evaluations: (ev.data || []) as any[], answers: (an.data || []) as any[], assessments: (ia.data || []) as any[], impactResponses: (ir.data || []) as any[], followups: (fu.data || []) as any[], questions: (bq.data || []) as any[], behaviorResponses: (br.data || []) as any[], sessions: (ss.data || []) as any[], records: (ar.data || []) as any[], kpis: (ok.data || []) as any[], measurements: (om.data || []) as any[] });
    chain_index = portfolioSummary(rows.filter(r => r.s.levels > 0)).index.mean;
  } catch { /* optional */ }
  const programName = opts.programId ? (lk.programs.find((p: any) => p.id === opts.programId) as any)?.name_ar : null;
  return factsFrom({ scope: programName || 'كل البرامج', period: `آخر ${days} يومًا (${f.from} → ${f.to})`, generatedAt: today, k, cmp, axes, programs, trainers, actions, extras: { chain_index, open_notifications: (nt as any).count ?? null } });
}

/** يعيد دالة استدعاء النموذج إن توفر مفتاح، وإلا undefined (→ البديل المحلي) */
export async function aiCaller(deadlineMs = 25000): Promise<{ call?: (system: string, user: string) => Promise<{ text: string; model: string }>; configured: boolean; provider: string; error?: string }> {
  const { key, provider } = readKey();
  if (!key) return { configured: false, provider };
  try {
    const { candidates } = await resolveModel(provider, key);
    const deadline = Date.now() + deadlineMs;
    return { configured: true, provider, call: (system, user) => callWithFallback(provider, key, candidates, system, user, deadline) };
  } catch (e: any) { return { configured: true, provider, error: e?.message || String(e) }; }
}
