'use client';

// بوابة أَثَر — إدارة الاستشارات: خط سير الطلبات · الدراسة والإسناد · عرض السعر · مراحل التنفيذ · التحديثات · تصدير Excel
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { REQ_STATUS, reqStatusLabel, areaLabel, sectorLabel, budgetLabel, AREAS, quoteTotals, cleanItems, validateQuote, isQuoteExpired, pipeline, requestsSheet, lines } from '../../../lib/portal/consulting';
import type { ConsultingRequest, ReqStatus, Quote, QuoteItem, Milestone, Update } from '../../../lib/portal/consulting';
import { money, invStatusLabel } from '../../../lib/portal/payments';
import type { Invoice, PaymentSettings } from '../../../lib/portal/payments';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const FILTERS: { k: ReqStatus | 'all' | 'open'; l: string }[] = [{ k: 'open', l: 'المفتوحة' }, { k: 'new', l: 'جديد' }, { k: 'reviewing', l: 'قيد الدراسة' }, { k: 'quoted', l: 'أُرسل العرض' }, { k: 'accepted', l: 'مقبول' }, { k: 'in_progress', l: 'قيد التنفيذ' }, { k: 'completed', l: 'مكتمل' }, { k: 'declined', l: 'اعتذار' }, { k: 'closed', l: 'مغلق' }, { k: 'cancelled', l: 'ملغي' }, { k: 'all', l: 'الكل' }];
const OPEN: ReqStatus[] = ['new', 'reviewing', 'quoted', 'accepted', 'in_progress'];
const NEXT: Partial<Record<ReqStatus, { s: ReqStatus; l: string; cls: string }[]>> = {
  new: [{ s: 'reviewing', l: 'بدء الدراسة', cls: '' }, { s: 'closed', l: 'إغلاق', cls: 'ghost' }],
  reviewing: [{ s: 'closed', l: 'إغلاق', cls: 'ghost' }],
  quoted: [{ s: 'reviewing', l: 'إعادة للدراسة', cls: 'ghost' }, { s: 'closed', l: 'إغلاق', cls: 'ghost' }],
  accepted: [{ s: 'in_progress', l: 'بدء التنفيذ', cls: 'ok' }, { s: 'closed', l: 'إغلاق', cls: 'ghost' }],
  in_progress: [{ s: 'completed', l: 'إنهاء المشروع', cls: 'ok' }],
  completed: [{ s: 'closed', l: 'إغلاق', cls: 'ghost' }],
  declined: [{ s: 'reviewing', l: 'إعادة فتح للدراسة', cls: '' }, { s: 'closed', l: 'إغلاق', cls: 'ghost' }],
  closed: [{ s: 'reviewing', l: 'إعادة فتح', cls: 'ghost' }],
  cancelled: [],
};
type Staff = { id: string; full_name: string | null; email: string | null; role: string };
type QForm = { items: QuoteItem[]; valid_until: string; scope: string; deliverables: string; duration: string; terms: string };
const emptyQ = (settings: PaymentSettings | null): QForm => { const d = new Date(); d.setDate(d.getDate() + 14); return { items: [{ d: '', q: 1, u: 0 }], valid_until: d.toISOString().slice(0, 10), scope: '', deliverables: '', duration: '', terms: settings?.terms_ar || '' }; };

export default function Page() { return <Suspense fallback={null}><ConsultingAdmin /></Suspense>; }

