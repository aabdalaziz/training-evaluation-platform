export default function ErrorState({
  message,
  onRetry,
  lang,
}: {
  message: string;
  onRetry: () => void;
  lang: string;
}) {
  const isAr = lang === "ar";
  return (
    <div
      role="alert"
      style={{
        textAlign: "center",
        padding: "48px 24px",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 20,
        margin: "20px 0",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h3
        style={{
          margin: "0 0 8px",
          color: "#991b1b",
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        {isAr ? "حدث خطأ أثناء تحميل البيانات" : "Error loading data"}
      </h3>
      <p
        style={{
          color: "#b91c1c",
          fontSize: 14,
          fontWeight: 700,
          margin: "0 0 20px",
          maxWidth: 500,
          marginInline: "auto",
        }}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        style={{
          background: "#dc2626",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "12px 28px",
          fontWeight: 900,
          fontSize: 15,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {isAr ? "🔄 إعادة المحاولة" : "🔄 Retry"}
      </button>
    </div>
  );
}
