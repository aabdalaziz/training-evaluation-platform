'use client';

import Hero from './components/home/Hero';
import PortalActions from './components/home/PortalActions';
import PortalStatistics from './components/home/PortalStatistics';
import PortalServices from './components/home/PortalServices';
import WhyUs from './components/home/WhyUs';
import Footer from './components/home/Footer';

const PARTNERS = [
  {
    logo: '/logos/upm.png',
    name: 'جامعة الأمير مقرن بن عبدالعزيز',
    en: 'Prince Mugrin University',
    type: 'الجهة الأكاديمية',
    wide: false,
  },
  {
    logo: '/logos/center.png',
    name: 'المركز العالمي لتعليم اللغة العربية',
    en: 'Global Center for Teaching Arabic',
    type: 'مركز متخصص',
    wide: false,
  },
  {
    logo: '/logos/gate.png',
    name: 'بوابة التميز للاستشارات والتدريب',
    en: 'CenterGate for Excellence',
    type: 'الشريك الإستراتيجي',
    wide: true,
  },
];

export default function HomePage() {
  return (
    <main style={{ background: '#F4F7FB', minHeight: '100vh' }}>
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
      <section style={{ maxWidth: 1280, margin: '70px auto', padding: '0 24px' }} aria-labelledby="partners-title">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 64, height: 64, margin: '0 auto 14px', borderRadius: 18,
              background: 'linear-gradient(135deg,#14466B,#0E7C86)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 25px rgba(20,70,107,.25)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m11 17 2 2a1 1 0 1 0 3-3" />
              <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
              <path d="m21 3 1 11h-2" />
              <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
              <path d="M3 4h8" />
            </svg>
          </div>
          <h2 id="partners-title" style={{ margin: 0, color: '#14466B', fontWeight: 900, fontSize: 38 }}>شركاء النجاح</h2>
          <p style={{ marginTop: 14, color: '#64748b', fontSize: 18 }}>نفخر بالشراكة مع المؤسسات التعليمية والتدريبية.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
          {PARTNERS.map((p) => (
            <PartnerCard key={p.logo} {...p} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function PartnerCard({ logo, name, en, type, wide }: { logo: string; name: string; en: string; type: string; wide: boolean }) {
  return (
    <div
      style={{
        background: '#fff', borderRadius: 22, padding: '28px 26px', textAlign: 'center',
        boxShadow: '0 10px 25px rgba(15,23,42,.05)', border: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%', height: 150, marginBottom: 20, borderRadius: 16,
          background: '#f8fafc', border: '1px solid #eef2f7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
        }}
      >
        <img
          src={logo}
          alt={name}
          loading="lazy"
          style={{ maxHeight: wide ? 96 : 114, maxWidth: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
        />
      </div>

      <span
        style={{
          display: 'inline-block', fontSize: 12, fontWeight: 800, color: '#0E7C86',
          background: '#e6f5f6', borderRadius: 999, padding: '4px 12px', marginBottom: 10,
        }}
      >
        {type}
      </span>
      <h3 style={{ margin: 0, color: '#14466B', fontWeight: 900, fontSize: 20, lineHeight: 1.5 }}>{name}</h3>
      <p style={{ marginTop: 6, marginBottom: 0, color: '#64748b', fontSize: 14, direction: 'ltr' }}>{en}</p>
    </div>
  );
}
