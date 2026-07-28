'use client';

type HealthStatus = 'healthy' | 'warning' | 'critical';

type Props = {
  status: HealthStatus;
  items: string[];
};

const CONFIG = {
  healthy: {
    title: 'ممتاز',
    icon: '🟢',
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
  },
  warning: {
    title: 'يحتاج متابعة',
    icon: '🟠',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fcd34d',
  },
  critical: {
    title: 'يحتاج تدخل',
    icon: '🔴',
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fca5a5',
  },
};

export default function SystemHealthCard({
  status,
  items,
}: Props) {
  const c = CONFIG[status];

  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: 18,
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 34 }}>
          {c.icon}
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              color: c.color,
              fontWeight: 900,
            }}
          >
            مؤشر صحة المنصة
          </h2>

          <div
            style={{
              color: c.color,
              fontWeight: 700,
              marginTop: 4,
            }}
          >
            {c.title}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#334155',
              fontWeight: 700,
            }}
          >
            ✅ {item}
          </div>
        ))}
      </div>
    </div>
  );
}
