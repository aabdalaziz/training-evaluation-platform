'use client';

const activities = [
  {
    time: '08:10',
    text: 'تم بدء برنامج تعليم اللغة العربية.',
  },
  {
    time: '08:45',
    text: 'تم تسجيل حضور 126 متدرباً.',
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
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          color: '#14466B',
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
                color: '#64748b',
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
                background: '#16a34a',
              }}
            />

            <div
              style={{
                color: '#334155',
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
