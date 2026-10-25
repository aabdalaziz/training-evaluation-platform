'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — صفحة الجلسة: الموعد والعدّ التنازلي، الانضمام (Teams/Zoom/Meet/قاعة أَثَر)، التسجيل للندوات، الحضور، المهارات، التسجيل اللاحق والمواد

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { UI, t, programName } from '../../../lib/portal/content';
import { timeState, STATE_LABEL, canJoin, canCheckIn, fmtWhen, fmtRange, countdown, sessionTitle, sessionDesc, kindLabel, providerLabel, sessionAccessLabel, classroomLabel, validateRegistration, icsForSessions, icsFilename, activityKindLabel, activityPrompt, validateAnswer } from '../../../lib/portal/live';
import type { LiveSession, TimeState, Classroom, Registration, Activity, ActivityResponse, ActivityAnswer } from '../../../lib/portal/live';
import { skillName, domainLabel, frameworkBadges } from '../../../lib/portal/skills';
import type { Skill } from '../../../lib/portal/skills';
import { resTitle } from '../../../lib/portal/resources';

export default function SessionPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
const RESUME_KEY = 'athar_resume';

function Inner() {
  const { lang } = useLang(); const params = useParams<{ id: string }>(); const id = String(params?.id || ''); const db = useMemo(() => supabase(), []);
  const [s, setS] = useState<LiveSession | null>(null); const [room, setRoom] = useState<Classroom | null>(null); const [program, setProgram] = useState<{ id: string; name_ar: string; name_en?: string | null } | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]); const [resource, setResource] = useState<{ id: string; title_ar: string; title_en?: string | null } | null>(null); const [attendToken, setAttendToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null); const [reg, setReg] = useState<Registration | null>(null); const [regCount, setRegCount] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null); const [loaded, setLoaded] = useState(false); const [visible, setVisible] = useState(true);
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [org, setOrg] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [acts, setActs] = useState<Activity[]>([]); const [mine, setMine] = useState<Record<string, ActivityResponse>>({}); const [draft, setDraft] = useState<Record<string, ActivityAnswer>>({}); const [actErr, setActErr] = useState<Record<string, string>>({}); const [series, setSeries] = useState<LiveSession[]>([]);

  async function token(): Promise<string> { const { data } = await db.auth.getSession(); return data.session?.access_token || ''; }
  useEffect(() => {
    (async () => {
      try {
        const [{ data }, { data: { user: u } }] = await Promise.all([db.from('portal_sessions').select('*').eq('id', id).maybeSingle(), db.auth.getUser()]);
        const ses = (data as LiveSession) || null; setS(ses); if (!ses) setVisible(false);
        if (u) { setUser({ id: u.id, email: u.email || '', name: String(u.user_metadata?.full_name || '') }); setName(String(u.user_metadata?.full_name || '')); try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } }
        if (ses) {
          const [{ data: cr }, { data: pg }, { data: sk }, { data: rs }, { data: at }] = await Promise.all([
            ses.classroom_id ? db.from('classrooms').select('id,code,section_name,program_id').eq('id', ses.classroom_id).maybeSingle() : Promise.resolve({ data: null as any }),
            ses.program_id ? db.from('programs').select('id,name_ar,name_en').eq('id', ses.program_id).maybeSingle() : Promise.resolve({ data: null as any }),
            (ses.skills || []).length ? db.from('portal_skills').select('*').in('id', ses.skills) : Promise.resolve({ data: [] as any[] }),
            ses.resource_id ? db.from('portal_resources').select('id,title_ar,title_en').eq('id', ses.resource_id).eq('status', 'published').maybeSingle() : Promise.resolve({ data: null as any }),
            ses.attendance_session_id ? db.from('attendance_sessions').select('token,status').eq('id', ses.attendance_session_id).maybeSingle() : Promise.resolve({ data: null as any }),
          ]);
          setRoom(cr || null); setProgram(pg || null); setSkills((sk || []) as Skill[]); setResource(rs || null); if (at && (at as any).status === 'open') setAttendToken((at as any).token);
          const [{ data: ac }, { data: ser }] = await Promise.all([db.from('portal_session_activities').select('*').eq('session_id', id).eq('active', true).order('sort'), ses.series_id ? db.from('portal_sessions').select('*').eq('series_id', ses.series_id).neq('status', 'cancelled').order('starts_at') : Promise.resolve({ data: [] as any[] })]);
          setActs((ac || []) as Activity[]); setSeries((ser || []) as LiveSession[]);
          if (u && (ac || []).length) { const { data: my } = await db.from('portal_activity_responses').select('*').eq('session_id', id).eq('user_id', u.id); const m: Record<string, ActivityResponse> = {}; for (const r of ((my || []) as ActivityResponse[])) m[r.activity_id] = r; setMine(m); }
          if (u && ['public', 'registered'].includes(ses.access)) { const [{ data: r }, { count }] = await Promise.all([db.from('portal_session_registrations').select('*').eq('session_id', id).eq('user_id', u.id).maybeSingle(), db.from('portal_session_registrations').select('id', { count: 'exact', head: true }).eq('session_id', id)]); setReg((r as Registration) || null); setRegCount(count ?? null); }
        }
      } catch { /* يبقى فارغًا */ }
      setNow(new Date()); setLoaded(true);
    })();
    const iv = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(iv);
  }, [db, id]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy('link'); try { localStorage.setItem(RESUME_KEY, `/live/${id}`); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/live/${id}` } }); setBusy('');
    if (error) setErr((lang === 'ar' ? 'تعذّر إرسال الرابط: ' : 'Could not send link: ') + error.message); else setSent(true);
  }
  async function register(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setOk(''); const v = validateRegistration({ full_name: name, email: user?.email || '' }); if (v) { setErr(v); return; }
    setBusy('reg');
    try { const tk = await token(); const j = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'register', session_id: id, full_name: name.trim(), organization: org.trim() }) }).then(x => x.json()); if (!j.success) setErr(j.error || 'خطأ'); else { setReg({ id: 'new', session_id: id, email: user!.email, full_name: name } as Registration); setRegCount(c => (c ?? 0) + 1); setOk(lang === 'ar' ? 'تم تسجيلك — سيصلك تأكيد وتذكير بالبريد.' : 'Registered — a confirmation and reminder will be emailed.'); } } catch (x: any) { setErr(String(x?.message || x)); }
    setBusy('');
  }
  function addToCalendar(all: boolean) {
    if (!s) return; const rows = all && series.length ? series : [s]; const text = icsForSessions(rows, window.location.origin, lang);
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = icsFilename(s, all && series.length > 1); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function watch() {
    setErr(''); setBusy('rec');
    try { const tk = await token(); const j = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: 'recording', session_id: id }) }).then(x => x.json()); if (!j.success) setErr(j.error || 'خطأ'); else window.open(j.url, '_blank', 'noopener'); } catch (x: any) { setErr(String(x?.message || x)); }
    setBusy('');
  }
  async function answer(a: Activity) {
    const ans = draft[a.id] || {}; const v = validateAnswer(a, ans); if (v) { setActErr(x => ({ ...x, [a.id]: v })); return; }
    setActErr(x => ({ ...x, [a.id]: '' })); setBusy('act' + a.id);
    try { const tk = await token(); const j = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'answer', activity_id: a.id, answer: ans }) }).then(x => x.json()); if (!j.success) setActErr(x => ({ ...x, [a.id]: j.error || 'خطأ' })); else setMine(m => ({ ...m, [a.id]: { id: 'new', activity_id: a.id, session_id: id, user_id: user?.id || '', answer: ans, score: j.score } })); } catch (x: any) { setActErr(e => ({ ...e, [a.id]: String(x?.message || x) })); }
    setBusy('');
  }
  async function join() {
    setErr(''); setBusy('join');
    try { const tk = await token(); const j = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ action: 'join', session_id: id }) }).then(x => x.json()); if (!j.success) setErr(j.error || 'خطأ'); else window.open(j.url, '_blank', 'noopener'); } catch (x: any) { setErr(String(x?.message || x)); }
    setBusy('');
  }

  if (loaded && !s) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap" style={{ textAlign: 'center' }}><h2>{lang === 'ar' ? 'الجلسة غير متاحة' : 'Session not available'}</h2><p className="pt-muted">{lang === 'ar' ? 'قد تكون الجلسة خاصة بشعبة معيّنة — سجّل الدخول ببريد التسجيل في البرنامج.' : 'This session may be restricted to a section — sign in with your enrollment email.'}</p>{!user && <form onSubmit={sendLink} className="pt-form" style={{ maxWidth: 380, margin: '14px auto' }}><label>{lang === 'ar' ? 'بريدك الإلكتروني' : 'Your email'}<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>{sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط الدخول.' : 'Sign-in link sent.'}</div> : <button className="pt-btn" disabled={busy === 'link'}><Icon name="mail" size={15} /> {lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link'}</button>}{err && <div className="pt-alert err">{err}</div>}</form>}<Link href="/live" className="pt-btn light">{lang === 'ar' ? 'كل الجلسات' : 'All sessions'}</Link></div></section></main>;
  if (!s) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;

  const n = now || new Date(0); const st: TimeState = now ? timeState(s, n) : 'upcoming'; const joinable = canJoin(st); const openReg = ['public', 'registered'].includes(s.access) && (st === 'upcoming' || st === 'soon' || st === 'live'); const full = !!(s.capacity && regCount !== null && regCount >= s.capacity);
  return (
    <main className="pt-main ls">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/live">{lang === 'ar' ? 'التعلّم المباشر' : 'Live learning'}</Link> / <span>{kindLabel(s.kind, lang)}</span></div>
        <div className="ls-tags"><span className={`ls-state ${st}`}>{st === 'live' && <i />}{t(STATE_LABEL[st], lang)}</span><span>{kindLabel(s.kind, lang)}</span>{room && <span>{classroomLabel(room, lang)}</span>}<span><Icon name="laptop" size={12} /> {providerLabel(s.provider, lang)}</span><span><Icon name="shield" size={12} /> {sessionAccessLabel(s.access, lang)}</span></div>
        <h1>{sessionTitle(s, lang)}</h1>
        <p className="ls-when"><Icon name="calendar" size={16} /> <bdi>{fmtWhen(s.starts_at, lang, { date: true, weekday: true })}</bdi> · <bdi>{fmtRange(s, lang)}</bdi> ({lang === 'ar' ? 'توقيت الرياض' : 'Riyadh'}) · {s.duration_min} {lang === 'ar' ? 'دقيقة' : 'min'}{now && st === 'upcoming' && <> · <b>{countdown(s.starts_at, n, lang)}</b></>}</p>
      </div></section>

      <section className="pt-sec"><div className="pt-wrap pt-two">
        <div style={{ display: 'grid', gap: 14 }}>
          {sessionDesc(s, lang) && <div className="pt-box pt-prose"><h3><Icon name="book" size={18} /> {lang === 'ar' ? 'عن الجلسة' : 'About this session'}</h3>{sessionDesc(s, lang).split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}{s.speaker_name && <p><b>{lang === 'ar' ? 'المتحدث/المدرب:' : 'Speaker/trainer:'}</b> {s.speaker_name}</p>}</div>}
          {skills.length > 0 && <div className="pt-box"><h3><Icon name="target" size={18} /> {lang === 'ar' ? 'المهارات التي تنمّيها' : 'Skills developed'}</h3><div className="ls-skills">{skills.map(k => <div key={k.id} className="ls-skill"><div><b>{skillName(k, lang)}</b><small>{k.code} · {domainLabel(k.domain, lang)}</small></div><div className="ls-fw">{frameworkBadges(k).map(b => <span key={b.k} className={b.k}>{b.label}</span>)}</div></div>)}</div></div>}
          {(program || resource) && <div className="pt-box"><h3><Icon name="link" size={18} /> {lang === 'ar' ? 'مرتبط بـ' : 'Linked to'}</h3><div className="pt-chips">{program && <Link href={`/programs/${program.id}`} className="pt-btn light small"><Icon name="programs" size={14} /> {programName(program as any, lang)}</Link>}{resource && <Link href={`/resources/${resource.id}`} className="pt-btn light small"><Icon name="folder" size={14} /> {resTitle(resource, lang)}</Link>}</div></div>}
          {s.recording_url && <div className="pt-box ls-rec"><h3><Icon name="play" size={18} /> {lang === 'ar' ? 'تسجيل الجلسة' : 'Session recording'}</h3><button type="button" className="pt-btn" disabled={busy === 'rec'} onClick={watch}><Icon name="play" size={15} /> {busy === 'rec' ? '…' : (lang === 'ar' ? 'مشاهدة التسجيل' : 'Watch recording')}</button></div>}
          {acts.length > 0 && (st === 'live' || st === 'ended') && <div className="pt-box ls-acts"><h3><Icon name="evaluations" size={18} /> {lang === 'ar' ? 'نشاط ما بعد الجلسة' : 'Post-session activity'} <small>({Object.keys(mine).length}/{acts.length})</small></h3>
            {!user && <p className="pt-muted">{lang === 'ar' ? 'سجّل الدخول للإجابة — تُحفظ إجاباتك كدليل مهارة في ملفك.' : 'Sign in to answer — responses are saved as skill evidence.'}</p>}
            <div className="ls-actlist">{acts.map((a, i) => { const done = mine[a.id]; const d = draft[a.id] || {}; const sk = a.skill_id ? skills.find(k => k.id === a.skill_id) : null; return (
              <div key={a.id} className={`ls-act ${done ? 'done' : ''}`}>
                <div className="ls-acthead"><span className="ls-actn">{i + 1}</span><div><b>{activityPrompt(a, lang)}</b><small>{activityKindLabel(a.kind, lang)}{sk ? ` · ${skillName(sk, lang)}` : ''}</small></div></div>
                {a.kind === 'mcq' && <div className="ls-opts">{(a.options || []).map((o, k) => <label key={k} className={`ls-opt ${done ? (k === done.answer.choice ? (Number(done.score) === 100 ? 'right' : 'wrong') : (a.correct === k && Number(done.score) !== 100 ? 'hint' : '')) : (d.choice === k ? 'on' : '')}`}><input type="radio" name={`a${a.id}`} disabled={!!done || !user} checked={(done ? done.answer.choice : d.choice) === k} onChange={() => setDraft(x => ({ ...x, [a.id]: { choice: k } }))} /><span>{o}</span></label>)}</div>}
                {a.kind === 'reflection' && <textarea className="ls-ta" disabled={!!done || !user} value={done ? String(done.answer.text || '') : (d.text || '')} onChange={e => setDraft(x => ({ ...x, [a.id]: { text: e.target.value } }))} placeholder={lang === 'ar' ? 'أهم ما تعلّمته وكيف ستطبقه…' : 'Key takeaway and how you will apply it…'} />}
                {a.kind === 'self_rating' && <div className="ls-rating">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} disabled={!!done || !user} className={(done ? done.answer.rating : d.rating) === n ? 'on' : ''} onClick={() => setDraft(x => ({ ...x, [a.id]: { rating: n } }))}>{n}</button>)}<small>{lang === 'ar' ? '1 = مبتدئ · 5 = متمكّن' : '1 = novice · 5 = proficient'}</small></div>}
                {actErr[a.id] && <div className="pt-alert err">{actErr[a.id]}</div>}
                {!done && user && <button type="button" className="pt-btn small" disabled={busy === 'act' + a.id} onClick={() => answer(a)}><Icon name="check" size={14} /> {busy === 'act' + a.id ? '…' : (lang === 'ar' ? 'إرسال الإجابة' : 'Submit')}</button>}
                {done && <div className={`ls-actres ${a.kind === 'mcq' ? (Number(done.score) === 100 ? 'ok' : 'no') : 'ok'}`}><Icon name="check" size={13} /> {a.kind === 'mcq' ? (Number(done.score) === 100 ? (lang === 'ar' ? 'إجابة صحيحة' : 'Correct') : (lang === 'ar' ? 'إجابة غير صحيحة — الصحيحة مظلّلة' : 'Incorrect — the right answer is highlighted')) : (lang === 'ar' ? 'سُجّلت إجابتك كدليل مهارة' : 'Saved as skill evidence')}</div>}
              </div>); })}</div></div>}
        </div>

        <aside className="pt-box pt-sticky ls-aside">
          {st === 'ended' && !s.recording_url && <p className="pt-muted">{lang === 'ar' ? 'انتهت الجلسة. سيُنشر التسجيل هنا إن توفر.' : 'This session has ended. The recording will appear here when available.'}</p>}
          {st === 'cancelled' && <div className="pt-alert err">{lang === 'ar' ? 'أُلغيت هذه الجلسة.' : 'This session was cancelled.'}</div>}
          {(st === 'upcoming' || st === 'soon' || st === 'live') && <>
            <div className={`ls-join ${joinable ? 'on' : ''}`}>
              <b>{joinable ? (lang === 'ar' ? 'الجلسة متاحة الآن' : 'Session is open') : (lang === 'ar' ? 'يفتح زر الانضمام قبل الموعد بـ15 دقيقة' : 'Join opens 15 minutes before start')}</b>
              <button type="button" className={`pt-btn ${joinable ? 'gold' : 'ghost'}`} disabled={!joinable || !!busy} onClick={join}><Icon name="play" size={16} /> {busy === 'join' ? '…' : (lang === 'ar' ? `انضم عبر ${providerLabel(s.provider, lang)}` : `Join via ${providerLabel(s.provider, lang)}`)}</button>
              {s.provider === 'athar' && <small className="pt-muted">{lang === 'ar' ? 'قاعة أَثَر تعمل في المتصفح مباشرة — اسمح بالكاميرا والميكروفون.' : 'Athar Room runs in the browser — allow camera and microphone.'}</small>}
            </div>
            <div className="ls-cal"><button type="button" className="pt-btn ghost small" onClick={() => addToCalendar(false)}><Icon name="calendar" size={14} /> {lang === 'ar' ? 'أضف إلى التقويم' : 'Add to calendar'}</button>{series.length > 1 && <button type="button" className="pt-btn ghost small" onClick={() => addToCalendar(true)}><Icon name="calendar" size={14} /> {lang === 'ar' ? `السلسلة كاملة (${series.length})` : `Whole series (${series.length})`}</button>}</div>
            {attendToken && user && canCheckIn(s, n) && <a href={`/attend/${attendToken}`} className="pt-btn small ls-attend"><Icon name="check" size={14} /> {lang === 'ar' ? 'سجّل حضورك' : 'Check in'}</a>}
            {openReg && <div className="ls-reg">
              <h3><Icon name="users" size={16} /> {lang === 'ar' ? 'التسجيل' : 'Registration'} {regCount !== null && <small>({regCount}{s.capacity ? ` / ${s.capacity}` : ''})</small>}</h3>
              {reg && <div className="pt-alert ok">{lang === 'ar' ? 'أنت مسجّل في هذه الجلسة ✓ — سيصلك التذكير ورابط الانضمام بالبريد.' : 'You are registered ✓ — reminder and join link by email.'}</div>}
              {!reg && !user && !sent && <form onSubmit={sendLink} className="pt-form"><p className="pt-muted" style={{ margin: 0 }}>{lang === 'ar' ? 'أدخل بريدك لاستلام رابط دخول ثم أكمل التسجيل بنقرة.' : 'Enter your email for a sign-in link, then register in one click.'}</p><label>{lang === 'ar' ? 'بريدك الإلكتروني' : 'Your email'}<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required /></label><button className="pt-btn" disabled={busy === 'link'}><Icon name="mail" size={15} /> {busy === 'link' ? '…' : (lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link')}</button></form>}
              {!reg && !user && sent && <div className="pt-alert ok">{lang === 'ar' ? `أرسلنا رابط الدخول إلى ${email}. افتحه لتعود إلى هذه الصفحة.` : `Sign-in link sent to ${email}.`}</div>}
              {!reg && user && !full && <form onSubmit={register} className="pt-form"><label>{lang === 'ar' ? 'الاسم الكامل' : 'Full name'}<input value={name} onChange={e => setName(e.target.value)} required /></label><label>{lang === 'ar' ? 'الجهة (اختياري)' : 'Organization (optional)'}<input value={org} onChange={e => setOrg(e.target.value)} /></label><button className="pt-btn" disabled={busy === 'reg'}><Icon name="check" size={15} /> {busy === 'reg' ? '…' : (lang === 'ar' ? 'سجّلني' : 'Register me')}</button></form>}
              {!reg && user && full && <div className="pt-alert err">{lang === 'ar' ? 'اكتمل العدد لهذه الجلسة.' : 'This session is full.'}</div>}
            </div>}
            {s.access === 'program' && !user && <div className="ls-reg"><p className="pt-muted" style={{ margin: 0 }}>{lang === 'ar' ? 'هذه جلسة شعبة — إن كنت متدربًا في البرنامج، سجّل الدخول من بوابة المتدرب.' : 'Section session — if you are enrolled, sign in from the student portal.'}</p><Link href="/me" className="pt-btn light small"><Icon name="login" size={14} /> {t(UI.student, lang)}</Link></div>}
          </>}
          {ok && <div className="pt-alert ok" style={{ marginTop: 10 }}>{ok}</div>}{err && <div className="pt-alert err" style={{ marginTop: 10 }}>{err}</div>}
          <div className="ls-facts"><span><small>{lang === 'ar' ? 'المنصة' : 'Platform'}</small><b>{providerLabel(s.provider, lang)}</b></span><span><small>{lang === 'ar' ? 'المدة' : 'Duration'}</small><b>{s.duration_min} {lang === 'ar' ? 'د' : 'min'}</b></span><span><small>{lang === 'ar' ? 'اللغة' : 'Language'}</small><b>{s.lang === 'en' ? 'English' : 'العربية'}</b></span></div>
          {user && <small className="pt-muted" style={{ display: 'block', marginTop: 8 }}>{lang === 'ar' ? 'مسجّل الدخول بـ' : 'Signed in as'} <bdi>{user.email}</bdi></small>}
        </aside>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.ls-tags{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:800;margin-bottom:10px}.ls-tags span{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.12);color:#fff;border-radius:999px;padding:4px 10px}.ls-state.live{background:#dc2626!important}.ls-state.live i{width:8px;height:8px;border-radius:50%;background:#fff}.ls-state.soon{background:#d97706!important}.ls-state.ended{background:#475569!important}.ls-state.cancelled{background:#7f1d1d!important}
.ls-when{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:15px;color:rgba(255,255,255,.9)}.ls-when b{color:#c9a24b}
.ls-skills{display:grid;gap:8px}.ls-skill{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.ls-skill b{display:block;font-size:14px;color:#0f172a}.ls-skill small{color:#64748b;font-size:12px}
.ls-fw{display:flex;gap:5px;flex-wrap:wrap}.ls-fw span{font-size:10.5px;font-weight:900;border-radius:6px;padding:3px 7px;background:#e2e8f0;color:#334155;direction:ltr}.ls-fw .saqf{background:#dcfce7;color:#166534}.ls-fw .sdaia{background:#ede9fe;color:#5b21b6}.ls-fw .cefr{background:#dbeafe;color:#1e40af}
.ls-rec{background:#fdf6e3;border-color:#f3e3b3}
.ls-cal{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ls-acts h3 small{color:#64748b;font-weight:600}.ls-actlist{display:grid;gap:12px}.ls-act{border:1px solid #e2e8f0;border-radius:14px;padding:14px;display:grid;gap:10px;background:#fff}.ls-act.done{background:#f8fafc}
.ls-acthead{display:flex;gap:10px;align-items:flex-start}.ls-actn{width:26px;height:26px;border-radius:50%;background:#0f2a4e;color:#fff;display:inline-grid;place-items:center;font-size:12.5px;font-weight:900;flex:none}.ls-acthead b{display:block;font-size:14.5px;color:#0f172a;line-height:1.6}.ls-acthead small{color:#64748b;font-size:12px}
.ls-opts{display:grid;gap:6px}.ls-opt{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13.5px}.ls-opt.on{border-color:#0b8a83;background:#f0fdfa}.ls-opt.right{border-color:#059669;background:#ecfdf5}.ls-opt.wrong{border-color:#dc2626;background:#fef2f2}.ls-opt.hint{border-color:#059669;border-style:dashed}
.ls-ta{width:100%;box-sizing:border-box;min-height:80px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;font:inherit;font-size:13.5px;resize:vertical}
.ls-rating{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ls-rating button{width:40px;height:40px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;font:inherit;font-weight:900;cursor:pointer}.ls-rating button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ls-rating small{color:#64748b;font-size:12px;margin-inline-start:6px}
.ls-actres{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;font-weight:800;border-radius:999px;padding:4px 10px;background:#ecfdf5;color:#065f46}.ls-actres.no{background:#fef2f2;color:#991b1b}
.ls-join{display:grid;gap:8px;padding:14px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0}.ls-join.on{background:#fff7ed;border-color:#fdba74}.ls-join b{font-size:13.5px;color:#0f172a}.ls-join .pt-btn{justify-content:center;font-size:15px;padding:12px}
.ls-attend{margin-top:10px;width:100%;justify-content:center;box-sizing:border-box}
.ls-reg{margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;display:grid;gap:8px}.ls-reg h3{margin:0;font-size:15px;display:flex;gap:6px;align-items:center;color:#0f2a4e}.ls-reg h3 small{color:#64748b;font-weight:600}
.ls-facts{margin-top:14px;padding-top:12px;border-top:1px dashed #e2e8f0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}.ls-facts small{display:block;color:#64748b;font-size:11.5px}.ls-facts b{color:#0f172a;font-size:13.5px}
.pt-sticky{position:sticky;top:84px}.pt-muted{color:#64748b;font-size:13.5px;line-height:1.8}
@media(max-width:760px){.pt-sticky{position:static}}
`;
