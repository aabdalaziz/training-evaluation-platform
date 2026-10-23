'use client';

import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { SERVICES, UI, t } from '../../lib/portal/content';

export default function ServicesPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang();
  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <span>{t(UI.services, lang)}</span></div>
        <h1>{t(UI.services, lang)}</h1><p>{t(UI.servicesSub, lang)}</p>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap">
        <div className="pt-grid">
          {SERVICES.map(s => (
            <Link key={s.slug} href={`/services/${s.slug}`} className="pt-card">
              <span className={`pt-ic ${s.tone}`}><Icon name={s.icon} size={24} /></span>
              <h3>{t(s.title, lang)}</h3><p>{t(s.short, lang)}</p>
              <div className="pt-cardfoot"><span className={`pt-tag ${s.status === 'soon' ? 'soon' : ''}`}>{s.status === 'soon' ? t(UI.soon, lang) : t(UI.live, lang)}</span><span className="pt-more">{t(UI.learnMore, lang)} <Icon name="arrow" size={13} /></span></div>
            </Link>
          ))}
        </div>
      </div></section>
    </main>
  );
}
