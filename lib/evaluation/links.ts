// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P49 «تقويم البرامج — الرابط الذي لا يُخطئ» — دوال نقيّة بلا React / بلا Supabase
 *  (أ) روابط التقييم الذكية: رمز قصير · نطاق (برنامج/شعبة/مستوى) · نافذة زمنية · عنوان الورقة (مجموعة/برنامج/فترة)
 *  (د) «استبيان نهاية البرنامج» (END): بذرة الأسئلة (v2: 53 بندًا — P49-د) (المصدر الوحيد للترحيل والاختبارات) · اختيار القالب الافتراضي · مؤشّر الترشيح NPS (0–10)
 */

export const P49_NAMES_AR = {
  links: 'الرابط الذي لا يُخطئ', generator: 'مولّد الروابط', sheet: 'ورقة الطباعة', sheetAll: 'ورقة لكل شعبة', locked: 'أنت تقيّم',
  end: 'استبيان نهاية البرنامج', endOfficial: 'استبيان نهاية البرنامج (عام — لكل البرامج القصيرة)', purge: 'حذف البيانات القديمة', logout: 'خروج',
  motto: 'المتدرب لا يختار شيئًا؛ الرابط يعرف من هو', groupQr: 'QR المجموعة', inLearnerLang: 'بلغة المتدرّب',
} as const;

export const LINK_KINDS = ['DAILY', 'FINAL', 'END'] as const;
export type LinkKind = typeof LINK_KINDS[number];
export const KIND_AR: Record<LinkKind, string> = { DAILY: 'الاستبيان اليومي', FINAL: 'الاستبيان الختامي', END: 'استبيان نهاية البرنامج' };
export const KIND_EN: Record<LinkKind, string> = { DAILY: 'Daily evaluation', FINAL: 'Final evaluation', END: 'End-of-program survey' };
export const KIND_PATH: Record<LinkKind, string> = { DAILY: 'daily', FINAL: 'final', END: 'end' };
export function kindFromPath(p: string | null | undefined): LinkKind { const k = String(p || '').toLowerCase(); return k === 'final' ? 'FINAL' : k === 'end' ? 'END' : 'DAILY'; }
export function isLinkKind(k: unknown): k is LinkKind { return (LINK_KINDS as readonly string[]).includes(String(k || '').toUpperCase()); }

/** أبجدية بلا التباس (بلا I O 0 1) — 6 أحرف ≈ مليار احتمال */
export const LINK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LINK_CODE_LEN = 6;
export function linkCode(rnd: () => number = Math.random, len = LINK_CODE_LEN): string { let s = ''; for (let i = 0; i < len; i++) s += LINK_ALPHABET[Math.floor(rnd() * LINK_ALPHABET.length) % LINK_ALPHABET.length]; return s; }
export function normalizeCode(raw: string | null | undefined): string { return String(raw || '').trim().toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 12); }
export function shortUrl(origin: string, code: string): string { return `${String(origin || '').replace(/\/$/, '')}/e/${code}`; }

