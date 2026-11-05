'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م6-ج «جلسة التعويض — من خريطة المنهج» — داخل بطاقة «أين ضعفت المجموعة؟» في لوحة العبور
 *  - الوحدة البرنامجية المقابلة لكل وحدة حمراء (إن رُبطت من بطاقة الدبلوم) · زرّ «جدوِل جلسة التعويض» (يظهر مع وحدة حمراء)
 *  - نافذة: الوحدات (الحمراء مُحدَّدة) · الموعد (أقرب يوم عمل 10:00) · المدّة · المنصّة · الرابط · المدرّس · خطّة الدرس (مسوَّدة محلية → «حسّن بالذكاء» اختياريًّا → يعدّلها المدرّس)
 *  - جلسات التعويض القائمة: الموعد · الحضور · «أثر التعويض» لكل وحدة · إلغاء
 */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

type Weak = { code: string; title_ar: string; percent: number; n_students: number; program_unit: { idx: number; title_ar: string; starts_on: string | null } | null };
type U = { code: string; title_ar: string; title_en: string; percent: number | null; state: string | null; program_unit: Weak['program_unit'] };
type Sess = { id: string; title_ar: string; starts_at: string; duration_min: number; provider: string; join_url: string | null; status: string; miaar_unit_codes: string[]; joined: number; effect: Array<{ code: string; title_ar: string; text: string; n_retakes: number; attended: { n: number; delta: number | null }; others: { n: number; delta: number | null } }> };
type Data = { ready: boolean; title: { ar: string; en: string }; invite: { id: string; level: string }; classroom: { id: string; code: string; name: string | null } | null; trainer: { id: string; name: string } | null; weak: Weak[]; units: U[]; defaults: { starts_at: string; duration_min: number; provider: string; join_url: string; trainer_id: string | null; title_ar: string }; sessions: Sess[]; max_units: number };
const PROV: Array<[string, string]> = [['teams', 'Microsoft Teams'], ['zoom', 'Zoom'], ['meet', 'Google Meet'], ['athar', 'قاعة أَثَر (فورية)'], ['other', 'منصّة أخرى']];
const fmt = (d: string) => new Date(d).toLocaleString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
const toLocal = (iso: string) => { const d = new Date(new Date(iso).getTime() + 3 * 3600000); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }; };
const fromLocal = (date: string, time: string) => new Date(`${date}T${time.length === 5 ? time + ':00' : time}+03:00`).toISOString();

