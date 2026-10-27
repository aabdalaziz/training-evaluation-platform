'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — خريطة جداراتي الاثنتي عشرة (P13-أ): ملفك الحقيقي مُسقَطًا على مجالات بناء الإنسان H1–H12 (المهنية منها والشخصية الخاصة)،
// ثلاثة مؤشرات (جاهزية المستقبل، اتزان الجدارات، الشواهد المُصدَّقة بشريًا)، أضعف ثلاثة مجالات وما يبدأ منها، ومواقف اليوم التي خضتها.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { t, fmtDate } from '../../../lib/portal/content';
import { HUMAN_DOMAINS, FAMILIES, domainMap, readinessIndex, balanceIndex, hcri, indexBand, weakestDomains } from '../../../lib/portal/lexicon';
import type { DomainScore } from '../../../lib/portal/lexicon';
import { BAND_LABEL } from '../../../lib/portal/daily-case';

export default function MapPage() { return <PortalShell><Inner /></PortalShell>; }
type CaseRow = { day: string; score: number; band: string; title_ar: string | null; domain_code: string | null; created_at: string };

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState(''); const [loaded, setLoaded] = useState(false); const [map, setMap] = useState<DomainScore[]>([]); const [cases, setCases] = useState<CaseRow[]>([]); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    try { const { data } = await db.auth.getSession(); const tk = data.session?.access_token || ''; setTok(tk); if (!tk) { setLoaded(true); return; }
      const j = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()); if (!j?.success) throw new Error(j?.error || 'error');
      const ids = Array.from(new Set((j.levels || []).map((l: any) => l.skill_id))) as string[];
      const { data: sk } = ids.length ? await db.from('portal_skills').select('id,domain,domain_code').in('id', ids) : { data: [] as any[] };
      setMap(domainMap(j.levels || [], new Map(((sk || []) as any[]).map(s => [s.id, { domain: s.domain, domain_code: s.domain_code }]))));
      const uid = data.session?.user?.id; if (uid) { const { data: cs } = await db.from('portal_daily_case_responses').select('day,score,band,created_at').eq('user_id', uid).order('day', { ascending: false }).limit(14); const rows = (cs || []) as any[]; const days = rows.map(r => r.day); const { data: dc } = days.length ? await db.from('portal_daily_cases').select('day,title_ar,domain_code').in('day', days) : { data: [] as any[] }; const byDay = new Map(((dc || []) as any[]).map(c => [c.day, c])); setCases(rows.map(r => ({ ...r, title_ar: byDay.get(r.day)?.title_ar || null, domain_code: byDay.get(r.day)?.domain_code || null }))); }
    } catch (e: any) { setErr(e.message || 'error'); }
    setLoaded(true);
  })(); }, [db]);
  const readiness = readinessIndex(map), balance = balanceIndex(map), human = hcri(map); const band = indexBand(readiness); const weak = weakestDomains(map, 3);
  const pro = map.filter(m => !m.personal), personal = map.filter(m => m.personal);
  const pts = useMemo(() => map.map((m, i) => { const a = (Math.PI * 2 * i) / Math.max(1, map.length) - Math.PI / 2; const r = 20 + (m.level / 5) * 70; return `${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`; }).join(' '), [map]);

  return (
    <main className="pt-main mp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="pt-sec"><div className="pt-wrap">
        <div className="mp-head"><span className="mp-kicker"><Icon name="compass" size={14} /> {ar ? 'ملفي المهني الرقمي' : 'My digital profile'}</span><h1>{ar ? 'خريطة جداراتي الاثنتا عشرة' : 'My twelve-domain map'}</h1><p>{ar ? 'ملفك الحقيقي مُسقَطًا على مجالات بناء الإنسان: ثمانية مهنية تظهر في سجلّك العام، وأربعة شخصية لا تُشارَك ولا تُقارَن — تُقاس لك أنت وحدك. المستوى يُحسب من الشواهد (مواقف اليوم، المحاكاة، المهام المؤكَّدة، البرامج، الاعتمادات) ويعتمده الإنسان.' : 'Your real profile projected onto the human-building domains: eight professional ones appear in your public record, four personal ones are never shared or compared.'}</p></div>
        {!loaded && <div className="mp-card mp-empty">…</div>}
        {loaded && !tok && <div className="mp-card mp-empty">{ar ? 'سجّل الدخول لترى خريطتك.' : 'Sign in to see your map.'} <Link href="/login?next=/me/map" className="pt-btn gold small">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>}
        {err && <div className="mp-err">{err}</div>}
        {loaded && tok && map.length > 0 && <>
          <div className="mp-top">
            <div className="mp-card mp-radar"><svg viewBox="0 0 200 200" role="img" aria-label="map">{[1, 2, 3, 4, 5].map(k => <circle key={k} cx="100" cy="100" r={20 + k * 14} fill="none" stroke="#e2e8f0" strokeWidth="1" />)}{map.map((m, i) => { const a = (Math.PI * 2 * i) / map.length - Math.PI / 2; return <g key={m.code}><line x1="100" y1="100" x2={100 + 90 * Math.cos(a)} y2={100 + 90 * Math.sin(a)} stroke="#f1f5f9" /><text x={100 + 99 * Math.cos(a)} y={100 + 99 * Math.sin(a)} fontSize="7.5" fontWeight="900" textAnchor="middle" dominantBaseline="middle" fill={m.personal ? '#9a6b00' : '#0f2a4e'}>{m.h}</text></g>; })}<polygon points={pts} fill="rgba(11,138,131,.25)" stroke="#0b8a83" strokeWidth="2" /></svg><small>{ar ? 'الذهبي = مجالات شخصية خاصة' : 'Gold = private personal domains'}</small></div>
            <div className="mp-idx">
              <div className="mp-card mp-i"><b>{readiness}%</b><span>{ar ? 'جاهزية المستقبل' : 'Future readiness'}</span><small>{t(band.label, lang)}</small></div>
              <div className="mp-card mp-i"><b>{balance}%</b><span>{ar ? 'اتزان الجدارات' : 'Competency balance'}</span><small>{ar ? 'كلما ارتفع قلّت الفجوة بين أقوى مجالاتك وأضعفها' : 'Higher = smaller gap between strongest and weakest'}</small></div>
              <div className="mp-card mp-i"><b>{human}%</b><span>{ar ? 'شواهد مُصدَّقة بشريًا' : 'Human-attested evidence'}</span><small>{ar ? 'نسبة الشواهد التي شهد عليها إنسان (مشرف، مقيّم، جهة)' : 'Share of evidence vouched for by a human'}</small></div>
              <div className="mp-card mp-weak"><h4><Icon name="target" size={14} /> {ar ? 'ابدأ من هنا' : 'Start here'}</h4>{weak.map(w => <div key={w.code}><b>{w.h} {t(w.name, lang)}</b><small>{t(HUMAN_DOMAINS.find(d => d.code === w.code)!.scarce_2062, lang)}</small></div>)}<div className="mp-ctas"><Link href="/#daily" className="pt-btn gold small">{ar ? 'موقف اليوم' : 'Today’s case'}</Link><Link href="/2062" className="pt-btn ghost small">{ar ? 'عِش يومك في 2062' : 'Live 2062'}</Link></div></div>
            </div>
          </div>
          <h3 className="mp-h3">{ar ? 'المجالات المهنية (تظهر في سجلّك العام)' : 'Professional domains (public record)'}</h3>
          <div className="mp-grid">{pro.map(m => <Dom key={m.code} m={m} ar={ar} />)}</div>
          <h3 className="mp-h3 gold">{ar ? 'المجالات الشخصية (لك وحدك — لا تُشارَك ولا تُقارَن)' : 'Personal domains (yours only — never shared or compared)'}</h3>
          <div className="mp-grid">{personal.map(m => <Dom key={m.code} m={m} ar={ar} />)}</div>
          <div className="mp-card mp-fam"><h4>{ar ? 'عائلات جدارات المستقبل F1–F8 وما يغذّيها من مجالاتك' : 'Future competency families F1–F8'}</h4><div className="mp-famgrid">{FAMILIES.map(f => { const lv = f.domains.map(c => map.find(m => m.code === c)?.level || 0); const avg = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0; return <div key={f.code}><b>{f.f}</b><span>{t(f.name, lang)}</span><i><em style={{ width: `${(avg / 5) * 100}%` }} /></i><small>{f.domains.map(c => HUMAN_DOMAINS.find(d => d.code === c)?.h).join(' ')}</small></div>; })}</div></div>
          {cases.length > 0 && <div className="mp-card"><h4><Icon name="calendar" size={14} /> {ar ? 'مواقفي الأخيرة' : 'My recent cases'}</h4><ul className="mp-cases">{cases.map(c => <li key={c.day}><small>{fmtDate(c.day, lang)}</small><b>{c.title_ar || c.day}</b><span className={`b ${(BAND_LABEL as any)[c.band]?.tone || ''}`}>{c.score}% · {ar ? (BAND_LABEL as any)[c.band]?.ar : (BAND_LABEL as any)[c.band]?.en}</span></li>)}</ul></div>}
          <p className="mp-foot"><Link href="/me/skills">{ar ? '← الملف المهاري التفصيلي والشهادات' : '← Detailed skills profile & credentials'}</Link></p>
        </>}
      </div></section>
    </main>
  );
}

