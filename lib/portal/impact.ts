// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — تقارير الأثر القطاعية (P8-ج): تجميع مؤشرات RPC portal_impact_report، المقارنات، النص التنفيذي، Excel
import type { Lang, T } from './content';
import { t } from './content';

// ---------- أنواع تقرير RPC ----------
export type MeanN = { n: number; mean: number | null };
export type PrePost = { pre_n: number; pre: number | null; post_n: number; post: number | null };
export type Attendance = { sessions: number; present: number };
export type ImpactProgram = {
  id: string; name_ar: string; name_en?: string | null; sector?: string | null; program_type?: string | null; hours?: number | null; cefr_level?: string | null;
  start_date?: string | null; end_date?: string | null; delivery_mode?: string | null;
  learners: number; pending: number; orgs: number; credentials: number; skills: string[];
  attendance: Attendance; satisfaction: MeanN; prepost: PrePost; transfer: MeanN & { supervisor?: number | null; trainee?: number | null };
};
export type ImpactOrg = { id: string; name_ar: string; name_en?: string | null; sector?: string | null; city?: string | null; learners: number; enrollments: number; credentials: number; members: number; avg_level: number | null };
export type ImpactSkill = { id: string; code: string; name_ar: string; name_en: string; domain: string; saqf_level?: number | null; cefr_level?: string | null; sdaia_code?: string | null; learners: number; avg_level: number | null; approved: number; proven: number; programs: number };
export type ImpactSector = { code: string; name_ar: string; name_en: string; programs: number; orgs: number; learners: number };
export type ImpactReport = {
  ok: boolean; error?: string; generated_at?: string; from?: string | null; to?: string | null;
  filters?: { sector?: string | null; skill?: string | null; org?: string | null };
  scope?: { programs: number; learners: number; skills: number };
  programs: ImpactProgram[]; orgs: ImpactOrg[]; skills: ImpactSkill[]; sectors: ImpactSector[];
  placements: Record<string, number>; credentials: { total: number; by_kind: Record<string, number> }; events: { total: number; downloads: number; sessions: number; assessed: number; completed: number };
};
export type ImpactFilters = { from: string; to: string; sector: string; skill: string; org: string };

export const EMPTY_REPORT: ImpactReport = { ok: true, programs: [], orgs: [], skills: [], sectors: [], placements: {}, credentials: { total: 0, by_kind: {} }, events: { total: 0, downloads: 0, sessions: 0, assessed: 0, completed: 0 } };

// ---------- أدوات حسابية نقية ----------
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const round1 = (n: number) => Math.round(n * 10) / 10;
/** متوسط مرجّح بعدد الاستجابات؛ null إن لم توجد بيانات */
export function wmean(items: { mean: number | null | undefined; n: number | null | undefined }[]): number | null {
  let s = 0, w = 0; for (const it of items) { const n = num(it.n); if (it.mean === null || it.mean === undefined || !Number.isFinite(Number(it.mean)) || n <= 0) continue; s += Number(it.mean) * n; w += n; }
  return w ? Math.round((s / w) * 100) / 100 : null;
}
/** نسبة التحسّن القبلي/البعدي (%)؛ null إن غابت إحدى المرحلتين أو كانت القبلية صفرًا */
export function improvementPct(pre: number | null | undefined, post: number | null | undefined): number | null {
  if (pre === null || pre === undefined || post === null || post === undefined) return null; const a = Number(pre), b = Number(post);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return null; return round1(((b - a) / a) * 100);
}
export function pct(part: number, whole: number): number | null { return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null; }
/** الرضا من مقياس 1–5 إلى نسبة مئوية */
export function satisfactionPct(mean: number | null): number | null { return mean === null ? null : Math.round(((mean - 1) / 4) * 1000) / 10; }

