'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// إدارة أَثَر — المحاكيات وأثير (P10): اعتماد/رفض تشغيلات المحاكاة (الدليل لا يُعتمد إلا بشريًا)، السيناريوهات، وأسئلة «مستشارك»
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { AUDIENCE_LABEL, SIM_STATUS_LABEL, bandLabel } from '../../../lib/portal/sim';
import type { Scenario, SimRun } from '../../../lib/portal/sim';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Q = { id: string; created_at: string; name: string | null; email: string | null; question: string; answer: string | null; source: string | null; handoff: boolean; page: string | null };
const fmt = (iso: string) => new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminSimPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [tok, setTok] = useState('');
  const [status, setStatus] = useState<'scored' | 'approved' | 'rejected'>('scored'); const [runs, setRuns] = useState<SimRun[]>([]); const [scen, setScen] = useState<Scenario[]>([]); const [qs, setQs] = useState<Q[]>([]);
  const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState(''); const [note, setNote] = useState(''); const [tab, setTab] = useState<'runs' | 'scenarios' | 'questions'>('runs');

  async function load(tk: string, st = status) {
    const j = await fetch(`/api/sim?admin=1&status=${st}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json());
    if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setRuns(j.runs || []); setScen(j.scenarios || []); setQs(j.questions || []);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/sim'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const { data } = await db.auth.getSession(); const tk = data.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusy(id); const j = await fetch('/api/sim', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'approve', run_id: id, decision, note }) }).then(r => r.json());
    if (!j?.success) setError(j?.error || 'تعذّر الحفظ'); else { setNote(''); setOpen(null); await load(tok); } setBusy('');
  }
  const scenOf = (id: string | null) => scen.find(s => s.id === id);
  if (!ready) return <div className="as"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="as-wrap"><div className="as-card">{error ? <span className="as-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="as"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="as-wrap">
        <header className="as-head"><div><span className="as-kicker"><Icon name="play" size={14} /> بوابة أَثَر · P10</span><h1>المحاكيات وأثير</h1><p>الذكاء الاصطناعي يمثّل الشخصية ويقترح الدرجة — والاعتماد بشري. التشغيلة المعتمدة تصبح دليلًا كامل الوزن (0.7) في الملف المهاري؛ غير المعتمدة تبقى دليلًا أوليًا (0.45).</p></div></header>
        <PortalAdminTabs counts={{ '/admin/sim': status === 'scored' ? runs.length : 0 }} />
        {error && <div className="as-err">{error}</div>}
        <div className="as-tabs">{([['runs', 'تشغيلات بانتظار القرار'], ['scenarios', `السيناريوهات (${scen.length})`], ['questions', `أسئلة «مستشارك» (${qs.length})`]] as const).map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

        {tab === 'runs' && (
          <>
            <div className="as-sub">{(['scored', 'approved', 'rejected'] as const).map(st => <button key={st} type="button" className={status === st ? 'on' : ''} onClick={async () => { setStatus(st); await load(tok, st); }}>{SIM_STATUS_LABEL[st].ar}</button>)}</div>
            {runs.length === 0 && <div className="as-card as-empty">لا تشغيلات في هذه الحالة.</div>}
            {runs.map(r => { const s = scenOf(r.scenario_id); const sc = r.score; return (
              <article key={r.id} className={`as-card as-run ${r.status}`}>
                <div className="as-row" onClick={() => setOpen(open === r.id ? null : r.id)} role="button" tabIndex={0}>
                  <div className="as-who"><b>{s?.title_ar || 'سيناريو العرض'}</b><span dir="ltr">{r.email}</span><small>{fmt(r.created_at)} · {(r.turns || []).filter(t => t.role === 'learner').length} أدوار · {r.source === 'ai' ? 'تقييم ذكاء اصطناعي' : 'تقدير محلي'}</small></div>
                  <div className="as-meta">{sc && <b className="as-total">{sc.total}<small>/100 · {bandLabel(sc.total, 'ar')}</small></b>}<span className={`as-st ${r.status}`}>{SIM_STATUS_LABEL[r.status].ar}</span></div>
                </div>
                {open === r.id && (
                  <div className="as-body">
                    <div className="as-cols">
                      <div><h4>الحوار</h4><div className="as-turns">{(r.turns || []).map((t, i) => <div key={i} className={`as-turn ${t.role}`}><small>{t.role === 'persona' ? (s?.persona?.name || 'الشخصية') : 'المتعلم'}</small><p>{t.text}</p></div>)}</div></div>
                      <div><h4>التقييم المقترح</h4>{sc ? <>
                        <div className="as-crit">{sc.criteria.map(c => { const rb = s?.rubric.find(x => x.key === c.key); return <div key={c.key}><span>{rb?.title_ar || c.key} <em>{rb?.weight}%</em></span><i><b style={{ width: `${c.score}%` }} /></i><b>{c.score}</b>{c.note && <small>{c.note}</small>}</div>; })}</div>
                        {!!sc.strengths?.length && <p><b>قوة:</b> {sc.strengths.join(' · ')}</p>}{!!sc.improve?.length && <p><b>تحسين:</b> {sc.improve.join(' · ')}</p>}{sc.expert_path && <p><b>مسار الخبير:</b> {sc.expert_path}</p>}
                      </> : <p>لا تقييم.</p>}
                        {r.status === 'scored' && <div className="as-decide"><input value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة للمتعلم (اختياري)" maxLength={400} /><button type="button" className="as-btn ok" disabled={busy === r.id} onClick={() => decide(r.id, 'approved')}><Icon name="check" size={14} /> اعتماد الدليل</button><button type="button" className="as-btn bad" disabled={busy === r.id} onClick={() => decide(r.id, 'rejected')}><Icon name="x" size={14} /> رفض</button></div>}
                        {r.status !== 'scored' && <p className="as-note">{r.note ? `ملاحظة: ${r.note}` : ''} {r.approved_at ? `· ${fmt(r.approved_at)}` : ''}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </article>); })}
          </>
        )}

        {tab === 'scenarios' && (
          <div className="as-grid">{scen.map(s => <article key={s.id} className="as-card"><div className="as-tags"><span className="as-tag">{AUDIENCE_LABEL[s.audience].ar}</span><span className="as-tag soft">{s.status}</span>{s.demo && <span className="as-tag gold">عرض للزوار</span>}<span className="as-tag soft">{s.max_turns} أدوار · {s.minutes} د</span></div><h3>{s.title_ar}</h3><p>{s.situation_ar}</p><p><b>الشخصية:</b> {s.persona.name} — {s.persona.role}</p><div className="as-tags">{s.rubric.map(r => <span key={r.key} className="as-tag soft">{r.title_ar} {r.weight}%</span>)}</div><small>المهارات المرتبطة: {s.skills.length} · <a href={`/sim/${s.slug}`} target="_blank" rel="noreferrer">فتح</a></small></article>)}
            <div className="as-card as-empty">إضافة سيناريوهات جديدة: عبر جدول <code>portal_scenarios</code> في Supabase (مجموع أوزان المعيار 100). محرر مرئي في مرحلة لاحقة.</div></div>
        )}

        {tab === 'questions' && (
          <>
            {qs.length === 0 && <div className="as-card as-empty">لا أسئلة بعد.</div>}
            {qs.map(q => <article key={q.id} className={`as-card as-q ${q.handoff ? 'hand' : ''}`}><div className="as-row"><div className="as-who"><b>{q.question}</b><small>{fmt(q.created_at)} · {q.page || '/'} · {q.source === 'ai' ? 'ذكاء اصطناعي' : 'قاعدة المعرفة'}{q.email ? ` · ${q.email}` : ''}</small></div><div className="as-meta">{q.handoff && <span className="as-tag gold">تحويل بشري</span>}</div></div>{q.answer && <p className="as-ans">{q.answer}</p>}</article>)}
            <div className="as-card as-empty">طلبات التحويل البشري تصل أيضًا إلى <a href="/admin/inbox">رسائل التواصل</a> بموضوع «سؤال عبر مستشارك».</div>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.as{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.as-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.as-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.as-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7;max-width:820px}.as-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.as-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px}.as-empty{color:#64748b;font-size:14px;text-align:center}.as-err{color:#b91c1c;font-size:13px}
.as-tabs,.as-sub{display:flex;gap:6px;flex-wrap:wrap}.as-tabs button,.as-sub button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer;color:#334155}.as-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.as-sub button.on{background:#0b8a83;color:#fff;border-color:#0b8a83}
.as-row{display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer}.as-who b{display:block;color:#0f2a4e;font-size:15px}.as-who span{color:#475569;font-size:13px}.as-who small{display:block;color:#64748b;font-size:12px}
.as-meta{display:grid;justify-items:end;gap:4px}.as-total{font-size:22px;color:#0b8a83}.as-total small{font-size:11px;color:#64748b;margin-inline-start:4px}
.as-st,.as-tag{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#eef2f7;color:#475569}.as-st.scored{background:#fdf6e3;color:#9a6b00}.as-st.approved{background:#e6f4f1;color:#0b8a83}.as-st.rejected{background:#fee2e2;color:#b91c1c}.as-tag.gold{background:#fdf6e3;color:#9a6b00}.as-tag.soft{background:#f8fafc;border:1px solid #e2e8f0}
.as-body{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px}.as-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.as-cols h4{margin:0 0 8px;font-size:13px;color:#0b8a83}
.as-turns{display:grid;gap:8px;max-height:420px;overflow:auto}.as-turn small{font-size:11px;color:#64748b;font-weight:800}.as-turn p{margin:2px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font-size:13.5px;line-height:1.7}.as-turn.learner p{background:#eef2f7}
.as-crit{display:grid;gap:8px}.as-crit div{display:grid;grid-template-columns:1fr 36px;gap:2px 8px;font-size:13px;align-items:center}.as-crit span em{font-style:normal;color:#94a3b8;font-size:11px}.as-crit i{grid-column:1;display:block;height:7px;border-radius:4px;background:#e2e8f0;overflow:hidden}.as-crit i b{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#c9a24b)}.as-crit>div>b{grid-column:2;grid-row:1/3;font-weight:900;color:#0f2a4e;text-align:center}.as-crit small{grid-column:1/3;color:#475569;font-size:12px;line-height:1.5}
.as-body p{font-size:13.5px;line-height:1.7;color:#1e293b;margin:8px 0 0}.as-decide{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.as-decide input{flex:1;min-width:200px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px}
.as-btn{display:inline-flex;align-items:center;gap:5px;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;color:#fff}.as-btn.ok{background:#0b8a83}.as-btn.bad{background:#b91c1c}.as-btn:disabled{opacity:.5}.as-note{color:#64748b;font-size:12.5px}
.as-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.as-grid h3{margin:8px 0 4px;font-size:16px;color:#0f2a4e}.as-grid p{margin:4px 0;font-size:13px;line-height:1.7;color:#334155}.as-tags{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}.as-grid small{color:#64748b;font-size:12px}.as-grid a{color:#0b8a83}
.as-q.hand{border-color:#f1dfae}.as-ans{margin:8px 0 0;font-size:13.5px;line-height:1.7;color:#334155;background:#f8fafc;border-radius:10px;padding:8px 10px}
@media (max-width:860px){.as-cols,.as-grid{grid-template-columns:1fr}}
`;
