// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P67 ★4 «الرمز يتكلّم»: كُنى من قائمة مغلقة (لا نصّ حرّ — فلا يتسرّب اسم) — نقي، يُستورد من المتصفح والخادم */
export const EPITHETS: { id: string; ar: string; en: string }[] = [
  { id: 'first_step', ar: 'صاحب الخطوة الأولى', en: 'The first step' }, { id: 'early_bird', ar: 'سابق الفجر', en: 'Early bird' }, { id: 'quiet_force', ar: 'القوّة الهادئة', en: 'Quiet force' },
  { id: 'listener', ar: 'المُنصت الجيّد', en: 'The listener' }, { id: 'steady', ar: 'ثابت الخطى', en: 'Steady walker' }, { id: 'curious', ar: 'كثير السؤال', en: 'The curious one' },
  { id: 'field', ar: 'ابن الميدان', en: 'Of the field' }, { id: 'patient', ar: 'طويل النَّفَس', en: 'Long breath' }, { id: 'sharp', ar: 'حادّ الملاحظة', en: 'Sharp eye' },
  { id: 'builder', ar: 'البنّاء', en: 'The builder' }, { id: 'guide', ar: 'الدليل', en: 'The guide' }, { id: 'sea', ar: 'موج هادئ', en: 'Calm wave' },
];
export const epithetById = (id: string) => EPITHETS.find(e => e.id === id) || null;

