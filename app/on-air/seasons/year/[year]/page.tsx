'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /on-air/seasons/year/[year] — «سجلّ السنة» (P37 عُمر الهواء):
 *  فصل سنوي يُخاط من سجلّات المواسم المجمَّدة لسنة ميلادية (مع ما يقابلها هجريًا في العنوان): كم موسمًا · كم جهة مختلفة (من خمسة) · كم مدينة · شريحة اللقاءات ·
 *  ساعات الإشارة المحقَّقة · الساعات المشتركة بين الجهات · الذروة. لا أسماء أفراد. صفحة عامة. WCAG 2.2 AA.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../../../lib/ui/icons';
import { PortalShell, useLang } from '../../../../components/PortalShell';
import { P37_NAMES_AR, P36_NAMES_AR } from '../../../../../lib/onair/registry';

export default function YearPage({ params }: { params: { year: string } }) { return <PortalShell><Inner year={params.year} /></PortalShell>; }
function Inner({ year }: { year: string }) {
  const { lang } = useLang(); const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { let alive = true; fetch(`/api/onair?year=${encodeURIComponent(year)}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (!alive) return; if (j?.success) setD(j); else setErr(j?.error || 'تعذّر التحميل'); }).catch(() => alive && setErr('تعذّر التحميل')); return () => { alive = false; }; }, [year]);
  const y = d?.year; const years: number[] = d?.years || [];
  return <main className="pt-main oyr" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <p className="oyr-crumb"><Link href="/on-air">{ar ? 'على الهواء' : 'On air'}</Link> › <Link href="/on-air/seasons">{ar ? P36_NAMES_AR.record : 'Season records'}</Link> › {ar ? P37_NAMES_AR.year : 'Year record'}</p>
    {err && <p className="oyr-err" role="alert" data-testid="oyr-err">{err}</p>}
    {!d && !err && <p className="pt-muted">…</p>}
    {y && <>
      <header className="oyr-h" data-testid="oyr-head" data-seasons={y.seasons}><span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? `أَثَر معك — ${P37_NAMES_AR.continuity}` : 'Athar with you — Continuity of the Air'}</span>
        <h1>{ar ? `${P37_NAMES_AR.year} ${y.year}` : `Year record ${y.year}`}<small className="oyr-hijri" data-testid="oyr-hijri"> · {y.hijri_ar}</small></h1>
        <p className="oyr-line" data-testid="oyr-line">{y.line_ar}</p>
      </header>
      {!y.seasons && <section className="pt-box"><p className="pt-muted" data-testid="oyr-none">{ar ? 'لم يُجمَّد سجلّ موسم في هذه السنة بعد — الفصل يُكتب حين ينتهي أول موسم فيها.' : 'No frozen season record in this year yet.'}</p></section>}
      {y.seasons > 0 && <>
        <section className="pt-box oyr-kpis" data-testid="oyr-kpis">
          <div><b>{y.seasons}</b><span>{ar ? (y.seasons === 1 ? 'موسم' : y.seasons === 2 ? 'موسمان' : 'مواسم') : 'seasons'}</span></div>
          <div><b>{y.orgs_distinct.ar}</b><span>{ar ? 'جهات مختلفة' : 'distinct organizations'}</span></div>
          <div><b>{y.org_participations}</b><span>{ar ? 'مشاركات جهات (عبر المواسم)' : 'organization participations'}</span></div>
          <div><b>{y.cities.length}</b><span>{ar ? 'مدن' : 'cities'}</span></div>
          <div><b>{y.meetings_band}</b><span>{ar ? 'لقاءات على الهواء' : 'meetings'}</span></div>
          <div><b>{y.sign_verified + y.sign_hours_verified}</b><span>{ar ? `ساعات بالإشارة حضرها مترجم (منها ${y.sign_hours_verified} من «${P37_NAMES_AR.season_sign}»)` : 'verified signed hours'}</span></div>
          <div><b>{y.shared}</b><span>{ar ? 'ساعات مشتركة بين جهتين' : 'shared hours'}</span></div>
        </section>
        <section className="pt-box oyr-two">
          <div><h2>{ar ? 'المدن' : 'Cities'}</h2>{!y.cities.length && <p className="pt-muted">—</p>}<ul className="oyr-cities" data-testid="oyr-cities">{y.cities.map((c: any) => <li key={c.key}><b>{c.ar}</b> · {c.n} {ar ? (c.n === 1 ? 'مشاركة' : c.n === 2 ? 'مشاركتان' : 'مشاركات') : 'participations'}</li>)}</ul></div>
          <div><h2>{ar ? 'ذروة السنة' : 'Peak of the year'}</h2>{y.peak ? <p className="oyr-peak" data-testid="oyr-peak"><b>{y.peak.weekday_ar} {y.peak.hour_ar}</b> — {ar ? 'الساعة التي تكرّرت في ذُرى المواسم أكثر من غيرها' : 'the hour most repeated among season peaks'}</p> : <p className="pt-muted">{ar ? 'لم تبلغ ساعةٌ الذروة في مواسم هذه السنة.' : '—'}</p>}</div>
        </section>
        <section className="pt-box"><h2>{ar ? 'مواسم السنة' : 'Seasons of the year'}</h2>
          <ul className="oyr-seasons" data-testid="oyr-seasons">{y.season_ids.map((id: string, i: number) => <li key={id}><Link href={`/on-air/seasons/${id}`}>{ar ? `سجلّ الموسم ${i + 1}` : `Season record ${i + 1}`} · #{id}</Link></li>)}</ul>
          <p className="pt-muted">{d.note_ar}</p>
        </section>
      </>}
      <nav aria-label={ar ? 'سنوات أخرى' : 'Other years'} className="oyr-years" data-testid="oyr-years">{years.map(n => <Link key={n} href={`/on-air/seasons/year/${n}`} className={`pt-btn small ${n === y.year ? 'gold' : 'ghost'}`} aria-current={n === y.year ? 'page' : undefined}>{n}</Link>)}<Link href="/on-air/seasons" className="pt-btn ghost small">{ar ? 'كل المواسم' : 'All seasons'}</Link></nav>
    </>}
  </main>;
}
const CSS = `
.oyr{max-width:900px;margin:0 auto;padding:28px 18px 60px}.oyr-crumb{color:#64748b;font-size:13px;margin:0 0 8px}.oyr-crumb a{color:#0b6f69}.oyr-err{color:#b91c1c;font-weight:800}
.oyr-h h1{margin:6px 0 6px;font-size:30px;color:#0f2a4e}.oyr-hijri{font-size:15px;color:#475569;font-weight:600}.oyr-line{background:#0f2a4e;color:#fde68a;border-radius:999px;padding:6px 14px;display:inline-block;font-weight:800;margin:0 0 14px;line-height:1.8}
.oyr .pt-box{margin-bottom:16px}.oyr h2{font-size:19px;color:#0f2a4e;margin:0 0 10px}
.oyr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.oyr-kpis div{background:#f8fafc;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;color:#334155;font-size:13px}.oyr-kpis b{font-size:22px;color:#0f2a4e}
.oyr-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:700px){.oyr-two{grid-template-columns:1fr}}
.oyr-cities,.oyr-seasons{list-style:none;margin:0;padding:0;display:grid;gap:6px;color:#334155}.oyr-seasons a{color:#0b6f69;min-height:44px;display:inline-flex;align-items:center}.oyr-peak{color:#334155;line-height:1.8;margin:0}
.oyr-years{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
`;
