/**
 * P49-هـ — «نبض البيئة التدريبية»: حساب خالص (بلا شبكة) لمتوسّطات أقسام الاستبيان الختامي
 *  عبر الدفعات، وأدنى البنود، واتجاه التغيّر بين آخر دفعتين، و«بند الأسبوع» (أضعف بند في آخر دفعة).
 *  قواعد: k ≥ 5 استجابة لكلّ رقم يُعرض (لا شيء دون ذلك) · لا أسماء · ليكرت فقط (NPS نصّ ولا يدخل المتوسّط)
 *  «الدفعة» = الشعبة إن وُجدت وإلا البرنامج — مرتّبة بآخر إرسال.
 *  يعمل على الإجابات القديمة أيضًا لأن مفاتيح end_q01…q17 لم تتغيّر في P49-د.
 */
import { END_SURVEY_SECTIONS_AR } from './links';

export const K_MIN = 5;
export const PULSE_RATING_KINDS = ['LIKERT_5', 'RATING_5', 'STARS'];

export type PulseEval = { id: string; program_id: string; classroom_id?: string | null; submitted_at?: string | null; created_at?: string | null };
export type PulseAnswer = { evaluation_id: string; question_id: string; rating_value: number | null };
export type PulseQ = { id: string; kind: string; question_key?: string | null; text_ar: string; text_en?: string | null; section_ar?: string | null; section_en?: string | null };

export type PulseItem = { key: string; text_ar: string; text_en: string | null; section: string; mean: number; n: number };
export type PulseSection = { name: string; name_en: string | null; mean: number; n: number; items: PulseItem[] };
export type PulseCohort = { key: string; program_id: string; classroom_id: string | null; n: number; mean: number; last: string; sections: Record<string, { mean: number; n: number }> };
export type PulseTrend = { section: string; last: number; prev: number; delta: number };
export type Pulse = {
  n: number; enough: boolean; sections: PulseSection[]; weakest: PulseItem[]; strongest: PulseItem[];
  cohorts: PulseCohort[]; trend: PulseTrend[]; itemOfWeek: (PulseItem & { cohort: PulseCohort }) | null;
};

const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const r2 = (x: number) => Math.round(x * 100) / 100;
export const cohortKey = (e: PulseEval) => e.classroom_id || e.program_id;
const when = (e: PulseEval) => e.submitted_at || e.created_at || '';

/** ترتيب الأقسام كما في رحلة المتدرّب؛ الأقسام غير المعروفة (قوالب خاصة) تأتي بعدها بترتيب الظهور */
export function sectionOrder(name: string): number { const i = END_SURVEY_SECTIONS_AR.indexOf(name); return i < 0 ? 100 : i; }

export function tone(m: number): 'ok' | 'good' | 'warn' | 'bad' { return m >= 4.2 ? 'ok' : m >= 3.7 ? 'good' : m >= 3 ? 'warn' : 'bad'; }
export const TONE_AR: Record<ReturnType<typeof tone>, string> = { ok: 'ممتاز', good: 'جيد', warn: 'يحتاج متابعة', bad: 'أولوية عاجلة' };

