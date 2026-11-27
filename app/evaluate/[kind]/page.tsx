'use client';
/**
 * /evaluate/daily و /evaluate/final — استبيان المشارك (ضيف بلا تسجيل دخول)
 * الهوية البصرية الموحّدة (نفس أسلوب نموذج قياس الأثر): شعارات، ترويسة، أقسام مرقّمة، مقياس 1–5 بتسميات، عربي/إنجليزي.
 * منطق الحفظ كما هو: منع التكرار (اليومي: نفس البريد + الشعبة + اليوم / النهائي: نفس البريد + البرنامج)، ثم evaluations + evaluation_answers.
 * يدعم ?program=<id>&classroom=<id> لاختيار البرنامج/الشعبة مسبقًا (روابط بوّابة المتعلّم وQR).
 * P49: /evaluate/end «استبيان نهاية البرنامج» (بلا خدمات/إقامة) · ?link=<رمز> «الرابط الذي لا يُخطئ»: بطاقة مقفلة بالبرنامج/الشعبة بلا قوائم، نافذة زمنية، link_id يُحفظ مع الاستجابة.
 *      ليكرت END: «موافق بقوة»=5 … «غير موافق بقوة»=1 · NPS_10: 0–10 يُحفظ نصًّا حتى لا يُفسد متوسّطات 1–5.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { FlowShell, Stations, StepCard, FlowNav, useStepScroll, type Station, type StationState } from '../../components/StepFlow'; /* هـ-3 ن «محطّات» */
import { isUniqueViolation, markDone, onceMessage, ONCE_SHARED, ONCE_TITLE, riyadhToday, wasDone, type OnceKind } from '../../../lib/evaluation/once';
import { kindFromPath, KIND_AR, KIND_EN, linkTitle, scopeText, pickTemplate, answerRow, LIKERT_AR, LIKERT_EN, NPS_MIN, NPS_MAX, type EvalLink, type LinkState } from '../../../lib/evaluation/links';
import { resolveEvalLang, windowText, frQuestion, frSection, frOption, STR_FR, SCALE_FR, LIKERT_FR, ONCE_FR, KIND_FR, FR_PROGRAMS, type EvalLang } from '../../../lib/evaluation/fr'; /* P89: الفرنسيّة + نافذة الرياض */

const COUNTRIES = [
  ['+966', 'السعودية', 'Saudi Arabia'], ['+971', 'الإمارات', 'UAE'], ['+965', 'الكويت', 'Kuwait'], ['+974', 'قطر', 'Qatar'], ['+973', 'البحرين', 'Bahrain'], ['+968', 'عُمان', 'Oman'],
  ['+967', 'اليمن', 'Yemen'], ['+962', 'الأردن', 'Jordan'], ['+964', 'العراق', 'Iraq'], ['+963', 'سوريا', 'Syria'], ['+961', 'لبنان', 'Lebanon'], ['+20', 'مصر', 'Egypt'],
  ['+212', 'المغرب', 'Morocco'], ['+213', 'الجزائر', 'Algeria'], ['+216', 'تونس', 'Tunisia'], ['+218', 'ليبيا', 'Libya'], ['+249', 'السودان', 'Sudan'], ['+252', 'الصومال', 'Somalia'],
  ['+90', 'تركيا', 'Turkey'], ['+98', 'إيران', 'Iran'], ['+92', 'باكستان', 'Pakistan'], ['+91', 'الهند', 'India'], ['+880', 'بنغلاديش', 'Bangladesh'], ['+62', 'إندونيسيا', 'Indonesia'],
  ['+60', 'ماليزيا', 'Malaysia'], ['+63', 'الفلبين', 'Philippines'], ['+66', 'تايلاند', 'Thailand'], ['+86', 'الصين', 'China'], ['+81', 'اليابان', 'Japan'], ['+82', 'كوريا الجنوبية', 'South Korea'],
  ['+998', 'أوزبكستان', 'Uzbekistan'], ['+992', 'طاجيكستان', 'Tajikistan'], ['+996', 'قيرغيزستان', 'Kyrgyzstan'], ['+7', 'كازاخستان / روسيا', 'Kazakhstan / Russia'], ['+93', 'أفغانستان', 'Afghanistan'],
  ['+234', 'نيجيريا', 'Nigeria'], ['+221', 'السنغال', 'Senegal'], ['+223', 'مالي', 'Mali'], ['+1', 'الولايات المتحدة / كندا', 'USA / Canada'], ['+44', 'بريطانيا', 'UK'], ['+33', 'فرنسا', 'France'],
  ['+49', 'ألمانيا', 'Germany'], ['+34', 'إسبانيا', 'Spain'], ['+39', 'إيطاليا', 'Italy'],
];
const RATING_KINDS = ['RATING_5', 'STARS', 'LIKERT_5'];
const EXCLUDED_FROM_RATING = ['daily_difficulty'];
const SCALE_LABELS: Record<number, [string, string]> = { 1: ['ضعيف جدًا', 'Very poor'], 2: ['ضعيف', 'Poor'], 3: ['متوسط', 'Fair'], 4: ['جيد', 'Good'], 5: ['ممتاز', 'Excellent'] };

