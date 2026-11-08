// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر — الطبقة الثانية (P65): سجلّ الوصول الإداري «مَن فتح بيانات مَن؟»
 *  صفّ واحد لكل (مستخدم × مسار إداري يحمل بيانات شخصية × شخص × يوم) — خفيف، لا يسجّل كل نقرة، ولا يخزّن بريد الشخص بل بصمته.
 *  يُستهلك في ثلاثة مواضع: /admin/audit (الطاقم) · /me/data «مَن نظر إلى بياناتي؟» (المتدرّب: أدوار لا أسماء) · الكنس 180 يومًا داخل shield_gc.
 */
import { hashEmail } from '../vault/erasure';

export const ACCESS_RETENTION_DAYS = 180;

export { PII_PATHS, normalizePath, piiPathTitle, isPiiPath } from './paths';
import { piiPathTitle, normalizePath } from './paths';
export const subjectHash = (email: string) => (email ? hashEmail(String(email).trim()) : '');

export type AccessRow = { id?: number; day: string; first_at?: string; last_at: string; hits: number; user_id: string; role: string; path: string; subject_hash: string; ip_masked?: string | null };

/** تسجيل وصول (RPC واحدة؛ إن غابت الدالة — إدراج مباشر يتجاهل التكرار) */
export async function recordAccess(db: any, a: { user_id: string; role?: string; path: string; subject_email?: string | null; ip?: string | null }): Promise<boolean> {
  const path = normalizePath(a.path); const subject = subjectHash(a.subject_email || '');
  const ip = a.ip ? String(a.ip).replace(/\.\d+$/, '.x').replace(/:[0-9a-f]*:[0-9a-f]*$/i, ':x').slice(0, 64) : null;
  try {
    const { error } = await db.rpc('shield_access_touch', { p_user: a.user_id, p_role: String(a.role || '').toUpperCase(), p_path: path, p_subject: subject, p_ip: ip });
    if (!error) return true;
  } catch { /* fallback */ }
  try { const { error } = await db.from('portal_admin_access').insert({ user_id: a.user_id, role: String(a.role || '').toUpperCase(), path, subject_hash: subject, ip_masked: ip }); return !error || String(error.code) === '23505'; } catch { return false; }
}

export type AccessSummary = {
  since: string; rows: AccessRow[];
  by_path: { path: string; title_ar: string; users: number; hits: number; days: number; last_at: string }[];
  by_user: { user_id: string; role: string; paths: number; hits: number; subjects: number; last_at: string }[];
  subject_views: number;
};

/** تجميع نقي (قابل للاختبار) */
export function summarize(rows: AccessRow[], since: string): AccessSummary {
  const bp = new Map<string, { users: Set<string>; hits: number; days: Set<string>; last_at: string }>();
  const bu = new Map<string, { role: string; paths: Set<string>; hits: number; subjects: Set<string>; last_at: string }>();
  let subject_views = 0;
  for (const r of rows) {
    const p = bp.get(r.path) || { users: new Set(), hits: 0, days: new Set(), last_at: '' }; p.users.add(r.user_id); p.hits += Number(r.hits || 1); p.days.add(r.day); if (r.last_at > p.last_at) p.last_at = r.last_at; bp.set(r.path, p);
    const u = bu.get(r.user_id) || { role: r.role, paths: new Set(), hits: 0, subjects: new Set(), last_at: '' }; u.paths.add(r.path); u.hits += Number(r.hits || 1); if (r.subject_hash) u.subjects.add(r.subject_hash); if (r.last_at > u.last_at) u.last_at = r.last_at; if (!u.role && r.role) u.role = r.role; bu.set(r.user_id, u);
    if (r.subject_hash) subject_views += 1;
  }
  const by_path = [...bp.entries()].map(([path, v]) => ({ path, title_ar: piiPathTitle(path) || path, users: v.users.size, hits: v.hits, days: v.days.size, last_at: v.last_at })).sort((a, b) => b.hits - a.hits);
  const by_user = [...bu.entries()].map(([user_id, v]) => ({ user_id, role: v.role, paths: v.paths.size, hits: v.hits, subjects: v.subjects.size, last_at: v.last_at })).sort((a, b) => b.hits - a.hits);
  return { since, rows, by_path, by_user, subject_views };
}

