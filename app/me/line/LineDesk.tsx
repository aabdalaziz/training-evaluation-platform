'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «أيام التدريب وفترات التطبيق» — مكتب المتدرّب «سطري» (يُحمَّل ديناميكيًا بلا SSR)
 *  لكل شعبة من شُعبي: كلمة أَثَر القصيرة بحسب الطور · «الطريق» (الكتل وفترات التطبيق) ·
 *   يوم تدريب → «سطر اليوم» (واحد لليوم، يُعدَّل في يومه) · آخر يوم الكتلة → «التزامي حتى نلتقي» · فترة تطبيق → «سطر التطبيق» الأسبوعي (ماذا طبّقتُ / ما الذي منعني) + موقف ميداني
 *   «هذا ما وعدتَ به نفسك» حين يُفتح التزام (يوم العودة) → فعلت / جزئيًا / لم أفعل بعد · سطوري (آخر 60) · حذف فوري
 *  testids: ln-root ln-err ln-ok ln-empty ln-room[data-phase] ln-athar ln-road ln-write[data-kind] ln-ta ln-blocker ln-save ln-written ln-commit-open ln-commit-yes ln-commit-part ln-commit-no ln-lines ln-line ln-field-case ln-foot
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import type { MyRoom, MyLine } from '../../../lib/calendar/store';
import type { LineKind } from '../../../lib/calendar/registry';

type Data = { rooms: MyRoom[]; today: string; names: Record<string, string>; prompts: Record<LineKind, { title: string; hint: string; blocker?: string }>; limits: { lineMin: number; lineMax: number; k: number }; foot_ar: string; field_case_path: string };
const PHASE_AR: Record<string, string> = { training: 'يوم تدريب', apply: 'البرنامج معك في موقعك', rest: 'استراحة قصيرة', before: 'قبل البداية', after: 'انتهى البرنامج', none: '' };
const KIND_AR: Record<LineKind, string> = { learn: 'سطر اليوم', apply: 'سطر التطبيق', commit: 'التزامي حتى نلتقي' };

