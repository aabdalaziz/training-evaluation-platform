'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV } from '../../../lib/export/csv';
import { summarize, questionStats, domainStats, buckets, pairResponses, narrative, cohenLabel, hakeLabel } from '../../../lib/impact/analytics';
import type { ImpactAssessment, ImpactQuestion, ImpactResponse } from '../../../lib/impact/model';

type Program = { id: string; name_ar: string };
const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';

export default function ImpactReportPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [list, setList] = useState<ImpactAssessment[]>([]);
  const [questions, setQuestions] = useState<ImpactQuestion[]>([]);
  const [responses, setResponses] = useState<ImpactResponse[]>([]);
  const [programId, setProgramId] = useState('');
  const [assessmentId, setAssessmentId] = useState(params.get('assessment') || '');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const [pg, as, qs, rs] = await Promise.all([
        db.from('programs').select('id,name_ar').order('name_ar'),
        db.from('impact_assessments').select('*').order('created_at', { ascending: false }),
        db.from('impact_questions').select('*').order('order_no'),
        db.from('impact_responses').select('*'),
      ]);
      const err = [pg, as, qs, rs].find(r => r.error)?.error; if (err) setError(err.message);
      setPrograms((pg.data || []) as Program[]); setList((as.data || []) as ImpactAssessment[]);
      setQuestions((qs.data || []) as ImpactQuestion[]); setResponses((rs.data || []) as ImpactResponse[]);
      const first = (as.data || [])[0] as ImpactAssessment | undefined;
      const pre = params.get('assessment');
      if (pre) { const a = (as.data || []).find((x: any) => x.id === pre) as ImpactAssessment | undefined; if (a) setProgramId(a.program_id || ''); }
      else if (first) { setAssessmentId(first.id); setProgramId(first.program_id || ''); }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progList = useMemo(() => list.filter(a => !programId || a.program_id === programId), [list, programId]);
  const a = list.find(x => x.id === assessmentId) || null;
  const qs = useMemo(() => questions.filter(q => q.assessment_id === assessmentId), [questions, assessmentId]);
  const rows = useMemo(() => responses.filter(r => r.assessment_id === assessmentId && (!gender || r.gender === gender)), [responses, assessmentId, gender]);
  const s = useMemo(() => summarize(rows), [rows]);
  const qstats = useMemo(() => questionStats(qs, rows, a?.scale_max || 5), [qs, rows, a?.scale_max]);
  const dstats = useMemo(() => domainStats(qstats, a?.scale_max || 5), [qstats, a?.scale_max]);
  const dist = useMemo(() => buckets(rows), [rows]);
  const pairs = useMemo(() => pairResponses(rows), [rows]);
  const story = useMemo(() => a ? narrative(s, a.title_ar) : [], [s, a]);
  const pName = (id: string | null) => programs.find(p => p.id === id)?.name_ar || '—';

  // مقارنة بين كل أدوات البرنامج (أو كل الأدوات) — جدول موجز
  const compare = useMemo(() => progList.map(x => { const sm = summarize(responses.filter(r => r.assessment_id === x.id)); return { a: x, s: sm }; }), [progList, responses]);

  function exportCsv() {
    if (!a) return;
    const head = [['المتدرب (مُقنَّع)', 'الجنس', 'قبلي', 'بعدي', 'الفرق', ...qs.map(q => `${q.order_no}. ${q.text_ar} (قبلي)`), ...qs.map(q => `${q.order_no}. ${q.text_ar} (بعدي)`)]];
    const body = pairs.map(p => [p.label, p.gender || '', p.pre.score, p.post.score, p.gain, ...qs.map(q => p.pre.answers?.[q.id] ?? ''), ...qs.map(q => p.post.answers?.[q.id] ?? '')]);
    downloadCSV(`impact-${a.token}.csv`, [...head, ...body]);
  }

  if (!ready) return <div className="ir" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const fmt = (v: number | null | undefined, d = 1) => v === null || v === undefined ? '—' : Number(v).toFixed(d);
  const maxBar = (u: 'scale' | 'pct') => u === 'scale' ? (a?.scale_max || 5) : 100;

  return (
    <div className="ir" dir="rtl">
      <style>{CSS}</style>
      <header className="ir-head ir-noprint">
        <div>
          <div className="ir-kicker"><Icon name="trend" size={14} /> مركز التقارير</div>
          <h1>تقرير أثر التدريب — قبلي / بعدي</h1>
          <p>يقارن أداء المتدربين قبل البرنامج وبعده (أزواج الاستجابات لنفس المتدرب)، ويحسب الكسب المعياري وحجم الأثر والدلالة الإحصائية.</p>
        </div>
        <nav className="ir-nav">
          <Link href="/dashboard" className="ir-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/impact" className="ir-btn"><Icon name="target" size={16} /> إدارة الأدوات</Link>
          <Link href="/reports/center" className="ir-btn"><Icon name="chart" size={16} /> مركز التقارير</Link>
          <Link href="/reports/transfer" className="ir-btn"><Icon name="trend" size={16} /> نقل الأثر (المستوى 3)</Link>
          <button className="ir-btn" onClick={() => window.print()} disabled={!a}><Icon name="print" size={16} /> طباعة / PDF</button>
          <button className="ir-btn" onClick={exportCsv} disabled={!a || !pairs.length}><Icon name="download" size={16} /> CSV</button>
        </nav>
      </header>
      {error && <div className="ir-alert">{error}</div>}

      <section className="ir-card ir-noprint">
        <div className="ir-grid">
          <label>البرنامج<select value={programId} onChange={e => { setProgramId(e.target.value); const f = list.find(x => !e.target.value || x.program_id === e.target.value); setAssessmentId(f?.id || ''); }}><option value="">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
          <label>أداة القياس<select value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>{!progList.length && <option value="">— لا توجد أدوات —</option>}{progList.map(x => <option key={x.id} value={x.id}>{x.title_ar}</option>)}</select></label>
          <label>الجنس<select value={gender} onChange={e => setGender(e.target.value)}><option value="">الكل</option><option value="M">ذكور</option><option value="F">إناث</option></select></label>
        </div>
      </section>

      {!a && <section className="ir-card ir-empty"><Icon name="target" size={34} /><b>لا توجد أداة قياس مختارة</b><span>أنشئ أداة من صفحة «إدارة الأدوات» وشارك رابط القياس القبلي مع المتدربين.</span><Link href="/admin/impact?new=1" className="ir-btn primary">إنشاء أداة قياس</Link></section>}

      {a && (
        <>
          <section className="ir-title">
            <div className="ir-logos"><img src="/logos/upm.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /><img src="/logos/gate.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
            <h2>{a.title_ar}</h2>
            <p>{pName(a.program_id)} · الرمز {a.token} · {gender ? (gender === 'M' ? 'ذكور' : 'إناث') : 'كل المشاركين'} · طُبع {new Date().toLocaleDateString('ar-SA')}</p>
          </section>

          <section className="ir-kpis">
            <div className="ir-kpi"><small>استجابات قبلية</small><b>{s.nPre}</b></div>
            <div className="ir-kpi"><small>استجابات بعدية</small><b>{s.nPost}</b></div>
            <div className="ir-kpi hi"><small>أزواج مكتملة</small><b>{s.nPaired}</b><span>{s.nPre ? Math.round((s.nPaired / s.nPre) * 100) : 0}% من القبلي</span></div>
            <div className="ir-kpi"><small>المتوسط قبل</small><b>{fmt(s.pre.mean)}</b><span>من 100</span></div>
            <div className="ir-kpi"><small>المتوسط بعد</small><b>{fmt(s.post.mean)}</b><span>من 100</span></div>
            <div className={`ir-kpi ${s.gain !== null && s.gain > 0 ? 'up' : s.gain !== null && s.gain < 0 ? 'down' : ''}`}><small>الكسب</small><b>{s.gain !== null && s.gain > 0 ? '+' : ''}{fmt(s.gain)}</b><span>{s.gainPct !== null ? `${s.gainPct > 0 ? '+' : ''}${s.gainPct}%` : ''}</span></div>
          </section>

          <section className="ir-verdict" style={{ borderColor: s.verdict.color }}>
            <div className="ir-vmain">
              <div className="ir-vbadge" style={{ background: s.verdict.color }}>{s.verdict.ar}</div>
              <div className="ir-vstats">
                <div><small>الكسب المعياري (Hake g)</small><b>{fmt(s.hake, 2)}</b><span>{'< 0.3 منخفض · 0.3–0.7 متوسط · > 0.7 مرتفع'}</span></div>
                <div><small>حجم الأثر (Cohen&apos;s d)</small><b>{fmt(s.cohenD, 2)}</b><span>{cohenLabel(s.cohenD)}</span></div>
                <div><small>اختبار t للأزواج</small><b>{s.p === null ? '—' : s.p < 0.001 ? 'p < 0.001' : `p = ${s.p}`}</b><span>{s.t !== null ? `t = ${s.t} · df = ${s.df}` : 'يلزم زوجان فأكثر'}</span></div>
                <div><small>اتجاه المتدربين</small><b><span className="g">{s.improved}▲</span> <span className="n">{s.same}■</span> <span className="r">{s.declined}▼</span></b><span>تحسّن · ثبات · تراجع</span></div>
              </div>
            </div>
            <ul className="ir-story">{story.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>

          <div className="ir-two">
            <section className="ir-card">
              <h3><Icon name="scale" size={16} /> الأثر حسب المحور</h3>
              {!dstats.length && <p className="ir-muted">لا توجد بيانات.</p>}
              <table className="ir-table">
                <thead><tr><th>المحور</th><th>البنود</th><th>قبل</th><th>بعد</th><th>الفرق</th><th>g</th></tr></thead>
                <tbody>{dstats.map(d => <tr key={d.domain}><td><b>{d.domain}</b></td><td>{d.nItems}</td><td>{fmt(d.pre, 2)}{d.unit === 'pct' ? '%' : ''}</td><td>{fmt(d.post, 2)}{d.unit === 'pct' ? '%' : ''}</td><td className={d.gain !== null && d.gain > 0 ? 'up' : d.gain !== null && d.gain < 0 ? 'down' : ''}>{d.gain !== null && d.gain > 0 ? '+' : ''}{fmt(d.gain, 2)}</td><td><span className="ir-g" style={{ background: hakeLabel(d.hake).color }}>{fmt(d.hake, 2)}</span></td></tr>)}</tbody>
              </table>
            </section>
            <section className="ir-card">
              <h3><Icon name="chart" size={16} /> توزيع الدرجات (من 100)</h3>
              <Dist data={dist} />
              <div className="ir-legend"><span><i style={{ background: '#cbd5e1' }} /> قبلي</span><span><i style={{ background: TEAL }} /> بعدي</span></div>
            </section>
          </div>

          <section className="ir-card">
            <h3><Icon name="question" size={16} /> الأثر حسب البند (قبل ← بعد)</h3>
            {!qstats.length && <p className="ir-muted">لا توجد بنود.</p>}
            <div className="ir-bars">
              {qstats.map(q => {
                const max = maxBar(q.unit);
                const w = (v: number | null) => v === null ? 0 : Math.max(2, (Math.min(v, max) / max) * 100);
                return (
                  <div className="ir-bar" key={q.q.id}>
                    <div className="ir-bar-label"><span className="ir-qn">{q.q.order_no}</span><span>{q.q.text_ar}</span><small>{q.q.domain_ar} · {q.q.kind === 'mcq' ? 'معرفي' : 'مقياس'} · n={q.nPairs}</small></div>
                    <div className="ir-bar-track">
                      <div className="ir-bar-pre" style={{ width: `${w(q.pre)}%` }}><i>{fmt(q.pre, q.unit === 'pct' ? 0 : 2)}{q.unit === 'pct' ? '%' : ''}</i></div>
                      <div className="ir-bar-post" style={{ width: `${w(q.post)}%` }}><i>{fmt(q.post, q.unit === 'pct' ? 0 : 2)}{q.unit === 'pct' ? '%' : ''}</i></div>
                    </div>
                    <div className={`ir-bar-gain ${q.gain !== null && q.gain > 0 ? 'up' : q.gain !== null && q.gain < 0 ? 'down' : ''}`}>{q.gain !== null && q.gain > 0 ? '+' : ''}{fmt(q.gain, q.unit === 'pct' ? 0 : 2)}{q.unit === 'pct' ? '%' : ''}<small>g {fmt(q.hake, 2)}</small></div>
                  </div>
                );
              })}
            </div>
          </section>

          {compare.length > 1 && (
            <section className="ir-card">
              <h3><Icon name="compass" size={16} /> مقارنة أدوات القياس {programId ? 'في البرنامج' : 'في المنصة'}</h3>
              <table className="ir-table">
                <thead><tr><th>الأداة</th><th>البرنامج</th><th>أزواج</th><th>قبل</th><th>بعد</th><th>الكسب</th><th>Hake g</th><th>الحكم</th></tr></thead>
                <tbody>{compare.map(({ a: x, s: ss }) => <tr key={x.id} className={x.id === assessmentId ? 'cur' : ''} onClick={() => setAssessmentId(x.id)} style={{ cursor: 'pointer' }}><td><b>{x.title_ar}</b></td><td>{pName(x.program_id)}</td><td>{ss.nPaired}</td><td>{fmt(ss.pre.mean)}</td><td>{fmt(ss.post.mean)}</td><td className={ss.gain !== null && ss.gain > 0 ? 'up' : ''}>{ss.gain !== null && ss.gain > 0 ? '+' : ''}{fmt(ss.gain)}</td><td>{fmt(ss.hake, 2)}</td><td><span className="ir-g" style={{ background: ss.verdict.color }}>{ss.verdict.ar}</span></td></tr>)}</tbody>
              </table>
            </section>
          )}

          <section className="ir-card">
            <h3><Icon name="users" size={16} /> الأزواج المكتملة <span className="ir-pill">{pairs.length}</span> <small className="ir-muted">(معرّفات مُقنَّعة — لا تُعرض هوية المتدرب)</small></h3>
            {!pairs.length && <p className="ir-muted">لا توجد أزواج بعد — يحتاج التقرير إلى متدربين أكملوا القياسين بنفس المعرّف.</p>}
            {pairs.length > 0 && (
              <table className="ir-table">
                <thead><tr><th>#</th><th>المعرّف</th><th>الجنس</th><th>قبل</th><th>بعد</th><th>الفرق</th><th>الاتجاه</th></tr></thead>
                <tbody>{pairs.map((p, i) => <tr key={p.hash}><td>{i + 1}</td><td><bdi>{p.label}</bdi></td><td>{p.gender === 'M' ? 'ذكر' : p.gender === 'F' ? 'أنثى' : '—'}</td><td>{fmt(p.pre.score)}</td><td>{fmt(p.post.score)}</td><td className={p.gain > 0 ? 'up' : p.gain < 0 ? 'down' : ''}>{p.gain > 0 ? '+' : ''}{fmt(p.gain)}</td><td>{p.gain > 0.5 ? '▲ تحسّن' : p.gain < -0.5 ? '▼ تراجع' : '■ ثبات'}</td></tr>)}</tbody>
              </table>
            )}
          </section>

          <footer className="ir-foot">منهجية: الدرجة الموحدة 0–100 = متوسط (بنود المقياس محوَّلة إلى نسبة) و(نسبة الإجابات الصحيحة). الكسب المعياري g = (بعد − قبل) ÷ (100 − قبل) وفق Hake (1998). حجم الأثر d = متوسط الفروق ÷ انحرافها المعياري. اختبار t للعينات المرتبطة ثنائي الذيل.</footer>
        </>
      )}
    </div>
  );
}

