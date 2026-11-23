'use client';

import ActionCard from '../../../core/cards/ActionCard';

export default function OperationsCenter() {
  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: 22,
        padding: 24,
        boxShadow: '0 10px 30px rgba(42,22,38,.05)',
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
              color: '#3A1F36',
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            ⚡ مركز العمليات
          </h2>

          <p
            style={{
              marginTop: 8,
              color: '#8E7F8A',
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
          color="#8E4A68"
          href="/dashboard?view=programs"
        />

        <ActionCard
          title="إنشاء قاعة"
          subtitle="Classroom"
          icon="🏫"
          color="#2F6B66"
          href="/admin/management"
        />

        <ActionCard
          title="إضافة مدرب"
          subtitle="Trainer"
          icon="👨‍🏫"
          color="#8E4A68"
          href="/admin/management"
        />

        <ActionCard
          title="التقييم اليومي"
          subtitle="Daily Evaluation"
          icon="📝"
          color="#8A5A1E"
          href="/evaluate/daily"
        />

        <ActionCard
          title="التقييم النهائي"
          subtitle="Final Evaluation"
          icon="🏁"
          color="#D4614A"
          href="/evaluate/final"
        />

        <ActionCard
          title="التقارير"
          subtitle="Executive Reports"
          icon="📊"
          color="#3F7F79"
          href="/reports"
        />
      </div>
    </section>
  );
}
