'use client';

// بوابة أَثَر — المدفوعات: الفواتير · تأكيد التحويلات · الإعدادات البنكية والضريبية
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { money, invStatusLabel, methodLabel, totals, invoicesSheet, isValidIban, isOverdue, computeAmounts } from '../../../lib/portal/payments';
import type { Invoice, InvoiceStatus, PaymentSettings } from '../../../lib/portal/payments';
import type { Enrollment } from '../../../lib/portal/catalog';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
type Row = Invoice & { program_name?: string };
type Tab = 'invoices' | 'pending' | 'settings';
const FILTERS: { k: InvoiceStatus | 'all' | 'overdue'; l: string }[] = [{ k: 'under_review', l: 'إيصالات للمراجعة' }, { k: 'unpaid', l: 'بانتظار الدفع' }, { k: 'overdue', l: 'متأخرة' }, { k: 'paid', l: 'مدفوعة' }, { k: 'waived', l: 'معفاة' }, { k: 'cancelled', l: 'ملغاة' }, { k: 'refunded', l: 'مستردّة' }, { k: 'all', l: 'الكل' }];
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function PaymentsPage() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [role, setRole] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [whCode, setWhCode] = useState<{ code: string | null; at: string | null; configured: boolean; secret_ok: boolean | null } | null>(null); /* هـ-1/3: رمز توثيق Webhook من Moyasar */
  const fetchWhCode = async () => { const { data: s } = await db.auth.getSession(); const r = await fetch('/api/payments/webhook?verification=1', { headers: { Authorization: `Bearer ${s.session?.access_token || ''}` }, cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (j.ok) setWhCode({ code: j.code, at: j.at, configured: !!j.configured, secret_ok: j.secret_ok ?? null }); else setError(j.error || `HTTP ${r.status}`); };
  const [tab, setTab] = useState<Tab>('invoices'); const [filter, setFilter] = useState<InvoiceStatus | 'all' | 'overdue'>('under_review'); const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]); const [programs, setPrograms] = useState<Record<string, { name_ar: string; fee: number | null; currency: string | null }>>({});
  const [pending, setPending] = useState<(Enrollment & { program_name?: string; fee?: number | null })[]>([]);
  const [settings, setSettings] = useState<PaymentSettings | null>(null); const [form, setForm] = useState<PaymentSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(''); const [receiptUrl, setReceiptUrl] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const canWrite = WRITERS.includes(role); const isAdmin = ADMINS.includes(role);

  async function load() {
    const [{ data: inv, error: e1 }, { data: ps }, { data: s }, { data: en }] = await Promise.all([
      db.from('portal_invoices').select('*').order('created_at', { ascending: false }).limit(1000),
      db.from('programs').select('id,name_ar,fee,currency').is('archived_at', null),
      db.from('portal_payment_settings').select('*').eq('id', 1).maybeSingle(),
      db.from('portal_enrollments').select('*').eq('status', 'approved').order('created_at', { ascending: false }).limit(500),
    ]);
    if (e1) { setError(e1.message); return; }
    const pm: Record<string, any> = {}; for (const p of (ps || []) as any[]) pm[p.id] = p; setPrograms(pm);
    const invs = ((inv || []) as Invoice[]).map(r => ({ ...r, program_name: pm[r.program_id || '']?.name_ar || r.description })); setRows(invs);
    setSettings((s as PaymentSettings) || null); setForm((s as PaymentSettings) || null);
    const withInv = new Set(invs.filter(i => i.status !== 'cancelled').map(i => i.enrollment_id));
    setPending(((en || []) as Enrollment[]).filter(e => !withInv.has(e.id)).map(e => ({ ...e, program_name: pm[e.program_id]?.name_ar, fee: pm[e.program_id]?.fee ?? null })));
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/payments'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      const r = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(r)) { router.replace('/dashboard'); return; }
      setRole(r); await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function api(payload: any) {
    const { data: s } = await db.auth.getSession();
    const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({})); if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`); return j;
  }
  async function setStatus(id: string, status: InvoiceStatus, method?: string) {
    setBusy(id); setError(''); setNotice('');
    try { const j = await api({ action: 'set', id, status, method, note: note.trim() || undefined }); setNotice(j.mail_error ? `تم التحديث، لكن تعذّر إرسال البريد: ${j.mail_error}` : (status === 'paid' ? 'تم تأكيد السداد وإرسال إشعار للعميل.' : 'تم تحديث الحالة.')); setNote(''); setOpen(null); await load(); } catch (e: any) { setError(e.message); }
    setBusy('');
  }
  async function issue(enrollmentId: string) {
    setBusy(enrollmentId); setError(''); setNotice('');
    try { const j = await api({ action: 'issue', enrollment_id: enrollmentId }); setNotice(j.invoice_id ? (j.mail_error ? `صدرت الفاتورة لكن تعذّر البريد: ${j.mail_error}` : 'صدرت الفاتورة وأُرسلت للعميل.') : (j.message || 'لا فاتورة')); await load(); } catch (e: any) { setError(e.message); }
    setBusy('');
  }
  async function resend(id: string) { setBusy(id); try { const j = await api({ action: 'send', id }); setNotice(j.mail_error ? `تعذّر البريد: ${j.mail_error}` : 'أُعيد إرسال الفاتورة.'); } catch (e: any) { setError(e.message); } setBusy(''); }
  async function viewReceipt(r: Row) {
    if (!r.receipt_path) return; if (receiptUrl[r.id]) { window.open(receiptUrl[r.id], '_blank'); return; }
    const { data, error: e } = await db.storage.from('portal-receipts').createSignedUrl(r.receipt_path, 600);
    if (e || !data?.signedUrl) { setError(e?.message || 'تعذّر فتح الإيصال'); return; } setReceiptUrl(x => ({ ...x, [r.id]: data.signedUrl })); window.open(data.signedUrl, '_blank');
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!form) return; setError(''); setNotice('');
    if (form.iban && !isValidIban(form.iban)) { setError('صيغة IBAN غير صحيحة — يجب أن يبدأ بـ SA ويتبعه 22 رقمًا.'); return; }
    setBusy('settings');
    const { error: err } = await db.from('portal_payment_settings').update({ bank_name: form.bank_name, account_name: form.account_name, iban: form.iban.replace(/\s+/g, '').toUpperCase(), swift: form.swift || null, vat_rate: Number(form.vat_rate), vat_number: form.vat_number || null, prices_include_vat: form.prices_include_vat, invoice_prefix: form.invoice_prefix.trim() || 'ATH', due_days: Number(form.due_days) || 7, bank_transfer_enabled: form.bank_transfer_enabled, card_enabled: form.card_enabled, terms_ar: form.terms_ar, terms_en: form.terms_en }).eq('id', 1);
    if (err) setError(err.message); else { setNotice('تم حفظ الإعدادات.'); await load(); }
    setBusy('');
  }

  const tally = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.k, f.k === 'all' ? rows.length : f.k === 'overdue' ? rows.filter(r => isOverdue(r, today)).length : rows.filter(r => r.status === f.k).length])), [rows, today]);
  const shown = rows.filter(r => (filter === 'all' || (filter === 'overdue' ? isOverdue(r, today) : r.status === filter)) && (!q.trim() || `${r.invoice_no} ${r.customer_name} ${r.customer_email} ${r.program_name}`.toLowerCase().includes(q.trim().toLowerCase())));
  const T = totals(rows); const preview = form ? computeAmounts(1000, Number(form.vat_rate) || 0, form.prices_include_vat) : null;

  if (!ready) return <div className="py rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="py-wrap"><div className="rm-card">{error ? <span className="py-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="py rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="py-wrap">
        <RoomHead
        title={<>المدفوعات والفواتير</>}
        desc={<><p>الفواتير تصدر تلقائيًا عند قبول طلب في برنامج له رسوم؛ هنا تراجع الإيصالات وتؤكد السداد وتضبط البيانات البنكية والضريبية.</p></>}
      />
        <PortalAdminTabs counts={{ '/admin/payments': tally.under_review }} />
        {error && <div className="py-err">{error}</div>}{notice && <div className="py-ok">{notice}</div>}
        <div className="rm-kpis"><div><small>الفواتير</small><b>{T.count}</b></div><div><small>محصّل</small><b><bdi>{money(T.paid, settings?.currency || 'SAR', 'ar')}</bdi></b></div><div><small>مستحق</small><b><bdi>{money(T.outstanding, settings?.currency || 'SAR', 'ar')}</bdi></b></div><div className={T.review ? 'hot' : ''}><small>إيصالات للمراجعة</small><b>{T.review}</b></div></div>
        <div className="py-tabs">{([['invoices', 'الفواتير'], ['pending', `مقبولون بلا فاتورة (${pending.length})`], ['settings', 'الإعدادات']] as [Tab, string][]).map(([k, l]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

        {tab === 'invoices' && (<>
          <div className="py-tools"><div className="py-filters">{FILTERS.map(f => <button type="button" key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>{f.l} ({tally[f.k]})</button>)}</div><input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث برقم الفاتورة أو الاسم…" /><button type="button" className="rm-btn ghost" disabled={!shown.length} onClick={() => downloadXlsx(safeFilename('athar_invoices', 'xlsx'), [invoicesSheet(shown)])}><Icon name="download" size={15} /> Excel ({shown.length})</button></div>
          {shown.length === 0 && <div className="rm-card rm-muted" style={{ textAlign: 'center' }}>لا توجد فواتير في هذا التصنيف.</div>}
          {shown.map(r => (
            <article key={r.id} className={`rm-card py-row ${r.status} ${isOverdue(r, today) ? 'overdue' : ''}`}>
              <div className="py-top" role="button" tabIndex={0} onClick={() => { setOpen(open === r.id ? null : r.id); setNote(''); }}>
                <div className="py-who"><b dir="ltr">{r.invoice_no}</b><span>{r.customer_name}</span><span dir="ltr">{r.customer_email}</span></div>
                <div className="py-meta"><span className="py-prog">{r.program_name}</span><b><bdi>{money(r.total, r.currency, 'ar')}</bdi></b><span className={`py-tag ${r.status}`}>{invStatusLabel(r.status, 'ar')}</span>{isOverdue(r, today) && <span className="py-tag overdue">متأخرة</span>}<bdi>{fmt(r.created_at)}</bdi></div>
              </div>
              {open === r.id && (
                <div className="py-body">
                  <div className="py-details"><span>قبل الضريبة: <bdi>{money(r.subtotal, r.currency, 'ar')}</bdi></span><span>الضريبة ({Number(r.vat_rate)}%): <bdi>{money(r.vat_amount, r.currency, 'ar')}</bdi></span><span>الاستحقاق: <bdi>{r.due_date || '—'}</bdi></span><span>الطريقة: {methodLabel(r.method, 'ar')}</span>{r.paid_at && <span>السداد: <bdi>{fmt(r.paid_at)}</bdi></span>}{r.transfer_ref && <span>مرجع التحويل: <bdi>{r.transfer_ref}</bdi></span>}{r.gateway_payment_id && <span>Moyasar: <bdi>{r.gateway_payment_id}</bdi></span>}{r.receipt_uploaded_at && <span>رفع الإيصال: <bdi>{fmt(r.receipt_uploaded_at)}</bdi></span>}{r.payer_note && <span>ملاحظة العميل: {r.payer_note}</span>}{r.notes && <span>ملاحظات: {r.notes}</span>}</div>
                  {canWrite && <label className="py-note">ملاحظة داخلية (اختياري)<input value={note} onChange={e => setNote(e.target.value)} /></label>}
                  <div className="py-acts">
                    {r.receipt_path && <button type="button" className="rm-btn ghost" onClick={() => viewReceipt(r)}><Icon name="doc" size={15} /> عرض الإيصال</button>}
                    <a className="rm-btn ghost" href={`/pay/${r.id}`} target="_blank" rel="noreferrer"><Icon name="link" size={15} /> صفحة الفاتورة</a>
                    {canWrite && r.status !== 'paid' && r.status !== 'cancelled' && <button type="button" className="rm-btn ok" disabled={busy === r.id} onClick={() => setStatus(r.id, 'paid', r.method || 'bank_transfer')}><Icon name="check" size={15} /> تأكيد السداد</button>}
                    {canWrite && r.status === 'under_review' && <button type="button" className="rm-btn warn" disabled={busy === r.id} onClick={() => setStatus(r.id, 'unpaid')}><Icon name="refresh" size={15} /> رفض الإيصال (إعادة لبانتظار الدفع)</button>}
                    {canWrite && (r.status === 'unpaid' || r.status === 'under_review') && <button type="button" className="rm-btn ghost" disabled={busy === r.id} onClick={() => resend(r.id)}><Icon name="mail" size={15} /> إعادة إرسال الفاتورة</button>}
                    {canWrite && r.status !== 'waived' && r.status !== 'paid' && <button type="button" className="rm-btn ghost" disabled={busy === r.id} onClick={() => setStatus(r.id, 'waived')}><Icon name="award" size={15} /> إعفاء</button>}
                    {canWrite && r.status === 'paid' && <button type="button" className="rm-btn ghost" disabled={busy === r.id} onClick={() => { if (window.confirm('تسجيل الفاتورة كمستردّة؟')) setStatus(r.id, 'refunded'); }}><Icon name="refresh" size={15} /> استرداد</button>}
                    {canWrite && r.status !== 'cancelled' && r.status !== 'paid' && <button type="button" className="rm-btn ghost" disabled={busy === r.id} onClick={() => { if (window.confirm('إلغاء الفاتورة؟')) setStatus(r.id, 'cancelled'); }}><Icon name="x" size={15} /> إلغاء</button>}
                  </div>
                </div>
              )}
            </article>
          ))}
        </>)}

        {tab === 'pending' && (<>
          <div className="rm-card rm-muted">طلبات مقبولة لا فاتورة لها: إما أن البرنامج مجاني/بلا رسوم محددة (طبيعي)، أو قُبلت قبل ضبط الرسوم — اضبط الرسوم في «نشر البرامج» ثم أصدر الفاتورة من هنا.</div>
          {pending.length === 0 && <div className="rm-card rm-muted" style={{ textAlign: 'center' }}>لا يوجد.</div>}
          {pending.map(e => (
            <article key={e.id} className="rm-card py-row"><div className="py-top"><div className="py-who"><b>{e.full_name}</b><span dir="ltr">{e.email}</span></div><div className="py-meta"><span className="py-prog">{e.program_name}</span><span className="py-tag">{e.fee && Number(e.fee) > 0 ? <bdi>{money(e.fee, programs[e.program_id]?.currency || 'SAR', 'ar')}</bdi> : 'مجاني / بلا رسوم'}</span>{canWrite && Number(e.fee) > 0 && <button type="button" className="rm-btn" disabled={busy === e.id} onClick={() => issue(e.id)}><Icon name="plus" size={15} /> إصدار فاتورة</button>}</div></div></article>
          ))}
        </>)}

        {tab === 'settings' && form && (
          <form className="rm-card py-form" onSubmit={saveSettings}>
            <h3><Icon name="settings" size={18} /> البيانات البنكية</h3>
            <div className="g3">
              <label>اسم البنك<input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="مصرف الراجحي" disabled={!isAdmin} /></label>
              <label>اسم الحساب<input value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} disabled={!isAdmin} /></label>
              <label>IBAN<input dir="ltr" value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} placeholder="SA00 0000 0000 0000 0000 0000" disabled={!isAdmin} /></label>
              <label>SWIFT (اختياري)<input dir="ltr" value={form.swift || ''} onChange={e => setForm({ ...form, swift: e.target.value })} disabled={!isAdmin} /></label>
            </div>
            <h3><Icon name="scale" size={18} /> الضريبة والفوترة</h3>
            <div className="g3">
              <label>نسبة ضريبة القيمة المضافة %<input dir="ltr" inputMode="decimal" value={String(form.vat_rate)} onChange={e => setForm({ ...form, vat_rate: e.target.value })} disabled={!isAdmin} /></label>
              <label>الرقم الضريبي (اختياري)<input dir="ltr" value={form.vat_number || ''} onChange={e => setForm({ ...form, vat_number: e.target.value })} disabled={!isAdmin} /></label>
              <label>بادئة رقم الفاتورة<input dir="ltr" value={form.invoice_prefix} onChange={e => setForm({ ...form, invoice_prefix: e.target.value })} disabled={!isAdmin} /></label>
              <label>مهلة السداد (أيام)<input dir="ltr" inputMode="numeric" value={String(form.due_days)} onChange={e => setForm({ ...form, due_days: Number(e.target.value) })} disabled={!isAdmin} /></label>
              <label className="chk"><input type="checkbox" checked={form.prices_include_vat} onChange={e => setForm({ ...form, prices_include_vat: e.target.checked })} disabled={!isAdmin} /> الرسوم المعلنة شاملة الضريبة</label>
              {preview && <div className="py-preview">مثال لرسوم 1,000: قبل الضريبة <bdi>{preview.subtotal}</bdi> · ضريبة <bdi>{preview.vat}</bdi> · الإجمالي <bdi>{preview.total}</bdi></div>}
            </div>
            <h3><Icon name="shield" size={18} /> طرق الدفع</h3>
            <div className="g3">
              <label className="chk"><input type="checkbox" checked={form.bank_transfer_enabled} onChange={e => setForm({ ...form, bank_transfer_enabled: e.target.checked })} disabled={!isAdmin} /> التحويل البنكي (رفع إيصال + تأكيد الإدارة)</label>
              <label className="chk"><input type="checkbox" checked={form.card_enabled} onChange={e => setForm({ ...form, card_enabled: e.target.checked })} disabled={!isAdmin} /> البطاقات / Apple Pay عبر Moyasar</label>
              {isAdmin && <div className="py-preview" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} data-testid="wh-verify">
                <button type="button" className="rm-btn" onClick={() => void fetchWhCode()}>رمز توثيق Webhook (من Moyasar)</button>
                {whCode && (whCode.code ? <span>الرمز: <b dir="ltr" style={{ fontSize: 22, letterSpacing: '.15em' }} data-testid="wh-code">{whCode.code}</b> <small>({new Date(whCode.at || '').toLocaleString('ar-SA')}) — ألصقه في نافذة Verify Webhook (يصلح ٣٠ دقيقة)</small>{whCode.secret_ok === false && <b style={{ color: '#B9544A', display: 'block' }}>تنبيه: النصّ السرّي في Moyasar لا يطابق MOYASAR_WEBHOOK_SECRET في Vercel — صحّح أحدهما وإلا لن تُعتمد المدفوعات آليًّا.</b>}</span> : <span>لم يصل رمز بعد — اضغط «Resend code» في Moyasar ثم أعد الضغط هنا.{!whCode.configured && ' (المفاتيح غير مهيّأة في Vercel)'}</span>)}
              </div>}
              <div className="py-preview" style={{ gridColumn: '1/-1' }}>لتفعيل البطاقات: أنشئ حسابًا في moyasar.com، ثم أضف في Vercel المتغيرين <code>NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY</code> و<code>MOYASAR_SECRET_KEY</code> وأعد النشر، ثم فعّل الخيار أعلاه. للتأكيد الآلي حتى لو أغلق العميل المتصفح: في لوحة Moyasar → Settings → Webhooks أضف <code>{typeof window !== 'undefined' ? window.location.origin : ''}/api/payments/webhook</code> (POST، حدث payment_paid وpayment_refunded) مع Secret token تضعه أيضًا في Vercel باسم <code>MOYASAR_WEBHOOK_SECRET</code>. {process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY ? <b style={{ color: '#2F6B66' }}>المفتاح العام مضبوط ✓</b> : <b style={{ color: '#9A3A2A' }}>المفتاح العام غير مضبوط بعد</b>}</div>
            </div>
            <h3><Icon name="doc" size={18} /> الشروط على الفاتورة</h3>
            <div className="g2"><label>عربي<textarea value={form.terms_ar} onChange={e => setForm({ ...form, terms_ar: e.target.value })} disabled={!isAdmin} /></label><label>English<textarea dir="ltr" value={form.terms_en} onChange={e => setForm({ ...form, terms_en: e.target.value })} disabled={!isAdmin} /></label></div>
            {isAdmin ? <div><button className="rm-btn ok" disabled={busy === 'settings'}><Icon name="save" size={15} /> حفظ الإعدادات</button></div> : <p className="rm-muted">تعديل الإعدادات لمديري المنصة فقط.</p>}
          </form>
        )}
      </div>
    </div>
  );
}

const CSS = `
.py{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif}
.py-wrap{max-width:1100px;margin:0 auto;display:grid;gap:12px}.rm-kpis div{background:#fff;border:1px solid #EADFD6;border-radius:14px;padding:12px 14px;display:grid}.rm-kpis div.hot{border-color:#E9C98A;background:#FBF4EE}
.py-tabs{display:flex;gap:6px;flex-wrap:wrap}.py-tabs button{border:1px solid #D9CBC2;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;color:#4A3645}.py-tabs button.on{background:#3A1F36;border-color:#3A1F36;color:#fff}
.py-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.py-filters{display:flex;gap:6px;flex-wrap:wrap}.py-filters button{border:1px solid #D9CBC2;background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;color:#4A3645}.py-filters button.on{background:#D4614A;border-color:#D4614A;color:#fff}.py-tools input{font:inherit;font-size:13px;border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px;background:#fff;min-width:220px}
.py-row.under_review{border-inline-start:4px solid #8A5A1E}.py-row.paid{border-inline-start:4px solid #2F6B66}.py-row.unpaid{border-inline-start:4px solid #8E4A68}.py-row.overdue{border-inline-start-color:#D4614A}.py-row.cancelled,.py-row.refunded,.py-row.waived{opacity:.75}
.py-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer;align-items:center}.py-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#8E7F8A}.py-who b{color:#3A1F36;font-size:14px}
.py-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#8E7F8A}.py-meta>b{color:#3A1F36;font-size:14px}.py-prog{font-weight:800;color:#4A3645;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.py-tag{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#F6EBE0;color:#5C4858}.py-tag.unpaid{background:#F3E8EF;color:#6A3350}.py-tag.under_review{background:#FBF4EE;color:#9A3A2A}.py-tag.paid{background:#E6F3F1;color:#1F4F4A}.py-tag.overdue{background:#FBEDE7;color:#9A3A2A}
.py-body{margin-top:12px;border-top:1px dashed #EADFD6;padding-top:12px;display:grid;gap:10px}.py-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#8E7F8A}
.py-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#4A3645}.py-note input{font:inherit;font-size:13.5px;border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px}
.py-acts{display:flex;gap:8px;flex-wrap:wrap}
.py-form{display:grid;gap:12px}.py-form h3{margin:6px 0 0;font-size:16px;color:#3A1F36;display:flex;gap:8px;align-items:center}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.py-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#4A3645}.py-form input,.py-form textarea{font:inherit;font-size:13.5px;border:1px solid #D9CBC2;border-radius:10px;padding:8px 10px;background:#fff}.py-form textarea{min-height:80px}.py-form label.chk{display:flex;align-items:center;gap:8px;align-self:end;padding:8px 0}.py-preview{background:#FBF4EE;border:1px dashed #D9CBC2;border-radius:10px;padding:8px 12px;font-size:12.5px;color:#4A3645;align-self:end;line-height:1.8}.py-preview code{background:#EADFD6;border-radius:6px;padding:1px 6px;direction:ltr;display:inline-block}
.py-err{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.py-ok{background:#E6F3F1;border:1px solid #BFE1DC;color:#1F4F4A;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
@media(max-width:900px){.g3,.g2{grid-template-columns:1fr}}
`;
