// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — مستودع الحقائب: الأنواع، التسميات، التحقق، الفلاتر، قرار الوصول، Excel
import type { Lang, T } from './content';
import { t } from './content';
import type { Skill, Sector } from './skills';
import { skillName } from './skills';

export type ResType = 'package' | 'guide' | 'slides' | 'template' | 'video' | 'assessment' | 'tool' | 'research';
export type ResLevel = 'foundation' | 'intermediate' | 'advanced';
export type ResDelivery = 'self' | 'live' | 'hybrid';
export type ResLang = 'ar' | 'en' | 'both';
export type ResAccess = 'public' | 'registered' | 'program' | 'org' | 'staff';
export type ResStatus = 'draft' | 'published' | 'archived';
export type AccessState = 'ok' | 'login' | 'program' | 'org' | 'staff' | 'not_found';

export type Resource = {
  id: string; created_at: string; updated_at?: string; created_by?: string | null; slug?: string | null;
  title_ar: string; title_en?: string | null; summary_ar?: string | null; summary_en?: string | null; body_ar?: string | null; body_en?: string | null;
  type: ResType; sector?: string | null; skills: string[]; level: ResLevel; delivery: ResDelivery; ai_ready: boolean; lang: ResLang; access: ResAccess;
  program_id?: string | null; organization_id?: string | null; cover_url?: string | null; version: string; tags: string[]; status: ResStatus;
  published_at?: string | null; downloads: number; views: number;
};
export type ResourceFile = { id: string; resource_id: string; created_at?: string; name: string; path: string; size: number; mime?: string | null; version: string; sort: number; downloads: number };
export type LearningEvent = { id: number; at: string; user_id?: string | null; email?: string | null; verb: string; object_type: string; object_id: string; skills: string[]; context: Record<string, unknown> };

export const RES_TYPES: { value: ResType; label: T; icon: string }[] = [
  { value: 'package', label: { ar: 'حقيبة تدريبية', en: 'Training kit' }, icon: 'folder' },
  { value: 'guide', label: { ar: 'دليل', en: 'Guide' }, icon: 'book' },
  { value: 'slides', label: { ar: 'عرض تقديمي', en: 'Slides' }, icon: 'slides' },
  { value: 'template', label: { ar: 'نموذج / قالب', en: 'Template' }, icon: 'doc' },
  { value: 'video', label: { ar: 'فيديو / تسجيل', en: 'Video' }, icon: 'play' },
  { value: 'assessment', label: { ar: 'أداة تقويم', en: 'Assessment tool' }, icon: 'evaluations' },
  { value: 'tool', label: { ar: 'أداة عمل', en: 'Work tool' }, icon: 'target' },
  { value: 'research', label: { ar: 'دراسة / بحث', en: 'Research' }, icon: 'search' },
];
export const RES_LEVELS: { value: ResLevel; label: T }[] = [
  { value: 'foundation', label: { ar: 'تأسيسي', en: 'Foundation' } },
  { value: 'intermediate', label: { ar: 'متوسط', en: 'Intermediate' } },
  { value: 'advanced', label: { ar: 'متقدم', en: 'Advanced' } },
];
export const RES_DELIVERY: { value: ResDelivery; label: T }[] = [
  { value: 'self', label: { ar: 'تعلّم ذاتي', en: 'Self-paced' } },
  { value: 'live', label: { ar: 'جلسات مباشرة', en: 'Live sessions' } },
  { value: 'hybrid', label: { ar: 'هجين', en: 'Hybrid' } },
];
export const RES_LANGS: { value: ResLang; label: T }[] = [
  { value: 'ar', label: { ar: 'عربي', en: 'Arabic' } },
  { value: 'en', label: { ar: 'إنجليزي', en: 'English' } },
  { value: 'both', label: { ar: 'ثنائي اللغة', en: 'Bilingual' } },
];
export const RES_ACCESS: { value: ResAccess; label: T; hint: T }[] = [
  { value: 'public', label: { ar: 'عام', en: 'Public' }, hint: { ar: 'متاح للجميع دون تسجيل', en: 'Anyone, no sign-in' } },
  { value: 'registered', label: { ar: 'للمسجّلين', en: 'Members' }, hint: { ar: 'يتطلب الدخول بالبريد', en: 'Email sign-in required' } },
  { value: 'program', label: { ar: 'لمتدربي البرنامج', en: 'Program trainees' }, hint: { ar: 'للمقبولين في البرنامج المرتبط', en: 'Approved trainees of the linked program' } },
  { value: 'org', label: { ar: 'لجهة محددة', en: 'Organization' }, hint: { ar: 'لمنسوبي الجهة المرتبطة (نطاق البريد)', en: 'Members of the linked organization (email domain)' } },
  { value: 'staff', label: { ar: 'داخلي', en: 'Internal' }, hint: { ar: 'لفريق أَثَر فقط', en: 'Athar team only' } },
];
export const RES_STATUS: Record<ResStatus, T> = { draft: { ar: 'مسودة', en: 'Draft' }, published: { ar: 'منشورة', en: 'Published' }, archived: { ar: 'مؤرشفة', en: 'Archived' } };

