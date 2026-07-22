// @ts-nocheck
"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// القاموس ثنائي اللغة (Bilingual Dictionary)
// ==========================================
const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة الأداء والجودة", sub: "النظام المركزي الموحد",
    tab1: "نظرة شاملة", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "أداء القاعات", tab5: "سجل المشاركين", tab6: "شهادة التميز",
    totalRes: "إجمالي الاستجابات", dailySat: "الرضا اليومي", finalSat: "الرضا النهائي",
    compareRooms: "مقارنة أداء القاعات التدريبية", room: "القاعة", trainer: "المدرب", score: "المعدل",
    printCert: "🖨️ طباعة الشهادة", lang: "English 🌐", loading: "جاري تحميل التحليلات المتقدمة...",
    bestTrainerTitle: "شـهـادة تـمـيـز وإشـادة", bestTrainerSub: "يُمنح هذا التكريم لأفضل عضو هيئة تدريس للأسبوع الحالي",
    certText1: "تشهد إدارة الجودة والتقييم بأن", certText2: "قد حقق أعلى معدل أداء أكاديمي وتقييم من المتدربين بمتوسط",
    certText3: "في قاعة", certText4: "نتمنى له دوام التوفيق والنجاح.",
    rosterTitle: "سجل الحضور والمشاركين", name: "الاسم", email: "البريد", phone: "الجوال",
    noData: "لا توجد بيانات متاحة."
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "Quality & Perf.", sub: "Unified Central System",
    tab1: "Overview", tab2: "Daily Report", tab3: "Final Report", tab4: "Rooms Perf.", tab5: "Participants", tab6: "Certificate",
    totalRes: "Total Responses", dailySat: "Daily Sat.", finalSat: "Final Sat.",
    compareRooms: "Classrooms Performance Comparison", room: "Room", trainer: "Trainer", score: "Score",
    printCert: "🖨️ Print Certificate", lang: "عربي 🌐", loading: "Loading advanced analytics...",
    bestTrainerTitle: "CERTIFICATE OF EXCELLENCE", bestTrainerSub: "Awarded to the top performing faculty member of the week",
    certText1: "The Quality & Evaluation Dept. certifies that", certText2: "has achieved the highest academic performance & trainee rating with an average of",
    certText3: "in room", certText4: "We wish them continued success.",
    rosterTitle: "Participants Roster", name: "Name", email: "Email", phone: "Phone",
    noData: "No data available."
  }
};

