// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ» ق1 — طبقة المحتوى الصرفة (بلا قاعدة): شكل الحلقة · البطاقة · المِران · حزمة الاستيراد والتحقّق منها · التصحيح.
 *  الحلقة (iqra_lessons.content) خمس محطّات: مدخل → نصّ (حوار/سرد) → بطاقات المفردات → قاعدة/ملاحظة → مِران (3 أنواع) → «أثر الحلقة».
 *  المِران يُخزَّن في بنك مِعيار (question_bank_items.source_kind='iqra') كي يُراجَع بالأدوات نفسها، ولا يدخل سحب الاختبارات الرسمية.
 *   - mcq      : options [{id:'a'..'d', text}] · مفتاح correct_option_id · stimulus.explanation_ar
 *   - matching : stimulus.pairs [{l, r}] · مفتاح accepted.pairs [[l, r]…]
 *   - ordering : stimulus.words [..] · مفتاح accepted.order [..]
 */
import { IQRA_LIMITS, isIqraLevel, type IqraLevel } from './registry';

export type TextKind = 'dialogue' | 'narrative';
export type LessonContent = {
  intro_ar: string;
  text?: { kind: TextKind; body: string; audio_path?: string | null } | null;
  grammar?: { title_ar: string; explanation_ar: string; examples: string[] } | null;
  speaking?: { prompt_ar: string; guide_ar: string } | null;
  writing?: { topic_ar: string; instructions_ar: string } | null;
  closing_ar?: string | null;
};
export type Card = { word_ar: string; pos?: string | null; gloss_ar: string; example_ar?: string; audio_path?: string | null; image_path?: string | null };
export type ExerciseKind = 'mcq' | 'matching' | 'ordering';
export type Exercise =
  | { kind: 'mcq'; prompt_ar: string; options: string[]; correct: number; explanation_ar?: string; skill?: string }
  | { kind: 'matching'; prompt_ar: string; pairs: { l: string; r: string }[]; explanation_ar?: string; skill?: string }
  | { kind: 'ordering'; prompt_ar: string; words: string[]; order: string[]; explanation_ar?: string; skill?: string };
export type PackUnit = { code: string; level: IqraLevel; idx: number; title_ar: string; title_en?: string; focus_ar?: string; domains?: string[] };
export type PackLesson = { code: string; unit_code: string; idx: number; title_ar: string; goal_ar?: string; minutes?: number; content: LessonContent; cards: Card[]; exercises: Exercise[] };
export type Pack = { version: 'iqra-pack-1'; source: string; units?: PackUnit[]; lessons: PackLesson[] };

export const UNIT_CODE_RE = /^(PRE_A1|A1|A2|B1|B2|C1|C2)-U\d{2}$/;
export const LESSON_CODE_RE = /^(PRE_A1|A1|A2|B1|B2|C1|C2)-U\d{2}-L\d{2}$/;
export const lessonCode = (unit: string, idx: number) => `${unit}-L${String(idx).padStart(2, '0')}`;
export const itemCode = (lesson: string, i: number) => `IQ-${lesson}-${String(i).padStart(2, '0')}`;
export const unitLevel = (code: string): IqraLevel | null => { const m = code.match(UNIT_CODE_RE); return m && isIqraLevel(m[1]) ? m[1] : null; };

const S = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const P = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '');
const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
const uniq = <T,>(a: T[]) => [...new Set(a)];

/* ---------- التحقّق ---------- */
export type Problem = { at: string; msg: string };

