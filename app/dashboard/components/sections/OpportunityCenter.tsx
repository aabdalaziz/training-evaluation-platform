'use client';

const opportunities = [
  {
    title: 'رفع نسبة استكمال التقييمات',
    impact: 'مرتفع',
    expected: '+8%',
    action: 'إرسال تذكير للمشاركين',
    color: '#2563eb',
  },
  {
    title: 'تحسين إدارة الوقت',
    impact: 'مرتفع',
    expected: '+0.35',
    action: 'اجتماع مع المدربين',
    color: '#ea580c',
  },
  {
    title: 'زيادة الحضور',
    impact: 'متوسط',
    expected: '+4%',
    action: 'إشعار قبل بداية الجلسة',
    color: '#16a34a',
  },
];

export default function OpportunityCenter() {
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
        🚀 الفرص التنفيذية
      </h2>

      <p
        style={{
          marginTop: 10,
          color: '#64748b',
          marginBottom: 24,
        }}
      >
        إجراءات سريعة تحقق أكبر أثر على الأداء.
      </p>

      <div
        style={{
          display: 'grid',
          gap: 18,
        }}
      >
        {opportunities.map((item) => (
          <div
            key={item.title}
            style={{
              border: `1px solid ${item.color}`,
              borderRadius: 18,
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
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
                  padding: '5px 12px',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                أثر متوقع {item.expected}
              </span>
            </div>

            <div
              style={{
                color: '#64748b',
                marginBottom: 16,
              }}
            >
              مستوى التأثير: <strong>{item.impact}</strong>
            </div>

            <button
              style={{
                border: 0,
                background: '#14466B',
                color: '#fff',
                borderRadius: 12,
                padding: '12px 18px',
                fontWeight: 800,
                cursor: 'pointer',
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
