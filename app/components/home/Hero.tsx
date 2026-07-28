'use client';

import Link from 'next/link';

export default function Hero() {
  return (
    <section
      style={{
        background:
          'linear-gradient(135deg,#14466B 0%,#0B3552 100%)',
        color: '#fff',
        borderRadius: 30,
        padding: '70px 50px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 25px 60px rgba(20,70,107,.25)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.05)',
          left: -120,
          top: -120,
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.05)',
          right: -80,
          bottom: -80,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1100,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            margin: '0 auto 30px',
            borderRadius: 30,
            background: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 58,
            boxShadow: '0 18px 40px rgba(0,0,0,.25)',
          }}
        >
          🏛️
        </div>

        <div
          style={{
            fontSize: 16,
            letterSpacing: 2,
            opacity: .85,
            marginBottom: 14,
            textTransform: 'uppercase',
          }}
        >
          Excellence Portal for Education & Development
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 56,
            fontWeight: 900,
            lineHeight: 1.2,
          }}
        >
          بوابة التميز للتعليم والتطوير
        </h1>

        <p
          style={{
            margin: '28px auto',
            maxWidth: 760,
            fontSize: 22,
            lineHeight: 1.9,
            opacity: .92,
          }}
        >
          منصة موحدة لإدارة التعليم والتدريب وقياس الجودة
          وتحويل البيانات إلى قرارات تنفيذية ذكية.
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 18,
            marginTop: 40,
          }}
        >
          <Link href="/login" style={primaryButton}>
            🔐 دخول الإدارة
          </Link>

          <Link href="/evaluate/daily" style={secondaryButton}>
            📝 التقييم اليومي
          </Link>

          <Link href="/evaluate/final" style={secondaryButton}>
            🏁 التقييم النهائي
          </Link>

          <Link href="/verify" style={secondaryButton}>
            📜 التحقق من الشهادات
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
            gap: 18,
            marginTop: 70,
          }}
        >
          <Stat value="26" label="برنامج تدريبي" />
          <Stat value="1,823" label="متدرب" />
          <Stat value="4,856" label="تقييم" />
          <Stat value="97%" label="مؤشر الرضا" />
        </div>
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,.08)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,.15)',
        borderRadius: 20,
        padding: 24,
      }}
    >
      <div
        style={{
          fontSize: 40,
          fontWeight: 900,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 10,
          opacity: .9,
        }}
      >
        {label}
      </div>
    </div>
  );
}

const primaryButton = {
  background: '#16A34A',
  color: '#fff',
  padding: '16px 28px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 900,
  fontSize: 17,
  boxShadow: '0 10px 25px rgba(22,163,74,.35)',
};

const secondaryButton = {
  background: '#ffffff',
  color: '#14466B',
  padding: '16px 28px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 900,
  fontSize: 17,
};
