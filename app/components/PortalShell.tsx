'use client';

// غلاف البوابة العامة (أَثَر): رأس + تذييل + مبدّل اللغة + أنماط مشتركة ببادئة .pt
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { ACRONYM, BRAND, CONTACT, NAV, PARTNERS, SERVICES, UI, t } from '../../lib/portal/content';
import type { Lang } from '../../lib/portal/content';
import Athir from './Athir';
import { AccessProvider, AccessButton, AccessPanel, ReadPage, SkipLink, ACCESS_CSS, useAccess } from './Inclusion';
import { OnAirButton, OnAirPanel, ONAIR_CSS } from './OnAir';

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'ar', setLang: () => {} });
export const useLang = () => useContext(LangCtx);

/** شعار أَثَر: حلقات أثر متدرجة + الاسم */
export function AtharMark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  const c1 = light ? '#fff' : BRAND.colors.navy, c2 = light ? '#c9a24b' : BRAND.colors.teal;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke={c1} strokeWidth="2.5" opacity=".25" />
      <circle cx="24" cy="24" r="14" fill="none" stroke={c1} strokeWidth="2.5" opacity=".55" />
      <circle cx="24" cy="24" r="7" fill={c2} />
      <circle cx="24" cy="24" r="2.5" fill={light ? c1 : '#fff'} />
    </svg>
  );
}

