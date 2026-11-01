// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مخطّطات النماذج (م2-ب) — «منشئ النماذج»
 *  المخطّط (question_bank_blueprints) يصف: نوع الاختبار · المستويات · عدد البنود لكل خلية (مستوى×مهارة) · طريقة السحب · المدة · حدّ الاجتياز · الأرضية · المِسبار.
 *  الخطة (Plan) هي الصورة المُحكمة للمخطّط التي تُثبَّت في الجلسة لحظة البدء (placement_secure_sessions.plan) فلا يتغيّر سلوك جلسة قائمة إن عُدّل المخطّط لاحقًا.
 *  السحب عشوائي في كل جلسة دائمًا:
 *   - random      : من كل البنود المعتمدة في الخلية (النمط العشوائي الكامل)
 *   - expert_pool : من «سلّة الخبير» في الخلية (المسؤول يختار سلّة أكبر من العدد المطلوب، والجلسة تسحب منها عشوائيًا)
 *   - fixed       : بنود ثابتة يختارها الخبير (لا يتغيّر إلا ترتيبها وترتيب الخيارات)
 *  السلّم (ladder):
 *   - adaptive : صعود/نزول كما في مِعيار (اجتياز 60% للصعود، ونزول من نقطة بداية أعلى من A1)
 *   - linear   : كل المستويات المختارة بالتتابع (الشامل والقصير)
 *   - single   : مستوى واحد ثم حكم اجتياز/عدم اجتياز بحدّ المخطّط (اجتياز مستوى)
 */
import {
  LEVELS, SKILLS, FORM_PLAN, FLOOR_PLAN, FLOOR_LEVEL, FLOOR_INDEX, PASS_PERCENT, DURATION_SECONDS, shufflePool, levelIndex, isLevel, isSkill, cleanText, PROBE_ITEMS,
} from './registry';
import type { Level, Skill, PoolItem, Option, ExamMode, Decision } from './registry';

export const TEST_TYPES = ['placement', 'comprehensive', 'adaptive', 'short', 'level', 'custom'] as const;
export type TestType = (typeof TEST_TYPES)[number];
export const DRAW_MODES = ['random', 'expert_pool', 'fixed'] as const;
export type DrawMode = (typeof DRAW_MODES)[number];
export type Ladder = 'adaptive' | 'linear' | 'single';
export type Counts = Record<Level, Record<Skill, number>>;
export type Plan = {
  code: string; name_ar: string; name_en: string; description_ar: string; type: TestType; ladder: Ladder; levels: Level[]; counts: Counts;
  floor: boolean; probe: boolean; cut: number; durationSeconds: number; draw: DrawMode; shuffleOptions: boolean;
  startLevel: Level | null;              /* التكيفي بنقطة بداية يحدّدها المسؤول (بلا مِسبار) */
  pool: Record<string, string[]>;        /* "A1:reading" → رموز البنود (سلّة الخبير أو الثابت) */
};
export type BlueprintRow = {
  id: string; code: string; name_ar: string; description_ar: string | null; test_type: string; requirements: Record<string, unknown> | null;
  duration_minutes: number; is_system: boolean; purpose: string; level: string | null; cut_percent: number;
  status: string; is_public: boolean; name_en: string | null; sort_order: number; created_at?: string; updated_at?: string;
};

