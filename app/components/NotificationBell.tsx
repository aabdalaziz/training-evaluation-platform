'use client';
/**
 * جرس الإشعارات — يظهر في الشريط الإداري وفي لوحة التحكم
 * يقرأ الإشعارات المفتوحة، يعرض آخر 6، ويحدّث كل 5 دقائق
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';
import { kindIcon, openOnes, timeAgo, unreadCount, type Notification } from '../../lib/notifications/model';

export default function NotificationBell({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const db = supabase();
  const [list, setList] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    const { data, error } = await db.from('notifications').select('*').is('resolved_at', null).order('created_at', { ascending: false }).limit(50);
    if (!error) setList((data || []) as Notification[]);
    setNow(new Date());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => { clearInterval(t); document.removeEventListener('mousedown', onDoc); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markRead(n: Notification) {
    if (n.read_at) return;
    setList(l => l.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    const { data: { user } } = await db.auth.getUser();
    await db.from('notifications').update({ read_at: new Date().toISOString(), read_by: user?.id || null }).eq('id', n.id);
  }
  async function markAll() {
    const ids = list.filter(n => !n.read_at).map(n => n.id); if (!ids.length) return;
    setList(l => l.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    const { data: { user } } = await db.auth.getUser();
    await db.from('notifications').update({ read_at: new Date().toISOString(), read_by: user?.id || null }).in('id', ids);
  }

  const unread = unreadCount(list); const top = openOnes(list).slice(0, 6);
  return (
    <div className={`nb ${variant}`} ref={box}>
      <style>{CSS}</style>
      <button type="button" className="nb-btn" aria-label="الإشعارات" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="nb-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="nb-pop" dir="rtl">
          <div className="nb-head"><b>الإشعارات</b>{unread > 0 && <button type="button" className="nb-link" onClick={markAll}>تعليم الكل كمقروء</button>}</div>
          {!top.length && <div className="nb-empty"><Icon name="check" size={22} /> لا توجد إشعارات مفتوحة</div>}
          {top.map(n => (
            <Link key={n.id} href={n.href || '/admin/notifications'} className={`nb-item ${n.severity} ${n.read_at ? '' : 'unread'}`} onClick={() => { markRead(n); setOpen(false); }}>
              <span className="nb-ic"><Icon name={kindIcon(n.kind) as IconName} size={15} /></span>
              <span className="nb-txt"><b>{n.title}</b><small>{now ? timeAgo(n.created_at, now) : ''}</small></span>
            </Link>
          ))}
          <Link href="/admin/notifications" className="nb-all" onClick={() => setOpen(false)}>مركز الإشعارات <Icon name="arrow" size={14} /></Link>
        </div>
      )}
    </div>
  );
}

const CSS = `
.nb{position:relative;display:inline-flex}
.nb-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:1px solid #D9CBC2;background:#fff;color:#3A1F36;cursor:pointer}
.nb.dark .nb-btn{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.18);color:#fff}
.nb-badge{position:absolute;top:-6px;inset-inline-end:-6px;min-width:18px;height:18px;border-radius:999px;background:#D4614A;color:#fff;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 5px;border:2px solid #fff}
.nb-pop{position:absolute;top:calc(100% + 8px);inset-inline-end:0;width:340px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #EADFD6;border-radius:14px;box-shadow:0 18px 40px rgba(42,22,38,.18);z-index:400;overflow:hidden;color:#2A1626;font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif}
.nb-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #F6EBE0;font-size:13.5px}
.nb-link{background:none;border:0;color:#D4614A;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.nb-empty{padding:22px;text-align:center;color:#8E7F8A;font-size:13px;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:6px}
.nb-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid #F6EBE0;text-decoration:none;color:inherit;border-inline-start:3px solid transparent}
.nb-item.unread{background:#FBF4EE}.nb-item.critical{border-inline-start-color:#D4614A}.nb-item.warn{border-inline-start-color:#8A5A1E}.nb-item.info{border-inline-start-color:#D4614A}
.nb-item:hover{background:#F6EBE0}
.nb-ic{width:28px;height:28px;border-radius:8px;background:#F3E6DC;display:flex;align-items:center;justify-content:center;color:#3A1F36;flex-shrink:0}
.nb-txt{display:flex;flex-direction:column;gap:2px;min-width:0}.nb-txt b{font-size:12.5px;line-height:1.5}.nb-txt small{font-size:11px;color:#B3A5AE;font-weight:700}
.nb-all{display:flex;justify-content:center;align-items:center;gap:6px;padding:10px;font-size:12.5px;font-weight:900;color:#3A1F36;text-decoration:none;background:#FBF4EE}
`;
