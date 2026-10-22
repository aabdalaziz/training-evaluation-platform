'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
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
    whoAreYou: 'بصفتك:', you: 'بياناتك', yourName: 'اسمك', yourEmail: 'بريدك الإلكتروني', trainee: 'المتدرب الذي تقيّمه', traineeName: 'اسم المتدرب', traineeEmail: 'بريد المتدرب (إن وُجد — يساعد في مطابقة التقييمين)',
    intro: 'مرّ وقت كافٍ منذ ختام البرنامج. نرجو تقييم ما تم تطبيقه فعليًا في العمل — إجاباتك تُستخدم لتحسين البرامج القادمة فقط.',
    scaleHint: '1 = لا ينطبق إطلاقًا · 5 = ينطبق بدرجة كبيرة', submit: 'إرسال التقييم', saving: 'جارٍ الإرسال…', required: 'يرجى الإجابة عن البنود المطلوبة', thanks: 'شكرًا لك — تم استلام تقييمك', thanksSub: 'مساهمتك تساعدنا على قياس الأثر الحقيقي للتدريب وتحسينه.',
    yourMean: 'متوسط تقديرك', yourApp: 'نسبة التطبيق', optional: 'اختياري', other: 'أخرى (اكتب)',
    errors: { not_found: 'الرابط غير صحيح.', closed: 'انتهت فترة المتابعة.', bad_role: 'دور غير صحيح.', role_closed: 'هذا الدور غير مفعّل في هذه الحملة.', bad_name: 'اكتب اسمك الكامل.', bad_trainee: 'اكتب اسم المتدرب.', empty: 'أجب عن بند واحد على الأقل.' } as Record<string, string>,
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

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!role) return;
    const miss = qs.filter(q => q.required !== false && q.kind !== 'text' && (answers[q.id] == null || (Array.isArray(answers[q.id]) && !answers[q.id].length))).map(q => q.id);
    if (me.name.trim().length < 3) { setErr(t.errors.bad_name); return; }
    if (role !== 'trainee' && tr.name.trim().length < 3) { setErr(t.errors.bad_trainee); return; }
    if (miss.length) { setMissing(miss); setErr(t.required); document.getElementById('q-' + miss[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setMissing([]); setSaving(true);
    try {
      const payload: Record<string, any> = { ...answers };
      for (const q of qs) if (q.kind === 'multi' && other[q.id]?.trim()) payload[q.id] = [...(Array.isArray(payload[q.id]) ? payload[q.id] : []), other[q.id].trim()];
      const { data: d, error } = await db.rpc('behavior_submit', { p_token: token, p_role: role, p_respondent_name: me.name.trim(), p_respondent_email: me.email.trim() || null, p_trainee_name: role === 'trainee' ? me.name.trim() : tr.name.trim(), p_trainee_email: role === 'trainee' ? (me.email.trim() || null) : (tr.email.trim() || null), p_answers: payload });
      if (error) throw new Error(error.message);
      const r = d as Result;
      if (!r.ok) { setErr(t.errors[r.error || ''] || r.error || 'error'); return; }
      setResult(r); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (ex: any) { setErr(ex.message || 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fu" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <style>{CSS}</style>
      <div className="fu-wrap">
        <header className="fu-head">
          <div className="fu-logos"><img src="/logos/upm.png" alt="UPM" /><img src="/logos/gate.png" alt="Gate" /></div>
          <div className="fu-kicker"><Icon name="trend" size={14} /> {t.kicker}</div>
          <button type="button" className="fu-lang" onClick={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}>{lang === 'ar' ? 'English' : 'العربية'}</button>
        </header>

        {state === 'loading' && <div className="fu-card fu-center">{t.loading}</div>}
        {state === 'none' && <div className="fu-card fu-center fu-bad"><Icon name="alert" size={30} /><b>{t.none}</b></div>}
        {state === 'error' && <div className="fu-card fu-center fu-bad"><Icon name="alert" size={30} /><b>{err}</b></div>}

        {state === 'ready' && f && (
          <>
            <section className="fu-card fu-info">
              <h1>{lang === 'en' && f.title_en ? f.title_en : f.title_ar}</h1>
              <p className="fu-prog">{lang === 'en' && f.program_name_en ? f.program_name_en : f.program_name}{f.classroom_code ? ` · ${f.classroom_code}` : ''}</p>
              <p className="fu-intro">{f.intro_ar && lang === 'ar' ? f.intro_ar : t.intro}</p>
            </section>

            {f.status !== 'open' && !result && <div className="fu-card fu-center fu-warn"><Icon name="pause" size={28} /><b>{t.closed}</b></div>}

            {result && (
              <section className="fu-card fu-done">
                <div className="fu-ring"><Icon name="check" size={40} stroke={3} /></div>
                <h2>{t.thanks}</h2><p>{t.thanksSub}</p>
                <div className="fu-res">
                  {result.scale_mean != null && <span>{t.yourMean}: <b>{Number(result.scale_mean).toFixed(2)} / {max}</b></span>}
                  {result.application_pct != null && <span>{t.yourApp}: <b>{Math.round(Number(result.application_pct))}%</b></span>}
                </div>
              </section>
            )}

            {f.status === 'open' && !result && (
              <form onSubmit={submit} noValidate>
                <section className="fu-card">
                  <h2>{t.whoAreYou}</h2>
                  <div className="fu-roles">
                    {f.supervisor_open && <button type="button" className={`fu-role ${role === 'supervisor' ? 'on' : ''}`} onClick={() => setRole('supervisor')}><Icon name="users" size={18} /><b>{ROLE_LABEL.supervisor[lang]}</b></button>}
                    {f.trainee_open && <button type="button" className={`fu-role ${role === 'trainee' ? 'on' : ''}`} onClick={() => setRole('trainee')}><Icon name="school" size={18} /><b>{ROLE_LABEL.trainee[lang]}</b></button>}
                  </div>
                  {role && (
                    <div className="fu-grid">
                      <label><span>{t.yourName} <i>*</i></span><input value={me.name} onChange={e => setMe({ ...me, name: e.target.value })} autoComplete="name" /></label>
                      <label><span>{t.yourEmail} <small>({t.optional})</small></span><input type="email" dir="ltr" value={me.email} onChange={e => setMe({ ...me, email: e.target.value })} autoComplete="email" /></label>
                      {role !== 'trainee' && (
                        <>
                          <div className="fu-sub">{t.trainee}</div>
                          <label><span>{t.traineeName} <i>*</i></span><input value={tr.name} onChange={e => setTr({ ...tr, name: e.target.value })} /></label>
                          <label><span>{t.traineeEmail}</span><input type="email" dir="ltr" value={tr.email} onChange={e => setTr({ ...tr, email: e.target.value })} /></label>
                        </>
                      )}
                    </div>
                  )}
                </section>

                {role && qs.map((q, i) => (
                  <section key={q.id} id={'q-' + q.id} className={`fu-card fu-q ${missing.includes(q.id) ? 'miss' : ''}`}>
                    <div className="fu-q-head"><span className="fu-n">{i + 1}</span><div><div className="fu-dom">{q.domain_ar}</div><b>{label(q)}{q.required === false && <small> ({t.optional})</small>}</b></div></div>
                    {q.kind === 'scale' && (
                      <>
                        <div className="fu-scale">
                          {Array.from({ length: max }, (_, k) => k + 1).map(v => (
                            <button type="button" key={v} className={`fu-dot ${answers[q.id] === v ? 'on' : ''}`} onClick={() => setAnswers(a => ({ ...a, [q.id]: v }))}>{v}</button>
                          ))}
                        </div>
                        <small className="fu-hint">{t.scaleHint}</small>
                      </>
                    )}
                    {q.kind === 'percent' && (
                      <div className="fu-pct">
                        {PERCENT_STEPS.map(p => <button type="button" key={p} className={`fu-chip ${answers[q.id] === p ? 'on' : ''}`} onClick={() => setAnswers(a => ({ ...a, [q.id]: p }))}>{p}%</button>)}
                      </div>
                    )}
                    {q.kind === 'multi' && (
                      <div className="fu-multi">
                        {(q.options || []).map(o => <label key={o} className={`fu-opt ${Array.isArray(answers[q.id]) && answers[q.id].includes(o) ? 'on' : ''}`}><input type="checkbox" checked={Array.isArray(answers[q.id]) && answers[q.id].includes(o)} onChange={() => toggleMulti(q.id, o)} /> {o}</label>)}
                        <input className="fu-other" placeholder={t.other} value={other[q.id] || ''} onChange={e => setOther({ ...other, [q.id]: e.target.value })} />
                      </div>
                    )}
                    {q.kind === 'text' && <textarea rows={3} value={answers[q.id] || ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />}
                  </section>
                ))}

                {role && (
                  <section className="fu-card">
                    {err && <div className="fu-err"><Icon name="alert" size={16} /> {err}</div>}
                    <button type="submit" className="fu-btn" disabled={saving}><Icon name="send" size={18} /> {saving ? t.saving : t.submit}</button>
                  </section>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.fu{min-height:100vh;background:radial-gradient(900px 500px at 90% -10%,rgba(11,138,131,.18),transparent 60%),#f3f6fa;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;padding:18px 14px 40px}
.fu *{box-sizing:border-box}
.fu-wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.fu form{display:flex;flex-direction:column;gap:12px}
.fu-head{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #c9a24b;border-radius:16px;padding:12px 16px}
.fu-logos{display:flex;gap:10px;align-items:center}.fu-logos img{height:36px;object-fit:contain}
.fu-kicker{font-size:12.5px;font-weight:900;color:#0b8a83;display:flex;align-items:center;gap:6px;text-align:center}
.fu-lang{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-size:12px;font-weight:800;color:#0f2a4e;cursor:pointer}
.fu-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.fu-card h2{margin:0;font-size:15px;color:#0f2a4e}
.fu-center{align-items:center;text-align:center}
.fu-bad{color:#991b1b;background:#fef2f2;border-color:#fecaca}.fu-warn{color:#9a3412;background:#fff7ed;border-color:#fed7aa}
.fu-info h1{margin:0;font-size:21px;color:#0f2a4e;line-height:1.4}.fu-prog{margin:0;color:#0b8a83;font-weight:800;font-size:14px}.fu-intro{margin:0;color:#475569;font-size:13.5px;line-height:1.8;font-weight:600}
.fu-roles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fu-role{border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:6px;font:inherit;cursor:pointer;color:#0f2a4e}.fu-role.on{border-color:#0b8a83;background:#f0fdf9}.fu-role b{font-size:14px}
.fu-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fu-sub{grid-column:1/-1;font-size:13px;font-weight:900;color:#0b8a83;margin-top:4px}
.fu label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:800;color:#334155}.fu label i{color:#b91c1c;font-style:normal}.fu label small{color:#94a3b8;font-weight:700}
.fu input,.fu textarea{border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px;font-weight:700;color:#0f172a;background:#fff;min-width:0;width:100%}
.fu input:focus,.fu textarea:focus{outline:2px solid #0b8a83;border-color:#0b8a83}
.fu-q.miss{border-color:#fca5a5;box-shadow:0 0 0 3px #fee2e2}
.fu-q-head{display:flex;gap:10px;align-items:flex-start}.fu-q-head b{font-size:15px;color:#0f172a;line-height:1.6}.fu-q-head b small{color:#94a3b8;font-weight:700}
.fu-n{min-width:28px;height:28px;border-radius:9px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-size:12.5px;font-weight:900;flex:none}
.fu-dom{font-size:11.5px;font-weight:900;color:#0b8a83;margin-bottom:2px}
.fu-scale{display:flex;gap:8px;flex-wrap:wrap}
.fu-dot{width:52px;height:48px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;font:inherit;font-size:17px;font-weight:900;color:#0f2a4e;cursor:pointer}.fu-dot.on{background:#0b8a83;border-color:#0b8a83;color:#fff}
.fu-hint{color:#94a3b8;font-weight:700;font-size:11.5px}
.fu-pct{display:flex;gap:8px;flex-wrap:wrap}
.fu-chip{border:2px solid #e2e8f0;background:#fff;border-radius:999px;padding:9px 16px;font:inherit;font-size:14px;font-weight:900;color:#0f2a4e;cursor:pointer}.fu-chip.on{background:#c9a24b;border-color:#c9a24b;color:#0f2a4e}
.fu-multi{display:flex;flex-direction:column;gap:6px}
.fu-opt{flex-direction:row!important;align-items:center;gap:8px!important;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;cursor:pointer;font-size:13.5px!important;color:#0f172a!important}.fu-opt.on{background:#f0fdf9;border-color:#a7f3d0}.fu-opt input{width:18px;height:18px}
.fu-other{margin-top:4px;font-size:13px!important}
.fu-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;display:flex;gap:6px;align-items:center}
.fu-btn{border:0;background:#0f2a4e;color:#fff;border-radius:12px;padding:15px;font:inherit;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}.fu-btn:disabled{opacity:.6}
.fu-done{align-items:center;text-align:center;border-color:#a7f3d0;background:linear-gradient(180deg,#f0fdf9,#fff)}.fu-done h2{font-size:21px}.fu-done p{margin:0;color:#475569;font-weight:700}
.fu-ring{width:84px;height:84px;border-radius:50%;background:#0b8a83;color:#fff;display:grid;place-items:center;box-shadow:0 10px 30px rgba(11,138,131,.35)}
.fu-res{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:13px;font-weight:700;color:#475569}.fu-res b{color:#0f2a4e}
@media(max-width:640px){.fu-grid,.fu-roles{grid-template-columns:1fr}.fu-dot{width:44px;height:44px}}
`;
