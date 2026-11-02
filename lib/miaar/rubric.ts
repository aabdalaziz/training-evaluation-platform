// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «سُلّم التقدير» — م4-أ «صوتك وقلمك» (منطق صافٍ بلا قاعدة بيانات)
 *  أربعة أبعاد لكل مهارة إنتاجية، درجة 0–5 لكل بُعد نسبةً إلى مستوى المهمة (لا إلى سلّم مطلق):
 *   كتابة: المدى · الدقة · التماسك والتنظيم · إنجاز المهمة      تحدّث: المدى · الدقة · الطلاقة والنطق · إنجاز المهمة
 *  الحكم: متوسّط الأبعاد (إنجاز المهمة بوزن 1.5) → فوق المستوى / في المستوى / دونه / دونه بوضوح → مستوى مقدَّر.
 *  إنجاز المهمة = 0 يعني «لم يؤدِّ المهمة» مهما كانت بقية الدرجات.
 *  هنا أيضًا: حدود المهام الافتراضية بحسب المستوى · عدّاد الكلمات العربية · تحقّق شكل المهمة قبل الحفظ · تحقّق JSON المصحّح الآلي (يُستعمل في م4-ج).
 *  القاعدة الثابتة: الآلة تقترح درجة، والإنسان يعتمدها.
 */
import { LEVELS, FLOOR_LEVEL, isBankLevel } from './registry';
import type { BankLevel, ProductiveSkill } from './registry';

export const RUBRIC_DIMENSIONS: Record<ProductiveSkill, readonly string[]> = { writing: ['range', 'accuracy', 'coherence', 'task'], speaking: ['range', 'accuracy', 'fluency', 'task'] };
export const DIMENSION_AR: Record<string, string> = { range: 'المدى اللغوي', accuracy: 'الدقة اللغوية', coherence: 'التماسك والتنظيم', fluency: 'الطلاقة والنطق', task: 'إنجاز المهمة' };
export const TASK_WEIGHT = 1.5;
export type RubricScores = Record<string, number>;
export type Verdict = 'above' | 'at' | 'below' | 'well_below' | 'no_task';
export const VERDICT_AR: Record<Verdict, string> = { above: 'يتجاوز مستوى المهمة', at: 'في مستوى المهمة', below: 'دون مستوى المهمة', well_below: 'دون مستوى المهمة بوضوح', no_task: 'لم يؤدِّ المهمة' };

/** حدود المهام الافتراضية (يمكن للمهمة أن تضبطها في task) */
export const WRITING_LIMITS: Record<BankLevel, { min_words: number; max_words: number; time_seconds: number }> = {
  PRE_A1: { min_words: 1, max_words: 10, time_seconds: 300 }, A1: { min_words: 20, max_words: 40, time_seconds: 480 }, A2: { min_words: 40, max_words: 70, time_seconds: 600 },
  B1: { min_words: 80, max_words: 130, time_seconds: 720 }, B2: { min_words: 150, max_words: 220, time_seconds: 900 }, C1: { min_words: 220, max_words: 300, time_seconds: 1080 }, C2: { min_words: 280, max_words: 380, time_seconds: 1200 },
};
export const SPEAKING_LIMITS: Record<BankLevel, { min_seconds: number; max_seconds: number; prep_seconds: number; retakes: number }> = {
  PRE_A1: { min_seconds: 5, max_seconds: 20, prep_seconds: 15, retakes: 1 }, A1: { min_seconds: 10, max_seconds: 45, prep_seconds: 30, retakes: 1 }, A2: { min_seconds: 15, max_seconds: 60, prep_seconds: 30, retakes: 1 },
  B1: { min_seconds: 25, max_seconds: 75, prep_seconds: 30, retakes: 1 }, B2: { min_seconds: 35, max_seconds: 90, prep_seconds: 45, retakes: 1 }, C1: { min_seconds: 45, max_seconds: 90, prep_seconds: 60, retakes: 1 }, C2: { min_seconds: 45, max_seconds: 90, prep_seconds: 60, retakes: 1 },
};
export const MAX_RECORD_SECONDS = 90; /* سقف «القناة الواحدة» (MEDIA_LIMITS) */