type Q = { id: string; kind: string; text_ar: string; text_en?: string | null; section_ar?: string | null; section_en?: string | null; is_required?: boolean; options: string[]; max_value?: number | null; question_key?: string | null };
type Info = { full_name: string; phone: string; email: string; nationality: string; gender: string; accommodation_type: string; country_dial: string };

const STR = {
  dailyTitle: ['التقييم اليومي لجلسات التدريب', 'Daily Session Evaluation'], finalTitle: ['التقييم الختامي للبرنامج التدريبي', 'Final Program Evaluation'],
  kicker: ['بوّابة أَثَر', 'Training Evaluation Platform'],
  intro: ['رأيك يساعدنا على تطوير جودة البرامج. الحقول المعلَّمة بـ * إلزامية، وتستغرق التعبئة نحو 3 دقائق.', 'Your feedback helps us improve program quality. Fields marked * are required; this takes about 3 minutes.'],
  introEnd: ['رأيك يساعدنا على تطوير كل تفاصيل البيئة التدريبية — من الاستقبال إلى الشهادة. الحقول المعلَّمة بـ * إلزامية، والبنود الموسومة «إن انطبق» اتركها إن لم تنطبق عليك؛ تستغرق التعبئة نحو 6 دقائق.', 'Your feedback helps us improve every detail of the training environment — from reception to certificate. Fields marked * are required; leave items marked “if applicable” if they do not apply to you. It takes about 6 minutes.'],
  participant: ['بيانات المشارك', 'Participant information'], name: ['الاسم الكامل الثلاثي', 'Full name'], email: ['البريد الإلكتروني', 'Email address'], phone: ['رقم الجوال', 'Mobile number'],
  nationality: ['الجنسية', 'Nationality'], gender: ['النوع الاجتماعي', 'Gender'], male: ['ذكر', 'Male'], female: ['أنثى', 'Female'], choose: ['— اختر —', '— Select —'],
  accommodation: ['مكان الإقامة أثناء البرنامج', 'Accommodation during the program'], program: ['البرنامج التدريبي', 'Training program'], classroom: ['الشعبة', 'Classroom'], room: ['شعبة', 'Room'],
  noTemplate: ['لا يوجد قالب تقييم مفعّل لهذا البرنامج حاليًا — تواصل مع إدارة البرنامج.', 'No active evaluation template for this program yet — please contact the program office.'],
  journey: ['رحلتك في الاستبيان', 'Your survey journey'],
  journeyHint: ['اضغط قسمًا للانتقال إليه', 'Tap a section to jump to it'],
  journeyMissing: ['ينقصه إلزامي', 'required missing'],
  linkErr: ['تعذّر حفظ الاستبيان: القالب غير مرتبط بهذا البرنامج بعد — أبلغ إدارة البرنامج (قوالب التقييم → تغطية البرامج) ثم أعد المحاولة؛ إجاباتك ما زالت في الصفحة.', 'Could not save: the template is not linked to this program yet — please tell the program office (Templates → program coverage) and try again; your answers are still on this page.'],
  loading: ['جارٍ تجهيز الاستبيان…', 'Preparing the form…'], submit: ['إرسال التقييم', 'Submit evaluation'], sending: ['جارٍ الإرسال…', 'Sending…'],
  privacy: ['تُستخدم بياناتك لأغراض الجودة فقط وتُعرض النتائج بشكل مجمّع.', 'Your data is used for quality purposes only; results are reported in aggregate.'],
  missingFields: ['يرجى استكمال الحقول التالية:', 'Please complete the following fields:'], missingQs: ['يرجى الإجابة عن الأسئلة الإلزامية التالية:', 'Please answer the following required questions:'],
  dupDaily: ['سجلاتنا توضح أنك قيّمت هذه الجلسة اليوم مسبقًا — شكرًا لك.', 'Our records show you already evaluated this session today — thank you.'],
  endTitle: ['استبيان نهاية البرنامج', 'End-of-Program Survey'], dupEnd: ['لقد قدّمت استبيان نهاية هذا البرنامج مسبقًا — شكرًا لك.', 'You have already submitted the end-of-program survey — thank you.'],
  locked: ['أنت تقيّم', 'You are evaluating'], lockedHint: ['فُتح هذا الاستبيان برابط مخصّص — لا حاجة لاختيار البرنامج.', 'Opened via a dedicated link — no need to choose the program.'], section: ['الشعبة', 'Section'], npsLow: ['0 = لن أرشّح أبدًا', '0 = not at all likely'], npsHigh: ['10 = أرشّح بقوة', '10 = extremely likely'],
  dupFinal: ['لقد قدّمت التقييم النهائي لهذا البرنامج مسبقًا — شكرًا لك.', 'You have already submitted the final evaluation for this program — thank you.'],
  thanks: ['شكرًا لك! تم استلام تقييمك', 'Thank you! Your evaluation was received'],
  thanksBody: ['ملاحظاتك تساعدنا في تطوير جودة البرامج التدريبية.', 'Your feedback helps us improve the quality of our training programs.'],
  writeHere: ['اكتب إجابتك هنا…', 'Write your answer here…'], general: ['التقييم العام', 'General'], yes: ['نعم', 'Yes'], no: ['لا', 'No'], required: ['إلزامي', 'Required'], another: ['تقييم آخر', 'Submit another'],
  progress: ['أجبت عن', 'Answered'], of: ['من', 'of'], questions: ['سؤالًا', 'questions'],
} as const;

