// النسخ الاحتياطي الشامل والأرشفة — دوال نقية (بلا React / بلا Supabase)
import type { Sheet, Cell } from '../export/xlsx';

export type Row = Record<string, any>;
export type Dataset = Record<string, Row[]>;

/** كتالوج الجداول: الاسم، التسمية، كيف يُقيَّد بالبرنامج، والأعمدة المفضلة في Excel */
export type TableSpec = {
  table: string;
  label: string;
  /** عمود البرنامج المباشر، أو via:classroom للجداول المرتبطة بالقاعة، أو null للجداول العامة */
  programKey: string | 'via:classroom' | 'via:evaluation' | 'via:template' | null;
  /** أعمدة تُستبعد من Excel (تقنية/حساسة) */
  hide?: string[];
  order?: string;
  /** مفتاح التعارض عند الاستعادة (upsert) — الافتراضي id */
  conflict?: string;
};

export const CATALOG: TableSpec[] = [
  { table: 'programs', label: 'البرامج', programKey: 'id', order: 'name_ar' },
  { table: 'trainers', label: 'المدربون', programKey: null, order: 'name' },
  { table: 'classrooms', label: 'القاعات', programKey: 'program_id', order: 'code' },
  { table: 'class_schedules', label: 'الجداول', programKey: 'via:classroom' },
  { table: 'evaluation_templates', label: 'قوالب التقييم', programKey: null },
  { table: 'questions', label: 'الأسئلة', programKey: null, order: 'order_index' },
  { table: 'program_levels', label: 'مستويات البرامج', programKey: 'program_id', order: 'sort_order' },
  { table: 'program_approvals', label: 'اعتمادات البرامج', programKey: 'program_id' },
  { table: 'program_managers', label: 'مديرو البرامج', programKey: 'program_id', conflict: 'profile_id,program_id' },
  { table: 'program_evaluation_templates', label: 'ربط القوالب', programKey: 'program_id', conflict: 'program_id,template_id' },
  { table: 'evaluations', label: 'التقييمات', programKey: 'program_id', hide: ['respondent_hash'], order: 'submitted_at' },
  { table: 'evaluation_answers', label: 'إجابات التقييم', programKey: 'via:evaluation' },
  { table: 'attendance_sessions', label: 'جلسات الحضور', programKey: 'program_id', hide: ['token'] },
  { table: 'attendance_records', label: 'سجلات الحضور', programKey: 'via:session' as any, hide: ['identity_key'] },
  { table: 'certificates', label: 'الشهادات', programKey: 'program_id' },
  { table: 'impact_assessments', label: 'أدوات الأثر', programKey: 'program_id', hide: ['token'] },
  { table: 'impact_questions', label: 'أسئلة الأثر', programKey: 'via:assessment' as any, order: 'order_index' },
  { table: 'impact_responses', label: 'استجابات الأثر', programKey: 'via:assessment' as any },
  { table: 'behavior_followups', label: 'متابعات نقل الأثر', programKey: 'program_id', hide: ['token'] },
  { table: 'behavior_questions', label: 'أسئلة المتابعة', programKey: 'via:followup' as any, order: 'order_index' },
  { table: 'behavior_responses', label: 'استجابات المتابعة', programKey: 'via:followup' as any },
  { table: 'outcome_kpis', label: 'مؤشرات النتائج', programKey: 'program_id' },
  { table: 'outcome_measurements', label: 'قياسات المؤشرات', programKey: 'via:kpi' as any },
  { table: 'remote_learning_survey_responses', label: 'استطلاع التعلم عن بُعد', programKey: 'program_id' },
  { table: 'trainer_awards', label: 'تكريم المدربين', programKey: null },
  { table: 'report_subscriptions', label: 'اشتراكات التقارير', programKey: null },
  { table: 'certificate_settings', label: 'إعدادات الشهادات', programKey: null, conflict: 'organization_id' },
];

/** جداول لا تُقيَّد ببرنامج وتُستبعد من نسخة البرنامج الواحد */
const GLOBAL_ONLY = new Set(['trainer_awards', 'report_subscriptions', 'certificate_settings']);

export const ALWAYS_HIDE = ['organization_id'];

export function tableLabel(table: string): string {
  return CATALOG.find(t => t.table === table)?.label || table;
}

