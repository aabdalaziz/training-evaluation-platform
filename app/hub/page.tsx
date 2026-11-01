'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /hub — «أبوابي» (P42-أ): بعد الدخول يُفتح بابك
 *  صفة واحدة → تحويل مباشر إلى وجهتها · عدة صفات → بطاقات الأبواب · لا صفة → /me (كل داخل هو مشارك على الأقل)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';

type R = { code: string; name_ar: string; name_en: string; landing: string; scope: string };
export default function HubPage() {
  const router = useRouter(); const [roles, setRoles] = useState<R[] | null>(null); const [email, setEmail] = useState(''); const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      const db = supabase(); const { data } = await db.auth.getSession(); const tk = data.session?.access_token; if (!tk) { router.replace('/login?next=/hub'); return; }
      const j = await fetch('/api/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null);
      if (!j?.success) { setErr(j?.error || 'تعذّر قراءة صفاتك'); return; }
      setEmail(j.email || ''); const cat: R[] = j.catalog || [];
      if (j.landing && j.landing !== '/hub') { router.replace(j.landing); return; }   // باب واحد (أو مدير النظام) → مباشرة
      setRoles(cat);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="hb" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hb-wrap">
        <header className="hb-head"><span className="hb-kicker"><Icon name="compass" size={14} /> بوابة أَثَر</span><h1>أبوابك</h1><p>{email ? <>داخل باسم <code dir="ltr">{email}</code> — </> : null}لك أكثر من صفة؛ اختر الباب الذي تريد الدخول منه الآن.</p></header>
        {err && <p className="hb-err">{err}</p>}
        {!roles && !err && <p className="hb-muted">جارٍ فتح أبوابك…</p>}
        {roles && (
          <div className="hb-grid" data-testid="hub-grid">
            {roles.map(r => (
              <Link key={r.code} href={r.landing} className="hb-card" data-testid={`hub-door-${r.code}`}>
                <span className="hb-scope">{r.scope === 'platform' ? 'المنصة' : r.scope === 'org' ? 'الجهة' : 'شخصي'}</span>
                <b>{r.name_ar}</b><span className="hb-en">{r.name_en}</span>
                <span className="hb-go">ادخل <Icon name="arrow" size={14} /></span>
              </Link>
            ))}
            <Link href="/me" className="hb-card hb-me" data-testid="hub-door-ME"><span className="hb-scope">شخصي</span><b>مساحتي</b><span className="hb-en">My space</span><span className="hb-go">ادخل <Icon name="arrow" size={14} /></span></Link>
          </div>
        )}
      </div>
    </main>
  );
}
const CSS = `
.hb{min-height:70vh;padding:28px 14px;background:#f6f8fb}.hb-wrap{max-width:980px;margin:0 auto}
.hb-kicker{display:inline-flex;gap:6px;align-items:center;color:#0b8a83;font-weight:800;font-size:13px}.hb-head h1{margin:6px 0 4px;color:#0f2a4e;font-size:28px}.hb-head p{margin:0 0 18px;color:#475569}.hb-head code{background:#eef2f7;padding:1px 6px;border-radius:6px}
.hb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.hb-card{display:grid;gap:4px;text-decoration:none;background:#fff;border:1px solid #e5e9f0;border-top:4px solid #c9a24b;border-radius:16px;padding:16px;color:#0f2a4e;min-height:120px;transition:transform .15s,box-shadow .15s}.hb-card:hover,.hb-card:focus-visible{transform:translateY(-2px);box-shadow:0 14px 30px -20px rgba(15,42,78,.5);outline:none}.hb-card:focus-visible{outline:3px solid #0b8a83}
.hb-card b{font-size:18px}.hb-en{color:#64748b;font-size:12px;direction:ltr;text-align:right}.hb-scope{font-size:11px;color:#0b8a83;font-weight:800}.hb-go{margin-top:auto;display:inline-flex;gap:4px;align-items:center;color:#0b8a83;font-weight:800;font-size:13px}
.hb-me{border-top-color:#0b8a83}.hb-muted{color:#64748b}.hb-err{color:#991b1b;background:#fef2f2;border-radius:10px;padding:10px 12px}
@media (prefers-reduced-motion:reduce){.hb-card{transition:none}}
`;
