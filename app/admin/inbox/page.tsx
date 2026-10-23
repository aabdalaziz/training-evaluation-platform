'use client';

// صندوق رسائل البوابة (أَثَر) — قراءة ومعالجة رسائل «تواصل معنا»
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { CONTACT_SUBJECTS, t } from '../../../lib/portal/content';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Msg = { id: string; created_at: string; name: string; email: string; phone: string | null; organization: string | null; subject: string; message: string; lang: string; page: string | null; status: string; handled_at: string | null; notes: string | null };
type Filter = 'new' | 'handled' | 'spam' | 'all';
const fmt = (iso: string) => new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
const subjectLabel = (v: string) => { const s = CONTACT_SUBJECTS.find(x => x.value === v); return s ? t(s.label, 'ar') : v; };

export default function InboxPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [rows, setRows] = useState<Msg[]>([]); const [filter, setFilter] = useState<Filter>('new');
  const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState('');
  const [counts, setCounts] = useState({ new: 0, handled: 0, spam: 0 });

  async function load() {
    const { data, error: e } = await db.from('portal_contact_messages').select('*').order('created_at', { ascending: false }).limit(300);
    if (e) { setError(e.message); return; }
    const all = (data || []) as Msg[];
    setCounts({ new: all.filter(r => r.status === 'new').length, handled: all.filter(r => r.status === 'handled').length, spam: all.filter(r => r.status === 'spam').length });
    setRows(all);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/inbox'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(id: string, status: 'new' | 'handled' | 'spam') {
    setBusy(id);
    const { data: { user } } = await db.auth.getUser();
    const patch = status === 'new' ? { status, handled_by: null, handled_at: null } : { status, handled_by: user?.id || null, handled_at: new Date().toISOString() };
    const { error: e } = await db.from('portal_contact_messages').update(patch).eq('id', id);
    if (e) setError(e.message); else await load();
    setBusy('');
  }

  const shown = rows.filter(r => filter === 'all' || r.status === filter);
  if (!ready) return <div className="ib"><style>{CSS}</style><div className="ib-wrap"><div className="ib-card">{error ? <span className="ib-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="ib"><style>{CSS}</style>
      <div className="ib-wrap">
        <header className="ib-head">
          <div><span className="ib-kicker"><Icon name="inbox" size={14} /> بوابة أَثَر</span><h1>صندوق رسائل التواصل</h1><p>رسائل الزوار من صفحة «تواصل معنا» — عالجها ثم علّمها كمُنجزة.</p></div>
          <div className="ib-acts"><Link href="/" className="ib-btn ghost" target="_blank"><Icon name="globe" size={15} /> فتح البوابة</Link><Link href="/dashboard" className="ib-btn ghost"><Icon name="dashboard" size={15} /> لوحة القيادة</Link></div>
        </header>
        {error && <div className="ib-err">{error}</div>}
        <div className="ib-tabs">
          {([['new', `جديدة (${counts.new})`], ['handled', `منجزة (${counts.handled})`], ['spam', `مزعجة (${counts.spam})`], ['all', 'الكل']] as [Filter, string][]).map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        {shown.length === 0 && <div className="ib-card ib-empty">لا توجد رسائل في هذا التصنيف.</div>}
        {shown.map(r => (
          <article key={r.id} className={`ib-card ib-msg ${r.status}`}>
            <div className="ib-row" onClick={() => setOpen(open === r.id ? null : r.id)} role="button" tabIndex={0}>
              <div className="ib-who"><b>{r.name}</b><span dir="ltr">{r.email}</span>{r.organization && <span>· {r.organization}</span>}</div>
              <div className="ib-meta"><span className="ib-tag">{subjectLabel(r.subject)}</span><span className="ib-tag soft">{r.lang === 'en' ? 'EN' : 'عربي'}</span><bdi>{fmt(r.created_at)}</bdi></div>
            </div>
            {open === r.id && (
              <div className="ib-body">
                <p>{r.message}</p>
                <div className="ib-details">
                  {r.phone && <span><Icon name="chat" size={13} /> <bdi>{r.phone}</bdi></span>}
                  {r.page && <span><Icon name="link" size={13} /> <bdi>{r.page}</bdi></span>}
                  {r.handled_at && <span><Icon name="check" size={13} /> عولجت <bdi>{fmt(r.handled_at)}</bdi></span>}
                </div>
                <div className="ib-acts">
                  <a className="ib-btn" href={`mailto:${r.email}?subject=${encodeURIComponent('رد من بوابة أَثَر: ' + subjectLabel(r.subject))}`}><Icon name="mail" size={15} /> الرد بالبريد</a>
                  {r.status !== 'handled' && <button type="button" className="ib-btn ok" disabled={busy === r.id} onClick={() => setStatus(r.id, 'handled')}><Icon name="check" size={15} /> تمّت المعالجة</button>}
                  {r.status !== 'spam' && <button type="button" className="ib-btn ghost" disabled={busy === r.id} onClick={() => setStatus(r.id, 'spam')}><Icon name="flag" size={15} /> مزعجة</button>}
                  {r.status !== 'new' && <button type="button" className="ib-btn ghost" disabled={busy === r.id} onClick={() => setStatus(r.id, 'new')}><Icon name="refresh" size={15} /> إعادة إلى جديدة</button>}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.ib{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.ib-wrap{max-width:980px;margin:0 auto;display:grid;gap:12px}
.ib-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.ib-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.ib-head p{margin:0;color:#64748b;font-size:14px}
.ib-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.ib-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.ib-empty{text-align:center;color:#64748b}
.ib-tabs{display:flex;gap:6px;flex-wrap:wrap}.ib-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;color:#334155}.ib-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.ib-msg.new{border-inline-start:4px solid #0b8a83}.ib-msg.handled{opacity:.85}.ib-msg.spam{opacity:.6}
.ib-row{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}.ib-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:14px}.ib-who b{color:#0f2a4e;font-size:15px}.ib-who span{color:#64748b;font-size:13px}
.ib-meta{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#64748b;flex-wrap:wrap}
.ib-tag{background:#eff6ff;color:#1e40af;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900}.ib-tag.soft{background:#f1f5f9;color:#334155}
.ib-body{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px}.ib-body p{white-space:pre-wrap;line-height:1.9;font-size:14.5px;color:#0f172a;margin:0 0 10px}
.ib-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#64748b;margin-bottom:12px}.ib-details span{display:inline-flex;gap:5px;align-items:center}
.ib-acts{display:flex;gap:8px;flex-wrap:wrap}
.ib-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.ib-btn.ok{background:#0b8a83;border-color:#0b8a83}.ib-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.ib-btn:disabled{opacity:.6}
.ib-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
`;
