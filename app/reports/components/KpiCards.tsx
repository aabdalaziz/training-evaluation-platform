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
      color: '#2563eb',
    },
    {
      title: 'التقييمات اليومية',
      value: daily,
      icon: '📝',
      color: '#16a34a',
    },
    {
      title: 'التقييمات النهائية',
      value: final,
      icon: '🏁',
      color: '#7c3aed',
    },
    {
      title: 'متوسط الرضا',
      value: average.toFixed(2),
      icon: '⭐',
      color: '#f59e0b',
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
                  color: '#14466B',
                }}
              >
                {card.value}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: '#64748b',
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
