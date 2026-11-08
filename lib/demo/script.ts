// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P69 «غرفة العرض» — النصّ الثابت للمشهد: الجهة الافتراضية · البرامج · الأصوات المغلقة · مسار العرض (9 محطّات).
 *  لا شيء هنا يلمس قاعدة البيانات؛ كل الأرقام والنصوص مكتوبة سلفًا (لا ذكاء اصطناعي) حتى يكون العرض هو نفسه كل مرّة. */

export const DEMO_SLUG = 'region-x';
export const DEMO_ORG = { name_ar: 'قيادة افتراضية — المنطقة س', name_en: 'Region-X Virtual Command', sector: 'gov', city: 'المنطقة س' } as const;
export const DEMO_TAG_AR = 'عرض — بيانات افتراضية';
/** سياسة الجهة في العرض: ما تطلبه جهة أمنية عادةً (P67) */
export const DEMO_POLICY = { pseudonymous: true, code_login: true, verify_minimal: true, voice_off: true, media_off: false, public_faces_off: true, home_threads_off: true, kiosk_minutes: 20 } as const;
export const DEMO_LEARNERS = 36;           // RX-0001 … RX-0036
export const DEMO_PRESENTERS = 5;          // RX-P01 (مدير الجهة — «اللجنة تقرّر») + RX-P02…P05 (منسوبون)
export const trainingNo = (i: number) => `RX-${String(i).padStart(4, '0')}`;
export const presenterNo = (i: number) => `RX-P${String(i).padStart(2, '0')}`;
export const STALE_DAYS = 7;               // «ساعة العرض»: أعد البناء إن مضى أكثر من 7 أيام

/** شعار محايد مضمَّن (SVG صغير) — لا شعار جهة حقيقية */
export const DEMO_LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#0f2a4e"/><path d="M48 14l28 12v22c0 17-12 30-28 36C32 78 20 65 20 48V26z" fill="none" stroke="#c9a24b" stroke-width="5"/><text x="48" y="58" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#fff">س</text></svg>');

export type DemoProgram = { key: 'A' | 'B' | 'C'; name_ar: string; name_en: string; cefr_level: string | null; hours: number; start: number; end: number; classrooms: { code: string; name_ar: string; learners: [number, number] }[]; sessions: number; objectives_ar: string[]; intro_ar: string };
/** الأيام نسبية إلى «ساعة الصفر» (سالب = مضى) */
export const DEMO_PROGRAMS: DemoProgram[] = [
  { key: 'A', name_ar: 'اللغة العربية للتواصل الميداني (A2)', name_en: 'Arabic for Field Communication (A2)', cefr_level: 'A2', hours: 60, start: -75, end: -40, sessions: 10,
    classrooms: [{ code: 'RX-A1', name_ar: 'القاعة 1', learners: [1, 12] }, { code: 'RX-A2', name_ar: 'القاعة 2', learners: [13, 24] }],
    intro_ar: 'برنامج افتراضي للعرض: تواصل ميداني عربي واضح في المواقف اليومية للمنسوبين الناطقين بغير العربية.',
    objectives_ar: ['فهم التعليمات الشفهية القصيرة في الميدان', 'كتابة بلاغ قصير بجمل سليمة', 'التحدّث بثقة في موقف خدمة أو تفتيش'] },
  { key: 'B', name_ar: 'كتابة التقارير الميدانية', name_en: 'Field Report Writing', cefr_level: null, hours: 24, start: -12, end: 16, sessions: 4,
    classrooms: [{ code: 'RX-B1', name_ar: 'القاعة 3', learners: [25, 36] }],
    intro_ar: 'برنامج افتراضي للعرض: من الملاحظة إلى التقرير — بنية ثابتة، لغة دقيقة، لا تأويل.',
    objectives_ar: ['تمييز الواقعة عن التقدير', 'كتابة تقرير من صفحة واحدة بترتيب زمني', 'مراجعة تقرير زميل بقائمة تحقّق'] },
  { key: 'C', name_ar: 'الإشراف الميداني للصفّ الأول', name_en: 'First-line Field Supervision', cefr_level: null, hours: 30, start: 10, end: 24, sessions: 0,
    classrooms: [{ code: 'RX-C1', name_ar: 'القاعة 4', learners: [13, 24] }],
    intro_ar: 'برنامج افتراضي للعرض: المشرف الأول يقود بالقدوة والمتابعة لا بالتعميم.',
    objectives_ar: ['إعطاء تغذية راجعة في موقعها', 'توزيع المهام بعدالة ووضوح', 'متابعة التطبيق بعد التدريب'] },
];