function Dom({ m, ar }: { m: DomainScore; ar: boolean }) {
  const d = HUMAN_DOMAINS.find(x => x.code === m.code)!; const lang = ar ? 'ar' : 'en';
  return <div className={`mp-card mp-dom ${m.personal ? 'personal' : ''}`}><div className="mp-domtop"><span className="mp-hh">{d.h}</span><b>{t(d.name, lang)}</b><em>{m.level ? `${m.level}/5` : (ar ? '—' : '—')}</em></div><i className="mp-bar"><em style={{ width: `${(m.level / 5) * 100}%` }} /></i><small>{t(d.question, lang)}</small><small className="mp-meta">{m.skills ? (ar ? `${m.skills} مهارة · ${m.evidence} شاهدًا · ${m.human_attested} مُصدَّق بشريًا` : `${m.skills} skills · ${m.evidence} evidence · ${m.human_attested} human-attested`) : (ar ? 'لا شواهد بعد — ابدأ بموقف اليوم أو محاكاة' : 'No evidence yet — start with a case or a simulation')}</small></div>;
}

const CSS = `
.mp .pt-wrap{max-width:1080px}.mp-head{text-align:center;max-width:800px;margin:0 auto 24px}.mp-head h1{font-size:30px;color:#0f2a4e;margin:6px 0}.mp-head p{color:#64748b;font-size:14.5px;line-height:1.9;margin:0}.mp-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b8a83}
.mp-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.mp-empty{text-align:center;color:#64748b;display:grid;gap:10px;justify-items:center}.mp-err{color:#b91c1c;font-size:13px}
.mp-top{display:grid;grid-template-columns:320px 1fr;gap:12px;align-items:start}.mp-radar{display:grid;justify-items:center;gap:6px}.mp-radar svg{width:100%;max-width:300px}.mp-radar small{color:#64748b;font-size:11.5px}
.mp-idx{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.mp-i{display:grid;gap:2px}.mp-i b{font-size:28px;color:#0f2a4e}.mp-i span{font-weight:800;font-size:13px;color:#0b8a83}.mp-i small{font-size:11.5px;color:#64748b;line-height:1.6}
.mp-weak{grid-column:1/-1;display:grid;gap:6px}.mp-weak h4,.mp-card h4{margin:0 0 4px;font-size:14px;color:#0f2a4e;display:flex;align-items:center;gap:6px}.mp-weak div b{font-size:13.5px;color:#0f2a4e}.mp-weak div small{display:block;color:#64748b;font-size:12px}.mp-ctas{display:flex;gap:6px;margin-top:4px}
.mp-h3{font-size:16px;color:#0f2a4e;margin:22px 0 10px}.mp-h3.gold{color:#9a6b00}
.mp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.mp-dom{display:grid;gap:6px;align-content:start}.mp-dom.personal{border-color:#f1dfae;background:#fffdf5}.mp-domtop{display:flex;align-items:center;gap:6px}.mp-hh{color:#c9a24b;font-weight:900;font-size:12px}.mp-domtop b{font-size:14px;color:#0f2a4e;flex:1}.mp-domtop em{font-style:normal;font-weight:900;color:#0b8a83;font-size:13px}
.mp-bar{display:block;height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden}.mp-bar em{display:block;height:100%;background:#0b8a83;border-radius:999px}.mp-dom.personal .mp-bar em{background:#c9a24b}.mp-dom small{font-size:12px;color:#475569;line-height:1.6}.mp-meta{color:#94a3b8!important;font-size:11px!important}
.mp-fam{margin-top:14px}.mp-famgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.mp-famgrid div{display:grid;gap:3px}.mp-famgrid b{color:#c9a24b;font-size:12px}.mp-famgrid span{font-size:13px;font-weight:800;color:#0f2a4e}.mp-famgrid i{display:block;height:6px;background:#f1f5f9;border-radius:999px;overflow:hidden}.mp-famgrid i em{display:block;height:100%;background:#0f2a4e}.mp-famgrid small{font-size:11px;color:#94a3b8}
.mp-cases{list-style:none;margin:0;padding:0;display:grid;gap:4px}.mp-cases li{display:flex;gap:10px;align-items:center;font-size:13px;border-bottom:1px solid #f1f5f9;padding:5px 0}.mp-cases small{color:#94a3b8;min-width:90px}.mp-cases b{flex:1;color:#0f2a4e}.mp-cases .b{font-size:11.5px;font-weight:900;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#334155}.mp-cases .b.ok{background:#dcfce7;color:#166534}.mp-cases .b.teal{background:#e6f4f1;color:#0b8a83}.mp-cases .b.gold{background:#fdf6e3;color:#9a6b00}.mp-cases .b.warn{background:#fef3c7;color:#92400e}
.mp-foot{margin:16px 0 0;font-size:13.5px}.mp-foot a{color:#0b8a83;font-weight:800}
@media (max-width:900px){.mp-top{grid-template-columns:1fr}.mp-idx,.mp-grid,.mp-famgrid{grid-template-columns:1fr 1fr}}
`;
