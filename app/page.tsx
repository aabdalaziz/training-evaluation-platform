'use client';

import Hero from './components/home/Hero';
import PortalActions from './components/home/PortalActions';
import PortalStatistics from './components/home/PortalStatistics';
import PortalServices from './components/home/PortalServices';
import WhyUs from './components/home/WhyUs';
import Footer from './components/home/Footer';

export default function HomePage() {
  return (
    <main
      style={{
        background: '#F4F7FB',
        minHeight: '100vh',
      }}
    >
      {/* البطل الرئيسي */}
      <Hero />

      {/* الإجراءات الرئيسية */}
      <PortalActions />

      {/* إحصاءات البوابة */}
      <PortalStatistics />

      {/* الخدمات */}
      <PortalServices />

      {/* لماذا بوابة التميز */}
      <WhyUs />

      {/* شركاء النجاح */}
      <section
        style={{
          maxWidth: 1280,
          margin: '70px auto',
          padding: '0 24px',
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
              color: '#14466B',
              fontWeight: 900,
              fontSize: 38,
            }}
          >
            🤝 شركاء النجاح
          </h2>

          <p
            style={{
              marginTop: 16,
              color: '#64748b',
              fontSize: 18,
            }}
          >
            نفخر بالشراكة مع المؤسسات التعليمية والتدريبية.
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
          <PartnerCard
            name="جامعة الأمير مقرن"
            type="University"
          />

          <PartnerCard
            name="مركز تعليم اللغة العربية"
            type="Language Center"
          />

          <PartnerCard
            name="مركز التدريب"
            type="Training Center"
          />

          <PartnerCard
            name="شريك إستراتيجي"
            type="Strategic Partner"
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}

function PartnerCard({
  name,
  type,
}: {
  name: string;
  type: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 30,
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          width: 90,
          height: 90,
          margin: '0 auto 18px',
          borderRadius: '50%',
          background: '#eef4ff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 40,
        }}
      >
        🏛️
      </div>

      <h3
        style={{
          margin: 0,
          color: '#14466B',
          fontWeight: 900,
        }}
      >
        {name}
      </h3>

      <p
        style={{
          marginTop: 10,
          color: '#64748b',
        }}
      >
        {type}
      </p>
    </div>
  );
}
function PortalHighlights() {
  const items = [
    {
      icon: '🎯',
      title: 'اتخاذ القرار',
      description:
        'تحويل البيانات إلى قرارات تنفيذية مبنية على مؤشرات دقيقة.',
    },
    {
      icon: '📊',
      title: 'مؤشرات الأداء',
      description:
        'قياس الأداء لحظياً مع متابعة الفجوات وخطط التحسين.',
    },
    {
      icon: '🌍',
      title: 'ثنائي اللغة',
      description:
        'واجهة عربية وإنجليزية لتناسب جميع المستفيدين.',
    },
    {
      icon: '🤖',
      title: 'ذكاء تنفيذي',
      description:
        'توصيات ذكية تساعد الإدارة على اتخاذ القرار.',
    },
  ];

  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '70px auto',
        padding: '0 24px',
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
            color: '#14466B',
            fontSize: 38,
            fontWeight: 900,
          }}
        >
          ✨ لماذا بوابة التميز؟
        </h2>

        <p
          style={{
            marginTop: 16,
            color: '#64748b',
            fontSize: 18,
            lineHeight: 1.8,
            maxWidth: 820,
            marginInline: 'auto',
          }}
        >
          منصة متكاملة لإدارة التعليم والتدريب،
          تجمع بين التشغيل اليومي، وقياس الجودة،
          والتحليل التنفيذي في مكان واحد.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(260px,1fr))',
          gap: 24,
        }}
      >
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              background: '#fff',
              borderRadius: 22,
              padding: 28,
              boxShadow: '0 10px 25px rgba(15,23,42,.05)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: 42,
                marginBottom: 18,
              }}
            >
              {item.icon}
            </div>

            <h3
              style={{
                margin: 0,
                color: '#14466B',
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {item.title}
            </h3>

            <p
              style={{
                marginTop: 14,
                color: '#64748b',
                lineHeight: 1.9,
              }}
            >
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodayNumbers() {
  const stats = [
    { value: '26', label: 'برنامجاً' },
    { value: '1823', label: 'متدرباً' },
    { value: '4856', label: 'تقييماً' },
    { value: '97%', label: 'رضا' },
  ];

  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '60px auto',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          background: '#14466B',
          borderRadius: 24,
          color: '#fff',
          padding: '35px',
        }}
      >
        <h2
          style={{
            margin: 0,
            textAlign: 'center',
            fontSize: 34,
            fontWeight: 900,
          }}
        >
          📊 اليوم في البوابة
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(180px,1fr))',
            gap: 20,
            marginTop: 35,
          }}
        >
          {stats.map((item) => (
            <div
              key={item.label}
              style={{
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 900,
                }}
              >
                {item.value}
              </div>

              <div
                style={{
                  marginTop: 10,
                  opacity: .9,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
