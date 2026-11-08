// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
'use client';
/** P49-هـ — «نبض البيئة التدريبية» (/admin/pulse)
 *  يقرأ الاستبيان الختامي (END) عبر الدفعات ويُظهر: متوسّط كل قسم من أقسام رحلة المتدرّب · أدنى/أعلى 3 بنود ·
 *  اتجاه التغيّر بين آخر دفعتين · «بند الأسبوع» = أضعف بند في آخر دفعة → يُسجَّل كمهمّة تحسين واحدة تُغلق بملاحظة.
 *  قواعد: k ≥ 5 · لا أسماء · الحساب في lib/evaluation/pulse.ts (خالص ومُختبَر)
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { computePulse, actionDraft, tone, TONE_AR, K_MIN } from '../../../lib/evaluation/pulse';
import type { PulseEval, PulseAnswer, PulseQ } from '../../../lib/evaluation/pulse';

const NAVY = '#0f2a4e', GOLD = '#c9a24b';
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'QUALITY_MANAGER'];
type Program = { id: string; name_ar: string; name_en?: string | null };
type Room = { id: string; code?: string | null; program_id: string };
type Action = { id: string; program_id: string; classroom_id: string | null; cohort_key: string; question_key: string; question_text: string; section?: string | null; mean: number; n: number; status: 'open' | 'done'; note?: string | null; created_at: string; closed_at?: string | null };

export default function PulsePage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [uid, setUid] = useState('');
  const [programs, setPrograms] = useState<Program[]>([]); const [rooms, setRooms] = useState<Room[]>([]);
  const [evals, setEvals] = useState<PulseEval[]>([]); const [answers, setAnswers] = useState<PulseAnswer[]>([]); const [questions, setQuestions] = useState<PulseQ[]>([]);
  const [actions, setActions] = useState<Action[]>([]); const [programId, setProgramId] = useState(''); const [note, setNote] = useState<Record<string, string>>({}); const [busy, setBusy] = useState('');

  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.replace('/login?next=/admin/pulse'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    setUid(user.id);
    try {
      const [p, c, e, q, a] = await Promise.all([
        db.from('programs').select('id,name_ar,name_en').is('archived_at', null).order('start_date', { ascending: false }).limit(500),
        db.from('classrooms').select('id,code,program_id').limit(2000),
        db.from('evaluations').select('id,program_id,classroom_id,submitted_at,created_at').eq('kind', 'END').limit(20000),
        db.from('questions').select('id,kind,question_key,text_ar,text_en,section_ar,section_en').limit(5000),
        db.from('end_survey_actions').select('*').order('created_at', { ascending: false }).limit(200),
      ]);
      const evRows = (e.data || []) as PulseEval[]; const ids = evRows.map(x => x.id); const ans: PulseAnswer[] = [];
      for (let i = 0; i < ids.length; i += 200) {   /* دفعات لتفادي طول الاستعلام */
        const { data } = await db.from('evaluation_answers').select('evaluation_id,question_id,rating_value').in('evaluation_id', ids.slice(i, i + 200));
        ans.push(...((data || []) as PulseAnswer[]));
      }
      setPrograms((p.data || []) as Program[]); setRooms((c.data || []) as Room[]); setEvals(evRows); setQuestions((q.data || []) as PulseQ[]); setAnswers(ans);
      setActions((a.error ? [] : (a.data || [])) as Action[]);
    } catch (err: any) { setError(err?.message || 'تعذّر التحميل'); }
    setReady(true);
  })(); }, []);

  const pulse = useMemo(() => computePulse(evals, answers, questions, { programId: programId || undefined }), [evals, answers, questions, programId]);
  const pname = (id: string) => programs.find(p => p.id === id)?.name_ar || '—';
  const cohortLabel = (key: string, classroom_id: string | null, program_id: string) => classroom_id ? `${pname(program_id)} · شعبة ${rooms.find(r => r.id === classroom_id)?.code || key.slice(0, 6)}` : pname(program_id);
  const draft = actionDraft(pulse);
  const openForDraft = draft ? actions.find(a => a.status === 'open' && a.cohort_key === draft.cohort_key && a.question_key === draft.question_key) : null;
  const visibleActions = actions.filter(a => !programId || a.program_id === programId);

  async function recordAction() {
    if (!draft || busy) return; setBusy('new');
    const { data, error: err } = await db.from('end_survey_actions').insert({ ...draft, status: 'open', created_by: uid } as any).select('*').single();
    if (err) setError(err.message); else setActions(x => [data as Action, ...x]);
    setBusy('');
  }
  async function closeAction(a: Action) {
    const n = (note[a.id] || '').trim(); if (n.length < 5 || busy) return; setBusy(a.id);
    const patch = { status: 'done', note: n, closed_at: new Date().toISOString(), closed_by: uid };
    const { error: err } = await db.from('end_survey_actions').update(patch as any).eq('id', a.id);
    if (err) setError(err.message); else setActions(x => x.map(y => y.id === a.id ? { ...y, ...patch } as Action : y));
    setBusy('');
  }

  const Bar = ({ m }: { m: number }) => <div className="pl-bar"><i className={tone(m)} style={{ width: `${Math.max(4, (m / 5) * 100)}%` }} /></div>;
  const Arrow = ({ d }: { d: number }) => <span className={`pl-arrow ${d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat'}`}>{d > 0.05 ? '▲' : d < -0.05 ? '▼' : '■'} {d > 0 ? '+' : ''}{d.toFixed(2)}</span>;

  return (
    <div className="pl" dir="rtl">
      <style>{CSS}</style>
      <header className="pl-head">
        <div>
          <div className="pl-kicker"><Icon name="trend" size={14} /> الجودة · نبض البيئة التدريبية</div>
          <h1>أين تتسرّب الجودة؟ — من الاستقبال إلى الشهادة</h1>
          <p>يقرأ الاستبيان الختامي عبر الدفعات ويُظهر متوسّط كل قسم من رحلة المتدرّب، وأضعف البنود، واتجاه التغيّر بين آخر دفعتين. ثم يختار «بند الأسبوع» — أضعف بند في آخر دفعة — ليصبح مهمّة تحسين واحدة تُغلق بملاحظة. لا أرقام دون {K_MIN} استجابات، ولا أسماء.</p>
        </div>
        <nav className="pl-nav">
          <Link href="/dashboard" className="pl-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/templates" className="pl-btn"><Icon name="doc" size={16} /> قوالب التقييم</Link>
          <Link href="/admin/loop" className="pl-btn"><Icon name="refresh" size={16} /> حلقة التحسين</Link>
        </nav>
      </header>

      {error && <div className="pl-err" data-testid="pl-error">{error}</div>}
      {!ready && <div className="pl-card pl-muted" style={{ textAlign: 'center' }}>جارٍ القراءة…</div>}
      {ready && (
        <>
          <div className="pl-tools">
            <label>البرنامج <select data-testid="pl-program" value={programId} onChange={e => setProgramId(e.target.value)}><option value="">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <div className="pl-kpis" data-testid="pl-kpis">
              <span><b>{pulse.n}</b> استجابة</span><span><b>{pulse.cohorts.length}</b> دفعة</span><span><b>{pulse.sections.length}</b> قسم</span><span><b>{visibleActions.filter(a => a.status === 'open').length}</b> مهمّة مفتوحة</span>
            </div>
          </div>

          {!pulse.enough && <div className="pl-card pl-muted" data-testid="pl-few">الاستجابات أقلّ من {K_MIN} — لا تُعرض أرقام قبل بلوغ الحدّ الأدنى (حماية الخصوصية وصدق المؤشّر). الحالي: {pulse.n}.</div>}

          {pulse.enough && (
            <>
              {/* بند الأسبوع */}
              <section className="pl-card pl-week" data-testid="pl-week">
                <div className="pl-ct"><Icon name="flag" size={16} /> بند الأسبوع — أضعف بند في آخر دفعة</div>
                {!pulse.itemOfWeek && <p className="pl-muted">لا توجد دفعة واحدة بلغت {K_MIN} استجابات بعد.</p>}
                {pulse.itemOfWeek && (
                  <div className="pl-weekbody">
                    <div>
                      <div className="pl-sec">{pulse.itemOfWeek.section} · {cohortLabel(pulse.itemOfWeek.cohort.key, pulse.itemOfWeek.cohort.classroom_id, pulse.itemOfWeek.cohort.program_id)}</div>
                      <h3>{pulse.itemOfWeek.text_ar}</h3>
                      <div className="pl-stat"><b className={tone(pulse.itemOfWeek.mean)}>{pulse.itemOfWeek.mean.toFixed(2)}</b> / 5 · {pulse.itemOfWeek.n} إجابة · {TONE_AR[tone(pulse.itemOfWeek.mean)]}</div>
                    </div>
                    {openForDraft
                      ? <span className="pl-pill open">مسجَّل كمهمّة مفتوحة</span>
                      : <button className="pl-primary" data-testid="pl-week-record" disabled={busy === 'new'} onClick={recordAction}>سجّله كمهمّة تحسين</button>}
                  </div>
                )}
              </section>

              {/* الأقسام */}
              <section className="pl-card">
                <div className="pl-ct"><Icon name="chart" size={16} /> رحلة المتدرّب — متوسّط كل قسم{pulse.trend.length ? ' · والتغيّر عن الدفعة السابقة' : ''}</div>
                <ul className="pl-secs" data-testid="pl-sections">
                  {pulse.sections.map(s => { const tr = pulse.trend.find(t => t.section === s.name); return (
                    <li key={s.name} className="pl-secrow">
                      <div className="pl-secname"><span>{s.name}</span><small>{s.items.length} بند · {s.n} إجابة</small></div>
                      <Bar m={s.mean} />
                      <b className={`pl-m ${tone(s.mean)}`}>{s.mean.toFixed(2)}</b>
                      {tr ? <Arrow d={tr.delta} /> : <span className="pl-arrow none">—</span>}
                    </li>
                  ); })}
                </ul>
                {!pulse.trend.length && <p className="pl-muted" style={{ marginTop: 8 }}>الاتجاه يظهر عندما تبلغ دفعتان على الأقل {K_MIN} استجابات لكلّ منهما.</p>}
              </section>

              <div className="pl-grid">
                <section className="pl-card">
                  <div className="pl-ct"><Icon name="alert" size={16} /> أدنى 3 بنود (عبر كل الدفعات)</div>
                  <ol className="pl-items" data-testid="pl-weakest">{pulse.weakest.map(i => <li key={i.key}><span className="pl-sec">{i.section}</span><span>{i.text_ar}</span><b className={tone(i.mean)}>{i.mean.toFixed(2)}</b><small>{i.n}</small></li>)}</ol>
                </section>
                <section className="pl-card">
                  <div className="pl-ct"><Icon name="star" size={16} /> أعلى 3 بنود — ما نحافظ عليه</div>
                  <ol className="pl-items" data-testid="pl-strongest">{pulse.strongest.map(i => <li key={i.key}><span className="pl-sec">{i.section}</span><span>{i.text_ar}</span><b className={tone(i.mean)}>{i.mean.toFixed(2)}</b><small>{i.n}</small></li>)}</ol>
                </section>
              </div>

              <section className="pl-card">
                <div className="pl-ct"><Icon name="table" size={16} /> الدفعات (آخر إرسال أولًا)</div>
                <table className="pl-table" data-testid="pl-cohorts"><thead><tr><th>الدفعة</th><th>الاستجابات</th><th>المتوسّط</th><th>آخر إرسال</th></tr></thead>
                  <tbody>{pulse.cohorts.map(c => <tr key={c.key} className={c.n < K_MIN ? 'dim' : ''}><td>{cohortLabel(c.key, c.classroom_id, c.program_id)}</td><td>{c.n}{c.n < K_MIN && <small> (أقلّ من {K_MIN} — لا متوسّط)</small>}</td><td>{c.n >= K_MIN ? <b className={tone(c.mean)}>{c.mean.toFixed(2)}</b> : '—'}</td><td>{(c.last || '').slice(0, 10)}</td></tr>)}</tbody></table>
              </section>
            </>
          )}

          {/* مهامّ التحسين */}
          <section className="pl-card" data-testid="pl-actions">
            <div className="pl-ct"><Icon name="check" size={16} /> مهامّ التحسين المسجَّلة ({visibleActions.length})</div>
            {!visibleActions.length && <p className="pl-muted">لا مهامّ بعد — كل «بند أسبوع» تسجّله يظهر هنا حتى يُغلق بملاحظة (5 أحرف فأكثر).</p>}
            <ul className="pl-acts">
              {visibleActions.map(a => (
                <li key={a.id} className={a.status} data-testid={`pl-act-${a.id}`}>
                  <div className="pl-actbody">
                    <div className="pl-sec">{a.section || '—'} · {cohortLabel(a.cohort_key, a.classroom_id, a.program_id)} · {a.created_at.slice(0, 10)}</div>
                    <b>{a.question_text}</b>
                    <small>{Number(a.mean).toFixed(2)} / 5 · {a.n} إجابة</small>
                    {a.status === 'done' && <em>أُغلقت {a.closed_at?.slice(0, 10)} — {a.note}</em>}
                  </div>
                  {a.status === 'open' && (
                    <div className="pl-close">
                      <input placeholder="ماذا فعلنا؟ (5 أحرف فأكثر)" value={note[a.id] || ''} onChange={e => setNote(x => ({ ...x, [a.id]: e.target.value }))} data-testid={`pl-note-${a.id}`} />
                      <button className="pl-btn" disabled={(note[a.id] || '').trim().length < 5 || busy === a.id} onClick={() => closeAction(a)} data-testid={`pl-done-${a.id}`}>أُغلقت</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

const CSS = `
.pl{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.pl *{box-sizing:border-box}
.pl-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.pl-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.pl-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.pl-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.pl-nav{display:flex;gap:8px;flex-wrap:wrap}
.pl-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;color:${NAVY};border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none}
.pl-btn:disabled{opacity:.5;cursor:not-allowed}
.pl-primary{border:0;background:${NAVY};color:#fff;border-radius:10px;padding:10px 16px;font:inherit;font-weight:800;cursor:pointer}
.pl-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin-bottom:14px}
.pl-ct{font-weight:900;color:${NAVY};display:flex;align-items:center;gap:8px;margin-bottom:10px}
.pl-muted{color:#64748b;font-size:13px}
.pl-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;margin-bottom:12px}
.pl-tools{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.pl-tools label{font-size:13px;font-weight:800;color:${NAVY};display:flex;gap:8px;align-items:center}
.pl-tools select{font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;min-width:220px;background:#fff}
.pl-kpis{display:flex;gap:8px;flex-wrap:wrap}.pl-kpis span{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:6px 12px;font-size:12.5px;color:#475569}.pl-kpis b{color:${NAVY};font-size:14px;margin-inline-end:4px}
.pl-week{border-inline-start:5px solid ${GOLD}}
.pl-weekbody{display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}
.pl-weekbody h3{margin:4px 0;font-size:18px;color:${NAVY}}
.pl-sec{font-size:12px;color:#0b8a83;font-weight:800}
.pl-stat{font-size:13px;color:#475569}.pl-stat b{font-size:20px;margin-inline-end:4px}
.pl-pill{border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.pl-secs{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pl-secrow{display:grid;grid-template-columns:minmax(160px,1.2fr) 3fr 56px 80px;gap:10px;align-items:center}
.pl-secname{display:flex;flex-direction:column}.pl-secname span{font-weight:800;font-size:13.5px}.pl-secname small{color:#94a3b8;font-size:11px}
.pl-bar{height:12px;background:#f1f5f9;border-radius:999px;overflow:hidden}.pl-bar i{display:block;height:100%;border-radius:999px}
.pl-bar i.ok{background:#15803d}.pl-bar i.good{background:#0b8a83}.pl-bar i.warn{background:#b45309}.pl-bar i.bad{background:#b91c1c}
.pl-m{font-size:14px;text-align:center}
b.ok,.pl-m.ok{color:#15803d}b.good,.pl-m.good{color:#0b8a83}b.warn,.pl-m.warn{color:#b45309}b.bad,.pl-m.bad{color:#b91c1c}
.pl-arrow{font-size:12px;font-weight:800;text-align:center}.pl-arrow.up{color:#15803d}.pl-arrow.down{color:#b91c1c}.pl-arrow.flat{color:#64748b}.pl-arrow.none{color:#cbd5e1}
.pl-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pl-items{margin:0;padding-inline-start:18px;display:grid;gap:8px}.pl-items li{display:grid;grid-template-columns:1fr;gap:2px;font-size:13.5px}.pl-items li b{font-size:15px}.pl-items li small{color:#94a3b8}
.pl-table{width:100%;border-collapse:collapse;font-size:13px}.pl-table th{text-align:right;color:#64748b;font-weight:800;border-bottom:1px solid #e2e8f0;padding:6px}.pl-table td{padding:8px 6px;border-bottom:1px solid #f1f5f9}.pl-table tr.dim td{color:#94a3b8}
.pl-acts{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.pl-acts li{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}
.pl-acts li.done{background:#f0fdf4;border-color:#bbf7d0}.pl-acts li.open{border-inline-start:4px solid ${GOLD}}
.pl-actbody{display:flex;flex-direction:column;gap:2px;font-size:13px}.pl-actbody em{color:#166534;font-style:normal;font-size:12.5px}.pl-actbody small{color:#64748b}
.pl-close{display:flex;gap:6px;align-items:center}.pl-close input{font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;min-width:240px}
@media(max-width:760px){.pl{padding:12px}.pl-grid{grid-template-columns:1fr}.pl-secrow{grid-template-columns:1fr 2fr 48px 64px}.pl-close input{min-width:0;flex:1}}
`;