// ---------- الملخص التنفيذي ----------
export type ImpactTotals = {
  programs: number; learners: number; pending: number; orgs: number; hours: number; credentials: number; skillsProven: number; skillsApproved: number;
  attendance: { sessions: number; present: number; expected: number; rate: number | null };
  satisfaction: { mean: number | null; n: number; pct: number | null };
  prepost: { pre: number | null; post: number | null; pre_n: number; post_n: number; improvement: number | null };
  transfer: { mean: number | null; n: number };
  placements: { total: number; levels: { level: string; n: number }[] };
  events: ImpactReport['events'];
};
export function totals(r: ImpactReport): ImpactTotals {
  const ps = r.programs || []; const learners = r.scope?.learners ?? ps.reduce((a, p) => a + num(p.learners), 0);
  const hours = ps.reduce((a, p) => a + num(p.hours) * num(p.learners), 0);
  const sessions = ps.reduce((a, p) => a + num(p.attendance?.sessions), 0); const present = ps.reduce((a, p) => a + num(p.attendance?.present), 0);
  const expected = ps.reduce((a, p) => a + num(p.attendance?.sessions) * num(p.learners), 0);
  const satMean = wmean(ps.map(p => p.satisfaction || { n: 0, mean: null })); const satN = ps.reduce((a, p) => a + num(p.satisfaction?.n), 0);
  const pre = wmean(ps.map(p => ({ mean: p.prepost?.pre, n: p.prepost?.pre_n }))); const post = wmean(ps.map(p => ({ mean: p.prepost?.post, n: p.prepost?.post_n })));
  const trMean = wmean(ps.map(p => p.transfer || { n: 0, mean: null })); const trN = ps.reduce((a, p) => a + num(p.transfer?.n), 0);
  const levels = Object.entries(r.placements || {}).map(([level, n]) => ({ level, n: num(n) })).sort((a, b) => a.level.localeCompare(b.level));
  return {
    programs: ps.length, learners, pending: ps.reduce((a, p) => a + num(p.pending), 0), orgs: (r.orgs || []).length, hours, credentials: num(r.credentials?.total),
    skillsProven: (r.skills || []).reduce((a, s) => a + num(s.proven), 0), skillsApproved: (r.skills || []).reduce((a, s) => a + num(s.approved), 0),
    attendance: { sessions, present, expected, rate: expected ? Math.min(100, pct(present, expected) || 0) : null },
    satisfaction: { mean: satMean, n: satN, pct: satisfactionPct(satMean) },
    prepost: { pre, post, pre_n: ps.reduce((a, p) => a + num(p.prepost?.pre_n), 0), post_n: ps.reduce((a, p) => a + num(p.prepost?.post_n), 0), improvement: improvementPct(pre, post) },
    transfer: { mean: trMean, n: trN },
    placements: { total: levels.reduce((a, x) => a + x.n, 0), levels },
    events: r.events || EMPTY_REPORT.events,
  };
}

/** صفوف البرامج مع المؤشرات المشتقة (نسبة الحضور، التحسّن…) — مرتبة بعدد المتعلمين */
export type ProgramRow = ImpactProgram & { attendanceRate: number | null; improvement: number | null; satisfactionPct: number | null; hoursDelivered: number };
export function programRows(r: ImpactReport): ProgramRow[] {
  return (r.programs || []).map(p => ({
    ...p, hoursDelivered: num(p.hours) * num(p.learners),
    attendanceRate: num(p.attendance?.sessions) * num(p.learners) ? Math.min(100, pct(num(p.attendance?.present), num(p.attendance?.sessions) * num(p.learners)) || 0) : null,
    improvement: improvementPct(p.prepost?.pre, p.prepost?.post), satisfactionPct: satisfactionPct(p.satisfaction?.mean ?? null),
  })).sort((a, b) => b.learners - a.learners || a.name_ar.localeCompare(b.name_ar));
}
/** مقارنة الجهات: ترتيب بعدد المتعلمين ثم متوسط المستوى */
export function orgRows(r: ImpactReport): (ImpactOrg & { credPerLearner: number | null })[] {
  return (r.orgs || []).map(o => ({ ...o, credPerLearner: o.learners ? Math.round((num(o.credentials) / o.learners) * 100) / 100 : null })).sort((a, b) => b.learners - a.learners || num(b.avg_level) - num(a.avg_level));
}
export function skillRows(r: ImpactReport): (ImpactSkill & { provenPct: number | null })[] {
  return (r.skills || []).map(s => ({ ...s, provenPct: pct(num(s.proven), num(s.learners)) })).sort((a, b) => b.learners - a.learners || a.code.localeCompare(b.code));
}
export function sectorRows(r: ImpactReport): ImpactSector[] { return [...(r.sectors || [])].filter(s => s.programs || s.learners || s.orgs).sort((a, b) => b.learners - a.learners || b.programs - a.programs); }