function ReportBarrierLink({ lang }: { lang: Lang }) {
  const a = useAccess();
  return <button type="button" className="pt-footlink" onClick={() => a.setOpen(true, 'report')} data-testid="ax-report-open">{lang === 'ar' ? 'أخبرنا بعائق وصول' : 'Report an accessibility barrier'}</button>;
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  useEffect(() => { try { const s = localStorage.getItem('athar_lang'); if (s === 'en' || s === 'ar') setLangState(s); } catch { /* ignore */ } }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  // استئناف التسجيل بعد العودة من رابط الدخول بالبريد (إن أعادنا Supabase إلى الصفحة الرئيسية)
  const router = useRouter();
  useEffect(() => {
    try {
      const resume = localStorage.getItem('athar_resume');
      if (!resume || pathname.startsWith('/programs/')) return;
      supabase().auth.getSession().then(({ data }) => { if (data.session) { localStorage.removeItem('athar_resume'); router.replace(resume); } });
    } catch { /* ignore */ }
  }, [pathname, router]);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('athar_lang', l); } catch { /* ignore */ } };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <AccessProvider>
      <div className={`pt ${lang}`} dir={dir} lang={lang}>
        <style dangerouslySetInnerHTML={{ __html: CSS + ACCESS_CSS + ONAIR_CSS }} />
        <SkipLink lang={lang} />
        <header className="pt-header">
          <Link href="/" className="pt-brand" aria-label={t(BRAND.full, lang)}>
            <AtharMark size={38} />
            <span><b>{t(BRAND.name, lang)}</b><small>{lang === 'ar' ? 'بوابة التعليم والتدريب والتطوير' : 'TRACE · Education · Training · Development'}</small></span>
          </Link>
          <nav className={`pt-nav ${open ? 'open' : ''}`} aria-label="portal">
            {NAV.map(n => <Link key={n.href} href={n.href} className={`pt-navlink ${pathname === n.href || (n.href !== '/' && !n.href.includes('#') && pathname.startsWith(n.href)) ? 'on' : ''}`}>{t(n.label, lang)}</Link>)}
            <div className="pt-navactions">
              <Link href="/me" className="pt-btn ghost small"><Icon name="users" size={15} /> {t(UI.student, lang)}</Link>
              <Link href={BRAND.evaluationUrl} className="pt-btn small"><Icon name="login" size={15} /> {t(UI.admin, lang)}</Link>
            </div>
          </nav>
          <div className="pt-headright">
            <OnAirButton lang={lang} />
            <AccessButton lang={lang} />
            <button type="button" className="pt-lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="language">{lang === 'ar' ? 'English' : 'عربي'}</button>
            <button type="button" className="pt-burger" aria-label="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>☰</button>
          </div>
        </header>

        {children}
        <Athir />
        <AccessPanel lang={lang} />
        <OnAirPanel lang={lang} />
        <ReadPage lang={lang} />

        <footer className="pt-footer">
          <div className="pt-footgrid">
            <div>
              <div className="pt-brand foot"><AtharMark size={34} light /><span><b>{t(BRAND.name, lang)}</b><small>{t(BRAND.tagline, lang)}</small></span></div>
              <p className="pt-footp">{t(BRAND.promise, lang)}</p>
              <div className="pt-trace" title={t(BRAND.acronymLine, lang)}>{ACRONYM.map(a => <Link key={a.letter} href={`/services/${a.slug}`}><b>{a.letter}</b><span>{lang === 'ar' ? a.ar : a.word}</span></Link>)}</div>
              <div className="pt-social">{CONTACT.social.map(s => <a key={s.name} href={s.href} target="_blank" rel="noreferrer">{s.name}</a>)}</div>
            </div>
            <div>
              <h4>{t(UI.services, lang)}</h4>
              <ul>{SERVICES.map(s => <li key={s.slug}><Link href={`/services/${s.slug}`}>{t(s.title, lang)}</Link></li>)}</ul>
            </div>
            <div>
              <h4>{t(UI.quick, lang)}</h4>
              <ul>
                {NAV.map(n => <li key={n.href}><Link href={n.href}>{t(n.label, lang)}</Link></li>)}
                <li><Link href="/me">{t(UI.student, lang)}</Link></li>
                <li><Link href="/org">{lang === 'ar' ? 'بوابة الجهات' : 'Organizations portal'}</Link></li>
                <li><Link href="/me/skills">{lang === 'ar' ? 'ملفي المهاري' : 'My skills profile'}</Link></li>
                <li><Link href="/me/twin">{lang === 'ar' ? 'توأمي المهاري' : 'My skills twin'}</Link></li>
                <li><Link href="/me/missions">{lang === 'ar' ? 'مهماتي من قلب العمل' : 'My workflow missions'}</Link></li>
                <li><Link href="/verify">{t(UI.verify, lang)}</Link></li>
                <li><Link href="/ai">{lang === 'ar' ? 'الذكاء الاصطناعي المسؤول' : 'Responsible AI'}</Link></li>
                <li><Link href="/agents">{lang === 'ar' ? 'أَثَر للوكلاء · المكتب الزجاجي' : 'Athar for agents · the glass office'}</Link></li>
                <li><Link href="/security">{lang === 'ar' ? 'درع أَثَر · الأمن والإفصاح المسؤول' : 'Athar Shield · security & responsible disclosure'}</Link></li>
                <li><Link href="/accessibility">{lang === 'ar' ? 'أَثَر للجميع · بيان الوصول' : 'Athar for all · accessibility statement'}</Link></li>
                <li><ReportBarrierLink lang={lang} /></li>
                <li><Link href={BRAND.evaluationUrl}>{t(UI.admin, lang)}</Link></li>
              </ul>
            </div>
            <div>
              <h4>{t(UI.contactInfo, lang)}</h4>
              <ul className="pt-contactlist">
                <li><Icon name="mail" size={15} /> <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
                <li><Icon name="chat" size={15} /> <bdi>{CONTACT.phone}</bdi></li>
                <li><Icon name="globe" size={15} /> {t(CONTACT.city, lang)}</li>
                <li><Icon name="clock" size={15} /> {t(CONTACT.hours, lang)}</li>
              </ul>
            </div>
          </div>
          <div className="pt-partnersrow">
            {PARTNERS.map(p => <span key={p.logo} className="pt-partnerchip"><img src={p.logo} alt={t(p.name, lang)} /><span>{t(p.name, lang)}</span></span>)}
          </div>
          <div className="pt-copy">© {BRAND.copyrightYear} {t(BRAND.owner, lang)} · {t(BRAND.name, lang)} — {t(UI.rights, lang)}<br /><small>{t(BRAND.operatedBy, lang)} {t(BRAND.legal, lang)}</small></div>
        </footer>
      </div>
      </AccessProvider>
    </LangCtx.Provider>
  );
}

