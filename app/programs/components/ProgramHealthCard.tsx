'use client';

type Props = {
  score: number;
};

export default function ProgramHealthCard({
  score,
}: Props) {
  const status =
    score >= 90
      ? {
          color: '#16a34a',
          bg: '#dcfce7',
          text: 'ممتاز',
          icon: '🟢',
        }
      : score >= 75
      ? {
          color: '#2563eb',
          bg: '#dbeafe',
          text: 'جيد',
          icon: '🔵',
        }
      : score >= 60
      ? {
          color: '#f59e0b',
          bg: '#fef3c7',
          text: 'يحتاج متابعة',
          icon: '🟠',
        }
      : {
          color: '#dc2626',
          bg: '#fee2e2',
          text: 'خطر',
          icon: '🔴',
        };

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 24,
        padding: 30,
        boxShadow: '0 12px 30px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              color: '#64748b',
              fontSize: 14,
            }}
          >
            Program Health Score
          </div>

          <h2
            style={{
              margin: '10px 0',
              color: '#14466B',
              fontWeight: 900,
              fontSize: 30,
            }}
          >
            ❤️ صحة البرنامج
          </h2>

          <p
            style={{
              margin: 0,
              color: '#64748b',
            }}
          >
            مؤشر يجمع جودة البرنامج في رقم واحد.
          </p>
        </div>

        <div
          style={{
            width: 170,
            height: 170,
            borderRadius: '50%',
            background: status.bg,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            border: `8px solid ${status.color}`,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: status.color,
            }}
          >
            {score}
          </div>

          <div
            style={{
              color: status.color,
              fontWeight: 900,
            }}
          >
            /100
          </div>

          <div
            style={{
              marginTop: 10,
              fontWeight: 800,
              color: status.color,
            }}
          >
            {status.icon} {status.text}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 30,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 16,
        }}
      >
        <Metric
          title="رضا المتدربين"
          value="96%"
        />

        <Metric
          title="الحضور"
          value="94%"
        />

        <Metric
          title="استكمال التقييمات"
          value="88%"
        />

        <Metric
          title="تنفيذ التحسينات"
          value="82%"
        />
      </div>
    </section>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: 18,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: 13,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 10,
          color: '#14466B',
          fontSize: 28,
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}
