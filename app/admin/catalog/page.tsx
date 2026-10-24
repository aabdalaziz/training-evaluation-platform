'use client';

// بوابة أَثَر — نشر البرامج في الكتالوج (الرسوم · المقاعد · النوع · فتح/إغلاق التسجيل)
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { TYPES, feeLabel, regState, REG_LABEL, seatsLeft } from '../../../lib/portal/catalog';
import type { CatalogProgram, Counts } from '../../../lib/portal/catalog';
import { t } from '../../../lib/portal/content';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const SELECT = 'id,name_ar,name_en,status,delivery_mode,start_date,end_date,archived_at,fee,currency,seats,program_type,is_public,registration_open,registration_deadline,location_ar,location_en,hours,intro_ar,audience_ar';
type Form = { fee: string; currency: string; seats: string; program_type: string; is_public: boolean; registration_open: boolean; registration_deadline: string; location_ar: string; location_en: string; hours: string };
const toForm = (p: CatalogProgram): Form => ({ fee: p.fee === null || p.fee === undefined ? '' : String(p.fee), currency: p.currency || 'SAR', seats: p.seats ? String(p.seats) : '', program_type: p.program_type || 'course', is_public: p.is_public !== false, registration_open: p.registration_open !== false, registration_deadline: p.registration_deadline || '', location_ar: p.location_ar || '', location_en: p.location_en || '', hours: p.hours ? String(p.hours) : '' });

