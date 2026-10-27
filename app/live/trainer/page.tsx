'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — جدول المدرب: جلساتي اليوم وهذا الأسبوع عبر كل القاعات، برابط المضيف، وبدء البث وتصدير التقويم — ومنه «الطيار المساعد الحي» لكل جلسة (P13-ب)

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { timeState, STATE_LABEL, fmtWhen, fmtRange, countdown, sessionTitle, providerLabel, classroomLabel, atharRoomUrl, trainerWeek, icsForSessions } from '../../../lib/portal/live';
import type { LiveSession, Classroom } from '../../../lib/portal/live';

export default function TrainerPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const RESUME_KEY = 'athar_resume';

function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [trainerIds, setTrainerIds] = useState<string[]>([]); const [staff, setStaff] = useState(false); const [trainerName, setTrainerName] = useState('');
  const [rows, setRows] = useState<LiveSession[]>([]); const [rooms, setRooms] = useState<Map<string, Classroom>>(new Map()); const [hosts, setHosts] = useState<Record<string, string>>({}); const [att, setAtt] = useState<Record<string, number>>({});
  const [now, setNow] = useState<Date | null>(null); const [loaded, setLoaded] = useState(false); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: u } } = await db.auth.getUser();
        if (!u) { setLoaded(true); setNow(new Date()); return; }
        setUser({ id: u.id, email: u.email || '' }); try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
        const [{ data: prof }, { data: tr }] = await Promise.all([db.from('profiles').select('role,full_name').eq('id', u.id).maybeSingle(), db.from('trainers').select('id,name,email').ilike('email', u.email || '')]);
        const isStaff = STAFF.includes(String((prof as any)?.role || '').toUpperCase()); setStaff(isStaff);
        const ids = ((tr || []) as any[]).map(t => t.id); setTrainerIds(ids); setTrainerName(String(((tr || []) as any[])[0]?.name || (prof as any)?.full_name || u.email || ''));
        const since = new Date(Date.now() - 3 * 3600000).toISOString(); const until = new Date(Date.now() + 8 * 86400000).toISOString();
        let q = db.from('portal_sessions').select('*').gte('starts_at', since).lte('starts_at', until).neq('status', 'cancelled').order('starts_at'); if (!isStaff) q = q.in('trainer_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        const { data: s } = await q; const list = (s || []) as LiveSession[]; setRows(list);
        const cids = Array.from(new Set(list.map(x => x.classroom_id).filter(Boolean))) as string[]; if (cids.length) { const { data: cr } = await db.from('classrooms').select('id,code,section_name,program_id').in('id', cids); setRooms(new Map(((cr || []) as Classroom[]).map(c => [c.id, c]))); }
        if (list.length) { const [{ data: hp }, { data: ar }] = await Promise.all([db.from('portal_session_private').select('session_id,host_url').in('session_id', list.map(x => x.id)), db.from('attendance_records').select('session_id').in('session_id', list.map(x => x.attendance_session_id).filter(Boolean) as string[])]); const h: Record<string, string> = {}; for (const x of ((hp || []) as any[])) if (x.host_url) h[x.session_id] = x.host_url; setHosts(h); const a: Record<string, number> = {}; for (const r of ((ar || []) as any[])) a[r.session_id] = (a[r.session_id] || 0) + 1; setAtt(a); }
      } catch { /* يبقى فارغًا */ }
      setNow(new Date()); setLoaded(true);
    })();
    const iv = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(iv);
  }, [db]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault(); setErr(''); const em = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; }
    setBusy('link'); try { localStorage.setItem(RESUME_KEY, '/live/trainer'); } catch { /* ignore */ }
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/live/trainer` } }); setBusy(''); if (error) setErr(error.message); else setSent(true);
  }
  async function setLive(s: LiveSession, status: 'live' | 'ended') { setBusy(s.id); try { const { data } = await db.auth.getSession(); const j = await fetch('/api/live', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ action: 'status', session_id: s.id, status }) }).then(x => x.json()); if (!j.success) setErr(j.error); else setRows(r => r.map(x => x.id === s.id ? { ...x, status } : x)); } catch (e: any) { setErr(String(e?.message || e)); } setBusy(''); }
  function exportIcs() { const text = icsForSessions(rows.filter(s => staff || trainerIds.includes(s.trainer_id || '')), window.location.origin, lang); const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'athar-trainer-week.ics'; document.body.appendChild(a); a.click(); a.remove(); }

  const n = now || new Date(0); const wk = useMemo(() => now ? (staff && !trainerIds.length ? { today: rows.filter(s => fmtWhen(s.starts_at, 'en', { date: true }) === fmtWhen(n.toISOString(), 'en', { date: true })), week: [] as { day: string; items: LiveSession[] }[] } : trainerWeek(rows, trainerIds, n)) : { today: [], week: [] }, [rows, trainerIds, staff, now, n]);
  const joinOf = (s: LiveSession) => hosts[s.id] || (s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : (s.join_url || ''));

  const Row = ({ s }: { s: LiveSession }) => { const st = timeState(s, n); const r = rooms.get(s.classroom_id || ''); return (
    <div className={`tr-row ${st}`}>
      <div className="tr-time"><b dir="ltr">{fmtRange(s, lang)}</b><span className={`tr-st ${st}`}>{st === 'live' && <i />}{STATE_LABEL[st][lang]}</span>{st === 'upcoming' && <small>{countdown(s.starts_at, n, lang)}</small>}</div>
      <div className="tr-body"><b>{sessionTitle(s, lang)}</b><small>{r ? classroomLabel(r, lang) : ''}{r ? ' · ' : ''}{providerLabel(s.provider, lang)} · <Icon name="check" size={12} /> {att[s.attendance_session_id || ''] || 0} {lang === 'ar' ? 'حضور' : 'present'}</small></div>
      <div className="tr-acts"><Link className={`pt-btn small ${st === 'live' ? 'gold' : 'ghost'}`} href={`/live/copilot/${s.id}`} title={lang === 'ar' ? 'الطيار المساعد الحي' : 'Live co-pilot'}><Icon name="compass" size={14} /> {lang === 'ar' ? 'الطيار' : 'Co-pilot'}</Link>{joinOf(s) && <a className={`pt-btn small ${st === 'live' || st === 'soon' ? 'gold' : 'light'}`} href={joinOf(s)} target="_blank" rel="noreferrer"><Icon name="play" size={14} /> {hosts[s.id] ? (lang === 'ar' ? 'دخول المضيف' : 'Host link') : (lang === 'ar' ? 'انضم' : 'Join')}</a>}{(st === 'soon' || st === 'upcoming') && <button type="button" className="pt-btn ghost small" disabled={busy === s.id} onClick={() => setLive(s, 'live')}>{lang === 'ar' ? 'بدء البث' : 'Go live'}</button>}{st === 'live' && <button type="button" className="pt-btn ghost small" disabled={busy === s.id} onClick={() => setLive(s, 'ended')}>{lang === 'ar' ? 'إنهاء' : 'End'}</button>}<Link href={`/live/${s.id}`} className="pt-btn ghost small">{lang === 'ar' ? 'الصفحة' : 'Page'}</Link></div>
    </div>); };

  return (
    <main className="pt-main tr">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/live">{lang === 'ar' ? 'التعلّم المباشر' : 'Live learning'}</Link> / <span>{lang === 'ar' ? 'جدول المدرب' : 'Trainer schedule'}</span></div>
        <h1>{lang === 'ar' ? 'جدول المدرب' : 'Trainer schedule'}</h1>
        <p>{user ? (lang === 'ar' ? `مرحبًا ${trainerName} — جلساتك اليوم وهذا الأسبوع عبر كل القاعات، برابط المضيف الخاص بك.` : `Welcome ${trainerName} — your sessions today and this week across all rooms, with your host link.`) : (lang === 'ar' ? 'سجّل الدخول ببريدك المسجّل كمدرب لعرض جدولك.' : 'Sign in with your trainer email to see your schedule.')}</p>
      </div></section>
      <section className="pt-sec"><div className="pt-wrap">
        {!loaded && <div className="pt-empty">…</div>}
        {loaded && !user && <div className="pt-box" style={{ maxWidth: 420 }}>{sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط الدخول إلى بريدك.' : 'Sign-in link sent.'}</div> : <form onSubmit={sendLink} className="pt-form"><label>{lang === 'ar' ? 'بريد المدرب' : 'Trainer email'}<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="pt-btn" disabled={busy === 'link'}><Icon name="mail" size={15} /> {lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link'}</button>{err && <div className="pt-alert err">{err}</div>}</form>}</div>}
        {loaded && user && !staff && trainerIds.length === 0 && <div className="pt-alert err">{lang === 'ar' ? `بريدك (${user.email}) غير مرتبط بسجل مدرب. اطلب من الإدارة إضافة بريدك في بيانات المدرب.` : `Your email (${user.email}) is not linked to a trainer record. Ask the admin to add it.`}</div>}
        {loaded && user && (staff || trainerIds.length > 0) && <>
          <div className="tr-tools"><span className="pt-tag">{lang === 'ar' ? `اليوم: ${wk.today.length} جلسة` : `Today: ${wk.today.length}`}</span>{staff && !trainerIds.length && <span className="pt-muted">{lang === 'ar' ? 'عرض إداري: كل جلسات اليوم (بريدك غير مرتبط بمدرب).' : 'Admin view: all sessions today.'}</span>}<button type="button" className="pt-btn ghost small" onClick={exportIcs} disabled={!rows.length}><Icon name="calendar" size={14} /> {lang === 'ar' ? 'تصدير الأسبوع إلى التقويم' : 'Export week (ICS)'}</button>{err && <span className="pt-alert err">{err}</span>}</div>
          <h2 className="tr-h2"><Icon name="calendar" size={16} /> {lang === 'ar' ? 'اليوم' : 'Today'} — <bdi>{fmtWhen(n.toISOString(), lang, { date: true, weekday: true })}</bdi></h2>
          {wk.today.length === 0 && <div className="pt-empty"><p>{lang === 'ar' ? 'لا جلسات لك اليوم.' : 'No sessions today.'}</p></div>}
          <div className="tr-list">{wk.today.map(s => <Row key={s.id} s={s} />)}</div>
          {wk.week.map(g => <div key={g.day}><h2 className="tr-h2"><Icon name="calendar" size={16} /> <bdi>{fmtWhen(g.items[0].starts_at, lang, { date: true, weekday: true })}</bdi> <small>{g.items.length}</small></h2><div className="tr-list">{g.items.map(s => <Row key={s.id} s={s} />)}</div></div>)}
        </>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}
const CSS = `
.tr-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.tr-h2{display:flex;gap:8px;align-items:center;font-size:17px;color:#0f2a4e;margin:18px 0 10px}.tr-h2 small{color:#64748b;font-weight:600;font-size:12.5px}
.tr-list{display:grid;gap:8px}.tr-row{display:grid;grid-template-columns:170px 1fr auto;gap:14px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 16px}.tr-row.live{border-color:#dc2626;background:#fff7f7}.tr-row.soon{border-color:#d97706}
.tr-time{display:grid;gap:3px}.tr-time b{font-size:15px;color:#0f2a4e;text-align:start}.tr-time small{color:#0b8a83;font-weight:800;font-size:12px}.tr-st{font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#475569;display:inline-flex;gap:4px;align-items:center;width:max-content}.tr-st.live{background:#fee2e2;color:#991b1b}.tr-st.live i{width:6px;height:6px;border-radius:50%;background:#dc2626}.tr-st.soon{background:#fff7ed;color:#9a3412}
.tr-body{display:grid;gap:2px;min-width:0}.tr-body b{font-size:15px;color:#0f172a}.tr-body small{color:#64748b;font-size:12.5px;display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap}
.tr-acts{display:flex;gap:6px;flex-wrap:wrap}.pt-muted{color:#64748b;font-size:13px}
@media(max-width:760px){.tr-row{grid-template-columns:1fr}}
`;
