// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — إشعار الخصوصية الحيّ: يُولَّد من السجل نفسه (لا نصّ منسوخ يتقادم) · عربي/إنجليزي · ونسخة آلية للوكلاء (/.well-known/privacy.json).
 */
import { REGISTRY, PROCESSORS, RIGHTS_AR, CATEGORY_AR, BASIS_AR, POLICY_AR, ACCESS_AR, NOTICE_DRAFT, NOTICE_VERSION, DSR_DAYS, DSR_EXTENSION_DAYS, INCIDENT_HOURS, ERASURE_HOLD_DAYS, personalTables } from './registry';
import type { Category } from './registry';
import { retentionText } from './subject';

export type NoticeOrg = { name: string; legal: string; owner: string; contact: string; site: string };
export function orgFromEnv(env: Record<string, string | undefined> = process.env, site = ''): NoticeOrg {
  const S = (site || env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.vercel.app').replace(/\/$/, '');
  return { name: 'بوابة أَثَر', legal: 'شركة بوابة التميز للاستشارات والتدريب', owner: 'د. أحمد محمد عبدالعزيز بدوي', contact: String(env.DATA_PROTECTION_CONTACT || env.SECURITY_CONTACT || (env.ADMIN_EMAILS || '').split(/[,;\s]+/)[0] || '').trim(), site: S };
}

export function noticeModel(org: NoticeOrg) {
  const cats = (Object.keys(CATEGORY_AR) as Category[]).map(c => ({ id: c, title_ar: CATEGORY_AR[c], items: personalTables().filter(r => r.category === c).map(r => ({ table: r.table, label_ar: r.label_ar, label_en: r.label_en, data_ar: r.data_ar, purpose_ar: r.purpose_ar, basis: r.basis, basis_ar: BASIS_AR[r.basis], retention_ar: retentionText(r), policy_ar: POLICY_AR[r.policy], access_ar: r.access.map(a => ACCESS_AR[a]), legacy: !!r.legacy })) })).filter(c => c.items.length);
  return { version: NOTICE_VERSION, draft: NOTICE_DRAFT, org, categories: cats, processors: PROCESSORS, rights: RIGHTS_AR, timelines: { dsr_days: DSR_DAYS, dsr_extension_days: DSR_EXTENSION_DAYS, incident_hours: INCIDENT_HOURS, erasure_hold_days: ERASURE_HOLD_DAYS }, tables: personalTables().length };
}

/** النسخة الآلية — للوكلاء والجهات: ماذا يُجمع، الأساس، المدة، المعالجون، كيف تُمارَس الحقوق (نقاط النهاية) */
export function privacyJson(org: NoticeOrg) {
  const m = noticeModel(org);
  return {
    '@context': 'https://schema.org', '@type': 'PrivacyPolicy', name: 'Athar Privacy Notice', inLanguage: ['ar', 'en'], version: m.version, status: m.draft ? 'draft-pending-legal-review' : 'published', url: `${org.site}/privacy`, dateModified: m.version,
    controller: { name: org.legal, brand: org.name, owner: org.owner, contact: org.contact || null, jurisdiction: 'SA', law: 'Saudi Personal Data Protection Law (Royal Decree M/19, 2021; amended M/148, 2023) and its Implementing Regulations', regulator: 'SDAIA' },
    timelines: { subject_request_days: m.timelines.dsr_days, extension_days: m.timelines.dsr_extension_days, breach_notification_hours: m.timelines.incident_hours, erasure_hold_days: m.timelines.erasure_hold_days },
    processing: REGISTRY.filter(r => r.policy !== 'none').map(r => ({ id: r.table, name: r.label_en, name_ar: r.label_ar, category: r.category, purpose_ar: r.purpose_ar, data_ar: r.data_ar, legal_basis: r.basis, retention_days: r.retentionDays, retention_policy: r.policy, retention_note_ar: r.retainNote_ar || null, access: r.access })),
    processors: PROCESSORS.map(p => ({ id: p.id, name: p.name, role_ar: p.role, location_ar: p.region_ar, data_ar: p.data_ar, basis: p.basis })),
    ai: { human_in_the_loop: true, personal_identifiers_sent_to_models: false, automated_decisions_without_human_review: false, note_ar: 'الذكاء الاصطناعي يقترح والإنسان يعتمد؛ لا تُرسل أسماء أو بريد إلى النماذج؛ لا قرار يمسّك (قبول/شهادة/مستوى معتمد) بلا بشر.' },
    rights: RIGHTS_AR.map(r => ({ id: r.id, title_ar: r.title, body_ar: r.body })),
    endpoints: { self_service: `${org.site}/me/data`, api: `${org.site}/api/vault`, export: { method: 'POST', url: `${org.site}/api/vault`, body: { action: 'export' }, auth: 'Bearer (user) or delegated token scope wallet:read' }, erase: { method: 'POST', url: `${org.site}/api/vault`, body: { action: 'erase' }, auth: 'Bearer (user only)' }, mcp_tool: 'my_data_summary', security: `${org.site}/.well-known/security.txt` },
  };
}
