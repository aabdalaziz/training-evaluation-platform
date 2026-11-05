'use client';
/**
 * P39 «إشعارات المتعلّم» — جرس «تنبيهاتي» في رأس أَثَر + قائمة كاملة في «أنا»
 *  - الجرس يظهر للمسجَّل فقط؛ يقرأ /api/notices كل 90 ثانية (خفيف) ويعرض عدد غير المقروء.
 *  - الفتح يعلّم المعروض مقروءًا (بعد ثانيتين) — بلا صفحة جديدة: لوحة منسدلة بقائمة وروابط.
 *  - لا بيانات شخصية في النصوص (الإشعارات نفسها بلا درجات).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sbLazy } from '../../lib/supabase/lazy';

type Notice = { id: string; kind: string; kind_ar: string; icon: string; title_ar: string; body_ar: string; url: string | null; pushed: boolean; read_at: string | null; created_at: string };
type Payload = { unread: number; notices: Notice[] };

async function hdr(): Promise<Record<string, string>> { try { const db = await sbLazy(); const { data } = await db.auth.getSession(); const tk = data.session?.access_token; return { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }; } catch { return { 'Content-Type': 'application/json' }; } }
async function load(limit = 20): Promise<Payload | null> { try { const h = await hdr(); if (!h.Authorization) return null; const j = await fetch(`/api/notices?limit=${limit}`, { headers: h, cache: 'no-store' }).then((r) => r.json()); return j?.success ? { unread: Number(j.unread) || 0, notices: j.notices || [] } : null; } catch { return null; } }
async function markRead(ids: string[] | 'all'): Promise<void> { try { const h = await hdr(); await fetch('/api/notices', { method: 'POST', headers: h, body: JSON.stringify(ids === 'all' ? { action: 'read', all: true } : { action: 'read', ids }) }); } catch { /* تجاهل */ } }
const when = (iso: string, ar: boolean) => { try { return new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(0, 16); } };

export function NoticeItem({ n, ar, onOpen }: { n: Notice; ar: boolean; onOpen?: () => void }) {
  return <li className={`nt-item ${n.read_at ? '' : 'unread'}`} data-testid="nt-item" data-kind={n.kind} data-read={n.read_at ? '1' : '0'}>
    <span className="nt-ic" aria-hidden="true">{n.icon}</span>
    <div className="nt-body"><b>{n.title_ar}</b>{n.body_ar && <p>{n.body_ar}</p>}<small>{n.kind_ar} · {when(n.created_at, ar)}{n.pushed ? (ar ? ' · وصلك إشعارًا' : ' · pushed') : ''}</small></div>
    {n.url && <a className="nt-open" href={n.url} onClick={onOpen}>{ar ? 'افتح' : 'Open'}</a>}
  </li>;
}

