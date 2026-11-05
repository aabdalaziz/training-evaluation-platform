// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خريطة المنهج» (م6-ب) — وسم وحدات المستوى على بنود البنك
 *  الاسم الرسمي (الإدارة/التقارير): «خريطة المنهج — وسم وحدات المستوى» / Syllabus Map.
 *  - خريطة المستوى: وحدات لكل مستوى (A1…C1) بلا ارتباط ببرنامج بعينه — تُعاد للاستخدام. البذرة (38 وحدة) مصوغة من واصفات CEFR
 *    الموجودة في البنك (miaar_descriptors) بحالة draft، ويعتمدها إنسان من لسان «خريطة المنهج».
 *  - الوسم: question_bank_items.unit_codes text[] (بند قد يخدم وحدتين). الاقتراح الآلي (Gemini) يظهر كاقتراح حتى يعتمده إنسان — بلا وسم صامت.
 *  - التغطية في الاختبار: مولّد السحب يوازن داخل كل خلية (مستوى×مهارة) حتى تظهر كل وحدة معتمدة ببند واحد على الأقل — بلا تغيير للعدد أو الأوزان.
 *  - «ما دُرّس فقط»: نطاق اختياري على الدعوة (unit_scope) يحصر البنود في وحدات بعينها؛ إن ضاق السحب يعود إلى المستوى كاملًا ويُسجَّل ذلك.
 *  - التقارير: report.الوحدات (صواب/عدد لكل وحدة) → exit.الوحدات مرتّبة من الأضعف؛ لوحة المجموعة تجمعها خريطة حرارة؛ «العدالة بين الشُّعب».
 *  المنطق هنا صرف قدر الإمكان (بلا قاعدة) ليُختبر وحدةً؛ دوال القاعدة في الأسفل.
 */
import { invalidatePoolCache } from './bank';
/* بلا استيراد من exit.ts تفاديًا لدورة الاستيراد (blueprint → syllabus → exit → blueprint) */
export const UNIT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type ExitLevel = (typeof UNIT_LEVELS)[number];

