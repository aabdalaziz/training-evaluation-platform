// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68-(ب) «التقرير التفصيلي» لنتيجة مِعيار — برمز النتيجة (سرّ حامله)
 *  يقرأ بنود الجلسة المحفوظة في التقرير (الرمز · المستوى · المهارة · النتيجة) ويضيف إليها واصف CEFR لكل بند (من البنك) وزمن الإجابة
 *  (من فروق أوقات الإجابات المحفوظة) ثم يجمعها: لكل مهارة · لكل واصف «أستطيع أن…» (صحيح/إجمالي) · ولكل بند.
 *  القاعدة: نصّ السؤال لا يظهر خارج نسخة المصحّح (withText=false للعلن) — الرموز والواصفات فقط. لا بيانات شخصية: الاسم الأول فقط.
 */
import { loadApprovedPool } from './bank';
import { SKILL_NAMES } from './exit';

type Db = any;
export type DetailItem = { no: number; code: string; level: string; skill: string; skill_ar: string; descriptor_code: string | null; descriptor_ar: string | null; result: 'correct' | 'wrong' | 'blank'; result_ar: string; seconds: number | null; text?: string | null };
export type DetailDescriptor = { code: string; skill: string; skill_ar: string; level: string; text_ar: string; text_en: string | null; total: number; correct: number; percent: number; state: 'strong' | 'developing' | 'gap' | 'unmeasured' };
export type DetailSkill = { skill: string; skill_ar: string; total: number; correct: number; blank: number; percent: number | null; avg_seconds: number | null; human?: { percent: number | null; state: string } };
export type Detail = {
  code: string; first_name: string; taken_at: string; level: string | null; exam_mode: string | null; is_exit: boolean; exit_level: string | null; exit_result: string | null;
  totals: { items: number; correct: number; blank: number; percent: number | null; minutes: number | null };
  skills: DetailSkill[]; descriptors: DetailDescriptor[]; items: DetailItem[]; with_text: boolean; note_ar: string;
};
const SK_AR: Record<string, string> = { grammar_vocab: 'القواعد والمفردات', reading: 'القراءة', listening: 'الاستماع', writing: 'الكتابة', speaking: 'التحدّث' };
const skAr = (k: string) => SK_AR[k] || (SKILL_NAMES as any)[k]?.ar || k;
const resOf = (s: string): DetailItem['result'] => (s === 'صحيح' ? 'correct' : s === 'غير صحيح' ? 'wrong' : 'blank');
const RES_AR: Record<DetailItem['result'], string> = { correct: 'صحيح', wrong: 'غير صحيح', blank: 'لم يُجب' };
const pct = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : null);

/** الزمن لكل بند من فروق أوقات الإجابة (أوّل بند من بداية الجلسة) — تقريبيّ وصادق: null حين لا يُعرف */
export function secondsPerItem(order: readonly string[], answers: readonly { question_id: string; submitted_at: string }[], startedAt: string | null): Map<string, number> {
  const out = new Map<string, number>(); const sorted = [...answers].filter((a) => a.submitted_at).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  let prev = startedAt ? Date.parse(startedAt) : NaN;
  for (const a of sorted) { const t = Date.parse(a.submitted_at); if (Number.isFinite(prev) && Number.isFinite(t) && t >= prev) { const s = Math.round((t - prev) / 1000); if (s <= 1800) out.set(a.question_id, s); } prev = t; }
  void order; return out;
}
export function stateOf(p: number): DetailDescriptor['state'] { return p >= 75 ? 'strong' : p >= 50 ? 'developing' : 'gap'; }

