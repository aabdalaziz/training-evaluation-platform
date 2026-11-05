// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — م6 «عُبور»: اختبار نهاية المستوى المعياري (CEFR) — المنطق الصرف (بلا قاعدة بيانات).
 *  الاسم الرسمي: «اختبار نهاية المستوى — معياري (CEFR)» / Level Exit Examination (CEFR-aligned). «عُبور» اسم العائلة في السرد فقط.
 *  - جدول المواصفات (EXIT_SPEC): عدد البنود لكل محور ولكل مستوى، أزمنة المهام، الزمن الكلّي — مُرقَّم الإصدار (SPEC_VERSION).
 *  - الحكم المركّب (exitVerdict): استقبالي 60% (متوسط الاستماع/القراءة/استعمال اللغة) + كتابة 20% + تحدّث 20%؛
 *    الاجتياز = الكلّي ≥ الحدّ (60) ولا مهارة دون الحدّ الأدنى (50). مهارة واحدة فقط دون الحدّ مع كلّي ناجح = «اجتياز مشروط» (إعادة تلك المهارة وحدها).
 *  - التقدير: ممتاز ≥85 · جيد جدًا 75–84 · جيد 65–74 · اجتياز 60–64 · لم يجتز.
 *  - فحص السلال (poolCheck): أي خلية (مستوى×مهارة) دون 1.5× المطلوب «ضيّقة».
 *  - خطّ العبور (growthLine): دخل المستوى بـ… ويعبره اليوم بـ…
 */
import type { Level, Skill } from './registry';
import { LEVELS, SKILLS } from './registry';

export const SPEC_VERSION = 'exit-2026.11';
export const EXIT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type ExitLevel = (typeof EXIT_LEVELS)[number];
export const isExitLevel = (v: unknown): v is ExitLevel => typeof v === 'string' && (EXIT_LEVELS as readonly string[]).includes(v);
export const EXIT_CUT = 60;
export const EXIT_SKILL_MIN = 50;
export const EXIT_WEIGHTS = { receptive: 60, writing: 20, speaking: 20 } as const;
export const POOL_RATIO = 1.5;
export const RETAKE_DAYS = 7;
export const SKILL_RETAKE_DAYS = 14;
export const ANCHOR_ITEMS = 5;

export type ExitSpec = { listening: number; reading: number; grammar_vocab: number; writing: number; speaking: number; minutes: number; writingWords: [number, number]; speakingSeconds: [number, number] };
export const EXIT_SPEC: Record<ExitLevel, ExitSpec> = {
  A1: { listening: 10, reading: 10, grammar_vocab: 15, writing: 1, speaking: 1, minutes: 60, writingWords: [40, 60], speakingSeconds: [60, 90] },
  A2: { listening: 10, reading: 10, grammar_vocab: 15, writing: 1, speaking: 1, minutes: 65, writingWords: [70, 100], speakingSeconds: [90, 120] },
  B1: { listening: 12, reading: 12, grammar_vocab: 16, writing: 2, speaking: 2, minutes: 80, writingWords: [120, 160], speakingSeconds: [120, 180] },
  B2: { listening: 12, reading: 12, grammar_vocab: 16, writing: 2, speaking: 2, minutes: 90, writingWords: [180, 220], speakingSeconds: [180, 240] },
  C1: { listening: 14, reading: 14, grammar_vocab: 12, writing: 2, speaking: 2, minutes: 100, writingWords: [250, 300], speakingSeconds: [240, 300] },
};
export const receptiveTotal = (l: ExitLevel) => EXIT_SPEC[l].listening + EXIT_SPEC[l].reading + EXIT_SPEC[l].grammar_vocab;

export const EXIT_TITLE = { ar: 'اختبار نهاية المستوى — معياري (CEFR)', en: 'Level Exit Examination (CEFR-aligned)' } as const;
export const CERT_TITLE = { ar: 'شهادة اجتياز المستوى', en: 'Certificate of Level Completion' } as const;
export const SKILL_NAMES: Record<'listening' | 'reading' | 'grammar_vocab' | 'writing' | 'speaking', { ar: string; en: string }> = {
  listening: { ar: 'الاستماع', en: 'Listening' }, reading: { ar: 'القراءة', en: 'Reading' }, grammar_vocab: { ar: 'المفردات والتراكيب', en: 'Use of language' },
  writing: { ar: 'الكتابة', en: 'Writing' }, speaking: { ar: 'التحدّث', en: 'Speaking' },
};
export type ExitSkill = keyof typeof SKILL_NAMES;
export const EXIT_SKILLS: ExitSkill[] = ['listening', 'reading', 'grammar_vocab', 'writing', 'speaking'];

