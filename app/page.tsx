'use client';

import Hero from './components/home/Hero';
import PortalActions from './components/home/PortalActions';
import PortalStatistics from './components/home/PortalStatistics';
import PortalServices from './components/home/PortalServices';
import WhyUs from './components/home/WhyUs';

export default function HomePage() {
  return (
    <main
      style={{
        background: '#f4f7fb',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <Hero />

      <PortalActions />

      <PortalStatistics />

      <PortalServices />

      <WhyUs />

      <section
        style={{
          maxWidth: 1280,
          margin: '70px auto',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: 40,
            boxShadow: '0 10px 30px rgba(15,23,42,.05)',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 40,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 40,
                fontWeight: 900,
                color: '#14466B',
              }}
            >
              🤝 شركاء النجاح
            </h2>

            <p
              style={{
                marginTop: 14,
                color: '#64748b',
                fontSize: 18,
              }}
            >
              نفخر بشراكاتنا مع المؤسسات التعليمية والتدريبية.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit,minmax(220px,1fr))',
              gap: 24,
            }}
          >
                        <Partner
              title="جامعة الأمير مقرن"
              subtitle="University Partner"
            />

            <Partner
              title="مركز تعليم اللغة العربية"
              subtitle="Arabic Language Center"
            />

            <Partner
              title="مركز التدريب"
              subtitle="Training Center"
            />

            <Partner
              title="شريك إستراتيجي"
              subtitle="Strategic Partner"
            />
          </div>
        </div>
      </section>

      <footer
        style={{
          marginTop: 80,
          background: '#14466B',
          color: '#fff',
          padding: '60px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns:
              '2fr 1fr 1fr',
            gap: 40,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontWeight: 900,
                fontSize: 30,
              }}
            >
              🏛 بوابة التميز للتعليم والتطوير
            </h2>

            <p
              style={{
                marginTop: 18,
                lineHeight: 2,
                opacity: .9,
              }}
            >
              منصة موحدة لإدارة التعليم والتدريب،
              وقياس الجودة، وتحويل البيانات إلى
              قرارات تنفيذية ذكية.
            </p>
          </div>

          <div>
            <h3
              style={{
                marginTop: 0,
                marginBottom: 18,
              }}
            >
              روابط سريعة
            </h3>

            <FooterLink text="دخول الإدارة" />

            <FooterLink text="التقييم اليومي" />

            <FooterLink text="التقييم النهائي" />

            <FooterLink text="التحقق من الشهادات" />
          </div>

          <div>
            <h3
              style={{
                marginTop: 0,
                marginBottom: 18,
              }}
            >
              تواصل معنا
            </h3>

            <FooterLink text="support@example.com" />

            <FooterLink text="+966 50 000 0000" />

            <FooterLink text="المدينة المنورة" />
          </div>
        </div>