export default function LineDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [text, setText] = useState<Record<string, string>>({}); const [blocker, setBlocker] = useState<Record<string, string>>({}); const [kindSel, setKindSel] = useState<Record<string, LineKind>>({});
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => {
    const j = await fetch('/api/me/line', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح الصفحة');
  }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 7000); };
  async function post(body: Record<string, unknown>): Promise<any> { setBusy(true); const j = await fetch('/api/me/line', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); setBusy(false); return j; }
  async function save(r: MyRoom, kind: LineKind) {
    const body_ar = (text[`${r.classroom_id}:${kind}`] || '').trim(); const blocker_ar = (blocker[r.classroom_id] || '').trim();
    const j = await post({ action: 'line', classroom_id: r.classroom_id, kind, body_ar, blocker_ar: kind === 'apply' && blocker_ar ? blocker_ar : undefined });
    if (j?.success) { setText((s) => ({ ...s, [`${r.classroom_id}:${kind}`]: '' })); setBlocker((s) => ({ ...s, [r.classroom_id]: '' })); flash(kind === 'commit' ? `خُتم التزامك — يُفتح لك ${j.line.opens_ar || 'أول يوم الكتلة القادمة'}.` : j.updated ? 'عُدّل سطرك.' : 'حُفظ سطرك.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر الحفظ');
  }
  async function answer(l: MyLine, done: 'yes' | 'part' | 'no') { const j = await post({ action: 'commit', id: l.id, done }); if (j?.success) { flash('سُجّلت إجابتك — لك وحدك.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر الحفظ'); }
  async function del(l: MyLine) { if (!confirm('يُحذف السطر فورًا ولا يُسترجع. نتابع؟')) return; const j = await post({ action: 'delete', id: l.id }); if (j?.success) { flash('حُذف.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر الحذف'); }
  return <main className="ln" dir="rtl" data-testid="ln-root">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="ln-nav" aria-label="تنقّل"><Link href="/me" className="ln-link"><Icon name="arrow" size={14} /> ملفّي</Link><Link href="/me/first" className="ln-link"><Icon name="spark" size={14} /> أول يوم</Link><Link href="/me/letter" className="ln-link"><Icon name="mail" size={14} /> رسالة إلى نفسي</Link><Link href="/me/grad" className="ln-link"><Icon name="award" size={14} /> يوم تخرّجي</Link></nav>
    <header className="ln-head"><span className="pt-kicker"><Icon name="edit" size={14} /> سجلّ التعلّم والتطبيق للمتدرّب</span><h1>✍️ {d?.names.page || 'سطري'} <small>سطر في يوم التدريب · سطر في الأسبوع من موقعك</small></h1>
      <p>في أيام التدريب تكتب سطرًا واحدًا: ماذا أخذتَ من اليوم. وحين تعود إلى موقعك بين الكتل يصبح البرنامج معك هناك: سطر في الأسبوع — ماذا طبّقتَ وما الذي منعك — وموقف ميداني تكتب كيف تصرّفت فيه فعلًا. مدرّبك يرى المجمَّع بلا أسماء، ويبدأ الكتلة القادمة بما جرى في مواقعكم.</p></header>
    {err && <p className="ln-err" role="alert" data-testid="ln-err">{err}</p>}
    {msg && <p className="ln-ok" role="status" data-testid="ln-ok">{msg}</p>}
    {!tok && tok !== null && <section className="pt-box"><p>سجّل الدخول لتكتب سطرك. <Link href="/me">مساحتي</Link></p></section>}
    {d && !d.rooms.length && <section className="pt-box ln-empty" data-testid="ln-empty"><b>لستَ في شعبة بعد.</b><p className="ln-muted">حين تُوضع في شعبة برنامج يظهر هنا سطرك اليومي، وفترات التطبيق إن كان البرنامج موزّعًا على كتل.</p></section>}
    {d && d.rooms.map((r) => { const ph = r.phase; const kinds = r.allowed; const kind = kindSel[r.classroom_id] && kinds.includes(kindSel[r.classroom_id]) ? kindSel[r.classroom_id] : kinds[0]; const key = `${r.classroom_id}:${kind}`; const t = text[key] || ''; const ok = t.trim().length >= d.limits.lineMin && t.trim().length <= d.limits.lineMax;
      return <section key={r.classroom_id} className="ln-room" data-testid="ln-room" data-phase={ph.phase} data-room={r.classroom_id} aria-labelledby={`ln-h-${r.classroom_id}`}>
        <div className="ln-roomhead"><div><h2 id={`ln-h-${r.classroom_id}`}>{r.program_ar}</h2><span className="ln-code">شعبة {r.code || '—'} · {PHASE_AR[ph.phase] || ''}{ph.phase === 'apply' && ph.apply ? ` · الأسبوع ${ph.apply.week_no} من ${ph.apply.weeks}` : ''}{ph.phase === 'training' && ph.block ? ` · الكتلة ${ph.block.no} — اليوم ${ph.block.day_idx} من ${ph.block.len}` : ''}</span></div>
          <div className="ln-counts" aria-label="أعدادي">{r.counts.learn ? <span>سطور الأيام {r.counts.learn}</span> : null}{r.counts.apply ? <span>سطور التطبيق {r.counts.apply}</span> : null}{r.counts.commit ? <span>التزامات {r.counts.commit}</span> : null}</div></div>
        {r.athar_ar && <p className="ln-athar" data-testid="ln-athar"><Icon name="star" size={14} /> {r.athar_ar} <span className="ln-sign">— أَثَر</span></p>}
        {r.commit_open && <div className="ln-commit" data-testid="ln-commit-open" role="group" aria-label="التزامي">
          <h3>✉️ هذا ما وعدتَ به نفسك {r.commit_open.day_ar && <small>كتبتَه {r.commit_open.day_ar}</small>}</h3>
          <blockquote>{r.commit_open.body_ar}</blockquote>
          <p className="ln-muted">هل فعلت؟ الإجابة لك وحدك — لا يراها مدرّبك ولا تدخل في أي تقييم.</p>
          <div className="ln-row"><button type="button" className="ln-btn ln-yes" data-testid="ln-commit-yes" disabled={busy} onClick={() => answer(r.commit_open!, 'yes')}>فعلت</button><button type="button" className="ln-btn" data-testid="ln-commit-part" disabled={busy} onClick={() => answer(r.commit_open!, 'part')}>جزئيًا</button><button type="button" className="ln-btn ln-ghost" data-testid="ln-commit-no" disabled={busy} onClick={() => answer(r.commit_open!, 'no')}>لم أفعل بعد</button></div>
        </div>}
        {kinds.length > 0 && <div className="ln-write" data-testid="ln-write" data-kind={kind}>
          {kinds.length > 1 && <div className="ln-tabs" role="tablist">{kinds.map((k) => <button key={k} type="button" role="tab" aria-selected={k === kind} className={`ln-tab${k === kind ? ' on' : ''}`} onClick={() => setKindSel((s) => ({ ...s, [r.classroom_id]: k }))}>{KIND_AR[k]}</button>)}</div>}
          <h3>{d.prompts[kind].title} {r.written_today[kind] && <small data-testid="ln-written">— كتبتَه {kind === 'apply' ? 'هذا الأسبوع' : 'اليوم'} (يمكنك تعديله)</small>}</h3>
          <p className="ln-muted">{d.prompts[kind].hint}</p>
          <textarea data-testid="ln-ta" value={t} onChange={(e) => setText((s) => ({ ...s, [key]: e.target.value }))} maxLength={d.limits.lineMax} rows={2} placeholder="سطر واحد…" aria-label={d.prompts[kind].title} />
          {kind === 'apply' && <input data-testid="ln-blocker" className="ln-input" value={blocker[r.classroom_id] || ''} onChange={(e) => setBlocker((s) => ({ ...s, [r.classroom_id]: e.target.value }))} maxLength={d.limits.lineMax} placeholder={d.prompts.apply.blocker} aria-label={d.prompts.apply.blocker} />}
          <div className="ln-row"><span className="ln-muted">{t.trim().length}/{d.limits.lineMax}</span><button type="button" className="ln-btn ln-primary" data-testid="ln-save" disabled={!ok || busy} onClick={() => save(r, kind)}>{kind === 'commit' ? 'اختم التزامي' : r.written_today[kind] ? 'عدّل سطري' : 'احفظ سطري'}</button></div>
          {kind === 'apply' && <p className="ln-muted">وموقف ميداني من مجال كتلتك الأخيرة: <a className="ln-link" href={d.field_case_path} data-testid="ln-field-case"><Icon name="compass" size={13} /> موقف اليوم</a> — اكتب كيف تصرّفت فعلًا، لا كيف يُفترض.</p>}
        </div>}
        {kinds.length === 0 && ph.phase !== 'after' && <p className="ln-muted ln-quiet">{ph.phase === 'before' ? 'يبدأ قريبًا — أول سطر لك يوم أول تدريب.' : ph.phase === 'rest' ? 'لا شيء يُطلب منك اليوم.' : ph.phase === 'none' ? 'لا تاريخ لهذا البرنامج بعد.' : ''}</p>}
        {r.road.length > 0 && <ol className="ln-road" data-testid="ln-road" aria-label="الطريق">{r.road.map((s, i) => <li key={i} className={`ln-step ${s.state}`}><b>{s.label}</b><span>{s.sub}</span></li>)}</ol>}
        {r.lines.length > 0 && <details className="ln-mine" open={r.lines.length <= 6}><summary>سطوري ({r.lines.length})</summary>
          <ul className="ln-lines" data-testid="ln-lines">{r.lines.map((l) => <li key={l.id} data-testid="ln-line" data-kind={l.kind}><span className="ln-tag">{KIND_AR[l.kind]}{l.week_no ? ` · أسبوع ${l.week_no}` : ''}{l.block_no && l.kind !== 'apply' ? ` · كتلة ${l.block_no}` : ''}</span><b>{l.body_ar}</b>{l.blocker_ar && <i>ما منعني: {l.blocker_ar}</i>}{l.kind === 'commit' && (l.done ? <i>أجبت: {l.done_ar}</i> : <i>{l.open ? 'مفتوح — أجب أعلاه' : `يُفتح ${l.opens_ar}`}</i>)}<small>{l.day_ar}</small><button type="button" className="ln-x" aria-label="حذف" onClick={() => del(l)}>حذف</button></li>)}</ul></details>}
      </section>; })}
    {d && <p className="ln-foot" data-testid="ln-foot"><Icon name="shield" size={13} /> {d.foot_ar}</p>}
  </main>;
}

const CSS = `
.ln{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:920px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.ln *{box-sizing:border-box}
.ln-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.ln-link{color:#0f2a4e;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.ln-link:hover{text-decoration:underline}
.ln-head h1{margin:4px 0 6px;font-size:30px;color:#0f2a4e}.ln-head h1 small{display:block;font-size:14px;color:#b45309;font-weight:800;margin-top:2px}.ln-head p{margin:0 0 14px;color:#475569;line-height:1.9;max-width:760px}
.ln-muted{color:#64748b;font-size:13px;line-height:1.8;margin:4px 0}.ln-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.ln-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.ln-room{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px 18px;margin:0 0 14px}.ln-room[data-phase=apply]{border-color:#fcd34d;background:linear-gradient(170deg,#fffdf5,#fff)}
.ln-roomhead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.ln-roomhead h2{margin:0;font-size:19px;color:#0f2a4e}.ln-code{display:block;color:#64748b;font-size:12.5px;font-weight:700;margin-top:2px}
.ln-counts{display:flex;gap:10px;flex-wrap:wrap;color:#475569;font-size:12px;font-weight:700}.ln-counts span{background:#f1f5f9;border-radius:999px;padding:3px 10px}
.ln-athar{margin:10px 0 6px;background:linear-gradient(160deg,#0f2a4e,#1e3a5f);color:#fff;border-radius:14px;padding:10px 14px;line-height:1.9;font-size:15px;display:flex;gap:8px;align-items:flex-start}.ln-sign{color:#fcd34d;font-weight:800;margin-inline-start:auto;white-space:nowrap}
.ln-commit{background:linear-gradient(160deg,#fffbeb,#fff);border:1px solid #fcd34d;border-radius:14px;padding:12px 14px;margin:10px 0}.ln-commit h3{margin:0 0 6px;font-size:16px;color:#78350f}.ln-commit h3 small{font-weight:600;font-size:12px;color:#92400e}.ln-commit blockquote{margin:6px 0;font-size:17px;line-height:1.9;font-weight:700;color:#3b1d0e}
.ln-write{border-top:1px dashed #e2e8f0;margin-top:10px;padding-top:10px}.ln-write h3{margin:0 0 4px;font-size:16px;color:#0f2a4e}.ln-write h3 small{font-weight:600;font-size:12px;color:#166534}
.ln-tabs{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}.ln-tab{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.ln-tab.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.ln textarea,.ln-input{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;line-height:1.8;resize:vertical;margin:4px 0}.ln-input{font-size:14px}
.ln-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}
.ln-btn{border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:9px 16px;font:inherit;font-weight:800;color:#0f2a4e;cursor:pointer}.ln-btn:disabled{opacity:.5;cursor:default}.ln-primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ln-yes{background:#166534;color:#fff;border-color:#166534}.ln-ghost{color:#64748b}
.ln-quiet{margin-top:8px}
.ln-road{list-style:none;padding:0;margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap}.ln-step{border:1px solid #e2e8f0;border-radius:12px;padding:6px 10px;font-size:12px;min-width:130px;background:#f8fafc}.ln-step b{display:block;color:#0f2a4e;font-size:13px}.ln-step span{color:#64748b}.ln-step.now{border-color:#fcd34d;background:#fffbeb}.ln-step.done{opacity:.65}
.ln-mine{margin-top:10px}.ln-mine summary{cursor:pointer;font-weight:800;color:#0f2a4e;font-size:14px}
.ln-lines{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}.ln-lines li{position:relative;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;padding-inline-end:56px;line-height:1.8}.ln-lines b{display:block;font-size:15px;color:#0f172a}.ln-lines i{display:block;font-style:normal;color:#92400e;font-size:13px}.ln-lines small{color:#94a3b8;font-size:11px}.ln-tag{display:inline-block;background:#e2e8f0;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800;color:#334155;margin-bottom:2px}
.ln-x{position:absolute;top:8px;inset-inline-end:8px;border:0;background:transparent;color:#94a3b8;font:inherit;font-size:12px;cursor:pointer}.ln-x:hover{color:#b91c1c}
.ln-foot{margin:16px 0 0;color:#64748b;font-size:12.5px;line-height:1.8;display:flex;gap:6px;align-items:flex-start}
@media (max-width:640px){.ln-head h1{font-size:24px}.ln-room{padding:12px}}
`;
