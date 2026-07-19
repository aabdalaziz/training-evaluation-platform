// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase as supabaseImp } from "../../lib/supabase/client";
const TEAL = "#10b981", NAVY = "#0b1220";
const L = (x) => (Array.isArray(x) ? x : []);
const p2 = (n) => (n < 10 ? "0" + n : "" + n);
const avgA = (a) => { const x = L(a).filter((v) => typeof v === "number" && !isNaN(v)); return x.length ? x.reduce((p, c) => p + c, 0) / x.length : 0; };
const getDb = () => { try { const f = supabaseImp; if (typeof f === "function") { try { const c = f(); if (c && c.from) return c; } catch (e) {} } return f; } catch (e) { return null; } };
const rankS = (r) => r === 1 ? { bg: "linear-gradient(135deg,#fbbf24,#f59e0b)", fg: "#000", t: "1" } : r === 2 ? { bg: "linear-gradient(135deg,#e2e8f0,#94a3b8)", fg: "#111", t: "2" } : r === 3 ? { bg: "linear-gradient(135deg,#fb923c,#7c2d12)", fg: "#fff", t: "3" } : { bg: "#1e293b", fg: "#cbd5e1", t: String(r) };
const st = (v) => v >= 4 ? { t: "ممتاز", bg: "#d1fae5", fg: "#065f46" } : v >= 3 ? { t: "جيد", bg: "#fef3c7", fg: "#92400e" } : { t: "يحتاج دعماً", bg: "#fee2e2", fg: "#991b1b" };
const EMPTY = { count: 0, avg: 0, axes: [], dist: [0, 0, 0, 0, 0], days: [], comments: [] };