export type TaskSpec = {
  genre: string; prompt_en: string | null; tips_ar: string[]; sample_ar: string | null;
  min_words?: number; max_words?: number; time_seconds?: number;
  min_seconds?: number; max_seconds?: number; prep_seconds?: number; retakes?: number;
};
const int = (v: unknown, lo: number, hi: number): number | null => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.floor(n) : null; };
const strOf = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** تحقّق المهمة قبل الحفظ: يعيد المهمة المنظَّفة أو قائمة أخطاء عربية (لا يُحفظ شيء ناقص) */
export function validateTask(skill: ProductiveSkill, level: string, raw: unknown): { task: TaskSpec | null; errors: string[] } {
  const errors: string[] = []; const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (!isBankLevel(level)) errors.push('المستوى غير صالح');
  const genre = strOf(r.genre, 40).toLowerCase(); if (!/^[a-z_]{2,40}$/.test(genre)) errors.push('نوع المهمة (genre) مطلوب بحروف لاتينية صغيرة وشرطة سفلية فقط');
  const tips = Array.isArray(r.tips_ar) ? (r.tips_ar as unknown[]).map((t) => strOf(t, 120)).filter(Boolean).slice(0, 4) : [];
  const sample = strOf(r.sample_ar, 2000) || null; const prompt_en = strOf(r.prompt_en, 300) || null;
  const task: TaskSpec = { genre, prompt_en, tips_ar: tips, sample_ar: sample };
  const lv = (isBankLevel(level) ? level : 'A1') as BankLevel;
  if (skill === 'writing') {
    const d = WRITING_LIMITS[lv]; const min_words = int(r.min_words, 1, 600) ?? d.min_words; const max_words = int(r.max_words, 1, 800) ?? d.max_words; const time_seconds = int(r.time_seconds, 60, 3600) ?? d.time_seconds;
    if (min_words > max_words) errors.push('الحد الأدنى للكلمات أكبر من الأقصى');
    Object.assign(task, { min_words, max_words, time_seconds });
  } else {
    const d = SPEAKING_LIMITS[lv]; const min_seconds = int(r.min_seconds, 3, MAX_RECORD_SECONDS) ?? d.min_seconds; const max_seconds = int(r.max_seconds, 5, MAX_RECORD_SECONDS) ?? d.max_seconds;
    const prep_seconds = int(r.prep_seconds, 0, 120) ?? d.prep_seconds; const retakes = int(r.retakes, 0, 2) ?? d.retakes;
    if (min_seconds > max_seconds) errors.push('الحد الأدنى للثواني أكبر من الأقصى'); if (max_seconds > MAX_RECORD_SECONDS) errors.push(`سقف التسجيل ${MAX_RECORD_SECONDS} ثانية`);
    Object.assign(task, { min_seconds, max_seconds, prep_seconds, retakes });
  }
  return { task: errors.length ? null : task, errors };
}

