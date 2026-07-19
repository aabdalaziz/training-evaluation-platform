// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px}.side{width:258px;flex-shrink:0;position:sticky;top:14px}.main{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tw{overflow:auto;border-radius:16px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}";
const TEAL="#10b981"; const NAVY="#0b1220";
function p2(n){return n<10?"0"+n:""+n;}
function rankS(r){ if(r===1) return {bg:"linear-gradient(135deg,#fbbf24,#f59e0b)",fg:"#000",t:"🥇"}; if(r===2) return {bg:"linear-gradient(135deg,#e2e8f0,#94a3b8)",fg:"#111",t:"🥈"}; if(r===3) return {bg:"linear-gradient(135deg,#fb923c,#7c2d12)",fg:"#fff",t:"🥉"}; return {bg:"#1e293b",fg:"#cbd5e1",t:""+r};}
function st(v){ if(v>=4.2) return {t:"ممتاز",bg:"#d1fae5",fg:"#065f46"}; if(v>=3.2) return {t:"جيد",bg:"#fef3c7",fg:"#92400e"}; return {t:"يحتاج دعماً",bg:"#fee2e2",fg:"#991b1b"};}
function avgA(a){return a.length? a.reduce((x,y)=>x+y,0)/a.length:0;}
function Card(p){return <div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:20,padding:18,boxShadow:"0 4px 14px rgba(0,0,0,.04)",...p.s}}>{p.children}</div>;}
function Kpi(p){return <Card s={{position:"relative",overflow:"hidden"}}><div style={{position:"absolute",left:10,top:-4,fontSize:56,fontWeight:900,color:"rgba(0,0,0,.05)"}}>{p.gh}</div><div style={{position:"relative",textAlign:"center"}}><div style={{fontSize:12,color:"#9a8f7d",fontWeight:700}}>{p.lb}</div><div style={{fontSize:36,fontWeight:900,marginTop:2}}>{p.v}{p.sf?<span style={{fontSize:16,color:"#9a8f7d"}}>{p.sf}</span>:null}</div></div></Card>;}
function Th(p){return <th style={{color:"#94a3b8",fontSize:11,fontWeight:800,padding:"10px 8px",textAlign:"right"}}>{p.children}</th>;}

