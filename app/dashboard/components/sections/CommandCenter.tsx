'use client';

import WelcomeBanner from '../layout/WelcomeBanner';
import ExecutiveStatusBar from '../layout/ExecutiveStatusBar';
import TodaysMission from './TodaysMission';
import TodayOverview from './TodayOverview';
import InstitutionalExcellence from '../cards/InstitutionalExcellence';
import SystemHealthCard from '../cards/SystemHealthCard';
import OperationsCenter from './OperationsCenter';
import DecisionCenter from './DecisionCenter';
import AlertCenter from './AlertCenter';
import ExecutiveAdvisor from './ExecutiveAdvisor';
import PerformanceTrends from './PerformanceTrends';
import ProgramsNeedingAttention from './ProgramsNeedingAttention';
import DailyTimeline from './DailyTimeline';

export default function CommandCenter() {
  return (
    <main
      style={{
        background: '#F4F7FB',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <WelcomeBanner />

        <ExecutiveStatusBar />

        <TodaysMission />

        <InstitutionalExcellence />

        <TodayOverview />

        <SystemHealthCard
          status="healthy"
          items={[
            'جميع الخدمات تعمل بصورة طبيعية',
            'لا توجد أخطاء في إرسال التقييمات',
            'جميع البرامج مرتبطة بقوالب التقييم',
            'آخر نسخة احتياطية تمت بنجاح',
          ]}
        />

        <OperationsCenter />

        <DecisionCenter />

        <AlertCenter />

        <ExecutiveAdvisor />

        <PerformanceTrends />

        <ProgramsNeedingAttention />

        <DailyTimeline />
      </div>
    </main>
  );
}
