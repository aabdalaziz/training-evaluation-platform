'use client';

const insights = [
  {
    icon: '📈',
    title: 'أفضل برنامج',
    value: 'تعليم اللغة العربية',
    color: '#16a34a',
  },
  {
    icon: '⭐',
    title: 'أفضل مدرب',
    value: 'د. محمد أحمد',
    color: '#2563eb',
  },
  {
    icon: '🏫',
    title: 'أفضل قاعة',
    value: 'القاعة 203',
    color: '#7c3aed',
  },
  {
    icon: '🎯',
    title: 'أكبر فجوة',
    value: 'إدارة الوقت',
    color: '#ea580c',
  },
];

export default function QuickInsights() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 24,
          color: '#14466B',
          fontWeight: 900,
          fontSize: 30,
        }}
      >
        💡 مؤشرات سريعة
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 18,
        }}
      >
        {insights.map((item) => (
          <div
            key={item.title}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 18,
              padding: 20,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
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
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: '#14466B',
                  fontWeight: 900,
                  fontSize: 18,
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
