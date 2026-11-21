// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar — «مِعيار — من أَثَر»: اختبار تحديد المستوى في العربية (CEFR A1–C2) · 30 لغة واجهة · مِسبار البداية · بطاقة المستوى */
import type { Metadata } from 'next';
import MiaarApp from './MiaarApp';
import { miaarFontClass } from './fonts';

export const metadata: Metadata = {
  title: 'مِعيار — حدّد مستواك في العربية',
  description: 'مِعيار — من أَثَر: اختبار تحديد المستوى في اللغة العربية للناطقين بغيرها وفق الإطار الأوروبي المرجعي (A1–C2). قراءة · استماع · قواعد ومفردات. بطاقة مستوى فورية.',
  alternates: { canonical: '/miaar' },
  openGraph: { title: 'مِعيار — من أَثَر', description: 'حدّد مستواك في العربية في أقل من ساعة — بطاقة مستوى وفق CEFR.', type: 'website' },
};
/* م17-ب: غلاف ثابت يُخدَم من حافّة Vercel القريبة من المستخدم (≈60 مللي ثانية بدل رحلة إلى سيدني) — كلّ المحتوى الحيّ يأتي من API داخل المكوّن */
export const revalidate = 3600;

export default function Page() { return <MiaarApp fontClass={miaarFontClass} />; }
