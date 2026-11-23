'use client';

const kpis = [
  {
    title: 'الجلسات المنفذة',
    value: '8',
    icon: '🎓',
    color: '#8E4A68',
  },
  {
    title: 'الحضور اليوم',
    value: '142',
    icon: '✅',
    color: '#3F7F79',
  },
  {
    title: 'التقييمات المستلمة',
    value: '38',
    icon: '📝',
    color: '#8A5A1E',
  },
  {
    title: 'الشهادات الصادرة',
    value: '6',
    icon: '📜',
    color: '#8E4A68',
  },
];

export default function TodayKPIs() {
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
              background: '#FBF4EE',
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
                color: '#3A1F36',
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                marginTop: 8,
                color: '#8E7F8A',
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
