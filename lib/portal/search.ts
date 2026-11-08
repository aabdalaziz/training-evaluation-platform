// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «دليل أَثَر» (P41) — البحث في كل صفحة: المنطق الخالص (بلا React وبلا قاعدة بيانات) حتى يُختبر وحده.
 *  · normalizeAr: تطبيع عربي (همزات/تاء مربوطة/ألف مقصورة/تشكيل/تطويل/أرقام هندية) + لاتيني صغير.
 *  · ROUTES: فهرس الصفحات بأسمائها الرسمية ومرادفاتها (السردية والقديمة) — فوري في المتصفح بلا خادم.
 *  · COMMANDS: أوامر تُنفَّذ مباشرة من اللوحة (بدّل اللغة · انسخ الرابط · اطبع …).
 *  · parseIntent: رموز معروفة (ML-… نتيجة مِعيار · AR-… بند بنك · بريد · سؤال؟) → وجهة مباشرة.
 *  · rank: ترتيب بالتطابق (بداية الكلمة > احتواء > مرادف) ثم «ذاكرة» آخر ما فُتح.
 */
export type Lang = 'ar' | 'en';
export type Need = 'guest' | 'user' | 'staff';
export type Group = 'page' | 'me' | 'admin' | 'command' | 'program' | 'resource' | 'person' | 'sim' | 'session' | 'credential' | 'result' | 'org' | 'invite' | 'item' | 'trainee' | 'answer';
export type Entry = { id: string; href: string; ar: string; en: string; syn?: string[]; group: Group; need?: Need; hint?: { ar: string; en: string } };
export type Hit = Entry & { score: number };

