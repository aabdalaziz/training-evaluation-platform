'use client';

const decisions = [
  {
    priority: 'عالية',
    color: '#D4614A',
    title: 'متابعة إدارة الوقت',
    description:
      'انخفض متوسط مؤشر إدارة الوقت إلى 3.62 من 5.',
  },
  {
    priority: 'متوسطة',
    color: '#8A5A1E',
    title: 'استكمال التقييمات',
    description:
      'تبقى 18 متدربًا لم يرسلوا التقييم اليومي.',
  },
  {
    priority: 'منخفضة',
    color: '#3F7F79',
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
        boxShadow: '0 10px 30px rgba(42,22,38,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 24,
          color: '#3A1F36',
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
              border: '1px solid #EADFD6',
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
                  color: '#3A1F36',
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
                color: '#8E7F8A',
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
