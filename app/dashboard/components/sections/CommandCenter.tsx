'use client';

import WelcomeBanner from '../layout/WelcomeBanner';
import TodayOverview from './TodayOverview';
import InstitutionalExcellence from '../cards/InstitutionalExcellence';
import SystemHealthCard from '../cards/SystemHealthCard';
import OperationsCenter from './OperationsCenter';
import DecisionCenter from './DecisionCenter';
import AlertCenter from './AlertCenter';
import ExecutiveAdvisor from './ExecutiveAdvisor';
import PerformanceTrends from './PerformanceTrends';
import DailyTimeline from './DailyTimeline';
import ProgramsNeedingAttention from './ProgramsNeedingAttention';
import DashboardHome from './DashboardHome';

type Program = {
  id: string;
  name_ar: string;
  name_en?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  start_date?: string | null;
  end_date?: string | null;
};

type Props = {
  profile: {
    full_name: string;
    role: string;
  };
  programs: Program[];
  stats: {
    daily: number;
    final: number;
    avg: number;
  };
  onRefresh?: () => void;
};

export default function CommandCenter({
  profile,
  programs,
  stats,
  onRefresh,
}: Props) {
  return (
    <main
      style={{
        direction: 'rtl',
        background: '#f4f7fb',
        minHeight: '100vh',
        padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* الهوية والترحيب */}
        <WelcomeBanner />

        {/* ملخص المستخدم الحالي */}
        <section
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: '18px 22px',
            boxShadow: '0 8px 24px rgba(15,23,42,.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                color: '#64748b',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              المستخدم الحالي / Current User
            </div>

            <div
              style={{
                color: '#14466B',
                fontWeight: 900,
                fontSize: 20,
              }}
            >
              {profile.full_name || 'مدير المنصة'}
            </div>

            <div
              style={{
                color: '#0f766e',
                fontSize: 13,
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              {profile.role || 'PLATFORM_ADMIN'}
            </div>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            style={{
              border: 0,
              borderRadius: 12,
              background: '#0f766e',
              color: '#fff',
              padding: '12px 18px',
              cursor: 'pointer',
              fontWeight: 900,
              fontFamily: 'inherit',
            }}
          >
            🔄 تحديث مركز القيادة
          </button>
        </section>

        {/* اليوم في البوابة */}
        <TodayOverview />

        {/* مؤشر التميز */}
        <InstitutionalExcellence />

        {/* نبض المنصة */}
        <SystemHealthCard
          status="healthy"
          items={[
            'خدمات المنصة تعمل بصورة طبيعية',
            'التقييم اليومي والنهائي متاحان للمشاركين',
            'البرامج مرتبطة بقوالب التقييم المفعلة',
            'لا توجد أخطاء حرجة ظاهرة حاليًا',
          ]}
        />

        {/* مؤشرات التشغيل الحالية */}
        <DashboardHome programs={programs} stats={stats} />

        {/* مركز العمليات */}
        <OperationsCenter />

        {/* منطقة القرار والتنبيهات */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <DecisionCenter />
          <AlertCenter />
        </div>

        {/* المستشار التنفيذي */}
        <ExecutiveAdvisor />

        {/* الاتجاهات والبرامج التي تحتاج متابعة */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <PerformanceTrends />
          <ProgramsNeedingAttention />
        </div>

        {/* النشاط اليومي */}
        <DailyTimeline />
      </div>
    </main>
  );
}
