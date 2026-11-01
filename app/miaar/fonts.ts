// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** خطّا مِعيار كما في الشاشات الأصلية: Tajawal للنصوص وAref Ruqaa للنصوص العربية النموذجية — عبر next/font (مستضافان ذاتيًا؛ لا طلب خارجي من المتصفح). */
import { Aref_Ruqaa, Tajawal } from 'next/font/google';

export const tajawal = Tajawal({ subsets: ['arabic', 'latin'], weight: ['400', '500', '700', '800', '900'], variable: '--mi-font', display: 'swap' });
export const arefRuqaa = Aref_Ruqaa({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--mi-ruqaa', display: 'swap' });
export const miaarFontClass = `${tajawal.variable} ${arefRuqaa.variable}`;
