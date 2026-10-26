// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — محاكيات الأداء (P10): أنواع السيناريو والتشغيل، معايير التقييم، تحويل الدرجة إلى دليل قدرة، وبدائل محلية للشخصية والتقييم — دوال نقية
 *  المبدأ: «لا نسألك ماذا تعرف، نضعك في الموقف». الدرجة ليست نهاية؛ هي دليل يراجعه مدرب بشري ويعتمده.
 */
import type { Lang } from './content';

export type Persona = { name: string; role: string; traits: string[]; opening_ar: string; voice?: 'child' | 'adult' };
export type RubricItem = { key: string; title_ar: string; weight: number; desc_ar: string };
export type Scenario = {
  id: string; slug: string; title_ar: string; title_en?: string | null; situation_ar: string; goal_ar: string; persona: Persona; skills: string[]; rubric: RubricItem[];
  max_turns: number; minutes: number; level?: string | null; audience: 'teacher' | 'trainer' | 'consultant' | 'learner'; status: string; demo: boolean;
};
export type Turn = { role: 'persona' | 'learner'; text: string; at: string };
export type CriterionScore = { key: string; score: number; note: string };
export type SimScore = { total: number; criteria: CriterionScore[]; strengths: string[]; improve: string[]; expert_path: string; closing_ar?: string };
export type SimRun = { id: string; created_at: string; user_id?: string | null; email?: string | null; scenario_id: string; turns: Turn[]; score?: SimScore | null; status: 'running' | 'scored' | 'approved' | 'rejected'; source?: string | null; model?: string | null; ended_at?: string | null; approved_by?: string | null; approved_at?: string | null; note?: string | null };

export const AUDIENCE_LABEL: Record<Scenario['audience'], { ar: string; en: string }> = { teacher: { ar: 'للمعلمين', en: 'Teachers' }, trainer: { ar: 'للمدربين', en: 'Trainers' }, consultant: { ar: 'للمستشارين', en: 'Consultants' }, learner: { ar: 'للمتعلمين', en: 'Learners' } };
export const SIM_STATUS_LABEL: Record<SimRun['status'], { ar: string; en: string }> = { running: { ar: 'جارية', en: 'Running' }, scored: { ar: 'مُقيَّمة — بانتظار الاعتماد', en: 'Scored — pending approval' }, approved: { ar: 'معتمدة', en: 'Approved' }, rejected: { ar: 'مرفوضة', en: 'Rejected' } };

/** عدد أدوار المتعلم حتى الآن */
export const learnerTurns = (turns: Turn[]) => turns.filter(t => t.role === 'learner').length;
/** هل انتهت المحاكاة؟ (بلغ الحد أو أعلن المتعلم الإنهاء) */
export const isFinished = (s: Pick<Scenario, 'max_turns'>, turns: Turn[]) => learnerTurns(turns) >= s.max_turns;
/** تنظيف نص المتعلم: حد 600 حرف، بلا وسوم */
export const cleanUtterance = (v: unknown) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);

/** المجموع المرجّح من معايير 0–100 (يتجاهل مفاتيح غير معروفة) */
export function weightedTotal(rubric: RubricItem[], criteria: CriterionScore[]): number {
  let s = 0, w = 0; for (const r of rubric) { const c = criteria.find(x => x.key === r.key); if (!c) continue; s += Math.max(0, Math.min(100, c.score)) * r.weight; w += r.weight; }
  return w ? Math.round(s / w) : 0;
}
/** الدرجة → مستوى أَثَر 1–5 حول المستوى الأساسي للمهارة */
export function scoreToLevel(total: number, base: number): number { const b = Math.max(1, Math.min(5, base || 3)); if (total >= 85) return Math.min(5, b + 1); if (total >= 65) return b; if (total >= 45) return Math.max(1, b - 1); return Math.max(1, b - 2); }
export function bandLabel(total: number, lang: Lang): string { const ar = lang === 'ar'; if (total >= 85) return ar ? 'أداء متمكّن' : 'Proficient'; if (total >= 65) return ar ? 'أداء جيد' : 'Good'; if (total >= 45) return ar ? 'أداء نامٍ' : 'Developing'; return ar ? 'يحتاج تدريبًا موجّهًا' : 'Needs guided practice'; }

/** حدث تعلّم يُودَع دليلًا في الملف المهاري (verb=assessed, object_type=simulation) */
export function simEvidenceEvent(run: Pick<SimRun, 'id' | 'user_id' | 'email' | 'score'>, scenario: Pick<Scenario, 'skills' | 'title_ar' | 'slug'>, approved = false) {
  return { user_id: run.user_id || null, email: run.email || null, verb: 'assessed', object_type: 'simulation', object_id: run.id, skills: scenario.skills, at: new Date().toISOString(), context: { score: run.score?.total ?? 0, scenario: scenario.slug, title: scenario.title_ar, approved } };
}

