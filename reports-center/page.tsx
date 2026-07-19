"use client";
import { useRouter } from "next/navigation";
export default function Page() {
  const router = useRouter();
  return (
    <div dir="rtl" style={{ fontFamily: "Tahoma, sans-serif", padding: 24, background: "#f1ece1", minHeight: "100vh" }}>
      <div style={{ background: "#dc2626", color: "#fff", padding: 16, borderRadius: 12, fontWeight: 800, fontSize: 22, textAlign: "center" }}>V-EMPTY</div>
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, marginTop: 16, fontSize: 16, lineHeight: 2 }}>
        الصفحة تعمل ولا يوجد انهيار. المشكلة السابقة كانت في منطق التقارير المعقّد، وسنعيد بناءه بأمان بعد هذه الخطوة.
      </div>
      <button onClick={() => router.push("/dashboard")} style={{ marginTop: 16, background: "#0f172a", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>لوحة التحكم</button>
    </div>
  );
}
