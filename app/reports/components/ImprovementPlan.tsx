'use client';

type Action = {
  indicator: string;
  score: string;
  action: string;
  owner: string;
  due: string;
};

const actions: Action[] = [
  {
    indicator: 'إدارة الوقت',
    score: '3.58',
    action: 'تدريب المدربين على إدارة الوقت وتحديث الخطة الزمنية.',
    owner: 'الإشراف الأكاديمي',
    due: 'خلال 4 أسابيع',
  },
  {
    indicator: 'سرعة الاستجابة',
    score: '3.42',
    action: 'تحديد مدة قصوى للرد على استفسارات المتدربين ومتابعتها أسبوعيًا.',
    owner: 'خدمة المتدربين',
    due: 'خلال أسبوعين',
  },
  {
    indicator: 'الإنترنت',
    score: '3.66',
    action: 'رفع سعة الشبكة في القاعات وتوفير اتصال احتياطي.',
    owner: 'الدعم الفني',
    due: 'خلال 6 أسابيع',
  },
  {
    indicator: 'الخدمات المساندة',
    score: '3.71',
    action: 'مراجعة خدمات الضيافة والتجهيزات وتوحيد معاييرها.',
    owner: 'الشؤون الإدارية',
    due: 'خلال 4 أسابيع',
  },
  {
    indicator: 'التواصل بعد التدريب',
    score: '3.80',
    action: 'إرسال ملخص ومواد البرنامج للمتدربين خلال 48 ساعة من انتهائه.',
    owner: 'وحدة الجودة',
    due: 'خلال 3 أسابيع',
  },
];

export default function ImprovementPlan() {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 22,
        padding: 24,
        borderTop: '6px solid #2563EB',
        boxShadow: '0 10px 25px rgba(15,23,42,.05)',
        marginBottom: 30,
      }}
    >
      <h2
        style={{
          margin: 0,
          marginBottom: 20,
          color: '#2563EB',
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        🛠️ خطة التحسين
      </h2>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 15,
          }}
        >
          <thead>
            <tr style={{ background: '#f1f5f9', color: '#14466B' }}>
              <th style={th}>#</th>
              <th style={th}>المؤشر</th>
              <th style={th}>الدرجة</th>
              <th style={th}>الإجراء التحسيني</th>
              <th style={th}>الجهة المسؤولة</th>
              <th style={th}>الموعد</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((item, index) => (
              <tr
                key={item.indicator}
                style={{
                  borderBottom:
                    index === actions.length - 1
                      ? 'none'
                      : '1px solid #eef2f7',
                }}
              >
                <td style={td}>{index + 1}</td>
                <td style={{ ...td, fontWeight: 900, color: '#14466B' }}>
                  {item.indicator}
                </td>
                <td style={td}>
                  <span
                    style={{
                      background: '#DC2626',
                      color: '#fff',
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.score}
                  </span>
                </td>
                <td style={td}>{item.action}</td>
                <td style={td}>{item.owner}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{item.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'right',
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '14px',
  textAlign: 'right',
  verticalAlign: 'top',
  color: '#0f172a',
};
