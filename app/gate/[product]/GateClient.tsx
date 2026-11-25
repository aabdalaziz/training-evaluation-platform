'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/**
 * بوّابة التصريح (عميل): تقرأ حالة المنتج من /api/gate، وتقدّم أربعة أبواب:
 *  ① جرّب دقيقتين (مرّة لكلّ جهاز) ② اطلب تصريحًا (نموذج قصير) ③ لديّ رمز تصريح ④ لديّ حساب/أنا من الطاقم (يفتح بالجلسة).
 *  إن كان الباب مفتوحًا أصلًا لصاحب الجلسة/الكعكة يُحوَّل مباشرة إلى `next`.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '../../components/PortalShell';
import { Icon } from '../../../lib/ui/icons';
import { supabase } from '../../../lib/supabase/client';
import { CONTACT_AR, DEFAULT_MESSAGE_AR, HONEYPOT } from './shared';

type Info = { product: { slug: string; name_ar: string; name_en: string; mode: 'open' | 'permit' | 'closed'; trial_seconds: number; entry_path: string; message_ar: string | null }; unlocked: boolean; via: string | null; trial_active: number | null; trial_available: boolean };
const INTRO: Record<string, string> = {
  iqra: 'اقْرَأْ: حلقات قصيرة لتعلّم العربية على مستواك وفق الإطار الأوروبي المرجعي — تسمع وتقرأ وتنتج، ومراجعة بشرية لما تكتب.',
  kids: 'بَيان — أَثَر للأطفال: جلسات لعب وحروف وقصص، وتقرير للأهل عن كلّ جلسة.',
  sim: 'المحاكيات: سيناريوهات أداء واقعية تُقاس فيها قراراتك وتُترجم إلى أثر.',
  live: 'التعلّم المباشر: جلسات حيّة مع مدرّب، بحضور موثّق وشهادة.',
  'on-air': 'على الهواء: مواسم أَثَر الأسبوعية المباشرة.',
};
const CSS = `
.gt{max-width:980px;margin:0 auto;padding:28px 16px 70px;color:#2A1626}
.gt-hero{background:linear-gradient(135deg,#3A1F36,#22101F);color:#F6EBE0;border-radius:28px;padding:30px 28px;display:grid;grid-template-columns:1.2fr .8fr;gap:22px;align-items:center;box-shadow:0 14px 40px rgba(34,16,31,.25)}
@media(max-width:760px){.gt-hero{grid-template-columns:1fr;padding:22px 18px}}
.gt-k{color:#F1D9A8;font-weight:700;margin:0 0 6px;font-size:14px;letter-spacing:.3px}
.gt-h1{margin:0 0 10px;font-size:clamp(26px,3.6vw,38px);line-height:1.3}
.gt-p{font-size:17px;line-height:1.9;margin:0;color:#F6EBE0;opacity:.95}
.gt-msg{background:#FBF4EE;border:2px solid #F1D9A8;border-radius:22px;padding:18px 20px;color:#3A1F36;font-size:16px;line-height:1.9}
.gt-msg b{display:block;color:#B9544A;margin-bottom:4px}
.gt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}
.gt-card{background:#fff;border:2px solid #EADFD6;border-radius:22px;padding:20px;box-shadow:0 8px 24px rgba(58,31,54,.06)}
.gt-card h3{margin:0 0 6px;color:#3A1F36;font-size:19px;display:flex;align-items:center;gap:8px}
.gt-card p{margin:0 0 12px;color:#6B5B67;font-size:14.5px;line-height:1.8}
.gt-card.wide{grid-column:1/-1}
.gt-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:10px 22px;border-radius:999px;border:2px solid #E8795C;background:#E8795C;color:#fff;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none}
.gt-btn.ghost{background:#fff;color:#3A1F36;border-color:#D9CBC2}
.gt-btn.plum{background:#3A1F36;border-color:#3A1F36}
.gt-btn:disabled{opacity:.5;cursor:not-allowed}
.gt-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:600px){.gt-form{grid-template-columns:1fr}}
.gt-form label{display:grid;gap:4px;font-size:13px;color:#6B5B67;font-weight:700}
.gt-form input,.gt-form textarea{font:inherit;font-size:15px;padding:10px 12px;border:2px solid #EADFD6;border-radius:12px;background:#FFFDFB;color:#2A1626}
.gt-form textarea{min-height:84px;resize:vertical}
.gt-form .full{grid-column:1/-1}
.gt-ok{background:#E9F6F1;border:2px solid #5EA8A0;border-radius:16px;padding:14px 16px;color:#1F5F5A;font-weight:700;line-height:1.8}
.gt-err{color:#B9544A;font-weight:700;margin-top:8px}
.gt-code{display:flex;gap:8px;flex-wrap:wrap}
.gt-code input{font:inherit;font-size:18px;letter-spacing:3px;direction:ltr;text-align:center;padding:9px 12px;border:2px solid #EADFD6;border-radius:12px;width:190px;text-transform:uppercase}
.gt-contact{margin-top:22px;text-align:center;color:#6B5B67;font-size:14.5px;line-height:2}
.gt-contact a{color:#3A1F36;font-weight:700}
.gt-trial{font-size:13px;color:#8E7F8A;margin-top:6px}
`;

