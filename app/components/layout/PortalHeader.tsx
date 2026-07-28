'use client';

import Link from 'next/link';

export default function PortalHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: '#14466B',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#14466B',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            🏛️
          </div>

          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              بوابة التميز
            </div>

            <div
              style={{
                fontSize: 12,
                color: '#64748b',
              }}
            >
              Excellence Portal
            </div>
          </div>
        </Link>

        <nav
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <NavButton href="/">🏠 الرئيسية</NavButton>

          <NavButton href="/dashboard">
            🏛 مركز القيادة
          </NavButton>

          <NavButton href="/evaluate/daily">
            📝 التقييم اليومي
          </NavButton>

          <NavButton href="/evaluate/final">
            🏁 التقييم النهائي
          </NavButton>

          <NavButton href="/reports">
            📊 التقارير
          </NavButton>

          <NavButton href="/login">
            🔐 دخول الإدارة
          </NavButton>
        </nav>
      </div>
    </header>
  );
}

function NavButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        color: '#14466B',
        fontWeight: 800,
        padding: '10px 16px',
        borderRadius: 12,
        transition: '.2s',
      }}
    >
      {children}
    </Link>
  );
}
