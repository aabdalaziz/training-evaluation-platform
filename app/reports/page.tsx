"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

type Ev = { id: string; kind: string; overall_rating: number | null; submitted_at: string };
type An = { evaluation_id: string; question_id: string; rating_value: number | null; text_value: string | null };
type Qu = { id: string; text_ar: string; section_ar: string | null };
type Ax = { label: string; section: string; value: number };
type Rep = { count: number; avg: number; axes: Ax[]; comments: string[] };

const NAVY = "#0f172a";
const TEAL = "#0d9488";
const BLUE = "#2563eb";

function statusOf(v: number): { t: string; bg: string; fg: string } {
  if (v >= 4) return { t: "ممتاز", bg: "#dcfce7", fg: "#15803d" };
  if (v >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "يحتاج تحسين", bg: "#fee2e2", fg: "#b91c1c" };
}

function verdict(avg: number): { t: string; c: string } {
  if (avg >= 4) return { t: "أداء متميز يفوق التوقعات", c: "#15803d" };
  if (avg >= 3) return { t: "أداء جيد مع فرص للتحسين", c: "#b45309" };
  if (avg > 0) return { t: "أداء دون المستوى ويحتاج خطة معالجة", c: "#b91c1c" };
  return { t: "لا توجد بيانات كافية للحكم", c: "#64748b" };
}

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Ev[]>([]);
  const [ans, setAns] = useState<An[]>([]);
  const [qs, setQs] = useState<Qu[]>([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const db = supabase();
        const s = await db.auth.getSession();
        if (!s.data || !s.data.session) { if (on) setErr("انتهت الجلسة، سجّل الدخول من جديد."); return; }
        const e = await db.from("evaluations").select("id,kind,overall_rating,submitted_at").order("submitted_at", { ascending: false });
        if (e.error) throw new Error(e.error.message);
        const ids = (e.data || []).map((x) => x.id);
        const a = ids.length ? await db.from("evaluation_answers").select("evaluation_id,question_id,rating_value,text_value").in("evaluation_id", ids) : { data: [] as An[] };
        const qids = Array.from(new Set((a.data || []).map((x) => x.question_id)));
        const q = qids.length ? await db.from("questions").select("id,text_ar,section_ar").in("id", qids) : { data: [] as Qu[] };
        if (!on) return;
        setRows(e.data || []); setAns(a.data || []); setQs(q.data || []);
      } catch (x: unknown) { if (on) setErr(x instanceof Error ? x.message : "خطأ في التحميل"); }
      finally { if (on) setLoad(false); }
    })();
    return () => { on = false; };
  }, []);

  const calc = (kind: string): Rep => {
    const list = rows.filter((r) => r.kind === kind);
    const ids = new Set(list.map((r) => r.id));
    const qm: any = {}; qs.forEach((q) => { qm[q.id] = q; });
    const avg = (a: number[]) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0);
    const g: any = {};
    ans.forEach((a) => { if (ids.has(a.evaluation_id) && a.rating_value != null) { const v = Number(a.rating_value); if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); } } });
    const axes: Ax[] = Object.keys(g).map((id) => ({ label: qm[id] ? qm[id].text_ar : "سؤال", section: qm[id] && qm[id].section_ar ? qm[id].section_ar : "عام", value: avg(g[id]) }));
    axes.sort((a, b) => a.value - b.value);
    const all = list.map((r) => Number(r.overall_rating)).filter((v) => !isNaN(v) && v > 0);
    const comments: string[] = [];
    ans.forEach((a) => { if (ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 6) comments.push(a.text_value.trim()); });
    return { count: list.length, avg: avg(all), axes: axes, comments: comments };
  };

  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  const tabs = [{ id: "overview", t: "نظرة عامة" }, { id: "daily", t: "التقرير اليومي" }, { id: "final", t: "التقرير النهائي" }];

  if (load) return (<div style={S.wrap}><div style={S.loadBox}>جارٍ إعداد التقرير التنفيذي...</div></div>);

  return (
    <div style={S.wrap}>
      <div style={S.hero}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={S.heroBadge}>تقرير الأداء التنفيذي</span>
            <h1 style={S.heroH1}>التقارير التحليلية الاستراتيجية</h1>
            <p style={S.heroP}>فصل كامل بين التقييم اليومي والنهائي مع مؤشرات أداء وتوصيات ذكية</p>
          </div>
          <button style={S.heroBtn} onClick={() => router.push("/dashboard")}>لوحة التحكم</button>
        </div>
      </div>

      {err ? <div style={S.err}>{err}</div> : null}

      <div style={S.tabBar} className="noprint">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)} style={tab === tb.id ? S.tabOn : S.tabOff}>{tb.t}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={S.ghost} onClick={() => window.print()}>طباعة</button>
      </div>

      {tab === "overview" ? <Overview daily={daily} final={final} /> : null}
      {tab === "daily" ? <ReportView rep={daily} color={BLUE} name="التقرير اليومي" sub="تحليل جلسات التدريب اليومية وتفاعل المشاركين" /> : null}
      {tab === "final" ? <ReportView rep={final} color={TEAL} name="التقرير النهائي" sub="قياس رضا المشاركين عن البرنامج التدريبي كاملاً" /> : null}

      <div style={S.foot}>منصة تقييم التدريب - تقرير تنفيذي 2026</div>
    </div>
  );
}

