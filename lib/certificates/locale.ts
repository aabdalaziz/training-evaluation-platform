// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P91: «ملفّ الشهادة» بحسب البرنامج — لمجموعة فرنسا (قرار المالك 27/11):
 *  لغة ثانية فرنسيّة · اسم البرنامج بلا «مجموعة فرنسا (أ. عمرو سنبل)» · بلا شعبة ولا «بإشراف المدرّب» · «متمنين لها» ·
 *  التوقيعان: يمين د/ أحمد عبدالعزيز — المدير الأكاديمي · يسار د/ عبدالله العتيبي — المدير العام.
 *  غير ذلك: إنجليزيّة من programs.name_en وبقيّة الحقول كما تُدخل في الصفحة.
 */
import { FRANCE } from '../cohorts/france';
export type CertLang2 = 'en' | 'fr';
export type CertSign = { name: string; title: string; title_fr?: string | null };
export type CertProfile = {
  lang2: CertLang2; program_en: string | null; program_ar?: string | null;
  hide_classroom?: boolean; hide_trainer?: boolean; wish_to?: string | null; sign1?: CertSign | null; sign2?: CertSign | null;
};
export function certProfile(programId: string | null | undefined, nameEn?: string | null): CertProfile {
  if (programId && programId === FRANCE.programId) {
    const c = FRANCE.certificate;
    return { lang2: 'fr', program_en: c.programNameFr, program_ar: c.programNameAr, hide_classroom: true, hide_trainer: true, wish_to: c.wishTo, sign1: c.sign1, sign2: c.sign2 };
  }
  return { lang2: 'en', program_en: nameEn || null };
}
/** للتوافق: ما كان يُسمّى certLocale */
export const certLocale = (programId: string | null | undefined, nameEn?: string | null) => { const p = certProfile(programId, nameEn); return { lang2: p.lang2, program_en: p.program_en }; };
/** ما يُحفظ في meta مع الشهادة (ليُعاد الرسم بالملفّ نفسه دائمًا) */
export function profileMeta(p: CertProfile): Record<string, unknown> { return { lang2: p.lang2, program_en: p.program_en, wish_to: p.wish_to || null, sign1: p.sign1 || null, sign2: p.sign2 || null }; }
