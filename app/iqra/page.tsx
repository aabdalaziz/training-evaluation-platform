// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /iqra — «اقْرَأْ — من أَثَر» (ق1): مستوى المتعلّم — تعلّم ذاتي غير متزامن على سُلّم CEFR. يفتح بحساب أَثَر أو برمز نتيجة مِعيار (?code=ML-…). */
import type { Metadata } from 'next';
import IqraApp from './IqraApp';
import { miaarFontClass } from '../miaar/fonts';

export const metadata: Metadata = { title: 'اقْرَأْ — من أَثَر · تعلّم العربية على مستواك', description: 'حلقات قصيرة على مستواك من الإطار الأوروبي المرجعي، تراجعها وتتقدّم فيها بوقتك — بعد نتيجة مِعيار.', robots: { index: true, follow: true } };
export const dynamic = 'force-dynamic';

export default function Page() { return <IqraApp fontClass={miaarFontClass} />; }
