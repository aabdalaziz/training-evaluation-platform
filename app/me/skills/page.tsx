'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — ملفي المهاري: خريطة المهارات بالمجالات (محسوبة + معتمدة)، الأدلة، الشهادات الرقمية، ما التالي، إعدادات المشاركة والرابط العام + جواز المهارات PDF (P8-ج)

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { t, fmtDate } from '../../../lib/portal/content';
import { DOMAINS, domainLabel, domainTone, skillName, frameworkBadges } from '../../../lib/portal/skills';
import type { Skill } from '../../../lib/portal/skills';
import { displayLevel, levelName, confidenceLabel, EVIDENCE_LABEL, SHARE_MODES, credentialTitle, credentialKindLabel, credentialStatus } from '../../../lib/portal/profile';
import type { SkillLevelRow, Credential, ShareMode } from '../../../lib/portal/profile';
import { resTitle } from '../../../lib/portal/resources';
import type { Resource } from '../../../lib/portal/resources';
import { buildPassport, downloadPassport } from '../../../lib/portal/passport';
import { normalizeSite } from '../../../lib/portal/open';
import { AI_DISCLAIMER } from '../../../lib/ai/prompts';
import type { LearnerPlan } from '../../../lib/ai/prompts';

export default function SkillsPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
const RESUME_KEY = 'athar_resume';
type Profile = { user_id: string; public_id: string; display_name?: string | null; headline?: string | null; city?: string | null; share_mode: ShareMode };

