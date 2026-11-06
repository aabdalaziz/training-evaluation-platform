// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «غُرَف مركز قيادة أَثَر» (P43-ب «أَثَر الواحد»)
 *  خريطة واحدة لكل الصفحات الإدارية القديمة (/dashboard · /admin/* · /reports/* · /command-center · /help):
 *  الاسم، التلميح، الأيقونة، والصلاحية التي تفتحها — فتُبنى منها قائمة الشريط العلوي، وقائمة لوحة القيادة الجانبية،
 *  وعنوان الغرفة في غلاف AdminShell، وحارس «هذه الغرفة ليست من أبوابك».
 *  الصلاحيات هي صلاحيات الأدوار في lib/portal/roles.ts (permissions) كما يعيدها GET /api/roles:
 *   · 'admin' = مدير النظام فقط ('*') · 'staff' = أي صفة طاقم · غير ذلك = أي صلاحية من القائمة (ns.action أو ns.*).
 *  هذا الملف خالٍ من أي اعتماد خادمي ليُستورد من المتصفح.
 */
import type { IconName } from '../ui/icons';

export type RoomPerm = 'admin' | 'staff' | string;
export type Room = {
  href: string; label: string; hint: string; icon: IconName;
  /** أيّ واحدة تكفي */ perms: RoomPerm[];
  /** في الشريط العلوي لمركز القيادة */ nav?: boolean;
  /** في قائمة لوحة القيادة الجانبية */ side?: boolean;
  /** مطابقة المسار (افتراضيًا: يبدأ بـ href) */ match?: (p: string) => boolean;
};

export const ROOMS: Room[] = [
  { href: '/dashboard', label: 'لوحة القيادة', hint: 'المؤشرات والقرارات', icon: 'dashboard', perms: ['staff'], nav: true },
  { href: '/command-center', label: 'غرفة القيادة', hint: 'شاشة عرض حية · تحديث تلقائي', icon: 'play', perms: ['reports.read', 'sessions.write'], nav: true, side: true },
  { href: '/admin/management', label: 'مركز الإدارة', hint: 'المدربون · القاعات · المستويات', icon: 'admin', perms: ['programs.write'], nav: true, side: true, match: p => p.startsWith('/admin/management') || p.startsWith('/admin/survey-settings') },
  { href: '/admin/attendance', label: 'الحضور الرقمي', hint: 'جلسات QR · نسب الحضور', icon: 'check', perms: ['attendance.write', 'programs.write'], nav: true, side: true },
  { href: '/admin/followup', label: 'نقل أثر التدريب', hint: 'متابعة المشرف والمتدرب بعد 60–90 يومًا', icon: 'trend', perms: ['impact.read', 'evidence.write', 'programs.write'], nav: true, side: true, match: p => p.startsWith('/admin/followup') || p.startsWith('/reports/transfer') },
  { href: '/reports/center', label: 'مركز التقارير', hint: 'تنفيذية · تشغيلية · تحليلية', icon: 'reports', perms: ['reports.read'], nav: true, side: true },
  { href: '/reports', label: 'اللوحة التحليلية', hint: 'المؤشرات التحليلية', icon: 'chart', perms: ['reports.read'], nav: true, match: p => p === '/reports' || p.startsWith('/reports/executive') },
  { href: '/reports/remote-survey', label: 'استطلاع التعلم عن بُعد', hint: 'استجابات المتعلّمين عن بُعد', icon: 'laptop', perms: ['evidence.write', 'programs.write'], nav: true, side: true },
  { href: '/admin/payments', label: 'المالية', hint: 'الفواتير · المدفوعات · المتأخرات', icon: 'scale', perms: ['payments.write', 'invoices.write'] },
  { href: '/admin/miaar/rating', label: 'غرفة التصحيح', hint: 'أداءات الكتابة والتحدّث — يقرؤها إنسان', icon: 'edit', perms: ['miaar.rate', 'miaar.write'] }, /* م4-ج: باب المصحّح وحده — قبل /admin/miaar لأن roomFor يأخذ أوّل مطابقة */
  { href: '/admin/miaar', label: 'إدارة مِعيار', hint: 'البنك · النماذج · الدعوات', icon: 'target', perms: ['miaar.write', 'miaar.bank.write', 'miaar.forms.write'] },
  { href: '/admin/roles', label: 'الأدوار والدعوات', hint: 'باب واحد لكل صفة · للطاقم قراءة وللمدير كتابة', icon: 'users', perms: ['staff'] },
  { href: '/admin/directory', label: 'هيئة أَثَر', hint: 'اعتماد السير · المدرّبون والخبراء', icon: 'users', perms: ['invites.write'] },
  { href: '/admin/enrollments', label: 'طلبات التسجيل والمدفوعات', hint: 'طلبات التسجيل · المدفوعات · نشر البرامج · رسائل التواصل', icon: 'globe', perms: ['enrollments.write', 'payments.write'], side: true },
  { href: '/admin/notifications', label: 'مركز الإشعارات', hint: 'تنبيهات الجودة التلقائية', icon: 'bell', perms: ['staff'], side: true },
  { href: '/admin/certificates', label: 'الشهادات الإلكترونية', hint: 'إصدار · تحقق QR · إرسال', icon: 'certificate', perms: ['credentials.write', 'programs.write'], side: true },
  { href: '/admin/awards', label: 'تكريم المدربين', hint: 'لوحة الشرف الشهرية', icon: 'award', perms: ['programs.write'], side: true },
  { href: '/admin/impact', label: 'قياس أثر التدريب', hint: 'قبلي / بعدي · الكسب المعياري', icon: 'target', perms: ['impact.read', 'evidence.write', 'programs.write'], side: true },
  { href: '/admin/outcomes', label: 'مؤشرات النتائج', hint: 'المستوى 4 · خط أساس ومستهدف', icon: 'flag', perms: ['impact.read', 'evidence.write', 'programs.write'], side: true },
  { href: '/reports/chain', label: 'سلسلة الأثر 1→4', hint: 'كيركباتريك في صفحة واحدة', icon: 'trend', perms: ['reports.read'], side: true },
  { href: '/reports/program', label: 'بطاقة البرنامج الشاملة', hint: 'صفحة واحدة لصانع القرار · PDF · Excel', icon: 'doc', perms: ['reports.read'], side: true },
  { href: '/reports/cohorts', label: 'الذكاء التحليلي', hint: 'الدفعات · عدالة المدربين · ملخص ذكي', icon: 'scale', perms: ['reports.read'], side: true },
  { href: '/admin/audit', label: 'سجلّ التدقيق', hint: 'من فعل ماذا ومتى · تتبّع تلقائي', icon: 'shield', perms: ['admin'], side: true },
  { href: '/admin/health', label: 'صحة المنصة', hint: 'الإعدادات · الكرون · البريد · سلامة البيانات', icon: 'check', perms: ['admin'], side: true },
  { href: '/admin/access', label: 'نطاق الوصول', hint: 'ربط مديري البرامج ببرامجهم', icon: 'users', perms: ['admin'], side: true },
  { href: '/admin/templates', label: 'قوالب التقييم', hint: 'الأسئلة · الربط بالبرامج · معاينة', icon: 'doc', perms: ['programs.write', 'evidence.write'], side: true },
  { href: '/admin/readiness', label: 'جاهزية البرنامج', hint: 'قائمة تحقق من الإعداد حتى الإغلاق', icon: 'compass', perms: ['programs.write'], side: true },
  { href: '/help', label: 'دليل مركز القيادة', hint: 'رحلة البرنامج · أسئلة شائعة', icon: 'question', perms: ['staff'], side: true },
  { href: '/admin/backup', label: 'النسخ الاحتياطي والأرشفة', hint: 'تصدير شامل Excel/JSON وأرشفة البرامج', icon: 'save', perms: ['admin'], side: true },
  { href: '/admin/data-lifecycle', label: 'دورة حياة البيانات', hint: 'معاينة وتفريغ منضبط', icon: 'trash', perms: ['admin'], nav: true, side: true },
  /* غُرَف تُفتح من أبوابها (hub) أو من روابطها — تُعرف هنا للعنوان والحارس فقط */
  { href: '/admin/sign', label: 'توقيعي', hint: 'ما ينتظر توقيعي — سجلّ التوقيعات المعلّقة', icon: 'check', perms: ['staff', 'sessions.host', 'reports.read', 'programs.write', 'enrollments.write', 'payments.write', 'evidence.write', 'consulting.write'] }, /* P50 */
  { href: '/admin/inbox', label: 'الوارد', hint: 'رسائل الزوّار والطلبات', icon: 'inbox', perms: ['inbox.write'] },
  { href: '/admin/placements', label: 'التسكين', hint: 'الشُّعب والقاعات', icon: 'school', perms: ['placements.write'] },
  { href: '/admin/contracts', label: 'عقود الأثر', hint: 'العقود والعهود', icon: 'doc', perms: ['contracts.read'] },
  { href: '/admin/org/letters', label: 'رسالة الشهر', hint: 'التقرير الشهري لأثر الجهة — سطرك وتوقيعك قبل الإرسال', icon: 'mail', perms: ['staff', 'programs.write', 'reports.read', 'contracts.read'] }, /* P52 */
  { href: '/admin/consulting', label: 'الاستشارات', hint: 'الطلبات والعروض', icon: 'chat', perms: ['consulting.write'] },
  { href: '/admin/evidence', label: 'قاعدة الأدلة', hint: 'الاستعلامات والشواهد', icon: 'folder', perms: ['evidence.write'] },
  { href: '/admin/observatory', label: 'مرصد القدرة البشرية', hint: 'مؤشرات القطاعات', icon: 'globe', perms: ['observatory.read'] },
  { href: '/admin/inclusion', label: 'أَثَر للجميع', hint: 'الوصول والعوائق', icon: 'users', perms: ['inclusion.write'] },
  { href: '/admin/loop', label: 'التحسين المستمر', hint: 'الحلقة بالأدلة', icon: 'refresh', perms: ['loop.write'] },
  { href: '/admin/credentials', label: 'الشهادات الرقمية', hint: 'الإصدار والتحقق', icon: 'certificate', perms: ['credentials.write'] },
  { href: '/admin/live', label: 'البث المباشر', hint: 'القنوات والجلسات', icon: 'play', perms: ['sessions.write'] },
  { href: '/final-analysis', label: 'التحليل الختامي', hint: 'نتائج التقييم الختامي', icon: 'flag', perms: ['reports.read'] },
  { href: '/admin/sector-impact', label: 'تقارير الأثر القطاعية', hint: 'بحسب القطاع والمهارة', icon: 'chart', perms: ['impact.read', 'reports.read'] },
  /* غُرَف لا تظهر في الشريط ولا في القائمة الجانبية — تُفتح من ألسنة الصفحات (PortalAdminTabs) والبحث؛ صلاحياتها بحسب من يعمل فيها */
  { href: '/admin/resources', label: 'الحقائب التدريبية', hint: 'الحقائب والملفات', icon: 'folder', perms: ['programs.write', 'sessions.write', 'sessions.host'] },
  { href: '/admin/skills', label: 'المهارات والجهات', hint: 'إطار المهارات وجهات الاعتماد', icon: 'target', perms: ['programs.write', 'credentials.write'] },
  { href: '/admin/catalog', label: 'نشر البرامج', hint: 'الكتالوج العام', icon: 'globe', perms: ['programs.write'] },
  { href: '/admin/sim', label: 'المحاكيات وأثير', hint: 'السيناريوهات والصوت', icon: 'play', perms: ['programs.write', 'sessions.write'] },
  { href: '/admin/twin', label: 'توأم المؤسسة', hint: 'النموذج الحي للمؤسسة', icon: 'star', perms: ['reports.read', 'observatory.read'] },
  { href: '/admin/missions', label: 'مهمات العمل', hint: 'المهمات الميدانية', icon: 'flag', perms: ['programs.write', 'enrollments.write'] },
  { href: '/admin/onair', label: 'أَثَر معك', hint: 'الخبراء على الهواء', icon: 'chat', perms: ['onair.answer', 'programs.write', 'invites.write'] },
  { href: '/admin/after', label: 'أثر بعد البرنامج', hint: 'ما بعد التدريب', icon: 'certificate', perms: ['programs.write', 'impact.read'] },
  { href: '/admin/needs', label: 'الاحتياج المعلَن', hint: 'البرنامج الذي لم يُكتب بعد', icon: 'spark', perms: ['programs.write'] },
  { href: '/admin/rehearsals', label: 'البروفات', hint: 'التمرين التبادلي بين الممارسين', icon: 'users', perms: ['programs.write'] },
  { href: '/admin/reports', label: 'التقارير', hint: 'محور التقارير — توثيق الجودة والأداء', icon: 'doc', perms: ['programs.write'] },
  { href: '/admin/program-engineering', label: 'هندسة البرامج التدريبية', hint: 'تصميم البرامج', icon: 'compass', perms: ['programs.write'], match: p => p.startsWith('/admin/program-engineering') || p.startsWith('/admin/factory') },
  { href: '/admin/media', label: 'الأداء المُشاهَد', hint: 'الوسائط والمشاهدات', icon: 'play', perms: ['programs.write', 'sessions.write', 'evidence.write'] },
  { href: '/admin/councils', label: 'مجالس أَثَر', hint: 'المجالس ودوراتها', icon: 'users', perms: ['councils.chair', 'programs.write'] },
  { href: '/admin/outreach', label: 'الإبلاغ متعدد القنوات', hint: 'الرسائل والقنوات', icon: 'send', perms: ['admin'] },
  { href: '/admin/agents', label: 'الوكلاء المفوَّضون', hint: 'وكلاء الذكاء الاصطناعي', icon: 'users', perms: ['admin'] },
  { href: '/admin/shield', label: 'درع أَثَر', hint: 'الحماية والحدود', icon: 'shield', perms: ['admin'] },
  { href: '/admin/vault', label: 'خزنة أَثَر', hint: 'البيانات الشخصية وسجلّ المعالجة', icon: 'folder', perms: ['admin'] },
];

/** هل تفتح صلاحياتي هذه الغرفة؟ perms: صلاحياتي المجمّعة من /api/roles ('*' لمدير النظام) · staff: أنا طاقم */
export function canOpen(room: Pick<Room, 'perms'>, perms: string[], staff: boolean): boolean {
  if (perms.includes('*')) return true;
  for (const p of room.perms) {
    if (p === 'admin') continue;
    if (p === 'staff') { if (staff) return true; continue; }
    if (perms.includes(p)) return true;
    const ns = p.split('.')[0]; if (perms.includes(`${ns}.*`)) return true;
  }
  return false;
}

export const roomFor = (pathname: string): Room | undefined =>
  ROOMS.find(r => (r.match ? r.match(pathname) : pathname === r.href || pathname.startsWith(r.href + '/'))) ||
  /* /reports وحدها تطابق بالمساواة أعلاه؛ المسارات الفرعية غير المعرَّفة تعود إليها */
  (pathname.startsWith('/reports/') ? ROOMS.find(r => r.href === '/reports') : undefined);

/** غرفة «اختصاص»: تُفتح لي بصلاحية مسمّاة (لا بمجرد كوني طاقمًا) — هي ما يميّز دوري */
const specialty = (r: Room, perms: string[]) => r.perms.some(p => p !== 'admin' && p !== 'staff' && (perms.includes(p) || perms.includes(`${p.split('.')[0]}.*`)));

/**
 * قائمة الشريط العلوي:
 *  · مدير النظام (*) أو قبل قراءة الصلاحيات → غُرَف nav كما كانت.
 *  · غيره → غُرَف nav المفتوحة له، وإن قلّت عن 6 تُكمَّل أولًا بغُرَف اختصاصه (المدير المالي يرى «المالية» في شريطه لا «نقل الأثر»)
 *    ثم ببقية غُرَفه حتى 6.
 */
export function navRooms(perms: string[] | null, staff: boolean): Room[] {
  if (!perms || perms.includes('*')) return ROOMS.filter(r => r.nav);
  const mine = ROOMS.filter(r => (r.nav || r.side || specialty(r, perms)) && canOpen(r, perms, staff));
  const top = mine.filter(r => r.nav);
  if (top.length >= 6) return top;
  const rest = mine.filter(r => !r.nav);
  const extra = [...rest.filter(r => specialty(r, perms)), ...rest.filter(r => !specialty(r, perms))].slice(0, 6 - top.length);
  return [...top, ...extra];
}

/** قائمة لوحة القيادة الجانبية (قسم «الإدارة») */
export const sideRooms = (perms: string[] | null, staff: boolean): Room[] =>
  ROOMS.filter(r => r.side && (!perms || canOpen(r, perms, staff)));