const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const AR_DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
export function normalizeAr(s: string): string {
  return String(s || '').toLowerCase().replace(TASHKEEL, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩۰-۹]/g, d => AR_DIGITS[d] || d).replace(/^(ال)/, '').replace(/[^\p{L}\p{N}@?؟._\-\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
/** يكسر الاستعلام إلى كلمات، ويحذف «ال» التعريف من بداية كل كلمة حتى يتطابق «المعيار» مع «مِعيار» */
export function tokens(q: string): string[] { return normalizeAr(q).split(' ').map(w => w.replace(/^ال/, '')).filter(w => w.length >= 2 || /^\d+$/.test(w)); }

/* ---------- الفهرس الثابت: الصفحات (الأسماء الرسمية + المرادفات السردية/القديمة) ---------- */
const P = (id: string, href: string, ar: string, en: string, syn: string[] = [], need?: Need, group: Group = 'page'): Entry => ({ id, href, ar, en, syn, group, need });
export const ROUTES: Entry[] = [
  P('home', '/', 'الصفحة الرئيسية', 'Home', ['الرئيسية', 'home', 'athar', 'اثر', 'بوابة']),
  P('programs', '/programs', 'البرامج والدبلومات', 'Programs & diplomas', ['دورات', 'دبلوم', 'تسجيل', 'courses', 'catalog', 'برنامج']),
  P('services', '/services', 'الخدمات', 'Services', ['trace', 'خدماتنا', 'استشارات', 'حقائب']),
  P('arabic', '/services/arabic', 'تعليم العربية للناطقين بغيرها', 'Arabic for non-native speakers', ['عربية', 'arabic', 'ناطقين']),
  P('resources', '/resources', 'مستودع الحقائب التدريبية', 'Training resources library', ['حقيبة', 'مواد', 'library', 'resources', 'مستودع']),
  P('consulting', '/consulting', 'الاستشارات', 'Consulting', ['استشارة', 'مستشار', 'consulting']),
  P('live', '/live', 'البث المباشر والجلسات', 'Live sessions', ['جلسة', 'ندوة', 'بث', 'webinar', 'zoom', 'teams', 'meet', 'مباشر']),
  P('sim', '/sim', 'المحاكيات', 'Simulations', ['محاكي', 'سيناريو', 'تدريب عملي', 'simulation', 'الميسر']),
  P('councils', '/councils', 'مجالس أَثَر', 'Athar councils', ['مجلس', 'council', 'زملاء']),
  P('onair', '/on-air', 'أَثَر معك — على الهواء', 'Athar with you — on air', ['على الهواء', 'on air', 'مساعد', 'دعم', 'مستشار', 'امانة']),
  P('onair-week', '/on-air/week', 'سؤال الأسبوع', 'Question of the week', ['اسبوع', 'week'], undefined),
  P('onair-seasons', '/on-air/seasons', 'مواسم أَثَر معك', 'On-air seasons', ['موسم', 'season']),
  P('miaar', '/miaar', 'مِعيار — حدّد مستواك في اللغة العربية', 'Miaar — Arabic placement test', ['معيار', 'miaar', 'اختبار', 'تحديد المستوى', 'placement', 'cefr', 'مستواك', 'a1', 'c2']),
  P('miaar-trust', '/miaar/trust', 'مِعيار — سجلّ الصدق (موثوقية كل مستوى)', 'Miaar — trust ledger (reliability per level)', ['صدق', 'موثوقية', 'trust', 'reliability', 'معيار']),
  P('experts', '/experts', 'هيئة أَثَر — الخبراء', 'Athar faculty — experts', ['خبير', 'expert', 'هيئة']),
  P('trainers', '/trainers', 'هيئة أَثَر — المدرّبون', 'Athar faculty — trainers', ['مدرب', 'trainer', 'هيئة', 'سيرة']),
  P('org', '/org', 'بوابة الجهات والمؤسسات', 'Organizations portal', ['مؤسسة', 'جهة', 'منظمة', 'org', 'organization', 'شركة', 'جامعة']),
  P('verify', '/verify', 'التحقق من شهادة', 'Verify a credential', ['تحقق', 'شهادة', 'verify', 'qr', 'رمز']),
  P('ai', '/ai', 'الذكاء الاصطناعي المسؤول', 'Responsible AI', ['ai', 'ذكاء', 'اثير', 'athir', 'gemini']),
  P('agents', '/agents', 'أَثَر للوكلاء — المكتب الزجاجي', 'Athar for agents', ['وكيل', 'agent', 'mcp', 'api']),
  P('security', '/security', 'درع أَثَر — الأمن والإفصاح المسؤول', 'Athar Shield — security', ['امن', 'security', 'درع', 'ثغرة', 'خصوصية']),
  P('accessibility', '/accessibility', 'أَثَر للجميع — بيان الوصول', 'Athar for all — accessibility', ['وصول', 'accessibility', 'wcag', 'تباين', 'قارئ الشاشة', 'ذوي الاعاقة']),
  P('help', '/help', 'دليل مركز القيادة والأسئلة الشائعة', 'Command center guide & FAQ', ['مساعدة', 'help', 'faq', 'كيف', 'سؤال']),
  P('contact', '/contact', 'تواصل معنا', 'Contact us', ['تواصل', 'اتصال', 'contact', 'بريد', 'واتساب', 'هاتف']),
  P('about', '/about', 'عن أَثَر', 'About Athar', ['عن', 'about', 'من نحن', 'رؤية']),
  P('2062', '/2062', 'أَثَر 2062 — الأفق', 'Athar 2062 — the horizon', ['2062', 'مستقبل', 'رؤية', 'horizon']),
  P('observatory', '/observatory', 'مرصد القدرة البشرية', 'Human capability observatory', ['مرصد', 'observatory', 'مؤشر', 'قطاع']),
  P('privacy', '/privacy', 'الخصوصية', 'Privacy', ['خصوصية', 'privacy', 'pdpl', 'بيانات']),
  P('login', '/login', 'تسجيل الدخول', 'Sign in', ['دخول', 'login', 'sign in', 'حساب']),
  P('student', '/student', 'بوابة المتدرّب', 'Trainee portal', ['متدرب', 'طالب', 'student', 'trainee']),
  /* ---- حسابي ---- */
  P('me', '/me', 'حسابي — بوابة المشارك', 'My account', ['حسابي', 'ملفي', 'me', 'profile', 'مشارك'], 'user', 'me'),
  P('me-skills', '/me/skills', 'ملفي المهاري', 'My skills profile', ['مهارات', 'skills', 'مستوى'], 'user', 'me'),
  P('me-twin', '/me/twin', 'توأمي المهاري', 'My skills twin', ['توام', 'twin'], 'user', 'me'),
  P('me-journey', '/me/journey', 'رحلتي', 'My journey', ['رحلة', 'journey', 'مسار'], 'user', 'me'),
  P('me-map', '/me/map', 'خريطتي', 'My map', ['خريطة', 'map'], 'user', 'me'),
  P('me-card', '/me/card', 'بطاقتي', 'My card', ['بطاقة', 'card', 'محفظة', 'wallet'], 'user', 'me'),
  P('me-missions', '/me/missions', 'مهماتي من قلب العمل', 'My workflow missions', ['مهمة', 'mission', 'عمل'], 'user', 'me'),
  P('me-council', '/me/council', 'مجلسي', 'My council', ['مجلس', 'council'], 'user', 'me'),
  P('me-after', '/me/after', 'أثر بعد البرنامج', 'After the program', ['بعد', 'after', 'محطات'], 'user', 'me'),
  P('me-data', '/me/data', 'بياناتي وحقوقي', 'My data & rights', ['بيانات', 'data', 'حذف', 'تصدير', 'pdpl'], 'user', 'me'),
  P('me-access', '/me/access', 'تفضيلات الوصول', 'Access preferences', ['وصول', 'access', 'تباين', 'خط'], 'user', 'me'),
  P('me-horizon', '/me/horizon', 'أفقي', 'My horizon', ['افق', 'horizon', 'عهد'], 'user', 'me'),
  P('me-directory', '/me/directory', 'سيرتي في هيئة أَثَر', 'My faculty CV', ['سيرة', 'cv', 'هيئة', 'خبير', 'مدرب'], 'user', 'me'),
  P('me-agents', '/me/agents', 'وكلائي المفوَّضون', 'My delegated agents', ['وكيل', 'agent', 'مفتاح'], 'user', 'me'),
  P('me-onair', '/me/onair', 'أَثَر معك — طلباتي', 'On air — my requests', ['طلب', 'مساعد', 'on air'], 'user', 'me'),
  P('me-pair', '/me/pair', 'شريكي', 'My pair', ['شريك', 'pair', 'زميل'], 'user', 'me'),
  /* ---- الإدارة (للطاقم) ---- */
  P('dashboard', '/dashboard', 'لوحة القيادة', 'Dashboard', ['لوحة التحكم', 'dashboard', 'ادارة', 'admin'], 'staff', 'admin'),
  P('command-center', '/command-center', 'غرفة القيادة', 'Command center', ['غرفة', 'قيادة'], 'staff', 'admin'),
  P('admin-management', '/admin/management', 'مركز الإدارة', 'Management center', ['ادارة', 'برامج', 'مدربون', 'قاعات'], 'staff', 'admin'),
  P('admin-attendance', '/admin/attendance', 'الحضور', 'Attendance', ['حضور', 'غياب', 'attendance'], 'staff', 'admin'),
  P('admin-followup', '/admin/followup', 'نقل الأثر', 'Transfer follow-up', ['متابعة', 'نقل', 'followup'], 'staff', 'admin'),
  P('reports-center', '/reports/center', 'مركز التقارير', 'Reports center', ['تقرير', 'reports', 'تحليل'], 'staff', 'admin'),
  P('reports', '/reports', 'اللوحة التحليلية', 'Analytics', ['تحليلات', 'analytics', 'مؤشر الاداء'], 'staff', 'admin'),
  P('reports-remote', '/reports/remote-survey', 'استطلاع عن بُعد', 'Remote survey', ['استطلاع', 'survey'], 'staff', 'admin'),
  P('admin-lifecycle', '/admin/data-lifecycle', 'دورة حياة البيانات', 'Data lifecycle', ['حذف', 'احتفاظ', 'retention'], 'staff', 'admin'),
  P('admin-enrollments', '/admin/enrollments', 'طلبات التسجيل', 'Enrollment requests', ['تسجيل', 'قبول', 'enroll'], 'staff', 'admin'),
  P('admin-payments', '/admin/payments', 'المدفوعات', 'Payments', ['دفع', 'فاتورة', 'payment', 'invoice', 'مالي'], 'staff', 'admin'),
  P('admin-consulting', '/admin/consulting', 'طلبات الاستشارات', 'Consulting requests', ['استشارة'], 'staff', 'admin'),
  P('admin-live', '/admin/live', 'إدارة البث المباشر', 'Live admin', ['جلسة', 'بث', 'غرفة'], 'staff', 'admin'),
  P('admin-resources', '/admin/resources', 'إدارة الحقائب', 'Resources admin', ['حقيبة', 'نشر'], 'staff', 'admin'),
  P('admin-skills', '/admin/skills', 'المهارات والجهات', 'Skills & organizations', ['مهارة', 'جهة', 'مؤسسة', 'sdaia', 'saqf'], 'staff', 'admin'),
  P('admin-placements', '/admin/placements', 'التسكين', 'Placements', ['تسكين', 'شعبة', 'مجموعة'], 'staff', 'admin'),
  P('admin-miaar', '/admin/miaar', 'إدارة مِعيار', 'Miaar admin', ['معيار', 'اختبار', 'بنك', 'placement'], 'staff', 'admin'),
  P('admin-miaar-bank', '/admin/miaar/bank', 'مِعيار — بنك البنود', 'Miaar — item bank', ['بنك', 'بند', 'سؤال', 'bank', 'cefr'], 'staff', 'admin'),
  P('admin-miaar-forms', '/admin/miaar/forms', 'مِعيار — النماذج والأبواب', 'Miaar — forms & doors', ['نموذج', 'باب', 'blueprint', 'form'], 'staff', 'admin'),
  P('admin-miaar-invites', '/admin/miaar/invites', 'مِعيار — الدعوات وQR', 'Miaar — invitations & QR', ['دعوة', 'qr', 'invite', 'رابط'], 'staff', 'admin'),
  P('admin-miaar-balance', '/admin/miaar/balance', 'مِعيار — الميزان (تحليل البنود والموثوقية والمعايرة)', 'Miaar — balance (item analysis, reliability, calibration)', ['ميزان', 'موثوقية', 'معايرة', 'raش', 'rasch', 'reliability', 'تحليل البنود'], 'staff', 'admin'),
  P('admin-credentials', '/admin/credentials', 'الشهادات الرقمية', 'Digital credentials', ['شهادة', 'credential', 'vc'], 'staff', 'admin'),
  P('admin-sector-impact', '/admin/sector-impact', 'تقارير الأثر', 'Impact reports', ['اثر', 'قطاع'], 'staff', 'admin'),
  P('admin-catalog', '/admin/catalog', 'نشر البرامج', 'Publish programs', ['نشر', 'برنامج', 'catalog'], 'staff', 'admin'),
  P('admin-inbox', '/admin/inbox', 'رسائل التواصل', 'Contact inbox', ['رسالة', 'inbox', 'تواصل'], 'staff', 'admin'),
  P('admin-sim', '/admin/sim', 'المحاكيات وأثير', 'Simulations & Athir', ['محاكي', 'اثير', 'سيناريو'], 'staff', 'admin'),
  P('admin-twin', '/admin/twin', 'توأم المؤسسة', 'Organization twin', ['توام', 'twin'], 'staff', 'admin'),
  P('admin-missions', '/admin/missions', 'مهمات العمل', 'Workflow missions', ['مهمة'], 'staff', 'admin'),
  P('admin-directory', '/admin/directory', 'هيئة أَثَر — الاعتماد', 'Faculty — approvals', ['هيئة', 'خبير', 'مدرب', 'سيرة', 'اعتماد'], 'staff', 'admin'),
  P('admin-inclusion', '/admin/inclusion', 'أَثَر للجميع — البلاغات', 'Accessibility reports', ['وصول', 'عائق', 'wcag'], 'staff', 'admin'),
  P('admin-onair', '/admin/onair', 'أَثَر معك — الإدارة', 'On air — admin', ['على الهواء', 'مساعد', 'امانة'], 'staff', 'admin'),
  P('admin-after', '/admin/after', 'أثر بعد البرنامج', 'After the program', ['محطات', 'بعد'], 'staff', 'admin'),
  P('admin-contracts', '/admin/contracts', 'عقود الأثر', 'Impact contracts', ['عقد', 'contract'], 'staff', 'admin'),
  P('admin-pe', '/admin/program-engineering', 'هندسة البرامج التدريبية', 'Training program engineering', ['هندسة', 'مصنع', 'تصميم برنامج', 'مسودة'], 'staff', 'admin'),
  P('admin-media', '/admin/media', 'الأداء المُشاهَد', 'Observed performance', ['فيديو', 'صوت', 'media'], 'staff', 'admin'),
  P('admin-evidence', '/admin/evidence', 'قاعدة الأدلة', 'Evidence base', ['دليل', 'evidence', 'بحث'], 'staff', 'admin'),
  P('admin-agents', '/admin/agents', 'الوكلاء المفوَّضون', 'Delegated agents', ['وكيل', 'mcp', 'oauth'], 'staff', 'admin'),
  P('admin-loop', '/admin/loop', 'التحسين المستمر بالأدلة', 'Evidence-driven improvement', ['تحسين', 'loop', 'اقتراح'], 'staff', 'admin'),
  P('admin-outreach', '/admin/outreach', 'الإبلاغ متعدد القنوات', 'Multi-channel outreach', ['واتساب', 'بريد', 'اشعار', 'whatsapp'], 'staff', 'admin'),
  P('admin-observatory', '/admin/observatory', 'مرصد القدرة البشرية — الإدارة', 'Observatory admin', ['مرصد', 'قطاع'], 'staff', 'admin'),
  P('admin-roles', '/admin/roles', 'الأدوار والدعوات', 'Roles & invitations', ['دور', 'ادوار', 'دعوة', 'صلاحيات', 'roles', 'invite'], 'staff', 'admin'),
  P('hub', '/hub', 'أبوابي', 'My doors', ['باب', 'ابواب', 'hub', 'ادواري'], 'user'),
  P('admin-shield', '/admin/shield', 'درع أَثَر', 'Athar Shield', ['امن', 'حوادث', 'معدل', 'csp'], 'staff', 'admin'),
  P('admin-vault', '/admin/vault', 'خزنة أَثَر', 'Athar Vault', ['خزنة', 'بيانات شخصية', 'dsr', 'pdpl', 'حذف'], 'staff', 'admin'),
  P('admin-councils', '/admin/councils', 'مجالس أَثَر — الإدارة', 'Councils admin', ['مجلس'], 'staff', 'admin'),
  P('admin-health', '/admin/health', 'صحة النظام', 'System health', ['صحة', 'health', 'نسخ احتياطي'], 'staff', 'admin'),
  P('admin-backup', '/admin/backup', 'النسخ الاحتياطي', 'Backup', ['نسخة', 'backup'], 'staff', 'admin'),
  P('admin-audit', '/admin/audit', 'سجلّ التدقيق', 'Audit log', ['تدقيق', 'audit', 'سجل'], 'staff', 'admin'),
  P('admin-certificates', '/admin/certificates', 'شهادات الحضور والإتمام', 'Attendance certificates', ['شهادة', 'طباعة'], 'staff', 'admin'),
  P('admin-templates', '/admin/templates', 'القوالب', 'Templates', ['قالب', 'template'], 'staff', 'admin'),
  P('admin-notifications', '/admin/notifications', 'الإشعارات', 'Notifications', ['اشعار', 'تنبيه'], 'staff', 'admin'),
  P('admin-impact', '/admin/impact', 'قياس الأثر', 'Impact measurement', ['اثر', 'قياس', 'kirkpatrick'], 'staff', 'admin'),
  P('admin-outcomes', '/admin/outcomes', 'مؤشرات النتائج', 'Outcome KPIs', ['مؤشر', 'kpi', 'نتائج'], 'staff', 'admin'),
  P('admin-readiness', '/admin/readiness', 'الجاهزية', 'Readiness', ['جاهزية'], 'staff', 'admin'),
  P('admin-pulse', '/admin/pulse', 'نبض البيئة التدريبية', 'Training-environment pulse', ['نبض', 'استبيان', 'بند الأسبوع', 'pulse'], 'staff', 'admin'),
  P('admin-awards', '/admin/awards', 'تكريم المدرّبين', 'Trainer awards', ['تكريم', 'جائزة'], 'staff', 'admin'),
  P('admin-factory', '/admin/factory', 'مسودّات البرامج', 'Program drafts', ['مسودة', 'هندسة'], 'staff', 'admin'),
  P('admin-access', '/admin/access', 'تفضيلات الوصول — الإدارة', 'Access admin', ['وصول'], 'staff', 'admin'),
  P('admin-survey', '/admin/survey-settings', 'إعدادات الاستبانات', 'Survey settings', ['استبانة', 'survey'], 'staff', 'admin'),
];

/* ---------- الأوامر ---------- */
export type CommandId = 'lang' | 'copy' | 'print' | 'top' | 'miaar' | 'athir' | 'access';
export const COMMANDS: (Entry & { cmd: CommandId })[] = [
  { id: 'cmd-miaar', cmd: 'miaar', href: '/miaar', ar: 'ابدأ اختبار مِعيار الآن', en: 'Start the Miaar test now', syn: ['ابدا', 'اختبار', 'معيار', 'start', 'test'], group: 'command' },
  { id: 'cmd-lang', cmd: 'lang', href: '#', ar: 'بدّل لغة الواجهة (عربي / English)', en: 'Switch interface language', syn: ['لغة', 'english', 'عربي', 'language', 'ترجمة'], group: 'command' },
  { id: 'cmd-access', cmd: 'access', href: '/accessibility', ar: 'أَثَر للجميع — خيارات الوصول', en: 'Athar for all — access options', syn: ['تباين', 'خط كبير', 'وصول', 'contrast', 'font'], group: 'command' },
  { id: 'cmd-copy', cmd: 'copy', href: '#', ar: 'انسخ رابط هذه الصفحة', en: 'Copy this page link', syn: ['نسخ', 'رابط', 'copy', 'link', 'مشاركة'], group: 'command' },
  { id: 'cmd-print', cmd: 'print', href: '#', ar: 'اطبع هذه الصفحة', en: 'Print this page', syn: ['طباعة', 'print', 'pdf'], group: 'command' },
  { id: 'cmd-top', cmd: 'top', href: '#', ar: 'إلى أعلى الصفحة', en: 'Back to top', syn: ['اعلى', 'top', 'بداية'], group: 'command' },
];

/* ---------- النوايا: رموز معروفة → وجهة مباشرة ---------- */
export type Intent = { kind: 'result' | 'item' | 'email' | 'ask' | 'code' | 'none'; value: string; href?: string; need?: Need };
export function parseIntent(raw: string): Intent {
  const q = String(raw || '').trim();
  const ml = q.toUpperCase().match(/\bML-[A-Z0-9]{4}-[A-Z0-9]{4}\b/); if (ml) return { kind: 'result', value: ml[0], href: `/miaar/result/${ml[0]}` };
  const ar = q.toUpperCase().match(/\bAR-(?:LU|RD|LI|GR|VO|WR|SP)-(?:PRE|A1|A2|B1|B2|C1|C2)-\d{3}\b/); if (ar) return { kind: 'item', value: ar[0], href: `/admin/miaar/bank?q=${ar[0]}`, need: 'staff' };
  const em = q.match(/[\w.+-]+@[\w-]+\.[\w.-]+/); if (em) return { kind: 'email', value: em[0].toLowerCase(), need: 'staff' };
  if (/[?؟]\s*$/.test(q) && q.length >= 8) return { kind: 'ask', value: q.replace(/[?؟]\s*$/, '').trim() };
  const code = q.match(/^[A-Z0-9]{6,12}$/i); if (code && /\d/.test(code[0])) return { kind: 'code', value: code[0].toUpperCase(), href: `/verify/${code[0].toUpperCase()}` };
  return { kind: 'none', value: q };
}

/* ---------- الترتيب ---------- */
export const allowed = (e: { need?: Need }, ctx: { user: boolean; staff: boolean }) => !e.need || e.need === 'guest' || (e.need === 'user' && (ctx.user || ctx.staff)) || (e.need === 'staff' && ctx.staff);
export function scoreEntry(qTokens: string[], e: Entry, lang: Lang): number {
  if (!qTokens.length) return 0;
  const title = normalizeAr(lang === 'ar' ? e.ar : e.en), other = normalizeAr(lang === 'ar' ? e.en : e.ar), syn = (e.syn || []).map(normalizeAr), hrefN = e.href.toLowerCase();
  let total = 0;
  for (const w of qTokens) {
    let best = 0; const words = title.split(' ').map(p => p.replace(/^ال/, ''));
    if (title === w) best = 100; else if (title.startsWith(w)) best = 70; else if (words.some(p => p === w)) best = 62; else if (words.some(p => p.startsWith(w))) best = 55; else if (title.includes(w)) best = 40;
    if (!best && (other === w || other.split(' ').some(p => p.startsWith(w)))) best = 35; else if (!best && other.includes(w)) best = 25;
    if (!best) { for (const s of syn) { if (s === w) { best = 50; break; } if (s.startsWith(w) || s.split(' ').some(p => p.startsWith(w))) best = Math.max(best, 32); else if (s.includes(w)) best = Math.max(best, 18); } }
    if (!best && w.length >= 3 && hrefN.includes(w)) best = 15;
    if (!best) return 0; /* كل كلمة يجب أن تجد موطئًا */
    total += best;
  }
  return total / qTokens.length;
}
export function rank(q: string, entries: Entry[], ctx: { user: boolean; staff: boolean; lang: Lang; recent?: string[] }, limit = 12): Hit[] {
  const tk = tokens(q); if (!tk.length) return [];
  const rec = ctx.recent || [];
  const hits: Hit[] = [];
  for (const e of entries) { if (!allowed(e, ctx)) continue; const s = scoreEntry(tk, e, ctx.lang); if (s > 0) hits.push({ ...e, score: s + (rec.includes(e.id) ? 8 - Math.min(7, rec.indexOf(e.id)) : 0) }); }
  return hits.sort((a, b) => b.score - a.score || a.ar.localeCompare(b.ar, 'ar')).slice(0, limit);
}
/** ما يُقترح قبل الكتابة: آخر ما فُتح ثم الصفحات الأكثر فائدة لهذا الدور */
export function suggestions(ctx: { user: boolean; staff: boolean; recent?: string[] }, limit = 8): Entry[] {
  const byId = new Map(ROUTES.map(r => [r.id, r] as const));
  const out: Entry[] = []; for (const id of ctx.recent || []) { const e = byId.get(id); if (e && allowed(e, ctx) && !out.includes(e)) out.push(e); }
  const defaults = ctx.staff ? ['dashboard', 'admin-miaar', 'admin-enrollments', 'admin-live', 'reports-center', 'miaar', 'programs'] : ctx.user ? ['me', 'programs', 'miaar', 'me-skills', 'live', 'resources'] : ['miaar', 'programs', 'services', 'resources', 'experts', 'help'];
  for (const id of defaults) { const e = byId.get(id); if (e && allowed(e, ctx) && !out.includes(e)) out.push(e); if (out.length >= limit) break; }
  return out.slice(0, limit);
}
export const GROUP_LABEL: Record<Group, { ar: string; en: string }> = {
  page: { ar: 'صفحات', en: 'Pages' }, me: { ar: 'حسابي', en: 'My account' }, admin: { ar: 'الإدارة', en: 'Admin' }, command: { ar: 'أوامر', en: 'Commands' },
  program: { ar: 'برامج', en: 'Programs' }, resource: { ar: 'حقائب', en: 'Resources' }, person: { ar: 'هيئة أَثَر', en: 'Faculty' }, sim: { ar: 'محاكيات', en: 'Simulations' },
  session: { ar: 'جلسات', en: 'Sessions' }, credential: { ar: 'شهاداتي', en: 'My credentials' }, result: { ar: 'نتائج مِعيار', en: 'Miaar results' }, org: { ar: 'مؤسسات', en: 'Organizations' },
  invite: { ar: 'دعوات', en: 'Invitations' }, item: { ar: 'بنود البنك', en: 'Bank items' }, trainee: { ar: 'متدرّبون', en: 'Trainees' }, answer: { ar: 'إجابة أثير', en: 'Athir answer' },
};
export const GROUP_ORDER: Group[] = ['answer', 'command', 'result', 'credential', 'page', 'me', 'program', 'session', 'resource', 'sim', 'person', 'org', 'trainee', 'invite', 'item', 'admin'];
export function groupHits<T extends { group: Group }>(hits: T[]): { group: Group; items: T[] }[] {
  const m = new Map<Group, T[]>(); for (const h of hits) { if (!m.has(h.group)) m.set(h.group, []); m.get(h.group)!.push(h); }
  return GROUP_ORDER.filter(g => m.has(g)).map(g => ({ group: g, items: m.get(g)! }));
}
