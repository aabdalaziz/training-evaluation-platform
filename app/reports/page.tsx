"use client";
import { useRouter } from "next/navigation";
export default function ReportsPage() {
  const router = useRouter();
  return (
    <div style={{ direction: "rtl", fontFamily: "Tahoma", padding: 40, background: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ background: "#dc2626", color: "#fff", padding: 30, borderRadius: 16, fontSize: 28, fontWeight: 800, textAlign: "center" }}>
        V3 OK
      </div>
      <button onClick={() => router.push("/dashboard")} style={{ marginTop: 20, background: "#0f172a", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, cursor: "pointer" }}>
        Back
      </button>
    </div>
  );
}
