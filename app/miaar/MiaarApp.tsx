'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مِعيار — من أَثَر» — تجربة المتقدّم كاملة في مكوّن واحد (م1):
 *  المقدّمة (30 لغة — قاموس مِعيار حرفيًا من /miaar/copy/<lang>.json — مقسَّم منذ P40) → التسجيل (+«احتياجاتي») → «مِسبار» (5 بنود تحدّد نقطة البداية)
 *  → الاختبار (قراءة · استماع · قواعد؛ بنود mcq/مصوّرة/صواب-خطأ؛ مؤقّت؛ تأجيل؛ اختصارات) → المراجعة → «بطاقة المستوى» (أستطيع أن… · ميزان الثقة · رمز نتيجة · باركود · طباعة).
 *  التصحيح كله على الخادم (/api/miaar). هوية مِعيار/أَثَر البصرية كما في شاشات مِعيار الأصلية: كحلي #0f2a4e · تركوازي #0b8a83 · ذهبي #c9a24b؛ خطّا Tajawal وAref Ruqaa (next/font — مستضافان ذاتيًا).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { qrSvg } from '../../lib/certificates/qr';
import { CAN_DO, LEVELS, SKILLS, FLOOR_LEVEL, FLOOR_INDEX } from '../../lib/miaar/registry';
import type { Level } from '../../lib/miaar/registry';
import { Icon } from '../../lib/ui/icons';

type Copy = Record<string, Record<string, Record<string, string>>> & { langs?: { id: string; name: string; find: string }[]; native?: { value: string; labels: Record<string, string> }[] };
type Q = { id: string; level: string; skill: string; type: string; passageId: string | null; questionText: string; options: { id: string; text: string; image?: string | null; alt?: string | null }[]; stimulus: { image: string | null; alt: string | null } | null };
type Player = { speeds: number[]; replays: number; twice?: boolean };
type P = { id: string; level: string; skill: string; title: string; text: string; audioUrl: string | null; player?: Player };
type Session = { examMode: 'comprehensive' | 'adaptive'; currentLevel: string; currentLevelIndex: number; startLevelIndex: number; direction: 'up' | 'down'; status: string; finishReason: string | null; expiresAt: string; remainingSeconds: number; durationSeconds: number; access: any; answers: Record<string, string>; form: { questions: Q[]; passages: P[] } | null };
type Invite = { code: string; kind: 'group' | 'personal'; label_ar: string; lang: string; exam_mode: 'adaptive' | 'comprehensive'; purpose: string | null; expires_at: string | null; recipient: { id: string; email: string; name: string | null; used: boolean } | null };
type Step = 'loading' | 'intro' | 'register' | 'probe' | 'test' | 'review' | 'result' | 'blocked';
type Props = { inviteCode?: string | null; inviteToken?: string | null; resultCode?: string | null; fontClass?: string };

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
  floor_level: { ar: 'ما قبل A1', en: 'Pre-A1' }, level_floor: { ar: 'لم تكتمل A1 — بضعة أسئلة أبسط بالصور لنعرف نقطة بدايتك', en: 'A1 not yet complete — a few simpler picture questions to find your starting point' },
  speed: { ar: 'السرعة', en: 'Speed' }, twice: { ar: 'يُقرأ المقطع مرتين', en: 'The clip is read twice' }, floor_verdict: { ar: 'نقطة البداية داخل A1', en: 'Starting point within A1' },
  tfng_a: { ar: 'صواب', en: 'True' }, tfng_b: { ar: 'خطأ', en: 'False' }, tfng_c: { ar: 'غير مذكور', en: 'Not given' }, pick_picture: { ar: 'اختر الصورة', en: 'Choose the picture' },
  simple_test: { ar: 'اقرأ أو استمع، ثم اختر إجابة واحدة. الزرّ الكبير ينقلك إلى السؤال التالي.', en: 'Read or listen, then choose one answer. The big button moves to the next question.' },
};