// ---------- بديل محلي للشخصية (حين لا نموذج): ردود قصيرة تُبقي الحوار حيًا وتدفع نحو المعيار ----------
const hasAny = (t: string, words: string[]) => words.some(w => t.includes(w));
export function localPersonaReply(s: Scenario, turns: Turn[]): string {
  const last = [...turns].reverse().find(t => t.role === 'learner')?.text || ''; const n = learnerTurns(turns); const p = s.persona;
  const warm = hasAny(last, ['ممتاز', 'أحسنت', 'لا بأس', 'طبيعي', 'عادي', 'شاطر', 'رائع', 'شكرًا', 'أفهم', 'أقدّر', 'معك حق']);
  const question = last.includes('؟') || hasAny(last, ['ما ', 'هل ', 'كيف', 'لماذا', 'ماذا', 'وش ']);
  const concrete = hasAny(last, ['مثال', 'جرّب', 'قل', 'انطق', 'اكتب', 'كرر', 'ضع', 'لسانك', 'نقيس', 'مؤشر', 'قبل', 'بعد', 'تجربة', 'أسبوع', 'مخرجات', 'سلوك']);
  if (n >= s.max_turns) return p.voice === 'child' ? 'طيب أستاذ… فهمت. أشوفك بكرة!' : 'حسنًا، هذا يكفيني الآن. سأفكر فيما قلت.';
  if (s.slug === 'dad-dha') {
    if (n === 1) return warm ? 'طيب… بس أنا ما أسمع فرق! «ظهر» و«ضهر» نفس الشي عندي.' : 'ليش تقول غلط بس؟ أنا حاولت!';
    if (concrete) return 'أوكي… (يحاول) ظظظ… ضضض… إيه! لساني يطلع برا في الأولى! صح؟';
    if (question) return 'ما أدري… أنا بس أكتب اللي أسمعه.';
    return 'طيب. وبعدين؟';
  }
  if (s.slug === 'silent-class') {
    if (concrete && hasAny(last, ['دردشة', 'شات', 'اكتب', 'ثنائي', 'مجموعة', 'غرف'])) return '(بعد لحظة) …كتب ثلاثة في الدردشة: "أنا من إندونيسيا"، "أحب القهوة"، "أنا طالب". يوسف: أستاذ، ممكن أقول جملتي؟';
    if (question && last.length < 60) return '…(صمت ثوانٍ) يوسف: ما أحد يبغى يغلط أستاذ.';
    return 'نعم أستاذ. (صمت)';
  }
  if (s.slug === 'impact-skeptic') {
    if (n === 1) return warm || question ? 'تمام، أنا أسمعك. بس أبغى أعرف: كيف أعرف إن التغيير بسبب تدريبكم مو بسبب أي شي ثاني؟' : 'هذا كلام عام. أعطني رقمًا.';
    if (concrete) return 'طيب، تجربة صغيرة بمؤشر واحد أقدر أدافع عنها قدام الوكيل. وش المؤشر اللي تقترحه؟ ومتى أشوف نتيجة؟';
    return 'ما زلت ما سمعت شيئًا أقدر أقيسه.';
  }
  if (s.slug === 'design-in-two-days') {
    if (question) return 'المشكلة إن في شكاوى من العملاء على طريقة الرد، والمدير قال "سووا لهم دورة تواصل". أنا ما عندي وقت أسوي تحليل احتياج.';
    if (concrete) return 'يعني ممكن نبدأ بورشة قصيرة الخميس على الرد على الشكاوى، وبعدين البرنامج الكامل؟ هذا أقدر أبيعه للمدير.';
    return 'طيب… بس أحتاج شيء أرسله للمدير اليوم.';
  }
  return warm ? 'شكرًا. كمل.' : 'طيب… وبعدين؟';
}