function Dist({ data }: { data: { label: string; pre: number; post: number }[] }) {
  const max = Math.max(1, ...data.map(d => Math.max(d.pre, d.post)));
  const W = 520, H = 190, pad = 28, bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ir-dist" role="img">
      {data.map((d, i) => {
        const x = pad + i * bw; const hp = ((H - 40) * d.pre) / max, ho = ((H - 40) * d.post) / max;
        return (
          <g key={d.label}>
            <rect x={x + bw * 0.14} y={H - 24 - hp} width={bw * 0.32} height={hp} fill="#cbd5e1" rx={3} />
            <rect x={x + bw * 0.54} y={H - 24 - ho} width={bw * 0.32} height={ho} fill={TEAL} rx={3} />
            {d.pre > 0 && <text x={x + bw * 0.30} y={H - 28 - hp} fontSize={11} textAnchor="middle" fill="#475569" fontWeight={800}>{d.pre}</text>}
            {d.post > 0 && <text x={x + bw * 0.70} y={H - 28 - ho} fontSize={11} textAnchor="middle" fill={NAVY} fontWeight={800}>{d.post}</text>}
            <text x={x + bw / 2} y={H - 8} fontSize={11} textAnchor="middle" fill="#64748b" fontWeight={700}>{d.label}</text>
          </g>
        );
      })}
      <line x1={pad} x2={W - pad} y1={H - 24} y2={H - 24} stroke="#e2e8f0" />
    </svg>
  );
}

