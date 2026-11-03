'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/reports — «تقاريري» (P46 «محور التقارير» · الاسم الرسمي: توثيق الجودة والأداء)
 *  ر1: تقرير التعلّم الأسبوعي — أرقامه من أَثَر، وحكمه من المعلّم، واعتماده من مدير البرنامج.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { ReportsHome } from '../../components/Reports';

export default function ReportsPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  if (tok === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (!tok) return <main className="pt-main"><section className="pt-box"><h1>تقاريري</h1><p>تقرير التعلّم الأسبوعي يُعبَّأ من أرقام أَثَر وتكتب أنت حكمه — سجّل الدخول.</p><Link href={`/login?next=${encodeURIComponent('/me/reports')}`} className="pt-btn" data-testid="rp-login">تسجيل الدخول</Link></section></main>;
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; };
  return <ReportsHome token={token} />;
}
