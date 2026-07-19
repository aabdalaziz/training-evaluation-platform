// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px}.side{width:260px;flex-shrink:0;position:sticky;top:16px}.main{flex:1;min-width:0}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.tWrap{overflow:auto;border-radius:16px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g3,.g2{grid-template-columns:1fr}}@media print{.side,.np{display:none!important}}";
const TEAL="#10b981"; const NAVY="#0b1220";

function rankStyle(r){
  if(r===1) return {bg:"linear-gradient(135deg,#fbbf24,#f59e0b)", fg:"#000", icon:"🥇"};
  if(r===2) return {bg:"linear-gradient(135deg,#e2e8f0,#94a3b8)", fg:"#111", icon:"🥈"};
  if(r===3) return {bg:"linear-gradient(135deg,#fb923c,#78350f)", fg:"#fff", icon:"🥉"};
  return {bg:"#1e293b", fg:"#e2e8f0", icon:""+r};
}
function st(v){ if(v>=4.2) return {t:"ممتاز", bg:"#d1fae5", fg:"#065f46"}; if(v>=3.2) return {t:"جيد", bg:"#fef3c7", fg:"#92400e"}; return {t:"يحتاج دعماً", bg:"#fee2e2", fg:"#991b1b"}; }

export default function TeachersReport(){
  const router=useRouter();
  const [rows,setRows]=useState([]); const [answers,setAnswers]=useState([]); const [qs,setQs]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState("");
  const [qSearch,setQSearch]=useState(""); const [roomFilter,setRoomFilter]=useState("all");
  const [selected,setSelected]=useState(null);

  useEffect(()=>{let on=true;(async()=>{
    try{
      const db=supabase(); const s=await db.auth.getSession(); if(!s.data?.session){ if(on) setErr("سجّل الدخول من جديد."); return;}
      const e=await db.from("evaluations").select("*").order("submitted_at",{ascending:false}).limit(2000);
      if(e.error) throw new Error(e.error.message);
      const ids=(e.data||[]).map(x=>x.id);
      const a=ids.length? await db.from("evaluation_answers").select("evaluation_id,question_id,rating_value,text_value").in("evaluation_id",ids):{data:[]};
      const qids=Array.from(new Set((a.data||[]).map(x=>x.question_id)));
      const q=qids.length? await db.from("questions").select("id,text_ar,section_ar").in("id",qids):{data:[]};
      if(!on) return; setRows(e.data||[]); setAnswers(a.data||[]); setQs(q.data||[]);
    }catch(ex){ if(on) setErr(ex.message);} finally{ if(on) setLoad(false);}
  })(); return()=>{on=false};},[]);

  const teachers=useMemo(()=>{
    const qm={}; qs.forEach(x=>{qm[x.id]=x;});
    const map={};
    rows.forEach(ev=>{
      const name=(ev.instructor_name||ev.teacher_name||ev.teacher||"غير محدد").trim();
      const room=(ev.classroom_number||ev.room_number||ev.classroom||ev.room||"—").toString();
      if(name==="غير محدد" && room==="—") return;
      const key=name+"||"+room;
      if(!map[key]) map[key]={name,room,level:ev.level||ev.class_level||"A1",evals:[],ans:[]};
      map[key].evals.push(ev);
    });
    Object.keys(map).forEach(key=>{
      const ids=new Set(map[key].evals.map(e=>e.id));
      map[key].ans=answers.filter(a=>ids.has(a.evaluation_id));
    });
    const list=Object.values(map).map((t:any)=>{
      const avgAll=t.evals.map(e=>Number(e.overall_rating)).filter(v=>!isNaN(v)&&v>0);
      const avg=avgAll.length? avgAll.reduce((a,b)=>a+b,0)/avgAll.length:0;
      const bySec={}; t.ans.forEach(a=>{ if(a.rating_value==null) return; const sec=qm[a.question_id]?.section_ar||qm[a.question_id]?.text_ar||"عام"; const v=Number(a.rating_value); if(isNaN(v)) return; if(!bySec[sec]) bySec[sec]=[]; bySec[sec].push(v); });
      const secAvg={}; Object.keys(bySec).forEach(k=>{ secAvg[k]=bySec[k].reduce((a,b)=>a+b,0)/bySec[k].length; });
      const clarity=secAvg["الوضوح"]||secAvg["وضوح"]||secAvg["جودة الشرح"]||0;
      const teaching=secAvg["التدريس"]||secAvg["أسلوب التدريس"]||secAvg["طريقة التدريس"]||0;
      const motivation=secAvg["الدافعية"]||secAvg["التفاعل"]||secAvg["دافعية"]||0;
      return {...t, count:t.evals.length, avg, clarity, teaching, motivation, secAvg, overall:avg};
    }).sort((a,b)=>b.avg-a.avg);
    return list;
  },[rows,answers,qs]);

  const rooms=useMemo(()=>{ const s=new Set(teachers.map(t=>t.room)); return ["all",...Array.from(s)]; },[teachers]);

  const filtered=useMemo(()=>{
    return teachers.filter(t=>{
      if(roomFilter!=="all" && t.room!==roomFilter) return false;
      if(qSearch){ const q=qSearch.toLowerCase(); if(!(t.name.toLowerCase().includes(q) || t.room.toLowerCase().includes(q))) return false; }
      return true;
    });
  },[teachers,roomFilter,qSearch]);

  const top=filtered[0]; const low=filtered.length? filtered[filtered.length-1]:null;
  const maxCount=Math.max(1,...filtered.map(t=>t.count));

  const exportCsv=()=>{
    const lines=["الترتيب,المعلم,القاعة,المستوى,عدد التقييمات,المتوسط,الوضوح,التدريس,الدافعية"];
    filtered.forEach((t,i)=>{ lines.push([i+1, t.name, t.room, t.level, t.count, t.avg.toFixed(2), t.clarity.toFixed(2), t.teaching.toFixed(2), t.motivation.toFixed(2)].join(",")); });
    const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="teachers-by-room.csv"; a.click(); URL.revokeObjectURL(url);
  };

  if(load) return (<div className="rw" style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b"}}><style dangerouslySetInnerHTML={{__html:CSS}}/>جارٍ بناء تقرير المعلمين...</div>);

  return(
    <div className="rw" style={{background:"#f1ece1",minHeight:"100vh",padding:14,color:"#111"}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div className="lay">
        <aside className="side np">
          <div style={{background:"linear-gradient(180deg,#0b1220,#070b14)",borderRadius:22,padding:16,color:"#fff"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#10b981,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📋</div>
              <div><div style={{fontWeight:900,fontSize:15}}>منصة التقييم</div><div style={{fontSize:11,color:"#94a3b8"}}>النظام الموحد</div></div>
            </div>
            <div style={{background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.35)",borderRadius:12,padding:10,textAlign:"center",fontSize:12,fontWeight:800,color:"#5eead4",marginBottom:12}}>{rows.length} تقييم • {teachers.length} معلم</div>
            <SideBtn active={false} onClick={()=>router.push("/reports")} t="التقارير العامة" ic="📊"/>
            <SideBtn active={true} onClick={()=>{}} t="المعلمون" ic="👨‍🏫"/>
            <SideBtn active={false} onClick={()=>router.push("/dashboard")} t="لوحة التحكم" ic="←"/>
            <div style={{marginTop:12,display:"flex",gap:8}}>
              <input value={qSearch} onChange={e=>setQSearch(e.target.value)} placeholder="بحث معلم / قاعة" style={{flex:1,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13}}/>
            </div>
            <select value={roomFilter} onChange={e=>setRoomFilter(e.target.value)} style={{marginTop:8,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px",color:"#e2e8f0",fontSize:13}}>
              {rooms.map(r=>(<option key={r} value={r} style={{color:"#111"}}>{r==="all"?"كل القاعات":"قاعة "+r}</option>))}
            </select>
          </div>
        </aside>

        <main className="main">
          {err? <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:14,marginBottom:12}}>{err}</div>:null}

          <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0b1220 0%,#111827 100%)",borderRadius:24,padding:26,color:"#fff",marginBottom:14}}>
            <div style={{position:"absolute",left:20,top:-6,fontSize:90,fontWeight:900,color:"rgba(255,255,255,.04)"}}>TEACHERS</div>
            <div style={{position:"relative"}}>
              <h1 style={{fontSize:32,fontWeight:900,margin:"0 0 6px",textAlign:"center"}}>المعلمون</h1>
              <p style={{textAlign:"center",color:"#94a3b8",margin:"0 0 14px",fontSize:13}}>ترتيب وتحليل أداء المعلمين مرتبط برقم القاعة</p>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                <Pill>{teachers.length} معلم</Pill><Pill>{filtered.length} نتيجة بعد الفلترة</Pill><Pill onClick={exportCsv}>⬇ تصدير Excel</Pill>
              </div>
            </div>
          </div>

          <div className="g3" style={{marginBottom:14}}>
            <Kpi label="إجمالي التقييمات" value={rows.length} gh={rows.length} />
            <Kpi label="متوسط الأداء العام" value={(teachers.reduce((a,b)=>a+b.avg,0)/(teachers.length||1)).toFixed(2)} suffix="/5" gh="4.2"/>
            <Kpi label="عدد القاعات النشطة" value={rooms.length-1} gh={rooms.length-1}/>
          </div>

          <div style={{background:"#0b1220",borderRadius:22,padding:18,marginBottom:14,boxShadow:"0 8px 24px rgba(0,0,0,.25)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h2 style={{margin:0,color:"#fff",fontSize:18,fontWeight:800}}>🏆 ترتيب المعلمين</h2>
              <span style={{background:"rgba(16,185,129,.15)",color:"#5eead4",borderRadius:999,padding:"4px 12px",fontSize:11,fontWeight:800}}>مرتبط برقم القاعة</span>
            </div>
            <div className="tWrap">
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}>
                <thead>
                  <tr style={{textAlign:"right"}}>
                    <Th>#</Th><Th>المعلم</Th><Th>قاعة</Th><Th>مستوى</Th><Th>عدد</Th><Th>المتوسط</Th><Th>وضوح</Th><Th>تدريس</Th><Th>دافعية</Th><Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t,i)=>{
                    const rk=rankStyle(i+1); const s=st(t.avg);
                    return(
                      <tr key={t.name+"-"+t.room} onClick={()=>setSelected(t)} style={{cursor:"pointer",borderTop:"1px solid rgba(255,255,255,.06)",background:i%2===0?"rgba(255,255,255,.02)":"transparent"}}>
                        <Td><div style={{width:34,height:34,borderRadius:10,background:rk.bg,color:rk.fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13}}>{rk.icon}</div></Td>
                        <Td><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:34,height:34,borderRadius:999,background:"linear-gradient(135deg,#10b981,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>{t.name.charAt(0)}</div><span style={{color:"#fff",fontWeight:700,fontSize:13}}>{t.name}</span></div></Td>
                        <Td><span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 10px",borderRadius:999,fontSize:12,color:"#e2e8f0"}}>{t.room}</span></Td>
                        <Td><span style={{color:"#94a3b8",fontSize:12}}>{t.level}</span></Td>
                        <Td><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:50,height:6,background:"rgba(255,255,255,.12)",borderRadius:6,overflow:"hidden"}}><div style={{width:(t.count/maxCount*100)+"%",height:"100%",background:TEAL}} /></div><span style={{color:"#cbd5e1",fontSize:12}}>{t.count}</span></div></Td>
                        <Td><b style={{color:"#fff",fontSize:15}}>{t.avg.toFixed(2)}</b></Td>
                        <Td><span style={{color:"#e2e8f0",fontSize:12}}>{t.clarity? t.clarity.toFixed(1):"—"}</span></Td>
                        <Td><span style={{color:"#e2e8f0",fontSize:12}}>{t.teaching? t.teaching.toFixed(1):"—"}</span></Td>
                        <Td><span style={{color:"#e2e8f0",fontSize:12}}>{t.motivation? t.motivation.toFixed(1):"—"}</span></Td>
                        <Td><span style={{background:s.bg,color:s.fg,padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:800}}>{s.t}</span></Td>
                      </tr>
                    );
                  })}
                  {filtered.length===0? <tr><td colSpan={10} style={{textAlign:"center",padding:20,color:"#94a3b8"}}>لا يوجد معلمون يطابقون البحث</td></tr>:null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="g2">
            <div style={{background:NAVY,borderRadius:20,padding:18,color:"#fff",border:"1px solid rgba(255,255,255,.06)"}}>
              <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800}}>🌟 الأفضل</h3>
              {top? <div style={{textAlign:"center",padding:"10px 0"}}>
                <div style={{fontSize:54}}>🏆</div>
                <div style={{fontSize:20,fontWeight:900,marginTop:6}}>{top.name}</div>
                <div style={{color:"#5eead4",fontSize:13,marginTop:4}}>قاعة {top.room} • {top.count} تقييم • {top.avg.toFixed(2)}/5</div>
                <div style={{marginTop:12,display:"flex",gap:8,justifyContent:"center"}}>
                  <MiniStat label="وضوح" v={top.clarity}/><MiniStat label="تدريس" v={top.teaching}/><MiniStat label="دافعية" v={top.motivation}/>
                </div>
              </div>: <p style={{color:"#94a3b8"}}>لا توجد بيانات</p>}
            </div>
            <div style={{background:NAVY,borderRadius:20,padding:18,color:"#fff",border:"1px solid rgba(255,255,255,.06)"}}>
              <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:800}}>🤲 يحتاج دعماً</h3>
              {low? <div style={{textAlign:"center",padding:"10px 0"}}>
                <div style={{fontSize:34}}>💡</div>
                <div style={{fontSize:18,fontWeight:800,marginTop:6}}>{low.name}</div>
                <div style={{color:"#fbbf24",fontSize:13,marginTop:4}}>قاعة {low.room} • متوسط {low.avg.toFixed(2)}</div>
                <div style={{marginTop:12,background:"rgba(251,191,36,.12)",border:"1px solid rgba(251,191,36,.3)",borderRadius:12,padding:10,fontSize:13,color:"#fde68a"}}>نوصي بجلسة تدريبية لدعم محور {Object.keys(low.secAvg).length? Object.entries(low.secAvg).sort((a,b)=>a[1]-b[1])[0][0]:"الأداء العام"}.</div>
              </div>: <p style={{color:"#94a3b8"}}>لا توجد بيانات</p>}
            </div>
          </div>

          {selected? <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#fffdf9",borderRadius:20,padding:20,width:"100%",maxWidth:520,border:"1px solid #ece4d4"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{margin:0,fontWeight:900}}>{selected.name} - قاعة {selected.room}</h3><button onClick={()=>setSelected(null)} style={{background:"#f1f5f9",border:"none",borderRadius:10,padding:"6px 12px",cursor:"pointer"}}>إغلاق</button></div>
              <div style={{marginTop:14}}>
                {Object.entries(selected.secAvg).map(([k,v])=>(<div key={k} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:700}}>{k}</span><b>{v.toFixed(2)}/5</b></div><div style={{height:8,background:"#f0e9db",borderRadius:8}}><div style={{width:(v/5*100)+"%",height:"100%",background:TEAL,borderRadius:8}}/></div></div>))}
              </div>
            </div>
          </div>:null}

        </main>
      </div>
    </div>
  );
}

