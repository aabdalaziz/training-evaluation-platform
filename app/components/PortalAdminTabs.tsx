'use client';

// شريط تنقّل موحّد لصفحات إدارة بوابة أَثَر
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/enrollments', label: 'طلبات التسجيل', icon: 'users' },
  { href: '/admin/payments', label: 'المدفوعات', icon: 'shield' },
  { href: '/admin/consulting', label: 'الاستشارات', icon: 'compass' },
  { href: '/admin/live', label: 'البث المباشر', icon: 'play' },
  { href: '/admin/resources', label: 'الحقائب', icon: 'folder' },
  { href: '/admin/skills', label: 'المهارات والجهات', icon: 'target' },
  { href: '/admin/placements', label: 'مِعيار', icon: 'scale' },
  { href: '/admin/credentials', label: 'الشهادات الرقمية', icon: 'award' },
  { href: '/admin/sector-impact', label: 'تقارير الأثر', icon: 'chart' },
  { href: '/admin/catalog', label: 'نشر البرامج', icon: 'globe' },
  { href: '/admin/inbox', label: 'رسائل التواصل', icon: 'inbox' },
  { href: '/admin/sim', label: 'المحاكيات وأثير', icon: 'play' },
  { href: '/admin/twin', label: 'توأم المؤسسة', icon: 'star' },
  { href: '/admin/missions', label: 'مهمات العمل', icon: 'flag' },
  { href: '/admin/contracts', label: 'عقود الأثر', icon: 'scale' },
  { href: '/admin/program-engineering', label: 'هندسة البرامج التدريبية', icon: 'compass' },
  { href: '/admin/media', label: 'الأداء المُشاهَد', icon: 'play' },
  { href: '/admin/evidence', label: 'قاعدة الأدلة', icon: 'compass' },
  { href: '/admin/agents', label: 'الوكلاء المفوَّضون', icon: 'users' },
  { href: '/admin/loop', label: 'التحسين المستمر بالأدلة', icon: 'refresh' },
  { href: '/admin/outreach', label: 'الإبلاغ متعدد القنوات', icon: 'send' },
  { href: '/admin/observatory', label: 'مرصد القدرة البشرية', icon: 'globe' },
  { href: '/admin/shield', label: 'درع أَثَر', icon: 'shield' },
];

export default function PortalAdminTabs({ counts }: { counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname() || '';
  return (
    <nav className="pat" aria-label="portal admin">
      <style>{`.pat{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-family:var(--font-ar),Tajawal,Arial,sans-serif}.pat a{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:900;color:#334155;text-decoration:none}.pat a.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}.pat a i{font-style:normal;background:#0b8a83;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px}.pat a.on i{background:#c9a24b;color:#1f2937}.pat .pat-site{margin-inline-start:auto}`}</style>
      {TABS.map(x => <Link key={x.href} href={x.href} className={pathname.startsWith(x.href) ? 'on' : ''}><Icon name={x.icon} size={14} /> {x.label}{counts?.[x.href] ? <i>{counts[x.href]}</i> : null}</Link>)}
      <Link href="/" target="_blank" className="pat-site"><Icon name="link" size={14} /> فتح البوابة</Link>
      <Link href="/dashboard"><Icon name="dashboard" size={14} /> لوحة القيادة</Link>
    </nav>
  );
}
