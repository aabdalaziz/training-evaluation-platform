/**
 * توليد أداة قياس الأثر بالذكاء الاصطناعي (أو محليًا بلا مفتاح) وفق أهداف ومحاور البرنامج.
 * مشترك بين المسار /api/impact/generate وواجهة البناء.
 */
import type { DraftQuestion } from './import';

export type GenerateSpec = {
  program_name: string; program_desc?: string; objectives: string; axes: string[];
  scale_per_axis: number; mcq_per_axis: number; tf_per_axis: number;
  audience?: string; level?: 'basic' | 'intermediate' | 'advanced'; bilingual?: boolean; notes?: string;
};

export const GEN_LIMITS = { maxAxes: 10, maxPerAxis: 8, maxTotal: 60 };

export function normalizeSpec(raw: any): GenerateSpec {
  const n = (v: any, d: number) => Math.max(0, Math.min(GEN_LIMITS.maxPerAxis, Number.isFinite(Number(v)) ? Math.round(Number(v)) : d));
  const axes = (Array.isArray(raw?.axes) ? raw.axes : String(raw?.axes || '').split(/\r?\n|،|,|;/)).map((x: any) => String(x).trim()).filter(Boolean).slice(0, GEN_LIMITS.maxAxes);
  return {
    program_name: String(raw?.program_name || '').trim().slice(0, 200), program_desc: String(raw?.program_desc || '').trim().slice(0, 2000),
    objectives: String(raw?.objectives || '').trim().slice(0, 4000), axes: axes.length ? axes : ['المعرفة', 'المهارة', 'التطبيق'],
    scale_per_axis: n(raw?.scale_per_axis, 2), mcq_per_axis: n(raw?.mcq_per_axis, 1), tf_per_axis: n(raw?.tf_per_axis, 0),
    audience: String(raw?.audience || '').trim().slice(0, 200), level: ['basic', 'intermediate', 'advanced'].includes(raw?.level) ? raw.level : 'intermediate',
    bilingual: !!raw?.bilingual, notes: String(raw?.notes || '').trim().slice(0, 1000),
  };
}

export function buildPrompt(s: GenerateSpec): { system: string; user: string } {
  const system = `أنت خبير قياس وتقويم تربوي متخصص في قياس أثر التدريب (نموذج كيركباتريك — المستوى الثاني: التعلّم) وبناء أدوات قبلية/بعدية. تكتب بالعربية الفصحى الواضحة. تلتزم بمعايير جودة البنود: بند واحد يقيس فكرة واحدة، صياغة إيجابية مباشرة، تجنّب النفي المزدوج والمصطلحات الغامضة، بدائل متجانسة الطول ومعقولة (مشتّتات قوية) دون «كل ما سبق»، إجابة صحيحة واحدة لا لبس فيها، ومستوى صعوبة مناسب للفئة. تُخرج JSON فقط دون أي نص آخر.`;
  const schema = `{"questions":[{"domain_ar":"اسم المحور","kind":"scale|mcq","text_ar":"نص البند","text_en":"English text or null","options":[{"k":"a","ar":"...","en":null},{"k":"b","ar":"..."},{"k":"c","ar":"..."},{"k":"d","ar":"..."}],"correct_key":"a|b|c|d|null","bloom":"تذكر|فهم|تطبيق|تحليل"}]}`;
  const user = [
    `البرنامج التدريبي: ${s.program_name || 'غير محدد'}`,
    s.program_desc ? `وصف البرنامج: ${s.program_desc}` : '',
    s.audience ? `الفئة المستهدفة: ${s.audience}` : '',
    `المستوى: ${s.level === 'basic' ? 'أساسي' : s.level === 'advanced' ? 'متقدم' : 'متوسط'}`,
    `الأهداف/المخرجات:\n${s.objectives || '(استنتجها من اسم البرنامج والمحاور)'}`,
    `المحاور: ${s.axes.join(' | ')}`,
    `المطلوب لكل محور: ${s.scale_per_axis} بند تقدير ذاتي (kind=scale، تبدأ بـ "أستطيع/أعرف/أطبّق…" على مقياس 1–5، بلا بدائل، correct_key=null) + ${s.mcq_per_axis} سؤال معرفي (kind=mcq، 4 بدائل a–d بالضبط، بديل صحيح واحد) + ${s.tf_per_axis} سؤال صح/خطأ (kind=mcq، بديلان فقط: a="صحيح" b="خطأ").`,
    s.bilingual ? 'أضف ترجمة إنجليزية دقيقة في text_en ولكل بديل في en.' : 'اجعل text_en = null.',
    s.notes ? `ملاحظات إضافية: ${s.notes}` : '',
    `الأسئلة المعرفية يجب أن تُقاس بنفس الصياغة قبل وبعد التدريب، وأن تغطي مستويات بلوم المختلفة (تذكر، فهم، تطبيق، تحليل) وتستند إلى محتوى المحور لا إلى معلومات عامة.`,
    `أخرج JSON فقط بهذا الشكل:\n${schema}`,
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/** تنظيف مخرجات النموذج (قد تأتي داخل \`\`\`json) وتحويلها إلى بنود صالحة */
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

/* ----------------------------------------------------------------------------
 * مولّد محلي (بلا مفتاح API): بنود تقدير ذاتي عالية الجودة من المحاور والأهداف
 * ------------------------------------------------------------------------- */
const STEMS = [
  (ax: string) => `أعرف المفاهيم الأساسية في ${ax}`,
  (ax: string) => `أستطيع شرح ${ax} لزميل بوضوح`,
  (ax: string) => `أستطيع تطبيق ما تعلمته في ${ax} في عملي`,
  (ax: string) => `أستطيع أداء المهام المرتبطة بـ${ax} دون مساعدة`,
  (ax: string) => `أستطيع حل المشكلات الشائعة في ${ax}`,
  (ax: string) => `أشعر بالثقة عند التعامل مع ${ax}`,
  (ax: string) => `أستطيع تقييم جودة عملي في ${ax} وتحسينه`,
  (ax: string) => `أستطيع تدريب الآخرين على أساسيات ${ax}`,
];
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
export function offlineGenerate(s: GenerateSpec): { questions: DraftQuestion[]; warnings: string[] } {
  const out: DraftQuestion[] = [];
  const objs = s.objectives.split(/\r?\n|؛|;/).map(x => x.replace(/^[\-•\d.)\s]+/, '').trim()).filter(x => x.length > 6);
  for (const ax of s.axes) {
    for (let i = 0; i < s.scale_per_axis; i++) out.push({ order_no: out.length + 1, kind: 'scale', domain_ar: ax, text_ar: STEMS[i % STEMS.length](ax), text_en: null, options: [], correct_key: null, weight: 1 });
  }
  // بنود من الأهداف مباشرة: "أن يتمكن المتدرب من …" → "أستطيع …"
  for (const o of objs.slice(0, 8)) {
    const t = objectiveToItem(o);
    if (t) out.push({ order_no: out.length + 1, kind: 'scale', domain_ar: 'أهداف البرنامج', text_ar: t, text_en: null, options: [], correct_key: null, weight: 1 });
  }
  const warnings = ['وضع التوليد المحلي (بلا مفتاح ذكاء اصطناعي): أُنتجت بنود تقدير ذاتي فقط. لتوليد أسئلة معرفية باختيار من متعدد أضف المتغير AI_API_KEY في Vercel.'];
  return { questions: out.slice(0, GEN_LIMITS.maxTotal), warnings };
}
