'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sbLazy, hasStoredSession } from '../../lib/supabase/lazy';
import { Icon, type IconName } from '../../lib/ui/icons';
import dynamic from 'next/dynamic';
/* خِفّة أَثَر (P40): جرس الإشعارات يستورد مكتبة Supabase ثابتًا — يُحمَّل فقط حين يُعرض (شريط الإدارة) لا في كل صفحة عامة */
const NotificationBell = dynamic(() => import('./NotificationBell'), { ssr: false });
import { SkipLink } from './Inclusion';
import { GuideButton } from './Guide';
import { AtharMark, DoorBadge } from './Brand';
import { BRAND } from '../../lib/portal/content';
/* P43-أ «أَثَر الواحد»: هذا الشريط هو «مركز قيادة أَثَر» — غرفة إدارية داخل البيت الواحد، لا منتجًا منفصلًا اسمه «منصة التقويم».
   الردهة (/hub?stay=1) ⇄ مركز القيادة بزرّ واحد، وشارة «بابي» نفسها التي في غلاف البوابة. */
const HALL = '/hub?stay=1';

/** عناصر التنقل الإداري الموحّد — نفس الترتيب في لوحة التحكم وفي كل الصفحات الإدارية */
// صفحات بوابة أَثَر العامة (PortalShell) — لها رأسها الخاص
const PORTAL_PREFIXES = ['/about', '/contact', '/services', '/programs', '/consulting', '/resources', '/live', '/sim', '/me', '/org', '/ai', '/credential', '/p', '/pay', '/accessibility', '/miaar', '/login', '/join', '/hub', '/forgot-password', '/reset-password'];
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
  const router = useRouter();
  const pathname = usePathname() || '/';
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    /* خِفّة أَثَر: لا تحميل لمكتبة Supabase للزائر بلا جلسة مخزَّنة */
    if (!hasStoredSession()) { setLoggedIn(false); return; }
    let unsub: (() => void) | null = null; let alive = true;
    void sbLazy().then((db) => { if (!alive) return; db.auth.getSession().then(({ data }) => setLoggedIn(!!data.session)); const { data: listener } = db.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session)); unsub = () => listener.subscription.unsubscribe(); });
    return () => { alive = false; unsub?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  // لوحة التحكم تملك قائمتها الجانبية الكاملة، وصفحات بوابة أَثَر العامة تملك رأسها الخاص (PortalShell)
  if (pathname.startsWith('/dashboard')) return null;
  if (pathname === '/' || PORTAL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) return null;

  async function logout() { const db = await sbLazy(); await db.auth.signOut(); router.push('/'); router.refresh(); }

  const adminArea = loggedIn && (pathname.startsWith('/admin') || pathname.startsWith('/reports') || pathname.startsWith('/command-center') || pathname.startsWith('/final-analysis'));

  /* ===== شريط إداري موحّد ===== */
  if (adminArea) {
    return (
      <nav className="global-nav admin" aria-label="التنقل الإداري" data-testid="command-bar"><SkipLink lang="ar" />
        <Link href="/dashboard" className="global-brand athar" data-testid="command-brand"><AtharMark size={26} /> <span>{BRAND.command.ar}</span></Link>
        <button type="button" className="global-burger" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(o => !o)}>☰</button>
        <div className={`global-links ${open ? 'open' : ''}`}>
          {ADMIN_NAV.map(n => (
            <Link key={n.href} href={n.href} className={`global-link ${n.match(pathname) ? 'on' : ''}`} aria-current={n.match(pathname) ? 'page' : undefined}>
              <Icon name={n.icon} size={16} /> {n.label}
            </Link>
          ))}
          <Link href={HALL} className="global-btn hall" data-testid="command-hall" title="الردهة — كل أبوابك في أَثَر"><Icon name="compass" size={16} /> الردهة</Link>
          <DoorBadge lang="ar" />
          <GuideButton compact />
          <NotificationBell />
          <button type="button" className="global-btn danger" onClick={logout}><Icon name="logout" size={16} /> خروج</button>
        </div>
      </nav>
    );
  }

  /* ===== شريط عام (الصفحات العامة) ===== */
  return (
    <nav className="global-nav" aria-label="التنقل العام"><SkipLink lang="ar" />
      <Link href="/" className="global-brand athar" data-testid="public-brand"><AtharMark size={26} /> <span>{BRAND.name.ar}</span></Link>
      <div className="global-actions">
        <GuideButton />
        {pathname !== '/' && <Link href="/" className="global-btn"><Icon name="home" size={16} /> الرئيسية</Link>}
        {loggedIn ? <>
          <Link href={HALL} className="global-btn"><Icon name="compass" size={16} /> أبوابي</Link>
          <button type="button" className="global-btn danger" onClick={logout}><Icon name="logout" size={16} /> خروج</button>
        </> : pathname !== '/login' ? <Link href="/login" className="global-btn" data-testid="public-login"><Icon name="login" size={16} /> دخول</Link> : null}
      </div>
    </nav>
  );
}
