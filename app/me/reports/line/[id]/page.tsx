'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/reports/line/[id] — «صفحتي في التقرير الختامي» (P46 ر2 «خاتمة الرحلة») · «كشف كفاياتي» كاملًا (P46 ر4-ب): مسار المتدرّب مهارةً مهارة · فقرة المسار · سطر المعلّم · «أظهِر في شهادتي» */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../../../components/PortalShell';
import { fastToken } from '../../../../components/Pocket';
import { supabase } from '../../../../../lib/supabase/client';
import { MyFinalLine } from '../../../../components/FinalReport';
import { MyProfileLine } from '../../../../components/DiplomaProfile';   // P46 ر4-ب «كشف كفاياتي»

export default function MyLinePage({ params }: { params: { id: string } }) { return <PortalShell><Inner id={params.id} /></PortalShell>; }
function Inner({ id }: { id: string }) {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  if (tok === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (!tok) return <main className="pt-main"><section className="pt-box"><h1>صفحتي في التقرير الختامي</h1><p>سجّل الدخول لفتح صفحتك.</p><Link href={`/login?next=${encodeURIComponent('/me/reports/line/' + id)}`} className="pt-btn">تسجيل الدخول</Link></section></main>;
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; };
  return <LineSwitch id={id} token={token} />;
}
/** يقرأ نوع السطر ثم يختار الصفحة: ختامي (ر2) أو كشف كفايات (ر4-ب) */
function LineSwitch({ id, token }: { id: string; token: () => Promise<string> }) {
  const [kind, setKind] = useState<string | null>(null);
  useEffect(() => { (async () => { try { const tk = await token(); const j = await fetch(`/api/reports?line=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); setKind(j?.success ? String(j.line?.kind || 'final') : 'final'); } catch { setKind('final'); } })(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (kind === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  return kind === 'diploma_profile' ? <MyProfileLine id={id} token={token} /> : <MyFinalLine id={id} token={token} />;
}
