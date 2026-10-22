/**
 * توليد أداة قياس الأثر بالذكاء الاصطناعي (أو محليًا بلا مفتاح) وفق أهداف ومحاور البرنامج.
 * مشترك بين المسار /api/impact/generate وواجهة البناء.
 *
 * الإصدار 2:
 *  - عدد مفتوح: لكل محور أو إجمالي للأداة (يوزَّع تلقائيًا على المحاور) حتى 200 بند.
 *  - تنويع الصياغة ومستويات بلوم ونمط الأسئلة المعرفية (مفاهيمية / مواقف تطبيقية / مزيج).
 *  - خطة توليد (plan) تُقسَّم إلى دفعات صغيرة للنموذج، وتُزال البنود المكررة.
 */
import type { DraftQuestion } from './import';

export type CountMode = 'per_axis' | 'total';
export type McqStyle = 'mixed' | 'concept' | 'scenario';
export type GenerateSpec = {
  program_name: string; program_desc?: string; objectives: string; axes: string[];
  count_mode: CountMode;
  /** في وضع per_axis: العدد لكل محور — في وضع total: العدد الإجمالي للأداة */
  scale_count: number; mcq_count: number; tf_count: number;
  audience?: string; level?: 'basic' | 'intermediate' | 'advanced'; bilingual?: boolean; notes?: string;
  variety?: boolean; mcq_style?: McqStyle;
};
export type AxisPlan = { axis: string; scale: number; mcq: number; tf: number };

export const GEN_LIMITS = { maxAxes: 15, maxPerAxis: 40, maxTotal: 200, batchItems: 18 };

export function normalizeSpec(raw: any): GenerateSpec {
  const count_mode: CountMode = raw?.count_mode === 'total' ? 'total' : 'per_axis';
  const cap = count_mode === 'total' ? GEN_LIMITS.maxTotal : GEN_LIMITS.maxPerAxis;
  const n = (v: any, d: number) => Math.max(0, Math.min(cap, Number.isFinite(Number(v)) ? Math.round(Number(v)) : d));
  const axes = (Array.isArray(raw?.axes) ? raw.axes : String(raw?.axes || '').split(/\r?\n|،|,|;/)).map((x: any) => String(x).trim()).filter(Boolean).slice(0, GEN_LIMITS.maxAxes);
  // توافق مع الإصدار الأول (scale_per_axis…)
  const sc = raw?.scale_count ?? raw?.scale_per_axis, mc = raw?.mcq_count ?? raw?.mcq_per_axis, tf = raw?.tf_count ?? raw?.tf_per_axis;
  return {
    program_name: String(raw?.program_name || '').trim().slice(0, 200), program_desc: String(raw?.program_desc || '').trim().slice(0, 2000),
    objectives: String(raw?.objectives || '').trim().slice(0, 6000), axes: axes.length ? axes : ['المعرفة', 'المهارة', 'التطبيق'],
    count_mode, scale_count: n(sc, 2), mcq_count: n(mc, 1), tf_count: n(tf, 0),
    audience: String(raw?.audience || '').trim().slice(0, 200), level: ['basic', 'intermediate', 'advanced'].includes(raw?.level) ? raw.level : 'intermediate',
    bilingual: !!raw?.bilingual, notes: String(raw?.notes || '').trim().slice(0, 1000),
    variety: raw?.variety === undefined ? true : !!raw.variety, mcq_style: ['mixed', 'concept', 'scenario'].includes(raw?.mcq_style) ? raw.mcq_style : 'mixed',
  };
}

/** توزيع عدد إجمالي على المحاور بالتساوي (الباقي يذهب للمحاور الأولى) */
export function distribute(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts), rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