export default function Page() {
  const router = useRouter();
  const [rows, setRows] = useState([]); const [ans, setAns] = useState([]); const [qs, setQs] = useState([]);
  const [rooms, setRooms] = useState([]); const [profs, setProfs] = useState([]);
  const [load, setLoad] = useState(true); const [tab, setTab] = useState("daily"); const [q, setQ] = useState(""); const [roomF, setRoomF] = useState("all");

  useEffect(() => { let on = true; (async () => {
    try {
      const db = getDb(); if (!db || !db.from) return;
      const c = await db.from("classrooms").select("*").limit(500);
      const e = await db.from("evaluations").select("*").order("submitted_at", { ascending: false }).limit(4000);
      const ids = L(e.data).map((x) => x && x.id);
      const a = ids.length ? await db.from("evaluation_answers").select("*").in("evaluation_id", ids) : { data: [] };
      const qq = await db.from("questions").select("*").limit(500);
      let pp = []; try { const tIds = [...new Set(L(c.data).map((x) => x && x.trainer_id).filter(Boolean))]; if (tIds.length) { const r = await db.from("profiles").select("*").in("id", tIds); pp = L(r.data); } } catch (e2) {}
      if (!on) return; setRooms(L(c.data)); setRows(L(e.data)); setAns(L(a.data)); setQs(L(qq.data)); setProfs(pp);
    } catch (e) {} finally { if (on) setLoad(false); }
  })(); return () => { on = false; }; }, []);

  const calc = (kind) => {
    try {
      const list = L(rows).filter((r) => r && r.kind === kind); const ids = new Set(list.map((r) => r.id));
      const qm = {}; L(qs).forEach((x) => { if (x) qm[x.id] = x; }); const g = {};
      L(ans).forEach((a) => { if (a && ids.has(a.evaluation_id) && a.rating_value != null) { const v = Number(a.rating_value); if (!isNaN(v)) (g[a.question_id] = g[a.question_id] || []).push(v); } });
      const axes = Object.keys(g).map((id) => ({ label: (qm[id] && qm[id].text_ar) || "سؤال", value: avgA(g[id]) })).sort((a, b) => a.value - b.value);
      const all = list.map((r) => Number(r.overall_rating)).filter((v) => !isNaN(v) && v > 0); const avg = avgA(all);
      const dist = [0, 0, 0, 0, 0]; list.forEach((r) => { const v = Math.round(Number(r.overall_rating)); if (v >= 1 && v <= 5) dist[v - 1]++; });
      const dm = {}; for (let i = 6; i >= 0; i--) { const dd = new Date(); dd.setDate(dd.getDate() - i); const k = dd.getFullYear() + "-" + p2(dd.getMonth() + 1) + "-" + p2(dd.getDate()); dm[k] = { wd: dd.toLocaleDateString("ar-SA", { weekday: "short" }), count: 0 }; }
      list.forEach((r) => { try { const dd = new Date(r.submitted_at); const k = dd.getFullYear() + "-" + p2(dd.getMonth() + 1) + "-" + p2(dd.getDate()); if (dm[k]) dm[k].count++; } catch (e2) {} });
      const days = Object.keys(dm).map((k) => dm[k]);
      const comments = L(ans).filter((a) => a && ids.has(a.evaluation_id) && a.text_value && String(a.text_value).trim()).map((a) => String(a.text_value).trim()).slice(0, 5);
      return { count: list.length, avg, axes, dist, days, comments };
    } catch (e) { return EMPTY; }
  };
  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  const teachers = useMemo(() => {
    try {
      const cMap = {}; L(rooms).forEach((c) => { if (c) cMap[c.id] = c; }); const pMap = {}; L(profs).forEach((p) => { if (p) pMap[p.id] = p.full_name || p.display_name || p.email || "معلم"; });
      const g = {}; L(rows).forEach((ev) => { if (!ev) return; let cid = ev.classroom_id; if (!cid && ev.classroom_number) { const f = L(rooms).find((c) => c && String(c.code) === String(ev.classroom_number)); if (f) cid = f.id; } if (!cid) return; (g[cid] = g[cid] || []).push(ev); });
      let list = Object.keys(g).map((cid) => { const c = cMap[cid]; const avg = avgA(g[cid].map((e) => Number(e.overall_rating)).filter((v) => !isNaN(v) && v > 0)); return { id: cid, code: (c && c.code) || "-", trainerId: c ? c.trainer_id : null, name: (c && c.trainer_id) ? (pMap[c.trainer_id] || "معلم") : "غير معين", count: g[cid].length, avg }; });
      L(rooms).forEach((c) => { if (c && !g[c.id]) list.push({ id: c.id, code: c.code, trainerId: c.trainer_id, name: c.trainer_id ? (pMap[c.trainer_id] || "معلم") : "غير معين", count: 0, avg: 0 }); });
      return list.sort((a, b) => { if (b.count === 0 && a.count === 0) return 0; if (b.count === 0) return -1; if (a.count === 0) return 1; return b.avg - a.avg; });
    } catch (e) { return []; }
  }, [rows, rooms, profs]);

  const roomsList = useMemo(() => ["all"].concat(Array.from(new Set(L(rooms).map((r) => String(r.code))))), [rooms]);
  const filtered = useMemo(() => L(teachers).filter((t) => { if (roomF !== "all" && String(t.code) !== String(roomF)) return false; if (q && !(String(t.name).toLowerCase().indexOf(q.toLowerCase()) >= 0 || String(t.code).indexOf(q) >= 0)) return false; return true; }), [teachers, roomF, q]);

  const banner = (<div style={{ background: "#facc15", color: "#111", padding: "8px 14px", borderRadius: 10, fontWeight: 900, marginBottom: 14, textAlign: "center", fontSize: 13 }}>V-REPORT-2</div>);
  if (load) return (<div dir="rtl" style={{ background: "#f1ece1", minHeight: "100vh", padding: 14, fontFamily: "Tahoma,sans-serif" }}>{banner}<div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>جارٍ تحميل البيانات...</div></div>);

  const d = (tab === "daily" ? daily : final) || EMPTY;
  const days = L(d.days); const dist = (L(d.dist).length === 5 ? d.dist : [0, 0, 0, 0, 0]);
  const maxDay = Math.max(1, ...days.map((x) => x.count)); const maxDist = Math.max(1, ...dist);
  const tabBtn = (id, label) => (<button onClick={() => setTab(id)} style={{ width: "100%", background: tab === id ? "rgba(16,185,129,.18)" : "transparent", border: tab === id ? "1px solid #10b981" : "1px solid transparent", color: tab === id ? "#5eead4" : "#cbd5e1", borderRadius: 12, padding: 10, marginBottom: 6, cursor: "pointer", fontWeight: tab === id ? 800 : 600, fontFamily: "inherit" }}>{label}</button>);

  return (
    <div dir="rtl" style={{ background: "#f1ece1", minHeight: "100vh", padding: 14, fontFamily: "Tahoma,sans-serif" }}>
      {banner}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 250, flexShrink: 0 }}>
          <div style={{ background: "linear-gradient(180deg,#0b1220,#070b14)", borderRadius: 22, padding: 16, color: "#fff" }}>
            <div style={{ fontWeight: 900, marginBottom: 12 }}>منصة التقييم</div>
            {tabBtn("daily", "التقرير اليومي")}
            {tabBtn("final", "التقرير النهائي")}
            {tabBtn("teachers", "المعلمون بالقاعة")}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث معلم / قاعة" style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: 9, color: "#fff", fontSize: 12, fontFamily: "inherit" }} />
            <select value={roomF} onChange={(e) => setRoomF(e.target.value)} style={{ width: "100%", marginTop: 6, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: 8, color: "#e2e8f0", fontSize: 12, fontFamily: "inherit" }}>{roomsList.map((r) => (<option key={r} value={r} style={{ color: "#111" }}>{r === "all" ? "كل القاعات" : "قاعة " + r}</option>))}</select>
            <button onClick={() => router.push("/dashboard")} style={{ width: "100%", marginTop: 10, background: "transparent", border: "none", color: "#94a3b8", fontSize: 12, textAlign: "right", cursor: "pointer", fontFamily: "inherit" }}>لوحة التحكم</button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ background: "linear-gradient(135deg,#0b1220,#111827)", borderRadius: 22, padding: 20, color: "#fff", marginBottom: 12, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 14, top: -6, fontSize: 70, fontWeight: 900, color: "rgba(255,255,255,.04)" }}>REPORT</div>
            <div style={{ position: "relative", textAlign: "center" }}><h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{tab === "teachers" ? "ترتيب المعلمين بالقاعة" : tab === "daily" ? "التقرير اليومي" : "التقرير النهائي"}</h1></div>
          </div>

          {tab !== "teachers" ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
                <div style={{ background: "#fffdf9", borderRadius: 16, padding: 16, textAlign: "center", border: "1px solid #ece4d4" }}><div style={{ fontSize: 11, color: "#9a8f7d" }}>الاستجابات</div><div style={{ fontSize: 28, fontWeight: 900 }}>{d.count}</div></div>
                <div style={{ background: "#fffdf9", borderRadius: 16, padding: 16, textAlign: "center", border: "1px solid #ece4d4" }}><div style={{ fontSize: 11, color: "#9a8f7d" }}>المتوسط</div><div style={{ fontSize: 28, fontWeight: 900 }}>{(d.avg || 0).toFixed(1)}/5</div></div>
                <div style={{ background: "#fffdf9", borderRadius: 16, padding: 16, textAlign: "center", border: "1px solid #ece4d4" }}><div style={{ fontSize: 11, color: "#9a8f7d" }}>الرضا</div><div style={{ fontSize: 28, fontWeight: 900 }}>{Math.round((d.avg || 0) / 5 * 100)}%</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={{ background: "#fffdf9", borderRadius: 16, padding: 14, border: "1px solid #ece4d4" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>التوزيع اليومي</h3>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
                    {days.map((day, i) => (<div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}><span style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{day.count}</span><div style={{ width: "70%", height: Math.max(6, (day.count / maxDay) * 95) + "px", background: "linear-gradient(180deg,#34d399,#059669)", borderRadius: "6px 6px 0 0" }} /><span style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>{day.wd}</span></div>))}
                  </div>
                </div>
                <div style={{ background: "#fffdf9", borderRadius: 16, padding: 14, border: "1px solid #ece4d4" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>توزيع التقييم</h3>
                  {[5, 4, 3, 2, 1].map((sv) => { const idx = sv - 1; const w = (dist[idx] / maxDist) * 100; const col = sv >= 4 ? TEAL : sv === 3 ? "#facc15" : "#fb7185"; return (<div key={sv} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}><span style={{ width: 46, fontSize: 11 }}>{sv} نجوم</span><div style={{ flex: 1, height: 9, background: "#f0e9db", borderRadius: 8 }}><div style={{ width: w + "%", height: "100%", background: col, borderRadius: 8 }} /></div><b style={{ width: 16, fontSize: 11 }}>{dist[idx]}</b></div>); })}
                </div>
              </div>
              <div style={{ background: "#fffdf9", borderRadius: 16, padding: 14, border: "1px solid #ece4d4" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800 }}>أداء المحاور</h3>
                {L(d.axes).length === 0 ? <div style={{ color: "#9a8f7d", fontSize: 13 }}>لا توجد بيانات محاور.</div> : L(d.axes).map((a, i) => { const s = st(a.value); return (<div key={i} style={{ background: "#fff", border: "1px solid #f0e9db", borderRadius: 12, padding: 10, marginBottom: 7 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, fontWeight: 700 }}>{a.label}</span><span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>{(a.value || 0).toFixed(2)}/5</span></div><div style={{ height: 8, background: "#f0e9db", borderRadius: 8, marginTop: 6 }}><div style={{ width: ((a.value || 0) / 5 * 100) + "%", height: "100%", background: "linear-gradient(90deg,#10b981,#0ea5e9)", borderRadius: 8 }} /></div></div>); })}
              </div>
            </div>
          ) : (
            <div style={{ background: NAVY, borderRadius: 20, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><h2 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 900 }}>الترتيب</h2><span style={{ background: "rgba(16,185,129,.15)", color: "#5eead4", borderRadius: 999, padding: "4px 10px", fontSize: 11 }}>{filtered.length}</span></div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                  <thead><tr style={{ color: "#94a3b8", fontSize: 11, textAlign: "right" }}><th style={{ padding: 8 }}>#</th><th style={{ padding: 8 }}>المعلم</th><th style={{ padding: 8 }}>قاعة</th><th style={{ padding: 8 }}>عدد</th><th style={{ padding: 8 }}>متوسط</th><th style={{ padding: 8 }}>حالة</th></tr></thead>
                  <tbody>{filtered.map((t, i) => { const rk = rankS(i + 1); const s = st(t.avg); return (<tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}><td style={{ padding: 8 }}><div style={{ width: 26, height: 26, borderRadius: 8, background: rk.bg, color: rk.fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{rk.t}</div></td><td style={{ padding: 8, color: "#fff", fontWeight: 700 }}>{t.name}</td><td style={{ padding: 8 }}><span style={{ background: "rgba(255,255,255,.1)", padding: "3px 10px", borderRadius: 999, color: "#e2e8f0", fontSize: 12 }}>{t.code}</span></td><td style={{ padding: 8, color: "#cbd5e1" }}>{t.count}</td><td style={{ padding: 8, color: "#fff", fontWeight: 800 }}>{t.count ? (t.avg || 0).toFixed(2) : "-"}</td><td style={{ padding: 8 }}><span style={{ background: s.bg, color: s.fg, padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>{t.count ? s.t : "لا يوجد"}</span></td></tr>); })}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
