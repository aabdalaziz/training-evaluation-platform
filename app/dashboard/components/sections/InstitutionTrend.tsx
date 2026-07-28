'use client';

const items = [
  {
    title: 'الرضا العام',
    value: '+4%',
    color: '#16a34a',
    icon: '📈',
  },
  {
    title: 'الحضور',
    value: '+2%',
    color: '#2563eb',
    icon: '✅',
  },
  {
    title: 'استكمال التقييمات',
    value: '+9%',
    color: '#7c3aed',
    icon: '📝',
  },
  {
    title: 'تنفيذ التحسينات',
    value: '-3%',
    color: '#ea580c',
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
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 24,
          color: '#14466B',
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
              border: '1px solid #e2e8f0',
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
                color: '#14466B',
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
