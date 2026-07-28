'use client';

type AlertItem = {
  id: number;
  level: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
};

const alerts: AlertItem[] = [
  {
    id: 1,
    level: 'critical',
    title: 'برنامج بدون تقييمات',
    description: 'برنامج تعليم اللغة العربية لم يستقبل أي تقييم اليوم.',
  },
  {
    id: 2,
    level: 'warning',
    title: 'قاعة غير مرتبطة بمدرب',
    description: 'القاعة 203 تحتاج إلى تعيين مدرب.',
  },
  {
    id: 3,
    level: 'info',
    title: 'النسخة الاحتياطية',
    description: 'تم إنشاء آخر نسخة احتياطية بنجاح.',
  },
];

const styles = {
  critical: {
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#b91c1c',
    icon: '🔴',
  },
  warning: {
    bg: '#fffbeb',
    border: '#fde68a',
    color: '#b45309',
    icon: '🟠',
  },
  info: {
    bg: '#eff6ff',
    border: '#bfdbfe',
    color: '#1d4ed8',
    icon: '🔵',
  },
};

export default function AlertCenter() {
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
          marginBottom: 20,
          color: '#14466B',
          fontWeight: 900,
          fontSize: 26,
        }}
      >
        🔔 مركز التنبيهات
      </h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {alerts.map((alert) => {
          const s = styles[alert.level];

          return (
            <div
              key={alert.id}
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                }}
              >
                {s.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: s.color,
                    fontWeight: 900,
                    fontSize: 17,
                    marginBottom: 6,
                  }}
                >
                  {alert.title}
                </div>

                <div
                  style={{
                    color: '#475569',
                    lineHeight: 1.8,
                  }}
                >
                  {alert.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
