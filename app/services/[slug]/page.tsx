'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { SERVICES, UI, t, serviceBySlug } from '../../../lib/portal/content';

export default function ServicePage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang();
  const params = useParams<{ slug: string }>();
  const s = serviceBySlug(String(params?.slug || ''));
  if (!s) return (
    <main className="pt-main"><section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}>
      <h2>{lang === 'ar' ? 'الخدمة غير موجودة' : 'Service not found'}</h2>
      <Link href="/services" className="pt-btn">{t(UI.allServices, lang)}</Link>
    </div></section></main>
  );
  const others = SERVICES.filter(x => x.slug !== s.slug).slice(0, 4);
  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/services">{t(UI.services, lang)}</Link> / <span>{t(s.title, lang)}</span></div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}><span className={`pt-ic ${s.tone}`}><Icon name={s.icon} size={26} /></span><span className={`pt-tag ${s.status === 'soon' ? 'soon' : ''}`}>{s.status === 'soon' ? `${t(UI.soon, lang)}${s.phase ? ` · ${s.phase}` : ''}` : t(UI.live, lang)}</span></div>
        <h1>{t(s.title, lang)}</h1><p>{t(s.short, lang)}</p>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div>
          <div className="pt-prose">{s.long.map((p, i) => <p key={i}>{t(p, lang)}</p>)}</div>
          <div className="pt-heroacts" style={{ marginTop: 18 }}>
            {s.cta.external ? <a href={s.cta.href} target="_blank" rel="noreferrer" className="pt-btn"><Icon name="arrow" size={16} /> {t(s.cta.label, lang)}</a> : <Link href={s.cta.href} className="pt-btn"><Icon name="arrow" size={16} /> {t(s.cta.label, lang)}</Link>}
            <Link href={`/contact?service=${s.slug === 'placement' || s.slug === 'evaluation' ? 'other' : s.slug}`} className="pt-btn ghost"><Icon name="chat" size={16} /> {t(UI.contactUs, lang)}</Link>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="pt-box"><h3><Icon name="check" size={18} /> {t(UI.features, lang)}</h3><ul>{s.features.map((f, i) => <li key={i}><Icon name="check" size={15} /> {t(f, lang)}</li>)}</ul></div>
          {s.modes && <div className="pt-box"><h3><Icon name="laptop" size={18} /> {t(UI.modes, lang)}</h3><div className="pt-chips">{s.modes.map((m, i) => <span key={i} className="pt-chip">{t(m, lang)}</span>)}</div></div>}
        </div>
      </div></section>
      <section className="pt-sec alt"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{lang === 'ar' ? 'خدمات أخرى' : 'Other services'}</h2></div>
        <div className="pt-grid">{others.map(o => <Link key={o.slug} href={`/services/${o.slug}`} className="pt-card"><span className={`pt-ic ${o.tone}`}><Icon name={o.icon} size={22} /></span><h3>{t(o.title, lang)}</h3><p>{t(o.short, lang)}</p></Link>)}</div>
        <div style={{ textAlign: 'center', marginTop: 20 }}><Link href="/services" className="pt-btn ghost">{t(UI.allServices, lang)}</Link></div>
      </div></section>
    </main>
  );
}
