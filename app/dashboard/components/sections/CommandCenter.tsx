'use client';

import KPIGrid from './KPIGrid';
import WelcomeBanner from '../layout/WelcomeBanner';
import ExecutiveStatusBar from '../layout/ExecutiveStatusBar';

import OrganizationPulse from './OrganizationPulse';
import ExecutiveTasks from './ExecutiveTasks';
import TodayOverview from './TodayOverview';
import OperationsCenter from './OperationsCenter';
import AlertCenter from './AlertCenter';
import ExecutiveAdvisor from './ExecutiveAdvisor';
import PerformanceTrends from './PerformanceTrends';
import DailyTimeline from './DailyTimeline';

import InstitutionalExcellence from '../cards/InstitutionalExcellence';

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

        <OrganizationPulse />

        <ExecutiveTasks />
        <KPIGrid />

        <InstitutionalExcellence />

        <TodayOverview />

        <OperationsCenter />

        <AlertCenter />

        <ExecutiveAdvisor />

        <PerformanceTrends />

        <DailyTimeline />
      </div>
    </main>
  );
}
