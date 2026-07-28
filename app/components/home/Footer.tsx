'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: 80,
        background: '#0B3552',
        color: '#fff',
        padding: '60px 30px 30px',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: 40,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            🏛 بوابة التميز للتعليم والتطوير
          </h2>

          <p
            style={{
              marginTop: 20,
              lineHeight: 2,
              opacity: .85,
            }}
          >
            منصة موحدة لإدارة التعليم والتدريب،
            وقياس الجودة،
            وتحويل البيانات إلى قرارات تنفيذية.
          </p>
        </div>

        <div>
          <h3>روابط سريعة</h3>

          <FooterLink href="/login">
            دخول الإدارة
          </FooterLink>

          <FooterLink href="/evaluate/daily">
            التقييم اليومي
          </FooterLink>

          <FooterLink href="/evaluate/final">
            التقييم النهائي
          </FooterLink>

          <FooterLink href="/reports">
            التقارير
          </FooterLink>
        </div>

        <div>
          <h3>الدعم</h3>

          <p>support@example.com</p>

          <p>+966 50 000 0000</p>

          <p>المدينة المنورة</p>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,.12)',
          marginTop: 40,
          paddingTop: 20,
          textAlign: 'center',
          opacity: .7,
        }}
      >
        © 2026 بوابة التميز للتعليم والتطوير
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <Link
        href={href}
        style={{
          color: '#fff',
          textDecoration: 'none',
        }}
      >
        {children}
      </Link>
    </div>
  );
}
