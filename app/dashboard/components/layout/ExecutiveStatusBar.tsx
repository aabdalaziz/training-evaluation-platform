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
        color="#3F7F79"
        icon="🟢"
        title="حالة البوّابة"
        value="جميع الخدمات تعمل"
      />

      <Status
        color="#8E4A68"
        icon="🎓"
        title="البرامج اليوم"
        value="3 برامج نشطة"
      />

      <Status
        color="#8A5A1E"
        icon="📝"
        title="التقييمات"
        value="36 تقييماً مستلماً"
      />

      <Status
        color="#8E4A68"
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
        boxShadow: '0 8px 24px rgba(42,22,38,.05)',
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
              color: '#8E7F8A',
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            {title}
          </div>

          <div
            style={{
              color: '#3A1F36',
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
