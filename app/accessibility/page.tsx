'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /accessibility — «بيان الوصول» (P32 أَثَر للجميع): ما نلتزم به (WCAG 2.2 AA) · ما يعمل اليوم · ما لم يكتمل بعد (بصدق) ·
 *  أرقام مجمَّعة k≥5 · آخر فحص آلي · كيف تخبرنا بعائق. صفحة عامة بلا تسجيل.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { useAccess } from '../components/Inclusion';
import { ACCESS_STATEMENT, ACCESS_AUDIT, NEEDS, NEED_LABEL, NEED_EFFECT_AR, FEATURES, FEATURE_LABEL, PRIVACY_ACCESS_AR } from '../../lib/inclusion/registry';
import type { Need } from '../../lib/inclusion/registry';

type Stats = { people: number | null; needs: { key: Need; n: number }[]; reports: { open: number; fixed: number; wontfix: number }; simple_approved: number; programs_ready: number; k: number };

export default function AccessibilityPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const a = useAccess(); const [st, setSt] = useState<Stats | null>(null);
  useEffect(() => { fetch('/api/inclusion?stats=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success) setSt(j.stats); }).catch(() => null); }, []);
  const S = ACCESS_STATEMENT;
  return (
    <main className="pt-main as" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="as-head"><span className="pt-kicker"><Icon name="users" size={14} /> {ar ? 'أَثَر للجميع' : 'Athar for all'}</span><h1>{ar ? 'بيان الوصول' : 'Accessibility statement'}</h1>
        <p>{ar ? 'أَثَر بوابة واحدة لكل من يتعلّم ويدرّب ويقيّم. لا نبني بوابة منفصلة لأحد؛ نجعل البوابة نفسها تتكيّف، ونقول بصدق ما يعمل اليوم وما لم يكتمل بعد.' : 'One portal for everyone who learns, trains and evaluates. We do not build a separate portal; we make this one adapt — and say honestly what works and what does not yet.'}</p>
        <div className="as-cta"><button type="button" className="pt-btn gold" onClick={() => a.setOpen(true, 'needs')} data-testid="as-open">{ar ? 'كيّف البوابة على مقاسي' : 'Adapt the portal to me'}</button><button type="button" className="pt-btn ghost" onClick={() => a.setOpen(true, 'report')} data-testid="as-report">{ar ? 'أخبرنا بعائق' : 'Report a barrier'}</button></div></header>

      <section className="pt-box" aria-labelledby="as-h1"><h2 id="as-h1"><Icon name="shield" size={18} /> {ar ? 'ما نلتزم به' : 'Our commitment'}</h2>
        <p><b>{ar ? 'المقياس: ' : 'Standard: '}</b>{S.standard}</p><p><b>{ar ? 'النطاق: ' : 'Scope: '}</b>{S.scope_ar}</p>
        <ul className="as-list">{S.commitments_ar.map((x, i) => <li key={i}><Icon name="check" size={14} /> {x}</li>)}</ul></section>

      <section className="pt-box" aria-labelledby="as-h2"><h2 id="as-h2"><Icon name="alert" size={18} /> {ar ? 'ما لم يكتمل بعد — بصدق' : 'What is not complete yet'}</h2>
        <ul className="as-list gaps" data-testid="as-gaps">{S.known_gaps_ar.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <p className="pt-muted">{ar ? `نراجع هذا البيان كل ${S.review_months} أشهر ومع كل إصدار.` : `Reviewed every ${S.review_months} months and with each release.`}</p></section>

      <section className="pt-box" aria-labelledby="as-h3"><h2 id="as-h3"><Icon name="users" size={18} /> {ar ? 'كيف تتكيّف البوابة' : 'How the portal adapts'}</h2>
        <p className="pt-muted">{ar ? 'تختار بكلماتك ما يساعدك — من زر «على مقاسي» في أعلى كل صفحة — فيتغيّر هذا:' : 'Choose, in your words, what helps you — via "My way" at the top of every page:'}</p>
        <dl className="as-dl">{NEEDS.map(n => <div key={n}><dt>{NEED_LABEL[n][lang]}</dt><dd>{NEED_EFFECT_AR[n]}</dd></div>)}</dl></section>

      <section className="pt-box" aria-labelledby="as-h4"><h2 id="as-h4"><Icon name="target" size={18} /> {ar ? 'ما توفّره البرامج' : 'What programs provide'}</h2>
        <p className="pt-muted">{ar ? 'كل برنامج يعلن ما يوفّره فعلًا — لا وعودًا عامة. تجده شارةً في الكتالوج ويمكنك ترشيح «يناسبني».' : 'Each program declares what it actually provides.'}</p>
        <ul className="as-chips">{FEATURES.map(f => <li key={f}>{FEATURE_LABEL[f][lang]}</li>)}</ul>
        {st && <p className="pt-muted" data-testid="as-ready">{ar ? `برامج مهيَّأة للجميع الآن: ${st.programs_ready}` : `Programs ready now: ${st.programs_ready}`} · <Link href="/programs?fit=1">{ar ? 'تصفّحها' : 'Browse'}</Link></p>}</section>

      <section className="pt-box" aria-labelledby="as-h5"><h2 id="as-h5"><Icon name="trend" size={18} /> {ar ? 'أرقام مجمَّعة' : 'Aggregate numbers'}</h2>
        {!st && <p className="pt-muted">…</p>}
        {st && <div className="as-stats" data-testid="as-stats">
          <div><b>{st.people === null ? `< ${st.k}` : st.people}</b><span>{ar ? 'أشخاص كيّفوا البوابة' : 'people adapted the portal'}</span></div>
          <div><b>{st.reports.fixed}</b><span>{ar ? 'عوائق أُصلحت' : 'barriers fixed'}</span></div>
          <div><b>{st.reports.open}</b><span>{ar ? 'بلاغات مفتوحة' : 'open reports'}</span></div>
          <div><b>{st.simple_approved}</b><span>{ar ? 'نصوص بنسخة أبسط معتمدة' : 'approved simpler texts'}</span></div>
        </div>}
        {st && st.needs.length > 0 && <ul className="as-chips">{st.needs.map(x => <li key={x.key}>{NEED_LABEL[x.key][lang]} · {x.n}</li>)}</ul>}
        <p className="pt-muted">{ar ? `لا نعرض أي رقم عن احتياج أقل من ${st?.k || 5} أشخاص. آخر فحص آلي: ${ACCESS_AUDIT.at} — ${ACCESS_AUDIT.pages} صفحة؛ عناصر بلا عنوان: ${ACCESS_AUDIT.issues.missing_labels} · أهداف أصغر من 24 بكسل: ${ACCESS_AUDIT.issues.small_targets} · صور بلا بديل: ${ACCESS_AUDIT.issues.missing_alt} · صفحات بلا عنوان رئيسي: ${ACCESS_AUDIT.issues.no_h1}.` : `No number is shown for a need with fewer than ${st?.k || 5} people. Last automated audit: ${ACCESS_AUDIT.at}.`}</p></section>

      <section className="pt-box" aria-labelledby="as-h6"><h2 id="as-h6"><Icon name="shield" size={18} /> {ar ? 'خصوصية ملف الاحتياج' : 'Privacy of the needs profile'}</h2>
        <ul className="as-list">{PRIVACY_ACCESS_AR.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <p>{S.contact_ar}</p>
        <p className="pt-muted"><Link href="/me/access">{ar ? 'ملفي «أَثَر على مقاسي»' : 'My profile'}</Link> · <Link href="/security">{ar ? 'درع أَثَر' : 'Athar Shield'}</Link> · <Link href="/me/data">{ar ? 'خزنة أَثَر' : 'Athar Vault'}</Link></p></section>
    </main>
  );
}

const CSS = `
.as{max-width:960px;margin:0 auto;padding:28px 18px 60px}.as-head h1{margin:6px 0 8px;font-size:32px;color:#0f2a4e}.as-head p{color:#334155;line-height:1.9;font-size:16px;margin:0 0 14px}.as-cta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.as .pt-box{margin-bottom:16px}.as h2{font-size:19px;color:#0f2a4e;margin:0 0 10px;display:flex;align-items:center;gap:8px}.as p{line-height:1.9;color:#1e293b}
.as-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.as-list li{display:flex;gap:8px;align-items:flex-start;line-height:1.8;color:#1e293b}.as-list li svg{flex:0 0 auto;margin-top:7px;color:#0b6f69}
.as-list.gaps li{border-inline-start:3px solid #c9a24b;padding-inline-start:10px}
.as-dl{margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.as-dl div{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}.as-dl dt{font-weight:800;color:#0f2a4e}.as-dl dd{margin:4px 0 0;color:#475569;line-height:1.7;font-size:14px}
.as-chips{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.as-chips li{background:#f1f5f9;border-radius:999px;padding:6px 12px;font-size:13.5px;color:#0f2a4e;font-weight:700}
.as-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:6px 0 10px}.as-stats div{background:#f8fafc;border-radius:12px;padding:12px;text-align:center}.as-stats b{display:block;font-size:26px;color:#0f2a4e}.as-stats span{color:#475569;font-size:13px}
`;
