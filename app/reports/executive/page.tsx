// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

/* ============ Helpers ============ */
function safeRating(v){const n=Number(v);return Number.isFinite(n)&&n>=1&&n<=5?n:null;}
function mean(xs){return xs?.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
function median(xs){if(!xs?.length)return 0;const a=[...xs].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function variance(xs){if(!xs||xs.length<2)return 0;const m=mean(xs);return xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1);}
function stdDev(xs){return Math.sqrt(variance(xs));}
function normTxt(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ");}
function dateKey(d){const x=new Date(d);if(isNaN(x.getTime()))return "";return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;}

const TARGET=4.2;

function filterRowsBy(baseRows,classrooms,fixedKind,f){
  const fromD=f?.from?new Date(f.from):null;
  const toD=f?.to?new Date(f.to):null;
  if(toD)toD.setHours(23,59,59,999);
  const tRooms=f?.trainerId&&f.trainerId!=="ALL"?new Set((classrooms||[]).filter(c=>c.trainer_id===f.trainerId).map(c=>c.id)):null;
  return (baseRows||[]).filter(r=>{
    if(!r)return false;
    if(fixedKind&&r.kind!==fixedKind)return false;
    if(f?.classroomId&&f.classroomId!=="ALL"){if(r.classroom_id!==f.classroomId)return false;}
    else if(tRooms&&!tRooms.has(r.classroom_id))return false;
    if((fromD||toD)&&r.submitted_at){const d=new Date(r.submitted_at);if(fromD&&d<fromD)return false;if(toD&&d>toD)return false;}
    return true;
  });
}

function collapseDuplicateAnswers(answers,questions){
  const qMap=new Map((questions||[]).map(q=>[q.id,q]));
  const buckets=new Map();
  for(const a of answers||[]){
    const v=safeRating(a?.rating_value);
    if(v===null)continue;
    const q=qMap.get(a.question_id);
    const key=`${a.evaluation_id}__${normTxt(q?.section_ar)}__${normTxt(q?.text_ar||q?.text_en||a.question_id)}`;
    const b=buckets.get(key)||{evaluation_id:a.evaluation_id,question_id:a.question_id,question:q,values:[]};
    b.values.push(v);buckets.set(key,b);
  }
  return Array.from(buckets.values()).map(b=>({evaluation_id:b.evaluation_id,question_id:b.question_id,question:b.question,rating_value:mean(b.values)}));
}
function answersFor(ca,ids){return (ca||[]).filter(a=>ids.has(a.evaluation_id));}

function buildStats(values,respondents=0){
  const xs=(values||[]).filter(v=>safeRating(v)!==null);
  const dist=[0,0,0,0,0];
  xs.forEach(v=>{const r=Math.round(v);if(r>=1&&r<=5)dist[r-1]+=1;});
  const low=xs.filter(v=>v<=2).length,mid=xs.filter(v=>v>2&&v<4).length,high=xs.filter(v=>v>=4).length;
  return{measurements:xs.length,respondents,mean:mean(xs),median:median(xs),variance:variance(xs),stddev:stdDev(xs),
    lowPct:xs.length?(low/xs.length)*100:0,neutralPct:xs.length?(mid/xs.length)*100:0,highPct:xs.length?(high/xs.length)*100:0,
    lowCount:low,neutralCount:mid,highCount:high,dist};
}
function perfLevel(m,lang){
  if(m>=4.2)return{label:lang==="ar"?"ممتاز":"Excellent",bg:"#d1fae5",fg:"#047857"};
  if(m>=3.7)return{label:lang==="ar"?"جيد":"Good",bg:"#ccfbf1",fg:"#0f766e"};
  if(m>=3.0)return{label:lang==="ar"?"مراقبة":"Watch",bg:"#fef3c7",fg:"#b45309"};
  return{label:lang==="ar"?"خطر":"At risk",bg:"#fee2e2",fg:"#b91c1c"};
}
function riskLevel(s,lang){
  const n=s?.respondents||0,m=s?.mean||0,sd=s?.stddev||0,low=s?.lowPct||0;
  if(n<5)return{key:"NA",score:0,label:lang==="ar"?"بيانات غير كافية":"Insufficient",bg:"#f1f5f9",fg:"#64748b"};
  if(m<3||low>=20||sd>=1.2)return{key:"HIGH",score:3,label:lang==="ar"?"منطقة قلق":"High risk",bg:"#fee2e2",fg:"#b91c1c"};
  if(m<3.7||low>=10||sd>=1)return{key:"MED",score:2,label:lang==="ar"?"تحتاج مراقبة":"Watch",bg:"#fef3c7",fg:"#b45309"};
  return{key:"LOW",score:1,label:lang==="ar"?"مطمئن":"Good",bg:"#d1fae5",fg:"#047857"};
}
function summaryFrom(ca,lang){
  const xs=(ca||[]).map(a=>safeRating(a.rating_value)).filter(v=>v!==null);
  const resp=new Set((ca||[]).map(a=>a.evaluation_id)).size;
  const s=buildStats(xs,resp);
  return{...s,risk:riskLevel(s,lang),perf:perfLevel(s.mean,lang)};
}
function verdictOf(summary,lang){
  const m=summary.mean,n=summary.respondents;
  if(n<5)return{tone:"gray",title:lang==="ar"?"بيانات غير كافية للحكم":"Insufficient data",text:lang==="ar"?"حجم العينة الحالي لا يسمح بإصدار حكم موثوق. يُوصى بزيادة عدد الاستجابات قبل اتخاذ قرارات.":"Sample too small for a reliable verdict."};
  if(m>=4.2)return{tone:"green",title:lang==="ar"?"أداء ممتاز يفوق المعيار الدولي":"Excellent — above benchmark",text:lang==="ar"?`المؤشر العام ${m.toFixed(2)}/5 يتجاوز الهدف المرجعي (${TARGET}). الأداء مطمئن، ويُوصى بتوثيق الممارسات الناجحة وتعميمها.`:`Overall index ${m.toFixed(2)}/5 exceeds the ${TARGET} benchmark.`};
  if(m>=3.7)return{tone:"teal",title:lang==="ar"?"أداء جيد مع فرص للارتقاء":"Good with headroom",text:lang==="ar"?`المؤشر العام ${m.toFixed(2)}/5 جيد، والفجوة إلى الامتياز ${(TARGET-m).toFixed(2)} درجة. التركيز على المحاور الأدنى سيرفع المؤشر سريعًا.`:`Index ${m.toFixed(2)}/5; gap to excellence is ${(TARGET-m).toFixed(2)}.`};
  if(m>=3.0)return{tone:"amber",title:lang==="ar"?"أداء مقبول يحتاج خطة تحسين":"Acceptable — improvement plan needed",text:lang==="ar"?`المؤشر العام ${m.toFixed(2)}/5 دون الهدف المرجعي بفجوة ${(TARGET-m).toFixed(2)} درجة. تُوجد محاور تستدعي تدخلًا منظمًا خلال أسبوعين.`:`Index ${m.toFixed(2)}/5; ${(TARGET-m).toFixed(2)} below target.`};
  return{tone:"red",title:lang==="ar"?"مستوى خطر — يتطلب تدخلًا عاجلًا":"At risk — urgent action required",text:lang==="ar"?`المؤشر العام ${m.toFixed(2)}/5 منخفض بوضوح عن المعيار الدولي. يُوصى بخطة معالجة فورية للمحاور الحمراء ومراجعة أسبوعية.`:`Index ${m.toFixed(2)}/5 is well below benchmark; immediate remediation advised.`};
}

/* ============ Axes & Recommendations ============ */
function axisCategory(ar="",en=""){
  const s=`${ar} ${en}`.toLowerCase();
  if(s.includes("مدرب")||s.includes("معلم")||s.includes("teacher")||s.includes("trainer"))return"trainer";
  if(s.includes("تعليم")||s.includes("تعلم")||s.includes("مادة")||s.includes("محتوى")||s.includes("درس")||s.includes("حصة")||s.includes("learning")||s.includes("content"))return"education";
  if(s.includes("قاعة")||s.includes("تجهيز")||s.includes("facility")||s.includes("room"))return"facility";
  if(s.includes("وصول")||s.includes("استقبال")||s.includes("airport")||s.includes("arrival")||s.includes("reception"))return"arrival";
  if(s.includes("ضيافة")||s.includes("خدمات")||s.includes("hospitality")||s.includes("service"))return"hospitality";
  if(s.includes("نقل")||s.includes("انتقال")||s.includes("مواصلات")||s.includes("transport"))return"transport";
  if(s.includes("سكن")||s.includes("housing")||s.includes("accommodation"))return"housing";
  if(s.includes("جولات")||s.includes("زيارة")||s.includes("tour")||s.includes("visit"))return"tours";
  if(s.includes("عمرة")||s.includes("umrah"))return"umrah";
  if(s.includes("إدارة")||s.includes("برنامج")||s.includes("استجابة")||s.includes("admin")||s.includes("management"))return"administration";
  if(s.includes("رضا")||s.includes("satisfaction"))return"satisfaction";
  return"general";
}
const RECS={
  trainer:{ar:"رفع التفاعل داخل القاعة، استخدام أمثلة تطبيقية، تخصيص وقت للأسئلة، وتلخيص أهم النقاط نهاية الحصة.",en:"Increase engagement, practical examples, Q&A time, end-of-session summary.",owner:{ar:"شؤون المدربين",en:"Faculty Affairs"},days:14},
  education:{ar:"مراجعة وضوح المحتوى وملاءمته للمستوى، إضافة أنشطة تطبيقية قصيرة، وربط المحتوى بمخرجات التعلم.",en:"Review content clarity/level fit, add short activities, align with outcomes.",owner:{ar:"التطوير الأكاديمي",en:"Academic Development"},days:21},
  facility:{ar:"فحص الصوت والعرض والإنترنت قبل الجلسة، وتفعيل قناة سريعة للإبلاغ عن الأعطال.",en:"Pre-check AV/internet; fast issue-reporting channel.",owner:{ar:"الخدمات المساندة",en:"Support Services"},days:7},
  arrival:{ar:"تأكيد ترتيبات الوصول قبل 24 ساعة، تعليمات موحدة، مسؤول ميداني، ورقم دعم فوري.",en:"Confirm arrivals 24h ahead, unified instructions, field coordinator, live support.",owner:{ar:"إدارة البرنامج",en:"Program Office"},days:7},
  hospitality:{ar:"توحيد معايير الضيافة، تقليل الانتظار، ومتابعة الجودة بقياس يومي.",en:"Standardize hospitality, reduce waiting, daily quality monitoring.",owner:{ar:"الخدمات",en:"Services"},days:14},
  transport:{ar:"تثبيت جدول النقل، توضيح نقاط التجمع، تنبيهات قبل الرحلات، ودعم عند التأخر.",en:"Stable transport schedule, clear meeting points, reminders, delay support.",owner:{ar:"العمليات",en:"Operations"},days:7},
  housing:{ar:"فحص دوري للنظافة والراحة، قناة بلاغات، وقياس سرعة الاستجابة.",en:"Regular cleanliness checks, reporting channel, response-time tracking.",owner:{ar:"السكن",en:"Housing"},days:14},
  tours:{ar:"تحسين تنظيم الجولات وضبط الوقت، وقياس رضا كل نشاط بشكل مستقل.",en:"Improve tour organization/timing; measure satisfaction per activity.",owner:{ar:"إدارة البرنامج",en:"Program Office"},days:21},
  umrah:{ar:"توضيح خطة العمرة والخدمات، رفع الإرشاد الميداني، ودعم فوري للمشاركين.",en:"Clarify Umrah plan/services, field guidance, immediate support.",owner:{ar:"إدارة البرنامج",en:"Program Office"},days:14},
  administration:{ar:"تحسين وضوح التعليمات، توحيد التواصل، مسؤول خدمة واضح، ومتابعة الملاحظات حتى الإغلاق.",en:"Clarify instructions, unify communication, assign owner, track to closure.",owner:{ar:"إدارة البرنامج",en:"Program Office"},days:14},
  satisfaction:{ar:"تحليل مسببات الرضا عبر المحاور الأخرى ومعالجة الأعلى أثرًا أولًا.",en:"Analyze drivers across axes; act on highest impact first.",owner:{ar:"الجودة",en:"Quality"},days:14},
  general:{ar:"تنفيذ تحسينات سريعة ثم إعادة القياس خلال أسبوعين.",en:"Apply quick fixes; re-measure within two weeks.",owner:{ar:"الجودة",en:"Quality"},days:14}
};
function recFor(ar,en,riskKey,lang){
  const c=axisCategory(ar,en);
  if(riskKey==="NA")return{text:lang==="ar"?"العينة صغيرة؛ يفضّل زيادة الاستجابات قبل اتخاذ قرار.":"Small sample; collect more first.",owner:RECS[c].owner[lang],days:0};
  if(riskKey==="LOW")return{text:lang==="ar"?"نقطة قوة: المحافظة على الممارسة وتوثيقها كنموذج.":"Strength: maintain and document.",owner:RECS[c].owner[lang],days:0};
  return{text:RECS[c]?.[lang]||RECS.general[lang],owner:RECS[c].owner[lang],days:RECS[c].days};
}
function buildAxisStats(ca,lang){
  const groups=new Map();
  for(const a of ca||[]){
    const v=safeRating(a.rating_value);
    if(v===null)continue;
    const q=a.question||{};
    const ar=q.section_ar||"عام",en=q.section_en||ar||"General";
    const key=`${ar}__${en}`;
    const g=groups.get(key)||{ar,en,values:[],resp:new Set()};
    g.values.push(v);g.resp.add(a.evaluation_id);groups.set(key,g);
  }
  const out=[];
  for(const g of groups.values()){
    const s=buildStats(g.values,g.resp.size);
    const risk=riskLevel(s,lang);
    const rec=recFor(g.ar,g.en,risk.key,lang);
    out.push({axisAr:g.ar,axisEn:g.en,axisLabel:lang==="ar"?g.ar:g.en,cat:axisCategory(g.ar,g.en),...s,risk,perf:perfLevel(s.mean,lang),gap:TARGET-s.mean,recommendation:rec.text,owner:rec.owner,days:rec.days});
  }
  return out.sort((a,b)=>b.risk.score-a.risk.score||b.lowPct-a.lowPct||a.mean-b.mean);
}
function buildTrend(rows,lang){
  const valid=(rows||[]).filter(r=>r?.submitted_at&&safeRating(r?.overall_rating)!==null)
    .map(r=>({...r,d:new Date(r.submitted_at)})).filter(r=>!isNaN(r.d.getTime()));
  if(!valid.length)return[];
  const latest=new Date(Math.max(...valid.map(r=>r.d.getTime())));
  latest.setHours(0,0,0,0);
  const map=new Map();
  for(let i=6;i>=0;i--){const day=new Date(latest);day.setDate(latest.getDate()-i);map.set(dateKey(day),{date:day,values:[]});}
  valid.forEach(r=>{const b=map.get(dateKey(r.d));if(b)b.values.push(Number(r.overall_rating));});
  const loc=lang==="ar"?"ar-SA":"en-US";
  return Array.from(map.values()).map(x=>({label:new Intl.DateTimeFormat(loc,{weekday:"short",day:"numeric"}).format(x.date),count:x.values.length,avg:x.values.length?mean(x.values):null}));
}
function buildRoomRanking(ca,rows,classrooms,trainers){
  const evalRoom=new Map((rows||[]).map(r=>[r.id,r.classroom_id]));
  const evalVals=new Map();
  for(const a of ca||[]){const v=safeRating(a.rating_value);if(v===null)continue;const arr=evalVals.get(a.evaluation_id)||[];arr.push(v);evalVals.set(a.evaluation_id,arr);}
  const agg=new Map();
  for(const[eid,vals]of evalVals.entries()){const rid=evalRoom.get(eid);if(!rid)continue;const cur=agg.get(rid)||{sum:0,cnt:0};cur.sum+=mean(vals);cur.cnt+=1;agg.set(rid,cur);}
  const out=[];
  for(const c of classrooms||[]){const st=agg.get(c.id);if(!st?.cnt)continue;const tr=(trainers||[]).find(t=>t.id===c.trainer_id);out.push({id:c.id,code:c.code||"—",trainer:tr?.name||"—",avg:st.sum/st.cnt,count:st.cnt});}
  return out.sort((a,b)=>b.avg-a.avg);
}
function buildTrainerRanking(ca,rows,classrooms,trainers){
  const evalRoom=new Map((rows||[]).map(r=>[r.id,r.classroom_id]));
  const roomTrainer=new Map((classrooms||[]).map(c=>[c.id,c.trainer_id]));
  const agg=new Map();
  for(const a of ca||[]){
    const v=safeRating(a.rating_value);if(v===null)continue;
    const q=a.question||{};
    const cat=axisCategory(q.section_ar||"",q.section_en||"");
    if(cat!=="trainer"&&cat!=="education")continue;
    const rid=evalRoom.get(a.evaluation_id);const tid=roomTrainer.get(rid);
    if(!tid)continue;
    const cur=agg.get(tid)||{sum:0,cnt:0,evals:new Set()};
    cur.sum+=v;cur.cnt+=1;cur.evals.add(a.evaluation_id);agg.set(tid,cur);
  }
  const out=[];
  for(const[tid,st]of agg.entries()){
    const tr=(trainers||[]).find(t=>t.id===tid);
    out.push({id:tid,name:tr?.name||"—",avg:st.sum/st.cnt,measurements:st.cnt,respondents:st.evals.size});
  }
  return out.sort((a,b)=>b.avg-a.avg);
}
function buildHeatMap(ca,rows,classrooms,lang){
  const evalRoom=new Map((rows||[]).map(r=>[r.id,r.classroom_id]));
  const groups=new Map();const used=new Set();
  for(const a of ca||[]){
    const v=safeRating(a.rating_value);const rid=evalRoom.get(a.evaluation_id);
    if(v===null||!rid)continue;
    const q=a.question||{};const ar=q.section_ar||"عام",en=q.section_en||ar||"General";
    const key=`${ar}__${en}`;
    const g=groups.get(key)||{ar,en,rooms:new Map()};
    const arr=g.rooms.get(rid)||[];arr.push(v);g.rooms.set(rid,arr);
    groups.set(key,g);used.add(rid);
  }
  const rooms=(classrooms||[]).filter(c=>used.has(c.id)).sort((a,b)=>String(a.code).localeCompare(String(b.code))).slice(0,8);
  const axes=Array.from(groups.values()).map(g=>{
    const all=[];g.rooms.forEach(vs=>all.push(...vs));
    return{axisLabel:lang==="ar"?g.ar:g.en,overall:mean(all),cells:rooms.map(r=>{const vs=g.rooms.get(r.id)||[];return{roomId:r.id,avg:vs.length?mean(vs):null,count:vs.length};})};
  }).sort((a,b)=>a.overall-b.overall).slice(0,10);
  return{rooms,axes};
}
function heatColor(avg,count){
  if(!count||avg===null)return{bg:"#f8fafc",fg:"#94a3b8"};
  if(avg<3)return{bg:"#fee2e2",fg:"#b91c1c"};
  if(avg<3.7)return{bg:"#fef3c7",fg:"#b45309"};
  if(avg<4.2)return{bg:"#dcfce7",fg:"#15803d"};
  return{bg:"#bbf7d0",fg:"#166534"};
}

/* ============ Identity ============ */
const TEAL="#0d9488",TEAL_DARK="#0f766e",BLUE="#2563eb",NAVY="#173a5e",GOLD="#c19a3d",RED="#dc2626",ORANGE="#d97706";

/* ============ Components ============ */
function MetricCard({title,value,sub,color=BLUE,icon="📊",badge}){
  return(
    <div className="mcard" style={{borderBottomColor:color}}>
      <div className="mtop"><span>{icon}</span><span>{title}</span>{badge&&<span className="mbadge" style={{background:badge.bg,color:badge.fg}}>{badge.label}</span>}</div>
      <div className="mval">{value}</div>
      {sub&&<div className="msub">{sub}</div>}
    </div>
  );
}
function DistributionChart({stats,lang}){
  const isAr=lang==="ar";const total=stats?.measurements||0;
  const items=[
    {label:isAr?"منخفض 1–2":"Low 1–2",value:stats?.lowCount||0,pct:stats?.lowPct||0,color:"#ef4444"},
    {label:isAr?"محايد 3":"Neutral 3",value:stats?.neutralCount||0,pct:stats?.neutralPct||0,color:"#f59e0b"},
    {label:isAr?"مرتفع 4–5":"High 4–5",value:stats?.highCount||0,pct:stats?.highPct||0,color:"#10b981"}
  ];
  if(!total)return<div className="empty">{isAr?"لا توجد استجابات.":"No responses."}</div>;
  return(
    <div>
      <div className="dbar">{items.map(it=>(<div key={it.label} style={{width:`${it.pct}%`,background:it.color,minWidth:it.pct>0?4:0}} title={`${it.label}: ${it.pct.toFixed(1)}%`}/>))}</div>
      <div className="dlist">{items.map(it=>(
        <div className="ditem" key={it.label}>
          <span style={{width:12,height:12,borderRadius:999,background:it.color,display:"inline-block"}}/>
          <span>{it.label}</span>
          <b style={{marginInlineStart:"auto",direction:"ltr"}}>{it.value} ({it.pct.toFixed(0)}%)</b>
        </div>))}
      </div>
    </div>
  );
}
function TrendChart({data,lang,color=BLUE}){
  const isAr=lang==="ar";
  if(!data?.some(d=>d.count>0))return<div className="empty">{isAr?"لا توجد بيانات كافية للاتجاه.":"Not enough trend data."}</div>;
  const W=680,H=260,PX=42,PT=24,PB=42,cw=W-PX*2,ch=H-PT-PB;
  const pts=data.map((d,i)=>({...d,x:PX+(i*cw)/Math.max(data.length-1,1),y:d.avg===null?null:PT+(1-d.avg/5)*ch})).filter(p=>p.y!==null);
  const path=pts.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ");
  const ty=PT+(1-TARGET/5)*ch;
  return(
    <div style={{width:"100%",overflowX:"auto"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",minWidth:560,height:"auto"}}>
        {[1,2,3,4,5].map(v=>{const y=PT+(1-v/5)*ch;return(<g key={v}><line x1={PX} x2={W-PX} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4"/><text x="12" y={y+4} fill="#64748b" fontSize="12">{v}</text></g>);})}
        <line x1={PX} x2={W-PX} y1={ty} y2={ty} stroke={GOLD} strokeWidth="2.5" strokeDasharray="8 5"/>
        <text x={W-PX+2} y={ty+4} fill={GOLD} fontSize="11" fontWeight="900">{isAr?`الهدف ${TARGET}`:`Target ${TARGET}`}</text>
        <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="#fff" stroke={color} strokeWidth="4"/>
            <text x={p.x} y={p.y-14} textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="800">{p.avg.toFixed(2)}</text>
            <text x={p.x} y={H-16} textAnchor="middle" fill="#64748b" fontSize="11">{p.label}</text>
            <text x={p.x} y={H-2} textAnchor="middle" fill="#94a3b8" fontSize="10">N={p.count}</text>
          </g>))}
      </svg>
    </div>
  );
}
function ScorecardTable({title,items,lang}){
  const isAr=lang==="ar";
  if(!items?.length)return(<div className="card"><h3 className="ctitle">{title}</h3><div className="empty">{isAr?"لا توجد بيانات للمحاور.":"No axis data."}</div></div>);
  return(
    <div className="card">
      <h3 className="ctitle">{title}</h3>
      <p className="cdesc">{isAr?`بطاقة أداء المحاور مقابل الهدف المرجعي ${TARGET}/5 — مرتبة من الأعلى فجوة.`:`Axis scorecard vs ${TARGET}/5 benchmark — sorted by largest gap.`}</p>
      <div className="twrap">
        <table className="tbl">
          <thead><tr>
            <th className="th">{isAr?"المحور":"Axis"}</th><th className="th">N</th>
            <th className="th">{isAr?"النتيجة":"Score"}</th><th className="th">{isAr?"الوسيط":"Median"}</th>
            <th className="th">{isAr?"الانحراف":"SD"}</th>
            <th className="th">{isAr?"الهدف":"Target"}</th>
            <th className="th">{isAr?"الفجوة":"Gap"}</th>
            <th className="th">{isAr?"منخفض":"Low"}</th>
            <th className="th">{isAr?"التصنيف":"Rating"}</th>
            <th className="th">{isAr?"الإجراء الموصى به":"Recommended action"}</th>
          </tr></thead>
          <tbody>
            {items.map((x,i)=>{
              const gapCls=x.gap>0.5?"gapbad":x.gap>0?"gapmid":"gapok";
              return(
              <tr key={i}>
                <td className="td" style={{fontWeight:900,minWidth:140}}>{x.axisLabel}</td>
                <td className="td ltr">{x.respondents}</td>
                <td className="td ltr" style={{fontWeight:900}}>{x.mean.toFixed(2)}</td>
                <td className="td ltr">{x.median.toFixed(2)}</td>
                <td className="td ltr">{x.stddev.toFixed(2)}</td>
                <td className="td ltr" style={{color:"#94a3b8"}}>{TARGET.toFixed(1)}</td>
                <td className={`td ltr ${gapCls}`}>{x.gap>0?"-":""}{Math.abs(x.gap).toFixed(2)}{x.gap<=0?" ✓":""}</td>
                <td className="td ltr">{x.lowPct.toFixed(0)}%</td>
                <td className="td"><span className="rbadge" style={{background:x.perf.bg,color:x.perf.fg}}>{x.perf.label}</span></td>
                <td className="td" style={{minWidth:280,color:"#475569",lineHeight:1.7}}>{x.recommendation}</td>
              </tr>);})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function PriorityActions({items,lang}){
  const isAr=lang==="ar";
  const acts=(items||[]).filter(x=>x.risk.key==="HIGH"||x.risk.key==="MED").slice(0,5);
  return(
    <div className="card">
      <h3 className="ctitle">{isAr?"🎯 التوصيات التنفيذية ذات الأولوية":"🎯 Prioritized Executive Actions"}</h3>
      {acts.length?acts.map((x,i)=>{
        const pr=x.risk.key==="HIGH"?{label:isAr?"أولوية عالية":"High priority",cls:"pr-high"}:{label:isAr?"أولوية متوسطة":"Medium priority",cls:"pr-med"};
        return(
        <div className="paction" key={i}>
          <div className={`pnum ${x.risk.key==="HIGH"?"ph":"pm"}`}>{i+1}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
              <b style={{fontSize:15}}>{x.axisLabel}</b>
              <span className={`prbadge ${pr.cls}`}>{pr.label}</span>
              <span className="ltr" style={{color:"#64748b",fontSize:12,fontWeight:800}}>{x.mean.toFixed(2)}/5</span>
            </div>
            <div style={{color:"#475569",fontSize:13,lineHeight:1.8}}>{x.recommendation}</div>
            <div className="pmeta">
              <span>👤 {isAr?"المسؤول: ":"Owner: "}{x.owner}</span>
              <span>⏱️ {isAr?"الإطار الزمني: ":"Timeframe: "}{x.days} {isAr?"يوم":"days"}</span>
              <span>🎯 {isAr?"مؤشر النجاح: الوصول إلى ":"Success: reach "}{TARGET}+</span>
            </div>
          </div>
        </div>);})
      :<div className="empty">{isAr?"لا توجد إجراءات مطلوبة — الأداء ضمن النطاق المطمئن.":"No actions required — performance is within the safe zone."}</div>}
    </div>
  );
}
function StrengthsGaps({items,lang}){
  const isAr=lang==="ar";
  const sorted=[...(items||[])].sort((a,b)=>b.mean-a.mean);
  const strengths=sorted.filter(x=>x.mean>=3.7).slice(0,3);
  const gaps=[...(items||[])].sort((a,b)=>a.mean-b.mean).filter(x=>x.mean<3.7).slice(0,3);
  return(
    <div className="igrid" style={{marginBottom:20}}>
      <div className="ibox success">
        <h4>{isAr?"💪 أبرز نقاط القوة":"💪 Top Strengths"}</h4>
        {strengths.length?strengths.map((x,i)=>(
          <div className="irow" key={i}>
            <b>{x.axisLabel}</b>
            <span className="ltr">{x.mean.toFixed(2)}/5 — {isAr?"رضا مرتفع":"high"} {x.highPct.toFixed(0)}%</span>
          </div>)):<p>{isAr?"لا توجد بيانات كافية.":"Insufficient data."}</p>}
      </div>
      <div className="ibox danger">
        <h4>{isAr?"⚠️ أبرز فجوات الأداء":"⚠️ Top Performance Gaps"}</h4>
        {gaps.length?gaps.map((x,i)=>(
          <div className="irow" key={i}>
            <b>{x.axisLabel}</b>
            <span className="ltr">{x.mean.toFixed(2)}/5 — {isAr?"فجوة":"gap"} -{Math.max(0,x.gap).toFixed(2)}</span>
          </div>)):<p>{isAr?"لا توجد فجوات جوهرية.":"No material gaps."}</p>}
      </div>
    </div>
  );
}
function ComparisonBars({title,data,avgLine,lang}){
  const isAr=lang==="ar";
  if(!data?.length)return(<div className="card"><h3 className="ctitle">{title}</h3><div className="empty">{isAr?"لا توجد بيانات.":"No data."}</div></div>);
  return(
    <div className="card">
      <h3 className="ctitle">{title}</h3>
      <p className="cdesc">{isAr?`مقارنة بالمتوسط المؤسسي ${avgLine.toFixed(2)} والهدف ${TARGET}`:`Compared to institutional average ${avgLine.toFixed(2)} and target ${TARGET}`}</p>
      {data.map((r)=>{
        const diff=r.avg-avgLine;
        const col=r.avg>=TARGET?TEAL:r.avg>=3.7?"#0ea5e9":r.avg>=3?ORANGE:RED;
        return(
        <div key={r.id} style={{marginBottom:13}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:14,fontWeight:800,gap:8}}>
            <span>{r.label} <span style={{color:"#94a3b8",fontWeight:700}}>({r.sub})</span></span>
            <span style={{direction:"ltr",fontWeight:900}}>
              <span style={{color:col}}>{r.avg.toFixed(2)}</span>
              <span style={{color:diff>=0?"#047857":"#b91c1c",fontSize:12,marginInlineStart:8}}>{diff>=0?"▲":"▼"} {Math.abs(diff).toFixed(2)}</span>
            </span>
          </div>
          <div className="cmptrack">
            <div className="cmpfill" style={{width:`${(r.avg/5)*100}%`,background:col}}/>
            <div className="cmpline" style={{insetInlineStart:`${(avgLine/5)*100}%`}}/>
            <div className="cmpline gold" style={{insetInlineStart:`${(TARGET/5)*100}%`}}/>
          </div>
          <small style={{color:"#94a3b8",fontWeight:700}}>{isAr?`استبانات: ${r.count}`:`Forms: ${r.count}`}</small>
        </div>);})}
      <div className="legend">
        <span><i style={{background:"#64748b"}}/> {isAr?"المتوسط المؤسسي":"Institutional avg"}</span>
        <span><i style={{background:GOLD}}/> {isAr?"الهدف":"Target"} {TARGET}</span>
      </div>
    </div>
  );
}
function HeatMap({data,lang}){
  const isAr=lang==="ar";
  if(!data?.axes?.length||!data?.rooms?.length)
    return(<div className="card"><h3 className="ctitle">{isAr?"🗺️ الخريطة الحرارية (محاور × قاعات)":"🗺️ Heat Map"}</h3><div className="empty">{isAr?"لا توجد بيانات كافية.":"Not enough data."}</div></div>);
  return(
    <div className="card">
      <h3 className="ctitle">{isAr?"🗺️ الخريطة الحرارية (محاور × قاعات)":"🗺️ Heat Map (Axes × Rooms)"}</h3>
      <p className="cdesc">{isAr?"الأحمر منخفض، الأصفر متابعة، الأخضر جيد.":"Red low, yellow watch, green good."}</p>
      <div className="twrap">
        <table className="heat">
          <thead><tr><th>{isAr?"المحور":"Axis"}</th>{data.rooms.map(r=>(<th key={r.id}>{isAr?"قاعة":"Room"} {r.code}</th>))}</tr></thead>
          <tbody>
            {data.axes.map(ax=>(
              <tr key={ax.axisLabel}>
                <td className="haxis">{ax.axisLabel}</td>
                {ax.cells.map(c=>{const st=heatColor(c.avg,c.count);return(<td key={c.roomId}><span className="hcell" style={{background:st.bg,color:st.fg}}>{c.count?c.avg.toFixed(2):"—"}</span></td>);})}
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ Main Executive Page ============ */
export default function ExecutiveReportPage(){
  const router=useRouter();
  const[lang,setLang]=useState("ar");
  const[mounted,setMounted]=useState(false);
  const[rows,setRows]=useState([]);
  const[ans,setAns]=useState([]);
  const[qs,setQs]=useState([]);
  const[classrooms,setClassrooms]=useState([]);
  const[trainers,setTrainers]=useState([]);
  const[load,setLoad]=useState(true);
  const[f,setF]=useState({trainerId:"ALL",classroomId:"ALL",from:"",to:""});

  const isAr=lang==="ar";
  const db=supabase();

  useEffect(()=>{
    setMounted(true);
    let on=true;
    (async()=>{
      const s=await db.auth.getSession();
      if(!s.data?.session){router.push("/login");return;}
      const[e,a,q,c,tr]=await Promise.all([
        db.from("evaluations").select("*").order("submitted_at",{ascending:false}),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("classrooms").select("*"),
        db.from("trainers").select("*")
      ]);
      if(on){
        setRows(e.data||[]);setAns(a.data||[]);setQs(q.data||[]);
        setClassrooms(c.data||[]);setTrainers(tr.data||[]);
        setLoad(false);
      }
    })();
    return()=>{on=false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const cleanAnswers=useMemo(()=>collapseDuplicateAnswers(ans,qs),[ans,qs]);

  const fRows=useMemo(()=>filterRowsBy(rows,classrooms,null,f),[rows,classrooms,f]);
  const fIds=useMemo(()=>new Set(fRows.map(r=>r.id)),[fRows]);
  const fAns=useMemo(()=>answersFor(cleanAnswers,fIds),[cleanAnswers,fIds]);
  const summary=useMemo(()=>summaryFrom(fAns,lang),[fAns,lang]);
  const axis=useMemo(()=>buildAxisStats(fAns,lang),[fAns,lang]);
  const trend=useMemo(()=>buildTrend(fRows,lang),[fRows,lang]);
  const roomRank=useMemo(()=>buildRoomRanking(fAns,fRows,classrooms,trainers),[fAns,fRows,classrooms,trainers]);
  const trainerRank=useMemo(()=>buildTrainerRanking(fAns,fRows,classrooms,trainers),[fAns,fRows,classrooms,trainers]);
  const heat=useMemo(()=>buildHeatMap(fAns,fRows,classrooms,lang),[fAns,fRows,classrooms,lang]);
  const highRisk=useMemo(()=>axis.filter(x=>x.risk.key==="HIGH").length,[axis]);
  const verdict=useMemo(()=>verdictOf(summary,lang),[summary,lang]);
  const reportDate=useMemo(()=>new Intl.DateTimeFormat(isAr?"ar-SA":"en-US",{year:"numeric",month:"long",day:"numeric"}).format(new Date()),[isAr]);

  const rooms=f.trainerId!=="ALL"?classrooms.filter(c=>c.trainer_id===f.trainerId):classrooms;
  useEffect(()=>{
    if(f.trainerId==="ALL"||f.classroomId==="ALL")return;
    const ok=classrooms.some(c=>c.id===f.classroomId&&c.trainer_id===f.trainerId);
    if(!ok)setF(o=>({...o,classroomId:"ALL"}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[f.trainerId]);

  if(!mounted||load){
    return(
      <div className="ex" style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"100vh",background:NAVY}}>
        <style dangerouslySetInnerHTML={{__html:CSS}}/>
        <div className="spin"/>
      </div>
    );
  }

  return(
    <div className="ex" style={{direction:isAr?"rtl":"ltr"}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      {/* Header */}
      <header className="hd noprint">
        <div className="hd-in">
          <div className="br">
            <img src="/logos/upm.png" alt="UPM" className="hlogo"/>
            <div className="hdiv"/>
            <img src="/logos/center.png" alt="Center" className="hlogo"/>
            <div>
              <div className="t1">{isAr?"التقرير التنفيذي لجودة البرنامج":"Executive Quality Report"}</div>
              <div className="t2">{isAr?"لوحة القيادة للإدارة العليا · المركز العالمي لتعليم اللغة العربية":"Leadership Dashboard · Global Arabic Language Center"}</div>
            </div>
          </div>
          <div className="ha">
            <button className="gh" onClick={()=>setLang(isAr?"en":"ar")}>🌐 {isAr?"English":"العربية"}</button>
            <button className="gh" onClick={()=>router.push("/reports")}>📑 {isAr?"التقرير التفصيلي":"Detailed"}</button>
            <button className="gh gold" onClick={()=>window.print()}>🖨️ {isAr?"طباعة":"Print"}</button>
          </div>
        </div>
      </header>

      <div className="wrap">
        {/* ترويسة التقرير */}
        <div className="rep-meta">
          <div>
            <div className="rep-title">{isAr?"التقرير التنفيذي لمؤشرات الجودة والتقييم":"Executive Quality & Evaluation Report"}</div>
            <div className="rep-sub">{isAr?"برنامج تعليم اللغة العربية للناطقين بغيرها":"Arabic Language Program for Non-Native Speakers"}</div>
          </div>
          <div className="rep-side">
            <div>{isAr?"تاريخ الإصدار":"Issued"}: <b>{reportDate}</b></div>
            <div>{isAr?"الهدف المرجعي":"Benchmark"}: <b className="ltr">{TARGET}/5</b></div>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="card noprint" style={{padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center",gap:10}}>
            <b style={{color:"#0f172a"}}>{isAr?"الفلاتر":"Filters"}</b>
            <span className="badge" style={{background:"#eef2ff",color:"#3730a3",direction:"ltr"}}>{isAr?"عدد الاستبانات":"Forms"}: {fRows.length}</span>
          </div>
          <div className="fgrid">
            <select className="sel" value={f.trainerId} onChange={e=>setF(o=>({...o,trainerId:e.target.value,classroomId:"ALL"}))}>
              <option value="ALL">{isAr?"كل المدربين":"All trainers"}</option>
              {trainers.map(tr=>(<option key={tr.id} value={tr.id}>{tr.name}</option>))}
            </select>
            <select className="sel" value={f.classroomId} onChange={e=>setF(o=>({...o,classroomId:e.target.value}))} disabled={f.trainerId!=="ALL"&&rooms.length===0}>
              <option value="ALL">{isAr?"كل القاعات":"All rooms"}</option>
              {rooms.map(c=>(<option key={c.id} value={c.id}>{c.code}</option>))}
            </select>
            <input className="inp" type="date" value={f.from} onChange={e=>setF(o=>({...o,from:e.target.value}))}/>
            <input className="inp" type="date" value={f.to} onChange={e=>setF(o=>({...o,to:e.target.value}))}/>
            <button className="sel" onClick={()=>setF({trainerId:"ALL",classroomId:"ALL",from:"",to:""})}>{isAr?"إعادة تعيين":"Reset"}</button>
          </div>
        </div>

        {/* الحكم التنفيذي */}
        <div className={`verdict ${verdict.tone}`}>
          <div className="vicon">{verdict.tone==="green"?"🟢":verdict.tone==="teal"?"🔵":verdict.tone==="amber"?"🟠":verdict.tone==="red"?"🔴":"⚪"}</div>
          <div style={{flex:1}}>
            <div className="vtitle">{verdict.title}</div>
            <div className="vtext">{verdict.text}</div>
          </div>
          <div className="vscore">
            <div className="vnum ltr">{summary.mean.toFixed(2)}</div>
            <div className="vof">/5 — {summary.perf.label}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="g4">
          <MetricCard icon="📝" color={BLUE} title={isAr?"حجم العينة":"Sample"} value={fRows.length} sub={isAr?"استبانة ضمن الفلاتر":"Forms in filters"} badge={fRows.length>=30?{label:isAr?"عينة قوية":"Strong",bg:"#d1fae5",fg:"#047857"}:fRows.length>=10?{label:isAr?"عينة مقبولة":"Fair",bg:"#fef3c7",fg:"#b45309"}:{label:isAr?"عينة صغيرة":"Small",bg:"#fee2e2",fg:"#b91c1c"}}/>
          <MetricCard icon="📊" color={summary.mean>=TARGET?TEAL:ORANGE} title={isAr?"المؤشر العام":"Overall Index"} value={`${summary.mean.toFixed(2)}/5`} sub={isAr?`الوسيط: ${summary.median.toFixed(2)} — الفجوة: ${Math.max(0,TARGET-summary.mean).toFixed(2)}`:`Median: ${summary.median.toFixed(2)} — Gap: ${Math.max(0,TARGET-summary.mean).toFixed(2)}`} badge={{label:summary.perf.label,bg:summary.perf.bg,fg:summary.perf.fg}}/>
          <MetricCard icon="⚠️" color={highRisk?RED:TEAL} title={isAr?"محاور القلق":"Risk Areas"} value={highRisk} sub={isAr?"محاور تتطلب تدخلًا فوريًا":"Axes needing immediate action"}/>
          <MetricCard icon="📉" color={ORANGE} title={isAr?"منخفض 1–2":"Low 1–2"} value={`${summary.lowPct.toFixed(0)}%`} sub={isAr?"نسبة عدم الرضا من إجمالي القياسات":"Dissatisfaction share"}/>
        </div>

        <StrengthsGaps items={axis} lang={lang}/>

        <div className="g2">
          <div className="card"><h3 className="ctitle">{isAr?"📊 توزيع الرضا العام":"📊 Satisfaction Distribution"}</h3><DistributionChart stats={summary} lang={lang}/></div>
          <div className="card"><h3 className="ctitle">{isAr?"📈 الاتجاه مقابل الهدف — آخر 7 أيام بيانات":"📈 Trend vs Target — Last 7 Data Days"}</h3><TrendChart data={trend} lang={lang} color={BLUE}/></div>
        </div>

        <ScorecardTable title={isAr?"🛡️ بطاقة أداء المحاور (Scorecard)":"🛡️ Axis Scorecard"} items={axis} lang={lang}/>
        <PriorityActions items={axis} lang={lang}/>

        <ComparisonBars
          title={isAr?"🏫 مقارنة القاعات بالمتوسط المؤسسي":"🏫 Rooms vs Institutional Average"}
          data={roomRank.map(r=>({id:r.id,label:(isAr?"قاعة ":"Room ")+r.code,sub:r.trainer,avg:r.avg,count:r.count}))}
          avgLine={summary.mean} lang={lang}/>

        <ComparisonBars
          title={isAr?"👨‍🏫 ترتيب المدربين — محاور التعليم فقط (تقييم عادل)":"👨‍🏫 Trainer Ranking — Education Axes Only (Fair)"}
          data={trainerRank.map(x=>({id:x.id,label:x.name,sub:isAr?"محاور التعليم":"education axes",avg:x.avg,count:x.respondents}))}
          avgLine={summary.mean} lang={lang}/>

        <HeatMap data={heat} lang={lang}/>

        {/* تذييل */}
        <div className="rep-footer">
          <div>
            <b>{isAr?"دليل قراءة التقرير:":"How to read:"}</b>{" "}
            {isAr?`ممتاز ≥${TARGET} | جيد ≥3.7 | مراقبة ≥3.0 | خطر <3.0 — "الفجوة" تقاس من الهدف ${TARGET}. N أقل من 5 = بيانات إرشادية فقط.`:`Excellent ≥${TARGET} | Good ≥3.7 | Watch ≥3.0 | Risk <3.0 — Gap measured from ${TARGET}. N<5 = indicative only.`}
          </div>
          <div className="ltr" style={{whiteSpace:"nowrap"}}>{isAr?"منصة الجودة والتقييم":"Quality Platform"} — {reportDate}</div>
        </div>
      </div>
    </div>
  );
}

/* ============ CSS ============ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;}
body{margin:0;}
.ex{background:#f4f6f8;min-height:100vh;font-family:'Tajawal',sans-serif;color:#0f172a;}
.spin{width:60px;height:60px;border:6px solid rgba(255,255,255,.1);border-top-color:#0d9488;border-radius:50%;animation:sp 1s linear infinite;}
@keyframes sp{to{transform:rotate(360deg);}}
.wrap{max-width:1200px;margin:0 auto;padding:24px;}
.ltr{direction:ltr;unicode-bidi:plaintext;}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;}
.noprint{}

/* Header */
.hd{background:linear-gradient(135deg,#0f2740,#173a5e);color:#fff;position:sticky;top:0;z-index:50;box-shadow:0 10px 30px rgba(15,39,64,.25);}
.hd-in{max-width:1200px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.br{display:flex;align-items:center;gap:12px;}
.hlogo{height:44px;width:auto;object-fit:contain;background:#fff;border-radius:10px;padding:4px 8px;}
.hdiv{width:1px;height:36px;background:rgba(255,255,255,.25);}
.t1{font-size:17px;font-weight:900;}
.t2{font-size:11px;color:#b6c6d8;font-weight:700;margin-top:2px;}
.ha{display:flex;gap:8px;flex-wrap:wrap;}
.gh{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#fff;padding:10px 14px;border-radius:11px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;}
.gh:hover{background:rgba(255,255,255,.2);}
.gh.gold{background:rgba(193,154,61,.25);border-color:rgba(193,154,61,.5);color:#f0d9a8;}

/* Cards & grids */
.card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:24px;margin-bottom:20px;box-shadow:0 8px 28px rgba(15,23,42,.035);}
.ctitle{margin:0 0 10px;font-size:19px;font-weight:900;color:#0f172a;}
.cdesc{color:#64748b;margin:0 0 16px;font-size:13px;font-weight:700;}
.empty{color:#94a3b8;text-align:center;padding:32px 12px;font-weight:800;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:20px;}

/* Filters */
.sel,.inp{width:100%;padding:12px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;font-weight:800;outline:none;font-family:inherit;}
.sel:focus,.inp:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12);}
.fgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}

/* Report meta */
.rep-meta{background:#fff;border:1px solid #e2e8f0;border-inline-start:6px solid #c19a3d;border-radius:18px;padding:18px 22px;margin-bottom:20px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;}
.rep-title{color:#173a5e;font-size:20px;font-weight:900;}
.rep-sub{color:#0d9488;font-size:13px;font-weight:800;margin-top:3px;}
.rep-side{color:#64748b;font-size:13px;font-weight:700;line-height:1.8;text-align:end;}

/* Verdict */
.verdict{border-radius:20px;padding:22px 24px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;border:2px solid;}
.verdict.green{background:#f0fdf4;border-color:#86efac;}
.verdict.teal{background:#f0fdfa;border-color:#5eead4;}
.verdict.amber{background:#fffbeb;border-color:#fcd34d;}
.verdict.red{background:#fef2f2;border-color:#fca5a5;}
.verdict.gray{background:#f8fafc;border-color:#cbd5e1;}
.vicon{font-size:34px;}
.vtitle{font-size:20px;font-weight:900;color:#0f172a;}
.vtext{color:#475569;font-size:14px;font-weight:700;line-height:1.8;margin-top:4px;max-width:720px;}
.vscore{text-align:center;margin-inline-start:auto;}
.vnum{font-size:44px;font-weight:900;color:#0f172a;}
.vof{color:#64748b;font-size:13px;font-weight:800;}

/* Metrics */
.mcard{background:#fff;border:1px solid #e2e8f0;border-bottom:5px solid #2563eb;padding:20px;border-radius:22px;min-height:140px;box-shadow:0 8px 28px rgba(15,23,42,.035);}
.mtop{display:flex;align-items:center;gap:8px;color:#64748b;font-weight:900;font-size:14px;flex-wrap:wrap;}
.mbadge{padding:3px 10px;border-radius:999px;font-size:11px;font-weight:900;margin-inline-start:auto;}
.mval{font-size:32px;font-weight:900;margin-top:12px;direction:ltr;unicode-bidi:plaintext;}
.msub{color:#94a3b8;font-size:12px;margin-top:6px;font-weight:700;}

/* Distribution */
.dbar{height:22px;width:100%;display:flex;overflow:hidden;border-radius:999px;background:#f1f5f9;margin:20px 0;}
.dlist{display:grid;gap:10px;}
.ditem{display:flex;align-items:center;gap:8px;color:#334155;font-size:14px;font-weight:800;}

/* Insights */
.igrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.ibox{padding:18px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;}
.ibox h4{margin:0 0 12px;font-size:16px;font-weight:900;}
.ibox.danger{background:#fff7f7;border-color:#fecaca;}
.ibox.success{background:#f0fdf4;border-color:#bbf7d0;}
.irow{display:grid;gap:4px;padding:10px 0;border-bottom:1px solid rgba(148,163,184,.22);}
.irow:last-child{border-bottom:0;}
.irow span{color:#475569;font-size:13px;font-weight:700;}

/* Tables */
.tbl{width:100%;border-collapse:collapse;}
.th{padding:13px;font-weight:900;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;text-align:start;white-space:nowrap;}
.td{padding:13px;font-size:13px;border-bottom:1px solid #f1f5f9;font-weight:700;vertical-align:top;}
.twrap{width:100%;overflow-x:auto;}
.twrap .tbl{min-width:1000px;}
.rbadge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:900;white-space:nowrap;}
.gapok{color:#047857;font-weight:900;}
.gapmid{color:#b45309;font-weight:900;}
.gapbad{color:#b91c1c;font-weight:900;}

/* Priority actions */
.paction{display:flex;gap:14px;padding:16px;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:12px;background:#fff;}
.pnum{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;flex-shrink:0;color:#fff;}
.pnum.ph{background:#dc2626;}
.pnum.pm{background:#d97706;}
.prbadge{padding:4px 11px;border-radius:999px;font-size:11px;font-weight:900;}
.prbadge.pr-high{background:#fee2e2;color:#b91c1c;}
.prbadge.pr-med{background:#fef3c7;color:#b45309;}
.pmeta{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;color:#64748b;font-size:12px;font-weight:800;}

/* Comparison */
.cmptrack{position:relative;height:10px;background:#f1f5f9;border-radius:999px;margin-bottom:6px;}
.cmpfill{height:100%;border-radius:999px;transition:width .6s ease;}
.cmpline{position:absolute;top:-4px;bottom:-4px;width:3px;background:#64748b;border-radius:2px;}
.cmpline.gold{background:#c19a3d;}
.legend{display:flex;gap:18px;margin-top:12px;color:#64748b;font-size:12px;font-weight:800;flex-wrap:wrap;}
.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:6px;vertical-align:-2px;}

/* Heat */
.heat{width:100%;border-collapse:collapse;min-width:700px;}
.heat th{border-bottom:2px solid #e2e8f0;padding:12px;color:#64748b;text-align:center;font-size:13px;}
.heat td{border-bottom:1px solid #f1f5f9;padding:12px;text-align:center;}
.haxis{text-align:start !important;min-width:170px;color:#0f172a;font-weight:900;}
.hcell{display:inline-flex;min-width:56px;justify-content:center;padding:8px;border-radius:10px;font-size:13px;font-weight:900;direction:ltr;}

/* Footer */
.rep-footer{background:#fff;border:1px solid #e2e8f0;border-top:4px solid #173a5e;border-radius:16px;padding:16px 20px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;color:#475569;font-size:12px;font-weight:700;line-height:1.8;}

@media(max-width:1150px){.g4{grid-template-columns:repeat(2,1fr);}}
@media(max-width:950px){
.g2,.g4,.igrid{grid-template-columns:1fr;}
.fgrid{grid-template-columns:1fr;}
.verdict{flex-direction:column;align-items:flex-start;}
.vscore{margin-inline-start:0;}
.hd{position:static;}
}
@media print{
.noprint,.hd{display:none !important;}
.ex{background:#fff;}
.wrap{padding:0;max-width:100%;}
.card,.verdict,.rep-meta{box-shadow:none !important;break-inside:avoid;}
}
`;
