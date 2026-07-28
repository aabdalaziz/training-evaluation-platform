'use client';

type Indicator = {
  name: string;
  score: number;
};

const strengths: Indicator[] = [
  { name: 'وضوح الشرح', score: 4.92 },
  { name: 'احترام المدرب للوقت', score: 4.87 },
  { name: 'جودة المادة العلمية', score: 4.83 },
  { name: 'التفاعل مع المتدربين', score: 4.79 },
  { name: 'تنظيم البرنامج', score: 4.75 },
];

const gaps: Indicator[] = [
  { name: 'سرعة الاستجابة', score: 3.42 },
  { name: 'إدارة الوقت', score: 3.58 },
  { name: 'الإنترنت', score: 3.66 },
  { name: 'الخدمات المساندة', score: 3.71 },
  { name: 'التواصل بعد التدريب', score: 3.80 },
];

export default function StrengthsAndGaps() {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        marginBottom: 30,
      }}
    >
      <Panel
        title="🟢 أقوى المؤشرات"
        color="#16A34A"
        items={strengths}
      />

      <Panel
        title="🔴 أكبر الفجوات"
        color="#DC2626"
        items={gaps}
      />
    </section>
  );
}

function Panel({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: Indicator[];
}) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        borderTop: `6px solid ${color}`,
        boxShadow: '0 10px 25px rgba(15,23,42,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 20,
          color,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        {title}
      </h2>

      {items.map((item, index) => (
        <div
          key={item.name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 0',
            borderBottom:
              index === items.length - 1
                ? 'none'
                : '1px solid #eef2f7',
          }}
        >
          <div>
            <strong
              style={{
                color: '#14466B',
              }}
            >
              {item.name}
            </strong>
          </div>

          <div
            style={{
              background: color,
              color: '#fff',
              borderRadius: 20,
              padding: '6px 14px',
              fontWeight: 900,
            }}
          >
            {item.score.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}