/** خطة التوليد: كم بندًا من كل نوع لكل محور، مع احترام الحد الأقصى الكلي */
export function buildPlan(s: GenerateSpec): AxisPlan[] {
  const k = s.axes.length;
  let plan: AxisPlan[];
  if (s.count_mode === 'total') {
    const a = distribute(s.scale_count, k), b = distribute(s.mcq_count, k), c = distribute(s.tf_count, k);
    plan = s.axes.map((axis, i) => ({ axis, scale: a[i], mcq: b[i], tf: c[i] }));
  } else plan = s.axes.map(axis => ({ axis, scale: s.scale_count, mcq: s.mcq_count, tf: s.tf_count }));
  // قصّ إلى الحد الأقصى الكلي مع الحفاظ على التوازن
  let total = planTotal(plan);
  while (total > GEN_LIMITS.maxTotal) {
    const kinds: (keyof Omit<AxisPlan, 'axis'>)[] = ['tf', 'scale', 'mcq'];
    let cut = false;
    for (const kind of kinds) { for (let i = plan.length - 1; i >= 0 && total > GEN_LIMITS.maxTotal; i--) { if (plan[i][kind] > 0) { plan[i][kind]--; total--; cut = true; } } }
    if (!cut) break;
  }
  return plan;
}
export const planTotal = (plan: AxisPlan[]) => plan.reduce((s, p) => s + p.scale + p.mcq + p.tf, 0);

