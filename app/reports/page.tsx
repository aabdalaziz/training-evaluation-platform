"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

type Ev = { id: string; kind: string; overall_rating: number | null; submitted_at: string };
type An = { evaluation_id: string; question_id: string; rating_value: number | null; text_value: string | null };
type Qu = { id: string; text_ar: string; section_ar: string | null };
type Ax = { label: string; section: string; value: number };
type Day = { wd: string; dt: string; count: number };
type Rep = { count: number; avg: number; axes: Ax[]; comments: string[]; dist: number[]; days: Day[]; sections: { name: string; value: number }[] };

const TEAL = "#10b981";
const DARK = "#0b1220";

const CSS = "@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:18px;align-items:flex-start}.side{width:262px;flex-shrink:0;background:linear-gradient(180deg,#0b1220,#070b14);border-radius:22px;padding:16px;position:sticky;top:16px;color:#fff}.content{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.kpi3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}@media(max-width:900px){.lay{flex-direction:column}.side{width:100%;position:static;display:flex;flex-direction:row;overflow-x:auto;gap:8px;align-items:center}.side .logo{display:none}.g2{grid-template-columns:1fr}.kpi3{grid-template-columns:1fr}}@media print{.side,.noprint{display:none!important}.lay{display:block}}";

function statusOf(v: number): { t: string; bg: string; fg: string } {
  if (v >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (v >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "يحتاج تحسين", bg: "#fee2e2", fg: "#b91c1c" };
}

function pad(n: number): string { return n < 10 ? "0" + n : "" + n; }

export default function ReportsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Ev[]>([]);
  const [ans, setAns] = useState<An[]>([]);
  const [qs, setQs] = useState<Qu[]>([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("daily");

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
      } catch (x: unknown) { if (on) setErr(x instanceof Error ? x.message : "خطأ"); }
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
    const dist = [0, 0, 0, 0, 0];
    list.forEach((r) => { const v = Math.round(Number(r.overall_rating)); if (v >= 1 && v <= 5) dist[v - 1] += 1; });
    const dayMap: any = {};
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); dayMap[key] = { wd: d.toLocaleDateString("ar-SA", { weekday: "long" }), dt: pad(d.getMonth() + 1) + "-" + pad(d.getDate()), count: 0 }; }
    list.forEach((r) => { const d = new Date(r.submitted_at); const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); if (dayMap[key]) dayMap[key].count += 1; });
    const days: Day[] = Object.keys(dayMap).map((k) => dayMap[k]);
    const secMap: any = {};
    axes.forEach((a) => { if (!secMap[a.section]) secMap[a.section] = { s: 0, n: 0 }; secMap[a.section].s += a.value; secMap[a.section].n += 1; });
    const sections = Object.keys(secMap).map((k) => ({ name: k, value: secMap[k].s / secMap[k].n })).sort((a, b) => b.value - a.value).slice(0, 4);
    const comments: string[] = [];
    ans.forEach((a) => { if (ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 6) comments.push(a.text_value.trim()); });
    const all = list.map((r) => Number(r.overall_rating)).filter((v) => !isNaN(v) && v > 0);
    return { count: list.length, avg: avg(all), axes: axes.sort((a, b) => a.value - b.value), comments: comments, dist: dist, days: days, sections: sections };
  };

  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);
  const total = rows.length;
  const cur = tab === "daily" ? daily : tab === "final" ? final : daily;
  const curName = tab === "daily" ? "التقرير اليومي" : tab === "final" ? "التقرير النهائي" : "نظرة شاملة";

  if (load) return (<div className="rw" style={{ background: "#f1ece1", minHeight: "100vh", padding: 40, textAlign: "center", color: "#64748b" }}><style dangerouslySetInnerHTML={{ __html: CSS }} />جارٍ بناء لوحة القيادة التنفيذية...</div>);

  return (
    <div className="rw" style={{ background: "#f1ece1", minHeight: "100vh", padding: 18, color: "#1a1a1a" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        <aside className="side">
          <div className="logo" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📋</div>
            <div><div style={{ fontWeight: 800, fontSize: 15 }}>منصة التقييم</div><div style={{ fontSize: 11, color: "#94a3b8" }}>النظام الموحّد</div></div>
          </div>
          <div style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 16, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#5eead4" }}>{total} تقييم متاح</div>
          <NavBtn on={tab === "overview"} onClick={() => setTab("overview")} icon="🏠" t="نظرة شاملة" />
          <NavBtn on={tab === "daily"} onClick={() => setTab("daily")} icon="📝" t="التقرير اليومي" />
          <NavBtn on={tab === "final"} onClick={() => setTab("final")} icon="⭐" t="التقرير النهائي" />
          <div style={{ marginTop: 18, borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 14 }}>
            <button onClick={() => router.push("/dashboard")} style={{ width: "100%", background: "transparent", border: "none", color: "#cbd5e1", cursor: "pointer", textAlign: "right", padding: "8px 10px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}>← لوحة التحكم</button>
          </div>
        </aside>

        <div className="content">
          {err ? <div style={{ background: "#fee2e2", color: "#b91c1c", padding: 12, borderRadius: 14, marginBottom: 14 }}>{err}</div> : null}

          <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0b1220,#111827)", borderRadius: 24, padding: 26, color: "#fff", marginBottom: 18 }}>
            <div style={{ position: "absolute", left: 18, top: 6, fontSize: 90, fontWeight: 900, color: "rgba(255,255,255,.04)", letterSpacing: 4 }}>REPORT</div>
            <div style={{ position: "relative" }}>
              <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 14px", textAlign: "center" }}>{tab === "overview" ? "لوحة القيادة التنفيذية" : "تقييم " + curName.replace("التقرير ", "")}</h1>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Pill>إجمالي البيانات المتاحة</Pill>
                <Pill>{new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" })}</Pill>
                <Pill>{curName}</Pill>
              </div>
            </div>
          </div>

          {tab === "overview" ? <Overview daily={daily} final={final} /> : <Report rep={cur} accent={tab === "daily" ? "#2563eb" : TEAL} />}
        </div>
      </div>
    </div>
  );
}

function NavBtn(p: { on: boolean; onClick: () => void; icon: string; t: string }) {
  return (<button onClick={p.onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", background: p.on ? "rgba(16,185,129,.15)" : "transparent", border: p.on ? "1px solid rgba(16,185,129,.5)" : "1px solid transparent", color: p.on ? "#5eead4" : "#cbd5e1", borderRadius: 12, padding: "11px 12px", marginBottom: 6, cursor: "pointer", fontWeight: p.on ? 800 : 600, fontSize: 14 }}><span>{p.t}</span><span>{p.icon}</span></button>);
}

function Pill(p: { children: any }) { return (<span style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 14px", fontSize: 12, color: "#e2e8f0" }}>{p.children}</span>); }

function Card(p: { children: any; style?: any }) { return (<div style={{ background: "#fffdf9", border: "1px solid #ece4d4", borderRadius: 20, padding: 20, boxShadow: "0 4px 14px rgba(60,40,10,.05)", ...p.style }}>{p.children}</div>); }

function Kpi(p: { label: string; value: string; suffix?: string; ghost: string }) {
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 12, top: 4, fontSize: 62, fontWeight: 900, color: "rgba(15,23,42,.05)" }}>{p.ghost}</div>
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#9a8f7d", fontWeight: 700, marginBottom: 6 }}>{p.label}</div>
        <div style={{ fontSize: 44, fontWeight: 900, color: "#111", lineHeight: 1 }}>{p.value}{p.suffix ? <span style={{ fontSize: 18, color: "#9a8f7d" }}>{p.suffix}</span> : null}</div>
      </div>
    </Card>
  );
}

function Report(p: { rep: Rep; accent: string }) {
  const r = p.rep;
  const pct = r.avg ? Math.round((r.avg / 5) * 100) : 0;
  const top = r.axes.length ? r.axes[r.axes.length - 1] : null;
  const low = r.axes.length ? r.axes[0] : null;
  const dColors = ["#f43f5e", "#fb923c", "#facc15", "#34d399", "#10b981"];
  const sColors = ["#14b8a6", "#0ea5e9", "#f59e0b", "#f43f5e"];
  const maxD = Math.max(1, ...r.days.map((d) => d.count));
  const maxDist = Math.max(1, ...r.dist);
  return (
    <div>
      <div className="kpi3" style={{ marginBottom: 16 }}>
        <Kpi label="إجمالي التقييمات" value={String(r.count)} ghost={String(r.count)} />
        <Kpi label="متوسط الرضا" value={r.avg ? r.avg.toFixed(1) : "-"} suffix="/5" ghost={r.avg ? r.avg.toFixed(1) : "-"} />
        <Kpi label="نسبة الرضا" value={String(pct)} suffix="%" ghost={String(pct)} />
      </div>

      <div className="g2" style={{ marginBottom: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>📊 التوزيع اليومي</h3><span style={{ background: "#d1fae5", color: "#047857", borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 800 }}>7 أيام</span></div>
          <svg viewBox="0 0 360 180" style={{ width: "100%", height: "auto" }}>
            <defs><linearGradient id={"g" + p.accent.slice(1)} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#0d9488" /></linearGradient></defs>
            {r.days.map((d, i) => { const bw = 360 / r.days.length; const x = i * bw + bw * 0.22; const w = bw * 0.56; const h = (d.count / maxD) * 120; const y = 140 - h; return (<g key={i}><text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{d.count}</text><rect x={x} y={y} width={w} height={Math.max(4, h)} rx={6} fill={"url(#g" + p.accent.slice(1) + ")"} /><text x={x + w / 2} y={156} textAnchor="middle" fontSize="9" fill="#64748b">{d.wd}</text><text x={x + w / 2} y={170} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.dt}</text></g>); })}
          </svg>
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>🎯 توزيع التقييم العام</h3>
          {[5, 4, 3, 2, 1].map((star) => { const idx = star - 1; const w = (r.dist[idx] / maxDist) * 100; return (
            <div key={star} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 64, fontSize: 12, fontWeight: 700, color: "#475569" }}>{star} نجوم</span>
              <div style={{ flex: 1, height: 12, background: "#f0e9db", borderRadius: 8, overflow: "hidden" }}><div style={{ width: w + "%", height: "100%", background: dColors[idx], borderRadius: 8 }} /></div>
              <b style={{ width: 24, textAlign: "left", color: "#111" }}>{r.dist[idx]}</b>
            </div>
          ); })}
        </Card>
      </div>

      <div className="g2" style={{ marginBottom: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>⚖️ مقارنة محاور التقييم</h3>
          {r.sections.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(r.sections.length, 2) + ",1fr)", gap: 12 }}>{r.sections.map((s, i) => (<div key={i} style={{ background: "#fff", border: "1px solid #ece4d4", borderRadius: 14, padding: 14, textAlign: "center" }}><div style={{ fontSize: 12, color: "#9a8f7d", fontWeight: 700, marginBottom: 6 }}>{s.name}</div><div style={{ fontSize: 30, fontWeight: 900, color: sColors[i % sColors.length] }}>{s.value.toFixed(1)}</div></div>))}</div> : <p style={{ color: "#9a8f7d" }}>لا توجد أقسام.</p>}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>💡 التحليل والتوصيات</h3>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: 12, marginBottom: 10 }}><b style={{ color: "#047857" }}>نقطة القوة</b><p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155" }}>{top ? top.label + " (" + top.value.toFixed(2) + "/5)" : "-"}</p></div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 12, marginBottom: 10 }}><b style={{ color: "#b45309" }}>مجال التطوير</b><p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155" }}>{low ? low.label + " (" + low.value.toFixed(2) + "/5)" : "-"}</p></div>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 12 }}><b style={{ color: "#1d4ed8" }}>التوصية</b><p style={{ margin: "4px 0 0", fontSize: 13, color: "#334155" }}>{low ? "تخصيص وقت إضافي لتعزيز \"" + low.label + "\" في الجلسات القادمة ثم إعادة قياسه." : "-"}</p></div>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>📈 أداء المحاور التفصيلي</h3>
        {r.axes.length > 0 ? r.axes.map((a, i) => { const st = statusOf(a.value); return (
          <div key={i} style={{ background: "#fff", border: "1px solid #f0e9db", borderRadius: 14, padding: 13, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ background: "#f0e9db", color: "#7c6f5a", borderRadius: 7, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{a.section}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a1a" }}>{a.label}</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 800 }}>{st.t}</span><b style={{ minWidth: 50, textAlign: "left", color: p.accent, fontSize: 15 }}>{a.value.toFixed(2)}/5</b></div>
            </div>
            <div style={{ height: 10, background: "#f0e9db", borderRadius: 8, overflow: "hidden" }}><div style={{ width: (a.value / 5) * 100 + "%", height: "100%", background: "linear-gradient(90deg," + p.accent + ",#10b981)", borderRadius: 8 }} /></div>
          </div>
        ); }) : <p style={{ color: "#9a8f7d" }}>لا توجد بيانات.</p>}
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>💬 ملاحظات المشاركين</h3>
        {r.comments.length > 0 ? r.comments.map((c, i) => (<div key={i} style={{ background: "#fff", borderRight: "4px solid " + p.accent, borderRadius: 12, padding: 12, marginBottom: 8, fontSize: 13.5, color: "#475569", lineHeight: 1.7 }}>{c}</div>)) : <p style={{ color: "#9a8f7d" }}>لا توجد ملاحظات نصية مسجلة.</p>}
      </Card>
    </div>
  );
}

function Overview(p: { daily: Rep; final: Rep }) {
  const d = p.daily; const f = p.final;
  const max = Math.max(5, d.avg, f.avg);
  return (
    <div>
      <div className="g2" style={{ marginBottom: 16 }}>
        <Card style={{ borderTop: "5px solid #2563eb", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#2563eb", marginBottom: 8 }}>التقييم اليومي</div>
          <div style={{ fontSize: 46, fontWeight: 900, color: "#111" }}>{d.avg ? d.avg.toFixed(2) : "-"}<span style={{ fontSize: 18, color: "#9a8f7d" }}>/5</span></div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{d.count} استجابة · رضا {d.avg ? Math.round((d.avg / 5) * 100) : 0}%</div>
        </Card>
        <Card style={{ borderTop: "5px solid #10b981", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>التقييم النهائي</div>
          <div style={{ fontSize: 46, fontWeight: 900, color: "#111" }}>{f.avg ? f.avg.toFixed(2) : "-"}<span style={{ fontSize: 18, color: "#9a8f7d" }}>/5</span></div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{f.count} استجابة · رضا {f.avg ? Math.round((f.avg / 5) * 100) : 0}%</div>
        </Card>
      </div>
      <Card>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>⚖️ المقارنة البصرية</h3>
        <svg viewBox="0 0 300 200" style={{ width: "100%", maxWidth: 380, height: "auto", display: "block", margin: "0 auto" }}>
          {[0, 0.5, 1].map((fr, i) => { const y = 20 + 140 * (1 - fr); return (<g key={i}><line x1={40} y1={y} x2={280} y2={y} stroke="#ece4d4" strokeDasharray="3,3" /><text x={34} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{(max * fr).toFixed(1)}</text></g>); })}
          <g><rect x={80} y={160 - (d.avg / max) * 140} width={50} height={(d.avg / max) * 140} rx={8} fill="#2563eb" /><text x={105} y={160 - (d.avg / max) * 140 - 8} textAnchor="middle" fontSize="14" fontWeight="900" fill="#111">{d.avg ? d.avg.toFixed(2) : "-"}</text><text x={105} y={180} textAnchor="middle" fontSize="11" fill="#475569">اليومي</text></g>
          <g><rect x={180} y={160 - (f.avg / max) * 140} width={50} height={(f.avg / max) * 140} rx={8} fill="#10b981" /><text x={205} y={160 - (f.avg / max) * 140 - 8} textAnchor="middle" fontSize="14" fontWeight="900" fill="#111">{f.avg ? f.avg.toFixed(2) : "-"}</text><text x={205} y={180} textAnchor="middle" fontSize="11" fill="#475569">النهائي</text></g>
          <line x1={40} y1={160} x2={280} y2={160} stroke="#d6cdba" strokeWidth={1.5} />
        </svg>
      </Card>
    </div>
  );
}
