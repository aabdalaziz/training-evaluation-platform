// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

const EMERALD = "#00897B", TEAL = "#1FA39A", NAVY = "#14466B", RED = "#dc2626";

export default function ManagementPage() {
  const router = useRouter();
  const [lang, setLang] = useState("ar");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("trainers");
  const [trainers, setTrainers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [cCode, setCCode] = useState("");
  const [cTrainer, setCTrainer] = useState("");
  const [msg, setMsg] = useState("");
  const ar = lang === "ar";
  const db = supabase();

  const loadAll = async () => {
    const [tr, cl] = await Promise.all([
      db.from("trainers").select("*").order("name", { ascending: true }),
      db.from("classrooms").select("*").order("code", { ascending: true })
    ]);
    setTrainers(tr.data || []);
    setClassrooms(cl.data || []);
  };

  useEffect(() => {
    setMounted(true);
    let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await loadAll(); setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(""), 3500); };
  const linked = classrooms.filter(c => c.trainer_id).length;
  const unlinked = classrooms.filter(c => !c.trainer_id).length;

  const addTrainer = async () => {
    if (!tName.trim()) { flash(ar ? "الاسم مطلوب" : "Name required"); return; }
    const { error } = await db.from("trainers").insert({ name: tName.trim(), phone: tPhone.trim() || null, email: tEmail.trim() || null });
    if (error) { flash(error.message); return; }
    setTName(""); setTPhone(""); setTEmail("");
    await loadAll(); flash(ar ? "تمت إضافة المدرب" : "Trainer added");
  };
  const deleteTrainer = async (id) => {
    if (!window.confirm(ar ? "حذف المدرب؟" : "Delete trainer?")) return;
    await db.from("classrooms").update({ trainer_id: null }).eq("trainer_id", id);
    const { error } = await db.from("trainers").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadAll(); flash(ar ? "تم الحذف" : "Deleted");
  };
  const addClassroom = async () => {
    if (!cCode.trim()) { flash(ar ? "رمز القاعة مطلوب" : "Code required"); return; }
    const { error } = await db.from("classrooms").insert({ code: cCode.trim(), trainer_id: cTrainer || null });
    if (error) { flash(error.message); return; }
    setCCode(""); setCTrainer("");
    await loadAll(); flash(ar ? "تمت إضافة القاعة" : "Room added");
  };
  const linkRoom = async (roomId, trainerId) => {
    const { error } = await db.from("classrooms").update({ trainer_id: trainerId || null }).eq("id", roomId);
    if (error) flash(error.message); else await loadAll();
  };
  const deleteClassroom = async (id) => {
    if (!window.confirm(ar ? "حذف القاعة؟" : "Delete room?")) return;
    const { error } = await db.from("classrooms").delete().eq("id", id);
    if (error) { flash(error.message); return; }
    await loadAll(); flash(ar ? "تم الحذف" : "Deleted");
  };

  if (!mounted || loading) return (<div className="mg ls"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="sp" /></div>);

  return (
    <div className="mg" style={{ direction: ar ? "rtl" : "ltr" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="top">
        <div className="top-in">
          <div className="brand-row">
            <div className="logo-box"><img src="/logos/upm.png" alt="UPM" /></div>
            <div>
              <div className="ttl">{ar ? "لوحة الإدارة المركزية" : "Central Admin Panel"}</div>
              <div className="sub">{ar ? "إدارة القاعات والمدربين" : "Manage rooms and trainers"}</div>
            </div>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => setLang(ar ? "en" : "ar")}>🌐 {ar ? "English" : "العربية"}</button>
            <button className="ghost" onClick={() => router.push("/reports")}>📊 {ar ? "التقارير" : "Reports"}</button>
          </div>
        </div>
      </header>

      {msg && <div className="toast">{msg}</div>}

      <div className="tabs">
        <button className={tab === "trainers" ? "tab-on" : "tab-off"} onClick={() => setTab("trainers")}>👨‍ {ar ? `المدربون (${trainers.length})` : `Trainers (${trainers.length})`}</button>
        <button className={tab === "rooms" ? "tab-on" : "tab-off"} onClick={() => setTab("rooms")}>🏫 {ar ? `القاعات والربط (${classrooms.length})` : `Rooms & Linking (${classrooms.length})`}</button>
      </div>

      <main className="wrap">
        {tab === "trainers" && (
          <div className="grid2">
            <div className="card">
              <h3 className="ct">➕ {ar ? "إضافة مدرب جديد" : "Add new trainer"}</h3>
              <label className="lb2">{ar ? "الاسم الكامل *" : "Full name *"}</label>
              <input className="inp" value={tName} onChange={e => setTName(e.target.value)} placeholder={ar ? "د/ اسم المدرب" : "Dr. Trainer name"} />
              <label className="lb2">{ar ? "رقم الجوال" : "Phone"}</label>
              <input className="inp" value={tPhone} onChange={e => setTPhone(e.target.value)} placeholder="05xxxxxxxx" />
              <label className="lb2">{ar ? "البريد الإلكتروني" : "Email"}</label>
              <input className="inp" value={tEmail} onChange={e => setTEmail(e.target.value)} placeholder="trainer@domain.com" />
              <button className="btn-primary" onClick={addTrainer}>{ar ? "حفظ المدرب" : "Save trainer"}</button>
            </div>
            <div className="card">
              <h3 className="ct">📌 {ar ? "إحصاءات سريعة" : "Quick stats"}</h3>
              <div className="stat-grid">
                <div className="stat"><div className="stat-n">{trainers.length}</div><div className="stat-l">{ar ? "إجمالي المدربين" : "Total trainers"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: EMERALD }}>{linked}</div><div className="stat-l">{ar ? "قاعات مربوطة" : "Linked rooms"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: RED }}>{unlinked}</div><div className="stat-l">{ar ? "قاعات بدون مدرب" : "Unlinked rooms"}</div></div>
              </div>
            </div>
            <div className="card full">
              <h3 className="ct">📋 {ar ? "قائمة المدربين" : "Trainers list"}</h3>
              <div className="tw">
                <table className="tbl">
                  <thead><tr><th className="th">{ar ? "الاسم" : "Name"}</th><th className="th">{ar ? "الجوال" : "Phone"}</th><th className="th">{ar ? "البريد" : "Email"}</th><th className="th">{ar ? "قاعاته" : "Rooms"}</th><th className="th"></th></tr></thead>
                  <tbody>
                    {trainers.map(t => {
                      const rooms = classrooms.filter(c => c.trainer_id === t.id);
                      return (<tr key={t.id}><td className="td nm">{t.name}</td><td className="td lt">{t.phone || "—"}</td><td className="td lt em">{t.email || "—"}</td><td className="td">{rooms.length}</td><td className="td"><button className="del" onClick={() => deleteTrainer(t.id)}>🗑️</button></td></tr>);
                    })}
                    {!trainers.length && <tr><td className="td es" colSpan={5}>{ar ? "لا يوجد مدربون" : "No trainers"}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "rooms" && (
          <div className="grid2">
            <div className="card">
              <h3 className="ct">➕ {ar ? "إضافة قاعة" : "Add room"}</h3>
              <label className="lb2">{ar ? "رمز القاعة *" : "Room code *"}</label>
              <input className="inp" value={cCode} onChange={e => setCCode(e.target.value)} placeholder="203 / A1" />
              <label className="lb2">{ar ? "المدرب" : "Trainer"}</label>
              <select className="inp" value={cTrainer} onChange={e => setCTrainer(e.target.value)}>
                <option value="">{ar ? "بدون مدرب" : "No trainer"}</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button className="btn-primary" onClick={addClassroom}>{ar ? "حفظ القاعة" : "Save room"}</button>
            </div>
            <div className="card">
              <h3 className="ct">📌 {ar ? "ملخص الربط" : "Linking summary"}</h3>
              <div className="stat-grid">
                <div className="stat"><div className="stat-n">{classrooms.length}</div><div className="stat-l">{ar ? "إجمالي القاعات" : "Total rooms"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: EMERALD }}>{linked}</div><div className="stat-l">{ar ? "مربوطة" : "Linked"}</div></div>
                <div className="stat"><div className="stat-n" style={{ color: RED }}>{unlinked}</div><div className="stat-l">{ar ? "غير مربوطة" : "Unlinked"}</div></div>
              </div>
            </div>
            <div className="card full">
              <h3 className="ct">🏫 {ar ? "القاعات والربط بالمدرب" : "Rooms & trainer linking"}</h3>
              <div className="tw">
                <table className="tbl">
                  <thead><tr><th className="th">{ar ? "القاعة" : "Room"}</th><th className="th">{ar ? "المدرب" : "Trainer"}</th><th className="th"></th></tr></thead>
                  <tbody>
                    {classrooms.map(c => (
                      <tr key={c.id}>
                        <td className="td nm">{c.code}</td>
                        <td className="td">
                          <select className="mini-sel" value={c.trainer_id || ""} onChange={e => linkRoom(c.id, e.target.value)}>
                            <option value="">{ar ? "بدون مدرب" : "No trainer"}</option>
                            {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="td"><button className="del" onClick={() => deleteClassroom(c.id)}>🗑️</button></td>
                      </tr>
                    ))}
                    {!classrooms.length && <tr><td className="td es" colSpan={3}>{ar ? "لا توجد قاعات" : "No rooms"}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;}
:root{--upm-navy:#14466B;--upm-navy-2:#0d3049;--upm-emerald:#00897B;--upm-teal:#1FA39A;--upm-gold:#C9A24B;}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
body{margin:0;background:#f4f6f8;}
.mg{min-height:100vh;background:#f4f6f8;font-family:Tajawal,Arial,sans-serif;color:#0f172a;padding-bottom:40px;}
.ls{display:flex;align-items:center;justify-content:center;background:var(--upm-navy);}
.sp{width:64px;height:64px;border:6px solid rgba(255,255,255,.14);border-top-color:var(--upm-teal);border-radius:50%;animation:spin 1s linear infinite;}
.top{background:linear-gradient(135deg,var(--upm-navy),var(--upm-navy-2));color:#fff;padding:22px 28px;border-bottom:3px solid var(--upm-gold);}
.top-in{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}
.brand-row{display:flex;align-items:center;gap:16px;}
.logo-box{background:#fff;border:2px solid var(--upm-gold);border-radius:16px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);}
.logo-box img{height:54px;width:auto;display:block;}
.ttl{font-size:24px;font-weight:900;}
.sub{color:#9fc3d6;font-size:13px;margin-top:4px;font-weight:700;}
.top-actions{display:flex;gap:10px;flex-wrap:wrap;}
.ghost{background:rgba(255,255,255,.10);border:1px solid rgba(201,162,75,.35);color:#fff;border-radius:12px;padding:10px 16px;font-family:inherit;font-weight:800;cursor:pointer;}
.ghost:hover{background:rgba(255,255,255,.18);}
.toast{max-width:1200px;margin:16px auto 0;padding:12px 18px;border-radius:12px;font-weight:800;text-align:center;background:#d1fae5;color:#047857;}
.tabs{max-width:1200px;margin:22px auto 0;padding:0 28px;display:flex;gap:10px;flex-wrap:wrap;}
.tab-on,.tab-off{border:0;border-radius:14px;padding:13px 20px;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;transition:.2s;}
.tab-on{background:linear-gradient(135deg,var(--upm-emerald),var(--upm-teal));color:#fff;box-shadow:0 10px 24px rgba(0,137,123,.30);border:1px solid rgba(201,162,75,.35);}
.tab-off{background:#fff;color:#475569;border:1px solid #e2e8f0;}
.tab-off:hover{background:#f8fafc;}
.wrap{max-width:1200px;margin:20px auto 0;padding:0 28px;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:24px;box-shadow:0 8px 28px rgba(15,23,42,.04);margin-bottom:20px;}
.card.full{grid-column:1 / -1;}
.ct{margin:0 0 16px;font-size:19px;font-weight:900;color:var(--upm-navy);}
.lb2{display:block;font-size:13px;font-weight:800;color:#475569;margin:12px 0 6px;}
.inp{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font-family:inherit;font-weight:700;outline:none;background:#fff;color:#0f172a;margin-bottom:4px;}
.inp:focus{border-color:var(--upm-emerald);box-shadow:0 0 0 4px rgba(0,137,123,.12);}
.btn-primary{width:100%;margin-top:16px;border:0;border-radius:12px;padding:14px;background:linear-gradient(135deg,var(--upm-emerald),var(--upm-teal));color:#fff;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 10px 24px rgba(0,137,123,.25);}
.btn-primary:hover{filter:brightness(1.05);}
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:18px;text-align:center;}
.stat-n{font-size:34px;font-weight:900;color:var(--upm-navy);}
.stat-l{font-size:12px;font-weight:800;color:#64748b;margin-top:6px;}
.tw{width:100%;overflow-x:auto;}
.tbl{width:100%;border-collapse:collapse;min-width:520px;}
.th{padding:13px;font-weight:900;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;text-align:start;}
.td{padding:13px;font-size:14px;border-bottom:1px solid #f1f5f9;font-weight:700;vertical-align:middle;}
.nm{color:#0f172a;font-weight:900;}
.lt{direction:ltr;unicode-bidi:plaintext;}
.em{color:#2563eb;}
.es{color:#94a3b8;text-align:center;font-weight:800;}
.del{background:#fff;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:14px;}
.del:hover{background:#fee2e2;}
.mini-sel{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font-family:inherit;font-weight:700;background:#fff;color:#0f172a;min-width:160px;outline:none;}
.mini-sel:focus{border-color:var(--upm-emerald);}
@media(max-width:900px){.grid2{grid-template-columns:1fr;}.stat-grid{grid-template-columns:1fr;}.top-in{flex-direction:column;align-items:flex-start;}}
`;
