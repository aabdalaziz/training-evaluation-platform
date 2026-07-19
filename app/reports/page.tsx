"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

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
type Question = { id: string; text_ar: string; section_ar: string | null };
type AxisItem = { label: string; section: string; value: number };
type TimelineItem = { label: string; count: number; avg: number };
type ReportData = {
  count: number;
  avg: number;
  axes: AxisItem[];
  comments: string[];
  timeline: TimelineItem[];
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
@keyframes repspin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.rep-wrap *{font-family:'Cairo','Segoe UI',Tahoma,sans-serif;box-sizing:border-box}
@media(min-width:1024px){.rep-split{grid-template-columns:1fr 1fr!important}.rep-analysis{grid-template-columns:1.2fr 1fr!important}.rep-comments{grid-template-columns:1fr 1fr!important}}
@media print{.rep-noprint{display:none!important}.rep-card{box-shadow:none!important;border:1px solid #cbd5e1!important}}
`;

function insightStyle(type: string): CSSProperties {
  if (type === "positive")
    return { background: "#f0fdf4", border: "1px solid #dcfce7" };
  if (type === "improvement")
    return { background: "#fffbeb", border: "1px solid #fef3c7" };
  return { background: "#f0f9ff", border: "1px solid #e0f2fe" };
}

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<string>("all");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const db = supabase();
        const s = await db.auth.getSession();
        if (!s.data?.session) {
          if (mounted) setError("انتهت جلسة الدخول. سجّل الدخول من جديد.");
          return;
        }
        const e = await db
          .from("evaluations")
          .select("id,kind,overall_rating,submitted_at,program_id")
          .order("submitted_at", { ascending: false });
        if (e.error) throw new Error(e.error.message);
        const ids = (e.data || []).map((x) => x.id);
        const a = ids.length
          ? await db
              .from("evaluation_answers")
              .select("evaluation_id,question_id,rating_value,text_value")
              .in("evaluation_id", ids)
          : { data: [] as Answer[] };
        const qids = Array.from(new Set((a.data || []).map((x) => x.question_id)));
        const q = qids.length
          ? await db.from("questions").select("id,text_ar,section_ar").in("id", qids)
          : { data: [] as Question[] };
        if (!mounted) return;
        setRows(e.data || []);
        setAnswers(a.data || []);
        setQuestions(q.data || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "خطأ أثناء تحميل البيانات";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (period === "all") return rows;
    const days = period === "7" ? 7 : 30;
    const cut = Date.now() - days * 86400000;
    return rows.filter((r) => new Date(r.submitted_at).getTime() >= cut);
  }, [rows, period]);

  const calc = (kind: "DAILY" | "FINAL"): ReportData => {
    const list: Evaluation[] = [];
    for (const r of filtered) if (r.kind === kind) list.push(r);
    const idSet = new Set(list.map((r) => r.id));
    const qmap: Record<string, Question> = {};
    for (const q of questions) qmap[q.id] = q;
    const avgOf = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const grouped: Record<string, number[]> = {};
    for (const a of answers) {
      if (!idSet.has(a.evaluation_id)) continue;
      if (a.rating_value === null || a.rating_value === undefined) continue;
      const v = Number(a.rating_value);
      if (Number.isNaN(v)) continue;
      if (!grouped[a.question_id]) grouped[a.question_id] = [];
      grouped[a.question_id].push(v);
    }
    const axes: AxisItem[] = Object.keys(grouped).map((id) => ({
      label: qmap[id]?.text_ar || "سؤال",
      section: qmap[id]?.section_ar || "عام",
      value: avgOf(grouped[id]),
    }));
    axes.sort((a, b) => a.value - b.value);

    const byDate: Record<string, { n: number; r: number[] }> = {};
    for (const r of list) {
      const k = new Date(r.submitted_at).toLocaleDateString("ar-SA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!byDate[k]) byDate[k] = { n: 0, r: [] };
      byDate[k].n += 1;
      if (r.overall_rating !== null && r.overall_rating !== undefined) {
        const ov = Number(r.overall_rating);
        if (!Number.isNaN(ov)) byDate[k].r.push(ov);
      }
    }
    const timeline: TimelineItem[] = Object.keys(byDate)
      .map((k) => ({ label: k, count: byDate[k].n, avg: avgOf(byDate[k].r) }))
      .slice(-8);

    const comments: string[] = [];
    for (const a of answers) {
      if (!idSet.has(a.evaluation_id)) continue;
      const t = (a.text_value || "").trim();
      if (t) {
        comments.push(t);
        if (comments.length >= 8) break;
      }
    }
    const all: number[] = [];
    for (const r of list) {
      if (r.overall_rating !== null && r.overall_rating !== undefined) {
        const v = Number(r.overall_rating);
        if (!Number.isNaN(v)) all.push(v);
      }
    }
    return { count: list.length, avg: avgOf(all), axes, comments, timeline };
  };

  const daily = useMemo(() => calc("DAILY"), [filtered, answers, questions]);
  const final = useMemo(() => calc("FINAL"), [filtered, answers, questions]);

  const exportCSV = () => {
    const lines = ["نوع التقييم,المحور,القسم,المتوسط"];
    daily.axes.forEach((x) =>
      lines.push('يومي,"' + x.label + '","' + x.section + '",' + x.value.toFixed(2))
    );
    final.axes.forEach((x) =>
      lines.push('نهائي,"' + x.label + '","' + x.section + '",' + x.value.toFixed(2))
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "separated-report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="rep-wrap" style={S.main}>
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
        <div style={S.center}>
          <div style={S.spinner} />
          <p>جارٍ إعداد التقارير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rep-wrap" style={S.main}>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />

      <header style={S.header} className="rep-noprint">
        <div>
          <span style={S.badge}>تقرير الأداء المطور</span>
          <h1 style={S.h1}>📑 التقارير الاستراتيجية والتحليلية</h1>
          <p style={S.sub}>فصل كامل بين اليومي والنهائي مع رسوم بيانية وتوصيات ذكية</p>
        </div>
        <button style={S.btnOut} onClick={() => router.push("/dashboard")}>
          ← لوحة التحكم
        </button>
      </header>

      <div style={S.toolbar} className="rep-noprint">
        <div style={S.fgroup}>
          <label style={{ fontWeight: 700, fontSize: 13, color: "#475569" }}>الفترة:</label>
          <select style={S.sel} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">كل البيانات</option>
            <option value="7">آخر 7 أيام</option>
            <option value="30">آخر 30 يوماً</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnP} onClick={exportCSV}>📊 تصدير CSV</button>
          <button style={S.btnD} onClick={() => window.print()}>🖨 طباعة PDF</button>
        </div>
      </div>

      {error ? <div style={S.alert}>⚠️ {error}</div> : null}

      <section style={S.panel} className="rep-card">
        <h2 style={S.h2}>⚖️ مقارنة الأداء (يومي مقابل نهائي)</h2>
        <p style={S.sub2}>مقارنة بصرية لمعدلات الرضا وإجمالي الاستجابات</p>
        <div style={S.cgrid}>
          <CmpCard title="التقييم اليومي" count={daily.count} avg={daily.avg} color="#2563eb" bg="#eff6ff" />
          <CmpCard title="التقييم النهائي" count={final.count} avg={final.avg} color="#0d9488" bg="#f0fdfa" />
        </div>
        {daily.count === 0 && final.count === 0 ? (
          <p style={{ textAlign: "center", color: "#64748b", marginTop: 16 }}>
            لا توجد بيانات بعد. أرسل استبيانات لتظهر النتائج.
          </p>
        ) : null}
      </section>

      <div className="rep-split" style={S.split}>
        <Block title="📝 التقرير اليومي" sub="تحليل جلسات التدريب اليومية" data={daily} accent="#2563eb" bg="#eff6ff" />
        <Block title="🏁 التقرير النهائي" sub="رضا المشاركين عن البرنامج كاملاً" data={final} accent="#0d9488" bg="#f0fdfa" />
      </div>

      <footer style={S.footer}>منصة تقييم التدريب © 2026</footer>
    </div>
  );
}

function CmpCard(p: { title: string; count: number; avg: number; color: string; bg: string }) {
  const pct = Math.min(100, Math.round((p.avg / 5) * 100) || 0);
  return (
    <div style={{ ...S.ccard, background: p.bg }}>
      <div style={S.ctop}>
        <b style={{ fontSize: 15, color: "#334155" }}>{p.title}</b>
        <span style={S.cbadge}>{p.count} استجابة</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0" }}>
        <strong style={{ fontSize: 36, fontWeight: 800, color: "#0f172a" }}>
          {p.avg ? p.avg.toFixed(2) : "—"}
        </strong>
        <small style={{ fontSize: 16, color: "#64748b" }}>/5</small>
      </div>
      <div style={S.track}>
        <div style={{ ...S.fill, width: pct + "%", background: p.color }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>نسبة الرضا: {pct}%</span>
    </div>
  );
}

function Block(p: { title: string; sub: string; data: ReportData; accent: string; bg: string }) {
  const d = p.data;
  const pct = d.avg ? Math.round((d.avg / 5) * 100) : 0;
  const top = d.axes.length ? d.axes[d.axes.length - 1] : null;
  const low = d.axes.length ? d.axes[0] : null;
  return (
    <section className="rep-card" style={{ ...S.block, borderRight: "6px solid " + p.accent }}>
      <div style={S.bhead}>
        <div>
          <h2 style={{ ...S.h2, color: p.accent }}>{p.title}</h2>
          <p style={S.sub2}>{p.sub}</p>
        </div>
        <div style={S.score}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>
            {d.avg ? d.avg.toFixed(2) : "—"}
          </span>
          <small style={{ fontSize: 14, color: "#64748b" }}>/5</small>
        </div>
      </div>

      <div style={S.kpi}>
        <div style={S.kpic}><span style={S.kl}>الاستجابات</span><b style={S.kv}>{d.count}</b></div>
        <div style={S.kpic}><span style={S.kl}>نسبة الرضا</span><b style={{ ...S.kv, color: p.accent }}>{pct}%</b></div>
        <div style={S.kpic}><span style={S.kl}>المحاور</span><b style={S.kv}>{d.axes.length}</b></div>
      </div>

      {d.axes.length > 0 ? (
        <>
          <div className="rep-analysis" style={S.agrid}>
            <div style={S.subp}>
              <h3 style={S.h3}>📊 نتائج المحاور</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.axes.map((ax, i) => (
                  <div key={i} style={S.mrow}>
                    <div style={S.minfo}>
                      <span style={S.tag}>{ax.section}</span>
                      <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{ax.label}</span>
                    </div>
                    <div style={S.brow}>
                      <div style={S.tmini}>
                        <div style={{ ...S.fmini, width: (ax.value / 5) * 100 + "%", background: p.accent }} />
                      </div>
                      <strong style={{ fontSize: 13, color: "#0f172a", minWidth: 46, textAlign: "left" }}>
                        {ax.value.toFixed(2)}/5
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...S.subp, background: p.bg }}>
              <h3 style={S.h3}>🎯 التحليل الذكي</h3>
              <div style={{ ...S.ins, ...insightStyle("positive") }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <b style={{ fontSize: 12, color: "#1e293b" }}>الأعلى أداءً:</b>
                  <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                    {top ? top.label + " (" + top.value.toFixed(2) + "/5)" : "—"}
                  </p>
                </div>
              </div>
              <div style={{ ...S.ins, ...insightStyle("improvement") }}>
                <span style={{ fontSize: 18 }}>🎯</span>
                <div>
                  <b style={{ fontSize: 12, color: "#1e293b" }}>مجال التطوير:</b>
                  <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                    {low ? low.label + " (" + low.value.toFixed(2) + "/5)" : "—"}
                  </p>
                </div>
              </div>
              <div style={{ ...S.ins, ...insightStyle("recommendation") }}>
                <span style={{ fontSize: 18 }}>📌</span>
                <div>
                  <b style={{ fontSize: 12, color: "#1e293b" }}>التوصية:</b>
                  <p style={{ fontSize: 12, color: "#475569", margin: "2px 0 0" }}>
                    {low ? 'تعزيز المحور "' + low.label + '" في الجلسات القادمة.' : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {d.timeline.length > 0 ? (
            <div style={S.subp}>
              <h3 style={S.h3}>📈 اتجاه الاستجابات</h3>
              <Chart tl={d.timeline} color={p.accent} />
            </div>
          ) : null}

          <div style={S.subp}>
            <h3 style={S.h3}>💬 ملاحظات المشاركين</h3>
            {d.comments.length > 0 ? (
              <div className="rep-comments" style={S.cmts}>
                {d.comments.map((c, i) => (
                  <blockquote key={i} style={{ ...S.quote, borderRight: "4px solid " + p.accent }}>
                    <span style={S.qm}>“</span>
                    <p style={{ fontSize: 12.5, color: "#334155", margin: 0, lineHeight: 1.6 }}>{c}</p>
                  </blockquote>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#64748b" }}>لا توجد ملاحظات نصية.</p>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 30, color: "#64748b", fontWeight: 600 }}>
          ⚠️ لا توجد بيانات لهذا التقرير.
        </div>
      )}
    </section>
  );
}

function Chart(p: { tl: TimelineItem[]; color: string }) {
  const max = Math.max(1, ...p.tl.map((t) => t.count));
  const W = 700, H = 220, pt = 30, pr = 30, pb = 50, pl = 40;
  const cw = W - pl - pr, ch = H - pt - pb;
  const bw = (cw / p.tl.length) * 0.6, gp = (cw / p.tl.length) * 0.4;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", minWidth: 480, height: "auto" }}>
        {[0, 0.5, 1].map((f, i) => {
          const y = pt + ch * (1 - f);
          return (
            <g key={i}>
              <line x1={pl} y1={y} x2={W - pr} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
              <text x={pl - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.round(max * f)}</text>
            </g>
          );
        })}
        {p.tl.map((t, i) => {
          const x = pl + i * (bw + gp) + gp / 2;
          const bh = (t.count / max) * ch;
          const y = pt + ch - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={bh} fill={p.color} rx={6} opacity={0.85} />
              <text x={x + bw / 2} y={y - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">{t.count}</text>
              <text x={x + bw / 2} y={pt + ch + 18} textAnchor="middle" fontSize="9" fill="#475569">{t.label}</text>
              {t.avg > 0 ? (
                <text x={x + bw / 2} y={pt + ch + 32} textAnchor="middle" fontSize="9" fontWeight="700" fill={p.color}>{"★ " + t.avg.toFixed(1)}</text>
              ) : null}
            </g>
          );
        })}
        <line x1={pl} y1={pt + ch} x2={W - pr} y2={pt + ch} stroke="#cbd5e1" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  main: { direction: "rtl", textAlign: "right", background: "#f8fafc", color: "#1e293b", padding: 30, minHeight: "100vh" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" },
  spinner: { width: 48, height: 48, border: "5px solid #e2e8f0", borderTop: "5px solid #0d9488", borderRadius: "50%", animation: "repspin 1s linear infinite", marginBottom: 16 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: 24, marginBottom: 28, flexWrap: "wrap", gap: 16 },
  h1: { fontSize: 28, fontWeight: 800, margin: "6px 0 4px", color: "#0f172a" },
  h2: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#0f172a" },
  h3: { fontSize: 14, fontWeight: 700, color: "#334155", margin: "0 0 12px", paddingBottom: 8, borderBottom: "1px solid #eef2f7" },
  badge: { background: "#f0fdfa", color: "#0d9488", padding: "4px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 700, border: "1px solid #ccfbf1", display: "inline-block" },
  sub: { fontSize: 14, color: "#64748b", margin: 0 },
  sub2: { fontSize: 13, color: "#64748b", margin: "0 0 18px" },
  btnOut: { background: "#fff", border: "1px solid #cbd5e1", color: "#334155", padding: "10px 18px", borderRadius: 10, fontWeight: 600, cursor: "pointer" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "16px 22px", borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,.04)", marginBottom: 24, flexWrap: "wrap", gap: 14 },
  fgroup: { display: "flex", alignItems: "center", gap: 10 },
  sel: { border: "1px solid #cbd5e1", background: "#f8fafc", padding: "8px 12px", borderRadius: 8, fontSize: 13, color: "#1e293b", cursor: "pointer" },
  btnP: { background: "#0d9488", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer" },
  btnD: { background: "#0f172a", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 600, cursor: "pointer" },
  alert: { background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c", padding: 14, borderRadius: 10, marginBottom: 24, fontWeight: 600 },
  panel: { background: "#fff", borderRadius: 20, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,.02)", marginBottom: 24 },
  cgrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  ccard: { border: "1px solid #e2e8f0", padding: 20, borderRadius: 16 },
  ctop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cbadge: { background: "#f1f5f9", color: "#475569", padding: "2px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700 },
  track: { width: "100%", height: 10, background: "#e2e8f0", borderRadius: 9999, overflow: "hidden", margin: "8px 0" },
  fill: { height: "100%", borderRadius: 9999 },
  split: { display: "grid", gridTemplateColumns: "1fr", gap: 28, marginBottom: 24 },
  block: { background: "#fff", borderRadius: 24, border: "1px solid #e2e8f0", padding: 28, boxShadow: "0 4px 6px -1px rgba(0,0,0,.01)" },
  bhead: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 16, marginBottom: 20, flexWrap: "wrap", gap: 12 },
  score: { display: "flex", alignItems: "baseline", gap: 4, background: "#f8fafc", padding: "10px 16px", borderRadius: 12, border: "1px solid #f1f5f9" },
  kpi: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 },
  kpic: { background: "#f8fafc", border: "1px solid #f1f5f9", padding: 14, borderRadius: 12, textAlign: "center" },
  kl: { fontSize: 12, color: "#64748b", display: "block", marginBottom: 4, fontWeight: 600 },
  kv: { fontSize: 20, color: "#1e293b", fontWeight: 800 },
  agrid: { display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 },
  subp: { background: "#fafbfc", border: "1px solid #f1f5f9", borderRadius: 16, padding: 18, marginBottom: 20 },
  mrow: { background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0" },
  minfo: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  tag: { background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 },
  brow: { display: "flex", alignItems: "center", gap: 12 },
  tmini: { flexGrow: 1, height: 8, background: "#f1f5f9", borderRadius: 9999, overflow: "hidden" },
  fmini: { height: "100%", borderRadius: 9999 },
  ins: { display: "flex", gap: 10, padding: 10, borderRadius: 10, marginBottom: 8 },
  cmts: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  quote: { background: "#fff", padding: "14px 16px", borderRadius: 12, boxShadow: "0 2px 4px rgba(0,0,0,.01)", margin: 0, position: "relative" },
  qm: { fontSize: 26, color: "#cbd5e1", position: "absolute", top: 4, right: 12, lineHeight: 1 },
  footer: { textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 30, paddingTop: 20, borderTop: "1px solid #e2e8f0" },
};
