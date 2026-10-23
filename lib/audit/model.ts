/**
 * سجلّ التدقيق — نموذج العرض (دوال نقية بلا اعتماديات)
 */
export type AuditRow = {
  id: string; created_at: string;
  actor_id: string | null; actor_email?: string | null; actor_role?: string | null;
  action: string; entity_type: string | null; entity_id?: string | null; entity_label?: string | null;
  before_data?: any; after_data?: any; changes?: Record<string, { from: any; to: any }> | null;
  source?: string | null; metadata?: any;
};

export type Change = { field: string; label: string; from: string; to: string };

export const ENTITY_LABEL: Record<string, string> = {
  programs: 'برنامج', trainers: 'مدرب', classrooms: 'قاعة/شعبة', questions: 'سؤال تقييم', evaluation_templates: 'نموذج تقييم', program_evaluation_templates: 'ربط نموذج ببرنامج',
  profiles: 'مستخدم', certificate_settings: 'إعدادات الشهادات', certificates: 'شهادة', trainer_awards: 'تكريم مدرب', report_subscriptions: 'اشتراك تقرير',
  outcome_kpis: 'مؤشر مؤسسي', outcome_measurements: 'قياس مؤشر', impact_assessments: 'أداة قياس أثر', impact_questions: 'سؤال أثر',
  behavior_followups: 'متابعة سلوكية', behavior_questions: 'سؤال متابعة', attendance_sessions: 'جلسة حضور', program_levels: 'مستوى برنامج', class_schedules: 'جدول حصص',
  evaluations: 'تقييمات', report: 'تقرير', certificate: 'شهادة', ai: 'ذكاء اصطناعي', system: 'النظام',
};

export const ACTION_LABEL: Record<string, string> = {
  INSERT: 'إنشاء', UPDATE: 'تعديل', DELETE: 'حذف',
  PURGE_EVALUATIONS: 'تفريغ تقييمات', report_email: 'إرسال تقرير بالبريد', report_digest: 'التقرير الدوري (كرون)', report_subscribe: 'اشتراك في تقرير', report_unsubscribe: 'إلغاء اشتراك',
  certificate_email: 'إرسال شهادات بالبريد', ai_generate: 'توليد بالذكاء الاصطناعي', exec_summary: 'ملخص تنفيذي ذكي', audit_cleanup: 'تنظيف سجل التدقيق',
};

export const FIELD_LABEL: Record<string, string> = {
  name_ar: 'الاسم (عربي)', name_en: 'الاسم (إنجليزي)', full_name: 'الاسم', name: 'الاسم', email: 'البريد', phone: 'الجوال', role: 'الدور', status: 'الحالة',
  start_date: 'تاريخ البداية', end_date: 'تاريخ النهاية', delivery_mode: 'نمط التنفيذ', approval_status: 'حالة الاعتماد', rejection_reason: 'سبب الرفض',
  code: 'الرمز', capacity: 'السعة', trainer_id: 'المدرب', program_id: 'البرنامج', classroom_id: 'القاعة', organization_id: 'الجهة', is_active: 'نشط', active: 'نشط',
  text_ar: 'النص (عربي)', text_en: 'النص (إنجليزي)', section_ar: 'المحور', kind: 'النوع', sort_order: 'الترتيب', weight: 'الوزن', target: 'المستهدف', baseline: 'خط الأساس',
  direction: 'الاتجاه', unit: 'الوحدة', value: 'القيمة', measured_on: 'تاريخ القياس', note: 'ملاحظة', notes: 'ملاحظات', threshold: 'الحد الأدنى', signer_name: 'اسم الموقّع', signer_title: 'صفة الموقّع',
  sent_at: 'وقت الإرسال', sent_to: 'أُرسل إلى', issued_at: 'تاريخ الإصدار', revoked_at: 'تاريخ الإلغاء', title: 'العنوان', opens_at: 'يفتح في', closes_at: 'يغلق في', mode: 'الوضع',
};

export const SOURCE_LABEL: Record<string, string> = { db: 'تعديل مباشر', app: 'عملية تطبيقية', cron: 'آلي/كرون' };

export const actionLabel = (a: string) => ACTION_LABEL[a] || a;
export const entityLabel = (e: string | null | undefined) => (e ? ENTITY_LABEL[e] || e : '—');
export const fieldLabel = (f: string) => FIELD_LABEL[f] || f;

export function fmtVal(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 77) + '…' : v;
  try { const s = JSON.stringify(v); return s.length > 80 ? s.slice(0, 77) + '…' : s; } catch { return String(v); }
}

/** قائمة التغييرات للعرض (للتعديلات) — أو ملخص للحقول المهمة عند الإنشاء/الحذف */
export function changeList(r: AuditRow, max = 12): Change[] {
  if (r.changes && typeof r.changes === 'object') {
    return Object.entries(r.changes).slice(0, max).map(([field, c]) => ({ field, label: fieldLabel(field), from: fmtVal(c?.from), to: fmtVal(c?.to) }));
  }
  const data = r.action === 'DELETE' ? r.before_data : r.after_data;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data).filter(k => !['id', 'created_at', 'updated_at', 'organization_id', 'created_by'].includes(k) && data[k] !== null && data[k] !== '');
    const important = keys.filter(k => FIELD_LABEL[k]); const rest = keys.filter(k => !FIELD_LABEL[k]);
    return [...important, ...rest].slice(0, max).map(k => ({ field: k, label: fieldLabel(k), from: r.action === 'DELETE' ? fmtVal(data[k]) : '—', to: r.action === 'DELETE' ? '—' : fmtVal(data[k]) }));
  }
  if (r.metadata && typeof r.metadata === 'object') {
    return Object.entries(r.metadata).slice(0, max).map(([k, v]) => ({ field: k, label: fieldLabel(k), from: '—', to: fmtVal(v) }));
  }
  return [];
}

