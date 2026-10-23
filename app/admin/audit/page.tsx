'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { filterRows, auditStats, auditCsv, changeList, describe, actionLabel, entityLabel, fmtWhen, ENTITY_LABEL, ACTION_LABEL, SOURCE_LABEL } from '../../../lib/audit/model';
import type { AuditRow, AuditFilters } from '../../../lib/audit/model';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const PAGE = 50;

export default function AuditPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]); const [open, setOpen] = useState<string | null>(null);
  const [days, setDays] = useState(30); const [limit, setLimit] = useState(PAGE);
  const [f, setF] = useState<AuditFilters>({ q: '', action: 'ALL', entity: params.get('entity') || 'ALL', actor: 'ALL', source: 'ALL', from: '', to: '' });
  const [who, setWho] = useState<{ role: string; name: string } | null>(null);

  async function load(d = days) {
    setError('');
    const since = new Date(Date.now() - d * 86400000).toISOString();
    const { data, error } = await db.from('audit_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(3000);
    if (error) setError(error.message.includes('audit_logs') || error.code === '42P01' ? 'جدول سجل التدقيق غير موجود — نفّذ ملف SQL (20261031_audit_trail.sql) في Supabase.' : error.message);
    setRows(((data || []) as any[]).map(r => ({ ...r, source: r.source || 'app' })));
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/audit'); return; }
      const { data: p } = await db.from('profiles').select('role,full_name').eq('id', user.id).single();
      setWho({ role: String((p as any)?.role || ''), name: String((p as any)?.full_name || user.email || '') });
      await load(30); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => filterRows(rows, f), [rows, f]);
  const stats = useMemo(() => auditStats(filtered), [filtered]);
  const actors = useMemo(() => [...new Set(rows.map(r => r.actor_email || r.actor_id || 'system'))].sort(), [rows]);
  const entities = useMemo(() => [...new Set(rows.map(r => r.entity_type).filter(Boolean) as string[])].sort(), [rows]);
  const actions = useMemo(() => [...new Set(rows.map(r => r.action))].sort(), [rows]);
  const maxDay = Math.max(1, ...stats.byDay.map(d => d.n));
  const set = (k: keyof AuditFilters, v: string) => { setF(prev => ({ ...prev, [k]: v })); setLimit(PAGE); };

  if (!ready) return <div className="au" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="au" dir="rtl">
      <style>{CSS}</style>
      <header className="au-head au-noprint">
        <div>
          <div className="au-kicker"><Icon name="shield" size={14} /> الحوكمة · سجلّ التدقيق</div>
          <h1>سجلّ التدقيق — من فعل ماذا ومتى</h1>
          <p>تتبّع تلقائي لكل إنشاء/تعديل/حذف في البرامج والمدربين والقاعات والأسئلة والمستخدمين والإعدادات والمؤشرات، إضافة إلى العمليات الحساسة (إرسال التقارير والشهادات، تفريغ البيانات، الكرون). لا يمكن تعديل السجل أو حذفه من الواجهة.</p>
        </div>
        <nav className="au-nav">
          <Link href="/dashboard" className="au-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/management" className="au-btn"><Icon name="admin" size={16} /> مركز الإدارة</Link>
          <Link href="/admin/data-lifecycle" className="au-btn"><Icon name="trash" size={16} /> دورة حياة البيانات</Link>
          <button className="au-btn" onClick={() => load()}><Icon name="refresh" size={16} /> تحديث</button>
          <button className="au-btn" disabled={!filtered.length} onClick={() => downloadCSV(safeFilename('audit_log'), auditCsv(filtered))}><Icon name="download" size={16} /> CSV</button>
          <button className="au-btn" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة</button>
        </nav>
      </header>
      {error && <div className="au-alert">{error}</div>}

      <section className="au-kpis">
        <div className="au-kpi"><b>{stats.total}</b><span>سجل في النطاق</span></div>
        <div className="au-kpi ok"><b>{stats.inserts}</b><span>إنشاء</span></div>
        <div className="au-kpi info"><b>{stats.updates}</b><span>تعديل</span></div>
        <div className="au-kpi bad"><b>{stats.deletes}</b><span>حذف</span></div>
        <div className="au-kpi gold"><b>{stats.app}</b><span>عمليات تطبيقية</span></div>
        <div className="au-kpi"><b>{stats.actors}</b><span>منفّذون</span></div>
      </section>

      <section className="au-card au-noprint">
        <div className="au-filters">
          <label>نطاق التحميل<select value={days} onChange={e => { const d = Number(e.target.value); setDays(d); load(d); }}><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يومًا</option><option value={90}>آخر 90 يومًا</option><option value={365}>آخر سنة</option></select></label>
          <label>العملية<select value={f.action} onChange={e => set('action', e.target.value)}><option value="ALL">الكل</option><option value="INSERT">إنشاء</option><option value="UPDATE">تعديل</option><option value="DELETE">حذف</option><option value="APP">عمليات تطبيقية فقط</option>{actions.filter(a => !['INSERT', 'UPDATE', 'DELETE'].includes(a)).map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}</select></label>
          <label>الكيان<select value={f.entity} onChange={e => set('entity', e.target.value)}><option value="ALL">الكل</option>{entities.map(e => <option key={e} value={e}>{entityLabel(e)}</option>)}</select></label>
          <label>المنفّذ<select value={f.actor} onChange={e => set('actor', e.target.value)}><option value="ALL">الكل</option>{actors.map(a => <option key={a} value={a}>{a === 'system' ? 'النظام' : a}</option>)}</select></label>
          <label>المصدر<select value={f.source} onChange={e => set('source', e.target.value)}><option value="ALL">الكل</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>من<input type="date" value={f.from} onChange={e => set('from', e.target.value)} /></label>
          <label>إلى<input type="date" value={f.to} onChange={e => set('to', e.target.value)} /></label>
          <label className="au-grow">بحث<input placeholder="اسم، بريد، معرّف، حقل…" value={f.q} onChange={e => set('q', e.target.value)} /></label>
        </div>
      </section>

      <div className="au-grid2">
        <section className="au-card">
          <h3><Icon name="chart" size={16} /> النشاط اليومي</h3>
          {!stats.byDay.length && <div className="au-muted">لا بيانات.</div>}
          <div className="au-spark">{stats.byDay.slice(-45).map(d => <div key={d.day} title={`${d.day}: ${d.n}`}><i style={{ height: `${(d.n / maxDay) * 100}%` }} /></div>)}</div>
          {stats.byDay.length > 0 && <div className="au-spark-ax"><bdi>{stats.byDay.slice(-45)[0].day}</bdi><bdi>{stats.byDay[stats.byDay.length - 1].day}</bdi></div>}
        </section>
        <section className="au-card">
          <h3><Icon name="folder" size={16} /> حسب الكيان</h3>
          <div className="au-ent">{stats.byEntity.slice(0, 8).map(e => <button key={e.entity} className={f.entity === e.entity ? 'on' : ''} onClick={() => set('entity', f.entity === e.entity ? 'ALL' : e.entity)}><span>{e.label}</span><b>{e.n}</b></button>)}</div>
        </section>
      </div>

      <section className="au-card">
        <h3><Icon name="table" size={16} /> السجلات ({filtered.length})</h3>
        {!filtered.length && <div className="au-empty"><Icon name="shield" size={34} /><b>لا توجد سجلات مطابقة</b><span>وسّع نطاق التحميل أو غيّر الفلاتر. يبدأ التسجيل التلقائي من لحظة تنفيذ ملف SQL.</span></div>}
        <div className="au-list">
          {filtered.slice(0, limit).map(r => {
            const isOpen = open === r.id; const ch = isOpen ? changeList(r) : [];
            return (
              <article key={r.id} className={`au-row ${r.action}`}>
                <button className="au-row-main" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
                  <span className={`au-act ${r.action}`}>{actionLabel(r.action)}</span>
                  <span className="au-desc">{describe(r)}</span>
                  <span className="au-meta"><bdi>{fmtWhen(r.created_at)}</bdi> · {entityLabel(r.entity_type)} · {SOURCE_LABEL[r.source || 'app'] || r.source}</span>
                  <Icon name="arrow" size={14} />
                </button>
                {isOpen && (
                  <div className="au-detail">
                    <div className="au-detail-meta">
                      <span><b>المنفّذ:</b> {r.actor_email || r.actor_id || 'النظام'}{r.actor_role ? ` (${r.actor_role})` : ''}</span>
                      <span><b>المعرّف:</b> <code>{r.entity_id || '—'}</code></span>
                      <span><b>سجل:</b> <code>{r.id.slice(0, 8)}</code></span>
                    </div>
                    {ch.length > 0 ? (
                      <table className="au-table"><thead><tr><th>الحقل</th><th>قبل</th><th>بعد</th></tr></thead>
                        <tbody>{ch.map(c => <tr key={c.field}><td><b>{c.label}</b><small>{c.field}</small></td><td className="from">{c.from}</td><td className="to">{c.to}</td></tr>)}</tbody></table>
                    ) : <div className="au-muted">لا تفاصيل إضافية.</div>}
                    {r.metadata && Object.keys(r.metadata).length > 1 && <details className="au-raw"><summary>البيانات الخام (metadata)</summary><pre>{JSON.stringify(r.metadata, null, 2)}</pre></details>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {filtered.length > limit && <div className="au-more au-noprint"><button className="au-btn" onClick={() => setLimit(l => l + PAGE)}>عرض {Math.min(PAGE, filtered.length - limit)} سجلًا إضافيًا</button></div>}
      </section>
      <footer className="au-foot">يعرض هذا السجل آخر {days} يومًا (حتى 3000 سجل). الاحتفاظ الافتراضي 730 يومًا ويُنظَّف تلقائيًا عبر الكرون الأسبوعي (AUDIT_RETENTION_DAYS). {who?.name ? `المستخدم الحالي: ${who.name}` : ''}</footer>
    </div>
  );
}

const CSS = `
.au{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.au *{box-sizing:border-box}
.au-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.au-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.au-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.au-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.au-nav{display:flex;gap:8px;flex-wrap:wrap}
.au-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.au-btn:disabled{opacity:.5}
.au-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}
.au-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}.au-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;min-width:0}.au-kpi b{display:block;font-size:22px;color:${NAVY}}.au-kpi span{font-size:12px;font-weight:800;color:#64748b}
.au-kpi.ok b{color:#047857}.au-kpi.info b{color:#1d4ed8}.au-kpi.bad b{color:#b91c1c}.au-kpi.gold b{color:#a16207}
.au-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px;min-width:0}.au-card h3{margin:0 0 12px;font-size:15px;color:${NAVY};display:flex;align-items:center;gap:8px}
.au-muted{color:#64748b;font-size:12.5px;font-weight:700}
.au-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.au-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569;min-width:0}.au-filters .au-grow{grid-column:span 2}
.au select,.au input{border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;font:inherit;font-size:13px;font-weight:700;background:#fff;width:100%}
.au-grid2{display:grid;grid-template-columns:1.4fr 1fr;gap:14px}
.au-spark{display:flex;gap:3px;align-items:flex-end;height:90px;border-bottom:1px solid #e2e8f0}.au-spark div{flex:1;height:100%;display:flex;align-items:flex-end;min-width:0}.au-spark i{display:block;width:100%;background:${TEAL};border-radius:3px 3px 0 0;min-height:2px}
.au-spark-ax{display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;font-weight:700;margin-top:4px}
.au-ent{display:flex;flex-direction:column;gap:6px}.au-ent button{display:flex;justify-content:space-between;align-items:center;border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.au-ent button.on{background:${NAVY};color:#fff;border-color:${NAVY}}.au-ent b{font-size:13px}
.au-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;text-align:center;color:#64748b}.au-empty b{color:${NAVY};font-size:15px}
.au-list{display:flex;flex-direction:column;gap:8px}
.au-row{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-inline-start:4px solid #cbd5e1}.au-row.INSERT{border-inline-start-color:#059669}.au-row.UPDATE{border-inline-start-color:#2563eb}.au-row.DELETE{border-inline-start-color:#dc2626}
.au-row-main{width:100%;display:grid;grid-template-columns:auto 1fr auto auto;gap:12px;align-items:center;background:#fff;border:0;padding:10px 14px;font:inherit;text-align:start;cursor:pointer;color:inherit}.au-row-main:hover{background:#f8fafc}
.au-act{font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;background:#f1f5f9;color:#475569;white-space:nowrap}.au-act.INSERT{background:#ecfdf5;color:#047857}.au-act.UPDATE{background:#eff6ff;color:#1d4ed8}.au-act.DELETE{background:#fef2f2;color:#b91c1c}
.au-desc{font-size:13.5px;font-weight:800;color:#0f172a;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.au-meta{font-size:11.5px;color:#64748b;font-weight:700;white-space:nowrap}
.au-detail{border-top:1px solid #e2e8f0;background:#f8fafc;padding:12px 14px}.au-detail-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#475569;margin-bottom:10px}.au-detail code{font-size:11px;background:#e2e8f0;border-radius:6px;padding:1px 6px}
.au-table{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.au-table th{background:#f1f5f9;color:#475569;font-size:11.5px;text-align:start;padding:7px 10px}.au-table td{padding:7px 10px;border-top:1px solid #f1f5f9;vertical-align:top;word-break:break-word}.au-table td small{display:block;color:#94a3b8;font-size:10.5px;font-family:monospace}.au-table td.from{color:#b91c1c;text-decoration:line-through;text-decoration-color:#fca5a5}.au-table td.to{color:#047857;font-weight:800}
.au-raw{margin-top:10px;font-size:12px}.au-raw pre{background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;overflow:auto;font-size:11px;direction:ltr;text-align:left;max-height:260px}
.au-more{text-align:center;margin-top:12px}.au-foot{color:#94a3b8;font-size:11.5px;font-weight:700;text-align:center;padding:6px}
@media print{.au{padding:0;background:#fff}.au-noprint{display:none!important}.global-nav{display:none!important}.au-desc{white-space:normal}}
@media(max-width:980px){.au{padding:12px}.au-kpis{grid-template-columns:repeat(3,1fr)}.au-filters{grid-template-columns:1fr 1fr}.au-filters .au-grow{grid-column:span 2}.au-grid2{grid-template-columns:1fr}.au-row-main{grid-template-columns:auto 1fr;gap:6px 10px}.au-desc{white-space:normal}.au-meta{grid-column:1/-1}.au-row-main>svg{display:none}}
`;
