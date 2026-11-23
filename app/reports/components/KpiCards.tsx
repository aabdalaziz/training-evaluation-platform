'use client';

type Props = {
  participants: number;
  daily: number;
  final: number;
  average: number;
};

export default function KpiCards({
  participants,
  daily,
  final,
  average,
}: Props) {
  const cards = [
    {
      title: 'إجمالي المشاركين',
      value: participants,
      icon: '👨‍🎓',
      color: '#8E4A68',
    },
    {
      title: 'التقييمات اليومية',
      value: daily,
      icon: '📝',
      color: '#3F7F79',
    },
    {
      title: 'التقييمات النهائية',
      value: final,
      icon: '🏁',
      color: '#8E4A68',
    },
    {
      title: 'متوسط الرضا',
      value: average.toFixed(2),
      icon: '⭐',
      color: '#D9A866',
    },
  ];

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
        gap: 20,
        marginBottom: 30,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            background: '#fff',
            borderRadius: 22,
            padding: 24,
            borderTop: `6px solid ${card.color}`,
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
                width: 60,
                height: 60,
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

            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: '#3A1F36',
                }}
              >
                {card.value}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: '#8E7F8A',
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
