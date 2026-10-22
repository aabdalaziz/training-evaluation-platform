'use client';
/**
 * /evaluate/daily و /evaluate/final — استبيان المتدرب (ضيف بلا تسجيل دخول)
 * الهوية البصرية الموحّدة (نفس أسلوب نموذج قياس الأثر): شعارات، ترويسة، أقسام مرقّمة، مقياس 1–5 بتسميات، عربي/إنجليزي.
 * منطق الحفظ كما هو: منع التكرار (اليومي: نفس البريد + القاعة + اليوم / النهائي: نفس البريد + البرنامج)، ثم evaluations + evaluation_answers.
 * يدعم ?program=<id>&classroom=<id> لاختيار البرنامج/القاعة مسبقًا (روابط بوابة المتدرب وQR).
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';

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
  kicker: ['منصة تقويم البرامج التدريبية', 'Training Evaluation Platform'],
  intro: ['رأيك يساعدنا على تطوير جودة البرامج. الحقول المعلَّمة بـ * إلزامية، وتستغرق التعبئة نحو 3 دقائق.', 'Your feedback helps us improve program quality. Fields marked * are required; this takes about 3 minutes.'],
  participant: ['بيانات المشارك', 'Participant information'], name: ['الاسم الكامل الثلاثي', 'Full name'], email: ['البريد الإلكتروني', 'Email address'], phone: ['رقم الجوال', 'Mobile number'],
  nationality: ['الجنسية', 'Nationality'], gender: ['النوع الاجتماعي', 'Gender'], male: ['ذكر', 'Male'], female: ['أنثى', 'Female'], choose: ['— اختر —', '— Select —'],
  accommodation: ['مكان الإقامة أثناء البرنامج', 'Accommodation during the program'], program: ['البرنامج التدريبي', 'Training program'], classroom: ['القاعة الدراسية', 'Classroom'], room: ['قاعة', 'Room'],
  noTemplate: ['لا يوجد قالب تقييم مفعّل لهذا البرنامج حاليًا — تواصل مع إدارة البرنامج.', 'No active evaluation template for this program yet — please contact the program office.'],
  loading: ['جارٍ تجهيز الاستبيان…', 'Preparing the form…'], submit: ['إرسال التقييم', 'Submit evaluation'], sending: ['جارٍ الإرسال…', 'Sending…'],
  privacy: ['تُستخدم بياناتك لأغراض الجودة فقط وتُعرض النتائج بشكل مجمّع.', 'Your data is used for quality purposes only; results are reported in aggregate.'],
  missingFields: ['يرجى استكمال الحقول التالية:', 'Please complete the following fields:'], missingQs: ['يرجى الإجابة عن الأسئلة الإلزامية التالية:', 'Please answer the following required questions:'],
  dupDaily: ['سجلاتنا توضح أنك قيّمت هذه الجلسة اليوم مسبقًا — شكرًا لك.', 'Our records show you already evaluated this session today — thank you.'],
  dupFinal: ['لقد قدّمت التقييم النهائي لهذا البرنامج مسبقًا — شكرًا لك.', 'You have already submitted the final evaluation for this program — thank you.'],
  thanks: ['شكرًا لك! تم استلام تقييمك', 'Thank you! Your evaluation was received'],
  thanksBody: ['ملاحظاتك تساعدنا في تطوير جودة البرامج التدريبية.', 'Your feedback helps us improve the quality of our training programs.'],
  writeHere: ['اكتب إجابتك هنا…', 'Write your answer here…'], general: ['التقييم العام', 'General'], yes: ['نعم', 'Yes'], no: ['لا', 'No'], required: ['إلزامي', 'Required'], another: ['تقييم آخر', 'Submit another'],
  progress: ['أجبت عن', 'Answered'], of: ['من', 'of'], questions: ['سؤالًا', 'questions'],
} as const;

export default function GuestEvaluationPage() {
  const params = useParams();
  const kind = params.kind === 'final' ? 'final' : 'daily';
  const db = supabase();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const t = (k: keyof typeof STR) => STR[k][lang === 'en' ? 1 : 0];
  const dir = lang === 'en' ? 'ltr' : 'rtl';

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
  const [preClassroom, setPreClassroom] = useState('');

  useEffect(() => {
    let on = true;
    (async () => {
      const sp = new URLSearchParams(window.location.search);
      const preP = sp.get('program') || ''; setPreClassroom(sp.get('classroom') || '');
      if (sp.get('lang') === 'en') setLang('en');
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
        const { data: templates } = await db.from('evaluation_templates').select('id, kind').in('id', tIds).eq('kind', kind === 'daily' ? 'DAILY' : 'FINAL');
        activeTemplateId = (templates as any[])?.[0]?.id || null;
      }
      if (!on) return;
      if (!activeTemplateId) { setQLoading(false); return; }
      setTemplateId(activeTemplateId);
      const [qRes, cRes] = await Promise.all([
        db.from('questions').select('*').eq('template_id', activeTemplateId).order('order_index'),
        db.from('classrooms').select('id,code,level').eq('program_id', programId).order('code'),
      ]);
      if (!on) return;
      setQuestions(((qRes.data || []) as any[]).map(item => ({ ...item, options: Array.isArray(item.options) ? item.options : [] })));
      const rooms = (cRes.data || []) as any[]; setClassrooms(rooms);
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
  const L = (ar: string | null | undefined, en?: string | null) => (lang === 'en' && en ? en : (ar || ''));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!info.full_name.trim()) missing.push(t('name'));
    if (!info.email.trim()) missing.push(t('email'));
    const digits = (info.phone || '').replace(/\D/g, '');
    if (!info.phone.trim() || digits.length < 7) missing.push(t('phone'));
    if (!info.gender) missing.push(t('gender'));
    if (kind === 'final' && !info.accommodation_type) missing.push(t('accommodation'));
    if (kind === 'daily' && !classroomId) missing.push(t('classroom'));
    if (missing.length) { setMessage(`${t('missingFields')}\n• ${missing.join('\n• ')}`); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const requiredMissing = questions.filter(q => q.is_required && !hasAnswer(answers[q.id]));
    if (requiredMissing.length) {
      setMissIds(requiredMissing.map(q => q.id));
      setMessage(`${t('missingQs')}\n${requiredMissing.map(q => `• ${L(q.text_ar, q.text_en)}`).join('\n')}`);
      document.getElementById(`q-${requiredMissing[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    setSaving(true); setMessage('');
    try {
      const guestEmail = info.email.trim().toLowerCase();
      const fullPhone = `${info.country_dial}${digits}`;
      const ratings = ratingQuestions.map(q => Number(answers[q.id])).filter(x => !isNaN(x) && x > 0);
      const today = new Date().toISOString().slice(0, 10);
      let dup = db.from('evaluations').select('id').eq('program_id', programId).eq('guest_email', guestEmail).eq('kind', kind === 'daily' ? 'DAILY' : 'FINAL');
      if (kind === 'daily') dup = dup.eq('classroom_id', classroomId).eq('evaluation_date', today);
      const { data: existing } = await dup.maybeSingle();
      if (existing) { setSaving(false); setMessage(`⚠️ ${kind === 'daily' ? t('dupDaily') : t('dupFinal')}`); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      const { data: ev, error } = await db.from('evaluations').insert({
        program_id: programId, template_id: templateId, trainee_id: null, guest_email: guestEmail, guest_name: info.full_name.trim(), guest_phone: fullPhone, guest_gender: info.gender,
        accommodation_type: kind === 'final' ? info.accommodation_type : null, classroom_id: kind === 'daily' ? classroomId : null, kind: kind === 'daily' ? 'DAILY' : 'FINAL', evaluation_date: today,
        overall_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      } as any).select('id').single();
      if (error || !ev) throw error || new Error('تعذر حفظ التقييم');
      const rows = questions.map(q => {
        const value = answers[q.id] || '';
        return {
          evaluation_id: (ev as any).id, question_id: q.id,
          rating_value: RATING_KINDS.includes(q.kind) ? Number(value) || null : null,
          selected_option: ['SINGLE_CHOICE', 'YES_NO'].includes(q.kind) ? value || null : null,
          selected_options: q.kind === 'MULTI_CHOICE' ? (Array.isArray(value) ? value : []) : [],
          text_value: ['SHORT_TEXT', 'LONG_TEXT'].includes(q.kind) ? value || null : null,
        };
      });
      const { error: answerError } = await db.from('evaluation_answers').insert(rows as any);
      if (answerError) throw answerError;
      setIsSuccess(true); window.scrollTo({ top: 0 });
    } catch (err: any) { setMessage(err?.message || 'حدث خطأ غير متوقع'); }
    finally { setSaving(false); }
  }

  const program = programs.find(p => p.id === programId);
  const shell = (child: React.ReactNode) => <main className="ev" dir={dir}><style>{CSS}</style><div className="ev-wrap">{child}</div></main>;
  const header = (
    <header className="ev-card ev-head">
      <div className="ev-logos"><img src="/logos/upm.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /><img src="/logos/gate.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
      <div className="ev-kicker"><Icon name={kind === 'daily' ? 'calendar' : 'flag'} size={14} /> {t('kicker')}</div>
      <h1>{kind === 'daily' ? t('dailyTitle') : t('finalTitle')}</h1>
      {program && <div className="ev-prog"><Icon name="book" size={14} /> {L(program.name_ar, program.name_en)}</div>}
      <p className="ev-intro">{t('intro')}</p>
      <div className="ev-langs"><button type="button" className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button><button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button></div>
    </header>
  );

  if (loading) return shell(<div className="ev-card ev-center ev-muted">{t('loading')}</div>);
  if (isSuccess) return shell(<>
    {header}
    <section className="ev-card ev-center">
      <div className="ev-ok"><Icon name="check" size={34} /></div>
      <h2>{t('thanks')}</h2>
      <p className="ev-muted" style={{ fontSize: 14 }}>{t('thanksBody')}</p>
      <button type="button" className="ev-btn ghost" onClick={() => { setIsSuccess(false); setAnswers({}); setInfo(i => ({ ...i, full_name: '', email: '', phone: '' })); }}><Icon name="refresh" size={14} /> {t('another')}</button>
    </section>
  </>);

  const field = (label: string, required: boolean, control: React.ReactNode, span?: boolean) => <label className={`ev-field${span ? ' span' : ''}`}><span>{label}{required && <span className="ev-req"> *</span>}</span>{control}</label>;

  return shell(<>
    {header}
    <form onSubmit={submit} className="ev-form" noValidate>
      {message && <div className={`ev-msg${message.startsWith('⚠️') ? ' warn' : ' bad'}`}><Icon name="alert" size={16} /><span>{message.replace(/^⚠️\s*/, '')}</span></div>}

      <section className="ev-card">
        <h2><span className="ev-n">1</span>{t('participant')}</h2>
        <div className="ev-grid">
          {field(t('name'), true, <input value={info.full_name} onChange={e => setInfo({ ...info, full_name: e.target.value })} autoComplete="name" />)}
          {field(t('email'), true, <input type="email" dir="ltr" placeholder="name@example.com" value={info.email} onChange={e => setInfo({ ...info, email: e.target.value })} autoComplete="email" />)}
          {field(t('phone'), true, <div className="ev-phone" dir="ltr">
            <select value={info.country_dial} onChange={e => setInfo({ ...info, country_dial: e.target.value })} aria-label="Country code">{COUNTRIES.map(c => <option key={c[0] + c[1]} value={c[0]}>{c[0]} · {lang === 'en' ? c[2] : c[1]}</option>)}</select>
            <input inputMode="numeric" placeholder="5xxxxxxxx" value={info.phone} onChange={e => setInfo({ ...info, phone: e.target.value.replace(/[^\d]/g, '') })} autoComplete="tel-national" />
          </div>)}
          {field(t('nationality'), false, <input value={info.nationality} onChange={e => setInfo({ ...info, nationality: e.target.value })} />)}
          {field(t('gender'), true, <div className="ev-seg">{[['ذكر', t('male')], ['أنثى', t('female')]].map(([v, l]) => <button type="button" key={v} className={info.gender === v ? 'on' : ''} onClick={() => setInfo({ ...info, gender: v })}>{l}</button>)}</div>)}
          {kind === 'final' && field(t('accommodation'), true, <select value={info.accommodation_type} onChange={e => setInfo({ ...info, accommodation_type: e.target.value })}>
            <option value="">{t('choose')}</option><option value="فندق المنار">{lang === 'en' ? 'Al-Manar Hotel' : 'فندق المنار'}</option><option value="شقق الإسكان العزيزية">{lang === 'en' ? 'Al-Aziziyah Apartments' : 'شقق الإسكان العزيزية'}</option><option value="إقامة أخرى">{lang === 'en' ? 'Other accommodation' : 'إقامة أخرى'}</option>
          </select>)}
          {field(t('program'), true, <select value={programId} onChange={e => setProgramId(e.target.value)}><option value="">{t('choose')}</option>{programs.map(p => <option key={p.id} value={p.id}>{L(p.name_ar, p.name_en)}</option>)}</select>, kind === 'final')}
          {kind === 'daily' && field(t('classroom'), true, <select value={classroomId} onChange={e => setClassroomId(e.target.value)}><option value="">{t('choose')}</option>{classrooms.map(c => <option key={c.id} value={c.id}>{t('room')} {c.code}{c.level ? ` (${c.level})` : ''}</option>)}</select>)}
        </div>
      </section>

      {qLoading && <div className="ev-card ev-center ev-muted">{t('loading')}</div>}
      {!qLoading && programId && !templateId && <div className="ev-msg warn"><Icon name="alert" size={16} /><span>{t('noTemplate')}</span></div>}

      {grouped.map((g, gi) => (
        <section key={g.key} className="ev-card">
          <h2><span className="ev-n">{gi + 2}</span>{L(g.key, g.en)}<span className="ev-count">{g.items.length}</span></h2>
          {g.items.map(q => {
            const miss = missIds.includes(q.id); const val = answers[q.id];
            return (
              <div key={q.id} id={`q-${q.id}`} className={`ev-q${miss ? ' miss' : ''}`}>
                <div className="ev-qt"><span className="ev-qn">{questions.indexOf(q) + 1}</span><span>{L(q.text_ar, q.text_en)}{q.is_required && <span className="ev-req" title={t('required')}> *</span>}</span></div>
                {lang === 'ar' && q.text_en && <div className="ev-qen">{q.text_en}</div>}
                {RATING_KINDS.includes(q.kind) && (
                  <div className="ev-scale" style={{ gridTemplateColumns: `repeat(${q.max_value || 5}, minmax(0,1fr))` }}>
                    {Array.from({ length: q.max_value || 5 }, (_, i) => i + 1).map(v => (
                      <button key={v} type="button" className={val === String(v) ? 'on' : ''} onClick={() => set(q.id, String(v))} aria-pressed={val === String(v)}>
                        {q.kind === 'STARS' ? <Icon name="star" size={14} /> : null}<b>{v}</b>{(q.max_value || 5) === 5 && <small>{SCALE_LABELS[v][lang === 'en' ? 1 : 0]}</small>}
                      </button>
                    ))}
                  </div>
                )}
                {['SINGLE_CHOICE', 'YES_NO'].includes(q.kind) && (
                  <div className="ev-opts">
                    {(q.kind === 'YES_NO' ? ['نعم', 'لا'] : q.options).map(o => <button key={o} type="button" className={val === o ? 'on' : ''} onClick={() => set(q.id, o)}><span className="ev-k">{val === o ? <Icon name="check" size={13} /> : ''}</span>{q.kind === 'YES_NO' ? (o === 'نعم' ? t('yes') : t('no')) : o}</button>)}
                  </div>
                )}
                {q.kind === 'MULTI_CHOICE' && (
                  <div className="ev-opts">
                    {q.options.map(o => { const on = Array.isArray(val) && val.includes(o); return <button key={o} type="button" className={on ? 'on' : ''} onClick={() => { toggleMulti(q.id, o); setMissIds(m => m.filter(i => i !== q.id)); }}><span className="ev-k sq">{on ? <Icon name="check" size={13} /> : ''}</span>{o}</button>; })}
                  </div>
                )}
                {q.kind === 'SHORT_TEXT' && <input className="ev-text" placeholder={t('writeHere')} value={val || ''} onChange={e => set(q.id, e.target.value)} />}
                {q.kind === 'LONG_TEXT' && <textarea className="ev-text" rows={4} placeholder={t('writeHere')} value={val || ''} onChange={e => set(q.id, e.target.value)} />}
              </div>
            );
          })}
        </section>
      ))}

      {questions.length > 0 && (
        <section className="ev-card ev-submit">
          <div className="ev-progress"><div className="ev-bar"><i style={{ width: `${Math.round(100 * answered / Math.max(1, questions.length))}%` }} /></div><small className="ev-muted">{t('progress')} {answered} {t('of')} {questions.length} {t('questions')}</small></div>
          <button className="ev-btn" disabled={saving}><Icon name="send" size={16} /> {saving ? t('sending') : t('submit')}</button>
          <small className="ev-muted"><Icon name="shield" size={12} /> {t('privacy')}</small>
        </section>
      )}
    </form>
  </>);
}

