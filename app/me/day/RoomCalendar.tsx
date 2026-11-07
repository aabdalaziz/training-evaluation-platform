'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «تقويم الشعبة» — بطاقة داخل كل شعبة في «دفتر اليوم» (تُحمَّل ديناميكيًا)
 *  مطوية: سطر واحد (الطور اليوم · عدد الكتل والفترات · أو «بلا تقويم — البرنامج متّصل») · مفتوحة: شريط الكتل وفترات التطبيق ·
 *  «ما جرى في الميدان» (k ≥ 5، بلا أسماء: N وثّقوا · أكثر ما طُبّق · أكثر ما منع) · من كتب سطر اليوم (عدد) · التزامات تنتظر العودة (عدد)
 *  الإدخال بثلاث طرق: لصق تواريخ · N أيام من تاريخ · نمط (كتلة L أيام كل W أسبوعًا × B) — معاينة قبل الحفظ · حذف التقويم يعيد البرنامج متّصلًا
 *  testids: rc-root[data-has][data-phase] rc-toggle rc-summary rc-strip rc-seg[data-kind] rc-field rc-field-line rc-field-blocker rc-field-below rc-edit rc-mode rc-text rc-start rc-n rc-blen rc-every rc-blocks rc-preview rc-save rc-clear rc-ok rc-err
 */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';
import { parseDays, expandDays, patternDays, deriveCalendar, phaseOf, dayKey, fmtShortAr, P66_NAMES_AR } from '../../../lib/calendar/registry';
import type { Calendar, DayPhase, FieldSummary } from '../../../lib/calendar/registry';

type View = { calendar: Calendar | null; phase: DayPhase; roster: number; field: FieldSummary | null; field_apply_no: number | null; learn_today: number; commits_pending: number };
type Props = { roomId: string; code: string; hdr: () => Promise<Record<string, string> | null>; readOnly?: boolean; autoOpen?: boolean };
type Mode = 'text' | 'n' | 'pattern';
const PHASE_AR: Record<string, string> = { training: 'يوم تدريب', apply: P66_NAMES_AR.apply, rest: 'استراحة', before: 'قبل البداية', after: 'انتهى', none: '' };

