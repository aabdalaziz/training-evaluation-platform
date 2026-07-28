'use client';

const risks = [
  {
    level: 'مرتفع',
    title: 'برنامج بدون تقييمات يومية',
    description: 'برنامج تعليم اللغة العربية لم يستقبل أي تقييم اليوم.',
    color: '#DC2626',
    icon: '🔴',
  },
  {
    level: 'متوسط',
    title: 'انخفاض مؤشر إدارة الوقت',
    description: 'متوسط المؤشر 3.62 من 5 ويحتاج متابعة.',
    color: '#F59E0B',
    icon: '🟠',
  },
  {
    level: 'منخفض',
    title: 'اكتمال النسخ الاحتياطي',
    description: 'آخر نسخة احتياطية تمت بنجاح.',
    color: '#16A34A',
    icon: '🟢',
  },
];

export default function RiskMonitor() {
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
          marginBottom: 24,
          color: '#14466B',
          fontSize: 30,
          fontWeight: 900,
        }}
      >
        🚦 لوحة المخاطر المؤسسية
      </h2>

      <div
        style={{
          display: 'grid',
          gap: 18,
        }}
      >
        {risks.map((risk) => (
          <div
            key={risk.title}
            style={{
              borderLeft: `6px solid ${risk.color}`,
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 28 }}>
                {risk.icon}
              </div>

              <div>
                <div
                  style={{
                    color: '#14466B',
                    fontWeight: 900,
                    marginBottom: 6,
                  }}
                >
                  {risk.title}
                </div>

                <div
                  style={{
                    color: '#64748b',
                    lineHeight: 1.8,
                  }}
                >
                  {risk.description}
                </div>
              </div>
            </div>

            <span
              style={{
                background: risk.color,
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 20,
                fontWeight: 800,
              }}
            >
              {risk.level}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
