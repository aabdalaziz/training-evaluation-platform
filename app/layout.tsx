import type { Metadata, Viewport } from 'next';
import { Tajawal } from 'next/font/google';
import './style.css';
import GlobalNavigation from './components/GlobalNavigation';

// خط عربي موحّد يُحمَّل مع البناء (بدون طلبات خارجية وقت التشغيل ولا وميض عند التحميل)
const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700', '800', '900'], display: 'swap', variable: '--font-ar' });

export const metadata: Metadata = {
  title: 'منصة تقويم البرامج التدريبية',
  description: 'Training Evaluation Platform',
};

export const viewport: Viewport = { themeColor: '#0f2a4e', width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className={tajawal.className}>
        <GlobalNavigation />
        {children}
      </body>
    </html>
  );
}