export async function detailByCode(db: Db, code: string, opts: { withText?: boolean } = {}): Promise<Detail | null> {
  const { data } = await db.from('placement_reports').select('id, submission_id, candidate_email, created_at, report, access_code').eq('access_code', code).maybeSingle();
  if (!data?.report) return null; const r = data.report as any; const items: any[] = Array.isArray(r.بنود_الجلسة) ? r.بنود_الجلسة : [];
  const first = String(r?.بيانات_المتقدم?.الاسم || '').split(/\s+/)[0] || '—';
  const [pool, sess, ans] = await Promise.all([
    loadApprovedPool(db).catch(() => [] as any[]),
    data.submission_id ? db.from('placement_secure_sessions').select('id, started_at, finished_at, exam_mode').eq('id', data.submission_id).maybeSingle().then((x: any) => x?.data || null, () => null) : Promise.resolve(null),
    data.submission_id ? db.from('placement_secure_answers').select('question_id, submitted_at').eq('session_id', data.submission_id).limit(500).then((x: any) => (Array.isArray(x?.data) ? x.data : []), () => []) : Promise.resolve([]),
  ]);
  const byCode = new Map<string, any>((pool as any[]).map((p) => [p.code, p]));
  const descCodes = [...new Set(items.map((it) => byCode.get(String(it.الرمز))?.descriptor).filter(Boolean))] as string[];
  const descRows: any[] = descCodes.length ? await db.from('miaar_descriptors').select('code, level, mode, text_ar, text_en').in('code', descCodes).limit(500).then((x: any) => (Array.isArray(x?.data) ? x.data : []), () => []) : [];
  const descMap = new Map<string, any>(descRows.map((d) => [d.code, d]));
  const secs = secondsPerItem(items.map((it) => String(it.الرمز)), ans, sess?.started_at || null);
  const out: DetailItem[] = items.map((it, i) => { const c = String(it.الرمز); const p = byCode.get(c); const d = p?.descriptor ? descMap.get(p.descriptor) : null; const res = resOf(String(it.النتيجة || '')); return { no: i + 1, code: c, level: String(it.المستوى || p?.level || ''), skill: String(it.المهارة || p?.skill || ''), skill_ar: skAr(String(it.المهارة || p?.skill || '')), descriptor_code: p?.descriptor || null, descriptor_ar: d?.text_ar || null, result: res, result_ar: RES_AR[res], seconds: secs.get(c) ?? null, ...(opts.withText ? { text: String(it.النص || p?.questionText || '').slice(0, 180) || null } : {}) }; });
  const skills: DetailSkill[] = []; const bySk = new Map<string, DetailItem[]>(); for (const it of out) { if (!bySk.has(it.skill)) bySk.set(it.skill, []); bySk.get(it.skill)!.push(it); }
  for (const [skill, its] of bySk) { const correct = its.filter((x) => x.result === 'correct').length; const blank = its.filter((x) => x.result === 'blank').length; const ss = its.map((x) => x.seconds).filter((x): x is number => x !== null); skills.push({ skill, skill_ar: skAr(skill), total: its.length, correct, blank, percent: pct(correct, its.length - blank), avg_seconds: ss.length ? Math.round(ss.reduce((a, b) => a + b, 0) / ss.length) : null }); }
  const ex = r.exit && typeof r.exit === 'object' ? r.exit : null;
  if (ex?.المهارات) for (const k of ['writing', 'speaking']) { const h = ex.المهارات[k]; if (h) skills.push({ skill: k, skill_ar: skAr(k), total: 0, correct: 0, blank: 0, percent: typeof h.النسبة === 'number' ? h.النسبة : null, avg_seconds: null, human: { percent: typeof h.النسبة === 'number' ? h.النسبة : null, state: String(h.الحالة || '') } }); }
  const byD = new Map<string, DetailItem[]>(); for (const it of out) if (it.descriptor_code) { if (!byD.has(it.descriptor_code)) byD.set(it.descriptor_code, []); byD.get(it.descriptor_code)!.push(it); }
  /* الواصف يُقاس من البنود التي أُجيب عنها فقط — البند الذي لم يصل إليه المتقدّم (انتهى الاختبار قبله) لا يُحسب «فجوة» بل «لم يُقَس» */
  const descriptors: DetailDescriptor[] = [...byD.entries()].map(([dc, its]) => { const d = descMap.get(dc); const tried = its.filter((x) => x.result !== 'blank'); const correct = tried.filter((x) => x.result === 'correct').length; const p = tried.length ? (pct(correct, tried.length) ?? 0) : null; return { code: dc, skill: its[0].skill, skill_ar: its[0].skill_ar, level: String(d?.level || its[0].level), text_ar: String(d?.text_ar || dc), text_en: d?.text_en || null, total: tried.length, correct, percent: p ?? 0, state: p === null ? 'unmeasured' as const : stateOf(p) }; }).sort((a, b) => (a.state === 'unmeasured' ? 1 : 0) - (b.state === 'unmeasured' ? 1 : 0) || a.skill.localeCompare(b.skill) || a.percent - b.percent);
  const correct = out.filter((x) => x.result === 'correct').length; const blank = out.filter((x) => x.result === 'blank').length;
  const minutes = sess?.started_at && sess?.finished_at ? Math.max(1, Math.round((Date.parse(sess.finished_at) - Date.parse(sess.started_at)) / 60000)) : null;
  return {
    code, first_name: first, taken_at: String(data.created_at), level: String(r.المستوى_العام || ex?.المستوى || '') || null, exam_mode: String(r.نمط_الاختبار || sess?.exam_mode || '') || null,
    is_exit: !!ex, exit_level: ex?.المستوى || null, exit_result: ex?.النتيجة || null,
    totals: { items: out.length, correct, blank, percent: pct(correct, out.length - blank), minutes }, /* النسبة من البنود المُجابة — كما في التقرير الرسمي؛ غير المُجاب يُعرض عددًا */
    skills, descriptors, items: out, with_text: !!opts.withText,
    note_ar: opts.withText ? 'نسخة المصحّح: تحوي نصوص البنود — لا تُسلَّم للمتقدّم ولا تُنشر.' : 'الواصفات من الإطار الأوروبي المرجعي (CEFR) «أستطيع أن…». رموز البنود للمراجعة مع المشرف — نصوص الأسئلة لا تظهر هنا حمايةً للبنك.',
  };
}
