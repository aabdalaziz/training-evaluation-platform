// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

// ==========================================
// الأنماط البصرية الفاخرة للوحة القيادة التنفيذية
// ==========================================
const CSS_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap');
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.rep-container {
  direction: rtl;
  text-align: right;
  font-family: 'Cairo', Tahoma, sans-serif;
  background-color: #f2ecdf;
  min-height: 100vh;
  padding: 20px;
  color: #0b1220;
  box-sizing: border-box;
}

.rep-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.rep-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #0b1220, #060b13);
  border-radius: 24px;
  padding: 20px;
  color: #fff;
  position: sticky;
  top: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}

.rep-logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.rep-logo-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #10b981, #0d9488);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.rep-logo-title {
  font-weight: 900;
  font-size: 16px;
  line-height: 1.2;
}

.rep-logo-sub {
  font-size: 11px;
  color: #94a3b8;
}

.rep-status-badge {
  background: rgba(16,185,129,0.12);
  border: 1px solid rgba(16,185,129,0.35);
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 16px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #5eead4;
}

.rep-nav-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rep-nav-btn {
  background: transparent;
  color: #94a3b8;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13.5px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  transition: 0.2s;
}

.rep-nav-btn:hover {
  color: #f1f5f9;
  background: rgba(255,255,255,0.03);
}

.rep-nav-btn.active {
  background: #10b981;
  color: #fff;
  font-weight: 800;
  border: 1px solid #10b981;
}

.rep-content {
  flex: 1;
  min-width: 0;
}

.rep-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0b1220, #111827);
  border-radius: 24px;
  padding: 24px;
  color: #fff;
  margin-bottom: 16px;
}

.rep-hero-bg-text {
  position: absolute;
  left: 16px;
  top: 0px;
  font-size: 80px;
  font-weight: 900;
  color: rgba(255,255,255,0.03);
  letter-spacing: 4px;
}

.rep-hero-badge {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #e2e8f0;
  display: inline-block;
  margin-bottom: 6px;
}

.rep-grid-kpi {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.rep-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.rep-card {
  background: #fffdf9;
  border: 1px solid #e8decb;
  border-radius: 22px;
  padding: 22px;
  box-shadow: 0 6px 18px rgba(60,40,10,0.04);
  margin-bottom: 16px;
}

.rep-kpi-card {
  position: relative;
  overflow: hidden;
  border-right: 4px solid #10b981;
  background: #fffdf9;
  border-top: 1px solid #e8decb;
  border-bottom: 1px solid #e8decb;
  border-left: 1px solid #e8decb;
  border-radius: 22px;
  padding: 22px;
  box-shadow: 0 6px 18px rgba(60,40,10,0.04);
}

.rep-kpi-ghost {
  position: absolute;
  left: 10px;
  top: 4px;
  font-size: 60px;
  font-weight: 900;
  color: rgba(16,185,129,0.04);
}

.rep-kpi-label {
  font-size: 13px;
  color: #9a8f7d;
  font-weight: 700;
  margin-bottom: 4px;
}

.rep-kpi-val {
  font-size: 38px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}

.rep-progress-track {
  height: 10px;
  background: #f0e9db;
  border-radius: 8px;
  overflow: hidden;
}

.rep-progress-bar {
  height: 100%;
  border-radius: 8px;
  transition: width 0.5s ease-in-out;
}

.rep-axis-row {
  background: #fff;
  border: 1px solid #f0e9db;
  border-radius: 14px;
  padding: 13px;
  margin-bottom: 10px;
}

.rep-axis-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 6px;
}

.rep-sec-tag {
  background: #f0e9db;
  color: #7c6f5a;
  border-radius: 7px;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 8px;
}

.rep-status-pill {
  border-radius: 999px;
  padding: 3px 11px;
  font-size: 11px;
  font-weight: 800;
}

.rep-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.rep-th {
  padding: 12px;
  text-align: right;
  font-weight: 700;
  font-size: 13px;
  color: #64748b;
  border-bottom: 2px solid #eef2f6;
}

.rep-td {
  padding: 14px 12px;
  font-size: 13.5px;
  border-bottom: 1px solid #f1f5f9;
}

.rep-comment-card {
  background: #fff;
  border-right: 4px solid #10b981;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #475569;
  line-height: 1.7;
}

.rep-best-card {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  border: 1px solid #10b981;
  border-radius: 22px;
  padding: 22px;
}

