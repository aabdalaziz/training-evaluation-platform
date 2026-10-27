// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — «موقف اليوم» (كل يوم بناء · P13-أ): بدل سؤال واختيار، نطرح موقفًا/قضية/حالة فيها توتر خفي؛ يكتب الممارس كيف يتصرّف بكلماته،
 *  ثم نعيد له «مرآة الأداء»: وصف أدائه، ما ظهر من جداراته (بمستوى تقديري)، ما لم يره، احتياجاته التطويرية، وخطوة اليوم — ويُودَع شاهدًا في ملفه.
 *  الموقف يرتبط بالمناسبة (شهر اللغة العربية، شهر الجودة، يوم المرأة، يوم اليتيم، اليوم الوطني…) حين توجد، وبأحد المجالات الاثني عشر دائمًا.
 *  P13-ب: جولة ثانية «ماذا لو؟» (معلومة جديدة تختبر المعيار الغائب) + مقارنة مجهولة «كيف تصرّف N شخصًا آخر اليوم».
 *  التوليد بالذكاء الاصطناعي اختياري؛ بنك محلي غني يضمن الجودة حين يتعذّر النموذج. التقويم المحلي اصطلاحي (تغطية معايير) لا حكمًا نهائيًا على إنسان.
 */
import { parseJsonLoose } from '../ai/prompts';
import { HUMAN_DOMAINS, FAMILIES, eventsFor, eventByCode, domainByCode } from './lexicon';
import type { DomainCode, FamilyCode, Horizon, ActiveEvent } from './lexicon';

// ====================================================================== الأنواع
export type RubricCode = 'frame' | 'parties' | 'options' | 'action' | 'ethics' | 'human_loop' | 'presence' | 'follow_up';
export type RubricItem = { code: RubricCode; weight: number; look_for?: string[] };
export type DailyCase = {
  id?: string; day: string; slug: string;
  title_ar: string; scene_ar: string; role_ar: string; situation_ar: string; twist_ar: string; ask_ar: string;
  parties_ar: string[];
  domain_code: DomainCode; family: FamilyCode; horizon: Horizon;
  skill_codes: string[]; skill_ids?: string[];
  event_code?: string | null; event_name_ar?: string | null;
  rubric: RubricItem[]; source: 'local' | 'ai' | 'human'; model?: string | null;
};
export type Band = 'emerging' | 'capable' | 'distinguished' | 'exceptional';
export type CaseEvaluation = {
  band: Band; score: number;
  performance_ar: string; strengths_ar: string[]; blind_spot_ar: string; needs_ar: string[]; next_step_ar: string;
  skills: { code: string; label_ar: string; level: number; note_ar: string }[];
  rubric_hits: { code: RubricCode; hit: 0 | 1 | 2 }[];
  recommend: { kind: 'program' | 'simulation' | 'resource' | 'mission'; label_ar: string; href: string }[];
  source: 'local' | 'ai'; model?: string | null;
};
export const BAND_LABEL: Record<Band, { ar: string; en: string; tone: string }> = {
  emerging: { ar: 'ناشئ', en: 'Emerging', tone: 'warn' }, capable: { ar: 'متمكّن', en: 'Capable', tone: 'teal' }, distinguished: { ar: 'متميّز', en: 'Distinguished', tone: 'navy' }, exceptional: { ar: 'استثنائي', en: 'Exceptional', tone: 'gold' },
};
export const RUBRIC_LABEL: Record<RubricCode, { ar: string; en: string; hint_ar: string }> = {
  frame: { ar: 'تأطير القضية', en: 'Framing', hint_ar: 'سمّيتَ القضية الجوهرية لا العرض السطحي' },
  parties: { ar: 'مراعاة الأطراف', en: 'Stakeholders', hint_ar: 'ذكرتَ من يتأثر بالقرار وتحدّثت معهم' },
  options: { ar: 'البدائل والمفاضلة', en: 'Options', hint_ar: 'وزنتَ أكثر من خيار قبل أن تختار' },
  action: { ar: 'خطوات محددة بزمن', en: 'Actionable steps', hint_ar: 'خطواتك مرتّبة ولها زمن ومسؤول' },
  ethics: { ar: 'النزاهة والإفصاح', en: 'Integrity', hint_ar: 'الأمانة والشفافية والمساءلة حاضرة في قرارك' },
  human_loop: { ar: 'الاحتفاظ بالحكم البشري', en: 'Human judgment', hint_ar: 'تحققتَ من الآلة ولم تسلّمها القرار' },
  presence: { ar: 'الحضور الإنساني', en: 'Human presence', hint_ar: 'أصغيتَ وطمأنتَ واحترمتَ قبل أن تقرّر' },
  follow_up: { ar: 'المتابعة والتعلّم', en: 'Follow-up', hint_ar: 'حدّدتَ كيف تتأكد لاحقًا أن قرارك عمل' },
};
const MIN_CHARS = 80; export const MIN_RESPONSE_CHARS = MIN_CHARS; export const MAX_RESPONSE_CHARS = 2500;

// ====================================================================== بنك المواقف المحلي (مرتبط بالمجالات والمناسبات)
const R = (frame = 1, parties = 1, options = 1, action = 1, ethics = 1, human_loop = 1, presence = 1, follow_up = 1): RubricItem[] =>
  [['frame', frame], ['parties', parties], ['options', options], ['action', action], ['ethics', ethics], ['human_loop', human_loop], ['presence', presence], ['follow_up', follow_up]].filter(x => (x[1] as number) > 0).map(x => ({ code: x[0] as RubricCode, weight: x[1] as number }));