/* ---------- مخطّطات النظام ---------- */
export const exitBlueprintCode = (l: ExitLevel) => `SYS-EXIT-${l}`;
export const isExitCode = (code: unknown) => typeof code === 'string' && (/^SYS-EXIT-(A1|A2|B1|B2|C1)$/.test(code) || /^EXIT-RT-/.test(code));
export function exitBlueprintRow(l: ExitLevel) {
  const s = EXIT_SPEC[l];
  return {
    code: exitBlueprintCode(l), name_ar: `${EXIT_TITLE.ar} — ${l}`, name_en: `${EXIT_TITLE.en} — ${l}`,
    description_ar: `جدول المواصفات ${SPEC_VERSION}: استماع ${s.listening} · قراءة ${s.reading} · مفردات وتراكيب ${s.grammar_vocab} · كتابة ${s.writing} · تحدّث ${s.speaking} · ${s.minutes} دقيقة · اجتياز ${EXIT_CUT}% ولا مهارة دون ${EXIT_SKILL_MIN}%.`,
    test_type: 'level', purpose: 'exit', level: l, cut_percent: EXIT_CUT, duration_minutes: s.minutes, is_system: true, status: 'active', is_public: false, sort_order: 90 + LEVELS.indexOf(l),
    requirements: { levels: [l], counts: { [l]: { listening: s.listening, reading: s.reading, grammar_vocab: s.grammar_vocab } }, productive: { [l]: { writing: s.writing, speaking: s.speaking } }, productive_mode: 'declared', draw: 'random', shuffle_options: true, spec_version: SPEC_VERSION },
  };
}
/** مخطّط إعادة مهارة واحدة (الفكرة ز): استقبالية → البنود نفسها لتلك المهارة؛ إنتاجية → المهمة وحدها */
export function skillRetakeBlueprintRow(l: ExitLevel, skill: ExitSkill) {
  const s = EXIT_SPEC[l]; const receptive = skill === 'listening' || skill === 'reading' || skill === 'grammar_vocab';
  /* الإنتاجية تحتاج «بنود تهيئة» (5 من المفردات والتراكيب) لأن المحرّك لا يفتح جلسة بلا بنود استقبالية — لا تدخل في الحكم المدمج */
  const counts = { [l]: { listening: 0, reading: 0, grammar_vocab: receptive ? 0 : ANCHOR_ITEMS, ...(receptive ? { [skill]: s[skill] } : {}) } };
  const productive = { [l]: { writing: skill === 'writing' ? s.writing : 0, speaking: skill === 'speaking' ? s.speaking : 0 } };
  const minutes = receptive ? Math.max(10, Math.round(s.minutes * 0.35)) : Math.max(10, Math.round(s.minutes * 0.3));
  return {
    code: `EXIT-RT-${l}-${skill.toUpperCase()}`, name_ar: `إعادة مهارة ${SKILL_NAMES[skill].ar} — نهاية المستوى ${l}`, name_en: `${SKILL_NAMES[skill].en} retake — Level ${l} exit`,
    description_ar: `إعادة مهارة واحدة بعد اجتياز مشروط (${SPEC_VERSION}).`, test_type: 'custom', purpose: 'exit', level: l, cut_percent: EXIT_SKILL_MIN, duration_minutes: minutes, is_system: true, status: 'active', is_public: false, sort_order: 99,
    requirements: { ladder: 'single', levels: [l], counts, productive, productive_mode: 'declared', draw: 'random', shuffle_options: true, spec_version: SPEC_VERSION, retake_skill: skill },
  };
}

