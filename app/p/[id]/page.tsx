'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — الصفحة العامة للملف المهاري (بموافقة المتعلم: برابط خاص أو عام) — بلا بيانات اتصال + جواز المهارات PDF + JSON-LD Person (P8-ج)

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fmtDate } from '../../../lib/portal/content';
import { DOMAINS, domainLabel } from '../../../lib/portal/skills';
import { levelName, credentialKindLabel } from '../../../lib/portal/profile';
import { personJsonLd, jsonLdScript, normalizeSite } from '../../../lib/portal/open';
import { downloadPassport } from '../../../lib/portal/passport';
import type { PassportData } from '../../../lib/portal/passport';

export default function PublicProfilePage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type PubSkill = { code: string; name_ar: string; name_en: string; domain: string; saqf_level?: number | null; cefr_level?: string | null; sdaia_code?: string | null; computed_level: number; confidence: number; approved_level?: number | null };
type Pub = { ok: boolean; public_id?: string; display_name?: string | null; headline?: string | null; city?: string | null; organization?: string | null; share_mode?: string; skills?: PubSkill[]; credentials?: { code: string; kind: string; title_ar: string; title_en?: string | null; level?: string | null; issued_at: string }[] };

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const id = String(params?.id || ''); const db = useMemo(() => supabase(), []);
  const [p, setP] = useState<Pub | null>(null); const [loaded, setLoaded] = useState(false); const [pdfBusy, setPdfBusy] = useState(false); const [pdfErr, setPdfErr] = useState('');
  useEffect(() => { (async () => { try { const { data } = await db.rpc('portal_public_profile', { p_public_id: id }); setP((data as Pub) || { ok: false }); } catch { setP({ ok: false }); } setLoaded(true); })(); }, [db, id]);
  useEffect(() => { if (p?.ok && p.share_mode !== 'public') { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow'; document.head.appendChild(m); return () => { m.remove(); }; } }, [p]);
  if (!loaded) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;
  if (!p?.ok) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><h2>{lang === 'ar' ? 'هذا الملف خاص أو غير موجود' : 'This profile is private or does not exist'}</h2><p className="pt-muted">{lang === 'ar' ? 'صاحب الملف يتحكم في مشاركته من بوابته.' : 'The owner controls sharing from their portal.'}</p><Link href="/" className="pt-btn light">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link></div></section></main>;
  const skills = p.skills || []; const creds = p.credentials || []; const lv = (s: PubSkill) => s.approved_level ?? Math.round(s.computed_level);
  const byDomain = DOMAINS.map(d => ({ d, items: skills.filter(s => s.domain === d.value) })).filter(x => x.items.length);
  const site = normalizeSite(typeof window !== 'undefined' ? window.location.origin : '');
  async function passport() {
    setPdfBusy(true); setPdfErr('');
    try {
      const ar = lang === 'ar'; const now = new Date(); const day = now.toLocaleDateString(ar ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
      const data: PassportData = {
        lang, name: p!.display_name || (ar ? 'متعلم في أَثَر' : 'Athar learner'), headline: p!.headline || '', meta: [p!.organization, p!.city].filter(Boolean).join(' · '), publicId: p!.public_id || id, url: `${site}/p/${p!.public_id || id}`, qrText: `${site}/p/${p!.public_id || id}`, issuedAt: day, sharePublic: true,
        kpis: { skills: skills.length, strong: skills.filter(s => s.confidence >= 70).length, approved: skills.filter(s => s.approved_level).length, credentials: creds.length },
        domains: byDomain.map(({ d, items }) => ({ label: domainLabel(d.value, lang), tone: d.tone, items: items.map(s => ({ name: lang === 'en' ? s.name_en : s.name_ar, code: s.code, badges: [s.saqf_level ? `SAQF ${s.saqf_level}` : '', s.cefr_level ? `CEFR ${s.cefr_level}` : '', s.sdaia_code || ''].filter(Boolean).join(' · '), level: lv(s), levelName: levelName(lv(s), lang), approved: !!s.approved_level, confidence: s.confidence })).sort((a, b) => b.level - a.level) })),
        credentials: creds.map(c => ({ title: lang === 'en' && c.title_en ? c.title_en : c.title_ar, kind: credentialKindLabel(c.kind, lang), date: fmtDate(c.issued_at, lang), code: c.code, level: c.level })),
        footer: ar ? `صادر إلكترونيًا من بوابة أَثَر بتاريخ ${day} · © 2026 د. أحمد محمد عبدالعزيز بدوي` : `Issued electronically by Athar · TRACE on ${day} · © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi`,
        verifyHint: ar ? 'امسح الرمز لعرض الملف المهاري الحي والتحقق من الشهادات.' : 'Scan to open the live skills profile and verify credentials.',
      };
      await downloadPassport(data);
    } catch (e: any) { setPdfErr(String(e?.message || e)); }
    setPdfBusy(false);
  }
  return (
    <main className="pt-main pp">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <span>{lang === 'ar' ? 'ملف مهاري' : 'Skills profile'}</span></div>
        <div className="pp-head"><span className="pp-av">{(p.display_name || '?').slice(0, 1)}</span><div><h1>{p.display_name || (lang === 'ar' ? 'متعلم في أَثَر' : 'Athar learner')}</h1><p>{[p.headline, p.organization, p.city].filter(Boolean).join(' · ')}</p><div className="pt-chips"><span className="pt-tag">{lang === 'ar' ? 'ملف مهاري موثّق من أَثَر' : 'Verified Athar skills profile'}</span><span className="pt-tag soon">{skills.length} {lang === 'ar' ? 'مهارة' : 'skills'} · {creds.length} {lang === 'ar' ? 'شهادة' : 'credentials'}</span><button type="button" className="pt-btn light small pp-pdf" disabled={pdfBusy} onClick={passport}><Icon name="download" size={13} /> {pdfBusy ? '…' : (lang === 'ar' ? 'جواز المهارات PDF' : 'Skills passport PDF')}</button></div>{pdfErr && <small className="pp-err">{pdfErr}</small>}</div></div>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          {byDomain.length === 0 && <div className="pt-box pt-empty"><p>{lang === 'ar' ? 'لا مهارات معروضة بعد.' : 'No skills to show yet.'}</p></div>}
          {byDomain.map(({ d, items }) => <div key={d.value} className="pt-box"><h3>{domainLabel(d.value, lang)}</h3><div className="pp-list">{items.map(s => <div key={s.code} className="pp-skill"><div><b>{lang === 'en' ? s.name_en : s.name_ar}</b><small>{s.code}{s.saqf_level ? ` · SAQF ${s.saqf_level}` : ''}{s.cefr_level ? ` · CEFR ${s.cefr_level}` : ''}{s.sdaia_code ? ` · ${s.sdaia_code}` : ''}</small></div><div className="pp-lv"><div className="pp-dots">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= lv(s) ? 'on' : ''} />)}</div><small>{lv(s)}/5 · {levelName(lv(s), lang)}{s.approved_level ? (lang === 'ar' ? ' · معتمد ✓' : ' · approved ✓') : ''}</small></div></div>)}</div></div>)}
        </div>
        <aside className="pt-box pt-sticky"><h3><Icon name="award" size={18} /> {lang === 'ar' ? 'الشهادات الرقمية' : 'Digital credentials'}</h3>{creds.length === 0 && <p className="pt-muted">{lang === 'ar' ? 'لا شهادات بعد.' : 'No credentials yet.'}</p>}<div className="pp-creds">{creds.map(c => <Link key={c.code} href={`/credential/${c.code}`} className="pp-cred"><b>{lang === 'en' && c.title_en ? c.title_en : c.title_ar}</b><small>{credentialKindLabel(c.kind, lang)}{c.level ? ` · ${c.level}` : ''} · <bdi>{fmtDate(c.issued_at, lang)}</bdi></small><span><Icon name="shield" size={12} /> {lang === 'ar' ? 'تحقق' : 'Verify'}</span></Link>)}</div><small className="pt-muted" style={{ display: 'block', marginTop: 12 }}>{lang === 'ar' ? 'المستويات المحسوبة مؤشر مبني على أدلة مسجّلة؛ «معتمد» يعني أن مدربًا أو الإدارة أقرّه.' : 'Computed levels are evidence-based indicators; “approved” means a trainer or admin confirmed it.'}</small></aside>
      </div></section>
      {p.share_mode === 'public' && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(personJsonLd({ public_id: p.public_id || id, display_name: p.display_name, headline: p.headline, city: p.city, organization: p.organization, share_mode: p.share_mode, skills, credentials: creds }, site)) }} />}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}
