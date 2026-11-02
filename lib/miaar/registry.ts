// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مِعيار — من أَثَر» (م1 «مِعيار يدخل البيت») — الثوابت والمنطق الصافي بلا قاعدة بيانات:
 *  المستويات والمهارات وأنواع البنود · خطة النموذج (50 بندًا) · السحب المبذور (كما في مِعيار حرفيًا)
 *  · «مِسبار» (خمسة بنود تحدّد نقطة البداية) · «ميزان الثقة» · حساب التقرير بمفاتيحه العربية نفسها (يقرؤه portal_placements وكل ما بُني على P7)
 *  · «احتياجاتي»: مضاعف الوقت والتعليمات الأبسط · رموز الدعوات ورموز الوصول للنتيجة.
 * المصطلح الرسمي في التقرير: «تقرير تحديد المستوى في اللغة العربية — مِعيار من أَثَر» و«توصية تسكين مبدئية».
 * م2-أ «بنك مِعيار الجديد»: «أرضية ما قبل A1» (اثنا عشر بندًا مصوّرًا تُقدَّم في التكيفي لمن لم يجتز A1) · سياسة المشغّل (سرعات حتى B1 · إعادات بحسب المستوى)
 *  · التقرير يضيف «ما_قبل_A1» و«نقطة_البداية_داخل_A1».
 */
export const MIAAR_NAMES_AR = {
  product: 'مِعيار — من أَثَر',
  official: 'اختبار تحديد المستوى في اللغة العربية',
  cta: 'حدّد مستواك',
  phase: 'مِعيار يدخل البيت',
  probe: 'مِسبار',
  probe_official: 'مرحلة التوجيه',
  confidence: 'ميزان الثقة',
  card: 'بطاقة المستوى',
  invites: 'دعوات مِعيار',
  poster_line: 'امسح وحدّد مستواك',
  nature: 'توصية تسكين مبدئية',
} as const;

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];
/** «أرضية ما قبل A1»: مستوى في البنك لا في سلّم التسكين — يُقدَّم بعد الإخفاق في A1 (التكيفي) ليميّز «من الصفر» عن «يعرف الحروف والكلمات» */
export const FLOOR_LEVEL = 'PRE_A1' as const;
export type BankLevel = Level | typeof FLOOR_LEVEL;
export const BANK_LEVELS: readonly BankLevel[] = [FLOOR_LEVEL, ...LEVELS];
export const FLOOR_INDEX = -1;
export const FLOOR_PLAN = { grammar_vocab: 4, reading: 4, listening: 4 } as const;
export const BANK_LEVEL_AR: Record<BankLevel, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
/** سياسة المشغّل بحسب المستوى: السرعات المتاحة (حتى B1) وعدد الإعادات؛ يمكن للمقطع أن يضبطها في meta */
export const PLAYER_POLICY: Record<BankLevel, { speeds: number[]; replays: number }> = {
  PRE_A1: { speeds: [0.75, 1], replays: 3 }, A1: { speeds: [0.75, 1, 1.25], replays: 2 }, A2: { speeds: [0.75, 1, 1.25], replays: 2 }, B1: { speeds: [0.75, 1, 1.25], replays: 2 },
  B2: { speeds: [1], replays: 1 }, C1: { speeds: [1], replays: 1 }, C2: { speeds: [1], replays: 1 },
};
export function playerPolicy(level: string, meta?: { speeds?: unknown; replays?: unknown } | null): { speeds: number[]; replays: number } {
  const base = PLAYER_POLICY[(isBankLevel(level) ? level : 'B2') as BankLevel];
  const speeds = Array.isArray(meta?.speeds) ? meta!.speeds.filter((x): x is number => typeof x === 'number' && x >= 0.5 && x <= 1.5) : [];
  const replays = typeof meta?.replays === 'number' && meta.replays >= 1 && meta.replays <= 5 ? Math.floor(meta.replays) : base.replays;
  return { speeds: speeds.length ? speeds : base.speeds, replays };
}
export const SKILLS = ['grammar_vocab', 'reading', 'listening'] as const;
export type Skill = (typeof SKILLS)[number];
export type ExamMode = 'comprehensive' | 'adaptive';
export type FinishReason = 'completed' | 'failed' | 'time' | 'quit';
export const ITEM_TYPES = ['mcq', 'picture_choice', 'picture_label', 'picture_sequence', 'true_false_notgiven', 'cloze_bank', 'matching', 'ordering', 'word_tap', 'short_dictation', 'writing_task', 'speaking_task'] as const;
/** م4-أ «صوتك وقلمك»: المهارتان الإنتاجيتان — بنود من نوع مهمة لا خيارات لها، تُقدَّر بسُلّم (lib/miaar/rubric.ts) */
export const PRODUCTIVE_SKILLS = ['writing', 'speaking'] as const;
export type ProductiveSkill = (typeof PRODUCTIVE_SKILLS)[number];
export const isProductiveSkill = (v: unknown): v is ProductiveSkill => typeof v === 'string' && (PRODUCTIVE_SKILLS as readonly string[]).includes(v);
export const PRODUCTIVE_ITEM_TYPES: Record<ProductiveSkill, ItemType> = { writing: 'writing_task', speaking: 'speaking_task' };
export const MIAAR_PRODUCTIVE_NAMES_AR = { narrative: 'صوتك وقلمك', official: 'المهارات الإنتاجية — الكتابة والتحدّث', writing_task: 'مهمة كتابة', speaking_task: 'مهمة تحدّث', rubric: 'سُلّم التقدير', room: 'غرفة الأداء', rater: 'مصحّح مِعيار' } as const;
export type ItemType = (typeof ITEM_TYPES)[number];
/** الأنواع التي يقدّمها م1 للمتقدّم (الباقي يُبنى في م4) */
export const M1_ITEM_TYPES: readonly ItemType[] = ['mcq', 'picture_choice', 'picture_label', 'true_false_notgiven'];
export const PASS_PERCENT = 60;
export const DURATION_SECONDS = 50 * 60;
export const COOKIE_NAME = 'miaar_placement_session';
export const CONTENT_VERSION = 'athar-m1';
/** بنود سُحبت من مِعيار لأسباب تحريرية — لا تُقدَّم حتى لو أُعيد استيرادها */
export const WITHDRAWN_CODES = new Set(['GV10', 'GV09', 'A2-GV-CEFR-013', 'B1-GV-CEFR-005', 'B2-GV-CEFR-005']);