const fill = (s: string, vars: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
function readLang(fallback: string) { try { const v = localStorage.getItem('athar-page-lang'); if (v) return v; } catch { /* */ } return fallback; }
/* خِفّة مِعيار (P40): القاموس مقسَّم — فهرس صغير /miaar/copy/index.json + ملف لكل لغة /miaar/copy/<code>.json؛ لا يُحمَّل إلا en (الاحتياطي) ولغة الزائر، وتُجلب أي لغة أخرى عند اختيارها فقط (كان الملف الموحّد 139 KB مضغوطة لكل زيارة). */
type CopyIndex = { codes: string[]; langs: Copy['langs']; native: Copy['native'] };
const copyFiles: Record<string, Promise<Record<string, Record<string, string>> | null>> = {};
let copyIndex: Promise<CopyIndex | null> | null = null;
function fetchCopyLang(code: string) { if (!copyFiles[code]) copyFiles[code] = fetch(`/miaar/copy/${encodeURIComponent(code)}.json`, { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null); return copyFiles[code]; }
async function loadCopy(base: Copy | null, codes: string[]): Promise<Copy | null> {
  if (!copyIndex) copyIndex = fetch('/miaar/copy/index.json', { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const idx = await copyIndex; if (!idx) return null;
  const out: Copy = base ? { ...base } : ({ langs: idx.langs, native: idx.native } as Copy);
  for (const code of Array.from(new Set(codes))) {
    if (!idx.codes.includes(code) || out.intro?.[code]) continue;
    const f = await fetchCopyLang(code); if (!f) continue;
    for (const sec of Object.keys(f)) out[sec] = { ...(out[sec] || {}), [code]: f[sec] };
  }
  return out;
}
async function copyHas(code: string) { const idx = await copyIndex; return !!idx?.codes.includes(code); }

export default function MiaarApp({ inviteCode = null, inviteToken = null, resultCode = null, fontClass = '' }: Props) {
  const [copy, setCopy] = useState<Copy | null>(null);
  const [lang, setLangState] = useState('en');
  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<Invite | null>(null); const [inviteErr, setInviteErr] = useState(false);
  const [examMode, setExamMode] = useState<'comprehensive' | 'adaptive'>('adaptive');
  const [cand, setCand] = useState({ name: '', email: '', phone: '', nativeLanguage: '', studiedBefore: null as boolean | null, purpose: '' });
  const [access, setAccess] = useState({ time: 1 as 1 | 1.25 | 1.5, simple: false, contrast: false, large: false });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ id: string; level: Level; skill: string; prompt: string; options: { id: string; text: string }[] }[]>([]); const [probeAns, setProbeAns] = useState<Record<string, string>>({}); const [probeIdx, setProbeIdx] = useState(0); const [probeDone, setProbeDone] = useState(false);
  const [session, setSession] = useState<Session | null>(null); const [answers, setAnswers] = useState<Record<string, string>>({}); const [deferred, setDeferred] = useState<Set<string>>(new Set());
  const [qIdx, setQIdx] = useState(0); const [remaining, setRemaining] = useState(0); const [toast, setToast] = useState(''); const [showEnd, setShowEnd] = useState(false);
  const [report, setReport] = useState<any>(null); const [code, setCode] = useState<string | null>(null); const [resultName, setResultName] = useState(''); const [copied, setCopied] = useState(false);
  const langPicked = useRef(false);

  const dir = RTL.has(lang) ? 'rtl' : 'ltr';
  const t = useCallback((sec: string, key: string, vars?: Record<string, string | number>) => { const s = copy?.[sec]; const v = s?.[lang]?.[key] ?? s?.en?.[key] ?? key; return vars ? fill(v, vars) : v; }, [copy, lang]);
  const x = useCallback((key: string, vars?: Record<string, string | number>) => { const v = (lang === 'ar' ? X[key]?.ar : X[key]?.en) || key; return vars ? fill(v, vars) : v; }, [lang]);
  const setLang = (v: string) => { langPicked.current = true; setLangState(v); try { localStorage.setItem('athar-page-lang', v); } catch { /* */ } void loadCopy(copy, [v]).then((c) => { if (c) setCopy(c); }); };
  const letters = lang === 'ar' ? AR_LETTERS : EN_LETTERS;

  // ---- تحميل القاموس · الدعوة · النتيجة برمزها · استئناف جلسة
  useEffect(() => { (async () => {
    const navLang = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'en';
    await loadCopy(null, []); /* الفهرس أولًا */
    let initialLang = readLang((await copyHas(navLang)) ? navLang : 'en');
    let c = await loadCopy(null, ['en', initialLang]); if (!c) { setErr('copy'); return; } setCopy(c);
    if (resultCode) {
      const r = await fetch(`/api/miaar?result=${encodeURIComponent(resultCode)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (r?.ok) { setReport(r.report); setCode(r.code); setResultName(r.name); setStep('result'); } else { setStep('blocked'); setErr('not_found'); }
      setLangState(initialLang); return;
    }
    if (inviteCode) {
      const r = await fetch(`/api/miaar?invite=${encodeURIComponent(inviteCode)}${inviteToken ? `&t=${encodeURIComponent(inviteToken)}` : ''}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      if (r?.ok) { setInvite(r.invite); setExamMode(r.invite.exam_mode); if (!langPicked.current && (await copyHas(r.invite.lang))) { initialLang = r.invite.lang; c = (await loadCopy(c, [initialLang])) || c; setCopy(c); } if (r.invite.recipient) setCand((v) => ({ ...v, email: r.invite.recipient.email, name: r.invite.recipient.name || v.name })); }
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
    if (probe.length > 0 && Object.keys(probeAns).length >= probe.length) { await startTest(true); return; }  /* حلقات الختم أُكملت على الصفحة الأولى */
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
    } else if (r.decision === 'floor') {
      setToast(x('level_floor')); setTimeout(() => setToast(''), 7000);
      setSession((s) => s ? { ...s, currentLevel: FLOOR_LEVEL, currentLevelIndex: FLOOR_INDEX, direction: r.direction } : s); setQIdx(0);
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
  const cls = `mi ${fontClass}${access.contrast ? ' mi-contrast' : ''}${access.large ? ' mi-large' : ''}`;

  // ---- حلقات الختم (مِسبار على الصفحة الأولى — كما في مِعيار الأصلي)
  const [ringsOn, setRingsOn] = useState(false); const [asked, setAsked] = useState(false); const [door, setDoor] = useState<'comprehensive' | 'adaptive' | null>(null);
  const ringItem = ringsOn && !probeDone ? probe[probeIdx] || null : null;
  const ringsDone = probe.length > 0 && Object.keys(probeAns).length >= probe.length;
  async function beginRings() {
    if (ringsOn) return;
    let items = probe;
    if (!items.length) { const r = await fetch('/api/miaar?probe=1', { cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!r?.ok) { setErr(t('register', 'errNet')); return; } items = r.items; setProbe(items); }
    setProbeAns({}); setProbeIdx(0); setProbeDone(false); setRingsOn(true);
  }
  function answerRing(optionId: string) {
    if (!ringItem) return; const nextAns = { ...probeAns, [ringItem.id]: optionId }; setProbeAns(nextAns);
    if (probeIdx < probe.length - 1) setProbeIdx(probeIdx + 1); else setProbeDone(true);
  }
  function askEnter() { if (invite) { setStep('register'); return; } setAsked(true); setTimeout(() => document.getElementById('mi-doors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
  function chooseDoor(m: 'comprehensive' | 'adaptive') { setDoor(m); setExamMode(m); setTimeout(() => document.getElementById('mi-go')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
  const ringSkill = (k: string) => t('intro', ({ vocab: 'skVocab', structures: 'skStruct', linking: 'skRead', meaning: 'skUnderstand', argument: 'skInfer' } as any)[k] || 'skVocab');
  const ringSizes = ['88%', '62%', '36%', '76%', '50%'];
  const cefr = (lv: Level) => (lang === 'ar' ? CEFR_AR : CEFR_EN)[lv];
  const bandOf = (lv: Level) => lv.startsWith('A') ? 'basic' : lv.startsWith('B') ? 'independent' : 'proficient';
  const bandName = (b: string) => (lang === 'ar' ? BANDS_AR : BANDS_EN)[b];

  // ================= العرض =================
  const Header = ({ admin = false }: { admin?: boolean }) => (
    <div className="mi-top"><header className="mi-head">
      <div className="mi-brandside">
        <a className="mi-brand" href="/" title={x('back_home')}>أَثَر{lang !== 'ar' && <em>{t('intro', 'brand')}</em>}<small>{t('intro', 'brandSub')}</small></a>
        <a className="mi-mark" href="/miaar">مِعيار{lang !== 'ar' && <small>{t('intro', 'mark')}</small>}</a>
      </div>
      <div className="mi-left">
        {admin && <a className="mi-admin" href="/admin/miaar">دخول الإدارة</a>}
        <LangPicker copy={copy} lang={lang} onPick={setLang} label={t('intro', 'pageLang')} search={t('intro', 'langSearch')} none={t('intro', 'langNone')} />
      </div>
    </header></div>
  );
  const Hero = ({ kicker, title, lead, children }: { kicker: string; title: string; lead?: string; children?: React.ReactNode }) => (
    <section className="mi-band"><p className="mi-kicker gold">{kicker}</p><h1>{title}</h1>{lead && <p className="mi-lead">{lead}</p>}{children}</section>
  );
  const Foot = () => <footer className="mi-foot">© 2026 {x('product')} · {x('athar')} · <a href="/accessibility">{lang === 'ar' ? 'الوصولية' : 'Accessibility'}</a></footer>;

  if (step === 'loading' || !copy) return <main className={cls} dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="mi-wrap"><p className="mi-muted" role="status">{err === 'copy' ? 'تعذّر تحميل مِعيار — أعد تحميل الصفحة.' : x('loading')}</p></div></main>;
  if (step === 'blocked') return <main className={cls} dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} /><Header /><Hero kicker={x('product')} title={x('invite_for')} /><div className="mi-wrap"><section className="mi-card"><p className="mi-err" role="alert">{inviteErr ? x('invite_bad') : x('not_found')}</p><a className="mi-btn ghost" href="/miaar">{x('product')}</a></section></div><Foot /></main>;

  const sampleQ = EXAMS[door || examMode];
  return <main className={cls} dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    {step !== 'result' && <Header admin={step === 'intro'} />}
    {toast && <div className="mi-toast" role="status" data-testid="mi-toast">{toast}</div>}

    {step === 'intro' && <>
      <section className={`mi-hero${ringsOn ? ' open' : ''}`} data-testid="mi-intro">
        <div>
          {invite && <div className="mi-invite" data-testid="mi-invite"><b>{x('invite_for')}:</b> {invite.label_ar} · {t('intro', invite.exam_mode === 'adaptive' ? 'adap' : 'comp')}</div>}
          <p className="mi-pill">{t('intro', 'kicker')}</p>
          <h1>{(() => { const h = t('intro', 'h1'); const i = h.indexOf('؟') >= 0 ? h.indexOf('؟') + 1 : h.indexOf('?') >= 0 ? h.indexOf('?') + 1 : -1; return i > 0 ? <>{h.slice(0, i)} <em>{h.slice(i).trim()}</em></> : h; })()}</h1>
          {!ringsOn && <p className="mi-lead">{t('intro', 'lead')}</p>}
          {!ringsOn && <p className="mi-rule">{t('intro', 'rule')}</p>}
          {!ringsOn && <div className="mi-promises">{[1, 2, 3].map((i) => <article key={i}><strong>{t('intro', `p${i}t`)}</strong><span>{t('intro', `p${i}`)}</span></article>)}</div>}
          {ringsOn && <p className="mi-voice">{ringItem ? t('intro', 'voiceN', { n: probeIdx + 1, skill: ringSkill(ringItem.skill) }) : t('intro', 'after')}</p>}
          {!asked && <button type="button" className="mi-go" onClick={askEnter} data-testid="mi-start"><Icon name="play" />{t('intro', 'askEnter')}</button>}
          {asked && <section className="mi-inplace" id="mi-doors">
            <p className="mi-kicker gold">{t('intro', 'entryK')}</p><h2>{t('intro', 'entryH')}</h2>
            <div className="mi-doors">{(['comprehensive', 'adaptive'] as const).map((m) => <button key={m} type="button" className="mi-door" aria-pressed={door === m} onClick={() => chooseDoor(m)} data-testid={`mi-door-${m}`}><strong>{t('intro', m === 'adaptive' ? 'adap' : 'comp')}</strong><span>{t('intro', m === 'adaptive' ? 'adapS' : 'compS')}</span></button>)}</div>
          </section>}
          {door && <section className="mi-inplace" id="mi-go">
            <p className="mi-kicker gold">{t('intro', 'examK')}</p><h2>{t('intro', 'examH')}</h2>
            <p className="mi-voice">{t('intro', 'examNote', { door: t('intro', door === 'comprehensive' ? 'doorComp' : 'doorAdap') })}</p>
            <p className="mi-kicker gold">{t('intro', sampleQ.skill)}</p>
            <div className="mi-arab" dir="rtl" lang="ar"><p className="mi-q">{sampleQ.prompt}</p><div className="mi-opts-arab">{sampleQ.options.map((o) => <button key={o} type="button" lang="ar" dir="rtl">{o}</button>)}</div></div>
            <button type="button" className="mi-go" onClick={() => setStep('register')} data-testid="mi-go-register"><Icon name="next" />{t('intro', 'goRegister')}</button>
          </section>}
        </div>
        <div className="mi-sealbox">
          <div className="mi-stagehead"><span className="mi-dots" aria-hidden="true"><i /><i /><i className="on" /></span><span className="mi-now">الآن في أَثَر <i /></span></div>
          <div className="mi-stagecard">
            <div className="mi-seal">
              <i className="mi-ring" style={{ width: '100%', height: '100%', borderColor: '#0b8a83' }} /><i className="mi-ring" style={{ width: '74%', height: '74%', borderColor: '#14b8a6' }} /><i className="mi-ring" style={{ width: '48%', height: '48%', borderColor: '#0b8a83' }} />
              {Object.keys(probeAns).map((_, i) => <i key={i} className="mi-ring gold" style={{ width: ringSizes[i % ringSizes.length], height: ringSizes[i % ringSizes.length] }} />)}
              <button type="button" className="mi-core" onClick={() => void beginRings()} style={{ fontSize: t('intro', 'start').length > 5 ? 14 : 20 }} data-testid="mi-core">{ringsDone ? '✓' : t('intro', 'start')}</button>
            </div>
            {ringItem && <div style={{ width: '100%' }}>
              <span className="mi-skill">{ringSkill(ringItem.skill)}</span>
              <div className="mi-arab stage" dir="rtl" lang="ar"><p className="mi-q"><span className="mi-lv">{ringItem.level}</span>{ringItem.prompt}</p>
                <div className="mi-opts-arab">{ringItem.options.map((o) => <button key={o.id} type="button" lang="ar" dir="rtl" onClick={() => answerRing(o.id)} data-testid="mi-ring-opt">{o.text}</button>)}</div></div>
            </div>}
            {ringsOn && probeDone && <p className="mi-after">✓ · {t('gate', 'indicator')}</p>}
          </div>
          <p className="mi-cap">{t('intro', 'sealCap')}</p>
          {err && <p className="mi-err" role="alert">{err}</p>}
        </div>
      </section>

      <section className="mi-inner"><div className="mi-split">
        <div><p className="mi-kicker">{t('intro', 'sideK')}</p><h2>{t('intro', 'sideH')}</h2></div>
        <div className="mi-panel"><p>{t('intro', 'side')}</p></div>
      </div></section>

      <section className="mi-inner mi-lvhead">
        <p className="mi-kicker">{t('intro', 'lvK')}</p><h2>{t('intro', 'lvH')}</h2>
        <p className="mi-note">{lang === 'ar' ? 'الإطار الأوروبي المرجعي المشترك للغات (CEFR): ثلاث فئات للمستخدم وستة مستويات. كل صفّ يقول ما يفعله المتعلم بالعربية عند هذا المستوى، ومعه سطر عربي نموذجي.' : 'The Common European Framework of Reference (CEFR): three user bands and six levels. Each row says what the learner can do in Arabic at that level, with a sample Arabic line.'}</p>
      </section>
      <div className="mi-levels">
        {(['basic', 'independent', 'proficient'] as const).map((band) => <div key={band} className={`mi-bandrow ${band}`}>
          <div className="mi-bandhead"><b>{bandName(band)}</b><span>{band === 'basic' ? 'A1 · A2' : band === 'independent' ? 'B1 · B2' : 'C1 · C2'}</span></div>
          {LEVELS.filter((lv) => bandOf(lv) === band).map((lv) => { const c = cefr(lv); return <article key={lv} className="mi-level" data-testid={`mi-level-${lv}`}>
            <div className="mi-lvcode"><b>{lv}</b><small>{c.en}</small></div>
            <div className="mi-lvbody">
              <h3>{c.title}</h3>
              <p className="mi-lvdesc">{c.desc}</p>
              <p className="mi-lvcan"><span>{lang === 'ar' ? 'الكفاءة التواصلية المستهدفة' : 'Target communicative competence'}</span>{c.can}</p>
              <p className="mi-lvline">{t('intro', lv.toLowerCase())}</p>
            </div>
            <p className="mi-specimen" dir="rtl" lang="ar"><small>عربي · {lv}</small>{SAMPLES[lv]}</p>
          </article>; })}
        </div>)}
      </div>

      <section className="mi-band mi-finale"><div className="mi-split">
        <div><p className="mi-kicker gold">{t('intro', 'learnK')}</p><h2>{t('intro', 'learnH')}</h2><p>{t('intro', 'learn')}</p></div>
        <div className="mi-tools">{([['prog', 'progS', '/programs'], ['sim', 'simS', '/sim'], ['kit', 'kitS', '/resources'], ['live', 'liveS', '/on-air']] as const).map(([a, b, href]) => <a key={href} className="mi-tool" href={href}><strong>{t('intro', a)}</strong><span>{t('intro', b)}</span></a>)}</div>
      </div></section>
    </>}

    {step === 'register' && <>
      <Hero kicker={t('register', 'kicker')} title={t('register', 'title')} lead={t('register', 'lead')} />
      <div className="mi-wrap narrow">
        {invite && <div className="mi-invite light" data-testid="mi-invite"><b>{x('invite_for')}:</b> {invite.label_ar} · {t('intro', invite.exam_mode === 'adaptive' ? 'adap' : 'comp')}</div>}
        <button type="button" className="mi-back" onClick={() => setStep('intro')}>{t('register', 'back')}</button>
        <form className="mi-card" onSubmit={submitRegister} data-testid="mi-register">
          <div className="mi-grid1">
            <label>{t('register', 'name')}<input value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })} placeholder={t('register', 'namePh')} maxLength={120} required autoComplete="name" /></label>
            <label>{t('register', 'email')}<input type="email" value={cand.email} onChange={(e) => setCand({ ...cand, email: e.target.value })} readOnly={!!invite?.recipient} maxLength={160} required autoComplete="email" dir="ltr" placeholder="name@example.com" /></label>
            <div className="mi-two">
              <label>{t('register', 'phone')} <small>({t('register', 'phoneOpt')})</small><input value={cand.phone} onChange={(e) => setCand({ ...cand, phone: e.target.value })} maxLength={40} autoComplete="tel" dir="ltr" placeholder="+9665xxxxxxxx" /></label>
              <label>{t('register', 'native')}<select value={cand.nativeLanguage} onChange={(e) => setCand({ ...cand, nativeLanguage: e.target.value })}><option value="">{t('register', 'nativePh')}</option>{(copy.native || []).map((n) => <option key={n.value} value={n.value}>{n.labels[lang] || n.labels.en || n.value}</option>)}</select></label>
            </div>
            <div><span className="mi-label">{t('register', 'studied')}</span><div className="mi-yes">{[true, false].map((v) => <button key={String(v)} type="button" className={cand.studiedBefore === v ? 'on' : ''} onClick={() => setCand({ ...cand, studiedBefore: v })}>{t('register', v ? 'yes' : 'no')}</button>)}</div></div>
            <label>{t('register', 'purpose')}<select value={cand.purpose} onChange={(e) => setCand({ ...cand, purpose: e.target.value })}><option value="">{t('register', 'purposePh')}</option>{PURPOSE.map(([ar, k]) => <option key={k} value={ar}>{t('register', k)}</option>)}</select></label>
            <fieldset className="mi-access" data-testid="mi-access"><legend>{x('access_k')}</legend><p className="mi-muted">{x('access_h')}</p>
              <div className="mi-row"><span className="mi-label">{x('access_time')}:</span>{([1, 1.25, 1.5] as const).map((v) => <label key={v} className="mi-radio"><input type="radio" name="xtime" checked={access.time === v} onChange={() => setAccess({ ...access, time: v })} />{v === 1 ? x('access_none') : `×${v}`}</label>)}</div>
              <div className="mi-row">{(['simple', 'contrast', 'large'] as const).map((k) => <label key={k} className="mi-radio"><input type="checkbox" checked={access[k]} onChange={(e) => setAccess({ ...access, [k]: e.target.checked })} />{x(`access_${k}`)}</label>)}</div>
            </fieldset>
          </div>
          {err && <p className="mi-alert" role="alert" data-testid="mi-err">{err}</p>}
          <button type="submit" className="mi-go wide" disabled={busy} aria-busy={busy || undefined} data-testid="mi-register-submit"><Icon name={busy ? 'spinner' : 'check'} />{busy ? t('register', 'saving') : t('register', 'submit')}</button>
          <p className="mi-note center">{t('register', 'privacy')}</p>
        </form>
      </div>
    </>}

    {step === 'probe' && <>
      <Hero kicker={`${x('probe_k')} · ${t('gate', 'resultKicker')}`} title={x('probe_h')} />
      <div className="mi-wrap narrow"><section className="mi-card" data-testid="mi-probe">
        {!probeDone && probe[probeIdx] && <div>
          <p className="mi-meta">{x('probe_q', { n: probeIdx + 1 })} · {probe[probeIdx].level} · {ringSkill(probe[probeIdx].skill)}</p>
          <div className="mi-arab plain" dir="rtl" lang="ar"><p className="mi-q">{probe[probeIdx].prompt}</p>
            <div className="mi-opts-arab">{probe[probeIdx].options.map((o) => <button key={o.id} type="button" className={probeAns[probe[probeIdx].id] === o.id ? 'on' : ''} onClick={() => { setProbeAns({ ...probeAns, [probe[probeIdx].id]: o.id }); setTimeout(() => { if (probeIdx < probe.length - 1) setProbeIdx(probeIdx + 1); else setProbeDone(true); }, 250); }} data-testid="mi-probe-opt">{o.text}</button>)}</div></div>
          <button type="button" className="mi-link" onClick={() => void startTest(false)} disabled={busy}>{x('probe_skip')}</button>
        </div>}
        {probeDone && <div data-testid="mi-probe-done">
          <div className="mi-result-dark"><p className="mi-kicker gold">{t('gate', 'resultKicker')}</p><strong>{t('gate', 'score', { n: Object.keys(probeAns).length })}</strong><p>{t('gate', 'indicator')}</p></div>
          <p className="mi-touch">{t('gate', 'touch')}</p>
          {err && <p className="mi-alert" role="alert" data-testid="mi-err">{err}</p>}
          <button type="button" className="mi-go" onClick={() => void startTest(true)} disabled={busy} data-testid="mi-begin">{busy ? t('register', 'saving') : x('probe_start')}</button>
        </div>}
      </section></div>
    </>}

    {step === 'test' && session && current && <section className="mi-test" data-testid="mi-test">
      <div className="mi-tbar">
        <div className="mi-levels-strip" aria-hidden="true">{session.currentLevelIndex === FLOOR_INDEX && <span className="now floor">{x('floor_level')}</span>}{LEVELS.map((lv, i) => <span key={lv} className={`${i === session.currentLevelIndex ? 'now' : i < session.currentLevelIndex ? 'done' : ''}${i < session.startLevelIndex ? ' skip' : ''}`}>{lv}</span>)}</div>
        <div className="mi-tools-row">
          <span className="mi-tpill" data-testid="mi-level">{t('test', 'levelNow', { level: session.currentLevel === FLOOR_LEVEL ? x('floor_level') : session.currentLevel })}</span>
          <span className="mi-tpill">{t('test', 'qOf', { a: qIdx + 1, b: levelQs.length })} · <b>{t('test', 'answered', { n: answeredInLevel })}</b></span>
          <span className={`mi-tpill${remaining < 300 ? ' low' : ''}`} aria-live="polite" data-testid="mi-clock">{t('test', 'time', { clock: clock(remaining) })}</span>
          <button type="button" className="mi-link" onClick={() => setShowEnd(true)}>{t('test', 'end')}</button>
        </div>
      </div>
      <div className="mi-progress"><span style={{ width: `${Math.round((answeredInLevel / Math.max(1, levelQs.length)) * 100)}%` }} /></div>
      {access.simple && <p className="mi-simple">{x('simple_test')}</p>}
      <div className={`mi-main${passage ? ' pass' : ''}`}>
        {passage && <aside className="mi-read" data-testid="mi-passage">
          <div className="mi-read-h"><p><strong>{passage.skill === 'listening' ? t('test', 'listening') : t('test', 'reading')}</strong><small>{passage.title} · {passage.level}</small></p></div>
          <div className="mi-read-b">{passage.skill === 'listening' ? <Player key={passage.id} url={passage.audioUrl} title={passage.title} policy={passage.player || { speeds: [1], replays: 1 }} t={(k, v) => t('player', k, v)} x={x} /> : <p className="mi-text" dir="rtl" lang="ar">{passage.text}</p>}</div>
        </aside>}
        <article className={`mi-qcard${deferred.has(current.id) ? ' mark' : ''}`}>
          <div className="mi-tags"><span className={`mi-skilltag ${current.skill === 'reading' ? 'read' : current.skill === 'listening' ? 'listen' : ''}`}>{skillName(current.skill)}</span><span className="mi-leveltag">{current.level === FLOOR_LEVEL ? x('floor_level') : current.level}</span>{deferred.has(current.id) && <span className="mi-flag">{t('test', 'deferred')}</span>}<span className="mi-count">{t('test', 'qOf', { a: qIdx + 1, b: levelQs.length })}</span></div>
          {current.stimulus?.image && <img className="mi-stim" src={current.stimulus.image} alt={current.stimulus.alt || ''} />}
          <h2 className="mi-qtext" dir="rtl" lang="ar">{current.questionText}</h2>
          {current.type === 'picture_choice' && <p className="mi-muted">{x('pick_picture')}</p>}
          <div className={`mi-opts${current.type === 'picture_choice' ? ' pics' : ''}`} role="radiogroup" aria-label={t('test', 'choices')}>
            {current.options.map((o, i) => <button key={o.id} type="button" role="radio" aria-checked={answers[current.id] === o.id} className={`mi-opt${answers[current.id] === o.id ? ' on' : ''}`} onClick={() => void choose(o.id)} data-testid="mi-opt">
              <span className="mi-letter">{letters[i]}</span>{o.image ? <img src={o.image} alt={o.alt || o.text || ''} /> : <span dir="rtl" lang="ar">{optionText(current, o)}</span>}<span className="mi-check" aria-hidden="true">{answers[current.id] === o.id ? '✓' : ''}</span>
            </button>)}
          </div>
          <div className="mi-tfoot">
            <p className="mi-hint">{!access.simple && t('test', 'shortcuts')}</p>
            <div className="mi-actions">
              <button type="button" className={`mi-defer${deferred.has(current.id) ? ' on' : ''}`} onClick={() => setDeferred((d) => { const c = new Set(d); c.has(current.id) ? c.delete(current.id) : c.add(current.id); return c; })} aria-pressed={deferred.has(current.id)}>{deferred.has(current.id) ? t('test', 'clear') : t('test', 'defer')}</button>
              <button type="button" className="mi-next" onClick={() => void next()} disabled={busy} data-testid="mi-next"><Icon name="next" />{t('test', 'next')}</button>
            </div>
          </div>
        </article>
      </div>
      <nav className="mi-nav" aria-label={t('test', 'levelNow', { level: session.currentLevel })}>{levelQs.map((q, i) => <button key={q.id} type="button" className={`mi-num${i === qIdx ? ' now' : ''}${answers[q.id] ? ' ok' : ''}${deferred.has(q.id) ? ' def' : ''}`} onClick={() => setQIdx(i)} aria-current={i === qIdx}>{i + 1}</button>)}</nav>
      {showEnd && <div className="mi-modal" role="dialog" aria-modal="true" aria-label={t('test', 'endMenu')}><div className="mi-card">
        <h3>{t('test', 'endMenu')}</h3><p className="mi-muted">{t('test', 'toReviewHint')}</p>
        <div className="mi-actions"><button type="button" className="mi-defer" onClick={() => setShowEnd(false)}>{t('test', 'cancel')}</button><button type="button" className="mi-next" onClick={() => { setShowEnd(false); setStep('review'); }} data-testid="mi-to-review">{t('test', 'toReview')}</button></div>
      </div></div>}
    </section>}

    {step === 'review' && session && <>
      <Hero kicker={t('review', 'kicker')} title={t('review', 'title')} lead={t('review', 'lead')} />
      <div className="mi-wrap"><section className="mi-card" data-testid="mi-review">
        {(() => { const shown = session.form?.questions.filter((q) => { const li = q.level === FLOOR_LEVEL ? FLOOR_INDEX : (LEVELS as readonly string[]).indexOf(q.level); return li <= Math.max(session.currentLevelIndex, session.startLevelIndex) && li >= Math.min(session.currentLevelIndex, session.startLevelIndex); }) || []; const done = shown.filter((q) => answers[q.id]).length; const pend = shown.length - done;
          return <>
            <div className="mi-stats"><div className="mi-stat"><span>{t('review', 'shown')}</span><b>{shown.length}</b></div><div className="mi-stat"><span>{t('review', 'answered')}</span><b>{done}</b></div><div className="mi-stat"><span>{t('review', 'deferred')}</span><b>{deferred.size}</b></div><div className="mi-stat"><span>{t('review', 'timeLeft')}</span><b>{clock(remaining)}</b></div></div>
            {pend > 0 && <p className="mi-alert soft">{t('review', 'pending', { n: pend })}</p>}
            <div className="mi-nav">{shown.map((q) => <button key={q.id} type="button" className={`mi-num${answers[q.id] ? ' ok' : ''}${deferred.has(q.id) ? ' def' : ''}`} title={`${q.level} · ${skillName(q.skill, true)}`} onClick={() => { if (q.level === session.currentLevel && session.status === 'active' && !session.finishReason) { setQIdx(levelQs.findIndex((z) => z.id === q.id)); setStep('test'); } }}>{q.level} · {shown.indexOf(q) + 1}</button>)}</div>
            <div className="mi-actions">
              {session.status === 'active' && !session.finishReason && <button type="button" className="mi-defer" onClick={() => setStep('test')}>{t('review', 'continue')}</button>}
              <button type="button" className="mi-next" onClick={() => void doFinish('quit')} disabled={busy} data-testid="mi-confirm">{t('review', 'confirm')}</button>
            </div>
          </>; })()}
        {err && <p className="mi-alert" role="alert">{err}</p>}
      </section></div>
    </>}

    {step === 'result' && report && <ResultCard report={report} code={code} name={resultName} lang={lang} t={t} x={x} site={site} copied={copied} onCopy={async () => { try { await navigator.clipboard.writeText(`${site}/miaar/result/${code}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ } }} onLang={setLang} copy={copy} />}
    <Foot />
  </main>;
}

/** الإطار الأوروبي — الصفحة الأولى (نص المالك: الوصف العام للمتعلم + الكفاءة التواصلية المستهدفة) */
const CEFR_AR: Record<Level, { title: string; en: string; desc: string; can: string }> = {
  A1: { title: 'مبتدئ', en: 'Breakthrough', desc: 'مستخدم أساسي', can: 'فهم واستخدام تعبيرات مألوفة يومية، تقديم النفس والآخرين، طرح أسئلة شخصية بسيطة.' },
  A2: { title: 'دون المتوسط', en: 'Waystage', desc: 'مستخدم أساسي', can: 'فهم الجمل والعبارات الشائعة المتعلقة بالمجالات ذات الأهمية المباشرة (المعلومات الشخصية، التسوق).' },
  B1: { title: 'متوسط', en: 'Threshold', desc: 'مستخدم مستقل', can: 'التعامل مع المواقف المتوقعة أثناء السفر، وإنتاج نصوص مترابطة حول مواضيع مألوفة أو اهتمامات شخصية.' },
  B2: { title: 'فوق المتوسط', en: 'Vantage', desc: 'مستخدم مستقل', can: 'فهم الأفكار الرئيسية للنصوص المعقدة، والتحدث بطلاقة وعفوية مع الناطقين الأصليين دون تكلف.' },
  C1: { title: 'متقدم', en: 'Effective Operational Proficiency', desc: 'مستخدم متمكن', can: 'فهم مجموعة واسعة من النصوص الطويلة والصعبة، والتعبير بمرونة وفعالية لأغراض أكاديمية ومهنية.' },
  C2: { title: 'تمكن رفيع', en: 'Mastery', desc: 'مستخدم متمكن', can: 'الاستيعاب بسهولة لكل ما يُسمع أو يُقرأ، والقدرة على صياغة الملخصات وإعادة البنية بطلاقة دقيقة.' },
};
const CEFR_EN: Record<Level, { title: string; en: string; desc: string; can: string }> = {
  A1: { title: 'Beginner', en: 'Breakthrough', desc: 'Basic user', can: 'Understand and use familiar everyday expressions; introduce yourself and others; ask simple personal questions.' },
  A2: { title: 'Elementary', en: 'Waystage', desc: 'Basic user', can: 'Understand sentences and common expressions on areas of immediate relevance (personal information, shopping).' },
  B1: { title: 'Intermediate', en: 'Threshold', desc: 'Independent user', can: 'Deal with situations likely to arise while travelling; produce connected text on familiar topics or personal interests.' },
  B2: { title: 'Upper intermediate', en: 'Vantage', desc: 'Independent user', can: 'Understand the main ideas of complex texts; interact fluently and spontaneously with native speakers without strain.' },
  C1: { title: 'Advanced', en: 'Effective Operational Proficiency', desc: 'Proficient user', can: 'Understand a wide range of demanding, longer texts; express ideas flexibly and effectively for academic and professional purposes.' },
  C2: { title: 'Mastery', en: 'Mastery', desc: 'Proficient user', can: 'Understand with ease virtually everything heard or read; summarise and reconstruct arguments with precise fluency.' },
};
const BANDS_AR: Record<string, string> = { basic: 'مستخدم أساسي', independent: 'مستخدم مستقل', proficient: 'مستخدم متمكن' };
const BANDS_EN: Record<string, string> = { basic: 'Basic user', independent: 'Independent user', proficient: 'Proficient user' };
/** عيّنة «من هذا الباب» — كما في مِعيار الأصلي (عرض فقط، لا تُحتسب) */
const EXAMS: Record<'comprehensive' | 'adaptive', { skill: string; prompt: string; options: string[] }> = {
  comprehensive: { skill: 'skRead', prompt: 'قرأتُ الرسالة مرتين، ثم رددتُ عليها.\nماذا فعلتُ قبل الرد؟', options: ['قرأتُ الرسالة', 'نمتُ', 'سافرتُ', 'أغلقتُ الباب'] },
  adaptive: { skill: 'skVocab', prompt: 'الجو حار. تطلب:', options: ['ماء بارد', 'معطف', 'كتاب', 'قلم'] },
};

function LangPicker({ copy, lang, onPick, label, search, none }: { copy: Copy | null; lang: string; onPick: (v: string) => void; label: string; search: string; none: string }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const langs = copy?.langs || []; const cur = langs.find((l) => l.id === lang);
  const list = langs.filter((l) => !q || l.find.toLowerCase().includes(q.toLowerCase()) || l.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="mi-pick">
    <button type="button" className="mi-langbtn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" aria-label={label} data-testid="mi-lang"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#0b8a83" strokeWidth="1.6" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="#0b8a83" strokeWidth="1.4" /></svg><span>{cur?.name || lang}</span></button>
    {open && <div className="mi-menu" role="listbox"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={search} aria-label={search} />
      {list.map((l) => <button key={l.id} type="button" role="option" aria-selected={l.id === lang} lang={l.id} dir={RTL.has(l.id) ? 'rtl' : 'ltr'} onClick={() => { onPick(l.id); setOpen(false); setQ(''); }}>{l.name}</button>)}{!list.length && <p className="mi-note">{none}</p>}</div>}
  </div>;
}

/** مشغّل الاستماع (م2-أ): تشغيل + إعادات بحسب سياسة المستوى · سرعات 0.75/1/1.25 حتى B1 · «يُقرأ مرتين» لما قبل A1 */
function Player({ url, title, policy, t, x }: { url: string | null; title: string; policy: Player; t: (k: string, v?: any) => string; x: (k: string, v?: any) => string }) {
  const ref = useRef<HTMLAudioElement | null>(null); const [plays, setPlays] = useState(0); const [playing, setPlaying] = useState(false); const [failed, setFailed] = useState(!url); const [speed, setSpeed] = useState(1);
  const MAX = 1 + Math.max(0, policy.replays);
  const play = () => { if (plays >= MAX) return; if (!url || failed) { try { const u = new SpeechSynthesisUtterance(title); u.lang = 'ar-SA'; u.rate = speed; speechSynthesis.speak(u); setPlays(plays + 1); } catch { /* */ } return; } const a = ref.current; if (!a) return; a.currentTime = 0; a.playbackRate = speed; a.play().then(() => { setPlaying(true); setPlays(plays + 1); }).catch(() => setFailed(true)); };
  return <div className="mi-player" role="group" aria-label={t('aria', { title })}>
    {url && <audio ref={ref} src={url} preload="auto" onEnded={() => setPlaying(false)} onError={() => setFailed(true)} />}
    <div className="mi-eq" aria-hidden="true">{[18, 34, 26, 44, 30, 22, 38, 28, 16, 36, 24, 40].map((h, i) => <span key={i} style={{ height: h, opacity: playing ? 1 : 0.45 }} />)}</div>
    <div className="mi-pctl"><button type="button" className="mi-play" onClick={play} disabled={plays >= MAX || playing} data-testid="mi-play">{playing ? '…' : plays === 0 ? `▶ ${t('play')}` : `↻ ${t('replay', { n: MAX - plays })}`}</button><span className="mi-psoft">{x('replays_left', { n: Math.max(0, MAX - Math.max(1, plays)) })}</span></div>
    {policy.speeds.length > 1 && <div className="mi-speed" role="group" aria-label={x('speed')} data-testid="mi-speed"><span>{x('speed')}</span>{policy.speeds.map((v) => <button key={v} type="button" className={v === speed ? 'on' : ''} aria-pressed={v === speed} disabled={playing} onClick={() => { setSpeed(v); if (ref.current) ref.current.playbackRate = v; }}>×{v}</button>)}</div>}
    {policy.twice && <p className="mi-pnote">{x('twice')}</p>}
    {failed && !url && <p className="mi-pnote">{t('tts')}</p>}{failed && url && <p className="mi-pnote">{t('failed')}</p>}
  </div>;
}

function ResultCard({ report, code, name, lang, t, x, site, copied, onCopy, onLang, copy }: { report: any; code: string | null; name: string; lang: string; t: (s: string, k: string, v?: any) => string; x: (k: string, v?: any) => string; site: string; copied: boolean; onCopy: () => void; onLang: (v: string) => void; copy: Copy | null }) {
  const sum = report?.ملخص_التسكين || {}; const demo: Level = sum.المستوى_المثبت || report.المستوى_العام || 'A1'; const entry: Level = sum.مستوى_الالتحاق_المقترح || demo;
  const conf = report?.ميزان_الثقة?.الرمز || 'medium'; const stats = report?.احصائيات || {}; const levels: any[] = report?.مستويات_تفصيلية || [];
  const ar = lang === 'ar'; const canDo = (CAN_DO[demo] || CAN_DO.A1)[ar ? 'ar' : 'en'];
  const url = code ? `${site}/miaar/result/${code}` : ''; const who = report?.بيانات_المتقدم?.الاسم && report.بيانات_المتقدم.الاسم !== '—' ? report.بيانات_المتقدم.الاسم : name;
  const weakest = SKILLS.filter((k) => stats[k]?.answered > 0).sort((a, b) => stats[a].percent - stats[b].percent)[0];
  const sk = (k: string) => t('result', ({ grammar_vocab: 'gShort', reading: 'rShort', listening: 'lShort' } as any)[k]);
  return <section className="mi-result" data-testid="mi-result">
    <div className="mi-top mi-nolink"><header className="mi-head"><div className="mi-brandside"><a className="mi-brand" href="/">أَثَر<small>{t('intro', 'brandSub')}</small></a><a className="mi-mark" href="/miaar">مِعيار</a></div><div className="mi-left"><LangPicker copy={copy} lang={lang} onPick={onLang} label={t('intro', 'pageLang')} search={t('intro', 'langSearch')} none={t('intro', 'langNone')} /></div></header></div>
    <section className="mi-band"><p className="mi-kicker gold">{x('card_k')} · {t('result', 'org')}</p><h1>{who}</h1><p className="mi-lead">{t('result', 'date')}: {new Date(report.تاريخ || Date.now()).toLocaleDateString(ar ? 'ar-SA' : lang)} · {x('nature')}</p></section>
    <div className="mi-wrap"><div className="mi-card">
      <div className="mi-rsplit">
        <div>
          <div className={`mi-rlevel lv-${demo}`} data-testid="mi-demo"><small>{x('card_demo')}</small><b style={sum.دون_A1 ? { fontSize: 26 } : undefined}>{sum.دون_A1 ? (ar ? 'ما قبل A1' : 'Pre-A1') : demo}</b><span>{sum.دون_A1 ? (sum.نقطة_البداية_داخل_A1 || x('pre_a1')) : t('result', demo.toLowerCase())}</span></div>
          <div className="mi-rgrid">
            <div className="mi-rstat"><span>{x('card_entry')}</span><b data-testid="mi-entry">{entry}</b></div>
            <div className="mi-rstat"><span>{x('conf')}</span><b className={`mi-conf ${conf}`} data-testid="mi-conf">{x(`conf_${conf}`)}</b></div>
            <div className="mi-rstat"><span>{t('result', 'percent')}</span><b>{report.النسبة_العامة}% <small>({report.الدرجة_الموضوعية})</small></b></div>
            <div className="mi-rstat"><span>{t('result', 'spent')}</span><b>{report.الوقت_المستغرق}</b></div>
          </div>
          <div className="mi-rec"><span>{x('can_do')}</span><ul>{canDo.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
        <div>
          <h3>{t('result', 'skills')}</h3>
          {SKILLS.map((k) => { const s = stats[k] || { percent: 0, level: '—', answered: 0 }; return <div key={k} className="mi-rskill"><em>{sk(k)}</em><span className="mi-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, s.percent))}%` }} /></span><b>{s.answered ? `${s.percent}%` : '—'}</b><small>{s.level}</small></div>; })}
          <h3>{t('result', 'levels')}</h3>
          <div className="mi-rlevels">{levels.map((l) => <div key={l.level} className={`mi-rlv ${l.status}`}><b>{l.level}</b><span>{l.status === 'skipped' ? '↑' : l.total ? `${l.correct}/${l.total}` : '…'}</span></div>)}</div>
          <h3>{x('next_steps')}</h3>
          <ol className="mi-steps"><li><a href={`/programs?level=${entry}`}>{x('step_programs')}</a></li><li>{x('step_keep')}</li>{weakest && <li>{x('step_weak')} — {sk(weakest)} {stats[weakest].percent}%</li>}</ol>
        </div>
      </div>
      <div className="mi-rec teal"><span>{t('result', 'recommendation')}</span><p>{report.التوصية}</p>{report.تيسيرات && <p className="mi-note">{report.تيسيرات}</p>}<p className="mi-note">{report.ميزان_الثقة?.الشرح || ''} · {report.سبب_الانتهاء} · {report.نمط_الاختبار || ''}{report.نقطة_البداية ? ` · ${x('probe_k')}: ${report.نقطة_البداية}` : ''}</p></div>
      {code && <div className="mi-code"><div><small>{x('result_code')}</small><b dir="ltr" data-testid="mi-code">{code}</b><a href={url} dir="ltr">{url}</a></div><div className="mi-qr" dangerouslySetInnerHTML={{ __html: qrSvg(url, 96, 'M', '#0f2a4e') }} /></div>}
      <div className="mi-actions mi-nolink"><button type="button" className="mi-defer" onClick={() => window.print()}>{t('result', 'print')}</button>{code && <button type="button" className="mi-defer" onClick={onCopy}>{copied ? x('copied') : x('copy_link')}</button>}<a className="mi-next" href={`/programs?level=${entry}`}>{t('result', 'programs')} →</a></div>
    </div></div>
  </section>;
}

const CSS = `
.mi{--navy:#0f2a4e;--ink:#0f172a;--teal:#0b8a83;--teal-deep:#0f5c57;--teal-soft:#e6f4f3;--teal-line:#cfe9e6;--gold:#c9a24b;--gold-line:#ead9a6;--gold-soft:#fbf5e4;--page:#f3f6fa;--line:#e4eaf2;--muted:#64748b;--grad:linear-gradient(135deg,#0f2a4e 0%,#143a66 55%,#0b6b66 100%);min-height:100vh;color:var(--ink);background:linear-gradient(180deg,#f6f8fb,#eef5f4);font-family:var(--font-ar,Tajawal),"Noto Naskh Arabic",system-ui,sans-serif;font-size:17px;line-height:1.6}
.mi *{box-sizing:border-box}.mi a{color:inherit;text-decoration:none}.mi button,.mi input,.mi select{font-family:inherit}
.mi h1,.mi h2,.mi h3{font-weight:900;letter-spacing:0;margin:0}
.mi-large{font-size:20px}.mi-contrast{--navy:#000;--ink:#000;--teal:#004d49;--muted:#222;--grad:linear-gradient(135deg,#000,#0a2a2a)}
.mi-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0}
.mi-head{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:84px;padding:12px 7vw}
.mi-brandside{display:flex;align-items:flex-end;gap:26px;color:var(--navy)}
.mi-brand{font-size:40px;font-weight:900;line-height:1.05}.mi-brand em{font-style:normal;font-size:14px;font-weight:800;color:var(--muted);margin-inline-start:6px}
.mi-brand small,.mi-mark small{display:block;margin-top:3px;color:var(--muted);font-size:11px;font-weight:700;line-height:1.2}
.mi-mark{font-size:30px;font-weight:900;line-height:1;margin-bottom:6px}
.mi-left{display:flex;align-items:center;gap:10px;flex:none}
.mi-admin{display:inline-flex;border:1px solid #cbd5e1;background:#fff;color:var(--navy);border-radius:12px;padding:8px 12px;font-size:14px;font-weight:800;white-space:nowrap}.mi-admin:hover{border-color:var(--teal);color:var(--teal)}
.mi-pick{position:relative}
.mi-langbtn{display:flex;align-items:center;gap:8px;min-width:148px;border:1px solid #cbd5e1;background:#fff;color:var(--navy);border-radius:12px;padding:8px 12px;font-weight:800;font-size:14px;cursor:pointer}.mi-langbtn svg{width:16px;height:16px;flex:none}
.mi-menu{position:absolute;z-index:40;top:calc(100% + 8px);inset-inline-end:0;width:min(320px,calc(100vw - 28px));max-height:min(68vh,480px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 14px 30px rgba(15,42,78,.08);padding:8px}
.mi-menu input{position:sticky;top:0;width:100%;border:0;border-bottom:1px solid #e2e8f0;background:#fff;padding:10px 12px;font:inherit;font-weight:700;color:var(--navy);outline:none}
.mi-menu button{display:block;width:100%;text-align:start;border:0;background:transparent;padding:10px 12px;border-radius:10px;cursor:pointer;font-weight:700;font-size:16px;color:var(--navy)}
.mi-menu button[aria-selected="true"],.mi-menu button:hover{background:#f0fdfa;color:var(--teal)}
.mi-kicker{margin:0;color:var(--teal);font-size:12.5px;font-weight:900;letter-spacing:.02em}.mi-kicker.gold{color:var(--gold)}
.mi-note{color:var(--muted);font-size:14px;line-height:1.7;margin:8px 0 0}.mi-note.center{text-align:center}.mi-muted{color:var(--muted);font-size:14px}
.mi-meta{margin:0 0 10px;color:var(--teal);font-size:13px;font-weight:900}
/* hero */
.mi-hero{position:relative;overflow:hidden;display:grid;gap:42px;align-items:center;padding:64px 7vw 72px;background:var(--grad);color:#fff;min-height:calc(100vh - 84px)}
.mi-hero:before{content:"";position:absolute;inset:auto -120px -220px auto;width:620px;height:620px;border-radius:50%;border:60px solid rgba(255,255,255,.05);pointer-events:none}
.mi-hero:after{content:"";position:absolute;inset:auto auto -260px -140px;width:520px;height:520px;border-radius:50%;border:40px solid rgba(201,162,75,.12);pointer-events:none}
.mi-hero>*{position:relative}
.mi-pill{display:inline-flex;align-items:center;margin:0 0 14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 14px;color:#fff;font-size:13px;font-weight:800}
.mi-hero h1{font-size:clamp(32px,4.4vw,48px);line-height:1.28;margin:10px 0 14px;color:#fff}.mi-hero h1 em{font-style:normal;color:var(--gold)}
.mi-hero p{color:rgba(255,255,255,.85)}.mi-lead{font-size:17px;line-height:1.9;max-width:64ch;margin:0 0 18px}
.mi-rule{margin:0;max-width:64ch;font-size:15px;line-height:1.8;color:rgba(255,255,255,.78)}
.mi-promises{display:flex;gap:22px;flex-wrap:wrap;margin-top:28px}.mi-promises article{display:grid;gap:6px;max-width:200px}
.mi-promises strong{color:var(--gold);font-size:22px;font-weight:900;line-height:1.25}.mi-promises span{color:rgba(255,255,255,.75);font-size:12.5px;line-height:1.55}
.mi-voice{font-size:17px;line-height:1.9;max-width:60ch;margin:0 0 12px}
.mi-invite{display:inline-block;margin:0 0 14px;background:rgba(201,162,75,.16);border:1px solid rgba(201,162,75,.55);border-radius:12px;padding:8px 12px;font-size:13px;font-weight:800;color:#fff}
.mi-invite.light{display:block;background:var(--gold-soft);border-color:var(--gold-line);color:var(--navy);margin:0 0 12px}
.mi-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;min-height:44px;background:var(--gold-500,#c9a24b);color:var(--navy);border:1px solid var(--gold-500,#c9a24b);border-radius:12px;padding:11px 20px;font-weight:900;font-size:15px;cursor:pointer;transition:background-color .15s,transform .12s,box-shadow .15s}.mi-go:hover{background:var(--gold-600,#bb9340);border-color:var(--gold-600,#bb9340);transform:translateY(-1px)}.mi-go:active{background:var(--gold-700,#b58c33);transform:translateY(1px);box-shadow:inset 0 2px 6px rgba(8,26,51,.22)}.mi-go:focus-visible{outline:none;box-shadow:0 0 0 3px #fff,0 0 0 6px var(--teal)}.mi-go:disabled{opacity:.45;cursor:not-allowed}.mi-go>svg:first-child,.mi-next>svg:first-child{width:20px;height:20px;flex:none;border-radius:50%;padding:3px;background:var(--navy);color:#fff;box-sizing:border-box}.mi-go[aria-busy="true"]>svg:first-child{animation:key-spin .9s linear infinite}
.mi-go[aria-busy="true"]{cursor:wait}.mi-go.wide{width:100%;padding:14px 18px;font-size:16px}
.mi-inplace{margin-top:26px;padding-top:22px;border-top:1px solid rgba(255,255,255,.18)}.mi-inplace h2{font-size:clamp(22px,2.6vw,30px);color:#fff;margin:4px 0 10px}
.mi-doors{display:grid;gap:12px;margin-top:8px}
.mi-door{border:1px solid rgba(255,255,255,.45);border-radius:18px;padding:16px 18px;background:transparent;color:#fff;text-align:start;cursor:pointer}
.mi-door strong{display:block;font-size:20px;font-weight:900;margin-bottom:4px}.mi-door span{display:block;color:rgba(255,255,255,.8);font-size:14px;line-height:1.6}
.mi-door:hover,.mi-door[aria-pressed="true"]{background:rgba(255,255,255,.12);border-color:var(--gold)}
.mi-arab{background:#fff;color:var(--navy);border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-top:10px}
.mi-arab.stage{width:100%;background:transparent;color:#fff;border:0;padding:0;box-shadow:none}.mi-arab.stage .mi-q,.mi-arab.stage .mi-q span{color:#fff}
.mi-hero .mi-arab .mi-q,.mi-q{white-space:pre-line;font-family:var(--mi-ruqaa,"Aref Ruqaa"),"Noto Naskh Arabic",serif;font-size:clamp(24px,3vw,34px);line-height:1.7;margin:0 0 14px;color:var(--navy)}
.mi-lv{font-family:var(--font-ar,Tajawal),sans-serif;font-size:13px;font-weight:900;color:var(--gold);margin-inline-end:8px}
.mi-opts-arab{display:grid;gap:8px}.mi-opts-arab button{border:1px solid #e2e8f0;background:#fff;color:var(--navy);border-radius:12px;padding:12px 14px;font-weight:900;font-size:15px;cursor:pointer;text-align:right}
.mi-opts-arab button:hover,.mi-opts-arab button.on{background:var(--gold);border-color:var(--gold);color:#1f2937}
.mi-sealbox{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:24px;padding:16px;backdrop-filter:blur(6px)}
.mi-stagehead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:#fff;font-size:13px;font-weight:800}
.mi-dots{display:flex;gap:5px;align-items:center}.mi-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.35)}.mi-dots i.on{width:22px;border-radius:4px;background:var(--gold)}
.mi-now{display:inline-flex;align-items:center;gap:8px}.mi-now i{width:8px;height:8px;border-radius:50%;background:var(--gold)}
.mi-stagecard{border-radius:18px;padding:22px 18px 18px;background:linear-gradient(160deg,#0f2a4e,#1b4a80);display:grid;justify-items:center;gap:14px}
.mi-seal{position:relative;width:min(78vw,380px);height:min(78vw,380px)}.mi-hero.open .mi-seal{width:min(62vw,300px);height:min(62vw,300px)}
.mi-ring{position:absolute;left:50%;top:50%;border-radius:50%;border:3px solid #0b8a83;transform:translate(-50%,-50%)}
.mi-ring.gold{border-color:var(--gold);transform:translate(-50%,-50%) scale(.2);opacity:0;animation:miMint .7s ease forwards}
@keyframes miMint{to{transform:translate(-50%,-50%) scale(1);opacity:1}}
.mi-core{position:absolute;left:50%;top:50%;width:140px;height:140px;transform:translate(-50%,-50%);border:1px solid var(--gold);border-radius:50%;background:var(--gold);color:var(--navy);font-weight:900;line-height:1.15;cursor:pointer;padding:8px;box-shadow:0 8px 18px rgba(15,42,78,.25)}
.mi-core:focus-visible,.mi-door:focus-visible,.mi-opts-arab button:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
.mi-cap{margin:12px 0 2px;text-align:center;color:rgba(255,255,255,.78);font-size:13px;line-height:1.7}
.mi-skill{display:block;margin:0 0 8px;color:var(--gold);font-size:12px;font-weight:900}
.mi-after{margin:0;color:#fff;font-weight:800;text-align:center;line-height:1.7}
.mi-sealbox .mi-err{color:#fecaca;margin:8px 0 0;font-weight:800;font-size:13px}
/* bands below hero */
.mi-inner{padding:48px 7vw 8px}.mi-inner h2{font-size:clamp(26px,3.4vw,38px);color:var(--navy);margin:6px 0 10px;line-height:1.35}
.mi-split{display:grid;gap:28px;align-items:center}
.mi-panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;color:#334155;line-height:1.85;box-shadow:0 10px 28px rgba(15,42,78,.06)}.mi-panel p{margin:0}
.mi-lvhead{padding-top:40px}.mi-lvhead .mi-note{max-width:78ch}
.mi-levels{padding:18px 7vw 40px;display:grid;gap:22px}
.mi-bandrow{display:grid;gap:10px}
.mi-bandhead{display:flex;align-items:baseline;gap:12px;padding:0 4px}.mi-bandhead b{font-size:18px;font-weight:900;color:var(--navy)}.mi-bandhead span{font-size:12px;font-weight:900;color:var(--gold);direction:ltr}
.mi-bandrow.basic .mi-lvcode b{background:var(--teal)}.mi-bandrow.independent .mi-lvcode b{background:var(--navy)}.mi-bandrow.proficient .mi-lvcode b{background:#8a6a14}
.mi-level{display:grid;grid-template-columns:110px 1fr minmax(220px,.9fr);gap:8px 18px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px 18px;box-shadow:0 6px 18px rgba(15,42,78,.05)}
.mi-lvcode{display:grid;gap:6px;justify-items:center;text-align:center}.mi-lvcode b{display:grid;place-items:center;width:84px;height:56px;border-radius:14px;color:#fff;font-size:28px;font-weight:900}.mi-lvcode small{color:var(--muted);font-size:11px;font-weight:800;line-height:1.3;direction:ltr}
.mi-lvbody h3{font-size:17px;color:var(--navy);margin:0 0 4px}.mi-lvdesc{margin:0 0 6px;display:inline-block;border-radius:999px;background:var(--gold-soft);border:1px solid var(--gold-line);color:#8a6a14;padding:2px 10px;font-size:12px;font-weight:900}
.mi-lvcan{margin:0;color:#334155;font-size:15px;line-height:1.7}.mi-lvcan span{display:block;color:var(--teal);font-size:11.5px;font-weight:900}
.mi-lvline{margin:6px 0 0;color:var(--muted);font-size:13.5px;line-height:1.6}
.mi-specimen{margin:0;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:16px;padding:12px 14px;font-family:var(--mi-ruqaa,"Aref Ruqaa"),"Noto Naskh Arabic",serif;font-size:clamp(20px,1.8vw,26px);line-height:1.6;color:var(--navy)}
.mi-specimen small{display:block;font-family:var(--font-ar,Tajawal),sans-serif;font-size:11px;font-weight:900;color:#8a6a14;margin-bottom:2px}
.mi-band{background:var(--grad);color:#fff;padding:34px 7vw 48px}.mi-band h1{font-size:clamp(28px,4vw,44px);line-height:1.3;margin:8px 0;color:#fff}.mi-band h2{font-size:clamp(24px,3vw,34px);color:#fff;margin:6px 0 10px}.mi-band p{color:rgba(255,255,255,.85)}
.mi-band .mi-lead{margin:0}
.mi-finale{padding:56px 7vw 64px}.mi-tools{display:grid;gap:10px}
.mi-tool{background:#fff;color:var(--navy);border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;box-shadow:0 10px 28px rgba(15,42,78,.06)}.mi-tool strong{display:block;color:var(--navy)!important;font-size:17px;font-weight:900;margin-bottom:4px}.mi-tool span{display:block;line-height:1.6;color:#64748b;font-size:14px}
.mi-tool:hover{border-color:var(--gold)}
/* cards / forms */
.mi-wrap{max-width:1000px;margin:-28px auto 48px;padding:0 18px;position:relative}.mi-wrap.narrow{max-width:760px}
.mi-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:26px;box-shadow:0 2px 6px rgba(15,42,78,.05),0 10px 28px rgba(15,42,78,.06)}
.mi-card h3{font-size:16px;color:var(--navy);margin:16px 0 8px}
.mi-back{border:0;background:transparent;color:var(--navy);font-weight:800;font-size:15px;cursor:pointer;padding:0 0 10px}
.mi-grid1{display:grid;gap:14px}.mi-two{display:grid;gap:14px}
.mi label,.mi-label{display:block;margin-bottom:6px;color:#334155;font-size:14px;font-weight:800}.mi label small{color:var(--muted);font-weight:700}
.mi input,.mi select{width:100%;border:1px solid #cbd5e1;border-radius:14px;background:#fff;color:var(--navy);padding:13px 14px;font:inherit;font-weight:700;outline:none;margin-top:6px}
.mi input:focus,.mi select:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(11,138,131,.18)}
.mi-yes{display:flex;gap:8px}.mi-yes button{flex:1;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:14px;padding:12px;font-weight:800;cursor:pointer}.mi-yes button.on{border-color:var(--teal);background:var(--teal-soft);color:var(--teal-deep)}
.mi-access{border:1px dashed var(--gold-line);background:var(--gold-soft);border-radius:16px;padding:12px 14px;margin:0}.mi-access legend{padding:0 6px;color:#8a6a14;font-weight:900;font-size:13px}.mi-access .mi-muted{margin:0 0 8px}
.mi-row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:6px}.mi-row .mi-label{margin:0}
.mi-radio{display:inline-flex !important;align-items:center;gap:6px;margin:0 !important;font-weight:700 !important;color:var(--navy) !important}.mi-radio input{width:auto;margin:0;padding:0}
.mi-alert{margin:14px 0 0;border:1px solid #f6c4c4;background:#fef2f2;color:#b91c1c;border-radius:14px;padding:12px 14px;font-weight:800;line-height:1.6}
.mi-alert.soft{border-color:var(--gold-line);background:var(--gold-soft);color:var(--navy)}
.mi-err{color:#b91c1c;font-weight:800;margin:8px 0}
.mi-link{border:0;background:transparent;color:var(--teal);font-weight:800;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:6px 0;font-size:14px}
.mi-result-dark{border-radius:22px;padding:22px;color:#fff;background:linear-gradient(135deg,#0f2a4e,#1b4a80)}.mi-result-dark strong{display:block;margin-top:8px;font-size:34px}.mi-result-dark p{margin:8px 0 0;color:#d5e0ea;line-height:1.8}
.mi-touch{margin:14px 0 0;border:1px solid var(--line);border-radius:22px;background:#fff;padding:18px;color:var(--navy);font-weight:800;line-height:1.9}
/* test runner */
.mi-test{padding-bottom:48px}
.mi-tbar{position:sticky;top:84px;z-index:15;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 7vw;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0}
.mi-levels-strip{display:flex;gap:6px;direction:ltr}.mi-levels-strip span{display:grid;place-items:center;min-width:36px;height:28px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#94a3b8;font-size:12px;font-weight:900}
.mi-levels-strip .done{background:var(--teal-soft);color:var(--teal-deep);border-color:var(--teal-line)}.mi-levels-strip .now{background:var(--navy);color:#fff;border-color:var(--navy)}.mi-levels-strip .skip{opacity:.45}
.mi-tools-row{margin-inline-start:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.mi-tpill{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;color:var(--navy);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800}.mi-tpill b{color:var(--teal)}.mi-tpill.low{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
.mi-progress{height:4px;background:#e2e8f0}.mi-progress span{display:block;height:100%;background:var(--teal);transition:width .3s}
.mi-simple{max-width:1100px;margin:14px auto 0;padding:10px 18px;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:12px;color:var(--navy);font-weight:800}
.mi-main{display:grid;gap:18px;max-width:1100px;margin:0 auto;padding:22px 18px 10px}
@media(min-width:980px){.mi-main.pass{grid-template-columns:minmax(280px,2fr) minmax(0,3fr);align-items:start}.mi-read{position:sticky;top:150px}}
.mi-read,.mi-qcard{background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 2px 6px rgba(15,42,78,.05),0 10px 28px rgba(15,42,78,.06);overflow:hidden}
.mi-qcard{padding:26px}.mi-qcard.mark{border-color:var(--gold);box-shadow:0 0 0 4px rgba(201,162,75,.16)}
.mi-read-h{display:flex;gap:10px;align-items:center;padding:16px 18px;color:#fff;background:var(--grad)}.mi-read-h p{margin:0}.mi-read-h strong{display:block}.mi-read-h small{color:rgba(255,255,255,.75)}
.mi-read-b{padding:18px 20px;color:#0f172a;font-size:18px;line-height:1.9}.mi-text{margin:0;white-space:pre-line}
.mi-tags{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
.mi-skilltag{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;border:1px solid var(--teal-line);background:var(--teal-soft);color:var(--teal-deep)}
.mi-skilltag.read{background:#f8fafc;border-color:#e2e8f0;color:var(--navy)}.mi-skilltag.listen{background:var(--gold-soft);border-color:var(--gold-line);color:var(--navy)}
.mi-leveltag{border-radius:999px;background:var(--navy);color:#fff;padding:5px 10px;font-size:12px;font-weight:900}
.mi-flag{border-radius:999px;background:var(--gold);color:#1f2937;padding:5px 10px;font-size:12px;font-weight:900}
.mi-count{margin-inline-start:auto;color:var(--muted);font-size:12px;font-weight:800}
.mi-qtext{margin:0 0 18px;color:#0f172a;font-size:clamp(22px,2.4vw,28px);line-height:1.8;font-weight:800;white-space:pre-line}
.mi-stim{display:block;max-width:100%;max-height:260px;border-radius:14px;border:1px solid var(--line);margin:0 0 14px}
.mi-opts{display:grid;gap:10px}.mi-opts.pics{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.mi-opt{display:flex;align-items:center;gap:12px;width:100%;text-align:start;border:1px solid #dbe3ea;background:#fff;border-radius:16px;padding:14px;cursor:pointer;color:#334155;font-weight:700;font-size:16px;line-height:1.7}
.mi-opt.on{border-color:var(--teal);background:var(--teal-soft);color:var(--teal-deep)}.mi-opt img{max-width:100%;max-height:140px;border-radius:10px}
.mi-letter{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;flex:none;background:var(--teal-soft);color:var(--teal);font-weight:900}.mi-opt.on .mi-letter{background:var(--teal);color:#fff}
.mi-check{margin-inline-start:auto;display:grid;place-items:center;width:28px;height:28px;border-radius:999px;border:1px solid #dbe3ea;background:#fff;flex:none;font-size:13px}.mi-opt.on .mi-check{background:var(--teal);border-color:var(--teal);color:#fff}
.mi-tfoot{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;padding-top:16px;border-top:1px solid #e2e8f0}
.mi-hint{max-width:42ch;color:var(--muted);font-size:12px;line-height:1.6;margin:0}
.mi-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.mi-tfoot .mi-actions{margin:0}
.mi-defer,.mi-next{border-radius:12px;padding:13px 18px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:15px}
.mi-defer{border:1px solid #dbe3ea;background:#fff;color:var(--navy)}.mi-defer.on{border-color:var(--gold);background:var(--gold-soft)}
.mi-next{border:1px solid var(--gold-500,#c9a24b);background:var(--gold-500,#c9a24b);color:var(--navy);transition:background-color .15s,transform .12s,box-shadow .15s}.mi-next:hover{background:var(--gold-600,#bb9340);border-color:var(--gold-600,#bb9340)}.mi-next:active{background:var(--gold-700,#b58c33);transform:translateY(1px);box-shadow:inset 0 2px 6px rgba(8,26,51,.22)}.mi-next:focus-visible{outline:none;box-shadow:0 0 0 3px #fff,0 0 0 6px var(--teal)}.mi-next:disabled{border-color:#e2e8f0;background:#e2e8f0;color:#94a3b8;cursor:not-allowed}
.mi-nav{display:flex;flex-wrap:wrap;gap:6px;max-width:1100px;margin:6px auto 0;padding:0 18px}
.mi-num{min-width:40px;height:40px;border-radius:12px;border:1px solid #dbe3ea;background:#fff;color:var(--navy);font-weight:900;cursor:pointer;padding:0 10px;font-size:13px}
.mi-num.ok{background:var(--teal-soft);border-color:var(--teal-line);color:var(--teal-deep)}.mi-num.def{border-color:var(--gold);background:var(--gold-soft)}.mi-num.now{outline:2px solid var(--navy);outline-offset:1px}
.mi-toast{position:fixed;top:96px;left:50%;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:8px;border-radius:16px;padding:12px 16px;font-weight:900;box-shadow:0 14px 30px rgba(15,42,78,.16);background:var(--navy);color:#fff;max-width:min(92vw,560px);text-align:center}
.mi-modal{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(15,42,78,.6);padding:16px}.mi-modal .mi-card{width:min(520px,100%)}.mi-modal h3{margin:0 0 6px}
/* player */
.mi-player{color:#fff;border-radius:18px;background:var(--grad);padding:18px}
.mi-eq{display:flex;align-items:flex-end;justify-content:center;gap:6px;height:56px;margin-bottom:14px}.mi-eq span{width:6px;border-radius:999px;background:var(--gold);transition:opacity .3s}
.mi-pctl{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
.mi-play{border:1px solid var(--gold);background:var(--gold);color:#1f2937;border-radius:999px;padding:12px 20px;font-weight:900;cursor:pointer}.mi-play:disabled{opacity:.4;cursor:not-allowed}
.mi-psoft{color:rgba(255,255,255,.8);font-size:12px;font-weight:800}
.mi-speed{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font-size:12px;color:rgba(255,255,255,.85)}.mi-speed button{border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;border-radius:999px;padding:4px 10px;font-weight:800;cursor:pointer;min-width:44px;min-height:28px}.mi-speed button.on{background:#fff;color:var(--navy)}.mi-speed button:disabled{opacity:.5;cursor:not-allowed}
.mi-levels-strip .floor{min-width:auto;padding:0 8px;background:var(--gold);color:#1f2937;border-color:var(--gold)}
.mi-pnote{margin:12px 0 0;border:1px solid rgba(201,162,75,.55);background:rgba(201,162,75,.16);border-radius:12px;padding:8px 12px;text-align:center;font-size:12px;font-weight:800}
/* review */
.mi-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px}
.mi-stat{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;text-align:center;box-shadow:0 8px 22px rgba(15,42,78,.05)}.mi-stat span{display:block;color:var(--muted);font-size:12px;font-weight:800}.mi-stat b{display:block;margin-top:4px;color:var(--navy);font-size:26px}
/* result */
.mi-rsplit{display:grid;gap:22px}
.mi-rlevel{display:grid;gap:4px;justify-items:start;border-radius:18px;background:var(--navy);color:#fff;padding:16px 18px}.mi-rlevel small{color:rgba(255,255,255,.75);font-size:12px;font-weight:800}.mi-rlevel b{font-size:46px;line-height:1.05}.mi-rlevel span{color:#d5e0ea;font-size:14px;line-height:1.6}
.mi-rgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px}
.mi-rstat{background:#f6f8fb;border-radius:16px;padding:12px}.mi-rstat span{display:block;color:var(--muted);font-size:12px;font-weight:800}.mi-rstat b{display:block;margin-top:4px;color:var(--navy);font-size:18px}.mi-rstat b small{color:var(--muted);font-size:12px}
.mi-conf.high{color:var(--teal-deep)}.mi-conf.medium{color:#8a6a14}.mi-conf.border{color:#b91c1c}
.mi-rec{margin-top:14px;border:1px solid var(--gold-line);background:var(--gold-soft);border-radius:16px;padding:14px}.mi-rec.teal{border-color:var(--teal-line);background:var(--teal-soft)}
.mi-rec span{color:var(--teal);font-size:12px;font-weight:900}.mi-rec p{margin:8px 0 0;line-height:1.8}.mi-rec ul{margin:8px 0 0;padding-inline-start:18px;line-height:1.9}
.mi-rskill{display:flex;align-items:center;gap:8px;margin-top:10px}.mi-rskill em{width:110px;font-style:normal;text-align:center;border:1px solid #e2e8f0;border-radius:999px;padding:4px 6px;font-size:12px;font-weight:800;color:var(--navy)}
.mi-track{flex:1;height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden}.mi-track i{display:block;height:100%;background:var(--teal)}
.mi-rskill b{width:44px;font-size:12px}.mi-rskill small{border-radius:8px;background:var(--teal-soft);color:var(--teal-deep);padding:3px 6px;font-weight:900}
.mi-rlevels{display:flex;flex-wrap:wrap;gap:8px;direction:ltr}.mi-rlv{border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:8px 10px;text-align:center;min-width:58px}
.mi-rlv.passed{border-color:var(--teal-line);background:var(--teal-soft)}.mi-rlv.failed{border-color:#fecaca;background:#fef2f2}.mi-rlv.skipped{opacity:.6}.mi-rlv b,.mi-rlv span{display:block}.mi-rlv span{color:var(--muted);font-size:12px;font-weight:800}
.mi-steps{margin:0;padding-inline-start:18px;line-height:1.9}.mi-steps a{color:var(--teal);text-decoration:underline;text-underline-offset:3px}
.mi-code{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;border:1px solid var(--line);border-radius:16px;padding:14px;background:#f8fafc}
.mi-code small{display:block;color:var(--muted);font-size:12px;font-weight:800}.mi-code b{display:block;font-size:22px;color:var(--navy);letter-spacing:.04em}.mi-code a{display:block;color:var(--teal);font-size:13px;text-decoration:underline;text-underline-offset:3px;word-break:break-all}
.mi-qr{background:#fff;border-radius:12px;padding:6px;border:1px solid var(--line)}.mi-qr svg{display:block}
.mi-foot{text-align:center;color:var(--muted);font-size:13px;padding:18px 7vw 28px}.mi-foot a{text-decoration:underline;text-underline-offset:3px}
@media(min-width:720px){.mi-two{grid-template-columns:1fr 1fr}.mi-stats{grid-template-columns:repeat(4,1fr)}.mi-rgrid{grid-template-columns:repeat(4,1fr)}}
@media(min-width:980px){.mi-hero{grid-template-columns:1.1fr .9fr}.mi-split{grid-template-columns:1fr 1fr}.mi-doors{grid-template-columns:1fr 1fr}.mi-rsplit{grid-template-columns:2fr 3fr}}
@media(max-width:860px){.mi-level{grid-template-columns:84px 1fr}.mi-specimen{grid-column:1 / -1}}
@media(max-width:720px){.mi-head{min-height:72px;padding:10px 16px;gap:10px}.mi-brand{font-size:30px}.mi-brand small{display:none}.mi-mark{font-size:22px}.mi-hero{padding:36px 16px 48px;min-height:0}.mi-inner,.mi-levels,.mi-band,.mi-finale{padding-left:16px;padding-right:16px}.mi-tbar{top:72px;padding:8px 16px}.mi-langbtn{min-width:0}.mi-level{grid-template-columns:1fr}.mi-lvcode{justify-items:start;grid-auto-flow:column;align-items:center;gap:10px}}
@media(prefers-reduced-motion:reduce){.mi-ring.gold{animation:none;opacity:1;transform:translate(-50%,-50%)}}
@media print{.mi-top,.mi-actions,.mi-nolink,.mi-foot{display:none !important}.mi,.mi-band{background:#fff !important;color:#0f172a !important}.mi-band h1,.mi-band p,.mi-kicker{color:#0f172a !important}.mi-wrap{margin-top:0}.mi-card{box-shadow:none;border:0}}
`;
