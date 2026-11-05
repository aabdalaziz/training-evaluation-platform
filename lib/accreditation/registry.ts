// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P48-أ «ملف الاعتماد الحيّ» (الرسمي: ملف الدراسة الذاتية للاعتماد البرامجي — متجدِّد) — المنطق النقي (بلا قاعدة بيانات)
 *  - إطاران مرجعيان: `pas` معايير الاعتماد البرامجي لبرامج التدريب المنتهية بمؤهل (هيئة تقويم التعليم والتدريب · 4 معايير / 21 فرعيًّا)
 *                    `tps` المعايير المهنية للمعلمين (3 مجالات / 10 معايير عامة / 21 فرعيًّا) — لربط كفايات برامج إعداد المعلّمين بها.
 *  - الملف لا يُكتب: الأدلة تُجمَع من المعتمَد فقط (التصميم · الوحدات · التقارير · المراجعة · النسخة · محطات الأثر · سير المدرّبين) وتُعلَّق تحت معيارها الفرعي.
 *  - التغطية بكلمات لا ألوان: مستوفى · جزئي · ناقص · يدوي (معيار لا مصدر آلي له — يُستوفى بفقرة موقَّعة).
 *  - فقرة السرد: مسودّة (ذكاء → محلي) من الأدلة فقط؛ لا تُحفظ إلا موقَّعة من إنسان. لا أسماء متدرّبين (مجاميع k ≥ 5).
 */
