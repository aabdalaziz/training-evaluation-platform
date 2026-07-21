// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

// ==========================================
// الأنماط البصرية المتناسقة مع الهوية الفاخرة للمنصة
// ==========================================
const CSS_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
.mg-wrap, .mg-wrap * { font-family: 'Cairo', Tahoma, sans-serif; box-sizing: border-box; }
.mg-wrap { direction: rtl; text-align: right; background: #f2ecdf; min-height: 100vh; padding: 24px; color: #0b1220; }
.mg-head { position: relative; overflow: hidden; background: linear-gradient(135deg, #0b1220, #111827); border-radius: 24px; padding: 24px; color: #fff; margin-bottom: 20px; }
.mg-head-bg { position: absolute; left: 16px; top: 0; font-size: 70px; font-weight: 900; color: rgba(255,255,255,0.04); letter-spacing: 4px; }
.mg-head-badge { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 700; color: #e2e8f0; display: inline-block; margin-bottom: 6px; }
.mg-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.mg-tab-on { background: #10b981; color: #fff; border: 1px solid #10b981; border-radius: 12px; padding: 11px 20px; cursor: pointer; font-weight: 800; font-size: 14px; }
.mg-tab-off { background: #fffdf9; color: #475569; border: 1px solid #e8decb; border-radius: 12px; padding: 11px 20px; cursor: pointer; font-weight: 700; font-size: 14px; }
.mg-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.mg-card { background: #fffdf9; border: 1px solid #e8decb; border-radius: 20px; padding: 22px; box-shadow: 0 6px 18px rgba(60,40,10,0.04); margin-bottom: 16px; }
.mg-label { display: block; font-size: 12px; font-weight: 700; color: #7c6f5a; margin-bottom: 6px; }
.mg-input { width: 100%; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 14px; color: #1e293b; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 12px; }
.mg-btn-teal { width: 100%; background: linear-gradient(135deg,#10b981,#0d9488); color: #fff; border: none; border-radius: 12px; padding: 12px; cursor: pointer; font-weight: 800; font-size: 14px; font-family: inherit; }
.mg-btn-dark { width: 100%; background: #0b1220; color: #fff; border: none; border-radius: 12px; padding: 12px; cursor: pointer; font-weight: 800; font-size: 14px; font-family: inherit; }
.mg-btn-back { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 10px; padding: 9px 16px; cursor: pointer; font-weight: 700; font-size: 13px; font-family: inherit; }
.mg-table { width: 100%; border-collapse: collapse; }
.mg-th { padding: 12px; text-align: right; font-weight: 700; font-size: 13px; color: #64748b; border-bottom: 2px solid #eef2f6; background: #f8fafc; }
.mg-td { padding: 13px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; }
.mg-del { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 8px; padding: 6px 12px; cursor: pointer; font-weight: 700; font-size: 12px; font-family: inherit; }
.mg-badge { background: #e2e8f0; color: #475569; border-radius: 6px; padding: 2px 9px; font-size: 11px; font-weight: 700; }
.mg-badge-ok { background: #d1fae5; color: #047857; border-radius: 999px; padding: 3px 11px; font-size: 11px; font-weight: 800; }
.mg-badge-warn { background: #fee2e2; color: #b91c1c; border-radius: 999px; padding: 3px 11px; font-size: 11px; font-weight: 800; }
.mg-link-sel { width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: inherit; color: #1e293b; outline: none; }
.mg-msg { background: #d1fae5; border: 1px solid #a7f3d0; color: #047857; padding: 12px 16px; border-radius: 14px; margin-bottom: 16px; font-weight: 700; }
.mg-err { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px 16px; border-radius: 14px; margin-bottom: 16px; font-weight: 700; }
.mg-empty { text-align: center; color: #94a3b8; padding: 30px; font-size: 14px; }
.mg-room-code { font-size: 20px; font-weight: 900; color: #10b981; }
@media(max-width: 820px){ .mg-grid2 { grid-template-columns: 1fr; } }
`;

export default function ManagementPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("trainers");
  const [busy, setBusy] = useState(false);

  const [nt, setNt] = useState({ name: "", phone: "", email: "" });
  const [nr, setNr] = useState({ code: "", level: "", program_id: "", trainer_id: "" });

  const db = supabase();
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const loadAll = async () => {
    try {
      const [t, c, p] = await Promise.all([
        db.from("trainers").select("*").order("name"),
        db.from("classrooms").select("*").order("code"),
        db.from("programs").select("id,name").order("name"),
      ]);
      setTrainers(t.data || []);
      setClassrooms(c.data || []);
      setPrograms(p.data || []);
    } catch (x) {
      setErr(x && x.message ? x.message : "خطأ في التحميل");
    }
  };

  useEffect(() => {
    setMounted(true);
    let on = true;
    (async () => {
      try {
        const s = await db.auth.getSession();
        if (!s.data || !s.data.session) { router.push("/login"); return; }
        if (on) { await loadAll(); setLoad(false); }
      } catch (e) {
        if (on) { setErr(e && e.message ? e.message : "خطأ في الجلسة"); setLoad(false); }
      }
    })();
    return () => { on = false; };
  }, []);

  const addTrainer = async () => {
    if (!nt.name.trim()) { setErr("أدخل اسم المدرب"); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await db.from("trainers").insert({
        name: nt.name.trim(),
        phone: nt.phone.trim() || null,
        email: nt.email.trim() || null,
      });
      if (error) throw error;
      await loadAll();
      setNt({ name: "", phone: "", email: "" });
      flash("✅ تم إضافة المدرب بنجاح");
    } catch (e) {
      setErr("فشل الحفظ: " + (e && e.message ? e.message : "تحقق من صلاحيات القاعدة"));
    } finally { setBusy(false); }
  };

  const delTrainer = async (id) => {
    if (!confirm("حذف هذا المدرب وفك ربطه من جميع القاعات؟")) return;
    setBusy(true); setErr("");
    try {
      await db.from("classrooms").update({ trainer_id: null }).eq("trainer_id", id);
      const { error } = await db.from("trainers").delete().eq("id", id);
      if (error) throw error;
      await loadAll();
      flash("🗑️ تم حذف المدرب");
    } catch (e) {
      setErr("فشل الحذف: " + (e && e.message ? e.message : ""));
    } finally { setBusy(false); }
  };

  const addRoom = async () => {
    if (!nr.code.trim()) { setErr("أدخل رمز القاعة"); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await db.from("classrooms").insert({
        code: nr.code.trim(),
        level: nr.level.trim() || null,
        program_id: nr.program_id || null,
        trainer_id: nr.trainer_id || null,
      });
      if (error) throw error;
      await loadAll();
      setNr({ code: "", level: "", program_id: "", trainer_id: "" });
      flash("✅ تم إنشاء القاعة بنجاح");
    } catch (e) {
      setErr("فشل الإنشاء: " + (e && e.message ? e.message : ""));
    } finally { setBusy(false); }
  };

  const delRoom = async (id) => {
    if (!confirm("حذف هذه القاعة؟")) return;
    setBusy(true); setErr("");
    try {
      const { error } = await db.from("classrooms").delete().eq("id", id);
      if (error) throw error;
      await loadAll();
      flash("🗑️ تم حذف القاعة");
    } catch (e) {
      setErr("فشل الحذف: " + (e && e.message ? e.message : ""));
    } finally { setBusy(false); }
  };

  const linkTrainer = async (roomId, trainerId) => {
    setErr("");
    try {
      const { error } = await db.from("classrooms").update({ trainer_id: trainerId || null }).eq("id", roomId);
      if (error) throw error;
      await loadAll();
      flash("🔗 تم ربط المدرب بالقاعة");
    } catch (e) {
      setErr("فشل ال ربط: " + (e && e.message ? e.message : ""));
    }
  };

  const tName = (tid) => {
    if (!tid) return null;
    const t = trainers.find(x => x.id === tid);
    return t ? t.name : null;
  };
  const pName = (pid) => {
    if (!pid) return "—";
    const p = programs.find(x => x.id === pid);
    return p ? p.name : "—";
  };

  if (!mounted || load) {
    return (
      <div className="mg-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS_STYLES }} />
        <div style={{ width: "48px", height: "48px", borderWidth: "5px", borderStyle: "solid", borderColor: "#e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        <p style={{ marginTop: "16px", color: "#64748b", fontWeight: 700 }}>جاري تحميل وحدة الإدارة...</p>
        <style dangerouslySetInnerHTML={{ __html: "@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}" }} />
      </div>
    );
  }

  return (
    <div className="mg-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS_STYLES }} />

      <div className="mg-head">
        <div className="mg-head-bg">ADMIN</div>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span className="mg-head-badge">لوحة الإدارة المركزية</span>
            <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0 }}>🏫 إدارة القاعات والمدربين والبرامج</h1>
            <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: "13px" }}>إضافة المدربين، إنشاء القاعات، وربط كل مدرب بقاعته وبرنامجه</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button className="mg-btn-back" onClick={() => router.push("/reports")}>📊 التقارير</button>
            <button className="mg-btn-back" onClick={() => router.push("/dashboard")}>🏠 الرئيسية</button>
          </div>
        </div>
      </div>

      {err && <div className="mg-err">⚠️ {err}</div>}
      {msg && <div className="mg-msg">{msg}</div>}

      <div className="mg-tabs">
        <button className={tab === "trainers" ? "mg-tab-on" : "mg-tab-off"} onClick={() => setTab("trainers")}>👨‍🏫 المدربون ({trainers.length})</button>
        <button className={tab === "rooms" ? "mg-tab-on" : "mg-tab-off"} onClick={() => setTab("rooms")}>🏫 القاعات والربط ({classrooms.length})</button>
      </div>

      {tab === "trainers" && (
        <div>
          <div className="mg-grid2">
            <div className="mg-card">
              <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 800 }}>➕ إضافة مدرب جديد</h3>
              <label className="mg-label">الاسم الكامل *</label>
              <input className="mg-input" placeholder="د/ اسم المدرب" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} />
              <label className="mg-label">رقم الجوال</label>
              <input className="mg-input" placeholder="05xxxxxxxx" value={nt.phone} onChange={(e) => setNt({ ...nt, phone: e.target.value })} />
              <label className="mg-label">البريد الإلكتروني (لاستلام التقارير)</label>
              <input className="mg-input" placeholder="trainer@domain.com" value={nt.email} onChange={(e) => setNt({ ...nt, email: e.target.value })} />
              <button className="mg-btn-teal" onClick={addTrainer} disabled={busy}>{busy ? "⏳ جاري الحفظ..." : "حفظ المدرب"}</button>
            </div>

            <div className="mg-card">
              <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 800 }}>📌 إحصاءات سريعة</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#9a8f7d", fontWeight: 700 }}>إجمالي المدربين</div>
                  <div style={{ fontSize: "30px", fontWeight: 900, color: "#0f172a" }}>{trainers.length}</div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#9a8f7d", fontWeight: 700 }}>قاعات مربوطة</div>
                  <div style={{ fontSize: "30px", fontWeight: 900, color: "#10b981" }}>{classrooms.filter((c) => c.trainer_id).length}</div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "16px", textAlign: "center", gridColumn: "span 2" }}>
                  <div style={{ fontSize: "12px", color: "#9a8f7d", fontWeight: 700 }}>قاعات بدون مدرب</div>
                  <div style={{ fontSize: "30px", fontWeight: 900, color: "#ef4444" }}>{classrooms.filter((c) => !c.trainer_id).length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mg-card">
            <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 800 }}>📋 قائمة المدربين</h3>
            {trainers.length === 0 ? (
              <div className="mg-empty">لا يوجد مدربون بعد. أضف أول مدرب من النموذج أعلاه.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="mg-table">
                  <thead>
                    <tr>
                      <th className="mg-th">#</th>
                      <th className="mg-th">الاسم</th>
                      <th className="mg-th">الجوال</th>
                      <th className="mg-th">البريد</th>
                      <th className="mg-th">القاعات</th>
                      <th className="mg-th"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainers.map((t, i) => {
                      const myRooms = classrooms.filter((c) => c.trainer_id === t.id);
                      return (
                        <tr key={t.id}>
                          <td className="mg-td" style={{ color: "#94a3b8", fontWeight: 700 }}>{i + 1}</td>
                          <td className="mg-td" style={{ fontWeight: 800 }}>{t.name}</td>
                          <td className="mg-td" style={{ direction: "ltr", textAlign: "right", color: "#64748b" }}>{t.phone || "—"}</td>
                          <td className="mg-td" style={{ direction: "ltr", textAlign: "right", fontSize: "12px", color: "#64748b" }}>{t.email || "—"}</td>
                          <td className="mg-td">
                            {myRooms.length > 0
                              ? myRooms.map((r) => <span key={r.id} className="mg-badge" style={{ marginLeft: "4px" }}>{r.code}</span>)
                              : <span className="mg-badge-warn">بلا قاعة</span>}
                          </td>
                          <td className="mg-td"><button className="mg-del" onClick={() => delTrainer(t.id)}>حذف</button></td>
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
          <div className="mg-card">
            <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 800 }}>➕ إنشاء قاعة جديدة وربطها</h3>
            <div className="mg-grid2">
              <div>
                <label className="mg-label">رمز القاعة *</label>
                <input className="mg-input" placeholder="مثل: 203" value={nr.code} onChange={(e) => setNr({ ...nr, code: e.target.value })} />
                <label className="mg-label">المستوى</label>
                <input className="mg-input" placeholder="مثل: A1, B2" value={nr.level} onChange={(e) => setNr({ ...nr, level: e.target.value })} />
              </div>
              <div>
                <label className="mg-label">البرنامج</label>
                <select className="mg-input" value={nr.program_id} onChange={(e) => setNr({ ...nr, program_id: e.target.value })}>
                  <option value="">— اختر البرنامج —</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <label className="mg-label">المدرب</label>
                <select className="mg-input" value={nr.trainer_id} onChange={(e) => setNr({ ...nr, trainer_id: e.target.value })}>
                  <option value="">— اختر المدرب —</option>
                  {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <button className="mg-btn-dark" onClick={addRoom} disabled={busy}>{busy ? "⏳ جاري الحفظ..." : "حفظ القاعة وربطها"}</button>
          </div>

          <div className="mg-card">
            <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 800 }}>🏫 القاعات الحالية وتعيين المدربين</h3>
            {classrooms.length === 0 ? (
              <div className="mg-empty">لا توجد قاعات بعد.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="mg-table">
                  <thead>
                    <tr>
                      <th className="mg-th">القاعة</th>
                      <th className="mg-th">المستوى</th>
                      <th className="mg-th">البرنامج</th>
                      <th className="mg-th">المدرب المعيّن</th>
                      <th className="mg-th">تغيير المدرب</th>
                      <th className="mg-th"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classrooms.map((c) => {
                      const linked = tName(c.trainer_id);
                      return (
                        <tr key={c.id}>
                          <td className="mg-td"><span className="mg-room-code">{c.code}</span></td>
                          <td className="mg-td"><span className="mg-badge">{c.level || "—"}</span></td>
                          <td className="mg-td" style={{ fontSize: "12px", color: "#64748b" }}>{pName(c.program_id)}</td>
                          <td className="mg-td">
                            {linked
                              ? <span className="mg-badge-ok">{linked}</span>
                              : <span className="mg-badge-warn">غير معيّن</span>}
                          </td>
                          <td className="mg-td" style={{ minWidth: "180px" }}>
                            <select className="mg-link-sel" value={c.trainer_id || ""} onChange={(e) => linkTrainer(c.id, e.target.value)}>
                              <option value="">— غير معيّن —</option>
                              {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                          <td className="mg-td"><button className="mg-del" onClick={() => delRoom(c.id)}>حذف</button></td>
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
    </div>
  );
}