/** أنواع الاختبارات: الاسم الرسمي والشرح والسلّم الافتراضي */
export const TEST_TYPE_INFO: Record<TestType, { name_ar: string; name_en: string; hint_ar: string; ladder: Ladder; door: 'adaptive' | 'comprehensive' | 'short' | 'level' | 'custom' }> = {
  placement:     { name_ar: 'تحديد المستوى (تكيفي)', name_en: 'Placement — adaptive', hint_ar: 'مِسبار قصير يحدّد نقطة البداية، ثم صعود/نزول حتى يتّضح المستوى، مع أرضية ما قبل A1 لمن لم يجتز A1.', ladder: 'adaptive', door: 'adaptive' },
  comprehensive: { name_ar: 'الاختبار الشامل', name_en: 'Comprehensive', hint_ar: 'كل المستويات المختارة من A1 حتى C2 بالتتابع دون توقّف — صورة كاملة للمهارات الثلاث.', ladder: 'linear', door: 'comprehensive' },
  adaptive:      { name_ar: 'تكيفي من نقطة محدّدة', name_en: 'Adaptive from a set level', hint_ar: 'يبدأ من مستوى يحدّده المسؤول (بلا مِسبار) ويصعد أو ينزل حسب الأداء — مناسب للدعوات الموجّهة.', ladder: 'adaptive', door: 'adaptive' },
  short:         { name_ar: 'التشخيصي القصير', name_en: 'Short diagnostic', hint_ar: 'بند واحد لكل خلية (مستوى×مهارة) — 18 بندًا في نحو ربع ساعة لمؤشر سريع.', ladder: 'linear', door: 'short' },
  level:         { name_ar: 'اجتياز مستوى', name_en: 'Level exam', hint_ar: 'اختبار مستوى واحد بحدّ اجتياز — لنهاية المستوى أو الترفيع.', ladder: 'single', door: 'level' },
  custom:        { name_ar: 'خاص', name_en: 'Custom', hint_ar: 'المسؤول يختار المستويات والأعداد والسلّم بحرّية.', ladder: 'linear', door: 'custom' },
};
export const DRAW_MODE_INFO: Record<DrawMode, { name_ar: string; hint_ar: string }> = {
  random:      { name_ar: 'عشوائي كامل', hint_ar: 'كل جلسة تسحب بنودها عشوائيًا من كل البنود المعتمدة في الخلية.' },
  expert_pool: { name_ar: 'عشوائي ضمن سلّة الخبير', hint_ar: 'تختار سلّة بنود لكل خلية (أكبر من العدد المطلوب)، وكل جلسة تسحب منها عشوائيًا.' },
  fixed:       { name_ar: 'ثابت يختاره الخبير', hint_ar: 'البنود نفسها لكل متقدّم؛ يتبدّل ترتيبها وترتيب الخيارات فقط.' },
};
export const isTestType = (v: unknown): v is TestType => typeof v === 'string' && (TEST_TYPES as readonly string[]).includes(v);
export const isDrawMode = (v: unknown): v is DrawMode => typeof v === 'string' && (DRAW_MODES as readonly string[]).includes(v);
export const cellKey = (level: string, skill: string) => `${level}:${skill}`;
export const emptyCounts = (): Counts => Object.fromEntries(LEVELS.map((l) => [l, Object.fromEntries(SKILLS.map((s) => [s, 0]))])) as Counts;
export const planTotal = (plan: Pick<Plan, 'levels' | 'counts'>): number => plan.levels.reduce((sum, l) => sum + SKILLS.reduce((a, s) => a + (plan.counts[l]?.[s] || 0), 0), 0);
export const planIndices = (plan: Pick<Plan, 'levels'>): number[] => plan.levels.map(levelIndex).filter((i) => i >= 0).sort((a, b) => a - b);
export const examModeOf = (plan: Pick<Plan, 'ladder'>): ExamMode => plan.ladder === 'adaptive' ? 'adaptive' : 'comprehensive';

/** الخطط النظامية (تُزرع في SQL أيضًا؛ هنا احتياط إن غاب الجدول) */
export function systemPlan(type: TestType, level: Level = 'B1'): Plan {
  const info = TEST_TYPE_INFO[type];
  const base: Plan = { code: `SYS-${type.toUpperCase()}`, name_ar: info.name_ar, name_en: info.name_en, description_ar: info.hint_ar, type, ladder: info.ladder, levels: [...LEVELS], counts: JSON.parse(JSON.stringify(FORM_PLAN)), floor: false, probe: false, cut: PASS_PERCENT, durationSeconds: DURATION_SECONDS, draw: 'random', shuffleOptions: true, startLevel: null, pool: {} };
  if (type === 'placement') return { ...base, floor: true, probe: true };
  if (type === 'adaptive') return { ...base, startLevel: 'A1' };
  if (type === 'short') { const c = emptyCounts(); for (const l of LEVELS) for (const s of SKILLS) c[l][s] = 1; return { ...base, counts: c, durationSeconds: 15 * 60 }; }
  if (type === 'level') { const c = emptyCounts(); c[level] = { grammar_vocab: 8, reading: 6, listening: 6 }; return { ...base, code: `SYS-LEVEL-${level}`, name_ar: `اجتياز مستوى ${level}`, name_en: `Level ${level} exam`, levels: [level], counts: c, durationSeconds: 30 * 60, cut: 70 }; }
  return base;
}

