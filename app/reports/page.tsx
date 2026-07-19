// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px}.side{width:252px;flex-shrink:0;position:sticky;top:14px}.main{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tw{overflow:auto;border-radius:16px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}@media print{.side,.np{display:none!important}}";
const TEAL="#10b981"; const NAVY="#0b1220";
function p2(n){return n<10?"0"+n:""+n;}
function rankS(r){ if(r===1) return {bg:"linear-gradient(135deg,#fbbf24,#f59e0b)",fg:"#000",t:"🥇"}; if(r===2) return {bg:"linear-gradient(135deg,#e2e8f0,#94a3b8)",fg:"#111",t:"🥈"}; if(r===3) return {bg:"linear-gradient(135deg,#fb923c,#78350f)",fg:"#fff",t:"🥉"}; return {bg:"#1e293b",fg:"#e2e8f0",t:""+r}; }
function st(v){ if(v>=4.2) return {t:"ممتاز",bg:"#d1fae5",fg:"#065f46"}; if(v>=3.2) return {t:"جيد",bg:"#fef3c7",fg:"#92400e"}; return {t:"يحتاج دعماً",bg:"#fee2e2",fg:"#991b1b"}; }
function avgA(a){ return a.length? a.reduce((x,y)=>x+y,0)/a.length:0; }

