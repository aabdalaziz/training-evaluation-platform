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
    description: 'تبقى 18 مشاركًا لم يرسلوا التقييم اليومي.',
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
  عالية: '#D4614A',
  متوسطة: '#D9A866',
  منخفضة: '#3F7F79',
};

export default function ExecutiveTasks() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 24,
        padding: 28,
        boxShadow: '0 10px 30px rgba(42,22,38,.06)',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2
          style={{
            margin: 0,
            color: '#3A1F36',
            fontSize: 30,
            fontWeight: 900,
          }}
        >
          🎯 أولويات اليوم
        </h2>

        <p
          style={{
            marginTop: 10,
            color: '#8E7F8A',
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
              border: '1px solid #EADFD6',
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
                    color: '#3A1F36',
                    fontWeight: 900,
                  }}
                >
                  {task.title}
                </h3>

                <p
                  style={{
                    marginTop: 8,
                    color: '#8E7F8A',
                    lineHeight: 1.8,
                  }}
                >
                  {task.description}
                </p>
              </div>

              <button
                style={{
                  background: '#3A1F36',
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
