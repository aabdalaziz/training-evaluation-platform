// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — نواة اقتصاد المهارات: تصنيف المهارات الداخلي (مربوط بـ SAQF / SDAIA / CEFR)، القطاعات، الجهات
import type { Lang, T } from './content';
import { t } from './content';

export type SkillDomain = 'arabic' | 'pedagogy' | 'leadership' | 'quality' | 'data_ai' | 'digital' | 'research' | 'wellbeing';
export type Skill = {
  id: string; code: string; name_ar: string; name_en: string; domain: SkillDomain; level: number;
  description_ar?: string | null; description_en?: string | null;
  saqf_level?: number | null; sdaia_code?: string | null; cefr_level?: string | null; sector?: string | null; active: boolean;
  created_at?: string; updated_at?: string;
};
export type Sector = { code: string; name_ar: string; name_en: string; sort: number; active: boolean };
export type Organization = {
  id: string; created_at?: string; name_ar: string; name_en?: string | null; sector?: string | null; city?: string | null;
  contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; email_domain?: string | null; notes?: string | null; active: boolean;
};

export const DOMAINS: { value: SkillDomain; label: T; tone: string }[] = [
  { value: 'arabic', label: { ar: 'اللغة العربية', en: 'Arabic language' }, tone: 'teal' },
  { value: 'pedagogy', label: { ar: 'التعليم والتدريب', en: 'Pedagogy & training' }, tone: 'navy' },
  { value: 'leadership', label: { ar: 'القيادة والإدارة', en: 'Leadership & management' }, tone: 'gold' },
  { value: 'quality', label: { ar: 'الجودة والقياس', en: 'Quality & measurement' }, tone: 'ok' },
  { value: 'data_ai', label: { ar: 'البيانات والذكاء الاصطناعي', en: 'Data & AI' }, tone: 'violet' },
  { value: 'digital', label: { ar: 'التعلّم الرقمي', en: 'Digital learning' }, tone: 'sky' },
  { value: 'research', label: { ar: 'البحث والتطوير', en: 'Research & development' }, tone: 'warn' },
  { value: 'wellbeing', label: { ar: 'الرفاه والمهارات الشخصية', en: 'Wellbeing & soft skills' }, tone: 'rose' },
];
export const SKILL_LEVELS: { value: number; label: T }[] = [
  { value: 1, label: { ar: 'أساسي', en: 'Foundation' } },
  { value: 2, label: { ar: 'مبتدئ متقدم', en: 'Developing' } },
  { value: 3, label: { ar: 'متوسط', en: 'Intermediate' } },
  { value: 4, label: { ar: 'متقدم', en: 'Advanced' } },
  { value: 5, label: { ar: 'خبير', en: 'Expert' } },
];
export const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const SAQF_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** قائمة احتياطية للقطاعات (مطابقة لبذور SQL) — تُستخدم إن تعذّرت القراءة من القاعدة */
export const SECTORS_FALLBACK: Sector[] = [
  { code: 'edu_k12', name_ar: 'التعليم العام', name_en: 'K-12 education', sort: 10, active: true },
  { code: 'edu_higher', name_ar: 'التعليم الجامعي', name_en: 'Higher education', sort: 20, active: true },
  { code: 'training', name_ar: 'التدريب والتطوير', name_en: 'Training & development', sort: 30, active: true },
  { code: 'gov', name_ar: 'القطاع الحكومي', name_en: 'Government', sort: 40, active: true },
  { code: 'health', name_ar: 'القطاع الصحي', name_en: 'Healthcare', sort: 50, active: true },
  { code: 'tourism', name_ar: 'السياحة والضيافة', name_en: 'Tourism & hospitality', sort: 60, active: true },
  { code: 'energy', name_ar: 'الطاقة والصناعة', name_en: 'Energy & industry', sort: 70, active: true },
  { code: 'finance', name_ar: 'المالية والأعمال', name_en: 'Finance & business', sort: 80, active: true },
  { code: 'tech', name_ar: 'التقنية والاتصالات', name_en: 'Technology & telecom', sort: 90, active: true },
  { code: 'culture', name_ar: 'الثقافة والإعلام', name_en: 'Culture & media', sort: 100, active: true },
  { code: 'nonprofit', name_ar: 'القطاع غير الربحي', name_en: 'Non-profit', sort: 110, active: true },
  { code: 'private', name_ar: 'القطاع الخاص (عام)', name_en: 'Private sector (general)', sort: 120, active: true },
];

