"use client";
export default function GlobalError({ error, reset }) {
  const msg = (error && (error.digest ? "[" + error.digest + "] " : "") + (error.message || String(error))) || "خطأ غير معروف";
  const stk = (error && error.stack) ? String(error.stack) : "";
  const copy = () => { try { navigator.clipboard.writeText(msg + "\n\n" + stk); } catch (e) {} };
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "Tahoma, Arial, sans-serif", background: "#fff5f5" }}>
        <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
          <div style={{ background: "#dc2626", color: "#fff", padding: 16, borderRadius: 12, fontWeight: 800, fontSize: 18 }}>تم كشف الخطأ الحقيقي - أرسل هذه الشاشة</div>
          <div style={{ background: "#fff", border: "2px solid #dc2626", borderRadius: 12, padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 800, color: "#dc2626", marginBottom: 8 }}>رسالة الخطأ:</div>
            <div style={{ color: "#111", fontSize: 15, lineHeight: 1.8 }}>{msg}</div>
            <div style={{ fontWeight: 800, color: "#dc2626", margin: "16px 0 8px" }}>التفاصيل التقنية:</div>
            <pre style={{ color: "#333", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#fafafa", padding: 10, borderRadius: 8, maxHeight: 320, overflow: "auto" }}>{stk}</pre>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={copy} style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>نسخ الخطأ</button>
            <button onClick={reset} style={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>إعادة المحاولة</button>
          </div>
          <p style={{ color: "#555", fontSize: 13, marginTop: 16, lineHeight: 1.8 }}>اضغط «نسخ الخطأ» والصق النص هنا، أو صوّر هذه الشاشة كاملة وأرسلها. بهذه الرسالة أصلح المشكلة بدقة في رد واحد.</p>
        </div>
      </body>
    </html>
  );
}
