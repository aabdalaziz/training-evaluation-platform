'use client';

import ActionCard from '../../../core/cards/ActionCard';

export default function OperationsCenter() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            ⚡ مركز العمليات
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#64748b',
            }}
          >
            الوصول السريع إلى أكثر العمليات استخدامًا.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 18,
        }}
      >
        <ActionCard
          title="إنشاء برنامج"
          subtitle="Training Program"
          icon="📚"
          color="#2563eb"
          href="/dashboard?view=programs"
        />

        <ActionCard
          title="إنشاء قاعة"
          subtitle="Classroom"
          icon="🏫"
          color="#059669"
          href="/admin/management"
        />

        <ActionCard
          title="إضافة مدرب"
          subtitle="Trainer"
          icon="👨‍🏫"
          color="#7c3aed"
          href="/admin/management"
        />

        <ActionCard
          title="التقييم اليومي"
          subtitle="Daily Evaluation"
          icon="📝"
          color="#ea580c"
          href="/evaluate/daily"
        />

        <ActionCard
          title="التقييم النهائي"
          subtitle="Final Evaluation"
          icon="🏁"
          color="#dc2626"
          href="/evaluate/final"
        />

        <ActionCard
          title="التقارير"
          subtitle="Executive Reports"
          icon="📊"
          color="#0891b2"
          href="/reports"
        />
      </div>
    </section>
  );
}
