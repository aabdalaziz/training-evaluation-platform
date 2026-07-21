// CLEAN-V11
"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase/client";

const WD = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const p2 = (n) => (n < 10 ? "0" + n : "" + n);
const stOf = (v) => { const x = Number(v)||0; if (x>=4) return {t:"ممتاز",bg:"#d1fae5",fg:"#047857"}; if (x>=3) return {t:"جيد",bg:"#fef3c7",fg:"#b45309"}; return {t:"يحتاج دعم",bg:"#fee2e2",fg:"#b91c1c"}; };

export default function ReportsPage() {
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState([]);
  const [qs, setQs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [trs, setTrs] = useState([]);
  const [load, setLoad] = useState(true);
  const [tab, setTab] = useState("daily");

  useEffect(() => {
    setReady(true);
    let live = true;
    (async () => {
      try {
        const db = supabase();
        const [e, a, q, r, t] = await Promise.all([
          db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
          db.from("evaluation_answers").select("*"),
          db.from("questions").select("*"),
          db.from("classrooms").select("*").order("code"),
          db.from("trainers").select("*").order("name"),
        ]);
        if (!live) return;
        setRows(e.data || []); setAns(a.data || []); setQs(q.data || []);
        setRooms(r.data || []); setTrs(t.data || []);
      } catch (x) {} finally { if (live) setLoad(false); }
    })();
    return () => { live = false; };
  }, []);

  const calc = (kind) => {
    const list = (rows||[]).filter(r => r && r.kind === kind);
    const ids = new Set(list.map(r => r.id));
    const qm = {}; (qs||[]).forEach(q => { if (q) qm[q.id] = q; });
    const avg = (a) => a.length ? a.reduce((p,c)=>p+c,0)/a.length : 0;
    const g = {};
    (ans||[]).forEach(a => { if (a && ids.has(a.evaluation_id) && a.rating_value!=null) { const v=Number(a.rating_value); if(!isNaN(v)) (g[a.question_id]=g[a.question_id]||[]).push(v); } });
    const axes = Object.keys(g).map(id => ({ label: qm[id]?qm[id].text_ar:"سؤال", section: qm[id]?.section_ar||"عام", value: avg(g[id]) })).sort((a,b)=>a.value-b.value);
    const dist = [0,0,0,0,0];
    list.forEach(r => { const v=Math.round(Number(r.overall_rating)); if (v>=1&&v<=5) dist[v-1]+=1; });
    const dm = {};
    for (let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); dm[k]={wd:WD[d.getDay()],dt:p2(d.getMonth()+1)+"-"+p2(d.getDate()),count:0}; }
    list.forEach(r => { if(!r?.submitted_at) return; const d=new Date(r.submitted_at); if(isNaN(d.getTime())) return; const k=d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); if(dm[k]) dm[k].count+=1; });
    const days = Object.keys(dm).map(k=>dm[k]);
    const all = list.map(r => Number(r.overall_rating)).filter(v => !isNaN(v)&&v>0);
    return { count:list.length, avg:avg(all), axes, dist, days };
  };
  const daily = useMemo(()=>calc("DAILY"),[rows,ans,qs]);
  const final = useMemo(()=>calc("FINAL"),[rows,ans,qs]);

  const teachers = useMemo(() => (trs||[]).map(t => {
    if (!t?.id) return null;
    const my = (rooms||[]).filter(c => c && c.trainer_id===t.id);
    const rids = new Set(my.map(c=>c.id).filter(Boolean));
    const ev = (rows||[]).filter(r => r && r.classroom_id && rids.has(r.classroom_id));
    const eids = new Set(ev.map(e=>e.id));
    const avg = (a)=>a.length?a.reduce((p,c)=>p+c,0)/a.length:0;
    const ov = ev.map(r=>Number(r.overall_rating)).filter(v=>!isNaN(v)&&v>0);
    return { id:t.id, name:t.name, rooms:my.map(r=>r.code).filter(Boolean).join("، ")||"—", levels:Array.from(new Set(my.map(r=>r.level).filter(Boolean))).join("، ")||"—", count:ev.length, avg:avg(ov) };
  }).filter(Boolean).sort((a,b)=>b.avg-a.avg), [trs,rooms,rows]);

  if (!ready || load) return (<div style={S.wrap}><p style={{color:"#94a3b8",textAlign:"center",paddingTop:80}}>جارٍ التحميل…</p></div>);

  const cur = tab==="final" ? final : daily;
  const ac = tab==="final" ? "#10b981" : "#2563eb";

  return (
    <div style={S.wrap}>
      <div style={S.lay}>
        <aside style={S.side}>
          <div style={{fontWeight:900,fontSize:15,marginBottom:14}}>🏆 منصة التقييم</div>
          <button style={tab==="daily"?S.on:S.off} onClick={()=>setTab("daily")}>📝 التقرير اليومي</button>
          <button style={tab==="final"?S.on:S.off} onClick={()=>setTab("final")}>⭐ التقرير النهائي</button>
          <button style={tab==="teachers"?S.on:S.off} onClick={()=>setTab("teachers")}>👨‍🏫 المعلمون بالقاعة</button>
          <a href="/dashboard" style={{display:"block",marginTop:14,color:"#64748b",fontSize:12,textAlign:"center",textDecoration:"none"}}>← الرئيسية</a>
        </aside>

        <main style={{flex:1,minWidth:0}}>
          <div style={S.hero}><div style={S.heroBg}>REPORT</div><h1 style={{fontSize:26,fontWeight:900,margin:0,position:"relative"}}>{tab==="teachers"?"ترتيب المعلمين بالقاعة":tab==="final"?"التقرير النهائي":"التقرير اليومي"}</h1></div>

          {tab!=="teachers" && (
            <>
              <div style={S.g3}>
                <div style={S.kc}><div style={S.kl}>الاستجابات</div><div style={S.kv}>{cur.count}</div></div>
                <div style={S.kc}><div style={S.kl}>المتوسط</div><div style={S.kv}>{cur.avg?cur.avg.toFixed(2):"—"}<span style={{fontSize:15,color:"#9a8f7d"}}>/5</span></div></div>
                <div style={S.kc}><div style={S.kl}>نسبة الرضا</div><div style={S.kv}>{cur.avg?Math.round(cur.avg/5*100):0}%</div></div>
              </div>
              <div style={S.cd}><h3 style={S.h3}>🎯 توزيع التقييم</h3>{[5,4,3,2,1].map(s=>{const i=s-1;const mx=Math.max(1,...cur.dist);const w=cur.dist[i]/mx*100;const col=["#f43f5e","#fb923c","#facc15","#34d399","#10b981"][i];return(<div key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><span style={{width:52,fontSize:11,fontWeight:700,color:"#7c6f5a"}}>{s} نجوم</span><div style={{flex:1,height:11,background:"#f0e9db",borderRadius:8,overflow:"hidden"}}><div style={{width:(isNaN(w)?0:w)+"%",height:"100%",background:col,borderRadius:8}}/></div><b style={{width:20,textAlign:"left",fontSize:12}}>{cur.dist[i]}</b></div>);})}</div>
              <div style={S.cd}><h3 style={S.h3}>📊 آخر 7 أيام</h3><div style={{display:"flex",alignItems:"flex-end",gap:14,height:150,paddingTop:20}}>{cur.days.map((d,i)=>{const mx=Math.max(1,...cur.days.map(x=>x.count));const h=(d.count/mx)*110;return(<div key={i} style={{flex:1,textAlign:"center"}}><div style={{fontSize:11,fontWeight:800,marginBottom:4}}>{d.count}</div><div style={{height:Math.max(4,h),background:"linear-gradient(180deg,#34d399,#0d9488)",borderRadius:"6px 6px 0 0"}}/><div style={{fontSize:9,color:"#64748b",marginTop:4}}>{d.wd}</div></div>);})}</div></div>
              <div style={S.cd}><h3 style={S.h3}>📈 المحاور</h3>{cur.axes.length?cur.axes.map((a,i)=>{const s=stOf(a.value);return(<div key={i} style={S.ar}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:6}}><span style={{fontSize:13,fontWeight:700}}>{a.label}</span><span style={{background:s.bg,color:s.fg,borderRadius:999,padding:"3px 11px",fontSize:11,fontWeight:800}}>{a.value.toFixed(2)}/5 · {s.t}</span></div><div style={{height:9,background:"#f0e9db",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",borderRadius:8,width:(a.value/5*100)+"%",background:"linear-gradient(90deg,"+ac+",#10b981)"}}/></div></div>);}):<p style={{color:"#9a8f7d",textAlign:"center",padding:20}}>لا بيانات</p>}</div>
            </>
          )}

          {tab==="teachers" && (
            <div style={S.cd}><h3 style={S.h3}>📋 ترتيب المعلمين</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#f8fafc"}}><th style={S.th}>#</th><th style={S.th}>المعلم</th><th style={S.th}>القاعة</th><th style={S.th}>المستوى</th><th style={S.th}>عدد</th><th style={S.th}>متوسط</th><th style={S.th}>الحالة</th></tr></thead><tbody>{(teachers||[]).map((t,i)=>{const s=stOf(t.avg||0);return(<tr key={t.id}><td style={S.td}><b style={{color:i===0?"#10b981":"#475569"}}>{i+1}</b></td><td style={S.td}><b>{t.name}</b></td><td style={S.td}><span style={{background:"#e2e8f0",borderRadius:6,padding:"2px 9px",fontSize:12,fontWeight:700}}>{t.rooms}</span></td><td style={S.td}>{t.levels}</td><td style={S.td}>{t.count}</td><td style={S.td}><b style={{color:"#0f172a"}}>{t.count?t.avg.toFixed(2):"—"}</b></td><td style={S.td}><span style={{background:t.count?s.bg:"#f1f5f9",color:t.count?s.fg:"#64748b",borderRadius:999,padding:"3px 11px",fontSize:11,fontWeight:800}}>{t.count?s.t:"لا تقييم"}</span></td></tr>);})}</tbody></table></div></div>
          )}
        </main>
      </div>
    </div>
  );
}

const S = {
  wrap: { direction:"rtl", fontFamily:"Cairo, Tahoma, sans-serif", background:"#f2ecdf", minHeight:"100vh", padding:"16px", color:"#0b1220" },
  lay: { display:"flex", gap:"20px", alignItems:"flex-start", flexWrap:"wrap" },
  side: { width:"240px", flexShrink:0, background:"linear-gradient(180deg,#0b1220,#060b13)", borderRadius:"22px", padding:"16px", color:"#fff" },
  on: { display:"block", width:"100%", background:"#10b981", color:"#fff", border:"none", borderRadius:"12px", padding:"11px", marginBottom:"6px", cursor:"pointer", fontWeight:800, fontSize:"13.5px", textAlign:"right", fontFamily:"inherit" },
  off: { display:"block", width:"100%", background:"transparent", color:"#94a3b8", border:"none", borderRadius:"12px", padding:"11px", marginBottom:"6px", cursor:"pointer", fontWeight:600, fontSize:"13.5px", textAlign:"right", fontFamily:"inherit" },
  hero: { position:"relative", overflow:"hidden", background:"linear-gradient(135deg,#0b1220,#111827)", borderRadius:"22px", padding:"22px", color:"#fff", marginBottom:"16px" },
  heroBg: { position:"absolute", left:"14px", top:0, fontSize:"70px", fontWeight:900, color:"rgba(255,255,255,.04)", letterSpacing:"4px" },
  g3: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"14px", marginBottom:"16px" },
  kc: { background:"#fffdf9", border:"1px solid #e8decb", borderRight:"4px solid #10b981", borderRadius:"18px", padding:"18px", textAlign:"center" },
  kl: { fontSize:"12px", color:"#9a8f7d", fontWeight:700, marginBottom:"4px" },
  kv: { fontSize:"32px", fontWeight:900, color:"#0f172a", lineHeight:1 },
  cd: { background:"#fffdf9", border:"1px solid #e8decb", borderRadius:"18px", padding:"18px", marginBottom:"16px" },
  h3: { margin:"0 0 12px", fontSize:"16px", fontWeight:800 },
  ar: { background:"#fff", border:"1px solid #f0e9db", borderRadius:"12px", padding:"12px", marginBottom:"10px" },
  th: { padding:"12px", textAlign:"right", fontWeight:700, fontSize:"13px", color:"#64748b", borderBottom:"2px solid #eef2f6" },
  td: { padding:"13px 12px", fontSize:"13.5px", borderBottom:"1px solid #f1f5f9" },
};
