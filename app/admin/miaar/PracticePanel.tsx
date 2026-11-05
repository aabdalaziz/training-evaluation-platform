'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م10 «مِران» — لوحة المدرّب داخل لوحة العبور: «من يستحقّ خطّة تمرين؟»
 *  - جدول المؤهّلين (مشروط/راسب بحكم نهائي، لم يُدمج إعادة بعد): الوحدات المقترحة · الحالة · التقدّم · الجاهزية · آخر نشاط
 *  - «اعتمد الكلّ» بزرّ واحد مع تخطّي صفوف · «راجع» يفتح الخطّة: 14 يومًا قابلة للتحرير (تبديل وحدة اليوم · ملاحظة نصّية ≤300 · ملاحظة صوتية ≤30 ث MediaRecorder)
 *  - «ذكّر» (مرة يوميًا) · «ألغِ» · رابط المتعلّم /miaar/practice/<code>
 *  القاعدة: لا خطّة تُفتح للمتعلّم دون اعتماد مدرّب — الذكاء يقترح والإنسان يوقّع.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Sum = { id: string; status: string; status_ar: string; today: number; ended: boolean; done: number; total: number; last_attempt_at: string | null; idle_days: number | null; avg_delta: number | null; ready: 'ready' | 'close' | 'early' | null; units: string[]; skill: string | null; start_date: string | null };
type Row = { report_id: string; code: string | null; name: string; email: string; outcome: string; level: string; skill: string | null; retake: any; plan: Sum | null; proposed: { units: string[]; days: any[] } | null; unit_titles: Record<string, string> };
type Day = { d: number; kind: 'drill' | 'mirror'; unit: string | null; unit_title: string; text?: boolean; note_ar?: string | null; note_audio?: string | null; has_items: boolean; progress: { n: number; correct: number; text: string | null } | null };
type Plan = { id: string; level: string; skill: string | null; units: string[]; status: string; start_date: string | null; days: Day[] };
type Detail = { plan: Plan; today: number; ended: boolean; learner: { name: string; code: string | null; outcome: string } | null; summary: Sum | null; level_units: { code: string; title_ar: string }[]; unit_titles: Record<string, string> };
const SKN: Record<string, string> = { listening: 'استماع', reading: 'قراءة', grammar_vocab: 'مفردات وتراكيب', writing: 'كتابة', speaking: 'محادثة' };
const OUT: Record<string, string> = { conditional: 'مشروط', failed: 'لم يجتز' };
const READY: Record<string, [string, string]> = { ready: ['جاهز للإعادة', 'ok'], close: ['يقترب', 'warn'], early: ['مبكر', 'mute'] };
const fmt = (d: string | null) => d ? new Date(d).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : '—';