// ---------- الفترات الجاهزة ----------
export function periodPresets(today = new Date()): { key: string; label: T; from: string; to: string }[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10); const y = today.getUTCFullYear(); const m = today.getUTCMonth();
  const qStart = new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)); const d90 = new Date(today.getTime() - 89 * 86400000); const yStart = new Date(Date.UTC(y, 0, 1));
  return [
    { key: 'q', label: { ar: 'هذا الربع', en: 'This quarter' }, from: iso(qStart), to: iso(today) },
    { key: '90', label: { ar: 'آخر 90 يومًا', en: 'Last 90 days' }, from: iso(d90), to: iso(today) },
    { key: 'y', label: { ar: 'هذه السنة', en: 'This year' }, from: iso(yStart), to: iso(today) },
    { key: 'all', label: { ar: 'كل الفترات', en: 'All time' }, from: '', to: '' },
  ];
}
export function validateFilters(f: ImpactFilters): string | null {
  const ok = (s: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!ok(f.from) || !ok(f.to)) return 'صيغة التاريخ يجب أن تكون YYYY-MM-DD';
  if (f.from && f.to && f.from > f.to) return 'تاريخ البداية بعد تاريخ النهاية';
  return null;
}
export function rpcParams(f: ImpactFilters) { return { p_from: f.from || null, p_to: f.to || null, p_sector: f.sector || null, p_skill: f.skill || null, p_org: f.org || null }; }

