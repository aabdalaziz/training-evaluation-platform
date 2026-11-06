// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م10 «مِران» — تدريب ما بين الحكم والإعادة (Miaar Practice — guided retake preparation) — مِعيار — من أَثَر
 *  الاسم: من «مَرَنَ على الشيء» = تعوّده وتدرّب عليه حتى لان له. بوزن «مِعيار» و«عُبور» و«شاهِد».
 *  الفكرة: حين يصدر حكم «مشروط» (أو «لم يجتز») يبني مِعيار خطّة 14 يومًا من وحدات المتعلّم الضعيفة (خريطة المنهج م6-ب)
 *   بتكرار متباعد، يراجعها المدرّب ويعتمدها بنقرة (لا خطّة بلا توقيع)، ثم تصل المتعلّم كل صباح بطاقة تمرين واحدة (7–10 دقائق)
 *   عبر قناة P39، ويرى «مرآة التحسّن»: نسبة الوحدة يوم الحكم ← اليوم.
 *  قواعد النزاهة: كل بند تدرّب عليه يُسجَّل «مكشوفًا له» فيستثنيه سحب الإعادة الرسمية (blueprint.drawPlan exclude)؛
 *   مؤشّر الجاهزية ليس حكمًا ولا يظهر على الشهادة؛ المهارات الإنتاجية تُتمرَّن بمطالب محلية من تركيز الوحدة (لا مهامّ البنك الرسمية).
 *  المنطق الخالص أعلى الملف (يُختبر وحدةً)، ودوال القاعدة أسفله. لا يستورد exitflow (تفاديًا لدورة الاستيراد).
 */
import type { PoolItem, PublicForm } from './registry';
import { shufflePool } from './registry';
import { formFromPool, loadApprovedPool, loadPassages } from './bank';
import { listUnits, unitIndex, isUnitCode, unitLevelOf, approvedFor } from './syllabus';
import type { Unit, UnitTally, ExitLevel } from './syllabus';
import { noticeText, pushNotice } from '../portal/notices';
import type { NoticeOpts } from '../portal/notices';

