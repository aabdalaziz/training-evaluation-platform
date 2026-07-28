'use client';

type InsightCardProps = {
  title: string;
  value: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendation: string;
};

const styles = {
  excellent: {
    color: '#15803d',
    bg: '#dcfce7',
    label: 'ممتاز',
  },
  good: {
    color: '#2563eb',
    bg: '#dbeafe',
    label: 'جيد',
  },
  warning: {
    color: '#d97706',
    bg: '#fef3c7',
    label: 'يحتاج متابعة',
  },
  critical: {
    color: '#b91c1c',
    bg: '#fee2e2',
    label: 'أولوية عاجلة',
  },
};

export default function InsightCard({
  title,
  value,
  status,
  recommendation,
}: InsightCardProps) {
  const s = styles[status];

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 10px 25px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            margin: 0,
            color: '#14466B',
            fontWeight: 900,
          }}
        >
          {title}
        </h3>

        <span
          style={{
            background: s.bg,
            color: s.color,
            padding: '6px 12px',
            borderRadius: 20,
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          {s.label}
        </span>
      </div>

      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          color: '#14466B',
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          background: '#f8fafc',
          color: '#475569',
          lineHeight: 1.8,
        }}
      >
        💡 {recommendation}
      </div>
    </div>
  );
}
