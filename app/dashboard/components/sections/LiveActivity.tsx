'use client';

const activities = [
  {
    time: '08:10',
    text: 'تم بدء برنامج تعليم اللغة العربية.',
  },
  {
    time: '08:45',
    text: 'تم تسجيل حضور 126 مشاركاً.',
  },
  {
    time: '09:20',
    text: 'استلم النظام 18 تقييماً يومياً.',
  },
  {
    time: '10:15',
    text: 'تم تحديث التقرير التنفيذي.',
  },
  {
    time: '11:00',
    text: 'تم إصدار 6 شهادات.',
  },
];

export default function LiveActivity() {
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
          color: '#3A1F36',
          fontWeight: 900,
          fontSize: 30,
        }}
      >
        📡 النشاط المباشر
      </h2>

      <div
        style={{
          marginTop: 30,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {activities.map((item) => (
          <div
            key={item.time}
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                minWidth: 70,
                color: '#8E7F8A',
                fontWeight: 800,
              }}
            >
              {item.time}
            </div>

            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#3F7F79',
              }}
            />

            <div
              style={{
                color: '#4A3645',
                fontWeight: 700,
              }}
            >
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
