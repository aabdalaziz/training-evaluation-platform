'use client';

type InsightCardProps = {
  title: string;
  value: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendation: string;
};

const styles = {
  excellent: {
    color: '#2F6B66',
    bg: '#E6F3F1',
    label: 'ممتاز',
  },
  good: {
    color: '#8E4A68',
    bg: '#F3E8EF',
    label: 'جيد',
  },
  warning: {
    color: '#8A5A1E',
    bg: '#F1D9A8',
    label: 'يحتاج متابعة',
  },
  critical: {
    color: '#B9544A',
    bg: '#FBEDE7',
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
        boxShadow: '0 10px 25px rgba(42,22,38,.05)',
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
            color: '#3A1F36',
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
          color: '#3A1F36',
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 12,
          background: '#FBF4EE',
          color: '#5C4858',
          lineHeight: 1.8,
        }}
      >
        💡 {recommendation}
      </div>
    </div>
  );
}