export default function GateClient({ slug, next, expired, codeError }: { slug: string; next: string | null; expired: boolean; codeError: string | null }) {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null); const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', org: '', purpose: '' }); const [sent, setSent] = useState<'received' | 'already' | null>(null); const [formErr, setFormErr] = useState<string | null>(null);
  const [code, setCode] = useState(''); const [codeMsg, setCodeMsg] = useState<string | null>(codeError ? ({ bad: 'الرمز غير صالح.', notfound: 'لا يوجد تصريح بهذا الرمز.', expired: 'انتهت صلاحية هذا التصريح — اطلب تجديده.', revoked: 'أُلغي هذا التصريح — تواصل معنا.', server: 'خلل مؤقّت — حاول لاحقًا.' } as Record<string, string>)[codeError] || 'تعذّر فتح الرابط.' : null);
  const [hasSession, setHasSession] = useState<boolean | null>(null); const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  const safeNext = useMemo(() => (next && /^\/[a-z0-9\-/_?=&%.]*$/i.test(next) && !next.startsWith('//') ? next : null), [next]);
  const target = (p: Info['product']) => safeNext && safeNext.startsWith(p.entry_path) ? safeNext : p.entry_path;

  useEffect(() => { (async () => {
    try { const r = await fetch(`/api/gate?product=${encodeURIComponent(slug)}`, { cache: 'no-store' }); const j = await r.json(); if (!j.success) { setErr(j.error || 'المنتج غير معروف'); return; } setInfo(j);
      if (j.unlocked || j.product.mode === 'open') { router.replace(target(j.product)); return; }
      const { data } = await supabase().auth.getSession(); setHasSession(!!data.session);
      if (data.session) { const u = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ action: 'unlock' }) }).then((x) => x.json()).catch(() => null);
        if (u?.success && (u.products?.includes('*') || u.products?.includes(slug))) { router.replace(target(j.product)); return; }
        if (u?.success) { setSessionMsg(u.via === 'permit' ? 'حسابك يحمل تصاريح لمنتجات أخرى، لا لهذا المنتج.' : 'حسابك لا يحمل تصريحًا لهذا المنتج بعد — اطلبه من هنا.'); setForm((f) => ({ ...f, email: f.email || String(data.session?.user.email || '') })); }
      }
    } catch { setErr('تعذّر الاتصال — حاول مرة أخرى'); }
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function startTrial() { if (!info) return; setBusy('trial'); try { const r = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'trial', product: slug }) }); const j = await r.json(); if (!j.success) { setErr(j.error); return; } window.location.assign(j.start_path || info.product.entry_path); } finally { setBusy(null); } }
  async function submit(e: React.FormEvent) { e.preventDefault(); setFormErr(null); setBusy('req'); try { const r = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', product: slug, lang: 'ar', ...form, [HONEYPOT]: (document.getElementById('gt-hp') as HTMLInputElement | null)?.value || '' }) }); const j = await r.json(); if (!j.success) { setFormErr(j.error || 'تعذّر الإرسال'); return; } setSent(j.state); } catch { setFormErr('تعذّر الإرسال — حاول مرة أخرى'); } finally { setBusy(null); } }
  async function redeem(e: React.FormEvent) { e.preventDefault(); setCodeMsg(null); setBusy('code'); try { const r = await fetch('/api/gate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'redeem', code }) }); const j = await r.json(); if (!j.success) { setCodeMsg(j.error || 'الرمز غير صالح'); return; } window.location.assign(j.product === slug ? target(info!.product) : j.entry_path || '/'); } catch { setCodeMsg('تعذّر التحقّق — حاول مرة أخرى'); } finally { setBusy(null); } }

  const p = info?.product; const minutes = p ? Math.max(1, Math.round(p.trial_seconds / 60)) : 2;
  return (
    <PortalShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="gt" dir="rtl">
        {err && !info ? <div className="gt-msg"><b>تعذّر</b>{err} — <Link href="/">العودة إلى الرئيسة</Link></div> : null}
        {!info && !err ? <div className="gt-msg">… جارٍ التحقّق من التصريح</div> : null}
        {p ? <>
          <section className="gt-hero">
            <div>
              <p className="gt-k">تصريح الدخول · {p.name_en}</p>
              <h1 className="gt-h1">{p.name_ar}</h1>
              <p className="gt-p">{INTRO[p.slug] || 'منتج من بوّابة أَثَر.'}</p>
            </div>
            <div className="gt-msg">
              <b>{expired ? 'انتهت دقائق التجربة — شكرًا لك' : p.mode === 'closed' ? 'الباب مغلق مؤقّتًا' : 'الدخول بتصريح'}</b>
              {p.message_ar || DEFAULT_MESSAGE_AR}
            </div>
          </section>

          <div className="gt-grid">
            {p.mode === 'permit' && info!.trial_available && !expired ? (
              <div className="gt-card"><h3><Icon name="play" size={18} /> جرّب {minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : `${minutes} دقائق`}</h3><p>طعمٌ سريع من المنتج بلا تسجيل. يبدأ العدّاد فور الضغط، ثمّ تعود إلى هذه الصفحة.</p>
                <button className="gt-btn" onClick={startTrial} disabled={busy === 'trial'}><Icon name="play" size={16} /> ابدأ التجربة الآن</button><div className="gt-trial">مرّة واحدة لكلّ جهاز.</div></div>
            ) : null}

            <div className="gt-card"><h3><Icon name="shield" size={18} /> لديّ رمز تصريح</h3><p>وصلك بريد من أَثَر فيه رمز من 10 أحرف؟ أدخله هنا ليُفتح الباب على هذا الجهاز.</p>
              <form className="gt-code" onSubmit={redeem}><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXXXX" maxLength={12} aria-label="رمز التصريح" /><button className="gt-btn plum" disabled={busy === 'code' || code.replace(/[^A-Z0-9]/gi, '').length < 10}>افتح</button></form>
              {codeMsg ? <div className="gt-err">{codeMsg}</div> : null}</div>

            <div className="gt-card"><h3><Icon name="login" size={18} /> لديّ حساب في أَثَر</h3><p>التصاريح تُربط ببريدك: سجّل الدخول ويُفتح الباب تلقائيًّا على أيّ جهاز. الطاقم يدخل مباشرة.</p>
              {hasSession ? <div className="gt-trial">{sessionMsg || 'جارٍ التحقّق…'}</div> : <Link className="gt-btn ghost" href={`/login?next=${encodeURIComponent(`/gate/${slug}${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`)}`}><Icon name="login" size={16} /> تسجيل الدخول</Link>}</div>

            <div className="gt-card wide" id="request"><h3><Icon name="send" size={18} /> اطلب تصريح الدخول</h3>
              {sent ? <div className="gt-ok">{sent === 'already' ? 'طلبك السابق لهذا المنتج ما زال قيد المراجعة — سنردّ على بريدك قريبًا.' : 'وصل طلبك. سيراجعه فريق أَثَر ويصلك بريد بتصريح الدخول خلال يوم عمل بإذن الله.'}</div> : (
                <><p>نراجع الطلبات يدويًّا ونردّ خلال يوم عمل. يصلك التصريح على بريدك برابط يفتح الباب مباشرة.</p>
                <form className="gt-form" onSubmit={submit}>
                  <label>الاسم الكامل *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} /></label>
                  <label>البريد الإلكتروني *<input required type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={160} /></label>
                  <label>الجوّال (واتساب)<input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+9665xxxxxxxx" maxLength={30} /></label>
                  <label>الجهة / المدرسة (اختياري)<input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} maxLength={120} /></label>
                  <label className="full">لماذا تريد الدخول؟ (اختياري)<textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} maxLength={600} placeholder="مثال: معلّمة لغة عربية أريد تجربة اقْرَأْ مع طلابي…" /></label>
                  <input id="gt-hp" name={HONEYPOT} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }} aria-hidden="true" />
                  <div className="full"><button className="gt-btn" disabled={busy === 'req'}><Icon name="send" size={16} /> أرسل الطلب</button>{formErr ? <div className="gt-err">{formErr}</div> : null}</div>
                </form></>)}
            </div>
          </div>

          <div className="gt-contact">تواصل مباشر: <a href={`mailto:${CONTACT_AR.email}`}>{CONTACT_AR.email}</a> · <a href={CONTACT_AR.wa} target="_blank" rel="noreferrer">واتساب</a> · <a href={`tel:${CONTACT_AR.phone.replace(/\s/g, '')}`} dir="ltr">{CONTACT_AR.phone}</a><br /><Link href="/">← العودة إلى بوّابة أَثَر</Link></div>
        </> : null}
      </main>
    </PortalShell>
  );
}
