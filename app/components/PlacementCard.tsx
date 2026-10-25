'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بطاقة نتيجة مِعيار للمتعلم: المستوى، المهارات الثلاث، التوصية، وملاءمة البرنامج الحالي — تُزامن النتيجة من مِعيار عند العرض
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import type { Lang } from '../../lib/portal/content';
import { BRAND } from '../../lib/portal/content';
import { MIAAR_SKILLS, levelLabel, levelTone, effectiveLevel, programFit, FIT_LABEL, miaarSkillLabel } from '../../lib/portal/placement';
import type { Placement } from '../../lib/portal/placement';

export default function PlacementCard({ lang = 'ar', compact = false, programLevel }: { lang?: Lang; compact?: boolean; programLevel?: string | null }) {
  const db = useMemo(() => supabase(), []); const [p, setP] = useState<Placement | null | undefined>(undefined); const [configured, setConfigured] = useState(true);
  useEffect(() => { (async () => { try {
    const { data: s } = await db.auth.getSession(); if (!s.session) { setP(null); return; }
    const j = await fetch('/api/placements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}` }, body: JSON.stringify({ action: 'mine' }) }).then(x => x.json());
    setConfigured(j.configured !== false); setP(((j.placements || [])[0] as Placement) || null);
  } catch { setP(null); } })(); }, [db]);
  if (p === undefined) return null;
  const lvl = effectiveLevel(p); const fit = programFit(programLevel, lvl); const url = (BRAND as any).placementUrl || 'https://miaar-placement-test.vercel.app';
  const dateStr = p ? new Date(p.taken_at).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <div className={`plc ${compact ? 'compact' : ''} ${p ? '' : 'empty'}`}>
      {!p && <div className="plc-empty"><span className="plc-ic"><Icon name="target" size={18} /></span><div><b>{lang === 'ar' ? 'حدّد مستواك في العربية مع مِعيار' : 'Find your Arabic level with Mi‘yar'}</b><small>{lang === 'ar' ? 'اختبار تكيفي وفق CEFR خلال 50 دقيقة — تُحفظ نتيجتك هنا تلقائيًا ببريدك.' : 'A 50-minute CEFR-aligned adaptive test — your result is saved here automatically.'}{!configured && (lang === 'ar' ? ' (الربط مع مِعيار غير مفعّل بعد.)' : ' (Mi‘yar link not configured yet.)')}</small></div><a href={url} target="_blank" rel="noreferrer" className="pt-btn small"><Icon name="arrow" size={14} /> {lang === 'ar' ? 'ابدأ الاختبار' : 'Start the test'}</a></div>}
      {p && <>
        <div className="plc-head"><span className={`plc-level ${levelTone(lvl)}`}>{lvl || '—'}</span><div><b>{lang === 'ar' ? 'مستواك في مِعيار' : 'Your Mi‘yar level'}: {levelLabel(lvl, lang)}</b><small>{lang === 'ar' ? 'المستوى المثبت' : 'Demonstrated'}: {p.demonstrated_level || '—'} · {p.overall_percent ?? '—'}% · <bdi>{dateStr}</bdi></small></div>{programLevel && fit !== 'unknown' && <span className={`plc-fit ${fit}`}>{FIT_LABEL[fit][lang]}</span>}</div>
        <div className="plc-skills">{MIAAR_SKILLS.map(s => { const st = p.skills[s.key]; return <div key={s.key} className="plc-skill"><small>{miaarSkillLabel(s.key, lang)}</small><b>{st ? st.level : '—'}</b><div className="plc-bar"><i style={{ width: `${st ? st.percent : 0}%` }} /></div><em>{st ? `${st.percent}%` : ''}</em></div>; })}</div>
        {!compact && p.recommendation && <p className="plc-rec"><Icon name="compass" size={14} /> {p.recommendation}</p>}
        {!compact && <div className="plc-foot"><small>{lang === 'ar' ? 'سُجّلت النتيجة كدليل مهارة في ملفك.' : 'Saved as skill evidence in your profile.'}</small><a href={url} target="_blank" rel="noreferrer" className="pt-btn ghost small">{lang === 'ar' ? 'إعادة الاختبار (بموافقة)' : 'Retake (with approval)'}</a></div>}
      </>}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}
const CSS = `
.plc{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;display:grid;gap:12px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}.plc.compact{padding:12px 14px;gap:8px}.plc.empty{background:linear-gradient(135deg,#eef4fb,#e6f4f3)}
.plc-empty{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.plc-empty b{display:block;font-size:14.5px;color:#0f2a4e}.plc-empty small{color:#475569;font-size:12.5px;line-height:1.7}.plc-ic{width:40px;height:40px;border-radius:12px;background:#0f2a4e;color:#c9a24b;display:inline-grid;place-items:center}
.plc-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.plc-head b{display:block;font-size:15px;color:#0f172a}.plc-head small{color:#64748b;font-size:12.5px}
.plc-level{width:54px;height:54px;border-radius:14px;display:inline-grid;place-items:center;font-size:20px;font-weight:900;color:#fff;background:#64748b;direction:ltr}.plc-level.a{background:#0b8a83}.plc-level.b{background:#0f2a4e}.plc-level.c{background:#c9a24b;color:#1f2937}
.plc-fit{margin-inline-start:auto;font-size:12px;font-weight:900;border-radius:999px;padding:4px 10px;background:#f1f5f9;color:#334155}.plc-fit.match{background:#ecfdf5;color:#065f46}.plc-fit.stretch{background:#fff7ed;color:#9a3412}.plc-fit.below{background:#f1f5f9;color:#475569}
.plc-skills{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.plc-skill{display:grid;gap:3px;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#f8fafc}.plc-skill small{color:#64748b;font-size:11.5px}.plc-skill b{font-size:15px;color:#0f2a4e;direction:ltr;text-align:start}.plc-bar{height:5px;border-radius:999px;background:#e2e8f0;overflow:hidden}.plc-bar i{display:block;height:100%;background:#0b8a83}.plc-skill em{font-style:normal;font-size:11px;color:#64748b}
.plc-rec{margin:0;font-size:13px;line-height:1.8;color:#334155;background:#fdf6e3;border:1px solid #f3e3b3;border-radius:10px;padding:8px 12px;display:flex;gap:6px}.plc-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.plc-foot small{color:#64748b;font-size:12px}
.pt-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;cursor:pointer}.pt-btn.small{padding:6px 12px;font-size:12.5px}.pt-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}
@media(max-width:640px){.plc-skills{grid-template-columns:1fr}.plc-empty{grid-template-columns:1fr}}
`;
