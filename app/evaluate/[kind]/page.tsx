// EVAL-PIPE-OK
export default function EvaluationPage() {
  return (
    <div style={{ direction: "rtl", fontFamily: "Tahoma", padding: 50, textAlign: "center" }}>
      <div style={{ background: "#2563eb", color: "#fff", padding: "20px 40px", borderRadius: 16, display: "inline-block", fontSize: 24, fontWeight: "bold" }}>
        ✅ مسار الاستبيان سليم ويعمل
      </div>
      <p style={{ marginTop: 20, color: "#64748b" }}>إذا رأيت هذا الصندوق الأزرق، فسنضع الاستبيان الكامل فوقه الآن.</p>
    </div>
  );
}
