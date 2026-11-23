'use client';

export default function ProgramStatistics() {
  const stats = [
    {
      title: 'البرامج النشطة',
      value: 12,
      icon: '📚',
      color: '#8E4A68',
    },
    {
      title: 'إجمالي المشاركين',
      value: 1823,
      icon: '👨‍🎓',
      color: '#3F7F79',
    },
    {
      title: 'إجمالي المدرّبين',
      value: 42,
      icon: '👨‍🏫',
      color: '#8E4A68',
    },
    {
      title: 'متوسط الرضا',
      value: '4.82',
      icon: '⭐',
      color: '#D9A866',
    },
  ];

  return (
    <section
      style={{
        marginBottom: 30,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
        gap: 20,
      }}
    >
      {stats.map((item) => (
        <div
          key={item.title}
          style={{
            background: '#fff',
            borderRadius: 22,
            padding: 24,
            borderTop: `6px solid ${item.color}`,
            boxShadow: '0 10px 25px rgba(42,22,38,.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
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

            <div
              style={{
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: 34,
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
                  fontSize: 14,
                }}
              >
                {item.title}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
