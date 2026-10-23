'use client';

import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { ABOUT, BRAND, PARTNERS, UI, t } from '../../lib/portal/content';

export default function AboutPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang();
  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <span>{lang === 'ar' ? 'من نحن' : 'About'}</span></div>
        <h1>{t(BRAND.full, lang)}</h1><p>{t(ABOUT.intro, lang)}</p>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap">
        <div className="pt-vm">
          <div className="pt-vmcard v"><h3>{t(UI.vision, lang)}</h3><p>{t(ABOUT.vision, lang)}</p></div>
          <div className="pt-vmcard m"><h3>{t(UI.mission, lang)}</h3><p>{t(ABOUT.mission, lang)}</p></div>
        </div>
      </div></section>
      <section className="pt-sec alt"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{t(UI.values, lang)}</h2></div>
        <div className="pt-grid">{ABOUT.values.map((v, i) => <div key={i} className="pt-card"><span className="pt-ic navy"><Icon name={v.icon} size={22} /></span><h3>{t(v.title, lang)}</h3><p>{t(v.desc, lang)}</p></div>)}</div>
      </div></section>
      <section className="pt-sec navy"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{t(UI.method, lang)}</h2><p>{t(UI.methodSub, lang)}</p></div>
        <div className="pt-steps">{ABOUT.method.map(m => <div key={m.n} className="pt-step"><i>{m.n}</i><h3>{t(m.title, lang)}</h3><p>{t(m.desc, lang)}</p></div>)}</div>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap">
        <div className="pt-sechead"><h2>{t(UI.partners, lang)}</h2></div>
        <div className="pt-partners">{PARTNERS.map(p => <div key={p.logo} className="pt-partner"><img src={p.logo} alt={t(p.name, lang)} /><b>{t(p.name, lang)}</b><small>{t(p.role, lang)}</small></div>)}</div>
        <div style={{ textAlign: 'center', marginTop: 26 }}><Link href="/contact" className="pt-btn"><Icon name="chat" size={16} /> {t(UI.contactUs, lang)}</Link></div>
      </div></section>
    </main>
  );
}
