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
    color: '#2F6B66',
    bg: '#E6F3F1',
    border: '#BFE1DC',
  },
  warning: {
    title: 'يحتاج متابعة',
    icon: '🟠',
    color: '#8A5A1E',
    bg: '#FBF4EE',
    border: '#E9C98A',
  },
  critical: {
    title: 'يحتاج تدخل',
    icon: '🔴',
    color: '#B9544A',
    bg: '#FBEDE7',
    border: '#F3C4B6',
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
            مؤشر صحة البوّابة
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
              color: '#4A3645',
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