export function computePulse(evals: PulseEval[], answers: PulseAnswer[], questions: PulseQ[], opts: { programId?: string } = {}): Pulse {
  const evs = opts.programId ? evals.filter(e => e.program_id === opts.programId) : evals.slice();
  const evIds = new Set(evs.map(e => e.id));
  const qm = new Map(questions.map(q => [q.id, q]));
  const ratingQ = (q: PulseQ | undefined) => !!q && PULSE_RATING_KINDS.includes(String(q.kind).toUpperCase());
  const rows = answers.filter(a => evIds.has(a.evaluation_id) && a.rating_value != null && Number(a.rating_value) > 0 && ratingQ(qm.get(a.question_id)));

  // بنود (بالمفتاح — يجمع النصّ القديم والجديد للبند نفسه)
  const byKey = new Map<string, { q: PulseQ; vals: number[] }>();
  for (const a of rows) { const q = qm.get(a.question_id)!; const key = q.question_key || q.id; const slot = byKey.get(key) || { q, vals: [] }; slot.vals.push(Number(a.rating_value)); byKey.set(key, slot); }
  const items: PulseItem[] = Array.from(byKey.entries()).map(([key, s]) => ({ key, text_ar: s.q.text_ar, text_en: s.q.text_en || null, section: s.q.section_ar || 'عام', mean: r2(mean(s.vals)), n: s.vals.length }));

  // أقسام
  const secMap = new Map<string, { name_en: string | null; vals: number[]; items: PulseItem[] }>();
  for (const it of items) { const s = secMap.get(it.section) || { name_en: null, vals: [], items: [] }; s.items.push(it); secMap.set(it.section, s); }
  for (const a of rows) { const q = qm.get(a.question_id)!; const s = secMap.get(q.section_ar || 'عام'); if (s) { s.vals.push(Number(a.rating_value)); if (!s.name_en && q.section_en) s.name_en = q.section_en; } }
  const sections: PulseSection[] = Array.from(secMap.entries()).map(([name, s]) => ({ name, name_en: s.name_en, mean: r2(mean(s.vals)), n: s.vals.length, items: s.items.sort((a, b) => a.mean - b.mean) }))
    .sort((a, b) => sectionOrder(a.name) - sectionOrder(b.name) || a.name.localeCompare(b.name, 'ar'));

  // دفعات
  const evByCohort = new Map<string, PulseEval[]>();
  for (const e of evs) { const k = cohortKey(e); (evByCohort.get(k) || evByCohort.set(k, []).get(k)!).push(e); }
  const ansByEv = new Map<string, PulseAnswer[]>();
  for (const a of rows) (ansByEv.get(a.evaluation_id) || ansByEv.set(a.evaluation_id, []).get(a.evaluation_id)!).push(a);
  const cohorts: PulseCohort[] = Array.from(evByCohort.entries()).map(([key, list]) => {
    const vals: number[] = []; const secVals = new Map<string, number[]>();
    for (const e of list) for (const a of ansByEv.get(e.id) || []) { const v = Number(a.rating_value); vals.push(v); const sec = qm.get(a.question_id)?.section_ar || 'عام'; (secVals.get(sec) || secVals.set(sec, []).get(sec)!).push(v); }
    const sectionsRec: Record<string, { mean: number; n: number }> = {}; secVals.forEach((v, s) => { sectionsRec[s] = { mean: r2(mean(v)), n: v.length }; });
    return { key, program_id: list[0].program_id, classroom_id: list[0].classroom_id || null, n: list.length, mean: r2(mean(vals)), last: list.map(when).sort().slice(-1)[0] || '', sections: sectionsRec };
  }).sort((a, b) => (b.last || '').localeCompare(a.last || ''));

  // اتجاه: آخر دفعتين تحقّقان k ≥ 5
  const big = cohorts.filter(c => c.n >= K_MIN); const trend: PulseTrend[] = [];
  if (big.length >= 2) {
    const [last, prev] = big;
    for (const s of sections) { const a = last.sections[s.name], b = prev.sections[s.name]; if (a && b) trend.push({ section: s.name, last: a.mean, prev: b.mean, delta: r2(a.mean - b.mean) }); }
  }

  // بند الأسبوع: أضعف بند في آخر دفعة k ≥ 5 (بندًا بندًا داخل الدفعة)
  let itemOfWeek: Pulse['itemOfWeek'] = null;
  if (big[0]) {
    const c = big[0]; const ids = new Set((evByCohort.get(c.key) || []).map(e => e.id)); const byK = new Map<string, { q: PulseQ; vals: number[] }>();
    for (const a of rows) if (ids.has(a.evaluation_id)) { const q = qm.get(a.question_id)!; const k = q.question_key || q.id; const s = byK.get(k) || { q, vals: [] }; s.vals.push(Number(a.rating_value)); byK.set(k, s); }
    const cand = Array.from(byK.entries()).map(([key, s]) => ({ key, text_ar: s.q.text_ar, text_en: s.q.text_en || null, section: s.q.section_ar || 'عام', mean: r2(mean(s.vals)), n: s.vals.length })).filter(x => x.n >= K_MIN).sort((a, b) => a.mean - b.mean || a.key.localeCompare(b.key));
    if (cand[0]) itemOfWeek = { ...cand[0], cohort: c };
  }

  const n = evs.length; const enough = n >= K_MIN;
  const ranked = items.filter(i => i.n >= K_MIN).sort((a, b) => a.mean - b.mean || a.key.localeCompare(b.key));
  return enough
    ? { n, enough, sections, weakest: ranked.slice(0, 3), strongest: ranked.slice(-3).reverse(), cohorts, trend, itemOfWeek }
    : { n, enough, sections: [], weakest: [], strongest: [], cohorts: [], trend: [], itemOfWeek: null };
}

/** نصّ «بند الأسبوع» الذي يُحفظ كمهمّة تحسين (لا أسماء — بند ومتوسّط وعدد فقط) */
export function actionDraft(p: Pulse) {
  if (!p.itemOfWeek) return null; const i = p.itemOfWeek;
  return { program_id: i.cohort.program_id, classroom_id: i.cohort.classroom_id, cohort_key: i.cohort.key, question_key: i.key, question_text: i.text_ar, section: i.section, mean: i.mean, n: i.n };
}