// ==========================================
// الأنماط البصرية (Enterprise UI)
// ==========================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Inter:wght@400;600;800&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.rw { background: #f4f6f8; min-height: 100vh; padding: 24px; color: #0f172a; }
.lay { display: flex; gap: 24px; align-items: flex-start; }
.side { width: 300px; flex-shrink: 0; background: #0b1220; border-radius: 24px; padding: 24px; color: #fff; position: sticky; top: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.main { flex: 1; min-width: 0; }
.ton { background: #10b981; color: #fff; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
.tof { background: rgba(255,255,255,0.03); color: #94a3b8; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 8px; }
.tof:hover { background: rgba(255,255,255,0.08); color: #fff; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 26px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); }
.kpi { position: relative; overflow: hidden; border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 16px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 16px; font-size: 14.5px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b; }
.cert-wrap { background: #fff; padding: 40px; border-radius: 20px; border: 15px solid #0f172a; outline: 4px solid #d97706; outline-offset: -12px; position: relative; text-align: center; }

@media(max-width: 950px){ .lay { flex-direction: column; } .side { width: 100%; position: static; } .g2, .g3 { grid-template-columns: 1fr; } }
@media print { 
  @page { size: A4 landscape; margin: 0; }
  body, .rw { background: #fff !important; padding: 0 !important; margin: 0 !important; }
  .side, .print-hide { display: none !important; }
  .lay { display: block !important; }
  .card { box-shadow: none !important; border: none !important; padding: 0 !important; }
  .cert-wrap { height: 95vh; display: flex; flex-direction: column; justify-content: center; border: 20px solid #0f172a !important; outline: 5px solid #d97706 !important; outline-offset: -15px !important; }
}
`;

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
    setMounted(true);
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
  }, []);

  // الحسابات الأساسية
  const calc = (kind) => {
    const list = rows.filter(r => r?.kind === kind);
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const all = list.map(r => Number(r.overall_rating)).filter(v => v > 0);
    return { count: list.length, avg: avg(all) };
  };

  const daily = useMemo(() => calc("DAILY"), [rows]);
  const final = useMemo(() => calc("FINAL"), [rows]);

  // أداء القاعات وسجل المشاركين
  const roomData = useMemo(() => {
    return classrooms.map(c => {
      const tObj = trainers.find(x => x.id === c.trainer_id);
      const evs = rows.filter(r => r.classroom_id === c.id);
      const avg = evs.length ? evs.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / evs.length : 0;
      
      // استخراج سجل الطلاب من التقييمات
      const students = evs.map(e => ({ name: e.guest_name, email: e.guest_email, phone: e.guest_phone })).filter(s => s.name);
      // إزالة التكرار
      const uniqueStudents = Array.from(new Set(students.map(s => s.email))).map(email => students.find(s => s.email === email));

      return { id: c.id, code: c.code, trainer: tObj?.name || "—", count: evs.length, avg, students: uniqueStudents };
    }).filter(c => c.count > 0).sort((a, b) => b.avg - a.avg);
  }, [classrooms, trainers, rows]);

  const bestTeacher = useMemo(() => {
    if (!roomData.length) return null;
    return roomData[0]; // أفضل قاعة/مدرب
  }, [roomData]);

  if (!mounted || load) return <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div style={{ width: 60, height: 60, border: "6px solid #e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }}/></div>;

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        
        {/* Sidebar */}
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
            <div style={{ width: "50px", height: "50px", borderRadius: "14px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "18px" }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t.sub}</div>
            </div>
          </div>
          
          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}><span>{t.tab1}</span> 🏠</button>
          <button className={tab === "rooms" ? "ton" : "tof"} onClick={() => setTab("rooms")}><span>{t.tab4}</span> 🏫</button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span>{t.tab5}</span> 👥</button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span>{t.tab6}</span> 🏆</button>
          
          <div style={{ marginTop: "30px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "20px" }}>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>{t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>⚙️ Management</button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="main">
          
          {tab === "dashboard" && (
            <div>
              <div className="card print-hide" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff" }}>
                <h1 style={{ fontSize: "32px", fontWeight: 900, margin: "0 0 8px" }}>{t.tab1}</h1>
              </div>
              <div className="g3">
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>{t.totalRes}</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.count + final.count}</div></div>
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>{t.dailySat}</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.avg ? daily.avg.toFixed(2) : "0"}<span style={{fontSize:"20px", color:"#94a3b8"}}>/5</span></div></div>
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>{t.finalSat}</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{final.avg ? final.avg.toFixed(2) : "0"}<span style={{fontSize:"20px", color:"#94a3b8"}}>/5</span></div></div>
              </div>
            </div>
          )}

          {tab === "rooms" && (
            <div className="card">
              <h2 style={{ fontSize: "22px", fontWeight: 900, marginBottom: "20px" }}>{t.compareRooms}</h2>
              <table className="tbl">
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.room}</th>
                    <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.trainer}</th>
                    <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.totalRes}</th>
                    <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.score}</th>
                    <th className="th" style={{width: "40%"}}></th>
                  </tr>
                </thead>
                <tbody>
                  {roomData.map((r, i) => (
                    <tr key={r.id}>
                      <td className="td" style={{ color: "#10b981", fontSize: "18px", fontWeight: 900 }}>{r.code}</td>
                      <td className="td">{r.trainer}</td>
                      <td className="td">{r.count}</td>
                      <td className="td" style={{ fontSize: "18px", fontWeight: 900 }}>{r.avg.toFixed(2)}</td>
                      <td className="td">
                        <div style={{ width: "100%", background: "#f1f5f9", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                          <div style={{ width: `${(r.avg/5)*100}%`, height: "100%", background: i === 0 ? "#10b981" : "#2563eb", borderRadius: "6px" }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {roomData.length === 0 && <tr><td colSpan="5" className="td" style={{textAlign:"center"}}>{t.noData}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "participants" && (
            <div className="card">
              <h2 style={{ fontSize: "22px", fontWeight: 900, marginBottom: "20px" }}>{t.rosterTitle}</h2>
              {roomData.map(r => (
                <div key={r.id} style={{ marginBottom: "30px" }}>
                  <div style={{ background: "#f8fafc", padding: "12px 20px", borderRadius: "12px", display: "flex", gap: "20px", alignItems: "center", marginBottom: "10px", borderLeft: "5px solid #2563eb" }}>
                    <b style={{ fontSize: "18px" }}>{t.room} {r.code}</b>
                    <span style={{ color: "#64748b", fontWeight: 700 }}>{t.trainer}: {r.trainer}</span>
                    <span style={{ background: "#d1fae5", color: "#047857", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800 }}>{r.students.length} طلاب</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="tbl">
                      <thead>
                        <tr><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.name}</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.phone}</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.email}</th></tr>
                      </thead>
                      <tbody>
                        {r.students.map((s, i) => (
                          <tr key={i}>
                            <td className="td">{s.name || "—"}</td>
                            <td className="td" style={{direction:"ltr", textAlign:t.dir==='rtl'?'right':'left'}}>{s.phone || "—"}</td>
                            <td className="td" style={{direction:"ltr", textAlign:t.dir==='rtl'?'right':'left'}}>{s.email || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {roomData.length === 0 && <p style={{textAlign:"center", color:"#94a3b8"}}>{t.noData}</p>}
            </div>
          )}

          {tab === "cert" && bestTeacher && (
            <div>
              <button onClick={() => window.print()} className="print-hide" style={{ background: "#0f172a", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: 800, cursor: "pointer", marginBottom: "20px" }}>
                {t.printCert}
              </button>
              
              <div className="card cert-wrap">
                <div style={{ position: "absolute", top: "40px", left: "40px", fontSize: "80px", opacity: 0.1 }}>🏆</div>
                <div style={{ position: "absolute", bottom: "40px", right: "40px", fontSize: "80px", opacity: 0.1 }}>🎓</div>
                
                <h1 style={{ fontSize: "52px", fontWeight: 900, color: "#d97706", margin: "0 0 10px", letterSpacing: "2px" }}>{t.bestTrainerTitle}</h1>
                <p style={{ fontSize: "18px", color: "#64748b", fontWeight: 700, margin: "0 0 40px", textTransform: "uppercase", letterSpacing: "1px" }}>{t.bestTrainerSub}</p>
                
                <p style={{ fontSize: "22px", color: "#0f172a", fontWeight: 600, margin: "0 0 20px" }}>{t.certText1}</p>
                <h2 style={{ fontSize: "48px", fontWeight: 900, color: "#10b981", margin: "0 0 20px", textDecoration: "underline", textDecorationColor: "rgba(16,185,129,0.3)", textUnderlineOffset: "10px" }}>{bestTeacher.trainer}</h2>
                
                <p style={{ fontSize: "20px", color: "#334155", fontWeight: 600, maxWidth: "700px", margin: "0 auto 30px", lineHeight: "1.8" }}>
                  {t.certText2} <b style={{ color: "#d97706", fontSize: "26px" }}>{bestTeacher.avg.toFixed(2)}/5</b> {t.certText3} <b style={{ color: "#2563eb", fontSize: "24px" }}>{bestTeacher.code}</b>. {t.certText4}
                </p>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "60px", padding: "0 50px" }}>
                  <div style={{ textAlign: "center", borderTop: "2px solid #cbd5e1", paddingTop: "10px", width: "200px" }}>
                    <b style={{ fontSize: "16px", color: "#0f172a" }}>إدارة التدريب</b>
                  </div>
                  <div style={{ width: "120px", height: "120px", background: "url('https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Seal_of_approval.svg/512px-Seal_of_approval.svg.png') center/cover", filter: "hue-rotate(160deg) saturate(2)" }} />
                  <div style={{ textAlign: "center", borderTop: "2px solid #cbd5e1", paddingTop: "10px", width: "200px" }}>
                    <b style={{ fontSize: "16px", color: "#0f172a" }}>التاريخ</b>
                    <div style={{ fontSize: "14px", color: "#64748b" }}>{new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {tab === "cert" && !bestTeacher && <div className="card"><p style={{textAlign:"center", padding:50}}>{t.noData}</p></div>}

        </div>
      </div>
    </div>
  );
}
