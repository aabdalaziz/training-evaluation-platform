// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { supabase as supabaseImp } from "../../../lib/supabase/client";
function getDb(){ try{ const f:any=supabaseImp; if(typeof f==='function'){ try{ const c=f(); if(c&&c.from) return c; }catch{} return f; } return f; }catch{ return supabaseImp as any; } }

export default function Management(){
  const [rooms,setRooms]=useState([]); const [trainers,setTrainers]=useState([]); const [programs,setPrograms]=useState([]);
  const [err,setErr]=useState(""); const [msg,setMsg]=useState("");
  const [roomForm,setRoomForm]=useState({code:"",level:"A1",program_id:"",trainer_id:""});
  const [tForm,setTForm]=useState({full_name:"",email:"",phone:""});

  const load=async()=>{ 
    const db=getDb(); 
    const r=await db.from("classrooms").select("*").limit(500);
    const p=await db.from("programs").select("*").limit(500);
    const t=await db.from("profiles").select("*").limit(500);
    setRooms(r.data||[]); setPrograms(p.data||[]); setTrainers(t.data||[]);
  };
  useEffect(()=>{ load(); },[]);

  const saveRoom=async()=>{
    if(!roomForm.code) return setErr("رمز القاعة مطلوب مثل 203");
    const db=getDb();
    const payload={code:roomForm.code, level:roomForm.level, program_id:roomForm.program_id||null, trainer_id:roomForm.trainer_id||null};
    const {error}=await db.from("classrooms").insert(payload);
    if(error) setErr(error.message); else { setMsg("✅ تم إنشاء القاعة وربطها بالبرنامج والمدرب"); setRoomForm({code:"",level:"A1",program_id:"",trainer_id:""}); load(); }
  };

  const saveTrainer=async()=>{
    if(!tForm.full_name.trim()) return setErr("اسم المدرب مطلوب");
    const db=getDb();
    const id=crypto.randomUUID();
    const tries=[
      {id, full_name:tForm.full_name, display_name:tForm.full_name, email:tForm.email||null, phone:tForm.phone||null, role:"trainer"},
      {id, full_name:tForm.full_name, email:tForm.email||null, phone:tForm.phone||null, role:"trainer"},
      {id, full_name:tForm.full_name, phone:tForm.phone||null, role:"trainer"},
      {id, full_name:tForm.full_name, role:"trainer"},
      {id, display_name:tForm.full_name, role:"trainer"},
    ];
    for(let payload of tries){
      // احذف القيم null
      Object.keys(payload).forEach(k=>{ if(payload[k]==null || payload[k]=="") delete payload[k]; });
      const {error}=await db.from("profiles").insert(payload);
      if(!error){ setMsg("✅ تم حفظ المدرب: "+tForm.full_name); setTForm({full_name:"",email:"",phone:""}); load(); return; }
      // لو الخطأ بسبب عمود غير موجود جرب المحاولة التالية
      if(error.message.includes("Could not find") || error.message.includes("column")){ continue; }
      setErr("فشل حفظ المدرب: "+error.message); return;
    }
    setErr("فشل بعد عدة محاولات - شغل SQL الخاص بإضافة الأعمدة أولاً ثم أعد المحاولة");
  };

  return(
    <div style={{padding:20, fontFamily:"Cairo,Tahoma", direction:"rtl", background:"#f8fafc", minHeight:"100vh"}}>
      <h2 style={{fontWeight:900}}>🏫 إدارة المنصة - البرامج والقاعات والمدربين</h2>
      {err&&<div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:10,marginBottom:12}}>{err} <button onClick={()=>setErr("")} style={{float:"left"}}>✕</button></div>}
      {msg&&<div style={{background:"#dcfce7",color:"#065f46",padding:12,borderRadius:10,marginBottom:12}}>{msg}</div>}

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:16}}>
          <h4>إضافة مدرب - اسم / جوال / ايميل</h4>
          <input placeholder="مثال: د/ ياسر" value={tForm.full_name} onChange={e=>setTForm({...tForm,full_name:e.target.value})} style={{width:"100%",padding:10,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/>
          <input placeholder="05xxxxxxxx" value={tForm.phone} onChange={e=>setTForm({...tForm,phone:e.target.value})} style={{width:"100%",padding:10,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/>
          <input placeholder="trainer@email.com" value={tForm.email} onChange={e=>setTForm({...tForm,email:e.target.value})} style={{width:"100%",padding:10,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/>
          <button onClick={saveTrainer} style={{width:"100%",background:"#0f172a",color:"#fff",padding:12,border:"none",borderRadius:10,fontWeight:800,cursor:"pointer"}}>حفظ المدرب</button>
        </div>

        <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:16}}>
          <h4>إنشاء قاعة جديدة + ربط ببرنامج ومدرب</h4>
          <input placeholder="رمز القاعة 203" value={roomForm.code} onChange={e=>setRoomForm({...roomForm,code:e.target.value})} style={{width:"100%",padding:10,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/>
          <select value={roomForm.program_id} onChange={e=>setRoomForm({...roomForm,program_id:e.target.value})} style={{width:"100%",padding:10,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}>
            <option value="">اختر البرنامج</option>{programs.map((p:any)=><option key={p.id} value={p.id}>{p.name||p.title||"برنامج"}</option>)}
          </select>
          <select value={roomForm.trainer_id} onChange={e=>setRoomForm({...roomForm,trainer_id:e.target.value})} style={{width:"100%",padding:10,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}>
            <option value="">اختر المدرب لربطه بالقاعة</option>{trainers.map((t:any)=><option key={t.id} value={t.id}>{(t.full_name||t.display_name||t.email||"مدرب")+" - "+(t.phone||"")}</option>)}
          </select>
          <button onClick={saveRoom} style={{width:"100%",background:"#10b981",color:"#fff",padding:12,border:"none",borderRadius:10,fontWeight:800,cursor:"pointer"}}>حفظ القاعة وربطها</button>
        </div>
      </div>

      <div style={{marginTop:20, background:"#0b1220", color:"#fff", borderRadius:16, padding:14}}>
        <h4 style={{margin:"0 0 10px"}}>القاعات الحالية - {rooms.length} قاعة</h4>
        <div style={{color:"#fbbf24", fontSize:12, marginBottom:10}}>ملاحظة: كل القاعات عندك حاليا trainer_id = NULL لهذا يظهر في التقرير "غير معين يحتاج تعيين". بعد ربط مدرب من الأعلى سيظهر اسمه فورا في تقرير المعلمين.</div>
        <table style={{width:"100%", borderCollapse:"collapse"}}><thead><tr style={{color:"#94a3b8", fontSize:11}}><th style={{textAlign:"right", padding:8}}>كود</th><th style={{textAlign:"right", padding:8}}>مستوى</th><th style={{textAlign:"right", padding:8}}>برنامج</th><th style={{textAlign:"right", padding:8}}>مدرب</th></tr></thead><tbody>{rooms.map((r:any)=><tr key={r.id} style={{borderTop:"1px solid rgba(255,255,255,.1)"}}><td style={{padding:8}}>{r.code}</td><td style={{padding:8}}>{r.level}</td><td style={{padding:8}}>{programs.find((p:any)=>p.id===r.program_id)?.name||"—"}</td><td style={{padding:8}}>{trainers.find((t:any)=>t.id===r.trainer_id)?.full_name||"غير معين"}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