/** جملة عربية واحدة تصف السجل */
export function describe(r: AuditRow): string {
  const who = r.actor_email || (r.actor_id ? 'مستخدم' : (r.source === 'cron' ? 'النظام (كرون)' : 'النظام'));
  const ent = entityLabel(r.entity_type); const label = r.entity_label ? ` «${r.entity_label}»` : '';
  switch (r.action) {
    case 'INSERT': return `${who} أنشأ ${ent}${label}`;
    case 'UPDATE': { const n = r.changes ? Object.keys(r.changes).length : 0; const fields = r.changes ? Object.keys(r.changes).slice(0, 3).map(fieldLabel).join('، ') : ''; return `${who} عدّل ${ent}${label}${n ? ` (${n} ${n === 1 ? 'حقل' : 'حقول'}: ${fields}${n > 3 ? '…' : ''})` : ''}`; }
    case 'DELETE': return `${who} حذف ${ent}${label}`;
    case 'PURGE_EVALUATIONS': { const m = r.metadata || {}; return `${who} فرّغ ${m.deleted_evaluations ?? '?'} تقييمًا (${m.kind || 'الكل'})`; }
    case 'report_email': { const m = r.metadata || {}; return `${who} أرسل تقرير «${m.report || m.title || ''}» إلى ${Array.isArray(m.to) ? m.to.length : (m.count ?? '')} مستلم`; }
    case 'report_digest': { const m = r.metadata || {}; return `الكرون أرسل التقرير الدوري «${m.report || ''}» إلى ${Array.isArray(m.to) ? m.to.length : ''} مشترك`; }
    case 'certificate_email': { const m = r.metadata || {}; return `${who} أرسل ${m.sent ?? '?'} شهادة بالبريد${m.failed ? ` (فشل ${m.failed})` : ''}`; }
    default: return `${who} — ${actionLabel(r.action)}${r.entity_type ? ` (${ent}${label})` : ''}`;
  }
}

export type AuditFilters = { q?: string; action?: string; entity?: string; actor?: string; source?: string; from?: string; to?: string };

export function filterRows(rows: AuditRow[], f: AuditFilters): AuditRow[] {
  const q = (f.q || '').trim().toLowerCase();
  return rows.filter(r => {
    if (f.action && f.action !== 'ALL' && (f.action === 'APP' ? ['INSERT', 'UPDATE', 'DELETE'].includes(r.action) : r.action !== f.action)) return false;
    if (f.entity && f.entity !== 'ALL' && r.entity_type !== f.entity) return false;
    if (f.actor && f.actor !== 'ALL' && (r.actor_email || r.actor_id || 'system') !== f.actor) return false;
    if (f.source && f.source !== 'ALL' && (r.source || 'app') !== f.source) return false;
    const d = (r.created_at || '').slice(0, 10);
    if (f.from && d < f.from) return false; if (f.to && d > f.to) return false;
    if (q) { const hay = [r.entity_label, r.actor_email, r.entity_id, r.action, r.entity_type, describe(r), JSON.stringify(r.changes || r.metadata || {})].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
}

export type AuditStats = { total: number; inserts: number; updates: number; deletes: number; app: number; actors: number; byEntity: { entity: string; label: string; n: number }[]; byDay: { day: string; n: number }[] };

export function auditStats(rows: AuditRow[]): AuditStats {
  const byE = new Map<string, number>(); const byD = new Map<string, number>(); const actors = new Set<string>();
  let inserts = 0, updates = 0, deletes = 0, app = 0;
  for (const r of rows) {
    if (r.action === 'INSERT') inserts++; else if (r.action === 'UPDATE') updates++; else if (r.action === 'DELETE') deletes++; else app++;
    const e = r.entity_type || '—'; byE.set(e, (byE.get(e) || 0) + 1);
    const d = (r.created_at || '').slice(0, 10); if (d) byD.set(d, (byD.get(d) || 0) + 1);
    actors.add(r.actor_email || r.actor_id || 'system');
  }
  return {
    total: rows.length, inserts, updates, deletes, app, actors: actors.size,
    byEntity: [...byE.entries()].map(([entity, n]) => ({ entity, label: entityLabel(entity), n })).sort((a, b) => b.n - a.n),
    byDay: [...byD.entries()].map(([day, n]) => ({ day, n })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function auditCsv(rows: AuditRow[]): string[][] {
  return [['الوقت', 'المنفّذ', 'الدور', 'العملية', 'الكيان', 'التسمية', 'المعرّف', 'المصدر', 'الوصف', 'التغييرات'],
    ...rows.map(r => [r.created_at, r.actor_email || r.actor_id || 'system', r.actor_role || '', actionLabel(r.action), entityLabel(r.entity_type), r.entity_label || '', r.entity_id || '', SOURCE_LABEL[r.source || 'app'] || r.source || '', describe(r), changeList(r, 50).map(c => `${c.label}: ${c.from} → ${c.to}`).join(' | ')])];
}

export function fmtWhen(iso: string): string {
  try { const d = new Date(iso); return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d); } catch { return iso; }
}
