'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/diplomas — «الدبلومات: التوأمة والخروج» (هـ-1/5)
 *  (1) اختيار الدبلوم  (2) المقرّرات ⇄ البرامج: ربط كل مقرّر ببرنامج من الكتالوج (إتمامه يُحتسب)  (3) المقيَّدون: سلّم المستويات · إشارة مبكرة · «لو خرج اليوم يحمل» · تسجيل خروج/عودة
 *  (4) مصفوفة الإتمام: المتدرّب × المقرّر (آلي من الحضور/الشهادات، أو بلمسة من الطاقم)
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { REASONS, LEVEL_WORD } from '../../../lib/diploma/exit';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST']; const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const arN = (n: number) => new Intl.NumberFormat('ar-EG').format(n);
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATE_AR: Record<string, string> = { enrolled: 'مسجَّل', active: 'نشط', exited: 'خارج', returned: 'عائد', graduate: 'خرّيج' };

export default function DiplomasPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [role, setRole] = useState(''); const [tok, setTok] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [lists, setLists] = useState<{ diplomas: any[]; programs: any[] }>({ diplomas: [], programs: [] }); const [pid, setPid] = useState(''); const [d, setD] = useState<any>(null);
  const [tab, setTab] = useState<'people' | 'units' | 'matrix'>('people'); const [exitFor, setExitFor] = useState<any>(null); const [code, setCode] = useState(''); const [why, setWhy] = useState(''); const [filter, setFilter] = useState<'all' | 'risk' | 'exited'>('all');
  const canWrite = WRITERS.includes(role);
  const H = (t = tok) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });
  async function load(p = pid, t = tok) { if (!p) return; const j = await fetch(`/api/diploma/exit?program=${encodeURIComponent(p)}`, { headers: H(t), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر التحميل'); }
  async function post(body: any) { setBusy(body.action + (body.unit_id || body.enrollment_id || '')); setErr(''); setOk(''); const j = await fetch('/api/diploma/exit', { method: 'POST', headers: H(), body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return null; } return j; }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/diplomas'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); const r = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(r)) { router.replace('/dashboard'); return; } setRole(r);
    const { data: s } = await db.auth.getSession(); const t = s.session?.access_token || ''; setTok(t);
    const j = await fetch('/api/diploma/exit?programs=1', { headers: H(t), cache: 'no-store' }).then((x) => x.json()).catch(() => null); if (j?.success) { setLists({ diplomas: j.diplomas, programs: j.programs }); const first = new URLSearchParams(window.location.search).get('program') || j.diplomas[0]?.id || ''; if (first) { setPid(first); await load(first, t); } }
    setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rows: any[] = d?.rows || []; const units: any[] = d?.units || [];
  const shown = rows.filter((r) => filter === 'all' ? true : filter === 'risk' ? r.risk.level !== 'none' && r.state !== 'exited' : r.state === 'exited');
  const kpi = { n: rows.length, risk: rows.filter((r) => r.risk.level !== 'none' && r.state !== 'exited').length, exited: rows.filter((r) => r.state === 'exited').length, grads: rows.filter((r) => r.state === 'graduate').length, linked: units.filter((u) => u.linked_program_id).length };
  if (!ready) return <div className="dp"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="dp-wrap"><div className="dp-card">{err || 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="dp" data-testid="diplomas-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="dp-wrap">
        <header className="dp-head"><div><span className="dp-kicker"><Icon name="award" size={14} /> بوابة أَثَر · هـ-1/5</span><h1>الدبلومات — التوأمة والخروج</h1><p>الدبلوم مسارٌ من برامج: كلّ مقرّر وحدة تُحتسب، ومن يخرج يحمل شهادات ما أتمّ وسجلّ إنجاز موقَّعًا — ويعود خلال ٢٤ شهرًا من حيث توقّف. «لا انسحاب بلا شيء».</p></div></header>
        <PortalAdminTabs counts={{ '/admin/diplomas': kpi.risk }} />
        {err && <div className="dp-err" role="alert">{err}</div>}{ok && <div className="dp-ok" role="status">{ok}</div>}
        <div className="dp-bar">
          <label>الدبلوم <select value={pid} onChange={async (e) => { setPid(e.target.value); setD(null); await load(e.target.value); }} data-testid="dp-prog">{!lists.diplomas.length && <option value="">— لا دبلومات (program_type = diploma) —</option>}{lists.diplomas.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
          <nav className="dp-tabs" role="tablist"><button role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>المقيَّدون <i>{kpi.n}</i></button><button role="tab" aria-selected={tab === 'units'} className={tab === 'units' ? 'on' : ''} onClick={() => setTab('units')} data-testid="dp-tab-units">المقرّرات ⇄ البرامج <i>{kpi.linked}/{units.length}</i></button><button role="tab" aria-selected={tab === 'matrix'} className={tab === 'matrix' ? 'on' : ''} onClick={() => setTab('matrix')} data-testid="dp-tab-matrix">مصفوفة الإتمام</button></nav>
          {canWrite && pid && <button type="button" className="dp-btn ghost" disabled={!!busy} onClick={async () => { const j = await post({ action: 'auto', program_id: pid }); if (j) { setOk(`فُحص ${arN(j.checked)} خانة وأُضيف ${arN(j.added)} إتمامًا آليًّا`); await load(); } }} data-testid="dp-auto"><Icon name="refresh" size={14} /> الإتمام الآلي من الحضور والشهادات</button>}
        </div>
        {d && <div className="dp-kpis"><span><b>{arN(kpi.n)}</b> مقيَّدًا</span><span className={kpi.risk ? 'warn' : ''}><b>{arN(kpi.risk)}</b> إشارة مبكرة</span><span><b>{arN(kpi.exited)}</b> خارج</span><span className="g"><b>{arN(kpi.grads)}</b> خرّيج</span><span><b>{arN(units.length)}</b> مقرّرًا في {arN(new Set(units.filter((u) => u.level_no).map((u) => u.level_no)).size)} مستويات</span></div>}

        {tab === 'people' && d && <div className="dp-card">
          <div className="dp-filters">{(['all', 'risk', 'exited'] as const).map((f) => <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{{ all: 'الكلّ', risk: 'يقتربون من الخروج', exited: 'خارجون' }[f]}</button>)}</div>
          {!shown.length && <p className="dp-muted" data-testid="dp-empty">لا أحد هنا.</p>}
          <table className="dp-table"><thead><tr><th>المتدرّب</th><th>السلّم</th><th>الإشارة المبكرة</th><th>لو خرج اليوم يحمل</th><th>الحالة</th>{canWrite && <th />}</tr></thead><tbody>
            {shown.map((r) => <tr key={r.enrollment_id} data-testid="dp-row" data-state={r.state} className={r.risk.level}>
              <td><b>{r.full_name}</b><div className="dp-muted" dir="ltr">{r.email}</div></td>
              <td><ol className="dp-ladder">{r.carry.levels.filter((l: any) => l.level_no > 0).map((l: any) => <li key={l.level_no} className={l.complete ? 'done' : l.done ? 'now' : ''} title={`${l.title}: ${l.done}/${l.total}`}>{arN(l.level_no)}</li>)}</ol><small className="dp-muted">{arN(r.carry.unitsDone)}/{arN(r.carry.unitsTotal)} مقرّر · {arN(Math.round(r.carry.hours))} س</small></td>
              <td><span className={`dp-risk ${r.risk.level}`}>{r.risk.level === 'high' ? '●' : r.risk.level === 'watch' ? '◐' : '○'}</span> <small>{r.risk.line_ar}</small></td>
              <td><small>{r.carry.certificates.length ? `${arN(r.carry.certificates.length)} شهادة مستوى` : 'سجلّ بداية'}{r.carry.unitsDone ? ` + سجلّ إنجاز (${arN(r.carry.unitsDone)} مقرّر)` : ''}</small>{r.exit && <div className="dp-muted">خرج {fmt(r.exit.exited_at)} · يعود حتى {fmt(r.exit.return_by)}{r.exit.record_code && <> · <a href={`/credential/${r.exit.record_code}`} target="_blank" rel="noreferrer">السجلّ</a></>}</div>}</td>
              <td><b className={`dp-state ${r.state}`}>{STATE_AR[r.state]}</b></td>
              {canWrite && <td className="dp-ops">{r.canExit && <button type="button" onClick={() => { setExitFor(r); setCode(''); setWhy(''); }} data-testid="dp-exit">تسجيل خروج</button>}{r.canReturn && <button type="button" disabled={!!busy} onClick={async () => { const j = await post({ action: 'return', enrollment_id: r.enrollment_id }); if (j) { setOk('سُجّلت العودة'); await load(); } }} data-testid="dp-return">عودة</button>}</td>}
            </tr>)}
          </tbody></table>
          {exitFor && <div className="dp-modal" role="dialog" aria-modal="true" data-testid="dp-exit-dialog"><div className="dp-dialog">
            <h3>تسجيل خروج — {exitFor.full_name}</h3>
            <p>{exitFor.carry.line_ar}</p>
            <div className="dp-reasons">{REASONS.map((x) => <button key={x.code} type="button" className={code === x.code ? 'on' : ''} onClick={() => setCode(code === x.code ? '' : x.code)}>{x.ar}</button>)}</div>
            <textarea value={why} onChange={(e) => setWhy(e.target.value.slice(0, 300))} rows={2} placeholder="ملاحظة (اختياري)…" />
            <div className="dp-acts"><button type="button" className="dp-btn danger" disabled={!!busy} onClick={async () => { const j = await post({ action: 'exit', enrollment_id: exitFor.enrollment_id, reason_code: code || null, reason: why || null }); if (j) { setOk(`سُجّل الخروج وأُصدرت ${arN(j.issued)} وثيقة موقَّعة${j.record_code ? ` — سجلّ الإنجاز ${j.record_code}` : ''}`); setExitFor(null); await load(); } }} data-testid="dp-exit-confirm">{busy ? 'نُصدر…' : 'أخرجه بشهادات ما أتمّ'}</button><button type="button" className="dp-btn ghost" onClick={() => setExitFor(null)}>إلغاء</button></div>
          </div></div>}
        </div>}

        {tab === 'units' && d && <div className="dp-card">
          <p className="dp-muted">اربط كلّ مقرّر ببرنامج مسجَّل في الكتالوج بمعرّفه — فمن يحمل شهادة إتمام ذلك البرنامج يُحتسب له المقرّر هنا (اعتراف بالتعلّم السابق)، ومن يتمّ المقرّر هنا تُحتسب له في أيّ دبلوم آخر يحتويه.</p>
          {!units.length && <p className="dp-muted">لا مقرّرات بعد — تُنشأ من «هيكل الدبلوم».</p>}
          <table className="dp-table"><thead><tr><th>المستوى</th><th>المقرّر</th><th>الساعات</th><th>البرنامج المرتبط</th></tr></thead><tbody>
            {units.map((u) => <tr key={u.id} data-testid="dp-unit">
              <td>{u.level_no ? `المستوى ${LEVEL_WORD[u.level_no] || arN(u.level_no)}` : '—'}</td><td><b>{u.title_ar}</b>{u.closed_at && <small className="dp-muted"> · مغلق</small>}</td><td>{arN(Number(u.hours || 0))}</td>
              <td>{canWrite ? <select value={u.linked_program_id || ''} disabled={!!busy} onChange={async (e) => { const j = await post({ action: 'link', program_id: pid, unit_id: u.id, linked_program_id: e.target.value || null }); if (j) { setOk('حُفظ الربط'); await load(); } }} data-testid="dp-link"><option value="">— غير مرتبط —</option>{lists.programs.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select> : <span>{lists.programs.find((p) => p.id === u.linked_program_id)?.name_ar || '—'}</span>}</td>
            </tr>)}
          </tbody></table>
        </div>}

        {tab === 'matrix' && d && <div className="dp-card dp-scroll">
          <p className="dp-muted">✓ متمّ (آلي: حضور ≥ ٧٥٪ بعد إغلاق المقرّر، أو شهادة برنامج مرتبط) · ✎ قرار يدوي · انقر الخانة لتبديلها.</p>
          <table className="dp-table dp-matrix"><thead><tr><th>المتدرّب</th>{units.map((u) => <th key={u.id} title={u.title_ar}><small>{u.level_no ? `م${arN(u.level_no)}` : ''}</small><br />{u.title_ar.slice(0, 14)}</th>)}</tr></thead><tbody>
            {rows.map((r) => <tr key={r.enrollment_id}><td><b>{r.full_name}</b></td>{units.map((u) => { const c = r.completions.find((x: any) => x.unit_id === u.id); const done = c?.status === 'done'; return <td key={u.id} className={done ? 'done' : ''}>{canWrite ? <button type="button" className="dp-cell" disabled={!!busy} title={c ? `${c.source === 'attendance' ? `حضور ${c.attendance_pct ?? ''}٪` : c.source === 'credential' ? 'شهادة برنامج مرتبط' : 'يدوي'}` : 'لم يُقرَّر'} onClick={async () => { const j = await post({ action: 'complete', program_id: pid, unit_id: u.id, email: r.email, done: !done }); if (j) await load(); }} data-testid="dp-cell">{done ? (c?.source === 'manual' ? '✎' : '✓') : c ? '✗' : '·'}</button> : <span>{done ? '✓' : '·'}</span>}</td>; })}</tr>)}
          </tbody></table>
        </div>}
      </div>
    </div>
  );
}

const CSS = `
.dp{min-height:100vh;background:#FBF4EE;font-family:'Noto Kufi Arabic','IBM Plex Sans Arabic',system-ui,sans-serif;direction:rtl;color:#2A1626}
.dp-wrap{max-width:1180px;margin:0 auto;padding:26px 18px 60px}
.dp-head h1{margin:4px 0 6px;font-size:28px;color:#3A1F36}.dp-head p{margin:0 0 14px;color:#5C4858;font-size:14px;max-width:760px}
.dp-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#8A5A1E}
.dp-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:14px 0}.dp-bar label{font-size:12.5px;font-weight:800;color:#5C4858;display:flex;gap:8px;align-items:center}.dp-bar select{border:1px solid #EADFD6;border-radius:10px;padding:7px 10px;font:inherit;font-size:13.5px;background:#fff;min-width:240px}
.dp-tabs{display:flex;gap:6px}.dp-tabs button{border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;color:#5C4858}.dp-tabs button.on{background:#3A1F36;color:#FBF4EE;border-color:#3A1F36}.dp-tabs i{font-style:normal;opacity:.7;margin-inline-start:4px}
.dp-kpis{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.dp-kpis span{background:#fff;border:1px solid #EADFD6;border-radius:12px;padding:8px 12px;font-size:12.5px;color:#5C4858}.dp-kpis b{font-size:18px;color:#3A1F36;margin-inline-end:4px}.dp-kpis span.warn b{color:#D4614A}.dp-kpis span.g b{color:#3F7F79}
.dp-card{background:#fff;border:1px solid #EADFD6;border-radius:18px;padding:16px 18px;box-shadow:0 10px 28px rgba(42,22,38,.05)}.dp-scroll{overflow-x:auto}
.dp-filters{display:flex;gap:6px;margin-bottom:10px}.dp-filters button{border:1px solid #EADFD6;background:#FBF4EE;border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;font-weight:800;color:#5C4858;cursor:pointer}.dp-filters button.on{background:#D4614A;color:#fff;border-color:#D4614A}
.dp-table{width:100%;border-collapse:collapse;font-size:13.5px}.dp-table th{text-align:right;font-size:12px;color:#8C7A86;font-weight:800;padding:6px;border-bottom:1px solid #EADFD6}.dp-table td{padding:10px 6px;border-top:1px solid #F3E9E1;vertical-align:top}
.dp-table tr.high td:first-child{box-shadow:inset 4px 0 0 #D4614A}.dp-table tr.watch td:first-child{box-shadow:inset 4px 0 0 #D9A866}
.dp-muted{color:#8C7A86;font-size:12.5px}
.dp-ladder{list-style:none;margin:0 0 2px;padding:0;display:flex;gap:4px}.dp-ladder li{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900;background:#E8DCD2;color:#8C7A86}.dp-ladder li.done{background:#D9A866;color:#2A1626}.dp-ladder li.now{background:#D4614A;color:#fff}
.dp-risk{font-size:14px}.dp-risk.high{color:#D4614A}.dp-risk.watch{color:#D9A866}.dp-risk.none{color:#9FD8D1}
.dp-state{font-size:11.5px;border-radius:999px;padding:3px 10px;background:#F6EBE0;color:#3A1F36}.dp-state.exited{background:#D9A866;color:#2A1626}.dp-state.graduate{background:#3A1F36;color:#FBF4EE}.dp-state.returned{background:#9FD8D1;color:#1f4f4a}
.dp-ops{white-space:nowrap}.dp-ops button{border:1px solid #EADFD6;background:#fff;border-radius:8px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer;margin-inline-start:4px}
.dp-btn{border:0;border-radius:999px;padding:8px 16px;font:inherit;font-weight:900;font-size:13px;cursor:pointer;background:#D9A866;color:#2A1626;display:inline-flex;gap:6px;align-items:center}.dp-btn.ghost{background:#fff;color:#5C4858;border:1px solid #EADFD6}.dp-btn.danger{background:#D4614A;color:#fff}.dp-btn:disabled{opacity:.6}
.dp-err{background:#fdecea;color:#B03A2E;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700}.dp-ok{background:#ecfdf5;color:#065f46;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700}
.dp-modal{position:fixed;inset:0;background:rgba(34,16,31,.55);display:grid;place-items:center;z-index:50;padding:16px}.dp-dialog{background:#fff;border-radius:18px;padding:18px 20px;max-width:520px;width:100%;display:grid;gap:10px}.dp-dialog h3{margin:0;color:#3A1F36}.dp-dialog p{margin:0;font-size:13.5px;line-height:1.7}
.dp-reasons{display:flex;flex-wrap:wrap;gap:6px}.dp-reasons button{border:1px solid #EADFD6;background:#FBF4EE;border-radius:999px;padding:4px 11px;font:inherit;font-size:12.5px;font-weight:700;color:#5C4858;cursor:pointer}.dp-reasons button.on{background:#3A1F36;color:#FBF4EE;border-color:#3A1F36}
.dp-dialog textarea{border:1px solid #EADFD6;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px}.dp-acts{display:flex;gap:8px}
.dp-matrix th{white-space:nowrap;font-size:11px}.dp-matrix td{text-align:center;padding:4px}.dp-matrix td.done{background:#FFF8EC}.dp-cell{width:30px;height:30px;border:1px solid #EADFD6;border-radius:8px;background:#fff;font:inherit;font-size:14px;cursor:pointer;color:#8C7A86}.dp-matrix td.done .dp-cell{background:#D9A866;color:#2A1626;border-color:#D9A866}
`;
