'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { FlowShell, Stations, StepCard, FlowNav, useStepScroll, type Station, type StationState } from '../../components/StepFlow'; /* هـ-3 ن «محطّات» */
import { PERCENT_STEPS, ROLE_LABEL } from '../../../lib/behavior/model';
import type { BehaviorQuestion, Role } from '../../../lib/behavior/model';

type FormData = {
  followup: { id: string; title_ar: string; title_en: string | null; intro_ar: string | null; status: string; scale_max: number; supervisor_open: boolean; trainee_open: boolean; program_name: string | null; program_name_en: string | null; program_end: string | null; classroom_code: string | null };
  questions: BehaviorQuestion[];
};
type Result = { ok: boolean; error?: string; scale_mean?: number | null; application_pct?: number | null };

const T = {
  ar: {
    kicker: 'متابعة أثر التدريب في بيئة العمل', loading: 'جارٍ التحميل…', none: 'الرابط غير صحيح أو انتهت صلاحيته.', closed: 'انتهت فترة المتابعة لهذه الحملة.',
    whoAreYou: 'بصفتك:', you: 'بياناتك', yourName: 'اسمك', yourEmail: 'بريدك الإلكتروني', trainee: 'المشارك الذي تقيّمه', traineeName: 'اسم المشارك', traineeEmail: 'بريد المشارك (إن وُجد — يساعد في مطابقة التقييمين)',
    intro: 'مرّ وقت كافٍ منذ ختام البرنامج. نرجو تقييم ما تم تطبيقه فعليًا في العمل — إجاباتك تُستخدم لتحسين البرامج القادمة فقط.',
    scaleHint: '1 = لا ينطبق إطلاقًا · 5 = ينطبق بدرجة كبيرة', submit: 'إرسال التقييم', saving: 'جارٍ الإرسال…', required: 'يرجى الإجابة عن البنود المطلوبة', thanks: 'شكرًا لك — تم استلام تقييمك', thanksSub: 'مساهمتك تساعدنا على قياس الأثر الحقيقي للتدريب وتحسينه.',
    yourMean: 'متوسط تقديرك', yourApp: 'نسبة التطبيق', optional: 'اختياري', other: 'أخرى (اكتب)',
    errors: { not_found: 'الرابط غير صحيح.', closed: 'انتهت فترة المتابعة.', bad_role: 'دور غير صحيح.', role_closed: 'هذا الدور غير مفعّل في هذه الحملة.', bad_name: 'اكتب اسمك الكامل.', bad_trainee: 'اكتب اسم المشارك.', empty: 'أجب عن بند واحد على الأقل.' } as Record<string, string>,
  },
  en: {
    kicker: 'On-the-job training impact follow-up', loading: 'Loading…', none: 'Invalid or expired link.', closed: 'This follow-up campaign has ended.',
    whoAreYou: 'You are:', you: 'Your details', yourName: 'Your name', yourEmail: 'Your email', trainee: 'Trainee being rated', traineeName: 'Trainee name', traineeEmail: 'Trainee email (if available — helps pair both ratings)',
    intro: 'Enough time has passed since the program ended. Please rate what has actually been applied at work — answers are used only to improve future programs.',
    scaleHint: '1 = not at all · 5 = to a great extent', submit: 'Submit', saving: 'Submitting…', required: 'Please answer the required items', thanks: 'Thank you — your response was received', thanksSub: 'Your input helps us measure and improve real training impact.',
    yourMean: 'Your average rating', yourApp: 'Application rate', optional: 'optional', other: 'Other (type)',
    errors: { not_found: 'Invalid link.', closed: 'Follow-up has ended.', bad_role: 'Invalid role.', role_closed: 'This role is not enabled for this campaign.', bad_name: 'Enter your full name.', bad_trainee: 'Enter the trainee name.', empty: 'Answer at least one item.' } as Record<string, string>,
  },
};

