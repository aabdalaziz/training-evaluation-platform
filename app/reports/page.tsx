"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

/* ===================== أنواع البيانات ===================== */
type Evaluation = {
  id: string;
  kind: "DAILY" | "FINAL";
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

/* ===================== الصفحة الرئيسية ===================== */
export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"all" | "7" | "30">("all");

  /* جلب البيانات مع التحقق من الجلسة */
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: sessionData } = await supabase().auth.getSession();
        if (!sessionData?.session) {
          if (mounted) {
            setError("انتهت جلسة الدخول. يرجى تسجيل الدخول من جديد.");
            setLoading(false);
          }
          return;
        }

        const { data: evals, error: evalsErr } = await supabase()
          .from("evaluations")
          .select("id, kind, overall_rating, submitted_at, program_id")
          .order("submitted_at", { ascending: false });

        if (evalsErr) throw new Error(evalsErr.message);
        if (!mounted) return;

        const evalIds = (evals || []).map((e) => e.id);

        const { data: ansData } = evalIds.length
          ? await supabase()
              .from("evaluation_answers")
              .select("evaluation_id, question_id, rating_value, text_value")
              .in("evaluation_id", evalIds)
          : { data: [] as Answer[] };

        const qIds = Array.from(new Set((ansData || []).map((a) => a.question_id)));

        const { data: qsData } = qIds.length
          ? await supabase()
              .from("questions")
              .select("id, text_ar, section_ar")
              .in("id", qIds)
          : { data: [] as Question[] };

        if (!mounted) return;
        setRows(evals || []);
        setAnswers(ansData || []);
        setQuestions(qsData || []);
      } catch (err: any) {
        if (mounted) setError(err?.message || "حدث خطأ أثناء تحميل البيانات");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  /* فلترة حسب الفترة */
  const filtered = useMemo(() => {
    if (period === "all") return rows;
    const days = period === "7" ? 7 : 30;
    const cutoff = Date.now() - days * 86400000;
    return rows.filter((r) => new Date(r.submitted_at).getTime() >= cutoff);
  }, [rows, period]);

  /* حساب التقرير - مع إعادة تعيين كاملة لكل نوع */
  const calculate = (kind: "DAILY" | "FINAL"): ReportData => {
    // ✅ إعادة تعيين كاملة هنا - لا توجد متغيرات مشتركة
    const list: Evaluation[] = [];
    for (const r of filtered) {
      if (r.kind === kind) list.push(r);
    }

    const idSet = new Set(list.map((r) => r.id));
    const qMap: Record<string, Question> = {};
    for (const q of questions) qMap[q.id] = q;

    // حساب المتوسط
    const avgOf = (arr: number[]): number =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // تجميع تقييمات المحاور
    const grouped: Record<string, number[]> = {};
    for (const a of answers) {
      if (!idSet.has(a.evaluation_id)) continue;
      if (a.rating_value === null || a.rating_value === undefined) continue;
      const val = Number(a.rating_value);
      if (isNaN(val)) continue;
      if (!grouped[a.question_id]) grouped[a.question_id] = [];
      grouped[a.question_id].push(val);
    }

    const axes: AxisItem[] = Object.keys(grouped).map((qid) => ({
      label: qMap[qid]?.text_ar || "سؤال",
      section: qMap[qid]?.section_ar || "عام",
      value: avgOf(grouped[qid]),
    }));
    axes.sort((a, b) => a.value - b.value);

    // تجميع حسب التاريخ
    const byDate: Record<string, { n: number; ratings: number[] }> = {};
    for (const r of list) {
      const key = new Date(r.submitted_at).toLocaleDateString("ar-SA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!byDate[key]) byDate[key] = { n: 0, ratings: [] };
      byDate[key].n += 1;
      if (r.overall_rating !== null && r.overall_rating !== undefined) {
        const ov = Number(r.overall_rating);
        if (!isNaN(ov)) byDate[key].ratings.push(ov);
      }
    }

    const timeline: TimelineItem[] = Object.keys(byDate).map((k) => ({
      label: k,
      count: byDate[k].n,
      avg: avgOf(byDate[k].ratings),
    }));
    timeline.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    const finalTimeline = timeline.slice(-8);

    // الملاحظات النصية
    const comments: string[] = [];
    for (const a of answers) {
      if (!idSet.has(a.evaluation_id)) continue;
      const txt = (a.text_value || "").trim();
      if (txt.length > 0) comments.push(txt);
      if (comments.length >= 8) break;
    }

    // المتوسط العام
    const allRatings: number[] = [];
    for (const r of list) {
      if (r.overall_rating !== null && r.overall_rating !== undefined) {
        const v = Number(r.overall_rating);
        if (!isNaN(v)) allRatings.push(v);
      }
    }

    return {
      count: list.length,
      avg: avgOf(allRatings),
      axes,
      comments,
      timeline: finalTimeline,
    };
  };

  const daily = useMemo(() => calculate("DAILY"), [filtered, answers, questions]);
  const final = useMemo(() => calculate("FINAL"), [filtered, answers, questions]);

  /* تصدير CSV */
  const exportCSV = () => {
    const lines: string[] = ["نوع التقييم,المحور,القسم,المتوسط"];
    daily.axes.forEach((x) =>
      lines.push(`يومي,"${x.label}","${x.section}",${x.value.toFixed(2)}`)
    );
    final.axes.forEach((x) =>
      lines.push(`نهائي,"${x.label}","${x.section}",${x.value.toFixed(2)}`)
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `separated-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ===================== العرض ===================== */
  if (loading) {
    return (
      <main style={styles.main}>
        <style jsx global>{styles.css}</style>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>جارٍ إعداد وتحميل التقارير...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <style jsx global>{styles.css}</style>

      {/* رأس الصفحة */}
      <header style={styles.header}>
        <div>
          <span style={styles.badge}>تقرير الأداء السنوي المطور</span>
          <h1 style={styles.h1}>📑 التقارير الاستراتيجية والتحليلية</h1>
          <p style={styles.subtitle}>
            فصل كامل بين التقييم اليومي والنهائي مع مؤشرات أداء بيانية وتوصيات ذكية
          </p>
        </div>
        <button
          style={styles.btnOutline}
          onClick={() => router.push("/dashboard")}
        >
          ← العودة للوحة التحكم
        </button>
      </header>

      {/* شريط الأدوات */}
      <div style={styles.toolbar}>
        <div style={styles.filterGroup}>
          <label style={{ fontWeight: 700, fontSize: 13, color: "#475569" }}>
            الفترة:
          </label>
          <select
            style={styles.select}
            value={period}
            onChange={(e) => setPeriod(e.target.value as "all" | "7" | "30")}
          >
            <option value="all">كل البيانات</option>
            <option value="7">آخر 7 أيام</option>
            <option value="30">آخر 30 يوماً</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={styles.btnPrimary} onClick={exportCSV}>
            📊 تصدير CSV
          </button>
          <button style={styles.btnDark} onClick={() => window.print()}>
            🖨 طباعة PDF
          </button>
        </div>
      </div>

      {error && <div style={styles.alert}>⚠️ {error}</div>}

      {/* قسم المقارنة */}
      <CompareSection daily={daily} final={final} />

      {/* التقارير المنفصلة */}
      <div style={styles.splitGrid}>
        <ReportBlock
          title="📝 التقرير اليومي"
          subtitle="تحليل جلسات التدريب اليومية"
          data={daily}
          color="blue"
        />
        <ReportBlock
          title="🏁 التقرير النهائي"
          subtitle="تحليل رضا المشاركين عن البرنامج"
          data={final}
          color="teal"
        />
      </div>

      <footer style={styles.footer}>
        منصة تقييم التدريب © 2026 — تم إعداد هذا التقرير باستخدام منهجية التحليل
        الاستراتيجي المتقدم
      </footer>
    </main>
  );
}

/* ===================== مكون المقارنة ===================== */
function CompareSection({ daily, final }: { daily: ReportData; final: ReportData }) {
  return (
    <section style={styles.panel}>
      <h2 style={styles.h2}>⚖️ مقارنة الأداء بين التقييم اليومي والنهائي</h2>
      <p style={styles.subtext}>
        مقارنة بصرية لمعدلات الرضا وإجمالي الاستجابات
      </p>

      <div style={styles.compareGrid}>
        <CompareCard
          title="التقييم اليومي المستمر"
          count={daily.count}
          avg={daily.avg}
          color="#2563eb"
          bgColor="#eff6ff"
        />
        <CompareCard
          title="التقييم الختامي النهائي"
          count={final.count}
          avg={final.avg}
          color="#0d9488"
          bgColor="#f0fdfa"
        />
      </div>

      {daily.count === 0 && final.count === 0 && (
        <p style={{ textAlign: "center", color: "#64748b", marginTop: 16 }}>
          لا توجد بيانات متاحة. أرسل استبيانات للطلاب لتظهر النتائج هنا.
        </p>
      )}
    </section>
  );
}

function CompareCard({
  title,
  count,
  avg,
  color,
  bgColor,
}: {
  title: string;
  count: number;
  avg: number;
  color: string;
  bgColor: string;
}) {
  const pct = Math.min(100, Math.round((avg / 5) * 100) || 0);
  return (
    <div style={{ ...styles.compareCard, background: bgColor }}>
      <div style={styles.compareTop}>
        <b style={{ fontSize: 15, color: "#334155" }}>{title}</b>
        <span style={styles.countBadge}>{count} استجابة</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0" }}>
        <strong style={{ fontSize: 36, fontWeight: 800, color: "#0f172a" }}>
          {avg ? avg.toFixed(2) : "—"}
        </strong>
        <small style={{ fontSize: 16, color: "#64748b" }}>/5</small>
      </div>
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        ></div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
        نسبة الرضا: {pct}%
      </span>
    </div>
  );
}

/* ===================== مكون التقرير ===================== */
function ReportBlock({
  title,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle: string;
  data: ReportData;
  color: "blue" | "teal";
}) {
  const accentColor = color === "blue" ? "#2563eb" : "#0d9488";
  const bgLight = color === "blue" ? "#eff6ff" : "#f0fdfa";
  const pct = data.avg ? Math.round((data.avg / 5) * 100) : 0;

  return (
    <section
      style={{
        ...styles.reportBlock,
        borderRight: `6px solid ${accentColor}`,
      }}
    >
      <div style={styles.blockHeader}>
        <div>
          <h2 style={{ ...styles.h2, color: accentColor }}>{title}</h2>
          <p style={styles.subtext}>{subtitle}</p>
        </div>
        <div style={styles.scoreCard}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>
            {data.avg ? data.avg.toFixed(2) : "—"}
          </span>
          <small style={{ fontSize: 14, color: "#64748b" }}>/5</small>
        </div>
      </div>

      {/* مؤشرات سريعة */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>عدد الاستجابات</span>
          <b style={styles.kpiValue}>{data.count}</b>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>نسبة الرضا</span>
          <b style={{ ...styles.kpiValue, color: accentColor }}>{pct}%</b>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>المحاور المقاسة</span>
          <b style={styles.kpiValue}>{data.axes.length}</b>
        </div>
      </div>

      {data.axes.length > 0 ? (
        <>
          {/* نتائج المحاور + التحليل */}
          <div style={styles.analysisGrid}>
            <div style={styles.subPanel}>
              <h3 style={styles.h3}>📊 نتائج المحاور بالتفصيل</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.axes.map((axis, idx) => (
                  <div key={idx} style={styles.metricRow}>
                    <div style={styles.metricInfo}>
                      <span style={styles.sectionTag}>{axis.section}</span>
                      <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>
                        {axis.label}
                      </span>
                    </div>
                    <div style={styles.barRow}>
                      <div style={styles.trackMini}>
                        <div
                          style={{
                            ...styles.fillMini,
                            width: `${(axis.value / 5) * 100}%`,
                            background: accentColor,
                          }}
                        ></div>
                      </div>
                      <strong style={{ fontSize: 13, color: "#0f172a", minWidth: 42, textAlign: "left" }}>
                        {axis.value.toFixed(2)}/5
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...styles.subPanel, background: bgLight }}>
              <h3 style={styles.h3}>🎯 التحليل الذكي والتوصيات</h3>
              <div style={styles.insightItem("positive")}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <b style={{ fontSize: 12, color: "#1e293b" }}>المحور الأعلى:</b>
                  <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                    {data.axes[data.axes.length - 1]?.label} (
                    {data.axes[data.axes.length - 1]?.value.toFixed(2)}/5)
                  </p>
                </div>
              </div>
              <div style={styles.insightItem("improvement")}>
                <span style={{ fontSize: 18 }}>🎯</span>
                <div>
                  <b style={{ fontSize: 12, color: "#1e293b" }}>مجال التطوير:</b>
                  <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                    {data.axes[0]?.label} ({data.axes[0]?.value.toFixed(2)}/5)
                  </p>
                </div>
              </div>
              <div style={styles.insightItem("recommendation")}>
                <span style={{ fontSize: 18 }}>📌</span>
                <div>
                  <b style={{ fontSize: 12, color: "#1e293b" }}>التوصية:</b>
                  <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                    نوصي بتعزيز المحور "{data.axes[0]?.label}" في الجلسات القادمة
                    لضمان استدامة التحسين.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* الرسم البياني SVG */}
          {data.timeline.length > 0 && (
            <div style={styles.subPanel}>
              <h3 style={styles.h3}>📈 اتجاه الاستجابات عبر الزمن</h3>
              <TrendChart timeline={data.timeline} color={accentColor} />
            </div>
          )}

          {/* الملاحظات النصية */}
          <div style={styles.subPanel}>
            <h3 style={styles.h3}>💬 ملاحظات المشاركين</h3>
            {data.comments.length > 0 ? (
              <div style={styles.commentsGrid}>
                {data.comments.map((c, i) => (
                  <blockquote
                    key={i}
                    style={{ ...styles.quote, borderRight: `4px solid ${accentColor}` }}
                  >
                    <span style={styles.quoteMark}>"</span>
                    <p style={{ fontSize: 12.5, color: "#334155", margin: 0, lineHeight: 1.6 }}>
                      {c}
                    </p>
                  </blockquote>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                لا توجد ملاحظات نصية مسجلة.
              </p>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: 30,
            color: "#64748b",
            fontWeight: 600,
          }}
        >
          ⚠️ لا توجد بيانات متاحة لهذا التقرير.
        </div>
      )}
    </section>
  );
}

/* ===================== مكون الرسم البياني SVG ===================== */
function TrendChart({
  timeline,
  color,
}: {
  timeline: TimelineItem[];
  color: string;
}) {
  if (timeline.length === 0) return null;
  const maxCount = Math.max(1, ...timeline.map((t) => t.count));
  const width = 700;
  const height = 220;
  const padding = { top: 30, right: 30, bottom: 50, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = (chartWidth / timeline.length) * 0.6;
  const gap = (chartWidth / timeline.length) * 0.4;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", minWidth: 500, height: "auto" }}
      >
        {/* خطوط الشبكة */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padding.top + chartHeight * (1 - p);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
              >
                {Math.round(maxCount * p)}
              </text>
            </g>
          );
        })}

        {/* الأعمدة */}
        {timeline.map((t, i) => {
          const x = padding.left + i * (barWidth + gap) + gap / 2;
          const barH = (t.count / maxCount) * chartHeight;
          const y = padding.top + chartHeight - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                rx="6"
                ry="6"
                opacity="0.85"
              >
                <title>{`${t.label}: ${t.count} استجابة`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#334155"
              >
                {t.count}
              </text>
              <text
                x={x + barWidth / 2}
                y={padding.top + chartHeight + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
              >
                {t.label}
              </text>
              {t.avg > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartHeight + 33}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={color}
                >
                  ★ {t.avg.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}

        {/* محور X */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight}
          stroke="#cbd5e1"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

/* ===================== الأنماط ===================== */
const styles: Record<string, React.CSSProperties> = {
  main: {
    fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif",
    direction: "rtl",
    textAlign: "right",
    background: "#f8fafc",
    color: "#1e293b",
    padding: 30,
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
  spinner: {
    width: 48,
    height: 48,
    border: "5px solid #e2e8f0",
    borderTop: "5px solid #0d9488",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #e2e8f0",
    paddingBottom: 24,
    marginBottom: 28,
    flexWrap: "wrap",
    gap: 16,
  },
  h1: { fontSize: 28, fontWeight: 800, margin: "6px 0 4px", color: "#0f172a" },
  h2: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#0f172a" },
  h3: {
    fontSize: 14,
    fontWeight: 700,
    color: "#334155",
    margin: "0 0 12px",
    paddingBottom: 8,
    borderBottom: "1px solid #f1f5f9",
  },
  badge: {
    background: "#f0fdfa",
    color: "#0d9488",
    padding: "4px 12px",
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid #ccfbf1",
    display: "inline-block",
  },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  subtext: { fontSize: 13, color: "#64748b", margin: "0 0 18px" },
  btnOutline: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#334155",
    padding: "10px 18px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff",
    padding: "16px 22px",
    borderRadius: 16,
    boxShadow: "0 4px 6px -1px rgba(0,0,0,.04)",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 14,
  },
  filterGroup: { display: "flex", alignItems: "center", gap: 10 },
  select: {
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: 13,
    color: "#1e293b",
    cursor: "pointer",
  },
  btnPrimary: {
    background: "#0d9488",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDark: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
  },
  alert: {
    background: "#fef2f2",
    border: "1px solid #fee2e2",
    color: "#b91c1c",
    padding: 14,
    borderRadius: 10,
    marginBottom: 24,
    fontWeight: 600,
  },
  panel: {
    background: "#fff",
    borderRadius: 20,
    padding: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,.02)",
    marginBottom: 24,
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  compareCard: {
    border: "1px solid #e2e8f0",
    padding: 20,
    borderRadius: 16,
  },
  compareTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  countBadge: {
    background: "#f1f5f9",
    color: "#475569",
    padding: "2px 10px",
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 700,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    background: "#e2e8f0",
    borderRadius: 9999,
    overflow: "hidden",
    margin: "8px 0",
  },
  progressFill: { height: "100%", borderRadius: 9999 },
  splitGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 28,
    marginBottom: 24,
  },
  reportBlock: {
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    padding: 28,
    boxShadow: "0 4px 6px -1px rgba(0,0,0,.01)",
  },
  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #f1f5f9",
    paddingBottom: 16,
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  scoreCard: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    background: "#f8fafc",
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid #f1f5f9",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
    marginBottom: 24,
  },
  kpiCard: {
    background: "#f8fafc",
    border: "1px solid #f1f5f9",
    padding: 14,
    borderRadius: 12,
    textAlign: "center",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#64748b",
    display: "block",
    marginBottom: 4,
    fontWeight: 600,
  },
  kpiValue: { fontSize: 20, color: "#1e293b", fontWeight: 800 },
  analysisGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 20,
    marginBottom: 20,
  },
  subPanel: {
    background: "#fafbfc",
    border: "1px solid #f1f5f9",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  metricRow: {
    background: "#fff",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  metricInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  sectionTag: {
    background: "#f1f5f9",
    color: "#475569",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
  },
  barRow: { display: "flex", alignItems: "center", gap: 12 },
  trackMini: {
    flexGrow: 1,
    height: 8,
    background: "#f1f5f9",
    borderRadius: 9999,
    overflow: "hidden",
  },
  fillMini: { height: "100%", borderRadius: 9999 },
  insightItem: (type: "positive" | "improvement" | "recommendation"): React.CSSProperties => ({
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    background:
      type === "positive"
        ? "#f0fdf4"
        : type === "improvement"
        ? "#fffbeb"
        : "#f0f9ff",
    border:
      type === "positive"
        ? "1px solid #dcfce7"
        : type === "improvement"
        ? "1px solid #fef3c7"
        : "1px solid #e0f2fe",
  }),
  commentsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  quote: {
    background: "#fff",
    padding: "14px 16px",
    borderRadius: 12,
    boxShadow: "0 2px 4px rgba(0,0,0,.01)",
    margin: 0,
    position: "relative",
  },
  quoteMark: {
    fontSize: 26,
    color: "#cbd5e1",
    position: "absolute",
    top: 4,
    right: 12,
    lineHeight: 1,
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 30,
    paddingTop: 20,
    borderTop: "1px solid #e2e8f0",
  },
};

const styles_css = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@media (min-width: 1024px) {
  .split-grid-responsive { grid-template-columns: 1fr 1fr !important; }
  .analysis-grid-responsive { grid-template-columns: 1.2fr 1fr !important; }
  .comments-grid-responsive { grid-template-columns: 1fr 1fr !important; }
}
@media print {
  .no-print { display: none !important; }
}
`;
