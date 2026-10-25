// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — تكامل مِعيار: تحويل تقرير مِعيار إلى نتيجة موحّدة، المستويات، التوصية بالبرامج، Excel
import type { Lang, T } from './content';
import { t } from './content';

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const CEFR_LEVELS: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export type MiaarSkill = 'grammar_vocab' | 'reading' | 'listening';
export const MIAAR_SKILLS: { key: MiaarSkill; label: T; athar: string }[] = [
  { key: 'listening', label: { ar: 'الاستماع', en: 'Listening' }, athar: 'ATH-AR-004' },
  { key: 'reading', label: { ar: 'القراءة', en: 'Reading' }, athar: 'ATH-AR-005' },
  { key: 'grammar_vocab', label: { ar: 'القواعد والمفردات', en: 'Grammar & vocabulary' }, athar: 'ATH-AR-006' },
];
export type SkillStat = { correct: number; answered: number; total: number; percent: number; level: string };
export type Placement = {
  id: string; source: string; external_id: string; submission_id?: string | null; test_version?: string | null;
  email: string; full_name?: string | null; phone?: string | null; native_language?: string | null; purpose?: string | null;
  demonstrated_level?: Cefr | null; entry_level?: Cefr | null; overall_percent?: number | null; score_text?: string | null;
  skills: Partial<Record<MiaarSkill, SkillStat>>; levels: { level: string; percent: number; status: string; answered: number; total: number }[];
  finish_reason?: string | null; duration_text?: string | null; recommendation?: string | null; taken_at: string; report?: Record<string, unknown>; user_id?: string | null; imported_at?: string;
};
/** صف placement_reports كما هو في مشروع مِعيار */
export type MiaarReportRow = { id: string; submission_id?: string | null; test_version?: string | null; candidate_email?: string | null; created_at?: string | null; report: Record<string, any> };

export const LEVEL_LABEL: Record<Cefr, T> = {
  A1: { ar: 'مبتدئ', en: 'Beginner' }, A2: { ar: 'أساسي', en: 'Elementary' }, B1: { ar: 'متوسط', en: 'Intermediate' },
  B2: { ar: 'فوق المتوسط', en: 'Upper-intermediate' }, C1: { ar: 'متقدم', en: 'Advanced' }, C2: { ar: 'إتقان', en: 'Proficient' },
};
export const isCefr = (v: unknown): v is Cefr => typeof v === 'string' && (CEFR_LEVELS as string[]).includes(v);
export const levelRank = (v: string | null | undefined): number => isCefr(v) ? CEFR_LEVELS.indexOf(v) : -1;
export function levelLabel(v: string | null | undefined, lang: Lang): string { return isCefr(v) ? `${v} · ${t(LEVEL_LABEL[v], lang)}` : (v || '—'); }
export function levelTone(v: string | null | undefined): string { const r = levelRank(v); return r < 0 ? 'none' : r <= 1 ? 'a' : r <= 3 ? 'b' : 'c'; }
export const miaarSkillLabel = (k: string, lang: Lang) => { const x = MIAAR_SKILLS.find(s => s.key === k); return x ? t(x.label, lang) : k; };

/** تحويل تقرير مِعيار (مفاتيح عربية) إلى صف portal_placements */
export function parseMiaarReport(row: MiaarReportRow): Omit<Placement, 'id'> {
  const r = row.report || {}; const cand = (r['بيانات_المتقدم'] || {}) as Record<string, any>; const stats = (r['احصائيات'] || {}) as Record<string, any>; const sum = (r['ملخص_التسكين'] || {}) as Record<string, any>;
  const clean = (v: unknown) => { const s = typeof v === 'string' ? v.trim() : ''; return s && s !== '—' ? s : null; };
  const lvl = (v: unknown): Cefr | null => isCefr(v) ? v : null;
  const skills: Partial<Record<MiaarSkill, SkillStat>> = {};
  for (const k of ['grammar_vocab', 'reading', 'listening'] as MiaarSkill[]) { const s = stats[k]; if (s && typeof s === 'object') skills[k] = { correct: Number(s.correct || 0), answered: Number(s.answered || 0), total: Number(s.total || 0), percent: Number(s.percent || 0), level: String(s.level || '—') }; }
  const levels = Array.isArray(r['مستويات_تفصيلية']) ? (r['مستويات_تفصيلية'] as any[]).map(x => ({ level: String(x.level), percent: Number(x.percent || 0), status: String(x.status || ''), answered: Number(x.answered || 0), total: Number(x.total || 0) })) : [];
  const email = String(row.candidate_email || cand['البريد_الإلكتروني'] || '').trim().toLowerCase();
  const taken = clean(r['تاريخ']) || row.created_at || new Date().toISOString();
  return {
    source: 'miaar', external_id: String(row.id), submission_id: row.submission_id || null, test_version: row.test_version || clean(r['إصدار_البنك']),
    email, full_name: clean(cand['الاسم']), phone: clean(cand['الهاتف']), native_language: clean(cand['اللغة_الأم']), purpose: clean(cand['الغرض_من_الاختبار']),
    demonstrated_level: lvl(sum['المستوى_المثبت']) || lvl(r['المستوى_العام']), entry_level: lvl(sum['مستوى_الالتحاق_المقترح']) || lvl(r['المستوى_العام']),
    overall_percent: Number.isFinite(Number(r['النسبة_العامة'])) ? Math.round(Number(r['النسبة_العامة'])) : null, score_text: clean(r['الدرجة_الموضوعية']),
    skills, levels, finish_reason: clean(r['سبب_الانتهاء']), duration_text: clean(r['الوقت_المستغرق']), recommendation: clean(r['التوصية']),
    taken_at: new Date(taken).toISOString(), report: r, user_id: null,
  };
}
export function placementValid(p: Pick<Placement, 'email' | 'external_id'>): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) && !!p.external_id; }

