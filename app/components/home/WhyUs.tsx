'use client';

const features = [
  {
    icon: '🎓',
    title: 'إدارة التعليم والتدريب',
    description:
      'إدارة البرامج والدورات والمتدربين في منصة واحدة.',
    color: '#2563eb',
  },
  {
    icon: '📊',
    title: 'تقارير تنفيذية',
    description:
      'لوحات قيادة ومؤشرات أداء تساعد متخذ القرار.',
    color: '#16a34a',
  },
  {
    icon: '📝',
    title: 'التقييمات الذكية',
    description:
      'تحليل كل سؤال وكل مؤشر بصورة مستقلة.',
    color: '#ea580c',
  },
  {
    icon: '🤖',
    title: 'الذكاء التنفيذي',
    description:
      'تحويل البيانات إلى توصيات عملية وخطط تحسين.',
    color: '#7c3aed',
  },
];

export default function WhyUs() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '70px auto',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: '#14466B',
            fontSize: 38,
            fontWeight: 900,
          }}
        >
          ⭐ لماذا بوابة التميز؟
        </h2>

        <p
          style={{
            maxWidth: 850,
            margin: '20px auto',
            color: '#64748b',
            lineHeight: 2,
            fontSize: 18,
          }}
        >
          منصة موحدة لإدارة التعليم والتدريب وقياس الجودة وتحويل
          البيانات إلى قرارات تنفيذية تساعد المؤسسة على التميز.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 24,
        }}
      >
        {features.map((item) => (
          <div
            key={item.title}
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: 28,
              borderTop: `6px solid ${item.color}`,
              boxShadow: '0 10px 25px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 18,
                background: item.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 34,
                marginBottom: 20,
              }}
            >
              {item.icon}
            </div>

            <h3
              style={{
                margin: 0,
                color: '#14466B',
                fontWeight: 900,
              }}
            >
              {item.title}
            </h3>

            <p
              style={{
                marginTop: 14,
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
