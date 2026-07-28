'use client';

const indicators = [
  {
    title: 'جودة البرامج',
    status: 'ممتاز',
    color: '#16a34a',
    icon: '🟢',
  },
  {
    title: 'الحضور',
    status: 'جيد',
    color: '#2563eb',
    icon: '🔵',
  },
  {
    title: 'التقييمات اليومية',
    status: 'يحتاج متابعة',
    color: '#f59e0b',
    icon: '🟠',
  },
  {
    title: 'خطط التحسين',
    status: 'أولوية عاجلة',
    color: '#dc2626',
    icon: '🔴',
  },
];

export default function TrafficLightBoard() {
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
        🚦 لوحة الإشارات الضوئية
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
          gap: 18,
        }}
      >
        {indicators.map((item) => (
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
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: item.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 24,
              }}
            >
              {item.icon}
            </div>

            <div>
              <div
                style={{
                  color: '#14466B',
                  fontWeight: 900,
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: '#64748b',
                }}
              >
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
