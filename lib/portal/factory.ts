// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — منظومة تصميم البرامج المدعومة بالذكاء الاصطناعي («هندسة البرامج التدريبية» · P13-أ)
 *  تبدأ من الاحتياج الإنساني (القطاع × المجال × المرحلة × المؤسسة × الأفق × الفجوة) لا من الموضوع، وتمرّ بأربع محطات:
 *  محلل الاحتياج (استشراف) → المصمم التعليمي (مخطط برنامج قابل للتشغيل) → مراجع الجودة (قائمة فحص ودليل الأسلوب) → الاعتماد البشري (النشر كبرنامج مسودّة)
 *  كل محطة لها بديل محلي كامل؛ الذكاء الاصطناعي يُحسّن ولا يقرّر. المصطلحات وفق المعجم (LEXICON-ATHAR-AR).
 *  P13-ب: جسر الهندسة ↔ عقود الأثر — contractProposalFrom/contractUrlFor: مؤشرات الأثر تصبح أهداف عقد 60/25/15 بضغطة «اقترح عقد أثر».
 */
import { parseJsonLoose } from '../ai/prompts';
import { HUMAN_DOMAINS, FAMILIES, HORIZON_LABEL, SECTORS_2062, domainByCode, familyByCode, sectorByCode, lexiconIssues } from './lexicon';
import type { DomainCode, FamilyCode, Horizon } from './lexicon';

export type Stage = 'foresight' | 'designed' | 'reviewed' | 'published';
export const STAGES: { code: Stage; label_ar: string; agent_ar: string }[] = [
  { code: 'foresight', label_ar: 'استشراف', agent_ar: 'محلل الاحتياج' }, { code: 'designed', label_ar: 'مصمَّم', agent_ar: 'المصمم التعليمي' },
  { code: 'reviewed', label_ar: 'مُراجَع', agent_ar: 'مراجع الجودة' }, { code: 'published', label_ar: 'منشور', agent_ar: 'الاعتماد البشري' },
];
export type LifeStage = 'childhood' | 'adolescence' | 'youth' | 'adulthood' | 'wisdom';
export const LIFE_STAGES: { code: LifeStage; label_ar: string }[] = [
  { code: 'childhood', label_ar: 'الطفولة (0–12)' }, { code: 'adolescence', label_ar: 'المراهقة (13–18)' }, { code: 'youth', label_ar: 'الشباب (19–30)' }, { code: 'adulthood', label_ar: 'الرشد (31–55)' }, { code: 'wisdom', label_ar: 'الحكمة (56+)' },
];
export type Institution = 'family' | 'mosque' | 'school' | 'work' | 'society';
export const INSTITUTIONS: { code: Institution; label_ar: string }[] = [
  { code: 'work', label_ar: 'العمل' }, { code: 'school', label_ar: 'المدرسة والجامعة' }, { code: 'family', label_ar: 'الأسرة' }, { code: 'mosque', label_ar: 'المسجد والمرجعيات' }, { code: 'society', label_ar: 'المجتمع والدولة' },
];
export type Need = { sector: string; domain_code: DomainCode; family: FamilyCode; stage: LifeStage; institution: Institution; horizon: Horizon; gap_ar: string; audience_ar: string; org_name?: string | null };
export type Foresight = { headline_ar: string; why_now_ar: string; scarce_ar: string; risks_ar: string[]; competencies_ar: string[]; indicators_ar: string[]; evidence_kinds: string[]; wave_ar: string };
export type ModuleSpec = { title_ar: string; outcome_ar: string; simulation_ar: string; mission_ar: string; evidence_ar: string; hours: number };
export type Design = { brand_ar: string; subtitle_ar: string; name_en: string; saqf_level: number; hours: number; weeks: number; delivery: 'remote' | 'onsite' | 'hybrid'; audience_ar: string; intro_ar: string; objectives_ar: string[]; outcomes_ar: string[]; modules: ModuleSpec[]; assessment_ar: string[]; impact_indicators_ar: string[]; contract_split: { delivery: number; evidence: number; impact: number }; price_hint_sar: number; human_gates_ar: string[] };
export type ReviewItem = { code: string; label_ar: string; ok: boolean; note_ar: string };
export type Review = { score: number; verdict: 'approve' | 'revise'; items: ReviewItem[]; lexicon: { bad: string; good: string }[]; summary_ar: string };
export type Draft = { id: string; created_at: string; created_by?: string | null; title_ar: string; need: Need; stage: Stage; foresight: Foresight | null; design: Design | null; review: Review | null; program_id?: string | null; notes?: string | null; log: { at: string; by: string; action: string; source?: string }[]; updated_at?: string };
export const DRAFT_COLS = 'id,created_at,created_by,title_ar,need,stage,foresight,design,review,program_id,notes,log,updated_at';

