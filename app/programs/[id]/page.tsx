'use client';

// أَثَر — صفحة البرنامج + التسجيل (رابط دخول بالبريد ثم نموذج الطلب)
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { UI, t, programName, fmtDate, deliveryLabel, BRAND } from '../../../lib/portal/content';
import { typeLabel, feeLabel, regState, REG_LABEL, canApply, seatsLeft, durationLabel, pick, lines, validateEnrollment, statusLabel } from '../../../lib/portal/catalog';
import type { CatalogProgram, Counts, Enrollment, EnrollForm } from '../../../lib/portal/catalog';
import ProgramResources from '../../components/ProgramResources';
import UpcomingSessions from '../../components/UpcomingSessions';
import PlacementCard from '../../components/PlacementCard';

export default function ProgramPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

const SELECT = 'id,name_ar,name_en,status,delivery_mode,start_date,end_date,archived_at,cefr_level,intro_ar,intro_en,objectives_ar,objectives_en,outcomes_ar,outcomes_en,audience_ar,audience_en,fee,currency,seats,program_type,is_public,registration_open,registration_deadline,location_ar,location_en,hours';
const RESUME_KEY = 'athar_resume';

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const sp = useSearchParams(); const id = String(params?.id || '');
  const db = useMemo(() => supabase(), []);
  const [p, setP] = useState<CatalogProgram | null>(null); const [counts, setCounts] = useState<Counts | null>(null); const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [mine, setMine] = useState<Enrollment | null>(null); const [inv, setInv] = useState<{ id: string; invoice_no: string; status: string; total: number; currency: string } | null>(null);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false);
  const [f, setF] = useState<EnrollForm>({ full_name: '', email: '', phone: '', organization: '', city: '', notes: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        const [{ data }, { data: c }, { data: { user: u } }] = await Promise.all([db.from('programs').select(SELECT).eq('id', id).maybeSingle(), db.rpc('portal_enrollment_counts'), db.auth.getUser()]);
        setP((data as CatalogProgram) || null); setCounts(((c || []) as Counts[]).find(x => x.program_id === id) || null);
        if (u) {
          setUser({ id: u.id, email: u.email || '' }); setF(x => ({ ...x, email: u.email || '', full_name: String(u.user_metadata?.full_name || '') }));
          const { data: e } = await db.from('portal_enrollments').select('*').eq('program_id', id).eq('user_id', u.id).maybeSingle();
          setMine((e as Enrollment) || null);
          if (e && (e as Enrollment).status === 'approved') { const { data: i } = await db.from('portal_invoices').select('id,invoice_no,status,total,currency').eq('enrollment_id', (e as Enrollment).id).neq('status', 'cancelled').maybeSingle(); setInv((i as any) || null); }
          try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
        }
      } catch { /* يبقى فارغًا */ }
      setLoaded(true);
    })();
  }, [db, id]);
  useEffect(() => { if (loaded && sp.get('register') === '1') document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' }); }, [loaded, sp]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy(true);
    const target = `${window.location.origin}/programs/${id}?register=1`;
    try { localStorage.setItem(RESUME_KEY, `/programs/${id}?register=1`); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: target } });
    setBusy(false);
    if (error) setErr((lang === 'ar' ? 'تعذّر إرسال الرابط: ' : 'Could not send link: ') + error.message); else setSent(true);
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault(); setErr(''); if (!user || !p) return;
    const v = validateEnrollment({ ...f, email: user.email }, lang); if (v) { setErr(v); return; }
    setBusy(true);
    const { data, error } = await db.from('portal_enrollments').insert({ program_id: p.id, user_id: user.id, full_name: f.full_name.trim(), email: user.email.toLowerCase(), phone: f.phone.trim(), organization: f.organization.trim() || null, city: f.city.trim() || null, notes: f.notes.trim() || null, lang, status: 'pending' }).select('*').single();
    if (error) { setBusy(false); setErr(error.code === '23505' ? (lang === 'ar' ? 'لديك طلب سابق في هذا البرنامج بهذا البريد.' : 'You already applied to this program with this email.') : error.message); return; }
    setMine(data as Enrollment);
    try { const { data: s } = await db.auth.getSession(); await fetch('/api/enrollments', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'ack', id: (data as Enrollment).id }) }); } catch { /* البريد اختياري */ }
    setBusy(false); setOk(lang === 'ar' ? 'وصلنا طلبك — ستصلك نتيجة المراجعة على بريدك خلال يومي عمل.' : 'Application received — the review decision will reach your inbox within two business days.');
  }

  async function cancel() {
    if (!mine) return; if (!window.confirm(lang === 'ar' ? 'إلغاء طلب التسجيل؟' : 'Cancel this application?')) return;
    setBusy(true); const { error } = await db.from('portal_enrollments').update({ status: 'cancelled' }).eq('id', mine.id); setBusy(false);
    if (error) setErr(error.message); else setMine({ ...mine, status: 'cancelled' });
  }

  if (loaded && !p) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><h2>{lang === 'ar' ? 'البرنامج غير موجود' : 'Program not found'}</h2><Link href="/programs" className="pt-btn">{t(UI.allPrograms, lang)}</Link></div></section></main>;
  if (!p) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;

  const s = regState(p, today, counts); const left = seatsLeft(p, counts);
  const objectives = lines(pick(p, 'objectives', lang)), outcomes = lines(pick(p, 'outcomes', lang)); const audience = pick(p, 'audience', lang), intro = pick(p, 'intro', lang), location = pick(p, 'location', lang);

  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/programs">{lang === 'ar' ? 'البرامج' : 'Programs'}</Link> / <span>{programName(p, lang)}</span></div>
        <div className="pt-chips" style={{ marginTop: 8 }}><span className="pt-tag navy">{typeLabel(p.program_type, lang)}</span>{p.delivery_mode && <span className="pt-chip">{deliveryLabel(p.delivery_mode, lang)}</span>}<span className={`pt-tag ${s === 'open' ? '' : s === 'waitlist' ? 'soon' : 'off'}`}>{t(REG_LABEL[s], lang)}</span></div>
        <h1>{programName(p, lang)}</h1>
        {intro && <p>{intro}</p>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="pt-facts">
            <div><Icon name="calendar" size={18} /><span><small>{t(UI.starts, lang)}</small><b><bdi>{fmtDate(p.start_date, lang)}</bdi></b></span></div>
            <div><Icon name="calendar" size={18} /><span><small>{t(UI.ends, lang)}</small><b><bdi>{fmtDate(p.end_date, lang)}</bdi></b></span></div>
            {durationLabel(p, lang) && <div><Icon name="clock" size={18} /><span><small>{lang === 'ar' ? 'المدة' : 'Duration'}</small><b>{durationLabel(p, lang)}</b></span></div>}
            <div><Icon name="laptop" size={18} /><span><small>{t(UI.modes, lang)}</small><b>{deliveryLabel(p.delivery_mode, lang) || '—'}{location ? ` · ${location}` : ''}</b></span></div>
            <div><Icon name="scale" size={18} /><span><small>{lang === 'ar' ? 'الرسوم' : 'Fee'}</small><b>{feeLabel(p.fee, p.currency, lang)}</b></span></div>
            {left !== null && <div><Icon name="users" size={18} /><span><small>{lang === 'ar' ? 'المقاعد المتاحة' : 'Seats left'}</small><b>{left} / {p.seats}</b></span></div>}
          </div>
          {objectives.length > 0 && <div className="pt-box"><h3><Icon name="target" size={18} /> {lang === 'ar' ? 'الأهداف' : 'Objectives'}</h3><ul>{objectives.map((x, i) => <li key={i}><Icon name="check" size={15} /> {x}</li>)}</ul></div>}
          {outcomes.length > 0 && <div className="pt-box"><h3><Icon name="award" size={18} /> {lang === 'ar' ? 'المخرجات' : 'Outcomes'}</h3><ul>{outcomes.map((x, i) => <li key={i}><Icon name="check" size={15} /> {x}</li>)}</ul></div>}
          {audience && <div className="pt-box"><h3><Icon name="users" size={18} /> {lang === 'ar' ? 'الفئة المستهدفة' : 'Who is it for'}</h3><p style={{ margin: 0, lineHeight: 1.9, color: '#334155' }}>{audience}</p></div>}
          {(p.program_type === 'arabic' || p.cefr_level) && <PlacementCard lang={lang} compact programLevel={p.cefr_level || null} />}
          <UpcomingSessions programId={p.id} lang={lang} />
          <ProgramResources programId={p.id} lang={lang} />
          <div className="pt-box"><h3><Icon name="trend" size={18} /> {lang === 'ar' ? 'كيف نقيس الأثر؟' : 'How we measure impact'}</h3><p style={{ margin: 0, lineHeight: 1.9, color: '#334155', fontSize: 14 }}>{lang === 'ar' ? 'تقييمات يومية وختامية عبر منصة التقويم، تسجيل حضور رقمي، وشهادة قابلة للتحقق عند الإتمام — ثم متابعة نقل الأثر بعد 60–90 يومًا.' : 'Daily and final evaluations via the Evaluation Platform, digital attendance, a verifiable certificate on completion — then transfer-of-learning follow-up after 60–90 days.'}</p></div>
        </div>

        <aside id="register" className="pt-box pt-sticky">
          <h3><Icon name="send" size={18} /> {lang === 'ar' ? 'التسجيل في البرنامج' : 'Apply to this program'}</h3>
          {err && <div className="pt-alert err" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
          {mine ? (
            <div>
              <div className={`pt-status ${mine.status}`}><b>{statusLabel(mine.status, lang)}</b><small>{lang === 'ar' ? 'تاريخ الطلب' : 'Applied'}: <bdi>{fmtDate(mine.created_at.slice(0, 10), lang)}</bdi></small></div>
              {ok && <div className="pt-alert ok" style={{ marginTop: 10 }}>{ok}</div>}
              {mine.decision_note && <p className="pt-note">{mine.decision_note}</p>}
              {mine.status === 'pending' && !ok && <p className="pt-muted">{lang === 'ar' ? 'طلبك قيد المراجعة — ستصلك النتيجة بالبريد.' : 'Your application is under review — the decision will arrive by email.'}</p>}
              {mine.status === 'approved' && inv && inv.status !== 'paid' && inv.status !== 'waived' && <div className="pt-paybox"><b>{lang === 'ar' ? `فاتورة ${inv.invoice_no}` : `Invoice ${inv.invoice_no}`}</b><span><bdi>{new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en', { style: 'currency', currency: inv.currency || 'SAR', maximumFractionDigits: 2 }).format(Number(inv.total))}</bdi> · {inv.status === 'under_review' ? (lang === 'ar' ? 'الإيصال قيد المراجعة' : 'receipt under review') : (lang === 'ar' ? 'بانتظار السداد' : 'awaiting payment')}</span><Link href={`/pay/${inv.id}`} className="pt-btn small"><Icon name="shield" size={14} /> {lang === 'ar' ? 'ادفع الآن' : 'Pay now'}</Link></div>}
              {mine.status === 'approved' && inv && (inv.status === 'paid' || inv.status === 'waived') && <p className="pt-muted">{lang === 'ar' ? `✓ السداد مؤكّد (${inv.invoice_no}) — ` : `✓ Payment confirmed (${inv.invoice_no}) — `}<Link href={`/pay/${inv.id}`}>{lang === 'ar' ? 'عرض الفاتورة' : 'View invoice'}</Link></p>}
              {mine.status === 'approved' && <p className="pt-muted">{lang === 'ar' ? 'مبروك! تابع بريدك لتفاصيل الالتحاق، وستجد البرنامج في بوابة المتدرب عند بدئه.' : 'Congratulations! Watch your inbox for enrolment details; the program will appear in your student portal once it starts.'}</p>}
              {['pending', 'waitlisted'].includes(mine.status) && <button type="button" className="pt-btn ghost small" disabled={busy} onClick={cancel}><Icon name="x" size={14} /> {lang === 'ar' ? 'إلغاء الطلب' : 'Cancel application'}</button>}
              <div style={{ marginTop: 12 }}><Link href="/me" className="pt-more">{t(UI.student, lang)} <Icon name="arrow" size={13} /></Link></div>
            </div>
          ) : !canApply(s) ? (
            <div><p className="pt-muted">{s === 'full' ? (lang === 'ar' ? 'اكتملت مقاعد هذه الدورة. تواصل معنا لإبلاغك بالدورة القادمة.' : 'This cohort is full. Contact us to be notified about the next one.') : s === 'ended' ? (lang === 'ar' ? 'انتهى هذا البرنامج.' : 'This program has ended.') : (lang === 'ar' ? 'التسجيل غير متاح حاليًا.' : 'Registration is currently unavailable.')}</p><Link href={`/contact?service=training&program=${encodeURIComponent(p.name_ar)}`} className="pt-btn ghost"><Icon name="chat" size={15} /> {t(UI.contactUs, lang)}</Link></div>
          ) : !user ? (
            sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط تحقق إلى بريدك. افتحه من هذا الجهاز لتكمل التسجيل.' : 'We sent a verification link to your email. Open it on this device to continue.'}</div> : (
              <form className="pt-form" onSubmit={sendLink} noValidate>
                <p className="pt-muted" style={{ margin: 0 }}>{lang === 'ar' ? 'نتحقق من بريدك أولًا برابط دخول آمن (بلا كلمة مرور)، ثم تكمل بيانات الطلب.' : 'We first verify your email with a secure sign-in link (no password), then you complete the application.'}</p>
                <label>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}<input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} required /></label>
                <button type="submit" className="pt-btn" disabled={busy}><Icon name="mail" size={16} /> {busy ? '…' : (lang === 'ar' ? 'أرسل رابط التحقق' : 'Send verification link')}</button>
                {s === 'waitlist' && <p className="pt-muted" style={{ margin: 0 }}>{lang === 'ar' ? 'ملاحظة: المقاعد شبه مكتملة، وقد يُدرج طلبك في قائمة الانتظار.' : 'Note: seats are nearly full; your application may be waitlisted.'}</p>}
              </form>
            )
          ) : (
            <form className="pt-form" onSubmit={apply} noValidate>
              <label>{lang === 'ar' ? 'البريد (موثّق)' : 'Email (verified)'}<input dir="ltr" value={user.email} readOnly /></label>
              <label>{lang === 'ar' ? 'الاسم الكامل' : 'Full name'}<input value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} required /></label>
              <label>{lang === 'ar' ? 'الجوال (مع رمز الدولة)' : 'Phone (with country code)'}<input dir="ltr" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="+966 5X XXX XXXX" required /></label>
              <div className="row">
                <label>{lang === 'ar' ? 'الجهة (اختياري)' : 'Organisation (optional)'}<input value={f.organization} onChange={e => setF({ ...f, organization: e.target.value })} /></label>
                <label>{lang === 'ar' ? 'المدينة (اختياري)' : 'City (optional)'}<input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></label>
              </div>
              <label>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} style={{ minHeight: 80 }} /></label>
              <p className="pt-muted" style={{ margin: 0, fontSize: 12.5 }}>{lang === 'ar' ? 'بإرسال الطلب توافق على مراجعة بياناتك من فريق أَثَر لغرض القبول والتواصل.' : 'By applying you agree that the Athar team reviews your details for admission and contact purposes.'}</p>
              <button type="submit" className="pt-btn" disabled={busy}><Icon name="send" size={16} /> {busy ? '…' : (lang === 'ar' ? 'إرسال طلب التسجيل' : 'Submit application')}</button>
              <button type="button" className="pt-btn ghost small" onClick={async () => { await db.auth.signOut(); setUser(null); }}>{lang === 'ar' ? 'ليس بريدي — تبديل الحساب' : 'Not my email — switch account'}</button>
            </form>
          )}
          <div className="pt-aside-foot"><Icon name="target" size={14} /> {lang === 'ar' ? 'جديد في العربية؟' : 'New to Arabic?'} <a href={BRAND.placementUrl} target="_blank" rel="noreferrer">{lang === 'ar' ? 'حدّد مستواك مع مِعيار' : 'Take the Miaar test'}</a></div>
        </aside>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.pt-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.pt-facts>div{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;color:#0b8a83}.pt-facts span{display:flex;flex-direction:column;color:#0f172a}.pt-facts small{font-size:11.5px;color:#64748b;font-weight:800}.pt-facts b{font-size:14px}
.pt-sticky{position:sticky;top:84px}
.pt-status{border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;background:#f1f5f9;color:#334155}.pt-status.approved{background:#ecfdf5;color:#065f46}.pt-status.pending{background:#eff6ff;color:#1e40af}.pt-status.waitlisted{background:#fff7ed;color:#9a3412}.pt-status.rejected,.pt-status.cancelled{background:#f1f5f9;color:#475569}.pt-status b{font-size:16px}.pt-paybox{display:grid;gap:6px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;font-size:13px;color:#78350f}.pt-paybox b{color:#0f2a4e;font-size:14px}.pt-paybox a{justify-self:start}.pt-status small{font-size:12px;opacity:.85}
.pt-muted{color:#64748b;font-size:13.5px;line-height:1.8;margin:8px 0}.pt-note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:13.5px;color:#334155;line-height:1.7}
.pt-aside-foot{margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;font-size:12.5px;color:#64748b;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.pt-aside-foot a{color:#0b8a83;font-weight:800}
.pt-tag.off{background:#f1f5f9;color:#475569}
@media(max-width:760px){.pt-facts{grid-template-columns:1fr 1fr}.pt-sticky{position:static}}
`;