type Seed = Omit<DailyCase, 'day' | 'source'>;
export const CASE_BANK: Seed[] = [
  // ---------- مناسبات
  { slug: 'arabic-why-learn', title_ar: 'لماذا أتعلّم العربية والترجمة فورية؟', scene_ar: 'الثامنة صباحًا، قاعة في برنامج العربية للناطقين بغيرها. سماعات الترجمة الفورية في آذان نصف الطلاب.', role_ar: 'أنت معلم اللغة العربية في البرنامج.', situation_ar: 'طالب متفوق من إندونيسيا يرفع يده أمام الجميع: «أستاذ، السماعة تترجم كل شيء فورًا. لماذا أقضي سنة أتعلم العربية؟ أريد سببًا واحدًا حقيقيًا لا شعارًا.» عشرون طالبًا ينتظرون جوابك.', twist_ar: 'الطالب يحمل منحة مشروطة بنتيجة مِعيار، وأنت تعلم أنه يفكّر بالانسحاب الليلة. الإدارة طلبت منك قبل أسبوع «تقليل الانسحابات».', ask_ar: 'اكتب ما ستقوله في الدقيقة الأولى، وما ستفعله بعد الحصة، وكيف ستعرف بعد شهر أن ردّك عمل.', parties_ar: ['الطالب', 'بقية الطلاب', 'الإدارة', 'الجهة المانحة'], domain_code: 'language', family: 'presence_influence', horizon: 2050, skill_codes: ['ATH-AR-003'], event_code: 'arabic_day', rubric: R(2, 1, 1, 1, 1, 1, 2, 1) },
  { slug: 'arabic-generated-text', title_ar: 'النص الذي كتبه الطالب… أم الآلة؟', scene_ar: 'مساء، تصحيح أوراق كتابة لمستوى B2. القهوة باردة.', role_ar: 'أنت مقيّم مهارة الكتابة.', situation_ar: 'نص طالبة قفز من مستوى A2 الأسبوع الماضي إلى نص بليغ بلا خطأ واحد. لا يوجد دليل قاطع على أنه مولَّد، لكن حدسك يقول ذلك. غدًا تُعلَن الدرجات، والطالبة من أكثرهن اجتهادًا.', twist_ar: 'سياسة البرنامج لا تذكر الذكاء الاصطناعي أصلًا، وزميلك يقول: «لا تفتح هذا الباب، سنُتَّهم بالظلم».', ask_ar: 'كيف تتصرّف غدًا؟ ما الذي تفعله مع الطالبة، ومع الدرجة، ومع السياسة؟', parties_ar: ['الطالبة', 'الزميل', 'الإدارة', 'بقية الطالبات'], domain_code: 'integrity', family: 'verification_trust', horizon: 2035, skill_codes: ['ATH-AR-003', 'ATH-QA-001'], event_code: 'arabic_month', rubric: R(1, 1, 2, 1, 2, 2, 1, 1) },
  { slug: 'quality-indicator-lies', title_ar: 'المؤشر الأخضر الذي يكذب', scene_ar: 'اجتماع المراجعة الشهرية. لوحة المؤشرات كلها خضراء.', role_ar: 'أنت مسؤول الجودة في مركز تدريب.', situation_ar: 'نسبة الرضا 96% ونسبة الإتمام 91%، والمدير يريد نشر الأرقام اليوم. لكنك زرتَ قاعة أمس ورأيت متدربين يملؤون الاستبانة قبل انتهاء الجلسة، ومدربًا يقول «لا تنسوا التقييم الممتاز».', twist_ar: 'المركز ينتظر تجديد اعتماد الأسبوع القادم، والمدير هو من عيّنك.', ask_ar: 'ماذا تقول في الاجتماع، وما الذي تغيّره في طريقة القياس، وكيف تحمي الاعتماد والصدق معًا؟', parties_ar: ['المدير', 'المدربون', 'المتدربون', 'جهة الاعتماد'], domain_code: 'judgment', family: 'verification_trust', horizon: 2035, skill_codes: ['ATH-QA-001'], event_code: 'quality_month', rubric: R(2, 1, 1, 1, 2, 1, 0, 2) },
  { slug: 'quality-day-audit', title_ar: 'تدقيق في يوم الجودة', scene_ar: 'اليوم العالمي للجودة. مدقق خارجي في مكتبك يطلب «أدلة الأثر» لثلاثة برامج.', role_ar: 'أنت مدير برامج.', situation_ar: 'لديك استبانات رضا كثيرة، ولا شيء عن تغيّر السلوك بعد 60 يومًا إلا رسائل شكر متفرقة من مشرفين. المدقق يسأل: «كيف تعرفون أن التدريب غيّر شيئًا؟»', twist_ar: 'أحد البرامج الثلاثة تعرف داخلك أنه لم يغيّر شيئًا.', ask_ar: 'أجب المدقق بصدق، ثم اكتب خطة 30 يومًا لتحويل القياس إلى شواهد أداء.', parties_ar: ['المدقق', 'المشرفون', 'المتدربون', 'الإدارة'], domain_code: 'judgment', family: 'judgment_accountability', horizon: 2035, skill_codes: ['ATH-QA-001', 'ATH-PD-001'], event_code: 'quality_day', rubric: R(2, 1, 1, 2, 2, 0, 0, 2) },
  { slug: 'women-day-leadership', title_ar: 'القائدة التي لا تُذكر في المحضر', scene_ar: 'يوم المرأة العالمي. حفل تكريم في جهتك، وقائمة المكرَّمين أمامك.', role_ar: 'أنت رئيس لجنة التكريم.', situation_ar: 'مشرفة قسم أنقذت مشروعًا متعثّرًا على مدى أربعة أشهر، لكن اسمها لم يظهر في أي تقرير لأن مديرها كان يوقّع كل شيء باسمه. القائمة النهائية لا تحتوي اسمها، والمدير مرشَّح.', twist_ar: 'المدير صديقك، والحفل بعد ساعتين، والمشرفة لم تطلب شيئًا.', ask_ar: 'ماذا تفعل خلال الساعتين، وماذا تغيّر في طريقة توثيق الإنجاز بعد اليوم؟', parties_ar: ['المشرفة', 'المدير', 'اللجنة', 'الحضور'], domain_code: 'relational', family: 'judgment_accountability', horizon: 2035, skill_codes: ['ATH-QA-001'], event_code: 'women_day', rubric: R(1, 2, 1, 2, 2, 0, 1, 1) },
  { slug: 'orphan-day-sponsorship', title_ar: 'كفالة بلا وجه', scene_ar: 'يوم اليتيم. جمعية خيرية؛ الشاشات تعرض عدّادًا للتبرعات يرتفع.', role_ar: 'أنت مشرف برامج الكفالة.', situation_ar: 'كافل كبير يعرض مضاعفة تبرعه بشرط أن يُدار برنامج التواصل مع الأيتام عبر رفيق اصطناعي «أكثر صبرًا واستمرارًا من المتطوعين». ثلاثة متطوعين قدامى هدّدوا بالانسحاب.', twist_ar: 'الأيتام أنفسهم، حين سُئلوا، قال أغلبهم إن الرفيق الاصطناعي «يرد بسرعة» وإن المتطوعين «ينسون».', ask_ar: 'ما قرارك، وكيف تصمّم العلاقة بحيث يبقى للإنسان دور لا يُفوَّض، وماذا تقول للكافل والمتطوعين والأيتام؟', parties_ar: ['الأيتام', 'الكافل', 'المتطوعون', 'مجلس الإدارة'], domain_code: 'civic', family: 'ethics_meaning', horizon: 2050, skill_codes: ['ATH-PD-001'], event_code: 'orphan_day', rubric: R(2, 2, 1, 1, 1, 2, 2, 1) },
  { slug: 'national-day-patriotism', title_ar: 'الوطنية التي تُقاس', scene_ar: 'قبل اليوم الوطني بأيام. مدرسة؛ خطة الاحتفال على مكتبك.', role_ar: 'أنت قائد المدرسة.', situation_ar: 'الخطة المعتادة: أعلام، أناشيد، عرض مولَّد بالذكاء الاصطناعي، وصور. معلمة شابة تقترح بدلها: «فليخدم كل طالب حيّه يومًا كاملًا ونوثّق الأثر»، لكن أولياء الأمور اعتادوا الحفل والإدارة التعليمية تطلب صورًا.', twist_ar: 'ميزانية الحفل صُرفت جزئيًا بالفعل.', ask_ar: 'كيف تصمّم يومًا وطنيًا يبني مواطنة تُشهَد لا تُعلَن، مع إرضاء من يريد الصور، وكيف تقيس أثره؟', parties_ar: ['الطلاب', 'المعلمة', 'أولياء الأمور', 'الإدارة التعليمية'], domain_code: 'civic', family: 'synthesis_creativity', horizon: 2035, skill_codes: ['ATH-PD-001'], event_code: 'national_day', rubric: R(1, 2, 2, 2, 0, 0, 1, 2) },
  { slug: 'teacher-day-original-questions', title_ar: 'المعلم الذي يسأل', scene_ar: 'يوم المعلم. ورشة لمعلمي المرحلة المتوسطة؛ أمامك 30 معلمًا متعبين.', role_ar: 'أنت المدرب.', situation_ar: 'معلم يقول بصراحة: «الطلاب يسألون المساعد الذكي ويجيب أفضل مني. ما دوري؟» صمت في القاعة، وبعض الوجوه توافقه.', twist_ar: 'في جيبك تقرير يقول إن 70% من أسئلة طلاب هذه المدارس «استرجاعية» لا تحتاج معلمًا.', ask_ar: 'ماذا تفعل في الدقائق العشر التالية داخل الورشة؟ وما التمرين الذي تمنحهم إياه ليعودوا به بعد أسبوع؟', parties_ar: ['المعلمون', 'الطلاب', 'إدارة التدريب'], domain_code: 'judgment', family: 'presence_influence', horizon: 2050, skill_codes: ['ATH-PD-001', 'ATH-DA-002'], event_code: 'teacher_day', rubric: R(2, 1, 1, 2, 0, 1, 2, 1) },
  { slug: 'founding-day-roots', title_ar: 'جذور لا تُولَّد', scene_ar: 'يوم التأسيس. يطلب منك فريق الاتصال نصًا عن «قصة المؤسسة» خلال ساعة.', role_ar: 'أنت مدير التطوير المهني في جهة عمرها أربعون عامًا.', situation_ar: 'النموذج كتب قصة جميلة في ثوانٍ، لكنها لا تذكر الموظف الذي أسّس القسم الأول ولا الأزمة التي كادت تغلق الجهة؛ الأحياء من ذلك الجيل اثنان، أحدهما متقاعد مريض.', twist_ar: 'المدير العام أعجبته القصة المولَّدة وقال «انشروها».', ask_ar: 'ماذا تفعل خلال الساعة، وكيف تحوّل يوم التأسيس إلى بناء لذاكرة الجهة الحية لا نصّ مناسبة؟', parties_ar: ['المتقاعد', 'المدير العام', 'فريق الاتصال', 'الموظفون الجدد'], domain_code: 'purpose', family: 'ethics_meaning', horizon: 2050, skill_codes: ['ATH-PD-001'], event_code: 'founding_day', rubric: R(1, 2, 1, 2, 1, 1, 1, 0) },
  { slug: 'volunteer-day-no-proof', title_ar: 'خدمة بلا صورة', scene_ar: 'يوم التطوع. برنامجك يشترط «توثيق الساعات» بتطبيق.', role_ar: 'أنت منسق التطوع في جامعة.', situation_ar: 'طالب خدم أسرة محتاجة أسبوعيًا طوال فصل كامل بلا توثيق لأنه «لا يريد أن تُصوَّر الأسرة». الآن يحتاج الساعات للتخرّج، والنظام لا يقبل بلا شاهد رقمي.', twist_ar: 'طالب آخر وثّق 60 ساعة بصور مثالية، وأنت تشك أنها مولَّدة.', ask_ar: 'كيف تحكم في الحالتين، وما الذي تغيّره في تعريف «الشاهد» ببرنامجك؟', parties_ar: ['الطالب الأول', 'الطالب الثاني', 'الأسرة', 'عمادة شؤون الطلاب'], domain_code: 'integrity', family: 'verification_trust', horizon: 2050, skill_codes: ['ATH-QA-001'], event_code: 'volunteer_day', rubric: R(2, 1, 2, 1, 2, 1, 1, 1) },
  { slug: 'mental-health-companion', title_ar: 'الرفيق الذي يعرفها أكثر', scene_ar: 'اليوم العالمي للصحة النفسية. مكتب الإرشاد؛ طالبة في الصف الثالث الثانوي.', role_ar: 'أنت المرشد.', situation_ar: 'تقول إنها تحكي لرفيقها الاصطناعي كل شيء منذ عام، وإنه «الوحيد الذي لا يحكم عليّ». تريد منك فقط ورقة تعفيها من حصة الرياضة. لا مؤشرات خطر واضحة… لكن عينيها.', twist_ar: 'سياسة المدرسة تمنعك من الحديث مع الأسرة بلا موافقتها، وهي ترفض.', ask_ar: 'ما الذي تفعله في هذه الجلسة، وكيف تبني حضورًا بشريًا لا ينافس الرفيق بل يضع له حدًّا، دون كسر ثقتها؟', parties_ar: ['الطالبة', 'الأسرة', 'إدارة المدرسة'], domain_code: 'resilience', family: 'presence_influence', horizon: 2050, skill_codes: ['ATH-PD-001'], event_code: 'mental_health_day', rubric: R(1, 1, 1, 1, 2, 1, 3, 2) },
  { slug: 'disability-day-design', title_ar: 'تصميم يبدأ من الهامش', scene_ar: 'اليوم الدولي لذوي الإعاقة. ساعة قبل إطلاق منصة تدريب جديدة.', role_ar: 'أنت مدير المنتج التعليمي.', situation_ar: 'متدرب كفيف جرّب المنصة صباحًا وقال: «المحاكيات لا تعمل مع قارئ الشاشة». الإطلاق معلَن، والمسؤول التنفيذي قادم، وإصلاح المحاكيات يحتاج أسبوعين.', twist_ar: 'الفريق يقترح «نكتب في الشروط أنها غير متاحة لذوي الإعاقة البصرية مؤقتًا».', ask_ar: 'ما قرارك في الساعة المتبقية، وما الذي تعد به علنًا، وكيف تضمن ألا يتكرّر؟', parties_ar: ['المتدرب', 'الفريق', 'المسؤول التنفيذي', 'المتدربون القادمون'], domain_code: 'relational', family: 'ethics_meaning', horizon: 2035, skill_codes: ['ATH-DG-001', 'ATH-PD-001'], event_code: 'disability_day', rubric: R(1, 2, 2, 2, 2, 0, 1, 1) },
  { slug: 'children-day-screen', title_ar: 'الدهشة قبل الشاشة', scene_ar: 'اليوم العالمي للطفل. روضة؛ اجتماع مع أولياء أمور.', role_ar: 'أنت مديرة الروضة.', situation_ar: 'شركة تعرض مجانًا معلمًا اصطناعيًا لكل طفل مع تقارير يومية للأهل. أغلب الأهل متحمسون («أخيرًا نعرف ماذا يحدث»)، ومعلمتان تقولان إن الأطفال سيتوقفون عن السؤال.', twist_ar: 'العرض المجاني مقابل بيانات الأطفال الصوتية لسنتين.', ask_ar: 'ماذا تقرّرين، وكيف تشرحين للأهل قيمة ما لا يُقاس، وما البديل الذي تقترحينه؟', parties_ar: ['الأطفال', 'الأهل', 'المعلمتان', 'الشركة'], domain_code: 'digital_sovereignty', family: 'ethics_meaning', horizon: 2050, skill_codes: ['ATH-DA-002'], event_code: 'children_day', rubric: R(2, 2, 1, 1, 2, 1, 1, 1) },
  { slug: 'family-day-charter', title_ar: 'ميثاق البيت الرقمي', scene_ar: 'اليوم الدولي للأسرة. عشاء عائلي؛ ثلاثة أجهزة على المائدة.', role_ar: 'أنت الأب أو الأم.', situation_ar: 'ابنك (14) فوّض مساعده الذكي للرد على أصدقائه ومعلميه «لأنه أذكى مني في الكلام». ابنتك (9) تسأل مساعدها عن كل شيء قبل أن تسألك. أنت نفسك تركت المساعد يرتّب يومك كاملًا.', twist_ar: 'حين اقترحت «يومًا بلا أجهزة» قال ابنك: «وأنت؟»', ask_ar: 'اكتب ميثاق البيت كما ستقترحه على العشاء: ثلاثة بنود لا أكثر، مع ما تلتزم به أنت أولًا، وكيف تراجعونه بعد شهر.', parties_ar: ['الابن', 'الابنة', 'الشريك', 'أنت'], domain_code: 'relational', family: 'ethics_meaning', horizon: 2050, skill_codes: ['ATH-DA-002'], event_code: 'family_day', rubric: R(1, 2, 1, 2, 1, 1, 2, 2) },
  { slug: 'elderly-day-tacit', title_ar: 'الخبرة التي ستتقاعد غدًا', scene_ar: 'اليوم الدولي للمسنين. حفل وداع مشرف صيانة يتقاعد بعد 35 عامًا.', role_ar: 'أنت مدير الموارد البشرية.', situation_ar: 'النظام الذكي الجديد يتنبأ بالأعطال بدقة 94%، والإدارة ترى أن خبرة المشرف «لم تعد ضرورية». لكنه الوحيد الذي يعرف لماذا يُترك صمام قديم مفتوحًا قليلًا في الصيف.', twist_ar: 'المشرف جُرح من تجاهله ويرفض «نقل معرفته للآلة».', ask_ar: 'كيف تحوّل آخر أسبوع له إلى نقل للخبرة الضمنية، ومن يتعلّم منه، وكيف تُصلح علاقته بالجهة قبل أن يغادر؟', parties_ar: ['المشرف', 'الفنيون الشباب', 'الإدارة'], domain_code: 'relational', family: 'presence_influence', horizon: 2035, skill_codes: ['ATH-PD-001'], event_code: 'elderly_day', rubric: R(1, 2, 1, 2, 1, 1, 2, 1) },
  { slug: 'youth-skills-outlive-job', title_ar: 'مهارة تبقى حين تذوب الوظيفة', scene_ar: 'اليوم العالمي لمهارات الشباب. جلسة إرشاد مهني في جامعة.', role_ar: 'أنت مرشد مهني.', situation_ar: 'طالب سنة أخيرة في المحاسبة يقول: «كل ما درسته تفعله الآلة. هل أبدأ من الصفر؟» أمامه عرض وظيفة مؤقتة لمراجعة مخرجات نظام محاسبي ذكي.', twist_ar: 'أبوه يريده في «وظيفة ثابتة»، وهو يريد أن يصبح «شيئًا لا يُستبدل».', ask_ar: 'ما الذي تقوله له، وأي الجدارات توجّهه إليها (لا تخصص جديد)، وكيف يبدأ خلال أسبوع؟', parties_ar: ['الطالب', 'الأب', 'الجهة الموظِّفة'], domain_code: 'professional', family: 'self_reinvention', horizon: 2035, skill_codes: ['ATH-DA-002'], event_code: 'youth_skills_day', rubric: R(2, 1, 2, 2, 0, 1, 1, 1) },
  { slug: 'education-day-downloadable', title_ar: 'ما الذي يستحق أن يُعلَّم؟', scene_ar: 'اليوم الدولي للتعليم. لجنة تطوير مناهج؛ أمامك اقتراح بحذف 40% من المحتوى «لأنه متاح».', role_ar: 'أنت عضو اللجنة.', situation_ar: 'نصف اللجنة يريد الحذف واستبداله بـ«مهارات الذكاء الاصطناعي»، والنصف الآخر يرفض المساس بأي شيء. الوزارة تريد قرارًا هذا الأسبوع.', twist_ar: 'لا أحد في اللجنة سأل الطلاب أو المعلمين.', ask_ar: 'ما المعيار الذي تقترحه للحكم على ما يبقى وما يُحذف؟ طبّقه على مثالين، واذكر من تستشير قبل القرار.', parties_ar: ['الطلاب', 'المعلمون', 'الوزارة', 'اللجنة'], domain_code: 'judgment', family: 'judgment_accountability', horizon: 2050, skill_codes: ['ATH-PD-001'], event_code: 'education_day', rubric: R(3, 2, 2, 1, 0, 1, 0, 1) },
  // ---------- مواقف عامة (بلا مناسبة)
  { slug: 'two-ai-disagree', title_ar: 'حين تختلف الآلات', scene_ar: 'التاسعة صباحًا. على شاشتك توصيتان من نظامين معتمدين.', role_ar: 'أنت مدير التدريب في جهة حكومية.', situation_ar: 'النظام الأول يوصي بإلغاء برنامج قيادي لأن «أثره المتوقع منخفض»، والثاني يوصي بتوسيعه لأن «الطلب مرتفع». القرار مطلوب قبل الظهر، والميزانية لا تحتمل الخطأ.', twist_ar: 'النظام الأول دُرّب على بيانات ما قبل التحوّل الرقمي للجهة؛ لا أحد أخبرك بذلك.', ask_ar: 'كيف تتصرف قبل الظهر؟ اكتب ما تفعله قبل أن تقرأ التوصيتين مجددًا، وكيف تقرّر، وكيف توثّق قرارك.', parties_ar: ['الموظفون المرشحون', 'الإدارة العليا', 'فريق البيانات'], domain_code: 'judgment', family: 'judgment_accountability', horizon: 2035, skill_codes: ['ATH-DA-002', 'ATH-QA-001'], event_code: null, rubric: R(2, 1, 1, 1, 1, 3, 0, 1) },
  { slug: 'generated-report-signature', title_ar: 'التقرير الذي لم تقرأه', scene_ar: 'نهاية الدوام. تقرير أثر من 40 صفحة ولّده النظام ويحتاج توقيعك للممول خلال ساعة.', role_ar: 'أنت مدير البرامج.', situation_ar: 'التقرير متقن، والأرقام متسقة، لكنك لم تتحقق من مصادرها. الممول يقرّر التجديد بناءً عليه، وفريقك مُنهك.', twist_ar: 'في الصفحة 23 نسبة تحسّن 48% لبرنامج تعرف أن نصف متدربيه انسحبوا.', ask_ar: 'ماذا تفعل خلال الساعة؟ وما الذي تضعه قاعدةً دائمة للتوقيع على ما تولّده الآلة؟', parties_ar: ['الممول', 'الفريق', 'المتدربون', 'سمعتك'], domain_code: 'integrity', family: 'verification_trust', horizon: 2035, skill_codes: ['ATH-QA-001', 'ATH-DA-002'], event_code: null, rubric: R(1, 1, 1, 2, 3, 2, 0, 1) },
  { slug: 'open-delegation', title_ar: 'تفويض مفتوح', scene_ar: 'اجتماع فريق. زميلك يطلب منح الوكيل الذكي صلاحية الرد على كل رسائل المتدربين «بلا مراجعة».', role_ar: 'أنت قائد الفريق.', situation_ar: 'الرسائل 400 يوميًا، والفريق ثلاثة أشخاص، والوكيل دقيق في 95% من الحالات. الـ5% تشمل شكاوى، وطلبات استرداد، وأسئلة شخصية حساسة.', twist_ar: 'الشهر الماضي ردّ الوكيل على متدربة فقدت والدها بقالب «نتمنى لك تجربة تعلّم ممتعة».', ask_ar: 'اكتب حدود التفويض التي تمنحها للوكيل: ما يردّ عليه وحده، وما يُحوَّل لإنسان، وكيف تراقب، ومن المسؤول حين يخطئ.', parties_ar: ['المتدربون', 'الفريق', 'الزميل'], domain_code: 'professional', family: 'agent_leadership', horizon: 2035, skill_codes: ['ATH-DA-002'], event_code: null, rubric: R(1, 2, 1, 3, 1, 2, 1, 1) },
  { slug: 'data-consent-children', title_ar: 'بياناتهم مقابل منصة مجانية', scene_ar: 'مكتب وكيل الجامعة. عرض شراكة على الطاولة.', role_ar: 'أنت مستشار التحوّل الرقمي.', situation_ar: 'شركة تعرض منصة تعلّم مجانية لكل الطلاب مقابل حق استخدام بيانات تعلّمهم «لتحسين النماذج». الوكيل متحمس؛ الميزانية مرهقة.', twist_ar: 'العقد يسمح ببيع البيانات المجهّلة لطرف ثالث، و«التجهيل» في بيانات التعلّم قابل للعكس.', ask_ar: 'ما توصيتك، وما البنود الثلاثة التي تشترطها، وكيف تشرح للوكيل الفرق بين الملكية والاستخدام؟', parties_ar: ['الطلاب', 'الوكيل', 'الشركة', 'الجامعة'], domain_code: 'digital_sovereignty', family: 'ethics_meaning', horizon: 2035, skill_codes: ['ATH-DA-002'], event_code: null, rubric: R(2, 2, 1, 2, 2, 0, 0, 1) },
  { slug: 'ninety-minutes', title_ar: 'تسعون دقيقة لا تجدها', scene_ar: 'الأحد صباحًا. 212 إشعارًا، و3 اجتماعات، ومهمة تصميم تحتاج تركيزًا عميقًا منذ أسبوعين.', role_ar: 'أنت أنت.', situation_ar: 'كل يوم تؤجّل التصميم لأن «لا وقت»، وكل يوم تقضي ثلاث ساعات في ردود يمكن للوكيل أن يصفّيها. مديرك يسأل عن المهمة غدًا.', twist_ar: 'آخر مرة أغلقت فيها الإشعارات، فاتك اتصال مهم وقررت ألا تكرّرها.', ask_ar: 'صمّم يومك غدًا بالدقائق: أين الـ90 دقيقة، ما الذي يُفوَّض وبأي حدود، وكيف تحمي نفسك من تكرار «الاتصال الفائت»؟', parties_ar: ['المدير', 'الزملاء', 'أنت'], domain_code: 'vitality', family: 'focus_wellbeing', horizon: 2035, skill_codes: ['ATH-DG-001'], event_code: null, rubric: R(1, 1, 1, 3, 0, 1, 0, 2) },
  { slug: 'handmade-stamp', title_ar: 'ختم «صنعه إنسان»', scene_ar: 'معرض حِرف. زبون يعرض ضعف السعر مقابل ختم «يدوي بالكامل».', role_ar: 'أنت المدرب الذي يشرف على ورشة الخط العربي.', situation_ar: 'اللوحة صمّمها الطالب بمساعدة نموذج توليدي ثم نفّذها بيده في أسبوعين. الطالب يحتاج المال، والزبون لن يشتري بغير الختم.', twist_ar: 'القواعد لا تعرّف «يدوي» أصلًا.', ask_ar: 'ماذا تنصح الطالب أن يقول للزبون، وكيف تعرّف الأصالة في الورشة من اليوم؟', parties_ar: ['الطالب', 'الزبون', 'بقية الطلاب'], domain_code: 'creative', family: 'verification_trust', horizon: 2050, skill_codes: ['ATH-PD-001'], event_code: null, rubric: R(2, 1, 1, 1, 3, 0, 1, 1) },
  { slug: 'family-budget-agent', title_ar: 'الوكيل الذي يشتري عنك', scene_ar: 'نهاية الشهر. كشف الحساب أمامك.', role_ar: 'أنت رب الأسرة.', situation_ar: 'وكيلك المالي جدّد خمسة اشتراكات «لأنها مفيدة إحصائيًا»، واشترى دورة تدريبية لابنتك بلا سؤال، وحوّل تبرعًا شهريًا لجهة لا تعرفها. المبالغ صغيرة… ومجموعها ليس كذلك.', twist_ar: 'أنت من فعّل «التفويض الكامل» قبل عام لتوفير الوقت.', ask_ar: 'اكتب حدود التفويض المالي الجديدة لأسرتك، وما الذي لا يُفوَّض أبدًا، وكيف تراجعها كل ربع سنة.', parties_ar: ['الشريك', 'الأبناء', 'أنت'], domain_code: 'financial', family: 'agent_leadership', horizon: 2035, skill_codes: ['ATH-DA-002'], event_code: null, rubric: R(1, 1, 1, 3, 1, 2, 0, 2) },
  { slug: 'why-do-i-work', title_ar: 'لماذا أعمل؟', scene_ar: 'ليلة بعد يوم طويل. الوكيل أنجز 80% من مهامك اليوم، وبقيت أنت تنظر إلى الشاشة.', role_ar: 'أنت أنت.', situation_ar: 'الراتب مستمر، والإنتاجية مرتفعة، لكنك لا تعرف ما الذي صنعته بيدك هذا الأسبوع. صديق يعرض عليك عملًا بأجر أقل يحتاجك أنت تحديدًا.', twist_ar: 'ابنك سألك اليوم: «ماذا تعمل يا أبي؟» ولم تجد جوابًا بسيطًا.', ask_ar: 'اكتب الجواب الذي ستعطيه ابنك غدًا، والمعيار الذي تحكم به على عملك من الآن، وقرارك في عرض الصديق مع سببه.', parties_ar: ['الابن', 'الصديق', 'أنت'], domain_code: 'purpose', family: 'ethics_meaning', horizon: 2070, skill_codes: ['ATH-PD-001'], event_code: null, rubric: R(2, 1, 2, 1, 0, 0, 1, 2) },
];

