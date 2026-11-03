'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/rehearsal — «بروفاتي» (P45 «بروفة» · الاسم الرسمي: التمرين التبادلي بين الممارسين)
 *  اطلب بروفة لموقف (الآن أو بموعد · الدائرة) · طلبات تنتظر من يلعب الدور (بلا أسماء) · بروفاتي · الجملتان · «كيف مرّ؟»
 *  ?need=<id> من حاجة معلَنة · ?case=<id> من «كل يوم مهارة» · ?program=<id>&text=<اسم البرنامج> قبل المحطة · ?r=<id> إبراز
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { RehearsalBoard } from '../../components/Rehearsal';

export default function RehearsalPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  if (tok === null) return <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (!tok) return <main className="pt-main"><section className="pt-box"><h1>بروفاتي</h1><p>قبل أن يقع الموقف الصعب، جرّبه مع إنسان — سجّل الدخول لتطلب بروفة أو تلعب دورًا.</p><Link href={`/login?next=${encodeURIComponent('/me/rehearsal' + (typeof window !== 'undefined' ? window.location.search : ''))}`} className="pt-btn" data-testid="reh-login">دخول</Link></section></main>;
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok; };
  return <RehearsalBoard token={token} />;
}
