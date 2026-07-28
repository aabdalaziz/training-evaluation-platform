'use client';

type Recommendation = {
  level: 'success' | 'warning' | 'critical';
  title: string;
  description: string;
};

const recommendations: Recommendation[] = [
  {
    level: 'success',
    title: 'أداء البرامج ممتاز',
    description:
      'متوسط الرضا أعلى من المستهدف، ويُنصح بالحفاظ على الممارسات الحالية.',
  },
  {
    level: 'warning',
    title: 'برنامج يحتاج متابعة',
    description:
      'برنامج تعليم اللغة العربية لم يستقبل تقييمات اليوم حتى الآن.',
  },
  {
    level: 'critical',
    title: 'إجراء مقترح',
    description:
      'راجع مؤشر إدارة الوقت في القاعة 203 لأنه أقل من المستهدف.',
  },
];

const COLORS = {
  success: {
    bg: '#ecfdf5',
    border: '#bbf7d0',
    color: '#047857',
    icon: '✅',
  },
  warning: {
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#b45309',
    icon: '⚠️',
  },
  critical: {
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#b91c1c',
    icon: '🚨',
  },
};

export default function ExecutiveAdvisor() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            🤖 المستشار التنفيذي
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#64748b',
            }}
          >
            توصيات مبنية على بيانات المنصة.
          </p>
        </div>
      </div>

      <div
        style={{
          background: '#0B3552',
          color: '#fff',
          borderRadius: 18,
          padding: 24,
          marginBottom: 24,
          lineHeight: 1.9,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 20,
            marginBottom: 12,
          }}
        >
          صباح الخير د. أحمد 👋
        </div>

        <div>
          اليوم لديك 3 برامج نشطة،
          وتم استلام 18 تقييماً،
          ومتوسط الرضا الحالي 4.82 من 5.
          أوصي بمراجعة برنامج تعليم اللغة العربية لأن مؤشر
          <strong> إدارة الوقت </strong>
          انخفض عن المستهدف.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {recommendations.map((item, index) => {
          const c = COLORS[item.level];

          return (
            <div
              key={index}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                gap: 16,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                }}
              >
                {c.icon}
              </div>

              <div>
                <div
                  style={{
                    color: c.color,
                    fontWeight: 900,
                    fontSize: 17,
                    marginBottom: 6,
                  }}
                >
                  {item.title}
                </div>

                <div
                  style={{
                    color: '#475569',
                    lineHeight: 1.8,
                  }}
                >
                  {item.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