const CSS = `
.ir{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.ir-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.ir-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.ir-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.ir-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.ir-nav{display:flex;gap:8px;flex-wrap:wrap}
.ir-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.ir-btn:disabled{opacity:.5;cursor:not-allowed}.ir-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}
.ir-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700;font-size:13px}
.ir-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.ir-card h3{margin:0 0 12px;font-size:16px;color:${NAVY};display:flex;align-items:center;gap:8px}
.ir-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ir label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}.ir select{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff}
.ir-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;text-align:center;color:#64748b}.ir-empty b{color:${NAVY};font-size:15px}
.ir-muted{color:#64748b;font-size:12.5px;font-weight:700}.ir-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569}
.ir-title{background:#fff;border:1px solid #e2e8f0;border-top:5px solid ${GOLD};border-radius:16px;padding:16px 22px;margin-bottom:14px;text-align:center}
.ir-logos{display:flex;justify-content:space-between;align-items:center}.ir-logos img{height:44px;object-fit:contain}
.ir-title h2{margin:4px 0 2px;font-size:22px;color:${NAVY}}.ir-title p{margin:0;color:#64748b;font-size:12.5px;font-weight:700}
.ir-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}
.ir-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}.ir-kpi small{font-size:11.5px;font-weight:800;color:#64748b}.ir-kpi b{font-size:26px;color:${NAVY};line-height:1.1}.ir-kpi span{font-size:11px;color:#64748b;font-weight:700}
.ir-kpi.hi{border-color:#a7f3d0;background:#f0fdf9}.ir-kpi.up b{color:#047857}.ir-kpi.down b{color:#b91c1c}
.ir-verdict{background:#fff;border:1px solid #e2e8f0;border-inline-start:6px solid;border-radius:16px;padding:16px 22px;margin-bottom:14px}
.ir-vmain{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.ir-vbadge{color:#fff;font-weight:900;font-size:16px;border-radius:12px;padding:12px 18px;min-width:160px;text-align:center}
.ir-vstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;flex:1}.ir-vstats>div{display:flex;flex-direction:column;gap:2px;background:#f8fafc;border-radius:10px;padding:8px 10px}.ir-vstats small{font-size:11px;font-weight:800;color:#64748b}.ir-vstats b{font-size:18px;color:${NAVY}}.ir-vstats span{font-size:10.5px;color:#64748b;font-weight:700}
.ir-vstats .g{color:#047857}.ir-vstats .n{color:#64748b}.ir-vstats .r{color:#b91c1c}
.ir-story{margin:12px 0 0;padding:0 18px 0 0;font-size:13.5px;line-height:1.9;color:#334155;font-weight:700}
.ir-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ir-table{width:100%;border-collapse:collapse;font-size:13px}.ir-table th{text-align:start;background:#f8fafc;color:#475569;font-size:11.5px;padding:8px 10px;border-bottom:1px solid #e2e8f0}.ir-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.ir-table tr.cur td{background:#fffbeb}
.ir td.up,.ir .up{color:#047857;font-weight:900}.ir td.down,.ir .down{color:#b91c1c;font-weight:900}
.ir-g{display:inline-block;color:#fff;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900}
.ir-dist{width:100%;height:auto;display:block}.ir-legend{display:flex;gap:14px;justify-content:center;font-size:12px;font-weight:800;color:#475569}.ir-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:5px;vertical-align:-1px}
.ir-bars{display:flex;flex-direction:column;gap:10px}
.ir-bar{display:grid;grid-template-columns:1.2fr 2fr 90px;gap:12px;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:10px}
.ir-bar-label{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;font-weight:800;color:#0f172a}.ir-bar-label small{width:100%;color:#64748b;font-weight:700;font-size:11px}
.ir-qn{min-width:22px;height:22px;border-radius:999px;background:#eef2f7;color:${NAVY};display:grid;place-items:center;font-size:11px}
.ir-bar-track{display:flex;flex-direction:column;gap:4px}
.ir-bar-pre,.ir-bar-post{height:16px;border-radius:0 6px 6px 0;position:relative;min-width:2px;transition:width .4s}.ir-bar-pre{background:#cbd5e1}.ir-bar-post{background:${TEAL}}
.ir-bar-pre i,.ir-bar-post i{position:absolute;inset-inline-end:-44px;top:-1px;font-style:normal;font-size:11px;font-weight:900;color:#334155;width:40px}
.ir-bar-gain{text-align:center;font-size:16px;font-weight:900;color:#475569;display:flex;flex-direction:column}.ir-bar-gain small{font-size:10.5px;color:#64748b;font-weight:700}
.ir-foot{font-size:11.5px;color:#64748b;line-height:1.8;padding:10px 4px;font-weight:700}
@media print{.ir-noprint{display:none!important}.ir{background:#fff;padding:0}.ir-card,.ir-verdict,.ir-title,.ir-kpi{border-color:#cbd5e1;break-inside:avoid}.ir-two{grid-template-columns:1fr 1fr}}
@media(max-width:980px){.ir-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.ir-two{grid-template-columns:1fr}.ir-vstats{grid-template-columns:1fr 1fr}.ir-bar{grid-template-columns:1fr}.ir-grid{grid-template-columns:1fr}.ir{padding:12px}}
`;
