'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';

type Evaluation = {
  id: string;
  kind: 'DAILY' | 'FINAL';
  overall_rating: number | null;
  submitted_at: string;
  program_id: string;
};

type Answer = {
  evaluation_id: string;
  question_id: string;
  rating_value: number | null;
  text_value: string | null;
};

type Question = {
  id: string;
  text_ar: string;
  section_ar: string | null;
};

type Report = {
  count: number;
  avg: number;
  axes: { label: string; section: string; value: number }[];
  comments: string[];
  timeline: { label: string; count: number; avg: number }[];
};

export default function Reports() {
  const db = supabase();
  const router = useRouter();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await db.auth.getSession();
        if (!session) {
          setError('انتهت جلسة الدخول. سجل دخولك من جديد.');
          setLoading(false);
          return;
        }
        
        const { data: e, error: ee } = await db
          .from('evaluations')
          .select('id,kind,overall_rating,submitted_at,program_id')
          .order('submitted_at', { ascending: false });
        
        if (ee) {
          setError(ee.message);
          setLoading(false);
          return;
        }

        const ids = (e || []).map(x => x.id);
        const a = ids.length 
          ? await db.from('evaluation_answers').select('evaluation_id,question_id,rating_value,text_value').in('evaluation_id', ids)
          : { data: [] as Answer[] };
          
        const qids = (a.data || []).map(x => x.question_id);
        const q = qids.length 
          ? await db.from('questions').select('id,text_ar,section_ar').in('id', qids)
          : { data: [] as Question[] };

        setRows(e || []);
        setAnswers(a.data || []);
        setQuestions(q.data || []);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    if (period === 'all') return rows;
    const days = period === '7' ? 7 : 30;
    return rows.filter(x => new Date(x.submitted_at).getTime() >= Date.now() - days * 86400000);
  }, [rows, period]);

  const calculate = (kind: 'DAILY' | 'FINAL'): Report => {
    const list = filtered.filter(x => x.kind === kind);
    const ids = new Set(list.map(x => x.id));
    const avg = (x: number[]) => x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0;
    const qmap = Object.fromEntries(questions.map(q => [q.id, q]));
    
    const grouped: Record<string, number[]> = {};
    answers
      .filter(x => ids.has(x.evaluation_id) && x.rating_value)
      .forEach(x => (grouped[x.question_id] ??= []).push(x.rating_value!));
      
    const axes = Object.entries(grouped)
      .map(([id, vals]) => ({
        label: qmap[id]?.text_ar || 'سؤال',
        section: qmap[id]?.section_ar || 'عام',
        value: avg(vals)
      }))
      .sort((a, b) => a.value - b.value);

    const byDate: Record<string, { n: number; ratings: number[] }> = {};
    list.forEach(x => {
      const key = new Date(x.submitted_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
      const d = byDate[key] ??= { n: 0, ratings: [] };
      d.n++;
      if (x.overall_rating) d.ratings.push(Number(x.overall_rating));
      byDate[key] = d;
    });

    return {
      count: list.length,
      avg: avg(list.map(x => Number(x.overall_rating || 0)).filter(Boolean)),
      axes,
      comments: answers.filter(x => ids.has(x.evaluation_id) && x.text_value?.trim()).map(x => x.text_value!).slice(0, 8),
      timeline: Object.entries(byDate).map(([label, x]) => ({
        label,
        count: x.n,
        avg: avg(x.ratings)
      })).slice(-8)
    };
  };

  const daily = useMemo(() => calculate('DAILY'), [filtered, answers, questions]);
  const final = useMemo(() => calculate('FINAL'), [filtered, answers, questions]);

  function csv() {
    const lines = [
      'نوع التقييم,المحور,القسم,المتوسط',
      ...daily.axes.map(x => `يومي,"${x.label}","${x.section}",${x.value.toFixed(2)}`),
      ...final.axes.map(x => `نهائي,"${x.label}","${x.section}",${x.value.toFixed(2)}`)
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'separated-evaluation-report.csv';
    a.click();
  }

  if (loading) {
    return (
      <main className="loading-container">
        <style dangerouslySetInnerHTML={{ __html: styles }} />
        <div className="spinner"></div>
        <p>جارٍ إعداد وتحليل التقارير الاستراتيجية...</p>
      </main>
    );
  }

  return (
    <main className="report-dashboard-container">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* Executive Header */}
      <header className="executive-header">
        <div className="header-info">
          <span className="executive-badge">تقرير الأداء السنوي المطور</span>
          <h1>📑 التقارير الاستراتيجية والتحليلية</h1>
          <p>مقارنة وفصل كامل ومؤشرات أداء بيانية للتقييم اليومي والنهائي</p>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => router.push('/dashboard')}>
            ← لوحة التحكم
          </button>
        </div>
      </header>

      {/* Toolbar / Actions */}
      <div className="action-toolbar">
        <div className="filter-group">
          <label>فترة البيانات:</label>
          <select value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="all">كل البيانات التاريخية</option>
            <option value="7">آخر 7 أيام</option>
            <option value="30">آخر 30 يوماً</option>
          </select>
        </div>
        <div className="button-group">
          <button className="btn-primary" onClick={csv}>
            <span className="icon">📊</span> تصدير Excel / CSV
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            <span className="icon">🖨</span> طباعة PDF
          </button>
        </div>
      </div>

      {error && <div className="error-alert">⚠️ {error}</div>}

      {/* Side-by-Side Comparison */}
      <Comparison daily={daily} final={final} />

      {/* Split Blocks */}
      <div className="reports-split-grid">
        <ReportBlock 
          title="📝 التقرير اليومي المطور" 
          subtitle="تحليل وتقييم جلسات التدريب اليومية" 
          data={daily} 
          color="blue" 
        />
        <ReportBlock 
          title="🏁 التقرير النهائي المطور" 
          subtitle="تحليل رضا المشاركين عن البرنامج التدريبي كاملاً" 
          data={final} 
          color="teal" 
        />
      </div>

      <footer className="report-footer">
        جميع الحقوق محفوظة للمنصة الرقمية لتقييم التدريب © 2026. تم تطوير التقارير بأعلى معايير جودة التصميم والذكاء التحليلي.
      </footer>
    </main>
  );
}