/** عدّاد كلمات عربي: يتجاهل التشكيل والترقيم، ويعدّ الكلمة المركّبة بواصلة كلمة واحدة */
export function countWords(text: string): number {
  const t = (text || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
  return t ? t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0;
}
/** هل طول الإجابة ضمن حدود المهمة؟ (للعدّاد أمام المتقدّم ولتنبيه المصحّح) */
export function lengthStatus(skill: ProductiveSkill, task: TaskSpec, measure: number): 'short' | 'ok' | 'long' {
  const lo = skill === 'writing' ? task.min_words || 0 : task.min_seconds || 0; const hi = skill === 'writing' ? task.max_words || Infinity : task.max_seconds || Infinity;
  return measure < lo ? 'short' : measure > hi ? 'long' : 'ok';
}

/** تحقّق الدرجات: كل بُعد موجود وعدد صحيح 0–5 */
export function validateScores(skill: ProductiveSkill, raw: unknown): RubricScores | null {
  if (!raw || typeof raw !== 'object') return null; const r = raw as Record<string, unknown>; const out: RubricScores = {};
  for (const d of RUBRIC_DIMENSIONS[skill]) { const n = Number(r[d]); if (!Number.isInteger(n) || n < 0 || n > 5) return null; out[d] = n; }
  return out;
}
/** المتوسّط الموزون (إنجاز المهمة ×1.5) بمنزلتين */
export function weightedMean(skill: ProductiveSkill, scores: RubricScores): number {
  let sum = 0, w = 0; for (const d of RUBRIC_DIMENSIONS[skill]) { const weight = d === 'task' ? TASK_WEIGHT : 1; sum += scores[d] * weight; w += weight; }
  return Math.round((sum / w) * 100) / 100;
}
const shift = (level: BankLevel, by: number): BankLevel => {
  const ladder: BankLevel[] = [FLOOR_LEVEL, ...LEVELS]; const i = ladder.indexOf(level); const j = Math.max(0, Math.min(ladder.length - 1, i + by)); return ladder[j];
};
/** الحكم على مهمة واحدة: من درجاتها ومستوى المهمة إلى مستوى مقدَّر */
export function judge(skill: ProductiveSkill, taskLevel: BankLevel, scores: RubricScores): { mean: number; verdict: Verdict; estimated: BankLevel; verdict_ar: string } {
  const mean = weightedMean(skill, scores);
  let verdict: Verdict; let estimated: BankLevel;
  if (scores.task === 0) { verdict = 'no_task'; estimated = shift(taskLevel, -2); }
  else if (mean >= 4.5) { verdict = 'above'; estimated = shift(taskLevel, 1); }
  else if (mean >= 2.5) { verdict = 'at'; estimated = taskLevel; }
  else if (mean >= 1.5) { verdict = 'below'; estimated = shift(taskLevel, -1); }
  else { verdict = 'well_below'; estimated = shift(taskLevel, -2); }
  return { mean, verdict, estimated, verdict_ar: VERDICT_AR[verdict] };
}

/** شكل تقدير المصحّح الآلي (م4-ج): درجات + شواهد مقتبسة + «ما يرفعه درجة» — يُرفض أي شيء ناقص أو زائد */
export type AiRating = { scores: RubricScores; evidence: string[]; next_step_ar: string; estimated: BankLevel; confidence: number };
export function parseAiRating(skill: ProductiveSkill, taskLevel: BankLevel, raw: unknown): AiRating | null {
  let o: unknown = raw; if (typeof raw === 'string') { try { o = JSON.parse(raw.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim()); } catch { return null; } }
  if (!o || typeof o !== 'object') return null; const r = o as Record<string, unknown>;
  const scores = validateScores(skill, r.scores); if (!scores) return null;
  const evidence = Array.isArray(r.evidence) ? (r.evidence as unknown[]).map((e) => strOf(e, 240)).filter(Boolean).slice(0, 3) : [];
  if (evidence.length < 1) return null;
  const next_step_ar = strOf(r.next_step_ar, 400); if (next_step_ar.length < 8) return null;
  const confRaw = Number(r.confidence); const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0.5;
  return { scores, evidence, next_step_ar, estimated: judge(skill, taskLevel, scores).estimated, confidence };
}

/** كابا مرجّح (تربيعي) بين مصحّحَين على سلّم 0–5 — رقم «اتفاق المصحّحَين» في الميزان (م4-ج) */
export function weightedKappa(a: readonly number[], b: readonly number[], k = 6): number | null {
  const n = Math.min(a.length, b.length); if (n < 2) return null;
  const O: number[][] = Array.from({ length: k }, () => Array(k).fill(0)); const ra = Array(k).fill(0); const rb = Array(k).fill(0);
  for (let i = 0; i < n; i += 1) { const x = Math.max(0, Math.min(k - 1, Math.round(a[i]))); const y = Math.max(0, Math.min(k - 1, Math.round(b[i]))); O[x][y] += 1; ra[x] += 1; rb[y] += 1; }
  let num = 0, den = 0;
  for (let i = 0; i < k; i += 1) for (let j = 0; j < k; j += 1) { const w = ((i - j) ** 2) / ((k - 1) ** 2); num += w * O[i][j]; den += w * (ra[i] * rb[j]) / n; }
  if (den === 0) return 1; return Math.round((1 - num / den) * 1000) / 1000;
}
