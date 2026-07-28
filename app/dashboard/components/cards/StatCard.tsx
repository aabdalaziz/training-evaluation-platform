'use client';

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
  trend?: string;
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
}: Props) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        borderTop: `6px solid ${color}`,
        boxShadow: '0 12px 30px rgba(15,23,42,.06)',
        transition: '.25s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 22,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: color,
            color: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: 30,
          }}
        >
          {icon}
        </div>

        {trend && (
          <div
            style={{
              background: '#dcfce7',
              color: '#15803d',
              padding: '6px 10px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {trend}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          color: '#14466B',
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 18,
          fontWeight: 800,
          color: '#334155',
        }}
      >
        {title}
      </div>

      {subtitle && (
        <div
          style={{
            marginTop: 8,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