export function normalizeContent(c: unknown, at: string, problems: Problem[]): LessonContent {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, any>;
  const intro_ar = P(o.intro_ar, 600); if (!intro_ar) problems.push({ at, msg: 'مدخل الحلقة (intro_ar) مطلوب' });
  const out: LessonContent = { intro_ar };
  if (o.text && typeof o.text === 'object') {
    const kind: TextKind = o.text.kind === 'narrative' ? 'narrative' : 'dialogue'; const body = P(o.text.body, 3000);
    if (body) out.text = { kind, body, audio_path: typeof o.text.audio_path === 'string' ? o.text.audio_path.slice(0, 200) : null };
  }
  if (o.grammar && typeof o.grammar === 'object') {
    const title_ar = S(o.grammar.title_ar, 120); const explanation_ar = P(o.grammar.explanation_ar, 1200);
    const examples = Array.isArray(o.grammar.examples) ? o.grammar.examples.map((e: unknown) => S(e, 200)).filter(Boolean).slice(0, 8) : [];
    if (title_ar || explanation_ar) out.grammar = { title_ar: title_ar || 'القاعدة', explanation_ar, examples };
  }
  if (o.speaking && typeof o.speaking === 'object') { const prompt_ar = S(o.speaking.prompt_ar, 300); if (prompt_ar) out.speaking = { prompt_ar, guide_ar: P(o.speaking.guide_ar, 600) }; }
  if (o.writing && typeof o.writing === 'object') { const topic_ar = S(o.writing.topic_ar, 300); if (topic_ar) out.writing = { topic_ar, instructions_ar: P(o.writing.instructions_ar, 600) }; }
  out.closing_ar = P(o.closing_ar, 400) || null;
  if (JSON.stringify(out).length > IQRA_LIMITS.content_max_bytes) problems.push({ at, msg: 'محتوى الحلقة أطول من الحدّ' });
  return out;
}

export function normalizeCard(c: unknown, at: string, problems: Problem[]): Card | null {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, any>;
  const word_ar = S(o.word_ar, 60); const gloss_ar = S(o.gloss_ar, 240);
  if (!word_ar || !hasArabic(word_ar)) { problems.push({ at, msg: 'كلمة البطاقة عربية مطلوبة' }); return null; }
  if (!gloss_ar || !hasArabic(gloss_ar)) { problems.push({ at, msg: `شرح البطاقة «${word_ar}» بالعربية مطلوب (لا ترجمة)` }); return null; }
  return { word_ar, pos: S(o.pos, 20) || null, gloss_ar, example_ar: S(o.example_ar, 240), audio_path: typeof o.audio_path === 'string' ? o.audio_path.slice(0, 200) : null, image_path: typeof o.image_path === 'string' ? o.image_path.slice(0, 200) : null };
}

export function normalizeExercise(e: unknown, at: string, problems: Problem[]): Exercise | null {
  const o = (e && typeof e === 'object' ? e : {}) as Record<string, any>;
  const prompt_ar = S(o.prompt_ar, 400); const explanation_ar = S(o.explanation_ar, 500) || undefined; const skill = typeof o.skill === 'string' ? o.skill : undefined;
  if (!prompt_ar) { problems.push({ at, msg: 'نصّ المِران مطلوب' }); return null; }
  if (o.kind === 'mcq') {
    const options = Array.isArray(o.options) ? uniq(o.options.map((x: unknown) => S(x, 160)).filter(Boolean)) : [];
    const correct = Number(o.correct);
    if (options.length < 2 || options.length > 4) { problems.push({ at, msg: 'اختيار من متعدّد: 2 إلى 4 خيارات مختلفة' }); return null; }
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) { problems.push({ at, msg: 'رقم الإجابة الصحيحة خارج الخيارات' }); return null; }
    return { kind: 'mcq', prompt_ar, options, correct, explanation_ar, skill };
  }
  if (o.kind === 'matching') {
    const pairs = Array.isArray(o.pairs) ? o.pairs.map((p: any) => ({ l: S(p?.l, 120), r: S(p?.r, 120) })).filter((p: { l: string; r: string }) => p.l && p.r) : [];
    if (pairs.length < 2 || pairs.length > 8) { problems.push({ at, msg: 'مطابقة: 2 إلى 8 أزواج' }); return null; }
    if (uniq(pairs.map((p: { l: string }) => p.l)).length !== pairs.length || uniq(pairs.map((p: { r: string }) => p.r)).length !== pairs.length) { problems.push({ at, msg: 'مطابقة: الأطراف يجب ألّا تتكرّر' }); return null; }
    return { kind: 'matching', prompt_ar, pairs, explanation_ar, skill };
  }
  if (o.kind === 'ordering') {
    const order = Array.isArray(o.order) ? o.order.map((x: unknown) => S(x, 60)).filter(Boolean) : [];
    const words = Array.isArray(o.words) && o.words.length ? o.words.map((x: unknown) => S(x, 60)).filter(Boolean) : [...order];
    if (order.length < 2 || order.length > 12) { problems.push({ at, msg: 'ترتيب: 2 إلى 12 كلمة' }); return null; }
    const a = [...words].sort().join('\u0001'), b = [...order].sort().join('\u0001');
    if (a !== b) { problems.push({ at, msg: 'ترتيب: الكلمات المعروضة لا تطابق الترتيب الصحيح' }); return null; }
    return { kind: 'ordering', prompt_ar, words, order, explanation_ar, skill };
  }
  problems.push({ at, msg: `نوع مِران غير معروف: ${String(o.kind)}` }); return null;
}