export const PRACTICE_TITLE = { ar: 'مِران — تدريب ما بين الحكم والإعادة', en: 'Miaar Practice — guided retake preparation' } as const;
export const LEARNER_TITLE = { ar: 'مِران', en: 'Miran' } as const;
export const PLAN_DAYS = 14; export const ITEMS_PER_DAY = 5; export const MIRROR_DAYS = [7, 14] as const; export const MAX_UNITS = 4;
export const READY_N = 10; export const READY_PCT = 70; export const CLOSE_N = 5; export const CLOSE_PCT = 50; export const IDLE_DAYS = 3;
export const TEXT_MIN_WORDS = 20; export const TEXT_MAX_CHARS = 1500; export const NOTE_MAX = 300; export const NOTE_AUDIO_MAX = 220_000; /* data URL ≈ 30 ث opus */
export const PLAN_STATUSES = ['draft', 'approved', 'done', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const STATUS_AR: Record<PlanStatus, string> = { draft: 'مسوَّدة', approved: 'معتمدة', done: 'انتهت', cancelled: 'أُلغيت' };
const TZ_MS = 3 * 3600000; /* الرياض UTC+3 */
const PRODUCTIVE = new Set(['writing', 'speaking']);
const RECEPTIVE = new Set(['listening', 'reading', 'grammar_vocab']);

export type DayKind = 'drill' | 'mirror';
export type PlanDay = { d: number; kind: DayKind; unit: string | null; text?: boolean; items?: string[]; note_ar?: string | null; note_audio?: string | null; done_at?: string | null; n?: number; correct?: number };
export type PlanKind = 'exit' | 'placement'; /* م11: بعد الحكم | بعد التشخيص */
export const KIND_AR: Record<PlanKind, string> = { exit: 'مِران — بعد حكم العبور', placement: 'مِران البداية — بعد التشخيص' };
export type PlanRow = { kind: PlanKind; id: string; report_id: string; invite_id: string | null; email: string; user_id: string | null; level: string; skill: string | null; units: string[]; days: PlanDay[]; status: PlanStatus; created_by: string | null; approved_by: string | null; approved_at: string | null; start_date: string | null; last_attempt_at: string | null; done_at: string | null; created_at: string };
export type AttemptRow = { id?: string; plan_id: string; email: string; day: number; kind: 'item' | 'text'; item_code: string | null; option_id: string | null; correct: boolean | null; payload: any; at: string };

/* ───────── 1) الوحدات الضعيفة من الحكم ───────── */
/** من exit.الوحدات: غير المُتقَنة مرتّبة من الأضعف (≤ MAX_UNITS)؛ إن خلت فالأضعف عمومًا */
export function weakUnitsFrom(exit: any, max = MAX_UNITS): string[] {
  const rows: any[] = Array.isArray(exit?.الوحدات) ? exit.الوحدات : [];
  const sorted = [...rows].filter((u) => isUnitCode(u?.الرمز)).sort((a, b) => Number(a.النسبة) - Number(b.النسبة) || Number(b.عدد || 0) - Number(a.عدد || 0));
  const weak = sorted.filter((u) => u.الحالة !== 'ok').map((u) => String(u.الرمز));
  return (weak.length ? weak : sorted.map((u) => String(u.الرمز))).slice(0, max);
}
/** هل يستحقّ هذا الحكم خطّة مِران؟ نهائي ومشروط أو لم يجتز، ولم تُدمج إعادته بعد */
export function eligibleExit(exit: any): { ok: true; skill: string | null } | { ok: false; reason: string } {
  if (!exit || exit.الحالة !== 'final') return { ok: false, reason: 'not_final' };
  if (exit.النتيجة === 'passed') return { ok: false, reason: 'passed' };
  if (exit.الإعادة?.الحالة === 'merged') return { ok: false, reason: 'retake_merged' };
  return { ok: true, skill: exit.النتيجة === 'conditional' ? String(exit.مهارة_الإعادة || '') || null : null };
}

/** م11: الوحدات الضعيفة من خريطة التشخيص (report.الوحدات = {code:{n,correct}}) لمستوى الالتحاق المقترح — أقل من 70% أولًا، وإلا الأدنى */
export function weakUnitsFromTally(tally: Record<string, { n: number; correct: number }> | null | undefined, level: string, max = MAX_UNITS): string[] {
  if (!tally || typeof tally !== 'object') return [];
  const rows = Object.entries(tally).filter(([c, v]) => isUnitCode(c) && unitLevelOf(c) === level && v && Number(v.n) > 0).map(([c, v]) => ({ code: c, n: Number(v.n), pct: Math.round((Number(v.correct) / Number(v.n)) * 100) }));
  rows.sort((a, b) => a.pct - b.pct || b.n - a.n);
  const weak = rows.filter((r) => r.pct < 70).map((r) => r.code);
  return (weak.length ? weak : rows.map((r) => r.code)).slice(0, max);
}
export type Eligibility = { ok: true; kind: PlanKind; level: string; skill: string | null; units: string[]; before: Map<string, number> } | { ok: false; reason: string };
/** من أيّ باب يستحقّ هذا التقرير مِران؟ العبور (م10) إن وُجد حكم، وإلا التشخيص (م11) بمستوى الالتحاق المقترح وخريطة وحداته */
export function eligibleReport(report: any): Eligibility {
  const ex = report?.exit;
  if (ex && typeof ex === 'object') {
    const el = eligibleExit(ex); if (!el.ok) return el;
    const before = new Map<string, number>(); for (const u of (Array.isArray(ex.الوحدات) ? ex.الوحدات : []) as any[]) if (u?.الرمز && typeof u.النسبة === 'number') before.set(String(u.الرمز), u.النسبة);
    return { ok: true, kind: 'exit', level: String(ex.المستوى || ''), skill: el.skill, units: weakUnitsFrom(ex), before };
  }
  if (!report || typeof report !== 'object' || !report.ملخص_التسكين) return { ok: false, reason: 'not_diagnostic' };
  if (report.exit_retake) return { ok: false, reason: 'retake_sitting' };
  const sum = report.ملخص_التسكين || {}; const entry = sum.دون_A1 ? 'PRE_A1' : String(sum.مستوى_الالتحاق_المقترح || sum.المستوى_المثبت || report.المستوى_العام || '');
  if (!/^(A1|A2|B1|B2|C1)$/.test(entry)) return { ok: false, reason: 'level_unsupported' };
  const tally = report.الوحدات && typeof report.الوحدات === 'object' && !Array.isArray(report.الوحدات) ? report.الوحدات : null; if (!tally) return { ok: false, reason: 'no_units' };
  const units = weakUnitsFromTally(tally, entry); if (!units.length) return { ok: false, reason: 'no_units' };
  const before = new Map<string, number>(); for (const [c, v] of Object.entries(tally as Record<string, { n: number; correct: number }>)) if (isUnitCode(c) && Number(v?.n) > 0) before.set(c, Math.round((Number(v.correct) / Number(v.n)) * 100));
  return { ok: true, kind: 'placement', level: entry, skill: null, units, before };
}

/* ───────── 2) بناء الأيام (تكرار متباعد) ───────── */
/** حصص أيام التمرين (12) على الوحدات بوزن تنازلي: الأضعف أكثر */
export function quotas(n: number, drillDays = PLAN_DAYS - MIRROR_DAYS.length): number[] {
  if (n <= 0) return []; const w = Array.from({ length: n }, (_, i) => n - i); const sum = w.reduce((a, b) => a + b, 0);
  const q = w.map((x) => Math.floor((x / sum) * drillDays)); let rest = drillDays - q.reduce((a, b) => a + b, 0); let i = 0;
  while (rest > 0) { q[i % n] += 1; rest -= 1; i += 1; } return q;
}
/** 14 يومًا: تمرين في 1–6 و8–13، «يوم المرآة» 7 و14. التوزيع: الأعلى نصيبًا متبقّيًا أولًا، مع تجنّب تكرار وحدة الأمس */
export function planDays(units: readonly string[], productive = false): PlanDay[] {
  const u = [...new Set(units.filter(isUnitCode))].slice(0, MAX_UNITS); const q = quotas(u.length); const left = [...q]; const out: PlanDay[] = []; let prev: string | null = null;
  for (let d = 1; d <= PLAN_DAYS; d += 1) {
    if ((MIRROR_DAYS as readonly number[]).includes(d)) { out.push({ d, kind: 'mirror', unit: null, ...(productive ? { text: true } : {}) }); continue; }
    let best = -1; let bestScore = -1;
    for (let i = 0; i < u.length; i += 1) { if (left[i] <= 0) continue; const score = left[i] / q[i] - (u[i] === prev ? 0.5 : 0); if (score > bestScore) { bestScore = score; best = i; } }
    if (best < 0) { out.push({ d, kind: 'drill', unit: u[0] || null }); continue; }
    left[best] -= 1; prev = u[best];
    /* «تمرين مزدوج»: للمهارة الإنتاجية نصّ قصير في اليوم 1 و12 (ثم تُعرض النسختان جنبًا إلى جنب) */
    out.push({ d, kind: 'drill', unit: u[best], ...(productive && (d === 1 || d === 12) ? { text: true } : {}) });
  }
  return out;
}

/* ───────── 3) الزمن ───────── */
export const riyadhDate = (now: Date) => new Date(now.getTime() + TZ_MS).toISOString().slice(0, 10);
/** رقم اليوم من تاريخ البدء (اليوم 1 = يوم الاعتماد) — بعد 14 ينتهي */
export function currentDay(start_date: string | null | undefined, now: Date): { d: number; ended: boolean; before: boolean } {
  if (!start_date) return { d: 0, ended: false, before: true };
  const a = Date.parse(`${String(start_date).slice(0, 10)}T00:00:00Z`); const b = Date.parse(`${riyadhDate(now)}T00:00:00Z`); if (!Number.isFinite(a) || !Number.isFinite(b)) return { d: 0, ended: false, before: true };
  const d = Math.floor((b - a) / 86400000) + 1; if (d < 1) return { d: 0, ended: false, before: true }; if (d > PLAN_DAYS) return { d: PLAN_DAYS, ended: true, before: false };
  return { d, ended: false, before: false };
}
/** اليوم المفتوح للمتعلّم: اليوم الحالي إن لم يُنجز، وإلا أقدم يوم فائت لم يُنجز (لا عقوبة) */
export function activeDay(days: readonly PlanDay[], today: number): PlanDay | null {
  if (today < 1) return null; const t = days.find((x) => x.d === today); if (t && !t.done_at) return t;
  return days.filter((x) => x.d < today && !x.done_at).sort((a, b) => a.d - b.d)[0] || null;
}

/* ───────── 4) اختيار البنود ───────── */
type Lite = Pick<PoolItem, 'code' | 'level' | 'skill' | 'unitCodes'>;
/** بنود يوم التمرين: من الوحدة والمستوى؛ تُفضَّل مهارة الإعادة الاستقبالية إن كفت؛ غير المكشوف في هذه الخطّة أولًا؛ خلط ثابت */
export function pickDrill<T extends Lite>(pool: readonly T[], level: string, unit: string, skill: string | null, usedInPlan: ReadonlySet<string>, seed: string, n = ITEMS_PER_DAY): T[] {
  let cell = pool.filter((i) => i.level === level && (i.unitCodes || []).includes(unit));
  if (skill && RECEPTIVE.has(skill)) { const same = cell.filter((i) => i.skill === skill); if (same.length >= n) cell = same; }
  const fresh = shufflePool(cell.filter((i) => !usedInPlan.has(i.code)), seed); const seen = shufflePool(cell.filter((i) => usedInPlan.has(i.code)), `${seed}:seen`);
  return [...fresh, ...seen].slice(0, n);
}
/** «يوم المرآة»: أضعف 5 بنود تدرّب عليها (الأكثر خطأً، ثم الأحدث)؛ يُكمَّل من بقية ما تدرّب عليه */
export function pickMirror(attempts: readonly Pick<AttemptRow, 'item_code' | 'correct' | 'at' | 'kind'>[], n = ITEMS_PER_DAY): string[] {
  const acc = new Map<string, { wrong: number; last: string }>();
  for (const a of attempts) { if (a.kind !== 'item' || !a.item_code) continue; const r = acc.get(a.item_code) || { wrong: 0, last: '' }; if (a.correct === false) r.wrong += 1; if (a.at > r.last) r.last = a.at; acc.set(a.item_code, r); }
  return [...acc.entries()].sort((x, y) => y[1].wrong - x[1].wrong || y[1].last.localeCompare(x[1].last) || x[0].localeCompare(y[0])).slice(0, n).map((e) => e[0]);
}

/* ───────── 5) التصحيح والتغذية الراجعة ───────── */
export type Feedback = { correct: boolean; correct_option: string; why_ar: string };
export function gradeAnswer(item: Pick<PoolItem, 'options' | 'correctOptionId' | 'descriptor'>, option: string, unit?: Pick<Unit, 'title_ar' | 'focus_ar'> | null): Feedback {
  const correct = option === item.correctOptionId; const co = item.options.find((o) => o.id === item.correctOptionId);
  const why = unit ? `هذا البند من وحدة «${unit.title_ar}»: ${unit.focus_ar}` : item.descriptor ? `الواصف ${item.descriptor}` : 'راجع الوحدة ثم أعد المحاولة غدًا';
  return { correct, correct_option: co?.text || '', why_ar: correct ? `أحسنت — ${why}` : `الإجابة الصحيحة: «${co?.text || '—'}». ${why}` };
}

/* ───────── 6) التقدّم والمرآة والجاهزية ───────── */
export type UnitProgress = { unit: string; n: number; correct: number; percent: number | null; recent_n: number; recent_percent: number | null };
/** لكل وحدة في الخطّة: كل المحاولات، وآخر RECENT محاولة (الأحدث أوزن في الجاهزية) */
export function unitProgress(attempts: readonly Pick<AttemptRow, 'item_code' | 'correct' | 'at' | 'kind'>[], itemUnits: ReadonlyMap<string, readonly string[]>, units: readonly string[], recent = READY_N): UnitProgress[] {
  const out: UnitProgress[] = [];
  for (const u of units) {
    const mine = attempts.filter((a) => a.kind === 'item' && a.item_code && (itemUnits.get(a.item_code) || []).includes(u) && typeof a.correct === 'boolean').sort((a, b) => a.at.localeCompare(b.at));
    const c = mine.filter((a) => a.correct).length; const last = mine.slice(-recent); const lc = last.filter((a) => a.correct).length;
    out.push({ unit: u, n: mine.length, correct: c, percent: mine.length ? Math.round((c / mine.length) * 100) : null, recent_n: last.length, recent_percent: last.length ? Math.round((lc / last.length) * 100) : null });
  }
  return out;
}
export type MirrorRow = { unit: string; title_ar: string; before: number | null; now: number | null; delta: number | null };
/** «مرآة التحسّن»: نسبة الوحدة يوم الحكم ← نسبتها في مِران */
export function mirrorRows(exit: any, progress: readonly UnitProgress[], units: readonly Unit[]): MirrorRow[] {
  const before = new Map<string, number>(); for (const u of (Array.isArray(exit?.الوحدات) ? exit.الوحدات : []) as any[]) if (u?.الرمز && typeof u.النسبة === 'number') before.set(String(u.الرمز), u.النسبة);
  return mirrorRowsFrom(before, progress, units);
}
/** م11: المرآة من أيّ خريطة «قبل» (حكم العبور أو خريطة التشخيص) */
export function mirrorRowsFrom(before: ReadonlyMap<string, number>, progress: readonly UnitProgress[], units: readonly Unit[]): MirrorRow[] {
  const ix = unitIndex(units);
  return progress.map((p) => { const b = before.get(p.unit) ?? null; const now = p.percent; return { unit: p.unit, title_ar: ix.get(p.unit)?.title_ar || p.unit, before: b, now, delta: b !== null && now !== null ? now - b : null }; });
}
export type Readiness = { state: 'ready' | 'close' | 'early'; label_ar: string; sentence_ar: string; per_unit: Array<{ unit: string; state: 'ready' | 'close' | 'early' }> };
export const READY_AR: Record<Readiness['state'], string> = { ready: 'جاهز للإعادة', close: 'اقتربت', early: 'واصل التمرين' };
export const READY_START_AR: Record<Readiness['state'], string> = { ready: 'جاهز لأول درس', close: 'اقتربت', early: 'واصل التمرين' }; /* م11 */
/** مؤشّر لا حكم: أخضر حين تبلغ كل وحدة 70% في آخر 10 محاولات (≥ 10)، كهرماني حين تبلغ 50% (≥ 5) */
export function readiness(progress: readonly UnitProgress[], units: readonly Unit[], kind: PlanKind = 'exit'): Readiness {
  const ix = unitIndex(units); const per = progress.map((p) => ({ unit: p.unit, state: (p.recent_n >= READY_N && (p.recent_percent ?? 0) >= READY_PCT ? 'ready' : p.recent_n >= CLOSE_N && (p.recent_percent ?? 0) >= CLOSE_PCT ? 'close' : 'early') as Readiness['state'] }));
  const state: Readiness['state'] = !per.length ? 'early' : per.every((x) => x.state === 'ready') ? 'ready' : per.every((x) => x.state !== 'early') ? 'close' : 'early';
  const best = [...progress].sort((a, b) => (b.recent_percent ?? -1) - (a.recent_percent ?? -1))[0]; const worst = [...progress].filter((p) => p.n > 0).sort((a, b) => (a.recent_percent ?? 101) - (b.recent_percent ?? 101))[0];
  const name = (u?: UnitProgress) => (u ? ix.get(u.unit)?.title_ar || u.unit : '');
  const sentence = state === 'ready' ? `بلغت ${best?.recent_percent ?? 0}% في «${name(best)}» وأتممت ما يلزم — موعد الإعادة مناسب.` : state === 'close' ? `أنت قريب: «${name(worst)}» عند ${worst?.recent_percent ?? 0}% — يومان آخران يكفيان غالبًا.` : worst ? `ابدأ بـ«${name(worst)}» — كل تمرين خمس دقائق يرفع النسبة.` : 'أول تمرين يفتح المرآة.';
  return { state, label_ar: (kind === 'placement' ? READY_START_AR : READY_AR)[state], sentence_ar: kind === 'placement' ? sentence.replace('موعد الإعادة مناسب', 'أنت جاهز لأول درس').replace('ليلة الإعادة', 'أول درس') : sentence, per_unit: per };
}

/* ───────── 7) المهارات الإنتاجية: مطلب محلي + مرآة النصّ ───────── */
/** مطلب كتابة/تحدّث من تركيز الوحدة — لا مهامّ البنك الرسمية (حماية الإعادة) */
export function textPrompt(unit: Pick<Unit, 'title_ar' | 'focus_ar'> | null, skill: string | null, level: string): { prompt_ar: string; min_words: number } {
  const topic = unit ? `${unit.title_ar} — ${unit.focus_ar}` : 'موضوع من حياتك اليومية';
  const words = level === 'A1' ? 20 : level === 'A2' ? 30 : level === 'B1' ? 50 : 70;
  if (skill === 'speaking') return { prompt_ar: `تحدّث عن: ${topic}. اكتب هنا ما ستقوله في 60 ثانية — جملًا كاملة كما تنطقها (${words} كلمة على الأقل).`, min_words: words };
  return { prompt_ar: `اكتب ${words} كلمة على الأقل عن: ${topic}. استعمل روابط (و، ثم، لأن، لكن) وجملًا كاملة.`, min_words: words };
}
const CONNECTORS = ['و', 'ثم', 'لأن', 'لكن', 'بعد أن', 'إذا', 'عندما', 'حتى', 'أو', 'لذلك'];
export type TextMirror = { words: number; sentences: number; unique_ratio: number; connectors: number; notes_ar: string[] };
/** مرآة محلية بلا درجة: الطول · التنوّع · الروابط · الجمل */
export function textMirror(text: string, minWords = TEXT_MIN_WORDS): TextMirror {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); const ws = t ? t.split(' ').filter(Boolean) : []; const uniq = new Set(ws.map((w) => w.replace(/[^\u0600-\u06FF]/g, ''))).size;
  const sentences = t ? t.split(/[.!؟?\n]+/).map((s) => s.trim()).filter((s) => s.length > 2).length : 0;
  const connectors = CONNECTORS.reduce((n, c) => n + (c === 'و' ? ws.filter((w) => w.startsWith('و') && w.length > 2).length : (t.match(new RegExp(`(^|\\s)${c}(\\s|$)`, 'g')) || []).length), 0);
  const ratio = ws.length ? Math.round((uniq / ws.length) * 100) / 100 : 0; const notes: string[] = [];
  notes.push(ws.length < minWords ? `كتبت ${ws.length} كلمة — الهدف ${minWords} على الأقل.` : `طول مناسب: ${ws.length} كلمة.`);
  notes.push(sentences >= 3 ? `${sentences} جمل واضحة.` : 'قسّم كلامك إلى جمل أقصر تنتهي بنقطة.');
  notes.push(connectors >= 2 ? `استعملت ${connectors} رابطًا — هذا ما يجعل الكلام متماسكًا.` : 'جرّب رابطين على الأقل: ثم، لأن، لكن.');
  notes.push(ratio >= 0.6 ? 'تنوّع مفرداتك جيّد.' : 'كرّرت كلمات كثيرة — بدّل بعضها بمرادف.');
  return { words: ws.length, sentences, unique_ratio: ratio, connectors, notes_ar: notes };
}

