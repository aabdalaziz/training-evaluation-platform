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
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
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
              color: '#14466B',
              fontWeight: 900,
              fontSize: 28,
            }}
          >
            📈 اتجاهات الأداء
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#64748b',
            }}
          >
            تطور مؤشر التميز خلال الأسبوع الحالي.
          </p>
        </div>

        <div
          style={{
            background: '#dcfce7',
            color: '#047857',
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
                  'linear-gradient(180deg,#1FA39A,#14466B)',
                borderRadius: '14px 14px 0 0',
                transition: '.3s',
              }}
            />

            <div
              style={{
                marginTop: 10,
                fontWeight: 900,
                color: '#14466B',
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: '#64748b',
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
