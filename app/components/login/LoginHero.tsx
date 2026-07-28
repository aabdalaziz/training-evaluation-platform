'use client';

export default function LoginHero() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg,#14466B,#0B3552)',
        color: '#fff',
        borderRadius: 28,
        padding: '50px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: '0 20px 45px rgba(20,70,107,.25)',
      }}
    >
      <div
        style={{
          width: 90,
          height: 90,
          borderRadius: 24,
          background: '#fff',
          color: '#14466B',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 44,
          marginBottom: 30,
        }}
      >
        🏛️
      </div>

      <div
        style={{
          fontSize: 15,
          letterSpacing: 2,
          opacity: .8,
          textTransform: 'uppercase',
        }}
      >
        Excellence Portal
      </div>

      <h1
        style={{
          margin: '12px 0',
          fontSize: 42,
          fontWeight: 900,
        }}
      >
        بوابة التميز للتعليم والتطوير
      </h1>

      <p
        style={{
          fontSize: 18,
          lineHeight: 1.9,
          opacity: .92,
          maxWidth: 520,
        }}
      >
        منصة موحدة لإدارة التعليم والتدريب والتعلم الإلكتروني
        وقياس الجودة وتحويل البيانات إلى قرارات تنفيذية.
      </p>

      <div
        style={{
          marginTop: 40,
          display: 'grid',
          gap: 14,
        }}
      >
        <Feature text="✅ إدارة البرامج التدريبية" />
        <Feature text="✅ نظام إدارة التعلم (LMS)" />
        <Feature text="✅ التقييمات الذكية" />
        <Feature text="✅ التقارير التنفيذية" />
        <Feature text="✅ الذكاء التنفيذي" />
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,.08)',
        border: '1px solid rgba(255,255,255,.15)',
        borderRadius: 14,
        padding: '12px 16px',
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
}
