'use client';

// أَثَر — صفحة طلب الاستشارة للعميل: الخط الزمني، عرض السعر (قبول/اعتذار + PDF)، الفاتورة، مراحل التنفيذ، التحديثات
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { BRAND, CONTACT, UI, t } from '../../../lib/portal/content';
import { reqStatusLabel, areaLabel, sectorLabel, budgetLabel, TIMELINE, timelineIndex, isQuoteExpired, lines, cleanItems, renderQuote, QW, QH } from '../../../lib/portal/consulting';
import type { ConsultingRequest, Quote, Milestone, Update } from '../../../lib/portal/consulting';
import { money, invStatusLabel, jpegToPortraitPdf } from '../../../lib/portal/payments';
import type { Invoice, PaymentSettings } from '../../../lib/portal/payments';
import { canvasToJpeg, downloadBytes } from '../../../lib/certificates/render';

export default function RequestPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const sp = useSearchParams(); const id = String(params?.id || ''); const db = useMemo(() => supabase(), []);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [loaded, setLoaded] = useState(false);
  const [r, setR] = useState<ConsultingRequest | null>(null); const [quotes, setQuotes] = useState<Quote[]>([]); const [ms, setMs] = useState<Milestone[]>([]); const [ups, setUps] = useState<Update[]>([]); const [inv, setInv] = useState<Invoice | null>(null); const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(sp.get('new') === '1' ? (lang === 'ar' ? 'استلمنا طلبك — سنوافيك بعرض مبدئي خلال 3 أيام عمل.' : 'Request received — expect an initial proposal within 3 business days.') : '');
  const [note, setNote] = useState(''); const [msg, setMsg] = useState(''); const canvasRef = useRef<HTMLCanvasElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function load() {
    const { data: { user: u } } = await db.auth.getUser(); if (!u) { setLoaded(true); return; }
    setUser({ id: u.id, email: u.email || '' }); try { localStorage.removeItem('athar_resume'); } catch { /* ignore */ }
    const [{ data: rq }, { data: qs }, { data: m }, { data: up }, { data: s }] = await Promise.all([
      db.from('portal_consulting_requests').select('*').eq('id', id).maybeSingle(),
      db.from('portal_consulting_quotes').select('*').eq('request_id', id).order('version', { ascending: false }),
      db.from('portal_consulting_milestones').select('*').eq('request_id', id).eq('visible_to_client', true).order('position'),
      db.from('portal_consulting_updates').select('*').eq('request_id', id).eq('visible_to_client', true).order('created_at'),
      db.from('portal_payment_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    const req = (rq as ConsultingRequest) || null; setR(req); setQuotes((qs as Quote[]) || []); setMs((m as Milestone[]) || []); setUps((up as Update[]) || []); setSettings((s as PaymentSettings) || null);
    if (req?.invoice_id) { const { data: i } = await db.from('portal_invoices').select('*').eq('id', req.invoice_id).maybeSingle(); setInv((i as Invoice) || null); } else setInv(null);
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function api(payload: any) { const { data: s } = await db.auth.getSession(); const res = await fetch('/api/consulting', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(payload) }); const j = await res.json().catch(() => ({})); if (!res.ok || !j.success) throw new Error(j.error || `HTTP ${res.status}`); return j; }
  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy(true); try { localStorage.setItem('athar_resume', `/consulting/${id}`); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/consulting/${id}` } }); setBusy(false); if (error) setErr(error.message); else setSent(true);
  }
  async function respond(q: Quote, accept: boolean) {
    if (!accept && !window.confirm(lang === 'ar' ? 'تأكيد الاعتذار عن هذا العرض؟ يمكنك كتابة سبب أو طلب تعديل في الملاحظة.' : 'Decline this proposal? You can add a reason or change request in the note.')) return;
    setBusy(true); setErr(''); setOk('');
    try { const j = await api({ action: 'respond', quote_id: q.id, accept, note: note.trim() || undefined }); setNote(''); setOk(accept ? (lang === 'ar' ? 'شكرًا لقبولكم — صدرت الفاتورة ويمكنكم الدفع من الزر أدناه.' : 'Thank you — the invoice has been issued; pay using the button below.') : (lang === 'ar' ? 'سجّلنا اعتذاركم وسيتواصل معكم الفريق.' : 'Noted — our team will follow up.')); await load(); if (j.invoice_id) setTimeout(() => document.getElementById('invoice')?.scrollIntoView({ behavior: 'smooth' }), 300); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  async function cancel() {
    if (!r || !window.confirm(lang === 'ar' ? 'إلغاء الطلب؟' : 'Cancel this request?')) return; setBusy(true);
    const { error } = await db.from('portal_consulting_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', r.id); setBusy(false); if (error) setErr(error.message); else await load();
  }
  async function post(e: React.FormEvent) {
    e.preventDefault(); if (!r || !user || msg.trim().length < 2) return; setBusy(true); setErr('');
    const { data, error } = await db.from('portal_consulting_updates').insert({ request_id: r.id, author_id: user.id, author_name: r.full_name, by_staff: false, body: msg.trim().slice(0, 4000), visible_to_client: true }).select('*').single();
    if (error) setErr(error.message); else { setMsg(''); try { await api({ action: 'update_posted', update_id: (data as any).id }); } catch { /* اختياري */ } await load(); }
    setBusy(false);
  }
  async function pdf(q: Quote) {
    if (!r || !canvasRef.current) return; setBusy(true); try { await (document as any).fonts?.ready; } catch { /* ignore */ }
    renderQuote(canvasRef.current, { r, q, settings, legal: { name_ar: BRAND.legal.ar, name_en: BRAND.legal.en, city: t(CONTACT.city, lang), email: CONTACT.email }, lang });
    downloadBytes(`proposal-${r.id.slice(0, 8)}-v${q.version}.pdf`, jpegToPortraitPdf(canvasToJpeg(canvasRef.current, 0.92), QW, QH, `Proposal ${r.title}`)); setBusy(false);
  }

  const head = (title: string, sub?: string) => <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/consulting">{lang === 'ar' ? 'الاستشارات' : 'Consulting'}</Link> / <span>{lang === 'ar' ? 'طلبي' : 'My request'}</span></div><h1>{title}</h1>{sub && <p>{sub}</p>}</div></section>;
  if (!loaded) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;
  if (!user) return <main className="pt-main">{head(lang === 'ar' ? 'متابعة طلب الاستشارة' : 'Track your request', lang === 'ar' ? 'أدخل البريد الذي قدّمت به الطلب ليصلك رابط دخول آمن.' : 'Enter the email you used to receive a secure sign-in link.')}<section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 520 }}><div className="pt-box">{err && <div className="pt-alert err">{err}</div>}{sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط الدخول إلى بريدك.' : 'We sent a sign-in link to your email.'}</div> : <form className="pt-form" onSubmit={sendLink} noValidate><label>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}<input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} /></label><button className="pt-btn" disabled={busy}><Icon name="mail" size={16} /> {lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link'}</button></form>}</div></div></section></main>;
  if (!r) return <main className="pt-main">{head(lang === 'ar' ? 'الطلب غير متاح' : 'Request unavailable', lang === 'ar' ? `لا يوجد طلب بهذا الرقم مرتبط بحسابك (${user.email}).` : `No request with this id is linked to ${user.email}.`)}<section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><button type="button" className="pt-btn ghost" onClick={async () => { await db.auth.signOut(); setUser(null); setR(null); }}>{lang === 'ar' ? 'تبديل الحساب' : 'Switch account'}</button></div></section></main>;

  const open = quotes.find(q => q.status === 'sent'); const accepted = quotes.find(q => q.status === 'accepted'); const ti = timelineIndex(r.status); const done = ms.filter(m => m.status === 'done').length;
  return (
    <main className="pt-main">
      {head(r.title, `${areaLabel(r.area, lang)} · ${r.organization || ''} · ${lang === 'ar' ? 'رقم' : 'Ref'} ${r.id.slice(0, 8).toUpperCase()}`)}
      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          {err && <div className="pt-alert err" role="alert">{err}</div>}{ok && <div className="pt-alert ok" role="status">{ok}</div>}
          <div className="pt-box">
            <div className="cs-head"><span className={`pt-tag ${r.status}`}>{reqStatusLabel(r.status, lang)}</span>{['new', 'reviewing'].includes(r.status) && <button type="button" className="pt-btn ghost small" disabled={busy} onClick={cancel}><Icon name="x" size={14} /> {lang === 'ar' ? 'إلغاء الطلب' : 'Cancel request'}</button>}</div>
            {ti >= 0 && <ol className="cs-timeline">{TIMELINE.map((s, i) => <li key={s} className={i < ti ? 'done' : i === ti ? 'now' : ''}><i>{i < ti ? <Icon name="check" size={12} /> : i + 1}</i><span>{reqStatusLabel(s, lang).split(' — ')[0]}</span></li>)}</ol>}
            <dl className="cs-dl"><dt>{lang === 'ar' ? 'الجهة' : 'Organization'}</dt><dd>{r.organization || '—'} · {sectorLabel(r.sector, lang)}</dd><dt>{lang === 'ar' ? 'الوصف' : 'Details'}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.details}</dd>{r.goals && <><dt>{lang === 'ar' ? 'الأهداف' : 'Goals'}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.goals}</dd></>}<dt>{lang === 'ar' ? 'التوقيت / الميزانية' : 'Timing / budget'}</dt><dd>{r.timeline || '—'} · {budgetLabel(r.budget_range, lang)}</dd></dl>
          </div>

          {(open || accepted || quotes.length > 0) && quotes.filter(q => q.status !== 'draft').map(q => (
            <div key={q.id} className={`pt-box cs-quote ${q.status}`} id={q.status === 'sent' ? 'quote' : undefined}>
              <div className="cs-head"><h3 style={{ margin: 0 }}><Icon name="doc" size={18} /> {lang === 'ar' ? `عرض السعر — الإصدار ${q.version}` : `Proposal — v${q.version}`}</h3><span className="cs-qst">{q.status === 'sent' ? (isQuoteExpired(q, today) ? (lang === 'ar' ? 'انتهت صلاحيته' : 'Expired') : (lang === 'ar' ? 'بانتظار ردّكم' : 'Awaiting your response')) : q.status === 'accepted' ? (lang === 'ar' ? 'مقبول' : 'Accepted') : q.status === 'declined' ? (lang === 'ar' ? 'معتذر عنه' : 'Declined') : (lang === 'ar' ? 'مستبدل' : 'Superseded')}</span></div>
              {q.scope && <p className="cs-p"><b>{lang === 'ar' ? 'نطاق العمل:' : 'Scope:'}</b> {q.scope}</p>}
              {q.deliverables && <div className="cs-p"><b>{lang === 'ar' ? 'المخرجات:' : 'Deliverables:'}</b><ul>{lines(q.deliverables).map((l, i) => <li key={i}><Icon name="check" size={14} /> {l}</li>)}</ul></div>}
              {q.duration && <p className="cs-p"><b>{lang === 'ar' ? 'المدة:' : 'Duration:'}</b> {q.duration}</p>}
              <table className="cs-items"><thead><tr><th>{lang === 'ar' ? 'البند' : 'Item'}</th><th>{lang === 'ar' ? 'الكمية' : 'Qty'}</th><th>{lang === 'ar' ? 'سعر الوحدة' : 'Unit'}</th><th>{lang === 'ar' ? 'المجموع' : 'Amount'}</th></tr></thead><tbody>{cleanItems(q.items).map((it, i) => <tr key={i}><td>{it.d}</td><td>{it.q}</td><td><bdi>{money(it.u, q.currency, lang)}</bdi></td><td><bdi>{money(it.q * it.u, q.currency, lang)}</bdi></td></tr>)}</tbody>
                <tfoot><tr><td colSpan={3}>{lang === 'ar' ? 'قبل الضريبة' : 'Subtotal'}</td><td><bdi>{money(q.subtotal, q.currency, lang)}</bdi></td></tr><tr><td colSpan={3}>{lang === 'ar' ? `الضريبة (${Number(q.vat_rate)}%)` : `VAT (${Number(q.vat_rate)}%)`}</td><td><bdi>{money(q.vat_amount, q.currency, lang)}</bdi></td></tr><tr className="tot"><td colSpan={3}>{lang === 'ar' ? 'الإجمالي' : 'Total'}</td><td><bdi>{money(q.total, q.currency, lang)}</bdi></td></tr></tfoot></table>
              {q.terms && <p className="cs-p pt-muted">{q.terms}</p>}
              <div className="cs-acts">
                <button type="button" className="pt-btn ghost small" disabled={busy} onClick={() => pdf(q)}><Icon name="download" size={14} /> PDF</button>
                {q.valid_until && <span className="pt-muted">{lang === 'ar' ? 'صالح حتى' : 'Valid until'} <bdi>{q.valid_until}</bdi></span>}
              </div>
              {q.status === 'sent' && !isQuoteExpired(q, today) && (
                <div className="cs-respond">
                  <label>{lang === 'ar' ? 'ملاحظة أو طلب تعديل (اختياري)' : 'Note or change request (optional)'}<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
                  <div className="cs-acts"><button type="button" className="pt-btn" disabled={busy} onClick={() => respond(q, true)}><Icon name="check" size={16} /> {lang === 'ar' ? 'أوافق على العرض' : 'Accept proposal'}</button><button type="button" className="pt-btn ghost" disabled={busy} onClick={() => respond(q, false)}><Icon name="x" size={16} /> {lang === 'ar' ? 'اعتذار / طلب تعديل' : 'Decline / request changes'}</button></div>
                  <p className="pt-muted" style={{ margin: 0 }}>{lang === 'ar' ? 'بالموافقة تصدر فاتورة إلكترونية ويبدأ التنفيذ بعد تأكيد السداد (أو حسب الاتفاق).' : 'On acceptance an e-invoice is issued; delivery starts after payment confirmation (or as agreed).'}</p>
                </div>
              )}
            </div>
          ))}

          {ms.length > 0 && <div className="pt-box"><h3><Icon name="target" size={18} /> {lang === 'ar' ? 'مراحل التنفيذ' : 'Milestones'} <small className="pt-muted">{done}/{ms.length}</small></h3><ol className="cs-ms">{ms.map(m => <li key={m.id} className={m.status}><i>{m.status === 'done' ? <Icon name="check" size={12} /> : m.status === 'in_progress' ? <Icon name="play" size={12} /> : ''}</i><div><b>{m.title}</b>{m.note && <p>{m.note}</p>}<small>{m.due_date && <>{lang === 'ar' ? 'الموعد' : 'Due'}: <bdi>{m.due_date}</bdi></>}{m.done_at && <> · {lang === 'ar' ? 'أُنجز' : 'Done'}: <bdi>{m.done_at.slice(0, 10)}</bdi></>}</small></div></li>)}</ol></div>}

          <div className="pt-box"><h3><Icon name="chat" size={18} /> {lang === 'ar' ? 'التحديثات والمراسلات' : 'Updates & messages'}</h3>
            {ups.length === 0 && <p className="pt-muted">{lang === 'ar' ? 'لا تحديثات بعد.' : 'No updates yet.'}</p>}
            <div className="cs-ups">{ups.map(u => <div key={u.id} className={`cs-up ${u.by_staff ? 'staff' : 'me'}`}><small>{u.by_staff ? (lang === 'ar' ? 'فريق أَثَر' : 'Athar team') : (lang === 'ar' ? 'أنت' : 'You')} · <bdi>{new Date(u.created_at).toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en', { dateStyle: 'medium', timeStyle: 'short' })}</bdi></small><p>{u.body}</p></div>)}</div>
            {!['closed', 'cancelled', 'declined'].includes(r.status) && <form className="pt-form" onSubmit={post}><label>{lang === 'ar' ? 'أضف رسالة للفريق' : 'Message the team'}<textarea rows={2} value={msg} onChange={e => setMsg(e.target.value)} /></label><button className="pt-btn ghost small" disabled={busy || msg.trim().length < 2}><Icon name="send" size={14} /> {lang === 'ar' ? 'إرسال' : 'Send'}</button></form>}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <aside className="pt-box pt-sticky" id="invoice">
          <h3><Icon name="shield" size={18} /> {lang === 'ar' ? 'الحالة والدفع' : 'Status & payment'}</h3>
          <p className="pt-muted" style={{ marginTop: 0 }}>{r.status === 'new' ? (lang === 'ar' ? 'استلمنا طلبكم وسيبدأ الفريق دراسته.' : 'Received — our team will start reviewing.') : r.status === 'reviewing' ? (lang === 'ar' ? 'الطلب قيد الدراسة — ستصلكم رسالة عند جاهزية عرض السعر.' : 'Under review — you will be emailed when the proposal is ready.') : r.status === 'quoted' ? (lang === 'ar' ? 'عرض السعر جاهز — راجعوه وردّوا من القسم أعلاه.' : 'Proposal ready — review and respond above.') : r.status === 'accepted' ? (lang === 'ar' ? 'تم القبول — يبدأ التنفيذ بعد تأكيد السداد.' : 'Accepted — delivery starts after payment.') : r.status === 'in_progress' ? (lang === 'ar' ? 'المشروع قيد التنفيذ — تابعوا المراحل والتحديثات.' : 'In progress — follow milestones and updates.') : r.status === 'completed' ? (lang === 'ar' ? 'اكتمل المشروع — شكرًا لثقتكم.' : 'Completed — thank you.') : reqStatusLabel(r.status, lang)}</p>
          {inv && <div className="cs-inv"><small>{lang === 'ar' ? 'الفاتورة' : 'Invoice'}</small><b dir="ltr">{inv.invoice_no}</b><span><bdi>{money(inv.total, inv.currency, lang)}</bdi> · {invStatusLabel(inv.status, lang)}</span><Link href={`/pay/${inv.id}`} className={`pt-btn ${inv.status === 'paid' ? 'ghost' : ''} small`}><Icon name="shield" size={14} /> {inv.status === 'paid' || inv.status === 'waived' ? (lang === 'ar' ? 'عرض الفاتورة' : 'View invoice') : (lang === 'ar' ? 'ادفع الآن' : 'Pay now')}</Link></div>}
          {open && !isQuoteExpired(open, today) && <a href="#quote" className="pt-btn gold" style={{ marginTop: 10 }}><Icon name="doc" size={15} /> {lang === 'ar' ? 'مراجعة عرض السعر' : 'Review proposal'}</a>}
          <div className="pt-aside-foot"><Icon name="chat" size={14} /> {lang === 'ar' ? 'استفسار؟' : 'Questions?'} <Link href="/contact?service=consulting">{t(UI.contactUs, lang)}</Link></div>
        </aside>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.pt-sticky{position:sticky;top:84px}.pt-muted{color:#64748b;font-size:13.5px;line-height:1.8}
.cs-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.pt-tag.new,.pt-tag.reviewing{background:#eff6ff;color:#1e40af}.pt-tag.quoted{background:#fff7ed;color:#9a3412}.pt-tag.accepted,.pt-tag.in_progress{background:#ecfdf5;color:#065f46}.pt-tag.completed{background:#f0fdfa;color:#0b8a83}.pt-tag.declined,.pt-tag.closed,.pt-tag.cancelled{background:#f1f5f9;color:#475569}
.cs-timeline{list-style:none;margin:6px 0 14px;padding:0;display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.cs-timeline li{display:grid;justify-items:center;gap:4px;font-size:11.5px;color:#94a3b8;text-align:center;position:relative}.cs-timeline li i{width:26px;height:26px;border-radius:50%;background:#e2e8f0;color:#64748b;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900}.cs-timeline li.done i{background:#0b8a83;color:#fff}.cs-timeline li.now i{background:#0f2a4e;color:#fff;box-shadow:0 0 0 4px rgba(15,42,78,.15)}.cs-timeline li.done,.cs-timeline li.now{color:#0f172a;font-weight:800}
.cs-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0;font-size:13.5px}.cs-dl dt{color:#64748b;font-weight:800}.cs-dl dd{margin:0;color:#0f172a;line-height:1.7}
.cs-quote.sent{border-color:#c9a24b;box-shadow:0 0 0 3px rgba(201,162,75,.15)}.cs-quote.superseded,.cs-quote.declined{opacity:.7}.cs-qst{font-size:12.5px;font-weight:900;color:#9a3412;background:#fff7ed;border-radius:999px;padding:4px 12px}.cs-quote.accepted .cs-qst{background:#ecfdf5;color:#065f46}
.cs-p{margin:6px 0;font-size:13.5px;line-height:1.8;color:#0f172a}.cs-p ul{margin:4px 0 0;padding:0;list-style:none}.cs-p li{display:flex;gap:6px;align-items:flex-start}
.cs-items{width:100%;border-collapse:collapse;font-size:13.5px;margin:10px 0}.cs-items th{background:#0f2a4e;color:#fff;padding:8px;font-size:12.5px;text-align:start}.cs-items td{padding:8px;border-bottom:1px solid #f1f5f9}.cs-items tfoot td{color:#64748b;font-weight:800}.cs-items tr.tot td{font-size:16px;color:#0f2a4e;font-weight:900;border-bottom:2px solid #c9a24b}
.cs-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.cs-respond{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;display:grid;gap:8px}.cs-respond textarea{width:100%;font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px}
.cs-ms{list-style:none;margin:0;padding:0;display:grid;gap:10px}.cs-ms li{display:flex;gap:10px;align-items:flex-start}.cs-ms li i{flex:none;width:24px;height:24px;border-radius:50%;background:#e2e8f0;display:grid;place-items:center;color:#64748b;margin-top:2px}.cs-ms li.done i{background:#0b8a83;color:#fff}.cs-ms li.in_progress i{background:#c9a24b;color:#1f2937}.cs-ms li b{font-size:14px}.cs-ms li p{margin:2px 0;font-size:13px;color:#334155}.cs-ms li small{color:#64748b;font-size:12px}
.cs-ups{display:grid;gap:8px;margin-bottom:12px}.cs-up{border-radius:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0}.cs-up.staff{background:#f0fdfa;border-color:#99f6e4}.cs-up small{color:#64748b;font-weight:800;font-size:11.5px}.cs-up p{margin:4px 0 0;font-size:13.5px;white-space:pre-wrap;line-height:1.7}
.cs-inv{display:grid;gap:4px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;font-size:13px;color:#78350f}.cs-inv b{color:#0f2a4e;font-size:15px}.cs-inv a{justify-self:start;margin-top:4px}
.pt-aside-foot{margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:12.5px;color:#64748b;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.pt-aside-foot a{color:#0b8a83;font-weight:800}
@media(max-width:760px){.pt-sticky{position:static}.cs-timeline{grid-template-columns:repeat(3,1fr)}}
`;