// ---------- السرد التنفيذي (عربي/إنجليزي) ----------
const fmtN = (n: number, lang: Lang) => n.toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US');
export function narrative(tt: ImpactTotals, lang: Lang, scopeLabel: string): string[] {
  const ar = lang === 'ar'; const out: string[] = [];
  out.push(ar ? `خلال ${scopeLabel}، استفاد ${fmtN(tt.learners, lang)} متعلمًا من ${fmtN(tt.programs, lang)} برنامجًا${tt.orgs ? ` عبر ${fmtN(tt.orgs, lang)} جهة` : ''}، بإجمالي ${fmtN(tt.hours, lang)} ساعة تدريبية مقدَّمة.`
    : `During ${scopeLabel}, ${fmtN(tt.learners, lang)} learners benefited from ${fmtN(tt.programs, lang)} programs${tt.orgs ? ` across ${fmtN(tt.orgs, lang)} organizations` : ''}, totalling ${fmtN(tt.hours, lang)} delivered training hours.`);
  if (tt.attendance.rate !== null) out.push(ar ? `بلغت نسبة الحضور ${tt.attendance.rate}% (${fmtN(tt.attendance.present, lang)} حضورًا من ${fmtN(tt.attendance.expected, lang)} متوقعًا في ${fmtN(tt.attendance.sessions, lang)} جلسة).` : `Attendance reached ${tt.attendance.rate}% (${fmtN(tt.attendance.present, lang)} of ${fmtN(tt.attendance.expected, lang)} expected across ${fmtN(tt.attendance.sessions, lang)} sessions).`);
  if (tt.satisfaction.mean !== null) out.push(ar ? `متوسط الرضا ${tt.satisfaction.mean} من 5 (${tt.satisfaction.pct}%) من ${fmtN(tt.satisfaction.n, lang)} استبانة.` : `Average satisfaction ${tt.satisfaction.mean}/5 (${tt.satisfaction.pct}%) from ${fmtN(tt.satisfaction.n, lang)} evaluations.`);
  if (tt.prepost.improvement !== null) out.push(ar ? `القياس القبلي ${tt.prepost.pre} ← البعدي ${tt.prepost.post} (تحسّن ${tt.prepost.improvement > 0 ? '+' : ''}${tt.prepost.improvement}%).` : `Pre ${tt.prepost.pre} → post ${tt.prepost.post} (${tt.prepost.improvement > 0 ? '+' : ''}${tt.prepost.improvement}% improvement).`);
  if (tt.transfer.mean !== null) out.push(ar ? `نقل الأثر إلى العمل: ${tt.transfer.mean}% متوسط التطبيق وفق ${fmtN(tt.transfer.n, lang)} استجابة من المشرفين والمتدربين.` : `Transfer to work: ${tt.transfer.mean}% average application across ${fmtN(tt.transfer.n, lang)} supervisor/trainee responses.`);
  if (tt.skillsProven || tt.credentials) out.push(ar ? `أُثبتت ${fmtN(tt.skillsProven, lang)} مهارة بأدلة كافية (منها ${fmtN(tt.skillsApproved, lang)} معتمدة)، وصدرت ${fmtN(tt.credentials, lang)} شهادة رقمية قابلة للتحقق.` : `${fmtN(tt.skillsProven, lang)} skills were proven with sufficient evidence (${fmtN(tt.skillsApproved, lang)} approved) and ${fmtN(tt.credentials, lang)} verifiable digital credentials were issued.`);
  if (tt.placements.total) out.push(ar ? `مستويات مِعيار للمتعلمين: ${tt.placements.levels.map(l => `${l.level} (${l.n})`).join('، ')}.` : `Mi‘yar levels: ${tt.placements.levels.map(l => `${l.level} (${l.n})`).join(', ')}.`);
  if (out.length === 1 && tt.learners === 0) out.push(ar ? 'لا توجد بيانات كافية في هذا النطاق بعد — وسّع الفترة أو أزل المرشحات.' : 'Not enough data in this scope yet — widen the period or clear filters.');
  return out;
}
export function scopeLabel(f: ImpactFilters, names: { sector?: string; skill?: string; org?: string }, lang: Lang): string {
  const ar = lang === 'ar'; const parts: string[] = [];
  parts.push(f.from || f.to ? `${ar ? 'الفترة' : 'period'} ${f.from || '…'} → ${f.to || '…'}` : (ar ? 'كل الفترات' : 'all time'));
  if (names.sector) parts.push(`${ar ? 'قطاع' : 'sector'}: ${names.sector}`); if (names.skill) parts.push(`${ar ? 'مهارة' : 'skill'}: ${names.skill}`); if (names.org) parts.push(`${ar ? 'جهة' : 'org'}: ${names.org}`);
  return parts.join(' · ');
}