/** 12 سطر تطبيق ميداني — قائمة مغلقة، بلا أسماء ولا أماكن حقيقية، كلها موسومة «افتراضي» في meta */
export const DEMO_VOICES_AR: { body: string; blocker?: string }[] = [
  { body: 'طبّقت صيغة البلاغ القصير في مناوبة الصباح؛ الرسالة وصلت من أول مرّة.' },
  { body: 'بدأت أكتب التعليمات للزملاء في ثلاث جمل بدل فقرة طويلة.' },
  { body: 'استخدمت عبارات التوجيه الجديدة مع مراجع لا يتقن العربية — فهم دون تكرار.', blocker: 'ضيق الوقت في الذروة' },
  { body: 'راجعت تقريرًا قديمًا لي وأعدت ترتيبه زمنيًا؛ صار أوضح للقارئ.' },
  { body: 'ميّزت في تقرير اليوم بين ما رأيته وما استنتجته — سطران منفصلان.' },
  { body: 'قرأت تعليمة شفهية مرّتين قبل التنفيذ كما تدرّبنا؛ لم أحتج إلى سؤال ثالث.', blocker: 'ضجيج الموقع' },
  { body: 'استعملت قائمة التحقّق قبل تسليم التقرير؛ أمسكت خطأً في التاريخ.' },
  { body: 'شرحت لزميل جديد صيغة البلاغ في خمس دقائق على الورقة التدريبية.' },
  { body: 'كتبت ملاحظات الموقع في الوقت نفسه لا من الذاكرة في نهاية المناوبة.' },
  { body: 'طلبت من المراجع إعادة الجملة بكلماته؛ تأكّدت أنّه فهم.', blocker: 'لا نموذج ورقي موحّد' },
  { body: 'جرّبت فتح الحديث بعبارة ترحيب قصيرة قبل الطلب — الموقف هدأ.' },
  { body: 'أرسلت تقرير المناوبة قبل موعده بساعة لأنّ البنية صارت جاهزة في رأسي.' },
];