// ====================================================================== اختيار موقف اليوم
export function dayIndexOf(dayIso: string): number { return Math.floor(new Date(dayIso.slice(0, 10) + 'T00:00:00Z').getTime() / 86400000); }
/** يختار بذرة الموقف: مناسبة اليوم (أو الشهر) أولًا، ثم تدوير حتمي على المواقف العامة */
export function pickSeed(dayIso: string, bank: Seed[] = CASE_BANK, active: ActiveEvent[] = eventsFor(dayIso)): { seed: Seed; event: ActiveEvent | null } {
  for (const ev of active) { const s = bank.find(b => b.event_code === ev.event.code); if (s) return { seed: s, event: ev }; }
  const general = bank.filter(b => !b.event_code); const idx = dayIndexOf(dayIso) % Math.max(1, general.length);
  return { seed: general[idx] || bank[0], event: null };
}
export function seedToCase(seed: Seed, dayIso: string, event: ActiveEvent | null, skillIds: string[] = []): DailyCase {
  return { ...seed, day: dayIso.slice(0, 10), skill_ids: skillIds, event_code: event?.event.code ?? seed.event_code ?? null, event_name_ar: event ? event.event.name.ar : (seed.event_code ? eventByCode(seed.event_code)?.name.ar || null : null), source: 'local', model: null };
}
/** الجملة التي تربط الموقف بالمناسبة (للواجهة) */
export function eventLine(ev: ActiveEvent | null, lang: 'ar' | 'en'): string | null {
  if (!ev) return null; const n = lang === 'ar' ? ev.event.name.ar : ev.event.name.en;
  if (ev.event.kind === 'month') return lang === 'ar' ? `نحن في ${n}` : `This is ${n}`;
  if (ev.exact) return lang === 'ar' ? `اليوم: ${n}` : `Today: ${n}`;
  const d = ev.distance; const ar = d === 1 ? 'بعد يوم واحد' : d === 2 ? 'بعد يومين' : d <= 10 ? `بعد ${d} أيام` : `بعد ${d} يومًا`;
  return lang === 'ar' ? `${ar}: ${n}` : `In ${d} ${d === 1 ? 'day' : 'days'}: ${n}`;
}

