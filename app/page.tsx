'use client';

import Hero from './components/home/Hero';
import PortalActions from './components/home/PortalActions';
import PortalStatistics from './components/home/PortalStatistics';
import PortalServices from './components/home/PortalServices';
import Footer from './components/home/Footer';

export default function HomePage() {
  return (
    <main
      style={{
        background: '#f4f7fb',
        minHeight: '100vh',
      }}
    >
      <Hero />

      <PortalActions />

      <PortalStatistics />

      <PortalServices />

      <section
        style={{
          maxWidth: 1280,
          margin: '60px auto',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: 40,
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(15,23,42,.05)',
          }}
        >
          <h2
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 36,
              fontWeight: 900,
            }}
          >
            ⭐ لماذا بوابة التميز؟
          </h2>

          <p
            style={{
              maxWidth: 900,
              margin: '20px auto',
              color: '#64748b',
              lineHeight: 2,
              fontSize: 18,
            }}
          >
            منصة موحدة لإدارة التعليم والتدريب والتعلم الإلكتروني،
            وقياس الجودة، وتحليل النتائج، وتحويل البيانات إلى قرارات
            تنفيذية تساعد المؤسسات على تحقيق التميز.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
              gap: 20,
              marginTop: 40,
            }}
          >
            <Feature
              icon="🎓"
              title="إدارة التعليم"
            />

            <Feature
              icon="📊"
              title="تقارير تنفيذية"
            />

            <Feature
              icon="📝"
              title="تقييمات ذكية"
            />

            <Feature
              icon="🤖"
              title="ذكاء تنفيذي"
            />
          </div>
        </div>
      </section>

<Footer />
    </main>
  );
}

function Feature({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 18,
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          fontSize: 42,
          marginBottom: 16,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: '#14466B',
          fontWeight: 900,
          fontSize: 18,
        }}
      >
        {title}
      </div>
    </div>
  );
}