export type Station = { no: number; title_ar: string; say_ar: string; href: string; see_ar: string; who: 'staff' | 'presenter_admin' | 'presenter' | 'public' };
/** مسار العرض — 9 محطّات بترتيب ثابت. <code> و<report> تُستبدل برموز البناء الفعلية */
export const DEMO_PATH: Station[] = [
  { no: 1, title_ar: 'الدخول برقم لا باسم', say_ar: 'منسوب الجهة يدخل برقمه التدريبي ورقم سرّي — لا بريد ولا اسم يغادر الجهة.', href: '/enter?o=region-x', see_ar: 'شاشة الدخول باسم الجهة وشعارها، ثم «ميثاق الرمز» في أول دخول', who: 'presenter' },
  { no: 2, title_ar: 'أول يوم — قال من سبقك', say_ar: 'صفحته الشخصية تبدأ بما قاله من سبقه في البرنامج نفسه، وبسطر قيادته «قرأت وقرّرت».', href: '/me', see_ar: 'بطاقة «قال من سبقك» · سطر «قيادتك قرأت وقرّرت» · لا اسم واحد', who: 'presenter' },
  { no: 3, title_ar: 'سياسة الجهة المختومة', say_ar: 'الجهة تُغلق ما تشاء بمفتاح مختوم: أسماء مستعارة، تحقّق مختصر، لا صوت — وكل تغيير ختم جديد.', href: '/org?tab=policy', see_ar: 'المفاتيح السبعة · ختم ATH-OP · شعار الجهة', who: 'presenter_admin' },
  { no: 4, title_ar: 'الورقة التي يراها المشرف قبل الجميع', say_ar: 'نموذج الاجتياز مثبَّت وموقَّع: المشرف راجعه وبدّل بندًا بسبب مكتوب، ثم قُفل عند أول جلسة.', href: '/admin/miaar/invites', see_ar: 'زرّ «ATH-FM-… v2 🔒» · نسخة المشرف · الإصدارات (2) · أثر الورقة بعد الاختبار', who: 'staff' },
  { no: 5, title_ar: 'التحقّق أمام اللجنة', say_ar: 'أي جهة تُدخل رمز النموذج فترى أنّه سليم وكم جلسة حُكمت به — ولا نصّ سؤال واحد.', href: '/verify/form?code=<form>', see_ar: 'صحيح · سليم البصمة · 20 بندًا · 24 جلسة حُكمت بهذه الورقة', who: 'public' },
  { no: 6, title_ar: 'نبض البيئة التدريبية', say_ar: 'الاستبيان الختامي لا يصير تقريرًا يُركن؛ أضعف بند يتحوّل تلقائيًا إلى مهمّة تحسين واحدة.', href: '/admin/pulse', see_ar: 'أين تتسرّب الجودة؟ · بند الأسبوع (بطاقة ذهبية)', who: 'staff' },
  { no: 7, title_ar: 'تقرير القيادة — حيًّا', say_ar: 'نُصدر الآن تقرير «منذ آخر تقرير»: ثلاثة أرقام، ثلاثة أسئلة، وما لم يُقَس بعد مكتوب كما هو.', href: '/org?tab=leader', see_ar: '«إصدار تقرير» → ورقة A4 بختم ATH-LR فورًا', who: 'presenter_admin' },
  { no: 8, title_ar: 'اللجنة تقرّر', say_ar: 'رئيس اللجنة يختار قرارًا واحدًا ويختمه بيده — وعلى الشاشة الثانية يصل صداه إلى منسوب خلال ثانيتين.', href: '/org?tab=leader', see_ar: 'صندوق «قرارٌ واحد يكفي» → /me على الشاشة الثانية: «قيادتك قرأت وقرّرت»', who: 'presenter_admin' },
  { no: 9, title_ar: 'الدرع وسجلّ المعالجة', say_ar: 'كل ما رأيتموه محروس: تمرين درع شهري مختوم، وسجلّ معالجة بيانات يقرؤه مسؤول الامتثال.', href: '/admin/shield', see_ar: 'ختم ATH-SH · أحداث اليوم (تثبيت · إصدار · قرار) · ثم /privacy/processing', who: 'staff' },
];

export function pathWith(p: Station[], codes: { form?: string | null; report?: string | null }): Station[] {
  return p.map((s) => ({ ...s, href: s.href.replace('<form>', codes.form || 'ATH-FM-XXXX-XXXX').replace('<report>', codes.report || 'ATH-LR-XXXX-XXXX') }));
}
export function pathText(p: Station[], site: string): string {
  return ['مسار العرض — ' + DEMO_ORG.name_ar, ''].concat(p.map((s) => `${s.no}) ${s.title_ar}\n   قل: ${s.say_ar}\n   افتح: ${site}${s.href}\n   سيرون: ${s.see_ar}`)).join('\n');
}
/** مولّد عشوائي حتمي صغير (mulberry32) — البناء نفسه كل مرّة للبذرة نفسها */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h >>> 0) || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** شريحة القدرة لكل متقدّم في اختبار الاجتياز: ضعيف/متوسّط/قوي باحتمال إجابة صحيحة 0.35/0.6/0.85 */
export function bandOf(i: number): { name: 'weak' | 'mid' | 'strong'; p: number } { const m = i % 4; return m === 0 ? { name: 'weak', p: 0.35 } : m === 3 ? { name: 'strong', p: 0.85 } : { name: 'mid', p: 0.6 }; }
export const dayIso = (anchor: Date, offsetDays: number) => { const d = new Date(anchor.getTime() + offsetDays * 86400000); return d.toISOString().slice(0, 10); };
export const atIso = (anchor: Date, offsetDays: number, hour = 9) => { const d = new Date(anchor.getTime() + offsetDays * 86400000); d.setUTCHours(hour - 3, 0, 0, 0); return d.toISOString(); };