export const EMPTY_NEED: Need = { sector: 'training', domain_code: 'judgment', family: 'judgment_accountability', stage: 'adulthood', institution: 'work', horizon: 2035, gap_ar: '', audience_ar: '', org_name: '' };
export function validateNeed(n: Partial<Need>): string | null {
  if (!n.sector || !sectorByCode(n.sector)) return 'اختر القطاع';
  if (!n.domain_code || !domainByCode(n.domain_code)) return 'اختر المجال (H1–H12)';
  if (!n.family || !familyByCode(n.family)) return 'اختر عائلة ما بعد الذكاء الاصطناعي (F1–F8)';
  if (!LIFE_STAGES.some(s => s.code === n.stage)) return 'اختر المرحلة العمرية';
  if (!INSTITUTIONS.some(s => s.code === n.institution)) return 'اختر مؤسسة البناء';
  if (![2035, 2050, 2070].includes(Number(n.horizon))) return 'اختر الأفق الزمني';
  if (!n.gap_ar || n.gap_ar.trim().length < 20) return 'صِف فجوة الجدارات في 20 حرفًا على الأقل';
  if (!n.audience_ar || n.audience_ar.trim().length < 5) return 'حدّد الفئة المستهدفة';
  return null;
}
export function needPayload(n: Partial<Need>): Need { return { sector: String(n.sector), domain_code: n.domain_code as DomainCode, family: n.family as FamilyCode, stage: n.stage as LifeStage, institution: n.institution as Institution, horizon: Number(n.horizon) as Horizon, gap_ar: String(n.gap_ar || '').trim().slice(0, 1200), audience_ar: String(n.audience_ar || '').trim().slice(0, 200), org_name: String(n.org_name || '').trim().slice(0, 160) || null }; }
export function draftTitle(n: Need): string { const d = domainByCode(n.domain_code)!; const s = sectorByCode(n.sector)!; return `${d.name.ar} — ${s.name.ar} · ${HORIZON_LABEL[n.horizon].ar}`; }