/* ───────── 8) دمج نتيجة الإعادة في خريطة الوحدات (المؤجَّل من م9) ───────── */
/** تُضاف «بعد_الإعادة» إلى وحدة الخريطة الأصلية دون مسّ النسبة الأصلية (قبل ← بعد) */
export function mergeRetakeUnits(exitUnits: any[] | null | undefined, retakeTally: UnitTally | null | undefined): any[] | null {
  if (!Array.isArray(exitUnits) || !retakeTally) return Array.isArray(exitUnits) ? exitUnits : null;
  return exitUnits.map((u) => { const r = retakeTally[String(u?.الرمز)]; if (!r || !r.n) return u; const pct = Math.round((r.correct / r.n) * 100); return { ...u, بعد_الإعادة: { عدد: r.n, صواب: r.correct, النسبة: pct, الفرق: typeof u.النسبة === 'number' ? pct - u.النسبة : null } }; });
}

/* ───────── 9) التحقّق ───────── */
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
export const isAudioDataUrl = (v: unknown): v is string => typeof v === 'string' && /^data:audio\/(webm|ogg|mp4|mpeg|wav)(;codecs=[a-z0-9.,-]+)?;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= NOTE_AUDIO_MAX;
export function validateDayEdit(b: Record<string, unknown>, level: string): { ok: true; d: number; unit?: string | null; note_ar?: string | null; note_audio?: string | null } | { ok: false; error: string } {
  const d = Number(b.day); if (!Number.isInteger(d) || d < 1 || d > PLAN_DAYS) return { ok: false, error: 'اليوم من 1 إلى 14' };
  const out: { ok: true; d: number; unit?: string | null; note_ar?: string | null; note_audio?: string | null } = { ok: true, d };
  if ('unit' in b) { if (b.unit === null || b.unit === '') out.unit = null; else if (isUnitCode(b.unit) && unitLevelOf(b.unit) === level) out.unit = b.unit; else return { ok: false, error: 'وحدة غير صالحة لهذا المستوى' }; }
  if ('note_ar' in b) out.note_ar = clean(b.note_ar, NOTE_MAX) || null;
  if ('note_audio' in b) { if (b.note_audio === null || b.note_audio === '') out.note_audio = null; else if (isAudioDataUrl(b.note_audio)) out.note_audio = b.note_audio; else return { ok: false, error: 'التسجيل الصوتي غير صالح أو أطول من 30 ثانية' }; }
  return out;
}
/** الأيام القادمة من واجهة الاعتماد: نفس الهيكل، يُسمح بتبديل الوحدة والملاحظة فقط */
export function applyDayEdits(days: readonly PlanDay[], edits: ReadonlyArray<{ d: number; unit?: string | null; note_ar?: string | null; note_audio?: string | null }>): PlanDay[] {
  const map = new Map(edits.map((e) => [e.d, e])); return days.map((x) => { const e = map.get(x.d); if (!e) return x; const y: PlanDay = { ...x }; if ('unit' in e && x.kind === 'drill') y.unit = e.unit ?? null; if ('note_ar' in e) y.note_ar = e.note_ar ?? null; if ('note_audio' in e) y.note_audio = e.note_audio ?? null; return y; });
}

