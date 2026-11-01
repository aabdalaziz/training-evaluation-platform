'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /on-air/seasons/[id] — صفحة موسم واحد (P36 «سجلّ الموسم»):
 *  قبل النهاية: الحالة · الساعات المعلنة (بالإشارة مميَّزة) · «أضِف إلى تقويمك». بعد النهاية: السجلّ المجمَّد المجهَّل — جهات · مدن · الساعات الأكثف · شريحة اللقاءات · ساعات بالإشارة حضرها مترجم · وثائق ATH-OS (بإذن الجهة).
 *  لا أسماء أفراد؛ الأعداد من خمسة. WCAG 2.2 AA.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../../lib/ui/icons';
import { PortalShell, useLang } from '../../../components/PortalShell';
import { P36_NAMES_AR, P37_NAMES_AR } from '../../../../lib/onair/registry';

export default function SeasonPage({ params }: { params: { id: string } }) { return <PortalShell><Inner id={params.id} /></PortalShell>; }
function Inner({ id }: { id: string }) {
  const { lang } = useLang(); const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { let alive = true; fetch(`/api/onair?season=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (!alive) return; if (j?.success) setD(j); else setErr(j?.error || 'تعذّر التحميل'); }).catch(() => alive && setErr('تعذّر التحميل')); return () => { alive = false; }; }, [id]);
  const s = d?.season; const r = d?.record;
  return <main className="pt-main osn" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <p className="osn-crumb"><Link href="/on-air">{ar ? 'على الهواء' : 'On air'}</Link> › <Link href="/on-air/seasons">{ar ? P36_NAMES_AR.record : 'Season records'}</Link></p>
    {err && <p className="osn-err" role="alert" data-testid="osn-err">{err}</p>}
    {!d && !err && <p className="pt-muted">…</p>}
    {s && <>
      <header className="osn-h" data-testid="osn-head" data-phase={s.phase}><span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? (s.phase === 'after' ? P36_NAMES_AR.record : 'موسم الهواء') : 'Season'}</span>
        <h1>{s.title_ar}</h1><p className="osn-sub">{s.from_day} → {s.to_day} · <b>{s.phrase}</b>{s.invite_ar ? <> · «{s.invite_ar}»</> : null}</p>
        {r && <p className="osn-line" data-testid="osn-line">{r.line_ar}</p>}
        {r && <p className="osn-links"><Link href={`/on-air/seasons/year/${String(s.to_day).slice(0, 4)}`} className="pt-btn ghost small" data-testid="osn-year-link">📚 {ar ? `${P37_NAMES_AR.year} ${String(s.to_day).slice(0, 4)}` : `Year record ${String(s.to_day).slice(0, 4)}`}</Link></p>}
        {s.phase !== 'after' && <p className="osn-links"><a href={s.ics_url} className="pt-btn gold small" data-testid="osn-ics">📅 {ar ? 'أضِف الموسم إلى تقويمك' : 'Add to calendar'}</a> <Link href="/on-air#season" className="pt-btn ghost small">{ar ? 'خريطة الموسم الحيّة' : 'Live season map'}</Link></p>}
      </header>
      {s.phase !== 'after' && <section className="pt-box"><h2>{ar ? 'الساعات المعلنة' : 'Announced hours'}</h2>
        {!s.slots.length && <p className="pt-muted" data-testid="osn-noslots">{ar ? 'لم تعلن جهة ساعتها بعد.' : 'No hours yet.'}</p>}
        <ul className="osn-slots" data-testid="osn-slots">{s.slots.map((x: any) => <li key={x.id}><b>{x.weekday_ar} {x.from}</b> · {x.duration_min} {ar ? 'دقيقة' : 'min'} · {x.org_name_ar || (ar ? 'جهة (بلا اسم)' : 'an organization')}{x.sign_language ? <span className="osn-sign"> · 🤟 {ar ? 'بالإشارة' : 'signed'}</span> : null}{x.shared ? <span className="osn-shared" data-testid="osn-slot-shared"> · 🤝 {x.shared_label_ar}</span> : null}</li>)}</ul>
        {!!(d.sign_hours || []).length && <><h3>{ar ? `${P37_NAMES_AR.season_sign} — ساعات إشارة مفتوحة` : 'Season interpreters — open sign hours'}</h3><ul className="osn-slots" data-testid="osn-sign-hours">{d.sign_hours.map((h: any) => <li key={h.id}><b>{h.weekday_ar} {h.from}</b> · {h.duration_min} {ar ? 'دقيقة' : 'min'} · 🤟 {h.interpreter_name_ar || (ar ? 'مترجم (الاسم بعد الدخول)' : 'interpreter')}{h.live ? <em> · {ar ? 'الآن' : 'now'}</em> : null}</li>)}</ul></>}
        <p className="pt-muted">{ar ? 'السجلّ العامّ لهذا الموسم يُكتب بعد نهايته.' : 'The record is written after the season ends.'}</p>
      </section>}
      {r && <>
        <section className="pt-box osn-kpis" data-testid="osn-kpis">
          <div><b>{r.days}</b><span>{ar ? 'أيام' : 'days'}</span></div><div><b>{r.orgs}</b><span>{ar ? 'جهات أعلنت ساعتها' : 'organizations'}</span></div><div><b>{r.cities.length}</b><span>{ar ? 'مدن' : 'cities'}</span></div>
          <div><b>{r.meetings_band}</b><span>{ar ? 'لقاءات على الهواء' : 'meetings'}</span></div><div><b>{r.present_people.ar}</b><span>{ar ? 'أشخاص صعدوا خلاله' : 'people on air'}</span></div><div><b>{r.sign_verified}</b><span>{ar ? `ساعات بالإشارة حضرها مترجم (من ${r.sign_slots} معلنة)` : 'verified signed hours'}</span></div>
          {typeof r.sign_hours === 'number' && <div data-testid="osn-kpi-signhours"><b>{r.sign_hours_verified ?? 0}</b><span>{ar ? `ساعات «${P37_NAMES_AR.season_sign}» حضرها مترجمها (من ${r.sign_hours} متعهَّد بها)` : 'verified pledged sign hours'}</span></div>}
          {typeof r.shared === 'number' && <div data-testid="osn-kpi-shared"><b>{r.shared}</b><span>{ar ? 'ساعات مشتركة بين جهتين' : 'shared hours'}</span></div>}
        </section>
        <section className="pt-box osn-two">
          <div><h2>{ar ? 'المدن' : 'Cities'}</h2>{!r.cities.length && <p className="pt-muted">{ar ? 'لا مدن — لم تُعلن جهةٌ ساعتها.' : '—'}</p>}<ul className="osn-cities" data-testid="osn-cities">{r.cities.map((c: any) => <li key={c.key}><b>{c.ar}</b> · {c.n} {ar ? (c.n === 1 ? 'جهة' : c.n === 2 ? 'جهتان' : 'جهات') : 'orgs'}</li>)}</ul></div>
          <div><h2>{ar ? 'الساعات الأكثف' : 'Peak hours'}</h2>{!r.peak.length && <p className="pt-muted" data-testid="osn-nopeak">{ar ? 'تُذكر الساعة إن صعد فيها خمسة أشخاص مختلفون — لم تبلغ ساعةٌ ذلك.' : 'Shown when five different people were on air in that hour.'}</p>}<ol className="osn-peak" data-testid="osn-peak">{r.peak.map((p: any, i: number) => <li key={i}><b>{p.weekday_ar} {p.hour_ar}</b></li>)}</ol></div>
        </section>
        <section className="pt-box"><h2>{ar ? 'ساعات الجهات' : 'Organization hours'}</h2>
          <ul className="osn-slots" data-testid="osn-rslots">{r.slots.map((x: any, i: number) => <li key={i}><b>{x.weekday_ar} {x.from}</b> · {x.duration_min} {ar ? 'دقيقة' : 'min'} · {x.org_name_ar || (ar ? 'جهة (بلا اسم)' : 'an organization')}{x.shared ? <span className="osn-shared"> · 🤝 {ar ? 'ساعة مشتركة' : 'shared'}</span> : null}{x.sign_language ? <span className="osn-sign"> · 🤟 {x.sign_verified ? (ar ? 'بالإشارة — حضر المترجم' : 'signed — interpreter present') : (ar ? 'أُعلنت بالإشارة — لم يُسجَّل حضور المترجم' : 'announced signed — interpreter not recorded')}</span> : null}</li>)}</ul>
          {!!r.docs.length && <><h3>{ar ? 'وثائق الموسم (ATH-OS)' : 'Season documents'}</h3><ul className="osn-docs" data-testid="osn-docs">{r.docs.map((x: any) => <li key={x.code}><b>{x.org_name_ar}</b> · <code>{x.code}</code> · <a href={x.verify_url}>{ar ? 'تحقّق' : 'Verify'}</a></li>)}</ul></>}
          <p className="pt-muted">{ar ? `جُمِّد هذا السجلّ في ${new Date(r.recorded_at).toLocaleDateString('ar-SA')} ولا يتغيّر. لا أسماء أفراد؛ الأعداد من ${d.k}؛ اسم الجهة بإذن مديرها.` : `Frozen on ${new Date(r.recorded_at).toLocaleDateString('en-GB')}.`}</p>
        </section>
      </>}
      <p><Link href="/on-air/seasons" className="pt-btn ghost small">{ar ? 'كل المواسم' : 'All seasons'}</Link> <Link href="/on-air" className="pt-btn ghost small">{ar ? 'صفحة الهواء' : 'On-air page'}</Link> <Link href="/verify/vc" className="pt-btn ghost small">{ar ? 'تحقّق من وثيقة' : 'Verify a document'}</Link></p>
    </>}
  </main>;
}
const CSS = `
.osn{max-width:900px;margin:0 auto;padding:28px 18px 60px}.osn-crumb{color:#64748b;font-size:13px;margin:0 0 8px}.osn-crumb a{color:#0b6f69}.osn-err{color:#b91c1c;font-weight:800}
.osn-h h1{margin:6px 0 6px;font-size:30px;color:#0f2a4e}.osn-sub{color:#334155;margin:0 0 8px;font-size:15px}.osn-line{background:#0f2a4e;color:#fde68a;border-radius:999px;padding:6px 14px;display:inline-block;font-weight:800;margin:0 0 10px}.osn-links{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
.osn .pt-box{margin-bottom:16px}.osn h2{font-size:19px;color:#0f2a4e;margin:0 0 10px}.osn h3{font-size:15px;color:#0f2a4e;margin:12px 0 6px}
.osn-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.osn-kpis div{background:#f8fafc;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;color:#334155;font-size:13px}.osn-kpis b{font-size:22px;color:#0f2a4e}
.osn-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:700px){.osn-two{grid-template-columns:1fr}}
.osn-slots,.osn-cities,.osn-docs{list-style:none;margin:0;padding:0;display:grid;gap:6px;color:#334155}.osn-peak{margin:0;padding-inline-start:20px;color:#334155;line-height:1.9}.osn-sign{color:#701a75;font-weight:800}.osn-shared{color:#9a3412;font-weight:800}.osn-docs code{background:#f1f5f9;border-radius:6px;padding:1px 6px}
`;