/** تحويل صف المخطّط إلى خطة مُحكمة (كل حقل يُنظَّف؛ الأخطاء تُرجع مع الخطة المصحَّحة) */
export function planFromBlueprint(row: Partial<BlueprintRow> & { requirements?: unknown }): { plan: Plan; errors: string[] } {
  const errors: string[] = [];
  const type: TestType = isTestType(row.test_type) ? row.test_type : 'custom'; if (!isTestType(row.test_type)) errors.push('نوع الاختبار غير معروف');
  const req = row.requirements && typeof row.requirements === 'object' ? (row.requirements as Record<string, unknown>) : {};
  const info = TEST_TYPE_INFO[type];
  const ladder: Ladder = type === 'custom' && (req.ladder === 'adaptive' || req.ladder === 'linear' || req.ladder === 'single') ? req.ladder : info.ladder;
  let levels: Level[] = Array.isArray(req.levels) ? (req.levels as unknown[]).filter(isLevel) : [];
  if (type === 'level') { const l = isLevel(row.level) ? row.level : levels[0]; levels = l ? [l] : []; }
  if (!levels.length) { if (type === 'level') errors.push('اختبار اجتياز المستوى يحتاج مستوى واحدًا'); else levels = [...LEVELS]; }
  levels = [...new Set(levels)].sort((a, b) => levelIndex(a) - levelIndex(b));
  if (ladder === 'single' && levels.length !== 1) errors.push('سلّم «مستوى واحد» يقبل مستوى واحدًا فقط');
  const counts = emptyCounts(); const rawCounts = req.counts && typeof req.counts === 'object' ? (req.counts as Record<string, Record<string, unknown>>) : null;
  for (const l of levels) for (const s of SKILLS) {
    const v = rawCounts ? Number(rawCounts[l]?.[s]) : type === 'short' ? 1 : FORM_PLAN[l][s];
    counts[l][s] = Number.isFinite(v) ? Math.max(0, Math.min(40, Math.floor(v))) : 0;
  }
  const total = planTotal({ levels, counts }); if (total === 0) errors.push('لا بنود في الخطة');
  for (const l of levels) if (SKILLS.every((s) => counts[l][s] === 0)) errors.push(`المستوى ${l} بلا بنود`);
  const draw: DrawMode = isDrawMode(req.draw) ? req.draw : 'random';
  const pool: Record<string, string[]> = {};
  if (draw !== 'random') {
    const rawPool = req.pool && typeof req.pool === 'object' ? (req.pool as Record<string, unknown>) : {};
    for (const l of levels) for (const s of SKILLS) {
      const need = counts[l][s]; if (!need) continue;
      const codes = Array.isArray(rawPool[cellKey(l, s)]) ? [...new Set((rawPool[cellKey(l, s)] as unknown[]).map((c) => cleanText(c, 60)).filter(Boolean))] : [];
      pool[cellKey(l, s)] = codes;
      if (codes.length < need) errors.push(`الخلية ${l}/${s}: السلّة ${codes.length} أقل من المطلوب ${need}`);
      else if (draw === 'fixed' && codes.length !== need) errors.push(`الخلية ${l}/${s}: الثابت يحتاج ${need} بندًا بالضبط (المختار ${codes.length})`);
    }
  }
  const minutes = Number(row.duration_minutes); const durationSeconds = Number.isFinite(minutes) && minutes >= 5 && minutes <= 240 ? Math.floor(minutes) * 60 : DURATION_SECONDS;
  const cutRaw = Number(row.cut_percent); const cut = Number.isFinite(cutRaw) && cutRaw >= 30 && cutRaw <= 100 ? Math.floor(cutRaw) : PASS_PERCENT;
  const startLevel = ladder === 'adaptive' && type !== 'placement' && isLevel(req.start_level) && levels.includes(req.start_level) ? req.start_level : ladder === 'adaptive' && type !== 'placement' ? levels[0] : null;
  const probe = type === 'placement' ? req.probe !== false : ladder === 'adaptive' && req.probe === true;
  const floor = ladder === 'adaptive' ? req.floor !== false : req.floor === true;
  const plan: Plan = {
    code: cleanText(row.code, 40) || 'SYS-CUSTOM', name_ar: cleanText(row.name_ar, 120) || info.name_ar, name_en: cleanText(row.name_en, 120) || info.name_en, description_ar: cleanText(row.description_ar, 400) || info.hint_ar,
    type, ladder, levels, counts, floor, probe, cut, durationSeconds, draw, shuffleOptions: req.shuffle_options !== false, startLevel, pool,
  };
  return { plan, errors };
}

/** قراءة الخطة المثبّتة في الجلسة (أي شكل قديم → null فيعود المحرّك إلى سلوك م1) */
export function planFromSession(value: unknown): Plan | null {
  if (!value || typeof value !== 'object') return null; const v = value as Partial<Plan>;
  if (!isTestType(v.type) || !Array.isArray(v.levels) || !v.levels.every(isLevel) || !v.counts) return null;
  return { ...systemPlan(v.type), ...v, levels: v.levels as Level[] } as Plan;
}