// ---------- Excel ----------
type Cell = string | number | boolean | null | undefined;
type Sheet = { name: string; rows: Cell[][]; widths?: number[]; rtl?: boolean };
const v = (x: number | null | undefined): Cell => (x === null || x === undefined ? '' : x);
export function impactSheets(r: ImpactReport, f: ImpactFilters, names: { sector?: string; skill?: string; org?: string }): Sheet[] {
  const tt = totals(r);
  const summary: Sheet = { name: 'الملخص', rtl: true, widths: [34, 20], rows: [
    ['تقرير الأثر القطاعي — أَثَر', ''], ['النطاق', scopeLabel(f, names, 'ar')], ['تاريخ الإنشاء', (r.generated_at || new Date().toISOString()).slice(0, 10)], ['', ''],
    ['البرامج', tt.programs], ['المتعلمون', tt.learners], ['طلبات قيد المراجعة', tt.pending], ['الجهات', tt.orgs], ['الساعات التدريبية المقدَّمة', tt.hours],
    ['نسبة الحضور %', v(tt.attendance.rate)], ['الرضا (من 5)', v(tt.satisfaction.mean)], ['عدد استبانات الرضا', tt.satisfaction.n],
    ['القياس القبلي', v(tt.prepost.pre)], ['القياس البعدي', v(tt.prepost.post)], ['التحسّن %', v(tt.prepost.improvement)], ['نقل الأثر (تطبيق %)', v(tt.transfer.mean)],
    ['مهارات مُثبتة', tt.skillsProven], ['مهارات معتمدة', tt.skillsApproved], ['شهادات رقمية', tt.credentials], ['اختبارات مِعيار', tt.placements.total], ['أحداث تعلّم', tt.events.total],
    ...narrative(tt, 'ar', scopeLabel(f, names, 'ar')).map((s, i) => [i === 0 ? 'الخلاصة' : '', s] as Cell[]),
  ] };
  const programs: Sheet = { name: 'البرامج', rtl: true, widths: [40, 14, 10, 10, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10], rows: [
    ['البرنامج', 'القطاع', 'النوع', 'المستوى', 'الساعات', 'المتعلمون', 'قيد المراجعة', 'الجهات', 'الحضور %', 'الرضا/5', 'قبلي', 'بعدي', 'تحسّن %', 'نقل الأثر %', 'شهادات'],
    ...programRows(r).map(p => [p.name_ar, p.sector || '', p.program_type || '', p.cefr_level || '', v(p.hours), p.learners, p.pending, p.orgs, v(p.attendanceRate), v(p.satisfaction?.mean), v(p.prepost?.pre), v(p.prepost?.post), v(p.improvement), v(p.transfer?.mean), p.credentials] as Cell[]),
  ] };
  const orgs: Sheet = { name: 'مقارنة الجهات', rtl: true, widths: [36, 14, 14, 10, 10, 10, 10, 12], rows: [
    ['الجهة', 'القطاع', 'المدينة', 'المنسوبون', 'المتعلمون', 'التسجيلات', 'الشهادات', 'متوسط المستوى /5'],
    ...orgRows(r).map(o => [o.name_ar, o.sector || '', o.city || '', o.members, o.learners, o.enrollments, o.credentials, v(o.avg_level)] as Cell[]),
  ] };
  const skills: Sheet = { name: 'المهارات', rtl: true, widths: [14, 36, 14, 8, 8, 10, 10, 10, 12, 10], rows: [
    ['الرمز', 'المهارة', 'المجال', 'SAQF', 'CEFR', 'المتعلمون', 'مُثبتة', 'معتمدة', 'متوسط المستوى', 'البرامج'],
    ...skillRows(r).map(s => [s.code, s.name_ar, s.domain, v(s.saqf_level), s.cefr_level || '', s.learners, s.proven, s.approved, v(s.avg_level), s.programs] as Cell[]),
  ] };
  const sectors: Sheet = { name: 'القطاعات', rtl: true, widths: [30, 10, 10, 10], rows: [['القطاع', 'البرامج', 'الجهات', 'المتعلمون'], ...sectorRows(r).map(s => [s.name_ar, s.programs, s.orgs, s.learners] as Cell[])] };
  return [summary, programs, orgs, skills, sectors];
}

export const KPI_LABEL: Record<string, T> = {
  learners: { ar: 'متعلمون', en: 'Learners' }, programs: { ar: 'برامج', en: 'Programs' }, orgs: { ar: 'جهات', en: 'Organizations' }, hours: { ar: 'ساعة تدريبية', en: 'Training hours' },
  attendance: { ar: 'نسبة الحضور', en: 'Attendance' }, satisfaction: { ar: 'الرضا', en: 'Satisfaction' }, improvement: { ar: 'التحسّن القبلي/البعدي', en: 'Pre/post gain' }, transfer: { ar: 'نقل الأثر', en: 'Transfer' },
  proven: { ar: 'مهارات مُثبتة', en: 'Skills proven' }, credentials: { ar: 'شهادات رقمية', en: 'Credentials' }, placements: { ar: 'اختبارات مِعيار', en: 'Mi‘yar tests' }, events: { ar: 'أحداث تعلّم', en: 'Learning events' },
};
export const kpiLabel = (k: string, lang: Lang) => t(KPI_LABEL[k] || { ar: k, en: k }, lang);