/* ---------- جدول المواصفات للطباعة ---------- */
export type SpecRow = { skill: ExitSkill; count: number; weight: number; unit_ar: string; unit_en: string; note_ar: string; note_en: string };
export function specTable(l: ExitLevel): { level: ExitLevel; version: string; minutes: number; cut: number; skillMin: number; total: number; rows: SpecRow[] } {
  const s = EXIT_SPEC[l]; const rw = EXIT_WEIGHTS.receptive / 3;
  const rows: SpecRow[] = [
    { skill: 'listening', count: s.listening, weight: rw, unit_ar: 'بند', unit_en: 'items', note_ar: 'اختيار من متعدّد — تصحيح آلي', note_en: 'Multiple choice — auto-scored' },
    { skill: 'reading', count: s.reading, weight: rw, unit_ar: 'بند', unit_en: 'items', note_ar: 'اختيار من متعدّد — تصحيح آلي', note_en: 'Multiple choice — auto-scored' },
    { skill: 'grammar_vocab', count: s.grammar_vocab, weight: rw, unit_ar: 'بند', unit_en: 'items', note_ar: 'اختيار من متعدّد — تصحيح آلي', note_en: 'Multiple choice — auto-scored' },
    { skill: 'writing', count: s.writing, weight: EXIT_WEIGHTS.writing, unit_ar: 'مهمة', unit_en: 'tasks', note_ar: `${s.writingWords[0]}–${s.writingWords[1]} كلمة · سُلّم 4 أبعاد × 6 درجات · مصحّح معايَر`, note_en: `${s.writingWords[0]}–${s.writingWords[1]} words · 4×6 rubric · calibrated rater` },
    { skill: 'speaking', count: s.speaking, weight: EXIT_WEIGHTS.speaking, unit_ar: 'مهمة', unit_en: 'tasks', note_ar: `${Math.round(s.speakingSeconds[0] / 60 * 10) / 10}–${Math.round(s.speakingSeconds[1] / 60 * 10) / 10} دقيقة · سُلّم 4 أبعاد × 6 درجات · مصحّح معايَر`, note_en: `${Math.round(s.speakingSeconds[0] / 60 * 10) / 10}–${Math.round(s.speakingSeconds[1] / 60 * 10) / 10} min · 4×6 rubric · calibrated rater` },
  ];
  return { level: l, version: SPEC_VERSION, minutes: s.minutes, cut: EXIT_CUT, skillMin: EXIT_SKILL_MIN, total: receptiveTotal(l), rows };
}

/* ---------- التقدير ---------- */
export type Grade = 'excellent' | 'very_good' | 'good' | 'pass' | 'fail';
export const GRADE_AR: Record<Grade, string> = { excellent: 'ممتاز', very_good: 'جيد جدًا', good: 'جيد', pass: 'اجتياز', fail: 'لم يجتز' };
export const GRADE_EN: Record<Grade, string> = { excellent: 'Excellent', very_good: 'Very good', good: 'Good', pass: 'Pass', fail: 'Not yet' };
export function gradeOf(total: number, passed: boolean): Grade { if (!passed) return 'fail'; if (total >= 85) return 'excellent'; if (total >= 75) return 'very_good'; if (total >= 65) return 'good'; return 'pass'; }

