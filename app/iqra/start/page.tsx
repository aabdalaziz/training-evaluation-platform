// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /iqra/start — «باب اقْرَأْ» (هـ-1/3): مستواك من مِعيار ← تجربة ٧ أيام أو خطّة ← ادخل. */
import type { Metadata } from 'next';
import IqraStart from './IqraStart';
import { miaarFontClass } from '../../miaar/fonts';

export const metadata: Metadata = { title: 'باب اقْرَأْ — ابدأ على مستواك · أَثَر', description: 'جرّب اقْرَأْ سبعة أيام مجّانًا بعد تحديد مستواك في مِعيار، أو اختر خطّة شهر أو ثلاثة أشهر أو سنة.', robots: { index: true, follow: true } };
export const revalidate = 3600;

export default function Page() { return <IqraStart fontClass={miaarFontClass} />; }