export default function PracticePanel({ inviteId, auth, onChanged }: { inviteId: string; auth: () => Promise<Record<string, string>>; onChanged?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [ok, setOk] = useState(''); const [skip, setSkip] = useState<Set<string>>(new Set());
  const [det, setDet] = useState<Detail | null>(null); const [edits, setEdits] = useState<Record<number, { unit?: string | null; note_ar?: string; note_audio?: string | null }>>({}); const [rec, setRec] = useState<{ d: number; mr: MediaRecorder; t: number } | null>(null); const timer = useRef<number | null>(null);
  const load = useCallback(async () => { const H = await auth(); const j = await fetch(`/api/admin/miaar/practice?invite=${encodeURIComponent(inviteId)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر تحميل مِران'); return; } setRows(j.rows); }, [inviteId, auth]);
  useEffect(() => { void load(); }, [load]);
  const post = useCallback(async (body: any) => { const H = await auth(); const r = await fetch('/api/admin/miaar/practice', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => null); return { status: r.status, j }; }, [auth]);
  async function openPlan(r: Row) {
    setBusy('open:' + r.report_id); setErr('');
    let planId = r.plan?.id; if (!planId) { const { j } = await post({ action: 'draft', report_id: r.report_id }); if (!j?.success) { setBusy(''); setErr(j?.error || 'تعذّر إنشاء المسوَّدة'); return; } planId = j.plan.id; }
    const H = await auth(); const j = await fetch(`/api/admin/miaar/practice?plan=${encodeURIComponent(planId!)}`, { headers: H, cache: 'no-store' }).then((x) => x.json()).catch(() => null); setBusy('');
    if (!j?.success) { setErr(j?.error || 'تعذّر فتح الخطّة'); return; } setDet(j); setEdits({});
  }
  function editList() { return Object.entries(edits).map(([d, e]) => ({ day: Number(d), ...e })); }
  async function approve() { if (!det) return; setBusy('approve'); const { j } = await post({ action: 'approve', plan_id: det.plan.id, edits: editList() }); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر الاعتماد'); return; } setDet(null); setOk('اعتُمدت الخطّة — يبدأ المتعلّم اليوم ويصله تنبيه داخل أَثَر.'); await load(); onChanged?.(); }
  async function saveEdits() { if (!det) return; setBusy('save'); for (const e of editList()) { const { j } = await post({ action: 'edit_day', plan_id: det.plan.id, ...e }); if (!j?.success) { setErr(j?.error || 'تعذّر الحفظ'); setBusy(''); return; } } setBusy(''); setOk('حُفظت تعديلات الأيام.'); setEdits({}); await openPlan({ report_id: '', plan: { id: det.plan.id } } as any); }
  async function approveAll() { if (!rows) return; const n = rows.filter((r) => !skip.has(r.report_id) && (!r.plan || r.plan.status === 'draft')).length; if (!n || !window.confirm(`اعتماد ${n} خطّة مِران كما اقترحها النظام؟ يبدأ المتعلّمون اليوم.`)) return; setBusy('all'); const { j } = await post({ action: 'approve_all', invite_id: inviteId, skip: [...skip] }); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return; } setOk(`اعتُمدت ${j.done} خطّة${j.skipped ? ` · تُخطّي ${j.skipped}` : ''}${j.errors?.length ? ` · تعذّر: ${j.errors.join(' · ')}` : ''}`); await load(); onChanged?.(); }
  async function nudge(r: Row) { if (!r.plan) return; setBusy('nudge:' + r.plan.id); const { j } = await post({ action: 'nudge', plan_id: r.plan.id }); setBusy(''); setOk(j?.success ? `أُرسل تذكير إلى ${r.name}.` : j?.error || 'تعذّر'); }
  async function cancel(r: Row) { if (!r.plan || !window.confirm(`إلغاء خطّة مِران لـ ${r.name}؟`)) return; setBusy('cancel:' + r.plan.id); const { j } = await post({ action: 'cancel', plan_id: r.plan.id }); setBusy(''); if (j?.success) { setOk('أُلغيت الخطّة.'); await load(); } else setErr(j?.error || 'تعذّر'); }
  async function startRec(d: number) {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mr = new MediaRecorder(stream); const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data); mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); const fr = new FileReader(); fr.onload = () => { const url = String(fr.result || ''); if (url.length > 220000) { setErr('الملاحظة الصوتية أطول من المسموح — سجّل أقصر (≤ 30 ث).'); return; } setEdits((p) => ({ ...p, [d]: { ...p[d], note_audio: url } })); }; fr.readAsDataURL(blob); };
      mr.start(); setRec({ d, mr, t: 0 }); timer.current = window.setInterval(() => setRec((p) => { if (!p) return p; if (p.t + 1 >= 30) { p.mr.stop(); if (timer.current) window.clearInterval(timer.current); return null; } return { ...p, t: p.t + 1 }; }), 1000); }
    catch { setErr('لا يمكن الوصول إلى الميكروفون — اكتب الملاحظة نصًّا.'); }
  }
  function stopRec() { if (rec) { rec.mr.stop(); if (timer.current) window.clearInterval(timer.current); setRec(null); } }
  if (err && !rows) return <p className="xb-muted" data-testid="pr-err">{err}</p>; if (!rows) return null;
  const pending = rows.filter((r) => !r.plan || r.plan.status === 'draft'); const active = rows.filter((r) => r.plan && r.plan.status === 'approved');
  return <div className="pr" data-testid="pr-root" data-rows={rows.length} id="xb-practice">
    <div className="xb-bar"><h4>💪 مِران <small>تدريب موجَّه بين الحكم والإعادة — 14 يومًا · 5 بنود يوميًا · يعتمده مدرّب</small></h4>
      {pending.length > 0 && <button type="button" className="xb-btn primary sm" onClick={() => void approveAll()} disabled={busy === 'all'} data-testid="pr-approve-all"><Icon name="check" size={14} /> اعتمد الكلّ ({pending.filter((r) => !skip.has(r.report_id)).length})</button>}</div>
    {ok && <p className="xb-ok" role="status" data-testid="pr-ok">{ok}</p>}{err && <p className="xb-err" role="alert" data-testid="pr-note">{err}</p>}
    {rows.length === 0 ? <p className="xb-muted">لا أحد يحتاج مِران الآن — يظهر هنا كلّ «مشروط» أو «لم يجتز» بحكم نهائي لم يُعِد بعد.</p>
      : <table className="xb-t pr-t"><thead><tr><th title="تخطّي عند «اعتمد الكلّ»">تخطَّ</th><th>المتعلّم</th><th>الحكم</th><th>الوحدات</th><th>الخطّة</th><th>التقدّم</th><th>الجاهزية</th><th>إجراء</th></tr></thead><tbody>
        {rows.map((r) => { const s = r.plan; const units = s?.units || r.proposed?.units || []; const rd = s?.ready ? READY[s.ready] : null; return <tr key={r.report_id} data-testid="pr-row" data-status={s?.status || 'none'}>
          <td>{(!s || s.status === 'draft') && <input type="checkbox" checked={skip.has(r.report_id)} onChange={() => setSkip((p) => { const n = new Set(p); if (n.has(r.report_id)) n.delete(r.report_id); else n.add(r.report_id); return n; })} aria-label={`تخطّي ${r.name}`} data-testid="pr-skip" />}</td>
          <td><b>{r.name}</b><br /><small dir="ltr">{r.email}</small></td>
          <td><span className={`xb-pill ${r.outcome === 'failed' ? 'bad' : 'warn'}`}>{OUT[r.outcome] || r.outcome}</span>{r.skill && <><br /><small>{SKN[r.skill]}</small></>}</td>
          <td className="pr-units">{units.map((u) => <span key={u} className="xb-pill mute" title={r.unit_titles[u] || u} dir="ltr">{u}</span>)}</td>
          <td>{s ? <><span className={`xb-pill ${s.status === 'approved' ? 'ok' : s.status === 'done' ? 'mute' : s.status === 'cancelled' ? 'bad' : 'warn'}`} data-testid="pr-status">{s.status_ar}</span>{s.status === 'approved' && <><br /><small>اليوم {s.today}/{s.total}</small></>}</> : <span className="xb-pill warn">مقترحة</span>}</td>
          <td>{s && s.status !== 'draft' ? <><span className="xb-prog" title={`${s.done}/${s.total}`}><i style={{ width: `${Math.round((s.done / Math.max(1, s.total)) * 100)}%` }} /><em>{s.done}/{s.total}</em></span>{typeof s.idle_days === 'number' && s.idle_days >= 3 && s.status === 'approved' && <><br /><span className="xb-pill warn">خامل {s.idle_days} أيام</span></>}{typeof s.avg_delta === 'number' && <><br /><small>التحسّن {s.avg_delta > 0 ? '+' : ''}{s.avg_delta}</small></>}</> : '—'}</td>
          <td>{rd ? <span className={`xb-pill ${rd[1]}`} data-testid="pr-ready">{rd[0]}</span> : '—'}{r.retake?.الحالة === 'invited' && <><br /><small>دعوة إعادة قائمة</small></>}</td>
          <td className="xb-rowacts"><button type="button" className="xb-btn sm" onClick={() => void openPlan(r)} disabled={busy === 'open:' + r.report_id} data-testid="pr-open">{s && s.status !== 'draft' ? 'الخطّة' : 'راجع واعتمد'}</button>
            {s?.status === 'approved' && <button type="button" className="xb-btn sm" onClick={() => void nudge(r)} disabled={busy === 'nudge:' + s.id} data-testid="pr-nudge">ذكّر</button>}
            {s && (s.status === 'approved' || s.status === 'draft') && <button type="button" className="xb-btn sm danger" onClick={() => void cancel(r)} data-testid="pr-cancel">ألغِ</button>}
            {s?.status !== undefined && s.status !== 'draft' && r.code && <a className="xb-btn sm" href={`/miaar/practice/${r.code}`} target="_blank" rel="noreferrer">صفحة المتعلّم</a>}</td>
        </tr>; })}
      </tbody></table>}
    {active.length > 0 && <p className="xb-muted pr-foot">{active.length} يتدرّبون الآن · التذكير اليومي يصل داخل أَثَر 06:00 UTC · «ذكّر» يرسل تنبيهًا باسمك مرة في اليوم.</p>}
    {det && <div className="rm-ov" role="presentation" onClick={() => !busy && setDet(null)}><div className="rm-modal pr-modal" role="dialog" aria-modal="true" aria-labelledby="pr-h" onClick={(e) => e.stopPropagation()} data-testid="pr-modal">
      <div className="rm-mh"><h3 id="pr-h">💪 خطّة مِران — {det.learner?.name || ''} <small>{det.plan.level}{det.plan.skill ? ` · ${SKN[det.plan.skill]}` : ''} · {det.plan.units.join(' · ')}</small></h3><button type="button" className="xb-btn sm" onClick={() => setDet(null)} aria-label="إغلاق">✕</button></div>
      <p className="xb-muted">{det.plan.status === 'draft' ? 'مسوَّدة اقترحها النظام من الوحدات الحمراء — بدّل وحدة أيّ يوم، أو أضف «رفيق التمرين» (ملاحظة نصّية أو صوتية ≤ 30 ث) ثم اعتمد.' : `${det.summary?.status_ar || ''} · اليوم ${det.today}${det.ended ? ' · انتهت' : ''} — تعديلات الأيام القادمة تظهر للمتعلّم فورًا.`}</p>
      <ol className="pr-days">{det.plan.days.map((d) => { const e = edits[d.d] || {}; const unit = e.unit !== undefined ? e.unit : d.unit; const past = det.plan.status !== 'draft' && d.d < det.today; const audio = e.note_audio !== undefined ? e.note_audio : d.note_audio; return <li key={d.d} className={`pr-day ${d.kind} ${past ? 'past' : ''}`} data-testid="pr-day" data-d={d.d}>
        <div className="pr-dh"><b>اليوم {d.d}</b> {d.kind === 'mirror' ? <span className="xb-pill warn">🪞 مرآة</span> : <select value={unit || ''} onChange={(ev) => setEdits((p) => ({ ...p, [d.d]: { ...p[d.d], unit: ev.target.value } }))} disabled={past} aria-label={`وحدة اليوم ${d.d}`} data-testid="pr-unit">{det.level_units.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.title_ar}</option>)}</select>}{d.text && <span className="xb-pill mute">+ كتابة/تحدّث</span>}
          {d.progress && <small>{d.progress.n ? `${d.progress.correct}/${d.progress.n}` : ''}{d.progress.text ? ' · نصّ' : ''}</small>}</div>
        {!past && <div className="pr-note"><input value={e.note_ar !== undefined ? e.note_ar : d.note_ar || ''} onChange={(ev) => setEdits((p) => ({ ...p, [d.d]: { ...p[d.d], note_ar: ev.target.value.slice(0, 300) } }))} placeholder="ملاحظة قصيرة للمتعلّم (اختياري)" maxLength={300} aria-label={`ملاحظة اليوم ${d.d}`} data-testid="pr-note-in" />
          {rec?.d === d.d ? <button type="button" className="xb-btn sm danger" onClick={stopRec}>■ {rec.t} ث</button> : <button type="button" className="xb-btn sm" onClick={() => void startRec(d.d)} disabled={!!rec} title="ملاحظة صوتية ≤ 30 ث">🎙</button>}
          {audio && <><audio controls src={audio} preload="none" /><button type="button" className="xb-btn sm" onClick={() => setEdits((p) => ({ ...p, [d.d]: { ...p[d.d], note_audio: null } }))} aria-label="حذف الصوت">✕</button></>}</div>}
        {d.progress?.text && <p className="pr-text">«{d.progress.text}»</p>}
      </li>; })}</ol>
      <div className="xb-acts rm-foot">{det.plan.status === 'draft' ? <button type="button" className="xb-btn primary" onClick={() => void approve()} disabled={busy === 'approve'} data-testid="pr-approve"><Icon name="check" size={14} /> اعتمد الخطّة — تبدأ اليوم</button>
        : <button type="button" className="xb-btn primary" onClick={() => void saveEdits()} disabled={busy === 'save' || !Object.keys(edits).length} data-testid="pr-save">احفظ التعديلات ({Object.keys(edits).length})</button>}
        {det.learner?.code && det.plan.status !== 'draft' && <a className="xb-btn" href={`/miaar/practice/${det.learner.code}`} target="_blank" rel="noreferrer">صفحة المتعلّم</a>}
        <button type="button" className="xb-btn" onClick={() => setDet(null)}>إغلاق</button></div>
    </div></div>}
  </div>;
}
export const PR_CSS = `
.pr{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:10px;display:grid;gap:8px}.pr h4{margin:0;font-size:15px}.pr h4 small{font-weight:600;color:#64748b;font-size:12px;margin-inline-start:6px}
.pr-units{display:flex;flex-wrap:wrap;gap:4px;max-width:220px}.pr-t td{font-size:12.5px}.pr-foot{margin:0;font-size:12px}
.pr-modal{width:min(820px,100%)}.pr-days{list-style:none;margin:0;padding:0;display:grid;gap:6px}.pr-day{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;display:grid;gap:6px}.pr-day.mirror{background:#fffbeb;border-color:#fde68a}.pr-day.past{opacity:.7;background:#f8fafc}
.pr-dh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}.pr-dh select{font:inherit;font-size:12.5px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:8px;max-width:360px}.pr-dh small{color:#64748b;margin-inline-start:auto}
.pr-note{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.pr-note input{flex:1;min-width:200px;font:inherit;font-size:12.5px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px}.pr-note audio{height:32px;max-width:220px}
.pr-text{margin:0;font-size:12.5px;color:#334155;background:#f0fdfa;border-radius:8px;padding:6px 8px;white-space:pre-wrap}
`;