// ====================================================================== 1) محلل الاحتياج (استشراف)
const EVIDENCE_BY_DOMAIN: Record<DomainCode, string[]> = {
  purpose: ['تصديق مرشد/أسرة', 'سجل زمني'], judgment: ['محاكاة قرار مهني', 'مهمة قلب العمل مؤكَّدة', 'سجل دقة القرارات'], integrity: ['تصديق مشرف على موقف أمانة', 'إفصاح موثَّق'], resilience: ['التزام ممارسة مشهود', 'تحدٍّ بطيء موثَّق'], vitality: ['أداء مشهود أمام مدرب', 'سجل انتباه طوعي'], relational: ['تصديق الطرف الآخر', 'شبكة الشهادة'], language: ['مِعيار', 'نص أصيل مشهود', 'خطابة مُقيَّمة'], professional: ['مهمة قلب العمل مؤكَّدة', 'حدود تفويض معتمدة', 'عقد أثر'], financial: ['تصديق الشريك على ميزانية مُفوَّضة', 'التزام عطاء'], civic: ['ساعات تطوع مشهودة', 'حوار عبر الاختلاف مُقيَّم'], creative: ['عمل يدوي مشهود', 'سرد أصالة'], digital_sovereignty: ['ميثاق تفويض مكتوب ومُراجَع', 'انفصال موثَّق'],
};
export function localForesight(n: Need): Foresight {
  const d = domainByCode(n.domain_code)!; const f = familyByCode(n.family)!; const s = sectorByCode(n.sector)!; const wave = n.horizon === 2035 ? s.w2035 : n.horizon === 2050 ? s.w2050 : s.w2070;
  return {
    headline_ar: `${d.name.ar} لـ${n.audience_ar} في قطاع ${s.name.ar} — ${HORIZON_LABEL[n.horizon].ar}`,
    why_now_ar: `في ${s.name.ar} ${wave}. الفجوة المعلنة: «${n.gap_ar.slice(0, 200)}». ما يُدفع مقابله في هذا الأفق ليس المعرفة بل ${d.scarce_2062.ar} — وهذا ما يجب أن يبنيه البرنامج ويُثبته بشواهد.`,
    scarce_ar: d.scarce_2062.ar,
    risks_ar: [`إذا لم يُبنَ: ${n.institution === 'work' ? 'تفويض أعمى للأنظمة الذكية وفقدان المساءلة' : n.institution === 'school' ? 'تعليم قابل للتنزيل لا يصنع حكمًا' : n.institution === 'family' ? 'والدية مفوَّضة للجهاز' : 'فقدان الدور حين تختفي الوظيفة'}`, `خطر التصميم التقليدي: محتوى يُشرح بدل قدرة تُمارَس وتُشهَد`, `خطر القياس: الاكتفاء بالرضا (المستوى 1) دون سلوك وأثر (3–4)`],
    competencies_ar: [`${d.h} ${d.name.ar}`, `${f.f} ${f.name.ar}`, ...(n.horizon >= 2050 ? ['F1 الحكم المهني وتحمّل المسؤولية'] : ['F2 قيادة الأنظمة الذكية وإدارة التفويض'])],
    indicators_ar: ['نسبة الشواهد المُصدَّقة بشريًا (HCRI)', 'مؤشر الاحتفاظ بالقدرة البشرية: الأداء بلا نظام', `تغيّر سلوك مُصدَّق من المشرف بعد 60 يومًا`],
    evidence_kinds: EVIDENCE_BY_DOMAIN[n.domain_code],
    wave_ar: wave,
  };
}
export function buildForesightPrompt(n: Need): { system: string; user: string } {
  const d = domainByCode(n.domain_code)!; const f = familyByCode(n.family)!; const s = sectorByCode(n.sector)!;
  const system = 'أنت «محلل الاحتياج» في منظومة تصميم البرامج ببوابة أَثَر (التدريب ما بعد الذكاء الاصطناعي). تُحلّل احتياجًا إنسانيًا لا موضوعًا، بلغة الجدارات (مهارة → كفاية → جدارة → قدرة → أداء → أثر)، ولا تختلق أرقامًا. JSON فقط.';
  const schema = '{"headline_ar": string, "why_now_ar": string (4 جمل), "scarce_ar": string, "risks_ar": string[3], "competencies_ar": string[3-5], "indicators_ar": string[3], "evidence_kinds": string[2-4], "wave_ar": string}';
  const user = `القطاع: ${s.name.ar} — مصيره: 2035: ${s.w2035} · 2050: ${s.w2050} · 2070: ${s.w2070}\nالمجال: ${d.h} ${d.name.ar} (الندرة في 2062: ${d.scarce_2062.ar})\nالعائلة: ${f.f} ${f.name.ar}\nالمرحلة: ${LIFE_STAGES.find(x => x.code === n.stage)?.label_ar} · المؤسسة: ${INSTITUTIONS.find(x => x.code === n.institution)?.label_ar} · الأفق: ${HORIZON_LABEL[n.horizon].ar}\nالفئة: ${n.audience_ar}${n.org_name ? ` · الجهة: ${n.org_name}` : ''}\nالفجوة: ${n.gap_ar}\nالمخطط:\n${schema}`;
  return { system, user };
}
const S = (v: unknown, max = 400): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const A = (v: unknown, n: number, len = 240): string[] => Array.isArray(v) ? v.map(x => S(x, len)).filter(Boolean).slice(0, n) : [];
export function parseForesight(raw: any, local: Foresight): Foresight | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const f: Foresight = { headline_ar: S(j.headline_ar, 160) || local.headline_ar, why_now_ar: S(j.why_now_ar, 900) || local.why_now_ar, scarce_ar: S(j.scarce_ar, 200) || local.scarce_ar, risks_ar: A(j.risks_ar, 4).length ? A(j.risks_ar, 4) : local.risks_ar, competencies_ar: A(j.competencies_ar, 5).length ? A(j.competencies_ar, 5) : local.competencies_ar, indicators_ar: A(j.indicators_ar, 4).length ? A(j.indicators_ar, 4) : local.indicators_ar, evidence_kinds: A(j.evidence_kinds, 4, 80).length ? A(j.evidence_kinds, 4, 80) : local.evidence_kinds, wave_ar: S(j.wave_ar, 300) || local.wave_ar };
  return f.why_now_ar.length > 40 ? f : null;
}

