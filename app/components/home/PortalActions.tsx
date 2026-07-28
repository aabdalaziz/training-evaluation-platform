'use client';

import Link from 'next/link';

const actions = [
  {
    title: 'دخول الإدارة',
    subtitle: 'Administration',
    icon: '🔐',
    href: '/login',
    color: '#14466B',
  },
  {
    title: 'التقييم اليومي',
    subtitle: 'Daily Evaluation',
    icon: '📝',
    href: '/evaluate/daily',
    color: '#2563eb',
  },
  {
    title: 'التقييم النهائي',
    subtitle: 'Final Evaluation',
    icon: '🏁',
    href: '/evaluate/final',
    color: '#16a34a',
  },
  {
    title: 'التحقق من الشهادات',
    subtitle: 'Certificates',
    icon: '📜',
    href: '/verify',
    color: '#7c3aed',
  },
];

export default function PortalActions() {
  return (
    <section
      style={{
        maxWidth: 1300,
        margin: '40px auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
        gap: 24,
      }}
    >
      {actions.map((item) => (
        <Link
          key={item.title}
          href={item.href}
          style={{
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: 28,
              boxShadow: '0 12px 30px rgba(15,23,42,.06)',
              borderTop: `6px solid ${item.color}`,
              transition: '.25s',
              cursor: 'pointer',
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
                marginTop: 10,
                color: '#64748b',
              }}
            >
              {item.subtitle}
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}