export async function accessSummary(db: any, days = 7): Promise<AccessSummary> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await db.from('portal_admin_access').select('id,day,first_at,last_at,hits,user_id,role,path,subject_hash,ip_masked').gte('day', since).order('last_at', { ascending: false }).limit(3000);
  return summarize(error ? [] : ((data || []) as AccessRow[]), since);
}

export type SubjectAccess = { days: number; count: number; staff: number; roles: string[]; last_at: string | null };
/** «مَن نظر إلى بياناتي؟» — أدوار لا أسماء */
export async function accessForSubject(db: any, email: string, days = 30): Promise<SubjectAccess> {
  const h = subjectHash(email); const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  if (!h) return { days, count: 0, staff: 0, roles: [], last_at: null };
  const { data, error } = await db.from('portal_admin_access').select('user_id,role,hits,last_at').eq('subject_hash', h).gte('day', since).order('last_at', { ascending: false }).limit(500);
  const rows = (error ? [] : (data || [])) as { user_id: string; role: string; hits: number; last_at: string }[];
  const roles = [...new Set(rows.map(r => roleAr(r.role)))];
  return { days, count: rows.reduce((s, r) => s + Number(r.hits || 1), 0), staff: new Set(rows.map(r => r.user_id)).size, roles, last_at: rows[0]?.last_at || null };
}

export const ROLE_AR: Record<string, string> = {
  PLATFORM_ADMIN: 'إدارة المنصّة', SUPER_ADMIN: 'الإدارة العليا', ADMIN: 'إداري', QUALITY_ANALYST: 'محلّل جودة', PROGRAM_MANAGER: 'مدير برنامج', TRAINER: 'مدرّب',
  SUPERVISOR: 'مشرف', ORG_ADMIN: 'مسؤول جهة', LEARNER: 'متدرّب', STUDENT: 'متدرّب',
};
export const roleAr = (r: string) => ROLE_AR[String(r || '').toUpperCase()] || (r ? String(r) : 'طاقم');

const fmtAr = (iso: string) => { try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };
/** السطر الصادق للمتدرّب — صفر صادق أيضًا */
export function subjectAccessLineAr(a: SubjectAccess): string {
  if (!a.count) return `لم يفتح أحدٌ من الطاقم ملفّك بعينه خلال ${a.days} يومًا الماضية.`;
  const who = a.staff === 1 ? 'عضو واحد من الطاقم' : a.staff === 2 ? 'عضوان من الطاقم' : `${a.staff} من الطاقم`;
  return `اطّلع على ملفّك ${who} (${a.roles.join('، ')}) ${a.count === 1 ? 'مرّة واحدة' : a.count === 2 ? 'مرّتين' : `${a.count} مرّات`} خلال ${a.days} يومًا — آخرها ${a.last_at ? fmtAr(a.last_at) : '—'}.`;
}

/** CSV للطاقم (أسماء الطاقم تُضاف في الصفحة إن توفّرت) */
export function accessCsv(rows: AccessRow[], names: Record<string, string> = {}): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['اليوم', 'المستخدم', 'الدور', 'المسار', 'العنوان', 'ملف شخص؟', 'مرّات', 'آخر مرّة'].map(esc).join(',');
  return '\uFEFF' + [head, ...rows.map(r => [r.day, names[r.user_id] || r.user_id.slice(0, 8), roleAr(r.role), r.path, piiPathTitle(r.path) || '', r.subject_hash ? 'نعم' : '', r.hits, r.last_at].map(esc).join(','))].join('\n');
}
