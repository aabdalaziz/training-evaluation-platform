'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
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
  const dir = lang === 'en' ? 'ltr' : 'rtl';

  async function submit() {
    if (!a || !phase) return;
    const miss = qs.filter(q => answers[q.id] === undefined || answers[q.id] === '').map(q => q.id);
    setMissing(miss);
    if (identity.trim().length < 4) { setErr(ERR.bad_identity); return; }
    if (miss.length) { setErr(lang === 'en' ? `Please answer all items (${miss.length} remaining).` : `يرجى الإجابة عن جميع البنود (${miss.length} متبقية).`); document.getElementById(`q-${miss[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setErr(''); setSaving(true);
    const { data: r, error } = await db.rpc('impact_submit', { p_token: token, p_phase: phase, p_identity: identity, p_answers: answers, p_gender: gender || null });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    const res = r as Result;
    if (!res?.ok) { setErr(ERR[res?.error || ''] || 'تعذر الحفظ.'); return; }
    setResult(res); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const shell = (child: React.ReactNode) => (
    <main className="im" dir={dir}><style>{CSS}</style><div className="im-wrap">{child}</div></main>
  );

  if (state === 'loading') return shell(<div className="im-card im-center">جارٍ التحميل…</div>);
  if (state === 'none') return shell(<div className="im-card im-center"><Icon name="alert" size={28} /><h2>الرابط غير صحيح أو الأداة غير متاحة</h2><p className="im-muted">تأكد من الرابط المرسل من المدرب أو إدارة البرنامج.</p></div>);
  if (state === 'error' || !a) return shell(<div className="im-card im-center"><Icon name="alert" size={28} /><h2>تعذر التحميل</h2><p className="im-muted">{err}</p></div>);

  if (result) {
    const gain = result.pre_score !== null && result.pre_score !== undefined && result.score !== undefined ? Math.round((result.score - Number(result.pre_score)) * 10) / 10 : null;
    return shell(
      <div className="im-card im-center im-thanks">
        <div className="im-ok"><Icon name="check" size={30} /></div>
        <h2>{lang === 'en' ? 'Thank you! Your response was saved.' : 'شكرًا لك! تم حفظ استجابتك.'}</h2>
        <p className="im-muted">{PHASE_LABEL[phase!].ar} · {a.title_ar}</p>
        <div className="im-score">
          <div><small>{lang === 'en' ? 'Your score' : 'درجتك'}</small><b>{result.score}</b><span>/ 100</span></div>
          {gain !== null && <div className={gain >= 0 ? 'up' : 'down'}><small>{lang === 'en' ? 'Change vs. pre' : 'التغير عن القياس القبلي'}</small><b>{gain >= 0 ? '+' : ''}{gain}</b><span>{lang === 'en' ? 'points' : 'نقطة'}</span></div>}
        </div>
        {phase === 'pre' && <p className="im-muted">{lang === 'en' ? 'After the program ends, you will receive the post-assessment link. Please use the same identifier.' : 'بعد انتهاء البرنامج ستصلك دعوة للقياس البعدي — استخدم نفس المعرّف لربط النتيجتين.'}</p>}
      </div>
    );
  }

  return shell(
    <>
      <header className="im-card im-head">
        <div className="im-logos"><img src="/logos/upm.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /><img src="/logos/gate.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
        <div className="im-kicker"><Icon name="target" size={14} /> {lang === 'en' ? 'Training impact measurement' : 'قياس أثر التدريب'}</div>
        <h1>{T(a.title_ar, a.title_en)}</h1>
        <p className="im-muted">{T(a.program_name || '', a.program_name_en)}{a.classroom_code ? ` · ${a.classroom_code}` : ''}</p>
        {a.intro_ar && <p className="im-intro">{a.intro_ar}</p>}
        <div className="im-langs"><button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button></div>
      </header>

      <section className="im-card">
        <h2><span className="im-n">1</span>{lang === 'en' ? 'Assessment phase' : 'مرحلة القياس'}</h2>
        <div className="im-phases">
          {(['pre', 'post'] as Phase[]).map(p => {
            const open = p === 'pre' ? a.pre_open : a.post_open;
            return <button key={p} disabled={!open} className={`im-phase ${phase === p ? 'on' : ''}`} onClick={() => setPhase(p)}>
              <b>{lang === 'en' ? PHASE_LABEL[p].en : PHASE_LABEL[p].ar}</b><small>{open ? (lang === 'en' ? 'Open' : 'مفتوحة') : (lang === 'en' ? 'Closed' : 'مغلقة')}</small>
            </button>;
          })}
        </div>
        <label className="im-field">{lang === 'en' ? 'Your identifier (same in pre & post)' : 'معرّفك الشخصي (نفسه في القياسين)'}<span className="im-req"> *</span>
          <input value={identity} onChange={e => setIdentity(e.target.value)} placeholder={a.identity_hint_ar} dir="ltr" />
          <small className="im-muted">{lang === 'en' ? 'Stored encrypted; used only to pair your two responses.' : 'يُحفظ مشفَّرًا ولا يُعرض لأحد؛ يُستخدم فقط لربط استجابتك القبلية بالبعدية.'}</small>
        </label>
        <label className="im-field">{lang === 'en' ? 'Gender (optional)' : 'الجنس (اختياري)'}
          <select value={gender} onChange={e => setGender(e.target.value)}><option value="">—</option><option value="M">{lang === 'en' ? 'Male' : 'ذكر'}</option><option value="F">{lang === 'en' ? 'Female' : 'أنثى'}</option></select>
        </label>
      </section>

      {domains.map(([dom, items], di) => (
        <section className="im-card" key={dom}>
          <h2><span className="im-n">{di + 2}</span>{dom}</h2>
          {items.map(q => {
            const miss = missing.includes(q.id);
            return (
              <div className={`im-q ${miss ? 'miss' : ''}`} id={`q-${q.id}`} key={q.id}>
                <div className="im-qt"><span className="im-qn">{q.order_no}</span><span>{T(q.text_ar, q.text_en)}</span></div>
                {q.kind === 'scale' ? (
                  <div className="im-scale">
                    {labels.map(l => (
                      <button key={l.v} type="button" className={answers[q.id] === l.v ? 'on' : ''} onClick={() => setAnswers(s => ({ ...s, [q.id]: l.v }))}>
                        <b>{l.v}</b><small>{lang === 'en' ? l.en : l.ar}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="im-opts">
                    {(q.options || []).map(o => (
                      <button key={o.k} type="button" className={answers[q.id] === o.k ? 'on' : ''} onClick={() => setAnswers(s => ({ ...s, [q.id]: o.k }))}>
                        <span className="im-k">{o.k.toUpperCase()}</span>{T(o.ar, o.en)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <section className="im-card im-submit">
        {err && <div className="im-err"><Icon name="alert" size={16} /> {err}</div>}
        <button className="im-btn" disabled={saving || !phase} onClick={submit}><Icon name="send" size={16} /> {saving ? '…' : (lang === 'en' ? 'Submit' : 'إرسال الاستجابة')}</button>
        {!phase && <small className="im-muted">{lang === 'en' ? 'Select the phase first.' : 'اختر مرحلة القياس أولًا.'}</small>}
        <small className="im-muted">{lang === 'en' ? 'Results are reported in aggregate only.' : 'تُعرض النتائج بشكل مجمّع فقط ولا تُنشر أي بيانات فردية.'}</small>
      </section>
    </>
  );
}

const CSS = `
.im{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:18px 12px 60px;color:#0f172a}
.im-wrap{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.im-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px}
.im-head{border-top:5px solid #c9a24b}
.im-logos{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}.im-logos img{height:46px;object-fit:contain}
.im-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.im-head h1{margin:4px 0;font-size:22px;color:#0f2a4e}.im-intro{margin:8px 0 0;font-size:13.5px;line-height:1.8;color:#334155;background:#f8fafc;border-radius:10px;padding:10px 12px}
.im-muted{color:#64748b;font-size:12.5px;font-weight:700;margin:0}
.im-langs{display:flex;gap:6px;margin-top:10px}.im-langs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:#0f2a4e}.im-langs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.im-card h2{margin:0 0 12px;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:8px}
.im-n{width:26px;height:26px;border-radius:8px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-size:13px}
.im-phases{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.im-phase{border:2px solid #e2e8f0;background:#fff;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;font:inherit;cursor:pointer;color:#0f172a}.im-phase b{font-size:14px}.im-phase small{color:#64748b;font-weight:700}
.im-phase.on{border-color:#0b8a83;background:#ecfdf5}.im-phase:disabled{opacity:.5;cursor:not-allowed}
.im-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:800;color:#334155;margin-bottom:10px}.im-req{color:#b91c1c}
.im-field input,.im-field select{border:1px solid #cbd5e1;border-radius:10px;padding:11px;font:inherit;font-size:14px;font-weight:700;color:#0f172a;background:#fff}
.im-q{border-top:1px solid #f1f5f9;padding:12px 0}.im-q.miss{background:#fff7ed;border-radius:10px;padding:12px;outline:1px solid #fed7aa}
.im-qt{display:flex;gap:8px;align-items:flex-start;font-size:14.5px;font-weight:800;color:#0f172a;margin-bottom:10px;line-height:1.7}
.im-qn{min-width:24px;height:24px;border-radius:999px;background:#eef2f7;color:#0f2a4e;display:grid;place-items:center;font-size:12px;flex-shrink:0}
.im-scale{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.im-scale button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;cursor:pointer;color:#0f172a}
.im-scale button b{font-size:16px}.im-scale button small{font-size:10.5px;font-weight:700;color:#64748b}
.im-scale button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.im-scale button.on small{color:#cbd5e1}
.im-opts{display:flex;flex-direction:column;gap:6px}
.im-opts button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:center;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;color:#0f172a;text-align:start}
.im-k{width:26px;height:26px;border-radius:8px;background:#eef2f7;display:grid;place-items:center;font-size:12px;font-weight:900;color:#0f2a4e;flex-shrink:0}
.im-opts button.on{background:#ecfdf5;border-color:#0b8a83}.im-opts button.on .im-k{background:#0b8a83;color:#fff}
.im-submit{display:flex;flex-direction:column;gap:8px;align-items:center}
.im-btn{display:inline-flex;align-items:center;gap:8px;background:#0f2a4e;color:#fff;border:0;border-radius:12px;padding:13px 26px;font:inherit;font-size:15px;font-weight:900;cursor:pointer}.im-btn:disabled{opacity:.5}
.im-err{width:100%;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;display:flex;gap:8px;align-items:center}
.im-center{text-align:center;padding:36px 20px}.im-center h2{justify-content:center;margin-top:10px}
.im-ok{width:64px;height:64px;border-radius:999px;background:#ecfdf5;color:#047857;display:grid;place-items:center;margin:0 auto 10px}
.im-score{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:14px 0}
.im-score>div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px 22px;display:flex;flex-direction:column;align-items:center;min-width:160px}
.im-score small{font-size:12px;font-weight:800;color:#64748b}.im-score b{font-size:34px;color:#0f2a4e;line-height:1.1}.im-score span{font-size:12px;color:#64748b;font-weight:700}
.im-score .up b{color:#047857}.im-score .down b{color:#b91c1c}
@media(max-width:560px){.im-scale{grid-template-columns:repeat(5,minmax(0,1fr))}.im-scale button small{display:none}.im-phases{grid-template-columns:1fr}}
`;