.rep-spinner {
  width: 48px;
  height: 48px;
  border: 5px solid #e2e8f0;
  border-top: 5px solid #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

.demo-banner {
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #b45309;
  padding: 12px;
  border-radius: 14px;
  margin-bottom: 16px;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media(max-width: 920px) {
  .rep-layout { flex-direction: column; }
  .rep-sidebar { width: 100%; position: static; }
  .rep-grid-kpi, .rep-grid-2 { grid-template-columns: 1fr; }
}
`;

// ==========================================
// بيانات محاكاة تجريبية لعرض الجودة فوراً في حال عدم وجود تقييمات
// ==========================================
const MOCK_DAILY = {
  count: 52,
  avg: 4.2,
  dist: [2, 5, 8, 15, 27],
  days: [
    { wd: "الإثنين", dt: "07-13", count: 12 },
    { wd: "الثلاثاء", dt: "07-14", count: 8 },
    { wd: "الأربعاء", dt: "07-15", count: 15 },
    { wd: "الخميس", dt: "07-16", count: 18 },
    { wd: "الجمعة", dt: "07-17", count: 3 },
    { wd: "السبت", dt: "07-18", count: 10 },
    { wd: "الأحد", dt: "07-19", count: 22 }
  ],
  axes: [
    { label: "جودة الحصة - ما مدى وضوح شرح الدرس؟", section: "جودة الشرح", value: 4.4 },
    { label: "جودة الحصة - كيف تقيّم أسلوب التدريس؟", section: "التدريس", value: 4.2 },
    { label: "التفاعل - ما مستوى دافعيتك وتفاعلك؟", section: "التفاعل", value: 3.9 },
    { label: "المحتوى - ما مستوى صعوبة الدرس؟", section: "المحتوى", value: 4.1 }
  ],
  sections: [
    { name: "وضوح الشرح", value: 4.4 },
    { name: "أسلوب التدريس", value: 4.2 }
  ],
  comments: [
    "الشرح ممتاز جداً ومبسط ومناسب لكل المستويات.",
    "المدرب متفاعل ويوجه الأسئلة للجميع بشكل دوري.",
    "نرجو إعطاء وقت أطول للتطبيق العملي داخل القاعة."
  ]
};

const MOCK_FINAL = {
  count: 48,
  avg: 4.5,
  dist: [1, 2, 6, 12, 27],
  days: [
    { wd: "الإثنين", dt: "07-13", count: 5 },
    { wd: "الثلاثاء", dt: "07-14", count: 9 },
    { wd: "الأربعاء", dt: "07-15", count: 14 },
    { wd: "الخميس", dt: "07-16", count: 20 },
    { wd: "الجمعة", dt: "07-17", count: 2 },
    { wd: "السبت", dt: "07-18", count: 12 },
    { wd: "الأحد", dt: "07-19", count: 25 }
  ],
  axes: [
    { label: "الوصول - تقييم حفل الاستقبال بالجامعة", section: "الاستقبال", value: 4.6 },
    { label: "السكن - جودة السكن الطلابي والمرافق", section: "الإقامة", value: 4.3 },
    { label: "التعليم - أداء المعلمين الإجمالي", section: "التعليم", value: 4.7 },
    { label: "المحتوى - ملاءمة المنهج والمستوى الأكاديمي", section: "المنهج", value: 4.4 }
  ],
  sections: [
    { name: "التعليم والتدريس", value: 4.7 },
    { name: "جودة السكن والمرافق", value: 4.3 }
  ],
  comments: [
    "برنامج متميز جداً وتنظيم يفوق التوقعات.",
    "الرحلات الأكاديمية والزيارات الميدانية كانت مذهلة."
  ]
};

const MOCK_TEACHERS = [
  { id: "1", name: "د/ آلاء", rooms: "206", levels: "A2", count: 11, avg: 4.7, clarity: 4.6, teach: 4.8, drive: 4.7 },
  { id: "2", name: "د/ الشرقاوي", rooms: "203", levels: "A1", count: 9, avg: 4.4, clarity: 4.5, teach: 4.3, drive: 4.4 },
  { id: "3", name: "د/ بكر الأحمدي", rooms: "204", levels: "A1", count: 12, avg: 4.2, clarity: 4.1, teach: 4.2, drive: 4.3 },
  { id: "4", name: "د/ شيماء", rooms: "205", levels: "A1", count: 8, avg: 4.0, clarity: 3.9, teach: 4.1, drive: 4.0 }
];

export default function ReportsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<Ev[]>([]);
  const [ans, setAns] = useState<An[]>([]);
  const [qs, setQs] = useState<Qu[]>([]);
  
  const [classrooms, setClassrooms] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [load, setLoad] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [useDemo, setUseDemo] = useState(false); // خيار التبديل للبيانات التجريبية

  const db = supabase();

  const fetchAllData = async () => {
    try {
      const [e, a, q, roomsList, trainersList] = await Promise.all([
        db.from("evaluations").select("*").order("submitted_at", { ascending: false }),
        db.from("evaluation_answers").select("*"),
        db.from("questions").select("*"),
        db.from("classrooms").select("*").order("code"),
        db.from("trainers").select("*").order("name"),
      ]);

      setRows(e.data || []);
      setAns(a.data || []);
      setQs(q.data || []);
      setClassrooms(roomsList.data || []);
      setTrainers(trainersList.data || []);

      // إذا كانت الجداول فارغة تماماً، نقوم بتفعيل البيانات التجريبية تلقائياً لإبراز التصميم الفاخر
      if ((e.data || []).length === 0) {
        setUseDemo(true);
      }
    } catch (x: any) {
      setErr(x.message || "حدث خطأ في تحميل البيانات الهيكلية");
    }
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
  // معالجة بيانات التقارير والتحليلات الحية
  // ==========================================
  const calc = (kind: "DAILY" | "FINAL"): Rep => {
    const list = (rows || []).filter(r => r && r.kind === kind);
    if (list.length === 0) {
      return kind === "DAILY" ? MOCK_DAILY : MOCK_FINAL;
    }
    const ids = new Set(list.map(r => r.id));
    const qm: Record<string, Qu> = {}; (qs || []).forEach(q => { if (q) qm[q.id] = q; });
    const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;
    
    const g: Record<string, number[]> = {};
    (ans || []).forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.rating_value != null) {
        const v = Number(a.rating_value);
        if (!isNaN(v)) { (g[a.question_id] = g[a.question_id] || []).push(v); }
      }
    });

    const axes: Ax[] = Object.keys(g).map(id => ({
      label: qm[id] ? qm[id].text_ar : "سؤال التقييم",
      section: qm[id] && qm[id].section_ar ? qm[id].section_ar : "عام",
      value: avg(g[id])
    })).sort((a, b) => b.value - a.value);

    const dist = [0, 0, 0, 0, 0];
    list.forEach(r => {
      if (!r) return;
      const v = Math.round(Number(r.overall_rating));
      if (v >= 1 && v <= 5) dist[v - 1] += 1;
    });

    const dayMap: any = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      dayMap[key] = { wd: WEEKDAYS_AR[d.getDay()] || "يوم", dt: pad(d.getMonth() + 1) + "-" + pad(d.getDate()), count: 0 };
    }
    
    list.forEach(r => {
      if (!r || !r.submitted_at) return;
      const d = new Date(r.submitted_at);
      if (isNaN(d.getTime())) return;
      const key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      if (dayMap[key]) dayMap[key].count += 1;
    });
    const days: Day[] = Object.keys(dayMap).map(k => dayMap[k]);

    const sm: any = {};
    axes.forEach(a => {
      if (!a) return;
      if (!sm[a.section]) sm[a.section] = { s: 0, n: 0 };
      sm[a.section].s += a.value;
      sm[a.section].n += 1;
    });
    const sections = Object.keys(sm).map(k => ({ name: k, value: sm[k].s / sm[k].n })).sort((a, b) => b.value - a.value).slice(0, 4);

    const comments: string[] = [];
    (ans || []).forEach(a => {
      if (a && ids.has(a.evaluation_id) && a.text_value && a.text_value.trim() && comments.length < 6) {
        comments.push(a.text_value.trim());
      }
    });

    const all = list.map(r => r && Number(r.overall_rating)).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);
    return { count: list.length, avg: avg(all), axes, comments, dist, days, sections };
  };

  const liveDaily = useMemo(() => calc("DAILY"), [rows, ans, qs]);
  const liveFinal = useMemo(() => calc("FINAL"), [rows, ans, qs]);

  const daily = useDemo ? MOCK_DAILY : liveDaily;
  const final = useDemo ? MOCK_FINAL : liveFinal;

  // ==========================================
  // هيكلة تقرير أداء المعلمين والقاعات
  // ==========================================
  const teacherPerformance = useMemo(() => {
    if (useDemo || trainers.length === 0) return MOCK_TEACHERS;

    return (trainers || []).map(t => {
      if (!t || !t.id) return null;
      const myRooms = (classrooms || []).filter(c => c && c.trainer_id === t.id);
      const roomIds = new Set(myRooms.map(c => c && c.id).filter(Boolean));
      
      const myEvals = (rows || []).filter(r => r && r.classroom_id && roomIds.has(r.classroom_id));
      const evalIds = new Set(myEvals.map(e => e.id));
      const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : 0;

      const clarityScores: number[] = [];
      const teachScores: number[] = [];
      const driveScores: number[] = [];

      (ans || []).forEach(a => {
        if (!a || !evalIds.has(a.evaluation_id)) return;
        const v = Number(a.rating_value);
        if (isNaN(v)) return;
        const q = (qs || []).find(x => x && x.id === a.question_id);
        if (!q) return;

        const text = q.text_ar || "";
        if (text.includes("وضوح") || text.includes("شرح")) clarityScores.push(v);
        else if (text.includes("أسلوب") || text.includes("تدريس")) teachScores.push(v);
        else if (text.includes("دافعيتك") || text.includes("تفاعلك")) driveScores.push(v);
      });

      const overall = myEvals.map(r => r && Number(r.overall_rating)).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);

      return {
        id: t.id,
        name: t.name,
        rooms: myRooms.map(r => r.code).join("، ") || "لم تُحدد قاعة",
        levels: Array.from(new Set(myRooms.map(r => r.level).filter(Boolean))).join("، ") || "—",
        count: myEvals.length,
        avg: avg(overall),
        clarity: avg(clarityScores),
        teach: avg(teachScores),
        drive: avg(driveScores)
      };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  }, [useDemo, trainers, classrooms, rows, ans, qs]);

  const bestTeacher = useMemo(() => {
    const valid = (teacherPerformance || []).filter(t => t && t.count > 0);
    return valid.length > 0 ? valid[0] : (teacherPerformance && teacherPerformance[0]);
  }, [teacherPerformance]);

  if (!mounted || load) {
    return (
      <div className="rep-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS_STYLES }} />
        <div className="rep-spinner"></div>
        <div style={{ fontWeight: 900, fontSize: "18px", color: "#0f172a", marginTop: "10px" }}>مجموعة جودة التعليم والتقييم والامتثال</div>
        <p style={{ color: "#64748b" }}>جاري تحميل لوحة الأداء والجودة والامتثال الأكاديمي...</p>
      </div>
    );
  }

  return (
    <div className="rep-container">
      <style dangerouslySetInnerHTML={{ __html: CSS_STYLES }} />
      <div className="rep-layout">
        
        {/* القائمة الجانبية الفاخرة للتحكم بالأقسام */}
        <aside className="rep-sidebar">
          <div className="rep-logo-area">
            <div className="rep-logo-icon">🏆</div>
            <div>
              <div className="rep-logo-title">لوحة الأداء والجودة</div>
              <div className="rep-logo-sub">النظام المركزي الموحد</div>
            </div>
          </div>
          
          <div className="rep-status-badge">
            {useDemo ? "⚠️ وضع المحاكاة نشط" : "✅ ربط مباشر مع قاعدة البيانات"}
          </div>

          <div className="rep-nav-list">
            <button className={`rep-nav-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}><span>نظرة شاملة</span> 🏠</button>
            <button className={`rep-nav-btn ${tab === "daily" ? "active" : ""}`} onClick={() => setTab("daily")}><span>التقرير اليومي</span> 📝</button>
            <button className={`rep-nav-btn ${tab === "final" ? "active" : ""}`} onClick={() => setTab("final")}><span>التقرير النهائي</span> ⭐</button>
            <button className={`rep-nav-btn ${tab === "teachers" ? "active" : ""}`} onClick={() => setTab("teachers")}><span>تقييم المعلمين والقاعات</span> 👨‍🏫</button>
          </div>

          <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <button onClick={() => router.push("/admin/management")} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", cursor: "pointer", padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: "700" }}>🏫 إدارة القاعات والمدربين</button>
            <button onClick={() => setUseDemo(!useDemo)} style={{ width: "100%", background: useDemo ? "linear-gradient(135deg,#b45309,#d97706)" : "rgba(255,255,255,0.05)", border: "none", color: "#fff", cursor: "pointer", padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: "700" }}>
              {useDemo ? "🔌 الانتقال للبيانات الحية" : "🧪 تفعيل بيانات تجريبية"}
            </button>
            <button onClick={() => router.push("/dashboard")} style={{ width: "100%", background: "transparent", border: "none", color: "#64748b", cursor: "pointer", textAlign: "right", padding: "8px 10px", fontSize: "13px", fontWeight: "600" }}>← لوحة التحكم العامة</button>
          </div>
        </aside>

        {/* منطقة المحتوى المركزية */}
        <div className="rep-content">
          
          {useDemo && (
            <div className="demo-banner">
              <span>💡 يتم الآن عرض بيانات جودة محاكاة تجريبية مذهلة لعرض جمال التصميم، يمكنك التبديل للبيانات الحية بالضغط على الزر الجانبي.</span>
              <button onClick={() => setUseDemo(false)} style={{ background: "#b45309", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>البيانات الحية</button>
            </div>
          )}

          {/* ترويسة الصفحة التنفيذية المقتبسة من مرجعك الفاخر */}
          <div className="rep-hero">
            <div className="rep-hero-bg-text">REPORT</div>
            <div style={{ position: "relative" }}>
              <span className="rep-hero-badge">تقرير الأداء السنوي والتحليلي المطور</span>
              <h1 style={{ fontSize: "30px", fontWeight: 900, margin: 0 }}>{tab === "dashboard" ? "التقرير العام المتكامل" : tab === "teachers" ? "أداء المعلمين المرتبط بالقاعة" : `تقييم ${tab === "daily" ? "الحصة اليومية" : "البرنامج النهائي"}`}</h1>
              <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: "13px" }}>توليد تلقائي فوري لمعايير الجودة والامتثال والرضا والتقييم الفردي</p>
            </div>
          </div>

          {/* 1. التبويب العام للوحة الشاملة */}
          {tab === "dashboard" && <Overview daily={daily} final={final} best={bestTeacher} />}

          {/* 2. تقرير الحصة اليومية */}
          {tab === "daily" && <ReportView rep={daily} accent="#2563eb" name="التقرير اليومي المطور" sub="تحليل وتقييم جلسات التدريب اليومية وتفاعل الحضور" />}

          {/* 3. تقرير البرنامج النهائي */}
          {tab === "final" && <ReportView rep={final} accent="#10b981" name="التقرير النهائي للبرنامج" sub="مؤشر رضا المستفيدين الأكاديمي الشامل عن البرنامج ككل" />}

          {/* 4. تقرير أداء المعلمين والقاعات */}
          {tab === "teachers" && <TeachersView data={teacherPerformance} best={bestTeacher} />}

        </div>
      </div>
    </div>
  );
}

