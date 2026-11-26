'use client';
/**
 * /me — بوّابة المتعلّم
 * دخول برابط آمن (OTP) بالبريد، ثم: المهام المطلوبة الآن، برامجي (حضور · تقييمات · قياس الأثر · متابعة الأثر)، شهاداتي.
 * البيانات من RPC واحدة: me_portal() (تعتمد على بريد المستخدم المسجّل)
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import ProgramResources from '../components/ProgramResources';
import UpcomingSessions from '../components/UpcomingSessions';
import PlacementCard from '../components/PlacementCard';
import ContactPrefs from '../components/ContactPrefs';
import NoticesCard from '../components/Notices'; /* P39 «تنبيهاتي» */
import OrgPledgeBanner from '../components/OrgPledgeBanner';
import ReportLinesCard from '../components/ReportLinesCard';
import { AtharMark } from '../components/PortalShell';
import type { IconName } from '../../lib/ui/icons';
import { CERT_KIND_AR, STATUS_AR, attendancePct, attendanceTone, buildTasks, isRunning, type MePortal, type Task } from '../../lib/me/model';
import ExitCard from './ExitCard'; /* هـ-1/5 */

const TASK_ICON: Record<Task['kind'], IconName> = { attend: 'check', daily: 'calendar', final: 'flag', impact_pre: 'target', impact_post: 'target', followup: 'trend' };

