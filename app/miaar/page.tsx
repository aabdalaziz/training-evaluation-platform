// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar — «مِعيار — من أَثَر»: اختبار تحديد المستوى في العربية (CEFR A1–C2) · 30 لغة واجهة · مِسبار البداية · بطاقة المستوى */
import type { Metadata } from 'next';
import MiaarApp from './MiaarApp';

export const metadata: Metadata = {
  title: 'مِعيار — حدّد مستواك في العربية',
  description: 'مِعيار — من أَثَر: اختبار تحديد المستوى في اللغة العربية للناطقين بغيرها وفق الإطار الأوروبي المرجعي (A1–C2). قراءة · استماع · قواعد ومفردات. بطاقة مستوى فورية.',
  alternates: { canonical: '/miaar' },
  openGraph: { title: 'مِعيار — من أَثَر', description: 'حدّد مستواك في العربية في أقل من ساعة — بطاقة مستوى وفق CEFR.', type: 'website' },
};
export const dynamic = 'force-dynamic';

export default function Page() { return <MiaarApp />; }
