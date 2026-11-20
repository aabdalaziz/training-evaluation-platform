// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ» ق1 — طبقة المحتوى الصرفة (بلا قاعدة): شكل الحلقة · البطاقة · المِران · حزمة الاستيراد والتحقّق منها · التصحيح.
 *  الحلقة (iqra_lessons.content) خمس محطّات: مدخل → نصّ (حوار/سرد) → بطاقات المفردات → قاعدة/ملاحظة → مِران (3 أنواع) → «أثر الحلقة».
 *  المِران يُخزَّن في بنك مِعيار (question_bank_items.source_kind='iqra') كي يُراجَع بالأدوات نفسها، ولا يدخل سحب الاختبارات الرسمية.
 *   - mcq      : options [{id:'a'..'d', text}] · مفتاح correct_option_id · stimulus.explanation_ar
 *   - matching : stimulus.pairs [{l, r}] · مفتاح accepted.pairs [[l, r]…]
 *   - ordering : stimulus.words [..] · مفتاح accepted.order [..]
 *  الخطوة 2 (2026-11-17) — ستّة أنواع جديدة:
 *   - picture_choice      : options [{id, text, image}] · مفتاح correct_option_id
 *   - cloze_bank          : stimulus.text (فراغات ___) + stimulus.bank · مفتاح accepted.gaps [..]
 *   - true_false_notgiven : options ثابتة true/false/ng · stimulus.passage_ar · مفتاح correct_option_id
 *   - word_tap            : stimulus.words · مفتاح accepted.word
 *   - short_dictation     : stimulus.say (يُنطق على جهاز المتعلّم ولا يُعرض) · مفتاح accepted.text + accepted.alt (مقارنة بعد تطبيع الرسم)
 *   - picture_sequence    : stimulus.frames [{image, text}] · مفتاح accepted.order [نصوص الإطارات]
 *  + الحلقة تحمل مهارتها (skill) و«أستطيع أن…» وأكواد الواصفات · محطّة «أُنتج» (produce) · مكتبة المستوى · فاحص الإنصاف 60/40 · سحب 10 من 30.
 */
import { IQRA_LIMITS, itemsMaxFor, IQRA_SKILLS, SKILL_META, isIqraLevel, isIqraSkill, type IqraLevel, type IqraSkill } from './registry';

export type TextKind = 'dialogue' | 'narrative';
export type LessonContent = {
  intro_ar: string;
  text?: { kind: TextKind; body: string; audio_path?: string | null } | null;
  grammar?: { title_ar: string; explanation_ar: string; examples: string[] } | null;
  speaking?: { prompt_ar: string; guide_ar: string } | null;
  writing?: { topic_ar: string; instructions_ar: string } | null;
  produce?: { kind: 'write' | 'speak'; prompt_ar: string; checklist: string[]; model_ar: string; min_words?: number } | null;
  closing_ar?: string | null;
};
export type Card = { word_ar: string; pos?: string | null; gloss_ar: string; example_ar?: string; audio_path?: string | null; image_path?: string | null };
export type ExerciseKind = 'mcq' | 'matching' | 'ordering' | 'picture_choice' | 'cloze_bank' | 'true_false_notgiven' | 'word_tap' | 'short_dictation' | 'picture_sequence';
type ExBase = { prompt_ar: string; explanation_ar?: string; skill?: string };
export type Exercise =
  | (ExBase & { kind: 'mcq'; options: string[]; correct: number })
  | (ExBase & { kind: 'matching'; pairs: { l: string; r: string }[] })
  | (ExBase & { kind: 'ordering'; words: string[]; order: string[] })
  | (ExBase & { kind: 'picture_choice'; options: { text: string; image: string }[]; correct: number })
  | (ExBase & { kind: 'cloze_bank'; text: string; bank: string[]; gaps: string[] })
  | (ExBase & { kind: 'true_false_notgiven'; passage_ar: string; correct: 'true' | 'false' | 'ng' })
  | (ExBase & { kind: 'word_tap'; words: string[]; correct: string })
  | (ExBase & { kind: 'short_dictation'; text_ar: string; alt?: string[] })
  | (ExBase & { kind: 'picture_sequence'; frames: { image: string; text: string }[]; order: string[] });
export type PackUnit = { code: string; level: IqraLevel; idx: number; title_ar: string; title_en?: string; focus_ar?: string; domains?: string[] };
export type PackLesson = { code: string; unit_code: string; idx: number; title_ar: string; goal_ar?: string; minutes?: number; minutes_total?: number; skill?: IqraSkill | null; can_do_ar?: string; can_do_en?: string; descriptor_codes?: string[]; domain?: string; fairness_exempt?: boolean; content: LessonContent; cards: Card[]; exercises: Exercise[] };
export type PackLibrary = { code: string; unit_code: string; kind: 'read' | 'listen'; title_ar: string; body_ar: string; minutes: number; questions: { q: string; options: string[]; correct: number; explanation_ar?: string }[]; descriptor_codes?: string[] };
export type Pack = { version: 'iqra-pack-1' | 'iqra-pack-2'; source: string; units?: PackUnit[]; lessons: PackLesson[]; library?: PackLibrary[] };
export const LIBRARY_CODE_RE = /^(PRE_A1|A1|A2|B1|B2|C1|C2)-U\d{2}-[RA]\d{2}$/;

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

