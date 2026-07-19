// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase as supabaseImp } from "../../lib/supabase/client";
const TEAL = "#0d9488", NAVY = "#0b1220";
const L = (x) => (Array.isArray(x) ? x : []);
const avgA = (a) => { const x = L(a).filter((v) => typeof v === "number" && !isNaN(v)); return x.length ? x.reduce((p, c) => p + c, 0) / x.length : 0; };
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
const getDb = () => { try { const f = supabaseImp; if (typeof f === "function") { try { const c = f(); if (c && c.from) return c; } catch (e) {} } return f; } catch (e) { return null; } };
const today = () => { try { return new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return ""; } };

export default function ReportsCenter() {
  const [rows, setRows] = useState([]); const [ans, setAns] = useState([]); const [qs, setQs] = useState([]);
  const [rooms, setRooms] = useState([]); const [profs, setProfs] = useState([]); const [programs, setPrograms] = useState([]);
  const [load, setLoad] = useState(true); const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [modal, setModal] = useState(null); const [sending, setSending] = useState(false);

  useEffect(() => { let on = true; (async () => {
    try {
      const db = getDb(); if (!db || !db.from) { if (on) setErr("تعذّر الاتصال بقاعدة البيانات"); return; }
      const e = await db.from("evaluations").select("*").limit(5000);
      const c = await db.from("classrooms").select("*").limit(500);
      const p = await db.from("programs").select("*").limit(500);
      const pr = await db.from("questions").select("*").limit(500);
      const ids = L(e.data).map((x) => x && x.id);
      const a = ids.length ? await db.from("evaluation_answers").select("*").in("evaluation_id", ids) : { data: [] };
      let pp = []; try { const tIds = [...new Set(L(c.data).map((x) => x && x.trainer_id).filter(Boolean))]; if (tIds.length) { const r = await db.from("profiles").select("*").in("id", tIds); pp = L(r.data); } } catch (e2) {}
      if (!on) return; setRows(L(e.data)); setRooms(L(c.data)); setPrograms(L(p.data)); setQs(L(pr.data)); setProfs(pp);
    } catch (ex) { if (on) setErr(ex && ex.message ? ex.message : "خطأ في التحميل"); } finally { if (on) setLoad(false); }
  })(); return () => { on = false; }; }, []);

  const calc = (kind) => {
    const list = L(rows).filter((r) => r && r.kind === kind); const ids = new Set(list.map((r) => r.id));
    const qm = {}; L(qs).forEach((q) => { if (q) qm[q.id] = q; }); const g = {};
    L(ans).forEach((a) => { if (a && ids.has(a.evaluation_id) && a.rating_value != null) { const v = Number(a.rating_value); if (!isNaN(v)) (g[a.question_id] = g[a.question_id] || []).push(v); } });
    const axes = Object.keys(g).map((id) => ({ label: (qm[id] && qm[id].text_ar) || "سؤال", value: avgA(g[id]) })).sort((a, b) => b.value - a.value);
    const avg = avgA(list.map((r) => Number(r.overall_rating)).filter((v) => !isNaN(v) && v > 0));
    const comments = L(ans).filter((a) => a && ids.has(a.evaluation_id) && a.text_value && String(a.text_value).trim()).map((a) => String(a.text_value).trim()).slice(0, 5);
    return { count: list.length, avg, axes, comments, strengths: axes.slice(0, 3).map((a) => a.label + " (" + a.value.toFixed(2) + ")"), improvements: axes.slice(-3).reverse().map((a) => a.label + " (" + a.value.toFixed(2) + ")") };
  };
  const daily = useMemo(() => safe(() => calc("DAILY"), { count: 0, avg: 0, axes: [], comments: [] }), [rows, ans, qs]);
  const final = useMemo(() => safe(() => calc("FINAL"), { count: 0, avg: 0, axes: [], comments: [] }), [rows, ans, qs]);

  const trainers = useMemo(() => safe(() => {
    const cMap = {}; L(rooms).forEach((c) => { if (c) cMap[c.id] = c; }); const pMap = {}; L(profs).forEach((p) => { if (p) pMap[p.id] = p.full_name || p.display_name || p.email || "مدرب"; });
    const prMap = {}; L(programs).forEach((p) => { if (p) prMap[p.id] = p.name || p.title || "برنامج"; });
    const g = {}; L(rows).forEach((ev) => { if (!ev) return; let cid = ev.classroom_id; if (!cid && ev.classroom_number) { const f = L(rooms).find((c) => c && String(c.code) === String(ev.classroom_number)); if (f) cid = f.id; } if (!cid) return; (g[cid] = g[cid] || []).push(ev); });
    return Object.keys(g).map((cid) => {
      const evs = g[cid]; const c = cMap[cid]; const ids = new Set(evs.map((e) => e.id)); const qm = {}; L(qs).forEach((q) => { if (q) qm[q.id] = q; }); const gg = {};
      L(ans).forEach((a) => { if (a && ids.has(a.evaluation_id) && a.rating_value != null) { const v = Number(a.rating_value); if (!isNaN(v)) (gg[a.question_id] = gg[a.question_id] || []).push(v); } });
      const axes = Object.keys(gg).map((id) => ({ label: (qm[id] && qm[id].text_ar) || "سؤال", value: avgA(gg[id]) })).sort((a, b) => b.value - a.value);
      const avg = avgA(evs.map((e) => Number(e.overall_rating)).filter((v) => !isNaN(v) && v > 0));
      const comments = L(ans).filter((a) => a && ids.has(a.evaluation_id) && a.text_value && String(a.text_value).trim()).map((a) => String(a.text_value).trim()).slice(0, 4);
      const tid = c ? c.trainer_id : null; const prof = L(profs).find((p) => p && p.id === tid);
      return { id: cid, name: tid ? (pMap[tid] || "مدرب") : "غير معين", email: (prof && prof.email) || "", room: (c && c.code) || "—", program: (c && prMap[c.program_id]) || "—", count: evs.length, avg, axes, comments, strengths: axes.slice(0, 3).map((a) => a.label + " (" + a.value.toFixed(2) + ")"), improvements: axes.slice(-2).reverse().map((a) => a.label + " (" + a.value.toFixed(2) + ")") };
    }).sort((a, b) => b.avg - a.avg);
  }, []), [rows, ans, qs, rooms, profs, programs]);

  const mailto = (to, subject, r) => { try { const ax = L(r && r.axes).map((a) => "- " + a.label + ": " + Number(a.value).toFixed(2) + "/5").join("%0A"); window.open("mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent("البرنامج: " + (r && r.program || "—") + "\nالقاعة: " + (r && r.room || "—") + "\nالتقييمات: " + (r && r.count || 0) + "\nالمتوسط: " + (r && r.avg ? Number(r.avg).toFixed(2) : "—") + "\n\nالمحاور:\n" + ax.replace(/%0A/g, "\n")), "_blank"); } catch (e) {} };
  const send = async () => {
    if (!modal) return; setSending(true); setMsg(""); setErr("");
    const subject = modal.kind === "trainer" ? "تقرير أداء قاعتك التدريبية" : "التقرير التنفيذي الشامل";
    try {
      const db = getDb(); if (!db || !db.functions) throw new Error("no functions");
      const res = await db.functions.invoke("send-report-email", { body: { to: modal.to, subject, report: Object.assign({}, modal.report, { type: modal.kind, title: subject, date: today() }) } });
      const data = res && res.data; if (res && res.error) throw res.error;
      if (data && data.ok === false) { mailto(modal.to, subject, modal.report); setMsg("فُتحت نافذة بريد بديلة (Resend غير مهيّأ أو فشل الإرسال)."); }
      else { setMsg("تم إرسال التقرير إلى " + modal.to); setModal(null); }
    } catch (ex) { mailto(modal.to, subject, modal.report); setMsg("تعذّر الإرسال المباشر — فُتحت نافذة بريد بديلة."); }
    finally { setSending(false); }
  };

  const d = daily || { count: 0, avg: 0, axes: [], comments: [] };
  const f = final || { count: 0, avg: 0, axes: [], comments: [] };
  const tr = L(trainers); const trActive = tr.filter((t) => t && t.count > 0);

  const banner = (<div style={{ background: "#facc15", color: "#111", padding: "8px 14px", borderRadius: 10, fontWeight: 900, marginBottom: 14, textAlign: "center", fontSize: 13 }}>RC-V3 • مركز التقارير (نسخة محصّنة)</div>);

  if (load) return (<div style={{ background: "#f1f5f9", minHeight: "100vh", padding: 20, direction: "rtl", fontFamily: "Cairo,Tahoma" }}>{banner}<div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>جارٍ بناء مركز التقارير...</div></div>);

  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh", padding: 20, direction: "rtl", fontFamily: "Cairo,Tahoma" }}>
      {banner}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg,#0b1220,#0d9488)", borderRadius: 20, padding: 24, color: "#fff", marginBottom: 16 }}><h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>مركز التقارير والإرسال</h1><p style={{ margin: "6px 0 0", color: "#cbd5e1", fontSize: 13 }}>تقرير القاعة للمدرّب + التقرير الشامل للإدارة</p></div>
        {err ? <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 10, marginBottom: 12 }}>{err}</div> : null}
        {msg ? <div style={{ background: "#dcfce7", color: "#065f46", padding: 12, borderRadius: 10, marginBottom: 12 }}>{msg}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          {[["التقييمات", L(rows).length], ["القاعات", L(rooms).length], ["المدربون", trActive.length], ["متوسط المنصة", avgA(L(rows).map((r) => Number(r && r.overall_rating)).filter((v) => !isNaN(v) && v > 0)).toFixed(2)]].map((k, i) => (<div key={i} style={{ background: "#fff", borderRadius: 14, padding: 14, textAlign: "center", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 11, color: "#94a3b8" }}>{k[0]}</div><div style={{ fontSize: 24, fontWeight: 900, color: NAVY }}>{k[1]}</div></div>))}
        </div>

        <div style={{ background: NAVY, borderRadius: 18, padding: 16, color: "#fff", marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 900 }}>التقرير التنفيذي → للإدارة</h2>
          <div style={{ fontSize: 14 }}>اليومي {Number(d.avg || 0).toFixed(2)} / النهائي {Number(f.avg || 0).toFixed(2)} • أعلى قاعة: {trActive[0] ? trActive[0].room : "—"}</div>
          <button onClick={() => setModal({ kind: "exec", to: "", report: { count: L(rows).length, avg: avgA(L(rows).map((r) => Number(r && r.overall_rating)).filter((v) => !isNaN(v) && v > 0)), axes: L(d.axes).concat(L(f.axes)).slice(0, 8), comments: L(d.comments).concat(L(f.comments)).slice(0, 5), program: "كل البرامج", room: "كل القاعات" } })} style={{ marginTop: 12, background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>إرسال للإدارة بالبريد</button>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 900, color: NAVY }}>تقارير القاعات → للمدرّبين ({trActive.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tr.map((t) => (t ? (<div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #e2e8f0", borderRight: "5px solid " + (t.count ? TEAL : "#cbd5e1") }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontWeight: 800, color: NAVY }}>{t.name}</div><div style={{ fontSize: 12, color: "#64748b" }}>قاعة {t.room} • {t.program}</div></div><div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 900, color: (t.avg || 0) >= 3.2 ? TEAL : "#ef4444" }}>{t.count ? Number(t.avg).toFixed(2) : "—"}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{t.count} تقييم</div></div></div>
            <button disabled={!t.count} onClick={() => setModal({ kind: "trainer", to: t.email || "", report: t })} style={{ marginTop: 10, background: t.count ? TEAL : "#e2e8f0", color: t.count ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: t.count ? "pointer" : "not-allowed" }}>إرسال للمدرّب</button>
          </div>) : null))}
          {trActive.length === 0 ? <div style={{ color: "#94a3b8", padding: 16 }}>لا توجد تقييمات مربوطة بقاعات بعد.</div> : null}
        </div>

        {modal ? (<div onClick={() => { if (!sending) setModal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 20, width: "100%", maxWidth: 420 }}>
            <h3 style={{ margin: "0 0 10px", fontWeight: 900 }}>{modal.kind === "trainer" ? "إرسال تقرير القاعة للمدرّب" : "إرسال التقرير التنفيذي للإدارة"}</h3>
            <input value={modal.to} onChange={(e) => setModal(Object.assign({}, modal, { to: e.target.value }))} placeholder="name@example.com" style={{ width: "100%", padding: 12, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setModal(null)} disabled={sending} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>إلغاء</button>
              <button onClick={send} disabled={sending || !modal.to} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: (sending || !modal.to) ? "not-allowed" : "pointer" }}>{sending ? "جارٍ الإرسال..." : "إرسال"}</button>
            </div>
          </div>
        </div>) : null}
      </div>
    </div>
  );
}
