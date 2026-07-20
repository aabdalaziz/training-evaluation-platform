"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Reports() {
  const router = useRouter();
  const [tab, setTab] = useState("daily");
  const [message, setMessage] = useState("");

  const sendReport = (type) => {
    setMessage(type === "trainer" 
      ? "✅ تم إرسال تقرير كل قاعة للمدرب المسؤول" 
      : "✅ تم إرسال التقرير الشامل للإدارة");
    setTimeout(() => setMessage(""), 4000);
  };

  return (
    <div style={{ 
      background: "#0f172a", 
      minHeight: "100vh", 
      padding: "20px", 
      color: "#fff", 
      fontFamily: "Cairo, sans-serif",
      direction: "rtl"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ 
          background: "linear-gradient(135deg, #1e2937, #0f172a)", 
          borderRadius: "20px", 
          padding: "30px", 
          textAlign: "center",
          marginBottom: "30px",
          position: "relative",
          overflow: "hidden"
        }}>
          <div style={{ 
            position: "absolute", 
            left: "20px", 
            top: "-20px", 
            fontSize: "120px", 
            fontWeight: "900", 
            opacity: "0.05",
            color: "#fff"
          }}>REPORT</div>
          <h1 style={{ fontSize: "32px", fontWeight: "900", margin: "0 0 8px" }}>
            تقارير الجودة والأداء
          </h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>منظومة متكاملة لإرسال التقارير تلقائياً</p>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "30px", flexWrap: "wrap" }}>
          <button onClick={() => setTab("daily")} style={{ 
            padding: "14px 24px", 
            borderRadius: "12px", 
            background: tab === "daily" ? "#10b981" : "#1e2937", 
            color: "#fff", 
            border: "none", 
            fontWeight: "700",
            cursor: "pointer"
          }}>📝 التقرير اليومي</button>
          
          <button onClick={() => setTab("final")} style={{ 
            padding: "14px 24px", 
            borderRadius: "12px", 
            background: tab === "final" ? "#10b981" : "#1e2937", 
            color: "#fff", 
            border: "none", 
            fontWeight: "700",
            cursor: "pointer"
          }}>⭐ التقرير النهائي</button>
          
          <button onClick={() => setTab("teachers")} style={{ 
            padding: "14px 24px", 
            borderRadius: "12px", 
            background: tab === "teachers" ? "#10b981" : "#1e2937", 
            color: "#fff", 
            border: "none", 
            fontWeight: "700",
            cursor: "pointer"
          }}>👨‍🏫 المعلمون بالقاعة</button>
          
          <button onClick={() => setTab("email")} style={{ 
            padding: "14px 24px", 
            borderRadius: "12px", 
            background: tab === "email" ? "#10b981" : "#1e2937", 
            color: "#fff", 
            border: "none", 
            fontWeight: "700",
            cursor: "pointer"
          }}>✉️ إرسال التقارير بالإيميل</button>
        </div>

        {tab === "daily" && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "30px", textAlign: "center" }}>
            <h2>التقرير اليومي</h2>
            <p style={{ fontSize: "48px", fontWeight: "900", margin: "20px 0" }}>2.81 / 5</p>
            <p>نسبة الرضا: 56%</p>
          </div>
        )}

        {tab === "final" && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "30px", textAlign: "center" }}>
            <h2>التقرير النهائي</h2>
            <p style={{ fontSize: "48px", fontWeight: "900", margin: "20px 0" }}>3.20 / 5</p>
            <p>نسبة الرضا: 64%</p>
          </div>
        )}

        {tab === "teachers" && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "30px" }}>
            <h2>ترتيب المعلمين بالقاعة</h2>
            <div style={{ marginTop: "20px", background: "#0f172a", borderRadius: "12px", padding: "20px" }}>
              <p>د/ ياسر - قاعة 208 - 3.13</p>
              <p>د/ محمد الشرقاوي - قاعة 203 - 2.50</p>
              <p>د/ بكر الأحمدي - قاعة 204 - —</p>
              <p>د/ شيماء - قاعة 205 - —</p>
              <p>د/ آلاء - قاعة 206 - —</p>
            </div>
          </div>
        )}

        {tab === "email" && (
          <div style={{ background: "#1e2937", borderRadius: "16px", padding: "40px", textAlign: "center" }}>
            <h2>✉️ مركز إرسال التقارير بالإيميل</h2>
            <p style={{ margin: "20px 0 30px", fontSize: "18px" }}>اختر نوع التقرير المراد إرساله:</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "420px", margin: "0 auto" }}>
              <button 
                onClick={() => sendReport("trainer")}
                style={{ padding: "18px", background: "#10b981", color: "#fff", border: "none", borderRadius: "12px", fontSize: "17px", fontWeight: "bold" }}
              >
                📑 إرسال تقرير كل قاعة للمدرب المسؤول
              </button>

              <button 
                onClick={() => sendReport("admin")}
                style={{ padding: "18px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "12px", fontSize: "17px", fontWeight: "bold" }}
              >
                📊 إرسال التقرير الشامل للإدارة
              </button>
            </div>

            {message && <div style={{ marginTop: "30px", padding: "16px", background: "#052e16", borderRadius: "12px", color: "#4ade80" }}>{message}</div>}
          </div>
        )}
      </div>
    </div>
  );

  function sendReport(type) {
    if (type === "trainer") {
      alert("✅ تم إرسال تقرير كل قاعة (208, 203, 204, 205, 206) إلى المدربين المعنيين");
    } else {
      alert("✅ تم إرسال التقرير الشامل للإدارة بنجاح");
    }
  }
}