/** الجرس في الرأس (للمسجَّل) */
export function NoticesBell({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar'; const [d, setD] = useState<Payload | null>(null); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refresh = useCallback(() => { load(10).then((p) => p && setD(p)); }, []);
  useEffect(() => { refresh(); const iv = setInterval(refresh, 90000); const onVis = () => { if (document.visibilityState === 'visible') refresh(); }; document.addEventListener('visibilitychange', onVis); return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); }; }, [refresh]);
  useEffect(() => { if (!open) return; const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey); return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); }; }, [open]);
  useEffect(() => { if (!open || !d || !d.unread) return; const ids = d.notices.filter((n) => !n.read_at).map((n) => n.id); if (!ids.length) return; timer.current = setTimeout(async () => { await markRead(ids); setD((x) => x ? { unread: Math.max(0, x.unread - ids.length), notices: x.notices.map((n) => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n) } : x); }, 2000); return () => { if (timer.current) clearTimeout(timer.current); }; }, [open, d]);
  if (!d) return null;
  return <div className="nt-wrap" ref={ref}>
    <button type="button" className={`nt-bell ${d.unread ? 'has' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ar ? `تنبيهاتي${d.unread ? ` — ${d.unread} جديد` : ''}` : `My alerts${d.unread ? ` — ${d.unread} new` : ''}`} title={ar ? 'تنبيهاتي' : 'My alerts'} data-testid="nt-bell" data-unread={d.unread}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {d.unread > 0 && <b data-testid="nt-count">{d.unread > 9 ? '9+' : d.unread}</b>}
    </button>
    {open && <div className="nt-pop" role="dialog" aria-label={ar ? 'تنبيهاتي' : 'My alerts'} data-testid="nt-pop">
      <div className="nt-pophead"><b>{ar ? 'تنبيهاتي' : 'My alerts'}</b>{d.unread > 0 && <button type="button" className="nt-link" onClick={async () => { await markRead('all'); refresh(); }} data-testid="nt-readall">{ar ? 'اعتبرها كلّها مقروءة' : 'Mark all read'}</button>}</div>
      {d.notices.length === 0 ? <p className="nt-empty">{ar ? 'لا تنبيهات بعد — حين يصدر حكمك في مِعيار أو تُفتح لك إعادة أو تُحجز لك جلسة، ستجدها هنا.' : 'No alerts yet — verdicts, retakes and sessions will show up here.'}</p>
        : <ul className="nt-list">{d.notices.map((n) => <NoticeItem key={n.id} n={n} ar={ar} onOpen={() => setOpen(false)} />)}</ul>}
      <a className="nt-all" href="/me#notices" onClick={() => setOpen(false)}>{ar ? 'كل تنبيهاتي في «أنا»' : 'All alerts in “Me”'}</a>
    </div>}
  </div>;
}

/** القائمة الكاملة داخل «أنا» */
export default function NoticesCard() {
  const [d, setD] = useState<Payload | null | undefined>(undefined);
  useEffect(() => { load(50).then((p) => setD(p)); }, []);
  if (d === undefined || d === null) return null;
  return <section className="me-card" id="notices" data-testid="me-notices" data-count={d.notices.length}>
    <style dangerouslySetInnerHTML={{ __html: NOTICES_CSS }} />
    <div className="nt-pophead"><h2 style={{ margin: 0 }}>🔔 تنبيهاتي {d.unread > 0 && <small className="nt-badge">{d.unread} جديد</small>}</h2>{d.unread > 0 && <button type="button" className="nt-link" onClick={async () => { await markRead('all'); setD(await load(50)); }}>اعتبرها كلّها مقروءة</button>}</div>
    <p className="nt-hint">كل ما يخصّك في مِعيار وأَثَر: صدور حكم العبور · إعادة مهارة · جلسة تعويض · ترقية · تسكين. يصلك إشعارًا على جهازك إن فعّلت التذكير، ويبقى هنا دائمًا.</p>
    {d.notices.length === 0 ? <p className="nt-empty">لا تنبيهات بعد.</p> : <ul className="nt-list">{d.notices.map((n) => <NoticeItem key={n.id} n={n} ar />)}</ul>}
  </section>;
}

export const NOTICES_CSS = `
.nt-wrap{position:relative;display:inline-flex}
.nt-bell{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;width:36px;height:36px;cursor:pointer;position:relative;padding:0}
.nt-bell.has{border-color:#0f766e;background:#f0fdfa}
.nt-bell b{position:absolute;top:-5px;inset-inline-end:-5px;background:#dc2626;color:#fff;border-radius:999px;min-width:18px;height:18px;padding:0 5px;font-size:11px;line-height:18px;text-align:center}
.nt-pop{position:absolute;top:calc(100% + 8px);inset-inline-end:0;width:min(380px,92vw);background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 40px rgba(15,42,78,.18);padding:12px;z-index:60;text-align:start}
.nt-pophead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.nt-link{border:0;background:none;color:#0f766e;font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:underline}
.nt-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:60vh;overflow:auto}
.nt-item{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
.nt-item.unread{background:#f0fdfa;border-color:#99f6e4}
.nt-ic{font-size:20px;line-height:1}
.nt-body{flex:1;min-width:0}.nt-body b{display:block;font-size:14px;color:#0f2a4e}.nt-body p{margin:2px 0 0;font-size:13px;color:#334155;line-height:1.6}.nt-body small{color:#64748b;font-size:11px}
.nt-open{align-self:center;font-size:12px;font-weight:800;color:#0f2a4e;border:1px solid #cbd5e1;border-radius:999px;padding:4px 10px;text-decoration:none;white-space:nowrap}
.nt-empty{margin:4px 0;color:#64748b;font-size:13px;line-height:1.7}
.nt-all{display:block;margin-top:10px;text-align:center;font-size:13px;font-weight:800;color:#0f766e}
.nt-badge{background:#dc2626;color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;vertical-align:middle;margin-inline-start:6px}
.nt-hint{margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.7}
`;
