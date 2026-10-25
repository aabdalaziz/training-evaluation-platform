'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — مستودع الحقائب: بحث وفلاتر (النوع، القطاع، المستوى، اللغة، المهارة) وبطاقات بمستوى الوصول

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { UI, t } from '../../lib/portal/content';
import { RES_TYPES, RES_LEVELS, RES_LANGS, EMPTY_FILTERS, filterResources, sortResources, typeLabel, typeIcon, levelLabel, accessLabel, resTitle, resSummary } from '../../lib/portal/resources';
import type { Resource, ResFilters } from '../../lib/portal/resources';
import { SECTORS_FALLBACK, skillName, domainLabel } from '../../lib/portal/skills';
import type { Skill, Sector } from '../../lib/portal/skills';

export default function ResourcesPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const sp = useSearchParams(); const db = useMemo(() => supabase(), []);
  const [rows, setRows] = useState<Resource[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [sectors, setSectors] = useState<Sector[]>(SECTORS_FALLBACK);
  const [loaded, setLoaded] = useState(false);
  const [f, setF] = useState<ResFilters>({ ...EMPTY_FILTERS, type: sp.get('type') || '', sector: sp.get('sector') || '', skill: sp.get('skill') || '', program: sp.get('program') || '', q: sp.get('q') || '' });

  useEffect(() => {
    (async () => {
      try {
        const [{ data: r }, { data: s }, { data: sec }] = await Promise.all([
          db.from('portal_resources').select('*').eq('status', 'published').order('published_at', { ascending: false }),
          db.from('portal_skills').select('*').eq('active', true).order('code'),
          db.from('portal_sectors').select('*').eq('active', true).order('sort'),
        ]);
        setRows((r || []) as Resource[]); setSkills((s || []) as Skill[]); if (sec && (sec as any[]).length) setSectors(sec as Sector[]);
      } catch { /* يبقى فارغًا */ }
      setLoaded(true);
    })();
  }, [db]);

  const list = useMemo(() => sortResources(filterResources(rows, f, skills)), [rows, f, skills]);
  const byId = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);
  const usedSectors = useMemo(() => sectors.filter(s => rows.some(r => r.sector === s.code)), [sectors, rows]);
  const usedSkills = useMemo(() => skills.filter(s => rows.some(r => (r.skills || []).includes(s.id))), [skills, rows]);
  const counts = useMemo(() => RES_TYPES.map(tp => ({ ...tp, n: rows.filter(r => r.type === tp.value).length })).filter(x => x.n > 0), [rows]);
  const active = Object.entries(f).filter(([, v]) => v).length;
  const set = (k: keyof ResFilters, v: string) => setF(x => ({ ...x, [k]: v }));

  return (
    <main className="pt-main rs">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/services">{t(UI.services, lang)}</Link> / <span>{lang === 'ar' ? 'مستودع الحقائب' : 'Resources'}</span></div>
        <h1>{lang === 'ar' ? 'مستودع الحقائب التدريبية' : 'Training Resources Repository'}</h1>
        <p>{lang === 'ar' ? 'حقائب وأدلة وأدوات تقويم ونماذج جاهزة — مصنّفة بالمهارة والقطاع والمستوى، بمستويات وصول واضحة وروابط تحميل آمنة.' : 'Kits, guides, assessment tools and templates — tagged by skill, sector and level, with clear access tiers and secure downloads.'}</p>
        <div className="rs-kpis">
          <span><b>{rows.length}</b> {lang === 'ar' ? 'مادة منشورة' : 'published items'}</span>
          <span><b>{rows.filter(r => r.access === 'public').length}</b> {lang === 'ar' ? 'متاحة للجميع' : 'open to all'}</span>
          <span><b>{usedSkills.length}</b> {lang === 'ar' ? 'مهارة مغطاة' : 'skills covered'}</span>
          <span><b>{rows.filter(r => r.ai_ready).length}</b> {lang === 'ar' ? 'مهيأة للذكاء الاصطناعي' : 'AI-ready'}</span>
        </div>
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        <div className="rs-types">
          <button type="button" className={!f.type ? 'on' : ''} onClick={() => set('type', '')}><Icon name="folder" size={15} /> {lang === 'ar' ? 'الكل' : 'All'} <small>{rows.length}</small></button>
          {counts.map(tp => <button key={tp.value} type="button" className={f.type === tp.value ? 'on' : ''} onClick={() => set('type', f.type === tp.value ? '' : tp.value)}><Icon name={tp.icon as IconName} size={15} /> {t(tp.label, lang)} <small>{tp.n}</small></button>)}
        </div>
        <div className="rs-filters">
          <label className="rs-search"><Icon name="search" size={16} /><input value={f.q} onChange={e => set('q', e.target.value)} placeholder={lang === 'ar' ? 'ابحث بالعنوان أو المهارة أو الوسم…' : 'Search title, skill or tag…'} /></label>
          <select value={f.sector} onChange={e => set('sector', e.target.value)}><option value="">{lang === 'ar' ? 'كل القطاعات' : 'All sectors'}</option>{usedSectors.map(s => <option key={s.code} value={s.code}>{lang === 'en' ? s.name_en : s.name_ar}</option>)}</select>
          <select value={f.skill} onChange={e => set('skill', e.target.value)}><option value="">{lang === 'ar' ? 'كل المهارات' : 'All skills'}</option>{usedSkills.map(s => <option key={s.id} value={s.id}>{s.code} · {skillName(s, lang)}</option>)}</select>
          <select value={f.level} onChange={e => set('level', e.target.value)}><option value="">{lang === 'ar' ? 'كل المستويات' : 'All levels'}</option>{RES_LEVELS.map(l => <option key={l.value} value={l.value}>{t(l.label, lang)}</option>)}</select>
          <select value={f.lang} onChange={e => set('lang', e.target.value)}><option value="">{lang === 'ar' ? 'كل اللغات' : 'All languages'}</option>{RES_LANGS.filter(l => l.value !== 'both').map(l => <option key={l.value} value={l.value}>{t(l.label, lang)}</option>)}</select>
          {active > 0 && <button type="button" className="pt-btn ghost small" onClick={() => setF(EMPTY_FILTERS)}><Icon name="x" size={14} /> {lang === 'ar' ? 'مسح الفلاتر' : 'Clear'}</button>}
        </div>

        {!loaded && <div className="pt-empty">…</div>}
        {loaded && list.length === 0 && <div className="pt-empty"><Icon name="folder" size={28} /><p>{rows.length === 0 ? (lang === 'ar' ? 'لم تُنشر حقائب بعد — عد قريبًا.' : 'No resources published yet — check back soon.') : (lang === 'ar' ? 'لا نتائج مطابقة للفلاتر الحالية.' : 'No items match the current filters.')}</p></div>}
        <div className="rs-grid">
          {list.map(r => {
            const sk = (r.skills || []).map(id => byId.get(id)).filter(Boolean) as Skill[];
            return (
              <Link key={r.id} href={`/resources/${r.id}`} className={`rs-card ${r.access}`}>
                <div className="rs-cover">{r.cover_url ? <img src={r.cover_url} alt="" /> : <span className={`pt-ic ${r.type === 'package' ? 'navy' : r.type === 'assessment' ? 'gold' : 'teal'}`}><Icon name={typeIcon(r.type) as IconName} size={22} /></span>}
                  <span className={`rs-access ${r.access}`}><Icon name={r.access === 'public' ? 'globe' : 'shield'} size={12} /> {accessLabel(r.access, lang)}</span>
                  {r.ai_ready && <span className="rs-ai">AI</span>}
                </div>
                <div className="rs-body">
                  <small className="rs-kind">{typeLabel(r.type, lang)} · {levelLabel(r.level, lang)}{r.sector ? ` · ${lang === 'en' ? (sectors.find(s => s.code === r.sector)?.name_en || '') : (sectors.find(s => s.code === r.sector)?.name_ar || '')}` : ''}</small>
                  <h3>{resTitle(r, lang)}</h3>
                  {resSummary(r, lang) && <p>{resSummary(r, lang)}</p>}
                  {sk.length > 0 && <div className="pt-chips">{sk.slice(0, 3).map(s => <span key={s.id} className="pt-chip" title={domainLabel(s.domain, lang)}>{skillName(s, lang)}</span>)}{sk.length > 3 && <span className="pt-chip">+{sk.length - 3}</span>}</div>}
                  <div className="rs-foot"><span><Icon name="download" size={13} /> <bdi>{r.downloads || 0}</bdi></span><span>v<bdi>{r.version}</bdi></span><span className="rs-more">{lang === 'ar' ? 'التفاصيل' : 'Details'} <Icon name="arrow" size={13} /></span></div>
                </div>
              </Link>
            );
          })}
        </div>
      </div></section>

      <section className="pt-sec soft"><div className="pt-wrap rs-cta">
        <div><h2>{lang === 'ar' ? 'تحتاج حقيبة مصممة لجهتك؟' : 'Need a kit designed for your organization?'}</h2><p>{lang === 'ar' ? 'نصمم حقائب تدريبية مخصصة بمستويات وصول خاصة لمنسوبي جهتك، مربوطة بمهارات قابلة للقياس.' : 'We design custom kits with private access for your staff, mapped to measurable skills.'}</p></div>
        <Link href="/consulting?area=educational" className="pt-btn gold"><Icon name="compass" size={16} /> {lang === 'ar' ? 'اطلب تصميم حقيبة' : 'Request a custom kit'}</Link>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.rs-kpis{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;font-size:13.5px;color:rgba(255,255,255,.85)}.rs-kpis b{font-size:20px;color:#fff;margin-inline-end:4px}
.rs-types{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.rs-types button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-weight:800;font-size:13px;color:#334155;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.rs-types button small{background:#f1f5f9;border-radius:999px;padding:1px 7px;font-size:11px}.rs-types button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.rs-types button.on small{background:rgba(255,255,255,.2)}
.rs-filters{display:grid;grid-template-columns:2fr 1fr 1.4fr 1fr 1fr auto;gap:10px;margin-bottom:22px;align-items:center}.rs-filters select,.rs-search{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;background:#fff;color:#0f172a}.rs-search{display:flex;align-items:center;gap:8px;color:#64748b}.rs-search input{border:0;outline:0;font:inherit;flex:1;min-width:0;background:transparent;color:#0f172a}
.rs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.rs-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;text-decoration:none;color:inherit;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s}.rs-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(15,42,78,.1)}
.rs-cover{position:relative;height:120px;background:linear-gradient(135deg,#eef4fb,#e6f4f3);display:flex;align-items:center;justify-content:center}.rs-cover img{width:100%;height:100%;object-fit:cover}
.rs-access{position:absolute;top:10px;inset-inline-start:10px;font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;background:#ecfdf5;color:#065f46;display:inline-flex;gap:4px;align-items:center}.rs-access.registered{background:#eff6ff;color:#1e40af}.rs-access.program{background:#fff7ed;color:#9a3412}.rs-access.org{background:#f5f3ff;color:#5b21b6}.rs-access.staff{background:#f1f5f9;color:#334155}
.rs-ai{position:absolute;top:10px;inset-inline-end:10px;font-size:10px;font-weight:900;letter-spacing:.5px;border-radius:6px;padding:3px 7px;background:#0f2a4e;color:#c9a24b}
.rs-body{padding:16px 18px 14px;display:flex;flex-direction:column;gap:8px;flex:1}.rs-kind{color:#0b8a83;font-weight:800;font-size:12px}.rs-body h3{margin:0;font-size:16.5px;line-height:1.5;color:#0f172a}.rs-body p{margin:0;color:#475569;font-size:13.5px;line-height:1.8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rs-foot{margin-top:auto;padding-top:10px;border-top:1px dashed #e2e8f0;display:flex;gap:14px;align-items:center;font-size:12.5px;color:#64748b}.rs-foot span{display:inline-flex;align-items:center;gap:4px}.rs-more{margin-inline-start:auto;color:#0f2a4e;font-weight:800}
.rs-cta{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}.rs-cta h2{margin:0 0 6px;font-size:22px;color:#0f2a4e}.rs-cta p{margin:0;color:#475569;line-height:1.8;max-width:620px}
@media(max-width:1000px){.rs-grid{grid-template-columns:repeat(2,1fr)}.rs-filters{grid-template-columns:1fr 1fr}.rs-search{grid-column:1/-1}}
@media(max-width:640px){.rs-grid{grid-template-columns:1fr}.rs-filters{grid-template-columns:1fr}}
`;
