// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /iqra — «اقْرَأْ — من أَثَر» (ق1): مستوى المتعلّم — تعلّم ذاتي غير متزامن على سُلّم CEFR. يفتح بحساب أَثَر أو برمز نتيجة مِعيار (?code=ML-…). */
import type { Metadata } from 'next';
import IqraApp from './IqraApp';
import { miaarFontClass } from '../miaar/fonts';

export const metadata: Metadata = { title: 'اقْرَأْ — من أَثَر · تعلّم العربية على مستواك', description: 'حلقات قصيرة على مستواك من الإطار الأوروبي المرجعي، تراجعها وتتقدّم فيها بوقتك — بعد نتيجة مِعيار.', robots: { index: true, follow: true } };
/* م17-ب: غلاف ثابت يُخدَم من حافّة Vercel القريبة من المستخدم (≈60 مللي ثانية بدل رحلة إلى سيدني) — كلّ المحتوى الحيّ يأتي من API داخل المكوّن */
export const revalidate = 3600;

export default function Page() { return <IqraApp fontClass={miaarFontClass} />; }
