// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { supabase as supabaseImp } from "../../../lib/supabase/client";
function getDb(){ try{ const f:any=supabaseImp; if(typeof f==='function'){ try{ const c=f(); if(c&&c.from) return c;}catch{} return f;} return f;}catch{ return supabaseImp as any; } }
export default function Management(){
  const [rooms,setRooms]=useState([]); const [trainers,setTrainers]=useState([]); const [programs,setPrograms]=useState([]);
  const [err,setErr]=useState(""); const [msg,setMsg]=useState("");
  const [form,setForm]=useState({code:"",level:"A1",program_id:"",trainer_id:""});
  const [tForm,setTForm]=useState({full_name:"",email:"",phone:""});
  const load=async()=>{ const db=getDb(); const r=await db.from("classrooms").select("*").limit(500); const p=await db.from("programs").select("*").limit(500); const t=await db.from("profiles").select("*").limit(500); setRooms(r.data||[]); setPrograms(p.data||[]); setTrainers(t.data||[]); };
  useEffect(()=>{load();},[]);
  const saveRoom=async()=>{ if(!form.code) return setErr("رمز القاعة مطلوب"); const db=getDb(); const {error}=await db.from("classrooms").insert({code:form.code,level:form.level,program_id:form.program_id||null,trainer_id:form.trainer_id||null}); if(error) setErr(error.message); else {setMsg("✅ تم إنشاء القاعة وربط المدرب والبرنامج"); setForm({code:"",level:"A1",program_id:"",trainer_id:""}); load();} };
  const saveTrainer=async()=>{ if(!tForm.full_name||!tForm.email) return setErr("الاسم والايميل مطلوب"); const db=getDb(); const id=crypto.randomUUID(); const {error}=await db.from("profiles").insert({id,full_name:tForm.full_name,email:tForm.email,phone:tForm.phone,role:"trainer"}); if(error) setErr(error.message); else {setMsg("✅ تم حفظ المدرب"); setTForm({full_name:"",email:"",phone:""}); load();}};
  return(<div style={{padding:20,fontFamily:"Cairo",direction:"rtl"}}><h2>🏫 إدارة المنصة - البرامج والقاعات والمدربين</h2>{err&&<div style={{background:"#fee2e2",padding:10,marginBottom:10}}>{err}</div>}{msg&&<div style={{background:"#dcfce7",padding:10,marginBottom:10}}>{msg}</div>}
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}><h4>إنشاء قاعة + ربط ببرنامج ومدرب</h4><input placeholder="رمز القاعة 203" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} style={{width:"100%",padding:8,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/><select value={form.program_id} onChange={e=>setForm({...form,program_id:e.target.value})} style={{width:"100%",padding:8,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}><option value="">اختر البرنامج</option>{programs.map((p:any)=><option key={p.id} value={p.id}>{p.name||p.title}</option>)}</select><select value={form.trainer_id} onChange={e=>setForm({...form,trainer_id:e.target.value})} style={{width:"100%",padding:8,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}><option value="">اختر المدرب</option>{trainers.map((t:any)=><option key={t.id} value={t.id}>{(t.full_name||t.email)+" - "+(t.phone||"")}</option>)}</select><button onClick={saveRoom} style={{background:"#10b981",color:"#fff",border:"none",padding:"9px 14px",borderRadius:8,cursor:"pointer",width:"100%"}}>حفظ القاعة وربطها</button></div>
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:14}}><h4>إضافة مدرب - اسم / جوال / ايميل</h4><input placeholder="الاسم الكامل" value={tForm.full_name} onChange={e=>setTForm({...tForm,full_name:e.target.value})} style={{width:"100%",padding:8,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/><input placeholder="05xxxxxxxx" value={tForm.phone} onChange={e=>setTForm({...tForm,phone:e.target.value})} style={{width:"100%",padding:8,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/><input placeholder="email" value={tForm.email} onChange={e=>setTForm({...tForm,email:e.target.value})} style={{width:"100%",padding:8,marginBottom:8,border:"1px solid #ddd",borderRadius:8}}/><button onClick={saveTrainer} style={{background:"#0f172a",color:"#fff",border:"none",padding:"9px 14px",borderRadius:8,cursor:"pointer",width:"100%"}}>حفظ المدرب</button></div>
  </div>
  <h4 style={{marginTop:20}}>القاعات الحالية: {rooms.length} - كلها trainer_id = NULL لهذا يظهر غير معين</h4>
  </div>);
}
