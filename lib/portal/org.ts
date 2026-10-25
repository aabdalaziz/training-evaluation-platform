// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — بوابة الجهات (B2B): الأعضاء، الدعوات، التسجيل الجماعي، مؤشرات لوحة الأثر، Excel
import type { Lang, T } from './content';
import { t } from './content';

export type MemberRole = 'learner' | 'org_admin';
export type MemberStatus = 'pending' | 'confirmed' | 'rejected';
export type Member = { id: string; organization_id?: string; email: string; full_name?: string | null; role: MemberRole; status: MemberStatus; source: 'domain' | 'invite' | 'admin' | 'bulk'; created_at: string; user_id?: string | null };
export type OrgEnrollment = { id: string; email: string; full_name: string; status: string; program_id: string; program: string; classroom_id?: string | null; placement_level?: string | null; created_at: string; attendance: { sessions: number; present: number } };
export type OrgRequest = { id: string; program_id?: string | null; program?: string | null; count: number; status: string; created_at: string; note?: string | null };
export type Dashboard = {
  ok: boolean; error?: string; org?: { id: string; name_ar: string; name_en?: string | null; sector?: string | null; email_domain?: string | null; city?: string | null };
  members: Member[]; enrollments: OrgEnrollment[]; credentials: { email: string; title_ar: string; kind: string; level?: string | null; issued_at: string; verify_code: string }[];
  placements: { email: string; level: string | null; taken_at: string }[]; skills: { skill_id: string; code: string; name_ar: string; name_en: string; domain: string; level: number; confidence: number; user_id: string }[];
  events: { downloads: number; sessions: number; assessed: number; last_at?: string | null }; requests: OrgRequest[]; resources: { id: string; title_ar: string; title_en?: string | null; type: string; downloads: number }[];
};

export const MEMBER_STATUS: Record<MemberStatus, T> = { pending: { ar: 'بانتظار التأكيد', en: 'Pending' }, confirmed: { ar: 'مؤكد', en: 'Confirmed' }, rejected: { ar: 'مرفوض', en: 'Rejected' } };
export const MEMBER_ROLE: Record<MemberRole, T> = { learner: { ar: 'متعلم', en: 'Learner' }, org_admin: { ar: 'مدير الجهة', en: 'Org admin' } };
export const MEMBER_SOURCE: Record<Member['source'], T> = { domain: { ar: 'نطاق البريد', en: 'Email domain' }, invite: { ar: 'دعوة', en: 'Invite' }, admin: { ar: 'إدارة أَثَر', en: 'Athar admin' }, bulk: { ar: 'تسجيل جماعي', en: 'Bulk' } };
export const REQ_STATUS: Record<string, T> = { new: { ar: 'جديد', en: 'New' }, reviewing: { ar: 'قيد الدراسة', en: 'Reviewing' }, quoted: { ar: 'أُرسل العرض', en: 'Quoted' }, approved: { ar: 'معتمد', en: 'Approved' }, enrolled: { ar: 'تم التسجيل', en: 'Enrolled' }, cancelled: { ar: 'ملغى', en: 'Cancelled' } };
export const memberStatusLabel = (s: MemberStatus, lang: Lang) => t(MEMBER_STATUS[s] || { ar: s, en: s }, lang);
export const memberRoleLabel = (r: MemberRole, lang: Lang) => t(MEMBER_ROLE[r] || { ar: r, en: r }, lang);
export const reqStatusLabel = (s: string, lang: Lang) => t(REQ_STATUS[s] || { ar: s, en: s }, lang);

