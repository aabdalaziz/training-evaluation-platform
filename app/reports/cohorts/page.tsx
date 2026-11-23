'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { buildEvaluations, buildFacts, TARGET } from '../../../lib/reports/analytics';
import type { Evaluation, Fact, Lookups } from '../../../lib/reports/analytics';
import { cohorts, cohortInsights, trainerFairness, fairnessNotes, cohortsCsv, trainersCsv } from '../../../lib/reports/cohorts';
import type { CohortMode } from '../../../lib/reports/cohorts';
import type { ExecSummary } from '../../../lib/ai/exec-summary';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const NAVY = '#3A1F36', TEAL = '#D4614A', GOLD = '#D9A866';
type Tab = 'cohorts' | 'trainers' | 'summary';

export default function CohortsPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [lk, setLk] = useState<Lookups>({ classrooms: [], trainers: [], programs: [], questions: [] });
  const [evals, setEvals] = useState<Evaluation[]>([]); const [facts, setFacts] = useState<Fact[]>([]);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'cohorts');
  const [programId, setProgramId] = useState(params.get('program') || '');
  const [mode, setMode] = useState<CohortMode>('classroom');
  const [trProgram, setTrProgram] = useState(''); const [days, setDays] = useState(0);
  const [sum, setSum] = useState<{ summary: ExecSummary; ai: { configured: boolean; provider: string; error?: string } } | null>(null);
  const [sumBusy, setSumBusy] = useState(false); const [sumDays, setSumDays] = useState(30); const [sumProgram, setSumProgram] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/reports/cohorts'); return; }
      const [ev, an, qs, cl, tr, pg] = await Promise.all([
        db.from('evaluations').select('*').limit(20000), db.from('evaluation_answers').select('*').limit(200000), db.from('questions').select('*'),
        db.from('classrooms').select('*'), db.from('trainers').select('*'), db.from('programs').select('*').order('name_ar'),
      ]);
      const err = [ev, an, qs, cl, tr, pg].find(r => r.error)?.error; if (err) setError(err.message);
      const l: Lookups = { classrooms: (cl.data || []) as any[], trainers: (tr.data || []) as any[], programs: ((pg.data || []) as any[]).filter(p => p.status !== 'CANCELLED'), questions: (qs.data || []) as any[] };
      setLk(l); setEvals(buildEvaluations((ev.data || []) as any[], (an.data || []) as any[], l)); setFacts(buildFacts((an.data || []) as any[], (qs.data || []) as any[]));
      if (!params.get('program') && l.programs.length) setProgramId(l.programs[0].id);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => (programId ? cohorts(programId, evals, facts, lk, mode) : []), [programId, evals, facts, lk, mode]);
  const insights = useMemo(() => cohortInsights(rows), [rows]);
  const fair = useMemo(() => { const to = new Date().toISOString().slice(0, 10); const from = days ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : undefined; return trainerFairness(evals, facts, lk, { programId: trProgram || undefined, from, to: days ? to : undefined }); }, [evals, facts, lk, trProgram, days]);
  const notes = useMemo(() => fairnessNotes(fair), [fair]);
  const pName = (id: string) => lk.programs.find(p => p.id === id)?.name_ar || '—';
  const maxMean = Math.max(5, ...rows.map(r => r.mean || 0));

  async function loadSummary() {
    setSumBusy(true); setError('');
    try {
      const { data: { session } } = await db.auth.getSession();
      const r = await fetch('/api/reports/summary', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ program: sumProgram || undefined, days: sumDays }) });
      const j = await r.json(); if (!j.success) throw new Error(j.error || 'فشل');
      setSum({ summary: j.summary, ai: j.ai });
    } catch (e: any) { setError(e?.message || 'تعذر توليد الملخص'); } finally { setSumBusy(false); }
  }
  function copySummary() { if (!sum) return; const s = sum.summary; navigator.clipboard?.writeText([s.headline, '', ...s.bullets.map(b => '• ' + b), ...(s.risks.length ? ['', 'المخاطر:', ...s.risks.map(b => '⚠ ' + b)] : []), '', 'الإجراءات:', ...s.actions.map((a, i) => `${i + 1}. ${a}`)].join('\n')); }

  if (!ready) return <div className="co rm-page" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="co rm-page" dir="rtl">
      <style>{CSS}</style>
      <RoomHead
        title={<>مقارنة الدفعات · عدالة تقييم المدرّبين · الملخص التنفيذي الذكي</>}
        desc={<><p>هل تتحسن الدفعات المتعاقبة للبرنامج نفسه؟ من يتفوق فعلًا بعد تصحيح أثر حجم العينة وصعوبة البرنامج؟ وما الذي يجب أن يقرأه المدير في 30 ثانية؟</p></>}
        actions={<>
          <button className="rm-btn" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة</button>
          {tab === 'cohorts' && <button className="rm-btn" disabled={!rows.length} onClick={() => downloadCSV(safeFilename(`cohorts_${pName(programId).slice(0, 30)}`), cohortsCsv(pName(programId), rows))}><Icon name="download" size={16} /> CSV</button>}
          {tab === 'trainers' && <button className="rm-btn" disabled={!fair.rows.length} onClick={() => downloadCSV(safeFilename('trainers_fairness'), trainersCsv(fair.rows))}><Icon name="download" size={16} /> CSV</button>}
        </>}
      />
      {error && <div className="rm-alert">{error}</div>}

      <div className="co-tabs co-noprint">
        <button className={tab === 'cohorts' ? 'on' : ''} onClick={() => setTab('cohorts')}><Icon name="users" size={15} /> مقارنة الدفعات</button>
        <button className={tab === 'trainers' ? 'on' : ''} onClick={() => setTab('trainers')}><Icon name="scale" size={15} /> المدرّبون بعدالة</button>
        <button className={tab === 'summary' ? 'on' : ''} onClick={() => setTab('summary')}><Icon name="compass" size={15} /> الملخص التنفيذي الذكي</button>
      </div>

      {tab === 'cohorts' && (
        <>
          <section className="rm-card co-noprint">
            <div className="co-filters">
              <label>البرنامج<select value={programId} onChange={e => setProgramId(e.target.value)}>{lk.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
              <label>تقسيم الدفعات<select value={mode} onChange={e => setMode(e.target.value as CohortMode)}><option value="classroom">حسب الشعبة/الشعبة</option><option value="month">حسب الشهر</option><option value="quarter">حسب الربع</option></select></label>
            </div>
          </section>
          <div className="co-print-title">مقارنة الدفعات — {pName(programId)}</div>
          {!rows.length && <div className="rm-card rm-empty"><Icon name="users" size={34} /><b>لا توجد تقييمات لهذا البرنامج</b></div>}
          {rows.length > 0 && (
            <>
              <section className="rm-card">
                <h3><Icon name="trend" size={16} /> مسار الدفعات (المتوسط من 5 · المستهدف {TARGET})</h3>
                <div className="co-chart">
                  <div className="co-target" style={{ bottom: `${(TARGET / maxMean) * 100}%` }}><span>{TARGET}</span></div>
                  {rows.map(r => <div key={r.key} className={`co-col ${r.perf}`} title={`${r.label}: ${r.mean ?? '—'} (${r.n})`}><b>{r.mean ?? '—'}</b><i style={{ height: `${((r.mean || 0) / maxMean) * 100}%` }} /><small>{r.label}</small><em>{r.n}</em></div>)}
                </div>
              </section>
              <div className="co-grid2">
                <section className="rm-card">
                  <h3><Icon name="compass" size={16} /> قراءة المقارنة</h3>
                  <ul className="co-ins">{insights.map((x, i) => <li key={i} className={x.kind}>{x.text}</li>)}</ul>
                </section>
                <section className="rm-card">
                  <h3><Icon name="table" size={16} /> تفاصيل الدفعات</h3>
                  <div className="co-tablewrap"><table className="rm-table">
                    <thead><tr><th>الدفعة</th><th>الفترة</th><th>ن</th><th>المتوسط</th><th>Δ السابقة</th><th>Δ الأفضل</th><th>% منخفض</th><th>المدرّبون</th><th>الأدنى</th></tr></thead>
                    <tbody>{rows.map(r => <tr key={r.key}><td><b>{r.label}</b></td><td><bdi>{r.from}</bdi>{r.to && r.to !== r.from ? <> → <bdi>{r.to}</bdi></> : ''}</td><td>{r.n}</td><td><span className={`co-st ${r.perf}`}>{r.mean ?? '—'}</span></td><td className={r.delta == null ? '' : r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}>{r.delta == null ? '—' : <bdi>{(r.delta > 0 ? '+' : '') + r.delta}</bdi>}</td><td>{r.vsBest == null ? '—' : <bdi>{r.vsBest}</bdi>}</td><td>{r.lowPct}%</td><td>{r.trainers.join('، ') || '—'}</td><td>{r.axes[r.axes.length - 1]?.label || '—'}</td></tr>)}</tbody>
                  </table></div>
                </section>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'trainers' && (
        <>
          <section className="rm-card co-noprint">
            <div className="co-filters">
              <label>البرنامج<select value={trProgram} onChange={e => setTrProgram(e.target.value)}><option value="">كل البرامج</option>{lk.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
              <label>الفترة<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={0}>كل الوقت</option><option value={30}>آخر 30 يومًا</option><option value={90}>آخر 90 يومًا</option><option value={180}>آخر 180 يومًا</option></select></label>
            </div>
          </section>
          <div className="co-print-title">مقارنة المدرّبين بعدالة إحصائية</div>
          <section className="rm-card co-how">
            <b>كيف نُنصف المدرّب؟</b> المتوسط الخام يظلم من درّس عينة صغيرة أو برنامجًا صعبًا. لذلك نعرض: <b>المعدّل</b> (انكماش بايزي نحو المتوسط العام {fair.globalMean ?? '—'} بقوة {fair.k} استبيانات)، <b>السياق</b> (فرق المدرّب عن متوسط برامجه)، و<b>± الثقة 95%</b>. الترتيب يعتمد المعدّل، ولا يُرتَّب من لديه أقل من 5 استبيانات.
          </section>
          <div className="co-grid2">
            <section className="rm-card">
              <h3><Icon name="compass" size={16} /> ملاحظات العدالة</h3>
              <ul className="co-ins">{notes.map((x, i) => <li key={i} className="info">{x}</li>)}</ul>
            </section>
            <section className="rm-card">
              <h3><Icon name="scale" size={16} /> المعدّل مقابل الخام</h3>
              <div className="co-bars">{fair.rows.filter(r => r.rank).slice(0, 10).map(r => <div key={r.id} className="co-bar-row"><span className="co-bar-label">{r.rank}. {r.name}</span><div className="co-bar"><i className="raw" style={{ width: `${((r.raw || 0) / 5) * 100}%` }} /><i className="adj" style={{ width: `${((r.adjusted || 0) / 5) * 100}%` }} /><b>{r.adjusted}</b></div></div>)}</div>
              <div className="co-legend"><span><i className="adj" /> المعدّل</span><span><i className="raw" /> الخام</span></div>
            </section>
          </div>
          <section className="rm-card">
            <h3><Icon name="table" size={16} /> جدول المدرّبين ({fair.rows.length})</h3>
            <div className="co-tablewrap"><table className="rm-table">
              <thead><tr><th>#</th><th>المدرّب</th><th>ن</th><th>برامج</th><th>الخام</th><th>المعدّل</th><th>السياق</th><th>± ثقة</th><th>% منخفض</th><th>الثقة</th><th>الاتجاه</th></tr></thead>
              <tbody>{fair.rows.map(r => <tr key={r.id} className={r.rank ? '' : 'dim'}><td>{r.rank ?? '—'}</td><td><b>{r.name}</b></td><td>{r.n}</td><td>{r.programs}</td><td>{r.raw ?? '—'}</td><td><span className={`co-st ${r.perf}`}>{r.adjusted ?? '—'}</span></td><td className={r.context == null ? '' : r.context > 0 ? 'up' : r.context < 0 ? 'down' : ''}>{r.context == null ? '—' : <bdi>{(r.context > 0 ? '+' : '') + r.context}</bdi>}</td><td>{r.ci == null ? '—' : <bdi>±{r.ci}</bdi>}</td><td>{r.lowPct}%</td><td><span className={`co-conf ${r.confidence}`}>{r.confidence === 'high' ? 'عالية' : r.confidence === 'medium' ? 'متوسطة' : r.confidence === 'low' ? 'منخفضة' : 'غير كافية'}</span></td><td className={r.delta == null ? '' : r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : ''}>{r.delta == null ? '—' : <bdi>{(r.delta > 0 ? '+' : '') + r.delta}</bdi>}</td></tr>)}</tbody>
            </table></div>
          </section>
        </>
      )}

      {tab === 'summary' && (
        <>
          <section className="rm-card co-noprint">
            <div className="co-filters">
              <label>النطاق<select value={sumProgram} onChange={e => setSumProgram(e.target.value)}><option value="">كل البرامج</option>{lk.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
              <label>الفترة<select value={sumDays} onChange={e => setSumDays(Number(e.target.value))}><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يومًا</option><option value={90}>آخر 90 يومًا</option><option value={365}>آخر سنة</option></select></label>
              <div className="co-actions"><button className="rm-btn primary" disabled={sumBusy} onClick={loadSummary}><Icon name="play" size={16} /> {sumBusy ? 'جارٍ التوليد…' : 'ولّد الملخص'}</button>{sum && <button className="rm-btn" onClick={copySummary}><Icon name="copy" size={16} /> نسخ</button>}</div>
            </div>
            <p className="rm-muted">يستخدم مزوّد الذكاء الاصطناعي المضبوط في Vercel (AI_API_KEY) إن وُجد، وإلا يُولَّد ملخص قائم على القواعد. الملخص نفسه يُدرج تلقائيًا أعلى رسالة التقرير الأسبوعية.</p>
          </section>
          {!sum && !sumBusy && <div className="rm-card rm-empty"><Icon name="compass" size={34} /><b>اضغط «ولّد الملخص»</b><span>ملخص في 30 ثانية: عنوان، أبرز النتائج، المخاطر، الإجراءات.</span></div>}
          {sumBusy && <div className="rm-card rm-empty"><b>جارٍ تحليل البيانات وصياغة الملخص…</b></div>}
          {sum && (
            <section className="rm-card co-sum">
              <div className="co-sum-src">{sum.summary.source === 'ai' ? <><Icon name="star" size={13} /> مُولَّد بالذكاء الاصطناعي{sum.summary.model ? ` · ${sum.summary.model}` : ''}</> : <><Icon name="chart" size={13} /> تحليل آلي قائم على القواعد{sum.ai.configured ? (sum.ai.error ? ` · تعذر الوصول للنموذج: ${sum.ai.error.slice(0, 80)}` : ' · لم يُعد النموذج ناتجًا صالحًا') : ' · لم يُضبط AI_API_KEY'}</>}</div>
              <h2>{sum.summary.headline}</h2>
              <ul className="co-ins">{sum.summary.bullets.map((b, i) => <li key={i} className="info">{b}</li>)}</ul>
              {sum.summary.risks.length > 0 && <><h4>المخاطر</h4><ul className="co-ins">{sum.summary.risks.map((b, i) => <li key={i} className="warn">{b}</li>)}</ul></>}
              {sum.summary.actions.length > 0 && <><h4>الإجراءات</h4><ol className="co-recs">{sum.summary.actions.map((b, i) => <li key={i}>{b}</li>)}</ol></>}
            </section>
          )}
        </>
      )}
    </div>
  );
}

const CSS = `
.co{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626}
.co *{box-sizing:border-box}
.co-tabs{display:flex;gap:6px;background:#fff;border:1px solid #EADFD6;border-radius:14px;padding:6px;margin-bottom:14px;flex-wrap:wrap}.co-tabs button{flex:1;min-width:160px;border:0;background:transparent;border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;font-weight:800;color:#5C4858;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}.co-tabs button.on{background:${NAVY};color:#fff}
.co-filters{display:grid;grid-template-columns:1fr 240px auto;gap:12px;align-items:end}.co-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#5C4858;min-width:0}
.co select{border:1px solid #D9CBC2;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;background:#fff;width:100%}
.co-print-title{display:none}
.co-chart{position:relative;display:flex;gap:10px;align-items:flex-end;height:220px;padding:24px 8px 36px;border-bottom:1px solid #EADFD6;overflow-x:auto}
.co-target{position:absolute;left:0;right:0;border-top:2px dashed ${GOLD};z-index:0}.co-target span{position:absolute;inset-inline-end:4px;top:-18px;font-size:11px;font-weight:900;color:#8A5A1E}
.co-col{position:relative;flex:1;min-width:64px;max-width:120px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;z-index:1}.co-col i{display:block;width:70%;border-radius:8px 8px 0 0;background:#B3A5AE}.co-col b{font-size:12.5px;color:${NAVY};margin-bottom:3px}.co-col small{position:absolute;bottom:-20px;font-size:11px;font-weight:800;color:#5C4858;white-space:nowrap}.co-col em{position:absolute;bottom:-34px;font-size:10px;font-style:normal;color:#B3A5AE;font-weight:700}
.co-col.ok i{background:#2F6B66}.co-col.info i{background:#8E4A68}.co-col.warn i{background:#8A5A1E}.co-col.bad i{background:#D4614A}.co-col.na i{background:#D9CBC2}
.co-grid2{display:grid;grid-template-columns:1fr 1.4fr;gap:14px}
.co-ins{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.co-ins li{border-radius:10px;padding:9px 12px;font-size:13px;font-weight:700;line-height:1.75;border:1px solid #EADFD6;background:#FBF4EE;color:#3A2634}.co-ins li.ok{background:#E6F3F1;border-color:#BFE1DC;color:#1F4F4A}.co-ins li.warn{background:#FBF4EE;border-color:#F1D9A8;color:#9A3A2A}.co-ins li.bad{background:#FBEDE7;border-color:#F3C4B6;color:#9A3A2A}.co-ins li.info{background:#F3E8EF;border-color:#E2CBDA;color:#3A1F36}
.co-tablewrap{overflow:auto;border:1px solid #EADFD6;border-radius:12px}.rm-table td.up{color:#2F6B66;font-weight:900}.rm-table td.down{color:#B9544A;font-weight:900}.rm-table tr.dim td{color:#B3A5AE}
.co-st{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:900;background:#F6EBE0;color:#5C4858}.co-st.ok{background:#E6F3F1;color:#2F6B66}.co-st.info{background:#F3E8EF;color:#6A3350}.co-st.warn{background:#FBF4EE;color:#8A5A1E}.co-st.bad{background:#FBEDE7;color:#B9544A}
.co-conf{font-size:11px;font-weight:900;border-radius:999px;padding:1px 8px;background:#F6EBE0;color:#5C4858}.co-conf.high{background:#E6F3F1;color:#2F6B66}.co-conf.medium{background:#F3E8EF;color:#6A3350}.co-conf.low{background:#FBF4EE;color:#8A5A1E}
.co-how{font-size:13px;line-height:1.9;color:#4A3645;background:#FBEDE7;border-color:#BFE1DC}
.co-bars{display:flex;flex-direction:column;gap:7px}.co-bar-row{display:grid;grid-template-columns:150px 1fr;gap:8px;align-items:center}.co-bar-label{font-size:12px;font-weight:800;color:#4A3645;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.co-bar{position:relative;height:16px;background:#F6EBE0;border-radius:999px;overflow:hidden}.co-bar i{position:absolute;inset-inline-start:0;top:0;height:100%;border-radius:999px}.co-bar i.raw{background:#D9CBC2}.co-bar i.adj{background:${TEAL};height:8px;top:4px}.co-bar b{position:absolute;inset-inline-end:8px;top:0;font-size:11px;line-height:16px}
.co-legend{display:flex;gap:14px;margin-top:8px;font-size:12px;font-weight:800;color:#5C4858}.co-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:4px;vertical-align:middle}.co-legend i.adj{background:${TEAL}}.co-legend i.raw{background:#D9CBC2}
.co-sum h2{margin:4px 0 12px;font-size:20px;color:${NAVY};line-height:1.6}.co-sum h4{margin:14px 0 6px;font-size:13px;color:#5C4858}.co-sum-src{font-size:11.5px;font-weight:900;color:#2F6B66;display:flex;align-items:center;gap:5px}
.co-recs{margin:0;padding:0 18px 0 0;display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:700;line-height:1.8}
@media print{.co{}.co-noprint{display:none!important}.global-nav{display:none!important}.co-print-title{display:block;font-size:20px;font-weight:900;color:${NAVY};margin:0 0 10px}}
@media(max-width:980px){.co{}.co-grid2,.co-filters{grid-template-columns:1fr}.co-bar-row{grid-template-columns:1fr}.co-tabs button{min-width:0;font-size:12px}}
`;
