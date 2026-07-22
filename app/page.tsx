// @ts-nocheck
"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    // الحصول على الرابط الفعلي للمنصة لتوليد الباركود
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.origin);
    }
  }, []);

  return (
    <main style={{ direction: "rtl", fontFamily: "Cairo, Tahoma, sans-serif", background: "#f2ecdf", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", color: "#0b1220" }}>
      
      {/* الترويسة والشعار */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ width: "80px", height: "80px", borderRadius: "24px", background: "linear-gradient(135deg, #10b981, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", margin: "0 auto 20px", boxShadow: "0 10px 25px rgba(16,185,129,0.3)" }}>
          🏆
        </div>
        <h1 style={{ fontSize: "36px", fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>منصة الجودة والتقييم</h1>
        <p style={{ fontSize: "16px", color: "#64748b", margin: 0, maxWidth: "500px", lineHeight: "1.6" }}>
          مرحباً بك في النظام المركزي الموحد لتقييم جودة البرامج التدريبية. يرجى اختيار نوع التقييم المطلوب أدناه.
        </p>
      </div>

      {/* أزرار التقييم للطلاب */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: "800px", marginBottom: "50px" }}>
        
        {/* بطاقة التقييم اليومي */}
        <div onClick={() => router.push('/evaluate/daily')} style={{ flex: "1 1 300px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "30px", textAlign: "center", cursor: "pointer", transition: "all 0.3s ease", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }} 
             onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} 
             onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ position: "absolute", top: "-20px", right: "-20px", fontSize: "120px", opacity: 0.03 }}>📝</div>
          <div style={{ fontSize: "40px", marginBottom: "15px" }}>📝</div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#2563eb", margin: "0 0 10px" }}>التقييم اليومي</h2>
          <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px", lineHeight: "1.6" }}>خاص بتقييم المدرب وأداء الحصة التدريبية لهذا اليوم.</p>
          <button style={{ width: "100%", background: "#eff6ff", color: "#2563eb", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}>ابدأ التقييم ←</button>
        </div>

        {/* بطاقة التقييم النهائي */}
        <div onClick={() => router.push('/evaluate/final')} style={{ flex: "1 1 300px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "30px", textAlign: "center", cursor: "pointer", transition: "all 0.3s ease", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}
             onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} 
             onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ position: "absolute", top: "-20px", right: "-20px", fontSize: "120px", opacity: 0.03 }}>⭐</div>
          <div style={{ fontSize: "40px", marginBottom: "15px" }}>⭐</div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#10b981", margin: "0 0 10px" }}>التقييم النهائي</h2>
          <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px", lineHeight: "1.6" }}>خاص بالتقييم الشامل للبرنامج التدريبي والخدمات اللوجستية.</p>
          <button style={{ width: "100%", background: "#ecfdf5", color: "#10b981", border: "none", padding: "12px", borderRadius: "12px", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}>ابدأ التقييم ←</button>
        </div>
        
      </div>

      {/* منطقة الباركود (QR Codes) للإدارة */}
      {currentUrl && (
        <div style={{ background: "#fffdf9", border: "1px solid #e8decb", borderRadius: "24px", padding: "30px", width: "100%", maxWidth: "800px", textAlign: "center", boxShadow: "0 4px 15px rgba(60,40,10,0.04)" }}>
          <h3 style={{ margin: "0 0 5px", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>📷 باركود الوصول السريع للطلاب (QR Code)</h3>
          <p style={{ color: "#9a8f7d", fontSize: "13px", marginBottom: "24px" }}>يمكن للإدارة طباعة هذه الرموز أو عرضها على الشاشة ليقوم الطلاب بمسحها بجوالاتهم.</p>
          
          <div style={{ display: "flex", gap: "30px", flexWrap: "wrap", justifyContent: "center" }}>
            
            <div style={{ background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <b style={{ color: "#2563eb", marginBottom: "15px", fontSize: "15px" }}>باركود التقييم اليومي</b>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentUrl}/evaluate/daily`} alt="Daily QR" style={{ width: "150px", height: "150px" }} />
              <a href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${currentUrl}/evaluate/daily`} download="Daily_Evaluation_QR.png" target="_blank" style={{ marginTop: "15px", fontSize: "12px", color: "#64748b", textDecoration: "none", background: "#f1f5f9", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold" }}>📥 تحميل صورة الباركود</a>
            </div>

            <div style={{ background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <b style={{ color: "#10b981", marginBottom: "15px", fontSize: "15px" }}>باركود التقييم النهائي</b>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentUrl}/evaluate/final`} alt="Final QR" style={{ width: "150px", height: "150px" }} />
              <a href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${currentUrl}/evaluate/final`} download="Final_Evaluation_QR.png" target="_blank" style={{ marginTop: "15px", fontSize: "12px", color: "#64748b", textDecoration: "none", background: "#f1f5f9", padding: "6px 12px", borderRadius: "6px", fontWeight: "bold" }}>📥 تحميل صورة الباركود</a>
            </div>

          </div>
        </div>
      )}

      {/* زر الدخول للإدارة */}
      <div style={{ marginTop: "40px", borderTop: "1px solid #e2e8f0", paddingTop: "20px", width: "100%", maxWidth: "800px", textAlign: "center" }}>
        <button onClick={() => router.push('/login')} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>
          🔒 دخول مشرفي النظام والإدارة
        </button>
      </div>
    </main>
  );
}
