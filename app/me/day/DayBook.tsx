'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P51 «دفتر اليوم» — لوحة المدرّب: تحية + 4 أرقام · جلساتي اليوم · شُعبي (من غاب أمس · مِران · ينتظر توقيعي · عُبور الأسبوع) · «كلمة» · طباعة A4
 *  testids: dy-root[data-date] dy-hello dy-counts dy-c-sessions dy-c-absent dy-c-idle dy-c-sign dy-sessions dy-session[data-state] dy-room[data-id]
 *           dy-absent dy-absent-row[data-email] dy-idle dy-idle-row[data-email] dy-sign dy-exit dy-word-open dy-word dy-word-mode dy-word-text dy-word-tpl dy-word-send dy-word-ok dy-err dy-print dy-empty dy-unlinked
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';

type Learner = { email: string; name: string };
type Room = { id: string; code: string; section_name: string | null; roster: number; roster_list: Learner[]; absent_yesterday: Array<Learner & { absences_30: number }>; sessions_yesterday: number; practice: { active: number; done_today: number; idle: Array<Learner & { idle_days: number }> }; drafts_pending: number; exit_week: { passed: number; conditional: number; failed: number; no_plan: number } };
type Session = { id: string; title_ar: string; kind: string; starts_at: string; duration_min: number; provider: string; status: string; classroom: { id: string; code: string; section_name: string | null } | null; join_url: string | null; host_url: string | null; facilitator_href: string; state: 'soon' | 'live' | 'ended' | 'upcoming' };
type Book = { date: string; date_ar: string; hello_ar: string; trainer_name: string; viewing_other: boolean; linked: boolean; counts: { sessions_today: number; absent_yesterday: number; idle: number; to_sign: number }; sessions: Session[]; classrooms: Room[]; to_sign: { total: number; groups: Array<{ key: string; title_ar: string; count: number; href: string; items?: Array<{ id: string; label_ar: string; count: number; href: string }> }> }; words_today: number; templates: Array<{ key: string; label_ar: string; text_ar: string }> };
type Mode = 'one' | 'absent' | 'idle' | 'all';
const PROV: Record<string, string> = { teams: 'Teams', zoom: 'Zoom', meet: 'Meet', athar: 'قاعة أَثَر', other: 'منصة' };
const KIND: Record<string, string> = { class: 'درس', webinar: 'ندوة', workshop: 'ورشة', office_hours: 'ساعة مكتبية', remedial: 'تعويض' };
const STATE: Record<Session['state'], string> = { live: 'على الهواء', soon: 'بعد قليل', upcoming: 'لاحقًا', ended: 'انتهت' };
const hm = (iso: string) => { try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return iso.slice(11, 16); } };
const first = (n: string) => (n || '').trim().split(/\s+/)[0] || '';