// ====================================================================== 2) المصمم التعليمي
const BRANDS: Record<DomainCode, { brand: string; en: string }> = {
  purpose: { brand: 'الغاية: اكتب حياتك قبل أن تُكتب لك', en: 'Purpose Before It Is Written For You' }, judgment: { brand: 'حين تختلف الآلات', en: 'When the Machines Disagree' }, integrity: { brand: 'الممكن ليس المباح', en: 'Possible Is Not Permissible' }, resilience: { brand: 'الصلابة الهادئة', en: 'Quiet Strength' },
  vitality: { brand: '90 دقيقة', en: 'Ninety Minutes' }, relational: { brand: 'من يشهد لك', en: 'Who Vouches For You' }, language: { brand: 'العربية لغة تفكير لا ترجمة', en: 'Arabic as Thought' }, professional: { brand: 'مدير فريقك الاصطناعي الأول', en: 'Your First AI Team' },
  financial: { brand: 'أن تملك ولا تُملَك', en: 'Own, Not Owned' }, civic: { brand: 'الإنسان في الحلقة', en: 'Human in the Loop' }, creative: { brand: 'صنعتُه بيدي', en: 'Made By My Hand' }, digital_sovereignty: { brand: 'من يقرّر عنك؟', en: 'Who Decides For You?' },
};
const SAQF_BY_STAGE: Record<LifeStage, number> = { childhood: 2, adolescence: 3, youth: 5, adulthood: 6, wisdom: 7 };
export function localDesign(n: Need, fs: Foresight): Design {
  const d = domainByCode(n.domain_code)!; const b = BRANDS[n.domain_code]; const f = familyByCode(n.family)!;
  const hours = n.institution === 'family' ? 12 : n.stage === 'childhood' ? 10 : 24; const weeks = Math.max(2, Math.round(hours / 4));
  const verbs = ['يُقرّر', 'يُفوِّض', 'يُراجِع', 'يُصدِّق', 'يُطبّق'];
  const modules: ModuleSpec[] = [
    { title_ar: 'الموقف الأول: ما الذي يحدث فعلًا؟', outcome_ar: `${verbs[0]} الممارس في موقف من قطاعه بعد تسمية القضية الجوهرية وأطرافها`, simulation_ar: `محاكاة قرار مهني: توصيتان آليتان متعارضتان في سياق ${n.audience_ar}`, mission_ar: 'توثيق قرار حقيقي من الأسبوع مع أطرافه وبدائله', evidence_ar: 'محاكاة بمعيار + تصديق مشرف', hours: Math.round(hours * 0.2) },
    { title_ar: `${d.h} في الممارسة اليومية`, outcome_ar: `${verbs[4]} الممارس ثلاث ممارسات من ${d.name.ar} في بيئته ويُظهر أثرها`, simulation_ar: `موقف اليوم × 5 أيام (مواقف ${d.story.ar})`, mission_ar: `مهمة قلب ${n.institution === 'work' ? 'العمل' : 'الحياة'}: تطبيق مشهود`, evidence_ar: fs.evidence_kinds[0] || 'تصديق بشري', hours: Math.round(hours * 0.25) },
    { title_ar: `${f.f}: ${f.name.ar}`, outcome_ar: `${verbs[1]} الممارس للأنظمة الذكية بحدود مكتوبة ويحتفظ بالقرار`, simulation_ar: 'ورشة كتابة حدود التفويض (ما يُفوَّض، ما لا يُفوَّض، من يُسأل)', mission_ar: 'حدود تفويض معتمدة من المشرف/الأسرة', evidence_ar: 'وثيقة تفويض مُراجَعة', hours: Math.round(hours * 0.2) },
    { title_ar: 'الشاهد: من يُصدّق؟', outcome_ar: `${verbs[3]} زميلٌ أو مشرف أو طرف متأثر أداءَ الممارس في موقف حقيقي`, simulation_ar: 'تبادل أدوار: الممارس شاهدًا على زميل', mission_ar: 'طلب تصديق من طرف غير مهني (حين يناسب المجال)', evidence_ar: 'تصديق بشري موثَّق', hours: Math.round(hours * 0.15) },
    { title_ar: 'بعد 60 يومًا: ماذا تغيّر؟', outcome_ar: `${verbs[2]} الممارس قراراته بعد 60 يومًا بعلامة نجاح محددة`, simulation_ar: 'جلسة مراجعة حيّة مع الدفعة', mission_ar: 'تقرير شواهد الأثر للمشرف', evidence_ar: 'سجل زمني + تصديق مشرف', hours: Math.max(1, hours - 4 * Math.round(hours * 0.2)) },
  ];
  return {
    brand_ar: b.brand, subtitle_ar: `برنامج ${d.name.ar} لـ${n.audience_ar} في بيئات الذكاء الاصطناعي`, name_en: b.en, saqf_level: SAQF_BY_STAGE[n.stage], hours, weeks, delivery: n.institution === 'family' ? 'hybrid' : 'remote', audience_ar: n.audience_ar,
    intro_ar: `${fs.why_now_ar} يبني البرنامج ${d.name.ar} عبر مواقف حقيقية ومحاكيات قرار ومهام تطبيقية يُصدّقها بشر، ويُثبت أثره بعد 60 يومًا.`,
    objectives_ar: [`أن ${verbs[0]} الممارس في مواقف ${d.story.ar} مع تحمّل التبعة`, `أن ${verbs[1]} الممارس للأنظمة الذكية بحدود معلنة ويحتفظ بالحكم البشري`, `أن ${verbs[4]} الممارس ثلاث ممارسات مشهودة في بيئته خلال ${weeks} أسابيع`, `أن ${verbs[2]} الممارس أثر قراراته بعلامات نجاح بعد 60 يومًا`],
    outcomes_ar: [`ملف شواهد: ${fs.evidence_kinds.join('، ')}`, 'حدود تفويض مكتوبة ومعتمدة', 'مستوى مُحتسَب ومعتمد في المجال داخل الملف المهني الرقمي', 'شواهد أثر قابلة لعقد قائم على النتائج'],
    modules, assessment_ar: ['تقويم قائم على الأداء (محاكاة بمعيار معلن)', 'تقويم قائم على الشواهد (مهام مُصدَّقة)', 'لا امتحانات معرفية؛ لا درجة بلا شاهد', 'كل مستوى يؤثر في قرار يعتمده إنسان مسؤول باسمه'],
    impact_indicators_ar: fs.indicators_ar, contract_split: { delivery: 60, evidence: 25, impact: 15 }, price_hint_sar: hours * (n.institution === 'work' ? 450 : 250),
    human_gates_ar: ['اعتماد المصمم البشري للمخطط', 'تصديق المشرف على كل مهمة', 'اعتماد المستوى قبل الشهادة', 'الإفراج عن دفعات العقد قرار بشري'],
  };
}
export function buildDesignPrompt(n: Need, fs: Foresight): { system: string; user: string } {
  const d = domainByCode(n.domain_code)!;
  const system = 'أنت «المصمم التعليمي» في بوابة أَثَر. تصمّم برنامج بناء جدارة لا دورة محتوى: أهداف بأفعال قابلة للقياس (يُقرّر، يُفوِّض، يُراجِع، يُصدِّق، يُطبّق)، وحدات كلٌّ منها محاكاة + مهمة تطبيقية + شاهد أداء، تقويم بلا اختبار معرفي، بوابات بشرية، ومؤشرات أثر لعقد قائم على النتائج. ممنوع: «مهارات ناعمة»، «اختبار»، «ثوري»، «سحري». JSON فقط.';
  const schema = '{"brand_ar": string (اسم علامة قصير), "subtitle_ar": string (عنوان مهني فرعي), "name_en": string, "saqf_level": number (2-8), "hours": number, "weeks": number, "delivery": "remote|onsite|hybrid", "audience_ar": string, "intro_ar": string, "objectives_ar": string[4], "outcomes_ar": string[3-4], "modules": [{"title_ar", "outcome_ar", "simulation_ar", "mission_ar", "evidence_ar", "hours": number}] (5), "assessment_ar": string[3-4], "impact_indicators_ar": string[3], "contract_split": {"delivery": 60, "evidence": 25, "impact": 15}, "price_hint_sar": number, "human_gates_ar": string[3-4]}';
  const user = `الاحتياج: ${draftTitle(n)} · الفئة: ${n.audience_ar} · الفجوة: ${n.gap_ar}\nالاستشراف: ${fs.headline_ar} — ${fs.why_now_ar}\nالجدارات: ${fs.competencies_ar.join('، ')} · الشواهد: ${fs.evidence_kinds.join('، ')} · المؤشرات: ${fs.indicators_ar.join('، ')}\nالمجال السردي: «${d.story.ar}».\nالمخطط:\n${schema}`;
  return { system, user };
}
export function parseDesign(raw: any, local: Design): Design | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const mods: ModuleSpec[] = Array.isArray(j.modules) ? j.modules.map((m: any) => ({ title_ar: S(m?.title_ar, 120), outcome_ar: S(m?.outcome_ar, 300), simulation_ar: S(m?.simulation_ar, 300), mission_ar: S(m?.mission_ar, 300), evidence_ar: S(m?.evidence_ar, 160), hours: Math.max(1, Math.round(Number(m?.hours) || 2)) })).filter((m: ModuleSpec) => m.title_ar && m.outcome_ar).slice(0, 8) : [];
  const split = j.contract_split && Number(j.contract_split.delivery) + Number(j.contract_split.evidence) + Number(j.contract_split.impact) === 100 ? { delivery: Number(j.contract_split.delivery), evidence: Number(j.contract_split.evidence), impact: Number(j.contract_split.impact) } : local.contract_split;
  const d: Design = { ...local, brand_ar: S(j.brand_ar, 80) || local.brand_ar, subtitle_ar: S(j.subtitle_ar, 160) || local.subtitle_ar, name_en: S(j.name_en, 120) || local.name_en, saqf_level: Math.min(8, Math.max(2, Math.round(Number(j.saqf_level) || local.saqf_level))), hours: Math.min(400, Math.max(4, Math.round(Number(j.hours) || local.hours))), weeks: Math.min(52, Math.max(1, Math.round(Number(j.weeks) || local.weeks))), delivery: ['remote', 'onsite', 'hybrid'].includes(j.delivery) ? j.delivery : local.delivery, audience_ar: S(j.audience_ar, 200) || local.audience_ar, intro_ar: S(j.intro_ar, 900) || local.intro_ar, objectives_ar: A(j.objectives_ar, 6).length >= 3 ? A(j.objectives_ar, 6) : local.objectives_ar, outcomes_ar: A(j.outcomes_ar, 5).length ? A(j.outcomes_ar, 5) : local.outcomes_ar, modules: mods.length >= 3 ? mods : local.modules, assessment_ar: A(j.assessment_ar, 5).length ? A(j.assessment_ar, 5) : local.assessment_ar, impact_indicators_ar: A(j.impact_indicators_ar, 4).length ? A(j.impact_indicators_ar, 4) : local.impact_indicators_ar, contract_split: split, price_hint_sar: Math.max(0, Math.round(Number(j.price_hint_sar) || local.price_hint_sar)), human_gates_ar: A(j.human_gates_ar, 5).length ? A(j.human_gates_ar, 5) : local.human_gates_ar };
  return d.objectives_ar.length >= 3 && d.modules.length >= 3 ? d : null;
}

