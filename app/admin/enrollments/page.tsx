'use client';

// بوابة أَثَر — طلبات التسجيل (مراجعة · قبول · انتظار · اعتذار · تصدير)
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { statusLabel, enrollmentsSheet, seatsLeft } from '../../../lib/portal/catalog';
import type { Enrollment, EnrollStatus, CatalogProgram, Counts } from '../../../lib/portal/catalog';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
type Row = Enrollment & { program_name?: string };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const FILTERS: { k: EnrollStatus | 'all'; l: string }[] = [{ k: 'pending', l: 'قيد المراجعة' }, { k: 'approved', l: 'مقبول' }, { k: 'waitlisted', l: 'قائمة الانتظار' }, { k: 'rejected', l: 'معتذر' }, { k: 'cancelled', l: 'ملغى' }, { k: 'all', l: 'الكل' }];

export default function EnrollmentsPage() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [rows, setRows] = useState<Row[]>([]); const [programs, setPrograms] = useState<CatalogProgram[]>([]); const [counts, setCounts] = useState<Counts[]>([]);
  const [filter, setFilter] = useState<EnrollStatus | 'all'>('pending'); const [prog, setProg] = useState('all'); const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState('');

  async function load() {
    const [{ data: e, error: e1 }, { data: p }, { data: c }] = await Promise.all([
      db.from('portal_enrollments').select('*').order('created_at', { ascending: false }).limit(1000),
      db.from('programs').select('id,name_ar,name_en,seats,status,start_date,end_date,registration_open,archived_at').is('archived_at', null).order('start_date', { ascending: false }),
      db.rpc('portal_enrollment_counts'),
    ]);
    if (e1) { setError(e1.message); return; }
    const ps = (p || []) as CatalogProgram[]; setPrograms(ps); setCounts((c || []) as Counts[]);
    setRows(((e || []) as Enrollment[]).map(r => ({ ...r, program_name: ps.find(x => x.id === r.program_id)?.name_ar || r.program_id })));
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/enrollments'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(id: string, status: EnrollStatus) {
    setBusy(id); setError(''); setNotice('');
    const { data: s } = await db.auth.getSession();
    const res = await fetch('/api/enrollments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'decide', id, status, note: note.trim() || null }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.success) setError(j.error || `HTTP ${res.status}`);
    else { setNotice(j.mail_error ? `تم تحديث الحالة، لكن تعذّر إرسال البريد: ${j.mail_error}` : (status === 'pending' ? 'أُعيد الطلب إلى المراجعة.' : 'تم تحديث الحالة وإرسال البريد للمتقدّم.')); setNote(''); setOpen(null); await load(); }
    setBusy('');
  }

  const tally = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.k, f.k === 'all' ? rows.length : rows.filter(r => r.status === f.k).length])), [rows]);
  const shown = rows.filter(r => (filter === 'all' || r.status === filter) && (prog === 'all' || r.program_id === prog) && (!q.trim() || `${r.full_name} ${r.email} ${r.phone || ''} ${r.organization || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const exportXlsx = () => downloadXlsx(safeFilename('athar_enrollments', 'xlsx'), [enrollmentsSheet(shown)]);

  if (!ready) return <div className="en"><style>{CSS}</style><div className="en-wrap"><div className="en-card">{error ? <span className="en-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="en"><style>{CSS}</style>
      <div className="en-wrap">
        <header className="en-head"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>طلبات التسجيل</h1><p>كل طلب يحتاج قرارًا من الإدارة؛ عند القرار يُرسل بريد تلقائي للمتقدّم.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/enrollments': tally.pending }} />
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}

        <div className="en-card en-seats">
          {programs.filter(p => counts.some(c => c.program_id === p.id)).map(p => { const c = counts.find(x => x.program_id === p.id); const left = seatsLeft(p, c); return (
            <button type="button" key={p.id} className={`en-seat ${prog === p.id ? 'on' : ''}`} onClick={() => setProg(prog === p.id ? 'all' : p.id)}>
              <b>{p.name_ar}</b><span>مقبول {c?.approved || 0}{p.seats ? ` / ${p.seats}` : ''} · انتظار {c?.waitlisted || 0} · مراجعة {c?.pending || 0}{left !== null ? ` · متاح ${left}` : ''}</span>
            </button>); })}
          {counts.length === 0 && <span className="en-muted">لا توجد طلبات بعد.</span>}
        </div>

        <div className="en-tools">
          <div className="en-tabs">{FILTERS.map(f => <button type="button" key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>{f.l} ({tally[f.k]})</button>)}</div>
          <select value={prog} onChange={e => setProg(e.target.value)}><option value="all">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد…" />
          <button type="button" className="en-btn ghost" onClick={exportXlsx} disabled={!shown.length}><Icon name="download" size={15} /> Excel ({shown.length})</button>
        </div>

        {shown.length === 0 && <div className="en-card en-muted" style={{ textAlign: 'center' }}>لا توجد طلبات في هذا التصنيف.</div>}
        {shown.map(r => (
          <article key={r.id} className={`en-card en-row ${r.status}`}>
            <div className="en-top" role="button" tabIndex={0} onClick={() => { setOpen(open === r.id ? null : r.id); setNote(''); }}>
              <div className="en-who"><b>{r.full_name}</b><span dir="ltr">{r.email}</span><span dir="ltr">{r.phone}</span>{r.organization && <span>· {r.organization}</span>}</div>
              <div className="en-meta"><span className="en-prog">{r.program_name}</span><span className={`en-tag ${r.status}`}>{statusLabel(r.status, 'ar')}</span><bdi>{fmt(r.created_at)}</bdi></div>
            </div>
            {open === r.id && (
              <div className="en-body">
                {r.notes && <p><b>ملاحظات المتقدّم:</b> {r.notes}</p>}
                <div className="en-details">{r.city && <span>المدينة: {r.city}</span>}<span>اللغة: {r.lang === 'en' ? 'English' : 'عربي'}</span>{r.decided_at && <span>القرار: <bdi>{fmt(r.decided_at)}</bdi></span>}{r.notified_at && <span>آخر بريد: <bdi>{fmt(r.notified_at)}</bdi></span>}{r.decision_note && <span>ملاحظة القرار: {r.decision_note}</span>}</div>
                <label className="en-note">ملاحظة تُرفق ببريد القرار (اختياري)<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="مثال: موعد الدفع، رابط المجموعة، سبب الاعتذار…" /></label>
                <div className="en-acts">
                  {r.status !== 'approved' && <button type="button" className="en-btn ok" disabled={busy === r.id} onClick={() => decide(r.id, 'approved')}><Icon name="check" size={15} /> قبول</button>}
                  {r.status !== 'waitlisted' && <button type="button" className="en-btn warn" disabled={busy === r.id} onClick={() => decide(r.id, 'waitlisted')}><Icon name="clock" size={15} /> قائمة الانتظار</button>}
                  {r.status !== 'rejected' && <button type="button" className="en-btn ghost" disabled={busy === r.id} onClick={() => decide(r.id, 'rejected')}><Icon name="x" size={15} /> اعتذار</button>}
                  {r.status !== 'pending' && <button type="button" className="en-btn ghost" disabled={busy === r.id} onClick={() => decide(r.id, 'pending')}><Icon name="refresh" size={15} /> إعادة للمراجعة</button>}
                  <a className="en-btn ghost" href={`mailto:${r.email}?subject=${encodeURIComponent('بخصوص تسجيلك في: ' + (r.program_name || ''))}`}><Icon name="mail" size={15} /> بريد يدوي</a>
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
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-seats{display:flex;gap:8px;flex-wrap:wrap}.en-seat{text-align:start;border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:8px 12px;font:inherit;cursor:pointer;display:grid;gap:2px}.en-seat.on{border-color:#0b8a83;background:#f0fdfa}.en-seat b{font-size:13px;color:#0f2a4e}.en-seat span{font-size:11.5px;color:#64748b}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.en-tools select,.en-tools input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff}.en-tools input{min-width:200px}
.en-row.pending{border-inline-start:4px solid #2563eb}.en-row.approved{border-inline-start:4px solid #059669}.en-row.waitlisted{border-inline-start:4px solid #d97706}.en-row.rejected,.en-row.cancelled{opacity:.75}
.en-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}.en-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#64748b}.en-who b{color:#0f2a4e;font-size:15px}
.en-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#64748b}.en-prog{font-weight:800;color:#334155;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.en-tag{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#f1f5f9;color:#475569}.en-tag.pending{background:#eff6ff;color:#1e40af}.en-tag.approved{background:#ecfdf5;color:#065f46}.en-tag.waitlisted{background:#fff7ed;color:#9a3412}
.en-body{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;display:grid;gap:10px}.en-body p{margin:0;font-size:14px;line-height:1.8;color:#0f172a}
.en-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#64748b}
.en-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.en-note textarea{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;min-height:60px;resize:vertical}
.en-acts{display:flex;gap:8px;flex-wrap:wrap}
.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ok{background:#059669;border-color:#059669}.en-btn.warn{background:#d97706;border-color:#d97706}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
`;