const CSS = `
.pp-head{display:flex;gap:16px;align-items:center}.pp-av{width:64px;height:64px;border-radius:18px;background:#c9a24b;color:#1f2937;display:inline-grid;place-items:center;font-size:26px;font-weight:900;flex:none}.pp-head h1{margin:0 0 4px}.pp-head p{margin:0 0 8px;color:rgba(255,255,255,.85)}
.pp-list{display:grid;gap:8px}.pp-skill{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;background:#fff}.pp-skill b{display:block;font-size:14.5px;color:#0f172a}.pp-skill small{color:#64748b;font-size:12px;direction:ltr;display:block;text-align:start}
.pp-lv{display:grid;gap:3px;justify-items:end}.pp-dots{display:flex;gap:3px}.pp-dots i{width:14px;height:8px;border-radius:4px;background:#e2e8f0}.pp-dots i.on{background:#0b8a83}.pp-lv small{font-size:11.5px;color:#0f2a4e;font-weight:800}
.pp-creds{display:grid;gap:8px}.pp-cred{display:grid;gap:2px;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;text-decoration:none;color:inherit;background:#fdf6e3}.pp-cred b{font-size:13.5px;color:#0f172a}.pp-cred small{color:#64748b;font-size:12px}.pp-cred span{color:#0b8a83;font-weight:800;font-size:12px;display:inline-flex;gap:4px;align-items:center}
.pt-sticky{position:sticky;top:84px}.pt-muted{color:#64748b;font-size:13px;line-height:1.8}.pp-pdf{margin-inline-start:4px}.pp-err{color:#fecaca;display:block;margin-top:6px}@media(max-width:760px){.pt-sticky{position:static}.pp-skill{flex-direction:column;align-items:flex-start}}
`;
