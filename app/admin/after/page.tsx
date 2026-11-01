'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/after — «الشهادة التي تكبر» للطاقم (P38 · متابعة أثر التدريب)
 *  لكل برنامج: المحطات المفتوحة والمكتوبة (بالمحطة والحالة) · المشهودة · هل تتكلم صفحته العامة (من خمسة)
 *  · اعتماد اقتباسات مجهولة لصفحة البرنامج من بين ما أذن أصحابه فقط (إنسان يختار) · مسودّة الميسِّر لهندسة البرامج (الذكاء يلخّص والمهندس يقرّر)
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { P38_NAMES_AR, STATE_AR, STATION_AR, AFTER_K } from '../../../lib/after/registry';
import type { AfterState, Station } from '../../../lib/after/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];

export default function AdminAfterPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [openP, setOpenP] = useState(''); const [sum, setSum] = useState<Record<string, any>>({});
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/admin/after', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action + (body.id || body.program_id || '')); setError(''); setOk(''); try { const j = await fetch('/api/admin/after', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); if (j.note_ar) setOk(j.note_ar); await load(); return j; } catch (e: any) { setError(e.message || String(e)); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/after'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const programs: any[] = data?.programs || [];
  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="certificate" size={14} /> بوابة أَثَر · P38</span><h1>{P38_NAMES_AR.phase} — {P38_NAMES_AR.official}</h1><p>الشهادة لا تُختم يوم انتهاء البرنامج؛ تُفتح. المتدرّب يكتب بكلماته بعد شهر وثلاثة أشهر وسنة. الطاقم هنا لا يقيّم أحدًا: يرى الأعداد، ويختار من بين ما أذن أصحابه اقتباسات تظهر مجهولةً على صفحة البرنامج حين تتكلم (من {AFTER_K})، ويطلب من الميسِّر خلاصة لمهندس البرنامج — مسودّةً لا قرارًا.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/after': programs.reduce((n, p) => n + (p.candidates || []).length, 0) }} />
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        <div className="am-kpis" data-testid="aa-kpis"><span className="g"><b>{data?.total_written ?? 0}</b> محطة مكتوبة</span><span><b>{programs.length}</b> برنامجًا له محطات</span><span><b>{programs.filter(p => p.public).length}</b> صفحة برنامج تتكلم</span><span><b>{programs.reduce((n, p) => n + (p.candidates || []).length, 0)}</b> اقتباسًا ينتظر اختيارًا</span></div>
        {programs.length === 0 && <div className="am-card am-empty" data-testid="aa-empty">لا محطات بعد. تُفتح المحطات وحدها بعد 16 يومًا من نهاية أي برنامج له تسجيلات معتمَدة (داخل كرون المتابعة اليومي)، ويكتبها المتدرّبون من «محطاتي».</div>}
        {programs.map(p => <section key={p.program_id} className="am-card" data-testid="aa-prog">
          <h3>{p.program_ar} <small>انتهى {p.end_day || '—'} · {p.opened} محطة مفتوحة · {p.written} مكتوبة · {p.witnessed} مشهودة · {p.public ? <span className="aa-pub">صفحته تتكلم</span> : <span className="aa-quiet">صفحته صامتة حتى {AFTER_K}</span>}</small></h3>
          <div className="aa-grid">
            <div><h4>بالمحطة</h4><ul>{p.by_station.map((s: any) => <li key={s.station}>{STATION_AR[s.station as Station]}: <b>{s.written}</b></li>)}</ul></div>
            <div><h4>بالحالة (كلمات، لا نسب)</h4><ul>{Object.entries(p.states || {}).map(([k, v]) => <li key={k}>{STATE_AR[k as AfterState]}: <b>{String(v)}</b></li>)}{!Object.keys(p.states || {}).length && <li>—</li>}</ul></div>
            <div><h4>الصفحة العامة</h4><p className="aa-note"><Link href={`/programs/${encodeURIComponent(p.program_id)}`} target="_blank" rel="noreferrer">صفحة البرنامج ↗</Link> · المنشور: <b>{(p.published || []).length}</b> من 3 على الأكثر</p><button type="button" className="am-btn ghost small" disabled={busy === `summary${p.program_id}` || p.written < 3} onClick={async () => { const j = await post({ action: 'summary', program_id: p.program_id }); if (j) setSum(x => ({ ...x, [p.program_id]: j })); }} data-testid="aa-summary">{busy === `summary${p.program_id}` ? '…' : 'خلاصة الميسِّر لهندسة البرامج'}</button></div>
          </div>
          {sum[p.program_id] && <div className="aa-sum" data-testid="aa-sum"><b>مسودّة الميسِّر <small>({sum[p.program_id].source === 'ai' ? 'ذكاء اصطناعي' : 'محلي'} · من {sum[p.program_id].n} محطة)</small></b>
            <div className="aa-sumg"><div><h4>ما نفع فعلًا</h4><ul>{sum[p.program_id].summary.kept_ar.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div><div><h4>ما لم ينتقل إلى العمل</h4><ul>{sum[p.program_id].summary.gaps_ar.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div><div><h4>للنسخة التالية</h4><ul>{sum[p.program_id].summary.next_ar.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div></div>
            <p className="aa-note">{sum[p.program_id].note_ar} <Link href="/admin/factory">هندسة البرامج التدريبية ↗</Link></p></div>}
          <button type="button" className="am-btn ghost small" onClick={() => setOpenP(openP === p.program_id ? '' : p.program_id)} aria-expanded={openP === p.program_id} data-testid="aa-toggle">{openP === p.program_id ? 'أخفِ الاقتباسات' : `الاقتباسات (${(p.candidates || []).length} ينتظر · ${(p.published || []).length} منشور)`}</button>
          {openP === p.program_id && <div className="aa-cands" data-testid="aa-cands">
            <h4>أذن أصحابها بالنشر — اختر ما يظهر مجهولًا (حتى 3)</h4>
            {(p.candidates || []).length === 0 && <p className="am-empty">لا اقتباسات تنتظر.</p>}
            {(p.candidates || []).map((c: any) => <div key={c.id} className="aa-c" data-testid="aa-cand"><small>{c.station_ar} · {c.state_ar}</small><p>{c.text_ar}</p>{c.witness_text && <em>شهد: «{c.witness_text}»</em>}<button type="button" className="am-btn small" disabled={!!busy} onClick={() => post({ action: 'publish', id: c.id, published: true })} data-testid="aa-publish">اعتمد للصفحة</button></div>)}
            {(p.published || []).length > 0 && <><h4>منشور الآن</h4>{(p.published || []).map((c: any) => <div key={c.id} className="aa-c on" data-testid="aa-published"><small>{c.station_ar} · {c.state_ar}</small><p>{c.text_ar}</p><button type="button" className="am-btn ghost small" disabled={!!busy} onClick={() => post({ action: 'publish', id: c.id, published: false })} data-testid="aa-unpublish">أزِل من الصفحة</button></div>)}</>}
          </div>}
        </section>)}
        <p className="aa-foot">الذكاء الاصطناعي لا يكتب هنا شيئًا ولا يختار اقتباسًا؛ يلخّص فقط حين يطلب إنسان. البريد وواتساب مؤجَّلان بقرار المالك — إشعارات المحطات داخلية.</p>
      </div>
    </div>
  );
}
const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.am-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.am-card h3 small{font-size:12px;color:#475569;font-weight:600}.am-card h4{margin:10px 0 4px;color:#0b6f69;font-size:13px}.am-card ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.8;color:#1e293b}
.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.am-kpis b{font-size:20px;color:#0f2a4e;margin-inline-end:4px}.am-kpis .g b{color:#0b6f69}
.am-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;min-height:44px}.am-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.am-btn.small{padding:6px 10px;font-size:12px}.am-btn:disabled{opacity:.5;cursor:default}
.aa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.aa-pub{color:#065f46;font-weight:900}.aa-quiet{color:#92400e;font-weight:800}.aa-note{font-size:13px;color:#475569;margin:4px 0 8px;line-height:1.7}
.aa-sum{margin-top:12px;border:1.5px solid #c9a24b;border-radius:12px;padding:12px;background:#fffdf5}.aa-sumg{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.aa-cands{margin-top:10px;border-top:1px dashed #e2e8f0;padding-top:10px;display:grid;gap:8px}.aa-c{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:grid;gap:4px;background:#f8fafc}.aa-c.on{border-color:#c9a24b;background:#fffbeb}.aa-c small{color:#64748b;font-size:11.5px}.aa-c p{margin:0;line-height:1.8;color:#1f2937}.aa-c em{color:#065f46;font-style:normal;font-size:12.5px}.aa-c .am-btn{justify-self:start}
.aa-foot{color:#475569;font-size:12.5px;line-height:1.7;margin:4px 0 0}
`;
