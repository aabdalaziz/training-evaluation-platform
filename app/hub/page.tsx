'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /hub — «الردهة» (P42-أ «أبوابي» → P43-أ «أَثَر الواحد»): بعد الدخول يُفتح بابك
 *  صفة واحدة → تحويل مباشر إلى وجهتها · عدة صفات → بطاقات الأبواب · لا صفة → /me (كل داخل هو مشارك على الأقل)
 *  P43-أ: «الباب يعرفك» — قبل التحويل ثانية واحدة تُظهر الغُرَف التي فُتحت لك (تحترم prefers-reduced-motion، ومرة واحدة في الجلسة، وزر «ادخل الآن»)
 *         ?stay=1 (من زر «الردهة» في مركز القيادة) أو تفضيل «اجعل الردهة نقطة بدايتي» → تبقى البطاقات بلا تحويل
 *         بطاقة «مركز قيادة أَثَر» للمدير تحمل «ينتظر قرارك: N» من /api/hub?door=operations
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell } from '../components/PortalShell';

type R = { code: string; name_ar: string; name_en: string; landing: string; scope: string };
const START_KEY = 'athar_start';            /* 'hub' = الردهة نقطة البداية (تفضيل محلي على هذا الجهاز) */
const WELCOME_KEY = 'athar_door_welcomed';  /* مرة واحدة في الجلسة */
const WELCOME_MS = 1400;
const COMMAND_CODES = ['ADMIN', 'ADMIN_SUPERVISOR'];
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const doorLabel = (r: R) => (r.code === 'ADMIN' ? 'مركز قيادة أَثَر' : r.name_ar);

