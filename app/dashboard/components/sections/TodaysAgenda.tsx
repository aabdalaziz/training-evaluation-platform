'use client';

const agenda = [
  {
    time: '08:30',
    title: 'افتتاح برنامج تعليم اللغة العربية',
    place: 'القاعة 203',
  },
  {
    time: '10:00',
    title: 'اجتماع متابعة الجودة',
    place: 'قاعة الاجتماعات',
  },
  {
    time: '12:00',
    title: 'مراجعة التقرير التنفيذي',
    place: 'مركز القيادة',
  },
  {
    time: '02:00',
    title: 'اعتماد الشهادات',
    place: 'الإدارة',
  },
];

export default function TodaysAgenda() {
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
        📅 أجندة اليوم
      </h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        {agenda.map((item) => (
          <div
            key={item.time}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 180px',
              gap: 18,
              alignItems: 'center',
              borderBottom: '1px solid #eef2f7',
              paddingBottom: 16,
            }}
          >
            <div
              style={{
                color: '#2563eb',
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {item.time}
            </div>

            <div
              style={{
                fontWeight: 800,
                color: '#14466B',
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                color: '#64748b',
              }}
            >
              📍 {item.place}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
