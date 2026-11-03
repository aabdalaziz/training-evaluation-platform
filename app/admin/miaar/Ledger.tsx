'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «سجلّ مِعيار» (م5-أ) — لسان 07 في /admin/miaar/ledger
 *  جدول النتائج بمرشّحاته (مدّة · دعوة · وسم · مستوى · حالة · قرار · بريد) · تحديد متعدّد وشريط إجراءات جماعية
 *  أمام كل متقدّم: قائمة مستوى التسكين (Pre-A1…C2) مملوءة بتوصية مِعيار + برنامج (بمقاعده المتبقية) → [اعتمد] · [البطاقة] · [أرشفة] · [السماح بالإعادة] · [حذف]
 *  «المنطقة الرمادية» ذهبية: قرار يحتاج إنسانًا — لا يُسكَّن تلقائيًّا أبدًا. الحذف فوري بلا سلّة: «صدّر CSV أولًا» ظاهر دائمًا، والجماعي يحتاج كتابة العدد.
 *  «توزيع الشُّعب»: لوحة السعة الحيّة. «سجلّ المتقدّم»: كل محاولاته وأذونه وتسجيلاته في نافذة واحدة.
 */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Decision = { level: string | null; status: string; source: string; program_id: string | null; program_name: string | null; classroom: string | null; decided_at: string | null; gray_reason: string | null; note: string | null };
type Row = { id: string; email: string; name: string; taken_at: string; code: string | null; demonstrated: string; entry: string; percent: number | null; confidence: string; form_code: string | null; invite_id: string | null; invite_label: string | null; group_tag: string | null; archived_at: string | null; previous_report_id: string | null; attempt: number; gray: string | null; decision: Decision | null; deadline_at: string | null; retake_open: boolean };
type Program = { id: string; name_ar: string; cefr_level: string | null; seats: number | null; approved: number; remaining: number | null; open: boolean };
type Section = { id: string; program: string; code: string; name: string; level: string | null; capacity: number; filled: number };
const LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const LV: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const CONF: Record<string, string> = { high: 'عالية', medium: 'متوسطة', border: 'على الحدّ' };
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const hoursLeft = (d: string | null) => (d ? Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 3600_000)) : null);

