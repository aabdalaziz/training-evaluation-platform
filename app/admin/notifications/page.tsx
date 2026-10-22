'use client';
/**
 * /admin/notifications — مركز الإشعارات
 * قائمة الإشعارات المفتوحة والمحلولة، فلاتر حسب الشدة والنوع، تعليم كمقروء/حلّ، وزر «فحص الآن»
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import type { IconName } from '../../../lib/ui/icons';
import { SEVERITY_LABEL, countBySeverity, kindIcon, kindLabel, openOnes, timeAgo, type Notification, type Severity } from '../../../lib/notifications/model';

type Run = { id: number; ran_at: string; source: string; inserted: number; resolved: number };
const WRITE_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];

export default function NotificationsPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<'open' | 'unread' | 'resolved'>('open');
  const [sev, setSev] = useState<'' | Severity>('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  async function load() {
    const [n, r] = await Promise.all([
      db.from('notifications').select('*').order('created_at', { ascending: false }).limit(500),
      db.from('notification_runs').select('*').order('ran_at', { ascending: false }).limit(5),
    ]);
    if (n.error) setError(n.error.message);
    setList((n.data || []) as Notification[]); setRuns((r.data || []) as Run[]); setNow(new Date());
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/notifications'); return; }
      const { data: p } = await db.from('profiles').select('role').eq('id', user.id).single();
      setCanWrite(WRITE_ROLES.includes(String((p as any)?.role || '').toUpperCase()));
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useMemo(() => openOnes(list), [list]);
  const bySev = useMemo(() => countBySeverity(list), [list]);
  const kinds = useMemo(() => Array.from(new Set(list.map(n => n.kind))), [list]);
  const shown = useMemo(() => {
    let a = tab === 'resolved' ? list.filter(n => n.resolved_at) : tab === 'unread' ? open.filter(n => !n.read_at) : open;
    if (sev) a = a.filter(n => n.severity === sev);
    if (kind) a = a.filter(n => n.kind === kind);
    return a;
  }, [list, open, tab, sev, kind]);

  async function scanNow() {
    setBusy(true); setMsg(''); setError('');
    try {
      const { data: { session } } = await db.auth.getSession();
      const r = await fetch('/api/notifications/scan', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ email: false }) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'فشل الفحص');
      setMsg(`اكتمل الفحص: ${j.inserted} إشعار جديد · ${j.resolved} حُلّ تلقائيًا`);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function setRead(ids: string[], read: boolean) {
    if (!ids.length) return;
    const { data: { user } } = await db.auth.getUser();
    const patch = read ? { read_at: new Date().toISOString(), read_by: user?.id || null } : { read_at: null, read_by: null };
    const { error } = await db.from('notifications').update(patch).in('id', ids); if (error) { setError(error.message); return; }
    setList(l => l.map(n => (ids.includes(n.id) ? { ...n, ...patch } : n)));
  }
  async function resolve(ids: string[], on: boolean) {
    if (!ids.length) return;
    const patch = on ? { resolved_at: new Date().toISOString() } : { resolved_at: null };
    const { error } = await db.from('notifications').update(patch).in('id', ids); if (error) { setError(error.message); return; }
    setList(l => l.map(n => (ids.includes(n.id) ? { ...n, ...patch } : n)));
  }

  if (!ready) return <div className="nt" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const lastRun = runs[0];

  return (
    <div className="nt" dir="rtl">
      <style>{CSS}</style>
      <header className="nt-head">
        <div>
          <div className="nt-kicker"><Icon name="bell" size={14} /> مركز الإدارة · الإشعارات</div>
          <h1>مركز الإشعارات</h1>
          <p>تنبيهات تلقائية من قواعد الجودة: حملات متابعة ناقصة أو صامتة، جلسات حضور لم تُغلق، شهادات لم تُصدر، قياس بعدي معطّل، نقل أثر ضعيف، وبرامج تجاوزت موعدها. يُفحص يوميًا 06:00 صباحًا ويمكن فحصه الآن.</p>
        </div>
        <nav className="nt-nav">
          <Link href="/dashboard" className="nt-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/reports/center" className="nt-btn"><Icon name="chart" size={16} /> مركز التقارير</Link>
          {canWrite && <button className="nt-btn primary" disabled={busy} onClick={scanNow}><Icon name="refresh" size={16} /> {busy ? 'جارٍ الفحص…' : 'فحص الآن'}</button>}
        </nav>
      </header>
      {error && <div className="nt-alert bad">{error}</div>}
      {msg && <div className="nt-alert ok">{msg}</div>}

      <section className="nt-kpis">
        <button className={`nt-kpi ${sev === 'critical' ? 'on' : ''} critical`} onClick={() => setSev(sev === 'critical' ? '' : 'critical')}><span>حرج</span><b>{bySev.critical}</b></button>
        <button className={`nt-kpi ${sev === 'warn' ? 'on' : ''} warn`} onClick={() => setSev(sev === 'warn' ? '' : 'warn')}><span>تنبيه</span><b>{bySev.warn}</b></button>
        <button className={`nt-kpi ${sev === 'info' ? 'on' : ''} info`} onClick={() => setSev(sev === 'info' ? '' : 'info')}><span>معلومة</span><b>{bySev.info}</b></button>
        <div className="nt-kpi plain"><span>آخر فحص</span><b>{lastRun && now ? timeAgo(lastRun.ran_at, now) : '—'}</b><small>{lastRun ? `${lastRun.source === 'cron' ? 'تلقائي' : 'يدوي'} · +${lastRun.inserted} / حُلّ ${lastRun.resolved}` : 'لم يُنفَّذ بعد'}</small></div>
      </section>

      <section className="nt-card">
        <div className="nt-toolbar">
          <div className="nt-seg">
            <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>المفتوحة <i>{open.length}</i></button>
            <button className={tab === 'unread' ? 'on' : ''} onClick={() => setTab('unread')}>غير المقروءة <i>{open.filter(n => !n.read_at).length}</i></button>
            <button className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>المحلولة <i>{list.filter(n => n.resolved_at).length}</i></button>
          </div>
          <select value={kind} onChange={e => setKind(e.target.value)}><option value="">كل الأنواع</option>{kinds.map(k => <option key={k} value={k}>{kindLabel(k)} · {k}</option>)}</select>
          <div className="nt-spacer" />
          {tab !== 'resolved' && <button className="nt-btn small" disabled={!shown.some(n => !n.read_at)} onClick={() => setRead(shown.filter(n => !n.read_at).map(n => n.id), true)}><Icon name="check" size={14} /> تعليم الكل كمقروء</button>}
          {canWrite && tab !== 'resolved' && <button className="nt-btn small" disabled={!shown.length} onClick={() => { if (confirm(`حلّ ${shown.length} إشعارًا يدويًا؟`)) resolve(shown.map(n => n.id), true); }}><Icon name="x" size={14} /> حلّ الكل</button>}
        </div>

        {!shown.length && <div className="nt-empty"><Icon name="check" size={32} /><b>{tab === 'resolved' ? 'لا توجد إشعارات محلولة' : 'كل شيء على ما يرام'}</b><span>{tab === 'resolved' ? '' : 'لا توجد إشعارات مفتوحة تطابق الفلتر الحالي.'}</span></div>}
        <div className="nt-list">
          {shown.map(n => (
            <article key={n.id} className={`nt-item ${n.severity} ${n.read_at ? '' : 'unread'} ${n.resolved_at ? 'resolved' : ''}`}>
              <div className="nt-ic"><Icon name={kindIcon(n.kind) as IconName} size={18} /></div>
              <div className="nt-body">
                <div className="nt-title"><b>{n.title}</b><span className={`nt-sev ${n.severity}`}>{SEVERITY_LABEL[n.severity]}</span><span className="nt-kind">{kindLabel(n.kind)}</span></div>
                {n.body && <p>{n.body}</p>}
                <small>{now ? timeAgo(n.created_at, now) : ''}{n.read_at ? ' · مقروء' : ''}{n.resolved_at ? ` · حُلّ ${now ? timeAgo(n.resolved_at, now) : ''}` : ''}</small>
              </div>
              <div className="nt-actions">
                {n.href && <Link href={n.href} className="nt-btn small primary" onClick={() => setRead([n.id], true)}><Icon name="arrow" size={14} /> فتح</Link>}
                {!n.resolved_at && (n.read_at ? <button className="nt-btn small" onClick={() => setRead([n.id], false)}>غير مقروء</button> : <button className="nt-btn small" onClick={() => setRead([n.id], true)}><Icon name="check" size={14} /> مقروء</button>)}
                {canWrite && (n.resolved_at ? <button className="nt-btn small" onClick={() => resolve([n.id], false)}><Icon name="refresh" size={14} /> إعادة فتح</button> : <button className="nt-btn small" onClick={() => resolve([n.id], true)}><Icon name="x" size={14} /> حلّ</button>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="nt-card nt-rules">
        <h3><Icon name="settings" size={16} /> القواعد المفعّلة</h3>
        <ul>
          <li><b>متابعة الأثر:</b> برنامج ينتهي خلال 14 يومًا أو انتهى خلال 45 يومًا بلا حملة متابعة · حملة أُرسلت قبل 7 أيام بلا استجابات · حملة يدوية بلغ موعدها.</li>
          <li><b>الحضور:</b> جلسة ما زالت مفتوحة بعد يومها.</li>
          <li><b>الشهادات:</b> برنامج انتهى وله حضور مسجّل ولم تُصدر له شهادات خلال 60 يومًا.</li>
          <li><b>قياس الأثر:</b> البرنامج انتهى والقياس البعدي ما زال مغلقًا.</li>
          <li><b>نقل الأثر (حرج):</b> متوسط تقدير المشرفين أقل من 60% عبر 3 تقييمات فأكثر.</li>
          <li><b>البرامج:</b> برنامج «نشط» تجاوز تاريخ نهايته بأكثر من 7 أيام.</li>
        </ul>
        <p className="nt-muted">تُحلّ الإشعارات تلقائيًا عند زوال سببها، وتعود للظهور إن تكرر. بريد ملخص يصل لمديري المنصة عند ظهور إشعارات جديدة في الفحص اليومي (يمكن تخصيص المستلمين عبر المتغير <code>NOTIFY_EMAILS</code>).</p>
      </section>
    </div>
  );
}

const CSS = `
.nt{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.nt *{box-sizing:border-box}
.nt-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #c9a24b;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.nt-head h1{margin:2px 0 4px;font-size:24px;color:#0f2a4e}.nt-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.nt-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.nt-nav{display:flex;gap:8px;flex-wrap:wrap}
.nt-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:#0f2a4e;cursor:pointer;text-decoration:none;white-space:nowrap}
.nt-btn.primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.nt-btn.small{padding:6px 10px;font-size:12px}.nt-btn:disabled{opacity:.5;cursor:default}
.nt-alert{border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}.nt-alert.bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.nt-alert.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
.nt-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.nt-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:2px;text-align:start;font:inherit;cursor:pointer;min-width:0}
.nt-kpi span{font-size:12px;font-weight:800;color:#64748b}.nt-kpi b{font-size:28px;line-height:1.2;color:#0f2a4e}.nt-kpi small{font-size:11px;color:#94a3b8;font-weight:700}
.nt-kpi.critical b{color:#dc2626}.nt-kpi.warn b{color:#d97706}.nt-kpi.info b{color:#0b8a83}.nt-kpi.on{outline:2px solid #0f2a4e}.nt-kpi.plain{cursor:default}
.nt-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 20px;margin-bottom:14px}
.nt-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.nt-spacer{flex:1}
.nt-seg{display:inline-flex;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden}.nt-seg button{border:0;background:#fff;padding:8px 12px;font:inherit;font-size:12.5px;font-weight:800;color:#475569;cursor:pointer;display:inline-flex;gap:6px;align-items:center}.nt-seg button.on{background:#0f2a4e;color:#fff}.nt-seg i{font-style:normal;background:rgba(0,0,0,.08);border-radius:999px;padding:0 7px;font-size:11px}.nt-seg button.on i{background:rgba(255,255,255,.2)}
.nt select{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:12.5px;font-weight:700;background:#fff}
.nt-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px;text-align:center;color:#64748b}.nt-empty b{color:#0f2a4e;font-size:15px}.nt-empty svg{color:#0b8a83}
.nt-list{display:flex;flex-direction:column;gap:8px}
.nt-item{display:grid;grid-template-columns:40px 1fr auto;gap:12px;align-items:start;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;border-inline-start:4px solid #cbd5e1}
.nt-item.critical{border-inline-start-color:#dc2626}.nt-item.warn{border-inline-start-color:#d97706}.nt-item.info{border-inline-start-color:#0b8a83}
.nt-item.unread{background:#f8fafc}.nt-item.resolved{opacity:.7}
.nt-ic{width:40px;height:40px;border-radius:10px;background:#eef2f7;display:flex;align-items:center;justify-content:center;color:#0f2a4e}
.nt-body{min-width:0}.nt-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.nt-title b{font-size:14px;color:#0f2a4e}
.nt-body p{margin:4px 0 0;font-size:13px;color:#334155;line-height:1.7}.nt-body small{display:block;margin-top:4px;font-size:11.5px;color:#94a3b8;font-weight:700}
.nt-sev{font-size:10.5px;font-weight:900;border-radius:999px;padding:2px 8px}.nt-sev.critical{background:#fef2f2;color:#b91c1c}.nt-sev.warn{background:#fff7ed;color:#b45309}.nt-sev.info{background:#ecfeff;color:#0e7490}
.nt-kind{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#475569}
.nt-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.nt-rules h3{margin:0 0 8px;font-size:14px;color:#0f2a4e;display:flex;gap:8px;align-items:center}.nt-rules ul{margin:0;padding:0 18px 0 0;font-size:13px;line-height:1.9;color:#334155}.nt-rules code{background:#f1f5f9;padding:1px 6px;border-radius:6px;direction:ltr;display:inline-block}
.nt-muted{color:#64748b;font-size:12.5px;font-weight:700;line-height:1.7;margin:8px 0 0}
@media(max-width:900px){.nt{padding:12px}.nt-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.nt-item{grid-template-columns:36px 1fr}.nt-actions{grid-column:1/-1;justify-content:flex-start}}
`;
