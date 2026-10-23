'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadXlsx, buildXlsx } from '../../../lib/export/xlsx';
import { CATALOG, scopeToProgram, counts, totalRows, buildSheets, manifest, jsonPayload, backupFilename, backupStatus, daysSince, archiveCandidates, splitArchive, tableLabel } from '../../../lib/backup/model';
import type { Dataset, ArchivableProgram, BackupStatus } from '../../../lib/backup/model';
import { parseBackup, restorePlan, chunk, emptyResult, summarize, strategyLabel } from '../../../lib/backup/restore';
import type { ParsedBackup, Strategy, TableResult } from '../../../lib/backup/restore';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const RESTORERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN'];
type Tab = 'backup' | 'archive' | 'restore' | 'log';
type LogRow = { id: string; created_at: string; actor_name: string | null; format: string; scope_label: string | null; total_rows: number; bytes: number; tables: Record<string, number> };

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export default function BackupPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [me, setMe] = useState<{ id: string; email: string; role: string; name: string }>({ id: '', email: '', role: '', name: '' });
  const [tab, setTab] = useState<Tab>('backup');
  const [programs, setPrograms] = useState<ArchivableProgram[]>([]);
  const [log, setLog] = useState<LogRow[]>([]); const [logErr, setLogErr] = useState('');
  const [scope, setScope] = useState('all');
  const [data, setData] = useState<Dataset | null>(null); const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(''); const [archiving, setArchiving] = useState('');
  const canWrite = ADMINS.includes(me.role);
  const canRestore = RESTORERS.includes(me.role);
  // الاستعادة
  const [parsed, setParsed] = useState<ParsedBackup | null>(null); const [fileName, setFileName] = useState('');
  const [selTables, setSelTables] = useState<string[]>([]); const [strategy, setStrategy] = useState<Strategy>('add');
  const [results, setResults] = useState<TableResult[]>([]); const [checked, setChecked] = useState(false); const [confirmWord, setConfirmWord] = useState('');
  const [progress, setProgress] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  async function loadMeta() {
    const [p, l] = await Promise.all([
      db.from('programs').select('id,name_ar,status,end_date,archived_at').order('end_date', { ascending: false }),
      db.from('backup_log').select('id,created_at,actor_name,format,scope_label,total_rows,bytes,tables').order('created_at', { ascending: false }).limit(30),
    ]);
    if (p.error) setError(p.error.message.includes('archived_at') ? 'عمود الأرشفة غير موجود بعد — نفّذ ملف SQL الخاص بهذه المرحلة أولًا.' : p.error.message);
    setPrograms((p.data || []) as any[]);
    if (l.error) setLogErr(l.error.message); else setLog((l.data || []) as any[]);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/backup'); return; }
      const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', user.id).single();
      const role = String((prof as any)?.role || '').toUpperCase();
      if (!STAFF.includes(role)) { router.replace('/dashboard'); return; }
      setMe({ id: user.id, email: user.email || '', role, name: (prof as any)?.full_name || user.email || '' });
      await loadMeta();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const split = useMemo(() => splitArchive(programs), [programs]);
  const candidates = useMemo(() => archiveCandidates(programs, today), [programs, today]);
  const lastBackup = log[0] || null;
  const status: BackupStatus = backupStatus(lastBackup?.created_at || null, programs.length > 0);
  const scopeLabel = scope === 'all' ? 'كل البيانات' : (programs.find(p => p.id === scope)?.name_ar || 'برنامج');

  /** تحميل كل الجداول (مرة واحدة) ثم تقييدها بالنطاق */
  async function loadAll(): Promise<Dataset | null> {
    if (data) return data;
    setBusy('جارٍ تحميل الجداول…');
    const out: Dataset = {}; const miss: string[] = [];
    await Promise.all(CATALOG.map(async spec => {
      try {
        let q: any = db.from(spec.table).select('*').limit(100000);
        if (spec.order) q = q.order(spec.order, { ascending: true });
        const { data: rows, error: e } = await q;
        if (e) { miss.push(`${spec.label}: ${e.message}`); out[spec.table] = []; } else out[spec.table] = (rows || []) as any[];
      } catch (e: any) { miss.push(`${spec.label}: ${e?.message || e}`); out[spec.table] = []; }
    }));
    setData(out); setMissing(miss); setBusy('');
    return out;
  }

  async function record(format: 'xlsx' | 'json', ds: Dataset, bytes: number) {
    const row = { actor_id: me.id, actor_name: me.name, format, scope: scope === 'all' ? 'all' : `program:${scope}`, scope_label: scopeLabel, tables: counts(ds), total_rows: totalRows(ds), bytes, app_version: 'K2' };
    const { error: e } = await db.from('backup_log').insert(row as any);
    if (e) setNotice(`تم التنزيل، لكن تعذّر تسجيله في السجل: ${e.message}`); else { setNotice(`تم إنشاء النسخة (${format.toUpperCase()}) — ${row.total_rows} صفًا · ${fmtBytes(bytes)}`); await loadMeta(); }
  }

  async function exportXlsx() {
    setNotice(''); const all = await loadAll(); if (!all) return;
    setBusy('جارٍ بناء ملف Excel…');
    try {
      const ds = scope === 'all' ? all : scopeToProgram(all, scope);
      const m = manifest(ds, scope === 'all' ? 'all' : `program:${scope}`, scopeLabel);
      const sheets = buildSheets(ds, m);
      const bytes = buildXlsx(sheets).length;
      downloadXlsx(backupFilename(scope === 'all' ? 'all' : scopeLabel, 'xlsx'), sheets);
      await record('xlsx', ds, bytes);
    } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(''); }
  }

  async function exportJson() {
    setNotice(''); const all = await loadAll(); if (!all) return;
    setBusy('جارٍ بناء ملف JSON…');
    try {
      const ds = scope === 'all' ? all : scopeToProgram(all, scope);
      const m = manifest(ds, scope === 'all' ? 'all' : `program:${scope}`, scopeLabel);
      const text = jsonPayload(ds, m);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = backupFilename(scope === 'all' ? 'all' : scopeLabel, 'json'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      await record('json', ds, blob.size);
    } catch (e: any) { setError(e?.message || String(e)); } finally { setBusy(''); }
  }

  async function setArchived(p: ArchivableProgram, archive: boolean) {
    if (!canWrite) return;
    const msg = archive ? `أرشفة «${p.name_ar}»؟\nسيختفي من الاستمارات العامة ومن قائمة الجاهزية، ويبقى في التقارير التاريخية. يمكن التراجع في أي وقت.` : `إلغاء أرشفة «${p.name_ar}»؟`;
    if (!window.confirm(msg)) return;
    setArchiving(p.id); setNotice('');
    const patch = archive ? { archived_at: new Date().toISOString(), archived_by: me.id } : { archived_at: null, archived_by: null };
    const { error: e } = await db.from('programs').update(patch as any).eq('id', p.id);
    if (e) setError(e.message); else { setNotice(archive ? `تمت أرشفة «${p.name_ar}»` : `أُلغيت أرشفة «${p.name_ar}»`); setData(null); await loadMeta(); }
    setArchiving('');
  }

  async function onFile(f: File | null) {
    setParsed(null); setResults([]); setChecked(false); setConfirmWord(''); setError('');
    if (!f) return;
    if (f.size > 60 * 1024 * 1024) { setError('الملف أكبر من 60 MB — قسّم النسخة حسب البرنامج'); return; }
    try { const text = await f.text(); const pb = parseBackup(text); setParsed(pb); setFileName(f.name); setSelTables(pb.tables.map(t => t.table)); }
    catch (e: any) { setError(e?.message || String(e)); }
  }

  async function token(): Promise<string> { const { data } = await db.auth.getSession(); return data.session?.access_token || ''; }

  async function runRestore(mode: 'dry' | Strategy) {
    if (!parsed) return;
    const plan = restorePlan(parsed, selTables); if (!plan.length) { setError('لم تُختر جداول تحوي صفوفًا'); return; }
    setBusy(mode === 'dry' ? 'جارٍ فحص النسخة مقابل قاعدة البيانات…' : 'جارٍ الاستعادة…'); setError(''); setNotice('');
    const tk = await token(); const out: TableResult[] = [];
    for (const t of plan) {
      const r = emptyResult(t.table, t.label, t.rows.length); out.push(r); setResults([...out]);
      const parts = chunk(t.rows); let i = 0;
      for (const part of parts) {
        i++; setProgress(`${t.label}: دفعة ${i}/${parts.length}`);
        try {
          const res = await fetch('/api/admin/restore', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ table: t.table, rows: part, mode }) });
          const j = await res.json();
          if (!res.ok || !j.success) { r.failed += part.length; r.error = j.error || `HTTP ${res.status}`; break; }
          r.existing += Number(j.existing || 0); r.inserted += Number(j.inserted || 0); r.updated += Number(j.updated || 0); r.skipped += Number(j.skipped || 0);
        } catch (e: any) { r.failed += part.length; r.error = e?.message || String(e); break; }
        setResults([...out]);
      }
    }
    setResults([...out]); setProgress(''); setBusy('');
    const sum = summarize(out);
    if (mode === 'dry') { setChecked(true); setNotice(`الفحص اكتمل: ${sum.total} صفًا في ${sum.tables} جدولًا — ${sum.total - out.reduce((a, r) => a + r.existing, 0)} جديد · ${out.reduce((a, r) => a + r.existing, 0)} موجود مسبقًا${sum.failed ? ` · ${sum.failed} تعذّر فحصه` : ''}`); }
    else {
      setNotice(`الاستعادة اكتملت: ${sum.inserted} صف أُضيف · ${sum.updated} حُدّث · ${sum.skipped} تُرك كما هو${sum.failed ? ` · ${sum.failed} فشل` : ''}`);
      try { await fetch('/api/admin/restore', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ log: { file: fileName, strategy: mode, ...sum, tables: out.map(r => ({ table: r.table, inserted: r.inserted, updated: r.updated, skipped: r.skipped, failed: r.failed })) } }) }); } catch { /* اختياري */ }
      setConfirmWord(''); setChecked(false); setData(null); await loadMeta();
    }
  }

  if (!ready) return <div className="bk" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const scoped = data ? (scope === 'all' ? data : scopeToProgram(data, scope)) : null;
  const scopedCounts = scoped ? counts(scoped) : null;

  return (
    <div className="bk" dir="rtl">
      <style>{CSS}</style>
      <header className="bk-head">
        <div>
          <div className="bk-kicker"><Icon name="save" size={14} /> الاستدامة · النسخ الاحتياطي والأرشفة</div>
          <h1>نسخة شاملة من بياناتك — وأرشفة منظّمة للبرامج المنتهية</h1>
          <p>صدّر كل الجداول في ملف Excel واحد (ورقة لكل جدول + ورقة «الإجابات المفكوكة» الجاهزة للتحليل) أو ملف JSON كامل للاستعادة. أرشِف البرامج القديمة لتختفي من الاستمارات والجاهزية مع بقائها في التقارير التاريخية. كل عملية تُسجَّل في سجل التدقيق.</p>
        </div>
        <nav className="bk-nav">
          <Link href="/dashboard" className="bk-btn"><Icon name="home" size={16} /> اللوحة</Link>
          <Link href="/admin/health" className="bk-btn"><Icon name="check" size={16} /> صحة المنصة</Link>
          <Link href="/help#backup" className="bk-btn"><Icon name="question" size={16} /> الدليل</Link>
        </nav>
      </header>

      {error && <div className="bk-alert">{error} <button className="bk-x" onClick={() => setError('')}>×</button></div>}
      {notice && <div className="bk-notice">{notice} <button className="bk-x" onClick={() => setNotice('')}>×</button></div>}

      <section className="bk-kpis">
        <div className={`bk-kpi ${status.status === 'ok' ? 'ok' : status.status === 'warn' ? 'warn' : ''}`}><b>{status.days == null ? '—' : status.days}</b><span>يومًا منذ آخر نسخة</span><small>{status.label}</small></div>
        <div className="bk-kpi"><b>{log.length}</b><span>نسخة مسجّلة</span><small>{lastBackup ? `آخرها ${lastBackup.format.toUpperCase()} · ${fmtDate(lastBackup.created_at)}` : 'لا يوجد بعد'}</small></div>
        <div className="bk-kpi"><b>{split.active.length}</b><span>برنامج نشط</span><small>{candidates.length ? `${candidates.length} مرشح للأرشفة` : 'لا مرشحين للأرشفة'}</small></div>
        <div className="bk-kpi"><b>{split.archived.length}</b><span>برنامج مؤرشف</span><small>مخفي من الاستمارات والجاهزية</small></div>
      </section>

      <div className="bk-tabs" role="tablist">
        <button className={`bk-tab ${tab === 'backup' ? 'on' : ''}`} onClick={() => setTab('backup')}><Icon name="download" size={15} /> النسخ الاحتياطي</button>
        <button className={`bk-tab ${tab === 'archive' ? 'on' : ''}`} onClick={() => setTab('archive')}><Icon name="folder" size={15} /> الأرشفة {candidates.length ? <i className="bk-badge">{candidates.length}</i> : null}</button>
        <button className={`bk-tab ${tab === 'restore' ? 'on' : ''}`} onClick={() => setTab('restore')}><Icon name="refresh" size={15} /> الاستعادة</button>
        <button className={`bk-tab ${tab === 'log' ? 'on' : ''}`} onClick={() => setTab('log')}><Icon name="clock" size={15} /> السجل</button>
      </div>

      {tab === 'backup' && (
        <section className="bk-card">
          <div className="bk-card-head"><h2><Icon name="download" size={18} /> إنشاء نسخة</h2><span>تُبنى الملفات داخل متصفحك وتُحفظ على جهازك — لا تمر عبر أي خادم خارجي</span></div>
          <div className="bk-form">
            <label>النطاق
              <select value={scope} onChange={e => setScope(e.target.value)}>
                <option value="all">كل البيانات (شامل المؤرشف)</option>
                <optgroup label="برنامج واحد">
                  {programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}{p.archived_at ? ' (مؤرشف)' : ''}</option>)}
                </optgroup>
              </select>
            </label>
            <div className="bk-actions">
              <button className="bk-btn primary" disabled={!!busy || !canWrite} onClick={exportXlsx}><Icon name="table" size={16} /> Excel (ورقة لكل جدول)</button>
              <button className="bk-btn" disabled={!!busy || !canWrite} onClick={exportJson}><Icon name="doc" size={16} /> JSON (كامل للاستعادة)</button>
              <button className="bk-btn small" disabled={!!busy} onClick={() => loadAll()}><Icon name="refresh" size={14} /> معاينة الأعداد</button>
            </div>
          </div>
          {!canWrite && <div className="bk-muted">التصدير والأرشفة متاحان لمديري المنصة فقط؛ يمكنك الاطلاع على السجل.</div>}
          {busy && <div className="bk-busy"><Icon name="refresh" size={14} /> {busy}</div>}
          {missing.length > 0 && <div className="bk-muted">جداول تعذّر قراءتها (تُستثنى من النسخة): {missing.join(' · ')}</div>}

          {scopedCounts && (
            <div className="bk-grid">
              {CATALOG.map(spec => <div key={spec.table} className={`bk-tile ${scopedCounts[spec.table] ? '' : 'empty'}`}><b>{scopedCounts[spec.table]}</b><span>{spec.label}</span><small>{spec.table}</small></div>)}
            </div>
          )}
          <div className="bk-how">
            <b>ماذا يحوي الملف؟</b>
            <ul>
              <li><b>Excel:</b> ورقة «الفهرس» (التاريخ، النطاق، عدد صفوف كل جدول) + ورقة «الإجابات المفكوكة» (صف لكل تقييم وعمود لكل سؤال) + ورقة لكل جدول غير فارغ. الأعمدة الحساسة (رموز الجلسات، بصمة المستجيب) غير مضمّنة.</li>
              <li><b>JSON:</b> كل الجداول كما هي في قاعدة البيانات مع ملف فهرس داخلي — مناسب للاستعادة أو النقل.</li>
              <li><b>التذكير:</b> تظهر «آخر نسخة احتياطية» في صحة المنصة، ويصلك تنبيه في الجرس تلقائيًا إن مضى أكثر من 30 يومًا.</li>
            </ul>
          </div>
        </section>
      )}

      {tab === 'archive' && (
        <section className="bk-card">
          <div className="bk-card-head"><h2><Icon name="folder" size={18} /> أرشفة البرامج</h2><span>المؤرشف: يختفي من استمارات التقييم العامة وقائمة الجاهزية، ويبقى في التقارير والبطاقات والتحليلات التاريخية</span></div>
          {candidates.length > 0 && <div className="bk-hint"><Icon name="alert" size={15} /> مرشحون للأرشفة (مكتملون أو انتهوا منذ أكثر من 90 يومًا): {candidates.map(c => c.name_ar).join('، ')}</div>}
          <div className="bk-two">
            <div>
              <h3>نشطة ({split.active.length})</h3>
              <ul className="bk-list">
                {split.active.length === 0 && <li className="bk-empty">لا توجد برامج نشطة</li>}
                {split.active.map(p => {
                  const cand = candidates.some(c => c.id === p.id); const d = p.end_date ? daysSince(p.end_date + 'T00:00:00Z') : null;
                  return (
                    <li key={p.id} className={cand ? 'cand' : ''}>
                      <div className="bk-pinfo"><b>{p.name_ar}</b><small>{String(p.status || '—')} · {p.end_date ? <>{d != null && d > 0 ? 'انتهى' : 'ينتهي'} <bdi>{p.end_date}</bdi>{d != null && d > 0 ? ` (منذ ${d} يومًا)` : ''}</> : 'بلا تاريخ انتهاء'}</small></div>
                      {cand && <span className="bk-tag">مرشح</span>}
                      <button className="bk-btn small" disabled={!canWrite || archiving === p.id} onClick={() => setArchived(p, true)}><Icon name="folder" size={13} /> أرشفة</button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3>مؤرشفة ({split.archived.length})</h3>
              <ul className="bk-list">
                {split.archived.length === 0 && <li className="bk-empty">لا توجد برامج مؤرشفة</li>}
                {split.archived.map(p => (
                  <li key={p.id} className="arch">
                    <div className="bk-pinfo"><b>{p.name_ar}</b><small>أُرشف <bdi>{fmtDate(p.archived_at)}</bdi></small></div>
                    <Link href={`/reports/program?program=${p.id}`} className="bk-link">البطاقة</Link>
                    <button className="bk-btn small" disabled={!canWrite || archiving === p.id} onClick={() => setArchived(p, false)}><Icon name="refresh" size={13} /> إلغاء الأرشفة</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === 'restore' && (
        <section className="bk-card">
          <div className="bk-card-head"><h2><Icon name="refresh" size={18} /> الاستعادة من نسخة JSON</h2><span>ارفع ملف نسخة احتياطية (JSON) → افحصه بلا تغيير → ثم نفّذ. الاستعادة تعمل بصلاحيات الخادم وتُسجَّل كاملة في التدقيق.</span></div>
          {!canRestore && <div className="bk-alert">الاستعادة متاحة لمدير المنصة (PLATFORM_ADMIN / SUPER_ADMIN) فقط.</div>}
          <div className="bk-form">
            <label>ملف النسخة (JSON)
              <input type="file" accept=".json,application/json" disabled={!canRestore} onChange={e => onFile(e.target.files?.[0] || null)} />
            </label>
            <div className="bk-strats">
              <label className="bk-radio"><input type="radio" name="strategy" checked={strategy === 'add'} onChange={() => setStrategy('add')} /> {strategyLabel('add')}</label>
              <label className="bk-radio"><input type="radio" name="strategy" checked={strategy === 'replace'} onChange={() => setStrategy('replace')} /> {strategyLabel('replace')}</label>
            </div>
          </div>
          {parsed && (
            <>
              <div className="bk-manifest">
                <b>{fileName}</b>
                <span>{parsed.manifest ? <>أُنشئت <bdi>{fmtDate(parsed.manifest.generated_at)}</bdi> · النطاق: {parsed.manifest.scope_label} · {parsed.manifest.total_rows} صفًا</> : 'بلا فهرس (manifest) — سيُستعاد ما يُعرف من الجداول'}</span>
                {parsed.warnings.length > 0 && <ul className="bk-warns">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              </div>
              <div className="bk-tsel">
                <div className="bk-tsel-head"><b>الجداول ({selTables.length}/{parsed.tables.length})</b>
                  <button className="bk-link" onClick={() => setSelTables(parsed.tables.map(t => t.table))}>الكل</button>
                  <button className="bk-link muted" onClick={() => setSelTables([])}>لا شيء</button></div>
                <div className="bk-tgrid">
                  {parsed.tables.map(t => <label key={t.table} className={`bk-tcheck ${selTables.includes(t.table) ? 'on' : ''}`}><input type="checkbox" checked={selTables.includes(t.table)} onChange={e => setSelTables(e.target.checked ? [...selTables, t.table] : selTables.filter(x => x !== t.table))} /> <span>{t.label}</span><small>{t.rows}</small></label>)}
                </div>
              </div>
              <div className="bk-actions">
                <button className="bk-btn" disabled={!!busy || !canRestore || !selTables.length} onClick={() => runRestore('dry')}><Icon name="search" size={16} /> فحص بلا تغيير</button>
                <input className="bk-confirm" placeholder="اكتب: استعادة" value={confirmWord} onChange={e => setConfirmWord(e.target.value)} disabled={!checked} />
                <button className="bk-btn primary" disabled={!!busy || !canRestore || !checked || confirmWord.trim() !== 'استعادة'} onClick={() => { if (window.confirm(`تنفيذ الاستعادة؟\nالاستراتيجية: ${strategyLabel(strategy)}`)) runRestore(strategy); }}><Icon name="play" size={16} /> تنفيذ الاستعادة</button>
              </div>
              {busy && <div className="bk-busy"><Icon name="refresh" size={14} /> {busy} {progress && <small>— {progress}</small>}</div>}
              {results.length > 0 && (
                <div className="bk-tablewrap"><table className="bk-table">
                  <thead><tr><th>الجدول</th><th>في النسخة</th><th>موجود مسبقًا</th><th>أُضيف</th><th>حُدّث</th><th>تُرك</th><th>فشل</th></tr></thead>
                  <tbody>{results.map(r => <tr key={r.table} className={r.failed ? 'bad' : ''}><td>{r.label}<br /><small className="bk-small" dir="ltr">{r.table}</small></td><td>{r.total}</td><td>{r.existing}</td><td>{r.inserted}</td><td>{r.updated}</td><td>{r.skipped}</td><td>{r.failed}{r.error && <div className="bk-err">{r.error}</div>}</td></tr>)}</tbody>
                </table></div>
              )}
            </>
          )}
          <div className="bk-how">
            <b>كيف تعمل الاستعادة؟</b>
            <ul>
              <li>تُرسَل الصفوف على دفعات (400 صف) إلى الخادم الذي يكتبها بصلاحيات الخدمة بترتيب الاعتماديات (البرامج → القاعات → القوالب → التقييمات → الإجابات …).</li>
              <li><b>إضافة الناقص</b>: الصفوف التي لها نفس المعرّف في قاعدة البيانات لا تُمس. <b>استبدال المطابق</b>: تُحدَّث بقيم النسخة.</li>
              <li>لا تُحذف أي بيانات أبدًا. كل تغيير يمرّ عبر محفّزات التدقيق ويُسجَّل ملخّص العملية في سجل التدقيق.</li>
              <li>الاستعادة على مشروع Supabase مختلف تتطلب تنفيذ ملفات SQL للمنصة أولًا (الجداول نفسها).</li>
            </ul>
          </div>
        </section>
      )}

      {tab === 'log' && (
        <section className="bk-card">
          <div className="bk-card-head"><h2><Icon name="clock" size={18} /> سجل النسخ الاحتياطي</h2><span>آخر 30 عملية</span></div>
          {logErr && <div className="bk-muted">تعذّر قراءة السجل ({logErr}) — نفّذ ملف SQL الخاص بهذه المرحلة.</div>}
          {log.length === 0 && !logErr && <div className="bk-empty">لم تُسجَّل أي نسخة بعد — ابدأ من تبويب «النسخ الاحتياطي».</div>}
          {log.length > 0 && (
            <div className="bk-tablewrap"><table className="bk-table">
              <thead><tr><th>التاريخ</th><th>المنفّذ</th><th>الصيغة</th><th>النطاق</th><th>الصفوف</th><th>الحجم</th><th>أكبر الجداول</th></tr></thead>
              <tbody>{log.map(r => {
                const top = Object.entries(r.tables || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 3).map(([t, n]) => `${tableLabel(t)} ${n}`).join(' · ');
                return <tr key={r.id}><td><bdi>{fmtDate(r.created_at)}</bdi></td><td>{r.actor_name || '—'}</td><td><span className={`bk-fmt ${r.format}`}>{r.format.toUpperCase()}</span></td><td>{r.scope_label || '—'}</td><td>{r.total_rows}</td><td>{fmtBytes(Number(r.bytes || 0))}</td><td className="bk-small">{top}</td></tr>;
              })}</tbody>
            </table></div>
          )}
        </section>
      )}
    </div>
  );
}

const CSS = `
.bk{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.bk *{box-sizing:border-box}
.bk-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.bk-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.bk-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.bk-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.bk-nav{display:flex;gap:8px;flex-wrap:wrap}
.bk-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none;white-space:nowrap}.bk-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}.bk-btn.small{padding:6px 10px;font-size:12px}.bk-btn:disabled{opacity:.5;cursor:not-allowed}
.bk-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700;display:flex;justify-content:space-between;gap:10px}
.bk-notice{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700;display:flex;justify-content:space-between;gap:10px}
.bk-x{border:0;background:transparent;font:inherit;font-size:18px;cursor:pointer;color:inherit;line-height:1}
.bk-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.bk-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}.bk-kpi b{display:block;font-size:22px;color:${NAVY}}.bk-kpi span{font-size:12px;font-weight:800;color:#64748b;display:block}.bk-kpi small{display:block;font-size:11.5px;color:#94a3b8;margin-top:2px}.bk-kpi.ok b{color:#047857}.bk-kpi.warn b{color:#b45309}
.bk-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}.bk-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-size:13px;font-weight:800;color:#475569;cursor:pointer}.bk-tab.on{background:${NAVY};border-color:${NAVY};color:#fff}
.bk-badge{font-style:normal;background:#f59e0b;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;font-weight:900}
.bk-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin-bottom:14px}
.bk-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}.bk-card-head h2{margin:0;font-size:16px;color:${NAVY};display:flex;align-items:center;gap:8px}.bk-card-head span{font-size:12px;color:#64748b;font-weight:700;max-width:620px;line-height:1.6}
.bk-card h3{margin:0 0 8px;font-size:14px;color:${NAVY}}
.bk-form{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px}.bk-form label{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:800;color:#475569;min-width:260px}.bk-form select{font:inherit;font-size:13px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a}
.bk-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bk-busy{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:${TEAL};margin:6px 0}
.bk-muted{font-size:12.5px;color:#64748b;margin:6px 0;line-height:1.7}
.bk-hint{display:flex;gap:8px;align-items:flex-start;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;font-weight:700;line-height:1.6}
.bk-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0}.bk-tile{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}.bk-tile b{display:block;font-size:18px;color:${NAVY}}.bk-tile span{display:block;font-size:12px;font-weight:800;color:#475569}.bk-tile small{display:block;font-size:10.5px;color:#94a3b8;direction:ltr;text-align:right}.bk-tile.empty{opacity:.55}
.bk-how{font-size:12.5px;color:#475569;line-height:1.8;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:10px 14px;margin-top:8px}.bk-how ul{margin:4px 0 0;padding-inline-start:18px}
.bk-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.bk-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.bk-list li{display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fff}.bk-list li.cand{border-color:#fed7aa;background:#fffbeb}.bk-list li.arch{background:#f8fafc}
.bk-pinfo{flex:1;min-width:0;display:flex;flex-direction:column}.bk-pinfo b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bk-pinfo small{color:#64748b;font-size:11.5px}
.bk-tag{font-size:11px;font-weight:900;background:#f59e0b;color:#fff;border-radius:999px;padding:2px 8px}
.bk-link{font-size:11.5px;font-weight:900;color:${TEAL};text-decoration:none;border:1px solid #99f6e4;border-radius:7px;padding:4px 8px;background:#f0fdfa;white-space:nowrap}
.bk-empty{text-align:center;padding:18px 10px;color:#64748b;font-size:12.5px;border:1px dashed #e2e8f0;border-radius:12px}
.bk-tablewrap{overflow-x:auto}.bk-table{width:100%;border-collapse:collapse;font-size:12.5px}.bk-table th{text-align:right;background:#f8fafc;color:#475569;font-weight:800;padding:8px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.bk-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}.bk-small{font-size:11.5px;color:#64748b}
.bk-strats{display:flex;flex-direction:column;gap:6px}.bk-radio{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer}
.bk-form input[type=file]{font:inherit;font-size:12.5px;padding:7px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;max-width:100%}
.bk-manifest{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:12.5px}.bk-manifest b{display:block;direction:ltr;text-align:right;color:${NAVY}}.bk-manifest span{color:#475569}.bk-warns{margin:6px 0 0;padding-inline-start:18px;color:#9a3412;font-size:12px}
.bk-tsel{margin:10px 0}.bk-tsel-head{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:13px}.bk-tsel-head .bk-link{border:0;background:transparent;cursor:pointer;font:inherit;font-size:12px;font-weight:900;color:${TEAL}}.bk-tsel-head .bk-link.muted{color:#64748b}
.bk-tgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.bk-tcheck{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:7px 10px;font-size:12.5px;cursor:pointer;background:#fff}.bk-tcheck.on{border-color:${TEAL};background:#f0fdfa}.bk-tcheck span{flex:1}.bk-tcheck small{color:#64748b;font-weight:800}
.bk-confirm{font:inherit;font-size:13px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:10px;width:160px}.bk-confirm:disabled{background:#f1f5f9}
.bk-table tr.bad td{background:#fef2f2}.bk-err{font-size:11.5px;color:#b91c1c;font-weight:700;margin-top:3px}
.bk-fmt{font-size:11px;font-weight:900;border-radius:6px;padding:2px 7px;background:#dcfce7;color:#166534}.bk-fmt.json{background:#dbeafe;color:#1e40af}
@media(max-width:1100px){.bk-grid{grid-template-columns:repeat(3,1fr)}.bk-tgrid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.bk{padding:12px}.bk-kpis{grid-template-columns:repeat(2,1fr)}.bk-two{grid-template-columns:1fr}.bk-grid{grid-template-columns:repeat(2,1fr)}.bk-form label{min-width:100%}.bk-tgrid{grid-template-columns:repeat(2,1fr)}}
`;
