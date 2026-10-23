'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import { buildProgramReport, programSheets } from '../../../lib/reports/program';
import type { ProgramReportInput, ProgramReport } from '../../../lib/reports/program';
import { TARGET, PERF_LABEL } from '../../../lib/reports/analytics';
import { LEVEL_META, chainLabel, achievementLabel } from '../../../lib/outcomes/model';
import { hakeLabel } from '../../../lib/impact/analytics';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
type Raw = Omit<ProgramReportInput, 'program'> & { programs: ProgramReportInput['program'][] };

export default function ProgramReportPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false); const [raw, setRaw] = useState<Raw | null>(null);
  const [programId, setProgramId] = useState(params.get('program') || '');
  const [error, setError] = useState(''); const [printedAt, setPrintedAt] = useState(''); const [flash, setFlash] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/reports/program'); return; }
      const [pg, cl, tr, qs, ev, an, ia, ir, fu, bq, br, ss, ar, ce, ok, om] = await Promise.all([
        db.from('programs').select('*').order('name_ar'),
        db.from('classrooms').select('id,code,program_id,trainer_id,delivery_mode,level'),
        db.from('trainers').select('id,name'),
        db.from('questions').select('*'),
        db.from('evaluations').select('*').limit(20000),
        db.from('evaluation_answers').select('*').limit(200000),
        db.from('impact_assessments').select('id,program_id,title_ar'),
        db.from('impact_responses').select('*').limit(20000),
        db.from('behavior_followups').select('*'),
        db.from('behavior_questions').select('*'),
        db.from('behavior_responses').select('*').limit(20000),
        db.from('attendance_sessions').select('id,program_id,session_date,title,status'),
        db.from('attendance_records').select('session_id,full_name,email,phone,identity_key,status').limit(50000),
        db.from('certificates').select('id,program_id,recipient_name,recipient_email,serial,issued_at,sent_at,revoked_at').limit(20000),
        db.from('outcome_kpis').select('*'),
        db.from('outcome_measurements').select('*').limit(20000),
      ]);
      const err = [pg, cl, tr, qs, ev, an, ia, ir, fu, bq, br, ss, ar, ce, ok, om].find(r => r.error)?.error; if (err) setError(err.message);
      const programs = ((pg.data || []) as any[]).filter(p => p.status !== 'CANCELLED');
      setRaw({ programs, classrooms: (cl.data || []) as any[], trainers: (tr.data || []) as any[], questions: (qs.data || []) as any[], evaluations: (ev.data || []) as any[], answers: (an.data || []) as any[], assessments: (ia.data || []) as any[], impactResponses: (ir.data || []) as any[], followups: (fu.data || []) as any[], behaviorQuestions: (bq.data || []) as any[], behaviorResponses: (br.data || []) as any[], sessions: (ss.data || []) as any[], records: (ar.data || []) as any[], certificates: (ce.data || []) as any[], kpis: (ok.data || []) as any[], measurements: (om.data || []) as any[] });
      if (!params.get('program') && programs.length) setProgramId(programs[0].id);
      setPrintedAt(new Date().toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rep: ProgramReport | null = useMemo(() => {
    if (!raw) return null; const program = raw.programs.find(p => p.id === programId); if (!program) return null;
    const { programs, ...rest } = raw; return buildProgramReport({ program, ...rest });
  }, [raw, programId]);

  function exportXlsx() { if (!rep) return; downloadXlsx(safeFilename(`program_report_${rep.program.name_ar.slice(0, 30)}`, 'xlsx'), programSheets(rep)); setFlash('✅ تم تنزيل ملف Excel'); setTimeout(() => setFlash(''), 2500); }

  if (!ready) return <div className="pr" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  const k = rep?.evaluation.k || null; const l = rep?.learning.s || null; const t = rep?.transfer.s || null; const c = rep?.chain || null;
  const tone = rep ? ({ strong: 'ok', good: 'info', limited: 'warn', weak: 'bad', none: 'none' } as const)[rep.headline.key] : 'none';
  const score = (s: number | null) => (s == null ? 'none' : s >= 75 ? 'ok' : s >= 60 ? 'info' : s >= 45 ? 'warn' : 'bad');

  return (
    <div className="pr" dir="rtl">
      <style>{CSS}</style>
      <header className="pr-head pr-noprint">
        <div>
          <div className="pr-kicker"><Icon name="doc" size={14} /> التقارير · التقرير الشامل للبرنامج</div>
          <h1>بطاقة البرنامج لصانع القرار</h1>
          <p>صفحة واحدة تجمع الحضور، رضا المتدربين، الكسب المعرفي، نقل الأثر، الشهادات، ومؤشرات النتائج — مع خلاصة وتوصيات. للطباعة PDF أو التصدير Excel بملف واحد.</p>
        </div>
        <nav className="pr-nav">
          <Link href="/dashboard" className="pr-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/reports/center" className="pr-btn"><Icon name="chart" size={16} /> مركز التقارير</Link>
          <Link href={`/reports/chain${programId ? `?program=${programId}` : ''}`} className="pr-btn"><Icon name="trend" size={16} /> سلسلة الأثر</Link>
          <button className="pr-btn" onClick={() => window.print()} disabled={!rep}><Icon name="print" size={16} /> طباعة / PDF</button>
          <button className="pr-btn primary" onClick={exportXlsx} disabled={!rep}><Icon name="table" size={16} /> Excel موحّد</button>
        </nav>
      </header>
      {error && <div className="pr-alert pr-noprint">{error}</div>}
      {flash && <div className="pr-flash pr-noprint">{flash}</div>}

      <section className="pr-card pr-noprint">
        <label className="pr-select">البرنامج<select value={programId} onChange={e => setProgramId(e.target.value)}>{!raw?.programs.length && <option value="">— لا توجد برامج —</option>}{raw?.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
      </section>

      {!rep && <div className="pr-card pr-empty"><Icon name="doc" size={34} /><b>اختر برنامجًا</b></div>}

      {rep && c && (
        <div className="pr-sheet">
          {/* رأس الطباعة */}
          <div className="pr-top">
            <img src="/logos/upm.png" alt="" className="pr-logo" />
            <div className="pr-title">
              <div className="pr-kicker">التقرير الشامل للبرنامج · <bdi>{printedAt}</bdi></div>
              <h2>{rep.program.name_ar}</h2>
              <div className="pr-meta">
                {rep.program.name_en && <span dir="ltr">{rep.program.name_en}</span>}
                <span><bdi>{rep.program.start_date || '—'}</bdi> ← <bdi>{rep.program.end_date || '—'}</bdi></span>
                <span>{rep.rooms.length ? `القاعات: ${rep.rooms.map(r => r.code).join('، ')}` : 'بلا قاعات'}</span>
                <span>{rep.trainers.length ? `المدربون: ${rep.trainers.join('، ')}` : 'بلا مدرب محدد'}</span>
              </div>
            </div>
            <img src="/logos/gate.png" alt="" className="pr-logo" />
          </div>

          {/* الخلاصة */}
          <section className={`pr-verdict ${tone}`}>
            <div className="pr-verdict-score"><b>{c.s.index ?? '—'}</b><small>مؤشر السلسلة /100</small></div>
            <div className="pr-verdict-text"><b>{rep.headline.ar}</b><span>{chainLabel(c.s.index).ar} · {c.s.levels}/4 مستويات مقاسة{c.s.weakest && c.s.levels > 1 ? ` · الحلقة الأضعف: ${LEVEL_META[c.s.weakest].ar}` : ''}</span></div>
            <div className="pr-verdict-levels">
              {([1, 2, 3, 4] as const).map(n => { const s = n === 1 ? c.s.s1 : n === 2 ? c.s.s2 : n === 3 ? c.s.s3 : c.s.s4; return <div key={n} className={`pr-lv ${score(s)}`}><small>{n} · {LEVEL_META[n].ar}</small><b>{s ?? '—'}</b></div>; })}
            </div>
          </section>

          {/* KPIs الصف الأول */}
          <div className="pr-kpis">
            <div className="pr-kpi"><span>المشاركون</span><b>{rep.attendance.participants || (k?.participants ?? 0)}</b><small>{rep.attendance.sessions} جلسة حضور</small></div>
            <div className={`pr-kpi ${rep.attendance.avgPct != null && rep.attendance.avgPct < 80 ? 'warn' : ''}`}><span>متوسط الحضور</span><b>{rep.attendance.avgPct == null ? '—' : `${rep.attendance.avgPct}%`}</b><small>{rep.attendance.eligible80} مستوفٍ لشرط 80%</small></div>
            <div className={`pr-kpi ${k && k.mean < TARGET ? 'warn' : ''}`}><span>رضا المتدربين</span><b>{k ? k.mean.toFixed(2) : '—'}</b><small>{k ? `${k.responses} استبانة · المستهدف ${TARGET}` : 'لا تقييمات'}</small></div>
            <div className="pr-kpi"><span>الكسب المعياري g</span><b>{l?.hake == null ? '—' : l.hake.toFixed(2)}</b><small>{l && l.nPaired ? `${l.nPaired} زوجًا · ${hakeLabel(l.hake).ar}` : 'لا قياس قبلي/بعدي'}</small></div>
            <div className="pr-kpi"><span>نقل الأثر</span><b>{t?.transfer_index ?? '—'}</b><small>{t ? `${t.n} استجابة · تطبيق ${t.app_all == null ? '—' : Math.round(t.app_all) + '%'}` : 'لا متابعة'}</small></div>
            <div className="pr-kpi"><span>مؤشرات النتائج</span><b>{rep.outcomes.index == null ? '—' : `${rep.outcomes.index}%`}</b><small>{rep.outcomes.rows.length ? `${rep.outcomes.measured}/${rep.outcomes.rows.length} مقاس` : 'لا مؤشرات'}</small></div>
            <div className="pr-kpi"><span>الشهادات</span><b>{rep.certificates.issued}</b><small>{rep.certificates.sent} مُرسلة{rep.certificates.coveragePct != null ? ` · تغطية ${rep.certificates.coveragePct}%` : ''}</small></div>
          </div>

          <div className="pr-grid">
            {/* التقييم */}
            <section className="pr-card">
              <h3><Icon name="star" size={15} /> رضا المتدربين (المستوى 1)</h3>
              {!k && <div className="pr-muted">لا توجد تقييمات لهذا البرنامج.</div>}
              {k && (
                <>
                  <div className="pr-dist">{k.dist.map((n, i) => { const tot = k.dist.reduce((a, b) => a + b, 0) || 1; return <div key={i} className="pr-dist-col"><i style={{ height: `${Math.max(3, (n / tot) * 60)}px`, background: i >= 3 ? '#059669' : i === 2 ? '#d97706' : '#dc2626' }} /><small>{i + 1}</small></div>; })}<div className="pr-dist-leg"><span className="ok">مرتفع {Math.round(k.highPct)}%</span><span className="bad">منخفض {Math.round(k.lowPct)}%</span>{rep.evaluation.byKind.map(b => <span key={b.key}>{b.label}: {b.mean.toFixed(2)} ({b.n})</span>)}</div></div>
                  <div className="pr-bars">
                    {rep.evaluation.axes.slice(0, 8).map(a => <div key={a.key} className="pr-bar-row"><span className="pr-bar-label">{a.label}</span><div className="pr-bar"><i style={{ width: `${(a.mean / 5) * 100}%`, background: PERF_LABEL[a.perf].color }} /><b>{a.mean.toFixed(2)}</b></div></div>)}
                  </div>
                  <div className="pr-tb">
                    <div><small>الأعلى</small>{rep.evaluation.questionsTop.map(q => <div key={q.key} className="pr-q ok">{q.label} <b>{q.mean.toFixed(2)}</b></div>)}</div>
                    <div><small>الأدنى</small>{rep.evaluation.questionsLow.map(q => <div key={q.key} className="pr-q bad">{q.label} <b>{q.mean.toFixed(2)}</b></div>)}</div>
                  </div>
                </>
              )}
            </section>

            {/* التعلم + السلوك */}
            <section className="pr-card">
              <h3><Icon name="target" size={15} /> التعلم (2) ونقل الأثر (3)</h3>
              {!l && <div className="pr-muted">لا توجد أداة قياس قبلي/بعدي — <Link href={`/admin/impact?program=${rep.program.id}`} className="pr-noprint">أنشئ واحدة</Link>.</div>}
              {l && (
                <div className="pr-pp">
                  <div className="pr-pp-col"><small>قبلي</small><b>{l.pre.mean ?? '—'}</b></div>
                  <div className="pr-pp-arrow">←</div>
                  <div className="pr-pp-col"><small>بعدي</small><b>{l.post.mean ?? '—'}</b></div>
                  <div className="pr-pp-col"><small>الكسب</small><b style={{ color: TEAL }}><bdi>{l.gain == null ? '—' : (l.gain > 0 ? '+' : '') + l.gain}</bdi></b></div>
                  <div className="pr-pp-col"><small>g · d</small><b><bdi>{l.hake == null ? '—' : l.hake.toFixed(2)} · {l.cohenD == null ? '—' : l.cohenD.toFixed(2)}</bdi></b></div>
                  <div className="pr-pp-note">{l.nPaired} زوجًا · تحسّن {l.improved} · ثبات {l.same} · تراجع {l.declined}{l.p != null ? ` · p=${l.p}` : ''}</div>
                </div>
              )}
              <hr className="pr-hr" />
              {!t && <div className="pr-muted">لا توجد حملة متابعة بعد 60–90 يومًا — <Link href={`/admin/followup?new=1&program=${rep.program.id}`} className="pr-noprint">أنشئ حملة</Link>.</div>}
              {t && (
                <div className="pr-tr">
                  <div className="pr-tr-k"><small>تقدير المشرف</small><b>{t.mean_sup ?? '—'}</b></div>
                  <div className="pr-tr-k"><small>التقدير الذاتي</small><b>{t.mean_tr ?? '—'}</b></div>
                  <div className="pr-tr-k"><small>نسبة التطبيق</small><b>{t.app_all == null ? '—' : `${Math.round(t.app_all)}%`}</b></div>
                  <div className="pr-tr-k"><small>الفجوة</small><b><bdi>{t.gap == null ? '—' : (t.gap > 0 ? '+' : '') + t.gap}</bdi></b></div>
                  {t.barriers.length > 0 && <div className="pr-tr-bar">أبرز المعوقات: {t.barriers.slice(0, 3).map(b => `${b.label} (${b.pct}%)`).join(' · ')}</div>}
                </div>
              )}
            </section>

            {/* النتائج */}
            <section className="pr-card">
              <h3><Icon name="flag" size={15} /> مؤشرات النتائج المؤسسية (المستوى 4)</h3>
              {!rep.outcomes.rows.length && <div className="pr-muted">لا توجد مؤشرات — <Link href={`/admin/outcomes?program=${rep.program.id}`} className="pr-noprint">أضف مؤشرات</Link>.</div>}
              {rep.outcomes.rows.map(x => { const lab = achievementLabel(x.achievement); return (
                <div key={x.id} className="pr-oc"><div className="pr-oc-top"><span>{x.name_ar}</span><b className={`pr-st ${lab.tone}`}>{x.achievement == null ? '—' : `${x.achievement}%`}</b></div><div className="pr-bar thin"><i style={{ width: `${x.achievement ?? 0}%` }} className={lab.tone} /></div><small><bdi>{x.baseline ?? '—'}</bdi> ← <bdi>{x.current ?? '—'}</bdi> ← هدف <bdi>{x.target ?? '—'}</bdi> {x.unit}</small></div>
              ); })}
            </section>

            {/* التوصيات */}
            <section className="pr-card pr-recs-card">
              <h3><Icon name="compass" size={15} /> الخلاصة والتوصيات</h3>
              <ol className="pr-recs">{rep.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
              {rep.evaluation.actions.length > 0 && <div className="pr-actions"><small>سجل المخاطر (من التقييمات)</small>{rep.evaluation.actions.slice(0, 3).map(a => <div key={a.id} className="pr-action"><b className={`pr-st ${a.priority === 'HIGH' ? 'bad' : a.priority === 'MED' ? 'warn' : 'info'}`}>{a.priority === 'HIGH' ? 'عالٍ' : a.priority === 'MED' ? 'متوسط' : 'منخفض'}</b> {a.label} — {a.recommendation} <small>({a.owner} · {a.dueDays} يومًا)</small></div>)}</div>}
            </section>
          </div>

          {rep.evaluation.comments.length > 0 && (
            <section className="pr-card pr-comments">
              <h3><Icon name="chat" size={15} /> من أصوات المتدربين</h3>
              <div className="pr-quotes">{rep.evaluation.comments.slice(0, 6).map((cm, i) => <blockquote key={i} className={cm.sentiment}>«{cm.text.slice(0, 180)}{cm.text.length > 180 ? '…' : ''}»<small>{cm.question_ar}</small></blockquote>)}</div>
            </section>
          )}

          <p className="pr-foot">المصادر: التقييم اليومي/النهائي · الحضور الرقمي · أداة القياس القبلي/البعدي · متابعة نقل الأثر · الشهادات الإلكترونية · مؤشرات النتائج. مؤشر السلسلة = متوسط المستويات المتاحة (0–100). أُنشئ آليًا بتاريخ <bdi>{printedAt}</bdi>.</p>
        </div>
      )}
    </div>
  );
}

const CSS = `
.pr{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.pr *{box-sizing:border-box}
.pr-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.pr-head h1{margin:2px 0 4px;font-size:24px;color:${NAVY}}.pr-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.pr-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.pr-nav{display:flex;gap:8px;flex-wrap:wrap}
.pr-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.pr-btn:disabled{opacity:.5}.pr-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}
.pr-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}
.pr-flash{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-weight:800}
.pr-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:12px;min-width:0}.pr-card h3{margin:0 0 10px;font-size:14px;color:${NAVY};display:flex;align-items:center;gap:7px}
.pr-muted{color:#64748b;font-size:12.5px;font-weight:700;line-height:1.7}.pr-muted a{color:${TEAL}}
.pr-select{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}.pr select{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;background:#fff;width:100%}
.pr-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;color:#64748b}
.pr-sheet{max-width:1180px;margin:0 auto}
.pr-top{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 18px;margin-bottom:12px}
.pr-logo{height:48px;width:auto}.pr-title h2{margin:2px 0 4px;font-size:22px;color:${NAVY}}.pr-title{text-align:center;min-width:0}.pr-title .pr-kicker{justify-content:center}
.pr-meta{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:12px;color:#475569;font-weight:700}
.pr-verdict{display:grid;grid-template-columns:140px 1fr 320px;gap:14px;align-items:center;background:${NAVY};color:#fff;border-radius:14px;border-top:4px solid ${GOLD};padding:14px 18px;margin-bottom:12px}
.pr-verdict-score{text-align:center}.pr-verdict-score b{font-size:44px;line-height:1}.pr-verdict-score small{display:block;font-size:11px;color:#cbd5e1;font-weight:700}
.pr-verdict-text b{display:block;font-size:17px}.pr-verdict-text span{font-size:12px;color:#cbd5e1;font-weight:700}
.pr-verdict.ok .pr-verdict-score b{color:#6ee7b7}.pr-verdict.info .pr-verdict-score b{color:#93c5fd}.pr-verdict.warn .pr-verdict-score b{color:#fcd34d}.pr-verdict.bad .pr-verdict-score b{color:#fca5a5}
.pr-verdict-levels{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.pr-lv{background:rgba(255,255,255,.08);border-radius:10px;padding:6px 8px;text-align:center;border-bottom:3px solid #94a3b8}.pr-lv small{display:block;font-size:10px;color:#cbd5e1;font-weight:800;white-space:nowrap}.pr-lv b{font-size:20px}
.pr-lv.ok{border-color:#34d399}.pr-lv.info{border-color:#60a5fa}.pr-lv.warn{border-color:#fbbf24}.pr-lv.bad{border-color:#f87171}
.pr-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-bottom:12px}
.pr-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:1px;min-width:0}.pr-kpi span{font-size:11px;font-weight:800;color:#64748b}.pr-kpi b{font-size:22px;color:${NAVY};line-height:1.2}.pr-kpi small{font-size:10.5px;color:#94a3b8;font-weight:700;line-height:1.4}.pr-kpi.warn{border-color:#fed7aa;background:#fffbeb}
.pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pr-dist{display:flex;align-items:flex-end;gap:6px;margin-bottom:10px}.pr-dist-col{display:flex;flex-direction:column;align-items:center;width:22px}.pr-dist-col i{display:block;width:18px;border-radius:4px 4px 0 0}.pr-dist-col small{font-size:10px;color:#64748b;font-weight:800}
.pr-dist-leg{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;font-weight:800;color:#475569;margin-inline-start:10px}.pr-dist-leg .ok{color:#047857}.pr-dist-leg .bad{color:#b91c1c}
.pr-bars{display:flex;flex-direction:column;gap:5px}.pr-bar-row{display:grid;grid-template-columns:130px 1fr;gap:8px;align-items:center}.pr-bar-label{font-size:11.5px;font-weight:800;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-bar{position:relative;height:14px;background:#f1f5f9;border-radius:999px;overflow:hidden}.pr-bar i{display:block;height:100%;border-radius:999px;background:${TEAL}}.pr-bar b{position:absolute;inset-inline-end:7px;top:0;font-size:10.5px;line-height:14px;color:#0f172a}.pr-bar.thin{height:7px}.pr-bar i.ok{background:#059669}.pr-bar i.info{background:#2563eb}.pr-bar i.warn{background:#d97706}.pr-bar i.bad{background:#dc2626}
.pr-tb{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.pr-tb small{display:block;font-size:10.5px;font-weight:900;color:#94a3b8;margin-bottom:3px}.pr-q{font-size:11.5px;font-weight:700;color:#334155;display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px dashed #f1f5f9}.pr-q.ok b{color:#047857}.pr-q.bad b{color:#b91c1c}
.pr-pp{display:grid;grid-template-columns:1fr auto 1fr 1fr 1.2fr;gap:8px;align-items:center}.pr-pp-col{text-align:center}.pr-pp-col small{display:block;font-size:10.5px;font-weight:800;color:#64748b}.pr-pp-col b{font-size:22px;color:${NAVY}}.pr-pp-arrow{color:#cbd5e1;font-size:20px;font-weight:900}.pr-pp-note{grid-column:1/-1;font-size:11.5px;color:#64748b;font-weight:700;text-align:center}
.pr-hr{border:0;border-top:1px solid #f1f5f9;margin:10px 0}
.pr-tr{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pr-tr-k{text-align:center;border:1px solid #f1f5f9;border-radius:10px;padding:6px}.pr-tr-k small{display:block;font-size:10.5px;font-weight:800;color:#64748b}.pr-tr-k b{font-size:20px;color:${NAVY}}.pr-tr-bar{grid-column:1/-1;font-size:11.5px;color:#9a3412;background:#fff7ed;border-radius:8px;padding:6px 10px;font-weight:700}
.pr-oc{padding:6px 0;border-bottom:1px solid #f8fafc}.pr-oc-top{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:800;color:#1e293b;margin-bottom:3px}.pr-oc small{font-size:11px;color:#64748b;font-weight:700}
.pr-st{display:inline-block;border-radius:999px;padding:1px 8px;font-size:10.5px;font-weight:900;background:#f1f5f9;color:#475569}.pr-st.ok{background:#ecfdf5;color:#047857}.pr-st.info{background:#eff6ff;color:#1d4ed8}.pr-st.warn{background:#fff7ed;color:#b45309}.pr-st.bad{background:#fef2f2;color:#b91c1c}
.pr-recs{margin:0;padding:0 18px 0 0;display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:700;line-height:1.75;color:#1e293b}
.pr-actions{margin-top:10px;border-top:1px solid #f1f5f9;padding-top:8px}.pr-actions>small{display:block;font-size:10.5px;font-weight:900;color:#94a3b8;margin-bottom:4px}.pr-action{font-size:11.5px;font-weight:700;color:#334155;line-height:1.7}.pr-action small{color:#94a3b8}
.pr-quotes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.pr-quotes blockquote{margin:0;border-inline-start:4px solid ${GOLD};background:#fafaf9;border-radius:8px;padding:8px 12px;font-size:12px;line-height:1.7;color:#1e293b;font-weight:600}.pr-quotes blockquote.negative{border-color:#dc2626}.pr-quotes blockquote.positive{border-color:#059669}.pr-quotes small{display:block;color:#94a3b8;font-weight:700;margin-top:3px}
.pr-foot{color:#94a3b8;font-size:11px;font-weight:700;text-align:center;margin:6px 0 0;line-height:1.7}
@media print{@page{size:A4 portrait;margin:8mm}.pr{padding:0;background:#fff;font-size:12px}.pr-noprint{display:none!important}.global-nav{display:none!important}.pr-sheet{max-width:none}.pr-card,.pr-verdict,.pr-kpis,.pr-top{break-inside:avoid;box-shadow:none}.pr-verdict{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pr-kpis{grid-template-columns:repeat(7,1fr)}.pr-grid{grid-template-columns:1fr 1fr}.pr-kpi b{font-size:18px}.pr-card{padding:10px 12px;margin-bottom:8px}.pr-quotes{grid-template-columns:1fr 1fr 1fr}}
@media(max-width:1100px){.pr-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:980px){.pr{padding:12px}.pr-grid,.pr-quotes,.pr-tb{grid-template-columns:1fr}.pr-verdict{grid-template-columns:1fr}.pr-verdict-levels{grid-template-columns:repeat(4,1fr)}.pr-top{grid-template-columns:1fr}.pr-logo{display:none}}
@media(max-width:560px){.pr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pr-pp{grid-template-columns:1fr 1fr}.pr-pp-arrow{display:none}.pr-tr{grid-template-columns:1fr 1fr}.pr-bar-row{grid-template-columns:1fr}}
`;
