'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/rehearsals — «التمرين التبادلي بين الممارسين» للطاقم (P45 «بروفة»)
 *  الطلبات المفتوحة بلا قابل · البلاغات · الأدوار الأكثر طلبًا (بالكلمات) · من طلب ومن لعب (للطاقم فقط) · حذف
 *  لا يرى الطاقم الجملتين الخاصتين؛ لا نصّ من الغرفة محفوظ أصلًا.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { P45_NAMES_AR, ROOM_MINUTES, NOW_HOURS, SCHEDULE_DAYS, PUBLIC_K } from '../../../lib/rehearsal/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso?: string | null) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '—');

export default function AdminRehearsalsPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [filter, setFilter] = useState('all');
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/rehearsals?admin=1', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action + (body.id || '')); setError(''); setOk(''); try { const j = await fetch('/api/rehearsals', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); await load(); setOk(j.note_ar || 'تم'); } catch (e: any) { setError(e.message || 'فشل'); } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/rehearsals'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items: any[] = data?.items || []; const ST: Record<string, string> = data?.status_ar || {};
  const counts = items.reduce((m: Record<string, number>, n) => { m[n.status] = (m[n.status] || 0) + 1; return m; }, {});
  const list = items.filter(n => filter === 'all' ? ['open', 'accepted', 'reported'].includes(n.status) : n.status === filter);
  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="users" size={14} /> بوابة أَثَر · P45</span><h1>{P45_NAMES_AR.phase} — {P45_NAMES_AR.official}</h1><p>ممارس يطلب بروفة لموقف يخشاه، زميل يقبل ويلعب الدور الآخر، {ROOM_MINUTES} دقيقة في غرفة أَثَر بلا تسجيل وبلا ذكاء اصطناعي، ثم جملة طيبة للآخر وجملة خاصة «ما سأفعله مختلفًا». الطلب «الآن» يبقى {NOW_HOURS === 2 ? 'ساعتين' : `${NOW_HOURS} ساعات`} والموعد خلال {SCHEDULE_DAYS} أيام. الطاقم لا يتدخّل في القبول ولا يرى الجمل الخاصة؛ يرى البلاغات والطلبات التي لم تجد من يلعب الدور. العام k≥{PUBLIC_K}.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/rehearsals': (counts.reported || 0) }} />
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        <div className="am-kpis" data-testid="ar-kpis"><span className="g"><b>{counts.open || 0}</b> تنتظر من يلعب الدور</span><span><b>{counts.accepted || 0}</b> في غرفها</span><span><b>{counts.done || 0}</b> تمّت</span><span><b>{counts.expired || 0}</b> لم تجد أحدًا</span><span className={counts.reported ? 'r' : ''}><b>{counts.reported || 0}</b> بلاغات</span></div>
        {(data?.top_roles || []).length > 0 && <div className="am-card ar-roles" data-testid="ar-roles"><b>الأدوار الأكثر طلبًا</b> — {data.top_roles.map((t: any) => `«${t.role}» (${t.n})`).join(' · ')}<small>هذه الأدوار مادة جاهزة لـ«كل يوم مهارة» ولـ«ما يحتاجه الممارسون».</small></div>}
        <div className="an-filters" role="group" aria-label="الحالة">{['all', 'open', 'accepted', 'done', 'expired', 'cancelled', 'reported'].map(k => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} data-testid={`ar-f-${k}`}>{k === 'all' ? 'الحيّة' : ST[k] || k} {k !== 'all' && counts[k] ? <i>{counts[k]}</i> : null}</button>)}</div>
        {list.length === 0 && <div className="am-card am-empty" data-testid="ar-empty">لا بروفات هنا. تأتي من <Link href="/me/rehearsal" target="_blank" rel="noreferrer">/me/rehearsal</Link> (الممارسون) · من بطاقات الحاجات في /needs · ومن محطات «الشهادة التي تكبر» قبل كتابتها.</div>}
        {list.map(n => <section key={n.id} className={`am-card an-card st-${n.status}`} data-testid="ar-item" data-status={n.status}>
          <div className="an-top"><span className="an-sector">{n.sector_ar}</span><span className="an-src">{n.mode === 'now' ? 'الآن' : `موعد ${fmt(n.scheduled_at)}`} · {n.circle === 'all' ? 'أي ممارس' : n.circle === 'faculty' ? 'هيئة' : n.circle === 'program' ? 'زملاء برنامج' : 'من أعلنوا الحاجة'}</span><span className={`an-status ${n.status}`}>{ST[n.status] || n.status}</span></div>
          <p className="an-text">{n.situation_ar}</p>
          <p className="an-meta">الدور المطلوب: <b>{n.other_role_ar}</b>{n.my_role_ar ? ` · دور الطالب: ${n.my_role_ar}` : ''} · طلبها <bdi>{n.name_ar}</bdi> ({n.email}) · {fmt(n.created_at)}{n.partner_email ? <> · يلعب الدور <bdi>{n.partner_name_ar}</bdi> ({n.partner_email}) {fmt(n.accepted_at)}</> : null}{n.room_code ? <> · الغرفة <bdi>{n.room_code}</bdi></> : null}{n.done_at ? ` · تمّت ${fmt(n.done_at)}` : ''}{n.how_went ? ` · كيف مرّ: ${n.how_went === 'as_planned' ? 'قريبًا مما جرّب' : n.how_went === 'stumbled' ? 'تعثّر' : 'لم يقع بعد'}` : ''}{n.reported_at ? ` · بلاغ ${fmt(n.reported_at)}` : ''}</p>
          <div className="an-acts">
            {n.room_code && n.status === 'accepted' && <Link className="am-btn small ghost" href={`/room/${n.room_code}`} target="_blank" rel="noreferrer">الغرفة ↗</Link>}
            <button type="button" className="am-btn small danger" disabled={!!busy} onClick={() => { if (window.confirm('حذف نهائي للبروفة وجملتيها؟')) post({ action: 'delete', id: n.id }); }} data-testid="ar-delete">حذف</button>
          </div>
        </section>)}
      </div>
    </div>
  );
}

