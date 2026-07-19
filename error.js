"use client";
export default function ReportsError({ error, reset }) {
  const msg = (error && (error.message || String(error))) || "خطأ غير معروف";
  const stk = (error && error.stack) || "";
  return (
    <div dir="rtl" style={{ fontFamily: "Tahoma, sans-serif", padding: 20, background: "#fff5f5", minHeight: "100vh" }}>
      <div style={{ background: "#dc2626", color: "#fff", padding: 16, borderRadius: 12, fontWeight: 800, fontSize: 18 }}>✅ تم التقاط الخطأ داخل الصفحة (أرسل هذه الصورة)</div>
      <div style={{ background: "#fff", border: "2px solid #dc2626", borderRadius: 12, padding: 16, marginTop: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14, lineHeight: 1.8 }}>
        <div style={{ fontWeight: 800, color: "#dc2626", marginBottom: 8 }}>الرسالة:</div>
        <div style={{ color: "#111" }}>{msg}</div>
        <div style={{ fontWeight: 800, color: "#dc2626", margin: "14px 0 8px" }}>التفاصيل التقنية:</div>
        <div style={{ color: "#333", fontSize: 12 }}>{stk}</div>
      </div>
      <button onClick={reset} style={{ marginTop: 14, background: "#0f172a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>إعادة المحاولة</button>
      <p style={{ color: "#666", fontSize: 13, marginTop: 14 }}>صوّر هذه الشاشة بالكامل وأرسلها لي — سنرى السبب الحقيقي الآن ونصلحه بدقة.</p>
    </div>
  );
}
