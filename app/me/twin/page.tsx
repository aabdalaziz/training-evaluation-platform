'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — توأمي المهاري (P11): كوكبة المهارات عبر الزمن (الماضي ← الآن ← +سنة)، الطزاجة والصدأ، «أين سأكون بعد 90 يومًا؟»،
// ماذا لو أخذت هذا البرنامج، أرخص مسار إلى مستوى مستهدف، شهاداتي الحية، وحقوقي في توأمي (تصدير/محو). حساب نقيّ في المتصفح — بلا نموذج لغوي.

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { t, fmtDate } from '../../../lib/portal/content';
import { DOMAINS, domainLabel, skillName } from '../../../lib/portal/skills';
import type { Skill } from '../../../lib/portal/skills';
import { levelName, EVIDENCE_LABEL, credentialTitle } from '../../../lib/portal/profile';
import { twinSkill, projectSkill, levelAt, levelAtPast, freshnessAfter, constellation, cheapestPath, statusLabel, STATUS_LABEL, rustSentence, pulseOf, fmtLevel, RUST_THRESHOLD, FADE_THRESHOLD } from '../../../lib/portal/twin';
import type { TwinSkill, PlannedActivity, PathOption, TwinStatus } from '../../../lib/portal/twin';

export default function TwinPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
const RESUME_KEY = 'athar_resume';
type Bundle = { user: { id: string; name: string; email: string }; levels: any[]; skills: Skill[]; credentials: any[]; programs: any[]; scenarios: any[]; sessions: any[] };
const DOMAIN_COLOR: Record<string, string> = { arabic: '#0b8a83', pedagogy: '#3b82f6', leadership: '#c9a24b', quality: '#10b981', data_ai: '#8b5cf6', digital: '#38bdf8', research: '#f59e0b', wellbeing: '#f43f5e' };
const MARKS = [-365, -180, -90, 0, 90, 180, 365];

