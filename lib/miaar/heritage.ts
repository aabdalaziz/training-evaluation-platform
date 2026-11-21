// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — م13-ج «لوحة الإرث»: الدفعة التأسيسية miaar-legacy (≈345 بندًا) تُراجَع يدويًا لا تُؤرشف آليًا (قرار المالك م2-ب).
 *  كل بند قديم يحمل legacy_extra.review_flag:
 *    legacy_recheck (لم يُراجَع بعد — كما وُسم في م2-أ) · kept (رُوجع وبقي) · upgraded (طُوِّر — نُسخ إلى دفعة أَثَر وأُرشف الأصل أو بقي) · retired (أُرشف يدويًا)
 *  heritageSummary(db): العدّاد «رُوجع x/y» + جدول بالمستوى والحالة + المكرّرات.
 *  markHeritage(db, ids, outcome, user, note): يضع العلم ويغيّر الحالة حين يلزم (retired → archived) ويسجّل حدث مراجعة.
 *  archiveUnreviewed(db, user, note): «أرشفة ما لم يُراجَع» — بيد المدير فقط وبتأكيد؛ تُعيد العدد. لا تُستدعى آليًا أبدًا.
 */
export const HERITAGE_BATCH = 'miaar-legacy';
export const HERITAGE_OUTCOMES = ['kept', 'upgraded', 'retired'] as const;
export type HeritageOutcome = (typeof HERITAGE_OUTCOMES)[number];
export const HERITAGE_OUTCOME_AR: Record<string, string> = { legacy_recheck: 'لم يُراجَع', kept: 'رُوجع وبقي', upgraded: 'طُوِّر إلى دفعة أَثَر', retired: 'أُرشف بعد المراجعة' };
export const isHeritageOutcome = (v: unknown): v is HeritageOutcome => typeof v === 'string' && (HERITAGE_OUTCOMES as readonly string[]).includes(v);

type Row = { id: string; level: string; skill: string; status: string; legacy_extra: any; reviewed_at: string | null };
export type HeritageSummary = { total: number; reviewed: number; pending: number; by_outcome: Record<string, number>; by_status: Record<string, number>; dupes: number; levels: Array<{ level: string; total: number; reviewed: number; pending: number; approved: number; archived: number }> };
const flagOf = (r: { legacy_extra?: any }): string => (r.legacy_extra && typeof r.legacy_extra === 'object' && typeof r.legacy_extra.review_flag === 'string') ? r.legacy_extra.review_flag : 'legacy_recheck';
export const isReviewed = (r: { legacy_extra?: any }): boolean => flagOf(r) !== 'legacy_recheck';

export async function heritageRows(db: any): Promise<Row[]> {
  const { data } = await db.from('question_bank_items').select('id, level, skill, status, legacy_extra, reviewed_at').eq('legacy_extra->>batch', HERITAGE_BATCH).limit(2000);
  return (data || []) as Row[];
}
export function summarizeHeritage(rows: readonly Row[]): HeritageSummary {
  const by_outcome: Record<string, number> = {}; const by_status: Record<string, number> = {}; const lv = new Map<string, { level: string; total: number; reviewed: number; pending: number; approved: number; archived: number }>();
  let dupes = 0;
  for (const r of rows) {
    const f = flagOf(r); by_outcome[f] = (by_outcome[f] || 0) + 1; by_status[r.status] = (by_status[r.status] || 0) + 1; if (r.legacy_extra?.duplicate_of) dupes += 1;
    const L = lv.get(r.level) || { level: r.level, total: 0, reviewed: 0, pending: 0, approved: 0, archived: 0 }; L.total += 1; if (isReviewed(r)) L.reviewed += 1; else L.pending += 1; if (r.status === 'approved') L.approved += 1; if (r.status === 'archived') L.archived += 1; lv.set(r.level, L);
  }
  const order = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const reviewed = rows.filter(isReviewed).length;
  return { total: rows.length, reviewed, pending: rows.length - reviewed, by_outcome, by_status, dupes, levels: [...lv.values()].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level)) };
}
export async function heritageSummary(db: any): Promise<HeritageSummary> { return summarizeHeritage(await heritageRows(db)); }

/** يضع نتيجة المراجعة على بنود قديمة (حتى 200) — الحالة: retired → archived؛ kept/upgraded لا تغيّر الحالة إلا إذا كان البند مسودّة فتصير approved؟ لا: الاعتماد قرار منفصل (item_status). */
export async function markHeritage(db: any, ids: readonly string[], outcome: HeritageOutcome, user: { id: string }, note: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const list = [...new Set(ids)].slice(0, 200); if (!list.length) return { ok: false, error: 'لا بنود' };
  const { data } = await db.from('question_bank_items').select('id, status, legacy_extra').in('id', list);
  const rows = ((data || []) as any[]).filter((r) => r.legacy_extra?.batch === HERITAGE_BATCH); if (!rows.length) return { ok: false, error: 'لا بنود من الدفعة التأسيسية بين المحدَّد' };
  const now = new Date().toISOString();
  for (const r of rows) {
    const legacy_extra = { ...(r.legacy_extra || {}), review_flag: outcome, reviewed_at: now, reviewed_by: user.id };
    const patch: Record<string, unknown> = { legacy_extra, reviewed_by: user.id, reviewed_at: now, latest_review_note: note || HERITAGE_OUTCOME_AR[outcome], updated_at: now };
    if (outcome === 'retired') patch.status = 'archived';
    const up = await db.from('question_bank_items').update(patch).eq('id', r.id); if (up.error) return { ok: false, error: up.error.message };
  }
  await db.from('question_bank_review_events').insert(rows.map((r) => ({ item_id: r.id, review_status: outcome === 'retired' ? 'archived' : `heritage:${outcome}`, academic_note: note || HERITAGE_OUTCOME_AR[outcome], reviewed_by: user.id })));
  return { ok: true, count: rows.length };
}

/** «أرشفة ما لم يُراجَع» — يدويّ، للمدير، بتأكيد نصّي من الواجهة. يُرجع العدد. */
export async function archiveUnreviewed(db: any, user: { id: string }, note: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const rows = (await heritageRows(db)).filter((r) => !isReviewed(r) && r.status !== 'archived'); if (!rows.length) return { ok: true, count: 0 };
  const now = new Date().toISOString();
  for (const r of rows) {
    const up = await db.from('question_bank_items').update({ status: 'archived', legacy_extra: { ...(r.legacy_extra || {}), review_flag: 'retired', reviewed_at: now, reviewed_by: user.id, bulk: true }, reviewed_by: user.id, reviewed_at: now, latest_review_note: note || 'أرشفة ما لم يُراجَع من التأسيسية', updated_at: now }).eq('id', r.id);
    if (up.error) return { ok: false, error: up.error.message };
  }
  for (let i = 0; i < rows.length; i += 200) await db.from('question_bank_review_events').insert(rows.slice(i, i + 200).map((r) => ({ item_id: r.id, review_status: 'archived', academic_note: note || 'أرشفة ما لم يُراجَع من التأسيسية', reviewed_by: user.id })));
  return { ok: true, count: rows.length };
}
