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

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
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

  if (!ready) return <div className="nt rm-page" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const lastRun = runs[0];

  return (
    <div className="nt rm-page" dir="rtl">
      <style>{CSS}</style>
      <RoomHead
        title={<>مركز الإشعارات</>}
        desc={<><p>تنبيهات تلقائية من قواعد الجودة: حملات متابعة ناقصة أو صامتة، جلسات حضور لم تُغلق، شهادات لم تُصدر، قياس بعدي معطّل، نقل أثر ضعيف، وبرامج تجاوزت موعدها. يُفحص يوميًا 06:00 صباحًا ويمكن فحصه الآن.</p></>}
        actions={<>
          {canWrite && <button className="rm-btn primary" disabled={busy} onClick={scanNow}><Icon name="refresh" size={16} /> {busy ? 'جارٍ الفحص…' : 'فحص الآن'}</button>}
        </>}
      />
      {error && <div className="rm-alert bad">{error}</div>}
      {msg && <div className="rm-alert ok">{msg}</div>}

      <section className="rm-kpis">
        <button className={`rm-kpi ${sev === 'critical' ? 'on' : ''} critical`} onClick={() => setSev(sev === 'critical' ? '' : 'critical')}><span>حرج</span><b>{bySev.critical}</b></button>
        <button className={`rm-kpi ${sev === 'warn' ? 'on' : ''} warn`} onClick={() => setSev(sev === 'warn' ? '' : 'warn')}><span>تنبيه</span><b>{bySev.warn}</b></button>
        <button className={`rm-kpi ${sev === 'info' ? 'on' : ''} info`} onClick={() => setSev(sev === 'info' ? '' : 'info')}><span>معلومة</span><b>{bySev.info}</b></button>
        <div className="rm-kpi plain"><span>آخر فحص</span><b>{lastRun && now ? timeAgo(lastRun.ran_at, now) : '—'}</b><small>{lastRun ? `${lastRun.source === 'cron' ? 'تلقائي' : 'يدوي'} · +${lastRun.inserted} / حُلّ ${lastRun.resolved}` : 'لم يُنفَّذ بعد'}</small></div>
      </section>

      <section className="rm-card">
        <div className="nt-toolbar">
          <div className="nt-seg">
            <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>المفتوحة <i>{open.length}</i></button>
            <button className={tab === 'unread' ? 'on' : ''} onClick={() => setTab('unread')}>غير المقروءة <i>{open.filter(n => !n.read_at).length}</i></button>
            <button className={tab === 'resolved' ? 'on' : ''} onClick={() => setTab('resolved')}>المحلولة <i>{list.filter(n => n.resolved_at).length}</i></button>
          </div>
          <select value={kind} onChange={e => setKind(e.target.value)}><option value="">كل الأنواع</option>{kinds.map(k => <option key={k} value={k}>{kindLabel(k)} · {k}</option>)}</select>
          <div className="nt-spacer" />
          {tab !== 'resolved' && <button className="rm-btn small" disabled={!shown.some(n => !n.read_at)} onClick={() => setRead(shown.filter(n => !n.read_at).map(n => n.id), true)}><Icon name="check" size={14} /> تعليم الكل كمقروء</button>}
          {canWrite && tab !== 'resolved' && <button className="rm-btn small" disabled={!shown.length} onClick={() => { if (confirm(`حلّ ${shown.length} إشعارًا يدويًا؟`)) resolve(shown.map(n => n.id), true); }}><Icon name="x" size={14} /> حلّ الكل</button>}
        </div>

        {!shown.length && <div className="rm-empty"><Icon name="check" size={32} /><b>{tab === 'resolved' ? 'لا توجد إشعارات محلولة' : 'كل شيء على ما يرام'}</b><span>{tab === 'resolved' ? '' : 'لا توجد إشعارات مفتوحة تطابق الفلتر الحالي.'}</span></div>}
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
                {n.href && <Link href={n.href} className="rm-btn small primary" onClick={() => setRead([n.id], true)}><Icon name="arrow" size={14} /> فتح</Link>}
                {!n.resolved_at && (n.read_at ? <button className="rm-btn small" onClick={() => setRead([n.id], false)}>غير مقروء</button> : <button className="rm-btn small" onClick={() => setRead([n.id], true)}><Icon name="check" size={14} /> مقروء</button>)}
                {canWrite && (n.resolved_at ? <button className="rm-btn small" onClick={() => resolve([n.id], false)}><Icon name="refresh" size={14} /> إعادة فتح</button> : <button className="rm-btn small" onClick={() => resolve([n.id], true)}><Icon name="x" size={14} /> حلّ</button>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rm-card nt-rules">
        <h3><Icon name="settings" size={16} /> القواعد المفعّلة</h3>
        <ul>
          <li><b>متابعة الأثر:</b> برنامج ينتهي خلال 14 يومًا أو انتهى خلال 45 يومًا بلا حملة متابعة · حملة أُرسلت قبل 7 أيام بلا استجابات · حملة يدوية بلغ موعدها.</li>
          <li><b>الحضور:</b> جلسة ما زالت مفتوحة بعد يومها.</li>
          <li><b>الشهادات:</b> برنامج انتهى وله حضور مسجّل ولم تُصدر له شهادات خلال 60 يومًا.</li>
          <li><b>قياس الأثر:</b> البرنامج انتهى والقياس البعدي ما زال مغلقًا.</li>
          <li><b>نقل الأثر (حرج):</b> متوسط تقدير المشرفين أقل من 60% عبر 3 تقييمات فأكثر.</li>
          <li><b>البرامج:</b> برنامج «نشط» تجاوز تاريخ نهايته بأكثر من 7 أيام.</li>
        </ul>
        <p className="rm-muted">تُحلّ الإشعارات تلقائيًا عند زوال سببها، وتعود للظهور إن تكرر. بريد ملخص يصل لمديري المنصة عند ظهور إشعارات جديدة في الفحص اليومي (يمكن تخصيص المستلمين عبر المتغير <code>NOTIFY_EMAILS</code>).</p>
      </section>
    </div>
  );
}

const CSS = `
.nt{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626}
.nt *{box-sizing:border-box}.rm-btn.small{padding:6px 10px;font-size:12px}
.rm-kpi.critical b{color:#D4614A}.rm-kpi.plain{cursor:default}
.nt-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.nt-spacer{flex:1}
.nt-seg{display:inline-flex;border:1px solid #D9CBC2;border-radius:10px;overflow:hidden}.nt-seg button{border:0;background:#fff;padding:8px 12px;font:inherit;font-size:12.5px;font-weight:800;color:#5C4858;cursor:pointer;display:inline-flex;gap:6px;align-items:center}.nt-seg button.on{background:#3A1F36;color:#fff}.nt-seg i{font-style:normal;background:rgba(0,0,0,.08);border-radius:999px;padding:0 7px;font-size:11px}.nt-seg button.on i{background:rgba(255,255,255,.2)}
.nt select{border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px;font:inherit;font-size:12.5px;font-weight:700;background:#fff}
.nt-list{display:flex;flex-direction:column;gap:8px}
.nt-item{display:grid;grid-template-columns:40px 1fr auto;gap:12px;align-items:start;border:1px solid #EADFD6;border-radius:12px;padding:12px 14px;border-inline-start:4px solid #D9CBC2}
.nt-item.critical{border-inline-start-color:#D4614A}.nt-item.warn{border-inline-start-color:#8A5A1E}.nt-item.info{border-inline-start-color:#D4614A}
.nt-item.unread{background:#FBF4EE}.nt-item.resolved{opacity:.7}
.nt-ic{width:40px;height:40px;border-radius:10px;background:#F3E6DC;display:flex;align-items:center;justify-content:center;color:#3A1F36}
.nt-body{min-width:0}.nt-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.nt-title b{font-size:14px;color:#3A1F36}
.nt-body p{margin:4px 0 0;font-size:13px;color:#4A3645;line-height:1.7}.nt-body small{display:block;margin-top:4px;font-size:11.5px;color:#B3A5AE;font-weight:700}
.nt-sev{font-size:10.5px;font-weight:900;border-radius:999px;padding:2px 8px}.nt-sev.critical{background:#FBEDE7;color:#B9544A}.nt-sev.warn{background:#FBF4EE;color:#8A5A1E}.nt-sev.info{background:#E6F3F1;color:#2F6B66}
.nt-kind{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px;background:#F6EBE0;color:#5C4858}
.nt-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.nt-rules h3{margin:0 0 8px;font-size:14px;color:#3A1F36;display:flex;gap:8px;align-items:center}.nt-rules ul{margin:0;padding:0 18px 0 0;font-size:13px;line-height:1.9;color:#4A3645}.nt-rules code{background:#F6EBE0;padding:1px 6px;border-radius:6px;direction:ltr;display:inline-block}
@media(max-width:900px){.nt{}.nt-item{grid-template-columns:36px 1fr}.nt-actions{grid-column:1/-1;justify-content:flex-start}}
`;