export type Normalized = { ok: true; pack: Pack; warnings: Problem[] } | { ok: false; problems: Problem[] };
export function normalizePack(raw: unknown): Normalized {
  const problems: Problem[] = []; const warnings: Problem[] = [];
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  if (o.version !== 'iqra-pack-1') problems.push({ at: 'pack', msg: 'الإصدار يجب أن يكون iqra-pack-1' });
  const source = S(o.source, 40) || 'manual';
  const units: PackUnit[] = [];
  for (const [i, u] of (Array.isArray(o.units) ? o.units : []).entries()) {
    const code = S(u?.code, 12).toUpperCase(); const level = unitLevel(code);
    if (!level) { problems.push({ at: `units[${i}]`, msg: `رمز منزلة غير صالح: ${code}` }); continue; }
    const title_ar = S(u?.title_ar, 80); if (!title_ar) { problems.push({ at: code, msg: 'عنوان المنزلة مطلوب' }); continue; }
    units.push({ code, level, idx: Number(code.slice(-2)), title_ar, title_en: S(u?.title_en, 80), focus_ar: S(u?.focus_ar, 300), domains: Array.isArray(u?.domains) ? u.domains.map(String).slice(0, 4) : [] });
  }
  const lessons: PackLesson[] = []; const seen = new Set<string>();
  const arr = Array.isArray(o.lessons) ? o.lessons : []; if (!arr.length) problems.push({ at: 'pack', msg: 'لا حلقات في الحزمة' });
  if (arr.length > IQRA_LIMITS.import_max_lessons) problems.push({ at: 'pack', msg: `أقصى حلقات في حزمة واحدة ${IQRA_LIMITS.import_max_lessons}` });
  for (const [i, l] of arr.entries()) {
    const unit_code = S(l?.unit_code, 12).toUpperCase(); const idx = Number(l?.idx);
    if (!unitLevel(unit_code)) { problems.push({ at: `lessons[${i}]`, msg: `رمز منزلة غير صالح: ${unit_code}` }); continue; }
    if (!Number.isInteger(idx) || idx < 1 || idx > 12) { problems.push({ at: `lessons[${i}]`, msg: 'ترتيب الحلقة من 1 إلى 12' }); continue; }
    const code = lessonCode(unit_code, idx); if (seen.has(code)) { problems.push({ at: code, msg: 'حلقة مكرّرة في الحزمة' }); continue; } seen.add(code);
    const title_ar = S(l?.title_ar, 100); if (!title_ar) { problems.push({ at: code, msg: 'عنوان الحلقة مطلوب' }); continue; }
    const content = normalizeContent(l?.content, code, problems);
    const cards = (Array.isArray(l?.cards) ? l.cards : []).map((c: unknown, k: number) => normalizeCard(c, `${code}/card${k + 1}`, problems)).filter(Boolean) as Card[];
    const exercises = (Array.isArray(l?.exercises) ? l.exercises : []).map((e: unknown, k: number) => normalizeExercise(e, `${code}/ex${k + 1}`, problems)).filter(Boolean) as Exercise[];
    if (cards.length > IQRA_LIMITS.cards_per_lesson_max) warnings.push({ at: code, msg: `بطاقات أكثر من ${IQRA_LIMITS.cards_per_lesson_max} — تُقتطع` });
    if (exercises.length > IQRA_LIMITS.items_per_lesson_max) warnings.push({ at: code, msg: `مِران أكثر من ${IQRA_LIMITS.items_per_lesson_max} — يُقتطع` });
    if (!exercises.length) warnings.push({ at: code, msg: 'حلقة بلا مِران — تُقبل مسوَّدةً ويلزم إضافة تمارين قبل الاعتماد' });
    const minutes = Number(l?.minutes); lessons.push({ code, unit_code, idx, title_ar, goal_ar: S(l?.goal_ar, 200), minutes: Number.isInteger(minutes) && minutes >= 3 && minutes <= 20 ? minutes : 8, content, cards: cards.slice(0, IQRA_LIMITS.cards_per_lesson_max), exercises: exercises.slice(0, IQRA_LIMITS.items_per_lesson_max) });
  }
  return problems.length ? { ok: false, problems } : { ok: true, pack: { version: 'iqra-pack-1', source, units, lessons }, warnings };
}

