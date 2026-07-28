'use client';

const decisions = [
  {
    priority: 'عالية',
    color: '#dc2626',
    title: 'متابعة إدارة الوقت',
    description:
      'انخفض متوسط مؤشر إدارة الوقت إلى 3.62 من 5.',
  },
  {
    priority: 'متوسطة',
    color: '#ea580c',
    title: 'استكمال التقييمات',
    description:
      'تبقى 18 متدربًا لم يرسلوا التقييم اليومي.',
  },
  {
    priority: 'منخفضة',
    color: '#16a34a',
    title: 'إصدار الشهادات',
    description:
      'يمكن إصدار 12 شهادة مكتملة.',
  },
];

export default function ProgramDecisionCenter() {
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
        🎯 قرار اليوم
      </h2>

      <div
        style={{
          display: 'grid',
          gap: 18,
        }}
      >
        {decisions.map((item) => (
          <div
            key={item.title}
            style={{
              borderLeft: `6px solid ${item.color}`,
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <strong
                style={{
                  color: '#14466B',
                  fontSize: 18,
                }}
              >
                {item.title}
              </strong>

              <span
                style={{
                  background: item.color,
                  color: '#fff',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {item.priority}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                color: '#64748b',
                lineHeight: 1.8,
              }}
            >
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
