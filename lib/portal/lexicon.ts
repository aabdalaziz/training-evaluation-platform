// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — المعجم المرجعي (P13-أ): المجالات الاثنا عشر لبناء الإنسان (H1–H12) · عائلات مهارات ما بعد الذكاء الاصطناعي (F1–F8) · الآفاق الزمنية
 *  · تقويم المناسبات (وطنية/دولية) الذي يربط التعلّم بالحدث · مؤشرات: اتزان الجدارات (وسيط هندسي) · جاهزية المستقبل · الاحتفاظ بالقدرة البشرية (HCRI)
 *  · أطلس القطاعات (القائمة والمستحدثة) عبر ثلاث موجات لتجربة «/2062».
 *  المصطلح المهني الرسمي يُستخدم في الواجهات الإدارية والعقود؛ الاسم السردي في الرئيسية وتجربة 2062. (LEXICON-ATHAR-AR)
 */
import type { Lang, T } from './content';
import { t } from './content';

// ====================================================================== 1) المجالات الاثنا عشر
export type DomainCode = 'purpose' | 'judgment' | 'integrity' | 'resilience' | 'vitality' | 'relational' | 'language' | 'professional' | 'financial' | 'civic' | 'creative' | 'digital_sovereignty';
export type HumanDomain = { code: DomainCode; h: string; name: T; story: T; personal: boolean; tone: string; question: T; scarce_2062: T; legacy: string[] };
export const HUMAN_DOMAINS: HumanDomain[] = [
  { code: 'purpose', h: 'H1', name: { ar: 'جدارات المعنى والغاية المهنية', en: 'Purpose & meaning' }, story: { ar: 'لماذا أعيش ولمن أنتمي', en: 'Why I live and whom I belong to' }, personal: true, tone: 'gold', question: { ar: 'لماذا أعمل؟', en: 'Why do I work?' }, scarce_2062: { ar: 'الطمأنينة بسند وسط أسئلة وجودية غير مسبوقة', en: 'Grounded certainty amid unprecedented existential questions' }, legacy: [] },
  { code: 'judgment', h: 'H2', name: { ar: 'جدارات الحكم المهني والتفكير النقدي', en: 'Professional judgment & critical thinking' }, story: { ar: 'حين تختلف الآلات', en: 'When the machines disagree' }, personal: false, tone: 'navy', question: { ar: 'كيف أفكّر حين تفكّر الآلة أسرع؟', en: 'How do I think when the machine thinks faster?' }, scarce_2062: { ar: 'السؤال الأصيل والقرار في المنطقة الرمادية', en: 'The original question and the decision in the grey zone' }, legacy: ['quality', 'research'] },
  { code: 'integrity', h: 'H3', name: { ar: 'النزاهة المهنية والجدارات القيمية', en: 'Integrity & ethical competence' }, story: { ar: 'الممكن ليس المباح', en: 'Possible is not permissible' }, personal: false, tone: 'ok', question: { ar: 'ما الذي لن أفعله مهما كان ممكنًا؟', en: 'What will I never do, however possible?' }, scarce_2062: { ar: 'الأمانة حين يصبح التزييف مجانيًا', en: 'Honesty when forgery is free' }, legacy: [] },
  { code: 'resilience', h: 'H4', name: { ar: 'المرونة النفسية والذكاء العاطفي', en: 'Resilience & emotional intelligence' }, story: { ar: 'الصلابة الهادئة', en: 'Quiet strength' }, personal: true, tone: 'rose', question: { ar: 'كيف أبقى سويًّا تحت وفرة لا تنتهي؟', en: 'How do I stay whole under endless abundance?' }, scarce_2062: { ar: 'قيمة الذات غير المشروطة بالإنتاج', en: 'Self-worth not conditioned on output' }, legacy: ['wellbeing'] },
  { code: 'vitality', h: 'H5', name: { ar: 'الرفاه المهني والطاقة والتركيز', en: 'Wellbeing, energy & focus' }, story: { ar: '90 دقيقة', en: '90 minutes' }, personal: false, tone: 'teal', question: { ar: 'هل أملك جسدي وانتباهي؟', en: 'Do I own my body and attention?' }, scarce_2062: { ar: 'التركيز العميق والحضور الجسدي', en: 'Deep focus and bodily presence' }, legacy: [] },
  { code: 'relational', h: 'H6', name: { ar: 'الجدارات العلائقية والقيادة الاجتماعية', en: 'Relational competence & social leadership' }, story: { ar: 'من يشهد لك', en: 'Who vouches for you' }, personal: true, tone: 'violet', question: { ar: 'من يشهد لي ومن أشهد له؟', en: 'Who attests for me, and for whom do I attest?' }, scarce_2062: { ar: 'الثقة التي لا يزوّرها وكيل', en: 'Trust no agent can forge' }, legacy: ['leadership'] },
  { code: 'language', h: 'H7', name: { ar: 'الكفاءة اللغوية والتواصل المهني', en: 'Language proficiency & professional communication' }, story: { ar: 'العربية لغة تفكير', en: 'Arabic as a language of thought' }, personal: false, tone: 'teal', question: { ar: 'بأي لغة أفكّر وأحكم؟', en: 'In which language do I think and judge?' }, scarce_2062: { ar: 'لغة الحكم لا لغة الترجمة', en: 'A language of judgment, not of translation' }, legacy: ['arabic'] },
  { code: 'professional', h: 'H8', name: { ar: 'الممارسة المهنية وإدارة التفويض للأنظمة الذكية', en: 'Professional practice & agent supervision' }, story: { ar: 'مدير فريقك الاصطناعي', en: 'Manager of your AI team' }, personal: false, tone: 'navy', question: { ar: 'ما قيمتي حين لا يُحتاج إلى عملي؟', en: 'What is my value when my labour is not needed?' }, scarce_2062: { ar: 'الحكم والتفويض والمساءلة والحِرفة', en: 'Judgment, delegation, accountability and craft' }, legacy: ['pedagogy', 'digital'] },
  { code: 'financial', h: 'H9', name: { ar: 'الثقافة المالية والرشد الاقتصادي', en: 'Financial literacy & economic prudence' }, story: { ar: 'أن تملك ولا تُملَك', en: 'To own and not be owned' }, personal: false, tone: 'gold', question: { ar: 'كيف أملك ولا أُملَك؟', en: 'How do I own without being owned?' }, scarce_2062: { ar: 'الكفاية والرشد في اقتصاد ما بعد العمل', en: 'Sufficiency and prudence in a post-work economy' }, legacy: [] },
  { code: 'civic', h: 'H10', name: { ar: 'المسؤولية المجتمعية والمواطنة الفاعلة', en: 'Civic & social responsibility' }, story: { ar: 'الإنسان في الحلقة', en: 'Human in the loop' }, personal: false, tone: 'ok', question: { ar: 'ما دوري في الصالح العام؟', en: 'What is my role in the common good?' }, scarce_2062: { ar: 'المساهمة حين تختفي الوظيفة كدور', en: 'Contribution when the job disappears as a role' }, legacy: [] },
  { code: 'creative', h: 'H11', name: { ar: 'الإبداع والابتكار والحِرفية', en: 'Creativity, innovation & craftsmanship' }, story: { ar: 'صنعتُه بيدي', en: 'Made by my hand' }, personal: false, tone: 'warn', question: { ar: 'ما الذي أصنعه بيدي وقلبي؟', en: 'What do I make with my hands and heart?' }, scarce_2062: { ar: 'الذوق والأصالة الموثّقة', en: 'Taste and verified authenticity' }, legacy: [] },
  { code: 'digital_sovereignty', h: 'H12', name: { ar: 'الثقافة الرقمية والسيادة على البيانات', en: 'Digital literacy & data sovereignty' }, story: { ar: 'من يقرّر عنك', en: 'Who decides for you' }, personal: true, tone: 'sky', question: { ar: 'من يقرّر عني ومن يعرف عني؟', en: 'Who decides for me, and who knows about me?' }, scarce_2062: { ar: 'التفويض الواعي والهوية غير المُستلَبة', en: 'Conscious delegation and an un-captured identity' }, legacy: ['data_ai'] },
];
export const DOMAIN_CODES = HUMAN_DOMAINS.map(d => d.code) as DomainCode[];
export const domainByCode = (c: string | null | undefined): HumanDomain | null => HUMAN_DOMAINS.find(d => d.code === c) || null;
export const domainName = (c: string | null | undefined, lang: Lang): string => { const d = domainByCode(c); return d ? `${d.h} · ${t(d.name, lang)}` : String(c || ''); };
/** يُسقط مجال التصنيف القديم (arabic/pedagogy/…) على أحد المجالات الاثني عشر — يُستخدم حين تكون الخانة الجديدة فارغة */
export function legacyToDomain(legacy: string | null | undefined): DomainCode {
  const d = HUMAN_DOMAINS.find(x => x.legacy.includes(String(legacy || ''))); return d ? d.code : 'professional';
}

