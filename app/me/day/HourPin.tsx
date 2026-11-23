'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P73 «ساعة أَثَر» — بطاقة التثبيت داخل كل شعبة في «دفتر اليوم» (تُحمَّل ديناميكيًا)
 *  غير مثبَّتة: يختار الأستاذ يوم الأسبوع والوقت (لا افتراضي) → تُولَّد جلسات أسبوعية حتى نهاية البرنامج ويُخبَر المشاركون
 *  مثبَّتة: «كل الثلاثاء 10:30 · القادمة …» + الطور الآن + «افتح الغرفة» / «شاشة القاعة» + إلغاء المواعيد القادمة
 *  testids: hp-root[data-has][data-phase] hp-weekday hp-time hp-save hp-clear hp-next hp-open hp-screen hp-ok hp-err
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { WEEKDAYS_AR, PHASE_AR, fmtDayAr } from '../../../lib/hour/registry';
import type { HourView } from '../../../lib/hour/store';

type Props = { roomId: string; code: string; hdr: () => Promise<Record<string, string> | null>; readOnly?: boolean };

export default function HourPin({ roomId, code, hdr, readOnly }: Props) {
  const [v, setV] = useState<HourView | null>(null); const [weekday, setWeekday] = useState(''); const [time, setTime] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(''); const [err, setErr] = useState(''); const [edit, setEdit] = useState(false);
  const load = useCallback(async () => { const H = await hdr(); if (!H) return; const j = await fetch(`/api/me/hour?classroom=${encodeURIComponent(roomId)}`, { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setV(j); }, [hdr, roomId]);
  useEffect(() => { void load(); }, [load]);
  async function post(body: Record<string, unknown>, done: string) {
    setBusy(true); setErr(''); const H = await hdr(); if (!H) { setBusy(false); return; }
    const j = await fetch('/api/me/hour', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, classroom_id: roomId }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setOk(done.replace('{n}', String(j.count || '')).replace('{first}', j.first ? fmtDayAr(j.first) : '')); setEdit(false); void load(); setTimeout(() => setOk(''), 8000); } else setErr(j?.error || 'تعذّر');
  }
  const pin = v?.pin || null; const ph = v?.phase.phase || 'none';
  return <div className="hp" id={`hour-${roomId}`} data-testid="hp-root" data-has={pin ? 1 : 0} data-phase={ph}>
    <div className="hp-row"><b>🕰️ ساعة أَثَر</b>
      {pin ? <span className="hp-sum">كل {WEEKDAYS_AR[pin.weekday]} {pin.time} · <i data-testid="hp-next">{ph === 'open' ? 'مفتوحة الآن' : pin.next ? `القادمة ${fmtDayAr(pin.next.day)}` : PHASE_AR[ph]}</i></span> : <span className="hp-sum muted">لم تُثبَّت بعد — ساعة أسبوعية بلا تعليم ولا تصحيح</span>}
      <span className="hp-acts no-print">
        {pin && <Link href={`/me/hour?classroom=${roomId}`} className="dy-btn sm" data-testid="hp-open">افتح الغرفة</Link>}
        {pin && ph === 'open' && <a href={`/me/hour?classroom=${roomId}&screen=1`} target="_blank" rel="noreferrer" className="dy-btn sm ghost" data-testid="hp-screen">🖥️ شاشة القاعة</a>}
        {!readOnly && !edit && <button type="button" className="dy-btn sm ghost" onClick={() => setEdit(true)} data-testid="hp-edit">{pin ? 'غيّر الموعد' : 'ثبّت ساعة أَثَر'}</button>}
        {!readOnly && pin && <button type="button" className="dy-btn sm ghost" disabled={busy} data-testid="hp-clear" onClick={() => { if (confirm(`إلغاء مواعيد ساعة أَثَر القادمة لشعبة ${code}؟ ما خُتم يبقى.`)) void post({ action: 'unpin' }, 'أُلغيت المواعيد القادمة.'); }}>إلغاء</button>}
      </span></div>
    {edit && !readOnly && <form className="hp-form no-print" onSubmit={(e) => { e.preventDefault(); if (weekday === '' || !time) { setErr('اختر اليوم والوقت'); return; } if (confirm(`تثبيت ساعة أَثَر لشعبة ${code}: كل ${WEEKDAYS_AR[Number(weekday)]} الساعة ${time} حتى نهاية البرنامج — ويُخبَر المشاركون. نتابع؟`)) void post({ action: 'pin', weekday: Number(weekday), time }, 'ثُبّتت الساعة: {n} موعدًا، أولها {first}.'); }}>
      <label>اليوم <select value={weekday} onChange={(e) => setWeekday(e.target.value)} data-testid="hp-weekday" required><option value="">— اختر —</option>{WEEKDAYS_AR.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
      <label>الوقت <input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="hp-time" required /></label>
      <button type="submit" className="dy-btn sm" disabled={busy} data-testid="hp-save">ثبّت</button><button type="button" className="dy-btn sm ghost" onClick={() => setEdit(false)}>إلغاء</button>
      <small className="hp-hint">ساعة واحدة (60 دقيقة) أسبوعيًّا حتى آخر يوم في البرنامج. لا موعد افتراضي — أنت تختار.</small>
    </form>}
    {ok && <p className="hp-ok" data-testid="hp-ok">{ok}</p>}{err && <p className="hp-err" data-testid="hp-err">{err}</p>}
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
  </div>;
}
const CSS = `
.hp{border-top:1px dashed #EADFD6;margin-top:10px;padding-top:10px}.hp-row{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}.hp-row b{color:#3A1F36}.hp-sum{color:#4A3645;font-size:13px}.hp-sum.muted{color:#B3A5AE}.hp-sum i{font-style:normal;color:#8A5A1E;font-weight:700}.hp-acts{display:inline-flex;gap:6px;flex-wrap:wrap;margin-inline-start:auto}
.hp-form{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:8px;background:#FBF4EE;border-radius:12px;padding:8px 12px}.hp-form label{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:#4A3645}.hp-form select,.hp-form input{border:1px solid #D9CBC2;border-radius:10px;padding:6px 8px;font:inherit}.hp-hint{flex-basis:100%;color:#B3A5AE;font-size:12px}
.hp-ok{margin:6px 0 0;color:#1F4F4A;font-size:13px}.hp-err{margin:6px 0 0;color:#9A3A2A;font-size:13px}
`;