export const FORM_PLAN: Record<Level, Record<Skill, number>> = {
  A1: { grammar_vocab: 4, reading: 2, listening: 2 },
  A2: { grammar_vocab: 4, reading: 2, listening: 2 },
  B1: { grammar_vocab: 4, reading: 3, listening: 2 },
  B2: { grammar_vocab: 4, reading: 3, listening: 2 },
  C1: { grammar_vocab: 2, reading: 3, listening: 3 },
  C2: { grammar_vocab: 2, reading: 2, listening: 4 },
};

export type Option = { id: string; text: string; image?: string | null; alt?: string | null };
export type PoolItem = {
  id: string; code: string; level: BankLevel; skill: Skill; type: ItemType; passageId: string | null; questionText: string;
  options: Option[]; correctOptionId: string; stimulus: { image?: string | null; alt?: string | null } | null; descriptor: string | null;
};
export type SecureItem = { id: string; level: BankLevel; skill: Skill; correctOptionId: string };
export type PublicQuestion = { id: string; level: BankLevel; skill: Skill; type: ItemType; passageId: string | null; questionText: string; options: Option[]; stimulus: { image: string | null; alt: string | null } | null };
export type PublicPassage = { id: string; level: string; skill: 'reading' | 'listening'; title: string; text: string; audioUrl: string | null; player?: { speeds: number[]; replays: number; twice?: boolean } };
export type PublicForm = { questions: PublicQuestion[]; passages: PublicPassage[] };
export type Candidate = { name: string; email: string; phone?: string; nativeLanguage?: string; studiedBefore?: boolean | null; purpose?: string };
export type Answer = { question_id: string; selected_option_id: string };
export type Access = { time: 1 | 1.25 | 1.5; simple: boolean; contrast: boolean; large: boolean };
export type Confidence = { grade: 'high' | 'medium' | 'border'; label_ar: string; label_en: string; note_ar: string };

