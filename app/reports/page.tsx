// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px}.side{width:262px;flex-shrink:0;position:sticky;top:14px}.main{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tw{overflow:auto;border-radius:16px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}";
const TEAL="#10b981"; const NAVY="#0b1220";
function p2(n){return n<10?"0"+n:""+n;}
function rankS(r){ if(r===1) return {bg:"linear-gradient(135deg,#fbbf24,#f59e0b)",fg:"#000",t:"🥇"}; if(r===2) return {bg:"linear-gradient(135deg,#e2e8f0,#94a3b8)",fg:"#111",t:"🥈"}; if(r===3) return {bg:"linear-gradient(135deg,#fb923c,#7c2d12)",fg:"#fff",t:"🥉"}; return {bg:"#1e293b",fg:"#cbd5e1",t:""+r};}
function st(v){ if(v>=4.2) return {t:"ممتاز",bg:"#d1fae5",fg:"#065f46"}; if(v>=3.2) return {t:"جيد",bg:"#fef3c7",fg:"#92400e"}; return {t:"يحتاج دعماً",bg:"#fee2e2",fg:"#991b1b"};}
function avgA(a){return a.length? a.reduce((x,y)=>x+y,0)/a.length:0;}
function Card(p){return <div style={{background:"#fffdf9",border:"1px solid #ece4d4",borderRadius:20,padding:18,boxShadow:"0 4px 14px rgba(0,0,0,.04)",marginBottom:14,...(p.s||{})}}>{p.children}</div>;}
function Th(p){return <th style={{color:"#94a3b8",fontSize:11,fontWeight:800,padding:"10px 8px",textAlign:"right",whiteSpace:"nowrap"}}>{p.children}</th>;}
function SideBtn({active,onClick,t,ic}:any){return <button onClick={onClick} style={{width:"100%",display:"flex",gap:8,justifyContent:"flex-end",background:active?"rgba(16,185,129,.15)":"transparent",border:active?"1px solid rgba(16,185,129,.45)":"1px solid transparent",color:active?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px 12px",marginBottom:6,cursor:"pointer",fontWeight:active?800:600,fontSize:13}}><span>{t}</span><span>{ic}</span></button>;}

export default function Page(){
  const router=useRouter();
  const [rows,setRows]=useState([]); const [ans,setAns]=useState([]); const [qs,setQs]=useState([]);
  const [classrooms,setClassrooms]=useState([]); const [profiles,setProfiles]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState("");
  const [tab,setTab]=useState("teachers"); const [qSea,setQSea]=useState(""); const [roomF,setRoomF]=useState("all");

  useEffect(()=>{
    let on=true;
    (async()=>{
      try{
        let db:any; try{ db=(supabase as any)(); if(!db||!db.from) db=supabase as any; }catch{ db=supabase as any; }
        const s=await db.auth.getSession(); if(!s.data?.session){ if(on) setErr("انتهت الجلسة، سجّل الدخول مجددا"); return; }
        const [evRes, classRes] = await Promise.all([
          db.from("evaluations").select("*").order("submitted_at",{ascending:false}).limit(5000),
          db.from("classrooms").select("*").limit(500)
        ]);
        if(evRes.error) throw new Error(evRes.error.message);
        if(classRes.error) throw new Error(classRes.error.message);
        const ids=(evRes.data||[]).map((x:any)=>x.id);
        const aRes= ids.length? await db.from("evaluation_answers").select("evaluation_id,question_id,rating_value,text_value").in("evaluation_id",ids) : {data:[]};
        const trainerIds=[...new Set((classRes.data||[]).map((c:any)=> c.trainer_id||c.teacher_id||c.instructor_id).filter(Boolean))];
        let profData=[]; if(trainerIds.length){ const pRes=await db.from("profiles").select("id,full_name,display_name,name,email").in("id",trainerIds); if(pRes.data) profData=pRes.data; }
        if(!on) return; setRows(evRes.data||[]); setClassrooms(classRes.data||[]); setAns(aRes.data||[]); setProfiles(profData);
        const qRes=await db.from("questions").select("*").limit(500); if(qRes.data) setQs(qRes.data);
      }catch(ex:any){ if(on) setErr(ex.message||"خطأ"); }
      finally{ if(on) setLoad(false); }
    })(); return()=>{on=false;};
  },[]);

  const calcBasic=(kind:any)=>{
    const list=rows.filter((r:any)=>r.kind===kind); const ids=new Set(list.map((r:any)=>r.id));
    const qm:any={}; qs.forEach((q:any)=>{qm[q.id]=q;}); const g:any={};
    ans.forEach((a:any)=>{ if(ids.has(a.evaluation_id)&&a.rating_value!=null){ const v=Number(a.rating_value); if(!isNaN(v)){(g[a.question_id]=g[a.question_id]||[]).push(v);} }});
    const axes=Object.keys(g).map(id=>({label:qm[id]?.text_ar||"سؤال",section:qm[id]?.section_ar||"عام",value:avgA(g[id])})).sort((a:any,b:any)=>a.value-b.value);
    const all=list.map((r:any)=>Number(r.overall_rating)).filter((v:any)=>!isNaN(v)&&v>0);
    const dist=[0,0,0,0,0]; list.forEach((r:any)=>{ const v=Math.round(Number(r.overall_rating)); if(v>=1&&v<=5) dist[v-1]++; });
    const dm:any={}; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); dm[k]={wd:d.toLocaleDateString("ar-SA",{weekday:"long"}),dt:p2(d.getMonth()+1)+"-"+p2(d.getDate()),count:0}; }
    list.forEach((r:any)=>{ const d=new Date(r.submitted_at); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); if(dm[k]) dm[k].count++; });
    const days=Object.keys(dm).map(k=>dm[k]); return {count:list.length, avg:avgA(all), axes, dist, days};
  };
  const daily=useMemo(()=>calcBasic("DAILY"),[rows,ans,qs]);
  const final=useMemo(()=>calcBasic("FINAL"),[rows,ans,qs]);

  const teachersData=useMemo(()=>{
    const qm:any={}; qs.forEach((q:any)=>{qm[q.id]=q;});
    const classroomMap:any={}; classrooms.forEach((c:any)=>{classroomMap[c.id]=c;});
    const profileMap:any={}; profiles.forEach((p:any)=>{profileMap[p.id]=p.full_name||p.display_name||p.name||p.email||"معلم";});
    const groups:any={};
    rows.forEach((ev:any)=>{
      let classId=ev.classroom_id||ev.class_id||ev.room_id||null;
      let roomCode=ev.classroom_number||ev.room_number||ev.class_code||ev.room||null;
      let teacherName=ev.instructor_name||ev.teacher_name||ev.teacher||ev.instructor||null;
      let classroom=null;
      if(classId && classroomMap[classId]) classroom=classroomMap[classId];
      else if(roomCode){ classroom=classrooms.find((c:any)=> c.code===roomCode || c.room_number===roomCode); if(classroom) classId=classroom.id; }
      else if(ev.program_id){ const poss=classrooms.filter((c:any)=> c.program_id===ev.program_id); if(poss.length===1){ classroom=poss[0]; classId=classroom.id; } }
      if(classroom){
        if(!roomCode) roomCode=classroom.code||classroom.room_number||classroom.name||"—";
        if(!teacherName){
          const tid=classroom.trainer_id||classroom.teacher_id||classroom.instructor_id;
          teacherName= tid&&profileMap[tid]? profileMap[tid] : (classroom.trainer_name||classroom.teacher_name||"غير محدد");
        }
      }
      if(!teacherName) teacherName="غير محدد"; if(!roomCode) roomCode="—";
      const key=teacherName+"||"+roomCode; if(!groups[key]) groups[key]={name:teacherName, room:roomCode, level:classroom?.level||ev.level||"A1", classroomId:classId, evals:[], ans:[]};
      groups[key].evals.push(ev);
    });
    Object.keys(groups).forEach(k=>{ const ids=new Set(groups[k].evals.map((e:any)=>e.id)); groups[k].ans=ans.filter((a:any)=>ids.has(a.evaluation_id)); });
    const list=Object.values(groups).map((t:any)=>{
      const avgAll=t.evals.map((e:any)=>Number(e.overall_rating)).filter((v:any)=>!isNaN(v)&&v>0); const avg=avgA(avgAll);
      const bySec:any={}; t.ans.forEach((a:any)=>{ if(a.rating_value==null) return; const sec=qm[a.question_id]?.section_ar||"عام"; const v=Number(a.rating_value); if(isNaN(v)) return; if(!bySec[sec]) bySec[sec]=[]; bySec[sec].push(v); });
      const secAvg:any={}; Object.keys(bySec).forEach(s=>{secAvg[s]=avgA(bySec[s]);});
      return {...t, count:t.evals.length, avg, secAvg, clarity:secAvg["الوضوح"]||secAvg["جودة الحصة"]||0, teaching:secAvg["التدريس"]||0, motivation:secAvg["الدافعية"]||0};
    }).sort((a:any,b:any)=>b.avg-a.avg);
    return list;
  },[rows,classrooms,profiles,ans,qs]);

  const roomsList=useMemo(()=>{ const s=new Set(teachersData.map((t:any)=>t.room)); return ["all",...Array.from(s)]; },[teachersData]);
  const filtered=useMemo(()=> teachersData.filter((t:any)=>{ if(roomF!=="all"&&t.room!==roomF) return false; if(qSea){ const qq=qSea.toLowerCase(); if(!(t.name.toLowerCase().includes(qq)||t.room.toLowerCase().includes(qq))) return false; } return true; }),[teachersData,roomF,qSea]);
  const maxC=Math.max(1,...filtered.map((t:any)=>t.count)); const top=filtered[0]; const low=filtered.length?filtered[filtered.length-1]:null;

  const exportCsv=()=>{ const lines=["الترتيب,المعلم,القاعة,المستوى,العدد,المتوسط,الوضوح,التدريس"]; filtered.forEach((t:any,i:number)=>{ lines.push([i+1,`"${t.name}"`,t.room,t.level,t.count,t.avg.toFixed(2),t.clarity.toFixed(1),t.teaching.toFixed(1)].join(",")); }); const b=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download="teachers-by-room.csv"; a.click(); URL.revokeObjectURL(u); };

  if(load) return <div style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b"}}><style dangerouslySetInnerHTML={{__html:CSS}}/>جارٍ بناء تقرير المعلمين...</div>;

  return(
    <div style={{background:"#f1ece1",minHeight:"100vh",padding:14,color:"#111"}} className="rw">
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div className="lay">
        <div className="side">
          <div style={{background:"linear-gradient(180deg,#0b1220,#070b14)",borderRadius:22,padding:16,color:"#fff"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}><div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#10b981,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div><div><div style={{fontWeight:900}}>منصة التقييم</div><div style={{fontSize:11,color:"#94a3b8"}}>النظام الموحد</div></div></div>
            <div style={{background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.35)",borderRadius:12,padding:10,textAlign:"center",fontSize:12,fontWeight:800,color:"#5eead4",marginBottom:12}}>{rows.length} تقييم • {classrooms.length} قاعة • {teachersData.length} معلم</div>
            <SideBtn active={tab==="overview"} onClick={()=>setTab("overview")} t="نظرة شاملة" ic="🏠"/>
            <SideBtn active={tab==="daily"} onClick={()=>setTab("daily")} t="التقرير اليومي" ic="📝"/>
            <SideBtn active={tab==="final"} onClick={()=>setTab("final")} t="التقرير النهائي" ic="⭐"/>
            <SideBtn active={tab==="teachers"} onClick={()=>setTab("teachers")} t="المعلمون بالقاعة" ic="👨‍🏫"/>
            <input value={qSea} onChange={e=>setQSea(e.target.value)} placeholder="بحث معلم / قاعة" style={{marginTop:10,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13}}/>
            <select value={roomF} onChange={e=>setRoomF(e.target.value)} style={{marginTop:8,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px",color:"#e2e8f0",fontSize:13}}>{roomsList.map(r=><option key={r} value={r} style={{color:"#111"}}>{r==="all"?"كل القاعات":"قاعة "+r}</option>)}</select>
            <button onClick={()=>exportCsv()} style={{width:"100%",marginTop:10,background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"9px",fontWeight:800,cursor:"pointer",fontSize:13}}>⬇ تصدير Excel</button>
            <button onClick={()=>router.push("/dashboard")} style={{width:"100%",marginTop:8,background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",textAlign:"right",fontSize:12}}>← لوحة التحكم</button>
          </div>
        </div>

        <div className="main">
          {err? <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:14,marginBottom:12}}>{err}</div>:null}
          <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0b1220,#111827)",borderRadius:24,padding:24,color:"#fff",marginBottom:14}}>
            <div style={{position:"absolute",left:18,top:-6,fontSize:82,fontWeight:900,color:"rgba(255,255,255,.04)"}}>REPORT</div>
            <div style={{position:"relative",textAlign:"center"}}><h1 style={{fontSize:30,fontWeight:900,margin:0}}>{tab==="teachers"?"المعلمون":tab==="daily"?"التقرير اليومي":tab==="final"?"التقرير النهائي":"لوحة القيادة"}</h1><p style={{color:"#94a3b8",margin:"6px 0",fontSize:13}}>ترتيب وتحليل أداء أعضاء هيئة التدريس مرتبط برقم القاعة</p></div>
          </div>

          {tab==="teachers" && (
            <div>
              <div className="g3" style={{marginBottom:14}}>
                <Card><div style={{fontSize:12,color:"#9a8f7d",fontWeight:700,textAlign:"center"}}>إجمالي التقييمات</div><div style={{fontSize:36,fontWeight:900,textAlign:"center"}}>{rows.length}</div></Card>
                <Card><div style={{fontSize:12,color:"#9a8f7d",fontWeight:700,textAlign:"center"}}>متوسط الأداء</div><div style={{fontSize:36,fontWeight:900,textAlign:"center"}}>{(teachersData.reduce((s:any,x:any)=>s+x.avg,0)/(teachersData.length||1)).toFixed(2)}/5</div></Card>
                <Card><div style={{fontSize:12,color:"#9a8f7d",fontWeight:700,textAlign:"center"}}>القاعات النشطة</div><div style={{fontSize:36,fontWeight:900,textAlign:"center"}}>{roomsList.length-1}</div></Card>
              </div>
              <div style={{background:NAVY,borderRadius:22,padding:16,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><h2 style={{margin:0,color:"#fff",fontWeight:900}}>🏆 ترتيب المعلمين بالقاعة</h2><span style={{background:"rgba(16,185,129,.15)",color:"#5eead4",borderRadius:999,padding:"4px 12px",fontSize:11,fontWeight:800}}>أفضل من المرجع</span></div>
                <div className="tw"><table style={{width:"100%",borderCollapse:"collapse",minWidth:780}}><thead><tr><Th>#</Th><Th>المعلم</Th><Th>قاعة</Th><Th>مستوى</Th><Th>عدد</Th><Th>متوسط</Th><Th>وضوح</Th><Th>تدريس</Th><Th>الحالة</Th></tr></thead>
                <tbody>{filtered.map((t:any,i:number)=>{const rk=rankS(i+1); const s=st(t.avg); return(<tr key={t.name+t.room} style={{borderTop:"1px solid rgba(255,255,255,.06)",background:i%2?"rgba(255,255,255,.02)":"transparent"}}><td style={{padding:"10px 8px"}}><div style={{width:32,height:32,borderRadius:10,background:rk.bg,color:rk.fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{rk.t}</div></td><td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:32,height:32,borderRadius:999,background:"linear-gradient(135deg,#10b981,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800}}>{t.name.charAt(0)}</div><span style={{color:"#fff",fontWeight:700,fontSize:13}}>{t.name}</span></div></td><td style={{padding:"10px 8px"}}><span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 10px",borderRadius:999,color:"#e2e8f0",fontSize:12}}>{t.room}</span></td><td style={{padding:"10px 8px",color:"#94a3b8",fontSize:12}}>{t.level}</td><td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:6,alignItems:"center"}}><div style={{width:44,height:6,background:"rgba(255,255,255,.12)",borderRadius:6,overflow:"hidden"}}><div style={{width:t.count/Math.max(1,...filtered.map((x:any)=>x.count))*100+"%",height:"100%",background:TEAL}}/></div><span style={{color:"#cbd5e1",fontSize:12}}>{t.count}</span></div></td><td style={{padding:"10px 8px"}}><b style={{color:"#fff"}}>{t.avg.toFixed(2)}</b></td><td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.clarity? t.clarity.toFixed(1):"—"}</td><td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.teaching? t.teaching.toFixed(1):"—"}</td><td style={{padding:"10px 8px"}}><span style={{background:s.bg,color:s.fg,padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:800}}>{s.t}</span></td></tr>);})}{filtered.length===0&&<tr><td colSpan={9} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>لا يوجد ربط بين التقييمات والقاعات. أضف classroom_id في evaluations أو املأ code في classrooms</td></tr>}</tbody></table></div>
              </div>
              <div className="g2"><Card s={{background:NAVY,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🌟 الأفضل</h3>{top? <div style={{textAlign:"center"}}><div style={{fontSize:42}}>🏆</div><div style={{fontWeight:900,fontSize:18}}>{top.name}</div><div style={{color:"#5eead4",fontSize:12}}>قاعة {top.room} • {top.avg.toFixed(2)}/5</div></div>:<p style={{color:"#94a3b8"}}>لا بيانات</p>}</Card><Card s={{background:NAVY,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🤲 يحتاج دعماً</h3>{low? <div style={{textAlign:"center"}}><div style={{fontSize:28}}>💡</div><div style={{fontWeight:800}}>{low.name}</div><div style={{color:"#fbbf24",fontSize:12}}>قاعة {low.room} • {low.avg.toFixed(2)}</div></div>:<p style={{color:"#94a3b8"}}>لا بيانات</p>}</Card></div>
            </div>
          )}

          {tab!=="teachers" && (
            <div>
              <div className="g2"><Card s={{textAlign:"center"}}><div style={{fontSize:12,color:"#9a8f7d"}}>{tab==="daily"?"اليومي":"النهائي"} - الاستجابات</div><div style={{fontSize:32,fontWeight:900}}>{tab==="daily"?daily.count:tab==="overview"?rows.length:final.count}</div></Card><Card s={{textAlign:"center"}}><div style={{fontSize:12,color:"#9a8f7d"}}>المتوسط</div><div style={{fontSize:32,fontWeight:900}}>{(tab==="daily"?daily.avg:tab==="final"?final.avg:(daily.avg+final.avg)/2||0).toFixed(2)}/5</div></Card></div>
              <Card><h3 style={{margin:"0 0 12px",fontWeight:800}}>📊 التوزيع اليومي</h3><svg viewBox="0 0 360 180" style={{width:"100%",height:"auto"}}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#0d9488"/></linearGradient></defs>{(tab==="daily"?daily.days:final.days).map((d:any,i:number)=>{const bw=360/7; const x=i*bw+bw*0.22; const w=bw*0.56; const max=Math.max(1,...(tab==="daily"?daily.days:final.days).map((x:any)=>x.count)); const h=d.count/max*120; const y=140-h; return(<g key={i}><text x={x+w/2} y={y-6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{d.count}</text><rect x={x} y={y} width={w} height={Math.max(4,h)} rx={6} fill="url(#g)"/><text x={x+w/2} y={156} textAnchor="middle" fontSize="9" fill="#64748b">{d.wd}</text></g>);})}</svg></Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
