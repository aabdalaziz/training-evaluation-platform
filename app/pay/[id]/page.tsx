'use client';

// أَثَر — صفحة الفاتورة والدفع (للمتقدّم): تحويل بنكي موثّق + بطاقة عبر Moyasar عند التفعيل + تنزيل PDF
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { BRAND, CONTACT, UI, t } from '../../../lib/portal/content';
import { money, invStatusLabel, methodLabel, formatIban, receiptPath, renderInvoice, jpegToPortraitPdf, toHalalas, IW, IH } from '../../../lib/portal/payments';
import type { Invoice, PaymentSettings } from '../../../lib/portal/payments';
import { canvasToJpeg, downloadBytes } from '../../../lib/certificates/render';

export default function PayPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

const MOYASAR_PK = process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || '';
const MPF = 'https://cdn.moyasar.com/mpf/1.15.0/moyasar';

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const sp = useSearchParams(); const id = String(params?.id || '');
  const db = useMemo(() => supabase(), []);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [inv, setInv] = useState<Invoice | null>(null); const [settings, setSettings] = useState<PaymentSettings | null>(null); const [programName, setProgramName] = useState('');
  const [loaded, setLoaded] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [ref, setRef] = useState(''); const [payerNote, setPayerNote] = useState('');
  const [tab, setTab] = useState<'bank' | 'card'>('bank'); const [cardReady, setCardReady] = useState(false); const canvasRef = useRef<HTMLCanvasElement>(null);

  async function load() {
    const { data: { user: u } } = await db.auth.getUser();
    if (!u) { setLoaded(true); return; }
    setUser({ id: u.id, email: u.email || '' }); try { localStorage.removeItem('athar_resume'); } catch { /* ignore */ }
    const [{ data: i, error }, { data: s }] = await Promise.all([db.from('portal_invoices').select('*').eq('id', id).maybeSingle(), db.from('portal_payment_settings').select('*').eq('id', 1).maybeSingle()]);
    if (error) setErr(error.message);
    setInv((i as Invoice) || null); setSettings((s as PaymentSettings) || null);
    if ((i as Invoice)?.program_id) { const { data: p } = await db.from('programs').select('name_ar,name_en').eq('id', (i as Invoice).program_id).maybeSingle(); setProgramName(String((lang === 'en' && (p as any)?.name_en) || (p as any)?.name_ar || '')); } else setProgramName(String((i as Invoice)?.description || ''));
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // العودة من Moyasar: ?id=<payment>&status=...
  useEffect(() => {
    const pid = sp.get('id'); const st = sp.get('status');
    if (!pid || !inv || !user || inv.status === 'paid') return;
    if (st && st !== 'paid') { setErr(lang === 'ar' ? `لم تكتمل عملية الدفع (${sp.get('message') || st}).` : `Payment not completed (${sp.get('message') || st}).`); return; }
    (async () => {
      setBusy(true);
      const { data: s } = await db.auth.getSession();
      const r = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'verify_card', id: inv.id, payment_id: pid }) });
      const j = await r.json().catch(() => ({}));
      if (j.success) { setOk(lang === 'ar' ? 'تم الدفع بنجاح — شكرًا لك.' : 'Payment successful — thank you.'); await load(); } else setErr(j.error || `HTTP ${r.status}`);
      setBusy(false); window.history.replaceState(null, '', `/pay/${inv.id}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id, user?.id]);

  // تحميل نموذج Moyasar عند اختيار البطاقة
  useEffect(() => {
    if (tab !== 'card' || !inv || !settings?.card_enabled || !MOYASAR_PK) return;
    const init = () => {
      const M = (window as any).Moyasar; if (!M) return;
      const el = document.querySelector('.mysr-form'); if (!el) return; el.innerHTML = '';
      M.init({ element: '.mysr-form', amount: toHalalas(inv.total), currency: inv.currency || 'SAR', description: `${inv.invoice_no} — ${programName}`.slice(0, 250), publishable_api_key: MOYASAR_PK, callback_url: `${window.location.origin}/pay/${inv.id}`, methods: ['creditcard', 'applepay', 'stcpay'], language: lang, metadata: { invoice_id: inv.id, invoice_no: inv.invoice_no } });
      setCardReady(true);
    };
    if ((window as any).Moyasar) { init(); return; }
    if (!document.getElementById('mpf-css')) { const l = document.createElement('link'); l.id = 'mpf-css'; l.rel = 'stylesheet'; l.href = `${MPF}.css`; document.head.appendChild(l); }
    const sc = document.createElement('script'); sc.src = `${MPF}.js`; sc.async = true; sc.onload = init; document.body.appendChild(sc);
  }, [tab, inv, settings, programName, lang]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy(true); try { localStorage.setItem('athar_resume', `/pay/${id}`); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/pay/${id}` } });
    setBusy(false); if (error) setErr(error.message); else setSent(true);
  }

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault(); if (!inv || !user) return; setErr(''); setOk('');
    if (!file && !ref.trim()) { setErr(lang === 'ar' ? 'أرفق صورة الإيصال أو اكتب رقم مرجع التحويل على الأقل.' : 'Attach the receipt image or enter the transfer reference.'); return; }
    if (file && file.size > 5 * 1024 * 1024) { setErr(lang === 'ar' ? 'حجم الملف يتجاوز 5MB' : 'File exceeds 5MB'); return; }
    setBusy(true);
    let path: string | null = inv.receipt_path || null;
    if (file) { const p = receiptPath(user.id, inv.invoice_no, file.name); const { error } = await db.storage.from('portal-receipts').upload(p, file, { upsert: false, contentType: file.type || undefined }); if (error) { setErr((lang === 'ar' ? 'تعذّر رفع الإيصال: ' : 'Upload failed: ') + error.message); setBusy(false); return; } path = p; }
    const { error } = await db.from('portal_invoices').update({ status: 'under_review', method: 'bank_transfer', receipt_path: path, receipt_uploaded_at: new Date().toISOString(), transfer_ref: ref.trim() || null, payer_note: payerNote.trim() || null }).eq('id', inv.id);
    if (error) { setErr(error.message); setBusy(false); return; }
    try { const { data: s } = await db.auth.getSession(); await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'submitted', id: inv.id }) }); } catch { /* اختياري */ }
    setOk(lang === 'ar' ? 'استلمنا إيصالك — سنؤكد السداد خلال يوم عمل ويصلك بريد بذلك.' : 'Receipt received — we will confirm within one business day and email you.'); setFile(null); setRef(''); setPayerNote('');
    await load(); setBusy(false);
  }

  async function downloadPdf() {
    if (!inv || !settings || !canvasRef.current) return; setBusy(true);
    try { await (document as any).fonts?.ready; } catch { /* ignore */ }
    renderInvoice(canvasRef.current, { inv, programName, settings, legal: { name_ar: BRAND.legal.ar, name_en: BRAND.legal.en, city: t(CONTACT.city, lang), email: CONTACT.email }, lang });
    const jpeg = canvasToJpeg(canvasRef.current, 0.92); downloadBytes(`${inv.invoice_no}.pdf`, jpegToPortraitPdf(jpeg, IW, IH, `Invoice ${inv.invoice_no}`)); setBusy(false);
  }

  const head = (title: string, sub?: string) => <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/programs">{lang === 'ar' ? 'البرامج' : 'Programs'}</Link> / <span>{lang === 'ar' ? 'الفاتورة' : 'Invoice'}</span></div><h1>{title}</h1>{sub && <p>{sub}</p>}</div></section>;

  if (!loaded) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;
  if (!user) return (
    <main className="pt-main">{head(lang === 'ar' ? 'عرض الفاتورة' : 'View invoice', lang === 'ar' ? 'للاطلاع على فاتورتك ودفعها، أدخل البريد الذي سجّلت به ليصلك رابط دخول آمن.' : 'Enter the email you registered with to receive a secure sign-in link.')}
      <section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 520 }}><div className="pt-box">
        {err && <div className="pt-alert err">{err}</div>}
        {sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط الدخول إلى بريدك.' : 'We sent a sign-in link to your email.'}</div> : <form className="pt-form" onSubmit={sendLink} noValidate><label>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}<input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="pt-btn" disabled={busy}><Icon name="mail" size={16} /> {lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link'}</button></form>}
      </div></div></section></main>
  );
  if (!inv) return <main className="pt-main">{head(lang === 'ar' ? 'الفاتورة غير متاحة' : 'Invoice unavailable', lang === 'ar' ? `لا توجد فاتورة بهذا الرقم مرتبطة بحسابك (${user.email}).` : `No invoice with this id is linked to your account (${user.email}).`)}<section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><button type="button" className="pt-btn ghost" onClick={async () => { await db.auth.signOut(); setUser(null); setInv(null); }}>{lang === 'ar' ? 'تبديل الحساب' : 'Switch account'}</button></div></section></main>;

  const open = inv.status === 'unpaid' || inv.status === 'under_review'; const cardOn = !!settings?.card_enabled && !!MOYASAR_PK; const bankOn = settings?.bank_transfer_enabled !== false;
  return (
    <main className="pt-main">
      {head(`${lang === 'ar' ? 'فاتورة' : 'Invoice'} ${inv.invoice_no}`, programName)}
      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          {err && <div className="pt-alert err" role="alert">{err}</div>}{ok && <div className="pt-alert ok" role="status">{ok}</div>}
          <div className="pt-box pt-invoice">
            <div className="pt-invtop"><span className={`pt-invstatus ${inv.status}`}>{invStatusLabel(inv.status, lang)}</span><button type="button" className="pt-btn ghost small" onClick={downloadPdf} disabled={busy || !settings}><Icon name="download" size={14} /> PDF</button></div>
            <table className="pt-invtable"><tbody>
              <tr><td>{lang === 'ar' ? 'البيان' : 'Description'}</td><td>{lang === 'en' && inv.program_id ? `Registration fee: ${programName}` : inv.description}</td></tr>
              <tr><td>{lang === 'ar' ? 'المجموع قبل الضريبة' : 'Subtotal'}</td><td><bdi>{money(inv.subtotal, inv.currency, lang)}</bdi></td></tr>
              <tr><td>{lang === 'ar' ? `ضريبة القيمة المضافة (${Number(inv.vat_rate)}%)` : `VAT (${Number(inv.vat_rate)}%)`}</td><td><bdi>{money(inv.vat_amount, inv.currency, lang)}</bdi></td></tr>
              <tr className="tot"><td>{lang === 'ar' ? 'الإجمالي المستحق' : 'Total due'}</td><td><bdi>{money(inv.total, inv.currency, lang)}</bdi></td></tr>
              <tr><td>{lang === 'ar' ? 'تاريخ الإصدار' : 'Issued'}</td><td><bdi>{inv.created_at.slice(0, 10)}</bdi></td></tr>
              {inv.due_date && <tr><td>{lang === 'ar' ? 'آخر موعد للسداد' : 'Due date'}</td><td><bdi>{inv.due_date}</bdi></td></tr>}
              {inv.paid_at && <tr><td>{lang === 'ar' ? 'تاريخ السداد' : 'Paid on'}</td><td><bdi>{inv.paid_at.slice(0, 10)}</bdi> · {methodLabel(inv.method, lang)}</td></tr>}
            </tbody></table>
            <p className="pt-muted" style={{ fontSize: 12.5 }}>{lang === 'ar' ? settings?.terms_ar : settings?.terms_en}</p>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <aside className="pt-box pt-sticky">
          {!open ? (
            <div><h3><Icon name={inv.status === 'paid' ? 'check' : 'x'} size={18} /> {invStatusLabel(inv.status, lang)}</h3><p className="pt-muted">{inv.status === 'paid' ? (lang === 'ar' ? 'شكرًا لك — سدادك مؤكّد ومقعدك محجوز. يمكنك تنزيل الفاتورة بصيغة PDF.' : 'Thank you — your payment is confirmed and your seat is secured. You can download the PDF invoice.') : (lang === 'ar' ? 'هذه الفاتورة لم تعد مستحقة.' : 'This invoice is no longer due.')}</p><Link href={`/programs/${inv.program_id}`} className="pt-btn ghost small">{lang === 'ar' ? 'صفحة البرنامج' : 'Program page'}</Link></div>
          ) : (
            <div>
              <h3><Icon name="shield" size={18} /> {lang === 'ar' ? 'طريقة الدفع' : 'Payment method'}</h3>
              <div className="pt-paytabs">{bankOn && <button type="button" className={tab === 'bank' ? 'on' : ''} onClick={() => setTab('bank')}><Icon name="doc" size={14} /> {lang === 'ar' ? 'تحويل بنكي' : 'Bank transfer'}</button>}{cardOn && <button type="button" className={tab === 'card' ? 'on' : ''} onClick={() => setTab('card')}><Icon name="shield" size={14} /> {lang === 'ar' ? 'بطاقة / Apple Pay' : 'Card / Apple Pay'}</button>}</div>
              {!bankOn && !cardOn && <p className="pt-muted">{lang === 'ar' ? 'لم تُفعَّل طرق الدفع بعد — تواصل معنا.' : 'No payment methods enabled yet — please contact us.'}</p>}
              {tab === 'bank' && bankOn && settings && (
                <div>
                  {inv.status === 'under_review' && <div className="pt-alert ok" style={{ marginBottom: 10 }}>{lang === 'ar' ? 'إيصالك قيد المراجعة. يمكنك رفع إيصال آخر إن لزم.' : 'Your receipt is under review. You may upload another if needed.'}</div>}
                  <div className="pt-bank">
                    <div><small>{lang === 'ar' ? 'البنك' : 'Bank'}</small><b>{settings.bank_name || '—'}</b></div>
                    <div><small>{lang === 'ar' ? 'اسم الحساب' : 'Account name'}</small><b>{settings.account_name}</b></div>
                    <div><small>IBAN</small><span className="pt-ibanrow"><b dir="ltr">{settings.iban ? formatIban(settings.iban) : '—'}</b>{settings.iban && <button type="button" className="pt-copy" onClick={() => navigator.clipboard?.writeText(settings.iban.replace(/\s+/g, ''))}><Icon name="copy" size={13} /> {lang === 'ar' ? 'نسخ' : 'Copy'}</button>}</span></div>
                    <div><small>{lang === 'ar' ? 'المبلغ' : 'Amount'}</small><b><bdi>{money(inv.total, inv.currency, lang)}</bdi></b></div>
                    <div><small>{lang === 'ar' ? 'وصف التحويل' : 'Transfer description'}</small><b dir="ltr">{inv.invoice_no}</b></div>
                  </div>
                  <form className="pt-form" onSubmit={submitTransfer} style={{ marginTop: 12 }}>
                    <label>{lang === 'ar' ? 'صورة الإيصال (JPG/PNG/PDF حتى 5MB)' : 'Receipt (JPG/PNG/PDF up to 5MB)'}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
                    <label>{lang === 'ar' ? 'رقم مرجع التحويل' : 'Transfer reference'}<input dir="ltr" value={ref} onChange={e => setRef(e.target.value)} /></label>
                    <label>{lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}<input value={payerNote} onChange={e => setPayerNote(e.target.value)} /></label>
                    <button className="pt-btn" disabled={busy}><Icon name="send" size={16} /> {busy ? '…' : (lang === 'ar' ? 'أرسلت التحويل — رفع الإيصال' : 'I have transferred — submit receipt')}</button>
                  </form>
                </div>
              )}
              {tab === 'card' && cardOn && <div><p className="pt-muted" style={{ marginTop: 0 }}>{lang === 'ar' ? 'دفع آمن عبر Moyasar (مدى، فيزا/ماستركارد، Apple Pay، STC Pay). لا تُخزَّن بيانات بطاقتك لدينا.' : 'Secure payment via Moyasar (mada, Visa/Mastercard, Apple Pay, STC Pay). Card data never touches our servers.'}</p><div className="mysr-form" />{!cardReady && <p className="pt-muted">…</p>}</div>}
            </div>
          )}
          <div className="pt-aside-foot"><Icon name="chat" size={14} /> {lang === 'ar' ? 'مشكلة في الدفع؟' : 'Payment issue?'} <Link href={`/contact?service=other`}>{t(UI.contactUs, lang)}</Link></div>
        </aside>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.pt-sticky{position:sticky;top:84px}.pt-muted{color:#64748b;font-size:13.5px;line-height:1.8;margin:8px 0}
.pt-invtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.pt-invstatus{border-radius:999px;padding:5px 14px;font-size:13px;font-weight:900;background:#eff6ff;color:#1e40af}.pt-invstatus.paid{background:#ecfdf5;color:#065f46}.pt-invstatus.under_review{background:#fff7ed;color:#9a3412}.pt-invstatus.cancelled,.pt-invstatus.refunded,.pt-invstatus.waived{background:#f1f5f9;color:#475569}
.pt-invtable{width:100%;border-collapse:collapse;font-size:14px}.pt-invtable td{padding:9px 0;border-bottom:1px solid #f1f5f9}.pt-invtable td:first-child{color:#64748b;width:45%}.pt-invtable td:last-child{font-weight:800;color:#0f172a}.pt-invtable tr.tot td{font-size:17px;color:#0f2a4e;border-bottom:2px solid #c9a24b}
.pt-paytabs{display:flex;gap:6px;margin:8px 0 12px}.pt-paytabs button{flex:1;display:inline-flex;justify-content:center;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px;font:inherit;font-size:13px;font-weight:900;color:#334155;cursor:pointer}.pt-paytabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.pt-bank{display:grid;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.pt-bank div{display:flex;flex-direction:column;gap:2px}.pt-bank small{font-size:11.5px;color:#64748b;font-weight:800}.pt-bank b{font-size:14px;color:#0f172a;word-break:break-all}
.pt-ibanrow{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.pt-copy{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:3px 8px;font:inherit;font-size:11.5px;font-weight:800;color:#0f2a4e;cursor:pointer;display:inline-flex;gap:4px;align-items:center;white-space:nowrap}
.pt-aside-foot{margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:12.5px;color:#64748b;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.pt-aside-foot a{color:#0b8a83;font-weight:800}
.pt-form input[type=file]{padding:8px}
@media(max-width:760px){.pt-sticky{position:static}}
`;
