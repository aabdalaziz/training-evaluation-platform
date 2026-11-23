'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { FlowShell, Stations, StepCard, FlowNav, useStepScroll, type Station, type StationState } from '../../components/StepFlow'; /* هـ-3 ن «محطّات» */
import { PHASE_LABEL, scaleLabels } from '../../../lib/impact/model';
import type { ImpactQuestion, Phase } from '../../../lib/impact/model';

type FormData = {
  assessment: { id: string; title_ar: string; title_en: string | null; intro_ar: string | null; status: string; pre_open: boolean; post_open: boolean; scale_max: number; identity_hint_ar: string; program_name: string | null; program_name_en: string | null; classroom_code: string | null };
  questions: ImpactQuestion[];
};
type Result = { ok: boolean; error?: string; score?: number; scale_mean?: number | null; knowledge_pct?: number | null; pre_score?: number | null };

const ERR: Record<string, string> = {
  not_found: 'الرابط غير صحيح أو انتهت صلاحيته.', closed: 'هذه الأداة مغلقة حاليًا.', bad_phase: 'مرحلة غير صحيحة.',
  phase_closed: 'هذه المرحلة غير مفتوحة الآن — راجع المدرب.', bad_identity: 'أدخل معرّفًا صحيحًا (4 رموز على الأقل).', empty: 'أجب عن بند واحد على الأقل.',
};

