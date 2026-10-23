/**
 * نطاق الوصول حسب البرنامج — دوال نقية
 */
export type Assignment = { profile_id: string; program_id: string; assigned_at?: string; assigned_by?: string | null };
export type Profile = { id: string; full_name?: string | null; email?: string | null; role?: string | null };
export type ProgramLite = { id: string; name_ar?: string | null; status?: string | null };

export const SCOPABLE_ROLES = ['PROGRAM_MANAGER'];
export const UNRESTRICTED_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'QUALITY_ANALYST'];

export type Scope = { kind: 'all' | 'subset' | 'none'; programIds: string[]; reason: string };

/** النطاق الفعلي لمستخدم: الأدمن/محلل الجودة = الكل؛ مدير برنامج بلا ربط = الكل (توافقًا)؛ مدير مرتبط = برامجه فقط */
export function scopeOf(role: string | null | undefined, assignments: Assignment[], profileId: string): Scope {
  const r = String(role || '').toUpperCase();
  const mine = assignments.filter(a => a.profile_id === profileId).map(a => a.program_id);
  if (UNRESTRICTED_ROLES.includes(r)) return { kind: 'all', programIds: [], reason: 'دور إداري — يرى كل البرامج' };
  if (SCOPABLE_ROLES.includes(r)) {
    if (!mine.length) return { kind: 'all', programIds: [], reason: 'مدير برنامج بلا ربط — يرى كل البرامج (الوضع الافتراضي)' };
    return { kind: 'subset', programIds: Array.from(new Set(mine)), reason: `مقيّد بـ ${new Set(mine).size} برنامج` };
  }
  if (r === 'TRAINER') return { kind: 'all', programIds: [], reason: 'مدرب — قراءة فقط حسب سياسات الجداول' };
  return { kind: 'none', programIds: [], reason: r ? `الدور ${r} لا يملك صلاحية لوحات الإدارة` : 'بلا دور' };
}

export function canSee(scope: Scope, programId: string | null | undefined): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'none') return false;
  return !!programId && scope.programIds.includes(programId);
}

/** الفرق بين الربط الحالي والمطلوب لمستخدم واحد */
export function diffAssignments(profileId: string, current: Assignment[], desired: string[]): { add: Assignment[]; remove: Assignment[] } {
  const cur = new Set(current.filter(a => a.profile_id === profileId).map(a => a.program_id));
  const want = new Set(desired);
  return {
    add: [...want].filter(p => !cur.has(p)).map(program_id => ({ profile_id: profileId, program_id })),
    remove: [...cur].filter(p => !want.has(p)).map(program_id => ({ profile_id: profileId, program_id })),
  };
}

export type AccessRow = { profile: Profile; role: string; scope: Scope; programs: ProgramLite[] };

export function accessMatrix(profiles: Profile[], assignments: Assignment[], programs: ProgramLite[]): AccessRow[] {
  const byId = new Map(programs.map(p => [p.id, p]));
  return profiles
    .map(p => { const role = String(p.role || '').toUpperCase(); const scope = scopeOf(role, assignments, p.id); return { profile: p, role, scope, programs: scope.programIds.map(id => byId.get(id) || { id, name_ar: '— (برنامج محذوف)' }) }; })
    .sort((a, b) => (SCOPABLE_ROLES.includes(a.role) ? 0 : 1) - (SCOPABLE_ROLES.includes(b.role) ? 0 : 1) || String(a.profile.full_name || a.profile.email || '').localeCompare(String(b.profile.full_name || b.profile.email || ''), 'ar'));
}

export const ROLE_LABEL: Record<string, string> = { PLATFORM_ADMIN: 'مدير المنصة', SUPER_ADMIN: 'مشرف عام', ADMIN: 'إداري', PROGRAM_MANAGER: 'مدير برنامج', QUALITY_ANALYST: 'محلل جودة', TRAINER: 'مدرب', TRAINEE: 'متدرب', STUDENT: 'متدرب' };
export const roleLabel = (r: string | null | undefined) => ROLE_LABEL[String(r || '').toUpperCase()] || (r || '—');

export function accessCsv(rows: AccessRow[]): string[][] {
  return [['المستخدم', 'البريد', 'الدور', 'النطاق', 'البرامج'], ...rows.map(r => [r.profile.full_name || '', r.profile.email || '', roleLabel(r.role), r.scope.reason, r.programs.map(p => p.name_ar || p.id).join(' | ')])];
}

/** برامج ضمن النطاق — للاستخدام في الخادم بعد قراءة الربط */
export function filterPrograms<T extends { id: string }>(programs: T[], scope: Scope): T[] { return programs.filter(p => canSee(scope, p.id)); }
