'use client';

const goals = [
  {
    title: 'رفع رضا المتدربين',
    current: 94,
    target: 95,
    color: '#16a34a',
  },
  {
    title: 'استكمال التقييمات',
    current: 88,
    target: 100,
    color: '#2563eb',
  },
  {
    title: 'الالتزام بالحضور',
    current: 93,
    target: 95,
    color: '#7c3aed',
  },
  {
    title: 'تنفيذ خطط التحسين',
    current: 82,
    target: 100,
    color: '#ea580c',
  },
];

export default function GoalsProgress() {
  return (
    <section
      style={{
        background: '#ffffff',
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
          marginBottom: 10,
        }}
      >
        🎯 التقدم نحو الأهداف الإستراتيجية
      </h2>

      <p
        style={{
          color: '#64748b',
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
                  background: '#e5e7eb',
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
