'use client';

type ProgramAlert = {
  program: string;
  issue: string;
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  action: string;
};

const items: ProgramAlert[] = [
  {
    program: 'برنامج تعليم اللغة العربية',
    issue: 'انخفاض مؤشر إدارة الوقت',
    priority: 'عالية',
    action: 'عرض التفاصيل',
  },
  {
    program: 'برنامج الجودة الصحية',
    issue: 'لم تصل تقييمات اليوم',
    priority: 'متوسطة',
    action: 'متابعة التقييمات',
  },
  {
    program: 'برنامج إعداد المعلمين',
    issue: 'يوجد مدرب غير مرتبط بقاعة',
    priority: 'منخفضة',
    action: 'إدارة القاعات',
  },
];

const colors = {
  عالية: '#dc2626',
  متوسطة: '#f59e0b',
  منخفضة: '#16a34a',
};

export default function ProgramsNeedingAttention() {
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
        📚 البرامج التي تحتاج انتباهًا
      </h2>

      <p
        style={{
          color: '#64748b',
          marginBottom: 24,
        }}
      >
        البرامج مرتبة حسب الأولوية.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {items.map((item) => (
          <div
            key={item.program}
            style={{
              border: '1px solid #e5e7eb',
              borderRight: `6px solid ${colors[item.priority]}`,
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 10,
              }}
            >
              <strong
                style={{
                  color: '#14466B',
                  fontSize: 18,
                }}
              >
                {item.program}
              </strong>

              <span
                style={{
                  background: colors[item.priority],
                  color: '#fff',
                  borderRadius: 20,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {item.priority}
              </span>
            </div>

            <div
              style={{
                color: '#475569',
                marginBottom: 14,
              }}
            >
              {item.issue}
            </div>

            <button
              style={{
                border: 0,
                background: '#14466B',
                color: '#fff',
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
