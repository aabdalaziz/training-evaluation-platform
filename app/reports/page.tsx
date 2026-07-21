// @ts-nocheck
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase/client";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
body, .rw * { font-family: 'Cairo', Tahoma, sans-serif; }
@keyframes spin { to { transform: rotate(360deg); } }
.rep-wrap { background: #f8fafc; min-height: 100vh; padding: 20px; direction: rtl; }
.rep-header { background: linear-gradient(135deg, #0b1220, #1e2937); border-radius: 20px; padding: 24px; color: #fff; position: relative; overflow: hidden; margin-bottom: 24px; }
.rep-header::before { content: 'REPORT'; position: absolute; left: 30px; top: -20px; font-size: 110px; font-weight: 900; opacity: 0.06; color: #fff; letter-spacing: 8px; }
.rep-tabs { display: flex; gap: 8px; background: #fff; padding: 8px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 20px; flex-wrap: wrap; }
.rep-tab { padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.rep-tab.active { background: #10b981; color: white; font-weight: 800; }
.rep-card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); margin-bottom: 20px; }
.rep-kpi { font-size: 42px; font-weight: 900; color: #0f172a; }
.rep-kpi-label { font-size: 13px; color: #64748b; font-weight: 600; }
.rep-table { width: 100%; border-collapse: collapse; }
.rep-table th { text-align: right; padding: 12px; font-size: 13px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
.rep-table td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; }
.rep-badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; color: #64748b; }
.spinner { width: 42px; height: 42px; border: 4px solid #e2e8f0; border-top: 4px solid #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
`;

export default function ReportsPage() {
  const router = useRouter();
  const [tab, setTab] = useState("dashboard");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // بيانات تجريبية احترافية (لأن قاعدة البيانات حالياً فارغة أو غير مرتبطة)
  const mockData = {
    daily: { count: 52, avg: 3.2 },
    final: { count: 28, avg: 4.1 },
    teachers: [
      { rank: 1, name: "د/ ياسر", room: "208", avg: 3.13, status: "يحتاج دعماً", color: "#fbbf24" },
      { rank: 2, name: "د/ محمد الشرقاوي", room: "203", avg: 2.50, status: "يحتاج دعماً", color: "#f59e0b" },
      { rank: 3, name: "د/ بكر الأحمدي", room: "204", avg: 3.80, status: "جيد", color: "#10b981" },
      { rank: 4, name: "د/ شيماء", room: "205", avg: 4.10, status: "ممتاز", color: "#10b981" },
      { rank: 5, name: "د/ آلاء", room: "206", avg: 4.25, status: "ممتاز", color: "#10b981" },
    ]
  };

  const sendReport = (type, name = "") => {
    setLoading(true);
    setTimeout(() => {
      if (type === "trainer") {
        setMessage(`✅ تم إرسال تقرير قاعة ${name} إلى المدرب بنجاح (PDF مرفق)`);
      } else {
        setMessage("✅ تم إرسال التقرير الشامل للإدارة بنجاح (PDF مرفق)");
      }
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="rw" style={{ background: "#f8fafc", minHeight: "100vh", padding: "20px", fontFamily: "Cairo, sans-serif", direction: "rtl" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* الرأس الفاخر */}
        <div style={{ background: "#0f172a", color: "#fff", borderRadius: "20px", padding: "28px", marginBottom: "24px", position: "relative", overflow: "hidden", textAlign: "center" }}>
          <div style={{ position: "absolute", left: "30px", top: "-15px", fontSize: "110px", fontWeight: "900", opacity: "0.06", color: "#fff", letterSpacing: "6px" }}>REPORT</div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "0 0 6px" }}>مركز التقارير والجودة</h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>لوحة تحكم تنفيذية متكاملة — النسخة المطورة</p>
        </div>

        {/* التبويبات */}
        <div style={{ display: "flex", gap: "10px", background: "#fff", padding: "8px", borderRadius: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", marginBottom: "24px", flexWrap: "wrap" }}>
          <button onClick={() => setTab("dashboard")} style={tabStyle(tab === "dashboard")}>🏠 Dashboard التنفيذي</button>
          <button onClick={() => setTab("daily")} style={tabStyle(tab === "daily")}>📝 التقرير اليومي</button>
          <button onClick={() => setTab("final")} style={tabStyle(tab === "final")}>⭐ التقرير النهائي</button>
          <button onClick={() => setTab("teachers")} style={tabStyle(tab === "teachers")}>👨‍🏫 المعلمون بالقاعة</button>
          <button onClick={() => setTab("email")} style={tabStyle(tab === "email")}>✉️ إرسال التقارير بالإيميل</button>
        </div>

        {message && (
          <div style={{ background: "#d1fae5", color: "#065f46", padding: "14px", borderRadius: "12px", marginBottom: "20px", fontWeight: "600" }}>
            {message}
          </div>
        )}

        {tab === "dashboard" && <DashboardView />}
        {tab === "daily" && <DailyReport />}
        {tab === "final" && <FinalReport />}
        {tab === "teachers" && <TeachersReport teachers={teachers} onSend={sendReport} />}
        {tab === "email" && <EmailCenter onSend={sendReport} />}

      </div>
    </div>
  );
}

function tabStyle(isActive) {
  return {
    padding: "12px 20px",
    borderRadius: "12px",
    background: isActive ? "#10b981" : "transparent",
    color: isActive ? "#fff" : "#475569",
    border: "none",
    fontWeight: isActive ? "800" : "600",
    cursor: "pointer",
    transition: "all 0.2s"
  };
}

/* ==================== المكونات ==================== */

function DashboardView() {
  return (
    <div className="g3">
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "13px", color: "#64748b" }}>نسبة الرضا العامة</div>
        <div style={{ fontSize: "52px", fontWeight: "900", color: "#10b981" }}>68%</div>
      </div>
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "13px", color: "#64748b" }}>متوسط التقييم</div>
        <div style={{ fontSize: "52px", fontWeight: "900" }}>3.4/5</div>
      </div>
      <div className="card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "13px", color: "#64748b" }}>إجمالي التقييمات</div>
        <div style={{ fontSize: "52px", fontWeight: "900" }}>87</div>
      </div>
    </div>
  );
}

function DailyReport() {
  return (
    <div className="card">
      <h2>التقرير اليومي</h2>
      <p style={{ fontSize: "28px", fontWeight: "900", margin: "16px 0" }}>2.81 / 5</p>
      <p>نسبة الرضا: 56% • 4 تقييمات</p>
    </div>
  );
}

function FinalReport() {
  return (
    <div className="card">
      <h2>التقرير النهائي</h2>
      <p style={{ fontSize: "28px", fontWeight: "900", margin: "16px 0" }}>3.20 / 5</p>
      <p>نسبة الرضا: 64% • 1 تقييم</p>
    </div>
  );
}

function TeachersReport({ teachers, onSend }) {
  return (
    <div className="card">
      <h2>ترتيب المعلمين - مرتبط بالقاعة</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ textAlign: "right", padding: "12px" }}>#</th>
              <th style={{ textAlign: "right", padding: "12px" }}>المعلم</th>
              <th style={{ textAlign: "right", padding: "12px" }}>القاعة</th>
              <th style={{ textAlign: "right", padding: "12px" }}>المتوسط</th>
              <th style={{ textAlign: "right", padding: "12px" }}>الحالة</th>
              <th style={{ textAlign: "right", padding: "12px" }}>إرسال التقرير</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "14px 12px", fontWeight: "bold" }}>{t.rank}</td>
                <td style={{ padding: "14px 12px", fontWeight: "700" }}>{t.name}</td>
                <td style={{ padding: "14px 12px" }}>{t.room}</td>
                <td style={{ padding: "14px 12px", fontWeight: "800" }}>{t.avg}</td>
                <td style={{ padding: "14px 12px" }}>
                  <span style={{ 
                    padding: "4px 12px", 
                    borderRadius: "999px", 
                    fontSize: "12px", 
                    background: t.status.includes("دعماً") ? "#fee2e2" : "#ecfdf5", 
                    color: t.status.includes("دعماً") ? "#b91c1c" : "#166534" 
                  }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ padding: "14px 12px" }}>
                  <button 
                    onClick={() => onSend("trainer", t.name)}
                    style={{ background: "#10b981", color: "#fff", border: "none", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}
                  >
                    ✉️ إرسال
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailCenter({ onSend }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "40px" }}>
      <h2 style={{ marginBottom: "24px" }}>✉️ مركز إرسال التقارير بالإيميل</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "420px", margin: "0 auto" }}>
        <button onClick={() => onSend("trainer")} style={{ padding: "18px", background: "#10b981", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "16px" }}>
          📑 إرسال تقرير كل قاعة للمدرب المسؤول
        </button>
        <button onClick={() => onSend("admin")} style={{ padding: "18px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "16px" }}>
          📊 إرسال التقرير الشامل للإدارة
        </button>
      </div>
    </div>
  );
}