function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []); const ar = lang === 'ar';
  const [loaded, setLoaded] = useState(false); const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [b, setB] = useState<Bundle | null>(null);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [day, setDay] = useState(0); const [sel, setSel] = useState<string | null>(null); const [plan, setPlan] = useState<PlannedActivity[]>([]);
  const [target, setTarget] = useState(0); const [weeks, setWeeks] = useState(8); const [confirm, setConfirm] = useState('');
  const now = useMemo(() => new Date(), []);

  async function token() { const { data } = await db.auth.getSession(); return data.session?.access_token || ''; }
  async function load() { const tk = await token(); const j = await fetch('/api/twin', { headers: { Authorization: `Bearer ${tk}` } }).then(x => x.json()); if (!j.success) { setErr(j.error || 'خطأ'); return; } setB(j); }
  useEffect(() => { (async () => { try { const { data: { user: u } } = await db.auth.getUser(); if (u) { setUser({ id: u.id, email: u.email || '' }); try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } await load(); } } catch { /* ignore */ } setLoaded(true); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function sendLink(e: React.FormEvent) { e.preventDefault(); setErr(''); const em = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(ar ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; } setBusy('link'); try { localStorage.setItem(RESUME_KEY, '/me/twin'); } catch { /* ignore */ } const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/me/twin` } }); setBusy(''); if (error) setErr(error.message); else setSent(true); }
  async function post(body: any) { const tk = await token(); return fetch('/api/twin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify(body) }).then(x => x.json()); }

  // ---------- التوأم
  const skills = useMemo(() => new Map<string, Skill>((b?.skills || []).map((s: Skill) => [s.id, s])), [b]);
  const twins = useMemo(() => (b?.levels || []).map(l => twinSkill({ skill_id: l.skill_id, computed_level: Number(l.computed_level) || 0, approved_level: l.approved_level, confidence: Number(l.confidence) || 0, evidence: l.evidence || [] }, now)).filter(tw => skills.has(tw.skill_id)), [b, skills, now]);
  const evidenceOf = (sid: string) => (b?.levels || []).find(l => l.skill_id === sid)?.evidence || [];
  useEffect(() => { if (!sel && twins.length) setSel([...twins].sort((x, y) => (x.rust_in_days ?? 9999) - (y.rust_in_days ?? 9999))[0].skill_id); }, [twins, sel]);
  const cur = twins.find(x => x.skill_id === sel) || null; const curSkill = cur ? skills.get(cur.skill_id) : null;
  useEffect(() => { if (cur) setTarget(Math.min(5, Math.max(Math.ceil(cur.level_now + 0.01), Math.round(cur.level_now) + 1))); }, [cur?.skill_id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** حالة كل نجمة في اليوم المختار (ماضٍ: إعادة بناء من الأدلة · مستقبل: إسقاط مع الخطة) */
  const atDay = useMemo(() => twins.map(tw => {
    if (day < 0) { const at = new Date(now.getTime() + day * 86400000); const ev = evidenceOf(tw.skill_id); const lv = levelAtPast(ev, at); const prior = ev.filter((e: any) => new Date(e.at).getTime() <= at.getTime()).map((e: any) => e.at).sort(); const last = prior[prior.length - 1]; const fr = last ? freshnessAfter((at.getTime() - new Date(last).getTime()) / 86400000, tw.half_life) : 0; return { tw, level: lv, freshness: fr, born: lv !== null }; }
    const p = day === 0 ? { level: tw.level_now, freshness: tw.freshness } : levelAt(tw, day, plan); return { tw, level: p.level, freshness: p.freshness, born: true };
  }), [twins, day, plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const stars = useMemo(() => constellation(atDay.filter(x => x.born).map(x => ({ skill_id: x.tw.skill_id, domain: skills.get(x.tw.skill_id)?.domain || 'pedagogy', level: x.level || 1, confidence: x.tw.confidence, freshness: x.freshness })), DOMAINS.map(d => d.value), 520), [atDay, skills]);
  const counts = useMemo(() => { const c: Record<TwinStatus, number> = { bright: 0, fading: 0, rusty: 0, dormant: 0 }; for (const x of atDay) { if (!x.born) continue; const st: TwinStatus = x.freshness >= FADE_THRESHOLD ? 'bright' : x.freshness >= RUST_THRESHOLD ? 'fading' : x.tw.last_at ? 'rusty' : 'dormant'; c[st]++; } return c; }, [atDay, day]);
  const pulse = pulseOf(atDay.filter(x => x.born));
  const alerts = useMemo(() => twins.filter(x => x.last_at && (x.status === 'rusty' || (x.rust_in_days ?? 999) <= 21)).sort((x, y) => (x.rust_in_days ?? 0) - (y.rust_in_days ?? 0)).slice(0, 4), [twins]);

  // ---------- ماذا لو · أرخص مسار
  const options: PathOption[] = useMemo(() => {
    if (!b) return []; const out: PathOption[] = [];
    for (const p of b.programs) { const sd = p.start_date ? Math.max(0, Math.round((new Date(p.start_date).getTime() - now.getTime()) / 86400000)) : 0; const dur = p.start_date && p.end_date ? Math.max(7, Math.round((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / 86400000)) : 30; out.push({ id: `program:${p.id}`, kind: 'program', label: (lang === 'en' && p.name_en) || p.name_ar, skills: p.skills.map((s: any) => s.skill_id), hours: Number(p.hours) || 20, cost: Number(p.fee) || 0, start_day: sd, duration_days: dur, href: `/programs/${p.id}` }); }
    for (const s of b.scenarios) out.push({ id: `sim:${s.id}`, kind: 'simulation', label: (lang === 'en' && s.title_en) || s.title_ar, skills: s.skills, hours: Math.max(0.25, (Number(s.minutes) || 5) / 60), cost: 0, href: `/sim/${s.slug}` });
    for (const s of b.sessions) out.push({ id: `session:${s.id}`, kind: 'session', label: (lang === 'en' && s.title_en) || s.title_ar, skills: s.skills, hours: 1, cost: 0, start_day: Math.max(0, Math.round((new Date(s.starts_at).getTime() - now.getTime()) / 86400000)), href: `/live/${s.id}` });
    out.push({ id: 'daily', kind: 'daily', label: ar ? 'تحدّي «كل يوم مهارة»' : 'Daily skill challenge', skills: Array.from(skills.keys()), hours: 0.08, cost: 0, href: '/#daily' });
    return out;
  }, [b, skills, lang, now, ar]);
  const whatIf = cur ? options.filter(o => o.kind !== 'daily' && o.skills.includes(cur.skill_id)).slice(0, 8) : [];
  const inPlan = (o: PathOption) => plan.some(a => a.label === o.id);
  const toggle = (o: PathOption) => setPlan(p => inPlan(o) ? p.filter(a => a.label !== o.id) : [...p, { kind: o.kind, day: o.kind === 'program' ? (o.start_day || 0) + (o.duration_days || 30) : Math.max(3, o.start_day || 7), skills: o.skills, label: o.id, weight: 1 }]);
  const p90 = cur ? levelAt(cur, 90) : null; const p90plan = cur ? levelAt(cur, 90, plan) : null; const curve = cur ? projectSkill(cur, 180, plan) : [];
  const path = cur ? cheapestPath(cur, target, weeks, options) : null;

  // ---------- الحقوق والشهادات
  async function exportTwin() { setBusy('export'); setErr(''); try { const j = await post({ action: 'export' }); if (!j.success) throw new Error(j.error); const blob = new Blob([JSON.stringify(j.twin, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `athar-twin-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setOk(ar ? 'صُدّر توأمك (JSON).' : 'Twin exported.'); } catch (e: any) { setErr(String(e?.message || e)); } setBusy(''); }
  async function forget() { setBusy('forget'); setErr(''); try { const j = await post({ action: 'forget', confirm }); if (!j.success) throw new Error(j.error); setOk(ar ? `مُحي توأمك: ${j.events} حدثًا و${j.levels} مهارة.` : `Twin erased: ${j.events} events, ${j.levels} skills.`); setConfirm(''); setSel(null); await load(); } catch (e: any) { setErr(String(e?.message || e)); } setBusy(''); }
  async function toggleLive(c: any) { setBusy(`live:${c.id}`); try { const j = await post({ action: 'live', credential_id: c.id, enabled: !c.live }); if (!j.success) throw new Error(j.error); setB(x => x ? { ...x, credentials: x.credentials.map(k => k.id === c.id ? { ...k, live: !c.live } : k) } : x); } catch (e: any) { setErr(String(e?.message || e)); } setBusy(''); }

  const dayLabel = (d: number) => d === 0 ? (ar ? 'الآن' : 'Now') : d > 0 ? (ar ? `بعد ${d} يومًا` : `+${d} days`) : (ar ? `قبل ${-d} يومًا` : `${d} days`);
  const kindLabel = (k: string) => ({ program: ar ? 'برنامج' : 'program', simulation: ar ? 'محاكاة' : 'simulation', session: ar ? 'جلسة' : 'session', daily: ar ? 'يومي' : 'daily', activity: ar ? 'نشاط' : 'activity' } as any)[k] || k;

  return (
    <main className="pt-main tw">
      <section className="pt-pagehead tw-head"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> / <Link href="/me">{ar ? 'بوابة المتدرب' : 'Student portal'}</Link> / <span>{ar ? 'توأمي المهاري' : 'My skills twin'}</span></div>
        <h1>{ar ? 'توأمي المهاري' : 'My Skills Digital Twin'}</h1>
        <p>{ar ? 'ملفك المهاري كان صورة ثابتة؛ التوأم نموذج حيّ: يعرف متى تصدأ كل مهارة إن توقفت، وأين ستكون بعد 90 يومًا، وما أرخص مسار إلى المستوى الذي تريده. حساب شفاف من أدلتك الحقيقية — بلا نموذج لغوي، وبياناتك ملكك: تصدّرها أو تمحوها متى شئت.' : 'Your profile was a snapshot; the twin is a living model: when each skill rusts if you stop, where you will be in 90 days, and the cheapest path to the level you want. Transparent math over your real evidence — no language model — and the data is yours to export or erase.'}</p>
        {user && twins.length > 0 && <div className="tw-kpis"><span><b>{pulse}%</b> {ar ? 'نبض التوأم' : 'twin pulse'}</span><span className="bright"><b>{counts.bright}</b> {ar ? 'متوهّجة' : 'bright'}</span><span className="fading"><b>{counts.fading}</b> {ar ? 'تخفت' : 'fading'}</span><span className="rusty"><b>{counts.rusty}</b> {ar ? 'صدئة' : 'rusty'}</span><span><b>{twins.filter(x => x.approved).length}</b> {ar ? 'معتمدة' : 'approved'}</span></div>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        {!loaded && <div className="pt-empty">…</div>}
        {loaded && !user && <div className="pt-box" style={{ maxWidth: 440 }}><h3><Icon name="login" size={18} /> {ar ? 'ادخل ببريدك لرؤية توأمك' : 'Sign in to meet your twin'}</h3>{sent ? <div className="pt-alert ok">{ar ? 'أرسلنا رابط الدخول إلى بريدك.' : 'Sign-in link sent.'}</div> : <form onSubmit={sendLink} className="pt-form"><label>{ar ? 'بريدك الإلكتروني' : 'Your email'}<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="pt-btn" disabled={busy === 'link'}><Icon name="mail" size={15} /> {ar ? 'أرسل رابط الدخول' : 'Send sign-in link'}</button>{err && <div className="pt-alert err">{err}</div>}</form>}</div>}
        {loaded && user && b && twins.length === 0 && <div className="pt-box pt-empty tw-empty"><Icon name="star" size={30} /><h3>{ar ? 'توأمك لم يولد بعد' : 'Your twin is not born yet'}</h3><p>{ar ? 'يولد التوأم من أول دليل: تحدّي اليوم على الصفحة الرئيسية (دقيقة واحدة)، أو محاكاة أداء، أو اختبار مِعيار، أو حضور جلسة.' : 'The twin is born from your first evidence: today’s challenge on the homepage, a performance simulation, the Mi‘yar test, or a session.'}</p><div className="pt-chips"><Link href="/#daily" className="pt-btn small">{ar ? 'تحدّي اليوم' : 'Today’s challenge'}</Link><Link href="/sim" className="pt-btn light small">{ar ? 'المحاكيات' : 'Simulators'}</Link><Link href="/programs" className="pt-btn ghost small">{ar ? 'البرامج' : 'Programs'}</Link></div></div>}

        {loaded && user && b && twins.length > 0 && <>
          {alerts.length > 0 && <div className="tw-alerts">{alerts.map(x => <button key={x.skill_id} type="button" className={`tw-alert ${x.status}`} onClick={() => { setSel(x.skill_id); setDay(0); }}><Icon name="bell" size={14} /> {rustSentence(x, skillName(skills.get(x.skill_id)!, lang), lang)}</button>)}</div>}
          <div className="tw-grid">
            <div className="pt-box tw-sky">
              <div className="tw-skyhead"><h3><Icon name="star" size={18} /> {ar ? 'كوكبة مهاراتي' : 'My skills constellation'}</h3><span className="tw-day">{dayLabel(day)} · <bdi>{fmtDate(new Date(now.getTime() + day * 86400000).toISOString(), lang)}</bdi></span></div>
              <svg viewBox="0 0 520 520" className="tw-svg" role="img" aria-label={ar ? 'كوكبة المهارات' : 'Skills constellation'}>
                <defs><radialGradient id="twbg" cx="50%" cy="50%" r="60%"><stop offset="0" stopColor="#15396b" /><stop offset="1" stopColor="#081a33" /></radialGradient><filter id="twglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
                <rect width="520" height="520" rx="22" fill="url(#twbg)" />
                {[0, 1, 2, 3, 4].map(r => <circle key={r} cx="260" cy="260" r={520 * (0.12 + 0.075 * r)} fill="none" stroke="rgba(255,255,255,.08)" strokeDasharray={r === 0 ? '0' : '3 5'} />)}
                {[5, 4, 3, 2, 1].map((lv, i) => <text key={lv} x="262" y={260 - 520 * (0.12 + 0.075 * i) + 4} fontSize="9" fill="rgba(255,255,255,.35)">{lv}</text>)}
                {DOMAINS.map((d, i) => { const a = (i + 0.5) * (2 * Math.PI / DOMAINS.length) - Math.PI / 2; const x = 260 + 236 * Math.cos(a), y = 260 + 236 * Math.sin(a); return <text key={d.value} x={x} y={y} fontSize="10.5" fontWeight="800" fill={DOMAIN_COLOR[d.value]} textAnchor="middle" opacity=".9">{t(d.label, lang)}</text>; })}
                {stars.map(st => { const x = atDay.find(a => a.tw.skill_id === st.skill_id)!; const sk = skills.get(st.skill_id)!; const col = DOMAIN_COLOR[sk.domain] || '#fff'; const rusty = x.freshness < RUST_THRESHOLD; const on = sel === st.skill_id; return (
                  <g key={st.skill_id} className={`tw-star ${on ? 'on' : ''}`} transform={`translate(${st.x} ${st.y})`} onClick={() => setSel(st.skill_id)} style={{ cursor: 'pointer' }}>
                    {on && <circle r={st.r + 10} fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 3" className="tw-ring" />}
                    <circle r={st.r + 4} fill={rusty ? '#b45309' : col} opacity={0.18} />
                    <circle r={st.r} fill={rusty ? '#b45309' : col} opacity={st.opacity} filter="url(#twglow)" stroke={x.tw.approved ? '#fff' : 'none'} strokeWidth="1.5" />
                    <text y={st.r + 13} fontSize="9.5" fill="rgba(255,255,255,.85)" textAnchor="middle">{skillName(sk, lang).slice(0, 18)}</text>
                  </g>); })}
              </svg>
              <div className="tw-time"><input type="range" min={-365} max={365} step={15} value={day} onChange={e => setDay(Number(e.target.value))} aria-label={ar ? 'الخط الزمني' : 'Timeline'} /><div className="tw-marks">{MARKS.map(m => <button key={m} type="button" className={day === m ? 'on' : ''} onClick={() => setDay(m)}>{m === 0 ? (ar ? 'الآن' : 'Now') : m > 0 ? `+${m}` : m}</button>)}</div></div>
              <div className="tw-legend"><span><i style={{ background: '#fff' }} /> {ar ? 'الحجم = قوة الأدلة · الإضاءة = الطزاجة · الحلقة البيضاء = معتمدة' : 'Size = evidence · glow = freshness · white ring = approved'}</span><span><i style={{ background: '#b45309' }} /> {ar ? 'نحاسية = صدئة' : 'copper = rusty'}</span></div>
            </div>

            <aside className="tw-side">
              {cur && curSkill && <div className="pt-box tw-focus">
                <small className="tw-dom" style={{ color: DOMAIN_COLOR[curSkill.domain] }}>{domainLabel(curSkill.domain, lang)} · <span dir="ltr">{curSkill.code}</span></small>
                <h3>{skillName(curSkill, lang)}</h3>
                <div className="tw-now"><div className="tw-big"><b>{fmtLevel(cur.level_now)}</b><small>/5 · {levelName(cur.level_now, lang)}{cur.approved && <em> ✓ {ar ? 'معتمد' : 'approved'}</em>}</small></div>
                  <div className="tw-fresh" style={{ ['--p' as any]: cur.freshness, ['--c' as any]: STATUS_LABEL[cur.status].color }}><b>{cur.freshness}%</b><small>{statusLabel(cur.status, lang)}</small></div></div>
                <p className="tw-rust">{rustSentence(cur, skillName(curSkill, lang), lang)}</p>
                <div className="tw-facts"><span><b>{cur.half_life}</b> {ar ? 'يوم عمر النصف' : 'd half-life'}</span><span><b>{cur.velocity > 0 ? '▲' : cur.velocity < 0 ? '▼' : '●'} {Math.abs(cur.velocity).toFixed(2)}</b> {ar ? '/30 يومًا' : '/30 days'}</span><span><b>{cur.evidence_count}</b> {ar ? 'دليل' : 'evidence'}</span>{cur.last_at && <span><b><bdi>{fmtDate(cur.last_at, lang)}</bdi></b> {ar ? 'آخر دليل' : 'last'}</span>}</div>
                <div className="tw-kinds">{Object.entries(cur.kinds).map(([k, n]) => <span key={k}>{t((EVIDENCE_LABEL as any)[k] || { ar: k, en: k }, lang)} ×{n}</span>)}</div>

                <h4>{ar ? 'أين سأكون بعد 90 يومًا؟' : 'Where will I be in 90 days?'}</h4>
                <div className="tw-proj"><div><small>{ar ? 'إن توقفت' : 'If I stop'}</small><b>{p90 ? fmtLevel(p90.level) : '—'}</b><i>{p90 ? `${fmtLevel(p90.lo)}–${fmtLevel(p90.hi)}` : ''}</i></div><div className={plan.length ? 'on' : ''}><small>{ar ? 'مع خطتي' : 'With my plan'}</small><b>{p90plan ? fmtLevel(p90plan.level) : '—'}</b><i>{plan.length ? `${plan.length} ${ar ? 'نشاط' : 'activities'}` : (ar ? 'اختر أنشطة ↓' : 'pick below ↓')}</i></div></div>
                <svg viewBox="0 0 300 90" className="tw-curve" aria-hidden>{(() => { const X = (d: number) => 10 + (d / 180) * 280; const Y = (l: number) => 80 - ((l - 1) / 4) * 70; const base = projectSkill(cur, 180, []); return <>
                  {[1, 2, 3, 4, 5].map(l => <line key={l} x1="10" x2="290" y1={Y(l)} y2={Y(l)} stroke="#e2e8f0" />)}
                  <path d={`M${curve.map(p => `${X(p.day)},${Y(p.hi)}`).join(' L')} L${[...curve].reverse().map(p => `${X(p.day)},${Y(p.lo)}`).join(' L')} Z`} fill="rgba(11,138,131,.12)" />
                  <path d={`M${base.map(p => `${X(p.day)},${Y(p.level)}`).join(' L')}`} fill="none" stroke="#b45309" strokeWidth="1.5" strokeDasharray="4 3" />
                  <path d={`M${curve.map(p => `${X(p.day)},${Y(p.level)}`).join(' L')}`} fill="none" stroke="#0b8a83" strokeWidth="2.5" />
                  {plan.filter(a => a.skills.includes(cur.skill_id) && a.day <= 180).map((a, i) => <circle key={i} cx={X(a.day)} cy={Y(curve.find(p => p.day === a.day)?.level || cur.level_now)} r="4" fill="#c9a24b" />)}
                  <text x="10" y="10" fontSize="8" fill="#64748b">{ar ? 'الآن' : 'now'}</text><text x="282" y="10" fontSize="8" fill="#64748b" textAnchor="end">+180</text>
                </>; })()}</svg>

                {whatIf.length > 0 && <><h4>{ar ? 'ماذا لو…' : 'What if…'}</h4><div className="tw-whatif">{whatIf.map(o => <button key={o.id} type="button" className={`tw-opt ${inPlan(o) ? 'on' : ''}`} onClick={() => toggle(o)}><span className={`tw-k ${o.kind}`}>{kindLabel(o.kind)}</span><b>{o.label}</b><small>{o.kind === 'program' ? (ar ? `يبدأ بعد ${o.start_day} يومًا · ${o.hours} س` : `starts in ${o.start_day}d · ${o.hours}h`) : o.kind === 'session' ? (ar ? `بعد ${o.start_day} يومًا` : `in ${o.start_day}d`) : (ar ? `${Math.round(o.hours * 60)} دقيقة` : `${Math.round(o.hours * 60)} min`)}</small><i>{inPlan(o) ? '✓' : '+'}</i></button>)}</div></>}

                <h4>{ar ? 'أرخص مسار إلى…' : 'Cheapest path to…'}</h4>
                <div className="tw-pathform"><label>{ar ? 'المستوى' : 'Level'}<select value={target} onChange={e => setTarget(Number(e.target.value))}>{[2, 3, 4, 5].filter(n => n > cur.level_now).map(n => <option key={n} value={n}>{n} · {levelName(n, lang)}</option>)}</select></label><label>{ar ? 'خلال' : 'Within'}<select value={weeks} onChange={e => setWeeks(Number(e.target.value))}>{[4, 6, 8, 12, 16].map(w => <option key={w} value={w}>{w} {ar ? 'أسبوعًا' : 'weeks'}</option>)}</select></label></div>
                {path && <div className={`tw-path ${path.reachable ? 'ok' : 'no'}`}><p>{path.note_ar}</p>{path.steps.length > 0 && <ol>{path.steps.filter((s, i, a) => s.option.kind !== 'daily' || a.findIndex(x => x.option.id === 'daily') === i).map((s, i) => <li key={i}><span className={`tw-k ${s.option.kind}`}>{kindLabel(s.option.kind)}</span>{s.option.href ? <Link href={s.option.href}>{s.option.label}</Link> : s.option.label}<small>{s.option.kind === 'daily' ? (ar ? '5 أيام أسبوعيًا' : '5 days/week') : (ar ? `الأسبوع ${Math.floor(s.day / 7) + 1}` : `week ${Math.floor(s.day / 7) + 1}`)} → {fmtLevel(s.option.kind === 'daily' ? (path.steps.filter(x => x.option.kind === 'daily').slice(-1)[0]?.level_after ?? s.level_after) : s.level_after)}</small></li>)}</ol>}<small>{ar ? `≈ ${path.hours} ساعة${path.cost ? ` · ${path.cost} ر.س` : ' · بلا رسوم'}` : `≈ ${path.hours} h${path.cost ? ` · SAR ${path.cost}` : ' · free'}`}</small></div>}
              </div>}

              <div className="pt-box tw-list"><h3><Icon name="target" size={16} /> {ar ? 'كل المهارات' : 'All skills'}</h3>{[...twins].sort((x, y) => y.level_now - x.level_now).map(x => { const s = skills.get(x.skill_id)!; return <button key={x.skill_id} type="button" className={`tw-row ${sel === x.skill_id ? 'on' : ''}`} onClick={() => setSel(x.skill_id)}><i style={{ background: STATUS_LABEL[x.status].color }} /><b>{skillName(s, lang)}</b><span>{fmtLevel(x.level_now)}</span><small>{x.freshness}%</small></button>; })}</div>
            </aside>
          </div>

          <div className="tw-bottom">
            {b.credentials.length > 0 && <div className="pt-box"><h3><Icon name="award" size={18} /> {ar ? 'شهاداتي الحية' : 'My living credentials'}</h3><p className="pt-muted">{ar ? 'الشهادة في أَثَر ليست PDF: عنوان دائم يعرض مستواك الحالي وطزاجة مهاراتك وسلسلة أدلتك، ويمكن لجهة عملك الاشتراك فيه. أنت تتحكم: أوقف «الحية» لتعود شهادة تقليدية.' : 'Credentials here are not PDFs: a permanent address showing your current level, freshness and evidence chain. Employers can subscribe. You control it.'}</p>
              <div className="tw-creds">{b.credentials.map(c => <div key={c.id} className={`tw-cred ${c.revoked_at ? 'off' : ''}`}><div><b>{credentialTitle(c, lang)}</b><small><span dir="ltr">{c.verify_code}</span> · <bdi>{fmtDate(c.issued_at, lang)}</bdi></small></div><div className="pt-chips"><label className={`tw-switch ${c.live ? 'on' : ''}`}><input type="checkbox" checked={!!c.live} disabled={busy === `live:${c.id}` || !!c.revoked_at} onChange={() => toggleLive(c)} /><span /> {ar ? 'حية' : 'Live'}</label><Link href={`/credential/${c.verify_code}`} target="_blank" className="pt-btn light small"><Icon name="globe" size={13} /> {ar ? 'فتح' : 'Open'}</Link></div></div>)}</div></div>}
            <div className="pt-box tw-rights"><h3><Icon name="shield" size={18} /> {ar ? 'حقوقي في توأمي' : 'My rights over my twin'}</h3><p className="pt-muted">{ar ? 'توأمك ملكك: صدّره بصيغة JSON مفتوحة لتنقله أينما شئت، أو امحُ أحداث تعلّمك ومستويات مهاراتك وذاكرة أثير نهائيًا (الشهادات الصادرة تبقى لأنها وثائق رسمية).' : 'Your twin is yours: export it as open JSON, or permanently erase your learning events, skill levels and Athir memory (issued credentials remain as official documents).'}</p>
              <div className="tw-rightsrow"><button type="button" className="pt-btn light small" disabled={busy === 'export'} onClick={exportTwin}><Icon name="download" size={13} /> {ar ? 'تصدير توأمي (JSON)' : 'Export my twin (JSON)'}</button><div className="tw-forget"><input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={ar ? 'اكتب: امحُ توأمي' : 'Type: امحُ توأمي'} /><button type="button" className="pt-btn ghost small danger" disabled={busy === 'forget' || confirm.trim() !== 'امحُ توأمي'} onClick={forget}><Icon name="trash" size={13} /> {ar ? 'محو نهائي' : 'Erase'}</button></div></div>
              {ok && <div className="pt-alert ok">{ok}</div>}{err && <div className="pt-alert err">{err}</div>}
              <small className="pt-muted">{ar ? 'المنهجية: منحنى نسيان إبنجهاوس مُعدَّل بعمر نصف يطول مع تكرار الممارسة وتباعدها والاعتماد البشري؛ الإهمال لا يُفقد أكثر من مستوى ونصف (الذاكرة طويلة المدى)؛ مكاسب الأنشطة من أوزان الأدلة نفسها (P8) مع إشباع عند المستويات العليا. أرقام إرشادية شفافة، والمستوى المعتمد يبقى قرارًا بشريًا.' : 'Method: a modified Ebbinghaus curve whose half-life grows with repeated, spaced practice and human approval; neglect never costs more than 1.5 levels; activity gains reuse the P8 evidence weights with saturation. Indicative, transparent numbers — approved levels remain a human decision.'}</small></div>
          </div>
        </>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.tw-head{background:radial-gradient(1200px 500px at 70% -20%,#1d4a85 0,#0f2a4e 55%,#081a33 100%)}
.tw-kpis{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;font-size:13.5px;color:rgba(255,255,255,.85);align-items:center}.tw-kpis b{font-size:20px;color:#fff;margin-inline-end:4px}.tw-kpis .bright b{color:#5eead4}.tw-kpis .fading b{color:#fde68a}.tw-kpis .rusty b{color:#fdba74}
.tw-alerts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.tw-alert{border:1px solid #fcd9b6;background:#fff7ed;color:#9a3412;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;display:inline-flex;gap:6px;align-items:center;cursor:pointer}.tw-alert.rusty{background:#7c2d12;color:#fff;border-color:#7c2d12}
.tw-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:16px;align-items:start}
.tw-sky{padding:14px}.tw-skyhead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}.tw-skyhead h3{margin:0;display:flex;gap:8px;align-items:center}.tw-day{font-size:12.5px;color:#0b8a83;font-weight:800}
.tw-svg{width:100%;height:auto;display:block;border-radius:22px}.tw-star circle,.tw-star{transition:transform .9s cubic-bezier(.2,.8,.2,1),opacity .9s,r .6s}.tw-star text{pointer-events:none}.tw-ring{animation:twspin 12s linear infinite;transform-origin:center}@keyframes twspin{to{stroke-dashoffset:-70}}
.tw-time{margin-top:10px}.tw-time input{width:100%;accent-color:#0b8a83}.tw-marks{display:flex;justify-content:space-between;margin-top:4px}.tw-marks button{border:0;background:transparent;font:inherit;font-size:11.5px;color:#64748b;cursor:pointer;padding:2px 6px;border-radius:6px}.tw-marks button.on{background:#0f2a4e;color:#fff}
.tw-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:11.5px;color:#64748b}.tw-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-inline-end:4px;vertical-align:middle}
.tw-side{display:grid;gap:14px}.tw-focus h3{margin:2px 0 10px;font-size:20px;color:#0f2a4e}.tw-focus h4{margin:16px 0 6px;font-size:13.5px;color:#0b8a83}.tw-dom{font-weight:800;font-size:12px}
.tw-now{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.tw-big b{font-size:40px;line-height:1;color:#0f2a4e;font-weight:900}.tw-big small{display:block;color:#64748b;font-size:12.5px;margin-top:4px}.tw-big em{color:#065f46;font-style:normal;font-weight:900}
.tw-fresh{width:84px;height:84px;border-radius:50%;display:grid;place-content:center;text-align:center;background:conic-gradient(var(--c) calc(var(--p)*1%),#e2e8f0 0);position:relative}.tw-fresh::before{content:'';position:absolute;inset:7px;border-radius:50%;background:#fff}.tw-fresh b,.tw-fresh small{position:relative}.tw-fresh b{font-size:16px;color:#0f172a}.tw-fresh small{font-size:10.5px;color:#64748b;display:block}
.tw-rust{margin:10px 0 6px;font-size:13.5px;color:#334155;line-height:1.8;border-inline-start:3px solid #c9a24b;padding-inline-start:10px}
.tw-facts{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:#64748b}.tw-facts b{color:#0f172a;font-size:13px;display:block}.tw-kinds{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.tw-kinds span{font-size:11px;background:#f1f5f9;border-radius:999px;padding:2px 8px;color:#334155}
.tw-proj{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tw-proj div{border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#f8fafc}.tw-proj div.on{border-color:#0b8a83;background:#f0fdfa}.tw-proj small{display:block;font-size:11px;color:#64748b}.tw-proj b{font-size:22px;color:#0f2a4e}.tw-proj i{display:block;font-size:11px;color:#94a3b8;font-style:normal}
.tw-curve{width:100%;height:auto;margin-top:6px}
.tw-whatif{display:grid;gap:6px}.tw-opt{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fff;font:inherit;text-align:start;cursor:pointer}.tw-opt.on{border-color:#0b8a83;background:#f0fdfa}.tw-opt b{font-size:13px;color:#0f172a;display:block}.tw-opt small{display:block;font-size:11px;color:#64748b}.tw-opt i{font-style:normal;font-weight:900;color:#0b8a83;font-size:16px}
.tw-k{font-size:10.5px;font-weight:900;border-radius:999px;padding:2px 8px;background:#e2e8f0;color:#334155;white-space:nowrap}.tw-k.program{background:#dcfce7;color:#166534}.tw-k.simulation{background:#ede9fe;color:#5b21b6}.tw-k.session{background:#dbeafe;color:#1e40af}.tw-k.daily{background:#fef3c7;color:#92400e}
.tw-pathform{display:flex;gap:8px;flex-wrap:wrap}.tw-pathform label{display:grid;gap:3px;font-size:11.5px;color:#64748b;flex:1}.tw-pathform select{border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}
.tw-path{margin-top:8px;border-radius:12px;padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc}.tw-path.ok{border-color:#a7f3d0;background:#ecfdf5}.tw-path.no{border-color:#fde68a;background:#fffbeb}.tw-path p{margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a}.tw-path ol{margin:0;padding-inline-start:18px;display:grid;gap:4px}.tw-path li{font-size:12.5px;color:#334155;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.tw-path li a{color:#0f2a4e;font-weight:800}.tw-path li small{color:#64748b}.tw-path>small{display:block;margin-top:6px;color:#64748b}
.tw-list{display:grid;gap:4px}.tw-list h3{margin:0 0 6px;font-size:14px;display:flex;gap:6px;align-items:center}.tw-row{display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;border:0;background:transparent;font:inherit;text-align:start;padding:6px 8px;border-radius:10px;cursor:pointer}.tw-row.on{background:#f1f5f9}.tw-row i{width:9px;height:9px;border-radius:50%}.tw-row b{font-size:13px;color:#0f172a}.tw-row span{font-weight:900;color:#0f2a4e}.tw-row small{color:#64748b;width:34px;text-align:end}
.tw-bottom{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.tw-creds{display:grid;gap:8px}.tw-cred{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px}.tw-cred.off{opacity:.55}.tw-cred b{display:block;font-size:14px;color:#0f172a}.tw-cred small{color:#64748b;font-size:12px}
.tw-switch{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;font-weight:800;color:#64748b;cursor:pointer}.tw-switch input{display:none}.tw-switch span{width:34px;height:20px;border-radius:999px;background:#cbd5e1;position:relative;transition:.2s}.tw-switch span::after{content:'';position:absolute;top:3px;inset-inline-start:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:.2s}.tw-switch.on span{background:#0b8a83}.tw-switch.on span::after{inset-inline-start:17px}.tw-switch.on{color:#0b8a83}
.tw-rightsrow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.tw-forget{display:flex;gap:6px;flex:1;min-width:260px}.tw-forget input{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}.pt-btn.danger{color:#991b1b;border-color:#fecaca}.pt-btn.danger:disabled{opacity:.5}
.tw-empty h3{margin:8px 0 4px}.pt-muted{color:#64748b;font-size:13px;line-height:1.8}
@media(max-width:900px){.tw-grid,.tw-bottom{grid-template-columns:1fr}}
`;
