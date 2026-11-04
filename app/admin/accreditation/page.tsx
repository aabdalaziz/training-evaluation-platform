'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/accreditation — «ملفات الاعتماد» للطاقم (P48 · الاسم الرسمي: ملف الدراسة الذاتية للاعتماد البرامجي)
 *  كل البرامج المنتهية بمؤهل مع تغطيتها · أضعف معيار عبر البرامج · سجلّ المعايير القابل للتحديث بلا نشر كود
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { P48_NAMES_AR } from '../../../lib/accreditation/registry';

const AccredAdmin = dynamic(() => import('../../components/Accreditation').then(m => m.AccredAdmin), { ssr: false, loading: () => <p className="am-muted">…</p> });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
export default function AdminAccreditationPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []); const [tok, setTok] = useState<string | null>(null);
  useEffect(() => { (async () => {
    const { data: { session } } = await db.auth.getSession(); if (!session) { router.replace('/login?next=/admin/accreditation'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', session.user.id).maybeSingle(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/me'); return; }
    setTok(session.access_token);
  })(); }, [db, router]);
  const token = async () => { const { data } = await db.auth.getSession(); return data.session?.access_token || tok || ''; };
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="award" size={14} /> بوابة أَثَر · P48</span><h1>{P48_NAMES_AR.file} — {P48_NAMES_AR.official}</h1><p>{P48_NAMES_AR.motto}. الملف يجمع أدلته من كل ما اعتُمد في أَثَر ويضعها تحت معاييرها الفرعية ({P48_NAMES_AR.pas} — {P48_NAMES_AR.body_ar})؛ المصمّم يكتب الفقرات ويوقّعها، والطاقم يرى الصورة الكاملة ويحدّث نصوص المعايير من هنا.</p></div>
          <nav className="am-links" aria-label="روابط"><Link href="/admin/reports" className="am-link"><Icon name="arrow" size={14} /> محور التقارير</Link><Link href="/dashboard" className="am-link"><Icon name="home" size={14} /> لوحة التحكّم</Link></nav></header>
        <PortalAdminTabs />
        {tok === null ? <p className="am-muted">…</p> : <AccredAdmin token={token} />}
      </div>
    </div>
  );
}
const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}.am-muted{color:#64748b}
.am-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am-links{display:flex;gap:8px;flex-wrap:wrap}.am-link{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:800;color:#0f2a4e;text-decoration:none;background:#fff}.am-link:hover{border-color:#0f2a4e}
.am .pt-main{padding:0}.am .pt-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;margin-bottom:12px}.am .pt-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}.am .pt-muted{color:#64748b}
.am .pt-btn{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:8px 14px;font-weight:800;font-size:13px;border:1px solid transparent;cursor:pointer;text-decoration:none;font-family:inherit}.am .pt-btn.gold{background:#c9a24b;color:#0f2a4e}.am .pt-btn.navy{background:#0f2a4e;color:#fff}.am .pt-btn.ghost{background:#fff;border-color:#cbd5e1;color:#0f2a4e}.am .pt-btn.small{padding:6px 10px;font-size:12px}.am .pt-btn:disabled{opacity:.5;cursor:not-allowed}
.am h2{font-size:18px;color:#0f2a4e;margin:0 0 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
`;
