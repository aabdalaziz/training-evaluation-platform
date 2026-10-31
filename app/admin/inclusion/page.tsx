'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/inclusion — «أَثَر للجميع» للطاقم (P32): أرقام مجمَّعة k≥5 · اعتماد «نسخة أبسط» (الذكاء الاصطناعي يقترح، الإنسان يعتمد أو يحرّر) ·
 *  بلاغات الوصول وحالتها · ما يوفّره كل برنامج فعلًا (سمات الوصول) · احتياجات المسجَّلين في برنامج (من سمحوا فقط، بلا أسماء).
 *  لا يرى الطاقم هنا أي ملف فردي.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { FEATURES, FEATURE_LABEL, NEED_LABEL, REPORT_STATUS_AR } from '../../../lib/inclusion/registry';
import type { Feature, Need } from '../../../lib/inclusion/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Tab = 'texts' | 'reports' | 'programs';
const SOURCE_AR: Record<string, string> = { program_intro: 'نبذة برنامج', program_objectives: 'أهداف برنامج', daily_case: 'موقف اليوم', page: 'صفحة' };
const TEXT_ST: Record<string, string> = { pending: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض' };

export default function AdminInclusionPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [tab, setTab] = useState<Tab>('texts'); const [edit, setEdit] = useState<Record<string, string>>({}); const [rnote, setRnote] = useState<Record<string, string>>({}); const [progSel, setProgSel] = useState(''); const [shared, setShared] = useState<any>(null);
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/admin/inclusion', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action + (body.op || body.status || '')); setError(''); setOk(''); try { const j = await fetch('/api/admin/inclusion', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); await load(); return j; } catch (e: any) { setError(e.message); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/inclusion'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!progSel) { setShared(null); return; } (async () => { const j = await fetch(`/api/admin/inclusion?program=${encodeURIComponent(progSel)}`, { headers: await H(), cache: 'no-store' }).then(r => r.json()).catch(() => null); setShared(j?.success ? j : null); })(); }, [progSel]); // eslint-disable-line react-hooks/exhaustive-deps

  const texts: any[] = data?.texts || []; const reports: any[] = data?.reports || []; const programs: any[] = data?.programs || []; const st = data?.stats;
  const pendingTexts = texts.filter(t => t.status === 'pending').length; const openReports = reports.filter(r => r.status === 'open').length;
  async function toggleFeature(p: any, f: Feature) { const features = p.features.includes(f) ? p.features.filter((x: string) => x !== f) : [...p.features, f]; const j = await post({ action: 'features', program_id: p.id, features }); if (j) setOk(`حُدّثت سمات «${p.name_ar}»`); }

  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="users" size={14} /> بوابة أَثَر · P32</span><h1>أَثَر للجميع — الشمول في البوابة نفسها</h1><p>هنا ثلاثة أشياء لا غير: نصوص «نسخة أبسط» يقترحها الذكاء الاصطناعي وتعتمدها أنت أو تحرّرها · بلاغات العوائق وحالتها · ما يوفّره كل برنامج فعلًا. لا ترى هنا ملف احتياج أي شخص؛ الأرقام مجمَّعة ولا رقم أقل من {data?.meta?.k || 5}.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/inclusion': pendingTexts + openReports }} />
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        {data?.pending_sql && <div className="am-err" role="alert">لم يُنفَّذ ملف SQL الخاص بـ P32 بعد (عمود <code>programs.access_features</code>) — نفّذه أولًا ثم أعد التحميل.</div>}
        {st && <div className="am-kpis" data-testid="ai-kpis"><span><b>{st.people === null ? `< ${st.k}` : st.people}</b> كيّفوا البوابة</span><span className="g"><b>{st.programs_ready}</b> برامج مهيَّأة</span><span><b>{pendingTexts}</b> نصوص تنتظر</span><span><b>{openReports}</b> بلاغات مفتوحة</span><span><b>{st.reports.fixed}</b> أُصلحت</span>
          {st.needs.length > 0 && <span>{st.needs.map((x: any) => `${NEED_LABEL[x.key as Need].ar} ${x.n}`).join(' · ')}</span>}<span className="am-cycle"><Link href="/accessibility" className="am-btn ghost small">بيان الوصول</Link></span></div>}
        <div className="am-tabs" role="tablist">{([['texts', `نسخة أبسط (${pendingTexts})`], ['reports', `بلاغات الوصول (${openReports})`], ['programs', 'ما توفّره البرامج']] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`ai-tab-${k}`}>{l}</button>)}</div>

        {tab === 'texts' && <div className="am-card">
          <h3>نصوص «نسخة أبسط» <small>— الذكاء الاصطناعي يكتب، وأنت تقرأ وتعتمد أو تحرّر؛ لا تُعرض للجمهور قبل ذلك</small></h3>
          {!texts.length && <div className="am-empty">لا نصوص بعد. تظهر هنا عندما يطلب أحد «نسخة أبسط» من نبذة برنامج أو موقف اليوم.</div>}
          {texts.map(t => <div key={t.id} className="ai-text" data-testid="ai-text">
            <div className="ai-texthead"><b>{SOURCE_AR[t.source] || t.source}</b> <code>{t.source_id}</code> · <span className="am-st" style={{ background: t.status === 'approved' ? '#0b6f69' : t.status === 'pending' ? '#c9a24b' : '#64748b' }}>{TEXT_ST[t.status]}</span> · <small>{fmt(t.created_at)} · {t.model || '—'}</small></div>
            <textarea rows={6} value={edit[t.id] ?? t.simple_ar} onChange={e => setEdit(x => ({ ...x, [t.id]: e.target.value }))} aria-label="النص الأبسط" />
            <div className="am-decide">
              <button className="am-btn" disabled={!!busy} onClick={async () => { const changed = edit[t.id] !== undefined && edit[t.id] !== t.simple_ar; const j = await post(changed ? { action: 'text', id: t.id, op: 'edit', simple_ar: edit[t.id] } : { action: 'text', id: t.id, op: 'approve' }); if (j) setOk('اعتُمدت النسخة الأبسط وصارت تُعرض'); }} data-testid="ai-approve">{edit[t.id] !== undefined && edit[t.id] !== t.simple_ar ? 'احفظ تحريري واعتمد' : 'اعتمد'}</button>
              {t.status !== 'rejected' && <button className="am-btn ghost danger" disabled={!!busy} onClick={async () => { const j = await post({ action: 'text', id: t.id, op: 'reject' }); if (j) setOk('رُفضت النسخة — لن تُعرض'); }}>ارفض</button>}
            </div>
          </div>)}
        </div>}

        {tab === 'reports' && <div className="am-card">
          <h3>بلاغات الوصول <small>— كل بلاغ يُقرأ ويُغلق بحالة صريحة؛ «لن يُصلح» يحتاج سببًا يُكتب</small></h3>
          {!reports.length && <div className="am-empty">لا بلاغات.</div>}
          {reports.length > 0 && <table className="am-table"><thead><tr><th>التاريخ</th><th>الصفحة</th><th>العائق</th><th>الحالة</th><th></th></tr></thead><tbody>
            {reports.map(r => <tr key={r.id} data-testid="ai-report"><td><small>{fmt(r.created_at)}</small></td><td><code>{r.page}</code></td><td style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{r.text_ar}{r.contact && <small><br />للرد: {r.contact}</small>}{r.staff_note && <small><br />ملاحظة الطاقم: {r.staff_note}</small>}</td>
              <td><span className="am-st" style={{ background: r.status === 'open' ? '#c9a24b' : r.status === 'fixed' ? '#0b6f69' : '#64748b' }}>{REPORT_STATUS_AR[r.status as keyof typeof REPORT_STATUS_AR]}</span></td>
              <td><div className="am-acts"><input placeholder="ملاحظة (مطلوبة لـ«لن يُصلح»)" value={rnote[r.id] || ''} onChange={e => setRnote(x => ({ ...x, [r.id]: e.target.value }))} aria-label="ملاحظة الطاقم" style={{ minWidth: 160 }} />
                {r.status !== 'fixed' && <button className="am-btn small" disabled={!!busy} onClick={() => post({ action: 'report', id: r.id, status: 'fixed', staff_note: rnote[r.id] || undefined }).then(j => j && setOk('أُغلق البلاغ: أُصلح'))} data-testid="ai-fixed">أُصلح</button>}
                {r.status !== 'wontfix' && <button className="am-btn ghost small" disabled={!!busy || !(rnote[r.id] || '').trim()} onClick={() => post({ action: 'report', id: r.id, status: 'wontfix', staff_note: rnote[r.id] })}>لن يُصلح</button>}
                {r.status !== 'open' && <button className="am-btn ghost small" disabled={!!busy} onClick={() => post({ action: 'report', id: r.id, status: 'open' })}>أعد فتحه</button>}</div></td></tr>)}
          </tbody></table>}
        </div>}

        {tab === 'programs' && <div className="am-grid2">
          <div className="am-card">
            <h3>ما يوفّره كل برنامج فعلًا <small>— يظهر شارةً في الكتالوج ويُرشَّح به «يناسبني»؛ ضع ما تضمنه لا ما تتمناه</small></h3>
            {!programs.length && <div className="am-empty">لا برامج.</div>}
            {programs.map(p => <div key={p.id} className="ai-prog" data-testid="ai-prog" data-pid={p.id}>
              <div className="ai-proghead"><b>{p.name_ar}</b>{!p.is_public && <small> · غير منشور</small>}<button className="am-btn ghost small" style={{ marginInlineStart: 'auto' }} onClick={() => setProgSel(progSel === p.id ? '' : p.id)} aria-pressed={progSel === p.id}>احتياجات المسجَّلين</button></div>
              <div className="ai-feats">{FEATURES.map(f => <label key={f} className={p.features.includes(f) ? 'on' : ''}><input type="checkbox" checked={p.features.includes(f)} disabled={!!busy} onChange={() => toggleFeature(p, f)} data-testid={`ai-feat-${f}`} /> {FEATURE_LABEL[f].ar}</label>)}</div>
            </div>)}
          </div>
          <div className="am-card">
            <h3>احتياجات المسجَّلين في برنامج <small>— من سمحوا بمشاركتها فقط، بلا أسماء ولا بُرُد</small></h3>
            {!progSel && <div className="am-empty">اختر برنامجًا من القائمة («احتياجات المسجَّلين»).</div>}
            {progSel && !shared && <div className="am-empty">نقرأ…</div>}
            {shared && <div data-testid="ai-shared"><p className="am-note">{shared.note_ar}</p><p><b>{shared.shared_people}</b> شخصًا سمحوا بالمشاركة</p>
              {shared.needs.length > 0 ? <ul>{shared.needs.map((n: any) => <li key={n.key}>{n.label_ar} · {n.n}</li>)}</ul> : <p className="am-note">لا احتياجات مشتركة لهذا البرنامج.</p>}
              {shared.helps_ar.length > 0 && <><h4>بكلماتهم</h4><ul>{shared.helps_ar.map((h: string, i: number) => <li key={i}>{h}</li>)}</ul></>}</div>}
          </div>
        </div>}
      </div>
    </div>
  );
}

