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
        color: '#fff',
        borderRadius: 24,
        padding: '32px',
        boxShadow:
          '0 18px 40px rgba(20,70,107,.25)',
      }}
    >

      <div
        style={{
          fontSize: 18,
          opacity: .85,
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
          opacity: .9,
          lineHeight: 1.9,
          fontSize: 16,
        }}
      >
        مركز القيادة التنفيذي

        <br />

        منصة موحدة لإدارة التعليم والتدريب
        وقياس الجودة وتحويل البيانات إلى قرارات.
      </p>

    </section>

  );

}