const CSS = `
.ev{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:18px 12px 60px;color:#0f172a}
.ev-wrap{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.ev-form{display:flex;flex-direction:column;gap:12px}
.ev-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px}
.ev-head{border-top:5px solid #c9a24b}
.ev-logos{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}.ev-logos img{height:46px;object-fit:contain}
.ev-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.ev-head h1{margin:4px 0;font-size:22px;color:#0f2a4e}
.ev-prog{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#0f2a4e;background:#e8eef7;border-radius:999px;padding:4px 12px;margin:2px 0 4px}
.ev-intro{margin:8px 0 0;font-size:13.5px;line-height:1.8;color:#334155;background:#f8fafc;border-radius:10px;padding:10px 12px}
.ev-muted{color:#64748b;font-size:12.5px;font-weight:700;margin:0;display:inline-flex;align-items:center;gap:5px}
.ev-langs{display:flex;gap:6px;margin-top:10px}.ev-langs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:#0f2a4e}.ev-langs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.ev-card h2{margin:0 0 12px;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:8px}
.ev-n{width:26px;height:26px;border-radius:8px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-size:13px;flex-shrink:0}
.ev-count{margin-inline-start:auto;font-size:11.5px;font-weight:800;color:#64748b;background:#f1f5f9;border-radius:999px;padding:2px 10px}
.ev-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
.ev-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:800;color:#334155}.ev-field.span{grid-column:1/-1}.ev-req{color:#b91c1c}
.ev-field input,.ev-field select,.ev-text{border:1px solid #cbd5e1;border-radius:10px;padding:10px 11px;font:inherit;font-size:14px;font-weight:700;color:#0f172a;background:#fff;width:100%;min-height:42px}
.ev-field input:focus,.ev-field select:focus,.ev-text:focus{outline:none;border-color:#0b8a83;box-shadow:0 0 0 3px rgba(11,138,131,.16)}
.ev-phone{display:flex;gap:6px}.ev-phone select{width:150px;flex-shrink:0}.ev-phone input{flex:1}
.ev-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ev-seg button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:10px;font:inherit;font-size:13.5px;font-weight:800;color:#0f172a;cursor:pointer;min-height:42px}.ev-seg button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.ev-msg{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;font-size:13.5px;font-weight:800;white-space:pre-line;line-height:1.8}
.ev-msg.bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.ev-msg.warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}.ev-msg svg{flex-shrink:0;margin-top:4px}
.ev-q{border-top:1px solid #f1f5f9;padding:14px 0}.ev-q:first-of-type{border-top:0}
.ev-q.miss{background:#fff7ed;border-radius:10px;padding:12px;outline:1px solid #fed7aa;margin:6px 0}
.ev-qt{display:flex;gap:8px;align-items:flex-start;font-size:14.5px;font-weight:800;color:#0f172a;margin-bottom:8px;line-height:1.7}
.ev-qn{min-width:24px;height:24px;border-radius:999px;background:#eef2f7;color:#0f2a4e;display:grid;place-items:center;font-size:12px;flex-shrink:0;margin-top:2px}
.ev-qen{font-size:12.5px;color:#64748b;font-weight:700;direction:ltr;text-align:left;margin:-4px 0 8px 32px}
.ev-scale{display:grid;gap:6px}
.ev-scale button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;cursor:pointer;color:#0f172a;min-height:54px;justify-content:center}
.ev-scale button b{font-size:16px}.ev-scale button small{font-size:10.5px;font-weight:700;color:#64748b}
.ev-scale button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ev-scale button.on small{color:#cbd5e1}
.ev-opts{display:flex;flex-wrap:wrap;gap:6px}
.ev-opts button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 12px 8px 10px;display:flex;gap:8px;align-items:center;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;color:#0f172a;text-align:start}
.ev-k{width:20px;height:20px;border-radius:999px;border:1.5px solid #cbd5e1;display:grid;place-items:center;flex-shrink:0;color:#fff}.ev-k.sq{border-radius:6px}
.ev-opts button.on{background:#ecfdf5;border-color:#0b8a83;color:#065f46}.ev-opts button.on .ev-k{background:#0b8a83;border-color:#0b8a83}
.ev-submit{display:flex;flex-direction:column;gap:10px;align-items:center}
.ev-progress{width:100%;display:flex;flex-direction:column;gap:4px;align-items:center}
.ev-bar{width:100%;height:8px;background:#eef2f7;border-radius:999px;overflow:hidden}.ev-bar i{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#0f2a4e);border-radius:999px;transition:width .25s}
.ev-btn{display:inline-flex;align-items:center;gap:8px;background:#0f2a4e;color:#fff;border:0;border-radius:12px;padding:13px 28px;font:inherit;font-size:15px;font-weight:900;cursor:pointer;min-width:240px;justify-content:center}.ev-btn:disabled{opacity:.5;cursor:not-allowed}
.ev-btn.ghost{background:#fff;color:#0f2a4e;border:1px solid #cbd5e1;margin-top:10px;min-width:0;padding:10px 18px;font-size:13.5px}
.ev-center{text-align:center;padding:36px 20px}.ev-center h2{justify-content:center;margin-top:10px}
.ev-ok{width:64px;height:64px;border-radius:999px;background:#ecfdf5;color:#047857;display:grid;place-items:center;margin:0 auto 10px}
@media(max-width:620px){.ev-grid{grid-template-columns:1fr}.ev-scale button small{display:none}.ev-phone select{width:118px}.ev-card{padding:14px}.ev-qen{margin-left:0}}
`;
