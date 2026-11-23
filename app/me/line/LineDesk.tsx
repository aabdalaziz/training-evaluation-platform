'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «أيام التدريب وفترات التطبيق» — مكتب المتدرّب «سطري» (يُحمَّل ديناميكيًا بلا SSR)
 *  لكل شعبة من شُعبي: كلمة أَثَر القصيرة بحسب الطور · «الطريق» (الكتل وفترات التطبيق) ·
 *   يوم تدريب → «سطر اليوم» (واحد لليوم، يُعدَّل في يومه) · آخر يوم الكتلة → «التزامي حتى نلتقي» · فترة تطبيق → «سطر التطبيق» الأسبوعي (ماذا طبّقتُ / ما الذي منعني) + موقف ميداني
 *   «هذا ما وعدتَ به نفسك» حين يُفتح التزام (يوم العودة) → فعلت / جزئيًا / لم أفعل بعد · سطوري (آخر 60) · حذف فوري
 *  testids: ln-root ln-err ln-ok ln-empty ln-room[data-phase] ln-athar ln-road ln-write[data-kind] ln-ta ln-blocker ln-save ln-written ln-commit-open ln-commit-yes ln-commit-part ln-commit-no ln-lines ln-line ln-field-case ln-foot
 *  P66-ب: ln-today ln-today-panel ln-today-answer ln-today-item ln-shift ln-lectures ln-lec[data-state,data-written] ln-thread ln-leave-ta ln-leave-save ln-leave-written ln-move ln-move-btn ln-move-reason ln-move-send ln-move-open
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import type { MyRoom, MyLine } from '../../../lib/calendar/store';
import type { LineKind } from '../../../lib/calendar/registry';

type Data = { rooms: MyRoom[]; today: string; names: Record<string, string>; prompts: Record<LineKind, { title: string; hint: string; blocker?: string }>; limits: { lineMin: number; lineMax: number; k: number }; foot_ar: string; field_case_path: string; shift?: { day: string; until: string } | null };
type TodayData = { items: Array<{ session_id: string; course: string; section: string; starts: string; ends: string; instructor: string | null; line_ar: string; state: string }>; answer_ar: string; today: string };
const STATE_AR: Record<string, string> = { upcoming: 'قادمة', live: 'الآن', ended: 'انتهت' };
const PHASE_AR: Record<string, string> = { training: 'يوم تدريب', apply: 'البرنامج معك في موقعك', rest: 'استراحة قصيرة', before: 'قبل البداية', after: 'انتهى البرنامج', none: '' };
const KIND_AR: Record<LineKind, string> = { learn: 'سطر اليوم', apply: 'سطر التطبيق', commit: 'التزامي حتى نلتقي' };