/* ───────── 10) الملخّص للوحات ───────── */
export type PlanSummary = { id: string; kind: PlanKind; status: PlanStatus; status_ar: string; today: number; ended: boolean; done: number; total: number; last_attempt_at: string | null; idle_days: number | null; avg_delta: number | null; ready: Readiness['state'] | null; units: string[]; skill: string | null; start_date: string | null; approved_at: string | null /* م12 */; client_requested?: boolean /* م12: اعتُمدت بعد طلب من الجهة */ };
export function summarize(plan: PlanRow, now: Date, mirror: readonly MirrorRow[] | null, ready: Readiness | null): PlanSummary {
  const cd = currentDay(plan.start_date, now); const done = plan.days.filter((d) => d.done_at).length;
  const lastAt = plan.last_attempt_at || plan.approved_at; const idle = plan.status === 'approved' && lastAt && !cd.ended ? Math.floor((now.getTime() - Date.parse(lastAt)) / 86400000) : null;
  const ds = (mirror || []).map((m) => m.delta).filter((x): x is number => typeof x === 'number');
  return { approved_at: plan.approved_at || null, id: plan.id, kind: plan.kind, status: plan.status, status_ar: STATUS_AR[plan.status] || plan.status, today: cd.d, ended: cd.ended, done, total: PLAN_DAYS, last_attempt_at: plan.last_attempt_at, idle_days: idle, avg_delta: ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null, ready: ready?.state || null, units: plan.units, skill: plan.skill, start_date: plan.start_date };
}

/* ====================================================================== قاعدة البيانات */
type Db = any;
const nowIso = () => new Date().toISOString();
const PLAN_COLS = 'id, kind, report_id, invite_id, email, user_id, level, skill, units, days, status, created_by, approved_by, approved_at, start_date, last_attempt_at, done_at, created_at';
const normPlan = (r: any): PlanRow => ({ ...r, kind: r.kind === 'placement' ? 'placement' : 'exit', units: Array.isArray(r.units) ? r.units : [], days: Array.isArray(r.days) ? r.days : [], status: (PLAN_STATUSES as readonly string[]).includes(r.status) ? r.status : 'draft' });

export async function planByReport(db: Db, reportId: string): Promise<PlanRow | null> { const { data } = await db.from('miaar_practice_plans').select(PLAN_COLS).eq('report_id', reportId).maybeSingle(); return data ? normPlan(data) : null; }
export async function planById(db: Db, id: string): Promise<PlanRow | null> { const { data } = await db.from('miaar_practice_plans').select(PLAN_COLS).eq('id', id).maybeSingle(); return data ? normPlan(data) : null; }
export async function plansForReports(db: Db, reportIds: readonly string[]): Promise<PlanRow[]> { const ids = reportIds.filter(Boolean).slice(0, 400); if (!ids.length) return []; const { data } = await db.from('miaar_practice_plans').select(PLAN_COLS).in('report_id', ids).limit(400); return (Array.isArray(data) ? data : []).map(normPlan); }
async function attemptsFor(db: Db, planId: string): Promise<AttemptRow[]> { const { data } = await db.from('miaar_practice_attempts').select('id, plan_id, email, day, kind, item_code, option_id, correct, payload, at').eq('plan_id', planId).order('at', { ascending: true }).limit(2000); return Array.isArray(data) ? data : []; }
/** البنود المكشوفة لبريدٍ ما (لاستثنائها من سحب الإعادة الرسمية) */
export async function exposedCodes(db: Db, email: string): Promise<Set<string>> {
  const em = String(email || '').trim().toLowerCase(); if (!em) return new Set();
  try { const { data } = await db.from('miaar_practice_attempts').select('item_code').eq('email', em).eq('kind', 'item').limit(3000); return new Set((Array.isArray(data) ? data : []).map((r: any) => String(r.item_code || '')).filter(Boolean)); } catch { return new Set(); }
}
const itemUnitsOf = (pool: readonly PoolItem[]) => new Map(pool.map((i) => [i.code, i.unitCodes || []] as [string, readonly string[]]));