/** تقييد مجموعة البيانات ببرنامج واحد (يُطبَّق بعد التحميل لضمان الاتساق بين الجداول) */
export function scopeToProgram(data: Dataset, programId: string): Dataset {
  const out: Dataset = {};
  const classroomIds = new Set((data.classrooms || []).filter(r => r.program_id === programId).map(r => r.id));
  const evalIds = new Set((data.evaluations || []).filter(r => r.program_id === programId).map(r => r.id));
  const sessionIds = new Set((data.attendance_sessions || []).filter(r => r.program_id === programId).map(r => r.id));
  const kpiIds = new Set((data.outcome_kpis || []).filter(r => r.program_id === programId).map(r => r.id));
  const impactIds = new Set((data.impact_assessments || []).filter(r => r.program_id === programId).map(r => r.id));
  const followupIds = new Set((data.behavior_followups || []).filter(r => r.program_id === programId).map(r => r.id));
  const tplIds = new Set((data.program_evaluation_templates || []).filter(r => r.program_id === programId).map(r => r.template_id));
  for (const spec of CATALOG) {
    const rows = data[spec.table] || [];
    if (spec.table === 'programs') out[spec.table] = rows.filter(r => r.id === programId);
    else if (spec.table === 'evaluation_templates') out[spec.table] = rows.filter(r => tplIds.has(r.id));
    else if (spec.table === 'questions') out[spec.table] = rows.filter(r => tplIds.has(r.template_id));
    else if (spec.table === 'trainers') { const tids = new Set((data.classrooms || []).filter(r => r.program_id === programId).map(r => r.trainer_id)); out[spec.table] = rows.filter(r => tids.has(r.id)); }
    else if (spec.programKey === 'via:classroom') out[spec.table] = rows.filter(r => classroomIds.has(r.classroom_id));
    else if (spec.programKey === 'via:evaluation') out[spec.table] = rows.filter(r => evalIds.has(r.evaluation_id));
    else if ((spec.programKey as string) === 'via:session') out[spec.table] = rows.filter(r => sessionIds.has(r.session_id));
    else if ((spec.programKey as string) === 'via:kpi') out[spec.table] = rows.filter(r => kpiIds.has(r.kpi_id));
    else if ((spec.programKey as string) === 'via:assessment') out[spec.table] = rows.filter(r => impactIds.has(r.assessment_id));
    else if ((spec.programKey as string) === 'via:followup') out[spec.table] = rows.filter(r => followupIds.has(r.followup_id));
    else if (spec.programKey === null) out[spec.table] = GLOBAL_ONLY.has(spec.table) ? [] : rows;
    else out[spec.table] = rows.filter(r => r[spec.programKey as string] === programId);
  }
  return out;
}

export function counts(data: Dataset): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of CATALOG) out[spec.table] = (data[spec.table] || []).length;
  return out;
}

export function totalRows(data: Dataset): number {
  return Object.values(counts(data)).reduce((a, b) => a + b, 0);
}

function cellOf(v: any): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** أعمدة الجدول: اتحاد مفاتيح الصفوف بترتيب الظهور، مع استبعاد المخفية */
export function columnsOf(rows: Row[], hide: string[] = []): string[] {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k) && !hide.includes(k) && !ALWAYS_HIDE.includes(k)) cols.push(k);
  // المعرّفات أولًا ثم الباقي
  return [...cols.filter(c => c === 'id'), ...cols.filter(c => c !== 'id')];
}

export function sheetFor(spec: TableSpec, rows: Row[]): Sheet {
  const cols = columnsOf(rows, spec.hide || []);
  const body = rows.map(r => cols.map(c => cellOf(r[c])));
  return { name: spec.label, rows: [cols, ...body], widths: cols.map(c => Math.min(40, Math.max(10, c.length + 4))), rtl: true };
}

/** ورقة «الإجابات المفكوكة»: صف لكل تقييم وعمود لكل سؤال — جاهزة للتحليل في Excel */
export function wideAnswers(data: Dataset): Sheet {
  const tplOrder = new Map((data.evaluation_templates || []).map((t, i) => [t.id, i]));
  const qs = [...(data.questions || [])].sort((a, b) => ((tplOrder.get(a.template_id) ?? 999) - (tplOrder.get(b.template_id) ?? 999)) || ((a.order_index || 0) - (b.order_index || 0)));
  const progName = new Map((data.programs || []).map(p => [p.id, p.name_ar]));
  const roomCode = new Map((data.classrooms || []).map(c => [c.id, c.code]));
  const byEval = new Map<string, Row[]>();
  for (const a of data.evaluation_answers || []) { const arr = byEval.get(a.evaluation_id) || []; arr.push(a); byEval.set(a.evaluation_id, arr); }
  const usedQ = qs.filter(q => (data.evaluation_answers || []).some(a => a.question_id === q.id));
  const head = ['التقييم', 'البرنامج', 'القاعة', 'النوع', 'التاريخ', 'المتوسط', ...usedQ.map(q => q.text_ar || q.id)];
  const rows: Cell[][] = (data.evaluations || []).map(e => {
    const answers = byEval.get(e.id) || [];
    const vals = usedQ.map(q => {
      const a = answers.find(x => x.question_id === q.id); if (!a) return null;
      if (a.rating_value !== null && a.rating_value !== undefined) return Number(a.rating_value);
      if (a.selected_option) return String(a.selected_option);
      if (Array.isArray(a.selected_options) && a.selected_options.length) return a.selected_options.join(' | ');
      return a.text_value ? String(a.text_value) : null;
    });
    return [e.id, progName.get(e.program_id) || e.program_id, roomCode.get(e.classroom_id) || '', e.kind || '', String(e.evaluation_date || e.submitted_at || '').slice(0, 10), e.overall_rating != null ? Number(e.overall_rating) : null, ...vals];
  });
  return { name: 'الإجابات المفكوكة', rows: [head, ...rows], widths: head.map((h, i) => (i < 6 ? 14 : Math.min(40, Math.max(12, String(h).length)))), rtl: true };
}

