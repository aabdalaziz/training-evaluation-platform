'use client';

const areas = [
  {
    title: 'البرامج',
    status: 'ممتاز',
    color: '#16a34a',
    value: 96,
  },
  {
    title: 'المدربون',
    status: 'جيد',
    color: '#2563eb',
    value: 90,
  },
  {
    title: 'المتدربون',
    status: 'ممتاز',
    color: '#16a34a',
    value: 95,
  },
  {
    title: 'التقييمات',
    status: 'يحتاج متابعة',
    color: '#ea580c',
    value: 78,
  },
  {
    title: 'الحضور',
    status: 'ممتاز',
    color: '#16a34a',
    value: 94,
  },
  {
    title: 'خطط التحسين',
    status: 'متأخر',
    color: '#dc2626',
    value: 68,
  },
];

export default function EnterpriseRadar() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          color: '#14466B',
          fontSize: 30,
          fontWeight: 900,
        }}
      >
        🛰️ رادار المؤسسة
      </h2>

      <p
        style={{
          marginTop: 10,
          color: '#64748b',
          marginBottom: 30,
        }}
      >
        نظرة سريعة على جميع مراكز العمل.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 20,
        }}
      >
        {areas.map((item) => (
          <div
            key={item.title}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 18,
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <strong>{item.title}</strong>

              <span
                style={{
                  color: item.color,
                  fontWeight: 900,
                }}
              >
                {item.status}
              </span>
            </div>

            <div
              style={{
                height: 10,
                background: '#e5e7eb',
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${item.value}%`,
                  height: '100%',
                  background: item.color,
                }}
              />
            </div>

            <div
              style={{
                marginTop: 10,
                fontWeight: 900,
                color: item.color,
              }}
            >
              {item.value}%
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