export function domainLabel(d: string, lang: Lang): string { const x = DOMAINS.find(a => a.value === d); return x ? t(x.label, lang) : d; }
export function domainTone(d: string): string { return DOMAINS.find(a => a.value === d)?.tone || 'navy'; }
export function skillLevelLabel(n: number, lang: Lang): string { const x = SKILL_LEVELS.find(a => a.value === n); return x ? t(x.label, lang) : String(n); }
export function skillName(s: Pick<Skill, 'name_ar' | 'name_en'>, lang: Lang): string { return (lang === 'en' && s.name_en) ? s.name_en : s.name_ar; }
export function sectorName(code: string | null | undefined, sectors: Sector[], lang: Lang): string {
  if (!code) return '';
  const s = sectors.find(x => x.code === code) || SECTORS_FALLBACK.find(x => x.code === code);
  return s ? (lang === 'en' ? s.name_en : s.name_ar) : code;
}
export function orgName(o: Pick<Organization, 'name_ar' | 'name_en'>, lang: Lang): string { return (lang === 'en' && o.name_en) ? o.name_en : o.name_ar; }

/** شارات الأطر المرجعية للمهارة: SAQF 5 · SDAIA-AI-2 · CEFR B2 */
export function frameworkBadges(s: Pick<Skill, 'saqf_level' | 'sdaia_code' | 'cefr_level'>): { k: 'saqf' | 'sdaia' | 'cefr'; label: string }[] {
  const out: { k: 'saqf' | 'sdaia' | 'cefr'; label: string }[] = [];
  if (s.saqf_level) out.push({ k: 'saqf', label: `SAQF ${s.saqf_level}` });
  if (s.sdaia_code) out.push({ k: 'sdaia', label: s.sdaia_code });
  if (s.cefr_level) out.push({ k: 'cefr', label: `CEFR ${s.cefr_level}` });
  return out;
}

export function nextSkillCode(domain: SkillDomain, existing: Pick<Skill, 'code'>[]): string {
  const pref: Record<SkillDomain, string> = { arabic: 'AR', pedagogy: 'PD', leadership: 'LD', quality: 'QA', data_ai: 'DA', digital: 'DG', research: 'RS', wellbeing: 'WB' };
  const p = `ATH-${pref[domain]}-`;
  const max = existing.map(s => s.code).filter(c => c.startsWith(p)).map(c => parseInt(c.slice(p.length), 10) || 0).reduce((a, b) => Math.max(a, b), 0);
  return p + String(max + 1).padStart(3, '0');
}

export type SkillForm = { code: string; name_ar: string; name_en: string; domain: SkillDomain; level: number; description_ar: string; description_en: string; saqf_level: string; sdaia_code: string; cefr_level: string; sector: string; active: boolean };
export const EMPTY_SKILL: SkillForm = { code: '', name_ar: '', name_en: '', domain: 'pedagogy', level: 3, description_ar: '', description_en: '', saqf_level: '', sdaia_code: '', cefr_level: '', sector: '', active: true };
export function validateSkill(f: SkillForm): string | null {
  if (!/^ATH-[A-Z]{2}-\d{3}$/.test(f.code.trim().toUpperCase())) return 'الرمز يجب أن يكون بصيغة ATH-XX-000';
  if (f.name_ar.trim().length < 3) return 'الاسم العربي مطلوب (3 أحرف على الأقل)';
  if (f.name_en.trim().length < 3) return 'الاسم الإنجليزي مطلوب';
  if (!DOMAINS.some(d => d.value === f.domain)) return 'المجال غير صالح';
  if (!(f.level >= 1 && f.level <= 5)) return 'المستوى بين 1 و5';
  if (f.saqf_level && !(Number(f.saqf_level) >= 1 && Number(f.saqf_level) <= 8)) return 'مستوى SAQF بين 1 و8';
  if (f.cefr_level && !(CEFR as readonly string[]).includes(f.cefr_level)) return 'مستوى CEFR غير صالح';
  return null;
}
export function skillPayload(f: SkillForm) {
  return { code: f.code.trim().toUpperCase(), name_ar: f.name_ar.trim(), name_en: f.name_en.trim(), domain: f.domain, level: f.level, description_ar: f.description_ar.trim() || null, description_en: f.description_en.trim() || null, saqf_level: f.saqf_level ? Number(f.saqf_level) : null, sdaia_code: f.sdaia_code.trim() || null, cefr_level: f.cefr_level || null, sector: f.sector || null, active: f.active, updated_at: new Date().toISOString() };
}
export function skillToForm(s: Skill): SkillForm {
  return { code: s.code, name_ar: s.name_ar, name_en: s.name_en, domain: s.domain, level: s.level, description_ar: s.description_ar || '', description_en: s.description_en || '', saqf_level: s.saqf_level ? String(s.saqf_level) : '', sdaia_code: s.sdaia_code || '', cefr_level: s.cefr_level || '', sector: s.sector || '', active: s.active };
}

