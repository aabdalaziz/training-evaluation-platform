'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';

type Section = { id: string; icon: IconName; title: string; who: string; summary: string; steps: string[]; tips?: string[]; links: { href: string; label: string }[] };

const JOURNEY: { id: string; label: string; when: string }[] = [
  { id: 'programs', label: 'أنشئ البرنامج', when: 'قبل 2–4 أسابيع' },
  { id: 'rooms', label: 'القاعات والمدربون', when: 'قبل أسبوعين' },
  { id: 'templates', label: 'قوالب التقييم', when: 'قبل أسبوع' },
  { id: 'impact', label: 'الاختبار القبلي', when: 'قبل أول جلسة' },
  { id: 'attendance', label: 'الحضور الرقمي', when: 'كل جلسة' },
  { id: 'evaluate', label: 'التقييم اليومي', when: 'نهاية كل جلسة' },
  { id: 'certificates', label: 'الختامي والشهادات', when: 'آخر جلسة' },
  { id: 'followups', label: 'نقل الأثر والنتائج', when: 'بعد 30–90 يومًا' },
];

const SECTIONS: Section[] = [
  { id: 'readiness', icon: 'compass', title: 'جاهزية البرنامج (ابدأ من هنا)', who: 'مدير البرنامج', summary: 'فحص آلي لكل برنامج يخبرك ما الناقص قبل أول جلسة، مع زر إصلاح لكل بند.',
    steps: ['افتح «جاهزية البرنامج» من لوحة التحكم.', 'اختر البرنامج من القائمة (الأقرب انطلاقًا يظهر أولًا).', 'عالج «الخطوة التالية» ثم بقية البنود الحمراء (عوائق) فالصفراء (تحسينات).', 'عندما يصبح المؤشر «جاهز» انسخ روابط التقييم من الصفحة نفسها.'],
    tips: ['البنود غير المطبّقة على مرحلة البرنامج (مثل الشهادات لبرنامج لم يبدأ) لا تُحسب ضدك.'], links: [{ href: '/admin/readiness', label: 'فتح جاهزية البرنامج' }] },
  { id: 'programs', icon: 'book', title: 'إنشاء البرامج التدريبية', who: 'مدير البرنامج / الإداري', summary: 'البرنامج هو الوعاء الذي تُربط به القاعات والتقييمات والشهادات والتقارير.',
    steps: ['مركز الإدارة → تبويب البرامج → «إضافة برنامج».', 'أدخل الاسم العربي (والإنجليزي للاستمارة ثنائية اللغة)، تاريخي البداية والنهاية، ونمط التنفيذ (حضوري / عن بُعد / مدمج).', 'املأ المقدمة والأهداف والمخرجات — تظهر في بطاقة البرنامج والشهادة وتُحسّن الملخص الذكي.', 'اترك الحالة «مسودة» حتى تكتمل الجاهزية ثم حوّلها إلى «نشط».'],
    tips: ['البرنامج الجديد يُربط تلقائيًا بالقالبين اليومي والختامي الأكثر أسئلة؛ غيّر ذلك من قوالب التقييم إن لزم.', 'نمط «عن بُعد» يفعّل استطلاع التعلم عن بُعد تلقائيًا ويخفي حقول القاعة الفيزيائية.'], links: [{ href: '/admin/management', label: 'مركز الإدارة' }] },
  { id: 'rooms', icon: 'school', title: 'القاعات والمدربون والجداول', who: 'الإداري', summary: 'القاعة = مجموعة تدريبية واحدة بمدرب واحد؛ التقييم اليومي والحضور يُسجَّلان على مستوى القاعة.',
    steps: ['مركز الإدارة → القاعات → «إضافة قاعة»: الرمز (مثل A-101 أو Zoom-1)، البرنامج، المستوى، المدرب.', 'أضف المدربين أولًا من تبويب المدربين إن لم يكونوا موجودين.', 'أضف الجدول الأسبوعي للقاعة (اليوم، من/إلى) — يستخدمه استطلاع التعلم عن بُعد والتذكيرات.'],
    tips: ['قاعة بلا مدرب تُضعف تقارير عدالة المدربين ولوحة الشرف.', 'للبرامج عن بُعد أنشئ قاعة افتراضية لكل مجموعة (الرمز = رابط/اسم الغرفة).'], links: [{ href: '/admin/management?tab=rooms', label: 'إدارة القاعات' }] },
  { id: 'templates', icon: 'doc', title: 'قوالب التقييم والأسئلة', who: 'مدير البرنامج / الجودة', summary: 'ما يراه المشارك في استمارتي التقييم اليومي والختامي — بلا أي SQL.',
    steps: ['قوالب التقييم → جدول «تغطية البرامج»: تأكد أن لكل برنامج قالبًا يوميًا وآخر ختاميًا بحالة «جاهز».', 'لتعديل الأسئلة: اختر القالب → «إضافة سؤال» أو ✎ على سؤال موجود → احفظ. رتّب بالأسهم ▲▼.', 'لتخصيص قالب لبرنامج واحد: «نسخ» القالب → عدّل النسخة → اختره لذلك البرنامج من جدول التغطية.', 'استخدم «معاينة» لرؤية الاستمارة كما يراها المشارك.'],
    tips: ['الأسئلة التي عليها إجابات لا تُحذف (انسخ القالب بدلًا من ذلك) حفاظًا على سلامة التقارير.', 'أنواع المقياس (رقمي/نجوم/ليكرت) هي التي تدخل في متوسط الرضا؛ النصوص تُحلَّل في الملخص الذكي.', 'رسالة «لا يوجد قالب تقييم مفعّل» للمشارك تعني أن البرنامج بلا قالب من هذا النوع — اربطه من جدول التغطية.'], links: [{ href: '/admin/templates', label: 'قوالب التقييم' }] },
  { id: 'evaluate', icon: 'evaluations', title: 'استمارات التقييم (يومي / ختامي) ثنائية اللغة', who: 'المشاركون — بلا تسجيل دخول', summary: 'استمارة عامة بالعربية والإنجليزية، تمنع التكرار، وتُغذّي كل التقارير فورًا.',
    steps: ['انسخ رابط الاستمارة من صفحة الجاهزية أو من غرفة القيادة (QR) واعرضه في آخر 5 دقائق من الجلسة.', 'اليومي: يختار المشارك البرنامج والقاعة ثم يجيب (≈3 دقائق). الختامي: يُجمع في آخر جلسة ويتضمن مكان الإقامة.', 'الاستجابات تظهر فورًا في لوحة التحكم ومركز التقارير والتحليل النهائي.'],
    tips: ['المنع من التكرار: نفس البريد + نفس القاعة + نفس اليوم = استجابة واحدة (يومي)، ونفس البريد + البرنامج = استجابة واحدة (ختامي).', 'يمكن تمرير القاعة في الرابط مسبقًا: /evaluate/daily?program=…&classroom=…'], links: [{ href: '/evaluate/daily', label: 'استمارة التقييم اليومي' }, { href: '/evaluate/final', label: 'استمارة التقييم الختامي' }] },
  { id: 'attendance', icon: 'check', title: 'الحضور الرقمي', who: 'المدرب / الإداري', summary: 'جلسة حضور لكل لقاء برمز QR، تسجيل بالبريد أو الجوال، واحتساب التأخر تلقائيًا.',
    steps: ['الحضور → «جلسة جديدة»: البرنامج، القاعة، التاريخ، وقت البداية، وحد التأخر بالدقائق.', 'اعرض رمز QR أو الرابط؛ يسجّل المتدرب اسمه وبريده/جواله.', 'أغلق الجلسة في نهايتها؛ تُحسب نسب الحضور في بطاقة البرنامج وتُستخدم في أهلية الشهادات.'],
    tips: ['فعّل «الجوال إلزامي» إن أردت منع التسجيل المكرر بأسماء مختلفة.'], links: [{ href: '/admin/attendance', label: 'إدارة الحضور' }] },
  { id: 'impact', icon: 'target', title: 'قياس أثر التدريب (قبلي / بعدي)', who: 'الجودة / مدير البرنامج', summary: 'أداة قياس تُطبَّق قبل البرنامج وبعده لحساب الكسب المعياري (Hake) على مستوى الأفراد والمجموعة.',
    steps: ['قياس الأثر → «أداة جديدة» → اختر النمط: مقياس اتجاهات، اختبار معرفي، أو مختلط. يمكن توليد الأسئلة بالذكاء الاصطناعي من أهداف البرنامج.', 'افتح مرحلة «قبلي» وشارك الرابط قبل أول جلسة، ثم أغلقها.', 'بعد آخر جلسة افتح «بعدي» بالرابط نفسه؛ الربط بين القبلي والبعدي يتم ببريد المتدرب.', 'اقرأ النتائج في تقرير الأثر وسلسلة الأثر 1→4.'],
    links: [{ href: '/admin/impact', label: 'قياس أثر التدريب' }, { href: '/reports/impact', label: 'تقرير الأثر' }] },
  { id: 'certificates', icon: 'certificate', title: 'الشهادات الإلكترونية والتحقق', who: 'الإداري', summary: 'إصدار جماعي بشروط أهلية (حضور/تقييم)، رمز QR للتحقق، وإرسال بالبريد.',
    steps: ['الشهادات → الإعدادات: الشعارات، التوقيع، نص الشهادة، وحد الأهلية.', 'اختر البرنامج → حدّد المستحقين (يُقترحون تلقائيًا من الحضور) → «إصدار».', 'أرسل بالبريد أو نزّل PDF. أي شخص يستطيع التحقق من الشهادة عبر /verify برمزها.'],
    tips: ['الشهادة الملغاة تبقى في السجل بعلامة «ملغاة» ويظهر ذلك في التحقق.'], links: [{ href: '/admin/certificates', label: 'الشهادات' }, { href: '/verify', label: 'صفحة التحقق' }] },
  { id: 'followups', icon: 'trend', title: 'متابعة نقل الأثر (كيركباتريك 3)', who: 'الجودة', summary: 'استبانة للمتدرب ومديره بعد 30–90 يومًا تقيس تطبيق المهارات في العمل، مع إرسال وتذكير تلقائيين.',
    steps: ['متابعة نقل الأثر → «متابعة جديدة»: البرنامج، بعد كم يوم، المستهدفون (المتدرب / المشرف)، والإرسال التلقائي.', 'الكرون اليومي يرسل الروابط عند الاستحقاق ويذكّر غير المستجيبين.', 'النتائج في تقرير نقل الأثر وفي سلسلة الأثر.'],
    links: [{ href: '/admin/followup', label: 'متابعة نقل الأثر' }, { href: '/reports/transfer', label: 'تقرير نقل الأثر' }] },
  { id: 'outcomes', icon: 'flag', title: 'مؤشرات النتائج المؤسسية (كيركباتريك 4)', who: 'الإدارة العليا / الجودة', summary: 'اربط كل برنامج بمؤشر مؤسسي (خط أساس → مستهدف) وسجّل القياسات الدورية.',
    steps: ['مؤشرات النتائج → «مؤشر جديد»: الاسم، الوحدة، الاتجاه (أعلى/أقل أفضل)، خط الأساس، المستهدف وتاريخه.', 'أضف قياسًا كلما توفرت بيانات جديدة.', 'سلسلة الأثر 1→4 تعرض الرضا → التعلم → السلوك → النتائج في صفحة واحدة.'],
    links: [{ href: '/admin/outcomes', label: 'مؤشرات النتائج' }, { href: '/reports/chain', label: 'سلسلة الأثر 1→4' }] },
  { id: 'reports', icon: 'reports', title: 'التقارير ومركز التقارير', who: 'الجميع حسب الدور', summary: 'من اللوحة التنفيذية إلى بطاقة البرنامج الشاملة والذكاء التحليلي — كلها قابلة للتصدير.',
    steps: ['مركز التقارير: نقطة الدخول لكل التقارير مع فلاتر البرنامج والفترة.', 'بطاقة البرنامج: صفحة واحدة لصانع القرار (PDF/Excel) تجمع الرضا والحضور والأثر والشهادات.', 'الذكاء التحليلي: مقارنة الدفعات، الترتيب العادل للمدربين، والملخص التنفيذي الذكي.', 'الموجز الأسبوعي يصل بالبريد كل أحد لمن اشترك في الإعدادات.'],
    tips: ['المستهدف المؤسسي للرضا 4.2 من 5؛ الألوان: ≥4.2 أخضر، ≥3.7 أصفر، أقل أحمر.'], links: [{ href: '/reports/center', label: 'مركز التقارير' }, { href: '/reports/program', label: 'بطاقة البرنامج' }, { href: '/reports/cohorts', label: 'الذكاء التحليلي' }] },
  { id: 'remote', icon: 'laptop', title: 'استطلاع التعلم عن بُعد', who: 'طلاب البرامج عن بُعد — مجهول الهوية', summary: 'استطلاع ثنائي اللغة مجهول الهوية لجودة التعلم عن بُعد، مع إعدادات تفعيل وتقرير خاص.',
    steps: ['إعدادات الاستطلاع: فعّل/عطّل، حدّد البرامج، ونص الترحيب.', 'شارك رابط /survey/remote-learning مع الطلاب.', 'النتائج في تقرير الاستطلاع عن بُعد.'], links: [{ href: '/admin/survey-settings', label: 'إعدادات الاستطلاع' }, { href: '/reports/remote-survey', label: 'تقرير الاستطلاع' }] },
  { id: 'me', icon: 'users', title: 'بوابة المتدرب والإشعارات', who: 'المتدرب / الإداري', summary: 'المتدرب يدخل ببريده (رمز OTP) ليرى شهاداته وتقييماته ومتابعاته؛ والإداري يتابع مركز الإشعارات.',
    steps: ['المتدرب: /me → البريد → رمز التحقق → لوحة شخصية.', 'الإداري: الجرس في الشريط العلوي → مركز الإشعارات (8 قواعد تلقائية: انخفاض رضا، غياب تقييم، فشل كرون…).'], links: [{ href: '/me', label: 'بوابة المتدرب' }, { href: '/admin/notifications', label: 'مركز الإشعارات' }] },
  { id: 'awards', icon: 'award', title: 'تكريم المدربين ولوحة الشرف', who: 'الإدارة', summary: 'ترتيب شهري عادل للمدربين (يراعي حجم العينة) وشهادات تكريم.',
    steps: ['تكريم المدربين → اختر الشهر → راجع الترتيب → «تكريم» لإصدار شهادة.'], links: [{ href: '/admin/awards', label: 'تكريم المدربين' }] },
  { id: 'governance', icon: 'shield', title: 'الحوكمة: الأدوار، نطاق الوصول، سجل التدقيق، صحة المنصة', who: 'مدير المنصة', summary: 'من يرى ماذا، ومن فعل ماذا ومتى، وهل كل شيء يعمل.',
    steps: ['الأدوار: مدير المنصة، إداري، مدير برنامج، محلل جودة، مدرب. يُحدَّد الدور في ملف المستخدم.', 'نطاق الوصول: اربط مدير البرنامج ببرامجه فيرى بياناتها فقط (يُطبَّق في قاعدة البيانات).', 'سجل التدقيق: كل تعديل على البرامج والقاعات والشهادات والقوالب مسجّل مع من/متى/ماذا تغيّر، مع تصدير.', 'صحة المنصة: الإعدادات، آخر تشغيل للكرون، أخطاء البريد، مفتاح الذكاء الاصطناعي — مع اختبار بريد وذكاء اصطناعي بنقرة.'],
    links: [{ href: '/admin/access', label: 'نطاق الوصول' }, { href: '/admin/audit', label: 'سجل التدقيق' }, { href: '/admin/health', label: 'صحة المنصة' }] },
  { id: 'data', icon: 'trash', title: 'دورة حياة البيانات', who: 'مدير المنصة', summary: 'معاينة وتفريغ منضبط للبيانات التجريبية أو القديمة، مع تأكيد مزدوج وتسجيل في التدقيق.',
    steps: ['دورة حياة البيانات → اختر النطاق → «معاينة» لرؤية الأعداد → اكتب كلمة التأكيد → تنفيذ.'], tips: ['لا يمكن التراجع — صدّر التقارير أولًا.'], links: [{ href: '/admin/data-lifecycle', label: 'دورة حياة البيانات' }] },
  { id: 'backup', icon: 'save', title: 'النسخ الاحتياطي والأرشفة', who: 'مدير المنصة', summary: 'نسخة شاملة من كل البيانات (Excel بورقة لكل جدول + ورقة إجابات مفكوكة، أو JSON للاستعادة)، وأرشفة البرامج المنتهية لإخفائها من الاستمارات والجاهزية مع بقائها في التقارير.',
    steps: ['النسخ الاحتياطي → اختر النطاق (الكل أو برنامج) → «Excel» أو «JSON» → يُحفظ الملف على جهازك ويُسجَّل في السجل.', 'الأرشفة → اختر البرنامج → «أرشفة»؛ للتراجع اضغط «إلغاء الأرشفة».', 'الاستعادة → ارفع ملف JSON → «فحص بلا تغيير» لرؤية الجديد/الموجود → اكتب «استعادة» → تنفيذ (إضافة الناقص أو استبدال المطابق؛ لا حذف أبدًا).'], tips: ['يُنصح بنسخة شهرية؛ تظهر «آخر نسخة» في صحة المنصة ويُرسل تنبيه بعد 30 يومًا.', 'احفظ ملف JSON في مكان آمن خارج المنصة (Drive/OneDrive).'], links: [{ href: '/admin/backup', label: 'النسخ الاحتياطي' }, { href: '/admin/health', label: 'صحة المنصة' }] },
];

