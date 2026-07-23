// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

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
function verdictOf(summary,lang,ctx){
  const m=summary.mean,n=summary.respondents;
  const c=ctx||(lang==="ar"?"المؤشر العام":"Overall index");
  if(n<5)return{tone:"gray",title:lang==="ar"?"بيانات غير كافية للحكم":"Insufficient data",text:lang==="ar"?"حجم العينة الحالي لا يسمح بإصدار حكم موثوق. يُوصى بزيادة عدد الاستجابات قبل اتخاذ قرارات.":"Sample too small for a reliable verdict."};
  if(m>=4.2)return{tone:"green",title:lang==="ar"?"أداء ممتاز يفوق المعيار الدولي":"Excellent — above benchmark",text:lang==="ar"?`${c} ${m.toFixed(2)}/5 يتجاوز الهدف المرجعي (${TARGET}). الأداء مطمئن، ويُوصى بتوثيق الممارسات الناجحة وتعميمها.`:`${c} ${m.toFixed(2)}/5 exceeds the ${TARGET} benchmark.`};
  if(m>=3.7)return{tone:"teal",title:lang==="ar"?"أداء جيد مع فرص للارتقاء":"Good with headroom",text:lang==="ar"?`${c} ${m.toFixed(2)}/5 جيد، والفجوة إلى الامتياز ${(TARGET-m).toFixed(2)} درجة. التركيز على المحاور الأدنى سيرفع المؤشر سريعًا.`:`${c} ${m.toFixed(2)}/5; gap to excellence is ${(TARGET-m).toFixed(2)}.`};
  if(m>=3.0)return{tone:"amber",title:lang==="ar"?"أداء مقبول يحتاج خطة تحسين":"Acceptable — improvement plan needed",text:lang==="ar"?`${c} ${m.toFixed(2)}/5 دون الهدف المرجعي بفجوة ${(TARGET-m).toFixed(2)} درجة. تُوجد محاور تستدعي تدخلًا منظمًا خلال أسبوعين.`:`${c} ${m.toFixed(2)}/5; ${(TARGET-m).toFixed(2)} below target.`};
  return{tone:"red",title:lang==="ar"?"مستوى خطر — يتطلب تدخلًا عاجلًا":"At risk — urgent action required",text:lang==="ar"?`${c} ${m.toFixed(2)}/5 منخفض بوضوح عن المعيار الدولي. يُوصى بخطة معالجة فورية للمحاور الحمراء ومراجعة أسبوعية.`:`${c} ${m.toFixed(2)}/5 is well below benchmark; immediate remediation advised.`};
}

