// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// القاموس ثنائي اللغة
// ==========================================
const dict = {
  ar: {
    dir: "rtl", font: "'Tajawal', sans-serif",
    title: "لوحة ذكاء الأعمال", sub: "النظام المركزي للتحليلات",
    tab1: "الملخص التنفيذي", tab2: "التقرير اليومي", tab3: "التقرير النهائي", tab4: "سجل المشاركين", tab5: "شهادة التميز",
    lang: "English 🌐", 
    totalRes: "حجم العينة", dailySat: "الرضا اليومي", finalSat: "الرضا النهائي",
    room: "القاعة", trainer: "المدرب", name: "الاسم", email: "البريد", phone: "الجوال",
    noData: "لا توجد بيانات."
  },
  en: {
    dir: "ltr", font: "'Inter', sans-serif",
    title: "BI Dashboard", sub: "Central Analytics",
    tab1: "Overview", tab2: "Daily Report", tab3: "Final Report", tab4: "Participants", tab5: "Certificate",
    lang: "عربي 🌐",
    totalRes: "Sample Size", dailySat: "Daily", finalSat: "Final",
    room: "Room", trainer: "Trainer", name: "Name", email: "Email", phone: "Phone",
    noData: "No data."
  }
};

// ==========================================
// الأنماط
// ==========================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.rw { background: #f4f6f8; min-height: 100vh; padding: 24px; }
.lay { display: flex; gap: 24px; }
.side { width: 300px; flex-shrink: 0; background: linear-gradient(145deg, #0b1220, #172554); border-radius: 24px; padding: 24px; color: #fff; position: sticky; top: 24px; }
.main { flex: 1; min-width: 0; }
.ton { background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 800; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.tof { background: rgba(255,255,255,0.04); color: #94a3b8; border: none; border-radius: 14px; padding: 14px 18px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.tof:hover { background: rgba(255,255,255,0.1); color: #fff; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 28px; margin-bottom: 20px; }
.kpi { border-bottom: 5px solid #10b981; }
.tbl { width: 100%; border-collapse: collapse; }
.th { padding: 14px; font-weight: 800; font-size: 14px; color: #64748b; border-bottom: 2px solid #eef2f6; }
.td { padding: 14px; font-size: 14px; border-bottom: 1px solid #f1f5f9; font-weight: 600; }
@media(max-width: 950px){ .lay { flex-direction: column; } .side { width: 100%; position: static; } .g2, .g3 { grid-template-columns: 1fr; } }
`;

const TEAL = "#10b981";
const BLUE = "#2563eb";
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function statusOf(v) {
  const val = Number(v) || 0;
  if (val >= 4) return { t: "ممتاز", bg: "#d1fae5", fg: "#047857" };
  if (val >= 3) return { t: "جيد", bg: "#fef3c7", fg: "#b45309" };
  return { t: "يحتاج", bg: "#fee2e2", fg: "#b91c1c" };
}

function pad(n) { return n < 10 ? "0" + n : "" + n; }

function GaugeChart({ score, color }) {
  const pct = score ? (score / 5) * 100 : 0;
  const radius = 55;
  const circumference = Math.PI * radius;
  return (
    <div style={{ textAlign: "center", position: "relative", height: "85px", width: "150px", margin: "0 auto" }}>
      <svg width="150" height="85" viewBox="0 0 150 85">
        <path d="M 15 75 A 55 55 0 0 1 135 75" fill="none" stroke="#f1f5f9" strokeWidth="16" strokeLinecap="round" />
        <path d="M 15 75 A 55 55 0 0 1 135 75" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" 
          strokeDasharray={circumference} strokeDashoffset={circumference - (pct / 100) * circumference} 
          style={{ transition: "stroke-dashoffset 1.5s" }} />
      </svg>
      <div style={{ position: "absolute", bottom: "-5px", left: 0, right: 0, fontSize: "28px", fontWeight: "900" }}>
        {score ? score.toFixed(2) : "0.00"}
      </div>
    </div>
  );
}

export default function ReportsPage() {
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
  const [busy, setBusy] = useState(false);
  const [selMail, setSelMail] = useState("");
  const [msg, setMsg] = useState("");

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
    setRows(e.data || []);
    setAns(a.data || []);
    setQs(q.data || []);
    setClassrooms(c.data || []);
    setTrainers(tr.data || []);
  };

  useEffect(() => {
    setMounted(true);
    let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push("/login"); return; }
      if (on) { await fetchAllData(); setLoad(false); }
    })();
    return () => { on = false; };
  }, []);

  // ==========================================
  // إرسال البريد الإلكتروني
  // ==========================================
  const sendEmail = async (type, trainerId) => {
    setBusy(true);
    setMsg("");
    try {
      let email = "admin@example.com";
      let name = "الإدارة";
      let room_code = "—";
      let avg_score = "0.00";
      let total_responses = "0";

      if (type === "TRAINER" && trainerId) {
        const tr = trainers.find(x => x.id === trainerId);
        if (!tr) { alert("المدرب غير موجود"); setBusy(false); return; }
        if (!tr.email) { alert("لا يوجد بريد لهذا المدرب"); setBusy(false); return; }
        
        const room = classrooms.find(c => c.trainer_id === trainerId);
        const evs = rows.filter(r => r.classroom_id === room?.id);
        
        avg_score = evs.length 
          ? (evs.reduce((sum, r) => sum + Number(r.overall_rating || 0), 0) / evs.length).toFixed(2)
          : "0.00";
        total_responses = String(evs.length);
        room_code = room?.code || "—";
        email = tr.email;
        name = tr.name;
      }

      // الاتصال بالـ API
      const response = await fetch("/api/sendmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainer_email: email,
          trainer_name: name,
          room_code,
          avg_score,
          total_responses
        })
      });

      const result = await response.json();
      console.log("Email result:", result);

      if (result.success) {
        setMsg("✅ تم إرسال البريد بنجاح!");
        // تسجيل في قاعدة البيانات
        await db.from("email_logs").insert({
          recipient_email: email,
          recipient_name: name,
          recipient_role: type,
          subject: `تقرير ${room_code}`,
          status: "sent"
        });
      } else {
        throw new Error(result.error || "فشل الإرسال");
      }
    } catch (e) {
      console.error("Email error:", e);
      setMsg("❌ خطأ: " + (e.message || "تعذر الإرسال"));
    } finally {
      setBusy(false);
    }
  };

  // ==========================================
  // الحسابات
  // ==========================================
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

    const axes = Object.keys(g).map(id => ({
      label: qm[id]?.text_ar || "سؤال",
      section: qm[id]?.section_ar || "عام",
      value: avg(g[id])
    })).sort((a, b) => b.value - a.value);
    
    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => { const v = Math.round(Number(r.overall_rating)); if (v >= 1 && v <= 5) dist[v - 1] += 1; });

    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      dayMap[key] = { wd: WEEKDAYS_AR[d.getDay()], count: 0 };
    }
    list.forEach(r => {
      if (!r || !r.submitted_at) return;
      const d = new Date(r.submitted_at);
      if (isNaN(d.getTime())) return;
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
      const students = evs.map(e => ({ 
        name: e.guest_name || e.profile?.full_name, 
        email: e.guest_email || e.profile?.email, 
        phone: e.guest_phone || e.profile?.phone 
      })).filter(s => s.name);
      const uniqueStudents = Array.from(new Set(students.map(s => s.email))).map(email => students.find(s => s.email === email));
      return { id: c.id, code: c.code, trainer: tObj?.name || "—", count: evs.length, avg, students: uniqueStudents };
    }).filter(c => c.count > 0).sort((a, b) => b.avg - a.avg);
  }, [classrooms, trainers, rows]);

  const bestTeacher = useMemo(() => roomData.length ? roomData[0] : null, [roomData]);

  if (!mounted || load) return (
    <div className="rw" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "#0f172a" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ width: 60, height: 60, border: "6px solid rgba(255,255,255,0.1)", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
    </div>
  );

  return (
    <div className="rw" style={{ direction: t.dir, fontFamily: t.font }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lay">
        
        {/* Sidebar */}
        <aside className="side">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg,#10b981,#0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "18px" }}>{t.title}</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>{t.sub}</div>
            </div>
          </div>
          
          <button className={tab === "dashboard" ? "ton" : "tof"} onClick={() => setTab("dashboard")}>
            <span>{t.tab1}</span><span>🏢</span>
          </button>
          <button className={tab === "daily" ? "ton" : "tof"} onClick={() => setTab("daily")}>
            <span>{t.tab2}</span><span>📈</span>
          </button>
          <button className={tab === "final" ? "ton" : "tof"} onClick={() => setTab("final")}>
            <span>{t.tab3}</span><span>🏁</span>
          </button>
          <button className={tab === "participants" ? "ton" : "tof"} onClick={() => setTab("participants")}>
            <span>{t.tab4}</span><span>👥</span>
          </button>
          <button className={tab === "cert" ? "ton" : "tof"} onClick={() => setTab("cert")}>
            <span>{t.tab5}</span><span>🏆</span>
          </button>
          
          <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: "16px" }}>
            <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginBottom: "8px" }}>{t.lang}</button>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "transparent", border: "1px solid #334155", color: "#cbd5e1", cursor: "pointer", padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700 }}>⚙️ إدارة</button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="main">
          
          {/* Dashboard */}
          {tab === "dashboard" && (
            <div>
              <div className="card" style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", color: "#fff" }}>
                <h1 style={{ fontSize: "32px", fontWeight: 900, margin: "0 0 8px" }}>الملخص التنفيذي</h1>
                <p style={{ color: "#94a3b8", margin: 0 }}>تقارير ذكية لمؤشرات الجودة والتقييم</p>
              </div>

              <div className="g3">
                <div className="card kpi">
                  <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 800 }}>{t.totalRes}</div>
                  <div style={{ fontSize: "44px", fontWeight: 900 }}>{daily.count + final.count}</div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 800, marginBottom: "10px" }}>{t.dailySat}</div>
                  <GaugeChart score={daily.avg} color={BLUE} />
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 800, marginBottom: "10px" }}>{t.finalSat}</div>
                  <GaugeChart score={final.avg} color={TEAL} />
                </div>
              </div>

              {/* قسم إرسال البريد */}
              <div className="card" style={{ border: "2px solid #10b981" }}>
                <h3 style={{ fontSize: "20px", fontWeight: 900, marginBottom: "16px" }}>✉️ إرسال التقارير بالبريد</h3>
                
                {msg && (
                  <div style={{ padding: "12px", borderRadius: "10px", marginBottom: "16px", background: msg.includes("✅") ? "#d1fae5" : "#fee2e2", color: msg.includes("✅") ? "#047857" : "#b91c1c", fontWeight: 700 }}>
                    {msg}
                  </div>
                )}
                
                <div className="g2">
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>اختر المدرب:</label>
                    <select value={selMail} onChange={e => setSelMail(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "12px" }}>
                      <option value="">— اختر المدرب —</option>
                      {trainers.map(tr => (
                        <option key={tr.id} value={tr.id}>{tr.name} ({tr.email || "بلا بريد"})</option>
                      ))}
                    </select>
                    <button onClick={() => sendEmail("TRAINER", selMail)} disabled={busy || !selMail} 
                      style={{ width: "100%", background: busy || !selMail ? "#94a3b8" : "#10b981", color: "#fff", border: "none", padding: "14px", borderRadius: "12px", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}>
                      {busy ? "⏳ جاري..." : "✉️ إرسال للمدرب"}
                    </button>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>تقرير الإدارة:</label>
                    <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>إرسال ملخص شامل للإدارة التنفيذية.</p>
                    <button onClick={() => sendEmail("ADMIN")} disabled={busy} 
                      style={{ width: "100%", background: busy ? "#94a3b8" : "#0f172a", color: "#fff", border: "none", padding: "14px", borderRadius: "12px", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}>
                      {busy ? "⏳ جاري..." : "✉️ إرسال للإدارة"}
                    </button>
                  </div>
                </div>
              </div>

              {/* ترتيب القاعات */}
              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>🏫 ترتيب القاعات</h3>
                {roomData.map((r, i) => (
                  <div key={r.id} style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px" }}>
                      <span>قاعة {r.code} ({r.trainer})</span>
                      <span style={{ color: i === 0 ? "#10b981" : "#334155", fontWeight: 800 }}>{r.avg.toFixed(2)}</span>
                    </div>
                    <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${(r.avg/5)*100}%`, height: "100%", background: i === 0 ? "#10b981" : "#2563eb" }} />
                    </div>
                  </div>
                ))}
                {roomData.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>
            </div>
          )}

          {/* Daily Report */}
          {tab === "daily" && (
            <div>
              <div className="card" style={{ borderRight: "6px solid " + BLUE }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px", color: BLUE }}>التقرير اليومي</h1>
                <p style={{ color: "#64748b", margin: 0 }}>تحليل أداء الحصص التدريبية</p>
              </div>
              
              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>📊 أداء المحاور</h3>
                {daily.axes.map((a, i) => {
                  const s = statusOf(a.value);
                  return (
                    <div key={i} style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 700 }}>{a.label}</span>
                        <span style={{ background: s.bg, color: s.fg, padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 800 }}>{s.t}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value/5)*100}%`, height: "100%", background: BLUE }} />
                        </div>
                        <b style={{ minWidth: "50px", textAlign: "left" }}>{a.value.toFixed(2)}/5</b>
                      </div>
                    </div>
                  );
                })}
                {daily.axes.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>
            </div>
          )}

          {/* Final Report */}
          {tab === "final" && (
            <div>
              <div className="card" style={{ borderRight: "6px solid " + TEAL }}>
                <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "8px", color: TEAL }}>التقييم النهائي</h1>
                <p style={{ color: "#64748b", margin: 0 }}>رضا المتدربين عن البرنامج</p>
              </div>
              
              <div className="card">
                <h3 style={{ fontSize: "18px", fontWeight: 900, marginBottom: "16px" }}>📊 أداء المحاور</h3>
                {final.axes.map((a, i) => {
                  const s = statusOf(a.value);
                  return (
                    <div key={i} style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 700 }}>{a.label}</span>
                        <span style={{ background: s.bg, color: s.fg, padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 800 }}>{s.t}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${(a.value/5)*100}%`, height: "100%", background: TEAL }} />
                        </div>
                        <b style={{ minWidth: "50px", textAlign: "left" }}>{a.value.toFixed(2)}/5</b>
                      </div>
                    </div>
                  );
                })}
                {final.axes.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
              </div>
            </div>
          )}

          {/* Participants */}
          {tab === "participants" && (
            <div className="card">
              <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "20px" }}>👥 سجل المشاركين</h2>
              {roomData.map(r => (
                <div key={r.id} style={{ marginBottom: "24px", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
                  <div style={{ background: "#f8fafc", padding: "16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "16px", alignItems: "center" }}>
                    <b style={{ fontSize: "18px", color: "#10b981" }}>قاعة {r.code}</b>
                    <span style={{ color: "#64748b" }}>المدرب: {r.trainer}</span>
                    <span style={{ background: "#d1fae5", color: "#047857", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, marginRight: "auto" }}>{r.students.length} مشارك</span>
                  </div>
                  <table className="tbl">
                    <thead>
                      <tr><th className="th">{t.name}</th><th className="th">{t.phone}</th><th className="th">{t.email}</th></tr>
                    </thead>
                    <tbody>
                      {r.students.map((s, i) => (
                        <tr key={i}>
                          <td className="td">{s.name || "—"}</td>
                          <td className="td" style={{ direction: "ltr", textAlign: "right" }}>{s.phone || "—"}</td>
                          <td className="td" style={{ direction: "ltr", textAlign: "right", color: "#2563eb" }}>{s.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {roomData.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center" }}>{t.noData}</p>}
            </div>
          )}

          {/* Certificate */}
          {tab === "cert" && bestTeacher && (
            <div className="card" style={{ textAlign: "center", padding: "40px", background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "4px solid #d97706" }}>
              <h1 style={{ fontSize: "36px", fontWeight: 900, color: "#d97706", marginBottom: "8px" }}>🏆 شهادة التميز</h1>
              <p style={{ color: "#64748b", marginBottom: "24px" }}>تُمنح لأفضل مدرب</p>
              <h2 style={{ fontSize: "48px", fontWeight: 900, color: "#10b981", marginBottom: "16px" }}>{bestTeacher.trainer}</h2>
              <p style={{ fontSize: "20px", color: "#334155" }}>
                قاعة <b style={{ color: "#2563eb" }}>{bestTeacher.code}</b> - معدل: <b style={{ color: "#d97706" }}>{bestTeacher.avg.toFixed(2)}/5</b>
              </p>
              <button onClick={() => window.print()} style={{ background: "#0f172a", color: "#fff", border: "none", padding: "14px 28px", borderRadius: "12px", fontWeight: 800, cursor: "pointer", marginTop: "24px", fontSize: "16px" }}>
                🖨️ طباعة الشهادة
              </button>
            </div>
          )}
          {tab === "cert" && !bestTeacher && (
            <div className="card" style={{ textAlign: "center", padding: "60px" }}>
              <p style={{ color: "#94a3b8", fontSize: "18px" }}>{t.noData}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