export default function Ledger({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [f, setF] = useState({ from: '', to: '', invite: '', tag: '', level: '', status: 'active', decision: 'all', q: '' });
  const [rows, setRows] = useState<Row[]>([]); const [counts, setCounts] = useState<any>({}); const [canDelete, setCanDelete] = useState(false); const [auto, setAuto] = useState<{ placed: number; review: number } | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]); const [sections, setSections] = useState<Section[]>([]); const [invites, setInvites] = useState<{ id: string; label_ar: string; hours: number | null; lp: Record<string, string> }[]>([]); const [dl, setDl] = useState<{ off: boolean; hours: string; lp: Record<string, string> } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [pick, setPick] = useState<Record<string, { level: string; program: string }>>({});
  const [bulk, setBulk] = useState({ level: 'each', program: '', tag: '', reason: '', days: '30', note: '' });
  const [history, setHistory] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [showSections, setShowSections] = useState(false);
  const qs = useMemo(() => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v) p.set(k, v); return p.toString(); }, [f]);
  async function load() {
    const j = await fetch(`/api/admin/miaar/ledger?${qs}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!j?.success) { setErr(j?.error || 'تعذّر تحميل السجلّ'); return; }
    setErr(''); setRows(j.rows); setCounts(j.counts); setCanDelete(!!j.can_delete); setAuto(j.auto || null); setSel(new Set());
  }
  async function loadAux() {
    const H = await auth();
    const [p, i] = await Promise.all([fetch('/api/admin/miaar/ledger?programs=1', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null), fetch('/api/admin/miaar', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null)]);
    if (p?.success) { setPrograms(p.programs || []); setSections(p.sections || []); } if (i?.success) setInvites(((i.invites || []) as any[]).map((x) => ({ id: x.id, label_ar: x.label_ar, hours: x.decision_deadline_hours === null ? null : Number(x.decision_deadline_hours ?? 48), lp: (x.level_programs && typeof x.level_programs === 'object' ? x.level_programs : {}) as Record<string, string> })));
  }
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);
  useEffect(() => { const inv = invites.find((x) => x.id === f.invite); setDl(inv ? { off: inv.hours === null, hours: String(inv.hours ?? 48), lp: { ...inv.lp } } : null); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.invite, invites]);
  async function saveDeadline() { if (!dl || !f.invite) return; const j = await post({ action: 'deadline', invite_id: f.invite, hours: dl.off ? null : Number(dl.hours), level_programs: dl.lp }); if (j) await loadAux(); }
  useEffect(() => { void loadAux(); /* الوصول من التقارير/الدعوات بمرشّح جاهز: ?q=بريد · ?invite=معرّف · ?status= */
    try { const sp = new URLSearchParams(window.location.search); const next = { ...f }; let changed = false; for (const k of ['q', 'invite', 'status', 'tag', 'level', 'decision'] as const) { const v = sp.get(k); if (v) { (next as any)[k] = v; changed = true; } } if (changed) setF(next); } catch { /* لا شيء */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(body: Record<string, unknown>, label = '') {
    setBusy(label || String(body.action)); setErr(''); setOk('');
    try { const j = await fetch('/api/admin/miaar/ledger', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر الإجراء'); return null; } await load(); setOk(j.note_ar || 'تم'); return j; }
    catch { setErr('تعذّر الاتصال'); return null; } finally { setBusy(''); }
  }
  const ids = [...sel]; const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pk = (r: Row) => pick[r.id] || { level: r.decision?.level || r.entry, program: r.decision?.program_id || '' };
  async function decideOne(r: Row) { const p = pk(r); await post({ action: 'decide', report_ids: [r.id], level: p.level, program_id: p.program || null }, `decide-${r.id}`); }
  async function delOne(r: Row) { if (!window.confirm(`حذف نتيجة ${r.name} (${r.email}) نهائيًّا؟ لا سلّة محذوفات — الحذف فوري ويُقيَّد في درع أَثَر.`)) return; await post({ action: 'delete', ids: [r.id] }, `delete-${r.id}`); }
  async function delBulk() { if (!ids.length) return; const typed = window.prompt(`ستُحذف ${ids.length} نتيجة نهائيًّا بلا سلّة. صدّرت CSV أولًا؟\nللتأكيد اكتب العدد: ${ids.length}`); if (typed === null) return; await post({ action: 'delete', ids, confirm: typed }, 'delete-bulk'); }
  async function archiveFiltered() { if (!window.confirm(`أرشفة كل النتائج المطابقة للمرشّحات الحالية (${rows.length} ظاهرة)؟ البطاقات تبقى تعمل بشارة «نتيجة مؤرشفة».`)) return; await post({ action: 'archive', filter: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }, 'archive-filter'); }
  async function openHistory(email: string) { const j = await fetch(`/api/admin/miaar/ledger?email=${encodeURIComponent(email)}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setHistory(j.history); else setErr(j?.error || 'تعذّر فتح سجلّ المتقدّم'); }
  const csvHref = `/api/admin/miaar/ledger?csv=1&${qs}`;
  async function downloadCsv() { const r = await fetch(csvHref, { headers: await auth(), cache: 'no-store' }); if (!r.ok) { setErr('تعذّر التصدير'); return; } const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `miaar-ledger-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  const progLabel = (p: Program) => `${p.name_ar}${p.cefr_level ? ` · ${LV[p.cefr_level] || p.cefr_level}` : ''}${p.remaining !== null ? ` · متبقٍّ ${p.remaining}` : ''}`;
  return (
    <div className="lg" data-testid="mi-ledger">
      <style>{CSS}</style>
      {err && <div className="am-err" role="alert">{err}</div>}{ok && <div className="am-ok" role="status" data-testid="lg-ok">{ok}</div>}
      <div className="mm-cards lg-cards">
        <div className="mm-card navy"><span>نتائج نشطة</span><b data-testid="lg-active">{counts.active ?? 0}</b><small>في السجلّ الآن</small></div>
        <div className="mm-card teal"><span>بلا قرار</span><b data-testid="lg-undecided">{counts.undecided ?? 0}</b><small>{counts.due ? `منها ${counts.due} حلّت مهلتها` : 'ضمن المهلة'}</small></div>
        <div className="mm-card gold"><span>قرار يحتاج إنسانًا</span><b data-testid="lg-review">{counts.review ?? 0}</b><small>المنطقة الرمادية — لا تُسكَّن تلقائيًّا</small></div>
        <div className="mm-card"><span>مؤرشفة</span><b>{counts.archived ?? 0}</b><small>بطاقاتها تعمل بشارة</small></div>
      </div>
      {auto && (auto.placed > 0 || auto.review > 0) && <p className="mm-note lg-auto" data-testid="lg-auto">عند فتح السجلّ: سُكِّن تلقائيًّا {auto.placed} بعد انقضاء المهلة، وأُحيل {auto.review} إلى إنسان.</p>}
      <section className="am-card lg-filters" data-testid="lg-filters" aria-label="المرشّحات">
        <div className="lg-frow">
          <label>من<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label>إلى<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <label>الدعوة<select value={f.invite} onChange={(e) => setF({ ...f, invite: e.target.value })} data-testid="lg-invite"><option value="">الكل</option>{invites.map((i) => <option key={i.id} value={i.id}>{i.label_ar}</option>)}</select></label>
          <label>المستوى<select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="">الكل</option>{LEVELS.map((l) => <option key={l} value={l}>{LV[l]}</option>)}</select></label>
          <label>الحالة<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} data-testid="lg-status"><option value="active">نشطة</option><option value="archived">مؤرشفة</option><option value="all">الكل</option></select></label>
          <label>القرار<select value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })} data-testid="lg-decision"><option value="all">الكل</option><option value="none">بلا قرار</option><option value="review">يحتاج إنسانًا</option><option value="approved">معتمد</option><option value="auto">تلقائي</option></select></label>
          <label>الوسم<input value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="مثل: دفعة-يناير" /></label>
          <label>البريد<input dir="ltr" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="بحث" data-testid="lg-q" /></label>
        </div>
        <div className="lg-fact">
          <button type="button" className="am-btn ghost" onClick={() => void downloadCsv()} data-testid="lg-csv"><Icon name="download" />صدّر CSV أولًا</button>
          <button type="button" className="am-btn ghost" onClick={() => setShowSections((v) => !v)} data-testid="lg-sections-toggle"><Icon name="table" />توزيع الشُّعب</button>
          <button type="button" className="am-btn ghost" onClick={() => void archiveFiltered()} disabled={!rows.length || !!busy} data-testid="lg-archive-filter">أرشفة كل المطابق للمرشّحات</button>
        </div>
      </section>
      {dl && f.invite && <section className="am-card lg-dl" data-testid="lg-deadline"><h3>مهلة القرار لهذه الدعوة <small>إن لم يقرّر إنسان خلالها يُسكَّن المتقدّم على توصية مِعيار ويُربط ببرنامجه — عدا «المنطقة الرمادية» فتبقى لإنسان</small></h3>
        <div className="lg-frow">
          <label>المهلة بالساعات<input type="number" min={1} max={720} value={dl.hours} disabled={dl.off} onChange={(e) => setDl({ ...dl, hours: e.target.value })} data-testid="lg-dl-hours" /></label>
          <label className="lg-dl-off"><span>بلا تسكين تلقائي</span><input type="checkbox" checked={dl.off} onChange={(e) => setDl({ ...dl, off: e.target.checked })} data-testid="lg-dl-off" /><small>القرار لإنسان دائمًا</small></label>
          {LEVELS.map((lv) => <label key={lv}>{LV[lv]} ← برنامج<select value={dl.lp[lv] || ''} onChange={(e) => { const lp = { ...dl.lp }; if (e.target.value) lp[lv] = e.target.value; else delete lp[lv]; setDl({ ...dl, lp }); }} data-testid={`lg-dl-${lv}`}><option value="">برنامج الدعوة / أول برنامج مفتوح بمستواه</option>{programs.filter((p) => !p.cefr_level || p.cefr_level === lv).map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>)}
        </div>
        <div className="lg-fact"><button type="button" className="am-btn" onClick={() => void saveDeadline()} disabled={!!busy || (!dl.off && !(Number(dl.hours) >= 1 && Number(dl.hours) <= 720))} data-testid="lg-dl-save"><Icon name="check" />احفظ المهلة</button><small className="lg-dl-note">خريطة «المستوى ← البرنامج» اختيارية؛ بلا خريطة يُستعمل برنامج الدعوة ثم أول برنامج عامّ مفتوح بالمستوى نفسه.</small></div>
      </section>}
      {showSections && <section className="am-card" data-testid="lg-sections"><h3>توزيع الشُّعب <small>السعة الحيّة لكل شعبة مفتوحة — إلى هنا تذهب القرارات</small></h3>
        {!sections.length ? <div className="am-empty">لا شُعب مفتوحة بعد. تُنشأ الشعبة تلقائيًّا بمستوى المتقدّم عند أول تسكين في برنامج بلا شُعب.</div> : <div className="lg-secs">{sections.map((s) => { const pct = Math.min(100, Math.round(s.filled / Math.max(1, s.capacity) * 100)); return <div key={s.id} className={`lg-sec${pct >= 100 ? ' full' : ''}`}><b>{s.name}</b><small>{s.program}{s.level ? ` · ${LV[s.level] || s.level}` : ' · بلا مستوى'}</small><div className="lg-bar" aria-label={`${s.filled} من ${s.capacity}`}><i style={{ width: `${pct}%` }} /></div><span>{s.filled} / {s.capacity}</span></div>; })}</div>}
      </section>}
      {ids.length > 0 && <section className="am-card lg-bulk" data-testid="lg-bulk" aria-label="إجراءات على المحدّد">
        <b>{ids.length} محدّدة</b>
        <label>المستوى<select value={bulk.level} onChange={(e) => setBulk({ ...bulk, level: e.target.value })} data-testid="lg-bulk-level"><option value="each">كلٌّ بحسب نتيجته</option>{LEVELS.map((l) => <option key={l} value={l}>{LV[l]}</option>)}</select></label>
        <label>البرنامج<select value={bulk.program} onChange={(e) => setBulk({ ...bulk, program: e.target.value })} data-testid="lg-bulk-program"><option value="">بلا تسجيل</option>{programs.map((p) => <option key={p.id} value={p.id}>{progLabel(p)}</option>)}</select></label>
        <button type="button" className="am-btn" disabled={!!busy} onClick={() => void post({ action: 'decide', report_ids: ids, level: bulk.level, program_id: bulk.program || null }, 'decide-bulk')} data-testid="lg-bulk-decide">اعتمد التسكين</button>
        <span className="lg-sep" />
        <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => void post({ action: 'archive', ids }, 'archive-bulk')} data-testid="lg-bulk-archive">أرشفة</button>
        <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => void post({ action: 'unarchive', ids }, 'unarchive-bulk')}>إلغاء الأرشفة</button>
        <label>وسم<input value={bulk.tag} onChange={(e) => setBulk({ ...bulk, tag: e.target.value })} placeholder="اسم المجموعة" data-testid="lg-bulk-tag" /></label>
        <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => void post({ action: 'tag', ids, tag: bulk.tag }, 'tag-bulk')} data-testid="lg-bulk-tag-go">وسم المجموعة</button>
        <span className="lg-sep" />
        <label>سبب الإعادة<input value={bulk.reason} onChange={(e) => setBulk({ ...bulk, reason: e.target.value })} placeholder="مثل: بعد نهاية البرنامج" /></label>
        <label>صالح (يومًا)<input type="number" min={1} max={365} value={bulk.days} onChange={(e) => setBulk({ ...bulk, days: e.target.value })} className="lg-num" /></label>
        <button type="button" className="am-btn ghost" disabled={!!busy} onClick={() => void post({ action: 'retake', report_ids: ids, reason: bulk.reason, days: bulk.days }, 'retake-bulk')} data-testid="lg-bulk-retake">السماح بالإعادة للمجموعة</button>
        {canDelete && <><span className="lg-sep" /><button type="button" className="am-btn danger" disabled={!!busy} onClick={() => void delBulk()} data-testid="lg-bulk-delete">حذف المحدّد نهائيًّا</button></>}
      </section>}
      <section className="am-card">
        <h3>السجلّ <small>{rows.length} نتيجة بحسب المرشّحات — أمام كل متقدّم قرارُه وإجراءاتُه</small></h3>
        {!rows.length ? <div className="am-empty" data-testid="lg-empty">لا نتائج تطابق المرشّحات.</div> : <div className="lg-tw"><table className="mm-t lg-t"><thead><tr>
          <th><input type="checkbox" aria-label="تحديد الكل" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} data-testid="lg-check-all" /></th>
          <th>المتقدّم</th><th>النتيجة</th><th>الحالة</th><th>قرار التسكين</th><th>إجراءات</th></tr></thead><tbody>
          {rows.map((r) => { const p = pk(r); const d = r.decision; const left = hoursLeft(r.deadline_at); return <tr key={r.id} className={`${r.archived_at ? 'arch' : ''}${d?.status === 'review' || (!d && r.gray) ? ' gray' : ''}`} data-testid="lg-row">
            <td><input type="checkbox" aria-label={`تحديد ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} data-testid="lg-check" /></td>
            <td><button type="button" className="lg-name" onClick={() => void openHistory(r.email)} data-testid="lg-history-open">{r.name}</button><br /><small dir="ltr">{r.email}</small>
              <div className="lg-chips">{r.attempt > 1 && <span className="lg-chip teal" title="محاولة لاحقة — تقرير المقارنة في م5-ب">المحاولة {r.attempt}</span>}{r.invite_label && <span className="lg-chip">{r.invite_label}</span>}{r.group_tag && <span className="lg-chip">#{r.group_tag}</span>}{r.retake_open && <span className="lg-chip gold">إذن إعادة مفتوح</span>}</div></td>
            <td><b className="lg-lv">{LV[r.demonstrated]}</b><small> مثبت · التحاق {LV[r.entry]}</small><br /><small>{r.percent !== null ? `${r.percent}%` : '—'} · ثقة {CONF[r.confidence] || r.confidence}{r.form_code ? ` · ${r.form_code}` : ''}</small><br /><small>{fmt(r.taken_at)}</small>{r.code && <><br /><a href={`/miaar/result/${r.code}`} target="_blank" rel="noreferrer" dir="ltr">{r.code}</a></>}</td>
            <td>{r.archived_at ? <span className="lg-st arch">مؤرشفة</span> : d ? <span className={`lg-st ${d.status}`}>{d.status === 'review' ? 'يحتاج إنسانًا' : d.source === 'auto' ? 'سُكِّن تلقائيًّا' : 'معتمد'}</span> : <span className="lg-st none">بلا قرار{left !== null ? <small> · {left === 0 ? 'حلّت المهلة' : `${left} س متبقية`}</small> : <small> · بلا تسكين تلقائي</small>}</span>}
              {(d?.gray_reason || (!d && r.gray)) && <small className="lg-grayr" data-testid="lg-gray">{d?.gray_reason || r.gray}</small>}</td>
            <td className="lg-dec">
              {d && d.status === 'approved' ? <div className="lg-decided" data-testid="lg-decided"><b>{LV[d.level || ''] || '—'}</b>{d.level && d.level !== r.entry && <small className="lg-ovr">تسكين يدوي بدل {LV[r.entry]}</small>}<small>{d.program_name ? `برنامج: ${d.program_name}` : 'بلا تسجيل'}{d.classroom ? ` · شعبة ${d.classroom}` : ''}</small><small>{d.source === 'auto' ? 'تلقائي' : 'إنسان'} · {fmt(d.decided_at)}</small><button type="button" className="lg-link" onClick={() => void post({ action: 'decision_clear', report_id: r.id }, `clear-${r.id}`)}>تغيير</button></div>
                : <div className="lg-pick">
                  <select aria-label="مستوى التسكين" value={p.level} onChange={(e) => setPick({ ...pick, [r.id]: { ...p, level: e.target.value } })} data-testid="lg-level">{LEVELS.map((l) => <option key={l} value={l}>{LV[l]}{l === r.entry ? ' (توصية مِعيار)' : ''}</option>)}</select>
                  {p.level !== r.entry && <small className="lg-ovr">تسكين يدوي: {LV[p.level]} بدل {LV[r.entry]}</small>}
                  <select aria-label="البرنامج" value={p.program} onChange={(e) => setPick({ ...pick, [r.id]: { ...p, program: e.target.value } })} data-testid="lg-program"><option value="">بلا تسجيل في برنامج</option>{programs.map((pr) => <option key={pr.id} value={pr.id} disabled={pr.remaining === 0}>{progLabel(pr)}</option>)}</select>
                  <button type="button" className="am-btn small" disabled={!!busy || !!r.archived_at} onClick={() => void decideOne(r)} data-testid="lg-decide">اعتمد</button>
                </div>}
            </td>
            <td className="lg-acts">
              {r.code && <a className="am-btn small ghost" href={`/miaar/result/${r.code}`} target="_blank" rel="noreferrer">البطاقة</a>}
              <button type="button" className="am-btn small ghost" disabled={!!busy} onClick={() => void post({ action: r.archived_at ? 'unarchive' : 'archive', ids: [r.id] }, `arch-${r.id}`)} data-testid="lg-archive">{r.archived_at ? 'إلغاء الأرشفة' : 'أرشفة'}</button>
              <button type="button" className="am-btn small ghost" disabled={!!busy || r.retake_open} onClick={() => void post({ action: 'retake', report_ids: [r.id], reason: 'إذن فردي من السجلّ', days: 30 }, `retake-${r.id}`)} data-testid="lg-retake">{r.retake_open ? 'الإعادة مأذونة' : 'السماح بالإعادة'}</button>
              {canDelete && <button type="button" className="am-btn small danger" disabled={!!busy} onClick={() => void delOne(r)} data-testid="lg-delete">حذف</button>}
            </td>
          </tr>; })}
        </tbody></table></div>}
        <p className="mm-note">الأرشفة تخفي النتيجة من السجلّ النشط وتبقي بطاقتها العلنية تعمل بشارة «نتيجة مؤرشفة». الحذف فوري بلا سلّة محذوفات ويُقيَّد في «درع أَثَر»؛ لذلك «صدّر CSV أولًا». التسكين التلقائي يعمل بعد مهلة الدعوة (48 ساعة افتراضًا، تُضبط من الدعوات) ولا يمسّ المنطقة الرمادية.</p>
      </section>
      {history && <div className="lg-modal" role="dialog" aria-modal="true" aria-label="سجلّ المتقدّم" data-testid="lg-history" onClick={() => setHistory(null)}><div className="lg-mcard" onClick={(e) => e.stopPropagation()}>
        <div className="lg-mhead"><div><h3>سجلّ المتقدّم</h3><p>{history.name} · <span dir="ltr">{history.email}</span></p></div><button type="button" className="am-btn ghost small" onClick={() => setHistory(null)}>إغلاق</button></div>
        <h4>المحاولات ({history.attempts.length})</h4>
        <ol className="lg-tl">{history.attempts.map((a: any) => <li key={a.id}><b>المحاولة {a.attempt}</b> · {fmt(a.taken_at)} · {LV[a.demonstrated]} مثبت / التحاق {LV[a.entry]} · {a.percent ?? '—'}%{a.archived_at ? ' · مؤرشفة' : ''}{a.previous_report_id ? ' · مربوطة بسابقتها' : ''}{a.decision ? ` · قرار: ${a.decision.status === 'review' ? 'يحتاج إنسانًا' : LV[a.decision.level] || a.decision.level}${a.decision.program ? ` (${a.decision.program}${a.decision.classroom ? ` · ${a.decision.classroom}` : ''})` : ''}` : ''}{a.code && <> · <a href={`/miaar/result/${a.code}`} target="_blank" rel="noreferrer" dir="ltr">{a.code}</a></>}</li>)}</ol>
        {history.attempts.length > 1 && <p className="mm-note">تقرير المقارنة بين المحاولات («الاختبار الأول بتاريخ… والثاني بتاريخ…») يُبنى في م5-ب «النموّ والمقارنة».</p>}
        <h4>أذون الإعادة ({history.grants.length})</h4>
        {!history.grants.length ? <p className="mm-note">لا أذون.</p> : <ul className="lg-tl">{history.grants.map((g: any) => <li key={g.id}>{fmt(g.created_at)} · {g.kind === 'group' ? 'جماعي' : g.kind === 'program_end' ? 'بعد البرنامج' : 'فردي'} · {g.used_at ? `استُهلك ${fmt(g.used_at)}` : g.revoked_at ? 'مسحوب' : g.open ? 'مفتوح' : 'منتهٍ'}{g.reason ? ` · ${g.reason}` : ''}{g.open && <> · <button type="button" className="lg-link" onClick={async () => { await post({ action: 'retake_revoke', email: history.email }, 'revoke'); await openHistory(history.email); }}>سحب</button></>}</li>)}</ul>}
        <h4>التسجيلات ({history.enrollments.length})</h4>
        {!history.enrollments.length ? <p className="mm-note">لا تسجيلات.</p> : <ul className="lg-tl">{history.enrollments.map((e: any) => <li key={e.id}>{e.program} · {e.status}{e.level ? ` · ${LV[e.level] || e.level}` : ''}{e.classroom ? ` · شعبة ${e.classroom}` : ''} · {fmt(e.created_at)}{e.source === 'miaar' ? ' · من مِعيار' : ''}</li>)}</ul>}
      </div></div>}
    </div>
  );
}