/* ---------- تحويل المِران إلى صفوف البنك ---------- */
export type BankRow = { item_code: string; content_version: string; level: string; skill: string; item_type: 'mcq' | 'matching' | 'ordering'; question_text: string; options: { id: string; text: string }[]; stimulus: Record<string, unknown>; unit_codes: string[]; status: 'draft'; source_kind: 'iqra'; key: { correct_option_id: string; accepted: Record<string, unknown> | null } };
const OPT = ['a', 'b', 'c', 'd'];
export function exerciseToBank(ex: Exercise, lesson: string, i: number, level: IqraLevel, unit: string): BankRow {
  const base = { item_code: itemCode(lesson, i), content_version: 'iqra-q1', level, skill: ex.skill && ['grammar_vocab', 'reading', 'listening'].includes(ex.skill) ? ex.skill : 'grammar_vocab', question_text: ex.prompt_ar, unit_codes: [unit], status: 'draft' as const, source_kind: 'iqra' as const };
  if (ex.kind === 'mcq') return { ...base, item_type: 'mcq', options: ex.options.map((t, k) => ({ id: OPT[k], text: t })), stimulus: { explanation_ar: ex.explanation_ar || null }, key: { correct_option_id: OPT[ex.correct], accepted: null } };
  if (ex.kind === 'matching') return { ...base, item_type: 'matching', options: [], stimulus: { pairs: ex.pairs, explanation_ar: ex.explanation_ar || null }, key: { correct_option_id: 'match', accepted: { pairs: ex.pairs.map((p) => [p.l, p.r]) } } };
  return { ...base, item_type: 'ordering', options: [], stimulus: { words: ex.words, explanation_ar: ex.explanation_ar || null }, key: { correct_option_id: 'order', accepted: { order: ex.order } } };
}

