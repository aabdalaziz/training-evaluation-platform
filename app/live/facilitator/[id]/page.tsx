'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — «الميسِّر الحي» (P13-ب): شاشة المدرب أثناء الجلسة المباشرة — نبض الجلسة، مقترحات بضغطة واحدة، لحظات مهمة، ومحضر الأثر بعد الجلسة (يعتمده الإنسان)

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase/client';
import { Icon } from '../../../../lib/ui/icons';
import { PortalShell, useLang } from '../../../components/PortalShell';
import type { Pulse, Suggestion, SessionMemo, Note } from '../../../../lib/portal/copilot';
import type { IconName } from '../../../../lib/ui/icons';
import { VoiceButton, ReadAloud } from '../../../components/Channel';
import type { Room } from '../../../../lib/portal/media';

export default function FacilitatorPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

type Data = {
  session: { id: string; title_ar: string; title_en?: string | null; status: string; starts_at: string; duration_min: number; provider: string; join_url?: string | null };
  pulse: Pulse; suggestions: Suggestion[]; notes: Note[]; log: { id: string; created_at: string; kind: string; code: string | null; payload: any }[];
  memo: null | { status: 'draft' | 'approved'; memo: SessionMemo; source: string; approved_at?: string | null };
  skills: { id: string; name_ar: string }[]; activities: { id: string; kind: string; prompt_ar: string; active: boolean; answered: number }[];
};
const KIND_ICON: Record<string, IconName> = { activity: 'plus', remind: 'mail', breakout: 'users', pace: 'trend', close: 'flag' };

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const params = useParams<{ id: string }>(); const id = String(params?.id || '');
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState(''); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const [note, setNote] = useState(''); const [editPrompt, setEditPrompt] = useState<Record<string, string>>({}); const [flash, setFlash] = useState(''); const [tick, setTick] = useState(0);
  const [memoEdit, setMemoEdit] = useState<{ summary_ar: string; trainer_note_ar: string } | null>(null); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]); const [roomN, setRoomN] = useState(3); const [roomMin, setRoomMin] = useState(5); const [roomPrompt, setRoomPrompt] = useState('');
  const loadRooms = useCallback(async (t: string) => { try { const j = await fetch(`/api/rooms?session=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()); if (j?.success) setRooms(j.rooms || []); } catch { /* ignore */ } }, [id]);
  async function openRooms(prompt?: string) { setBusy('rooms'); try { const j = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'breakouts', session_id: id, count: roomN, minutes: roomMin, prompt: (prompt ?? roomPrompt) || undefined }) }).then(r => r.json()); if (j?.success) { setFlash(ar ? `فُتحت ${(j.rooms || []).length} غرف — ظهرت للمشاركين في صفحة الجلسة.` : `${(j.rooms || []).length} rooms opened — visible to participants on the session page.`); await loadRooms(tok); await load(tok); } else setErr(j?.error || 'x'); } catch { /* ignore */ } setBusy(''); }
  async function closeRooms() { setBusy('rooms'); for (const r of rooms.filter(x => x.status === 'open')) await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'close', code: r.code }) }); await loadRooms(tok); setBusy(''); }
  const load = useCallback(async (t: string) => {
    try { const j = await fetch(`/api/copilot?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'x'); } catch { setErr('x'); }
  }, [id]);
  useEffect(() => { (async () => { const { data: s } = await db.auth.getSession(); const t = s.session?.access_token || ''; setTok(t); if (!t) { setErr('login'); return; } await load(t); await loadRooms(t); })(); }, [db, load, loadRooms]);
  useEffect(() => { if (!tok) return; timer.current = setInterval(() => { setTick(x => x + 1); load(tok); }, 20000); return () => { if (timer.current) clearInterval(timer.current); }; }, [tok, load]);
  async function post(body: any) { const j = await fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ ...body, session_id: id }) }).then(r => r.json()); if (!j?.success) { setErr(j?.error || 'x'); return null; } return j; }
  async function accept(s: Suggestion) { setBusy(s.code); const j = await post({ action: 'accept', suggestion: s, prompt_ar: editPrompt[s.code] }); setBusy(''); if (j) { await load(tok); setFlash(j.created === 'activity' ? (ar ? 'أُنشئ النشاط وظهر للمشاركين الآن.' : 'Activity created and visible to participants.') : j.created === 'remind' ? (ar ? `أُرسل تذكير إلى ${j.sent} من ${j.absent} غائبًا.` : `Reminder sent to ${j.sent} of ${j.absent}.`) : (ar ? 'سُجّل.' : 'Logged.')); setTimeout(() => setFlash(''), 5000); } }
  async function dismiss(code: string) { setBusy(code); await post({ action: 'dismiss', code }); setBusy(''); await load(tok); }
  async function addNote() { if (note.trim().length < 3) return; setBusy('note'); const j = await post({ action: 'note', text: note.trim() }); setBusy(''); if (j) { setNote(''); await load(tok); } }
  async function makeMemo() { setBusy('memo'); const j = await post({ action: 'memo' }); setBusy(''); if (j) { await load(tok); setMemoEdit(null); } }
  async function approve() { setBusy('approve'); const j = await post({ action: 'approve', edits: memoEdit || {} }); setBusy(''); if (j) { setFlash(ar ? 'اعتُمد المحضر — أصبح ظاهرًا للمشاركين في صفحة الجلسة.' : 'Memo approved and visible to participants.'); await load(tok); setMemoEdit(null); } }

  const p = d?.pulse; const s = d?.session; const live = s?.status === 'live'; const m = d?.memo || null;
  const maxResp = m ? Math.max(1, ...m.memo.engagement.map(e => e.responses)) : 1;
  return (
    <main className="pt-main cp" dir={ar ? 'rtl' : 'ltr'}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pt-wrap">
        <nav className="cp-crumbs"><Link href="/live/trainer">{ar ? 'جدول المدرب' : 'Trainer schedule'}</Link> › <span>{ar ? 'الميسِّر الحي' : 'Live facilitator'}</span></nav>
        {err === 'login' && <div className="pt-box pt-empty">{ar ? 'سجّل الدخول كمدرب أو موظف.' : 'Sign in as trainer or staff.'} <Link className="pt-btn gold small" href="/login?next=/live/facilitator/">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>}
        {err && err !== 'login' && err !== 'x' && <div className="cp-err">{err}</div>}
        {d && s && p && (
          <>
            <header className="cp-head">
              <div>
                <span className="pt-kicker"><Icon name="compass" size={14} /> {ar ? 'الميسِّر الحي · يقترح ولا يقرّر' : 'Live facilitator · suggests, never decides'}</span>
                <h1>{ar ? s.title_ar : (s.title_en || s.title_ar)}</h1>
                <p className="cp-sub"><span className={`cp-st ${s.status}`}>{live && <i />}{s.status === 'live' ? (ar ? 'جارية الآن' : 'Live now') : s.status === 'ended' ? (ar ? 'انتهت' : 'Ended') : s.status === 'scheduled' ? (ar ? 'مجدولة' : 'Scheduled') : s.status}</span> · {ar ? 'الدقيقة' : 'Minute'} <b dir="ltr">{Math.min(p.elapsed_min, p.total_min)}/{p.total_min}</b>{p.elapsed_min > p.total_min && live && <small> ({ar ? 'تجاوزت الوقت المخطط' : 'over planned time'})</small>} · {d.skills.length ? d.skills.map(k => k.name_ar).join('، ') : (ar ? 'بلا جدارات مرتبطة' : 'no linked skills')}</p>
              </div>
              <div className="cp-headacts">{s.join_url && <a className="pt-btn light small" href={s.join_url} target="_blank" rel="noreferrer"><Icon name="play" size={14} /> {ar ? 'غرفة البث' : 'Room'}</a>}<Link className="pt-btn ghost small" href={`/live/${s.id}`}><Icon name="link" size={14} /> {ar ? 'صفحة الجلسة' : 'Session page'}</Link><span className="cp-tick" title={ar ? 'يتحدّث كل 20 ثانية' : 'Refreshes every 20 s'}><Icon name="refresh" size={12} /> {tick}</span></div>
            </header>
            <div className="cp-progress"><i style={{ width: `${Math.round(p.fraction * 100)}%` }} /></div>

            <section className="cp-pulse" aria-label="pulse">
              <div className="cp-tile"><small>{ar ? 'انضمّوا' : 'Joined'}</small><b>{p.joined}</b><span>{ar ? `من ${p.registered} مسجّلًا` : `of ${p.registered} registered`}</span><em style={{ width: `${Math.round(p.join_rate * 100)}%` }} /></div>
              <div className="cp-tile"><small>{ar ? 'استجابات آخر 10 د' : 'Responses · last 10 min'}</small><b>{p.responses_last10}</b><span>{ar ? `${p.responses_total} في الجلسة كلها` : `${p.responses_total} total`}</span></div>
              <div className="cp-tile"><small>{ar ? 'آخر نشاط' : 'Last activity'}</small><b>{p.last_activity_min_ago === null ? '—' : `${p.last_activity_min_ago} ${ar ? 'د' : 'm'}`}</b><span>{p.activities ? (ar ? `أجاب ${p.last_activity_answered} (${Math.round(p.last_activity_rate * 100)}%)` : `${p.last_activity_answered} answered (${Math.round(p.last_activity_rate * 100)}%)`) : (ar ? 'لم يُطرح نشاط بعد' : 'no activity yet')}</span></div>
              <div className="cp-tile"><small>{ar ? 'أنشطة · لحظات' : 'Activities · moments'}</small><b>{p.activities} · {p.notes}</b><span>{p.reflections ? (ar ? `${p.reflections} تأمل` : `${p.reflections} reflections`) : (ar ? 'بلا تأمل بعد' : 'no reflection yet')}</span></div>
            </section>

            {flash && <div className="cp-flash"><Icon name="check" size={14} /> {flash}</div>}

            <div className="cp-grid">
              <section className="cp-col">
                <h2><Icon name="star" size={16} /> {ar ? 'مقترحات الآن' : 'Suggestions now'} <small>{ar ? 'قواعد شفافة من نبض الجلسة — أنت من ينفّذ' : 'Transparent rules from the pulse — you execute'}</small></h2>
                {!d.suggestions.length && <div className="cp-empty">{live ? (ar ? 'الإيقاع جيد الآن — لا مقترح. سأعود حين يتغيّر النبض.' : 'Rhythm is fine — no suggestion right now.') : (ar ? 'لا مقترحات خارج البث.' : 'No suggestions outside the live window.')}</div>}
                {d.suggestions.map(sg => (
                  <article key={sg.code} className={`cp-sug p${sg.priority} ${sg.kind}`}>
                    <div className="cp-sughead"><Icon name={KIND_ICON[sg.kind] || 'star'} size={16} /><b>{sg.title_ar}</b><span className="cp-pr">{sg.priority === 1 ? (ar ? 'الآن' : 'now') : sg.priority === 2 ? (ar ? 'قريبًا' : 'soon') : (ar ? 'فكرة' : 'idea')}</span></div>
                    <p className="cp-why">{sg.why_ar}</p>
                    <p className="cp-how"><Icon name="arrow" size={12} /> {sg.how_ar}</p>
                    {sg.activity && <textarea className="cp-edit" rows={sg.activity.kind === 'reflection' ? 4 : 2} value={editPrompt[sg.code] ?? sg.activity.prompt_ar} onChange={e => setEditPrompt(x => ({ ...x, [sg.code]: e.target.value }))} />}
                    {sg.activity?.options && <ul className="cp-opts">{sg.activity.options.map((o, i) => <li key={i}>{o}</li>)}</ul>}
                    <div className="cp-sugacts">
                      {(sg.kind === 'activity' || sg.kind === 'remind') ? <button type="button" className="pt-btn gold small" disabled={busy === sg.code} onClick={() => accept(sg)}><Icon name="check" size={14} /> {sg.kind === 'activity' ? (ar ? 'أنشئ النشاط الآن' : 'Create activity') : (ar ? 'ذكّر الغائبين' : 'Remind absentees')}</button>
                        : sg.code === 'memo' || sg.code === 'wrap' ? <button type="button" className="pt-btn gold small" disabled={busy === 'memo' || s.status !== 'ended'} onClick={makeMemo}><Icon name="doc" size={14} /> {ar ? 'أنشئ محضر الأثر' : 'Create impact memo'}</button>
                        : sg.kind === 'breakout' ? <><button type="button" className="pt-btn gold small" disabled={busy === 'rooms'} onClick={() => openRooms(sg.activity?.prompt_ar || 'ما أصعب جزء في هذا؟ — اتفقوا على سطر واحد تعودون به إلى الجلسة.')} data-testid="open-rooms"><Icon name="users" size={14} /> {ar ? `افتح ${roomN} غرف أَثَر الآن` : `Open ${roomN} Athar rooms now`}</button><button type="button" className="pt-btn light small" disabled={busy === sg.code} onClick={() => accept(sg)}><Icon name="check" size={14} /> {ar ? 'فعلتُها خارجيًا' : 'Done externally'}</button></>
                        : <button type="button" className="pt-btn light small" disabled={busy === sg.code} onClick={() => accept(sg)}><Icon name="check" size={14} /> {ar ? 'فعلتُها' : 'Done'}</button>}
                      <button type="button" className="pt-btn ghost small" disabled={busy === sg.code} onClick={() => dismiss(sg.code)}><Icon name="x" size={13} /> {ar ? 'تجاهل' : 'Dismiss'}</button>
                    </div>
                  </article>
                ))}
                <div className="cp-note">
                  <b><Icon name="flag" size={14} /> {ar ? 'لحظة مهمة' : 'Key moment'}</b>
                  <div className="cp-noterow"><input value={note} onChange={e => setNote(e.target.value)} maxLength={400} placeholder={ar ? 'مثال: سؤال نورة عن تفويض القرار للآلة — نقاش حقيقي' : 'e.g. Nora’s question about delegating to AI — real debate'} onKeyDown={e => { if (e.key === 'Enter') addNote(); }} /><VoiceButton lang={lang} onText={t => setNote(x => (x ? x + ' ' : '') + t)} /><button type="button" className="pt-btn light small" disabled={busy === 'note' || note.trim().length < 3} onClick={addNote}><Icon name="plus" size={14} /> {ar ? 'سجّل' : 'Log'}</button></div>
                  {!!d.notes.length && <ul className="cp-notes">{d.notes.map((n, i) => <li key={i}><span dir="ltr">د{n.min}</span> {n.text}</li>)}</ul>}
                </div>
                <div className="cp-rooms" data-testid="rooms-panel">
                  <b><Icon name="users" size={14} /> {ar ? 'غرف أَثَر الصغيرة' : 'Athar small rooms'} <small>{ar ? 'فيديو من داخل المنصة · حتى 6 في الغرفة · يوزَّع المشاركون تلقائيًا' : 'In-platform video · up to 6 per room · auto-assigned'}</small></b>
                  <div className="cp-roomctl">
                    <label>{ar ? 'عدد الغرف' : 'Rooms'} <input type="number" min={1} max={12} value={roomN} onChange={e => setRoomN(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} /></label>
                    <label>{ar ? 'الدقائق' : 'Minutes'} <input type="number" min={3} max={30} value={roomMin} onChange={e => setRoomMin(Math.max(3, Math.min(30, Number(e.target.value) || 5)))} /></label>
                    <input className="cp-roomprompt" value={roomPrompt} onChange={e => setRoomPrompt(e.target.value)} maxLength={400} placeholder={ar ? 'سؤال الغرفة (اختياري): ما أصعب جزء في هذا؟' : 'Room question (optional)'} />
                    <button type="button" className="pt-btn gold small" disabled={busy === 'rooms' || s.status !== 'live'} onClick={() => openRooms()} title={s.status !== 'live' ? (ar ? 'تُفتح الغرف أثناء الجلسة الجارية' : 'Rooms open during a live session') : ''}><Icon name="plus" size={14} /> {ar ? 'افتح الغرف' : 'Open rooms'}</button>
                    {rooms.some(r => r.status === 'open') && <button type="button" className="pt-btn ghost small" disabled={busy === 'rooms'} onClick={closeRooms}><Icon name="x" size={13} /> {ar ? 'أغلق الكل' : 'Close all'}</button>}
                  </div>
                  {!!rooms.length && <ul className="cp-roomlist">{rooms.map(r => <li key={r.code} className={r.status}><a href={`/room/${r.code}`} target="_blank" rel="noreferrer"><b dir="ltr">{r.code}</b> {r.title}</a><span>{r.status === 'open' ? (ar ? 'مفتوحة' : 'open') : (ar ? 'مغلقة' : 'closed')} · {(r.notes || []).length} {ar ? 'سطر' : 'lines'}</span>{!!(r.notes || []).length && <em>{(r.notes || []).slice(-1)[0].text}</em>}</li>)}</ul>}
                </div>
              </section>

              <section className="cp-col">
                <h2><Icon name="chart" size={16} /> {ar ? 'الأنشطة في الجلسة' : 'Activities in this session'}</h2>
                {!d.activities.length && <div className="cp-empty">{ar ? 'لا أنشطة بعد — اقبل مقترحًا أو أنشئ نشاطًا من صفحة الجلسة.' : 'No activities yet.'}</div>}
                <ul className="cp-acts">{d.activities.map(a => <li key={a.id}><span className={`cp-kind ${a.kind}`}>{a.kind === 'mcq' ? (ar ? 'اختيار' : 'MCQ') : a.kind === 'reflection' ? (ar ? 'تأمل' : 'Reflect') : (ar ? 'تقدير' : 'Rate')}</span><p>{a.prompt_ar}</p><b>{a.answered}</b></li>)}</ul>

                <h2 style={{ marginTop: 18 }}><Icon name="doc" size={16} /> {ar ? 'محضر الأثر' : 'Impact memo'} {m && <span className={`cp-memost ${m.status}`}>{m.status === 'approved' ? (ar ? 'معتمد' : 'Approved') : (ar ? 'مسودة' : 'Draft')}</span>}</h2>
                {!m && <div className="cp-empty">{s.status === 'ended' ? (ar ? 'انتهت الجلسة. أنشئ المحضر: ما حدث فعلًا، ما ظهر، الفجوات، الخطوة التالية.' : 'Session ended. Create the memo.') : (ar ? 'يُنشأ المحضر بعد انتهاء الجلسة.' : 'The memo is created after the session ends.')} {s.status === 'ended' && <button type="button" className="pt-btn gold small" disabled={busy === 'memo'} onClick={makeMemo}><Icon name="doc" size={14} /> {busy === 'memo' ? (ar ? 'أكتب المحضر…' : 'Writing…') : (ar ? 'أنشئ محضر الأثر' : 'Create impact memo')}</button>}</div>}
                {m && (
                  <article className="cp-memo">
                    <div className="cp-memohead"><b>{m.memo.title_ar}</b><small>{m.memo.source === 'ai' ? (ar ? 'مسودة بالذكاء الاصطناعي من بيانات الجلسة' : 'AI draft from session data') : m.memo.source === 'human' ? (ar ? 'راجعه المدرب' : 'Reviewed by trainer') : (ar ? 'مسودة محلية من بيانات الجلسة' : 'Local draft')}</small></div>
                    <div className="cp-att"><span><b>{m.memo.attendance.joined}</b>{ar ? 'حضروا' : 'joined'}</span><span><b>{m.memo.attendance.registered}</b>{ar ? 'مسجّل' : 'registered'}</span><span><b>{m.memo.attendance.rate}%</b>{ar ? 'نسبة' : 'rate'}</span></div>
                    <svg className="cp-curve" viewBox={`0 0 ${Math.max(1, m.memo.engagement.length) * 24} 48`} preserveAspectRatio="none" aria-label="engagement">{m.memo.engagement.map((e, i) => <rect key={i} x={i * 24 + 3} y={48 - Math.round(44 * e.responses / maxResp) - 2} width={18} height={Math.round(44 * e.responses / maxResp) + 2} rx={3} />)}</svg>
                    {m.status === 'draft' && memoEdit ? <textarea className="cp-edit big" rows={6} value={memoEdit.summary_ar} onChange={e => setMemoEdit(x => ({ ...(x as any), summary_ar: e.target.value }))} /> : <><p className="cp-sum">{m.memo.summary_ar}</p><div className="cp-readrow"><ReadAloud lang={lang} text={[m.memo.summary_ar, ...(m.memo.highlights_ar || []), ...(m.memo.gaps_ar || []), ...(m.memo.next_ar || [])].join('. ')} /></div></>}
                    {!!m.memo.highlights_ar.length && <div className="cp-blk ok"><b>{ar ? 'ما ظهر' : 'Highlights'}</b><ul>{m.memo.highlights_ar.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                    {!!m.memo.gaps_ar.length && <div className="cp-blk warn"><b>{ar ? 'الفجوات' : 'Gaps'}</b><ul>{m.memo.gaps_ar.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                    {!!m.memo.next_ar.length && <div className="cp-blk"><b>{ar ? 'الخطوة التالية' : 'Next'}</b><ul>{m.memo.next_ar.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                    {!!m.memo.moments_ar.length && <div className="cp-blk"><b>{ar ? 'لحظات مهمة' : 'Moments'}</b><ul>{m.memo.moments_ar.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                    {m.memo.trainer_note_ar && <p className="cp-tnote"><b>{ar ? 'كلمة المدرب:' : 'Trainer:'}</b> {m.memo.trainer_note_ar}</p>}
                    {m.status === 'draft' && (
                      <div className="cp-memoacts">
                        {memoEdit ? <>
                          <input value={memoEdit.trainer_note_ar} onChange={e => setMemoEdit(x => ({ ...(x as any), trainer_note_ar: e.target.value }))} maxLength={600} placeholder={ar ? 'كلمة منك للمشاركين (اختياري)' : 'A word from you (optional)'} />
                          <button type="button" className="pt-btn gold small" disabled={busy === 'approve'} onClick={approve}><Icon name="check" size={14} /> {ar ? 'اعتمد بتعديلاتي' : 'Approve with my edits'}</button>
                        </> : <>
                          <button type="button" className="pt-btn gold small" disabled={busy === 'approve'} onClick={approve}><Icon name="check" size={14} /> {ar ? 'اعتمد المحضر' : 'Approve memo'}</button>
                          <button type="button" className="pt-btn light small" onClick={() => setMemoEdit({ summary_ar: m.memo.summary_ar, trainer_note_ar: m.memo.trainer_note_ar || '' })}><Icon name="edit" size={14} /> {ar ? 'عدّل قبل الاعتماد' : 'Edit first'}</button>
                          <button type="button" className="pt-btn ghost small" disabled={busy === 'memo'} onClick={makeMemo}><Icon name="refresh" size={14} /> {ar ? 'أعد التوليد' : 'Regenerate'}</button>
                        </>}
                      </div>
                    )}
                    {m.status === 'approved' && <small className="cp-ok"><Icon name="check" size={12} /> {ar ? 'ظاهر للمشاركين في صفحة الجلسة.' : 'Visible to participants on the session page.'} <Link href={`/live/${s.id}`}>{ar ? 'افتح' : 'Open'}</Link></small>}
                  </article>
                )}
              </section>
            </div>
            <p className="cp-foot">{ar ? 'الميسِّر يقرأ نبض الجلسة (الحضور، الاستجابات، الزمن) ويقترح وفق قواعد معلنة؛ لا يرى الكاميرا ولا الصوت، ولا ينفّذ شيئًا دون ضغطتك. المحضر مسودة حتى تعتمدها.' : 'The facilitator reads the pulse (attendance, responses, time) and suggests by transparent rules; it never sees camera or audio, and executes nothing without your click.'}</p>
          </>
        )}
      </div>
    </main>
  );
}

const CSS = `
.cp .pt-wrap{max-width:1180px}
.cp-crumbs{font-size:13px;color:#64748b;margin:6px 0 10px}.cp-crumbs a{color:#0b8a83}
.cp-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.cp-head h1{margin:4px 0 6px;font-size:26px;color:#0f2a4e}.cp-sub{margin:0;color:#475569;font-size:14px}
.cp-st{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:999px;background:#e2e8f0;font-size:12px;font-weight:700}.cp-st.live{background:#fee2e2;color:#b91c1c}.cp-st.live i{width:8px;height:8px;border-radius:50%;background:#dc2626;animation:cpb 1.2s infinite}.cp-st.ended{background:#dcfce7;color:#166534}
@keyframes cpb{0%,100%{opacity:1}50%{opacity:.3}}
.cp-headacts{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.cp-tick{font-size:11px;color:#94a3b8;display:inline-flex;gap:4px;align-items:center}
.cp-progress{height:6px;background:#e2e8f0;border-radius:999px;margin:12px 0 16px;overflow:hidden}.cp-progress i{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#c9a24b);transition:width .6s}
.cp-pulse{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:800px){.cp-pulse{grid-template-columns:repeat(2,1fr)}}
.cp-tile{position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;overflow:hidden}.cp-tile small{display:block;color:#64748b;font-size:12px}.cp-tile b{display:block;font-size:28px;color:#0f2a4e;line-height:1.2}.cp-tile span{font-size:12px;color:#475569}.cp-tile em{position:absolute;bottom:0;right:0;left:auto;height:3px;background:#0b8a83}
.cp-flash{margin:12px 0;padding:10px 14px;border-radius:12px;background:#ecfdf5;color:#065f46;font-weight:700;display:flex;gap:8px;align-items:center}
.cp-err{margin:12px 0;padding:10px 14px;border-radius:12px;background:#fef2f2;color:#991b1b}
.cp-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:20px;margin-top:18px}@media(max-width:900px){.cp-grid{grid-template-columns:1fr}}
.cp-col h2{font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center;margin:0 0 10px;flex-wrap:wrap}.cp-col h2 small{font-weight:400;color:#64748b;font-size:12px}
.cp-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:14px;color:#475569;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.cp-sug{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;margin-bottom:12px;border-inline-start:4px solid #94a3b8}.cp-sug.p1{border-inline-start-color:#c9a24b;box-shadow:0 6px 24px rgba(15,42,78,.08)}.cp-sug.p2{border-inline-start-color:#0b8a83}
.cp-sughead{display:flex;gap:8px;align-items:center}.cp-sughead b{font-size:16px;color:#0f2a4e;flex:1}.cp-pr{font-size:11px;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#475569}.cp-sug.p1 .cp-pr{background:#fef3c7;color:#92400e}
.cp-why{margin:8px 0 4px;color:#334155;font-size:14px}.cp-how{margin:0 0 8px;color:#0b8a83;font-size:13px;display:flex;gap:6px;align-items:center}
.cp-edit{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:#f8fafc}.cp-edit.big{background:#fff}
.cp-opts{margin:6px 0;padding:0 18px;font-size:13px;color:#475569}.cp-sugacts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.cp-rooms{background:#fff;border:1px solid rgba(15,42,78,.12);border-radius:16px;padding:14px 16px;margin-top:14px;display:grid;gap:10px}.cp-rooms>b{display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:#0f2a4e;font-size:14px}.cp-rooms>b small{font-weight:500;color:#64748b;font-size:12px}.cp-roomctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.cp-roomctl label{display:inline-flex;gap:6px;align-items:center;font-size:12px;color:#475569}.cp-roomctl input[type=number]{width:56px;border:1px solid rgba(15,42,78,.18);border-radius:8px;padding:6px;font:inherit}.cp-roomprompt{flex:1;min-width:180px;border:1px solid rgba(15,42,78,.18);border-radius:8px;padding:7px 10px;font:inherit;font-size:13px}.cp-roomlist{margin:0;padding:0;list-style:none;display:grid;gap:6px}.cp-roomlist li{display:grid;gap:2px;background:#f8fafc;border-radius:10px;padding:8px 10px;font-size:13px}.cp-roomlist li.closed{opacity:.6}.cp-roomlist a{color:#0f2a4e;font-weight:700;text-decoration:none}.cp-roomlist a b{font-family:ui-monospace,monospace;letter-spacing:.12em;background:#0f2a4e;color:#fff;border-radius:6px;padding:0 6px;margin-inline-end:6px}.cp-roomlist span{color:#64748b;font-size:12px}.cp-roomlist em{color:#0b8a83;font-style:normal}.cp-readrow{margin:6px 0}
.cp-note{background:#0f2a4e;color:#fff;border-radius:16px;padding:14px 16px;margin-top:14px}.cp-note>b{display:flex;gap:6px;align-items:center;font-size:14px;margin-bottom:8px}.cp-noterow{display:flex;gap:8px}.cp-noterow input{flex:1;border:0;border-radius:10px;padding:9px 12px;font:inherit;font-size:14px}
.cp-notes{list-style:none;margin:10px 0 0;padding:0;font-size:13px}.cp-notes li{padding:4px 0;border-top:1px solid rgba(255,255,255,.12)}.cp-notes span{display:inline-block;min-width:34px;color:#c9a24b;font-weight:700}
.cp-acts{list-style:none;margin:0;padding:0}.cp-acts li{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px}.cp-acts p{flex:1;margin:0;font-size:13px;color:#334155}.cp-acts b{font-size:18px;color:#0f2a4e}
.cp-kind{font-size:11px;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#334155;white-space:nowrap}.cp-kind.reflection{background:#ccfbf1;color:#0f766e}.cp-kind.mcq{background:#e0e7ff;color:#3730a3}.cp-kind.self_rating{background:#fef3c7;color:#92400e}
.cp-memost{font-size:11px;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e}.cp-memost.approved{background:#dcfce7;color:#166534}
.cp-memo{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.cp-memohead b{display:block;font-size:16px;color:#0f2a4e}.cp-memohead small{color:#64748b;font-size:12px}
.cp-att{display:flex;gap:14px;margin:10px 0}.cp-att span{display:flex;flex-direction:column;font-size:12px;color:#64748b}.cp-att b{font-size:20px;color:#0f2a4e}
.cp-curve{width:100%;height:48px;display:block;margin:4px 0 10px}.cp-curve rect{fill:#0b8a83;opacity:.85}
.cp-sum{font-size:15px;line-height:1.9;color:#1e293b;margin:0 0 10px}
.cp-blk{border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#f8fafc}.cp-blk.ok{background:#ecfdf5}.cp-blk.warn{background:#fff7ed}.cp-blk b{display:block;font-size:13px;color:#0f2a4e;margin-bottom:4px}.cp-blk ul{margin:0;padding:0 18px;font-size:13px;color:#334155;line-height:1.8}
.cp-tnote{background:#fffbeb;border-radius:10px;padding:8px 12px;font-size:14px}
.cp-memoacts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}.cp-memoacts input{flex:1;min-width:200px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px}
.cp-ok{color:#166534;display:inline-flex;gap:6px;align-items:center;margin-top:8px}.cp-ok a{color:#0b8a83}
.cp-foot{color:#64748b;font-size:12px;margin:22px 0 10px}
`;
