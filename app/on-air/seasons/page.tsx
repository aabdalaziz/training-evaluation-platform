'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /on-air/seasons — «سجلّ الموسم» (P36 ذاكرة الهواء): رفّ المواسم — النشط (مع «أضِف إلى تقويمك») ثم المنتهية بسجلّاتها العامة المجهَّلة.
 *  لا أسماء أفراد؛ الأعداد من خمسة؛ اسم الجهة بإذن مديرها. WCAG 2.2 AA: عناوين مرتبة · روابط واضحة · لا حركة.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { P36_NAMES_AR, P35_NAMES_AR, P37_NAMES_AR } from '../../../lib/onair/registry';

export default function SeasonsPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { let alive = true; fetch('/api/onair?seasons=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (!alive) return; if (j?.success) setD(j); else setErr(j?.error || 'تعذّر التحميل'); }).catch(() => alive && setErr('تعذّر التحميل')); return () => { alive = false; }; }, []);
  const seasons: any[] = d?.seasons || []; const live = seasons.filter(s => s.phase !== 'after'); const ended = seasons.filter(s => s.phase === 'after');
  return <main className="pt-main osr" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="osr-h"><span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? `أَثَر معك — ${P36_NAMES_AR.memory}` : 'Athar with you — Memory of the Air'}</span>
      <h1>{ar ? `${P36_NAMES_AR.record} — ما بقي من كل موسم` : 'Season records — what each season left behind'}</h1>
      <p>{ar ? `كل «${P35_NAMES_AR.season}» ينتهي يترك أثرًا يبقى: كم جهة رفعت يدها، وفي كم مدينة، وأيّ الساعات كانت الأكثف، وهل كان فيه ساعات بالإشارة حضرها مترجم فعلًا. صفحة عامة، مجهَّلة بالكامل: لا أسماء أفراد، الأعداد من خمسة، واسم الجهة لا يظهر إلا بإذن مديرها.` : 'Every finished season leaves a public, fully anonymized record.'}</p>
      {err && <p className="osr-err" role="alert">{err}</p>}
    </header>
    <section className="pt-box"><h2>{ar ? 'الموسم الآن' : 'Current season'}</h2>
      {d && !live.length && <p className="pt-muted" data-testid="osr-live-none">{ar ? 'لا موسم معلَنًا الآن.' : 'No season now.'} <Link href="/on-air">{ar ? 'صفحة الهواء' : 'On-air page'}</Link></p>}
      {live.map(s => <div key={s.id} className="osr-live" data-testid="osr-live"><p className="osr-big">{s.phrase}</p><p><b>{s.title_ar}</b> · {s.from_day} → {s.to_day}{s.invite_ar ? <> · «{s.invite_ar}»</> : null} · {s.slots} {ar ? (s.slots === 1 ? 'ساعة معلنة' : 'ساعات معلنة') : 'hours'}</p>
        <p className="osr-links"><a href={s.ics_url} className="pt-btn gold small" data-testid="osr-ics">📅 {ar ? 'أضِف الموسم إلى تقويمك (.ics)' : 'Add to calendar'}</a> <Link href={`/on-air/seasons/${s.id}`} className="pt-btn ghost small">{ar ? 'صفحة الموسم' : 'Season page'}</Link> <Link href="/on-air#season" className="pt-btn ghost small">{ar ? 'خريطة الموسم' : 'Season map'}</Link></p></div>)}
    </section>
    <section className="pt-box"><h2>{ar ? 'المواسم المنتهية' : 'Finished seasons'}</h2>
      {!d && <p className="pt-muted">…</p>}
      {d && !ended.length && <p className="pt-muted" data-testid="osr-ended-none">{ar ? 'لم ينتهِ موسم بعد — أول موسم يُكتب سجلّه هنا.' : 'No finished season yet.'}</p>}
      <ul className="osr-list" data-testid="osr-list">{ended.map(s => <li key={s.id} data-testid="osr-item"><Link href={`/on-air/seasons/${s.id}`}><b>{s.title_ar}</b><span>{s.from_day} → {s.to_day}</span><small>{s.line_ar}</small></Link></li>)}</ul>
      <p className="pt-muted">{ar ? `السجلّ يُجمَّد مرة واحدة بعد نهاية الموسم، قبل أن يُحذف سجلّ الحضور بعد 90 يومًا — فلا يتغيّر بعدها.` : 'Records are frozen once after the season ends.'}</p>
      {!!(d?.years || []).length && <p className="osr-years" data-testid="osr-years"><b>{ar ? `${P37_NAMES_AR.year}: ` : 'Year records: '}</b>{(d.years as number[]).map(y => <Link key={y} href={`/on-air/seasons/year/${y}`} className="pt-btn ghost small" data-testid="osr-year">{y}</Link>)}<small> — {ar ? 'فصل سنوي يُخاط من سجلّات المواسم' : 'an annual chapter stitched from season records'}</small></p>}
      <p><Link href="/on-air" className="pt-btn ghost small">{ar ? 'صفحة الهواء' : 'On-air page'}</Link> <Link href="/2062" className="pt-btn ghost small">{ar ? 'يوم في 2062' : 'A day in 2062'}</Link> <Link href="/accessibility" className="pt-btn ghost small">{ar ? 'بيان الوصول' : 'Accessibility'}</Link></p>
    </section>
  </main>;
}
const CSS = `
.osr{max-width:900px;margin:0 auto;padding:28px 18px 60px}.osr-h h1{margin:6px 0 8px;font-size:28px;color:#0f2a4e}.osr-h p{color:#334155;line-height:1.9;margin:0 0 12px;font-size:16px}.osr-err{color:#b91c1c;font-weight:800}
.osr .pt-box{margin-bottom:16px}.osr h2{font-size:19px;color:#0f2a4e;margin:0 0 10px}
.osr-live{background:linear-gradient(135deg,#ecfeff,#cffafe);border:1px solid #a5f3fc;border-radius:16px;padding:14px 16px;color:#164e63}.osr-live p{margin:0 0 6px;color:#164e63}.osr-big{font-size:24px;font-weight:900;color:#0e7490}.osr-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px!important}
.osr-years{display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:#0f2a4e}.osr-years small{color:#64748b}
.osr-list{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:8px}.osr-list a{display:grid;gap:2px;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;text-decoration:none;color:#0f2a4e;min-height:44px}.osr-list a:hover{border-color:#0b6f69;background:#f0fbfa}.osr-list b{font-size:16px}.osr-list span{color:#475569;font-size:13px}.osr-list small{color:#334155;line-height:1.7}
`;
