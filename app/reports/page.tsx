// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase as supabaseImp } from "../../lib/supabase/client";

const CSS="@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px}.side{width:262px;flex-shrink:0;position:sticky;top:14px}.main{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tw{overflow:auto;border-radius:16px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}";
const TEAL="#10b981"; const NAVY="#0b1220";
function getDb(){ try{ const fn:any=supabaseImp; if(typeof fn==='function'){ try{ const c=fn(); if(c&&c.from) return c; }catch{} return fn; } return fn; }catch{ return supabaseImp as any; } }
function p2(n){return n<10?"0"+n:""+n;} function avgA(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function rankS(r){ if(r===1) return {bg:"linear-gradient(135deg,#fbbf24,#f59e0b)",fg:"#000",t:"1"}; if(r===2) return {bg:"linear-gradient(135deg,#e2e8f0,#94a3b8)",fg:"#111",t:"2"}; if(r===3) return {bg:"linear-gradient(135deg,#fb923c,#78350f)",fg:"#fff",t:"3"}; return {bg:"#1e293b",fg:"#cbd5e1",t:String(r)};}
function st(v){ if(v>=4.2) return {t:"ممتاز",bg:"#d1fae5",fg:"#065f46"}; if(v>=3.2) return {t:"جيد",bg:"#fef3c7",fg:"#92400e"}; return {t:"يحتاج دعماً",bg:"#fee2e2",fg:"#991b1b"};}

export default function Page(){
  const router=useRouter();
  const [rows,setRows]=useState([]); const [ans,setAns]=useState([]); const [qs,setQs]=useState([]); const [rooms,setRooms]=useState([]); const [profs,setProfs]=useState([]);
  const [load,setLoad]=useState(true); const [err,setErr]=useState(""); const [tab,setTab]=useState("teachers"); const [q,setQ]=useState(""); const [roomF,setRoomF]=useState("all");

  useEffect(()=>{ let on=true; (async()=>{
    try{
      const db=getDb(); const s=await db.auth.getSession(); if(!s?.data?.session){ if(on) setErr("سجل الدخول مجددا"); return; }
      const cRes=await db.from("classrooms").select("*").limit(500);
      const eRes=await db.from("evaluations").select("*").order("submitted_at",{ascending:false}).limit(5000);
      const ids=(eRes.data||[]).map((x:any)=>x.id);
      const aRes=ids.length? await db.from("evaluation_answers").select("*").in("evaluation_id",ids):{data:[]};
      const qRes=await db.from("questions").select("*").limit(500);
      let profsData=[]; const tIds=[...new Set((cRes.data||[]).map((c:any)=>c.trainer_id).filter(Boolean))]; if(tIds.length){ const p=await db.from("profiles").select("*").in("id",tIds); profsData=p.data||[]; }
      if(!on) return; setRooms(cRes.data||[]); setRows(eRes.data||[]); setAns(aRes.data||[]); setQs(qRes.data||[]); setProfs(profsData);
    }catch(e:any){ if(on) setErr(e.message);} finally{ if(on) setLoad(false); }
  })(); return()=>{on=false}; },[]);

  const calcFull=(kind:string)=>{
    const list=rows.filter((r:any)=>r.kind===kind); const ids=new Set(list.map((r:any)=>r.id));
    const qm:any={}; qs.forEach((x:any)=>{qm[x.id]=x;}); const g:any={};
    ans.forEach((a:any)=>{ if(ids.has(a.evaluation_id)&&a.rating_value!=null){ const v=Number(a.rating_value); if(!isNaN(v)){(g[a.question_id]=g[a.question_id]||[]).push(v);} }});
    const axes=Object.keys(g).map(id=>({label:qm[id]?.text_ar||"سؤال",section:qm[id]?.section_ar||"عام",value:avgA(g[id])})).sort((a:any,b:any)=>a.value-b.value);
    const secMap:any={}; axes.forEach((x:any)=>{ if(!secMap[x.section]) secMap[x.section]=[]; secMap[x.section].push(x.value); });
    const sections=Object.keys(secMap).map(k=>({name:k,value:avgA(secMap[k])})).sort((a:any,b:any)=>b.value-a.value);
    const all=list.map((r:any)=>Number(r.overall_rating)).filter((v:any)=>!isNaN(v)&&v>0); const avg=avgA(all);
    const dist=[0,0,0,0,0]; list.forEach((r:any)=>{ const v=Math.round(Number(r.overall_rating)); if(v>=1&&v<=5) dist[v-1]++; });
    const dm:any={}; for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); dm[k]={wd:d.toLocaleDateString("ar-SA",{weekday:"long"}),dt:p2(d.getMonth()+1)+"-"+p2(d.getDate()),count:0}; }
    list.forEach((r:any)=>{ const d=new Date(r.submitted_at); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); if(dm[k]) dm[k].count++; });
    const days=Object.values(dm) as any[]; const comments=[]; ans.forEach((a:any)=>{ if(ids.has(a.evaluation_id)&&a.text_value&&a.text_value.trim()&&comments.length<5) comments.push(a.text_value.trim()); });
    return {count:list.length,avg,axes,dist,days,sections,comments};
  };
  const daily=useMemo(()=>calcFull("DAILY"),[rows,ans,qs]); const final=useMemo(()=>calcFull("FINAL"),[rows,ans,qs]);

  const teachers=useMemo(()=>{
    const cMap:any={}; rooms.forEach((c:any)=>cMap[c.id]=c); const pMap:any={}; profs.forEach((p:any)=>pMap[p.id]=p.full_name||p.display_name||p.email||"معلم");
    const g:any={}; rows.forEach((ev:any)=>{ let cid=ev.classroom_id; if(!cid&&ev.classroom_number){ const f=rooms.find((c:any)=>String(c.code)===String(ev.classroom_number)); if(f) cid=f.id; } if(!cid) return; if(!g[cid]) g[cid]={evals:[],ans:[]}; g[cid].evals.push(ev); });
    const evMap:any={}; rows.forEach((e:any)=>evMap[e.id]=e); ans.forEach((a:any)=>{ const ev=evMap[a.evaluation_id]; if(!ev) return; let cid=ev.classroom_id; if(!cid&&ev.classroom_number){ const f=rooms.find((c:any)=>String(c.code)===String(ev.classroom_number)); if(f) cid=f.id; } if(!cid||!g[cid]) return; g[cid].ans.push(a); });
    let list=Object.entries(g).map(([cid,val]:any)=>{ const c=cMap[cid]; const tName=c?.trainer_id? pMap[c.trainer_id]:"غير معين"; const avg=avgA(val.evals.map((e:any)=>Number(e.overall_rating)).filter((v:any)=>!isNaN(v)&&v>0)); return {id:cid,code:c?.code||"—",level:c?.level||"—",trainerId:c?.trainer_id||null,name:tName,count:val.evals.length,avg}; }).sort((a:any,b:any)=>b.avg-a.avg);
    rooms.forEach((c:any)=>{ if(!g[c.id]){ const tName=c.trainer_id? pMap[c.trainer_id]:"غير معين"; list.push({id:c.id,code:c.code,level:c.level,trainerId:c.trainer_id,name:tName,count:0,avg:0}); } });
    return list.sort((a:any,b:any)=>{ if(b.count===0&&a.count===0) return 0; if(b.count===0) return -1; if(a.count===0) return 1; return b.avg-a.avg; });
  },[rows,ans,rooms,profs]);

  const roomsList=useMemo(()=>["all",...Array.from(new Set(rooms.map((r:any)=>String(r.code))))],[rooms]);
  const filtered=useMemo(()=>teachers.filter((t:any)=>{ if(roomF!=="all"&&String(t.code)!==String(roomF)) return false; if(q){ const qq=q.toLowerCase(); if(!(t.name.toLowerCase().includes(qq)||String(t.code).toLowerCase().includes(qq))) return false; } return true; }),[teachers,roomF,q]);
  const maxC=Math.max(1,...filtered.map((t:any)=>t.count));

  if(load) return <div style={{background:"#f1ece1",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>جارٍ بناء التقارير...</div>;
  return(
    <div style={{background:"#f1ece1",minHeight:"100vh",padding:14}} className="rw">
      <style dangerouslySetInnerHTML={{__html:"@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800;900&display=swap');.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}.lay{display:flex;gap:16px}.side{width:260px;flex-shrink:0;position:sticky;top:14px}.main{flex:1;min-width:0}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.tw{overflow:auto;border-radius:16px}@media(max-width:980px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}"}}/>
      <div className="lay">
        <div className="side">
          <div style={{background:"linear-gradient(180deg,#0b1220,#070b14)",borderRadius:22,padding:16,color:"#fff"}}>
            <div style={{fontWeight:900,marginBottom:12}}>منصة التقييم</div>
            <button onClick={()=>setTab("overview")} style={{width:"100%",background:tab==="overview"?"rgba(16,185,129,.15)":"transparent",border:tab==="overview"?"1px solid rgba(16,185,129,.5)":"1px solid transparent",color:tab==="overview"?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px",marginBottom:6}}>🏠 نظرة شاملة</button>
            <button onClick={()=>setTab("daily")} style={{width:"100%",background:tab==="daily"?"rgba(16,185,129,.15)":"transparent",border:tab==="daily"?"1px solid rgba(16,185,129,.5)":"1px solid transparent",color:tab==="daily"?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px",marginBottom:6}}>📝 التقرير اليومي</button>
            <button onClick={()=>setTab("final")} style={{width:"100%",background:tab==="final"?"rgba(16,185,129,.15)":"transparent",border:tab==="final"?"1px solid rgba(16,185,129,.5)":"1px solid transparent",color:tab==="final"?"#5eead4":"#cbd5e1",borderRadius:12,padding:"10px",marginBottom:6}}>⭐ التقرير النهائي</button>
            <button onClick={()=>setTab("teachers")} style={{width:"100%",background:tab==="teachers"?"rgba(16,185,129,.2)":"transparent",border:"1px solid rgba(16,185,129,.6)",color:"#5eead4",borderRadius:12,padding:"10px",marginBottom:10,fontWeight:900}}>👨‍🏫 المعلمون بالقاعة</button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث معلم / قاعة" style={{width:"100%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:9,color:"#fff",fontSize:13}}/>
            <select value={roomF} onChange={e=>setRoomF(e.target.value)} style={{width:"100%",marginTop:8,background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:9,color:"#e2e8f0"}}>{roomsList.map((r:any)=><option key={r} value={r} style={{color:"#111"}}>{r==="all"?"كل القاعات":"قاعة "+r}</option>)}</select>
            <button onClick={()=>router.push("/admin/management")} style={{width:"100%",marginTop:10,background:"#fff",color:"#111",border:"none",borderRadius:10,padding:9,fontWeight:800}}>🏫 إدارة القاعات والمدربين</button>
            <button onClick={()=>router.push("/dashboard")} style={{width:"100%",marginTop:8,background:"transparent",border:"none",color:"#94a3b8",fontSize:12,textAlign:"right"}}>← لوحة التحكم</button>
          </div>
        </div>
        <div className="main">
          {err&&<div style={{background:"#fee2e2",padding:10,borderRadius:12,marginBottom:10,color:"#991b1b"}}>{err}</div>}

          {tab==="teachers" && (
            <div>
              <div style={{background:NAVY,borderRadius:22,padding:16,marginBottom:12}}><h2 style={{margin:0,color:"#fff",fontWeight:900}}>🏆 ترتيب المعلمين - مرتبط بالقاعة</h2><div className="tw" style={{marginTop:12}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr><th style={{color:"#94a3b8",fontSize:11,textAlign:"right",padding:8}}>#</th><th style={{color:"#94a3b8",fontSize:11,textAlign:"right",padding:8}}>المعلم</th><th style={{color:"#94a3b8",fontSize:11,textAlign:"right",padding:8}}>قاعة</th><th style={{color:"#94a3b8",fontSize:11,textAlign:"right",padding:8}}>عدد</th><th style={{color:"#94a3b8",fontSize:11,textAlign:"right",padding:8}}>متوسط</th><th style={{color:"#94a3b8",fontSize:11,textAlign:"right",padding:8}}>حالة</th></tr></thead><tbody>{filtered.map((t:any,i:number)=>{const rk=rankS(i+1); const s=st(t.avg); return(<tr key={t.id} style={{borderTop:"1px solid rgba(255,255,255,.06)"}}><td style={{padding:8}}><div style={{width:28,height:28,borderRadius:8,background:rk.bg,color:rk.fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{rk.t}</div></td><td style={{padding:8,color:"#fff",fontWeight:700}}>{t.name}{!t.trainerId&&<span style={{color:"#fbbf24",fontSize:10,marginRight:6}}> (يحتاج تعيين)</span>}</td><td style={{padding:8}}><span style={{background:"rgba(255,255,255,.1)",padding:"3px 10px",borderRadius:999,color:"#e2e8f0",fontSize:12}}>{t.code}</span></td><td style={{padding:8,color:"#cbd5e1"}}>{t.count}</td><td style={{padding:8,color:"#fff",fontWeight:800}}>{t.count? t.avg.toFixed(2):"—"}</td><td style={{padding:8}}><span style={{background:s.bg,color:s.fg,padding:"3px 8px",borderRadius:999,fontSize:11,fontWeight:800}}>{t.count? s.t:"لا يوجد تقييم"}</span></td></tr>);})}</tbody></table></div></div>
            </div>
          )}

          {(tab==="daily"||tab==="final") && (
            <div>
              {(() => { const d=tab==="daily"?daily:final; return (<>
                <div className="g3" style={{marginBottom:12}}>
                  <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>إجمالي التقييمات</div><div style={{fontSize:32,fontWeight:900}}>{d.count}</div></div>
                  <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>متوسط الرضا</div><div style={{fontSize:32,fontWeight:900}}>{d.avg.toFixed(1)}/5</div></div>
                  <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div style={{fontSize:12,color:"#9a8f7d"}}>نسبة الرضا</div><div style={{fontSize:32,fontWeight:900}}>{Math.round(d.avg/5*100)}%</div></div>
                </div>
                <div className="g2">
                  <div style={{background:"#fffdf9",borderRadius:18,padding:16,border:"1px solid #ece4d4"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>📊 التوزيع اليومي</h3><svg viewBox="0 0 360 180" style={{width:"100%",height:"auto"}}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#0d9488"/></linearGradient></defs>{d.days.map((day:any,i:number)=>{ const max=Math.max(1,...d.days.map((x:any)=>x.count)); const bw=360/d.days.length; const x=i*bw+bw*0.22; const w=bw*0.56; const h=day.count/max*120; const y=140-h; return(<g key={i}><text x={x+w/2} y={y-6} textAnchor="middle" fontSize="11" fontWeight="800">{day.count}</text><rect x={x} y={y} width={w} height={Math.max(4,h)} rx={6} fill="url(#g)"/><text x={x+w/2} y={156} textAnchor="middle" fontSize="9" fill="#64748b">{day.wd}</text></g>);})}</svg></div>
                  <div style={{background:"#fffdf9",borderRadius:18,padding:16,border:"1px solid #ece4d4"}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>🎯 توزيع التقييم العام</h3>{[5,4,3,2,1].map(sv=>{ const idx=sv-1; const max=Math.max(1,...d.dist); const w=d.dist[idx]/max*100; return(<div key={sv} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}><span style={{width:50,fontSize:12}}>{sv} نجوم</span><div style={{flex:1,height:10,background:"#f0e9db",borderRadius:8}}><div style={{width:w+"%",height:"100%",background:TEAL,borderRadius:8}}/></div><b>{d.dist[idx]}</b></div>);})}</div>
                </div>
                <div style={{background:"#fffdf9",borderRadius:18,padding:16,border:"1px solid #ece4d4",marginTop:12}}><h3 style={{margin:"0 0 10px",fontWeight:800}}>📈 أداء المحاور</h3>{d.axes.map((a:any,i:number)=><div key={i} style={{background:"#fff",border:"1px solid #f0e9db",borderRadius:12,padding:10,marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700}}>{a.label}</span><b>{a.value.toFixed(2)}/5</b></div><div style={{height:8,background:"#f0e9db",borderRadius:8,marginTop:6}}><div style={{width:a.value/5*100+"%",height:"100%",background:TEAL,borderRadius:8}}/></div></div>)}</div>
              </>); })()}
            </div>
          )}

          {tab==="overview" && (
            <div className="g2">
              <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div>اليومي</div><div style={{fontSize:32,fontWeight:900}}>{daily.avg.toFixed(2)}/5</div><div>{daily.count} تقييم</div></div>
              <div style={{background:"#fffdf9",borderRadius:18,padding:16,textAlign:"center",border:"1px solid #ece4d4"}}><div>النهائي</div><div style={{fontSize:32,fontWeight:900}}>{final.avg.toFixed(2)}/5</div><div>{final.count} تقييم</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