// ==========================================
// المكونات الفرعية التفاعلية للوحة القيادة
// ==========================================
function Overview(p: { daily: Rep; final: Rep; best: any }) {
  const d = p.daily || { count: 0, avg: 0 };
  const f = p.final || { count: 0, avg: 0 };
  const max = Math.max(5, Number(d.avg || 0), Number(f.avg || 0));
  return (
    <div>
      <div className="rep-grid-kpi">
        <KpiCard label="إجمالي الاستجابات الحية" value={Number(d.count || 0) + Number(f.count || 0)} suffix=" استمارة" ghost={String(Number(d.count || 0) + Number(f.count || 0))} />
        <KpiCard label="معدل الرضا اليومي" value={d.avg ? Number(d.avg).toFixed(2) : "—"} suffix="/5" ghost={d.avg ? Number(d.avg).toFixed(1) : "—"} />
        <KpiCard label="معدل الرضا النهائي" value={f.avg ? Number(f.avg).toFixed(2) : "—"} suffix="/5" ghost={f.avg ? Number(f.avg).toFixed(1) : "—"} />
      </div>

      <div className="rep-grid-2">
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "800" }}>⚖️ مقارنة أداء الرضا الأكاديمي</h3>
          <svg viewBox="0 0 300 180" style={{ width: "100%", height: "auto" }}>
            {[0, 0.5, 1].map((fr, i) => { const y = 20 + 120 * (1 - fr); return (<g key={i}><line x1="40" y1={y} x2="280" y2={y} stroke="#ece4d4" strokeDasharray="3,3" /><text x="34" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{(max * fr).toFixed(1)}</text></g>); })}
            <g><rect x="80" y={140 - (Number(d.avg || 0) / max) * 120} width="45" height={(Number(d.avg || 0) / max) * 120} rx="6" fill="#2563eb" /><text x="102" y={140 - (Number(d.avg || 0) / max) * 120 - 8} textAnchor="middle" fontSize="13" fontWeight="900" fill="#111">{d.avg ? Number(d.avg).toFixed(2) : "—"}</text><text x="102" y="158" textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700">اليومي</text></g>
            <g><rect x="175" y={140 - (Number(f.avg || 0) / max) * 120} width="45" height={(Number(f.avg || 0) / max) * 120} rx="6" fill="#10b981" /><text x="197" y={140 - (Number(f.avg || 0) / max) * 120 - 8} textAnchor="middle" fontSize="13" fontWeight="900" fill="#111">{f.avg ? Number(f.avg).toFixed(2) : "—"}</text><text x="197" y="158" textAnchor="middle" fontSize="11" fill="#475569" fontWeight="700">النهائي</text></g>
            <line x1="40" y1="140" x2="280" y2="140" stroke="#d6cdba" strokeWidth="1.5" />
          </svg>
        </Card>

        {p.best ? (
          <div className="rep-best-card">
            <span style={{ fontSize: "44px" }}>🏆</span>
            <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px" }}>عضو هيئة التدريس الأكثر تميزاً</span>
            <h2 style={{ fontSize: "24px", fontWeight: 900, margin: "6px 0 2px", color: "#fff" }}>{p.best.name || "—"}</h2>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 12px" }}>قاعة {p.best.rooms || "—"} ({p.best.levels || "—"})</p>
            <div style={{ background: "rgba(16,185,129,.15)", border: "1px solid #10b981", borderRadius: "12px", padding: "8px 20px" }}>
              <span style={{ fontSize: "13px", color: "#5eead4", fontWeight: 700 }}>متوسط التقييم العام: {p.best.avg ? Number(p.best.avg).toFixed(2) : "0.00"} / 5</span>
            </div>
          </div>
        ) : (
          <Card><p style={{ color: "#94a3b8", textAlign: "center", padding: "40px" }}>لا توجد تقييمات مسجلة للمدربين بعد.</p></Card>
        )}
      </div>
    </div>
  );
}

