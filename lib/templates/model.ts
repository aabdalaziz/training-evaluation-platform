// نموذج إدارة قوالب التقييم والأسئلة — دوال نقية قابلة للاختبار (بلا React / بلا Supabase)

export type TemplateKind = 'DAILY' | 'FINAL';

export type Template = {
  id: string;
  kind: string;
  name_ar: string | null;
  name_en?: string | null;
  created_at?: string | null;
};

export type Question = {
  id: string;
  template_id: string;
  kind: string;
  text_ar: string;
  text_en: string | null;
  section_ar: string | null;
  section_en: string | null;
  is_required: boolean;
  options: string[];
  max_value: number | null;
  order_index: number;
  question_key?: string | null;
};

export type TemplateLink = { program_id: string; template_id: string; is_active: boolean };
export type ProgramLite = { id: string; name_ar: string; status?: string | null };

export type QuestionDraft = {
  kind: string;
  text_ar: string;
  text_en: string;
  section_ar: string;
  section_en: string;
  is_required: boolean;
  optionsText: string;
  max_value: number;
};

export const TEMPLATE_KINDS: { id: TemplateKind; label: string; short: string }[] = [
  { id: 'DAILY', label: 'تقييم يومي (لكل جلسة)', short: 'يومي' },
  { id: 'FINAL', label: 'تقييم ختامي (نهاية البرنامج)', short: 'ختامي' },
];

export const QUESTION_KINDS: { id: string; label: string; hasOptions: boolean; isScale: boolean; hint: string }[] = [
  { id: 'RATING_5', label: 'مقياس رقمي', hasOptions: false, isScale: true, hint: 'أزرار من 1 إلى الحد الأعلى (افتراضي 5)' },
  { id: 'STARS', label: 'نجوم', hasOptions: false, isScale: true, hint: 'تقييم بالنجوم من 1 إلى 5' },
  { id: 'LIKERT_5', label: 'ليكرت (أوافق بشدة … لا أوافق)', hasOptions: false, isScale: true, hint: 'مقياس اتفاق خماسي' },
  { id: 'SINGLE_CHOICE', label: 'اختيار واحد', hasOptions: true, isScale: false, hint: 'يختار المشارك خيارًا واحدًا' },
  { id: 'MULTI_CHOICE', label: 'اختيار متعدد', hasOptions: true, isScale: false, hint: 'يمكن اختيار أكثر من خيار' },
  { id: 'YES_NO', label: 'نعم / لا', hasOptions: false, isScale: false, hint: 'سؤال ثنائي' },
  { id: 'SHORT_TEXT', label: 'نص قصير', hasOptions: false, isScale: false, hint: 'سطر واحد' },
  { id: 'LONG_TEXT', label: 'نص طويل', hasOptions: false, isScale: false, hint: 'فقرة حرة' },
];

export const RATING_KINDS = ['RATING_5', 'STARS', 'LIKERT_5'];

export function kindLabel(kind: string): string {
  return QUESTION_KINDS.find(k => k.id === kind)?.label || kind;
}

export function templateKindLabel(kind: string): string {
  const k = String(kind || '').toUpperCase();
  return TEMPLATE_KINDS.find(t => t.id === k)?.short || k || '—';
}

export function templateName(t: Template | null | undefined): string {
  if (!t) return '—';
  return (t.name_ar || '').trim() || (t.name_en || '').trim() || `قالب ${templateKindLabel(t.kind)}`;
}

