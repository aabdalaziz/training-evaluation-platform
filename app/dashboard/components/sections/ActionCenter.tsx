'use client';

const actions = [
  {
    icon: '📚',
    title: 'اعتماد برنامج',
    description: 'اعتماد البرامج الجديدة',
    color: '#8E4A68',
  },
  {
    icon: '👨‍🏫',
    title: 'تعيين مدرّب',
    description: 'ربط المدرّبين بالبرامج',
    color: '#8E4A68',
  },
  {
    icon: '🏫',
    title: 'إدارة الشُّعب',
    description: 'ربط الشُّعب والجداول',
    color: '#3F7F79',
  },
  {
    icon: '📝',
    title: 'متابعة التقييمات',
    description: 'التقييم اليومي والنهائي',
    color: '#8A5A1E',
  },
  {
    icon: '📜',
    title: 'إصدار الشهادات',
    description: 'الشهادات المكتملة',
    color: '#3F7F79',
  },
  {
    icon: '🎯',
    title: 'خطة التحسين',
    description: 'متابعة الإجراءات التصحيحية',
    color: '#D4614A',
  },
];

export default function ActionCenter() {
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
          marginBottom: 10,
          color: '#3A1F36',
          fontWeight: 900,
          fontSize: 30,
        }}
      >
        ⚡ مركز الإجراءات التنفيذية
      </h2>

      <p
        style={{
          color: '#8E7F8A',
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
              border: '1px solid #EADFD6',
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
                color: '#3A1F36',
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                marginTop: 10,
                color: '#8E7F8A',
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