const FAQ: { q: string; a: string; href?: string }[] = [
  { q: 'يظهر للمشارك «لا يوجد قالب تقييم مفعّل لهذا البرنامج»', a: 'البرنامج غير مرتبط بقالب من هذا النوع (يومي/ختامي). افتح قوالب التقييم → جدول تغطية البرامج → اختر القالب للبرنامج.', href: '/admin/templates' },
  { q: 'المشارك لا يجد قاعته في التقييم اليومي', a: 'لم تُنشأ قاعة للبرنامج بعد، أو أُنشئت على برنامج آخر. أضف القاعة من مركز الإدارة → القاعات واختر البرنامج الصحيح.', href: '/admin/management?tab=rooms' },
  { q: 'التقييم رُفض بسبب التكرار رغم أنه أول مرة', a: 'المنع يعتمد على البريد الإلكتروني؛ تأكد أن المشارك لا يستخدم بريد زميل. في اليومي يُسمح باستجابة واحدة لكل قاعة في اليوم.' },
  { q: 'لم يصل الموجز الأسبوعي أو بريد الشهادة', a: 'افتح صحة المنصة وتحقق من مفتاح البريد (RESEND_API_KEY) وآخر تشغيل للكرون، ثم استخدم «اختبار البريد».', href: '/admin/health' },
  { q: 'الملخص الذكي لا يعمل', a: 'صحة المنصة → «اختبار الذكاء الاصطناعي». إن فشل، حدّث AI_API_KEY أو AI_MODEL في إعدادات Vercel (النماذج القديمة تُوقف دوريًا).', href: '/admin/health' },
  { q: 'مدير برنامج يرى برامج لا تخصه', a: 'مدير بلا أي ربط يرى كل البرامج افتراضيًا. اربطه ببرامجه من نطاق الوصول.', href: '/admin/access' },
  { q: 'كيف أحذف بيانات تجريبية قبل الانطلاق الرسمي؟', a: 'دورة حياة البيانات → معاينة → تأكيد. صدّر التقارير أولًا إن احتجتها.', href: '/admin/data-lifecycle' },
];

