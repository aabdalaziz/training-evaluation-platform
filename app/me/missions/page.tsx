'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — مهماتي من قلب العمل (P12-أ): مهمات ما بعد البرنامج، حالتها ومهلتها، وأدلتي المؤكَّدة التي تغذّي توأمي وشهاداتي الحية.

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fmtDate } from '../../../lib/portal/content';
import { MODE_LABEL, STATUS_LABEL, statusLabel, daysLeft, urgency } from '../../../lib/portal/missions';
import type { Mission, TransferStats } from '../../../lib/portal/missions';

export default function MyMissionsPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type Row = Omit<Mission, 'confirm_token'>;

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [loaded, setLoaded] = useState(false); const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [rows, setRows] = useState<Row[]>([]); const [skills, setSkills] = useState<Record<string, { name_ar: string; name_en: string }>>({}); const [stats, setStats] = useState<TransferStats | null>(null);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState(''); const now = useMemo(() => new Date(), []);
  useEffect(() => { (async () => { try { const { data: { user: u } } = await db.auth.getUser(); if (u) { setUser({ id: u.id, email: u.email || '' }); const { data } = await db.auth.getSession(); const j = await fetch('/api/missions', { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } }).then(x => x.json()); if (j.success) { setRows(j.missions || []); setStats(j.stats || null); const m: Record<string, any> = {}; for (const s of j.skills || []) m[s.id] = s; setSkills(m); } else setErr(j.error || ''); } } catch { /* ignore */ } setLoaded(true); })(); }, [db]);
  async function sendLink(e: React.FormEvent) { e.preventDefault(); setErr(''); const em = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(ar ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; } const { error } = await db.auth.signInWithOtp({ email: em, options: { emailRedirectTo: `${location.origin}/me/missions` } }); if (error) setErr(error.message); else setSent(true); }
  const open = rows.filter(r => ['assigned', 'returned'].includes(r.status)); const waiting = rows.filter(r => r.status === 'submitted'); const done = rows.filter(r => r.status === 'confirmed'); const rest = rows.filter(r => r.status === 'expired');
  const Card = ({ m }: { m: Row }) => { const left = daysLeft(m.due_at, now); const u = urgency(m.due_at, now); return (
    <article className={`mm-card ${m.status}`}>
      <div className="mm-top"><span className="mm-st" style={{ ['--c' as any]: STATUS_LABEL[m.status].color }}>{statusLabel(m.status, lang)}</span><small>{MODE_LABEL[m.evidence_mode][lang]}</small></div>
      <h3>{m.title_ar}</h3>
      <p>{m.brief_ar}</p>
      <div className="pt-chips mm-sk">{(m.skills || []).map(id => skills[id] ? <span key={id}>{lang === 'en' && skills[id].name_en ? skills[id].name_en : skills[id].name_ar}</span> : null)}</div>
      <div className="mm-foot">
        {m.status === 'assigned' && <small className={`mm-due ${u}`}><Icon name="clock" size={12} /> {left >= 0 ? (ar ? `بقي ${left} يوم` : `${left} days left`) : (ar ? `تأخرت ${-left} يوم` : `${-left} days late`)}</small>}
        {m.status === 'submitted' && <small><Icon name="clock" size={12} /> {ar ? 'أُرسل' : 'Sent'} {fmtDate(m.submitted_at || '', lang)}{m.ai ? ` · ${ar ? 'فحص أولي' : 'first check'} ${m.ai.score}%` : ''}</small>}
        {m.status === 'confirmed' && <small className="ok"><Icon name="check" size={12} /> {ar ? `أكّدها ${m.confirmed_by || 'المشرف'}` : `Confirmed by ${m.confirmed_by || 'supervisor'}`} · {fmtDate(m.confirmed_at || '', lang)}</small>}
        {m.status === 'returned' && <small className="bad"><Icon name="alert" size={12} /> {m.confirm_note}</small>}
        {m.status === 'expired' && <small>{ar ? 'انتهت المهلة' : 'Expired'} · {fmtDate(m.due_at, lang)}</small>}
        <Link className={`pt-btn small ${m.status === 'confirmed' ? 'ghost' : m.status === 'assigned' || m.status === 'returned' ? 'gold' : 'light'}`} href={`/m/${m.token}`}>{m.status === 'confirmed' ? (ar ? 'عرض' : 'View') : m.status === 'submitted' ? (ar ? 'رابط التأكيد / إعادة الإرسال' : 'Confirmation / resubmit') : (ar ? 'ابدأ المهمة' : 'Start mission')} <Icon name="arrow" size={12} /></Link>
      </div>
    </article>); };

  return (
    <main className="pt-main mm">
      <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> / <Link href="/me">{ar ? 'بوابة المتدرب' : 'Trainee portal'}</Link> / <span>{ar ? 'مهماتي' : 'My missions'}</span></div>
        <h1>{ar ? 'مهماتي من قلب العمل' : 'My workflow missions'}</h1>
        <p className="pt-lead">{ar ? 'بعد كل برنامج تصلك مهمات صغيرة تُنجز في عملك الحقيقي: صورة، تسجيل 60 ثانية، أو سطور. يفحصها أَثَر مقابل معيار معلن، ويؤكدها مشرفك بضغطة، فتصبح أقوى دليل في توأمك المهاري وشهاداتك الحية.' : 'After each program you receive small missions done in your real work. Athar checks them against a published standard, your supervisor confirms in one click, and they become the strongest evidence in your twin and living credentials.'}</p>
        {stats && rows.length > 0 && <div className="mm-kpis"><span><b>{stats.confirmed}</b> {ar ? 'دليل مؤكَّد' : 'confirmed'}</span><span><b>{stats.submitted}</b> {ar ? 'بانتظار المشرف' : 'awaiting supervisor'}</span><span><b>{stats.assigned}</b> {ar ? 'بانتظارك' : 'waiting for you'}</span>{stats.avg_score !== null && <span><b>{stats.avg_score}%</b> {ar ? 'متوسط الفحص' : 'avg check'}</span>}</div>}
      </div></section>
      <section className="pt-sec"><div className="pt-wrap">
        {!loaded && <div className="pt-empty">…</div>}
        {loaded && !user && <div className="pt-box mm-login"><h3>{ar ? 'ادخل لترى مهماتك' : 'Sign in to see your missions'}</h3>{sent ? <div className="pt-alert ok">{ar ? 'أرسلنا رابط الدخول إلى بريدك.' : 'Magic link sent.'}</div> : <form onSubmit={sendLink} className="mm-form"><input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /><button className="pt-btn gold" type="submit">{ar ? 'أرسل رابط الدخول' : 'Send link'}</button></form>}{err && <div className="pt-alert err">{err}</div>}</div>}
        {loaded && user && rows.length === 0 && <div className="pt-box pt-empty mm-empty"><Icon name="flag" size={30} /><h3>{ar ? 'لا مهمات بعد' : 'No missions yet'}</h3><p>{ar ? 'تصلك أول مهمة بعد أسبوع من إتمام برنامج (شهادة إتمام). حتى ذلك الحين: جرّب محاكاة أداء أو تحدّي اليوم.' : 'Your first mission arrives a week after completing a program.'}</p><div className="pt-chips"><Link className="pt-btn small" href="/sim">{ar ? 'المحاكيات' : 'Simulators'}</Link><Link className="pt-btn light small" href="/#daily">{ar ? 'كل يوم مهارة' : 'Daily skill'}</Link><Link className="pt-btn ghost small" href="/me/twin">{ar ? 'توأمي' : 'My twin'}</Link></div></div>}
        {open.length > 0 && <><h2 className="mm-h"><Icon name="flag" size={18} /> {ar ? 'بانتظارك' : 'Waiting for you'} <small>{open.length}</small></h2><div className="mm-grid">{open.map(m => <Card key={m.id} m={m} />)}</div></>}
        {waiting.length > 0 && <><h2 className="mm-h"><Icon name="clock" size={18} /> {ar ? 'بانتظار تأكيد المشرف' : 'Awaiting supervisor'} <small>{waiting.length}</small></h2><div className="mm-grid">{waiting.map(m => <Card key={m.id} m={m} />)}</div></>}
        {done.length > 0 && <><h2 className="mm-h"><Icon name="award" size={18} /> {ar ? 'أدلتي المؤكَّدة' : 'Confirmed evidence'} <small>{done.length}</small></h2><div className="mm-grid">{done.map(m => <Card key={m.id} m={m} />)}</div></>}
        {rest.length > 0 && <><h2 className="mm-h muted">{ar ? 'انتهت مهلتها' : 'Expired'} <small>{rest.length}</small></h2><div className="mm-grid">{rest.map(m => <Card key={m.id} m={m} />)}</div></>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.mm-kpis{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;color:#fff;font-size:13px}.mm-kpis b{font-size:20px;margin-inline-end:4px;color:#c9a24b}
.mm-h{display:flex;align-items:center;gap:8px;color:#0f2a4e;font-size:18px;margin:18px 0 10px}.mm-h small{background:#e2e8f0;color:#334155;border-radius:999px;padding:1px 9px;font-size:12px}.mm-h.muted{color:#64748b}
.mm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.mm-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;display:grid;gap:8px;box-shadow:0 4px 16px rgba(15,23,42,.05)}.mm-card.assigned,.mm-card.returned{border-color:#c9a24b}.mm-card.confirmed{border-color:#10b981}
.mm-top{display:flex;justify-content:space-between;align-items:center}.mm-top small{color:#64748b;font-size:12px}.mm-st{box-shadow:inset 0 0 0 2px var(--c);color:var(--c);border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:900}
.mm-card h3{margin:0;font-size:16px;color:#0f2a4e}.mm-card p{margin:0;color:#475569;font-size:13px;line-height:1.7;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.mm-sk span{font-size:11px;background:#e6f4f3;color:#0b6b66;border-radius:999px;padding:2px 9px;font-weight:800}
.mm-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px dashed #e2e8f0;padding-top:8px}.mm-foot small{display:inline-flex;align-items:center;gap:4px;color:#64748b;font-size:12px}.mm-foot small.ok{color:#047857}.mm-foot small.bad{color:#b91c1c}.mm-due.soon{color:#b45309!important}.mm-due.late{color:#b91c1c!important}
.mm-login{max-width:520px;margin:0 auto}.mm-form{display:grid;grid-template-columns:1fr auto;gap:8px}.mm-form input{border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit}
.mm-empty .pt-chips{justify-content:center;margin-top:10px}
`;
