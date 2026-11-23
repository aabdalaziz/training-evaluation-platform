'use client';

const insights = [
  {
    icon: '📈',
    title: 'أفضل برنامج',
    value: 'تعليم اللغة العربية',
    color: '#3F7F79',
  },
  {
    icon: '⭐',
    title: 'أفضل مدرب',
    value: 'د. محمد أحمد',
    color: '#8E4A68',
  },
  {
    icon: '🏫',
    title: 'أفضل قاعة',
    value: 'القاعة 203',
    color: '#8E4A68',
  },
  {
    icon: '🎯',
    title: 'أكبر فجوة',
    value: 'إدارة الوقت',
    color: '#8A5A1E',
  },
];

export default function QuickInsights() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(42,22,38,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 24,
          color: '#3A1F36',
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
              border: '1px solid #EADFD6',
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
                  color: '#8E7F8A',
                  fontSize: 13,
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: '#3A1F36',
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
