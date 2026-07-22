// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال", sub: "النظام المركزي للتحليلات",
    tab1: "الملخص التنفيذي", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "أداء القاعات", tab5: "سجل المشاركين", tab6: "شهادة التميز",
    lang: "English 🌐", loading: "جاري توليد التقرير الاستشاري والمؤشرات البصرية...",
    printCert: "🖨️ طباعة الشهادة",
    bestTrainerTitle: "شـهـادة تـمـيـز وإشـادة", bestTrainerSub: "يُمنح هذا التكريم لأفضل عضو هيئة تدريس للأسبوع الحالي",
    certText1: "تشهد إدارة الجودة والتقييم بأن", certText2: "قد حقق أعلى معدل أداء أكاديمي بمتوسط",
    certText3: "في قاعة", certText4: "نتمنى له دوام التوفيق والنجاح.",
    rosterTitle: "سجل الحضور والمشاركين", name: "الاسم", email: "البريد", phone: "الجوال", noData: "لا توجد بيانات متاحة."
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "BI Dashboard", sub: "Central Analytics System",
    tab1: "Executive Summary", tab2: "Daily Report", tab3: "Final Report", tab4: "Rooms Perf.", tab5: "Participants", tab6: "Certificate",
    lang: "عربي 🌐", loading: "Generating advanced consulting report...",
    printCert: "🖨️ Print Certificate",
    bestTrainerTitle: "CERTIFICATE OF EXCELLENCE", bestTrainerSub: "Awarded to the top performing faculty member",
    certText1: "The Quality Dept. certifies that", certText2: "has achieved the highest academic performance with an average of",
    certText3: "in room", certText4: "We wish them continued success.",
    rosterTitle: "Participants Roster", name: "Name", email: "Email", phone: "Phone", noData: "No data available."
  }
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Inter:wght@400;600;800&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.rw { background: #f4f6f8; min-height: 100vh; padding: 24px; color: #0f172a; }
.lay { display: flex; gap: 24px; align-items: flex-start; }
.side { width: 310px; flex-shrink: 0; background: #0b1220; border-radius: 24px; padding: 24px; color: #fff; position: sticky; top: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.main { flex: 1; min-width: 0; }
.ton { background: #10b981; color: #fff; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
.tof { background: rgba(255,255,255,0.03); color: #94a3b8; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 8px; }
.tof:hover { background: rgba(255,255,255,0.08); color: #fff; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 26px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); margin-bottom: 24px; }
.kpi { border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 16px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 16px; font-size: 14.5px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b; }
.cert-wrap { background: #fff; padding: 40px; border-radius: 20px; border: 15px solid #0f172a; outline: 4px solid #d97706; outline-offset: -12px; position: relative; text-align: center; }

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
  if (score >= 4.5) return "أداء استثنائي يعكس بيئة تدريبية محفزة ومحتوى عالي الجودة يلبي التوقعات.";
  if (score >= 4.0) return "أداء متقدم ومستقر يحقق الأهداف المطلوبة.";
  if (score >= 3.0) return "أداء متوسط يتطلب مراجعة وتدخلاً لرفع مستوى الرضا.";
  if (score > 0) return "أداء حرج يستدعي تدخلاً إدارياً فورياً وإعادة تقييم شاملة.";
  return "لا توجد بيانات كافية لاستخراج تفسير تحليلي.";
}

function statusOf(v) {
  const val = Number(v) || 0;
  if (val >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (val >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "تدخل مطلوب", bg: "#fee2e2", fg: "#b91c1c" };
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function GaugeChart({ score, color }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ textAlign: "center", position: "relative", height: "90px", width: "160px", margin: "0 auto" }}>
      <svg width="160" height="90" viewBox="0 0 160 90">
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#f1f5f9" strokeWidth="18" strokeLinecap="round" />
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isNaN(strokeDashoffset) ? circumference : strokeDashoffset} />
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

  useEffect(() => {
    setMounted(true); let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      const [e, a, q, c, tr] = await Promise.all([
        db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("classrooms").select("*"),
        db.from("trainers").select("*")
      ]);
      setRows(e.data || []); setAns(a.data || []); setQs(q.data || []);
      setClassrooms(c.data || []); setTrainers(tr.data || []);
      setLoad(false);
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
    const all = list.map(r => Number(r.overall_rating)).filter(v => v > 0);
    const comments = [];
    ans.forEach(a => { if (a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim()) comments.push(a.text_value.trim()); });
    
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

  const bestTeacher = roomData.length ? roomData[0] : null;
  const lowestRoom = roomData.length > 1 ? roomData[roomData.length - 1] : null;

  if (!mounted || load) return <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div style={{ width: 60, height: 60, border: "6px solid #e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }}/></div>;

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
            <div style={{ width: "50px", height: "50px", borderRadius: "14px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "18px" }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t.sub}</div>
            </div>
          </div>
          
          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}><span>{t.tab1}</span> 🏠</button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}><span>{t.tab2}</span> 📝</button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}><span>{t.tab3}</span> ⭐</button>
          <button className={tab === "rooms" ? "ton" : "tof"} onClick={() => setTab("rooms")}><span>{t.tab4}</span> 🏫</button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span>{t.tab5}</span> 👥</button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span>{t.tab6}</span> 🏆</button>
          
          <div style={{ marginTop: "30px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "20px" }}>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>{t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>⚙️ الإدارة</button>
          </div>
        </aside>

        <div className="main">
          {tab === "dashboard" && (
            <div>
              <div className="card print-hide" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff", border: "none" }}>
                <span style={{ background: "rgba(255,255,255,0.1)", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, marginBottom: "12px", display: "inline-block" }}>تقرير استشاري ذكي</span>
                <h1 style={{ fontSize: "36px", fontWeight: 900, margin: "0 0 10px" }}>الملخص التنفيذي للإدارة العليا</h1>
                <p style={{ color: "#94a3b8", fontSize: "15px" }}>تقرير استشاري شامل يربط المؤشرات بالواقع لتسهيل اتخاذ القرارات.</p>
              </div>

              <div className="g3">
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>حجم العينة</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.count + final.count}</div></div>
                <div className="card kpi" style={{ textAlign: "center" }}><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800, marginBottom: "14px" }}>الرضا اليومي</div><GaugeChart score={daily.avg} color={BLUE} /></div>
                <div className="card kpi" style={{ textAlign: "center" }}><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800, marginBottom: "14px" }}>الرضا الختامي</div><GaugeChart score={final.avg} color={TEAL} /></div>
              </div>

              <div className="card">
                <h2 style={{ fontSize: "22px", fontWeight: 900, marginBottom: "20px", color: "#0f172a", borderBottom: "3px solid #10b981", display: "inline-block", paddingBottom: "10px" }}>📖 القراءة التحليلية والتشخيص</h2>
                <p className="report-text">بناءً على معالجة ({daily.count + final.count}) استبانة تقييمية مستردة من المشاركين، تظهر المؤشرات العامة اتجاهاً {daily.avg >= 4 ? " إيجابياً وممتازاً " : daily.avg >= 3 ? " مستقراً " : " حرجاً "} حيث استقر المعدل اليومي لأداء الحصص والمدربين عند {daily.avg.toFixed(2)} من 5.</p>
                <p className="report-text" style={{ marginTop: "15px" }}>بينما سجل التقييم الختامي للبرنامج معدل {final.avg.toFixed(2)} من 5. {getInterpretation(final.avg)}</p>
              </div>

              <div className="g2">
                <div className="card">
                  <h2 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "20px", color: "#b91c1c" }}>💡 الفرضيات والتوصيات الاستراتيجية</h2>
                  <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "12px", border: "1px solid #fde68a", marginBottom: "16px" }}>
                    <b style={{ color: "#b45309", fontSize: "16px", display: "block", marginBottom: "8px" }}>الفرضية التحليلية:</b>
                    <p style={{ margin: 0, fontSize: "14.5px", color: "#334155", lineHeight: "1.7" }}>
                      المحور الأقل تقييماً هو <b>({daily.axes[0]?.label || "—"})</b> بمعدل <b>{daily.axes[0]?.value.toFixed(2) || "0"}</b>. يُفترض أن هذا الانخفاض يعود إلى (كثافة المنهج أو قصور في الوسائل التقنية).
                    </p>
                  </div>
                  <div style={{ background: "#eff6ff", padding: "16px", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
                    <b style={{ color: "#1d4ed8", fontSize: "16px", display: "block", marginBottom: "8px" }}>التوصية التنفيذية:</b>
                    <ul style={{ margin: 0, paddingRight: "20px", fontSize: "14.5px", color: "#334155", lineHeight: "1.7" }}>
                      <li>مراجعة المادة العلمية المتعلقة بمحور ({daily.axes[0]?.label || "—"}).</li>
                      {lowestRoom && <li>توجيه دعم فني إشرافي لقاعة <b>{lowestRoom.code}</b> لكونها الأقل أداءً ({lowestRoom.avg.toFixed(2)}).</li>}
                    </ul>
                  </div>
                </div>

                <div className="card">
                  <h2 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "20px" }}>📊 ترتيب القاعات الحالي</h2>
                  {roomData.map((r, i) => (
                    <div key={r.id} style={{ marginBottom: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "15px", fontWeight: 800 }}>
                        <span>قاعة {r.code}</span><span style={{ color: i === 0 ? "#10b981" : "#334155" }}>{r.avg.toFixed(2)}</span>
                      </div>
                      <div style={{ height: "12px", background: "#f1f5f9", borderRadius: "6px", overflow: "hidden" }}><div style={{ width: `${(r.avg/5)*100}%`, height: "100%", background: i === 0 ? "#10b981" : (i === roomData.length - 1 ? "#ef4444" : "#2563eb") }} /></div>
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
            const chartH = 120; const chartW = 340; const stepX = chartW / 6;
            const maxD = Math.max(1, ...(r.days || []).map((d) => d?.count || 0));
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
                    <h3 style={{ margin: "0 0 24px", fontSize: "18px", fontWeight: 900 }}>📈 مسار التفاعل (Area Chart)</h3>
                    <svg viewBox={`0 -10 ${chartW + 20} ${chartH + 40}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                      <defs><linearGradient id={"areaGrad"+tab} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ac} stopOpacity="0.3"/><stop offset="100%" stopColor={ac} stopOpacity="0.0"/></linearGradient></defs>
                      <line x1="0" y1={0} x2={chartW} y2={0} stroke="#f1f5f9" strokeDasharray="4,4" />
                      <line x1="0" y1={chartH/2} x2={chartW} y2={chartH/2} stroke="#f1f5f9" strokeDasharray="4,4" />
                      <path d={pathD} fill={`url(#areaGrad${tab})`} />
                      <path d={lineD} fill="none" stroke={ac} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {(r.days || []).map((d, i) => {
                        const x = i * stepX; const y = chartH - ((d.count || 0) / maxD) * chartH;
                        return (
                          <g key={i}>
                            <circle cx={x} cy={y} r="4" fill="#fff" stroke={ac} strokeWidth="2" />
                            <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">{d.count}</text>
                            <text x={x} y={chartH + 20} textAnchor="middle" fontSize="10" fill="#64748b">{d.wd}</text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="card">
                    <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900 }}>📊 الهرم التقييمي</h3>
                    {[5, 4, 3, 2, 1].map(s => {
                      const idx = s - 1; const dv = r.dist[idx] || 0; const w = maxDi > 0 ? (dv / maxDi) * 100 : 0;
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
                            <b style={{ color: ac, fontSize: "22px", fontWeight: 900 }}>{Number(a.value || 0).toFixed(2)}</b>
                          </div>
                          <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}><div style={{ width: (Number(a.value || 0) / 5 * 100) + "%", height: "100%", background: ac }} /></div>
                        </div>
                      );
                    }) : <p style={{ color: "#9a8f7d", textAlign: "center", gridColumn: "1/-1" }}>لا توجد بيانات.</p>}
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 800 }}>💬 ملاحظات المشاركين</h3>
                  {r.comments.map((c, i) => <div key={i} style={{ background: "#f8fafc", borderRight: "4px solid "+ac, borderRadius: "12px", padding: "16px", marginBottom: "10px", fontSize: "15px", color: "#334155" }}>{c}</div>)}
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
                  </tr>
                </thead>
                <tbody>
                  {roomData.map((r, i) => (
                    <tr key={r.id}>
                      <td className="td" style={{ color: "#10b981", fontSize: "20px", fontWeight: 900 }}>{r.code}</td>
                      <td className="td" style={{ fontWeight: 800, fontSize: "16px" }}>{r.trainer}</td>
                      <td className="td" style={{ fontSize: "15px" }}>{r.count} تقييم</td>
                      <td className="td" style={{ fontSize: "20px", fontWeight: 900 }}>{r.avg.toFixed(2)}</td>
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
                  </div>
                  <table className="tbl" style={{ margin: 0 }}>
                    <thead><tr><th className="th" style={{textAlign:"right", background:"#fff"}}>الاسم</th><th className="th" style={{textAlign:"right", background:"#fff"}}>الجوال</th><th className="th" style={{textAlign:"right", background:"#fff"}}>البريد</th></tr></thead>
                    <tbody>
                      {r.students.map((s, i) => (<tr key={i}><td className="td" style={{ fontWeight: 700 }}>{s.name || "—"}</td><td className="td" style={{ direction: "ltr", textAlign: "right" }}>{s.phone || "—"}</td><td className="td" style={{ direction: "ltr", textAlign: "right", color: "#2563eb", fontWeight: 700 }}>{s.email || "—"}</td></tr>))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {tab === "cert" && bestTeacher && (
            <div>
              <button onClick={() => window.print()} className="print-hide" style={{ background: "#0f172a", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: 800, cursor: "pointer", marginBottom: "20px" }}>{t.printCert}</button>
              <div className="card cert-wrap">
                <h1 style={{ fontSize: "52px", fontWeight: 900, color: "#d97706", margin: "0 0 10px", letterSpacing: "2px" }}>{t.bestTrainerTitle}</h1>
                <p style={{ fontSize: "18px", color: "#64748b", fontWeight: 700, margin: "0 0 40px", textTransform: "uppercase" }}>{t.bestTrainerSub}</p>
                <p style={{ fontSize: "22px", color: "#0f172a", fontWeight: 600, margin: "0 0 20px" }}>{t.certText1}</p>
                <h2 style={{ fontSize: "48px", fontWeight: 900, color: "#10b981", margin: "0 0 20px", textDecoration: "underline", textDecorationColor: "rgba(16,185,129,0.3)" }}>{bestTeacher.trainer}</h2>
                <p style={{ fontSize: "20px", color: "#334155", fontWeight: 600, maxWidth: "700px", margin: "0 auto 30px", lineHeight: "1.8" }}>
                  {t.certText2} <b style={{ color: "#d97706", fontSize: "26px", margin: "0 6px" }}>{bestTeacher.avg.toFixed(2)}/5</b> {t.certText3} <b style={{ color: "#2563eb", fontSize: "24px", margin: "0 6px" }}>{bestTeacher.code}</b>. {t.certText4}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "80px", padding: "0 60px" }}>
                  <div style={{ textAlign: "center", borderTop: "3px solid #cbd5e1", paddingTop: "15px", width: "220px" }}><b style={{ fontSize: "18px", color: "#0f172a", fontWeight: 900 }}>إدارة الجودة والتقييم</b></div>
                  <div style={{ textAlign: "center", borderTop: "3px solid #cbd5e1", paddingTop: "15px", width: "220px" }}><b style={{ fontSize: "18px", color: "#0f172a", fontWeight: 900 }}>تاريخ الإصدار</b><div style={{ fontSize: "18px", color: "#64748b", fontWeight: 800, marginTop: "8px" }}>{new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</div></div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