function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null); const [loaded, setLoaded] = useState(false); const [profile, setProfile] = useState<Profile | null>(null); const [levels, setLevels] = useState<SkillLevelRow[]>([]); const [creds, setCreds] = useState<Credential[]>([]); const [skills, setSkills] = useState<Map<string, Skill>>(new Map()); const [next, setNext] = useState<Resource[]>([]);
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [openSkill, setOpenSkill] = useState<string | null>(null); const [edit, setEdit] = useState<{ display_name: string; headline: string; city: string } | null>(null);

  async function token() { const { data } = await db.auth.getSession(); return data.session?.access_token || ''; }
  const [plan, setPlan] = useState<{ data: LearnerPlan; source: string; usage?: { used: number; limit: number } } | null>(null); const [goal, setGoal] = useState('');
  async function makePlan() {
    setBusy('plan'); setErr(''); try { const tk = await token(); const j = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ purpose: 'learner_plan', lang, goal: goal.trim() }) }).then(x => x.json()); if (!j.success) throw new Error(j.error || 'خطأ'); setPlan({ data: j.data, source: j.source, usage: j.usage }); } catch (e: any) { setErr(String(e?.message || e)); }
    setBusy('');
  }
  async function load() {
    const tk = await token(); const j = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'me' }) }).then(x => x.json());
    if (!j.success) { setErr(j.error || 'خطأ'); return; }
    setProfile(j.profile); setLevels(j.levels || []); setCreds(j.credentials || []);
    const ids = Array.from(new Set([...(j.levels || []).map((l: any) => l.skill_id), ...(j.credentials || []).flatMap((c: any) => c.skills || [])])) as string[];
    if (ids.length) { const [{ data: sk }, { data: rs }] = await Promise.all([db.from('portal_skills').select('*').in('id', ids), db.from('portal_resources').select('id,title_ar,title_en,type,level,access,skills,status').eq('status', 'published').overlaps('skills', ids).limit(6)]); setSkills(new Map(((sk || []) as Skill[]).map(s => [s.id, s]))); setNext((rs || []) as Resource[]); }
  }
  useEffect(() => { (async () => { try { const { data: { user: u } } = await db.auth.getUser(); if (u) { setUser({ id: u.id, email: u.email || '' }); try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } await load(); } } catch { /* ignore */ } setLoaded(true); })(); }, [db]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendLink(e: React.FormEvent) { e.preventDefault(); setErr(''); const em = email.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(lang === 'ar' ? 'البريد الإلكتروني غير صالح' : 'Invalid email'); return; } setBusy('link'); try { localStorage.setItem(RESUME_KEY, '/me/skills'); } catch { /* ignore */ } const { error } = await db.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/me/skills` } }); setBusy(''); if (error) setErr(error.message); else setSent(true); }
  async function share(mode: ShareMode, extra: Record<string, string> = {}) { setBusy('share'); setErr(''); setOk(''); try { const tk = await token(); const j = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'share', share_mode: mode, ...extra }) }).then(x => x.json()); if (!j.success) setErr(j.error); else { setProfile(j.profile); setEdit(null); setOk(lang === 'ar' ? 'حُفظت الإعدادات.' : 'Saved.'); } } catch (x: any) { setErr(String(x?.message || x)); } setBusy(''); }
  async function passport() {
    setBusy('pdf'); setErr(''); setOk('');
    try { const d = buildPassport({ profile: profile || { public_id: '', share_mode: 'private' }, email: user?.email, levels, skills, credentials: creds, site: normalizeSite(window.location.origin), lang }); const n = await downloadPassport(d); setOk(lang === 'ar' ? `نُزّل جواز المهارات (${n} ${n === 1 ? 'صفحة' : 'صفحات'}).` : `Passport downloaded (${n} page${n === 1 ? '' : 's'}).`); }
    catch (e: any) { setErr(String(e?.message || e)); }
    setBusy('');
  }
  function downloadBadge(c: Credential) { const blob = new Blob([JSON.stringify(c.badge || {}, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `athar-credential-${c.verify_code}.json`; document.body.appendChild(a); a.click(); a.remove(); }

  const byDomain = useMemo(() => DOMAINS.map(d => ({ d, items: levels.filter(l => skills.get(l.skill_id)?.domain === d.value).sort((a, b) => displayLevel(b) - displayLevel(a)) })).filter(x => x.items.length), [levels, skills]);
  const publicUrl = profile && typeof window !== 'undefined' ? `${window.location.origin}/p/${profile.public_id}` : '';
  const approvedCount = levels.filter(l => l.approved_level).length; const strong = levels.filter(l => l.confidence >= 70).length;

  return (
    <main className="pt-main sk">
      <section className="pt-pagehead"><div className="pt-wrap">
        <div className="pt-crumbs"><Link href="/">{lang === 'ar' ? 'الرئيسية' : 'Home'}</Link> / <Link href="/me">{lang === 'ar' ? 'بوابة المتدرب' : 'Student portal'}</Link> / <span>{lang === 'ar' ? 'ملفي المهاري' : 'My skills profile'}</span></div>
        <h1>{lang === 'ar' ? 'ملفي المهاري' : 'My Skills Profile'}</h1>
        <p>{lang === 'ar' ? 'كل مهارة هنا مبنية على أدلة حقيقية: اختبار مِعيار، البرامج والجلسات، الأنشطة، والشهادات — مربوطة بالأطر المرجعية (SAQF · SDAIA · CEFR). المستوى المحسوب مؤشر، والمعتمد يضعه مدرب أو الإدارة.' : 'Every skill here rests on real evidence — Mi‘yar, programs and sessions, activities and credentials — mapped to SAQF, SDAIA and CEFR. Computed levels are indicators; approved levels are set by a trainer or admin.'}</p>
        {user && levels.length > 0 && <div className="sk-kpis"><span><b>{levels.length}</b> {lang === 'ar' ? 'مهارة بأدلة' : 'skills with evidence'}</span><span><b>{strong}</b> {lang === 'ar' ? 'بأدلة قوية' : 'strong evidence'}</span><span><b>{approvedCount}</b> {lang === 'ar' ? 'معتمدة' : 'approved'}</span><span><b>{creds.filter(c => credentialStatus(c) === 'valid').length}</b> {lang === 'ar' ? 'شهادة رقمية' : 'credentials'}</span><button type="button" className="pt-btn light small sk-pdf" disabled={busy === 'pdf'} onClick={passport}><Icon name="download" size={13} /> {busy === 'pdf' ? '…' : (lang === 'ar' ? 'جواز المهارات PDF' : 'Skills passport PDF')}</button></div>}
      </div></section>

      <section className="pt-sec"><div className="pt-wrap">
        {!loaded && <div className="pt-empty">…</div>}
        {loaded && !user && <div className="pt-box" style={{ maxWidth: 440 }}><h3><Icon name="login" size={18} /> {lang === 'ar' ? 'ادخل ببريدك لعرض ملفك' : 'Sign in to view your profile'}</h3>{sent ? <div className="pt-alert ok">{lang === 'ar' ? 'أرسلنا رابط الدخول إلى بريدك.' : 'Sign-in link sent.'}</div> : <form onSubmit={sendLink} className="pt-form"><label>{lang === 'ar' ? 'بريدك الإلكتروني' : 'Your email'}<input dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="pt-btn" disabled={busy === 'link'}><Icon name="mail" size={15} /> {lang === 'ar' ? 'أرسل رابط الدخول' : 'Send sign-in link'}</button></form>}{err && <div className="pt-alert err">{err}</div>}</div>}
        {loaded && user && <div className="pt-two">
          <div style={{ display: 'grid', gap: 14 }}>
            {levels.length === 0 && <div className="pt-box pt-empty"><Icon name="target" size={28} /><p>{lang === 'ar' ? 'لا أدلة بعد. ابدأ باختبار مِعيار، أو سجّل في برنامج، أو احضر جلسة — وسيبدأ ملفك بالتشكّل تلقائيًا.' : 'No evidence yet. Take the Mi‘yar test, enrol in a program or attend a session — your profile builds itself.'}</p><div className="pt-chips"><Link href="/programs" className="pt-btn small">{lang === 'ar' ? 'البرامج' : 'Programs'}</Link><Link href="/live" className="pt-btn light small">{lang === 'ar' ? 'الجلسات' : 'Sessions'}</Link></div></div>}
            {byDomain.map(({ d, items }) => <div key={d.value} className="pt-box sk-dom"><h3><span className={`sk-dot ${d.tone}`} /> {t(d.label, lang)} <small>({items.length})</small></h3>
              <div className="sk-list">{items.map(l => { const s = skills.get(l.skill_id); if (!s) return null; const lv = displayLevel(l); const open = openSkill === l.skill_id; return (
                <div key={l.skill_id} className={`sk-item ${open ? 'open' : ''}`}>
                  <button type="button" className="sk-row" onClick={() => setOpenSkill(open ? null : l.skill_id)}>
                    <div className="sk-name"><b>{skillName(s, lang)}</b><small>{s.code} · {frameworkBadges(s).map(b => b.label).join(' · ') || domainLabel(s.domain, lang)}</small></div>
                    <div className="sk-level"><div className="sk-dots">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= lv ? 'on' : ''} />)}</div><b>{lv}/5 · {levelName(lv, lang)}</b><small>{l.approved_level ? <span className="sk-approved"><Icon name="check" size={11} /> {lang === 'ar' ? 'معتمد' : 'Approved'}</span> : `${confidenceLabel(l.confidence, lang)} · ${l.computed_level.toFixed(1)}`}</small></div>
                  </button>
                  {open && <div className="sk-ev"><b>{lang === 'ar' ? 'الأدلة' : 'Evidence'} ({l.evidence.length})</b>{l.evidence.slice(0, 8).map((e, i) => <div key={i} className="sk-evrow"><span className={`sk-evk ${e.kind}`}>{t(EVIDENCE_LABEL[e.kind], lang)}</span><span>{e.label || ''}</span><span className="sk-evl">{lang === 'ar' ? 'مستوى' : 'level'} {e.level}</span><small><bdi>{fmtDate(e.at, lang)}</bdi></small></div>)}{l.approved_note && <p className="pt-muted">{lang === 'ar' ? 'ملاحظة الاعتماد:' : 'Approval note:'} {l.approved_note}</p>}</div>}
                </div>); })}</div></div>)}
            {creds.length > 0 && <div className="pt-box"><h3><Icon name="award" size={18} /> {lang === 'ar' ? 'شهاداتي الرقمية' : 'My digital credentials'}</h3><div className="sk-creds">{creds.map(c => { const st = credentialStatus(c); return <div key={c.id} className={`sk-cred ${st}`}><div><b>{credentialTitle(c, lang)}</b><small>{credentialKindLabel(c.kind, lang)}{c.level ? ` · ${c.level}` : ''} · <bdi>{fmtDate(c.issued_at, lang)}</bdi> · <span dir="ltr">{c.verify_code}</span>{st !== 'valid' && <em> · {st === 'revoked' ? (lang === 'ar' ? 'ملغاة' : 'Revoked') : (lang === 'ar' ? 'منتهية' : 'Expired')}</em>}</small></div><div className="pt-chips"><Link href={`/credential/${c.verify_code}`} className="pt-btn light small"><Icon name="shield" size={13} /> {lang === 'ar' ? 'صفحة التحقق' : 'Verify'}</Link><button type="button" className="pt-btn ghost small" onClick={() => downloadBadge(c)}><Icon name="download" size={13} /> Open Badge</button><a className="pt-btn ghost small" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(c.title_en || c.title_ar)}&organizationName=${encodeURIComponent('Athar · TRACE')}&issueYear=${new Date(c.issued_at).getFullYear()}&issueMonth=${new Date(c.issued_at).getMonth() + 1}&certUrl=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/credential/${c.verify_code}`)}&certId=${encodeURIComponent(c.verify_code)}`}>LinkedIn</a></div></div>; })}</div></div>}
            <div className="pt-box sk-plan"><h3><Icon name="star" size={18} /> {lang === 'ar' ? 'خطة تطويري الذكية' : 'My smart development plan'}</h3>
              <p className="pt-muted">{lang === 'ar' ? 'يقرأ المساعد ملفك المهاري والعروض المتاحة في أَثَر ويقترح خطة 4–8 أسابيع — للاسترشاد، وأنت من يقرر.' : 'The assistant reads your skills profile and what Athar offers, then suggests a 4–8 week plan — guidance only; you decide.'}</p>
              <div className="sk-planform"><input value={goal} onChange={e => setGoal(e.target.value.slice(0, 200))} placeholder={lang === 'ar' ? 'هدفك (اختياري): مثل «أدرّب زملائي على تصميم الأنشطة»' : 'Your goal (optional)'} /><button type="button" className="pt-btn" disabled={busy === 'plan'} onClick={makePlan}><Icon name="star" size={14} /> {busy === 'plan' ? (lang === 'ar' ? 'جارٍ الإعداد…' : 'Preparing…') : plan ? (lang === 'ar' ? 'خطة جديدة' : 'New plan') : (lang === 'ar' ? 'اقترح خطتي' : 'Suggest my plan')}</button></div>
              {plan && <div className="sk-planout">
                <div className="sk-planhead"><b>{plan.data.goal}</b><span className={`sk-src ${plan.source}`}>{plan.source === 'ai' ? (lang === 'ar' ? 'ذكاء اصطناعي' : 'AI') : (lang === 'ar' ? 'بديل محلي' : 'local')}</span></div>
                <div className="sk-plancols"><div><h4>{lang === 'ar' ? 'نقاط قوتك' : 'Strengths'}</h4><ul>{plan.data.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div><div><h4>{lang === 'ar' ? 'فجواتك' : 'Gaps'}</h4><ul>{plan.data.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>
                <ol className="sk-steps">{plan.data.steps.map((st, i) => <li key={i}><div><b>{st.href ? <Link href={st.href}>{st.title}</Link> : st.title}</b><small>{st.why}{st.hours ? ` · ~${st.hours} ${lang === 'ar' ? 'س/أسبوع' : 'h/wk'}` : ''}</small></div><span className={`sk-kind ${st.kind}`}>{st.kind === 'program' ? (lang === 'ar' ? 'برنامج' : 'program') : st.kind === 'resource' ? (lang === 'ar' ? 'حقيبة' : 'resource') : st.kind === 'session' ? (lang === 'ar' ? 'جلسة' : 'session') : (lang === 'ar' ? 'تطبيق' : 'practice')}</span></li>)}</ol>
                <p className="sk-planmsg">{plan.data.message} <small>({lang === 'ar' ? `${plan.data.weekly_hours} ساعات أسبوعيًا` : `${plan.data.weekly_hours} h/week`})</small></p>
                <small className="pt-muted">{AI_DISCLAIMER[lang]} · <Link href="/ai">{lang === 'ar' ? 'سياسة الذكاء الاصطناعي' : 'AI policy'}</Link>{plan.usage ? ` · ${plan.usage.used}/${plan.usage.limit}` : ''}</small>
              </div>}
            </div>
            {next.length > 0 && <div className="pt-box"><h3><Icon name="compass" size={18} /> {lang === 'ar' ? 'ما التالي؟ مواد ترفع مهاراتك' : 'What next? Resources for your skills'}</h3><div className="pt-chips">{next.map(r => <Link key={r.id} href={`/resources/${r.id}`} className="pt-chip">{resTitle(r, lang)}</Link>)}</div></div>}
          </div>

          <aside className="pt-box pt-sticky sk-aside">
            <h3><Icon name="users" size={18} /> {lang === 'ar' ? 'حسابي والمشاركة' : 'Account & sharing'}</h3>
            {!edit && <div className="sk-prof"><b>{profile?.display_name || user.email}</b>{profile?.headline && <small>{profile.headline}</small>}{profile?.city && <small>{profile.city}</small>}<small dir="ltr">{user.email}</small><button type="button" className="pt-btn ghost small" onClick={() => setEdit({ display_name: profile?.display_name || '', headline: profile?.headline || '', city: profile?.city || '' })}><Icon name="edit" size={13} /> {lang === 'ar' ? 'تعديل' : 'Edit'}</button></div>}
            {edit && <div className="pt-form"><label>{lang === 'ar' ? 'الاسم المعروض' : 'Display name'}<input value={edit.display_name} onChange={e => setEdit({ ...edit, display_name: e.target.value })} /></label><label>{lang === 'ar' ? 'المسمى / وصف قصير' : 'Headline'}<input value={edit.headline} onChange={e => setEdit({ ...edit, headline: e.target.value })} /></label><label>{lang === 'ar' ? 'المدينة' : 'City'}<input value={edit.city} onChange={e => setEdit({ ...edit, city: e.target.value })} /></label><div className="pt-chips"><button type="button" className="pt-btn small" disabled={busy === 'share'} onClick={() => share(profile?.share_mode || 'private', edit)}>{lang === 'ar' ? 'حفظ' : 'Save'}</button><button type="button" className="pt-btn ghost small" onClick={() => setEdit(null)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button></div></div>}
            <div className="sk-share"><b>{lang === 'ar' ? 'من يرى ملفي المهاري؟' : 'Who can see my profile?'}</b>{SHARE_MODES.map(m => <label key={m.value} className={`sk-mode ${profile?.share_mode === m.value ? 'on' : ''}`}><input type="radio" name="share" checked={profile?.share_mode === m.value} disabled={busy === 'share'} onChange={() => share(m.value)} /><span><b>{t(m.label, lang)}</b><small>{t(m.hint, lang)}</small></span></label>)}</div>
            {profile && profile.share_mode !== 'private' && <div className="sk-link"><small>{lang === 'ar' ? 'رابط ملفك العام' : 'Your public link'}</small><div className="sk-linkrow"><input dir="ltr" readOnly value={publicUrl} onFocus={e => e.currentTarget.select()} /><button type="button" className="pt-btn small" onClick={() => { navigator.clipboard?.writeText(publicUrl); setOk(lang === 'ar' ? 'نُسخ الرابط.' : 'Copied.'); }}><Icon name="copy" size={13} /></button></div><Link href={`/p/${profile.public_id}`} target="_blank" className="pt-btn light small"><Icon name="globe" size={13} /> {lang === 'ar' ? 'معاينة' : 'Preview'}</Link></div>}
            {ok && <div className="pt-alert ok">{ok}</div>}{err && <div className="pt-alert err">{err}</div>}
            <small className="pt-muted" style={{ display: 'block', marginTop: 10 }}>{lang === 'ar' ? 'الخصوصية افتراضية: ملفك خاص حتى تختار مشاركته. الصفحة العامة لا تعرض بريدك أو هاتفك.' : 'Private by default. The public page never shows your email or phone.'}</small>
          </aside>
        </div>}
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
.sk-kpis{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px;font-size:13.5px;color:rgba(255,255,255,.85);align-items:center}.sk-kpis b{font-size:20px;color:#fff;margin-inline-end:4px}.sk-pdf{margin-inline-start:auto}
.sk-dom h3{display:flex;align-items:center;gap:8px}.sk-dom h3 small{color:#64748b;font-weight:600}.sk-dot{width:12px;height:12px;border-radius:50%;background:#0f2a4e;display:inline-block}.sk-dot.teal{background:#0b8a83}.sk-dot.gold{background:#c9a24b}.sk-dot.ok{background:#047857}.sk-dot.violet{background:#6d28d9}.sk-dot.sky{background:#0284c7}.sk-dot.warn{background:#d97706}.sk-dot.rose{background:#be123c}
.sk-list{display:grid;gap:8px}.sk-item{border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden}.sk-item.open{border-color:#0b8a83}.sk-row{width:100%;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px 14px;background:transparent;border:0;font:inherit;text-align:start;cursor:pointer}
.sk-name b{display:block;font-size:14.5px;color:#0f172a}.sk-name small{color:#64748b;font-size:12px;direction:ltr;display:block;text-align:start}
.sk-level{text-align:end;display:grid;gap:2px;justify-items:end}.sk-dots{display:flex;gap:3px}.sk-dots i{width:14px;height:8px;border-radius:4px;background:#e2e8f0}.sk-dots i.on{background:#0b8a83}.sk-level b{font-size:12.5px;color:#0f2a4e}.sk-level small{font-size:11.5px;color:#64748b}.sk-approved{color:#065f46;font-weight:900;display:inline-flex;gap:3px;align-items:center}
.sk-ev{border-top:1px dashed #e2e8f0;padding:10px 14px;display:grid;gap:6px;background:#f8fafc}.sk-ev>b{font-size:12.5px;color:#0f2a4e}.sk-evrow{display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:center;font-size:12.5px;color:#334155}.sk-evk{font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;background:#e2e8f0;color:#334155}.sk-evk.placement{background:#dbeafe;color:#1e40af}.sk-evk.credential{background:#fdf6e3;color:#9a7417}.sk-evk.program_completed{background:#dcfce7;color:#166534}.sk-evk.activity{background:#ede9fe;color:#5b21b6}.sk-evl{color:#0b8a83;font-weight:800}.sk-evrow small{color:#94a3b8}
.sk-creds{display:grid;gap:8px}.sk-cred{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;background:#fff}.sk-cred.revoked,.sk-cred.expired{opacity:.6}.sk-cred b{display:block;font-size:14px;color:#0f172a}.sk-cred small{color:#64748b;font-size:12px}.sk-cred em{color:#991b1b;font-style:normal;font-weight:800}
.sk-aside{display:grid;gap:12px;align-content:start}.sk-prof{display:grid;gap:3px}.sk-prof b{font-size:15px;color:#0f172a}.sk-prof small{color:#64748b;font-size:12.5px}.sk-prof .pt-btn{justify-self:start;margin-top:6px}
.sk-share{display:grid;gap:6px;border-top:1px dashed #e2e8f0;padding-top:12px}.sk-share>b{font-size:13.5px;color:#0f2a4e}.sk-mode{display:flex;gap:8px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;cursor:pointer}.sk-mode.on{border-color:#0b8a83;background:#f0fdfa}.sk-mode span{display:grid;gap:1px}.sk-mode b{font-size:13px;color:#0f172a}.sk-mode small{font-size:11.5px;color:#64748b}
.sk-link{display:grid;gap:6px}.sk-link small{color:#64748b}.sk-linkrow{display:flex;gap:6px}.sk-linkrow input{flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;font:inherit;font-size:12.5px;background:#f8fafc}
.pt-sticky{position:sticky;top:84px}.pt-muted{color:#64748b;font-size:13px;line-height:1.8}
.sk-plan h3{color:#0b8a83}.sk-planform{display:flex;gap:8px;flex-wrap:wrap}.sk-planform input{flex:1;min-width:220px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit;font-size:13.5px}.sk-planout{margin-top:14px;border:1px solid #cfe9e6;background:#f3fbfa;border-radius:12px;padding:12px 14px}.sk-planhead{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.sk-planhead b{color:#0f2a4e;font-size:15px}.sk-src{font-size:11px;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#475569}.sk-src.ai{background:#0b8a83;color:#fff}.sk-plancols{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;margin-top:6px}.sk-plancols h4{margin:6px 0 2px;font-size:12.5px;color:#0b8a83}.sk-plancols ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.7;color:#334155}.sk-steps{margin:10px 0 0;padding-inline-start:20px;display:grid;gap:8px}.sk-steps li{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.sk-steps b{display:block;font-size:14px;color:#0f2a4e}.sk-steps b a{color:#0b8a83}.sk-steps small{display:block;color:#64748b;font-size:12.5px;line-height:1.6}.sk-kind{flex:none;font-size:11px;padding:2px 8px;border-radius:999px;background:#eef2f7;color:#475569}.sk-kind.program{background:#e8eefc;color:#1d4ed8}.sk-kind.resource{background:#fdf6e3;color:#9a6b00}.sk-kind.session{background:#e6f4f1;color:#0b8a83}.sk-planmsg{margin:10px 0 4px;font-size:13.5px;color:#0f2a4e}.sk-planmsg small{color:#64748b}
@media(max-width:760px){.sk-plancols{grid-template-columns:1fr}}
@media(max-width:760px){.pt-sticky{position:static}.sk-row{grid-template-columns:1fr}.sk-level{justify-items:start;text-align:start}.sk-evrow{grid-template-columns:1fr 1fr}}
`;