/** يحلّل قائمة بريد (سطر/فاصلة/فاصلة منقوطة) مع أسماء اختيارية «الاسم <email>» أو «الاسم, email» — ويزيل التكرار */
export function parsePeople(text: string): { email: string; full_name: string }[] {
  const out = new Map<string, { email: string; full_name: string }>();
  for (const raw of text.split(/\r?\n|;/)) {
    const line = raw.trim(); if (!line) continue;
    let email = '', name = '';
    const m = line.match(/^(.*?)\s*<([^>]+)>\s*$/); if (m) { name = m[1].trim(); email = m[2].trim(); }
    else { const parts = line.split(/[,\t]/).map(s => s.trim()).filter(Boolean); const e = parts.find(p => p.includes('@')); if (e) { email = e; name = parts.filter(p => p !== e).join(' '); } else email = line; }
    email = email.toLowerCase().replace(/^mailto:/, ''); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) continue;
    if (!out.has(email)) out.set(email, { email, full_name: name.replace(/^["']|["']$/g, '').slice(0, 120) });
  }
  return Array.from(out.values());
}
/** هل البريد من نطاق الجهة؟ */
export function inDomain(email: string, domain?: string | null): boolean { if (!domain) return false; return email.toLowerCase().split('@')[1] === domain.toLowerCase(); }
export function validateBulk(programId: string, people: { email: string }[]): string | null { if (!programId) return 'اختر البرنامج'; if (!people.length) return 'أدخل بريدًا واحدًا صالحًا على الأقل'; if (people.length > 300) return 'الحد الأقصى 300 متدرب في الطلب الواحد'; return null; }

/** مؤشرات لوحة الأثر */
export function orgKpis(d: Dashboard) {
  const confirmed = d.members.filter(m => m.status === 'confirmed'); const pending = d.members.filter(m => m.status === 'pending');
  const approved = d.enrollments.filter(e => e.status === 'approved'); const att = approved.filter(e => e.attendance.sessions > 0);
  const attPct = att.length ? Math.round(att.reduce((s, e) => s + e.attendance.present / e.attendance.sessions, 0) / att.length * 100) : null;
  const byLevel: Record<string, number> = {}; for (const p of d.placements) if (p.level) byLevel[p.level] = (byLevel[p.level] || 0) + 1;
  const skillAvg = d.skills.length ? Math.round(d.skills.reduce((s, x) => s + Number(x.level), 0) / d.skills.length * 10) / 10 : null;
  const programs = new Set(approved.map(e => e.program_id)).size;
  return { members: confirmed.length, pending: pending.length, learners: new Set(approved.map(e => e.email)).size, programs, attendance: attPct, credentials: d.credentials.length, placements: d.placements.length, byLevel, skillAvg, skillsTracked: new Set(d.skills.map(s => s.skill_id)).size, downloads: d.events?.downloads || 0, sessions: d.events?.sessions || 0, assessed: d.events?.assessed || 0 };
}
/** أعلى المهارات في الجهة (متوسط المستوى وعدد المنسوبين) */
export function topSkills(d: Dashboard, n = 8) {
  const m = new Map<string, { code: string; name_ar: string; name_en: string; domain: string; sum: number; n: number }>();
  for (const s of d.skills) { const x = m.get(s.skill_id) || { code: s.code, name_ar: s.name_ar, name_en: s.name_en, domain: s.domain, sum: 0, n: 0 }; x.sum += Number(s.level); x.n++; m.set(s.skill_id, x); }
  return Array.from(m.entries()).map(([id, x]) => ({ skill_id: id, ...x, avg: Math.round(x.sum / x.n * 10) / 10 })).sort((a, b) => b.n - a.n || b.avg - a.avg).slice(0, n);
}
export function memberRows(d: Dashboard) {
  const byEmail = new Map<string, { enrollments: OrgEnrollment[]; credentials: number; level: string | null }>();
  for (const m of d.members) byEmail.set(m.email.toLowerCase(), { enrollments: [], credentials: 0, level: null });
  for (const e of d.enrollments) { const x = byEmail.get(e.email); if (x) x.enrollments.push(e); }
  for (const c of d.credentials) { const x = byEmail.get(c.email); if (x) x.credentials++; }
  for (const p of [...d.placements].sort((a, b) => a.taken_at.localeCompare(b.taken_at))) { const x = byEmail.get(p.email); if (x) x.level = p.level; }
  return d.members.map(m => ({ ...m, ...(byEmail.get(m.email.toLowerCase()) || { enrollments: [], credentials: 0, level: null }) }));
}

// ---------- Excel ----------
export function orgMembersSheet(d: Dashboard) {
  const header = ['الاسم', 'البريد', 'الدور', 'الحالة', 'المصدر', 'مستوى مِعيار', 'البرامج', 'نسبة الحضور', 'الشهادات', 'تاريخ الانضمام'];
  return { name: 'منسوبو الجهة', rtl: true, widths: [24, 30, 12, 14, 12, 12, 40, 12, 10, 12], rows: [header, ...memberRows(d).map(m => { const att = m.enrollments.filter(e => e.attendance.sessions > 0); const pct = att.length ? Math.round(att.reduce((s, e) => s + e.attendance.present / e.attendance.sessions, 0) / att.length * 100) + '%' : ''; return [m.full_name || '', m.email, memberRoleLabel(m.role, 'ar'), memberStatusLabel(m.status, 'ar'), t(MEMBER_SOURCE[m.source], 'ar'), m.level || '', m.enrollments.map(e => `${e.program} (${e.status})`).join('، '), pct, m.credentials, m.created_at.slice(0, 10)]; })] };
}
export function orgSkillsSheet(d: Dashboard) {
  const header = ['الرمز', 'المهارة', 'المجال', 'عدد المنسوبين', 'متوسط المستوى (1–5)'];
  return { name: 'مهارات الجهة', rtl: true, widths: [14, 36, 20, 14, 16], rows: [header, ...topSkills(d, 100).map(s => [s.code, s.name_ar, s.domain, s.n, s.avg])] };
}