/* ---------- الحكم المركّب ---------- */
export type SkillInput = number | null | 'pending' | 'skipped';   /* null = غير مطلوب في المخطّط */
export type VerdictInput = { listening: SkillInput; reading: SkillInput; grammar_vocab: SkillInput; writing: SkillInput; speaking: SkillInput; cut?: number; skillMin?: number };
export type VerdictStatus = 'pending' | 'final';
export type VerdictOutcome = 'passed' | 'conditional' | 'failed' | 'pending';
export type Verdict = {
  status: VerdictStatus; outcome: VerdictOutcome; total: number | null; receptive: number | null;
  skills: Record<ExitSkill, { percent: number | null; state: 'ok' | 'below' | 'pending' | 'skipped' | 'na' }>;
  below: ExitSkill[]; pending: ExitSkill[]; retake_skill: ExitSkill | null; grade: Grade | null; cut: number; skillMin: number; weights: { receptive: number; writing: number; speaking: number };
};
const num = (v: SkillInput): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null);
export function exitVerdict(i: VerdictInput): Verdict {
  const cut = Number.isFinite(i.cut) ? Number(i.cut) : EXIT_CUT; const skillMin = Number.isFinite(i.skillMin) ? Number(i.skillMin) : EXIT_SKILL_MIN;
  const skills = {} as Verdict['skills']; const pending: ExitSkill[] = []; const below: ExitSkill[] = [];
  for (const k of EXIT_SKILLS) {
    const v = i[k];
    if (v === null || v === undefined) skills[k] = { percent: null, state: 'na' };
    else if (v === 'pending') { skills[k] = { percent: null, state: 'pending' }; pending.push(k); }
    else if (v === 'skipped') { skills[k] = { percent: 0, state: 'below' }; below.push(k); }   /* لم يُقدَّم = صفر */
    else { const p = num(v) ?? 0; skills[k] = { percent: p, state: p >= skillMin ? 'ok' : 'below' }; if (p < skillMin) below.push(k); }
  }
  const recParts = (['listening', 'reading', 'grammar_vocab'] as const).map((k) => skills[k].percent).filter((p): p is number => p !== null);
  const receptive = recParts.length ? Math.round(recParts.reduce((a, b) => a + b, 0) / recParts.length) : null;
  /* الأوزان: ما ليس مطلوبًا في المخطّط يعود وزنه إلى الاستقبالي */
  let wW = skills.writing.state === 'na' ? 0 : EXIT_WEIGHTS.writing; let wS = skills.speaking.state === 'na' ? 0 : EXIT_WEIGHTS.speaking; const wR = 100 - wW - wS;
  const weights = { receptive: wR, writing: wW, speaking: wS };
  if (pending.length || receptive === null) {
    return { status: 'pending', outcome: 'pending', total: null, receptive, skills, below, pending, retake_skill: null, grade: null, cut, skillMin, weights };
  }
  const w = skills.writing.percent ?? 0; const s = skills.speaking.percent ?? 0;
  if (wW === 0) wW = 0; if (wS === 0) wS = 0;
  const total = Math.round((receptive * wR + w * wW + s * wS) / 100);
  const outcome: VerdictOutcome = total < cut ? 'failed' : below.length === 0 ? 'passed' : below.length === 1 ? 'conditional' : 'failed';
  const passed = outcome === 'passed';
  return { status: 'final', outcome, total, receptive, skills, below, pending, retake_skill: outcome === 'conditional' ? below[0] : null, grade: outcome === 'failed' ? 'fail' : gradeOf(total, true) || (passed ? 'pass' : 'fail'), cut, skillMin, weights };
}
export const OUTCOME_AR: Record<VerdictOutcome, string> = { passed: 'اجتاز المستوى', conditional: 'اجتياز مشروط — إعادة مهارة واحدة', failed: 'لم يجتز بعد', pending: 'بانتظار تصحيح الكتابة والتحدّث' };
export const OUTCOME_EN: Record<VerdictOutcome, string> = { passed: 'Level passed', conditional: 'Conditional pass — retake one skill', failed: 'Not yet passed', pending: 'Awaiting writing & speaking rating' };

/** نسبة المهارة الإنتاجية من تقدير المصحّح (0–5 لكل بُعد) */
export function ratingPercent(hr: { mean?: unknown; scores?: Record<string, unknown> } | null | undefined): number | null {
  if (!hr) return null;
  if (typeof hr.mean === 'number' && Number.isFinite(hr.mean)) return Math.round((Math.max(0, Math.min(5, hr.mean)) / 5) * 100);
  const vals = hr.scores ? Object.values(hr.scores).map(Number).filter((n) => Number.isFinite(n)) : [];
  if (!vals.length) return null; return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / 5) * 100);
}

