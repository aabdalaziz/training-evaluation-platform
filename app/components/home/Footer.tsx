'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: 80,
        background: '#14466B',
        color: '#fff',
        padding: '50px 30px',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontWeight: 900,
        }}
      >
        🏛 بوابة التميز للتعليم والتطوير
      </h2>

      <p
        style={{
          marginTop: 14,
          opacity: .9,
        }}
      >
        Excellence Portal for Education & Development
      </p>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'center',
          gap: 25,
          flexWrap: 'wrap',
        }}
      >
        <Link href="/login" style={{ color: '#fff' }}>
          دخول الإدارة
        </Link>

        <Link href="/evaluate/daily" style={{ color: '#fff' }}>
          التقييم اليومي
        </Link>

        <Link href="/evaluate/final" style={{ color: '#fff' }}>
          التقييم النهائي
        </Link>

        <Link href="/reports" style={{ color: '#fff' }}>
          التقارير
        </Link>
      </div>

      <div
        style={{
          marginTop: 30,
          opacity: .7,
          fontSize: 14,
        }}
      >
        © 2026 جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
Create Footer component