export default function LineDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [text, setText] = useState<Record<string, string>>({}); const [blocker, setBlocker] = useState<Record<string, string>>({}); const [kindSel, setKindSel] = useState<Record<string, LineKind>>({});
  const [leave, setLeave] = useState<Record<string, string>>({}); const [mv, setMv] = useState<Record<string, { open: boolean; reason: string }>>({}); const [todayD, setTodayD] = useState<TodayData | null>(null); const [todayOpen, setTodayOpen] = useState(false); const [shiftOn, setShiftOn] = useState(false);
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => {
    const j = await fetch('/api/me/line', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح الصفحة');
  }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  /* P70: «الكلمة التي تعبر» — أول أسبوع في المستوى التالي يرى سطره من المستوى السابق كما ختمه */
  const [echo, setEcho] = useState<{ intro_ar: string; line_ar: string; level_no: number; next_level_no: number; href: string } | null>(null);
  /* P70-ب «رجع الصدى»: كلمة العبور من الأستاذ (تحت الكلمة التي تعبر) + تذكير لطيف إن كانت صفحة المستوى ما زالت مفتوحة */
  const [eword, setEword] = useState<{ notice_id: string; title_ar: string; text_ar: string; voice_sec: number | null; level_no: number } | null>(null);
  const [eopen, setEopen] = useState<{ href: string; level_no: number; until_ar: string } | null>(null);
  const [echip, setEchip] = useState<string | null>(null); const [echipBusy, setEchipBusy] = useState(false);
  useEffect(() => { if (!tok) return; fetch('/api/me/level?echo=1', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then((r) => r.json()).then((j) => { if (!j?.success) return; if (j.echo) setEcho(j.echo); if (j.word) setEword(j.word); if (j.open) setEopen(j.open); }).catch(() => undefined); }, [tok]);
  const replyChip = useCallback(async (chip: string) => { if (!tok || !eword || echipBusy) return; setEchipBusy(true); try { const r = await fetch('/api/notices', { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'word_reply', notice_id: eword.notice_id, chip }) }); const j = await r.json().catch(() => ({})); if (r.ok && j?.success) setEchip(chip); } finally { setEchipBusy(false); } }, [tok, eword, echipBusy]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 7000); };
  async function post(body: Record<string, unknown>): Promise<any> { setBusy(true); const j = await fetch('/api/me/line', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); setBusy(false); return j; }
  async function save(r: MyRoom, kind: LineKind) {
    const body_ar = (text[`${r.classroom_id}:${kind}`] || '').trim(); const blocker_ar = (blocker[r.classroom_id] || '').trim();
    const j = await post({ action: 'line', classroom_id: r.classroom_id, kind, body_ar, blocker_ar: kind === 'apply' && blocker_ar ? blocker_ar : undefined });
    if (j?.success) { setText((s) => ({ ...s, [`${r.classroom_id}:${kind}`]: '' })); setBlocker((s) => ({ ...s, [r.classroom_id]: '' })); flash(kind === 'commit' ? `خُتم التزامك — يُفتح لك ${j.line.opens_ar || 'أول يوم الكتلة القادمة'}.` : j.updated ? 'عُدّل سطرك.' : 'حُفظ سطرك.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر الحفظ');
  }
  async function answer(l: MyLine, done: 'yes' | 'part' | 'no') { const j = await post({ action: 'commit', id: l.id, done }); if (j?.success) { flash('سُجّلت إجابتك — لك وحدك.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر الحفظ'); }
  const loadToday = useCallback(async (t: string) => { const j = await fetch('/api/diploma?today=1', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setTodayD(j); }, []);
  useEffect(() => { if (tok && todayOpen && !todayD) loadToday(tok); }, [tok, todayOpen, todayD, loadToday]);
  useEffect(() => { if (typeof window !== 'undefined' && window.location.hash === '#today') setTodayOpen(true); }, []);
  async function saveLeave(r: MyRoom, unit_id: string) {
    const body_ar = (leave[`${r.classroom_id}:${unit_id}`] || '').trim(); const j = await post({ action: 'line', classroom_id: r.classroom_id, kind: 'learn', unit_id, body_ar, shift: shiftOn || undefined });
    if (j?.success) { setLeave((s) => ({ ...s, [`${r.classroom_id}:${unit_id}`]: '' })); flash('حُفظ سطرك — يراه زملاؤك مجمَّعًا بلا اسم في أول المحاضرة القادمة حين تبلغون خمسة.'); if (tok) load(tok); }
  }
  async function requestMove(r: MyRoom) {
    const reason_ar = (mv[r.classroom_id]?.reason || '').trim(); if (reason_ar.length < 5) { setErr('اكتب سببًا من 5 أحرف على الأقل'); return; }
    const j = await fetch('/api/diploma', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'move_request', program_id: r.program_id, reason_ar }) }).then((x) => x.json()).catch(() => null);
    if (j?.success) { setMv((s) => ({ ...s, [r.classroom_id]: { open: false, reason: '' } })); flash('وصل طلبك إلى منسّق الشعبة — يصلك الرد في إشعاراتك.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر إرسال الطلب');
  }
  async function del(l: MyLine) { if (!confirm('يُحذف السطر فورًا ولا يُسترجع. نتابع؟')) return; const j = await post({ action: 'delete', id: l.id }); if (j?.success) { flash('حُذف.'); if (tok) load(tok); } else setErr(j?.error || 'تعذّر الحذف'); }
  return <main className="ln" dir="rtl" data-testid="ln-root">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="ln-nav" aria-label="تنقّل"><Link href="/me" className="ln-link"><Icon name="arrow" size={14} /> ملفّي</Link><button type="button" className="ln-link ln-btnlink" data-testid="ln-today" aria-expanded={todayOpen} onClick={() => setTodayOpen((v) => !v)}><Icon name="clock" size={14} /> ماذا عندي اليوم؟</button><Link href="/me#prefs" className="ln-link"><Icon name="bell" size={14} /> تفضيلاتي</Link><Link href="/me/level" className="ln-link" data-testid="ln-level"><Icon name="school" size={14} /> بكلماتي عبر المستوى</Link><Link href="/me/first" className="ln-link"><Icon name="spark" size={14} /> أول يوم</Link><Link href="/me/letter" className="ln-link"><Icon name="mail" size={14} /> رسالة إلى نفسي</Link><Link href="/me/grad" className="ln-link"><Icon name="award" size={14} /> يوم تخرّجي</Link></nav>
    <header className="ln-head"><span className="pt-kicker"><Icon name="edit" size={14} /> سجلّ التعلّم والتطبيق للمتدرّب</span><h1>✍️ {d?.names.page || 'سطري'} <small>سطر في يوم التدريب · سطر في الأسبوع من موقعك</small></h1>
      <p>في أيام التدريب تكتب سطرًا واحدًا: ماذا أخذتَ من اليوم. وحين تعود إلى موقعك بين الكتل يصبح البرنامج معك هناك: سطر في الأسبوع — ماذا طبّقتَ وما الذي منعك — وموقف ميداني تكتب كيف تصرّفت فيه فعلًا. مدرّبك يرى المجمَّع بلا أسماء، ويبدأ الكتلة القادمة بما جرى في مواقعكم.</p></header>
    {echo && <aside className="pt-box ln-echo" data-testid="ln-echo" data-level={echo.level_no}><small>{echo.intro_ar}</small><blockquote>«{echo.line_ar}»</blockquote><p>واليوم تبدأ المستوى {echo.next_level_no}. <Link href={echo.href}>صفحة المستوى {echo.level_no}</Link> · <Link href="/me/level">بكلماتي عبر المستوى</Link></p></aside>}
    {eword && <aside className="pt-box ln-echo ln-echo-word" data-testid="ln-echo-word" data-level={eword.level_no} data-chip={echip || ''}><small>{eword.title_ar}</small>{eword.text_ar && <blockquote>«{eword.text_ar}»</blockquote>}{!eword.text_ar && eword.voice_sec ? <p>🎙️ كلمة صوتية ({Math.round(eword.voice_sec)} ث) — تسمعها من 🔔 تنبيهاتي.</p> : null}
      <p className="ln-echo-chips">{echip ? <span data-testid="ln-echo-replied">وصل ردّك {echip === 'got_it' ? '🌱' : echip === 'need_help' ? '✋' : '🕐'} إلى أستاذك ✓</span> : <>ردّ بلمسة: {[['got_it', '🌱 وصلت'], ['need_help', '✋ أحتاج مساعدة'], ['will_attend', '🕐 سأحضر']].map(([k, l]) => <button key={k} type="button" className="ln-chip" data-testid={`ln-echo-chip-${k}`} disabled={echipBusy} onClick={() => void replyChip(k)}>{l}</button>)}</>}</p></aside>}
    {eopen && !echo && <p className="ln-level-open" data-testid="ln-level-open" data-level={eopen.level_no}>🏁 صفحة مستواك {eopen.level_no} ما زالت مفتوحة حتى {eopen.until_ar} — <Link href={eopen.href}>اختمها بكلماتك</Link>؛ أستاذك الجديد يقرأ صدى الشعبة بلا أسماء.</p>}
    {err && <p className="ln-err" role="alert" data-testid="ln-err">{err}</p>}
    {msg && <p className="ln-ok" role="status" data-testid="ln-ok">{msg}</p>}
    {!tok && tok !== null && <section className="pt-box"><p>سجّل الدخول لتكتب سطرك. <Link href="/me">مساحتي</Link></p></section>}
    {todayOpen && <section className="pt-box ln-today" id="today" data-testid="ln-today-panel" aria-live="polite"><h2>🕒 ماذا عندي اليوم؟</h2>{!todayD && <p className="ln-muted">…</p>}{todayD && <><p className="ln-answer" data-testid="ln-today-answer">{todayD.answer_ar}</p>{todayD.items.length > 0 && <ul className="ln-todaylist">{todayD.items.map((i) => <li key={i.session_id} data-testid="ln-today-item" data-state={i.state}><span className="ln-tag">{i.starts}–{i.ends} · {STATE_AR[i.state] || ''}</span><b>{i.line_ar}</b></li>)}</ul>}</>}</section>}
    {d?.shift && <label className="ln-shift" data-testid="ln-shift"><input type="checkbox" checked={shiftOn} onChange={(e) => setShiftOn(e.target.checked)} /> 🌙 وضع الوردية: سطر الأمس لا يزال مفتوحًا حتى {d.shift.until} — فعِّل هذا ليُحسب سطرك على يوم أمس.</label>}
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
        {r.lectures.length > 0 && <div className="ln-lectures" data-testid="ln-lectures" role="group" aria-label="محاضرات اليوم">
          <h3>📚 محاضرات اليوم في شعبتك <small>{r.lectures.length}</small></h3>
          {r.lectures.map((lc) => { const lk = `${r.classroom_id}:${lc.unit_id}`; const lt = leave[lk] || ''; const lok = lt.trim().length >= d.limits.lineMin && lt.trim().length <= d.limits.lineMax;
            return <article key={lc.session_id} className={`ln-lec ${lc.state}`} data-testid="ln-lec" data-state={lc.state} data-written={lc.written ? '1' : '0'}>
              <header><span className="ln-tag">{lc.starts}–{lc.ends} · {STATE_AR[lc.state]}</span><b>{lc.course}</b>{lc.instructor && <small>{lc.instructor}</small>}</header>
              <p className="ln-structline">{lc.line_ar}</p>
              {lc.thread.shown && <div className="ln-thread" data-testid="ln-thread"><b>{lc.thread.intro_ar}</b> <span className="ln-muted">{lc.thread.head_ar}</span><ul>{lc.thread.applied.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {lc.state !== 'upcoming' && <div className="ln-leave"><p><b>{lc.question_ar}</b>{lc.written && <small data-testid="ln-leave-written"> — كتبتَه (يمكنك تعديله)</small>}</p>
                <textarea data-testid="ln-leave-ta" value={lt} onChange={(e) => setLeave((s) => ({ ...s, [lk]: e.target.value }))} maxLength={d.limits.lineMax} rows={2} placeholder="سطر واحد…" aria-label={lc.question_ar} />
                <div className="ln-row"><span className="ln-muted">{lt.trim().length}/{d.limits.lineMax}</span><button type="button" className="ln-btn ln-primary" data-testid="ln-leave-save" disabled={!lok || busy} onClick={() => saveLeave(r, lc.unit_id)}>{lc.written ? 'عدّل' : 'احفظ قبل أن أغادر'}</button></div></div>}
              {lc.state === 'upcoming' && <p className="ln-muted">يُفتح سؤال «قبل أن تغادر» حين تبدأ المحاضرة.</p>}
            </article>; })}
        </div>}
        {r.program_id && (r.lectures.length > 0 || r.move_open) && <div className="ln-move" data-testid="ln-move">
          {r.move_open ? <p className="ln-muted" data-testid="ln-move-open">⏳ طلب نقلك إلى شعبة أخرى عند منسّق الشعبة — يصلك الردّ في إشعاراتك.</p>
            : !mv[r.classroom_id]?.open ? <button type="button" className="ln-link ln-btnlink" data-testid="ln-move-btn" onClick={() => setMv((s) => ({ ...s, [r.classroom_id]: { open: true, reason: '' } }))}><Icon name="users" size={13} /> أطلب نقلي إلى شعبة أخرى</button>
            : <div><p className="ln-muted">شعبتك ثابتة طوال المستوى؛ النقل بطلب يقرّره منسّق الشعبة. اكتب سببك (5–200 حرفًا):</p><input data-testid="ln-move-reason" className="ln-input" value={mv[r.classroom_id]?.reason || ''} maxLength={200} onChange={(e) => setMv((s) => ({ ...s, [r.classroom_id]: { open: true, reason: e.target.value } }))} placeholder="مثال: تعارض مع دوامي الصباحي" /><div className="ln-row"><button type="button" className="ln-btn ln-primary" data-testid="ln-move-send" disabled={busy} onClick={() => requestMove(r)}>أرسل الطلب</button><button type="button" className="ln-btn ln-ghost" onClick={() => setMv((s) => ({ ...s, [r.classroom_id]: { open: false, reason: '' } }))}>إلغاء</button></div></div>}
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
          <ul className="ln-lines" data-testid="ln-lines">{r.lines.map((l) => <li key={l.id} data-testid="ln-line" data-kind={l.kind}><span className="ln-tag">{l.unit_id ? 'قبل أن أغادر' : KIND_AR[l.kind]}{l.week_no ? ` · أسبوع ${l.week_no}` : ''}{l.block_no && l.kind !== 'apply' ? ` · كتلة ${l.block_no}` : ''}</span><b>{l.body_ar}</b>{l.blocker_ar && <i>ما منعني: {l.blocker_ar}</i>}{l.kind === 'commit' && (l.done ? <i>أجبت: {l.done_ar}</i> : <i>{l.open ? 'مفتوح — أجب أعلاه' : `يُفتح ${l.opens_ar}`}</i>)}<small>{l.day_ar}</small><button type="button" className="ln-x" aria-label="حذف" onClick={() => del(l)}>حذف</button></li>)}</ul></details>}
      </section>; })}
    {d && <p className="ln-foot" data-testid="ln-foot"><Icon name="shield" size={13} /> {d.foot_ar}</p>}
  </main>;
}

