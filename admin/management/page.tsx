
// @ts-nocheck
// ADMIN-V12-FULL
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

const CSS = `@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.mg,.mg *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}
.mg{direction:rtl;text-align:right;background:#f2ecdf;min-height:100vh;padding:24px;color:#0b1220}
.mg-head{position:relative;overflow:hidden;background:linear-gradient(135deg,#0b1220,#111827);border-radius:24px;padding:24px;color:#fff;margin-bottom:20px}
.mg-hbg{position:absolute;left:14px;top:0;font-size:70px;font-weight:900;color:rgba(255,255,255,.04);letter-spacing:4px}
.mg-tabs{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.mg-ton{background:#10b981;color:#fff;border:1px solid #10b981;border-radius:12px;padding:11px 20px;cursor:pointer;font-weight:800;font-size:14px}
.mg-tof{background:#fffdf9;color:#475569;border:1px solid #e8decb;border-radius:12px;padding:11px 20px;cursor:pointer;font-weight:700;font-size:14px}
.mg-g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.mg-cd{background:#fffdf9;border:1px solid #e8decb;border-radius:22px;padding:22px;box-shadow:0 6px 18px rgba(60,40,10,.04);margin-bottom:16px}
.mg-lb{display:block;font-size:12px;font-weight:700;color:#7c6f5a;margin-bottom:6px}
.mg-in{width:100%;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:11px 14px;color:#1e293b;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px}
.mg-btn{width:100%;background:linear-gradient(135deg,#10b981,#0d9488);color:#fff;border:none;border-radius:12px;padding:12px;cursor:pointer;font-weight:800;font-size:14px;font-family:inherit}
.mg-bk{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:9px 16px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit}
.mg-th{padding:12px;text-align:right;font-weight:700;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;background:#f8fafc}
.mg-td{padding:13px 12px;font-size:13.5px;border-bottom:1px solid #f1f5f9}
.mg-del{background:#fef2f2;color:#ef4444;border:1px solid #fecaca;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit}
.mg-ok{background:#d1fae5;color:#047857;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800}
.mg-wn{background:#fee2e2;color:#b91c1c;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800}
.mg-sel{width:100%;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;color:#1e293b;outline:none}
.mg-msg{background:#d1fae5;border:1px solid #a7f3d0;color:#047857;padding:12px 16px;border-radius:14px;margin-bottom:16px;font-weight:700}
.mg-err{background:#fee2e2;border:1px solid #fecaca;color:#b91c1c;padding:12px 16px;border-radius:14px;margin-bottom:16px;font-weight:700}
.mg-emp{text-align:center;color:#94a3b8;padding:30px;font-size:14px}
@media(max-width:820px){.mg-g2{grid-template-columns:1fr}}`;