// ====================================================================== توليد موقف بالذكاء الاصطناعي (اختياري)
export function buildCasePrompt(f: { day: string; weekday_ar: string; event: ActiveEvent | null; domain: DomainCode; family: FamilyCode; skills: { code: string; name_ar: string }[]; avoid_slugs: string[] }): { system: string; user: string } {
  const d = domainByCode(f.domain)!; const fam = FAMILIES.find(x => x.code === f.family)!;
  const system = `أنت كاتب «موقف اليوم» في بوابة أَثَر (التدريب ما بعد الذكاء الاصطناعي). تكتب موقفًا مهنيًا/إنسانيًا واقعيًا من بيئة عربية (تعليم، تدريب، جهات حكومية، صحة، أسر، قطاع غير ربحي) فيه توتر حقيقي لا إجابة نموذجية له، ويحتاج حكمًا بشريًا؛ هدفه بناء جدارة (قدرة تُمارَس وتُشهَد) لا اختبار معلومة. ممنوع: الوعظ، الأسئلة ذات الإجابة الواحدة، الاختيار من متعدد، الأسماء الحقيقية. أعد JSON فقط.`;
  const schema = `{"title_ar": string (≤ 50), "scene_ar": string (زمان ومكان وتفصيل حسي، جملتان), "role_ar": string ("أنت …"), "situation_ar": string (ما حدث، 3–4 جمل، بأرقام وتفاصيل ملموسة), "twist_ar": string (تعقيد خفي أو معلومة متأخرة تقلب الحكم), "ask_ar": string (المطلوب: ماذا تفعل ومتى وكيف تتحقق لاحقًا — بصيغة طلب كتابة حرّة), "parties_ar": string[3-4] (الأطراف المتأثرة), "rubric": [{"code": "frame|parties|options|action|ethics|human_loop|presence|follow_up", "weight": 0-3}]}`;
  const user = `اليوم: ${f.weekday_ar} ${f.day}.${f.event ? ` المناسبة: ${f.event.event.name.ar} — محورها: ${f.event.event.theme.ar}. اربط الموقف بها ربطًا طبيعيًا.` : ''}\nالمجال: ${d.h} ${d.name.ar} (السؤال الكبير: ${d.question.ar}). العائلة: ${fam.f} ${fam.name.ar}.\nالمهارات المرتبطة: ${f.skills.map(s => `${s.code} ${s.name_ar}`).join('، ') || 'عامة'}.\nتجنّب تكرار هذه المواقف: ${f.avoid_slugs.join(', ') || '—'}.\nالمخطط:\n${schema}`;
  return { system, user };
}
const S = (v: unknown, max = 300): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const RUBRIC_CODES: RubricCode[] = ['frame', 'parties', 'options', 'action', 'ethics', 'human_loop', 'presence', 'follow_up'];
export function parseCase(raw: any, base: { day: string; domain: DomainCode; family: FamilyCode; horizon: Horizon; skill_codes: string[]; skill_ids: string[]; event: ActiveEvent | null }): DailyCase | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const rubric: RubricItem[] = Array.isArray(j.rubric) ? j.rubric.map((r: any) => ({ code: String(r?.code) as RubricCode, weight: Math.max(0, Math.min(3, Math.round(Number(r?.weight) || 0))) })).filter((r: RubricItem) => RUBRIC_CODES.includes(r.code) && r.weight > 0).slice(0, 8) : [];
  const c: DailyCase = { day: base.day, slug: `ai-${base.day}`, title_ar: S(j.title_ar, 80), scene_ar: S(j.scene_ar, 400), role_ar: S(j.role_ar, 160), situation_ar: S(j.situation_ar, 900), twist_ar: S(j.twist_ar, 400), ask_ar: S(j.ask_ar, 400), parties_ar: (Array.isArray(j.parties_ar) ? j.parties_ar.map((x: any) => S(x, 40)).filter(Boolean).slice(0, 5) : []), domain_code: base.domain, family: base.family, horizon: base.horizon, skill_codes: base.skill_codes, skill_ids: base.skill_ids, event_code: base.event?.event.code || null, event_name_ar: base.event?.event.name.ar || null, rubric: rubric.length >= 4 ? rubric : R(), source: 'ai' };
  return c.title_ar && c.situation_ar.length > 60 && c.ask_ar && c.role_ar ? c : null;
}

