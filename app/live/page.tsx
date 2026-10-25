'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — التعلّم المباشر: الجلسات المباشرة الآن، جدول الأيام القادمة، جلساتي (للمسجّلين)، أرشيف التسجيلات

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { UI, t } from '../../lib/portal/content';
import { KINDS, timeState, STATE_LABEL, canJoin, fmtWhen, fmtRange, countdown, groupByDay, sessionTitle, kindLabel, providerLabel, sessionAccessLabel, classroomLabel } from '../../lib/portal/live';
import type { LiveSession, TimeState, Classroom } from '../../lib/portal/live';
import { SECTORS_FALLBACK, skillName } from '../../lib/portal/skills';
import type { Skill, Sector } from '../../lib/portal/skills';

export default function LivePage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const sp = useSearchParams(); const db = useMemo(() => supabase(), []);
  const [rows, setRows] = useState<LiveSession[]>([]); const [rooms, setRooms] = useState<Map<string, Classroom>>(new Map()); const [skills, setSkills] = useState<Skill[]>([]); const [sectors, setSectors] = useState<Sector[]>(SECTORS_FALLBACK);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [mine, setMine] = useState<Set<string>>(new Set()); const [now, setNow] = useState<Date | null>(null); const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState(sp.get('kind') || ''); const [sector, setSector] = useState(sp.get('sector') || ''); const [view, setView] = useState<'upcoming' | 'mine' | 'recordings'>('upcoming');

  useEffect(() => {
    (async () => {
      try {
        const since = new Date(Date.now() - 60 * 86400000).toISOString(); // 60 يومًا للخلف لعرض التسجيلات
        const [{ data: s }, { data: sk }, { data: sec }, { data: { user: u } }] = await Promise.all([
          db.from('portal_sessions').select('*').gte('starts_at', since).neq('status', 'cancelled').order('starts_at').limit(300),
          db.from('portal_skills').select('*').eq('active', true), db.from('portal_sectors').select('*').eq('active', true).order('sort'), db.auth.getUser(),
        ]);
        const list = (s || []) as LiveSession[]; setRows(list); setSkills((sk || []) as Skill[]); if (sec && (sec as any[]).length) setSectors(sec as Sector[]);
        const ids = Array.from(new Set(list.map(x => x.classroom_id).filter(Boolean))) as string[];
        if (ids.length) { const { data: cr } = await db.from('classrooms').select('id,code,section_name,program_id').in('id', ids); setRooms(new Map(((cr || []) as Classroom[]).map(c => [c.id, c]))); }
        if (u) {
          setUser({ id: u.id, email: u.email || '' });
          const [{ data: en }, { data: rg }] = await Promise.all([db.from('portal_enrollments').select('classroom_id,program_id').eq('user_id', u.id).eq('status', 'approved'), db.from('portal_session_registrations').select('session_id').eq('user_id', u.id)]);
          const m = new Set<string>(); const cls = new Set(((en || []) as any[]).map(e => e.classroom_id).filter(Boolean)); const pr = new Set(((en || []) as any[]).map(e => e.program_id)); const rs = new Set(((rg || []) as any[]).map(r => r.session_id));
          for (const x of list) if (rs.has(x.id) || (x.classroom_id && cls.has(x.classroom_id)) || (!x.classroom_id && x.program_id && pr.has(x.program_id))) m.add(x.id);
          setMine(m); if (m.size) setView('mine');
        }
      } catch { /* يبقى فارغًا */ }
      setNow(new Date()); setLoaded(true);
    })();
    const iv = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(iv);
  }, [db]);

  const n = now || new Date(0);
  const filtered = useMemo(() => rows.filter(r => (!kind || r.kind === kind) && (!sector || r.sector === sector) && (view !== 'mine' || mine.has(r.id))), [rows, kind, sector, view, mine]);
  const live = useMemo(() => filtered.filter(r => timeState(r, n) === 'live' || timeState(r, n) === 'soon'), [filtered, n]);
  const upcoming = useMemo(() => groupByDay(filtered.filter(r => { const st = timeState(r, n); return st === 'upcoming'; })), [filtered, n]);
  const recordings = useMemo(() => rows.filter(r => r.recording_url && (view !== 'mine' || mine.has(r.id))), [rows, view, mine]);
  const byId = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);
  const secName = (c?: string | null) => { const s = sectors.find(x => x.code === c); return s ? (lang === 'en' ? s.name_en : s.name_ar) : ''; };

  const Card = ({ s, hero = false }: { s: LiveSession; hero?: boolean }) => {
    const st: TimeState = now ? timeState(s, n) : 'upcoming'; const sk = (s.skills || []).map(id => byId.get(id)).filter(Boolean) as Skill[];
    return (
      <Link href={`/live/${s.id}`} className={`lv-card ${st} ${hero ? 'hero' : ''} ${mine.has(s.id) ? 'mine' : ''}`}>
        <div className="lv-time"><b>{fmtWhen(s.starts_at, lang, { time: true })}</b><small>{fmtRange(s, lang)}</small>{now && st === 'upcoming' && <em>{countdown(s.starts_at, n, lang)}</em>}</div>
        <div className="lv-body">
          <div className="lv-tags"><span className={`lv-state ${st}`}>{st === 'live' && <i />}{t(STATE_LABEL[st], lang)}</span><span className="lv-kind">{kindLabel(s.kind, lang)}</span>{s.classroom_id && rooms.get(s.classroom_id) && <span className="lv-room">{classroomLabel(rooms.get(s.classroom_id), lang)}</span>}{mine.has(s.id) && <span className="lv-mine">{lang === 'ar' ? 'جلستي' : 'Mine'}</span>}</div>
          <h3>{sessionTitle(s, lang)}</h3>
          <div className="lv-meta">{s.speaker_name && <span><Icon name="users" size={13} /> {s.speaker_name}</span>}<span><Icon name="laptop" size={13} /> {providerLabel(s.provider, lang)}</span>{s.sector && <span><Icon name="flag" size={13} /> {secName(s.sector)}</span>}<span><Icon name="shield" size={13} /> {sessionAccessLabel(s.access, lang)}</span></div>
          {sk.length > 0 && <div className="pt-chips">{sk.slice(0, 3).map(x => <span key={x.id} className="pt-chip">{skillName(x, lang)}</span>)}</div>}
        </div>
        <div className="lv-act">{canJoin(st) ? <span className="pt-btn gold small"><Icon name="play" size={14} /> {lang === 'ar' ? 'انضم الآن' : 'Join now'}</span> : <span className="pt-btn light small">{lang === 'ar' ? 'التفاصيل' : 'Details'} <Icon name="arrow" size={13} /></span>}</div>
      </Link>
    );
  };

  return (
    <main className="pt-main lv">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/services">{t(UI.services, lang)}</Link> / <span>{lang === 'ar' ? 'التعلّم المباشر' : 'Live learning'}</span></div>
        <h1>{lang === 'ar' ? 'التعلّم المباشر والهجين' : 'Live & Hybrid Learning'}</h1>
        <p>{lang === 'ar' ? 'جلسات الشعب، الندوات العامة، وورش العمل — عبر Teams وZoom وMeet وقاعة أَثَر، مع حضور رقمي وتسجيلات لاحقة وكل جلسة موسومة بالمهارات التي تنمّيها.' : 'Class sessions, public webinars and workshops — on Teams, Zoom, Meet and Athar Room, with digital attendance, recordings and skill tagging.'}</p>
        {now && <div className="lv-kpis"><span><b>{rows.filter(r => timeState(r, n) === 'live').length}</b> {lang === 'ar' ? 'مباشر الآن' : 'live now'}</span><span><b>{rows.filter(r => timeState(r, n) === 'upcoming' || timeState(r, n) === 'soon').length}</b> {lang === 'ar' ? 'جلسة قادمة' : 'upcoming'}</span><span><b>{rows.filter(r => r.access === 'public').length}</b> {lang === 'ar' ? 'ندوة عامة' : 'public'}</span>{user && <span><b>{mine.size}</b> {lang === 'ar' ? 'جلساتي' : 'my sessions'}</span>}</div>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        <div className="lv-tools">
          <div className="lv-views">
            <button type="button" className={view === 'upcoming' ? 'on' : ''} onClick={() => setView('upcoming')}><Icon name="calendar" size={14} /> {lang === 'ar' ? 'الجدول' : 'Schedule'}</button>
            {user && <button type="button" className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}><Icon name="star" size={14} /> {lang === 'ar' ? 'جلساتي' : 'My sessions'} <small>{mine.size}</small></button>}
            <button type="button" className={view === 'recordings' ? 'on' : ''} onClick={() => setView('recordings')}><Icon name="play" size={14} /> {lang === 'ar' ? 'التسجيلات' : 'Recordings'} <small>{recordings.length}</small></button>
          </div>
          <select value={kind} onChange={e => setKind(e.target.value)}><option value="">{lang === 'ar' ? 'كل الأنواع' : 'All types'}</option>{KINDS.map(k => <option key={k.value} value={k.value}>{t(k.label, lang)}</option>)}</select>
          <select value={sector} onChange={e => setSector(e.target.value)}><option value="">{lang === 'ar' ? 'كل القطاعات' : 'All sectors'}</option>{sectors.filter(s => rows.some(r => r.sector === s.code)).map(s => <option key={s.code} value={s.code}>{lang === 'en' ? s.name_en : s.name_ar}</option>)}</select>
          {!user && <Link href="/me" className="pt-btn ghost small"><Icon name="login" size={14} /> {lang === 'ar' ? 'دخول المتدرب لعرض جلسات شعبتك' : 'Sign in to see your section sessions'}</Link>}
        </div>

        {view !== 'recordings' && <>
          {live.length > 0 && <div className="lv-live"><h2><i /> {lang === 'ar' ? 'مباشر الآن / يبدأ خلال دقائق' : 'Live now / starting in minutes'} <small>{live.length}</small></h2><div className="lv-grid">{live.map(s => <Card key={s.id} s={s} hero />)}</div></div>}
          {!loaded && <div className="pt-empty">…</div>}
          {loaded && upcoming.length === 0 && live.length === 0 && <div className="pt-empty"><Icon name="calendar" size={28} /><p>{view === 'mine' ? (lang === 'ar' ? 'لا جلسات قادمة لشعبتك حاليًا.' : 'No upcoming sessions for your section.') : (lang === 'ar' ? 'لا جلسات مجدولة حاليًا — تابعنا قريبًا.' : 'No sessions scheduled yet — check back soon.')}</p></div>}
          {upcoming.map(g => <div key={g.day} className="lv-day"><h2><Icon name="calendar" size={16} /> {fmtWhen(g.items[0].starts_at, lang, { date: true, weekday: true })} <small>{g.items.length} {lang === 'ar' ? 'جلسة' : 'sessions'}</small></h2><div className="lv-list">{g.items.map(s => <Card key={s.id} s={s} />)}</div></div>)}
        </>}
        {view === 'recordings' && <div className="lv-list">{recordings.length === 0 && <div className="pt-empty"><Icon name="play" size={28} /><p>{lang === 'ar' ? 'لا تسجيلات منشورة بعد.' : 'No recordings published yet.'}</p></div>}{recordings.map(s => <Link key={s.id} href={`/live/${s.id}`} className="lv-card ended"><div className="lv-time"><b>{fmtWhen(s.starts_at, lang, { date: true })}</b></div><div className="lv-body"><div className="lv-tags"><span className="lv-kind">{kindLabel(s.kind, lang)}</span>{s.recording_url && <span className="lv-rec"><Icon name="play" size={12} /> {lang === 'ar' ? 'تسجيل متاح' : 'Recording'}</span>}</div><h3>{sessionTitle(s, lang)}</h3></div><div className="lv-act"><span className="pt-btn light small">{lang === 'ar' ? 'مشاهدة' : 'Watch'}</span></div></Link>)}</div>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.lv-kpis{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;font-size:13.5px;color:rgba(255,255,255,.85)}.lv-kpis b{font-size:20px;color:#fff;margin-inline-end:4px}
.lv-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:20px}.lv-views{display:flex;gap:6px;flex-wrap:wrap}.lv-views button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-weight:800;font-size:13px;color:#334155;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.lv-views button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.lv-views small{background:rgba(0,0,0,.08);border-radius:999px;padding:1px 7px;font-size:11px}
.lv-tools select{border:1px solid #e2e8f0;border-radius:12px;padding:9px 12px;font:inherit;font-size:13.5px;background:#fff}
.lv-live{margin-bottom:26px}.lv-live h2,.lv-day h2{display:flex;align-items:center;gap:8px;font-size:17px;color:#0f2a4e;margin:0 0 10px}.lv-live h2 i{width:10px;height:10px;border-radius:50%;background:#dc2626;box-shadow:0 0 0 4px rgba(220,38,38,.2);animation:lvp 1.4s infinite}.lv-live h2 small,.lv-day h2 small{color:#64748b;font-weight:600;font-size:12.5px}
@keyframes lvp{0%{box-shadow:0 0 0 0 rgba(220,38,38,.4)}70%{box-shadow:0 0 0 8px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}
.lv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.lv-list{display:grid;gap:10px}.lv-day{margin-bottom:22px}
.lv-card{display:grid;grid-template-columns:150px 1fr auto;gap:16px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;text-decoration:none;color:inherit;transition:box-shadow .15s}.lv-card:hover{box-shadow:0 10px 26px rgba(15,42,78,.1)}.lv-card.live{border-color:#dc2626;background:#fff7f7}.lv-card.soon{border-color:#d97706;background:#fffbf3}.lv-card.hero{grid-template-columns:130px 1fr auto}.lv-card.mine{border-inline-start:4px solid #0b8a83}
.lv-time{display:grid;gap:2px;border-inline-end:1px dashed #e2e8f0;padding-inline-end:12px}.lv-time b{font-size:20px;color:#0f2a4e;direction:ltr;text-align:start}.lv-time small{color:#64748b;font-size:12px;direction:ltr;text-align:start}.lv-time em{font-style:normal;color:#0b8a83;font-size:12px;font-weight:800}
.lv-body{display:grid;gap:6px;min-width:0}.lv-body h3{margin:0;font-size:16px;color:#0f172a;line-height:1.5}.lv-tags{display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px;font-weight:900}.lv-tags span{border-radius:999px;padding:3px 9px;background:#f1f5f9;color:#334155;display:inline-flex;align-items:center;gap:5px}.lv-state.live{background:#fee2e2;color:#991b1b}.lv-state.live i{width:7px;height:7px;border-radius:50%;background:#dc2626}.lv-state.soon{background:#fff7ed;color:#9a3412}.lv-state.ended{background:#e2e8f0;color:#475569}.lv-kind{background:#eef4fb!important;color:#0f2a4e!important}.lv-room{background:#e6f4f3!important;color:#0b8a83!important}.lv-mine{background:#0b8a83!important;color:#fff!important}.lv-rec{background:#fdf6e3!important;color:#9a7417!important}
.lv-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:#64748b}.lv-meta span{display:inline-flex;align-items:center;gap:4px}
.lv-act{display:flex;align-items:center}
@media(max-width:900px){.lv-grid{grid-template-columns:1fr}.lv-card,.lv-card.hero{grid-template-columns:1fr}.lv-time{border-inline-end:0;border-bottom:1px dashed #e2e8f0;padding:0 0 8px;grid-template-columns:auto auto auto;gap:10px;align-items:baseline}}
`;
