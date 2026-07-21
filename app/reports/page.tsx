"use client";
import { useState } from "react";

export default function Reports() {
  const [tab, setTab] = useState("teachers");
  const [message, setMessage] = useState("");

  const teachers = [
    { rank: 1, name: "د/ ياسر", room: "208", avg: "3.13", status: "يحتاج دعماً" },
    { rank: 2, name: "د/ محمد الشرقاوي", room: "203", avg: "2.50", status: "يحتاج دعماً" },
    { rank: 3, name: "د/ بكر الأحمدي", room: "204", avg: "—", status: "لا يوجد تقييم" },
    { rank: 4, name: "د/ شيماء", room: "205", avg: "—", status: "لا يوجد تقييم" },
    { rank: 5, name: "د/ آلاء", room: "206", avg: "—", status: "لا يوجد تقييم" },
  ];

  const sendReport = (type, name = "") => {
    if (type === "trainer") {
      setMessage(`✅ تم إرسال تقرير قاعة ${name} إلى المدرب بنجاح`);
    } else {
      setMessage("✅ تم إرسال التقرير الشامل للإدارة بنجاح");
    }
    setTimeout(() => setMessage(""), 4000);
  };

  return (
    <div style={{ 
      background: "#0f172a", 
      minHeight: "100vh", 
      padding: "30px", 
      color: "#e2e8f0", 
      fontFamily: "Cairo, sans-serif",
      direction: "rtl",
      textAlign: "right"
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        <div style={{ 
          background: "linear-gradient(135deg, #1e2937, #0f172a)", 
          borderRadius: "20px", 
          padding: "30px", 
          textAlign: "center",
          marginBottom: "30px",
          position: "relative"
        }}>
          <div style={{ 
            position: "absolute", 
            left: "40px", 
            top: "-10px", 
            fontSize: "90px", 
            fontWeight: "900", 
            opacity: "0.07",
            color: "#fff"
          }}>REPORT</div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "0 0 8px" }}>
            مركز التقارير والجودة
          </h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>النسخة الاحترافية المطورة</p>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "30px", flexWrap: "wrap" }}>
          <button onClick={() => setTab("daily")} style={tabStyle(tab === "daily")}>📝 التقرير اليومي</button>
          <button onClick={() => setTab("final")} style={tabStyle(tab === "final")}>⭐ التقرير النهائي</button>
          <button onClick={() => setTab("teachers")} style={tabStyle(tab === "teachers")}>👨‍🏫 المعلمون بالقاعة</button>
          <button onClick={() => setTab("email")} style={tabStyle(tab === "email")}>✉️ إرسال التقارير</button>
        </div>

        {message && <div style={{ background: "#052e16", color: "#4ade80", padding: "16px", borderRadius: "12px", marginBottom: "20px", fontWeight: "bold" }}>{message}</div>}

        {tab === "teachers" && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "24px" }}>
            <h2 style={{ color: "#fff", marginBottom: "20px" }}>ترتيب المعلمين - مرتبط بالقاعة</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #334155" }}>
                  <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>#</th>
                  <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>المعلم</th>
                  <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>القاعة</th>
                  <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>المتوسط</th>
                  <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>الحالة</th>
                  <th style={{ textAlign: "right", padding: "14px", color: "#94a3b8" }}>إرسال التقرير</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #334155" }}>
                    <td style={{ padding: "14px", fontWeight: "bold", color: "#fbbf24" }}>{t.rank}</td>
                    <td style={{ padding: "14px", fontWeight: "700", color: "#e2e8f0" }}>{t.name}</td>
                    <td style={{ padding: "14px" }}>{t.room}</td>
                    <td style={{ padding: "14px", fontWeight: "700", color: "#67e8f9" }}>{t.avg}</td>
                    <td style={{ padding: "14px" }}>
                      <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "12px", background: t.status.includes("دعماً") ? "#fee2e2" : "#ecfdf5", color: t.status.includes("دعماً") ? "#b91c1c" : "#166534" }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px" }}>
                      <button 
                        onClick={() => sendReport("trainer", t.name)}
                        style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
                      >
                        ✉️ إرسال
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "email" && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "40px", textAlign: "center" }}>
            <h2>✉️ مركز إرسال التقارير بالإيميل</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "420px", margin: "30px auto" }}>
              <button onClick={() => sendReport("trainer")} style={{ padding: "18px", background: "#10b981", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "16px" }}>
                📑 إرسال تقرير كل قاعة للمدرب المسؤول
              </button>
              <button onClick={() => sendReport("admin")} style={{ padding: "18px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "16px" }}>
                📊 إرسال التقرير الشامل للإدارة
              </button>
            </div>
            {message && <div style={{ marginTop: "30px", padding: "16px", background: "#052e16", borderRadius: "12px", color: "#4ade80" }}>{message}</div>}
          </div>
        )}

        {(tab === "daily" || tab === "final") && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "40px", textAlign: "center", color: "#e2e8f0" }}>
            <h2>{tab === "daily" ? "التقرير اليومي" : "التقرير النهائي"}</h2>
            <p style={{ fontSize: "32px", margin: "30px 0" }}>
              {tab === "daily" ? "2.81 / 5" : "3.20 / 5"}
            </p>
            <p>التقرير الاحترافي قيد التطوير</p>
          </div>
        )}
      </div>
    </div>
  );

  function sendReport(type, name = "") {
    if (type === "trainer") {
      setMessage(`✅ تم إرسال تقرير قاعة ${name} إلى المدرب بنجاح`);
    } else {
      setMessage("✅ تم إرسال التقرير الشامل للإدارة بنجاح");
    }
  }
}

function tabStyle(isActive) {
  return {
    padding: "14px 24px",
    borderRadius: "12px",
    background: isActive ? "#10b981" : "#1e2937",
    color: "#fff",
    border: "none",
    fontWeight: "700",
    cursor: "pointer"
  };
}