export default function HubPage() {
  const router = useRouter(); const [roles, setRoles] = useState<R[] | null>(null); const [email, setEmail] = useState(''); const [err, setErr] = useState('');
  const [welcome, setWelcome] = useState<{ names: string[]; to: string; toLabel: string } | null>(null);
  const [startHub, setStartHub] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      const db = supabase(); const { data } = await db.auth.getSession(); const tk = data.session?.access_token; if (!tk) { router.replace('/login?next=/hub'); return; }
      const sp = new URLSearchParams(window.location.search); const stay = sp.get('stay') === '1';
      let pref = false; try { pref = localStorage.getItem(START_KEY) === 'hub'; } catch { /* ignore */ } setStartHub(pref);
      const j = await fetch('/api/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null);
      if (!j?.success) { setErr(j?.error || 'تعذّر قراءة أدوارك'); return; }
      setEmail(j.email || ''); const cat: R[] = j.catalog || [];
      setRoles(cat);
      if (cat.some(r => COMMAND_CODES.includes(r.code))) {
        fetch('/api/hub?door=operations', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).then(h => { if (h?.success) setPending((h.decisions || []).reduce((a: number, d: any) => a + (Number(d.count) || 0), 0)); }).catch(() => null);
      }
      if (j.landing && j.landing !== '/hub' && !stay && !pref) {   // باب واحد (أو مدير النظام) → مباشرة
        let seen = false; try { seen = sessionStorage.getItem(WELCOME_KEY) === '1'; sessionStorage.setItem(WELCOME_KEY, '1'); } catch { /* ignore */ }
        if (seen || reduced()) { router.replace(j.landing); return; }
        const main = cat.find(r => r.landing === j.landing); setWelcome({ names: cat.map(doorLabel), to: j.landing, toLabel: main ? doorLabel(main) : 'مساحتك' });
        setTimeout(() => router.replace(j.landing), WELCOME_MS);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function togglePref(v: boolean) { setStartHub(v); try { if (v) localStorage.setItem(START_KEY, 'hub'); else localStorage.removeItem(START_KEY); } catch { /* ignore */ } }
  if (welcome) {
    return (
      <main className="hw" dir="rtl" id="main" data-testid="door-welcome" aria-live="polite"><style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="hw-card">
          <span className="hw-rings" aria-hidden="true"><i /><i /><i /></span>
          <p className="hw-kicker">مرحبًا بك في أَثَر</p>
          <h1>صفحاتك: {welcome.names.join(' · ') || 'مساحتك'}</h1>
          <p className="hw-sub">ننتقل الآن إلى {welcome.toLabel}…</p>
          <Link href={welcome.to} className="hw-go" data-testid="door-welcome-go">ادخل الآن <Icon name="arrow" size={14} /></Link>
        </div>
      </main>
    );
  }
  return (
    <PortalShell><main className="hb" dir="rtl" id="main"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hb-wrap">
        <header className="hb-head"><span className="hb-kicker"><Icon name="compass" size={14} /> صفحاتي · بوّابة أَثَر</span><h1>صفحاتك</h1><p>{email ? <>داخل باسم <code dir="ltr">{email}</code> — </> : null}لك أكثر من دور؛ اختر الصفحة التي تريد الدخول إليها الآن.</p></header>
        {err && <p className="hb-err">{err}</p>}
        {!roles && !err && <p className="hb-muted">جارٍ تحميل صفحاتك…</p>}
        {roles && (
          <div className="hb-grid" data-testid="hub-grid">
            {roles.map(r => (
              <Link key={r.code} href={r.landing} className={`hb-card ${r.code === 'ADMIN' ? 'hb-command' : ''}`} data-testid={`hub-door-${r.code}`}>
                <span className="hb-scope">{r.scope === 'platform' ? 'البوّابة' : r.scope === 'org' ? 'الجهة' : 'شخصي'}</span>
                <b>{doorLabel(r)}</b><span className="hb-en">{r.code === 'ADMIN' ? 'Athar Command Center' : r.name_en}</span>
                {COMMAND_CODES.includes(r.code) && pending !== null && <span className="hb-pending" data-testid="hub-pending">ينتظر قرارك: <b>{pending}</b></span>}
                <span className="hb-go">ادخل <Icon name="arrow" size={14} /></span>
              </Link>
            ))}
            <Link href="/me" className="hb-card hb-me" data-testid="hub-door-ME"><span className="hb-scope">شخصي</span><b>مساحتي</b><span className="hb-en">My space</span><span className="hb-go">ادخل <Icon name="arrow" size={14} /></span></Link>
          </div>
        )}
        {roles && (
          <label className="hb-pref" data-testid="hub-start-toggle">
            <input type="checkbox" checked={startHub} onChange={e => togglePref(e.target.checked)} />
            <span>اجعل «صفحاتي» نقطة بدايتي بعد الدخول <small>(على هذا الجهاز — بدل التحويل المباشر إلى صفحة دوري)</small></span>
          </label>
        )}
      </div>
    </main></PortalShell>
  );
}
const CSS = `
.hb{min-height:70vh;padding:28px 14px;background:#FBF4EE}.hb-wrap{max-width:980px;margin:0 auto}
.hb-kicker{display:inline-flex;gap:6px;align-items:center;color:#D4614A;font-weight:800;font-size:13px}.hb-head h1{margin:6px 0 4px;color:#3A1F36;font-size:28px}.hb-head p{margin:0 0 18px;color:#5C4858}.hb-head code{background:#F3E6DC;padding:1px 6px;border-radius:6px}
.hb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.hb-card{display:grid;gap:4px;text-decoration:none;background:#fff;border:1px solid #EADFD6;border-top:4px solid #D9A866;border-radius:16px;padding:16px;color:#3A1F36;min-height:120px;transition:transform .15s,box-shadow .15s}.hb-card:hover,.hb-card:focus-visible{transform:translateY(-2px);box-shadow:0 14px 30px -20px rgba(42,22,38,.5);outline:none}.hb-card:focus-visible{outline:3px solid #D4614A}
.hb-card b{font-size:18px}.hb-en{color:#8E7F8A;font-size:12px;direction:ltr;text-align:right}.hb-scope{font-size:11px;color:#D4614A;font-weight:800}.hb-go{margin-top:auto;display:inline-flex;gap:4px;align-items:center;color:#D4614A;font-weight:800;font-size:13px}
.hb-me{border-top-color:#D4614A}.hb-muted{color:#8E7F8A}.hb-err{color:#9A3A2A;background:#FBEDE7;border-radius:10px;padding:10px 12px}
.hb-command{border-top-color:#3A1F36;background:linear-gradient(180deg,#fff,#FBF4EE)}.hb-pending{display:inline-flex;gap:4px;align-items:center;font-size:12px;color:#8A5A1E;background:#F1D9A8;border-radius:999px;padding:2px 10px;width:max-content}.hb-pending b{font-size:13px}
.hb-pref{display:flex;gap:10px;align-items:flex-start;margin-top:22px;color:#4A3645;font-size:14px;font-weight:700;cursor:pointer}.hb-pref input{width:18px;height:18px;margin-top:2px;accent-color:#D4614A}.hb-pref small{display:block;color:#8E7F8A;font-weight:600}
.hw{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#3A1F36,#3A1F36 60%,#2A1626);color:#fff;padding:24px}.hw-card{text-align:center;max-width:620px;animation:hw-in .5s ease-out}.hw-kicker{color:#D9A866;font-weight:800;letter-spacing:.5px;margin:14px 0 4px}.hw h1{font-size:clamp(22px,3.6vw,34px);margin:0 0 8px;line-height:1.5}.hw-sub{color:#D9CBC2;margin:0 0 18px}.hw-go{display:inline-flex;gap:6px;align-items:center;background:#D9A866;color:#3A1F36;font-weight:900;border-radius:999px;padding:10px 18px;text-decoration:none}
.hw-rings{position:relative;display:block;width:96px;height:96px;margin:0 auto}.hw-rings i{position:absolute;inset:0;border:3px solid rgba(217,168,102,.9);border-radius:50%;animation:hw-ring 1.4s ease-out infinite}.hw-rings i:nth-child(2){animation-delay:.3s}.hw-rings i:nth-child(3){animation-delay:.6s}
@keyframes hw-ring{from{transform:scale(.3);opacity:1}to{transform:scale(1);opacity:0}}@keyframes hw-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.hb-card{transition:none}.hw-card,.hw-rings i{animation:none}}
`;
