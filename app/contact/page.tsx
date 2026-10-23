'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { CONTACT, CONTACT_SUBJECTS, UI, t, validateContact } from '../../lib/portal/content';

export default function ContactPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const sp = useSearchParams();
  const [f, setF] = useState({ name: '', email: '', phone: '', org: '', subject: 'other', message: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ok, setOk] = useState(false);
  useEffect(() => {
    const s = sp.get('service') || ''; const p = sp.get('program') || '';
    setF(x => ({ ...x, subject: CONTACT_SUBJECTS.some(c => c.value === s) ? s : x.subject, message: p ? (lang === 'ar' ? `أرغب بالتسجيل في برنامج: ${p}\n` : `I would like to register for: ${p}\n`) : x.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const v = validateContact(f, lang); if (v) { setErr(v); return; }
    setBusy(true);
    const { error } = await supabase().from('portal_contact_messages').insert({ name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.trim() || null, organization: f.org.trim() || null, subject: f.subject, message: f.message.trim(), lang, status: 'new', page: typeof window !== 'undefined' ? window.location.pathname + window.location.search : null });
    setBusy(false);
    if (error) setErr(lang === 'ar' ? `تعذّر الإرسال: ${error.message}` : `Could not send: ${error.message}`); else setOk(true);
  }

  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <span>{t(UI.contactUs, lang)}</span></div>
        <h1>{t(UI.contactUs, lang)}</h1><p>{lang === 'ar' ? 'أخبرنا عن احتياجك — نرد خلال يومي عمل.' : 'Tell us what you need — we reply within two business days.'}</p>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div className="pt-box">
          {ok ? (
            <div className="pt-alert ok" role="status"><Icon name="check" size={18} /> {lang === 'ar' ? 'وصلتنا رسالتك، شكرًا لك. سنتواصل معك قريبًا.' : 'Message received, thank you. We will be in touch soon.'}</div>
          ) : (
            <form className="pt-form" onSubmit={submit} noValidate>
              <div className="row">
                <label>{lang === 'ar' ? 'الاسم' : 'Name'}<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></label>
                <label>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}<input type="email" dir="ltr" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></label>
              </div>
              <div className="row">
                <label>{lang === 'ar' ? 'الجوال (اختياري)' : 'Phone (optional)'}<input dir="ltr" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
                <label>{lang === 'ar' ? 'الجهة (اختياري)' : 'Organisation (optional)'}<input value={f.org} onChange={e => setF({ ...f, org: e.target.value })} /></label>
              </div>
              <label>{lang === 'ar' ? 'الموضوع' : 'Subject'}<select value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })}>{CONTACT_SUBJECTS.map(s => <option key={s.value} value={s.value}>{t(s.label, lang)}</option>)}</select></label>
              <label>{lang === 'ar' ? 'الرسالة' : 'Message'}<textarea value={f.message} onChange={e => setF({ ...f, message: e.target.value })} required /></label>
              {err && <div className="pt-alert err" role="alert">{err}</div>}
              <div><button type="submit" className="pt-btn" disabled={busy}><Icon name="send" size={16} /> {busy ? (lang === 'ar' ? 'جارٍ الإرسال…' : 'Sending…') : (lang === 'ar' ? 'إرسال' : 'Send')}</button></div>
            </form>
          )}
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="pt-box"><h3><Icon name="mail" size={18} /> {t(UI.contactInfo, lang)}</h3>
            <ul>
              <li><Icon name="mail" size={15} /> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li><Icon name="chat" size={15} /> <bdi>{CONTACT.phone}</bdi></li>
              <li><Icon name="globe" size={15} /> {t(CONTACT.city, lang)}</li>
              <li><Icon name="clock" size={15} /> {t(CONTACT.hours, lang)}</li>
            </ul>
          </div>
          <div className="pt-box"><h3><Icon name="compass" size={18} /> {lang === 'ar' ? 'روابط مباشرة' : 'Direct links'}</h3>
            <ul>
              <li><Icon name="target" size={15} /> <a href="https://miaar-placement-test.vercel.app" target="_blank" rel="noreferrer">{lang === 'ar' ? 'اختبار تحديد المستوى (مِعيار)' : 'Placement test (Miaar)'}</a></li>
              <li><Icon name="users" size={15} /> <Link href="/me">{t(UI.student, lang)}</Link></li>
              <li><Icon name="certificate" size={15} /> <Link href="/verify">{t(UI.verify, lang)}</Link></li>
            </ul>
          </div>
        </div>
      </div></section>
    </main>
  );
}
