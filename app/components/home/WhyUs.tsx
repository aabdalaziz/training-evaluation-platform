'use client';

const features = [
  {
    icon: '🎓',
    title: 'إدارة التعليم والتدريب',
    description:
      'إدارة البرامج، الدورات، الدبلومات، والمتدربين من مكان واحد.',
    color: '#2563eb',
  },
  {
    icon: '📊',
    title: 'مؤشرات تنفيذية',
    description:
      'لوحات قيادة وتقارير تدعم متخذ القرار بمعلومات لحظية.',
    color: '#16a34a',
  },
  {
    icon: '📝',
    title: 'تقييمات ذكية',
    description:
      'التقييم اليومي والنهائي مع تحليل كل سؤال ومؤشر على حدة.',
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
            fontSize: 40,
            fontWeight: 900,
            color: '#14466B',
          }}
        >
          ⭐ لماذا بوابة التميز؟
        </h2>

        <p
          style={{
            marginTop: 15,
            color: '#64748b',
            fontSize: 18,
            lineHeight: 1.8,
            maxWidth: 800,
            marginInline: 'auto',
          }}
        >
          لأننا لا نجمع البيانات فقط...
          بل نحولها إلى قرارات تساعد المؤسسة على التطوير المستمر.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(260px,1fr))',
          gap: 24,
        }}
      >
        {features.map((feature) => (
          <div
            key={feature.title}
            style={{
              background: '#fff',
              borderRadius: 22,
              padding: 28,
              borderTop: `6px solid ${feature.color}`,
              boxShadow: '0 10px 30px rgba(15,23,42,.05)',
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 18,
                background: feature.color,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#fff',
                fontSize: 34,
                marginBottom: 22,
              }}
            >
              {feature.icon}
            </div>

            <h3
              style={{
                margin: 0,
                color: '#14466B',
                fontWeight: 900,
                fontSize: 22,
              }}
            >
              {feature.title}
            </h3>

            <p
              style={{
                marginTop: 14,
                color: '#64748b',
                lineHeight: 1.9,
                fontSize: 15,
              }}
            >
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
