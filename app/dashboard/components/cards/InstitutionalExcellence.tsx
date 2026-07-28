'use client';

type Metric = {
  title: string;
  value: number;
  color: string;
};

const metrics: Metric[] = [
  {
    title: 'جودة البرامج',
    value: 96,
    color: '#2563eb',
  },
  {
    title: 'رضا المتدربين',
    value: 95,
    color: '#16a34a',
  },
  {
    title: 'الحضور',
    value: 93,
    color: '#7c3aed',
  },
  {
    title: 'استكمال التقييمات',
    value: 88,
    color: '#ea580c',
  },
  {
    title: 'تنفيذ التحسينات',
    value: 82,
    color: '#dc2626',
  },
];

const overall = 91;

export default function InstitutionalExcellence() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div>
          <div
            style={{
              color: '#64748b',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Excellence Index
          </div>

          <h2
            style={{
              margin: '6px 0',
              fontSize: 30,
              color: '#14466B',
              fontWeight: 900,
            }}
          >
            🏆 مؤشر التميز المؤسسي
          </h2>

          <div
            style={{
              color: '#64748b',
            }}
          >
            يقيس الأداء العام للمؤسسة بصورة لحظية.
          </div>
        </div>

        <div
          style={{
            width: 170,
            height: 170,
            borderRadius: '50%',
            background:
              'linear-gradient(135deg,#16a34a,#22c55e)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#fff',
            flexDirection: 'column',
            boxShadow:
              '0 12px 30px rgba(34,197,94,.35)',
          }}
        >
          <div
            style={{
              fontSize: 46,
              fontWeight: 900,
            }}
          >
            {overall}
          </div>

          <div
            style={{
              fontWeight: 700,
            }}
          >
            /100
          </div>

          <div
            style={{
              marginTop: 10,
              fontWeight: 900,
            }}
          >
            ممتاز
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit,minmax(240px,1fr))',
          gap: 18,
        }}
      >
        {metrics.map((metric) => (
          <MetricCard
            key={metric.title}
            metric={metric}
          />
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  metric,
}: {
  metric: Metric;
}) {
  return (
    <div
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
        <div
          style={{
            fontWeight: 800,
            color: '#334155',
          }}
        >
          {metric.title}
        </div>

        <div
          style={{
            color: metric.color,
            fontWeight: 900,
          }}
        >
          {metric.value}%
        </div>
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
            width: `${metric.value}%`,
            background: metric.color,
            height: '100%',
          }}
        />
      </div>
    </div>
  );
}
