// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار — م4-ج «هيئة التصحيح» (منطق خالص بلا شبكة، قابل للاختبار):
 *  سحب القراءة الثانية · قاعدة الاتفاق بين قراءتين · كابا بالأزواج والمهارات · «مرآة المصحّح» · بوّابة اعتماد المصحّح بالمراسي
 *  · من يستحقّ حذف صوته · طلاقة النسخ. القاعدة الثابتة: لا درجة تُنشر قبل إنسان، ولا يرى مصحّح قراءةَ غيره قبل أن يرسل قراءته. */
import { createHash } from 'crypto';
import { weightedKappa } from './rubric';
import type { RubricScores } from './rubric';
import type { ProductiveSkill } from './registry';

/** سياسة الهيئة (قرارات 2026-11-03): 20% قراءة ثانية + أوّل 50 أداء لكل مهارة 100% · التحكيم عند فرق درجتين · الاعتماد 5 مراسٍ وكابا ≥ .6 · قفل 24 ساعة بعد الإخفاق · الصوت 180 يومًا */
export const RATER_POLICY = { second_rate: 0.2, full_first: 50, adjudicate_gap: 2, anchors_min: 5, kappa_pass: 0.6, lock_hours: 24, audio_days: 180, pair_min: 10 } as const;

export type Reading = { performance_id: string; rater_id: string; reading: number; scores: RubricScores; band: number; mean?: number | null; seconds?: number | null; created_at?: string };

/** الدرجة الكلّية لقراءة: متوسّط الأبعاد مقرَّبًا إلى 0–5 (نصف الدرجة يصعد) */
export function bandOf(scores: RubricScores): number {
  const vals = Object.values(scores).map(Number).filter((v) => Number.isFinite(v)); if (!vals.length) return 0;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length; return Math.max(0, Math.min(5, Math.round(m + 1e-9)));
}
export const meanOf = (scores: RubricScores): number => { const v = Object.values(scores).map(Number); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : 0; };

const h100 = (s: string) => parseInt(createHash('sha256').update(s).digest('hex').slice(0, 8), 16) % 100;
/** هل يُسحب هذا الأداء للقراءة الثانية؟ (ثابت بالمعرّف حتى لا يتغيّر عند إعادة الحساب)
 *  نعم إذا: المهارة ما زالت في أوّل 50 أداءً مقروءًا · أو وقع في عيّنة 20% · أو كانت القراءة الأولى على الحدّ (متوسّط الأبعاد على نصف درجة ±0.15) */
export function needsSecondReading(p: { id: string; skill_read_count: number; first_mean: number }, policy = RATER_POLICY): boolean {
  if (p.skill_read_count < policy.full_first) return true;
  if (h100(`m4c:${p.id}`) < Math.round(policy.second_rate * 100)) return true;
  const frac = Math.abs(p.first_mean - Math.floor(p.first_mean) - 0.5); return frac <= 0.15;
}

export type Agreement = { kind: 'agree' | 'average' | 'adjudicate'; gap: number; scores: RubricScores; band: number; kind_ar: string };
const AGREE_AR: Record<Agreement['kind'], string> = { agree: 'اتفاق تامّ', average: 'فرق درجة — اعتُمد المتوسّط', adjudicate: 'فرق درجتين فأكثر — يحتاج تحكيمًا' };
/** قاعدة الاتفاق بين القراءتين الأولى والثانية */
export function agreementOf(r1: Reading, r2: Reading, policy = RATER_POLICY): Agreement {
  const gap = Math.abs(r1.band - r2.band);
  if (gap === 0) return { kind: 'agree', gap, scores: r1.scores, band: r1.band, kind_ar: AGREE_AR.agree };
  if (gap >= policy.adjudicate_gap) return { kind: 'adjudicate', gap, scores: r1.scores, band: r1.band, kind_ar: AGREE_AR.adjudicate };
  const scores: RubricScores = {}; for (const k of Object.keys(r1.scores)) { const a = Number(r1.scores[k]); const b = Number(r2.scores[k]); scores[k] = Number.isFinite(b) ? Math.round((a + b) / 2 + 1e-9) : a; }
  return { kind: 'average', gap, scores, band: bandOf(scores), kind_ar: AGREE_AR.average };
}