/** يبني كتلة «نهاية المستوى» من تقرير مِعيار (احصائيات المهارات) + أداءات الغرفة */
export type PerfLike = { skill: string; status: string; human_rating?: { mean?: unknown; scores?: Record<string, unknown> } | null };
export function exitBlock(args: { level: ExitLevel; report: Record<string, any>; perfs: readonly PerfLike[]; wantWriting: number; wantSpeaking: number; cut?: number; growth?: Growth | null; retake?: Record<string, unknown> | null }) {
  const st = (args.report?.احصائيات || {}) as Record<string, { percent?: number; answered?: number }>;
  const rec = (k: 'listening' | 'reading' | 'grammar_vocab'): SkillInput => { const x = st[k]; if (!x || !x.answered) return EXIT_SPEC[args.level][k] ? 0 : null; return Number(x.percent) || 0; };
  const prod = (k: 'writing' | 'speaking', want: number): SkillInput => {
    if (!want) return null; const ps = args.perfs.filter((p) => p.skill === k); if (!ps.length) return 'pending';
    const released = ps.filter((p) => p.status === 'released' && p.human_rating); const skipped = ps.filter((p) => p.status === 'skipped');
    if (skipped.length === ps.length) return 'skipped'; if (released.length + skipped.length < ps.length) return 'pending';
    const pcts = released.map((p) => ratingPercent(p.human_rating)).filter((n): n is number => n !== null); if (!pcts.length) return 'pending';
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  };
  const v = exitVerdict({ listening: rec('listening'), reading: rec('reading'), grammar_vocab: rec('grammar_vocab'), writing: prod('writing', args.wantWriting), speaking: prod('speaking', args.wantSpeaking), cut: args.cut });
  return {
    الاسم_الرسمي: EXIT_TITLE.ar, official_en: EXIT_TITLE.en, المستوى: args.level, إصدار_المواصفات: SPEC_VERSION,
    الحالة: v.status, النتيجة: v.outcome, النص: OUTCOME_AR[v.outcome], text_en: OUTCOME_EN[v.outcome], الكلي: v.total, الاستقبالي: v.receptive,
    المهارات: Object.fromEntries(EXIT_SKILLS.map((k) => [k, { الاسم: SKILL_NAMES[k].ar, name_en: SKILL_NAMES[k].en, النسبة: v.skills[k].percent, الحالة: v.skills[k].state }])),
    دون_الحد: v.below, قيد_التصحيح: v.pending, مهارة_الإعادة: v.retake_skill, التقدير: v.grade, تقدير_ar: v.grade ? GRADE_AR[v.grade] : null, grade_en: v.grade ? GRADE_EN[v.grade] : null,
    الحد: v.cut, حد_المهارة: v.skillMin, الأوزان: v.weights, ...(args.growth ? { خط_العبور: args.growth } : {}), ...(args.retake ? { الإعادة: args.retake } : {}),
  };
}
export type ExitBlockT = ReturnType<typeof exitBlock>;

/* ---------- خطّ العبور (الفكرة و) ---------- */
export type Growth = { from_level: string; from_percent: number | null; from_at: string | null; to_level: ExitLevel; to_percent: number | null; text_ar: string; text_en: string };
export function growthLine(prev: { report?: Record<string, any> | null; created_at?: string | null } | null | undefined, level: ExitLevel, total: number | null): Growth | null {
  const r = prev?.report; if (!r) return null; if (r.exit) return null;   /* نقارن بتقرير تسكين لا بنهاية مستوى سابقة */
  const from_level = String(r?.ملخص_التسكين?.مستوى_الالتحاق_المقترح || r?.المستوى_العام || '').trim(); if (!from_level) return null;
  const from_percent = Number.isFinite(Number(r?.النسبة_العامة)) ? Number(r.النسبة_العامة) : null;
  const at = prev?.created_at ? String(prev.created_at).slice(0, 10) : null;
  const text_ar = `دخلتَ بمستوى ${from_level}${from_percent !== null ? ` (${from_percent}%)` : ''}${at ? ` في ${at}` : ''} — وتقف اليوم على عتبة ${level}${total !== null ? ` بنتيجة ${total}%` : ''}.`;
  const text_en = `You entered at ${from_level}${from_percent !== null ? ` (${from_percent}%)` : ''}${at ? ` on ${at}` : ''} — and today you stand at the ${level} threshold${total !== null ? ` with ${total}%` : ''}.`;
  return { from_level, from_percent, from_at: at, to_level: level, to_percent: total, text_ar, text_en };
}

