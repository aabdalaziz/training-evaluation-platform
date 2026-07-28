'use client';

const partners = [
  'جامعة الأمير مقرن',
  'مركز تعليم اللغة العربية',
  'مركز التدريب',
  'شريك إستراتيجي',
];

export default function Partners() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '70px auto',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: 40,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: '#14466B',
            fontSize: 38,
            fontWeight: 900,
          }}
        >
          🤝 شركاء النجاح
        </h2>

        <p
          style={{
            marginTop: 16,
            color: '#64748b',
            fontSize: 18,
          }}
        >
          نفخر بشراكاتنا مع المؤسسات التعليمية والتدريبية.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 24,
        }}
      >
        {partners.map((partner) => (
          <div
            key={partner}
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: 28,
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(15,23,42,.05)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                margin: '0 auto 18px',
                borderRadius: '50%',
                background: '#eef4ff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 36,
              }}
            >
              🏛️
            </div>

            <h3
              style={{
                margin: 0,
                color: '#14466B',
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              {partner}
            </h3>
          </div>
        ))}
      </div>
    </section>
  );
}