type Db = any;
export const SYLLABUS_TITLE = { ar: 'خريطة المنهج — وسم وحدات المستوى', en: 'Syllabus Map — level unit tagging' } as const;
export const UNIT_STATUSES = ['draft', 'approved', 'retired'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export const UNIT_STATUS_AR: Record<UnitStatus, string> = { draft: 'مسوَّدة', approved: 'معتمدة', retired: 'موقوفة' };
export const DOMAINS = ['personal', 'public', 'professional', 'educational'] as const;
export const DOMAIN_AR: Record<string, string> = { personal: 'شخصي', public: 'عام', professional: 'مهني', educational: 'تعليمي' };
export const UNIT_WEAK = 50; export const UNIT_OK = 70;   /* أحمر < 50 · كهرماني 50–69 · أخضر ≥ 70 */
export type UnitState = 'weak' | 'watch' | 'ok';
export const UNIT_STATE_AR: Record<UnitState, string> = { weak: 'تحتاج مراجعة', watch: 'تحت المتابعة', ok: 'مُتقَنة' };
export const unitState = (p: number): UnitState => (p < UNIT_WEAK ? 'weak' : p < UNIT_OK ? 'watch' : 'ok');

export type Unit = { code: string; level: ExitLevel; idx: number; title_ar: string; title_en: string; focus_ar: string; domains: string[]; descriptor_codes: string[]; status: UnitStatus; updated_at?: string | null; updated_by?: string | null };
export type UnitSeed = Omit<Unit, 'status' | 'updated_at' | 'updated_by'>;

const U = (level: ExitLevel, idx: number, title_ar: string, title_en: string, focus_ar: string, domains: string[], descriptor_codes: string[]): UnitSeed => ({ code: `${level}-U${String(idx).padStart(2, '0')}`, level, idx, title_ar, title_en, focus_ar, domains, descriptor_codes });
/** البذرة: 8 وحدات لكل مستوى A1–B2 و6 لـ C1 = 38 — كل واصف من الـ60 (A1–C1) يظهر في وحدة واحدة على الأقل */
export const UNIT_SEED: UnitSeed[] = [
  U('A1', 1, 'أنا وعائلتي', 'Me and my family', 'التعريف بالنفس والعائلة: مفردات أساسية، فهم جُمل قصيرة عن النفس مسموعة ومقروءة', ['personal'], ['LU-A1-01', 'LI-A1-01', 'RD-A1-04']),
  U('A1', 2, 'الأسماء: المذكّر والمؤنّث والعدد', 'Nouns: gender and number', 'تمييز المذكّر والمؤنّث والمفرد والجمع في كلمات مألوفة', ['personal'], ['LU-A1-03']),
  U('A1', 3, 'الجملة الاسمية والسؤال', 'Nominal sentence and questions', 'الجملة الاسمية البسيطة وأدوات الاستفهام الأساسية (من، ما، أين، كم)', ['personal', 'educational'], ['LU-A1-04']),
  U('A1', 4, 'أين؟ الأماكن وحروف الجرّ', 'Where? Places and prepositions', 'حروف الجرّ المكانية (في، على، من، إلى) وفهم توجيهات بسيطة', ['public'], ['LU-A1-02', 'LI-A1-03']),
  U('A1', 5, 'لافتات وإشارات', 'Signs and notices', 'فهم اللافتات والإشارات المألوفة في الشارع والمطار', ['public'], ['RD-A1-01']),
  U('A1', 6, 'رسائل قصيرة ومواعيد', 'Short messages and appointments', 'فهم رسالة قصيرة وبسيطة (تحية، موعد)', ['personal'], ['RD-A1-02']),
  U('A1', 7, 'في المطار والفندق', 'At the airport and hotel', 'فهم أسئلة بسيطة في مواقف الخدمة', ['public', 'professional'], ['LI-A1-02']),
  U('A1', 8, 'الأرقام والأوقات والأسعار', 'Numbers, times and prices', 'التقاط الأرقام والأوقات مسموعة، وإيجاد معلومة محدّدة في نصّ قصير مع صور', ['public'], ['LI-A1-04', 'RD-A1-03']),
  U('A2', 1, 'الفعل: مضارع وماضٍ', 'Verbs: present and past', 'تصريف المضارع والماضي مع الضمائر الشائعة', ['personal'], ['LU-A2-01']),
  U('A2', 2, 'أريد أن… يجب أن… يمكن أن…', 'Want to… must… can…', 'الأفعال المساعدة مع المضارع', ['personal', 'public'], ['LU-A2-02']),
  U('A2', 3, 'التسوّق والسفر والصحّة', 'Shopping, travel and health', 'المفردات اليومية ونصوص قصيرة عن مواضيع مألوفة', ['public', 'personal'], ['LU-A2-03', 'RD-A2-01']),
  U('A2', 4, 'ربط الجمل', 'Linking sentences', 'الروابط البسيطة: و، ثم، لأن، لكن', ['personal', 'educational'], ['LU-A2-04']),
  U('A2', 5, 'الحياة اليومية مسموعة', 'Everyday listening', 'عبارات شائعة وحوار بسيط عن مواعيد وأسعار وأماكن', ['public', 'personal'], ['LI-A2-01', 'LI-A2-03']),
  U('A2', 6, 'إعلانات وقوائم وجداول', 'Adverts, menus and timetables', 'الفكرة الرئيسة من إعلان مسموع، ومعلومة محدّدة في إعلان أو قائمة أو جدول', ['public'], ['LI-A2-02', 'RD-A2-02']),
  U('A2', 7, 'رسالة شخصية', 'A personal letter', 'فهم رسالة شخصية بسيطة عن أحداث يومية', ['personal'], ['RD-A2-03']),
  U('A2', 8, 'تعليمات خطوة خطوة', 'Step-by-step instructions', 'متابعة تعليمات قصيرة مسموعة ومقروءة (استعمال جهاز، طريق)', ['public', 'professional'], ['LI-A2-04', 'RD-A2-04']),
  U('B1', 1, 'الشرط والزمن', 'Condition and time clauses', 'روابط الشرط والزمن: إذا، عندما، بعد أن', ['personal', 'professional'], ['LU-B1-01']),
  U('B1', 2, 'الإضافة والنعت والعدد', 'Idafa, adjectives and numbers', 'الإضافة والنعت والعدد بدقّة معقولة', ['educational'], ['LU-B1-02']),
  U('B1', 3, 'مفردات العمل والدراسة والسفر', 'Work, study and travel vocabulary', 'مفردات كافية لمواضيع العمل والدراسة والسفر', ['professional', 'educational'], ['LU-B1-03']),
  U('B1', 4, 'الأفعال المزيدة والمصادر', 'Derived verb forms and masdars', 'الأفعال المزيدة الشائعة والمصادر', ['educational'], ['LU-B1-04']),
  U('B1', 5, 'الفكرة الرئيسة في نصّ وحديث', 'Main ideas in text and talk', 'الأفكار الرئيسة في نصّ واضح وحديث واضح عن موضوع مألوف', ['public', 'educational'], ['RD-B1-01', 'LI-B1-01']),
  U('B1', 6, 'القصّة والتقرير', 'Narrative and report', 'تسلسل الأحداث في قصّة أو تقرير، والأفكار الرئيسة في برنامج إذاعي', ['public'], ['RD-B1-02', 'LI-B1-02']),
  U('B1', 7, 'المشاعر والآراء', 'Feelings and opinions', 'وصف المشاعر في رسالة شخصية، واستخراج رأي واضح من مقال قصير', ['personal', 'public'], ['RD-B1-03', 'RD-B1-04']),
  U('B1', 8, 'محاضرة قصيرة ومكالمة عملية', 'A short lecture and a practical call', 'متابعة محاضرة قصيرة واضحة البنية، وفهم مكالمة هاتفية عملية', ['educational', 'professional'], ['LI-B1-03', 'LI-B1-04']),
  U('B2', 1, 'الاستدراك والتوكيد والتفصيل', 'Contrast, emphasis and elaboration', 'أدوات الاستدراك والتوكيد والتفصيل: بل، إنما، أمّا', ['educational', 'public'], ['LU-B2-01']),
  U('B2', 2, 'الجملة المركّبة والحال والتمييز', 'Complex sentences, hal and tamyiz', 'الجمل المركّبة والحال والتمييز بثقة', ['educational'], ['LU-B2-02']),
  U('B2', 3, 'المتلازمات والتعابير الاصطلاحية', 'Collocations and idioms', 'المتلازمات اللفظية والمعاني الاصطلاحية الشائعة', ['public', 'professional'], ['LU-B2-03']),
  U('B2', 4, 'ضبط الإعراب', 'Case endings in context', 'ضبط الإعراب في البنى الشائعة عند الحاجة', ['educational'], ['LU-B2-04']),
  U('B2', 5, 'قضايا معاصرة ووجهات نظر', 'Contemporary issues and viewpoints', 'مقالات وتقارير عن قضايا معاصرة، ونشرات الأخبار والبرامج الحوارية', ['public'], ['RD-B2-01', 'LI-B2-02']),
  U('B2', 6, 'الفكرة الرئيسة والتفاصيل الداعمة', 'Main idea versus detail', 'تمييز الفكرة الرئيسة من التفاصيل الداعمة', ['educational', 'professional'], ['RD-B2-02']),
  U('B2', 7, 'الموقف والنبرة', 'Stance and tone', 'موقف الكاتب ونبرته، والموقف والنبرة في نقاش بين متحدّثين', ['public', 'professional'], ['RD-B2-03', 'LI-B2-03']),
  U('B2', 8, 'الحجّة الممتدّة والعرض', 'Extended argument and presentation', 'متابعة حجّة ممتدّة مكتوبة أو مسموعة، وفهم عرض أكاديمي أو مهني', ['educational', 'professional'], ['RD-B2-04', 'LI-B2-01', 'LI-B2-04']),
  U('C1', 1, 'مرونة البنى ودقّتها', 'Range and accuracy of structures', 'مدى واسع من البنى بمرونة ودقّة', ['educational', 'professional'], ['LU-C1-01']),
  U('C1', 2, 'الفروق الدلالية الدقيقة', 'Fine semantic distinctions', 'الفروق الدلالية بين المترادفات', ['educational'], ['LU-C1-02']),
  U('C1', 3, 'الأساليب البلاغية', 'Rhetorical devices', 'الأساليب البلاغية الشائعة (القصر، التقديم)', ['educational', 'public'], ['LU-C1-03']),
  U('C1', 4, 'المصطلح الأكاديمي والمهني', 'Academic and professional terminology', 'المصطلحات الأكاديمية والمهنية، والمقالات المتخصّصة، والنقاش المتخصّص', ['educational', 'professional'], ['LU-C1-04', 'RD-C1-02', 'LI-C1-03']),
  U('C1', 5, 'المعاني الضمنية والتلميح', 'Implicit meaning and allusion', 'المعاني الضمنية، والسخرية والتلميح والتحفّظ، في المقروء والمسموع', ['public', 'professional'], ['RD-C1-01', 'RD-C1-03', 'LI-C1-02', 'LI-C1-04']),
  U('C1', 6, 'بنية الحجّة والحديث الممتدّ', 'Argument structure and extended talk', 'تقييم بنية الحجّة وتماسكها، وفهم حديث ممتدّ غير واضح البنية', ['educational', 'public'], ['RD-C1-04', 'LI-C1-01']),
];
export const UNIT_CODE_RE = /^(A1|A2|B1|B2|C1)-U\d{2}$/;
export const isUnitCode = (v: unknown): v is string => typeof v === 'string' && UNIT_CODE_RE.test(v);
export const unitLevelOf = (code: string): ExitLevel | null => { const m = code.match(UNIT_CODE_RE); return m ? (m[1] as ExitLevel) : null; };

/* ---------- فهارس ---------- */
export const unitIndex = (units: readonly Unit[]) => new Map(units.map((u) => [u.code, u]));
export function descriptorUnits(units: readonly Unit[]): Map<string, string[]> { const m = new Map<string, string[]>(); for (const u of units) for (const d of u.descriptor_codes) m.set(d, [...(m.get(d) || []), u.code]); return m; }
export const approvedFor = (units: readonly Unit[], level: ExitLevel) => units.filter((u) => u.level === level && u.status === 'approved').sort((a, b) => a.idx - b.idx);

/* ---------- السحب المتوازن (يُستدعى من drawPlan لكل خلية مستوى×مهارة) ---------- */
export type Taggable = { code: string; unitCodes?: string[] | null };
/** يعيد ترتيب القائمة المخلوطة: أولًا بنود تغطّي وحدة لم تُغطَّ بعد (تُحدَّث المجموعة)، ثم الباقي بترتيبه — العدد المأخوذ يبقى كما هو */
export function balancedOrder<T extends Taggable>(shuffled: readonly T[], uncovered: Set<string>): T[] {
  if (!uncovered.size) return [...shuffled];
  const first: T[] = []; const rest: T[] = [];
  for (const it of shuffled) {
    const hit = (it.unitCodes || []).filter((c) => uncovered.has(c));
    if (hit.length) { first.push(it); for (const c of hit) uncovered.delete(c); } else rest.push(it);
  }
  return [...first, ...rest];
}
/** «ما دُرّس فقط»: البنود الموسومة بإحدى وحدات النطاق؛ إن قلّت عن المطلوب تعود القائمة كاملة ويُعلَم المستدعي */
export function scopeCell<T extends Taggable>(cell: readonly T[], only: readonly string[] | null | undefined, needed: number): { cell: T[]; narrowed: boolean; fallback: boolean } {
  if (!only || !only.length) return { cell: [...cell], narrowed: false, fallback: false };
  const set = new Set(only); const inScope = cell.filter((i) => (i.unitCodes || []).some((c) => set.has(c)));
  if (inScope.length >= needed) return { cell: inScope, narrowed: true, fallback: false };
  return { cell: [...cell], narrowed: false, fallback: true };
}
/** التغطية: كل وحدة معتمدة في المستوى — كم بندًا معتمدًا يخدمها (أي مهارة)؟ */
export type CoverageRow = { code: string; title_ar: string; items: number; by_skill: Record<string, number>; covered: boolean };
export function coverage(units: readonly Unit[], level: ExitLevel, pool: readonly (Taggable & { level: string; skill: string })[]): { rows: CoverageRow[]; uncovered: string[]; tagged: number; untagged: number; total: number } {
  const lvlItems = pool.filter((i) => i.level === level); const rows: CoverageRow[] = [];
  for (const u of approvedFor(units, level)) {
    const hits = lvlItems.filter((i) => (i.unitCodes || []).includes(u.code)); const by_skill: Record<string, number> = {};
    for (const h of hits) by_skill[h.skill] = (by_skill[h.skill] || 0) + 1;
    rows.push({ code: u.code, title_ar: u.title_ar, items: hits.length, by_skill, covered: hits.length > 0 });
  }
  const tagged = lvlItems.filter((i) => (i.unitCodes || []).length > 0).length;
  return { rows, uncovered: rows.filter((r) => !r.covered).map((r) => r.code), tagged, untagged: lvlItems.length - tagged, total: lvlItems.length };
}

/* ---------- التقرير ---------- */
export type UnitTally = Record<string, { n: number; correct: number }>;
/** من بنود الجلسة المصحَّحة: صواب/عدد لكل وحدة (البند متعدّد الوحدات يُحسب لكلٍّ منها) */
export function tallyUnits(items: readonly { unitCodes?: string[] | null; answered: boolean; correct: boolean }[]): UnitTally {
  const t: UnitTally = {};
  for (const it of items) for (const c of it.unitCodes || []) { const r = (t[c] ||= { n: 0, correct: 0 }); r.n += 1; if (it.answered && it.correct) r.correct += 1; }
  return t;
}
export type UnitReportRow = { code: string; title_ar: string; title_en: string; n: number; correct: number; percent: number; state: UnitState; state_ar: string };
/** قائمة الوحدات مرتّبة من الأضعف (مع الاسم) — للمتعلّم والطاقم. الوحدات بلا بنود لا تظهر (لا حكم بلا عيّنة) */
export function unitReport(tally: UnitTally | null | undefined, units: readonly Unit[]): UnitReportRow[] {
  if (!tally) return []; const ix = unitIndex(units); const out: UnitReportRow[] = [];
  for (const [code, r] of Object.entries(tally)) {
    if (!r || !r.n) continue; const u = ix.get(code); if (u && u.status !== 'approved') continue; /* المسوَّدة/الموقوفة لا تظهر في تقرير المتعلّم */ const percent = Math.round((r.correct / r.n) * 100); const st = unitState(percent);
    out.push({ code, title_ar: u?.title_ar || code, title_en: u?.title_en || code, n: r.n, correct: r.correct, percent, state: st, state_ar: UNIT_STATE_AR[st] });
  }
  return out.sort((a, b) => a.percent - b.percent || b.n - a.n || a.code.localeCompare(b.code));
}
/** «وحدات تحتاج مراجعة» للمتعلّم: الأضعف ≤ 3 دون 70% */
export const reviewUnits = (rows: readonly UnitReportRow[], max = 3) => rows.filter((r) => r.state !== 'ok').slice(0, max);

/** خريطة حرارة المجموعة: تجميع تقارير الطلاب (وحدة × نسبة الصواب في الشعبة) مرتّبة من الأضعف */
export type HeatRow = { code: string; title_ar: string; n_items: number; n_students: number; correct: number; percent: number; state: UnitState; state_ar: string };
export function boardHeat(tallies: readonly (UnitTally | null | undefined)[], units: readonly Unit[]): HeatRow[] {
  const ix = unitIndex(units); const acc = new Map<string, { n: number; c: number; s: number }>();
  for (const t of tallies) { if (!t) continue; for (const [code, r] of Object.entries(t)) { if (!r?.n) continue; const u0 = ix.get(code); if (u0 && u0.status !== 'approved') continue; const a = acc.get(code) || { n: 0, c: 0, s: 0 }; a.n += r.n; a.c += r.correct; a.s += 1; acc.set(code, a); } }
  return [...acc.entries()].map(([code, a]) => { const percent = Math.round((a.c / a.n) * 100); const st = unitState(percent); return { code, title_ar: ix.get(code)?.title_ar || code, n_items: a.n, n_students: a.s, correct: a.c, percent, state: st, state_ar: UNIT_STATE_AR[st] }; })
    .sort((a, b) => a.percent - b.percent || a.code.localeCompare(b.code));
}
/** «العدالة بين الشُّعب»: وحدة ضعيفة (< 50%) في شعبتين فأكثر من شُعب المستوى → مشكلة منهج لا مشكلة شعبة */
export function fairness(groups: readonly { key: string; label: string; heat: readonly HeatRow[] }[]): Array<{ code: string; title_ar: string; groups: number; of: number; labels: string[]; avg: number }> {
  const acc = new Map<string, { labels: string[]; sum: number; title: string }>();
  for (const g of groups) for (const h of g.heat) if (h.state === 'weak' && h.n_students >= 3) { const a = acc.get(h.code) || { labels: [], sum: 0, title: h.title_ar }; a.labels.push(g.label); a.sum += h.percent; acc.set(h.code, a); }
  return [...acc.entries()].filter(([, a]) => a.labels.length >= 2).map(([code, a]) => ({ code, title_ar: a.title, groups: a.labels.length, of: groups.length, labels: a.labels, avg: Math.round(a.sum / a.labels.length) })).sort((x, y) => y.groups - x.groups || x.avg - y.avg);
}

/* ---------- الاقتراح (محلي من الواصف · أو Gemini) ---------- */
export type SuggestItem = { id: string; code: string; level: string; skill: string; descriptor_code?: string | null; domain?: string | null; text: string };
export type Suggestion = { item_id: string; unit_code: string; why: string; source: 'descriptor' | 'ai' };
/** الاقتراح المحلي: الواصف → وحدته (دقيق لأن البذرة بُنيت من الواصفات) */
export function suggestLocal(items: readonly SuggestItem[], units: readonly Unit[]): Suggestion[] {
  const du = descriptorUnits(units); const out: Suggestion[] = [];
  for (const it of items) { const codes = it.descriptor_code ? du.get(it.descriptor_code) : null; if (codes?.length) out.push({ item_id: it.id, unit_code: codes[0], why: `الواصف ${it.descriptor_code} ينتمي إلى هذه الوحدة`, source: 'descriptor' }); }
  return out;
}
export const SUGGEST_SYSTEM = 'أنت خبير مناهج لغة عربية للناطقين بغيرها (CEFR). تُسند كلَّ بند اختبار إلى وحدة واحدة من وحدات المستوى المعطاة، بالاعتماد على نصّ البند وواصفه ومجاله. أجب بـ JSON فقط: [{"item_id":"…","unit_code":"…","why":"سبب موجز بالعربية"}]. لا تخترع رموز وحدات غير المعطاة. إن لم تتضح الوحدة فأسقط البند من الإجابة.';
export function suggestPrompt(level: ExitLevel, units: readonly Unit[], items: readonly SuggestItem[]): string {
  const us = units.filter((u) => u.level === level).map((u) => `${u.code} — ${u.title_ar}: ${u.focus_ar}`).join('\n');
  const its = items.map((i) => `${i.id} | ${i.skill} | ${i.descriptor_code || '-'} | ${i.domain || '-'} | ${i.text.slice(0, 160).replace(/\s+/g, ' ')}`).join('\n');
  return `المستوى ${level}\nالوحدات:\n${us}\n\nالبنود (item_id | المهارة | الواصف | المجال | النصّ):\n${its}`;
}
export function parseSuggestions(raw: string, items: readonly SuggestItem[], units: readonly Unit[]): Suggestion[] | null {
  const m = raw.match(/\[[\s\S]*\]/); if (!m) return null;
  let arr: unknown; try { arr = JSON.parse(m[0]); } catch { return null; } if (!Array.isArray(arr)) return null;
  const ids = new Set(items.map((i) => i.id)); const codes = new Set(units.map((u) => u.code)); const seen = new Set<string>(); const out: Suggestion[] = [];
  for (const x of arr as Array<Record<string, unknown>>) {
    const id = String(x?.item_id || ''); const code = String(x?.unit_code || ''); if (!ids.has(id) || !codes.has(code) || seen.has(id)) continue; seen.add(id);
    out.push({ item_id: id, unit_code: code, why: String(x?.why || '').slice(0, 200) || 'اقتراح آلي', source: 'ai' });
  }
  return out;
}

/* ---------- التحقّق ---------- */
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
export function validateUnit(b: Record<string, unknown>): { ok: true; unit: Omit<Unit, 'updated_at' | 'updated_by'> } | { ok: false; error: string } {
  const level = String(b.level || ''); if (!(UNIT_LEVELS as readonly string[]).includes(level)) return { ok: false, error: 'المستوى من A1 إلى C1' };
  const idx = Number(b.idx); if (!Number.isInteger(idx) || idx < 1 || idx > 40) return { ok: false, error: 'رقم الوحدة من 1 إلى 40' };
  const title_ar = clean(b.title_ar, 80); if (title_ar.length < 2) return { ok: false, error: 'عنوان الوحدة بالعربية مطلوب' };
  const title_en = clean(b.title_en, 80); const focus_ar = clean(b.focus_ar, 300);
  const domains = Array.isArray(b.domains) ? [...new Set(b.domains.map(String).filter((d) => (DOMAINS as readonly string[]).includes(d)))] : [];
  const descriptor_codes = Array.isArray(b.descriptor_codes) ? [...new Set(b.descriptor_codes.map((d) => String(d).trim().toUpperCase()).filter((d) => /^(LI|RD|LU)-(A1|A2|B1|B2|C1)-\d{2}$/.test(d)))].slice(0, 12) : [];
  const status = (UNIT_STATUSES as readonly string[]).includes(String(b.status)) ? (b.status as UnitStatus) : 'draft';
  const code = isUnitCode(b.code) && unitLevelOf(b.code as string) === level ? (b.code as string) : `${level}-U${String(idx).padStart(2, '0')}`;
  return { ok: true, unit: { code, level: level as ExitLevel, idx, title_ar, title_en, focus_ar, domains, descriptor_codes, status } };
}
/** معرّف بند: uuid في الإنتاج (يُقبل أي معرّف آمن بلا فواصل/أقواس حتى لا يُكسر مرشّح in.()) */
export const isItemId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z_-]{8,64}$/.test(v);
export function validateTag(b: Record<string, unknown>): { ok: true; item_ids: string[]; unit_codes: string[]; mode: 'add' | 'replace' | 'remove' } | { ok: false; error: string } {
  const ids = Array.isArray(b.item_ids) ? [...new Set(b.item_ids.map(String).filter(isItemId))].slice(0, 200) : [];
  if (!ids.length) return { ok: false, error: 'اختر بندًا واحدًا على الأقل' };
  const codes = Array.isArray(b.unit_codes) ? [...new Set(b.unit_codes.filter(isUnitCode))].slice(0, 4) : [];
  const mode = b.mode === 'replace' ? 'replace' : b.mode === 'remove' ? 'remove' : 'add';
  if (!codes.length && mode !== 'replace') return { ok: false, error: 'اختر وحدة واحدة على الأقل' };
  return { ok: true, item_ids: ids, unit_codes: codes, mode };
}
/** نطاق الدعوة «ما دُرّس فقط»: رموز وحدات من مستوى الدعوة نفسه */
export function validateScope(v: unknown, level: ExitLevel | null): string[] | null {
  if (!Array.isArray(v)) return null; const codes = [...new Set(v.filter(isUnitCode))].filter((c) => !level || unitLevelOf(c) === level).slice(0, 40); return codes.length ? codes : null;
}