/** مسوَّدة خطّة لتقرير عبور (أو إعادة المسوَّدة القائمة). لا إشعار هنا — الاعتماد هو الحدث */
export async function draftPlan(db: Db, rep: { id: string; candidate_email: string; user_id?: string | null; invite_id?: string | null; report: any }, actorId: string | null): Promise<{ ok: true; plan: PlanRow; existed: boolean } | { ok: false; error: string }> {
  const el = eligibleReport(rep.report); if (!el.ok) return { ok: false, error: el.reason };
  const existing = await planByReport(db, rep.id); if (existing) return { ok: true, plan: existing, existed: true };
  const level = el.level; let units = el.units;
  if (!units.length) { try { units = approvedFor(await listUnits(db), level as ExitLevel).slice(0, 3).map((u) => u.code); } catch { units = []; } }
  if (!units.length) return { ok: false, error: 'no_units' };
  /* نصّ قصير (تمرين مزدوج): للمهارة الإنتاجية في العبور، ولكل من هم A2 فأعلى بعد التشخيص */
  const productive = el.kind === 'exit' ? !!el.skill && PRODUCTIVE.has(el.skill) : level !== 'A1';
  const days = planDays(units, productive);
  const row = { kind: el.kind, report_id: rep.id, invite_id: rep.invite_id || null, email: String(rep.candidate_email || '').toLowerCase(), user_id: rep.user_id || null, level, skill: el.skill, units, days, status: 'draft', created_by: actorId, updated_at: nowIso() };
  const ins = await db.from('miaar_practice_plans').insert(row).select(PLAN_COLS).single(); if (ins.error || !ins.data) return { ok: false, error: ins.error?.message || 'insert_failed' };
  return { ok: true, plan: normPlan(ins.data), existed: false };
}
/** الاعتماد البشري: يثبّت الأيام (مع تعديلات المدرّب) ويبدأ العدّ اليوم ويُبلغ المتعلّم (P39) */
export async function approvePlan(db: Db, planId: string, actorId: string, edits: ReadonlyArray<{ d: number; unit?: string | null; note_ar?: string | null; note_audio?: string | null }> = [], opts: NoticeOpts & { code?: string | null; now?: Date } = {}): Promise<{ ok: true; plan: PlanRow } | { ok: false; error: string }> {
  const plan = await planById(db, planId); if (!plan) return { ok: false, error: 'not_found' }; if (plan.status !== 'draft') return { ok: false, error: `status_${plan.status}` };
  const now = opts.now || new Date(); const days = applyDayEdits(plan.days, edits);
  const up = await db.from('miaar_practice_plans').update({ days, status: 'approved', approved_by: actorId, approved_at: now.toISOString(), start_date: riyadhDate(now), updated_at: now.toISOString() }).eq('id', planId); if (up.error) return { ok: false, error: up.error.message || 'update_failed' };
  const next = { ...plan, days, status: 'approved' as PlanStatus, approved_by: actorId, approved_at: now.toISOString(), start_date: riyadhDate(now) };
  let code = opts.code || null; if (!code) { try { const { data } = await db.from('placement_reports').select('access_code').eq('id', plan.report_id).maybeSingle(); code = data?.access_code || null; } catch { code = null; } }
  if (code) { try { const t = noticeText({ kind: 'practice_plan', level: plan.level, code, days: PLAN_DAYS }); await pushNotice(db, { email: plan.email, user_id: plan.user_id, report_id: plan.report_id, kind: 'practice_plan', ...t, ref_id: planId, dedupe_key: `practice_plan:${planId}` }, opts); } catch { /* تحسيني */ } }
  return { ok: true, plan: next };
}
export async function editDay(db: Db, planId: string, e: { d: number; unit?: string | null; note_ar?: string | null; note_audio?: string | null }): Promise<boolean> {
  const plan = await planById(db, planId); if (!plan || plan.status === 'cancelled') return false; const days = applyDayEdits(plan.days, [e]);
  const r = await db.from('miaar_practice_plans').update({ days, updated_at: nowIso() }).eq('id', planId); return !r.error;
}
export async function cancelPlan(db: Db, planId: string): Promise<boolean> { const r = await db.from('miaar_practice_plans').update({ status: 'cancelled', cancelled_at: nowIso(), updated_at: nowIso() }).eq('id', planId); return !r.error; }

/** ما يراه المتعلّم برمز نتيجته: الأيام (بلا بنود الأيام الأخرى) · بطاقة اليوم المفتوح · المرآة · الجاهزية */
export async function learnerView(db: Db, rep: { id: string; report: any }, opts: { now?: Date } = {}) {
  const plan = await planByReport(db, rep.id); if (!plan || plan.status === 'draft' || plan.status === 'cancelled') return null;
  const now = opts.now || new Date(); const units = await listUnits(db).catch(() => [] as Unit[]); const ix = unitIndex(units);
  const cd = currentDay(plan.start_date, now); const attempts = await attemptsFor(db, plan.id);
  const pool = await loadApprovedPool(db).catch(() => [] as PoolItem[]); const iu = itemUnitsOf(pool);
  const progress = unitProgress(attempts, iu, plan.units); const el = eligibleReport(rep.report); const mirror = mirrorRowsFrom(el.ok ? el.before : new Map(), progress, units); const ready = readiness(progress, units, plan.kind);
  const active = plan.status === 'approved' && !cd.ended ? activeDay(plan.days, cd.d) : null;
  let card: { d: number; kind: DayKind; unit: string | null; unit_title: string; focus_ar: string; form: PublicForm | null; text: { prompt_ar: string; min_words: number; earlier: { d: number; text: string } | null } | null; answered: Record<string, Feedback>; note_ar: string | null; note_audio: string | null; first_of_unit: boolean } | null = null;
  if (active) {
    let items = active.items || [];
    if (!items.length) {
      const used = new Set(attempts.filter((a) => a.kind === 'item' && a.item_code).map((a) => a.item_code as string));
      items = active.kind === 'mirror' ? pickMirror(attempts) : pickDrill(pool, plan.level, active.unit || '', plan.skill, used, `${plan.id}:${active.d}`).map((i) => i.code);
      if (active.kind === 'mirror' && items.length < ITEMS_PER_DAY) { const u = plan.units[0]; if (u) items = [...new Set([...items, ...pickDrill(pool, plan.level, u, plan.skill, used, `${plan.id}:${active.d}:fill`).map((i) => i.code)])].slice(0, ITEMS_PER_DAY); }
      const days = plan.days.map((x) => (x.d === active.d ? { ...x, items } : x)); await db.from('miaar_practice_plans').update({ days, updated_at: nowIso() }).eq('id', plan.id); plan.days = days;
    }
    const byCode = new Map(pool.map((i) => [i.code, i])); const u = active.unit ? ix.get(active.unit) || null : null;
    let form: PublicForm | null = null; if (items.length) { try { form = await formFromPool(db, pool, items, await loadPassages(db)); } catch { form = null; } }
    const answered: Record<string, Feedback> = {}; for (const a of attempts) { if (a.day !== active.d || a.kind !== 'item' || !a.item_code) continue; const it = byCode.get(a.item_code); if (it) answered[a.item_code] = gradeAnswer(it, a.option_id || '', u); }
    const unitLabel = active.kind === 'mirror' ? 'يوم المرآة' : u?.title_ar || active.unit || '';
    const earlier = active.text && active.d > 1 ? attempts.filter((a) => a.kind === 'text' && a.day < active.d).sort((a, b) => a.day - b.day)[0] || null : null;
    const firstOfUnit = active.kind === 'drill' && !!active.unit && !plan.days.some((x) => x.d < active.d && x.unit === active.unit);
    card = { d: active.d, kind: active.kind, unit: active.unit, unit_title: unitLabel, focus_ar: u?.focus_ar || (active.kind === 'mirror' ? 'أضعف خمسة بنود من أيامك السابقة — هل تغيّر شيء؟' : ''), form, text: active.text ? { ...textPrompt(u, plan.skill, plan.level), earlier: earlier ? { d: earlier.day, text: String(earlier.payload?.text || '') } : null } : null, answered, note_ar: active.note_ar || null, note_audio: firstOfUnit || active.kind === 'mirror' ? active.note_audio || null : null, first_of_unit: firstOfUnit };
  }
  const days = plan.days.map((x) => ({ d: x.d, kind: x.kind, unit: x.unit, unit_title: x.kind === 'mirror' ? 'المرآة' : ix.get(x.unit || '')?.title_ar || x.unit || '', done: !!x.done_at, n: x.n || 0, correct: x.correct || 0, text: !!x.text, has_note: !!(x.note_ar || x.note_audio), today: x.d === cd.d }));
  const texts = attempts.filter((a) => a.kind === 'text').map((a) => ({ d: a.day, text: String(a.payload?.text || ''), mirror: a.payload?.mirror || null }));
  return { النوع: plan.kind, الحالة: plan.status, اليوم: cd.d, انتهت: cd.ended, المستوى: plan.level, المهارة: plan.skill, الوحدات: plan.units.map((c) => ({ الرمز: c, الاسم: ix.get(c)?.title_ar || c })), الأيام: days, بطاقة_اليوم: card, المرآة: mirror, الجاهزية: ready, نصوص: texts, أُنجز: plan.days.filter((d) => d.done_at).length, العنوان: LEARNER_TITLE, الشعار: plan.kind === 'placement' ? 'مِران تدريب لا اختبار — نتيجتك الرسمية هي تقرير تشخيصك، وأول درس يبدأ من هنا.' : 'مِران تدريب لا اختبار — نتيجتك الرسمية تُقاس في الإعادة بحضور إنسان.' };
}