/** السحب: عشوائي لكل جلسة (البذرة = رمز الجلسة) ضمن الخلية حسب طريقة السحب؛ النقص يُسجَّل ولا يغلق الباب */
export function drawPlan(pool: readonly PoolItem[], seed: string, plan: Plan): { codes: string[]; short: string[] } | null {
  const codes: string[] = []; const short: string[] = [];
  for (const level of plan.levels) {
    let levelCount = 0;
    for (const skill of SKILLS) {
      const needed = plan.counts[level][skill]; if (!needed) continue;
      let cell = pool.filter((item) => item.level === level && item.skill === skill);
      if (plan.draw !== 'random') { const basket = new Set(plan.pool[cellKey(level, skill)] || []); const chosen = cell.filter((i) => basket.has(i.code)); if (chosen.length) cell = chosen; else short.push(`${level}/${skill}:basket-empty`); }
      const available = shufflePool(cell, `${seed}:${level}:${skill}`);
      if (available.length < needed) short.push(`${level}/${skill}:${available.length}/${needed}`);
      const take = available.slice(0, needed); levelCount += take.length; codes.push(...take.map((item) => item.code));
    }
    if (levelCount === 0) return null;
  }
  if (plan.floor) for (const skill of SKILLS) {
    const available = shufflePool(pool.filter((item) => item.level === FLOOR_LEVEL && item.skill === skill), `${seed}:${FLOOR_LEVEL}:${skill}`);
    codes.push(...available.slice(0, FLOOR_PLAN[skill]).map((item) => item.code));
  }
  return { codes, short };
}

/** نقطة البداية حسب الخطة: تحديد المستوى من المِسبار (بحدّ B1 وضمن مستويات الخطة) · التكيفي الموجَّه من مستوى المسؤول · غير ذلك أول مستوى */
export function planStartIndex(plan: Plan, probeBandIndex: number): number {
  const indices = planIndices(plan); const first = indices[0] ?? 0;
  if (plan.ladder !== 'adaptive') return first;
  if (plan.type !== 'placement' && plan.startLevel) return levelIndex(plan.startLevel);
  const wanted = Math.min(probeBandIndex, 2); const eligible = indices.filter((i) => i <= wanted);
  return eligible.length ? eligible[eligible.length - 1] : first;
}

/** قرار التقدّم ضمن مستويات الخطة (عام لكل السلالم) */
export type PlanProgress = { currentIndex: number; startIndex: number; direction: 'up' | 'down'; hasFloor: boolean };
export function nextStepPlan(plan: Plan, p: PlanProgress, percent: number): Decision {
  const indices = planIndices(plan); const pos = indices.indexOf(p.currentIndex);
  if (p.currentIndex === FLOOR_INDEX) return { decision: 'fail', nextIndex: null, direction: p.direction };
  if (pos < 0) return { decision: 'complete', nextIndex: null, direction: p.direction };
  const passed = plan.ladder !== 'adaptive' || percent >= plan.cut; const last = pos === indices.length - 1;
  if (plan.ladder === 'single') return { decision: 'complete', nextIndex: null, direction: 'up' };
  const failFirst = (): Decision => p.hasFloor && plan.floor ? { decision: 'floor', nextIndex: FLOOR_INDEX, direction: p.direction } : { decision: 'fail', nextIndex: null, direction: p.direction };
  if (p.direction === 'down') {
    if (passed) return { decision: 'complete', nextIndex: null, direction: 'down' };
    if (pos === 0) return failFirst();
    return { decision: 'descend', nextIndex: indices[pos - 1], direction: 'down' };
  }
  if (last) return { decision: 'complete', nextIndex: null, direction: 'up' };
  if (passed) return { decision: 'advance', nextIndex: indices[pos + 1], direction: 'up' };
  if (p.currentIndex === p.startIndex && pos > 0) return { decision: 'descend', nextIndex: indices[pos - 1], direction: 'down' };
  return failFirst();
}

/** حكم اجتياز المستوى (ladder=single) للتقرير */
export function levelVerdict(plan: Plan, stats: readonly { level: string; percent: number; answered: number; total: number }[]): { المستوى: string; النسبة: number; حد_الاجتياز: number; اجتاز: boolean; مكتمل: boolean } | null {
  if (plan.ladder !== 'single') return null; const level = plan.levels[0]; const s = stats.find((x) => x.level === level); if (!s) return null;
  return { المستوى: level, النسبة: s.percent, حد_الاجتياز: plan.cut, اجتاز: s.total > 0 && s.answered === s.total && s.percent >= plan.cut, مكتمل: s.total > 0 && s.answered === s.total };
}