/* ---------- قاعدة البيانات (ذاكرة 30 ث) ---------- */
let cache: { at: number; units: Unit[] } | null = null;
export function resetUnitsCache() { cache = null; }
export async function listUnits(db: Db, force = false): Promise<Unit[]> {
  if (!force && cache && Date.now() - cache.at < 30000) return cache.units;
  let units: Unit[] = [];
  try {
    const { data, error } = await db.from('miaar_syllabus_units').select('code, level, idx, title_ar, title_en, focus_ar, domains, descriptor_codes, status, updated_at, updated_by').order('level').order('idx').limit(400);
    if (!error && Array.isArray(data)) units = (data as any[]).filter((u) => isUnitCode(u.code)).map((u) => ({ ...u, domains: Array.isArray(u.domains) ? u.domains : [], descriptor_codes: Array.isArray(u.descriptor_codes) ? u.descriptor_codes : [], status: (UNIT_STATUSES as readonly string[]).includes(u.status) ? u.status : 'draft' }));
  } catch { units = []; /* الجدول غير موجود بعد → بلا وحدات (لا تغيير في السحب ولا في التقارير) */ }
  cache = { at: Date.now(), units }; return units;
}
export async function saveUnit(db: Db, unit: Omit<Unit, 'updated_at' | 'updated_by'>, by: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await db.from('miaar_syllabus_units').upsert({ ...unit, updated_at: new Date().toISOString(), updated_by: by }, { onConflict: 'code' }); if (r.error) return { ok: false, error: r.error.message || 'save_failed' };
  resetUnitsCache(); return { ok: true };
}
export async function setUnitStatus(db: Db, code: string, status: UnitStatus, by: string): Promise<boolean> {
  const r = await db.from('miaar_syllabus_units').update({ status, updated_at: new Date().toISOString(), updated_by: by }).eq('code', code); resetUnitsCache(); return !r.error;
}
/** وسم بنود: add يضيف · replace يستبدل · remove يحذف — يعيد عدد البنود المعدَّلة */
export async function tagItems(db: Db, item_ids: string[], unit_codes: string[], mode: 'add' | 'replace' | 'remove'): Promise<number> {
  const { data } = await db.from('question_bank_items').select('id, unit_codes').in('id', item_ids); let n = 0;
  for (const row of Array.isArray(data) ? data : []) {
    const cur: string[] = Array.isArray(row.unit_codes) ? row.unit_codes.filter(isUnitCode) : [];
    const next = mode === 'replace' ? unit_codes : mode === 'remove' ? cur.filter((c) => !unit_codes.includes(c)) : [...new Set([...cur, ...unit_codes])];
    if (next.join(',') === cur.join(',')) continue;
    const r = await db.from('question_bank_items').update({ unit_codes: next.length ? next : null }).eq('id', row.id); if (!r.error) n += 1;
  }
  if (n) invalidatePoolCache(); /* «سرعة مِعيار»: الوسم جزء من البنك المعتمد — يُفرغ ذاكرة البنك فورًا */
  return n;
}