/** تقسيم الخطة إلى دفعات صغيرة يستوعبها النموذج (≈18 بندًا للدفعة) */
export function splitBatches(plan: AxisPlan[], size = GEN_LIMITS.batchItems): AxisPlan[][] {
  const units: AxisPlan[] = [];
  for (const p of plan) {
    // محور كبير يُقسَّم إلى أجزاء
    let { scale, mcq, tf } = p;
    while (scale + mcq + tf > 0) {
      let room = size; const u: AxisPlan = { axis: p.axis, scale: 0, mcq: 0, tf: 0 };
      const take = (kind: 'scale' | 'mcq' | 'tf', avail: number) => { const t = Math.min(avail, room); u[kind] += t; room -= t; return avail - t; };
      mcq = take('mcq', mcq); scale = take('scale', scale); tf = take('tf', tf);
      units.push(u);
    }
  }
  const batches: AxisPlan[][] = []; let cur: AxisPlan[] = []; let n = 0;
  for (const u of units) {
    const c = u.scale + u.mcq + u.tf;
    if (cur.length && n + c > size) { batches.push(cur); cur = []; n = 0; }
    cur.push(u); n += c;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

const LEVEL_AR = (l?: string) => l === 'basic' ? 'أساسي' : l === 'advanced' ? 'متقدم' : 'متوسط';

export function buildPrompt(s: GenerateSpec, batch?: AxisPlan[], batchIndex = 0, batchCount = 1): { system: string; user: string } {
  const plan = batch || buildPlan(s);
  const system = `أنت خبير قياس وتقويم تربوي متخصص في قياس أثر التدريب (نموذج كيركباتريك — المستوى الثاني: التعلّم) وبناء أدوات قبلية/بعدية. تكتب بالعربية الفصحى الواضحة. تلتزم بمعايير جودة البنود: بند واحد يقيس فكرة واحدة، صياغة إيجابية مباشرة، تجنّب النفي المزدوج والمصطلحات الغامضة، بدائل متجانسة الطول ومعقولة (مشتّتات قوية مبنية على أخطاء شائعة) دون «كل ما سبق» أو «لا شيء مما سبق»، إجابة صحيحة واحدة لا لبس فيها، موقع الإجابة الصحيحة موزّع عشوائيًا بين a وd، ومستوى صعوبة مناسب للفئة. تُخرج JSON فقط دون أي نص آخر.`;
  const schema = `{"questions":[{"domain_ar":"اسم المحور","kind":"scale|mcq","text_ar":"نص البند","text_en":"English text or null","options":[{"k":"a","ar":"...","en":null},{"k":"b","ar":"..."},{"k":"c","ar":"..."},{"k":"d","ar":"..."}],"correct_key":"a|b|c|d|null","bloom":"تذكر|فهم|تطبيق|تحليل|تقويم"}]}`;
  const planLines = plan.map(p => `- «${p.axis}»: ${p.scale} بند تقدير ذاتي (scale) + ${p.mcq} سؤال اختيار من متعدد (mcq، 4 بدائل) + ${p.tf} سؤال صح/خطأ (mcq ببديلين: a="صحيح" b="خطأ")`).join('\n');
  const total = planTotal(plan);
  const styleLine = s.mcq_style === 'scenario'
    ? 'نمط الأسئلة المعرفية: مواقف تطبيقية قصيرة (سيناريو من بيئة العمل في 1–3 أسطر ثم سؤال: ما التصرف/القرار/التفسير الأنسب؟).'
    : s.mcq_style === 'concept'
      ? 'نمط الأسئلة المعرفية: مفاهيمية مباشرة (تعريف، خاصية، تمييز بين مفهومين، سبب/نتيجة، خطوة صحيحة في إجراء).'
      : 'نمط الأسئلة المعرفية: مزيج — نصفها تقريبًا مفاهيمي مباشر ونصفها مواقف تطبيقية قصيرة من بيئة العمل.';
  const varietyLines = s.variety ? [
    'التنويع إلزامي:',
    '• لا يبدأ بندان في المحور نفسه بالكلمات الثلاث الأولى نفسها، ولا تُكرَّر فكرة البند.',
    '• بنود التقدير الذاتي: نوّع بين الأفعال (أستطيع، أعرف، أميّز، أطبّق، أحلّل، أقيّم، أصمّم، أوظّف، أختار، أفسّر، أتعامل مع…) وبين مستويات بلوم (تذكر/فهم → تطبيق → تحليل/تقويم) وبين المعرفة والمهارة والاتجاه (الثقة/الاستعداد للممارسة).',
    '• الأسئلة المعرفية: وزّعها على مستويات بلوم بنسبة تقريبية (تذكر 20٪، فهم 30٪، تطبيق 30٪، تحليل/تقويم 20٪)، ونوّع صيغ السؤال (ما…؟ / أيّ…؟ / لماذا…؟ / ما الخطوة التالية…؟ / ما الفرق بين…؟ / أيّ الخيارات يُعدّ خطأً شائعًا…؟ / أكمل: …).',
    '• نوّع طول البدائل وشكلها (مفاهيم، إجراءات، أمثلة، أرقام عند الحاجة) مع بقائها متجانسة داخل السؤال الواحد.',
  ].join('\n') : 'اجعل الصياغة متسقة وواضحة.';
  const user = [
    `البرنامج التدريبي: ${s.program_name || 'غير محدد'}`,
    s.program_desc ? `وصف البرنامج: ${s.program_desc}` : '',
    s.audience ? `الفئة المستهدفة: ${s.audience}` : '',
    `المستوى: ${LEVEL_AR(s.level)}`,
    `الأهداف/المخرجات:\n${s.objectives || '(استنتجها من اسم البرنامج والمحاور)'}`,
    `المحاور في هذه الدفعة والعدد المطلوب بدقة لكل محور (الإجمالي ${total} بندًا):\n${planLines}`,
    batchCount > 1 ? `هذه الدفعة رقم ${batchIndex + 1} من ${batchCount} لأداة واحدة؛ ركّز على جوانب فرعية مختلفة من المحور (مثلًا الدفعة ${batchIndex + 1} تغطي المفاهيم/الإجراءات/المواقف اللاحقة في تسلسل المحتوى) لتفادي التكرار مع الدفعات الأخرى.` : '',
    'بنود التقدير الذاتي (kind=scale): عبارة بصيغة المتكلم تُقاس على مقياس 1–5، بلا بدائل، correct_key=null. الأسئلة المعرفية (kind=mcq): أربعة بدائل a–d بالضبط وبديل صحيح واحد. أسئلة صح/خطأ: kind=mcq ببديلين فقط a="صحيح" b="خطأ" مع correct_key.',
    styleLine,
    varietyLines,
    s.bilingual ? 'أضف ترجمة إنجليزية دقيقة في text_en ولكل بديل في en.' : 'اجعل text_en = null.',
    s.notes ? `ملاحظات إضافية من المصمم (لها الأولوية): ${s.notes}` : '',
    'الأسئلة المعرفية يجب أن تصلح للتطبيق بالصياغة نفسها قبل التدريب وبعده، وأن تستند إلى محتوى المحور والأهداف لا إلى معلومات عامة، وألّا تحتوي على تلميحات تكشف الإجابة.',
    `أخرج JSON فقط بهذا الشكل (استخدم domain_ar مطابقًا لاسم المحور حرفيًا):\n${schema}`,
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/** تنظيف مخرجات النموذج (قد تأتي داخل ```json) وتحويلها إلى بنود صالحة */
export function parseModelOutput(text: string): { questions: DraftQuestion[]; warnings: string[] } {
  const warnings: string[] = [];
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return { questions: [], warnings: ['لم يُرجع النموذج JSON صالحًا.'] };
  let obj: any;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return { questions: [], warnings: ['تعذر قراءة JSON من استجابة النموذج.'] }; }
  const arr: any[] = Array.isArray(obj?.questions) ? obj.questions : Array.isArray(obj) ? obj : [];
  const out: DraftQuestion[] = [];
  for (const q of arr) {
    const text_ar = String(q?.text_ar || q?.text || '').trim(); if (!text_ar) continue;
    const kind: 'scale' | 'mcq' = String(q?.kind || '').toLowerCase() === 'mcq' ? 'mcq' : 'scale';
    const options = kind === 'mcq' ? (Array.isArray(q?.options) ? q.options : []).map((o: any, i: number) => ({ k: 'abcde'[i], ar: String(o?.ar ?? o?.text ?? o ?? '').trim(), en: o?.en ? String(o.en).trim() : undefined })).filter((o: any) => o.ar).slice(0, 5) : [];
    let correct_key: string | null = null;
    if (kind === 'mcq') {
      const ck = String(q?.correct_key || q?.answer || '').trim().toLowerCase();
      const byKey = options.find((o: any) => o.k === ck); const byIdx = /^\d$/.test(ck) ? options[Number(ck) - 1] : null;
      const byText = options.find((o: any) => o.ar === String(q?.correct_text || '').trim());
      correct_key = (byKey || byIdx || byText)?.k || null;
      if (options.length < 2) { warnings.push(`«${text_ar.slice(0, 40)}…»: بدائل غير كافية — حُوِّل إلى مقياس.`); out.push({ order_no: out.length + 1, kind: 'scale', domain_ar: String(q?.domain_ar || 'عام'), text_ar, text_en: q?.text_en || null, options: [], correct_key: null, weight: 1 }); continue; }
      if (!correct_key) warnings.push(`«${text_ar.slice(0, 40)}…»: لم تُحدَّد الإجابة الصحيحة — حدّدها يدويًا.`);
    }
    out.push({ order_no: out.length + 1, kind, domain_ar: String(q?.domain_ar || q?.domain || 'عام').trim() || 'عام', text_ar, text_en: q?.text_en ? String(q.text_en).trim() : null, options, correct_key, weight: 1 });
    if (out.length >= GEN_LIMITS.maxTotal) break;
  }
  if (!out.length) warnings.push('لم يُنتج النموذج أي بند صالح.');
  return { questions: out, warnings };
}

/** إزالة البنود المكررة (نصًا) وإعادة الترقيم — تُستخدم بعد دمج الدفعات */
export function dedupeQuestions(qs: DraftQuestion[]): { questions: DraftQuestion[]; removed: number } {
  const seen = new Set<string>(); const out: DraftQuestion[] = [];
  const norm = (t: string) => t.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  for (const q of qs) { const k = norm(q.text_ar); if (!k || seen.has(k)) continue; seen.add(k); out.push({ ...q, order_no: out.length + 1 }); }
  return { questions: out, removed: qs.length - out.length };
}

/** ترتيب البنود حسب المحور كما وردت في الخطة ثم المقياس قبل المعرفي */
export function orderByPlan(qs: DraftQuestion[], axes: string[]): DraftQuestion[] {
  const idx = new Map(axes.map((a, i) => [a, i]));
  return [...qs].sort((a, b) => (idx.get(a.domain_ar) ?? 999) - (idx.get(b.domain_ar) ?? 999) || (a.kind === b.kind ? 0 : a.kind === 'scale' ? -1 : 1)).map((q, i) => ({ ...q, order_no: i + 1 }));
}

/* ----------------------------------------------------------------------------
 * مولّد محلي (بلا مفتاح API): بنود تقدير ذاتي متنوعة من المحاور والأهداف
 * ------------------------------------------------------------------------- */
type Stem = { b: 'تذكر' | 'فهم' | 'تطبيق' | 'تحليل' | 'تقويم' | 'اتجاه'; f: (ax: string) => string };
const STEMS: Stem[] = [
  { b: 'تذكر', f: ax => `أعرف المفاهيم الأساسية في ${ax}` },
  { b: 'تذكر', f: ax => `أستطيع تعداد العناصر الرئيسة لـ${ax}` },
  { b: 'تذكر', f: ax => `أتذكّر الخطوات المتبعة في ${ax} بترتيبها الصحيح` },
  { b: 'تذكر', f: ax => `أعرف المصطلحات المتداولة في مجال ${ax}` },
  { b: 'فهم', f: ax => `أستطيع شرح ${ax} لزميل بوضوح` },
  { b: 'فهم', f: ax => `أميّز بين المفاهيم المتقاربة في ${ax}` },
  { b: 'فهم', f: ax => `أفسّر أهمية ${ax} في تحسين نتائج العمل` },
  { b: 'فهم', f: ax => `أستطيع تلخيص الأفكار الرئيسة في ${ax} بكلماتي` },
  { b: 'فهم', f: ax => `أدرك العلاقة بين ${ax} ومهامي اليومية` },
  { b: 'تطبيق', f: ax => `أستطيع تطبيق ما تعلمته في ${ax} في عملي` },
  { b: 'تطبيق', f: ax => `أستطيع أداء المهام المرتبطة بـ${ax} دون مساعدة` },
  { b: 'تطبيق', f: ax => `أوظّف أدوات ${ax} في مواقف عمل حقيقية` },
  { b: 'تطبيق', f: ax => `أختار الأسلوب المناسب من ${ax} وفق طبيعة الموقف` },
  { b: 'تطبيق', f: ax => `أستطيع إعداد خطة عملية لتطبيق ${ax} في بيئة عملي` },
  { b: 'تطبيق', f: ax => `أستطيع حل المشكلات الشائعة في ${ax}` },
  { b: 'تحليل', f: ax => `أحلّل المواقف المرتبطة بـ${ax} وأحدّد أسباب القصور فيها` },
  { b: 'تحليل', f: ax => `أستطيع تحديد الأخطاء الشائعة في ${ax} وتجنّبها` },
  { b: 'تحليل', f: ax => `أقارن بين بدائل متعددة في ${ax} وأرجّح الأنسب منها` },
  { b: 'تحليل', f: ax => `أستنتج أثر ${ax} على جودة المخرجات` },
  { b: 'تقويم', f: ax => `أستطيع تقييم جودة عملي في ${ax} وتحسينه` },
  { b: 'تقويم', f: ax => `أحكم على مدى ملاءمة ممارسات ${ax} باستخدام معايير واضحة` },
  { b: 'تقويم', f: ax => `أقدّم تغذية راجعة بنّاءة لزملائي حول ${ax}` },
  { b: 'تقويم', f: ax => `أستطيع تطوير ممارسة جديدة أو تحسين إجراء قائم في ${ax}` },
  { b: 'اتجاه', f: ax => `أشعر بالثقة عند التعامل مع ${ax}` },
  { b: 'اتجاه', f: ax => `أستطيع تدريب الآخرين على أساسيات ${ax}` },
  { b: 'اتجاه', f: ax => `أحرص على تطبيق ${ax} بانتظام في عملي` },
  { b: 'اتجاه', f: ax => `أتابع المستجدات في ${ax} لتطوير أدائي` },
  { b: 'اتجاه', f: ax => `أستطيع إقناع زملائي بجدوى ${ax}` },
];
const BLOOM_ORDER: Stem['b'][] = ['تذكر', 'فهم', 'تطبيق', 'تحليل', 'تقويم', 'اتجاه'];

/** يختار n صيغة متنوّعة لمحور ما: يمرّ على مستويات بلوم بالتناوب ويزيح البداية حسب رقم المحور حتى لا تتكرر الصياغة بين المحاور */
export function pickStems(n: number, axisIndex: number): Stem[] {
  const byLevel = BLOOM_ORDER.map(b => STEMS.filter(s => s.b === b));
  const out: Stem[] = []; const used = new Set<Stem>();
  let round = 0;
  while (out.length < n && round < 20) {
    for (let li = 0; li < byLevel.length && out.length < n; li++) {
      const level = byLevel[(li + axisIndex) % byLevel.length];
      const s = level[(round + axisIndex) % level.length];
      if (!used.has(s)) { used.add(s); out.push(s); }
      else { const alt = level.find(x => !used.has(x)); if (alt) { used.add(alt); out.push(alt); } }
    }
    round++;
  }
  // عند طلب أكثر من حجم البنك تُشتق صيغ إضافية بلاحقة سياقية مميزة
  const SUFFIX = ['في المواقف الجديدة غير المألوفة', 'تحت ضغط الوقت', 'بشكل مستقل ودون إشراف', 'بالتعاون مع فريق العمل', 'مع فئات مختلفة من المستفيدين', 'وفق المعايير المعتمدة في جهتي'];
  let k = 0;
  while (out.length < n) { const base = STEMS[k % STEMS.length]; const suf = SUFFIX[Math.floor(k / STEMS.length) % SUFFIX.length]; out.push({ b: base.b, f: ax => `${base.f(ax)} ${suf}` }); k++; }
  return out;
}

/** "أن يتمكن المتدرب من إعداد خطة" → "أستطيع إعداد خطة" ؛ "أن يميز المتدرب بين…" → "أستطيع أن أميز بين…" */
export function objectiveToItem(o: string): string {
  let t = o.replace(/[.؛;]$/, '').trim();
  const who = '(?:\\s+(?:المتدرب|المتدربة|المشارك|المشاركة|الطالب|الطالبة|المتعلم))?';
  const m1 = t.match(new RegExp(`^أن\\s+(?:يتمكن|تتمكن|يستطيع|تستطيع|يكون قادرًا|يكون قادرا|تكون قادرة)${who}\\s+(?:من|على)\\s+(.+)$`, 'u'));
  if (m1) return `أستطيع ${m1[1].trim()}`;
  const m2 = t.match(new RegExp(`^أن\\s+[يت](\\S+)${who}\\s*(.*)$`, 'u'));
  if (m2) return `أستطيع أن أ${m2[1]}${m2[2] ? ' ' + m2[2].trim() : ''}`;
  if (/^(إكساب|تزويد|تمكين|تعريف)\s/.test(t)) return '';
  return t.length > 8 ? `أستطيع ${t.replace(/^(أستطيع|أعرف)\s+/, '')}` : '';
}

/** يربط الهدف بأقرب محور (تشابه كلمات) وإلا «أهداف البرنامج» */
function nearestAxis(obj: string, axes: string[]): string {
  const words = (t: string) => new Set(t.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2).map(w => w.replace(/^(ال|و|ب|ل|ف)/, '')));
  const ow = words(obj); let best = ''; let score = 0;
  for (const ax of axes) { let s = 0; for (const w of words(ax)) if (ow.has(w)) s++; if (s > score) { score = s; best = ax; } }
  return best || 'أهداف البرنامج';
}

export function offlineGenerate(s: GenerateSpec): { questions: DraftQuestion[]; warnings: string[] } {
  const out: DraftQuestion[] = [];
  const plan = buildPlan(s);
  const objs = s.objectives.split(/\r?\n|؛|;/).map(x => x.replace(/^[\-•\d.)\s]+/, '').trim()).filter(x => x.length > 6);
  plan.forEach((p, ai) => {
    for (const st of pickStems(p.scale, ai)) out.push({ order_no: out.length + 1, kind: 'scale', domain_ar: p.axis, text_ar: st.f(p.axis), text_en: null, options: [], correct_key: null, weight: 1 });
  });
  // بنود من الأهداف مباشرة: "أن يتمكن المتدرب من …" → "أستطيع …" (تُنسب لأقرب محور)
  for (const o of objs.slice(0, 20)) {
    const t = objectiveToItem(o);
    if (t) out.push({ order_no: out.length + 1, kind: 'scale', domain_ar: nearestAxis(o, s.axes), text_ar: t, text_en: null, options: [], correct_key: null, weight: 1 });
  }
  const wanted = plan.reduce((a, p) => a + p.mcq + p.tf, 0);
  const warnings = [wanted > 0
    ? `وضع التوليد المحلي (بلا مفتاح ذكاء اصطناعي صالح): أُنتجت بنود تقدير ذاتي متنوعة فقط، ولم تُولَّد ${wanted} سؤالًا معرفيًا. أضف المتغير AI_API_KEY (مفتاح Gemini صالح) في Vercel ثم أعد النشر.`
    : 'وضع التوليد المحلي (بلا مفتاح ذكاء اصطناعي): بنود تقدير ذاتي من المحاور والأهداف.'];
  const dd = dedupeQuestions(out);
  return { questions: orderByPlan(dd.questions, [...s.axes, 'أهداف البرنامج']).slice(0, GEN_LIMITS.maxTotal), warnings };
}