// ====================================================================== 2) عائلات ما بعد الذكاء الاصطناعي
export type FamilyCode = 'judgment_accountability' | 'agent_leadership' | 'verification_trust' | 'ethics_meaning' | 'synthesis_creativity' | 'presence_influence' | 'self_reinvention' | 'focus_wellbeing';
export type Family = { code: FamilyCode; f: string; name: T; frameworks: string; domains: DomainCode[] };
export const FAMILIES: Family[] = [
  { code: 'judgment_accountability', f: 'F1', name: { ar: 'الحكم المهني وتحمّل المسؤولية', en: 'Judgment & accountability' }, frameworks: 'OECD: تحمّل المسؤولية · WEF: التفكير التحليلي', domains: ['judgment', 'integrity'] },
  { code: 'agent_leadership', f: 'F2', name: { ar: 'قيادة الأنظمة الذكية وإدارة التفويض', en: 'AI agent leadership & delegation' }, frameworks: 'WEF: الذكاء الاصطناعي والبيانات · إدارة المواهب', domains: ['professional', 'digital_sovereignty'] },
  { code: 'verification_trust', f: 'F3', name: { ar: 'التحقق والنزاهة وبناء الثقة', en: 'Verification, integrity & trust' }, frameworks: 'حوكمة الذكاء الاصطناعي المسؤول', domains: ['integrity', 'judgment'] },
  { code: 'ethics_meaning', f: 'F4', name: { ar: 'الأخلاقيات المهنية وصناعة المعنى', en: 'Professional ethics & meaning-making' }, frameworks: 'OECD: التوفيق بين التوترات', domains: ['purpose', 'integrity', 'civic'] },
  { code: 'synthesis_creativity', f: 'F5', name: { ar: 'الإبداع التركيبي عبر التخصصات', en: 'Cross-disciplinary creative synthesis' }, frameworks: 'OECD: خلق قيمة جديدة · WEF: التفكير الإبداعي', domains: ['creative', 'judgment'] },
  { code: 'presence_influence', f: 'F6', name: { ar: 'الحضور والتأثير والتواصل الإنساني', en: 'Presence, influence & human communication' }, frameworks: 'WEF: القيادة والتأثير الاجتماعي · التعاطف والإصغاء', domains: ['relational', 'language', 'vitality'] },
  { code: 'self_reinvention', f: 'F7', name: { ar: 'التعلّم الذاتي وإعادة التمهير المستمر', en: 'Self-directed learning & continuous reskilling' }, frameworks: 'WEF: الفضول والتعلّم مدى الحياة · المرونة', domains: ['professional', 'resilience', 'financial'] },
  { code: 'focus_wellbeing', f: 'F8', name: { ar: 'التركيز العميق والرفاه المهني', en: 'Deep focus & occupational wellbeing' }, frameworks: 'WEF: الدافعية والوعي الذاتي', domains: ['vitality', 'resilience'] },
];
export const familyByCode = (c: string | null | undefined): Family | null => FAMILIES.find(f => f.code === c) || null;
export const familyName = (c: string | null | undefined, lang: Lang): string => { const f = familyByCode(c); return f ? `${f.f} · ${t(f.name, lang)}` : String(c || ''); };
export const HORIZONS = [2035, 2050, 2070] as const;
export type Horizon = (typeof HORIZONS)[number];
export const HORIZON_LABEL: Record<Horizon, T> = { 2035: { ar: 'موجة الوكلاء (2035)', en: 'Agents wave (2035)' }, 2050: { ar: 'موجة المعنى (2050)', en: 'Meaning wave (2050)' }, 2070: { ar: 'ما بعد العمل (2070)', en: 'Post-work (2070)' } };
export type Resilience = 'low' | 'medium' | 'high';
export const RESILIENCE_LABEL: Record<Resilience, T> = { low: { ar: 'صمود منخفض — قابلة للأتمتة', en: 'Low resilience — automatable' }, medium: { ar: 'صمود متوسط — تتحوّل', en: 'Medium — transforms' }, high: { ar: 'صمود مرتفع — لا تُنسخ', en: 'High — cannot be copied' } };