export const P48_NAMES_AR = {
  file: 'ملف الاعتماد الحيّ', official: 'ملف الدراسة الذاتية للاعتماد البرامجي', pas: 'معايير الاعتماد البرامجي لبرامج التدريب المنتهية بمؤهل', pas_short: 'الاعتماد البرامجي', tps: 'المعايير المهنية للمعلمين', tps_short: 'معايير المعلّم',
  proven: 'ما ثبت', missing: 'ما ينقص', narrative: 'فقرة المعيار', draft: 'اكتب لي فقرة المعيار', sign: 'وقّع الفقرة', signed: 'موقَّعة', map: 'خريطة الكفايات إلى معايير المعلّم', produce: 'أنتجه الآن',
  motto: 'ملف الاعتماد لا يُكتب في الأسبوع الأخير؛ ينمو مع البرنامج، والإنسان يوقّع', body_ar: 'هيئة تقويم التعليم والتدريب', eligibility: 'شروط التأهّل',
} as const;
export const FRAMEWORKS = ['pas', 'tps'] as const; export type Framework = typeof FRAMEWORKS[number];
export const COVERAGE_AR = { met: 'مستوفى', partial: 'جزئي', missing: 'ناقص', manual: 'يدوي' } as const; export type Coverage = keyof typeof COVERAGE_AR;
export const NARRATIVE_MIN = 40; export const NARRATIVE_MAX = 1200; export const K_MIN = 5;
export type StandardRow = { framework: Framework; code: string; parent: string | null; title_ar: string; text_ar: string; weight: number | null; sort: number; source: 'official' | 'draft' };
const S = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/* ───────── 1) الإطار الأول: الاعتماد البرامجي (نصّ المشروع كما طُرح على منصّة استطلاع؛ أُطلق رسميًّا 2025-11-02) ───────── */
const P = (code: string, parent: string | null, title_ar: string, text_ar: string, sort: number): StandardRow => ({ framework: 'pas', code, parent, title_ar, text_ar, weight: null, sort, source: 'official' });
export const PAS_STANDARDS: StandardRow[] = [
  P('1', null, 'تصميم وتطوير البرنامج', 'يتوافق البرنامج مع متطلبات الإطار الوطني للمؤهلات، وتتسق أهداف البرنامج ونواتج التعلم مع الاحتياجات التنموية وسوق العمل، وتتضمن عملية التصميم والتطوير مشاركة فاعلة لأصحاب المصلحة وجهات العمل.', 10),
  P('1.1', '1', 'البيانات الوصفية ونواتج التعلم', 'تتوافق البيانات الوصفية للبرنامج (اسم المؤهل والمستوى ومجال التخصص، والحد الأدنى للساعات (الوحدات التدريبية) المعتمدة، وعدد السنوات الدراسية)، ونواتج التعلم مع اشتراطات الإطار الوطني للمؤهلات والمعايير المهنية والتخصصية المعتمدة في مجال التخصص.', 11),
  P('1.2', '1', 'الشراكة مع أصحاب المصلحة', 'يُطبّق البرنامج منهجية فاعلة للشراكة مع أصحاب المصلحة وجهات العمل لتحديد متطلباتهم الحالية وتوقعاتهم المستقبلية عند تصميم وتطوير البرنامج، ويستفاد من هذه الشراكة في تطوير البرنامج.', 12),
  P('1.3', '1', 'مصادر التعلم والمرافق', 'يحدد البرنامج مصادر التعلم والمرافق والتجهيزات اللازمة لتحقيق أهدافه، ويتضمن منهجية واضحة لمتابعة استخدامها وتحديثها بمشاركة أصحاب المصلحة.', 13),
  P('1.4', '1', 'المحتوى التدريبي', 'يراعي المحتوى التدريبي تحقيق أهداف البرنامج ونواتج التعلم والتطورات العلمية والتقنية والمهنية في مجال التخصص، ويخضع إعداده وتطويره لقيم الأمانة العلمية وحقوق الملكية الفكرية.', 14),
  P('1.5', '1', 'إستراتيجيات التدريب', 'يحدد البرنامج إستراتيجيات التدريب المناسبة لتحقيق نواتج تعلم البرنامج، بما في ذلك متطلبات التدريب التعاوني و/أو التدريب على رأس العمل و/أو التلمذة المهنية.', 15),
  P('1.6', '1', 'قياس نواتج التعلم', 'يحدد البرنامج الآليات والأدوات المناسبة لقياس نواتج التعلم والتحقق من استيفائها وفق مستويات أداء وخطط تقييم محددة.', 16),
  P('2', null, 'تقويم وجودة البرنامج', 'يُطبّق البرنامج إستراتيجيات التدريب وطرق التقويم المناسبة والمتنوعة لتحقيق نواتج التعلم وقياسها، وتُستخدم نتائج التقويم والتقارير الدورية في تحسين وتطوير البرنامج.', 20),
  P('2.1', '2', 'إستراتيجيات التدريب ونتائج التقويم', 'يُطبّق البرنامج إستراتيجيات تدريب متنوعة لتحقيق أهدافه العامة والتخصصية، ويستفاد من نتائج التقويم والتقارير الدورية في تطوير البرنامج.', 21),
  P('2.2', '2', 'أدوات التقويم والإجراءات التصحيحية', 'يُطبّق البرنامج أدوات تقويم متنوعة ومناسبة تقيس مستوى تقدم المتدربين في تحقيق نواتج التعلم، وتتخذ الإجراءات التصحيحية للرفع من تحصيلهم وفقاً لنتائج التقويم.', 22),
  P('2.3', '2', 'الموارد والتجهيزات', 'يستخدم البرنامج الموارد والتجهيزات اللازمة لتنفيذ التدريب (بما في ذلك الموارد التقنية) بفاعلية، ويقوم بتحديثها بصورة منتظمة، ويتابع طرق ومدى استخدامها وتتخذ الإجراءات التصحيحية وفقًا لذلك.', 23),
  P('2.4', '2', 'التدريب التعاوني وعلى رأس العمل', 'يتحقق البرنامج من فعالية التدريب التعاوني و/أو التدريب على رأس العمل و/أو التلمذة المهنية في تحقيق أهدافه ونواتج التعلم المستهدفة، ويستفاد من النتائج والتقارير في تطوير البرنامج.', 24),
  P('2.5', '2', 'مؤشرات الأداء واستطلاعات المستفيدين', 'تُستخدم مؤشرات الأداء واستطلاعات أصحاب المصلحة والمستفيدين في تقويم ومراجعة البرنامج وجودة مخرجاته، وتُستخدم النتائج لتطوير وتحسين البرنامج.', 25),
  P('2.6', '2', 'التقويم الذاتي والمراجعة', 'يُطبّق البرنامج آليات واضحة ومنتظمة لتقويم ومراجعة البرنامج (بما في ذلك التقويم الذاتي، المراجعة الخارجية)، ويستفاد من النتائج والتقارير في تحسين وتطوير البرنامج.', 26),
  P('3', null, 'المتدربون', 'يقدم البرنامج خدمات الدعم والتوجيه والإرشاد لمتدربي البرنامج لرفع معدلات إكمالهم واستبقائهم، وتنمية ومواءمة مهاراتهم مع متطلبات سوق العمل وتعزيز تعلمهم، ومتابعة إجراءات توظيفهم، ويستفاد من النتائج والتقارير الدورية للتطوير والتحسين المستمر.', 30),
  P('3.1', '3', 'الدعم والتوجيه والإرشاد', 'تُقدم خدمات الدعم والتوجيه والإرشاد للمتدربين لرفع معدلات إكمالهم واستبقائهم، ويتم إجراء تقويم شامل لجودة وكفاية هذه الخدمات، ويستفاد من النتائج والتقارير الدورية للتطوير والتحسين المستمر.', 31),
  P('3.2', '3', 'الدعم المهني ومواءمة المهارات', 'يقدم البرنامج خدمات الدعم المهني المناسب للمتدربين لمواءمة مهاراتهم مع متطلبات سوق العمل، ويستفاد من النتائج والتقارير الدورية في تطوير وتحسين الخدمات.', 32),
  P('3.3', '3', 'المتميزون والمتعثرون وذوو الإعاقة', 'يُطبّق البرنامج آليات ملائمة للتعرف على المتدربين المتميزين والمتعثرين، والمتدربين من ذوي الإعاقة، ويوفر الخدمات المناسبة لرعايتهم وتحفيزهم ودعمهم، ويستفاد من النتائج والتقارير الدورية في تطوير الخدمات المقدمة.', 33),
  P('3.4', '3', 'الانتظام والمشاركة', 'يُطبّق البرنامج آليات لضمان انتظام المتدربين في الحضور والمشاركة الفاعلة في التدريب، وتتخذ الإجراءات التصحيحية اللازمة لذلك.', 34),
  P('3.5', '3', 'متابعة الخريجين', 'يُطبّق البرنامج آليات منتظمة للتواصل مع الخريجين، ومتابعة حصولهم على وظائف في مجال تخصصاتهم، ويحتفظ بقواعد بيانات محدثة وشاملة عنهم لخدمة مبادرات التوظيف الوطنية (بما في ذلك المرصد الوطني للعمل)، وتتخذ الإجراءات التصحيحية اللازمة لذلك.', 35),
  P('4', null, 'المدربون', 'تُطبق معايير محددة لاختيار الكوادر البشرية المؤهلة لتقديم البرنامج، وتتخذ الإجراءات اللازمة لاستبقائهم وتمكينهم من التطوير المهني لتعزيز جودة أدائهم، وتُتابع إجراءات التحسين والتطوير.', 40),
  P('4.1', '4', 'كفاية المدربين وخبرتهم', 'يتوافر في البرنامج العدد الكافي من المدربين المهنيين من ذوي الخبرة والمهارة والممارسة المهنية المناسبة في مجال البرنامج، وتوجد آليات مناسبة لمتابعة ذلك.', 41),
  P('4.2', '4', 'استبقاء المدربين', 'يُوجد منهجية فاعلة ومطبقة لاستبقاء المدربين، وتتخذ الإجراءات التصحيحية اللازمة لذلك.', 42),
  P('4.3', '4', 'التطوير المهني للمدربين', 'يُوجد منهجية فاعلة ومطبقة لتمكين المدربين من التطوير المهني المستمر للرفع من أدائهم وتأهيلهم وفق احتياجاتهم ومتطلبات البرنامج، وتتخذ الإجراءات التصحيحية اللازمة لذلك.', 43),
  P('4.4', '4', 'جودة أداء المدربين', 'يُطبّق البرنامج آليات منتظمة للتأكد من جودة أداء المدربين، وتطبيقهم لمنهجيات وإستراتيجيات التدريب المحددة في أدلة البرنامج (بما في ذلك دليل المدرب)، وتتخذ الإجراءات اللازمة للتحسين والتطوير.', 44),
];
/* ───────── 2) الإطار الثاني: المعايير المهنية للمعلمين (3 مجالات بأوزانها · 10 معايير عامة · 21 فرعيًّا) ───────── */
const T = (code: string, parent: string | null, title_ar: string, weight: number | null, sort: number): StandardRow => ({ framework: 'tps', code, parent, title_ar, text_ar: title_ar, weight, sort, source: 'official' });
export const TPS_STANDARDS: StandardRow[] = [
  T('A', null, 'القيم والمسؤوليات المهنية', 21, 100),
  T('1', 'A', 'الالتزام بالقيم الإسلامية الوسطية، وأخلاقيات المهنة، وتعزيز الهوية الوطنية', null, 110), T('1.1', '1', 'الالتزام بالقيم الإسلامية الوسطية', null, 111), T('1.2', '1', 'تعزيز الهوية الوطنية والتنوع الثقافي', null, 112), T('1.3', '1', 'الالتزام بالأنظمة واللوائح والسياسات التعليمية وأخلاقيات المهنة', null, 113),
  T('2', 'A', 'التطوير المهني المستمر', null, 120), T('2.1', '2', 'وضع خطة للتطوير المهني في ضوء المعايير المهنية', null, 121), T('2.2', '2', 'تطوير الأداء المهني في ضوء نتائج التقويم والتغذية الراجعة', null, 122),
  T('3', 'A', 'التفاعل المهني مع التربويين والمجتمع', null, 130), T('3.1', '3', 'التفاعل مع أسر الطلاب والمجتمع المحلي', null, 131), T('3.2', '3', 'التفاعل مع الزملاء والمجتمع المهني لتطوير الممارسات التعليمية', null, 132),
  T('B', null, 'المعرفة المهنية', 40, 200),
  T('4', 'B', 'الإلمام بالمهارات اللغوية والكمية', null, 210), T('4.1', '4', 'الإلمام بالمهارات اللغوية (العربية) واستخداماتها في التواصل والتعليم', null, 211), T('4.2', '4', 'الإلمام بالمهارات الكمية الأساسية واستخداماتها في التحليل والتفسير', null, 212),
  T('5', 'B', 'المعرفة بالطالب وكيفية تعلمه', null, 220), T('5.1', '5', 'خصائص النمو البشري وتطبيقاتها في التعليم والتعلم', null, 221), T('5.2', '5', 'الفروق الفردية بين الطلاب وأساليب مراعاتها وتفريد التعليم', null, 222), T('5.3', '5', 'خصائص الطلاب ذوي الاحتياجات الخاصة واحتياجاتهم التعليمية', null, 223),
  T('6', 'B', 'المعرفة بمحتوى التخصص وطرق تدريسه', null, 230), T('6.1', '6', 'الإلمام بمحتوى التخصص ومفاهيمه وبنيته المعرفية', null, 231), T('6.2', '6', 'الإلمام بطرق التدريس الخاصة بالتخصص وتطبيقاتها', null, 232),
  T('7', 'B', 'المعرفة بالمنهج وطرق التدريس العامة', null, 240), T('7.1', '7', 'المعرفة بمفهوم المنهج ومكوناته وأسس بنائه وتقويمه', null, 241), T('7.2', '7', 'الإلمام بنظريات التعلم وتطبيقاتها التربوية واستراتيجيات التدريس العامة', null, 242),
  T('C', null, 'الممارسة المهنية', 39, 300),
  T('8', 'C', 'التخطيط للتدريس وتنفيذه', null, 310), T('8.1', '8', 'التخطيط الفعال للدروس والوحدات الدراسية وتطويرها', null, 311), T('8.2', '8', 'تنفيذ التدريس وإدارة عمليات التعلم وتوظيف التقنيات بفاعلية', null, 312),
  T('9', 'C', 'تهيئة بيئات تعلم تفاعلية وداعمة للطالب', null, 320), T('9.1', '9', 'تهيئة بيئة صفية آمنة ومحفزة وإدارة التفاعل والتعلم الاجتماعي', null, 321), T('9.2', '9', 'غرس التوقعات العالية لدى الطلاب ودعم دافعيتهم للتعلم', null, 322),
  T('10', 'C', 'التقويم', null, 330), T('10.1', '10', 'تصميم أدوات تقويم متنوعة وموضوعية، وتحليل مخرجاتها، وتقديم التغذية الراجعة', null, 331),
];
export const DEFAULT_STANDARDS: StandardRow[] = [...PAS_STANDARDS, ...TPS_STANDARDS];
export const subsOf = (rows: StandardRow[], fw: Framework, parent: string) => rows.filter(r => r.framework === fw && r.parent === parent).sort((a, b) => a.sort - b.sort);
export const topsOf = (rows: StandardRow[], fw: Framework) => rows.filter(r => r.framework === fw && r.parent === null).sort((a, b) => a.sort - b.sort);
/** معايير المعلّم العامة العشرة (للربط بالكفايات) مع مجالها */
export const tpsGeneral = (rows: StandardRow[]) => rows.filter(r => r.framework === 'tps' && r.parent && ['A', 'B', 'C'].includes(r.parent)).sort((a, b) => a.sort - b.sort);

