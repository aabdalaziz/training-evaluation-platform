'use client';

export default function ExecutiveStatusBar() {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <Status
        color="#16a34a"
        icon="🟢"
        title="حالة المنصة"
        value="جميع الخدمات تعمل"
      />

      <Status
        color="#2563eb"
        icon="🎓"
        title="البرامج اليوم"
        value="3 برامج نشطة"
      />

      <Status
        color="#ea580c"
        icon="📝"
        title="التقييمات"
        value="36 تقييماً مستلماً"
      />

      <Status
        color="#7c3aed"
        icon="📅"
        title="آخر تحديث"
        value="قبل دقيقة واحدة"
      />
    </section>
  );
}

function Status({
  icon,
  title,
  value,
  color,
}: {
  icon: string;
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: 18,
        borderTop: `5px solid ${color}`,
        boxShadow: '0 8px 24px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontSize: 28,
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              color: '#64748b',
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            {title}
          </div>

          <div
            style={{
              color: '#14466B',
              fontSize: 17,
              fontWeight: 900,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