export const levelIndex = (level: string): number => LEVELS.indexOf(level as Level);
export const isLevel = (v: unknown): v is Level => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);
export const isBankLevel = (v: unknown): v is BankLevel => v === FLOOR_LEVEL || isLevel(v);
/** فهرس المستوى في الجلسة: الأرضية = -1 */
export const bankLevelIndex = (level: string): number => level === FLOOR_LEVEL ? FLOOR_INDEX : levelIndex(level);
export const levelAtIndex = (index: number): BankLevel => index === FLOOR_INDEX ? FLOOR_LEVEL : (LEVELS[index] ?? LEVELS[0]);
export const isSkill = (v: unknown): v is Skill => typeof v === 'string' && (SKILLS as readonly string[]).includes(v);
export const isExamMode = (v: unknown): v is ExamMode => v === 'comprehensive' || v === 'adaptive';
export const isOptionId = (v: unknown): v is string => typeof v === 'string' && /^[a-f]$/.test(v);

export function cleanText(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''; }
export function normalizeCandidate(value: unknown): Candidate | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const name = cleanText(row.name, 120); const email = cleanText(row.email, 160).toLowerCase();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return {
    name, email, phone: cleanText(row.phone, 40) || undefined, nativeLanguage: cleanText(row.nativeLanguage, 60) || undefined,
    studiedBefore: typeof row.studiedBefore === 'boolean' ? row.studiedBefore : null, purpose: cleanText(row.purpose, 60) || undefined,
  };
}
/** «احتياجاتي» في مِعيار: تُطلب بلا إثبات؛ الوقت ×1.25/×1.5 · تعليمات أبسط · تباين · خطّ أكبر */
export function normalizeAccess(value: unknown): Access | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>; const time = r.time === 1.5 ? 1.5 : r.time === 1.25 ? 1.25 : 1;
  const a: Access = { time, simple: r.simple === true, contrast: r.contrast === true, large: r.large === true };
  return a.time !== 1 || a.simple || a.contrast || a.large ? a : null;
}
export const accessDuration = (base: number, access: Access | null): number => Math.round(base * (access?.time || 1));
export function accessLine(access: Access | null): string | null {
  if (!access) return null; const parts: string[] = [];
  if (access.time !== 1) parts.push(`وقت إضافي ×${access.time}`); if (access.simple) parts.push('تعليمات أبسط'); if (access.contrast) parts.push('تباين عالٍ'); if (access.large) parts.push('خطّ أكبر');
  return `أُجري الاختبار بتيسيرات وصولية: ${parts.join(' · ')}`;
}

// ---------- السحب المبذور (حرفيًا من مِعيار) ----------
export function drawSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
export function shufflePool<T>(items: readonly T[], seedText: string): T[] {
  const copy = items.slice(); let state = drawSeed(seedText) || 1;
  const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  for (let index = copy.length - 1; index > 0; index -= 1) { const swapIndex = Math.floor(next() * (index + 1)); const current = copy[index]; copy[index] = copy[swapIndex]; copy[swapIndex] = current; }
  return copy;
}
/**
 * سحب رموز النموذج من البنك المعتمد: الخطة نفسها (50 بندًا) — وإن قلّ المتاح في خلية (مستوى×مهارة) أُخذ ما توفّر
 * (مِعيار كان يفشل مغلقًا؛ هنا نفضّل اختبارًا أقصر على باب موصد، ويُسجَّل النقص في التقرير).
 * يعود null فقط إن خلا مستوى بأكمله من البنود.
 */
export function drawCodes(pool: readonly PoolItem[], seed: string): { codes: string[]; short: string[] } | null {
  const codes: string[] = []; const short: string[] = [];
  for (const level of LEVELS) {
    let levelCount = 0;
    for (const skill of SKILLS) {
      const needed = FORM_PLAN[level][skill];
      const available = shufflePool(pool.filter((item) => item.level === level && item.skill === skill), `${seed}:${level}:${skill}`);
      if (available.length < needed) short.push(`${level}/${skill}:${available.length}/${needed}`);
      const take = available.slice(0, needed); levelCount += take.length; codes.push(...take.map((item) => item.code));
    }
    if (levelCount === 0) return null;
  }
  // أرضية ما قبل A1: تُسحب إن وُجدت (لا تُعدّ نقصًا إن غابت) وتُقدَّم فقط عند الإخفاق في A1
  for (const skill of SKILLS) {
    const available = shufflePool(pool.filter((item) => item.level === FLOOR_LEVEL && item.skill === skill), `${seed}:${FLOOR_LEVEL}:${skill}`);
    codes.push(...available.slice(0, FLOOR_PLAN[skill]).map((item) => item.code));
  }
  return { codes, short };
}
export const hasFloor = (items: readonly { level: string }[]): boolean => items.some((i) => i.level === FLOOR_LEVEL);