/** إجابة بند من بطاقة اليوم المفتوح: تصحيح على الخادم · حفظ (كشف) · إغلاق اليوم عند اكتمال البنود */
export async function answerItem(db: Db, rep: { id: string; report: any }, body: { day: unknown; item: unknown; option: unknown }, opts: { now?: Date } = {}): Promise<{ ok: true; feedback: Feedback; day_done: boolean; progress: { n: number; correct: number } } | { ok: false; error: string }> {
  const plan = await planByReport(db, rep.id); if (!plan || plan.status !== 'approved') return { ok: false, error: 'no_active_plan' };
  const now = opts.now || new Date(); const cd = currentDay(plan.start_date, now); if (cd.ended || cd.before) return { ok: false, error: 'plan_window' };
  const d = Number(body.day); const day = plan.days.find((x) => x.d === d); if (!day || day.done_at) return { ok: false, error: 'day_closed' };
  const active = activeDay(plan.days, cd.d); if (!active || active.d !== d) return { ok: false, error: 'not_active_day' };
  const code = String(body.item || ''); if (!(day.items || []).includes(code)) return { ok: false, error: 'item_not_in_card' };
  const attempts = await attemptsFor(db, plan.id); if (attempts.some((a) => a.day === d && a.kind === 'item' && a.item_code === code)) return { ok: false, error: 'already_answered' };
  const pool = await loadApprovedPool(db); const item = pool.find((i) => i.code === code); if (!item) return { ok: false, error: 'item_unavailable' };
  const option = String(body.option || ''); if (!item.options.some((o) => o.id === option)) return { ok: false, error: 'bad_option' };
  const units = await listUnits(db).catch(() => [] as Unit[]); const u = day.unit ? unitIndex(units).get(day.unit) || null : null; const fb = gradeAnswer(item, option, u);
  const ins = await db.from('miaar_practice_attempts').insert({ plan_id: plan.id, email: plan.email, day: d, kind: 'item', item_code: code, option_id: option, correct: fb.correct, at: now.toISOString() }); if (ins.error) return { ok: false, error: ins.error.message || 'save_failed' };
  const mine = attempts.filter((a) => a.day === d && a.kind === 'item'); const n = mine.length + 1; const correct = mine.filter((a) => a.correct).length + (fb.correct ? 1 : 0);
  const needText = !!day.text && !attempts.some((a) => a.day === d && a.kind === 'text'); const done = n >= (day.items || []).length && !needText;
  const days = plan.days.map((x) => (x.d === d ? { ...x, n, correct, ...(done ? { done_at: now.toISOString() } : {}) } : x));
  await db.from('miaar_practice_plans').update({ days, last_attempt_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', plan.id);
  return { ok: true, feedback: fb, day_done: done, progress: { n, correct } };
}
/** نصّ المهارة الإنتاجية: مرآة محلية (بلا درجة) · «تمرين مزدوج» يعرض نصّ اليوم 1 بجانب اليوم 12 */
export async function submitText(db: Db, rep: { id: string; report: any }, body: { day: unknown; text: unknown }, opts: { now?: Date } = {}): Promise<{ ok: true; mirror: TextMirror; day_done: boolean; earlier: { d: number; text: string } | null } | { ok: false; error: string }> {
  const plan = await planByReport(db, rep.id); if (!plan || plan.status !== 'approved') return { ok: false, error: 'no_active_plan' };
  const now = opts.now || new Date(); const cd = currentDay(plan.start_date, now); if (cd.ended || cd.before) return { ok: false, error: 'plan_window' };
  const d = Number(body.day); const day = plan.days.find((x) => x.d === d); if (!day || !day.text || day.done_at) return { ok: false, error: 'day_closed' };
  const active = activeDay(plan.days, cd.d); if (!active || active.d !== d) return { ok: false, error: 'not_active_day' };
  const text = String(body.text || '').replace(/\r/g, '').trim().slice(0, TEXT_MAX_CHARS); if (!/[\u0600-\u06FF]/.test(text) || text.length < 10) return { ok: false, error: 'text_too_short' };
  const attempts = await attemptsFor(db, plan.id); if (attempts.some((a) => a.day === d && a.kind === 'text')) return { ok: false, error: 'already_answered' };
  const units = await listUnits(db).catch(() => [] as Unit[]); const u = day.unit ? unitIndex(units).get(day.unit) || null : null; const m = textMirror(text, textPrompt(u, plan.skill, plan.level).min_words);
  const ins = await db.from('miaar_practice_attempts').insert({ plan_id: plan.id, email: plan.email, day: d, kind: 'text', item_code: null, option_id: null, correct: null, payload: { text, mirror: m }, at: now.toISOString() }); if (ins.error) return { ok: false, error: ins.error.message || 'save_failed' };
  const nItems = attempts.filter((a) => a.day === d && a.kind === 'item').length; const done = nItems >= (day.items || []).length;
  const days = plan.days.map((x) => (x.d === d ? { ...x, ...(done ? { done_at: now.toISOString() } : {}) } : x));
  await db.from('miaar_practice_plans').update({ days, last_attempt_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', plan.id);
  const earlier = attempts.filter((a) => a.kind === 'text' && a.day < d).sort((a, b) => a.day - b.day)[0] || null;
  return { ok: true, mirror: m, day_done: done, earlier: earlier ? { d: earlier.day, text: String(earlier.payload?.text || '') } : null };
}

/** للوحة العبور والجهة: report_id → ملخّص */
export async function summariesForReports(db: Db, reps: ReadonlyArray<{ id: string; report?: any }>, opts: { now?: Date } = {}): Promise<Record<string, PlanSummary>> {
  const now = opts.now || new Date(); const plans = await plansForReports(db, reps.map((r) => r.id)).catch(() => [] as PlanRow[]); const out: Record<string, PlanSummary> = {}; if (!plans.length) return out;
  const units = await listUnits(db).catch(() => [] as Unit[]); const pool = await loadApprovedPool(db).catch(() => [] as PoolItem[]); const iu = itemUnitsOf(pool); const beforeOf = new Map(reps.map((r) => { const el = eligibleReport(r.report); return [r.id, el.ok ? el.before : new Map<string, number>()]; }));
  const ids = plans.map((p) => p.id); let all: AttemptRow[] = []; try { const { data } = await db.from('miaar_practice_attempts').select('plan_id, email, day, kind, item_code, option_id, correct, at').in('plan_id', ids).limit(5000); all = Array.isArray(data) ? data : []; } catch { all = []; }
  /* م12: أيّ خطّة اعتُمدت بعد «طلب مِران» من الجهة الطالبة تُعدّ «بطلب من جهة» (من events أمر الخدمة — بلا عمود جديد) */
  const invIds = Array.from(new Set(plans.map((p) => p.invite_id).filter((x): x is string => !!x))); const reqAt = new Map<string, string>();
  if (invIds.length) { try { const { data: ords } = await db.from('miaar_service_orders').select('invite_id, events').in('invite_id', invIds); for (const o of (Array.isArray(ords) ? ords : []) as any[]) { const ev = (Array.isArray(o.events) ? o.events : []).filter((e: any) => e && e.type === 'practice_request'); if (ev.length) reqAt.set(String(o.invite_id), String(ev[0].at || '')); } } catch { /* تحسيني */ } }
  for (const p of plans) { const att = all.filter((a) => a.plan_id === p.id); const prog = unitProgress(att, iu, p.units); const sm = summarize(p, now, mirrorRowsFrom(beforeOf.get(p.report_id) || new Map(), prog, units), att.length ? readiness(prog, units, p.kind) : null);
    const ra = p.invite_id ? reqAt.get(p.invite_id) : undefined; sm.client_requested = !!(ra && p.approved_at && ra <= p.approved_at); out[p.report_id] = sm; }
  return out;
}
/** مجاميع دعوة (للجهة م7 ولملف الاعتماد م9): بلا أسماء */
export type PracticeFacts = { plans: number; placement: number /* م11 */; client_requested: number /* م12 */; approved: number; active: number; days_done: number; avg_delta: number | null; with_delta: number; retook: number; passed_after: number };
export async function practiceFactsForReports(db: Db, reps: ReadonlyArray<{ id: string; report?: any }>, opts: { now?: Date } = {}): Promise<PracticeFacts> {
  const s = await summariesForReports(db, reps, opts); const vals = Object.values(s); const ds = vals.map((v) => v.avg_delta).filter((x): x is number => typeof x === 'number');
  const planned = new Set(Object.keys(s)); let retook = 0; let passedAfter = 0;
  for (const r of reps) { if (!planned.has(r.id)) continue; const ex = r.report?.exit; if (ex?.الإعادة?.الحالة === 'merged') { retook += 1; if (ex.النتيجة === 'passed') passedAfter += 1; } }
  return { plans: vals.length, placement: vals.filter((v) => v.kind === 'placement' && v.status !== 'draft' && v.status !== 'cancelled').length, client_requested: vals.filter((v) => v.client_requested && v.status !== 'draft' && v.status !== 'cancelled').length, approved: vals.filter((v) => v.status !== 'draft' && v.status !== 'cancelled').length, active: vals.filter((v) => v.status === 'approved' && !v.ended).length, days_done: vals.reduce((a, v) => a + v.done, 0), avg_delta: ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null, with_delta: ds.length, retook, passed_after: passedAfter };
}

/** تذكير إنساني من المدرّب (بتوقيعه) — مرّة في اليوم */
export async function nudge(db: Db, planId: string, trainerName: string, opts: NoticeOpts = {}): Promise<boolean> {
  const plan = await planById(db, planId); if (!plan || plan.status !== 'approved') return false; const now = opts.now || new Date();
  let code: string | null = null; try { const { data } = await db.from('placement_reports').select('access_code').eq('id', plan.report_id).maybeSingle(); code = data?.access_code || null; } catch { code = null; } if (!code) return false;
  const t = noticeText({ kind: 'practice_nudge', trainer: trainerName, code }); const r = await pushNotice(db, { email: plan.email, user_id: plan.user_id, report_id: plan.report_id, kind: 'practice_nudge', ...t, ref_id: planId, dedupe_key: `practice_nudge:${planId}:${riyadhDate(now)}` }, opts); return r.inserted;
}

/** التشغيل اليومي (من cron المتابعات القائم): «مِران اليوم» لكل خطّة معتمدة لم يُنجز يومها · إغلاق ما انتهى · تنبيه المدرّب عند غياب 3 أيام */
export type PracticeRunSummary = { checked: number; day_sent: number; closed: number; idle_sent: number; errors: string[] };
export async function runPracticeReminders(db: Db, opts: NoticeOpts = {}): Promise<PracticeRunSummary> {
  const now = opts.now || new Date(); const s: PracticeRunSummary = { checked: 0, day_sent: 0, closed: 0, idle_sent: 0, errors: [] };
  try {
    const { data } = await db.from('miaar_practice_plans').select(PLAN_COLS).eq('status', 'approved').limit(1000); const plans = (Array.isArray(data) ? data : []).map(normPlan);
    if (!plans.length) return s; const units = await listUnits(db).catch(() => [] as Unit[]); const ix = unitIndex(units);
    const repIds = plans.map((p) => p.report_id); const codes = new Map<string, string>(); const names = new Map<string, string>();
    try { const { data: reps } = await db.from('placement_reports').select('id, access_code, report').in('id', repIds.slice(0, 1000)); for (const r of (Array.isArray(reps) ? reps : []) as any[]) { codes.set(String(r.id), String(r.access_code || '')); names.set(String(r.id), String(r.report?.بيانات_المتقدم?.الاسم || '').split(/\s+/)[0] || 'المتعلّم'); } } catch { /* تحسيني */ }
    for (const p of plans) {
      s.checked += 1; const cd = currentDay(p.start_date, now); const code = codes.get(p.report_id) || '';
      if (cd.ended) { if (!opts.dry) await db.from('miaar_practice_plans').update({ status: 'done', done_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', p.id); s.closed += 1; continue; }
      if (cd.before || !code) continue;
      const day = p.days.find((x) => x.d === cd.d); if (day && !day.done_at) {
        const title = day.kind === 'mirror' ? 'يوم المرآة' : ix.get(day.unit || '')?.title_ar || day.unit || '';
        const t = noticeText({ kind: 'practice_day', day: cd.d, unit_title: title, code }); const r = await pushNotice(db, { email: p.email, user_id: p.user_id, report_id: p.report_id, kind: 'practice_day', ...t, ref_id: p.id, dedupe_key: `practice_day:${p.id}:${cd.d}` }, { ...opts, now }); if (r.inserted) s.day_sent += 1;
      }
      /* غياب 3 أيام متتالية → تنبيه داخل أَثَر للمعتمِد (بلا دفعة) مرّة كل 3 أيام */
      const lastAt = Date.parse(p.last_attempt_at || p.approved_at || ''); const idle = Number.isFinite(lastAt) ? Math.floor((now.getTime() - lastAt) / 86400000) : 0;
      if (idle >= IDLE_DAYS && p.approved_by) {
        let staffEmail: string | null = null; try { const { data: pr } = await db.from('profiles').select('email').eq('id', p.approved_by).maybeSingle(); staffEmail = pr?.email || null; } catch { staffEmail = null; }
        if (staffEmail) { const t = noticeText({ kind: 'practice_idle', name: names.get(p.report_id) || 'المتعلّم', days: idle, inviteId: p.invite_id || '' }); const r = await pushNotice(db, { email: staffEmail, user_id: p.approved_by, report_id: p.report_id, kind: 'practice_idle', ...t, ref_id: p.id, dedupe_key: `practice_idle:${p.id}:${Math.floor(cd.d / IDLE_DAYS)}`, push: false }, { ...opts, now }); if (r.inserted) s.idle_sent += 1; }
      }
    }
  } catch (e: any) { s.errors.push(`practice:${e?.message || e}`); }
  return s;
}

/* ───────── م11 «مِران البداية»: مسوَّدات عند قرار التسكين + تنبيه مدرّب الشعبة ───────── */
export type StartDraftSummary = { drafted: number; existed: number; skipped: number; notified: number };
/** تُستدعى بعد اعتماد قرار التسكين: مسوَّدة لكل تقرير مؤهّل (لا تُفتح للمتعلّم) + إشعار واحد لمدرّب الشعبة «n خطط بانتظار توقيعك» */
export async function draftForPlacements(db: Db, items: ReadonlyArray<{ rep: { id: string; candidate_email: string; user_id?: string | null; invite_id?: string | null; report: any }; classroom_id: string | null }>, actorId: string | null, opts: NoticeOpts = {}): Promise<StartDraftSummary> {
  const s: StartDraftSummary = { drafted: 0, existed: 0, skipped: 0, notified: 0 }; const byRoom = new Map<string, number>();
  for (const it of items) {
    const r = await draftPlan(db, it.rep, actorId).catch(() => ({ ok: false as const, error: 'x' }));
    if (!r.ok) { s.skipped += 1; continue; } if (r.existed) { s.existed += 1; continue; } s.drafted += 1;
    if (it.classroom_id) byRoom.set(it.classroom_id, (byRoom.get(it.classroom_id) || 0) + 1);
  }
  for (const [cid, n] of byRoom) {
    try {
      const { data: room } = await db.from('classrooms').select('id, code, section_name, trainer_id').eq('id', cid).maybeSingle(); if (!room?.trainer_id) continue;
      /* مدرّب الشعبة في جدول trainers (الموروث) — كما في «جلسة التعويض» م6-ج */
      const { data: tr } = await db.from('trainers').select('email').eq('id', room.trainer_id).maybeSingle(); const email = String(tr?.email || '').trim().toLowerCase(); if (!email) continue;
      /* العدد = كل مسوَّدات الشعبة التي ما زالت بانتظار التوقيع (لا دفعة اليوم فقط) — والإشعار يُحدَّث لا يتكرّر */
      let pending = n;
      try { const { data: dec } = await db.from('placement_decisions').select('report_id').eq('classroom_id', cid).eq('decision_status', 'approved').limit(500); const ids = (Array.isArray(dec) ? dec : []).map((d: any) => String(d.report_id));
        if (ids.length) { const { data: pl } = await db.from('miaar_practice_plans').select('id').in('report_id', ids).eq('status', 'draft').eq('kind', 'placement').limit(500); pending = Math.max(n, Array.isArray(pl) ? pl.length : n); } } catch { pending = n; }
      const t = noticeText({ kind: 'practice_pending', n: pending, classroom: String(room.code || room.section_name || ''), classroomId: cid });
      const day = riyadhDate(opts.now || new Date());
      const res = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'practice_pending', ...t, ref_id: cid, dedupe_key: `practice_pending:${cid}:${day}`, push: false, merge: true }, opts); if (res.inserted) s.notified += 1;
    } catch { /* تحسيني */ }
  }
  return s;
}

/* ───────── م12 «مِران للجهات» ───────── */
/** جاهزية الدفعة: رقم واحد للجهة — كم خطّة مفتوحة بلغت «جاهز» (بلا أسماء ولا نسب فردية) */
export type CohortReadiness = { plans: number; active: number; ready: number; close: number; early: number; ready_pct: number | null; avg_delta: number | null; days_done: number };
export function cohortReadiness(sums: Readonly<Record<string, PlanSummary>>): CohortReadiness {
  const vals = Object.values(sums).filter((v) => v.status === 'approved' || v.status === 'done'); const open = vals.filter((v) => v.status === 'approved' && !v.ended);
  const c = { ready: 0, close: 0, early: 0 }; for (const v of vals) { if (v.ready === 'ready') c.ready += 1; else if (v.ready === 'close') c.close += 1; else c.early += 1; }
  const ds = vals.map((v) => v.avg_delta).filter((x): x is number => typeof x === 'number');
  return { plans: vals.length, active: open.length, ...c, ready_pct: vals.length ? Math.round((c.ready / vals.length) * 100) : null, avg_delta: ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null, days_done: vals.reduce((a, v) => a + v.done, 0) };
}
/** ما تراه الجهة عن طالب واحد: الأيام فقط والجاهزية — لا نسب مِران */
export function clientPracticeCell(s: PlanSummary | null | undefined): { status: PlanStatus; status_ar: string; today: number; done: number; total: number; ready: Readiness['state'] | null; ready_ar: string | null } | null {
  if (!s || s.status === 'draft' || s.status === 'cancelled') return null;
  return { status: s.status, status_ar: s.status_ar, today: s.today, done: s.done, total: s.total, ready: s.ready, ready_ar: s.ready ? (s.kind === 'placement' ? READY_START_AR : READY_AR)[s.ready] : null };
}
export const CLIENT_MSG_MAX = 200;
export type ClientPracticeRequest = { at: string; message: string | null; eligible: number; by: string | null };
/** آخر طلب مِران من الجهة في سجلّ أحداث أمر الخدمة (events) — بلا جدول جديد */
export function lastClientRequest(events: unknown): ClientPracticeRequest | null {
  const list = Array.isArray(events) ? (events as any[]).filter((e) => e && e.type === 'practice_request') : []; if (!list.length) return null;
  const e = list[list.length - 1]; return { at: String(e.at || ''), message: e.message ? String(e.message).slice(0, CLIENT_MSG_MAX) : null, eligible: Number(e.eligible) || 0, by: e.by ? String(e.by) : null };
}
/** رسالة الجهة إلى طلابها: نصّ قصير بلا روابط ولا وسوم — تُقترح كملاحظة اليوم 1 ويقرّر الموقّع إدراجها */
export function normalizeClientMessage(v: unknown): { ok: true; text: string | null } | { ok: false; error: string } {
  if (v === null || v === undefined || v === '') return { ok: true, text: null }; if (typeof v !== 'string') return { ok: false, error: 'bad_message' };
  const t = v.replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim(); if (!t) return { ok: true, text: null }; if (t.length > CLIENT_MSG_MAX) return { ok: false, error: 'message_too_long' };
  return { ok: true, text: t };
}