export default function MePage() {
  const db = supabase();
  const [loading, setLoading] = useState(true);
  const [logged, setLogged] = useState(false);
  const [me, setMe] = useState<MePortal | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'tasks' | 'programs' | 'certs'>('tasks');
  const [kids, setKids] = useState<number>(0); /* P81: أطفال وليّ الأمر في كيدز → «أطفالي» */

  async function load() {
    const { data, error } = await db.rpc('me_portal');
    if (error) { setError(error.message); return; }
    const d = data as MePortal;
    if (!d?.ok) { setError(d?.error === 'unauthenticated' ? 'انتهت الجلسة — أعد تسجيل الدخول.' : (d?.error || 'تعذر التحميل')); return; }
    setMe(d);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { setLoading(false); return; }
      setLogged(true);
      try { await db.rpc('attach_existing_rostered_student'); } catch { /* اختياري */ }
      try { const { count } = await db.from('kids_children').select('id', { count: 'exact', head: true }).eq('parent_id', user.id).is('archived_at', null); setKids(count || 0); } catch { /* كيدز اختياري */ }
      await load(); setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage(null);
    const em = email.trim().toLowerCase();
    const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/me' } });
    setBusy(false);
    setMessage(error ? { ok: false, text: 'تعذر إرسال الرابط: ' + error.message } : { ok: true, text: 'أرسلنا رابط دخول آمنًا إلى بريدك. افتحه من هذا الجهاز للوصول إلى بوابتك.' });
  }

  const tasks = useMemo(() => (me ? buildTasks(me) : []), [me]);
  const allCerts = useMemo(() => (me ? [...me.programs.flatMap(p => p.certificates.map(c => ({ ...c, program_name: p.name_ar }))), ...me.other_certificates] : []), [me]);
  const running = useMemo(() => (me ? me.programs.filter(p => isRunning(p, me.today)) : []), [me]);

  const shell = (child: React.ReactNode) => <main className="me" dir="rtl"><style>{CSS}</style><div className="me-wrap">{child}</div></main>;
  const head = (
    <header className="me-card me-head">
      <div className="me-brand"><a href="/" className="me-brandlink"><AtharMark size={36} /><span><b>أَثَر</b><small>بَوَّابَةُ أَثَرٍ لِلتَّعْلِيمِ وَالتَّدْرِيبِ وَالتَّطْوِيرِ وَالْجَوْدَةِ</small></span></a><nav className="me-quick"><a href="/me/skills"><Icon name="target" size={14} /> ملفي المهاري</a><a href="/me/twin"><Icon name="star" size={14} /> توأمي</a><a href="/live"><Icon name="play" size={14} /> الجلسات</a><a href="/resources"><Icon name="folder" size={14} /> الحقائب</a><a href="/programs"><Icon name="programs" size={14} /> البرامج</a><a href="/org"><Icon name="users" size={14} /> بوّابة الجهات</a></nav></div>
      <div className="me-kicker"><Icon name="school" size={14} /> بوّابة المتعلّم — حسابك الموحّد في أَثَر</div>
      {me ? <>
        <h1>مرحبًا، {me.name}</h1>
        <p className="me-sub">{/^\d+@[a-z0-9-]+\.id\.athar-portal\.sa$/i.test(me.email || '') ? <span data-testid="me-code-id">رقمك التدريبي <b dir="ltr">{String(me.email).split('@')[0]}</b> — لا بريد ولا اسم في حسابك (P67)</span> : <span dir="ltr">{me.email}</span>} · {me.programs.length} برنامج · {allCerts.length} شهادة{running.length ? ` · ${running.length} برنامج جارٍ` : ''}</p>
      </> : <>
        <h1>بوّابة المتعلّم</h1>
        <p className="me-sub">كل ما يخصك في مكان واحد: التقييمات المطلوبة، تسجيل الحضور، نسبة حضورك، قياس الأثر، وشهاداتك — بالدخول ببريدك فقط، بلا كلمة مرور.</p>
      </>}
    </header>
  );

  if (loading) return shell(<div className="me-card me-center me-muted">جارٍ التحقق…</div>);

  if (!logged) return shell(<>
    {head}
    <form className="me-card" onSubmit={send}>
      <h2><span className="me-n">1</span>البريد الإلكتروني</h2>
      {message && <div className={`me-msg ${message.ok ? 'ok' : 'bad'}`}><Icon name={message.ok ? 'check' : 'alert'} size={16} /><span>{message.text}</span></div>}
      <label className="me-field"><span>البريد الذي سجّلت به حضورك أو تقييماتك<span className="me-req"> *</span></span>
        <input required type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
      </label>
      <button className="me-btn primary" disabled={busy}><Icon name="mail" size={15} /> {busy ? 'جارٍ الإرسال…' : 'إرسال رابط الدخول الآمن'}</button>
      <small className="me-muted"><Icon name="shield" size={12} /> الرابط صالح لفترة قصيرة ويُستخدم مرة واحدة. لا نشارك بريدك مع أي جهة.</small>
    </form>
    <section className="me-card me-help">
      <b>هل وصلك رابط أو رمز QR من الميسّر؟</b>
      <p className="me-muted">يمكنك فتحه مباشرة دون تسجيل دخول: <a href="/evaluate/daily">التقييم اليومي</a> · <a href="/evaluate/final">التقييم النهائي</a> · <a href="/verify">التحقق من شهادة</a></p>
    </section>
  </>);

  return shell(<>
    {head}
    {error && <div className="me-msg bad"><Icon name="alert" size={16} /><span>{error}</span></div>}
    {me && <PlacementCard />}
    {me && <NoticesCard />}
    {me && <div id="prefs"><ContactPrefs /></div>}
    {me && <OrgPledgeBanner />}
    {me && <ReportLinesCard />}
    {me && <>
      <nav className="me-tabs">
        <button className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}><Icon name="evaluations" size={16} /> المطلوب مني {tasks.length ? <i>{tasks.length}</i> : null}</button>
        <button className={tab === 'programs' ? 'on' : ''} onClick={() => setTab('programs')}><Icon name="programs" size={16} /> برامجي <i>{me.programs.length}</i></button>
        <a className="me-tablink" href="/me/skills"><Icon name="target" size={16} /> مهاراتي</a>
        <a className="me-tablink" href="/me/twin"><Icon name="star" size={16} /> توأمي</a>
        <a className="me-tablink" href="/me/missions"><Icon name="flag" size={16} /> مهماتي</a>
        <a className="me-tablink" href="/me/directory"><Icon name="certificate" size={16} /> سيرتي في الهيئة</a>
        <a className="me-tablink" href="/me/access"><Icon name="users" size={16} /> احتياجاتي</a>
        <a className="me-tablink" href="/me/onair"><Icon name="chat" size={16} /> أَثَر معك</a>
        <a className="me-tablink" href="/me/after"><Icon name="certificate" size={16} /> محطاتي</a>
        <a className="me-tablink" href="/needs"><Icon name="spark" size={16} /> حاجاتي</a>
        <a className="me-tablink" href="/me/rehearsal"><Icon name="users" size={16} /> بروفاتي</a>
        <a className="me-tablink" href="/me/reports"><Icon name="doc" size={16} /> تقاريري</a>
        <a className="me-tablink" href="/me/council"><Icon name="users" size={16} /> مجلسي</a>
        <a className="me-tablink" href="/me/journey"><Icon name="compass" size={16} /> رحلتي</a>
        <a className="me-tablink" href="/me/athar-map" data-testid="me-athar-map"><Icon name="spark" size={16} /> خريطة أثرك</a>
        <a className="me-tablink" href="/me/letter" data-testid="me-letter"><Icon name="mail" size={16} /> رسالة إلى نفسي</a>
        <a className="me-tablink" href="/me/first" data-testid="me-first"><Icon name="spark" size={16} /> أول يوم</a>
        <a className="me-tablink" href="/me/line" data-testid="me-line"><Icon name="edit" size={16} /> سطري</a>
        <a className="me-tablink" href="/me/level" data-testid="me-level"><Icon name="school" size={16} /> بكلماتي عبر المستوى</a>
        {kids > 0 && <a className="me-tablink" href="/kids/parent" data-testid="me-kids"><Icon name="home" size={16} /> أطفالي <i>{kids}</i></a>}{/* P81 */}
        <a className="me-tablink" href="/me/grad" data-testid="me-grad"><Icon name="award" size={16} /> يوم تخرّجي</a>
        <a className="me-tablink" href="/me/horizon"><Icon name="flag" size={16} /> أفقي</a>
        <a className="me-tablink" href="/me/pair"><Icon name="users" size={16} /> عهدان متقابلان</a>
        <a className="me-tablink" href="/me/data"><Icon name="shield" size={16} /> ذاكرتي</a>
        <button className={tab === 'certs' ? 'on' : ''} onClick={() => setTab('certs')}><Icon name="certificate" size={16} /> شهاداتي <i>{allCerts.length}</i></button>
      </nav>

      {tab === 'tasks' && (
        <section className="me-stack">
          {!tasks.length && <div className="me-card me-center"><div className="me-ring"><Icon name="check" size={30} /></div><b>لا توجد مهام مطلوبة الآن</b><p className="me-muted">عند فتح تقييم أو جلسة حضور أو استبيان متابعة ستظهر هنا.</p></div>}
          {tasks.map(t => (
            <a key={t.id} href={t.href} className={`me-card me-task ${t.urgent ? 'urgent' : ''}`}>
              <span className="me-task-ic"><Icon name={TASK_ICON[t.kind]} size={20} /></span>
              <span className="me-task-txt"><b>{t.title}</b><small>{t.program_name}</small><span>{t.hint}</span></span>
              <span className="me-task-go">{t.urgent && <em>مطلوب الآن</em>}<Icon name="arrow" size={18} /></span>
            </a>
          ))}
        </section>
      )}

      {tab === 'programs' && (
        <section className="me-stack">
          <ExitCard /> {/* هـ-1/5 «لو خرجت اليوم تحمل معك» — تظهر لمن له قيد في دبلوم */}
          {!me.programs.length && <div className="me-card me-center"><div className="me-ring"><Icon name="folder" size={28} /></div><b>لا يوجد برنامج مرتبط ببريدك بعد.</b><p className="me-muted">يُربط البرنامج تلقائيًا عند تسجيل حضورك أو تقييمك ببريدك، أو عند إضافتك من إدارة البرنامج.</p></div>}
          {me.programs.map(p => {
            const pct = attendancePct(p.attendance); const tone = attendanceTone(pct);
            return (
              <article key={p.id} className="me-card me-prog">
                <div className="me-prog-head">
                  <div><h2>{p.name_ar}</h2>{p.name_en && <small className="me-muted ltr">{p.name_en}</small>}<div className="me-dates">من <bdi>{p.start_date || '—'}</bdi> إلى <bdi>{p.end_date || '—'}</bdi>{p.delivery_mode === 'remote' ? ' · عن بُعد' : ''}</div></div>
                  <span className={`me-pill ${isRunning(p, me.today) && String(p.status).toUpperCase() === 'ACTIVE' ? 'ok' : String(p.status).toUpperCase() === 'COMPLETED' ? 'info' : 'neutral'}`}>{STATUS_AR[String(p.status).toUpperCase()] || p.status || '—'}</span>
                </div>
                <div className="me-stats">
                  <div className={`me-stat ${tone}`}><span>نسبة الحضور</span><b>{pct == null ? '—' : `${pct}%`}</b><small>{p.attendance.sessions ? `${p.attendance.present + p.attendance.late} من ${p.attendance.sessions} جلسة${p.attendance.excused ? ` · ${p.attendance.excused} بعذر` : ''}` : 'لا جلسات بعد'}</small>{pct != null && <i className="me-bar"><u style={{ width: `${pct}%` }} /></i>}</div>
                  <div className="me-stat"><span>التقييم اليومي</span><b>{p.evals.daily}</b><small>تقييمًا مرسلًا</small></div>
                  <div className="me-stat"><span>التقييم النهائي</span><b>{p.evals.final ? <Icon name="check" size={22} /> : p.is_final_open ? 'مفتوح' : '—'}</b><small>{p.evals.final ? 'تم' : p.is_final_open ? 'بانتظار تقييمك' : 'يُفتح في ختام البرنامج'}</small></div>
                  <div className="me-stat"><span>الشهادات</span><b>{p.certificates.filter(c => !c.revoked).length}</b><small>{p.certificates.length ? 'صادرة' : pct != null && pct >= 80 ? 'مؤهل عند الإصدار' : 'لم تُصدر بعد'}</small></div>
                </div>
                <div className="me-actions">
                  {p.open_sessions.filter(s => !s.checked).map(s => <a key={s.token} href={`/attend/${s.token}`} className="me-btn gold"><Icon name="check" size={15} /> سجّل حضورك: {s.title || s.session_date}</a>)}
                  {isRunning(p, me.today) && <a className="me-btn" href={`/evaluate/daily?program=${p.id}`}><Icon name="calendar" size={15} /> التقييم اليومي</a>}
                  {p.is_final_open && !p.evals.final && <a className="me-btn gold" href={`/evaluate/final?program=${p.id}`}><Icon name="flag" size={15} /> التقييم النهائي</a>}
                  {p.impact.map(a => <span key={a.token} className="me-inline">{a.pre_open && <a className="me-btn" href={`/impact/${a.token}?phase=pre`}><Icon name="target" size={15} /> القياس القبلي</a>}{a.post_open && <a className="me-btn" href={`/impact/${a.token}?phase=post`}><Icon name="target" size={15} /> القياس البعدي</a>}</span>)}
                  {p.followups.map(f => f.answered ? <span key={f.token} className="me-done"><Icon name="check" size={13} /> متابعة الأثر: تم</span> : <a key={f.token} className="me-btn" href={`/followup/${f.token}?role=trainee`}><Icon name="trend" size={15} /> متابعة أثر التدريب</a>)}
                </div>
                <UpcomingSessions programId={p.id} compact />
                <ProgramResources programId={p.id} compact />
              </article>
            );
          })}
        </section>
      )}

      {tab === 'certs' && (
        <section className="me-stack">
          {!allCerts.length && <div className="me-card me-center"><div className="me-ring"><Icon name="certificate" size={28} /></div><b>لا توجد شهادات صادرة بعد.</b><p className="me-muted">تُصدر الشهادة بعد استيفاء نسبة الحضور والتقييم النهائي، وتصلك نسخة على بريدك.</p></div>}
          {allCerts.map(c => (
            <article key={c.serial || c.verify_code || Math.random()} className={`me-card me-cert ${c.revoked ? 'revoked' : ''}`}>
              <div className="me-cert-ic"><Icon name={c.kind === 'appreciation' ? 'award' : 'certificate'} size={26} /></div>
              <div className="me-cert-txt">
                <b>{CERT_KIND_AR[c.kind] || c.kind}{c.award_title ? ` — ${c.award_title}` : ''}</b>
                <span>{c.program_name || '—'}</span>
                <small>الرقم التسلسلي <bdi>{c.serial || '—'}</bdi> · صدرت في {c.issued_at}{c.hours ? ` · ${c.hours} ساعة` : ''}{c.revoked ? ' · ملغاة' : ''}</small>
              </div>
              {c.verify_code && !c.revoked && <a className="me-btn" href={`/verify/${c.verify_code}`} target="_blank" rel="noreferrer"><Icon name="shield" size={15} /> عرض والتحقق</a>}
            </article>
          ))}
          <p className="me-muted me-center-txt">تحتاج نسخة PDF؟ تصلك مع بريد الإصدار، أو اطلبها من إدارة البرنامج مع رقم الشهادة التسلسلي.</p>
        </section>
      )}
    </>}
    <div className="me-foot"><button className="me-link" onClick={() => load()}><Icon name="refresh" size={14} /> تحديث</button><button className="me-link" onClick={() => db.auth.signOut().then(() => location.reload())}><Icon name="logout" size={14} /> تسجيل الخروج</button></div>
  </>);
}