// ---------- مِسبار (خمسة بنود؛ المفاتيح على الخادم فقط) ----------
export type ProbeItem = { id: string; level: Level; skill: string; prompt: string; options: Option[]; correct: string };
export const PROBE_ITEMS: readonly ProbeItem[] = [
  { id: 'warm-a1', level: 'A1', skill: 'vocab', prompt: 'هذا ___ جديد.', options: [{ id: 'a', text: 'كتاب' }, { id: 'b', text: 'كتبًا' }, { id: 'c', text: 'كتابين' }, { id: 'd', text: 'الكتبُ' }], correct: 'a' },
  { id: 'warm-a2', level: 'A2', skill: 'structures', prompt: 'أريد أن ___ إلى السوق بعد الظهر.', options: [{ id: 'a', text: 'أذهب' }, { id: 'b', text: 'يذهب' }, { id: 'c', text: 'ذهبتُم' }, { id: 'd', text: 'ذاهبٌ' }], correct: 'a' },
  { id: 'warm-b1', level: 'B1', skill: 'linking', prompt: 'إذا أنهيتُ التقرير اليوم، ___ نرسله صباح الغد.', options: [{ id: 'a', text: 'فسنرسله' }, { id: 'b', text: 'لن لأن' }, { id: 'c', text: 'لم نرسله أمس' }, { id: 'd', text: 'كي لا' }], correct: 'a' },
  { id: 'warm-b2', level: 'B2', skill: 'meaning', prompt: 'لم يقتصر الأمر على التأخير، ___ أثّر في جودة العمل.', options: [{ id: 'a', text: 'بل' }, { id: 'b', text: 'أو' }, { id: 'c', text: 'ثمّ فقط' }, { id: 'd', text: 'لا' }], correct: 'a' },
  { id: 'warm-c1', level: 'C1', skill: 'argument', prompt: 'ما يُحسب لهذه القراءة أنها لا تكتفي بوصف الظاهرة، ___ تعيد تفسير أسبابها.', options: [{ id: 'a', text: 'بل' }, { id: 'b', text: 'كي لا' }, { id: 'c', text: 'حتى لا' }, { id: 'd', text: 'إذ لم' }], correct: 'a' },
];
/** البنود للعرض: خيارات مخلوطة لكل زائر (البذرة من رمز الزائر) بلا مفاتيح */
export function probePublic(seed: string): Array<{ id: string; level: Level; skill: string; prompt: string; options: Option[] }> {
  return PROBE_ITEMS.map((item) => ({ id: item.id, level: item.level, skill: item.skill, prompt: item.prompt, options: shufflePool(item.options, `${seed}:${item.id}`).map((o) => ({ id: o.id, text: o.text })) }));
}
export function probeScore(answers: unknown): number {
  if (!answers || typeof answers !== 'object') return 0;
  const a = answers as Record<string, unknown>;
  return PROBE_ITEMS.filter((item) => a[item.id] === item.correct).length;
}
/** الفرقة الأولية كما في بوابة التحدّي (0–1 → A1 · 2 → A2 · 3 → B1 · 4 → B2 · 5 → C1) */
export function probeBand(score: number): Level { return score <= 1 ? 'A1' : score === 2 ? 'A2' : score === 3 ? 'B1' : score === 4 ? 'B2' : 'C1'; }
/** نقطة البداية: الشامل يبدأ من A1 دائمًا؛ التكيفي يبدأ من فرقة المِسبار بحدّ أقصى B1 (لا نستنتج أكثر من مستويين) */
export function probeStartIndex(score: number, mode: ExamMode): number { return mode === 'comprehensive' ? 0 : Math.min(levelIndex(probeBand(score)), 2); }