const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;min-width:0}.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}
.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:8px;flex-wrap:wrap}.am-kpis span{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:13px;color:#475569}.am-kpis b{color:#0f2a4e;font-size:18px;margin-inline-end:4px}.am-kpis .g b{color:#0b8a83}.am-kpis .r{border-color:#fecaca}.am-kpis .r b{color:#991b1b}
.am-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:10px;padding:8px 12px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none}.am-btn.small{padding:6px 10px;font-size:12.5px}.am-btn.ghost{background:#fff;color:#0f2a4e}.am-btn.danger{background:#fff;color:#991b1b;border-color:#fecaca}.am-btn:disabled{opacity:.5;cursor:default}
.ar-roles{font-size:14px;color:#334155;line-height:1.8}.ar-roles b{color:#0f2a4e}.ar-roles small{display:block;color:#64748b;font-size:12.5px}
.an-filters{display:flex;gap:6px;flex-wrap:wrap}.an-filters button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}.an-filters button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.an-filters i{font-style:normal;font-weight:900;margin-inline-start:4px}
.an-card{border-inline-start:4px solid #cbd5e1}.an-card.st-open{border-inline-start-color:#0b8a83}.an-card.st-accepted{border-inline-start-color:#c9a24b}.an-card.st-done{border-inline-start-color:#0f2a4e}.an-card.st-reported{border-inline-start-color:#b91c1c}.an-card.st-expired,.an-card.st-cancelled{opacity:.7}
.an-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12.5px}.an-sector{background:#eef2f8;color:#0f2a4e;border-radius:999px;padding:2px 10px;font-weight:800}.an-src{color:#475569}.an-status{margin-inline-start:auto;font-weight:800;color:#64748b}.an-status.open{color:#0b8a83}.an-status.accepted{color:#9a7524}.an-status.done{color:#0f2a4e}.an-status.reported{color:#b91c1c}
.an-text{font-size:16px;line-height:1.8;margin:8px 0 4px;color:#0f172a}.an-meta{margin:0;font-size:12.5px;color:#64748b;line-height:1.8}.an-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
@media (max-width:640px){.an-status{margin-inline-start:0}}
`;
