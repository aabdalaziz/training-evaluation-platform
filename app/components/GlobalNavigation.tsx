'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

export default function GlobalNavigation() {
  const db = supabase();
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function logout() {
    await db.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="global-nav" aria-label="التنقل العام">
      <Link href="/" className="global-brand">🏛️ <span>منصة التقويم</span></Link>
      <div className="global-actions">
        {pathname !== '/' && <Link href="/" className="global-btn">⌂ الرئيسية</Link>}
        {loggedIn ? <>
          {pathname !== '/dashboard' && <Link href="/dashboard" className="global-btn">📊 لوحة التحكم</Link>}
          <button type="button" className="global-btn danger" onClick={logout}>🚪 خروج</button>
        </> : pathname !== '/login' ? <Link href="/login" className="global-btn">🔐 دخول الإدارة</Link> : null}
      </div>
    </nav>
  );
}