// ====================================================================== 3) مراجع الجودة (قائمة فحص حتمية + دليل الأسلوب)
const MEASURABLE = /(يُقرّر|يقرر|يُفوِّض|يفوض|يُراجِع|يراجع|يُصدِّق|يصدق|يُطبّق|يطبق|يُنتج|ينتج|يُصمّم|يصمم|يكتب|يُقيّم|يقيم|يُثبت|يثبت|يُحلّل|يحلل|يُظهر|يظهر|يُنفّذ|ينفذ|يُوثّق|يوثق|يختار|يبني|يقود)/;
const VAGUE = /(يتعرف|يتعرّف|يدرك|يفهم|يُقدّر|يقدر|يشعر|يعي|يلمّ|يلم)/;
export function localReview(n: Need, d: Design): Review {
  const items: ReviewItem[] = [];
  const measurable = d.objectives_ar.filter(o => MEASURABLE.test(o) && !VAGUE.test(o)).length;
  items.push({ code: 'objectives', label_ar: 'أهداف بأفعال قابلة للقياس', ok: measurable >= Math.ceil(d.objectives_ar.length * 0.75), note_ar: `${measurable}/${d.objectives_ar.length} هدفًا قابلًا للملاحظة` });
  const withEvidence = d.modules.filter(m => m.evidence_ar && m.mission_ar).length;
  items.push({ code: 'evidence', label_ar: 'كل وحدة لها مهمة تطبيقية وشاهد أداء', ok: withEvidence === d.modules.length, note_ar: `${withEvidence}/${d.modules.length} وحدة` });
  const withSim = d.modules.filter(m => m.simulation_ar).length;
  items.push({ code: 'simulation', label_ar: 'محاكاة/موقف في كل وحدة', ok: withSim >= d.modules.length - 1, note_ar: `${withSim}/${d.modules.length}` });
  items.push({ code: 'human_gates', label_ar: 'بوابات بشرية معلنة', ok: d.human_gates_ar.length >= 3, note_ar: `${d.human_gates_ar.length} بوابات` });
  const noTest = !d.assessment_ar.some(a => /اختبار/.test(a) && !/لا اختبار/.test(a));
  items.push({ code: 'no_test', label_ar: 'تقويم قائم على الأداء والشواهد (لا اختبار معرفي)', ok: noTest, note_ar: noTest ? 'مطابق' : 'يوجد اختبار معرفي' });
  items.push({ code: 'impact', label_ar: 'مؤشرات أثر قابلة لعقد قائم على النتائج', ok: d.impact_indicators_ar.length >= 3 && d.contract_split.delivery + d.contract_split.evidence + d.contract_split.impact === 100, note_ar: `${d.impact_indicators_ar.length} مؤشرات · تقسيم ${d.contract_split.delivery}/${d.contract_split.evidence}/${d.contract_split.impact}` });
  const sumHours = d.modules.reduce((s, m) => s + m.hours, 0);
  items.push({ code: 'hours', label_ar: 'ساعات الوحدات تساوي ساعات البرنامج (±20%)', ok: Math.abs(sumHours - d.hours) <= Math.max(2, d.hours * 0.2), note_ar: `${sumHours} من ${d.hours}` });
  items.push({ code: 'naming', label_ar: 'اسم علامة + عنوان مهني فرعي + مستوى سقف', ok: !!d.brand_ar && !!d.subtitle_ar && d.saqf_level >= 2, note_ar: `«${d.brand_ar}» — ${d.subtitle_ar} · سقف ${d.saqf_level}` });
  const dom = domainByCode(n.domain_code)!;
  items.push({ code: 'horizon_fit', label_ar: 'ملاءمة الأفق: يبني ما يندر لا ما يُؤتمت', ok: n.horizon === 2035 || /حكم|تفويض|معنى|حضور|شاهد|تصديق/.test([d.intro_ar, ...d.objectives_ar].join(' ')), note_ar: dom.scarce_2062.ar });
  const lexicon = lexiconIssues([d.brand_ar, d.subtitle_ar, d.intro_ar, ...d.objectives_ar, ...d.outcomes_ar, ...d.assessment_ar, ...d.modules.map(m => `${m.title_ar} ${m.outcome_ar}`)].join('\n'));
  items.push({ code: 'lexicon', label_ar: 'مطابقة دليل الأسلوب (المعجم)', ok: lexicon.length === 0, note_ar: lexicon.length ? lexicon.map(l => `«${l.bad}» → ${l.good}`).join('، ') : 'لا مخالفات' });
  const ok = items.filter(i => i.ok).length; const score = Math.round(100 * ok / items.length); const verdict: Review['verdict'] = score >= 80 ? 'approve' : 'revise';
  return { score, verdict, items, lexicon, summary_ar: verdict === 'approve' ? `المخطط جاهز للاعتماد البشري (${ok}/${items.length}). راجع البنود غير المطابقة إن وُجدت ثم انشر.` : `المخطط يحتاج مراجعة قبل الاعتماد (${ok}/${items.length}): ${items.filter(i => !i.ok).map(i => i.label_ar).join('، ')}.` };
}
export function buildReviewPrompt(n: Need, d: Design, local: Review): { system: string; user: string } {
  const system = 'أنت «مراجع الجودة» في بوابة أَثَر. تراجع مخطط برنامج بناء جدارة وفق: قابلية قياس الأهداف، تغطية الشواهد، البوابات البشرية، ملاءمة الأفق الزمني، دليل الأسلوب. لا تُعدّل المخطط؛ أعطِ ملاحظات محددة يعتمدها الإنسان. JSON فقط.';
  const schema = '{"summary_ar": string (3–4 جمل: أقوى ما فيه، أخطر ما ينقصه، توصية), "extra_items": [{"code": string, "label_ar": string, "ok": boolean, "note_ar": string}] (0-3)}';
  const user = `الاحتياج: ${draftTitle(n)}\nالمخطط: ${JSON.stringify({ brand: d.brand_ar, subtitle: d.subtitle_ar, objectives: d.objectives_ar, modules: d.modules.map(m => m.title_ar), assessment: d.assessment_ar, indicators: d.impact_indicators_ar })}\nنتيجة الفحص الحتمي: ${local.score}% — ${local.items.filter(i => !i.ok).map(i => i.label_ar).join('، ') || 'كل البنود مطابقة'}\nالمخطط:\n${schema}`;
  return { system, user };
}
export function parseReview(raw: any, local: Review): Review | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const summary = S(j.summary_ar, 700); if (summary.length < 30) return null;
  const extra: ReviewItem[] = Array.isArray(j.extra_items) ? j.extra_items.map((x: any) => ({ code: `ai_${S(x?.code, 30) || 'note'}`, label_ar: S(x?.label_ar, 120), ok: !!x?.ok, note_ar: S(x?.note_ar, 240) })).filter((x: ReviewItem) => x.label_ar).slice(0, 3) : [];
  const items = [...local.items, ...extra]; const ok = items.filter(i => i.ok).length; const score = Math.round(100 * ok / items.length);
  return { ...local, items, score, verdict: score >= 80 ? 'approve' : 'revise', summary_ar: summary };
}

