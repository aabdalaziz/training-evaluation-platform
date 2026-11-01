'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مِعيار — من أَثَر» — تجربة المتقدّم كاملة في مكوّن واحد (م1):
 *  المقدّمة (30 لغة — قاموس مِعيار حرفيًا من /miaar/copy.json) → التسجيل (+«احتياجاتي») → «مِسبار» (5 بنود تحدّد نقطة البداية)
 *  → الاختبار (قراءة · استماع · قواعد؛ بنود mcq/مصوّرة/صواب-خطأ؛ مؤقّت؛ تأجيل؛ اختصارات) → المراجعة → «بطاقة المستوى» (أستطيع أن… · ميزان الثقة · رمز نتيجة · باركود · طباعة).
 *  التصحيح كله على الخادم (/api/miaar). هوية مِعيار اللونية (أخضر صنوبري + ذهبي + رملي) سمةُ منتج داخل أَثَر.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { qrSvg } from '../../lib/certificates/qr';
import { CAN_DO, LEVEL_AR, LEVELS, SKILLS } from '../../lib/miaar/registry';
import type { Level } from '../../lib/miaar/registry';

type Copy = Record<string, Record<string, Record<string, string>>> & { langs?: { id: string; name: string; find: string }[]; native?: { value: string; labels: Record<string, string> }[] };
type Q = { id: string; level: Level; skill: string; type: string; passageId: string | null; questionText: string; options: { id: string; text: string; image?: string | null; alt?: string | null }[]; stimulus: { image: string | null; alt: string | null } | null };
type P = { id: string; level: string; skill: string; title: string; text: string; audioUrl: string | null };
type Session = { examMode: 'comprehensive' | 'adaptive'; currentLevel: Level; currentLevelIndex: number; startLevelIndex: number; direction: 'up' | 'down'; status: string; finishReason: string | null; expiresAt: string; remainingSeconds: number; durationSeconds: number; access: any; answers: Record<string, string>; form: { questions: Q[]; passages: P[] } | null };
type Invite = { code: string; kind: 'group' | 'personal'; label_ar: string; lang: string; exam_mode: 'adaptive' | 'comprehensive'; purpose: string | null; expires_at: string | null; recipient: { id: string; email: string; name: string | null; used: boolean } | null };
type Step = 'loading' | 'intro' | 'register' | 'probe' | 'test' | 'review' | 'result' | 'blocked';
type Props = { inviteCode?: string | null; inviteToken?: string | null; resultCode?: string | null };

const RTL = new Set(['ar', 'ur', 'fa', 'ps', 'ku']);
const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و']; const EN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PURPOSE = [['دراسة', 'study'], ['عمل', 'work'], ['سفر', 'travel'], ['شخصي', 'personal'], ['أخرى', 'other']] as const;
const SAMPLES: Record<Level, string> = { A1: 'أنا من الولايات المتحدة الأمريكية.', A2: 'أريد تذكرة إلى جدة يوم الخميس، من فضلك.', B1: 'سافرت إلى القاهرة في الصيف الماضي، وكانت الرحلة مفيدة.', B2: 'قد يكون التأخير بسبب الزحام، وقد يكون بسبب عطل في القطار.', C1: 'لم يكن الإشكال في قلة الوقت، بل في أن الخطة لم تُراجَع قبل الاجتماع.', C2: 'قال إن الأمر بخير، غير أن طريقة كلامه أوحت بغير ذلك.' };
/** نصوص م1 الجديدة (عربية/إنجليزية؛ بقية اللغات تأخذ الإنجليزية) */
const X: Record<string, { ar: string; en: string }> = {
  product: { ar: 'مِعيار — من أَثَر', en: 'Mi’yar — by Athar' }, athar: { ar: 'بوابة أَثَر', en: 'Athar gateway' }, back_home: { ar: 'إلى أَثَر', en: 'Athar home' },
  invite_for: { ar: 'دعوة', en: 'Invitation' }, invite_bad: { ar: 'هذه الدعوة غير صالحة أو انتهت أو استُهلكت. تواصل مع الجهة التي أرسلتها.', en: 'This invitation is invalid, expired or already used. Contact the organisation that sent it.' },
  access_k: { ar: 'احتياجاتي', en: 'My needs' }, access_h: { ar: 'تُطلب بلا إثبات وتُسجَّل في التقرير بسطر محايد.', en: 'Requested without proof; noted neutrally in the report.' },
  access_time: { ar: 'وقت إضافي', en: 'Extra time' }, access_none: { ar: 'بلا', en: 'None' }, access_simple: { ar: 'تعليمات أبسط', en: 'Simpler instructions' }, access_contrast: { ar: 'تباين عالٍ', en: 'High contrast' }, access_large: { ar: 'خطّ أكبر', en: 'Larger text' },
  probe_k: { ar: 'مِسبار', en: 'Probe' }, probe_h: { ar: 'خمسة بنود في دقيقتين تحدّد من أين يبدأ اختبارك.', en: 'Five items in two minutes decide where your test begins.' },
  probe_q: { ar: 'البند {n} من 5', en: 'Item {n} of 5' }, probe_done: { ar: 'سيبدأ اختبارك من مستوى {level} ويتفرّع صعودًا أو نزولًا بحسب إجاباتك.', en: 'Your test will start at level {level} and move up or down with your answers.' },
  probe_start: { ar: 'ابدأ الاختبار', en: 'Start the test' }, probe_skip: { ar: 'تخطَّ المِسبار (يبدأ من A1)', en: 'Skip the probe (start at A1)' },
  level_passed: { ar: 'اجتزت {level} — ننتقل إلى {next}', en: 'You passed {level} — moving to {next}' }, level_down: { ar: 'لم تكتمل {level} — نقيس {next} لنثبّت مستواك', en: '{level} not yet complete — measuring {next} to confirm your level' },
  level_finished: { ar: 'انتهى الاختبار — راجع إجاباتك ثم أكّد النتيجة', en: 'The test is over — review your answers, then confirm' },
  card_k: { ar: 'بطاقة المستوى', en: 'Level card' }, card_entry: { ar: 'مستوى الالتحاق المقترح', en: 'Suggested entry level' }, card_demo: { ar: 'المستوى المثبت', en: 'Demonstrated level' },
  can_do: { ar: 'أستطيع أن…', en: 'I can…' }, next_steps: { ar: 'خطوتي التالية', en: 'My next step' }, conf: { ar: 'ميزان الثقة', en: 'Confidence' },
  conf_high: { ar: 'مؤكَّد', en: 'Confirmed' }, conf_medium: { ar: 'محتمل', en: 'Likely' }, conf_border: { ar: 'على الحدّ — يلزم قرار بشري', en: 'Borderline — a human decision follows' },
  step_programs: { ar: 'برامج العربية في أَثَر عند مستواك', en: 'Athar Arabic programmes at your level' }, step_keep: { ar: 'احتفظ برمز نتيجتك — به تعود إليها وتتحقّق منها الجهة', en: 'Keep your result code — it reopens and verifies your result' },
  step_weak: { ar: 'ركّز على أضعف مهارة أربعة أسابيع ثم أعد التقييم', en: 'Work on your weakest skill for four weeks, then reassess' },
  result_code: { ar: 'رمز النتيجة', en: 'Result code' }, copy_link: { ar: 'نسخ الرابط', en: 'Copy link' }, copied: { ar: 'نُسخ', en: 'Copied' }, nature: { ar: 'توصية تسكين مبدئية — لا شهادة إتقان', en: 'Preliminary placement recommendation — not a proficiency certificate' },
  not_found: { ar: 'لا نتيجة بهذا الرمز.', en: 'No result with this code.' }, loading: { ar: 'جارٍ التحميل…', en: 'Loading…' }, replays_left: { ar: 'إعادات متبقية: {n}', en: 'Replays left: {n}' },
  pre_a1: { ar: 'بداية الطريق — يبدأ من أول A1', en: 'Starting out — begins at the very start of A1' },
  tfng_a: { ar: 'صواب', en: 'True' }, tfng_b: { ar: 'خطأ', en: 'False' }, tfng_c: { ar: 'غير مذكور', en: 'Not given' }, pick_picture: { ar: 'اختر الصورة', en: 'Choose the picture' },
  simple_test: { ar: 'اقرأ أو استمع، ثم اختر إجابة واحدة. الزرّ الكبير ينقلك إلى السؤال التالي.', en: 'Read or listen, then choose one answer. The big button moves to the next question.' },
};