/* ============ القراءة التحليلية التلقائية ============ */
function buildNarrative({summary,axis,trend,lang,kind}){
  const isAr=lang==="ar";
  const n=summary.respondents;
  if(n<1)return null;
  const m=summary.mean,med=summary.median;
  const hp=summary.highPct,np=summary.neutralPct,lp=summary.lowPct;
  const kindAr=kind==="daily"?"التقييم اليومي للحصص التدريبية":kind==="final"?"التقييم الختامي للبرنامج":"تقييم البرنامج";
  const kindEn=kind==="daily"?"the daily sessions evaluation":kind==="final"?"the final program evaluation":"the program evaluation";
  const v=perfLevel(m,lang);

  const edu=axis.filter(x=>x.cat==="education"||x.cat==="trainer").sort((a,b)=>b.mean-a.mean);
  const topEdu=edu[0];
  let praise="";
  if(topEdu){
    const pc=Math.round(topEdu.highPct*topEdu.measurements/100);
    praise=isAr
      ?`وفي صلب التجربة التعليمية، أشاد ${pc} مشاركًا (${topEdu.highPct.toFixed(0)}%) بـ"${topEdu.axisLabel}" مسجلًا ${topEdu.mean.toFixed(2)}/5، وهو ما يعكس ثقة المتدربين بالكفاءة التدريسية.`
      :`On the teaching side, ${pc} participants (${topEdu.highPct.toFixed(0)}%) praised "${topEdu.axisLabel}" at ${topEdu.mean.toFixed(2)}/5, reflecting strong trainee confidence in instructional quality.`;
  }

  const strengths=axis.filter(x=>x.mean>=3.7).sort((a,b)=>b.mean-a.mean).slice(0,2);
  const concerns=axis.filter(x=>x.mean<3.7).sort((a,b)=>a.mean-b.mean).slice(0,1);
  const names=strengths.map(x=>`"${x.axisLabel}" (${x.mean.toFixed(2)}/5)`).join(isAr?" و":" and ");
  const strengthTxt=names?(isAr?`تصدّر ${names} قائمة نقاط القوة.`:`Leading strengths were ${names}.`):"";
  const c=concerns[0];
  const concernTxt=c
    ?(isAr?`في المقابل، سجّل "${c.axisLabel}" أدنى المستويات بمتوسط ${c.mean.toFixed(2)}/5 ونسبة تقييمات منخفضة بلغت ${c.lowPct.toFixed(0)}%${c.stddev>=1?` مع انحراف معياري مرتفع (${c.stddev.toFixed(2)}) يدل على تفاوت التجربة بين المشاركين`:""}، مما يستدعي تدخلًا منظمًا وفق التوصيات الواردة أدناه.`
      :`Conversely, "${c.axisLabel}" scored lowest at ${c.mean.toFixed(2)}/5 with ${c.lowPct.toFixed(0)}% low ratings${c.stddev>=1?` and a high SD (${c.stddev.toFixed(2)}) indicating inconsistent experience`:""}, requiring structured intervention per the recommendations below.`)
    :(isAr?"ولم تسجّل أي محاور مستويات مقلقة تستدعي تدخلًا عاجلًا.":"No axis recorded concerning levels requiring urgent intervention.");

  const tAvgs=(trend||[]).filter(t=>t.avg!==null).map(t=>t.avg);
  let trendTxt="";
  if(tAvgs.length>=2){
    const d=tAvgs[tAvgs.length-1]-tAvgs[0];
    if(Math.abs(d)<0.15)trendTxt=isAr?"وأظهر الاتجاه الزمني استقرارًا نسبيًا في الأداء خلال آخر 7 أيام بيانات.":"The trend showed relative stability over the last 7 data days.";
    else if(d>0)trendTxt=isAr?`وأظهر الاتجاه الزمني تحسنًا ملحوظًا بمقدار ${d.toFixed(2)} درجة خلال آخر 7 أيام بيانات.`:`The trend improved by ${d.toFixed(2)} over the last 7 data days.`;
    else trendTxt=isAr?`وأظهر الاتجاه الزمني تراجعًا بمقدار ${Math.abs(d).toFixed(2)} درجة يستدعي المتابعة الدقيقة.`:`The trend declined by ${Math.abs(d).toFixed(2)}, requiring close monitoring.`;
  }

  if(isAr){
    return{
      p1:`بلغ عدد الاستبانات المحللة في ${kindAr} ${n} استبانة ضمن الفلاتر المحددة. سجّل المؤشر العام ${m.toFixed(2)} من 5 بوسيط ${med.toFixed(2)}، ليصنّف الأداء ضمن مستوى "${v.label}" قياسًا بالهدف المرجعي (${TARGET}/5). وأبدى ${hp.toFixed(0)}% من المشاركين رضًا مرتفعًا (4–5 نجوم)، فيما توزّعت ${np.toFixed(0)}% عند التقييم المحايد (3 نجوم)، وبقيت نسبة غير الراضين (1–2 نجمة) عند ${lp.toFixed(0)}%.`,
      p2:`${strengthTxt} ${praise} ${concernTxt}`,
      p3:`${trendTxt} وتؤكد هذه القراءة أهمية تعزيز نقاط القوة وتوثيق ممارساتها، بالتوازي مع معالجة الفجوات المرصودة ضمن إطار زمني محدد ومؤشرات نجاح قابلة للقياس.`
    };
  }
  return{
    p1:`A total of ${n} valid forms were analyzed for ${kindEn}. The overall index reached ${m.toFixed(2)}/5 with a median of ${med.toFixed(2)}, classifying performance as "${v.label}" against the ${TARGET}/5 benchmark. ${hp.toFixed(0)}% expressed high satisfaction (4–5 stars), ${np.toFixed(0)}% were neutral (3 stars), and dissatisfaction (1–2 stars) stood at ${lp.toFixed(0)}%.`,
    p2:`${strengthTxt} ${praise} ${concernTxt}`,
    p3:`${trendTxt} This analysis underscores the importance of reinforcing strengths and documenting best practices, while addressing identified gaps within defined timeframes and measurable success indicators.`
  };
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
function maskEmail(e){if(!e||!e.includes("@"))return"—";const[u,d]=e.split("@");return`${u.slice(0,2)}***@${d}`;}
function maskPhone(p){if(!p)return"—";const c=String(p).replace(/\s+/g,"");if(c.length<6)return"***";return c.replace(/(\d{2})\d+(\d{2})/,"$1******$2");}
function downloadCSV(filename,rows){
  const esc=v=>{
    const s=String(v??"");
    if(/^\+?[\d\s\-()]{7,}$/.test(s.trim()))return`="${s.replace(/"/g,'""')}"`;
    return`"${s.replace(/"/g,'""')}"`;
  };
  const csv="\uFEFF"+rows.map(r=>r.map(esc).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

/* ============ Identity & i18n ============ */
const TEAL="#0d9488",TEAL_DARK="#0f766e",BLUE="#2563eb",NAVY="#173a5e",GOLD="#c19a3d",RED="#dc2626",ORANGE="#d97706";

const dict={
  ar:{dir:"rtl",font:"'Tajawal', sans-serif",title:"لوحة ذكاء الأعمال",sub:"النظام المركزي للتحليلات",
    tab1:"الملخص التنفيذي",tab2:"التقرير اليومي",tab3:"التقرير النهائي",tab4:"سجل المشاركين",tab5:"شهادة التميز",
    lang:"English",noData:"لا توجد بيانات ضمن الفلاتر الحالية.",filters:"الفلاتر",allTrainers:"كل المدربين",allRooms:"كل القاعات",
    reset:"إعادة تعيين",search:"بحث (اسم/بريد/جوال)",reveal:"إظهار البيانات",hide:"إخفاء البيانات",export:"تصدير Excel",
    print:"طباعة التقرير",minResponses:"حد أدنى للاستجابات",sample:"عدد الاستبانات",clear:"إفراغ",purge:"حذف الاستجابات",
    executiveHint:"تقرير تنفيذي بمعايير دولية: مؤشرات، فجوات أداء، توصيات بأولويات.",
    dailyHint:"تحليل إحصائي لأداء الحصص والمدربين والتجربة اليومية مقابل الهدف المرجعي.",
    finalHint:"تحليل رضا المشاركين عن التعليم والخدمات وإدارة البرنامج مقابل الهدف المرجعي.",
    participantsHint:"فلترة حسب القاعة + المدرب + الفترة، مع بحث وتصدير."},
  en:{dir:"ltr",font:"'Inter', sans-serif",title:"BI Dashboard",sub:"Central Analytics",
    tab1:"Executive Summary",tab2:"Daily Report",tab3:"Final Report",tab4:"Participants",tab5:"Certificate",
    lang:"العربية",noData:"No data for current filters.",filters:"Filters",allTrainers:"All trainers",allRooms:"All rooms",
    reset:"Reset",search:"Search (name/email/phone)",reveal:"Show data",hide:"Hide data",export:"Export Excel",
    print:"Print Report",minResponses:"Min responses",sample:"Forms",clear:"Clear",purge:"Delete Responses",
    executiveHint:"Executive report to international standards: KPIs, performance gaps, prioritized recommendations.",
    dailyHint:"Statistical analysis of sessions, trainers, and daily experience vs benchmark.",
    finalHint:"Satisfaction analysis for education, services, and program management vs benchmark.",
    participantsHint:"Filter by room + trainer + date range, with search and export."}
};

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
      <p className="cdesc">{isAr?`مقارنة بالمتوسط ${avgLine.toFixed(2)} والهدف ${TARGET}`:`Compared to average ${avgLine.toFixed(2)} and target ${TARGET}`}</p>
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
        <span><i style={{background:"#64748b"}}/> {isAr?"متوسط التقرير":"Report average"}</span>
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

/* بطاقة القراءة التحليلية */
function NarrativeCard({narrative,lang,accent}){
  const isAr=lang==="ar";
  if(!narrative)return null;
  return(
    <div className="card narr" style={{borderInlineStart:`6px solid ${accent}`}}>
      <h3 className="ctitle">{isAr?"📝 القراءة التحليلية للتقرير":"📝 Analytical Reading"}</h3>
      <p className="ntext">{narrative.p1}</p>
      <p className="ntext">{narrative.p2}</p>
      {narrative.p3&&<p className="ntext">{narrative.p3}</p>}
    </div>
  );
}

/* ترويسة تقرير رسمية + حكم تنفيذي */
function ReportHero({title,sub,accent,verdict,score,perfLabel,lang,onPrint}){
  const isAr=lang==="ar";
  return(
    <div>
      <div className="rep-meta" style={{borderInlineStartColor:accent}}>
        <div>
          <div className="rep-title">{title}</div>
          <div className="rep-sub" style={{color:accent}}>{sub}</div>
        </div>
        <div className="rep-side">
          <div>{isAr?"تاريخ الإصدار":"Issued"}: <b>{new Intl.DateTimeFormat(isAr?"ar-SA":"en-US",{year:"numeric",month:"long",day:"numeric"}).format(new Date())}</b></div>
          <div>{isAr?"الهدف المرجعي":"Benchmark"}: <b className="ltr">{TARGET}/5</b></div>
        </div>
      </div>
      <div className={`verdict ${verdict.tone}`}>
        <div className="vicon">{verdict.tone==="green"?"🟢":verdict.tone==="teal"?"🔵":verdict.tone==="amber"?"🟠":verdict.tone==="red"?"🔴":"⚪"}</div>
        <div style={{flex:1}}>
          <div className="vtitle">{verdict.title}</div>
          <div className="vtext">{verdict.text}</div>
        </div>
        <div className="vscore">
          <div className="vnum ltr">{Number(score||0).toFixed(2)}</div>
          <div className="vof">/5 — {perfLabel}</div>
        </div>
        <button className="vprint noprint" onClick={onPrint}>🖨️ {isAr?"طباعة التقرير":"Print"}</button>
      </div>
    </div>
  );
}
function ReportFooter({lang}){
  const isAr=lang==="ar";
  const d=new Intl.DateTimeFormat(isAr?"ar-SA":"en-US",{year:"numeric",month:"long",day:"numeric"}).format(new Date());
  return(
    <div className="rep-footer">
      <div>
        <b>{isAr?"دليل قراءة التقرير:":"How to read:"}</b>{" "}
        {isAr?`ممتاز ≥${TARGET} | جيد ≥3.7 | مراقبة ≥3.0 | خطر <3.0 — "الفجوة" تقاس من الهدف ${TARGET}. N أقل من 5 = بيانات إرشادية فقط.`:`Excellent ≥${TARGET} | Good ≥3.7 | Watch ≥3.0 | Risk <3.0 — Gap measured from ${TARGET}. N<5 = indicative only.`}
      </div>
      <div className="ltr" style={{whiteSpace:"nowrap"}}>{isAr?"منصة الجودة والتقييم":"Quality Platform"} — {d}</div>
    </div>
  );
}

/* ============ Main Page ============ */
export default function ReportsPage(){
  const router=useRouter();
  const[lang,setLang]=useState("ar");
  const[mounted,setMounted]=useState(false);
  const[rows,setRows]=useState([]);
  const[ans,setAns]=useState([]);
  const[qs,setQs]=useState([]);
  const[classrooms,setClassrooms]=useState([]);
  const[trainers,setTrainers]=useState([]);
  const[load,setLoad]=useState(true);
  const[tab,setTab]=useState("dashboard");

  const emptyRange={from:"",to:""};
  const[dashF,setDashF]=useState({trainerId:"ALL",classroomId:"ALL",...emptyRange});
  const[dailyF,setDailyF]=useState({trainerId:"ALL",classroomId:"ALL",...emptyRange});
  const[finalF,setFinalF]=useState({trainerId:"ALL",classroomId:"ALL",...emptyRange});
  const[partF,setPartF]=useState({trainerId:"ALL",classroomId:"ALL",from:"",to:"",q:""});
  const[revealPII,setRevealPII]=useState(false);
  const[certF,setCertF]=useState({trainerId:"ALL",classroomId:"ALL",...emptyRange,min:3});

  const[purgeOpen,setPurgeOpen]=useState(false);
  const[purgeKind,setPurgeKind]=useState("BOTH");
  const[purgeCode,setPurgeCode]=useState("");
  const[purgeBusy,setPurgeBusy]=useState(false);
  const[purgeMsg,setPurgeMsg]=useState("");
  const[codeError,setCodeError]=useState(false);

  const t=dict[lang];const isAr=lang==="ar";
  const db=supabase();

  const fetchAllData=async()=>{
    const[e,a,q,c,tr]=await Promise.all([
      db.from("evaluations").select("*").order("submitted_at",{ascending:false}),
      db.from("evaluation_answers").select("*"),
      db.from("questions").select("*"),
      db.from("classrooms").select("*"),
      db.from("trainers").select("*")
    ]);
    setRows(e.data||[]);setAns(a.data||[]);setQs(q.data||[]);
    setClassrooms(c.data||[]);setTrainers(tr.data||[]);
  };

  useEffect(()=>{
    setMounted(true);
    let on=true;
    (async()=>{
      const s=await db.auth.getSession();
      if(!s.data?.session){router.push("/login");return;}
      if(on){await fetchAllData();setLoad(false);}
    })();
    return()=>{on=false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const executePurge=async()=>{
    if(purgeCode!=="9999"){setCodeError(true);setTimeout(()=>setCodeError(false),500);return;}
    setPurgeBusy(true);setPurgeMsg("");
    try{
      const s=await db.auth.getSession();
      const token=s.data?.session?.access_token;
      if(!token)throw new Error(isAr?"لا توجد جلسة":"No session");
      const res=await fetch("/api/admin/purge-evaluations",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body:JSON.stringify({confirmCode:purgeCode,kind:purgeKind,filters:partF})
      });
      const json=await res.json();
      if(!json.success)throw new Error(json.error||"Failed");
      setPurgeMsg("success:"+(isAr
        ?`تم الحذف النهائي: ${json.deleted.evaluations} استبانة و ${json.deleted.answers} إجابة.`
        :`Deleted: ${json.deleted.evaluations} evaluations, ${json.deleted.answers} answers.`));
      await fetchAllData();
    }catch(e){
      setPurgeMsg("error:"+((isAr?"خطأ: ":"Error: ")+(e.message||"Unknown")));
    }finally{setPurgeBusy(false);}
  };
  const closePurgeModal=()=>{setPurgeOpen(false);setPurgeCode("");setPurgeMsg("");setCodeError(false);};

  const cleanAnswers=useMemo(()=>collapseDuplicateAnswers(ans,qs),[ans,qs]);

  /* ===== Dashboard ===== */
  const dashRows=useMemo(()=>filterRowsBy(rows,classrooms,null,dashF),[rows,classrooms,dashF]);
  const dashIds=useMemo(()=>new Set(dashRows.map(r=>r.id)),[dashRows]);
  const dashAns=useMemo(()=>answersFor(cleanAnswers,dashIds),[cleanAnswers,dashIds]);
  const dashSummary=useMemo(()=>summaryFrom(dashAns,lang),[dashAns,lang]);
  const dashAxis=useMemo(()=>buildAxisStats(dashAns,lang),[dashAns,lang]);
  const dashTrend=useMemo(()=>buildTrend(dashRows,lang),[dashRows,lang]);
  const dashRanking=useMemo(()=>buildRoomRanking(dashAns,dashRows,classrooms,trainers),[dashAns,dashRows,classrooms,trainers]);
  const dashTrainerRank=useMemo(()=>buildTrainerRanking(dashAns,dashRows,classrooms,trainers),[dashAns,dashRows,classrooms,trainers]);
  const dashHeat=useMemo(()=>buildHeatMap(dashAns,dashRows,classrooms,lang),[dashAns,dashRows,classrooms,lang]);
  const dashHighRisk=useMemo(()=>dashAxis.filter(x=>x.risk.key==="HIGH").length,[dashAxis]);
  const dashVerdict=useMemo(()=>verdictOf(dashSummary,lang),[dashSummary,lang]);
  const dashNarr=useMemo(()=>buildNarrative({summary:dashSummary,axis:dashAxis,trend:dashTrend,lang,kind:"dashboard"}),[dashSummary,dashAxis,dashTrend,lang]);

  /* ===== Daily ===== */
  const dailyRows=useMemo(()=>filterRowsBy(rows,classrooms,"DAILY",dailyF),[rows,classrooms,dailyF]);
  const dailyIds=useMemo(()=>new Set(dailyRows.map(r=>r.id)),[dailyRows]);
  const dailyAns=useMemo(()=>answersFor(cleanAnswers,dailyIds),[cleanAnswers,dailyIds]);
  const dailySummary=useMemo(()=>summaryFrom(dailyAns,lang),[dailyAns,lang]);
  const dailyAxis=useMemo(()=>buildAxisStats(dailyAns,lang),[dailyAns,lang]);
  const dailyTrend=useMemo(()=>buildTrend(dailyRows,lang),[dailyRows,lang]);
  const dailyRoomRank=useMemo(()=>buildRoomRanking(dailyAns,dailyRows,classrooms,trainers),[dailyAns,dailyRows,classrooms,trainers]);
  const dailyTrainerRank=useMemo(()=>buildTrainerRanking(dailyAns,dailyRows,classrooms,trainers),[dailyAns,dailyRows,classrooms,trainers]);
  const dailyHeat=useMemo(()=>buildHeatMap(dailyAns,dailyRows,classrooms,lang),[dailyAns,dailyRows,classrooms,lang]);
  const dailyHighRisk=useMemo(()=>dailyAxis.filter(x=>x.risk.key==="HIGH").length,[dailyAxis]);
  const dailyVerdict=useMemo(()=>verdictOf(dailySummary,lang,isAr?"مؤشر الأداء اليومي":"Daily performance index"),[dailySummary,lang,isAr]);
  const dailyNarr=useMemo(()=>buildNarrative({summary:dailySummary,axis:dailyAxis,trend:dailyTrend,lang,kind:"daily"}),[dailySummary,dailyAxis,dailyTrend,lang]);

  /* ===== Final ===== */
  const finalRows=useMemo(()=>filterRowsBy(rows,classrooms,"FINAL",finalF),[rows,classrooms,finalF]);
  const finalIds=useMemo(()=>new Set(finalRows.map(r=>r.id)),[finalRows]);
  const finalAns=useMemo(()=>answersFor(cleanAnswers,finalIds),[cleanAnswers,finalIds]);
  const finalSummary=useMemo(()=>summaryFrom(finalAns,lang),[finalAns,lang]);
  const finalAxis=useMemo(()=>buildAxisStats(finalAns,lang),[finalAns,lang]);
  const finalTrend=useMemo(()=>buildTrend(finalRows,lang),[finalRows,lang]);
  const finalRoomRank=useMemo(()=>buildRoomRanking(finalAns,finalRows,classrooms,trainers),[finalAns,finalRows,classrooms,trainers]);
  const finalTrainerRank=useMemo(()=>buildTrainerRanking(finalAns,finalRows,classrooms,trainers),[finalAns,finalRows,classrooms,trainers]);
  const finalHeat=useMemo(()=>buildHeatMap(finalAns,finalRows,classrooms,lang),[finalAns,finalRows,classrooms,lang]);
  const finalHighRisk=useMemo(()=>finalAxis.filter(x=>x.risk.key==="HIGH").length,[finalAxis]);
  const finalVerdict=useMemo(()=>verdictOf(finalSummary,lang,isAr?"مؤشر الرضا الختامي":"Final satisfaction index"),[finalSummary,lang,isAr]);
  const finalNarr=useMemo(()=>buildNarrative({summary:finalSummary,axis:finalAxis,trend:finalTrend,lang,kind:"final"}),[finalSummary,finalAxis,finalTrend,lang]);

  /* ===== Participants ===== */
  const partRows=useMemo(()=>filterRowsBy(rows,classrooms,null,partF),[rows,classrooms,partF]);
  const partRoomData=useMemo(()=>{
    const byClass=new Map();
    for(const e of partRows){
      if(!e.classroom_id)continue;
      const s={name:e.guest_name||e.profile?.full_name||"—",email:e.guest_email||e.profile?.email||"",phone:e.guest_phone||e.profile?.phone||""};
      const arr=byClass.get(e.classroom_id)||[];arr.push(s);byClass.set(e.classroom_id,arr);
    }
    const out=[];const q=normTxt(partF.q);
    for(const c of classrooms){
      const students=byClass.get(c.id)||[];
      if(!students.length)continue;
      const seen=new Set();const uniq=[];
      for(const s of students){const key=s.email||s.phone||s.name;if(!key||seen.has(key))continue;seen.add(key);uniq.push(s);}
      const filtered=q?uniq.filter(x=>normTxt(x.name).includes(q)||normTxt(x.email).includes(q)||normTxt(x.phone).includes(q)):uniq;
      if(!filtered.length)continue;
      const tr=trainers.find(x=>x.id===c.trainer_id);
      out.push({id:c.id,code:c.code,trainer:tr?.name||"—",students:filtered});
    }
    return out.sort((a,b)=>String(a.code).localeCompare(String(b.code)));
  },[partRows,classrooms,trainers,partF.q]);

  /* ===== Certificate ===== */
  const certRows=useMemo(()=>filterRowsBy(rows,classrooms,null,certF),[rows,classrooms,certF]);
  const certIds=useMemo(()=>new Set(certRows.map(r=>r.id)),[certRows]);
  const certAns=useMemo(()=>answersFor(cleanAnswers,certIds),[cleanAnswers,certIds]);
  const certTrainerRank=useMemo(()=>buildTrainerRanking(certAns,certRows,classrooms,trainers),[certAns,certRows,classrooms,trainers]);
  const certBest=useMemo(()=>{
    const b=certTrainerRank.find(r=>r.respondents>=Number(certF.min||3));
    if(!b)return null;
    return{trainer:b.name,avg:b.avg,count:b.respondents};
  },[certTrainerRank,certF.min]);

  /* ===== FiltersBar ===== */
  const FiltersBar=({value,setValue,count,withQuery=false,withMin=false})=>{
    const rooms=value?.trainerId&&value.trainerId!=="ALL"?classrooms.filter(c=>c.trainer_id===value.trainerId):classrooms;
    useEffect(()=>{
      if(!value||value.trainerId==="ALL"||value.classroomId==="ALL")return;
      const ok=classrooms.some(c=>c.id===value.classroomId&&c.trainer_id===value.trainerId);
      if(!ok)setValue(f=>({...f,classroomId:"ALL"}));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },[value.trainerId]);
    const reset=()=>{
      const base={trainerId:"ALL",classroomId:"ALL",from:"",to:""};
      if(withQuery)base.q="";
      if(withMin)base.min=3;
      setValue(base);
    };
    return(
      <div className="card noprint" style={{padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center",gap:10}}>
          <b style={{color:"#0f172a"}}>{t.filters}</b>
          <span className="badge" style={{background:"#eef2ff",color:"#3730a3",direction:"ltr"}}>{t.sample}: {count??0}</span>
        </div>
        <div className="fgrid">
          <select className="sel" value={value.trainerId} onChange={e=>setValue(f=>({...f,trainerId:e.target.value,classroomId:"ALL"}))}>
            <option value="ALL">{t.allTrainers}</option>
            {trainers.map(tr=>(<option key={tr.id} value={tr.id}>{tr.name}</option>))}
          </select>
          <select className="sel" value={value.classroomId} onChange={e=>setValue(f=>({...f,classroomId:e.target.value}))} disabled={value.trainerId!=="ALL"&&rooms.length===0}>
            <option value="ALL">{t.allRooms}</option>
            {value.trainerId!=="ALL"&&rooms.length===0
              ?(<option value="NONE" disabled>{isAr?"لا توجد قاعات لهذا المدرب":"No rooms for this trainer"}</option>)
              :(rooms.map(c=>(<option key={c.id} value={c.id}>{c.code}</option>)))}
          </select>
          {"from" in value&&(<input className="inp" type="date" value={value.from} onChange={e=>setValue(f=>({...f,from:e.target.value}))}/>)}
          {"to" in value&&(<input className="inp" type="date" value={value.to} onChange={e=>setValue(f=>({...f,to:e.target.value}))}/>)}
          {withQuery&&(<input className="inp" placeholder={t.search} value={value.q} onChange={e=>setValue(f=>({...f,q:e.target.value}))}/>)}
          {withMin&&(<input className="inp" type="number" min={1} placeholder={t.minResponses} value={value.min} onChange={e=>setValue(f=>({...f,min:e.target.value}))}/>)}
          <button className="sel" onClick={reset}>{t.reset}</button>
        </div>
      </div>
    );
  };

  if(!mounted||load){
    return(
      <div className="rw" style={{display:"flex",justifyContent:"center",alignItems:"center",background:NAVY}}>
        <style dangerouslySetInnerHTML={{__html:CSS}}/>
        <div style={{width:60,height:60,border:"6px solid rgba(255,255,255,0.1)",borderTopColor:TEAL,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      </div>
    );
  }

  return(
    <div className="rw" style={{direction:t.dir,fontFamily:t.font}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      <div className="lay">
        {/* Sidebar */}
        <aside className="side noprint">
          <div className="brand-card">
            <div className="brand-logos">
              <img src="/logos/upm.png" alt="جامعة الأمير مقرن" className="brand-logo"/>
              <div className="brand-divider"/>
              <img src="/logos/center.png" alt="المركز العالمي" className="brand-logo"/>
            </div>
            <div className="brand-name">{t.title}</div>
            <div className="brand-tag">{t.sub}</div>
          </div>

          <button className={tab==="dashboard"?"ton":"tof"} onClick={()=>setTab("dashboard")}><span className="nav-label"><span className="nav-ico">📊</span>{t.tab1}</span></button>
          <button className={tab==="daily"?"ton":"tof"} onClick={()=>setTab("daily")}><span className="nav-label"><span className="nav-ico">📅</span>{t.tab2}</span></button>
          <button className={tab==="final"?"ton":"tof"} onClick={()=>setTab("final")}><span className="nav-label"><span className="nav-ico">🏁</span>{t.tab3}</span></button>
          <button className={tab==="participants"?"ton":"tof"} onClick={()=>setTab("participants")}><span className="nav-label"><span className="nav-ico">👥</span>{t.tab4}</span></button>
          <button className={tab==="cert"?"ton":"tof"} onClick={()=>setTab("cert")}><span className="nav-label"><span className="nav-ico">🏆</span>{t.tab5}</span></button>

          <div style={{marginTop:20,borderTop:"1px solid rgba(255,255,255,.12)",paddingTop:16}}>
            <button onClick={()=>setLang(isAr?"en":"ar")} style={{width:"100%",background:"rgba(193,154,61,.18)",border:"1px solid rgba(193,154,61,.45)",color:"#f0d9a8",padding:12,borderRadius:12,fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:8,fontFamily:"inherit"}}>🌐 {t.lang}</button>
            <button onClick={()=>router.push("/admin/management")} style={{width:"100%",background:"transparent",border:"1px solid #33465e",color:"#b6c6d8",cursor:"pointer",padding:12,borderRadius:12,fontSize:14,fontWeight:800,fontFamily:"inherit"}}>⚙️ {isAr?"الإدارة":"Admin"}</button>
          </div>
          <div className="side-copy">{isAr?"جامعة الأمير مقرن بن عبدالعزيز":"University of Prince Mugrin"}</div>
        </aside>

        {/* Main */}
        <div className="main">
          <div className="report-header noprint">
            <img src="/logos/upm.png" alt="UPM"/>
            <div className="report-header-text">
              <b>{isAr?"جامعة الأمير مقرن بن عبدالعزيز":"University of Prince Mugrin"}</b>
              <span>{isAr?"المركز العالمي لتعليم اللغة العربية — منصة الجودة والتقييم":"World Center for Arabic Language — Quality Platform"}</span>
            </div>
            <img src="/logos/center.png" alt="Center"/>
          </div>

          {/* ===== Executive Dashboard ===== */}
          {tab==="dashboard"&&(
            <div>
              <ReportHero
                title={isAr?"التقرير التنفيذي لمؤشرات الجودة والتقييم":"Executive Quality & Evaluation Report"}
                sub={isAr?"برنامج تعليم اللغة العربية للناطقين بغيرها":"Arabic Language Program for Non-Native Speakers"}
                accent={GOLD} verdict={dashVerdict} score={dashSummary.mean} perfLabel={dashSummary.perf.label} lang={lang}
                onPrint={()=>window.print()}/>

              <FiltersBar value={dashF} setValue={setDashF} count={dashRows.length}/>

              <NarrativeCard narrative={dashNarr} lang={lang} accent={GOLD}/>

              <div className="g4">
                <MetricCard icon="📝" color={BLUE} title={isAr?"حجم العينة":"Sample"} value={dashRows.length} sub={isAr?"استبانة ضمن الفلاتر":"Forms in filters"} badge={dashRows.length>=30?{label:isAr?"عينة قوية":"Strong",bg:"#d1fae5",fg:"#047857"}:dashRows.length>=10?{label:isAr?"عينة مقبولة":"Fair",bg:"#fef3c7",fg:"#b45309"}:{label:isAr?"عينة صغيرة":"Small",bg:"#fee2e2",fg:"#b91c1c"}}/>
                <MetricCard icon="📊" color={dashSummary.mean>=TARGET?TEAL:ORANGE} title={isAr?"المؤشر العام":"Overall Index"} value={`${dashSummary.mean.toFixed(2)}/5`} sub={isAr?`الوسيط: ${dashSummary.median.toFixed(2)} — الفجوة: ${Math.max(0,TARGET-dashSummary.mean).toFixed(2)}`:`Median: ${dashSummary.median.toFixed(2)} — Gap: ${Math.max(0,TARGET-dashSummary.mean).toFixed(2)}`} badge={{label:dashSummary.perf.label,bg:dashSummary.perf.bg,fg:dashSummary.perf.fg}}/>
                <MetricCard icon="⚠️" color={dashHighRisk?RED:TEAL} title={isAr?"محاور القلق":"Risk Areas"} value={dashHighRisk} sub={isAr?"محاور تتطلب تدخلًا فوريًا":"Axes needing immediate action"}/>
                <MetricCard icon="📉" color={ORANGE} title={isAr?"منخفض 1–2":"Low 1–2"} value={`${dashSummary.lowPct.toFixed(0)}%`} sub={isAr?"نسبة عدم الرضا":"Dissatisfaction share"}/>
              </div>

              <StrengthsGaps items={dashAxis} lang={lang}/>

              <div className="g2">
                <div className="card"><h3 className="ctitle">{isAr?"📊 توزيع الرضا العام":"📊 Satisfaction Distribution"}</h3><DistributionChart stats={dashSummary} lang={lang}/></div>
                <div className="card"><h3 className="ctitle">{isAr?"📈 الاتجاه مقابل الهدف — آخر 7 أيام بيانات":"📈 Trend vs Target — Last 7 Data Days"}</h3><TrendChart data={dashTrend} lang={lang} color={BLUE}/></div>
              </div>

              <ScorecardTable title={isAr?"🛡️ بطاقة أداء المحاور (Scorecard)":"🛡️ Axis Scorecard"} items={dashAxis} lang={lang}/>
              <PriorityActions items={dashAxis} lang={lang}/>

              <ComparisonBars title={isAr?"🏫 مقارنة القاعات بالمتوسط المؤسسي":"🏫 Rooms vs Institutional Average"} data={dashRanking.map(r=>({id:r.id,label:(isAr?"قاعة ":"Room ")+r.code,sub:r.trainer,avg:r.avg,count:r.count}))} avgLine={dashSummary.mean} lang={lang}/>
              <ComparisonBars title={isAr?"👨‍🏫 ترتيب المدربين — محاور التعليم فقط":"👨‍🏫 Trainer Ranking — Education Axes Only"} data={dashTrainerRank.map(x=>({id:x.id,label:x.name,sub:isAr?"محاور التعليم":"education axes",avg:x.avg,count:x.respondents}))} avgLine={dashSummary.mean} lang={lang}/>

              <HeatMap data={dashHeat} lang={lang}/>
              <ReportFooter lang={lang}/>
            </div>
          )}

          {/* ===== Daily Report ===== */}
          {tab==="daily"&&(
            <div>
              <ReportHero
                title={isAr?"التقرير اليومي لأداء الحصص التدريبية":"Daily Sessions Performance Report"}
                sub={isAr?"تحليل إحصائي يومي مقابل الهدف المرجعي":"Daily statistical analysis vs benchmark"}
                accent={BLUE} verdict={dailyVerdict} score={dailySummary.mean} perfLabel={dailySummary.perf.label} lang={lang}
                onPrint={()=>window.print()}/>

              <FiltersBar value={dailyF} setValue={setDailyF} count={dailyRows.length}/>

              <NarrativeCard narrative={dailyNarr} lang={lang} accent={BLUE}/>

              <div className="g4">
                <MetricCard icon="📝" color={BLUE} title={isAr?"الاستبانات":"Forms"} value={dailySummary.respondents} sub={isAr?"استجابات يومية صالحة":"Valid daily forms"} badge={dailySummary.respondents>=30?{label:isAr?"عينة قوية":"Strong",bg:"#d1fae5",fg:"#047857"}:dailySummary.respondents>=10?{label:isAr?"عينة مقبولة":"Fair",bg:"#fef3c7",fg:"#b45309"}:{label:isAr?"عينة صغيرة":"Small",bg:"#fee2e2",fg:"#b91c1c"}}/>
                <MetricCard icon="📊" color={dailySummary.mean>=TARGET?TEAL:BLUE} title={isAr?"المتوسط":"Mean"} value={`${dailySummary.mean.toFixed(2)}/5`} sub={isAr?`الوسيط: ${dailySummary.median.toFixed(2)} — الفجوة: ${Math.max(0,TARGET-dailySummary.mean).toFixed(2)}`:`Median: ${dailySummary.median.toFixed(2)} — Gap: ${Math.max(0,TARGET-dailySummary.mean).toFixed(2)}`} badge={{label:dailySummary.perf.label,bg:dailySummary.perf.bg,fg:dailySummary.perf.fg}}/>
                <MetricCard icon="↔️" color={ORANGE} title={isAr?"الانحراف المعياري":"Std Dev"} value={dailySummary.stddev.toFixed(2)} sub={isAr?"ارتفاعه = تذبذب التجربة":"Higher = less consistent"}/>
                <MetricCard icon="⚠️" color={dailyHighRisk?RED:TEAL} title={isAr?"محاور القلق":"Risk Areas"} value={dailyHighRisk} sub={isAr?`منخفض 1–2: ${dailySummary.lowPct.toFixed(0)}%`:`Low 1–2: ${dailySummary.lowPct.toFixed(0)}%`}/>
              </div>

              <StrengthsGaps items={dailyAxis} lang={lang}/>

              <div className="g2">
                <div className="card"><h3 className="ctitle">{isAr?"📊 توزيع تقييمات الحصص":"📊 Session Distribution"}</h3><DistributionChart stats={dailySummary} lang={lang}/></div>
                <div className="card"><h3 className="ctitle">{isAr?"📈 الاتجاه اليومي مقابل الهدف":"📈 Daily Trend vs Target"}</h3><TrendChart data={dailyTrend} lang={lang} color={BLUE}/></div>
              </div>

              <ScorecardTable title={isAr?"🛡️ بطاقة أداء المحاور اليومية":"🛡️ Daily Scorecard"} items={dailyAxis} lang={lang}/>
              <PriorityActions items={dailyAxis} lang={lang}/>

              <ComparisonBars title={isAr?"🏫 مقارنة القاعات — الأداء اليومي":"🏫 Rooms Comparison — Daily"} data={dailyRoomRank.map(r=>({id:r.id,label:(isAr?"قاعة ":"Room ")+r.code,sub:r.trainer,avg:r.avg,count:r.count}))} avgLine={dailySummary.mean} lang={lang}/>
              <ComparisonBars title={isAr?"👨‍🏫 ترتيب المدربين — الأداء اليومي (محاور التعليم)":"👨‍🏫 Trainer Ranking — Daily (Education Axes)"} data={dailyTrainerRank.map(x=>({id:x.id,label:x.name,sub:isAr?"محاور التعليم":"education axes",avg:x.avg,count:x.respondents}))} avgLine={dailySummary.mean} lang={lang}/>

              <HeatMap data={dailyHeat} lang={lang}/>
              <ReportFooter lang={lang}/>
            </div>
          )}

          {/* ===== Final Report ===== */}
          {tab==="final"&&(
            <div>
              <ReportHero
                title={isAr?"التقرير الختامي للبرنامج التدريبي":"Final Program Evaluation Report"}
                sub={isAr?"رضا المشاركين عن التعليم والخدمات وإدارة البرنامج":"Participant satisfaction: education, services & management"}
                accent={TEAL} verdict={finalVerdict} score={finalSummary.mean} perfLabel={finalSummary.perf.label} lang={lang}
                onPrint={()=>window.print()}/>

              <FiltersBar value={finalF} setValue={setFinalF} count={finalRows.length}/>

              <NarrativeCard narrative={finalNarr} lang={lang} accent={TEAL}/>

              <div className="g4">
                <MetricCard icon="📝" color={TEAL} title={isAr?"الاستبانات":"Forms"} value={finalSummary.respondents} sub={isAr?"استجابات ختامية صالحة":"Valid final forms"} badge={finalSummary.respondents>=30?{label:isAr?"عينة قوية":"Strong",bg:"#d1fae5",fg:"#047857"}:finalSummary.respondents>=10?{label:isAr?"عينة مقبولة":"Fair",bg:"#fef3c7",fg:"#b45309"}:{label:isAr?"عينة صغيرة":"Small",bg:"#fee2e2",fg:"#b91c1c"}}/>
                <MetricCard icon="📊" color={finalSummary.mean>=TARGET?TEAL:ORANGE} title={isAr?"المتوسط":"Mean"} value={`${finalSummary.mean.toFixed(2)}/5`} sub={isAr?`الوسيط: ${finalSummary.median.toFixed(2)} — الفجوة: ${Math.max(0,TARGET-finalSummary.mean).toFixed(2)}`:`Median: ${finalSummary.median.toFixed(2)} — Gap: ${Math.max(0,TARGET-finalSummary.mean).toFixed(2)}`} badge={{label:finalSummary.perf.label,bg:finalSummary.perf.bg,fg:finalSummary.perf.fg}}/>
                <MetricCard icon="↔️" color={ORANGE} title={isAr?"الانحراف المعياري":"Std Dev"} value={finalSummary.stddev.toFixed(2)} sub={isAr?"تذبذب تجربة المشاركين":"Experience consistency"}/>
                <MetricCard icon="⚠️" color={finalHighRisk?RED:TEAL} title={isAr?"محاور القلق":"Risk Areas"} value={finalHighRisk} sub={isAr?`منخفض 1–2: ${finalSummary.lowPct.toFixed(0)}%`:`Low 1–2: ${finalSummary.lowPct.toFixed(0)}%`}/>
              </div>

              <StrengthsGaps items={finalAxis} lang={lang}/>

              <div className="g2">
                <div className="card"><h3 className="ctitle">{isAr?"📊 توزيع تقييمات البرنامج":"📊 Program Distribution"}</h3><DistributionChart stats={finalSummary} lang={lang}/></div>
                <div className="card"><h3 className="ctitle">{isAr?"📈 اتجاه الرضا الختامي مقابل الهدف":"📈 Final Trend vs Target"}</h3><TrendChart data={finalTrend} lang={lang} color={TEAL}/></div>
              </div>

              <ScorecardTable title={isAr?"🛡️ بطاقة أداء البرنامج":"🛡️ Program Scorecard"} items={finalAxis} lang={lang}/>
              <PriorityActions items={finalAxis} lang={lang}/>

              <ComparisonBars title={isAr?"🏫 مقارنة القاعات — التقييم الختامي":"🏫 Rooms Comparison — Final"} data={finalRoomRank.map(r=>({id:r.id,label:(isAr?"قاعة ":"Room ")+r.code,sub:r.trainer,avg:r.avg,count:r.count}))} avgLine={finalSummary.mean} lang={lang}/>
              <ComparisonBars title={isAr?"👨‍🏫 ترتيب المدربين — التقييم الختامي (محاور التعليم)":"👨‍🏫 Trainer Ranking — Final (Education Axes)"} data={finalTrainerRank.map(x=>({id:x.id,label:x.name,sub:isAr?"محاور التعليم":"education axes",avg:x.avg,count:x.respondents}))} avgLine={finalSummary.mean} lang={lang}/>

              <HeatMap data={finalHeat} lang={lang}/>
              <ReportFooter lang={lang}/>
            </div>
          )}

          {/* ===== Participants ===== */}
          {tab==="participants"&&(
            <div>
              <div className="card" style={{borderInlineStart:"6px solid #7c3aed"}}>
                <h1 style={{fontSize:28,fontWeight:900,marginBottom:8,color:"#7c3aed"}}>{t.tab4}</h1>
                <p style={{color:"#64748b",margin:0}}>{t.participantsHint}</p>
              </div>

              <FiltersBar value={partF} setValue={setPartF} count={partRows.length} withQuery/>

              <div className="card noprint" style={{padding:16,display:"flex",gap:12,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  <button className="btn2" onClick={()=>setRevealPII(v=>!v)}>🔒 {revealPII?t.hide:t.reveal}</button>
                  <button className="btn2" onClick={()=>{
                    const flat=[];
                    for(const r of partRoomData)for(const s of r.students)flat.push([r.code,r.trainer,s.name,s.phone,s.email]);
                    downloadCSV("participants.csv",[[isAr?"القاعة":"Room",isAr?"المدرب":"Trainer",isAr?"الاسم":"Name",isAr?"الجوال":"Phone",isAr?"البريد":"Email"],...flat]);
                  }}>⬇️ {t.export}</button>
                  <button className="btn2" onClick={()=>{setPartF({trainerId:"ALL",classroomId:"ALL",from:"",to:"",q:""});setRevealPII(false);}}>🧹 {t.clear}</button>
                  <button className="btn2" style={{borderColor:"#fca5a5",color:RED}} onClick={()=>setPurgeOpen(true)}>🗑️ {t.purge}</button>
                </div>
                <div className="badge" style={{background:"#f1f5f9",color:"#0f172a"}}>{isAr?"قاعات":"Rooms"}: {partRoomData.length}</div>
              </div>

              {partRoomData.map(r=>(
                <div key={r.id} className="card" style={{padding:0,overflow:"hidden"}}>
                  <div style={{background:"#f8fafc",padding:16,borderBottom:"1px solid #e2e8f0",display:"flex",gap:16,alignItems:"center"}}>
                    <b style={{fontSize:18,color:TEAL}}>{(isAr?"قاعة ":"Room ")+r.code}</b>
                    <span style={{color:"#64748b"}}>{(isAr?"المدرب: ":"Trainer: ")+r.trainer}</span>
                    <span style={{background:"#dbeafe",color:"#1d4ed8",padding:"4px 12px",borderRadius:999,fontSize:12,fontWeight:900,marginInlineStart:"auto"}}>
                      {r.students.length} {isAr?"مشارك":"participants"}
                    </span>
                  </div>
                  <table className="tbl">
                    <thead><tr><th className="th">{isAr?"الاسم":"Name"}</th><th className="th">{isAr?"الجوال":"Phone"}</th><th className="th">{isAr?"البريد":"Email"}</th></tr></thead>
                    <tbody>
                      {r.students.map((s,i)=>(
                        <tr key={i}>
                          <td className="td">{s.name||"—"}</td>
                          <td className="td ltr">{revealPII?(s.phone||"—"):maskPhone(s.phone)}</td>
                          <td className="td ltr" style={{color:BLUE}}>{revealPII?(s.email||"—"):maskEmail(s.email)}</td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>
              ))}
              {partRoomData.length===0&&<div className="card"><div className="empty">{t.noData}</div></div>}
            </div>
          )}

          {/* ===== Certificate ===== */}
          {tab==="cert"&&(
            <div>
              <div className="card" style={{borderInlineStart:`6px solid ${GOLD}`}}>
                <h1 style={{fontSize:28,fontWeight:900,marginBottom:8,color:GOLD}}>{t.tab5}</h1>
                <p style={{color:"#64748b",margin:0}}>{isAr?"اختيار أفضل مدرب من محاور التعليم فقط — تقييم عادل.":"Best trainer from education axes only — fair evaluation."}</p>
              </div>

              <FiltersBar value={certF} setValue={setCertF} count={certRows.length} withMin/>

              {certBest?(
                <div className="card" style={{textAlign:"center",padding:40,background:"linear-gradient(135deg, #fffbeb, #fef3c7)",border:`4px solid ${GOLD}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                    <img src="/logos/upm.png" alt="UPM" style={{height:64}}/>
                    <img src="/logos/center.png" alt="Center" style={{height:64}}/>
                  </div>
                  <h1 style={{fontSize:36,fontWeight:900,color:GOLD,marginBottom:8}}>{isAr?"شهادة تميز وإشادة":"Certificate of Excellence"}</h1>
                  <p style={{color:"#64748b",marginBottom:24}}>{isAr?"تُمنح لأفضل مدرب وفق محاور التعليم وحجم العينة":"Awarded to the best trainer by education axes and sample size"}</p>
                  <h2 style={{fontSize:48,fontWeight:900,color:TEAL,marginBottom:16}}>{certBest.trainer}</h2>
                  <p style={{fontSize:20,color:"#334155"}}>
                    {isAr?"معدل التعليم":"Education average"}:{" "}
                    <b style={{color:GOLD,direction:"ltr"}}>{certBest.avg.toFixed(2)}/5</b> ({isAr?"استجابات":"responses"}: {certBest.count})
                  </p>
                  <button onClick={()=>window.print()} className="btn2 noprint" style={{marginTop:24,background:NAVY,color:"#fff"}}>🖨️ {t.print}</button>
                </div>
              ):(
                <div className="card" style={{textAlign:"center",padding:60}}><p style={{color:"#94a3b8",fontSize:18}}>{t.noData}</p></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Delete Warning Modal ===== */}
      {purgeOpen&&(
        <div className="modal-overlay noprint" onClick={closePurgeModal}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{direction:t.dir}}>
            <div className="modal-head">
              <div className="modal-head-icon">⚠️</div>
              <div>
                <h3>{isAr?"حذف نهائي للاستجابات":"Permanent Deletion"}</h3>
                <p>{isAr?"هذا الإجراء غير قابل للاسترجاع":"This action cannot be undone"}</p>
              </div>
            </div>
            <div className="modal-body">
              <ul className="modal-warning-list">
                <li>{isAr?"سيتم حذف استجابات المتدربين نهائيًا من قاعدة البيانات.":"Responses will be permanently deleted."}</li>
                <li>{isAr?"الحذف يطبق على الفلاتر الحالية (المدرب / القاعة / الفترة).":"Applies to current filters (trainer / room / dates)."}</li>
                <li>{isAr?"ستتأثر التقارير فورًا بعد الحذف.":"Reports will be affected immediately."}</li>
                <li>{isAr?"يُوصى بشدة بتصدير البيانات قبل المتابعة.":"Export data first."}</li>
              </ul>
              <label className="modal-label">{isAr?"نوع الاستجابات:":"Response type:"}</label>
              <div className="kind-options">
                {[{key:"DAILY",ar:"اليومي",en:"Daily",icon:"📅"},{key:"FINAL",ar:"الختامي",en:"Final",icon:"🏁"},{key:"BOTH",ar:"كلاهما",en:"Both",icon:"🗂️"}].map(o=>(
                  <div key={o.key} className={`kind-option ${purgeKind===o.key?"selected":""}`} onClick={()=>setPurgeKind(o.key)}>
                    <div style={{fontSize:20,marginBottom:4}}>{o.icon}</div>
                    {isAr?o.ar:o.en}
                  </div>))}
              </div>
              <label className="modal-label">{isAr?"للمتابعة، اكتب كود التأكيد:":"Type confirmation code:"}</label>
              <input type="password" className={`code-input ${codeError?"error":""}`} placeholder="••••" maxLength={4} value={purgeCode}
                onChange={e=>setPurgeCode(e.target.value.replace(/\D/g,""))}
                onKeyDown={e=>{if(e.key==="Enter"&&purgeCode.length===4)executePurge();}}
                disabled={purgeBusy}/>
              {purgeMsg&&(<div className={`modal-result ${purgeMsg.startsWith("success:")?"success":"error"}`}>{purgeMsg.replace(/^(success:|error:)/,"")}</div>)}
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={closePurgeModal} disabled={purgeBusy}>{isAr?"إلغاء":"Cancel"}</button>
              <button className="modal-btn-delete" onClick={executePurge} disabled={purgeBusy||purgeCode.length!==4}>
                {purgeBusy?(isAr?"⏳ جاري الحذف...":"⏳ Deleting..."):(isAr?"🗑️ حذف نهائي":"🗑️ Delete Permanently")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ CSS ============ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;}
@keyframes spin{to{transform:rotate(360deg);}}
.rw{background:#f4f6f8;min-height:100vh;padding:24px;}
.lay{display:flex;gap:24px;}
.main{flex:1;min-width:0;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:20px;}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:26px;margin-bottom:20px;box-shadow:0 8px 28px rgba(15,23,42,.035);}
.ctitle{margin:0 0 10px;font-size:19px;font-weight:900;color:#0f172a;}
.cdesc{color:#64748b;margin:0 0 16px;font-size:13px;font-weight:700;}
.empty{color:#94a3b8;text-align:center;padding:32px 12px;font-weight:800;}
.ltr{direction:ltr;unicode-bidi:plaintext;}
.badge{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:900;}
.tbl{width:100%;border-collapse:collapse;}
.th{padding:13px;font-weight:900;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;text-align:start;white-space:nowrap;}
.td{padding:13px;font-size:13px;border-bottom:1px solid #f1f5f9;font-weight:700;vertical-align:top;}
.twrap{width:100%;overflow-x:auto;}
.twrap .tbl{min-width:1000px;}
.sel,.inp{width:100%;padding:12px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;font-weight:800;outline:none;font-family:inherit;}
.sel:focus,.inp:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12);}
.fgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
.btn2{width:auto;padding:12px 16px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-weight:900;cursor:pointer;font-family:inherit;}
.noprint{}

/* Sidebar identity */
.side{width:300px;flex-shrink:0;background:linear-gradient(160deg,#0f2740 0%,#173a5e 55%,#0d9488 130%);border-radius:24px;padding:22px;color:#fff;position:sticky;top:24px;height:fit-content;box-shadow:0 20px 50px rgba(15,39,64,.25);}
.brand-card{background:#fff;border-radius:18px;padding:16px 14px;margin-bottom:22px;text-align:center;border-bottom:4px solid #c19a3d;}
.brand-logos{display:flex;align-items:center;justify-content:center;gap:12px;}
.brand-logo{height:56px;width:auto;object-fit:contain;}
.brand-divider{width:1px;height:44px;background:#e2e8f0;}
.brand-name{color:#173a5e;font-weight:900;font-size:16px;margin-top:10px;}
.brand-tag{color:#0d9488;font-weight:800;font-size:12px;margin-top:2px;}
.ton{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;border:none;border-inline-start:4px solid #c19a3d;border-radius:14px;padding:13px 16px;cursor:pointer;font-weight:800;font-size:15px;width:100%;display:flex;align-items:center;margin-bottom:10px;box-shadow:0 8px 20px rgba(13,148,136,.35);font-family:inherit;}
.tof{background:rgba(255,255,255,0.05);color:#b6c6d8;border:1px solid rgba(255,255,255,0.06);border-inline-start:4px solid transparent;border-radius:14px;padding:13px 16px;cursor:pointer;font-weight:700;font-size:15px;width:100%;display:flex;align-items:center;margin-bottom:10px;transition:all .15s ease;font-family:inherit;}
.tof:hover{background:rgba(255,255,255,0.12);color:#fff;border-inline-start-color:#c19a3d;}
.nav-label{display:flex;align-items:center;gap:10px;}
.nav-ico{width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,0.14);display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.ton .nav-ico{background:rgba(255,255,255,0.22);}
.side-copy{margin-top:16px;text-align:center;color:rgba(255,255,255,.45);font-size:11px;font-weight:700;}

/* Report header */
.report-header{background:#fff;border:1px solid #e2e8f0;border-bottom:4px solid #0d9488;border-radius:18px;padding:12px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
.report-header img{height:48px;width:auto;object-fit:contain;}
.report-header-text{text-align:center;}
.report-header-text b{display:block;color:#173a5e;font-size:16px;font-weight:900;}
.report-header-text span{color:#0d9488;font-size:12px;font-weight:800;}

/* Report meta & verdict */
.rep-meta{background:#fff;border:1px solid #e2e8f0;border-inline-start:6px solid #c19a3d;border-radius:18px;padding:18px 22px;margin-bottom:20px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;}
.rep-title{color:#173a5e;font-size:20px;font-weight:900;}
.rep-sub{color:#0d9488;font-size:13px;font-weight:800;margin-top:3px;}
.rep-side{color:#64748b;font-size:13px;font-weight:700;line-height:1.8;text-align:end;}
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
.vprint{background:#0f172a;color:#fff;border:none;padding:12px 18px;border-radius:12px;font-weight:900;cursor:pointer;font-family:inherit;}

/* Narrative */
.narr{background:linear-gradient(135deg,#ffffff,#f8fafc);}
.ntext{color:#334155;font-size:14.5px;font-weight:600;line-height:2;margin:0 0 12px;text-align:justify;}
.ntext:last-child{margin-bottom:0;}

/* Metric cards */
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

/* Badges & gaps */
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

/* Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;animation:fadeIn .2s ease;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideUp{from{transform:translateY(30px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.modal-box{background:#fff;border-radius:24px;width:100%;max-width:520px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,.35);animation:slideUp .3s ease;}
.modal-head{background:linear-gradient(135deg,#7f1d1d,#dc2626);color:#fff;padding:22px 26px;display:flex;align-items:center;gap:14px;}
.modal-head-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
.modal-head h3{margin:0;font-size:20px;font-weight:900;}
.modal-head p{margin:4px 0 0;font-size:13px;opacity:.85;font-weight:600;}
.modal-body{padding:24px 26px;}
.modal-warning-list{background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:14px 18px;margin:0 0 18px;padding-inline-start:34px;}
.modal-warning-list li{color:#991b1b;font-size:14px;font-weight:700;margin-bottom:6px;line-height:1.7;}
.modal-warning-list li:last-child{margin-bottom:0;}
.modal-label{display:block;font-size:13px;font-weight:900;color:#334155;margin-bottom:6px;}
.kind-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;}
.kind-option{border:2px solid #e2e8f0;border-radius:12px;padding:12px 8px;text-align:center;cursor:pointer;font-weight:800;font-size:13px;color:#64748b;transition:all .15s ease;background:#fff;}
.kind-option:hover{border-color:#fca5a5;}
.kind-option.selected{border-color:#dc2626;background:#fef2f2;color:#dc2626;}
.code-input{width:100%;padding:14px;border-radius:12px;border:2px solid #e2e8f0;font-size:22px;font-weight:900;text-align:center;letter-spacing:10px;direction:ltr;outline:none;transition:border .15s ease;}
.code-input:focus{border-color:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.1);}
.code-input.error{border-color:#dc2626;background:#fef2f2;animation:shake .3s ease;}
@keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
.modal-footer{padding:16px 26px 24px;display:flex;gap:12px;}
.modal-btn-cancel{flex:1;padding:14px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;}
.modal-btn-delete{flex:1;padding:14px;border-radius:12px;border:none;background:#dc2626;color:#fff;font-weight:900;font-size:15px;cursor:pointer;font-family:inherit;}
.modal-btn-delete:disabled{background:#fca5a5;cursor:not-allowed;}
.modal-result{margin-top:14px;padding:12px 16px;border-radius:12px;font-weight:800;font-size:14px;line-height:1.7;}
.modal-result.success{background:#d1fae5;color:#047857;}
.modal-result.error{background:#fee2e2;color:#b91c1c;}

@media(max-width:1150px){.g4{grid-template-columns:repeat(2,1fr);}}
@media(max-width:950px){
.lay{flex-direction:column;}
.side{width:100%;position:static;}
.g2,.g4,.igrid{grid-template-columns:1fr;}
.fgrid{grid-template-columns:1fr;}
.report-header{flex-direction:column;gap:8px;}
.verdict{flex-direction:column;align-items:flex-start;}
.vscore{margin-inline-start:0;}
}
@media print{.side,.noprint{display:none !important;}.rw{padding:0;background:#fff;}.card,.verdict,.rep-meta{box-shadow:none !important;break-inside:avoid;}}
`;
