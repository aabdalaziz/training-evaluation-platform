'use client';

const goals = [
  {
    title: 'رفع رضا المتدربين',
    target: 95,
    current: 91,
    color: '#8E4A68',
  },
  {
    title: 'استكمال التقييمات',
    target: 100,
    current: 88,
    color: '#3F7F79',
  },
  {
    title: 'الالتزام بالحضور',
    target: 95,
    current: 93,
    color: '#8E4A68',
  },
  {
    title: 'تنفيذ خطط التحسين',
    target: 100,
    current: 82,
    color: '#8A5A1E',
  },
];

export default function StrategicGoals() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(42,22,38,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          color: '#3A1F36',
          fontSize: 28,
          fontWeight: 900,
        }}
      >
        🎯 الأهداف الإستراتيجية
      </h2>

      <p
        style={{
          color: '#8E7F8A',
          marginTop: 8,
          marginBottom: 24,
        }}
      >
        متابعة تقدم المؤسسة نحو أهدافها.
      </p>

      {goals.map((goal) => {
        const percent = Math.min(
          Math.round((goal.current / goal.target) * 100),
          100
        );

        return (
          <div
            key={goal.title}
            style={{
              marginBottom: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontWeight: 800,
              }}
            >
              <span>{goal.title}</span>

              <span>
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
                  borderRadius: 20,
                  transition: '.4s',
                }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