/** تفسير كابا بلغة الإنسان */
export function kappaLight(k: number | null, n: number, policy = RATER_POLICY): { light: 'gray' | 'red' | 'yellow' | 'green' | 'gold'; ar: string } {
  if (k == null || n < policy.pair_min) return { light: 'gray', ar: `قيد الجمع (${n} من ${policy.pair_min} زوجًا)` };
  if (k < 0.4) return { light: 'red', ar: 'ضعيف — يلزم تدريب مشترك' }; if (k < 0.6) return { light: 'yellow', ar: 'مقبول' }; if (k < 0.8) return { light: 'green', ar: 'جيّد' }; return { light: 'gold', ar: 'ممتاز' };
}

export type PairStat = { a: string; b: string; n: number; kappa: number | null; exact: number; light: string; light_ar: string };
export type SkillAgreement = { skill: ProductiveSkill; pairs_n: number; kappa: number | null; exact: number; adjudications: number; light: string; light_ar: string; by_pair: PairStat[] };
/** اتفاق المصحّحين لكل مهارة: الأزواج (قراءة 1 × قراءة 2 على الأداء نفسه) مجمَّعة ثم لكل زوج مصحّحَين */
export function agreementReport(readings: readonly Reading[], skillOf: (performanceId: string) => ProductiveSkill | null, adjudications: Record<ProductiveSkill, number>, policy = RATER_POLICY): SkillAgreement[] {
  const byPerf = new Map<string, Reading[]>(); for (const r of readings) { if (r.reading !== 1 && r.reading !== 2) continue; const arr = byPerf.get(r.performance_id) || []; arr.push(r); byPerf.set(r.performance_id, arr); }
  const out: SkillAgreement[] = [];
  for (const skill of ['writing', 'speaking'] as ProductiveSkill[]) {
    const A: number[] = []; const B: number[] = []; const pairs = new Map<string, { a: string; b: string; x: number[]; y: number[] }>();
    for (const [pid, rs] of byPerf) {
      if (skillOf(pid) !== skill) continue; const r1 = rs.find((r) => r.reading === 1); const r2 = rs.find((r) => r.reading === 2); if (!r1 || !r2) continue;
      A.push(r1.band); B.push(r2.band);
      const [a, b] = [r1.rater_id, r2.rater_id].sort(); const key = `${a}|${b}`; const p = pairs.get(key) || { a, b, x: [], y: [] }; p.x.push(r1.rater_id === a ? r1.band : r2.band); p.y.push(r1.rater_id === a ? r2.band : r1.band); pairs.set(key, p);
    }
    const n = A.length; const kappa = weightedKappa(A, B); const exact = n ? Math.round((A.filter((v, i) => v === B[i]).length / n) * 100) / 100 : 0; const l = kappaLight(kappa, n, policy);
    const by_pair: PairStat[] = [...pairs.values()].map((p) => { const k = weightedKappa(p.x, p.y); const ex = p.x.length ? Math.round((p.x.filter((v, i) => v === p.y[i]).length / p.x.length) * 100) / 100 : 0; const pl = kappaLight(k, p.x.length, policy); return { a: p.a, b: p.b, n: p.x.length, kappa: k, exact: ex, light: pl.light, light_ar: pl.ar }; }).sort((x, y) => y.n - x.n);
    out.push({ skill, pairs_n: n, kappa, exact, adjudications: adjudications[skill] || 0, light: l.light, light_ar: l.ar, by_pair });
  }
  return out;
}