// ====================================================================== 3) تقويم المناسبات (ميلادي؛ المناسبات الهجرية تُضاف يدويًا من الإدارة)
export type CalendarEvent = { code: string; name: T; month: number; day: number | null; rule?: 'first_friday' | 'second_thursday'; kind: 'national' | 'international' | 'month'; domains: DomainCode[]; theme: T };
export const EVENTS: CalendarEvent[] = [
  { code: 'education_day', name: { ar: 'اليوم الدولي للتعليم', en: 'International Day of Education' }, month: 1, day: 24, kind: 'international', domains: ['judgment', 'professional'], theme: { ar: 'ما الذي يستحق أن يُعلَّم حين يصبح كل شيء قابلًا للتنزيل؟', en: 'What deserves teaching when everything is downloadable?' } },
  { code: 'mother_language_day', name: { ar: 'اليوم الدولي للغة الأم', en: 'International Mother Language Day' }, month: 2, day: 21, kind: 'international', domains: ['language'], theme: { ar: 'اللغة التي نفكّر بها لا التي نُترجَم إليها', en: 'The language we think in, not the one we are translated into' } },
  { code: 'founding_day', name: { ar: 'يوم التأسيس', en: 'Saudi Founding Day' }, month: 2, day: 22, kind: 'national', domains: ['purpose', 'civic'], theme: { ar: 'الجذور التي تجعل المستقبل ممكنًا', en: 'Roots that make the future possible' } },
  { code: 'women_day', name: { ar: 'اليوم العالمي للمرأة', en: 'International Women’s Day' }, month: 3, day: 8, kind: 'international', domains: ['relational', 'civic'], theme: { ar: 'قيادة تُشهَد لا تُعلَن', en: 'Leadership that is witnessed, not announced' } },
  { code: 'flag_day', name: { ar: 'يوم العلم السعودي', en: 'Saudi Flag Day' }, month: 3, day: 11, kind: 'national', domains: ['civic', 'purpose'], theme: { ar: 'الرمز والمعنى في زمن الصور المولَّدة', en: 'Symbol and meaning in the age of generated images' } },
  { code: 'mothers_day', name: { ar: 'يوم الأم', en: 'Mother’s Day' }, month: 3, day: 21, kind: 'international', domains: ['relational'], theme: { ar: 'الحضور الذي لا يُفوَّض', en: 'Presence that cannot be delegated' } },
  { code: 'orphan_day', name: { ar: 'يوم اليتيم العربي', en: 'Arab Orphan Day' }, month: 4, day: null, rule: 'first_friday', kind: 'international', domains: ['relational', 'civic'], theme: { ar: 'الكفالة علاقة لا تحويلًا ماليًا', en: 'Sponsorship is a relationship, not a transfer' } },
  { code: 'book_day', name: { ar: 'اليوم العالمي للكتاب', en: 'World Book Day' }, month: 4, day: 23, kind: 'international', domains: ['language', 'judgment'], theme: { ar: 'القراءة البطيئة في زمن التلخيص الفوري', en: 'Slow reading in the age of instant summaries' } },
  { code: 'labour_day', name: { ar: 'يوم العمال العالمي', en: 'International Workers’ Day' }, month: 5, day: 1, kind: 'international', domains: ['professional', 'financial'], theme: { ar: 'ما العمل حين لا يعود ضروريًا؟', en: 'What is work when it is no longer necessary?' } },
  { code: 'family_day', name: { ar: 'اليوم الدولي للأسرة', en: 'International Day of Families' }, month: 5, day: 15, kind: 'international', domains: ['relational', 'digital_sovereignty'], theme: { ar: 'ميثاق رقمي للأسرة', en: 'A family digital charter' } },
  { code: 'environment_day', name: { ar: 'اليوم العالمي للبيئة', en: 'World Environment Day' }, month: 6, day: 5, kind: 'international', domains: ['civic'], theme: { ar: 'عدالة بين الأجيال', en: 'Justice between generations' } },
  { code: 'youth_skills_day', name: { ar: 'اليوم العالمي لمهارات الشباب', en: 'World Youth Skills Day' }, month: 7, day: 15, kind: 'international', domains: ['professional', 'resilience'], theme: { ar: 'مهارة تبقى حين تذوب الوظيفة', en: 'A skill that outlives the job' } },
  { code: 'youth_day', name: { ar: 'اليوم الدولي للشباب', en: 'International Youth Day' }, month: 8, day: 12, kind: 'international', domains: ['purpose', 'professional'], theme: { ar: 'أول قرار تحت تبعة', en: 'The first decision under accountability' } },
  { code: 'literacy_day', name: { ar: 'اليوم الدولي لمحو الأمية', en: 'International Literacy Day' }, month: 9, day: 8, kind: 'international', domains: ['language', 'digital_sovereignty'], theme: { ar: 'أمية جديدة: من لا يقرأ ما تفعله الآلة', en: 'A new illiteracy: not reading what the machine does' } },
  { code: 'national_day', name: { ar: 'اليوم الوطني السعودي', en: 'Saudi National Day' }, month: 9, day: 23, kind: 'national', domains: ['civic', 'purpose'], theme: { ar: 'الوطنية فعلٌ يُشهَد عليه', en: 'Patriotism is a witnessed act' } },
  { code: 'elderly_day', name: { ar: 'اليوم الدولي للمسنين', en: 'International Day of Older Persons' }, month: 10, day: 1, kind: 'international', domains: ['relational'], theme: { ar: 'الخبرة الضمنية التي لا تملكها النماذج', en: 'Tacit experience no model holds' } },
  { code: 'teacher_day', name: { ar: 'اليوم العالمي للمعلم', en: 'World Teachers’ Day' }, month: 10, day: 5, kind: 'international', domains: ['judgment', 'professional'], theme: { ar: 'المعلم 2050: يُقيَّم بالأسئلة الأصيلة', en: 'Teacher 2050: judged by original questions' } },
  { code: 'mental_health_day', name: { ar: 'اليوم العالمي للصحة النفسية', en: 'World Mental Health Day' }, month: 10, day: 10, kind: 'international', domains: ['resilience', 'vitality'], theme: { ar: 'حدود مع الرفيق الاصطناعي', en: 'Boundaries with the artificial companion' } },
  { code: 'quality_month', name: { ar: 'شهر الجودة العالمي', en: 'World Quality Month' }, month: 11, day: null, kind: 'month', domains: ['judgment', 'integrity'], theme: { ar: 'الجودة = ما يُثبَت لا ما يُعلَن', en: 'Quality is what is proven, not declared' } },
  { code: 'quality_day', name: { ar: 'اليوم العالمي للجودة', en: 'World Quality Day' }, month: 11, day: null, rule: 'second_thursday', kind: 'international', domains: ['judgment', 'integrity'], theme: { ar: 'مؤشر لا يكذب', en: 'An indicator that does not lie' } },
  { code: 'children_day', name: { ar: 'اليوم العالمي للطفل', en: 'World Children’s Day' }, month: 11, day: 20, kind: 'international', domains: ['relational', 'digital_sovereignty'], theme: { ar: 'الدهشة قبل الشاشة', en: 'Wonder before the screen' } },
  { code: 'disability_day', name: { ar: 'اليوم الدولي للأشخاص ذوي الإعاقة', en: 'International Day of Persons with Disabilities' }, month: 12, day: 3, kind: 'international', domains: ['relational', 'civic'], theme: { ar: 'تصميم يبدأ من الهامش', en: 'Design that starts from the margin' } },
  { code: 'volunteer_day', name: { ar: 'اليوم الدولي للتطوع', en: 'International Volunteer Day' }, month: 12, day: 5, kind: 'international', domains: ['civic', 'purpose'], theme: { ar: 'خدمة بلا توثيق رقمي — عمدًا', en: 'Service without digital proof — on purpose' } },
  { code: 'human_rights_day', name: { ar: 'يوم حقوق الإنسان', en: 'Human Rights Day' }, month: 12, day: 10, kind: 'international', domains: ['integrity', 'civic'], theme: { ar: 'حق الإنسان في قرار بشري', en: 'The human right to a human decision' } },
  { code: 'arabic_month', name: { ar: 'شهر اللغة العربية', en: 'Arabic Language Month' }, month: 12, day: null, kind: 'month', domains: ['language'], theme: { ar: 'العربية لغة تفكير لا واجهة ترجمة', en: 'Arabic as thought, not a translation layer' } },
  { code: 'arabic_day', name: { ar: 'اليوم العالمي للغة العربية', en: 'World Arabic Language Day' }, month: 12, day: 18, kind: 'international', domains: ['language'], theme: { ar: 'من يملك لغة الحكم يملك الخطاب', en: 'Whoever owns the language of judgment owns the discourse' } },
];
function ruleDay(e: CalendarEvent, year: number): number | null {
  if (e.day) return e.day; if (!e.rule) return null;
  const first = new Date(Date.UTC(year, e.month - 1, 1)).getUTCDay(); // 0=Sunday
  if (e.rule === 'first_friday') return 1 + ((5 - first + 7) % 7);
  if (e.rule === 'second_thursday') return 1 + ((4 - first + 7) % 7) + 7;
  return null;
}
export type ActiveEvent = { event: CalendarEvent; distance: number; exact: boolean; day: number | null };
/** المناسبات الفاعلة في يوم معيّن (YYYY-MM-DD): اليوم نفسه، أو خلال نافذة ترقّب (قبلها حتى 3 أيام)، أو مناسبة شهر كامل. مرتّبة بالأولوية. */
export function eventsFor(dayIso: string, events: CalendarEvent[] = EVENTS, window = 3): ActiveEvent[] {
  const d = new Date(dayIso.slice(0, 10) + 'T00:00:00Z'); if (Number.isNaN(d.getTime())) return [];
  const y = d.getUTCFullYear(); const m = d.getUTCMonth() + 1; const dd = d.getUTCDate(); const out: ActiveEvent[] = [];
  for (const e of events) {
    if (e.month !== m) continue;
    const day = ruleDay(e, y);
    if (e.kind === 'month' && day === null) { out.push({ event: e, distance: 99, exact: false, day: null }); continue; }
    if (day === null) continue;
    const dist = day - dd; if (dist === 0) out.push({ event: e, distance: 0, exact: true, day }); else if (dist > 0 && dist <= window) out.push({ event: e, distance: dist, exact: false, day });
  }
  return out.sort((a, b) => a.distance - b.distance);
}
/** المناسبات القادمة خلال n يومًا (بعد اليوم المعطى) — للشريط «مواقف قادمة مرتبطة بمناسبات» */
export function upcomingEvents(dayIso: string, events: CalendarEvent[] = EVENTS, days = 30): ActiveEvent[] {
  const d = new Date(dayIso.slice(0, 10) + 'T00:00:00Z'); if (Number.isNaN(d.getTime())) return [];
  const out: ActiveEvent[] = [];
  for (const e of events) {
    if (e.kind === 'month') continue;
    for (const y of [d.getUTCFullYear(), d.getUTCFullYear() + 1]) {
      const day = ruleDay(e, y); if (day === null) continue;
      const dist = Math.round((Date.UTC(y, e.month - 1, day) - d.getTime()) / 86400000);
      if (dist > 0 && dist <= days) out.push({ event: e, distance: dist, exact: false, day });
    }
  }
  return out.sort((a, b) => a.distance - b.distance);
}
export const eventByCode = (c: string | null | undefined): CalendarEvent | null => EVENTS.find(e => e.code === c) || null;