// -------------------------------------------------------------
// COMPARISON COMPONENT (With visual gradient bars & metrics cards)
// -------------------------------------------------------------
function Comparison({ daily, final }: { daily: Report; final: Report }) {
  const max = 5;
  const dailyPercent = daily.avg ? (daily.avg / max) * 100 : 0;
  const finalPercent = final.avg ? (final.avg / max) * 100 : 0;

  return (
    <section className="dashboard-panel comparison-panel">
      <h2>⚖️ مقارنة الأداء العام (يومي مقابل نهائي)</h2>
      <p className="panel-subtitle">نظرة سريعة لمستويات الرضا العام ومقارنة سلوك التقييم</p>
      
      <div className="compare-grid">
        {/* Daily Stats */}
        <div className="compare-card daily-theme">
          <div className="compare-meta">
            <b>التقييم اليومي المستمر</b>
            <span className="count-badge">{daily.count} استجابة</span>
          </div>
          <div className="score-display">
            <strong>{daily.avg ? daily.avg.toFixed(2) : '—'}</strong>
            <small>/5</small>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${dailyPercent}%` }}></div>
          </div>
          <span className="percentage-label">معدل رضا {dailyPercent.toFixed(1)}%</span>
        </div>

        {/* Final Stats */}
        <div className="compare-card final-theme">
          <div className="compare-meta">
            <b>التقييم الختامي النهائي</b>
            <span className="count-badge">{final.count} استجابة</span>
          </div>
          <div className="score-display">
            <strong>{final.avg ? final.avg.toFixed(2) : '—'}</strong>
            <small>/5</small>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${finalPercent}%` }}></div>
          </div>
          <span className="percentage-label">معدل رضا {finalPercent.toFixed(1)}%</span>
        </div>
      </div>
      
      {!daily.count && !final.count && (
        <p className="no-data-notice">لا توجد بيانات متاحة حالياً للمقارنة. يرجى البدء بجمع الاستبيانات.</p>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// REPORT BLOCK COMPONENT (With SVG charts & deep insight cards)
// -------------------------------------------------------------
function ReportBlock({ title, subtitle, data, color }: { title: string; subtitle: string; data: Report; color: string }) {
  return (
    <section className={`report-block-section ${color}`}>
      <div className="block-head-premium">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="executive-score-card">
          <div className="big-score">{data.avg ? data.avg.toFixed(2) : '—'}</div>
          <small>/5</small>
        </div>
      </div>

      {/* Metrics Counter Dashboard */}
      <div className="micro-stats-grid">
        <article className="stat-card">
          <span className="stat-title">إجمالي الاستجابات</span>
          <span className="stat-value">{data.count}</span>
        </article>
        <article className="stat-card">
          <span className="stat-title">نسبة الرضا العامة</span>
          <span className="stat-value">{data.avg ? Math.round((data.avg / 5) * 100) + '%' : '—'}</span>
        </article>
        <article className="stat-card">
          <span className="stat-title">المحاور المقاسة</span>
          <span className="stat-value">{data.axes.length}</span>
        </article>
      </div>

      {data.axes.length ? (
        <>
          {/* Main Results Grid */}
          <div className="results-analysis-grid">
            {/* Axis Results Progress Bars */}
            <div className="dashboard-panel sub-panel">
              <h3>📈 نتائج المحاور بالتفصيل</h3>
              <div className="metrics-list">
                {data.axes.map((x, idx) => (
                  <div className="metric-row" key={idx}>
                    <div className="metric-info">
                      <span className="section-badge">{x.section || 'عام'}</span>
                      <span className="metric-label">{x.label}</span>
                    </div>
                    <div className="bar-and-value">
                      <div className="progress-track-mini">
                        <div className="progress-bar-fill" style={{ width: `${(x.value / 5) * 100}%` }}></div>
                      </div>
                      <strong className="metric-score">{x.value.toFixed(2)}/5</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Executive Analysis Insights */}
            <div className="dashboard-panel sub-panel insight-panel">
              <h3>🎯 التحليل الذكي والتوصيات</h3>
              <div className="insights-content">
                <div className="insight-item positive">
                  <span className="insight-icon">✅</span>
                  <div className="insight-text">
                    <b>المحور الأعلى أداءً:</b>
                    <p>{data.axes[data.axes.length - 1]?.label} ({data.axes[data.axes.length - 1]?.value.toFixed(2)}/5)</p>
                  </div>
                </div>
                
                <div className="insight-item improvement">
                  <span className="insight-icon">🎯</span>
                  <div className="insight-text">
                    <b>المحور الأقل تقييماً (مجال التطوير):</b>
                    <p>{data.axes[0]?.label} ({data.axes[0]?.value.toFixed(2)}/5)</p>
                  </div>
                </div>

                <div className="insight-item recommendation">
                  <span className="insight-icon">📌</span>
                  <div className="insight-text">
                    <b>التوصية المقترحة:</b>
                    <p>نوصي بتخصيص 15 دقيقة إضافية في الجلسات القادمة للتركيز بشكل أكبر على "{data.axes[0]?.label}" نظراً لكونه المحور الأكثر احتياجاً للتطوير وفقاً لاستجابات المشاركين.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive SVG Trend Chart */}
          <div className="dashboard-panel trend-panel-premium">
            <h3>📈 اتجاه وتقييم الاستجابات اليومي</h3>
            <p className="panel-subtitle">معدل حجم المشاركة والتقييم على مدار الفترة المحددة</p>
            {data.timeline.length ? (
              <div className="trend-chart-wrapper">
                <div className="trend-bar-chart">
                  {data.timeline.map((x, idx) => {
                    const maxCount = Math.max(1, ...data.timeline.map(y => y.count));
                    const barHeight = Math.max(10, (x.count / maxCount) * 120);
                    return (
                      <div className="trend-bar-column" key={idx}>
                        <span className="count-label">{x.count} مشارك</span>
                        <div className="trend-bar" style={{ height: `${barHeight}px` }}></div>
                        <span className="axis-date-label">{x.label}</span>
                        <span className="avg-rating-badge">{x.avg ? x.avg.toFixed(1) + '★' : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="no-data-text">لا توجد بيانات مخطط زمني كافية.</p>
            )}
          </div>

          {/* Text Comments/Feedback quotes */}
          <div className="dashboard-panel comments-panel-premium">
            <h3>💬 مرئيات وملاحظات المشاركين النصية</h3>
            {data.comments.length ? (
              <div className="comments-grid">
                {data.comments.map((x, idx) => (
                  <blockquote className="premium-quote" key={idx}>
                    <span className="quote-mark">“</span>
                    <p className="quote-text">{x}</p>
                  </blockquote>
                ))}
              </div>
            ) : (
              <p className="no-data-text text-center">لا توجد أي ملاحظات أو تعليقات مكتوبة لهذا التقييم حتى الآن.</p>
            )}
          </div>
        </>
      ) : (
        <section className="dashboard-panel empty-panel">
          <p>⚠️ لا توجد أي استجابات أو بيانات مدرجة لهذا التقرير حالياً.</p>
        </section>
      )}
    </section>
  );
}

// -------------------------------------------------------------
// PREMIUM ENCAPSULATED CSS STYLES (Supports Light/Dark elegant layout, Arabic RTL, proper styling)
// -------------------------------------------------------------
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');

  .report-dashboard-container {
    font-family: 'Cairo', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    direction: rtl;
    text-align: right;
    background-color: #f8fafc;
    color: #1e293b;
    padding: 30px;
    min-height: 100vh;
    box-sizing: border-box;
  }

  .loading-container {
    font-family: 'Cairo', sans-serif;
    direction: rtl;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: #f8fafc;
    color: #334155;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #e2e8f0;
    border-top: 5px solid #0d9488;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Executive Header */
  .executive-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 25px;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 20px;
  }

  .header-info h1 {
    font-size: 32px;
    font-weight: 800;
    color: #0f172a;
    margin: 5px 0 0 0;
  }

  .header-info p {
    font-size: 15px;
    color: #64748b;
    margin: 5px 0 0 0;
  }

  .executive-badge {
    background-color: #f0fdfa;
    color: #0d9488;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid #ccfbf1;
    display: inline-block;
  }

  .btn-outline {
    background-color: #ffffff;
    border: 1px solid #cbd5e1;
    color: #334155;
    padding: 10px 20px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-outline:hover {
    background-color: #f1f5f9;
    border-color: #94a3b8;
  }

  /* Toolbar */
  .action-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #ffffff;
    padding: 15px 25px;
    border-radius: 16px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 15px;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .filter-group label {
    font-weight: 700;
    font-size: 14px;
    color: #475569;
  }

  .filter-group select {
    background-color: #f8fafc;
    border: 1px solid #cbd5e1;
    padding: 8px 16px;
    border-radius: 8px;
    font-family: 'Cairo', sans-serif;
    font-size: 13.5px;
    color: #1e293b;
    outline: none;
    cursor: pointer;
  }

  .button-group {
    display: flex;
    gap: 12px;
  }

  .btn-primary, .btn-secondary {
    padding: 10px 18px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background-color: #0d9488;
    color: #ffffff;
  }

  .btn-primary:hover {
    background-color: #0f766e;
  }

  .btn-secondary {
    background-color: #0f172a;
    color: #ffffff;
  }

  .btn-secondary:hover {
    background-color: #1e293b;
  }

  .error-alert {
    background-color: #fef2f2;
    border: 1px solid #fee2e2;
    color: #b91c1c;
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 30px;
    font-weight: 600;
  }

  /* Panels */
  .dashboard-panel {
    background-color: #ffffff;
    padding: 25px;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
    margin-bottom: 30px;
  }

  .dashboard-panel h2 {
    font-size: 20px;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 5px 0;
  }

  .panel-subtitle {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 20px 0;
  }

  /* Compare Grid */
  .compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
  }

  .compare-card {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 22px;
    border-radius: 16px;
    transition: all 0.3s ease;
  }

  .compare-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
  }

  .compare-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .compare-meta b {
    font-size: 15px;
    color: #334155;
  }

  .count-badge {
    background-color: #f1f5f9;
    color: #475569;
    padding: 2px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
  }

  .score-display {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 12px;
  }

  .score-display strong {
    font-size: 38px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1;
  }

  .score-display small {
    font-size: 16px;
    color: #64748b;
    font-weight: 600;
  }

  .progress-track {
    width: 100%;
    height: 10px;
    background-color: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .progress-bar {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(90deg, #3b82f6, #0d9488);
  }

  .daily-theme .progress-bar {
    background: linear-gradient(90deg, #2563eb, #3b82f6);
  }

  .final-theme .progress-bar {
    background: linear-gradient(90deg, #0d9488, #0f766e);
  }

  .percentage-label {
    font-size: 12.5px;
    font-weight: 700;
    color: #475569;
  }

  /* Split Blocks */
  .reports-split-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 30px;
    margin-bottom: 30px;
  }

  @media (min-width: 1024px) {
    .reports-split-grid {
      grid-template-columns: 1fr;
    }
  }

  .report-block-section {
    background-color: #ffffff;
    border-radius: 24px;
    border: 1px solid #e2e8f0;
    padding: 30px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01);
  }

  .report-block-section.blue {
    border-right: 6px solid #2563eb;
  }

  .report-block-section.teal {
    border-right: 6px solid #0d9488;
  }

  .block-head-premium {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 20px;
    margin-bottom: 25px;
  }

  .block-head-premium h2 {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
  }

  .block-head-premium p {
    font-size: 13.5px;
    color: #64748b;
    margin: 4px 0 0 0;
  }

  .executive-score-card {
    display: flex;
    align-items: baseline;
    gap: 2px;
    background-color: #f8fafc;
    padding: 10px 20px;
    border-radius: 14px;
    border: 1px solid #f1f5f9;
  }

  .executive-score-card .big-score {
    font-size: 34px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1;
  }

  .executive-score-card small {
    font-size: 14px;
    color: #64748b;
    font-weight: 700;
  }

  /* Micro stats */
  .micro-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-bottom: 30px;
  }

  .stat-card {
    background-color: #f8fafc;
    border: 1px solid #f1f5f9;
    padding: 15px;
    border-radius: 12px;
    text-align: center;
  }

  .stat-title {
    font-size: 12.5px;
    color: #64748b;
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
  }

  .stat-value {
    font-size: 22px;
    font-weight: 800;
    color: #1e293b;
  }

  /* Analysis grid */
  .results-analysis-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 25px;
    margin-bottom: 30px;
  }

  @media (min-width: 1024px) {
    .results-analysis-grid {
      grid-template-columns: 1.2fr 1fr;
    }
  }

  .sub-panel {
    background-color: #fafbfc;
    border: 1px solid #f1f5f9;
    margin-bottom: 0;
    padding: 20px;
  }

  .sub-panel h3 {
    font-size: 15px;
    font-weight: 700;
    color: #334155;
    margin: 0 0 15px 0;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 8px;
  }

  .metrics-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .metric-row {
    background-color: #ffffff;
    padding: 12px 15px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
  }

  .metric-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .section-badge {
    background-color: #f1f5f9;
    color: #475569;
    padding: 1px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
  }

  .metric-label {
    font-size: 12.5px;
    color: #1e293b;
    font-weight: 600;
  }

  .bar-and-value {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .progress-track-mini {
    flex-grow: 1;
    height: 8px;
    background-color: #f1f5f9;
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 9999px;
    background: #0d9488;
  }

  .blue .progress-bar-fill {
    background: #2563eb;
  }

  .metric-score {
    font-size: 13.5px;
    color: #0f172a;
    font-weight: 700;
    white-space: nowrap;
    width: 45px;
    text-align: left;
  }

  /* Insights Content */
  .insights-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .insight-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
  }

  .insight-item.positive {
    background-color: #f0fdf4;
    border: 1px solid #dcfce7;
  }

  .insight-item.improvement {
    background-color: #fffbeb;
    border: 1px solid #fef3c7;
  }

  .insight-item.recommendation {
    background-color: #f0f9ff;
    border: 1px solid #e0f2fe;
  }

  .insight-icon {
    font-size: 18px;
    shrink-0: 1;
  }

  .insight-text b {
    font-size: 12.5px;
    color: #1e293b;
    display: block;
    margin-bottom: 2px;
  }

  .insight-text p {
    font-size: 12px;
    color: #475569;
    margin: 0;
  }

  /* Trend Chart */
  .trend-panel-premium {
    background-color: #fafbfc;
    border: 1px solid #f1f5f9;
    padding: 20px;
    margin-bottom: 30px;
  }

  .trend-panel-premium h3 {
    font-size: 15px;
    font-weight: 700;
    color: #334155;
    margin: 0 0 5px 0;
  }

  .trend-chart-wrapper {
    overflow-x: auto;
    padding: 15px 0;
  }

  .trend-bar-chart {
    height: 180px;
    display: flex;
    align-items: flex-end;
    gap: 20px;
    min-width: 400px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e2e8f0;
  }

  .trend-bar-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  .count-label {
    font-size: 10.5px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 6px;
  }

  .trend-bar {
    width: 60%;
    min-width: 24px;
    background: linear-gradient(180deg, #3b82f6, #0d9488);
    border-radius: 8px 8px 0 0;
    transition: all 0.3s ease;
  }

  .blue .trend-bar {
    background: linear-gradient(180deg, #60a5fa, #2563eb);
  }

  .teal .trend-bar {
    background: linear-gradient(180deg, #2dd4bf, #0d9488);
  }

  .trend-bar:hover {
    opacity: 0.85;
    transform: scaleY(1.03);
  }

  .axis-date-label {
    font-size: 11px;
    color: #475569;
    margin-top: 8px;
    font-weight: 600;
    white-space: nowrap;
  }

  .avg-rating-badge {
    background-color: #334155;
    color: #ffffff;
    font-size: 9.5px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 4px;
    font-weight: 700;
  }

  /* Comments grid */
  .comments-panel-premium {
    background-color: #fafbfc;
    border: 1px solid #f1f5f9;
    padding: 20px;
    margin-bottom: 0;
  }

  .comments-panel-premium h3 {
    font-size: 15px;
    font-weight: 700;
    color: #334155;
    margin: 0 0 15px 0;
  }

  .comments-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
  }

  @media (min-width: 768px) {
    .comments-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .premium-quote {
    background-color: #ffffff;
    border-right: 4px solid #0d9488;
    padding: 15px 20px;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.01);
    margin: 0;
    position: relative;
  }

  .blue .premium-quote {
    border-right-color: #2563eb;
  }

  .quote-mark {
    font-size: 30px;
    color: #cbd5e1;
    position: absolute;
    top: 5px;
    right: 15px;
    line-height: 1;
    font-family: serif;
  }

  .quote-text {
    font-size: 12.5px;
    color: #334155;
    line-height: 1.6;
    margin: 0;
    position: relative;
    z-index: 1;
  }

  .no-data-text {
    font-size: 13.5px;
    color: #64748b;
    margin: 10px 0 0 0;
  }

  .empty-panel {
    text-align: center;
    padding: 30px;
    color: #64748b;
    font-weight: 600;
  }

  .no-data-notice {
    text-align: center;
    color: #64748b;
    margin-top: 15px;
    font-size: 13.5px;
  }

  .report-footer {
    text-align: center;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }

  @media (max-width: 768px) {
    .report-dashboard-container {
      padding: 15px;
    }
    .executive-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .compare-grid {
      grid-template-columns: 1fr;
    }
    .micro-stats-grid {
      grid-template-columns: 1fr;
    }
    .action-toolbar {
      flex-direction: column;
      align-items: flex-start;
    }
    .button-group {
      width: 100%;
    }
    .btn-primary, .btn-secondary {
      flex-grow: 1;
      justify-content: center;
    }
  }

  /* Print Styles */
  @media print {
    body {
      background-color: #ffffff;
    }
    .report-dashboard-container {
      padding: 0;
    }
    .executive-header, .action-toolbar {
      display: none !important;
    }
    .dashboard-panel, .report-block-section {
      box-shadow: none !important;
      border: 1px solid #cbd5e1 !important;
      page-break-inside: avoid;
    }
    .reports-split-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;
