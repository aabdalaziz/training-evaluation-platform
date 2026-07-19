// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px;align-items:flex-start}.side{width:268px;flex-shrink:0;position:sticky;top:14px}.main{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tw{overflow:auto;border-radius:16px}::-webkit-scrollbar{height:6px;width:6px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}";
const TEAL="#10b981"; const NAVY="#0b1220";
function p2(n){return n<10?"0"+n:""+n;}
function rankS(r){ if(r===1) return {bg:"linear-gradient(135deg,#fbbf24,#f59e0b)",fg:"#000",t:"1"}; if(r===2) return {bg:"linear-gradient(135deg,#e2e8f0,#94a3b8)",fg:"#111",t:"2"}; if(r===3) return {bg:"linear-gradient(135deg,#fb923c,#78350f)",fg:"#fff",t:"3"}; return {bg:"#1e293b",fg:"#cbd5e1",t:String(r)};}
function st(v){ if(v>=4.2) return {t:"ممتاز",bg:"#d1fae5",fg:"#065f46"}; if(v>=3.2) return {t:"جيد",bg:"#fef3c7",fg:"#92400e"}; return {t:"يحتاج دعماً",bg:"#fee2e2",fg:"#991b1b"};}
function avgA(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function getDb(){ try{ const f:any=supabase; const c=f(); return c?.from?c:f; }catch{ return supabase as any; } }

export default function Page(){
  const router=useRouter();
  const [rows,setRows]=useState([]); const [ans,setAns]=useState([]); const [qs,setQs]=useState([]);
  const [rooms,setRooms]=useState([]); const [profs,setProfs]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState("");
  const [tab,setTab]=useState("teachers"); const [qSea,setQSea]=useState(""); const [roomF,setRoomF]=useState("all");

  useEffect(()=>{ let on=true; (async()=>{
    try{
      const db=getDb(); const s=await db.auth.getSession(); if(!s.data?.session){ if(on) setErr("سجل الدخول مجددا"); return; }
      const cRes=await db.from("classrooms").select("*").limit(1000);
      if(cRes.error) throw new Error(cRes.error.message);
      const classrooms=cRes.data||[];
      const trainerIds=[...new Set(classrooms.map((c:any)=>c.trainer_id).filter(Boolean))];
      let profilesData=[]; if(trainerIds.length){ const p=await db.from("profiles").select("id,full_name,display_name,email").in("id",trainerIds); profilesData=p.data||[]; }
      const eRes=await db.from("evaluations").select("*").order("submitted_at",{ascending:false}).limit(5000);
      const ids=(eRes.data||[]).map((x:any)=>x.id);
      const aRes=ids.length? await db.from("evaluation_answers").select("evaluation_id,question_id,rating_value").in("evaluation_id",ids):{data:[]};
      const qRes=await db.from("questions").select("id,text_ar,section_ar").limit(1000);
      if(!on) return; setRooms(classrooms); setProfs(profilesData); setRows(eRes.data||[]); setAns(aRes.data||[]); setQs(qRes.data||[]);
    }catch(e:any){ if(on) setErr(e.message);} finally{ if(on) setLoad(false); }
  })(); return()=>{on=false}; },[]);

  const calcBasic=(kind:any)=>{
    const list=rows.filter((r:any)=>r.kind===kind); const avg=avgA(list.map((r:any)=>Number(r.overall_rating)).filter((v:any)=>!isNaN(v)&&v>0));
    const dist=[0,0,0,0,0]; list.forEach((r:any)=>{ const v=Math.round(Number(r.overall_rating)); if(v>=1&&v<=5) dist[v-1]++; });
    const dm:any={}; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); dm[k]={wd:d.toLocaleDateString("ar-SA",{weekday:"long"}),dt:p2(d.getMonth()+1)+"-"+p2(d.getDate()),count:0}; }
    list.forEach((r:any)=>{ const d=new Date(r.submitted_at); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); if(dm[k]) dm[k].count++; });
    return {count:list.length, avg, dist, days:Object.values(dm)};
  };
  const daily=useMemo(()=>calcBasic("DAILY"),[rows]);
  const final=useMemo(()=>calcBasic("FINAL"),[rows]);

  const teachers=useMemo(()=>{
    const qm:any={}; qs.forEach((x:any)=>{qm[x.id]=x.section_ar||"عام";});
    const cMap:any={}; rooms.forEach((c:any)=>cMap[c.id]=c);
    const pMap:any={}; profs.forEach((p:any)=>pMap[p.id]=p.full_name||p.display_name||p.email||"معلم");
    // group evaluations by classroom_id
    const g:any={};
    rows.forEach((ev:any)=>{
      let cid=ev.classroom_id || ev.class_id;
      if(!cid && ev.classroom_number){ const f=rooms.find((c:any)=>String(c.code)===String(ev.classroom_number)); if(f) cid=f.id; }
      if(!cid) return;
      if(!g[cid]) g[cid]={evals:[],ans:[]};
      g[cid].evals.push(ev);
    });
    const evMap:any={}; rows.forEach((e:any)=>evMap[e.id]=e);
    ans.forEach((a:any)=>{
      const ev=evMap[a.evaluation_id]; if(!ev) return;
      let cid=ev.classroom_id || ev.class_id;
      if(!cid && ev.classroom_number){ const f=rooms.find((c:any)=>String(c.code)===String(ev.classroom_number)); if(f) cid=f.id; }
      if(!cid || !g[cid]) return; g[cid].ans.push(a);
    });
    let res=Object.entries(g).map(([cid,val]:any)=>{
      const c=cMap[cid]; const tName=c?.trainer_id? pMap[c.trainer_id] : "غير معين";
      const avg=avgA(val.evals.map((e:any)=>Number(e.overall_rating)).filter((v:any)=>!isNaN(v)&&v>0));
      const sec:any={}; val.ans.forEach((a:any)=>{ const secName=qm[a.question_id]||"عام"; const v=Number(a.rating_value); if(isNaN(v)) return; if(!sec[secName]) sec[secName]=[]; sec[secName].push(v); });
      const secAvg:any={}; Object.keys(sec).forEach(k=>secAvg[k]=avgA(sec[k]));
      return {id:cid, code:c?.code||"—", level:c?.level||"—", trainerId:c?.trainer_id||null, name:tName, count:val.evals.length, avg, clarity:secAvg["الوضوح"]||secAvg["وضوح الشرح"]||0, teaching:secAvg["التدريس"]||0, motiv:secAvg["الدافعية"]||0, secAvg};
    }).sort((a:any,b:any)=>b.avg-a.avg);
    // اضف القاعات اللي ما عندها تقييمات حتى يبين انها تحتاج تعيين
    rooms.forEach((c:any)=>{ if(!g[c.id]){ const tName=c.trainer_id? pMap[c.trainer_id]:"غير معين"; res.push({id:c.id, code:c.code, level:c.level, trainerId:c.trainer_id, name:tName, count:0, avg:0, clarity:0, teaching:0, motiv:0, secAvg:{}}); } });
    // ترتيب مرة ثانية: اول شي اللي عنده تقييمات
    res = res.sort((a:any,b:any)=>{ if(b.count===0 && a.count===0) return 0; if(b.count===0) return -1; if(a.count===0) return 1; return b.avg-a.avg; });
    return res;
  },[rows,ans,rooms,profs,qs]);

  const roomCodes=useMemo(()=>["all",...Array.from(new Set(rooms.map((r:any)=>String(r.code))))],[rooms]);
  const filtered=useMemo(()=>teachers.filter((t:any)=>{ if(roomF!=="all"&& String(t.code)!==String(roomF)) return false; if(qSea){ const q=qSea.toLowerCase(); if(!(t.name.toLowerCase().includes(q)|| String(t.code).toLowerCase().includes(q))) return false; } return true; }),[teachers,roomF,qSea]);
  const maxC=Math.max(1,...filtered.map((t:any)=>t.count));
  const top=filtered.find((t:any)=>t.count>0); const low=[...filtered].reverse().find((t:any)=>t.count>0);
  const exportCsv=()=>{ const lines=["الترتيب,المعلم,القاعة,المستوى,عدد التقييمات,المتوسط,الوضوح,التدريس,الدافعية"]; filtered.forEach((t:any,i:number)=>{ lines.push([i+1,`"${t.name}"`,t.code,t.level,t.count,t.avg.toFixed(2),t.clarity.toFixed(1),t.teaching.toFixed(1),t.motiv.toFixed(1)].join(",")); }); const b=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download="teachers-by-room.csv"; a.click(); URL.revokeObjectURL(u); };

  if(load) return <div style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><style dangerouslySetInnerHTML={{__html:CSS}}/>جارٍ بناء تقرير المعلمين...</div>;

  return(
    <div className="rw" style={{background:"#f1ece1",minHeight:"100vh",padding:14}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div className="lay">
        <div className="side">
          <div style={{background:"linear-gradient(180deg,#0b1220,#070b14)",borderRadius:22,padding:16,color:"#fff"}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}><div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#10b981,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div><div><div style={{fontWeight:900}}>منصة التقييم</div><div style={{fontSize:11,color:"#94a3b8"}}>{rooms.length} قاعة • {teachers.filter((t:any)=>t.trainerId).length} معلم معين</div></div></div>
            <button onClick={()=>setTab("daily")} style={{width:"100%",background:tab==="daily"?"rgba(16,185,129,.15)":"transparent",border:tab==="daily"?"1px solid rgba(16,185,129,.5)":"1px solid transparent",color:tab==="daily"?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px 12px",marginBottom:6,cursor:"pointer",textAlign:"right",fontWeight:700}}>📝 التقرير اليومي</button>
            <button onClick={()=>setTab("final")} style={{width:"100%",background:tab==="final"?"rgba(16,185,129,.15)":"transparent",border:tab==="final"?"1px solid rgba(16,185,129,.5)":"1px solid transparent",color:tab==="final"?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px 12px",marginBottom:6,cursor:"pointer",textAlign:"right",fontWeight:700}}>⭐ التقرير النهائي</button>
            <button onClick={()=>setTab("teachers")} style={{width:"100%",background:tab==="teachers"?"rgba(16,185,129,.2)":"transparent",border:"1px solid rgba(16,185,129,.6)",color:"#5eead4",borderRadius:12,padding:"10px 12px",marginBottom:10,cursor:"pointer",textAlign:"right",fontWeight:900}}>👨‍🏫 المعلمون بالقاعة</button>
            <input value={qSea} onChange={e=>setQSea(e.target.value)} placeholder="بحث معلم / قاعة 203" style={{width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13}}/>
            <select value={roomF} onChange={e=>setRoomF(e.target.value)} style={{marginTop:8,width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"9px",color:"#e2e8f0",fontSize:13}}>{roomCodes.map((c:any)=><option key={c} value={c} style={{color:"#111"}}>{c==="all"?"كل القاعات":"قاعة "+c}</option>)}</select>
            <button onClick={exportCsv} style={{width:"100%",marginTop:10,background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"10px",fontWeight:900,cursor:"pointer"}}>⬇ تصدير Excel</button>
            <button onClick={()=>router.push("/dashboard")} style={{width:"100%",marginTop:8,background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:12,textAlign:"right"}}>← لوحة التحكم</button>
          </div>
        </div>

        <div className="main">
          {err? <div style={{background:"#fee2e2",color:"#991b1b",padding:12,borderRadius:14,marginBottom:12}}>{err}</div>:null}
          <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0b1220,#111827)",borderRadius:24,padding:24,color:"#fff",marginBottom:14}}>
            <div style={{position:"absolute",left:18,top:-6,fontSize:80,fontWeight:900,color:"rgba(255,255,255,.04)"}}>REPORT</div>
            <div style={{position:"relative",textAlign:"center"}}><h1 style={{fontSize:28,fontWeight:900,margin:0}}>{tab==="teachers"?"ترتيب المعلمين بالقاعات":tab==="daily"?"التقرير اليومي":"التقرير النهائي"}</h1><p style={{color:"#94a3b8",fontSize:13,marginTop:6}}>أداء أعضاء هيئة التدريس مرتبط برقم القاعة • تصميم تنفيذي مثير</p></div>
          </div>

          {tab!=="teachers" && (
            <div>
              <div className="g3"><div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>الاستجابات</div><div style={{fontSize:30,fontWeight:900}}>{tab==="daily"?daily.count:final.count}</div></div><div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>المتوسط</div><div style={{fontSize:30,fontWeight:900}}>{(tab==="daily"?daily.avg:final.avg).toFixed(2)}/5</div></div><div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>نسبة الرضا</div><div style={{fontSize:30,fontWeight:900}}>{Math.round((tab==="daily"?daily.avg:final.avg)/5*100)}%</div></div></div>
            </div>
          )}

          {tab==="teachers" && (
            <div>
              <div className="g3" style={{marginBottom:14}}>
                <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>القاعات</div><div style={{fontSize:32,fontWeight:900}}>{rooms.length}</div></div>
                <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>المعلمون المعينون</div><div style={{fontSize:32,fontWeight:900}}>{teachers.filter((t:any)=>t.trainerId).length}/{teachers.length}</div></div>
                <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>متوسط المنصة</div><div style={{fontSize:32,fontWeight:900}}>{(teachers.filter((t:any)=>t.count>0).reduce((s:any,x:any)=>s+x.avg,0)/(teachers.filter((t:any)=>t.count>0).length||1)).toFixed(2)}/5</div></div>
              </div>

              <div style={{background:"#0f172a",borderRadius:22,padding:16,marginBottom:14,border:"1px solid #1e293b"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"center"}}><h2 style={{margin:0,color:"#fff",fontWeight:900}}>🏆 ترتيب المعلمين - مرتبط بالقاعة</h2><span style={{background:"rgba(16,185,129,.15)",color:"#5eead4",borderRadius:999,padding:"4px 10px",fontSize:11,fontWeight:800}}>{filtered.length} نتيجة</span></div>
                <div className="tw"><table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}><thead><tr style={{textAlign:"right"}}><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>#</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>المعلم</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>قاعة</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>مستوى</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>عدد</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>متوسط</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>وضوح</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>تدريس</th><th style={{color:"#94a3b8",fontSize:11,padding:"10px 8px"}}>الحالة</th></tr></thead><tbody>
                  {filtered.map((t:any,i:number)=>{ const rk=rankS(i+1); const s=st(t.avg); const isUnassigned=t.count===0; return(
                    <tr key={t.id} style={{borderTop:"1px solid rgba(255,255,255,.06)",opacity:isUnassigned?0.6:1,background:i%2?"rgba(255,255,255,.02)":"transparent"}}>
                      <td style={{padding:"10px 8px"}}><div style={{width:30,height:30,borderRadius:10,background:rk.bg,color:rk.fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12}}>{rk.t}</div></td>
                      <td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:30,height:30,borderRadius:999,background:t.trainerId?"linear-gradient(135deg,#10b981,#0ea5e9)":"#334155",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}}>{t.name.charAt(0)}</div><div><div style={{color:t.trainerId?"#fff":"#fbbf24",fontWeight:700,fontSize:13}}>{t.name}</div>{!t.trainerId&&<div style={{fontSize:10,color:"#fbbf24"}}>يحتاج تعيين مدرب</div>}</div></div></td>
                      <td style={{padding:"10px 8px"}}><span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",padding:"4px 10px",borderRadius:999,color:"#e2e8f0",fontSize:12}}>{t.code}</span></td>
                      <td style={{padding:"10px 8px",color:"#94a3b8",fontSize:12}}>{t.level}</td>
                      <td style={{padding:"10px 8px"}}><div style={{display:"flex",gap:6,alignItems:"center"}}><div style={{width:40,height:6,background:"rgba(255,255,255,.12)",borderRadius:6,overflow:"hidden"}}><div style={{width:t.count/Math.max(1,...filtered.map((x:any)=>x.count))*100+"%",height:"100%",background:TEAL}} /></div><span style={{color:"#cbd5e1",fontSize:12}}>{t.count}</span></div></td>
                      <td style={{padding:"10px 8px"}}><b style={{color:"#fff"}}>{t.count? t.avg.toFixed(2):"—"}</b></td>
                      <td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.clarity? t.clarity.toFixed(1):"—"}</td>
                      <td style={{padding:"10px 8px",color:"#cbd5e1",fontSize:12}}>{t.teaching? t.teaching.toFixed(1):"—"}</td>
                      <td style={{padding:"10px 8px"}}><span style={{background:s.bg,color:s.fg,padding:"4px 10px",borderRadius:999,fontSize:11,fontWeight:800}}>{t.count? s.t:"لا يوجد تقييم"}</span></td>
                    </tr>
                  );})}
                </tbody></table></div>
                {filtered.length===0&& <div style={{textAlign:"center",padding:20,color:"#94a3b8"}}>لا يوجد معلمون مطابقون</div>}
              </div>

              <div className="g2"><div style={{background:NAVY,borderRadius:20,padding:18,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🌟 الأفضل</h3>{top? <div style={{textAlign:"center"}}><div style={{fontSize:44}}>🏆</div><div style={{fontWeight:900,fontSize:18}}>{top.name}</div><div style={{color:"#5eead4",fontSize:13}}>قاعة {top.code} • {top.avg.toFixed(2)}/5 • {top.count} تقييم</div></div>:<div style={{color:"#94a3b8"}}>لا توجد بيانات تقييم بعد - اربط التقييمات بالقاعات</div>}</div><div style={{background:NAVY,borderRadius:20,padding:18,color:"#fff"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🤲 يحتاج دعماً</h3>{low? <div style={{textAlign:"center"}}><div style={{fontSize:32}}>💡</div><div style={{fontWeight:800}}>{low.name}</div><div style={{color:"#fbbf24",fontSize:12}}>قاعة {low.code} • {low.avg.toFixed(2)}</div></div>:<div style={{color:"#94a3b8"}}>بانتظار البيانات</div>}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