function ConsultingAdmin() {
  const db = useMemo(() => supabase(), []); const router = useRouter(); const sp = useSearchParams();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [me, setMe] = useState<{ id: string; role: string; name: string } | null>(null);
  const [rows, setRows] = useState<ConsultingRequest[]>([]); const [staff, setStaff] = useState<Staff[]>([]); const [settings, setSettings] = useState<PaymentSettings | null>(null); const [latestTotal, setLatestTotal] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<ReqStatus | 'all' | 'open'>('open'); const [area, setArea] = useState('all'); const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(sp.get('open')); const [quotes, setQuotes] = useState<Quote[]>([]); const [ms, setMs] = useState<Milestone[]>([]); const [ups, setUps] = useState<Update[]>([]); const [inv, setInv] = useState<Invoice | null>(null);
  const [note, setNote] = useState(''); const [notify, setNotify] = useState(true); const [internal, setInternal] = useState(''); const [busy, setBusy] = useState('');
  const [qf, setQf] = useState<QForm | null>(null); const [msTitle, setMsTitle] = useState(''); const [msDue, setMsDue] = useState(''); const [upBody, setUpBody] = useState(''); const [upVisible, setUpVisible] = useState(true);
  const today = new Date().toISOString().slice(0, 10); const canWrite = !!me && WRITERS.includes(me.role);

  async function load() {
    const [{ data: r, error: e1 }, { data: s }, { data: st }, { data: qs }] = await Promise.all([
      db.from('portal_consulting_requests').select('*').order('created_at', { ascending: false }).limit(1000),
      db.from('portal_payment_settings').select('*').eq('id', 1).maybeSingle(),
      db.from('profiles').select('id,full_name,email,role').in('role', WRITERS).limit(200),
      db.from('portal_consulting_quotes').select('request_id,total,status,version').in('status', ['sent', 'accepted']).order('version', { ascending: false }),
    ]);
    if (e1) { setError(e1.message); return; }
    setRows((r || []) as ConsultingRequest[]); setSettings((s as PaymentSettings) || null); setStaff((st || []) as Staff[]);
    const lt: Record<string, number> = {}; for (const x of ((qs || []) as any[])) if (!(x.request_id in lt)) lt[x.request_id] = Number(x.total); setLatestTotal(lt);
  }
  async function loadDetail(id: string) {
    const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
      db.from('portal_consulting_quotes').select('*').eq('request_id', id).order('version', { ascending: false }),
      db.from('portal_consulting_milestones').select('*').eq('request_id', id).order('position'),
      db.from('portal_consulting_updates').select('*').eq('request_id', id).order('created_at'),
    ]);
    setQuotes((a || []) as Quote[]); setMs((b || []) as Milestone[]); setUps((c || []) as Update[]);
    const r = rows.find(x => x.id === id); if (r?.invoice_id) { const { data: i } = await db.from('portal_invoices').select('*').eq('id', r.invoice_id).maybeSingle(); setInv((i as Invoice) || null); } else setInv(null);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/consulting'); return; }
      const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', user.id).single();
      const role = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(role)) { router.replace('/dashboard'); return; }
      setMe({ id: user.id, role, name: String((prof as any)?.full_name || user.email || '') }); await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (open && ready) { const r = rows.find(x => x.id === open); setInternal(r?.internal_notes || ''); setQf(null); setNote(''); loadDetail(open); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, ready]);

  async function api(payload: any) { const { data: s } = await db.auth.getSession(); const res = await fetch('/api/consulting', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(payload) }); const j = await res.json().catch(() => ({})); if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`); return j; }
  const run = async (key: string, fn: () => Promise<string | void>) => { setBusy(key); setError(''); setNotice(''); try { const m = await fn(); if (m) setNotice(m); await load(); if (open) await loadDetail(open); } catch (e: any) { setError(e.message || String(e)); } setBusy(''); };

  const setStatus = (r: ConsultingRequest, s: ReqStatus) => run('st', async () => { const j = await api({ action: 'status', id: r.id, status: s, note: note.trim() || undefined, notify }); setNote(''); return j.mail_error ? `تم تحديث الحالة، لكن تعذّر إرسال البريد: ${j.mail_error}` : 'تم تحديث الحالة' + (notify && ['reviewing', 'in_progress', 'completed', 'closed'].includes(s) ? ' وإشعار العميل.' : '.'); });
  const assign = (r: ConsultingRequest, to: string) => run('as', async () => { const { error } = await db.from('portal_consulting_requests').update({ assigned_to: to || null, updated_at: new Date().toISOString() }).eq('id', r.id); if (error) throw error; return 'تم تحديث المسؤول.'; });
  const saveInternal = (r: ConsultingRequest) => run('in', async () => { const { error } = await db.from('portal_consulting_requests').update({ internal_notes: internal.trim() || null, updated_at: new Date().toISOString() }).eq('id', r.id); if (error) throw error; return 'حُفظت الملاحظات الداخلية.'; });
  const saveQuote = (r: ConsultingRequest, send: boolean) => run(send ? 'qs' : 'qd', async () => {
    if (!qf) return; const items = cleanItems(qf.items); const v = validateQuote({ items, valid_until: qf.valid_until, scope: qf.scope }); if (v) throw new Error(v);
    const tt = quoteTotals(items, Number(settings?.vat_rate ?? 15), !!settings?.prices_include_vat); const version = (quotes[0]?.version || 0) + 1;
    const { data, error } = await db.from('portal_consulting_quotes').insert({ request_id: r.id, created_by: me?.id, version, currency: settings?.currency || 'SAR', items, subtotal: tt.subtotal, vat_rate: Number(settings?.vat_rate ?? 15), vat_amount: tt.vat, total: tt.total, valid_until: qf.valid_until || null, scope: qf.scope.trim() || null, deliverables: qf.deliverables.trim() || null, duration: qf.duration.trim() || null, terms: qf.terms.trim() || null, status: 'draft' }).select('*').single();
    if (error) throw error; setQf(null);
    if (!send) return `حُفظت المسودة (الإصدار ${version}).`;
    const j = await api({ action: 'send_quote', quote_id: (data as any).id }); return j.mail_error ? `أُرسل العرض لكن تعذّر البريد: ${j.mail_error}` : `أُرسل عرض السعر (الإصدار ${version}) للعميل بالبريد.`;
  });
  const sendDraft = (qid: string) => run('qs', async () => { const j = await api({ action: 'send_quote', quote_id: qid }); return j.mail_error ? `أُرسل العرض لكن تعذّر البريد: ${j.mail_error}` : 'أُرسل عرض السعر للعميل.'; });
  const deleteDraft = (qid: string) => run('qx', async () => { if (!window.confirm('حذف المسودة؟')) return; const { error } = await db.from('portal_consulting_quotes').delete().eq('id', qid).eq('status', 'draft'); if (error) throw error; return 'حُذفت المسودة.'; });
  const addMs = (r: ConsultingRequest) => run('ma', async () => { if (msTitle.trim().length < 2) throw new Error('اكتب عنوان المرحلة'); const { error } = await db.from('portal_consulting_milestones').insert({ request_id: r.id, position: (ms[ms.length - 1]?.position || 0) + 1, title: msTitle.trim(), due_date: msDue || null, status: 'planned', visible_to_client: true }); if (error) throw error; setMsTitle(''); setMsDue(''); return 'أُضيفت المرحلة.'; });
  const setMs_ = (m: Milestone, status: Milestone['status']) => run('m' + m.id, async () => { const { error } = await db.from('portal_consulting_milestones').update({ status, done_at: status === 'done' ? new Date().toISOString() : null }).eq('id', m.id); if (error) throw error; });
  const delMs = (m: Milestone) => run('m' + m.id, async () => { if (!window.confirm('حذف المرحلة؟')) return; const { error } = await db.from('portal_consulting_milestones').delete().eq('id', m.id); if (error) throw error; });
  const postUp = (r: ConsultingRequest) => run('up', async () => { if (upBody.trim().length < 2) throw new Error('اكتب نص التحديث'); const { data, error } = await db.from('portal_consulting_updates').insert({ request_id: r.id, author_id: me?.id, author_name: me?.name, by_staff: true, body: upBody.trim().slice(0, 4000), visible_to_client: upVisible }).select('*').single(); if (error) throw error; setUpBody(''); if (!upVisible) return 'حُفظت ملاحظة داخلية.'; const j = await api({ action: 'update_posted', update_id: (data as any).id }); return j.mail_error ? `نُشر التحديث لكن تعذّر البريد: ${j.mail_error}` : 'نُشر التحديث وأُشعر العميل بالبريد.'; });

  const pipe = useMemo(() => pipeline(rows), [rows]);
  const tally = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.k, f.k === 'all' ? rows.length : f.k === 'open' ? rows.filter(r => OPEN.includes(r.status)).length : rows.filter(r => r.status === f.k).length])), [rows]);
  const shown = rows.filter(r => (filter === 'all' || (filter === 'open' ? OPEN.includes(r.status) : r.status === filter)) && (area === 'all' || r.area === area) && (!q.trim() || `${r.full_name} ${r.email} ${r.organization || ''} ${r.title}`.toLowerCase().includes(q.trim().toLowerCase())));
  const exportXlsx = () => downloadXlsx(safeFilename('athar_consulting', 'xlsx'), [requestsSheet(shown.map(r => ({ ...r, quote_total: latestTotal[r.id] ?? null })))]);
  const staffName = (id?: string | null) => { const s = staff.find(x => x.id === id); return s ? (s.full_name || s.email || id) : (id ? '—' : 'غير مُسند'); };
  const qt = qf ? quoteTotals(cleanItems(qf.items), Number(settings?.vat_rate ?? 15), !!settings?.prices_include_vat) : null;

  if (!ready) return <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="en-card">{error ? <span className="en-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <header className="en-head"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>الاستشارات</h1><p>من الطلب إلى عرض السعر إلى التنفيذ: كل انتقال موثّق، وكل عرض مُرسل يصل العميل بالبريد ويُقبل من صفحته.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/consulting': pipe.needsAction }} />
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}

        <div className="en-card en-seats cs-pipe">
          {(['new', 'reviewing', 'quoted', 'accepted', 'in_progress', 'completed'] as ReqStatus[]).map(s => <button type="button" key={s} className={`en-seat ${filter === s ? 'on' : ''}`} onClick={() => setFilter(filter === s ? 'open' : s)}><b>{pipe.byStatus[s] || 0}</b><span>{reqStatusLabel(s, 'ar')}</span></button>)}
          <span className="en-muted" style={{ marginInlineStart: 'auto' }}>المفتوحة {pipe.open} من {pipe.total} · تحتاج إجراء: {pipe.needsAction}</span>
        </div>

        <div className="en-tools">
          <div className="en-tabs">{FILTERS.map(f => <button type="button" key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>{f.l} ({tally[f.k]})</button>)}</div>
          <select value={area} onChange={e => setArea(e.target.value)}><option value="all">كل المجالات</option>{AREAS.map(a => <option key={a.value} value={a.value}>{a.label.ar}</option>)}</select>
          <input placeholder="بحث: الاسم، الجهة، العنوان…" value={q} onChange={e => setQ(e.target.value)} />
          <button type="button" className="en-btn ghost" onClick={exportXlsx} disabled={shown.length === 0}><Icon name="download" size={14} /> Excel ({shown.length})</button>
          <button type="button" className="en-btn ghost" onClick={() => run('r', async () => undefined)}><Icon name="refresh" size={14} /> تحديث</button>
        </div>

        {shown.length === 0 && <div className="en-card en-muted">لا توجد طلبات ضمن هذا التصفية.</div>}
        {shown.map(r => { const isOpen = open === r.id; const sentQ = quotes.find(x => x.status === 'sent'); return (
          <div key={r.id} className={`en-card en-row ${r.status}`}>
            <div className="en-top" onClick={() => setOpen(isOpen ? null : r.id)}>
              <div className="en-who"><b>{r.title}</b><span>{r.organization || '—'} · {r.full_name}</span><span className={`en-tag ${r.status}`}>{reqStatusLabel(r.status, 'ar')}</span></div>
              <div className="en-meta"><span className="en-prog">{areaLabel(r.area, 'ar')}</span>{latestTotal[r.id] !== undefined && <span><bdi>{money(latestTotal[r.id], settings?.currency || 'SAR', 'ar')}</bdi></span>}<span>{staffName(r.assigned_to)}</span><span>{fmt(r.created_at)}</span><Icon name="arrow" size={14} /></div>
            </div>
            {isOpen && (
              <div className="en-body">
                <div className="en-details"><span>📧 <bdi>{r.email}</bdi></span>{r.phone && <span>📱 <bdi>{r.phone}</bdi></span>}<span>القطاع: {sectorLabel(r.sector, 'ar')}</span><span>الميزانية: {budgetLabel(r.budget_range, 'ar')}</span>{r.timeline && <span>التوقيت: {r.timeline}</span>}<span>اللغة: {r.lang === 'en' ? 'EN' : 'AR'}</span><span>الرقم: <bdi>{r.id.slice(0, 8).toUpperCase()}</bdi></span><Link href={`/consulting/${r.id}`} target="_blank">صفحة العميل ↗</Link></div>
                <p><b>الوصف:</b> {r.details}</p>{r.goals && <p><b>الأهداف:</b> {r.goals}</p>}{r.client_note && <p className="cs-cn"><b>ملاحظة العميل على العرض:</b> {r.client_note}</p>}
                {inv && <div className="cs-invrow"><Icon name="shield" size={14} /> الفاتورة <b dir="ltr">{inv.invoice_no}</b> · <bdi>{money(inv.total, inv.currency, 'ar')}</bdi> · {invStatusLabel(inv.status, 'ar')} <Link href={`/admin/payments?open=${inv.id}`}>إدارة الفاتورة ↗</Link></div>}

                {canWrite && (
                  <div className="cs-grid2">
                    <label className="en-note">المسؤول عن الطلب<select value={r.assigned_to || ''} onChange={e => assign(r, e.target.value)} disabled={!!busy}><option value="">غير مُسند</option>{staff.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select></label>
                    <label className="en-note">ملاحظات داخلية (لا تظهر للعميل)<textarea value={internal} onChange={e => setInternal(e.target.value)} /><button type="button" className="en-btn ghost" style={{ justifySelf: 'start' }} disabled={busy === 'in'} onClick={() => saveInternal(r)}><Icon name="save" size={14} /> حفظ</button></label>
                  </div>
                )}

                <section className="cs-sec"><h3><Icon name="doc" size={16} /> عروض السعر</h3>
                  {quotes.length === 0 && <span className="en-muted">لا عروض بعد.</span>}
                  {quotes.map(x => <div key={x.id} className={`cs-q ${x.status}`}><div className="cs-qh"><b>الإصدار {x.version}</b><span className={`en-tag q-${x.status}`}>{x.status === 'draft' ? 'مسودة' : x.status === 'sent' ? (isQuoteExpired(x, today) ? 'منتهي الصلاحية' : 'مُرسل — بانتظار الرد') : x.status === 'accepted' ? 'مقبول' : x.status === 'declined' ? 'معتذر عنه' : 'مستبدل'}</span><span className="en-muted"><bdi>{money(x.total, x.currency, 'ar')}</bdi> شامل الضريبة · صالح حتى <bdi>{x.valid_until || '—'}</bdi>{x.sent_at && <> · أُرسل {fmt(x.sent_at)}</>}{x.responded_at && <> · الرد {fmt(x.responded_at)}</>}</span>
                    {canWrite && x.status === 'draft' && <span className="en-acts"><button type="button" className="en-btn" disabled={!!busy} onClick={() => sendDraft(x.id)}><Icon name="send" size={14} /> إرسال للعميل</button><button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => deleteDraft(x.id)}><Icon name="trash" size={14} /></button></span>}</div>
                    <ul className="cs-ql">{cleanItems(x.items).map((it, i) => <li key={i}>{it.d} — {it.q} × <bdi>{money(it.u, x.currency, 'ar')}</bdi></li>)}</ul>{x.client_note && <p className="cs-cn">ملاحظة العميل: {x.client_note}</p>}</div>)}
                  {canWrite && !['cancelled', 'completed'].includes(r.status) && !qf && <button type="button" className="en-btn ghost" onClick={() => setQf(emptyQ(settings))}><Icon name="plus" size={14} /> {quotes.length ? 'عرض سعر جديد (إصدار معدّل)' : 'إعداد عرض سعر'}</button>}
                  {qf && (
                    <div className="cs-qf">
                      <label className="en-note">نطاق العمل *<textarea value={qf.scope} onChange={e => setQf({ ...qf, scope: e.target.value })} placeholder="ما الذي سنقوم به، ولمن، وبأي منهجية" /></label>
                      <div className="cs-grid2"><label className="en-note">المخرجات (سطر لكل مخرج)<textarea value={qf.deliverables} onChange={e => setQf({ ...qf, deliverables: e.target.value })} /></label><label className="en-note">المدة<input value={qf.duration} onChange={e => setQf({ ...qf, duration: e.target.value })} placeholder="مثال: 8 أسابيع" /><span>صالح حتى</span><input type="date" value={qf.valid_until} onChange={e => setQf({ ...qf, valid_until: e.target.value })} /></label></div>
                      <table className="cs-items"><thead><tr><th>البند</th><th style={{ width: 80 }}>الكمية</th><th style={{ width: 130 }}>سعر الوحدة</th><th style={{ width: 120 }}>المجموع</th><th style={{ width: 40 }}></th></tr></thead>
                        <tbody>{qf.items.map((it, i) => <tr key={i}><td><input value={it.d} onChange={e => setQf({ ...qf, items: qf.items.map((y, j) => j === i ? { ...y, d: e.target.value } : y) })} placeholder="وصف البند" /></td><td><input type="number" min={0} step="any" value={it.q} onChange={e => setQf({ ...qf, items: qf.items.map((y, j) => j === i ? { ...y, q: Number(e.target.value) } : y) })} /></td><td><input type="number" min={0} step="any" value={it.u} onChange={e => setQf({ ...qf, items: qf.items.map((y, j) => j === i ? { ...y, u: Number(e.target.value) } : y) })} /></td><td><bdi>{money(it.q * it.u, settings?.currency || 'SAR', 'ar')}</bdi></td><td><button type="button" className="cs-x" onClick={() => setQf({ ...qf, items: qf.items.filter((_, j) => j !== i) })} aria-label="حذف"><Icon name="x" size={12} /></button></td></tr>)}</tbody>
                        <tfoot><tr><td colSpan={5}><button type="button" className="en-btn ghost" onClick={() => setQf({ ...qf, items: [...qf.items, { d: '', q: 1, u: 0 }] })}><Icon name="plus" size={12} /> بند</button></td></tr>
                          {qt && <><tr><td colSpan={3}>قبل الضريبة</td><td colSpan={2}><bdi>{money(qt.subtotal, settings?.currency || 'SAR', 'ar')}</bdi></td></tr><tr><td colSpan={3}>الضريبة ({Number(settings?.vat_rate ?? 15)}%){settings?.prices_include_vat ? ' — الأسعار شاملة' : ''}</td><td colSpan={2}><bdi>{money(qt.vat, settings?.currency || 'SAR', 'ar')}</bdi></td></tr><tr className="tot"><td colSpan={3}>الإجمالي</td><td colSpan={2}><bdi>{money(qt.total, settings?.currency || 'SAR', 'ar')}</bdi></td></tr></>}</tfoot></table>
                      <label className="en-note">الشروط<textarea value={qf.terms} onChange={e => setQf({ ...qf, terms: e.target.value })} /></label>
                      <div className="en-acts"><button type="button" className="en-btn ok" disabled={!!busy} onClick={() => saveQuote(r, true)}><Icon name="send" size={14} /> حفظ وإرسال للعميل</button><button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => saveQuote(r, false)}><Icon name="save" size={14} /> حفظ كمسودة</button><button type="button" className="en-btn ghost" onClick={() => setQf(null)}>إلغاء</button></div>
                      <span className="en-muted">الإرسال يضع الطلب في حالة «أُرسل عرض السعر» ويُرسل بريدًا للعميل برابط صفحته؛ قبوله يُصدر فاتورة تلقائيًا. الإصدار الجديد يستبدل أي عرض سابق مُرسل.</span>
                    </div>
                  )}
                </section>

                {['accepted', 'in_progress', 'completed', 'closed'].includes(r.status) && (
                  <section className="cs-sec"><h3><Icon name="target" size={16} /> مراحل التنفيذ <small className="en-muted">{ms.filter(m => m.status === 'done').length}/{ms.length}</small></h3>
                    {ms.map(m => <div key={m.id} className={`cs-m ${m.status}`}><i>{m.position}</i><b>{m.title}</b><span className="en-muted">{m.due_date ? <>الموعد <bdi>{m.due_date}</bdi></> : ''}{m.done_at && <> · أُنجز <bdi>{m.done_at.slice(0, 10)}</bdi></>}</span>
                      {canWrite && <span className="en-acts">{m.status !== 'in_progress' && m.status !== 'done' && <button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => setMs_(m, 'in_progress')}><Icon name="play" size={12} /> بدء</button>}{m.status !== 'done' && <button type="button" className="en-btn ok" disabled={!!busy} onClick={() => setMs_(m, 'done')}><Icon name="check" size={12} /> إنجاز</button>}{m.status === 'done' && <button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => setMs_(m, 'planned')}>تراجع</button>}<button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => delMs(m)}><Icon name="trash" size={12} /></button></span>}</div>)}
                    {canWrite && <div className="cs-msadd"><input value={msTitle} onChange={e => setMsTitle(e.target.value)} placeholder="عنوان المرحلة (مثال: التشخيص وجمع البيانات)" /><input type="date" value={msDue} onChange={e => setMsDue(e.target.value)} /><button type="button" className="en-btn ghost" disabled={busy === 'ma'} onClick={() => addMs(r)}><Icon name="plus" size={14} /> إضافة</button></div>}
                  </section>
                )}

                <section className="cs-sec"><h3><Icon name="chat" size={16} /> التحديثات والمراسلات</h3>
                  {ups.length === 0 && <span className="en-muted">لا تحديثات بعد.</span>}
                  <div className="cs-ups">{ups.map(u => <div key={u.id} className={`cs-up ${u.by_staff ? (u.visible_to_client ? 'staff' : 'internal') : 'client'}`}><small>{u.by_staff ? (u.author_name || 'الفريق') : `العميل — ${u.author_name || r.full_name}`}{u.by_staff && !u.visible_to_client && ' · داخلي'} · {fmt(u.created_at)}</small><p>{u.body}</p></div>)}</div>
                  {canWrite && <div className="cs-upadd"><textarea value={upBody} onChange={e => setUpBody(e.target.value)} placeholder="تحديث للعميل أو ملاحظة داخلية…" /><div className="en-acts"><label className="cs-chk"><input type="checkbox" checked={upVisible} onChange={e => setUpVisible(e.target.checked)} /> يظهر للعميل ويُرسل بالبريد</label><button type="button" className="en-btn" disabled={busy === 'up'} onClick={() => postUp(r)}><Icon name="send" size={14} /> نشر</button></div></div>}
                </section>

                {canWrite && (NEXT[r.status] || []).length > 0 && (
                  <section className="cs-sec"><h3><Icon name="flag" size={16} /> تغيير الحالة</h3>
                    <label className="en-note">رسالة للعميل (اختياري — تُدرج في بريد الإشعار)<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
                    <div className="en-acts"><label className="cs-chk"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> إشعار العميل بالبريد</label>{(NEXT[r.status] || []).map(n => <button type="button" key={n.s} className={`en-btn ${n.cls}`} disabled={busy === 'st'} onClick={() => setStatus(r, n.s)}>{n.l}</button>)}{r.status === 'quoted' && sentQ && <span className="en-muted">العرض الإصدار {sentQ.version} بانتظار رد العميل.</span>}</div>
                  </section>
                )}
                <div className="en-details"><span>آخر تحديث: {fmt(r.updated_at)}</span>{r.decided_at && <span>قرار العميل: {fmt(r.decided_at)}</span>}{r.completed_at && <span>الإنجاز: {fmt(r.completed_at)}</span>}</div>
              </div>
            )}
          </div>); })}
      </div>
    </div>
  );
}

const CSS = `
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-seats{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-seat{text-align:start;border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:8px 14px;font:inherit;cursor:pointer;display:grid;gap:2px;min-width:92px}.en-seat.on{border-color:#0b8a83;background:#f0fdfa}.en-seat b{font-size:18px;color:#0f2a4e}.en-seat span{font-size:11.5px;color:#64748b}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.en-tools select,.en-tools input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff}.en-tools input{min-width:200px}
.en-row.new{border-inline-start:4px solid #2563eb}.en-row.reviewing{border-inline-start:4px solid #0ea5e9}.en-row.quoted{border-inline-start:4px solid #d97706}.en-row.accepted,.en-row.in_progress{border-inline-start:4px solid #059669}.en-row.completed{border-inline-start:4px solid #0b8a83}.en-row.declined,.en-row.closed,.en-row.cancelled{opacity:.75}
.en-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}.en-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#64748b}.en-who b{color:#0f2a4e;font-size:15px}
.en-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#64748b}.en-prog{font-weight:800;color:#334155}
.en-tag{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#f1f5f9;color:#475569}.en-tag.new,.en-tag.reviewing{background:#eff6ff;color:#1e40af}.en-tag.quoted,.en-tag.q-sent{background:#fff7ed;color:#9a3412}.en-tag.accepted,.en-tag.in_progress,.en-tag.q-accepted{background:#ecfdf5;color:#065f46}.en-tag.completed{background:#f0fdfa;color:#0b8a83}
.en-body{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;display:grid;gap:12px}.en-body p{margin:0;font-size:14px;line-height:1.8;color:#0f172a}
.en-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#64748b}.en-details a{color:#0b8a83;font-weight:800}
.en-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.en-note textarea,.en-note input,.en-note select{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff}.en-note textarea{min-height:60px;resize:vertical}
.en-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ok{background:#059669;border-color:#059669}.en-btn.warn{background:#d97706;border-color:#d97706}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.cs-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-sec{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:grid;gap:10px;background:#fcfcfd}.cs-sec h3{margin:0;font-size:15px;color:#0f2a4e;display:flex;gap:6px;align-items:center}
.cs-cn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 12px}.cs-invrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:8px 12px;color:#134e4a}.cs-invrow a{color:#0b8a83;font-weight:800}
.cs-q{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#fff}.cs-q.sent{border-color:#fbbf24}.cs-q.accepted{border-color:#6ee7b7}.cs-q.superseded,.cs-q.declined{opacity:.7}.cs-qh{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}.cs-ql{margin:6px 0 0;padding-inline-start:18px;font-size:13px;color:#334155}
.cs-qf{display:grid;gap:10px;border:1px dashed #0b8a83;border-radius:12px;padding:12px;background:#fff}
.cs-items{width:100%;border-collapse:collapse;font-size:13px}.cs-items th{background:#f1f5f9;color:#334155;padding:6px 8px;text-align:start;font-size:12px}.cs-items td{padding:4px 6px;border-bottom:1px solid #f1f5f9}.cs-items input{width:100%;box-sizing:border-box;font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px}.cs-items tfoot td{font-weight:800;color:#64748b}.cs-items tr.tot td{font-size:15px;color:#0f2a4e;font-weight:900}.cs-x{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;width:26px;height:26px;cursor:pointer;display:inline-grid;place-items:center}
.cs-m{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13.5px;border-bottom:1px solid #f1f5f9;padding:6px 0}.cs-m i{width:24px;height:24px;border-radius:50%;background:#e2e8f0;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900;color:#475569}.cs-m.done i{background:#0b8a83;color:#fff}.cs-m.in_progress i{background:#c9a24b}.cs-m b{flex:1;min-width:160px}.cs-m .en-acts{margin-inline-start:auto}
.cs-msadd{display:grid;grid-template-columns:1fr auto auto;gap:8px}.cs-msadd input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px}
.cs-ups{display:grid;gap:8px}.cs-up{border-radius:10px;padding:8px 12px;background:#fff;border:1px solid #e2e8f0}.cs-up.staff{background:#f0fdfa;border-color:#99f6e4}.cs-up.internal{background:#fffbeb;border-color:#fde68a}.cs-up small{color:#64748b;font-weight:800;font-size:11.5px}.cs-up p{margin:4px 0 0;font-size:13.5px;white-space:pre-wrap}
.cs-upadd{display:grid;gap:8px}.cs-upadd textarea{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;min-height:60px}.cs-chk{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#334155;font-weight:800}
@media(max-width:760px){.cs-grid2,.cs-msadd{grid-template-columns:1fr}}
`;
