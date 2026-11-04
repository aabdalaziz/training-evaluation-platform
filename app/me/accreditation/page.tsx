'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/accreditation?program=<pid> — «ملف الاعتماد الحيّ» (P48 · الاسم الرسمي: ملف الدراسة الذاتية للاعتماد البرامجي)
 *  يراه مدرّبو البرنامج والطاقم: ما ثبت · ما ينقص · فقرات موقَّعة · شروط التأهّل · خريطة الكفايات إلى معايير المعلّم.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';

const AccredFile = dynamic(() => import('../../components/Accreditation').then(m => m.AccredFile), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function AccreditationPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null); const [pid, setPid] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); const q = new URLSearchParams(window.location.search).get('program'); setPid(q && /^[0-9a-z-]{1,40}$/i.test(q) ? q : ''); }, [db]);
  if (tok === null || pid === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (!tok) return <main className="pt-main"><section className="pt-box"><h1>ملف الاعتماد الحيّ</h1><p>ملف الدراسة الذاتية ينمو من أدلة أَثَر المعتمَدة — سجّل الدخول.</p><Link href={`/login?next=${encodeURIComponent('/me/accreditation' + (pid ? `?program=${pid}` : ''))}`} className="pt-btn gold">تسجيل الدخول</Link></section></main>;
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; };
  return <AccredFile token={token} programId={pid || null} />;
}
