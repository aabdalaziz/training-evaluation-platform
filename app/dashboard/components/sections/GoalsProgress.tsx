'use client';

const goals = [
  {
    title: 'رفع رضا المتدربين',
    current: 94,
    target: 95,
    color: '#3F7F79',
  },
  {
    title: 'استكمال التقييمات',
    current: 88,
    target: 100,
    color: '#8E4A68',
  },
  {
    title: 'الالتزام بالحضور',
    current: 93,
    target: 95,
    color: '#8E4A68',
  },
  {
    title: 'تنفيذ خطط التحسين',
    current: 82,
    target: 100,
    color: '#8A5A1E',
  },
];

export default function GoalsProgress() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(42,22,38,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          color: '#3A1F36',
          fontSize: 30,
          fontWeight: 900,
          marginBottom: 10,
        }}
      >
        🎯 التقدم نحو الأهداف الإستراتيجية
      </h2>

      <p
        style={{
          color: '#8E7F8A',
          marginBottom: 30,
        }}
      >
        متابعة لحظية لمستوى تحقيق أهداف المؤسسة.
      </p>

      <div
        style={{
          display: 'grid',
          gap: 20,
        }}
      >
        {goals.map((goal) => {
          const percent = Math.min(
            Math.round((goal.current / goal.target) * 100),
            100
          );

          return (
            <div key={goal.title}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <strong>{goal.title}</strong>

                <span
                  style={{
                    color: goal.color,
                    fontWeight: 900,
                  }}
                >
                  {goal.current}% / {goal.target}%
                </span>
              </div>

              <div
                style={{
                  height: 12,
                  background: '#EADFD6',
                  borderRadius: 20,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: goal.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
