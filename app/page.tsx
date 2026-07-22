// @ts-nocheck
"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { dict } from "../lib/i18n"; // استيراد القاموس

export default function HomePage() {
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState("");
  const [lang, setLang] = useState("ar"); // اللغة الافتراضية

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.origin);
      // استرجاع اللغة من التخزين إن وجدت
      const savedLang = localStorage.getItem("platform_lang");
      if (savedLang) setLang(savedLang);
    }
  }, []);

  const toggleLang = () => {
    const newLang = lang === "ar" ? "en" : "ar";
    setLang(newLang);
    localStorage.setItem("platform_lang", newLang);
  };

  const t = dict[lang];

  return (
    <main style={{ 
      direction: t.dir, 
      fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : "'Inter', sans-serif", 
      background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", // خلفية متدرجة فاتحة
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      padding: "30px 20px", 
      color: "#0f172a" 
    }}>
      
      {/* زر تبديل اللغة أعلى الصفحة */}
      <div style={{ width: "100%", maxWidth: "900px", display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
        <button onClick={toggleLang} style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: "12px", padding: "8px 16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 6px rgba(0,0,0,0.02)", display: "flex", alignItems: "center", gap: "8px" }}>
          🌐 {t.switchLang}
        </button>
      </div>

      {/* الترويسة والشعار بتصميم زجاجي */}
      <div style={{ textAlign: "center", marginBottom: "50px", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(10px)", padding: "40px", borderRadius: "30px", border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 20px 40px rgba(0,0,0,0.03)", width: "100%", maxWidth: "900px" }}>
        <div style={{ width: "90px", height: "90px", borderRadius: "28px", background: "linear-gradient(135deg, #10b981, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "45px", margin: "0 auto 20px", boxShadow: "0 15px 30px rgba(16,185,129,0.3)" }}>
          🏅
        </div>
        <h1 style={{ fontSize: "42px", fontWeight: 900, color: "#0f172a", margin: "0 0 15px", letterSpacing: lang === 'en' ? "-1px" : "0" }}>{t.platformName}</h1>
        <p style={{ fontSize: "18px", color: "#475569", margin: "0 auto", maxWidth: "600px", lineHeight: "1.7" }}>
          {lang === 'ar' ? 'مرحباً بك في النظام المركزي لتقييم جودة البرامج التدريبية. يرجى اختيار نوع التقييم المطلوب.' : 'Welcome to the Central System for Training Quality Evaluation. Please select the required evaluation type.'}
        </p>
      </div>

      {/* أزرار التقييم بلمسة إبداعية */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: "900px", marginBottom: "60px" }}>
        
        <div onClick={() => router.push('/evaluate/daily')} style={{ flex: "1 1 350px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "30px", padding: "40px 30px", textAlign: "center", cursor: "pointer", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 10px 30px rgba(37,99,235,0.05)", position: "relative", overflow: "hidden" }} 
             onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(37,99,235,0.1)'; }} 
             onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(37,99,235,0.05)'; }}>
          <div style={{ position: "absolute", top: "-30px", right: lang === 'ar' ? "-30px" : "auto", left: lang === 'en' ? "-30px" : "auto", fontSize: "150px", opacity: 0.02, transform: lang === 'ar' ? "rotate(15deg)" : "rotate(-15deg)" }}>📝</div>
          <div style={{ fontSize: "50px", marginBottom: "20px", display: "inline-block", padding: "20px", background: "#eff6ff", borderRadius: "24px" }}>📝</div>
          <h2 style={{ fontSize: "26px", fontWeight: 900, color: "#2563eb", margin: "0 0 12px" }}>{t.evalDailyTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "15px", margin: "0 0 30px", lineHeight: "1.6" }}>{t.evalDailySub}</p>
          <button style={{ width: "100%", background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "#fff", border: "none", padding: "16px", borderRadius: "16px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", boxShadow: "0 8px 20px rgba(37,99,235,0.2)" }}>{t.startEval}</button>
        </div>

        <div onClick={() => router.push('/evaluate/final')} style={{ flex: "1 1 350px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "30px", padding: "40px 30px", textAlign: "center", cursor: "pointer", transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 10px 30px rgba(16,185,129,0.05)", position: "relative", overflow: "hidden" }}
             onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(16,185,129,0.1)'; }} 
             onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(16,185,129,0.05)'; }}>
          <div style={{ position: "absolute", top: "-30px", right: lang === 'ar' ? "-30px" : "auto", left: lang === 'en' ? "-30px" : "auto", fontSize: "150px", opacity: 0.02, transform: lang === 'ar' ? "rotate(15deg)" : "rotate(-15deg)" }}>⭐</div>
          <div style={{ fontSize: "50px", marginBottom: "20px", display: "inline-block", padding: "20px", background: "#ecfdf5", borderRadius: "24px" }}>⭐</div>
          <h2 style={{ fontSize: "26px", fontWeight: 900, color: "#10b981", margin: "0 0 12px" }}>{t.evalFinalTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "15px", margin: "0 0 30px", lineHeight: "1.6" }}>{t.evalFinalSub}</p>
          <button style={{ width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", padding: "16px", borderRadius: "16px", fontWeight: "bold", fontSize: "16px", cursor: "pointer", boxShadow: "0 8px 20px rgba(16,185,129,0.2)" }}>{t.startEval}</button>
        </div>
        
      </div>

      {currentUrl && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "30px", padding: "40px", width: "100%", maxWidth: "900px", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.02)" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "22px", fontWeight: 900, color: "#0f172a" }}>📷 {t.qrTitle}</h3>
          <p style={{ color: "#64748b", fontSize: "15px", marginBottom: "30px" }}>{lang === 'ar' ? 'قم بمسح الكود بكاميرا الجوال للوصول المباشر.' : 'Scan the code with your phone camera for direct access.'}</p>
          
          <div style={{ display: "flex", gap: "30px", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "20px", border: "1px dashed #cbd5e1", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <b style={{ color: "#2563eb", marginBottom: "16px", fontSize: "16px" }}>{t.evalDailyTitle}</b>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${currentUrl}/evaluate/daily`} alt="Daily QR" style={{ width: "180px", height: "180px", borderRadius: "12px" }} />
            </div>

            <div style={{ background: "#f8fafc", padding: "24px", borderRadius: "20px", border: "1px dashed #cbd5e1", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <b style={{ color: "#10b981", marginBottom: "16px", fontSize: "16px" }}>{t.evalFinalTitle}</b>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${currentUrl}/evaluate/final`} alt="Final QR" style={{ width: "180px", height: "180px", borderRadius: "12px" }} />
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "50px", width: "100%", maxWidth: "900px", textAlign: "center" }}>
        <button onClick={() => router.push('/login')} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", fontWeight: "bold", padding: "10px 20px" }}>
          {t.adminLogin}
        </button>
      </div>
    </main>
  );
}