// ---------- قرار التقدّم (صعود/نزول) ----------
export type Progress = { currentIndex: number; startIndex: number; direction: 'up' | 'down'; mode: ExamMode; floor?: boolean };
export type Decision = { decision: 'advance' | 'descend' | 'fail' | 'complete' | 'floor'; nextIndex: number | null; direction: 'up' | 'down' };
/** بعد اكتمال بنود المستوى الحالي: صعود عند الاجتياز؛ عند الإخفاق في نقطة بداية أعلى من A1 ننزل مستوى (لا نحكم بالفشل من مستوى لم يُقَس ما تحته) */
export function nextStep(p: Progress, percent: number): Decision {
  const passed = p.mode === 'comprehensive' || percent >= PASS_PERCENT; const last = p.currentIndex === LEVELS.length - 1;
  if (p.currentIndex === FLOOR_INDEX) return { decision: 'fail', nextIndex: null, direction: p.direction };  /* بعد الأرضية ينتهي الاختبار */
  const failA1 = (): Decision => p.floor ? { decision: 'floor', nextIndex: FLOOR_INDEX, direction: p.direction } : { decision: 'fail', nextIndex: null, direction: p.direction };
  if (p.direction === 'down') {
    if (passed) return { decision: 'complete', nextIndex: null, direction: 'down' };
    if (p.currentIndex === 0) return failA1();
    return { decision: 'descend', nextIndex: p.currentIndex - 1, direction: 'down' };
  }
  if (last) return { decision: 'complete', nextIndex: null, direction: 'up' };
  if (passed) return { decision: 'advance', nextIndex: p.currentIndex + 1, direction: 'up' };
  if (p.currentIndex === p.startIndex && p.startIndex > 0) return { decision: 'descend', nextIndex: p.currentIndex - 1, direction: 'down' };
  return failA1();
}
/** حكم الأرضية: ≥ 60% → يعرف الحروف والكلمات الأساسية (يبدأ A1 مباشرة)؛ وإلا يبدأ من الصفر */
export type FloorStat = { offered: boolean; correct: number; answered: number; total: number; percent: number; verdict: 'knows_basics' | 'from_zero' | null };
export function floorStat(scored: readonly SecureItem[], selected: ReadonlyMap<string, string>): FloorStat {
  const items = scored.filter((i) => i.level === FLOOR_LEVEL); const answered = items.filter((i) => selected.has(i.id));
  const correct = answered.filter((i) => selected.get(i.id) === i.correctOptionId).length; const percent = answered.length ? Math.round((correct / answered.length) * 100) : 0;
  const offered = answered.length > 0;
  return { offered, correct, answered: answered.length, total: items.length, percent, verdict: !offered ? null : percent >= PASS_PERCENT ? 'knows_basics' : 'from_zero' };
}
export const FLOOR_VERDICT_AR: Record<'knows_basics' | 'from_zero', string> = { knows_basics: 'يعرف الحروف والكلمات الأساسية — يبدأ A1 مباشرة', from_zero: 'يبدأ من الصفر — الحروف والأصوات أولًا' };

