'use client';

type ScoreItem = {
  title: string;
  score: number;
};

const scores: ScoreItem[] = [
  { title: 'الجودة التعليمية', score: 96 },
  { title: 'رضا المتدربين', score: 94 },
  { title: 'الحضور', score: 93 },
  { title: 'استكمال التقييمات', score: 88 },
];

export default function PerformanceScore() {
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
          marginBottom: 24,
          color: '#14466B',
          fontSize: 28,
          fontWeight: 900,
        }}
      >
        🏆 أداء المؤسسة
      </h2>

      <div
        style={{
          display: 'grid',
          gap: 18,
        }}
      >
        {scores.map((item) => (
          <div key={item.title}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <strong>{item.title}</strong>
              <span
                style={{
                  color: '#14466B',
                  fontWeight: 900,
                }}
              >
                {item.score}%
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
                  width: `${item.score}%`,
                  height: '100%',
                  background: '#16a34a',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
