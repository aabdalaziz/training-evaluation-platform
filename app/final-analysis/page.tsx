// @ts-nocheck
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

/* ===== ثوابت وحسابات (نفس المنطق السابق) ===== */
const TARGET = 4.2;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const x = [...a].sort((p, q) => p - q), m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
function grade(score) {
  if (score >= 4.2) return { label: 'ممتاز', tone: 'ok' };
  if (score >= 3.7) return { label: 'جيد', tone: 'teal' };
  if (score >= 3) return { label: 'يحتاج متابعة', tone: 'warn' };
  return { label: 'أولوية عاجلة', tone: 'bad' };
}
function recommendation(axis) {
  if (axis.mean >= 4.2) return ['استدامة التميز', 'توثيق الممارسات الناجحة ومشاركتها مع فرق البرامج القادمة.', 'استدامة', 'ok'];
  if (axis.mean >= 3.7) return ['تحسين مستهدف', 'استثمار التغذية الراجعة لتحويل المحور من جيد إلى ممتاز خلال الدورة القادمة.', 'متوسطة', 'teal'];
  if (axis.mean >= 3) return ['خطة تحسين', 'تحليل الملاحظات النوعية وتحديد مسؤول وإجراء تصحيحي خلال 30 يوماً.', 'عالية', 'warn'];
  return ['تدخل عاجل', 'إعداد خطة معالجة فورية ومراجعة أسبوعية للمؤشر حتى بلوغ المستهدف.', 'حرجة', 'bad'];
}
const BAR = ['#b91c1c', '#dc6b6b', '#b45309', '#0b8a83', '#15803d'];