const CSS = `
.lg-cards{margin-bottom:12px}.lg-auto{margin:-4px 0 10px}
.lg-frow{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.lg-frow label,.lg-bulk label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#475569}
.lg-frow input,.lg-frow select,.lg-bulk input,.lg-bulk select,.lg-pick select{border:1px solid var(--line,#e2e8f0);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;background:#fff;min-height:38px}
.lg-fact{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.lg-dl{border-inline-start:4px solid var(--gold,#c9a24b)}.lg-dl-off{align-items:flex-start}.lg-dl-off input{width:22px;height:22px;min-height:0}.lg-dl-note{align-self:center;font-size:12px;color:#64748b}
.lg-bulk{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;background:#f8fafc;border-color:#cbd5e1}.lg-bulk>b{align-self:center;color:#0f2a4e}.lg-sep{width:1px;height:28px;background:#cbd5e1;align-self:center}.lg-num{width:80px}
.lg-tw{overflow:auto;max-width:100%}.am-wrap>*{min-width:0}.lg{min-width:0}.lg-t td{vertical-align:top}.lg-t tr.arch td{opacity:.72}.lg-t tr.gray td{background:#fffbeb}
.lg-name{background:none;border:0;padding:0;font:inherit;font-weight:900;color:#0f2a4e;cursor:pointer;text-decoration:underline dotted}
.lg-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.lg-chip{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800;background:#f1f5f9;color:#334155}.lg-chip.teal{background:#e6f4f3;color:#0f5c57}.lg-chip.gold{background:#fbf5e4;color:#8a6a1f}
.lg-lv{font-size:17px;color:#0f2a4e}.lg-st{display:inline-block;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:800;background:#f1f5f9;color:#334155}.lg-st.approved{background:#e6f4f3;color:#0f5c57}.lg-st.review{background:#fbf5e4;color:#8a6a1f}.lg-st.arch{background:#e2e8f0;color:#475569}.lg-grayr{display:block;margin-top:4px;color:#8a6a1f;font-weight:800;max-width:220px}
.lg-pick{display:flex;flex-direction:column;gap:6px;min-width:200px}.lg-ovr{color:#8a6a1f;font-weight:800}.lg-decided{display:flex;flex-direction:column;gap:2px}.lg-decided b{font-size:17px;color:#0f5c57}
.lg-link{background:none;border:0;padding:0;font:inherit;font-size:12px;font-weight:800;color:#0b8a83;cursor:pointer;text-decoration:underline;align-self:flex-start}
.lg-acts{display:flex;flex-direction:column;gap:6px;min-width:130px}.am-btn.danger{background:#fff;border-color:#fecaca;color:#b91c1c}.am-btn.danger:hover{background:#fef2f2}
.lg-secs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.lg-sec{border:1px solid var(--line,#e2e8f0);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:4px}.lg-sec.full{border-color:#fecaca}.lg-sec small{color:#64748b}.lg-bar{height:8px;border-radius:999px;background:#f1f5f9;overflow:hidden}.lg-bar i{display:block;height:100%;background:#0b8a83}.lg-sec.full .lg-bar i{background:#b91c1c}
.lg-modal{position:fixed;inset:0;background:rgba(15,42,78,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60}.lg-mcard{background:#fff;border-radius:16px;max-width:760px;width:100%;max-height:90vh;overflow:auto;padding:18px 20px}.lg-mhead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.lg-mhead h3{margin:0}.lg-mhead p{margin:4px 0 0;color:#475569}.lg-mcard h4{margin:14px 0 6px;color:#0f2a4e}.lg-tl{margin:0;padding-inline-start:18px;display:flex;flex-direction:column;gap:6px;color:#334155}
@media(max-width:760px){.lg-acts{min-width:0}.lg-pick{min-width:160px}}
`;
