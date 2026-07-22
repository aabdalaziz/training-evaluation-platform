// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// القاموس وخطوط الـ Enterprise الفخمة
// ==========================================
const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال", sub: "النظام المركزي للتحليلات",
    tab1: "الملخص التنفيذي", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "أداء القاعات", tab5: "سجل المشاركين", tab6: "شهادة التميز",
    lang: "English 🌐", loading: "جاري توليد التقرير الاستشاري والمؤشرات البصرية...",
    printCert: "🖨️ طباعة الشهادة"
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "BI Dashboard", sub: "Central Analytics System",
    tab1: "Executive Summary", tab2: "Daily Report", tab3: "Final Report", tab4: "Rooms Perf.", tab5: "Participants", tab6: "Certificate",
    lang: "عربي 🌐", loading: "Generating advanced consulting report...",
    printCert: "🖨️ Print Certificate"
  }
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Inter:wght@400;600;800&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.rw { background: #f4f6f8; min-height: 100vh; padding: 24px; color: #0f172a; }
.lay { display: flex; gap: 24px; align-items: flex-start; }

/* القائمة الجانبية المبرزة */
.side { width: 310px; flex-shrink: 0; background: linear-gradient(145deg, #0b1220, #172554); border-radius: 28px; padding: 24px; color: #fff; position: sticky; top: 24px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); }

.main { flex: 1; min-width: 0; }

/* أزرار القائمة الجانبية (تكبير ووضوح) */
.ton { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 16px; padding: 16px 20px; cursor: pointer; font-weight: 900; font-size: 16.5px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); margin-bottom: 12px; box-shadow: 0 8px 20px rgba(16,185,129,0.35); transform: translateY(-2px); }
.tof { background: rgba(255,255,255,0.04); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 16px 20px; cursor: pointer; font-weight: 700; font-size: 16.5px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); margin-bottom: 12px; backdrop-filter: blur(10px); }
.tof:hover { background: rgba(255,255,255,0.1); color: #fff; transform: translateX(-4px); border-color: rgba(255,255,255,0.15); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }

.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 28px; padding: 30px; box-shadow: 0 10px 30px rgba(15,23,42,0.03); margin-bottom: 24px; transition: transform 0.3s; }
.card:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(15,23,42,0.06); }
.kpi { border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 16px; font-weight: 900; font-size: 14.5px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 16px; font-size: 15px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: #1e293b; }
.report-text { font-size: 16px; line-height: 2; color: #334155; font-weight: 600; text-align: justify; }
.cert-wrap { background: #fff; padding: 40px; border-radius: 20px; border: 15px solid #0f172a; outline: 4px solid #d97706; outline-offset: -12px; position: relative; text-align: center; }

@media(max-width: 950px){ .lay { flex-direction: column; } .side { width: 100%; position: static; } .g2, .g3 { grid-template-columns: 1fr; } }
@media print { 
  @page { size: A4 landscape; margin: 0; }
  body, .rw { background: #fff !important; padding: 0 !important; margin: 0 !important; }
  .side, .print-hide { display: none !important; }
  .lay { display: block !important; }
  .card { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
  .cert-wrap { height: 95vh; display: flex; flex-direction: column; justify-content: center; border: 20px solid #0f172a !important; outline: 5px solid #d97706 !important; outline-offset: -15px !important; }
}
`;

const TEAL = "#10b981";
const BLUE = "#2563eb";
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function getInterpretation(score) {
  if (score >= 4.5) return "أداء استثنائي يعكس بيئة تدريبية محفزة ومحتوى عالي الجودة يلبي توقعات المستفيدين بشكل كامل.";
  if (score >= 4.0) return "أداء متقدم ومستقر يحقق الأهداف المطلوبة، مع وجود مساحة طفيفة لابتكار أساليب جديدة.";
  if (score >= 3.0) return "أداء متوسط يتطلب تدخلاً إشرافياً ومراجعة لبعض الجوانب الإجرائية لرفع مستوى الرضا.";
  if (score > 0) return "أداء حرج يستدعي تدخلاً إدارياً فورياً وإعادة تقييم شاملة للمنهجية والمدرب.";
  return "لا توجد بيانات كافية لاستخراج تفسير تحليلي.";
}

function statusOf(v) {
  const val = Number(v) || 0;
  if (val >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (val >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "تدخل مطلوب", bg: "#fee2e2", fg: "#b91c1c" };
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }

// ==========================================
// مكون العداد الدائري (Gauge Chart)
// ==========================================
function GaugeChart({ score, color }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ textAlign: "center", position: "relative", height: "90px", width: "160px", margin: "0 auto" }}>
      <svg width="160" height="90" viewBox="0 0 160 90">
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#f1f5f9" strokeWidth="18" strokeLinecap="round" />
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset} style={{ transition: "stroke-dashoffset 1.5s ease-out" }} />
      </svg>
      <div style={{ position: "absolute", bottom: "-5px", left: "0", right: "0", fontSize: "32px", fontWeight: "900", color: "#0f172a" }}>{score ? score.toFixed(2) : "0.00"}</div>
    </div>
  );
}

export default function EnterpriseReports() {
  const router = useRouter();
  const [lang, setLang] = useState("ar");
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState([]);
  const [qs, setQs] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [load, setLoad] = useState(true);
  const [tab, setTab] = useState("dashboard");

  const t = dict[lang];
  const db = supabase();

  const fetchAllData = async () => {
    const [e, a, q, c, tr] = await Promise.all([
      db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
      db.from("evaluation_answers").select("*"),
      db.from("questions").select("*"),
      db.from("classrooms").select("*"),
      db.from("trainers").select("*")
    ]);
    setRows(e.data || []); setAns(a.data || []); setQs(q.data || []);
    setClassrooms(c.data || []); setTrainers(tr.data || []);
  };

  useEffect(() => {
    setMounted(true); let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await fetchAllData(); setLoad(false); }
    })();
    return () => { on = false; };
  }, []);

  const calc = (kind) => {
    const list = rows.filter(r => r?.kind === kind);
    const ids = new Set(list.map(r => r.id));
    const qm = {}; qs.forEach(q => { if (q) qm[q.id] = q; });
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    const g = {};
    ans.forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes = Object.keys(g).map(id => ({ label: qm[id]?.text_ar || "سؤال", section: qm[id]?.section_ar || "عام", value: avg(g[id]) })).sort((a, b) => b.value - a.value);
    
    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => { const v = Math.round(Number(r.overall_rating)); if (v >= 1 && v <= 5) dist[v - 1] += 1; });

    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      dayMap[key] = { wd: WEEKDAYS_AR[d.getDay()], dt: pad(d.getMonth() + 1) + "-" + pad(d.getDate()), count: 0 };
    }
    list.forEach(r => {
      if (!r || !r.submitted_at) return;
      const d = new Date(r.submitted_at); if (isNaN(d.getTime())) return;
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      if (dayMap[key]) dayMap[key].count += 1;
    });
    const days = Object.keys(dayMap).map(k => dayMap[k]);

    const all = list.map(r => Number(r.overall_rating)).filter(v => v > 0);
    const comments = [];
    ans.forEach(a => { if (a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim()) comments.push(a.text_value.trim()); });
    
    return { count: list.length, avg: avg(all), axes, comments, dist, days };
  };

  const daily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const final = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  const roomData = useMemo(() => {
    return classrooms.map(c => {
      const tObj = trainers.find(x => x.id === c.trainer_id);
      const evs = rows.filter(r => r.classroom_id === c.id);
      const avg = evs.length ? evs.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / evs.length : 0;
      const students = evs.map(e => ({ name: e.guest_name, email: e.guest_email, phone: e.guest_phone })).filter(s => s.name);
      const uniqueStudents = Array.from(new Set(students.map(s => s.email))).map(email => students.find(s => s.email === email));
      return { id: c.id, code: c.code, trainer: tObj?.name || "—", count: evs.length, avg, students: uniqueStudents };
    }).filter(c => c.count > 0).sort((a, b) => b.avg - a.avg);
  }, [classrooms, trainers, rows]);

  const bestTeacher = useMemo(() => roomData.length ? roomData[0] : null, [roomData]);
  const lowestRoom = useMemo(() => roomData.length > 1 ? roomData[roomData.length - 1] : null, [roomData]);

  if (!mounted || load) return <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center", background:"#0f172a" }}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div style={{ width: 80, height: 80, border: "8px solid rgba(255,255,255,0.1)", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }}/></div>;

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        
        {/* Sidebar (الآن أضخم وأكثر وضوحاً وبروزاً) */}
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "36px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "18px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", boxShadow: "0 10px 20px rgba(16,185,129,0.4)" }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "20px", letterSpacing: "0.5px" }}>{t.title}</div>
              <div style={{ fontSize: "12.5px", color: "#94a3b8", marginTop: "2px" }}>{t.sub}</div>
            </div>
          </div>
          
          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}><span>{t.tab1}</span> <span style={{fontSize:"20px"}}>🏢</span></button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}><span>{t.tab2}</span> <span style={{fontSize:"20px"}}>📈</span></button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}><span>{t.tab3}</span> <span style={{fontSize:"20px"}}>🏁</span></button>
          <button className={tab === "rooms" ? "ton" : "tof"} onClick={() => setTab("rooms")}><span>{t.tab4}</span> <span style={{fontSize:"20px"}}>🏫</span></button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span>{t.tab5}</span> <span style={{fontSize:"20px"}}>👥</span></button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span>{t.tab6}</span> <span style={{fontSize:"20px"}}>🏆</span></button>
          
          <div style={{ marginTop: "40px", borderTop: "2px solid rgba(255,255,255,.05)", paddingTop: "20px" }}>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: 800, cursor: "pointer", marginBottom: "12px", transition: ".2s" }}>{t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "14px", borderRadius: "14px", fontSize: "15px", fontWeight: "800", transition: ".2s" }}>⚙️ الإدارة المركزية</button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="main">
          
          <div className="print-hide" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "20px" }}>
            <button onClick={() => window.print()} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "14px 24px", borderRadius: "14px", fontWeight: 900, cursor: "pointer", fontSize: "15px", boxShadow: "0 8px 15px rgba(15,23,42,0.2)" }}>
              {t.printCert} / التقرير الشامل
            </button>
          </div>

          {tab === "dashboard" && (
            <div>
              <div className="card print-hide" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff", border: "none", padding: "34px" }}>
                <span style={{ background: "rgba(255,255,255,0.1)", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, marginBottom: "12px", display: "inline-block" }}>تقرير استشاري ذكي</span>
                <h1 style={{ fontSize: "40px", fontWeight: 900, margin: "0 0 10px", letterSpacing: "-0.5px" }}>الملخص التنفيذي للإدارة العليا</h1>
                <p style={{ color: "#94a3b8", fontSize: "16px", margin: 0 }}>نظرة شاملة تربط مؤشرات الأداء الحية لتسهيل اتخاذ القرارات الأكاديمية والتشغيلية.</p>
              </div>

              <div className="g3">
                <div className="card kpi" style={{ borderBottomColor: "#3b82f6" }}><div style={{ fontSize: "16px", color: "#64748b", fontWeight: 800 }}>حجم العينة المستردة</div><div style={{ fontSize: "48px", fontWeight: 900, color: "#3b82f6" }}>{daily.count + final.count}</div><div style={{fontSize: "13px", color:"#10b981", marginTop: "8px", fontWeight: 700}}>▲ معدل ثقة إحصائي عالي</div></div>
                <div className="card kpi" style={{ textAlign: "center" }}><div style={{ fontSize: "16px", color: "#64748b", fontWeight: 800, marginBottom: "14px" }}>مؤشر الأداء اليومي</div><GaugeChart score={daily.avg} color={BLUE} /></div>
                <div className="card kpi" style={{ textAlign: "center" }}><div style={{ fontSize: "16px", color: "#64748b", fontWeight: 800, marginBottom: "14px" }}>مؤشر الرضا الختامي</div><GaugeChart score={final.avg} color={TEAL} /></div>
              </div>

              <div className="card">
                <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "20px", color: "#0f172a" }}>📖 القراءة التحليلية والتشخيص (Diagnostic Analysis)</h2>
                <p className="report-text">
                  بناءً على معالجة <span className="highlight" style={{color:"#2563eb", background:"#eff6ff"}}>({daily.count + final.count})</span> استبانة تقييمية مستردة من المشاركين، تظهر المؤشرات العامة اتجاهاً 
                  <b style={{color:"#047857"}}> {daily.avg >= 4 ? " إيجابياً وممتازاً " : daily.avg >= 3 ? " مستقراً " : " حرجاً "} </b>
                  حيث استقر المعدل اليومي لأداء الحصص والمدربين عند <span className="highlight">{daily.avg.toFixed(2)} من 5</span>. 
                  وهو يعكس مدى التفاعل اللحظي وقوة الشرح داخل القاعات.
                </p>
                <p className="report-text" style={{ marginTop: "15px" }}>
                  بينما سجل التقييم الختامي للبرنامج معدل <span className={final.avg >= 4 ? "highlight" : "alert-text"}>{final.avg.toFixed(2)} من 5</span>. 
                  التباين بين التقييم اليومي والنهائي يعطي دلالة واضحة على: 
                  <b style={{color: final.avg >= daily.avg ? "#047857" : "#b91c1c"}}>
                  {final.avg >= daily.avg 
                    ? " نجاح الإدارة في تدارك الملاحظات اليومية وتوفير تجربة ختامية ممتازة غطت على أي قصور فني."
                    : " تراجع في مستوى الرضا العام عن الخدمات اللوجستية الختامية مقارنة بالمستوى الأكاديمي الممتاز للمدربين."}
                  </b>
                </p>
              </div>

              <div className="g2">
                <div className="card">
                  <h2 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "20px", color: "#b91c1c" }}>💡 التوصيات الاستراتيجية (Action Plan)</h2>
                  
                  <div style={{ background: "#fffbeb", padding: "20px", borderRadius: "16px", border: "1px solid #fde68a", marginBottom: "16px" }}>
                    <b style={{ color: "#b45309", fontSize: "16px", display: "block", marginBottom: "8px" }}>الفرضية التحليلية:</b>
                    <p style={{ margin: 0, fontSize: "15px", color: "#334155", lineHeight: "1.7", fontWeight: 600 }}>
                      المحور الأقل تقييماً اليوم هو <b>({daily.axes[0]?.label || "—"})</b> بمعدل <b>{daily.axes[0]?.value.toFixed(2) || "0"}</b>. 
                      يُفترض أن هذا الانخفاض يعود لقصور مؤقت في الأدوات أو كثافة المادة في هذا الجانب.
                    </p>
                  </div>

                  <div style={{ background: "#eff6ff", padding: "20px", borderRadius: "16px", border: "1px solid #bfdbfe" }}>
                    <b style={{ color: "#1d4ed8", fontSize: "16px", display: "block", marginBottom: "8px" }}>الإجراء التصحيحي المطلوب:</b>
                    <ul style={{ margin: 0, paddingRight: "20px", fontSize: "15px", color: "#334155", lineHeight: "1.8", fontWeight: 600 }}>
                      <li>تكليف لجنة الجودة بمراجعة المادة العلمية المتعلقة بمحور ({daily.axes[0]?.label || "—"}).</li>
                      {lowestRoom && <li>توجيه دعم فني إشرافي مكثف لقاعة <b>{lowestRoom.code}</b> (المدرب: {lowestRoom.trainer}) لكونها الأقل أداءً ({lowestRoom.avg.toFixed(2)}).</li>}
                      {bestTeacher && <li>تكريم المدرب <b>{bestTeacher.trainer}</b> وتعميم أسلوبه كنموذج (Best Practice) لباقي المدربين.</li>}
                    </ul>
                  </div>
                </div>

                <div className="card">
                  <h2 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "20px" }}>📊 ترتيب القاعات الحالي</h2>
                  {roomData.map((r, i) => (
                    <div key={r.id} style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "15px", fontWeight: 800 }}>
                        <span>قاعة {r.code} <span style={{fontSize: "12px", color: "#64748b", fontWeight: 600}}>({r.trainer})</span></span>
                        <span style={{ color: i === 0 ? "#10b981" : "#334155" }}>{r.avg.toFixed(2)}</span>
                      </div>
                      <div style={{ height: "12px", background: "#f1f5f9", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ width: `${(r.avg/5)*100}%`, height: "100%", background: i === 0 ? "#10b981" : (i === roomData.length-1 ? "#ef4444" : "#2563eb") }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(tab === "daily" || tab === "final") && (() => {
            const r = tab === "daily" ? daily : final;
            const ac = tab === "daily" ? BLUE : TEAL;
            const maxDi = Math.max(1, ...(r.dist || [1]));
            const dColors = ["#f43f5e", "#fb923c", "#facc15", "#34d399", "#10b981"];
            const chartH = 150; const chartW = 400; const stepX = chartW / 6;
            const maxD = Math.max(1, ...(r.days || []).map(d => d.count || 0));
            const points = (r.days || []).map((d, i) => `${i * stepX},${chartH - ((d.count || 0) / maxD) * chartH}`);
            const pathD = `M 0,${chartH} L ${points.join(" L ")} L ${chartW},${chartH} Z`;
            const lineD = `M ${points.join(" L ")}`;

            return (
              <div>
                <div className="card" style={{ padding: "34px", background: `linear-gradient(135deg, #ffffff, #f8fafc)`, borderLeft: `8px solid ${ac}` }}>
                  <h1 style={{ fontSize: "32px", fontWeight: 900, marginBottom: "12px", color: ac }}>{tab === "daily" ? "التحليل العميق للحصص اليومية" : "مؤشر الرضا الختامي للبرنامج"}</h1>
                  <p className="report-text" style={{margin:0}}>{getInterpretation(r.avg)}</p>
                </div>

                <div className="g2">
                  <div className="card">
                    <h3 style={{ margin: "0 0 24px", fontSize: "18px", fontWeight: 900 }}>📈 مسار التفاعل (Area Chart) - آخر 7 أيام</h3>
                    <svg viewBox={`0 -15 ${chartW + 20} ${chartH + 45}`} style={{ width: "100%", height: "auto", overflow: "visible", padding: "10px" }}>
                      <defs><linearGradient id={"areaGrad"+tab} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ac} stopOpacity="0.4"/><stop offset="100%" stopColor={ac} stopOpacity="0.0"/></linearGradient></defs>
                      <line x1="0" y1={0} x2={chartW} y2={0} stroke="#f1f5f9" strokeDasharray="4,4" />
                      <line x1="0" y1={chartH/2} x2={chartW} y2={chartH/2} stroke="#f1f5f9" strokeDasharray="4,4" />
                      <path d={pathD} fill={`url(#areaGrad${tab})`} />
                      <path d={lineD} fill="none" stroke={ac} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      {(r.days || []).map((d, i) => {
                        const x = i * stepX; const y = chartH - ((d.count || 0) / maxD) * chartH;
                        return (
                          <g key={i}>
                            <circle cx={x} cy={y} r="5" fill="#fff" stroke={ac} strokeWidth="3" />
                            <text x={x} y={y - 14} textAnchor="middle" fontSize="12" fontWeight="900" fill="#0f172a">{d.count}</text>
                            <text x={x} y={chartH + 22} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">{d.wd}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="card">
                    <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900 }}>📊 الهرم التقييمي (توزيع النجوم)</h3>
                    {[5, 4, 3, 2, 1].map(s => {
                      const idx = s - 1; const dv = r.dist[idx] || 0; const w = (dv / maxDi) * 100;
                      return (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                          <span style={{ width: "60px", fontSize: "14px", fontWeight: 800, color: "#475569" }}>{s} نجوم</span>
                          <div style={{ flex: 1, height: "16px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}>
                            <div style={{ width: (isNaN(w)?0:w)+"%", height: "100%", background: dColors[idx], borderRadius: "8px" }} />
                          </div>
                          <b style={{ width: "30px", textAlign: "left", fontSize: "16px", color: "#0f172a" }}>{dv}</b>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ margin: "0 0 20px", fontSize: "20px", fontWeight: 900 }}>📋 تفصيل أداء المحاور الأكاديمية</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                    {(r.axes || []).length > 0 ? r.axes.map((a, i) => {
                      if (!a) return null; const s = statusOf(a.value);
                      return (
                        <div key={i} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: "18px", padding: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.02)" }}>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginBottom: "14px", minHeight: "44px", lineHeight: "1.6" }}>{a.label}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <span style={{ background: s.bg, color: s.fg, borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 800 }}>{s.t}</span>
                            <b style={{ color: ac, fontSize: "22px", fontWeight: 900 }}>{Number(a.value || 0).toFixed(2)}<span style={{fontSize:"14px", color:"#94a3b8"}}>/5</span></b>
                          </div>
                          <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}><div style={{ width: (Number(a.value || 0) / 5 * 100) + "%", height: "100%", background: ac, borderRadius: "8px" }} /></div>
                        </div>
                      );
                    }) : <p style={{ color: "#9a8f7d", textAlign: "center", gridColumn: "1/-1" }}>لا توجد بيانات.</p>}
                  </div>
                </div>
              </div>
            );
          })()}

          {tab === "rooms" && (
            <div className="card">
              <h2 style={{ fontSize: "26px", fontWeight: 900, marginBottom: "20px" }}>🏫 لوحة المقارنة المعيارية للقاعات</h2>
              <table className="tbl">
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th className="th" style={{textAlign: "right"}}>رمز القاعة</th>
                    <th className="th" style={{textAlign: "right"}}>اسم المدرب المسند</th>
                    <th className="th" style={{textAlign: "right"}}>حجم العينة</th>
                    <th className="th" style={{textAlign: "right"}}>المعدل النهائي</th>
                    <th className="th" style={{width: "30%"}}>التباين المعياري</th>
                  </tr>
                </thead>
                <tbody>
                  {roomData.map((r, i) => (
                    <tr key={r.id}>
                      <td className="td" style={{ color: "#10b981", fontSize: "22px", fontWeight: 900 }}>{r.code}</td>
                      <td className="td" style={{ fontWeight: 800, fontSize: "16px" }}>{r.trainer}</td>
                      <td className="td" style={{ fontSize: "15px" }}>{r.count} تقييم</td>
                      <td className="td" style={{ fontSize: "22px", fontWeight: 900 }}>{r.avg.toFixed(2)}</td>
                      <td className="td">
                        <div style={{ width: "100%", background: "#f1f5f9", height: "14px", borderRadius: "8px", overflow: "hidden" }}>
                          <div style={{ width: `${(r.avg/5)*100}%`, height: "100%", background: i === 0 ? "#10b981" : (i === roomData.length - 1 ? "#ef4444" : "#2563eb") }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "participants" && (
            <div className="card">
              <h2 style={{ fontSize: "26px", fontWeight: 900, marginBottom: "24px" }}>👥 سجل حضور ومشاركات الطلاب</h2>
              {roomData.map(r => (
                <div key={r.id} style={{ marginBottom: "30px", border: "1px solid #e2e8f0", borderRadius: "20px", overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "18px 24px", display: "flex", gap: "24px", alignItems: "center", borderLeft: "6px solid #2563eb" }}>
                    <b style={{ fontSize: "20px", color: "#0f172a" }}>قاعة {r.code}</b>
                    <span style={{ color: "#475569", fontWeight: 800, fontSize: "16px" }}>المدرب: {r.trainer}</span>
                    <span style={{ background: "#d1fae5", color: "#047857", padding: "6px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: 900, marginLeft: "auto" }}>{r.students.length} مشارك</span>
                  </div>
                  <table className="tbl" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th className="th" style={{textAlign:"right", background:"#fff"}}>اسم المتدرب</th>
                        <th className="th" style={{textAlign:"right", background:"#fff"}}>رقم الجوال</th>
                        <th className="th" style={{textAlign:"right", background:"#fff"}}>البريد الإلكتروني</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.students.map((s, i) => (
                        <tr key={i}>
                          <td className="td" style={{ fontWeight: 700 }}>{s.name || "—"}</td>
                          <td className="td" style={{ direction: "ltr", textAlign: "right", fontFamily: "Tahoma" }}>{s.phone || "—"}</td>
                          <td className="td" style={{ direction: "ltr", textAlign: "right", color: "#2563eb", fontWeight: 700 }}>{s.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {roomData.length === 0 && <p style={{textAlign:"center", color:"#94a3b8", padding: 40, fontSize: 16, fontWeight: 700}}>لا يوجد مشاركون مسجلون بعد.</p>}
            </div>
          )}

          {tab === "cert" && bestTeacher && (
            <div>
              <div className="print-hide" style={{ background: "#fff", padding: "20px", borderRadius: "20px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e2e8f0" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 900 }}>إصدار شهادة التميز الأسبوعية</h3>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>جاهزة للطباعة الفورية بحجم A4 للمدرب الأعلى تقييماً.</p>
                </div>
                <button onClick={() => window.print()} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "14px 28px", borderRadius: "14px", fontWeight: 900, cursor: "pointer", fontSize: "16px", boxShadow: "0 8px 15px rgba(15,23,42,0.2)" }}>
                  {t.printCert}
                </button>
              </div>
              
              <div className="card cert-wrap">
                <div style={{ position: "absolute", top: "50px", left: "50px", fontSize: "100px", opacity: 0.05 }}>🏆</div>
                <div style={{ position: "absolute", bottom: "50px", right: "50px", fontSize: "100px", opacity: 0.05 }}>🎓</div>
                
                <h1 style={{ fontSize: "56px", fontWeight: 900, color: "#d97706", margin: "0 0 15px", letterSpacing: "2px" }}>{t.bestTrainerTitle}</h1>
                <p style={{ fontSize: "20px", color: "#64748b", fontWeight: 800, margin: "0 0 50px", textTransform: "uppercase", letterSpacing: "1.5px" }}>{t.bestTrainerSub}</p>
                
                <p style={{ fontSize: "24px", color: "#0f172a", fontWeight: 700, margin: "0 0 25px" }}>{t.certText1}</p>
                <h2 style={{ fontSize: "56px", fontWeight: 900, color: "#10b981", margin: "0 0 25px", textDecoration: "underline", textDecorationColor: "rgba(16,185,129,0.3)", textUnderlineOffset: "12px" }}>{bestTeacher.trainer}</h2>
                
                <p style={{ fontSize: "22px", color: "#334155", fontWeight: 700, maxWidth: "750px", margin: "0 auto 40px", lineHeight: "1.9" }}>
                  {t.certText2} <b style={{ color: "#d97706", fontSize: "30px", margin: "0 6px" }}>{bestTeacher.avg.toFixed(2)}/5</b> {t.certText3} <b style={{ color: "#2563eb", fontSize: "28px", margin: "0 6px" }}>{bestTeacher.code}</b>. {t.certText4}
                </p>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "80px", padding: "0 60px" }}>
                  <div style={{ textAlign: "center", borderTop: "3px solid #cbd5e1", paddingTop: "15px", width: "220px" }}>
                    <b style={{ fontSize: "18px", color: "#0f172a", fontWeight: 900 }}>إدارة الجودة والتقييم</b>
                  </div>
                  <div style={{ width: "140px", height: "140px", background: "url('https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Seal_of_approval.svg/512px-Seal_of_approval.svg.png') center/cover", filter: "hue-rotate(160deg) saturate(2)" }} />
                  <div style={{ textAlign: "center", borderTop: "3px solid #cbd5e1", paddingTop: "15px", width: "220px" }}>
                    <b style={{ fontSize: "18px", color: "#0f172a", fontWeight: 900 }}>تاريخ الإصدار</b>
                    <div style={{ fontSize: "18px", color: "#64748b", fontWeight: 800, marginTop: "8px" }}>{new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "cert" && !bestTeacher && <div className="card"><p style={{textAlign:"center", padding:50, fontSize: 18, fontWeight: 700, color: "#94a3b8"}}>لا توجد بيانات كافية لإصدار الشهادة حالياً.</p></div>}

        </div>
      </div>
    </div>
  );
}

// ==========================================
// المكونات التفاعلية المتقدمة (Gauge Chart)
// ==========================================
function GaugeChart({ score, color }: { score: number; color: string }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ textAlign: "center", position: "relative", height: "90px", width: "160px", margin: "0 auto" }}>
      <svg width="160" height="90" viewBox="0 0 160 90">
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#f1f5f9" strokeWidth="18" strokeLinecap="round" />
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset} style={{ transition: "stroke-dashoffset 1.5s ease-out" }} />
      </svg>
      <div style={{ position: "absolute", bottom: "-5px", left: "0", right: "0", fontSize: "32px", fontWeight: "900", color: "#0f172a" }}>{score ? score.toFixed(2) : "0.00"}</div>
    </div>
  );
}
