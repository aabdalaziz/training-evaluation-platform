// @ts-nocheck
// PLATFORM-V11-FULL
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS = `@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.rw,.rw *{font-family:'Cairo',Tahoma,sans-serif;box-sizing:border-box}
.rw{direction:rtl;text-align:right;background:#f2ecdf;min-height:100vh;padding:16px;color:#0b1220}
.lay{display:flex;gap:20px;align-items:flex-start}
.side{width:270px;flex-shrink:0;background:linear-gradient(180deg,#0b1220,#060b13);border-radius:24px;padding:18px;color:#fff;position:sticky;top:16px}
.ton{background:#10b981;color:#fff;border:1px solid #10b981;border-radius:12px;padding:11px 14px;cursor:pointer;font-weight:800;font-size:13.5px;width:100%;display:flex;justify-content:flex-end;gap:8px;margin-bottom:4px}
.tof{background:transparent;color:#94a3b8;border:1px solid transparent;border-radius:12px;padding:11px 14px;cursor:pointer;font-weight:600;font-size:13.5px;width:100%;display:flex;justify-content:flex-end;gap:8px;margin-bottom:4px}
.hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#0b1220,#111827);border-radius:24px;padding:22px;color:#fff;margin-bottom:16px}
.hbg{position:absolute;left:14px;top:0;font-size:74px;font-weight:900;color:rgba(255,255,255,.04);letter-spacing:4px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.cd{background:#fffdf9;border:1px solid #e8decb;border-radius:20px;padding:20px;box-shadow:0 6px 18px rgba(60,40,10,.04);margin-bottom:16px}
.kc{position:relative;overflow:hidden;border-right:4px solid #10b981;background:#fffdf9;border:1px solid #e8decb;border-radius:20px;padding:20px}
.kg{position:absolute;left:8px;top:2px;font-size:54px;font-weight:900;color:rgba(16,185,129,.05)}
.ar{background:#fff;border:1px solid #f0e9db;border-radius:14px;padding:12px;margin-bottom:10px}
.tr{height:9px;background:#f0e9db;border-radius:8px;overflow:hidden}
.td{padding:13px 12px;font-size:13.5px;border-bottom:1px solid #f1f5f9}
.th{padding:12px;text-align:right;font-weight:700;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6}
@media(max-width:900px){.lay{flex-direction:column}.side{width:100%;position:static}.g2,.g3{grid-template-columns:1fr}}`;

const WD = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const p2 = (n) => (n < 10 ? "0" + n : "" + n);
const stOf = (v) => { const x = Number(v)||0; if (x>=4) return {t:"ممتاز",bg:"#d1fae5",fg:"#047857"}; if (x>=3) return {t:"جيد",bg:"#fef3c7",fg:"#b45309"}; return {t:"يحتاج دعم",bg:"#fee2e2",fg:"#b91c1c"}; };