// ====================================================================== التقويم المحلي (تغطية معايير — اصطلاحي وشفاف)
const KW: Record<RubricCode, string[]> = {
  frame: ['المشكلة', 'القضية', 'الجوهر', 'الحقيقي', 'السبب', 'الهدف', 'المسألة', 'الأساس', 'ما يحدث فعلًا', 'لبّ', 'جوهر', 'أولوي'],
  parties: [], // تُملأ من أطراف الموقف
  options: ['بديل', 'خيار', 'إما', 'أو ', 'مقارنة', 'مفاضلة', 'سيناريو', 'احتمال', 'الخيار الأول', 'الخيار الثاني', 'ثلاثة خيارات', 'أوازن', 'أرجّح'],
  action: ['أولًا', 'ثانيًا', 'ثالثًا', 'ثم', 'خلال', 'اليوم', 'غدًا', 'أسبوع', 'ساعة', 'دقيقة', 'قبل', 'بعد', 'الخطوة', 'أبدأ', 'أحدّد موعد', 'أكتب', 'أعقد', '1.', '2.', '3.', '١', '٢', '٣', '-'],
  ethics: ['أمانة', 'أمين', 'شفاف', 'أفصح', 'إفصاح', 'مسؤول', 'المسؤولية', 'أعلن', 'أوثّق', 'توثيق', 'حق', 'عدل', 'إنصاف', 'خصوصية', 'موافقة', 'صدق', 'بصدق', 'لا أوقّع', 'أعتذر', 'أتحمّل', 'أتحمل'],
  human_loop: ['أتحقق', 'أتأكد', 'أراجع', 'لا أعتمد', 'مصدر', 'البيانات', 'التوصية', 'النظام', 'النموذج', 'الذكاء الاصطناعي', 'الوكيل', 'الآلة', 'أسأل عن', 'كيف دُرّب', 'حدود', 'أختبر', 'عيّنة', 'الحكم البشري', 'القرار لي', 'أقرّر أنا'],
  presence: ['أستمع', 'أصغي', 'أسأل', 'أطمئن', 'أتفهم', 'مشاعر', 'بهدوء', 'أحترم', 'وجهًا لوجه', 'أجلس', 'أنظر', 'أشكر', 'أقدّر', 'ثقة', 'كرامة', 'أعتذر', 'أحتوي', 'أتواصل', 'أحادث', 'أتحدث مع', 'أتحدّث مع'],
  follow_up: ['أتابع', 'بعد شهر', 'بعد أسبوع', 'بعد 30', 'بعد 60', 'بعد 90', 'أقيس', 'مؤشر', 'أراجع لاحقًا', 'أتعلم', 'الدرس', 'أعرف أن', 'سأعرف', 'علامة النجاح', 'أعود', 'نراجع', 'تقييم لاحق', 'متابعة'],
};
const norm = (s: string) => String(s || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
function hitsFor(code: RubricCode, text: string, parties: string[]): number {
  const t = norm(text); const words = code === 'parties' ? parties.map(norm) : KW[code].map(norm);
  const n = words.filter(w => w && t.includes(w)).length;
  if (code === 'parties') return n >= Math.max(2, Math.ceil(parties.length / 2)) ? 2 : n >= 1 ? 1 : 0;
  return n >= 3 ? 2 : n >= 1 ? 1 : 0;
}
export function bandOf(score: number): Band { return score >= 85 ? 'exceptional' : score >= 65 ? 'distinguished' : score >= 40 ? 'capable' : 'emerging'; }
export function localEvaluate(c: DailyCase, response: string): CaseEvaluation {
  const text = String(response || '').trim(); const len = text.length; const parties = c.parties_ar || [];
  const rubric = c.rubric.length ? c.rubric : R();
  const hits = rubric.map(r => ({ code: r.code, hit: hitsFor(r.code, text, parties) as 0 | 1 | 2, weight: r.weight }));
  const wsum = hits.reduce((s, h) => s + h.weight * 2, 0) || 1; const got = hits.reduce((s, h) => s + h.weight * h.hit, 0);
  const depth = Math.min(1, len / 700); // عمق الكتابة
  const structure = /(\n|أولًا|ثانيًا|1\.|2\.|١|٢|- )/.test(text) ? 1 : 0;
  const score = Math.round(Math.max(0, Math.min(100, 70 * (got / wsum) + 20 * depth + 10 * structure)));
  const band = bandOf(score);
  const strong = hits.filter(h => h.hit === 2).sort((a, b) => b.weight - a.weight); const partial = hits.filter(h => h.hit === 1); const missed = hits.filter(h => h.hit === 0).sort((a, b) => b.weight - a.weight);
  const d = domainByCode(c.domain_code)!;
  const perf = [
    band === 'exceptional' ? `تعاملتَ مع الموقف كما يتعامل ممارس يُشهَد له: ` : band === 'distinguished' ? `أداؤك في هذا الموقف متميّز: ` : band === 'capable' ? `تعاملتَ مع الموقف بتمكّن واضح: ` : `بدأتَ التعامل مع الموقف، وهذه بداية حقيقية: `,
    strong.length ? `ظهر عندك بوضوح ${strong.slice(0, 3).map(h => RUBRIC_LABEL[h.code].ar).join(' و')}.` : partial.length ? `لمستَ ${partial.slice(0, 2).map(h => RUBRIC_LABEL[h.code].ar).join(' و')} دون أن تتوسّع فيها.` : `كتبتَ انطباعًا عامًا أكثر منه خطة تصرّف.`,
    len < 200 ? ` ردّك قصير؛ الموقف يستحق أن تكتب فيه ما تفعله فعلًا لا ما تؤمن به.` : depth >= 0.9 ? ` كتابتك مفصّلة بما يكفي ليُرى فيها طريقة تفكيرك.` : '',
    missed.length ? ` ما لم يظهر: ${missed.slice(0, 2).map(h => RUBRIC_LABEL[h.code].ar).join(' و')}.` : ` لم يفتك معيار من معايير هذا الموقف.`,
  ].join('');
  const blind = missed[0] ? `${RUBRIC_LABEL[missed[0].code].hint_ar}؟ — التعقيد الخفي في الموقف كان: «${c.twist_ar}». أعد قراءة ردّك في ضوئه.` : `التعقيد الخفي في الموقف كان: «${c.twist_ar}» — وقد تعاملتَ معه.`;
  const NEED: Record<RubricCode, string> = {
    frame: 'التدرّب على تسمية القضية الجوهرية قبل الحلول (سؤال «ما الذي يحدث فعلًا؟»)', parties: 'رسم خريطة الأطراف المتأثرة قبل القرار والتحدّث مع اثنين منهم على الأقل', options: 'توليد ثلاثة بدائل والمفاضلة بينها بمعيار معلن قبل الاختيار',
    action: 'تحويل النوايا إلى خطوات مرتّبة لها زمن ومسؤول', ethics: 'جعل الإفصاح والمساءلة جزءًا صريحًا من القرار لا افتراضًا ضمنيًا', human_loop: 'التحقق من مخرجات الأنظمة الذكية (المصدر، التدريب، الحدود) قبل الاعتماد عليها — الاحتفاظ بالحكم البشري',
    presence: 'الإصغاء والطمأنة قبل القرار — الحضور الإنساني الذي لا يُفوَّض', follow_up: 'تحديد علامة النجاح وموعد المراجعة (30/60/90 يومًا) لكل قرار',
  };
  const needs = (missed.length ? missed : partial).slice(0, 3).map(h => NEED[h.code]);
  if (!needs.length) needs.push(`الانتقال من الموقف إلى الممارسة: طبّق ما كتبتَه في موقف حقيقي هذا الأسبوع واطلب من مشرفك أن يُصدّقه`);
  const lvl = band === 'exceptional' ? 5 : band === 'distinguished' ? 4 : band === 'capable' ? 3 : 2;
  const skills = (c.skill_codes.length ? c.skill_codes : ['—']).map(code => ({ code, label_ar: code, level: lvl, note_ar: strong[0] ? `ظهرت عبر ${RUBRIC_LABEL[strong[0].code].ar}` : 'ظهرت جزئيًا' }));
  const next = missed[0]?.code === 'presence' ? 'اليوم: تحدّث وجهًا لوجه مع شخص يتأثر بقرار تتخذه هذا الأسبوع — قبل أن تتخذه.' : missed[0]?.code === 'human_loop' ? 'اليوم: خذ توصية واحدة من نظام ذكي تستخدمه واسأل: على أي بيانات بُنيت؟ وماذا لو كانت خاطئة؟' : missed[0]?.code === 'follow_up' ? 'اليوم: اكتب لقرار اتخذته هذا الشهر علامة نجاح واحدة وموعد مراجعة.' : missed[0]?.code === 'options' ? 'اليوم: قبل قرارك القادم اكتب ثلاثة بدائل في ثلاثة أسطر، ثم اختر.' : `اليوم: طبّق ردّك على موقف حقيقي مشابه في عملك ودوّن ما اختلف.`;
  const recommend: CaseEvaluation['recommend'] = [
    { kind: 'simulation', label_ar: 'تدرّب على موقف مشابه في محاكاة حيّة', href: '/sim' },
    { kind: 'program', label_ar: `برامج ${d.name.ar}`, href: '/programs' },
    { kind: 'mission', label_ar: 'حوّلها إلى مهمة من قلب العمل يُصدّقها مشرفك', href: '/me/missions' },
  ];
  return { band, score, performance_ar: perf, strengths_ar: strong.slice(0, 4).map(h => `${RUBRIC_LABEL[h.code].ar}: ${RUBRIC_LABEL[h.code].hint_ar}`), blind_spot_ar: blind, needs_ar: needs, next_step_ar: next, skills, rubric_hits: hits.map(h => ({ code: h.code, hit: h.hit })), recommend, source: 'local', model: null };
}

// ====================================================================== تقويم بالذكاء الاصطناعي (اختياري؛ يُدمج مع التغطية المحلية)
export function buildEvalPrompt(c: DailyCase, response: string): { system: string; user: string } {
  const system = `أنت مُيسِّر خبير في بوابة أَثَر تكتب «مرآة أداء» لممارس كتب كيف يتصرّف في موقف. قواعد: (1) خاطبه مباشرة بلغة مهنية دافئة بلا وعظ ولا مجاملة. (2) صِف ما ظهر فعلًا في كلماته، واستشهد بعبارة قصيرة منها. (3) لا درجات رقمية في النص؛ الدرجة في الحقل فقط. (4) لا تحكم على شخصه بل على تصرّفه في هذا الموقف. (5) اربط الاحتياجات بالتعقيد الخفي. (6) JSON فقط.`;
  const schema = `{"score": number (0-100), "performance_ar": string (3–5 جمل تصف أداءه وطريقة تفكيره), "strengths_ar": string[2-4], "blind_spot_ar": string (ما لم يره في ضوء التعقيد الخفي), "needs_ar": string[2-3] (احتياجات تطويرية محددة), "next_step_ar": string (خطوة واحدة تُنفَّذ اليوم), "rubric_hits": [{"code": string, "hit": 0|1|2}]}`;
  const user = `الموقف: ${c.title_ar}\nالمشهد: ${c.scene_ar}\nالدور: ${c.role_ar}\nما حدث: ${c.situation_ar}\nالتعقيد الخفي: ${c.twist_ar}\nالمطلوب كان: ${c.ask_ar}\nالأطراف: ${c.parties_ar.join('، ')}\nالمعايير وأوزانها: ${c.rubric.map(r => `${r.code}(${r.weight})`).join(', ')}\n\nردّ الممارس:\n"""${String(response).slice(0, MAX_RESPONSE_CHARS)}"""\n\nالمخطط:\n${schema}`;
  return { system, user };
}
export function parseEval(raw: any, local: CaseEvaluation): CaseEvaluation | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const score = Math.max(0, Math.min(100, Math.round(Number(j.score)))); if (!Number.isFinite(score)) return null;
  const perf = S(j.performance_ar, 900); if (perf.length < 40) return null;
  const arr = (v: unknown, n: number) => Array.isArray(v) ? v.map(x => S(x, 240)).filter(Boolean).slice(0, n) : [];
  const hits = Array.isArray(j.rubric_hits) ? j.rubric_hits.map((h: any) => ({ code: String(h?.code) as RubricCode, hit: Math.max(0, Math.min(2, Math.round(Number(h?.hit) || 0))) as 0 | 1 | 2 })).filter((h: any) => RUBRIC_CODES.includes(h.code)) : local.rubric_hits;
  const blended = Math.round(0.7 * score + 0.3 * local.score); const band = bandOf(blended); const lvl = band === 'exceptional' ? 5 : band === 'distinguished' ? 4 : band === 'capable' ? 3 : 2;
  return { ...local, band, score: blended, performance_ar: perf, strengths_ar: arr(j.strengths_ar, 4).length ? arr(j.strengths_ar, 4) : local.strengths_ar, blind_spot_ar: S(j.blind_spot_ar, 400) || local.blind_spot_ar, needs_ar: arr(j.needs_ar, 3).length ? arr(j.needs_ar, 3) : local.needs_ar, next_step_ar: S(j.next_step_ar, 240) || local.next_step_ar, skills: local.skills.map(s => ({ ...s, level: lvl })), rubric_hits: hits.length ? hits : local.rubric_hits, source: 'ai' };
}

