'use client';

type Decision = {
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  title: string;
  description: string;
  action: string;
};

const decisions: Decision[] = [
  {
    priority: 'عالية',
    title: 'برنامج يحتاج متابعة',
    description:
      'انخفض مؤشر إدارة الوقت في برنامج تعليم اللغة العربية إلى أقل من المستهدف.',
    action: 'عرض التقرير',
  },
  {
    priority: 'متوسطة',
    title: 'استكمال التقييمات اليومية',
    description:
      'تبقى 18 متدرباً لم يرسلوا التقييم اليومي.',
    action: 'فتح التقييمات',
  },
  {
    priority: 'منخفضة',
    title: 'إصدار الشهادات',
    description:
      'يمكن إصدار 12 شهادة مكتملة اليوم.',
    action: 'إصدار الشهادات',
  },
];

const colors = {
  عالية: '#dc2626',
  متوسطة: '#ea580c',
  منخفضة: '#16a34a',
};

export default function DecisionCenter() {
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
          fontWeight: 900,
          fontSize: 28,
        }}
      >
        🎯 مركز القرار التنفيذي
      </h2>

      <p
        style={{
          color: '#64748b',
          marginBottom: 24,
        }}
      >
        أهم القرارات المقترحة لهذا اليوم.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {decisions.map((item, index) => (
          <div
            key={index}
            style={{
              borderLeft: `6px solid ${colors[item.priority]}`,
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: '#14466B',
                  fontWeight: 900,
                }}
              >
                {item.title}
              </h3>

              <span
                style={{
                  background: colors[item.priority],
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
                color: '#475569',
                lineHeight: 1.8,
                marginBottom: 14,
              }}
            >
              {item.description}
            </p>

            <button
              style={{
                background: '#14466B',
                color: '#fff',
                border: 0,
                borderRadius: 10,
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
