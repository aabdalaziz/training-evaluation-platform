// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px;flex-direction:column}.tw{overflow:auto;border-radius:16px}::-webkit-scrollbar{height:6px;width:6px}input,select,textarea{font-family:inherit}@media print{.np{display:none!important}}";
const NAVY="#0b1220"; const TEAL="#10b981";
function getDb(){ try{ const fn:any=supabase; const c=fn(); return c?.from?c:fn; }catch{ return supabase as any; } }
function avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

export default function AdminManagement(){
  const router=useRouter();
  const [tab,setTab]=useState("classrooms");
  const [programs,setPrograms]=useState([]); const [rooms,setRooms]=useState([]); const [trainers,setTrainers]=useState([]);
  const [evaluations,setEvaluations]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState(""); const [msg,setMsg]=useState("");
  const [q,setQ]=useState("");

  // forms
  const [showProg,setShowProg]=useState(false); const [progForm,setProgForm]=useState({id:null,name:"",description:""});
  const [showRoom,setShowRoom]=useState(false); const [roomForm,setRoomForm]=useState({id:null,code:"",level:"A1",capacity:20,program_id:"",trainer_id:""});
  const [showTrainer,setShowTrainer]=useState(false); const [trainerForm,setTrainerForm]=useState({id:null,full_name:"",email:"",phone:""});

  const fetchAll=async()=>{
    setLoad(true);
    try{
      const db=getDb();
      const [pRes,cRes,tRes,eRes]=await Promise.all([
        db.from("programs").select("*").order("created_at",{ascending:false}).limit(500),
        db.from("classrooms").select("*").order("code",{ascending:true}).limit(1000),
        db.from("profiles").select("*").order("full_name",{ascending:true}).limit(1000),
        db.from("evaluations").select("id,classroom_id,classroom_number").limit(2000)
      ]);
      if(pRes.error) throw new Error("programs: "+pRes.error.message);
      if(cRes.error) throw new Error("classrooms: "+cRes.error.message);
      setPrograms(pRes.data||[]); setRooms(cRes.data||[]); setTrainers(tRes.data||[]); setEvaluations(eRes.data||[]);
    }catch(e:any){ setErr(e.message); } finally{ setLoad(false); }
  };

  useEffect(()=>{ fetchAll(); },[]);

  const progMap=useMemo(()=>{ const m={}; programs.forEach((p:any)=>m[p.id]=p.name||p.title||p.name_ar||"برنامج"); return m; },[programs]);
  const trainerMap=useMemo(()=>{ const m={}; trainers.forEach((t:any)=>m[t.id]=t.full_name||t.display_name||t.name||t.email||"مدرب"); return m; },[trainers]);

  // save program
  const saveProgram=async()=>{
    if(!progForm.name.trim()){ setErr("اسم البرنامج مطلوب"); return; }
    const db=getDb();
    try{
      if(progForm.id){
        const {error}=await db.from("programs").update({name:progForm.name, description:progForm.description}).eq("id",progForm.id);
        if(error) throw error;
      }else{
        // حاول name، لو فشل جرب title ثم name_ar
        let {error}=await db.from("programs").insert({name:progForm.name, description:progForm.description});
        if(error && error.message.includes("name")){ const r2=await db.from("programs").insert({title:progForm.name, description:progForm.description}); error=r2.error; }
        if(error) throw error;
      }
      setShowProg(false); setProgForm({id:null,name:"",description:""}); setMsg("✅ تم حفظ البرنامج"); fetchAll();
    }catch(e:any){ setErr(e.message); }
  };

  const saveRoom=async()=>{
    if(!roomForm.code.trim()){ setErr("رمز القاعة مطلوب مثل 203"); return; }
    const db=getDb();
    const payload={code:roomForm.code.trim(), level:roomForm.level, capacity:Number(roomForm.capacity)||20, program_id:roomForm.program_id||null, trainer_id:roomForm.trainer_id||null};
    try{
      if(roomForm.id){
        const {error}=await db.from("classrooms").update(payload).eq("id",roomForm.id); if(error) throw error;
      }else{
        const {error}=await db.from("classrooms").insert(payload); if(error) throw error;
      }
      setShowRoom(false); setMsg("✅ تم حفظ القاعة وربط المدرب والبرنامج"); fetchAll();
    }catch(e:any){ setErr(e.message); }
  };

  const saveTrainer=async()=>{
    if(!trainerForm.full_name.trim()||!trainerForm.email.trim()){ setErr("الاسم والايميل مطلوبان"); return; }
    const db=getDb();
    try{
      if(trainerForm.id){
        const {error}=await db.from("profiles").update({full_name:trainerForm.full_name, email:trainerForm.email, phone:trainerForm.phone, role:"trainer"}).eq("id",trainerForm.id); if(error) throw error;
      }else{
        const id=crypto.randomUUID();
        const {error}=await db.from("profiles").insert({id, full_name:trainerForm.full_name, email:trainerForm.email, phone:trainerForm.phone, role:"trainer"}); if(error) throw error;
      }
      setShowTrainer(false); setMsg("✅ تم حفظ بيانات المدرب"); fetchAll();
    }catch(e:any){ setErr("فشل حفظ المدرب: "+e.message+" - تأكد من إضافة عمود phone في profiles"); }
  };

  const delProg=async(id:any)=>{ if(!confirm("حذف البرنامج؟")) return; const db=getDb(); const {error}=await db.from("programs").delete().eq("id",id); if(error) setErr(error.message); else fetchAll(); }
  const delRoom=async(id:any)=>{ if(!confirm("حذف القاعة؟")) return; const db=getDb(); const {error}=await db.from("classrooms").delete().eq("id",id); if(error) setErr(error.message); else fetchAll(); }
  const delTrainer=async(id:any)=>{ if(!confirm("حذف المدرب؟ القاعات المرتبطة ستصبح بدون مدرب")) return; const db=getDb(); const {error}=await db.from("profiles").delete().eq("id",id); if(error) setErr(error.message); else{ await db.from("classrooms").update({trainer_id:null}).eq("trainer_id",id); fetchAll(); } }

  const filteredPrograms=useMemo(()=> programs.filter((p:any)=> (p.name||p.title||"").toLowerCase().includes(q.toLowerCase())),[programs,q]);
  const filteredRooms=useMemo(()=> rooms.filter((r:any)=> String(r.code).includes(q) || String(r.level).includes(q) || (trainerMap[r.trainer_id]||"").toLowerCase().includes(q.toLowerCase())),[rooms,q,trainerMap]);
  const filteredTrainers=useMemo(()=> trainers.filter((t:any)=> (t.full_name||"").toLowerCase().includes(q.toLowerCase()) || (t.email||"").includes(q)),[trainers,q]);

  if(load) return <div style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><style dangerouslySetInnerHTML={{__html:CSS}}/>جارٍ تحميل لوحة الإدارة...</div>;

  return(
    <div className="rw" style={{background:"#f1ece1",minHeight:"100vh",padding:16}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div style={{maxWidth:1250,margin:"0 auto"}}>
        <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0b1220,#111827)",borderRadius:24,padding:24,color:"#fff",marginBottom:14}}>
          <div style={{position:"absolute",left:18,top:0,fontSize:78,fontWeight:900,color:"rgba(255,255,255,.05)"}}>ADMIN</div>
          <div style={{position:"relative",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,alignItems:"center"}}>
            <div><h1 style={{margin:0,fontSize:28,fontWeight:900}}>إدارة المنصة - مدير النظام</h1><p style={{margin:"6px 0 0",color:"#94a3b8",fontSize:13}}>إنشاء البرامج والقاعات وبيانات المدربين وربط المدربين بالقاعات والبرامج</p></div>
            <div style={{display:"flex",gap:8}}><button onClick={()=>router.push("/dashboard")} style={{background:"rgba(255,255,255,.1)",color:"#fff",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,padding:"9px 14px",cursor:"pointer"}}>لوحة التحكم</button><button onClick={()=>router.push("/reports")} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",cursor:"pointer",fontWeight:800}}>التقارير</button></div>
          </div>
        </div>

        {err && <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:12,marginBottom:12}}>{err} <button onClick={()=>setErr("")} style={{float:"left",background:"transparent",border:"none",cursor:"pointer"}}>✕</button></div>}
        {msg && <div style={{background:"#dcfce7",color:"#065f46",padding:12,borderRadius:12,marginBottom:12}}>{msg} <button onClick={()=>setMsg("")} style={{float:"left",background:"transparent",border:"none",cursor:"pointer"}}>✕</button></div>}

        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}} className="np">
          <div style={{background:"#fff",borderRadius:14,padding:6,display:"flex",gap:6,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
            {[{id:"classrooms",t:`القاعات (${rooms.length})`,ic:"🏫"},{id:"trainers",t:`المدربون (${trainers.length})`,ic:"👨‍🏫"},{id:"programs",t:`البرامج (${programs.length})`,ic:"📚"}].map(x=><button key={x.id} onClick={()=>setTab(x.id)} style={{background:tab===x.id?NAVY:"#fff",color:tab===x.id?"#fff":"#475569",border:"1px solid #e2e8f0",borderRadius:10,padding:"9px 16px",cursor:"pointer",fontWeight:tab===x.id?800:600}}>{x.ic} {x.t}</button>)}
          </div>
          <div style={{flex:1}}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث..." style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",minWidth:200}}/>
          {tab==="programs" && <button onClick={()=>{setProgForm({id:null,name:"",description:""}); setShowProg(true);}} style={{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:800,cursor:"pointer"}}>+ برنامج جديد</button>}
          {tab==="classrooms" && <button onClick={()=>{setRoomForm({id:null,code:"",level:"A1",capacity:20,program_id:programs[0]?.id||"",trainer_id:""}); setShowRoom(true);}} style={{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:800,cursor:"pointer"}}>+ قاعة جديدة</button>}
          {tab==="trainers" && <button onClick={()=>{setTrainerForm({id:null,full_name:"",email:"",phone:""}); setShowTrainer(true);}} style={{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:800,cursor:"pointer"}}>+ مدرب جديد</button>}
        </div>

        {tab==="programs" && (
          <div className="tw" style={{background:"#fff",borderRadius:18,padding:8,border:"1px solid #ece4d4"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#f8fafc"}}><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>البرنامج</th><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>القاعات</th><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>إجراءات</th></tr></thead><tbody>
              {filteredPrograms.map((p:any)=>{ const count=rooms.filter((r:any)=>r.program_id===p.id).length; return(<tr key={p.id} style={{borderTop:"1px solid #f1f5f9"}}><td style={{padding:12}}><b>{p.name||p.title}</b><div style={{fontSize:11,color:"#94a3b8"}}>{p.description||""}</div></td><td style={{padding:12}}><span style={{background:"#ecfdf5",color:"#065f46",padding:"4px 10px",borderRadius:999,fontSize:12,fontWeight:700}}>{count} قاعة</span></td><td style={{padding:12}}><button onClick={()=>{setProgForm({id:p.id,name:p.name||p.title||"",description:p.description||""}); setShowProg(true);}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",marginLeft:6}}>تعديل</button><button onClick={()=>delProg(p.id)} style={{background:"#fee2e2",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>حذف</button></td></tr>); })}
            </tbody></table>
          </div>
        )}

        {tab==="classrooms" && (
          <div className="tw" style={{background:NAVY,borderRadius:22,padding:14,border:"1px solid #1e293b"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h3 style={{margin:0,color:"#fff",fontWeight:900}}>🏫 القاعات وربط المدربين بالبرامج</h3><span style={{color:"#5eead4",fontSize:12}}>{rooms.length} قاعة، {rooms.filter((r:any)=>!r.trainer_id).length} بدون مدرب</span></div>
            <div style={{maxHeight:620, overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}><thead><tr style={{textAlign:"right"}}><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>كود</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>المستوى</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>السعة</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>البرنامج</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>المدرب (اسم/جوال/ايميل)</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>حالة</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>إجراءات</th></tr></thead><tbody>
              {filteredRooms.map((r:any)=>{ const hasTrainer=!!r.trainer_id; const trainer=trainers.find((t:any)=>t.id===r.trainer_id); return(
                <tr key={r.id} style={{borderTop:"1px solid rgba(255,255,255,.06)",background:hasTrainer?"rgba(16,185,129,.05)":"rgba(251,191,36,.05)"}}>
                  <td style={{padding:"10px 8px"}}><span style={{background:"rgba(255,255,255,.1)",padding:"4px 10px",borderRadius:999,color:"#fff",fontWeight:800}}>{r.code}</span></td>
                  <td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{r.level}</td>
                  <td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{r.capacity||"—"}</td>
                  <td style={{padding:"10px 8px",color:"#e2e8f0",fontSize:12}}>{progMap[r.program_id]||"غير مرتبط"}</td>
                  <td style={{padding:"10px 8px"}}>{hasTrainer? <div><div style={{color:"#fff",fontWeight:700,fontSize:12}}>{trainer?.full_name||trainerMap[r.trainer_id]}</div><div style={{color:"#94a3b8",fontSize:11}}>{trainer?.email||""} {trainer?.phone? "• "+trainer.phone:""}</div></div> : <span style={{color:"#fbbf24",fontSize:11}}>⚠ غير معين - يحتاج ربط</span>}</td>
                  <td style={{padding:"10px 8px"}}><span style={{background:hasTrainer?"#d1fae5":"#fef3c7",color:hasTrainer?"#065f46":"#92400e",padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:800}}>{hasTrainer?"مرتبط":"ينتظر"}</span></td>
                  <td style={{padding:"10px 8px"}}><button onClick={()=>{setRoomForm({id:r.id,code:r.code,level:r.level,capacity:r.capacity,program_id:r.program_id||"",trainer_id:r.trainer_id||""}); setShowRoom(true);}} style={{background:"#fff",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,marginLeft:4}}>ربط/تعديل</button><button onClick={()=>delRoom(r.id)} style={{background:"rgba(239,68,68,.15)",color:"#fca5a5",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12}}>حذف</button></td>
                </tr>
              );})}
            </tbody></table>
            </div>
          </div>
        )}

        {tab==="trainers" && (
          <div className="tw" style={{background:"#fff",borderRadius:18,padding:8,border:"1px solid #ece4d4"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#f8fafc"}}><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>المدرب</th><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>جوال</th><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>ايميل</th><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>القاعات المسندة</th><th style={{padding:12,textAlign:"right",fontSize:12,color:"#94a3b8"}}>إجراءات</th></tr></thead><tbody>
              {filteredTrainers.map((t:any)=>{ const assigned=rooms.filter((r:any)=>r.trainer_id===t.id); return(<tr key={t.id} style={{borderTop:"1px solid #f1f5f9"}}><td style={{padding:12}}><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:36,height:36,borderRadius:999,background:"linear-gradient(135deg,#10b981,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{(t.full_name||"م").charAt(0)}</div><div><div style={{fontWeight:800,fontSize:13}}>{t.full_name||t.display_name||"بدون اسم"}</div><div style={{fontSize:11,color:"#94a3b8"}}>{t.role||"trainer"}</div></div></div></td><td style={{padding:12,fontSize:13}}>{t.phone||"—"}</td><td style={{padding:12,fontSize:13}}>{t.email||"—"}</td><td style={{padding:12}}>{assigned.length? assigned.map((r:any)=><span key={r.id} style={{background:"#ecfdf5",color:"#065f46",padding:"3px 8px",borderRadius:999,fontSize:11,marginLeft:4}}>{r.code} ({r.level})</span>) : <span style={{color:"#94a3b8",fontSize:12}}>لا يوجد</span>}</td><td style={{padding:12}}><button onClick={()=>{setTrainerForm({id:t.id,full_name:t.full_name||"",email:t.email||"",phone:t.phone||""}); setShowTrainer(true);}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",marginLeft:4}}>تعديل</button><button onClick={()=>delTrainer(t.id)} style={{background:"#fee2e2",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>حذف</button></td></tr>); })}
            </tbody></table>
          </div>
        )}

        {/* modals */}
        {showProg && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}><div style={{background:"#fff",borderRadius:20,padding:20,width:"100%",maxWidth:460}}><h3 style={{margin:"0 0 12px",fontWeight:900}}>{progForm.id?"تعديل برنامج":"برنامج جديد"}</h3><label style={{fontSize:12}}>اسم البرنامج</label><input value={progForm.name} onChange={e=>setProgForm({...progForm,name:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px",marginBottom:10}}/><label style={{fontSize:12}}>الوصف</label><textarea value={progForm.description} onChange={e=>setProgForm({...progForm,description:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px",minHeight:80}}/><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}><button onClick={()=>setShowProg(false)} style={{background:"#f1f5f9",border:"none",borderRadius:10,padding:"9px 14px",cursor:"pointer"}}>إلغاء</button><button onClick={saveProgram} style={{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:800,cursor:"pointer"}}>حفظ</button></div></div></div>}

        {showRoom && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}><div style={{background:"#fff",borderRadius:20,padding:20,width:"100%",maxWidth:520}}><h3 style={{margin:"0 0 12px",fontWeight:900}}>ربط القاعة بالبرنامج والمدرب</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><label style={{fontSize:12}}>كود القاعة (رقم القاعة)</label><input value={roomForm.code} onChange={e=>setRoomForm({...roomForm,code:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px"}}/></div><div><label style={{fontSize:12}}>المستوى</label><select value={roomForm.level} onChange={e=>setRoomForm({...roomForm,level:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px"}}><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option></select></div></div><div style={{marginTop:10}}><label style={{fontSize:12}}>السعة</label><input type="number" value={roomForm.capacity} onChange={e=>setRoomForm({...roomForm,capacity:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px"}}/></div><div style={{marginTop:10}}><label style={{fontSize:12}}>اسم البرنامج</label><select value={roomForm.program_id} onChange={e=>setRoomForm({...roomForm,program_id:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px"}}><option value="">اختر البرنامج</option>{programs.map((p:any)=><option key={p.id} value={p.id}>{p.name||p.title}</option>)}</select></div><div style={{marginTop:10}}><label style={{fontSize:12}}>المدرب (اسم + جوال + ايميل)</label><select value={roomForm.trainer_id} onChange={e=>setRoomForm({...roomForm,trainer_id:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px"}}><option value="">بدون مدرب - يحتاج ربط</option>{trainers.map((t:any)=><option key={t.id} value={t.id}>{(t.full_name||"مدرب")+" - "+(t.phone||"")+" - "+(t.email||"")}</option>)}</select></div><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}><button onClick={()=>setShowRoom(false)} style={{background:"#f1f5f9",border:"none",borderRadius:10,padding:"9px 14px",cursor:"pointer"}}>إلغاء</button><button onClick={saveRoom} style={{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:800,cursor:"pointer"}}>حفظ وربط</button></div></div></div>}

        {showTrainer && <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}><div style={{background:"#fff",borderRadius:20,padding:20,width:"100%",maxWidth:460}}><h3 style={{margin:"0 0 12px",fontWeight:900}}>{trainerForm.id?"تعديل مدرب":"مدرب جديد"}</h3><label style={{fontSize:12}}>الاسم الكامل</label><input value={trainerForm.full_name} onChange={e=>setTrainerForm({...trainerForm,full_name:e.target.value})} style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px",marginBottom:10}}/><label style={{fontSize:12}}>رقم الجوال</label><input value={trainerForm.phone} onChange={e=>setTrainerForm({...trainerForm,phone:e.target.value})} placeholder="05xxxxxxxx" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px",marginBottom:10}}/><label style={{fontSize:12}}>البريد الإلكتروني</label><input value={trainerForm.email} onChange={e=>setTrainerForm({...trainerForm,email:e.target.value})} placeholder="trainer@example.com" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px",marginBottom:10}}/><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}><button onClick={()=>setShowTrainer(false)} style={{background:"#f1f5f9",border:"none",borderRadius:10,padding:"9px 14px",cursor:"pointer"}}>إلغاء</button><button onClick={saveTrainer} style={{background:TEAL,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:800,cursor:"pointer"}}>حفظ المدرب</button></div></div></div>}

      </div>
    </div>
  );
}
