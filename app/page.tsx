'use client';

// أَثَر — الصفحة الرئيسية للبوابة
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase/client';
import { Icon } from '../lib/ui/icons';
import { PortalShell, useLang, AtharMark } from './components/PortalShell';
import { ACRONYM, BRAND, SERVICES, ABOUT, CROSS, PARTNERS, UI, t, publicPrograms, programName, deliveryLabel, fmtDate } from '../lib/portal/content';
import type { PublicProgram } from '../lib/portal/content';

export default function HomePage() {
  return <PortalShell><Home /></PortalShell>;
}

function Home() {
  const { lang } = useLang();
  const [programs, setPrograms] = useState<ReturnType<typeof publicPrograms>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const db = supabase();
        const { data } = await db.from('programs').select('id,name_ar,name_en,delivery_mode,status,start_date,end_date,audience_ar,intro_ar').order('start_date', { ascending: true }).limit(60);
        setPrograms(publicPrograms(((data || []) as PublicProgram[]), new Date().toISOString().slice(0, 10)).slice(0, 6));
      } catch { /* تبقى القائمة فارغة */ }
      setLoaded(true);
    })();
  }, []);

  return (
    <main className="pt-main">
      {/* البطل */}
      <section className="pt-hero">
        <div className="pt-wrap pt-herogrid">
          <div>
            <span className="pt-heropill"><Icon name="scale" size={14} /> {lang === 'ar' ? 'أَثَر · TRACE — نقيس قبل · نُحسّن أثناء · نُثبت بعد' : 'Athar · TRACE — Measure before · Improve during · Prove after'}</span>
            <h1>{lang === 'ar' ? <>حلول متكاملة في <em>التعليم</em> و<em>التدريب</em> و<em>التطوير</em></> : <>Integrated solutions in <em>Education</em>, <em>Training</em> &amp; <em>Development</em></>}</h1>
            <p>{t(BRAND.promise, lang)}</p>
            <div className="pt-heroacts">
              <Link href="/services" className="pt-btn gold"><Icon name="compass" size={16} /> {t(UI.services, lang)}</Link>
              <a href={BRAND.placementUrl} target="_blank" rel="noreferrer" className="pt-btn light"><Icon name="target" size={16} /> {lang === 'ar' ? 'اختبر مستواك مع مِعيار' : 'Test your level with Miaar'}</a>
              <Link href="/contact" className="pt-btn outline"><Icon name="chat" size={16} /> {t(UI.contactUs, lang)}</Link>
            </div>
          </div>
          <div className="pt-methodmini">
            {ABOUT.method.map(m => <div key={m.n}><i>{m.n}</i><span><b>{t(m.title, lang)}</b><small>{t(m.desc, lang)}</small></span></div>)}
          </div>
        </div>
      </section>

      {/* الخدمات */}
      <section className="pt-sec" id="services">
        <div className="pt-wrap">
          <div className="pt-sechead"><span className="pt-kicker"><Icon name="programs" size={14} /> {t(UI.services, lang)}</span><h2>{lang === 'ar' ? 'ثماني خدمات… منهجية واحدة' : 'Eight services, one method'}</h2><p>{t(UI.servicesSub, lang)}</p></div>
          <div className="pt-acro" aria-label="TRACE">{ACRONYM.map(a => <Link key={a.letter} href={`/services/${a.slug}`}><b>{a.letter}</b>{lang === 'ar' ? a.ar : a.word}</Link>)}</div>
          <p className="pt-acro-note">{t(BRAND.acronymLine, lang)}</p>
          <div className="pt-grid">
            {SERVICES.map(s => (
              <Link key={s.slug} href={`/services/${s.slug}`} className="pt-card">
                <span className={`pt-ic ${s.tone}`}><Icon name={s.icon} size={24} /></span>
                <h3>{t(s.title, lang)}</h3>
                <p>{t(s.short, lang)}</p>
                <div className="pt-cardfoot"><span className={`pt-tag ${s.status === 'soon' ? 'soon' : ''}`}>{s.status === 'soon' ? t(UI.soon, lang) : t(UI.live, lang)}</span><span className="pt-more">{t(UI.learnMore, lang)} <Icon name="arrow" size={13} /></span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* البرامج */}
      <section className="pt-sec alt" id="programs">
        <div className="pt-wrap">
          <div className="pt-sechead"><span className="pt-kicker"><Icon name="calendar" size={14} /> {t(UI.programs, lang)}</span><h2>{t(UI.programs, lang)}</h2><p>{t(UI.programsSub, lang)}</p></div>
          <div className="pt-programs">
            {loaded && programs.length === 0 && <div className="pt-empty">{t(UI.noPrograms, lang)}</div>}
            {programs.map(p => (
              <article key={p.id} className="pt-prog">
                <div className="pt-meta"><span className={`pt-tag ${p.state === 'ongoing' ? '' : 'navy'}`}>{p.state === 'ongoing' ? t(UI.ongoing, lang) : t(UI.upcoming, lang)}</span>{p.delivery_mode && <span className="pt-chip">{deliveryLabel(p.delivery_mode, lang)}</span>}</div>
                <h3>{programName(p, lang)}</h3>
                <p>{p.intro_ar || p.audience_ar || ''}</p>
                <div className="pt-dates"><span><Icon name="calendar" size={13} /> {t(UI.starts, lang)} <bdi>{fmtDate(p.start_date, lang)}</bdi></span>{p.end_date && <span>{t(UI.ends, lang)} <bdi>{fmtDate(p.end_date, lang)}</bdi></span>}</div>
                <Link href={`/contact?service=training&program=${encodeURIComponent(p.name_ar)}`} className="pt-btn ghost small"><Icon name="send" size={14} /> {t(UI.register, lang)}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* المنهجية */}
      <section className="pt-sec navy" id="method">
        <div className="pt-wrap">
          <div className="pt-sechead"><span className="pt-kicker" style={{ color: BRAND.colors.gold }}><Icon name="trend" size={14} /> {t(UI.method, lang)}</span><h2>{t(UI.methodSub, lang)}</h2><p>{t(ABOUT.intro, lang)}</p></div>
          <div className="pt-steps">
            {ABOUT.method.map(m => <div key={m.n} className="pt-step"><i>{m.n}</i><h3>{t(m.title, lang)}</h3><p>{t(m.desc, lang)}</p></div>)}
          </div>
        </div>
      </section>

      {/* مزايا عابرة */}
      <section className="pt-sec">
        <div className="pt-wrap">
          <div className="pt-cross">
            {CROSS.map((c, i) => <div key={i} className="pt-crossitem"><span className="pt-ic teal"><Icon name={c.icon} size={22} /></span><div><b>{t(c.title, lang)}</b><span>{t(c.desc, lang)}</span></div></div>)}
          </div>
        </div>
      </section>

      {/* الشركاء */}
      <section className="pt-sec alt" id="partners">
        <div className="pt-wrap">
          <div className="pt-sechead"><span className="pt-kicker"><Icon name="users" size={14} /> {t(UI.partners, lang)}</span><h2>{t(UI.partners, lang)}</h2></div>
          <div className="pt-partners">
            {PARTNERS.map(p => <div key={p.logo} className="pt-partner"><img src={p.logo} alt={t(p.name, lang)} /><b>{t(p.name, lang)}</b><small>{t(p.role, lang)}</small></div>)}
          </div>
        </div>
      </section>

      {/* دعوة */}
      <section className="pt-sec">
        <div className="pt-wrap">
          <div className="pt-cta">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><AtharMark size={54} light /></div>
            <h2>{t(UI.ctaTitle, lang)}</h2>
            <p>{t(UI.ctaSub, lang)}</p>
            <div className="pt-heroacts">
              <a href={BRAND.placementUrl} target="_blank" rel="noreferrer" className="pt-btn light"><Icon name="target" size={16} /> {lang === 'ar' ? 'اختبار مِعيار' : 'Miaar test'}</a>
              <Link href="/#programs" className="pt-btn outline"><Icon name="calendar" size={16} /> {t(UI.programs, lang)}</Link>
              <Link href="/contact" className="pt-btn outline"><Icon name="chat" size={16} /> {t(UI.contactUs, lang)}</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