const NAVY = BRAND.colors.navy, TEAL = BRAND.colors.teal, GOLD = BRAND.colors.gold;
const CSS = `
.pt{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;display:flex;flex-direction:column}
.pt *{box-sizing:border-box}
.pt a{color:inherit}
.pt-header{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px max(18px,calc((100% - 1200px)/2));background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0}
.pt-brand{display:flex;align-items:center;gap:10px;text-decoration:none}.pt-brand span{display:flex;flex-direction:column;line-height:1.15}.pt-brand b{font-size:20px;color:${NAVY};font-weight:900}.pt-brand small{font-size:11px;color:#64748b;font-weight:700}
.pt-brand.foot b,.pt-brand.foot small{color:#fff}.pt-brand.foot small{opacity:.8}
.pt-nav{display:flex;align-items:center;gap:4px;flex:1;justify-content:center}
.pt-navlink{text-decoration:none;font-weight:800;font-size:14px;color:#334155;padding:8px 12px;border-radius:10px}.pt-navlink:hover{background:#f1f5f9}.pt-navlink.on{color:${TEAL};background:#f0fdfa}
.pt-navactions{display:none;gap:8px;margin-top:8px}
.pt-headright{display:flex;align-items:center;gap:8px}
.pt-lang{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:900;color:${NAVY};cursor:pointer}
.pt-burger{display:none;border:1px solid #cbd5e1;background:#fff;border-radius:10px;width:40px;height:38px;font-size:18px;cursor:pointer}
.pt-btn{display:inline-flex;align-items:center;gap:8px;background:${TEAL};color:#fff;border:1px solid ${TEAL};border-radius:12px;padding:12px 20px;font:inherit;font-size:14px;font-weight:900;text-decoration:none;cursor:pointer;white-space:nowrap;transition:transform .15s}.pt-btn:hover{transform:translateY(-1px)}
.pt-btn.navy{background:${NAVY};border-color:${NAVY}}.pt-btn.gold{background:${GOLD};border-color:${GOLD};color:#1f2937}.pt-btn.ghost{background:#fff;color:${NAVY};border-color:#cbd5e1}.pt-btn.light{background:#fff;color:${NAVY};border-color:#fff}.pt-btn.outline{background:transparent;color:#fff;border-color:rgba(255,255,255,.6)}.pt-btn.small{padding:8px 14px;font-size:13px}.pt-btn:disabled{opacity:.6;cursor:not-allowed}
.pt-main{flex:1}
.pt-wrap{max-width:1200px;margin:0 auto;padding:0 18px}
.pt-sec{padding:64px 0}.pt-sec.alt{background:#fff}.pt-sec.navy{background:${NAVY};color:#fff}
.pt-sechead{text-align:center;max-width:720px;margin:0 auto 36px}.pt-sechead h2{margin:0 0 8px;font-size:30px;color:${NAVY};font-weight:900}.pt-sec.navy .pt-sechead h2{color:#fff}.pt-sechead p{margin:0;color:#64748b;font-size:15px;line-height:1.8}.pt-sec.navy .pt-sechead p{color:rgba(255,255,255,.75)}
.pt-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:${TEAL};letter-spacing:.3px;margin-bottom:8px}
.pt-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,${NAVY} 0%,#143a66 55%,#0b6b66 100%);color:#fff;padding:84px 0 96px}
.pt-hero:before{content:"";position:absolute;inset:auto -120px -220px auto;width:620px;height:620px;border-radius:50%;border:60px solid rgba(255,255,255,.05)}
.pt-hero:after{content:"";position:absolute;inset:auto auto -260px -140px;width:520px;height:520px;border-radius:50%;border:40px solid rgba(201,162,75,.12)}
.pt-herogrid{position:relative;display:grid;grid-template-columns:1.2fr .8fr;gap:40px;align-items:center}
.pt-hero h1{margin:10px 0 14px;font-size:44px;line-height:1.25;font-weight:900}.pt-hero h1 em{font-style:normal;color:${GOLD}}
.pt-hero p{margin:0 0 26px;font-size:17px;line-height:1.9;color:rgba(255,255,255,.85);max-width:640px}
.pt-heroacts{display:flex;gap:10px;flex-wrap:wrap}
.pt-heropill{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:800}
.pt-rings{display:flex;align-items:center;justify-content:center}
.pt-methodmini{display:grid;gap:10px}.pt-methodmini div{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:12px 14px}.pt-methodmini b{display:block;font-size:14px}.pt-methodmini small{color:rgba(255,255,255,.75);font-size:12.5px;line-height:1.6}.pt-methodmini i{font-style:normal;width:34px;height:34px;border-radius:10px;background:${GOLD};color:#1f2937;display:inline-flex;align-items:center;justify-content:center;font-weight:900;flex:0 0 34px}
.pt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.pt-grid.three{grid-template-columns:repeat(3,1fr)}.pt-grid.two{grid-template-columns:repeat(2,1fr)}
.pt-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:10px;text-decoration:none;position:relative;transition:transform .15s,box-shadow .15s}.pt-card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,42,78,.08)}
.pt-ic{width:48px;height:48px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;color:#fff}.pt-ic.navy{background:${NAVY}}.pt-ic.teal{background:${TEAL}}.pt-ic.gold{background:${GOLD};color:#1f2937}.pt-ic.info{background:#2563eb}.pt-ic.ok{background:#047857}.pt-ic.warn{background:#d97706}
.pt-card h3{margin:4px 0 0;font-size:17px;color:${NAVY};font-weight:900;line-height:1.4}.pt-card p{margin:0;font-size:13.5px;color:#64748b;line-height:1.75;flex:1}
.pt-cardfoot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px}.pt-more{font-size:13px;font-weight:900;color:${TEAL};display:inline-flex;align-items:center;gap:4px}
.pt-tag{font-size:11px;font-weight:900;border-radius:999px;padding:3px 10px;background:#ecfdf5;color:#065f46}.pt-tag.soon{background:#fff7ed;color:#9a3412}.pt-tag.navy{background:#eff6ff;color:#1e40af}
.pt-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.pt-step{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:18px;padding:22px}.pt-step i{font-style:normal;width:40px;height:40px;border-radius:12px;background:${GOLD};color:#1f2937;display:inline-flex;align-items:center;justify-content:center;font-weight:900;margin-bottom:10px}.pt-step h3{margin:0 0 6px;font-size:17px}.pt-step p{margin:0;color:rgba(255,255,255,.8);font-size:13.5px;line-height:1.8}
.pt-programs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.pt-prog{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:8px}.pt-prog h3{margin:0;font-size:16px;color:${NAVY};line-height:1.5}.pt-prog .pt-meta{display:flex;gap:6px;flex-wrap:wrap}.pt-prog p{margin:0;font-size:13px;color:#64748b;line-height:1.7;flex:1}.pt-prog .pt-dates{font-size:12.5px;color:#475569;display:flex;gap:12px;flex-wrap:wrap}
.pt-empty{grid-column:1/-1;text-align:center;color:#64748b;background:#fff;border:1px dashed #cbd5e1;border-radius:16px;padding:30px}
.pt-cross{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.pt-crossitem{display:flex;gap:14px;align-items:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px}.pt-crossitem b{display:block;color:${NAVY};font-size:15px;margin-bottom:4px}.pt-crossitem span{font-size:13px;color:#64748b;line-height:1.7}
.pt-partners{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}.pt-partner{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px 22px;min-width:240px}.pt-partner img{height:64px;width:auto;max-width:220px;object-fit:contain}.pt-partner b{font-size:14px;color:${NAVY};text-align:center}.pt-partner small{color:#64748b;font-size:12px}
.pt-cta{background:linear-gradient(135deg,${TEAL},#0f766e);color:#fff;border-radius:24px;padding:46px 36px;text-align:center}.pt-cta h2{margin:0 0 8px;font-size:30px}.pt-cta p{margin:0 0 22px;color:rgba(255,255,255,.85);font-size:15px}.pt-cta .pt-heroacts{justify-content:center}
.pt-pagehead{background:linear-gradient(135deg,${NAVY},#143a66);color:#fff;padding:56px 0}.pt-pagehead h1{margin:8px 0 10px;font-size:36px;font-weight:900}.pt-pagehead p{margin:0;color:rgba(255,255,255,.8);font-size:16px;line-height:1.9;max-width:760px}
.pt-crumbs{font-size:13px;color:rgba(255,255,255,.7);display:flex;gap:6px;align-items:center}.pt-crumbs a{color:#fff;text-decoration:none;font-weight:800}
.pt-prose{max-width:820px;font-size:16px;line-height:2;color:#334155}.pt-prose p{margin:0 0 14px}
.pt-two{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:start}
.pt-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px}.pt-box h3{margin:0 0 12px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}.pt-box ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}.pt-box li{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:#334155;line-height:1.6}.pt-box li svg{flex:0 0 auto;margin-top:3px;color:${TEAL}}
.pt-chips{display:flex;gap:6px;flex-wrap:wrap}.pt-chip{font-size:12.5px;font-weight:800;background:#f1f5f9;color:#334155;border-radius:999px;padding:5px 12px}
.pt-vm{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pt-vmcard{border-radius:18px;padding:26px;color:#fff}.pt-vmcard.v{background:${NAVY}}.pt-vmcard.m{background:${TEAL}}.pt-vmcard h3{margin:0 0 8px;font-size:14px;letter-spacing:.5px;opacity:.85}.pt-vmcard p{margin:0;font-size:18px;line-height:1.8;font-weight:800}
.pt-form{display:grid;gap:14px}.pt-form label{display:grid;gap:6px;font-size:13.5px;font-weight:800;color:#334155}.pt-form input,.pt-form select,.pt-form textarea{font:inherit;font-size:14px;padding:11px 13px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#0f172a;width:100%}.pt-form textarea{min-height:140px;resize:vertical}.pt-form .row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pt-alert{border-radius:12px;padding:12px 14px;font-weight:800;font-size:14px}.pt-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.pt-alert.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
.pt-footer{background:${NAVY};color:#fff;padding:48px 0 22px;margin-top:auto}
.pt-footlink{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px;min-height:24px}
.pt-footgrid{max-width:1200px;margin:0 auto;padding:0 18px;display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:28px}.pt-footer h4{margin:0 0 12px;font-size:14px;color:${GOLD}}.pt-footer ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}.pt-footer li,.pt-footer li a{font-size:13.5px;color:rgba(255,255,255,.85);text-decoration:none}.pt-footer li a:hover{color:#fff;text-decoration:underline}
.pt-footp{font-size:13px;line-height:1.8;color:rgba(255,255,255,.75);margin:12px 0}
.pt-trace{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.pt-trace a{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:4px;padding-inline-end:8px;text-decoration:none;font-size:11.5px;color:rgba(255,255,255,.85)}.pt-trace b{width:22px;height:22px;border-radius:7px;background:${GOLD};color:#1f2937;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}
.pt-acro{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:-16px 0 32px}.pt-acro a{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:5px;padding-inline-end:14px;text-decoration:none;font-size:13px;font-weight:800;color:#334155}.pt-acro b{width:30px;height:30px;border-radius:50%;background:${NAVY};color:${GOLD};display:inline-flex;align-items:center;justify-content:center;font-size:15px;font-weight:900}.pt-acro-note{text-align:center;font-size:12.5px;color:#64748b;margin:-24px 0 32px}
.pt-social{display:flex;gap:8px}.pt-social a{border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:800;text-decoration:none}
.pt-contactlist li{display:flex;gap:8px;align-items:center}
.pt-partnersrow{max-width:1200px;margin:30px auto 0;padding:18px 18px 0;border-top:1px solid rgba(255,255,255,.12);display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.pt-partnerchip{display:inline-flex;align-items:center;gap:8px;background:#fff;border-radius:12px;padding:6px 12px;color:${NAVY};font-size:12px;font-weight:800}.pt-partnerchip img{height:28px;width:auto}
.pt-copy{text-align:center;font-size:12.5px;color:rgba(255,255,255,.6);margin-top:18px;line-height:1.9}.pt-copy small{font-size:11.5px;color:rgba(255,255,255,.45)}
@media(max-width:1000px){.pt-grid{grid-template-columns:repeat(2,1fr)}.pt-grid.three{grid-template-columns:repeat(2,1fr)}.pt-herogrid{grid-template-columns:1fr}.pt-hero h1{font-size:34px}.pt-steps,.pt-programs,.pt-cross{grid-template-columns:1fr 1fr}.pt-footgrid{grid-template-columns:1fr 1fr}.pt-two{grid-template-columns:1fr}}
@media(max-width:760px){.pt-nav{display:none;position:absolute;top:100%;inset-inline:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 18px 16px;flex-direction:column;align-items:stretch;gap:2px}.pt-nav.open{display:flex}.pt-navactions{display:flex}.pt-burger{display:inline-flex;align-items:center;justify-content:center}.pt-grid,.pt-grid.three,.pt-grid.two,.pt-steps,.pt-programs,.pt-cross,.pt-vm,.pt-form .row{grid-template-columns:1fr}.pt-sec{padding:44px 0}.pt-hero{padding:56px 0 64px}.pt-hero h1{font-size:28px}.pt-sechead h2{font-size:24px}.pt-footgrid{grid-template-columns:1fr}.pt-pagehead h1{font-size:28px}.pt-cta{padding:32px 20px}.pt-cta h2{font-size:24px}}
`;