export type Manifest = { generated_at: string; scope: string; scope_label: string; app: string; tables: Record<string, number>; total_rows: number; notes: string[] };

export function manifest(data: Dataset, scope: string, scopeLabel: string, now = new Date()): Manifest {
  return {
    generated_at: now.toISOString(), scope, scope_label: scopeLabel, app: 'training-evaluation-platform',
    tables: counts(data), total_rows: totalRows(data),
    notes: ['الأعمدة الحساسة (respondent_hash, token, identity_key) غير مضمّنة في Excel ومضمّنة في JSON.', 'الاستعادة: استخدم JSON مع Supabase (Table Editor → Import) أو اطلب سكربت استعادة.'],
  };
}

export function manifestSheet(m: Manifest): Sheet {
  const rows: Cell[][] = [['البند', 'القيمة'], ['تاريخ الإنشاء', m.generated_at], ['النطاق', m.scope_label], ['إجمالي الصفوف', m.total_rows], [null, null], ['الجدول', 'عدد الصفوف'],
    ...Object.entries(m.tables).map(([t, n]) => [tableLabel(t), n] as Cell[])];
  return { name: 'الفهرس', rows, widths: [28, 24], rtl: true };
}

/** كل أوراق Excel: الفهرس، الإجابات المفكوكة، ثم جدول لكل جدول غير فارغ */
export function buildSheets(data: Dataset, m: Manifest): Sheet[] {
  const sheets: Sheet[] = [manifestSheet(m)];
  if ((data.evaluations || []).length) sheets.push(wideAnswers(data));
  for (const spec of CATALOG) { const rows = data[spec.table] || []; if (rows.length) sheets.push(sheetFor(spec, rows)); }
  return sheets;
}

export function jsonPayload(data: Dataset, m: Manifest): string {
  return JSON.stringify({ manifest: m, data }, null, 1);
}

export function backupFilename(scopeLabel: string, ext: 'xlsx' | 'json', now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  const slug = scopeLabel === 'all' ? 'full' : scopeLabel.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'program';
  return `backup_${slug}_${d}.${ext}`;
}

// ---------- حالة النسخ ----------
export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null; const t = new Date(iso).getTime(); if (!isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86400000);
}

export type BackupStatus = { status: 'ok' | 'warn' | 'none'; label: string; days: number | null };

export function backupStatus(lastIso: string | null | undefined, hasData: boolean, now = new Date(), maxDays = 30): BackupStatus {
  const days = daysSince(lastIso, now);
  if (days === null) return { status: hasData ? 'warn' : 'none', label: hasData ? 'لم تُؤخذ نسخة احتياطية بعد' : 'لا توجد بيانات تُذكر بعد', days };
  if (days > maxDays) return { status: 'warn', label: `آخر نسخة منذ ${days} يومًا — يُنصح بنسخة شهرية`, days };
  return { status: 'ok', label: days === 0 ? 'آخر نسخة اليوم' : `آخر نسخة منذ ${days} يومًا`, days };
}

// ---------- الأرشفة ----------
export type ArchivableProgram = { id: string; name_ar: string; status?: string | null; end_date?: string | null; archived_at?: string | null };

/** مرشحون للأرشفة: منتهون منذ أكثر من 90 يومًا أو حالتهم مكتملة، وغير مؤرشفين */
export function archiveCandidates(programs: ArchivableProgram[], today = new Date().toISOString().slice(0, 10)): ArchivableProgram[] {
  const cutoff = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) - 90 * 86400000).toISOString().slice(0, 10);
  return programs.filter(p => !p.archived_at && (String(p.status || '').toUpperCase() === 'COMPLETED' || (!!p.end_date && p.end_date < cutoff)));
}

export function splitArchive(programs: ArchivableProgram[]): { active: ArchivableProgram[]; archived: ArchivableProgram[] } {
  return { active: programs.filter(p => !p.archived_at), archived: programs.filter(p => !!p.archived_at) };
}
