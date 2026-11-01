'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /hub/<باب> — باب الصفة (P42-أ: الهيكل · P42-ب: المحتوى الحيّ لكل باب)
 *  كل باب: اسم واضح + «أول ثلاث خطوات» + روابط الأدوات التي تخصّ هذه الصفة فقط — لا قائمة الإدارة الكاملة.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';

type Door = { title_ar: string; title_en: string; roles: string[]; lead: string; links: { href: string; label: string; hint: string }[] };
const DOORS: Record<string, Door> = {
  leadership: { title_ar: 'باب القيادة', title_en: 'Leadership', roles: ['LEADERSHIP'], lead: 'نظرة الأثر لا التفاصيل: أين نقف اليوم؟ وما الذي يحتاج قرارًا بشريًا؟', links: [
    { href: '/admin/impact', label: 'أثر البرامج', hint: 'ما الذي تغيّر فعلًا' }, { href: '/admin/observatory', label: 'مرصد القدرة البشرية', hint: 'القطاعات والفجوات' }, { href: '/admin/sector-impact', label: 'الأثر القطاعي', hint: 'بالقطاع والجهة' }, { href: '/admin/health', label: 'صحة المنصة', hint: 'إشارات تحتاج قرارًا' }, { href: '/admin/councils', label: 'مجالس أَثَر', hint: 'الدورة الحالية' }] },
  programs: { title_ar: 'باب البرامج', title_en: 'Programs', roles: ['EXEC_PROGRAMS', 'EXEC_ARABIC'], lead: 'من التصميم إلى الشهادة: هندسة البرنامج، التسجيل، الحضور، التقييم.', links: [
    { href: '/admin/program-engineering', label: 'هندسة البرامج التدريبية', hint: 'تصميم ومراجعة' }, { href: '/admin/enrollments', label: 'التسجيل والقبول', hint: 'الطلبات والشُّعب' }, { href: '/admin/attendance', label: 'الحضور', hint: 'بالجلسة' }, { href: '/admin/live', label: 'الجلسات الحيّة', hint: 'Teams · Zoom · Meet' }, { href: '/admin/certificates', label: 'الشهادات', hint: 'إصدار وتحقق' }, { href: '/admin/miaar', label: 'مِعيار', hint: 'تحديد المستوى' }] },
  diplomas: { title_ar: 'باب الدبلومات', title_en: 'Diplomas', roles: ['EXEC_DIPLOMAS'], lead: 'المسارات الطويلة: الدفعات، التقدّم، الشهادة التي تكبر.', links: [
    { href: '/admin/program-engineering', label: 'هندسة البرامج', hint: 'مسارات الدبلوم' }, { href: '/admin/enrollments', label: 'الدفعات والقبول', hint: 'بالدبلوم' }, { href: '/admin/outcomes', label: 'المخرجات', hint: 'نواتج التعلّم' }, { href: '/admin/credentials', label: 'الاعتمادات', hint: 'الشهادة التي تكبر' }] },
  quality: { title_ar: 'باب الجودة', title_en: 'Quality', roles: ['QUALITY_MANAGER'], lead: 'الأدلة قبل الانطباعات: التقييمات، حلقة التحسين، قاعدة الأدلة.', links: [
    { href: '/admin/survey-settings', label: 'الاستبانات', hint: 'النماذج والمواعيد' }, { href: '/admin/evidence', label: 'قاعدة الأدلة', hint: 'ما يثبت الأثر' }, { href: '/admin/loop', label: 'التحسين المستمر', hint: 'اقتراحات بالأدلة' }, { href: '/admin/readiness', label: 'الجاهزية', hint: 'قبل الانطلاق' }, { href: '/admin/audit', label: 'سجل التدقيق', hint: 'من فعل ماذا' }] },
  operations: { title_ar: 'باب العمليات', title_en: 'Operations', roles: ['ADMIN_SUPERVISOR'], lead: 'اليوم التشغيلي: الوارد، التنبيهات، المهام، الإبلاغ.', links: [
    { href: '/admin/inbox', label: 'الوارد', hint: 'ما وصل اليوم' }, { href: '/admin/missions', label: 'المهام', hint: 'مَن يتابع ماذا' }, { href: '/admin/notifications', label: 'التنبيهات', hint: 'الإرسال والقنوات' }, { href: '/admin/outreach', label: 'الإبلاغ متعدد القنوات', hint: 'بريد · واتساب' }, { href: '/admin/followup', label: 'المتابعة', hint: 'بعد البرنامج' }] },
  finance: { title_ar: 'باب المالية', title_en: 'Finance', roles: ['FINANCE_MANAGER'], lead: 'المدفوعات والعقود والتحصيل — بلا الوصول إلى ما لا يخصّ المالية.', links: [
    { href: '/admin/payments', label: 'المدفوعات', hint: 'الحالة والتحصيل' }, { href: '/admin/contracts', label: 'العقود', hint: 'عقود التعاون' }, { href: '/admin/consulting', label: 'الاستشارات', hint: 'الطلبات والعروض' }] },
  expert: { title_ar: 'باب الخبراء', title_en: 'Experts & consultants', roles: ['CONSULTANT', 'EXPERT'], lead: 'سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر — ومهامك عقدٌ على كل مهمة.', links: [
    { href: '/experts', label: 'هيئة أَثَر — الخبراء', hint: 'ملفك العام' }, { href: '/me', label: 'مساحتي', hint: 'سيرتك ومهامك' }, { href: '/admin/consulting', label: 'الاستشارات', hint: 'المهام المسندة' }] },
  trainer: { title_ar: 'باب المدرّبين', title_en: 'Trainers', roles: ['TRAINER'], lead: 'برامجك، جلساتك الحيّة، حضور متدرّبيك، وما قاله المتدرّبون عن الأثر.', links: [
    { href: '/trainers', label: 'هيئة أَثَر — المدرّبون', hint: 'ملفك العام' }, { href: '/admin/live', label: 'جلساتي الحيّة', hint: 'الغرف والروابط' }, { href: '/admin/attendance', label: 'الحضور', hint: 'جلساتك' }, { href: '/me', label: 'مساحتي', hint: 'سيرتك وشهاداتك' }] },
};