const CSS = `
.ln-echo-word small{color:#B9544A}.ln-echo-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px}.ln-chip{font:inherit;font-size:12.5px;font-weight:800;border:1px solid #BFE1DC;background:#fff;color:#B9544A;border-radius:999px;padding:4px 10px;cursor:pointer}.ln-chip:disabled{opacity:.6}.ln-level-open{margin:0 0 12px;background:#FBF4EE;border:1px solid #E9C98A;color:#8A5A1E;border-radius:12px;padding:8px 12px;font-size:13px;font-weight:700}
.ln-echo{margin:10px 0 14px;background:linear-gradient(160deg,#E6F3F1,#FBEDE7);border:1px solid #BFE1DC;border-radius:16px;padding:12px 16px}.ln-echo small{color:#D4614A;font-weight:800}.ln-echo blockquote{margin:6px 0;font-size:19px;line-height:1.8;color:#1F4F4A;font-weight:700}.ln-echo p{margin:0;color:#5C4858;font-size:13px}.ln-echo a{color:#3A1F36;font-weight:800}
.ln-btnlink{font:inherit;cursor:pointer}.ln-today h2{margin:0 0 6px;font-size:16px;color:#3A1F36}.ln-answer{font-size:14px;font-weight:800;color:#3A1F36;margin:0 0 6px;line-height:1.8}.ln-todaylist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.ln-todaylist li{display:flex;flex-direction:column;gap:2px;border:1px solid #EADFD6;border-radius:10px;padding:6px 10px;font-size:13px}
.ln-shift{display:flex;gap:8px;align-items:center;background:#F3E8EF;border:1px solid #F3E8EF;color:#3A1F36;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:800}
.ln-lectures{display:flex;flex-direction:column;gap:8px;margin:8px 0}.ln-lectures h3{margin:0;font-size:14px;color:#3A1F36}.ln-lectures h3 small{color:#8E7F8A}
.ln-lec{border:1px solid #EADFD6;border-radius:12px;padding:8px 12px;background:#fff;display:flex;flex-direction:column;gap:6px}.ln-lec.live{border-color:#D4614A;box-shadow:0 0 0 2px #BFE1DC inset}.ln-lec header{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ln-lec header b{font-size:14px;color:#3A1F36}.ln-lec header small{color:#8E7F8A;font-weight:700}
.ln-structline{margin:0;font-size:12px;color:#5C4858;font-weight:700}.ln-thread{background:#E6F3F1;border:1px solid #BFE1DC;border-radius:10px;padding:6px 10px;font-size:13px}.ln-thread ul{margin:4px 0 0;padding-inline-start:18px}.ln-leave p{margin:0 0 4px;font-size:13.5px}
.ln-move{margin:4px 0 8px;font-size:13px}

.ln{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626;max-width:920px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.ln *{box-sizing:border-box}
.ln-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.ln-link{color:#3A1F36;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.ln-link:hover{text-decoration:underline}
.ln-head h1{margin:4px 0 6px;font-size:30px;color:#3A1F36}.ln-head h1 small{display:block;font-size:14px;color:#8A5A1E;font-weight:800;margin-top:2px}.ln-head p{margin:0 0 14px;color:#5C4858;line-height:1.9;max-width:760px}
.ln-muted{color:#8E7F8A;font-size:13px;line-height:1.8;margin:4px 0}.ln-err{background:#FBEDE7;color:#B9544A;border:1px solid #F3C4B6;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.ln-ok{background:#E6F3F1;color:#2F6B66;border:1px solid #BFE1DC;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.ln-room{background:#fff;border:1px solid #EADFD6;border-radius:18px;padding:16px 18px;margin:0 0 14px}.ln-room[data-phase=apply]{border-color:#E9C98A;background:linear-gradient(170deg,#FBF4EE,#fff)}
.ln-roomhead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.ln-roomhead h2{margin:0;font-size:19px;color:#3A1F36}.ln-code{display:block;color:#8E7F8A;font-size:12.5px;font-weight:700;margin-top:2px}
.ln-counts{display:flex;gap:10px;flex-wrap:wrap;color:#5C4858;font-size:12px;font-weight:700}.ln-counts span{background:#F6EBE0;border-radius:999px;padding:3px 10px}
.ln-athar{margin:10px 0 6px;background:linear-gradient(160deg,#3A1F36,#3A1F36);color:#fff;border-radius:14px;padding:10px 14px;line-height:1.9;font-size:15px;display:flex;gap:8px;align-items:flex-start}.ln-sign{color:#E9C98A;font-weight:800;margin-inline-start:auto;white-space:nowrap}
.ln-commit{background:linear-gradient(160deg,#FBF4EE,#fff);border:1px solid #E9C98A;border-radius:14px;padding:12px 14px;margin:10px 0}.ln-commit h3{margin:0 0 6px;font-size:16px;color:#8A5A1E}.ln-commit h3 small{font-weight:600;font-size:12px;color:#8A5A1E}.ln-commit blockquote{margin:6px 0;font-size:17px;line-height:1.9;font-weight:700;color:#3b1d0e}
.ln-write{border-top:1px dashed #EADFD6;margin-top:10px;padding-top:10px}.ln-write h3{margin:0 0 4px;font-size:16px;color:#3A1F36}.ln-write h3 small{font-weight:600;font-size:12px;color:#2F6B66}
.ln-tabs{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}.ln-tab{border:1px solid #D9CBC2;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:800;color:#4A3645;cursor:pointer}.ln-tab.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
.ln textarea,.ln-input{width:100%;border:1px solid #D9CBC2;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;line-height:1.8;resize:vertical;margin:4px 0}.ln-input{font-size:14px}
.ln-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}
.ln-btn{border:1px solid #D9CBC2;background:#fff;border-radius:12px;padding:9px 16px;font:inherit;font-weight:800;color:#3A1F36;cursor:pointer}.ln-btn:disabled{opacity:.5;cursor:default}.ln-primary{background:#3A1F36;color:#fff;border-color:#3A1F36}.ln-yes{background:#2F6B66;color:#fff;border-color:#2F6B66}.ln-ghost{color:#8E7F8A}
.ln-quiet{margin-top:8px}
.ln-road{list-style:none;padding:0;margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap}.ln-step{border:1px solid #EADFD6;border-radius:12px;padding:6px 10px;font-size:12px;min-width:130px;background:#FBF4EE}.ln-step b{display:block;color:#3A1F36;font-size:13px}.ln-step span{color:#8E7F8A}.ln-step.now{border-color:#E9C98A;background:#FBF4EE}.ln-step.done{opacity:.65}
.ln-mine{margin-top:10px}.ln-mine summary{cursor:pointer;font-weight:800;color:#3A1F36;font-size:14px}
.ln-lines{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}.ln-lines li{position:relative;background:#FBF4EE;border:1px solid #EADFD6;border-radius:12px;padding:8px 12px;padding-inline-end:56px;line-height:1.8}.ln-lines b{display:block;font-size:15px;color:#2A1626}.ln-lines i{display:block;font-style:normal;color:#8A5A1E;font-size:13px}.ln-lines small{color:#B3A5AE;font-size:11px}.ln-tag{display:inline-block;background:#EADFD6;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800;color:#4A3645;margin-bottom:2px}
.ln-x{position:absolute;top:8px;inset-inline-end:8px;border:0;background:transparent;color:#B3A5AE;font:inherit;font-size:12px;cursor:pointer}.ln-x:hover{color:#B9544A}
.ln-foot{margin:16px 0 0;color:#8E7F8A;font-size:12.5px;line-height:1.8;display:flex;gap:6px;align-items:flex-start}
@media (max-width:640px){.ln-head h1{font-size:24px}.ln-room{padding:12px}}
`;
