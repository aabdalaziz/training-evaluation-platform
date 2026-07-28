'use client';

export default function WelcomeBanner() {
  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? '☀️ صباح الخير'
      : hour < 18
      ? '🌤 مساء الخير'
      : '🌙 أهلاً بك';

  return (
    <section
      style={{
        background:
          'linear-gradient(135deg,#14466B,#0B3552)',
        borderRadius: 28,
        color: '#fff',
        padding: '40px',
        boxShadow: '0 20px 45px rgba(20,70,107,.25)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              opacity: .9,
            }}
          >
            {greeting}
          </div>

          <h1
            style={{
              margin: '10px 0',
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            بوابة التميز للتعليم والتطوير
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 18,
              opacity: .9,
              lineHeight: 1.9,
              maxWidth: 700,
            }}
          >
            مركز القيادة التنفيذي
            <br />
            منصة موحدة لإدارة التعليم والتدريب وقياس الجودة
            وتحويل البيانات إلى قرارات تنفيذية.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,.10)',
            border: '1px solid rgba(255,255,255,.15)',
            borderRadius: 18,
            padding: '18px 22px',
            minWidth: 240,
          }}
        >
          <div
            style={{
              fontSize: 14,
              opacity: .85,
            }}
          >
            اليوم
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 26,
              fontWeight: 900,
            }}
          >
            {new Date().toLocaleDateString('ar-SA')}
          </div>

          <div
            style={{
              marginTop: 14,
              opacity: .85,
            }}
          >
            آخر تحديث: الآن
          </div>
        </div>
      </div>
    </section>
  );
}
