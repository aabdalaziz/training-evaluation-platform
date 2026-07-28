'use client';

export default function ExecutiveAdvice() {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg,#0F766E,#115E59)',
        color: '#fff',
        borderRadius: 24,
        padding: 30,
        boxShadow: '0 15px 35px rgba(15,118,110,.20)',
      }}
    >
      <div
        style={{
          fontSize: 15,
          opacity: .85,
          marginBottom: 10,
        }}
      >
        Executive Advisor
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: 32,
          fontWeight: 900,
        }}
      >
        🤖 توصية اليوم
      </h2>

      <p
        style={{
          marginTop: 20,
          lineHeight: 2,
          fontSize: 18,
        }}
      >
        لو كنتُ مكان مدير البرنامج اليوم فسأبدأ بمراجعة
        <strong> مؤشر إدارة الوقت </strong>
        لأنه أقل من المستهدف، ثم سأتابع المتدربين الذين
        لم يرسلوا التقييم اليومي، وبعد ذلك سأصدر الشهادات
        الجاهزة.
      </p>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          style={{
            background: '#fff',
            color: '#0F766E',
            border: 0,
            borderRadius: 12,
            padding: '12px 18px',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          فتح البرنامج
        </button>

        <button
          style={{
            background: 'rgba(255,255,255,.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,.20)',
            borderRadius: 12,
            padding: '12px 18px',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          عرض التقرير
        </button>
      </div>
    </section>
  );
}
