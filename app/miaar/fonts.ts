// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** خطّا مِعيار: Tajawal من قشرة أَثَر نفسها (--font-ar من app/layout.tsx — لا تحميل ثانٍ)، وAref Ruqaa للنصوص العربية النموذجية
 *  بوزن واحد وحروف عربية فقط (خِفّة أَثَر P40: ملف خط واحد بدل أربعة). مستضافان ذاتيًا عبر next/font. */
import { Aref_Ruqaa } from 'next/font/google';

export const arefRuqaa = Aref_Ruqaa({ subsets: ['arabic'], weight: ['400'], variable: '--mi-ruqaa', display: 'swap', preload: true });
export const miaarFontClass = arefRuqaa.variable;