export default function Page(){
  const router=useRouter();
  const [rows,setRows]=useState([]); const [ans,setAns]=useState([]); const [qs,setQs]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState("");
  const [tab,setTab]=useState("teachers"); const [qSea,setQSea]=useState(""); const [roomF,setRoomF]=useState("all");

  useEffect(()=>{let on=true;(async()=>{
    try{
      const sfn=supabase; const db=typeof sfn==="function"? sfn(): sfn;
      const s=await db.auth.getSession(); if(!s.data?.session){ if(on) setErr("سجل الدخول مجددا"); return;}
      const e=await db.from("evaluations").select("*").order("submitted_at",{ascending:false}).limit(3000);
      if(e.error) throw new Error(e.error.message);
      const ids=(e.data||[]).map(x=>x.id);
      const a=ids.length? await db.from("evaluation_answers").select("evaluation_id,question_id,rating_value,text_value").in("evaluation_id",ids):{data:[]};
      const qids=Array.from(new Set((a.data||[]).map(x=>x.question_id)));
      const q=qids.length? await db.from("questions").select("id,text_ar,section_ar").in("id",qids):{data:[]};
      if(!on) return; setRows(e.data||[]); setAns(a.data||[]); setQs(q.data||[]);
    }catch(ex){ if(on) setErr(ex.message);} finally{ if(on) setLoad(false); }
  })(); return()=>{on=false};},[]);

  const calc=(kind)=>{
    const list=rows.filter(r=>r.kind===kind); const ids=new Set(list.map(r=>r.id));
    const qm={}; qs.forEach(q=>{qm[q.id]=q;});
    const g={}; ans.forEach(a=>{ if(ids.has(a.evaluation_id)&&a.rating_value!=null){ const v=Number(a.rating_value); if(!isNaN(v)){(g[a.question_id]=g[a.question_id]||[]).push(v);} }});
    const axes=Object.keys(g).map(id=>({label:qm[id]?qm[id].text_ar:"سؤال", section:qm[id]?.section_ar||"عام", value:avgA(g[id])})).sort((a,b)=>a.value-b.value);
    const all=list.map(r=>Number(r.overall_rating)).filter(v=>!isNaN(v)&&v>0);
    return {count:list.length, avg:avgA(all), axes};
  };
  const daily=useMemo(()=>calc("DAILY"),[rows,ans,qs]);
  const final=useMemo(()=>calc("FINAL"),[rows,ans,qs]);

  const teachers=useMemo(()=>{
    const qm={}; qs.forEach(x=>{qm[x.id]=x;}); const mp={};
    rows.forEach(ev=>{
      const name=(ev.instructor_name||ev.teacher_name||ev.teacher||"غير محدد").trim();
      const room=(ev.classroom_number||ev.room_number||ev.classroom||ev.room||"—").toString();
      if(name==="غير محدد" && room==="—") return;
      const key=name+"||"+room; if(!mp[key]) mp[key]={name,room,level:ev.level||ev.class_level||"A1",evals:[],ans:[]}; mp[key].evals.push(ev);
    });
    Object.keys(mp).forEach(k=>{ const ids=new Set(mp[k].evals.map(e=>e.id)); mp[k].ans=ans.filter(a=>ids.has(a.evaluation_id)); });
    const list=Object.values(mp).map((t:any)=>{
      const avgAll=t.evals.map(e=>Number(e.overall_rating)).filter(v=>!isNaN(v)&&v>0); const avg=avgA(avgAll);
      const bySec={}; t.ans.forEach(a=>{ if(a.rating_value==null) return; const sec=qm[a.question_id]?.section_ar||"عام"; const v=Number(a.rating_value); if(isNaN(v)) return; if(!bySec[sec]) bySec[sec]=[]; bySec[sec].push(v); });
      const secAvg={}; Object.keys(bySec).forEach(k=>{ secAvg[k]=avgA(bySec[k]); });
      return {...t,count:t.evals.length,avg,secAvg,clarity:secAvg["الوضوح"]||0,teaching:secAvg["التدريس"]||secAvg["أسلوب التدريس"]||0,motivation:secAvg["الدافعية"]||secAvg["التفاعل"]||0};
    }).sort((a,b)=>b.avg-a.avg); return list;
  },[rows,ans,qs]);

  const rooms=useMemo(()=>{ const s=new Set(teachers.map(t=>t.room)); return ["all",...Array.from(s)]; },[teachers]);
  const filtered=useMemo(()=>{ return teachers.filter(t=>{ if(roomF!=="all"&&t.room!==roomF) return false; if(qSea){ const q=qSea.toLowerCase(); if(!(t.name.toLowerCase().includes(q)||t.room.toLowerCase().includes(q))) return false;} return true; }); },[teachers,roomF,qSea]);
  const maxC=Math.max(1,...filtered.map(t=>t.count));
  const top=filtered[0]; const low=filtered.length? filtered[filtered.length-1]:null;

  if(load) return (<div style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b"}}><style dangerouslySetInnerHTML={{__html:CSS}}/>{ "جارٍ بناء التقرير التنفيذي..."} </div>);

  return(
    <div style={{background:"#f1ece1",minHeight:"100vh",padding:16,color:"#111"}} className="rw">
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div className="lay">
        <div className="side np">
          <div style={{background:"linear-gradient(180deg,#0b1220,#070b14)",borderRadius:22,padding:16,color:"#fff"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}><div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#10b981,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div><div><div style={{fontWeight:900}}>منصة التقييم</div><div style={{fontSize:11,color:"#94a3b8"}}>النظام الموحد</div></div></div>
            <div style={{background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.35)",borderRadius:12,padding:10,textAlign:"center",fontSize:12,fontWeight:800,color:"#5eead4",marginBottom:12}}>{rows.length} تقييم • {teachers.length} معلم</div>
            <B active={tab==="overview"} onClick={()=>setTab("overview")} t="نظرة شاملة" ic="🏠"/><B active={tab==="daily"} onClick={()=>setTab("daily")} t="التقرير اليومي" ic="📝"/><B active={tab==="final"} onClick={()=>setTab("final")} t="التقرير النهائي" ic="⭐"/><B active={tab==="teachers"} onClick={()=>setTab("teachers")} t="المعلمون بالقاعة" ic="👨‍🏫"/>
            <input value={qSea} onChange={e=>setQSea(e.target.value)} placeholder="بحث معلم / قاعة" style={{marginTop:10,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13}}/>
            <select value={roomF} onChange={e=>setRoomF(e.target.value)} style={{marginTop:8,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px",color:"#e2e8f0",fontSize:13}}>{rooms.map(r=><option key={r} value={r} style={{color:"#111"}}>{r==="all"?"كل القاعات":"قاعة "+r}</option>)}</select>
            <button onClick={()=>router.push("/dashboard")} style={{width:"100%",marginTop:12,background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",textAlign:"right",fontSize:12}}>← لوحة التحكم</button>
          </div>
        </div>

        <div className="main">
          {err? <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:14,marginBottom:12}}>{err}</div>:null}
          <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0b1220,#111827)",borderRadius:24,padding:24,color:"#fff",marginBottom:14}}>
            <div style={{position:"absolute",left:18,top:-6,fontSize:82,fontWeight:900,color:"rgba(255,255,255,.04)"}}>REPORT</div>
            <div style={{position:"relative",textAlign:"center"}}><h1 style={{fontSize:30,fontWeight:900,margin:0}}>{tab==="teachers"?"المعلمون":tab==="daily"?"التقرير اليومي":tab==="final"?"التقرير النهائي":"لوحة القيادة"}</h1><p style={{color:"#94a3b8",margin:"6px 0 12px",fontSize:13}}>ترتيب وتحليل أداء المعلمين مرتبط برقم القاعة • تصميم تنفيذي مثير</p><div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}><Pj>{filtered.length} معلم</Pj><Pj>قاعة {roomF==="all"?"الكل":roomF}</Pj><Pj>🏆 ترتيب تلقائي</Pj></div></div>
          </div>

          {tab==="overview" && (
            <div>
              <div className="g2"><C title="اليومي" v={daily.avg} c={daily.count} color="#2563eb"/><C title="النهائي" v={final.avg} c={final.count} color={TEAL}/></div>
              <Box><h3 style={{margin:"0 0 10px",fontWeight:800}}>📊 بيانات المحاور</h3>{[...daily.axes,...final.axes].slice(0,6).map((a,i)=><Row key={i} a={a} color={i%2?TEAL:"#2563eb"}/>)}</Box>
            </div>
          )}
          {(tab==="daily"||tab==="final") && (
            <div><div className="g3"><K label="الاستجابات" v={tab==="daily"?daily.count:final.count}/><K label="المتوسط" v={(tab==="daily"?daily.avg:final.avg).toFixed(2)}/><K label="المحاور" v={tab==="daily"?daily.axes.length:final.axes.length}/></div><Box>{(tab==="daily"?daily.axes:final.axes).map((a,i)=><Row key={i} a={a} color={tab==="daily"?"#2563eb":TEAL}/>)}</Box></div>
          )}
          {tab==="teachers" && (
            <div>
              <div className="g3" style={{marginBottom:14}}><KG label="إجمالي التقييمات" v={rows.length}/><KG label="متوسط الأداء" v={(teachers.reduce((s,x)=>s+x.avg,0)/(teachers.length||1)).toFixed(2)}/><KG label="القاعات النشطة" v={rooms.length-1}/></div>
              <div style={{background:NAVY,borderRadius:22,padding:16,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h2 style={{margin:0,color:"#fff",fontWeight:900}}>🏆 ترتيب المعلمين بالقاعة</h2><span style={{background:"rgba(16,185,129,.15)",color:"#5eead4",borderRadius:999,padding:"4px 12px",fontSize:11,fontWeight:800}}>مثير وفعال</span></div>
                <div className="tw"><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr style={{textAlign:"right"}}><Th>#</Th><Th>المعلم</Th><Th>قاعة</Th><Th>عدد</Th><Th>متوسط</Th><Th>وضوح</Th><Th>تدريس</Th><Th>الحالة</Th></tr></thead><tbody>{filtered.map((t,i)=>{const rk=rankS(i+1); const s=st(t.avg); return(<tr key={t.name+t.room} style={{borderTop:"1px solid rgba(255,255,255,.06)",background:i%2?"rgba(255,255,255,.02)":"transparent"}}><td style={{padding:"10px 8px"}}><div style={{width:32,height:32,borderRadius:10,background:rk.bg,color:rk.fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{rk.t}</div></td><td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:32,height:32,borderRadius:999,background:"linear-gradient(135deg,#10b981,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800}}>{t.name.charAt(0)}</div><span style={{color:"#fff",fontWeight:700,fontSize:13}}>{t.name}</span></div></td><td style={{padding:"10px 8px"}}><span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 10px",borderRadius:999,color:"#e2e8f0",fontSize:12}}>{t.room}</span></td><td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:6,alignItems:"center"}}><div style={{width:44,height:6,background:"rgba(255,255,255,.12)",borderRadius:6,overflow:"hidden"}}><div style={{width:t.count/maxC*100+"%",height:"100%",background:TEAL}}/></div><span style={{color:"#cbd5e1",fontSize:12}}>{t.count}</span></div></td><td style={{padding:"10px 8px"}}><b style={{color:"#fff"}}>{t.avg.toFixed(2)}</b></td><td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.clarity?t.clarity.toFixed(1):"—"}</td><td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.teaching?t.teaching.toFixed(1):"—"}</td><td style={{padding:"10px 8px"}}><span style={{background:s.bg,color:s.fg,padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:800}}>{s.t}</span></td></tr>);})}</tbody></table></div>
              </div>
              <div className="g2"><div style={{background:NAVY,borderRadius:20,padding:18,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🌟 الأفضل</h3>{top? <div style={{textAlign:"center"}}><div style={{fontSize:42}}>🏆</div><div style={{fontWeight:900,fontSize:18}}>{top.name}</div><div style={{color:"#5eead4",fontSize:12}}>قاعة {top.room} • {top.avg.toFixed(2)}/5</div></div>:<p style={{color:"#94a3b8"}}>لا بيانات</p>}</div><div style={{background:NAVY,borderRadius:20,padding:18,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🤲 يحتاج دعماً</h3>{low? <div style={{textAlign:"center"}}><div style={{fontSize:28}}>💡</div><div style={{fontWeight:800}}>{low.name}</div><div style={{color:"#fbbf24",fontSize:12}}>قاعة {low.room} • {low.avg.toFixed(2)}</div></div>:<p style={{color:"#94a3b8"}}>لا بيانات</p>}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function B(p){return(<button onClick={p.onClick} style={{width:"100%",display:"flex",gap:8,justifyContent:"flex-end",background:p.active?"rgba(16,185,129,.15)":"transparent",border:p.active?"1px solid rgba(16,185,129,.45)":"1px solid transparent",color:p.active?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px 12px",marginBottom:6,cursor:"pointer",fontWeight:p.active?800:600,fontSize:13}}><span>{p.t}</span><span>{p.ic}</span></button>);}
function Pj(p){return(<span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",borderRadius:999,padding:"6px 12px",fontSize:11,color:"#e2e8f0"}}>{p.children}</span>);}
function C(p){return(<div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:18,padding:18,textAlign:"center"}}><div style={{fontSize:12,fontWeight:800,color:p.color}}>{p.title}</div><div style={{fontSize:36,fontWeight:900}}>{p.v?p.v.toFixed(2):"-"}<span style={{fontSize:14,color:"#9a8f7d"}}>/5</span></div><div style={{fontSize:12,color:"#64748b"}}>{p.c} استجابة</div></div>);}
function K(p){return(<div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:16,padding:14,textAlign:"center"}}><div style={{fontSize:11,color:"#9a8f7d"}}>{p.label}</div><div style={{fontSize:22,fontWeight:900}}>{p.v}</div></div>);}
function KG(p){return(<div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:18,padding:16,textAlign:"center",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",left:8,top:-2,fontSize:44,fontWeight:900,color:"rgba(0,0,0,.05)"}}>{p.v}</div><div style={{position:"relative"}}><div style={{fontSize:11,color:"#9a8f7d",fontWeight:700}}>{p.label}</div><div style={{fontSize:28,fontWeight:900,marginTop:4}}>{p.v}</div></div></div>);}
function Th(p){return(<th style={{color:"#94a3b8",fontSize:11,fontWeight:800,padding:"10px 8px",textAlign:"right"}}>{p.children}</th>);}
function Box(p){return(<div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:18,padding:16,marginBottom:14}}>{p.children}</div>);}
function Row(p){const s=st(p.a.value); return(<div style={{background:"#fff",border:"1px solid #f0e9db",borderRadius:12,padding:12,marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{background:"#f0e9db",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>{p.a.section}</span><span style={{fontSize:13,fontWeight:700}}>{p.a.label}</span></div><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{background:s.bg,color:s.fg,borderRadius:999,padding:"3px 10px",fontSize:11,fontWeight:800}}>{s.t}</span><b style={{color:p.color}}>{p.a.value.toFixed(2)}</b></div></div><div style={{height:8,background:"#f0e9db",borderRadius:8,marginTop:8,overflow:"hidden"}}><div style={{width:p.a.value/5*100+"%",height:"100%",background:p.color,borderRadius:8}}/></div></div>);}
