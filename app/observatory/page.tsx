'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — مرصد القدرة البشرية (P18): «طقس القدرة» العام — خريطة قطاعات حيّة، مؤشر أَثَر، إشارات مبكرة، الحقيقة والادعاء، العدد الربعي الموقَّع، بيانات مفتوحة CC BY 4.0
// لا أسماء ولا معرّفات هنا أبدًا: كل خلية ≥ 5 أشخاص و≥ 2 جهة، الأعداد شرائح، والكتم مسجَّل بسببه. ?issue=2026-Q4 يعرض عددًا منشورًا مجمَّدًا قابلًا للطباعة والتحقق.

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { fmtDate } from '../../lib/portal/content';
import { domainLabel } from '../../lib/portal/skills';
import { WEATHER_LABEL, CONF_LABEL, K_PERSONS, K_ORGS } from '../../lib/portal/observatory';
import type { Snapshot, SectorReport, Weather } from '../../lib/portal/observatory';

export default function ObservatoryPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type Issue = { quarter: string; editorial_ar: string; data: Snapshot; signed: boolean; vc_code: string | null; verify_url: string | null; published_at: string };

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const sp = useSearchParams(); const issueQ = sp.get('issue') || '';
  const [snap, setSnap] = useState<Snapshot | null>(null); const [issue, setIssue] = useState<Issue | null>(null); const [issues, setIssues] = useState<{ quarter: string; vc_code: string | null; published_at: string }[]>([]);
  const [contrib, setContrib] = useState<{ name_ar: string; sector: string }[]>([]); const [sel, setSel] = useState(''); const [err, setErr] = useState(''); const [loaded, setLoaded] = useState(false);
  useEffect(() => { (async () => {
    try {
      if (issueQ) { const j = await fetch(`/api/observatory?issue=${encodeURIComponent(issueQ)}`).then(r => r.json()); if (!j.success) throw new Error(j.error); setIssue(j.issue); setSnap(j.issue.data); }
      else { const j = await fetch('/api/observatory', { cache: 'no-store' }).then(r => r.json()); if (!j.success) throw new Error(j.error); setSnap(j.snapshot); setContrib(j.contributors || []); }
      const li = await fetch('/api/observatory?issues=1').then(r => r.json()).catch(() => null); setIssues(li?.issues || []);
    } catch (e: any) { setErr(e.message || String(e)); } setLoaded(true); })(); }, [issueQ]);
  const s = snap; const sectors = s?.sectors || []; const live = sectors.filter(x => x.cell); const cur = useMemo(() => sectors.find(x => x.code === sel) || live[0] || null, [sectors, live, sel]);
  const W = (w: Weather) => WEATHER_LABEL[w]; const lbl = (w: Weather) => ar ? W(w).ar : W(w).en;
  const headline = useMemo(() => { if (!live.length) return ar ? 'المرصد يجمع أدلته — لا خلية بلغت حدّ النشر بعد' : 'The observatory is gathering evidence — no cell has reached the publication threshold yet'; const up = live.filter(x => x.weather === 'rising').length, down = live.filter(x => x.weather === 'cooling').length; return ar ? `${up} ${up === 1 ? 'قطاع صاعد' : 'قطاعات صاعدة'} · ${down} ${down === 1 ? 'قطاع يبرد' : 'قطاعات تبرد'} · ${live.length - up - down} مستقر` : `${up} rising · ${down} cooling · ${live.length - up - down} stable`; }, [live, ar]);

  return <div className="obs" dir={ar ? 'rtl' : 'ltr'} data-testid="obs-page">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="obs-hero">
      <div className="obs-kicker">{ar ? 'مرصد أَثَر للقدرة البشرية' : 'Athar Human Capability Observatory'}{issue && <span className="obs-chip" data-testid="obs-issue-chip">{ar ? 'العدد' : 'Issue'} {issue.quarter}</span>}</div>
      <h1>{ar ? 'طقس القدرة' : 'Capability weather'} <span className="obs-day">{s ? fmtDate(s.computed_at, lang) : ''}</span></h1>
      <p className="obs-lead" data-testid="obs-headline">{loaded ? headline : (ar ? '…' : '…')}</p>
      <p className="obs-sub">{ar ? `من أدلة أداء حقيقية — لا استبيانات. لا أسماء، لا جهات بلا إذنها، ولا خلية بأقل من ${K_PERSONS} أشخاص و${K_ORGS} جهة.` : `From real performance evidence — not surveys. No names, no organisations without consent, no cell below ${K_PERSONS} persons and ${K_ORGS} organisations.`}</p>
      {s && <div className="obs-totals" data-testid="obs-totals"><span>{ar ? 'أشخاص' : 'People'} <b>{s.totals.people}</b></span><span>{ar ? 'جهات' : 'Organisations'} <b>{s.totals.orgs}</b></span><span>{ar ? 'أدلة' : 'Evidence'} <b>{s.totals.evidence}</b></span><span>{ar ? 'قطاعات منشورة' : 'Sectors published'} <b>{s.totals.sectors_published}</b></span><span>{ar ? 'مكتومة' : 'Suppressed'} <b>{s.totals.sectors_suppressed}</b></span></div>}
    </header>
    {err && <div className="pt-alert err">{err}</div>}
    {issue && <section className="obs-editorial pt-box" data-testid="obs-editorial"><h2>{ar ? 'افتتاحية العدد' : 'Editorial'}</h2><p>{issue.editorial_ar || (ar ? '—' : '—')}</p>
      <div className="obs-row">{issue.signed && issue.verify_url ? <a className="pt-btn" href={issue.verify_url} data-testid="obs-verify"><Icon name="shield" size={16} /> {ar ? 'تحقّق من توقيع العدد' : 'Verify issue signature'} · {issue.vc_code}</a> : <span className="obs-muted">{ar ? 'هذا العدد غير موقَّع' : 'This issue is unsigned'}</span>}
        <a className="pt-btn ghost" href={`/api/observatory?issue=${encodeURIComponent(issue.quarter)}&format=csv`}>CSV</a><a className="pt-btn ghost" href={`/api/observatory?issue=${encodeURIComponent(issue.quarter)}`}>JSON</a><button className="pt-btn ghost" onClick={() => window.print()}>{ar ? 'طباعة' : 'Print'}</button><Link className="pt-btn ghost" href="/observatory">{ar ? 'الطقس الحي' : 'Live weather'}</Link></div></section>}

    {/* خريطة القطاعات */}
    <section className="obs-map" data-testid="obs-map">
      {sectors.map(x => <button key={x.code} className={`obs-cell w-${x.weather}${cur?.code === x.code ? ' on' : ''}${x.cell ? '' : ' mute'}`} onClick={() => setSel(x.code)} data-testid={`obs-sector-${x.code}`} style={{ ['--c' as any]: W(x.weather).color }}>
        <span className="obs-ico">{W(x.weather).icon}</span><span className="obs-name">{ar ? x.name_ar : x.name_en}</span>
        {x.cell ? <><span className="obs-idx">{x.cell.index}</span><span className="obs-w">{lbl(x.weather)}{x.delta ? ` ${x.delta > 0 ? '+' : ''}${x.delta}` : ''}</span></> : <span className="obs-w">{ar ? 'مكتوم — ' + (x.suppressed[0] || '') : 'suppressed'}</span>}
      </button>)}
      {loaded && !sectors.length && <div className="obs-empty">{ar ? 'لا بيانات بعد.' : 'No data yet.'}</div>}
    </section>

    {cur && cur.cell && <section className="obs-detail" data-testid="obs-detail">
      <div className="obs-grid">
        <div className="pt-box obs-index" data-testid="obs-index">
          <h2>{ar ? 'مؤشر أَثَر للقدرة' : 'Athar capability index'} — {ar ? cur.name_ar : cur.name_en}</h2>
          <div className="obs-gauge"><div className="obs-bar"><i style={{ width: `${cur.cell.index}%`, background: W(cur.weather).color }} /></div><b>{cur.cell.index}</b><span>/100</span></div>
          <ul className="obs-facts"><li>{ar ? 'المستوى من الأدلة' : 'Evidence level'}: <b>{cur.cell.level}</b> / 5</li><li>{ar ? 'الثقة' : 'Confidence'}: <b>{ar ? CONF_LABEL[cur.cell.confidence].ar : CONF_LABEL[cur.cell.confidence].en}</b></li><li>{ar ? 'أشخاص' : 'People'}: <b>{cur.cell.people}</b> · {ar ? 'جهات' : 'Orgs'}: <b>{cur.cell.orgs}</b></li><li>{ar ? 'معتمَد بشريًا' : 'Human-approved'}: <b>{cur.cell.approved_pct}%</b></li></ul>
          {cur.domains.length > 0 && <div className="obs-doms">{cur.domains.map(d => <div key={d.domain} className="obs-dom"><span>{domainLabel(d.domain, lang)}</span><div className="obs-bar sm"><i style={{ width: `${d.cell.index}%` }} /></div><b>{d.cell.index}</b></div>)}</div>}
        </div>
        <div className="pt-box obs-signals" data-testid="obs-signals">
          <h2>{ar ? 'إشارات مبكرة' : 'Early signals'}</h2>
          <div className="obs-sig-cols">
            <div><h3>☀ {ar ? 'تصعد' : 'Rising'}</h3>{cur.rising.length ? cur.rising.map(g => <div key={g.skill_id} className="obs-sig up"><b>{ar ? g.name_ar : g.name_en || g.name_ar}</b><span>+{g.delta} · {g.people}</span><small>{ar ? 'لماذا: ' : 'Why: '}{ar ? g.why_ar : g.why_en}</small></div>) : <p className="obs-muted">{ar ? 'لا إشارة كافية' : 'No sufficient signal'}</p>}</div>
            <div><h3>🌧 {ar ? 'تبرد' : 'Cooling'}</h3>{cur.cooling.length ? cur.cooling.map(g => <div key={g.skill_id} className="obs-sig down"><b>{ar ? g.name_ar : g.name_en || g.name_ar}</b><span>{g.delta} · {g.people}</span><small>{ar ? 'لماذا: ' : 'Why: '}{ar ? g.why_ar : g.why_en}</small></div>) : <p className="obs-muted">{ar ? 'لا إشارة كافية' : 'No sufficient signal'}</p>}</div>
          </div>
        </div>
      </div>
      <div className="pt-box obs-gap" data-testid="obs-gap">
        <h2>{ar ? 'الحقيقة والادعاء' : 'Truth vs claim'}</h2>
        {cur.gap ? <div className="obs-gap-row"><div><span>{ar ? 'ما يدّعيه الناس عن أنفسهم' : 'Self-rated'}</span><b>{cur.gap.claimed}</b></div><div className="obs-vs">{ar ? 'مقابل' : 'vs'}</div><div><span>{ar ? 'ما تقوله الأدلة' : 'Evidence says'}</span><b>{cur.gap.actual}</b></div><div className={`obs-verdict ${cur.gap.verdict}`}>{cur.gap.verdict === 'over' ? (ar ? `ادعاء أعلى من الدليل بـ ${cur.gap.gap}` : `Over-claim by ${cur.gap.gap}`) : cur.gap.verdict === 'under' ? (ar ? `تواضع: الدليل أعلى من الادعاء بـ ${Math.abs(cur.gap.gap)}` : `Under-claim by ${Math.abs(cur.gap.gap)}`) : (ar ? 'الادعاء والدليل متقاربان' : 'Claim and evidence aligned')}<small>{cur.gap.people} {ar ? 'شخصًا قيّموا أنفسهم' : 'self-rated'}</small></div></div> : <p className="obs-muted">{ar ? `تُعرض حين يقيّم ${K_PERSONS} أشخاص أنفسهم على الأقل في هذا القطاع.` : `Shown once ${K_PERSONS}+ people have self-rated in this sector.`}</p>}
      </div>
      {cur.suppressed.length > 0 && <p className="obs-muted obs-supp">{ar ? 'كُتم في هذا القطاع: ' : 'Suppressed here: '}{cur.suppressed.join(' · ')}</p>}
    </section>}

    {/* المجالات عبر القطاعات */}
    {s && s.domains.some(d => d.cell) && <section className="pt-box obs-domains" data-testid="obs-domains"><h2>{ar ? 'المجالات الإنسانية — كل القطاعات' : 'Human domains — all sectors'}</h2>
      <div className="obs-doms">{s.domains.filter(d => d.cell).map(d => <div key={d.domain} className="obs-dom"><span>{W(d.weather).icon} {domainLabel(d.domain, lang)}</span><div className="obs-bar sm"><i style={{ width: `${d.cell!.index}%` }} /></div><b>{d.cell!.index}</b></div>)}</div></section>}

    <div className="obs-grid">
      <section className="pt-box obs-issues" data-testid="obs-issues"><h2>{ar ? 'العدد الربعي' : 'Quarterly issue'}</h2>
        <p className="obs-muted">{ar ? 'كل ربع يُجمَّد العدد ويُوقَّع رقميًا ويُنشر بافتتاحية تحريرية — ويمكن لأي جهة التحقق من توقيعه مستقلًا.' : 'Each quarter the issue is frozen, digitally signed and published with an editorial — anyone can verify it independently.'}</p>
        {issues.length ? <ul>{issues.map(i => <li key={i.quarter}><Link href={`/observatory?issue=${encodeURIComponent(i.quarter)}`}>{ar ? 'العدد' : 'Issue'} {i.quarter}</Link> <small>{fmtDate(i.published_at, lang)}</small> {i.vc_code && <a href={`/verify/vc?code=${encodeURIComponent(i.vc_code)}`} className="obs-chip">{ar ? 'موقَّع' : 'signed'}</a>}</li>)}</ul> : <p className="obs-muted" data-testid="obs-no-issues">{ar ? 'لم يصدر عدد بعد.' : 'No issue yet.'}</p>}
      </section>
      <section className="pt-box obs-open" data-testid="obs-download"><h2>{ar ? 'بيانات مفتوحة' : 'Open data'}</h2>
        <p className="obs-muted">{ar ? 'رخصة CC BY 4.0 — انسب إلى «مرصد أَثَر للقدرة البشرية». البيانات مجمَّعة ومكتومة بالقواعد نفسها المعروضة هنا.' : 'CC BY 4.0 — attribute to “Athar Human Capability Observatory”. Aggregated and suppressed with the same rules shown here.'}</p>
        <div className="obs-row"><a className="pt-btn" href="/api/observatory?format=csv">CSV</a><a className="pt-btn ghost" href="/api/observatory">JSON API</a><a className="pt-btn ghost" href="/.well-known/did.json">did.json</a></div>
        {contrib.length > 0 && <p className="obs-contrib"><b>{ar ? 'مساهمون في المرصد (بإذنهم): ' : 'Contributors (with consent): '}</b>{contrib.map(c => c.name_ar).join(' · ')}</p>}
      </section>
    </div>

    {s && <section className="pt-box obs-method" data-testid="obs-method"><h2>{ar ? 'المنهجية والخصوصية' : 'Method & privacy'}</h2><ol>{(ar ? s.method_ar : s.method_en).map((m, i) => <li key={i}>{m}</li>)}</ol>
      {s.suppressed_log.length > 0 && <details><summary>{ar ? `سجل الكتم (${s.suppressed_log.length})` : `Suppression log (${s.suppressed_log.length})`}</summary><ul>{s.suppressed_log.map((l, i) => <li key={i}>{l.scope} — {l.reason_ar}</li>)}</ul></details>}
      <p className="obs-muted">{ar ? 'الجهات: موقعكم مقابل قطاعكم في بوابة الجهة → تبويب «المرصد».' : 'Organisations: your position vs your sector in the org portal → “Observatory” tab.'} <Link href="/org">/org</Link></p></section>}
    <footer className="obs-foot">© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — {ar ? 'مرصد أَثَر للقدرة البشرية' : 'Athar Human Capability Observatory'}</footer>
  </div>;
}

