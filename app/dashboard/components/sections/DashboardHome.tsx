'use client';

import StatCard from '../cards/StatCard';
import ProgramCard from '../cards/ProgramCard';

type Program = {
  id: string;
  name_ar: string;
  name_en?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  start_date?: string | null;
  end_date?: string | null;
};

type Props = {
  programs: Program[];
  stats: {
    daily: number;
    final: number;
    avg: number;
  };
};

export default function DashboardHome({
  programs,
  stats,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* مؤشرات الأداء */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 18,
        }}
      >
        <StatCard
          title="البرامج"
          subtitle="Training Programs"
          value={programs.length}
          icon="📚"
          color="blue"
        />

        <StatCard
          title="البرامج النشطة"
          subtitle="Active Programs"
          value={programs.filter(p => p.status === 'ACTIVE').length}
          icon="✅"
          color="green"
        />

        <StatCard
          title="التقييمات اليومية"
          subtitle="Daily Evaluations"
          value={stats.daily}
          icon="📝"
          color="orange"
        />

        <StatCard
          title="متوسط الرضا"
          subtitle="Average Rating"
          value={stats.avg ? stats.avg.toFixed(2) : '--'}
          icon="⭐"
          color="purple"
        />
      </div>

      {/* آخر البرامج */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 10px 30px rgba(15,23,42,.05)',
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: '#14466B',
            fontSize: 24,
            fontWeight: 900,
          }}
        >
          📚 البرامج التدريبية
        </h2>

        <p
          style={{
            color: '#64748b',
            marginBottom: 24,
          }}
        >
          إدارة البرامج ومتابعة حالتها.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill,minmax(360px,1fr))',
            gap: 20,
          }}
        >
          {programs.map(program => (
            <ProgramCard
              key={program.id}
              nameAr={program.name_ar}
              nameEn={program.name_en}
              status={program.status}
              startDate={program.start_date}
              endDate={program.end_date}

              classrooms={0}
              trainers={0}
              participants={0}
              rating={stats.avg || 0}

              onEdit={() =>
                alert(`تعديل البرنامج: ${program.name_ar}`)
              }

              onReports={() =>
                window.location.href = '/reports'
              }

              onEvaluation={() =>
                window.location.href = '/evaluate/final'
              }
            />
          ))}

          {programs.length === 0 && (
            <div
              style={{
                padding: 40,
                borderRadius: 16,
                border: '2px dashed #cbd5e1',
                textAlign: 'center',
                color: '#64748b',
                gridColumn: '1 / -1',
              }}
            >
              لا توجد برامج تدريبية حتى الآن.
            </div>
          )}
        </div>
      </div>

      {/* الإجراءات السريعة */}
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: 24,
          boxShadow: '0 10px 30px rgba(15,23,42,.05)',
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: '#14466B',
          }}
        >
          ⚡ إجراءات سريعة
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(180px,1fr))',
            gap: 16,
          }}
        >
          <QuickButton
            icon="➕"
            title="برنامج جديد"
          />

          <QuickButton
            icon="🏫"
            title="إضافة قاعة"
          />

          <QuickButton
            icon="👨‍🏫"
            title="إضافة مدرب"
          />

          <QuickButton
            icon="📝"
            title="التقييم اليومي"
          />

          <QuickButton
            icon="🏁"
            title="التقييم النهائي"
          />

          <QuickButton
            icon="📊"
            title="التقارير"
          />
        </div>
      </div>
    </div>
  );
}

function QuickButton({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <button
      style={{
        background: '#14466B',
        color: '#fff',
        border: 0,
        borderRadius: 16,
        padding: 18,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 800,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
      }}
    >
      <span style={{ fontSize: 34 }}>
        {icon}
      </span>

      <span>{title}</span>
    </button>
  );
}