export default function FinalAxisAnalysis() {
  const db = supabase(), router = useRouter();
  const [rows, setRows] = useState([]), [answers, setAnswers] = useState([]), [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true), [selected, setSelected] = useState('');

  useEffect(() => { (async () => {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const { data: e } = await db.from('evaluations').select('id,program_id,submitted_at,overall_rating').eq('kind', 'FINAL');
    const ids = (e || []).map(x => x.id);
    const { data: a } = ids.length ? await db.from('evaluation_answers').select('evaluation_id,question_id,rating_value,text_value').in('evaluation_id', ids) : { data: [] };
    const qids = [...new Set((a || []).map(x => x.question_id))];
    const { data: q } = qids.length ? await db.from('questions').select('id,text_ar,section_ar').in('id', qids) : { data: [] };
    setRows(e || []); setAnswers(a || []); setQuestions(q || []); setLoading(false);
  })(); }, []);

  const axes = useMemo(() => {
    const qm = Object.fromEntries(questions.map(q => [q.id, q]));
    const groups = {};
    answers.forEach(a => { if (!a.rating_value) return; const q = qm[a.question_id]; const name = q?.section_ar || 'التقييم العام'; (groups[name] ??= []).push(Number(a.rating_value)); });
    return Object.entries(groups).map(([name, vals]) => {
      const dist = [1, 2, 3, 4, 5].map(n => vals.filter(v => Math.round(v) === n).length);
      const low = dist[0] + dist[1], high = dist[3] + dist[4];
      return { name, vals, mean: mean(vals), median: median(vals), count: vals.length, dist, lowPct: vals.length ? low / vals.length * 100 : 0, highPct: vals.length ? high / vals.length * 100 : 0 };
    }).sort((a, b) => a.mean - b.mean);
  }, [answers, questions]);

  useEffect(() => { if (!selected && axes[0]) setSelected(axes[0].name); }, [axes, selected]);
  const axis = axes.find(x => x.name === selected) || axes[0];

  const Header = () => (
    <header className="fa-head">
      <div className="fa-brand">
        <img src="/logos/upm.png" alt="جامعة الأمير مقرن" className="fa-logo" />
        <div className="fa-sep" />
        <img src="/logos/center.png" alt="المركز العالمي" className="fa-logo" />
        <div className="fa-brand-text">
          <b>التحليل التفصيلي لمحاور التقييم النهائي</b>
          <span>برنامج تعليم اللغة العربية للناطقين بغيرها · التقييمات الختامية (FINAL) فقط</span>
        </div>
      </div>
      <div className="fa-actions">
        <button className="fa-act" onClick={() => router.push('/reports')}><Icon name="chart" size={16} /><span>اللوحة التحليلية</span></button>
        <button className="fa-act primary" onClick={() => window.print()}><Icon name="print" size={16} /><span>طباعة</span></button>
      </div>
    </header>
  );

  if (loading) return (
    <main className="fa" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} /><Header />
      <div className="fa-card fa-empty"><div className="fa-spin" role="status" aria-label="جارٍ التحميل" />جارٍ إعداد التحليل النهائي…</div>
    </main>
  );
  if (!axis) return (
    <main className="fa" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} /><Header />
      <div className="fa-card fa-empty"><Icon name="alert" size={30} /><div>لا توجد تقييمات نهائية كافية بعد.</div><small>سيظهر التحليل تلقائيًا بعد وصول استجابات التقييم الختامي.</small></div>
    </main>
  );

  const g = grade(axis.mean), rec = recommendation(axis), gap = TARGET - axis.mean;
  const issued = new Intl.DateTimeFormat('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

  return (
    <main className="fa" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Header />

      {/* 1) ملخص قيادي */}
      <section className="fa-hero">
        <div>
          <div className="fa-kicker"><Icon name="flag" size={14} />قراءة قيادية تفصيلية لكل محور</div>
          <h1>تحليل محاور التقييم النهائي</h1>
          <p>عدد التقييمات النهائية: <b className="ltr">{rows.length}</b> · عدد المحاور: <b className="ltr">{axes.length}</b> · المستهدف القياسي: <b className="ltr">{TARGET}/5</b></p>
        </div>
        <div className="fa-issued"><Icon name="calendar" size={14} />تاريخ الإصدار: {issued}</div>
      </section>

      {/* 2) اختيار المحور */}
      <section className="fa-card">
        <h2 className="fa-title"><Icon name="compass" size={18} /><span>اختر المحور</span><small>مرتبة من الأدنى إلى الأعلى أداءً</small></h2>
        <div className="fa-chips" role="tablist" aria-label="محاور التقييم">
          {axes.map(a => { const gg = grade(a.mean); return (
            <button key={a.name} role="tab" aria-selected={selected === a.name} className={`fa-chip ${selected === a.name ? 'on' : ''}`} onClick={() => setSelected(a.name)}>
              <span>{a.name}</span><b className={`pill ${gg.tone}`}>{a.mean.toFixed(2)}</b>
            </button>); })}
        </div>
      </section>

      {/* 3) مؤشرات المحور */}
      <section className="fa-kpis">
        {[
          ['متوسط المحور', axis.mean.toFixed(2) + '/5', 'target', g.tone],
          ['الوسيط', axis.median.toFixed(2) + '/5', 'scale', 'teal'],
          ['رضا مرتفع (4–5)', axis.highPct.toFixed(0) + '%', 'trend', axis.highPct >= 60 ? 'ok' : 'warn'],
          ['إجابات المحور', String(axis.count), 'users', 'info'],
        ].map(([l, v, ic, tone]) => (
          <article key={l} className={`fa-kpi ${tone}`}>
            <div className="fa-kpi-top"><span className="fa-kpi-ico"><Icon name={ic} size={16} /></span>{l}</div>
            <b className="ltr">{v}</b>
          </article>
        ))}
      </section>

      {/* 4) التوزيع + القراءة */}
      <section className="fa-grid">
        <article className="fa-card">
          <h2 className="fa-title"><Icon name="chart" size={18} /><span>توزيع درجات محور: {axis.name}</span></h2>
          {axis.dist.map((n, i) => { const pct = axis.count ? n / axis.count * 100 : 0; return (
            <div key={i} className="fa-row">
              <span className="fa-row-l">{i + 1} من 5</span>
              <div className="fa-track"><i style={{ width: pct + '%', background: BAR[i] }} /></div>
              <b className="ltr">{n} ({pct.toFixed(0)}%)</b>
            </div>); })}
          <div className="fa-legend"><span><i style={{ background: BAR[0] }} />منخفض 1–2: {axis.lowPct.toFixed(0)}%</span><span><i style={{ background: BAR[2] }} />محايد 3</span><span><i style={{ background: BAR[4] }} />مرتفع 4–5: {axis.highPct.toFixed(0)}%</span></div>
        </article>

        <article className={`fa-card fa-read ${g.tone}`}>
          <div className="fa-read-top"><span className={`pill ${g.tone}`}><Icon name={g.tone === 'ok' ? 'check' : g.tone === 'teal' ? 'star' : 'alert'} size={13} />{g.label}</span></div>
          <h2 className="fa-title"><Icon name="doc" size={18} /><span>القراءة التحليلية</span></h2>
          <p className="fa-p">حقق محور <b>{axis.name}</b> متوسطاً قدره <b className="ltr">{axis.mean.toFixed(2)} من 5</b>، {gap > 0 ? <>بفجوة <b className="ltr">{gap.toFixed(2)}</b> دون المستهدف القياسي</> : <>متجاوزاً المستهدف القياسي بمقدار <b className="ltr">{Math.abs(gap).toFixed(2)}</b></>}. بلغت نسبة التقييمات المرتفعة <b className="ltr">{axis.highPct.toFixed(0)}%</b>، بينما بلغت نسبة التقييمات المنخفضة <b className="ltr">{axis.lowPct.toFixed(0)}%</b>.</p>
          <hr className="fa-hr" />
          <h3 className="fa-sub"><Icon name="target" size={16} />{rec[0]}</h3>
          <p className="fa-p">{rec[1]}</p>
          <p className="fa-p"><b>الأولوية:</b> <span className={`pill ${rec[3]}`}>{rec[2]}</span></p>
        </article>
      </section>

      {/* 5) خطة العمل */}
      <section className="fa-card">
        <h2 className="fa-title"><Icon name="table" size={18} /><span>خطة عمل المحور</span></h2>
        <div className="fa-twrap">
          <table className="fa-table">
            <thead><tr><th>المؤشر</th><th>الحالي</th><th>المستهدف</th><th>الفجوة</th><th>الإجراء</th><th>المسؤول</th></tr></thead>
            <tbody><tr>
              <td><b>{axis.name}</b></td>
              <td className="ltr">{axis.mean.toFixed(2)}/5</td>
              <td className="ltr">{TARGET}/5</td>
              <td className="ltr" style={{ color: gap > 0 ? '#b91c1c' : '#15803d', fontWeight: 800 }}>{gap > 0 ? '-' : '+'}{Math.abs(gap).toFixed(2)}</td>
              <td>{rec[1]}</td>
              <td>إدارة البرنامج / مالك المحور</td>
            </tr></tbody>
          </table>
        </div>
      </section>

      <footer className="fa-foot">
        <div><b>دليل القراءة:</b> ممتاز ≥{TARGET} | جيد ≥3.7 | يحتاج متابعة ≥3.0 | أولوية عاجلة &lt;3.0 — الفجوة تُقاس من المستهدف {TARGET}.</div>
        <div>منصة الجودة والتقييم — جامعة الأمير مقرن بن عبدالعزيز</div>
      </footer>
    </main>
  );
}

