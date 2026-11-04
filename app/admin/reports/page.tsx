'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/reports — «محور التقارير» للطاقم (P46 · الاسم الرسمي: توثيق الجودة والأداء)
 *  التقارير المُرسَلة بانتظار الاعتماد · اعتماد (رمز تحقّق + إرسال «سطر لك» بإذن المعلّم) · إعادة بملاحظة · المعتمَدة والمُعادة
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { AdminReports } from '../../components/Reports';
import { P46_NAMES_AR } from '../../../lib/reports/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
export default function AdminReportsPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null); const [pending, setPending] = useState(0);
  useEffect(() => { (async () => {
    const { data: { session } } = await db.auth.getSession(); if (!session) { router.replace('/login?next=/admin/reports'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', session.user.id).maybeSingle(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/me'); return; }
    setTok(session.access_token);
    try { const r = await fetch('/api/reports?admin=1', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' }); const j = await r.json(); setPending((j.items || []).filter((x: any) => x.status === 'submitted').length); } catch { /* تجاهل */ }
  })(); }, [db, router]);
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok || ''; };
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="doc" size={14} /> بوابة أَثَر · P46</span><h1>{P46_NAMES_AR.axis} — {P46_NAMES_AR.official}</h1><p>المعلّم لا يكتب الأرقام؛ أَثَر يلتقطها (المسجَّلون · المنتظمون · الجلسات والساعات · الحضور). المعلّم يكتب الحكم والتوصية، وأنت تعتمد أو تُعيد بملاحظة. عند الاعتماد يصدر رمز تحقّق ويصل كل متدرّب «{P46_NAMES_AR.line}» إن أذن المعلّم.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/reports': pending }} />
        <p className="am-xlink"><Link href="/admin/accreditation" data-testid="am-accred-link"><Icon name="award" size={14} /> ملفات الاعتماد الحيّة (P48) — ما ثبت وما ينقص لكل برنامج منتهٍ بمؤهل ←</Link></p>
        {tok === null ? <p className="am-muted">…</p> : <AdminReports token={token} />}
      </div>
    </div>
  );
}
const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-xlink{margin:0}.am-xlink a{display:inline-flex;gap:6px;align-items:center;font-size:13px;font-weight:800;color:#0f2a4e;background:#fffaf0;border:1px solid #c9a24b;border-radius:999px;padding:6px 12px;text-decoration:none}.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}.am-muted{color:#64748b}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am .pt-main{padding:0}.am .pt-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-bottom:12px}.am .pt-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}.am .pt-muted{color:#64748b}
`;