// ====================================================================== 4) الاعتماد البشري → برنامج مسودّة
export function programPayload(d: Design, n: Need): Record<string, unknown> {
  const dom = domainByCode(n.domain_code)!;
  return {
    name_ar: `${d.brand_ar} — ${d.subtitle_ar}`, name_en: d.name_en, status: 'DRAFT', delivery_mode: d.delivery === 'onsite' ? 'onsite' : 'remote', hours: d.hours, is_public: false, registration_open: false,
    description_ar: `${d.intro_ar}\n\nالجدارات: ${dom.h} ${dom.name.ar} · الأفق: ${HORIZON_LABEL[n.horizon].ar} · المستوى (سقف): ${d.saqf_level}`,
    intro_ar: d.intro_ar, objectives_ar: d.objectives_ar.join('\n'), outcomes_ar: d.outcomes_ar.join('\n'), audience_ar: d.audience_ar,
  };
}
export function nextStage(s: Stage): Stage | null { const i = STAGES.findIndex(x => x.code === s); return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1].code : null; }
export function stageLabel(s: Stage): string { return STAGES.find(x => x.code === s)?.label_ar || s; }
/** ملخص المحفظة للوحة الهندسة */
export function factoryStats(drafts: Draft[]): { total: number; by_stage: Record<Stage, number>; by_domain: { code: DomainCode; h: string; n: number }[]; horizons: Record<string, number> } {
  const by_stage: Record<Stage, number> = { foresight: 0, designed: 0, reviewed: 0, published: 0 }; const horizons: Record<string, number> = { 2035: 0, 2050: 0, 2070: 0 }; const dm = new Map<DomainCode, number>();
  for (const d of drafts) { by_stage[d.stage] = (by_stage[d.stage] || 0) + 1; horizons[String(d.need.horizon)] = (horizons[String(d.need.horizon)] || 0) + 1; dm.set(d.need.domain_code, (dm.get(d.need.domain_code) || 0) + 1); }
  return { total: drafts.length, by_stage, by_domain: HUMAN_DOMAINS.map(h => ({ code: h.code, h: h.h, n: dm.get(h.code) || 0 })), horizons };
}
export const FACTORY_SECTORS = SECTORS_2062;
export const FACTORY_FAMILIES = FAMILIES;

