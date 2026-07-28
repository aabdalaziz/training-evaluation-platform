'use client';

const kpis = [
  {
    title: 'الجلسات المنفذة',
    value: '8',
    icon: '🎓',
    color: '#2563eb',
  },
  {
    title: 'الحضور اليوم',
    value: '142',
    icon: '✅',
    color: '#16a34a',
  },
  {
    title: 'التقييمات المستلمة',
    value: '38',
    icon: '📝',
    color: '#ea580c',
  },
  {
    title: 'الشهادات الصادرة',
    value: '6',
    icon: '📜',
    color: '#7c3aed',
  },
];

export default function TodayKPIs() {
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
        📅 مؤشرات اليوم
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 20,
        }}
      >
        {kpis.map((item) => (
          <div
            key={item.title}
            style={{
              background: '#f8fafc',
              borderRadius: 18,
              padding: 22,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                margin: '0 auto',
                borderRadius: 16,
                background: item.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 30,
              }}
            >
              {item.icon}
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 36,
                fontWeight: 900,
                color: '#14466B',
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                marginTop: 8,
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              {item.title}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