/** حدود حقول المحتوى — مضبوطة على أطول نصوص CEFR (B2/C1): نصّ قراءة/استماع حتى ≈ 1,200 كلمة، نموذج «أُنتج» حتى ≈ 500 كلمة (تحدّث 300 ث).
 *  كلّ اقتطاع يُبلَّغ تحذيرًا (لا يُسكَت عنه) حتى لا يصل المتعلّمَ نصٌّ مبتور. */
export const CONTENT_CAPS = { intro_ar: 1000, body: 9000, explanation_ar: 3000, examples: 10, example: 240, prompt_ar: 900, checklist: 8, check: 200, model_ar: 4000, min_words: 400, closing_ar: 700, guide_ar: 600 } as const;
const cut = (warn: Problem[] | undefined, at: string, field: string, raw: unknown, max: number) => { if (warn && typeof raw === 'string' && raw.trim().length > max) warn.push({ at, msg: `«${field}» أطول من الحدّ (${raw.trim().length} > ${max} حرفًا) — اقتُطع` }); };

export function normalizeContent(c: unknown, at: string, problems: Problem[], warnings?: Problem[]): LessonContent {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, any>;
  const C = CONTENT_CAPS;
  cut(warnings, at, 'intro_ar', o.intro_ar, C.intro_ar);
  const intro_ar = P(o.intro_ar, C.intro_ar); if (!intro_ar) problems.push({ at, msg: 'مدخل الحلقة (intro_ar) مطلوب' });
  const out: LessonContent = { intro_ar };
  if (o.text && typeof o.text === 'object') {
    const kind: TextKind = o.text.kind === 'narrative' ? 'narrative' : 'dialogue'; cut(warnings, at, 'text.body', o.text.body, C.body); const body = P(o.text.body, C.body);
    if (body) out.text = { kind, body, audio_path: typeof o.text.audio_path === 'string' ? o.text.audio_path.slice(0, 200) : null };
  }
  if (o.grammar && typeof o.grammar === 'object') {
    cut(warnings, at, 'grammar.explanation_ar', o.grammar.explanation_ar, C.explanation_ar);
    const title_ar = S(o.grammar.title_ar, 120); const explanation_ar = P(o.grammar.explanation_ar, C.explanation_ar);
    const rawEx = Array.isArray(o.grammar.examples) ? o.grammar.examples : [];
    if (rawEx.length > C.examples && warnings) warnings.push({ at, msg: `أمثلة القاعدة أكثر من ${C.examples} — تُقتطع` });
    rawEx.forEach((e: unknown) => cut(warnings, at, 'grammar.examples[]', e, C.example));
    const examples = rawEx.map((e: unknown) => S(e, C.example)).filter(Boolean).slice(0, C.examples);
    if (title_ar || explanation_ar) out.grammar = { title_ar: title_ar || 'القاعدة', explanation_ar, examples };
  }
  if (o.speaking && typeof o.speaking === 'object') { const prompt_ar = S(o.speaking.prompt_ar, 300); if (prompt_ar) out.speaking = { prompt_ar, guide_ar: P(o.speaking.guide_ar, C.guide_ar) }; }
  if (o.writing && typeof o.writing === 'object') { const topic_ar = S(o.writing.topic_ar, 300); if (topic_ar) out.writing = { topic_ar, instructions_ar: P(o.writing.instructions_ar, C.guide_ar) }; }
  if (o.produce && typeof o.produce === 'object') {
    const kind = o.produce.kind === 'speak' ? 'speak' : 'write'; cut(warnings, at, 'produce.prompt_ar', o.produce.prompt_ar, C.prompt_ar); const prompt_ar = P(o.produce.prompt_ar, C.prompt_ar);
    const rawCl = Array.isArray(o.produce.checklist) ? o.produce.checklist : [];
    if (rawCl.length > C.checklist && warnings) warnings.push({ at, msg: `قائمة التدقيق أكثر من ${C.checklist} بنود — تُقتطع` });
    rawCl.forEach((x: unknown) => cut(warnings, at, 'produce.checklist[]', x, C.check));
    const checklist = rawCl.map((x: unknown) => S(x, C.check)).filter(Boolean).slice(0, C.checklist);
    cut(warnings, at, 'produce.model_ar', o.produce.model_ar, C.model_ar);
    if (prompt_ar) { out.produce = { kind, prompt_ar, checklist, model_ar: P(o.produce.model_ar, C.model_ar), min_words: Number.isInteger(Number(o.produce.min_words)) ? Math.max(0, Math.min(C.min_words, Number(o.produce.min_words))) : undefined }; if (checklist.length < 2) problems.push({ at, msg: 'محطّة «أُنتج»: قائمة تدقيق ذاتي من بندين على الأقل' }); }
  }
  cut(warnings, at, 'closing_ar', o.closing_ar, C.closing_ar);
  out.closing_ar = P(o.closing_ar, C.closing_ar) || null;
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
  if (o.kind === 'picture_choice') {
    const options = Array.isArray(o.options) ? o.options.map((x: any) => ({ text: S(x?.text, 80), image: S(x?.image, 200) })).filter((x: { text: string; image: string }) => x.image) : [];
    const correct = Number(o.correct);
    if (options.length < 2 || options.length > 4 || uniq(options.map((x: { image: string }) => x.image)).length !== options.length) { problems.push({ at, msg: 'اختيار بالصورة: 2 إلى 4 صور مختلفة' }); return null; }
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) { problems.push({ at, msg: 'رقم الصورة الصحيحة خارج الخيارات' }); return null; }
    return { kind: 'picture_choice', prompt_ar, options, correct, explanation_ar, skill };
  }
  if (o.kind === 'cloze_bank') {
    const text = P(o.text, 600); const gaps = Array.isArray(o.gaps) ? o.gaps.map((x: unknown) => S(x, 40)).filter(Boolean) : []; const bank = uniq([...(Array.isArray(o.bank) ? o.bank.map((x: unknown) => S(x, 40)).filter(Boolean) : []), ...gaps]);
    const slots = (text.match(/___/g) || []).length;
    if (!text || slots < 1 || slots > 6 || slots !== gaps.length) { problems.push({ at, msg: 'ملء الفراغ: 1 إلى 6 فراغات (___) بعدد الإجابات' }); return null; }
    if (bank.length < gaps.length + 1 || bank.length > 10) { problems.push({ at, msg: 'ملء الفراغ: بنك الكلمات يزيد على الإجابات بمشتّت واحد على الأقل (≤ 10)' }); return null; }
    return { kind: 'cloze_bank', prompt_ar, text, bank, gaps, explanation_ar, skill };
  }
  if (o.kind === 'true_false_notgiven') {
    const passage_ar = P(o.passage_ar, 800); const correct = o.correct === true || o.correct === 'true' ? 'true' : o.correct === false || o.correct === 'false' ? 'false' : o.correct === 'ng' || o.correct === 'not_given' ? 'ng' : null;
    if (!passage_ar) { problems.push({ at, msg: 'صحيح/خطأ/غير مذكور: النصّ المرجعي (passage_ar) مطلوب' }); return null; }
    if (!correct) { problems.push({ at, msg: 'صحيح/خطأ/غير مذكور: الإجابة true | false | ng' }); return null; }
    return { kind: 'true_false_notgiven', prompt_ar, passage_ar, correct, explanation_ar, skill };
  }
  if (o.kind === 'word_tap') {
    const words = Array.isArray(o.words) ? o.words.map((x: unknown) => S(x, 40)).filter(Boolean) : typeof o.sentence === 'string' ? o.sentence.split(/\s+/).map((x: string) => S(x, 40)).filter(Boolean) : [];
    const correct = S(o.correct, 40);
    if (words.length < 3 || words.length > 16) { problems.push({ at, msg: 'المس الكلمة: جملة من 3 إلى 16 كلمة' }); return null; }
    if (!correct || words.filter((w: string) => w === correct).length !== 1) { problems.push({ at, msg: 'المس الكلمة: الكلمة الصحيحة يجب أن ترد مرّة واحدة في الجملة' }); return null; }
    return { kind: 'word_tap', prompt_ar, words, correct, explanation_ar, skill };
  }
  if (o.kind === 'short_dictation') {
    const text_ar = S(o.text_ar, 120); const alt = Array.isArray(o.alt) ? o.alt.map((x: unknown) => S(x, 120)).filter(Boolean).slice(0, 4) : [];
    if (!text_ar || !hasArabic(text_ar) || text_ar.split(' ').length > 8) { problems.push({ at, msg: 'إملاء قصير: نصّ عربي من 1 إلى 8 كلمات' }); return null; }
    return { kind: 'short_dictation', prompt_ar, text_ar, alt, explanation_ar, skill };
  }
  if (o.kind === 'picture_sequence') {
    const frames = Array.isArray(o.frames) ? o.frames.map((x: any) => ({ image: S(x?.image, 200), text: S(x?.text, 80) })).filter((x: { image: string; text: string }) => x.image && x.text) : [];
    const order = Array.isArray(o.order) && o.order.length ? o.order.map((x: unknown) => S(x, 80)).filter(Boolean) : frames.map((f: { text: string }) => f.text);
    if (frames.length < 3 || frames.length > 6 || uniq(frames.map((f: { text: string }) => f.text)).length !== frames.length) { problems.push({ at, msg: 'ترتيب الصور: 3 إلى 6 إطارات بنصوص مختلفة' }); return null; }
    if ([...order].sort().join('\u0001') !== frames.map((f: { text: string }) => f.text).sort().join('\u0001')) { problems.push({ at, msg: 'ترتيب الصور: الترتيب الصحيح لا يطابق الإطارات' }); return null; }
    return { kind: 'picture_sequence', prompt_ar, frames, order, explanation_ar, skill };
  }
  problems.push({ at, msg: `نوع مِران غير معروف: ${String(o.kind)}` }); return null;
}