// ====================================================================== جسر الهندسة ↔ عقود الأثر (P13-ب)
/** مقترح عقد أثر من مسودة منشورة: مؤشرات الأثر تصبح أهداف العقد، والتقسيم 60/25/15 (أو ما اقترحه المصمم) يصبح تقسيم الدفعات */
export type ContractProposal = { title_ar: string; program_id: string | null; split: { delivery: number; evidence: number; impact: number }; targets: { evidence_rate: number; impact_days: number; impact_rate: number }; notes: string; indicators: string[]; price_hint_sar: number; factory_draft_id: string };
export function contractProposalFrom(d: Draft): ContractProposal {
  const des = d.design; const fs = d.foresight;
  const indicators = (des?.impact_indicators_ar?.length ? des.impact_indicators_ar : fs?.indicators_ar || []).slice(0, 5);
  const sp = des?.contract_split && des.contract_split.delivery + des.contract_split.evidence + des.contract_split.impact === 100 ? des.contract_split : { delivery: 60, evidence: 25, impact: 15 };
  const horizonDays = d.need.horizon >= 2050 ? 120 : 90;
  const targets = { evidence_rate: des && des.saqf_level >= 6 ? 70 : 60, impact_days: horizonDays, impact_rate: 50 };
  const title = `عقد أثر — ${des?.brand_ar || d.title_ar}`;
  const notes = [`مُقترح من هندسة البرامج التدريبية (مسودة ${d.id.slice(0, 8)}).`, indicators.length ? `مؤشرات الأثر المتعاقد عليها: ${indicators.map((x, i) => `${i + 1}) ${x}`).join(' ')}` : '', des ? `المدة: ${des.hours} ساعة / ${des.weeks} أسابيع · مستوى الإطار الوطني للمؤهلات: ${des.saqf_level} · السعر الاسترشادي للمتدرب: ${des.price_hint_sar} ر.س` : '', fs?.scarce_ar ? `القدرة النادرة المستهدفة: ${fs.scarce_ar}` : ''].filter(Boolean).join('\n');
  return { title_ar: title, program_id: d.program_id || null, split: sp, targets, notes, indicators, price_hint_sar: des?.price_hint_sar || 0, factory_draft_id: d.id };
}
/** رابط صفحة العقود مع التعبئة المسبقة (يُقرأ من window.location في صفحة العقود) */
export function contractUrlFor(d: Draft): string {
  const p = contractProposalFrom(d); const q = new URLSearchParams({ new: '1', from_factory: d.id, program: p.program_id || '', title: p.title_ar, split: `${p.split.delivery}/${p.split.evidence}/${p.split.impact}`, targets: `${p.targets.evidence_rate}/${p.targets.impact_days}/${p.targets.impact_rate}`, notes: p.notes.slice(0, 1200) });
  return `/admin/contracts?${q.toString()}`;
}
/** قراءة التعبئة المسبقة من سلسلة الاستعلام (صفحة العقود) */
export function contractPrefillFromQuery(search: string): null | { program_id: string; title_ar: string; split: { delivery: number; evidence: number; impact: number }; targets: { evidence_rate: number; impact_days: number; impact_rate: number }; notes: string; factory_draft_id: string } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search); if (q.get('new') !== '1') return null;
  const nums = (s: string | null, n: number, def: number[]) => { const a = String(s || '').split('/').map(x => Number(x)); return a.length === n && a.every(x => Number.isFinite(x) && x >= 0) ? a : def; };
  const sp = nums(q.get('split'), 3, [60, 25, 15]); const tg = nums(q.get('targets'), 3, [60, 90, 50]);
  const split = sp[0] + sp[1] + sp[2] === 100 ? { delivery: sp[0], evidence: sp[1], impact: sp[2] } : { delivery: 60, evidence: 25, impact: 15 };
  return { program_id: String(q.get('program') || ''), title_ar: String(q.get('title') || '').slice(0, 160), split, targets: { evidence_rate: Math.min(100, tg[0]), impact_days: Math.min(365, tg[1]), impact_rate: Math.min(100, tg[2]) }, notes: String(q.get('notes') || '').slice(0, 1200), factory_draft_id: String(q.get('from_factory') || '') };
}