const fill = (s: string, vars: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
function readLang(fallback: string) { try { const v = localStorage.getItem('athar-page-lang'); if (v) return v; } catch { /* */ } return fallback; }

export default function MiaarApp({ inviteCode = null, inviteToken = null, resultCode = null }: Props) {
  const [copy, setCopy] = useState<Copy | null>(null);
  const [lang, setLangState] = useState('en');
  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<Invite | null>(null); const [inviteErr, setInviteErr] = useState(false);
  const [examMode, setExamMode] = useState<'comprehensive' | 'adaptive'>('adaptive');
  const [cand, setCand] = useState({ name: '', email: '', phone: '', nativeLanguage: '', studiedBefore: null as boolean | null, purpose: '' });
  const [access, setAccess] = useState({ time: 1 as 1 | 1.25 | 1.5, simple: false, contrast: false, large: false });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ id: string; level: Level; prompt: string; options: { id: string; text: string }[] }[]>([]); const [probeAns, setProbeAns] = useState<Record<string, string>>({}); const [probeIdx, setProbeIdx] = useState(0); const [probeDone, setProbeDone] = useState(false);
  const [session, setSession] = useState<Session | null>(null); const [answers, setAnswers] = useState<Record<string, string>>({}); const [deferred, setDeferred] = useState<Set<string>>(new Set());
  const [qIdx, setQIdx] = useState(0); const [remaining, setRemaining] = useState(0); const [toast, setToast] = useState(''); const [showEnd, setShowEnd] = useState(false);
  const [report, setReport] = useState<any>(null); const [code, setCode] = useState<string | null>(null); const [resultName, setResultName] = useState(''); const [copied, setCopied] = useState(false);
  const langPicked = useRef(false);

  const dir = RTL.has(lang) ? 'rtl' : 'ltr';
  const t = useCallback((sec: string, key: string, vars?: Record<string, string | number>) => { const s = copy?.[sec]; const v = s?.[lang]?.[key] ?? s?.en?.[key] ?? key; return vars ? fill(v, vars) : v; }, [copy, lang]);
  const x = useCallback((key: string, vars?: Record<string, string | number>) => { const v = (lang === 'ar' ? X[key]?.ar : X[key]?.en) || key; return vars ? fill(v, vars) : v; }, [lang]);
  const setLang = (v: string) => { langPicked.current = true; setLangState(v); try { localStorage.setItem('athar-page-lang', v); } catch { /* */ } };
  const letters = lang === 'ar' ? AR_LETTERS : EN_LETTERS;

  // ---- تحميل القاموس · الدعوة · النتيجة برمزها · استئناف جلسة
  useEffect(() => { (async () => {
    const c = await fetch('/miaar/copy.json', { cache: 'force-cache' }).then((r) => r.json()).catch(() => null); if (!c) { setErr('copy'); return; } setCopy(c);
    let initialLang = readLang(typeof navigator !== 'undefined' && c.intro?.[navigator.language.slice(0, 2)] ? navigator.language.slice(0, 2) : 'en');
    if (resultCode) {
      const r = await fetch(`/api/miaar?result=${encodeURIComponent(resultCode)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (r?.ok) { setReport(r.report); setCode(r.code); setResultName(r.name); setStep('result'); } else { setStep('blocked'); setErr('not_found'); }
      setLangState(initialLang); return;
    }
    if (inviteCode) {
      const r = await fetch(`/api/miaar?invite=${encodeURIComponent(inviteCode)}${inviteToken ? `&t=${encodeURIComponent(inviteToken)}` : ''}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (r?.ok) { setInvite(r.invite); setExamMode(r.invite.exam_mode); if (!langPicked.current && c.intro?.[r.invite.lang]) initialLang = r.invite.lang; if (r.invite.recipient) setCand((v) => ({ ...v, email: r.invite.recipient.email, name: r.invite.recipient.name || v.name })); }
      else { setInviteErr(true); setLangState(initialLang); setStep('blocked'); return; }
    }
    setLangState(initialLang);
    const s = await fetch('/api/miaar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume' }), cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (s?.ok && s.session) {
      if (s.session.status === 'active' && s.session.form) { setSession(s.session); setAnswers(s.session.answers || {}); setStep('test'); return; }
      if (s.session.status !== 'active') { const f = await post({ action: 'finish', reason: 'quit' }); if (f?.ok) { setReport(f.report); setCode(f.access_code); setStep('result'); return; } }
    }
    setStep('intro');
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (typeof document !== 'undefined') { document.documentElement.lang = lang; document.documentElement.dir = dir; } }, [lang, dir]);

  async function post(body: any) { return fetch('/api/miaar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }).then((r) => r.json()).catch(() => null); }

  // ---- المؤقّت
  useEffect(() => {
    if (step !== 'test' || !session) return; const end = new Date(session.expiresAt).getTime();
    const tick = () => { const left = Math.max(0, Math.floor((end - Date.now()) / 1000)); setRemaining(left); if (left === 0) { void doFinish('time'); } };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session?.expiresAt]);
  const alerted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (step !== 'test') return; const m = Math.ceil(remaining / 60); const say = (k: string, vars?: any) => { if (alerted.current.has(k)) return; alerted.current.add(k); setToast(t('test', k, vars)); setTimeout(() => setToast(''), 6000); };
    if (remaining > 0 && m === 15) say('m15'); if (m === 10) say('m10'); if (m === 5) say('m5'); if (m === 2) say('m2'); if (m === 1 && remaining > 0) say('last');
  }, [remaining, step, t]);

  // ---- التسجيل → مِسبار
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (cand.name.trim().length < 2) { setErr(t('register', 'nameErr')); return; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cand.email)) { setErr(t('register', 'emailErr')); return; }
    setBusy(true); const r = await fetch('/api/miaar?probe=1', { cache: 'no-store' }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (!r?.ok) { setErr(t('register', 'errNet')); return; } setProbe(r.items); setProbeAns({}); setProbeIdx(0); setProbeDone(false); setStep('probe');
  }
  async function startTest(withProbe: boolean) {
    setBusy(true); setErr('');
    const r = await post({ action: 'start', candidate: cand, examMode, probeAnswers: withProbe ? probeAns : null, access: access.time !== 1 || access.simple || access.contrast || access.large ? access : null, invite: invite ? { code: invite.code, t: inviteToken || undefined } : undefined });
    setBusy(false);
    if (!r?.ok) { const k = r?.error === 'retake_not_allowed' ? 'errRetake' : r?.error === 'retake_check_failed' ? 'errCheck' : r?.error === 'session_start_failed' || r?.error === 'session_exists' ? 'errSession' : r?.error?.startsWith?.('invite_') ? 'invite' : 'errGeneric'; setErr(k === 'invite' ? x('invite_bad') : t('register', k)); if (k === 'errRetake' || k === 'invite') setStep('register'); return; }
    alerted.current = new Set(); setSession(r.session); setAnswers({}); setDeferred(new Set()); setQIdx(0); setStep('test');
  }

  // ---- الاختبار
  const levelQs = useMemo(() => session?.form ? session.form.questions.filter((q) => q.level === session.currentLevel) : [], [session]);
  const current = levelQs[qIdx] || null;
  const passage = current?.passageId ? session?.form?.passages.find((p) => p.id === current.passageId) || null : null;
  const answeredInLevel = levelQs.filter((q) => answers[q.id]).length;
  async function choose(optionId: string) {
    if (!current || busy) return; setAnswers((a) => ({ ...a, [current.id]: optionId }));
    const r = await post({ action: 'answer', questionId: current.id, selectedOptionId: optionId, finalize: false });
    if (r && !r.ok && (r.error === 'session_expired' || r.error === 'invalid_session')) { setStep('review'); }
  }
  async function next() {
    if (!current) return;
    const unanswered = levelQs.findIndex((q, i) => i !== qIdx && !answers[q.id]);
    if (!answers[current.id]) { if (unanswered >= 0) { setQIdx(unanswered); } return; }
    if (unanswered >= 0) { setQIdx(unanswered > qIdx ? unanswered : unanswered); return; }
    // كل بنود المستوى مُجابة → طلب التقدّم من الخادم
    setBusy(true); const r = await post({ action: 'answer', questionId: current.id, selectedOptionId: answers[current.id], finalize: true }); setBusy(false);
    if (!r?.ok) { if (r?.error === 'session_finalized' || r?.error === 'session_expired') setStep('review'); return; }
    if (r.decision === 'advance' || r.decision === 'descend') {
      setToast(x(r.decision === 'advance' ? 'level_passed' : 'level_down', { level: session!.currentLevel, next: r.nextLevel })); setTimeout(() => setToast(''), 5000);
      setSession((s) => s ? { ...s, currentLevel: r.nextLevel, currentLevelIndex: LEVELS.indexOf(r.nextLevel), direction: r.direction } : s); setQIdx(0);
    } else if (r.decision === 'complete' || r.decision === 'fail') { setSession((s) => s ? { ...s, finishReason: r.decision === 'complete' ? 'completed' : 'failed' } : s); setToast(x('level_finished')); setTimeout(() => setToast(''), 5000); setStep('review'); }
  }
  async function doFinish(reason: 'quit' | 'time') {
    if (busy && reason === 'quit') return; setBusy(true); const r = await post({ action: 'finish', reason }); setBusy(false);
    if (r?.ok) { setReport(r.report); setCode(r.access_code); setStep('result'); } else setErr(t('register', 'errNet'));
  }
  useEffect(() => {
    if (step !== 'test') return;
    const onKey = (e: KeyboardEvent) => { const tgt = e.target as HTMLElement; if (tgt && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tgt.tagName)) return; const n = Number(e.key); if (n >= 1 && n <= 6 && current && current.options[n - 1]) { void choose(current.options[n - 1].id); } else if (e.key === 'Enter') { void next(); } else if (e.key.toLowerCase() === 'd' && current) { setDeferred((d) => { const c = new Set(d); c.has(current.id) ? c.delete(current.id) : c.add(current.id); return c; }); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, current, answers, qIdx]);

  const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const skillName = (k: string, short = false) => t('test', short ? ({ grammar_vocab: 'gShort', reading: 'rShort', listening: 'lShort' } as any)[k] || k : ({ grammar_vocab: 'grammar', reading: 'read', listening: 'listen' } as any)[k] || k);
  const optionText = (q: Q, o: Q['options'][number]) => q.type === 'true_false_notgiven' ? x(`tfng_${o.id}`) : o.text;
  const site = typeof window !== 'undefined' ? window.location.origin : '';
  const cls = `mi${access.contrast ? ' mi-contrast' : ''}${access.large ? ' mi-large' : ''}`;

  // ================= العرض =================
  const Header = () => (
    <header className="mi-head">
      <a className="mi-brand" href="/" title={x('back_home')}><span className="mi-mark">مِعيار</span><span className="mi-sub">{x('product')}</span></a>
      <LangPicker copy={copy} lang={lang} onPick={setLang} label={t('intro', 'pageLang')} search={t('intro', 'langSearch')} none={t('intro', 'langNone')} />
    </header>
  );
  if (step === 'loading' || !copy) return <main className={cls} dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="mi-wrap"><p className="mi-muted" role="status">{err === 'copy' ? 'تعذّر تحميل مِعيار — أعد تحميل الصفحة.' : x('loading')}</p></div></main>;
  if (step === 'blocked') return <main className={cls} dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="mi-wrap"><Header /><section className="mi-card"><p className="mi-err" role="alert">{inviteErr ? x('invite_bad') : x('not_found')}</p><a className="mi-btn ghost" href="/miaar">{x('product')}</a></section></div></main>;

  return <main className={cls} dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="mi-wrap">
      {step !== 'result' && <Header />}
      {invite && step !== 'result' && <div className="mi-invite" data-testid="mi-invite"><b>{x('invite_for')}:</b> {invite.label_ar} · {t('intro', invite.exam_mode === 'adaptive' ? 'adap' : 'comp')}</div>}
      {toast && <div className="mi-toast" role="status" data-testid="mi-toast">{toast}</div>}

      {step === 'intro' && <section className="mi-hero" data-testid="mi-intro">
        <span className="mi-kicker">{t('intro', 'kicker')}</span>
        <h1>{t('intro', 'h1')}</h1>
        <p className="mi-lead">{t('intro', 'lead')}</p>
        <div className="mi-three">{[1, 2, 3].map((i) => <div key={i} className="mi-pill"><b>{t('intro', `p${i}t`)}</b><span>{t('intro', `p${i}`)}</span></div>)}</div>
        <section className="mi-card"><span className="mi-kicker">{t('intro', 'lvK')}</span><h2>{t('intro', 'lvH')}</h2><p className="mi-muted">{t('intro', 'sampleNote')}</p>
          <div className="mi-levels">{LEVELS.map((lv) => <div key={lv} className={`mi-lv lv-${lv}`}><b>{lv}</b><span>{t('intro', lv.toLowerCase())}</span><em dir="rtl" lang="ar">{SAMPLES[lv]}</em></div>)}</div></section>
        {!invite && <section className="mi-card"><span className="mi-kicker">{t('intro', 'entryK')}</span><h2>{t('intro', 'entryH')}</h2>
          <div className="mi-doors">{(['adaptive', 'comprehensive'] as const).map((m) => <button key={m} type="button" className={`mi-door${examMode === m ? ' on' : ''}`} onClick={() => setExamMode(m)} aria-pressed={examMode === m} data-testid={`mi-door-${m}`}><b>{t('intro', m === 'adaptive' ? 'adap' : 'comp')}</b><span>{t('intro', m === 'adaptive' ? 'adapS' : 'compS')}</span></button>)}</div></section>}
        <div className="mi-actions"><button type="button" className="mi-btn" onClick={() => setStep('register')} data-testid="mi-start">{t('intro', 'askEnter')} →</button></div>
        <p className="mi-fine">{t('intro', 'side')}</p>
      </section>}

      {step === 'register' && <form className="mi-card mi-form" onSubmit={submitRegister} data-testid="mi-register">
        <span className="mi-kicker">{t('register', 'kicker')}</span><h2>{t('register', 'title')}</h2><p className="mi-muted">{t('register', 'lead')}</p>
        <label>{t('register', 'name')}<input value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })} placeholder={t('register', 'namePh')} maxLength={120} required autoComplete="name" /></label>
        <label>{t('register', 'email')}<input type="email" value={cand.email} onChange={(e) => setCand({ ...cand, email: e.target.value })} readOnly={!!invite?.recipient} maxLength={160} required autoComplete="email" dir="ltr" /></label>
        <label>{t('register', 'phone')} <small>({t('register', 'phoneOpt')})</small><input value={cand.phone} onChange={(e) => setCand({ ...cand, phone: e.target.value })} maxLength={40} autoComplete="tel" dir="ltr" /></label>
        <label>{t('register', 'native')}<select value={cand.nativeLanguage} onChange={(e) => setCand({ ...cand, nativeLanguage: e.target.value })}><option value="">{t('register', 'nativePh')}</option>{(copy.native || []).map((n) => <option key={n.value} value={n.value}>{n.labels[lang] || n.labels.en || n.value}</option>)}</select></label>
        <fieldset><legend>{t('register', 'studied')}</legend>{[true, false].map((v) => <label key={String(v)} className="mi-radio"><input type="radio" name="studied" checked={cand.studiedBefore === v} onChange={() => setCand({ ...cand, studiedBefore: v })} />{t('register', v ? 'yes' : 'no')}</label>)}</fieldset>
        <label>{t('register', 'purpose')}<select value={cand.purpose} onChange={(e) => setCand({ ...cand, purpose: e.target.value })}><option value="">{t('register', 'purposePh')}</option>{PURPOSE.map(([ar, k]) => <option key={k} value={ar}>{t('register', k)}</option>)}</select></label>
        <fieldset className="mi-access" data-testid="mi-access"><legend>{x('access_k')}</legend><p className="mi-muted">{x('access_h')}</p>
          <div className="mi-row"><span>{x('access_time')}:</span>{([1, 1.25, 1.5] as const).map((v) => <label key={v} className="mi-radio"><input type="radio" name="xtime" checked={access.time === v} onChange={() => setAccess({ ...access, time: v })} />{v === 1 ? x('access_none') : `×${v}`}</label>)}</div>
          <div className="mi-row">{(['simple', 'contrast', 'large'] as const).map((k) => <label key={k} className="mi-radio"><input type="checkbox" checked={access[k]} onChange={(e) => setAccess({ ...access, [k]: e.target.checked })} />{x(`access_${k}`)}</label>)}</div>
        </fieldset>
        {err && <p className="mi-err" role="alert" data-testid="mi-err">{err}</p>}
        <div className="mi-actions"><button type="button" className="mi-btn ghost" onClick={() => setStep('intro')}>{t('register', 'back')}</button><button type="submit" className="mi-btn" disabled={busy} data-testid="mi-register-submit">{busy ? t('register', 'saving') : t('register', 'submit')}</button></div>
        <p className="mi-fine">{t('register', 'privacy')}</p>
      </form>}

      {step === 'probe' && <section className="mi-card" data-testid="mi-probe">
        <span className="mi-kicker">{x('probe_k')} · {t('gate', 'resultKicker')}</span><h2>{x('probe_h')}</h2>
        {!probeDone && probe[probeIdx] && <div>
          <p className="mi-muted">{x('probe_q', { n: probeIdx + 1 })} · {probe[probeIdx].level}</p>
          <p className="mi-q" dir="rtl" lang="ar">{probe[probeIdx].prompt}</p>
          <div className="mi-opts">{probe[probeIdx].options.map((o, i) => <button key={o.id} type="button" className={`mi-opt${probeAns[probe[probeIdx].id] === o.id ? ' on' : ''}`} onClick={() => { setProbeAns({ ...probeAns, [probe[probeIdx].id]: o.id }); setTimeout(() => { if (probeIdx < probe.length - 1) setProbeIdx(probeIdx + 1); else setProbeDone(true); }, 250); }} data-testid="mi-probe-opt"><span className="mi-letter">{letters[i]}</span><span dir="rtl" lang="ar">{o.text}</span></button>)}</div>
          <button type="button" className="mi-link" onClick={() => void startTest(false)} disabled={busy}>{x('probe_skip')}</button>
        </div>}
        {probeDone && <div data-testid="mi-probe-done">
          <p className="mi-lead">{t('gate', 'score', { n: Object.keys(probeAns).length })} · {t('gate', 'indicator')}</p>
          <p className="mi-muted">{t('gate', 'touch')}</p>
          {err && <p className="mi-err" role="alert" data-testid="mi-err">{err}</p>}
          <div className="mi-actions"><button type="button" className="mi-btn" onClick={() => void startTest(true)} disabled={busy} data-testid="mi-begin">{busy ? t('register', 'saving') : x('probe_start')} →</button></div>
        </div>}
      </section>}

      {step === 'test' && session && current && <section className="mi-test" data-testid="mi-test">
        <div className="mi-bar">
          <span className="mi-chip" data-testid="mi-level">{t('test', 'levelNow', { level: session.currentLevel })}</span>
          <span className="mi-chip">{t('test', 'qOf', { a: qIdx + 1, b: levelQs.length })} · {t('test', 'answered', { n: answeredInLevel })}</span>
          <span className={`mi-chip mi-clock${remaining < 300 ? ' warn' : ''}`} aria-live="polite" data-testid="mi-clock">{t('test', 'time', { clock: clock(remaining) })}</span>
          <button type="button" className="mi-link" onClick={() => setShowEnd(true)}>{t('test', 'end')}</button>
        </div>
        <div className="mi-path" aria-hidden="true">{LEVELS.map((lv, i) => <span key={lv} className={`mi-dot${i === session.currentLevelIndex ? ' now' : i < session.currentLevelIndex ? ' done' : ''}${i < session.startLevelIndex ? ' skip' : ''}`}>{lv}</span>)}</div>
        {access.simple && <p className="mi-simple">{x('simple_test')}</p>}
        <div className="mi-grid">
          {passage && <aside className="mi-passage" data-testid="mi-passage">
            <span className="mi-kicker">{passage.skill === 'listening' ? t('test', 'listening') : t('test', 'reading')} · {passage.title}</span>
            {passage.skill === 'listening' ? <Player key={passage.id} url={passage.audioUrl} title={passage.title} t={(k, v) => t('player', k, v)} left={(n) => x('replays_left', { n })} /> : <p className="mi-text" dir="rtl" lang="ar">{passage.text}</p>}
          </aside>}
          <article className="mi-qcard">
            <span className="mi-kicker">{skillName(current.skill)} · {current.level}</span>
            {current.stimulus?.image && <img className="mi-stim" src={current.stimulus.image} alt={current.stimulus.alt || ''} />}
            <h2 className="mi-q" dir="rtl" lang="ar">{current.questionText}</h2>
            {current.type === 'picture_choice' && <p className="mi-muted">{x('pick_picture')}</p>}
            <div className={`mi-opts${current.type === 'picture_choice' ? ' pics' : ''}`} role="radiogroup" aria-label={t('test', 'choices')}>
              {current.options.map((o, i) => <button key={o.id} type="button" role="radio" aria-checked={answers[current.id] === o.id} className={`mi-opt${answers[current.id] === o.id ? ' on' : ''}`} onClick={() => void choose(o.id)} data-testid="mi-opt">
                <span className="mi-letter">{letters[i]}</span>{o.image ? <img src={o.image} alt={o.alt || o.text || ''} /> : <span dir="rtl" lang="ar">{optionText(current, o)}</span>}
              </button>)}
            </div>
            <div className="mi-actions">
              <button type="button" className="mi-btn ghost small" onClick={() => setDeferred((d) => { const c = new Set(d); c.has(current.id) ? c.delete(current.id) : c.add(current.id); return c; })} aria-pressed={deferred.has(current.id)}>{deferred.has(current.id) ? t('test', 'clear') : t('test', 'defer')}</button>
              <button type="button" className="mi-btn" onClick={() => void next()} disabled={busy} data-testid="mi-next">{t('test', 'next')} →</button>
            </div>
            {!access.simple && <p className="mi-fine">{t('test', 'shortcuts')}</p>}
          </article>
        </div>
        <nav className="mi-nav" aria-label={t('test', 'levelNow', { level: session.currentLevel })}>{levelQs.map((q, i) => <button key={q.id} type="button" className={`mi-num${i === qIdx ? ' now' : ''}${answers[q.id] ? ' ok' : ''}${deferred.has(q.id) ? ' def' : ''}`} onClick={() => setQIdx(i)} aria-current={i === qIdx}>{i + 1}</button>)}</nav>
        {showEnd && <div className="mi-modal" role="dialog" aria-modal="true" aria-label={t('test', 'endMenu')}><div className="mi-card">
          <h3>{t('test', 'endMenu')}</h3><p className="mi-muted">{t('test', 'toReviewHint')}</p>
          <div className="mi-actions"><button type="button" className="mi-btn ghost" onClick={() => setShowEnd(false)}>{t('test', 'cancel')}</button><button type="button" className="mi-btn" onClick={() => { setShowEnd(false); setStep('review'); }} data-testid="mi-to-review">{t('test', 'toReview')}</button></div>
        </div></div>}
      </section>}

      {step === 'review' && session && <section className="mi-card" data-testid="mi-review">
        <span className="mi-kicker">{t('review', 'kicker')}</span><h2>{t('review', 'title')}</h2><p className="mi-muted">{t('review', 'lead')}</p>
        {(() => { const shown = session.form?.questions.filter((q) => LEVELS.indexOf(q.level) <= Math.max(session.currentLevelIndex, session.startLevelIndex) && (LEVELS.indexOf(q.level) >= Math.min(session.currentLevelIndex, session.startLevelIndex))) || []; const done = shown.filter((q) => answers[q.id]).length; const pend = shown.length - done;
          return <>
            <div className="mi-kpis"><span><b>{shown.length}</b> {t('review', 'shown')}</span><span><b>{done}</b> {t('review', 'answered')}</span><span><b>{deferred.size}</b> {t('review', 'deferred')}</span><span><b>{clock(remaining)}</b> {t('review', 'timeLeft')}</span></div>
            {pend > 0 && <p className="mi-err">{t('review', 'pending', { n: pend })}</p>}
            <div className="mi-nav">{shown.map((q) => <button key={q.id} type="button" className={`mi-num${answers[q.id] ? ' ok' : ''}${deferred.has(q.id) ? ' def' : ''}`} title={`${q.level} · ${skillName(q.skill, true)}`} onClick={() => { if (q.level === session.currentLevel && session.status === 'active' && !session.finishReason) { setQIdx(levelQs.findIndex((z) => z.id === q.id)); setStep('test'); } }}>{q.level}</button>)}</div>
            <div className="mi-actions">
              {session.status === 'active' && !session.finishReason && <button type="button" className="mi-btn ghost" onClick={() => setStep('test')}>{t('review', 'continue')}</button>}
              <button type="button" className="mi-btn" onClick={() => void doFinish('quit')} disabled={busy} data-testid="mi-confirm">{t('review', 'confirm')}</button>
            </div>
          </>; })()}
        {err && <p className="mi-err" role="alert">{err}</p>}
      </section>}

      {step === 'result' && report && <ResultCard report={report} code={code} name={resultName} lang={lang} t={t} x={x} site={site} copied={copied} onCopy={async () => { try { await navigator.clipboard.writeText(`${site}/miaar/result/${code}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ } }} onLang={setLang} copy={copy} />}
    </div>
    <footer className="mi-foot">© 2026 {x('product')} · {x('athar')} · <a href="/accessibility">{lang === 'ar' ? 'الوصولية' : 'Accessibility'}</a></footer>
  </main>;
}

function LangPicker({ copy, lang, onPick, label, search, none }: { copy: Copy | null; lang: string; onPick: (v: string) => void; label: string; search: string; none: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const langs = copy?.langs || []; const cur = langs.find((l) => l.id === lang);
  const list = langs.filter((l) => !q || l.find.toLowerCase().includes(q.toLowerCase()) || l.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="mi-lang">
    <button type="button" className="mi-btn ghost small" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label} data-testid="mi-lang">🌐 {cur?.name || lang}</button>
    {open && <div className="mi-langbox"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={search} aria-label={search} />
      <div className="mi-langlist">{list.map((l) => <button key={l.id} type="button" className={l.id === lang ? 'on' : ''} onClick={() => { onPick(l.id); setOpen(false); setQ(''); }}>{l.name}</button>)}{!list.length && <span className="mi-muted">{none}</span>}</div></div>}
  </div>;
}

function Player({ url, title, t, left }: { url: string | null; title: string; t: (k: string, v?: any) => string; left: (n: number) => string }) {
  const ref = useRef<HTMLAudioElement | null>(null); const [plays, setPlays] = useState(0); const [playing, setPlaying] = useState(false); const [failed, setFailed] = useState(!url);
  const MAX = 2;
  const play = () => { if (plays >= MAX) return; if (!url || failed) { try { const u = new SpeechSynthesisUtterance(title); u.lang = 'ar-SA'; speechSynthesis.speak(u); setPlays(plays + 1); } catch { /* */ } return; } const a = ref.current; if (!a) return; a.currentTime = 0; a.play().then(() => { setPlaying(true); setPlays(plays + 1); }).catch(() => setFailed(true)); };
  return <div className="mi-player" role="group" aria-label={t('aria', { title })}>
    {url && <audio ref={ref} src={url} preload="auto" onEnded={() => setPlaying(false)} onError={() => setFailed(true)} />}
    <button type="button" className="mi-btn" onClick={play} disabled={plays >= MAX || playing} data-testid="mi-play">{playing ? '…' : plays === 0 ? `▶ ${t('play')}` : `↻ ${t('replay', { n: MAX - plays })}`}</button>
    <span className="mi-muted">{left(Math.max(0, MAX - plays))}</span>
    {failed && !url && <span className="mi-muted">{t('tts')}</span>}{failed && url && <span className="mi-err">{t('failed')}</span>}
  </div>;
}

function ResultCard({ report, code, name, lang, t, x, site, copied, onCopy, onLang, copy }: { report: any; code: string | null; name: string; lang: string; t: (s: string, k: string, v?: any) => string; x: (k: string, v?: any) => string; site: string; copied: boolean; onCopy: () => void; onLang: (v: string) => void; copy: Copy | null }) {
  const sum = report?.ملخص_التسكين || {}; const demo: Level = sum.المستوى_المثبت || report.المستوى_العام || 'A1'; const entry: Level = sum.مستوى_الالتحاق_المقترح || demo;
  const conf = report?.ميزان_الثقة?.الرمز || 'medium'; const stats = report?.احصائيات || {}; const levels: any[] = report?.مستويات_تفصيلية || [];
  const ar = lang === 'ar'; const canDo = (CAN_DO[demo] || CAN_DO.A1)[ar ? 'ar' : 'en'];
  const url = code ? `${site}/miaar/result/${code}` : ''; const who = report?.بيانات_المتقدم?.الاسم && report.بيانات_المتقدم.الاسم !== '—' ? report.بيانات_المتقدم.الاسم : name;
  const weakest = SKILLS.filter((k) => stats[k]?.answered > 0).sort((a, b) => stats[a].percent - stats[b].percent)[0];
  return <section className="mi-result" data-testid="mi-result">
    <div className="mi-card mi-level-card">
      <div className="mi-rhead"><div><span className="mi-kicker">{x('card_k')} · {t('result', 'org')}</span><h1>{who}</h1><p className="mi-muted">{t('result', 'date')}: {new Date(report.تاريخ || Date.now()).toLocaleDateString(ar ? 'ar-SA' : lang)}</p></div>
        <div className="mi-nolink"><LangPicker copy={copy} lang={lang} onPick={onLang} label={t('intro', 'pageLang')} search={t('intro', 'langSearch')} none={t('intro', 'langNone')} /></div></div>
      <div className="mi-big"><div className={`mi-lvbig lv-${demo}`} data-testid="mi-demo"><small>{x('card_demo')}</small><b style={sum.دون_A1 ? { fontSize: 30 } : undefined}>{sum.دون_A1 ? (ar ? 'ما قبل A1' : 'Pre-A1') : demo}</b><span>{sum.دون_A1 ? x('pre_a1') : t('result', demo.toLowerCase())}</span></div>
        <div className="mi-lvside"><div><small>{x('card_entry')}</small><b data-testid="mi-entry">{entry}</b></div><div><small>{x('conf')}</small><b className={`mi-conf ${conf}`} data-testid="mi-conf">{x(`conf_${conf}`)}</b></div><div><small>{t('result', 'percent')}</small><b>{report.النسبة_العامة}%</b> <span className="mi-muted">({report.الدرجة_الموضوعية})</span></div></div></div>
      <div className="mi-two">
        <div><h3>{x('can_do')}</h3><ul>{canDo.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        <div><h3>{x('next_steps')}</h3><ol><li><a href={`/programs?level=${entry}`}>{x('step_programs')}</a></li><li>{x('step_keep')}</li>{weakest && <li>{x('step_weak')} — {t('result', ({ grammar_vocab: 'gShort', reading: 'rShort', listening: 'lShort' } as any)[weakest])} {stats[weakest].percent}%</li>}</ol></div>
      </div>
      <h3>{t('result', 'skills')}</h3>
      <div className="mi-bars" role="list" aria-label={t('result', 'skills')}>{SKILLS.map((k, i) => { const s = stats[k] || { percent: 0, level: '—', answered: 0 }; return <div key={k} className="mi-barrow" role="listitem"><span className="mi-barlabel">{t('result', ({ grammar_vocab: 'gShort', reading: 'rShort', listening: 'lShort' } as any)[k])} · {s.level}</span><span className="mi-bartrack" aria-hidden="true"><span className="mi-barfill" style={{ width: `${Math.max(0, Math.min(100, s.percent))}%`, background: ['#0e5f46', '#2a7f62', '#c9a227'][i] }} /></span><b className="mi-barpct">{s.answered ? `${s.percent}%` : '—'}</b></div>; })}</div>
      <details><summary>{t('result', 'levels')}</summary><table className="mi-table"><tbody>{levels.map((l) => <tr key={l.level}><td>{l.level}</td><td>{l.status === 'skipped' ? (ar ? 'أدنى من نقطة البداية' : 'below the starting point') : `${l.correct}/${l.total} · ${l.percent}%`}</td><td>{l.status === 'passed' ? '✓' : l.status === 'failed' ? '✗' : l.status === 'skipped' ? '↑' : '…'}</td></tr>)}</tbody></table>
        <p className="mi-fine">{report.التوصية}</p>{report.تيسيرات && <p className="mi-fine">{report.تيسيرات}</p>}<p className="mi-fine">{report.سبب_الانتهاء} · {t('result', 'spent')}: {report.الوقت_المستغرق} · {report.نمط_الاختبار || ''} · {report.نقطة_البداية ? `${x('probe_k')}: ${report.نقطة_البداية}` : ''}</p></details>
      {code && <div className="mi-code"><div><small>{x('result_code')}</small><b dir="ltr" data-testid="mi-code">{code}</b><br /><a href={url} dir="ltr">{url}</a></div><div className="mi-qr" dangerouslySetInnerHTML={{ __html: qrSvg(url, 96, 'M', '#0e5f46') }} /></div>}
      <p className="mi-fine">{x('nature')} · {report.ميزان_الثقة?.الشرح || ''}</p>
      <div className="mi-actions mi-nolink"><button type="button" className="mi-btn ghost" onClick={() => window.print()}>{t('result', 'print')}</button>{code && <button type="button" className="mi-btn ghost" onClick={onCopy}>{copied ? x('copied') : x('copy_link')}</button>}<a className="mi-btn" href={`/programs?level=${entry}`}>{t('result', 'programs')} →</a></div>
    </div>
  </section>;
}

const CSS = `
.mi{--pine:#0e5f46;--pine2:#0b4a37;--gold:#c9a227;--sand:#f7f3ea;--ink:#10231d;--line:#e3dccb;min-height:100vh;background:var(--sand);color:var(--ink);font-family:var(--font-ar),Tajawal,"Noto Naskh Arabic",Arial,sans-serif;padding:22px 16px 32px}
.mi *{box-sizing:border-box}.mi :is(button,a,input,select):focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.mi.mi-contrast{--sand:#fff;--ink:#000;--line:#000;--pine:#003d2b}.mi.mi-large{font-size:118%}
.mi-wrap{max-width:1040px;margin:0 auto;display:grid;gap:14px}
.mi-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.mi-brand{display:flex;align-items:baseline;gap:10px;text-decoration:none;color:var(--ink)}.mi-mark{font-family:"Aref Ruqaa",var(--font-ar),serif;font-size:30px;font-weight:900;color:var(--pine)}.mi-sub{font-size:12px;color:#5b6b64;font-weight:700}
.mi-kicker{display:inline-block;font-size:12px;font-weight:900;color:var(--pine);letter-spacing:.02em}
.mi-hero h1{font-size:clamp(24px,4vw,38px);line-height:1.35;margin:6px 0 10px;color:var(--pine2)}.mi-lead{font-size:17px;line-height:1.8;max-width:760px;margin:0 0 12px}
.mi-three{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:12px 0}.mi-pill{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;gap:4px;font-size:13px;line-height:1.6}.mi-pill b{color:var(--pine)}
.mi-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px 20px;margin:10px 0}.mi-card h2{margin:4px 0 6px;font-size:20px;color:var(--pine2)}.mi-card h3{margin:12px 0 6px;font-size:15px;color:var(--pine)}
.mi-muted{color:#5b6b64;font-size:13px;line-height:1.7;margin:4px 0}.mi-fine{font-size:12px;color:#5b6b64;line-height:1.7;margin:8px 0 0}.mi-err{color:#8a1c1c;background:#fff1f0;border:1px solid #f3c2c2;border-radius:10px;padding:8px 12px;font-size:13px;line-height:1.6}
.mi-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.mi-lv{border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:4px;font-size:12px;line-height:1.5}.mi-lv b{font-size:18px;color:var(--pine)}.mi-lv em{font-style:normal;color:#334;font-size:13px}
.lv-C1 b,.lv-C2 b{color:var(--gold)}
.mi-doors{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.mi-door{text-align:start;background:#fff;border:2px solid var(--line);border-radius:14px;padding:12px 14px;font:inherit;cursor:pointer;display:grid;gap:4px;font-size:13px;line-height:1.6;color:var(--ink)}.mi-door.on{border-color:var(--pine);background:#eef6f2}.mi-door b{font-size:15px;color:var(--pine)}
.mi-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}
.mi-btn{border:1px solid var(--pine);background:var(--pine);color:#fff;border-radius:12px;padding:10px 16px;font:inherit;font-weight:900;font-size:14px;cursor:pointer;min-height:44px;text-decoration:none;display:inline-flex;align-items:center;gap:6px}.mi-btn.ghost{background:#fff;color:var(--pine)}.mi-btn.small{padding:6px 10px;font-size:12px;min-height:36px}.mi-btn:disabled{opacity:.5;cursor:default}
.mi-link{background:none;border:0;color:var(--pine);text-decoration:underline;font:inherit;font-size:13px;cursor:pointer;padding:6px;min-height:44px}
.mi-form label{display:grid;gap:4px;font-size:13px;font-weight:800;margin:10px 0}.mi-form input,.mi-form select{font:inherit;border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:44px;background:#fff}.mi-form fieldset{border:1px solid var(--line);border-radius:12px;padding:8px 12px;margin:10px 0}.mi-form legend{font-size:13px;font-weight:800;padding:0 6px}
.mi-radio{display:inline-flex!important;align-items:center;gap:6px;margin:4px 12px 4px 0!important;font-weight:600!important}.mi-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px}.mi-access{background:#fbf8f0}
.mi-invite{background:#eef6f2;border:1px solid #cfe3d8;border-radius:12px;padding:8px 12px;font-size:13px}
.mi-toast{position:fixed;top:16px;inset-inline:16px;margin:0 auto;max-width:560px;background:var(--pine2);color:#fff;border-radius:12px;padding:10px 14px;font-size:14px;z-index:40;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.mi-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mi-chip{background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800}.mi-clock{font-variant-numeric:tabular-nums}.mi-clock.warn{border-color:#c0392b;color:#c0392b}
.mi-path{display:flex;gap:6px;margin:8px 0}.mi-dot{width:38px;height:26px;border-radius:999px;border:1px solid var(--line);display:grid;place-items:center;font-size:11px;font-weight:900;background:#fff;color:#8a9690}.mi-dot.done{background:#dfeee7;color:var(--pine)}.mi-dot.now{background:var(--pine);color:#fff;border-color:var(--pine)}.mi-dot.skip{background:#f1ede2;color:#b5a26a;border-style:dashed}
.mi-simple{background:#fff8e1;border:1px solid #f0dd9a;border-radius:10px;padding:8px 12px;font-size:14px}
.mi-grid{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:900px){.mi-grid.has-p{grid-template-columns:1fr 1fr}.mi-grid:has(.mi-passage){grid-template-columns:1fr 1fr}}
.mi-passage{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}.mi-text{font-size:17px;line-height:2;white-space:pre-wrap;margin:8px 0 0}
.mi-qcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}.mi-q{font-size:20px;line-height:1.9;margin:8px 0 12px;font-weight:800}.mi-stim{max-width:100%;max-height:260px;border-radius:12px;border:1px solid var(--line);display:block;margin:8px 0}
.mi-opts{display:grid;gap:8px}.mi-opts.pics{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.mi-opt{display:flex;align-items:center;gap:10px;text-align:start;background:#fff;border:2px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;cursor:pointer;min-height:48px;color:var(--ink)}.mi-opt:hover{border-color:#9fbfb1}.mi-opt.on{border-color:var(--pine);background:#eef6f2}.mi-opt img{max-width:100%;max-height:150px;border-radius:8px}.mi-opts.pics .mi-opt{flex-direction:column}
.mi-letter{width:26px;height:26px;border-radius:999px;background:var(--sand);display:grid;place-items:center;font-size:12px;font-weight:900;color:var(--pine);flex:none}
.mi-nav{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.mi-num{width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:#fff;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:var(--ink)}.mi-num.ok{background:#dfeee7;border-color:#9fbfb1}.mi-num.def{border-color:var(--gold);box-shadow:inset 0 0 0 2px #f1e3b2}.mi-num.now{outline:2px solid var(--pine)}
.mi-player{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
.mi-modal{position:fixed;inset:0;background:rgba(16,35,29,.45);display:grid;place-items:center;padding:16px;z-index:50}.mi-modal .mi-card{max-width:460px;width:100%}
.mi-kpis{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#5b6b64;margin:8px 0}.mi-kpis b{font-size:20px;color:var(--pine);margin-inline-end:4px}
.mi-lang{position:relative}.mi-langbox{position:absolute;inset-inline-end:0;top:42px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px;width:260px;z-index:30;box-shadow:0 10px 30px rgba(0,0,0,.12)}.mi-langbox input{width:100%;font:inherit;border:1px solid var(--line);border-radius:8px;padding:8px;margin-bottom:6px}.mi-langlist{max-height:260px;overflow:auto;display:grid}.mi-langlist button{text-align:start;background:none;border:0;font:inherit;padding:7px 8px;border-radius:8px;cursor:pointer;color:var(--ink)}.mi-langlist button.on,.mi-langlist button:hover{background:#eef6f2;color:var(--pine)}
.mi-level-card{border-top:6px solid var(--pine)}.mi-rhead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start}.mi-rhead h1{margin:4px 0;font-size:24px;color:var(--pine2)}
.mi-big{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;margin:12px 0}.mi-lvbig{background:var(--pine);color:#fff;border-radius:18px;padding:16px 22px;display:grid;text-align:center;min-width:150px}.mi-lvbig small{font-size:11px;opacity:.85}.mi-lvbig b{font-size:52px;line-height:1.1}.mi-lvbig span{font-size:12px;opacity:.95}.mi-lvbig.lv-C1,.mi-lvbig.lv-C2{background:#8a6d13}
.mi-lvside{display:grid;gap:8px;font-size:13px}.mi-lvside small{display:block;color:#5b6b64;font-size:11px}.mi-lvside b{font-size:18px;color:var(--pine2)}.mi-conf{border-radius:999px;padding:2px 10px;font-size:13px!important}.mi-conf.high{background:#dfeee7;color:var(--pine)!important}.mi-conf.medium{background:#fff4d6;color:#7a5b00!important}.mi-conf.border{background:#fde8e8;color:#8a1c1c!important}
.mi-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.mi-two ul,.mi-two ol{margin:0;padding-inline-start:20px;font-size:14px;line-height:1.9}
.mi-bars{display:grid;gap:8px;max-width:520px}.mi-barrow{display:grid;grid-template-columns:150px 1fr 48px;gap:10px;align-items:center;font-size:13px}.mi-barlabel{font-weight:800}.mi-bartrack{height:10px;border-radius:5px;background:#e8e2d2;overflow:hidden;display:block}.mi-barfill{display:block;height:100%;border-radius:5px}.mi-barpct{font-variant-numeric:tabular-nums}.mi-table{border-collapse:collapse;font-size:13px;margin:8px 0}.mi-table td{border-bottom:1px solid var(--line);padding:4px 10px}
.mi-code{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:var(--sand);border-radius:12px;padding:10px 14px;margin-top:12px;font-size:12px}.mi-code b{font-size:18px;letter-spacing:.06em;color:var(--pine2)}.mi-code a{color:var(--pine);word-break:break-all}.mi-qr svg{display:block}
.mi-foot{text-align:center;font-size:12px;color:#5b6b64;margin-top:24px}.mi-foot a{color:var(--pine)}
@media print{.mi{padding:0;background:#fff}.mi-nolink,.mi-foot,.mi-head,.mi-toast{display:none!important}.mi-card{border:0;box-shadow:none}details{display:block}details>*{display:block}}
`;
