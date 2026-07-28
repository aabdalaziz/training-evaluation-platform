'use client';

export default function ProgramExecutiveSummary() {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg,#14466B,#0B3552)',
        color: '#fff',
        borderRadius: 24,
        padding: 30,
        boxShadow: '0 15px 35px rgba(20,70,107,.20)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 30,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              opacity: .85,
              fontSize: 14,
            }}
          >
            Executive Summary
          </div>

          <h2
            style={{
              margin: '10px 0',
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            📋 الملخص التنفيذي للبرنامج
          </h2>

          <p
            style={{
              lineHeight: 2,
              fontSize: 18,
              margin: 0,
              maxWidth: 760,
            }}
          >
            البرنامج يسير بصورة ممتازة، وارتفع متوسط الرضا إلى
            <strong> 4.82 / 5 </strong>
            مع نسبة حضور بلغت
            <strong> 94% </strong>
            ويوصى بمتابعة مؤشر إدارة الوقت خلال الأسبوع الحالي.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,.10)',
            borderRadius: 18,
            padding: 20,
            minWidth: 240,
            border: '1px solid rgba(255,255,255,.15)',
          }}
        >
          <div
            style={{
              fontSize: 14,
              opacity: .85,
            }}
          >
            حالة البرنامج
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 38,
              fontWeight: 900,
            }}
          >
            ✅ ممتاز
          </div>

          <div
            style={{
              marginTop: 10,
              opacity: .9,
            }}
          >
            آخر تحديث: الآن
          </div>
        </div>
      </div>
    </section>
  );
}