/* ---------- ما يراه المتعلّم (بلا مفاتيح) والتصحيح ---------- */
export type PublicExercise = { id: string; kind: ExerciseKind; prompt_ar: string; options?: { id: string; text: string }[]; left?: string[]; right?: string[]; words?: string[] };
/** خلط حتمي بالبذرة (معرّف البند) حتى يثبت الترتيب للمتعلّم نفسه بين التحميلات */
export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const out = [...arr]; for (let i = out.length - 1; i > 0; i--) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const j = h % (i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out;
}
export function publicExercise(row: { id: string; item_type: string; question_text: string; options: unknown; stimulus: any }): PublicExercise | null {
  const stim = row.stimulus && typeof row.stimulus === 'object' ? row.stimulus : {};
  if (row.item_type === 'mcq') { const options = Array.isArray(row.options) ? (row.options as any[]).map((o) => ({ id: String(o.id), text: String(o.text) })) : []; return options.length >= 2 ? { id: row.id, kind: 'mcq', prompt_ar: row.question_text, options } : null; }
  if (row.item_type === 'matching') { const pairs: { l: string; r: string }[] = Array.isArray(stim.pairs) ? stim.pairs : []; if (pairs.length < 2) return null; return { id: row.id, kind: 'matching', prompt_ar: row.question_text, left: pairs.map((p) => p.l), right: seededShuffle(pairs.map((p) => p.r), row.id + 'r') }; }
  if (row.item_type === 'ordering') { const words: string[] = Array.isArray(stim.words) ? stim.words : []; if (words.length < 2) return null; return { id: row.id, kind: 'ordering', prompt_ar: row.question_text, words: seededShuffle(words, row.id + 'w') }; }
  return null;
}
export type Answer = { option?: unknown; pairs?: unknown; order?: unknown };
export type Graded = { correct: boolean; explanation_ar: string | null; correct_option?: string; correct_pairs?: [string, string][]; correct_order?: string[] };
export function grade(row: { item_type: string; stimulus: any }, key: { correct_option_id: string; accepted: any }, a: Answer): Graded | null {
  const explanation_ar = row.stimulus && typeof row.stimulus.explanation_ar === 'string' ? row.stimulus.explanation_ar : null;
  if (row.item_type === 'mcq') { if (typeof a.option !== 'string') return null; return { correct: a.option === key.correct_option_id, explanation_ar, correct_option: key.correct_option_id }; }
  if (row.item_type === 'matching') {
    const want: [string, string][] = Array.isArray(key.accepted?.pairs) ? key.accepted.pairs : []; if (!Array.isArray(a.pairs)) return null;
    const got = new Map((a.pairs as any[]).filter((p) => Array.isArray(p) && p.length === 2).map((p) => [String(p[0]), String(p[1])]));
    const correct = want.length > 0 && want.every(([l, r]) => got.get(l) === r) && got.size === want.length; return { correct, explanation_ar, correct_pairs: want };
  }
  if (row.item_type === 'ordering') { const want: string[] = Array.isArray(key.accepted?.order) ? key.accepted.order : []; if (!Array.isArray(a.order)) return null; const got = (a.order as unknown[]).map(String); return { correct: want.length > 0 && got.length === want.length && got.every((w, i) => w === want[i]), explanation_ar, correct_order: want }; }
  return null;
}

/* ---------- التكرار المتباعد ---------- */
export type ReviewResult = 'again' | 'good' | 'easy';
export function nextInterval(prev: number, result: ReviewResult): number {
  const steps = IQRA_LIMITS.review_steps_days; const i = Math.max(0, steps.indexOf(prev as 1));
  if (result === 'again') return steps[0]; if (result === 'easy') return steps[Math.min(steps.length - 1, i + 2)]; return steps[Math.min(steps.length - 1, i + 1)];
}
export const scorePct = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0);
/** سلسلة الأيام المتّصلة (بتوقيت الرياض) من تواريخ النشاط الفريدة */
export function streakDays(days: readonly string[], today: string): number {
  const set = new Set(days); let n = 0; let d = today;
  if (!set.has(d)) { const y = new Date(d + 'T00:00:00Z'); y.setUTCDate(y.getUTCDate() - 1); d = y.toISOString().slice(0, 10); if (!set.has(d)) return 0; }
  while (set.has(d)) { n += 1; const y = new Date(d + 'T00:00:00Z'); y.setUTCDate(y.getUTCDate() - 1); d = y.toISOString().slice(0, 10); }
  return n;
}