/** تحويل نص الخيارات (سطر لكل خيار أو مفصولة بفواصل عربية/إنجليزية) إلى قائمة نظيفة بلا تكرار */
export function parseOptions(text: string): string[] {
  const out: string[] = [];
  for (const raw of String(text || '').split(/\r?\n|[،,;]/)) {
    const v = raw.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export function emptyDraft(kind = 'RATING_5'): QuestionDraft {
  return { kind, text_ar: '', text_en: '', section_ar: '', section_en: '', is_required: true, optionsText: '', max_value: 5 };
}

export function draftFromQuestion(q: Question): QuestionDraft {
  return {
    kind: q.kind, text_ar: q.text_ar || '', text_en: q.text_en || '', section_ar: q.section_ar || '', section_en: q.section_en || '',
    is_required: !!q.is_required, optionsText: (q.options || []).join('\n'), max_value: q.max_value || 5,
  };
}

/** أخطاء التحقق بالعربية — قائمة فارغة = صالح */
export function validateQuestion(d: QuestionDraft): string[] {
  const errs: string[] = [];
  const meta = QUESTION_KINDS.find(k => k.id === d.kind);
  if (!meta) errs.push('نوع السؤال غير معروف');
  if (!String(d.text_ar || '').trim()) errs.push('نص السؤال بالعربية مطلوب');
  if (String(d.text_ar || '').length > 500) errs.push('نص السؤال طويل جدًا (الحد 500 حرف)');
  if (meta?.hasOptions && parseOptions(d.optionsText).length < 2) errs.push('أسئلة الاختيار تحتاج خيارين على الأقل (سطر لكل خيار)');
  if (meta?.isScale) {
    const m = Number(d.max_value);
    if (!Number.isInteger(m) || m < 3 || m > 10) errs.push('الحد الأعلى للمقياس يجب أن يكون بين 3 و10');
  }
  return errs;
}

/** تحويل المسودة إلى صف جاهز للإدراج/التحديث */
export function questionPayload(d: QuestionDraft): Omit<Question, 'id' | 'template_id' | 'order_index'> {
  const meta = QUESTION_KINDS.find(k => k.id === d.kind);
  return {
    kind: d.kind,
    text_ar: d.text_ar.trim(),
    text_en: d.text_en.trim() || null,
    section_ar: d.section_ar.trim() || null,
    section_en: d.section_en.trim() || null,
    is_required: !!d.is_required,
    options: meta?.hasOptions ? parseOptions(d.optionsText) : [],
    max_value: meta?.isScale ? Number(d.max_value) || 5 : null,
  };
}

export function sortQuestions(list: Question[]): Question[] {
  return [...list].sort((a, b) => (a.order_index - b.order_index) || a.id.localeCompare(b.id));
}

export function questionsOf(list: Question[], templateId: string): Question[] {
  return sortQuestions(list.filter(q => q.template_id === templateId));
}

export function nextOrder(list: Question[], templateId: string): number {
  return questionsOf(list, templateId).reduce((m, q) => Math.max(m, q.order_index), 0) + 1;
}

/** نقل عنصر داخل قائمة — يُعيد نسخة جديدة */
export function move<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/** ترقيم متسلسل 1..n — يُعيد فقط الأسئلة التي تغيّر ترتيبها */
export function renumber(ordered: Question[]): { id: string; order_index: number }[] {
  const changes: { id: string; order_index: number }[] = [];
  ordered.forEach((q, i) => { if (q.order_index !== i + 1) changes.push({ id: q.id, order_index: i + 1 }); });
  return changes;
}

export type TemplateStat = { template: Template; questions: number; required: number; programs: number; activePrograms: number };

export function templateStats(templates: Template[], questions: Question[], links: TemplateLink[]): TemplateStat[] {
  return templates.map(t => {
    const qs = questions.filter(q => q.template_id === t.id);
    const ls = links.filter(l => l.template_id === t.id);
    return { template: t, questions: qs.length, required: qs.filter(q => q.is_required).length, programs: ls.length, activePrograms: ls.filter(l => l.is_active).length };
  }).sort((a, b) => a.template.kind.localeCompare(b.template.kind) || templateName(a.template).localeCompare(templateName(b.template), 'ar'));
}

/** القالب المفعّل لبرنامج ونوع معيّن (كما تختاره استمارة التقييم: أول قالب مفعّل من النوع) */
export function activeTemplateFor(programId: string, kind: TemplateKind, templates: Template[], links: TemplateLink[]): Template | null {
  const ids = links.filter(l => l.program_id === programId && l.is_active).map(l => l.template_id);
  const found = templates.filter(t => ids.includes(t.id) && String(t.kind).toUpperCase() === kind);
  return found[0] || null;
}

export type CoverageRow = { program: ProgramLite; daily: Template | null; final: Template | null; dailyQuestions: number; finalQuestions: number; ok: boolean };

/** جدول التغطية: لكل برنامج قالبه اليومي والختامي وعدد الأسئلة — ok عندما يملك كليهما بأسئلة */
export function coverage(programs: ProgramLite[], templates: Template[], questions: Question[], links: TemplateLink[]): CoverageRow[] {
  return programs.map(p => {
    const daily = activeTemplateFor(p.id, 'DAILY', templates, links);
    const final = activeTemplateFor(p.id, 'FINAL', templates, links);
    const dq = daily ? questions.filter(q => q.template_id === daily.id).length : 0;
    const fq = final ? questions.filter(q => q.template_id === final.id).length : 0;
    return { program: p, daily, final, dailyQuestions: dq, finalQuestions: fq, ok: !!daily && !!final && dq > 0 && fq > 0 };
  });
}

export type LinkPlan = { deactivate: TemplateLink[]; activate: TemplateLink | null; insert: TemplateLink | null };

/**
 * خطة تغيير القالب المفعّل لبرنامج ضمن نوع واحد (يومي أو ختامي):
 * - تعطيل أي قالب آخر مفعّل من النوع نفسه (قالب واحد مفعّل لكل نوع)
 * - تفعيل الرابط الموجود أو إدراج رابط جديد؛ templateId فارغ = فصل الكل
 */
export function linkPlan(programId: string, kind: TemplateKind, templateId: string | null, templates: Template[], links: TemplateLink[]): LinkPlan {
  const sameKind = new Set(templates.filter(t => String(t.kind).toUpperCase() === kind).map(t => t.id));
  const deactivate = links.filter(l => l.program_id === programId && l.is_active && sameKind.has(l.template_id) && l.template_id !== templateId);
  if (!templateId) return { deactivate, activate: null, insert: null };
  const existing = links.find(l => l.program_id === programId && l.template_id === templateId);
  if (existing) return { deactivate, activate: existing.is_active ? null : existing, insert: null };
  return { deactivate, activate: null, insert: { program_id: programId, template_id: templateId, is_active: true } };
}

/** تطبيق الخطة محليًا (للتحديث المتفائل أو الاختبار) */
export function applyPlan(links: TemplateLink[], plan: LinkPlan): TemplateLink[] {
  const off = new Set(plan.deactivate.map(l => l.program_id + '|' + l.template_id));
  const on = plan.activate ? plan.activate.program_id + '|' + plan.activate.template_id : '';
  const out = links.map(l => {
    const k = l.program_id + '|' + l.template_id;
    if (off.has(k)) return { ...l, is_active: false };
    if (k === on) return { ...l, is_active: true };
    return l;
  });
  if (plan.insert) out.push({ ...plan.insert });
  return out;
}

/** حمولة نسخ قالب مع أسئلته (بلا معرّفات) */
export function duplicatePayload(t: Template, questions: Question[], newName: string): { template: { kind: string; name_ar: string; name_en: string | null }; questions: Omit<Question, 'id' | 'template_id'>[] } {
  const qs = questionsOf(questions, t.id).map((q, i) => ({
    kind: q.kind, text_ar: q.text_ar, text_en: q.text_en, section_ar: q.section_ar, section_en: q.section_en,
    is_required: q.is_required, options: [...(q.options || [])], max_value: q.max_value, order_index: i + 1,
  }));
  return { template: { kind: t.kind, name_ar: (newName || '').trim() || `${templateName(t)} — نسخة`, name_en: t.name_en ? `${t.name_en} (copy)` : null }, questions: qs };
}

/** تجميع الأسئلة حسب القسم بترتيب ظهورها (كما تعرضها استمارة التقييم) */
export function previewGroups(list: Question[]): { section: string; items: Question[] }[] {
  const groups: { section: string; items: Question[] }[] = [];
  for (const q of sortQuestions(list)) {
    const s = (q.section_ar || '').trim() || 'عام';
    const g = groups.find(x => x.section === s);
    if (g) g.items.push(q); else groups.push({ section: s, items: [q] });
  }
  return groups;
}

/** تقدير زمن التعبئة بالدقائق (≈ 20 ثانية للمقياس، 40 للنص) */
export function estimateMinutes(list: Question[]): number {
  const secs = list.reduce((s, q) => s + (['SHORT_TEXT', 'LONG_TEXT'].includes(q.kind) ? 40 : 20), 0);
  return Math.max(1, Math.round(secs / 60));
}