export default function Page(){
  const router=useRouter();
  const [rows,setRows]=useState([]); const [ans,setAns]=useState([]); const [qs,setQs]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState("");
  const [tab,setTab]=useState("teachers"); const [q,setQ]=useState(""); const [room,setRoom]=useState("all");

  useEffect(()=>{let on=true;(async()=>{
    try{
      const fn=supabase; const db=typeof fn==="function"? fn(): fn;
      const s=await db.auth.getSession(); if(!s.data?.session){ if(on) setErr("سجل الدخول مجددا"); return;}
      const e=await db.from("evaluations").select("*").order("submitted_at",{ascending:false}).limit(3000);
      if(e.error) throw new Error(e.error.message);
      const ids=(e.data||[]).map(x=>x.id);
      const a=ids.length? await db.from("evaluation_answers").select("evaluation_id,question_id,rating_value,text_value").in("evaluation_id",ids):{data:[]};
      const qids=Array.from(new Set((a.data||[]).map(x=>x.question_id)));
      const qq=qids.length? await db.from("questions").select("id,text_ar,section_ar").in("id",qids):{data:[]};
      if(!on) return; setRows(e.data||[]); setAns(a.data||[]); setQs(qq.data||[]);
    }catch(ex){ if(on) setErr(ex.message);} finally{ if(on) setLoad(false);}
  })(); return()=>{on=false};},[]);

  const calcFull=(kind)=>{
    const list=rows.filter(r=>r.kind===kind); const ids=new Set(list.map(r=>r.id));
    const qm={}; qs.forEach(x=>{qm[x.id]=x;}); const g={}; ans.forEach(a=>{ if(ids.has(a.evaluation_id)&&a.rating_value!=null){ const v=Number(a.rating_value); if(!isNaN(v)){(g[a.question_id]=g[a.question_id]||[]).push(v);} }});
    const axes=Object.keys(g).map(id=>({label:qm[id]?qm[id].text_ar:"سؤال",section:qm[id]?.section_ar||"عام",value:avgA(g[id])})).sort((a,b)=>a.value-b.value);
    const all=list.map(r=>Number(r.overall_rating)).filter(v=>!isNaN(v)&&v>0); const avg=avgA(all);
    const dist=[0,0,0,0,0]; list.forEach(r=>{ const v=Math.round(Number(r.overall_rating)); if(v>=1&&v<=5) dist[v-1]++; });
    const dm={}; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); dm[k]={wd:d.toLocaleDateString("ar-SA",{weekday:"long"}),dt:p2(d.getMonth()+1)+"-"+p2(d.getDate()),count:0}; }
    list.forEach(r=>{ const d=new Date(r.submitted_at); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); if(dm[k]) dm[k].count++; });
    const days=Object.keys(dm).map(k=>dm[k]); const sm={}; axes.forEach(a=>{ if(!sm[a.section]) sm[a.section]={s:0,n:0}; sm[a.section].s+=a.value; sm[a.section].n++; }); const sections=Object.keys(sm).map(k=>({name:k,value:sm[k].s/sm[k].n})).sort((a,b)=>b.value-a.value);
    const comments=[]; ans.forEach(a=>{ if(ids.has(a.evaluation_id)&&a.text_value&&a.text_value.trim()&&comments.length<5) comments.push(a.text_value.trim()); });
    return {count:list.length,avg,axes,dist,days,sections,comments};
  };
  const daily=useMemo(()=>calcFull("DAILY"),[rows,ans,qs]);
  const final=useMemo(()=>calcFull("FINAL"),[rows,ans,qs]);

  const teachers=useMemo(()=>{
    const qm={}; qs.forEach(x=>{qm[x.id]=x;}); const mp={};
    rows.forEach(ev=>{
      const name=(ev.instructor_name||ev.teacher_name||ev.teacher||ev.instructor||"غير محدد").toString().trim();
      const room=(ev.classroom_number||ev.room_number||ev.classroom||ev.room||"—").toString();
      if(name==="غير محدد"&&room==="—") return;
      const key=name+"||"+room; if(!mp[key]) mp[key]={name,room,level:ev.level||ev.class_level||"A1",evals:[],ans:[]}; mp[key].evals.push(ev);
    });
    Object.keys(mp).forEach(k=>{ const ids=new Set(mp[k].evals.map(e=>e.id)); mp[k].ans=ans.filter(a=>ids.has(a.evaluation_id)); });
    return Object.values(mp).map((t:any)=>{
      const avgAll=t.evals.map(e=>Number(e.overall_rating)).filter(v=>!isNaN(v)&&v>0); const avg=avgA(avgAll);
      const bySec={}; t.ans.forEach(a=>{ if(a.rating_value==null) return; const sec=qm[a.question_id]?.section_ar||"عام"; const v=Number(a.rating_value); if(isNaN(v)) return; if(!bySec[sec]) bySec[sec]=[]; bySec[sec].push(v); });
      const secAvg={}; Object.keys(bySec).forEach(k=>{ secAvg[k]=avgA(bySec[k]); });
      return {...t,count:t.evals.length,avg,secAvg,clarity:secAvg["الوضوح"]||secAvg["جودة الحصة"]||0,teaching:secAvg["التدريس"]||0,motivation:secAvg["الدافعية"]||0};
    }).sort((a,b)=>b.avg-a.avg);
  },[rows,ans,qs]);

  const rooms=useMemo(()=>{ const s=new Set(teachers.map(t=>t.room)); return ["all",...Array.from(s)]; },[teachers]);
  const filtered=useMemo(()=> teachers.filter(t=>{ if(room!=="all"&&t.room!==room) return false; if(q){ const qq=q.toLowerCase(); if(!(t.name.toLowerCase().includes(qq)||t.room.toLowerCase().includes(qq))) return false;} return true; }),[teachers,room,q]);
  const maxC=Math.max(1,...filtered.map(t=>t.count)); const top=filtered[0]; const low=filtered.length?filtered[filtered.length-1]:null;

  if(load) return <div style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><style dangerouslySetInnerHTML={{__html:CSS}}/>جارٍ بناء التقرير...</div>;

  return(
    <div style={{background:"#f1ece1",minHeight:"100vh",padding:14}} className="rw">
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div className="lay">
        <div className="side">
          <div style={{background:"linear-gradient(180deg,#0b1220,#070b14)",borderRadius:22,padding:16,color:"#fff"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}><div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#10b981,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center"}}>📋</div><div><div style={{fontWeight:900}}>منصة التقييم</div><div style={{fontSize:11,color:"#94a3b8"}}>النظام الموحد</div></div></div>
            <div style={{background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.35)",borderRadius:12,padding:10,textAlign:"center",fontSize:12,fontWeight:800,color:"#5eead4",marginBottom:12}}>{rows.length} تقييم متاح</div>
            {[{id:"overview",t:"نظرة شاملة",ic:"🏠"},{id:"daily",t:"التقرير اليومي",ic:"📝"},{id:"final",t:"التقرير النهائي",ic:"⭐"},{id:"teachers",t:"المعلمون بالقاعة",ic:"👨‍🏫"}].map(x=><button key={x.id} onClick={()=>setTab(x.id)} style={{width:"100%",display:"flex",gap:8,justifyContent:"flex-end",background:tab===x.id?"rgba(16,185,129,.15)":"transparent",border:tab===x.id?"1px solid rgba(16,185,129,.45)":"1px solid transparent",color:tab===x.id?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px 12px",marginBottom:6,cursor:"pointer",fontWeight:tab===x.id?800:600,fontSize:13}}><span>{x.t}</span><span>{x.ic}</span></button>)}
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث معلم / قاعة" style={{marginTop:10,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13}}/>
            <select value={room} onChange={e=>setRoom(e.target.value)} style={{marginTop:8,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px",color:"#e2e8f0",fontSize:13}}>{rooms.map(r=><option key={r} value={r} style={{color:"#111"}}>{r==="all"?"كل القاعات":"قاعة "+r}</option>)}</select>
            <button onClick={()=>router.push("/dashboard")} style={{width:"100%",marginTop:12,background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",textAlign:"right",fontSize:12}}>← لوحة التحكم</button>
          </div>
        </div>

        <div className="main">
          {err? <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:14,marginBottom:12}}>{err}</div>:null}
          <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0b1220,#111827)",borderRadius:24,padding:24,color:"#fff",marginBottom:14}}>
            <div style={{position:"absolute",left:16,top:-6,fontSize:80,fontWeight:900,color:"rgba(255,255,255,.04)"}}>REPORT</div>
            <div style={{position:"relative",textAlign:"center"}}><h1 style={{fontSize:28,fontWeight:900,margin:0}}>{tab==="teachers"?"المعلمون":tab==="daily"?"التقرير اليومي":tab==="final"?"التقرير النهائي":"لوحة القيادة"}</h1><p style={{color:"#94a3b8",margin:"6px 0",fontSize:13}}>ترتيب وتحليل أداء المعلمين مرتبط برقم القاعة • تصميم تنفيذي مثير</p></div>
          </div>

          {tab==="teachers" && (
            <div>
              <div className="g3" style={{marginBottom:14}}><Kpi lb="إجمالي التقييمات" v={rows.length} gh={rows.length}/><Kpi lb="متوسط الأداء" v={(teachers.reduce((s,x)=>s+x.avg,0)/(teachers.length||1)).toFixed(2)} gh="4.2"/><Kpi lb="القاعات النشطة" v={rooms.length-1} gh={rooms.length-1}/></div>
              <div style={{background:NAVY,borderRadius:22,padding:16,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h2 style={{margin:0,color:"#fff",fontWeight:900}}>🏆 ترتيب المعلمين بالقاعة</h2><span style={{background:"rgba(16,185,129,.15)",color:"#5eead4",borderRadius:999,padding:"4px 12px",fontSize:11,fontWeight:800}}>أفضل من المرجع</span></div>
                <div className="tw"><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr><Th>#</Th><Th>المعلم</Th><Th>قاعة</Th><Th>عدد</Th><Th>متوسط</Th><Th>وضوح</Th><Th>تدريس</Th><Th>الحالة</Th></tr></thead><tbody>{filtered.map((t,i)=>{const rk=rankS(i+1); const s=st(t.avg); return(<tr key={t.name+t.room} style={{borderTop:"1px solid rgba(255,255,255,.06)",background:i%2?"rgba(255,255,255,.02)":"transparent"}}><td style={{padding:"10px 8px"}}><div style={{width:32,height:32,borderRadius:10,background:rk.bg,color:rk.fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{rk.t}</div></td><td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:32,height:32,borderRadius:999,background:"linear-gradient(135deg,#10b981,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800}}>{t.name.charAt(0)}</div><span style={{color:"#fff",fontWeight:700,fontSize:13}}>{t.name}</span></div></td><td style={{padding:"10px 8px"}}><span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 10px",borderRadius:999,color:"#e2e8f0",fontSize:12}}>{t.room}</span></td><td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:6,alignItems:"center"}}><div style={{width:44,height:6,background:"rgba(255,255,255,.12)",borderRadius:6,overflow:"hidden"}}><div style={{width:t.count/maxC*100+"%",height:"100%",background:TEAL}}/></div><span style={{color:"#cbd5e1",fontSize:12}}>{t.count}</span></div></td><td style={{padding:"10px 8px"}}><b style={{color:"#fff"}}>{t.avg.toFixed(2)}</b></td><td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.clarity? t.clarity.toFixed(1):"—"}</td><td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.teaching? t.teaching.toFixed(1):"—"}</td><td style={{padding:"10px 8px"}}><span style={{background:s.bg,color:s.fg,padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:800}}>{s.t}</span></td></tr>);})}{filtered.length===0&&<tr><td colSpan={8} style={{textAlign:"center",padding:20,color:"#94a3b8"}}>لا يوجد معلمون - تأكد من تعبئة instructor_name و classroom_number في جدول evaluations</td></tr>}</tbody></table></div>
              </div>
              <div className="g2"><Card s={{background:NAVY,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🌟 الأفضل</h3>{top? <div style={{textAlign:"center"}}><div style={{fontSize:42}}>🏆</div><div style={{fontWeight:900,fontSize:18}}>{top.name}</div><div style={{color:"#5eead4",fontSize:12}}>قاعة {top.room} • {top.avg.toFixed(2)}/5</div></div>:<p style={{color:"#94a3b8"}}>لا بيانات</p>}</Card><Card s={{background:NAVY,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🤲 يحتاج دعماً</h3>{low? <div style={{textAlign:"center"}}><div style={{fontSize:28}}>💡</div><div style={{fontWeight:800}}>{low.name}</div><div style={{color:"#fbbf24",fontSize:12}}>قاعة {low.room} • {low.avg.toFixed(2)}</div></div>:<p style={{color:"#94a3b8"}}>لا بيانات</p>}</Card></div>
            </div>
          )}

          {tab!=="teachers" && (
            <div>
              <div className="g3"><Kpi lb="إجمالي" v={tab==="daily"?daily.count:tab==="final"?final.count:rows.length} gh={tab==="daily"?daily.count:tab==="final"?final.count:rows.length}/><Kpi lb="المتوسط" v={(tab==="daily"?daily.avg:tab==="final"?final.avg: (daily.avg+final.avg)/2).toFixed(1)} sf="/5" gh={(tab==="daily"?daily.avg:tab==="final"?final.avg: (daily.avg+final.avg)/2).toFixed(1)}/><Kpi lb="نسبة الرضا" v={Math.round((tab==="daily"?daily.avg:tab==="final"?final.avg: (daily.avg+final.avg)/2)/5*100)} sf="%" gh={Math.round((tab==="daily"?daily.avg:tab==="final"?final.avg: (daily.avg+final.avg)/2)/5*100)}/></div>
              <div className="g2"><Card><h3 style={{margin:"0 0 12px",fontWeight:800}}>📊 التوزيع اليومي</h3><svg viewBox="0 0 360 180" style={{width:"100%",height:"auto"}}>{(tab==="daily"?daily.days:final.days).map((d,i)=>{const bw=360/(tab==="daily"?daily.days:final.days).length; const x=i*bw+bw*0.22; const w=bw*0.56; const max=Math.max(1,...(tab==="daily"?daily.days:final.days).map(x=>x.count)); const h=d.count/max*120; const y=140-h; return(<g key={i}><text x={x+w/2} y={y-6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{d.count}</text><rect x={x} y={y} width={w} height={Math.max(4,h)} rx={6} fill="url(#g)"/><text x={x+w/2} y={156} textAnchor="middle" fontSize="9" fill="#64748b">{d.wd}</text></g>);})}<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#0d9488"/></linearGradient></defs></svg></Card><Card><h3 style={{margin:"0 0 12px",fontWeight:800}}>🎯 توزيع التقييم</h3>{[5,4,3,2,1].map(sv=>{const d=tab==="daily"?daily.dist:final.dist; const idx=sv-1; const max=Math.max(1,...d); const w=d[idx]/max*100; const col=["#10b981","#34d399","#facc15","#fb923c","#f43f5e"][4-(sv-1)]; return(<div key={sv} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}><span style={{width:50,fontSize:12}}>{sv} نجوم</span><div style={{flex:1,height:10,background:"#f0e9db",borderRadius:8}}><div style={{width:w+"%",height:"100%",background:col,borderRadius:8}}/></div><b style={{width:20}}>{d[idx]}</b></div>);})}</Card></div>
              <Card><h3 style={{margin:"0 0 12px",fontWeight:800}}>📈 أداء المحاور</h3>{(tab==="daily"?daily.axes:final.axes).map((a,i)=>{const s=st(a.value); return(<div key={i} style={{background:"#fff",border:"1px solid #f0e9db",borderRadius:12,padding:12,marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700}}>{a.label}</span><span style={{background:s.bg,color:s.fg,borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:800}}>{a.value.toFixed(2)}</span></div><div style={{height:8,background:"#f0e9db",borderRadius:8,marginTop:8}}><div style={{width:a.value/5*100+"%",height:"100%",background:TEAL,borderRadius:8}}/></div></div>);})}</Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
