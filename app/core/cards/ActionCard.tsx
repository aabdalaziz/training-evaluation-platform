'use client';

import { useRouter } from 'next/navigation';

type Props = {
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
}: Props) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      style={{
        width: '100%',
        border: '1px solid #e2e8f0',
        background: '#fff',
        borderRadius: 20,
        padding: 22,
        cursor: 'pointer',
        transition: '.25s',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(15,23,42,.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow =
          '0 18px 35px rgba(15,23,42,.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow =
          '0 8px 24px rgba(15,23,42,.05)';
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
          color: '#14466B',
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 8,
          color: '#64748b',
          fontSize: 13,
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}