export default function DayBook() {
  const db = useMemo(() => supabase(), []);
  const [book, setBook] = useState<Book | null>(null); const [err, setErr] = useState<{ code: number; msg: string } | null>(null);
  const [word, setWord] = useState<{ room: Room; mode: Mode; email?: string; name?: string } | null>(null); const [text, setText] = useState(''); const [tpl, setTpl] = useState<string>(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState('');
  const trainerParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('trainer') : null;
  const hdr = useCallback(async () => { const { data } = await db.auth.getSession(); const t = data.session?.access_token; if (!t) { setErr({ code: 401, msg: 'سجّل الدخول أولًا' }); return null; } return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }, [db]);
  const load = useCallback(async () => { const H = await hdr(); if (!H) return; const r = await fetch(`/api/me/day${trainerParam ? `?trainer=${encodeURIComponent(trainerParam)}` : ''}`, { headers: H, cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر التحميل' }); return; } setErr(null); setBook(j); }, [hdr, trainerParam]);
  useEffect(() => { void load(); const iv = setInterval(() => void load(), 120000); return () => clearInterval(iv); }, [load]);
  function openWord(room: Room, mode: Mode, l?: Learner) { setWord({ room, mode, email: l?.email, name: l?.name }); setText(''); setTpl(mode === 'absent' ? 'absent' : mode === 'idle' ? 'idle' : 'cheer'); setOk(''); setTimeout(() => document.getElementById('dy-word')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
  async function send() {
    if (!word || busy) return; const n = word.mode === 'one' ? 1 : word.mode === 'absent' ? word.room.absent_yesterday.length : word.mode === 'idle' ? word.room.practice.idle.length : word.room.roster;
    if (!window.confirm(`إرسال «كلمة» إلى ${n} ${n === 1 ? 'متعلّم' : 'متعلّمين'} في شعبة ${word.room.code}؟ تصل إلى «تنبيهاتي» داخل أَثَر فقط.`)) return;
    setBusy(true); setOk(''); const H = await hdr(); if (!H) { setBusy(false); return; }
    const r = await fetch('/api/me/day', { method: 'POST', headers: H, body: JSON.stringify({ action: 'word', classroom_id: word.room.id, mode: word.mode, email: word.email || null, text: text.trim() || undefined, template: text.trim() ? null : tpl || null }) }); const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر الإرسال' }); return; }
    setOk(`وصلت كلمتك إلى ${j.sent} ${j.sent === 1 ? 'متعلّم' : 'متعلّمين'} ✓`); setWord(null); setBook((p) => p ? { ...p, words_today: j.words_today ?? p.words_today } : p);
  }
  const preview = word ? (text.trim() || (book?.templates.find((t) => t.key === tpl)?.text_ar || '').replace(/\{name\}/g, word.mode === 'one' ? first(word.name || '') || 'صديقي' : 'صديقي')) : '';
  const quiet = book && !book.sessions.length && !book.counts.absent_yesterday && !book.counts.idle && !book.counts.to_sign;
  return <main className="pt-main dy" dir="rtl" data-testid="dy-root" data-date={book?.date || ''}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="dy-head">
      <div><p className="dy-kicker">بوابة أَثَر · P51 · سجلّ المدرّب اليومي</p><h1 data-testid="dy-hello">{book ? book.hello_ar : 'دفتر اليوم'}</h1><p className="pt-muted">{book?.date_ar || ''}{book?.viewing_other ? ` · تطّلع على دفتر ${book.trainer_name} (بلا «كلمة»)` : ''}</p></div>
      <div className="dy-acts no-print"><button type="button" className="dy-btn ghost" onClick={() => window.print()} data-testid="dy-print"><Icon name="print" size={14} /> اطبع</button><button type="button" className="dy-btn ghost" onClick={() => void load()}><Icon name="refresh" size={14} /> تحديث</button><Link href="/live/trainer" className="dy-btn ghost">جدولي الأسبوعي</Link></div>
    </header>
    {err && <section className="dy-msg" role="alert" data-testid="dy-err">{err.code === 403 ? <>«دفتر اليوم» للمدرّبين والطاقم. <Link href="/me">مساحتي</Link></> : err.msg}</section>}
    {ok && <p className="dy-ok" role="status" data-testid="dy-word-ok">{ok}</p>}
    {book && <>
      <section className="dy-counts" data-testid="dy-counts">
        <Card n={book.counts.sessions_today} l="جلساتي اليوم" t="sessions" href="#dy-sessions" gold={book.counts.sessions_today > 0} /><Card n={book.counts.absent_yesterday} l="غابوا أمس" t="absent" href="#dy-rooms" /><Card n={book.counts.idle} l="توقّفوا في مِران" t="idle" href="#dy-rooms" /><Card n={book.counts.to_sign} l="ينتظر توقيعي" t="sign" href="/admin/sign" />
      </section>
      {!book.linked && <section className="dy-box" data-testid="dy-unlinked"><h2>لم يُربط بريدك ببطاقة مدرّب بعد</h2><p className="pt-muted">اطلب من إدارة البرامج ربط بريدك ببطاقتك في «هيئة أَثَر — المدرّبون»، وسيمتلئ دفترك تلقائيًّا: جلساتك، شُعبك، حضورهم، ومِرانهم.</p><Link href="/trainers" className="dy-btn">هيئة أَثَر</Link></section>}
      {book.linked && quiet && <section className="dy-empty" data-testid="dy-empty"><span aria-hidden="true">📒</span><h2>يومٌ هادئ</h2><p className="pt-muted">لا جلسات اليوم، ولا غياب أمس، ولا متوقّف في مِران، ولا توقيع ينتظرك. كلمة تشجيع لشعبة تُحسن صباح أحدهم.</p></section>}
      {book.sessions.length > 0 && <section className="dy-box" id="dy-sessions" data-testid="dy-sessions"><h2><Icon name="calendar" size={16} /> جلساتي اليوم <small>{book.sessions.length}</small></h2>
        <ul className="dy-list">{book.sessions.map((s) => <li key={s.id} className={`dy-ses ${s.state}`} data-testid="dy-session" data-state={s.state}>
          <div className="dy-time"><b>{hm(s.starts_at)}</b><small>{s.duration_min} د</small></div>
          <div className="dy-ses-body"><strong>{s.title_ar}</strong><span className="dy-meta">{KIND[s.kind] || s.kind}{s.classroom ? ` · شعبة ${s.classroom.code}` : ''} · {PROV[s.provider] || s.provider} · <em className={`dy-state ${s.state}`}>{STATE[s.state]}</em></span></div>
          <div className="dy-ses-acts no-print">{s.host_url && <a href={s.host_url} target="_blank" rel="noopener noreferrer" className="dy-btn sm">رابط المضيف</a>}{!s.host_url && s.join_url && <a href={s.join_url} target="_blank" rel="noopener noreferrer" className="dy-btn sm ghost">رابط الجلسة</a>}<Link href={s.facilitator_href} className="dy-btn sm ghost">الميسِّر الحي</Link></div>
        </li>)}</ul></section>}
      {book.classrooms.length > 0 && <section id="dy-rooms">{book.classrooms.map((r) => <article key={r.id} className="dy-box dy-room" data-testid="dy-room" data-id={r.id}>
        <header className="dy-room-h"><h2><Icon name="users" size={16} /> شعبة {r.code}{r.section_name ? ` — ${r.section_name}` : ''} <small>{r.roster} متعلّمًا</small></h2>
          {!book.viewing_other && r.roster > 0 && <button type="button" className="dy-btn sm ghost no-print" onClick={() => openWord(r, 'all')} data-testid="dy-word-open" data-mode="all"><Icon name="chat" size={14} /> كلمة للشعبة</button>}</header>
        <div className="dy-grid">
          <div className="dy-cell" data-testid="dy-absent"><h3>من غاب أمس {r.sessions_yesterday ? <small>{r.absent_yesterday.length} من {r.roster}</small> : <small>لا جلسة أمس</small>}</h3>
            {r.sessions_yesterday === 0 && <p className="pt-muted">لم تُعقد جلسة حضور لهذه الشعبة أمس.</p>}
            {r.sessions_yesterday > 0 && r.absent_yesterday.length === 0 && <p className="dy-good">حضر الجميع ✓</p>}
            {r.absent_yesterday.length > 0 && <ul className="dy-people">{r.absent_yesterday.map((l) => <li key={l.email} data-testid="dy-absent-row" data-email={l.email}><span>{l.name || l.email}</span><small>{l.absences_30 > 1 ? `غاب ${l.absences_30} مرّات في 30 يومًا` : 'أول غياب في 30 يومًا'}</small>{!book.viewing_other && <button type="button" className="dy-link no-print" onClick={() => openWord(r, 'one', l)}>كلمة</button>}</li>)}</ul>}
            {r.absent_yesterday.length > 1 && !book.viewing_other && <button type="button" className="dy-btn sm no-print" onClick={() => openWord(r, 'absent')} data-testid="dy-word-open" data-mode="absent">كلمة للغائبين ({r.absent_yesterday.length})</button>}
          </div>
          <div className="dy-cell" data-testid="dy-idle"><h3>مِران <small>{r.practice.active} خطّة فعّالة · أنجز اليوم {r.practice.done_today}</small></h3>
            {r.practice.active === 0 && <p className="pt-muted">لا خطط مِران فعّالة بعد.</p>}
            {r.practice.active > 0 && r.practice.idle.length === 0 && <p className="dy-good">لا متوقّفين ✓</p>}
            {r.practice.idle.length > 0 && <ul className="dy-people">{r.practice.idle.map((l) => <li key={l.email} data-testid="dy-idle-row" data-email={l.email}><span>{l.name || l.email}</span><small>متوقّف منذ {l.idle_days} أيام</small>{!book.viewing_other && <button type="button" className="dy-link no-print" onClick={() => openWord(r, 'one', l)}>كلمة</button>}</li>)}</ul>}
            {r.practice.idle.length > 1 && !book.viewing_other && <button type="button" className="dy-btn sm no-print" onClick={() => openWord(r, 'idle')} data-testid="dy-word-open" data-mode="idle">كلمة للمتوقّفين ({r.practice.idle.length})</button>}
          </div>
          <div className="dy-cell" data-testid="dy-sign"><h3>ينتظر توقيعي</h3>{r.drafts_pending > 0 ? <p>{r.drafts_pending} مسوَّدة «مِران البداية» — <Link href={`/admin/miaar/ledger?practice=${r.id}`}>وقّعها من دفتر التسكين</Link></p> : <p className="dy-good">لا شيء ✓</p>}</div>
          <div className="dy-cell" data-testid="dy-exit"><h3>عُبور هذا الأسبوع</h3>{(r.exit_week.passed + r.exit_week.conditional + r.exit_week.failed) === 0 ? <p className="pt-muted">لا أحكام جديدة.</p> : <p>اجتاز {r.exit_week.passed} · مشروط {r.exit_week.conditional} · لم يجتز {r.exit_week.failed}{r.exit_week.no_plan ? <> · <Link href="/admin/sign">{r.exit_week.no_plan} بلا خطّة مِران</Link></> : null}</p>}</div>
        </div>
      </article>)}</section>}
      {book.linked && book.classrooms.length === 0 && !quiet && <p className="pt-muted">لا شُعب مسندة إليك بعد — الجلسات أعلاه من جدولك.</p>}
      {book.to_sign.total > 0 && <section className="dy-box" data-testid="dy-sign-all"><h2><Icon name="check" size={16} /> ينتظر توقيعي <small>{book.to_sign.total}</small></h2><ul className="dy-list plain">{book.to_sign.groups.map((g) => <li key={g.key}><Link href={g.href}>{g.title_ar}</Link> — {g.count}</li>)}</ul><Link href="/admin/sign" className="dy-btn sm ghost no-print">افتح «توقيعي»</Link></section>}
      {word && <section className="dy-box dy-word no-print" id="dy-word" data-testid="dy-word">
        <h2><Icon name="chat" size={16} /> كلمة {word.mode === 'one' ? `إلى ${word.name || word.email}` : word.mode === 'absent' ? `إلى الغائبين أمس (${word.room.absent_yesterday.length})` : word.mode === 'idle' ? `إلى المتوقّفين (${word.room.practice.idle.length})` : `إلى شعبة ${word.room.code} (${word.room.roster})`}</h2>
        <p className="pt-muted">تصل إلى «تنبيهاتي» داخل أَثَر باسمك — بلا درجات، كلمة واحدة لكل متعلّم في اليوم (الأحدث تحلّ محلّ الأقدم).</p>
        <div className="dy-tpls" data-testid="dy-word-tpl">{book.templates.map((t) => <button key={t.key} type="button" className={`dy-chip ${tpl === t.key && !text.trim() ? 'on' : ''}`} onClick={() => { setTpl(t.key); setText(''); }}>{t.label_ar}</button>)}</div>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} maxLength={200} rows={3} placeholder="أو اكتب كلمتك هنا (≤ 200 حرف)…" aria-label="نصّ الكلمة" data-testid="dy-word-text" />
        <p className="dy-preview">معاينة: «{preview}»</p>
        <div className="dy-acts"><button type="button" className="dy-btn" onClick={() => void send()} disabled={busy} data-testid="dy-word-send"><Icon name="send" size={14} /> {busy ? '…' : 'أرسل الكلمة'}</button><button type="button" className="dy-btn ghost" onClick={() => setWord(null)}>إلغاء</button><span className="pt-muted">{text.length}/200</span></div>
      </section>}
      <p className="dy-foot pt-muted">«دفتر اليوم» يُقرأ من مصادره الحيّة كل دقيقتين. الأسماء داخل شُعبك فقط · كلماتك اليوم: {book.words_today} · © 2026 أَثَر.</p>
    </>}
  </main>;
}
function Card({ n, l, t, href, gold }: { n: number; l: string; t: string; href: string; gold?: boolean }) { return <a href={href} className={`dy-card ${gold ? 'gold' : ''} ${n ? 'has' : ''}`} data-testid={`dy-c-${t}`} data-n={n}><b>{n}</b><span>{l}</span></a>; }

const CSS = `
.dy{max-width:1100px;margin:0 auto;padding:18px 16px 40px}.dy-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px}.dy-kicker{color:#b45309;font-weight:800;font-size:12.5px;margin:0 0 4px}.dy h1{margin:0;font-size:26px;color:#0f2a4e}
.dy-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.dy-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:1.5px solid #0f2a4e;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;min-height:38px}.dy-btn.ghost{background:#fff;color:#0f2a4e}.dy-btn.sm{padding:6px 10px;font-size:13px;min-height:32px}.dy-btn:disabled{opacity:.6;cursor:wait}
.dy-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0 14px}.dy-card{background:#fff;border:1px solid #e5e9f0;border-radius:14px;padding:14px;text-align:center;text-decoration:none;color:#0f2a4e}.dy-card b{display:block;font-size:30px;line-height:1.1}.dy-card span{font-size:13px;color:#475569}.dy-card.has{border-color:#c9a24b}.dy-card.gold{background:#fffbeb}
.dy-box{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:16px;margin-bottom:12px}.dy-box h2{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:18px;color:#0f2a4e}.dy-box h2 small{background:#eef2f7;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:800;color:#334155}
.dy-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.dy-list.plain li{padding:6px 0;border-bottom:1px dashed #e5e9f0}.dy-ses{display:grid;grid-template-columns:70px 1fr auto;gap:12px;align-items:center;border:1px solid #e5e9f0;border-radius:12px;padding:10px}.dy-ses.live{border-color:#16a34a;background:#f0fdf4}.dy-ses.soon{border-color:#c9a24b;background:#fffbeb}.dy-ses.ended{opacity:.7}
.dy-time{text-align:center}.dy-time b{display:block;font-size:18px}.dy-time small{color:#64748b}.dy-ses-body strong{display:block;font-size:15px}.dy-meta{color:#475569;font-size:13px}.dy-state.live{color:#15803d;font-style:normal;font-weight:800}.dy-state.soon{color:#b45309;font-style:normal;font-weight:800}.dy-ses-acts{display:flex;gap:6px;flex-wrap:wrap}
.dy-room-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.dy-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dy-cell{border:1px solid #eef2f7;border-radius:12px;padding:10px 12px}.dy-cell h3{margin:0 0 6px;font-size:14.5px;color:#0f2a4e;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dy-cell h3 small{color:#64748b;font-weight:600}.dy-cell p{margin:0}
.dy-people{list-style:none;margin:0 0 8px;padding:0}.dy-people li{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed #eef2f7}.dy-people small{color:#b45309;font-size:12px}.dy-link{background:none;border:none;color:#0f2a4e;text-decoration:underline;font:inherit;font-weight:800;cursor:pointer;padding:4px 6px;min-height:28px}.dy-good{color:#15803d;font-weight:800;margin:0}
.dy-word textarea{width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;margin:8px 0}.dy-tpls{display:flex;gap:6px;flex-wrap:wrap}.dy-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer;min-height:34px}.dy-chip.on{border-color:#0f2a4e;background:#0f2a4e;color:#fff}.dy-preview{background:#f8fafc;border-radius:10px;padding:8px 12px;margin:0 0 8px;color:#334155}
.dy-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:8px 0}.dy-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin:8px 0}.dy-empty{background:#fff;border:1px solid #a7f3d0;border-radius:16px;padding:30px 18px;text-align:center;margin-bottom:12px}.dy-empty span{font-size:40px}.dy-empty h2{margin:6px 0 4px}.dy-foot{font-size:12.5px;margin-top:16px}
@media (max-width:760px){.dy-counts{grid-template-columns:1fr 1fr}.dy-grid{grid-template-columns:1fr}.dy-ses{grid-template-columns:60px 1fr}.dy-ses-acts{grid-column:1/-1}.dy h1{font-size:22px}}
@media print{.no-print,.pt-header,.pt-footer,nav,.wb{display:none!important}.dy{max-width:none;padding:0}.dy-box,.dy-card{border-color:#999;break-inside:avoid}.dy-counts{grid-template-columns:repeat(4,1fr)}}
`;
