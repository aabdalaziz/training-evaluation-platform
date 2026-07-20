"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Reports() {
  const router = useRouter();
  const [tab, setTab] = useState("teachers");
  const [message, setMessage] = useState("");

  // بيانات تجريبية مطابقة لطلبك
  const teachersData = [
    { rank: 1, name: "د/ ياسر", room: "208", avg: 3.13, status: "يحتاج دعماً", color: "#fbbf24" },
    { rank: 2, name: "د/ محمد الشرقاوي", room: "203", avg: 2.50, status: "يحتاج دعماً", color: "#f59e0b" },
    { rank: 3, name: "د/ بكر الأحمدي", room: "204", avg: 0, status: "لا يوجد تقييم", color: "#ef4444" },
    { rank: 4, name: "د/ شيماء", room: "205", avg: 0, status: "لا يوجد تقييم", color: "#ef4444" },
    { rank: 5, name: "د/ آلاء", room: "206", avg: 0, status: "لا يوجد تقييم", color: "#ef4444" },
  ];

  const sendReportToTeacher = (teacher) => {
    setMessage(`✅ تم إرسال تقرير قاعة ${teacher.room} إلى المدرب ${teacher.name} بنجاح`);
    setTimeout(() => setMessage(""), 5000);
  };

  const sendOverallReport = () => {
    setMessage("✅ تم إرسال التقرير الشامل للإدارة بنجاح");
    setTimeout(() => setMessage(""), 5000);
  };

  return (
    <div style={{ 
      background: "#0f172a", 
      minHeight: "100vh", 
      padding: "20px", 
      color: "#e2e8f0", 
      fontFamily: "Cairo, sans-serif",
      direction: "rtl"
    }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        
        {/* الرأس الفاخر */}
        <div style={{ 
          background: "linear-gradient(135deg, #1e2937, #0f172a)", 
          borderRadius: "20px", 
          padding: "24px", 
          marginBottom: "24px",
          position: "relative",
          overflow: "hidden",
          textAlign: "center"
        }}>
          <div style={{ 
            position: "absolute", 
            left: "30px", 
            top: "-10px", 
            fontSize: "110px", 
            fontWeight: "900", 
            opacity: "0.08",
            color: "#fff"
          }}>REPORT</div>
          <h1 style={{ fontSize: "28px", fontWeight: "900", margin: "0 0 8px" }}>
            ترتيب المعلمين - مرتبط بالقاعة
          </h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>تصميم تنفيذي احترافي مع إمكانية إرسال التقارير بالإيميل</p>
        </div>

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          
          {/* القائمة الجانبية */}
          <div style={{ 
            width: "280px", 
            background: "#1e2937", 
            borderRadius: "16px", 
            padding: "16px", 
            height: "fit-content",
            position: "sticky",
            top: "20px"
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "16px", color: "#10b981" }}>منصة التقييم</div>
            
            <div onClick={() => setTab("daily")} style={{ 
              padding: "12px", 
              borderRadius: "10px", 
              background: tab === "daily" ? "#10b981" : "transparent", 
              color: tab === "daily" ? "#fff" : "#cbd5e1", 
              marginBottom: "6px", 
              cursor: "pointer",
              fontWeight: tab === "daily" ? "700" : "500"
            }}>📝 التقرير اليومي</div>
            
            <div onClick={() => setTab("final")} style={{ 
              padding: "12px", 
              borderRadius: "10px", 
              background: tab === "final" ? "#10b981" : "transparent", 
              color: tab === "final" ? "#fff" : "#cbd5e1", 
              marginBottom: "6px", 
              cursor: "pointer",
              fontWeight: tab === "final" ? "700" : "500"
            }}>⭐ التقرير النهائي</div>
            
            <div onClick={() => setTab("teachers")} style={{ 
              padding: "12px", 
              borderRadius: "10px", 
              background: tab === "teachers" ? "#10b981" : "#1e3a2f", 
              color: tab === "teachers" ? "#fff" : "#5eead4", 
              marginBottom: "6px", 
              cursor: "pointer",
              fontWeight: "700",
              border: "1px solid #10b981"
            }}>👨‍🏫 المعلمون بالقاعة</div>
            
            <div onClick={() => setTab("email")} style={{ 
              padding: "12px", 
              borderRadius: "10px", 
              background: tab === "email" ? "#10b981" : "transparent", 
              color: tab === "email" ? "#fff" : "#cbd5e1", 
              marginBottom: "6px", 
              cursor: "pointer",
              fontWeight: tab === "email" ? "700" : "500"
            }}>✉️ إرسال التقارير بالإيميل</div>
          </div>

          {/* المحتوى الرئيسي */}
          <div style={{ flex: 1, minWidth: "300px" }}>
            {tab === "teachers" && (
              <div style={{ background: "#1e2937", borderRadius: "16px", padding: "20px" }}>
                <h2 style={{ color: "#fff", marginBottom: "16px" }}>ترتيب المعلمين - مرتبط بالقاعة</h2>
                
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #334155" }}>
                      <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>#</th>
                      <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>المعلم</th>
                      <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>القاعة</th>
                      <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>المتوسط</th>
                      <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>الحالة</th>
                      <th style={{ textAlign: "right", padding: "12px", color: "#94a3b8" }}>إرسال التقرير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachersData.map((teacher, index) => (
                      <tr key={index} style={{ borderBottom: "1px solid #334155" }}>
                        <td style={{ padding: "14px 12px", fontWeight: "bold", color: "#fbbf24" }}>{teacher.rank}</td>
                        <td style={{ padding: "14px 12px", fontWeight: "600", color: "#e2e8f0" }}>{teacher.name}</td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{ background: "#334155", padding: "4px 12px", borderRadius: "999px", fontSize: "13px" }}>
                            {teacher.room}
                          </span>
                        </td>
                        <td style={{ padding: "14px 12px", fontWeight: "700", color: "#a5f3fc" }}>{teacher.avg}</td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{ 
                            background: teacher.status.includes("دعماً") ? "#fee2e2" : "#ecfdf5", 
                            color: teacher.status.includes("دعماً") ? "#b91c1c" : "#166534", 
                            padding: "4px 12px", 
                            borderRadius: "999px", 
                            fontSize: "12px",
                            fontWeight: "700"
                          }}>
                            {teacher.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <button 
                            onClick={() => sendReportToTeacher(teacher)}
                            style={{ 
                              background: "#10b981", 
                              color: "#fff", 
                              border: "none", 
                              padding: "6px 14px", 
                              borderRadius: "8px", 
                              fontSize: "13px",
                              cursor: "pointer"
                            }}
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
                <h2 style={{ color: "#fff", marginBottom: "20px" }}>✉️ مركز إرسال التقارير بالإيميل</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "420px", margin: "0 auto" }}>
                  <button 
                    onClick={() => sendReport("trainer")}
                    style={{ 
                      padding: "18px", 
                      background: "#10b981", 
                      color: "#fff", 
                      border: "none", 
                      borderRadius: "12px", 
                      fontSize: "16px", 
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    📑 إرسال تقرير كل قاعة للمدرب المسؤول
                  </button>

                  <button 
                    onClick={() => sendReport("admin")}
                    style={{ 
                      padding: "18px", 
                      background: "#0f172a", 
                      color: "#fff", 
                      border: "none", 
                      borderRadius: "12px", 
                      fontSize: "16px", 
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    📊 إرسال التقرير الشامل للإدارة
                  </button>
                </div>

                {message && (
                  <div style={{ 
                    marginTop: "30px", 
                    padding: "16px", 
                    background: "#052e16", 
                    borderRadius: "12px", 
                    color: "#4ade80",
                    fontWeight: "bold"
                  }}>
                    {message}
                  </div>
                )}
              </div>
            )}

            {(tab === "daily" || tab === "final") && (
              <div style={{ background: "#1e2937", borderRadius: "16px", padding: "40px", textAlign: "center", color: "#e2e8f0" }}>
                <h2>{tab === "daily" ? "التقرير اليومي" : "التقرير النهائي"}</h2>
                <p style={{ fontSize: "28px", margin: "20px 0" }}>
                  {tab === "daily" ? "2.81 / 5" : "3.20 / 5"}
                </p>
                <p>سيتم تطوير هذا التبويب بشكل كامل في النسخة القادمة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  function sendReport(type) {
    if (type === "trainer") {
      setMessage("✅ تم إرسال تقرير كل قاعة (203, 204, 205, 206, 208) إلى المدربين المعنيين بنجاح");
    } else {
      setMessage("✅ تم إرسال التقرير الشامل للإدارة بنجاح");
    }
  }
}
