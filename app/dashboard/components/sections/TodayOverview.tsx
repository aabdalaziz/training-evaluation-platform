'use client';

type Item = {
  icon: string;
  title: string;
  value: string | number;
  color: string;
};

const items: Item[] = [
  {
    icon: '📚',
    title: 'البرامج النشطة',
    value: 3,
    color: '#2563eb',
  },
  {
    icon: '👨‍🎓',
    title: 'الحضور اليوم',
    value: '142',
    color: '#059669',
  },
  {
    icon: '📝',
    title: 'التقييمات المستلمة',
    value: '36',
    color: '#ea580c',
  },
  {
    icon: '📜',
    title: 'الشهادات الصادرة',
    value: '5',
    color: '#7c3aed',
  },
];

export default function TodayOverview() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 8,
          color: '#14466B',
          fontWeight: 900,
          fontSize: 28,
        }}
      >
        ☀️ اليوم في البوابة
      </h2>

      <p
        style={{
          color: '#64748b',
          marginBottom: 24,
        }}
      >
        ملخص سريع لأهم ما حدث اليوم.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(220px,1fr))',
          gap: 18,
        }}
      >
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 18,
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: item.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 28,
              }}
            >
              {item.icon}
            </div>

            <div>
              <div
                style={{
                  fontSize: 13,
                  color: '#64748b',
                  marginBottom: 6,
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: '#14466B',
                }}
              >
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