export function FollowupForm({ token, initialRole, traineeName, traineeEmail }: { token: string; initialRole: Role | null; traineeName: string; traineeEmail: string }) {
  const db = supabase();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const t = T[lang];
  const [data, setData] = useState<FormData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [role, setRole] = useState<Role | null>(initialRole);
  const [me, setMe] = useState({ name: '', email: '' });
  const [tr, setTr] = useState({ name: traineeName, email: traineeEmail });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  /* هـ-3 ن «محطّات»: 0 الصفة والبيانات · 1..n مجال لكل محطّة — والإرسال في الأخيرة */
  const [step, setStep] = useState(0); const [reached, setReached] = useState(0); const [stepErr, setStepErr] = useState('');
  useStepScroll(step);

  useEffect(() => {
    (async () => {
      const { data: d, error } = await db.rpc('behavior_form', { p_token: token });
      if (error) { setErr(error.message); setState('error'); return; }
      if (!d || !(d as any).followup) { setState('none'); return; }
      const fd = d as FormData; setData(fd);
      if (!initialRole) { if (fd.followup.supervisor_open && !fd.followup.trainee_open) setRole('supervisor'); else if (!fd.followup.supervisor_open && fd.followup.trainee_open) setRole('trainee'); }
      setState('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const f = data?.followup;
  const qs = useMemo(() => (data?.questions || []).filter(q => q.audience === 'all' || q.audience === role), [data, role]);
  const max = f?.scale_max || 5;
  const label = (q: BehaviorQuestion) => (lang === 'en' && q.text_en ? q.text_en : q.text_ar);

  function toggleMulti(qid: string, opt: string) {
    setAnswers(a => { const cur: string[] = Array.isArray(a[qid]) ? a[qid] : []; return { ...a, [qid]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] }; });
  }

  const domains = useMemo(() => { const m = new Map<string, BehaviorQuestion[]>(); qs.forEach(q => { const k = q.domain_ar || (lang === 'en' ? 'General' : 'عام'); if (!m.has(k)) m.set(k, []); m.get(k)!.push(q); }); return Array.from(m.entries()); }, [qs, lang]);
  const unanswered = (q: BehaviorQuestion) => q.required !== false && q.kind !== 'text' && (answers[q.id] == null || (Array.isArray(answers[q.id]) && !answers[q.id].length));
  const has = (q: BehaviorQuestion) => !(answers[q.id] == null || answers[q.id] === '' || (Array.isArray(answers[q.id]) && !answers[q.id].length));
  function infoErr(): string { if (!role) return t.errors.bad_role; if (me.name.trim().length < 3) return t.errors.bad_name; if (role !== 'trainee' && tr.name.trim().length < 3) return t.errors.bad_trainee; return ''; }

  async function submit() {
    setErr('');
    const ie = infoErr(); if (ie) { setStep(0); setStepErr(ie); return; }
    const miss = qs.filter(unanswered).map(q => q.id);
    if (miss.length) { setMissing(miss); const di = domains.findIndex(([, items]) => items.some(q => miss.includes(q.id))); setStep(di + 1); setStepErr(t.required); return; }
    setMissing([]); setStepErr(''); setSaving(true);
    try {
      const payload: Record<string, any> = { ...answers };
      for (const q of qs) if (q.kind === 'multi' && other[q.id]?.trim()) payload[q.id] = [...(Array.isArray(payload[q.id]) ? payload[q.id] : []), other[q.id].trim()];
      const { data: d, error } = await db.rpc('behavior_submit', { p_token: token, p_role: role, p_respondent_name: me.name.trim(), p_respondent_email: me.email.trim() || null, p_trainee_name: role === 'trainee' ? me.name.trim() : tr.name.trim(), p_trainee_email: role === 'trainee' ? (me.email.trim() || null) : (tr.email.trim() || null), p_answers: payload });
      if (error) throw new Error(error.message);
      const r = d as Result;
      if (!r.ok) { setStepErr(t.errors[r.error || ''] || r.error || 'error'); return; }
      setResult(r); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (ex: any) { setStepErr(ex.message || 'error'); } finally { setSaving(false); }
  }

  /* ---------------- محطّات ---------------- */
  const st = (done: number, total: number, missNow: boolean): StationState => missNow ? 'miss' : done >= total ? 'done' : done > 0 ? 'part' : 'todo';
  const infoDone = (role ? 1 : 0) + (me.name.trim().length >= 3 ? 1 : 0) + (role === 'trainee' || tr.name.trim().length >= 3 ? 1 : 0);
  const stations: Station[] = [
    { key: 'info', title: t.you, state: st(infoDone, 3, step === 0 && !!stepErr), done: infoDone, total: 3 },
    ...domains.map(([dom, items], di) => { const done = items.filter(has).length; const req = items.filter(q => q.required !== false && q.kind !== 'text'); return { key: dom, title: dom, state: st(done, items.length, (step === di + 1 && !!stepErr) || items.some(q => missing.includes(q.id) && unanswered(q))), done, total: items.length, optional: req.length === 0 }; }),
  ];
  const N = stations.length;
  function go(i: number) { setStepErr(''); setStep(i); setReached(r => Math.max(r, i)); }
  function next() {
    if (step === 0) { const e = infoErr(); if (e) { setStepErr(e); return; } if (!qs.length) { setStepErr(t.errors.empty || t.required); return; } }
    else { const m = (domains[step - 1]?.[1] || []).filter(unanswered).map(q => q.id); if (m.length) { setMissing(x => Array.from(new Set([...x, ...m]))); setStepErr(t.required); return; } }
    go(Math.min(N - 1, step + 1));
  }
  function prev() { setStepErr(''); setStep(s => Math.max(0, s - 1)); }
  const pick = (qid: string, v: any) => { setAnswers(a => ({ ...a, [qid]: v })); setMissing(m => m.filter(x => x !== qid)); setStepErr(''); };

  const kicker = <><Icon name="trend" size={14} /> {t.kicker}</>;
  const title = f ? (lang === 'en' && f.title_en ? f.title_en : f.title_ar) : t.kicker;
  const line = f ? <><Icon name="book" size={14} /> {lang === 'en' && f.program_name_en ? f.program_name_en : f.program_name}{f.classroom_code ? ` · ${f.classroom_code}` : ''}</> : undefined;
  const shell = (child: React.ReactNode, opts: { langs?: boolean; sub?: React.ReactNode } = {}) => (
    <FlowShell lang={lang} kicker={kicker} title={title} sub={opts.sub} line={line} langs={opts.langs} onLang={setLang} testid="fu-flow"><style dangerouslySetInnerHTML={{ __html: CSS }} />{child}</FlowShell>
  );

  if (state === 'loading') return shell(<div className="fl-card fl-center fl-muted">{t.loading}</div>);
  if (state === 'none') return shell(<div className="fl-card fl-center"><div className="fl-ok off"><Icon name="alert" size={30} /></div><h2>{t.none}</h2></div>);
  if (state === 'error' || !f) return shell(<div className="fl-card fl-center"><div className="fl-ok off"><Icon name="alert" size={30} /></div><h2>{err}</h2></div>);
  if (result) return shell(
    <section className="fl-card fl-center" data-testid="fu-done">
      <div className="fl-ok"><Icon name="check" size={34} /></div>
      <h2>{t.thanks}</h2><p className="fl-muted">{t.thanksSub}</p>
      <div className="fu-res">
        {result.scale_mean != null && <span>{t.yourMean}: <b>{Number(result.scale_mean).toFixed(2)} / {max}</b></span>}
        {result.application_pct != null && <span>{t.yourApp}: <b>{Math.round(Number(result.application_pct))}%</b></span>}
      </div>
    </section>);
  if (f.status !== 'open') return shell(<div className="fl-card fl-center"><div className="fl-ok off"><Icon name="pause" size={28} /></div><h2>{t.closed}</h2></div>, { langs: true });

  return shell(<>
    {N > 1 && <Stations lang={lang} stations={stations} index={step} reached={reached} onGo={go} testid="fu-stations" chipTestid="fu-chip" />}

    {step === 0 && (
      <StepCard lang={lang} n={1} title={t.whoAreYou} hint={f.intro_ar && lang === 'ar' ? f.intro_ar : t.intro} id="fu-step-0" miss={!!stepErr}>
        <div className="fu-roles">
          {f.supervisor_open && <button type="button" className={`fu-role ${role === 'supervisor' ? 'on' : ''}`} aria-pressed={role === 'supervisor'} onClick={() => { setRole('supervisor'); setStepErr(''); }}><Icon name="users" size={18} /><b>{ROLE_LABEL.supervisor[lang]}</b></button>}
          {f.trainee_open && <button type="button" className={`fu-role ${role === 'trainee' ? 'on' : ''}`} aria-pressed={role === 'trainee'} onClick={() => { setRole('trainee'); setStepErr(''); }}><Icon name="school" size={18} /><b>{ROLE_LABEL.trainee[lang]}</b></button>}
        </div>
        {role && (
          <div className="fl-grid" style={{ marginTop: 14 }}>
            <label className="fl-field"><span>{t.yourName}<span className="fl-req"> *</span></span><input value={me.name} onChange={e => { setMe({ ...me, name: e.target.value }); setStepErr(''); }} autoComplete="name" /></label>
            <label className="fl-field"><span>{t.yourEmail} <small>({t.optional})</small></span><input type="email" dir="ltr" value={me.email} onChange={e => setMe({ ...me, email: e.target.value })} autoComplete="email" /></label>
            {role !== 'trainee' && (
              <>
                <div className="fu-sub">{t.trainee}</div>
                <label className="fl-field"><span>{t.traineeName}<span className="fl-req"> *</span></span><input value={tr.name} onChange={e => { setTr({ ...tr, name: e.target.value }); setStepErr(''); }} /></label>
                <label className="fl-field"><span>{t.traineeEmail}</span><input type="email" dir="ltr" value={tr.email} onChange={e => setTr({ ...tr, email: e.target.value })} /></label>
              </>
            )}
          </div>
        )}
      </StepCard>
    )}

    {step > 0 && domains[step - 1] && (() => { const [dom, items] = domains[step - 1]; return (
      <StepCard lang={lang} n={step + 1} title={dom} hint={`${items.length} ${lang === 'en' ? 'items' : 'بنود'} · ${t.scaleHint}`} optional={!items.some(q => q.required !== false && q.kind !== 'text')} id={`fu-step-${step}`} miss={!!stepErr}>
        {items.map(q => (
          <div key={q.id} id={'q-' + q.id} className={`fl-q ${missing.includes(q.id) ? 'miss' : ''}`}>
            <div className="fl-qt"><span className="fl-qn">{qs.indexOf(q) + 1}</span><span>{label(q)}{q.required === false && <small className="fl-muted"> ({t.optional})</small>}</span></div>
            {q.kind === 'scale' && (
              <div className="fl-scale" style={{ gridTemplateColumns: `repeat(${max}, minmax(0,1fr))` }} role="radiogroup">
                {Array.from({ length: max }, (_, k) => k + 1).map(v => (
                  <button type="button" key={v} role="radio" aria-checked={answers[q.id] === v} className={answers[q.id] === v ? 'on' : ''} onClick={() => pick(q.id, v)}><b>{v}</b></button>
                ))}
              </div>
            )}
            {q.kind === 'percent' && (
              <div className="fl-pills" role="radiogroup">
                {PERCENT_STEPS.map(p => <button type="button" key={p} role="radio" aria-checked={answers[q.id] === p} className={`fl-pill ${answers[q.id] === p ? 'on' : ''}`} onClick={() => pick(q.id, p)}>{p}%</button>)}
              </div>
            )}
            {q.kind === 'multi' && (
              <div className="fl-pills">
                {(q.options || []).map(o => { const on = Array.isArray(answers[q.id]) && answers[q.id].includes(o); return <button key={o} type="button" aria-pressed={on} className={`fl-pill multi ${on ? 'on' : ''}`} onClick={() => { toggleMulti(q.id, o); setMissing(m => m.filter(x => x !== q.id)); setStepErr(''); }}><span className="fl-k">{on && <Icon name="check" size={12} />}</span>{o}</button>; })}
                <input className="fl-text" style={{ marginTop: 6 }} placeholder={t.other} value={other[q.id] || ''} onChange={e => setOther({ ...other, [q.id]: e.target.value })} />
              </div>
            )}
            {q.kind === 'text' && <textarea className="fl-text" rows={3} value={answers[q.id] || ''} onChange={e => pick(q.id, e.target.value)} />}
          </div>
        ))}
      </StepCard>
    ); })()}

    <FlowNav lang={lang} index={step} count={N} onPrev={prev} onNext={next} onSubmit={() => void submit()} saving={saving} first={step === 0} last={step === N - 1}
      submitLabel={t.submit} error={stepErr || undefined} />
  </>, { langs: step === 0 });
}

const CSS = `
.fu-roles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fu-role{border:2px solid #EADFD6;background:#fff;border-radius:14px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:6px;font:inherit;cursor:pointer;color:#3A1F36;min-height:64px}.fu-role.on{border-color:#D4614A;background:#FBEDE7}.fu-role b{font-size:14px}
.fu-sub{grid-column:1/-1;font-size:13px;font-weight:900;color:#D4614A;margin-top:4px}
.fu-res{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:13px;font-weight:700;color:#5C4858;margin-top:10px}.fu-res b{color:#3A1F36}
@media(max-width:640px){.fu-roles{grid-template-columns:1fr}}
`;