export default function CatalogAdminPage() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [rows, setRows] = useState<CatalogProgram[]>([]); const [counts, setCounts] = useState<Counts[]>([]);
  const [edit, setEdit] = useState<string | null>(null); const [f, setF] = useState<Form | null>(null); const [busy, setBusy] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    const [{ data, error: e }, { data: c }] = await Promise.all([db.from('programs').select(SELECT).is('archived_at', null).order('start_date', { ascending: false }), db.rpc('portal_enrollment_counts')]);
    if (e) { setError(e.message); return; } setRows((data || []) as CatalogProgram[]); setCounts((c || []) as Counts[]);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/catalog'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(id: string) {
    if (!f) return; setBusy(id); setError(''); setNotice('');
    const fee = f.fee.trim() === '' ? null : Number(f.fee); const seats = f.seats.trim() === '' ? null : parseInt(f.seats, 10); const hours = f.hours.trim() === '' ? null : parseInt(f.hours, 10);
    if (fee !== null && (!isFinite(fee) || fee < 0)) { setError('الرسوم يجب أن تكون رقمًا موجبًا (أو اتركها فارغة = عند التواصل، أو 0 = مجاني).'); setBusy(''); return; }
    if (seats !== null && (!isFinite(seats) || seats < 1)) { setError('عدد المقاعد يجب أن يكون 1 فأكثر، أو اتركه فارغًا = غير محدود.'); setBusy(''); return; }
    const { error: e } = await db.from('programs').update({ fee, currency: f.currency, seats, hours, program_type: f.program_type, is_public: f.is_public, registration_open: f.registration_open, registration_deadline: f.registration_deadline || null, location_ar: f.location_ar.trim() || null, location_en: f.location_en.trim() || null }).eq('id', id);
    if (e) setError(e.message); else { setNotice('تم الحفظ — التغيير ظاهر فورًا في البوابة.'); setEdit(null); setF(null); await load(); }
    setBusy('');
  }
  async function quick(id: string, patch: Partial<CatalogProgram>) { setBusy(id); const { error: e } = await db.from('programs').update(patch).eq('id', id); if (e) setError(e.message); else await load(); setBusy(''); }

  if (!ready) return <div className="ct"><style>{CSS}</style><div className="ct-wrap"><div className="ct-card">{error ? <span className="ct-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="ct"><style>{CSS}</style>
      <div className="ct-wrap">
        <header className="ct-head"><div><span className="ct-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>نشر البرامج في الكتالوج</h1><p>بيانات البرنامج الأساسية (الاسم، المواعيد، الأهداف…) تُحرَّر من لوحة القيادة؛ هنا تضبط ما يخص البوابة: الظهور، الرسوم، المقاعد، النوع، وفتح التسجيل.</p></div></header>
        <PortalAdminTabs />
        {error && <div className="ct-err">{error}</div>}{notice && <div className="ct-ok">{notice}</div>}
        {rows.length === 0 && <div className="ct-card">لا توجد برامج غير مؤرشفة.</div>}
        {rows.map(p => {
          const c = counts.find(x => x.program_id === p.id); const s = regState(p, today, c); const left = seatsLeft(p, c); const editing = edit === p.id && f;
          return (
            <article key={p.id} className={`ct-card ct-row ${p.is_public === false ? 'hidden' : ''}`}>
              <div className="ct-top">
                <div className="ct-name"><b>{p.name_ar}</b><span>{p.name_en || ''}</span><div className="ct-chips"><span className="ct-tag">{t(TYPES.find(x => x.value === (p.program_type || 'course'))?.label || TYPES[0].label, 'ar')}</span><span className="ct-tag">{String(p.status || '')}</span><span className={`ct-tag ${s === 'open' ? 'ok' : s === 'waitlist' ? 'warn' : ''}`}>{t(REG_LABEL[s], 'ar')}</span>{p.is_public === false && <span className="ct-tag off">مخفي من البوابة</span>}</div></div>
                <div className="ct-stats"><span><small>الرسوم</small><b>{feeLabel(p.fee, p.currency, 'ar')}</b></span><span><small>المقاعد</small><b>{p.seats ? `${left} / ${p.seats}` : 'غير محدود'}</b></span><span><small>الطلبات</small><b>{c ? `${c.pending} مراجعة · ${c.approved} مقبول` : '—'}</b></span></div>
                <div className="ct-acts">
                  <button type="button" className="ct-btn ghost" disabled={busy === p.id} onClick={() => quick(p.id, { is_public: p.is_public === false })}>{p.is_public === false ? <><Icon name="globe" size={14} /> إظهار</> : <><Icon name="x" size={14} /> إخفاء</>}</button>
                  <button type="button" className="ct-btn ghost" disabled={busy === p.id} onClick={() => quick(p.id, { registration_open: p.registration_open === false })}>{p.registration_open === false ? <><Icon name="check" size={14} /> فتح التسجيل</> : <><Icon name="pause" size={14} /> إغلاق التسجيل</>}</button>
                  <button type="button" className="ct-btn" onClick={() => { if (editing) { setEdit(null); setF(null); } else { setEdit(p.id); setF(toForm(p)); } }}><Icon name="edit" size={14} /> {editing ? 'إغلاق' : 'تحرير'}</button>
                  <Link href={`/programs/${p.id}`} target="_blank" className="ct-btn ghost"><Icon name="link" size={14} /> معاينة</Link>
                </div>
              </div>
              {editing && f && (
                <form className="ct-form" onSubmit={e => { e.preventDefault(); save(p.id); }}>
                  <label>النوع<select value={f.program_type} onChange={e => setF({ ...f, program_type: e.target.value })}>{TYPES.map(x => <option key={x.value} value={x.value}>{x.label.ar}</option>)}</select></label>
                  <label>الرسوم (فارغ = عند التواصل · 0 = مجاني)<input dir="ltr" inputMode="decimal" value={f.fee} onChange={e => setF({ ...f, fee: e.target.value })} placeholder="1500" /></label>
                  <label>العملة<select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}><option value="SAR">ر.س SAR</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
                  <label>المقاعد (فارغ = غير محدود)<input dir="ltr" inputMode="numeric" value={f.seats} onChange={e => setF({ ...f, seats: e.target.value })} placeholder="25" /></label>
                  <label>الساعات التدريبية<input dir="ltr" inputMode="numeric" value={f.hours} onChange={e => setF({ ...f, hours: e.target.value })} placeholder="40" /></label>
                  <label>آخر موعد للتسجيل<input type="date" dir="ltr" value={f.registration_deadline} onChange={e => setF({ ...f, registration_deadline: e.target.value })} /></label>
                  <label>المكان (عربي)<input value={f.location_ar} onChange={e => setF({ ...f, location_ar: e.target.value })} placeholder="المدينة المنورة — قاعة 3 / Teams" /></label>
                  <label>Location (EN)<input dir="ltr" value={f.location_en} onChange={e => setF({ ...f, location_en: e.target.value })} /></label>
                  <label className="ct-check"><input type="checkbox" checked={f.is_public} onChange={e => setF({ ...f, is_public: e.target.checked })} /> ظاهر في البوابة</label>
                  <label className="ct-check"><input type="checkbox" checked={f.registration_open} onChange={e => setF({ ...f, registration_open: e.target.checked })} /> التسجيل مفتوح</label>
                  <div className="ct-formacts"><button type="submit" className="ct-btn ok" disabled={busy === p.id}><Icon name="save" size={14} /> حفظ</button><button type="button" className="ct-btn ghost" onClick={() => { setEdit(null); setF(null); }}>إلغاء</button></div>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.ct{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.ct-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.ct-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.ct-head p{margin:0;color:#64748b;font-size:14px;line-height:1.7}.ct-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.ct-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.ct-row.hidden{opacity:.7;background:#fafafa}
.ct-top{display:grid;grid-template-columns:1.4fr 1fr auto;gap:14px;align-items:center}
.ct-name b{display:block;color:#0f2a4e;font-size:15px}.ct-name span{font-size:12px;color:#64748b}.ct-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.ct-tag{border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;background:#f1f5f9;color:#475569}.ct-tag.ok{background:#ecfdf5;color:#065f46}.ct-tag.warn{background:#fff7ed;color:#9a3412}.ct-tag.off{background:#fef2f2;color:#991b1b}
.ct-stats{display:flex;gap:14px;flex-wrap:wrap}.ct-stats span{display:grid}.ct-stats small{font-size:11px;color:#64748b;font-weight:800}.ct-stats b{font-size:13px;color:#0f172a}
.ct-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.ct-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.ct-btn.ok{background:#059669;border-color:#059669}.ct-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.ct-btn:disabled{opacity:.6}
.ct-form{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.ct-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.ct-form input,.ct-form select{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff}.ct-check{flex-direction:row;display:flex!important;align-items:center;gap:6px;align-self:end;padding:8px 0}.ct-formacts{grid-column:1/-1;display:flex;gap:8px}
.ct-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.ct-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
@media(max-width:900px){.ct-top{grid-template-columns:1fr}.ct-acts{justify-content:flex-start}.ct-form{grid-template-columns:1fr 1fr}}
`;
