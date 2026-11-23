'use client';

const cards = [
  {
    icon: '👨‍🎓',
    title: 'المتدربون',
    value: '126',
    color: '#8E4A68',
  },
  {
    icon: '👨‍🏫',
    title: 'المدربون',
    value: '6',
    color: '#8E4A68',
  },
  {
    icon: '🏫',
    title: 'القاعات',
    value: '8',
    color: '#3F7F79',
  },
  {
    icon: '📝',
    title: 'التقييمات',
    value: '38',
    color: '#8A5A1E',
  },
  {
    icon: '✅',
    title: 'الحضور',
    value: '94%',
    color: '#3F7F79',
  },
  {
    icon: '⭐',
    title: 'متوسط الرضا',
    value: '4.82',
    color: '#D9A866',
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
            boxShadow: '0 10px 25px rgba(42,22,38,.05)',
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
                  color: '#3A1F36',
                }}
              >
                {card.value}
              </div>

              <div
                style={{
                  color: '#8E7F8A',
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
