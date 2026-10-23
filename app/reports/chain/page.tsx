'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { buildChain, portfolioSummary } from '../../../lib/outcomes/chain';
import type { ChainRow } from '../../../lib/outcomes/chain';
import { LEVEL_META, chainLabel, chainRecommendations, chainCsv, kpiRows, achievementLabel } from '../../../lib/outcomes/model';
import type { OutcomeKpi, OutcomeMeasurement } from '../../../lib/outcomes/model';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
type SortKey = 'index' | 'name' | 'levels';

export default function ChainReportPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<ChainRow[]>([]);
  const [kpis, setKpis] = useState<OutcomeKpi[]>([]); const [ms, setMs] = useState<OutcomeMeasurement[]>([]);
  const [programId, setProgramId] = useState(params.get('program') || '');
  const [onlyData, setOnlyData] = useState(true);
  const [sort, setSort] = useState<SortKey>('index');
  const [error, setError] = useState('');
  const [printedAt, setPrintedAt] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/reports/chain'); return; }
      const [pg, ev, an, ia, ir, fu, bq, br, ss, ar, ok, om] = await Promise.all([
        db.from('programs').select('id,name_ar,status,end_date').order('name_ar'),
        db.from('evaluations').select('id,program_id,overall_rating').limit(20000),
        db.from('evaluation_answers').select('evaluation_id,rating_value').limit(200000),
        db.from('impact_assessments').select('id,program_id'),
        db.from('impact_responses').select('id,assessment_id,phase,respondent_hash,respondent_label,gender,score,knowledge_pct,scale_mean,submitted_at').limit(20000),
        db.from('behavior_followups').select('*'),
        db.from('behavior_questions').select('*'),
        db.from('behavior_responses').select('*').limit(20000),
        db.from('attendance_sessions').select('id,program_id'),
        db.from('attendance_records').select('session_id,full_name,email,phone,identity_key,status').limit(50000),
        db.from('outcome_kpis').select('*'),
        db.from('outcome_measurements').select('*').limit(20000),
      ]);
      const err = [pg, ev, an, ia, ir, fu, bq, br, ss, ar, ok, om].find(r => r.error)?.error; if (err) setError(err.message);
      const programs = ((pg.data || []) as any[]).filter(p => p.status !== 'CANCELLED');
      const out = buildChain({
        programs, evaluations: (ev.data || []) as any[], answers: (an.data || []) as any[], assessments: (ia.data || []) as any[], impactResponses: (ir.data || []) as any[],
        followups: (fu.data || []) as any[], questions: (bq.data || []) as any[], behaviorResponses: (br.data || []) as any[],
        sessions: (ss.data || []) as any[], records: (ar.data || []) as any[], kpis: (ok.data || []) as any[], measurements: (om.data || []) as any[],
      });
      setRows(out); setKpis((ok.data || []) as OutcomeKpi[]); setMs((om.data || []) as OutcomeMeasurement[]);
      setPrintedAt(new Date().toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    let xs = rows.filter(r => !onlyData || r.s.levels > 0);
    if (sort === 'index') xs = [...xs].sort((a, b) => (b.s.index ?? -1) - (a.s.index ?? -1) || b.s.levels - a.s.levels);
    else if (sort === 'levels') xs = [...xs].sort((a, b) => b.s.levels - a.s.levels || (b.s.index ?? -1) - (a.s.index ?? -1));
    else xs = [...xs].sort((a, b) => a.program.name_ar.localeCompare(b.program.name_ar, 'ar'));
    return xs;
  }, [rows, onlyData, sort]);
  const port = useMemo(() => portfolioSummary(rows.filter(r => r.s.levels > 0)), [rows]);
  const sel = rows.find(r => r.program.id === programId) || null;
  const selKpis = useMemo(() => (sel ? kpiRows(kpis.filter(k => k.program_id === sel.program.id), ms) : []), [sel, kpis, ms]);
  const recs = useMemo(() => (sel ? chainRecommendations(sel.c, sel.s) : []), [sel]);

  function exportCsv() { downloadCSV(safeFilename('impact_chain'), chainCsv(visible.map(r => ({ program: r.program.name_ar, c: r.c, s: r.s })))); }

  if (!ready) return <div className="ch" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  const Level = ({ n, score, raw, sub, compact }: { n: 1 | 2 | 3 | 4; score: number | null; raw: string; sub: string; compact?: boolean }) => {
    const m = LEVEL_META[n]; const tone = score == null ? 'none' : score >= 75 ? 'ok' : score >= 60 ? 'info' : score >= 45 ? 'warn' : 'bad';
    return (
      <div className={`ch-level ${tone} ${compact ? 'compact' : ''}`}>
        <div className="ch-level-head"><span className="ch-num">{n}</span><div><b>{m.ar}</b><small>{m.en}</small></div></div>
        <div className="ch-level-score"><b>{score == null ? '—' : score}</b><small>/100</small></div>
        <div className="ch-level-raw">{raw}</div>
        <div className="ch-level-sub">{sub}</div>
        <div className="ch-bar"><i style={{ width: `${score ?? 0}%` }} /></div>
      </div>
    );
  };
  const levelsOf = (r: ChainRow, compact?: boolean) => (
    <div className="ch-levels">
      <Level n={1} score={r.s.s1} raw={r.c.l1 == null ? 'لا تقييمات' : `${r.c.l1} / 5`} sub={r.c.l1_n ? `${r.c.l1_n} استبانة` : LEVEL_META[1].source} compact={compact} />
      <span className="ch-arrow">←</span>
      <Level n={2} score={r.s.s2} raw={r.c.l2 == null ? 'لا قياس قبلي/بعدي' : `g = ${r.c.l2}`} sub={r.c.l2_pairs ? `${r.c.l2_pairs} زوجًا · كسب ${r.c.l2_gain ?? '—'} نقطة` : LEVEL_META[2].source} compact={compact} />
      <span className="ch-arrow">←</span>
      <Level n={3} score={r.s.s3} raw={r.c.l3 == null ? 'لا متابعة' : `${r.c.l3} / 100`} sub={r.c.l3_n ? `${r.c.l3_n} استجابة متابعة` : LEVEL_META[3].source} compact={compact} />
      <span className="ch-arrow">←</span>
      <Level n={4} score={r.s.s4} raw={r.c.l4 == null ? (r.c.l4_n ? 'مؤشرات بلا قياس' : 'لا مؤشرات') : `${r.c.l4}% تحقق`} sub={r.c.l4_n ? `${r.c.l4_n} مؤشر نتائج` : LEVEL_META[4].source} compact={compact} />
    </div>
  );

  return (
    <div className="ch" dir="rtl">
      <style>{CSS}</style>
      <header className="ch-head ch-noprint">
        <div>
          <div className="ch-kicker"><Icon name="trend" size={14} /> التقارير · كيركباتريك — المستويات الأربعة</div>
          <h1>سلسلة أثر التدريب 1→4</h1>
          <p>من رضا المتدرب إلى نتائج المؤسسة في صفحة واحدة: رد الفعل (التقييمات) ← التعلم (القبلي/البعدي) ← السلوك (المتابعة) ← النتائج (مؤشرات الأداء). يحدد التقرير أين تنكسر السلسلة ويقترح الإجراء.</p>
        </div>
        <nav className="ch-nav">
          <Link href="/dashboard" className="ch-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/outcomes" className="ch-btn"><Icon name="flag" size={16} /> مؤشرات النتائج</Link>
          <Link href="/reports/impact" className="ch-btn"><Icon name="target" size={16} /> المستوى 2</Link>
          <Link href="/reports/transfer" className="ch-btn"><Icon name="trend" size={16} /> المستوى 3</Link>
          <button className="ch-btn" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة / PDF</button>
          <button className="ch-btn" onClick={exportCsv} disabled={!visible.length}><Icon name="download" size={16} /> CSV</button>
        </nav>
      </header>
      {error && <div className="ch-alert ch-noprint">{error}</div>}

      <div className="ch-print-head">
        <div className="ch-logos"><img src="/logos/upm.png" alt="" /><img src="/logos/gate.png" alt="" /></div>
        <h2>سلسلة أثر التدريب — {sel ? sel.program.name_ar : 'جميع البرامج'}</h2>
        <p>نموذج كيركباتريك (المستويات 1–4) · <bdi>{printedAt}</bdi></p>
      </div>

      {/* ملخص المحفظة */}
      <section className="ch-port">
        <div className="ch-port-main">
          <span>مؤشر السلسلة على مستوى المؤسسة</span>
          <b>{port.index.mean ?? '—'}</b>
          <small>{chainLabel(port.index.mean).ar} · {port.index.n} برنامجًا لديه بيانات · {port.complete} مكتمل المستويات الأربعة</small>
        </div>
        {([1, 2, 3, 4] as const).map(n => { const v = n === 1 ? port.s1 : n === 2 ? port.s2 : n === 3 ? port.s3 : port.s4; return <div key={n} className="ch-port-item"><span>{n} · {LEVEL_META[n].ar}</span><b>{v.mean ?? '—'}</b><small>{v.n} برنامجًا</small></div>; })}
      </section>

      <section className="ch-card ch-noprint">
        <div className="ch-filters">
          <label>البرنامج (للتفصيل)<select value={programId} onChange={e => setProgramId(e.target.value)}><option value="">— نظرة عامة على كل البرامج —</option>{rows.map(r => <option key={r.program.id} value={r.program.id}>{r.program.name_ar}</option>)}</select></label>
          <label>الترتيب<select value={sort} onChange={e => setSort(e.target.value as SortKey)}><option value="index">مؤشر السلسلة</option><option value="levels">اكتمال المستويات</option><option value="name">الاسم</option></select></label>
          <label className="ch-check"><input type="checkbox" checked={onlyData} onChange={e => setOnlyData(e.target.checked)} /> إخفاء البرامج بلا بيانات</label>
        </div>
      </section>

      {sel && (
        <>
          <section className="ch-card ch-detail">
            <div className="ch-detail-head">
              <div><h3>{sel.program.name_ar}</h3><div className="ch-muted">{sel.c.participants != null ? `${sel.c.participants} مشاركًا · ` : ''}{sel.c.attendance_pct != null ? `حضور ${sel.c.attendance_pct}% · ` : ''}{sel.program.end_date ? <>انتهى <bdi>{sel.program.end_date}</bdi></> : 'بلا تاريخ انتهاء'}</div></div>
              <div className={`ch-index ${chainLabel(sel.s.index).tone}`}><b>{sel.s.index ?? '—'}</b><span>{chainLabel(sel.s.index).ar}</span><small>{sel.s.levels}/4 مستويات مقاسة</small></div>
            </div>
            {levelsOf(sel)}
            {sel.s.weakest && sel.s.levels > 1 && <div className="ch-weak"><Icon name="alert" size={16} /> الحلقة الأضعف: المستوى {sel.s.weakest} ({LEVEL_META[sel.s.weakest].ar}) — <Link href={LEVEL_META[sel.s.weakest].href + `?program=${sel.program.id}`}>افتح التقرير التفصيلي</Link></div>}
          </section>
          <div className="ch-grid2">
            <section className="ch-card">
              <h3><Icon name="compass" size={16} /> قراءة السلسلة وتوصيات</h3>
              <ol className="ch-recs">{recs.map((r, i) => <li key={i}>{r}</li>)}</ol>
            </section>
            <section className="ch-card">
              <h3><Icon name="flag" size={16} /> مؤشرات النتائج (المستوى 4)</h3>
              {!selKpis.length && <div className="ch-muted">لا توجد مؤشرات — <Link href={`/admin/outcomes?program=${sel.program.id}`}>أضف مؤشرات النتائج</Link>.</div>}
              {selKpis.map(k => { const lab = achievementLabel(k.achievement); return (
                <div key={k.id} className="ch-kpi">
                  <div className="ch-kpi-top"><b>{k.name_ar}</b><span className={`ch-st ${lab.tone}`}>{k.achievement == null ? '—' : `${k.achievement}%`}</span></div>
                  <div className="ch-bar"><i style={{ width: `${k.achievement ?? 0}%` }} className={lab.tone} /></div>
                  <small><bdi>{k.baseline ?? '—'}</bdi> ← <bdi>{k.current ?? '—'}</bdi> ← المستهدف <bdi>{k.target ?? '—'}</bdi> {k.unit}{k.measured_on && <> · آخر قياس <bdi>{k.measured_on}</bdi></>}</small>
                </div>
              ); })}
            </section>
          </div>
        </>
      )}

      {!sel && (
        <>
          {!visible.length && <div className="ch-card ch-empty"><Icon name="trend" size={34} /><b>لا توجد بيانات أثر بعد</b><span>ابدأ بالتقييمات اليومية/النهائية ثم أداة القياس القبلي/البعدي وحملات المتابعة ومؤشرات النتائج.</span></div>}
          <div className="ch-cards">
            {visible.map(r => (
              <section key={r.program.id} className="ch-card ch-pcard">
                <div className="ch-detail-head">
                  <div><h3><button className="ch-link" onClick={() => setProgramId(r.program.id)}>{r.program.name_ar}</button></h3><div className="ch-muted">{r.c.participants != null ? `${r.c.participants} مشاركًا · ` : ''}{r.c.attendance_pct != null ? `حضور ${r.c.attendance_pct}%` : 'بلا سجل حضور'}</div></div>
                  <div className={`ch-index small ${chainLabel(r.s.index).tone}`}><b>{r.s.index ?? '—'}</b><span>{chainLabel(r.s.index).ar}</span><small>{r.s.levels}/4</small></div>
                </div>
                {levelsOf(r, true)}
              </section>
            ))}
          </div>
          {visible.length > 0 && (
            <section className="ch-card">
              <h3><Icon name="table" size={16} /> جدول المقارنة</h3>
              <div className="ch-tablewrap">
                <table className="ch-table">
                  <thead><tr><th>البرنامج</th><th>1 رد الفعل</th><th>2 التعلم</th><th>3 السلوك</th><th>4 النتائج</th><th>مؤشر السلسلة</th><th>الحلقة الأضعف</th><th>الحضور</th></tr></thead>
                  <tbody>{visible.map(r => (
                    <tr key={r.program.id}>
                      <td><b>{r.program.name_ar}</b></td>
                      <td>{r.s.s1 ?? '—'}<small> {r.c.l1 != null && `(${r.c.l1}/5)`}</small></td>
                      <td>{r.s.s2 ?? '—'}<small> {r.c.l2 != null && `(g ${r.c.l2})`}</small></td>
                      <td>{r.s.s3 ?? '—'}</td>
                      <td>{r.s.s4 ?? '—'}<small> {r.c.l4_n ? `(${r.c.l4_n} مؤشر)` : ''}</small></td>
                      <td><span className={`ch-st ${chainLabel(r.s.index).tone}`}>{r.s.index ?? '—'}</span></td>
                      <td>{r.s.weakest && r.s.levels > 1 ? `${r.s.weakest} · ${LEVEL_META[r.s.weakest].ar}` : '—'}</td>
                      <td>{r.c.attendance_pct == null ? '—' : `${r.c.attendance_pct}%`}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <p className="ch-foot">كيفية الحساب: المستوى 1 = (متوسط التقييم − 1) ÷ 4 · المستوى 2 = الكسب المعياري g × 100 · المستوى 3 = مؤشر نقل الأثر · المستوى 4 = المتوسط الموزون لتحقق المؤشرات · مؤشر السلسلة = متوسط المستويات المتاحة.</p>
    </div>
  );
}

const CSS = `
.ch{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.ch *{box-sizing:border-box}
.ch-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.ch-head h1{margin:2px 0 4px;font-size:24px;color:${NAVY}}.ch-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.ch-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.ch-nav{display:flex;gap:8px;flex-wrap:wrap}
.ch-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.ch-btn:disabled{opacity:.5}
.ch-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}
.ch-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px;min-width:0}.ch-card h3{margin:0 0 10px;font-size:15px;color:${NAVY};display:flex;align-items:center;gap:8px}
.ch-muted{color:#64748b;font-size:12.5px;font-weight:700;line-height:1.7}
.ch-link{border:0;background:none;font:inherit;color:${NAVY};cursor:pointer;padding:0;text-decoration:none}.ch-link:hover{color:${TEAL};text-decoration:underline}
.ch-filters{display:grid;grid-template-columns:1fr 200px auto;gap:12px;align-items:end}.ch-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569;min-width:0}
.ch select{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;background:#fff;width:100%}
.ch-check{flex-direction:row!important;align-items:center;gap:8px!important;padding-bottom:10px}
.ch-port{display:grid;grid-template-columns:1.6fr repeat(4,1fr);gap:10px;margin-bottom:14px}
.ch-port-main{background:${NAVY};color:#fff;border-radius:16px;border-top:4px solid ${GOLD};padding:16px 18px;display:flex;flex-direction:column;gap:2px;min-width:0}.ch-port-main span{font-size:12px;font-weight:800;color:#cbd5e1}.ch-port-main b{font-size:42px;line-height:1.1}.ch-port-main small{font-size:11.5px;color:#cbd5e1;font-weight:700}
.ch-port-item{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:2px;min-width:0}.ch-port-item span{font-size:12px;font-weight:800;color:#64748b}.ch-port-item b{font-size:28px;color:${NAVY};line-height:1.2}.ch-port-item small{font-size:11px;color:#94a3b8;font-weight:700}
.ch-detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}.ch-detail-head h3{margin:0;font-size:17px}
.ch-index{display:flex;flex-direction:column;align-items:center;border-radius:14px;padding:10px 18px;min-width:150px;background:#f1f5f9;color:#475569}.ch-index b{font-size:32px;line-height:1.1}.ch-index span{font-size:12px;font-weight:900}.ch-index small{font-size:10.5px;font-weight:700;opacity:.8}
.ch-index.small{padding:6px 12px;min-width:120px}.ch-index.small b{font-size:24px}
.ch-index.ok{background:#ecfdf5;color:#047857}.ch-index.info{background:#eff6ff;color:#1d4ed8}.ch-index.warn{background:#fff7ed;color:#b45309}.ch-index.bad{background:#fef2f2;color:#b91c1c}
.ch-levels{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:6px;align-items:stretch}
.ch-arrow{align-self:center;color:#cbd5e1;font-size:22px;font-weight:900}
.ch-level{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;min-width:0;background:#fff;border-top:4px solid #cbd5e1}
.ch-level.ok{border-top-color:#059669}.ch-level.info{border-top-color:#2563eb}.ch-level.warn{border-top-color:#d97706}.ch-level.bad{border-top-color:#dc2626}.ch-level.none{background:#f8fafc;border-style:dashed}
.ch-level-head{display:flex;align-items:center;gap:8px}.ch-level-head b{display:block;font-size:13.5px;color:${NAVY}}.ch-level-head small{font-size:10.5px;color:#94a3b8;font-weight:700}
.ch-num{width:26px;height:26px;border-radius:999px;background:${NAVY};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex:none}
.ch-level-score b{font-size:30px;color:${NAVY};line-height:1.1}.ch-level-score small{color:#94a3b8;margin-inline-start:3px;font-weight:700}
.ch-level.compact .ch-level-score b{font-size:24px}
.ch-level-raw{font-size:12.5px;font-weight:900;color:${TEAL}}.ch-level-sub{font-size:11px;color:#64748b;font-weight:700}
.ch-bar{height:7px;background:#f1f5f9;border-radius:999px;overflow:hidden;margin-top:4px}.ch-bar i{display:block;height:100%;background:${TEAL};border-radius:999px}.ch-bar i.ok{background:#059669}.ch-bar i.info{background:#2563eb}.ch-bar i.warn{background:#d97706}.ch-bar i.bad{background:#dc2626}
.ch-level.none .ch-bar i{background:#cbd5e1}
.ch-weak{margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13px;display:flex;align-items:center;gap:8px}.ch-weak a{color:#9a3412}
.ch-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ch-recs{margin:0;padding:0 18px 0 0;display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:700;line-height:1.8;color:#1e293b}
.ch-kpi{border-bottom:1px solid #f1f5f9;padding:8px 0}.ch-kpi:last-child{border:0}.ch-kpi-top{display:flex;justify-content:space-between;gap:8px;font-size:13px;color:${NAVY}}.ch-kpi small{color:#64748b;font-weight:700;font-size:11.5px}
.ch-st{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:900;background:#f1f5f9;color:#475569}.ch-st.ok{background:#ecfdf5;color:#047857}.ch-st.info{background:#eff6ff;color:#1d4ed8}.ch-st.warn{background:#fff7ed;color:#b45309}.ch-st.bad{background:#fef2f2;color:#b91c1c}
.ch-cards{display:flex;flex-direction:column;gap:0}
.ch-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;text-align:center;color:#64748b}.ch-empty b{color:${NAVY};font-size:15px}
.ch-tablewrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}
.ch-table{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}.ch-table th{background:#f8fafc;color:#475569;font-size:12px;text-align:start;padding:9px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.ch-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.ch-table small{color:#94a3b8}
.ch-foot{color:#94a3b8;font-size:11.5px;font-weight:700;text-align:center;margin:8px 0 0;line-height:1.7}
.ch-print-head{display:none}
@media print{.ch{padding:0;background:#fff}.ch-noprint{display:none!important}.ch-print-head{display:block;text-align:center;margin-bottom:12px}.ch-print-head h2{margin:4px 0;color:${NAVY}}.ch-print-head p{margin:0;color:#475569;font-size:12px}.ch-logos{display:flex;justify-content:space-between}.ch-logos img{height:44px}.ch-card,.ch-port{break-inside:avoid}.global-nav{display:none!important}.ch-link{text-decoration:none}}
@media(max-width:1100px){.ch-port{grid-template-columns:repeat(2,1fr)}.ch-port-main{grid-column:span 2}}
@media(max-width:980px){.ch{padding:12px}.ch-levels{grid-template-columns:1fr 1fr}.ch-arrow{display:none}.ch-grid2,.ch-filters{grid-template-columns:1fr}.ch-check{padding-bottom:0}}
@media(max-width:520px){.ch-levels,.ch-port{grid-template-columns:1fr}.ch-port-main{grid-column:auto}}
`;