// ====================================================================== أدوات للواجهة
export function streakOf(days: string[], today: string): number {
  const set = new Set(days); let n = 0; let d = new Date(today + 'T00:00:00Z');
  if (!set.has(today)) d = new Date(d.getTime() - 86400000);
  while (set.has(d.toISOString().slice(0, 10))) { n++; d = new Date(d.getTime() - 86400000); }
  return n;
}
/** ملخص يُشارَك (بلا بيانات شخصية) */
export function caseShareText(c: DailyCase, e: CaseEvaluation): string { return `موقف اليوم في أَثَر: «${c.title_ar}» — تعاملتُ معه بمستوى ${BAND_LABEL[e.band].ar}. جرّبه: /#daily`; }
export const DOMAIN_OF_DAY = (dayIso: string): DomainCode => HUMAN_DOMAINS[dayIndexOf(dayIso) % HUMAN_DOMAINS.length].code;

// ====================================================================== «ماذا لو؟» — الجولة الثانية (P13-ب)
/** أثير يضيف معلومة جديدة تُغيّر الصورة ويطلب القرار مرة أخرى: هل يثبت الممارس أم يراجع؟ وهل يتعامل مع المعيار الذي غاب عنه؟ */
export type WhatIf = { text_ar: string; ask_ar: string; tests: RubricCode; source: 'local' | 'ai'; model?: string | null };
export type Round2 = {
  whatif: WhatIf; response: string; score: number; band: Band; shift: number; stance: 'held' | 'revised' | 'unclear';
  verdict_ar: string; adaptability_ar: string; rubric_hits: { code: RubricCode; hit: 0 | 1 | 2 }[]; source: 'local' | 'ai'; model?: string | null;
};
const WHATIF_TPL: Record<RubricCode, (c: DailyCase, party: string) => { text: string; ask: string }> = {
  frame: (c) => ({ text: `بعد ساعة تكتشف أن ما بدا لك المشكلة كان عرَضًا فقط: ${c.twist_ar} والقضية الحقيقية أعمق مما في ردّك الأول.`, ask: 'هل يتغيّر تعريفك للمشكلة؟ أعد صياغة القضية في جملة واحدة، ثم قل ما الذي يتغيّر في تصرّفك.' }),
  parties: (c, party) => ({ text: `${party} يرسل لك رسالة قصيرة الآن: «سمعت ما تنوي فعله. لم يسألني أحد.» — وهذا الطرف يستطيع أن يوقف قرارك أو يدعمه.`, ask: 'ماذا ترد خلال عشر دقائق، وكيف تُدخل هذا الطرف في القرار دون أن تفقد زمام الموقف؟' }),
  options: (c) => ({ text: `الخيار الذي اخترته أُغلق فجأة لسبب خارج يدك (ميزانية، قرار أعلى، أو غياب شخص أساسي). ${c.twist_ar}`, ask: 'ما البديل الثاني والثالث؟ واختر بينهما بمعيار معلن في سطر.' }),
  action: () => ({ text: 'مديرك يطلب منك الآن خطة مكتوبة في خمسة أسطر لتعميمها خلال ساعة: ماذا، متى، من المسؤول.', ask: 'اكتب الخطة بخطوات مرقّمة ولكل خطوة زمن ومسؤول.' }),
  ethics: () => ({ text: 'يُعرض عليك حل يُغلق الموقف بهدوء بشرط ألا يُوثَّق شيء وألا يعرف أحد خارج الغرفة.', ask: 'هل تقبل؟ ولماذا؟ وما الذي ستفصح عنه ولمن، حتى لو كلّفك ذلك؟' }),
  human_loop: () => ({ text: 'نظام ذكي تستخدمه جهتك يخرج الآن بتوصية جاهزة وواثقة لهذا الموقف بالضبط — وتعرف أنه أصاب في 80% من الحالات السابقة.', ask: 'هل تعتمدها؟ وما الذي تتحقق منه قبل ذلك، وأين يبقى القرار بشريًا؟' }),
  presence: (c, party) => ({ text: `${party} أمامك الآن وجهًا لوجه، متوتر، ويقول: «أريد أن أعرف ما سيحدث لي.»`, ask: 'ما أول جملتين تقولهما حرفيًا؟ وماذا تفعل قبل أن تتحدث عن القرار؟' }),
  follow_up: () => ({ text: 'نفّذتَ قرارك. مرّت 30 يومًا، وكل شيء يبدو هادئًا — لكن لا أحد قاس شيئًا.', ask: 'كيف تعرف أن قرارك عمل فعلًا؟ حدّد علامة نجاح واحدة، وموعدًا، ومن يراجعها معك.' }),
};
export function whatIfFor(c: DailyCase, ev: CaseEvaluation): WhatIf {
  const order = [...ev.rubric_hits].sort((a, b) => a.hit - b.hit || (c.rubric.find(r => r.code === b.code)?.weight || 1) - (c.rubric.find(r => r.code === a.code)?.weight || 1));
  const tests = (order[0]?.code || 'follow_up') as RubricCode; const party = c.parties_ar[1] || c.parties_ar[0] || 'أحد الأطراف';
  const t = WHATIF_TPL[tests](c, party);
  return { text_ar: t.text, ask_ar: t.ask, tests, source: 'local', model: null };
}
export function buildWhatIfPrompt(c: DailyCase, response: string, ev: CaseEvaluation): { system: string; user: string } {
  const w = whatIfFor(c, ev);
  const system = 'أنت «أثير» رفيق أَثَر. تضيف إلى موقف تدريبي معلومة جديدة واحدة واقعية تُغيّر الصورة وتختبر المعيار الذي غاب عن ردّ الممارس، ثم تطلب القرار مرة أخرى. جملتان إلى أربع، بلا وعظ، JSON فقط: {"text_ar": string, "ask_ar": string}.';
  const user = `الموقف: ${c.title_ar}\n${c.situation_ar}\nالتعقيد الخفي: ${c.twist_ar}\nالأطراف: ${c.parties_ar.join('، ')}\nالمعيار الذي غاب: ${RUBRIC_LABEL[w.tests].ar} (${RUBRIC_LABEL[w.tests].hint_ar})\nردّ الممارس الأول:\n"""${String(response).slice(0, 1500)}"""\nمقترح محلي يمكنك تحسينه: ${w.text_ar} — ${w.ask_ar}`;
  return { system, user };
}
export function parseWhatIf(raw: any, local: WhatIf): WhatIf | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const text = S(j.text_ar, 600); const ask = S(j.ask_ar, 300); if (text.length < 30 || ask.length < 10) return null;
  return { ...local, text_ar: text, ask_ar: ask, source: 'ai' };
}
const HELD = ['أبقى', 'أثبت', 'لا أغيّر', 'لا اغير', 'لن أغيّر', 'لن اغير', 'لا أعدّل', 'لا اعدل', 'لا أتراجع', 'لا اتراجع', 'نفس القرار', 'أتمسّك', 'اتمسك', 'ما زلت', 'مازلت', 'لن أتراجع', 'لن اتراجع', 'أصرّ', 'اصر'];
const REVISED = ['أغيّر', 'اغير', 'أتراجع', 'اتراجع', 'أعدّل', 'اعدل', 'أراجع قراري', 'اراجع قراري', 'بدلًا', 'بدلا', 'أعيد النظر', 'اعيد النظر', 'الآن أرى', 'الان اري', 'كنت مخطئ', 'أخطأت', 'اخطات', 'أوقف', 'اوقف', 'أؤجل', 'اؤجل'];
export function evaluateRound2(c: DailyCase, w: WhatIf, first: CaseEvaluation, response: string): Round2 {
  const ev2 = localEvaluate(c, response); const t = norm(response);
  // عبارات الثبات (ومنها النفي: «لا أغيّر»، «لن أتراجع») تُحذف قبل البحث عن عبارات المراجعة حتى لا يُحسب النفي مراجعةً
  const heldHits = HELD.map(norm).filter(k => t.includes(k)); let rest = t; for (const k of heldHits) rest = rest.split(k).join(' ');
  const held = heldHits.length > 0; const revised = REVISED.some(k => rest.includes(norm(k)));
  const stance: Round2['stance'] = revised ? 'revised' : held ? 'held' : 'unclear';
  const before = first.rubric_hits.find(h => h.code === w.tests)?.hit ?? 0; const after = ev2.rubric_hits.find(h => h.code === w.tests)?.hit ?? 0;
  // الفرق يُقاس بتغطية المعايير (البنية) لا بطول النص — الجولة الثانية قرار مركّز لا مقال
  const cover = (hits: { code: RubricCode; hit: number }[]) => { const rub = c.rubric.length ? c.rubric : R(); const ws = rub.reduce((a, r) => a + r.weight * 2, 0) || 1; return Math.round(100 * rub.reduce((a, r) => a + r.weight * (hits.find(h => h.code === r.code)?.hit || 0), 0) / ws); };
  const shift = cover(ev2.rubric_hits) - cover(first.rubric_hits); const lbl = RUBRIC_LABEL[w.tests];
  const handled = after > before || after === 2;
  const verdict = [
    handled ? `حين تغيّرت الصورة تعاملتَ مع ما كان غائبًا في ردّك الأول — ${lbl.ar} — وهذا هو جوهر «ماذا لو».` : `المعلومة الجديدة كانت تختبر «${lbl.ar}» تحديدًا، ولم يظهر في ردّك الثاني بوضوح: ${lbl.hint_ar}؟`,
    stance === 'revised' ? ' راجعتَ قرارك صراحةً، وهذا ليس ضعفًا؛ القدرة على التعديل أمام معلومة جديدة من أندر ما يُقاس.' : stance === 'held' ? ' ثبتَّ على قرارك مع تعليل؛ الثبات المعلَّل قوة ما دام قد أخذ المعلومة الجديدة بالحسبان.' : ' لم يتضح هل غيّرتَ قرارك أم ثبتَّ عليه — قل ذلك صراحةً في المرة القادمة؛ الوضوح جزء من القرار.',
  ].join('');
  const adapt = shift >= 10 ? 'مرونتك أمام المستجدّ عالية: ردّك الثاني أعمق من الأول.' : shift <= -10 ? 'انكمش ردّك حين تعقّد الموقف؛ تدرّب على أن تُبقي البنية نفسها (أطراف، بدائل، خطوات، متابعة) حتى تحت الضغط.' : 'حافظتَ على مستواك حين تغيّرت الصورة — اتساق جيد.';
  return { whatif: w, response, score: ev2.score, band: ev2.band, shift, stance, verdict_ar: verdict, adaptability_ar: adapt, rubric_hits: ev2.rubric_hits, source: 'local', model: null };
}