function SideBtn(p){ return(<button onClick={p.onClick} style={{width:"100%",display:"flex",gap:10,alignItems:"center",justifyContent:"flex-end",background:p.active?"rgba(16,185,129,.15)":"transparent",border:p.active?"1px solid rgba(16,185,129,.45)":"1px solid transparent",color:p.active?"#5eead4":"#cbd5e1",borderRadius:12,padding:"11px 12px",marginBottom:6,cursor:"pointer",fontWeight:p.active?800:600,fontSize:13}}><span>{p.t}</span><span>{p.ic}</span></button>);}
function Pill(p){ return(<span onClick={p.onClick} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",borderRadius:999,padding:"6px 14px",fontSize:12,color:"#e2e8f0",cursor:p.onClick?"pointer":"default"}}>{p.children}</span>);}
function Kpi(p){ return(<div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:20,padding:18,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",left:10,top:-4,fontSize:56,fontWeight:900,color:"rgba(15,23,42,.05)"}}>{p.gh}</div><div style={{position:"relative",textAlign:"center"}}><div style={{fontSize:12,color:"#9a8f7d",fontWeight:700}}>{p.label}</div><div style={{fontSize:36,fontWeight:900,marginTop:4}}>{p.value}{p.suffix? <span style={{fontSize:16,color:"#9a8f7d"}}>{p.suffix}</span>:null}</div></div></div>);}
function Th(p){ return(<th style={{color:"#94a3b8",fontSize:11,fontWeight:800,padding:"10px 8px",textAlign:"right",whiteSpace:"nowrap"}}>{p.children}</th>);}
function Td(p){ return(<td style={{padding:"11px 8px",fontSize:13}}>{p.children}</td>);}
function MiniStat(p){ return(<div style={{background:"rgba(255,255,255,.06)",borderRadius:12,padding:"8px 12px",minWidth:70}}><div style={{fontSize:10,color:"#94a3b8"}}>{p.label}</div><div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{p.v? p.v.toFixed(1):"—"}</div></div>);}
