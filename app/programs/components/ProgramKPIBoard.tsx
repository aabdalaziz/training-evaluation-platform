'use client';

const cards = [
  {
    icon: '👨‍🎓',
    title: 'المتدربون',
    value: '126',
    color: '#2563eb',
  },
  {
    icon: '👨‍🏫',
    title: 'المدربون',
    value: '6',
    color: '#7c3aed',
  },
  {
    icon: '🏫',
    title: 'القاعات',
    value: '8',
    color: '#16a34a',
  },
  {
    icon: '📝',
    title: 'التقييمات',
    value: '38',
    color: '#ea580c',
  },
  {
    icon: '✅',
    title: 'الحضور',
    value: '94%',
    color: '#0891b2',
  },
  {
    icon: '⭐',
    title: 'متوسط الرضا',
    value: '4.82',
    color: '#f59e0b',
  },
];

export default function ProgramKPIBoard() {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
        gap: 20,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: 22,
            borderTop: `5px solid ${card.color}`,
            boxShadow: '0 10px 25px rgba(15,23,42,.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: card.color,
                color: '#fff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 28,
              }}
            >
              {card.icon}
            </div>

            <div
              style={{
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: '#14466B',
                }}
              >
                {card.value}
              </div>

              <div
                style={{
                  color: '#64748b',
                  marginTop: 6,
                }}
              >
                {card.title}
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