export default function ReportsPage() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState([]);
  const [qs, setQs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [trs, setTrs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const db = supabase();
  const flash = (m) => { setMsg(m); setTimeout(()=>setMsg(""),3500); };

  useEffect(() => {
    setOn(true); let live = true;
    (async () => {
      try {
        const s = await db.auth.getSession();
        if (!s.data?.session) { router.push("/login"); return; }
        const [e,a,q,r,t,l] = await Promise.all([
          db.from("evaluations").select("*").order("submitted_at",{ascending:false}),
          db.from("evaluation_answers").select("*"),
          db.from("questions").select("*"),
          db.from("classrooms").select("*").order("code"),
          db.from("trainers").select("*").order("name"),
          db.from("email_logs").select("*").order("sent_at",{ascending:false}),
        ]);
        if (!live) return;
        setRows(e.data||[]); setAns(a.data||[]); setQs(q.data||[]);
        setRooms(r.data||[]); setTrs(t.data||[]); setLogs(l.data||[]);
      } catch (x) { if (live) setErr(x?.message||"خطأ في التحميل"); }
      finally { if (live) setLoad(false); }
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
    const sm = {}; axes.forEach(a => { if(!a) return; (sm[a.section]=sm[a.section]||{s:0,n:0}); sm[a.section].s+=a.value; sm[a.section].n+=1; });
    const sections = Object.keys(sm).map(k=>({name:k,value:sm[k].s/sm[k].n})).sort((a,b)=>b.value-a.value).slice(0,4);
    const comments = []; (ans||[]).forEach(a => { if(a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length<6) comments.push(a.text_value.trim()); });
    const all = list.map(r => Number(r.overall_rating)).filter(v => !isNaN(v)&&v>0);
    return { count:list.length, avg:avg(all), axes, comments, dist, days, sections };
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
    const cl=[],te=[],dr=[];
    (ans||[]).forEach(a => { if(!a||!eids.has(a.evaluation_id)) return; const v=Number(a.rating_value); if(isNaN(v)) return; const q=(qs||[]).find(x=>x&&x.id===a.question_id); if(!q) return; const tx=q.text_ar||""; if(tx.includes("وضوح")||tx.includes("شرح")) cl.push(v); else if(tx.includes("أسلوب")||tx.includes("تدريس")) te.push(v); else if(tx.includes("دافعيتك")||tx.includes("تفاعلك")) dr.push(v); });
    const ov = ev.map(r=>Number(r.overall_rating)).filter(v=>!isNaN(v)&&v>0);
    return { id:t.id, name:t.name, email:t.email, rooms:my.map(r=>r.code).filter(Boolean).join("، ")||"—", levels:Array.from(new Set(my.map(r=>r.level).filter(Boolean))).join("، ")||"—", count:ev.length, avg:avg(ov), clarity:avg(cl), teach:avg(te), drive:avg(dr) };
  }).filter(Boolean).sort((a,b)=>b.avg-a.avg), [trs,rooms,rows,ans,qs]);
  const best = useMemo(()=>{ const v=(teachers||[]).filter(t=>t&&t.count>0); return v.length?v[0]:(teachers&&teachers[0])||null; },[teachers]);

  const dispatchEmail = async (type, id) => {
    setBusy(true); setErr("");
    try {
      let email="admin@platform.edu.sa", name="الإدارة التنفيذية", subject="📋 التقرير الإداري الشامل لمؤشرات الجودة";
      if (type==="TRAINER") { const t=(trs||[]).find(x=>x.id===id); if(!t||!t.email){ alert("هذا المدرب بلا بريد مسجّل"); setBusy(false); return; } email=t.email; name=t.name; subject="📑 تقرير جودة الأداء الفردي: "+t.name; }
      const { error } = await db.from("email_logs").insert({ recipient_email:email, recipient_name:name, recipient_role:type, subject, status:"sent" });
      if (error) throw error;
      const { data } = await db.from("email_logs").select("*").order("sent_at",{ascending:false});
      setLogs(data||[]);
      flash("📧 تم تسجيل إرسال التقرير إلى: "+email);
    } catch (e) { setErr("تعذّر التسجيل: "+(e?.message||"")); }
    finally { setBusy(false); }
  };

  if (!on || load) return (<div className="rw" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><style dangerouslySetInnerHTML={{__html:CSS}}/><div style={{width:"46px",height:"46px",border:"5px solid #e2e8f0",borderTop:"5px solid #10b981",borderRadius:"50%",animation:"spin 1s linear infinite"}}/><p style={{marginTop:"14px",color:"#64748b",fontWeight:700}}>جارٍ تحميل لوحة الجودة…</p></div>);

  return (<div className="rw"><style dangerouslySetInnerHTML={{__html:CSS}}/>
    <div className="lay">
      <aside className="side">
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px"}}>
          <div style={{width:"40px",height:"40px",borderRadius:"12px",background:"linear-gradient(135deg,#10b981,#0d9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>🏆</div>
          <div><div style={{fontWeight:900,fontSize:"15px"}}>لوحة الجودة</div><div style={{fontSize:"11px",color:"#94a3b8"}}>النظام المركزي</div></div>
        </div>
        <button className={tab==="dashboard"?"ton":"tof"} onClick={()=>setTab("dashboard")}><span>نظرة شاملة</span>🏠</button>
        <button className={tab==="daily"?"ton":"tof"} onClick={()=>setTab("daily")}><span>التقرير اليومي</span>📝</button>
        <button className={tab==="final"?"ton":"tof"} onClick={()=>setTab("final")}><span>التقرير النهائي</span>⭐</button>
        <button className={tab==="teachers"?"ton":"tof"} onClick={()=>setTab("teachers")}><span>المعلمون بالقاعة</span>👨‍🏫</button>
        <button className={tab==="email"?"ton":"tof"} onClick={()=>setTab("email")}><span>الإشعارات والبريد</span>✉️</button>
        <div style={{marginTop:"16px",borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>
          <button onClick={()=>router.push("/admin/management")} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#cbd5e1",cursor:"pointer",padding:"10px",borderRadius:"10px",fontSize:"13px",fontWeight:700}}>🏫 إدارة القاعات</button>
          <button onClick={()=>router.push("/dashboard")} style={{width:"100%",background:"transparent",border:"none",color:"#64748b",cursor:"pointer",textAlign:"right",padding:"8px",fontSize:"13px"}}>← الرئيسية</button>
        </div>
      </aside>

      <div style={{flex:1,minWidth:0}}>
        <div className="hero"><div className="hbg">REPORT</div><div style={{position:"relative"}}>
          <span style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"999px",padding:"4px 12px",fontSize:"11px",fontWeight:700,color:"#e2e8f0",display:"inline-block",marginBottom:"6px"}}>تقرير الأداء والتحليل</span>
          <h1 style={{fontSize:"28px",fontWeight:900,margin:0}}>{tab==="dashboard"?"نظرة شاملة":tab==="teachers"?"ترتيب المعلمين بالقاعة":tab==="email"?"مركز الإشعارات والبريد":tab==="daily"?"التقرير اليومي":"التقرير النهائي"}</h1>
        </div></div>
        {err && <div style={{background:"#fee2e2",color:"#b91c1c",padding:"12px",borderRadius:"12px",marginBottom:"14px",fontWeight:700}}>⚠️ {err}</div>}
        {msg && <div style={{background:"#d1fae5",color:"#047857",padding:"12px",borderRadius:"12px",marginBottom:"14px",fontWeight:700}}>{msg}</div>}

        {tab==="dashboard" && <Dash d={daily} f={final} best={best}/>}
        {tab==="daily" && <Rep r={daily} ac="#2563eb"/>}
        {tab==="final" && <Rep r={final} ac="#10b981"/>}
        {tab==="teachers" && <Teach data={teachers} best={best}/>}
        {tab==="email" && <Mail trs={trs} logs={logs} sel={sel} setSel={setSel} busy={busy} send={dispatchEmail}/>}
      </div>
    </div>
  </div>);
}

function Kpi({l,v,s,g}) { return (<div className="kc"><div className="kg">{g||""}</div><div style={{position:"relative"}}><div style={{fontSize:"13px",color:"#9a8f7d",fontWeight:700,marginBottom:"4px"}}>{l}</div><div style={{fontSize:"36px",fontWeight:900,color:"#0f172a",lineHeight:1}}>{v}{s||""}</div></div></div>); }
function Cd({children,st}) { return (<div className="cd" style={st}>{children}</div>); }

function Dash({d,f,best}) {
  const mx = Math.max(5, Number(d.avg||0), Number(f.avg||0));
  return (<div>
    <div className="g3"><Kpi l="إجمالي الاستجابات" v={Number(d.count||0)+Number(f.count||0)} g={String(Number(d.count||0)+Number(f.count||0))}/><Kpi l="الرضا اليومي" v={d.avg?Number(d.avg).toFixed(2):"—"} s="/5"/><Kpi l="الرضا النهائي" v={f.avg?Number(f.avg).toFixed(2):"—"} s="/5"/></div>
    <div className="g2" style={{marginTop:"16px"}}>
      <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>⚖️ مقارنة الرضا</h3>
        <svg viewBox="0 0 300 170" style={{width:"100%",height:"auto"}}>
          {[0,0.5,1].map((fr,i)=>{const y=20+110*(1-fr);return(<g key={i}><line x1="40" y1={y} x2="280" y2={y} stroke="#ece4d4" strokeDasharray="3,3"/><text x="34" y={y+4} textAnchor="end" fontSize="10" fill="#94a3b8">{(mx*fr).toFixed(1)}</text></g>);})}
          <g><rect x="80" y={130-(Number(d.avg||0)/mx)*110} width="45" height={(Number(d.avg||0)/mx)*110} rx="6" fill="#2563eb"/><text x="102" y={130-(Number(d.avg||0)/mx)*110-7} textAnchor="middle" fontSize="13" fontWeight="900" fill="#111">{d.avg?Number(d.avg).toFixed(2):"—"}</text><text x="102" y="148" textAnchor="middle" fontSize="11" fill="#475569">يومي</text></g>
          <g><rect x="175" y={130-(Number(f.avg||0)/mx)*110} width="45" height={(Number(f.avg||0)/mx)*110} rx="6" fill="#10b981"/><text x="197" y={130-(Number(f.avg||0)/mx)*110-7} textAnchor="middle" fontSize="13" fontWeight="900" fill="#111">{f.avg?Number(f.avg).toFixed(2):"—"}</text><text x="197" y="148" textAnchor="middle" fontSize="11" fill="#475569">نهائي</text></g>
          <line x1="40" y1="130" x2="280" y2="130" stroke="#d6cdba" strokeWidth="1.5"/>
        </svg>
      </Cd>
      {best ? <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",border:"1px solid #10b981",borderRadius:"20px",padding:"22px",color:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}><span style={{fontSize:"42px"}}>🏆</span><div style={{fontSize:"11px",color:"#10b981",fontWeight:800,letterSpacing:"1px"}}>الأكثر تميزاً</div><h2 style={{fontSize:"22px",fontWeight:900,margin:"6px 0 2px"}}>{best.name||"—"}</h2><div style={{color:"#94a3b8",fontSize:"12px"}}>قاعة {best.rooms} · {best.avg?Number(best.avg).toFixed(2):"0.00"}/5</div></div> : <Cd><p style={{color:"#94a3b8",textAlign:"center",padding:"30px"}}>لا تقييمات بعد</p></Cd>}
    </div>
  </div>);
}

function Rep({r,ac}) {
  const pct = r.avg?Math.round(Number(r.avg)/5*100):0;
  const top = r.axes&&r.axes.length?r.axes[r.axes.length-1]:null;
  const low = r.axes&&r.axes.length?r.axes[0]:null;
  const mxD = Math.max(1,...(r.dist||[1]));
  const dc = ["#f43f5e","#fb923c","#facc15","#34d399","#10b981"];
  const dl = r.days&&r.days.length?r.days.length:1;
  const bw = dl>0?360/dl:360;
  const mxDay = Math.max(1,...(r.days||[]).map(d=>d?.count||0));
  return (<div>
    <div className="g3"><Kpi l="الاستجابات" v={r.count} g={String(r.count)}/><Kpi l="متوسط الرضا" v={r.avg?Number(r.avg).toFixed(2):"—"} s="/5"/><Kpi l="نسبة الرضا" v={pct} s="%"/></div>
    <div className="g2" style={{marginTop:"16px"}}>
      <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>🎯 التوزيع بالنجوم</h3>{[5,4,3,2,1].map(s=>{const i=s-1;const dv=r.dist&&r.dist[i]?r.dist[i]:0;const w=mxD>0?(dv/mxD)*100:0;return(<div key={s} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}><span style={{width:"52px",fontSize:"11px",fontWeight:700,color:"#7c6f5a"}}>{s} نجوم</span><div style={{flex:1,height:"11px",background:"#f0e9db",borderRadius:"8px",overflow:"hidden"}}><div style={{width:(isNaN(w)?0:w)+"%",height:"100%",background:dc[i],borderRadius:"8px"}}/></div><b style={{width:"20px",textAlign:"left",fontSize:"12px"}}>{dv}</b></div>);})}</Cd>
      <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>💡 التحليل</h3><div style={{background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:"12px",padding:"12px",marginBottom:"10px"}}><b style={{color:"#047857",fontSize:"13px"}}>نقطة القوة</b><p style={{margin:"4px 0 0",fontSize:"12.5px",color:"#334155"}}>{top?top.label+" ("+Number(top.value).toFixed(2)+"/5)":"—"}</p></div><div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:"12px",padding:"12px"}}><b style={{color:"#b45309",fontSize:"13px"}}>مجال التطوير</b><p style={{margin:"4px 0 0",fontSize:"12.5px",color:"#334155"}}>{low?low.label+" ("+Number(low.value).toFixed(2)+"/5)":"—"}</p></div></Cd>
    </div>
    <div className="g2">
      <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>📊 آخر 7 أيام</h3><svg viewBox="0 0 360 170" style={{width:"100%",height:"auto"}}><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#0d9488"/></linearGradient></defs>{(r.days||[]).map((d,i)=>{const x=i*bw+bw*0.22;const w=bw*0.56;const h=(Number(d.count||0)/mxDay)*110;const y=130-h;return(<g key={i}><text x={x+w/2} y={y-5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{d.count}</text><rect x={x} y={y} width={w} height={Math.max(4,h)} rx="6" fill="url(#cg)"/><text x={x+w/2} y="146" textAnchor="middle" fontSize="9" fill="#64748b">{d.wd}</text><text x={x+w/2} y="160" textAnchor="middle" fontSize="9" fill="#94a3b8">{d.dt}</text></g>);})}</svg></Cd>
      <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>⚖️ المحاور</h3>{(r.sections||[]).length>0?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>{r.sections.map((s,i)=>(<div key={i} style={{background:"#fff",border:"1px solid #ece4d4",borderRadius:"14px",padding:"14px",textAlign:"center"}}><div style={{fontSize:"12px",color:"#9a8f7d",fontWeight:700,marginBottom:"6px"}}>{s.name}</div><div style={{fontSize:"26px",fontWeight:900,color:"#10b981"}}>{Number(s.value||0).toFixed(1)}</div></div>))}</div>:<p style={{color:"#9a8f7d",textAlign:"center",padding:"20px"}}>لا أقسام</p>}</Cd>
    </div>
    <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>📈 المحاور التفصيلية</h3>{(r.axes||[]).length>0?r.axes.map((a,i)=>{if(!a) return null;const s=stOf(a.value);return(<div key={i} className="ar"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}><div style={{display:"flex",alignItems:"center",gap:"8px"}}><span style={{background:"#f0e9db",color:"#7c6f5a",borderRadius:"7px",padding:"2px 9px",fontSize:"11px",fontWeight:700}}>{a.section}</span><span style={{fontSize:"13.5px",fontWeight:700}}>{a.label}</span></div><div style={{display:"flex",alignItems:"center",gap:"8px"}}><span style={{background:s.bg,color:s.fg,borderRadius:"999px",padding:"3px 11px",fontSize:"11px",fontWeight:800}}>{s.t}</span><b style={{minWidth:"50px",textAlign:"left",color:ac,fontSize:"15px"}}>{Number(a.value||0).toFixed(2)}/5</b></div></div><div className="tr"><div style={{height:"100%",borderRadius:"8px",width:(Number(a.value||0)/5*100)+"%",background:"linear-gradient(90deg,"+ac+",#10b981)"}}/></div></div>);}):<p style={{color:"#9a8f7d",textAlign:"center",padding:"20px"}}>لا بيانات</p>}</Cd>
    <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>💬 ملاحظات</h3>{(r.comments||[]).length>0?r.comments.map((c,i)=>(<div key={i} style={{background:"#fff",borderRight:"4px solid "+ac,borderRadius:"12px",padding:"12px",marginBottom:"8px",fontSize:"13px",color:"#475569",lineHeight:1.7}}>{c}</div>)):<p style={{color:"#9a8f7d",textAlign:"center",padding:"20px"}}>لا ملاحظات</p>}</Cd>
  </div>);
}

function Teach({data,best}) {
  return (<div>
    {best && <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",border:"1px solid #10b981",borderRadius:"20px",padding:"20px",color:"#fff",marginBottom:"16px",display:"flex",alignItems:"center",gap:"16px"}}><span style={{fontSize:"38px"}}>🏆</span><div><div style={{fontSize:"11px",color:"#10b981",fontWeight:800}}>الأعلى أداءً</div><h3 style={{margin:"2px 0 0",fontSize:"20px",fontWeight:900}}>{best.name||"—"}</h3><div style={{fontSize:"12px",color:"#94a3b8"}}>قاعة {best.rooms} · {best.avg?Number(best.avg).toFixed(2):"0.00"}/5</div></div></div>}
    <Cd><h3 style={{margin:"0 0 12px",fontSize:"16px",fontWeight:800}}>📋 الترتيب</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#f8fafc"}}><th className="th">#</th><th className="th">المعلم</th><th className="th">القاعة</th><th className="th">المستوى</th><th className="th">عدد</th><th className="th">وضوح</th><th className="th">تدريس</th><th className="th">تفاعل</th><th className="th">متوسط</th><th className="th">الحالة</th></tr></thead><tbody>{(data||[]).map((t,i)=>{if(!t) return null;const s=stOf(t.avg||0);return(<tr key={t.id||i}><td className="td" style={{fontWeight:800,color:i===0?"#10b981":"#475569"}}>{i+1}</td><td className="td" style={{fontWeight:800,color:"#111"}}>{t.name||"—"}</td><td className="td" style={{fontWeight:700}}>{t.rooms||"—"}</td><td className="td"><span style={{background:"#e2e8f0",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{t.levels||"—"}</span></td><td className="td">{t.count||0}</td><td className="td" style={{color:"#2563eb",fontWeight:700}}>{t.count?Number(t.clarity||0).toFixed(2):"—"}</td><td className="td" style={{color:"#10b981",fontWeight:700}}>{t.count?Number(t.teach||0).toFixed(2):"—"}</td><td className="td" style={{color:"#b45309",fontWeight:700}}>{t.count?Number(t.drive||0).toFixed(2):"—"}</td><td className="td" style={{fontSize:"15px",fontWeight:900,color:"#0f172a"}}>{t.count?Number(t.avg||0).toFixed(2):"—"}</td><td className="td"><span style={{background:t.count?s.bg:"#f1f5f9",color:t.count?s.fg:"#64748b",borderRadius:"999px",padding:"3px 11px",fontSize:"11px",fontWeight:800}}>{t.count?s.t:"لا تقييم"}</span></td></tr>);})}</tbody></table></div></Cd>
  </div>);
}

function Mail({trs,logs,sel,setSel,busy,send}) {
  return (<div>
    <div className="g2">
      <Cd><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>📨 تقرير القاعة للمدرب</h3><p style={{fontSize:"13px",color:"#64748b",marginBottom:"14px"}}>يُسجَّل الإرسال ويُرسَل تقرير المدرب الفردي على بريده مع نسخة للإدارة.</p><select style={{width:"100%",padding:"11px",borderRadius:"10px",border:"1px solid #cbd5e1",marginBottom:"12px",fontFamily:"inherit"}} value={sel} onChange={e=>setSel(e.target.value)}><option value="">— اختر المدرب —</option>{(trs||[]).map(t=>(<option key={t.id} value={t.id}>{t.name} ({t.email||"بلا بريد"})</option>))}</select><button className="ton" style={{justifyContent:"center",cursor:(busy||!sel)?"not-allowed":"pointer"}} disabled={busy||!sel} onClick={()=>send("TRAINER",sel)}>{busy?"⏳ جارٍ…":"✉️ إرسال للمدرب"}</button></Cd>
      <Cd st={{borderTop:"4px solid #0b1220"}}><h3 style={{margin:"0 0 10px",fontSize:"16px",fontWeight:800}}>🏛️ التقرير العام للإدارة</h3><p style={{fontSize:"13px",color:"#64748b",marginBottom:"30px"}}>تصدير لوحة الجودة الشاملة للإدارة التنفيذية.</p><button className="ton" style={{background:"#0b1220",borderColor:"#0b1220",justifyContent:"center",cursor:busy?"not-allowed":"pointer"}} disabled={busy} onClick={()=>send("ADMIN")}>{busy?"⏳ جارٍ…":"✉️ إرسال للإدارة"}</button></Cd>
    </div>
    <Cd><h3 style={{margin:"0 0 12px",fontSize:"16px",fontWeight:800}}>📋 سجل الإرسال</h3><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#f8fafc"}}><th className="th">المستلم</th><th className="th">البريد</th><th className="th">الدور</th><th className="th">التقرير</th><th className="th">الحالة</th></tr></thead><tbody>{(logs||[]).map((l,i)=>(<tr key={l.id||i}><td className="td" style={{fontWeight:700}}>{l.recipient_name}</td><td className="td" style={{direction:"ltr",textAlign:"right",fontSize:"12px"}}>{l.recipient_email}</td><td className="td"><span style={{background:l.recipient_role==="ADMIN"?"#eff6ff":"#f5f3ff",color:l.recipient_role==="ADMIN"?"#2563eb":"#7c3aed",borderRadius:"6px",padding:"2px 8px",fontSize:"11px",fontWeight:700}}>{l.recipient_role==="ADMIN"?"إدارة":"مدرب"}</span></td><td className="td" style={{fontSize:"12px",color:"#475569"}}>{l.subject}</td><td className="td"><span style={{background:"#d1fae5",color:"#047857",borderRadius:"999px",padding:"3px 11px",fontSize:"11px",fontWeight:800}}>تم</span></td></tr>))}{(logs||[]).length===0&&<tr><td className="td" colSpan={5} style={{textAlign:"center",color:"#94a3b8",padding:"24px"}}>لا رسائل بعد</td></tr>}</tbody></table></div></Cd>
  </div>);
}
