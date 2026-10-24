'use client';

// أَثَر — كتالوج البرامج العام
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { UI, t, programName, fmtDate, deliveryLabel } from '../../lib/portal/content';
import { TYPES, typeLabel, feeLabel, regState, REG_LABEL, seatsLeft, catalogPrograms, filterPrograms, durationLabel, pick } from '../../lib/portal/catalog';
import type { CatalogProgram, Counts } from '../../lib/portal/catalog';

export default function ProgramsPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

const SELECT = 'id,name_ar,name_en,status,delivery_mode,start_date,end_date,archived_at,intro_ar,intro_en,audience_ar,audience_en,fee,currency,seats,program_type,is_public,registration_open,registration_deadline,location_ar,location_en,hours';

function Inner() {
  const { lang } = useLang(); const sp = useSearchParams(); const router = useRouter();
  const [rows, setRows] = useState<CatalogProgram[]>([]); const [counts, setCounts] = useState<Counts[]>([]); const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState(sp.get('q') || '');
  const type = sp.get('type') || '', mode = sp.get('mode') || '', state = sp.get('state') || '', ended = sp.get('ended') === '1';
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        const db = supabase();
        const [{ data }, { data: c }] = await Promise.all([db.from('programs').select(SELECT).order('start_date', { ascending: true }).limit(200), db.rpc('portal_enrollment_counts')]);
        setRows((data || []) as CatalogProgram[]); setCounts(((c || []) as Counts[]));
      } catch { /* يبقى فارغًا */ }
      setLoaded(true);
    })();
  }, []);

  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp.toString()); if (v) n.set(k, v); else n.delete(k); router.replace(`/programs${n.toString() ? `?${n}` : ''}`); };
  const list = useMemo(() => filterPrograms(catalogPrograms(rows, today, ended), { q, type, mode, state }, today, counts), [rows, counts, q, type, mode, state, ended, today]);

  return (
    <main className="pt-main">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <span>{lang === 'ar' ? 'البرامج' : 'Programs'}</span></div>
        <h1>{lang === 'ar' ? 'كتالوج البرامج' : 'Program catalogue'}</h1>
        <p>{lang === 'ar' ? 'برامج تدريبية ودبلومات وورش وبرامج تعليم العربية — حضوريًا وعن بُعد. سجّل مباشرة وستصلك نتيجة المراجعة بالبريد.' : 'Training programs, diplomas, workshops and Arabic courses — on-site and online. Apply directly and receive the review decision by email.'}</p>
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        <div className="pt-filters">
          <label className="pt-search"><Icon name="search" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={lang === 'ar' ? 'ابحث باسم البرنامج…' : 'Search programs…'} /></label>
          <select value={type} onChange={e => setParam('type', e.target.value)}><option value="">{lang === 'ar' ? 'كل الأنواع' : 'All types'}</option>{TYPES.map(x => <option key={x.value} value={x.value}>{t(x.label, lang)}</option>)}</select>
          <select value={mode} onChange={e => setParam('mode', e.target.value)}><option value="">{lang === 'ar' ? 'حضوري وعن بُعد' : 'On-site & online'}</option><option value="onsite">{t(UI.onsite, lang)}</option><option value="remote">{t(UI.remote, lang)}</option></select>
          <select value={state} onChange={e => setParam('state', e.target.value)}><option value="">{lang === 'ar' ? 'كل الحالات' : 'All states'}</option><option value="open">{lang === 'ar' ? 'التسجيل متاح' : 'Open for registration'}</option><option value="full">{t(REG_LABEL.full, lang)}</option><option value="closed">{t(REG_LABEL.closed, lang)}</option></select>
          <label className="pt-check"><input type="checkbox" checked={ended} onChange={e => setParam('ended', e.target.checked ? '1' : '')} /> {lang === 'ar' ? 'إظهار المنتهية' : 'Show ended'}</label>
        </div>

        <div className="pt-programs">
          {loaded && list.length === 0 && <div className="pt-empty">{t(UI.noPrograms, lang)}</div>}
          {list.map(p => {
            const c = counts.find(x => x.program_id === p.id); const s = regState(p, today, c); const left = seatsLeft(p, c); const intro = pick(p, 'intro', lang) || pick(p, 'audience', lang);
            return (
              <article key={p.id} className="pt-prog">
                <div className="pt-meta"><span className="pt-tag navy">{typeLabel(p.program_type, lang)}</span>{p.delivery_mode && <span className="pt-chip">{deliveryLabel(p.delivery_mode, lang)}</span>}<span className={`pt-tag ${s === 'open' ? '' : s === 'waitlist' ? 'soon' : 'off'}`}>{t(REG_LABEL[s], lang)}</span></div>
                <h3><Link href={`/programs/${p.id}`} style={{ textDecoration: 'none' }}>{programName(p, lang)}</Link></h3>
                <p>{intro}</p>
                <div className="pt-dates">
                  <span><Icon name="calendar" size={13} /> <bdi>{fmtDate(p.start_date, lang)}</bdi>{p.end_date && <> → <bdi>{fmtDate(p.end_date, lang)}</bdi></>}</span>
                  {durationLabel(p, lang) && <span><Icon name="clock" size={13} /> {durationLabel(p, lang)}</span>}
                  {left !== null && <span><Icon name="users" size={13} /> {lang === 'ar' ? `${left} مقعدًا متاحًا` : `${left} seats left`}</span>}
                </div>
                <div className="pt-cardfoot"><b className="pt-fee">{feeLabel(p.fee, p.currency, lang)}</b><Link href={`/programs/${p.id}`} className="pt-btn small">{t(UI.register, lang)} <Icon name="arrow" size={13} /></Link></div>
              </article>
            );
          })}
        </div>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.pt-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:22px}
.pt-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:0 12px;flex:1;min-width:220px;color:#64748b}.pt-search input{border:0;outline:0;font:inherit;font-size:14px;padding:11px 0;flex:1;background:transparent;color:#0f172a}
.pt-filters select{font:inherit;font-size:13.5px;font-weight:800;color:#334155;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;background:#fff}
.pt-check{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#334155}
.pt-tag.off{background:#f1f5f9;color:#475569}.pt-fee{color:#0f2a4e;font-size:15px}
`;
