import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Noto_Naskh_Arabic } from 'next/font/google';
import './style.css';
import './athar-identity.css'; /* هوية v1.2 «غروب الحجاز»: الرموز · قوس اليوم · الحركة · الخلفية · الستار */
import GlobalNavigation from './components/GlobalNavigation';
import { PocketProvider } from './components/Pocket';
import Guide from './components/Guide';
import { normalizeSite } from '../lib/portal/open'; /* النطاق الرسمي للـ JSON-LD */ /* «دليل أَثَر» (P41): البحث والأوامر في كل صفحة — Ctrl+K */

// «خطّ أَثَر» (2026-11-17): خطّان مستضافان ذاتيًّا مع البناء (بلا طلبات خارجية ولا وميض):
//  --font-ar   IBM Plex Sans Arabic — خطّ الواجهة (من الهوية): نقاط أوضح وعين أعرض من الخطّ السابق، ولاتينية بالجودة نفسها (رموز CEFR · البريد · الأرقام)
//  --font-read Noto Naskh Arabic — خطّ القراءة التعليمية: نسخ الكتب المدرسية لما يقرؤه المتعلّم (نصوص الحلقات · البطاقات · المِران · بنود البنك · مقاطع الاختبارات)
//  خِفّة أَثَر (P40) محفوظة: 3 أوزان للواجهة + وزنان للقراءة (حروف عربية + لاتينية أساسية فقط)
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700'], display: 'swap', variable: '--font-ar' });
const naskh = Noto_Naskh_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '700'], display: 'swap', variable: '--font-read', preload: true });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.com'), /* النطاق الرسمي (2026-11-15): روابط OpenGraph مطلقة */
  title: { default: 'أَثَر — بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ', template: '%s | أَثَر' }, /* SEO (2026-11-15): الاسم المتداول «بوابة الأثر» يظهر حرفيًا في العنوان */
  description: 'أَثَر: حلول متكاملة في التعليم والتدريب والتطوير — تعليم العربية للناطقين بغيرها، برامج ودبلومات، استشارات، حقائب تدريبية، بث متزامن، وقياس أثر حقيقي. Athar · TRACE (Training · Resources · Arabic · Consulting · Evaluation) — Portal for Education, Training, Development & Quality.',
  keywords: ['أثر', 'بوابة الأثر', 'بوابة أثر', 'منصة أثر', 'Athar', 'Athar Portal', 'athar-portal', 'TRACE', 'تعليم العربية للناطقين بغيرها', 'برامج تدريبية', 'دبلومات', 'استشارات', 'قياس الأثر', 'تقويم البرامج التدريبية', 'اختبار تحديد المستوى'],
  applicationName: 'أَثَر',
  openGraph: { title: 'أَثَر — بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ', description: 'نتعلّم، نتدرّب، نتطوّر… ونقيس الأثر', type: 'website', locale: 'ar_SA', siteName: 'أَثَر' },
  robots: { index: true, follow: true },
  // تطبيق ويب تقدّمي («أَثَر في الجيب» · P19): محفظة سيادية بلا اتصال، صندوق أدلة ميداني، share_target، إشعار «موقف اليوم»
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'أَثَر', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
};

/** بيانات منظّمة (schema.org) — تُعرّف محرّكات البحث بأن «بوابة الأثر» و«Athar Portal» أسماء بديلة للبوّابة نفسها (SEO 2026-11-15) */
export const SITE_NAME = 'أَثَر';
export const SITE_ALT_NAMES = ['بوابة الأثر', 'بوابة أثر', 'منصة أثر', 'أثر — بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ', 'Athar Portal', 'Athar', 'athar-portal'];
export function siteJsonLd(site: string) {
  const org = {
    '@type': 'Organization', '@id': `${site}/#org`, name: SITE_NAME, alternateName: SITE_ALT_NAMES, url: site, logo: `${site}/icons/icon-512.png`,
    email: 'info@athar-portal.com', description: 'بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ — تعليم العربية للناطقين بغيرها، برامج ودبلومات، استشارات، وقياس أثر حقيقي',
    areaServed: 'SA', knowsLanguage: ['ar', 'en'], foundingDate: '2026',
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'info@athar-portal.com', availableLanguage: ['ar', 'en'], url: `${site}/contact` }],
  };
  const web = { '@type': 'WebSite', '@id': `${site}/#website`, name: SITE_NAME, alternateName: SITE_ALT_NAMES, url: site, inLanguage: 'ar', publisher: { '@id': `${site}/#org` } };
  return { '@context': 'https://schema.org', '@graph': [org, web] };
}

export const viewport: Viewport = { themeColor: '#3A1F36', width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${naskh.variable}`}>
      <body className={plex.className}>
        {/* JSON-LD يُولَّد على الخادم من نصّ ثابت (لا مدخلات مستخدم) — آمن ضمن CSP لأن script data لا تُنفَّذ */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(normalizeSite(process.env.NEXT_PUBLIC_SITE_URL))) }} />
        <PocketProvider>
          <GlobalNavigation />
          {children}
          <Guide />
        </PocketProvider>
      </body>
    </html>
  );
}