// ---------- المِسبار المتجدّد: بند لكل مستوى A1..C1 من البنك المعتمد (قواعد ومفردات، بلا وسائط)، والبنود الثابتة احتياط ----------
export type ProbePublicItem = { id: string; level: Level; skill: string; prompt: string; options: Option[] };
const PROBE_LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const probeEligible = (i: PoolItem) => i.skill === 'grammar_vocab' && i.type === 'mcq' && !i.stimulus && !i.passageId && i.questionText.length <= 160 && i.options.every((o) => !o.image);
export function probeFromPool(pool: readonly PoolItem[], seed: string, exclude: readonly string[] = []): ProbePublicItem[] {
  const skip = new Set(exclude);
  return PROBE_LEVELS.map((level) => {
    let cell = shufflePool(pool.filter((i) => i.level === level && probeEligible(i) && !skip.has(i.code)), `${seed}:probe:${level}`);
    if (!cell.length) cell = shufflePool(pool.filter((i) => i.level === level && probeEligible(i)), `${seed}:probe:${level}`);
    const item = cell[0];
    if (item) return { id: item.code, level, skill: 'vocab', prompt: item.questionText, options: shufflePool(item.options, `${seed}:${item.code}`).map((o) => ({ id: o.id, text: o.text })) };
    const fallback = PROBE_ITEMS.find((p) => p.level === level) as (typeof PROBE_ITEMS)[number];
    return { id: fallback.id, level, skill: fallback.skill, prompt: fallback.prompt, options: shufflePool(fallback.options, `${seed}:${fallback.id}`).map((o) => ({ id: o.id, text: o.text })) };
  });
}
/** فرقة المِسبار كفهرس مستوى (0=A1 … 4=C1) */
export const probeBandIndexOf = (score: number): number => score <= 1 ? 0 : score === 2 ? 1 : score === 3 ? 2 : score === 4 ? 3 : 4;
/** تصحيح المِسبار على الخادم: المفاتيح من البنك (بالرمز) أو من البنود الثابتة؛ إجابة واحدة لكل مستوى */
export function probeScoreFrom(pool: readonly PoolItem[], answers: unknown): number {
  if (!answers || typeof answers !== 'object') return 0; const a = answers as Record<string, unknown>;
  const byCode = new Map(pool.map((i) => [i.code, i])); const seenLevel = new Set<string>(); let score = 0;
  for (const [id, chosen] of Object.entries(a).slice(0, 12)) {
    const bank = byCode.get(id); const fixed = PROBE_ITEMS.find((p) => p.id === id);
    const level = bank?.level || fixed?.level; const correct = bank?.correctOptionId || fixed?.correct; if (!level || !correct || seenLevel.has(level)) continue;
    seenLevel.add(level); if (chosen === correct) score += 1;
  }
  return Math.min(5, score);
}

// ---------- الأبواب العامة: المخطّطات النشطة المعلنة (وإن غاب الجدول: البابان النظاميان) ----------
export type PublicDoor = { code: string; name_ar: string; name_en: string; description_ar: string; type: TestType; door: string; minutes: number; items: number; levels: Level[]; probe: boolean; cut: number };
export function doorOf(plan: Plan): PublicDoor {
  return { code: plan.code, name_ar: plan.name_ar, name_en: plan.name_en, description_ar: plan.description_ar, type: plan.type, door: TEST_TYPE_INFO[plan.type].door, minutes: Math.round(plan.durationSeconds / 60), items: planTotal(plan), levels: plan.levels, probe: plan.probe, cut: plan.cut };
}
export async function publicDoors(db: any): Promise<PublicDoor[]> {
  try {
    const r = await db.from('question_bank_blueprints').select('*').eq('status', 'active').eq('is_public', true).order('sort_order', { ascending: true }).limit(12);
    const rows = Array.isArray(r?.data) ? (r.data as BlueprintRow[]) : [];
    const doors = rows.map((row) => planFromBlueprint(row)).filter((x) => !x.errors.length).map((x) => doorOf(x.plan));
    if (doors.length) return doors;
  } catch { /* الجدول غائب أو بلا صلاحية → الافتراضي */ }
  return [doorOf(systemPlan('placement')), doorOf(systemPlan('comprehensive'))];
}
