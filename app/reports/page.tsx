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

type AxisItem = { label: string; section: string; value: number };
type TimelineItem = { label: string; count: number; avg: number };

type ReportData = {
  count: number;
  avg: number;
  axes: AxisItem[];
  comments: string[];
  timeline: TimelineItem[];
};

export default function ReportsPage() {
  const db = supabase();
  const router = useRouter();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'all' | '7' | '30'>('all');

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData, error: sessionErr } = await db.auth.getSession();
        if (sessionErr || !sessionData?.session) {
          setError('انتهت جلسة الدخول أو لم يتم تسجيل الدخول. يرجى تسجيل الدخول من جديد.');
          setLoading(false);
          return;
        }

        const { data: e, error: ee } = await db
          .from('evaluations')
          .select('id,kind,overall_rating,submitted_at,program_id')
          .order('submitted_at', { ascending: false });

        if (ee) {
          setError('خطأ في جلب التقييمات: ' + ee.message);
          setLoading(false);
          return;
        }

        const ids = (e || []).map((x) => x.id);
        const aRes = ids.length
          ? await db.from('evaluation_answers').select('evaluation_id,question_id,rating_value,text_value').in('evaluation_id', ids)
          : { data: [] as Answer[] };

        const qids = (aRes.data || []).map((x) => x.question_id);
        const qRes = qids.length
          ? await db.from('questions').select('id,text_ar,section_ar').in('id', qids)
          : { data: [] as Question[] };

        setRows(e || []);
        setAnswers(aRes.data || []);
        setQuestions(qRes.data || []);
      } catch (err: any) {
        setError(err?.message || 'حدث خطأ غير متوقع أثناء تحميل البيانات.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    if (period === 'all') return rows;
    const days = period === '7' ? 7 : 30;
    const cutoff = Date.now() - days * 86400000;
    return rows.filter((x) => new Date(x.submitted_at).getTime() >= cutoff);
  }, [rows, period]);

  const calculate = (kind: 'DAILY' | 'FINAL'): ReportData => {
    const list = filtered.filter((x) => x.kind === kind);
    const idSet = new Set(list.map((x) => x.id));
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const qMap = Object.fromEntries(questions.map((q) => [q.id, q]));

    const grouped: Record<string, number[]> = {};
    answers
      .filter((x) => idSet.has(x.evaluation_id) && x.rating_value !== null && x.rating_value !== undefined)
      .forEach((x) => {
        const val = Number(x.rating_value);
        if (!isNaN(val)) {
          grouped[x.question_id] = grouped[x.question_id] || [];
          grouped[x.question_id].push(val);
        }
      });

    const axes: AxisItem[] = Object.entries(grouped)
      .map(([id, vals]) => ({
        label: qMap[id]?.text_ar || 'سؤال',
        section: qMap[id]?.section_ar || 'عام',
        value: avg(vals),
      }))
      .sort((a, b) => a.value - b.value);

    const byDate: Record<string, { n: number; ratings: number[] }> = {};
    list.forEach((x) => {
      const key = new Date(x.submitted_at).toLocaleDateString('ar-SA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      byDate[key] = byDate[key] || { n: 0, ratings: [] };
      byDate[key].n += 1;
      if (x.overall_rating !== null && x.overall_rating !== undefined) {
        const r = Number(x.overall_rating);
        if (!isNaN(r)) byDate[key].ratings.push(r);
      }
    });

    return {
      count: list.length,
      avg: avg(list.map((x) => Number(x.overall_rating || 0)).filter((v) => v > 0)),
      axes,
      comments: answers
        .filter((x) => idSet.has(x.evaluation_id) && (x.text_value || '').trim().length > 0)
        .map((x) => x.text_value!.trim())
        .slice(0, 8),
      timeline: Object.entries(byDate)
        .map(([label, v]) => ({
          label,
          count: v.n,
          avg: avg(v.ratings),
        }))
        .slice(-8),
    };
  };

  const daily = useMemo(() => calculate('DAILY'), [filtered, answers, questions]);
  const final = useMemo(() => calculate('FINAL'), [filtered, answers, questions]);

  const handleExportCSV = () => {
    const lines = [
      'نوع التقييم,المحور,القسم,المتوسط',
      ...daily.axes.map((x) => `يومي,"${x.label}","${x.section}",${x.value.toFixed(2)}`),
      ...final.axes.map((x) => `نهائي,"${x.label}","${x.section}",${x.value.toFixed(2)}`),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'separated-evaluation-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="page-container loading-state">
        <style jsx global>{globalStyles}</style>
        <div className="spinner" />
        <p>جارٍ إعداد وتحليل التقارير الاستراتيجية...</p>
      </main>
    );
  }

  return (
    <main className="page-container report-dashboard">
      <style jsx global>{globalStyles}</style>

      {/* Header */}
      <header className="exec-header">
        <div>
          <span className="badge-exec">تقرير الأداء السنوي المطور</span>
          <h1>📑 التقارير الاستراتيجية والتحليلية</h1>
          <p>فصل كامل بين التقييم اليومي والنهائي مع مؤشرات أداء بيانية وتوصيات ذكية</p>
        </div>
        <div className="header-actions">
          <button className="btn-outline" onClick={() => router.push('/dashboard')}>
            ← لوحة التحكم
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="filter-group">
          <label htmlFor="period">فترة البيانات:</label>
          <select id="period" value={period} onChange={(e) => setPeriod(e.target.value as any)}>
            <option value="all">كل البيانات التاريخية</option>
            <option value="7">آخر 7 أيام</option>
            <option value="30">آخر 30 يوماً</option>
          </select>
        </div>
        <div className="btn-group">
          <button className="btn-primary" onClick={handleExportCSV}>
            📊 تصدير CSV / Excel
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            🖨 طباعة PDF
          </button>
        </div>
      </div>

      {error && <div className="error-alert">⚠️ {error}</div>}

      {/* Comparison Section */}
      <section className="panel compare-panel">
        <h2>⚖️ مقارنة الأداء العام (يومي مقابل نهائي)</h2>
        <p className="subtext">نظرة سريعة لمستويات الرضا ومقارنة سلوك التقييم بين المرحلتين</p>

        <div className="compare-grid">
          <div className="compare-card daily-card">
            <div className="compare-top">
              <b>التقييم اليومي المستمر</b>
              <span className="count-badge">{daily.count} استجابة</span>
            </div>
            <div className="score-big">
              <strong>{daily.avg ? daily.avg.toFixed(2) : '—'}</strong>
              <small>/5</small>
            </div>
            <div className="progress-track">
              <div className="progress-fill daily-fill" style={{ width: `${Math.min(100, (daily.avg / 5) * 100)}%` }} />
            </div>
            <span className="pct-label">معدل رضا {Math.round((daily.avg / 5) * 100) || 0}%</span>
          </div>

          <div className="compare-card final-card">
            <div className="compare-top">
              <b>التقييم الختامي النهائي</b>
              <span className="count-badge">{final.count} استجابة</span>
            </div>
            <div className="score-big">
              <strong>{final.avg ? final.avg.toFixed(2) : '—'}</strong>
              <small>/5</small>
            </div>
            <div className="progress-track">
              <div className="progress-fill final-fill" style={{ width: `${Math.min(100, (final.avg / 5) * 100)}%` }} />
            </div>
            <span className="pct-label">معدل رضا {Math.round((final.avg / 5) * 100) || 0}%</span>
          </div>
        </div>

        {daily.count === 0 && final.count === 0 && (
          <p className="no-data-note">لا توجد بيانات متاحة حالياً للمقارنة. يرجى البدء بجمع الاستبيانات.</p>
        )}
      </section>

      {/* Reports Split */}
      <div className="split-grid">
        <section className="report-block blue-theme">
          <div className="block-header">
            <div>
              <h2>📝 التقرير اليومي المطور</h2>
              <p>تحليل جلسات التدريب اليومية وتقييم المشاركين المستمر</p>
            </div>
            <div className="exec-score">
              <span className="big-num">{daily.avg ? daily.avg.toFixed(2) : '—'}</span>
              <small>/5</small>
            </div>
          </div>

          <div className="micro-stats">
            <article>
              <span className="label">عدد الاستجابات</span>
              <b>{daily.count}</b>
            </article>
            <article>
              <span className="label">نسبة الرضا العامة</span>
              <b>{daily.avg ? Math.round((daily.avg / 5) * 100) + '%' : '—'}</b>
            </article>
            <article>
              <span className="label">المحاور المقاسة</span>
              <b>{daily.axes.length}</b>
            </article>
          </div>

          {daily.axes.length > 0 ? (
            <>
              <div className="analysis-grid">
                <div className="sub-panel">
                  <h3>📈 نتائج المحاور بالتفصيل</h3>
                  <div className="metrics-list">
                    {daily.axes.map((item, idx) => (
                      <div className="metric-row" key={idx}>
                        <div className="metric-info">
                          <span className="section-tag">{item.section || 'عام'}</span>
                          <span className="metric-label">{item.label}</span>
                        </div>
                        <div className="bar-row">
                          <div className="track-mini">
                            <div className="fill-mini" style={{ width: `${(item.value / 5) * 100}%` }} />
                          </div>
                          <strong>{item.value.toFixed(2)}/5</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sub-panel insight-box">
                  <h3>🎯 التحليل الذكي والتوصيات</h3>
                  <div className="insight-item positive">
                    <span className="icon">✅</span>
                    <div>
                      <b>المحور الأعلى أداءً:</b>
                      <p>{daily.axes[daily.axes.length - 1]?.label} ({daily.axes[daily.axes.length - 1]?.value.toFixed(2)}/5)</p>
                    </div>
                  </div>
                  <div className="insight-item improvement">
                    <span className="icon">🎯</span>
                    <div>
                      <b>مجال التطوير:</b>
                      <p>{daily.axes[0]?.label} ({daily.axes[0]?.value.toFixed(2)}/5)</p>
                    </div>
                  </div>
                  <div className="insight-item recommendation">
                    <span className="icon">📌</span>
                    <div>
                      <b>التوصية المقترحة:</b>
                      <p>نوصي بتركيز إضافي في الجلسات القادمة على "{daily.axes[0]?.label}" لتعزيز الأداء وفقاً لآراء المشاركين.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sub-panel chart-panel">
                <h3>📈 اتجاه الاستجابات اليومية</h3>
                <div className="trend-chart">
                  {daily.timeline.map((t, i) => {
                    const maxC = Math.max(1, ...daily.timeline.map((x) => x.count));
                    return (
                      <div className="trend-col" key={i}>
                        <span className="count-label">{t.count}</span>
                        <div className="trend-bar" style={{ height: `${Math.max(10, (t.count / maxC) * 120)}px` }} />
                        <span className="date-label">{t.label}</span>
                        <span className="rating-badge">{t.avg ? t.avg.toFixed(1) + '★' : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sub-panel comments-panel">
                <h3>💬 ملاحظات المشاركين النصية</h3>
                {daily.comments.length ? (
                  <div className="comments-grid">
                    {daily.comments.map((c, i) => (
                      <blockquote className="quote-card" key={i}>
                        <span className="quote-mark">“</span>
                        <p>{c}</p>
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">لا توجد ملاحظات نصية مسجلة لهذا التقرير.</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">⚠️ لا توجد بيانات يومية متاحة حالياً.</div>
          )}
        </section>

        <section className="report-block teal-theme">
          <div className="block-header">
            <div>
              <h2>🏁 التقرير النهائي المطور</h2>
              <p>تحليل رضا المشاركين عن البرنامج التدريبي كاملاً</p>
            </div>
            <div className="exec-score">
              <span className="big-num">{final.avg ? final.avg.toFixed(2) : '—'}</span>
              <small>/5</small>
            </div>
          </div>

          <div className="micro-stats">
            <article>
              <span className="label">عدد الاستجابات</span>
              <b>{final.count}</b>
            </article>
            <article>
              <span className="label">نسبة الرضا العامة</span>
              <b>{final.avg ? Math.round((final.avg / 5) * 100) + '%' : '—'}</b>
            </article>
            <article>
              <span className="label">المحاور المقاسة</span>
              <b>{final.axes.length}</b>
            </article>
          </div>

          {final.axes.length > 0 ? (
            <>
              <div className="analysis-grid">
                <div className="sub-panel">
                  <h3>📊 نتائج المحاور بالتفصيل</h3>
                  <div className="metrics-list">
                    {final.axes.map((item, idx) => (
                      <div className="metric-row" key={idx}>
                        <div className="metric-info">
                          <span className="section-tag">{item.section || 'عام'}</span>
                          <span className="metric-label">{item.label}</span>
                        </div>
                        <div className="bar-row">
                          <div className="track-mini">
                            <div className="fill-mini teal-fill" style={{ width: `${(item.value / 5) * 100}%` }} />
                          </div>
                          <strong>{item.value.toFixed(2)}/5</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sub-panel insight-box">
                  <h3>🎯 التحليل الذكي والتوصيات</h3>
                  <div className="insight-item positive">
                    <span className="icon">✅</span>
                    <div>
                      <b>المحور الأعلى أداءً:</b>
                      <p>{final.axes[final.axes.length - 1]?.label} ({final.axes[final.axes.length - 1]?.value.toFixed(2)}/5)</p>
                    </div>
                  </div>
                  <div className="insight-item improvement">
                    <span className="icon">🎯</span>
                    <div>
                      <b>مجال التطوير:</b>
                      <p>{final.axes[0]?.label} ({final.axes[0]?.value.toFixed(2)}/5)</p>
                    </div>
                  </div>
                  <div className="insight-item recommendation">
                    <span className="icon">📌</span>
                    <div>
                      <b>التوصية المقترحة:</b>
                      <p>نوصي بتعزيز المحور "{final.axes[0]?.label}" في الدورات القادمة لضمان استدامة التحسين.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sub-panel chart-panel">
                <h3>📈 اتجاه التقييم النهائي</h3>
                <div className="trend-chart">
                  {final.timeline.map((t, i) => {
                    const maxC = Math.max(1, ...final.timeline.map((x) => x.count));
                    return (
                      <div className="trend-col" key={i}>
                        <span className="count-label">{t.count}</span>
                        <div className="trend-bar" style={{ height: `${Math.max(10, (t.count / maxC) * 120)}px` }} />
                        <span className="date-label">{t.label}</span>
                        <span className="rating-badge">{t.avg ? t.avg.toFixed(1) + '★' : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sub-panel comments-panel">
                <h3>💬 ملاحظات المشاركين النصية</h3>
                {final.comments.length ? (
                  <div className="comments-grid">
                    {final.comments.map((c, i) => (
                      <blockquote className="quote-card" key={i}>
                        <span className="quote-mark">“</span>
                        <p>{c}</p>
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">لا توجد ملاحظات نصية مسجلة للتقييم النهائي.</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">⚠️ لا توجد بيانات نهائية متاحة حالياً.</div>
          )}
        </section>
      </div>

      <footer className="report-footer">
        جميع الحقوق محفوظة للمنصة الرقمية لتقييم التدريب © 2026
      </footer>
    </main>
  );
}

const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');
.page-container { font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; background: #f8fafc; color: #1e293b; padding: 30px; min-height: 100vh; }
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; color: #334155; }
.spinner { width: 48px; height: 48px; border: 5px solid #e2e8f0; border-top: 5px solid #0d9488; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.exec-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
.exec-header h1 { font-size: 28px; font-weight: 800; margin: 6px 0 4px; color: #0f172a; }
.exec-header p { font-size: 14px; color: #64748b; margin: 0; }
.badge-exec { background: #f0fdfa; color: #0d9488; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; border: 1px solid #ccfbf1; display: inline-block; margin-bottom: 6px; }
.header-actions { display: flex; align-items: center; }
.btn-outline { background: #fff; border: 1px solid #cbd5e1; color: #334155; padding: 10px 18px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: .2s; }
.btn-outline:hover { background: #f1f5f9; border-color: #94a3b8; }
.toolbar { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 16px 22px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.04); margin-bottom: 24px; flex-wrap: wrap; gap: 14px; }
.filter-group { display: flex; align-items: center; gap: 10px; }
.filter-group label { font-weight: 700; font-size: 13px; color: #475569; }
.filter-group select { border: 1px solid #cbd5e1; background: #f8fafc; padding: 8px 12px; border-radius: 8px; font-family: inherit; font-size: 13px; color: #1e293b; outline: none; cursor: pointer; }
.btn-group { display: flex; gap: 10px; }
.btn-primary { background: #0d9488; color: #fff; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: .2s; }
.btn-primary:hover { background: #0f766e; }
.btn-secondary { background: #0f172a; color: #fff; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: .2s; }
.btn-secondary:hover { background: #1e293b; }
.error-alert { background: #fef2f2; border: 1px solid #fee2e2; color: #b91c1c; padding: 14px; border-radius: 10px; margin-bottom: 24px; font-weight: 600; }
.panel { background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,.02); margin-bottom: 24px; }
.panel h2 { font-size: 20px; font-weight: 800; margin: 0 0 4px; color: #0f172a; }
.subtext { font-size: 13px; color: #64748b; margin: 0 0 18px; }
.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.compare-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 16px; }
.compare-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.compare-top b { font-size: 15px; color: #334155; }
.count-badge { background: #f1f5f9; color: #475569; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
.score-big { display: flex; align-items: baseline; gap: 4px; margin-bottom: 12px; }
.score-big strong { font-size: 36px; font-weight: 800; color: #0f172a; }
.score-big small { font-size: 16px; color: #64748b; font-weight: 600; }
.progress-track { width: 100%; height: 10px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-bottom: 8px; }
.progress-fill { height: 100%; border-radius: 9999px; }
.daily-fill { background: linear-gradient(90deg, #2563eb, #3b82f6); }
.final-fill { background: linear-gradient(90deg, #0d9488, #0f766e); }
.pct-label { font-size: 13px; font-weight: 700; color: #334155; }
.no-data-note { text-align: center; color: #64748b; margin-top: 12px; font-size: 14px; }

.split-grid { display: grid; grid-template-columns: 1fr; gap: 28px; margin-bottom: 24px; }
@media (min-width: 1024px) { .split-grid { grid-template-columns: 1fr 1fr; } }

.report-block { background: #fff; border-radius: 24px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.01); }
.blue-theme { border-right: 6px solid #2563eb; }
.teal-theme { border-right: 6px solid #0d9488; }
.block-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.block-header h2 { font-size: 22px; font-weight: 800; margin: 0; }
.block-header p { font-size: 13px; color: #64748b; margin: 4px 0 0; }
.exec-score { display: flex; align-items: baseline; gap: 4px; background: #f8fafc; padding: 10px 16px; border-radius: 12px; border: 1px solid #f1f5f9; }
.exec-score .big-num { font-size: 32px; font-weight: 800; color: #0f172a; }
.exec-score small { font-size: 14px; color: #64748b; font-weight: 600; }

.micro-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
.micro-stats article { background: #f8fafc; border: 1px solid #f1f5f9; padding: 14px; border-radius: 12px; text-align: center; }
.micro-stats .label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; font-weight: 600; }
.micro-stats b { font-size: 20px; color: #1e293b; font-weight: 800; }

.analysis-grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
@media (min-width: 1024px) { .analysis-grid { grid-template-columns: 1.2fr 1fr; } }
.sub-panel { background: #fafbfc; border: 1px solid #f1f5f9; border-radius: 16px; padding: 18px; margin-bottom: 0; }
.sub-panel h3 { font-size: 14px; font-weight: 700; color: #334155; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
.metrics-list { display: flex; flex-direction: column; gap: 10px; }
.metric-row { background: #fff; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; }
.metric-info { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.section-tag { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.metric-label { font-size: 13px; color: #1e293b; font-weight: 600; }
.bar-row { display: flex; align-items: center; gap: 12px; }
.track-mini { flex-grow: 1; height: 8px; background: #f1f5f9; border-radius: 9999px; overflow: hidden; }
.fill-mini { height: 100%; border-radius: 9999px; }
.fill-mini.teal-fill { background: #0d9488; }
.fill-mini:not(.teal-fill) { background: #2563eb; }
.bar-row strong { font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; width: 42px; text-align: left; }

.insight-box .insight-item { display: flex; gap: 10px; padding: 10px; border-radius: 10px; margin-bottom: 8px; }
.insight-item.positive { background: #f0fdf4; border: 1px solid #dcfce7; }
.insight-item.improvement { background: #fffbeb; border: 1px solid #fef3c7; }
.insight-item.recommendation { background: #f0f9ff; border: 1px solid #e0f2fe; }
.insight-item .icon { font-size: 16px; }
.insight-item b { font-size: 12px; color: #1e293b; display: block; margin-bottom: 2px; }
.insight-item p { font-size: 12px; color: #475569; margin: 0; line-height: 1.4; }

.chart-panel .trend-chart { display: flex; align-items: flex-end; gap: 20px; padding: 16px 0; border-bottom: 1px solid #e2e8f0; overflow-x: auto; }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 64px; }
.count-label { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; }
.trend-bar { width: 60%; min-width: 24px; background: linear-gradient(180deg, #3b82f6, #0d9488); border-radius: 8px 8px 0 0; }
.date-label { font-size: 10px; color: #475569; margin-top: 6px; font-weight: 600; white-space: nowrap; }
.rating-badge { background: #334155; color: #fff; font-size: 9px; padding: 1px 6px; border-radius: 4px; margin-top: 4px; font-weight: 700; }
.comments-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 640px) { .comments-grid { grid-template-columns: 1fr 1fr; } }
.quote-card { background: #fff; border-right: 4px solid #0d9488; padding: 14px 16px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,.01); margin: 0; position: relative; }
.teal-theme .quote-card { border-right-color: #0d9488; }
.blue-theme .quote-card { border-right-color: #2563eb; }
.quote-mark { font-size: 26px; color: #cbd5e1; position: absolute; top: 4px; right: 12px; line-height: 1; font-family: serif; }
.quote-card p { font-size: 12.5px; color: #334155; line-height: 1.6; margin: 0; position: relative; z-index: 1; }
.empty-text { font-size: 13px; color: #64748b; }
.empty-state { text-align: center; padding: 30px; color: #64748b; font-weight: 600; }

.report-footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
@media print {
  .toolbar, .header-actions, .btn-group { display: none !important; }
  .page-container { padding: 0; background: #fff; }
  .panel, .report-block { box-shadow: none !important; border: 1px solid #cbd5e1 !important; page-break-inside: avoid; }
  .split-grid { grid-template-columns: 1fr !important; }
}
`;
