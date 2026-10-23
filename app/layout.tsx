import type { Metadata, Viewport } from 'next';
import { Tajawal } from 'next/font/google';
import './style.css';
import GlobalNavigation from './components/GlobalNavigation';

// خط عربي موحّد يُحمَّل مع البناء (بدون طلبات خارجية وقت التشغيل ولا وميض عند التحميل)
const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700', '800', '900'], display: 'swap', variable: '--font-ar' });

export const metadata: Metadata = {
  title: { default: 'أَثَر — بوابة التعليم والتدريب والتطوير', template: '%s | أَثَر' },
  description: 'أَثَر: حلول متكاملة في التعليم والتدريب والتطوير — تعليم العربية للناطقين بغيرها، برامج ودبلومات، استشارات، حقائب تدريبية، بث متزامن، وقياس أثر حقيقي. Athar · TRACE (Training · Resources · Arabic · Consulting · Evaluation) — Education, Training & Development Portal.',
  keywords: ['أثر', 'Athar', 'TRACE', 'تعليم العربية للناطقين بغيرها', 'برامج تدريبية', 'دبلومات', 'استشارات', 'قياس الأثر', 'تقويم البرامج التدريبية', 'اختبار تحديد المستوى'],
  applicationName: 'أَثَر',
  openGraph: { title: 'أَثَر — بوابة التعليم والتدريب والتطوير', description: 'نتعلّم، نتدرّب، نتطوّر… ونقيس الأثر', type: 'website', locale: 'ar_SA', siteName: 'أَثَر' },
  robots: { index: true, follow: true },
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