export default function ManagementPage() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [trs, setTrs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [progs, setProgs] = useState([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("trainers");
  const [busy, setBusy] = useState(false);
  const [nt, setNt] = useState({ name: "", phone: "", email: "" });
  const [nr, setNr] = useState({ code: "", level: "", program_id: "", trainer_id: "" });
  const db = supabase();
  const flash = (m) => { setMsg(m); setTimeout(()=>setMsg(""),3500); };

  const loadAll = async () => {
    try {
      const [t, c, p] = await Promise.all([
        db.from("trainers").select("*").order("name"),
        db.from("classrooms").select("*").order("code"),
        db.from("programs").select("id,name").order("name"),
      ]);
      setTrs(t.data || []); setRooms(c.data || []); setProgs(p.data || []);
    } catch (x) { setErr(x?.message || "خطأ في التحميل"); }
  };

  useEffect(() => {
    setOn(true); let live = true;
    (async () => {
      try {
        const s = await db.auth.getSession();
        if (!s.data?.session) { router.push("/login"); return; }
        if (live) { await loadAll(); setLoad(false); }
      } catch (e) { if (live) { setErr(e?.message || "خطأ في الجلسة"); setLoad(false); } }
    })();
    return () => { live = false; };
  }, []);

  const addTrainer = async () => {
    if (!nt.name.trim()) { setErr("أدخل اسم المدرب"); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await db.from("trainers").insert({ name: nt.name.trim(), phone: nt.phone.trim() || null, email: nt.email.trim() || null });
      if (error) throw error;
      await loadAll(); setNt({ name: "", phone: "", email: "" }); flash("✅ تمت إضافة المدرب");
    } catch (e) { setErr("فشل الحفظ: " + (e?.message || "")); }
    finally { setBusy(false); }
  };

  const delTrainer = async (id) => {
    if (!confirm("حذف المدرب وفكّ ربطه من كل القاعات؟")) return;
    setBusy(true); setErr("");
    try {
      await db.from("classrooms").update({ trainer_id: null }).eq("trainer_id", id);
      const { error } = await db.from("trainers").delete().eq("id", id);
      if (error) throw error;
      await loadAll(); flash("🗑️ تم حذف المدرب");
    } catch (e) { setErr("فشل الحذف: " + (e?.message || "")); }
    finally { setBusy(false); }
  };

  const addRoom = async () => {
    if (!nr.code.trim()) { setErr("أدخل رمز القاعة"); return; }
    setBusy(true); setErr("");
    try {
      const { error } = await db.from("classrooms").insert({ code: nr.code.trim(), level: nr.level.trim() || null, program_id: nr.program_id || null, trainer_id: nr.trainer_id || null });
      if (error) throw error;
      await loadAll(); setNr({ code: "", level: "", program_id: "", trainer_id: "" }); flash("✅ تم إنشاء القاعة");
    } catch (e) { setErr("فشل الإنشاء: " + (e?.message || "")); }
    finally { setBusy(false); }
  };

  const delRoom = async (id) => {
    if (!confirm("حذف هذه القاعة؟")) return;
    setBusy(true); setErr("");
    try {
      const { error } = await db.from("classrooms").delete().eq("id", id);
      if (error) throw error;
      await loadAll(); flash("🗑️ تم حذف القاعة");
    } catch (e) { setErr("فشل الحذف: " + (e?.message || "")); }
    finally { setBusy(false); }
  };

  const linkTrainer = async (roomId, trainerId) => {
    setErr("");
    try {
      const { error } = await db.from("classrooms").update({ trainer_id: trainerId || null }).eq("id", roomId);
      if (error) throw error;
      await loadAll(); flash("🔗 تم ربط المدرب بالقاعة");
    } catch (e) { setErr("فشل الربط: " + (e?.message || "")); }
  };

  const tName = (tid) => { if (!tid) return null; const t = (trs||[]).find(x => x.id === tid); return t ? t.name : null; };
  const pName = (pid) => { if (!pid) return "—"; const p = (progs||[]).find(x => x.id === pid); return p ? p.name : "—"; };

  if (!on || load) return (<div className="mg" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><style dangerouslySetInnerHTML={{__html:CSS}}/><div style={{width:"46px",height:"46px",border:"5px solid #e2e8f0",borderTop:"5px solid #10b981",borderRadius:"50%",animation:"spin 1s linear infinite"}}/><p style={{marginTop:"14px",color:"#64748b",fontWeight:700}}>جارٍ تحميل وحدة الإدارة…</p></div>);

  return (<div className="mg"><style dangerouslySetInnerHTML={{__html:CSS}}/>
    <div className="mg-head"><div className="mg-hbg">ADMIN</div>
      <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px"}}>
        <div>
          <span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"999px",padding:"4px 12px",fontSize:"11px",fontWeight:700,color:"#e2e8f0",display:"inline-block",marginBottom:"6px"}}>لوحة الإدارة المركزية</span>
          <h1 style={{fontSize:"28px",fontWeight:900,margin:0}}>🏫 إدارة القاعات والمدربين</h1>
          <p style={{color:"#94a3b8",margin:"4px 0 0",fontSize:"13px"}}>إضافة المدربين، إنشاء القاعات، وربط كل مدرب بقاعته</p>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button className="mg-bk" onClick={()=>router.push("/reports")}>📊 التقارير</button>
          <button className="mg-bk" onClick={()=>router.push("/dashboard")}>🏠 الرئيسية</button>
        </div>
      </div>
    </div>

    {err && <div className="mg-err">⚠️ {err}</div>}
    {msg && <div className="mg-msg">{msg}</div>}

    <div className="mg-tabs">
      <button className={tab==="trainers"?"mg-ton":"mg-tof"} onClick={()=>setTab("trainers")}>👨‍🏫 المدربون ({(trs||[]).length})</button>
      <button className={tab==="rooms"?"mg-ton":"mg-tof"} onClick={()=>setTab("rooms")}>🏫 القاعات والربط ({(rooms||[]).length})</button>
    </div>

    {tab==="trainers" && (<div>
      <div className="mg-g2">
        <div className="mg-cd">
          <h3 style={{margin:"0 0 14px",fontSize:"16px",fontWeight:800}}>➕ إضافة مدرب جديد</h3>
          <label className="mg-lb">الاسم الكامل *</label>
          <input className="mg-in" placeholder="د/ اسم المدرب" value={nt.name} onChange={e=>setNt({...nt,name:e.target.value})}/>
          <label className="mg-lb">رقم الجوال</label>
          <input className="mg-in" placeholder="05xxxxxxxx" value={nt.phone} onChange={e=>setNt({...nt,phone:e.target.value})}/>
          <label className="mg-lb">البريد الإلكتروني (لاستلام التقارير)</label>
          <input className="mg-in" placeholder="trainer@domain.com" value={nt.email} onChange={e=>setNt({...nt,email:e.target.value})}/>
          <button className="mg-btn" onClick={addTrainer} disabled={busy}>{busy?"⏳ جارٍ الحفظ…":"حفظ المدرب"}</button>
        </div>
        <div className="mg-cd">
          <h3 style={{margin:"0 0 14px",fontSize:"16px",fontWeight:800}}>📌 إحصاءات سريعة</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div style={{background:"#f8fafc",borderRadius:"14px",padding:"16px",textAlign:"center"}}><div style={{fontSize:"12px",color:"#9a8f7d",fontWeight:700}}>إجمالي المدربين</div><div style={{fontSize:"30px",fontWeight:900,color:"#0f172a"}}>{(trs||[]).length}</div></div>
            <div style={{background:"#f8fafc",borderRadius:"14px",padding:"16px",textAlign:"center"}}><div style={{fontSize:"12px",color:"#9a8f7d",fontWeight:700}}>قاعات مربوطة</div><div style={{fontSize:"30px",fontWeight:900,color:"#10b981"}}>{(rooms||[]).filter(c=>c.trainer_id).length}</div></div>
            <div style={{background:"#f8fafc",borderRadius:"14px",padding:"16px",textAlign:"center",gridColumn:"span 2"}}><div style={{fontSize:"12px",color:"#9a8f7d",fontWeight:700}}>قاعات بدون مدرب</div><div style={{fontSize:"30px",fontWeight:900,color:"#ef4444"}}>{(rooms||[]).filter(c=>!c.trainer_id).length}</div></div>
          </div>
        </div>
      </div>
      <div className="mg-cd">
        <h3 style={{margin:"0 0 14px",fontSize:"16px",fontWeight:800}}>📋 قائمة المدربين</h3>
        {(trs||[]).length===0 ? <div className="mg-emp">لا يوجد مدربون بعد. أضف أول مدرب من النموذج أعلاه.</div> :
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th className="mg-th">#</th><th className="mg-th">الاسم</th><th className="mg-th">الجوال</th><th className="mg-th">البريد</th><th className="mg-th">القاعات</th><th className="mg-th"></th></tr></thead><tbody>
          {(trs||[]).map((t,i)=>{const my=(rooms||[]).filter(c=>c.trainer_id===t.id);return(<tr key={t.id}><td className="mg-td" style={{color:"#94a3b8",fontWeight:700}}>{i+1}</td><td className="mg-td" style={{fontWeight:800}}>{t.name}</td><td className="mg-td" style={{direction:"ltr",textAlign:"right",color:"#64748b"}}>{t.phone||"—"}</td><td className="mg-td" style={{direction:"ltr",textAlign:"right",fontSize:"12px",color:"#64748b"}}>{t.email||"—"}</td><td className="mg-td">{my.length>0?my.map(r=><span key={r.id} style={{background:"#e2e8f0",color:"#475569",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700,marginLeft:"4px"}}>{r.code}</span>):<span className="mg-wn">بلا قاعة</span>}</td><td className="mg-td"><button className="mg-del" onClick={()=>delTrainer(t.id)}>حذف</button></td></tr>);})}
        </tbody></table></div>}
      </div>
    </div>)}

    {tab==="rooms" && (<div>
      <div className="mg-cd">
        <h3 style={{margin:"0 0 14px",fontSize:"16px",fontWeight:800}}>➕ إنشاء قاعة جديدة وربطها</h3>
        <div className="mg-g2">
          <div>
            <label className="mg-lb">رمز القاعة *</label>
            <input className="mg-in" placeholder="مثل: 203" value={nr.code} onChange={e=>setNr({...nr,code:e.target.value})}/>
            <label className="mg-lb">المستوى</label>
            <input className="mg-in" placeholder="مثل: A1, B2" value={nr.level} onChange={e=>setNr({...nr,level:e.target.value})}/>
          </div>
          <div>
            <label className="mg-lb">البرنامج</label>
            <select className="mg-in" value={nr.program_id} onChange={e=>setNr({...nr,program_id:e.target.value})}><option value="">— اختر البرنامج —</option>{(progs||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <label className="mg-lb">المدرب</label>
            <select className="mg-in" value={nr.trainer_id} onChange={e=>setNr({...nr,trainer_id:e.target.value})}><option value="">— اختر المدرب —</option>{(trs||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </div>
        </div>
        <button className="mg-btn" onClick={addRoom} disabled={busy}>{busy?"⏳ جارٍ الحفظ…":"حفظ القاعة وربطها"}</button>
      </div>
      <div className="mg-cd">
        <h3 style={{margin:"0 0 14px",fontSize:"16px",fontWeight:800}}>🏫 القاعات الحالية وتعيين المدربين</h3>
        {(rooms||[]).length===0 ? <div className="mg-emp">لا توجد قاعات بعد.</div> :
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th className="mg-th">القاعة</th><th className="mg-th">المستوى</th><th className="mg-th">البرنامج</th><th className="mg-th">المدرب المعيّن</th><th className="mg-th">تغيير المدرب</th><th className="mg-th"></th></tr></thead><tbody>
          {(rooms||[]).map(c=>{const linked=tName(c.trainer_id);return(<tr key={c.id}><td className="mg-td" style={{fontSize:"20px",fontWeight:900,color:"#10b981"}}>{c.code}</td><td className="mg-td"><span style={{background:"#e2e8f0",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{c.level||"—"}</span></td><td className="mg-td" style={{fontSize:"12px",color:"#64748b"}}>{pName(c.program_id)}</td><td className="mg-td">{linked?<span className="mg-ok">{linked}</span>:<span className="mg-wn">غير معيّن</span>}</td><td className="mg-td" style={{minWidth:"180px"}}><select className="mg-sel" value={c.trainer_id||""} onChange={e=>linkTrainer(c.id,e.target.value)}><option value="">— غير معيّن —</option>{(trs||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></td><td className="mg-td"><button className="mg-del" onClick={()=>delRoom(c.id)}>حذف</button></td></tr>);})}
        </tbody></table></div>}
      </div>
    </div>)}
  </div>);
}