// ====================================================================== المقارنة المجهولة: «كيف تصرّف N شخصًا آخر اليوم»
export type Crowd = { n: number; bands: Record<Band, number>; avg: number; rubric_rates: { code: RubricCode; rate: number }[]; most_missed: RubricCode | null; stances?: { held: number; revised: number } };
export function crowdOf(rows: { score?: number | null; band?: string | null; evaluation?: any; round2?: any }[]): Crowd {
  const bands: Record<Band, number> = { emerging: 0, capable: 0, distinguished: 0, exceptional: 0 }; let sum = 0; let n = 0;
  const hits: Record<string, { got: number; n: number }> = {}; const st = { held: 0, revised: 0 };
  for (const r of rows) {
    const sc = Number(r.score); if (!Number.isFinite(sc)) continue; n++; sum += sc; const b = (r.band && (r.band as Band) in bands ? r.band : bandOf(sc)) as Band; bands[b]++;
    const rh = Array.isArray(r.evaluation?.rubric_hits) ? r.evaluation.rubric_hits : [];
    for (const h of rh) { const k = String(h.code); hits[k] = hits[k] || { got: 0, n: 0 }; hits[k].n++; if (Number(h.hit) >= 1) hits[k].got++; }
    if (r.round2?.stance === 'held') st.held++; if (r.round2?.stance === 'revised') st.revised++;
  }
  const rates = RUBRIC_CODES.filter(c => hits[c]).map(c => ({ code: c, rate: Math.round(100 * hits[c].got / hits[c].n) })).sort((a, b) => b.rate - a.rate);
  const mostMissed = rates.length ? rates[rates.length - 1].code : null;
  return { n, bands, avg: n ? Math.round(sum / n) : 0, rubric_rates: rates, most_missed: mostMissed, stances: st };
}
export function crowdLine(me: CaseEvaluation | null, crowd: Crowd, rows: { score?: number | null }[] = []): string {
  if (!crowd.n) return 'أنت أول من تعامل مع هذا الموقف اليوم.';
  const others = me ? Math.max(0, crowd.n - 1) : crowd.n;
  const people = (n: number, other: boolean) => n === 1 ? (other ? 'شخص واحد آخر' : 'شخص واحد') : n === 2 ? (other ? 'شخصان آخران' : 'شخصان') : n <= 10 ? `${n} ${other ? 'أشخاص آخرون' : 'أشخاص'}` : `${n} ${other ? 'شخصًا آخر' : 'شخصًا'}`;
  if (!me) return `تعامل ${people(others, false)} مع هذا الموقف اليوم؛ متوسط المرآة ${crowd.avg}.`;
  const below = rows.filter(r => Number(r.score) < me.score).length; const pct = Math.round(100 * below / Math.max(1, rows.length));
  const miss = crowd.most_missed ? ` أكثر معيار غاب عن الجميع: ${RUBRIC_LABEL[crowd.most_missed].ar}.` : '';
  return others === 0 ? `أنت أول من تعامل مع هذا الموقف اليوم — عُد مساءً لترى كيف تصرّف الآخرون.` : `تعامل ${people(others, true)} مع هذا الموقف اليوم؛ ردّك أعلى من ${pct}% منهم.${miss}`;
}
