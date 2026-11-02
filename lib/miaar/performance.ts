// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار — م4-ب «غرفة الأداء»: اختيار المهمّتين بمستوى المتقدّم، تحقّق التسليم، كتلة التقرير «المهارات الإنتاجية»، والإصدار على الرمز نفسه.
 *  منطق خالص (بلا شبكة) قابل للاختبار. القاعدة: لا درجة إنتاجية تُنشر قبل اعتماد إنسان. */
import { BANK_LEVELS, FLOOR_LEVEL, isBankLevel } from './registry';
import type { BankLevel, ProductiveSkill } from './registry';
import { validateTask, countWords, lengthStatus, validateScores, judge, DIMENSION_AR, RUBRIC_DIMENSIONS } from './rubric';
import type { TaskSpec, RubricScores } from './rubric';
import { createHash } from 'crypto';

export type TaskItem = { id: string; code: string; level: BankLevel; skill: ProductiveSkill; prompt: string; task: TaskSpec; descriptor: string | null; media: string | null; mediaAlt: string | null };
/** ما يراه المتقدّم: بلا إجابة نموذجية ولا سُلّم */
export type PublicTask = { code: string; level: BankLevel; skill: ProductiveSkill; prompt: string; prompt_en: string | null; tips_ar: string[]; genre: string; media: string | null; mediaAlt: string | null;
  min_words?: number; max_words?: number; time_seconds?: number; min_seconds?: number; max_seconds?: number; prep_seconds?: number; retakes?: number };
export type RoomState = { tasks: PublicTask[]; level: BankLevel; entered_at: string; drafts: Record<string, string>; done: ProductiveSkill[]; skipped: ProductiveSkill[] };
export type PerformanceStatus = 'submitted' | 'ai_rated' | 'rated' | 'released' | 'skipped';

/** صفّ بنك → مهمة (أو null إن كانت ناقصة) */
export function taskItemFrom(row: Record<string, unknown>): TaskItem | null {
  const skill = row.skill === 'writing' || row.skill === 'speaking' ? (row.skill as ProductiveSkill) : null; if (!skill) return null;
  const level = isBankLevel(row.level) ? (row.level as BankLevel) : null; if (!level) return null;
  const code = typeof row.item_code === 'string' ? row.item_code.trim() : ''; const prompt = typeof row.question_text === 'string' ? row.question_text.trim() : '';
  if (!code || prompt.length < 2) return null;
  const { task } = validateTask(skill, level, row.task); if (!task) return null;
  return { id: String(row.id), code, level, skill, prompt, task, descriptor: (row.descriptor_code as string) || null, media: (row.media_path as string) || null, mediaAlt: (row.media_alt as string) || null };
}
export const publicTask = (t: TaskItem): PublicTask => {
  const { sample_ar: _s, ...rest } = t.task; void _s;
  return { code: t.code, level: t.level, skill: t.skill, prompt: t.prompt, media: t.media, mediaAlt: t.mediaAlt, ...rest } as PublicTask;
};

/** المستويات المرشّحة حول مستوى المتقدّم: المستوى نفسه ثم الأدنى ثم الأعلى (المثبت ±1)؛ ما قبل A1 يأخذ ما قبل A1 ثم A1 */
export function targetLevels(level: string): BankLevel[] {
  const lv: BankLevel = isBankLevel(level) ? level : 'A1'; const i = BANK_LEVELS.indexOf(lv);
  const out: BankLevel[] = [lv]; if (i > 0) out.push(BANK_LEVELS[i - 1]); if (i < BANK_LEVELS.length - 1) out.push(BANK_LEVELS[i + 1]);
  return out;
}
const h32 = (s: string) => parseInt(createHash('sha256').update(s).digest('hex').slice(0, 8), 16);
/** اختيار مهمة واحدة لكل مهارة: أقرب مستوى متاح، بذرة ثابتة (الرمز) حتى لا تتغيّر المهمة عند إعادة التحميل؛ null للمهارة بلا مهمة معتمدة */
export function pickTasks(tasks: readonly TaskItem[], level: string, seed: string, want: ProductiveSkill[] = ['writing', 'speaking']): { picked: TaskItem[]; level: BankLevel } {
  const levels = targetLevels(level); const picked: TaskItem[] = [];
  for (const skill of want) {
    for (const lv of levels) {
      const cell = tasks.filter((t) => t.skill === skill && t.level === lv); if (!cell.length) continue;
      const sorted = [...cell].sort((a, b) => h32(`${seed}:${a.code}`) - h32(`${seed}:${b.code}`)); picked.push(sorted[0]); break;
    }
  }
  return { picked, level: levels[0] };
}