export default function HelpPage() {
  const [q, setQ] = useState(''); const [active, setActive] = useState('');
  useEffect(() => { const h = () => setActive(decodeURIComponent(window.location.hash.replace('#', ''))); h(); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  useEffect(() => { if (active) document.getElementById(active)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [active]);
  const term = q.trim();
  const sections = useMemo(() => !term ? SECTIONS : SECTIONS.filter(s => [s.title, s.summary, s.who, ...s.steps, ...(s.tips || [])].some(t => t.includes(term))), [term]);
  const faq = useMemo(() => !term ? FAQ : FAQ.filter(f => (f.q + f.a).includes(term)), [term]);

  return (
    <div className="hp" dir="rtl">
      <style>{CSS}</style>
      <header className="hp-head">
        <div>
          <div className="hp-kicker"><Icon name="question" size={14} /> دليل الاستخدام</div>
          <h1>كيف تدير برنامجًا من الفكرة إلى الأثر</h1>
          <p>دليل عملي مختصر لكل شاشة في المنصة، مرتّب حسب رحلة البرنامج. ابحث عن أي كلمة أو اضغط على خطوة في الرحلة.</p>
        </div>
        <nav className="hp-nav">
          <Link href="/dashboard" className="hp-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/readiness" className="hp-btn primary"><Icon name="compass" size={16} /> جاهزية البرنامج</Link>
        </nav>
      </header>

      <section className="hp-card">
        <div className="hp-search"><Icon name="search" size={16} /><input placeholder="ابحث: قالب، QR، شهادة، كرون، مدير برنامج…" value={q} onChange={e => setQ(e.target.value)} />{q && <button onClick={() => setQ('')}>مسح</button>}</div>
        {!term && (
          <ol className="hp-journey">
            {JOURNEY.map((j, i) => <li key={j.id}><a href={`#${j.id}`} onClick={() => setActive(j.id)}><span className="hp-jn">{i + 1}</span><b>{j.label}</b><small>{j.when}</small></a></li>)}
          </ol>
        )}
      </section>

      <div className="hp-split">
        <aside className="hp-toc">
          <b>المحتويات</b>
          {SECTIONS.map(s => <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'on' : ''} onClick={() => setActive(s.id)}><Icon name={s.icon} size={13} /> {s.title}</a>)}
          <a href="#faq" className={active === 'faq' ? 'on' : ''} onClick={() => setActive('faq')}><Icon name="chat" size={13} /> أسئلة شائعة</a>
        </aside>
        <main className="hp-main">
          {sections.map(s => (
            <article key={s.id} id={s.id} className={`hp-sec ${active === s.id ? 'on' : ''}`}>
              <div className="hp-sec-h"><span className="hp-ic"><Icon name={s.icon} size={18} /></span><div><h2>{s.title}</h2><small>لمن: {s.who}</small></div></div>
              <p className="hp-sum">{s.summary}</p>
              <ol className="hp-steps">{s.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
              {s.tips && s.tips.length > 0 && <div className="hp-tips">{s.tips.map((t, i) => <div key={i}><Icon name="star" size={12} /> {t}</div>)}</div>}
              <div className="hp-links">{s.links.map(l => <Link key={l.href} href={l.href} className="hp-btn small">{l.label} <Icon name="arrow" size={12} /></Link>)}</div>
            </article>
          ))}
          <article id="faq" className={`hp-sec ${active === 'faq' ? 'on' : ''}`}>
            <div className="hp-sec-h"><span className="hp-ic"><Icon name="chat" size={18} /></span><div><h2>أسئلة شائعة ومشكلات متكررة</h2><small>أكثر ما يُسأل عنه في الأسبوع الأول</small></div></div>
            {faq.map((f, i) => <details key={i} className="hp-faq"><summary>{f.q}</summary><p>{f.a}</p>{f.href && <Link href={f.href} className="hp-btn small">اذهب إلى الصفحة <Icon name="arrow" size={12} /></Link>}</details>)}
            {!faq.length && <p className="hp-muted">لا نتائج.</p>}
          </article>
          {!sections.length && !faq.length && <div className="hp-sec"><p className="hp-muted">لا توجد نتائج لـ «{term}». جرّب كلمة أقصر.</p></div>}
        </main>
      </div>
    </div>
  );
}

const CSS = `
.hp{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.hp *{box-sizing:border-box}
.hp-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.hp-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.hp-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.hp-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.hp-nav{display:flex;gap:8px;flex-wrap:wrap}
.hp-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none;white-space:nowrap}.hp-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}.hp-btn.small{padding:6px 10px;font-size:12px}
.hp-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;margin-bottom:14px}
.hp-search{display:flex;align-items:center;gap:8px;border:1px solid #cbd5e1;border-radius:12px;padding:8px 12px;color:#64748b}.hp-search input{flex:1;border:0;outline:0;font:inherit;font-size:14px;color:#0f172a;background:transparent}.hp-search button{border:0;background:#f1f5f9;border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:${NAVY}}
.hp-journey{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.hp-journey a{display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;text-decoration:none;color:${NAVY};border:1px solid #e2e8f0;border-radius:12px;padding:10px 6px;background:#f8fafc}.hp-journey a:hover{border-color:${TEAL};background:#f0fdfa}
.hp-jn{width:24px;height:24px;border-radius:50%;background:${NAVY};color:#fff;font-size:11px;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.hp-journey b{font-size:12px}.hp-journey small{font-size:10.5px;color:#64748b}
.hp-split{display:grid;grid-template-columns:260px 1fr;gap:14px;align-items:start}
.hp-toc{position:sticky;top:80px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:2px;max-height:calc(100vh - 100px);overflow:auto}.hp-toc b{font-size:12px;color:#64748b;margin:0 6px 6px}.hp-toc a{display:flex;align-items:center;gap:6px;text-decoration:none;color:#334155;font-size:12.5px;font-weight:700;padding:7px 8px;border-radius:8px}.hp-toc a.on,.hp-toc a:hover{background:#f0fdfa;color:${TEAL}}
.hp-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.hp-sec{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;scroll-margin-top:84px}.hp-sec.on{border-color:${TEAL};box-shadow:0 0 0 3px #ccfbf1}
.hp-sec-h{display:flex;gap:10px;align-items:center;margin-bottom:8px}.hp-sec-h h2{margin:0;font-size:17px;color:${NAVY}}.hp-sec-h small{color:#64748b;font-size:12px}
.hp-ic{width:38px;height:38px;border-radius:11px;background:#e0f2fe;color:#075985;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.hp-sum{margin:0 0 8px;color:#334155;font-size:13.5px;line-height:1.7}
.hp-steps{margin:0;padding:0 20px 0 0;display:flex;flex-direction:column;gap:5px;font-size:13px;line-height:1.7}
.hp-tips{margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#78350f;display:flex;flex-direction:column;gap:4px}.hp-tips div{display:flex;gap:6px;align-items:flex-start}
.hp-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.hp-faq{border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-top:8px}.hp-faq summary{cursor:pointer;font-weight:800;font-size:13.5px;color:${NAVY}}.hp-faq p{margin:8px 0;font-size:13px;color:#334155;line-height:1.7}
.hp-muted{color:#64748b;font-size:13px}
@media(max-width:1000px){.hp-journey{grid-template-columns:repeat(4,1fr)}}
@media(max-width:900px){.hp{padding:12px}.hp-split{grid-template-columns:1fr}.hp-toc{position:static;max-height:none;flex-direction:row;flex-wrap:wrap}.hp-toc b{width:100%}.hp-journey{grid-template-columns:repeat(2,1fr)}}
`;
