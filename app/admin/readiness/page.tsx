'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { STAGES, assessProgram, sortByUrgency, nextAction, phaseLabel, levelLabel, daysUntil, readinessRows } from '../../../lib/readiness/model';
import type { Readiness, ReadinessInput, ProgramRow, Check } from '../../../lib/readiness/model';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const SITE = process.env.NEXT_PUBLIC_SITE_URL || '';

export default function ReadinessPage() {
  return <Suspense fallback={<div className="rd" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const sp = useSearchParams();
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [list, setList] = useState<Readiness[]>([]); const [selected, setSelected] = useState<string>(sp.get('program') || '');
  const [copied, setCopied] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/readiness'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
      const [p, c, s, l, t, q, e, a, ce, im, fu, k] = await Promise.all([
        db.from('programs').select('id,name_ar,status,start_date,end_date,delivery_mode').order('start_date', { ascending: false }),
        db.from('classrooms').select('id,program_id,trainer_id,code'),
        db.from('class_schedules').select('classroom_id,is_active'),
        db.from('program_evaluation_templates').select('program_id,template_id,is_active'),
        db.from('evaluation_templates').select('id,kind'),
        db.from('questions').select('template_id').limit(5000),
        db.from('evaluations').select('program_id,kind').limit(20000),
        db.from('attendance_sessions').select('program_id').limit(5000),
        db.from('certificates').select('program_id').limit(20000),
        db.from('impact_assessments').select('program_id'),
        db.from('behavior_followups').select('program_id'),
        db.from('outcome_kpis').select('program_id'),
      ]);
      const firstErr = [p, c, l, t, q].find(r => r.error)?.error; if (firstErr) setError(firstErr.message);
      const programs = (p.data || []) as ProgramRow[];
      const base: Omit<ReadinessInput, 'program'> = {
        classrooms: (c.data || []) as any[], schedules: (s.data || []) as any[], links: (l.data || []) as any[], templates: (t.data || []) as any[], questions: (q.data || []) as any[],
        evaluations: (e.data || []) as any[], attendance: (a.data || []) as any[], certificates: (ce.data || []) as any[], impact: (im.data || []) as any[], followups: (fu.data || []) as any[], kpis: (k.data || []) as any[], today,
      };
      const all = sortByUrgency(programs.map(pr => assessProgram({ ...base, program: pr })), today);
      setList(all);
      setSelected(sel => sel && all.some(r => r.program.id === sel) ? sel : (all[0]?.program.id || ''));
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = list.find(r => r.program.id === selected) || null;
  const summary = useMemo(() => ({ ready: list.filter(r => r.level === 'ready').length, almost: list.filter(r => r.level === 'almost').length, not: list.filter(r => r.level === 'not').length, soon: list.filter(r => r.phase === 'before' && (daysUntil(r.program.start_date, today) ?? 999) <= 14 && r.level !== 'ready').length }), [list, today]);

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { window.prompt('انسخ الرابط:', text); }
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : SITE;

  if (!ready) return <div className="rd" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const act = cur ? nextAction(cur) : null;
  const dStart = cur ? daysUntil(cur.program.start_date, today) : null;

  return (
    <div className="rd" dir="rtl">
      <style>{CSS}</style>
      <header className="rd-head">
        <div>
          <div className="rd-kicker"><Icon name="compass" size={14} /> الاستدامة · جاهزية البرنامج</div>
          <h1>قائمة التحقق من الإعداد حتى الإغلاق</h1>
          <p>فحص آلي لكل برنامج: هل القاعات والمدربون والقوالب والحضور والشهادات في مكانها؟ كل بند يحمل رابط إصلاح مباشر ورابط شرح في الدليل — حتى لا تُكتشف الثغرات في أول جلسة.</p>
        </div>
        <nav className="rd-nav">
          <Link href="/dashboard" className="rd-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/help" className="rd-btn"><Icon name="question" size={16} /> دليل الاستخدام</Link>
          <button className="rd-btn" onClick={() => downloadCSV(safeFilename('program_readiness'), readinessRows(list))}><Icon name="download" size={16} /> CSV</button>
        </nav>
      </header>
      {error && <div className="rd-alert">{error}</div>}

      <section className="rd-kpis">
        <div className="rd-kpi ok"><b>{summary.ready}</b><span>برامج جاهزة</span></div>
        <div className="rd-kpi warn"><b>{summary.almost}</b><span>شبه جاهزة</span></div>
        <div className="rd-kpi bad"><b>{summary.not}</b><span>غير جاهزة</span></div>
        <div className={`rd-kpi ${summary.soon ? 'bad' : ''}`}><b>{summary.soon}</b><span>تنطلق خلال 14 يومًا وغير جاهزة</span></div>
      </section>

      <div className="rd-split">
        <aside className="rd-card rd-side">
          <div className="rd-card-head"><h2><Icon name="book" size={16} /> البرامج</h2><span>مرتبة حسب الأولوية</span></div>
          <div className="rd-plist">
            {list.map(r => {
              const d = daysUntil(r.program.start_date, today);
              return (
                <button key={r.program.id} className={`rd-pitem ${selected === r.program.id ? 'on' : ''}`} onClick={() => setSelected(r.program.id)}>
                  <span className={`rd-ring ${r.level}`} style={{ ['--p' as any]: r.score }}><i>{r.score}%</i></span>
                  <span className="rd-pinfo"><b>{r.program.name_ar}</b><small>{phaseLabel(r.phase)}{r.phase === 'before' && d !== null ? ` · ${d <= 0 ? 'اليوم' : `بعد ${d} يومًا`}` : ''}{r.blockers ? ` · ${r.blockers} عائق` : ''}</small></span>
                </button>
              );
            })}
            {!list.length && <div className="rd-empty"><b>لا توجد برامج</b></div>}
          </div>
        </aside>

        <section className="rd-card rd-main">
          {!cur ? <div className="rd-empty"><b>اختر برنامجًا</b></div> : (
            <>
              <div className="rd-prog">
                <span className={`rd-ring big ${cur.level}`} style={{ ['--p' as any]: cur.score }}><i>{cur.score}%</i></span>
                <div className="rd-prog-info">
                  <div className="rd-tags"><span className={`rd-lvl ${cur.level}`}>{levelLabel(cur.level)}</span><span className="rd-tag">{phaseLabel(cur.phase)}</span>{cur.program.delivery_mode && <span className="rd-tag">{cur.program.delivery_mode}</span>}{cur.phase === 'before' && dStart !== null && <span className={`rd-tag ${dStart <= 14 ? 'hot' : ''}`}>{dStart <= 0 ? 'ينطلق اليوم' : `ينطلق بعد ${dStart} يومًا`}</span>}</div>
                  <h2>{cur.program.name_ar}</h2>
                  <small><bdi>{cur.program.start_date || '—'}</bdi> ← <bdi>{cur.program.end_date || '—'}</bdi> · {cur.ok} من {cur.applicable} بندًا مكتمل · {cur.blockers} عائق</small>
                </div>
                <div className="rd-links">
                  <button className="rd-btn small" onClick={() => copy(`${origin}/evaluate/daily?program=${cur.program.id}`, 'd')}><Icon name="link" size={13} /> {copied === 'd' ? 'نُسخ ✓' : 'رابط التقييم اليومي'}</button>
                  <button className="rd-btn small" onClick={() => copy(`${origin}/evaluate/final?program=${cur.program.id}`, 'f')}><Icon name="link" size={13} /> {copied === 'f' ? 'نُسخ ✓' : 'رابط التقييم الختامي'}</button>
                  <Link href={`/reports/program?program=${cur.program.id}`} className="rd-btn small"><Icon name="doc" size={13} /> بطاقة البرنامج</Link>
                </div>
              </div>

              {act && (
                <div className={`rd-next ${act.status}`}>
                  <Icon name={act.status === 'missing' ? 'alert' : 'compass'} size={18} />
                  <div><b>الخطوة التالية: {act.label}</b><span>{act.fix || act.detail}</span></div>
                  <Link href={act.href} className="rd-btn primary small">إصلاح الآن <Icon name="arrow" size={13} /></Link>
                </div>
              )}
              {!act && <div className="rd-next ok"><Icon name="check" size={18} /><div><b>كل البنود المطبّقة مكتملة</b><span>البرنامج جاهز لمرحلته الحالية ({phaseLabel(cur.phase)}).</span></div></div>}

              <div className="rd-stages">
                {STAGES.map((s, si) => {
                  const items = cur.checks.filter(c => c.stage === s.id);
                  const okN = items.filter(c => c.status === 'ok').length; const app = items.filter(c => c.status !== 'na').length;
                  return (
                    <div key={s.id} className="rd-stage">
                      <div className="rd-stage-h"><span className="rd-stage-n">{si + 1}</span><div><b>{s.label}</b><small>{s.hint} · {okN}/{app}</small></div></div>
                      <ul>
                        {items.map(c => <CheckRow key={c.id} c={c} />)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="rd-card rd-how">
        <b>كيف تُحسب الجاهزية؟</b> البنود المطبّقة على مرحلة البرنامج فقط (بنود الإغلاق لا تُحسب لبرنامج لم يبدأ). ✓ = نقطة كاملة، ! = نصف نقطة، ✗ = عائق. «جاهز» = بلا عوائق و≥85%. يعاد الحساب عند كل فتح للصفحة من البيانات الحية.
      </section>
    </div>
  );
}

function CheckRow({ c }: { c: Check }) {
  const icon = c.status === 'ok' ? 'check' : c.status === 'missing' ? 'x' : c.status === 'warn' ? 'alert' : 'clock';
  return (
    <li className={`rd-check ${c.status}`}>
      <span className="rd-ic"><Icon name={icon} size={13} /></span>
      <div className="rd-cbody"><b>{c.label}</b><span>{c.detail}</span>{c.fix && c.status !== 'ok' && <em>{c.fix}</em>}</div>
      <div className="rd-cact">{c.status !== 'ok' && c.status !== 'na' && <Link href={c.href} className="rd-link">إصلاح</Link>}<Link href={c.help} className="rd-link muted" title="شرح في الدليل">؟</Link></div>
    </li>
  );
}

const CSS = `
.rd{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.rd *{box-sizing:border-box}
.rd-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.rd-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.rd-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.rd-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.rd-nav{display:flex;gap:8px;flex-wrap:wrap}
.rd-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none;white-space:nowrap}.rd-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}.rd-btn.small{padding:6px 10px;font-size:12px}
.rd-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}
.rd-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.rd-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}.rd-kpi b{display:block;font-size:22px;color:${NAVY}}.rd-kpi span{font-size:12px;font-weight:800;color:#64748b}.rd-kpi.ok b{color:#047857}.rd-kpi.warn b{color:#b45309}.rd-kpi.bad b{color:#b91c1c}
.rd-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin-bottom:14px}
.rd-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}.rd-card-head h2{margin:0;font-size:16px;color:${NAVY};display:flex;align-items:center;gap:8px}.rd-card-head span{font-size:12px;color:#64748b;font-weight:700}
.rd-split{display:grid;grid-template-columns:320px 1fr;gap:14px;align-items:start}
.rd-plist{display:flex;flex-direction:column;gap:6px}
.rd-pitem{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fff;font:inherit;text-align:right;cursor:pointer;color:#0f172a}.rd-pitem.on{border-color:${TEAL};background:#f0fdfa;box-shadow:inset 3px 0 0 ${TEAL}}
.rd-pinfo{display:flex;flex-direction:column;min-width:0}.rd-pinfo b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rd-pinfo small{color:#64748b;font-size:11.5px}
.rd-ring{--p:0;--c:#b91c1c;flex:0 0 44px;width:44px;height:44px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p)*1%),#e2e8f0 0);display:inline-flex;align-items:center;justify-content:center}.rd-ring i{font-style:normal;background:#fff;border-radius:50%;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:900;color:${NAVY}}
.rd-ring.ready{--c:#047857}.rd-ring.almost{--c:#d97706}.rd-ring.not{--c:#b91c1c}
.rd-ring.big{flex-basis:84px;width:84px;height:84px}.rd-ring.big i{width:66px;height:66px;font-size:17px}
.rd-prog{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.rd-prog-info{flex:1;min-width:220px}.rd-prog-info h2{margin:4px 0;font-size:19px;color:${NAVY}}.rd-prog-info small{color:#64748b;font-size:12px}
.rd-tags{display:flex;gap:6px;flex-wrap:wrap}.rd-tag{font-size:11px;font-weight:800;background:#f1f5f9;color:#475569;border-radius:999px;padding:3px 9px}.rd-tag.hot{background:#fef2f2;color:#b91c1c}
.rd-lvl{font-size:11px;font-weight:900;border-radius:999px;padding:3px 10px;color:#fff;background:#b91c1c}.rd-lvl.ready{background:#047857}.rd-lvl.almost{background:#d97706}
.rd-links{display:flex;gap:6px;flex-wrap:wrap}
.rd-next{display:flex;gap:12px;align-items:center;border-radius:12px;padding:12px 14px;margin-bottom:14px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412}.rd-next.missing{border-color:#fecaca;background:#fef2f2;color:#991b1b}.rd-next.ok{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.rd-next div{flex:1}.rd-next b{display:block;font-size:14px}.rd-next span{font-size:12.5px}
.rd-stages{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.rd-stage{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#f8fafc}.rd-stage ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.rd-stage-h{display:flex;gap:8px;align-items:center;margin-bottom:10px}.rd-stage-n{width:26px;height:26px;border-radius:8px;background:${NAVY};color:#fff;font-weight:900;font-size:12px;display:inline-flex;align-items:center;justify-content:center}.rd-stage-h b{display:block;font-size:14px;color:${NAVY}}.rd-stage-h small{color:#64748b;font-size:11.5px}
.rd-check{display:flex;gap:8px;align-items:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px}.rd-check.na{opacity:.6}
.rd-ic{flex:0 0 22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:#e2e8f0;color:#475569}.rd-check.ok .rd-ic{background:#d1fae5;color:#047857}.rd-check.warn .rd-ic{background:#fef3c7;color:#b45309}.rd-check.missing .rd-ic{background:#fee2e2;color:#b91c1c}
.rd-cbody{flex:1;min-width:0}.rd-cbody b{display:block;font-size:12.5px}.rd-cbody span{display:block;font-size:11.5px;color:#64748b;line-height:1.5}.rd-cbody em{display:block;font-style:normal;font-size:11.5px;color:#9a3412;margin-top:2px}
.rd-cact{display:flex;gap:4px;align-items:center}.rd-link{font-size:11.5px;font-weight:900;color:${TEAL};text-decoration:none;border:1px solid #99f6e4;border-radius:7px;padding:3px 8px;background:#f0fdfa}.rd-link.muted{color:#64748b;border-color:#e2e8f0;background:#fff;padding:3px 7px}
.rd-empty{text-align:center;padding:26px 14px;color:#64748b}
.rd-how{font-size:12.5px;color:#475569;line-height:1.8}
@media(max-width:1100px){.rd-stages{grid-template-columns:1fr}}
@media(max-width:900px){.rd{padding:12px}.rd-kpis{grid-template-columns:repeat(2,1fr)}.rd-split{grid-template-columns:1fr}.rd-prog{align-items:flex-start}}
`;