export type OrgForm = { name_ar: string; name_en: string; sector: string; city: string; contact_name: string; contact_email: string; contact_phone: string; email_domain: string; notes: string; active: boolean };
export const EMPTY_ORG: OrgForm = { name_ar: '', name_en: '', sector: '', city: '', contact_name: '', contact_email: '', contact_phone: '', email_domain: '', notes: '', active: true };
export function validateOrg(f: OrgForm): string | null {
  if (f.name_ar.trim().length < 3) return 'اسم الجهة مطلوب';
  if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email.trim())) return 'بريد جهة الاتصال غير صالح';
  if (f.email_domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(f.email_domain.trim())) return 'نطاق البريد غير صالح (مثال: moe.gov.sa)';
  return null;
}
export function orgPayload(f: OrgForm) {
  return { name_ar: f.name_ar.trim(), name_en: f.name_en.trim() || null, sector: f.sector || null, city: f.city.trim() || null, contact_name: f.contact_name.trim() || null, contact_email: f.contact_email.trim().toLowerCase() || null, contact_phone: f.contact_phone.trim() || null, email_domain: f.email_domain.trim().toLowerCase() || null, notes: f.notes.trim() || null, active: f.active, updated_at: new Date().toISOString() };
}
export function orgToForm(o: Organization): OrgForm {
  return { name_ar: o.name_ar, name_en: o.name_en || '', sector: o.sector || '', city: o.city || '', contact_name: o.contact_name || '', contact_email: o.contact_email || '', contact_phone: o.contact_phone || '', email_domain: o.email_domain || '', notes: o.notes || '', active: o.active };
}

export function skillsSheet(rows: Skill[], sectors: Sector[]) {
  const header = ['الرمز', 'المهارة (ع)', 'Skill (EN)', 'المجال', 'المستوى', 'SAQF', 'SDAIA', 'CEFR', 'القطاع', 'نشطة'];
  return { name: 'المهارات', rtl: true, widths: [14, 34, 34, 20, 10, 8, 14, 8, 20, 8], rows: [header, ...rows.map(s => [s.code, s.name_ar, s.name_en, domainLabel(s.domain, 'ar'), s.level, s.saqf_level || '', s.sdaia_code || '', s.cefr_level || '', sectorName(s.sector, sectors, 'ar'), s.active ? 'نعم' : 'لا'])] };
}
export function orgsSheet(rows: Organization[], sectors: Sector[]) {
  const header = ['الجهة', 'Organization', 'القطاع', 'المدينة', 'جهة الاتصال', 'البريد', 'الجوال', 'نطاق البريد', 'نشطة'];
  return { name: 'الجهات', rtl: true, widths: [30, 30, 20, 14, 22, 28, 16, 20, 8], rows: [header, ...rows.map(o => [o.name_ar, o.name_en || '', sectorName(o.sector, sectors, 'ar'), o.city || '', o.contact_name || '', o.contact_email || '', o.contact_phone || '', o.email_domain || '', o.active ? 'نعم' : 'لا'])] };
}