/** مهارات أَثَر التي يثبتها التقرير (لحدث assessed) */
export function evidenceSkills(p: Pick<Placement, 'skills'>, codeToId: Map<string, string>): string[] {
  return MIAAR_SKILLS.filter(s => p.skills[s.key] && (p.skills[s.key]!.answered || 0) > 0).map(s => codeToId.get(s.athar)).filter(Boolean) as string[];
}

/** مستوى الالتحاق الفعّال */
export function effectiveLevel(p: Pick<Placement, 'entry_level' | 'demonstrated_level'> | null | undefined): Cefr | null { return p ? (p.entry_level || p.demonstrated_level || null) : null; }

/** ملاءمة برنامج لمستوى المتعلم: match | stretch | below | unknown */
export type Fit = 'match' | 'stretch' | 'below' | 'unknown';
export function programFit(programLevel: string | null | undefined, learnerLevel: string | null | undefined): Fit {
  const p = levelRank(programLevel); const l = levelRank(learnerLevel); if (p < 0 || l < 0) return 'unknown';
  if (p === l) return 'match'; if (p === l + 1) return 'stretch'; return p < l ? 'below' : 'unknown';
}
export const FIT_LABEL: Record<Fit, T> = { match: { ar: 'مناسب لمستواك', en: 'Matches your level' }, stretch: { ar: 'خطوة أعلى من مستواك', en: 'One step above your level' }, below: { ar: 'أدنى من مستواك', en: 'Below your level' }, unknown: { ar: '', en: '' } };
export function recommendPrograms<P extends { cefr_level?: string | null }>(programs: P[], learnerLevel: string | null | undefined): P[] {
  return programs.filter(p => programFit(p.cefr_level, learnerLevel) === 'match').concat(programs.filter(p => programFit(p.cefr_level, learnerLevel) === 'stretch'));
}

export function levelDistribution(rows: Pick<Placement, 'entry_level'>[]): { level: Cefr; n: number; pct: number }[] {
  const total = rows.length || 1; return CEFR_LEVELS.map(l => { const n = rows.filter(r => r.entry_level === l).length; return { level: l, n, pct: Math.round(n / total * 100) }; });
}
export function latestByEmail(rows: Placement[]): Map<string, Placement> { const m = new Map<string, Placement>(); for (const r of [...rows].sort((a, b) => b.taken_at.localeCompare(a.taken_at))) if (!m.has(r.email)) m.set(r.email, r); return m; }
export function placementsSheet(rows: Placement[]) {
  const header = ['التاريخ', 'الاسم', 'البريد', 'الهاتف', 'اللغة الأم', 'الغرض', 'المستوى المثبت', 'مستوى الالتحاق', 'النسبة', 'الدرجة', 'الاستماع', 'القراءة', 'القواعد والمفردات', 'سبب الانتهاء', 'الوقت', 'إصدار البنك'];
  const sk = (p: Placement, k: MiaarSkill) => p.skills[k] ? `${p.skills[k]!.level} (${p.skills[k]!.percent}%)` : '';
  return { name: 'نتائج مِعيار', rtl: true, widths: [12, 24, 30, 16, 14, 18, 12, 12, 8, 10, 14, 14, 16, 26, 8, 14], rows: [header, ...rows.map(p => [p.taken_at.slice(0, 10), p.full_name || '', p.email, p.phone || '', p.native_language || '', p.purpose || '', p.demonstrated_level || '', p.entry_level || '', p.overall_percent ?? '', p.score_text || '', sk(p, 'listening'), sk(p, 'reading'), sk(p, 'grammar_vocab'), p.finish_reason || '', p.duration_text || '', p.test_version || ''])] };
}