/* ---------- تطبيع الرسم للإملاء: بلا تشكيل · بلا تطويل · الهمزات على الألف → ا · ة → ه · ى → ي · بلا ترقيم ---------- */
export function normArabic(s: string): string {
  return String(s || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/* ---------- ميثاق الإنصاف: حضور متوازن للجنسين في نصوص الحلقة (تحذير 60/40، غير مانع) ---------- */
// ملاحظة: حرف الجرّ «على» يُستبعد قبل التطبيع حتى لا يُحسب اسمًا (عليّ) — إصلاح الدفعة 4.
const F_WORDS = ['هي', 'أم', 'أمي', 'أمك', 'أخت', 'أختي', 'بنت', 'ابنة', 'ابنتي', 'امرأة', 'سيدة', 'زوجة', 'زوجتي', 'جدة', 'جدتي', 'معلمة', 'طالبة', 'طبيبة', 'مهندسة', 'صديقة', 'صديقتي', 'موظفة', 'مديرة', 'ممرضة', 'بائعة', 'كاتبة', 'خالة', 'عمة', 'فاطمة', 'نورة', 'مريم', 'سارة', 'ليلى', 'هند', 'سلمى', 'ريم', 'عائشة', 'خديجة', 'زينب', 'أمل', 'منى', 'هدى', 'لمى', 'دانة', 'جود', 'رنا', 'آمنة', 'حنان', 'نادية', 'سعاد', 'لينا', 'شهد', 'غادة', 'أسماء', 'رقية', 'إيمان'];
const M_WORDS = ['هو', 'أب', 'أبي', 'أبوك', 'والد', 'والدي', 'أخ', 'أخي', 'ولد', 'ابن', 'ابني', 'رجل', 'سيد', 'زوج', 'زوجي', 'جد', 'جدي', 'معلم', 'طالب', 'طبيب', 'مهندس', 'صديق', 'صديقي', 'موظف', 'مدير', 'ممرض', 'بائع', 'كاتب', 'خال', 'عم', 'أحمد', 'محمد', 'خالد', 'علي', 'عمر', 'سعيد', 'يوسف', 'سالم', 'فهد', 'عبدالله', 'حسن', 'كريم', 'ماجد', 'طارق', 'ناصر', 'بدر', 'إبراهيم', 'عثمان', 'حمد', 'راشد', 'سلطان', 'ياسر', 'زياد', 'آدم', 'عادل'];
const fset = new Set(F_WORDS.map(normArabic)), mset = new Set(M_WORDS.map(normArabic));
export type Fairness = { f: number; m: number; pct_f: number; warn: string | null };
export function fairnessLint(texts: string[], exempt = false): Fairness {
  let f = 0, m = 0;
  for (const t of texts) for (const w0 of normArabic(String(t || '').replace(/(?<!\p{L})(?:و|ف)?على(?!\p{L})/gu, ' ')).split(' ')) { const w = w0.replace(/^(و|ف|ب|ل|ك|ال|وال|بال|لل)/, ''); if (fset.has(w0) || fset.has(w)) f += 1; else if (mset.has(w0) || mset.has(w)) m += 1; }
  const tot = f + m; const pct_f = tot ? Math.round((f / tot) * 100) : 50;
  const warn = exempt || tot < IQRA_LIMITS.fairness_min_refs ? null : pct_f < IQRA_LIMITS.fairness_min_pct ? `حضور الإناث ${pct_f}% فقط من الإشارات (${f} من ${tot}) — ميثاق الإنصاف يطلب ≥ ${IQRA_LIMITS.fairness_min_pct}%` : pct_f > 100 - IQRA_LIMITS.fairness_min_pct ? `حضور الذكور ${100 - pct_f}% فقط من الإشارات (${m} من ${tot}) — ميثاق الإنصاف يطلب ≥ ${IQRA_LIMITS.fairness_min_pct}%` : null;
  return { f, m, pct_f, warn };
}
export function lessonTexts(l: { content: LessonContent; cards: Card[]; exercises: Exercise[] }): string[] {
  const c = l.content; const out: string[] = [c.intro_ar, c.text?.body || '', c.grammar?.explanation_ar || '', ...(c.grammar?.examples || []), c.produce?.prompt_ar || '', c.produce?.model_ar || '', c.closing_ar || ''];
  for (const k of l.cards) out.push(k.gloss_ar, k.example_ar || '');
  for (const e of l.exercises) { out.push(e.prompt_ar, e.explanation_ar || ''); if (e.kind === 'mcq') out.push(...e.options); if (e.kind === 'matching') out.push(...e.pairs.flatMap((p) => [p.l, p.r])); if (e.kind === 'ordering') out.push(e.order.join(' ')); if (e.kind === 'cloze_bank') out.push(e.text, ...e.bank); if (e.kind === 'true_false_notgiven') out.push(e.passage_ar); if (e.kind === 'word_tap') out.push(e.words.join(' ')); if (e.kind === 'short_dictation') out.push(e.text_ar); if (e.kind === 'picture_sequence') out.push(...e.frames.map((f) => f.text)); if (e.kind === 'picture_choice') out.push(...e.options.map((o) => o.text)); }
  return out.filter(Boolean);
}

/* ---------- قالب المَنزِلة: خمس حلقات تغطّي المهارات الخمس · 30 تمرينًا · ≥ 8 بطاقات · ≥ 4 أنواع · محطّة أُنتج ---------- */
export function templateLint(lessons: PackLesson[]): Problem[] {
  const w: Problem[] = []; const byUnit = new Map<string, PackLesson[]>();
  for (const l of lessons) { const a = byUnit.get(l.unit_code) || []; a.push(l); byUnit.set(l.unit_code, a); }
  for (const [u, ls] of byUnit) {
    const skills = new Set(ls.map((l) => l.skill).filter(Boolean)); const missing = IQRA_SKILLS.filter((s) => !skills.has(s));
    if (ls.length >= 5 && missing.length) w.push({ at: u, msg: `قالب المنزلة: مهارات ناقصة — ${missing.map((s) => SKILL_META[s].name_ar).join(' · ')}` });
    if (ls.length < 5) w.push({ at: u, msg: `المنزلة فيها ${ls.length} من 5 حلقات حتى الآن` });
  }
  for (const l of lessons) {
    if (!l.skill) w.push({ at: l.code, msg: 'الحلقة بلا مهارة (skill) — القالب يطلب واحدة من الخمس' });
    if (!l.can_do_ar) w.push({ at: l.code, msg: 'الحلقة بلا «أستطيع أن…» (can_do_ar)' });
    if (!(l.descriptor_codes || []).length) w.push({ at: l.code, msg: 'الحلقة بلا أكواد واصفات (descriptor_codes)' });
    if (l.exercises.length < IQRA_LIMITS.items_per_lesson_target) w.push({ at: l.code, msg: `مِران ${l.exercises.length} من ${IQRA_LIMITS.items_per_lesson_target} — تُسحب ${IQRA_LIMITS.draw_per_visit} في كلّ زيارة` });
    if (l.cards.length < IQRA_LIMITS.cards_per_lesson_min) w.push({ at: l.code, msg: `بطاقات ${l.cards.length} من ${IQRA_LIMITS.cards_per_lesson_min} على الأقل` });
    const kinds = new Set(l.exercises.map((e) => e.kind)); if (l.exercises.length && kinds.size < IQRA_LIMITS.kinds_per_lesson_min) w.push({ at: l.code, msg: `تنوّع المِران: ${kinds.size} أنواع فقط (المطلوب ≥ ${IQRA_LIMITS.kinds_per_lesson_min})` });
    if (!l.content.produce) w.push({ at: l.code, msg: 'الحلقة بلا محطّة «أُنتج» (كتابة أو تحدّث بقائمة تدقيق)' });
    const fz = fairnessLint(lessonTexts(l), !!l.fairness_exempt); if (fz.warn) w.push({ at: l.code, msg: `الإنصاف: ${fz.warn}` });
  }
  return w;
}

/* ---------- السحب: 10 من 30 — ما لم يُجَب أولًا، ثم ما أُخطئ فيه، ثم ما أُصيب؛ خلط حتمي ببذرة الزيارة ---------- */
export function drawExercises(ids: readonly string[], answers: Record<string, { correct?: boolean } | undefined>, seed: string, n = IQRA_LIMITS.draw_per_visit): string[] {
  const fresh = ids.filter((i) => !answers[i]), wrong = ids.filter((i) => answers[i] && !answers[i]!.correct), right = ids.filter((i) => answers[i]?.correct);
  return [...seededShuffle(fresh, seed + 'f'), ...seededShuffle(wrong, seed + 'w'), ...seededShuffle(right, seed + 'r')].slice(0, Math.min(n, ids.length));
}

export type Normalized = { ok: true; pack: Pack; warnings: Problem[] } | { ok: false; problems: Problem[] };
export function normalizePack(raw: unknown): Normalized {
  const problems: Problem[] = []; const warnings: Problem[] = [];
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const version: Pack['version'] = o.version === 'iqra-pack-2' ? 'iqra-pack-2' : 'iqra-pack-1';
  if (o.version !== 'iqra-pack-1' && o.version !== 'iqra-pack-2') problems.push({ at: 'pack', msg: 'الإصدار يجب أن يكون iqra-pack-1 أو iqra-pack-2' });
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
    const content = normalizeContent(l?.content, code, problems, warnings);
    const cards = (Array.isArray(l?.cards) ? l.cards : []).map((c: unknown, k: number) => normalizeCard(c, `${code}/card${k + 1}`, problems)).filter(Boolean) as Card[];
    const exercises = (Array.isArray(l?.exercises) ? l.exercises : []).map((e: unknown, k: number) => normalizeExercise(e, `${code}/ex${k + 1}`, problems)).filter(Boolean) as Exercise[];
    if (cards.length > IQRA_LIMITS.cards_per_lesson_max) warnings.push({ at: code, msg: `بطاقات أكثر من ${IQRA_LIMITS.cards_per_lesson_max} — تُقتطع` });
    const exMax = itemsMaxFor(unitLevel(unit_code)); /* ت٣: التمهيديّ 40 */
    if (exercises.length > exMax) warnings.push({ at: code, msg: `مِران أكثر من ${exMax} — يُقتطع` });
    if (!exercises.length) warnings.push({ at: code, msg: 'حلقة بلا مِران — تُقبل مسوَّدةً ويلزم إضافة تمارين قبل الاعتماد' });
    const minutes = Number(l?.minutes); const minutes_total = Number(l?.minutes_total);
    const skill = isIqraSkill(l?.skill) ? l.skill : null; if (l?.skill && !skill) problems.push({ at: code, msg: `مهارة غير معروفة: ${String(l.skill)}` });
    const descriptor_codes: string[] = Array.isArray(l?.descriptor_codes) ? uniq<string>(l.descriptor_codes.map((x: unknown) => S(x, 24).toUpperCase()).filter((x: string) => /^[A-Z0-9_-]{3,24}$/.test(x))).slice(0, 8) : [];
    lessons.push({ code, unit_code, idx, title_ar, goal_ar: S(l?.goal_ar, 200), minutes: Number.isInteger(minutes) && minutes >= 3 && minutes <= 20 ? minutes : 10, minutes_total: Number.isInteger(minutes_total) && minutes_total >= 20 && minutes_total <= 240 ? minutes_total : 120, skill, can_do_ar: S(l?.can_do_ar, 200), can_do_en: S(l?.can_do_en, 200), descriptor_codes, domain: S(l?.domain, 20) || 'شخصي', fairness_exempt: l?.fairness_exempt === true, content, cards: cards.slice(0, IQRA_LIMITS.cards_per_lesson_max), exercises: exercises.slice(0, exMax) });
  }
  const library: PackLibrary[] = []; const seenLib = new Set<string>();
  for (const [i, x] of (Array.isArray(o.library) ? o.library : []).entries()) {
    const code = S(x?.code, 16).toUpperCase(); const unit_code = S(x?.unit_code, 12).toUpperCase();
    if (!LIBRARY_CODE_RE.test(code) || !code.startsWith(unit_code + '-')) { problems.push({ at: `library[${i}]`, msg: `رمز مكتبة غير صالح: ${code} (مثل A1-U01-R01 أو A1-U01-A01)` }); continue; }
    if (seenLib.has(code)) { problems.push({ at: code, msg: 'نصّ مكتبة مكرّر' }); continue; } seenLib.add(code);
    const kind = code.includes('-A') ? 'listen' : 'read'; const title_ar = S(x?.title_ar, 100); cut(warnings, code, 'body_ar', x?.body_ar, CONTENT_CAPS.body); const body_ar = P(x?.body_ar, CONTENT_CAPS.body);
    if (!title_ar || !body_ar || !hasArabic(body_ar)) { problems.push({ at: code, msg: 'نصّ المكتبة: عنوان ومتن عربيّان مطلوبان' }); continue; }
    const questions = (Array.isArray(x?.questions) ? x.questions : []).map((qq: any, k: number) => { const q = S(qq?.q, 300); const options = Array.isArray(qq?.options) ? uniq(qq.options.map((y: unknown) => S(y, 120)).filter(Boolean)) : []; const correct = Number(qq?.correct); if (!q || options.length < 2 || options.length > 4 || !Number.isInteger(correct) || correct < 0 || correct >= options.length) { problems.push({ at: `${code}/q${k + 1}`, msg: 'سؤال المكتبة: نصّ + 2 إلى 4 خيارات + رقم الصحيح' }); return null; } return { q, options, correct, explanation_ar: S(qq?.explanation_ar, 300) || undefined }; }).filter(Boolean) as PackLibrary['questions'];
    if (questions.length < 3) warnings.push({ at: code, msg: 'نصّ المكتبة بأقلّ من 3 أسئلة' });
    const minutes = Number(x?.minutes); library.push({ code, unit_code, kind, title_ar, body_ar, minutes: Number.isInteger(minutes) && minutes >= 5 && minutes <= 60 ? minutes : 25, questions: questions.slice(0, 10), descriptor_codes: Array.isArray(x?.descriptor_codes) ? x.descriptor_codes.map((y: unknown) => S(y, 24).toUpperCase()).filter(Boolean).slice(0, 8) : [] });
  }
  if (version === 'iqra-pack-2') warnings.push(...templateLint(lessons));
  return problems.length ? { ok: false, problems } : { ok: true, pack: { version, source, units, lessons, library }, warnings };
}

/* ---------- تحويل المِران إلى صفوف البنك ---------- */
export type BankRow = { item_code: string; content_version: string; level: string; skill: string; item_type: ExerciseKind; question_text: string; options: { id: string; text: string; image?: string }[]; stimulus: Record<string, unknown>; unit_codes: string[]; status: 'draft'; source_kind: 'iqra'; key: { correct_option_id: string; accepted: Record<string, unknown> | null } };
const OPT = ['a', 'b', 'c', 'd'];
export const TFNG_OPTIONS = [{ id: 'true', text: 'صحيح' }, { id: 'false', text: 'خطأ' }, { id: 'ng', text: 'غير مذكور' }];
/** مهارة البند في البنك: من المِران نفسه، وإلّا من مهارة الحلقة (listen→listening · read→reading · غير ذلك grammar_vocab) */
export function bankSkill(ex: { skill?: string }, lessonSkill?: IqraSkill | null): string {
  if (ex.skill && ['grammar_vocab', 'reading', 'listening'].includes(ex.skill)) return ex.skill;
  return lessonSkill === 'listen' ? 'listening' : lessonSkill === 'read' ? 'reading' : 'grammar_vocab';
}
export function exerciseToBank(ex: Exercise, lesson: string, i: number, level: IqraLevel, unit: string, lessonSkill?: IqraSkill | null, version = 'iqra-q1'): BankRow {
  const x = { explanation_ar: ex.explanation_ar || null };
  const base = { item_code: itemCode(lesson, i), content_version: version, level, skill: bankSkill(ex, lessonSkill), question_text: ex.prompt_ar, unit_codes: [unit], status: 'draft' as const, source_kind: 'iqra' as const };
  switch (ex.kind) {
    case 'mcq': return { ...base, item_type: 'mcq', options: ex.options.map((t, k) => ({ id: OPT[k], text: t })), stimulus: x, key: { correct_option_id: OPT[ex.correct], accepted: null } };
    case 'matching': return { ...base, item_type: 'matching', options: [], stimulus: { pairs: ex.pairs, ...x }, key: { correct_option_id: 'match', accepted: { pairs: ex.pairs.map((p) => [p.l, p.r]) } } };
    case 'ordering': return { ...base, item_type: 'ordering', options: [], stimulus: { words: ex.words, ...x }, key: { correct_option_id: 'order', accepted: { order: ex.order } } };
    case 'picture_choice': return { ...base, item_type: 'picture_choice', options: ex.options.map((o, k) => ({ id: OPT[k], text: o.text, image: o.image })), stimulus: x, key: { correct_option_id: OPT[ex.correct], accepted: null } };
    case 'cloze_bank': return { ...base, item_type: 'cloze_bank', options: [], stimulus: { text: ex.text, bank: ex.bank, ...x }, key: { correct_option_id: 'gaps', accepted: { gaps: ex.gaps } } };
    case 'true_false_notgiven': return { ...base, item_type: 'true_false_notgiven', options: TFNG_OPTIONS, stimulus: { passage_ar: ex.passage_ar, ...x }, key: { correct_option_id: ex.correct, accepted: null } };
    case 'word_tap': return { ...base, item_type: 'word_tap', options: [], stimulus: { words: ex.words, ...x }, key: { correct_option_id: 'word', accepted: { word: ex.correct } } };
    case 'short_dictation': return { ...base, item_type: 'short_dictation', options: [], stimulus: { say: ex.text_ar, ...x }, key: { correct_option_id: 'text', accepted: { text: ex.text_ar, alt: ex.alt || [] } } };
    case 'picture_sequence': return { ...base, item_type: 'picture_sequence', options: [], stimulus: { frames: ex.frames, ...x }, key: { correct_option_id: 'order', accepted: { order: ex.order } } };
  }
}

/* ---------- ما يراه المتعلّم (بلا مفاتيح) والتصحيح ---------- */
export type PublicExercise = { id: string; kind: ExerciseKind; prompt_ar: string; options?: { id: string; text: string; image?: string }[]; left?: string[]; right?: string[]; words?: string[]; text?: string; bank?: string[]; passage_ar?: string; say?: string; frames?: { image: string; text: string }[] };
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
  if (row.item_type === 'picture_choice') { const options = Array.isArray(row.options) ? (row.options as any[]).map((o) => ({ id: String(o.id), text: String(o.text || ''), image: String(o.image || '') })) : []; return options.length >= 2 ? { id: row.id, kind: 'picture_choice', prompt_ar: row.question_text, options } : null; }
  if (row.item_type === 'cloze_bank') { const bank: string[] = Array.isArray(stim.bank) ? stim.bank : []; if (!stim.text || bank.length < 2) return null; return { id: row.id, kind: 'cloze_bank', prompt_ar: row.question_text, text: String(stim.text), bank: seededShuffle(bank, row.id + 'b') }; }
  if (row.item_type === 'true_false_notgiven') return { id: row.id, kind: 'true_false_notgiven', prompt_ar: row.question_text, passage_ar: String(stim.passage_ar || ''), options: TFNG_OPTIONS };
  if (row.item_type === 'word_tap') { const words: string[] = Array.isArray(stim.words) ? stim.words : []; if (words.length < 3) return null; return { id: row.id, kind: 'word_tap', prompt_ar: row.question_text, words }; }
  if (row.item_type === 'short_dictation') return stim.say ? { id: row.id, kind: 'short_dictation', prompt_ar: row.question_text, say: String(stim.say) } : null; /* يُنطق على الجهاز ولا يُعرض — تعلّم لا امتحان */
  if (row.item_type === 'picture_sequence') { const frames: { image: string; text: string }[] = Array.isArray(stim.frames) ? stim.frames : []; if (frames.length < 3) return null; return { id: row.id, kind: 'picture_sequence', prompt_ar: row.question_text, frames: seededShuffle(frames, row.id + 'p') }; }
  return null;
}
export type Answer = { option?: unknown; pairs?: unknown; order?: unknown; gaps?: unknown; word?: unknown; text?: unknown };
export type Graded = { correct: boolean; explanation_ar: string | null; correct_option?: string; correct_pairs?: [string, string][]; correct_order?: string[]; correct_gaps?: string[]; correct_word?: string; correct_text?: string };
export function grade(row: { item_type: string; stimulus: any }, key: { correct_option_id: string; accepted: any }, a: Answer): Graded | null {
  const explanation_ar = row.stimulus && typeof row.stimulus.explanation_ar === 'string' ? row.stimulus.explanation_ar : null;
  if (row.item_type === 'mcq') { if (typeof a.option !== 'string') return null; return { correct: a.option === key.correct_option_id, explanation_ar, correct_option: key.correct_option_id }; }
  if (row.item_type === 'matching') {
    const want: [string, string][] = Array.isArray(key.accepted?.pairs) ? key.accepted.pairs : []; if (!Array.isArray(a.pairs)) return null;
    const got = new Map((a.pairs as any[]).filter((p) => Array.isArray(p) && p.length === 2).map((p) => [String(p[0]), String(p[1])]));
    const correct = want.length > 0 && want.every(([l, r]) => got.get(l) === r) && got.size === want.length; return { correct, explanation_ar, correct_pairs: want };
  }
  if (row.item_type === 'ordering' || row.item_type === 'picture_sequence') { const want: string[] = Array.isArray(key.accepted?.order) ? key.accepted.order : []; if (!Array.isArray(a.order)) return null; const got = (a.order as unknown[]).map(String); return { correct: want.length > 0 && got.length === want.length && got.every((w, i) => w === want[i]), explanation_ar, correct_order: want }; }
  if (row.item_type === 'picture_choice' || row.item_type === 'true_false_notgiven') { if (typeof a.option !== 'string') return null; return { correct: a.option === key.correct_option_id, explanation_ar, correct_option: key.correct_option_id }; }
  if (row.item_type === 'cloze_bank') { const want: string[] = Array.isArray(key.accepted?.gaps) ? key.accepted.gaps : []; if (!Array.isArray(a.gaps)) return null; const got = (a.gaps as unknown[]).map(String); return { correct: want.length > 0 && got.length === want.length && got.every((w, i) => normArabic(w) === normArabic(want[i])), explanation_ar, correct_gaps: want }; }
  if (row.item_type === 'word_tap') { const want = String(key.accepted?.word || ''); if (typeof a.word !== 'string') return null; return { correct: !!want && normArabic(a.word) === normArabic(want), explanation_ar, correct_word: want }; }
  if (row.item_type === 'short_dictation') { const want = String(key.accepted?.text || ''); const alts: string[] = Array.isArray(key.accepted?.alt) ? key.accepted.alt : []; if (typeof a.text !== 'string') return null; const g = normArabic(a.text); return { correct: !!want && g.length > 0 && [want, ...alts].some((w) => normArabic(w) === g), explanation_ar, correct_text: want }; }
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