// ---------- التقرير (المفاتيح العربية نفسها + إضافات م1) ----------
export function reasonLabel(reason: FinishReason): string {
  return { completed: 'أكملت جميع المستويات حتى النهاية', failed: 'إيقاف تدرّجي — لم تُستوفَ نسبة الانتقال', time: 'انتهى وقت الاختبار', quit: 'إنهاء مبكر بقرارك' }[reason];
}
export const skillLabel = (skill: string): string => (({ grammar_vocab: 'القواعد والمفردات', reading: 'القراءة', listening: 'الاستماع', writing: 'الكتابة', speaking: 'التحدّث' }) as Record<string, string>)[skill] ?? skill;
export function skillLevel(percent: number, answered: number): string {
  if (!answered) return '—'; if (percent >= 85) return 'C1'; if (percent >= 65) return 'B2'; if (percent >= 45) return 'B1'; if (percent >= 25) return 'A2'; return 'A1';
}
export type LevelStat = { level: Level; correct: number; answered: number; total: number; percent: number; status: 'passed' | 'failed' | 'partial' | 'skipped'; passedThreshold: boolean };
export function levelStats(scored: readonly SecureItem[], selected: ReadonlyMap<string, string>, startIndex: number): LevelStat[] {
  return LEVELS.map((level, index) => {
    const items = scored.filter((item) => item.level === level); const answered = items.filter((item) => selected.has(item.id));
    const correct = answered.filter((item) => selected.get(item.id) === item.correctOptionId).length;
    const percent = answered.length ? Math.round((correct / answered.length) * 100) : 0;
    const complete = items.length > 0 && answered.length === items.length; const passedThreshold = complete && percent >= PASS_PERCENT;
    const skipped = index < startIndex && answered.length === 0;
    return { level, correct, answered: answered.length, total: items.length, percent, status: skipped ? 'skipped' : !complete ? 'partial' : passedThreshold ? 'passed' : 'failed', passedThreshold: passedThreshold || skipped };
  });
}
/** المستوى المثبت ومستوى الالتحاق: أول مستوى غير مجتاز هو الالتحاق؛ المستويات المتخطّاة (أدنى من نقطة البداية) تُعدّ مجتازة */
export function placementLevels(stats: readonly LevelStat[]): { demonstrated: Level; entry: Level; completedAll: boolean } {
  let demonstrated: Level = LEVELS[0]; let entry: Level = LEVELS[0]; let completedAll = true;
  for (const s of stats) { if (s.status !== 'passed' && s.status !== 'skipped') { entry = s.level; completedAll = false; break; } demonstrated = s.level; entry = demonstrated; }
  return { demonstrated, entry, completedAll };
}
/** ميزان الثقة: البُعد عن حدّ 60% في مستوى الإثبات ومستوى الالتحاق (كلاهما ≥ 20 نقطة → مؤكَّد · ≥ 10 → محتمل · وإلا على الحدّ) */
export function confidence(stats: readonly LevelStat[], demonstrated: Level, entry: Level, completedAll: boolean, inferred: number): Confidence {
  const d = stats.find((s) => s.level === demonstrated); const e = stats.find((s) => s.level === entry);
  const margins: number[] = [];
  if (d && d.status === 'passed') margins.push(d.percent - PASS_PERCENT);
  if (!completedAll && e && e.status === 'failed') margins.push(PASS_PERCENT - e.percent);
  if (d && d.status === 'skipped') margins.push(0);
  const m = margins.length ? Math.min(...margins) : 0;
  let grade: Confidence['grade'] = m >= 20 ? 'high' : m >= 10 ? 'medium' : 'border';
  if (inferred > 0 && grade === 'high' && d?.status === 'skipped') grade = 'medium';
  const label = { high: ['مؤكَّد', 'Confirmed'], medium: ['محتمل', 'Likely'], border: ['على الحدّ', 'Borderline'] }[grade];
  const preA1 = !completedAll && entry === demonstrated;  /* لم يجتز أول مستوى مُقاس (A1) */
  const note = preA1
    ? (grade === 'high' ? `لم يجتز ${entry} بهامش واضح — يبدأ من أول ${entry} (ما قبل A1).` : `لم يجتز ${entry} لكن النتيجة قريبة من الحدّ؛ يُستحسن تأكيدها بمقابلة قصيرة.`)
    : grade === 'high'
    ? `اجتاز ${demonstrated} بهامش واضح${completedAll ? '' : ` ولم يجتز ${entry} بهامش واضح`} — القرار الآلي كافٍ لتسكين مبدئي.`
    : grade === 'medium' ? `النتيجة تميل إلى ${demonstrated}${completedAll ? '' : ` مع ${entry} كمستوى التحاق`}؛ يُستحسن تأكيدها بمقابلة قصيرة.`
      : `النتيجة على الحدّ بين ${demonstrated} و${entry}؛ يلزم قرار بشري (مقابلة أو إعادة اختبار بنموذج آخر).`;
  return { grade, label_ar: label[0], label_en: label[1], note_ar: note };
}
export type ReportInput = {
  candidate: Candidate; examMode: ExamMode; startIndex: number; durationSeconds: number; remainingSeconds: number; source: string; title: string;
  access: Access | null; inviteLabel: string | null; short: string[];
};
export function calculateReport(input: ReportInput, answers: Answer[], reason: FinishReason, scoredAll: readonly SecureItem[], stems: ReadonlyMap<string, string> = new Map()) {
  const selected = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));
  const floor = floorStat(scoredAll, selected);
  const scored = scoredAll.filter((item) => item.level !== FLOOR_LEVEL);  /* الأرضية لا تدخل في إحصاء المهارات والمستويات */
  const mainAnswers = answers.filter((a) => scored.some((i) => i.id === a.question_id));
  const totalCorrect = scored.filter((item) => selected.get(item.id) === item.correctOptionId).length;
  const skillStats: Record<string, { correct: number; answered: number; total: number; percent: number; level: string }> = {};
  for (const skill of SKILLS) {
    const items = scored.filter((item) => item.skill === skill); const answered = items.filter((item) => selected.has(item.id));
    const correct = answered.filter((item) => selected.get(item.id) === item.correctOptionId).length;
    const percent = answered.length ? Math.round((correct / answered.length) * 100) : 0;
    skillStats[skill] = { correct, answered: answered.length, total: items.length, percent, level: skillLevel(percent, answered.length) };
  }
  const stats = levelStats(scored, selected, input.startIndex);
  const { demonstrated, entry, completedAll } = placementLevels(stats);
  const inferred = stats.filter((s) => s.status === 'skipped').length;
  const conf = confidence(stats, demonstrated, entry, completedAll, inferred);
  const measured = Object.keys(skillStats).filter((s) => skillStats[s].answered > 0);
  const weakest = measured.length ? measured.reduce((w, s) => (skillStats[w].percent <= skillStats[s].percent ? w : s)) : null;
  const placementText = completedAll
    ? 'أكمل المتقدم جميع المستويات المقدمة. يوصى بالتحقق الكتابي والشفهي قبل إصدار حكم شامل في المستوى الأعلى.'
    : `مستوى الالتحاق المقترح: ${entry}. المستوى المثبت مبدئيًا: ${demonstrated}.`;
  const weakestText = weakest ? ` ركّز على مهارة ${skillLabel(weakest)} لمدة 4 أسابيع (النسبة ${skillStats[weakest].percent}%) ثم أعد التقييم.` : '';
  const elapsed = Math.max(0, input.durationSeconds - input.remainingSeconds);
  const mm = Math.floor(elapsed / 60).toString().padStart(2, '0'); const ss = (elapsed % 60).toString().padStart(2, '0');
  const c = input.candidate; const accessText = accessLine(input.access);
  return {
    بيانات_المتقدم: {
      الاسم: c.name || '—', البريد_الإلكتروني: c.email || '—', الهاتف: c.phone || '—', اللغة_الأم: c.nativeLanguage || '—',
      دراسة_سابقة_للعربية: c.studiedBefore === null || c.studiedBefore === undefined ? 'غير محدد' : c.studiedBefore ? 'نعم' : 'لا', الغرض_من_الاختبار: c.purpose || '—',
    },
    المستوى_العام: demonstrated,
    الدرجة_الموضوعية: `${totalCorrect}/${Math.max(1, mainAnswers.length)}`,
    النسبة_العامة: Math.round((totalCorrect / Math.max(1, mainAnswers.length)) * 100),
    تفصيل_المهارات: { القواعد_والمفردات: skillStats.grammar_vocab.level, القراءة: skillStats.reading.level, الاستماع: skillStats.listening.level },
    احصائيات: skillStats,
    مستويات_تفصيلية: stats,
    سبب_الانتهاء: reasonLabel(reason),
    الوقت_المستغرق: `${mm}:${ss}`,
    التوصية: `${placementText}${weakestText}${conf.grade === 'border' ? ' النتيجة على الحدّ — يُستحسن قرار بشري.' : ''}`,
    تاريخ: new Date().toISOString(),
    ملخص_التسكين: { المستوى_المثبت: demonstrated, مستوى_الالتحاق_المقترح: entry, طبيعة_النتيجة: MIAAR_NAMES_AR.nature, دون_A1: !completedAll && entry === demonstrated, نقطة_البداية_داخل_A1: floor.verdict ? FLOOR_VERDICT_AR[floor.verdict] : null },
    إصدار_البنك: input.source,
    طريقة_اختيار_الأسئلة: input.title,
    عدد_البنود_المقدمة: answers.length,
    بنود_الجلسة: scoredAll.map((item) => { const chosen = selected.get(item.id); return { الرمز: item.id, المستوى: item.level, المهارة: item.skill, النص: (stems.get(item.id) || '').replace(/\s+/g, ' ').trim().slice(0, 180), النتيجة: chosen == null ? 'لم يُجب' : chosen === item.correctOptionId ? 'صحيح' : 'غير صحيح' }; }),
    // م1
    الجهة_المصدرة: MIAAR_NAMES_AR.product,
    نمط_الاختبار: input.examMode === 'adaptive' ? 'تكيفي' : 'شامل',
    نقطة_البداية: LEVELS[input.startIndex] ?? 'A1',
    مستويات_متخطاة: inferred,
    ميزان_الثقة: { الدرجة: conf.label_ar, الرمز: conf.grade, الشرح: conf.note_ar },
    تيسيرات: accessText,
    الدعوة: input.inviteLabel,
    نقص_البنك: input.short.length ? input.short : null,
    // م2-أ
    ما_قبل_A1: floor.offered ? { قُدِّمت: true, صحيح: floor.correct, من: floor.answered, النسبة: floor.percent, الحكم: FLOOR_VERDICT_AR[floor.verdict!] } : { قُدِّمت: false },
  };
}
export type Report = ReturnType<typeof calculateReport>;

