// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";
const NAVY = "#173a5e";
const GOLD = "#c19a3d";
const RED = "#dc2626";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;}
@keyframes spin{to{transform:rotate(360deg);}}
.rw{background:#f4f6f8;min-height:100vh;padding:24px;font-family:'Tajawal',sans-serif;}
.wrap{max-width:1200px;margin:0 auto;}
.hero{background:linear-gradient(135deg,#0f2740,#173a5e);border-radius:24px;padding:26px 28px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px;box-shadow:0 18px 45px rgba(15,39,64,.22);flex-wrap:wrap;}
.hero h1{margin:0 0 6px;font-size:26px;font-weight:900;}
.hero p{margin:0;color:#b6c6d8;font-size:13px;font-weight:700;}
.hero-actions{display:flex;gap:10px;flex-wrap:wrap;}
.hbtn{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#fff;padding:11px 16px;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:7px;}
.hbtn:hover{background:rgba(255,255,255,.2);}
.hbtn.gold{background:rgba(193,154,61,.2);border-color:rgba(193,154,61,.5);color:#f0d9a8;}
.brand-mini{display:flex;align-items:center;gap:12px;background:#fff;padding:10px 16px;border-radius:16px;border-bottom:3px solid #c19a3d;margin-bottom:20px;}
.brand-mini img{height:40px;width:auto;object-fit:contain;}
.brand-mini div{line-height:1.4;}
.brand-mini b{color:#173a5e;font-size:14px;font-weight:900;display:block;}
.brand-mini span{color:#0d9488;font-size:11px;font-weight:800;}
.tabs{display:flex;gap:10px;margin-bottom:20px;}
.tab{flex:1;padding:14px;border-radius:14px;border:1px solid #e2e8f0;background:#fff;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;color:#64748b;transition:all .15s ease;display:flex;align-items:center;justify-content:center;gap:8px;}
.tab.active{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;border-color:transparent;box-shadow:0 8px 20px rgba(13,148,136,.3);}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:22px;}
.stat{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;text-align:center;border-bottom:4px solid #0d9488;}
.stat .num{font-size:36px;font-weight:900;direction:ltr;}
.stat .lbl{color:#64748b;font-size:13px;font-weight:800;margin-top:4px;}
.stat.warn{border-bottom-color:#dc2626;}
.stat.warn .num{color:#dc2626;}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:26px;margin-bottom:20px;box-shadow:0 8px 28px rgba(15,23,42,.035);}
.ctitle{margin:0 0 18px;font-size:19px;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:8px;}
.frm{display:grid;gap:14px;}
.lbl{display:block;font-size:13px;font-weight:900;color:#334155;margin-bottom:6px;}
.req{color:#dc2626;}
.inp,.sel{width:100%;padding:13px 14px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;font-weight:700;outline:none;font-family:inherit;font-size:14px;}
.inp:focus,.sel:focus{border-color:#0d9488;box-shadow:0 0 0 4px rgba(13,148,136,.12);}
.btn{width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;box-shadow:0 8px 20px rgba(13,148,136,.3);}
.btn:disabled{background:#94a3b8;box-shadow:none;cursor:not-allowed;}
.msg{padding:12px 16px;border-radius:12px;font-weight:800;font-size:14px;margin-bottom:14px;}
.msg.ok{background:#d1fae5;color:#047857;}
.msg.err{background:#fee2e2;color:#b91c1c;}
.tbl{width:100%;border-collapse:collapse;}
.th{padding:13px;font-weight:900;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;text-align:start;}
.td{padding:13px;font-size:14px;border-bottom:1px solid #f1f5f9;font-weight:700;vertical-align:middle;}
.tdel{background:none;border:1px solid #fca5a5;color:#dc2626;padding:7px 13px;border-radius:9px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}
.tdel:hover{background:#fee2e2;}
.empty{color:#94a3b8;text-align:center;padding:32px 12px;font-weight:800;}
.badge{display:inline-block;background:#eef2ff;color:#3730a3;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:900;}
.badge.teal{background:#ccfbf1;color:#0f766e;}
.badge.gray{background:#f1f5f9;color:#64748b;}
.ltr{direction:ltr;unicode-bidi:plaintext;}
@media(max-width:900px){.stats{grid-template-columns:1fr;}.tabs{flex-direction:column;}}
`;

export default function ManagementPage() {
  const router = useRouter();
  const db = supabase();

  const [mounted, setMounted] = useState(false);
  const [load, setLoad] = useState(true);
  const [tab, setTab] = useState("trainers"); // trainers | rooms

  const [trainers, setTrainers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  // نموذج المدرب
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [tBusy, setTBusy] = useState(false);

  // نموذج القاعة
  const [rCode, setRCode] = useState("");
  const [rTrainer, setRTrainer] = useState("");
  const [rBusy, setRBusy] = useState(false);

  const [msg, setMsg] = useState(""); // ok:... | err:...

  const fetchAll = async () => {
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
      if (on) { await fetchAll(); setLoad(false); }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trainerName = (id) => trainers.find((t) => t.id === id)?.name || "—";

  const stats = useMemo(() => {
    const linked = classrooms.filter((c) => c.trainer_id).length;
    return {
      trainers: trainers.length,
      rooms: classrooms.length,
      linked,
      unlinked: classrooms.length - linked
    };
  }, [trainers, classrooms]);

  const showMsg = (type, text) => {
    setMsg(type + ":" + text);
    setTimeout(() => setMsg(""), 4000);
  };

  /* ===== إضافة مدرب ===== */
  const addTrainer = async () => {
    if (!tName.trim()) { showMsg("err", "الاسم الكامل مطلوب"); return; }
    if (tEmail && !tEmail.includes("@")) { showMsg("err", "صيغة البريد الإلكتروني غير صحيحة"); return; }

    const dup = trainers.find((t) => t.email && tEmail && t.email.toLowerCase() === tEmail.toLowerCase());
    if (dup) { showMsg("err", "يوجد مدرب مسجل بنفس البريد"); return; }

    setTBusy(true);
    const { error } = await db.from("trainers").insert({
      name: tName.trim(),
      phone: tPhone.trim() || null,
      email: tEmail.trim() || null
    });
    setTBusy(false);

    if (error) { showMsg("err", error.message); return; }
    showMsg("ok", "تم حفظ المدرب بنجاح ✅");
    setTName(""); setTPhone(""); setTEmail("");
    await fetchAll();
  };

  /* ===== حذف مدرب ===== */
  const delTrainer = async (id, name) => {
    const linkedRooms = classrooms.filter((c) => c.trainer_id === id).length;
    const warn = linkedRooms > 0
      ? `المدرب "${name}" مرتبط بـ ${linkedRooms} قاعة. حذفه سيجعل هذه القاعات بدون مدرب.\n\nهل تريد المتابعة؟`
      : `هل تريد حذف المدرب "${name}"؟`;
    if (!window.confirm(warn)) return;

    // فك الربط أولًا
    if (linkedRooms > 0) {
      await db.from("classrooms").update({ trainer_id: null }).eq("trainer_id", id);
    }

    const { error } = await db.from("trainers").delete().eq("id", id);
    if (error) { showMsg("err", error.message); return; }
    showMsg("ok", "تم حذف المدرب");
    await fetchAll();
  };

  /* ===== إضافة قاعة ===== */
  const addRoom = async () => {
    if (!rCode.trim()) { showMsg("err", "رقم/اسم القاعة مطلوب"); return; }

    const dup = classrooms.find((c) => String(c.code).trim() === rCode.trim());
    if (dup) { showMsg("err", "هذه القاعة مسجلة مسبقًا"); return; }

    setRBusy(true);
    const { error } = await db.from("classrooms").insert({
      code: rCode.trim(),
      trainer_id: rTrainer || null
    });
    setRBusy(false);

    if (error) { showMsg("err", error.message); return; }
    showMsg("ok", "تم حفظ القاعة وربطها بنجاح ✅");
    setRCode(""); setRTrainer("");
    await fetchAll();
  };

  /* ===== حذف قاعة ===== */
  const delRoom = async (id, code) => {
    if (!window.confirm(`هل تريد حذف القاعة "${code}"؟`)) return;
    const { error } = await db.from("classrooms").delete().eq("id", id);
    if (error) { showMsg("err", error.message); return; }
    showMsg("ok", "تم حذف القاعة");
    await fetchAll();
  };

  /* ===== تغيير مدرب القاعة ===== */
  const relinkRoom = async (roomId, trainerId) => {
    const { error } = await db.from("classrooms").update({ trainer_id: trainerId || null }).eq("id", roomId);
    if (error) { showMsg("err", error.message); return; }
    showMsg("ok", "تم تحديث الربط");
    await fetchAll();
  };

  if (!mounted || load) {
    return (
      <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: NAVY }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ width: 60, height: 60, border: "6px solid rgba(255,255,255,0.1)", borderTopColor: TEAL, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="rw" style={{ direction: "rtl" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap">

        {/* الهوية */}
        <div className="brand-mini">
          <img src="/logo-upm.png" alt="جامعة الأمير مقرن" />
          <div>
            <b>جامعة الأمير مقرن بن عبدالعزيز</b>
            <span>المركز العالمي لتعليم اللغة العربية — منصة الجودة والتقييم</span>
          </div>
        </div>

        {/* الترويسة */}
        <div className="hero">
          <div>
            <h1>🏫 إدارة القاعات والمدربين والبرامج</h1>
            <p>إضافة المدربين، إنشاء القاعات، وربط كل مدرب بقاعته وبرنامجه</p>
          </div>
          <div className="hero-actions">
            <a className="hbtn" href="/">🏠 الرئيسية</a>
            <a className="hbtn gold" href="/reports">📊 التقارير</a>
          </div>
        </div>

        {/* التبويبات */}
        <div className="tabs">
          <button className={tab === "trainers" ? "tab active" : "tab"} onClick={() => setTab("trainers")}>
            👨‍🏫 المدربون ({stats.trainers})
          </button>
          <button className={tab === "rooms" ? "tab active" : "tab"} onClick={() => setTab("rooms")}>
            🏫 القاعات والربط ({stats.rooms})
          </button>
        </div>

        {/* رسائل */}
        {msg && (
          <div className={msg.startsWith("ok:") ? "msg ok" : "msg err"}>
            {msg.replace(/^(ok:|err:)/, "")}
          </div>
        )}

        {/* ========== تبويب المدربين ========== */}
        {tab === "trainers" && (
          <div>
            <div className="stats">
              <div className="stat"><div className="num" style={{ color: NAVY }}>{stats.trainers}</div><div className="lbl">إجمالي المدربين</div></div>
              <div className="stat"><div className="num" style={{ color: TEAL }}>{stats.linked}</div><div className="lbl">قاعات مربوطة</div></div>
              <div className={stats.unlinked > 0 ? "stat warn" : "stat"}><div className="num" style={{ color: stats.unlinked > 0 ? RED : TEAL }}>{stats.unlinked}</div><div className="lbl">قاعات بدون مدرب</div></div>
            </div>

            <div className="card">
              <h3 className="ctitle">➕ إضافة مدرب جديد</h3>
              <div className="frm">
                <div>
                  <label className="lbl">الاسم الكامل <span className="req">*</span></label>
                  <input className="inp" placeholder="د/ اسم المدرب" value={tName} onChange={(e) => setTName(e.target.value)} />
                </div>
                <div>
                  <label className="lbl">رقم الجوال</label>
                  <input className="inp ltr" placeholder="05xxxxxxxx" value={tPhone} onChange={(e) => setTPhone(e.target.value)} />
                </div>
                <div>
                  <label className="lbl">البريد الإلكتروني (لاستلام التقارير)</label>
                  <input className="inp ltr" placeholder="trainer@ump.edu.sa" value={tEmail} onChange={(e) => setTEmail(e.target.value)} />
                </div>
                <button className="btn" onClick={addTrainer} disabled={tBusy}>
                  {tBusy ? "⏳ جاري الحفظ..." : "حفظ المدرب"}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="ctitle">📋 قائمة المدربين</h3>
              {trainers.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="th">الاسم</th>
                        <th className="th">الجوال</th>
                        <th className="th">البريد الإلكتروني</th>
                        <th className="th">القاعات</th>
                        <th className="th">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainers.map((t) => {
                        const count = classrooms.filter((c) => c.trainer_id === t.id).length;
                        return (
                          <tr key={t.id}>
                            <td className="td" style={{ fontWeight: 900 }}>{t.name}</td>
                            <td className="td ltr">{t.phone || "—"}</td>
                            <td className="td ltr" style={{ color: "#2563eb" }}>{t.email || "—"}</td>
                            <td className="td">
                              <span className={count > 0 ? "badge teal" : "badge gray"}>{count} قاعة</span>
                            </td>
                            <td className="td">
                              <button className="tdel" onClick={() => delTrainer(t.id, t.name)}>🗑️ حذف</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">لا يوجد مدربون بعد — أضف أول مدرب من النموذج أعلاه.</div>
              )}
            </div>
          </div>
        )}

        {/* ========== تبويب القاعات ========== */}
        {tab === "rooms" && (
          <div>
            <div className="stats">
              <div className="stat"><div className="num" style={{ color: NAVY }}>{stats.rooms}</div><div className="lbl">إجمالي القاعات</div></div>
              <div className="stat"><div className="num" style={{ color: TEAL }}>{stats.linked}</div><div className="lbl">قاعات مربوطة</div></div>
              <div className={stats.unlinked > 0 ? "stat warn" : "stat"}><div className="num" style={{ color: stats.unlinked > 0 ? RED : TEAL }}>{stats.unlinked}</div><div className="lbl">قاعات بدون مدرب</div></div>
            </div>

            <div className="card">
              <h3 className="ctitle">➕ إضافة قاعة جديدة وربطها بمدرب</h3>
              <div className="frm">
                <div>
                  <label className="lbl">رقم / اسم القاعة <span className="req">*</span></label>
                  <input className="inp" placeholder="مثال: 203" value={rCode} onChange={(e) => setRCode(e.target.value)} />
                </div>
                <div>
                  <label className="lbl">المدرب المسؤول عن القاعة</label>
                  <select className="sel" value={rTrainer} onChange={(e) => setRTrainer(e.target.value)}>
                    <option value="">— بدون مدرب —</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <button className="btn" onClick={addRoom} disabled={rBusy}>
                  {rBusy ? "⏳ جاري الحفظ..." : "حفظ القاعة"}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="ctitle">🏫 قائمة القاعات والربط</h3>
              {classrooms.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="th">القاعة</th>
                        <th className="th">المدرب المرتبط</th>
                        <th className="th">تغيير الربط</th>
                        <th className="th">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classrooms.map((c) => (
                        <tr key={c.id}>
                          <td className="td"><span className="badge">قاعة {c.code}</span></td>
                          <td className="td" style={{ fontWeight: 900 }}>{c.trainer_id ? trainerName(c.trainer_id) : <span style={{ color: RED }}>بدون مدرب</span>}</td>
                          <td className="td" style={{ minWidth: 200 }}>
                            <select className="sel" value={c.trainer_id || ""} onChange={(e) => relinkRoom(c.id, e.target.value || null)}>
                              <option value="">— بدون مدرب —</option>
                              {trainers.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="td">
                            <button className="tdel" onClick={() => delRoom(c.id, c.code)}>🗑️ حذف</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">لا توجد قاعات بعد — أضف أول قاعة من النموذج أعلاه.</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
