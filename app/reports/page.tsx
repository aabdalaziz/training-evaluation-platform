// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// القاموس ثنائي اللغة (Bilingual Dictionary)
// ==========================================
const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة الأداء والجودة", sub: "النظام المركزي الموحد",
    tab1: "نظرة شاملة", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "سجل المشاركين", tab5: "شهادة التميز", tab6: "الإشعارات والبريد",
    printCert: "🖨️ طباعة الشهادة", lang: "English 🌐", loading: "جاري تحميل التحليلات المتقدمة...",
    bestTrainerTitle: "شـهـادة تـمـيـز وإشـادة", bestTrainerSub: "يُمنح هذا التكريم لأفضل عضو هيئة تدريس للأسبوع الحالي",
    certText1: "تشهد إدارة الجودة والتقييم بأن", certText2: "قد حقق أعلى معدل أداء أكاديمي بمتوسط",
    certText3: "في قاعة", certText4: "نتمنى له دوام التوفيق والنجاح.",
    rosterTitle: "سجل الحضور والمشاركين", name: "الاسم", email: "البريد", phone: "الجوال", noData: "لا توجد بيانات متاحة."
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "Quality & Perf.", sub: "Unified Central System",
    tab1: "Overview", tab2: "Daily Report", tab3: "Final Report", tab4: "Participants", tab5: "Certificate", tab6: "Mail Hub",
    printCert: "🖨️ Print Certificate", lang: "عربي 🌐", loading: "Loading advanced analytics...",
    bestTrainerTitle: "CERTIFICATE OF EXCELLENCE", bestTrainerSub: "Awarded to the top performing faculty member",
    certText1: "The Quality Dept. certifies that", certText2: "has achieved the highest academic performance with an average of",
    certText3: "in room", certText4: "We wish them continued success.",
    rosterTitle: "Participants Roster", name: "Name", email: "Email", phone: "Phone", noData: "No data available."
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
.ton { background: #10b981; color: #fff; border: none; border-radius: 14px; padding: 12px 16px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
.tof { background: rgba(255,255,255,0.03); color: #94a3b8; border: none; border-radius: 14px; padding: 12px 16px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; transition: .2s; margin-bottom: 6px; }
.tof:hover { background: rgba(255,255,255,0.08); color: #fff; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 26px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); margin-bottom: 20px;}
.kpi { position: relative; overflow: hidden; border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
.th { padding: 16px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 16px; font-size: 14.5px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #1e293b; }
.cert-wrap { background: #fff; padding: 40px; border-radius: 20px; border: 15px solid #0f172a; outline: 4px solid #d97706; outline-offset: -12px; position: relative; text-align: center; }
.inp { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; font-family: inherit; width: 100%; margin-bottom: 15px; outline: none; }
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

function statusOf(v) {
  const val = Number(v) || 0;
  if (val >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (val >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "يحتاج تحسين", bg: "#fee2e2", fg: "#b91c1c" };
}
function pad(n) { return n < 10 ? "0" + n : "" + n; }

export default function EnterpriseReports() {
  const router = useRouter();
  const [lang, setLang] = useState("ar");
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState([]);
  const [ans, setAns] = useState([]);
  const [qs, setQs] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [load, setLoad] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [selMail, setSelMail] = useState("");
  const [busy, setBusy] = useState(false);

  const t = dict[lang];
  const db = supabase();

  const fetchAll = async () => {
    const [e, a, q, c, tr, l] = await Promise.all([
      db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
      db.from("evaluation_answers").select("*"),
      db.from("questions").select("*"),
      db.from("classrooms").select("*"),
      db.from("trainers").select("*"),
      db.from("email_logs").select("*").order("sent_at", { ascending: false })
    ]);
    setRows(e.data || []); setAns(a.data || []); setQs(q.data || []);
    setClassrooms(c.data || []); setTrainers(tr.data || []); setLogs(l.data || []);
  };

  useEffect(() => {
    setMounted(true); let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await fetchAll(); setLoad(false); }
    })();
    return () => { on = false; };
  }, []);

  const dispatchEmail = async (type, id) => {
    setBusy(true);
    try {
      let email = "admin@platform.edu.sa", name = "الإدارة التنفيذية", subject = "📋 التقرير الإداري الشامل لمؤشرات الجودة";
      if (type === "TRAINER") {
        const tr = trainers.find(x => x.id === id);
        if (!tr || !tr.email) { alert("هذا المدرب بلا بريد مسجّل"); setBusy(false); return; }
        email = tr.email; name = tr.name; subject = "📑 تقرير جودة الأداء الفردي للمدرب: " + tr.name;
      }
      await db.from("email_logs").insert({ recipient_email: email, recipient_name: name, recipient_role: type, subject, status: "sent" });
      await fetchAll();
      alert("📧 تم تسجيل إرسال التقرير إلى: " + email);
    } catch (e) { alert("تعذّر الإرسال"); }
    finally { setBusy(false); }
  };

  const calc = (kind) => {
    const list = rows.filter(r => r?.kind === kind);
    const ids = new Set(list.map(r => r.id));
    const qm = {}; qs.forEach(q => { if (q) qm[q.id] = q; });
    const avg = (arr) => arr.length ? arr.reduce((p, c) => p + c, 0) / arr.length : 0;
    
    const g = {};
    ans.forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes = Object.keys(g).map(id => ({ label: qm[id]?qm[id].text_ar:"سؤال", section: qm[id]&&qm[id].section_ar?qm[id].section_ar:"عام", value: avg(g[id]) })).sort((a, b) => b.value - a.value);
    
    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => { const v = Math.round(Number(r.overall_rating)); if (v >= 1 && v <= 5) dist[v - 1] += 1; });

    const comments = [];
    ans.forEach(a => { if (a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 8) comments.push(a.text_value.trim()); });

    const all = list.map(r => Number(r.overall_rating)).filter(v => !isNaN(v) && v > 0);
    return { count: list.length, avg: avg(all), axes, comments, dist };
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
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}><span>{t.tab2}</span> 📝</button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}><span>{t.tab3}</span> ⭐</button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}><span>{t.tab4}</span> 👥</button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}><span>{t.tab5}</span> 🏆</button>
          <button className={tab === "email" ? "ton" : "tof"} onClick={() => setTab("email")}><span>{t.tab6}</span> ✉️</button>
          
          <div style={{ marginTop: "30px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "20px" }}>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "10px" }}>{t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>⚙️ Management</button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="main">
          
          {/* Dashboard */}
          {tab === "dashboard" && (
            <div>
              <div className="g3">
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>{lang==='ar'?'الاستجابات':'Responses'}</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.count + final.count}</div></div>
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>{t.dailySat}</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{daily.avg ? daily.avg.toFixed(2) : "0"}<span style={{fontSize:"20px", color:"#94a3b8"}}>/5</span></div></div>
                <div className="card kpi"><div style={{ fontSize: "15px", color: "#64748b", fontWeight: 800 }}>{t.finalSat}</div><div style={{ fontSize: "42px", fontWeight: 900 }}>{final.avg ? final.avg.toFixed(2) : "0"}<span style={{fontSize:"20px", color:"#94a3b8"}}>/5</span></div></div>
              </div>

              <div className="card">
                <h2 style={{ fontSize: "22px", fontWeight: 900, marginBottom: "20px" }}>أداء المعلمين والقاعات</h2>
                <table className="tbl">
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.room}</th>
                      <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.trainer}</th>
                      <th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.score}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomData.map((r, i) => (
                      <tr key={r.id}>
                        <td className="td" style={{ color: "#10b981", fontSize: "18px", fontWeight: 900 }}>{r.code}</td>
                        <td className="td">{r.trainer}</td>
                        <td className="td" style={{ fontSize: "18px", fontWeight: 900 }}>{r.avg.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily & Final Reports */}
          {(tab === "daily" || tab === "final") && (() => {
            const r = tab === "daily" ? daily : final;
            const top = r.axes.length ? r.axes[r.axes.length - 1] : null;
            const low = r.axes.length ? r.axes[0] : null;
            return (
              <div>
                <div className="g2">
                  <div className="card">
                    <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 800 }}>🎯 التوزيع بالنجوم</h3>
                    {[5, 4, 3, 2, 1].map(s => {
                      const idx = s - 1; const dv = r.dist[idx] || 0; const w = Math.max(1,...r.dist) > 0 ? (dv / Math.max(1,...r.dist)) * 100 : 0;
                      return (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <span style={{ width: "55px", fontSize: "13px", fontWeight: 700 }}>{s} نجوم</span>
                          <div style={{ flex: 1, height: "12px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}><div style={{ width: (isNaN(w)?0:w)+"%", height: "100%", background: "#10b981", borderRadius: "8px" }} /></div>
                          <b style={{ width: "20px", textAlign: "left", fontSize: "14px" }}>{dv}</b>
                        </div>
                      );
                    })}
                  </div>
                  <div className="card">
                    <h3 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 800 }}>💡 التحليل الذكي والتوصيات</h3>
                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "12px", padding: "16px", marginBottom: "10px" }}><b style={{ color: "#047857", fontSize: "14px" }}>✅ نقطة القوة المتميزة</b><p style={{ margin: "4px 0 0", fontSize: "14px", color: "#334155" }}>{top ? top.label + " (" + top.value.toFixed(2) + ")" : "—"}</p></div>
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "16px" }}><b style={{ color: "#b45309", fontSize: "14px" }}>🎯 مجال التطوير المستهدف</b><p style={{ margin: "4px 0 0", fontSize: "14px", color: "#334155" }}>{low ? low.label + " (" + low.value.toFixed(2) + ")" : "—"}</p></div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 800 }}>📈 أداء المحاور التفصيلي</h3>
                  {r.axes.map((a, i) => {
                    const s = statusOf(a.value);
                    return (
                      <div key={i} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: "14px", padding: "16px", marginBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "15px", fontWeight: 700 }}>{a.label}</span>
                          <b style={{ color: "#10b981", fontSize: "16px" }}>{a.value.toFixed(2)}</b>
                        </div>
                        <div style={{ height: "12px", background: "#f1f5f9", borderRadius: "8px", overflow: "hidden" }}><div style={{ width: (a.value/5*100)+"%", height: "100%", background: "#10b981" }} /></div>
                      </div>
                    );
                  })}
                </div>

                <div className="card">
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 800 }}>💬 ملاحظات المشاركين</h3>
                  {r.comments.map((c, i) => <div key={i} style={{ background: "#f8fafc", borderRight: "4px solid #10b981", borderRadius: "12px", padding: "16px", marginBottom: "10px", fontSize: "15px", color: "#334155" }}>{c}</div>)}
                </div>
              </div>
            );
          })()}

          {/* Roster */}
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
                      <thead><tr><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.name}</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.phone}</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>{t.email}</th></tr></thead>
                      <tbody>{r.students.map((s, i) => (<tr key={i}><td className="td">{s.name || "—"}</td><td className="td" style={{direction:"ltr", textAlign:t.dir==='rtl'?'right':'left'}}>{s.phone || "—"}</td><td className="td" style={{direction:"ltr", textAlign:t.dir==='rtl'?'right':'left'}}>{s.email || "—"}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Certificate */}
          {tab === "cert" && bestTeacher && (
            <div>
              <button onClick={() => window.print()} className="print-hide" style={{ background: "#0f172a", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontWeight: 800, cursor: "pointer", marginBottom: "20px" }}>{t.printCert}</button>
              <div className="card cert-wrap">
                <div style={{ position: "absolute", top: "40px", left: "40px", fontSize: "80px", opacity: 0.1 }}>🏆</div>
                <div style={{ position: "absolute", bottom: "40px", right: "40px", fontSize: "80px", opacity: 0.1 }}>🎓</div>
                <h1 style={{ fontSize: "52px", fontWeight: 900, color: "#d97706", margin: "0 0 10px", letterSpacing: "2px" }}>{t.bestTrainerTitle}</h1>
                <p style={{ fontSize: "18px", color: "#64748b", fontWeight: 700, margin: "0 0 40px", textTransform: "uppercase", letterSpacing: "1px" }}>{t.bestTrainerSub}</p>
                <p style={{ fontSize: "22px", color: "#0f172a", fontWeight: 600, margin: "0 0 20px" }}>{t.certText1}</p>
                <h2 style={{ fontSize: "48px", fontWeight: 900, color: "#10b981", margin: "0 0 20px", textDecoration: "underline", textDecorationColor: "rgba(16,185,129,0.3)", textUnderlineOffset: "10px" }}>{bestTeacher.trainer}</h2>
                <p style={{ fontSize: "20px", color: "#334155", fontWeight: 600, maxWidth: "700px", margin: "0 auto 30px", lineHeight: "1.8" }}>{t.certText2} <b style={{ color: "#d97706", fontSize: "26px" }}>{bestTeacher.avg.toFixed(2)}/5</b> {t.certText3} <b style={{ color: "#2563eb", fontSize: "24px" }}>{bestTeacher.code}</b>. {t.certText4}</p>
              </div>
            </div>
          )}

          {/* Email Hub */}
          {tab === "email" && (
            <div>
              <div className="g2">
                <div className="card">
                  <h3 style={{ fontSize: "18px", fontWeight: 800 }}>📨 تقرير القاعة للمدرب</h3>
                  <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "16px" }}>توليد وإرسال تقرير فني مستقل وشامل لكل مدرب.</p>
                  <select className="inp" value={selMail} onChange={e=>setSelMail(e.target.value)}><option value="">— اختر المدرب —</option>{trainers.map(t=>(<option key={t.id} value={t.id}>{t.name} ({t.email||"بلا بريد"})</option>))}</select>
                  <button className="ton" style={{justifyContent:"center"}} disabled={busy||!selMail} onClick={()=>dispatchEmail("TRAINER",selMail)}>{busy?"⏳ جارٍ…":"✉️ إرسال للمدرب"}</button>
                </div>
                <div className="card" style={{ borderTop: "4px solid #0b1220" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: 800 }}>🏛️ التقرير العام للإدارة</h3>
                  <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "30px" }}>تصدير لوحة الجودة الشاملة للإدارة التنفيذية.</p>
                  <button className="ton" style={{background:"#0b1220",borderColor:"#0b1220",justifyContent:"center"}} disabled={busy} onClick={()=>dispatchEmail("ADMIN")}>{busy?"⏳ جارٍ…":"✉️ إرسال للإدارة"}</button>
                </div>
              </div>
              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 800 }}>📋 سجل الإرسال</h3>
                <table className="tbl">
                  <thead><tr style={{ background: "#f8fafc" }}><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>المستلم</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>البريد</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>الدور</th><th className="th" style={{textAlign: t.dir==='rtl'?'right':'left'}}>الحالة</th></tr></thead>
                  <tbody>{logs.map((l, i) => (<tr key={i}><td className="td">{l.recipient_name}</td><td className="td" style={{direction:"ltr",textAlign:t.dir==='rtl'?'right':'left'}}>{l.recipient_email}</td><td className="td">{l.recipient_role==="ADMIN"?"إدارة":"مدرب"}</td><td className="td"><span style={{background:"#d1fae5",color:"#047857",borderRadius:"999px",padding:"4px 12px",fontSize:"12px",fontWeight:800}}>تم</span></td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
