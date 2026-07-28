'use client';

import { useRouter } from 'next/navigation';

type Action = {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  href: string;
};

const actions: Action[] = [
  {
    title: 'إنشاء برنامج',
    subtitle: 'New Program',
    icon: '📚',
    color: '#2563eb',
    href: '/dashboard?view=programs',
  },
  {
    title: 'إضافة قاعة',
    subtitle: 'New Classroom',
    icon: '🏫',
    color: '#059669',
    href: '/admin/management',
  },
  {
    title: 'إضافة مدرب',
    subtitle: 'New Trainer',
    icon: '👨‍🏫',
    color: '#7c3aed',
    href: '/admin/management',
  },
  {
    title: 'التقييم اليومي',
    subtitle: 'Daily Evaluation',
    icon: '📝',
    color: '#ea580c',
    href: '/evaluate/daily',
  },
  {
    title: 'التقييم النهائي',
    subtitle: 'Final Evaluation',
    icon: '🏁',
    color: '#dc2626',
    href: '/evaluate/final',
  },
  {
    title: 'التقارير',
    subtitle: 'Reports',
    icon: '📊',
    color: '#0891b2',
    href: '/reports',
  },
];

export default function OperationsCenter() {
  const router = useRouter();

  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            ⚡ مركز العمليات
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#64748b',
              fontSize: 14,
            }}
          >
            أكثر العمليات استخداماً في مكان واحد.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(190px,1fr))',
          gap: 18,
        }}
      >
        {actions.map((action) => (
          <button
            key={action.title}
            onClick={() => router.push(action.href)}
            style={{
              border: '1px solid #e2e8f0',
              background: '#fff',
              borderRadius: 18,
              padding: 22,
              cursor: 'pointer',
              transition: '.25s',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow =
                '0 14px 30px rgba(15,23,42,.10)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                margin: '0 auto 16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: action.color,
                color: '#fff',
                fontSize: 30,
              }}
            >
              {action.icon}
            </div>

            <div
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: '#14466B',
              }}
            >
              {action.title}
            </div>

            <div
              style={{
                marginTop: 8,
                color: '#64748b',
                fontSize: 13,
              }}
            >
              {action.subtitle}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
