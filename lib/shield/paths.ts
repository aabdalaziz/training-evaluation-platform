// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر — الطبقة الثانية (P65): المسارات الإدارية التي تعرض بيانات شخصية (نقي — يُستورد من المتصفح والخادم معًا).
 *  AdminShell يرسل منارة عند فتح أحدها؛ الخادم يتحقّق بالقائمة نفسها. ما ليس هنا لا يُسجَّل.
 */
/** المسارات الإدارية التي تعرض بيانات شخصية (بادئة → عنوان عربي). ما ليس هنا لا يُسجَّل (كتالوجات/إعدادات/تجميعات بلا أسماء). */
export const PII_PATHS: { prefix: string; title_ar: string }[] = [
  { prefix: '/admin/enrollments', title_ar: 'التسجيلات' }, { prefix: '/admin/management', title_ar: 'القاعات والمجموعات' }, { prefix: '/admin/attendance', title_ar: 'الحضور' },
  { prefix: '/admin/placements', title_ar: 'التسكين' }, { prefix: '/admin/payments', title_ar: 'المدفوعات' }, { prefix: '/admin/contracts', title_ar: 'العقود' },
  { prefix: '/admin/consulting', title_ar: 'طلبات الاستشارة' }, { prefix: '/admin/certificates', title_ar: 'الشهادات' }, { prefix: '/admin/awards', title_ar: 'الجوائز' },
  { prefix: '/admin/reports', title_ar: 'التقارير' }, { prefix: '/admin/vault', title_ar: 'خزنة أَثَر' }, { prefix: '/admin/audit', title_ar: 'سجلّ التدقيق' },
  { prefix: '/admin/directory', title_ar: 'دليل المدرّبين' }, { prefix: '/admin/roles', title_ar: 'الأدوار' }, { prefix: '/admin/inbox', title_ar: 'الوارد' },
  { prefix: '/admin/outreach', title_ar: 'التواصل' }, { prefix: '/admin/followup', title_ar: 'المتابعة' }, { prefix: '/admin/impact', title_ar: 'قياس الأثر' },
  { prefix: '/admin/evidence', title_ar: 'الشواهد' }, { prefix: '/admin/miaar', title_ar: 'مِعيار' }, { prefix: '/admin/credentials', title_ar: 'الاعتمادات' },
  { prefix: '/admin/sign', title_ar: 'التوقيع' }, { prefix: '/admin/live', title_ar: 'المراقبة الحيّة' }, { prefix: '/admin/data-lifecycle', title_ar: 'دورة حياة البيانات' },
  { prefix: '/admin/backup', title_ar: 'النسخ الاحتياطي' }, { prefix: '/admin/org', title_ar: 'الجهات' }, { prefix: '/admin/councils', title_ar: 'المجالس' },
  { prefix: '/admin/needs', title_ar: 'الاحتياجات' }, { prefix: '/admin/notifications', title_ar: 'الإشعارات' }, { prefix: '/admin/media', title_ar: 'الوسائط' },
  { prefix: '/admin/observatory', title_ar: 'المرصد' }, { prefix: '/admin/loop', title_ar: 'حلقة الحوار' }, { prefix: '/admin/twin', title_ar: 'التوأم' },
  { prefix: '/admin/missions', title_ar: 'المهمّات' }, { prefix: '/admin/rehearsals', title_ar: 'البروفات' }, { prefix: '/admin/onair', title_ar: 'على الهواء' },
  { prefix: '/admin/skills', title_ar: 'المهارات' }, { prefix: '/admin/inclusion', title_ar: 'الشمول' }, { prefix: '/admin/health', title_ar: 'صحّة البرامج' },
  { prefix: '/admin/readiness', title_ar: 'الجاهزية' }, { prefix: '/admin/accreditation', title_ar: 'الاعتماد' }, { prefix: '/admin/after', title_ar: 'ما بعد البرنامج' },
  { prefix: '/admin/agents', title_ar: 'الوكلاء' }, { prefix: '/admin/access', title_ar: 'الوصول' }, { prefix: '/admin/shield', title_ar: 'درع أَثَر' },
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** مسار نظيف: بلا استعلام/علامة، معرّفات UUID وأرقام → :id، بحدّ 200 حرف */
export function normalizePath(p: string): string {
  const base = String(p || '/').split(/[?#]/)[0].replace(UUID, ':id').replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/+$/, '') || '/';
  return base.slice(0, 200);
}
export function piiPathTitle(p: string): string | null {
  const n = normalizePath(p); const hit = PII_PATHS.find(x => n === x.prefix || n.startsWith(x.prefix + '/'));
  return hit ? hit.title_ar : null;
}
export const isPiiPath = (p: string) => piiPathTitle(p) !== null;