// ====================================================================== 4) المؤشرات
export type DomainScore = { code: DomainCode; h: string; name: T; personal: boolean; level: number; skills: number; confidence: number; evidence: number; human_attested: number };
/** يبني خريطة الجدارات الاثني عشر من صفوف المستويات ومعلومات المهارات (domain_code أو المجال القديم) */
export function domainMap(levels: { skill_id: string; computed_level: number; approved_level?: number | null; confidence: number; evidence?: { kind: string; weight?: number }[] }[], skills: Map<string, { domain?: string | null; domain_code?: string | null }>): DomainScore[] {
  const acc = new Map<DomainCode, { sum: number; n: number; conf: number; ev: number; human: number }>();
  for (const d of HUMAN_DOMAINS) acc.set(d.code, { sum: 0, n: 0, conf: 0, ev: 0, human: 0 });
  for (const l of levels) {
    const s = skills.get(l.skill_id); const code = (s?.domain_code as DomainCode) || legacyToDomain(s?.domain); const a = acc.get(code)!;
    const lvl = l.approved_level ?? l.computed_level; a.sum += lvl; a.n += 1; a.conf += l.confidence || 0;
    for (const e of l.evidence || []) { a.ev += 1; if (HUMAN_ATTESTED.has(e.kind)) a.human += 1; }
  }
  return HUMAN_DOMAINS.map(d => { const a = acc.get(d.code)!; return { code: d.code, h: d.h, name: d.name, personal: d.personal, level: a.n ? Math.round((a.sum / a.n) * 10) / 10 : 0, skills: a.n, confidence: a.n ? Math.round(a.conf / a.n) : 0, evidence: a.ev, human_attested: a.human }; });
}
/** أنواع الشواهد التي يصدّقها إنسان (مُصدِّق) — لا الآلة وحدها */
export const HUMAN_ATTESTED = new Set(['placement', 'credential', 'program_completed', 'mission', 'simulation', 'attended']);
/** مؤشر اتزان الجدارات: وسيط هندسي للمستويات (1–5) على المجالات التي فيها شواهد، معاقَب بنسبة المجالات الخاوية. 0–100 */
export function balanceIndex(map: DomainScore[]): number {
  const covered = map.filter(m => m.level > 0); if (!covered.length) return 0;
  const geo = Math.exp(covered.reduce((s, m) => s + Math.log(Math.max(0.5, m.level)), 0) / covered.length);
  const coverage = covered.length / map.length;
  return Math.round(Math.max(0, Math.min(100, (geo / 5) * 100 * (0.5 + 0.5 * coverage))));
}
/** مؤشر الاحتفاظ بالقدرة البشرية (HCRI): نسبة الشواهد المُصدَّقة بشريًا إلى مجموع الشواهد. 0–100 */
export function hcri(map: DomainScore[]): number { const ev = map.reduce((s, m) => s + m.evidence, 0); if (!ev) return 0; return Math.round(100 * map.reduce((s, m) => s + m.human_attested, 0) / ev); }
/** مؤشر جاهزية المستقبل: متوسط مرجَّح — المجالات ذات الأفق الأبعد (الحكم، النزاهة، التفويض، المعنى) تزن أكثر */
const READINESS_W: Record<DomainCode, number> = { judgment: 1.6, integrity: 1.4, professional: 1.4, purpose: 1.2, digital_sovereignty: 1.2, relational: 1.1, language: 1.0, resilience: 1.0, creative: 0.9, civic: 0.9, vitality: 0.8, financial: 0.7 };
export function readinessIndex(map: DomainScore[]): number {
  let w = 0, s = 0; for (const m of map) { const k = READINESS_W[m.code]; w += k; s += k * (m.level / 5); } return w ? Math.round(100 * s / w) : 0;
}
export type IndexBand = { code: 'seed' | 'growing' | 'solid' | 'leading'; label: T };
export function indexBand(v: number): IndexBand {
  if (v >= 75) return { code: 'leading', label: { ar: 'ريادي', en: 'Leading' } }; if (v >= 50) return { code: 'solid', label: { ar: 'راسخ', en: 'Solid' } };
  if (v >= 25) return { code: 'growing', label: { ar: 'نامٍ', en: 'Growing' } }; return { code: 'seed', label: { ar: 'بذرة', en: 'Seed' } };
}
/** يختار أضعف ثلاثة مجالات (مع تفضيل المجالات المهنية حين تتساوى) لاقتراح «ما التالي» */
export function weakestDomains(map: DomainScore[], n = 3): DomainScore[] { return [...map].sort((a, b) => a.level - b.level || Number(a.personal) - Number(b.personal)).slice(0, n); }

