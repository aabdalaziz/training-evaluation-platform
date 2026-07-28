'use client';

type Props = {
  totalParticipants: number;
  averageRating: number;
  excellenceIndex: number;
};

export default function ExecutiveSummary({
  totalParticipants,
  averageRating,
  excellenceIndex,
}: Props) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg,#14466B,#0B3552)',
        color: '#fff',
        borderRadius: 24,
        padding: 32,
        marginBottom: 30,
        boxShadow: '0 15px 35px rgba(20,70,107,.20)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 30,
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              opacity: .85,
              fontSize: 14,
            }}
          >
            Executive Summary
          </div>

          <h1
            style={{
              margin: '10px 0',
              fontSize: 38,
              fontWeight: 900,
            }}
          >
            📊 التقرير التنفيذي
          </h1>

          <p
            style={{
              lineHeight: 2,
              fontSize: 18,
              maxWidth: 700,
            }}
          >
            تم استلام
            <strong> {totalParticipants} </strong>
            مشاركة، بمتوسط رضا
            <strong> {averageRating.toFixed(2)} / 5 </strong>
            ويبلغ مؤشر التميز المؤسسي
            <strong> {excellenceIndex} / 100 </strong>.
          </p>
        </div>

        <div
          style={{
            textAlign: 'center',
            background: 'rgba(255,255,255,.12)',
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
            }}
          >
            {excellenceIndex}
          </div>

          <div
            style={{
              marginTop: 10,
              fontWeight: 700,
            }}
          >
            مؤشر التميز المؤسسي
          </div>
        </div>
      </div>
    </section>
  );
}