export default function RoomCalendar({ roomId, code, hdr, readOnly, autoOpen }: Props) {
  const [open, setOpen] = useState(!!autoOpen); const [v, setV] = useState<View | null>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false); const [mode, setMode] = useState<Mode>('pattern'); const [text, setText] = useState(''); const [start, setStart] = useState(''); const [n, setN] = useState('5'); const [blen, setBlen] = useState('5'); const [every, setEvery] = useState('4'); const [blocks, setBlocks] = useState('3');
  const load = useCallback(async () => { const H = await hdr(); if (!H) return; const j = await fetch(`/api/me/calendar?room=${encodeURIComponent(roomId)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) { setV(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح التقويم'); }, [hdr, roomId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (autoOpen) { setOpen(true); setTimeout(() => { try { document.getElementById(`calendar-${roomId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { /* لا شيء */ } }, 300); } }, [autoOpen, roomId]);
  const previewDays = mode === 'text' ? parseDays(text) : mode === 'n' ? expandDays(start, Number(n)) : patternDays(start, Number(blen), Number(every), Number(blocks));
  const preview = previewDays.length ? deriveCalendar(previewDays) : null; const today = dayKey(new Date());
  async function save() {
    if (!preview) return; if (!window.confirm(`حفظ تقويم شعبة ${code}: ${preview.days.length} يوم تدريب في ${preview.blocks.length} ${preview.blocks.length === 1 ? 'كتلة' : 'كتل'}${preview.applies.length ? ` و${preview.applies.length} ${preview.applies.length === 1 ? 'فترة تطبيق' : 'فترات تطبيق'}` : ''}؟ يستبدل التقويم السابق إن وُجد.`)) return;
    setBusy(true); const H = await hdr(); if (!H) { setBusy(false); return; } const j = await fetch('/api/me/calendar', { method: 'POST', headers: H, body: JSON.stringify({ action: 'save', classroom_id: roomId, days: preview.days }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setOk('حُفظ التقويم — سيعرف متدرّبوك متى تلتقون ومتى يطبّقون.'); setEdit(false); setText(''); void load(); setTimeout(() => setOk(''), 7000); } else setErr(j?.error || 'تعذّر الحفظ');
  }
  async function clear() {
    if (!window.confirm(`إزالة تقويم شعبة ${code}؟ يعود البرنامج متّصلًا من بدايته إلى نهايته. سطور المتدرّبين تبقى.`)) return;
    setBusy(true); const H = await hdr(); if (!H) { setBusy(false); return; } const j = await fetch('/api/me/calendar', { method: 'POST', headers: H, body: JSON.stringify({ action: 'clear', classroom_id: roomId }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setOk('أُزيل التقويم.'); void load(); setTimeout(() => setOk(''), 7000); } else setErr(j?.error || 'تعذّر الحذف');
  }
  const cal = v?.calendar || null; const ph = v?.phase;
  const summary = !v ? '…' : !cal ? 'بلا تقويم — البرنامج متّصل من بدايته إلى نهايته' : `${PHASE_AR[ph!.phase] || ''}${ph!.phase === 'apply' && ph!.apply ? ` · الأسبوع ${ph!.apply.week_no} من ${ph!.apply.weeks} · تعود الكتلة ${fmtShortAr(ph!.apply.next_block_start)}` : ''}${ph!.phase === 'training' && ph!.block ? ` · الكتلة ${ph!.block.no} — اليوم ${ph!.block.day_idx} من ${ph!.block.len}` : ''} · ${cal.days.length} يومًا في ${cal.blocks.length} ${cal.blocks.length === 1 ? 'كتلة' : 'كتل'}${cal.applies.length ? ` · ${cal.applies.length} ${cal.applies.length === 1 ? 'فترة تطبيق' : 'فترات تطبيق'}` : ''}`;
  return <div className="rc" id={`calendar-${roomId}`} data-testid="rc-root" data-has={cal ? 1 : 0} data-phase={ph?.phase || ''}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <button type="button" className="rc-toggle" data-testid="rc-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="calendar" size={15} /> {P66_NAMES_AR.cal} <span className="rc-sum" data-testid="rc-summary">{summary}</span><span className="rc-chev" aria-hidden="true">{open ? '▴' : '▾'}</span></button>
    {open && <div className="rc-body">
      {err && <p className="rc-err" role="alert" data-testid="rc-err">{err}</p>}
      {ok && <p className="rc-ok" role="status" data-testid="rc-ok">{ok}</p>}
      {cal && <Strip cal={cal} today={today} />}
      {cal && v && <div className="rc-cells">
        <div className="rc-cell" data-testid="rc-field"><h4>{P66_NAMES_AR.field} {v.field_apply_no ? <small>فترة التطبيق {v.field_apply_no}</small> : null}</h4>
          {!v.field && <p className="rc-muted">تظهر هنا — مجمَّعةً بلا أسماء — سطور «ماذا طبّقتُ / ما الذي منعني» حين تبدأ أول فترة تطبيق.</p>}
          {v.field && <>
            <p className="rc-head">{v.field.head_ar}</p>
            {v.field.shown && v.field.applied.length > 0 && <><h5>أكثر ما طُبّق</h5><ul className="rc-lines">{v.field.applied.map((l, i) => <li key={i} data-testid="rc-field-line">{l}</li>)}</ul></>}
            {v.field.shown && v.field.blockers.length > 0 && <><h5>أكثر ما منع التطبيق</h5><ul className="rc-lines rc-block">{v.field.blockers.map((l, i) => <li key={i} data-testid="rc-field-blocker">{l}</li>)}</ul></>}
            {v.field.below_ar && <p className="rc-muted" data-testid="rc-field-below">{v.field.below_ar}</p>}
            {v.field.shown && <p className="rc-muted">ابدأ الكتلة القادمة بهذه السطور: ما نجح، وما منعهم — فهذا منهجك الحقيقي.</p>}
          </>}
        </div>
        <div className="rc-cell"><h4>اليوم</h4>
          {ph?.phase === 'training' && <p>كتب «سطر اليوم» <b>{v.learn_today}</b> من {v.roster}.</p>}
          {ph?.phase === 'apply' && ph.apply && <p>متدرّبوك في مواقعهم — الأسبوع {ph.apply.week_no} من {ph.apply.weeks}. يصلك «{P66_NAMES_AR.field}» قبل العودة بثلاثة أيام.</p>}
          {ph?.phase === 'before' && ph.next && <p>يبدأ أول يوم {fmtShortAr(ph.next.start)}.</p>}
          {ph?.phase === 'after' && <p>انتهى التقويم — ما بعده في «يوم تخرّجي» و«ما بعد البرنامج».</p>}
          {ph?.phase === 'rest' && <p>استراحة قصيرة — لا شيء يُطلب من أحد.</p>}
          {v.commits_pending > 0 && <p className="rc-muted">التزامات «حتى نلتقي» تنتظر يوم العودة: {v.commits_pending} — يُفتح كلٌّ لصاحبه وحده؛ أنت ترى العدد فقط.</p>}
        </div>
      </div>}
      {!cal && <p className="rc-muted">إن كانت أيام هذا البرنامج موزّعة على كتل تفصلها أسابيع عمل، ضع التقويم هنا: يعرف المتدرّب متى يلتقيكم ومتى يطبّق، ويتحوّل «سطر اليوم» في الفجوات إلى «سطر التطبيق» الأسبوعي، ويصلك قبل كل كتلة «{P66_NAMES_AR.field}».</p>}
      {!readOnly && !edit && <div className="rc-row"><button type="button" className="rc-btn" data-testid="rc-edit" onClick={() => setEdit(true)}>{cal ? 'تعديل التقويم' : 'ضع تقويم الشعبة'}</button>{cal && <button type="button" className="rc-btn rc-ghost" data-testid="rc-clear" disabled={busy} onClick={clear}>إزالة التقويم</button>}</div>}
      {!readOnly && edit && <div className="rc-edit">
        <div className="rc-tabs" role="tablist" data-testid="rc-mode">{(['pattern', 'n', 'text'] as Mode[]).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} className={`rc-tab${mode === m ? ' on' : ''}`} onClick={() => setMode(m)}>{m === 'pattern' ? 'نمط كتل' : m === 'n' ? 'N أيام من تاريخ' : 'لصق تواريخ'}</button>)}</div>
        {mode !== 'text' && <label className="rc-f">يبدأ في <input type="date" data-testid="rc-start" value={start} onChange={(e) => setStart(e.target.value)} /></label>}
        {mode === 'n' && <label className="rc-f">عدد أيام التدريب <input type="number" min={1} max={400} data-testid="rc-n" value={n} onChange={(e) => setN(e.target.value)} /></label>}
        {mode === 'pattern' && <div className="rc-frow"><label className="rc-f">أيام الكتلة <input type="number" min={1} max={30} data-testid="rc-blen" value={blen} onChange={(e) => setBlen(e.target.value)} /></label><label className="rc-f">كل كم أسبوعًا <input type="number" min={1} max={26} data-testid="rc-every" value={every} onChange={(e) => setEvery(e.target.value)} /></label><label className="rc-f">عدد الكتل <input type="number" min={1} max={24} data-testid="rc-blocks" value={blocks} onChange={(e) => setBlocks(e.target.value)} /></label></div>}
        {mode === 'text' && <textarea data-testid="rc-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="الصق التواريخ بأي صيغة: 2026-01-05 أو 5/1/2026 — سطر لكل يوم أو مفصولة بمسافات" />}
        <p className="rc-muted">الجمعة والسبت تُتخطّى تلقائيًا في «N أيام» و«نمط كتل». أيام متتالية (تفصلها عطلة ≤ يومين) = كتلة واحدة؛ فجوة ≥ 7 أيام = فترة تطبيق.</p>
        {preview && <div data-testid="rc-preview"><p className="rc-head">معاينة: {preview.days.length} يومًا · {preview.blocks.length} {preview.blocks.length === 1 ? 'كتلة' : 'كتل'} · {preview.applies.length} {preview.applies.length === 1 ? 'فترة تطبيق' : 'فترات تطبيق'} · من {fmtShortAr(preview.first!)} إلى {fmtShortAr(preview.last!)}</p><Strip cal={preview} today={today} /></div>}
        <div className="rc-row"><button type="button" className="rc-btn rc-primary" data-testid="rc-save" disabled={!preview || busy} onClick={save}>احفظ التقويم</button><button type="button" className="rc-btn rc-ghost" onClick={() => setEdit(false)}>إلغاء</button></div>
      </div>}
    </div>}
  </div>;
}

function Strip({ cal, today }: { cal: Calendar; today: string }) {
  const segs: Array<{ kind: 'block' | 'apply'; label: string; sub: string; state: 'done' | 'now' | 'next'; w: number }> = [];
  for (const b of cal.blocks) { segs.push({ kind: 'block', label: `كتلة ${b.no}`, sub: `${fmtShortAr(b.start)}${b.days.length > 1 ? `–${fmtShortAr(b.end)}` : ''} · ${b.days.length} ي`, state: today > b.end ? 'done' : today >= b.start ? 'now' : 'next', w: Math.max(1, b.days.length) });
    const a = cal.applies.find((x) => x.after_block === b.no); if (a) segs.push({ kind: 'apply', label: 'تطبيق', sub: `${a.weeks} أسبوع`, state: today > a.to ? 'done' : today >= a.from ? 'now' : 'next', w: Math.max(2, Math.min(8, a.weeks * 2)) }); }
  return <ol className="rc-strip" data-testid="rc-strip" aria-label="الكتل وفترات التطبيق">{segs.map((s, i) => <li key={i} className={`rc-seg ${s.kind} ${s.state}`} data-testid="rc-seg" data-kind={s.kind} data-state={s.state} style={{ flexGrow: s.w }}><b>{s.label}</b><span>{s.sub}</span></li>)}</ol>;
}

const CSS = `
.rc{margin-top:10px;border-top:1px dashed #e2e8f0;padding-top:8px}.rc *{box-sizing:border-box}
.rc-toggle{width:100%;display:flex;align-items:center;gap:8px;border:0;background:transparent;font:inherit;font-weight:800;color:#0f2a4e;cursor:pointer;padding:6px 0;text-align:start}.rc-sum{font-weight:600;color:#64748b;font-size:12.5px;flex:1;min-width:0}.rc-chev{color:#94a3b8}
.rc-body{padding:4px 0 2px}.rc-muted{color:#64748b;font-size:12.5px;line-height:1.8;margin:4px 0}.rc-head{margin:4px 0;font-weight:800;color:#0f2a4e;font-size:14px}
.rc-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;margin:6px 0;font-weight:800;font-size:13px}.rc-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;margin:6px 0;font-weight:800;font-size:13px}
.rc-strip{list-style:none;padding:0;margin:8px 0;display:flex;gap:4px;flex-wrap:wrap}.rc-seg{flex:1 1 60px;border-radius:10px;padding:5px 8px;font-size:11px;border:1px solid #e2e8f0;background:#f8fafc;min-width:70px}.rc-seg b{display:block;font-size:12px;color:#0f2a4e}.rc-seg span{color:#64748b}.rc-seg.apply{background:#fffbeb;border-color:#fde68a}.rc-seg.now{outline:2px solid #0f2a4e;outline-offset:1px}.rc-seg.done{opacity:.55}
.rc-cells{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}.rc-cell{border:1px solid #eef2f7;border-radius:12px;padding:10px 12px;background:#fff}.rc-cell h4{margin:0 0 4px;font-size:14px;color:#0f2a4e}.rc-cell h4 small{font-weight:600;color:#64748b;font-size:11px}.rc-cell h5{margin:8px 0 2px;font-size:12.5px;color:#334155}.rc-cell p{margin:4px 0;font-size:13.5px;line-height:1.8}
.rc-lines{list-style:none;padding:0;margin:0;display:grid;gap:5px}.rc-lines li{background:linear-gradient(160deg,#fffbeb,#fff);border:1px solid #fde68a;border-radius:10px;padding:6px 10px;font-size:13.5px;line-height:1.8;font-weight:600;color:#3b1d0e}.rc-block li{background:#f8fafc;border-color:#e2e8f0;color:#334155}
.rc-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.rc-btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 14px;font:inherit;font-size:13px;font-weight:800;color:#0f2a4e;cursor:pointer}.rc-btn:disabled{opacity:.5;cursor:default}.rc-primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.rc-ghost{color:#64748b}
.rc-edit{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-top:8px;background:#fafbfc}.rc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.rc-tab{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 11px;font:inherit;font-size:12.5px;font-weight:800;color:#334155;cursor:pointer}.rc-tab.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.rc-f{display:inline-flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:700;color:#334155;margin:4px 8px 4px 0}.rc-f input{border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font:inherit;font-size:14px;min-width:120px}.rc-frow{display:flex;gap:4px;flex-wrap:wrap}
.rc textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;line-height:1.7;resize:vertical}
@media (max-width:640px){.rc-cells{grid-template-columns:1fr}}
`;