const CSS = `
.obs{max-width:1100px;margin:0 auto;padding:18px 16px 40px;font-family:inherit}
.obs-hero{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:22px;padding:28px 24px;margin-bottom:18px;position:relative;overflow:hidden}
.obs-hero:after{content:'';position:absolute;inset:auto -60px -80px auto;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,75,.35),transparent 70%)}
.obs-kicker{font-size:13px;letter-spacing:.3px;opacity:.9;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.obs-hero h1{margin:6px 0 4px;font-size:34px;line-height:1.2}.obs-day{font-size:15px;opacity:.85;font-weight:400;margin-inline-start:8px}
.obs-lead{font-size:18px;margin:6px 0 2px;font-weight:600}.obs-sub{opacity:.88;font-size:13px;margin:0}
.obs-totals{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;font-size:13px}.obs-totals span{background:rgba(255,255,255,.12);padding:6px 10px;border-radius:999px}.obs-totals b{margin-inline-start:4px}
.obs-chip{background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;text-decoration:none}
.obs-map{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:16px}
.obs-cell{border:2px solid transparent;border-radius:16px;padding:14px 12px;background:#fff;box-shadow:0 2px 10px rgba(15,42,78,.06);cursor:pointer;text-align:start;display:flex;flex-direction:column;gap:4px;transition:transform .15s;position:relative;overflow:hidden;font:inherit}
.obs-cell:before{content:'';position:absolute;inset:0 0 auto 0;height:5px;background:var(--c)}
.obs-cell:hover{transform:translateY(-2px)}.obs-cell.on{border-color:var(--c)}.obs-cell.mute{opacity:.55;background:#f8fafc}
.obs-ico{font-size:26px;line-height:1}.obs-name{font-weight:700;color:#0f2a4e;font-size:14px}.obs-idx{font-size:30px;font-weight:800;color:var(--c);line-height:1}.obs-w{font-size:12px;color:#475569}
.obs-empty{grid-column:1/-1;padding:30px;text-align:center;color:#64748b}
.obs-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}@media(max-width:820px){.obs-grid{grid-template-columns:1fr}}
.obs h2{font-size:17px;margin:0 0 10px;color:#0f2a4e}.obs h3{font-size:14px;margin:0 0 6px;color:#334155}
.obs-gauge{display:flex;align-items:center;gap:10px;margin-bottom:8px}.obs-gauge b{font-size:32px;color:#0f2a4e}.obs-gauge span{color:#64748b}
.obs-bar{flex:1;height:14px;background:#e2e8f0;border-radius:999px;overflow:hidden}.obs-bar i{display:block;height:100%;background:#0b8a83;border-radius:999px;transition:width .6s}.obs-bar.sm{height:8px}
.obs-facts{list-style:none;padding:0;margin:0 0 10px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:13px;color:#334155}
.obs-doms{display:flex;flex-direction:column;gap:6px}.obs-dom{display:grid;grid-template-columns:150px 1fr 36px;align-items:center;gap:8px;font-size:13px}.obs-dom b{text-align:end}
.obs-sig-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.obs-sig{border-inline-start:3px solid #0b8a83;padding:4px 10px;margin-bottom:8px;display:flex;flex-direction:column}.obs-sig.down{border-color:#b45309}.obs-sig span{font-size:12px;color:#0b8a83}.obs-sig.down span{color:#b45309}.obs-sig small{color:#64748b;font-size:12px}
.obs-gap-row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.obs-gap-row>div{display:flex;flex-direction:column}.obs-gap-row span{font-size:12px;color:#64748b}.obs-gap-row b{font-size:28px;color:#0f2a4e}.obs-vs{color:#94a3b8;font-size:13px}
.obs-verdict{padding:8px 12px;border-radius:12px;background:#f1f5f9;font-weight:600;color:#0f2a4e}.obs-verdict.over{background:#fff7ed;color:#9a3412}.obs-verdict.under{background:#ecfeff;color:#155e75}.obs-verdict small{display:block;font-weight:400;color:#64748b;font-size:12px}
.obs-muted{color:#64748b;font-size:13px}.obs-supp{margin:4px 0 0}.obs-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.obs-issues ul,.obs-method ul{padding-inline-start:18px;font-size:13px}.obs-issues li{margin-bottom:6px}.obs-issues small{color:#94a3b8;margin-inline-start:6px}
.obs-method ol{padding-inline-start:18px;font-size:13px;color:#334155;line-height:1.8}.obs-method details{margin-top:6px;font-size:13px}.obs-contrib{font-size:13px;color:#334155;margin:10px 0 0}
.obs-editorial p{font-size:15px;line-height:1.9;color:#1e293b;white-space:pre-wrap}.obs-foot{text-align:center;color:#94a3b8;font-size:12px;margin-top:20px}
.obs .pt-btn.ghost{background:#fff;color:#0f2a4e;border:1px solid #cbd5e1}
@media print{.obs-hero{background:#0f2a4e!important;-webkit-print-color-adjust:exact}.obs-cell{break-inside:avoid}.pt-btn,.obs-foot a{display:none}}
`;
