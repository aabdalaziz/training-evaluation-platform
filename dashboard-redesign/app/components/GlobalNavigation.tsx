'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

const I = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z',
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  logout: 'M10 17l5-5-5-5M15 12H3M21 3v18',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  building: 'M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2',
};
const Ic = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export default function GlobalNavigation() {
  const db = supabase();
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session));
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The dashboard ships its own full application chrome (sidebar + header).
  if (pathname?.startsWith('/dashboard')) return null;

  async function logout() { await db.auth.signOut(); router.push('/'); router.refresh(); }

  return (
    <nav className="global-nav" aria-label="التنقل العام">
      <Link href="/" className="global-brand"><Ic d={I.building} size={18} /> <span>منصة التقويم</span></Link>
      <div className="global-actions">
        {pathname !== '/' && <Link href="/" className="global-btn"><Ic d={I.home} /> الرئيسية</Link>}
        {loggedIn ? <>
          <Link href="/dashboard" className="global-btn"><Ic d={I.dashboard} /> لوحة التحكم</Link>
          <button type="button" className="global-btn danger" onClick={logout}><Ic d={I.logout} /> خروج</button>
        </> : pathname !== '/login' ? <Link href="/login" className="global-btn"><Ic d={I.login} /> دخول الإدارة</Link> : null}
      </div>
    </nav>
  );
}