const lab = <V extends string>(list: { value: V; label: T }[], v: string, lang: Lang) => { const x = list.find(a => a.value === v); return x ? t(x.label, lang) : v; };
export const typeLabel = (v: string, lang: Lang) => lab(RES_TYPES, v, lang);
export const typeIcon = (v: string) => RES_TYPES.find(a => a.value === v)?.icon || 'folder';
export const levelLabel = (v: string, lang: Lang) => lab(RES_LEVELS, v, lang);
export const deliveryLabel = (v: string, lang: Lang) => lab(RES_DELIVERY, v, lang);
export const langLabel = (v: string, lang: Lang) => lab(RES_LANGS, v, lang);
export const accessLabel = (v: string, lang: Lang) => lab(RES_ACCESS, v, lang);
export const statusLabel = (v: ResStatus, lang: Lang) => t(RES_STATUS[v] || { ar: v, en: v }, lang);
export function resTitle(r: Pick<Resource, 'title_ar' | 'title_en'>, lang: Lang): string { return (lang === 'en' && r.title_en) ? r.title_en : r.title_ar; }
export function resSummary(r: Pick<Resource, 'summary_ar' | 'summary_en'>, lang: Lang): string { return ((lang === 'en' && r.summary_en) ? r.summary_en : r.summary_ar) || ''; }
export function resBody(r: Pick<Resource, 'body_ar' | 'body_en'>, lang: Lang): string[] { return (((lang === 'en' && r.body_en) ? r.body_en : r.body_ar) || '').split(/\n+/).map(s => s.trim()).filter(Boolean); }

export function fmtSize(bytes: number | null | undefined, lang: Lang): string {
  const b = Number(bytes || 0); if (!b) return '—';
  const u = lang === 'ar' ? ['بايت', 'ك.ب', 'م.ب', 'ج.ب'] : ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = b; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}
export function fileKind(name: string, mime?: string | null): 'pdf' | 'doc' | 'slides' | 'sheet' | 'video' | 'image' | 'zip' | 'file' {
  const ext = (name.split('.').pop() || '').toLowerCase(); const m = mime || '';
  if (ext === 'pdf' || m.includes('pdf')) return 'pdf';
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'doc';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'slides';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext) || m.startsWith('video/')) return 'video';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || m.startsWith('image/')) return 'image';
  if (['zip', 'rar', '7z'].includes(ext)) return 'zip';
  return 'file';
}
/** اسم آمن للمسار داخل الحاوية */
export function storageName(name: string): string {
  const base = name.replace(/[^\w.\-\u0600-\u06FF ]+/g, '').replace(/\s+/g, '_').slice(0, 80) || 'file';
  return `${Date.now().toString(36)}-${base}`;
}

