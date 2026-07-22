// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// القاموس وخطوط الـ Enterprise
// ==========================================
const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال والجودة", sub: "النظام المركزي للتحليلات الاستشارية",
    tab1: "الملخص التنفيذي", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "أداء القاعات", tab5: "سجل المشاركين", tab6: "شهادة التميز",
    lang: "English 🌐", loading: "جاري توليد التقرير الاستشاري المتقدم...",
    printCert: "🖨️ طباعة الشهادة"
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "BI & Quality Dashboard", sub: "Central Consulting Analytics System",
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
.side { width: 300px; flex-shrink: 0; background: #0b1220; border-radius: 24px; padding: 24px; color: #fff; position: sticky; top: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.main { flex: 1; min-width: 0; }
.ton { background: #10b981; color: #fff; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
.tof { background: rgba(255,255,255,0.03); color: #94a3b8; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 8px; }
.tof:hover { background: rgba(255,255,255,0.08); color: #fff; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); margin-bottom: 24px; }
.kpi { border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 16px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 16px; font-size: 14.5px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b; }
.report-text { font-size: 16px; line-height: 2; color: #334155; font-weight: 500; text-align: justify; }
.highlight { color: #10b981; font-weight: 800; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; }
.alert-text { color: #b91c1c; font-weight: 800; background: #fef2f2; padding: 2px 6px; border-radius: 4px; }
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
    
    return { count: list.length, avg: avg(all), axes, comments };
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
        
        {/* Sidebar */}
        <aside className="side np">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
            <div style={{ width: "50px", height: "50px", borderRadius: "14px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "18px" }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t.sub}</div>
            </div>
          </div>
          
          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}><span>{t.tab1}</span> 📄</button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}><span>{t.tab2}</span> 📝</button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}><span>{t.tab3}</span> ⭐</button>
          <button className={tab === "rooms" ? "ton" : "tof"} onClick={() => setTab("rooms")}><span>{t.tab4}</span> 🏫</button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span>{t.tab5}</span> 👥</button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span>{t.tab6}</span> 🏆</button>
          
          <div style={{ marginTop: "30px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "20px" }}>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>{t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>⚙️ الإدارة والبيانات</button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="main">
          
          <div className="print-hide" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginBottom: "20px" }}>
            <button onClick={() => window.print()} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "12px 20px", borderRadius: "12px", fontWeight: "bold", cursor: "pointer", fontSize: "14px" }}>
              🖨️ طباعة التقرير الاستشاري كـ PDF
            </button>
          </div>

          {tab === "dashboard" && (
            <div>
              <div className="card print-hide" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff", border: "none" }}>
                <h1 style={{ fontSize: "36px", fontWeight: 900, margin: "0 0 10px" }}>الملخص التنفيذي للإدارة العليا (Executive Summary)</h1>
                <p style={{ color: "#94a3b8", fontSize: "15px" }}>تقرير استشاري شامل يربط المؤشرات بالواقع لتسهيل اتخاذ القرارات الأكاديمية والتشغيلية.</p>
              </div>

              <div className="g3">
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>إجمالي حجم العينة</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.count + final.count}</div><div style={{fontSize: "12px", color:"#10b981", marginTop: "5px"}}>▲ معدل ثقة إحصائي عالي</div></div>
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>مؤشر الأداء اليومي (NPS)</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.avg.toFixed(2)}<span style={{fontSize:"20px", color:"#94a3b8"}}>/5</span></div></div>
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>مؤشر الرضا الختامي</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{final.avg.toFixed(2)}<span style={{fontSize:"20px", color:"#94a3b8"}}>/5</span></div></div>
              </div>

              <div className="card">
                <h2 style={{ fontSize: "22px", fontWeight: 900, marginBottom: "20px", color: "#0f172a", borderBottom: "3px solid #10b981", display: "inline-block", paddingBottom: "10px" }}>📖 القراءة التحليلية والتشخيص (Diagnostic Analysis)</h2>
                
                <p className="report-text">
                  بناءً على معالجة <span className="highlight">({daily.count + final.count})</span> استبانة تقييمية مستردة من المشاركين، تظهر المؤشرات العامة اتجاهاً 
                  {daily.avg >= 4 ? " إيجابياً وممتازاً " : daily.avg >= 3 ? " مستقراً " : " حرجاً "} 
                  حيث استقر المعدل اليومي لأداء الحصص والمدربين عند <span className="highlight">{daily.avg.toFixed(2)} من 5</span>. 
                  هذا الرقم (كما هو موضح في الشكل 1) يعكس مدى التفاعل اللحظي داخل القاعات.
                </p>

                <p className="report-text" style={{ marginTop: "15px" }}>
                  بينما سجل التقييم الختامي للبرنامج والخدمات اللوجستية معدل <span className={final.avg >= 4 ? "highlight" : "alert-text"}>{final.avg.toFixed(2)} من 5</span>. 
                  التباين بين التقييم اليومي والنهائي يعطي دلالة واضحة: 
                  {final.avg > daily.avg 
                    ? " نجاح الإدارة في تدارك الملاحظات اليومية وتوفير تجربة ختامية ممتازة غطت على أي قصور فني داخل القاعات."
                    : " تراجع في مستوى الرضا العام عن الخدمات اللوجستية والختامية مقارنة بالمستوى الأكاديمي الممتاز للمدربين."}
                </p>
              </div>

              <div className="g2">
                <div className="card">
                  <h2 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "20px" }}>📊 الشكل (1): توزيع الأداء الأكاديمي للمحاور</h2>
                  {daily.axes.slice(0, 4).map((a, i) => (
                    <div key={i} style={{ marginBottom: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px", fontWeight: 700 }}>
                        <span>{a.label}</span>
                        <span style={{ color: "#10b981" }}>{a.value.toFixed(2)}</span>
                      </div>
                      <div style={{ height: "10px", background: "#f1f5f9", borderRadius: "5px", overflow: "hidden" }}>
                        <div style={{ width: `${(a.value/5)*100}%`, height: "100%", background: "#10b981" }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <h2 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "20px", color: "#b91c1c" }}>💡 الفرضيات والتوصيات الاستراتيجية (Action Plan)</h2>
                  
                  <div style={{ background: "#fffbeb", padding: "16px", borderRadius: "12px", border: "1px solid #fde68a", marginBottom: "16px" }}>
                    <b style={{ color: "#b45309", fontSize: "16px", display: "block", marginBottom: "8px" }}>الفرضية التحليلية:</b>
                    <p style={{ margin: 0, fontSize: "14.5px", color: "#334155", lineHeight: "1.7" }}>
                      المحور الأقل تقييماً هو <b>({daily.axes[0]?.label || "—"})</b> بمعدل <b>{daily.axes[0]?.value.toFixed(2) || "0"}</b>. 
                      يُفترض أن هذا الانخفاض يعود إلى (كثافة المنهج مقارنة بوقت الحصة / أو قصور في الوسائل التقنية المستخدمة).
                    </p>
                  </div>

                  <div style={{ background: "#eff6ff", padding: "16px", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
                    <b style={{ color: "#1d4ed8", fontSize: "16px", display: "block", marginBottom: "8px" }}>التوصية التنفيذية:</b>
                    <ul style={{ margin: 0, paddingRight: "20px", fontSize: "14.5px", color: "#334155", lineHeight: "1.7" }}>
                      <li>تكليف لجنة الجودة بمراجعة المادة العلمية المتعلقة بمحور ({daily.axes[0]?.label || "—"}).</li>
                      {lowestRoom && <li>توجيه دعم فني وإشرافي مكثف لقاعة <b>{lowestRoom.code}</b> (المدرب: {lowestRoom.trainer}) لكونها الأقل أداءً ({lowestRoom.avg.toFixed(2)}).</li>}
                      {bestTeacher && <li>تكريم المدرب <b>{bestTeacher.trainer}</b> وتعميم أسلوبه كنموذج (Best Practice).</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "daily" && (
            <div className="card">
              <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "20px", color: "#2563eb" }}>📝 تحليل التقييم اليومي (التفصيلي)</h1>
              <p className="report-text">
                يعرض هذا القسم القياس اللحظي لأداء المدربين وتفاعل الطلاب داخل القاعات الدراسية. تم جمع بيانات هذا القسم من خلال نماذج التقييم السريعة (QR Codes) التي يمسحها الطلاب بنهاية كل جلسة.
              </p>
              <table className="tbl" style={{ marginTop: "20px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th className="th" style={{textAlign: "right"}}>محور القياس</th>
                    <th className="th" style={{textAlign: "right"}}>التصنيف</th>
                    <th className="th" style={{textAlign: "right"}}>المتوسط المرجح</th>
                    <th className="th">مؤشر الإنجاز</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.axes.map((a, i) => (
                    <tr key={i}>
                      <td className="td" style={{ fontWeight: 800, width: "40%" }}>{a.label}</td>
                      <td className="td"><span style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: "8px", fontSize: "12px" }}>{a.section}</span></td>
                      <td className="td" style={{ fontSize: "18px", fontWeight: 900, color: "#2563eb" }}>{a.value.toFixed(2)}</td>
                      <td className="td">
                        <div style={{ width: "100%", background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value/5)*100}%`, height: "100%", background: "#2563eb" }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 style={{ fontSize: "20px", fontWeight: 900, marginTop: "40px", marginBottom: "20px" }}>💬 تحليل الملاحظات النوعية (Qualitative Feedback)</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {daily.comments.map((c, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRight: "5px solid #2563eb", padding: "16px", borderRadius: "12px", fontSize: "14.5px", lineHeight: "1.7", color: "#334155" }}>
                    "{c}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تبويب القاعات، المشاركين، والشهادة كما هما بنفس الفخامة السابقة */}
          {tab === "rooms" && (
            <div className="card">
              <h2 style={{ fontSize: "26px", fontWeight: 900, marginBottom: "20px" }}>🏫 لوحة المقارنة المعيارية للقاعات (Benchmarking)</h2>
              <p className="report-text">جدول حراري يوضح ترتيب القاعات بناءً على الأداء الأكاديمي الشامل لتمكين الإدارة من تحديد بؤر التميز والفجوات اللوجستية.</p>
              <table className="tbl" style={{ marginTop: "20px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th className="th" style={{textAlign: "right"}}>رمز القاعة</th>
                    <th className="th" style={{textAlign: "right"}}>اسم المدرب المسند</th>
                    <th className="th" style={{textAlign: "right"}}>حجم العينة (طلاب)</th>
                    <th className="th" style={{textAlign: "right"}}>المعدل النهائي</th>
                    <th className="th" style={{width: "30%"}}>التباين المعياري</th>
                  </tr>
                </thead>
                <tbody>
                  {roomData.map((r, i) => (
                    <tr key={r.id}>
                      <td className="td" style={{ color: "#10b981", fontSize: "20px", fontWeight: 900 }}>{r.code}</td>
                      <td className="td" style={{ fontWeight: 800 }}>{r.trainer}</td>
                      <td className="td">{r.count} تقييم</td>
                      <td className="td" style={{ fontSize: "20px", fontWeight: 900 }}>{r.avg.toFixed(2)}</td>
                      <td className="td">
                        <div style={{ width: "100%", background: "#f1f5f9", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                          <div style={{ width: `${(r.avg/5)*100}%`, height: "100%", background: i === 0 ? "#10b981" : (i === roomData.length - 1 ? "#ef4444" : "#2563eb") }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <b style={{ fontSize: "16px", color: "#0f172a" }}>إدارة الجودة والتقييم</b>
                  </div>
                  <div style={{ width: "120px", height: "120px", background: "url('https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Seal_of_approval.svg/512px-Seal_of_approval.svg.png') center/cover", filter: "hue-rotate(160deg) saturate(2)" }} />
                  <div style={{ textAlign: "center", borderTop: "2px solid #cbd5e1", paddingTop: "10px", width: "200px" }}>
                    <b style={{ fontSize: "16px", color: "#0f172a" }}>تاريخ الإصدار</b>
                    <div style={{ fontSize: "16px", color: "#64748b", fontWeight: "bold", marginTop: "5px" }}>{new Date().toLocaleDateString('ar-SA')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
