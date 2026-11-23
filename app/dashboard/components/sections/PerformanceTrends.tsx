'use client';

const data = [
  { day: 'السبت', value: 82 },
  { day: 'الأحد', value: 85 },
  { day: 'الاثنين', value: 87 },
  { day: 'الثلاثاء', value: 91 },
  { day: 'الأربعاء', value: 90 },
  { day: 'الخميس', value: 94 },
  { day: 'الجمعة', value: 96 },
];

export default function PerformanceTrends() {
  const max = Math.max(...data.map(d => d.value));

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(42,22,38,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#3A1F36',
              fontWeight: 900,
              fontSize: 28,
            }}
          >
            📈 اتجاهات الأداء
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#8E7F8A',
            }}
          >
            تطور مؤشر التميز خلال الأسبوع الحالي.
          </p>
        </div>

        <div
          style={{
            background: '#E6F3F1',
            color: '#2F6B66',
            padding: '8px 16px',
            borderRadius: 30,
            fontWeight: 800,
          }}
        >
            ↑ +14%
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 18,
          height: 240,
        }}
      >
        {data.map(item => (
          <div
            key={item.day}
            style={{
              flex: 1,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                height: `${(item.value / max) * 180}px`,
                background:
                  'linear-gradient(180deg,#3F7F79,#3A1F36)',
                borderRadius: '14px 14px 0 0',
                transition: '.3s',
              }}
            />

            <div
              style={{
                marginTop: 10,
                fontWeight: 900,
                color: '#3A1F36',
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: '#8E7F8A',
              }}
            >
              {item.day}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
