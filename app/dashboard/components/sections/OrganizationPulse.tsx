'use client';

type PulseItem = {
  title: string;
  status: 'success' | 'warning' | 'danger';
};

const items: PulseItem[] = [
  {
    title: 'البرامج تعمل بصورة طبيعية',
    status: 'success',
  },
  {
    title: 'الحضور منتظم في جميع القاعات',
    status: 'success',
  },
  {
    title: 'جميع التقييمات تصل بدون أخطاء',
    status: 'success',
  },
  {
    title: 'يوجد برنامج يحتاج متابعة',
    status: 'warning',
  },
];

const COLORS = {
  success: {
    color: '#16a34a',
    bg: '#dcfce7',
    icon: '✅',
  },
  warning: {
    color: '#d97706',
    bg: '#fef3c7',
    icon: '⚠️',
  },
  danger: {
    color: '#dc2626',
    bg: '#fee2e2',
    icon: '🚨',
  },
};

export default function OrganizationPulse() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 12px 30px rgba(15,23,42,.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div>
          <div
            style={{
              color: '#64748b',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Organization Pulse
          </div>

          <h2
            style={{
              margin: '8px 0',
              color: '#14466B',
              fontSize: 32,
              fontWeight: 900,
            }}
          >
            ❤️ نبض المؤسسة
          </h2>

          <p
            style={{
              margin: 0,
              color: '#64748b',
              lineHeight: 1.8,
            }}
          >
            ملخص سريع للحالة التشغيلية للمؤسسة.
          </p>
        </div>

        <div
          style={{
            background: '#dcfce7',
            color: '#15803d',
            borderRadius: 20,
            padding: '18px 28px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
            }}
          >
            ممتاز
          </div>

          <div
            style={{
              marginTop: 6,
              fontWeight: 700,
            }}
          >
            الحالة العامة
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
          gap: 16,
        }}
      >
        {items.map((item) => {
          const s = COLORS[item.status];

          return (
            <div
              key={item.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: s.bg,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: '#ffffff',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: 22,
                }}
              >
                {s.icon}
              </div>

              <div
                style={{
                  color: s.color,
                  fontWeight: 800,
                }}
              >
                {item.title}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 28,
          background: '#14466B',
          color: '#fff',
          borderRadius: 18,
          padding: 22,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              opacity: .85,
              fontSize: 14,
            }}
          >
            مؤشر التميز المؤسسي
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 40,
              fontWeight: 900,
            }}
          >
            92 / 100
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,.12)',
            borderRadius: 14,
            padding: '12px 18px',
            fontWeight: 700,
          }}
        >
          ↑ تحسن بمقدار 4 نقاط عن الأسبوع الماضي
        </div>
      </div>
    </section>
  );
}
