'use client';

type Props = {
  userName: string;
  role: string;
  onRefresh?: () => void;
};

export default function DashboardHeader({
  userName,
  role,
  onRefresh,
}: Props) {
  const today = new Date();

  const date = today.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg,#14466B,#0B3552)',
        color: '#fff',
        borderRadius: 22,
        padding: '28px 32px',
        marginBottom: 28,
        boxShadow: '0 12px 30px rgba(20,70,107,.25)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              opacity: .85,
            }}
          >
            مرحباً بك
          </div>

          <h1
            style={{
              margin: '8px 0',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            {userName}
          </h1>

          <div
            style={{
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              fontSize: 14,
              opacity: .9,
            }}
          >
            <span>🏛️ بوابة التميز للتعليم والتطوير</span>

            <span>•</span>

            <span>{role}</span>

            <span>•</span>

            <span>{date}</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={onRefresh}
            style={buttonStyle}
          >
            🔄 تحديث البيانات
          </button>

          <button
            style={{
              ...buttonStyle,
              background: '#10B981',
            }}
          >
            📊 التقرير التنفيذي
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  border: 0,
  borderRadius: 12,
  padding: '12px 18px',
  cursor: 'pointer',
  color: '#fff',
  background: '#1FA39A',
  fontWeight: 800,
  fontFamily: 'inherit',
  fontSize: 14,
};