/** تحقّق تسليم الكتابة: نص عربي غير فارغ، ضمن سقف الطول ×1.6 (نسمح بالتجاوز قليلًا — السُّلّم هو من يحكم)، بلا لصق كتل ضخمة */
export function validateWriting(task: PublicTask | TaskSpec, raw: unknown): { ok: true; text: string; words: number; length: 'short' | 'ok' | 'long' } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.replace(/\r/g, '').trim() : ''; if (!text) return { ok: false, error: 'empty' };
  if (text.length > 6000) return { ok: false, error: 'too_long' };
  const words = countWords(text); const spec = task as TaskSpec; const max = spec.max_words || 400;
  if (words > Math.ceil(max * 1.6)) return { ok: false, error: 'over_limit' };
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length; if (arabic < Math.max(3, text.replace(/\s/g, '').length * 0.4)) return { ok: false, error: 'not_arabic' };
  return { ok: true, text, words, length: lengthStatus('writing', spec, words) };
}
/** تحقّق تسليم التحدّث (وصف الملف قبل الرفع): نوع صوتي مدعوم، مدّة ضمن السقف، حجم ≤ 12 م.ب */
export const AUDIO_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'] as const;
export const AUDIO_MAX_BYTES = Math.floor(2.8 * 1024 * 1024); /* 90 ث opus ≈ 0.4 م.ب؛ السقف يحمي الطلب (Vercel 4.5 م.ب) */
export function validateSpeaking(task: PublicTask | TaskSpec, meta: { mime: unknown; bytes: unknown; duration_sec: unknown }): { ok: true; mime: string; ext: string; duration: number; length: 'short' | 'ok' | 'long' } | { ok: false; error: string } {
  const mime = String(meta.mime || '').split(';')[0].trim().toLowerCase(); if (!(AUDIO_MIMES as readonly string[]).includes(mime)) return { ok: false, error: 'bad_mime' };
  const bytes = Number(meta.bytes); if (!(bytes > 0)) return { ok: false, error: 'empty' }; if (bytes > AUDIO_MAX_BYTES) return { ok: false, error: 'too_big' };
  const duration = Math.round(Number(meta.duration_sec) || 0); const spec = task as TaskSpec; const max = spec.max_seconds || 90;
  if (duration < 1) return { ok: false, error: 'empty' }; if (duration > max + 5) return { ok: false, error: 'over_limit' };
  const ext = mime === 'audio/webm' ? 'webm' : mime === 'audio/ogg' ? 'ogg' : mime === 'audio/mp4' ? 'm4a' : mime === 'audio/mpeg' ? 'mp3' : 'wav';
  return { ok: true, mime, ext, duration, length: lengthStatus('speaking', spec, duration) };
}
/** تيسيرات «أَثَر للجميع»: بديل كتابي للتحدّث · بديل صوتي للكتابة */
export const ACCOMMODATIONS = ['typed_instead_of_speaking', 'spoken_instead_of_writing'] as const;
export type Accommodation = (typeof ACCOMMODATIONS)[number];
export const isAccommodation = (v: unknown): v is Accommodation => (ACCOMMODATIONS as readonly unknown[]).includes(v);
export const mediaPathFor = (sessionId: string, skill: ProductiveSkill, ext: string): string => `performances/${sessionId}/${skill}-${Date.now()}.${ext}`;

