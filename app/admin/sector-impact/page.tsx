'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — تقارير الأثر القطاعية (P8-ج): مؤشرات موحّدة بحسب القطاع/المهارة/الجهة/الفترة، مقارنة الجهات، سرد تنفيذي، Excel وطباعة، وتصنيف البرامج بالقطاعات

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { EMPTY_REPORT, totals, programRows, orgRows, skillRows, sectorRows, periodPresets, validateFilters, rpcParams, narrative, scopeLabel, impactSheets, kpiLabel } from '../../../lib/portal/impact';
import type { ImpactReport, ImpactFilters } from '../../../lib/portal/impact';
import { domainLabel, skillName } from '../../../lib/portal/skills';
import type { Skill, Sector, Organization } from '../../../lib/portal/skills';
import { typeLabel } from '../../../lib/portal/catalog';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
type Prog = { id: string; name_ar: string; sector?: string | null; program_type?: string | null; start_date?: string | null };
type Tab = 'programs' | 'orgs' | 'skills' | 'sectors' | 'classify';
const n0 = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

export default function Page() { return <Suspense fallback={null}><SectorImpact /></Suspense>; }

function SectorImpact() {
  const db = useMemo(() => supabase(), []); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(''); const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [orgs, setOrgs] = useState<Organization[]>([]); const [progs, setProgs] = useState<Prog[]>([]);
  const presets = useMemo(() => periodPresets(), []);
  const [f, setF] = useState<ImpactFilters>({ from: presets[2].from, to: presets[2].to, sector: '', skill: '', org: '' });
  const [applied, setApplied] = useState<ImpactFilters | null>(null); const [report, setReport] = useState<ImpactReport>(EMPTY_REPORT); const [tab, setTab] = useState<Tab>('programs'); const [classQ, setClassQ] = useState('');
  const canWrite = !!me && WRITERS.includes(me.role);

  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/sector-impact'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); const role = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(role)) { router.replace('/dashboard'); return; }
    setMe({ id: user.id, role });
    const [{ data: sc }, { data: sk }, { data: og }, pr] = await Promise.all([db.from('portal_sectors').select('*').eq('active', true).order('sort'), db.from('portal_skills').select('*').eq('active', true).order('code'), db.from('portal_organizations').select('*').eq('active', true).order('name_ar'), db.from('programs').select('id,name_ar,sector,program_type,start_date').is('archived_at', null).order('start_date', { ascending: false }).limit(400)]);
    setSectors((sc || []) as Sector[]); setSkills((sk || []) as Skill[]); setOrgs((og || []) as Organization[]);
    if (pr.error && /sector/i.test(pr.error.message)) setError('عمود القطاع غير موجود بعد — طبّق ملف SQL رقم 418 أولًا.'); else setProgs((pr.data || []) as Prog[]);
    setReady(true);
  })(); }, [db, router]);

  async function run(ff = f) {
    const v = validateFilters(ff); if (v) { setError(v); return; } setError(''); setBusy('run');
    try { const { data, error: e } = await db.rpc('portal_impact_report', rpcParams(ff)); if (e) throw new Error(e.message); const r = (data || EMPTY_REPORT) as ImpactReport; if (!r.ok) throw new Error(r.error === 'forbidden' ? 'غير مصرّح' : (r.error || 'تعذّر إنشاء التقرير')); setReport({ ...EMPTY_REPORT, ...r }); setApplied({ ...ff }); }
    catch (x: any) { setError(String(x?.message || x)); }
    setBusy('');
  }
  useEffect(() => { if (ready && !applied && !error) run(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setProgramSector(id: string, sector: string) {
    setBusy('cls' + id); const { error: e } = await db.from('programs').update({ sector: sector || null }).eq('id', id);
    if (e) setError(e.message); else { setProgs(ps => ps.map(p => (p.id === id ? { ...p, sector: sector || null } : p))); setNotice('حُفظ قطاع البرنامج.'); }
    setBusy('');
  }

  const tt = useMemo(() => totals(report), [report]); const pRows = useMemo(() => programRows(report), [report]); const oRows = useMemo(() => orgRows(report), [report]); const sRows = useMemo(() => skillRows(report), [report]); const secRows = useMemo(() => sectorRows(report), [report]);
  const names = { sector: sectors.find(s => s.code === (applied?.sector || ''))?.name_ar, skill: (() => { const s = skills.find(x => x.id === (applied?.skill || '')); return s ? `${s.code} ${s.name_ar}` : undefined; })(), org: orgs.find(o => o.id === (applied?.org || ''))?.name_ar };
  const scope = applied ? scopeLabel(applied, names, 'ar') : ''; const story = useMemo(() => (applied ? narrative(tt, 'ar', scope) : []), [tt, applied, scope]);
  const maxLearners = Math.max(1, ...oRows.map(o => o.learners), ...secRows.map(s => s.learners));
  const unclassified = progs.filter(p => !p.sector).length;
  const classRows = progs.filter(p => !classQ || p.name_ar.includes(classQ));

  if (!ready) return <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="en-card">…</div></div></div>;
  return (
    <div className="en im"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <header className="en-head no-print"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>تقارير الأثر القطاعية</h1><p>مؤشرات موحّدة عبر كل الخدمات: التسجيل والحضور والشهادات ومِعيار والملف المهاري، مع الرضا والقياس القبلي/البعدي ونقل الأثر من منصة التقويم — بحسب القطاع أو المهارة أو الجهة أو الفترة. للجهات الحكومية والممولين ولوحات المتابعة.</p></div>
          <div className="en-acts"><button type="button" className="en-btn ghost" disabled={!applied} onClick={() => downloadXlsx(safeFilename('athar_sector_impact', 'xlsx'), impactSheets(report, applied!, names))}><Icon name="download" size={14} /> Excel</button><button type="button" className="en-btn ghost" disabled={!applied} onClick={() => window.print()}><Icon name="print" size={14} /> طباعة / PDF</button><Link href="/admin/skills" className="en-btn ghost"><Icon name="target" size={14} /> المهارات والجهات</Link></div></header>
        <div className="no-print"><PortalAdminTabs /></div>
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok no-print">{notice}</div>}

        {/* المرشحات */}
        <div className="en-card im-filters no-print">
          <div className="en-tabs">{presets.map(p => <button key={p.key} type="button" className={f.from === p.from && f.to === p.to ? 'on' : ''} onClick={() => { const nf = { ...f, from: p.from, to: p.to }; setF(nf); run(nf); }}>{p.label.ar}</button>)}</div>
          <div className="im-grid">
            <label className="en-note">من<input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></label>
            <label className="en-note">إلى<input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></label>
            <label className="en-note">القطاع<select value={f.sector} onChange={e => setF({ ...f, sector: e.target.value })}><option value="">كل القطاعات</option>{sectors.map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label>
            <label className="en-note">المهارة<select value={f.skill} onChange={e => setF({ ...f, skill: e.target.value })}><option value="">كل المهارات</option>{skills.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name_ar}</option>)}</select></label>
            <label className="en-note">الجهة<select value={f.org} onChange={e => setF({ ...f, org: e.target.value })}><option value="">كل الجهات</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select></label>
            <div className="en-acts" style={{ alignSelf: 'end' }}><button type="button" className="en-btn" disabled={busy === 'run'} onClick={() => run()}><Icon name="refresh" size={14} /> {busy === 'run' ? 'جارٍ الحساب…' : 'تحديث التقرير'}</button>{(f.sector || f.skill || f.org) && <button type="button" className="en-btn ghost" onClick={() => { const nf = { ...f, sector: '', skill: '', org: '' }; setF(nf); run(nf); }}>مسح المرشحات</button>}</div>
          </div>
        </div>

        {applied && <>
          <div className="im-print-head"><div><span className="en-kicker">أَثَر · تقرير الأثر القطاعي</span><h2>{names.sector || names.org || names.skill || 'كل القطاعات'}</h2><p>{scope} · أُنشئ {String(report.generated_at || '').slice(0, 10)}</p></div></div>
          {/* المؤشرات */}
          <div className="im-kpis">
            {[
              ['learners', tt.learners, ''], ['programs', tt.programs, ''], ['orgs', tt.orgs, ''], ['hours', tt.hours, ''],
              ['attendance', tt.attendance.rate, '%'], ['satisfaction', tt.satisfaction.mean, '/5'], ['improvement', tt.prepost.improvement, '%'], ['transfer', tt.transfer.mean, '%'],
              ['proven', tt.skillsProven, ''], ['credentials', tt.credentials, ''], ['placements', tt.placements.total, ''], ['events', tt.events.total, ''],
            ].map(([k, v, suf]) => <div key={String(k)} className={`im-kpi ${v === null ? 'na' : ''}`}><b>{n0(v as number | null, String(suf))}</b><span>{kpiLabel(String(k), 'ar')}</span>{k === 'satisfaction' && tt.satisfaction.n > 0 && <small>{tt.satisfaction.n} استبانة</small>}{k === 'improvement' && tt.prepost.pre !== null && <small>{tt.prepost.pre} ← {tt.prepost.post}</small>}{k === 'transfer' && tt.transfer.n > 0 && <small>{tt.transfer.n} استجابة</small>}{k === 'attendance' && tt.attendance.sessions > 0 && <small>{tt.attendance.sessions} جلسة</small>}{k === 'proven' && <small>{tt.skillsApproved} معتمدة</small>}</div>)}
          </div>
          {/* السرد التنفيذي */}
          <div className="en-card im-story"><h3><Icon name="doc" size={16} /> الخلاصة التنفيذية</h3><ul>{story.map((s, i) => <li key={i}>{s}</li>)}</ul>
            {tt.placements.total > 0 && <div className="im-levels">{tt.placements.levels.map(l => <span key={l.level}><b>{l.level}</b> {l.n}</span>)}</div>}
            <small className="en-muted">المنهجية: المتعلمون = تسجيلات مقبولة ضمن الفترة؛ الساعات = ساعات البرنامج × متعلموه؛ الحضور = حاضرون ÷ (جلسات × متعلمون)؛ الرضا من بنود التقويم (1–5)؛ القبلي/البعدي من أداة قياس الأثر (0–100)؛ نقل الأثر = متوسط نسبة التطبيق من المشرفين والمتدربين؛ المهارة «مُثبتة» عند مستوى ≥ 3 وثقة ≥ 35%.</small></div>

          {/* الجداول */}
          <div className="en-tabs no-print">
            <button type="button" className={tab === 'programs' ? 'on' : ''} onClick={() => setTab('programs')}><Icon name="book" size={13} /> البرامج ({pRows.length})</button>
            <button type="button" className={tab === 'orgs' ? 'on' : ''} onClick={() => setTab('orgs')}><Icon name="users" size={13} /> مقارنة الجهات ({oRows.length})</button>
            <button type="button" className={tab === 'skills' ? 'on' : ''} onClick={() => setTab('skills')}><Icon name="target" size={13} /> المهارات ({sRows.length})</button>
            <button type="button" className={tab === 'sectors' ? 'on' : ''} onClick={() => setTab('sectors')}><Icon name="flag" size={13} /> القطاعات ({secRows.length})</button>
            {canWrite && <button type="button" className={tab === 'classify' ? 'on' : ''} onClick={() => setTab('classify')}><Icon name="edit" size={13} /> تصنيف البرامج{unclassified ? ` (${unclassified} بلا قطاع)` : ''}</button>}
          </div>

          <div className={`en-card sk-table im-sec ${tab === 'programs' ? '' : 'print-only'}`}><h3 className="print-only">البرامج</h3>
            {pRows.length === 0 ? <p className="en-muted" style={{ padding: 12 }}>لا برامج في هذا النطاق.</p> : <table><thead><tr><th>البرنامج</th><th>القطاع</th><th>المتعلمون</th><th>الساعات</th><th>الحضور</th><th>الرضا</th><th>قبلي ← بعدي</th><th>نقل الأثر</th><th>شهادات</th></tr></thead><tbody>
              {pRows.map(p => <tr key={p.id}><td><b>{p.name_ar}</b><small>{typeLabel(p.program_type, 'ar')}{p.cefr_level ? ` · ${p.cefr_level}` : ''}{p.start_date ? ` · ${p.start_date}` : ''}{p.pending ? ` · ${p.pending} قيد المراجعة` : ''}</small></td><td>{sectors.find(s => s.code === p.sector)?.name_ar || '—'}</td><td><b>{p.learners}</b>{p.orgs ? <small>{p.orgs} جهة</small> : null}</td><td>{p.hoursDelivered || '—'}</td><td>{p.attendanceRate === null ? '—' : <span className="im-bar"><i style={{ width: `${p.attendanceRate}%` }} /><em>{p.attendanceRate}%</em></span>}</td><td>{p.satisfaction?.mean ?? '—'}{p.satisfaction?.n ? <small>{p.satisfaction.n}</small> : null}</td><td>{p.prepost?.pre ?? '—'} ← {p.prepost?.post ?? '—'}{p.improvement !== null && <small className={p.improvement >= 0 ? 'up' : 'down'}>{p.improvement > 0 ? '+' : ''}{p.improvement}%</small>}</td><td>{p.transfer?.mean === null || p.transfer?.mean === undefined ? '—' : `${p.transfer.mean}%`}</td><td>{p.credentials}</td></tr>)}
            </tbody></table>}</div>

          <div className={`en-card sk-table im-sec ${tab === 'orgs' ? '' : 'print-only'}`}><h3 className="print-only">مقارنة الجهات</h3>
            {oRows.length === 0 ? <p className="en-muted" style={{ padding: 12 }}>لا جهات مرتبطة بتسجيلات في هذا النطاق. (تُربط التسجيلات بالجهة تلقائيًا عبر نطاق البريد أو التسجيل الجماعي.)</p> : <table><thead><tr><th>الجهة</th><th>القطاع</th><th>المنسوبون</th><th>المتعلمون</th><th>التسجيلات</th><th>الشهادات</th><th>متوسط المستوى</th></tr></thead><tbody>
              {oRows.map(o => <tr key={o.id}><td><b>{o.name_ar}</b>{o.city && <small>{o.city}</small>}</td><td>{sectors.find(s => s.code === o.sector)?.name_ar || '—'}</td><td>{o.members}</td><td><span className="im-bar wide"><i style={{ width: `${Math.round((o.learners / maxLearners) * 100)}%` }} /><em>{o.learners}</em></span></td><td>{o.enrollments}</td><td>{o.credentials}{o.credPerLearner !== null && <small>{o.credPerLearner}/متعلم</small>}</td><td>{o.avg_level ?? '—'}</td></tr>)}
            </tbody></table>}</div>

          <div className={`en-card sk-table im-sec ${tab === 'skills' ? '' : 'print-only'}`}><h3 className="print-only">المهارات</h3>
            {sRows.length === 0 ? <p className="en-muted" style={{ padding: 12 }}>لا مهارات موسومة على برامج هذا النطاق — وسّم البرامج بالمهارات من «نشر البرامج».</p> : <table><thead><tr><th>الرمز</th><th>المهارة</th><th>المجال</th><th>الأطر</th><th>المتعلمون</th><th>مُثبتة</th><th>معتمدة</th><th>متوسط المستوى</th><th>البرامج</th></tr></thead><tbody>
              {sRows.map(s => <tr key={s.id}><td dir="ltr">{s.code}</td><td><b>{skillName(s as any, 'ar')}</b></td><td>{domainLabel(s.domain, 'ar')}</td><td><small>{[s.saqf_level ? `SAQF ${s.saqf_level}` : '', s.cefr_level ? `CEFR ${s.cefr_level}` : '', s.sdaia_code || ''].filter(Boolean).join(' · ') || '—'}</small></td><td>{s.learners}</td><td>{s.proven}{s.provenPct !== null && <small>{s.provenPct}%</small>}</td><td>{s.approved}</td><td>{s.avg_level ?? '—'}</td><td>{s.programs}</td></tr>)}
            </tbody></table>}</div>

          <div className={`en-card sk-table im-sec ${tab === 'sectors' ? '' : 'print-only'}`}><h3 className="print-only">القطاعات</h3>
            {secRows.length === 0 ? <p className="en-muted" style={{ padding: 12 }}>لا بيانات قطاعية بعد — صنّف البرامج بالقطاعات من تبويب «تصنيف البرامج»، أو اربط الجهات بقطاعاتها.</p> : <table><thead><tr><th>القطاع</th><th>البرامج</th><th>الجهات</th><th>المتعلمون</th></tr></thead><tbody>
              {secRows.map(s => <tr key={s.code}><td><b>{s.name_ar}</b><small dir="ltr">{s.code}</small></td><td>{s.programs}</td><td>{s.orgs}</td><td><span className="im-bar wide"><i style={{ width: `${Math.round((s.learners / maxLearners) * 100)}%` }} /><em>{s.learners}</em></span></td></tr>)}
            </tbody></table>}</div>

          {canWrite && tab === 'classify' && <div className="en-card sk-table no-print"><div className="en-tools" style={{ padding: 12 }}><span className="en-muted">اختر قطاع كل برنامج — يُستخدم في هذا التقرير وفي الكتالوج المفتوح (JSON-LD). البرامج بلا قطاع تُحسب فقط عبر قطاع الجهة المسجّلة.</span><input placeholder="بحث باسم البرنامج…" value={classQ} onChange={e => setClassQ(e.target.value)} style={{ marginInlineStart: 'auto', border: '1px solid #cbd5e1', borderRadius: 10, padding: '7px 10px', font: 'inherit', fontSize: 13 }} /></div>
            <table><thead><tr><th>البرنامج</th><th>النوع</th><th>القطاع</th></tr></thead><tbody>{classRows.map(p => <tr key={p.id} className={p.sector ? '' : 'off'}><td><b>{p.name_ar}</b>{p.start_date && <small>{p.start_date}</small>}</td><td>{typeLabel(p.program_type, 'ar')}</td><td><select value={p.sector || ''} disabled={busy === 'cls' + p.id} onChange={e => setProgramSector(p.id, e.target.value)}><option value="">— بلا قطاع —</option>{sectors.map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></td></tr>)}</tbody></table></div>}

          <div className="im-foot print-only">© 2026 د. أحمد محمد عبدالعزيز بدوي — بوابة أَثَر · تقرير مُولَّد آليًا من بيانات المنصة؛ المؤشرات التقويمية (الرضا/القبلي-البعدي/نقل الأثر) من منصة التقويم المتكاملة.</div>
        </>}
      </div>
    </div>
  );
}

const CSS = `
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1120px;margin:0 auto;display:grid;gap:12px}
.en-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px;max-width:760px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155;display:inline-flex;gap:5px;align-items:center}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.en-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.en-note input,.en-note select{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;font-weight:500}
.en-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1;padding:6px 10px}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.sk-table{overflow:auto;padding:0}.sk-table table{width:100%;border-collapse:collapse;font-size:13px}.sk-table th{background:#f1f5f9;color:#334155;font-size:12px;text-align:start;padding:9px 10px;white-space:nowrap}.sk-table td{padding:9px 10px;border-top:1px solid #f1f5f9;vertical-align:top}.sk-table td b{color:#0f172a;font-size:13.5px}.sk-table td small{display:block;color:#64748b;font-size:11.5px;margin-top:2px}.sk-table tr.off{opacity:.65}.sk-table select{font:inherit;font-size:12.5px;border:1px solid #cbd5e1;border-radius:8px;padding:5px 8px;background:#fff}
.im-filters{display:grid;gap:10px}.im-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
.im-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.im-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;display:grid;gap:2px}.im-kpi b{font-size:24px;color:#0f2a4e;line-height:1.1;direction:ltr;text-align:start}.im-kpi span{font-size:12.5px;color:#334155;font-weight:800}.im-kpi small{font-size:11px;color:#64748b}.im-kpi.na b{color:#94a3b8}
.im-story h3{margin:0 0 8px;font-size:15px;color:#0f2a4e;display:flex;gap:6px;align-items:center}.im-story ul{margin:0 0 8px;padding-inline-start:20px;font-size:14px;line-height:1.9;color:#0f172a}.im-levels{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}.im-levels span{border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:12.5px;color:#334155;background:#f8fafc}.im-levels b{color:#0b8a83;margin-inline-end:4px}
.im-bar{display:inline-flex;align-items:center;gap:6px;min-width:90px}.im-bar i{display:block;height:8px;border-radius:4px;background:#0b8a83;min-width:2px;max-width:80px;flex:none}.im-bar.wide i{max-width:140px;width:140px}.im-bar em{font-style:normal;font-weight:800;color:#0f2a4e;font-size:12.5px}
.im-bar.wide{position:relative}.im-bar.wide i{background:linear-gradient(90deg,#0b8a83,#0f2a4e)}
small.up{color:#047857!important;font-weight:900}small.down{color:#b91c1c!important;font-weight:900}
.im-print-head,.print-only{display:none}
@media(max-width:900px){.im-grid{grid-template-columns:repeat(2,1fr)}.im-kpis{grid-template-columns:repeat(3,1fr)}}
@media print{@page{size:A4;margin:12mm}.en{padding:0;background:#fff}.no-print,header.en-head,nav,.pat{display:none!important}.print-only{display:block}.im-print-head{display:block;border-bottom:3px solid #c9a24b;padding-bottom:8px;margin-bottom:6px}.im-print-head h2{margin:2px 0;color:#0f2a4e;font-size:22px}.im-print-head p{margin:0;color:#64748b;font-size:12px}.im-kpis{grid-template-columns:repeat(4,1fr)}.im-kpi{break-inside:avoid}.en-card{break-inside:avoid;border-color:#cbd5e1}.sk-table h3{margin:10px 12px 4px;font-size:15px;color:#0f2a4e}.im-sec{margin-top:6px}.im-foot{margin-top:10px;font-size:11px;color:#64748b;text-align:center}}
`;
