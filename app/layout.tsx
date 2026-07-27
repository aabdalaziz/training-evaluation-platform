import type { Metadata } from 'next';
import './style.css';
import GlobalNavigation from './components/GlobalNavigation';

export const metadata: Metadata = {
  title: 'منصة تقويم البرامج التدريبية',
  description: 'Training Evaluation Platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <GlobalNavigation />
        {children}
      </body>
    </html>
  );
}