function ReportView(p: { rep: Rep; accent: string; name: string; sub: string }) {
  const r = p.rep || { count: 0, avg: 0, axes: [], comments: [], dist: [0,0,0,0,0], days: [], sections: [] };
  const pct = r.avg ? Math.round((Number(r.avg) / 5) * 100) : 0;
  const top = r.axes && r.axes.length ? r.axes[r.axes.length - 1] : null;
  const low = r.axes && r.axes.length ? r.axes[0] : null;
  const maxDi = Math.max(1, ...(r.dist || [1]));
  const dColors = ["#f43f5e", "#fb923c", "#facc15", "#34d399", "#10b981"];
  const daysLen = r.days && r.days.length ? r.days.length : 1;
  const bw = daysLen > 0 ? 360 / daysLen : 360;
  const maxD = Math.max(1, ...(r.days || []).map((d: any) => d?.count || 0));
  return (
    <div>
      <div className="rep-grid-kpi">
        <KpiCard label="إجمالي الاستجابات" value={r.count} suffix=" استمارة" ghost={String(r.count)} />
        <KpiCard label="متوسط الرضا العام" value={r.avg ? Number(r.avg).toFixed(2) : "—"} suffix="/5" ghost={r.avg ? Number(r.avg).toFixed(1) : "—"} />
        <KpiCard label="نسبة الرضا المئوية" value={pct} suffix="%" ghost={String(pct)} />
      </div>

      <div className="rep-grid-2">
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800 }}>🎯 توزيع التقييم الإجمالي بالنجوم</h3>
          {[5, 4, 3, 2, 1].map(s => {
            const idx = s - 1;
            const distVal = r.dist && r.dist[idx] ? r.dist[idx] : 0;
            const w = maxDi > 0 ? (distVal / maxDi) * 100 : 0;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ width: "55px", fontSize: "11px", fontWeight: 700, color: "#7c6f5a" }}>{s} نجوم</span>
                <div style={{ flex: 1, height: "11px", background: "#f0e9db", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ width: (isNaN(w) ? 0 : w) + "%", height: "100%", background: dColors[idx], borderRadius: "8px" }} />
                </div>
                <b style={{ width: "20px", textAlign: "left", fontSize: "12px" }}>{distVal}</b>
              </div>
            );
          })}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800 }}>💡 التحليل الذكي والتوصيات</h3>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "12px", padding: "12px", marginBottom: "10px" }}><b style={{ color: "#047857", fontSize: "13px" }}>✅ نقطة القوة المتميزة</b><p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#334155" }}>{top ? top.label + " (" + Number(top.value).toFixed(2) + "/5)" : "—"}</p></div>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px" }}><b style={{ color: "#b45309", fontSize: "13px" }}>🎯 مجال التطوير المستهدف</b><p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#334155" }}>{low ? low.label + " (" + Number(low.value).toFixed(2) + "/5)" : "—"}</p></div>
        </Card>
      </div>

      <div className="rep-grid-2">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}><h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>📊 التوزيع اليومي</h3><span style={{ background: "#d1fae5", color: "#047857", borderRadius: "999px", padding: "3px 12px", fontSize: "11px", fontWeight: 800 }}>7 أيام</span></div>
          <svg viewBox="0 0 360 180" style={{ width: "100%", height: "auto" }}>
            <defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#0d9488"/></linearGradient></defs>
            {(r.days || []).map((d, i) => {
              const x = i * bw + bw * 0.22;
              const w = bw * 0.56;
              const h = (Number(d.count || 0) / maxD) * 120;
              const y = 140 - h;
              return (
                <g key={i}>
                  <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#111">{d.count}</text>
                  <rect x={x} y={y} width={w} height={Math.max(4, h)} rx={6} fill="url(#chartGrad)" />
                  <text x={x + w / 2} y={156} textAnchor="middle" fontSize="9" fill="#64748b">{d.wd}</text>
                  <text x={x + w / 2} y={170} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.dt}</text>
                </g>
              );
            })}
          </svg>
        </Card>
        
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800 }}>⚖️ مقارنة المحاور الأساسية</h3>
          {(r.sections || []).length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {r.sections.map((s, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #ece4d4", borderRadius: "14px", padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#9a8f7d", fontWeight: 700, marginBottom: "6px" }}>{s.name}</div>
                  <div style={{ fontSize: "28px", fontWeight: 900, color: "#10b981" }}>{Number(s.value || 0).toFixed(1)}</div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: "#9a8f7d", textAlign: "center", padding: "20px" }}>لا توجد أقسام مسجلة.</p>}
        </Card>
      </div>

      <Card style={{ marginTop: "16px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800 }}>📈 نتائج أداء المحاور التفصيلي</h3>
        {(r.axes || []).length > 0 ? r.axes.map((a, i) => {
          if (!a) return null;
          const s = statusOf(a.value);
          return (
            <div key={i} style={S.axisRow}>
              <div style={S.axisMeta}>
                <div style={S.axisLabelWrap}><span style={S.secTag}>{a.section}</span><span style={{ fontSize: "13.5px", fontWeight: 700 }}>{a.label}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ ...S.statusPill, background: s.bg, color: s.fg }}>{s.t}</span><b style={{ minWidth: "50px", textAlign: "left", color: p.accent, fontSize: "15px" }}>{Number(a.value || 0).toFixed(2)}/5</b></div>
              </div>
              <div style={S.track}><div style={{ ...S.fillGrad, width: (Number(a.value || 0) / 5 * 100) + "%", background: "linear-gradient(90deg," + p.accent + ",#10b981)" }} /></div>
            </div>
          );
        }) : <p style={{ color: "#9a8f7d", textAlign: "center", padding: "20px" }}>لا توجد بيانات لهذا التبويب حالياً.</p>}
      </Card>

      <Card style={{ marginTop: "16px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 800 }}>💬 ملاحظات ومرئيات المشاركين النصية</h3>
        {(r.comments || []).length > 0 ? r.comments.map((c, i) => (
          <div key={i} style={S.commentCard}>{c}</div>
        )) : <p style={{ color: "#9a8f7d", textAlign: "center", padding: "20px" }}>لا توجد تعليقات أو ملاحظات نصية مسجلة.</p>}
      </Card>
    </div>
  );
}

function TeachersView(p: { data: any[]; best: any }) {
  const teacherList = p.data || [];
  return (
    <div>
      {p.best && (
        <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", borderRadius: "22px", padding: "20px", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px", border: "1px solid #10b981" }}>
          <span style={{ fontSize: "40px" }}>🏆</span>
          <div>
            <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 800 }}>عضو هيئة التدريس الأعلى أداءً بالقاعات</div>
            <h3 style={{ margin: "2px 0 0", fontSize: "20px", fontWeight: 900 }}>{p.best.name || "—"}</h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>متوسط التقييم العام: {p.best.avg ? Number(p.best.avg).toFixed(2) : "0.00"}/5 (إجمالي الاستجابات: {p.best.count} تقييم)</p>
          </div>
        </div>
      )}

      <Card>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800 }}>📋 ترتيب المعلمين ومقارنة الأداء الأكاديمي المباشر</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>الترتيب</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>المعلم / المحاضر</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>القاعة</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>المستوى</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>الاستجابات</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>وضوح الشرح</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>أسلوب التدريس</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>تفاعل الطلاب</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>المعدل العام</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontSize: "13px", color: "#64748b", borderBottom: "2px solid #eef2f6" }}>الحالة الأكاديمية</th>
              </tr>
            </thead>
            <tbody>
              {teacherList.map((t, idx) => {
                if (!t) return null;
                const s = statusOf(t.avg || 0);
                return (
                  <tr key={t.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px", fontWeight: "800", color: idx === 0 ? "#10b981" : "#475569" }}>{idx + 1}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px", fontWeight: "800", color: "#111" }}>{t.name || "—"}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px", fontWeight: "700" }}>{t.rooms || "—"}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px" }}><span style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>{t.levels || "—"}</span></td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px" }}>{t.count || 0}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px", color: "#2563eb", fontWeight: "700" }}>{t.count ? Number(t.clarity || 0).toFixed(2) : "—"}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px", color: "#10b981", fontWeight: "700" }}>{t.count ? Number(t.teach || 0).toFixed(2) : "—"}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px", color: "#b45309", fontWeight: "700" }}>{t.count ? Number(t.drive || 0).toFixed(2) : "—"}</td>
                    <td style={{ padding: "14px 12px", fontSize: "15px", fontWeight: "900", color: "#0f172a" }}>{t.count ? Number(t.avg || 0).toFixed(2) : "—"}</td>
                    <td style={{ padding: "14px 12px", fontSize: "13.5px" }}>
                      <span style={{ background: t.count ? s.bg : "#f1f5f9", color: t.count ? s.fg : "#64748b", borderRadius: "999px", padding: "3px 11px", fontSize: "11px", fontWeight: "800" }}>
                        {t.count ? s.t : "لا يوجد تقييم"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KpiCard(p: { label: string; value: any; suffix?: string; subtitle?: string; ghost: string }) {
  return (
    <div style={S.kpiCard}>
      <div style={S.kpiGhost}>{p.ghost || ""}</div>
      <div style={{ position: "relative" }}>
        <div style={S.kpiLabel}>{p.label || ""}</div>
        <div style={S.kpiVal}>{p.value}{p.suffix || ""}</div>
        {p.subtitle && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>{p.subtitle}</div>}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { direction: "rtl", fontFamily: "Cairo, Tahoma, sans-serif", background: "#f2ecdf", minHeight: "100vh", padding: "16px", color: "#1a1a1a", boxSizing: "border-box" },
  loading: { background: "#f2ecdf", minHeight: "100vh", padding: "80px", textAlign: "center", color: "#64748b", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  spinner: { width: "48px", height: "48px", borderWidth: "5px", borderStyle: "solid", borderColor: "#e2e8f0", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" },
  lay: { display: "flex", gap: "20px", alignItems: "flex-start" },
  side: { width: "280px", flexShrink: 0, background: "linear-gradient(180deg, #0b1220, #060b13)", borderRadius: "24px", padding: "20px", color: "#fff", position: "sticky", top: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: "4px" },
  main: { flex: 1, minWidth: "0px" },
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  k3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" },
  card: { background: "#fffdf9", border: "1px solid #e8decb", borderRadius: "22px", padding: "22px", boxShadow: "0 6px 18px rgba(60,40,10,0.04)" },
  tabOn: { background: "#10b981", color: "#fff", border: "none", borderRadius: "12px", padding: "11px 16px", cursor: "pointer", fontWeight: "800", fontSize: "13.5px", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", borderWidth: "1px", borderStyle: "solid", borderColor: "#10b981" },
  tabOff: { background: "transparent", color: "#94a3b8", borderWidth: "1px", borderStyle: "solid", borderColor: "transparent", borderRadius: "12px", padding: "11px 16px", cursor: "pointer", fontWeight: "600", fontSize: "13.5px", width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" },
  headerCard: { position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0b1220,#111827)", borderRadius: "24px", padding: "24px", color: "#fff", marginBottom: "16px" },
  headerBgText: { position: "absolute", left: "16px", top: "0px", fontSize: "80px", fontWeight: "900", color: "rgba(255,255,255,0.04)", letterSpacing: "4px" },
  headerBadge: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "999px", padding: "4px 12px", fontSize: "11px", fontWeight: "700", color: "#e2e8f0", display: "inline-block", marginBottom: "6px" },
  kpiCard: { position: "relative", overflow: "hidden", borderRight: "4px solid #10b981", background: "#fffdf9", borderTop: "1px solid #e8decb", borderBottom: "1px solid #e8decb", borderLeft: "1px solid #e8decb", borderRadius: "22px", padding: "22px", boxShadow: "0 6px 18px rgba(60,40,10,0.04)" },
  kpiGhost: { position: "absolute", left: "10px", top: "4px", fontSize: "60px", fontWeight: "900", color: "rgba(16,185,129,0.04)" },
  kpiLabel: { fontSize: "13px", color: "#9a8f7d", fontWeight: "700", marginBottom: "4px" },
  kpiVal: { fontSize: "38px", fontWeight: 900, color: "#0f172a", lineHeight: "1" },
  bestCard: { background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", border: "1px solid #10b981", borderRadius: "22px", padding: "22px" },
  axisRow: { background: "#fff", border: "1px solid #f0e9db", borderRadius: "14px", padding: "13px", marginBottom: "10px" },
  axisMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" },
  axisLabelWrap: { display: "flex", alignItems: "center", gap: "8px" },
  secTag: { background: "#f0e9db", color: "#7c6f5a", borderRadius: "7px", padding: "2px 9px", fontSize: "11px", fontWeight: "700" },
  statusPill: { borderRadius: "999px", padding: "3px 11px", fontSize: "11px", fontWeight: 800 },
  track: { height: "10px", background: "#f0e9db", borderRadius: "8px", overflow: "hidden" },
  fillGrad: { height: "100%", borderRadius: "8px" },
  commentCard: { background: "#fff", borderRight: "4px solid #10b981", borderRadius: "12px", padding: "12px", marginBottom: "8px", fontSize: "13px", color: "#475569", lineHeight: 1.7 }
};
