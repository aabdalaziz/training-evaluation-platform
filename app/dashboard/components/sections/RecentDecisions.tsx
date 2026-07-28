'use client';

const decisions = [
  {
    title: 'اعتماد برنامج تعليم اللغة العربية',
    by: 'مدير البرنامج',
    time: '09:30',
    status: 'تم',
  },
  {
    title: 'اعتماد خطة تحسين الجودة',
    by: 'مدير الجودة',
    time: '10:15',
    status: 'تم',
  },
  {
    title: 'إصدار شهادات الدفعة الثالثة',
    by: 'إدارة التدريب',
    time: '11:05',
    status: 'تم',
  },
];

export default function RecentDecisions() {
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
          fontWeight: 900,
          fontSize: 30,
        }}
      >
        ✅ آخر القرارات
      </h2>

      {decisions.map((item) => (
        <div
          key={item.title}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            borderBottom: '1px solid #eef2f7',
          }}
        >
          <div>
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
                marginTop: 6,
                color: '#64748b',
                fontSize: 14,
              }}
            >
              بواسطة {item.by}
            </div>
          </div>

          <div
            style={{
              textAlign: 'left',
            }}
          >
            <div
              style={{
                color: '#16a34a',
                fontWeight: 800,
              }}
            >
              {item.status}
            </div>

            <div
              style={{
                marginTop: 6,
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              {item.time}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
