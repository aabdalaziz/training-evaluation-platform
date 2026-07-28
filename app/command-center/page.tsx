'use client';

import DashboardHeader from '../dashboard/components/layout/DashboardHeader';
import TodayOverview from '../dashboard/components/sections/TodayOverview';
import InstitutionalExcellence from '../dashboard/components/cards/InstitutionalExcellence';
import SystemHealthCard from '../dashboard/components/cards/SystemHealthCard';
import OperationsCenter from '../dashboard/components/sections/OperationsCenter';
import AlertCenter from '../dashboard/components/sections/AlertCenter';
import ExecutiveAdvisor from '../dashboard/components/sections/ExecutiveAdvisor';
import PerformanceTrends from '../dashboard/components/sections/PerformanceTrends';
import DailyTimeline from '../dashboard/components/sections/DailyTimeline';
import DecisionCenter from '../dashboard/components/sections/DecisionCenter';

export default function CommandCenterPage() {
  return (
    <main
      style={{
        background: '#f4f7fb',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <DashboardHeader
        userName="د. أحمد عبدالعزيز"
        role="PLATFORM ADMIN"
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 1500,
          margin: '0 auto',
        }}
      >
        <TodayOverview />

        <InstitutionalExcellence />

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

        <DailyTimeline />
      </div>
    </main>
  );
}
