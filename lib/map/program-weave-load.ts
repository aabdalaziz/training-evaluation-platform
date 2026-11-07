// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P61 «نسيج البرنامج» — طبقة الخادم
 *  • المنسوبون: التسجيلات المعتمدة/المنسَّبة/المكتملة للبرنامج (portal_enrollments.program_id) — سقف 1000 — ودفعة كل واحد = سنة قبوله
 *  • النطاق: program:<pid> + جلساته (attendance_sessions · portal_sessions) + مهامّه (portal_missions)
 *  • قراءة واحدة من portal_map_threads (kept فقط) لمنسوبيه → programWeave() — لا «لأن…» تُقرأ هنا أصلًا (نعدّ ولا نقتبس)
 *  • ذاكرة قصيرة 10 دقائق لكل برنامج (fresh=true يتجاوزها) — لا يُخزَّن النسيج في قاعدة البيانات
 *  • للمتعلّم: أعداد الناسجين على مفتاح البرنامج نفسه (بلا هو) → «خيطك جزء من نسيج برنامج …» (k ≥ 5)
 */
import { programWeave, scopeKeys, cohortOf, programPeersOf, PROGRAM_WEAVE_LIMITS } from './program-weave';
import type { ProgramWeave, ThreadRow, RosterRow } from './program-weave';

type Db = any;
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
const ENROLLED = ['approved', 'placed', 'active', 'completed'];

export async function programRoster(db: Db, programId: string): Promise<RosterRow[]> {
  const rows = await safe<any[]>(db.from('portal_enrollments').select('email,status,placed_at,created_at').eq('program_id', programId).in('status', ENROLLED).limit(PROGRAM_WEAVE_LIMITS.maxRoster), []);
  const seen = new Map<string, RosterRow>();
  for (const r of rows) { const email = lower(r.email); if (!email || seen.has(email)) continue; seen.set(email, { email, cohort: cohortOf(r.placed_at || null, r.created_at || null) }); }
  return [...seen.values()];
}
async function programScopeKeys(db: Db, programId: string): Promise<Set<string>> {
  const [a, s, m] = await Promise.all([
    safe<any[]>(db.from('attendance_sessions').select('id').eq('program_id', programId).limit(500), []),
    safe<any[]>(db.from('portal_sessions').select('id').eq('program_id', programId).limit(500), []),
    safe<any[]>(db.from('portal_missions').select('id').eq('program_id', programId).limit(500), []),
  ]);
  return scopeKeys(programId, [...a, ...s].map((x) => String(x.id)), m.map((x) => String(x.id)));
}
async function keptRows(db: Db, emails: string[]): Promise<ThreadRow[]> {
  const out: ThreadRow[] = [];
  for (let i = 0; i < emails.length; i += 200) { /* دفعات حتى لا يطول عنوان الطلب */
    const part = emails.slice(i, i + 200); if (!part.length) break;
    const rows = await safe<any[]>(db.from('portal_map_threads').select('email,from_key,to_key,rule,decided_at').in('email', part).eq('status', 'kept').limit(PROGRAM_WEAVE_LIMITS.maxThreads), []);
    for (const r of rows) out.push({ email: lower(r.email), from_key: String(r.from_key), to_key: String(r.to_key), rule: String(r.rule || 'manual'), decided_at: r.decided_at ? String(r.decided_at) : null });
  }
  return out;
}

const CACHE = new Map<string, { at: number; weave: ProgramWeave }>();
/** نسيج برنامج واحد — program: {id, name_ar, end_date} */
export async function loadProgramWeave(db: Db, program: { id: string | number; name_ar?: string | null; end_date?: string | null }, opts: { now?: Date; fresh?: boolean } = {}): Promise<ProgramWeave> {
  const pid = String(program.id); const now = opts.now || new Date(); const hit = CACHE.get(pid);
  if (!opts.fresh && hit && now.getTime() - hit.at < PROGRAM_WEAVE_LIMITS.ttlMs) return hit.weave;
  const [roster, keys] = await Promise.all([programRoster(db, pid), programScopeKeys(db, pid)]);
  const rows = roster.length ? await keptRows(db, roster.map((r) => r.email)) : [];
  const weave = programWeave(rows, roster, { program_id: pid, name_ar: String(program.name_ar || ''), keys, end_date: program.end_date ? String(program.end_date) : null });
  CACHE.set(pid, { at: now.getTime(), weave }); if (CACHE.size > 100) CACHE.delete(CACHE.keys().next().value as string);
  return weave;
}
export const forgetProgramWeave = (programId?: string) => { if (programId) CACHE.delete(String(programId)); else CACHE.clear(); };

/** للمتعلّم: لكل خيط مبقى يمسّ برنامجًا — كم ناسجًا غيره على مفتاح البرنامج نفسه (k ≥ 5) */
export async function programPeersForLearner(db: Db, email: string, mine: Array<{ from: string; to: string }>, titles: Record<string, string>): Promise<Record<string, { n: number; program_ar: string }>> {
  const keys = [...new Set(mine.flatMap((t) => [t.from, t.to]).filter((k) => k.startsWith('program:')))].slice(0, 20); if (!keys.length) return {};
  const [a, b] = await Promise.all([
    safe<any[]>(db.from('portal_map_threads').select('email,from_key').in('from_key', keys).eq('status', 'kept').limit(5000), []),
    safe<any[]>(db.from('portal_map_threads').select('email,to_key').in('to_key', keys).eq('status', 'kept').limit(5000), []),
  ]);
  const me = lower(email); const by = new Map<string, Set<string>>();
  for (const r of a) if (lower(r.email) !== me) (by.get(String(r.from_key)) || by.set(String(r.from_key), new Set()).get(String(r.from_key))!).add(lower(r.email));
  for (const r of b) if (lower(r.email) !== me) (by.get(String(r.to_key)) || by.set(String(r.to_key), new Set()).get(String(r.to_key))!).add(lower(r.email));
  const counts: Record<string, number> = {}; for (const [k, s] of by) counts[k] = s.size;
  return programPeersOf(mine, counts, titles);
}
