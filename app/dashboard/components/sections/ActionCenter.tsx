'use client';

const actions = [
  {
    icon: '📚',
    title: 'اعتماد برنامج',
    description: 'اعتماد البرامج الجديدة',
    color: '#2563eb',
  },
  {
    icon: '👨‍🏫',
    title: 'تعيين مدرب',
    description: 'ربط المدربين بالبرامج',
    color: '#7c3aed',
  },
  {
    icon: '🏫',
    title: 'إدارة القاعات',
    description: 'ربط القاعات والجداول',
    color: '#16a34a',
  },
  {
    icon: '📝',
    title: 'متابعة التقييمات',
    description: 'التقييم اليومي والنهائي',
    color: '#ea580c',
  },
  {
    icon: '📜',
    title: 'إصدار الشهادات',
    description: 'الشهادات المكتملة',
    color: '#0891b2',
  },
  {
    icon: '🎯',
    title: 'خطة التحسين',
    description: 'متابعة الإجراءات التصحيحية',
    color: '#dc2626',
  },
];

export default function ActionCenter() {
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
          marginBottom: 10,
          color: '#14466B',
          fontWeight: 900,
          fontSize: 30,
        }}
      >
        ⚡ مركز الإجراءات التنفيذية
      </h2>

      <p
        style={{
          color: '#64748b',
          marginBottom: 28,
        }}
      >
        أكثر العمليات استخدامًا خلال يوم العمل.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
          gap: 20,
        }}
      >
        {actions.map((item) => (
          <button
            key={item.title}
            style={{
              border: '1px solid #e2e8f0',
              background: '#fff',
              borderRadius: 20,
              padding: 24,
              textAlign: 'center',
              cursor: 'pointer',
              transition: '.2s',
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                margin: '0 auto 18px',
                borderRadius: 18,
                background: item.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 34,
              }}
            >
              {item.icon}
            </div>

            <div
              style={{
                color: '#14466B',
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                marginTop: 10,
                color: '#64748b',
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              {item.description}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