/* ───────── 3) الأدلة: الأنواع والقواعد ───────── */
export type EvidenceKind = 'program' | 'design' | 'units' | 'template' | 'need' | 'charter' | 'weekly' | 'final' | 'diploma_unit' | 'pulse' | 'profile' | 'review' | 'version' | 'attendance' | 'enrollment' | 'support' | 'after' | 'trainer' | 'trainer_pd' | 'skill_map'
  | 'miaar_exit' | 'miaar_units' | 'miaar_remedial' | 'miaar_effect' | 'miaar_retake' /* م9 أدلة مِعيار */;
export type Evidence = { id: string; kind: EvidenceKind; codes: string[]; label_ar: string; at: string | null; href: string | null; n?: number };
export const EVIDENCE_KIND_AR: Record<EvidenceKind, string> = { program: 'بيانات البرنامج', design: 'هندسة البرنامج', units: 'وحدات البرنامج', template: 'قالب الكفايات والاستراتيجيات', need: 'احتياج معلَن تبنّاه البرنامج', charter: 'ميثاق الجهة', weekly: 'تقرير تعلّم أسبوعي معتمَد', final: 'تقرير ختامي معتمَد', diploma_unit: 'تقرير وحدة معتمَد', pulse: 'نبض الأسبوع', profile: 'كشف كفايات معتمَد', review: 'مراجعة البرنامج بعد الدفعة (معتمَدة)', version: 'نسخة الدفعة المطبَّقة', attendance: 'سجلّ الحضور', enrollment: 'التسجيل والقبول والتنسيب', support: 'قرارات الدعم والإعادة', after: 'محطات الأثر بعد البرنامج', trainer: 'سيرة مدرّب موثَّقة في هيئة أَثَر', trainer_pd: 'تطوير مهني للمدرّب (بروفة · أَثَر معك · شهادة قرين)', skill_map: 'ربط الكفايات بمعايير المعلّم',
  miaar_exit: 'نهاية المستوى (مِعيار)', miaar_units: 'خريطة المنهج (مِعيار)', miaar_remedial: 'جلسة تعويض (مِعيار)', miaar_effect: 'أثر التعويض (مِعيار)', miaar_retake: 'إعادة مهارة (مِعيار)',
};
/** لكل معيار فرعي: الحدّ الأدنى من الأدلة ليُعدّ مستوفى، وهل له مصدر آلي، والمهمة التي تُنتج دليله ورابطها */
export type EvidenceRule = { min: number; auto: boolean; task_ar: string; href: string };
export const EVIDENCE_RULES: Record<string, EvidenceRule> = {
  '1.1': { min: 2, auto: true, task_ar: 'أكمل بيانات البرنامج (النوع · الساعات) وحدّد وحداته ونواتجها', href: '/me/reports#diploma' },
  '1.2': { min: 1, auto: true, task_ar: 'اربط البرنامج باحتياج معلَن من الممارسين أو بميثاق جهة', href: '/needs' },
  '1.3': { min: 1, auto: false, task_ar: 'اكتب فقرة مصادر التعلم والمرافق ووقّعها', href: '#narrative' },
  '1.4': { min: 1, auto: true, task_ar: 'أنشئ تصميم البرنامج في «هندسة البرامج التدريبية» أو اكتب نواتج الوحدات', href: '/me/reports#diploma' },
  '1.5': { min: 1, auto: true, task_ar: 'حدّد استراتيجيات التدريب في قالب البرنامج', href: '/me/reports' },
  '1.6': { min: 1, auto: true, task_ar: 'حدّد كفايات القالب وأدوات قياسها أو نواتج الوحدات', href: '/me/reports' },
  '2.1': { min: 2, auto: true, task_ar: 'اعتمد تقارير التعلّم الدورية، وطبّق نسخة دفعة من مراجعة معتمَدة', href: '/me/reports' },
  '2.2': { min: 2, auto: true, task_ar: 'اعتمد تقارير وحدات/أسابيع فيها قرارات دعم أو إعادة — أو أنشئ جلسة تعويض من خريطة المنهج', href: '/me/reports' },
  '2.3': { min: 1, auto: false, task_ar: 'اكتب فقرة الموارد والتجهيزات وتحديثها ووقّعها', href: '#narrative' },
  '2.4': { min: 1, auto: false, task_ar: 'اكتب فقرة التدريب التعاوني/على رأس العمل (أو «لا ينطبق» مع السبب) ووقّعها', href: '#narrative' },
  '2.5': { min: 1, auto: true, task_ar: 'اعتمد تقريرًا ختاميًّا أو مراجعة بعد الدفعة (مؤشرات الأداء) — أو شغّل اختبار نهاية المستوى (مِعيار) لشعبة من البرنامج', href: '/me/reports' },
  '2.6': { min: 1, auto: true, task_ar: 'افتح «مراجعة البرنامج بعد الدفعة» واعتمدها', href: '/me/reports#reviews' },
  '3.1': { min: 1, auto: true, task_ar: 'اقبل المسجَّلين ونسّبهم إلى شعب، واكتب خطط الدعم في التقارير', href: '/admin' },
  '3.2': { min: 1, auto: true, task_ar: 'اعتمد كشوف الكفايات أو محطات الأثر (90 يومًا)', href: '/me/reports#diploma' },
  '3.3': { min: 1, auto: true, task_ar: 'سجّل قرارات «يُرقَّى/يُدعَم/يُعيد» في تقارير الأسابيع والوحدات — أو رقِّ المجتازين بتوقيعك من لوحة عُبور', href: '/me/reports' },
  '3.4': { min: 1, auto: true, task_ar: 'سجّل الحضور في الجلسات (خمسة متدرّبين فأكثر)', href: '/attend' },
  '3.5': { min: 1, auto: true, task_ar: 'فعّل محطات الأثر (90 يومًا · السنة) لخريجي البرنامج', href: '/me/after' },
  '4.1': { min: 1, auto: true, task_ar: 'ادعُ مدرّبي البرنامج إلى توثيق سيرهم في هيئة أَثَر', href: '/me/directory' },
  '4.2': { min: 1, auto: false, task_ar: 'اكتب فقرة منهجية استبقاء المدرّبين ووقّعها', href: '#narrative' },
  '4.3': { min: 1, auto: true, task_ar: 'شجّع المدرّبين على «بروفة» و«أَثَر معك» وشهادة القرين', href: '/me/rehearsal' },
  '4.4': { min: 1, auto: true, task_ar: 'اعتمد تقارير المدرّبين الدورية (تُظهر الاستراتيجيات المطبَّقة)', href: '/me/reports' },
};
export const PAS_SUB_CODES = Object.keys(EVIDENCE_RULES);
export type SubCoverage = { code: string; state: Coverage; n: number; min: number; evidence: Evidence[]; signed: boolean; task_ar: string; href: string };
export type StandardCoverage = { code: string; title_ar: string; subs: SubCoverage[]; met: number; partial: number; missing: number; manual: number; pct: number };
/** التغطية: لكل معيار فرعي حالة نصّية؛ المعيار اليدوي يُستوفى بفقرة موقَّعة */
export function coverageOf(rows: StandardRow[], evidence: Evidence[], signedCodes: Set<string>): StandardCoverage[] {
  return topsOf(rows, 'pas').map(top => {
    const subs: SubCoverage[] = subsOf(rows, 'pas', top.code).map(s => {
      const rule = EVIDENCE_RULES[s.code] || { min: 1, auto: false, task_ar: 'اكتب فقرة المعيار ووقّعها', href: '#narrative' }; const ev = evidence.filter(e => e.codes.includes(s.code)); const signed = signedCodes.has(s.code);
      const state: Coverage = !rule.auto ? (signed ? 'met' : 'manual') : ev.length >= rule.min ? 'met' : ev.length > 0 ? 'partial' : 'missing';
      return { code: s.code, state, n: ev.length, min: rule.min, evidence: ev, signed, task_ar: rule.task_ar, href: rule.href };
    });
    const c = (st: Coverage) => subs.filter(x => x.state === st).length; const met = c('met'), partial = c('partial'), missing = c('missing'), manual = c('manual');
    return { code: top.code, title_ar: top.title_ar, subs, met, partial, missing, manual, pct: subs.length ? Math.round(((met + partial * 0.5) / subs.length) * 100) : 0 };
  });
}
export const missingTasks = (cov: StandardCoverage[]) => cov.flatMap(s => s.subs.filter(x => x.state !== 'met').map(x => ({ code: x.code, state: x.state, task_ar: x.task_ar, href: x.href })));
export const fileScore = (cov: StandardCoverage[]) => { const subs = cov.flatMap(s => s.subs); const met = subs.filter(x => x.state === 'met').length; return { met, total: subs.length, pct: subs.length ? Math.round((met / subs.length) * 100) : 0 }; };
/** شروط التأهّل المعلنة من الهيئة — تُشتقّ من الأدلة (لا تُكتب) */
export function eligibilityOf(p: { program_type: string | null; cohorts_done: number; graduates_feedback: number; has_units: boolean }) {
  return [
    { key: 'qualification', ok: p.program_type === 'diploma', text_ar: 'برنامج منتهٍ بمؤهل (دبلوم فما دون)' },
    { key: 'description', ok: p.has_units, text_ar: 'توصيف واضح وشامل (وحدات بنواتج وساعات)' },
    { key: 'cohort', ok: p.cohorts_done >= 1, text_ar: 'خرّج دفعة واحدة على الأقل' },
    { key: 'feedback', ok: p.graduates_feedback >= 1, text_ar: 'تغذية راجعة من الخريجين أو جهات التوظيف' },
  ];
}
/* ───────── 4) الفقرة السردية ───────── */
export type Narrative = { framework: Framework; code: string; text_ar: string; evidence_ids: string[]; signed_by: string | null; signed_name: string | null; signed_at: string | null; source: 'local' | 'ai' | 'human' };
export const cleanNarrativeText = (v: unknown) => S(v, NARRATIVE_MAX);
export const narrativeMissing = (text: string) => text.trim().length < NARRATIVE_MIN ? [`الفقرة قصيرة (${NARRATIVE_MIN} حرفًا على الأقل)`] : [];
/** مسودّة محلية من الأدلة فقط — جمل قصيرة، أرقام مجاميع، لا أسماء */
export function localNarrative(std: StandardRow, subs: SubCoverage[]): string {
  const have = subs.filter(s => s.evidence.length); const miss = subs.filter(s => s.state === 'missing' || s.state === 'manual');
  const bits = have.map(s => `${s.code}: ${Array.from(new Set(s.evidence.map(e => EVIDENCE_KIND_AR[e.kind]))).slice(0, 3).join('، ')}${s.evidence.some(e => e.n) ? ` (${s.evidence.filter(e => e.n).map(e => e.n).reduce((a, b) => (a || 0) + (b || 0), 0)})` : ''}`);
  const head = `في معيار «${std.title_ar}» يستند البرنامج إلى أدلة معتمَدة في أَثَر${bits.length ? `: ${bits.join('؛ ')}.` : '.'}`;
  const tail = miss.length ? ` ما لم يثبت بعد: ${miss.map(s => s.code).join('، ')} — ويُستكمل بإجراءات محدّدة.` : ' كل المعايير الفرعية مدعومة بدليل.';
  return S(head + tail, NARRATIVE_MAX);
}
export function narrativePrompt(std: StandardRow, subs: { code: string; text_ar: string }[], cov: SubCoverage[]): string {
  const ev = cov.map(c => `- ${c.code} [${COVERAGE_AR[c.state]}]: ${c.evidence.map(e => `${EVIDENCE_KIND_AR[e.kind]}${e.n ? ` ×${e.n}` : ''}${e.at ? ` (${e.at})` : ''}`).join('؛ ') || 'لا دليل'}`).join('\n');
  return `أنت تكتب فقرة «الدراسة الذاتية» لبرنامج تدريبي في ملف اعتماد برامجي (هيئة تقويم التعليم والتدريب). اكتب بالعربية الفصحى فقرة واحدة (120–220 كلمة) عن المعيار «${std.title_ar}»: ${std.text_ar}
المعايير الفرعية:\n${subs.map(s => `- ${s.code}: ${s.text_ar}`).join('\n')}
الأدلة المعتمَدة المتاحة (لا تخترع دليلًا، ولا تذكر أسماء أشخاص، واذكر ما لم يثبت صراحةً):\n${ev}
أعد النصّ فقط بلا عناوين ولا تعداد.`;
}
export function parseNarrative(raw: string): string { return S(String(raw || '').replace(/^```[a-z]*\n?|```$/g, '').replace(/^#+.*$/gm, ''), NARRATIVE_MAX); }
/* ───────── 5) خريطة كفايات البرنامج → معايير المعلّم العامة ───────── */
export type SkillMap = Record<string, string[]>;
export function cleanSkillMap(given: unknown, skillCodes: string[], tpsCodes: string[]): SkillMap {
  const out: SkillMap = {}; if (!given || typeof given !== 'object') return out; const ok = new Set(tpsCodes);
  for (const code of skillCodes) { const v = (given as any)[code]; if (Array.isArray(v)) { const arr = Array.from(new Set(v.map(x => String(x)).filter(x => ok.has(x)))).slice(0, 10); if (arr.length) out[code] = arr; } }
  return out;
}
export function skillMapCoverage(map: SkillMap, tpsCodes: string[]) { const covered = new Set(Object.values(map).flat()); return { covered: tpsCodes.filter(c => covered.has(c)), n: tpsCodes.filter(c => covered.has(c)).length, total: tpsCodes.length }; }
/** عرض عام للملف (P48-ب يستعمله للتجميد والرابط الخارجي) — بلا أسماء */
export function filePublicView(v: { program_ar: string; cov: StandardCoverage[]; narratives: Narrative[]; updated_at: string | null }) {
  const sc = fileScore(v.cov); return { program_ar: v.program_ar, met: sc.met, total: sc.total, pct: sc.pct, standards: v.cov.map(s => ({ code: s.code, title_ar: s.title_ar, met: s.met, partial: s.partial, missing: s.missing, manual: s.manual, pct: s.pct, subs: s.subs.map(x => ({ code: x.code, state: x.state, state_ar: COVERAGE_AR[x.state], n: x.n })) })), narratives: v.narratives.filter(n => n.signed_at).map(n => ({ framework: n.framework, code: n.code, text_ar: n.text_ar, signed_at: String(n.signed_at || '').slice(0, 10) })), updated_at: v.updated_at };
}

/* ═════════ P48-ب — التجميد والتحقّق والتجميع ═════════ */
export const P48B_NAMES_AR = {
  freeze: 'جمِّد نسخة للمراجِع', snapshot: 'نسخة مختومة', snapshots: 'النسخ المختومة', official: 'نسخة معتمَدة من ملف الدراسة الذاتية (قابلة للتحقّق)', verify: 'التحقّق من ملف اعتماد',
  clock: 'ساعة المراجِع', ageing: 'دليل سيشيخ', ageing_card: 'أدلة تحتاج تجديدًا', note: 'كلمة إلى المراجِع', diff: 'ما تغيّر منذ آخر تجميد', rollup: 'جامعة أَثَر في صورة واحدة', strip: 'ملف الاعتماد',
  intact: 'مطابق للأصل', tampered: 'غير مطابق — راجع الطاقم', delivery: 'شهادة تسليم',
} as const;
export const NOTE_MAX = 300; export const AGE_MONTHS = 12; export const SNAPSHOT_PREFIX = 'A';
const SNAP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function snapshotCode(rnd: () => number = Math.random): string { let s = SNAPSHOT_PREFIX; for (let i = 0; i < 9; i++) s += SNAP_ALPHABET[Math.floor(rnd() * SNAP_ALPHABET.length)]; return s; }
export const cleanNote = (v: unknown) => S(v, NOTE_MAX);
/** JSON قانوني: مفاتيح مرتّبة في كل مستوى — البصمة تُحسب عليه لا على HTML */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>; return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}
/** شروط التجميد: فقرة موقَّعة لكل معيار رئيس */
export function freezeMissing(cov: StandardCoverage[], narratives: Narrative[]): string[] {
  const signed = new Set(narratives.filter(n => n.framework === 'pas' && n.signed_at).map(n => n.code));
  return cov.filter(s => !signed.has(s.code)).map(s => `المعيار ${s.code} «${s.title_ar}» بلا فقرة موقَّعة`);
}
export type TimelineItem = { at: string | null; kind: EvidenceKind; kind_ar: string; label_ar: string; codes: string[]; top: string; ageing: boolean };
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
export const isAgeing = (at: string | null, now = new Date()) => !!at && monthsBetween(new Date(String(at).slice(0, 10) + 'T00:00:00Z'), now) >= AGE_MONTHS;
/** «ساعة المراجِع»: الأدلة مرتّبة زمنيًّا (المؤرَّخة أولًا تصاعديًّا ثم غير المؤرَّخة) مع علامة الشيخوخة */
export function evidenceTimeline(evidence: Evidence[], now = new Date()): TimelineItem[] {
  const seen = new Set<string>(); const out: TimelineItem[] = [];
  for (const e of evidence) { if (seen.has(e.id)) continue; seen.add(e.id); out.push({ at: e.at, kind: e.kind, kind_ar: EVIDENCE_KIND_AR[e.kind], label_ar: e.label_ar, codes: e.codes, top: (e.codes[0] || '').split('.')[0], ageing: isAgeing(e.at, now) }); }
  return out.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.at ? -1 : b.at ? 1 : 0));
}
export const ageingEvidence = (evidence: Evidence[], now = new Date()) => evidence.filter(e => isAgeing(e.at, now));
/** جسم النسخة المختومة — كل ما يراه المراجِع، بلا أسماء متدرّبين ولا روابط داخلية */
export function snapshotBody(v: { program_ar: string; org_ar: string | null; program_type: string | null; cov: StandardCoverage[]; narratives: Narrative[]; eligibility: { key: string; ok: boolean; text_ar: string }[]; timeline: TimelineItem[]; standards: StandardRow[]; skill_map_coverage: { n: number; total: number }; frozen_at: string; note_ar: string }) {
  const pub = filePublicView({ program_ar: v.program_ar, cov: v.cov, narratives: v.narratives, updated_at: v.frozen_at });
  return { ...pub, org_ar: v.org_ar, program_type: v.program_type, eligibility: v.eligibility, timeline: v.timeline.map(t => ({ at: t.at, kind: t.kind, kind_ar: t.kind_ar, label_ar: t.label_ar, codes: t.codes, ageing: t.ageing })), ageing_n: v.timeline.filter(t => t.ageing).length,
    standards: pub.standards.map(s => ({ ...s, text_ar: v.standards.find(r => r.framework === 'pas' && r.code === s.code)?.text_ar || '', subs: s.subs.map(x => ({ ...x, title_ar: v.standards.find(r => r.framework === 'pas' && r.code === x.code)?.title_ar || '' })) })),
    skill_map_coverage: v.skill_map_coverage, frozen_at: v.frozen_at, note_ar: v.note_ar };
}
/** بصمة نصوص المعايير (إطار pas) — تُختم مع النسخة */
export const standardsCanonical = (rows: StandardRow[]) => canonicalJson(rows.filter(r => r.framework === 'pas').map(r => ({ code: r.code, title_ar: r.title_ar, text_ar: r.text_ar })).sort((a, b) => a.code.localeCompare(b.code)));
export type CoverageDiff = { improved: { code: string; from: Coverage; to: Coverage }[]; regressed: { code: string; from: Coverage; to: Coverage }[]; met_from: number; met_to: number };
const RANK: Record<Coverage, number> = { missing: 0, manual: 0, partial: 1, met: 2 };
/** «ما تغيّر منذ آخر تجميد»: مقارنة حالات المعايير الفرعية بين جسمين */
export function coverageDiff(prev: { standards: { subs: { code: string; state: Coverage }[] }[]; met: number } | null, cur: { standards: { subs: { code: string; state: Coverage }[] }[]; met: number }): CoverageDiff | null {
  if (!prev) return null; const p = new Map(prev.standards.flatMap(s => s.subs).map(x => [x.code, x.state])); const d: CoverageDiff = { improved: [], regressed: [], met_from: prev.met, met_to: cur.met };
  for (const x of cur.standards.flatMap(s => s.subs)) { const from = p.get(x.code); if (!from || from === x.state) continue; (RANK[x.state] > RANK[from] ? d.improved : d.regressed).push({ code: x.code, from, to: x.state }); }
  return d;
}
/** عرض النسخة للعامة: الجسم + البيانات الوصفية (الموقِّع بصفته المهنية فقط) */
export function snapshotPublicView(r: { code: string; sha256: string; standards_sha: string; body: any; frozen_name: string | null; frozen_at: string; score_met: number; score_total: number; eligible: boolean; note_ar: string | null }, intact: boolean) {
  return { code: r.code, sha256: r.sha256, standards_sha: r.standards_sha, standards_sha_short: String(r.standards_sha || '').slice(0, 8), intact, frozen_name: r.frozen_name, frozen_at: r.frozen_at, score_met: r.score_met, score_total: r.score_total, eligible: r.eligible, note_ar: r.note_ar || '', ...(r.body || {}) };
}

/** P48-ب.1 — الجهة الغالبة: أكثر معرّف تكرارًا في قائمة (تسجيلات معتمَدة) — null إن خلت القائمة؛ عند التعادل يُؤخذ الأقدم ظهورًا */
export function dominantId(ids: Array<string | null | undefined>): string | null {
  const n = new Map<string, number>(); const order: string[] = [];
  for (const raw of ids) { const id = String(raw || '').trim(); if (!id) continue; if (!n.has(id)) order.push(id); n.set(id, (n.get(id) || 0) + 1); }
  let best: string | null = null; for (const id of order) if (best === null || (n.get(id) || 0) > (n.get(best) || 0)) best = id; return best;
}
