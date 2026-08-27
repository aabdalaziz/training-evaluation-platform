const features = [
  { icon: '🎓', title: 'إدارة التعليم' },
  { icon: '📊', title: 'تقارير تنفيذية' },
  { icon: '📝', title: 'تقييمات ذكية' },
  { icon: '🤖', title: 'ذكاء تنفيذي' },
];

export default function WhyExcellence() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '60px auto',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: 40,
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(15,23,42,.05)',
        }}
      >
        <h2
          style={{
            margin: 0,
            color: '#14466B',
            fontSize: 36,
            fontWeight: 900,
          }}
        >
          ⭐ لماذا بوابة التميز؟
        </h2>

        <p
          style={{
            maxWidth: 900,
            margin: '20px auto',
            color: '#64748b',
            lineHeight: 2,
            fontSize: 18,
          }}
        >
          منصة موحدة لإدارة التعليم والتدريب والتعلم الإلكتروني،
          وقياس الجودة، وتحليل النتائج، وتحويل البيانات إلى قرارات
          تنفيذية تساعد المؤسسات على تحقيق التميز.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
            marginTop: 40,
          }}
        >
          {features.map((feature) => (
            <Feature key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Feature({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 18,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: 42,
          marginBottom: 16,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          color: '#14466B',
          fontWeight: 900,
          fontSize: 18,
        }}
      >
        {title}
      </div>
    </div>
  );
}
