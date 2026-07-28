'use client';

import WhyUs from './components/home/WhyUs';
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
    title: 'تقارير تنفيذية',
    description:
      'لوحات قيادة ومؤشرات أداء تساعد متخذ القرار.',
    color: '#16a34a',
  },
  {
    icon: '📝',
    title: 'التقييمات الذكية',
    description:
      'تحليل كل سؤال ومؤشر وفجوة بصورة مستقلة.',
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
        <Footer />
        <p
          style={{
            maxWidth: 850,
            margin: '18px auto',
            color: '#64748b',
            lineHeight: 2,
            fontSize: 18,
          }}
        >
          لأننا لا نعرض البيانات فقط...
          بل نحولها إلى معلومات، ثم إلى قرارات، ثم إلى تحسين مستمر.
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
              borderRadius: 22,
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
                lineHeight: 1.9,
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