export default function RemedialPanel({ inviteId, auth, onChanged }: { inviteId: string; auth: () => Promise<Record<string, string>>; onChanged?: () => void }) {
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(''); const [ok, setOk] = useState('');
  const [codes, setCodes] = useState<string[]>([]); const [date, setDate] = useState(''); const [time, setTime] = useState('10:00'); const [dur, setDur] = useState(60); const [prov, setProv] = useState('teams'); const [url, setUrl] = useState(''); const [title, setTitle] = useState(''); const [plan, setPlan] = useState(''); const [planSrc, setPlanSrc] = useState<'local' | 'ai' | ''>(''); const [note, setNote] = useState(''); const [clash, setClash] = useState<any[] | null>(null);
  const load = useCallback(async () => { const H = await auth(); const j = await fetch(`/api/admin/miaar/remedial?invite=${encodeURIComponent(inviteId)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || ''); return; } setErr(''); setD(j); }, [auth, inviteId]);
  useEffect(() => { void load(); }, [load]);
  const post = useCallback(async (body: any) => { const H = await auth(); const r = await fetch('/api/admin/miaar/remedial', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); return { status: r.status, j }; }, [auth]);
  const draft = useCallback(async (cs: string[], mins: number) => { if (!cs.length) { setPlan(''); return; } setBusy('draft'); const { j } = await post({ action: 'draft', invite_id: inviteId, unit_codes: cs, duration_min: mins }); setBusy(''); if (j?.success) { setPlan(j.plan || ''); setPlanSrc('local'); if (j.title_ar) setTitle(j.title_ar); } }, [post, inviteId]);
  function start() { if (!d) return; const cs = d.weak.map((w) => w.code).slice(0, d.max_units); setCodes(cs); const l = toLocal(d.defaults.starts_at); setDate(l.date); setTime(l.time); setDur(d.defaults.duration_min); setProv(d.defaults.provider || 'teams'); setUrl(d.defaults.join_url || ''); setTitle(d.defaults.title_ar); setNote(''); setClash(null); setOk(''); setOpen(true); void draft(cs, d.defaults.duration_min); }
  function toggle(c: string) { setCodes((cs) => { const n = cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= (d?.max_units || 3) ? cs : [...cs, c]; void draft(n, dur); return n; }); }
  async function improve() { setBusy('ai'); setNote(''); const { j } = await post({ action: 'improve', invite_id: inviteId, unit_codes: codes, plan }); setBusy(''); if (!j?.success) { setNote(j?.error || 'تعذّر التحسين'); return; } setPlan(j.plan || plan); setPlanSrc(j.source === 'ai' ? 'ai' : 'local'); if (j.note) setNote(j.note); }
  async function create(force = false) {
    setBusy('create'); setNote(''); const { status, j } = await post({ action: 'create', invite_id: inviteId, unit_codes: codes, starts_at: fromLocal(date, time), duration_min: dur, provider: prov, join_url: url, trainer_id: d?.defaults.trainer_id || null, title_ar: title, description_ar: plan, force }); setBusy('');
    if (status === 409 && Array.isArray(j?.conflicts)) { setClash(j.conflicts); return; } if (!j?.success) { setNote(j?.error || 'تعذّر الإنشاء'); return; }
    setOpen(false); setOk(`جُدولت الجلسة${j.conflicts ? ' (رغم التعارض)' : ''} — تظهر في «البثّ المباشر» وفي بطاقات المتعلّمين.`); await load(); onChanged?.();
  }
  async function cancel(id: string) { if (!window.confirm('إلغاء جلسة التعويض؟ لن تظهر للمتعلّمين بعدها.')) return; setBusy('cancel'); const { j } = await post({ action: 'cancel', session_id: id }); setBusy(''); if (j?.success) { await load(); onChanged?.(); } }
  if (err) return <p className="xb-muted" data-testid="rm-err">{err}</p>; if (!d) return null;
  const linked = d.weak.filter((w) => w.program_unit);
  return <div className="rm" data-testid="rm-root" data-ready={d.ready ? '1' : '0'}>
    {linked.length > 0 && <p className="rm-pu" data-testid="rm-pu">{linked.map((w) => <span key={w.code}><b dir="ltr">{w.code}</b> ↔ الوحدة البرنامجية {w.program_unit!.idx} «{w.program_unit!.title_ar}»{w.program_unit!.starts_on ? ` (من ${w.program_unit!.starts_on})` : ''}</span>)}</p>}
    <div className="rm-acts">
      {d.weak.length > 0 && <button type="button" className="xb-btn primary" onClick={start} disabled={!d.ready} data-testid="rm-open" title={d.ready ? '' : 'شغّل هجرة م6-ج أولًا'}><Icon name="calendar" size={14} /> جدوِل جلسة التعويض</button>}
      {!d.ready && <span className="xb-pill warn" data-testid="rm-notready">بانتظار هجرة م6-ج</span>}
      {ok && <span className="xb-pill ok" role="status" data-testid="rm-ok">{ok}</span>}
    </div>
    {d.sessions.length > 0 && <ul className="rm-list" data-testid="rm-sessions">{d.sessions.map((s) => { const past = new Date(s.starts_at).getTime() + s.duration_min * 60000 < Date.now(); return <li key={s.id} className="rm-s" data-testid="rm-session" data-past={past ? '1' : '0'}>
      <div className="rm-sh"><b>{s.title_ar}</b> <span className="xb-pill">{past ? 'انتهت' : s.status === 'live' ? 'الآن' : 'مجدولة'}</span> <span className="rm-sw">{fmt(s.starts_at)} · {s.duration_min} د · {PROV.find((p) => p[0] === s.provider)?.[1] || s.provider}</span> <span className="rm-sw">انضمّ: {s.joined}</span>
        {s.join_url && <a className="xb-btn sm" href={s.join_url} target="_blank" rel="noopener noreferrer">الرابط ↗</a>} <a className="xb-btn sm" href="/admin/live">البثّ المباشر</a> {!past && <button type="button" className="xb-btn sm danger" onClick={() => void cancel(s.id)} disabled={busy === 'cancel'} data-testid="rm-cancel">إلغاء</button>}</div>
      <div className="rm-units">{(s.miaar_unit_codes || []).map((c) => <span key={c} className="xb-hc" dir="ltr">{c}</span>)}</div>
      <ul className="rm-eff" data-testid="rm-effect">{s.effect.map((e) => <li key={e.code} data-n={e.n_retakes}>{e.text}</li>)}</ul>
    </li>; })}</ul>}
    {open && <div className="rm-ov" role="presentation" onClick={() => !busy && setOpen(false)}><div className="rm-modal" role="dialog" aria-modal="true" aria-labelledby="rm-h" onClick={(e) => e.stopPropagation()} data-testid="rm-modal">
      <div className="rm-mh"><h3 id="rm-h"><Icon name="calendar" size={16} /> {d.title.ar}</h3><button type="button" className="xb-btn sm" onClick={() => setOpen(false)} aria-label="إغلاق">✕</button></div>
      <p className="xb-muted">المستوى {d.invite.level}{d.classroom ? ` · القاعة ${d.classroom.code}` : ''}{d.trainer ? ` · المدرّس ${d.trainer.name}` : ''} — الجلسة تعويض لا إعادة حكم؛ النتيجة الرسمية والشهادة كما هما.</p>
      <fieldset className="rm-f"><legend>الوحدات (حتى {d.max_units})</legend><div className="rm-chips">{d.units.map((u) => <label key={u.code} data-testid="rm-unit" data-code={u.code} className={`rm-chip ${u.state || ''} ${codes.includes(u.code) ? 'on' : ''}`}><input type="checkbox" checked={codes.includes(u.code)} onChange={() => toggle(u.code)} data-testid="rm-unit" data-code={u.code} /> <b dir="ltr">{u.code}</b> {u.title_ar}{typeof u.percent === 'number' ? <small> {u.percent}%</small> : null}</label>)}</div></fieldset>
      <div className="rm-grid">
        <label>التاريخ<input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="rm-date" /></label>
        <label>الوقت (الرياض)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="rm-time" /></label>
        <label>المدّة (دقيقة)<input type="number" min={30} max={180} step={5} value={dur} onChange={(e) => { const v = Number(e.target.value) || 60; setDur(v); }} onBlur={() => void draft(codes, dur)} data-testid="rm-dur" /></label>
        <label>المنصّة<select value={prov} onChange={(e) => setProv(e.target.value)} data-testid="rm-prov">{PROV.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        {prov !== 'athar' && <label className="rm-wide">رابط الانضمام{prov === 'other' ? '' : ' (اختياري — يُضاف لاحقًا من البثّ المباشر)'}<input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" data-testid="rm-url" /></label>}
        <label className="rm-wide">عنوان الجلسة (كما يراه المتعلّم)<input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 140))} data-testid="rm-title" /></label>
      </div>
      <div className="rm-plan"><div className="xb-bar"><b>خطّة الدرس {planSrc === 'ai' ? <span className="xb-pill ok">حُسِّنت بالذكاء — راجعها</span> : planSrc === 'local' ? <span className="xb-pill">مسوَّدة من الواصفات وأخطاء المجموعة</span> : null}</b>
        <span className="xb-acts"><button type="button" className="xb-btn sm" onClick={() => void draft(codes, dur)} disabled={!!busy || !codes.length} data-testid="rm-draft">{busy === 'draft' ? '…' : 'أعد المسوَّدة'}</button><button type="button" className="xb-btn sm" onClick={() => void improve()} disabled={!!busy || plan.length < 80} data-testid="rm-improve"><Icon name="spark" size={13} /> {busy === 'ai' ? '…' : 'حسّن الخطّة بالذكاء'}</button></span></div>
        <textarea value={plan} onChange={(e) => { setPlan(e.target.value.slice(0, 6000)); if (planSrc === 'ai') setPlanSrc('local'); }} rows={12} dir="rtl" aria-label="خطّة الدرس" data-testid="rm-plan" />
        <small className="xb-muted">سطر يبدأ بـ «## » عنوان، و«- » نقطة. تُحفظ كما تعدّلها أنت — لا يُحفظ اقتراح الذكاء بلا مراجعتك.</small></div>
      {clash && <div className="rm-clash" role="alert" data-testid="rm-clash"><b>تعارض:</b> {clash.map((c) => `«${c.title_ar}» ${fmt(c.starts_at)}`).join(' · ')} — غيّر الموعد أو <button type="button" className="xb-btn sm" onClick={() => void create(true)} disabled={!!busy} data-testid="rm-force">جدوِل رغم التعارض</button></div>}
      {note && <p className="xb-err" role="alert" data-testid="rm-note">{note}</p>}
      <div className="xb-acts rm-foot"><button type="button" className="xb-btn primary" onClick={() => void create(false)} disabled={!!busy || !codes.length || !date || !time || title.length < 4} data-testid="rm-create"><Icon name="check" size={14} /> {busy === 'create' ? '…' : 'جدوِل الجلسة'}</button><button type="button" className="xb-btn" onClick={() => setOpen(false)} disabled={!!busy}>إلغاء</button></div>
    </div></div>}
  </div>;
}
export const RM_CSS = `
.rm{margin-top:10px;display:grid;gap:8px}.rm-pu{margin:0;font-size:12.5px;color:#475569;display:flex;flex-wrap:wrap;gap:4px 14px}.rm-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.rm-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.rm-s{border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:8px 10px;font-size:13px}.rm-s[data-past='1']{background:#f8fafc;border-color:#e2e8f0}.rm-sh{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}.rm-sw{color:#475569;font-size:12.5px}.rm-units{margin-top:4px;display:flex;gap:4px;flex-wrap:wrap}.rm-eff{list-style:none;margin:6px 0 0;padding:0;font-size:12.5px;color:#334155;display:grid;gap:2px}
.rm-ov{position:fixed;inset:0;background:rgba(15,42,78,.45);display:grid;place-items:center;padding:16px;z-index:120 /* فوق شريط التنقّل العام (100) */}.rm-modal{background:#fff;border-radius:16px;width:min(720px,100%);max-height:92vh;overflow:auto;padding:18px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);color:#0f2a4e}.rm-mh{display:flex;justify-content:space-between;align-items:center}.rm-mh h3{margin:0;display:flex;gap:6px;align-items:center}
.rm-f{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:0}.rm-f legend{font-size:12.5px;font-weight:800;color:#475569;padding:0 6px}.rm-chips{display:flex;flex-wrap:wrap;gap:6px}.rm-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:12.5px;cursor:pointer;background:#fff}.rm-chip.weak{border-color:#fca5a5}.rm-chip.on{background:#ecfdf5;border-color:#6ee7b7}.rm-chip b{font-family:ui-monospace,monospace;font-size:11px}.rm-chip small{color:#64748b}
.rm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.rm-grid label{display:grid;gap:3px;font-size:12.5px;font-weight:800;color:#475569}.rm-grid input,.rm-grid select{font:inherit;font-size:13.5px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;min-height:24px}.rm-wide{grid-column:1/-1}
.rm-plan{display:grid;gap:6px}.rm-plan textarea{font:inherit;font-size:13px;line-height:1.7;padding:10px;border:1px solid #cbd5e1;border-radius:10px;resize:vertical;min-height:200px}.rm-clash{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 10px;font-size:13px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}.rm-foot{justify-content:flex-start}.xb-err{color:#b91c1c;font-weight:800;font-size:13px;margin:0}
`;
