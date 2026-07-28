'use client';

type Task = {
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
};

const tasks: Task[] = [
  {
    title: 'اعتماد برنامج تعليم اللغة العربية',
    completed: true,
    priority: 'high',
  },
  {
    title: 'مراجعة تقرير الجودة اليومي',
    completed: false,
    priority: 'high',
  },
  {
    title: 'اعتماد 8 شهادات مكتملة',
    completed: false,
    priority: 'medium',
  },
  {
    title: 'متابعة القاعة 203',
    completed: true,
    priority: 'low',
  },
];

const priorityColor = {
  high: '#dc2626',
  medium: '#f59e0b',
  low: '#16a34a',
};

export default function TodaysMission() {
  const completed = tasks.filter(t => t.completed).length;
  const progress = Math.round((completed / tasks.length) * 100);

  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            🎯 مهمتي اليوم
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#64748b',
            }}
          >
            أهم الأعمال المطلوب إنجازها اليوم.
          </p>
        </div>

        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: '#14466B',
            }}
          >
            {progress}%
          </div>

          <div
            style={{
              color: '#64748b',
            }}
          >
            نسبة الإنجاز
          </div>
        </div>
      </div>

      <div
        style={{
          height: 12,
          background: '#e5e7eb',
          borderRadius: 30,
          overflow: 'hidden',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: '#16a34a',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {tasks.map((task, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              border: '1px solid #e2e8f0',
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 24,
              }}
            >
              {task.completed ? '✅' : '⬜'}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 800,
                  color: '#14466B',
                }}
              >
                {task.title}
              </div>
            </div>

            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: priorityColor[task.priority],
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
