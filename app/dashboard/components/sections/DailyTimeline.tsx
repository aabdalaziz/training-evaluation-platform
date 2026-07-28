'use client';

type TimelineItem = {
  time: string;
  title: string;
  description: string;
  color: string;
  icon: string;
};

const timeline: TimelineItem[] = [
  {
    time: '08:00',
    title: 'بدء البرنامج',
    description: 'تم افتتاح الجلسات التدريبية لهذا اليوم.',
    color: '#2563eb',
    icon: '🚀',
  },
  {
    time: '08:30',
    title: 'تسجيل الحضور',
    description: 'حضر 126 متدرباً حتى الآن.',
    color: '#16a34a',
    icon: '✅',
  },
  {
    time: '09:20',
    title: 'استلام التقييمات',
    description: 'تم استلام 18 تقييماً يومياً.',
    color: '#ea580c',
    icon: '📝',
  },
  {
    time: '10:15',
    title: 'تحديث التقرير',
    description: 'تم تحديث المؤشرات التنفيذية.',
    color: '#7c3aed',
    icon: '📊',
  },
];

export default function DailyTimeline() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 8,
          color: '#14466B',
          fontSize: 28,
          fontWeight: 900,
        }}
      >
        📅 يومياتي
      </h2>

      <p
        style={{
          color: '#64748b',
          marginBottom: 24,
        }}
      >
        آخر الأحداث والعمليات داخل البوابة.
      </p>

      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            right: 22,
            top: 0,
            bottom: 0,
            width: 3,
            background: '#e2e8f0',
          }}
        />

        {timeline.map((item) => (
          <div
            key={item.time}
            style={{
              display: 'flex',
              gap: 18,
              marginBottom: 26,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: item.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2,
                fontSize: 22,
              }}
            >
              {item.icon}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                {item.time}
              </div>

              <div
                style={{
                  color: '#14466B',
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                {item.title}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: '#475569',
                  lineHeight: 1.8,
                }}
              >
                {item.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