export default function GuestEvaluationPage() {
  const params = useParams();
  const kind = params.kind === 'final' ? 'final' : params.kind === 'end' ? 'end' : 'daily';   // P49: end
  const kindLabel = kind === 'daily' ? 'DAILY' : kind === 'final' ? 'FINAL' : 'END';
  const db = supabase();
  const [lang, setLang] = useState<EvalLang>('ar');
  const t = (k: keyof typeof STR) => lang === 'fr' ? (STR_FR[k] || STR[k][1]) : STR[k][lang === 'en' ? 1 : 0];   /* P89: fr مع الرجوع إلى en */

  const [programs, setPrograms] = useState<any[]>([]);
  const [programId, setProgramId] = useState('');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [info, setInfo] = useState<Info>({ full_name: '', phone: '', email: '', nationality: '', gender: '', accommodation_type: '', country_dial: '+966' });
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [qLoading, setQLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''); const [missIds, setMissIds] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  /* P49-ج «مرّة واحدة»: ذاكرة الجهاز + فحص البريد المبكّر */
  const [onceAt, setOnceAt] = useState<string | null>(null); const [onceOverride, setOnceOverride] = useState(false);
  const [dupEmail, setDupEmail] = useState<string | null>(null);
  /* هـ-3 ن «محطّات»: 0 بيانات المشارك · 1..n قسم لكل محطّة — والإرسال في الأخيرة */
  const [step, setStep] = useState(0); const [reached, setReached] = useState(0); const [stepErr, setStepErr] = useState('');
  useStepScroll(step);
  const onceScope = { kind: kindLabel as OnceKind, programId, classroomId: kind === 'daily' ? classroomId : null };   /* الختامي/النهاية: للبرنامج كلّه */
  useEffect(() => { if (programId) setOnceAt(wasDone(onceScope)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [programId, classroomId]);
  async function checkEmailEarly(raw: string) {
    const em = raw.trim().toLowerCase(); setDupEmail(null); if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || !programId) return;
    try {
      let q = db.from('evaluations').select('id').eq('program_id', programId).eq('guest_email', em).eq('kind', kindLabel);
      if (kind === 'daily') q = q.eq('classroom_id', classroomId).eq('evaluation_date', riyadhToday());
      const { data } = await q.limit(1); if (data && data.length) setDupEmail(em);
    } catch { /* الفحص المبكّر اختياري — الحسم عند الإرسال وفي قاعدة البيانات */ }
  }
  const [preClassroom, setPreClassroom] = useState('');
  /* P49: وضع الرابط المقفل */
  const [link, setLink] = useState<EvalLink | null>(null); const [linkStatus, setLinkStatus] = useState<LinkState | 'none' | 'invalid'>('none'); const [linkRooms, setLinkRooms] = useState<any[]>([]); const [linkProgram, setLinkProgram] = useState<any>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const sp = new URLSearchParams(window.location.search);
      let preP = sp.get('program') || ''; setPreClassroom(sp.get('classroom') || '');
      const qLang = sp.get('lang'); if (qLang === 'en' || qLang === 'fr') setLang(qLang);   /* P89 */
      const code = (sp.get('link') || '').trim();
      if (code) {   // P49: حلّ الرمز أوّلًا — البرنامج والشعبة يأتيان من الرابط لا من المشارك
        try {
          const r = await fetch(`/api/evaluation-links?code=${encodeURIComponent(code)}`, { cache: 'no-store' }); const j = await r.json();
          if (!on) return;
          if (!j?.link) { setLinkStatus('invalid'); setLoading(false); return; }
          setLink(j.link); setLinkStatus(j.state); setLinkRooms(j.classrooms || []); setLinkProgram(j.program || null);
          /* P49-ب «بلغة المشارك»: غير الناطق بالعربية يفتح الإنجليزية مباشرة */
          if (!sp.get('lang')) setLang(resolveEvalLang({ linkLang: j.link.lang, programId: j.link.program_id, browser: typeof navigator !== 'undefined' ? navigator.language : '' }));   /* P89: برنامج فرنسيّ ← فرنسيّة */
          preP = j.link.program_id; if (j.classroom?.id) setPreClassroom(j.classroom.id); else if ((j.classrooms || []).length === 1) setPreClassroom(j.classrooms[0].id);
          if (j.state !== 'open') { setLoading(false); return; }
        } catch { if (on) { setLinkStatus('invalid'); setLoading(false); } return; }
      }
      try {
        const { data: progs } = await db.from('programs').select('id,name_ar,name_en').order('name_ar');
        if (!on) return;
        const list = (progs || []) as any[]; setPrograms(list);
        setProgramId(preP && list.some(p => p.id === preP) ? preP : (list[0]?.id || ''));
      } catch { if (on) setMessage('خطأ في الاتصال بالخادم / Connection error'); }
      if (on) setLoading(false);
    })();
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (!programId) return;
    let on = true;
    (async () => {
      setMessage(''); setQuestions([]); setQLoading(true); setTemplateId(null);
      const { data: linkData } = await db.from('program_evaluation_templates').select('template_id').eq('program_id', programId).eq('is_active', true);
      const tIds = ((linkData || []) as any[]).map(l => l.template_id);
      let activeTemplateId: string | null = null;
      if (tIds.length) {
        const { data: templates } = await db.from('evaluation_templates').select('id, kind').in('id', tIds).eq('kind', kindLabel);
        activeTemplateId = (templates as any[])?.[0]?.id || null;
      }
      if (!activeTemplateId && kind === 'end') {   // P49: الاستبيان العام — القالب الافتراضي لأيّ برنامج بلا قالب خاص
        const { data: all } = await db.from('evaluation_templates').select('id,kind,is_default').eq('kind', 'END');
        activeTemplateId = pickTemplate('END', programId, [], (all || []) as any[])?.id || null;
      }
      if (!on) return;
      if (!activeTemplateId) { setQLoading(false); return; }
      setTemplateId(activeTemplateId);
      const [qRes, cRes] = await Promise.all([
        db.from('questions').select('*').eq('template_id', activeTemplateId).order('order_index'),
        db.from('classrooms').select('id,code,level,section_name').eq('program_id', programId).order('code'),
      ]);
      if (!on) return;
      setQuestions(((qRes.data || []) as any[]).map(item => ({ ...item, options: Array.isArray(item.options) ? item.options : [] })));
      const rooms = link ? ((cRes.data || []) as any[]).filter(r => linkRooms.some(x => x.id === r.id)) : (cRes.data || []) as any[]; setClassrooms(rooms);   // P49: الشعب المسموحة تحت الرابط فقط
      setClassroomId(preClassroom && rooms.some(r => r.id === preClassroom) ? preClassroom : (rooms[0]?.id || ''));
      setAnswers({}); setMissIds([]); setQLoading(false);
    })();
    return () => { on = false; };
  }, [programId, kind]);

  const grouped = useMemo(() => {
    const g: { key: string; en: string | null; items: Q[] }[] = [];
    for (const q of questions) {
      const key = q.section_ar || STR.general[0];
      let grp = g.find(x => x.key === key); if (!grp) { grp = { key, en: q.section_en || null, items: [] }; g.push(grp); }
      grp.items.push(q);
    }
    return g;
  }, [questions]);

  const set = (id: string, v: any) => { setAnswers(x => ({ ...x, [id]: v })); setMissIds(m => m.filter(i => i !== id)); };
  const toggleMulti = (id: string, option: string) => setAnswers(prev => { const cur = Array.isArray(prev[id]) ? prev[id] : []; return { ...prev, [id]: cur.includes(option) ? cur.filter((x: string) => x !== option) : [...cur, option] }; });
  const hasAnswer = (v: any) => Array.isArray(v) ? v.length > 0 : !!String(v || '').trim();
  const answered = questions.filter(q => hasAnswer(answers[q.id])).length;
  const ratingQuestions = questions.filter(q => RATING_KINDS.includes(q.kind) && !EXCLUDED_FROM_RATING.includes(q.question_key || ''));
  const L = (ar: string | null | undefined, en?: string | null) => (lang === 'ar' ? (ar || '') : (en || ar || ''));
  const LQ = (q: Q): string => lang === 'fr' ? frQuestion(q) : LQ(q);   /* P89: نصّ السؤال بلغة المشاركة */
  const LS = (ar: string, en?: string | null) => lang === 'fr' ? frSection(ar, en) : L(ar, en);
  const LO = (o: string) => lang === 'fr' ? frOption(o) : o;
  const frProgram = FR_PROGRAMS.includes(programId) || (!!link && FR_PROGRAMS.includes(link.program_id));
  const langButtons: EvalLang[] = frProgram || lang === 'fr' ? ['fr', 'ar', 'en'] : ['ar', 'en'];

  function infoMissing(): string[] {
    const missing: string[] = [];
    const isEnd = kind === 'end';   // P49: نهاية البرنامج — البريد وحده إلزامي (منع التكرار)؛ الاسم والجوال والجنس اختيارية
    if (!isEnd && !info.full_name.trim()) missing.push(t('name'));
    if (!info.email.trim()) missing.push(t('email'));
    const digits = (info.phone || '').replace(/\D/g, '');
    if (!isEnd && (!info.phone.trim() || digits.length < 7)) missing.push(t('phone'));
    if (isEnd && info.phone.trim() && digits.length < 7) missing.push(t('phone'));
    if (!isEnd && !info.gender) missing.push(t('gender'));
    if (kind === 'final' && !info.accommodation_type) missing.push(t('accommodation'));
    if (!link && !programId) missing.push(t('program'));
    if (kind === 'daily' && !classroomId) missing.push(t('classroom'));
    if (link && kind !== 'daily' && classrooms.length > 1 && !classroomId) missing.push(t('section'));   // P49: رابط «كل الشعب» يطلب الشعبة
    return missing;
  }
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (dupEmail) { setStep(0); setStepErr(kind === 'daily' ? t('dupDaily') : kind === 'end' ? t('dupEnd') : t('dupFinal')); return; }
    const missing = infoMissing();
    if (missing.length) { setStep(0); setStepErr(`${t('missingFields')}\n• ${missing.join('\n• ')}`); return; }
    const requiredMissing = questions.filter(q => q.is_required && !hasAnswer(answers[q.id]));
    if (requiredMissing.length) {
      setMissIds(requiredMissing.map(q => q.id));
      /* هـ-3 ن: نعود إلى أول محطّة ناقصة ونلوّن ما ينقصها — والمحطّات الأخرى تتلوّن في الشريط */
      const gi = grouped.findIndex(g => g.items.some(q => q.id === requiredMissing[0].id));
      setStep(Math.max(0, gi + 1));
      const inStep = requiredMissing.filter(q => grouped[gi]?.items.includes(q));
      setStepErr(`${t('missingQs')}\n${inStep.map(q => `• ${LQ(q)}`).join('\n')}`);
      return;
    }
    setSaving(true); setMessage('');
    try {
      const guestEmail = info.email.trim().toLowerCase();
      const digits = (info.phone || '').replace(/\D/g, '');
      const fullPhone = `${info.country_dial}${digits}`;
      const ratings = ratingQuestions.map(q => Number(answers[q.id])).filter(x => !isNaN(x) && x > 0);
      const today = riyadhToday();   /* P49-ج: تاريخ الرياض لا UTC */
      let dup = db.from('evaluations').select('id').eq('program_id', programId).eq('guest_email', guestEmail).eq('kind', kindLabel);
      if (kind === 'daily') dup = dup.eq('classroom_id', classroomId).eq('evaluation_date', today);
      const { data: existingRows } = await dup.limit(1); const existing = existingRows && existingRows.length ? existingRows[0] : null;
      if (existing) { setSaving(false); setMessage(`⚠️ ${kind === 'daily' ? t('dupDaily') : kind === 'end' ? t('dupEnd') : t('dupFinal')}`); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const { data: ev, error } = await db.from('evaluations').insert({
        program_id: programId, template_id: templateId, trainee_id: null, guest_email: guestEmail, guest_name: info.full_name.trim() || null, guest_phone: info.phone.trim() ? fullPhone : null, guest_gender: info.gender || null,
        accommodation_type: kind === 'final' ? info.accommodation_type : null, classroom_id: kind === 'daily' ? classroomId : (classroomId || null), kind: kindLabel, evaluation_date: today, link_id: link?.id || null,
        overall_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      } as any).select('id').single();
      if (error || !ev) throw error || new Error('تعذر حفظ التقييم');
      const rows = questions.map(q => {
        const value = answers[q.id] || '';
        return { evaluation_id: (ev as any).id, question_id: q.id, ...answerRow(q.kind, value) };   // P49: NPS_10 نصًّا
      });
      const { error: answerError } = await db.from('evaluation_answers').insert(rows as any);
      if (answerError) throw answerError;
      markDone(onceScope); setOnceAt(new Date().toISOString()); setOnceOverride(false); setDupEmail(null);   /* P49-ج: علامة الجهاز */
      setIsSuccess(true); window.scrollTo({ top: 0 });
    } catch (err: any) { setMessage(isUniqueViolation(err) ? `⚠️ ${kind === 'daily' ? t('dupDaily') : kind === 'end' ? t('dupEnd') : t('dupFinal')}` : (/غير مرتبط|not linked/i.test(String(err?.message || '')) ? `⚠️ ${t('linkErr')}` : (err?.message || 'حدث خطأ غير متوقع'))); if (isUniqueViolation(err)) window.scrollTo({ top: 0, behavior: 'smooth' }); }
    finally { setSaving(false); }
  }

  const program = programs.find(p => p.id === programId);
  const kicker = <><Icon name={kind === 'daily' ? 'calendar' : 'flag'} size={14} /> {t('kicker')}</>;
  const title = kind === 'daily' ? t('dailyTitle') : kind === 'end' ? t('endTitle') : t('finalTitle');
  const progLine = program ? <><Icon name="book" size={14} /> {L(program.name_ar, program.name_en)}</> : undefined;
  const shell = (child: React.ReactNode, opts: { sub?: React.ReactNode; langs?: boolean | EvalLang[] } = {}) => (
    <FlowShell lang={lang} kicker={kicker} title={title} sub={opts.sub} line={progLine} langs={opts.langs} onLang={setLang} testid="ev-flow"><style dangerouslySetInnerHTML={{ __html: CSS }} />{child}</FlowShell>
  );

  if (loading) return shell(<div className="fl-card fl-center fl-muted">{t('loading')}</div>);
  if (linkStatus === 'invalid' || (link && linkStatus !== 'open')) return shell(
    <section className="fl-card fl-center" data-testid="ev-link-closed" data-state={linkStatus}>
      <div className="fl-ok off"><Icon name="clock" size={30} /></div>
      <h2>{linkStatus === 'before' ? (lang === 'ar' ? 'لم يُفتح بعد' : lang === 'fr' ? STR_FR.notOpen : 'Not open yet') : linkStatus === 'after' ? (lang === 'ar' ? 'أُغلق الرابط' : lang === 'fr' ? STR_FR.closed : 'Link closed') : (lang === 'ar' ? 'انتهى هذا الرابط أو غير صالح' : lang === 'fr' ? STR_FR.invalid : 'This link is closed or invalid')}</h2>
      <p className="fl-muted" style={{ fontSize: 14 }}>{windowText(linkStatus === 'invalid' ? 'off' : linkStatus as LinkState, link, lang)}</p>
      {linkProgram && <div className="fl-line"><Icon name="book" size={14} /> {L(linkProgram.name_ar, linkProgram.name_en)}</div>}
    </section>, { langs: langButtons });
  const scopeTextL = (l: EvalLink, room: any) => lang === 'fr' ? (l.classroom_id ? `${STR_FR.scopeOne} : ${room ? [room.section_name || room.code, room.level].filter(Boolean).join(' — ') : '—'}` : l.level ? `${STR_FR.scopeLevel} : ${l.level}` : STR_FR.scopeAll) : scopeText(l, room, lang === 'ar' ? 'ar' : 'en');
  const lockedRoom = link?.classroom_id ? (linkRooms.find(x => x.id === link.classroom_id) || classrooms.find(c => c.id === link.classroom_id) || null) : null;
  const lockCard = link && linkProgram ? (
    <section className="fl-lock" data-testid="ev-locked">
      <div className="fl-lock-k"><Icon name="shield" size={14} /> {t('locked')}</div>
      <div className="fl-lock-t">{linkTitle(link, L(linkProgram.name_ar, linkProgram.name_en), lockedRoom)}</div>
      <div className="fl-lock-m">{L(linkProgram.name_ar, linkProgram.name_en)} · {lang === 'ar' ? KIND_AR[kindFromPath(kind)] : lang === 'fr' ? KIND_FR[kindFromPath(kind)] : KIND_EN[kindFromPath(kind)]} · {scopeTextL(link, lockedRoom)}{link.slot_ar ? ` · ${link.slot_ar}` : ''}</div>
      <small className="fl-muted">{t('lockedHint')}</small>
    </section>) : null;
  if (isSuccess) return shell(
    <section className="fl-card fl-center" data-testid="ev-done">
      <div className="fl-ok"><Icon name="check" size={34} /></div>
      <h2>{t('thanks')}</h2>
      <p className="fl-muted" style={{ fontSize: 14 }}>{t('thanksBody')}</p>
      <button type="button" className="fl-btn ghost" onClick={() => { setIsSuccess(false); setAnswers({}); setInfo(i => ({ ...i, full_name: '', email: '', phone: '' })); setStep(0); setReached(0); }}><Icon name="refresh" size={14} /> {t('another')}</button>
    </section>);

  if (onceAt && !onceOverride) return shell(<>
    {lockCard}
    <section className="fl-card fl-center" data-testid="ev-once" data-at={onceAt}>
      <div className="fl-ok"><Icon name="check" size={34} /></div>
      <h2>{lang === 'fr' ? ONCE_FR.title : ONCE_TITLE[lang === 'en' ? 1 : 0]}</h2>
      <p className="fl-muted" style={{ fontSize: 14 }}>{lang === 'fr' ? (kind === 'daily' ? ONCE_FR.perDay : ONCE_FR.once) : onceMessage(kindLabel as OnceKind, lang)}</p>
      <button type="button" className="fl-btn ghost" onClick={() => setOnceOverride(true)} data-testid="ev-once-override"><Icon name="users" size={14} /> {lang === 'fr' ? ONCE_FR.shared : ONCE_SHARED[lang === 'en' ? 1 : 0]}</button>
    </section>
  </>);

  const field = (label: string, required: boolean, control: React.ReactNode, span?: boolean) => <label className={`fl-field${span ? ' span' : ''}`}><span>{label}{required && <span className="fl-req"> *</span>}</span>{control}</label>;

  /* ---------------- محطّات: بيانات المشارك ثم قسم لكل محطّة ---------------- */
  const infoDoneCount = [kind !== 'end' ? !!info.full_name.trim() : true, !!info.email.trim(), kind !== 'end' ? !!info.phone.trim() : true, kind !== 'end' ? !!info.gender : true, link ? true : !!programId].filter(Boolean).length;
  const infoTotal = 5;
  const st = (done: number, total: number, missNow: boolean): StationState => missNow ? 'miss' : total === 0 ? 'todo' : done >= total ? 'done' : done > 0 ? 'part' : 'todo';
  const stations: Station[] = [
    { key: 'info', title: t('participant'), state: st(infoDoneCount, infoTotal, step === 0 && !!stepErr), done: infoDoneCount, total: infoTotal },
    ...grouped.map((g, gi) => {
      const done = g.items.filter(q => hasAnswer(answers[q.id])).length; const req = g.items.filter(q => q.is_required).length;
      const reqDone = g.items.filter(q => q.is_required && hasAnswer(answers[q.id])).length; const miss = g.items.some(q => missIds.includes(q.id));
      const state: StationState = miss ? 'miss' : (req ? reqDone === req : done === g.items.length) ? 'done' : done > 0 ? 'part' : 'todo';
      return { key: g.key, title: LS(g.key, g.en), state, done, total: g.items.length, optional: req === 0 };
    }),
  ];
  const N = stations.length;
  function stepErrors(i: number): string | '' {
    if (i === 0) { const m = infoMissing(); return m.length ? `${t('missingFields')}\n• ${m.join('\n• ')}` : (!qLoading && programId && !templateId ? t('noTemplate') : ''); }
    const g = grouped[i - 1]; if (!g) return '';
    const miss = g.items.filter(q => q.is_required && !hasAnswer(answers[q.id]));
    if (miss.length) { setMissIds(m => Array.from(new Set([...m, ...miss.map(q => q.id)]))); return `${t('missingQs')}\n${miss.map(q => `• ${LQ(q)}`).join('\n')}`; }
    return '';
  }
  function go(i: number) { setStepErr(''); setStep(i); setReached(r => Math.max(r, i)); }
  function next() { const err = stepErrors(step); if (err) { setStepErr(err); return; } if (step === 0 && (qLoading || !questions.length)) { setStepErr(qLoading ? t('loading') : t('noTemplate')); return; } go(Math.min(N - 1, step + 1)); }
  function prev() { setStepErr(''); setStep(s => Math.max(0, s - 1)); }
  const scaleLabel = (q: Q, v: number) => q.kind === 'LIKERT_5' && kind === 'end' ? (lang === 'fr' ? LIKERT_FR : lang === 'en' ? LIKERT_EN : LIKERT_AR)[5 - v] : lang === 'fr' ? SCALE_FR[v] : SCALE_LABELS[v]?.[lang === 'en' ? 1 : 0];

  return shell(<>
    {lockCard}
    {message && <div className={`fl-msg${message.startsWith('⚠️') ? ' warn' : ' bad'}`}><Icon name="alert" size={16} /><span>{message.replace(/^⚠️\s*/, '')}</span></div>}
    {/* هـ-3 ن: شريط المحطّات — محطّة لكل قسم: مكتمل/جارٍ/لم يبدأ/ينقصه إلزامي (WCAG 2.4 التنقّل · 3.3.1 تحديد الخطأ) */}
    {N > 1 && <Stations lang={lang} stations={stations} index={step} reached={reached} onGo={go} testid="ev-journey" chipTestid="ev-jchip" />}

    {step === 0 && (
      <StepCard lang={lang} n={1} title={t('participant')} hint={t(kind === 'end' ? 'introEnd' : 'intro')} id="sec-info" miss={!!stepErr}>
        <div className="fl-grid">
          {field(t('name'), kind !== 'end', <input value={info.full_name} onChange={e => setInfo({ ...info, full_name: e.target.value })} autoComplete="name" />)}
          {field(t('email'), true, <><input type="email" dir="ltr" placeholder="name@example.com" value={info.email} onChange={e => { setInfo({ ...info, email: e.target.value }); if (dupEmail) setDupEmail(null); }} onBlur={e => void checkEmailEarly(e.target.value)} autoComplete="email" aria-invalid={!!dupEmail} data-testid="ev-email" />{dupEmail && <small className="ev-dup" role="alert" data-testid="ev-dup" style={{ color: '#9A3A2A' }}>⚠️ {kind === 'daily' ? t('dupDaily') : kind === 'end' ? t('dupEnd') : t('dupFinal')}</small>}</>)}
          {field(t('phone'), kind !== 'end', <div className="ev-phone" dir="ltr">
            <select value={info.country_dial} onChange={e => setInfo({ ...info, country_dial: e.target.value })} aria-label="Country code">{COUNTRIES.map(c => <option key={c[0] + c[1]} value={c[0]}>{c[0]} · {lang === 'ar' ? c[1] : c[2]}</option>)}</select>
            <input inputMode="numeric" placeholder="5xxxxxxxx" value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value.replace(/[^\d]/g, '') })} autoComplete="tel-national" />
          </div>)}
          {field(t('nationality'), false, <input value={info.nationality} onChange={e => setInfo({ ...info, nationality: e.target.value })} />)}
          {field(t('gender'), kind !== 'end', <div className="fl-pills">{[['ذكر', t('male')], ['أنثى', t('female')]].map(([v, l]) => <button type="button" key={v} className={`fl-pill ${info.gender === v ? 'on' : ''}`} onClick={() => setInfo({ ...info, gender: v })}><span className="fl-k">{info.gender === v && <Icon name="check" size={12} />}</span>{l}</button>)}</div>)}
          {kind === 'final' && field(t('accommodation'), !link, <select value={info.accommodation_type} onChange={e => setInfo({ ...info, accommodation_type: e.target.value })}>
            <option value="">{t('choose')}</option><option value="فندق المنار">{lang === 'ar' ? 'فندق المنار' : 'Al-Manar Hotel'}</option><option value="شقق الإسكان العزيزية">{lang === 'ar' ? 'شقق الإسكان العزيزية' : 'Al-Aziziyah Housing'}</option><option value="سكن خاص">{lang === 'ar' ? 'سكن خاص' : 'Private accommodation'}</option>
          </select>)}
          {!link && field(t('program'), true, <select data-testid="ev-program" value={programId} onChange={e => setProgramId(e.target.value)}><option value="">{t('choose')}</option>{programs.map(p => <option key={p.id} value={p.id}>{L(p.name_ar, p.name_en)}</option>)}</select>)}
          {!link && kind === 'daily' && field(t('classroom'), true, <select value={classroomId} onChange={e => setClassroomId(e.target.value)}><option value="">{t('choose')}</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.section_name ? `${c.code} · ${c.section_name}` : c.code}</option>)}</select>)}
          {link && classrooms.length > 1 && field(t('section'), kind === 'daily', <select data-testid="ev-link-rooms" value={classroomId} onChange={e => setClassroomId(e.target.value)}><option value="">{t('choose')}</option>{classrooms.map(c => <option key={c.id} value={c.id}>{c.section_name ? `${c.code} · ${c.section_name}` : c.code}</option>)}</select>)}
        </div>
        {qLoading && programId && <p className="fl-hint" style={{ marginTop: 12 }}>{t('loading')}</p>}
        {!qLoading && programId && !templateId && <div className="fl-msg warn" style={{ marginTop: 12 }}><Icon name="alert" size={16} /><span>{t('noTemplate')}</span></div>}
        <p className="fl-hint" style={{ margin: '14px 0 0' }}><Icon name="shield" size={12} /> {t('privacy')}</p>
      </StepCard>
    )}

    {step > 0 && grouped[step - 1] && (() => { const g = grouped[step - 1]; const gi = step - 1; return (
      <StepCard lang={lang} n={gi + 2} title={LS(g.key, g.en)} optional={!g.items.some(q => q.is_required)} hint={`${g.items.length} ${t('questions')}`} id={`sec-${gi}`} miss={!!stepErr}>
        {g.items.map(q => {
          const miss = missIds.includes(q.id); const val = answers[q.id];
          return (
            <div key={q.id} id={`q-${q.id}`} className={`fl-q${miss ? ' miss' : ''}`}>
              <div className="fl-qt"><span className="fl-qn">{questions.indexOf(q) + 1}</span><span>{LQ(q)}{q.is_required && <span className="fl-req" title={t('required')}> *</span>}</span></div>
              {lang === 'ar' && q.text_en && <div className="fl-qen" dir="ltr">{q.text_en}</div>}
              {RATING_KINDS.includes(q.kind) && (
                <div className="fl-scale" style={{ gridTemplateColumns: `repeat(${q.max_value || 5}, minmax(0,1fr))` }} role="radiogroup">
                  {(q.kind === 'LIKERT_5' && kind === 'end' ? [5, 4, 3, 2, 1] : Array.from({ length: q.max_value || 5 }, (_, i) => i + 1)).map(v => (
                    <button key={v} type="button" role="radio" className={val === String(v) ? 'on' : ''} onClick={() => { set(q.id, String(v)); setStepErr(''); }} aria-checked={val === String(v)}>
                      {q.kind === 'STARS' ? <Icon name="star" size={14} /> : null}<b>{v}</b>{(q.max_value || 5) === 5 && <small>{scaleLabel(q, v)}</small>}
                    </button>
                  ))}
                  {(q.max_value || 5) === 5 && <div className="fl-legend" aria-hidden="true"><small>1 = {scaleLabel(q, 1)}</small><small>5 = {scaleLabel(q, 5)}</small></div>}
                </div>
              )}
              {q.kind === 'NPS_10' && (
                <div className="fl-nps" data-testid="ev-nps">
                  {Array.from({ length: NPS_MAX - NPS_MIN + 1 }, (_, i) => NPS_MIN + i).map(v => <button key={v} type="button" className={val === String(v) ? 'on' : ''} onClick={() => { set(q.id, String(v)); setStepErr(''); }} aria-pressed={val === String(v)}>{v}</button>)}
                  <div className="fl-nps-l"><small>{t('npsLow')}</small><small>{t('npsHigh')}</small></div>
                </div>
              )}
              {['SINGLE_CHOICE', 'YES_NO'].includes(q.kind) && (
                <div className="fl-pills" role="radiogroup">
                  {(q.kind === 'YES_NO' ? ['نعم', 'لا'] : q.options).map(o => <button key={o} type="button" role="radio" aria-checked={val === o} className={`fl-pill ${val === o ? 'on' : ''}`} onClick={() => { set(q.id, o); setStepErr(''); }}><span className="fl-k">{val === o && <Icon name="check" size={12} />}</span>{q.kind === 'YES_NO' ? (o === 'نعم' ? t('yes') : t('no')) : LO(o)}</button>)}
                </div>
              )}
              {q.kind === 'MULTI_CHOICE' && (
                <div className="fl-pills">
                  {q.options.map(o => { const on = Array.isArray(val) && val.includes(o); return <button key={o} type="button" className={`fl-pill multi ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => { toggleMulti(q.id, o); setMissIds(m => m.filter(i => i !== q.id)); setStepErr(''); }}><span className="fl-k">{on && <Icon name="check" size={12} />}</span>{LO(o)}</button>; })}
                </div>
              )}
              {q.kind === 'SHORT_TEXT' && <input className="fl-text" placeholder={t('writeHere')} value={val || ''} onChange={e => set(q.id, e.target.value)} />}
              {q.kind === 'LONG_TEXT' && <textarea className="fl-text" rows={4} placeholder={t('writeHere')} value={val || ''} onChange={e => set(q.id, e.target.value)} />}
            </div>
          );
        })}
      </StepCard>
    ); })()}

    <FlowNav lang={lang} index={step} count={N} onPrev={prev} onNext={next} onSubmit={() => void submit()} saving={saving} first={step === 0} last={N > 1 && step === N - 1}
      submitLabel={t('submit')} error={stepErr || undefined} />
  </>, { langs: step === 0 ? langButtons : false });
}

const CSS = `
.ev-phone{display:flex;gap:6px}.ev-phone select{flex:0 0 150px}.ev-phone input{flex:1}
.fl-step{scroll-margin-top:120px}
`;