// ====================================================================== 5) أطلس القطاعات لتجربة «/2062»
export type SectorFate = { code: string; name: T; kind: 'existing' | 'new'; fate: 'dissolves' | 'transforms' | 'thrives'; w2035: string; w2050: string; w2070: string; roles: string[]; domains: DomainCode[]; decision_2062: string };
export const SECTORS_2062: SectorFate[] = [
  { code: 'education', name: { ar: 'التعليم', en: 'Education' }, kind: 'existing', fate: 'thrives', w2035: 'معلم شخصي اصطناعي لكل طالب؛ المعلم مُيسّر ومُقيّم للحكم', w2050: 'المدرسة مكان للحضور والجسد والسؤال؛ المعرفة تُنزَّل', w2070: 'التعليم = تربية الحكم والمعنى؛ يُقيَّم المعلم بعدد الأسئلة الأصيلة', roles: ['معلم', 'قائد مدرسة', 'مشرف تربوي', 'مصمم تعلّم'], domains: ['judgment', 'relational', 'language'], decision_2062: 'نظام التقييم يقترح رسوب طالبة في مادة تتقنها شفهيًا؛ تقرّر أنت أمام أسرتها' },
  { code: 'health', name: { ar: 'الصحة', en: 'Healthcare' }, kind: 'existing', fate: 'transforms', w2035: 'تشخيص آلي يفوق المتوسط البشري؛ الطبيب يحكم ويطمئن', w2050: 'طب وقائي شخصي مستمر؛ الحضور البشري عند الخبر الصعب', w2070: 'طب الهوية والوعي؛ الإنسان الذي يجلس بجانب المريض مهنة', roles: ['طبيب', 'ممرض', 'مدير مستشفى', 'أخصائي نفسي'], domains: ['judgment', 'relational', 'integrity'], decision_2062: 'توصيتان علاجيتان من نظامين معتمدين متعارضتان؛ المريض يسألك: بماذا تنصحني أنت؟' },
  { code: 'government', name: { ar: 'الحكومة والخدمة العامة', en: 'Government' }, kind: 'existing', fate: 'transforms', w2035: 'خدمات استباقية بلا طلب؛ الموظف يعالج الاستثناء', w2050: 'سياسات تُحاكى قبل إقرارها؛ معيار «الإنسان في الحلقة»', w2070: 'الحوكمة = حفظ الحكم البشري ومحاسبة الأنظمة', roles: ['موظف حكومي', 'مدير إدارة', 'محلل سياسات', 'مفتش'], domains: ['civic', 'integrity', 'judgment'], decision_2062: 'النظام يرفض معاملة مواطن بثقة 97%؛ هو أمامك ويقسم أن البيانات قديمة' },
  { code: 'training', name: { ar: 'التدريب والتطوير', en: 'Training & development' }, kind: 'existing', fate: 'thrives', w2035: 'المحتوى مجاني؛ القيمة في المحاكاة والشواهد والأثر', w2050: 'التدريب = بناء القدرة وإثباتها؛ عقود قائمة على النتائج', w2070: 'بناء الإنسان: السجل الموثّق للجدارات البشرية عبر العمر', roles: ['مدرب', 'مدير تدريب', 'مصمم برامج', 'مستشار'], domains: ['professional', 'judgment', 'relational'], decision_2062: 'جهة تطلب برنامجًا يصممه وكيلها بالكامل وتريد توقيعك عليه فقط' },
  { code: 'finance', name: { ar: 'المال والمصارف', en: 'Finance' }, kind: 'existing', fate: 'dissolves', w2035: 'وكلاء يديرون المحافظ؛ المستشار يبني الثقة', w2050: 'نقود قابلة للبرمجة؛ القيمة في الحكم الائتماني الإنساني', w2070: 'اقتصاد ما بعد العمل: توزيع المساهمة لا الأجر', roles: ['محلل مالي', 'مدير فرع', 'مسؤول امتثال'], domains: ['financial', 'integrity', 'judgment'], decision_2062: 'وكيلك المالي نفّذ تفويضًا بحدود كتبتها قبل عامين وخسر عميلًا؛ من المسؤول؟' },
  { code: 'tech', name: { ar: 'التقنية', en: 'Technology' }, kind: 'existing', fate: 'transforms', w2035: 'البرمجة تُولَّد؛ المهندس يحدّد المشكلة ويتحقق', w2050: 'هندسة الأنظمة الذكية = هندسة حدود وتفويض', w2070: 'حوكمة الخوارزميات ودبلوماسية الأنظمة', roles: ['مهندس برمجيات', 'مدير منتج', 'مسؤول أمن'], domains: ['professional', 'digital_sovereignty', 'integrity'], decision_2062: 'وكيلان من شركتين يتفاوضان نيابة عنكما وتوصّلا لاتفاق لا تفهم بنوده كاملة' },
  { code: 'media', name: { ar: 'الإعلام والثقافة', en: 'Media & culture' }, kind: 'existing', fate: 'transforms', w2035: '99% محتوى مولَّد؛ الثقة بالمصدر البشري', w2050: 'سوق الأصالة؛ ختم «صنعه إنسان»', w2070: 'الذوق والمعنى؛ الحضور الحي أغلى من البث', roles: ['صحفي', 'منتج محتوى', 'مدير اتصال'], domains: ['integrity', 'creative', 'language'], decision_2062: 'خبر عاجل مولَّد بدقة عالية ومصدره غير مؤكَّد؛ منافسوك نشروه' },
  { code: 'nonprofit', name: { ar: 'القطاع غير الربحي', en: 'Non-profit' }, kind: 'existing', fate: 'thrives', w2035: 'أثر يُقاس آليًا؛ المتطوع البشري قيمة', w2050: 'الكفالة علاقة؛ الحضور خدمة', w2070: 'القطاع الذي يوزّع المعنى حين تختفي الوظيفة', roles: ['مدير جمعية', 'مشرف برامج', 'متطوع'], domains: ['civic', 'relational', 'purpose'], decision_2062: 'المانح يريد تقرير أثر مولَّدًا خلال ساعة؛ الميدان يقول غير ما تقول البيانات' },
  { code: 'energy', name: { ar: 'الطاقة والصناعة', en: 'Energy & industry' }, kind: 'existing', fate: 'transforms', w2035: 'مصانع ذاتية؛ الإنسان للسلامة والاستثناء', w2050: 'طاقة وفيرة؛ القيمة في الحوكمة والمناخ', w2070: 'الحوكمة الكوكبية للموارد', roles: ['مهندس تشغيل', 'مدير سلامة', 'مشرف صيانة'], domains: ['judgment', 'integrity', 'vitality'], decision_2062: 'النظام يوصي بإيقاف خط إنتاج بتكلفة مليونية؛ الفني القديم يقول «ليس خطرًا»' },
  { code: 'tourism', name: { ar: 'السياحة والضيافة', en: 'Tourism & hospitality' }, kind: 'existing', fate: 'thrives', w2035: 'تخطيط آلي؛ المضيف البشري تجربة', w2050: 'اقتصاد الحضور: الاجتماع الجسدي يُحجز بأشهر', w2070: 'مُضيف المعنى مهنة', roles: ['مدير فندق', 'مرشد سياحي', 'مسؤول تجربة'], domains: ['relational', 'creative', 'language'], decision_2062: 'ضيف يرفض أي خدمة آلية ويطلب إنسانًا طوال إقامته؛ فريقك مُجهَد' },
  { code: 'law', name: { ar: 'القانون والعدالة', en: 'Law & justice' }, kind: 'existing', fate: 'transforms', w2035: 'صياغة وبحث آليان؛ المحامي يحكم ويدافع', w2050: 'محاكم الوكلاء: هل كان التفويض معقولًا؟', w2070: 'الحق في قرار بشري', roles: ['محامٍ', 'قاضٍ', 'مستشار قانوني'], domains: ['integrity', 'judgment', 'language'], decision_2062: 'موكّلك خسر لأنه لم يكتب حدود تفويض لوكيله؛ هل تتحمّل الشركة المصنّعة أم هو؟' },
  { code: 'family', name: { ar: 'الأسرة والتربية', en: 'Family & parenting' }, kind: 'existing', fate: 'thrives', w2035: 'والدية مدعومة بالوكلاء؛ خطر التفويض', w2050: 'الأسرة آخر مكان للحب غير المشروط', w2070: 'طقوس البيت وميثاقه الرقمي', roles: ['أب', 'أم', 'مربٍّ'], domains: ['relational', 'digital_sovereignty', 'purpose'], decision_2062: 'ابنك يفضّل رفيقه الاصطناعي عليك في الأسئلة الكبرى؛ ماذا تفعل الليلة؟' },
  { code: 'arabic', name: { ar: 'اللغة والترجمة', en: 'Language & translation' }, kind: 'existing', fate: 'transforms', w2035: 'الترجمة الفورية تذيب الحواجز', w2050: 'اللغة هوية وبنية تفكير', w2070: 'العربية لغة حكم: من حفظها يملك الخطاب', roles: ['معلم لغة', 'مترجم', 'كاتب'], domains: ['language', 'creative', 'purpose'], decision_2062: 'طالب أجنبي يقول: لماذا أتعلم العربية والترجمة فورية؟ أجبه في دقيقة' },
  // ----- قطاعات مستحدثة
  { code: 'n_trust', name: { ar: 'صناعة الثقة والتحقق', en: 'Trust & verification industry' }, kind: 'new', fate: 'thrives', w2035: 'ختم الأصالة، تدقيق مخرجات الوكلاء', w2050: 'سجلات مُصدَّقة بشريًا للجدارات والأعمال', w2070: 'الثقة عملة', roles: ['مدقّق أصالة', 'مُصدِّق جدارات'], domains: ['integrity', 'judgment', 'digital_sovereignty'], decision_2062: 'يُطلب منك تصديق إنجاز لا تستطيع أن تشهد أنك رأيته' },
  { code: 'n_presence', name: { ar: 'اقتصاد الحضور', en: 'Presence economy' }, kind: 'new', fate: 'thrives', w2035: 'الاجتماع الجسدي علاوة', w2050: 'الغرفة البشرية بروتوكول', w2070: 'الحضور خدمة تُحجز بأشهر', roles: ['مُضيف معنى', 'مصمم مجالس'], domains: ['relational', 'vitality', 'purpose'], decision_2062: 'مجلس حضور مهم وأحد الأعضاء يصرّ على حضور وكيله بدلًا منه' },
  { code: 'n_delegation', name: { ar: 'هندسة التفويض وحوكمة الوكلاء', en: 'Delegation & agent governance' }, kind: 'new', fate: 'thrives', w2035: 'كتابة حدود التفويض مهنة', w2050: 'محاكم الوكلاء', w2070: 'دبلوماسية الأنظمة', roles: ['مهندس تفويض', 'مدقّق وكلاء'], domains: ['professional', 'integrity', 'digital_sovereignty'], decision_2062: 'مدير يطلب تفويضًا «مفتوحًا» لوكيله لأن الحدود تبطئه' },
  { code: 'n_impact_insurance', name: { ar: 'التأمين على الأثر', en: 'Impact insurance' }, kind: 'new', fate: 'thrives', w2035: 'عقود قائمة على النتائج', w2050: 'تأمين على أثر التدريب والاستشارة', w2070: 'الأثر هو الأصل المالي', roles: ['مقيّم أثر', 'مكتتب أثر'], domains: ['judgment', 'financial', 'integrity'], decision_2062: 'عقد أثر على وشك الإخفاق بسبب ظرف خارج سيطرة المتدربين؛ هل تُفرج عن الدفعة؟' },
  { code: 'n_identity', name: { ar: 'طب الهوية والوعي', en: 'Identity & consciousness care' }, kind: 'new', fate: 'thrives', w2035: 'حدود مع الرفقاء الاصطناعيين', w2050: 'عيادات الهوية', w2070: 'من أنا حين يتذكّر النظام عني أكثر مني؟', roles: ['مرشد هوية', 'أخصائي'], domains: ['resilience', 'purpose', 'digital_sovereignty'], decision_2062: 'شاب يطلب حذف ذاكرته الرقمية كاملة ليبدأ من جديد' },
  { code: 'n_craft', name: { ar: 'الحِرفة الموثّقة', en: 'Verified craft' }, kind: 'new', fate: 'thrives', w2035: '«صنعه إنسان» علامة', w2050: 'سوق الأصالة أكبر من سوق السيارات', w2070: 'التراث الحي من يد إلى يد', roles: ['حِرفي', 'موثّق أصالة'], domains: ['creative', 'integrity', 'purpose'], decision_2062: 'زبون يعرض ضعف السعر مقابل ختم «يدوي» على قطعة ساعدتك الآلة في نصفها' },
  { code: 'n_language_sovereignty', name: { ar: 'اللغة كبنية تفكير', en: 'Language as cognitive infrastructure' }, kind: 'new', fate: 'thrives', w2035: 'نماذج عربية بأدلة حكم عربية', w2050: 'السيادة اللغوية سياسة', w2070: 'اللغة التي تُفكَّر بها الأسئلة الكبرى', roles: ['مهندس لغة', 'معلم تفكير'], domains: ['language', 'judgment', 'digital_sovereignty'], decision_2062: 'نظام تعليمي وطني يقترح تدريس التفكير بلغة النماذج «لأنها أدق»' },
];
export const sectorByCode = (c: string | null | undefined): SectorFate | null => SECTORS_2062.find(s => s.code === c) || null;
export const FATE_LABEL: Record<SectorFate['fate'], T> = { dissolves: { ar: 'تذوب مهامه', en: 'Dissolves' }, transforms: { ar: 'يتحوّل جذريًا', en: 'Transforms' }, thrives: { ar: 'يزدهر بقيمة إنسانية أعلى', en: 'Thrives' } };

// ====================================================================== 6) دليل الأسلوب — كلمات ممنوعة في الواجهات المهنية
export const FORBIDDEN_TERMS: { bad: string; good: string }[] = [
  { bad: 'مهارات ناعمة', good: 'مهارات بشرية' }, { bad: 'سحري', good: '—' }, { bad: 'ثوري', good: '—' }, { bad: 'غير مسبوق', good: '—' }, { bad: 'الأول عالميًا', good: '—' },
  { bad: 'اختبار', good: 'شواهد أداء' }, { bad: 'دليل', good: 'شاهد أداء' }, { bad: 'المتدربين', good: 'الممارسين' },
];
/** يفحص نصًا مهنيًا ويعيد المصطلحات المخالفة لدليل الأسلوب */
export function lexiconIssues(text: string): { bad: string; good: string }[] { const s = String(text || ''); return FORBIDDEN_TERMS.filter(f => s.includes(f.bad)); }
