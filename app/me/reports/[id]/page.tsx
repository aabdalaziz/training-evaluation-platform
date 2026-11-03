'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/reports/[id] — محرّر تقرير التعلّم الأسبوعي (P46 ر1): 8 أقسام + «سطر لكل متدرّب» + معاينة الطباعة */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../components/PortalShell';
import { fastToken } from '../../../components/Pocket';
import { supabase } from '../../../../lib/supabase/client';
import { ReportEditor } from '../../../components/Reports';

export default function ReportPage({ params }: { params: { id: string } }) { return <PortalShell><Inner id={params.id} /></PortalShell>; }
function Inner({ id }: { id: string }) {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  if (tok === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (!tok) return <main className="pt-main"><section className="pt-box"><h1>تقرير التعلّم الأسبوعي</h1><p>سجّل الدخول لفتح التقرير.</p><Link href={`/login?next=${encodeURIComponent('/me/reports/' + id)}`} className="pt-btn">تسجيل الدخول</Link></section></main>;
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; };
  return <ReportEditor id={id} token={token} mode="author" />;
}
