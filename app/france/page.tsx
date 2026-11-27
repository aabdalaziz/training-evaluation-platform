'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /france — P88 «مساحة الطالبة»: صفحة مجموعة فرنسا بثلاث لغات (فرنسي/إنجليزي/عربي)
 *  • عامّة: البرنامج · الخطوات الأربع · الجدول · الأسئلة · التواصل
 *  • بعد الدخول (OTP بالبريد): مستوى مِعيار · الحضور · جلسة اليوم المفتوحة · الاستبيان اليومي · التقييم الختامي · الشهادة
 *  البيانات: me_portal() (كما في /me) + /api/placements mine — بلا جداول جديدة.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { AtharMark } from '../components/PortalShell';
import { FRANCE, T, HUB_LANGS, cohortDays, phaseOf, pickLang, riyadhToday, fmtDay, type HubLang } from '../../lib/cohorts/france';
import { attendancePct, type MePortal, type MeProgram } from '../../lib/me/model';
import { effectiveLevel, type Placement } from '../../lib/portal/placement';

const LANG_KEY = 'athar:france-lang';
const LANG_LABEL: Record<HubLang, string> = { fr: 'Français', en: 'English', ar: 'العربية' };

export default function FrancePage() {
  const db = useMemo(() => supabase(), []);
  const [lang, setLang] = useState<HubLang>('en');
  const [ready, setReady] = useState(false);
  const [logged, setLogged] = useState(false);
  const [me, setMe] = useState<MePortal | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const t = T[lang]; const days = useMemo(() => cohortDays(), []); const today = riyadhToday(); const phase = phaseOf(today, days);

  useEffect(() => {
    let saved: string | null = null; try { saved = localStorage.getItem(LANG_KEY); } catch { /* ignore */ }
    const q = new URLSearchParams(window.location.search).get('lang');
    setLang(pickLang(q, saved, navigator.language));
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        setLogged(true);
        try { await db.rpc('attach_existing_rostered_student'); } catch { /* اختياري */ }
        try { const { data } = await db.rpc('me_portal'); if ((data as MePortal)?.ok) setMe(data as MePortal); } catch { /* يبقى null */ }
        try {
          const { data: s } = await db.auth.getSession();
          if (s.session) { const j = await fetch('/api/placements', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}` }, body: JSON.stringify({ action: 'mine' }) }).then((x) => x.json()); setPlacement(((j.placements || [])[0] as Placement) || null); }
        } catch { /* بلا نتيجة */ }
      }
      setReady(true);
    })();
  }, [db]);

  const choose = (l: HubLang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };
  const program: MeProgram | null = me?.programs.find((p) => p.id === FRANCE.programId) || null;
  const pct = attendancePct(program?.attendance); const level = effectiveLevel(placement);
  const openToday = (program?.open_sessions || []).filter((s) => !s.checked && s.session_date === today);
  const certs = program?.certificates?.filter((c) => !c.revoked) || [];
  const dailyDone = program?.evals?.last_at ? String(program.evals.last_at).slice(0, 10) === today : false;

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await db.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/france' } });
    setBusy(false); setMsg(error ? { ok: false, text: t.sendErr + error.message } : { ok: true, text: t.sent });
  }
  async function signOut() { await db.auth.signOut(); setLogged(false); setMe(null); setPlacement(null); }

  const phaseLabel = phase.kind === 'before' ? t.startsIn(phase.days) : phase.kind === 'after' ? t.finished : phase.isClassDay ? t.dayOf(phase.day, phase.total) : t.restDay;
  const mailto = `mailto:${FRANCE.contact.email}?subject=${encodeURIComponent('Miaar invitation — France cohort')}&body=${encodeURIComponent('Please resend my Miaar invitation. My e-mail: ')}`;

  return (
    <main className="fh" dir={t.dir} lang={lang} data-testid="france-hub"><style>{CSS}</style>
      <div className="fh-wrap">
        <header className="fh-top">
          <a href="/" className="fh-brand"><AtharMark size={34} /><span><b>{t.brand}</b><small>{t.brandSub}</small></span></a>
          <nav className="fh-langs" aria-label="Language">{HUB_LANGS.map((l) => <button key={l} className={l === lang ? 'on' : ''} onClick={() => choose(l)} data-testid={`fh-lang-${l}`}>{LANG_LABEL[l]}</button>)}</nav>
        </header>

        <section className="fh-hero">
          <span className="fh-kicker"><Icon name="flag" size={14} /> {t.kicker}</span>
          <h1>{t.title}</h1>
          <p className="fh-sub">{t.subtitle} <b>{FRANCE.trainer[lang]}</b>.</p>
          <div className="fh-facts">
            <div><Icon name="calendar" size={18} /><span><small>{t.when}</small><b>{t.dates}</b></span></div>
            <div><Icon name="home" size={18} /><span><small>{t.place}</small><b>{FRANCE.location[lang]}</b></span></div>
            <div><Icon name="clock" size={18} /><span><small>{t.hoursLabel}</small><b>{t.hoursVal}</b></span></div>
            <div><Icon name="users" size={18} /><span><small>{t.trainerLabel} · {t.organiserLabel}</small><b>{FRANCE.trainer[lang]} · {FRANCE.organiser[lang]}</b></span></div>
          </div>
          <div className={`fh-phase ${phase.kind}`} data-testid="fh-phase"><Icon name={phase.kind === 'after' ? 'award' : 'spark'} size={16} /> {phaseLabel}</div>
        </section>

        {ready && logged && (
          <section className="fh-card fh-me" data-testid="fh-me">
            <div className="fh-mehead"><div><span className="fh-kicker"><Icon name="school" size={14} /> {t.helloTitle}</span><h2>{t.hello((me?.name || '').split(/\s+/)[0] || '')}</h2></div><button className="fh-link" onClick={signOut}><Icon name="logout" size={14} /> {t.signOut}</button></div>
            {me && !program && <div className="fh-msg bad"><Icon name="alert" size={16} /><span>{t.notEnrolled}</span></div>}
            <div className="fh-grid">
              <div className="fh-tile"><small>{t.level}</small>{level ? <b className="fh-level">{level}</b> : <a className="fh-btn" href={FRANCE.links.miaar}><Icon name="target" size={14} /> {t.levelNone}</a>}<span className="fh-muted">{t.levelHint}</span></div>
              <div className="fh-tile"><small>{t.attendance}</small><b className="fh-level">{pct == null ? '—' : `${pct}%`}</b><span className="fh-muted">{program?.attendance?.sessions ? t.attendanceOf((program.attendance.present || 0) + (program.attendance.late || 0), program.attendance.sessions) : t.noSessions}</span></div>
              <div className="fh-tile act">
                {openToday.length > 0 ? <><small>{t.todayOpen}</small>{openToday.map((s) => <a key={s.token} className="fh-btn primary" href={`/attend/${s.token}`}><Icon name="check" size={14} /> {t.checkIn}</a>)}</> : <><small>{t.dailyNow}</small><a className={`fh-btn ${dailyDone ? '' : 'primary'}`} href={`${FRANCE.links.daily}?lang=${lang === 'ar' ? 'ar' : 'en'}`}><Icon name="star" size={14} /> {t.dailyNow}</a><span className="fh-muted">{t.dailyHint}</span></>}
              </div>
              <div className="fh-tile">
                {program?.is_final_open ? <><small>{t.finalOpen}</small><a className="fh-btn primary" href={`${FRANCE.links.final}?lang=${lang === 'ar' ? 'ar' : 'en'}`}><Icon name="flag" size={14} /> {t.finalBtn}</a><span className="fh-muted">{t.finalHint}</span></> : <><small>{t.certs}</small>{certs.length ? certs.map((c) => <a key={c.serial || c.verify_code || c.issued_at} className="fh-btn" href={`${FRANCE.links.verify}/${encodeURIComponent(c.verify_code || c.serial || '')}`}><Icon name="certificate" size={14} /> {c.serial || t.certVerify}</a>) : <span className="fh-muted">{t.certNone}</span>}</>}
              </div>
            </div>
            <a className="fh-muted fh-more" href="/me">{t.fullSpace} →</a>
          </section>
        )}

        {ready && !logged && (
          <form className="fh-card fh-login" onSubmit={send} data-testid="fh-login">
            <h2><Icon name="mail" size={18} /> {t.signInTitle}</h2>
            <p className="fh-muted">{t.signInHint}</p>
            {msg && <div className={`fh-msg ${msg.ok ? 'ok' : 'bad'}`}><Icon name={msg.ok ? 'check' : 'alert'} size={16} /><span>{msg.text}</span></div>}
            <div className="fh-row"><input required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" aria-label={t.email} /><button className="fh-btn primary" disabled={busy}>{busy ? t.sending : t.send}</button></div>
          </form>
        )}

        <section className="fh-card">
          <h2>{t.stepsTitle}</h2>
          <ol className="fh-steps">{t.steps.map(([h, p], i) => <li key={i}><i>{i + 1}</i><div><b>{h}</b><p>{p}</p></div></li>)}</ol>
          <a className="fh-link" href={mailto}><Icon name="mail" size={14} /> {t.lostInvite}</a>
        </section>

        <section className="fh-card">
          <h2>{t.scheduleTitle}</h2><p className="fh-muted">{t.scheduleHint}</p>
          <table className="fh-table"><thead><tr><th>{t.dayCol}</th><th>{t.dateCol}</th><th>{t.timeCol}</th></tr></thead>
            <tbody>{days.map((d) => <tr key={d.date} className={d.date === today ? 'now' : d.date < today ? 'past' : ''}><td>{d.n}</td><td>{fmtDay(d.date, lang)}{d.date === today && <em> · {t.today}</em>}</td><td dir="ltr">{FRANCE.periods.map((p) => p.join('–')).join(' · ')}</td></tr>)}</tbody></table>
        </section>

        <section className="fh-card">
          <h2>{t.faqTitle}</h2>
          {t.faq.map(([q, a], i) => <details key={i} className="fh-faq"><summary>{q}</summary><p>{a}</p></details>)}
        </section>

        <footer className="fh-foot">
          <b>{t.contact}</b>
          <div className="fh-contacts"><a href={`mailto:${FRANCE.contact.email}`}><Icon name="mail" size={14} /> {FRANCE.contact.email}</a><a href={`tel:${FRANCE.contact.phone.replace(/\s/g, '')}`} dir="ltr"><Icon name="phone" size={14} /> {FRANCE.contact.phone}</a><a href={FRANCE.contact.whatsapp} target="_blank" rel="noopener"><Icon name="chat" size={14} /> WhatsApp</a></div>
          <small>{t.footer}</small>
        </footer>
      </div>
    </main>
  );
}

const CSS = `
.fh{min-height:100vh;background:#FBF4EE;color:#3A1F36;font-family:inherit}.fh-wrap{max-width:860px;margin:0 auto;padding:18px 16px 60px;display:flex;flex-direction:column;gap:14px}
.fh-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.fh-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit}.fh-brand span{display:grid;line-height:1.2}.fh-brand b{font-size:18px}.fh-brand small{font-size:11px;color:#6A3350}
.fh-langs{display:inline-flex;background:#fff;border:1px solid #EADFD6;border-radius:999px;padding:3px}.fh-langs button{border:0;background:transparent;padding:7px 12px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;color:#6A3350}.fh-langs button.on{background:#3A1F36;color:#fff}
.fh-hero{background:linear-gradient(135deg,#3A1F36,#6A3350);color:#fff;border-radius:22px;padding:26px 24px;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden}.fh-hero h1{margin:0;font-size:30px;line-height:1.2}.fh-sub{margin:0;opacity:.92;font-size:15px;line-height:1.7;max-width:640px}
.fh-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.02em;color:#F1D9A8}.fh-card .fh-kicker{color:#D4614A}
.fh-facts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:4px}.fh-facts>div{display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 12px}.fh-facts span{display:grid;gap:2px}.fh-facts small{font-size:11px;opacity:.75}.fh-facts b{font-size:13.5px}
.fh-phase{display:inline-flex;align-items:center;gap:8px;background:#D4614A;color:#fff;font-weight:800;border-radius:999px;padding:8px 14px;width:max-content;font-size:14px}.fh-phase.after{background:#5EA8A0}
.fh-card{background:#fff;border:1px solid #EADFD6;border-radius:18px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}.fh-card h2{margin:0;font-size:19px;display:flex;align-items:center;gap:8px}
.fh-muted{color:#7a6472;font-size:13px;line-height:1.6}.fh-more{text-decoration:none;align-self:flex-end}
.fh-mehead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.fh-mehead h2{font-size:24px;margin-top:2px}
.fh-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.fh-tile{background:#FBF4EE;border:1px solid #EADFD6;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-height:104px}.fh-tile small{font-size:12px;color:#6A3350;font-weight:800}.fh-level{font-size:30px;line-height:1;color:#3A1F36}.fh-tile.act{background:#FFF7F3;border-color:#F3C4B6}
.fh-btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none;border:1px solid #EADFD6;background:#fff;color:#3A1F36;border-radius:12px;padding:9px 14px;font-weight:800;font-size:14px;cursor:pointer;width:max-content;max-width:100%}.fh-btn.primary{background:#D4614A;border-color:#D4614A;color:#fff}.fh-btn:disabled{opacity:.6}
.fh-link{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;color:#6A3350;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;padding:0}
.fh-msg{display:flex;gap:8px;align-items:flex-start;border-radius:12px;padding:10px 12px;font-size:14px}.fh-msg.ok{background:#eef7f6;color:#1f5e58}.fh-msg.bad{background:#FBEDE7;color:#9A3A2A}
.fh-row{display:flex;gap:8px;flex-wrap:wrap}.fh-row input{flex:1;min-width:220px;border:1px solid #EADFD6;border-radius:12px;padding:11px 12px;font-size:15px;background:#FBF4EE}
.fh-steps{list-style:none;margin:0;padding:0;display:grid;gap:10px}.fh-steps li{display:flex;gap:12px;align-items:flex-start}.fh-steps i{flex:none;width:30px;height:30px;border-radius:50%;background:#3A1F36;color:#fff;font-style:normal;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.fh-steps b{display:block;font-size:15px}.fh-steps p{margin:2px 0 0;color:#5b4653;font-size:13.5px;line-height:1.6}
.fh-table{width:100%;border-collapse:collapse;font-size:14px}.fh-table th{text-align:start;font-size:12px;color:#6A3350;border-bottom:2px solid #EADFD6;padding:6px 8px}.fh-table td{padding:8px;border-bottom:1px solid #F3EBE4}.fh-table tr.now td{background:#FFF7F3;font-weight:800}.fh-table tr.past td{color:#a08e99}.fh-table em{color:#D4614A;font-style:normal;font-weight:800}
.fh-faq{border:1px solid #EADFD6;border-radius:12px;padding:10px 14px}.fh-faq summary{cursor:pointer;font-weight:800;font-size:14.5px}.fh-faq p{margin:8px 0 0;color:#5b4653;font-size:13.5px;line-height:1.7}
.fh-foot{display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center;color:#6A3350;padding-top:10px}.fh-contacts{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}.fh-contacts a{display:inline-flex;align-items:center;gap:6px;color:#3A1F36;text-decoration:none;font-weight:700;font-size:14px}.fh-foot small{font-size:12px;color:#8a7580}
@media(max-width:600px){.fh-facts,.fh-grid{grid-template-columns:1fr}.fh-hero h1{font-size:25px}.fh-table td:last-child,.fh-table th:last-child{display:none}}
`;
