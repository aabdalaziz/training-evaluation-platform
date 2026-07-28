'use client';

export default function DecisionOfTheDay() {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg,#F59E0B,#EA580C)',
        color: '#fff',
        borderRadius: 24,
        padding: 30,
        boxShadow: '0 15px 35px rgba(234,88,12,.25)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              opacity: .9,
            }}
          >
            Decision Of The Day
          </div>

          <h2
            style={{
              margin: '10px 0',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            🎯 قرار اليوم
          </h2>

          <p
            style={{
              margin: 0,
              lineHeight: 2,
              fontSize: 18,
              maxWidth: 720,
            }}
          >
            يوصي النظام اليوم بمراجعة
            <strong> برنامج تعليم اللغة العربية </strong>
            لأن مؤشر إدارة الوقت انخفض إلى
            <strong> 3.62 / 5 </strong>
            وهو أقل من المستهدف.
          </p>
        </div>

        <button
          style={{
            border: 0,
            borderRadius: 16,
            padding: '16px 28px',
            background: '#ffffff',
            color: '#EA580C',
            fontWeight: 900,
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          فتح البرنامج
        </button>
      </div>
    </section>
  );
}
