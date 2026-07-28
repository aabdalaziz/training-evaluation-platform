'use client';

export default function ExecutiveSummary() {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg,#14466B,#0B3552)',
        color: '#fff',
        borderRadius: 24,
        padding: 32,
        boxShadow: '0 15px 35px rgba(20,70,107,.20)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 30,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              opacity: .85,
              marginBottom: 10,
            }}
          >
            Executive Summary
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 900,
            }}
          >
            👋 الملخص التنفيذي
          </h2>

          <p
            style={{
              marginTop: 18,
              lineHeight: 2,
              fontSize: 18,
              maxWidth: 800,
              opacity: .95,
            }}
          >
            تم تشغيل جميع البرامج بصورة طبيعية.
            مؤشر التميز المؤسسي ارتفع إلى
            <strong> 92 / 100 </strong>
            وتم استلام 38 تقييماً اليوم.
            يوصى بمتابعة برنامج تعليم اللغة العربية
            بسبب انخفاض مؤشر إدارة الوقت.
          </p>
        </div>

        <div
          style={{
            minWidth: 220,
            background: 'rgba(255,255,255,.10)',
            borderRadius: 20,
            padding: 20,
            border: '1px solid rgba(255,255,255,.15)',
          }}
        >
          <div
            style={{
              fontSize: 14,
              opacity: .85,
            }}
          >
            حالة المؤسسة
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            ممتاز
          </div>

          <div
            style={{
              marginTop: 14,
              opacity: .9,
            }}
          >
            ✅ لا توجد مشكلات حرجة
          </div>
        </div>
      </div>
    </section>
  );
}