export default function HubDoorPage({ params }: { params: { role: string } }) {
  const router = useRouter(); const door = DOORS[params.role]; const [allowed, setAllowed] = useState<boolean | null>(null); const [mine, setMine] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession(); const tk = data.session?.access_token; if (!tk) { router.replace(`/login?next=/hub/${params.role}`); return; }
      const j = await fetch('/api/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null);
      const roles: string[] = j?.roles || []; setMine(roles); setAllowed(!!door && (roles.includes('ADMIN') || door.roles.some(r => roles.includes(r))));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.role]);
  if (!door) return <main className="hd" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="hd-wrap"><p className="hd-err">لا يوجد باب بهذا الاسم. <Link href="/hub">أبوابي</Link></p></div></main>;
  return (
    <main className="hd" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hd-wrap">
        <header className="hd-head"><Link href="/hub" className="hd-back"><Icon name="arrow" size={14} /> أبوابي</Link><h1>{door.title_ar} <small>{door.title_en}</small></h1><p>{door.lead}</p></header>
        {allowed === null && <p className="hd-muted">جارٍ التحقق من صفتك…</p>}
        {allowed === false && <p className="hd-err" data-testid="door-denied">هذا الباب لصفة أخرى ({door.roles.join(' · ')}). صفاتك الحالية: {mine.length ? mine.join(' · ') : 'مشارك'}. <Link href="/hub">عد إلى أبوابك</Link></p>}
        {allowed && (
          <div className="hd-grid" data-testid="door-links">
            {door.links.map(l => <Link key={l.href} href={l.href} className="hd-card"><b>{l.label}</b><span>{l.hint}</span></Link>)}
          </div>
        )}
        <p className="hd-note">في P42-ب يصبح كل باب حيًّا: أرقام اليوم، وما ينتظر قرارك، و«أول ثلاث خطوات» لمن دخل أول مرة.</p>
      </div>
    </main>
  );
}
const CSS = `
.hd{min-height:70vh;padding:28px 14px;background:#f6f8fb}.hd-wrap{max-width:980px;margin:0 auto}
.hd-back{display:inline-flex;gap:4px;align-items:center;color:#0b8a83;text-decoration:none;font-weight:800;font-size:13px}.hd-head h1{margin:8px 0 4px;color:#0f2a4e;font-size:28px}.hd-head small{color:#94a3b8;font-size:14px;font-weight:600;margin-inline-start:8px;direction:ltr}.hd-head p{margin:0 0 18px;color:#475569;line-height:1.8}
.hd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.hd-card{display:grid;gap:4px;text-decoration:none;background:#fff;border:1px solid #e5e9f0;border-right:4px solid #c9a24b;border-radius:14px;padding:14px;color:#0f2a4e}.hd-card span{color:#64748b;font-size:13px}.hd-card:hover,.hd-card:focus-visible{box-shadow:0 12px 26px -20px rgba(15,42,78,.6);outline:none}.hd-card:focus-visible{outline:3px solid #0b8a83}
.hd-muted{color:#64748b}.hd-err{color:#991b1b;background:#fef2f2;border-radius:10px;padding:10px 12px;line-height:1.8}.hd-err a{color:#0b8a83}.hd-note{margin-top:22px;color:#94a3b8;font-size:12px}
`;