/** ما يُلحَق بالتقرير لحظة الإنهاء: حالة «قيد التصحيح» لكل مهارة — بلا درجات (تأتي مع الإصدار) */
export type PerfLite = { skill: ProductiveSkill; status: PerformanceStatus; item_code: string; level_target: BankLevel; word_count?: number | null; duration_sec?: number | null; accommodation?: string | null;
  human_rating?: { scores: RubricScores; estimated: BankLevel; verdict_ar: string; note_ar?: string | null } | null; released_at?: string | null };
const SKILL_AR: Record<ProductiveSkill, string> = { writing: 'الكتابة', speaking: 'التحدّث' };
export function productiveBlock(perfs: readonly PerfLite[]): Record<string, unknown> | null {
  if (!perfs.length) return null;
  const skills: Record<string, unknown> = {}; let pending = 0; let released = 0;
  for (const p of perfs) {
    const key = SKILL_AR[p.skill]; const base: Record<string, unknown> = { رمز_المهمة: p.item_code, مستوى_المهمة: p.level_target };
    if (p.accommodation) base.تيسير = p.accommodation === 'typed_instead_of_speaking' ? 'كتب بدل أن يتحدّث' : 'تحدّث بدل أن يكتب';
    if (p.skill === 'writing' && p.word_count != null) base.عدد_الكلمات = p.word_count; if (p.skill === 'speaking' && p.duration_sec != null) base.المدة_بالثواني = p.duration_sec;
    if (p.status === 'skipped') { base.الحالة = 'لم تُقدَّم'; }
    else if (p.status === 'released' && p.human_rating) {
      released += 1; base.الحالة = 'معتمد'; base.المستوى_المقدر = p.human_rating.estimated; base.الحكم = p.human_rating.verdict_ar;
      base.الأبعاد = Object.fromEntries(Object.entries(p.human_rating.scores).map(([d, v]) => [DIMENSION_AR[d] || d, v])); if (p.human_rating.note_ar) base.ما_قاله_المصحح = p.human_rating.note_ar; if (p.released_at) base.تاريخ_الاعتماد = p.released_at;
    } else { pending += 1; base.الحالة = 'قيد التصحيح'; }
    skills[key] = base;
  }
  const status = pending > 0 ? 'قيد التصحيح' : released > 0 ? 'مكتمل' : 'لم تُقدَّم';
  return { الحالة: status, الوعد: pending > 0 ? 'يسمعها ويقرؤها إنسان — تكتمل بطاقتك على الرمز نفسه خلال 48 ساعة' : null, ...skills };
}
/** إصدار تقدير بشري: يحوّل درجات السُّلّم إلى حكم ومستوى مقدَّر (judge) */
export function humanRatingFrom(skill: ProductiveSkill, taskLevel: BankLevel, rawScores: unknown, note: unknown): { scores: RubricScores; estimated: BankLevel; verdict_ar: string; mean: number; note_ar: string | null } | null {
  const scores = validateScores(skill, rawScores); if (!scores) return null;
  for (const d of RUBRIC_DIMENSIONS[skill]) if (!(d in scores)) return null;
  const j = judge(skill, taskLevel, scores); const note_ar = typeof note === 'string' && note.trim() ? note.trim().slice(0, 600) : null;
  return { scores, estimated: j.estimated, verdict_ar: j.verdict_ar, mean: j.mean, note_ar };
}
/** المستوى العام الخماسي (قاعدة م4-د): الأدنى بين الاستقبالي والإنتاجي إن تباعدا درجتين، وإلا الاستقبالي يبقى */
export function overallWithProductive(receptive: BankLevel, productive: readonly BankLevel[]): BankLevel {
  if (!productive.length) return receptive; const idx = (l: BankLevel) => BANK_LEVELS.indexOf(l);
  const minP = productive.reduce((m, l) => (idx(l) < idx(m) ? l : m), productive[0]);
  return idx(receptive) - idx(minP) >= 2 ? minP : receptive;
}
export const FLOOR = FLOOR_LEVEL;