export function ImpactForm({ token, initialPhase }: { token: string; initialPhase: Phase | null }) {
  const db = supabase();
  const [data, setData] = useState<FormData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [phase, setPhase] = useState<Phase | null>(initialPhase);
  const [identity, setIdentity] = useState('');
  const [gender, setGender] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  /* هـ-3 ن «محطّات»: 0 المرحلة والمعرّف · 1..n مجال لكل محطّة — والإرسال في الأخيرة */
  const [step, setStep] = useState(0); const [reached, setReached] = useState(0); const [stepErr, setStepErr] = useState('');
  useStepScroll(step);

  useEffect(() => {
    (async () => {
      const { data: d, error } = await db.rpc('impact_form', { p_token: token });
      if (error) { setErr(error.message); setState('error'); return; }
      if (!d || !(d as any).assessment) { setState('none'); return; }
      const fd = d as FormData;
      setData(fd);
      // اختيار المرحلة تلقائيًا إن كانت واحدة فقط مفتوحة
      if (!initialPhase) { if (fd.assessment.pre_open && !fd.assessment.post_open) setPhase('pre'); else if (fd.assessment.post_open && !fd.assessment.pre_open) setPhase('post'); }
      setState('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const a = data?.assessment; const qs = data?.questions || [];
  const labels = useMemo(() => scaleLabels(a?.scale_max || 5), [a?.scale_max]);
  const domains = useMemo(() => { const m = new Map<string, ImpactQuestion[]>(); qs.forEach(q => { const k = q.domain_ar || 'عام'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(q); }); return Array.from(m.entries()); }, [qs]);
  const T = (ar: string, en?: string | null) => (lang === 'en' && en ? en : ar);

  function infoErr(): string { if (!phase) return lang === 'en' ? 'Select the phase first.' : 'اختر مرحلة القياس أولًا.'; if (identity.trim().length < 4) return ERR.bad_identity; return ''; }
  function domainMissing(di: number) { const items = domains[di]?.[1] || []; return items.filter(q => answers[q.id] === undefined || answers[q.id] === '').map(q => q.id); }

  async function submit() {
    if (!a) return;
    const ie = infoErr(); if (ie) { setStep(0); setStepErr(ie); return; }
    const miss = qs.filter(q => answers[q.id] === undefined || answers[q.id] === '').map(q => q.id);
    setMissing(miss);
    if (miss.length) { const di = domains.findIndex(([, items]) => items.some(q => miss.includes(q.id))); setStep(di + 1); setStepErr(lang === 'en' ? `Please answer all items (${miss.length} remaining).` : `يرجى الإجابة عن جميع البنود (${miss.length} متبقية).`); return; }
    setErr(''); setStepErr(''); setSaving(true);
    const { data: r, error } = await db.rpc('impact_submit', { p_token: token, p_phase: phase, p_identity: identity, p_answers: answers, p_gender: gender || null });
    setSaving(false);
    if (error) { setStepErr(error.message); return; }
    const res = r as Result;
    if (!res?.ok) { setStepErr(ERR[res?.error || ''] || 'تعذر الحفظ.'); return; }
    setResult(res); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const kicker = <><Icon name="target" size={14} /> {lang === 'en' ? 'Training impact measurement' : 'قياس أثر التدريب'}</>;
  const shell = (child: React.ReactNode, opts: { langs?: boolean } = {}) => (
    <FlowShell lang={lang} kicker={kicker} title={a ? T(a.title_ar, a.title_en) : (lang === 'en' ? 'Impact measurement' : 'قياس الأثر')}
      line={a && (a.program_name || a.classroom_code) ? <><Icon name="book" size={14} /> {T(a.program_name || '', a.program_name_en)}{a.classroom_code ? ` · ${a.classroom_code}` : ''}</> : undefined}
      langs={opts.langs} onLang={setLang} testid="im-flow"><style dangerouslySetInnerHTML={{ __html: CSS }} />{child}</FlowShell>
  );

  if (state === 'loading') return shell(<div className="fl-card fl-center fl-muted">جارٍ التحميل…</div>);
  if (state === 'none') return shell(<div className="fl-card fl-center"><div className="fl-ok off"><Icon name="alert" size={28} /></div><h2>الرابط غير صحيح أو الأداة غير متاحة</h2><p className="fl-muted">تأكد من الرابط المرسل من المدرب أو إدارة البرنامج.</p></div>);
  if (state === 'error' || !a) return shell(<div className="fl-card fl-center"><div className="fl-ok off"><Icon name="alert" size={28} /></div><h2>تعذر التحميل</h2><p className="fl-muted">{err}</p></div>);

  if (result) {
    const gain = result.pre_score !== null && result.pre_score !== undefined && result.score !== undefined ? Math.round((result.score - Number(result.pre_score)) * 10) / 10 : null;
    return shell(
      <div className="fl-card fl-center im-thanks" data-testid="im-done">
        <div className="fl-ok"><Icon name="check" size={30} /></div>
        <h2>{lang === 'en' ? 'Thank you! Your response was saved.' : 'شكرًا لك! تم حفظ استجابتك.'}</h2>
        <p className="fl-muted">{PHASE_LABEL[phase!].ar} · {a.title_ar}</p>
        <div className="im-score">
          <div><small>{lang === 'en' ? 'Your score' : 'درجتك'}</small><b>{result.score}</b><span>/ 100</span></div>
          {gain !== null && <div className={gain >= 0 ? 'up' : 'down'}><small>{lang === 'en' ? 'Change vs. pre' : 'التغير عن القياس القبلي'}</small><b>{gain >= 0 ? '+' : ''}{gain}</b><span>{lang === 'en' ? 'points' : 'نقطة'}</span></div>}
        </div>
        {phase === 'pre' && <p className="fl-muted">{lang === 'en' ? 'After the program ends, you will receive the post-assessment link. Please use the same identifier.' : 'بعد انتهاء البرنامج ستصلك دعوة للقياس البعدي — استخدم المعرّف نفسه.'}</p>}
      </div>
    );
  }

  /* ---------------- محطّات ---------------- */
  const st = (done: number, total: number, missNow: boolean): StationState => missNow ? 'miss' : done >= total ? 'done' : done > 0 ? 'part' : 'todo';
  const infoDone = (phase ? 1 : 0) + (identity.trim().length >= 4 ? 1 : 0);
  const stations: Station[] = [
    { key: 'info', title: lang === 'en' ? 'Phase & identifier' : 'المرحلة والمعرّف', state: st(infoDone, 2, step === 0 && !!stepErr), done: infoDone, total: 2 },
    ...domains.map(([dom, items], di) => { const done = items.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length; return { key: dom, title: dom, state: st(done, items.length, (step === di + 1 && !!stepErr) || items.some(q => missing.includes(q.id) && (answers[q.id] === undefined || answers[q.id] === ''))), done, total: items.length }; }),
  ];
  const N = stations.length;
  function go(i: number) { setStepErr(''); setStep(i); setReached(r => Math.max(r, i)); }
  function next() {
    if (step === 0) { const e = infoErr(); if (e) { setStepErr(e); return; } }
    else { const m = domainMissing(step - 1); if (m.length) { setMissing(x => Array.from(new Set([...x, ...m]))); setStepErr(lang === 'en' ? `${m.length} item(s) unanswered in this section.` : `بقي ${m.length} من البنود بلا إجابة في هذا المجال.`); return; } }
    go(Math.min(N - 1, step + 1));
  }
  function prev() { setStepErr(''); setStep(s => Math.max(0, s - 1)); }
  const pick = (id: string, v: string | number) => { setAnswers(s => ({ ...s, [id]: v })); setMissing(m => m.filter(x => x !== id)); setStepErr(''); };

  return shell(<>
    {N > 1 && <Stations lang={lang} stations={stations} index={step} reached={reached} onGo={go} testid="im-stations" chipTestid="im-chip" />}

    {step === 0 && (
      <StepCard lang={lang} n={1} title={lang === 'en' ? 'Assessment phase' : 'مرحلة القياس'} hint={a.intro_ar || undefined} id="im-step-0" miss={!!stepErr}>
        <div className="im-phases">
          {(['pre', 'post'] as Phase[]).map(p => {
            const open = p === 'pre' ? a.pre_open : a.post_open;
            return <button key={p} type="button" disabled={!open} className={`im-phase ${phase === p ? 'on' : ''}`} onClick={() => { setPhase(p); setStepErr(''); }} aria-pressed={phase === p}>
              <b>{lang === 'en' ? PHASE_LABEL[p].en : PHASE_LABEL[p].ar}</b><small>{open ? (lang === 'en' ? 'Open' : 'مفتوحة') : (lang === 'en' ? 'Closed' : 'مغلقة')}</small>
            </button>;
          })}
        </div>
        <div className="fl-grid">
          <label className="fl-field span"><span>{lang === 'en' ? 'Your identifier (same in pre & post)' : 'معرّفك الشخصي (نفسه في القياسين)'}<span className="fl-req"> *</span></span>
            <input value={identity} onChange={e => { setIdentity(e.target.value); setStepErr(''); }} placeholder={a.identity_hint_ar} dir="ltr" />
            <small>{lang === 'en' ? 'Stored encrypted; used only to pair your two responses.' : 'يُحفظ مشفَّرًا ولا يُعرض لأحد؛ يُستخدم فقط لربط استجابتك القبلية بالبعدية.'}</small>
          </label>
          <label className="fl-field"><span>{lang === 'en' ? 'Gender (optional)' : 'الجنس (اختياري)'}</span>
            <select value={gender} onChange={e => setGender(e.target.value)}><option value="">—</option><option value="M">{lang === 'en' ? 'Male' : 'ذكر'}</option><option value="F">{lang === 'en' ? 'Female' : 'أنثى'}</option></select>
          </label>
        </div>
        <p className="fl-hint" style={{ margin: '14px 0 0' }}><Icon name="shield" size={12} /> {lang === 'en' ? 'Results are reported in aggregate only.' : 'تُعرض النتائج بشكل مجمّع فقط ولا تُنشر أي بيانات فردية.'}</p>
      </StepCard>
    )}

    {step > 0 && domains[step - 1] && (() => { const [dom, items] = domains[step - 1]; return (
      <StepCard lang={lang} n={step + 1} title={dom} hint={`${items.length} ${lang === 'en' ? 'items' : 'بنود'}`} id={`im-step-${step}`} miss={!!stepErr}>
        {items.map(q => {
          const miss = missing.includes(q.id);
          return (
            <div className={`fl-q ${miss ? 'miss' : ''}`} id={`q-${q.id}`} key={q.id}>
              <div className="fl-qt"><span className="fl-qn">{q.order_no}</span><span>{T(q.text_ar, q.text_en)}</span></div>
              {q.kind === 'scale' ? (
                <div className="fl-scale" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0,1fr))` }} role="radiogroup">
                  {labels.map(l => (
                    <button key={l.v} type="button" role="radio" aria-checked={answers[q.id] === l.v} className={answers[q.id] === l.v ? 'on' : ''} onClick={() => pick(q.id, l.v)}>
                      <b>{l.v}</b><small>{lang === 'en' ? l.en : l.ar}</small>
                    </button>
                  ))}
                  <div className="fl-legend" aria-hidden="true"><small>{labels[0].v} = {lang === 'en' ? labels[0].en : labels[0].ar}</small><small>{labels[labels.length - 1].v} = {lang === 'en' ? labels[labels.length - 1].en : labels[labels.length - 1].ar}</small></div>
                </div>
              ) : (
                <div className="im-opts" role="radiogroup">
                  {(q.options || []).map(o => (
                    <button key={o.k} type="button" role="radio" aria-checked={answers[q.id] === o.k} className={answers[q.id] === o.k ? 'on' : ''} onClick={() => pick(q.id, o.k)}>
                      <span className="im-k">{o.k.toUpperCase()}</span>{T(o.ar, o.en)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </StepCard>
    ); })()}

    <FlowNav lang={lang} index={step} count={N} onPrev={prev} onNext={next} onSubmit={() => void submit()} saving={saving} first={step === 0} last={step === N - 1}
      submitLabel={lang === 'en' ? 'Submit' : 'إرسال الاستجابة'} error={stepErr || undefined} />
  </>, { langs: step === 0 });
}

const CSS = `
.im-phases{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.im-phase{border:2px solid #EADFD6;background:#fff;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;font:inherit;cursor:pointer;color:#2A1626;min-height:60px}.im-phase b{font-size:14px}.im-phase small{color:#8E7F8A;font-weight:700;font-size:12px}
.im-phase.on{border-color:#D4614A;background:#FBEDE7}.im-phase:disabled{opacity:.5;cursor:not-allowed}
.im-opts{display:flex;flex-direction:column;gap:6px}
.im-opts button{border:1px solid #D9CBC2;background:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:center;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;color:#2A1626;text-align:start;min-height:44px}
.im-k{width:26px;height:26px;border-radius:8px;background:#F3E6DC;display:grid;place-items:center;font-size:12px;font-weight:900;color:#3A1F36;flex-shrink:0}
.im-opts button.on{background:#3A1F36;border-color:#3A1F36;color:#fff}.im-opts button.on .im-k{background:#D4614A;color:#fff}
.im-score{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:14px 0}
.im-score>div{background:#FBF4EE;border:1px solid #EADFD6;border-radius:14px;padding:12px 22px;display:flex;flex-direction:column;align-items:center;min-width:160px}
.im-score small{font-size:12px;font-weight:800;color:#8E7F8A}.im-score b{font-size:34px;color:#3A1F36;line-height:1.1}.im-score span{font-size:12px;color:#8E7F8A;font-weight:700}
.im-score .up b{color:#2F6B66}.im-score .down b{color:#B9544A}
@media(max-width:560px){.im-phases{grid-template-columns:1fr}}
`;