function Overview(p: { daily: Rep; final: Rep }) {
  const d = p.daily; const f = p.final;
  const max = Math.max(5, d.avg, f.avg);
  return (
    <div>
      <div style={S.grid2}>
        <SumCard title="التقييم اليومي" rep={d} color={BLUE} />
        <SumCard title="التقييم النهائي" rep={f} color={TEAL} />
      </div>
      <div style={S.card}>
        <h2 style={S.h2}>مقارنة الأداء العام</h2>
        <div style={S.chartWrap}>
          <svg viewBox="0 0 400 200" style={{ width: "100%", maxWidth: 460, height: "auto" }}>
            {[0, 0.5, 1].map((fr, i) => { const y = 20 + 140 * (1 - fr); return (<g key={i}><line x1={50} y1={y} x2={380} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" /><text x={42} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{(max * fr).toFixed(1)}</text></g>); })}
            <Bar x={110} val={d.avg} max={max} color={BLUE} label="اليومي" />
            <Bar x={250} val={f.avg} max={max} color={TEAL} label="النهائي" />
            <line x1={50} y1={160} x2={380} y2={160} stroke="#cbd5e1" strokeWidth={1.5} />
          </svg>
        </div>
        <div style={S.compareTable}>
          <div style={S.ctHead}><span>المؤشر</span><span style={{ color: BLUE }}>اليومي</span><span style={{ color: TEAL }}>النهائي</span></div>
          <div style={S.ctRow}><span>عدد الاستجابات</span><b>{d.count}</b><b>{f.count}</b></div>
          <div style={S.ctRow}><span>متوسط الرضا</span><b>{d.avg ? d.avg.toFixed(2) : "-"}</b><b>{f.avg ? f.avg.toFixed(2) : "-"}</b></div>
          <div style={S.ctRow}><span>نسبة الرضا</span><b>{d.avg ? Math.round((d.avg / 5) * 100) + "%" : "-"}</b><b>{f.avg ? Math.round((f.avg / 5) * 100) + "%" : "-"}</b></div>
          <div style={S.ctRow}><span>المحاور المقاسة</span><b>{d.axes.length}</b><b>{f.axes.length}</b></div>
        </div>
      </div>
    </div>
  );
}

function Bar(p: { x: number; val: number; max: number; color: string; label: string }) {
  const h = p.max > 0 ? (p.val / p.max) * 140 : 0;
  const y = 160 - h;
  return (<g><rect x={p.x} y={y} width={60} height={h} fill={p.color} rx={8} opacity={0.9} /><text x={p.x + 30} y={y - 8} textAnchor="middle" fontSize="14" fontWeight="800" fill="#0f172a">{p.val ? p.val.toFixed(2) : "-"}</text><text x={p.x + 30} y={180} textAnchor="middle" fontSize="12" fill="#475569">{p.label}</text></g>);
}

function SumCard(p: { title: string; rep: Rep; color: string }) {
  const pct = Math.min(100, Math.round((p.rep.avg / 5) * 100) || 0);
  const v = verdict(p.rep.avg);
  return (
    <div style={{ ...S.card, borderTop: "4px solid " + p.color }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 16, color: p.color }}>{p.title}</b><span style={S.pill}>{p.rep.count} استجابة</span></div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "10px 0" }}><span style={{ fontSize: 40, fontWeight: 800, color: NAVY }}>{p.rep.avg ? p.rep.avg.toFixed(2) : "-"}</span><span style={{ fontSize: 15, color: "#94a3b8" }}>/5</span></div>
      <div style={S.track}><div style={{ width: pct + "%", height: "100%", background: p.color, borderRadius: 8 }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}><span style={{ fontSize: 13, color: "#64748b" }}>معدل الرضا {pct}%</span><span style={{ ...S.statusPill, background: v.c + "22", color: v.c }}>{v.t}</span></div>
    </div>
  );
}

function ReportView(p: { rep: Rep; color: string; name: string; sub: string }) {
  const r = p.rep;
  const pct = r.avg ? Math.round((r.avg / 5) * 100) : 0;
  const v = verdict(r.avg);
  const top = r.axes.length ? r.axes[r.axes.length - 1] : null;
  const low = r.axes.length ? r.axes[0] : null;
  return (
    <div>
      <div style={{ ...S.card, borderRight: "6px solid " + p.color, background: "linear-gradient(180deg,#ffffff,#fbfdff)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div><h2 style={{ ...S.h2, color: p.color, margin: 0 }}>{p.name}</h2><p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>{p.sub}</p></div>
          <div style={S.scoreBox}><span style={{ fontSize: 34, fontWeight: 800, color: NAVY }}>{r.avg ? r.avg.toFixed(2) : "-"}</span><span style={{ fontSize: 13, color: "#94a3b8" }}>/5</span></div>
        </div>
      </div>

      <div style={S.kpiGrid}>
        <Kpi label="إجمالي الاستجابات" value={String(r.count)} color={p.color} />
        <Kpi label="نسبة الرضا العامة" value={pct + "%"} color={p.color} />
        <Kpi label="المحاور المقاسة" value={String(r.axes.length)} color={p.color} />
      </div>

      <div style={{ ...S.card, background: v.c + "11", border: "1px solid " + v.c + "33" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>الحكم التنفيذي</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: v.c }}>{v.t}</div>
      </div>

      {r.axes.length > 0 ? (
        <>
          <div style={S.card}>
            <h3 style={S.h3}>نتائج المحاور التفصيلية</h3>
            {r.axes.map((a, i) => { const st = statusOf(a.value); return (
              <div key={i} style={S.axisRow}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={S.secTag}>{a.section}</span><span style={{ fontSize: 13.5, color: "#1e293b", fontWeight: 600 }}>{a.label}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ ...S.statusPill, background: st.bg, color: st.fg }}>{st.t}</span><b style={{ minWidth: 48, textAlign: "left", color: NAVY }}>{a.value.toFixed(2)}</b></div>
                </div>
                <div style={S.track}><div style={{ width: (a.value / 5) * 100 + "%", height: "100%", background: p.color, borderRadius: 8 }} /></div>
              </div>
            ); })}
          </div>

          <div style={S.grid2}>
            <div style={S.card}>
              <h3 style={S.h3}>التحليل والتوصيات</h3>
              <div style={{ ...S.insight, background: "#f0fdf4", borderColor: "#bbf7d0" }}><b style={{ color: "#15803d" }}>نقطة القوة</b><p style={S.insP}>{top ? top.label + " (" + top.value.toFixed(2) + "/5)" : "-"}</p></div>
              <div style={{ ...S.insight, background: "#fffbeb", borderColor: "#fde68a" }}><b style={{ color: "#b45309" }}>مجال التطوير</b><p style={S.insP}>{low ? low.label + " (" + low.value.toFixed(2) + "/5)" : "-"}</p></div>
              <div style={{ ...S.insight, background: "#eff6ff", borderColor: "#bfdbfe" }}><b style={{ color: "#1d4ed8" }}>التوصية</b><p style={S.insP}>{low ? "نوصي بتخصيص وقت إضافي لتعزيز محور \"" + low.label + "\" في الجلسات القادمة، ثم إعادة قياسه." : "-"}</p></div>
            </div>
            <div style={S.card}>
              <h3 style={S.h3}>ملاحظات المشاركين</h3>
              {r.comments.length > 0 ? r.comments.map((c, i) => (<div key={i} style={{ ...S.quote, borderRight: "3px solid " + p.color }}>{c}</div>)) : <p style={{ color: "#94a3b8", fontSize: 13 }}>لا توجد ملاحظات نصية مسجلة.</p>}
            </div>
          </div>
        </>
      ) : (<div style={S.card}><p style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>لا توجد بيانات لهذا التقرير بعد.</p></div>)}
    </div>
  );
}

function Kpi(p: { label: string; value: string; color: string }) {
  return (
    <div style={S.kpiCard}>
      <div style={{ ...S.kpiDot, background: p.color }} />
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{p.label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: NAVY }}>{p.value}</div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { direction: "rtl", fontFamily: "Cairo, Tahoma, sans-serif", background: "#f1f5f9", minHeight: "100vh", padding: 20, color: "#1e293b" },
  loadBox: { textAlign: "center", padding: 60, color: "#64748b", fontWeight: 600 },
  hero: { background: "linear-gradient(135deg,#0f172a,#0d9488)", borderRadius: 20, padding: 24, color: "#fff", marginBottom: 18, boxShadow: "0 10px 25px rgba(15,23,42,.18)" },
  heroBadge: { background: "rgba(255,255,255,.15)", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 },
  heroH1: { fontSize: 26, fontWeight: 800, margin: "8px 0 4px" },
  heroP: { fontSize: 13, margin: 0, color: "#e2e8f0" },
  heroBtn: { background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontWeight: 700 },
  err: { background: "#fef2f2", color: "#b91c1c", padding: 12, borderRadius: 12, marginBottom: 16, border: "1px solid #fecaca" },
  tabBar: { display: "flex", gap: 8, background: "#fff", padding: 8, borderRadius: 14, marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,.04)", flexWrap: "wrap", alignItems: "center" },
  tabOn: { background: NAVY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  tabOff: { background: "transparent", color: "#475569", border: "none", borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  ghost: { background: "#f1f5f9", color: "#334155", border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: "0 2px 10px rgba(0,0,0,.03)" },
  h2: { fontSize: 18, fontWeight: 800, margin: "0 0 14px", color: NAVY },
  h3: { fontSize: 15, fontWeight: 800, margin: "0 0 14px", color: NAVY },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  pill: { background: "#f1f5f9", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700, color: "#475569" },
  track: { background: "#e2e8f0", borderRadius: 8, height: 9, overflow: "hidden", width: "100%" },
  statusPill: { borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 800 },
  chartWrap: { display: "flex", justifyContent: "center", padding: "6px 0 14px" },
  compareTable: { border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden" },
  ctHead: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#f8fafc", padding: "10px 14px", fontWeight: 800, fontSize: 13 },
  ctRow: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 14px", borderTop: "1px solid #eef2f7", fontSize: 13, alignItems: "center" },
  scoreBox: { background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 14, padding: "8px 18px", display: "flex", alignItems: "baseline", gap: 4 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 },
  kpiCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, textAlign: "center", position: "relative", boxShadow: "0 2px 10px rgba(0,0,0,.03)" },
  kpiDot: { width: 10, height: 10, borderRadius: 999, position: "absolute", top: 14, left: 14 },
  axisRow: { background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 12, padding: 12, marginBottom: 10 },
  secTag: { background: "#e2e8f0", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, color: "#475569" },
  insight: { border: "1px solid", borderRadius: 12, padding: 12, marginBottom: 10 },
  insP: { margin: "4px 0 0", fontSize: 13, color: "#334155", lineHeight: 1.6 },
  quote: { background: "#f8fafc", borderRadius: 10, padding: 11, marginBottom: 8, fontSize: 13, color: "#475569", lineHeight: 1.6 },
  foot: { textAlign: "center", fontSize: 12, color: "#94a3b8", padding: "18px 0 6px" }
};
