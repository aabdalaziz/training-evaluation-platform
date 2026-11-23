'use client';

import StatCard from '../cards/StatCard';

export default function KPIGrid() {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
        gap: 22,
      }}
    >
      <StatCard
        title="البرامج النشطة"
        value={26}
        subtitle="Active Programs"
        icon="📚"
        color="#8E4A68"
        trend="+2"
      />

      <StatCard
        title="المدربون"
        value={42}
        subtitle="Trainers"
        icon="👨‍🏫"
        color="#8E4A68"
        trend="+1"
      />

      <StatCard
        title="المتدربون"
        value={1823}
        subtitle="Students"
        icon="👨‍🎓"
        color="#3F7F79"
        trend="+48"
      />

      <StatCard
        title="متوسط الرضا"
        value="4.82"
        subtitle="Average Rating"
        icon="⭐"
        color="#D9A866"
        trend="+0.12"
      />

      <StatCard
        title="الحضور"
        value="94%"
        subtitle="Attendance"
        icon="✅"
        color="#3F7F79"
        trend="+3%"
      />

      <StatCard
        title="التقييمات اليوم"
        value={38}
        subtitle="Today's Evaluations"
        icon="📝"
        color="#D4614A"
        trend="+12"
      />
    </section>
  );
}
