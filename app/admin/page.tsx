// BUILD_TAG ADMIN_V2
// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { supabase as supabaseImp } from "../../lib/supabase/client";
const NAVY = "#0b1220", TEAL = "#0d9488";
const L = (x) => (Array.isArray(x) ? x : []);
const getDb = () => { try { const f = supabaseImp; if (typeof f === "function") { try { const c = f(); if (c && c.from) return c; } catch (e) {} } return f; } catch (e) { return null; } };
const inp = { width: "100%", padding: 10, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, marginBottom: 10, fontFamily: "inherit", boxSizing: "border-box" };

export default function Admin() {
  const [tab, setTab] = useState("rooms");
  const [rooms, setRooms] = useState([]); const [trainers, setTrainers] = useState([]); const [programs, setPrograms] = useState([]);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [mRoom, setMRoom] = useState(null); const [mTrainer, setMTrainer] = useState(null); const [mProg, setMProg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { try { const db = getDb(); if (!db || !db.from) return; const r = await db.from("classrooms").select("*").limit(1000); const t = await db.from("profiles").select("*").limit(1000); const p = await db.from("programs").select("*").limit(1000); setRooms(L(r.data)); setTrainers(L(t.data)); setPrograms(L(p.data)); } catch (e) { setErr(e && e.message ? e.message : "load error"); } };
  useEffect(() => { load(); }, []);

  const progName = (id) => { const p = L(programs).find((x) => x && x.id === id); return p ? (p.name || p.title || p.name_ar || "program") : "-"; };
  const trainerObj = (id) => L(trainers).find((x) => x && x.id === id) || null;
  const trainerName = (id) => { const t = trainerObj(id); return t ? (t.full_name || t.display_name || t.email || "trainer") : "-"; };
  const roomsOfTrainer = (id) => L(rooms).filter((r) => r && r.trainer_id === id).length;
  const roomsOfProg = (id) => L(rooms).filter((r) => r && r.program_id === id).length;

  const saveRoom = async () => { if (!mRoom) return; const v = mRoom; if (!String(v.code || "").trim()) { setErr("room code required"); return; } setBusy(true); setErr(""); try { const db = getDb(); const payload = { code: String(v.code).trim(), level: v.level || "A1", capacity: Number(v.capacity) || null, program_id: v.program_id || null, trainer_id: v.trainer_id || null }; const res = v.id ? await db.from("classrooms").update(payload).eq("id", v.id) : await db.from("classrooms").insert(payload); if (res.error) throw res.error; setMsg("تم حفظ القاعة وربطها"); setMRoom(null); load(); } catch (e) { setErr(e && e.message ? e.message : "save room failed"); } finally { setBusy(false); } };
  const saveTrainer = async () => { if (!mTrainer) return; const v = mTrainer; if (!String(v.full_name || "").trim()) { setErr("trainer name required"); return; } setBusy(true); setErr(""); try { const db = getDb(); const fn = String(v.full_name).trim(); const payload = { full_name: fn, display_name: fn }; if (String(v.email || "").trim()) payload.email = String(v.email).trim(); if (String(v.phone || "").trim()) payload.phone = String(v.phone).trim(); if (!v.id) payload.id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : ("t" + Date.now()); const res = v.id ? await db.from("profiles").update(payload).eq("id", v.id) : await db.from("profiles").insert(payload); if (res.error) throw res.error; setMsg("تم حفظ المدرب"); setMTrainer(null); load(); } catch (e) { setErr((e && e.message ? e.message : "save trainer failed") + " | RLS? run the SQL below."); } finally { setBusy(false); } };
  const saveProg = async () => { if (!mProg) return; const v = mProg; if (!String(v.name || "").trim()) { setErr("program name required"); return; } setBusy(true); setErr(""); try { const db = getDb(); const nm = String(v.name).trim(); let res = v.id ? await db.from("programs").update({ name: nm }).eq("id", v.id) : await db.from("programs").insert({ name: nm }); if (res.error && String(res.error.message).indexOf("name") >= 0) { res = v.id ? await db.from("programs").update({ title: nm }).eq("id", v.id) : await db.from("programs").insert({ title: nm }); } if (res.error) throw res.error; setMsg("تم حفظ البرنامج"); setMProg(null); load(); } catch (e) { setErr(e && e.message ? e.message : "save program failed"); } finally { setBusy(false); } };
  const del = async (table, id, label) => { if (!confirm("delete " + label + "?")) return; try { const db = getDb(); const res = await db.from(table).delete().eq("id", id); if (res.error) throw res.error; load(); } catch (e) { setErr(e && e.message ? e.message : "delete failed"); } };

  const banner = (<div style={{ background: "#facc15", color: "#111", padding: "8px 14px", borderRadius: 10, fontWeight: 900, marginBottom: 14, textAlign: "center", fontSize: 13 }}>ADMIN_V2</div>);
  const tabBtn = (id, label, n) => (<button onClick={() => setTab(id)} style={{ background: tab === id ? NAVY : "#fff", color: tab === id ? "#fff" : "#475569", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 16px", cursor: "pointer", fontWeight: tab === id ? 800 : 600, fontFamily: "inherit" }}>{label} ({n})</button>);
  const th = { padding: 10, textAlign: "right", fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" };
  const td = { padding: 10, fontSize: 13 };
  const miniBtn = (bg, fg, onClick, label) => (<button onClick={onClick} style={{ background: bg, color: fg, border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, marginLeft: 6, fontFamily: "inherit" }}>{label}</button>);

  return (
    <div dir="rtl" style={{ background: "#f1f5f9", minHeight: "100vh", padding: 18, fontFamily: "Cairo,Tahoma,sans-serif" }}>
      {banner}
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0b1220,#0d9488)", borderRadius: 22, padding: 24, color: "#fff", marginBottom: 16 }}>
          <div style={{ position: "absolute", left: 16, top: -8, fontSize: 76, fontWeight: 900, color: "rgba(255,255,255,.05)" }}>ADMIN</div>
          <div style={{ position: "relative" }}><h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>إدارة المنصة</h1><p style={{ margin: "6px 0 0", color: "#cbd5e1", fontSize: 13 }}>البرامج والقاعات والمدرّبون وربطهم ببعض</p></div>
        </div>

        {err ? <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 10, marginBottom: 12 }}>{err} <button onClick={() => setErr("")} style={{ float: "left", background: "transparent", border: "none", cursor: "pointer" }}>x</button></div> : null}
        {msg ? <div style={{ background: "#dcfce7", color: "#065f46", padding: 12, borderRadius: 10, marginBottom: 12 }}>{msg}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
          {[["القاعات", L(rooms).length], ["المدرّبون", L(trainers).length], ["البرامج", L(programs).length]].map((k, i) => (<div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, textAlign: "center", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 12, color: "#94a3b8" }}>{k[0]}</div><div style={{ fontSize: 30, fontWeight: 900, color: NAVY }}>{k[1]}</div></div>))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {tabBtn("rooms", "القاعات", L(rooms).length)}
          {tabBtn("trainers", "المدرّبون", L(trainers).length)}
          {tabBtn("programs", "البرامج", L(programs).length)}
          <div style={{ flex: 1 }} />
          {tab === "rooms" ? <button onClick={() => setMRoom({ code: "", level: "A1", capacity: "", program_id: "", trainer_id: "" })} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ قاعة</button> : null}
          {tab === "trainers" ? <button onClick={() => setMTrainer({ full_name: "", email: "", phone: "" })} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ مدرّب</button> : null}
          {tab === "programs" ? <button onClick={() => setMProg({ name: "" })} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>+ برنامج</button> : null}
        </div>

        {tab === "rooms" ? (
          <div style={{ background: NAVY, borderRadius: 18, padding: 8, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr style={{ textAlign: "right" }}><th style={th}>القاعة</th><th style={th}>المستوى</th><th style={th}>البرنامج</th><th style={th}>المدرّب</th><th style={th}>الحالة</th><th style={th}>إجراءات</th></tr></thead>
              <tbody>{L(rooms).map((r) => { const linked = !!r.trainer_id; const t = trainerObj(r.trainer_id); return (<tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,.07)", background: linked ? "rgba(16,185,129,.06)" : "rgba(251,191,36,.05)" }}><td style={{ ...td, color: "#fff" }}><span style={{ background: "rgba(255,255,255,.1)", padding: "3px 10px", borderRadius: 999, fontWeight: 800 }}>{r.code}</span></td><td style={{ ...td, color: "#cbd5e1" }}>{r.level}</td><td style={{ ...td, color: "#e2e8f0" }}>{progName(r.program_id)}</td><td style={td}>{linked ? <div><div style={{ color: "#fff", fontWeight: 700 }}>{trainerName(r.trainer_id)}</div><div style={{ color: "#94a3b8", fontSize: 11 }}>{t && t.email ? t.email : ""}{t && t.phone ? " - " + t.phone : ""}</div></div> : <span style={{ color: "#fbbf24", fontSize: 12 }}>غير مربوط</span>}</td><td style={td}><span style={{ background: linked ? "#d1fae5" : "#fef3c7", color: linked ? "#065f46" : "#92400e", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>{linked ? "مربوط" : "ينتظر"}</span></td><td style={td}>{miniBtn("#fff", "#111", () => setMRoom({ id: r.id, code: r.code, level: r.level, capacity: r.capacity, program_id: r.program_id || "", trainer_id: r.trainer_id || "" }), "تعديل")}{miniBtn("rgba(239,68,68,.2)", "#fca5a5", () => del("classrooms", r.id, "room"), "حذف")}</td></tr>); })}</tbody>
            </table>
          </div>
        ) : null}

        {tab === "trainers" ? (
          <div style={{ background: "#fff", borderRadius: 18, padding: 8, border: "1px solid #e2e8f0", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead><tr style={{ textAlign: "right", background: "#f8fafc" }}><th style={{ ...th, color: "#64748b" }}>الاسم</th><th style={{ ...th, color: "#64748b" }}>الجوال</th><th style={{ ...th, color: "#64748b" }}>الإيميل</th><th style={{ ...th, color: "#64748b" }}>قاعاته</th><th style={{ ...th, color: "#64748b" }}>إجراءات</th></tr></thead>
              <tbody>{L(trainers).map((t) => (<tr key={t.id} style={{ borderTop: "1px solid #f1f5f9" }}><td style={{ ...td, fontWeight: 700 }}>{t.full_name || t.display_name || "-"}</td><td style={td}>{t.phone || "-"}</td><td style={td}>{t.email || "-"}</td><td style={td}><span style={{ background: "#ecfdf5", color: "#065f46", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{roomsOfTrainer(t.id)}</span></td><td style={td}>{miniBtn("#f1f5f9", "#334155", () => setMTrainer({ id: t.id, full_name: t.full_name || "", email: t.email || "", phone: t.phone || "" }), "تعديل")}{miniBtn("#fee2e2", "#b91c1c", () => del("profiles", t.id, "trainer"), "حذف")}</td></tr>))}</tbody>
            </table>
          </div>
        ) : null}

        {tab === "programs" ? (
          <div style={{ background: "#fff", borderRadius: 18, padding: 8, border: "1px solid #e2e8f0", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead><tr style={{ textAlign: "right", background: "#f8fafc" }}><th style={{ ...th, color: "#64748b" }}>البرنامج</th><th style={{ ...th, color: "#64748b" }}>قاعاته</th><th style={{ ...th, color: "#64748b" }}>إجراءات</th></tr></thead>
              <tbody>{L(programs).map((p) => (<tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}><td style={{ ...td, fontWeight: 700 }}>{p.name || p.title || "-"}</td><td style={td}><span style={{ background: "#ecfdf5", color: "#065f46", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{roomsOfProg(p.id)}</span></td><td style={td}>{miniBtn("#f1f5f9", "#334155", () => setMProg({ id: p.id, name: p.name || p.title || "" }), "تعديل")}{miniBtn("#fee2e2", "#b91c1c", () => del("programs", p.id, "program"), "حذف")}</td></tr>))}</tbody>
            </table>
          </div>
        ) : null}

        {mRoom ? (<div onClick={() => { if (!busy) setMRoom(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}><div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 20, width: "100%", maxWidth: 460 }}>
          <h3 style={{ margin: "0 0 12px", fontWeight: 900 }}>قاعة</h3>
          <input style={inp} placeholder="رمز القاعة 203" value={mRoom.code} onChange={(e) => setMRoom(Object.assign({}, mRoom, { code: e.target.value }))} />
          <select style={inp} value={mRoom.level} onChange={(e) => setMRoom(Object.assign({}, mRoom, { level: e.target.value }))}>{["A1", "A2", "B1", "B2", "C1"].map((x) => (<option key={x} value={x}>{x}</option>))}</select>
          <input style={inp} type="number" placeholder="السعة" value={mRoom.capacity} onChange={(e) => setMRoom(Object.assign({}, mRoom, { capacity: e.target.value }))} />
          <select style={inp} value={mRoom.program_id} onChange={(e) => setMRoom(Object.assign({}, mRoom, { program_id: e.target.value }))}><option value="">بدون برنامج</option>{L(programs).map((p) => (<option key={p.id} value={p.id}>{p.name || p.title}</option>))}</select>
          <select style={inp} value={mRoom.trainer_id} onChange={(e) => setMRoom(Object.assign({}, mRoom, { trainer_id: e.target.value }))}><option value="">بدون مدرّب</option>{L(trainers).map((t) => (<option key={t.id} value={t.id}>{(t.full_name || t.email) + (t.phone ? " - " + t.phone : "")}</option>))}</select>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button onClick={() => setMRoom(null)} disabled={busy} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button><button onClick={saveRoom} disabled={busy} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "..." : "حفظ"}</button></div>
        </div></div>) : null}

        {mTrainer ? (<div onClick={() => { if (!busy) setMTrainer(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}><div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 20, width: "100%", maxWidth: 440 }}>
          <h3 style={{ margin: "0 0 12px", fontWeight: 900 }}>مدرّب</h3>
          <input style={inp} placeholder="الاسم الكامل" value={mTrainer.full_name} onChange={(e) => setMTrainer(Object.assign({}, mTrainer, { full_name: e.target.value }))} />
          <input style={inp} placeholder="الجوال 05xxxxxxxx" value={mTrainer.phone} onChange={(e) => setMTrainer(Object.assign({}, mTrainer, { phone: e.target.value }))} />
          <input style={inp} placeholder="الإيميل" value={mTrainer.email} onChange={(e) => setMTrainer(Object.assign({}, mTrainer, { email: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button onClick={() => setMTrainer(null)} disabled={busy} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button><button onClick={saveTrainer} disabled={busy} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "..." : "حفظ"}</button></div>
        </div></div>) : null}

        {mProg ? (<div onClick={() => { if (!busy) setMProg(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}><div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: 20, width: "100%", maxWidth: 420 }}>
          <h3 style={{ margin: "0 0 12px", fontWeight: 900 }}>برنامج</h3>
          <input style={inp} placeholder="اسم البرنامج" value={mProg.name} onChange={(e) => setMProg(Object.assign({}, mProg, { name: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button onClick={() => setMProg(null)} disabled={busy} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: "inherit" }}>إلغاء</button><button onClick={saveProg} disabled={busy} style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "..." : "حفظ"}</button></div>
        </div></div>) : null}
      </div>
    </div>
  );
}
