'use client';

const items = [
  {
    title: 'الرضا العام',
    value: '+4%',
    color: '#3F7F79',
    icon: '📈',
  },
  {
    title: 'الحضور',
    value: '+2%',
    color: '#8E4A68',
    icon: '✅',
  },
  {
    title: 'استكمال التقييمات',
    value: '+9%',
    color: '#8E4A68',
    icon: '📝',
  },
  {
    title: 'تنفيذ التحسينات',
    value: '-3%',
    color: '#8A5A1E',
    icon: '🎯',
  },
];

export default function InstitutionTrend() {
  return (
    <section
      style={{
        background: '#fff',
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
          fontSize: 30,
          fontWeight: 900,
        }}
      >
        📈 اتجاه المؤسسة
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 18,
        }}
      >
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              border: '1px solid #EADFD6',
              borderRadius: 18,
              padding: 20,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 36,
                marginBottom: 12,
              }}
            >
              {item.icon}
            </div>

            <div
              style={{
                color: '#3A1F36',
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 34,
                fontWeight: 900,
                color: item.color,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