const CSS = `
.me{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;background:#F6EBE0;min-height:100vh;padding:18px 12px 60px;color:#2A1626}
.me *{box-sizing:border-box}
.me-wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.me-card{background:#fff;border:1px solid #EADFD6;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.me-head{border-top:5px solid #D9A866;gap:4px}
.me-brand{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}.me-brandlink{display:flex;gap:10px;align-items:center;text-decoration:none;color:#3A1F36}.me-brandlink b{display:block;font-size:20px;line-height:1}.me-brandlink small{color:#8E7F8A;font-size:11.5px}.me-quick{display:flex;gap:6px;flex-wrap:wrap}.me-quick a{display:inline-flex;gap:5px;align-items:center;border:1px solid #EADFD6;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:800;color:#3A1F36;text-decoration:none;background:#FBF4EE}.me-quick a:hover{border-color:#D4614A}
.me-kicker{font-size:12px;font-weight:900;color:#2F6B66;display:flex;align-items:center;gap:6px}
.me-head h1{margin:2px 0;font-size:22px;color:#3A1F36}
.me-sub{margin:4px 0 0;font-size:13.5px;line-height:1.8;color:#4A3645;background:#FBF4EE;border-radius:10px;padding:10px 12px}
.me-muted{color:#8E7F8A;font-size:12.5px;font-weight:700;margin:0;display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}.ltr{direction:ltr}
.me-card h2{margin:0;font-size:16px;color:#3A1F36;display:flex;align-items:center;gap:8px}
.me-n{width:26px;height:26px;border-radius:8px;background:#3A1F36;color:#fff;display:grid;place-items:center;font-size:13px;flex-shrink:0}
.me-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:800;color:#4A3645}.me-req{color:#B9544A}
.me-field input{border:1px solid #D9CBC2;border-radius:10px;padding:11px;font:inherit;font-size:15px;font-weight:700;color:#2A1626;background:#fff;min-height:44px}
.me-field input:focus{outline:none;border-color:#D4614A;box-shadow:0 0 0 3px rgba(212,97,74,.16)}
.me-msg{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;font-size:13.5px;font-weight:800;line-height:1.8}
.me-msg.bad{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A}.me-msg.ok{background:#E6F3F1;border:1px solid #BFE1DC;color:#1F4F4A}.me-msg svg{flex-shrink:0;margin-top:4px}
.me-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;color:#3A1F36;border:1px solid #D9CBC2;border-radius:12px;padding:10px 16px;font:inherit;font-size:13.5px;font-weight:900;cursor:pointer;text-decoration:none;min-height:42px}
.me-btn:hover{border-color:#D4614A;color:#D4614A}
.me-btn.primary{background:#3A1F36;color:#fff;border-color:#3A1F36;padding:13px 22px;font-size:15px}.me-btn.primary:hover{background:#4A2946;color:#fff}.me-btn:disabled{opacity:.5;cursor:not-allowed}
.me-btn.gold{background:#FBF4EE;border-color:#F1D9A8;color:#8A5A1E}.me-btn.gold:hover{border-color:#D9A866;color:#8A5A1E}
.me-tabs{display:flex;flex-wrap:wrap;gap:6px;background:#fff;border:1px solid #EADFD6;border-radius:14px;padding:6px}
.me-tabs .me-tablink{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;padding:10px 8px;font-size:13.5px;font-weight:800;color:#D4614A;text-decoration:none;background:#FBEDE7}
.me-tabs button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;border-radius:10px;padding:10px 8px;font:inherit;font-size:13.5px;font-weight:900;color:#5C4858;cursor:pointer;min-width:0}
.me-tabs button.on{background:#3A1F36;color:#fff}.me-tabs i{font-style:normal;background:rgba(42,22,38,.08);border-radius:999px;padding:0 7px;font-size:11px}.me-tabs button.on i{background:rgba(255,255,255,.2)}
.me-stack{display:flex;flex-direction:column;gap:10px}
.me-task{flex-direction:row;align-items:center;gap:12px;text-decoration:none;color:inherit;padding:14px 16px;border-inline-start:4px solid #D9CBC2}
.me-task.urgent{border-inline-start-color:#D9A866;background:#FBF4EE}.me-task:hover{border-color:#D4614A}
.me-task-ic{width:42px;height:42px;border-radius:12px;background:#F3E6DC;color:#3A1F36;display:grid;place-items:center;flex-shrink:0}.me-task.urgent .me-task-ic{background:#FBF4EE;color:#8A5A1E}
.me-task-txt{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}.me-task-txt b{font-size:14.5px;color:#3A1F36}.me-task-txt small{font-size:12px;color:#D4614A;font-weight:800}.me-task-txt span{font-size:12.5px;color:#8E7F8A;font-weight:700;line-height:1.6}
.me-task-go{display:flex;align-items:center;gap:8px;color:#3A1F36;flex-shrink:0}.me-task-go svg{transform:scaleX(-1)}.me-task-go em{font-style:normal;font-size:11px;font-weight:900;background:#D9A866;color:#fff;border-radius:999px;padding:3px 9px}
.me-prog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.me-dates{font-size:12px;color:#8E7F8A;font-weight:700;margin-top:4px}
.me-pill{font-size:11.5px;font-weight:900;border-radius:999px;padding:4px 10px;white-space:nowrap}.me-pill.ok{background:#E6F3F1;color:#2F6B66}.me-pill.info{background:#F3E8EF;color:#6A3350}.me-pill.neutral{background:#F6EBE0;color:#5C4858}
.me-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.me-stat{background:#FBF4EE;border:1px solid #F3E6DC;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0;position:relative}
.me-stat span{font-size:11.5px;font-weight:800;color:#8E7F8A}.me-stat b{font-size:22px;color:#3A1F36;line-height:1.2;display:flex;align-items:center;min-height:26px}.me-stat small{font-size:11px;color:#B3A5AE;font-weight:700;line-height:1.5}
.me-stat.ok b{color:#2F6B66}.me-stat.warn b{color:#8A5A1E}.me-stat.bad b{color:#B9544A}
.me-bar{display:block;height:5px;background:#EADFD6;border-radius:999px;overflow:hidden;margin-top:6px}.me-bar u{display:block;height:100%;background:#D4614A;border-radius:999px}.me-stat.warn .me-bar u{background:#8A5A1E}.me-stat.bad .me-bar u{background:#D4614A}
.me-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.me-inline{display:contents}
.me-done{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;color:#2F6B66;background:#E6F3F1;border-radius:10px;padding:9px 12px}
.me-cert{flex-direction:row;align-items:center;gap:14px}.me-cert.revoked{opacity:.6}
.me-cert-ic{width:52px;height:52px;border-radius:14px;background:#FBF4EE;color:#8A5A1E;display:grid;place-items:center;flex-shrink:0}
.me-cert-txt{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.me-cert-txt b{font-size:14.5px;color:#3A1F36}.me-cert-txt span{font-size:13px;color:#4A3645;font-weight:700}.me-cert-txt small{font-size:11.5px;color:#B3A5AE;font-weight:700}
.me-center{text-align:center;align-items:center;padding:30px 20px}.me-center b{color:#3A1F36;font-size:15px}.me-center-txt{justify-content:center;text-align:center}
.me-ring{width:64px;height:64px;border-radius:999px;background:#F3E6DC;color:#D4614A;display:grid;place-items:center;margin-bottom:4px}
.me-foot{display:flex;justify-content:center;gap:8px}
.me-link{border:0;background:none;color:#8E7F8A;font:inherit;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px}.me-link:hover{background:#fff;color:#3A1F36}
.me-help{background:#FBF4EE}.me-help b{font-size:13.5px;color:#3A1F36}.me-help a{color:#D4614A;font-weight:800}
@media(max-width:640px){.me-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.me-tabs button,.me-tabs .me-tablink{flex:1 1 auto;font-size:12px;padding:9px 6px;white-space:nowrap;gap:4px}.me-tabs button svg{display:none}.me-task{flex-wrap:wrap}.me-task-go{width:100%;justify-content:flex-end}.me-cert{flex-wrap:wrap}.me-cert .me-btn{width:100%}}
`;