// ---------- رموز ----------
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function shortCode(len: number, rnd: () => number = Math.random): string { let s = ''; for (let i = 0; i < len; i += 1) s += CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)]; return s; }
export const isShortCode = (v: unknown, len = 8): v is string => typeof v === 'string' && new RegExp(`^[${CODE_ALPHABET}]{${len}}$`).test(v);
/** رمز نتيجة قابل للعودة: ML-XXXX-XXXX */
export function resultCode(rnd: () => number = Math.random): string { return `ML-${shortCode(4, rnd)}-${shortCode(4, rnd)}`; }
export const isResultCode = (v: unknown): v is string => typeof v === 'string' && /^ML-[23456789A-HJKMNP-Z]{4}-[23456789A-HJKMNP-Z]{4}$/.test(v);

/** «أستطيع أن…» — ثلاث عبارات لكل مستوى تُعرض في بطاقة المستوى (عربية + إنجليزية؛ بقية اللغات تأخذ الإنجليزية) */
export const CAN_DO: Record<Level, { ar: string[]; en: string[] }> = {
  A1: { ar: ['أعرّف بنفسي وأسأل عن الاسم والبلد', 'أفهم لافتات وأرقامًا وأسعارًا بسيطة', 'أطلب شيئًا بسيطًا في مقهى أو متجر'], en: ['Introduce myself and ask about name and country', 'Understand simple signs, numbers and prices', 'Order something simple in a café or shop'] },
  A2: { ar: ['أتحدّث عن يومي وعملي وعائلتي بجمل قصيرة', 'أفهم رسالة بسيطة وإعلانًا قصيرًا', 'أسأل عن الطريق والمواعيد والأسعار وأفهم الردّ'], en: ['Talk about my day, work and family in short sentences', 'Understand a simple message and a short notice', 'Ask about directions, times and prices and understand the answer'] },
  B1: { ar: ['أتابع حديثًا واضحًا عن موضوع مألوف', 'أقرأ مقالًا قصيرًا وأستخرج فكرته ورأيه', 'أروي تجربة وأشرح رأيي بأسباب'], en: ['Follow clear speech on a familiar topic', 'Read a short article and extract its main idea and opinion', 'Narrate an experience and explain my opinion with reasons'] },
  B2: { ar: ['أناقش قضية معاصرة وأميّز وجهات النظر', 'أفهم نشرة أخبار وعرضًا مهنيًا بوتيرة طبيعية', 'أكتب نصًّا متماسكًا بحجّة واضحة'], en: ['Discuss a contemporary issue and distinguish viewpoints', 'Understand a news bulletin and a professional presentation at natural pace', 'Write a coherent text with a clear argument'] },
  C1: { ar: ['أفهم نصوصًا طويلة ومعقّدة ومعانيها الضمنية', 'أتابع نقاشًا متخصّصًا وأدرك النبرة والتلميح', 'أستعمل اللغة بمرونة في السياقات الأكاديمية والمهنية'], en: ['Understand long complex texts and their implicit meaning', 'Follow a specialised discussion and recognise tone and allusion', 'Use the language flexibly in academic and professional settings'] },
  C2: { ar: ['أفهم كل ما أقرأ وأسمع تقريبًا، بما فيه الأدبي والتراثي', 'أميّز طبقات المعنى والأسلوب والمقصد', 'أنقد حجّة وأعيد صياغتها بدقّة'], en: ['Understand virtually everything I read and hear, including literary and classical texts', 'Recognise layers of meaning, style and intent', 'Critique an argument and restate it precisely'] },
};
export const LEVEL_AR: Record<Level, string> = { A1: 'مبتدئ', A2: 'أساسي', B1: 'متوسط', B2: 'فوق المتوسط', C1: 'متقدم', C2: 'إتقان' };
