'use client';

import { useRouter } from 'next/navigation';

type ActionCardProps = {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  href: string;
};

export default function ActionCard({
  title,
  subtitle,
  icon,
  color,
  href,
}: ActionCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      style={{
        width: '100%',
        border: '1px solid #EADFD6',
        background: '#fff',
        borderRadius: 20,
        padding: 22,
        cursor: 'pointer',
        transition: 'all .25s ease',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(42,22,38,.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow =
          '0 18px 35px rgba(42,22,38,.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          '0 8px 24px rgba(42,22,38,.05)';
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          margin: '0 auto 18px',
          borderRadius: 20,
          background: color,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          fontSize: 34,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: '#3A1F36',
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: '#8E7F8A',
          fontSize: 13,
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}
