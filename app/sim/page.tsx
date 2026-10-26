'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — المحاكيات (P10): قائمة سيناريوهات الأداء، تشغيلاتي السابقة، وكيف تتحول المحاكاة إلى دليل في الملف المهاري
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { AUDIENCE_LABEL, SIM_STATUS_LABEL, bandLabel } from '../../lib/portal/sim';
import type { Scenario, SimRun } from '../../lib/portal/sim';

export default function SimIndexPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [list, setList] = useState<Scenario[]>([]); const [mine, setMine] = useState<SimRun[]>([]); const [user, setUser] = useState(false); const [loaded, setLoaded] = useState(false); const [aud, setAud] = useState<string>('all');
  useEffect(() => {
    (async () => {
      try {
        const { data } = await db.auth.getSession(); const tk = data.session?.access_token || ''; setUser(!!tk);
        const j = await fetch('/api/sim').then(r => r.json()); if (j?.success) setList(j.scenarios || []);
        if (tk) { const m = await fetch('/api/sim?mine=1', { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json()); if (m?.success) setMine(m.runs || []); }
      } catch { /* ignore */ }
      setLoaded(true);
    })();
  }, [db]);
  const shown = list.filter(s => aud === 'all' || s.audience === aud); const titleOf = (id: string) => list.find(s => s.id === id)?.title_ar || (ar ? 'سيناريو' : 'Scenario');
  return (
    <main className="pt-main">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="pt-pagehead sm-head">
        <div className="pt-wrap">
          <span className="pt-kicker"><Icon name="play" size={14} /> {ar ? 'محاكيات الأداء' : 'Performance simulators'}</span>
          <h1>{ar ? 'لا نسألك ماذا تعرف — نضعك في الموقف' : 'We do not ask what you know — we put you in the situation'}</h1>
          <p>{ar ? 'شخصيات واقعية يحرّكها الذكاء الاصطناعي: طالب محبط، صف صامت، مدير يشكّ في جدوى التدريب. تتصرّف، وتُقيَّم بمعيار معلن، ويراجع مدرب بشري الدرجة قبل أن تصبح دليلًا في ملفك المهاري.' : 'Realistic AI‑driven characters: a frustrated learner, a silent classroom, a manager who doubts training. You act, you are scored against a published rubric, and a human trainer reviews the score before it becomes evidence in your skills profile.'}</p>
          <div className="sm-how">{[[ar ? 'ادخل الموقف' : 'Enter the situation', ar ? '3–6 أدوار حوار مع شخصية' : '3–6 dialogue turns'], [ar ? 'احصل على التقييم' : 'Get scored', ar ? 'معيار معلن + مسار الخبير' : 'Published rubric + expert path'], [ar ? 'اعتماد بشري' : 'Human approval', ar ? 'يراجعه مدرب ثم يُودَع دليلًا' : 'Reviewed, then logged as evidence']].map(([a, b], i) => <div key={i}><i>{i + 1}</i><b>{a}</b><small>{b}</small></div>)}</div>
        </div>
      </section>
      <section className="pt-sec">
        <div className="pt-wrap">
          <div className="sm-filters">{['all', 'teacher', 'trainer', 'consultant', 'learner'].map(a => <button key={a} type="button" className={aud === a ? 'on' : ''} onClick={() => setAud(a)}>{a === 'all' ? (ar ? 'الكل' : 'All') : (ar ? AUDIENCE_LABEL[a as Scenario['audience']].ar : AUDIENCE_LABEL[a as Scenario['audience']].en)}</button>)}</div>
          {!loaded && <div className="pt-empty">…</div>}
          <div className="pt-grid three sm-grid">
            {shown.map(s => (
              <Link key={s.id} href={`/sim/${s.slug}`} className="pt-card sm-card">
                <div className="sm-cardtop"><span className={`sm-aud ${s.audience}`}>{ar ? AUDIENCE_LABEL[s.audience].ar : AUDIENCE_LABEL[s.audience].en}</span>{s.demo && <span className="sm-demo">{ar ? 'بلا تسجيل' : 'No sign‑up'}</span>}</div>
                <h3>{(lang === 'en' && s.title_en) || s.title_ar}</h3>
                <p className="sm-sit">{s.situation_ar}</p>
                <div className="sm-persona"><i>{s.persona.name.slice(0, 1)}</i><span><b>{s.persona.name}</b><small>{s.persona.role}</small></span></div>
                <div className="sm-meta"><span><Icon name="clock" size={13} /> {s.minutes} {ar ? 'دقائق' : 'min'}</span><span><Icon name="chat" size={13} /> {s.max_turns} {ar ? 'أدوار' : 'turns'}</span>{s.level && <span><Icon name="target" size={13} /> {s.level}</span>}</div>
                <div className="sm-rub">{s.rubric.map(r => <span key={r.key} title={r.desc_ar}>{r.title_ar} {r.weight}%</span>)}</div>
                <span className="pt-btn small sm-go">{ar ? 'ابدأ المحاكاة' : 'Start'} <Icon name="arrow" size={14} /></span>
              </Link>
            ))}
          </div>
          {loaded && !shown.length && <div className="pt-empty">{ar ? 'لا سيناريوهات في هذا التصنيف بعد.' : 'No scenarios in this category yet.'}</div>}
        </div>
      </section>
      <section className="pt-sec alt">
        <div className="pt-wrap">
          <div className="pt-sechead"><span className="pt-kicker"><Icon name="award" size={14} /> {ar ? 'تشغيلاتي' : 'My runs'}</span><h2>{ar ? 'سجلّ محاكياتك' : 'Your simulation record'}</h2><p>{user ? (ar ? 'كل تشغيلة مُقيَّمة تنتظر اعتماد مدرب لتصبح دليلًا كامل الوزن في ملفك المهاري.' : 'Each scored run awaits trainer approval to become full‑weight evidence in your profile.') : (ar ? 'سجّل الدخول لتُحفظ تشغيلاتك وتتحوّل إلى أدلة في ملفك المهاري.' : 'Sign in to keep your runs and turn them into evidence.')}</p></div>
          {!user && <div className="pt-chips" style={{ justifyContent: 'center' }}><Link href="/me" className="pt-btn gold">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>}
          {user && !mine.length && <div className="pt-box pt-empty">{ar ? 'لا تشغيلات بعد — اختر سيناريو أعلاه.' : 'No runs yet — pick a scenario above.'}</div>}
          {!!mine.length && <div className="sm-runs">{mine.map(r => <Link key={r.id} href={`/sim/${list.find(s => s.id === r.scenario_id)?.slug || 'demo'}?run=${r.id}`} className="sm-run"><div><b>{titleOf(r.scenario_id)}</b><small>{new Date(r.created_at).toLocaleString(ar ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {r.turns?.filter(t => t.role === 'learner').length || 0} {ar ? 'أدوار' : 'turns'}</small></div><div className="sm-runright">{r.score && <b>{r.score.total}<small>/100 · {bandLabel(r.score.total, lang)}</small></b>}<span className={`sm-st ${r.status}`}>{ar ? SIM_STATUS_LABEL[r.status].ar : SIM_STATUS_LABEL[r.status].en}</span></div></Link>)}</div>}
        </div>
      </section>
    </main>
  );
}

const CSS = `
.sm-head .pt-kicker{color:#c9a24b}.sm-how{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:26px;max-width:820px}.sm-how div{display:grid;grid-template-columns:34px 1fr;gap:4px 10px;align-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:12px 14px}.sm-how i{grid-row:span 2;width:34px;height:34px;border-radius:50%;background:#c9a24b;color:#0f2a4e;font-style:normal;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.sm-how b{font-size:14px}.sm-how small{font-size:12px;opacity:.85}
.sm-filters{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:22px}.sm-filters button{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer}.sm-filters button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.sm-card{gap:8px}.sm-cardtop{display:flex;justify-content:space-between;gap:6px}.sm-aud{font-size:11px;font-weight:900;padding:3px 9px;border-radius:999px;background:#eef2f7;color:#334155}.sm-aud.teacher{background:#e6f4f1;color:#0b8a83}.sm-aud.trainer{background:#e8eefc;color:#1d4ed8}.sm-aud.consultant{background:#fdf6e3;color:#9a6b00}.sm-demo{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#0f2a4e;color:#fff}
.sm-card h3{margin:4px 0 0;font-size:18px;color:#0f2a4e;line-height:1.45}.sm-sit{margin:0;font-size:13.5px;line-height:1.75;color:#475569;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.sm-persona{display:flex;gap:10px;align-items:center;margin-top:4px}.sm-persona i{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#0b8a83,#0f2a4e);color:#fff;font-style:normal;font-weight:900;display:inline-flex;align-items:center;justify-content:center;font-size:16px;flex:none}.sm-persona b{display:block;font-size:13.5px;color:#0f2a4e}.sm-persona small{display:block;font-size:11.5px;color:#64748b;line-height:1.4}
.sm-meta{display:flex;gap:12px;font-size:12px;color:#64748b}.sm-meta span{display:inline-flex;gap:4px;align-items:center}.sm-rub{display:flex;gap:4px;flex-wrap:wrap}.sm-rub span{font-size:10.5px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:2px 8px;color:#475569}.sm-go{margin-top:auto;align-self:flex-start}
.sm-runs{display:grid;gap:8px;max-width:820px;margin:0 auto}.sm-run{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 16px;text-decoration:none;color:inherit}.sm-run b{display:block;color:#0f2a4e;font-size:14.5px}.sm-run small{display:block;color:#64748b;font-size:12px}.sm-runright{display:grid;justify-items:end;gap:4px}.sm-runright b{font-size:20px;color:#0b8a83}.sm-runright b small{display:inline;font-size:11px;color:#64748b;margin-inline-start:4px}
.sm-st{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:#eef2f7;color:#475569}.sm-st.scored{background:#fdf6e3;color:#9a6b00}.sm-st.approved{background:#e6f4f1;color:#0b8a83}.sm-st.rejected{background:#fee2e2;color:#b91c1c}
@media (max-width:860px){.sm-how{grid-template-columns:1fr}}
`;