/** تقييم محلي تقريبي يعتمد على مؤشرات لغوية بسيطة — يُوسم source=local ويُراجع بشريًا */
export function localScore(s: Scenario, turns: Turn[]): SimScore {
  const mine = turns.filter(t => t.role === 'learner').map(t => t.text); const all = mine.join(' ');
  const len = all.length; const asks = (all.match(/؟/g) || []).length; const warm = ['ممتاز', 'أحسنت', 'لا بأس', 'طبيعي', 'أفهم', 'معك حق', 'شكرًا', 'أقدّر'].filter(w => all.includes(w)).length;
  const concrete = ['مثال', 'جرّب', 'قل', 'انطق', 'اكتب', 'كرر', 'مؤشر', 'قبل', 'بعد', 'تجربة', 'أسبوع', 'مخرجات', 'سلوك', 'دردشة', 'ثنائي', 'مهمة', 'خيار'].filter(w => all.includes(w)).length;
  const closes = /تأكد|أعد|كرر|قل لي|اكتبها|نتفق|الخطوة القادمة|نبدأ/.test(all);
  const base = Math.min(100, 30 + Math.min(30, len / 25) + Math.min(15, asks * 5) + Math.min(15, warm * 5) + Math.min(20, concrete * 5) + (closes ? 10 : 0));
  const criteria: CriterionScore[] = s.rubric.map((r, i) => {
    let sc = base; if (/empathy|safety|listen|relationship/.test(r.key)) sc = Math.min(100, base + warm * 6 - 5); if (/technique|model|task|outcomes|options|pilot/.test(r.key)) sc = Math.min(100, base + concrete * 5 - 8); if (/check|feedback|honesty|needs|turns/.test(r.key)) sc = Math.min(100, base + (closes ? 10 : -10) + asks * 2);
    return { key: r.key, score: Math.max(10, Math.round(sc - i)), note: 'تقدير محلي أولي — بانتظار مراجعة المدرب.' };
  });
  const total = weightedTotal(s.rubric, criteria);
  return {
    total, criteria,
    strengths: [warm ? 'لغة داعمة خفّضت توتر الطرف الآخر.' : 'حافظت على الحوار حتى نهايته.', concrete ? 'انتقلت من الكلام العام إلى إجراء محدد.' : 'طرحت أسئلة لفهم الموقف.'].slice(0, 2),
    improve: [concrete ? 'اختم كل إجراء بتحقق صريح من الفهم أو الاتفاق.' : 'استبدل الشرح العام بإجراء ملموس واحد يمكن ملاحظته.', asks ? 'قلّل الأسئلة المتتابعة واترك مساحة للطرف الآخر.' : 'اسأل سؤالًا تشخيصيًا قبل أن تقترح حلًا.'],
    expert_path: s.rubric.map(r => r.desc_ar).join(' ← '),
  };
}

/** تصفية مخرجات النموذج للتقييم */
export function sanitizeScore(raw: any, s: Scenario): SimScore | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.criteria)) return null;
  const criteria: CriterionScore[] = s.rubric.map(r => { const c = raw.criteria.find((x: any) => x?.key === r.key); const sc = Number(c?.score); return { key: r.key, score: Number.isFinite(sc) ? Math.max(0, Math.min(100, Math.round(sc))) : 50, note: String(c?.note || '').slice(0, 240) }; });
  const arr = (v: any, n: number) => (Array.isArray(v) ? v.map(x => String(x).slice(0, 240)).filter(Boolean).slice(0, n) : []);
  return { total: weightedTotal(s.rubric, criteria), criteria, strengths: arr(raw.strengths, 3), improve: arr(raw.improve, 3), expert_path: String(raw.expert_path || '').slice(0, 600), closing_ar: raw.closing_ar ? String(raw.closing_ar).slice(0, 240) : undefined };
}

/** سيناريو العرض للزوار (بلا قاعدة بيانات): نسخة مطابقة لبذرة dad-dha */
export const DEMO_SCENARIO: Scenario = {
  id: 'demo', slug: 'dad-dha', title_ar: 'طالب لا يميّز بين الضاد والظاء', title_en: 'A learner who confuses ḍād and ẓāʾ',
  situation_ar: 'أنت معلّم/معلّمة عربية في صف للناطقين بغيرها. «رافي» (12 سنة، من الهند) متحمس لكنه يُحبط بسرعة، ويقرأ «ظهر» على أنها «ضهر». أمامك ثلاث دقائق في نهاية الحصة.',
  goal_ar: 'صحّح الخلط بطريقة لا تُحبط رافي، واستخدم تقنية حسية أو مقارنة واضحة، وتأكد من فهمه قبل أن ينصرف.',
  persona: { name: 'رافي', role: 'طالب في الصف السادس من الهند، مستوى A2', traits: ['متحمس', 'يُحبط بسرعة', 'يحب كرة القدم', 'يسأل: لماذا؟'], opening_ar: 'أستاذ… أنا كتبت «ضهر» في الاختبار وقلت لي خطأ. بس أنا سمعتها كذا! ليش هي غلط؟', voice: 'child' },
  skills: [], rubric: [{ key: 'empathy', title_ar: 'التعامل مع الإحباط', weight: 25, desc_ar: 'طمأنة الطالب وتحويل الخطأ إلى فرصة' }, { key: 'diagnosis', title_ar: 'تشخيص السبب', weight: 20, desc_ar: 'المشكلة سمعية/نطقية لا إملائية' }, { key: 'technique', title_ar: 'تقنية التصحيح', weight: 35, desc_ar: 'مقارنة مخرج الصوت أو ثنائيات صغرى مع نمذجة' }, { key: 'check', title_ar: 'التحقق من الفهم', weight: 20, desc_ar: 'طلب إنتاج من الطالب قبل الإنهاء' }],
  max_turns: 3, minutes: 3, level: 'A2', audience: 'teacher', status: 'published', demo: true,
};