// ---------- الفلاتر (صفحة /resources) ----------
export type ResFilters = { q: string; type: string; sector: string; level: string; lang: string; skill: string; program: string };
export const EMPTY_FILTERS: ResFilters = { q: '', type: '', sector: '', level: '', lang: '', skill: '', program: '' };
export function filterResources(rows: Resource[], f: ResFilters, skills: Skill[]): Resource[] {
  const q = f.q.trim().toLowerCase();
  const byId = new Map(skills.map(s => [s.id, s]));
  return rows.filter(r => {
    if (f.type && r.type !== f.type) return false;
    if (f.sector && r.sector !== f.sector) return false;
    if (f.level && r.level !== f.level) return false;
    if (f.lang && r.lang !== f.lang && r.lang !== 'both') return false;
    if (f.skill && !(r.skills || []).includes(f.skill)) return false;
    if (f.program && r.program_id !== f.program) return false;
    if (q) {
      const hay = [r.title_ar, r.title_en, r.summary_ar, r.summary_en, ...(r.tags || []), ...(r.skills || []).map(id => { const s = byId.get(id); return s ? `${s.name_ar} ${s.name_en} ${s.code}` : ''; })].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
export function sortResources(rows: Resource[]): Resource[] {
  return [...rows].sort((a, b) => (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at));
}

// ---------- قرار الوصول (يُستخدم في العميل للعرض فقط؛ القرار الفعلي في SQL/الخادم) ----------
/** orgIds = معرّفات الجهات التي ينتمي إليها المستخدم (عبر التسجيل أو مطابقة نطاق البريد — يحسبها المستدعي) */
export type AccessCtx = { user: { id: string; email: string } | null; role?: string | null; approvedPrograms: string[]; orgIds: string[] };
export function accessState(r: Pick<Resource, 'access' | 'program_id' | 'organization_id' | 'status'>, ctx: AccessCtx): AccessState {
  if (r.status !== 'published') return 'not_found';
  if (r.access === 'public') return 'ok';
  if (!ctx.user) return 'login';
  const role = (ctx.role || '').toUpperCase();
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'].includes(role)) return 'ok';
  if (r.access === 'registered') return 'ok';
  if (r.access === 'staff') return 'staff';
  if (r.access === 'program') return !r.program_id || ctx.approvedPrograms.includes(r.program_id) ? 'ok' : 'program';
  if (r.access === 'org') return !r.organization_id || ctx.orgIds.includes(r.organization_id) ? 'ok' : 'org';
  return 'staff';
}
export const ACCESS_MSG: Record<Exclude<AccessState, 'ok' | 'not_found'>, T> = {
  login: { ar: 'هذه الحقيبة للمسجّلين — أدخل بريدك لاستلام رابط دخول ثم حمّل مباشرة.', en: 'Members only — enter your email for a sign-in link, then download.' },
  program: { ar: 'هذه الحقيبة مخصصة لمتدربي البرنامج المرتبط. سجّل في البرنامج أو انتظر قبول طلبك.', en: 'Reserved for trainees of the linked program. Enrol or wait for approval.' },
  org: { ar: 'هذه الحقيبة مخصصة لمنسوبي جهة محددة. استخدم بريد جهتك أو تواصل معنا.', en: 'Reserved for a specific organization. Use your organization email or contact us.' },
  staff: { ar: 'مادة داخلية لفريق أَثَر.', en: 'Internal material for the Athar team.' },
};

// ---------- نموذج الإدارة ----------
export type ResForm = {
  title_ar: string; title_en: string; summary_ar: string; summary_en: string; body_ar: string; body_en: string;
  type: ResType; sector: string; skills: string[]; level: ResLevel; delivery: ResDelivery; ai_ready: boolean; lang: ResLang; access: ResAccess;
  program_id: string; organization_id: string; cover_url: string; version: string; tags: string;
};
export const EMPTY_RES: ResForm = { title_ar: '', title_en: '', summary_ar: '', summary_en: '', body_ar: '', body_en: '', type: 'package', sector: '', skills: [], level: 'foundation', delivery: 'self', ai_ready: false, lang: 'ar', access: 'public', program_id: '', organization_id: '', cover_url: '', version: '1.0', tags: '' };
export function validateResource(f: ResForm): string | null {
  if (f.title_ar.trim().length < 4) return 'العنوان العربي مطلوب (4 أحرف على الأقل)';
  if (!RES_TYPES.some(x => x.value === f.type)) return 'نوع المادة غير صالح';
  if (!RES_ACCESS.some(x => x.value === f.access)) return 'مستوى الوصول غير صالح';
  if (f.access === 'program' && !f.program_id) return 'اختر البرنامج المرتبط لمستوى الوصول «لمتدربي البرنامج»';
  if (f.access === 'org' && !f.organization_id) return 'اختر الجهة المرتبطة لمستوى الوصول «لجهة محددة»';
  if (!/^\d+(\.\d+)*$/.test(f.version.trim())) return 'رقم الإصدار بصيغة 1.0 أو 2.1';
  if (f.skills.length > 12) return 'الحد الأقصى 12 مهارة';
  return null;
}
export function resourcePayload(f: ResForm) {
  return {
    title_ar: f.title_ar.trim(), title_en: f.title_en.trim() || null, summary_ar: f.summary_ar.trim() || null, summary_en: f.summary_en.trim() || null, body_ar: f.body_ar.trim() || null, body_en: f.body_en.trim() || null,
    type: f.type, sector: f.sector || null, skills: f.skills, level: f.level, delivery: f.delivery, ai_ready: f.ai_ready, lang: f.lang, access: f.access,
    program_id: f.program_id || null, organization_id: f.organization_id || null, cover_url: f.cover_url.trim() || null, version: f.version.trim(),
    tags: f.tags.split(/[,،]/).map(s => s.trim()).filter(Boolean).slice(0, 15), updated_at: new Date().toISOString(),
  };
}
export function resourceToForm(r: Resource): ResForm {
  return { title_ar: r.title_ar, title_en: r.title_en || '', summary_ar: r.summary_ar || '', summary_en: r.summary_en || '', body_ar: r.body_ar || '', body_en: r.body_en || '', type: r.type, sector: r.sector || '', skills: r.skills || [], level: r.level, delivery: r.delivery, ai_ready: !!r.ai_ready, lang: r.lang, access: r.access, program_id: r.program_id || '', organization_id: r.organization_id || '', cover_url: r.cover_url || '', version: r.version || '1.0', tags: (r.tags || []).join('، ') };
}

// ---------- Excel ----------
export function resourcesSheet(rows: Resource[], skills: Skill[], sectors: Sector[]) {
  const byId = new Map(skills.map(s => [s.id, s]));
  const sec = (c: string | null | undefined) => { const s = sectors.find(x => x.code === c); return s ? s.name_ar : (c || ''); };
  const header = ['العنوان', 'Title', 'النوع', 'القطاع', 'المستوى', 'التقديم', 'اللغة', 'الوصول', 'المهارات', 'AI', 'الإصدار', 'الحالة', 'تاريخ النشر', 'مشاهدات', 'تنزيلات'];
  return { name: 'الحقائب', rtl: true, widths: [36, 36, 16, 20, 12, 14, 12, 16, 40, 6, 8, 10, 12, 10, 10], rows: [header, ...rows.map(r => [r.title_ar, r.title_en || '', typeLabel(r.type, 'ar'), sec(r.sector), levelLabel(r.level, 'ar'), deliveryLabel(r.delivery, 'ar'), langLabel(r.lang, 'ar'), accessLabel(r.access, 'ar'), (r.skills || []).map(id => { const s = byId.get(id); return s ? skillName(s, 'ar') : ''; }).filter(Boolean).join('، '), r.ai_ready ? 'نعم' : 'لا', r.version, statusLabel(r.status, 'ar'), (r.published_at || '').slice(0, 10), r.views || 0, r.downloads || 0])] };
}
export function eventsSheet(rows: LearningEvent[], titles: Map<string, string>) {
  const header = ['الوقت', 'البريد', 'الفعل', 'النوع', 'المادة', 'الملف'];
  return { name: 'سجل التنزيلات', rtl: true, widths: [20, 30, 12, 14, 40, 30], rows: [header, ...rows.map(e => [e.at.replace('T', ' ').slice(0, 16), e.email || (e.user_id ? '' : 'زائر'), e.verb, e.object_type, titles.get(String(e.context?.resource_id || e.object_id)) || String(e.object_id), String(e.context?.file_name || '')])] };
}

/** إحصاء سريع لعرضه في الإدارة */
export function resourceStats(rows: Resource[]) {
  const pub = rows.filter(r => r.status === 'published');
  return { total: rows.length, published: pub.length, drafts: rows.filter(r => r.status === 'draft').length, downloads: rows.reduce((a, r) => a + (r.downloads || 0), 0), views: rows.reduce((a, r) => a + (r.views || 0), 0), aiReady: pub.filter(r => r.ai_ready).length };
}
