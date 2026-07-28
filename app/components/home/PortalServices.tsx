'use client';

import Link from 'next/link';

const services = [
  {
    title: 'إدارة البرامج',
    desc: 'إنشاء وإدارة البرامج التدريبية',
    icon: '📚',
    href: '/dashboard?view=programs',
    color: '#2563eb',
  },
  {
    title: 'المدربون',
    desc: 'إدارة المدربين والمعلمين',
    icon: '👨‍🏫',
    href: '/admin/management',
    color: '#7c3aed',
  },
  {
    title: 'المتدربون',
    desc: 'إدارة بيانات المتدربين',
    icon: '👨‍🎓',
    href: '#',
    color: '#16a34a',
  },
  {
    title: 'التقييمات',
    desc: 'اليومي والنهائي',
    icon: '📝',
    href: '/reports',
    color: '#ea580c',
  },
  {
    title: 'التقارير',
    desc: 'تقارير تنفيذية وتحليلية',
    icon: '📊',
    href: '/reports',
    color: '#0891b2',
  },
  {
    title: 'التعلم الإلكتروني',
    desc: 'LMS (قريباً)',
    icon: '💻',
    href: '#',
    color: '#0f766e',
  },
];

export default function PortalServices() {
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
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 36,
            color: '#14466B',
            fontWeight: 900,
          }}
        >
          🎯 ماذا تريد أن تنجز اليوم؟
        </h2>

        <p
          style={{
            marginTop: 10,
            color: '#64748b',
            fontSize: 17,
          }}
        >
          اختر الخدمة التي تريد الوصول إليها بسرعة.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 24,
        }}
      >
        {services.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 24,
                padding: 28,
                height: '100%',
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px rgba(15,23,42,.05)',
                transition: '.25s',
              }}
            >
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 18,
                  background: item.color,
                  color: '#fff',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 34,
                  marginBottom: 20,
                }}
              >
                {item.icon}
              </div>

              <h3
                style={{
                  margin: 0,
                  color: '#14466B',
                  fontWeight: 900,
                  fontSize: 22,
                }}
              >
                {item.title}
              </h3>

              <p
                style={{
                  marginTop: 12,
                  color: '#64748b',
                  lineHeight: 1.8,
                }}
              >
                {item.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
