// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

export default function ManagementPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("trainers");
  const [nt, setNt] = useState({ name: "", phone: "", email: "" });
  const [nr, setNr] = useState({ code: "", level: "", program_id: "", trainer_id: "" });

  const db = supabase();

  const reload = async () => {
    const [r, p, t] = await Promise.all([
      db.from("classrooms").select("*").order("code"),
      db.from("programs").select("id,name").order("name"),
      db.from("trainers").select("*").order("name"),
    ]);
    setRooms(r.data || []);
    setPrograms(p.data || []);
    setTrainers(t.data || []);
  };

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const s = await db.auth.getSession();
        if (!s.data?.session) { router.push("/login"); return; }
        if (on) { await reload(); setLoad(false); }
      } catch (x) { if (on) { setErr(x.message); setLoad(false); } }
    })();
    return () => { on = false; };
  }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const saveTrainer = async () => {
    if (!nt.name.trim()) { setErr("أدخل اسم المدرب"); return; }
    setSaving(true); setErr("");
    const { error } = await db.from("trainers").insert({ name: nt.name.trim(), phone: nt.phone.trim() || null, email: nt.email.trim() || null });
    if (error) { setErr(error.message); } else { await reload(); setNt({ name: "", phone: "", email: "" }); flash("✅ تم إضافة المدرب بنجاح"); }
    setSaving(false);
  };

  const delTrainer = async (id) => {
    if (!confirm("حذف هذا المدرب نهائياً؟")) return;
    await db.from("trainers").delete().eq("id", id);
    await reload(); flash("تم الحذف");
  };

  const saveRoom = async () => {
    if (!nr.code.trim()) { setErr("أدخل رمز القاعة"); return; }
    setSaving(true); setErr("");
    const { error } = await db.from("classrooms").insert({ code: nr.code.trim(), level: nr.level.trim() || null, program_id: nr.program_id || null, trainer_id: nr.trainer_id || null });
    if (error) { setErr(error.message); } else { await reload(); setNr({ code: "", level: "", program_id: "", trainer_id: "" }); flash("✅ تم إضافة القاعة بنجاح"); }
    setSaving(false);
  };

  const linkTrainer = async (room_id, trainer_id) => {
    await db.from("classrooms").update({ trainer_id: trainer_id || null }).eq("id", room_id);
    await reload(); flash("✅ تم ربط المدرب بالقاعة");
  };

  const delRoom = async (id) => {
    if (!confirm("حذف هذه القاعة؟")) return;
    await db.from("classrooms").delete().eq("id", id);
    await reload(); flash("تم الحذف");
  };

  const tname = (tid) => trainers.find(x => x.id === tid)?.name || "غير معين";
  const pname = (pid) => programs.find(x => x.id === pid)?.name || "—";

  if (load) return <div style={S.pg}><p style={{ textAlign: "center", padding: 80, color: "#94a3b8", fontSize: 18 }}>جارٍ التحميل...</p></div>;

  return (
    <div style={S.pg}>
      <div style={S.hd}>
        <div>
          <div style={S.badge}>لوحة الإدارة</div>
          <h1 style={S.h1}>🏫 إدارة القاعات والمدربين</h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>ربط المدربين بالقاعات وإدارة بيانات المنصة بالكامل</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.backBtn} onClick={() => router.push("/reports")}>📊 التقارير</button>
          <button style={S.backBtn} onClick={() => router.push("/dashboard")}>🏠 الرئيسية</button>
        </div>
      </div>

      {err && <div style={S.errBox} onClick={() => setErr("")}>⚠️ {err} <span style={{ float: "left", cursor: "pointer" }}>✕</span></div>}
      {msg && <div style={S.okBox}>{msg}</div>}

      <div style={S.statBar}>
        <div style={S.stat}><span style={S.statN}>{rooms.length}</span><span style={S.statL}>قاعة</span></div>
        <div style={S.stat}><span style={S.statN}>{trainers.length}</span><span style={S.statL}>مدرب</span></div>
        <div style={S.stat}><span style={S.statN}>{rooms.filter(r => r.trainer_id).length}</span><span style={S.statL}>قاعة مرتبطة</span></div>
        <div style={S.stat}><span style={S.statN}>{rooms.filter(r => !r.trainer_id).length}</span><span style={{ ...S.statL, color: "#f87171" }}>بدون مدرب</span></div>
      </div>

      <div style={S.tabs}>
        {[["trainers", "👨‍🏫 المدربون", trainers.length], ["rooms", "🏫 القاعات", rooms.length], ["link", "🔗 ربط المدربين بالقاعات", null]].map(([id, t, c]) => (
          <button key={id} style={tab === id ? S.tabOn : S.tabOff} onClick={() => setTab(id)}>
            {t}{c !== null ? <span style={S.tabCount}>{c}</span> : null}
          </button>
        ))}
      </div>

      {tab === "trainers" && (
        <div>
          <div style={S.card}>
            <h2 style={S.h2}>إضافة مدرب جديد</h2>
            <div style={S.fg}>
              <div style={S.fi}>
                <label style={S.lbl}>الاسم الكامل *</label>
                <input style={S.inp} placeholder="د/ اسم المدرب" value={nt.name} onChange={e => setNt({ ...nt, name: e.target.value })} onKeyDown={e => e.key === "Enter" && saveTrainer()} />
              </div>
              <div style={S.fi}>
                <label style={S.lbl}>رقم الجوال</label>
                <input style={S.inp} placeholder="05xxxxxxxx" value={nt.phone} onChange={e => setNt({ ...nt, phone: e.target.value })} />
              </div>
              <div style={S.fi}>
                <label style={S.lbl}>البريد الإلكتروني</label>
                <input style={S.inp} placeholder="email@example.com" value={nt.email} onChange={e => setNt({ ...nt, email: e.target.value })} />
              </div>
            </div>
            <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={saveTrainer} disabled={saving}>
              {saving ? "⏳ جارٍ الحفظ..." : "➕ إضافة المدرب"}
            </button>
          </div>

          <div style={S.card}>
            <h2 style={S.h2}>قائمة المدربين ({trainers.length})</h2>
            {trainers.length === 0 ? (
              <div style={S.empty}>لا يوجد مدربون مضافون بعد. أضف أول مدرب من النموذج أعلاه.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={S.tbl}>
                  <thead>
                    <tr style={S.thr}>
                      <th style={S.th}>#</th>
                      <th style={S.th}>الاسم</th>
                      <th style={S.th}>الجوال</th>
                      <th style={S.th}>البريد الإلكتروني</th>
                      <th style={S.th}>القاعات المرتبطة</th>
                      <th style={S.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainers.map((t, i) => {
                      const myRooms = rooms.filter(r => r.trainer_id === t.id);
                      return (
                        <tr key={t.id} style={S.trw}>
                          <td style={{ ...S.td, color: "#64748b", fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ ...S.td, fontWeight: 800 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff", flexShrink: 0 }}>
                                {t.name.charAt(t.name.length > 2 ? 2 : 0)}
                              </div>
                              {t.name}
                            </div>
                          </td>
                          <td style={{ ...S.td, direction: "ltr", color: "#94a3b8" }}>{t.phone || "—"}</td>
                          <td style={{ ...S.td, direction: "ltr", fontSize: 12, color: "#94a3b8" }}>{t.email || "—"}</td>
                          <td style={S.td}>
                            {myRooms.length > 0
                              ? myRooms.map(r => <span key={r.id} style={S.roomTag}>{r.code}</span>)
                              : <span style={{ color: "#ef4444", fontSize: 12 }}>لا توجد قاعات</span>}
                          </td>
                          <td style={S.td}>
                            <button style={S.del} onClick={() => delTrainer(t.id)}>🗑 حذف</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "rooms" && (
        <div>
          <div style={S.card}>
            <h2 style={S.h2}>إضافة قاعة جديدة</h2>
            <div style={S.fg}>
              <div style={S.fi}>
                <label style={S.lbl}>رمز القاعة *</label>
                <input style={S.inp} placeholder="مثل: 203" value={nr.code} onChange={e => setNr({ ...nr, code: e.target.value })} />
              </div>
              <div style={S.fi}>
                <label style={S.lbl}>المستوى</label>
                <input style={S.inp} placeholder="مثل: A1, B2" value={nr.level} onChange={e => setNr({ ...nr, level: e.target.value })} />
              </div>
              <div style={S.fi}>
                <label style={S.lbl}>البرنامج</label>
                <select style={S.inp} value={nr.program_id} onChange={e => setNr({ ...nr, program_id: e.target.value })}>
                  <option value="">اختر البرنامج</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={S.fi}>
                <label style={S.lbl}>المدرب</label>
                <select style={S.inp} value={nr.trainer_id} onChange={e => setNr({ ...nr, trainer_id: e.target.value })}>
                  <option value="">اختر المدرب</option>
                  {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <button style={{ ...S.btn, background: "linear-gradient(135deg,#10b981,#0d9488)", opacity: saving ? 0.6 : 1 }} onClick={saveRoom} disabled={saving}>
              {saving ? "⏳ جارٍ الحفظ..." : "➕ إضافة القاعة"}
            </button>
          </div>

          <div style={S.card}>
            <h2 style={S.h2}>قائمة القاعات ({rooms.length})</h2>
            {rooms.length === 0 ? (
              <div style={S.empty}>لا توجد قاعات بعد.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={S.tbl}>
                  <thead>
                    <tr style={S.thr}>
                      <th style={S.th}>القاعة</th>
                      <th style={S.th}>المستوى</th>
                      <th style={S.th}>البرنامج</th>
                      <th style={S.th}>المدرب الحالي</th>
                      <th style={S.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(r => (
                      <tr key={r.id} style={S.trw}>
                        <td style={{ ...S.td, fontWeight: 900, fontSize: 20, color: "#10b981" }}>{r.code}</td>
                        <td style={S.td}><span style={S.lvlTag}>{r.level || "—"}</span></td>
                        <td style={{ ...S.td, fontSize: 13, color: "#94a3b8" }}>{pname(r.program_id)}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: r.trainer_id ? "#e2e8f0" : "#ef4444" }}>{tname(r.trainer_id)}</td>
                        <td style={S.td}><button style={S.del} onClick={() => delRoom(r.id)}>🗑 حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "link" && (
        <div style={S.card}>
          <h2 style={S.h2}>🔗 ربط المدربين بالقاعات</h2>
          <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>اختر المدرب المناسب لكل قاعة من القائمة المنسدلة — يُحفظ التغيير فوراً.</p>
          {rooms.length === 0 ? <div style={S.empty}>لا توجد قاعات.</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {rooms.map(r => {
                const tr = trainers.find(x => x.id === r.trainer_id);
                return (
                  <div key={r.id} style={{ background: tr ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.06)", border: `1px solid ${tr ? "rgba(16,185,129,.25)" : "rgba(239,68,68,.2)"}`, borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{r.code}</span>
                        <span style={S.lvlTag}>{r.level || "—"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: tr ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                        {tr ? "✅ مرتبطة" : "⚠️ غير مرتبطة"}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>البرنامج: {pname(r.program_id)}</div>
                    <select
                      style={{ ...S.inp, margin: 0, background: tr ? "rgba(16,185,129,.1)" : "rgba(255,255,255,.05)" }}
                      value={r.trainer_id || ""}
                      onChange={e => linkTrainer(r.id, e.target.value)}>
                      <option value="">— اختر المدرب —</option>
                      {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {tr && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,.1)", borderRadius: 10, fontSize: 13 }}>
                        <b style={{ color: "#10b981" }}>{tr.name}</b>
                        {tr.phone && <span style={{ color: "#64748b", marginRight: 8, direction: "ltr" }}>{tr.phone}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  pg: { direction: "rtl", fontFamily: "Cairo, Tahoma, sans-serif", background: "#f8fafc", minHeight: "100vh", padding: 24, color: "#1e293b" },
  hd: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  badge: { background: "#eff6ff", color: "#2563eb", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, display: "inline-block", marginBottom: 8 },
  h1: { fontSize: 24, fontWeight: 900, margin: "0 0 4px", color: "#0f172a" },
  h2: { fontSize: 17, fontWeight: 800, margin: "0 0 18px", color: "#0f172a", paddingBottom: 12, borderBottom: "2px solid #f1f5f9" },
  backBtn: { background: "#fff", border: "1px solid #e2e8f0", color: "#334155", padding: "9px 16px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontFamily: "inherit", fontSize: 13 },
  errBox: { background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", padding: "12px 16px", borderRadius: 12, marginBottom: 16, cursor: "pointer", fontWeight: 600 },
  okBox: { background: "#d1fae5", border: "1px solid #a7f3d0", color: "#047857", padding: "12px 16px", borderRadius: 12, marginBottom: 16, fontWeight: 700 },
  statBar: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 },
  stat: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "16px", textAlign: "center" },
  statN: { display: "block", fontSize: 32, fontWeight: 900, color: "#0f172a" },
  statL: { display: "block", fontSize: 12, color: "#64748b", fontWeight: 700, marginTop: 4 },
  tabs: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tabOn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: "inherit" },
  tabOff: { background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit" },
  tabCount: { background: "#f1f5f9", color: "#475569", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 800, marginRight: 6 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 24, marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,.03)" },
  fg: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 16 },
  fi: { display: "flex", flexDirection: "column", gap: 6 },
  lbl: { fontSize: 13, fontWeight: 700, color: "#475569" },
  inp: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", color: "#1e293b", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", transition: ".2s" },
  btn: { background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", cursor: "pointer", fontWeight: 800, fontSize: 15, fontFamily: "inherit" },
  tbl: { width: "100%", borderCollapse: "collapse" },
  thr: { background: "#f8fafc" },
  th: { padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: 13, color: "#64748b", borderBottom: "2px solid #f1f5f9" },
  trw: { borderBottom: "1px solid #f1f5f9", transition: ".15s" },
  td: { padding: "14px 14px", fontSize: 14 },
  del: { background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit" },
  roomTag: { background: "#d1fae5", color: "#047857", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 800, marginLeft: 4 },
  lvlTag: { background: "#eff6ff", color: "#2563eb", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 800 },
  empty: { textAlign: "center", padding: 30, color: "#94a3b8", fontSize: 14 },
};
