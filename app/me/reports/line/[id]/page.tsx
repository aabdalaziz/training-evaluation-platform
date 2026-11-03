'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/reports/line/[id] — «صفحتي في التقرير الختامي» (P46 ر2 «خاتمة الرحلة»): مسار المتدرّب مهارةً مهارة · فقرة المسار · سطر المعلّم · «أظهِر في شهادتي» */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../../components/PortalShell';
import { fastToken } from '../../../../components/Pocket';
import { supabase } from '../../../../../lib/supabase/client';
import { MyFinalLine } from '../../../../components/FinalReport';

export default function MyLinePage({ params }: { params: { id: string } }) { return <PortalShell><Inner id={params.id} /></PortalShell>; }
function Inner({ id }: { id: string }) {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  if (tok === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (!tok) return <main className="pt-main"><section className="pt-box"><h1>صفحتي في التقرير الختامي</h1><p>سجّل الدخول لفتح صفحتك.</p><Link href={`/login?next=${encodeURIComponent('/me/reports/line/' + id)}`} className="pt-btn">تسجيل الدخول</Link></section></main>;
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; };
  return <MyFinalLine id={id} token={token} />;
}