const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;overflow-x:auto}.am-card h3{margin:0 0 10px;color:#0f2a4e;font-size:17px}.am-card h3 small{font-size:12px;color:#475569}.am-card h4{margin:10px 0 4px;color:#0b6f69;font-size:13px}.am-card ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.8;color:#1e293b}
.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:#475569}.am-kpis b{font-size:20px;color:#0f2a4e;margin-inline-end:4px}.am-kpis .g b{color:#0b6f69}.am-cycle{margin-inline-start:auto;display:flex;gap:6px}
.am-tabs{display:flex;gap:6px;flex-wrap:wrap}.am-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:9px 14px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer;min-height:44px}.am-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.am-table{width:100%;border-collapse:collapse;font-size:13px}.am-table th{text-align:right;color:#475569;font-weight:800;font-size:12px;padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.am-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;color:#0f172a}.am-table small{color:#475569;font-size:11.5px}
.am-st{color:#fff;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;white-space:nowrap}
.am-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;min-height:36px}.am-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.am-btn.small{padding:4px 9px;font-size:12px}.am-btn.danger{color:#991b1b;border-color:#fecaca}.am-btn:disabled{opacity:.5;cursor:default}.am-acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.am-decide{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.am-note{display:block;color:#475569;font-size:12px;margin-top:6px;line-height:1.7}
.am-grid2{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;align-items:start}
.am-card input:not([type=checkbox]),.am-card textarea{border:1px solid #94a3b8;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;font-weight:400;background:#fff;width:100%;box-sizing:border-box;color:#0f172a;min-height:36px}
.ai-text{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:10px}.ai-texthead{font-size:13px;color:#334155;margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.ai-text textarea{line-height:1.9}
.ai-prog{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:10px}.ai-proghead{display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#0f2a4e}.ai-feats{display:flex;flex-wrap:wrap;gap:6px}.ai-feats label{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;border-radius:999px;padding:5px 10px;font-size:12.5px;cursor:pointer;min-height:32px;color:#334155}.ai-feats label.on{background:#f0fbfa;border-color:#0b6f69;color:#0b6f69;font-weight:800}.ai-feats input{accent-color:#0b6f69;width:16px;height:16px}
code{font-size:12px;background:#f1f5f9;border-radius:6px;padding:1px 5px}
@media(max-width:860px){.am-grid2{grid-template-columns:1fr}.am-cycle{margin-inline-start:0}}
`;