/* ---------- فحص السلال (الفكرة ط) ---------- */
export type PoolCell = { level: Level; skill: Skill | 'writing' | 'speaking'; need: number; have: number; ratio: number; narrow: boolean };
export function poolCheck(level: ExitLevel, available: Record<string, number>, ratio = POOL_RATIO): { cells: PoolCell[]; narrow: PoolCell[]; ok: boolean } {
  const s = EXIT_SPEC[level]; const cells: PoolCell[] = [];
  for (const sk of SKILLS) { const need = s[sk as 'listening']; const have = Number(available[`${level}:${sk}`] || 0); cells.push({ level, skill: sk, need, have, ratio: need ? Math.round((have / need) * 10) / 10 : 0, narrow: need > 0 && have < need * ratio }); }
  for (const sk of ['writing', 'speaking'] as const) { const need = s[sk]; const have = Number(available[`${level}:${sk}`] || 0); cells.push({ level, skill: sk, need, have, ratio: need ? Math.round((have / need) * 10) / 10 : 0, narrow: need > 0 && have < need * ratio }); }
  const narrow = cells.filter((c) => c.narrow); return { cells, narrow, ok: narrow.length === 0 };
}

/* ---------- الدعوة المرتبطة بالمجموعة ---------- */
export const exitReuseKey = (classroomId: string, level: ExitLevel) => `exit:${classroomId}:${level}`;
export function exitInviteLabel(roomLabel: string, level: ExitLevel) { return `${EXIT_TITLE.ar} ${level} — ${roomLabel}`.slice(0, 120); }
/** حالة النافذة الزمنية */
export function windowState(opens_at: string | null | undefined, expires_at: string | null | undefined, now = Date.now()): 'before' | 'open' | 'after' {
  if (opens_at && Date.parse(opens_at) > now) return 'before'; if (expires_at && Date.parse(expires_at) < now) return 'after'; return 'open';
}
/** المستوى التالي للعبور */
export function nextLevel(l: ExitLevel): Level | null { const i = LEVELS.indexOf(l); return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null; }
/** مستوى CEFR من رمز/اسم مستوى القاعة (program_levels.code مثل A2، أو تسمية عربية) */
export function levelFromRoom(code: unknown, name: unknown = ''): ExitLevel | null {
  const c = String(code || '').toUpperCase().trim(); const m = c.match(/\b(A1|A2|B1|B2|C1)\b/); if (m) return m[1] as ExitLevel;
  const n = String(name || ''); if (/مبتدئ\s*2|أساسي/.test(n)) return 'A2'; if (/مبتدئ/.test(n)) return 'A1'; if (/متوسط\s*2|فوق المتوسط/.test(n)) return 'B2'; if (/متوسط/.test(n)) return 'B1'; if (/متقدم|متقدّم/.test(n)) return 'C1';
  return null;
}
/** صفّ لوحة المجموعة من جلسة + تقرير */
export type BoardRow = { email: string; name: string; status: 'invited' | 'started' | 'finished' | 'expired'; started_at: string | null; finished_at: string | null; answered: number; total: number; idle_min: number | null; report_code: string | null; exit: ExitBlockT | null };
export function boardSummary(rows: readonly BoardRow[]) {
  const finished = rows.filter((r) => r.exit); const final = finished.filter((r) => r.exit!.الحالة === 'final');
  const passed = final.filter((r) => r.exit!.النتيجة === 'passed').length; const conditional = final.filter((r) => r.exit!.النتيجة === 'conditional').length; const failed = final.filter((r) => r.exit!.النتيجة === 'failed').length;
  const totals = final.map((r) => Number(r.exit!.الكلي)).filter((n) => Number.isFinite(n));
  const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
  const growths = finished.map((r) => (r.exit as any)?.خط_العبور).filter((g) => g && typeof g.from_percent === 'number' && typeof g.to_percent === 'number');
  const growth_avg = growths.length >= 5 ? Math.round(growths.reduce((a: number, g: any) => a + (g.to_percent - g.from_percent), 0) / growths.length) : null;
  return { invited: rows.length, started: rows.filter((r) => r.status !== 'invited').length, finished: finished.length, pending: finished.length - final.length, passed, conditional, failed, avg, growth_avg, growth_n: growths.length };
}
