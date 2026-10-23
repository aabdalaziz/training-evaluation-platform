'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { analyze, recommendations, csvRows, transferLabel } from '../../../lib/behavior/model';
import type { BehaviorFollowup, BehaviorQuestion, BehaviorResponse } from '../../../lib/behavior/model';

type Program = { id: string; name_ar: string };
const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';

export default function TransferReportPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [list, setList] = useState<BehaviorFollowup[]>([]);
  const [questions, setQuestions] = useState<BehaviorQuestion[]>([]);
  const [responses, setResponses] = useState<BehaviorResponse[]>([]);
  const [programId, setProgramId] = useState('');
  const [followupId, setFollowupId] = useState(params.get('followup') || '');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/reports/transfer'); return; }
      const [pg, fs, qs, rs] = await Promise.all([
        db.from('programs').select('id,name_ar').order('name_ar'),
        db.from('behavior_followups').select('*').order('created_at', { ascending: false }),
        db.from('behavior_questions').select('*').order('order_no'),
        db.from('behavior_responses').select('*'),
      ]);
      const err = [pg, fs, qs, rs].find(r => r.error)?.error; if (err) setError(err.message);
      setPrograms((pg.data || []) as Program[]); setList((fs.data || []) as BehaviorFollowup[]);
      setQuestions((qs.data || []) as BehaviorQuestion[]); setResponses((rs.data || []) as BehaviorResponse[]);
      const pre = params.get('followup'); const first = (fs.data || [])[0] as BehaviorFollowup | undefined;
      if (pre) { const f = (fs.data || []).find((x: any) => x.id === pre) as BehaviorFollowup | undefined; if (f) setProgramId(f.program_id || ''); }
      else if (first) { setFollowupId(first.id); setProgramId(first.program_id || ''); }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progList = useMemo(() => list.filter(f => !programId || f.program_id === programId), [list, programId]);
  const f = list.find(x => x.id === followupId) || null;
  const qs = useMemo(() => questions.filter(q => q.followup_id === followupId), [questions, followupId]);
  const rows = useMemo(() => responses.filter(r => r.followup_id === followupId), [responses, followupId]);
  const s = useMemo(() => analyze(qs, rows, f?.scale_max || 5), [qs, rows, f?.scale_max]);
  const recs = useMemo(() => recommendations(s), [s]);
  const pName = (id: string | null) => programs.find(p => p.id === id)?.name_ar || '—';
  const max = f?.scale_max || 5;
  const pct = (m: number | null) => (m == null ? 0 : Math.round((100 * (m - 1)) / Math.max(1, max - 1)));

  // استجابات البرنامج كله (كل حملاته) للمقارنة الزمنية
  const programTrend = useMemo(() => {
    if (!programId) return [];
    return list.filter(x => x.program_id === programId).map(x => ({ f: x, s: analyze(questions.filter(q => q.followup_id === x.id), responses.filter(r => r.followup_id === x.id), x.scale_max) })).filter(x => x.s.n > 0).reverse();
  }, [list, questions, responses, programId]);

  function exportCsv() { if (!f) return; downloadCSV(safeFilename(`transfer_${f.token}`), csvRows(f, pName(f.program_id), s)); }

  if (!ready) return <div className="tr" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  const idx = s.transfer_index; const tone = s.label.tone;
  const gaugeDeg = idx == null ? 0 : Math.round((idx / 100) * 180);

  return (
    <div className="tr" dir="rtl">
      <style>{CSS}</style>
      <header className="tr-head tr-noprint">
        <div>
          <div className="tr-kicker"><Icon name="trend" size={14} /> التقارير · كيركباتريك — المستوى 3 (السلوك)</div>
          <h1>تقرير نقل أثر التدريب إلى بيئة العمل</h1>
          <p>ماذا تغيّر فعلًا بعد 60–90 يومًا؟ مقارنة تقدير المشرف المباشر بالتقدير الذاتي للمتدرب، نسبة التطبيق المصرّح بها، معوقات النقل، وتوصيات تلقائية.</p>
        </div>
        <nav className="tr-nav">
          <Link href="/dashboard" className="tr-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/followup" className="tr-btn"><Icon name="settings" size={16} /> إدارة الحملات</Link>
          <Link href="/reports/impact" className="tr-btn"><Icon name="target" size={16} /> القبلي/البعدي</Link>
          <Link href="/reports/chain" className="tr-btn"><Icon name="flag" size={16} /> سلسلة الأثر 1→4</Link>
          <button className="tr-btn" onClick={() => window.print()} disabled={!f}><Icon name="print" size={16} /> طباعة / PDF</button>
          <button className="tr-btn" onClick={exportCsv} disabled={!f || !s.pairs.length}><Icon name="download" size={16} /> CSV</button>
        </nav>
      </header>
      {error && <div className="tr-alert">{error}</div>}

      <section className="tr-card tr-noprint">
        <div className="tr-filters">
          <label>البرنامج<select value={programId} onChange={e => { setProgramId(e.target.value); const first = list.find(x => !e.target.value || x.program_id === e.target.value); setFollowupId(first?.id || ''); }}><option value="">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
          <label>حملة المتابعة<select value={followupId} onChange={e => setFollowupId(e.target.value)}><option value="">— اختر —</option>{progList.map(x => <option key={x.id} value={x.id}>{x.title_ar} ({String(x.created_at || '').slice(0, 10)})</option>)}</select></label>
        </div>
      </section>

      {!f && <div className="tr-card tr-empty"><Icon name="trend" size={34} /><b>لا توجد حملة متابعة محددة</b><span>أنشئ حملة من «إدارة الحملات» ثم عُد إلى هذا التقرير بعد وصول الاستجابات.</span></div>}

      {f && (
        <>
          <div className="tr-print-head">
            <div className="tr-logos"><img src="/logos/upm.png" alt="" /><img src="/logos/gate.png" alt="" /></div>
            <h2>{f.title_ar}</h2>
            <p>{pName(f.program_id)} · متابعة بعد {f.due_days} يومًا · {s.n} استجابة ({s.n_sup} مشرف · {s.n_tr} متدرب) · {s.n_trainees} متدربًا مقيَّمًا</p>
          </div>

          <section className="tr-hero">
            <div className={`tr-gauge-card ${tone}`}>
              <div className="tr-gauge" style={{ ['--deg' as any]: `${gaugeDeg}deg` }}><div className="tr-gauge-in"><b>{idx == null ? '—' : idx}</b><small>/ 100</small></div></div>
              <div className="tr-gauge-label">{s.label.ar}</div>
              <div className="tr-muted">مؤشر نقل الأثر = متوسط (المقياس %، نسبة التطبيق) مع ترجيح تقدير المشرف 60%</div>
            </div>
            <div className="tr-kpis">
              <div className="tr-kpi"><span>تقدير المشرف</span><b>{s.mean_sup ?? '—'}</b><small>/ {max} · n={s.n_sup}</small></div>
              <div className="tr-kpi"><span>التقدير الذاتي</span><b>{s.mean_tr ?? '—'}</b><small>/ {max} · n={s.n_tr}</small></div>
              <div className="tr-kpi"><span>نسبة التطبيق</span><b>{s.app_all == null ? '—' : `${Math.round(s.app_all)}%`}</b><small>مشرف {s.app_sup == null ? '—' : Math.round(s.app_sup) + '%'} · ذاتي {s.app_tr == null ? '—' : Math.round(s.app_tr) + '%'}</small></div>
              <div className={`tr-kpi ${s.gap != null && Math.abs(s.gap) >= 0.5 ? 'warn' : ''}`}><span>فجوة الإدراك (مشرف − متدرب)</span><b>{s.gap == null ? '—' : (s.gap > 0 ? '+' : '') + s.gap}</b><small>{s.gap == null ? 'تحتاج تقييمين لنفس المتدرب' : s.gap <= -0.5 ? 'المتدرب يقدّر نفسه أعلى' : s.gap >= 0.5 ? 'المشرف يرى أثرًا أعلى' : 'توافق جيد'}</small></div>
            </div>
          </section>

          <div className="tr-grid2">
            <section className="tr-card">
              <h3><Icon name="chart" size={16} /> المحاور — مشرف مقابل تقدير ذاتي</h3>
              {!s.domains.length && <div className="tr-muted">لا توجد بنود مقياس.</div>}
              <div className="tr-bars">
                {s.domains.map(d => (
                  <div key={d.domain} className="tr-bar-row">
                    <div className="tr-bar-label">{d.domain}</div>
                    <div className="tr-bar-pair">
                      <div className="tr-bar"><i style={{ width: `${pct(d.supervisor)}%`, background: NAVY }} /><span>{d.supervisor ?? '—'}</span></div>
                      <div className="tr-bar"><i style={{ width: `${pct(d.trainee)}%`, background: TEAL }} /><span>{d.trainee ?? '—'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="tr-legend"><span><i style={{ background: NAVY }} /> المشرف</span><span><i style={{ background: TEAL }} /> المتدرب</span></div>
            </section>
            <section className="tr-card">
              <h3><Icon name="alert" size={16} /> معوقات نقل الأثر</h3>
              {!s.barriers.length && <div className="tr-muted">لم تُسجَّل معوقات بعد.</div>}
              <div className="tr-bars">
                {s.barriers.slice(0, 8).map(b => (
                  <div key={b.label} className="tr-bar-row">
                    <div className="tr-bar-label">{b.label}</div>
                    <div className="tr-bar"><i style={{ width: `${b.pct}%`, background: /لا توجد/.test(b.label) ? TEAL : GOLD }} /><span>{b.pct}% ({b.n})</span></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="tr-card">
            <h3><Icon name="check" size={16} /> التوصيات</h3>
            <ul className="tr-recs">{recs.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </section>

          {programTrend.length > 1 && (
            <section className="tr-card">
              <h3><Icon name="trend" size={16} /> حملات البرنامج عبر الزمن</h3>
              <div className="tr-trend">{programTrend.map(x => <div key={x.f.id} className="tr-trend-item"><b>{x.s.transfer_index ?? '—'}</b><span>{x.f.title_ar}</span><small>{String(x.f.created_at || '').slice(0, 10)} · n={x.s.n}</small></div>)}</div>
            </section>
          )}

          <section className="tr-card">
            <h3><Icon name="users" size={16} /> المتدربون — المزاوجة بين المشرف والتقدير الذاتي <span className="tr-pill">{s.pairs.length}</span></h3>
            {!s.pairs.length && <div className="tr-muted">لا توجد استجابات بعد.</div>}
            {!!s.pairs.length && (
              <div className="tr-tablewrap"><table className="tr-table">
                <thead><tr><th>#</th><th>المتدرب</th><th>تقدير المشرف</th><th>تقدير ذاتي</th><th>الفجوة</th><th>تطبيق (مشرف)</th><th>تطبيق (ذاتي)</th><th>الحالة</th></tr></thead>
                <tbody>{s.pairs.map((p, i) => {
                  const m = p.supervisor ?? p.trainee; const lbl = transferLabel(m == null ? null : Math.round(((pct(m)) + ((p.app_sup ?? p.app_tr) ?? pct(m))) / 2));
                  return <tr key={p.trainee_key}><td>{i + 1}</td><td><b>{p.label}</b></td><td>{p.supervisor ?? '—'}</td><td>{p.trainee ?? '—'}</td><td className={p.gap != null && Math.abs(p.gap) >= 0.5 ? 'warn' : ''}>{p.gap == null ? '—' : (p.gap > 0 ? '+' : '') + p.gap}</td><td>{p.app_sup == null ? '—' : Math.round(p.app_sup) + '%'}</td><td>{p.app_tr == null ? '—' : Math.round(p.app_tr) + '%'}</td><td><span className={`tr-st ${lbl.tone}`}>{lbl.ar}</span></td></tr>;
                })}</tbody>
              </table></div>
            )}
          </section>

          {!!s.comments.length && (
            <section className="tr-card">
              <h3><Icon name="chat" size={16} /> أمثلة ومقترحات من الميدان <span className="tr-pill">{s.comments.length}</span></h3>
              <div className="tr-comments">{s.comments.slice(0, 30).map((c, i) => <blockquote key={i}><span className={`tr-role ${c.role}`}>{c.role === 'supervisor' ? 'مشرف' : c.role === 'trainee' ? 'متدرب' : 'زميل'}</span>{c.text}{c.who ? <small> — {c.who}</small> : null}</blockquote>)}</div>
            </section>
          )}
          <p className="tr-foot">أُعدّ هذا التقرير آليًا من منصة التقويم والجودة · {new Date().toLocaleDateString('ar-SA')} · تُقرأ النتائج مع تقرير القياس القبلي/البعدي (المستوى 2) وتقييم رد الفعل (المستوى 1) لتكوين صورة الأثر الكاملة.</p>
        </>
      )}
    </div>
  );
}

const CSS = `
.tr{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.tr *{box-sizing:border-box}
.tr-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.tr-head h1{margin:2px 0 4px;font-size:24px;color:${NAVY}}.tr-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.tr-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.tr-nav{display:flex;gap:8px;flex-wrap:wrap}
.tr-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.tr-btn:disabled{opacity:.5}
.tr-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}
.tr-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.tr-card h3{margin:0 0 12px;font-size:15px;color:${NAVY};display:flex;align-items:center;gap:8px}
.tr-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569}
.tr-muted{color:#64748b;font-size:12.5px;font-weight:700;line-height:1.7}
.tr-filters{display:flex;gap:12px;flex-wrap:wrap}.tr-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569;min-width:260px;flex:1}
.tr select{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;background:#fff}
.tr-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;text-align:center;color:#64748b}.tr-empty b{color:${NAVY};font-size:15px}
.tr-print-head{display:none}
.tr-hero{display:grid;grid-template-columns:320px 1fr;gap:14px;margin-bottom:14px}
.tr-gauge-card{background:${NAVY};color:#fff;border-radius:16px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;border-top:4px solid ${GOLD}}
.tr-gauge-card .tr-muted{color:#cbd5e1;font-size:11.5px}
.tr-gauge{width:200px;height:100px;position:relative;overflow:hidden}
.tr-gauge::before{content:'';position:absolute;inset:0;border-radius:200px 200px 0 0;background:conic-gradient(from 270deg,${GOLD} 0deg,${GOLD} var(--deg),rgba(255,255,255,.15) var(--deg),rgba(255,255,255,.15) 180deg)}
.tr-gauge::after{content:'';position:absolute;left:30px;right:30px;top:30px;bottom:0;background:${NAVY};border-radius:140px 140px 0 0}
.tr-gauge-in{position:absolute;inset:auto 0 0 0;text-align:center;z-index:1}.tr-gauge-in b{font-size:40px;line-height:1}.tr-gauge-in small{color:#cbd5e1;margin-inline-start:4px}
.tr-gauge-label{font-size:15px;font-weight:900;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,.12)}
.tr-gauge-card.ok .tr-gauge-label{background:#059669}.tr-gauge-card.warn .tr-gauge-label{background:#d97706}.tr-gauge-card.bad .tr-gauge-label{background:#dc2626}
.tr-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tr-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}.tr-kpi span{font-size:12px;font-weight:800;color:#64748b}.tr-kpi b{font-size:28px;color:${NAVY};line-height:1.2}.tr-kpi small{font-size:11.5px;color:#94a3b8;font-weight:700}.tr-kpi.warn{border-color:#fed7aa;background:#fffbeb}
.tr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.tr-bars{display:flex;flex-direction:column;gap:10px}
.tr-bar-row{display:grid;grid-template-columns:150px 1fr;gap:10px;align-items:center}.tr-bar-label{font-size:12.5px;font-weight:800;color:#334155}
.tr-bar-pair{display:flex;flex-direction:column;gap:4px}
.tr-bar{position:relative;height:16px;background:#f1f5f9;border-radius:999px;overflow:hidden}.tr-bar i{display:block;height:100%;border-radius:999px}.tr-bar span{position:absolute;inset-inline-end:8px;top:0;font-size:11px;font-weight:900;color:#0f172a;line-height:16px}
.tr-legend{display:flex;gap:14px;margin-top:10px;font-size:12px;font-weight:800;color:#475569}.tr-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:4px;vertical-align:middle}
.tr-recs{margin:0;padding:0 18px 0 0;display:flex;flex-direction:column;gap:6px;font-size:13.5px;font-weight:700;line-height:1.8;color:#1e293b}
.tr-trend{display:flex;gap:10px;flex-wrap:wrap}.tr-trend-item{border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;display:flex;flex-direction:column;min-width:160px}.tr-trend-item b{font-size:24px;color:${TEAL}}.tr-trend-item span{font-size:12.5px;font-weight:800;color:${NAVY}}.tr-trend-item small{font-size:11px;color:#94a3b8;font-weight:700}
.tr-tablewrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}
.tr-table{width:100%;border-collapse:collapse;font-size:13px;min-width:720px}.tr-table th{background:#f8fafc;color:#475569;font-size:12px;text-align:start;padding:9px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.tr-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.tr-table td.warn{color:#b45309;font-weight:900}
.tr-st{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900}.tr-st.ok{background:#ecfdf5;color:#047857}.tr-st.info{background:#eff6ff;color:#1d4ed8}.tr-st.warn{background:#fff7ed;color:#b45309}.tr-st.bad{background:#fef2f2;color:#b91c1c}
.tr-comments{display:flex;flex-direction:column;gap:8px}.tr-comments blockquote{margin:0;border-inline-start:4px solid ${GOLD};background:#fafaf9;border-radius:10px;padding:10px 14px;font-size:13.5px;line-height:1.8;color:#1e293b;font-weight:600}.tr-comments small{color:#94a3b8}
.tr-role{display:inline-block;font-size:10.5px;font-weight:900;border-radius:999px;padding:1px 8px;margin-inline-end:8px;background:#e0f2fe;color:#075985}.tr-role.trainee{background:#ecfdf5;color:#047857}
.tr-foot{color:#94a3b8;font-size:11.5px;font-weight:700;text-align:center;margin:8px 0 0}
@media print{.tr{padding:0;background:#fff}.tr-noprint{display:none!important}.tr-print-head{display:block;text-align:center;margin-bottom:12px}.tr-print-head h2{margin:4px 0;color:${NAVY}}.tr-print-head p{margin:0;color:#475569;font-size:12px}.tr-logos{display:flex;justify-content:space-between}.tr-logos img{height:44px}.tr-card,.tr-hero{break-inside:avoid}.global-nav{display:none!important}}
@media(max-width:980px){.tr{padding:12px}.tr-hero,.tr-grid2{grid-template-columns:1fr}.tr-gauge-card{width:100%}.tr-bar-row{grid-template-columns:1fr}.tr-filters label{min-width:0}}
`;