export type EvalLink = {
  id: string; code: string; kind: LinkKind; program_id: string; classroom_id: string | null; level: string | null;
  label_ar: string | null; slot_ar: string | null; opens_at: string | null; closes_at: string | null; active: boolean; hits: number; created_at?: string | null; last_hit_at?: string | null;
  lang?: LinkLang | null;   /* P49-ب: لغة الفتح — auto = لغة متصفّح المتدرّب */
};
/* ───────── P49-ب «بلغة المتدرّب» ───────── */
export const LINK_LANGS = ['auto', 'ar', 'en'] as const;
export type LinkLang = typeof LINK_LANGS[number];
export const LINK_LANG_AR: Record<LinkLang, string> = { auto: 'بلغة متصفّح المتدرّب (تلقائي)', ar: 'العربية', en: 'English' };
export function normalizeLinkLang(v: unknown): LinkLang { const x = String(v || '').toLowerCase(); return x === 'ar' || x === 'en' ? x : 'auto'; }
/** اللغة التي يُفتح بها الاستبيان: ar/en صريحة من الرابط، وإلا لغة المتصفّح (كل ما ليس عربيًّا → الإنجليزية) */
export function resolveOpenLang(linkLang: unknown, browserLang: string | null | undefined, fallback: 'ar' | 'en' = 'ar'): 'ar' | 'en' {
  const l = normalizeLinkLang(linkLang); if (l !== 'auto') return l;
  const b = String(browserLang || '').toLowerCase(); if (!b) return fallback; return b.startsWith('ar') ? 'ar' : 'en';
}
export type LinkState = 'open' | 'before' | 'after' | 'off';
export function linkState(link: Pick<EvalLink, 'active' | 'opens_at' | 'closes_at'> | null | undefined, now: Date = new Date()): LinkState {
  if (!link || link.active === false) return 'off';
  const t = now.getTime();
  if (link.opens_at && t < new Date(link.opens_at).getTime()) return 'before';
  if (link.closes_at && t > new Date(link.closes_at).getTime()) return 'after';
  return 'open';
}
export function fmtWhen(iso: string | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
export function linkStateText(state: LinkState, link: Pick<EvalLink, 'opens_at' | 'closes_at'> | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (state === 'open') return '';
  if (state === 'off') return lang === 'ar' ? 'انتهى هذا الرابط — اطلب رابطًا جديدًا من مدرّبك أو إدارة البرنامج.' : 'This link has expired — ask your trainer or the program office for a new one.';
  if (state === 'before') return lang === 'ar' ? `هذا الرابط يُفتح من ${fmtWhen(link?.opens_at, 'ar')}${link?.closes_at ? ` إلى ${fmtWhen(link.closes_at, 'ar')}` : ''}.` : `This link opens on ${fmtWhen(link?.opens_at, 'en')}${link?.closes_at ? ` until ${fmtWhen(link.closes_at, 'en')}` : ''}.`;
  return lang === 'ar' ? `أُغلق هذا الرابط في ${fmtWhen(link?.closes_at, 'ar')} — شكرًا لك؛ إن كنت لم تقيّم بعد فاطلب رابطًا جديدًا.` : `This link closed on ${fmtWhen(link?.closes_at, 'en')} — ask for a new link if you have not evaluated yet.`;
}

/** عنوان الورقة/الرابط — كما طلب المالك: باسم المجموعة أو البرنامج أو الفترة */
export const TITLE_PRESETS = ['group', 'program', 'period'] as const;
export type TitlePreset = typeof TITLE_PRESETS[number];
export const TITLE_PRESET_AR: Record<TitlePreset, string> = { group: 'باسم المجموعة/الشعبة', program: 'باسم البرنامج', period: 'باسم الفترة/الموعد' };
export type ClassroomLite = { id: string; code?: string | null; section_name?: string | null; level?: string | null; trainer_name?: string | null };
export function classroomLabel(c: ClassroomLite | null | undefined): string { if (!c) return ''; const parts = [c.section_name || c.code || '', c.level || ''].filter(Boolean); return parts.join(' — '); }
export function titlePreset(preset: TitlePreset, ctx: { program_ar: string; classroom?: ClassroomLite | null; slot_ar?: string | null; opens_at?: string | null; closes_at?: string | null; level?: string | null }): string {
  const prog = String(ctx.program_ar || '').trim();
  if (preset === 'group') { const c = classroomLabel(ctx.classroom) || ctx.level || ''; return c ? `${c} — ${prog}` : prog; }
  if (preset === 'period') { const per = String(ctx.slot_ar || '').trim() || [fmtWhen(ctx.opens_at), fmtWhen(ctx.closes_at)].filter(Boolean).join(' → '); return per ? `${prog} — ${per}` : prog; }
  return prog;
}
/** العنوان الظاهر للمتدرّب في البطاقة المقفلة ولورقة الطباعة: التسمية إن وُجدت وإلا البرنامج + الشعبة */
export function linkTitle(link: Pick<EvalLink, 'label_ar' | 'level' | 'slot_ar'>, program_ar: string, classroom?: ClassroomLite | null): string {
  const lab = String(link.label_ar || '').trim(); if (lab) return lab;
  return titlePreset('group', { program_ar, classroom, level: link.level });
}
export function cleanLabel(s: unknown, max = 120): string { return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }
/** نطاق الرابط بالكلمات */
export function scopeText(link: Pick<EvalLink, 'classroom_id' | 'level'>, classroom?: ClassroomLite | null, lang: 'ar' | 'en' = 'ar'): string {
  if (link.classroom_id) return lang === 'ar' ? `شعبة واحدة: ${classroomLabel(classroom) || '—'}` : `One section: ${classroomLabel(classroom) || '—'}`;
  if (link.level) return lang === 'ar' ? `مستوى: ${link.level} (كل شعبه)` : `Level: ${link.level} (all its sections)`;
  return lang === 'ar' ? 'كل الشعب' : 'All sections';
}
/** الشعب التي يُسمح بها تحت هذا الرابط */
export function allowedClassrooms(link: Pick<EvalLink, 'classroom_id' | 'level'>, classrooms: ClassroomLite[]): ClassroomLite[] {
  if (link.classroom_id) return classrooms.filter(c => c.id === link.classroom_id);
  if (link.level) return classrooms.filter(c => String(c.level || '').trim() === String(link.level).trim());
  return classrooms;
}
/** التحقّق من طلب إنشاء رابط */
export function validateLinkInput(b: any): { ok: true; value: { kind: LinkKind; program_id: string; classroom_id: string | null; level: string | null; label_ar: string | null; slot_ar: string | null; opens_at: string | null; closes_at: string | null; lang: LinkLang } } | { ok: false; error: string } {
  const kind = String(b?.kind || '').toUpperCase(); if (!isLinkKind(kind)) return { ok: false, error: 'نوع الاستبيان غير معروف' };
  const program_id = String(b?.program_id || '').trim(); if (!program_id) return { ok: false, error: 'اختر البرنامج' };
  const classroom_id = b?.classroom_id ? String(b.classroom_id) : null; const level = !classroom_id && b?.level ? cleanLabel(b.level, 60) : null;
  const opens_at = b?.opens_at ? new Date(b.opens_at) : null; const closes_at = b?.closes_at ? new Date(b.closes_at) : null;
  if (opens_at && Number.isNaN(opens_at.getTime())) return { ok: false, error: 'تاريخ الفتح غير صالح' };
  if (closes_at && Number.isNaN(closes_at.getTime())) return { ok: false, error: 'تاريخ الإغلاق غير صالح' };
  if (opens_at && closes_at && closes_at.getTime() <= opens_at.getTime()) return { ok: false, error: 'الإغلاق يجب أن يكون بعد الفتح' };
  return { ok: true, value: { kind: kind as LinkKind, program_id, classroom_id, level, label_ar: cleanLabel(b?.label_ar) || null, slot_ar: cleanLabel(b?.slot_ar, 80) || null, opens_at: opens_at ? opens_at.toISOString() : null, closes_at: closes_at ? closes_at.toISOString() : null, lang: normalizeLinkLang(b?.lang) } };
}

/* ───────── (د) القالب الافتراضي و NPS ───────── */
export type TemplateLite = { id: string; kind: string; is_default?: boolean | null; name_ar?: string | null };
export type TemplateLinkLite = { program_id: string; template_id: string; is_active: boolean };
/** القالب الفعّال للبرنامج أوّلًا، وإلا القالب الافتراضي من النوع (is_default)، وإلا أيّ قالب من النوع */
export function pickTemplate(kind: LinkKind, programId: string, links: TemplateLinkLite[], templates: TemplateLite[]): { id: string; via: 'program' | 'default' | 'any' } | null {
  const ofKind = templates.filter(t => String(t.kind || '').toUpperCase() === kind);
  const active = links.filter(l => l.program_id === programId && l.is_active).map(l => l.template_id);
  const own = ofKind.find(t => active.includes(t.id)); if (own) return { id: own.id, via: 'program' };
  const def = ofKind.find(t => t.is_default); if (def) return { id: def.id, via: 'default' };
  return ofKind[0] ? { id: ofKind[0].id, via: 'any' } : null;
}
export const NPS_MIN = 0, NPS_MAX = 10;
export function normalizeNps(v: unknown): number | null { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= NPS_MIN && n <= NPS_MAX ? n : null; }
export function npsSummary(values: unknown[]): { n: number; promoters: number; passives: number; detractors: number; score: number | null; mean: number | null } {
  const xs = values.map(normalizeNps).filter((x): x is number => x !== null);
  const promoters = xs.filter(x => x >= 9).length, detractors = xs.filter(x => x <= 6).length, passives = xs.length - promoters - detractors;
  return { n: xs.length, promoters, passives, detractors, score: xs.length ? Math.round(((promoters - detractors) / xs.length) * 100) : null, mean: xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null };
}
export const NPS_BAND_AR = (score: number | null) => score === null ? '—' : score >= 50 ? 'ممتاز' : score >= 0 ? 'جيد' : 'يحتاج انتباهًا';

/** أسئلة استبيان نهاية البرنامج (17) — بالنصّ الذي أرسله المالك + ترجمة إنجليزية */
export type SeedQ = { key: string; kind: 'LIKERT_5' | 'LONG_TEXT' | 'SINGLE_CHOICE' | 'NPS_10'; ar: string; en: string; section_ar: string; section_en: string; required: boolean; options?: string[]; max?: number | null };
export const LIKERT_AR = ['موافق بقوة', 'موافق', 'محايد', 'غير موافق', 'غير موافق بقوة'];
export const LIKERT_EN = ['Strongly agree', 'Agree', 'Neutral', 'Disagree', 'Strongly disagree'];
export const OVERALL_OPTIONS = ['ممتاز', 'جيد جدا', 'جيد', 'مقبول', 'ضعيف'];
export const END_SURVEY_NAME_AR = 'استبيان نهاية البرنامج (عام)';
export const END_SURVEY_NAME_EN = 'End-of-program survey (general)';
const L = (key: string, ar: string, en: string, section_ar: string, section_en: string): SeedQ => ({ key, kind: 'LIKERT_5', ar, en, section_ar, section_en, required: true, options: [], max: 5 });
const O = (key: string, ar: string, en: string, section_ar: string, section_en: string): SeedQ => ({ ...L(key, ar, en, section_ar, section_en), required: false }); /* بند اختياري «إن انطبق» */
const T = (key: string, ar: string, en: string): SeedQ => ({ key, kind: 'LONG_TEXT', ar, en, section_ar: 'رأيك', section_en: 'Your opinion', required: false, options: [], max: null });
/** P49-د (2026-11-08): الاستبيان الختامي الشامل — يغطّي رحلة المتدرّب كلّها من التسجيل إلى الوثائق، بلغة تصلح لأيّ جهة (لا «أكاديمية» ولا «دورة»)
 *  المفاتيح القديمة end_q01…q17 باقية (الإجابات السابقة سليمة) ونصوصها حُدِّثت؛ الأقسام بترتيب ما يعيشه المتدرّب. البنود الموسومة «إن انطبق» اختيارية. */
export const END_SURVEY_SEED: SeedQ[] = [
  /* 1) التسجيل والاستقبال */
  L('end_r01_registration', 'خطوات التسجيل في البرنامج كانت واضحة وسهلة', 'The registration steps were clear and easy', 'التسجيل والاستقبال', 'Registration & reception'),
  L('end_r02_enquiries', 'رُدّ على استفساراتي قبل البرنامج بسرعة ووضوح', 'My enquiries before the programme were answered quickly and clearly', 'التسجيل والاستقبال', 'Registration & reception'),
  L('end_r03_prearrival', 'وصلتني معلومات كافية قبل البدء (المواعيد · المكان · المتطلبات)', 'I received sufficient information before starting (dates, venue, requirements)', 'التسجيل والاستقبال', 'Registration & reception'),
  L('end_r04_reception', 'استقبلني فريق الاستقبال باحترام وساعدني في اليوم الأول', 'The reception team welcomed me respectfully and helped me on the first day', 'التسجيل والاستقبال', 'Registration & reception'),
  /* 2) قاعة التدريب والمرافق */
  L('end_f01_room', 'قاعة التدريب مناسبة من حيث المساحة والمقاعد وترتيب الجلوس', 'The training room was suitable in size, seating and layout', 'قاعة التدريب والمرافق', 'Training room & facilities'),
  L('end_f02_climate', 'الإضاءة والتهوية ودرجة الحرارة في القاعة مريحة', 'Lighting, ventilation and temperature in the room were comfortable', 'قاعة التدريب والمرافق', 'Training room & facilities'),
  L('end_f03_cleanliness', 'نظافة القاعة والمرافق (دورات المياه · الممرّات) جيدة', 'The room and facilities (restrooms, corridors) were clean', 'قاعة التدريب والمرافق', 'Training room & facilities'),
  L('end_f04_access', 'الوصول إلى مقرّ التدريب سهل (الموقع · اللوحات الإرشادية · مواقف السيارات)', 'Reaching the venue was easy (location, signage, parking)', 'قاعة التدريب والمرافق', 'Training room & facilities'),
  O('end_f05_accessibility', 'المقرّ مهيّأ لذوي الإعاقة واحتياجات الوصول (إن انطبق)', 'The venue is accessible for people with disabilities (if applicable)', 'قاعة التدريب والمرافق', 'Training room & facilities'),
  /* 3) التجهيزات والتقنية */
  L('end_t01_av', 'الشاشة أو جهاز العرض والصوت واضحان من كل مقاعد القاعة', 'The screen/projector and sound were clear from every seat', 'التجهيزات والتقنية', 'Equipment & technology'),
  L('end_t02_internet', 'الإنترنت متاح ومستقر عند الحاجة إليه', 'Internet was available and stable when needed', 'التجهيزات والتقنية', 'Equipment & technology'),
  O('end_t03_platform', 'المنصّة الرقمية أو الأدوات الإلكترونية المستخدمة سهلة ومفيدة (إن استُخدمت)', 'The digital platform or e-tools used were easy and useful (if used)', 'التجهيزات والتقنية', 'Equipment & technology'),
  L('end_t04_supplies', 'الأدوات والمستلزمات التدريبية (سبورة · أقلام · أوراق · نسخ) متوفّرة', 'Training supplies (board, markers, paper, copies) were available', 'التجهيزات والتقنية', 'Equipment & technology'),
  L('end_t05_support', 'الدعم التقني أو اللوجستي يصل بسرعة عند حدوث مشكلة', 'Technical or logistical support arrived quickly when a problem occurred', 'التجهيزات والتقنية', 'Equipment & technology'),
  /* 4) الضيافة والخدمات */
  O('end_h01_catering', 'جودة الضيافة (المشروبات · الوجبات) مناسبة (إن قُدّمت)', 'The quality of hospitality (drinks, meals) was appropriate (if provided)', 'الضيافة والخدمات', 'Hospitality & services'),
  L('end_h02_breaks', 'مواعيد الاستراحات ومدّتها مناسبة', 'Break times and their length were appropriate', 'الضيافة والخدمات', 'Hospitality & services'),
  O('end_h03_rest', 'أماكن الاستراحة والصلاة متوفّرة ومريحة (إن انطبق)', 'Rest and prayer areas were available and comfortable (if applicable)', 'الضيافة والخدمات', 'Hospitality & services'),
  /* 5) المادة التدريبية وكتاب المستوى */
  L('end_q01_objectives', 'كانت أهداف البرنامج واضحة منذ البداية', 'The programme objectives were clear from the start', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  L('end_q04_materials', 'كانت الحقيبة التدريبية ومصادر التعلّم مفيدة', 'The training kit and learning resources were useful', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  L('end_q06_quality', 'مواد البرنامج (أو كتاب المستوى) عالية الجودة ومناسبة للتعلّم', 'The programme materials (or level book) were high quality and suitable for learning', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  L('end_m01_level_fit', 'محتوى المادة أو كتاب المستوى مناسب لمستواي الحالي', 'The material or level book matched my current level', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  L('end_m02_sequence', 'تسلسل الموضوعات منطقي ومتدرّج', 'The topics were sequenced logically and progressively', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  O('end_m03_skills', 'المادة توازن بين المهارات (استماع · تحدّث · قراءة · كتابة) بما يناسب البرنامج (إن انطبق)', 'The material balanced the skills (listening, speaking, reading, writing) as the programme requires (if applicable)', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  L('end_m04_examples', 'الأمثلة والتمارين واقعية وقريبة من احتياجي', 'Examples and exercises were realistic and close to my needs', 'المادة التدريبية وكتاب المستوى', 'Training material & level book'),
  /* 6) المدرّب */
  L('end_q07_motivation', 'زاد المدرّب من حافزي للتعلّم', 'The trainer increased my motivation to learn', 'المدرّب', 'The trainer'),
  L('end_q08_depth', 'شرح المدرّب المعلومات بعمق وتفصيل مناسبين', 'The trainer explained the information in appropriate depth and detail', 'المدرّب', 'The trainer'),
  L('end_q09_enthusiasm', 'كان المدرّب متحمّسًا ومهتمًّا بالتدريب', 'The trainer was enthusiastic and engaged in the training', 'المدرّب', 'The trainer'),
  L('end_q10_answers', 'حصلت على إجابات واضحة لأسئلتي من المدرّب', 'I got clear answers to my questions from the trainer', 'المدرّب', 'The trainer'),
  L('end_q11_readiness', 'كان المدرّب مستعدًّا للإجابة عن كل الاستفسارات المتعلّقة بالبرنامج', 'The trainer was ready to answer all programme-related enquiries', 'المدرّب', 'The trainer'),
  L('end_q12_pace', 'كانت سرعة تقديم المادة مناسبة', 'The pace of delivery was right', 'المدرّب', 'The trainer'),
  L('end_tr01_time', 'يلتزم المدرّب بالمواعيد ويدير وقت الجلسة جيدًا', 'The trainer was punctual and managed session time well', 'المدرّب', 'The trainer'),
  L('end_tr02_respect', 'يعامل المدرّب الجميع باحترام وعدل ويشجّع المشاركة', 'The trainer treated everyone with respect and fairness and encouraged participation', 'المدرّب', 'The trainer'),
  L('end_tr03_methods', 'ينوّع المدرّب طرائق التدريب (شرح · حوار · تطبيق · مجموعات)', 'The trainer varied the methods (explanation, discussion, practice, group work)', 'المدرّب', 'The trainer'),
  L('end_tr04_feedback', 'يقدّم لي المدرّب تغذية راجعة واضحة على أدائي', 'The trainer gave me clear feedback on my performance', 'المدرّب', 'The trainer'),
  /* 7) الأنشطة التدريبية والتقييم */
  L('end_q02_workload', 'كان مقدار الواجبات والأعمال الصفّية المطلوبة مناسبًا', 'The amount of assignments and class work required was appropriate', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  L('end_q03_presentations', 'تشرح العروض والشروح التدريبية المفاهيم بفاعلية', 'The presentations explained the concepts effectively', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  L('end_q05_technology', 'عزّز استخدام التقنية خلال البرنامج فهمي للموضوع', 'The use of technology during the programme enhanced my understanding', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  L('end_a01_interactive', 'الأنشطة التفاعلية (مجموعات · أدوار · مشاريع) أفادتني في التعلّم', 'Interactive activities (groups, role-play, projects) helped my learning', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  L('end_a02_assessment', 'الاختبارات والواجبات عكست ما تعلّمته فعلًا', 'Tests and assignments reflected what I actually learned', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  L('end_a03_progress', 'عرفت نتائجي ومستوى تقدّمي أثناء البرنامج لا في نهايته فقط', 'I knew my results and progress during the programme, not only at the end', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  O('end_a04_extra', 'الأنشطة المصاحبة (زيارات · فعاليات · أنشطة ثقافية) أضافت لي (إن وُجدت)', 'Accompanying activities (visits, events, cultural activities) added value (if any)', 'الأنشطة التدريبية والتقييم', 'Activities & assessment'),
  /* 8) إدارة البرنامج */
  L('end_p01_schedule', 'الجدول الزمني واضح والتزمت به إدارة البرنامج', 'The schedule was clear and the programme office kept to it', 'إدارة البرنامج', 'Programme management'),
  L('end_p02_duration', 'مدّة البرنامج وعدد الساعات مناسبان للمحتوى', 'The programme length and hours suited the content', 'إدارة البرنامج', 'Programme management'),
  L('end_p03_group', 'حجم المجموعة مناسب للتعلّم', 'The group size was suitable for learning', 'إدارة البرنامج', 'Programme management'),
  L('end_p04_communication', 'التواصل مع إدارة البرنامج سهل والردّ سريع', 'Communicating with the programme office was easy and responses were quick', 'إدارة البرنامج', 'Programme management'),
  L('end_p05_complaints', 'تُؤخذ الملاحظات والشكاوى بجدّية ويُتعامل معها', 'Feedback and complaints were taken seriously and acted upon', 'إدارة البرنامج', 'Programme management'),
  O('end_p06_documents', 'الوثائق (الحضور · النتائج · الشهادات) تصدر بدقّة وفي وقتها (إن انطبق)', 'Documents (attendance, results, certificates) were issued accurately and on time (if applicable)', 'إدارة البرنامج', 'Programme management'),
  /* 9) رأيك */
  T('end_q13_improve_trainer', 'ما الذي تنصح به لتحسين أداء المدرّب؟', 'What would you recommend to improve the trainer\'s performance?'),
  T('end_q14_strengths', 'ما نقاط القوة الرئيسية في هذا البرنامج؟', 'What are the main strengths of this programme?'),
  T('end_q15_improvements', 'ما النقاط التي تحتاج إلى تحسين في هذا البرنامج؟', 'What needs improvement in this programme?'),
  T('end_o01_environment', 'ما الذي تقترحه لتحسين البيئة التدريبية (القاعة · التجهيزات · الخدمات · الإدارة)؟', 'What would you suggest to improve the training environment (room, equipment, services, management)?'),
  /* 10) التقييم العام */
  { key: 'end_q16_overall', kind: 'SINGLE_CHOICE', ar: 'ما التقييم العام الذي تعطيه للبرنامج؟', en: 'What overall rating would you give the programme?', section_ar: 'التقييم العام', section_en: 'Overall', required: true, options: OVERALL_OPTIONS, max: null },
  { key: 'end_q17_nps', kind: 'NPS_10', ar: 'ما مدى ترشيحك لزملائك وأصدقائك بالتدرّب معنا؟ (10 أعلى قيمة و0 أقل قيمة)', en: 'How likely are you to recommend training with us to your colleagues and friends? (10 = highest, 0 = lowest)', section_ar: 'الترشيح', section_en: 'Recommendation', required: true, options: [], max: 10 },
];
export const END_SURVEY_SECTIONS_AR = ['التسجيل والاستقبال', 'قاعة التدريب والمرافق', 'التجهيزات والتقنية', 'الضيافة والخدمات', 'المادة التدريبية وكتاب المستوى', 'المدرّب', 'الأنشطة التدريبية والتقييم', 'إدارة البرنامج'];
export function endSurveyStats() { return { total: END_SURVEY_SEED.length, likert: END_SURVEY_SEED.filter(q => q.kind === 'LIKERT_5').length, text: END_SURVEY_SEED.filter(q => q.kind === 'LONG_TEXT').length, choice: END_SURVEY_SEED.filter(q => q.kind === 'SINGLE_CHOICE').length, nps: END_SURVEY_SEED.filter(q => q.kind === 'NPS_10').length }; }
/** كيف يُخزَّن جواب كل نوع في evaluation_answers (ليكرت → rating 1..5 حيث 5 = موافق بقوة · NPS → text_value "0".."10" حتى لا يُفسد متوسّطات 1–5) */
export function answerRow(kind: string, value: any): { rating_value: number | null; selected_option: string | null; selected_options: string[]; text_value: string | null } {
  const k = String(kind || '').toUpperCase();
  if (['RATING_5', 'STARS', 'LIKERT_5'].includes(k)) return { rating_value: Number(value) || null, selected_option: null, selected_options: [], text_value: null };
  if (k === 'NPS_10') { const n = normalizeNps(value); return { rating_value: null, selected_option: null, selected_options: [], text_value: n === null ? null : String(n) }; }
  if (['SINGLE_CHOICE', 'YES_NO'].includes(k)) return { rating_value: null, selected_option: value ? String(value) : null, selected_options: [], text_value: null };
  if (k === 'MULTI_CHOICE') return { rating_value: null, selected_option: null, selected_options: Array.isArray(value) ? value.map(String) : [], text_value: null };
  return { rating_value: null, selected_option: null, selected_options: [], text_value: value ? String(value) : null };
}
/** ليكرت: الزرّ الأوّل «موافق بقوة» = 5 … «غير موافق بقوة» = 1 */
export function likertValue(index: number): number { return 5 - index; }
export function likertLabel(value: number, lang: 'ar' | 'en' = 'ar'): string { const i = 5 - value; return (lang === 'ar' ? LIKERT_AR : LIKERT_EN)[i] || String(value); }
