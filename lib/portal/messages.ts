// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — كتالوج رسائل الإبلاغ (P16): لكل نوع رسالة اسم قالب واتساب ثابت + نصه العربي كما يُقدَّم لاعتماد Meta + طريقة بناء متغيراته.
 *  القاعدة: ما لا قالب له يذهب إلى «athar_notice» العام. أسماء القوالب ثابتة — تُنشأ مرة في حساب WhatsApp Business ثم لا تتغير.
 */
export type WaTemplate = { name: string; label_ar: string; category: 'UTILITY'; body_ar: string; vars: string[] };

export const WA_TEMPLATES: WaTemplate[] = [
  { name: 'athar_notice', label_ar: 'إشعار عام', category: 'UTILITY', vars: ['الاسم', 'الموضوع', 'الرابط'],
    body_ar: 'مرحبًا {{1}}، لديك إشعار من أَثَر: {{2}}. التفاصيل: {{3}}' },
  { name: 'athar_mission_assigned', label_ar: 'إسناد مهمة', category: 'UTILITY', vars: ['الاسم', 'عنوان المهمة', 'المهلة', 'الرابط'],
    body_ar: 'مرحبًا {{1}}، أُسندت إليك مهمة من أَثَر: «{{2}}». المهلة: {{3}}. افتح المهمة وارفع دليلك من هنا: {{4}}' },
  { name: 'athar_mission_reminder', label_ar: 'تذكير بمهمة', category: 'UTILITY', vars: ['الاسم', 'عنوان المهمة', 'المتبقي', 'الرابط'],
    body_ar: 'تذكير من أَثَر يا {{1}}: مهمة «{{2}}» تنتهي خلال {{3}}. خمس دقائق تكفي: {{4}}' },
  { name: 'athar_confirm_request', label_ar: 'طلب تأكيد مشرف', category: 'UTILITY', vars: ['اسم المشرف', 'اسم المتعلم', 'عنوان المهمة', 'الرابط'],
    body_ar: 'مرحبًا {{1}}، يطلب أَثَر تأكيدك لدليل قدّمه {{2}} في مهمة «{{3}}». يستغرق دقيقة: {{4}}' },
  { name: 'athar_live_reminder', label_ar: 'تذكير بجلسة مباشرة', category: 'UTILITY', vars: ['الاسم', 'عنوان الجلسة', 'الموعد', 'الرابط'],
    body_ar: 'مرحبًا {{1}}، جلستك المباشرة في أَثَر «{{2}}» تبدأ {{3}}. رابط الدخول: {{4}}' },
  { name: 'athar_certificate', label_ar: 'شهادة صادرة', category: 'UTILITY', vars: ['الاسم', 'اسم الشهادة/البرنامج', 'الرابط'],
    body_ar: 'تهانينا {{1}}، صدرت شهادتك من أَثَر: {{2}}. يمكنك عرضها والتحقق منها هنا: {{3}}' },
  { name: 'athar_contract_release', label_ar: 'عقد أثر — دفعة/تحديث', category: 'UTILITY', vars: ['الاسم', 'الموضوع', 'الرابط'],
    body_ar: 'مرحبًا {{1}}، تحديث من أَثَر في عقد الأثر الخاص بجهتكم: {{2}}. التفاصيل: {{3}}' },
];
const BY_NAME = new Map(WA_TEMPLATES.map(t => [t.name, t]));

/** نوع الرسالة (tag kind القائم في المرسِلين) → قالب واتساب */
export function templateFor(kind: string): WaTemplate {
  const k = String(kind || '').toLowerCase();
  const name =
    k === 'mission_assigned' || k === 'mission' ? 'athar_mission_assigned' :
    k === 'mission_reminder' ? 'athar_mission_reminder' :
    k === 'mission_confirm' ? 'athar_confirm_request' :
    k.startsWith('live_remind') || k === 'live_now' || k === 'copilot_remind' ? 'athar_live_reminder' :
    k.startsWith('certificate') || k === 'credential_issued' ? 'athar_certificate' :
    k.startsWith('contract') ? 'athar_contract_release' : 'athar_notice';
  return BY_NAME.get(name)!;
}

/** بناء متغيرات القالب من بيانات الرسالة (الاسم، الموضوع، الرابط + أي معلمات خاصة) */
export function waParams(kind: string, d: Record<string, string>): string[] {
  const t = templateFor(kind); const name = (d.name || '').trim() || 'بك'; const url = d.url || ''; const subject = (d.subject || '').replace(/^أَثَر\s*\|\s*/, '').trim();
  switch (t.name) {
    case 'athar_mission_assigned': return [name, d.title || subject, d.due || 'حسب المهمة', url];
    case 'athar_mission_reminder': return [name, d.title || subject, d.left || 'أيام قليلة', url];
    case 'athar_confirm_request': return [name, d.learner || 'متعلم', d.title || subject, url];
    case 'athar_live_reminder': return [name, d.title || subject, d.when || 'قريبًا', url];
    case 'athar_certificate': return [name, d.title || subject, url];
    case 'athar_contract_release': return [name, subject, url];
    default: return [name, subject, url];
  }
}

export const KIND_LABEL_AR: Record<string, string> = {
  security_alert: 'تنبيه أمني (درع أَثَر)', security_user_alert: 'تنبيه أمني لحسابك',
  mission_assigned: 'إسناد مهمة', mission: 'مهمة', mission_reminder: 'تذكير بمهمة', mission_confirm: 'طلب تأكيد مشرف', mission_result: 'نتيجة مهمة',
  contract: 'عقد أثر', live_reminder: 'تذكير جلسة', live_registered: 'تسجيل جلسة', live_now: 'الجلسة بدأت', credential_pulse: 'نبض الشهادة الحية', credential_watch: 'متابعة شهادة',
  certificate_issued: 'شهادة صادرة', certificate: 'شهادة', enrollment_ack: 'استلام طلب تسجيل', enrollment_accepted: 'قبول تسجيل', enrollment_rejected: 'اعتذار تسجيل', enrollment_waitlisted: 'قائمة انتظار',
  invoice: 'فاتورة', receipt: 'إيصال', consult_received: 'استلام طلب استشارة', consult_new: 'طلب استشارة جديد', consult_quote: 'عرض سعر', consult_response: 'ردّ على عرض', consult_status: 'حالة استشارة', consult_update: 'تحديث استشارة',
  agent_request: 'طلب وكيل', org_invite: 'دعوة جهة', org_admin: 'تعيين مدير جهة', org_bulk: 'طلب تسجيل جماعي', notice: 'إشعار', test: 'إرسال تجريبي',
  behavior_followup: 'متابعة أثر التدريب', final_open: 'فتح التقييم الختامي', copilot_remind: 'تذكير الميسِّر', live_reminder_auto: 'تذكير جلسة (تلقائي)', credential_issued: 'شهادة رقمية صادرة', digest: 'موجز التقارير', observatory_weather: 'تغيّر مؤشر أداء القطاع (المرصد)', report: 'تقرير', notifications: 'تنبيهات المنصة', receipt_review: 'إيصال للمراجعة', enrollment_new: 'طلب تسجيل جديد',
  dsr_received: 'طلب بيانات (الخزنة)', dsr_due: 'مهلة طلب بيانات', erasure_confirm: 'تأكيد النسيان', erasure_receipt: 'إيصال النسيان', incident_due: 'حادثة بيانات', correction_received: 'استلام طلب تصحيح',
};
export const kindLabel = (k: string) => KIND_LABEL_AR[k] || k;
