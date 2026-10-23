'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { KPI_TEMPLATES, UNITS, DEFAULT_KPI, kpiRows, programOutcomeIndex, achievementLabel } from '../../../lib/outcomes/model';
import type { OutcomeKpi, OutcomeMeasurement, KpiRow } from '../../../lib/outcomes/model';

type Program = { id: string; name_ar: string; status?: string | null; end_date?: string | null };
const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const today = () => new Date().toISOString().slice(0, 10);

export default function OutcomesAdminPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(''); const [orgId, setOrgId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [kpis, setKpis] = useState<OutcomeKpi[]>([]);
  const [ms, setMs] = useState<OutcomeMeasurement[]>([]);
  const [programId, setProgramId] = useState(params.get('program') || '');
  const [error, setError] = useState(''); const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<(Omit<OutcomeKpi, 'id'> & { id?: string }) | null>(null);
  const [measure, setMeasure] = useState<{ kpi: KpiRow; value: string; measured_on: string; note: string } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [openHist, setOpenHist] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/outcomes'); return; }
      const [p, pg] = await Promise.all([
        db.from('profiles').select('role,organization_id').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar,status,end_date').order('name_ar'),
      ]);
      setRole(String(p.data?.role || '')); setOrgId(p.data?.organization_id || null);
      const pgs = ((pg.data || []) as Program[]).filter(x => x.status !== 'CANCELLED'); setPrograms(pgs);
      if (!params.get('program') && pgs.length) setProgramId(pgs[0].id);
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [k, m] = await Promise.all([
      db.from('outcome_kpis').select('*').order('created_at'),
      db.from('outcome_measurements').select('*').order('measured_on', { ascending: false }).limit(20000),
    ]);
    const err = k.error || m.error; if (err) { setError(err.message); return; }
    setKpis((k.data || []) as OutcomeKpi[]); setMs((m.data || []) as OutcomeMeasurement[]);
  }
  function ok(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 3000); }

  const allowed = ALLOWED.includes(role.toUpperCase()); const canWrite = WRITERS.includes(role.toUpperCase());
  const rows = useMemo(() => kpiRows(kpis.filter(k => k.program_id === programId), ms), [kpis, ms, programId]);
  const summary = useMemo(() => programOutcomeIndex(rows), [rows]);
  const coverage = useMemo(() => { const set = new Set(kpis.map(k => k.program_id)); return { withKpis: programs.filter(p => set.has(p.id)).length, total: programs.length }; }, [kpis, programs]);
  const program = programs.find(p => p.id === programId) || null;

  /* ---------- CRUD ---------- */
  async function saveKpi() {
    if (!edit) return;
    if (!edit.name_ar.trim()) { setError('اسم المؤشر مطلوب'); return; }
    setBusy(true); setError('');
    const payload: any = { ...edit, program_id: programId, organization_id: orgId, name_ar: edit.name_ar.trim(), name_en: edit.name_en || null, source: edit.source || null, owner_name: edit.owner_name || null, notes: edit.notes || null, baseline_date: edit.baseline_date || null, target_date: edit.target_date || null, weight: Number(edit.weight) || 1 };
    delete payload.id;
    const q = edit.id ? db.from('outcome_kpis').update(payload).eq('id', edit.id) : db.from('outcome_kpis').insert(payload);
    const { error } = await q; setBusy(false);
    if (error) { setError(error.message); return; }
    setEdit(null); await load(); ok(edit.id ? '✅ تم تحديث المؤشر' : '✅ تمت إضافة المؤشر');
  }
  async function removeKpi(k: KpiRow) {
    if (!confirm(`حذف المؤشر «${k.name_ar}» وجميع قياساته (${k.measurements.length})؟`)) return;
    const { error } = await db.from('outcome_kpis').delete().eq('id', k.id);
    if (error) { setError(error.message); return; } await load(); ok('🗑️ تم الحذف');
  }
  async function addFromTemplate(items: typeof KPI_TEMPLATES[number]['items']) {
    if (!programId) return; setBusy(true);
    const existing = new Set(rows.map(r => r.name_ar));
    const payload = items.filter(i => !existing.has(i.name_ar)).map(i => ({ ...i, program_id: programId, organization_id: orgId }));
    if (!payload.length) { setBusy(false); ok('كل مؤشرات هذا القالب مضافة مسبقًا'); return; }
    const { error } = await db.from('outcome_kpis').insert(payload); setBusy(false);
    if (error) { setError(error.message); return; } setTplOpen(false); await load(); ok(`✅ أُضيف ${payload.length} مؤشرًا — أكمل خط الأساس والمستهدف لكل مؤشر`);
  }
  async function saveMeasurement() {
    if (!measure) return; const v = Number(measure.value);
    if (!Number.isFinite(v)) { setError('قيمة القياس غير صالحة'); return; }
    setBusy(true); setError('');
    const { error } = await db.from('outcome_measurements').insert({ kpi_id: measure.kpi.id, value: v, measured_on: measure.measured_on || today(), note: measure.note || null });
    setBusy(false); if (error) { setError(error.message); return; }
    setMeasure(null); await load(); ok('✅ تم تسجيل القياس');
  }
  async function removeMeasurement(m: OutcomeMeasurement) {
    if (!confirm('حذف هذا القياس؟')) return;
    const { error } = await db.from('outcome_measurements').delete().eq('id', m.id);
    if (error) { setError(error.message); return; } await load();
  }
  function exportCsv() {
    const head = ['البرنامج', 'المؤشر', 'الوحدة', 'الاتجاه', 'خط الأساس', 'تاريخه', 'المستهدف', 'تاريخه', 'القيمة الحالية', 'تاريخ القياس', 'نسبة التحقق %', 'التغير %', 'الوزن', 'المصدر', 'المسؤول'];
    downloadCSV(safeFilename(`outcomes_${(program?.name_ar || 'program').slice(0, 30)}`), [head, ...rows.map(r => [program?.name_ar || '', r.name_ar, r.unit, r.direction === 'up' ? 'أعلى أفضل' : 'أقل أفضل', r.baseline, r.baseline_date, r.target, r.target_date, r.current, r.measured_on, r.achievement, r.change_pct, r.weight, r.source, r.owner_name])]);
  }

  if (!ready) return <div className="oc" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  if (!allowed) return <div className="oc" dir="rtl"><style>{CSS}</style><div className="oc-card oc-alert">هذه الصفحة متاحة للإدارة ومديري البرامج ومحللي الجودة فقط.</div></div>;

  const idxLabel = achievementLabel(summary.index);
  return (
    <div className="oc" dir="rtl">
      <style>{CSS}</style>
      <header className="oc-head">
        <div>
          <div className="oc-kicker"><Icon name="flag" size={14} /> كيركباتريك — المستوى 4 (النتائج المؤسسية)</div>
          <h1>مؤشرات نتائج التدريب</h1>
          <p>لكل برنامج 2–4 مؤشرات مؤسسية بخط أساس ومستهدف، ثم قياسات دورية بعد البرنامج. تُحسب نسبة تحقق المستهدف تلقائيًا وتغذّي «سلسلة الأثر 1→4».</p>
        </div>
        <nav className="oc-nav">
          <Link href="/dashboard" className="oc-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href={`/reports/chain${programId ? `?program=${programId}` : ''}`} className="oc-btn primary"><Icon name="trend" size={16} /> سلسلة الأثر 1→4</Link>
          <button className="oc-btn" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} /> CSV</button>
        </nav>
      </header>
      {error && <div className="oc-alert">{error} <button className="oc-x" onClick={() => setError('')}>×</button></div>}
      {flash && <div className="oc-flash">{flash}</div>}

      <section className="oc-card">
        <div className="oc-filters">
          <label>البرنامج<select value={programId} onChange={e => { setProgramId(e.target.value); setEdit(null); setMeasure(null); }}>{!programs.length && <option value="">— لا توجد برامج —</option>}{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
          <div className="oc-cov"><span>التغطية</span><b>{coverage.withKpis} / {coverage.total}</b><small>برنامجًا له مؤشرات نتائج</small></div>
          <div className={`oc-cov ${idxLabel.tone}`}><span>مؤشر النتائج للبرنامج</span><b>{summary.index == null ? '—' : `${summary.index}%`}</b><small>{idxLabel.ar} · {summary.measured}/{summary.n} مؤشر مقاس</small></div>
        </div>
      </section>

      {canWrite && (
        <div className="oc-actions">
          <button className="oc-btn primary" disabled={!programId} onClick={() => { setEdit(DEFAULT_KPI(programId)); setMeasure(null); }}><Icon name="plus" size={16} /> مؤشر جديد</button>
          <button className="oc-btn" disabled={!programId} onClick={() => setTplOpen(o => !o)}><Icon name="book" size={16} /> إضافة من القوالب</button>
        </div>
      )}

      {tplOpen && (
        <section className="oc-card oc-tpl">
          <h3><Icon name="book" size={16} /> قوالب مؤشرات جاهزة — اختر مجموعة لإضافتها دفعة واحدة</h3>
          <div className="oc-tpl-grid">
            {KPI_TEMPLATES.map(g => (
              <div key={g.group} className="oc-tpl-card">
                <b>{g.group}</b>
                <ul>{g.items.map(i => <li key={i.name_ar}>{i.name_ar} <small>({i.unit} · {i.direction === 'up' ? '↑' : '↓'})</small></li>)}</ul>
                <button className="oc-btn small primary" disabled={busy} onClick={() => addFromTemplate(g.items)}><Icon name="plus" size={14} /> إضافة المجموعة</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {edit && (
        <section className="oc-card oc-form">
          <h3><Icon name={edit.id ? 'edit' : 'plus'} size={16} /> {edit.id ? 'تعديل مؤشر' : 'مؤشر جديد'} — {program?.name_ar}</h3>
          <div className="oc-grid">
            <label className="span2">اسم المؤشر (عربي) *<input value={edit.name_ar} onChange={e => setEdit({ ...edit, name_ar: e.target.value })} placeholder="مثال: نسبة اجتياز اختبار المستوى" /></label>
            <label>الاسم (إنجليزي)<input value={edit.name_en || ''} onChange={e => setEdit({ ...edit, name_en: e.target.value })} dir="ltr" /></label>
            <label>الوحدة<select value={edit.unit} onChange={e => setEdit({ ...edit, unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
            <label>الاتجاه المرغوب<select value={edit.direction} onChange={e => setEdit({ ...edit, direction: e.target.value as any })}><option value="up">أعلى أفضل ↑</option><option value="down">أقل أفضل ↓</option></select></label>
            <label>الوزن (1–5)<input type="number" min={1} max={5} value={edit.weight} onChange={e => setEdit({ ...edit, weight: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} /></label>
            <label>خط الأساس (قبل البرنامج)<input type="number" step="any" value={edit.baseline ?? ''} onChange={e => setEdit({ ...edit, baseline: e.target.value === '' ? null : Number(e.target.value) })} dir="ltr" /></label>
            <label>تاريخ خط الأساس<input type="date" value={edit.baseline_date || ''} onChange={e => setEdit({ ...edit, baseline_date: e.target.value })} dir="ltr" /></label>
            <label>المستهدف<input type="number" step="any" value={edit.target ?? ''} onChange={e => setEdit({ ...edit, target: e.target.value === '' ? null : Number(e.target.value) })} dir="ltr" /></label>
            <label>تاريخ المستهدف<input type="date" value={edit.target_date || ''} onChange={e => setEdit({ ...edit, target_date: e.target.value })} dir="ltr" /></label>
            <label>مصدر البيانات<input value={edit.source || ''} onChange={e => setEdit({ ...edit, source: e.target.value })} placeholder="نظام الاختبارات، تقرير الإدارة، استبيان…" /></label>
            <label>المسؤول عن القياس<input value={edit.owner_name || ''} onChange={e => setEdit({ ...edit, owner_name: e.target.value })} /></label>
            <label className="span3">ملاحظات<input value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
          </div>
          <div className="oc-form-actions">
            <button className="oc-btn primary" disabled={busy} onClick={saveKpi}><Icon name="save" size={16} /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
            <button className="oc-btn" onClick={() => setEdit(null)}>إلغاء</button>
          </div>
        </section>
      )}

      {measure && (
        <section className="oc-card oc-form">
          <h3><Icon name="plus" size={16} /> تسجيل قياس — {measure.kpi.name_ar}</h3>
          <div className="oc-grid">
            <label>القيمة ({measure.kpi.unit}) *<input type="number" step="any" value={measure.value} onChange={e => setMeasure({ ...measure, value: e.target.value })} dir="ltr" autoFocus /></label>
            <label>تاريخ القياس<input type="date" value={measure.measured_on} onChange={e => setMeasure({ ...measure, measured_on: e.target.value })} dir="ltr" /></label>
            <label className="span2">ملاحظة<input value={measure.note} onChange={e => setMeasure({ ...measure, note: e.target.value })} placeholder="مثال: قياس بعد 3 أشهر من نهاية البرنامج" /></label>
          </div>
          <div className="oc-muted">خط الأساس: <bdi>{measure.kpi.baseline ?? '—'}</bdi> · المستهدف: <bdi>{measure.kpi.target ?? '—'}</bdi> · آخر قياس: <bdi>{measure.kpi.current ?? '—'}</bdi></div>
          <div className="oc-form-actions">
            <button className="oc-btn primary" disabled={busy} onClick={saveMeasurement}><Icon name="save" size={16} /> {busy ? 'جارٍ الحفظ…' : 'حفظ القياس'}</button>
            <button className="oc-btn" onClick={() => setMeasure(null)}>إلغاء</button>
          </div>
        </section>
      )}

      {!rows.length && <div className="oc-card oc-empty"><Icon name="flag" size={34} /><b>لا توجد مؤشرات نتائج لهذا البرنامج بعد</b><span>ابدأ بـ«إضافة من القوالب» أو «مؤشر جديد»، ثم سجّل خط الأساس والمستهدف، وبعد البرنامج سجّل القياسات.</span></div>}

      {rows.length > 0 && (
        <section className="oc-card">
          <h3><Icon name="table" size={16} /> مؤشرات البرنامج ({rows.length})</h3>
          <div className="oc-tablewrap">
            <table className="oc-table">
              <thead><tr><th>المؤشر</th><th>الاتجاه</th><th>خط الأساس</th><th>المستهدف</th><th>الحالي</th><th>التحقق</th><th>الوزن</th><th>المسؤول</th>{canWrite && <th></th>}</tr></thead>
              <tbody>
                {rows.map(r => {
                  const lab = achievementLabel(r.achievement);
                  return (
                    <>
                      <tr key={r.id}>
                        <td><b>{r.name_ar}</b>{r.source && <div className="oc-muted">المصدر: {r.source}</div>}</td>
                        <td><span className="oc-pill">{r.direction === 'up' ? 'أعلى أفضل ↑' : 'أقل أفضل ↓'}</span></td>
                        <td><bdi>{r.baseline ?? '—'}</bdi> {r.unit}{r.baseline_date && <div className="oc-muted"><bdi>{r.baseline_date}</bdi></div>}</td>
                        <td><bdi>{r.target ?? '—'}</bdi> {r.unit}{r.target_date && <div className="oc-muted"><bdi>{r.target_date}</bdi></div>}</td>
                        <td>{r.current == null ? <span className="oc-muted">لا قياس</span> : <><b><bdi>{r.current}</bdi></b> {r.unit}<div className="oc-muted"><bdi>{r.measured_on}</bdi>{r.change_pct != null && <> · <bdi>{r.change_pct > 0 ? '+' : ''}{r.change_pct}%</bdi></>}</div></>}</td>
                        <td>
                          <div className="oc-prog"><i style={{ width: `${r.achievement ?? 0}%` }} className={lab.tone} /></div>
                          <span className={`oc-st ${lab.tone}`}>{r.achievement == null ? '—' : `${r.achievement}%`} · {lab.ar}</span>
                        </td>
                        <td>{r.weight}</td>
                        <td>{r.owner_name || '—'}</td>
                        {canWrite && <td className="oc-rowact">
                          <button className="oc-btn small primary" onClick={() => { setMeasure({ kpi: r, value: '', measured_on: today(), note: '' }); setEdit(null); }}><Icon name="plus" size={13} /> قياس</button>
                          <button className="oc-btn small" onClick={() => setOpenHist(openHist === r.id ? null : r.id)} title="سجل القياسات"><Icon name="clock" size={13} /> {r.measurements.length}</button>
                          <button className="oc-btn small" onClick={() => { const { current, measured_on, achievement, change_pct, measurements, ...k } = r; setEdit(k); setMeasure(null); }}><Icon name="edit" size={13} /></button>
                          <button className="oc-btn small danger" onClick={() => removeKpi(r)}><Icon name="trash" size={13} /></button>
                        </td>}
                      </tr>
                      {openHist === r.id && (
                        <tr key={r.id + '-h'} className="oc-hist"><td colSpan={canWrite ? 9 : 8}>
                          {!r.measurements.length && <span className="oc-muted">لا توجد قياسات بعد.</span>}
                          {r.measurements.length > 0 && <div className="oc-hist-list">{r.measurements.map(m => <div key={m.id} className="oc-hist-item"><b><bdi>{m.value}</bdi> {r.unit}</b><span><bdi>{m.measured_on}</bdi></span>{m.note && <small>{m.note}</small>}{canWrite && <button className="oc-x" onClick={() => removeMeasurement(m)} title="حذف">×</button>}</div>)}</div>}
                        </td></tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="oc-muted" style={{ marginTop: 10 }}>نسبة التحقق = (الحالي − خط الأساس) ÷ (المستهدف − خط الأساس)، محصورة بين 0 و100% ومعكوسة للمؤشرات التي «أقل أفضل». مؤشر النتائج للبرنامج = متوسط موزون بالأوزان.</p>
        </section>
      )}
    </div>
  );
}

const CSS = `
.oc{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.oc *{box-sizing:border-box}
.oc-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.oc-head h1{margin:2px 0 4px;font-size:24px;color:${NAVY}}.oc-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.oc-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.oc-nav,.oc-actions{display:flex;gap:8px;flex-wrap:wrap}.oc-actions{margin-bottom:14px}
.oc-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.oc-btn:disabled{opacity:.5;cursor:default}
.oc-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}.oc-btn.small{padding:5px 9px;font-size:12px;border-radius:8px}.oc-btn.danger{color:#b91c1c;border-color:#fecaca}
.oc-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700;display:flex;justify-content:space-between;gap:10px}
.oc-flash{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-weight:800}
.oc-x{border:0;background:transparent;font:inherit;font-size:18px;cursor:pointer;color:inherit;line-height:1}
.oc-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.oc-card h3{margin:0 0 12px;font-size:15px;color:${NAVY};display:flex;align-items:center;gap:8px}
.oc-muted{color:#64748b;font-size:12px;font-weight:700;line-height:1.6}
.oc-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569;white-space:nowrap}
.oc-filters{display:grid;grid-template-columns:1fr 200px 260px;gap:12px;align-items:stretch}.oc-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569;min-width:0}
.oc select,.oc input{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;background:#fff;width:100%;min-width:0}
.oc-cov{border:1px solid #e2e8f0;border-radius:14px;padding:10px 14px;display:flex;flex-direction:column;gap:1px;min-width:0}.oc-cov span{font-size:11.5px;font-weight:800;color:#64748b}.oc-cov b{font-size:24px;color:${NAVY};line-height:1.2}.oc-cov small{font-size:11px;color:#94a3b8;font-weight:700}
.oc-cov.ok{background:#ecfdf5;border-color:#a7f3d0}.oc-cov.info{background:#eff6ff;border-color:#bfdbfe}.oc-cov.warn{background:#fff7ed;border-color:#fed7aa}.oc-cov.bad{background:#fef2f2;border-color:#fecaca}
.oc-tpl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.oc-tpl-card{border:1px solid #e2e8f0;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}.oc-tpl-card b{color:${NAVY}}.oc-tpl-card ul{margin:0;padding:0 18px 0 0;font-size:12.5px;line-height:1.9;color:#334155;font-weight:700}.oc-tpl-card small{color:#94a3b8}
.oc-form{border-color:#99f6e4;background:#f0fdfa}
.oc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.oc-grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#475569;min-width:0}.oc-grid .span2{grid-column:span 2}.oc-grid .span3{grid-column:span 3}
.oc-form-actions{display:flex;gap:8px;margin-top:12px}
.oc-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;text-align:center;color:#64748b}.oc-empty b{color:${NAVY};font-size:15px}
.oc-tablewrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}
.oc-table{width:100%;border-collapse:collapse;font-size:13px;min-width:900px}.oc-table th{background:#f8fafc;color:#475569;font-size:12px;text-align:start;padding:9px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.oc-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.oc-prog{height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden;width:120px;margin-bottom:4px}.oc-prog i{display:block;height:100%;border-radius:999px;background:#94a3b8}.oc-prog i.ok{background:#059669}.oc-prog i.info{background:#2563eb}.oc-prog i.warn{background:#d97706}.oc-prog i.bad{background:#dc2626}
.oc-st{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:900;white-space:nowrap;background:#f1f5f9;color:#475569}.oc-st.ok{background:#ecfdf5;color:#047857}.oc-st.info{background:#eff6ff;color:#1d4ed8}.oc-st.warn{background:#fff7ed;color:#b45309}.oc-st.bad{background:#fef2f2;color:#b91c1c}
.oc-rowact{white-space:nowrap}.oc-rowact .oc-btn{margin-inline-end:4px}
.oc-hist td{background:#f8fafc}.oc-hist-list{display:flex;gap:8px;flex-wrap:wrap}.oc-hist-item{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:6px 10px;display:flex;align-items:center;gap:8px;font-size:12.5px}.oc-hist-item b{color:${TEAL}}.oc-hist-item span{color:#475569;font-weight:700}.oc-hist-item small{color:#94a3b8}
@media(max-width:980px){.oc{padding:12px}.oc-filters,.oc-tpl-grid,.oc-grid{grid-template-columns:1fr}.oc-grid .span2,.oc-grid .span3{grid-column:auto}}
`;
