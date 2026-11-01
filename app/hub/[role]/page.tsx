'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /hub/<باب> — باب الصفة (P42-أ: الهيكل · P42-ب: المحتوى الحيّ لكل باب)
 *  كل باب: اسم واضح + «أول ثلاث خطوات» + روابط الأدوات التي تخصّ هذه الصفة فقط — لا قائمة الإدارة الكاملة.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';
import { doorFor, type DoorLive, type Indicator } from '../../../lib/portal/hub';


export default function HubDoorPage({ params }: { params: { role: string } }) {
  const router = useRouter(); const door = doorFor(params.role); const [allowed, setAllowed] = useState<boolean | null>(null); const [mine, setMine] = useState<string[]>([]);
  const [live, setLive] = useState<DoorLive | null>(null); const [liveErr, setLiveErr] = useState(''); const [first, setFirst] = useState(false); const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      const { data } = await supabase().auth.getSession(); const tk = data.session?.access_token; if (!tk) { router.replace(`/login?next=/hub/${params.role}`); return; }
      const j = await fetch('/api/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null);
      const roles: string[] = j?.roles || []; setMine(roles); setAllowed(!!door && (roles.includes('ADMIN') || door.roles.some(r => roles.includes(r))));
      if (!door) return;
      /* أول زيارة لهذا الباب على هذا الجهاز → «أول ثلاث خطوات» مفتوحة */
      try { const k = `athar_door_seen_${params.role}`; if (!localStorage.getItem(k)) { setFirst(true); localStorage.setItem(k, new Date().toISOString()); } } catch { /* ignore */ }
      const h = await fetch(`/api/hub?door=${encodeURIComponent(params.role)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null);
      if (h?.success) setLive(h); else setLiveErr(h?.error || 'تعذّر تحميل المؤشرات');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.role, tick]);
  if (!door) return <PortalShell><main className="hd" dir="rtl" id="main"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="hd-wrap"><p className="hd-err">لا يوجد باب بهذا الاسم. <Link href="/hub">أبوابي</Link></p></div></main></PortalShell>;
  return (
    <PortalShell><main className="hd" dir="rtl" id="main"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hd-wrap">
        <header className="hd-head"><Link href="/hub" className="hd-back"><Icon name="arrow" size={14} /> أبوابي</Link><h1>{door.title_ar} <small>{door.title_en}</small></h1><p>{door.lead}</p></header>
        {allowed === null && <p className="hd-muted">جارٍ التحقق من صفتك…</p>}
        {allowed === false && <p className="hd-err" data-testid="door-denied">هذا الباب لصفة أخرى ({door.roles.join(' · ')}). صفاتك الحالية: {mine.length ? mine.join(' · ') : 'مشارك'}. <Link href="/hub">عد إلى أبوابك</Link></p>}
        {allowed && (<>
          <section className="hd-sec" aria-labelledby="hd-ind" data-testid="door-indicators">
            <div className="hd-sechead"><h2 id="hd-ind"><Icon name="chart" size={16} /> مؤشرات أَثَر</h2>{live && <span className="hd-when">حُسبت الآن · <button type="button" className="hd-refresh" onClick={() => { setLive(null); setTick(t => t + 1); }} data-testid="door-refresh">تحديث</button></span>}</div>
            {!live && !liveErr && <div className="hd-ind" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="hd-kpi skel" />)}</div>}
            {liveErr && <p className="hd-err" data-testid="door-live-error">{liveErr}</p>}
            {live && <div className="hd-ind">{live.indicators.map(k => <Kpi key={k.key} k={k} />)}</div>}
          </section>
          {live && live.decisions.length > 0 && (
            <section className="hd-sec" aria-labelledby="hd-dec" data-testid="door-decisions">
              <div className="hd-sechead"><h2 id="hd-dec"><Icon name="flag" size={16} /> ينتظر قرارك</h2><span className="hd-when">القرار بشري — أَثَر يرتّب فقط</span></div>
              <ul className="hd-dec">{live.decisions.map(d => <li key={d.key} className={d.urgent ? 'urgent' : ''}><Link href={d.href} data-testid={`door-decision-${d.key}`}><b>{d.count}</b><span>{d.label}</span><Icon name="arrow" size={14} /></Link></li>)}</ul>
            </section>
          )}
          {live && live.decisions.length === 0 && <p className="hd-clear" data-testid="door-clear"><Icon name="check" size={14} /> لا شيء ينتظر قرارك الآن.</p>}
          <section className="hd-sec" aria-labelledby="hd-links">
            <div className="hd-sechead"><h2 id="hd-links"><Icon name="compass" size={16} /> أدوات الباب</h2></div>
            <div className="hd-grid" data-testid="door-links">
              {door.links.map(l => <Link key={l.href} href={l.href} className="hd-card"><b>{l.label}</b><span>{l.hint}</span></Link>)}
            </div>
          </section>
          <details className="hd-steps" open={first} data-testid="door-steps">
            <summary><Icon name="star" size={15} /> أول ثلاث خطوات {first ? '— مرحبًا بك في بابك' : ''}</summary>
            <ol>{(live?.steps || []).map((st, i) => <li key={i}>{st}</li>)}{!live && <li className="hd-muted">…</li>}</ol>
          </details>
        </>)}
      </div>
    </main></PortalShell>
  );
}

function Kpi({ k }: { k: Indicator }) {
  const v = k.value == null ? '—' : typeof k.value === 'number' ? k.value.toLocaleString('en-US') : k.value;
  const inner = <><span className="hd-kv" data-tone={k.tone || ''}>{v}</span><span className="hd-kl">{k.label}</span>{k.unit && <span className="hd-ku">{k.unit}</span>}{k.hint && <span className="hd-kh">{k.hint}</span>}</>;
  return k.href ? <Link href={k.href} className="hd-kpi" data-testid={`door-kpi-${k.key}`} title={k.value == null ? 'غير متاح الآن' : undefined}>{inner}</Link> : <div className="hd-kpi" data-testid={`door-kpi-${k.key}`}>{inner}</div>;
}
const CSS = `
.hd{min-height:70vh;padding:28px 14px;background:#f6f8fb}.hd-wrap{max-width:980px;margin:0 auto}
.hd-back{display:inline-flex;gap:4px;align-items:center;color:#0b8a83;text-decoration:none;font-weight:800;font-size:13px}.hd-head h1{margin:8px 0 4px;color:#0f2a4e;font-size:28px}.hd-head small{color:#94a3b8;font-size:14px;font-weight:600;margin-inline-start:8px;direction:ltr}.hd-head p{margin:0 0 18px;color:#475569;line-height:1.8}
.hd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.hd-card{display:grid;gap:4px;text-decoration:none;background:#fff;border:1px solid #e5e9f0;border-right:4px solid #c9a24b;border-radius:14px;padding:14px;color:#0f2a4e}.hd-card span{color:#64748b;font-size:13px}.hd-card:hover,.hd-card:focus-visible{box-shadow:0 12px 26px -20px rgba(15,42,78,.6);outline:none}.hd-card:focus-visible{outline:3px solid #0b8a83}
.hd-sec{margin-top:22px}.hd-sechead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}.hd-sechead h2{margin:0;font-size:17px;color:#0f2a4e;display:inline-flex;gap:6px;align-items:center}.hd-when{color:#64748b;font-size:12px}.hd-refresh{background:none;border:0;color:#0b8a83;font-weight:800;cursor:pointer;font-family:inherit;min-height:44px;padding:0 6px}
.hd-ind{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.hd-kpi{display:grid;gap:2px;background:#fff;border:1px solid #e5e9f0;border-radius:14px;padding:14px 14px 12px;text-decoration:none;color:#0f2a4e;min-height:96px;transition:transform .15s,box-shadow .15s}a.hd-kpi:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(15,42,78,.10)}a.hd-kpi:focus-visible{outline:3px solid #0b8a83;outline-offset:2px}
.hd-kv{font-size:30px;font-weight:900;line-height:1.1;font-variant-numeric:tabular-nums}.hd-kv[data-tone=gold]{color:#a3801f}.hd-kv[data-tone=teal]{color:#0b8a83}.hd-kv[data-tone=warn]{color:#b91c1c}.hd-kl{font-size:13px;font-weight:700;color:#334155;line-height:1.5}.hd-ku{font-size:12px;color:#0b8a83;font-weight:800}.hd-kh{font-size:11.5px;color:#64748b;line-height:1.5}
.hd-kpi.skel{background:linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7);background-size:200% 100%;animation:hdsk 1.2s linear infinite;border-color:transparent}@keyframes hdsk{to{background-position:-200% 0}}
.hd-dec{list-style:none;margin:0;padding:0;display:grid;gap:8px}.hd-dec a{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e5e9f0;border-right:4px solid #c9a24b;border-radius:12px;padding:10px 14px;text-decoration:none;color:#0f2a4e;min-height:52px}.hd-dec li.urgent a{border-right-color:#b91c1c}.hd-dec b{font-size:22px;min-width:36px;text-align:center;font-variant-numeric:tabular-nums}.hd-dec span{flex:1;font-weight:700;font-size:14px}.hd-dec a:hover{background:#f8fafc}.hd-dec a:focus-visible{outline:3px solid #0b8a83;outline-offset:2px}
.hd-clear{margin:12px 0 0;color:#15803d;background:#eafaf0;border:1px solid #b7e4c7;border-radius:10px;padding:10px 12px;font-weight:700;display:inline-flex;gap:6px;align-items:center}
.hd-steps{margin-top:22px;background:#fffaf0;border:1px solid #f1e3bd;border-radius:14px;padding:4px 14px}.hd-steps summary{cursor:pointer;font-weight:800;color:#0f2a4e;min-height:44px;display:flex;align-items:center;gap:6px;list-style:none}.hd-steps summary::-webkit-details-marker{display:none}.hd-steps ol{margin:0 0 12px;padding-inline-start:22px;line-height:1.9;color:#334155}
@media (prefers-reduced-motion:reduce){.hd-kpi,.hd-kpi.skel{transition:none;animation:none}}
.hd-muted{color:#64748b}.hd-err{color:#991b1b;background:#fef2f2;border-radius:10px;padding:10px 12px;line-height:1.8}.hd-err a{color:#0b8a83}.hd-note{margin-top:22px;color:#94a3b8;font-size:12px}
`;