const CSS = `
.fa{--navy:#0f2a4e;--teal:#0b8a83;--teal-soft:#e6f4f3;--teal-line:#b7e1dd;--gold:#c9a24b;--bg:#f3f6fa;--line:#e4eaf2;--line-2:#cfd9e6;--ink:#0f172a;--ink-2:#334155;--muted:#64748b;--ok:#15803d;--ok-soft:#eafaf0;--ok-line:#b7e4c7;--info:#1d4ed8;--info-soft:#eef4ff;--info-line:#c3d4fb;--warn:#b45309;--warn-soft:#fff7e6;--warn-line:#f5d9a3;--bad:#b91c1c;--bad-soft:#fef2f2;--bad-line:#f6c4c4;--r:14px;--sh:0 1px 2px rgba(15,42,78,.05),0 6px 18px rgba(15,42,78,.05);
  max-width:1200px;margin:0 auto;padding:20px 16px 40px;display:flex;flex-direction:column;gap:16px;color:var(--ink);font-family:inherit;}
.fa *{box-sizing:border-box;}
.fa .ltr{direction:ltr;unicode-bidi:plaintext;}
.fa-head{background:#fff;border:1px solid var(--line);border-top:4px solid var(--gold);border-radius:var(--r);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:var(--sh);}
.fa-brand{display:flex;align-items:center;gap:14px;min-width:0;}
.fa-logo{height:48px;width:auto;object-fit:contain;}
.fa-sep{width:1px;height:40px;background:var(--line);}
.fa-brand-text{display:flex;flex-direction:column;}
.fa-brand-text b{color:var(--navy);font-size:17px;font-weight:800;}
.fa-brand-text span{color:var(--muted);font-size:12px;font-weight:600;}
.fa-actions{display:flex;gap:8px;flex-wrap:wrap;}
.fa-act{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;border:1px solid var(--line-2);background:#fff;color:var(--ink-2);font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;}
.fa-act:hover{background:#f8fafc;border-color:var(--teal-line);color:var(--navy);}
.fa-act.primary{background:var(--navy);border-color:var(--navy);color:#fff;}
.fa-hero{background:var(--navy);color:#fff;border-radius:var(--r);padding:22px 24px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;border-inline-start:6px solid var(--gold);}
.fa-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#f2d99a;font-weight:800;letter-spacing:.2px;}
.fa-hero h1{margin:8px 0 6px;font-size:26px;font-weight:800;}
.fa-hero p{margin:0;color:#d2e2ee;font-size:14px;font-weight:600;}
.fa-hero p b{color:#fff;}
.fa-issued{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#c9d6e5;font-weight:700;background:rgba(255,255,255,.08);padding:6px 12px;border-radius:999px;}
.fa-card{background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:22px;box-shadow:var(--sh);}
.fa-title{margin:0 0 14px;font-size:17px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.fa-title svg{color:var(--teal);flex-shrink:0;}
.fa-title small{color:var(--muted);font-weight:600;font-size:12px;margin-inline-start:auto;}
.fa-chips{display:flex;gap:8px;flex-wrap:wrap;}
.fa-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-2);background:#fff;padding:8px 12px;border-radius:999px;cursor:pointer;font-weight:800;font-size:13px;color:var(--ink-2);font-family:inherit;transition:background .15s,border-color .15s;}
.fa-chip:hover{background:var(--teal-soft);border-color:var(--teal-line);}
.fa-chip.on{background:var(--navy);border-color:var(--navy);color:#fff;}
.fa .pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:800;border:1px solid transparent;}
.fa .pill.ok{background:var(--ok-soft);color:var(--ok);border-color:var(--ok-line);}
.fa .pill.teal{background:var(--teal-soft);color:var(--teal);border-color:var(--teal-line);}
.fa .pill.warn{background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line);}
.fa .pill.bad{background:var(--bad-soft);color:var(--bad);border-color:var(--bad-line);}
.fa .pill.info{background:var(--info-soft);color:var(--info);border-color:var(--info-line);}
.fa-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.fa-kpi{background:#fff;border:1px solid var(--line);border-bottom:4px solid var(--info);border-radius:var(--r);padding:18px;box-shadow:var(--sh);}
.fa-kpi.ok{border-bottom-color:var(--ok);} .fa-kpi.teal{border-bottom-color:var(--teal);} .fa-kpi.warn{border-bottom-color:var(--warn);} .fa-kpi.bad{border-bottom-color:var(--bad);} .fa-kpi.info{border-bottom-color:var(--info);}
.fa-kpi-top{display:flex;align-items:center;gap:8px;color:var(--muted);font-weight:800;font-size:13.5px;}
.fa-kpi-ico{width:28px;height:28px;border-radius:8px;background:#f3f6fa;display:inline-flex;align-items:center;justify-content:center;color:var(--teal);}
.fa-kpi b{display:block;font-size:30px;font-weight:900;color:var(--navy);margin-top:10px;}
.fa-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;}
.fa-row{display:grid;grid-template-columns:70px 1fr 90px;gap:12px;align-items:center;margin:12px 0;font-size:13.5px;font-weight:700;color:var(--ink-2);}
.fa-row b{text-align:end;}
.fa-track{height:14px;background:#edf1f5;border-radius:9px;overflow:hidden;}
.fa-track i{display:block;height:100%;border-radius:9px;transition:width .5s ease;}
.fa-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;color:var(--muted);font-size:12px;font-weight:700;}
.fa-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:6px;vertical-align:-2px;}
.fa-read{border-inline-start:4px solid var(--teal);}
.fa-read.ok{border-inline-start-color:var(--ok);background:#fbfefc;} .fa-read.teal{border-inline-start-color:var(--teal);background:#fafdfd;} .fa-read.warn{border-inline-start-color:var(--warn);background:#fffdf8;} .fa-read.bad{border-inline-start-color:var(--bad);background:#fffafa;}
.fa-read-top{margin-bottom:8px;}
.fa-p{line-height:1.9;margin:0 0 10px;color:var(--ink-2);font-size:14px;font-weight:500;}
.fa-hr{border:0;border-top:1px solid var(--line);margin:14px 0;}
.fa-sub{margin:0 0 8px;font-size:15px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:6px;}
.fa-sub svg{color:var(--teal);}
.fa-twrap{overflow-x:auto;}
.fa-table{width:100%;border-collapse:collapse;min-width:720px;}
.fa-table th{background:var(--navy);color:#fff;padding:11px 12px;text-align:start;font-size:13px;font-weight:800;}
.fa-table th:first-child{border-start-end-radius:0;border-start-start-radius:10px;} .fa-table th:last-child{border-start-end-radius:10px;}
.fa-table td{padding:12px;border-bottom:1px solid var(--line);font-size:13.5px;vertical-align:top;line-height:1.7;}
.fa-foot{background:#fff;border:1px solid var(--line);border-top:4px solid var(--navy);border-radius:var(--r);padding:14px 20px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;color:var(--ink-2);font-size:12px;font-weight:600;line-height:1.8;}
.fa-empty{text-align:center;padding:48px 20px;color:var(--muted);font-weight:700;display:flex;flex-direction:column;align-items:center;gap:10px;}
.fa-empty svg{color:var(--warn);}
.fa-empty small{font-weight:600;}
.fa-spin{width:44px;height:44px;border:5px solid var(--line);border-top-color:var(--teal);border-radius:50%;animation:fa-spin 1s linear infinite;}
@keyframes fa-spin{to{transform:rotate(360deg);}}
@media(max-width:1000px){.fa-kpis{grid-template-columns:repeat(2,1fr);}.fa-grid{grid-template-columns:1fr;}}
@media(max-width:640px){.fa-kpis{grid-template-columns:1fr;}.fa-head{flex-direction:column;align-items:stretch;}.fa-brand{justify-content:center;flex-wrap:wrap;text-align:center;}.fa-actions{justify-content:center;}.fa-row{grid-template-columns:60px 1fr 80px;}}
@media print{.fa-actions{display:none;}.fa-card,.fa-kpi,.fa-hero{box-shadow:none;break-inside:avoid;}.fa-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
`;
