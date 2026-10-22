'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon, type IconName } from '../../lib/ui/icons';

/** عناصر التنقل الإداري الموحّد — نفس الترتيب في لوحة التحكم وفي كل الصفحات الإدارية */
const ADMIN_NAV: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/dashboard', label: 'لوحة القيادة', icon: 'dashboard', match: p => p.startsWith('/dashboard') },
  { href: '/command-center', label: 'غرفة القيادة', icon: 'play', match: p => p.startsWith('/command-center') },
  { href: '/admin/management', label: 'مركز الإدارة', icon: 'admin', match: p => p.startsWith('/admin/management') || p.startsWith('/admin/survey-settings') },
  { href: '/admin/attendance', label: 'الحضور', icon: 'check', match: p => p.startsWith('/admin/attendance') },
  { href: '/admin/followup', label: 'نقل الأثر', icon: 'trend', match: p => p.startsWith('/admin/followup') || p.startsWith('/reports/transfer') },
  { href: '/reports/center', label: 'مركز التقارير', icon: 'reports', match: p => p.startsWith('/reports/center') },
  { href: '/reports', label: 'اللوحة التحليلية', icon: 'chart', match: p => p === '/reports' || p.startsWith('/reports/executive') },
  { href: '/reports/remote-survey', label: 'استطلاع عن بُعد', icon: 'laptop', match: p => p.startsWith('/reports/remote-survey') },
  { href: '/admin/data-lifecycle', label: 'دورة حياة البيانات', icon: 'trash', match: p => p.startsWith('/admin/data-lifecycle') },
];

export default function GlobalNavigation() {
  const db = supabase();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session));
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  // لوحة التحكم تملك قائمتها الجانبية الكاملة
  if (pathname.startsWith('/dashboard')) return null;

  async function logout() { await db.auth.signOut(); router.push('/'); router.refresh(); }

  const adminArea = loggedIn && (pathname.startsWith('/admin') || pathname.startsWith('/reports') || pathname.startsWith('/command-center') || pathname.startsWith('/final-analysis'));

  /* ===== شريط إداري موحّد ===== */
  if (adminArea) {
    return (
      <nav className="global-nav admin" aria-label="التنقل الإداري">
        <Link href="/dashboard" className="global-brand"><Icon name="shield" size={18} /> <span>منصة التقويم</span></Link>
        <button type="button" className="global-burger" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(o => !o)}>☰</button>
        <div className={`global-links ${open ? 'open' : ''}`}>
          {ADMIN_NAV.map(n => (
            <Link key={n.href} href={n.href} className={`global-link ${n.match(pathname) ? 'on' : ''}`} aria-current={n.match(pathname) ? 'page' : undefined}>
              <Icon name={n.icon} size={16} /> {n.label}
            </Link>
          ))}
          <button type="button" className="global-btn danger" onClick={logout}><Icon name="logout" size={16} /> خروج</button>
        </div>
      </nav>
    );
  }

  /* ===== شريط عام (الصفحات العامة) ===== */
  return (
    <nav className="global-nav" aria-label="التنقل العام">
      <Link href="/" className="global-brand"><Icon name="shield" size={18} /> <span>منصة التقويم</span></Link>
      <div className="global-actions">
        {pathname !== '/' && <Link href="/" className="global-btn"><Icon name="home" size={16} /> الرئيسية</Link>}
        {loggedIn ? <>
          <Link href="/dashboard" className="global-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <button type="button" className="global-btn danger" onClick={logout}><Icon name="logout" size={16} /> خروج</button>
        </> : pathname !== '/login' ? <Link href="/login" className="global-btn"><Icon name="login" size={16} /> دخول الإدارة</Link> : null}
      </div>
    </nav>
  );
}
