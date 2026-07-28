'use client';

type Stat = {
  value: string;
  label: string;
  color: string;
  icon: string;
};

const stats: Stat[] = [
  {
    value: '26',
    label: 'برنامج تدريبي',
    color: '#2563eb',
    icon: '📚',
  },
  {
    value: '1,823',
    label: 'متدرب',
    color: '#16a34a',
    icon: '👨‍🎓',
  },
  {
    value: '4,856',
    label: 'تقييم',
    color: '#ea580c',
    icon: '📝',
  },
  {
    value: '97%',
    label: 'مؤشر الرضا',
    color: '#7c3aed',
    icon: '⭐',
  },
];

export default function PortalStatistics() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '50px auto',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 30,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 900,
            color: '#14466B',
          }}
        >
          📊 اليوم في البوابة
        </h2>

        <p
          style={{
            color: '#64748b',
            marginTop: 10,
            fontSize: 17,
          }}
        >
          أرقام حية تعكس أداء البوابة في الوقت الحالي.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 24,
        }}
      >
        {stats.map((item) => (
          <div
            key={item.label}
            style={{
              background: '#fff',
              borderRadius: 22,
              padding: 28,
              boxShadow: '0 12px 30px rgba(15,23,42,.06)',
              borderTop: `5px solid ${item.color}`,
              transition: 'all .25s',
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 18,
                background: item.color,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                fontSize: 32,
                marginBottom: 22,
              }}
            >
              {item.icon}
            </div>

            <div
              style={{
                fontSize: 42,
                fontWeight: 900,
                color: '#14466B',
                lineHeight: 1,
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                marginTop: 12,
                color: '#64748b',
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
