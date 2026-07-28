'use client';

type Task = {
  priority: 'عالية' | 'متوسطة' | 'منخفضة';
  title: string;
  description: string;
  action: string;
};

const tasks: Task[] = [
  {
    priority: 'عالية',
    title: 'اعتماد برنامج تعليم اللغة العربية',
    description: 'البرنامج جاهز للإطلاق وينتظر اعتماد الإدارة.',
    action: 'فتح البرنامج',
  },
  {
    priority: 'متوسطة',
    title: 'استكمال التقييمات اليومية',
    description: 'تبقى 18 متدربًا لم يرسلوا التقييم اليومي.',
    action: 'فتح التقييمات',
  },
  {
    priority: 'منخفضة',
    title: 'إصدار الشهادات',
    description: 'هناك 12 شهادة جاهزة للإصدار.',
    action: 'إدارة الشهادات',
  },
];

const colors = {
  عالية: '#dc2626',
  متوسطة: '#f59e0b',
  منخفضة: '#16a34a',
};

export default function ExecutiveTasks() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(15,23,42,.06)',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            margin: 0,
            color: '#14466B',
            fontSize: 30,
            fontWeight: 900,
          }}
        >
          🎯 أولويات اليوم
        </h2>

        <p
          style={{
            marginTop: 10,
            color: '#64748b',
          }}
        >
          أهم الأعمال التي تحتاج إلى اهتمامك اليوم.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {tasks.map((task) => (
          <div
            key={task.title}
            style={{
              borderLeft: `6px solid ${colors[task.priority]}`,
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: '#14466B',
                    fontWeight: 900,
                  }}
                >
                  {task.title}
                </h3>

                <p
                  style={{
                    marginTop: 8,
                    color: '#64748b',
                    lineHeight: 1.8,
                  }}
                >
                  {task.description}
                </p>
              </div>

              <button
                style={{
                  background: '#14466B',
                  color: '#fff',
                  border: 0,
                  borderRadius: 12,
                  padding: '12px 18px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {task.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
