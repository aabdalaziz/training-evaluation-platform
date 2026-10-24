'use client';

// أَثَر — الاستشارات: المجالات، المنهجية، ونموذج طلب استشارة (موثّق بالبريد)
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { UI, t } from '../../lib/portal/content';
import { AREAS, SECTORS, BUDGETS, STEPS, EMPTY_FORM, validateRequest, reqStatusLabel, areaLabel } from '../../lib/portal/consulting';
import type { ReqForm, ConsultingRequest } from '../../lib/portal/consulting';

export default function ConsultingPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

const RESUME_KEY = 'athar_resume';

function Inner() {
  const { lang } = useLang(); const router = useRouter(); const sp = useSearchParams(); const db = useMemo(() => supabase(), []);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [loaded, setLoaded] = useState(false);
  const [mine, setMine] = useState<ConsultingRequest[]>([]);
  const [f, setF] = useState<ReqForm>({ ...EMPTY_FORM, area: sp.get('area') || '' });
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await db.auth.getUser();
      if (u) {
        setUser({ id: u.id, email: u.email || '' }); setF(x => ({ ...x, email: u.email || '', full_name: x.full_name || String(u.user_metadata?.full_name || '') }));
        const { data } = await db.from('portal_consulting_requests').select('*').eq('user_id', u.id).order('created_at', { ascending: false }); setMine((data as ConsultingRequest[]) || []);
        try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
      }
      setLoaded(true);
    })();
  }, [db]);
  useEffect(() => { if (sp.get('request') === '1' && loaded) document.getElementById('request')?.scrollIntoView({ behavior: 'smooth' }); }, [sp, loaded]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy(true); try { localStorage.setItem(RESUME_KEY, `/consulting?request=1${f.area ? `&area=${f.area}` : ''}`); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/consulting?request=1${f.area ? `&area=${f.area}` : ''}` } });
    setBusy(false); if (error) setErr(error.message); else setSent(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!user) return; setErr('');
    const v = validateRequest({ ...f, email: user.email }, lang); if (v) { setErr(v); return; }
    setBusy(true);
    const row = { user_id: user.id, full_name: f.full_name.trim(), email: user.email, phone: f.phone.trim() || null, organization: f.organization.trim(), sector: f.sector || null, area: f.area, title: f.title.trim(), details: f.details.trim(), goals: f.goals.trim() || null, timeline: f.timeline.trim() || null, budget_range: f.budget_range || 'na', lang, status: 'new' };
    const { data, error } = await db.from('portal_consulting_requests').insert(row).select('*').single();
    if (error || !data) { setErr(error?.message || 'error'); setBusy(false); return; }
    try { const { data: s } = await db.auth.getSession(); await fetch('/api/consulting', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify({ action: 'submitted', id: (data as any).id }) }); } catch { /* البريد اختياري */ }
    router.push(`/consulting/${(data as any).id}?new=1`);
  }

  const inp = (k: keyof ReqForm, label: string, extra: any = {}) => <label>{label}<input value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} {...extra} /></label>;
  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/services">{t(UI.services, lang)}</Link> / <span>{lang === 'ar' ? 'الاستشارات' : 'Consulting'}</span></div>
        <h1>{lang === 'ar' ? 'الاستشارات' : 'Consulting'}</h1>
        <p>{lang === 'ar' ? 'نرافق المؤسسات من التشخيص إلى التحسين — بعرض سعر واضح، وتنفيذ على مراحل، وقياس للأثر.' : 'We accompany institutions from diagnosis to improvement — with a clear proposal, staged delivery and impact measurement.'}</p>
        <div className="pt-heroacts" style={{ marginTop: 14 }}><a href="#request" className="pt-btn gold"><Icon name="send" size={16} /> {lang === 'ar' ? 'اطلب استشارة' : 'Request a consultation'}</a>{user && mine.length > 0 && <a href="#mine" className="pt-btn light">{lang === 'ar' ? `طلباتي (${mine.length})` : `My requests (${mine.length})`}</a>}</div>
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{lang === 'ar' ? 'مجالات الاستشارة' : 'Consulting areas'}</h2></div>
        <div className="pt-grid cs-areas">{AREAS.map(a => <button type="button" key={a.value} className={`pt-card cs-area ${f.area === a.value ? 'on' : ''}`} onClick={() => { setF({ ...f, area: a.value }); document.getElementById('request')?.scrollIntoView({ behavior: 'smooth' }); }}><span className="pt-ic info"><Icon name={a.icon as IconName} size={24} /></span><h3>{t(a.label, lang)}</h3><p>{t(a.desc, lang)}</p><span className="pt-more">{lang === 'ar' ? 'اطلب في هذا المجال' : 'Request in this area'} <Icon name="arrow" size={13} /></span></button>)}</div>
      </div></section>

      <section className="pt-sec alt"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{lang === 'ar' ? 'كيف نعمل' : 'How we work'}</h2></div>
        <div className="cs-steps">{STEPS.map((s, i) => <div key={i} className="cs-step"><b>{i + 1}</b><h4>{t(s.label, lang)}</h4><p>{t(s.desc, lang)}</p></div>)}</div>
      </div></section>

      {user && mine.length > 0 && (
        <section className="pt-sec" id="mine"><div className="pt-wrap">
          <div className="pt-sechead"><h2>{lang === 'ar' ? 'طلباتي' : 'My requests'}</h2></div>
          <div className="cs-mine">{mine.map(r => <Link key={r.id} href={`/consulting/${r.id}`} className="cs-minerow"><span className={`pt-tag ${r.status}`}>{reqStatusLabel(r.status, lang)}</span><b>{r.title}</b><small>{areaLabel(r.area, lang)} · <bdi>{r.created_at.slice(0, 10)}</bdi></small><Icon name="arrow" size={14} /></Link>)}</div>
        </div></section>
      )}

      <section className="pt-sec" id="request"><div className="pt-wrap" style={{ maxWidth: 820 }}>
        <div className="pt-sechead"><h2>{lang === 'ar' ? 'طلب استشارة' : 'Request a consultation'}</h2><p>{lang === 'ar' ? 'نردّ بعرض مبدئي خلال 3 أيام عمل. البيانات سرية ولا تُستخدم إلا لدراسة طلبكم.' : 'We respond with an initial proposal within 3 business days. Your data stays confidential.'}</p></div>
        <div className="pt-box">
          {err && <div className="pt-alert err" role="alert">{err}</div>}
          {!loaded ? <p className="pt-empty">…</p> : !user ? (
            sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط التحقق إلى بريدك — افتحه لإكمال الطلب.' : 'We sent a verification link to your email — open it to continue.'}</div> : (
              <form className="pt-form" onSubmit={sendLink} noValidate>
                <p className="pt-muted" style={{ margin: 0 }}>{lang === 'ar' ? 'للبدء، أدخل بريدك الرسمي ليصلك رابط تحقق — ثم تكمل النموذج وتتابع طلبك وعرض السعر من الصفحة نفسها.' : 'Start with your work email to receive a verification link — then complete the form and track your request and proposal.'}</p>
                <label>{lang === 'ar' ? 'البريد الإلكتروني الرسمي' : 'Work email'}<input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@organization.sa" /></label>
                <button className="pt-btn" disabled={busy}><Icon name="mail" size={16} /> {busy ? '…' : (lang === 'ar' ? 'أرسل رابط التحقق' : 'Send verification link')}</button>
              </form>)
          ) : (
            <form className="pt-form" onSubmit={submit} noValidate>
              <div className="cs-two">{inp('full_name', lang === 'ar' ? 'الاسم الكامل *' : 'Full name *')}<label>{lang === 'ar' ? 'البريد' : 'Email'}<input value={user.email} disabled dir="ltr" /></label></div>
              <div className="cs-two">{inp('organization', lang === 'ar' ? 'الجهة *' : 'Organization *')}{inp('phone', lang === 'ar' ? 'الجوال (اختياري)' : 'Phone (optional)', { dir: 'ltr', inputMode: 'tel' })}</div>
              <div className="cs-two">
                <label>{lang === 'ar' ? 'القطاع' : 'Sector'}<select value={f.sector} onChange={e => setF({ ...f, sector: e.target.value })}><option value="">—</option>{SECTORS.map(s => <option key={s.value} value={s.value}>{t(s.label, lang)}</option>)}</select></label>
                <label>{lang === 'ar' ? 'مجال الاستشارة *' : 'Consulting area *'}<select value={f.area} onChange={e => setF({ ...f, area: e.target.value })}><option value="">—</option>{AREAS.map(a => <option key={a.value} value={a.value}>{t(a.label, lang)}</option>)}</select></label>
              </div>
              {inp('title', lang === 'ar' ? 'عنوان الطلب *' : 'Request title *', { placeholder: lang === 'ar' ? 'مثال: بناء نظام جودة داخلي استعدادًا للاعتماد' : 'e.g. Building an internal quality system for accreditation' })}
              <label>{lang === 'ar' ? 'وصف الحاجة والوضع الحالي *' : 'Describe the need and current situation *'}<textarea rows={5} value={f.details} onChange={e => setF({ ...f, details: e.target.value })} /></label>
              <label>{lang === 'ar' ? 'الأهداف المتوقعة (اختياري)' : 'Expected outcomes (optional)'}<textarea rows={3} value={f.goals} onChange={e => setF({ ...f, goals: e.target.value })} /></label>
              <div className="cs-two">{inp('timeline', lang === 'ar' ? 'التوقيت المرغوب (اختياري)' : 'Preferred timing (optional)', { placeholder: lang === 'ar' ? 'مثال: خلال الفصل الدراسي القادم' : 'e.g. next semester' })}
                <label>{lang === 'ar' ? 'الميزانية التقديرية' : 'Indicative budget'}<select value={f.budget_range} onChange={e => setF({ ...f, budget_range: e.target.value })}>{BUDGETS.map(b => <option key={b.value} value={b.value}>{t(b.label, lang)}</option>)}</select></label></div>
              <button className="pt-btn" disabled={busy}><Icon name="send" size={16} /> {busy ? '…' : (lang === 'ar' ? 'إرسال الطلب' : 'Submit request')}</button>
              <button type="button" className="pt-btn ghost small" onClick={async () => { await db.auth.signOut(); setUser(null); }}>{lang === 'ar' ? 'ليس بريدي — تبديل الحساب' : 'Not my email — switch account'}</button>
            </form>
          )}
        </div>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.cs-areas{grid-template-columns:repeat(4,1fr)}.cs-area{text-align:start;cursor:pointer;font:inherit;border:1px solid #e2e8f0;background:#fff}.cs-area.on{border-color:#0b8a83;box-shadow:0 0 0 3px rgba(11,138,131,.15)}.cs-area h3{margin:10px 0 6px;font-size:16px}.cs-area p{margin:0 0 10px;color:#64748b;font-size:13.5px;line-height:1.7}
.cs-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pt-muted{color:#64748b;font-size:13.5px;line-height:1.8}
.cs-mine{display:grid;gap:8px}.cs-minerow{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;text-decoration:none;color:#0f172a}.cs-minerow b{flex:1}.cs-minerow small{color:#64748b}
.pt-tag.new,.pt-tag.reviewing{background:#eff6ff;color:#1e40af}.pt-tag.quoted{background:#fff7ed;color:#9a3412}.pt-tag.accepted,.pt-tag.in_progress{background:#ecfdf5;color:#065f46}.pt-tag.completed{background:#f0fdfa;color:#0b8a83}.pt-tag.declined,.pt-tag.closed,.pt-tag.cancelled{background:#f1f5f9;color:#475569}
.pt-sec.alt{background:#f8fafc}
.cs-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.cs-step{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;position:relative}.cs-step b{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#c9a24b;color:#1f2937;font-size:17px;margin-bottom:10px}.cs-step h4{margin:0 0 6px;font-size:16px;color:#0f2a4e}.cs-step p{margin:0;color:#64748b;font-size:13.5px;line-height:1.7}
@media(max-width:960px){.cs-areas,.cs-steps{grid-template-columns:1fr 1fr}}@media(max-width:640px){.cs-areas,.cs-two{grid-template-columns:1fr}}
`;