export type Mirror = { n: number; n_pairs: number; severity: number | null; severity_ar: string; kappa: number | null; kappa_ar: string; avg_seconds: number | null; adjudication_rate: number | null };
/** «مرآة المصحّح»: عدد قراءاته · انحرافه عن القارئ الآخر على الأداءات المشتركة (سالب = أشدّ) · كاباه مع الآخرين · زمنه · نسبة ما استدعى تحكيمًا */
export function raterMirror(readings: readonly Reading[], raterId: string, policy = RATER_POLICY): Mirror {
  const mine = readings.filter((r) => r.rater_id === raterId && r.reading >= 1); const byPerf = new Map<string, Reading[]>();
  for (const r of readings) { if (r.reading < 1 || r.reading > 2) continue; const arr = byPerf.get(r.performance_id) || []; arr.push(r); byPerf.set(r.performance_id, arr); }
  const me: number[] = []; const other: number[] = []; let adj = 0;
  for (const r of mine) { if (r.reading > 2) continue; const o = (byPerf.get(r.performance_id) || []).find((x) => x.rater_id !== raterId && x.reading >= 1 && x.reading <= 2); if (!o) continue; me.push(r.band); other.push(o.band); if (Math.abs(r.band - o.band) >= policy.adjudicate_gap) adj += 1; }
  const n_pairs = me.length; const severity = n_pairs ? Math.round((me.reduce((a, b) => a + b, 0) - other.reduce((a, b) => a + b, 0)) / n_pairs * 100) / 100 : null;
  const kappa = weightedKappa(me, other); const secs = mine.map((r) => Number(r.seconds)).filter((v) => v > 0); const avg_seconds = secs.length ? Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) : null;
  const severity_ar = severity == null ? 'لا أداءات مشتركة بعد' : Math.abs(severity) < 0.25 ? 'متوازن مع زملائك' : severity < 0 ? `أشدّ من زملائك بنحو ${Math.abs(severity)} درجة` : `أيسر من زملائك بنحو ${severity} درجة`;
  return { n: mine.length, n_pairs, severity, severity_ar, kappa, kappa_ar: kappaLight(kappa, n_pairs, policy).ar, avg_seconds, adjudication_rate: n_pairs ? Math.round((adj / n_pairs) * 100) / 100 : null };
}

export type Calibration = { n: number; kappa: number | null; passed: boolean; need: number; ar: string };
/** بوّابة الاعتماد: قراءات المصحّح على المراسي مقابل درجات المراسي */
export function calibrationOf(pairs: readonly { mine: number; anchor: number }[], policy = RATER_POLICY): Calibration {
  const n = pairs.length; const kappa = weightedKappa(pairs.map((p) => p.mine), pairs.map((p) => p.anchor)); const need = Math.max(0, policy.anchors_min - n);
  const passed = n >= policy.anchors_min && kappa != null && kappa >= policy.kappa_pass;
  const ar = passed ? `معتمد — كابا ${kappa} على ${n} مراسٍ` : need > 0 ? `بقي ${need} من ${policy.anchors_min} مراسٍ` : `لم يبلغ الحدّ (كابا ${kappa ?? '—'} والمطلوب ≥ ${policy.kappa_pass}) — أعد التأهيل بعد ${policy.lock_hours} ساعة`;
  return { n, kappa, passed, need, ar };
}

/** من يستحقّ حذف صوته الآن */
export const dueForPurge = (rows: readonly { media_path: string | null; expires_at: string | null }[], nowIso: string): number => rows.filter((r) => r.media_path && r.expires_at && r.expires_at < nowIso).length;

/** طلاقة النسخ: كلمات/دقيقة وعدد التردّدات (إشارة للمصحّح، لا درجة) */
export function fluencyOf(transcript: string | null | undefined, durationSec: number | null | undefined): { words: number; wpm: number | null; fillers: number } | null {
  const t = String(transcript || '').trim(); if (!t) return null;
  const words = t.split(/\s+/).filter(Boolean).length; const fillers = (t.match(/(?:^|\s)(?:آآ+|إمم+|أأ+|اممم*|يعني|\.\.\.|…)(?=\s|$)/g) || []).length;
  const wpm = durationSec && durationSec > 0 ? Math.round((words / durationSec) * 60) : null; return { words, wpm, fillers };
}
/** معرّف مصحّح مقنَّع للوحات المجمَّعة (لا اسم ولا بريد ولا ترتيب تنافسي) */
export const maskRater = (id: string): string => `مصحّح ${createHash('sha256').update(`m4c:${id}`).digest('hex').slice(0, 4).toUpperCase()}`;
